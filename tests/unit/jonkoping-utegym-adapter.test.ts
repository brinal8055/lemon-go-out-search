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
  JONKOPING_UTEGYM_SOURCE_KEY,
  JonkopingUtegymAdapter,
} from '../../packages/source-adapters/src/jonkoping-utegym.ts';
import { OsmOverpassAdapter, OSM_SOURCE_KEY } from '../../packages/source-adapters/src/osm.ts';

type Feature = {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
};

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const fixedNow = () => new Date('2026-08-14T08:00:00Z');
const fixtureUrl = new URL('../../packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json', import.meta.url);
const policyUrl = new URL('../../reference/sources/jonkoping-utegym.v1.json', import.meta.url);
const guidNamespace = randomUUID().slice(0, 8);

beforeAll(async () => {
  await prepareLocalIngestionRuntime(connectionString);
});

afterAll(async () => {
  await store.close();
});

function guid(index: number): string {
  return `${guidNamespace}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function feature(index: number, overrides: Partial<Feature> = {}): Feature {
  return {
    attributes: {
      OBJECTID: index,
      GlobalID: `{${guid(index)}}`,
      name: `SRC-02 Utegym ${index}`,
      visit_url: 'https://www.jonkoping.se/',
      street: null,
      house_number: null,
      postcode: null,
      city: null,
      phone: '+46-36-105000',
      andrad_datum: 1748345472000,
    },
    geometry: { x: 14.1618, y: 57.7826 },
    ...overrides,
  };
}

function page(features: Feature[], exceededTransferLimit = false, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({
    spatialReference: { wkid: 4326, latestWkid: 4326 },
    features,
    exceededTransferLimit,
  }), { status, headers });
}

function adapter(responses: Response[]): JonkopingUtegymAdapter {
  const remaining = [...responses];
  return new JonkopingUtegymAdapter({
    fetchImpl: (async () => remaining.shift() ?? page([])) as typeof fetch,
    sleep: async () => undefined,
    now: fixedNow,
  });
}

describe('SRC-02 bounded Jönköping Utegym adapter', () => {
  it('parses sanitized real EPSG:4326 data and uses layer-scoped GlobalID identity', async () => {
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8')) as {
      features: Feature[];
      exceededTransferLimit: boolean;
    };
    const result = await adapter([page(fixture.features, fixture.exceededTransferLimit)]).fetch({
      signal: new AbortController().signal,
    });
    const candidate = adapter([]).parse(result.observations[0].envelope, result.observations[0]);

    expect(result.observations[0].externalKey).toBe('layer-41/globalid/f41a2453-a30b-4f6e-8efc-275a5303a6bc');
    expect(candidate).toMatchObject({
      sourceKey: JONKOPING_UTEGYM_SOURCE_KEY,
      names: [{ value: 'Axamobadet: utegym*', language: 'sv', kind: 'OFFICIAL' }],
      place: { latitude: 57.77558532589883, longitude: 14.063057590534296 },
      sourceCategories: ['municipal_layer=utegym'],
    });
    expect(result.fetchMeta).toMatchObject({ layerId: 41, outSpatialReference: 4326, recordCount: 3 });
  });

  it('paginates with explicit bounds, retries once, and rejects wrong CRS or oversized responses', async () => {
    const requested: URL[] = [];
    const responses = [page([], false, 503), page([feature(101)], true), page([feature(102)])];
    const bounded = new JonkopingUtegymAdapter({
      fetchImpl: (async (input) => {
        requested.push(new URL(String(input)));
        return responses.shift() ?? page([]);
      }) as typeof fetch,
      sleep: async () => undefined,
      now: fixedNow,
    });
    const result = await bounded.fetch({ signal: new AbortController().signal });
    expect(result.observations).toHaveLength(2);
    expect(requested).toHaveLength(3);
    expect(requested[0].searchParams.get('resultRecordCount')).toBe('25');
    expect(requested[0].searchParams.get('outSR')).toBe('4326');
    expect(requested[2].searchParams.get('resultOffset')).toBe('1');

    const wrongCrs = new Response(JSON.stringify({
      spatialReference: { wkid: 3008 }, features: [], exceededTransferLimit: false,
    }));
    await expect(adapter([wrongCrs]).fetch({ signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'CRS_MISMATCH' });
    await expect(adapter([new Response('x'.repeat(524_289))]).fetch({ signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
  });

  it('enforces the total record cap and isolates valid from malformed source rows', async () => {
    const pages = Array.from({ length: 4 }, (_, pageIndex) => page(
      Array.from({ length: 25 }, (_, rowIndex) => feature(1_000 + pageIndex * 25 + rowIndex)),
      true,
    ));
    await expect(adapter(pages).fetch({ signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'RECORD_LIMIT' });

    const valid = feature(201);
    const invalid = feature(202, { attributes: { ...feature(202).attributes, name: ' ' } });
    const run = await runIngestion(store, adapter([page([valid, invalid])]));
    expect(run.status).toBe('PARTIAL');
    expect(run.counters).toMatchObject({ fetched: 2, valid: 1, invalid: 1, newCount: 2, canonicalApplied: 1 });
    expect(run.stageTrace).toContainEqual({
      stage: 'parse/validate',
      externalKey: `layer-41/globalid/${guid(202)}`,
      outcome: 'FAILED:MUNICIPAL_NAME_MISSING',
    });
  });

  it('classifies NEW, UNCHANGED, and CHANGED while reruns remain idempotent', async () => {
    const initial = feature(301);
    const first = await runIngestion(store, adapter([page([initial])]));
    const unchanged = await runIngestion(store, adapter([page([initial])]));
    const changedFeature = feature(301, {
      attributes: { ...initial.attributes, name: 'SRC-02 Utegym 301 updated' },
    });
    const changed = await runIngestion(store, adapter([page([changedFeature])]));

    expect(first.counters).toMatchObject({ newCount: 1, canonicalApplied: 1 });
    expect(unchanged.counters).toMatchObject({ unchanged: 1, canonicalApplied: 0 });
    expect(changed.counters).toMatchObject({ changed: 1, canonicalApplied: 1 });
    const [counts] = await fixtureQuery<{ records: number; versions: number; attempts: number }>(connectionString, `
      select count(distinct record.id)::int records,
             count(distinct version.id)::int versions,
             count(distinct attempt.id)::int attempts
      from app.source_records record
      join app.sources source on source.id = record.source_id
      join app.source_record_versions version on version.source_record_id = record.id
      join app.source_record_parse_attempts attempt on attempt.source_record_version_id = version.id
      where source.key = $1 and record.external_key = $2
    `, [JONKOPING_UTEGYM_SOURCE_KEY, `layer-41/globalid/${guid(301)}`]);
    expect(counts).toEqual({ records: 1, versions: 2, attempts: 2 });
  });

  it('uses the active municipality boundary and retains out-of-scope evidence without a canonical entity', async () => {
    const outside = feature(401, { geometry: { x: 18.0686, y: 59.3293 } });
    await expect(runIngestion(store, adapter([page([outside])]))).rejects.toBeInstanceOf(IngestionRunError);
    const [record] = await fixtureQuery<{ current_version_id: string; canonical_entity_id: string | null }>(connectionString, `
      select record.current_version_id, record.canonical_entity_id
      from app.source_records record join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = $2
    `, [JONKOPING_UTEGYM_SOURCE_KEY, `layer-41/globalid/${guid(401)}`]);
    expect(record.current_version_id).not.toBeNull();
    expect(record.canonical_entity_id).toBeNull();
  });

  it('never heuristically merges matching municipal and OSM names or coordinates', async () => {
    const name = `SRC-02 Cross-source ${randomUUID()}`;
    const municipal = feature(501, { attributes: { ...feature(501).attributes, name } });
    await runIngestion(store, adapter([page([municipal])]));

    const osmElement = {
      type: 'node', id: Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 10), 16), version: 1,
      timestamp: '2026-08-14T08:00:00Z', lat: 57.7826, lon: 14.1618,
      tags: { name, leisure: 'fitness_station' },
    };
    await runIngestion(store, new OsmOverpassAdapter({
      fetchImpl: (async () => new Response(JSON.stringify({ elements: [osmElement] }))) as typeof fetch,
      sleep: async () => undefined,
      now: fixedNow,
    }));

    const rows = await fixtureQuery<{ source_key: string; canonical_entity_id: string }>(connectionString, `
      select source.key source_key, record.canonical_entity_id
      from app.source_records record
      join app.sources source on source.id = record.source_id
      join app.canonical_entities entity on entity.id = record.canonical_entity_id
      where source.key = any($1::text[]) and entity.canonical_name = $2
    `, [[JONKOPING_UTEGYM_SOURCE_KEY, OSM_SOURCE_KEY], name]);
    expect(rows.map(({ source_key }) => source_key).sort()).toEqual([JONKOPING_UTEGYM_SOURCE_KEY, OSM_SOURCE_KEY].sort());
    expect(new Set(rows.map(({ canonical_entity_id }) => canonical_entity_id)).size).toBe(2);
  });

  it('treats absence as DELTA_ONLY and pins the positive source-policy metadata', async () => {
    const present = feature(601);
    await runIngestion(store, adapter([page([present])]));
    const empty = await runIngestion(store, adapter([page([])]));
    const [record] = await fixtureQuery<{ is_missing: boolean; miss_count: number }>(connectionString, `
      select record.is_missing, record.miss_count
      from app.source_records record join app.sources source on source.id = record.source_id
      where source.key = $1 and record.external_key = $2
    `, [JONKOPING_UTEGYM_SOURCE_KEY, `layer-41/globalid/${guid(601)}`]);
    expect(empty.counters.disappeared).toBe(0);
    expect(record).toEqual({ is_missing: false, miss_count: 0 });

    const policy = JSON.parse(await readFile(policyUrl, 'utf8')) as Record<string, unknown>;
    expect(policy).toMatchObject({
      sourceKey: JONKOPING_UTEGYM_SOURCE_KEY,
      arcgisItemId: '1de92c84c958413fab16f37fa1e4fe86',
      layerId: 41,
      licence: 'CC0-1.0',
      persistencePermission: 'EXTRACTED_FIELDS_ONLY',
      refreshMode: 'DELTA_ONLY',
      sourceCrs: 'EPSG:3008 (SWEREF99 13 30)',
      requestCrs: 'EPSG:4326 via ArcGIS outSR=4326',
    });
  });
});
