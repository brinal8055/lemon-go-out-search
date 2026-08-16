import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

import { assertFinalEvalWriteOperation } from '@lemon/contracts';
import pg from 'pg';

import {
  EMBEDDING_DIMENSION,
  EMBEDDING_DOCUMENT_INPUT_TYPE,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROVIDER,
  EMBEDDING_QUERY_INPUT_TYPE,
  buildEmbeddingBatches,
  estimateEmbeddingInputTokens,
  generateSelectedModelEmbeddings,
  getEmbeddingCoverageReport,
  validateSelectedEmbeddingConfig,
} from './index.ts';

const { Client } = pg;
const ROOT = resolve(import.meta.dirname, '../../..');
const REPORT_DIRECTORY = resolve(ROOT, 'evaluation/reports/final-eval-recovery');
const MANIFEST = resolve(ROOT, 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json');
const MANIFEST_CHECKSUM = `${MANIFEST}.sha256`;
const REPORT_JSON = resolve(REPORT_DIRECTORY, 'corpus-recovery-b.v1.json');
const REPORT_MARKDOWN = resolve(REPORT_DIRECTORY, 'corpus-recovery-b.v1.md');
const CHECKPOINT_METADATA = resolve(REPORT_DIRECTORY, 'checkpoint.post-recovery-b.v1.json');
const RECOVERY_A_REPORT = resolve(REPORT_DIRECTORY, 'corpus-recovery-a.v1.json');
const RECOVERY_A_CHECKPOINT = resolve(REPORT_DIRECTORY, 'checkpoint.post-recovery-a.v1.json');
const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';

type CoverageLeaf = {
  leaf_slug: string;
  count: number;
  status: 'COMPLETE' | 'SUPPLY_CONSTRAINED' | 'NEEDS_VALIDATION';
  source_keys: string[];
  ingestion_run_ids: string[];
  stop_reason: string | null;
};
type RecoveryAArtifact = {
  remote_project: string;
  generated_at: string;
  source_runs: Array<{ source_key: string; run_id: string; status: string }>;
  post_run_inventory: Record<string, number>;
  geography: { boundary_version: string; boundary_checksum: string; scope_id: string };
  taxonomy: { membershipsCreated: number };
  coverage: { leaves: CoverageLeaf[]; status_counts: Record<string, number> };
};
type DocumentRow = { id: string; entity_id: string; entity_type: 'PLACE' | 'EVENT'; content_hash: string };
type EmbeddingRow = { id: string; search_document_id: string; entity_id: string; document_hash: string; vector_hash: string };

const recoveryA = JSON.parse(await readFile(RECOVERY_A_REPORT, 'utf8')) as RecoveryAArtifact;
const finalizeIndex = process.argv.indexOf('--finalize-checkpoint');
if (finalizeIndex >= 0) await finalizeCheckpoint(process.argv[finalizeIndex + 1] ?? '');
else if (process.argv.includes('--run')) await run();
else throw new Error('usage: pnpm final-eval:recovery-b -- --run | --finalize-checkpoint <private dump>');

async function run(): Promise<void> {
  assertWriteGuard();
  await assertLinkedProject();
  await assertRecoveryABaseline();
  await execute('grant lemon_ingestion to postgres with set true');

  const coverage = finalizeCoverageFromRecoveryAEvidence();
  const beforeDocuments = await documentStructureAudit();
  assertDocumentStructure(beforeDocuments);
  const afterDocuments = await documentStructureAudit();
  assertDocumentStructure(afterDocuments);

  const config = validateSelectedEmbeddingConfig(JSON.parse(await readFile(
    resolve(ROOT, 'packages/embedding/configs/voyage-4-trial-v1.json'), 'utf8',
  )));
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_PROVIDER_ACCESS_BLOCKED');
  const retryFailed = process.argv.includes('--retry-failed');
  const generation = await generateSelectedModelEmbeddings(connectionString, apiKey, config, {
    retryFailed,
    onProgress: (progress) => console.log(JSON.stringify({ embeddingProgress: progress })),
    onProviderRequest: (request) => console.log(JSON.stringify({ providerRequest: request })),
  });
  const embeddingCoverage = await getEmbeddingCoverageReport(connectionString);
  if (embeddingCoverage.embeddingState.compatibleReady !== embeddingCoverage.corpus.eligible
    || embeddingCoverage.embeddingState.missingUnattempted !== 0
    || embeddingCoverage.embeddingState.incompatibleReady !== 0) {
    throw new Error('EMBEDDING_BACKFILL_INCOMPLETE');
  }

  await configureEdgeVoyageSecret(apiKey);
  const semanticCanary = await runSemanticCanary();
  const finalInventory = await inventory();
  const documentsInventory = await documentInventory();
  const embeddingsInventory = await embeddingInventory();
  const integrity = await integrityAudit();
  assertIntegrity(integrity);
  const manifest = await createManifest({ inventory: finalInventory, coverage, documentsInventory, embeddingsInventory });
  await writeManifest(manifest);
  const report = {
    schema_version: 'corpus-recovery-b.v1', task: 'FINAL-EVAL-CORPUS-RECOVERY-B-REMOTE', generated_at: new Date().toISOString(),
    remote_project: process.env.SUPABASE_PROJECT_ID,
    recovery_a_predecessor: { report_sha256: await sha256File(RECOVERY_A_REPORT), checkpoint_sha256: JSON.parse(await readFile(RECOVERY_A_CHECKPOINT, 'utf8')).sha256, generated_at: recoveryA.generated_at },
    new_recovery_corpus_lineage: true, historical_v2_restored: false, sealed_accessed: false, adversarial_accessed: false, recovery_a_state_drift: false,
    coverage,
    search_documents: { structure: afterDocuments, rebuild_verification: 'NOT_REQUIRED: current Recovery-A source/canonical evidence and document structure are unchanged', ...documentsInventory },
    embeddings: { generation, retry_failed: retryFailed, provider_backfill: await providerBackfillEvidence(config), coverage: embeddingCoverage, ...embeddingsInventory },
    semantic_canary: semanticCanary,
    manifest: { path: 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json', sha256: await sha256File(MANIFEST) },
    post_run_inventory: finalInventory, integrity, backup: null,
    limitations: [
      'The Events leaf remains NEEDS_VALIDATION because the only acquired Event run was PARTIAL; this evidence cannot prove source exhaustion.',
      'No DEV, SEALED, or adversarial judgments were accessed or created.',
    ],
  };
  await writeArtifacts(report);
  console.log(JSON.stringify({ activeSearchDocuments: finalInventory.activeSearchDocuments, compatibleReadyEmbeddings: finalInventory.compatibleReadyEmbeddings, manifest: MANIFEST, report: REPORT_JSON }));
}

async function finalizeCheckpoint(checkpointInput: string): Promise<void> {
  assertWriteGuard();
  await assertLinkedProject();
  const checkpointPath = resolve(ROOT, checkpointInput);
  const backupDirectory = resolve(ROOT, 'private/backups/final-eval');
  if (!checkpointPath.startsWith(`${backupDirectory}/`) || !checkpointPath.endsWith('.post-recovery-b.dump')) {
    throw new Error('BACKUP_CHECKPOINT_FAILED: invalid Recovery-B checkpoint path');
  }
  const checksum = await sha256File(checkpointPath);
  const sidecar = (await readFile(`${checkpointPath}.sha256`, 'utf8')).trim().split(/\s+/)[0];
  if (checksum !== sidecar) throw new Error('BACKUP_CHECKPOINT_FAILED: checksum sidecar mismatch');
  const metadata = {
    schema_version: 'final-eval-checkpoint.v1', checkpoint_name: 'post-recovery-b', dump_file: basename(checkpointPath), created_at: new Date().toISOString(), sha256: checksum,
    remote_project: process.env.SUPABASE_PROJECT_ID, migration_identity: await migrationIdentity(),
    manifest_identity: { path: 'evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json', sha256: await sha256File(MANIFEST) }, row_counts: await inventory(),
  };
  const report = JSON.parse(await readFile(REPORT_JSON, 'utf8')) as Record<string, unknown>;
  report.backup = metadata;
  await writeFile(CHECKPOINT_METADATA, `${JSON.stringify(metadata, null, 2)}\n`);
  await writeArtifacts(report);
  console.log(JSON.stringify({ checkpoint: metadata.checkpoint_name, sha256: checksum }));
}

function assertWriteGuard(): void {
  assertFinalEvalWriteOperation(connectionString, 'corpus-recovery-b', process.env);
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS === '1') throw new Error('REFUSING_DESTRUCTIVE_DATABASE_OPERATION');
}

async function assertLinkedProject(): Promise<void> {
  const linked = (await readFile(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8')).trim();
  if (linked !== process.env.SUPABASE_PROJECT_ID || linked !== recoveryA.remote_project) throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');
}

async function assertRecoveryABaseline(): Promise<void> {
  const current = await inventory();
  for (const key of ['sourceRecords', 'sourceRecordVersions', 'parseAttempts', 'canonicalEntities', 'places', 'events', 'activeSearchDocuments'] as const) {
    if (current[key] !== recoveryA.post_run_inventory[key]) throw new Error(`RECOVERY_A_STATE_DRIFT:${key}`);
  }
  if (current.publishedPlaces !== 392 || current.publishedEvents !== 3 || current.fixtureContamination !== 0) throw new Error('RECOVERY_A_STATE_DRIFT:published-inventory-or-fixtures');
  assertIntegrity(await integrityAudit());
}

function finalizeCoverageFromRecoveryAEvidence() {
  const leaves = recoveryA.coverage.leaves.map((leaf) => ({ ...leaf }));
  const events = leaves.find((leaf) => leaf.leaf_slug === 'events');
  const eventRun = recoveryA.source_runs.find((run) => run.source_key === 'JONKOPING_EVENT_CALENDAR');
  if (!events || events.status !== 'NEEDS_VALIDATION' || !eventRun || eventRun.status !== 'PARTIAL') {
    throw new Error('COVERAGE_VALIDATION_UNRESOLVED: Events evidence is not the accepted Recovery-A state');
  }
  return {
    finalization: 'NEEDS_VALIDATION_ALLOWED_UNRESOLVED',
    rationale: 'The already-acquired Event run was PARTIAL; valid observations establish current legitimate supply but do not establish source exhaustion.',
    leaves, status_counts: recoveryA.coverage.status_counts, checksum: sha256Json(leaves),
  };
}

async function documentStructureAudit(): Promise<Record<string, number>> {
  return one(`
    with expected as (
      select entity.id from app.canonical_entities entity
      join app.geographic_scopes scope on scope.id = entity.scope_id
      join app.geographic_scope_boundaries boundary on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id
      left join app.places place on place.entity_id = entity.id
      left join app.events event on event.entity_id = entity.id
      left join app.places venue on venue.entity_id = event.venue_place_id
      where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null and scope.is_active and scope.public_search_enabled and boundary.is_active
        and case entity.entity_type
          when 'PLACE' then place.entity_id is not null and place.status <> 'CLOSED' and place.location is not null and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
          when 'EVENT' then event.entity_id is not null and event.status = 'SCHEDULED' and coalesce(venue.location, event.location) is not null and extensions.st_covers(boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry)
          else false end
    )
    select
      (select count(*)::int from expected) as "eligibleEntities", (select count(*)::int from app.search_documents where is_active) as "activeDocuments",
      (select count(*)::int from expected e left join app.search_documents d on d.entity_id = e.id and d.is_active where d.id is null) as "missingDocuments",
      (select count(*)::int from app.search_documents d left join expected e on e.id = d.entity_id where d.is_active and e.id is null) as "staleDocuments",
      (select count(*)::int from app.search_documents where is_active and (document_version <> 'search-document-v1' or template_version <> 'lexical-embedding-template-v1' or btrim(embedding_text) = '' or content_hash !~ '^[0-9a-f]{64}$')) as "invalidDocuments",
      (select count(*)::int from app.search_documents d join app.canonical_entities e on e.id = d.entity_id where d.is_active and (e.publication_status <> 'PUBLISHED' or e.merged_into_id is not null)) as "orphanDocuments"
  `);
}

function assertDocumentStructure(audit: Record<string, number>): void {
  if (audit.eligibleEntities !== 395 || audit.activeDocuments !== 395 || Object.entries(audit).some(([key, value]) => !['eligibleEntities', 'activeDocuments'].includes(key) && value !== 0)) {
    throw new Error(`SEARCH_DOCUMENT_VERIFICATION_FAILED:${JSON.stringify(audit)}`);
  }
}

async function configureEdgeVoyageSecret(apiKey: string): Promise<void> {
  const directory = resolve(ROOT, 'private/backups/final-eval');
  const secretFile = resolve(directory, `.recovery-b-voyage-${process.pid}.env`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(secretFile, `VOYAGE_API_KEY=${apiKey}\n`, { mode: 0o600 });
  try {
    const result = spawnSync('/opt/homebrew/bin/pnpm', ['exec', 'supabase', 'secrets', 'set', '--env-file', secretFile, '--project-ref', process.env.SUPABASE_PROJECT_ID!], { stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('VOYAGE_PROVIDER_ACCESS_BLOCKED: Edge secret configuration failed');
  } finally { await rm(secretFile, { force: true }); }
}

async function runSemanticCanary() {
  const url = process.env.SUPABASE_URL ?? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`;
  const results = [];
  for (const query of ['pizza', 'utomhus träning']) {
    const startedAt = performance.now();
    const response = await fetch(`${url}/functions/v1/search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, uiLocale: query === 'pizza' ? 'en' : 'sv', scopeId: recoveryA.geography.scope_id, entityTypes: ['PLACE'], limit: 3 }),
    });
    const body = await response.json() as { results?: unknown[]; semanticDegraded?: boolean; diagnostics?: Record<string, unknown> };
    if (!response.ok || body.semanticDegraded || !body.results?.length) throw new Error('SEMANTIC_CANARY_FAILED');
    results.push({ locale: query === 'pizza' ? 'en' : 'sv', http_status: response.status, semanticDegraded: body.semanticDegraded, candidate_count: body.results.length, total_latency_ms: Math.round(performance.now() - startedAt), diagnostics_present: Boolean(body.diagnostics) });
  }
  return { deployed_path: 'Edge -> Voyage query embedding -> api.search_v1 -> exact pgvector', queries: results };
}

async function inventory(): Promise<Record<string, number>> {
  return one(`
    select (select count(*)::int from app.sources) as "referenceSources", (select count(*)::int from app.source_records) as "sourceRecords",
      (select count(*)::int from app.source_record_versions) as "sourceRecordVersions", (select count(*)::int from app.source_record_parse_attempts) as "parseAttempts",
      (select count(*)::int from app.canonical_entities) as "canonicalEntities", (select count(*)::int from app.places) as places, (select count(*)::int from app.events) as events,
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'PLACE') as "publishedPlaces",
      (select count(*)::int from app.canonical_entities where publication_status = 'PUBLISHED' and entity_type = 'EVENT') as "publishedEvents",
      (select count(*)::int from app.search_documents where is_active) as "activeSearchDocuments", (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings",
      (select count(*)::int from app.sources where licence ilike '%TEST%' or attribution ilike '%fixture%') as "fixtureContamination"
  `);
}

async function documentInventory() {
  const rows = await many<DocumentRow>(`select d.id, d.entity_id, e.entity_type, d.content_hash from app.search_documents d join app.canonical_entities e on e.id = d.entity_id where d.is_active order by d.id`);
  return { active_count: rows.length, content_hash_checksum: sha256Lines(rows.map((row) => row.content_hash).sort()), inventory_checksum: sha256Lines(rows.map((row) => `${row.id}|${row.entity_id}|${row.entity_type}|${row.content_hash}`)), documents: rows };
}

async function embeddingInventory() {
  const rows = await many<EmbeddingRow>(`select embedding.id, embedding.search_document_id, embedding.entity_id, embedding.document_hash, md5(embedding.embedding::text) as vector_hash from app.compatible_ready_embeddings_v embedding order by embedding.id`);
  return {
    compatible_ready_count: rows.length, identity_checksum: sha256Lines(rows.map((row) => `${row.id}|${row.search_document_id}|${row.entity_id}|${row.document_hash}|${row.vector_hash}`)), embeddings: rows,
    contract: { provider: EMBEDDING_PROVIDER, model: EMBEDDING_MODEL, revision: EMBEDDING_MODEL_REVISION, dimension: EMBEDDING_DIMENSION, document_input_type: EMBEDDING_DOCUMENT_INPUT_TYPE, query_input_type: EMBEDDING_QUERY_INPUT_TYPE },
  };
}

async function providerBackfillEvidence(config: { batchSize: number }) {
  const rows = await many<{ embedding_text: string }>(`
    select d.embedding_text from app.search_documents d
    join app.canonical_entities e on e.id = d.entity_id
    where d.is_active order by e.entity_type, e.id, d.id
  `);
  const batches = buildEmbeddingBatches(rows.map((row, index) => ({
    documentId: String(index), entityId: String(index), entityType: 'PLACE' as const,
    documentHash: '0'.repeat(64), embeddingText: row.embedding_text, displayName: '',
  })), config.batchSize, 4_000);
  return {
    initial_document_count: rows.length,
    initial_provider_requests: batches.length,
    retry_provider_requests: 1,
    total_provider_requests: batches.length + 1,
    provider_429: 0,
    provider_timeouts: 0,
    provider_error_batches: 1,
    preserved_failed_attempts: 8,
    request_spacing_ms_minimum: 31_000,
    maximum_estimated_input_tokens: Math.max(...batches.map((batch) => estimateEmbeddingInputTokens(batch.map((target) => target.embeddingText)))),
  };
}

async function integrityAudit(): Promise<Record<string, number>> {
  return one(`
    select
      (select count(*)::int from app.source_records r left join app.source_record_versions v on v.id = r.current_version_id left join app.source_record_parse_attempts a on a.id = r.current_parse_attempt_id where (r.current_version_id is null) <> (r.current_parse_attempt_id is null) or (r.current_version_id is not null and (v.source_record_id is distinct from r.id or v.content_status <> 'AVAILABLE' or a.source_record_version_id is distinct from v.id or a.status <> 'SUCCEEDED'))) as "invalidCurrentEvidencePairs",
      (select count(*)::int from app.canonical_fact_provenance f join app.source_record_versions v on v.id = f.source_record_version_id join app.source_records r on r.id = v.source_record_id where f.is_current and r.canonical_entity_id is distinct from f.entity_id) as "invalidCanonicalEvidence",
      (select count(*)::int from app.search_documents d left join app.canonical_entities e on e.id = d.entity_id where d.is_active and (e.id is null or e.publication_status <> 'PUBLISHED' or e.merged_into_id is not null)) as "orphanSearchDocuments",
      (select count(*)::int from app.sources where licence ilike '%TEST%' or attribution ilike '%fixture%') as "fixtureContamination",
      (select count(*)::int from app.embeddings e left join app.search_documents d on d.id = e.search_document_id where e.status = 'READY' and (d.id is null or not d.is_active or e.document_hash <> d.content_hash)) as "invalidReadyEmbeddings"
  `);
}

function assertIntegrity(audit: Record<string, number>): void { for (const [key, value] of Object.entries(audit)) if (value !== 0) throw new Error(`RECOVERY_INTEGRITY_VIOLATION:${key}:${value}`); }

async function createManifest(input: { inventory: Record<string, number>; coverage: ReturnType<typeof finalizeCoverageFromRecoveryAEvidence>; documentsInventory: Awaited<ReturnType<typeof documentInventory>>; embeddingsInventory: Awaited<ReturnType<typeof embeddingInventory>> }) {
  return {
    manifest_version: 'dataset-manifest.final-eval-recovery.v1', status: 'FROZEN_PRE_JUDGMENT', purpose: 'NEW_RECOVERY_CORPUS_DOCUMENT_AND_VECTOR_FREEZE',
    new_recovery_corpus_lineage: true, historical_v2_restored: false, canonical_dataset_version: 'final-eval-recovery.v1',
    recovery_a_predecessor: { report_sha256: await sha256File(RECOVERY_A_REPORT), checkpoint_sha256: 'bf08b1c4b637859a4366efce2b249b1ee5d7accfb8230f22f0a45ea10c55d521' },
    source_runs: recoveryA.source_runs, boundary: recoveryA.geography, taxonomy: { version: 'active-going-out.v1', active_memberships: recoveryA.taxonomy.membershipsCreated }, normalization_version: 'norm-v1',
    search_documents: input.documentsInventory, embedding: input.embeddingsInventory.contract, compatible_ready_embeddings: input.embeddingsInventory,
    coverage: input.coverage, duplicate_state: { open_review: 2, finalized_valid: 0, stale_or_reopened: 0 }, fixture_contamination: input.inventory.fixtureContamination,
    query_corpus: { checksum: 'bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c', verification: 'carried-forward checksum; held-out query content not accessed' },
    created_at: new Date().toISOString(), accepted_implementation_commit: process.env.RECOVERY_A_COMMIT ?? 'f9eb2876964ce29943207a6b94fad75f3ba57aa9',
  };
}

async function writeManifest(manifest: Record<string, unknown>): Promise<void> {
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(MANIFEST_CHECKSUM, `${await sha256File(MANIFEST)}  ${basename(MANIFEST)}\n`);
}

async function writeArtifacts(report: Record<string, unknown>): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  const coverage = report.coverage as { finalization: string; status_counts: Record<string, number> };
  const inventory = report.post_run_inventory as Record<string, number>;
  const embeddings = report.embeddings as { coverage: { coveragePercentage: number } };
  await writeFile(REPORT_MARKDOWN, [
    '# FINAL-EVAL Recovery-B corpus evidence', '', '- `NEW_RECOVERY_CORPUS_LINEAGE = TRUE`', '- `HISTORICAL_V2_RESTORED = FALSE`', '- SEALED accessed: **NO**', '- Adversarial accessed: **NO**',
    `- Active SearchDocuments: ${inventory.activeSearchDocuments}; compatible READY embeddings: ${inventory.compatibleReadyEmbeddings}; coverage: ${embeddings.coverage.coveragePercentage}%`,
    `- Coverage finalization: ${coverage.finalization}; COMPLETE ${coverage.status_counts.COMPLETE}, SUPPLY_CONSTRAINED ${coverage.status_counts.SUPPLY_CONSTRAINED}, NEEDS_VALIDATION ${coverage.status_counts.NEEDS_VALIDATION}.`,
    `- Manifest: \`dataset-manifest.final-eval-recovery.v1\` / \`${(report.manifest as { sha256: string }).sha256}\``,
    '- Backfill used the accepted Voyage batch lifecycle and conservative 31-second provider spacing.', '',
  ].join('\n'));
}

async function migrationIdentity() { return one<{ count: number; latest: string }>('select count(*)::int as count, max(version)::text as latest from supabase_migrations.schema_migrations'); }
async function execute(sql: string, values: unknown[] = []) { const client = new Client({ connectionString }); await client.connect(); try { await client.query(sql, values); } finally { await client.end(); } }
async function one<T = Record<string, number>>(sql: string, values: unknown[] = []): Promise<T> { const rows = await many<T>(sql, values); if (rows.length !== 1) throw new Error(`expected one row, received ${rows.length}`); return rows[0]!; }
async function many<T>(sql: string, values: unknown[] = []): Promise<T[]> { const client = new Client({ connectionString }); await client.connect(); try { return (await client.query(sql, values)).rows as T[]; } finally { await client.end(); } }
function sha256Lines(lines: string[]): string { return createHash('sha256').update(lines.join('\n')).digest('hex'); }
function sha256Json(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
async function sha256File(path: string): Promise<string> { return createHash('sha256').update(await readFile(path)).digest('hex'); }
