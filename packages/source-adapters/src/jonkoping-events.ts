import type {
  FetchResult,
  NormalizedSourceRecord,
  SourceAdapter,
  SourceObservation,
} from '@lemon/ingestion-domain';
import { FixtureParseError } from '@lemon/ingestion-domain';

export const JONKOPING_EVENT_SOURCE_KEY = 'JONKOPING_EVENT_CALENDAR';
export const JONKOPING_EVENT_SOURCE_URL = 'https://www.jonkoping.se/evenemangskalender';
export const JONKOPING_EVENT_POLICY = 'EXTRACTED_FIELDS_ONLY';
export const JONKOPING_EVENT_REFRESH_MODE = 'DELTA_ONLY';
export const JONKOPING_EVENT_TIME_ZONE = 'Europe/Stockholm';
export const JONKOPING_EVENT_ADAPTER_VERSION = 'jonkoping-event-v1';
export const JONKOPING_EVENT_PARSER_VERSION = 'jonkoping-event-parser-v1';
export const JONKOPING_EVENT_MAPPING_VERSION = 'source-taxonomy.v1';
export const JONKOPING_EVENT_MAPPING_REF =
  'source-taxonomy.v1:jonkoping-event-calendar-occurrence-events:events';

const SEARCH_TARGET = '12.76dae31e19adea1251f4cb88';
const SEARCH_PAGE_SIZE = 9;
const MAX_SEARCH_PAGES = 3;
const MAX_DETAIL_REQUESTS = 8;
const MAX_ACCEPTED = 5;
const HORIZON_DAYS = 30;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 524_288;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EDIT_URL_MARKER = 'https://www.jonkoping.se/evenemangskalender/skapa-evenemang?';

export type EventIdentityClassification =
  | 'ACCEPTED_SINGLE_OCCURRENCE'
  | 'UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY'
  | 'IDENTITY_BECAME_AMBIGUOUS';

export type PermittedEventOccurrence = {
  sourceEventUuid: string;
  externalKey: string;
  title: string;
  start: string;
  end: string | null;
  timeZone: typeof JONKOPING_EVENT_TIME_ZONE;
  venueName: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  categories: string[];
  sourceUrl: string;
  status: 'CANCELLED' | 'POSTPONED' | null;
};

export type EventDetailClassification = {
  classification: EventIdentityClassification;
  sourceEventUuid: string;
  occurrenceCount: number;
  event: PermittedEventOccurrence | null;
};

export type EventProbeResult = {
  sourceKey: typeof JONKOPING_EVENT_SOURCE_KEY;
  refreshMode: typeof JONKOPING_EVENT_REFRESH_MODE;
  searchRequests: number;
  detailRequests: number;
  fetchedHits: number;
  outsideHorizon: number;
  invalid: number;
  multiOccurrenceSkipped: number;
  identityAmbiguous: number;
  accepted: PermittedEventOccurrence[];
};

type SearchHit = {
  id: string;
  title: string;
  url: string;
  structuredStartDate: string;
  structuredEndDate?: string;
  location?: string;
  locationCoordinates?: string;
  categories?: string[];
};

type SearchPage = {
  searchHits: SearchHit[];
  searchInfo: { totalPages: number; currentPage: number };
};

export class EventSourceProbeError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.name = 'EventSourceProbeError';
    this.code = code;
    this.status = status;
  }
}

export type JonkopingEventProbeOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  previouslyAcceptedExternalKeys?: ReadonlySet<string>;
};

export class JonkopingEventProbe {
  readonly #fetch: typeof fetch;
  readonly #now: () => Date;
  readonly #previouslyAcceptedExternalKeys: ReadonlySet<string>;

  constructor(options: JonkopingEventProbeOptions = {}) {
    this.#fetch = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => new Date());
    this.#previouslyAcceptedExternalKeys = options.previouslyAcceptedExternalKeys ?? new Set();
  }

  async fetch(signal: AbortSignal): Promise<EventProbeResult> {
    const now = this.#now();
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000);
    const accepted: PermittedEventOccurrence[] = [];
    const seenUrls = new Set<string>();
    let searchRequests = 0;
    let detailRequests = 0;
    let fetchedHits = 0;
    let outsideHorizon = 0;
    let invalid = 0;
    let multiOccurrenceSkipped = 0;
    let identityAmbiguous = 0;

