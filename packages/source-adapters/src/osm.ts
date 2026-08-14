import { createHash } from 'node:crypto';
import type {
  FetchResult,
  NormalizedSourceRecord,
  SourceAdapter,
  SourceObservation,
} from '@lemon/ingestion-domain';
import { FixtureParseError } from '@lemon/ingestion-domain';

export const OSM_SOURCE_KEY = 'OSM_OVERPASS';
export const OSM_ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const OSM_ADAPTER_VERSION = 'osm-overpass-v1';
export const OSM_PARSER_VERSION = 'osm-place-parser-v1';
export const OSM_MAPPING_VERSION = 'osm-no-taxonomy-map-v1';
export const JONKOPING_SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
export const JONKOPING_SCOPE_SLUG = 'jonkoping-municipality';
export const BOUNDED_OSM_QUERY = `[out:json][timeout:15][maxsize:524288];
(
  nwr["name"]["amenity"~"^(restaurant|cafe|bar|pub|fast_food|ice_cream|cinema|theatre)$"](57.775,14.145,57.795,14.185);
  nwr["name"]["tourism"~"^(museum|attraction|gallery)$"](57.775,14.145,57.795,14.185);
  nwr["name"]["leisure"~"^(sports_centre|bowling_alley|escape_game|park)$"](57.775,14.145,57.795,14.185);
);
out meta center qt 20;`;

const MAX_RESPONSE_BYTES = 524_288;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 5_000;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const ELEMENT_TYPES = new Set(['node', 'way', 'relation']);
const TAG_KEYS = new Set([
  'name', 'name:en', 'name:sv', 'amenity', 'cuisine', 'leisure', 'tourism',
  'shop', 'sport', 'brand', 'operator', 'website', 'contact:website', 'phone',
  'contact:phone', 'opening_hours', 'wheelchair', 'access',
]);

type OsmElement = {
  type?: unknown;
  id?: unknown;
  version?: unknown;
  timestamp?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
};

type ExtractedOsmEnvelope = {
  elementType: 'node' | 'way' | 'relation';
  elementId: number;
  version: number | null;
  timestamp: string | null;
  location: { latitude: number; longitude: number; representation: 'node' | 'center' } | null;
  tags: Record<string, string>;
  osmUrl: string;
};

export class OverpassFetchError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.name = 'OverpassFetchError';
    this.code = code;
    this.status = status;
  }
}

export type OsmAdapterOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
};

export class OsmOverpassAdapter implements SourceAdapter {
  readonly config = {
    sourceKey: OSM_SOURCE_KEY,
    sourceName: 'OpenStreetMap via Overpass',
    scopeSlug: JONKOPING_SCOPE_SLUG,
    adapterVersion: OSM_ADAPTER_VERSION,
    parserVersion: OSM_PARSER_VERSION,
    mappingVersion: OSM_MAPPING_VERSION,
    refreshMode: 'DELTA_ONLY' as const,
  };

  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #now: () => Date;
  #inFlight = false;

  constructor(options: OsmAdapterOptions = {}) {
    this.#endpoint = options.endpoint ?? OSM_ENDPOINT;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#now = options.now ?? (() => new Date());
  }

