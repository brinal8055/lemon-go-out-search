import type {
  FetchResult,
  NormalizedSourceRecord,
  SourceAdapter,
  SourceObservation,
} from '@lemon/ingestion-domain';
import { FixtureParseError } from '@lemon/ingestion-domain';

export const JONKOPING_UTEGYM_SOURCE_KEY = 'JONKOPING_MUNICIPAL_UTEGYM';
export const JONKOPING_UTEGYM_LAYER_ID = 41;
export const JONKOPING_UTEGYM_ENDPOINT =
  `https://gis.jonkoping.se/arcgis/rest/services/open_data_digg/MapServer/${JONKOPING_UTEGYM_LAYER_ID}`;
export const JONKOPING_UTEGYM_QUERY_ENDPOINT = `${JONKOPING_UTEGYM_ENDPOINT}/query`;
export const JONKOPING_UTEGYM_ADAPTER_VERSION = 'jonkoping-utegym-arcgis-v1';
export const JONKOPING_UTEGYM_PARSER_VERSION = 'jonkoping-utegym-parser-v1';
export const JONKOPING_UTEGYM_MAPPING_VERSION = 'source-taxonomy.v1';
export const JONKOPING_SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
export const JONKOPING_SCOPE_SLUG = 'jonkoping-municipality';

const PAGE_SIZE = 25;
const MAX_RECORDS = 100;
const MAX_RESPONSE_BYTES = 524_288;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_000;
const TRANSIENT_STATUS = new Set([429, 502, 503, 504]);
const OUT_FIELDS = [
  'OBJECTID',
  'GlobalID',
  'name',
  'visit_url',
  'street',
  'house_number',
  'postcode',
  'city',
  'phone',
  'andrad_datum',
].join(',');

type ArcGisFeature = {
  attributes?: Record<string, unknown>;
  geometry?: { x?: unknown; y?: unknown };
};

type ArcGisPage = {
  spatialReference?: { wkid?: unknown; latestWkid?: unknown };
  features: ArcGisFeature[];
  exceededTransferLimit?: boolean;
};

type UtegymEnvelope = {
  layerId: 41;
  globalId: string;
  name: unknown;
  location: { longitude: unknown; latitude: unknown };
  officialUrl: unknown;
  street: unknown;
  houseNumber: unknown;
  postalCode: unknown;
  locality: unknown;
  phone: unknown;
  modifiedAt: string | null;
};

export class ArcGisFetchError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ArcGisFetchError';
    this.code = code;
    this.status = status;
  }
}

export type JonkopingUtegymAdapterOptions = {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
};

export class JonkopingUtegymAdapter implements SourceAdapter {
  readonly config = {
    sourceKey: JONKOPING_UTEGYM_SOURCE_KEY,
    sourceName: 'Jönköpings kommun Utegym',
    scopeSlug: JONKOPING_SCOPE_SLUG,
    adapterVersion: JONKOPING_UTEGYM_ADAPTER_VERSION,
    parserVersion: JONKOPING_UTEGYM_PARSER_VERSION,
    mappingVersion: JONKOPING_UTEGYM_MAPPING_VERSION,
    refreshMode: 'DELTA_ONLY' as const,
  };

  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #now: () => Date;
  #inFlight = false;

  constructor(options: JonkopingUtegymAdapterOptions = {}) {
    this.#endpoint = options.endpoint ?? JONKOPING_UTEGYM_QUERY_ENDPOINT;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.#now = options.now ?? (() => new Date());
  }