    for (let page = 1; page <= MAX_SEARCH_PAGES && accepted.length < MAX_ACCEPTED; page += 1) {
      const payload = parseSearchPage(await this.#request(buildSearchUrl(page, now), signal));
      searchRequests += 1;
      fetchedHits += payload.searchHits.length;
      for (const hit of payload.searchHits) {
        if (accepted.length >= MAX_ACCEPTED || detailRequests >= MAX_DETAIL_REQUESTS) break;
        if (!insideUpcomingHorizon(hit, now, horizonEnd)) {
          outsideHorizon += 1;
          continue;
        }
        if (seenUrls.has(hit.url)) continue;
        seenUrls.add(hit.url);
        detailRequests += 1;
        try {
          const detailHtml = await this.#request(hit.url, signal);
          const sourceUuid = sourceEventUuidFromDetail(detailHtml);
          const classification = classifyEventDetail(
            hit,
            detailHtml,
            this.#previouslyAcceptedExternalKeys.has(`event/${sourceUuid}`),
          );
          if (classification.event) accepted.push(classification.event);
          else if (classification.classification === 'IDENTITY_BECAME_AMBIGUOUS') identityAmbiguous += 1;
          else multiOccurrenceSkipped += 1;
        } catch (error) {
          if (error instanceof EventSourceProbeError && error.code === 'INVALID_EVENT_RECORD') invalid += 1;
          else throw error;
        }
      }
      if (page >= payload.searchInfo.totalPages || detailRequests >= MAX_DETAIL_REQUESTS) break;
    }

    accepted.sort((left, right) => left.externalKey.localeCompare(right.externalKey));
    return {
      sourceKey: JONKOPING_EVENT_SOURCE_KEY,
      refreshMode: JONKOPING_EVENT_REFRESH_MODE,
      searchRequests,
      detailRequests,
      fetchedHits,
      outsideHorizon,
      invalid,
      multiOccurrenceSkipped,
      identityAmbiguous,
      accepted,
    };
  }

  async #request(url: string, signal: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await this.#fetch(url, {
        headers: {
          accept: url.includes('sv.target=') ? 'application/json' : 'text/html',
          'user-agent': 'Lemon-Going-Out-Search/0.1 (bounded SRC-03B trial)',
          'x-requested-with': 'XMLHttpRequest',
        },
        signal: AbortSignal.any([signal, timeout]),
      });
    } catch (error) {
      throw new EventSourceProbeError(
        timeout.aborted || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))
          ? 'TIMEOUT'
          : 'NETWORK_ERROR',
        'bounded municipal Event request failed',
        null,
        { cause: error },
      );
    }
    if (!response.ok) {
      throw new EventSourceProbeError('HTTP_ERROR', `municipal Event source returned HTTP ${response.status}`, response.status);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new EventSourceProbeError('RESPONSE_TOO_LARGE', 'municipal Event response exceeds the size limit');
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new EventSourceProbeError('RESPONSE_TOO_LARGE', 'municipal Event response exceeds the size limit');
    }
    return text;
  }
}

export type JonkopingEventAdapterOptions = JonkopingEventProbeOptions & {
  deterministicVenueLinks?: ReadonlyMap<string, string>;
};

export class JonkopingEventAdapter implements SourceAdapter {
  readonly config = {
    sourceKey: JONKOPING_EVENT_SOURCE_KEY,
    sourceName: 'Jönköping municipality Event Calendar',
    scopeSlug: 'jonkoping-municipality',
    adapterVersion: JONKOPING_EVENT_ADAPTER_VERSION,
    parserVersion: JONKOPING_EVENT_PARSER_VERSION,
    mappingVersion: JONKOPING_EVENT_MAPPING_VERSION,
    refreshMode: JONKOPING_EVENT_REFRESH_MODE as typeof JONKOPING_EVENT_REFRESH_MODE,
  };

  readonly #probe: JonkopingEventProbe;
  readonly #now: () => Date;
  readonly #deterministicVenueLinks: ReadonlyMap<string, string>;
  lastFetchReport: EventProbeResult | null = null;

  constructor(options: JonkopingEventAdapterOptions = {}) {
    this.#probe = new JonkopingEventProbe(options);
    this.#now = options.now ?? (() => new Date());
    this.#deterministicVenueLinks = options.deterministicVenueLinks ?? new Map();
  }

  async fetch({ signal }: { signal: AbortSignal }): Promise<FetchResult> {
    const fetchedAt = this.#now().toISOString();
    const report = await this.#probe.fetch(signal);
    this.lastFetchReport = report;
    return {
      observations: report.accepted.map((event): SourceObservation => ({
        externalKey: event.externalKey,
        sourceUrl: event.sourceUrl,
        fetchedAt,
        observedAt: fetchedAt,
        envelope: { ...event },
      })),
      invalidCount: report.invalid,
      refreshUnitComplete: true,
      snapshotComplete: null,
      fetchMeta: {
        searchRequests: report.searchRequests,
        detailRequests: report.detailRequests,
        fetchedHits: report.fetchedHits,
        accepted: report.accepted.length,
        multiOccurrenceSkipped: report.multiOccurrenceSkipped,
        identityAmbiguous: report.identityAmbiguous,
      },
    };
  }

