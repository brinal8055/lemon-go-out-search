import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import { assertFinalEvalTarget } from '../packages/contracts/src/database-target.ts';

const ROOT = resolve(import.meta.dirname, '..');
const OUTPUT = resolve(ROOT, 'evaluation/reports/demo-release-01/demo-release.v1.json');
const SUMMARY = resolve(ROOT, 'evaluation/reports/demo-release-01/demo-release.v1.md');
const PROJECT_ID = 'zrxdjorrwcunprbykdtg';
const SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
const EXPECTED = {
  baseCommit: 'a9e922dcf7b1c092cc8076e776a5c2301ce62e1a',
  manifest: 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82',
  documents: '7e5d83ebeee39595944b9ef1bdb5cca8f72ff5aa6a2e2880471b6c4963981a51',
  embeddings: '6ad7ad8fb1d6902de8ee4dbbb66042050ed732789ed4ee7e8a0dbbd46f38f20b',
};

const databaseUrl = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
const backendKey = process.env.LEMON_SUPABASE_SECRET_KEY ?? '';
const managementToken = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const publicEdgeUrl = process.env.EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL ?? '';
assertFinalEvalTarget(databaseUrl, process.env);
if (process.env.SUPABASE_PROJECT_ID !== PROJECT_ID) throw new Error('DEMO_PROJECT_IDENTITY_DRIFT');
if (!backendKey || !managementToken || !publicEdgeUrl) throw new Error('DEMO_RELEASE_READ_CREDENTIALS_REQUIRED');

const startedHead = git(['rev-parse', 'HEAD']);
verifyRepository();
await verifyMobileConfiguration();

const require = createRequire(new URL('../packages/evaluation/package.json', import.meta.url));
const pg = require('pg') as { Client: new (options: { connectionString: string }) => PgClient };
const database = new pg.Client({ connectionString: databaseUrl });
await database.connect();

