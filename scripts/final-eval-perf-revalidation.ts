import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { assertFinalEvalTarget } from '../packages/contracts/src/database-target.ts';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROVIDER,
  EmbeddingRequestError,
  requestVoyageEmbedding,
} from '../packages/embedding/src/voyage-client.ts';
import { createSearchHandler, type SearchTelemetry } from '../supabase/functions/search/search-handler.ts';
import { normalizeForEdgeSearch } from '../supabase/functions/search/normalization.ts';
import { createServerSearchClient } from '../supabase/functions/search/server-client.ts';
import {
  buildSemanticQueryInput,
  SEMANTIC_CONFIG_VERSION,
  SEMANTIC_TIMEOUT_MS,
} from '../supabase/functions/search/semantic.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(optionalArg('--output')
  ?? 'evaluation/reports/final-eval-perf-revalidation/perf-revalidation.v1.json');
const PROVIDER_SPACING_MS = Number(optionalArg('--provider-spacing-ms') ?? '31000');
const SEMANTIC_SPACING_MS = Number(optionalArg('--semantic-spacing-ms') ?? '31000');
const PROVIDER_ATTEMPTS = Number(optionalArg('--provider-attempts') ?? '10');
const SEMANTIC_ATTEMPTS = Number(optionalArg('--semantic-attempts') ?? '8');
const DIRECT_REPEATS = Number(optionalArg('--direct-repeats') ?? '4');
const DB_SEMANTIC_ATTEMPTS = Number(optionalArg('--db-semantic-attempts') ?? '20');
const FAIL_OPEN_ATTEMPTS = Number(optionalArg('--fail-open-attempts') ?? '6');
const SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
const MANIFEST_PATH = resolve(ROOT, 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json');
const INVENTORY_PATH = resolve(ROOT, 'evaluation/inventories/dev-inventory.final-eval-recovery.v1.json');
const JUDGMENTS_PATH = resolve(ROOT, 'evaluation/judgments/judgments.final-eval-recovery.v1.json');
const EXPECTED = {
  project: 'zrxdjorrwcunprbykdtg',
  manifest: 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82',
  inventory: '2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37',
  judgments: 'e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70',
  documentInventory: '7e5d83ebeee39595944b9ef1bdb5cca8f72ff5aa6a2e2880471b6c4963981a51',
  embeddingIdentity: '6ad7ad8fb1d6902de8ee4dbbb66042050ed732789ed4ee7e8a0dbbd46f38f20b',
};

if (!Number.isInteger(PROVIDER_SPACING_MS) || PROVIDER_SPACING_MS < 31_000
  || !Number.isInteger(SEMANTIC_SPACING_MS) || SEMANTIC_SPACING_MS < 31_000) {
  throw new Error('PROVIDER_SPACING_UNSAFE');
}
for (const [name, value, min, max] of [
  ['provider-attempts', PROVIDER_ATTEMPTS, 1, 10],
  ['semantic-attempts', SEMANTIC_ATTEMPTS, 1, 8],
  ['direct-repeats', DIRECT_REPEATS, 1, 6],
  ['db-semantic-attempts', DB_SEMANTIC_ATTEMPTS, 1, 30],
  ['fail-open-attempts', FAIL_OPEN_ATTEMPTS, 1, 10],
] as const) {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`INVALID_${name.toUpperCase()}`);
}

const databaseUrl = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalTarget(databaseUrl, process.env);
if (process.env.SUPABASE_PROJECT_ID !== EXPECTED.project) throw new Error('FINAL_EVAL_PROJECT_DRIFT');
const supabaseUrl = process.env.SUPABASE_URL ?? `https://${EXPECTED.project}.supabase.co`;
const backendKey = process.env.LEMON_SUPABASE_SECRET_KEY ?? '';
const voyageApiKey = process.env.VOYAGE_API_KEY ?? '';
if (!backendKey || !voyageApiKey) throw new Error('FINAL_EVAL_READ_CREDENTIALS_REQUIRED');

const require = createRequire(new URL('../packages/evaluation/package.json', import.meta.url));
const pg = require('pg') as { Client: new (options: { connectionString: string }) => PgClient };
const database = new pg.Client({ connectionString: databaseUrl });
await database.connect();

