import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  createSearchClient,
  createSearchRequest,
  initialSearchState,
  rejectSearch,
  resolveSearch,
  showSemanticDegraded,
  startSearch,
} from '../../apps/mobile/src/search.ts';
import { formatEventTime, formatEventVenue } from '../../apps/mobile/src/event-presentation.ts';
import { localizedText } from '../../apps/mobile/src/localization.ts';
import { parseActiveTaxonomy, taxonomyLabel } from '../../apps/mobile/src/taxonomy.ts';
import type { EventCard, SearchResponseV1 } from '../../packages/contracts/src/index.ts';

const EDGE_URL = 'http://127.0.0.1:54321/functions/v1/search';
const response: SearchResponseV1 = {
  requestId: '97000000-0000-4000-8000-000000000001',
  semanticDegraded: false,
  metadata: { limit: 10, resultCount: 1 },
  results: [{
    canonicalId: 'f94d8c23-055a-4db3-9d78-7b0ea329e36e',
    type: 'PLACE',
    name: 'Evergreen Restaurang & Pizzeria',
    categories: [{ id: 'dining', slug: 'dining', label: 'Dining' }],
    location: { latitude: 57.781, longitude: 14.163 },
    placeStatus: 'UNKNOWN',
  }],
};
const event: EventCard = {
  canonicalId: 'f94d8c23-055a-4db3-9d78-7b0ea329e36f',
  type: 'EVENT',
  title: 'Lördagskonsert med ett ovanligt långt men helt faktabaserat evenemangsnamn',
  categories: [{ id: 'live-music', slug: 'live-music', label: 'Live music' }],
  startsAt: '2026-08-22T17:00:00.000Z',
  endsAt: '2026-08-22T19:30:00.000Z',
  timezone: 'Europe/Stockholm',
  venue: {
    canonicalPlaceId: 'f94d8c23-055a-4db3-9d78-7b0ea329e36e',
    name: 'Evergreen Restaurang & Pizzeria',
  },
  location: { latitude: 57.781, longitude: 14.163, locality: 'Jönköping' },
  status: 'SCHEDULED',
};

const mixedResponse: SearchResponseV1 = {
  ...response,
  metadata: { limit: 10, resultCount: 2 },
  results: [event, response.results[0]!],
};

