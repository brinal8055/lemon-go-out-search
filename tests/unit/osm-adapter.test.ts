import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  fixtureDatabaseUrl,
  IngestionRunError,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  runIngestion,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import {
  BOUNDED_OSM_QUERY,
  JONKOPING_SCOPE_ID,
  OSM_SOURCE_KEY,
  OsmOverpassAdapter,
  extractEnvelope,
} from '../../packages/source-adapters/src/osm.ts';

type RawElement = Record<string, unknown>;

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const numericNamespace = Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 10), 16);
const fixtureUrl = new URL('../../packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json', import.meta.url);
const fixedNow = () => new Date('2026-08-14T05:27:29.263Z');

beforeAll(async () => {
  await prepareLocalIngestionRuntime(connectionString);
});

afterAll(async () => {
  await store.close();
});

function element(idOffset: number, overrides: RawElement = {}): RawElement {
  return {
    type: 'node',
    id: numericNamespace + idOffset,
    version: 1,
    timestamp: '2026-08-14T05:00:00Z',
    lat: 57.7826,
    lon: 14.1618,
    tags: { name: `SRC-01 Test ${idOffset}`, amenity: 'cafe' },
    ...overrides,
  };
}

function adapter(elements: RawElement[], options: {
  responses?: Response[];
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
} = {}): OsmOverpassAdapter {
  const responses = options.responses ? [...options.responses] : [jsonResponse({ elements })];
  const fetchImpl = async () => responses.shift() ?? jsonResponse({ elements });
  return new OsmOverpassAdapter({
    fetchImpl: fetchImpl as typeof fetch,
    sleep: options.sleep ?? (async () => undefined),
    now: options.now ?? fixedNow,
  });
}

function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

async function observations(elements: RawElement[]) {
  return (await adapter(elements).fetch({ signal: new AbortController().signal })).observations;
}

