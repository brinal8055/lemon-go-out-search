import type {
  EventCard,
  PlaceCard,
  SearchRequestV1,
  SearchResponseV1,
  UiLocale,
} from '@lemon/contracts';

export const JONKOPING_SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';

export type SearchResult = PlaceCard | EventCard;

export type SearchState =
  | { status: 'idle'; results: SearchResult[] }
  | { status: 'loading'; results: SearchResult[] }
  | { status: 'results'; results: SearchResult[]; semanticDegraded: boolean }
  | { status: 'empty'; results: SearchResult[]; semanticDegraded: boolean }
  | { status: 'error'; results: SearchResult[]; message: string };

export const initialSearchState: SearchState = { status: 'idle', results: [] };

export function startSearch(): SearchState {
  return { status: 'loading', results: [] };
}

export function createSearchRequest(
  query: string,
  uiLocale: UiLocale = 'en',
  taxonomyNodeId?: string,
): SearchRequestV1 {
  return {
    query: query.trim(),
    uiLocale,
    scopeId: JONKOPING_SCOPE_ID,
    entityTypes: ['PLACE', 'EVENT'],
    limit: 10,
    ...(taxonomyNodeId ? { taxonomyNodeId } : {}),
  };
}

export function createSearchClient(edgeUrl: string, fetchImpl: typeof fetch = fetch) {
  const endpoint = edgeUrl.trim();
  if (!endpoint) throw new Error('Search is not configured.');

  return async (request: SearchRequestV1, signal?: AbortSignal): Promise<SearchResponseV1> => {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isSearchResponse(payload)) {
      throw new Error('Search is temporarily unavailable.');
    }
    return payload;
  };
}

export function resolveSearch(
  currentGeneration: number,
  responseGeneration: number,
  response: SearchResponseV1,
): SearchState | null {
  if (responseGeneration !== currentGeneration) return null;
  const results = response.results.filter(isSupportedSearchResult);
  return results.length > 0
    ? { status: 'results', results, semanticDegraded: response.semanticDegraded }
    : { status: 'empty', results: [], semanticDegraded: response.semanticDegraded };
}

export function rejectSearch(currentGeneration: number, responseGeneration: number): SearchState | null {
  if (responseGeneration !== currentGeneration) return null;
  return { status: 'error', results: [], message: 'SEARCH_UNAVAILABLE' };
}

export function showSemanticDegraded(state: SearchState): boolean {
  return (state.status === 'results' || state.status === 'empty') && state.semanticDegraded;
}

function isSearchResponse(value: unknown): value is SearchResponseV1 {
  return isRecord(value)
    && typeof value.requestId === 'string'
    && typeof value.semanticDegraded === 'boolean'
    && isRecord(value.metadata)
    && Number.isInteger(value.metadata.limit)
    && Number.isInteger(value.metadata.resultCount)
    && Array.isArray(value.results);
}

function isPlaceCard(value: unknown): value is PlaceCard {
  return isRecord(value)
    && value.type === 'PLACE'
    && typeof value.canonicalId === 'string'
    && typeof value.name === 'string'
    && Array.isArray(value.categories)
    && isRecord(value.location)
    && typeof value.location.latitude === 'number'
    && typeof value.location.longitude === 'number'
    && (value.placeStatus === 'ACTIVE'
      || value.placeStatus === 'TEMPORARILY_CLOSED'
      || value.placeStatus === 'UNKNOWN');
}

function isEventCard(value: unknown): value is EventCard {
  return isRecord(value)
    && value.type === 'EVENT'
    && typeof value.canonicalId === 'string'
    && typeof value.title === 'string'
    && Array.isArray(value.categories)
    && typeof value.startsAt === 'string'
    && Number.isFinite(Date.parse(value.startsAt))
    && (value.endsAt === undefined
      || (typeof value.endsAt === 'string' && Number.isFinite(Date.parse(value.endsAt))))
    && typeof value.timezone === 'string'
    && isRecord(value.venue)
    && typeof value.venue.name === 'string'
    && (value.venue.canonicalPlaceId === undefined
      || typeof value.venue.canonicalPlaceId === 'string')
    && isRecord(value.location)
    && typeof value.location.latitude === 'number'
    && typeof value.location.longitude === 'number'
    && value.status === 'SCHEDULED';
}

function isSupportedSearchResult(value: unknown): value is SearchResult {
  return isPlaceCard(value) || isEventCard(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