describe('MOB-01 search client and state', () => {
  it('calls only the configured Edge URL with the public request contract', async () => {
    const fetchImpl = vi.fn(async () => Response.json(response));
    const client = createSearchClient(EDGE_URL, fetchImpl as typeof fetch);
    const request = createSearchRequest('  Evergreen Restaurang & Pizzeria  ');

    await expect(client(request)).resolves.toEqual(response);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(EDGE_URL);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' });
    expect(JSON.stringify(fetchImpl.mock.calls[0]?.[1])).not.toMatch(/service|secret|rpc|rest\/v1/i);
    expect(request.query).toBe('Evergreen Restaurang & Pizzeria');
    expect(request.entityTypes).toEqual(['PLACE', 'EVENT']);
  });

  it('renders factual Place state from a valid Edge response', () => {
    expect(resolveSearch(1, 1, response)).toEqual({
      status: 'results', results: response.results, semanticDegraded: false,
    });
  });

  it('models loading, empty, and recoverable error states', () => {
    expect(initialSearchState).toEqual({ status: 'idle', results: [] });
    expect(startSearch()).toEqual({ status: 'loading', results: [] });
    expect(resolveSearch(2, 2, { ...response, metadata: { limit: 10, resultCount: 0 }, results: [] }))
      .toEqual({ status: 'empty', results: [], semanticDegraded: false });
    expect(rejectSearch(2, 2)).toEqual({
      status: 'error', results: [], message: 'SEARCH_UNAVAILABLE',
    });
    expect(resolveSearch(3, 3, response)?.status).toBe('results');
  });

  it('prevents stale responses from replacing a newer request', () => {
    expect(resolveSearch(2, 1, response)).toBeNull();
    expect(rejectSearch(2, 1)).toBeNull();
  });

  it('turns malformed safe responses and failures into recoverable errors', async () => {
    const malformed = createSearchClient(EDGE_URL, (async () => Response.json({ results: [] })) as typeof fetch);
    const failed = createSearchClient(EDGE_URL, (async () => { throw new Error('network'); }) as typeof fetch);
    await expect(malformed(createSearchRequest('Evergreen'))).rejects.toThrow('temporarily unavailable');
    await expect(failed(createSearchRequest('Evergreen'))).rejects.toThrow('network');
  });

  it('rejects an absent Edge configuration', () => {
    expect(() => createSearchClient('')).toThrow('not configured');
  });

  it('contains no backend credential or direct database path in mobile source/config', async () => {
    const files = await Promise.all([
      readFile(new URL('../../apps/mobile/App.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../../apps/mobile/src/search.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../apps/mobile/app.json', import.meta.url), 'utf8'),
    ]);
    const source = files.join('\n');
    expect(source).not.toMatch(/LEMON_SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|service[_-]?role|embedding.*key/i);
    expect(source).not.toMatch(/api\.search_v1|\/rest\/v1|\/rpc\//i);
  });
});

describe('MOB-02 bilingual discovery', () => {
  it('provides the required English and Swedish presentation strings', () => {
    expect(localizedText('en')).toMatchObject({
      searchPlaceholder: 'Search places and events', search: 'Search', loading: 'Searching',
      noResults: 'No results found.', retry: 'Retry', browse: 'Browse categories', results: 'Results',
    });
    expect(localizedText('sv')).toMatchObject({
      searchPlaceholder: 'Sök platser och evenemang', search: 'Sök', loading: 'Söker',
      noResults: 'Inga resultat hittades.', retry: 'Försök igen', browse: 'Bläddra bland kategorier', results: 'Resultat',
    });
  });

  it('keeps literal query text independent of the UI language', () => {
    const swedishQuery = 'restauranger i Jönköping';
    const englishQuery = 'restaurants in Jönköping';
    expect(createSearchRequest(swedishQuery, 'en').query).toBe(swedishQuery);
    expect(createSearchRequest(englishQuery, 'sv').query).toBe(englishQuery);
    expect(createSearchRequest('thai restauranger', 'sv').query).toBe('thai restauranger');
  });

  it('loads active taxonomy labels by stable ID and switches only their presentation', async () => {
    const reference = await readFile(new URL('../../reference/taxonomy/active-going-out.v1.yaml', import.meta.url), 'utf8');
    const nodes = parseActiveTaxonomy(reference);
    const dining = nodes.find((node) => node.slug === 'dining');
    expect(dining).toMatchObject({ id: '15904283-fd01-5fc3-ac00-c42e62e8422e', parentId: '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1' });
    expect(taxonomyLabel(dining!, 'en')).toBe('Dining');
    expect(taxonomyLabel(dining!, 'sv')).toBe('Restauranger');
    expect(nodes).toHaveLength(52);
    expect(nodes.indexOf(dining!)).toBeGreaterThan(nodes.findIndex((node) => node.slug === 'food-and-dining'));
    expect(nodes.filter((node) => node.parentId === null).map((node) => node.slug)).toEqual([
      'food-and-dining', 'drinks-and-nightlife', 'activities-and-experiences',
    ]);
  });

  it('uses the existing empty-query taxonomy browse request without a fake label query', () => {
    const taxonomyNodeId = '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1';
    const request = createSearchRequest('', 'sv', taxonomyNodeId);
    expect(request).toMatchObject({ query: '', uiLocale: 'sv', taxonomyNodeId });
    expect(request.query).not.toContain('Mat och restauranger');
  });

  it('retains generation protection for text and category requests', () => {
    expect(resolveSearch(4, 3, response)).toBeNull();
    expect(rejectSearch(4, 3)).toBeNull();
  });
});

describe('MOB-03 Event and degraded search presentation', () => {
  it('accepts and preserves an Event result from the public contract', () => {
    const state = resolveSearch(1, 1, mixedResponse);
    expect(state).toMatchObject({ status: 'results', semanticDegraded: false });
    expect(state?.results[0]).toEqual(event);
  });

  it('formats a known-end Event in Stockholm time without changing its duration', () => {
    const formatted = formatEventTime(event, 'en');
    expect(formatted).toContain('19:00 CEST');
    expect(formatted).toContain('21:30 CEST');
    expect(formatted).toContain('–');
  });

  it('formats a point Event without inventing an end time', () => {
    const formatted = formatEventTime({ startsAt: event.startsAt }, 'en');
    expect(formatted).toContain('19:00 CEST');
    expect(formatted).not.toContain('–');
    expect(formatted.match(/\d{2}:\d{2}/g)).toHaveLength(1);
  });

  it('distinguishes linked and standalone venue facts without inferring a link', () => {
    expect(formatEventVenue(event, localizedText('en'))).toBe('At Evergreen Restaurang & Pizzeria');
    expect(formatEventVenue({ venue: { name: 'Rådhusparken' } }, localizedText('en'))).toBe('Venue: Rådhusparken');
    expect(formatEventVenue({ venue: { name: 'Rådhusparken' } }, localizedText('sv'))).toBe('Plats: Rådhusparken');
  });

  it('formats Event dates in English and Swedish', () => {
    expect(formatEventTime(event, 'en')).toMatch(/Sat.*22 Aug/i);
    expect(formatEventTime(event, 'sv')).toMatch(/lör.*22 aug/i);
  });

  it('formats a future cross-day Event with both factual dates', () => {
    const formatted = formatEventTime({
      startsAt: '2026-09-04T21:30:00.000Z',
      endsAt: '2026-09-05T00:30:00.000Z',
    }, 'en');
    expect(formatted).toMatch(/4 Sept.*23:30 CEST.*5 Sept.*02:30 CEST/);
  });

  it('keeps fall-back DST instants unambiguous', () => {
    const formatted = formatEventTime({
      startsAt: '2026-10-25T00:30:00.000Z',
      endsAt: '2026-10-25T01:30:00.000Z',
    }, 'en');
    expect(formatted).toContain('02:30 CEST–02:30 CET');
  });

  it('models semantic degradation as localized successful results, not an error', () => {
    const degraded = resolveSearch(2, 2, { ...mixedResponse, semanticDegraded: true });
    expect(degraded).toMatchObject({ status: 'results', semanticDegraded: true });
    expect(degraded?.results).toEqual(mixedResponse.results);
    expect(showSemanticDegraded(degraded!)).toBe(true);
    expect(localizedText('en').semanticDegraded).toBe('Showing standard search results.');
    expect(localizedText('sv').semanticDegraded).toBe('Visar vanliga sökresultat.');
  });

  it('hides the degradation state for a normal successful response', () => {
    const normal = resolveSearch(3, 3, mixedResponse);
    expect(normal).toMatchObject({
      status: 'results', semanticDegraded: false,
    });
    expect(showSemanticDegraded(normal!)).toBe(false);
  });

  it('preserves loading, empty, and actual error as distinct states', () => {
    expect(startSearch().status).toBe('loading');
    const empty = resolveSearch(1, 1, { ...response, results: [], semanticDegraded: true });
    const error = rejectSearch(1, 1);
    expect(empty?.status).toBe('empty');
    expect(showSemanticDegraded(empty!)).toBe(true);
    expect(error?.status).toBe('error');
    expect(showSemanticDegraded(error!)).toBe(false);
  });

  it('preserves received server order across mixed Place and Event results', () => {
    const state = resolveSearch(1, 1, mixedResponse);
    expect(state?.results.map((result) => result.canonicalId)).toEqual(
      mixedResponse.results.map((result) => result.canonicalId),
    );
  });

  it('drops an unsupported result type without crashing or reordering supported results', () => {
    const unsupported = { canonicalId: 'unsupported', type: 'UNKNOWN' };
    const payload = {
      ...mixedResponse,
      metadata: { limit: 10, resultCount: 3 },
      results: [event, unsupported, response.results[0]],
    } as unknown as SearchResponseV1;
    expect(resolveSearch(1, 1, payload)?.results).toEqual([event, response.results[0]]);
  });

  it('contains no client reranking, provider call, or direct database path', async () => {
    const files = await Promise.all([
      readFile(new URL('../../apps/mobile/App.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../../apps/mobile/src/search.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../apps/mobile/src/event-presentation.ts', import.meta.url), 'utf8'),
      readFile(new URL('../../apps/mobile/package.json', import.meta.url), 'utf8'),
    ]);
    const source = files.join('\n');
    expect(source).not.toMatch(/\.sort\(|toSorted\(|voyage|embedding.*provider/i);
    expect(source).not.toMatch(/api\.search_v1|\/rest\/v1|\/rpc\/|service[_-]?role/i);
  });
});
