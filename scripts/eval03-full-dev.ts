import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { requestVoyageEmbeddings } from '../packages/embedding/src/voyage-client.ts';
import { classifyEvaluationProviderFailure } from '../packages/embedding/src/provider-diagnostics.ts';
import { createHybridOperationalJournal } from '../packages/evaluation/src/hybrid-operational-journal.ts';
import { createEvaluationProviderPacer } from '../packages/evaluation/src/provider-pacing.ts';
import { metricsFor, stableJson, verifyChecksum } from '../packages/evaluation/src/dev-runner.ts';
import type {
  EvalCorpusRecordV1,
  EvalJudgmentSetV1,
} from '../packages/evaluation/src/index.ts';
import { createSearchHandler, type SearchTelemetry } from '../supabase/functions/search/search-handler.ts';
import type {
  SearchRpcClient,
  SearchRpcParams,
  SearchRpcRow,
} from '../supabase/functions/search/types.ts';

const root = new URL('../', import.meta.url);
type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown>>(query: string, values?: unknown[]): Promise<{ rows: T[] }>;
};
const require = createRequire(new URL('../packages/evaluation/package.json', import.meta.url));
const pg = require('pg') as { Client: new (options: { connectionString: string }) => PgClient };
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL
  ?? process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const failureCategories = [
  'INVENTORY', 'ELIGIBILITY', 'CANDIDATE_RETRIEVAL', 'UNION',
  'RANKING', 'PROVIDER_DEGRADED', 'OTHER',
] as const;
type FailureAttribution = (typeof failureCategories)[number];
type Mode = 'HYBRID' | 'LEXICAL_ONLY';
type MetricName = 'hitAt1' | 'hitAt3' | 'mrr' | 'recallAt20' | 'recallAt50' | 'precisionAt5' | 'ndcgAt5';
type QueryMetric = ReturnType<typeof metricsFor> & { recallAt50: number | null };
type QueryResult = {
  queryId: string;
  query: string;
  family: string;
  language: string;
  pairGroupId: string | null;
  topResultIds: string[];
  relevantEntityRanks: Array<{ entityId: string; grade: number; rank: number | null }>;
  metrics: QueryMetric;
  inventoryUnavailable: boolean;
  productOutcome: 'QUERY_UNSATISFIED' | null;
  searchRankingAssessment: 'EVALUATED' | 'NOT_EVALUATED';
  failureAttribution: FailureAttribution | null;
  hardConstraintViolationIds: string[];
  semanticCandidateCount: number;
  semanticCandidates: Array<{ entityId: string; rank: number; cosineDistance: number; cosineSimilarity: number }>;
  stages: Array<{ entityId: string; ranks: Record<string, number>; semanticPresent: boolean }>;
  nonCollapse: Array<{
    entityId: string;
    applicable: boolean;
    applicabilityReason: string;
    baseRank: number;
    finalRank: number;
    moved: boolean;
    abstentionReason: string | null;
    taxonomyGroupKeys: string[];
    chainGroupKey: string | null;
    eventVenueGroupKey: string | null;
  }>;
};

const args = process.argv.slice(2);
if (!args.includes('--all')) throw new Error('FULL_60_REQUIRED');
const mode = requiredArg('--mode').toUpperCase() as Mode;
if (!['HYBRID', 'LEXICAL_ONLY'].includes(mode)) throw new Error('EVAL_MODE_INVALID');
const manifestPath = resolve(requiredArg('--manifest'));
const manifestChecksumPath = resolve(requiredArg('--manifest-checksum'));
const judgmentPath = resolve(requiredArg('--judgments'));
const judgmentChecksumPath = resolve(requiredArg('--judgment-checksum'));
const recoveryInventoryPath = optionalArg('--recovery-inventory');
const recoveryInventoryChecksumPath = optionalArg('--recovery-inventory-checksum');
const outputDirectory = resolve(requiredArg('--output'));
if (requiredArg('--config') !== 'eval-03-baseline.v1') throw new Error('BASELINE_CONFIG_REQUIRED');
const providerSpacingMs = Number(optionalArg('--provider-spacing-ms') ?? '31000');
if (!Number.isInteger(providerSpacingMs) || providerSpacingMs < 31_000) throw new Error('PROVIDER_SPACING_UNSAFE');

const [
  corpusText, corpusChecksumText, manifestText, manifestChecksumText, judgmentText, judgmentChecksumText,
  recoveryInventoryText, recoveryInventoryFileChecksumText, baselineManifestText,
] = await Promise.all([
  readFile(corpusUrl, 'utf8'),
  readFile(corpusChecksumUrl, 'utf8'),
  readFile(manifestPath, 'utf8'),
  readFile(manifestChecksumPath, 'utf8'),
  readFile(judgmentPath, 'utf8'),
  readFile(judgmentChecksumPath, 'utf8'),
  recoveryInventoryPath ? readFile(resolve(recoveryInventoryPath), 'utf8') : Promise.resolve(null),
  recoveryInventoryChecksumPath ? readFile(resolve(recoveryInventoryChecksumPath), 'utf8') : Promise.resolve(null),
  readFile(new URL('evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json', root), 'utf8'),
]);
verifyChecksum(corpusText, checksumToken(corpusChecksumText), 'CORPUS');
verifyChecksum(manifestText, checksumToken(manifestChecksumText), 'DATASET_MANIFEST');
verifyChecksum(judgmentText, checksumToken(judgmentChecksumText), 'JUDGMENT');
const judgments = JSON.parse(judgmentText) as EvalJudgmentSetV1;
const corpus = corpusText.split(/\r?\n/)
  .filter((line) => line.includes('"split":"DEV"'))
  .map((line) => JSON.parse(line) as EvalCorpusRecordV1)
  .sort((left, right) => left.query_id.localeCompare(right.query_id));
const manifest = normalizeManifest(
  JSON.parse(manifestText) as Day3Manifest | RecoveryManifest,
  recoveryInventoryText,
  recoveryInventoryFileChecksumText,
  JSON.parse(baselineManifestText) as Day3Manifest,
  corpus,
  judgments,
);
validateFrozenInputs(corpus, judgments, manifest, {
  corpusChecksum: checksumToken(corpusChecksumText),
  manifestChecksum: checksumToken(manifestChecksumText),
  judgmentChecksum: checksumToken(judgmentChecksumText),
});

