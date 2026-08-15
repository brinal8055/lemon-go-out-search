import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import pg from 'pg';

import {
  fixtureDatabaseUrl,
  generateCoverageDocument,
  prepareLocalTaxonomyRuntime,
} from './index.ts';

const { Client } = pg;
const args = process.argv.slice(2);
const label = option('--label') ?? 'coverage-audit';
if (!/^[a-z0-9][a-z0-9.-]*$/.test(label)) throw new Error('invalid --label');
const generatedAt = option('--generated-at') ?? new Date().toISOString();
if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('invalid --generated-at');
const frozenClockUtc = '2026-10-15T12:00:00Z';
const outputDirectory = resolve(option('--output-directory') ?? 'artifacts/coverage');
const sourceRunEvidencePath = option('--source-run-evidence');
const connectionString = fixtureDatabaseUrl();
const eventAdapterEvidence = sourceRunEvidencePath
  ? readEventAdapterEvidence(JSON.parse(await readFile(resolve(sourceRunEvidencePath), 'utf8')))
  : null;

await prepareLocalTaxonomyRuntime(connectionString);
const coverage = await generateCoverageDocument(connectionString, { generatedAt });
const client = new Client({ connectionString });
await client.connect();

let report: Record<string, unknown>;
try {
  await client.query('begin isolation level repeatable read read only');

  const overall = (await client.query(`
    select
      (select count(*)::int from app.source_records) as "sourceRecords",
      (select count(*)::int
         from app.source_records as record
         join app.source_record_versions as version on version.id = record.current_version_id
         join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
        where version.content_status = 'AVAILABLE'
          and attempt.status = 'SUCCEEDED'
          and attempt.source_record_version_id = record.current_version_id
          and attempt.normalized_output is not null
          and attempt.output_redacted_at is null) as "currentSuccessfulEvidencePairs",
      (select count(*)::int from app.canonical_entities where entity_type = 'PLACE' and merged_into_id is null) as "canonicalPlaces",
      (select count(*)::int from app.canonical_entities where entity_type = 'EVENT' and merged_into_id is null) as "canonicalEvents",
      (select count(*)::int from app.canonical_entities where entity_type = 'PLACE' and publication_status = 'PUBLISHED' and merged_into_id is null) as "publishedPlaces",
      (select count(*)::int from app.canonical_entities where entity_type = 'EVENT' and publication_status = 'PUBLISHED' and merged_into_id is null) as "publishedEvents",
      (select count(*)::int
         from app.search_documents as document
         join app.canonical_entities as entity on entity.id = document.entity_id
        where document.is_active and entity.entity_type = 'PLACE') as "searchablePlaces",
      (select count(*)::int
         from app.search_documents as document
         join app.canonical_entities as entity on entity.id = document.entity_id
        where document.is_active and entity.entity_type = 'EVENT') as "searchableEvents",
      (select count(*)::int from app.search_documents where is_active) as "activeSearchDocuments",
      (select count(*)::int from app.compatible_ready_embeddings_v) as "compatibleReadyEmbeddings"
  `)).rows[0];

  const stageFunnel = (await client.query(`
    select source.key as "sourceKey",
           count(record.id)::int as discovered,
           count(record.id) filter (
             where version.content_status = 'AVAILABLE'
               and attempt.status = 'SUCCEEDED'
               and attempt.source_record_version_id = record.current_version_id
               and attempt.normalized_output is not null
               and attempt.output_redacted_at is null
           )::int as parsed,
           count(record.id) filter (where record.canonical_entity_id is not null)::int as canonicalized,
           count(record.id) filter (where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null)::int as published,
           count(record.id) filter (where document.id is not null)::int as searchable
      from app.sources as source
      left join app.source_records as record on record.source_id = source.id
      left join app.source_record_versions as version on version.id = record.current_version_id
      left join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      left join app.canonical_entities as entity on entity.id = record.canonical_entity_id
      left join app.search_documents as document on document.entity_id = entity.id and document.is_active
     where source.key in ('OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM', 'JONKOPING_EVENT_CALENDAR')
     group by source.key
     order by source.key
  `)).rows;

  const taxonomyNodes = (await client.query(`
    with expanded as (
      select distinct membership.entity_id, ancestor_id as taxonomy_node_id
        from app.entity_taxonomy_memberships as membership
        join app.taxonomy_nodes as direct_node
          on direct_node.id = membership.taxonomy_node_id and direct_node.active
       cross join lateral unnest(direct_node.path) as ancestor_id
       where membership.active
    ), eligible as (
      select entity.id, entity.entity_type,
             entity.publication_status = 'PUBLISHED'
               and entity.merged_into_id is null
               and boundary.is_active
               and case
                 when entity.entity_type = 'PLACE' then place.status <> 'CLOSED'
                   and place.location is not null
                   and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
                 else event.status = 'SCHEDULED'
                   and coalesce(venue.location, event.location) is not null
                   and extensions.st_covers(boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry)
                   and case when event.ends_at is null then event.starts_at >= $1::timestamptz
                            else event.ends_at > $1::timestamptz end
               end as eligible
        from app.canonical_entities as entity
        join app.geographic_scope_boundaries as boundary on boundary.id = entity.scope_boundary_id
        left join app.places as place on place.entity_id = entity.id
        left join app.events as event on event.entity_id = entity.id
        left join app.places as venue on venue.entity_id = event.venue_place_id
    ), source_counts as (
      select expanded.taxonomy_node_id, source.key, count(distinct eligible.id)::int as entity_count
        from expanded
        join eligible on eligible.id = expanded.entity_id and eligible.eligible
        join app.source_records as record on record.canonical_entity_id = eligible.id
        join app.sources as source on source.id = record.source_id
       group by expanded.taxonomy_node_id, source.key
    )
    select node.id, node.slug, node.parent_id as "parentId", parent.slug as "parentSlug",
           node.is_leaf as "isLeaf",
           count(distinct eligible.id) filter (where eligible.entity_type = 'PLACE')::int as "discoveredPlaceCount",
           count(distinct eligible.id) filter (where eligible.entity_type = 'EVENT')::int as "discoveredEventCount",
           count(distinct eligible.id) filter (where eligible.eligible and eligible.entity_type = 'PLACE')::int as "eligiblePlaceCount",
           count(distinct eligible.id) filter (where eligible.eligible and eligible.entity_type = 'EVENT')::int as "eligibleEventCount",
           count(distinct document.id) filter (where eligible.eligible)::int as "activeSearchDocumentCount",
           count(distinct embedding.id) filter (where eligible.eligible)::int as "compatibleReadyEmbeddingCount",
           coalesce((select jsonb_object_agg(key, entity_count order by key)
                       from source_counts where taxonomy_node_id = node.id), '{}'::jsonb) as "sourceBreakdown"
      from app.taxonomy_nodes as node
      left join app.taxonomy_nodes as parent on parent.id = node.parent_id
      left join expanded on expanded.taxonomy_node_id = node.id
      left join eligible on eligible.id = expanded.entity_id
      left join app.search_documents as document on document.entity_id = eligible.id and document.is_active
      left join app.compatible_ready_embeddings_v as embedding on embedding.entity_id = eligible.id
     where node.active and node.taxonomy_version = 'active-going-out.v1'
     group by node.id, parent.slug
     order by node.path, node.id
  `, [generatedAt])).rows;

  const duplicateCandidatesByState = (await client.query(`
    select status::text as state, count(*)::int as count
      from app.duplicate_candidates
     group by status
     order by status
  `)).rows;

  const publicationBlockers = (await client.query(`
    with record_evidence as (
      select record.id as source_record_id, source.key as source_key, record.external_key,
             record.canonical_entity_id, record.current_version_id, record.current_parse_attempt_id,
             version.content_status, attempt.status as attempt_status,
             attempt.source_record_version_id as attempt_version_id
        from app.source_records as record
        join app.sources as source on source.id = record.source_id
        left join app.source_record_versions as version on version.id = record.current_version_id
        left join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
       where source.key in ('OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM', 'JONKOPING_EVENT_CALENDAR')
    )
    select evidence.source_key as "sourceKey", evidence.external_key as "externalKey",
           evidence.source_record_id as "sourceRecordId", entity.id as "canonicalEntityId",
           entity.canonical_name as "canonicalName", entity.entity_type::text as "entityType",
           entity.publication_status::text as "publicationStatus",
           array_remove(array[
             case when evidence.current_version_id is null then 'NO_SELECTED_VERSION' end,
             case when evidence.current_parse_attempt_id is null then 'NO_SELECTED_PARSE_ATTEMPT' end,
             case when evidence.content_status is distinct from 'AVAILABLE' then 'CURRENT_VERSION_UNAVAILABLE' end,
             case when evidence.attempt_status is distinct from 'SUCCEEDED' or evidence.attempt_version_id is distinct from evidence.current_version_id then 'NO_CURRENT_SUCCESSFUL_H+A' end,
             case when evidence.canonical_entity_id is null then 'NOT_CANONICALIZED' end,
             case when entity.entity_type = 'PLACE' and place.location is null then 'MISSING_LOCATION' end,
             case when entity.entity_type = 'PLACE' and place.location is not null
                    and (boundary.id is null or not boundary.is_active or not extensions.st_covers(boundary.boundary, place.location::extensions.geometry))
                  then 'OUTSIDE_ACTIVE_BOUNDARY' end,
             case when entity.entity_type = 'PLACE' and place.status = 'CLOSED' then 'PLACE_CLOSED' end,
             case when entity.id is not null and not exists (
                    select 1 from app.entity_taxonomy_memberships as membership
                    join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
                    where membership.entity_id = entity.id and membership.active and node.active)
                  then 'MISSING_SUPPORTED_TAXONOMY' end,
             case when entity.entity_type = 'PLACE' and not exists (
                    select 1 from app.canonical_fact_provenance as provenance
                    where provenance.entity_id = entity.id and provenance.fact_key = 'canonical_name' and provenance.is_current)
                  then 'MISSING_CANONICAL_NAME_PROVENANCE' end,
             case when entity.entity_type = 'PLACE' and not exists (
                    select 1 from app.canonical_fact_provenance as provenance
                    where provenance.entity_id = entity.id and provenance.fact_key = 'location' and provenance.is_current)
                  then 'MISSING_LOCATION_PROVENANCE' end,
             case when exists (
                    select 1 from app.duplicate_candidates as candidate
                    where (candidate.record_a_id = evidence.source_record_id or candidate.record_b_id = evidence.source_record_id)
                      and candidate.status in ('OPEN', 'UNSURE'))
                  then 'UNRESOLVED_DUPLICATE_REVIEW' end,
             case when entity.id is not null and not exists (
                    select 1 from app.search_documents as document where document.entity_id = entity.id and document.is_active)
                  then 'NO_ACTIVE_SEARCH_DOCUMENT' end
           ], null) as reasons
      from record_evidence as evidence
      left join app.canonical_entities as entity on entity.id = evidence.canonical_entity_id
      left join app.places as place on place.entity_id = entity.id
      left join app.geographic_scope_boundaries as boundary on boundary.id = entity.scope_boundary_id
     where entity.publication_status is distinct from 'PUBLISHED'
        or not exists (select 1 from app.search_documents as document where document.entity_id = entity.id and document.is_active)
     order by evidence.source_key, evidence.external_key
  `)).rows;

  const eventCoverageFromDatabase = (await client.query(`
    select
      count(record.id)::int as "fetchedSourceEventCount",
      count(record.id) filter (where record.current_version_id is not null and record.current_parse_attempt_id is not null and attempt.status = 'SUCCEEDED')::int as "acceptedSingleOccurrenceCount",
      coalesce(sum(run.invalid), 0)::int as "invalidOrUnsupportedCountAcrossRuns",
      count(distinct entity.id) filter (where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null)::int as "publishedEventCount",
      count(distinct event.entity_id) filter (where event.venue_place_id is not null)::int as "linkedEventPlaceCount",
      count(distinct event.entity_id) filter (where event.venue_place_id is null)::int as "standaloneEventCount",
      count(distinct document.entity_id)::int as "activeEventSearchDocumentCount",
      count(distinct entity.id) filter (
        where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
          and event.status = 'SCHEDULED'
          and case when event.ends_at is null then event.starts_at >= $1::timestamptz
                   else event.ends_at > $1::timestamptz end
      )::int as "eligibleAtFrozenDevClock"
      from app.sources as source
      left join app.source_records as record on record.source_id = source.id
      left join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      left join app.canonical_entities as entity on entity.id = record.canonical_entity_id
      left join app.events as event on event.entity_id = entity.id
      left join app.search_documents as document on document.entity_id = entity.id and document.is_active
      left join lateral (
        select sum(ingestion.invalid)::int as invalid
          from app.ingestion_runs as ingestion where ingestion.source_id = source.id
      ) as run on true
     where source.key = 'JONKOPING_EVENT_CALENDAR'
     group by run.invalid
  `, [frozenClockUtc])).rows[0] ?? {
    fetchedSourceEventCount: 0, acceptedSingleOccurrenceCount: 0,
    invalidOrUnsupportedCountAcrossRuns: 0, publishedEventCount: 0,
    linkedEventPlaceCount: 0, standaloneEventCount: 0,
    activeEventSearchDocumentCount: 0, eligibleAtFrozenDevClock: 0,
  };
  const eventCoverage = eventAdapterEvidence === null ? eventCoverageFromDatabase : {
    ...eventCoverageFromDatabase,
    retainedSourceEventRecordCount: eventCoverageFromDatabase.fetchedSourceEventCount,
    fetchedSourceEventCount: eventAdapterEvidence.remoteFetched,
    acceptedSingleOccurrenceCount: eventAdapterEvidence.acceptedSingleOccurrence,
    unsupportedMultiOccurrenceCount: eventAdapterEvidence.unsupportedMultiOccurrence,
    invalidCount: eventAdapterEvidence.invalid,
    invalidOrUnsupportedCount: eventAdapterEvidence.unsupportedMultiOccurrence + eventAdapterEvidence.invalid,
    sourceRunId: eventAdapterEvidence.runId,
  };

  const embeddingStates = (await client.query(`
    select status::text as status, count(*)::int as count
      from app.embeddings
     group by status
     order by status
  `)).rows;

  const dataQualityAudit = (await client.query(`
    select
      (select count(*)::int from app.canonical_entities
        where canonical_name in ('Explicit Indian Restaurant', 'Municipal Utegym One')
           or canonical_name = 'COVERAGE-01 publication fixture'
           or canonical_name ~ '^Municipal Event [0-9a-f]{8}$') as "fixtureShapedCanonicalNames",
      (select count(*)::int from app.sources where key like 'src03b-place-%' or licence = 'TEST-FIXTURE-ONLY') as "fixtureSources",
      (select count(*)::int from (
        select canonical_name_norm, extensions.st_astext(place.location::extensions.geometry)
          from app.canonical_entities as entity
          join app.places as place on place.entity_id = entity.id
         where entity.merged_into_id is null
         group by canonical_name_norm, extensions.st_astext(place.location::extensions.geometry)
        having count(*) > 1
      ) as duplicates) as "sameNameSameLocationCanonicalGroups",
      (select count(*)::int from (
        select source_id, external_key from app.source_records group by source_id, external_key having count(*) > 1
      ) as duplicates) as "sameSourceIdentityDuplicateGroups"
  `)).rows[0];

  await client.query('commit');

  const supplyBySlug = new Map(coverage.leaves.map((leaf) => [leaf.leafSlug, leaf]));
  const nodes = taxonomyNodes.map((node) => {
    const supply = supplyBySlug.get(node.slug as string);
    return {
      ...node,
      supplyStatus: supply?.status ?? null,
      supplyStopReason: supply?.stopReason ?? null,
      supplyNotes: supply?.notes ?? null,
    };
  });
  const leaves = coverage.leaves.map((leaf) => ({
    slug: leaf.leafSlug,
    discovered: (() => {
      const node = nodes.find((candidate) => candidate.slug === leaf.leafSlug);
      return Number(node?.discoveredPlaceCount ?? 0) + Number(node?.discoveredEventCount ?? 0);
    })(),
    publishedSearchable: leaf.canonicalPublishedCount,
    sourceBreakdown: nodes.find((node) => node.slug === leaf.leafSlug)?.sourceBreakdown ?? {},
    status: leaf.status,
    stopReason: leaf.stopReason,
    reason: leaf.notes,
  }));
  const leafBands = {
    atLeastFive: leaves.filter((leaf) => leaf.publishedSearchable >= 5).length,
    oneToFour: leaves.filter((leaf) => leaf.publishedSearchable >= 1 && leaf.publishedSearchable <= 4).length,
    zero: leaves.filter((leaf) => leaf.publishedSearchable === 0).length,
  };
  report = {
    reportVersion: 'coverage-01-audit.v1', label, generatedAt, frozenClockUtc,
    coverageIdentity: {
      version: coverage.coverageVersion,
      taxonomyVersion: coverage.taxonomyVersion,
      taxonomyChecksum: coverage.taxonomyChecksum,
      boundaryVersion: coverage.boundaryVersion,
      contentChecksum: coverage.contentChecksum,
    },
    overall, stageFunnel, taxonomyNodes: nodes, leaves, leafBands,
    duplicateCandidatesByState, publicationBlockers, eventCoverage,
    embeddingStates, dataQualityAudit,
  };
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

const checksum = createHash('sha256').update(JSON.stringify(report)).digest('hex');
const document = { ...report, reportChecksum: checksum };
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, `${label}.json`), `${JSON.stringify(document, null, 2)}\n`),
  writeFile(resolve(outputDirectory, `${label}.md`), renderMarkdown(document as unknown as RenderableAudit)),
]);
console.log(JSON.stringify({ label, reportChecksum: checksum, outputDirectory }));

