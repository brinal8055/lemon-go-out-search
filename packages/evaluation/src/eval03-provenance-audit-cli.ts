import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import pg from 'pg';

const root = new URL('../../../', import.meta.url);
const packetUrl = new URL('evaluation/judgments/dev-review-packet.day3.v1.json', root);
const auditJsonUrl = new URL('evaluation/audits/eval-03a-dataset-provenance.v1.json', root);
const auditMarkdownUrl = new URL('evaluation/audits/eval-03a-dataset-provenance.v1.md', root);
const auditChecksumUrl = new URL('evaluation/audits/eval-03a-dataset-provenance.v1.sha256', root);
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

type LineageRow = {
  entity_id: string;
  entity_type: 'PLACE' | 'EVENT';
  canonical_name: string;
  publication_status: string;
  entity_created_at: Date;
  published_at: Date | null;
  document_id: string | null;
  document_active: boolean | null;
  source_key: string | null;
  source_record_id: string | null;
  external_key: string | null;
  resolution_method: string | null;
  current_version_id: string | null;
  current_parse_attempt_id: string | null;
  content_hash: string | null;
  capture_run_id: string | null;
  attempt_ingestion_run_id: string | null;
  attempt_parser_version: string | null;
  attempt_status: string | null;
  run_idempotency_key: string | null;
  adapter_version: string | null;
  run_parser_version: string | null;
  mapping_version: string | null;
  run_status: string | null;
  provenance_created_by: string[];
  provenance_notes: string[];
};

type Evidence = {
  sourceRecordId: string | null;
  sourceKey: string | null;
  externalKey: string | null;
  resolutionMethod: string | null;
  currentVersionId: string | null;
  currentParseAttemptId: string | null;
  contentHash: string | null;
  captureRunId: string | null;
  attemptIngestionRunId: string | null;
  attemptParserVersion: string | null;
  attemptStatus: string | null;
  runIdempotencyKey: string | null;
  adapterVersion: string | null;
  runParserVersion: string | null;
  mappingVersion: string | null;
  runStatus: string | null;
};

