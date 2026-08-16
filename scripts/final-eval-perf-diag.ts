import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { assertFinalEvalTarget } from '../packages/contracts/src/database-target.ts';
import { normalizeForEdgeSearch } from '../supabase/functions/search/normalization.ts';
import { recognizeTaxonomyQuery } from '../supabase/functions/search/semantic-taxonomy.ts';
import type { SearchRpcParams } from '../supabase/functions/search/types.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(optionalArg('--output')
  ?? 'evaluation/reports/final-eval-perf-diag-01/measurements.v1.json');
const SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
const PROJECT_ID = 'zrxdjorrwcunprbykdtg';
const LEXICAL_REPEATS = 4;
const SEMANTIC_EDGE_ATTEMPTS = 4;
const SEMANTIC_EDGE_SPACING_MS = 31_000;
const EXPECTED = {
  manifest: 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82',
  inventory: '2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37',
  judgments: 'e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70',
  documents: '7e5d83ebeee39595944b9ef1bdb5cca8f72ff5aa6a2e2880471b6c4963981a51',
  embeddings: '6ad7ad8fb1d6902de8ee4dbbb66042050ed732789ed4ee7e8a0dbbd46f38f20b',
};

const databaseUrl = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalTarget(databaseUrl, process.env);
if (process.env.SUPABASE_PROJECT_ID !== PROJECT_ID) throw new Error('FINAL_EVAL_PROJECT_DRIFT');
const supabaseUrl = process.env.SUPABASE_URL ?? `https://${PROJECT_ID}.supabase.co`;
const backendKey = process.env.LEMON_SUPABASE_SECRET_KEY ?? '';
const managementToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';
if (!backendKey || !managementToken) throw new Error('FINAL_EVAL_READ_CREDENTIALS_REQUIRED');

const require = createRequire(new URL('../packages/evaluation/package.json', import.meta.url));
const pg = require('pg') as { Client: new (options: { connectionString: string }) => PgClient };
if (process.argv.includes('--repair-telemetry')) {
  const existing = JSON.parse(await readFile(OUTPUT, 'utf8')) as Record<string, unknown>;
  const measurements = existing.measurements as Record<string, Record<string, unknown>>;
  const lexicalSamples = measurements.edgeLexical!.samples as EdgeSample[];
  const semanticSamples = measurements.edgeSemantic!.samples as EdgeSample[];
  const requestIds = [...lexicalSamples, ...semanticSamples].map((sample) => sample.requestId);
  const generatedAt = new Date(String(existing.generatedAt));
  const telemetry = await loadEdgeTelemetry(
    requestIds,
    new Date(generatedAt.getTime() - 10 * 60_000),
    new Date(),
  );
  measurements.edgeTelemetry = groupTelemetry(telemetry, lexicalSamples, semanticSamples);
  await writeFile(OUTPUT, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUTPUT, matched: telemetry.matched }));
  process.exit(0);
}
const startedAt = new Date();
const localIdentity = await verifyLocalIdentity();
const connection = await measureConnections();
const database = new pg.Client({ connectionString: databaseUrl });
await database.connect();