  externalStableId(raw: SourceObservation): string {
    if (!/^event\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw.externalKey)) {
      throw new FixtureParseError('EVENT_IDENTITY_INVALID', 'Event external key must be event/<source Event UUID>');
    }
    return raw.externalKey;
  }

  captureEnvelope(raw: SourceObservation): Record<string, unknown> {
    return raw.envelope;
  }

  parse(captured: Record<string, unknown>, observation: SourceObservation): NormalizedSourceRecord {
    const occurrence = readPermittedOccurrence(captured);
    if (occurrence.externalKey !== observation.externalKey
      || occurrence.externalKey !== `event/${occurrence.sourceEventUuid}`) {
      throw new FixtureParseError('EVENT_IDENTITY_CONFLICT', 'captured Event UUID and external key disagree');
    }
    const startsAt = new Date(occurrence.start);
    const endsAt = occurrence.end ? new Date(occurrence.end) : null;
    if (!Number.isFinite(startsAt.getTime())
      || (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))) {
      throw new FixtureParseError('EVENT_SCHEDULE_INVALID', 'Event requires a valid explicit start and optional later end');
    }
    if (occurrence.status === null && startsAt <= this.#now()) {
      throw new FixtureParseError('EVENT_NOT_FUTURE', 'manual SCHEDULED interpretation requires an explicit future start');
    }
    if (occurrence.status === null
      && /\b(inställd|inställt|framflyttad|framflyttat|cancelled|canceled|postponed)\b/iu.test(occurrence.title)) {
      throw new FixtureParseError(
        'EVENT_STATUS_INDICATION_REQUIRES_REVIEW',
        'manual SCHEDULED interpretation is blocked by a cancellation/postponement indication',
      );
    }
    const hasPoint = occurrence.latitude !== null && occurrence.longitude !== null;
    if ((occurrence.latitude === null) !== (occurrence.longitude === null)
      || (hasPoint && (Math.abs(occurrence.latitude!) > 90 || Math.abs(occurrence.longitude!) > 180))) {
      throw new FixtureParseError('EVENT_LOCATION_INVALID', 'Event coordinates must be a valid complete pair');
    }
    const venuePlaceId = this.#deterministicVenueLinks.get(occurrence.externalKey);
    if (!venuePlaceId && (!hasPoint || !occurrence.venueName?.trim())) {
      throw new FixtureParseError('EVENT_LOCATION_MISSING', 'standalone Event requires an explicit venue name and point');
    }
    const status = occurrence.status ?? 'SCHEDULED';
    const sourceCategories = [
      'source_type=official_event_calendar_occurrence',
      ...occurrence.categories.map((category) => `source_category=${category}`),
    ].sort();

    return {
      sourceKey: JONKOPING_EVENT_SOURCE_KEY,
      externalKey: occurrence.externalKey,
      entityType: 'EVENT',
      observedAt: observation.observedAt,
      names: [{ value: occurrence.title, language: 'sv', kind: 'OFFICIAL' }],
      event: {
        entityType: 'EVENT',
        canonicalName: occurrence.title,
        startsAt: startsAt.toISOString(),
        ...(endsAt ? { endsAt: endsAt.toISOString() } : {}),
        timezone: JONKOPING_EVENT_TIME_ZONE,
        status,
        statusSelectionMethod: occurrence.status === null ? 'MANUAL' : 'SOURCE_PRECEDENCE',
        ...(venuePlaceId ? { venuePlaceId } : {}),
        ...(occurrence.venueName ? { venueName: occurrence.venueName } : {}),
        ...(hasPoint ? { latitude: occurrence.latitude!, longitude: occurrence.longitude! } : {}),
        ...(occurrence.address ? { streetAddress: occurrence.address } : {}),
        ...(occurrence.city ? { locality: occurrence.city } : {}),
        countryCode: 'SE',
        informationUrl: occurrence.sourceUrl,
        taxonomySlug: 'events',
        taxonomyMappingRef: JONKOPING_EVENT_MAPPING_REF,
        resolution: 'NEW',
      },
      sourceCategories,
      explicitFacts: {
        sourceEventUuid: occurrence.sourceEventUuid,
        sourceStatus: occurrence.status,
        sourceCategories: occurrence.categories,
      },
      permittedEvidenceRefs: [occurrence.sourceUrl],
    };
  }
}