  async fetch({ signal }: { signal: AbortSignal }): Promise<FetchResult> {
    if (this.#inFlight) throw new OverpassFetchError('CONCURRENCY_LIMIT', 'only one Overpass request may run at a time');
    this.#inFlight = true;
    try {
      const fetchedAt = this.#now().toISOString();
      const payload = await this.#request(signal);
      const observations = payload.elements.map((element) => this.#observation(element, fetchedAt));
      return {
        observations,
        refreshUnitComplete: true,
        snapshotComplete: null,
        fetchMeta: {
          endpoint: this.#endpoint,
          querySha256: createHash('sha256').update(BOUNDED_OSM_QUERY).digest('hex'),
          recordCount: observations.length,
        },
      };
    } finally {
      this.#inFlight = false;
    }
  }

  externalStableId(raw: SourceObservation): string {
    if (!/^(node|way|relation)\/[1-9]\d*$/.test(raw.externalKey)) {
      throw new FixtureParseError('OSM_IDENTITY_INVALID', 'OSM external key must be type/id');
    }
    return raw.externalKey;
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return raw.envelope;
  }

  parse(captured: Record<string, unknown>, observation: SourceObservation): NormalizedSourceRecord {
    const envelope = readEnvelope(captured);
    const name = envelope.tags.name?.trim();
    if (!name) throw new FixtureParseError('OSM_NAME_MISSING', 'OSM Place requires a non-empty name');
    if (!envelope.location) throw new FixtureParseError('OSM_LOCATION_MISSING', 'OSM Place requires node coordinates or supplied center');
    validateCoordinates(envelope.location.latitude, envelope.location.longitude);

    const website = firstNonEmpty(envelope.tags.website, envelope.tags['contact:website']);
    const phone = firstNonEmpty(envelope.tags.phone, envelope.tags['contact:phone']);
    const streetAddress = joinAddress(envelope.tags['addr:street'], envelope.tags['addr:housenumber']);
    const sourceCategories = ['amenity', 'cuisine', 'leisure', 'tourism', 'shop', 'sport']
      .flatMap((key) => envelope.tags[key] ? [`${key}=${envelope.tags[key]}`] : []);

    return {
      sourceKey: OSM_SOURCE_KEY,
      externalKey: observation.externalKey,
      entityType: 'PLACE',
      observedAt: envelope.timestamp ?? observation.observedAt,
      names: [{ value: name, language: 'und', kind: 'OFFICIAL' }],
      place: {
        entityType: 'PLACE',
        canonicalName: name,
        latitude: envelope.location.latitude,
        longitude: envelope.location.longitude,
        status: 'UNKNOWN',
        streetAddress,
        postalCode: nonEmpty(envelope.tags['addr:postcode']),
        locality: nonEmpty(envelope.tags['addr:city']),
        officialUrl: website,
        phone,
        openingHours: envelope.tags.opening_hours ? { raw: envelope.tags.opening_hours } : undefined,
        resolution: 'NEW',
      },
      sourceCategories,
      explicitFacts: {
        osmTags: envelope.tags,
        locationRepresentation: envelope.location.representation,
      },
      permittedEvidenceRefs: [envelope.osmUrl],
    };
  }

  async #request(signal: AbortSignal): Promise<{ elements: OsmElement[] }> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
      let response: Response;
      try {
        response = await this.#fetch(this.#endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'user-agent': 'Lemon-Going-Out-Search/0.1 (bounded SRC-01 trial)',
          },
          body: new URLSearchParams({ data: BOUNDED_OSM_QUERY }),
          signal: combinedSignal,
        });
      } catch (error) {
        if (attempt === 0 && !signal.aborted) {
          await this.#sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new OverpassFetchError(
          timeoutSignal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
          'bounded Overpass request failed',
          null,
          { cause: error },
        );
      }

      if (TRANSIENT_STATUS.has(response.status) && attempt === 0) {
        await this.#sleep(retryDelay(response.headers.get('retry-after')));
        continue;
      }
      if (!response.ok) {
        throw new OverpassFetchError(
          response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'SERVER_OVERLOAD' : 'HTTP_ERROR',
          `Overpass returned HTTP ${response.status}`,
          response.status,
        );
      }

      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new OverpassFetchError('RESPONSE_TOO_LARGE', 'Overpass response exceeds the bounded size limit');
      }
      const text = await readBoundedText(response);
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (error) {
        throw new OverpassFetchError('INVALID_RESPONSE', 'Overpass response is not JSON', response.status, { cause: error });
      }
      if (!isOverpassPayload(value)) {
        throw new OverpassFetchError('INVALID_RESPONSE', 'Overpass response lacks an elements array', response.status);
      }
      return value;
    }
    throw new OverpassFetchError('SERVER_OVERLOAD', 'bounded Overpass request exhausted its single retry');
  }

  #observation(element: OsmElement, fetchedAt: string): SourceObservation {
    const envelope = extractEnvelope(element);
    const externalKey = `${envelope.elementType}/${envelope.elementId}`;
    return {
      externalKey,
      sourceUrl: envelope.osmUrl,
      fetchedAt,
      observedAt: envelope.timestamp ?? fetchedAt,
      envelope,
    };
  }
}