try {
  const remoteIdentityBefore = await verifyRemoteIdentity(database);
  const environment = await inspectEnvironment(database);
  const cases = await buildCases(database);
  const fixedVector = await loadFixedVector(database);

  await database.query('select 1');
  const postgresLexical = await measurePostgres(database, cases.lexical, null);
  const postgresBroad = await measurePostgres(database, cases.broad, null);
  const postgresSemantic = await measurePostgres(database, cases.semantic, fixedVector);
  const exactPgvector = await measureExactPgvector(database, fixedVector);
  const directDatabaseLexical = await measureDirectDatabase(database, cases.lexical, null);
  const directDatabaseSemantic = await measureDirectDatabase(database, cases.semantic, fixedVector);
  const postgrestLexical = await measurePostgrest(cases.lexical, null);
  const postgrestSemantic = await measurePostgrest(cases.semantic, fixedVector);
  const edgeLexical = await measureEdge(cases.lexical);
  const edgeSemantic = await measureSemanticEdge(cases.semantic);
  await wait(12_000);
  const edgeTelemetryRaw = await loadEdgeTelemetry(
    [...edgeLexical.samples, ...edgeSemantic.samples].map((sample) => sample.requestId),
    startedAt,
    new Date(),
  );
  const edgeTelemetry = groupTelemetry(edgeTelemetryRaw, edgeLexical.samples, edgeSemantic.samples);
  const remoteIdentityAfter = await verifyRemoteIdentity(database);
  if (JSON.stringify(remoteIdentityBefore) !== JSON.stringify(remoteIdentityAfter)) {
    throw new Error('PERF_DIAG_STATE_DRIFT:DURING_MEASUREMENT');
  }

  const prior = JSON.parse(await readFile(resolve(
    ROOT, 'evaluation/reports/final-eval-perf-revalidation/perf-revalidation.v1.json',
  ), 'utf8')) as Record<string, unknown>;
  const report = {
    reportVersion: 'final-eval-perf-diag-01.measurements.v1',
    task: 'FINAL-EVAL-PERF-DIAG-01',
    generatedAt: new Date().toISOString(),
    candidate: {
      version: 'eval-03-baseline.v1', rrfVersion: 'RRF_V1', rrfK: 60,
      noncollapseVersion: 'NONCOLLAPSE_V1', timeoutMs: 700,
      provider: 'voyage', model: 'voyage-4', revision: 'voyage-4-preflight-v1',
      dimension: 1024, vectorRetrieval: 'EXACT_PGVECTOR', ann: false,
    },
    localIdentity,
    remoteIdentity: remoteIdentityAfter,
    environment,
    connection,
    measurements: {
      postgresLexical,
      postgresBroad,
      postgresSemantic,
      exactPgvector,
      directDatabaseLexical,
      directDatabaseSemantic,
      postgrestLexical,
      postgrestSemantic,
      edgeLexical,
      edgeSemantic,
      edgeTelemetry,
    },
    acceptedRevalidationReference: {
      generatedAt: prior.generatedAt,
      directCategory: prior.directCategory,
      semanticTotal: prior.semanticTotal,
      voyage: prior.voyage,
      semanticDatabase: prior.semanticDatabase,
    },
    guards: {
      readOnlyTraffic: true, corpusMutated: false, configMutated: false,
      vectorsPersisted: false, judgmentsAccessed: false, judgmentsMutated: false,
      sealedAccessed: false, adversarialAccessed: false, providerDirectCalls: 0,
      tuningPerformed: false, candidateFrozen: false,
    },
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ output: OUTPUT, measurements: summarizeForConsole(report.measurements) }));
} finally {
  await database.end();
}

