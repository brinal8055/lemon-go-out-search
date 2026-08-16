import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { assertFinalEvalWriteOperation } from '@lemon/contracts';
import {
  applyTaxonomyMappings,
  generateDuplicateCandidates,
  PostgresIngestionStore,
  runIngestion,
} from '@lemon/ingestion-domain';
import { rebuildSearchDocuments } from '@lemon/search-documents';
import pg from 'pg';

import { JonkopingEventAdapter } from './jonkoping-events.ts';
import { JonkopingUtegymAdapter } from './jonkoping-utegym.ts';
import { runBoundedOsmIngestion } from './osm-ingestion.ts';
import { publishEligiblePlacesForFinalEvalRecoveryA } from './publish-eligible-places.ts';

const { Client } = pg;
const ROOT = resolve(import.meta.dirname, '../../..');
const REPORT_DIRECTORY = resolve(ROOT, 'evaluation/reports/final-eval-recovery');
const REPORT_JSON = resolve(REPORT_DIRECTORY, 'corpus-recovery-a.v1.json');
const REPORT_MARKDOWN = resolve(REPORT_DIRECTORY, 'corpus-recovery-a.v1.md');
const CHECKPOINT_METADATA = resolve(REPORT_DIRECTORY, 'checkpoint.post-recovery-a.v1.json');
const APPROVED_SOURCE_KEYS = [
  'JONKOPING_EVENT_CALENDAR',
  'JONKOPING_MUNICIPAL_UTEGYM',
  'OSM_OVERPASS',
] as const;
const REFERENCE_SOURCE_KEYS = [...APPROVED_SOURCE_KEYS, 'lantmateriet-kommun-lan-rike'];
const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';

const finalizeIndex = process.argv.indexOf('--finalize-checkpoint');
if (finalizeIndex >= 0) {
  const checkpointPath = process.argv[finalizeIndex + 1];
  if (!checkpointPath) throw new Error('missing checkpoint path');
  await finalizeCheckpoint(checkpointPath);
} else if (process.argv.includes('--acquire')) {
  await acquire();
} else {
  throw new Error('usage: pnpm final-eval:recovery-a -- --acquire | --finalize-checkpoint <private dump>');
}