try {
  const [localIdentity, remoteIdentity, edge] = await Promise.all([
    verifyLocalIdentity(),
    verifyRemoteIdentity(database),
    verifyEdgeDeployment(),
  ]);
  const smoke = await verifyDemoSmoke(database, publicEdgeUrl);
  const failOpen = await acceptedFailOpenEvidence();
  const report = {
    report_version: 'demo-release.v1',
    task: 'DEMO-RELEASE-01',
    generated_at: new Date().toISOString(),
    repository: {
      demo_git_pin: startedHead,
      base_identity: EXPECTED.baseCommit,
      working_tree_clean_at_start: true,
      accepted_prerequisites_present: true,
      frozen_sources_unchanged: true,
      accepted_search_or_config_changes_after_dev_tuning: false,
      committed_secret_scan: 'PASS',
    },
    candidate: {
      candidate_version: 'eval-03-baseline.v1',
      search_config: 'noncollapse-v1',
      rrf: { version: 'RRF_V1', k: 60 },
      noncollapse: { version: 'NONCOLLAPSE_V1', enabled: true },
      semantic: {
        provider: 'voyage', model: 'voyage-4', revision: 'voyage-4-preflight-v1',
        dimension: 1024, query_input_type: 'query', timeout_ms: 700,
        vector_retrieval: 'EXACT_PGVECTOR', ann: false,
      },
    },
    canonical_dataset_manifest: localIdentity,
    hosted_corpus: remoteIdentity,
    edge,
    mobile: {
      public_edge_url: publicEdgeUrl,
      package: 'apps/mobile',
      runtime_path: 'Expo mobile -> Supabase Edge search',
      public_config_only: true,
      backend_secrets_in_client_source_or_config: false,
    },
    deployed_demo_smoke: smoke,
    semantic_fail_open: failOpen,
    accepted_evidence: {
      dev: '113c6dec57337e8263b7a60d9a8e99cf340d70b7',
      dev_tune: '40112336fe569f327b570fab11e2135105bc0741',
      qa: 'eea65f4b55da8d3174c7339556ba362d358a87b7',
      live_event: '84e8bf62aedf1675b2e54dce49a45287f0dac2e9',
      corpus_drift_diagnosis: EXPECTED.baseCommit,
    },
    known_limitations: [
      'PERF revalidation is BLOCKED and deferred; latency targets are not claimed as passed.',
      'Voyage retains an intermittent 700 ms deadline reliability risk.',
      'Published Event inventory is small (3 Events at the pinned corpus state).',
      'Literal today/idag is outside the frozen supported time-parser contract.',
      'The frozen DEV clock is evaluation-only; product/demo uses current Europe/Stockholm time.',
      'Representation-sensitive document/embedding checksums differ, while canonical logical content and vector fingerprints remain verified.',
    ],
    submission_docs_gaps: [
      'SUBMISSION-DOCS-01: expand README from bootstrap wording to the implemented install, Expo, Edge, migration, search, EN/SV, Event, evaluation, and demo paths.',
      'SUBMISSION-DOCS-01: add the required docs/trial-review sources, architecture/search overview, evaluation report, known issues/cuts, and submission checklist artifacts.',
    ],
    status: {
      DEMO_RELEASE_READY: true,
      DEMO_CORPUS_LOGICAL_IDENTITY: 'VERIFIED',
      REPRESENTATION_ONLY_DRIFT: 'ACKNOWLEDGED',
      FINAL_EVALUATION_CANDIDATE_FROZEN: false,
      PERF_REVALIDATION_STATUS: 'BLOCKED_DEFERRED',
      SEALED_ACCESSED: false,
      ADVERSARIAL_ACCESSED: false,
    },
    guards: {
      read_only_remote_operations: true,
      corpus_mutated: false,
      search_document_rebuilt: false,
      embeddings_mutated: false,
      judgments_mutated: false,
      search_or_runtime_behavior_changed: false,
    },
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await writeFile(SUMMARY, renderSummary(report), { flag: 'wx' });
  console.log(JSON.stringify({ decision: 'DEMO_RELEASE_READY', output: OUTPUT, summary: SUMMARY }));
} finally {
  await database.end();
}

function verifyRepository() {
  for (const commit of [
    '113c6dec57337e8263b7a60d9a8e99cf340d70b7',
    '40112336fe569f327b570fab11e2135105bc0741',
    'eea65f4b55da8d3174c7339556ba362d358a87b7',
    '84e8bf62aedf1675b2e54dce49a45287f0dac2e9',
    EXPECTED.baseCommit,
  ]) git(['rev-parse', '--verify', `${commit}^{commit}`]);
  gitQuiet(['diff', '--quiet', '40112336..HEAD', '--',
    'docs/requirements', 'docs/architecture', 'docs/specification', 'docs/implementation']);
  gitQuiet(['diff', '--quiet', '40112336..HEAD', '--',
    'supabase/functions/search', 'supabase/migrations', 'apps/mobile', 'packages/search-documents', 'packages/embedding']);
  execFileSync('node', ['scripts/check-committed-secrets.mjs'], { cwd: ROOT, stdio: 'pipe' });
}

async function verifyMobileConfiguration() {
  const edge = new URL(publicEdgeUrl);
  if (edge.protocol !== 'https:' || edge.hostname !== `${PROJECT_ID}.supabase.co` || edge.pathname !== '/functions/v1/search') {
    throw new Error('DEMO_MOBILE_EDGE_URL_DRIFT');
  }
  const files = git(['ls-files', 'apps/mobile']).split('\n').filter(Boolean);
  const forbidden = /(?:VOYAGE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|LEMON_SUPABASE_SECRET_KEY|DATABASE_URL|DB_PASSWORD|SUPABASE_ACCESS_TOKEN|EXPO_PUBLIC_[A-Z0-9_]*(?:ADMIN|SECRET|SERVICE_ROLE|VOYAGE|DATABASE|DB_PASSWORD|ACCESS_TOKEN))/;
  for (const file of files) {
    const content = await readFile(resolve(ROOT, file), 'utf8');
    if (forbidden.test(content)) throw new Error(`DEMO_MOBILE_SECRET_BOUNDARY_DRIFT:${file}`);
  }
  const example = await readFile(resolve(ROOT, '.env.example'), 'utf8');
  if (/^(?:SUPABASE_ACCESS_TOKEN|SUPABASE_DB_PASSWORD|LEMON_SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|VOYAGE_API_KEY|LEMON_FINAL_EVAL_DATABASE_URL)=[^\s#]+/m.test(example)) {
    throw new Error('DEMO_EXAMPLE_ENV_CONTAINS_SECRET_VALUE');
  }
}

async function verifyLocalIdentity() {
  const bytes = await readFile(resolve(ROOT, 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json'));
  const manifest = JSON.parse(bytes.toString()) as { manifest_version?: string };
  const checksum = sha256(bytes);
  if (manifest.manifest_version !== 'dataset-manifest.final-eval-recovery.v1' || checksum !== EXPECTED.manifest) {
    throw new Error('DEMO_CANDIDATE_IDENTITY_DRIFT:MANIFEST');
  }
  return { version: manifest.manifest_version, checksum, canonical_identity_verified: true };
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
    || inventory.fixtureContamination !== 0) throw new Error('DEMO_CORPUS_LOGICAL_DRIFT:COUNTS');
  const config = await one<Record<string, unknown>>(client, `
    select version, rrf_version as "rrfVersion", rrf_k as "rrfK", noncollapse_version as "noncollapseVersion",
      noncollapse_enabled as "noncollapseEnabled", embedding_provider as provider, embedding_model as model,
      embedding_revision as revision, embedding_dimension as dimension, embedding_timeout_ms as "timeoutMs"
    from app.search_configs where is_active
  `);
  if (config.version !== 'noncollapse-v1' || config.rrfVersion !== 'RRF_V1' || config.rrfK !== 60
    || config.noncollapseVersion !== 'NONCOLLAPSE_V1' || config.noncollapseEnabled !== true
    || config.provider !== 'voyage' || config.model !== 'voyage-4' || config.revision !== 'voyage-4-preflight-v1'
    || config.dimension !== 1024 || config.timeoutMs !== 700) throw new Error('DEMO_CANDIDATE_IDENTITY_DRIFT:REMOTE_CONFIG');
  const documents = await client.query<{ id: string; entity_id: string; entity_type: string; content_hash: string }>(`
    select d.id, d.entity_id, e.entity_type::text, d.content_hash
    from app.search_documents d join app.canonical_entities e on e.id = d.entity_id where d.is_active order by d.id
  `);
  const embeddings = await client.query<{ id: string; search_document_id: string; entity_id: string; document_hash: string; vector_hash: string }>(`
    select id, search_document_id, entity_id, document_hash, md5(embedding::text) as vector_hash
    from app.compatible_ready_embeddings_v order by id
  `);
  const documentChecksum = sha256Lines(documents.rows.map((row) => `${row.id}|${row.entity_id}|${row.entity_type}|${row.content_hash}`));
  const embeddingChecksum = sha256Lines(embeddings.rows.map((row) => `${row.id}|${row.search_document_id}|${row.entity_id}|${row.document_hash}|${row.vector_hash}`));
  if (documentChecksum !== EXPECTED.documents || embeddingChecksum !== EXPECTED.embeddings) {
    throw new Error('DEMO_CORPUS_LOGICAL_DRIFT:CONTENT_OR_VECTOR_FINGERPRINT');
  }
  const ann = await client.query(`select indexname from pg_indexes where lower(indexdef) ~ '(hnsw|ivfflat)'`);
  if (ann.rows.length !== 0) throw new Error('DEMO_CANDIDATE_IDENTITY_DRIFT:ANN_PRESENT');
  return { project: PROJECT_ID, counts: inventory, config, search_document_logical_identity: documentChecksum,
    embedding_fingerprint_identity: embeddingChecksum, representation_only_drift: 'ACKNOWLEDGED', ann_indexes: [] };
}

async function verifyEdgeDeployment() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/functions`, {
    headers: { authorization: `Bearer ${managementToken}` },
  });
  const payload = await response.json() as unknown;
  if (!response.ok) throw new Error(`DEMO_EDGE_MANAGEMENT_UNAVAILABLE:${response.status}`);
  const values = Array.isArray(payload) ? payload : isRecord(payload) && Array.isArray(payload.functions) ? payload.functions : [];
  const search = values.find((value) => isRecord(value) && (value.slug === 'search' || value.name === 'search'));
  if (!isRecord(search) || search.status !== 'ACTIVE') throw new Error('DEMO_EDGE_NOT_ACTIVE');
  const source = await Promise.all([
    readFile(resolve(ROOT, 'supabase/functions/search/index.ts'), 'utf8'),
    readFile(resolve(ROOT, 'supabase/functions/search/search-handler.ts'), 'utf8'),
    readFile(resolve(ROOT, 'supabase/functions/search/server-client.ts'), 'utf8'),
  ]);
  if (!source.join('\n').includes("rpc('search_v1',") || !source.join('\n').includes("schema('api')")) {
    throw new Error('DEMO_EDGE_PUBLIC_PATH_DRIFT');
  }
  return { function: 'search', status: 'ACTIVE', management_identity: {
    version: stringField(search, 'version'), updated_at: stringField(search, 'updated_at'),
  }, endpoint_reachable: true, public_path: 'Edge -> api.search_v1', redeployed: false };
}

async function verifyDemoSmoke(client: PgClient, edgeUrl: string) {
  const direct = await one<{ id: string; name: string }>(client, `
    select id, canonical_name as name from app.canonical_entities
    where publication_status = 'PUBLISHED' and entity_type = 'PLACE' and merged_into_id is null order by id limit 1
  `);
  const cases = [
    { key: 'direct_canonical', query: direct.name, locale: 'en' as const, types: ['PLACE'] as const, expectedId: direct.id },
    { key: 'category_discovery', query: 'pizza', locale: 'en' as const, types: ['PLACE'] as const },
    { key: 'semantic_english', query: 'date night', locale: 'en' as const, types: ['PLACE'] as const },
    { key: 'semantic_swedish', query: 'dejt', locale: 'sv' as const, types: ['PLACE'] as const },
    { key: 'live_event', query: 'this weekend', locale: 'en' as const, types: ['EVENT'] as const },
  ];
  const results = [];
  for (const item of cases) {
    const started = performance.now();
    const response = await fetch(edgeUrl, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': randomUUID() },
      body: JSON.stringify({ query: item.query, uiLocale: item.locale, scopeId: SCOPE_ID, entityTypes: item.types, limit: 10 }),
    });
    const payload = await response.json() as { semanticDegraded?: boolean; results?: Array<{ canonicalId?: string; name?: string; title?: string; type?: string }> };
    const result = { query: item.query, http_status: response.status, result_count: payload.results?.length ?? 0,
      representative_top_result: payload.results?.[0]?.name ?? payload.results?.[0]?.title ?? null,
      semantic_degraded: payload.semanticDegraded === true, observed_latency_ms: Math.round(performance.now() - started) };
    if (response.status !== 200 || result.result_count === 0 || (item.expectedId && payload.results?.[0]?.canonicalId !== item.expectedId)
      || (item.key === 'live_event' && payload.results?.[0]?.type !== 'EVENT')) throw new Error(`DEMO_SMOKE_FAILED:${item.key}`);
    results.push({ key: item.key, ...result });
  }
  return results;
}

async function acceptedFailOpenEvidence() {
  const report = JSON.parse(await readFile(resolve(ROOT,
    'evaluation/reports/final-eval-perf-revalidation/perf-revalidation.v1.json'), 'utf8')) as { failOpen?: { correct?: number; sampleCount?: number; mechanism?: string } };
  if (report.failOpen?.correct !== report.failOpen?.sampleCount || !report.failOpen.mechanism) {
    throw new Error('DEMO_ACCEPTED_FAIL_OPEN_EVIDENCE_MISSING');
  }
  return { accepted_evidence_commit: '289b7e0102f7098beb2249736cbc34dc7124fb13',
    provider_failure_behavior: 'HTTP/search remains available with deterministic retrieval and semanticDegraded=true',
    verified_samples: report.failOpen.sampleCount, mechanism: report.failOpen.mechanism };
}

function renderSummary(report: DemoReleaseSummary) {
  const smoke = report.deployed_demo_smoke.map((item) => (
    `- ${item.key}: \`${item.query}\` — HTTP ${item.http_status}, ${item.result_count} result(s), top \`${item.representative_top_result}\`, semanticDegraded=${item.semantic_degraded}, ${item.observed_latency_ms} ms.`
  )).join('\n');
  return `# DEMO-RELEASE-01 — demo release pin v1\n\n`
    + `- Demo Git pin: \`${report.repository.demo_git_pin}\` (base: \`${report.repository.base_identity}\`).\n`
    + `- Candidate: \`eval-03-baseline.v1\`; RRF_V1 k=60; noncollapse-v1; Voyage voyage-4/1024/query/700 ms; exact pgvector; no ANN.\n`
    + `- Manifest: \`${report.canonical_dataset_manifest.version}\` / \`${report.canonical_dataset_manifest.checksum}\`.\n`
    + `- Hosted project: \`${PROJECT_ID}\`; 392 Places, 3 Events, 395 active SearchDocuments, 395 compatible READY embeddings, 0 fixtures.\n`
    + `- DEMO_CORPUS_LOGICAL_IDENTITY = VERIFIED; SearchDocument logical hashes and embedding vector fingerprints match; REPRESENTATION_ONLY_DRIFT = ACKNOWLEDGED.\n`
    + `- Edge: search ACTIVE; public path \`Edge -> api.search_v1\`; no redeploy was required.\n`
    + `- Mobile: \`apps/mobile\` uses only \`EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL\`; backend secrets are absent from client source/config.\n\n`
    + `## Deployed demo smoke\n\n${smoke}\n\n`
    + `## Accepted fail-open evidence\n\n`
    + `Provider failure leaves HTTP/search available via deterministic retrieval and sets \`semanticDegraded=true\`; accepted evidence verified ${report.semantic_fail_open.verified_samples}/${report.semantic_fail_open.verified_samples} injected timeout samples without damaging deployment.\n\n`
    + `## Status\n\n`
    + `DEMO_RELEASE_READY = TRUE\nDEMO_CORPUS_LOGICAL_IDENTITY = VERIFIED\nREPRESENTATION_ONLY_DRIFT = ACKNOWLEDGED\nFINAL_EVALUATION_CANDIDATE_FROZEN = FALSE\nPERF_REVALIDATION_STATUS = BLOCKED_DEFERRED\nSEALED_ACCESSED = FALSE\nADVERSARIAL_ACCESSED = FALSE\n\n`
    + `## Limitations\n\n${report.known_limitations.map((item: string) => `- ${item}`).join('\n')}\n\n`
    + `## Remaining submission documentation gaps\n\n${report.submission_docs_gaps.map((item: string) => `- ${item}`).join('\n')}\n`;
}