async function verifyLocalIdentity() {
  const manifestPath = resolve(ROOT, 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json');
  const inventoryPath = resolve(ROOT, 'evaluation/inventories/dev-inventory.final-eval-recovery.v1.json');
  const judgmentPath = resolve(ROOT, 'evaluation/judgments/judgments.final-eval-recovery.v1.json');
  const [manifestBytes, inventoryBytes, judgmentBytes] = await Promise.all([
    readFile(manifestPath), readFile(inventoryPath), readFile(judgmentPath),
  ]);
  const manifest = JSON.parse(manifestBytes.toString()) as Record<string, unknown>;
  const inventory = JSON.parse(inventoryBytes.toString()) as Record<string, unknown>;
  const checksums = {
    manifestFile: sha256(manifestBytes),
    inventoryLogical: String(inventory.inventory_checksum ?? ''),
    judgmentsFile: sha256(judgmentBytes),
  };
  if (manifest.manifest_version !== 'dataset-manifest.final-eval-recovery.v1'
    || checksums.manifestFile !== EXPECTED.manifest
    || checksums.inventoryLogical !== EXPECTED.inventory
    || checksums.judgmentsFile !== EXPECTED.judgments) {
    throw new Error('PERF_DIAG_STATE_DRIFT:LOCAL_IDENTITY');
  }
  return { manifestVersion: manifest.manifest_version, checksums };
}

async function verifyRemoteIdentity(client: PgClient) {
  const inventory = await one<Record<string, number>>(client, `
    select
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'PLACE') as "publishedPlaces",
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'EVENT') as "publishedEvents",
      (select count(*)::int from app.search_documents where is_active) as "activeSearchDocuments",
      (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings",
      (select count(*)::int from app.sources where licence ilike '%TEST%' or attribution ilike '%fixture%') as "fixtureContamination"
  `);
  if (inventory.publishedPlaces !== 392 || inventory.publishedEvents !== 3
    || inventory.activeSearchDocuments !== 395 || inventory.compatibleReadyEmbeddings !== 395
    || inventory.fixtureContamination !== 0) throw new Error('PERF_DIAG_STATE_DRIFT:REMOTE_COUNTS');
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
    || config.timeoutMs !== 700 || config.semanticCap !== 30) {
    throw new Error('PERF_DIAG_STATE_DRIFT:REMOTE_CONFIG');
  }
  const documents = await client.query<{
    id: string; entity_id: string; entity_type: string; content_hash: string;
  }>(`select d.id, d.entity_id, e.entity_type::text, d.content_hash
      from app.search_documents d join app.canonical_entities e on e.id = d.entity_id
      where d.is_active order by d.id`);
  const embeddings = await client.query<{
    id: string; search_document_id: string; entity_id: string; document_hash: string; vector_hash: string;
  }>(`select id, search_document_id, entity_id, document_hash, md5(embedding::text) as vector_hash
      from app.compatible_ready_embeddings_v order by id`);
  const documentChecksum = sha256Lines(documents.rows.map((row) => (
    `${row.id}|${row.entity_id}|${row.entity_type}|${row.content_hash}`
  )));
  const embeddingChecksum = sha256Lines(embeddings.rows.map((row) => (
    `${row.id}|${row.search_document_id}|${row.entity_id}|${row.document_hash}|${row.vector_hash}`
  )));
  if (documentChecksum !== EXPECTED.documents || embeddingChecksum !== EXPECTED.embeddings) {
    throw new Error('PERF_DIAG_STATE_DRIFT:REMOTE_IDENTITY');
  }
  const ann = await client.query(`select indexname from pg_indexes where lower(indexdef) ~ '(hnsw|ivfflat)'`);
  if (ann.rows.length !== 0) throw new Error('PERF_DIAG_STATE_DRIFT:ANN_PRESENT');
  return { project: PROJECT_ID, inventory, config, documentChecksum, embeddingChecksum, annIndexes: [] };
}