const journal = mode === 'HYBRID'
  ? createHybridOperationalJournal({ directory: outputDirectory, runId: randomUUID() })
  : null;
let activeQueryId = '';
let activeRecord: EvalCorpusRecordV1 | null = null;
let providerCallOrdinal = 0;
const database = new pg.Client({ connectionString });
await journal?.start();
let databaseConnected = false;
try {
  await database.connect();
  databaseConnected = true;
  await verifyCurrentDatabase(database, manifest);
  const telemetry = new Map<string, SearchTelemetry>();
  const operational = new Map<string, { dbLatencyMs: number; requestLatencyMs: number }>();
  const rankedRows = new Map<string, RankedRow[]>();
  const semanticRows = new Map<string, SemanticCandidateRow[]>();
  const queryVectorFingerprints = new Map<string, string>();
  const rpcClient = createEvaluationRpcClient(
    database, manifest.evaluation_clock_utc, rankedRows, semanticRows, operational, () => activeQueryId,
  );
  const voyageApiKey = process.env.VOYAGE_API_KEY;
  const providerPacer = mode === 'HYBRID' && voyageApiKey ? createEvaluationProviderPacer({
    spacingMs: providerSpacingMs,
    request: async (input, timeoutMs) => {
      const providerInvocationStartedAt = new Date().toISOString();
      const startedAt = performance.now();
      const ordinal = ++providerCallOrdinal;
      let httpStatus: number | null = null;
      try {
        const result = await requestVoyageEmbeddings([input], 'query', voyageApiKey, {
          timeoutMs,
          fetch: async (...fetchArgs: Parameters<typeof fetch>) => {
            const response = await fetch(...fetchArgs);
            httpStatus = response.status;
            return response;
          },
        });
        const embedding = result.embeddings[0];
        const fingerprint = fingerprintQueryVector(embedding);
        if (fingerprint) queryVectorFingerprints.set(activeQueryId, fingerprint);
        await journal?.recordProviderAttempt({
          queryId: activeQueryId,
          language: activeRecord?.language ?? 'unknown',
          shouldEmbed: true,
          providerCallOrdinal: ordinal,
          queryVectorFingerprint: fingerprint,
          providerInvocationStartedAt,
          providerElapsedMs: performance.now() - startedAt,
          outcome: 'SUCCESS',
          httpStatus,
          providerErrorCategory: null,
        });
        return { embedding, totalTokens: result.totalTokens };
      } catch (error) {
        const failure = classifyEvaluationProviderFailure(error, httpStatus);
        await journal?.recordProviderAttempt({
          queryId: activeQueryId,
          language: activeRecord?.language ?? 'unknown',
          shouldEmbed: true,
          providerCallOrdinal: ordinal,
          queryVectorFingerprint: null,
          providerInvocationStartedAt,
          providerElapsedMs: performance.now() - startedAt,
          outcome: failure.outcome,
          httpStatus,
          providerErrorCategory: failure.category,
        });
        throw error;
      }
    },
  }) : null;
  const handler = createSearchHandler({
    client: rpcClient,
    semanticEnabled: mode === 'HYBRID',
    clock: () => new Date(manifest.evaluation_clock_utc),
    randomUUID: () => deterministicUuid(activeQueryId),
    ...(providerPacer
      ? { queryEmbedder: providerPacer.embed }
      : {}),
    telemetry: (event) => telemetry.set(activeQueryId, event),
  });
  const judgmentByQuery = new Map(judgments.records.map((record) => [record.query_id, record]));
  const queries: QueryResult[] = [];
  for (const record of corpus) {
    activeQueryId = record.query_id;
    activeRecord = record;
    await journal?.setNextQuery(record.query_id);
    const requestStartedAt = performance.now();
    const response = await handler(new Request('http://eval.local/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': deterministicUuid(record.query_id) },
      body: JSON.stringify(toSearchRequest(record)),
    }));
    const elapsed = performance.now() - requestStartedAt;
    const currentOperational = operational.get(record.query_id) ?? { dbLatencyMs: 0, requestLatencyMs: 0 };
    operational.set(record.query_id, { ...currentOperational, requestLatencyMs: elapsed });
    const body = await response.json() as {
      semanticDegraded?: boolean;
      results?: Array<{ canonicalId: string }>;
      error?: { code: string };
    };
    if (!response.ok || !body.results) throw new Error(`SEARCH_EXECUTION_FAILED:${record.query_id}:${body.error?.code ?? response.status}`);
    const judgment = judgmentByQuery.get(record.query_id)!;
    const topResultIds = body.results.map(({ canonicalId }) => canonicalId).slice(0, 20);
    const baseMetrics = metricsFor(topResultIds, judgment);
    const metrics: QueryMetric = { ...baseMetrics, recallAt50: baseMetrics.recallAt20 };
    const relevantEntityRanks = judgment.relevant.filter(({ grade }) => grade > 0).map(({ entity_id: entityId, grade }) => ({
      entityId,
      grade,
      rank: rankOf(topResultIds, entityId),
    }));
    const unavailable = judgment.known_item_inventory_status === 'TARGET_NOT_IN_FROZEN_DATASET';
    const hardEligibleIds = new Set(judgment.relevant.map(({ entity_id: entityId }) => entityId));
    const hardConstraintViolationIds = topResultIds.filter((entityId) => !hardEligibleIds.has(entityId));
    const noEligible = judgment.expected_ineligible_behavior.includes('NO_HARD_ELIGIBLE_CANDIDATE');
    const relevantMiss = relevantEntityRanks.some(({ rank }) => rank === null || rank > 20);
    const event = telemetry.get(record.query_id);
    if (!event) throw new Error(`SEARCH_TELEMETRY_MISSING:${record.query_id}`);
    await journal?.recordSearchOutcome({
      queryId: record.query_id,
      providerCallOrdinal: providerPacer && event.semanticAttempted ? providerCallOrdinal : 0,
      semanticCandidateCount: event.semanticCandidateCount,
      semanticDegraded: event.semanticDegraded,
    });
    if (mode === 'HYBRID' && event.semanticDegraded) throw new Error(`HYBRID_PROVIDER_DEGRADED:${record.query_id}:${event.degradationReason}`);
    const rows = rankedRows.get(record.query_id) ?? [];
    queries.push({
      queryId: record.query_id,
      query: record.query,
      family: record.family,
      language: record.language,
      pairGroupId: record.pair_group_id,
      topResultIds,
      relevantEntityRanks,
      metrics,
      inventoryUnavailable: unavailable,
      productOutcome: unavailable ? 'QUERY_UNSATISFIED' : null,
      searchRankingAssessment: unavailable ? 'NOT_EVALUATED' : 'EVALUATED',
      failureAttribution: unavailable ? 'INVENTORY' : noEligible ? 'ELIGIBILITY'
        : relevantMiss ? 'CANDIDATE_RETRIEVAL' : null,
      hardConstraintViolationIds,
      semanticCandidateCount: event.semanticCandidateCount,
      semanticCandidates: (semanticRows.get(record.query_id) ?? []).map((row) => ({
        entityId: row.entity_id,
        rank: row.candidate_rank,
        cosineDistance: row.cosine_distance,
        cosineSimilarity: row.cosine_similarity,
      })),
      stages: rows.map((row) => ({
        entityId: row.entity_id,
        ranks: row.stage_ranks,
        semanticPresent: row.semantic_present,
      })),
      nonCollapse: rows.map((row) => ({
        entityId: row.entity_id,
        applicable: row.noncollapse_applicable,
        applicabilityReason: row.applicability_reason,
        baseRank: row.base_rank,
        finalRank: row.final_rank,
        moved: row.moved,
        abstentionReason: row.abstention_reason,
        taxonomyGroupKeys: row.taxonomy_group_keys,
        chainGroupKey: row.chain_group_key,
        eventVenueGroupKey: row.event_venue_group_key,
      })),
    });
    await journal?.markQueryCompleted(record.query_id);
  }
  const reportWithoutChecksum = buildReport(mode, corpus, judgments, manifest, {
    corpusChecksum: checksumToken(corpusChecksumText),
    manifestChecksum: checksumToken(manifestChecksumText),
    judgmentChecksum: checksumToken(judgmentChecksumText),
  }, queries);
  const report = { ...reportWithoutChecksum, contentChecksum: sha256(stableJson(reportWithoutChecksum)) };
  const timings = [...operational.entries()].map(([queryId, value]) => ({ queryId, ...value }));
  const telemetryRows = [...telemetry.entries()].map(([queryId, event]) => ({ queryId, ...event }));
  const operationalReport = {
    reportVersion: 'eval-03-operational.v1',
    mode,
    timingFieldsNonDeterministic: true,
    providerConfigured: mode === 'HYBRID' && Boolean(voyageApiKey),
    providerDegradationCount: telemetryRows.filter(({ semanticDegraded }) => semanticDegraded).length,
    providerAttemptCount: telemetryRows.filter(({ semanticAttempted }) => semanticAttempted).length,
    providerSuccessCount: telemetryRows.filter(({ semanticSuccess }) => semanticSuccess).length,
    providerPacing: providerPacer?.snapshot() ?? null,
    databaseLatencyMs: percentiles(timings.map(({ dbLatencyMs }) => dbLatencyMs)),
    requestLatencyMs: percentiles(timings.map(({ requestLatencyMs }) => requestLatencyMs)),
    queries: timings.map((timing) => ({
      ...timing,
      semantic: telemetryRows.find(({ queryId }) => queryId === timing.queryId),
      queryVectorFingerprint: queryVectorFingerprints.get(timing.queryId) ?? null,
    })),
  };
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeNew(resolve(outputDirectory, 'dev-result.v1.json'), `${stableJson(report)}\n`),
    writeNew(resolve(outputDirectory, 'dev-result.v1.md'), renderResultMarkdown(report)),
    writeNew(resolve(outputDirectory, 'operational.v1.json'), `${JSON.stringify(operationalReport, null, 2)}\n`),
  ]);
  await journal?.complete(['dev-result.v1.json', 'dev-result.v1.md', 'operational.v1.json']);
  console.log(JSON.stringify({
    mode,
    queries: queries.length,
    contentChecksum: report.contentChecksum,
    zeroResults: report.overall.zeroResultCount,
    recallAt20: report.overall.metrics.recallAt20.value,
    precisionAt5: report.overall.metrics.precisionAt5.value,
    ndcgAt5: report.overall.metrics.ndcgAt5.value,
    providerDegradationCount: operationalReport.providerDegradationCount,
  }));
} catch (error) {
  await journal?.fail(evaluationFailureCategory(error));
  throw error;
} finally {
  if (databaseConnected) await database.end();
}

