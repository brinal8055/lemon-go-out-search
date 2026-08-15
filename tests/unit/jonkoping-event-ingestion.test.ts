import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ensureFixtureSource,
  fixtureDatabaseUrl,
  FixtureParseError,
  FixtureSourceAdapter,
  IngestionRunError,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  runIngestion,
  type AdapterConfig,
  type FetchResult,
  type NormalizedSourceRecord,
  type SourceAdapter,
  type SourceObservation,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import {
  prepareLocalSearchDocumentRuntime,
  rebuildSearchDocuments,
} from '../../packages/search-documents/src/index.ts';
import {
  classifyEventDetail,
  JONKOPING_EVENT_MAPPING_REF,
  JONKOPING_EVENT_REFRESH_MODE,
  JonkopingEventAdapter,
  type PermittedEventOccurrence,
} from '../../packages/source-adapters/src/jonkoping-events.ts';

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const now = () => new Date('2026-08-15T08:00:00.000Z');
const baseStart = Date.parse('2026-08-20T18:00:00+02:00');
const baseEnd = Date.parse('2026-08-20T20:00:00+02:00');

class StaticEventAdapter implements SourceAdapter {
  readonly config: AdapterConfig;
  readonly #occurrences: Array<Record<string, unknown>>;
  readonly #normalizer: JonkopingEventAdapter;
  readonly #reject: boolean;
  readonly #failFetch: boolean;
  readonly #observedAt: string;

  constructor(input: {
    occurrences?: Array<Record<string, unknown>>;
    parserVersion?: string;
    deterministicVenueLinks?: ReadonlyMap<string, string>;
    reject?: boolean;
    failFetch?: boolean;
    observedAt?: string;
  } = {}) {
    this.config = {
      sourceKey: 'JONKOPING_EVENT_CALENDAR',
      sourceName: 'Jönköping municipality Event Calendar',
      scopeSlug: 'jonkoping-municipality',
      adapterVersion: 'jonkoping-event-v1',
      parserVersion: input.parserVersion ?? 'jonkoping-event-parser-v1',
      mappingVersion: 'source-taxonomy.v1',
      refreshMode: 'DELTA_ONLY',
    };
    this.#occurrences = input.occurrences ?? [];
    this.#normalizer = new JonkopingEventAdapter({
      now,
      deterministicVenueLinks: input.deterministicVenueLinks,
    });
    this.#reject = input.reject ?? false;
    this.#failFetch = input.failFetch ?? false;
    this.#observedAt = input.observedAt ?? now().toISOString();
  }

  async fetch(): Promise<FetchResult> {
    if (this.#failFetch) throw new Error('fixture source outage');
    return {
      observations: this.#occurrences.map((envelope) => ({
        externalKey: String(envelope.externalKey),
        sourceUrl: String(envelope.sourceUrl),
        fetchedAt: this.#observedAt,
        observedAt: this.#observedAt,
        envelope,
      })),
      refreshUnitComplete: true,
      snapshotComplete: null,
      fetchMeta: { fixture: 'SRC-03B', recordCount: this.#occurrences.length },
    };
  }

  externalStableId(raw: SourceObservation): string {
    return this.#normalizer.externalStableId(raw);
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return this.#normalizer.captureEnvelope(raw);
  }

  parse(captured: Record<string, unknown>, observation: SourceObservation): NormalizedSourceRecord {
    if (this.#reject) throw new FixtureParseError('EVENT_FIXTURE_REJECTED', 'injected parser rejection');
    return this.#normalizer.parse(captured, observation);
  }
}

function occurrence(
  uuid = randomUUID(),
  overrides: Partial<PermittedEventOccurrence> = {},
): PermittedEventOccurrence {
  return {
    sourceEventUuid: uuid,
    externalKey: `event/${uuid}`,
    title: `Municipal Event ${uuid.slice(0, 8)}`,
    start: new Date(baseStart).toISOString(),
    end: new Date(baseEnd).toISOString(),
    timeZone: 'Europe/Stockholm',
    venueName: 'Rådhusparken',
    city: 'Jönköping',
    address: 'Rådhusparken 1',
    latitude: 57.7814,
    longitude: 14.1618,
    categories: ['Musik'],
    sourceUrl: `https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/${uuid}`,
    status: null,
    ...overrides,
  };
}