describe('SRC-01 bounded OSM adapter', () => {
  it('parses the sanitized real node fixture and retained optional facts deterministically', async () => {
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as { elements: RawElement[] };
    const [observation] = await observations(fixture.elements);
    const candidate = adapter([]).parse(observation.envelope, observation);

    expect(candidate.externalKey).toBe('node/2271410640');
    expect(candidate.place).toMatchObject({
      canonicalName: 'Sajens Mat & Möten',
      latitude: 57.7793764,
      longitude: 14.159859,
      streetAddress: 'Gjuterigatan 9',
      postalCode: '553 18',
      locality: 'Jönköping',
      openingHours: { raw: 'Mo-Fr 07:45-16:00' },
    });
    expect(candidate.sourceCategories).toContain('amenity=restaurant');
  });

  it('uses supplied centers for supported way and relation representations', async () => {
    const records = await observations([
      element(1, { type: 'way', center: { lat: 57.78, lon: 14.16 } }),
      element(2, { type: 'relation', center: { lat: 57.79, lon: 14.17 } }),
    ]);
    expect(adapter([]).parse(records[0].envelope, records[0]).place.latitude).toBe(57.78);
    expect(adapter([]).parse(records[1].envelope, records[1]).place.longitude).toBe(14.17);
  });

  it('retains only permitted extracted fields and excludes contributor identity', () => {
    const envelope = extractEnvelope(element(3, {
      user: 'not-retained', uid: 123, changeset: 456,
      tags: { name: 'Permitted', amenity: 'cafe', note: 'not retained', 'addr:city': 'Jönköping' },
    }));
    expect(envelope.tags).toEqual({ 'addr:city': 'Jönköping', amenity: 'cafe', name: 'Permitted' });
    expect(envelope).not.toHaveProperty('user');
    expect(envelope).not.toHaveProperty('uid');
    expect(envelope).not.toHaveProperty('changeset');
  });

  it('rejects missing names and impossible coordinates while optional fields remain optional', async () => {
    const [missingName, badCoordinates, minimal] = await observations([
      element(4, { tags: { amenity: 'cafe' } }),
      element(5, { lat: 999 }),
      element(6),
    ]);
    expect(() => adapter([]).parse(missingName.envelope, missingName)).toThrowError(/non-empty name/);
    expect(() => adapter([]).parse(badCoordinates.envelope, badCoordinates)).toThrowError(/legal finite bounds/);
    expect(adapter([]).parse(minimal.envelope, minimal).place).toMatchObject({
      officialUrl: undefined, phone: undefined, openingHours: undefined,
    });
  });

  it('limits concurrency and performs only one bounded transient retry respecting Retry-After', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const held = new OsmOverpassAdapter({
      fetchImpl: (async () => { await pending; return jsonResponse({ elements: [] }); }) as typeof fetch,
      sleep: async () => undefined,
      now: fixedNow,
    });
    const first = held.fetch({ signal: new AbortController().signal });
    await expect(held.fetch({ signal: new AbortController().signal })).rejects.toMatchObject({ code: 'CONCURRENCY_LIMIT' });
    release();
    await first;

    const delays: number[] = [];
    const retried = adapter([], {
      responses: [jsonResponse({}, 429, { 'retry-after': '7' }), jsonResponse({ elements: [] })],
      sleep: async (milliseconds) => { delays.push(milliseconds); },
    });
    await expect(retried.fetch({ signal: new AbortController().signal })).resolves.toMatchObject({ observations: [] });
    expect(delays).toEqual([7_000]);

    const failed = adapter([], { responses: [jsonResponse({}, 503), jsonResponse({}, 503)] });
    await expect(failed.fetch({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'SERVER_OVERLOAD', status: 503,
    });

    const runtimeError = adapter([], {
      responses: [jsonResponse({ elements: [], remark: 'runtime error' })],
    });
    await expect(runtimeError.fetch({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'QUERY_RUNTIME_ERROR', status: 200,
    });

    const oversized = adapter([], {
      responses: [new Response('x'.repeat(2_097_153), { status: 200 })],
    });
    await expect(oversized.fetch({ signal: new AbortController().signal })).rejects.toMatchObject({
      code: 'RESPONSE_TOO_LARGE',
    });
  });

  it('covers the full municipality and preserves semicolon-delimited source facts separately', async () => {
    const [record] = await observations([element(7, {
      tags: { name: 'Evidence-backed multi-label venue', amenity: 'restaurant', cuisine: 'italian;pizza' },
    })]);
    const candidate = adapter([]).parse(record.envelope, record);

    expect(BOUNDED_OSM_QUERY).toContain('["admin_level"="7"]["ref"="0680"]');
    expect(BOUNDED_OSM_QUERY).toContain('0680');
    expect(BOUNDED_OSM_QUERY).not.toContain('(57.775,14.145,57.795,14.185)');
    expect(candidate.sourceCategories).toEqual(['amenity=restaurant', 'cuisine=italian', 'cuisine=pizza']);
  });

  it('keeps type plus ID identity stable and content versions deterministic', async () => {
    const id = 20;
    const first = await runIngestion(store, adapter([element(id)]));
    const unchanged = await runIngestion(store, adapter([element(id)], {
      now: () => new Date('2026-08-14T05:30:00Z'),
    }));
    const changed = await runIngestion(store, adapter([element(id, {
      tags: { name: `SRC-01 Test ${id}`, amenity: 'restaurant' },
    })]));
    const distinctType = await runIngestion(store, adapter([element(id, {
      type: 'way', center: { lat: 57.7826, lon: 14.1618 }, lat: undefined, lon: undefined,
    })]));

    expect(first.counters).toMatchObject({ newCount: 1, canonicalApplied: 1 });
    expect(unchanged.counters).toMatchObject({ unchanged: 1, canonicalApplied: 0 });
    expect(changed.counters).toMatchObject({ changed: 1, canonicalApplied: 0 });
    expect(distinctType.counters).toMatchObject({ newCount: 1, canonicalApplied: 1 });
    const [counts] = await fixtureQuery<{ records: number; versions: number; storage_modes: number }>(connectionString, `
      select count(distinct record.id)::int records,
             count(distinct version.id)::int versions,
             count(distinct version.payload_storage_mode)::int storage_modes
      from app.source_records record
      join app.sources source on source.id = record.source_id
      join app.source_record_versions version on version.source_record_id = record.id
      where source.key = $1 and record.external_key = any($2::text[])
    `, [OSM_SOURCE_KEY, [`node/${numericNamespace + id}`, `way/${numericNamespace + id}`]]);
    expect(counts).toEqual({ records: 2, versions: 3, storage_modes: 1 });
    const [mode] = await fixtureQuery<{ payload_storage_mode: string }>(connectionString, `
      select distinct version.payload_storage_mode
      from app.source_record_versions version
      join app.source_records record on record.id = version.source_record_id
      join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = $2
    `, [OSM_SOURCE_KEY, `node/${numericNamespace + id}`]);
    expect(mode.payload_storage_mode).toBe('EXTRACTED_ENVELOPE');
  });

  it('uses the active municipality boundary and rejects outside-scope canonical publication', async () => {
    const insideId = 30;
    await runIngestion(store, adapter([element(insideId)]));
    const [inside] = await fixtureQuery<{ scope_id: string; scope_boundary_id: string; active_boundary_id: string }>(connectionString, `
      select entity.scope_id, entity.scope_boundary_id, boundary.id as active_boundary_id
      from app.source_records record
      join app.sources source on source.id = record.source_id
      join app.canonical_entities entity on entity.id = record.canonical_entity_id
      join app.geographic_scope_boundaries boundary
        on boundary.scope_id = entity.scope_id and boundary.is_active
      where source.key = $1 and record.external_key = $2
    `, [OSM_SOURCE_KEY, `node/${numericNamespace + insideId}`]);
    expect(inside.scope_id).toBe(JONKOPING_SCOPE_ID);
    expect(inside.scope_boundary_id).toBe(inside.active_boundary_id);

    const outsideId = 31;
    await expect(runIngestion(store, adapter([element(outsideId, { lat: 59.3293, lon: 18.0686 })])))
      .rejects.toBeInstanceOf(IngestionRunError);
    const [outside] = await fixtureQuery<{ current_version_id: string; canonical_entity_id: string | null }>(connectionString, `
      select record.current_version_id, record.canonical_entity_id
      from app.source_records record join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = $2
    `, [OSM_SOURCE_KEY, `node/${numericNamespace + outsideId}`]);
    expect(outside.current_version_id).not.toBeNull();
    expect(outside.canonical_entity_id).toBeNull();
  });

  it('isolates malformed rows and never merges similar records heuristically', async () => {
    const validId = 40;
    const invalidId = 41;
    const mixed = await runIngestion(store, adapter([
      element(validId, { tags: { name: 'Nearly Identical Café', amenity: 'cafe' } }),
      element(invalidId, { tags: { amenity: 'cafe' } }),
    ]));
    expect(mixed.status).toBe('PARTIAL');
    expect(mixed.counters).toMatchObject({ valid: 1, invalid: 1, canonicalApplied: 1 });

    const similar = await runIngestion(store, adapter([
      element(42, { tags: { name: 'Nearly Identical Cafe', amenity: 'cafe' } }),
      element(43, { lat: 57.78261, lon: 14.16181, tags: { name: 'Nearly Identical Café', amenity: 'cafe' } }),
    ]));
    expect(similar.counters.canonicalApplied).toBe(2);
    const similarKeys = [42, 43].map((offset) => `node/${numericNamespace + offset}`);
    const rows = await fixtureQuery<{ canonical_entity_id: string }>(connectionString, `
      select record.canonical_entity_id
      from app.source_records record join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = any($2::text[])
    `, [OSM_SOURCE_KEY, similarKeys]);
    expect(new Set(rows.map(({ canonical_entity_id }) => canonical_entity_id)).size).toBe(2);
  });

  it('preserves canonical truth on endpoint failure and DELTA_ONLY absence', async () => {
    const id = 50;
    await runIngestion(store, adapter([element(id)]));
    const [before] = await sourceState(`node/${numericNamespace + id}`);

    const failedAdapter = adapter([], { responses: [jsonResponse({}, 503), jsonResponse({}, 503)] });
    await expect(runIngestion(store, failedAdapter)).rejects.toBeInstanceOf(IngestionRunError);
    const empty = await runIngestion(store, adapter([]));
    const [after] = await sourceState(`node/${numericNamespace + id}`);

    expect(empty.counters.disappeared).toBe(0);
    expect(after).toEqual(before);
  });
});

function sourceState(externalKey: string) {
  return fixtureQuery<{
    canonical_entity_id: string;
    current_version_id: string;
    current_parse_attempt_id: string;
    miss_count: number;
    is_missing: boolean;
  }>(connectionString, `
    select record.canonical_entity_id, record.current_version_id,
           record.current_parse_attempt_id, record.miss_count, record.is_missing
    from app.source_records record join app.sources source on source.id = record.source_id
    where source.key = $1 and record.external_key = $2
  `, [OSM_SOURCE_KEY, externalKey]);
}