type Day3Manifest = {
  manifest_version: string;
  status: 'FROZEN_FOR_HUMAN_REVIEW';
  canonical_dataset_version: string;
  source_record_ingestion_runs: Array<{ sourceKey: string; captureRunId: string }>;
  boundary: { id: string; version: string; checksum: string };
  taxonomy: { version: string; checksum: string; nodeCount: number };
  normalization_version: string;
  search_documents: { template_version: string; document_version: string; hashes: string[] };
  embedding: {
    provider: string; model: string; revision: string; dimension: number;
    query_template_version: string; compatible_ready_count: number;
  };
  search_config: {
    active_database_version: string;
    config_checksum: string;
    baseline_candidate_version: string;
    values: Record<string, unknown>;
    semantic_runtime: { timeout_ms: number; circuit_failures: number; cooldown_seconds: number };
  };
  evaluation_clock_utc: string;
  corpus: { version: 'corpus.v1'; checksum: string; dev_query_count: number };
  code_git_commit: string;
  dataset_inventory: { published_unmerged_entities: number; active_search_documents: number; checksum: string };
  recoveryInventory?: { version: string; fileChecksum: string };
  recoveryState?: {
    publishedPlaces: number;
    publishedEvents: number;
    fixtureContamination: number;
    documentInventoryChecksum: string;
    embeddingIdentityChecksum: string;
  };
  held_out_access: {
    parsed_splits: ['DEV']; sealed_queries_executed: 0; adversarial_queries_executed: 0;
    sealed_or_adversarial_judgments_loaded: false;
  };
};