beforeAll(async () => {
  await prepareLocalIngestionRuntime(connectionString);
  await prepareLocalSearchDocumentRuntime(connectionString);
  const [source] = await fixtureQuery<{
    enabled: boolean;
    refresh_mode: string;
    persistence_permission: string;
    adapter_version: string;
    rate_limit_requests: number;
  }>(connectionString, `
    select enabled, refresh_mode::text, persistence_permission,
           adapter_version, rate_limit_requests
    from app.sources where key = 'JONKOPING_EVENT_CALENDAR'
  `);
  expect(source).toEqual({
    enabled: true,
    refresh_mode: 'DELTA_ONLY',
    persistence_permission: 'EXTRACTED_FIELDS_ONLY',
    adapter_version: 'jonkoping-event-v1',
    rate_limit_requests: 11,
  });
});

afterAll(async () => {
  await store.close();
});

describe('SRC-03B bounded Event canonicalization', () => {
  it('takes one standalone occurrence through all six stages and reruns without duplicate identity', async () => {
    const raw = occurrence();
    const first = await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    await rebuildSearchDocuments(connectionString);
    const before = await eventState(raw.externalKey);
    const rerun = await runIngestion(store, new StaticEventAdapter({
      occurrences: [raw], observedAt: '2026-08-15T09:00:00.000Z',
    }));
    await rebuildSearchDocuments(connectionString);
    const after = await eventState(raw.externalKey);

    expect(first.stageTrace.map(({ stage }) => stage)).toEqual([
      'fetch', 'capture/version', 'parse/validate', 'resolve',
      'canonical/taxonomy', 'projection/publication',
    ]);
    expect(first.counters).toMatchObject({ fetched: 1, newCount: 1, valid: 1, canonicalApplied: 1, published: 1 });
    expect(rerun.counters).toMatchObject({ unchanged: 1, canonicalApplied: 0 });
    expect(after).toMatchObject({
      record_count: 1,
      version_count: 1,
      attempt_count: 1,
      entity_count: 1,
      entity_type: 'EVENT',
      status: 'SCHEDULED',
      status_method: 'MANUAL',
      publication_status: 'PUBLISHED',
      taxonomy_slug: 'events',
      mapping_ref: JONKOPING_EVENT_MAPPING_REF,
      boundary_covered: true,
      active_documents: 1,
    });
    expect(after.canonical_entity_id).toBe(before.canonical_entity_id);
    expect(after.current_version_id).toBe(before.current_version_id);
    expect(after.current_parse_attempt_id).toBe(before.current_parse_attempt_id);
    expect(after.provenance_keys).toEqual([
      'address', 'canonical_name', 'event_end', 'event_start', 'event_status', 'location',
    ]);
  });

  it('updates schedule and exact provenance while retaining Lemon identity and history', async () => {
    const raw = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const before = await eventState(raw.externalKey);
    const moved = occurrence(raw.sourceEventUuid, {
      start: new Date(baseStart + 86_400_000).toISOString(),
      end: new Date(baseEnd + 86_400_000).toISOString(),
    });
    const updated = await runIngestion(store, new StaticEventAdapter({
      occurrences: [moved], observedAt: '2026-08-16T08:00:00.000Z',
    }));
    const after = await eventState(raw.externalKey);
    const history = await fixtureQuery<{ fact_key: string; versions: number; current_rows: number }>(connectionString, `
      select fact_key::text, count(distinct source_record_version_id)::int as versions,
             count(*) filter (where is_current)::int as current_rows
      from app.canonical_fact_provenance
      where entity_id = $1 and fact_key in ('event_start', 'event_end', 'event_status')
      group by fact_key order by fact_key
    `, [after.canonical_entity_id]);

    expect(updated.counters).toMatchObject({ changed: 1, canonicalApplied: 1 });
    expect(after.canonical_entity_id).toBe(before.canonical_entity_id);
    expect(after.current_version_id).not.toBe(before.current_version_id);
    expect(after.starts_at.toISOString()).toBe(moved.start);
    expect(after.ends_at?.toISOString()).toBe(moved.end);
    expect(history).toEqual([
      { fact_key: 'event_end', versions: 2, current_rows: 1 },
      { fact_key: 'event_start', versions: 2, current_rows: 1 },
      { fact_key: 'event_status', versions: 2, current_rows: 1 },
    ]);
  });

  it('captures failed newer H first and preserves the prior selected H+A and canonical truth', async () => {
    const raw = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const before = await eventState(raw.externalKey);
    const failedRaw = occurrence(raw.sourceEventUuid, { title: 'Rejected Event Update' });
    const failed = await runIngestion(store, new StaticEventAdapter({ occurrences: [failedRaw], reject: true }));
    const after = await eventState(raw.externalKey);

    expect(failed.status).toBe('PARTIAL');
    expect(failed.counters).toMatchObject({ changed: 1, invalid: 1, canonicalApplied: 0 });
    expect(after.current_version_id).toBe(before.current_version_id);
    expect(after.current_parse_attempt_id).toBe(before.current_parse_attempt_id);
    expect(after.canonical_name).toBe(before.canonical_name);
    expect(after.version_count).toBe(2);
    expect(after.failed_attempts).toBe(1);
  });

  it('replays the same immutable H with a new parser attempt and no replacement version', async () => {
    const raw = occurrence();
    const first = await runIngestion(store, new StaticEventAdapter({
      occurrences: [raw], parserVersion: 'event-parser-replay-a1', reject: true,
    }));
    const second = await runIngestion(store, new StaticEventAdapter({
      occurrences: [raw], parserVersion: 'event-parser-replay-a2',
    }));
    const state = await eventState(raw.externalKey);

    expect(first.status).toBe('PARTIAL');
    expect(second.status).toBe('SUCCEEDED');
    expect(state).toMatchObject({ version_count: 1, attempt_count: 2, failed_attempts: 1, succeeded_attempts: 1 });
  });

  it('allows source-current H+A to advance while an invalid canonical update leaves last-good truth intact', async () => {
    const raw = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const before = await eventState(raw.externalKey);
    const outside = occurrence(raw.sourceEventUuid, {
      title: 'Outside Boundary Update', latitude: 56, longitude: 14,
    });

    await expect(runIngestion(store, new StaticEventAdapter({ occurrences: [outside] })))
      .rejects.toBeInstanceOf(IngestionRunError);
    const after = await eventState(raw.externalKey);
    expect(after.current_version_id).not.toBe(before.current_version_id);
    expect(after.current_parse_attempt_id).not.toBe(before.current_parse_attempt_id);
    expect(after.canonical_name).toBe(before.canonical_name);
    expect(after.starts_at).toEqual(before.starts_at);
  });

  it('supports explicit deterministic Place linking and never links a same-named venue heuristically', async () => {
    const placeSource = `src03b-place-${randomUUID()}`;
    const placeAdapter = new FixtureSourceAdapter({
      sourceKey: placeSource,
      records: [{
        externalKey: 'venue-place', name: 'Rådhusparken', latitude: 57.7814,
        longitude: 14.1618, taxonomySlug: 'culture',
      }],
    });
    await ensureFixtureSource(connectionString, placeAdapter.config);
    await runIngestion(store, placeAdapter);
    const [place] = await fixtureQuery<{ id: string; record_id: string; version_id: string; attempt_id: string }>(connectionString, `
      select entity.id, record.id as record_id, record.current_version_id as version_id,
             record.current_parse_attempt_id as attempt_id
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      join app.canonical_entities as entity on entity.id = record.canonical_entity_id
      where source.key = $1 and record.external_key = 'venue-place'
    `, [placeSource]);
    for (const factKey of ['canonical_name', 'location']) {
      await fixtureQuery(connectionString, `
        select app.replace_targeted_canonical_fact(
          $1, $2::app.fact_key,
          app.extract_targeted_fact(attempt.normalized_output, $2::app.fact_key, 'PLACE'),
          $3, 'SOURCE_PRECEDENCE', 'SRC-03B-LINK-FIXTURE', 'deterministic linked Place fixture'
        )
        from app.source_record_parse_attempts as attempt where attempt.id = $4
      `, [place.id, factKey, place.version_id, place.attempt_id]);
    }
    await fixtureQuery(connectionString, `
      update app.canonical_entities set publication_status = 'PUBLISHED', published_at = now() where id = $1
    `, [place.id]);

    const standalone = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [standalone] }));
    const linked = occurrence(randomUUID(), { latitude: null, longitude: null });
    await runIngestion(store, new StaticEventAdapter({
      occurrences: [linked], deterministicVenueLinks: new Map([[linked.externalKey, place.id]]),
    }));
    await rebuildSearchDocuments(connectionString);
    const standaloneState = await eventState(standalone.externalKey);
    const linkedState = await eventState(linked.externalKey);

    expect(standaloneState.venue_place_id).toBeNull();
    expect(linkedState.venue_place_id).toBe(place.id);
    expect(linkedState.location_present).toBe(false);
    expect(linkedState.boundary_covered).toBe(true);
    expect(linkedState.active_documents).toBe(1);
  });

  it('blocks standalone publication without effective location and does not invent duration', async () => {
    const raw = occurrence(randomUUID(), {
      end: null, latitude: null, longitude: null,
    });
    const result = await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const [counts] = await fixtureQuery<{ versions: number; attempts: number; entities: number }>(connectionString, `
      select count(distinct version.id)::int as versions,
             count(distinct attempt.id)::int as attempts,
             count(distinct record.canonical_entity_id)::int as entities
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      join app.source_record_versions as version on version.source_record_id = record.id
      left join app.source_record_parse_attempts as attempt on attempt.source_record_version_id = version.id
      where source.key = 'JONKOPING_EVENT_CALENDAR' and record.external_key = $1
    `, [raw.externalKey]);
    expect(result.status).toBe('PARTIAL');
    expect(counts).toEqual({ versions: 1, attempts: 1, entities: 0 });

    const point = occurrence(randomUUID(), { end: null });
    await runIngestion(store, new StaticEventAdapter({ occurrences: [point] }));
    expect((await eventState(point.externalKey)).ends_at).toBeNull();
  });

  it('applies explicit cancellation with source provenance and DELTA absence/outage never changes it', async () => {
    const raw = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const scheduled = await eventState(raw.externalKey);
    const cancelledRaw = occurrence(raw.sourceEventUuid, { status: 'CANCELLED' });
    await runIngestion(store, new StaticEventAdapter({
      occurrences: [cancelledRaw], observedAt: '2026-08-16T08:00:00.000Z',
    }));
    const cancelled = await eventState(raw.externalKey);
    const absent = await runIngestion(store, new StaticEventAdapter({ occurrences: [] }));
    await expect(runIngestion(store, new StaticEventAdapter({ failFetch: true })))
      .rejects.toBeInstanceOf(IngestionRunError);
    const after = await eventState(raw.externalKey);

    expect(cancelled.canonical_entity_id).toBe(scheduled.canonical_entity_id);
    expect(cancelled).toMatchObject({
      status: 'CANCELLED', status_method: 'SOURCE_PRECEDENCE', publication_status: 'WITHHELD',
    });
    expect(cancelled.status_history).toBe(2);
    expect(absent.counters.disappeared).toBe(0);
    expect(after.status).toBe('CANCELLED');
    expect(after.is_missing).toBe(false);
  });

  it('classifies 1→N as ambiguous and preserves the selected evidence and Event unchanged', async () => {
    const raw = occurrence();
    await runIngestion(store, new StaticEventAdapter({ occurrences: [raw] }));
    const before = await eventState(raw.externalKey);
    const hit = {
      id: 'page-id', title: raw.title, url: raw.sourceUrl,
      structuredStartDate: raw.start, structuredEndDate: raw.end ?? undefined,
      locationCoordinates: `${raw.latitude}, ${raw.longitude}`,
    };
    const query = new URLSearchParams({
      'event.id': raw.sourceEventUuid,
      'event.name': raw.title,
      'event.placeName': raw.venueName ?? '',
      'event.city': raw.city ?? '',
      'event.street': raw.address ?? '',
      'date.startDates': `${baseStart},${baseStart + 86_400_000}`,
      'date.endDates': `${baseEnd},${baseEnd + 86_400_000}`,
    });
    const classified = classifyEventDetail(
      hit,
      `<p>https://www.jonkoping.se/evenemangskalender/skapa-evenemang?${query.toString().replaceAll('&', '&amp;')}</p>`,
      true,
    );
    const after = await eventState(raw.externalKey);

    expect(classified).toMatchObject({ classification: 'IDENTITY_BECAME_AMBIGUOUS', event: null });
    expect(after.current_version_id).toBe(before.current_version_id);
    expect(after.current_parse_attempt_id).toBe(before.current_parse_attempt_id);
    expect(after.canonical_entity_id).toBe(before.canonical_entity_id);
    expect(after.starts_at).toEqual(before.starts_at);
  });

  it('keeps refresh health run-derived under DELTA_ONLY semantics', async () => {
    const before = await fixtureQuery<{ last_successful_refresh: Date | null }>(connectionString, `
      select last_successful_refresh from app.sources where key = 'JONKOPING_EVENT_CALENDAR'
    `);
    const run = await runIngestion(store, new StaticEventAdapter({ occurrences: [] }));
    const [after] = await fixtureQuery<{ last_successful_refresh: Date; derived: Date }>(connectionString, `
      select source.last_successful_refresh,
             max(run.finished_at) filter (
               where run.status = 'SUCCEEDED' and run.refresh_unit_complete
             ) as derived
      from app.sources as source
      join app.ingestion_runs as run on run.source_id = source.id
      where source.key = 'JONKOPING_EVENT_CALENDAR'
      group by source.id
    `);
    expect(run.status).toBe('SUCCEEDED');
    expect(after.last_successful_refresh).toEqual(after.derived);
    expect(after.last_successful_refresh.getTime()).toBeGreaterThanOrEqual(before[0].last_successful_refresh?.getTime() ?? 0);
    expect(JONKOPING_EVENT_REFRESH_MODE).toBe('DELTA_ONLY');
  });
});