async function inspectEnvironment(client: PgClient) {
  const database = await one<Record<string, string>>(client, `
    select current_database() as "databaseName", current_user as "databaseUser",
      current_setting('server_version') as "serverVersion"
  `);
  const projectResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}`, {
    headers: { authorization: `Bearer ${managementToken}` },
  });
  const project = await projectResponse.json() as Record<string, unknown>;
  if (!projectResponse.ok) throw new Error(`PROJECT_METADATA_FAILED:${projectResponse.status}`);
  const endpoint = new URL(databaseUrl);
  return {
    client: { runtime: process.version, platform: `${process.platform}-${process.arch}`, timezone: 'Asia/Kolkata' },
    database: {
      projectRegion: project.region ?? null,
      cloudProvider: project.cloud_provider ?? null,
      endpointHost: endpoint.hostname,
      endpointPort: Number(endpoint.port || 5432),
      connectionPath: endpoint.hostname.startsWith('db.') ? 'DIRECT_DATABASE' : 'POOLER_OR_PROXY',
      ...database,
    },
    postgrestHost: new URL(supabaseUrl).hostname,
  };
}

async function measureConnections() {
  const samples: number[] = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const client = new pg.Client({ connectionString: databaseUrl });
    const started = performance.now();
    await client.connect();
    await client.query('select 1');
    samples.push(performance.now() - started);
    await client.end();
  }
  return { newDirectConnectionAndSelectMs: summary(samples), samplesMs: samples };
}

async function buildCases(client: PgClient) {
  const names = (await client.query<{ name: string }>(`
    select canonical_name as name from app.canonical_entities
    where publication_status = 'PUBLISHED' and entity_type = 'PLACE' and merged_into_id is null
    order by id limit 2
  `)).rows;
  if (names.length !== 2) throw new Error('PERF_DIAG_CASE_INVENTORY_MISSING');
  const lexicalBase: SearchCase[] = [
    { family: 'canonical_exact', query: names[0]!.name, locale: 'en' },
    { family: 'canonical_exact', query: names[1]!.name, locale: 'sv' },
    { family: 'prefix', query: prefix(names[0]!.name), locale: 'en' },
    { family: 'prefix', query: prefix(names[1]!.name), locale: 'sv' },
    { family: 'taxonomy_category', query: 'pizza', locale: 'en' },
    { family: 'taxonomy_category', query: 'museum', locale: 'sv' },
  ];
  const broadBase: SearchCase[] = [
    { family: 'broad_discovery', query: 'things to do', locale: 'en' },
    { family: 'broad_discovery', query: 'saker att göra', locale: 'sv' },
  ];
  const semanticBase: SearchCase[] = [
    { family: 'semantic_occasion', query: 'date night', locale: 'en' },
    { family: 'semantic_occasion', query: 'dejt', locale: 'sv' },
    { family: 'semantic_broad', query: 'things to do', locale: 'en' },
    { family: 'semantic_broad', query: 'saker att göra', locale: 'sv' },
  ];
  return {
    lexical: repeatCases(lexicalBase, LEXICAL_REPEATS),
    broad: repeatCases(broadBase, LEXICAL_REPEATS),
    semantic: repeatCases(semanticBase, 2),
  };
}

async function loadFixedVector(client: PgClient): Promise<string> {
  const row = await one<{ vector: string }>(client, `
    select embedding::text as vector from app.compatible_ready_embeddings_v order by id limit 1
  `);
  if (!row.vector.startsWith('[')) throw new Error('PERF_DIAG_FIXED_VECTOR_INVALID');
  return row.vector;
}

async function measurePostgres(client: PgClient, cases: SearchCase[], vector: string | null) {
  const samples: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    const params = rpcParams(item, vector);
    const result = await client.query<{ 'QUERY PLAN': unknown }>(
      `explain (analyze, buffers, format json) ${rpcSql()}`,
      rpcValues(params),
    );
    const explain = parseExplain(result.rows[0]?.['QUERY PLAN']);
    samples.push({ family: item.family, locale: item.locale, repeat: item.repeat, ...explain });
  }
  return {
    sampleCount: samples.length,
    serverExecutionMs: summary(samples.map((sample) => Number(sample.executionMs))),
    serverPlanningMs: summary(samples.map((sample) => Number(sample.planningMs))),
    nodeTypes: [...new Set(samples.flatMap((sample) => sample.nodeTypes as string[]))].sort(),
    representativePlans: firstByFamily(samples),
    samples,
  };
}

async function measureExactPgvector(client: PgClient, vector: string) {
  const samples: Array<Record<string, unknown>> = [];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await client.query<{ 'QUERY PLAN': unknown }>(`
      explain (analyze, buffers, format json)
      select embedding.entity_id
      from app.compatible_ready_embeddings_v embedding
      order by embedding.embedding <=> $1::extensions.vector
      limit 30
    `, [vector]);
    samples.push({ attempt: attempt + 1, ...parseExplain(result.rows[0]?.['QUERY PLAN']) });
  }
  return {
    sampleCount: samples.length,
    serverExecutionMs: summary(samples.map((sample) => Number(sample.executionMs))),
    serverPlanningMs: summary(samples.map((sample) => Number(sample.planningMs))),
    nodeTypes: [...new Set(samples.flatMap((sample) => sample.nodeTypes as string[]))].sort(),
    representativePlan: samples[0],
    exactPgvector: true,
    ann: false,
  };
}

async function measureDirectDatabase(client: PgClient, cases: SearchCase[], vector: string | null) {
  const samples: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    const started = performance.now();
    const result = await client.query(rpcSql(), rpcValues(rpcParams(item, vector)));
    samples.push({ family: item.family, locale: item.locale, repeat: item.repeat,
      resultCount: result.rows.length, latencyMs: performance.now() - started });
  }
  return { sampleCount: samples.length, clientObservedMs: summary(samples.map(numberLatency)), samples };
}

async function measurePostgrest(cases: SearchCase[], vector: string | null) {
  const samples: Array<Record<string, unknown>> = [];
  for (const item of cases) {
    const started = performance.now();
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/search_v1`, {
      method: 'POST',
      headers: {
        accept: 'application/json', 'accept-profile': 'api', apikey: backendKey,
        authorization: `Bearer ${backendKey}`, 'content-profile': 'api', 'content-type': 'application/json',
      },
      body: JSON.stringify(rpcParams(item, vector)),
    });
    const payload = await response.json() as unknown;
    samples.push({ family: item.family, locale: item.locale, repeat: item.repeat,
      status: response.status, resultCount: Array.isArray(payload) ? payload.length : 0,
      latencyMs: performance.now() - started, headers: timingHeaders(response.headers) });
    if (!response.ok || !Array.isArray(payload)) throw new Error(`POSTGREST_MEASUREMENT_FAILED:${response.status}`);
  }
  return { sampleCount: samples.length, clientObservedMs: summary(samples.map(numberLatency)), samples };
}