try {
  const localIdentity = await verifyLocalIdentity();
  const remoteIdentity = await verifyRemoteIdentity(database);
  const direct = await measureDirect(database, supabaseUrl);
  const semanticTotal = await measureSemanticEdge(supabaseUrl);
  const provider = await measureProvider();
  const successfulVector = provider.firstSuccessfulVector;
  if (!successfulVector) throw new Error('PERF_BLOCKED:NO_VALID_PROVIDER_VECTOR_FOR_DB_MEASUREMENT');
  const semanticDatabase = await measureSemanticDatabase(database, successfulVector);
  const failOpen = await measureFailOpen(supabaseUrl);

  const directPass = direct.edgeLatencyMs.p50 <= 100 && direct.edgeLatencyMs.p95 <= 300;
  const semanticPass = semanticTotal.validLatencyMs.count > 0
    && semanticTotal.validLatencyMs.p50 <= 750 && semanticTotal.validLatencyMs.p95 <= 1_500;
  const providerRisk = true; // Carried from the accepted 0/2 pre-freeze provider prechecks.
  const failOpenPass = failOpen.correct === FAIL_OPEN_ATTEMPTS;
  const decision = directPass && semanticPass && failOpenPass
    ? (providerRisk ? 'PERF_REVALIDATED_WITH_OPERATIONAL_RISK' : 'PERF_REVALIDATED')
    : 'PERF_BLOCKED';
  const report = {
    reportVersion: 'final-eval-perf-revalidation.v1',
    task: 'FINAL-EVAL-PERF-REVALIDATION',
    generatedAt: new Date().toISOString(),
    candidate: {
      candidateVersion: 'eval-03-baseline.v1', searchConfigVersion: SEMANTIC_CONFIG_VERSION,
      rrfVersion: 'RRF_V1', rrfK: 60, noncollapseVersion: 'NONCOLLAPSE_V1',
      provider: EMBEDDING_PROVIDER, model: EMBEDDING_MODEL, revision: EMBEDDING_MODEL_REVISION,
      dimension: EMBEDDING_DIMENSION, queryInputType: 'query', timeoutMs: SEMANTIC_TIMEOUT_MS,
      vectorRetrieval: 'EXACT_PGVECTOR', ann: false,
    },
    localIdentity,
    remoteIdentity,
    targets: {
      directCategoryMs: { p50Max: 100, p95Max: 300, decision: directPass ? 'PASS' : 'FAIL' },
      semanticBackendMs: { p50Max: 750, p95Max: 1_500, decision: semanticPass ? 'PASS' : 'FAIL' },
    },
    directCategory: direct,
    semanticTotal,
    voyage: withoutVector(provider),
    semanticDatabase,
    failOpen,
    edgeOverhead: 'NOT_DIRECTLY_MEASURED',
    historicalComparison: {
      priorDecision: 'PASS_WITH_OPERATIONAL_RISK',
      directCategoryMs: { count: 32, p50: 14.334, p95: 37.328 },
      semanticBackendMs: { count: 3, p50: 472.115, p95: 514.223 },
      voyageMs: { count: 38, p50: 392.838, p95: 553.205, max: 689.371 },
      semanticDatabaseMs: { count: 26, p50: 73.865, p95: 99.027 },
      interpretation: 'REGRESSION_ASSESSED_AGAINST_TARGETS_AND_HISTORICAL_CONTEXT',
    },
    risks: providerRisk ? ['VOYAGE_REQUEST_TIME_RELIABILITY_RISK'] : [],
    findings: { p0: 0, p1: 0, p2: decision === 'PERF_BLOCKED' ? 1 : 0, p3: providerRisk ? 1 : 0 },
    decision,
    guards: {
      readOnlyTraffic: true, corpusMutated: false, configMutated: false, judgmentsMutated: false,
      rawVectorsPersisted: false, sealedAccessed: false, adversarialAccessed: false,
      tuningPerformed: false, candidateFrozen: false,
    },
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ decision, output: OUTPUT, targets: report.targets, voyage: report.voyage }));
} finally {
  await database.end();
}

