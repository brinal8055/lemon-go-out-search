import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  createSearchClient,
  createSearchRequest,
  initialSearchState,
  rejectSearch,
  resolveSearch,
  startSearch,
} from '../../apps/mobile/src/search.ts';
import { localizedText } from '../../apps/mobile/src/localization.ts';
import { parseActiveTaxonomy, taxonomyLabel } from '../../apps/mobile/src/taxonomy.ts';
import type { SearchResponseV1 } from '../../packages/contracts/src/index.ts';

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
  });

  it('renders factual Place state from a valid Edge response', () => {
    expect(resolveSearch(1, 1, response)).toEqual({ status: 'results', results: response.results });
  });

  it('models loading, empty, and recoverable error states', () => {
    expect(initialSearchState).toEqual({ status: 'idle', results: [] });
    expect(startSearch()).toEqual({ status: 'loading', results: [] });
    expect(resolveSearch(2, 2, { ...response, metadata: { limit: 10, resultCount: 0 }, results: [] }))
      .toEqual({ status: 'empty', results: [] });
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
      searchPlaceholder: 'Search places', search: 'Search', loading: 'Searching',
      noResults: 'No places found.', retry: 'Retry', browse: 'Browse categories',
    });
    expect(localizedText('sv')).toMatchObject({
      searchPlaceholder: 'Sök platser', search: 'Sök', loading: 'Söker',
      noResults: 'Inga platser hittades.', retry: 'Försök igen', browse: 'Bläddra bland kategorier',
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