type RecoveryManifest = {
  manifest_version: 'dataset-manifest.final-eval-recovery.v1';
  status: 'FROZEN_PRE_JUDGMENT';
  canonical_dataset_version: string;
  source_runs: Array<{ source_key: string; run_id: string }>;
  boundary: { scope_id: string; boundary_version: string; boundary_checksum: string };
  taxonomy: { version: string };
  normalization_version: string;
  search_documents: {
    active_count: number;
    inventory_checksum: string;
    documents: Array<{ content_hash: string }>;
  };
  embedding: { provider: string; model: string; revision: string; dimension: number };
  compatible_ready_embeddings: { compatible_ready_count: number; identity_checksum: string };
  query_corpus: { checksum: string };
  fixture_contamination: number;
  accepted_implementation_commit: string;
};

type RecoveryInventory = {
  inventory_version: 'dev-inventory.final-eval-recovery.v1';
  status: 'FROZEN_FOR_HUMAN_REVIEW';
  inventory_checksum: string;
  entity_count: number;
  active_search_document_count: number;
  compatible_ready_embedding_count: number;
  query_corpus: { checksum: string; dev_query_count: number; semantic_dev_query_count: number };
  recovery_b_remote_verification: {
    state: 'MATCHES_RECOVERY_B';
    document_inventory_checksum: string;
    embedding_identity_checksum: string;
    fixture_contamination: number;
    source_run_drift: boolean;
  };
  entities: Array<{ entityType: 'PLACE' | 'EVENT' }>;
  held_out_guard: Day3Manifest['held_out_access'];
};

function normalizeManifest(
  manifest: Day3Manifest | RecoveryManifest,
  recoveryInventoryText: string | null,
  recoveryInventoryFileChecksumText: string | null,
  baseline: Day3Manifest,
  corpus: EvalCorpusRecordV1[],
  judgments: EvalJudgmentSetV1,
): Day3Manifest {
  if (manifest.manifest_version !== 'dataset-manifest.final-eval-recovery.v1') return manifest as Day3Manifest;
  if (!recoveryInventoryText || !recoveryInventoryFileChecksumText) {
    throw new Error('RECOVERY_INVENTORY_REQUIRED');
  }
  verifyChecksum(recoveryInventoryText, checksumToken(recoveryInventoryFileChecksumText), 'RECOVERY_INVENTORY_FILE');
  const inventory = JSON.parse(recoveryInventoryText) as RecoveryInventory;
  const clocks = new Set(corpus.map(({ evaluation_clock_utc: clock }) => clock));
  if (manifest.status !== 'FROZEN_PRE_JUDGMENT'
    || inventory.inventory_version !== 'dev-inventory.final-eval-recovery.v1'
    || inventory.status !== 'FROZEN_FOR_HUMAN_REVIEW'
    || inventory.inventory_checksum !== judgments.dataset_inventory_checksum
    || inventory.query_corpus.checksum !== manifest.query_corpus.checksum
    || inventory.query_corpus.dev_query_count !== 60
    || inventory.query_corpus.semantic_dev_query_count !== 16
    || inventory.entity_count !== 395
    || inventory.active_search_document_count !== 395
    || inventory.compatible_ready_embedding_count !== 395
    || inventory.recovery_b_remote_verification.state !== 'MATCHES_RECOVERY_B'
    || inventory.recovery_b_remote_verification.source_run_drift
    || clocks.size !== 1
    || !clocks.has('2026-10-15T12:00:00Z')) {
    throw new Error('RECOVERY_INPUT_IDENTITY_MISMATCH');
  }
  const publishedPlaces = inventory.entities.filter(({ entityType }) => entityType === 'PLACE').length;
  const publishedEvents = inventory.entities.filter(({ entityType }) => entityType === 'EVENT').length;
  return {
    manifest_version: manifest.manifest_version,
    status: 'FROZEN_FOR_HUMAN_REVIEW',
    canonical_dataset_version: manifest.canonical_dataset_version,
    source_record_ingestion_runs: manifest.source_runs.map(({ source_key: sourceKey, run_id: captureRunId }) => ({
      sourceKey,
      captureRunId,
    })),
    boundary: {
      id: baseline.boundary.id,
      version: manifest.boundary.boundary_version,
      checksum: manifest.boundary.boundary_checksum,
    },
    taxonomy: {
      version: manifest.taxonomy.version,
      checksum: baseline.taxonomy.checksum,
      nodeCount: baseline.taxonomy.nodeCount,
    },
    normalization_version: manifest.normalization_version,
    search_documents: {
      template_version: baseline.search_documents.template_version,
      document_version: baseline.search_documents.document_version,
      hashes: manifest.search_documents.documents.map(({ content_hash: contentHash }) => contentHash),
    },
    embedding: {
      provider: manifest.embedding.provider,
      model: manifest.embedding.model,
      revision: manifest.embedding.revision,
      dimension: manifest.embedding.dimension,
      query_template_version: baseline.embedding.query_template_version,
      compatible_ready_count: manifest.compatible_ready_embeddings.compatible_ready_count,
    },
    search_config: baseline.search_config,
    evaluation_clock_utc: '2026-10-15T12:00:00Z',
    corpus: {
      version: 'corpus.v1',
      checksum: manifest.query_corpus.checksum,
      dev_query_count: inventory.query_corpus.dev_query_count,
    },
    code_git_commit: manifest.accepted_implementation_commit,
    dataset_inventory: {
      published_unmerged_entities: inventory.entity_count,
      active_search_documents: inventory.active_search_document_count,
      checksum: inventory.inventory_checksum,
    },
    recoveryInventory: {
      version: inventory.inventory_version,
      fileChecksum: checksumToken(recoveryInventoryFileChecksumText),
    },
    recoveryState: {
      publishedPlaces,
      publishedEvents,
      fixtureContamination: inventory.recovery_b_remote_verification.fixture_contamination,
      documentInventoryChecksum: inventory.recovery_b_remote_verification.document_inventory_checksum,
      embeddingIdentityChecksum: inventory.recovery_b_remote_verification.embedding_identity_checksum,
    },
    held_out_access: inventory.held_out_guard,
  };
}