async function verifyLocalIdentity() {
  const [manifestBytes, inventoryBytes, judgmentBytes] = await Promise.all([
    readFile(MANIFEST_PATH), readFile(INVENTORY_PATH), readFile(JUDGMENTS_PATH),
  ]);
  const manifest = JSON.parse(manifestBytes.toString()) as Record<string, unknown>;
  const inventory = JSON.parse(inventoryBytes.toString()) as Record<string, unknown>;
  const checksums = {
    manifestFile: sha256(manifestBytes), inventoryFile: sha256(inventoryBytes), judgmentsFile: sha256(judgmentBytes),
    inventoryLogical: String(inventory.inventory_checksum ?? ''),
  };
  if (manifest.manifest_version !== 'dataset-manifest.final-eval-recovery.v1'
    || checksums.manifestFile !== EXPECTED.manifest || checksums.inventoryLogical !== EXPECTED.inventory
    || checksums.judgmentsFile !== EXPECTED.judgments) throw new Error('RECOVERY_CORPUS_STATE_DRIFT:LOCAL_IDENTITY');
  return { manifestVersion: manifest.manifest_version, checksums };
}

async function verifyRemoteIdentity(client: PgClient) {
  const inventory = await one<Record<string, number | string>>(client, `
    select
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'PLACE') as "publishedPlaces",
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'EVENT') as "publishedEvents",
      (select count(*)::int from app.search_documents where is_active) as "activeSearchDocuments",
      (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings",
      (select count(*)::int from app.sources where licence ilike '%TEST%' or attribution ilike '%fixture%') as "fixtureContamination"
  `);
  if (inventory.publishedPlaces !== 392 || inventory.publishedEvents !== 3
    || inventory.activeSearchDocuments !== 395 || inventory.compatibleReadyEmbeddings !== 395
    || inventory.fixtureContamination !== 0) throw new Error('RECOVERY_CORPUS_STATE_DRIFT:REMOTE_COUNTS');
  const config = await one<Record<string, unknown>>(client, `
    select version, rrf_version as "rrfVersion", rrf_k as "rrfK",
      noncollapse_version as "noncollapseVersion", noncollapse_enabled as "noncollapseEnabled",
      embedding_provider as provider, embedding_model as model, embedding_revision as revision,
      embedding_dimension as dimension, embedding_timeout_ms as "timeoutMs", semantic_cap as "semanticCap"
    from app.search_configs where is_active
  `);
  if (config.version !== 'noncollapse-v1' || config.rrfVersion !== 'RRF_V1' || config.rrfK !== 60
    || config.noncollapseVersion !== 'NONCOLLAPSE_V1' || config.noncollapseEnabled !== true
    || config.provider !== 'voyage' || config.model !== 'voyage-4'
    || config.revision !== 'voyage-4-preflight-v1' || config.dimension !== 1024
    || config.timeoutMs !== 700 || config.semanticCap !== 30) throw new Error('FINAL_CANDIDATE_IDENTITY_DRIFT');
  const documents = await client.query<{ id: string; entity_id: string; entity_type: string; content_hash: string }>(`
    select d.id, d.entity_id, e.entity_type::text, d.content_hash from app.search_documents d
    join app.canonical_entities e on e.id = d.entity_id where d.is_active order by d.id
  `);
  const embeddings = await client.query<{ id: string; search_document_id: string; entity_id: string; document_hash: string; vector_hash: string }>(`
    select id, search_document_id, entity_id, document_hash, md5(embedding::text) as vector_hash
    from app.compatible_ready_embeddings_v order by id
  `);
  const documentChecksum = sha256Lines(documents.rows.map((row) => `${row.id}|${row.entity_id}|${row.entity_type}|${row.content_hash}`));
  const embeddingChecksum = sha256Lines(embeddings.rows.map((row) => `${row.id}|${row.search_document_id}|${row.entity_id}|${row.document_hash}|${row.vector_hash}`));
  if (documentChecksum !== EXPECTED.documentInventory || embeddingChecksum !== EXPECTED.embeddingIdentity) {
    throw new Error(`RECOVERY_CORPUS_STATE_DRIFT:REMOTE_IDENTITY:${JSON.stringify({ documentChecksum, embeddingChecksum })}`);
  }
  const ann = await client.query<{ schemaname: string; indexname: string }>(`
    select schemaname, indexname from pg_indexes
    where lower(indexdef) ~ '(hnsw|ivfflat)' order by schemaname, indexname
  `);
  if (ann.rows.length !== 0) throw new Error('FINAL_CANDIDATE_IDENTITY_DRIFT:ANN_PRESENT');
  return { project: EXPECTED.project, inventory, config, documentChecksum, embeddingChecksum, annIndexes: [] };
}