export function extractEnvelope(element: OsmElement): ExtractedOsmEnvelope {
  if (typeof element.type !== 'string' || !ELEMENT_TYPES.has(element.type)) {
    throw new FixtureParseError('OSM_ELEMENT_TYPE_INVALID', 'unsupported OSM element type');
  }
  if (!Number.isSafeInteger(element.id) || Number(element.id) <= 0) {
    throw new FixtureParseError('OSM_ELEMENT_ID_INVALID', 'OSM element ID must be a positive integer');
  }
  const elementType = element.type as ExtractedOsmEnvelope['elementType'];
  const elementId = Number(element.id);
  const nodeLocation = numericLocation(element.lat, element.lon, 'node');
  const centerLocation = numericLocation(element.center?.lat, element.center?.lon, 'center');
  return {
    elementType,
    elementId,
    version: Number.isSafeInteger(element.version) && Number(element.version) > 0 ? Number(element.version) : null,
    timestamp: validTimestamp(element.timestamp),
    location: elementType === 'node' ? nodeLocation : centerLocation,
    tags: permittedTags(element.tags),
    osmUrl: `https://www.openstreetmap.org/${elementType}/${elementId}`,
  };
}

function readEnvelope(value: Record<string, unknown>): ExtractedOsmEnvelope {
  const elementType = value.elementType;
  const elementId = value.elementId;
  if (typeof elementType !== 'string' || !ELEMENT_TYPES.has(elementType) || !Number.isSafeInteger(elementId)) {
    throw new FixtureParseError('OSM_IDENTITY_INVALID', 'captured OSM envelope has invalid identity');
  }
  const location = value.location;
  const parsedLocation = location && typeof location === 'object'
    ? location as ExtractedOsmEnvelope['location']
    : null;
  return {
    elementType: elementType as ExtractedOsmEnvelope['elementType'],
    elementId: Number(elementId),
    version: typeof value.version === 'number' ? value.version : null,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : null,
    location: parsedLocation,
    tags: stringRecord(value.tags),
    osmUrl: typeof value.osmUrl === 'string' ? value.osmUrl : '',
  };
}

function permittedTags(tags: Record<string, unknown> | undefined): Record<string, string> {
  if (!tags) return {};
  return Object.fromEntries(Object.entries(tags)
    .filter(([key, value]) => (TAG_KEYS.has(key) || key.startsWith('addr:')) && typeof value === 'string')
    .sort(([left], [right]) => left.localeCompare(right)) as Array<[string, string]>);
}

function stringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function numericLocation(
  latitude: unknown,
  longitude: unknown,
  representation: 'node' | 'center',
): ExtractedOsmEnvelope['location'] {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { latitude, longitude, representation };
}

function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new FixtureParseError('OSM_COORDINATES_INVALID', 'OSM coordinates are outside legal finite bounds');
  }
}

function validTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map(nonEmpty).find(Boolean);
}

function joinAddress(street: string | undefined, houseNumber: string | undefined): string | undefined {
  const parts = [nonEmpty(street), nonEmpty(houseNumber)].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function retryDelay(value: string | null): number {
  if (!value) return RETRY_DELAY_MS;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(15_000, Math.max(RETRY_DELAY_MS, seconds * 1_000));
  const dateDelay = Date.parse(value) - Date.now();
  return Number.isFinite(dateDelay) ? Math.min(15_000, Math.max(RETRY_DELAY_MS, dateDelay)) : RETRY_DELAY_MS;
}

function isOverpassPayload(value: unknown): value is { elements: OsmElement[] } {
  return value !== null && typeof value === 'object'
    && Array.isArray((value as { elements?: unknown }).elements);
}

async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new OverpassFetchError('RESPONSE_TOO_LARGE', 'Overpass response exceeds the bounded size limit');
    }
    text += decoder.decode(value, { stream: true });
  }
}