async function acquire(): Promise<void> {
  assertFinalEvalWriteOperation(connectionString, 'corpus-recovery-a', process.env);
  if (process.env.ALLOW_DESTRUCTIVE_DB_TESTS === '1') throw new Error('REFUSING_DESTRUCTIVE_DATABASE_OPERATION');
  if (process.env.VOYAGE_API_KEY) throw new Error('Recovery-A forbids Voyage credentials');
  await assertLinkedProjectIdentity();

  const pre = await inventory();
  if (pre.sourceRecords !== 0 || pre.sourceRecordVersions !== 0 || pre.parseAttempts !== 0
    || pre.canonicalEntities !== 0 || pre.searchDocuments !== 0 || pre.embeddings !== 0) {
    throw new Error('FINAL_EVAL_CORPUS_NOT_EMPTY');
  }
  if (pre.unexpectedSources !== 0) throw new Error('UNEXPECTED_SOURCE_REGISTRY_STATE');

  await grantRecoveryRoles();
  const osm = await runBoundedOsmIngestion(connectionString);
  const municipal = await runAdapter(new JonkopingUtegymAdapter());
  const events = await runAdapter(new JonkopingEventAdapter());
  const taxonomy = await applyTaxonomyMappings(connectionString);
  const duplicateCandidatesCreated = await generateAllDuplicateCandidates();
  const publication = await publishEligiblePlacesForFinalEvalRecoveryA(connectionString, {
    captureRunIds: [osm.result.runId, municipal.runId],
  });
  const projections = await rebuildSearchDocuments(connectionString);
  const audit = await integrityAudit();
  assertIntegrity(audit);
  const coverage = await coverageReport({
    OSM_OVERPASS: osm.result,
    JONKOPING_MUNICIPAL_UTEGYM: municipal,
    JONKOPING_EVENT_CALENDAR: events,
  });
  const post = await inventory();
  const eventReport = await eventInventory(events.runId);
  const duplicateReport = await duplicateInventory();
  const sourceRuns = [
    sourceRun('OSM_OVERPASS', osm.result),
    sourceRun('JONKOPING_MUNICIPAL_UTEGYM', municipal),
    sourceRun('JONKOPING_EVENT_CALENDAR', events),
  ];
  const generatedAt = new Date().toISOString();
  const report = {
    schema_version: 'corpus-recovery-a.v1',
    task: 'FINAL-EVAL-CORPUS-RECOVERY-A-REMOTE',
    generated_at: generatedAt,
    remote_project: process.env.SUPABASE_PROJECT_ID,
    recovery_decision: 'PATH_A_EXISTING_CONTRACT_ALLOWS_VERSIONED_RECOVERY',
    new_recovery_corpus_lineage: true,
    historical_v2_restored: false,
    sealed_accessed: false,
    adversarial_accessed: false,
    voyage_called: false,
    pre_run_inventory: pre,
    source_runs: sourceRuns,
    geography: {
      scope_id: 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      boundary_version: audit.boundaryVersion,
      boundary_checksum: audit.boundaryChecksum,
      osm_in_scope: osm.insideScope,
      osm_rejected_out_of_scope: osm.outsideScope,
    },
    taxonomy,
    publication,
    projections,
    events: eventReport,
    duplicates: { newly_created: duplicateCandidatesCreated, ...duplicateReport },
    coverage,
    post_run_inventory: post,
    integrity: audit,
    backup: null,
    limitations: [
      'Current legitimate supply determines this new recovery lineage; historical v2 counts were not reproduced.',
      'Ambiguous duplicate candidates remain open for human review.',
      'Recovery-A did not create or regenerate embeddings.',
    ],
  };
  await writeArtifacts(report);
  console.log(JSON.stringify({
    report: REPORT_JSON,
    sourceRuns,
    places: post.places,
    events: post.events,
    activeSearchDocuments: post.activeSearchDocuments,
    compatibleReadyEmbeddings: post.compatibleReadyEmbeddings,
    duplicateCandidatesCreated,
    coverage: coverage.status_counts,
    integrity: 'PASS',
  }));
}

async function finalizeCheckpoint(checkpointInput: string): Promise<void> {
  assertFinalEvalWriteOperation(connectionString, 'corpus-recovery-a', process.env);
  await assertLinkedProjectIdentity();
  const checkpointPath = resolve(ROOT, checkpointInput);
  const checkpointDirectory = resolve(ROOT, 'private/backups/final-eval');
  if (!checkpointPath.startsWith(`${checkpointDirectory}/`)
    || !checkpointPath.endsWith('.post-recovery-a.dump')) {
    throw new Error('invalid Recovery-A checkpoint path');
  }
  const report = JSON.parse(await readFile(REPORT_JSON, 'utf8')) as Record<string, unknown>;
  const checksum = createHash('sha256').update(await readFile(checkpointPath)).digest('hex');
  const sidecar = (await readFile(`${checkpointPath}.sha256`, 'utf8')).trim().split(/\s+/)[0];
  if (sidecar !== checksum) throw new Error('checkpoint checksum sidecar mismatch');
  const migration = await migrationIdentity();
  const counts = await inventory();
  const metadata = {
    schema_version: 'final-eval-checkpoint.v1',
    checkpoint_name: 'post-recovery-a',
    dump_file: basename(checkpointPath),
    created_at: new Date().toISOString(),
    sha256: checksum,
    remote_project: process.env.SUPABASE_PROJECT_ID,
    migration_identity: migration,
    row_counts: counts,
  };
  report.backup = metadata;
  await writeFile(CHECKPOINT_METADATA, `${JSON.stringify(metadata, null, 2)}\n`);
  await writeArtifacts(report);
  console.log(JSON.stringify({ metadata: CHECKPOINT_METADATA, checkpoint: metadata.checkpoint_name, sha256: checksum }));
}