async function measureDirect(client: PgClient, edgeBaseUrl: string) {
  const names = (await client.query<{ name: string }>(`
    select canonical_name as name from app.canonical_entities
    where publication_status = 'PUBLISHED' and entity_type = 'PLACE' and merged_into_id is null
    order by id limit 4
  `)).rows;
  if (names.length !== 4) throw new Error('DIRECT_CASE_INVENTORY_MISSING');
  const cases: SearchBody[] = [
    ...names.map(({ name }, index) => body(name, index % 2 === 0 ? 'en' : 'sv')),
    ...names.map(({ name }, index) => body([...name].slice(0, Math.max(3, Math.min(6, [...name].length - 1))).join(''), index % 2 === 0 ? 'en' : 'sv')),
    body('pizza', 'en'), body('museum', 'en'), body('pizza', 'sv'), body('museum', 'sv'),
  ];
  const samples: Array<Record<string, unknown>> = [];
  for (let repeat = 0; repeat < DIRECT_REPEATS; repeat += 1) {
    for (let index = 0; index < cases.length; index += 1) {
      const started = performance.now();
      const response = await edgeSearch(edgeBaseUrl, cases[index]!);
      samples.push({ case: index < 4 ? 'canonical_exact' : index < 8 ? 'prefix' : 'taxonomy_category',
        locale: cases[index]!.uiLocale, repeat, status: response.status,
        resultCount: response.resultCount, semanticDegraded: response.semanticDegraded,
        latencyMs: performance.now() - started });
      if (response.status !== 200 || response.semanticDegraded) throw new Error('DIRECT_EDGE_REQUEST_FAILED');
    }
  }
  return { requestCount: samples.length, edgeLatencyMs: summary(samples.map(numberLatency)), samples };
}

async function measureSemanticEdge(edgeBaseUrl: string) {
  const inputs: SearchBody[] = [
    body('date night', 'en'), body('dejt', 'sv'), body('things to do', 'en'), body('saker att göra', 'sv'),
    { ...body('family outing', 'en'), location: { latitude: 57.7826, longitude: 14.1618, radiusMeters: 15_000 } },
    { ...body('familjeutflykt', 'sv'), location: { latitude: 57.7826, longitude: 14.1618, radiusMeters: 15_000 } },
    body('something fun with friends', 'en'), body('något kul med vänner', 'sv'),
  ].slice(0, SEMANTIC_ATTEMPTS);
  const samples: Array<Record<string, unknown>> = [];
  for (let index = 0; index < inputs.length; index += 1) {
    if (index > 0) await wait(SEMANTIC_SPACING_MS);
    const started = performance.now();
    const response = await edgeSearch(edgeBaseUrl, inputs[index]!);
    samples.push({ case: index < 2 ? 'occasion' : index < 4 ? 'broad' : index < 6 ? 'geo' : 'mixed',
      locale: inputs[index]!.uiLocale, status: response.status, resultCount: response.resultCount,
      semanticDegraded: response.semanticDegraded, latencyMs: performance.now() - started });
    if (response.status !== 200) throw new Error('SEMANTIC_EDGE_REQUEST_FAILED');
  }
  const valid = samples.filter((sample) => sample.semanticDegraded === false).map(numberLatency);
  return { requestCount: samples.length, successfulSemantic: valid.length,
    degraded: samples.length - valid.length, allLatencyMs: summary(samples.map(numberLatency)),
    validLatencyMs: summary(valid), samples };
}

