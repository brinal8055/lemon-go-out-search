import type {
  AdapterConfig,
  FetchResult,
  NormalizedSourceRecord,
  SourceAdapter,
  SourceObservation,
} from './types.ts';
import { FixtureParseError } from './types.ts';

export type FixturePlace = {
  externalKey: string;
  name: string;
  latitude?: number;
  longitude?: number;
  taxonomySlug?: string;
  resolution?: 'NEW' | 'UNRESOLVED';
  parserReject?: boolean;
  observedAt?: string;
};

export type FixtureAdapterOptions = {
  sourceKey?: string;
  scopeSlug?: string;
  adapterVersion?: string;
  parserVersion?: string;
  mappingVersion?: string;
  refreshMode?: AdapterConfig['refreshMode'];
  records?: FixturePlace[];
  refreshUnitComplete?: boolean;
  snapshotComplete?: boolean | null;
  acceptRejectedPayload?: boolean;
};

const DEFAULT_TIME = '2026-08-14T08:00:00.000Z';

export class FixtureSourceAdapter implements SourceAdapter {
  readonly config: AdapterConfig;
  readonly #records: FixturePlace[];
  readonly #refreshUnitComplete: boolean;
  readonly #snapshotComplete: boolean | null;
  readonly #acceptRejectedPayload: boolean;

  constructor(options: FixtureAdapterOptions = {}) {
    const refreshMode = options.refreshMode ?? 'DELTA_ONLY';
    this.config = {
      sourceKey: options.sourceKey ?? 'fixture-ing-01',
      sourceName: 'ING-01 deterministic fixture',
      scopeSlug: options.scopeSlug ?? 'jonkoping-municipality',
      adapterVersion: options.adapterVersion ?? 'fixture-adapter-v1',
      parserVersion: options.parserVersion ?? 'fixture-parser-v1',
      mappingVersion: options.mappingVersion ?? 'fixture-map-v1',
      refreshMode,
    };
    this.#records = options.records ?? [{
      externalKey: 'fixture-place-1',
      name: 'Fixture Coffee House',
      latitude: 57.7826,
      longitude: 14.1618,
      taxonomySlug: 'coffee-shop',
    }];
    this.#refreshUnitComplete = options.refreshUnitComplete ?? true;
    this.#snapshotComplete = refreshMode === 'DELTA_ONLY'
      ? null
      : (options.snapshotComplete ?? true);
    this.#acceptRejectedPayload = options.acceptRejectedPayload ?? false;
  }

  async fetch({ signal }: { signal: AbortSignal }): Promise<FetchResult> {
    signal.throwIfAborted();
    return {
      observations: this.#records.map((record) => ({
        externalKey: record.externalKey,
        sourceUrl: `fixture://ing-01/${encodeURIComponent(record.externalKey)}`,
        fetchedAt: record.observedAt ?? DEFAULT_TIME,
        observedAt: record.observedAt ?? DEFAULT_TIME,
        envelope: { ...record },
      })),
      refreshUnitComplete: this.#refreshUnitComplete,
      snapshotComplete: this.#snapshotComplete,
      fetchMeta: { fixture: 'ing-01', recordCount: this.#records.length },
    };
  }

  externalStableId(raw: SourceObservation): string {
    return raw.externalKey;
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return raw.envelope;
  }

  parse(captured: Record<string, unknown>, observation: SourceObservation): NormalizedSourceRecord {
    if (captured.parserReject === true && !this.#acceptRejectedPayload) {
      throw new FixtureParseError('FIXTURE_INVALID', 'fixture parser rejected the captured envelope');
    }

    const name = requiredString(captured.name, 'name');
    const latitude = optionalNumber(captured.latitude, 57.7826);
    const longitude = optionalNumber(captured.longitude, 14.1618);
    const resolution = captured.resolution === 'UNRESOLVED' ? 'UNRESOLVED' : 'NEW';
    const taxonomySlug = typeof captured.taxonomySlug === 'string' ? captured.taxonomySlug : undefined;

    return {
      sourceKey: this.config.sourceKey,
      externalKey: observation.externalKey,
      entityType: 'PLACE',
      observedAt: observation.observedAt,
      names: [{ value: name, language: 'und', kind: 'OFFICIAL' }],
      place: {
        entityType: 'PLACE',
        canonicalName: name,
        latitude,
        longitude,
        status: 'ACTIVE',
        locality: 'Jönköping',
        taxonomySlug,
        resolution,
      },
      sourceCategories: taxonomySlug ? [taxonomySlug] : [],
      explicitFacts: { canonicalName: name, location: { latitude, longitude } },
      permittedEvidenceRefs: [observation.sourceUrl ?? `fixture:${observation.externalKey}`],
    };
  }
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new FixtureParseError('FIXTURE_INVALID', `fixture ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalNumber(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new FixtureParseError('FIXTURE_INVALID', 'fixture coordinate must be finite');
  }
  return value;
}