async function measureEdge(cases: SearchCase[]) {
  const samples: EdgeSample[] = [];
  for (const item of cases) samples.push(await edgeRequest(item));
  return {
    sampleCount: samples.length,
    clientObservedMs: summary(samples.map(numberLatency)),
    firstRequestMs: samples[0]?.latencyMs ?? null,
    subsequentWarmMs: summary(samples.slice(1).map(numberLatency)),
    edgeRegions: [...new Set(samples.map((sample) => sample.headers.edgeRegion).filter(Boolean))].sort(),
    samples,
  };
}

async function measureSemanticEdge(cases: SearchCase[]) {
  const selected = cases.slice(0, SEMANTIC_EDGE_ATTEMPTS);
  const samples: EdgeSample[] = [];
  for (let index = 0; index < selected.length; index += 1) {
    if (index > 0) await wait(SEMANTIC_EDGE_SPACING_MS);
    samples.push(await edgeRequest(selected[index]!));
  }
  return {
    sampleCount: samples.length,
    clientObservedMs: summary(samples.map(numberLatency)),
    edgeRegions: [...new Set(samples.map((sample) => sample.headers.edgeRegion).filter(Boolean))].sort(),
    pacingMs: SEMANTIC_EDGE_SPACING_MS,
    samples,
  };
}

async function edgeRequest(item: SearchCase): Promise<EdgeSample> {
  const requestId = randomUUID();
  const started = performance.now();
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/search`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': requestId },
    body: JSON.stringify({
      query: item.query, uiLocale: item.locale, scopeId: SCOPE_ID,
      entityTypes: ['PLACE'], limit: 10,
    }),
  });
  const payload = await response.json() as {
    requestId?: string; semanticDegraded?: boolean; metadata?: { resultCount?: number };
  };
  const sample = {
    requestId,
    family: item.family,
    locale: item.locale,
    repeat: item.repeat,
    status: response.status,
    resultCount: payload.metadata?.resultCount ?? 0,
    semanticDegraded: payload.semanticDegraded === true,
    latencyMs: performance.now() - started,
    headers: timingHeaders(response.headers),
  };
  if (!response.ok || payload.requestId !== requestId) throw new Error(`EDGE_MEASUREMENT_FAILED:${response.status}`);
  return sample;
}

async function loadEdgeTelemetry(requestIds: string[], start: Date, end: Date) {
  const sql = `select timestamp, event_message,
    log_attributes['region'] as region,
    log_attributes['execution_id'] as execution_id
    from logs where source = 'function_logs'
      and match(event_message, 'search_request')
    order by timestamp desc limit 500`;
  const url = new URL(`https://api.supabase.com/v1/projects/${PROJECT_ID}/analytics/endpoints/logs`);
  url.searchParams.set('sql', sql);
  url.searchParams.set('iso_timestamp_start', new Date(start.getTime() - 60_000).toISOString());
  url.searchParams.set('iso_timestamp_end', new Date(end.getTime() + 60_000).toISOString());
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { authorization: `Bearer ${managementToken}` } });
    const payload = await response.json() as { result?: Array<Record<string, unknown>>; error?: unknown };
    if (!response.ok) throw new Error(`EDGE_LOG_QUERY_FAILED:${response.status}`);
    const rows = payload.result ?? [];
    const apiError = payload.error ?? null;
    const found = parseTelemetryRows(rows).filter((row) => requestIds.includes(String(row.requestId)));
    const unique = new Map(found.map((row) => [String(row.requestId), row]));
    if (unique.size === requestIds.length || attempt === 2) {
      const telemetry = requestIds.flatMap((requestId) => unique.get(requestId) ?? []);
      return {
        requested: requestIds.length,
        matched: telemetry.length,
        apiError,
        totalBackendMs: summary(telemetry.map((row) => Number(row.totalBackendLatencyMs))),
        rpcFromEdgeMs: summary(telemetry.map((row) => Number(row.dbLatencyMs))),
        providerMs: summary(telemetry.map((row) => Number(row.providerLatencyMs))),
        telemetry,
      };
    }
    await wait(10_000);
  }
  throw new Error('EDGE_LOG_QUERY_UNREACHABLE');
}