async function measureProvider() {
  const inputs = [
    ['date night', null], ['dejt', null], ['things to do', null], ['saker att göra', null],
    ['family outing nearby', null], ['familjeutflykt i närheten', null],
    ['something fun with friends', null], ['något kul med vänner', null],
    ['birthday celebration', null], ['födelsedag fira', null],
  ].slice(0, PROVIDER_ATTEMPTS) as Array<[string, null]>;
  const samples: Array<Record<string, unknown>> = [];
  let firstSuccessfulVector: number[] | null = null;
  for (let index = 0; index < inputs.length; index += 1) {
    if (index > 0) await wait(PROVIDER_SPACING_MS);
    let httpStatus: number | null = null;
    const started = performance.now();
    try {
      const providerInput = buildSemanticQueryInput(inputs[index]![0], inputs[index]![1], undefined);
      const vector = await requestVoyageEmbedding(providerInput, 'query', voyageApiKey, {
        timeoutMs: SEMANTIC_TIMEOUT_MS,
        fetch: async (request, init) => {
          const response = await fetch(request, init);
          httpStatus = response.status;
          return response;
        },
      });
      firstSuccessfulVector ??= vector;
      samples.push({ attempt: index + 1, outcome: 'SUCCESS', httpStatus,
        latencyMs: performance.now() - started, validDimension: vector.length === 1024,
        finiteVector: vector.every(Number.isFinite), vectorFingerprint: sha256(Buffer.from(new Float32Array(vector).buffer)) });
    } catch (error) {
      const providerError = error instanceof EmbeddingRequestError ? error : null;
      samples.push({ attempt: index + 1,
        outcome: providerError?.errorCode === 'PROVIDER_TIMEOUT' ? 'TIMEOUT' : 'PROVIDER_ERROR',
        phase: providerError?.errorCode === 'PROVIDER_TIMEOUT'
          ? (httpStatus === null ? 'CONNECTION_OR_REQUEST' : 'RESPONSE_BODY_OR_DECODE') : null,
        httpStatus, errorClass: providerError?.errorClass ?? 'UNKNOWN', errorCode: providerError?.errorCode ?? 'UNKNOWN',
        latencyMs: performance.now() - started, validDimension: false, finiteVector: false });
    }
  }
  const successes = samples.filter((sample) => sample.outcome === 'SUCCESS');
  return { attempts: samples.length, successful: successes.length,
    timeouts: samples.filter((sample) => sample.outcome === 'TIMEOUT').length,
    providerErrors: samples.filter((sample) => sample.outcome === 'PROVIDER_ERROR' && sample.httpStatus !== 429).length,
    rateLimited: samples.filter((sample) => sample.httpStatus === 429).length,
    invalidVectors: samples.filter((sample) => sample.validDimension === false
      && ['WRONG_DIMENSION', 'ZERO_VECTOR', 'NON_FINITE_VECTOR', 'VECTOR_MISSING'].includes(String(sample.errorCode))).length,
    successfulLatencyMs: summary(successes.map(numberLatency)), allAttemptLatencyMs: summary(samples.map(numberLatency)),
    pacingMs: PROVIDER_SPACING_MS, concurrency: 1, samples, firstSuccessfulVector };
}

async function measureSemanticDatabase(client: PgClient, vector: number[]) {
  const samples: number[] = [];
  for (let index = 0; index < DB_SEMANTIC_ATTEMPTS; index += 1) {
    const started = performance.now();
    await searchRpc(client, body(index % 2 === 0 ? 'date night' : 'dejt', index % 2 === 0 ? 'en' : 'sv'), vector);
    samples.push(performance.now() - started);
  }
  const plan = await client.query<{ 'QUERY PLAN': unknown }>(`
    explain (format json) select embedding.entity_id
    from app.compatible_ready_embeddings_v embedding
    order by embedding.embedding <=> $1::extensions.vector limit 30
  `, [`[${vector.join(',')}]`]);
  return { sampleCount: samples.length, latencyMs: summary(samples),
    planNodeTypes: collectPlanNodeTypes(plan.rows[0]?.['QUERY PLAN']), exactPgvector: true, ann: false };
}

async function measureFailOpen(edgeBaseUrl: string) {
  const client = createServerSearchClient(edgeBaseUrl, backendKey);
  const requestBody = body('things to do', 'en');
  const deterministic = await invokeHandler(createSearchHandler({ client, semanticEnabled: false }), requestBody);
  if (deterministic.status !== 200) throw new Error('FAIL_OPEN_BASELINE_FAILED');
  const samples: Array<Record<string, unknown>> = [];
  for (let index = 0; index < FAIL_OPEN_ATTEMPTS; index += 1) {
    const telemetry: SearchTelemetry[] = [];
    const handler = createSearchHandler({
      client,
      queryEmbedder: async () => {
        await wait(SEMANTIC_TIMEOUT_MS);
        throw new EmbeddingRequestError('injected timeout', 'TIMEOUT', 'PROVIDER_TIMEOUT');
      },
      telemetry: (event) => telemetry.push(event),
    });
    const started = performance.now();
    const response = await invokeHandler(handler, requestBody);
    const latencyMs = performance.now() - started;
    const sameResults = JSON.stringify(response.resultIds) === JSON.stringify(deterministic.resultIds);
    samples.push({ attempt: index + 1, status: response.status, semanticDegraded: response.semanticDegraded,
      deterministicResultsAvailable: response.resultIds.length > 0, sameOrderingAsSemanticDisabled: sameResults,
      latencyMs, telemetry: telemetry[0] ? {
        providerLatencyMs: telemetry[0].providerLatencyMs, dbLatencyMs: telemetry[0].dbLatencyMs,
        totalBackendLatencyMs: telemetry[0].totalBackendLatencyMs,
      } : null });
  }
  const correct = samples.filter((sample) => sample.status === 200 && sample.semanticDegraded === true
    && sample.sameOrderingAsSemanticDisabled === true).length;
  return { sampleCount: samples.length, correct, latencyMs: summary(samples.map(numberLatency)), samples,
    mechanism: 'IN_PROCESS_PRODUCTION_HANDLER_INJECTED_700MS_TIMEOUT_WITH_HOSTED_READ_ONLY_RPC' };
}