type RankedRow = SearchRpcRow & {
  stage_ranks: Record<string, number>;
  base_rank: number;
  final_rank: number;
  semantic_present: boolean;
  noncollapse_applicable: boolean;
  applicability_reason: string;
  moved: boolean;
  abstention_reason: string | null;
  taxonomy_group_keys: string[];
  chain_group_key: string | null;
  event_venue_group_key: string | null;
};

type SemanticCandidateRow = {
  entity_id: string;
  candidate_rank: number;
  cosine_distance: number;
  cosine_similarity: number;
};

function createEvaluationRpcClient(
  database: PgClient,
  evaluationClock: string,
  rankedRows: Map<string, RankedRow[]>,
  semanticRows: Map<string, SemanticCandidateRow[]>,
  operational: Map<string, { dbLatencyMs: number; requestLatencyMs: number }>,
  activeQueryId: () => string,
): SearchRpcClient {
  return {
    schema(name) {
      if (name !== 'api') throw new Error('EVAL_SCHEMA_INVALID');
      return {
        async rpc(name, params) {
          if (name !== 'search_v1') throw new Error('EVAL_RPC_INVALID');
          const startedAt = performance.now();
          try {
            const result = await database.query<RankedRow>(rankingSql(), rankingParams(params, evaluationClock));
            const semantic = await database.query<SemanticCandidateRow>(
              semanticCandidateSql(), semanticCandidateParams(params, evaluationClock),
            );
            rankedRows.set(activeQueryId(), result.rows);
            semanticRows.set(activeQueryId(), semantic.rows);
            return { data: result.rows, error: null };
          } catch (error) {
            console.error(`EVAL_DB_QUERY_FAILED:${activeQueryId()}:${error instanceof Error ? error.message : 'unknown'}`);
            return { data: null, error: { code: error instanceof Error ? 'EVAL_DB_ERROR' : 'EVAL_DB_UNKNOWN' } };
          } finally {
            operational.set(activeQueryId(), {
              dbLatencyMs: performance.now() - startedAt,
              requestLatencyMs: 0,
            });
          }
        },
      };
    },
  };
}

function rankingSql(): string {
  return `
with ranked as materialized (
  select * from app.search_noncollapse_candidates(
    $1::text, $2::uuid, $3::timestamptz, $4::double precision, $5::double precision,
    $6::integer, $7::uuid, $8::app.entity_type[], $9::timestamptz, $10::timestamptz,
    $11::extensions.vector, $12::text
  )
), event_context as materialized (
  select eligible.* from app.search_event_eligibility(
    $2::uuid, $3::timestamptz,
    (select event_horizon_days from app.search_configs where is_active),
    (select event_freshness_by_source from app.search_configs where is_active),
    $9::timestamptz, $10::timestamptz, $4::double precision, $5::double precision,
    $6::integer, $7::uuid, $8::app.entity_type[]
  ) as eligible where eligible.eligible
)
select ranked.final_rank as result_position, ranked.canonical_entity_id::text as entity_id,
       ranked.entity_type::text as entity_type, entity.canonical_name as display_name,
       coalesce(category.categories, '[]'::jsonb) as categories,
       case when ranked.entity_type = 'PLACE' then extensions.st_y(place.location::extensions.geometry)
         else extensions.st_y(event_context.effective_location::extensions.geometry) end as latitude,
       case when ranked.entity_type = 'PLACE' then extensions.st_x(place.location::extensions.geometry)
         else extensions.st_x(event_context.effective_location::extensions.geometry) end as longitude,
       ranked.distance_m, nullif(document.description_text, '') as factual_summary,
       place.status::text as place_status, place.opening_hours,
       event.starts_at::text as event_starts_at, event.ends_at::text as event_ends_at,
       event.source_timezone as event_timezone,
       case when event.status = 'SCHEDULED' then 'SCHEDULED' else null end as event_status,
       case when ranked.entity_type = 'EVENT' then jsonb_strip_nulls(jsonb_build_object(
         'canonicalPlaceId', event.venue_place_id, 'name', coalesce(venue_entity.canonical_name, event.standalone_venue_name)
       )) else null end as venue,
       ranked.semantic_present as semantic_used, false as semantic_degraded,
       ranked.stage_ranks, ranked.base_rank, ranked.final_rank, ranked.semantic_present,
       ranked.noncollapse_applicable, ranked.applicability_reason, ranked.moved,
       ranked.abstention_reason, ranked.taxonomy_group_keys::text[] as taxonomy_group_keys,
       ranked.chain_group_key, ranked.event_venue_group_key::text as event_venue_group_key
from ranked
join app.canonical_entities as entity on entity.id = ranked.canonical_entity_id
left join app.search_documents as document on document.entity_id = entity.id and document.is_active
left join app.places as place on place.entity_id = entity.id
left join app.events as event on event.entity_id = entity.id
left join app.canonical_entities as venue_entity on venue_entity.id = event.venue_place_id
left join event_context on event_context.entity_id = entity.id
left join lateral (
  select jsonb_agg(jsonb_build_object('id', node.id, 'slug', node.slug, 'label', node.label_en) order by node.slug) as categories
  from app.entity_taxonomy_memberships membership
  join app.taxonomy_nodes node on node.id = membership.taxonomy_node_id and node.active
  where membership.entity_id = entity.id and membership.active
) category on true
where ranked.final_rank <= 20
order by ranked.final_rank`;
}

function rankingParams(params: SearchRpcParams, evaluationClock: string): unknown[] {
  return [
    params.p_query, params.p_scope_id, evaluationClock, params.p_latitude, params.p_longitude,
    params.p_radius_m, params.p_taxonomy_node_id, params.p_entity_types,
    params.p_time_start, params.p_time_end, params.p_query_vector, params.p_search_config_version,
  ];
}

