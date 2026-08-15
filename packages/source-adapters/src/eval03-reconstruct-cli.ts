import { readFile } from 'node:fs/promises';

import {
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  publishFirstPlace,
  runIngestion,
  type FetchResult,
  type SourceAdapter,
  type SourceObservation,
} from '@lemon/ingestion-domain';
import {
  JONKOPING_EVENT_ADAPTER_VERSION,
  JONKOPING_EVENT_MAPPING_VERSION,
  JONKOPING_EVENT_PARSER_VERSION,
  JONKOPING_EVENT_SOURCE_KEY,
  JonkopingEventAdapter,
  type PermittedEventOccurrence,
} from './jonkoping-events.ts';
import { JonkopingUtegymAdapter } from './jonkoping-utegym.ts';
import { OsmOverpassAdapter } from './osm.ts';

const root = new URL('../../../', import.meta.url);
const reconstructionClock = new Date('2026-05-01T12:00:00.000Z');
const connectionString = fixtureDatabaseUrl();
const [osmFixture, municipalFixture, eventFixture] = await Promise.all([
  readFile(new URL('packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json', root), 'utf8'),
  readFile(new URL('packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json', root), 'utf8'),
  readFile(new URL('packages/source-adapters/fixtures/events/jonkoping-event-calendar.single-occurrence.sanitized.json', root), 'utf8'),
]);
const sourceEvents = (JSON.parse(eventFixture) as { events: PermittedEventOccurrence[] }).events;
const events = sourceEvents.filter((event) => (
  event.venueName?.trim() && event.latitude !== null && event.longitude !== null
));

class PinnedEventAdapter implements SourceAdapter {
  readonly config = {
    sourceKey: JONKOPING_EVENT_SOURCE_KEY,
    sourceName: 'Jönköping municipality Event Calendar',
    scopeSlug: 'jonkoping-municipality',
    adapterVersion: JONKOPING_EVENT_ADAPTER_VERSION,
    parserVersion: JONKOPING_EVENT_PARSER_VERSION,
    mappingVersion: JONKOPING_EVENT_MAPPING_VERSION,
    refreshMode: 'DELTA_ONLY' as const,
  };

  readonly #delegate = new JonkopingEventAdapter({ now: () => reconstructionClock });
  readonly #events: PermittedEventOccurrence[];

  constructor(events: PermittedEventOccurrence[]) {
    this.#events = events;
  }

  async fetch(): Promise<FetchResult> {
    const fetchedAt = reconstructionClock.toISOString();
    return {
      observations: this.#events.map((event): SourceObservation => ({
        externalKey: event.externalKey,
        sourceUrl: event.sourceUrl,
        fetchedAt,
        observedAt: fetchedAt,
        envelope: { ...event },
      })),
      refreshUnitComplete: true,
      snapshotComplete: null,
      fetchMeta: { mode: 'PINNED_ACCEPTED_SOURCE_FIXTURE', recordCount: this.#events.length },
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

const adapters: SourceAdapter[] = [
  new OsmOverpassAdapter({
    fetchImpl: async () => Response.json(JSON.parse(osmFixture)),
    sleep: async () => undefined,
    now: () => reconstructionClock,
  }),
  new JonkopingUtegymAdapter({
    fetchImpl: async () => Response.json(JSON.parse(municipalFixture)),
    sleep: async () => undefined,
    now: () => reconstructionClock,
  }),
  new PinnedEventAdapter(events),
];

await prepareLocalIngestionRuntime(connectionString);
const reports = [];
for (const adapter of adapters) {
  const store = new PostgresIngestionStore(connectionString);
  try {
    const result = await runIngestion(store, adapter);
    if (result.status !== 'SUCCEEDED') {
      throw new Error(`RECONSTRUCTION_FAILED:${adapter.config.sourceKey}:${JSON.stringify({
        counters: result.counters,
        stageTrace: result.stageTrace,
      })}`);
    }
    reports.push({ sourceKey: adapter.config.sourceKey, runId: result.runId, counters: result.counters });
  } finally {
    await store.close();
  }
}
const publication = await publishFirstPlace(connectionString);
console.log(JSON.stringify({
  reconstruction: 'PINNED_ACCEPTED_SOURCE_FIXTURES',
  networkRequests: 0,
  reconstructionClock: reconstructionClock.toISOString(),
  eventRecordsRejectedByFrozenLocationContract: sourceEvents.length - events.length,
  reports,
  publication,
}));
