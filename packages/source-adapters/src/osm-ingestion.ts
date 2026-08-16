import { createHash } from 'node:crypto';

import {
  PostgresIngestionStore,
  runIngestion,
  type FetchResult,
  type RunResult,
  type SourceAdapter,
  type SourceObservation,
} from '@lemon/ingestion-domain';
import pg from 'pg';

import {
  BOUNDED_OSM_QUERIES,
  JONKOPING_SCOPE_ID,
  OSM_ENDPOINT,
  OsmOverpassAdapter,
} from './osm.ts';

const { Client } = pg;

class ActiveBoundaryOsmAdapter implements SourceAdapter {
  readonly #delegate = new OsmOverpassAdapter({ queries: BOUNDED_OSM_QUERIES });
  readonly config = this.#delegate.config;
  readonly #connectionString: string;
  outsideScope = 0;

  constructor(connectionString: string) {
    this.#connectionString = connectionString;
  }

  async fetch(context: { signal: AbortSignal }): Promise<FetchResult> {
    const fetched = await this.#delegate.fetch(context);
    const acceptedKeys = await coveredExternalKeys(this.#connectionString, fetched.observations);
    const observations = fetched.observations.filter(({ externalKey }) => acceptedKeys.has(externalKey));
    this.outsideScope = fetched.observations.length - observations.length;
    return {
      ...fetched,
      observations,
      fetchMeta: {
        ...fetched.fetchMeta,
        sourceRecordCount: fetched.observations.length,
        activeBoundaryRecordCount: observations.length,
        outsideActiveBoundaryCount: this.outsideScope,
      },
    };
  }

  externalStableId(raw: SourceObservation): string {
    return this.#delegate.externalStableId(raw);
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return this.#delegate.captureEnvelope(raw);
  }

  parse(captured: Record<string, unknown>, observation: SourceObservation) {
    return this.#delegate.parse(captured, observation);
  }
}

export async function runBoundedOsmIngestion(connectionString: string): Promise<{
  result: RunResult;
  endpoint: string;
  querySha256: string;
  insideScope: number;
  outsideScope: number;
  sampleExternalKeys: string[];
}> {
  const store = new PostgresIngestionStore(connectionString);
  try {
    const adapter = new ActiveBoundaryOsmAdapter(connectionString);
    const result = await runIngestion(store, adapter);
    return {
      result,
      endpoint: OSM_ENDPOINT,
      querySha256: createHash('sha256').update(JSON.stringify(BOUNDED_OSM_QUERIES)).digest('hex'),
      insideScope: result.stageTrace.filter(({ stage }) => stage === 'canonical/taxonomy').length,
      outsideScope: adapter.outsideScope,
      sampleExternalKeys: result.stageTrace
        .filter(({ stage, externalKey }) => stage === 'capture/version' && externalKey)
        .slice(0, 5)
        .map(({ externalKey }) => externalKey!),
    };
  } finally {
    await store.close();
  }
}

async function coveredExternalKeys(
  connectionString: string,
  observations: SourceObservation[],
): Promise<Set<string>> {
  if (observations.length === 0) return new Set();
  const points = observations.map((observation) => {
    const location = observation.envelope.location;
    if (location === null || typeof location !== 'object' || Array.isArray(location)) {
      throw new Error(`OSM observation ${observation.externalKey} lacks a filterable location`);
    }
    const point = location as Record<string, unknown>;
    if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
      throw new Error(`OSM observation ${observation.externalKey} has an invalid filterable location`);
    }
    return { externalKey: observation.externalKey, latitude: point.latitude, longitude: point.longitude };
  });
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const rows = await client.query<{ external_key: string }>(`
      select point.external_key
        from jsonb_to_recordset($1::jsonb) as point(external_key text, latitude double precision, longitude double precision)
        join app.geographic_scope_boundaries as boundary
          on boundary.scope_id = $2 and boundary.is_active
       where extensions.st_covers(
         boundary.boundary,
         extensions.st_setsrid(extensions.st_makepoint(point.longitude, point.latitude), 4326)
       )
       order by point.external_key
    `, [JSON.stringify(points.map(({ externalKey: external_key, ...point }) => ({ external_key, ...point }))), JONKOPING_SCOPE_ID]);
    return new Set(rows.rows.map(({ external_key }) => external_key));
  } finally {
    await client.end();
  }
}