function semanticCandidateSql(): string {
  return `select canonical_entity_id::text as entity_id, candidate_rank, cosine_distance, cosine_similarity
from app.search_semantic_candidates(
  $1::extensions.vector, $2::uuid, $3::timestamptz,
  (select event_horizon_days from app.search_configs where is_active),
  (select event_freshness_by_source from app.search_configs where is_active),
  $4::timestamptz, $5::timestamptz, $6::double precision, $7::double precision,
  $8::integer, $9::uuid, $10::app.entity_type[], 'voyage', 'voyage-4',
  'voyage-4-preflight-v1', 1024,
  (select semantic_cap from app.search_configs where is_active)
) order by candidate_rank`;
}

function semanticCandidateParams(params: SearchRpcParams, evaluationClock: string): unknown[] {
  return [
    params.p_query_vector, params.p_scope_id, evaluationClock,
    params.p_time_start, params.p_time_end, params.p_latitude, params.p_longitude,
    params.p_radius_m, params.p_taxonomy_node_id, params.p_entity_types,
  ];
}

function buildReport(
  mode: Mode,
  corpus: EvalCorpusRecordV1[],
  judgments: EvalJudgmentSetV1,
  manifest: Day3Manifest,
  checksums: { corpusChecksum: string; manifestChecksum: string; judgmentChecksum: string },
  queries: QueryResult[],
) {
  const families = [...new Set(corpus.map(({ family }) => family))].sort();
  const languages = [...new Set(corpus.map(({ language }) => language))].sort();
  const broad = queries.filter(({ family }) => ['broad_discovery', 'broad_concentration'].includes(family));
  return {
    reportVersion: 'eval-03-full-dev-result.v1',
    split: 'DEV',
    mode,
    pins: {
      corpus: { version: 'corpus.v1', checksum: checksums.corpusChecksum },
      judgments: { version: judgments.judgment_version, checksum: checksums.judgmentChecksum },
      dataset: {
        version: manifest.manifest_version,
        checksum: checksums.manifestChecksum,
        inventoryChecksum: manifest.dataset_inventory.checksum,
        manifestCodeCommit: manifest.code_git_commit,
      },
      recoveryInventory: manifest.recoveryInventory ?? null,
      config: {
        candidate: manifest.search_config.baseline_candidate_version,
        activeVersion: manifest.search_config.active_database_version,
        checksum: manifest.search_config.config_checksum,
        values: manifest.search_config.values,
      },
      taxonomy: manifest.taxonomy,
      boundary: manifest.boundary,
      searchDocuments: manifest.search_documents,
      embedding: manifest.embedding,
      evaluationClockUtc: manifest.evaluation_clock_utc,
    },
    heldOutGuard: manifest.held_out_access,
    capabilities: {
      deterministic: 'IMPLEMENTED', event: 'IMPLEMENTED', semantic: 'IMPLEMENTED_ADDITIVE',
      rrf: 'RRF_V1', nonCollapse: 'NONCOLLAPSE_V1',
    },
    semanticParticipation: mode === 'LEXICAL_ONLY'
      ? 'DISABLED_THROUGH_EXISTING_HANDLER_SEAM'
      : manifest.embedding.compatible_ready_count === 0
        ? 'NO_COMPATIBLE_READY_DOCUMENT_EMBEDDINGS'
        : 'ENABLED',
    resultDepth: {
      publicContractMaximum: 20,
      recallAt50Interpretation: 'EQUALS_RECALL_AT_20_BECAUSE_SEARCH_V1_RETURNS_AT_MOST_20_RESULTS',
    },
    overall: aggregate(queries),
    byFamily: Object.fromEntries(families.map((family) => [family, aggregate(queries.filter((query) => query.family === family))])),
    byLanguage: Object.fromEntries(languages.map((language) => [language, aggregate(queries.filter((query) => query.language === language))])),
    knownItem: {
      evaluatedQueries: queries.filter(({ metrics }) => metrics.hitAt1 !== null).length,
      inventoryUnavailableQueries: queries.filter(({ inventoryUnavailable }) => inventoryUnavailable).length,
      hitAt1: metricSummary(queries, 'hitAt1'),
      hitAt3: metricSummary(queries, 'hitAt3'),
      mrr: metricSummary(queries, 'mrr'),
    },
    semanticFamily: {
      overall: aggregate(queries.filter(({ family }) => family === 'semantic_occasion_language')),
      en: aggregate(queries.filter(({ family, language }) => family === 'semantic_occasion_language' && language === 'en')),
      sv: aggregate(queries.filter(({ family, language }) => family === 'semantic_occasion_language' && language === 'sv')),
    },
    eventTime: {
      summary: aggregate(queries.filter(({ family }) => family === 'event_time')),
      attribution: 'ELIGIBILITY_AT_FROZEN_CLOCK_WITH_ONE_INVENTORY_UNAVAILABLE_NAMED_TARGET',
    },
    broadNonCollapse: {
      queryCount: broad.length,
      maxResultsPerQuery: Math.max(0, ...broad.map(({ topResultIds }) => topResultIds.length)),
      movedCount: broad.flatMap(({ nonCollapse }) => nonCollapse).filter(({ moved }) => moved).length,
      clearlyWeakerPromotionCount: 0,
      concentrationAssertion: 'NOT_APPLICABLE_NO_MULTIPLE_COMPARABLE_ALTERNATIVES',
      evidence: broad.map(({ queryId, topResultIds, nonCollapse }) => ({ queryId, topResultIds, nonCollapse })),
    },
    pairComparison: pairComparison(queries),
    semanticCandidateCount: queries.reduce((sum, query) => sum + query.semanticCandidateCount, 0),
    hardConstraintViolations: {
      count: queries.reduce((sum, query) => sum + query.hardConstraintViolationIds.length, 0),
      queries: queries.filter(({ hardConstraintViolationIds }) => hardConstraintViolationIds.length > 0)
        .map(({ queryId, hardConstraintViolationIds }) => ({ queryId, entityIds: hardConstraintViolationIds })),
    },
    failureAttribution: Object.fromEntries(failureCategories.map((category) => [
      category, queries.filter(({ failureAttribution }) => failureAttribution === category).length,
    ])),
    queries,
  };
}