type EventState = {
  canonical_entity_id: string;
  canonical_name: string;
  current_version_id: string;
  current_parse_attempt_id: string;
  starts_at: Date;
  ends_at: Date | null;
  status: string;
  venue_place_id: string | null;
  location_present: boolean;
  entity_type: string;
  publication_status: string;
  status_method: string;
  taxonomy_slug: string;
  mapping_ref: string;
  boundary_covered: boolean;
  provenance_keys: string[];
  record_count: number;
  version_count: number;
  attempt_count: number;
  entity_count: number;
  failed_attempts: number;
  succeeded_attempts: number;
  status_history: number;
  active_documents: number;
  is_missing: boolean;
};

async function eventState(externalKey: string): Promise<EventState> {
  const [state] = await fixtureQuery<EventState>(connectionString, `
    select record.canonical_entity_id, entity.canonical_name,
           record.current_version_id, record.current_parse_attempt_id,
           event.starts_at, event.ends_at, event.status::text,
           event.venue_place_id, event.location is not null as location_present,
           entity.entity_type::text, entity.publication_status::text,
           status_provenance.selection_method as status_method,
           taxonomy.slug as taxonomy_slug, membership.mapping_ref,
           extensions.st_covers(
             boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry
           ) as boundary_covered,
           array_agg(distinct provenance.fact_key::text order by provenance.fact_key::text)
             filter (where provenance.is_current) as provenance_keys,
           count(distinct record.id)::int as record_count,
           count(distinct version.id)::int as version_count,
           count(distinct attempt.id)::int as attempt_count,
           count(distinct record.canonical_entity_id)::int as entity_count,
           count(distinct attempt.id) filter (where attempt.status = 'FAILED')::int as failed_attempts,
           count(distinct attempt.id) filter (where attempt.status = 'SUCCEEDED')::int as succeeded_attempts,
           count(distinct status_history.id)::int as status_history,
           count(distinct document.id) filter (where document.is_active)::int as active_documents,
           record.is_missing
    from app.source_records as record
    join app.sources as source on source.id = record.source_id
    join app.source_record_versions as version on version.source_record_id = record.id
    left join app.source_record_parse_attempts as attempt on attempt.source_record_version_id = version.id
    join app.canonical_entities as entity on entity.id = record.canonical_entity_id
    join app.events as event on event.entity_id = entity.id
    left join app.places as venue on venue.entity_id = event.venue_place_id
    join app.geographic_scope_boundaries as boundary on boundary.id = entity.scope_boundary_id
    join app.entity_taxonomy_memberships as membership on membership.entity_id = entity.id and membership.active
    join app.taxonomy_nodes as taxonomy on taxonomy.id = membership.taxonomy_node_id
    join app.canonical_fact_provenance as provenance on provenance.entity_id = entity.id
    join app.canonical_fact_provenance as status_provenance
      on status_provenance.entity_id = entity.id
      and status_provenance.fact_key = 'event_status' and status_provenance.is_current
    join app.canonical_fact_provenance as status_history
      on status_history.entity_id = entity.id and status_history.fact_key = 'event_status'
    left join app.search_documents as document on document.entity_id = entity.id
    where source.key = 'JONKOPING_EVENT_CALENDAR' and record.external_key = $1
    group by record.id, entity.id, event.entity_id, venue.entity_id, boundary.id,
             status_provenance.id, taxonomy.id, membership.id
  `, [externalKey]);
  if (!state) throw new Error(`Event state missing for ${externalKey}`);
  return state;
}