async function runAdapter(adapter: JonkopingUtegymAdapter | JonkopingEventAdapter) {
  const store = new PostgresIngestionStore(connectionString);
  try {
    return await runIngestion(store, adapter);
  } finally {
    await store.close();
  }
}

async function grantRecoveryRoles(): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion, lemon_reviewer to postgres with set true');
  } finally {
    await client.end();
  }
}

async function generateAllDuplicateCandidates(): Promise<number> {
  let created = 0;
  while (true) {
    const batch = await generateDuplicateCandidates(connectionString, 100);
    created += batch.length;
    if (batch.length < 100) return created;
  }
}

function sourceRun(sourceKey: string, run: Awaited<ReturnType<typeof runIngestion>>) {
  return { source_key: sourceKey, run_id: run.runId, status: run.status, counters: run.counters };
}

async function assertLinkedProjectIdentity(): Promise<void> {
  const linkedRef = (await readFile(resolve(ROOT, 'supabase/.temp/project-ref'), 'utf8')).trim();
  if (!linkedRef || linkedRef !== process.env.SUPABASE_PROJECT_ID) {
    throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');
  }
}

async function inventory(): Promise<Record<string, number>> {
  return readOne<Record<string, number>>(`
    select
      (select count(*)::int from app.sources) as "referenceSources",
      (select count(*)::int from app.sources where key <> all($1::text[])) as "unexpectedSources",
      (select count(*)::int from app.source_records) as "sourceRecords",
      (select count(*)::int from app.source_record_versions) as "sourceRecordVersions",
      (select count(*)::int from app.source_record_parse_attempts) as "parseAttempts",
      (select count(*)::int from app.canonical_entities) as "canonicalEntities",
      (select count(*)::int from app.places) as places,
      (select count(*)::int from app.events) as events,
      (select count(*)::int from app.entity_taxonomy_memberships where active) as "activeTaxonomyAssignments",
      (select count(*)::int from app.duplicate_candidates) as "duplicateCandidates",
      (select count(*)::int from app.search_documents) as "searchDocuments",
      (select count(*)::int from app.search_documents where is_active) as "activeSearchDocuments",
      (select count(*)::int from app.embeddings) as embeddings,
      (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings"
  `, [REFERENCE_SOURCE_KEYS]);
}

