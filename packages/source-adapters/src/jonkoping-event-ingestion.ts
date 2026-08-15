import pg from 'pg';
import {
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  runIngestion,
} from '@lemon/ingestion-domain';
import {
  prepareLocalSearchDocumentRuntime,
  rebuildSearchDocuments,
} from '@lemon/search-documents';
import {
  JONKOPING_EVENT_SOURCE_KEY,
  JonkopingEventAdapter,
  type JonkopingEventAdapterOptions,
} from './jonkoping-events.ts';

const { Client } = pg;

export type CanonicalEventEvidence = {
  externalKey: string;
  sourceRecordId: string;
  sourceRecordVersionId: string;
  sourceRecordParseAttemptId: string;
  canonicalEntityId: string;
  canonicalName: string;
  startsAt: Date;
  endsAt: Date | null;
  sourceTimezone: string;
  status: string;
  venuePlaceId: string | null;
  standaloneVenueName: string | null;
  streetAddress: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  boundaryCovered: boolean;
  taxonomySlugs: string[];
  provenance: Array<{ factKey: string; method: string; versionId: string }>;
  publicationStatus: string;
  searchDocumentId: string | null;
};

export type EventRefreshReport = {
  runId: string;
  status: string;
  fetched: number;
  acceptedSingleOccurrence: number;
  unchanged: number;
  changed: number;
  skippedMultiOccurrence: number;
  identityAmbiguous: number;
  invalid: number;
  canonicalCreated: number;
  canonicalUpdated: number;
  standaloneVenue: number;
  linkedVenue: number;
  statusScheduledManual: number;
  failures: number;
  searchDocumentsChanged: number;
  events: CanonicalEventEvidence[];
};

export async function runJonkopingEventRefresh(
  connectionString: string,
  options: JonkopingEventAdapterOptions = {},
): Promise<EventRefreshReport> {
  await prepareLocalIngestionRuntime(connectionString);
  await prepareLocalSearchDocumentRuntime(connectionString);
  const previousKeys = await selectedExternalKeys(connectionString);
  const adapter = new JonkopingEventAdapter({
    ...options,
    previouslyAcceptedExternalKeys: options.previouslyAcceptedExternalKeys ?? new Set(previousKeys),
  });
  const store = new PostgresIngestionStore(connectionString);
  try {
    const result = await runIngestion(store, adapter);
    const projection = await rebuildSearchDocuments(connectionString);
    const keys = adapter.lastFetchReport?.accepted.map(({ externalKey }) => externalKey) ?? [];
    const events = await inspectCanonicalEvents(connectionString, keys);
    return {
      runId: result.runId,
      status: result.status,
      fetched: adapter.lastFetchReport?.fetchedHits ?? result.counters.fetched,
      acceptedSingleOccurrence: adapter.lastFetchReport?.accepted.length ?? 0,
      unchanged: result.counters.unchanged,
      changed: result.counters.changed,
      skippedMultiOccurrence: adapter.lastFetchReport?.multiOccurrenceSkipped ?? 0,
      identityAmbiguous: adapter.lastFetchReport?.identityAmbiguous ?? 0,
      invalid: result.counters.invalid,
      canonicalCreated: result.stageTrace.filter(({ stage, outcome }) => stage === 'canonical/taxonomy' && outcome === 'CREATED').length,
      canonicalUpdated: result.stageTrace.filter(({ stage, outcome }) => stage === 'canonical/taxonomy' && outcome === 'UPDATED').length,
      standaloneVenue: events.filter(({ venuePlaceId }) => venuePlaceId === null).length,
      linkedVenue: events.filter(({ venuePlaceId }) => venuePlaceId !== null).length,
      statusScheduledManual: events.filter(({ status, provenance }) => status === 'SCHEDULED'
        && provenance.some(({ factKey, method }) => factKey === 'event_status' && method === 'MANUAL')).length,
      failures: result.counters.invalid,
      searchDocumentsChanged: projection.contentChanges,
      events,
    };
  } finally {
    await store.close();
  }
}

export async function inspectCanonicalEvents(
  connectionString: string,
  externalKeys?: string[],
): Promise<CanonicalEventEvidence[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<CanonicalEventEvidence>(`
      select record.external_key as "externalKey",
             record.id as "sourceRecordId",
             record.current_version_id as "sourceRecordVersionId",
             record.current_parse_attempt_id as "sourceRecordParseAttemptId",
             entity.id as "canonicalEntityId",
             entity.canonical_name as "canonicalName",
             event.starts_at as "startsAt",
             event.ends_at as "endsAt",
             event.source_timezone as "sourceTimezone",
             event.status::text as status,
             event.venue_place_id as "venuePlaceId",
             event.standalone_venue_name as "standaloneVenueName",
             event.standalone_street_address as "streetAddress",
             event.standalone_locality as locality,
             extensions.st_y(event.location::extensions.geometry) as latitude,
             extensions.st_x(event.location::extensions.geometry) as longitude,
             extensions.st_covers(
               boundary.boundary,
               coalesce(venue.location, event.location)::extensions.geometry
             ) as "boundaryCovered",
             coalesce(taxonomy.slugs, '{}') as "taxonomySlugs",
             coalesce(provenance.facts, '[]'::json) as provenance,
             entity.publication_status::text as "publicationStatus",
             document.id as "searchDocumentId"
      from app.sources as source
      join app.source_records as record on record.source_id = source.id
      join app.source_record_versions as version on version.id = record.current_version_id
      join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      join app.canonical_entities as entity on entity.id = record.canonical_entity_id
      join app.events as event on event.entity_id = entity.id
      join app.geographic_scope_boundaries as boundary on boundary.id = entity.scope_boundary_id
      left join app.places as venue on venue.entity_id = event.venue_place_id
      left join app.search_documents as document on document.entity_id = entity.id and document.is_active
      left join lateral (
        select array_agg(node.slug order by node.slug) as slugs
        from app.entity_taxonomy_memberships as membership
        join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
        where membership.entity_id = entity.id and membership.active and node.active
      ) as taxonomy on true
      left join lateral (
        select json_agg(json_build_object(
          'factKey', fact.fact_key::text,
          'method', fact.selection_method,
          'versionId', fact.source_record_version_id
        ) order by fact.fact_key::text) as facts
        from app.canonical_fact_provenance as fact
        where fact.entity_id = entity.id and fact.is_current
      ) as provenance on true
      where source.key = $1
        and ($2::text[] is null or record.external_key = any($2::text[]))
        and version.content_status = 'AVAILABLE'
        and attempt.status = 'SUCCEEDED'
      order by record.external_key
    `, [JONKOPING_EVENT_SOURCE_KEY, externalKeys ?? null]);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function selectedExternalKeys(connectionString: string): Promise<string[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return (await client.query<{ external_key: string }>(`
      select record.external_key
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      where source.key = $1
        and record.current_version_id is not null
        and record.current_parse_attempt_id is not null
      order by record.external_key
    `, [JONKOPING_EVENT_SOURCE_KEY])).rows.map(({ external_key }) => external_key);
  } finally {
    await client.end();
  }
}
