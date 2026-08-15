import { normalizeForEdgeSearch } from './normalization.ts';
import type { SearchRpcClient, SearchRpcParams, SearchRpcRow } from './types.ts';
import {
  parseTimeExpression,
  STOCKHOLM_TIME_ZONE,
} from '../../../packages/time-parser/src/index.ts';

type UiLocale = 'en' | 'sv';
type EntityType = 'PLACE' | 'EVENT';
type SearchRequestV1 = {
  query: string;
  uiLocale: UiLocale;
  scopeId: string;
  location?: { latitude: number; longitude: number; radiusMeters?: number };
  taxonomyNodeId?: string;
  entityTypes?: EntityType[];
  time?: { start: string; end: string };
  limit?: number;
};
type CategoryCard = { id: string; slug: string; label: string };
type PlaceCard = {
  canonicalId: string;
  type: 'PLACE';
  name: string;
  categories: CategoryCard[];
  location: { latitude: number; longitude: number };
  distanceMeters?: number;
  factualSummary?: string;
  hours?: { state: 'OPEN' | 'CLOSED' | 'UNKNOWN'; text?: string };
  placeStatus: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'UNKNOWN';
};
type EventCard = {
  canonicalId: string;
  type: 'EVENT';
  title: string;
  categories: CategoryCard[];
  startsAt: string;
  endsAt?: string;
  timezone: string;
  venue: { canonicalPlaceId?: string; name: string };
  location: { latitude: number; longitude: number };
  distanceMeters?: number;
  status: 'SCHEDULED';
};
type SearchResponseV1 = {
  requestId: string;
  semanticDegraded: boolean;
  metadata: { limit: number; resultCount: number };
  results: Array<PlaceCard | EventCard>;
};
type SearchErrorResponseV1 = {
  requestId: string;
  error: { code: string; message: string; retryable: boolean };
};

const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const REQUEST_KEYS = new Set([
  'query', 'uiLocale', 'scopeId', 'location', 'taxonomyNodeId', 'entityTypes', 'time', 'limit',
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUERY_CODE_POINTS = 160;
const MAX_QUERY_BYTES = 512;
const MAX_RADIUS_METERS = 50_000;

type HandlerDependencies = {
  client: SearchRpcClient;
  randomUUID?: () => string;
  clock?: () => Date;
};

class PublicRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly publicMessage: string;
  readonly retryable: boolean;

  constructor(
    status: number,
    code: string,
    publicMessage: string,
    retryable = false,
  ) {
    super(publicMessage);
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryable = retryable;
  }
}

export function createSearchHandler({
  client,
  randomUUID = () => crypto.randomUUID(),
  clock = () => new Date(),
}: HandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    const suppliedRequestId = request.headers.get('x-request-id');
    const requestId = suppliedRequestId && UUID_PATTERN.test(suppliedRequestId)
      ? suppliedRequestId
      : randomUUID();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return errorResponse(requestId, 405, 'METHOD_NOT_ALLOWED', 'Only POST is supported.', false, {
        Allow: 'POST, OPTIONS',
      });
    }

    try {
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new PublicRequestError(400, 'INVALID_REQUEST', 'Request body must use JSON.');
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new PublicRequestError(400, 'MALFORMED_JSON', 'Request body must be valid JSON.');
      }
      let searchRequest = validateRequest(body);
      if (!searchRequest.time) {
        const parsedTime = parseTimeExpression(searchRequest.query, {
          now: clock(),
          timeZone: STOCKHOLM_TIME_ZONE,
        });
        if (parsedTime?.status === 'AMBIGUOUS') {
          throw new PublicRequestError(422, 'AMBIGUOUS_TIME', 'Time expression is ambiguous.');
        }
        if (parsedTime?.status === 'PARSED') {
          searchRequest = {
            ...searchRequest,
            query: parsedTime.lexicalText,
            time: parsedTime.interval,
          };
        }
      }
      let normalized: { preserving: string; accentless: string };
      try {
        normalized = normalizeForEdgeSearch(searchRequest.query);
      } catch {
        invalidRequest();
      }
      if (!normalized.preserving && !searchRequest.taxonomyNodeId && !searchRequest.time) {
        throw new PublicRequestError(400, 'QUERY_REQUIRED', 'A query, taxonomy filter, or time is required.');
      }

      const params = toRpcParams(searchRequest, requestId, normalized);
      let rpcResult: Awaited<ReturnType<ReturnType<SearchRpcClient['schema']>['rpc']>>;
      try {
        rpcResult = await client.schema('api').rpc('search_v1', params);
      } catch {
        throw new PublicRequestError(503, 'DATABASE_UNAVAILABLE', 'Search is temporarily unavailable.', true);
      }
      const { data, error } = rpcResult;
      if (error) throw mapRpcError(error.code);
      if (!data) throw new PublicRequestError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.', true);

      const results = data.map(shapeCard);
      const response: SearchResponseV1 = {
        requestId,
        semanticDegraded: data.some((row) => row.semantic_degraded),
        metadata: { limit: searchRequest.limit ?? 10, resultCount: results.length },
        results,
      };
      return jsonResponse(response, 200, requestId);
    } catch (error) {
      if (error instanceof PublicRequestError) {
        return errorResponse(requestId, error.status, error.code, error.publicMessage, error.retryable);
      }
      return errorResponse(requestId, 500, 'INTERNAL_ERROR', 'Search could not be completed.', false);
    }
  };
}