export function classifyEventDetail(
  hit: SearchHit,
  detailHtml: string,
  previouslyAccepted = false,
): EventDetailClassification {
  const metadata = permittedMetadataUrl(detailHtml);
  const sourceEventUuid = requiredUuid(metadata.searchParams.get('event.id'));
  const starts = epochList(metadata.searchParams.get('date.startDates'), true);
  const ends = epochList(metadata.searchParams.get('date.endDates'), false);
  if (ends.length !== 0 && ends.length !== starts.length) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'start/end schedule arrays have different cardinality');
  }
  if (starts.length > 1) {
    return {
      classification: previouslyAccepted
        ? 'IDENTITY_BECAME_AMBIGUOUS'
        : 'UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY',
      sourceEventUuid,
      occurrenceCount: starts.length,
      event: null,
    };
  }

  const title = nonEmpty(metadata.searchParams.get('event.name')) ?? nonEmpty(hit.title);
  if (!title || !validOfficialEventUrl(hit.url)) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'single occurrence lacks a permitted title or official URL');
  }
  const start = new Date(starts[0]);
  const end = ends.length === 0 || !Number.isFinite(ends[0]) ? null : new Date(ends[0]);
  if (!Number.isFinite(start.getTime()) || (end && (!Number.isFinite(end.getTime()) || end <= start))) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'single occurrence schedule is invalid');
  }
  const coordinates = coordinatesFromHit(hit.locationCoordinates);
  if (Date.parse(hit.structuredStartDate) !== start.getTime()
    || (hit.structuredEndDate && Date.parse(hit.structuredEndDate) !== end?.getTime())) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'detail schedule disagrees with the structured search record');
  }
  const venueName = nonEmpty(metadata.searchParams.get('event.placeName'));
  const city = nonEmpty(metadata.searchParams.get('event.city'));
  const address = nonEmpty(metadata.searchParams.get('event.street'));
  if (!venueName && !city && !address && !coordinates) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'single occurrence lacks venue or location evidence');
  }
  const event: PermittedEventOccurrence = {
    sourceEventUuid,
    externalKey: `event/${sourceEventUuid}`,
    title,
    start: start.toISOString(),
    end: end?.toISOString() ?? null,
    timeZone: JONKOPING_EVENT_TIME_ZONE,
    venueName,
    city,
    address,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    categories: [...new Set((hit.categories ?? []).map((category) => category.trim()).filter(Boolean))].sort(),
    sourceUrl: hit.url,
    status: null,
  };
  return { classification: 'ACCEPTED_SINGLE_OCCURRENCE', sourceEventUuid, occurrenceCount: 1, event };
}

export function compareRepeatedProbe(first: EventProbeResult, second: EventProbeResult): {
  repeatedExternalKeys: string[];
  scheduleChanges: number;
} {
  const secondByKey = new Map(second.accepted.map((event) => [event.externalKey, event]));
  const repeatedExternalKeys: string[] = [];
  let scheduleChanges = 0;
  for (const event of first.accepted) {
    const repeated = secondByKey.get(event.externalKey);
    if (!repeated || repeated.sourceEventUuid !== event.sourceEventUuid) continue;
    repeatedExternalKeys.push(event.externalKey);
    if (repeated.start !== event.start || repeated.end !== event.end) scheduleChanges += 1;
  }
  repeatedExternalKeys.sort();
  return { repeatedExternalKeys, scheduleChanges };
}

export function absenceHasMeaning(): false {
  return false;
}

function buildSearchUrl(page: number, now: Date): string {
  const url = new URL(JONKOPING_EVENT_SOURCE_URL);
  url.searchParams.set('sv.target', SEARCH_TARGET);
  url.searchParams.set(`sv.${SEARCH_TARGET}.route`, '/search');
  url.searchParams.set('pageMode', 'single');
  url.searchParams.set('page', String(page));
  url.searchParams.set('query', '');
  url.searchParams.set('timestamp', String(now.getTime()));
  url.searchParams.set('filters', '{}');
  return url.href;
}