  async fetch({ signal }: { signal: AbortSignal }): Promise<FetchResult> {
    if (this.#inFlight) throw new ArcGisFetchError('CONCURRENCY_LIMIT', 'only one Utegym acquisition may run at a time');
    this.#inFlight = true;
    try {
      const fetchedAt = this.#now().toISOString();
      const observations: SourceObservation[] = [];
      let pageCount = 0;

      while (true) {
        const page = await this.#requestPage(observations.length, signal);
        pageCount += 1;
        for (const feature of page.features) {
          if (observations.length >= MAX_RECORDS) {
            throw new ArcGisFetchError('RECORD_LIMIT', `Utegym acquisition exceeds ${MAX_RECORDS} records`);
          }
          observations.push(observation(feature, fetchedAt));
        }
        if (page.exceededTransferLimit !== true) break;
        if (observations.length >= MAX_RECORDS) {
          throw new ArcGisFetchError('RECORD_LIMIT', `Utegym acquisition exceeds ${MAX_RECORDS} records`);
        }
        if (page.features.length === 0) {
          throw new ArcGisFetchError('INVALID_RESPONSE', 'ArcGIS declared more records but returned an empty page');
        }
      }

      return {
        observations,
        refreshUnitComplete: true,
        snapshotComplete: null,
        fetchMeta: {
          endpoint: this.#endpoint,
          layerId: JONKOPING_UTEGYM_LAYER_ID,
          outSpatialReference: 4326,
          pageCount,
          recordCount: observations.length,
        },
      };
    } finally {
      this.#inFlight = false;
    }
  }

  externalStableId(raw: SourceObservation): string {
    if (!/^layer-41\/globalid\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.externalKey)) {
      throw new FixtureParseError('ARCGIS_GLOBAL_ID_INVALID', 'Utegym identity must be layer 41 plus a valid GlobalID');
    }
    return raw.externalKey;
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return raw.envelope;
  }

  parse(captured: Record<string, unknown>, observationValue: SourceObservation): NormalizedSourceRecord {
    const envelope = readEnvelope(captured);
    const name = nonEmpty(envelope.name);
    if (!name) throw new FixtureParseError('MUNICIPAL_NAME_MISSING', 'Utegym Place requires a non-empty source name');
    const longitude = finiteNumber(envelope.location.longitude);
    const latitude = finiteNumber(envelope.location.latitude);
    if (longitude === null || latitude === null || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
      throw new FixtureParseError('MUNICIPAL_LOCATION_INVALID', 'Utegym Place requires valid EPSG:4326 coordinates');
    }

    const streetAddress = joinAddress(nonEmpty(envelope.street), envelope.houseNumber);
    return {
      sourceKey: JONKOPING_UTEGYM_SOURCE_KEY,
      externalKey: observationValue.externalKey,
      entityType: 'PLACE',
      observedAt: envelope.modifiedAt ?? observationValue.observedAt,
      names: [{ value: name, language: 'sv', kind: 'OFFICIAL' }],
      place: {
        entityType: 'PLACE',
        canonicalName: name,
        latitude,
        longitude,
        status: 'UNKNOWN',
        streetAddress,
        postalCode: nonEmpty(envelope.postalCode),
        locality: nonEmpty(envelope.locality),
        officialUrl: nonEmpty(envelope.officialUrl),
        phone: nonEmpty(envelope.phone),
        resolution: 'NEW',
      },
      sourceCategories: ['municipal_layer=utegym'],
      explicitFacts: {
        layerId: envelope.layerId,
        globalId: envelope.globalId,
        modifiedAt: envelope.modifiedAt,
      },
      permittedEvidenceRefs: [JONKOPING_UTEGYM_ENDPOINT],
    };
  }