async function integrityAudit(): Promise<Record<string, string | number>> {
  return readOne<Record<string, string | number>>(`
    select
      boundary.version as "boundaryVersion",
      boundary.source_checksum as "boundaryChecksum",
      (select count(*)::int
         from app.sources
        where key <> all($1::text[])
           or licence ilike '%TEST%'
           or attribution ilike '%fixture%') as "fixtureContamination",
      (select count(*)::int
         from app.source_records as record
         left join app.source_record_versions as version on version.id = record.current_version_id
         left join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
        where (record.current_version_id is null) <> (record.current_parse_attempt_id is null)
           or (record.current_version_id is not null and (
             version.source_record_id is distinct from record.id
             or version.content_status <> 'AVAILABLE'
             or attempt.source_record_version_id is distinct from version.id
             or attempt.status <> 'SUCCEEDED'
             or attempt.normalized_output is null
             or attempt.output_redacted_at is not null
           ))) as "invalidCurrentEvidencePairs",
      (select count(*)::int
         from app.canonical_fact_provenance as fact
         join app.source_record_versions as version on version.id = fact.source_record_version_id
         join app.source_records as record on record.id = version.source_record_id
        where fact.is_current and record.canonical_entity_id is distinct from fact.entity_id) as "invalidCanonicalEvidence",
      (select count(*)::int
         from app.canonical_entities as entity
         join app.places as place on place.entity_id = entity.id
         join app.geographic_scope_boundaries as b on b.id = entity.scope_boundary_id
        where entity.publication_status = 'PUBLISHED'
          and (not b.is_active or place.location is null
            or not extensions.st_covers(b.boundary, place.location::extensions.geometry))) as "invalidPlaceGeo",
      (select count(*)::int
         from app.canonical_entities as entity
         join app.events as event on event.entity_id = entity.id
         join app.geographic_scope_boundaries as b on b.id = entity.scope_boundary_id
         left join app.places as venue on venue.entity_id = event.venue_place_id
        where entity.publication_status = 'PUBLISHED' and (
          event.status <> 'SCHEDULED'
          or (event.ends_at is not null and event.ends_at <= event.starts_at)
          or coalesce(venue.location, event.location) is null
          or not extensions.st_covers(b.boundary, coalesce(venue.location, event.location)::extensions.geometry)
        )) as "invalidEvents",
      (select count(*)::int
         from app.entity_taxonomy_memberships as membership
         join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
        where membership.active and (not node.active or node.taxonomy_version <> 'active-going-out.v1')) as "invalidTaxonomyReferences",
      (select count(*)::int
         from app.duplicate_candidates as candidate
         join app.duplicate_candidate_decisions as decision on decision.id = candidate.current_decision_id
        where candidate.evidence_hash is distinct from decision.evidence_hash
           or cardinality(decision.evidence_version_ids) <> 2
           or cardinality(decision.evidence_parse_attempt_ids) <> 2) as "invalidDuplicateState",
      (select count(*)::int
         from app.canonical_entities as entity
         left join app.canonical_fact_provenance as name_fact
           on name_fact.entity_id = entity.id and name_fact.fact_key = 'canonical_name' and name_fact.is_current
         left join app.canonical_fact_provenance as location_fact
           on location_fact.entity_id = entity.id and location_fact.fact_key = 'location' and location_fact.is_current
        where entity.publication_status = 'PUBLISHED' and entity.entity_type = 'PLACE'
          and (name_fact.id is null or location_fact.id is null)) as "missingPlaceProvenance",
      (select count(*)::int
         from app.canonical_entities as entity
         join app.events as event on event.entity_id = entity.id
        where entity.publication_status = 'PUBLISHED' and (
          not exists (select 1 from app.canonical_fact_provenance f where f.entity_id = entity.id and f.fact_key = 'event_start' and f.is_current)
          or not exists (select 1 from app.canonical_fact_provenance f where f.entity_id = entity.id and f.fact_key = 'event_status' and f.is_current)
          or (event.ends_at is not null and not exists (select 1 from app.canonical_fact_provenance f where f.entity_id = entity.id and f.fact_key = 'event_end' and f.is_current))
        )) as "missingEventProvenance",
      (select count(*)::int
         from app.search_documents as document
         left join app.canonical_entities as entity on entity.id = document.entity_id
        where entity.id is null or (document.is_active and (entity.publication_status <> 'PUBLISHED' or entity.merged_into_id is not null))) as "orphanSearchDocuments",
      (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings"
    from app.geographic_scope_boundaries as boundary
    where boundary.scope_id = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6' and boundary.is_active
  `, [REFERENCE_SOURCE_KEYS]);
}

function assertIntegrity(audit: Record<string, string | number>): void {
  const expectedIdentity = {
    boundaryVersion: 'lm-current-2026-08-14',
    boundaryChecksum: '257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d',
  };
  for (const [key, expected] of Object.entries(expectedIdentity)) {
    if (audit[key] !== expected) throw new Error(`GEO_INTEGRITY_VIOLATION:${key}`);
  }
  for (const [key, value] of Object.entries(audit)) {
    if (key === 'boundaryVersion' || key === 'boundaryChecksum') continue;
    if (value !== 0) throw new Error(`RECOVERY_INTEGRITY_VIOLATION:${key}:${value}`);
  }
}