function validateRequest(value: unknown): SearchRequestV1 {
  if (!isRecord(value) || hasExtraKeys(value, REQUEST_KEYS)) invalidRequest();
  if (typeof value.query !== 'string') invalidRequest();
  const codePoints = [...value.query].length;
  const bytes = new TextEncoder().encode(value.query).byteLength;
  if (codePoints > MAX_QUERY_CODE_POINTS || bytes > MAX_QUERY_BYTES) {
    throw new PublicRequestError(400, 'QUERY_TOO_LONG', 'Query exceeds the supported length.');
  }
  if (value.uiLocale !== 'en' && value.uiLocale !== 'sv') invalidRequest();
  if (typeof value.scopeId !== 'string' || !UUID_PATTERN.test(value.scopeId)) invalidRequest();
  const location = validateLocation(value.location);
  const taxonomyNodeId = optionalUuid(value.taxonomyNodeId);
  const entityTypes = validateEntityTypes(value.entityTypes);
  const time = validateTime(value.time);
  const limit = value.limit === undefined ? undefined : value.limit;
  if (limit !== undefined && (
    typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > 20
  )) invalidRequest();

  return {
    query: value.query,
    uiLocale: value.uiLocale,
    scopeId: value.scopeId,
    ...(location ? { location } : {}),
    ...(taxonomyNodeId ? { taxonomyNodeId } : {}),
    ...(entityTypes ? { entityTypes } : {}),
    ...(time ? { time } : {}),
    ...(limit !== undefined ? { limit: limit as number } : {}),
  };
}

function validateLocation(value: unknown): SearchRequestV1['location'] {
  if (value === undefined) return undefined;
  if (!isRecord(value) || hasExtraKeys(value, new Set(['latitude', 'longitude', 'radiusMeters']))) invalidRequest();
  const { latitude, longitude, radiusMeters } = value;
  if (!isFiniteNumber(latitude) || latitude < -90 || latitude > 90
    || !isFiniteNumber(longitude) || longitude < -180 || longitude > 180
    || (radiusMeters !== undefined && (
      typeof radiusMeters !== 'number' || !Number.isInteger(radiusMeters)
      || radiusMeters < 1 || radiusMeters > MAX_RADIUS_METERS
    ))) invalidRequest();
  return {
    latitude,
    longitude,
    ...(radiusMeters !== undefined ? { radiusMeters: radiusMeters as number } : {}),
  };
}

function validateEntityTypes(value: unknown): SearchRequestV1['entityTypes'] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > 2
    || new Set(value).size !== value.length
    || value.some((item) => item !== 'PLACE' && item !== 'EVENT')) invalidRequest();
  return value as Array<'PLACE' | 'EVENT'>;
}

function validateTime(value: unknown): SearchRequestV1['time'] {
  if (value === undefined) return undefined;
  if (!isRecord(value) || hasExtraKeys(value, new Set(['start', 'end']))
    || typeof value.start !== 'string' || typeof value.end !== 'string') invalidRequest();
  const start = Date.parse(value.start);
  const end = Date.parse(value.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new PublicRequestError(422, 'TIME_INVALID', 'Time interval is invalid.');
  }
  return { start: value.start, end: value.end };
}

function optionalUuid(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalidRequest();
  return value;
}

function toRpcParams(
  request: SearchRequestV1,
  requestId: string,
  normalized: { preserving: string; accentless: string },
): SearchRpcParams {
  return {
    p_request_id: requestId,
    p_query: request.query,
    p_query_norm: normalized.preserving,
    p_query_ascii: normalized.accentless,
    p_ui_locale: request.uiLocale,
    p_scope_id: request.scopeId,
    p_latitude: request.location?.latitude ?? null,
    p_longitude: request.location?.longitude ?? null,
    p_radius_m: request.location?.radiusMeters ?? null,
    p_taxonomy_node_id: request.taxonomyNodeId ?? null,
    p_entity_types: request.entityTypes ?? null,
    p_time_start: request.time?.start ?? null,
    p_time_end: request.time?.end ?? null,
    p_query_vector: null,
    p_embedding_provider: 'voyage',
    p_embedding_model: 'voyage-4',
    p_embedding_revision: 'voyage-4-preflight-v1',
    p_embedding_dimension: 1024,
    p_limit: request.limit ?? 10,
    p_search_config_version: 'event-01-time-v1',
  };
}