function groupTelemetry(
  telemetry: Awaited<ReturnType<typeof loadEdgeTelemetry>>,
  lexicalSamples: EdgeSample[],
  semanticSamples: EdgeSample[],
) {
  const summarize = (samples: EdgeSample[]) => {
    const sampleById = new Map(samples.map((sample) => [sample.requestId, sample]));
    const rows = telemetry.telemetry.filter((row) => sampleById.has(String(row.requestId))).map((row) => {
      const sample = sampleById.get(String(row.requestId))!;
      return {
        ...row,
        family: sample.family,
        locale: sample.locale,
        repeat: sample.repeat,
        clientObservedMs: sample.latencyMs,
        handlerNonProviderNonRpcMs: Number(row.totalBackendLatencyMs)
          - Number(row.providerLatencyMs) - Number(row.dbLatencyMs),
        publicGatewayTransportResidualMs: sample.latencyMs - Number(row.totalBackendLatencyMs),
      };
    });
    const executionIds = rows.map((row) => String(row.executionId)).filter(Boolean);
    return {
      count: rows.length,
      totalBackendMs: summary(rows.map((row) => Number(row.totalBackendLatencyMs))),
      rpcFromEdgeMs: summary(rows.map((row) => Number(row.dbLatencyMs))),
      providerMs: summary(rows.map((row) => Number(row.providerLatencyMs))),
      handlerNonProviderNonRpcMs: summary(rows.map((row) => Number(row.handlerNonProviderNonRpcMs))),
      publicGatewayTransportResidualMs: summary(rows.map((row) => Number(row.publicGatewayTransportResidualMs))),
      executionIds: { distinct: new Set(executionIds).size, reused: executionIds.length - new Set(executionIds).size },
      rows,
    };
  };
  return { ...telemetry, lexical: summarize(lexicalSamples), semantic: summarize(semanticSamples) };
}

function parseTelemetryRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const parsed: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const message = String(row.event_message ?? '').trim();
    const candidates = [message];
    try {
      const outer = JSON.parse(message) as unknown;
      if (typeof outer === 'string') candidates.push(outer);
      if (outer && typeof outer === 'object' && 'event_message' in outer) {
        candidates.push(String((outer as Record<string, unknown>).event_message));
      }
    } catch {
      // Supabase may prefix console output; the JSON-object extraction below handles it.
    }
    for (const candidate of candidates) {
      const match = candidate.match(/\{.*\}/s);
      if (!match) continue;
      try {
        const event = JSON.parse(match[0]) as Record<string, unknown>;
        if (event.event !== 'search_request' || typeof event.requestId !== 'string') continue;
        parsed.push({ ...event, timestamp: row.timestamp, region: row.region, executionId: row.execution_id });
        break;
      } catch {
        continue;
      }
    }
  }
  return parsed;
}

function rpcParams(item: SearchCase, vector: string | null): SearchRpcParams {
  const normalized = normalizeForEdgeSearch(item.query);
  const taxonomy = recognizeTaxonomyQuery(normalized.preserving);
  return {
    p_request_id: randomUUID(),
    p_query: item.query,
    p_query_norm: normalized.preserving,
    p_query_ascii: normalized.accentless,
    p_ui_locale: item.locale,
    p_scope_id: SCOPE_ID,
    p_latitude: null,
    p_longitude: null,
    p_radius_m: null,
    p_taxonomy_node_id: taxonomy?.id ?? null,
    p_entity_types: ['PLACE'],
    p_time_start: null,
    p_time_end: null,
    p_query_vector: vector,
    p_embedding_provider: 'voyage',
    p_embedding_model: 'voyage-4',
    p_embedding_revision: 'voyage-4-preflight-v1',
    p_embedding_dimension: 1024,
    p_limit: 10,
    p_search_config_version: 'noncollapse-v1',
  };
}