async function coverageReport(sourceRuns: Record<string, Awaited<ReturnType<typeof runIngestion>>>) {
  const leaves = await readMany<{ leaf_slug: string; count: number }>(`
    select node.slug as leaf_slug,
           count(distinct entity.id) filter (
             where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
           )::int as count
      from app.taxonomy_nodes as node
      left join app.entity_taxonomy_memberships as membership
        on membership.taxonomy_node_id = node.id and membership.active
      left join app.canonical_entities as entity on entity.id = membership.entity_id
     where node.active and node.is_leaf and node.taxonomy_version = 'active-going-out.v1'
     group by node.id
     order by node.path, node.id
  `);
  const reviewed = leaves.map((leaf) => {
    const sourceKeys = leaf.leaf_slug === 'events'
      ? ['JONKOPING_EVENT_CALENDAR']
      : leaf.leaf_slug === 'sports'
        ? ['JONKOPING_MUNICIPAL_UTEGYM', 'OSM_OVERPASS']
        : ['OSM_OVERPASS'];
    const successful = sourceKeys.every((key) => sourceRuns[key]?.status === 'SUCCEEDED');
    return {
      ...leaf,
      source_keys: sourceKeys,
      ingestion_run_ids: sourceKeys.map((key) => sourceRuns[key]!.runId),
      status: successful ? (leaf.count >= 5 ? 'COMPLETE' : 'SUPPLY_CONSTRAINED') : 'NEEDS_VALIDATION',
      stop_reason: successful && leaf.count < 5 ? 'SOURCES_EXHAUSTED' : null,
    };
  });
  return {
    taxonomy_version: 'active-going-out.v1',
    active_leaf_count: reviewed.length,
    status_counts: {
      COMPLETE: reviewed.filter(({ status }) => status === 'COMPLETE').length,
      SUPPLY_CONSTRAINED: reviewed.filter(({ status }) => status === 'SUPPLY_CONSTRAINED').length,
      NEEDS_VALIDATION: reviewed.filter(({ status }) => status === 'NEEDS_VALIDATION').length,
    },
    zero_supply_leaves: reviewed.filter(({ count }) => count === 0).map(({ leaf_slug }) => leaf_slug),
    leaves: reviewed,
  };
}

async function eventInventory(runId: string) {
  return readOne<Record<string, number>>(`
    select
      (select fetched from app.ingestion_runs where id = $1) as fetched,
      count(*)::int as accepted,
      count(*) filter (where entity.publication_status = 'PUBLISHED')::int as published,
      count(*) filter (where event.venue_place_id is not null)::int as linked_venue,
      count(*) filter (where event.venue_place_id is null)::int as standalone_venue
    from app.sources as source
    join app.source_records as record on record.source_id = source.id
    join app.canonical_entities as entity on entity.id = record.canonical_entity_id
    join app.events as event on event.entity_id = entity.id
    where source.key = 'JONKOPING_EVENT_CALENDAR'
  `, [runId]);
}

async function duplicateInventory() {
  const states = await readMany<{ status: string; count: number }>(`
    select status::text as status, count(*)::int as count
      from app.duplicate_candidates group by status order by status
  `);
  const stale = await readOne<{ stale: number; reopened: number; finalized_valid: number }>(`
    select
      count(*) filter (where decision.evidence_hash is distinct from candidate.evidence_hash)::int as stale,
      count(*) filter (
        where decision.operation_type = 'OPEN_REVIEW'
          and decision.supersedes_decision_id is not null
      )::int as reopened,
      count(*) filter (
        where candidate.status in ('SAME', 'SEPARATE', 'UNSURE')
          and decision.evidence_hash = candidate.evidence_hash
      )::int as finalized_valid
    from app.duplicate_candidates as candidate
    join app.duplicate_candidate_decisions as decision on decision.id = candidate.current_decision_id
  `);
  return {
    by_state: Object.fromEntries(states.map(({ status, count }) => [status, count])),
    open_review: states.find(({ status }) => status === 'OPEN')?.count ?? 0,
    finalized_decisions_still_valid: stale.finalized_valid,
    stale_decisions: stale.stale,
    reopened_decisions: stale.reopened,
  };
}