function shapeCard(row: SearchRpcRow): PlaceCard | EventCard {
  const categories = shapeCategories(row.categories);
  if (row.entity_type === 'PLACE' && row.place_status) {
    return {
      canonicalId: requiredString(row.entity_id),
      type: 'PLACE',
      name: requiredString(row.display_name),
      categories,
      location: { latitude: finite(row.latitude), longitude: finite(row.longitude) },
      ...(row.distance_m === null ? {} : { distanceMeters: integer(row.distance_m) }),
      ...(row.factual_summary ? { factualSummary: row.factual_summary } : {}),
      ...(shapeHours(row.opening_hours) ? { hours: shapeHours(row.opening_hours) } : {}),
      placeStatus: row.place_status,
    };
  }
  if (row.entity_type === 'EVENT' && row.event_starts_at && row.event_timezone
    && row.event_status === 'SCHEDULED' && isRecord(row.venue)) {
    return {
      canonicalId: requiredString(row.entity_id),
      type: 'EVENT',
      title: requiredString(row.display_name),
      categories,
      startsAt: row.event_starts_at,
      ...(row.event_ends_at ? { endsAt: row.event_ends_at } : {}),
      timezone: row.event_timezone,
      venue: shapeVenue(row.venue),
      location: { latitude: finite(row.latitude), longitude: finite(row.longitude) },
      ...(row.distance_m === null ? {} : { distanceMeters: integer(row.distance_m) }),
      status: 'SCHEDULED',
    };
  }
  throw new Error('RPC returned an invalid public result.');
}

function shapeCategories(value: unknown): CategoryCard[] {
  if (!Array.isArray(value)) throw new Error('RPC returned invalid categories.');
  return value.map((item) => {
    if (!isRecord(item)) throw new Error('RPC returned invalid category.');
    return {
      id: requiredString(item.id),
      slug: requiredString(item.slug),
      label: requiredString(item.label),
    };
  });
}

function shapeHours(value: unknown): PlaceCard['hours'] | undefined {
  if (!isRecord(value) || !['OPEN', 'CLOSED', 'UNKNOWN'].includes(String(value.state))) return undefined;
  return {
    state: value.state as 'OPEN' | 'CLOSED' | 'UNKNOWN',
    ...(typeof value.text === 'string' ? { text: value.text } : {}),
  };
}

function shapeVenue(value: Record<string, unknown>): EventCard['venue'] {
  return {
    ...(typeof value.canonicalPlaceId === 'string' ? { canonicalPlaceId: value.canonicalPlaceId } : {}),
    name: requiredString(value.name),
  };
}

function mapRpcError(code: string | undefined): PublicRequestError {
  if (code === 'P0002') return new PublicRequestError(404, 'RESOURCE_NOT_FOUND', 'Requested search context was not found.');
  if (code === '22023') return new PublicRequestError(400, 'INVALID_REQUEST', 'Request parameters are invalid.');
  if (code === '55000') return new PublicRequestError(503, 'SEARCH_UNAVAILABLE', 'Search is temporarily unavailable.', true);
  return new PublicRequestError(503, 'DATABASE_UNAVAILABLE', 'Search is temporarily unavailable.', true);
}

function errorResponse(
  requestId: string,
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  extraHeaders: Record<string, string> = {},
): Response {
  const body: SearchErrorResponseV1 = { requestId, error: { code, message, retryable } };
  return jsonResponse(body, status, requestId, extraHeaders);
}

function jsonResponse(value: unknown, status: number, requestId: string, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders, 'X-Request-Id': requestId },
  });
}

function invalidRequest(): never {
  throw new PublicRequestError(400, 'INVALID_REQUEST', 'Request does not match the search contract.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExtraKeys(value: Record<string, unknown>, allowed: Set<string>): boolean {
  return Object.keys(value).some((key) => !allowed.has(key));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('RPC returned an invalid string.');
  return value;
}

function finite(value: unknown): number {
  if (!isFiniteNumber(value)) throw new Error('RPC returned an invalid number.');
  return value;
}

function integer(value: unknown): number {
  if (!Number.isInteger(value)) throw new Error('RPC returned an invalid integer.');
  return value as number;
}