function rpcSql(): string {
  return `select * from api.search_v1(
    $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::uuid,
    $7::double precision, $8::double precision, $9::integer, $10::uuid,
    $11::app.entity_type[], $12::timestamptz, $13::timestamptz, $14::extensions.vector,
    $15::text, $16::text, $17::text, $18::integer, $19::smallint, $20::text
  )`;
}

function rpcValues(params: SearchRpcParams): unknown[] {
  return [
    params.p_request_id, params.p_query, params.p_query_norm, params.p_query_ascii,
    params.p_ui_locale, params.p_scope_id, params.p_latitude, params.p_longitude,
    params.p_radius_m, params.p_taxonomy_node_id, params.p_entity_types,
    params.p_time_start, params.p_time_end, params.p_query_vector,
    params.p_embedding_provider, params.p_embedding_model, params.p_embedding_revision,
    params.p_embedding_dimension, params.p_limit, params.p_search_config_version,
  ];
}

function parseExplain(value: unknown) {
  const root = Array.isArray(value) ? value[0] as Record<string, unknown> | undefined : undefined;
  if (!root || typeof root !== 'object') throw new Error('PERF_DIAG_EXPLAIN_INVALID');
  const plan = root.Plan as Record<string, unknown> | undefined;
  if (!plan) throw new Error('PERF_DIAG_EXPLAIN_PLAN_MISSING');
  const nodes: Array<Record<string, unknown>> = [];
  const visit = (node: Record<string, unknown>): void => {
    nodes.push({
      nodeType: node['Node Type'], relation: node['Relation Name'] ?? null,
      actualRows: node['Actual Rows'] ?? null, actualLoops: node['Actual Loops'] ?? null,
      actualTotalTimeMs: node['Actual Total Time'] ?? null,
      sharedHitBlocks: node['Shared Hit Blocks'] ?? 0, sharedReadBlocks: node['Shared Read Blocks'] ?? 0,
      sortMethod: node['Sort Method'] ?? null,
    });
    if (Array.isArray(node.Plans)) {
      for (const child of node.Plans) if (child && typeof child === 'object') visit(child as Record<string, unknown>);
    }
  };
  visit(plan);
  return {
    planningMs: Number(root['Planning Time']), executionMs: Number(root['Execution Time']),
    nodeTypes: [...new Set(nodes.map((node) => String(node.nodeType)))].sort(), nodes,
  };
}

function timingHeaders(headers: Headers) {
  const ray = headers.get('cf-ray');
  return {
    edgeRegion: headers.get('x-sb-edge-region'),
    cloudflarePop: ray?.split('-').at(-1) ?? null,
    serverTiming: headers.get('server-timing'),
    proxyLatency: headers.get('x-kong-proxy-latency'),
    upstreamLatency: headers.get('x-kong-upstream-latency'),
  };
}

function repeatCases(cases: SearchCase[], repeats: number): SearchCase[] {
  return Array.from({ length: repeats }, (_, repeat) => cases.map((item) => ({ ...item, repeat }))).flat();
}

function firstByFamily(samples: Array<Record<string, unknown>>) {
  const seen = new Set<string>();
  return samples.filter((sample) => {
    const family = String(sample.family);
    if (seen.has(family)) return false;
    seen.add(family);
    return true;
  });
}

function prefix(value: string): string {
  return [...value].slice(0, Math.max(3, Math.min(6, [...value].length - 1))).join('');
}

function summary(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((left, right) => left - right);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? null,
  };
}

function percentile(values: number[], quantile: number): number | null {
  return values[Math.ceil(quantile * values.length) - 1] ?? null;
}

function numberLatency(sample: { latencyMs: number } | Record<string, unknown>): number {
  return Number(sample.latencyMs);
}

function summarizeForConsole(measurements: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(measurements).map(([name, value]) => {
    if (!value || typeof value !== 'object') return [name, null];
    const item = value as Record<string, unknown>;
    return [name, item.serverExecutionMs ?? item.clientObservedMs ?? item.totalBackendMs ?? null];
  }));
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

type SearchCase = {
  family: string;
  query: string;
  locale: 'en' | 'sv';
  repeat?: number;
};

type EdgeSample = {
  requestId: string;
  family: string;
  locale: 'en' | 'sv';
  repeat?: number;
  status: number;
  resultCount: number;
  semanticDegraded: boolean;
  latencyMs: number;
  headers: ReturnType<typeof timingHeaders>;
};

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
};