function parseSearchPage(text: string): SearchPage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new EventSourceProbeError('INVALID_RESPONSE', 'municipal Event search response is not JSON', null, { cause: error });
  }
  if (!isObject(value) || !Array.isArray(value.searchHits) || !isObject(value.searchInfo)) {
    throw new EventSourceProbeError('INVALID_RESPONSE', 'municipal Event search response shape is invalid');
  }
  const searchHits = value.searchHits.filter(isSearchHit);
  if (searchHits.length !== value.searchHits.length || searchHits.length > SEARCH_PAGE_SIZE) {
    throw new EventSourceProbeError('INVALID_RESPONSE', 'municipal Event search page exceeds its bounded contract');
  }
  const totalPages = finiteInteger(value.searchInfo.totalPages);
  const currentPage = finiteInteger(value.searchInfo.currentPage);
  if (totalPages === null || currentPage === null) {
    throw new EventSourceProbeError('INVALID_RESPONSE', 'municipal Event search paging metadata is invalid');
  }
  return { searchHits, searchInfo: { totalPages, currentPage } };
}

function permittedMetadataUrl(html: string): URL {
  const start = html.indexOf(EDIT_URL_MARKER);
  if (start < 0) throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event detail lacks source metadata');
  const end = html.indexOf('</p>', start);
  if (end < 0) throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event source metadata is not bounded');
  const encoded = html.slice(start, end).replaceAll('&amp;', '&').trim();
  let url: URL;
  try {
    url = new URL(encoded);
  } catch (error) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event source metadata URL is invalid', null, { cause: error });
  }
  if (url.origin !== 'https://www.jonkoping.se' || url.pathname !== '/evenemangskalender/skapa-evenemang') {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event source metadata URL is not official');
  }
  return url;
}

function sourceEventUuidFromDetail(html: string): string {
  return requiredUuid(permittedMetadataUrl(html).searchParams.get('event.id'));
}

function epochList(value: string | null, required: boolean): number[] {
  if (!value?.trim()) {
    if (required) throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event lacks a source start schedule');
    return [];
  }
  const values = value.split(',').map((part) => Number(part));
  if (values.some((epoch) => !Number.isSafeInteger(epoch) || epoch <= 0)) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event schedule contains an invalid epoch');
  }
  return values;
}

function requiredUuid(value: string | null): string {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!UUID.test(normalized)) {
    throw new EventSourceProbeError('INVALID_EVENT_RECORD', 'event source UUID is missing or invalid');
  }
  return normalized;
}

function insideUpcomingHorizon(hit: SearchHit, now: Date, horizonEnd: Date): boolean {
  const start = Date.parse(hit.structuredStartDate);
  return Number.isFinite(start) && start > now.getTime() && start < horizonEnd.getTime();
}

function coordinatesFromHit(value: string | undefined): { latitude: number; longitude: number } | null {
  if (!value) return null;
  const [latitude, longitude, ...rest] = value.split(',').map((part) => Number(part.trim()));
  if (rest.length || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function validOfficialEventUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.jonkoping.se'
      && url.pathname.startsWith('/evenemangskalender/evenemangskalender/evenemang/');
  } catch {
    return false;
  }
}

function isSearchHit(value: unknown): value is SearchHit {
  return isObject(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.url === 'string'
    && typeof value.structuredStartDate === 'string'
    && (value.structuredEndDate === undefined || typeof value.structuredEndDate === 'string')
    && (value.location === undefined || typeof value.location === 'string')
    && (value.locationCoordinates === undefined || typeof value.locationCoordinates === 'string')
    && (value.categories === undefined
      || (Array.isArray(value.categories) && value.categories.every((category) => typeof category === 'string')));
}

function finiteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function nonEmpty(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readPermittedOccurrence(value: Record<string, unknown>): PermittedEventOccurrence {
  const allowed = new Set([
    'sourceEventUuid', 'externalKey', 'title', 'start', 'end', 'timeZone', 'venueName', 'city',
    'address', 'latitude', 'longitude', 'categories', 'sourceUrl', 'status',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))
    || typeof value.sourceEventUuid !== 'string'
    || typeof value.externalKey !== 'string'
    || typeof value.title !== 'string' || value.title.trim() === ''
    || typeof value.start !== 'string'
    || (value.end !== null && typeof value.end !== 'string')
    || value.timeZone !== JONKOPING_EVENT_TIME_ZONE
    || (value.venueName !== null && typeof value.venueName !== 'string')
    || (value.city !== null && typeof value.city !== 'string')
    || (value.address !== null && typeof value.address !== 'string')
    || (value.latitude !== null && typeof value.latitude !== 'number')
    || (value.longitude !== null && typeof value.longitude !== 'number')
    || !Array.isArray(value.categories) || value.categories.some((category) => typeof category !== 'string')
    || typeof value.sourceUrl !== 'string'
    || ![null, 'CANCELLED', 'POSTPONED'].includes(value.status as string | null)
  ) {
    throw new FixtureParseError('EVENT_ENVELOPE_INVALID', 'captured Event contains invalid or prohibited fields');
  }
  return value as PermittedEventOccurrence;
}