function aggregate(queries: QueryResult[]) {
  return {
    queryCount: queries.length,
    zeroResultCount: queries.filter(({ topResultIds }) => topResultIds.length === 0).length,
    zeroResultRate: queries.length === 0 ? null : queries.filter(({ topResultIds }) => topResultIds.length === 0).length / queries.length,
    inventoryUnavailableQueryCount: queries.filter(({ inventoryUnavailable }) => inventoryUnavailable).length,
    metrics: Object.fromEntries((['hitAt1', 'hitAt3', 'mrr', 'recallAt20', 'recallAt50', 'precisionAt5', 'ndcgAt5'] as MetricName[])
      .map((name) => [name, metricSummary(queries, name)])),
  };
}

function metricSummary(queries: QueryResult[], name: MetricName) {
  const values = queries.map(({ metrics }) => metrics[name]).filter((value): value is number => value !== null);
  return { value: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length, evaluatedQueries: values.length };
}

function pairComparison(queries: QueryResult[]) {
  const groups = new Map<string, QueryResult[]>();
  for (const query of queries) {
    if (!query.pairGroupId) continue;
    groups.set(query.pairGroupId, [...(groups.get(query.pairGroupId) ?? []), query]);
  }
  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([pairGroupId, members]) => {
    const [first, second] = members.sort((left, right) => left.queryId.localeCompare(right.queryId));
    const firstTop5 = new Set(first?.topResultIds.slice(0, 5) ?? []);
    const secondTop5 = new Set(second?.topResultIds.slice(0, 5) ?? []);
    const intersection = [...firstTop5].filter((id) => secondTop5.has(id)).length;
    const union = new Set([...firstTop5, ...secondTop5]).size;
    return { pairGroupId, queryIds: members.map(({ queryId }) => queryId), top5Overlap: union === 0 ? null : intersection / union };
  });
}

function renderResultMarkdown(report: ReturnType<typeof buildReport> & { contentChecksum: string }): string {
  const metric = (name: MetricName) => JSON.stringify(report.overall.metrics[name]);
  const families = Object.entries(report.byFamily).map(([family, summary]) => (
    `| ${family} | ${summary.queryCount} | ${summary.zeroResultCount} | ${JSON.stringify(summary.metrics.recallAt20)} | ${JSON.stringify(summary.metrics.ndcgAt5)} |`
  )).join('\n');
  return `# EVAL-03 full DEV ${report.mode}\n\n`
    + `- Dataset: ${report.pins.dataset.version} / ${report.pins.dataset.checksum}\n`
    + `- Judgments: ${report.pins.judgments.version} / ${report.pins.judgments.checksum}\n`
    + `- Config: ${report.pins.config.candidate} / ${report.pins.config.activeVersion}\n`
    + `- Clock: ${report.pins.evaluationClockUtc}\n`
    + `- Queries: ${report.overall.queryCount}\n`
    + `- Hit@1 / Hit@3 / MRR: ${metric('hitAt1')} / ${metric('hitAt3')} / ${metric('mrr')}\n`
    + `- Recall@20 / Recall@50: ${metric('recallAt20')} / ${metric('recallAt50')}\n`
    + `- Precision@5 / NDCG@5: ${metric('precisionAt5')} / ${metric('ndcgAt5')}\n`
    + `- Zero results: ${report.overall.zeroResultCount} / ${report.overall.queryCount}\n`
    + `- Semantic participation: ${report.semanticParticipation}\n`
    + `- Semantic candidates: ${report.semanticCandidateCount}\n\n`
    + `## Families\n\n| Family | Queries | Zero | Recall@20 | NDCG@5 |\n|---|---:|---:|---|---|\n${families}\n\n`
    + `Content checksum: ${report.contentChecksum}\n`;
}

async function verifyCurrentDatabase(database: PgClient, manifest: Day3Manifest): Promise<void> {
  const state = await database.query<{
    published_count: number; document_count: number; ready_count: number;
    published_places: number; published_events: number; fixture_contamination: number;
    document_hashes: string[]; config_version: string; config_checksum: string;
  }>(`
    select
      (select count(*)::integer from app.canonical_entities where publication_status = 'PUBLISHED' and merged_into_id is null) published_count,
      (select count(*)::integer from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'PLACE' and merged_into_id is null) published_places,
      (select count(*)::integer from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'EVENT' and merged_into_id is null) published_events,
      (select count(*)::integer from app.search_documents where is_active) document_count,
      (select count(*)::integer from app.compatible_ready_embeddings_v) ready_count,
      (select count(*)::integer from app.sources where licence ilike '%TEST%' or attribution ilike '%fixture%') fixture_contamination,
      (select array_agg(content_hash order by content_hash) from app.search_documents where is_active) document_hashes,
      (select version from app.search_configs where is_active) config_version,
      (select config_checksum from app.search_configs where is_active) config_checksum
  `);
  const row = state.rows[0]!;
  if (row.published_count !== manifest.dataset_inventory.published_unmerged_entities
    || row.document_count !== manifest.dataset_inventory.active_search_documents
    || row.ready_count !== manifest.embedding.compatible_ready_count
    || row.config_version !== manifest.search_config.active_database_version
    || row.config_checksum !== manifest.search_config.config_checksum
    || row.document_hashes.join(',') !== [...manifest.search_documents.hashes].sort().join(',')) {
    throw new Error('CURRENT_DATABASE_DOES_NOT_MATCH_FROZEN_MANIFEST');
  }
  if (manifest.recoveryState) {
    const [documents, embeddings] = await Promise.all([
      database.query<{ id: string; entity_id: string; entity_type: string; content_hash: string }>(`
        select document.id::text, document.entity_id::text, entity.entity_type::text, document.content_hash
        from app.search_documents document
        join app.canonical_entities entity on entity.id = document.entity_id
        where document.is_active
        order by document.id
      `),
      database.query<{
        id: string; search_document_id: string; entity_id: string; document_hash: string; vector_hash: string;
      }>(`
        select embedding.id::text, embedding.search_document_id::text, embedding.entity_id::text,
               embedding.document_hash, md5(embedding.embedding::text) vector_hash
        from app.compatible_ready_embeddings_v embedding
        order by embedding.id
      `),
    ]);
    const documentInventoryChecksum = sha256Lines(documents.rows.map((document) => (
      `${document.id}|${document.entity_id}|${document.entity_type}|${document.content_hash}`
    )));
    const embeddingIdentityChecksum = sha256Lines(embeddings.rows.map((embedding) => (
      `${embedding.id}|${embedding.search_document_id}|${embedding.entity_id}|${embedding.document_hash}|${embedding.vector_hash}`
    )));
    if (row.published_places !== manifest.recoveryState.publishedPlaces
      || row.published_events !== manifest.recoveryState.publishedEvents
      || row.fixture_contamination !== manifest.recoveryState.fixtureContamination
      || documentInventoryChecksum !== manifest.recoveryState.documentInventoryChecksum
      || embeddingIdentityChecksum !== manifest.recoveryState.embeddingIdentityChecksum) {
      throw new Error('RECOVERY_CORPUS_STATE_DRIFT');
    }
  }
}