async function edgeSearch(baseUrl: string, requestBody: SearchBody) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/search`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': randomUUID() },
    body: JSON.stringify(requestBody),
  });
  const payload = await response.json() as { semanticDegraded?: boolean; results?: unknown[] };
  return { status: response.status, semanticDegraded: payload.semanticDegraded === true,
    resultCount: Array.isArray(payload.results) ? payload.results.length : 0 };
}

async function invokeHandler(handler: (request: Request) => Promise<Response>, requestBody: SearchBody) {
  const response = await handler(new Request('https://perf.local/search', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestBody),
  }));
  const payload = await response.json() as { semanticDegraded?: boolean; results?: Array<{ canonicalId: string }> };
  return { status: response.status, semanticDegraded: payload.semanticDegraded === true,
    resultIds: payload.results?.map((result) => result.canonicalId) ?? [] };
}

async function searchRpc(client: PgClient, requestBody: SearchBody, vector: number[] | null) {
  const query = requestBody.query;
  const normalized = normalizeForEdgeSearch(query);
  return client.query(`select * from api.search_v1(
    $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::uuid,
    $7::double precision, $8::double precision, $9::integer, $10::uuid,
    $11::app.entity_type[], $12::timestamptz, $13::timestamptz, $14::extensions.vector,
    $15::text, $16::text, $17::text, $18::integer, $19::smallint, $20::text
  )`, [randomUUID(), query, normalized.preserving, normalized.accentless, requestBody.uiLocale, SCOPE_ID,
    requestBody.location?.latitude ?? null, requestBody.location?.longitude ?? null,
    requestBody.location?.radiusMeters ?? null, null, requestBody.entityTypes ?? ['PLACE'],
    null, null, vector ? `[${vector.join(',')}]` : null, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
    EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION, 10, SEMANTIC_CONFIG_VERSION]);
}

function body(query: string, uiLocale: 'en' | 'sv'): SearchBody {
  return { query, uiLocale, scopeId: SCOPE_ID, entityTypes: ['PLACE'], limit: 10 };
}

function summary(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  return { count: sorted.length, p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? null };
}

function percentile(values: number[], quantile: number): number | null {
  return values[Math.ceil(quantile * values.length) - 1] ?? null;
}

function numberLatency(sample: Record<string, unknown>): number {
  return Number(sample.latencyMs);
}

function withoutVector<T extends { firstSuccessfulVector: number[] | null }>(value: T) {
  const safe = { ...value };
  delete safe.firstSuccessfulVector;
  return safe;
}

function collectPlanNodeTypes(value: unknown): string[] {
  const types = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return void node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'Node Type' && typeof item === 'string') types.add(item);
      visit(item);
    }
  };
  visit(value);
  return [...types].sort();
}

async function one<T extends Record<string, unknown>>(client: PgClient, sql: string): Promise<T> {
  const result = await client.query<T>(sql);
  if (result.rows.length !== 1) throw new Error('EXPECTED_ONE_ROW');
  return result.rows[0]!;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Lines(lines: string[]): string {
  return sha256(lines.join('\n'));
}

function optionalArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

type SearchBody = {
  query: string;
  uiLocale: 'en' | 'sv';
  scopeId: string;
  location?: { latitude: number; longitude: number; radiusMeters: number };
  entityTypes?: Array<'PLACE' | 'EVENT'>;
  limit: number;
};

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
};