async function migrationIdentity() {
  return readOne<{ count: number; latest: string }>(`
    select count(*)::int as count, max(version)::text as latest
      from supabase_migrations.schema_migrations
  `);
}

async function writeArtifacts(report: Record<string, unknown>): Promise<void> {
  await mkdir(REPORT_DIRECTORY, { recursive: true });
  await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(REPORT_MARKDOWN, renderMarkdown(report));
}

function renderMarkdown(report: Record<string, unknown>): string {
  const post = report.post_run_inventory as Record<string, number>;
  const coverage = report.coverage as {
    active_leaf_count: number;
    status_counts: Record<string, number>;
    zero_supply_leaves: string[];
    leaves: Array<{ leaf_slug: string; count: number; status: string; source_keys: string[]; ingestion_run_ids: string[] }>;
  };
  const sourceRuns = report.source_runs as Array<{
    source_key: string;
    run_id: string;
    status: string;
    counters: Record<string, number>;
  }>;
  const backup = report.backup as null | { checkpoint_name: string; sha256: string };
  const lines = [
    '# FINAL-EVAL Recovery-A corpus evidence',
    '',
    `- Generated: \`${String(report.generated_at)}\``,
    `- Remote project: \`${String(report.remote_project)}\``,
    '- `NEW_RECOVERY_CORPUS_LINEAGE = TRUE`',
    '- `HISTORICAL_V2_RESTORED = FALSE`',
    '- SEALED accessed: **NO**',
    '- Adversarial accessed: **NO**',
    '- Voyage called: **NO**',
    `- Places: ${post.places}; Events: ${post.events}; active SearchDocuments: ${post.activeSearchDocuments}; compatible READY embeddings: ${post.compatibleReadyEmbeddings}`,
    `- Coverage: COMPLETE ${coverage.status_counts.COMPLETE}, SUPPLY_CONSTRAINED ${coverage.status_counts.SUPPLY_CONSTRAINED}, NEEDS_VALIDATION ${coverage.status_counts.NEEDS_VALIDATION}; zero-supply leaves ${coverage.zero_supply_leaves.length}`,
    `- Backup: ${backup ? `\`${backup.checkpoint_name}\` / \`${backup.sha256}\`` : 'PENDING'}`,
    '',
    '## Source runs',
    '',
    '| Source | Run | Status | Fetched | Valid | Invalid | Unresolved |',
    '|---|---|---|---:|---:|---:|---:|',
    ...sourceRuns.map((run) => `| ${run.source_key} | ${run.run_id} | ${run.status} | ${run.counters.fetched} | ${run.counters.valid} | ${run.counters.invalid} | ${run.counters.unresolved} |`),
    '',
    '## Active-leaf coverage',
    '',
    '| Leaf | Legitimate current supply | Status | Sources | Runs |',
    '|---|---:|---|---|---|',
    ...coverage.leaves.map((leaf) => `| ${leaf.leaf_slug} | ${leaf.count} | ${leaf.status} | ${leaf.source_keys.join(', ')} | ${leaf.ingestion_run_ids.join(', ')} |`),
    '',
    '## Integrity',
    '',
    'All fixture-contamination, current-evidence, provenance, dedup, geography, taxonomy, Event, orphan-document, and accidental READY-embedding assertions passed with zero violations.',
    '',
    '## Limitations',
    '',
    ...(report.limitations as string[]).map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

async function readOne<T>(sql: string, values: unknown[] = []): Promise<T> {
  const rows = await readMany<T>(sql, values);
  if (rows.length !== 1) throw new Error(`expected one row, received ${rows.length}`);
  return rows[0]!;
}

async function readMany<T>(sql: string, values: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return (await client.query(sql, values)).rows as T[];
  } finally {
    await client.end();
  }
}
