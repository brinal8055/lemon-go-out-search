import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EmbeddingRequestError,
  requestVoyageEmbeddings,
} from '../packages/embedding/src/voyage-client.ts';
import type { EvalCorpusRecordV1 } from '../packages/evaluation/src/index.ts';
import { parseTimeExpression, STOCKHOLM_TIME_ZONE } from '../packages/time-parser/src/index.ts';
import { normalizeForEdgeSearch } from '../supabase/functions/search/normalization.ts';
import {
  buildSemanticQueryInput,
  SEMANTIC_QUERY_TEMPLATE_VERSION,
  SEMANTIC_TIMEOUT_MS,
  shouldEmbed,
} from '../supabase/functions/search/semantic.ts';
import { recognizeTaxonomyQuery, taxonomyContextById } from '../supabase/functions/search/semantic-taxonomy.ts';

const args = process.argv.slice(2);
const outputPath = resolve(requiredArg('--output'));
const queryIds = requiredArg('--query-ids').split(',');
const diagnoseRanking = args.includes('--diagnose-ranking');
const spacingMs = Number(optionalArg('--provider-spacing-ms') ?? '31000');
if (queryIds.length < 1 || queryIds.length > 4 || queryIds.some((queryId) => queryIds.filter((value) => value === queryId).length > 2)) {
  throw new Error('ONE_TO_FOUR_QUERY_IDS_MAX_TWO_REPEATS_REQUIRED');
}
if (!Number.isInteger(spacingMs) || spacingMs < 31_000) throw new Error('PROVIDER_SPACING_UNSAFE');
const apiKey = process.env.VOYAGE_API_KEY;
if (!apiKey) throw new Error('VOYAGE_API_KEY_REQUIRED');
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const require = createRequire(new URL('../packages/evaluation/package.json', import.meta.url));
const pg = require('pg') as { Client: new (options: { connectionString: string }) => PgClient };

const root = new URL('../', import.meta.url);
const corpusText = await readFile(new URL('evaluation/corpus/corpus.v1.jsonl', root), 'utf8');
const devRecords = corpusText.split(/\r?\n/).filter((line) => line.includes('"split":"DEV"'))
  .map((line) => JSON.parse(line) as EvalCorpusRecordV1);
const decisions = devRecords.map(semanticDecision);
const selected = queryIds.map((queryId) => {
  const value = decisions.find((decision) => decision.queryId === queryId);
  if (!value?.shouldEmbed) throw new Error(`PROBE_QUERY_NOT_SEMANTIC:${queryId}`);
  return value;
});

const results: Array<Record<string, unknown>> = [];
const database = diagnoseRanking ? new pg.Client({ connectionString }) : null;
if (database) await database.connect();
let lastProviderStart = -Infinity;
try {
  for (const decision of selected) {
    const pacingWaitStartedAt = Date.now();
    const waitMs = Math.max(0, lastProviderStart + spacingMs - pacingWaitStartedAt);
    if (waitMs > 0) await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
    const pacingWaitEndedAt = Date.now();
    const providerStartedAt = Date.now();
    lastProviderStart = providerStartedAt;
    const timer = performance.now();
    let httpStatus: number | null = null;
    try {
    const response = await requestVoyageEmbeddings([decision.providerInput], 'query', apiKey, {
      timeoutMs: SEMANTIC_TIMEOUT_MS,
      fetch: async (request, init) => {
        const value = await fetch(request, init);
        httpStatus = value.status;
        return value;
      },
    });
      results.push({
      queryId: decision.queryId, language: decision.language, shouldEmbedReason: decision.reason,
      status: 'SUCCESS', pacingWaitMs: pacingWaitEndedAt - pacingWaitStartedAt,
      providerElapsedMs: performance.now() - timer, providerTimeoutMs: SEMANTIC_TIMEOUT_MS,
      httpStatus, reportedTokens: response.totalTokens,
      providerInputFingerprint: fingerprintText(decision.providerInput),
      queryVectorFingerprint: fingerprintQueryVector(response.embeddings[0]),
      ...(database ? { rankingDiagnostics: await rankingDiagnostics(database, decision, response.embeddings[0]) } : {}),
      });
    } catch (error) {
      const providerError = error instanceof EmbeddingRequestError ? error : null;
      results.push({
      queryId: decision.queryId, language: decision.language, shouldEmbedReason: decision.reason,
      status: providerError?.errorCode === 'PROVIDER_TIMEOUT' ? 'TIMEOUT' : 'PROVIDER_ERROR',
      pacingWaitMs: pacingWaitEndedAt - pacingWaitStartedAt,
      providerElapsedMs: performance.now() - timer, providerTimeoutMs: SEMANTIC_TIMEOUT_MS,
      httpStatus, errorClass: providerError?.errorClass ?? 'UNKNOWN', errorCode: providerError?.errorCode ?? 'UNKNOWN',
      });
    }
  }
} finally {
  await database?.end();
}

const artifact = {
  reportVersion: 'postcov-semantic-probe.v1',
  label: 'PRODUCTION_EQUIVALENT_700MS_PROBE',
  contract: {
    provider: 'Voyage', model: EMBEDDING_MODEL, revision: EMBEDDING_MODEL_REVISION,
    dimension: 1024, inputType: 'query', queryTemplate: SEMANTIC_QUERY_TEMPLATE_VERSION,
    providerTimeoutMs: SEMANTIC_TIMEOUT_MS, providerSpacingMs: spacingMs, concurrency: 1,
  },
  devQueryCount: devRecords.length,
  shouldEmbedCount: decisions.filter(({ shouldEmbed: value }) => value).length,
  shouldEmbedQueries: decisions.filter(({ shouldEmbed: value }) => value)
    .map(({ queryId, language, reason }) => ({ queryId, language, reason })),
  connectionReuse: 'NODE_GLOBAL_FETCH_SHARED_UNDICI_DISPATCHER',
  results,
};
await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(artifact));

