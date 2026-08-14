import type { PlaceCard, SearchRequestV1, SearchResponseV1 } from '@lemon/contracts';

export const JONKOPING_SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';

export type SearchState =
  | { status: 'idle'; results: PlaceCard[] }
  | { status: 'loading'; results: PlaceCard[] }
  | { status: 'results'; results: PlaceCard[] }
  | { status: 'empty'; results: PlaceCard[] }
  | { status: 'error'; results: PlaceCard[]; message: string };

export const initialSearchState: SearchState = { status: 'idle', results: [] };

export function startSearch(): SearchState {
  return { status: 'loading', results: [] };
}

export function createSearchRequest(query: string): SearchRequestV1 {
  return {
    query: query.trim(),
    uiLocale: 'en',
    scopeId: JONKOPING_SCOPE_ID,
    entityTypes: ['PLACE'],
    limit: 10,
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
  const results = response.results.filter(isPlaceCard);
  return results.length > 0
    ? { status: 'results', results }
    : { status: 'empty', results: [] };
}

export function rejectSearch(currentGeneration: number, responseGeneration: number): SearchState | null {
  if (responseGeneration !== currentGeneration) return null;
  return { status: 'error', results: [], message: 'Search is temporarily unavailable. Try again.' };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