function option(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`missing value for ${name}`);
  return value;
}

function readEventAdapterEvidence(value: unknown): {
  runId: string;
  remoteFetched: number;
  acceptedSingleOccurrence: number;
  unsupportedMultiOccurrence: number;
  invalid: number;
} {
  if (typeof value !== 'object' || value === null || !Array.isArray(Reflect.get(value, 'sources'))) {
    throw new Error('invalid source-run evidence');
  }
  const event = Reflect.get(value, 'sources').find((source: unknown) => (
    typeof source === 'object' && source !== null
      && Reflect.get(source, 'sourceKey') === 'JONKOPING_EVENT_CALENDAR'
  ));
  if (typeof event !== 'object' || event === null) throw new Error('missing Event source-run evidence');
  const result = {
    runId: Reflect.get(event, 'runId'),
    remoteFetched: Reflect.get(event, 'remoteFetched'),
    acceptedSingleOccurrence: Reflect.get(event, 'acceptedSingleOccurrence'),
    unsupportedMultiOccurrence: Reflect.get(event, 'unsupportedMultiOccurrence'),
    invalid: Reflect.get(event, 'invalid'),
  };
  if (typeof result.runId !== 'string' || [
    result.remoteFetched, result.acceptedSingleOccurrence,
    result.unsupportedMultiOccurrence, result.invalid,
  ].some((count) => !Number.isInteger(count) || count < 0)) {
    throw new Error('invalid Event source-run counters');
  }
  return result as {
    runId: string;
    remoteFetched: number;
    acceptedSingleOccurrence: number;
    unsupportedMultiOccurrence: number;
    invalid: number;
  };
}