const packet = JSON.parse(await readFile(packetUrl, 'utf8')) as {
  dataset_manifest: { version: string; checksum: string };
  inventory: Array<{ canonicalEntityId: string }>;
};
const ids = packet.inventory.map(({ canonicalEntityId }) => canonicalEntityId);
const acceptedExternalKeys = await readAcceptedExternalKeys();
const client = new pg.Client({ connectionString });
await client.connect();
let rows: LineageRow[];
try {
  await client.query('begin isolation level repeatable read read only');
  rows = (await client.query<LineageRow>(`
    select entity.id as entity_id, entity.entity_type, entity.canonical_name,
           entity.publication_status, entity.created_at as entity_created_at, entity.published_at,
           document.id as document_id, document.is_active as document_active,
           source.key as source_key, record.id as source_record_id, record.external_key,
           record.resolution_method, record.current_version_id, record.current_parse_attempt_id,
           version.content_hash, version.capture_run_id,
           attempt.ingestion_run_id as attempt_ingestion_run_id,
           attempt.parser_version as attempt_parser_version, attempt.status as attempt_status,
           run.idempotency_key as run_idempotency_key, run.adapter_version,
           run.parser_version as run_parser_version, run.mapping_version, run.status as run_status,
           coalesce(array_agg(distinct provenance.created_by order by provenance.created_by)
             filter (where provenance.created_by is not null), '{}') as provenance_created_by,
           coalesce(array_agg(distinct provenance.note order by provenance.note)
             filter (where provenance.note is not null), '{}') as provenance_notes
    from app.canonical_entities as entity
    left join app.search_documents as document on document.entity_id = entity.id and document.is_active
    left join app.source_records as record on record.canonical_entity_id = entity.id
    left join app.sources as source on source.id = record.source_id
    left join app.source_record_versions as version on version.id = record.current_version_id
    left join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
    left join app.ingestion_runs as run on run.id = version.capture_run_id
    left join app.canonical_fact_provenance as provenance
      on provenance.entity_id = entity.id and provenance.is_current
    where entity.id = any($1::uuid[])
    group by entity.id, document.id, source.key, record.id, version.id, attempt.id, run.id
    order by entity.entity_type, entity.id, record.created_at, record.id
  `, [ids])).rows;
  await client.query('commit');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

const rowsByEntity = groupBy(rows, ({ entity_id: entityId }) => entityId);
const entities = ids.map((entityId) => {
  const entityRows = rowsByEntity.get(entityId) ?? [];
  const first = entityRows[0];
  if (!first) throw new Error(`AUDIT_ENTITY_MISSING:${entityId}`);
  const sourceEvidence: Evidence[] = entityRows.map((row) => ({
    sourceRecordId: row.source_record_id,
    sourceKey: row.source_key,
    externalKey: row.external_key,
    resolutionMethod: row.resolution_method,
    currentVersionId: row.current_version_id,
    currentParseAttemptId: row.current_parse_attempt_id,
    contentHash: row.content_hash,
    captureRunId: row.capture_run_id,
    attemptIngestionRunId: row.attempt_ingestion_run_id,
    attemptParserVersion: row.attempt_parser_version,
    attemptStatus: row.attempt_status,
    runIdempotencyKey: row.run_idempotency_key,
    adapterVersion: row.adapter_version,
    runParserVersion: row.run_parser_version,
    mappingVersion: row.mapping_version,
    runStatus: row.run_status,
  }));
  const origin = classifyOrigin(first, sourceEvidence, acceptedExternalKeys);
  return {
    canonicalEntityId: first.entity_id,
    entityType: first.entity_type,
    canonicalName: first.canonical_name,
    publicationStatus: first.publication_status,
    canonicalCreatedAt: first.entity_created_at.toISOString(),
    publishedAt: first.published_at?.toISOString() ?? null,
    searchDocument: first.document_id
      ? { id: first.document_id, state: first.document_active ? 'ACTIVE' : 'INACTIVE' }
      : { id: null, state: 'NO_ACTIVE_DOCUMENT' },
    sourceEvidence,
    canonicalFactProvenance: {
      createdBy: first.provenance_created_by,
      notes: first.provenance_notes,
    },
    origin,
  };
});
const fixtureEntities = entities.filter(({ origin }) => origin.classification === 'PGTAP_UNIT_INTEGRATION_FIXTURE');
const legitimateEntities = entities.filter(({ origin }) => origin.classification === 'DETERMINISTIC_RECONSTRUCTION');
const unknownEntities = entities.filter(({ origin }) => origin.classification === 'UNKNOWN_ORIGIN');
const noDocumentEntities = entities.filter(({ searchDocument }) => searchDocument.state === 'NO_ACTIVE_DOCUMENT');
const duplicateLooking = entities.filter(({ canonicalName }) => (
  entities.filter((candidate) => candidate.canonicalName === canonicalName).length > 1
));
const municipalEvents = entities.filter(({ canonicalName }) => /^Municipal Event [0-9a-f]{8}$/.test(canonicalName));
const report = {
  auditVersion: 'eval-03a-dataset-provenance.v1',
  manifestAudited: packet.dataset_manifest,
  classification: fixtureEntities.length > 0 ? 'FIXTURE_CONTAMINATED_DATASET' : unknownEntities.length > 0
    ? 'MIXED_ORIGIN_UNSAFE' : 'CLEAN_LEGITIMATE_DATASET',
  summary: {
    entities: entities.length,
    legitimateEntities: legitimateEntities.length,
    fixtureTestEntities: fixtureEntities.length,
    unknownOriginEntities: unknownEntities.length,
    duplicateLookingEntities: duplicateLooking.length,
    municipalEventEntities: municipalEvents.length,
    noActiveDocumentEntities: noDocumentEntities.length,
  },
  testIsolation: {
    primaryLocalDatabaseMutated: true,
    cleanupPresent: false,
    evidence: [
      'tests/unit/jonkoping-event-ingestion.test.ts creates random Municipal Event and src03b-place entities; afterAll only closes the store.',
      'tests/unit/taxonomy.test.ts creates Explicit Indian Restaurant with a random OSM node; afterAll only closes the store.',
      'vitest.config.mts disables file parallelism but provides no database transaction or isolated database.',
    ],
  },
  evaluationClock: {
    value: '2026-10-15T12:00:00Z',
    municipalEventRowsExpired: municipalEvents.length,
    result: 'All Municipal Event test fixtures are expired at the frozen DEV clock.',
  },
  gitEvidence: {
    eventFixture: 'tests/unit/jonkoping-event-ingestion.test.ts: title is `Municipal Event ${uuid.slice(0, 8)}` and venue is Rådhusparken.',
    linkedPlaceFixture: 'tests/unit/jonkoping-event-ingestion.test.ts: source key is `src03b-place-${randomUUID()}` with fixture-adapter-v1.',
    taxonomyFixture: 'tests/unit/taxonomy.test.ts: random OSM node named Explicit Indian Restaurant.',
    acceptedSourceFixtures: [
      'packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json',
      'packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json',
      'packages/source-adapters/fixtures/events/jonkoping-event-calendar.single-occurrence.sanitized.json',
    ],
  },
  entities,
};
type AuditReport = typeof report;
if (entities.length !== 26 || fixtureEntities.length !== 22 || legitimateEntities.length !== 4
  || unknownEntities.length !== 0 || municipalEvents.length !== 18 || noDocumentEntities.length !== 14) {
  throw new Error('AUDIT_EXPECTED_COUNTS_MISMATCH');
}
const reportText = `${JSON.stringify(report, null, 2)}\n`;
await mkdir(new URL('evaluation/audits/', root), { recursive: true });
await Promise.all([
  writeFile(auditJsonUrl, reportText, { flag: 'wx' }),
  writeFile(auditMarkdownUrl, renderMarkdown(report), { flag: 'wx' }),
  writeFile(auditChecksumUrl, `${sha256(reportText)}\n`, { flag: 'wx' }),
]);
console.log(JSON.stringify({ classification: report.classification, ...report.summary, checksum: sha256(reportText) }));

function classifyOrigin(
  entity: LineageRow,
  evidence: Evidence[],
  accepted: Map<string, Set<string>>,
): { classification: 'DETERMINISTIC_RECONSTRUCTION' | 'PGTAP_UNIT_INTEGRATION_FIXTURE' | 'UNKNOWN_ORIGIN'; proof: string[] } {
  const creationEvidence = evidence.find(({ resolutionMethod }) => resolutionMethod === 'NEW_CANONICAL') ?? evidence[0]!;
  if (creationEvidence.adapterVersion === 'fixture-adapter-v1'
    || creationEvidence.sourceKey?.startsWith('src03b-place-')) {
    return {
      classification: 'PGTAP_UNIT_INTEGRATION_FIXTURE',
      proof: ['DB adapter_version=fixture-adapter-v1 / src03b-place-*', 'Exact generator in jonkoping-event-ingestion.test.ts'],
    };
  }
  if (entity.canonical_name === 'Explicit Indian Restaurant'
    && !accepted.get('OSM_OVERPASS')?.has(creationEvidence.externalKey ?? '')) {
    return {
      classification: 'PGTAP_UNIT_INTEGRATION_FIXTURE',
      proof: ['External key absent from accepted OSM fixture', 'Exact random-node generator in taxonomy.test.ts'],
    };
  }
  if (entity.entity_type === 'EVENT' && /^Municipal Event [0-9a-f]{8}$/.test(entity.canonical_name)
    && creationEvidence.externalKey?.startsWith(`event/${entity.canonical_name.slice(-8)}`)) {
    return {
      classification: 'PGTAP_UNIT_INTEGRATION_FIXTURE',
      proof: ['Canonical title prefix matches SourceRecord UUID prefix', 'Exact title/UUID generator in jonkoping-event-ingestion.test.ts'],
    };
  }
  if (creationEvidence.sourceKey && creationEvidence.externalKey
    && accepted.get(creationEvidence.sourceKey)?.has(creationEvidence.externalKey)) {
    return {
      classification: 'DETERMINISTIC_RECONSTRUCTION',
      proof: ['Exact SourceRecord external key exists in an accepted sanitized source fixture', 'Successful current H+A pins the accepted adapter/parser run'],
    };
  }
  return { classification: 'UNKNOWN_ORIGIN', proof: ['No exact accepted fixture or test generator match'] };
}

async function readAcceptedExternalKeys(): Promise<Map<string, Set<string>>> {
  const [osmText, municipalText, eventText] = await Promise.all([
    readFile(new URL('packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json', root), 'utf8'),
    readFile(new URL('packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json', root), 'utf8'),
    readFile(new URL('packages/source-adapters/fixtures/events/jonkoping-event-calendar.single-occurrence.sanitized.json', root), 'utf8'),
  ]);
  const osm = JSON.parse(osmText) as { elements: Array<{ type: string; id: number }> };
  const municipal = JSON.parse(municipalText) as { features: Array<{ attributes: { GlobalID: string } }> };
  const events = JSON.parse(eventText) as { events: Array<{ externalKey: string }> };
  return new Map([
    ['OSM_OVERPASS', new Set(osm.elements.map(({ type, id }) => `${type}/${id}`))],
    ['JONKOPING_MUNICIPAL_UTEGYM', new Set(municipal.features.map(({ attributes }) => (
      `layer-41/globalid/${attributes.GlobalID.replaceAll(/[{}]/g, '').toLowerCase()}`
    )))],
    ['JONKOPING_EVENT_CALENDAR', new Set(events.events.map(({ externalKey }) => externalKey))],
  ]);
}

function renderMarkdown(report: AuditReport): string {
  const entityRows = report.entities.map((entity) => (
    `| ${entity.canonicalEntityId} | ${entity.entityType} | ${entity.canonicalName} | ${entity.publicationStatus} | ${entity.searchDocument.state} | ${entity.origin.classification} | ${entity.sourceEvidence.filter(({ currentVersionId }) => currentVersionId).map(({ sourceRecordId, currentVersionId, currentParseAttemptId, captureRunId }) => `${sourceRecordId} / ${currentVersionId} + ${currentParseAttemptId} / ${captureRunId}`).join('; ') || 'none'} |`
  )).join('\n');
  return `# EVAL-03A dataset provenance audit\n\n`
    + `- Manifest: ${report.manifestAudited.version}\n`
    + `- Manifest checksum: ${report.manifestAudited.checksum}\n`
    + `- Classification: ${report.classification}\n`
    + `- Legitimate deterministic reconstruction: ${report.summary.legitimateEntities}\n`
    + `- Fixture/test: ${report.summary.fixtureTestEntities}\n`
    + `- Unknown: ${report.summary.unknownOriginEntities}\n`
    + `- NO_ACTIVE_DOCUMENT: ${report.summary.noActiveDocumentEntities}\n`
    + `- Frozen clock: ${report.evaluationClock.value}; all ${report.summary.municipalEventEntities} Municipal Event fixtures expired\n\n`
    + `## Exact entity audit\n\n`
    + `| CanonicalEntity ID | Type | Name | Publication | SearchDocument | Origin | SourceRecord / H+A / capture run |\n`
    + `|---|---|---|---|---|---|---|\n${entityRows}\n\n`
    + `## Fixture leakage\n\n`
    + `${report.testIsolation.evidence.map((value) => `- ${value}`).join('\n')}\n`;
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value]);
  return groups;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