function semanticDecision(record: EvalCorpusRecordV1) {
  const taxonomyFilter = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = record.request_filters.location as { latitude?: unknown; longitude?: unknown; radius_meters?: unknown } | undefined;
  let query = record.query;
  let time: { start: string; end: string } | undefined;
  const parsedTime = parseTimeExpression(query, { now: new Date('2026-10-15T12:00:00Z'), timeZone: STOCKHOLM_TIME_ZONE });
  if (parsedTime?.status === 'PARSED') {
    query = parsedTime.lexicalText;
    time = parsedTime.interval;
  }
  const normalized = normalizeForEdgeSearch(query).preserving;
  const taxonomyRecognition = recognizeTaxonomyQuery(normalized);
  const explicitTaxonomyId = typeof taxonomyFilter?.node_id === 'string' ? taxonomyFilter.node_id : undefined;
  const taxonomyId = explicitTaxonomyId ?? taxonomyRecognition?.id;
  const hasLocation = typeof location?.latitude === 'number' && typeof location.longitude === 'number'
    && typeof location.radius_meters === 'number';
  const decision = shouldEmbed({
    normalizedQuery: normalized, semanticEnabled: true, circuitOpen: false,
    recognizedTaxonomyOnly: taxonomyRecognition !== null, hasTime: time !== undefined,
    hasTaxonomyConstraint: taxonomyId !== undefined && taxonomyRecognition === null,
    hasLocationConstraint: hasLocation,
  });
  return {
    record, queryId: record.query_id, language: record.language, shouldEmbed: decision.shouldEmbed, reason: decision.reason,
    providerInput: buildSemanticQueryInput(normalized, taxonomyRecognition ?? taxonomyContextById(taxonomyId), time),
  };
}

function requiredArg(name: string): string {
  const value = optionalArg(name);
  if (!value) throw new Error(`${name.slice(2).replaceAll('-', '_').toUpperCase()}_REQUIRED`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function fingerprintQueryVector(value: number[]): string {
  return createHash('sha256').update(Buffer.from(new Float32Array(value).buffer)).digest('hex');
}

function fingerprintText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown>>(query: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

async function rankingDiagnostics(database: PgClient, decision: ReturnType<typeof semanticDecision>, vector: number[]) {
  const vectorLiteral = `[${vector.join(',')}]`;
  const parameters = rankingParameters(decision, vectorLiteral);
  const semanticParameters = parameters.slice(0, 8);
  const semantic = await database.query<SemanticRow>(semanticSql(), semanticParameters);
  const semanticRepeat = await database.query<SemanticRow>(semanticSql(), semanticParameters);
  const ranked = await database.query<RankedRow>(rankedSql(), parameters);
  return {
    semanticCandidates: semantic.rows,
    semanticRepeatStable: JSON.stringify(semantic.rows) === JSON.stringify(semanticRepeat.rows),
    rankedSemanticCandidates: ranked.rows,
  };
}

function rankingParameters(decision: ReturnType<typeof semanticDecision>, vectorLiteral: string): unknown[] {
  const taxonomy = decision.record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = decision.record.request_filters.location as { latitude?: unknown; longitude?: unknown; radius_meters?: unknown } | undefined;
  return [
    vectorLiteral, decision.record.scope.scope_id, '2026-10-15T12:00:00Z',
    typeof location?.latitude === 'number' ? location.latitude : null,
    typeof location?.longitude === 'number' ? location.longitude : null,
    typeof location?.radius_meters === 'number' ? location.radius_meters : null,
    typeof taxonomy?.node_id === 'string' ? taxonomy.node_id : null,
    Array.isArray(decision.record.request_filters.entity_types) ? decision.record.request_filters.entity_types : null,
    decision.record.query, 'noncollapse-v1',
  ];
}

function semanticSql(): string {
  return `select canonical_entity_id::text as entity_id, candidate_rank, cosine_distance, cosine_similarity
from app.search_semantic_candidates(
  $1::extensions.vector, $2::uuid, $3::timestamptz,
  (select event_horizon_days from app.search_configs where is_active),
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, $4::double precision, $5::double precision, $6::integer,
  $7::uuid, $8::app.entity_type[], 'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
) order by candidate_rank`;
}

function rankedSql(): string {
  return `select canonical_entity_id::text as entity_id, (stage_ranks->>'SEMANTIC')::integer as semantic_rank,
       rrf_score::text as rrf_score, rrf_contributions, pre_protection_fused_rank, base_rank,
       final_rank, tie_break_key::text as tie_break_key, tie_break_reason, moved
from app.search_noncollapse_candidates(
  $9::text, $2::uuid, $3::timestamptz, $4::double precision, $5::double precision,
  $6::integer, $7::uuid, $8::app.entity_type[], null, null, $1::extensions.vector, $10::text
) where semantic_present order by final_rank`;
}

type SemanticRow = { entity_id: string; candidate_rank: number; cosine_distance: number; cosine_similarity: number };
type RankedRow = {
  entity_id: string; semantic_rank: number; rrf_score: string; rrf_contributions: unknown;
  pre_protection_fused_rank: number; base_rank: number; final_rank: number;
  tie_break_key: string; tie_break_reason: string; moved: boolean;
};