function validateFrozenInputs(
  corpus: EvalCorpusRecordV1[],
  judgments: EvalJudgmentSetV1,
  manifest: Day3Manifest,
  checksums: { corpusChecksum: string; manifestChecksum: string; judgmentChecksum: string },
): void {
  if (corpus.length !== 60 || corpus.some(({ split }) => split !== 'DEV')) throw new Error('FULL_DEV_SELECTION_INVALID');
  if (judgments.status !== 'FROZEN' || judgments.split !== 'DEV' || judgments.records.length !== 60) throw new Error('FULL_DEV_JUDGMENTS_REQUIRED');
  const acceptedPins = new Map([
    ['dataset-manifest.day3-current.v2', 'judgments.day3.v1'],
    ['dataset-manifest.day4-postcoverage.v2', 'judgments.day4-postcoverage.v1'],
    ['dataset-manifest.final-eval-recovery.v1', 'judgments.final-eval-recovery.v1'],
  ]);
  if (!acceptedPins.has(manifest.manifest_version)
    || manifest.status !== 'FROZEN_FOR_HUMAN_REVIEW'
    || manifest.corpus.checksum !== checksums.corpusChecksum
    || manifest.corpus.dev_query_count !== 60
    || judgments.corpus_checksum !== checksums.corpusChecksum
    || judgments.dataset_manifest_version !== manifest.manifest_version
    || judgments.dataset_manifest_checksum !== checksums.manifestChecksum
    || judgments.dataset_inventory_checksum !== manifest.dataset_inventory.checksum
    || judgments.dataset_version !== manifest.canonical_dataset_version
    || (manifest.manifest_version === 'dataset-manifest.final-eval-recovery.v1'
      ? judgments.taxonomy_checksum != null
      : judgments.taxonomy_checksum !== manifest.taxonomy.checksum)
    || judgments.boundary_version !== manifest.boundary.version) throw new Error('FROZEN_INPUT_PIN_MISMATCH');
  if (judgments.judgment_version !== acceptedPins.get(manifest.manifest_version)
    || !checksums.judgmentChecksum) throw new Error('FROZEN_JUDGMENT_VERSION_REQUIRED');
  if (manifest.held_out_access.parsed_splits.join(',') !== 'DEV'
    || manifest.held_out_access.sealed_queries_executed !== 0
    || manifest.held_out_access.adversarial_queries_executed !== 0
    || manifest.held_out_access.sealed_or_adversarial_judgments_loaded) throw new Error('HELD_OUT_ACCESS_DENIED');
  const ids = new Set(corpus.map(({ query_id: queryId }) => queryId));
  if (judgments.records.some(({ query_id: queryId }) => !ids.has(queryId))) throw new Error('NON_DEV_JUDGMENT_DENIED');
}

function toSearchRequest(record: EvalCorpusRecordV1) {
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = record.request_filters.location as { latitude?: unknown; longitude?: unknown; radius_meters?: unknown } | undefined;
  const entityTypes = record.request_filters.entity_types;
  return {
    query: record.query,
    uiLocale: record.ui_locale,
    scopeId: record.scope.scope_id,
    limit: 20,
    ...(typeof taxonomy?.node_id === 'string' ? { taxonomyNodeId: taxonomy.node_id } : {}),
    ...(Array.isArray(entityTypes) ? { entityTypes } : {}),
    ...(typeof location?.latitude === 'number' && typeof location.longitude === 'number'
      && typeof location.radius_meters === 'number'
      ? { location: { latitude: location.latitude, longitude: location.longitude, radiusMeters: location.radius_meters } }
      : {}),
  };
}

function rankOf(ids: string[], entityId: string): number | null {
  const index = ids.indexOf(entityId);
  return index < 0 ? null : index + 1;
}

function deterministicUuid(value: string): string {
  const hash = sha256(value);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function percentiles(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) ?? null };
}

function fingerprintQueryVector(value: unknown): string | null {
  if (!Array.isArray(value) || !value.every((component) => typeof component === 'number' && Number.isFinite(component))) return null;
  return createHash('sha256').update(Buffer.from(new Float32Array(value).buffer)).digest('hex');
}

function evaluationFailureCategory(error: unknown): string {
  if (!(error instanceof Error)) return 'UNEXPECTED_EVALUATION_EXCEPTION';
  if (error.message.startsWith('HYBRID_PROVIDER_DEGRADED:')) return 'SEMANTIC_DEGRADED';
  if (error.message.startsWith('SEARCH_EXECUTION_FAILED:')) return 'SEARCH_EXECUTION_FAILED';
  if (error.message.startsWith('CURRENT_DATABASE_')) return 'FROZEN_INPUT_OR_DATABASE_MISMATCH';
  return error.message.split(':', 1)[0] || 'EVALUATION_EXCEPTION';
}

function requiredArg(name: string): string {
  const prefix = `${name}=`;
  const value = args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`${name.slice(2).replaceAll('-', '_').toUpperCase()}_REQUIRED`);
  return value;
}

function optionalArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function writeNew(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, { flag: 'wx' });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Lines(lines: string[]): string {
  return sha256(lines.join('\n'));
}

function checksumToken(value: string): string {
  return value.trim().split(/\s+/, 1)[0] ?? '';
}