type RenderableAudit = {
  label: string;
  generatedAt: string;
  frozenClockUtc: string;
  reportChecksum: string;
  overall: unknown;
  stageFunnel: unknown;
  leafBands: unknown;
  duplicateCandidatesByState: unknown;
  eventCoverage: unknown;
  embeddingStates: unknown;
  dataQualityAudit: unknown;
  taxonomyNodes: Array<{
    id: string;
    slug: string;
    parentSlug: string | null;
    discoveredPlaceCount: number;
    discoveredEventCount: number;
    eligiblePlaceCount: number;
    eligibleEventCount: number;
    activeSearchDocumentCount: number;
    compatibleReadyEmbeddingCount: number;
    sourceBreakdown: unknown;
    supplyStatus: string | null;
  }>;
  publicationBlockers: Array<{
    sourceKey: string;
    externalKey: string;
    canonicalName: string | null;
    reasons: string[];
  }>;
};

function renderMarkdown(document: RenderableAudit): string {
  const rows = document.taxonomyNodes.map((node) => (
    `| ${node.id} | ${node.slug} | ${node.parentSlug ?? 'ROOT'} | ${node.eligiblePlaceCount} | ${node.eligibleEventCount} | ${node.activeSearchDocumentCount} | ${node.compatibleReadyEmbeddingCount} | ${JSON.stringify(node.sourceBreakdown)} | ${node.supplyStatus ?? 'PARENT'} |`
  )).join('\n');
  const blockers = document.publicationBlockers.length === 0
    ? '_None._'
    : document.publicationBlockers.map((row) => (
      `- ${row.sourceKey}/${row.externalKey}: ${row.canonicalName ?? 'uncanonicalized'} — ${row.reasons.join(', ') || 'UNCLASSIFIED_BLOCKER'}`
    )).join('\n');
  return `# COVERAGE-01 inventory audit — ${document.label}\n\n`
    + `- Generated: \`${document.generatedAt}\`\n`
    + `- Frozen DEV clock: \`${document.frozenClockUtc}\`\n`
    + `- Report checksum: \`${document.reportChecksum}\`\n`
    + `- Overall: \`${JSON.stringify(document.overall)}\`\n`
    + `- Stage funnel: \`${JSON.stringify(document.stageFunnel)}\`\n`
    + `- Leaf bands: \`${JSON.stringify(document.leafBands)}\`\n`
    + `- Duplicate states: \`${JSON.stringify(document.duplicateCandidatesByState)}\`\n`
    + `- Event coverage: \`${JSON.stringify(document.eventCoverage)}\`\n`
    + `- Embeddings: \`${JSON.stringify(document.embeddingStates)}\`\n`
    + `- Data-quality audit: \`${JSON.stringify(document.dataQualityAudit)}\`\n\n`
    + `## Active taxonomy nodes\n\n`
    + `| Node ID | Slug | Parent | Places | Events | Active docs | Compatible READY | Sources | Supply status |\n`
    + `|---|---|---|---:|---:|---:|---:|---|---|\n${rows}\n\n`
    + `## Publication blockers\n\n${blockers}\n`;
}