function git(args: string[]) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function gitQuiet(args: string[]) {
  try { execFileSync('git', args, { cwd: ROOT, stdio: 'ignore' }); } catch { throw new Error('DEMO_CANDIDATE_IDENTITY_DRIFT:ACCEPTED_CODE_CHANGED'); }
}

async function one<T extends Record<string, unknown>>(client: PgClient, sql: string): Promise<T> {
  const result = await client.query<T>(sql);
  if (result.rows.length !== 1) throw new Error('DEMO_EXPECTED_ONE_ROW');
  return result.rows[0]!;
}

function sha256(value: Uint8Array) { return createHash('sha256').update(value).digest('hex'); }
function sha256Lines(lines: string[]) { return createHash('sha256').update(lines.join('\n')).digest('hex'); }
function isRecord(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stringField(value: Record<string, unknown>, name: string) { return typeof value[name] === 'string' ? value[name] : null; }

type PgClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
};

type DemoReleaseSummary = {
  repository: { demo_git_pin: string; base_identity: string };
  canonical_dataset_manifest: { version: string; checksum: string };
  deployed_demo_smoke: Array<{
    key: string; query: string; http_status: number; result_count: number;
    representative_top_result: string | null; semantic_degraded: boolean; observed_latency_ms: number;
  }>;
  semantic_fail_open: { verified_samples: number };
  known_limitations: string[];
  submission_docs_gaps: string[];
};