  async #requestPage(offset: number, signal: AbortSignal): Promise<ArcGisPage> {
    const url = new URL(this.#endpoint);
    url.search = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: OUT_FIELDS,
      returnGeometry: 'true',
      returnZ: 'false',
      outSR: '4326',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    }).toString();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await this.#fetch(url, {
          headers: { 'user-agent': 'Lemon-Going-Out-Search/0.1 (bounded SRC-02 trial)' },
          signal: AbortSignal.any([signal, timeoutSignal]),
        });
      } catch (error) {
        if (attempt === 0 && !signal.aborted) {
          await this.#sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new ArcGisFetchError(
          timeoutSignal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
          'bounded Utegym request failed',
          null,
          { cause: error },
        );
      }

      if (TRANSIENT_STATUS.has(response.status) && attempt === 0) {
        await this.#sleep(retryDelay(response.headers.get('retry-after')));
        continue;
      }
      if (!response.ok) {
        throw new ArcGisFetchError('HTTP_ERROR', `ArcGIS returned HTTP ${response.status}`, response.status);
      }
      const contentLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new ArcGisFetchError('RESPONSE_TOO_LARGE', 'ArcGIS response exceeds the bounded size limit');
      }
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
        throw new ArcGisFetchError('RESPONSE_TOO_LARGE', 'ArcGIS response exceeds the bounded size limit');
      }
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch (error) {
        throw new ArcGisFetchError('INVALID_RESPONSE', 'ArcGIS response is not JSON', response.status, { cause: error });
      }
      if (!isArcGisPage(value)) {
        throw new ArcGisFetchError('INVALID_RESPONSE', 'ArcGIS response lacks a feature array', response.status);
      }
      const wkid = value.spatialReference?.latestWkid ?? value.spatialReference?.wkid;
      if (wkid !== 4326) {
        throw new ArcGisFetchError('CRS_MISMATCH', 'ArcGIS did not honor the requested EPSG:4326 output');
      }
      return value;
    }
    throw new ArcGisFetchError('SERVER_OVERLOAD', 'bounded Utegym request exhausted its single retry');
  }
}

function observation(feature: ArcGisFeature, fetchedAt: string): SourceObservation {
  const attributes = feature.attributes ?? {};
  const globalId = normalizeGlobalId(attributes.GlobalID);
  if (!globalId) throw new ArcGisFetchError('STABLE_ID_MISSING', 'Utegym feature lacks a valid GlobalID');
  const modifiedAt = timestamp(attributes.andrad_datum);
  const envelope: UtegymEnvelope = {
    layerId: JONKOPING_UTEGYM_LAYER_ID,
    globalId,
    name: attributes.name,
    location: { longitude: feature.geometry?.x, latitude: feature.geometry?.y },
    officialUrl: attributes.visit_url,
    street: attributes.street,
    houseNumber: attributes.house_number,
    postalCode: attributes.postcode,
    locality: attributes.city,
    phone: attributes.phone,
    modifiedAt,
  };
  return {
    externalKey: `layer-41/globalid/${globalId}`,
    sourceUrl: JONKOPING_UTEGYM_ENDPOINT,
    fetchedAt,
    observedAt: modifiedAt ?? fetchedAt,
    envelope,
  };
}

function readEnvelope(value: Record<string, unknown>): UtegymEnvelope {
  const globalId = normalizeGlobalId(value.globalId);
  const location = value.location;
  if (value.layerId !== JONKOPING_UTEGYM_LAYER_ID || !globalId || !location || typeof location !== 'object') {
    throw new FixtureParseError('MUNICIPAL_ENVELOPE_INVALID', 'captured Utegym envelope has invalid source identity or geometry');
  }
  const candidate = value as Record<string, unknown> & { location: Record<string, unknown> };
  return {
    layerId: JONKOPING_UTEGYM_LAYER_ID,
    globalId,
    name: candidate.name,
    location: { longitude: candidate.location.longitude, latitude: candidate.location.latitude },
    officialUrl: candidate.officialUrl,
    street: candidate.street,
    houseNumber: candidate.houseNumber,
    postalCode: candidate.postalCode,
    locality: candidate.locality,
    phone: candidate.phone,
    modifiedAt: typeof candidate.modifiedAt === 'string' ? candidate.modifiedAt : null,
  };
}

function isArcGisPage(value: unknown): value is ArcGisPage {
  return typeof value === 'object' && value !== null && Array.isArray((value as ArcGisPage).features);
}

function normalizeGlobalId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^\{/, '').replace(/\}$/, '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null;
}

function timestamp(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function joinAddress(street: string | undefined, houseNumber: unknown): string | undefined {
  const number = typeof houseNumber === 'number' && Number.isSafeInteger(houseNumber)
    ? String(houseNumber)
    : nonEmpty(houseNumber);
  const joined = [street, number].filter(Boolean).join(' ');
  return joined || undefined;
}

function retryDelay(retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1_000, 10_000) : RETRY_DELAY_MS;
}
