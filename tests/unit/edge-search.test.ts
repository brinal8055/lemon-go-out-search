import { describe, expect, it, vi } from 'vitest';
import { createSearchHandler } from '../../supabase/functions/search/search-handler.ts';
import { normalizeForEdgeSearch } from '../../supabase/functions/search/normalization.ts';
import { createServerSearchClient } from '../../supabase/functions/search/server-client.ts';
import { normalizeForSearch } from '../../packages/normalization/src/index.ts';
import type {
  SearchRpcClient,
  SearchRpcParams,
  SearchRpcRow,
} from '../../supabase/functions/search/types.ts';

const REQUEST_ID = '94000000-0000-4000-8000-000000000001';
const SCOPE_ID = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6';
const ENTITY_ID = 'f94d8c23-055a-4db3-9d78-7b0ea329e36e';

const baseRequest = {
  query: 'Evergreen Restaurang & Pizzeria',
  uiLocale: 'en',
  scopeId: SCOPE_ID,
  entityTypes: ['PLACE'],
  limit: 10,
};

const placeRow: SearchRpcRow = {
  result_position: 1,
  entity_id: ENTITY_ID,
  entity_type: 'PLACE',
  display_name: 'Evergreen Restaurang & Pizzeria',
  categories: [{ id: 'category-1', slug: 'dining', label: 'Dining' }],
  latitude: 57.781,
  longitude: 14.163,
  distance_m: null,
  factual_summary: null,
  place_status: 'UNKNOWN',
  opening_hours: null,
  event_starts_at: null,
  event_ends_at: null,
  event_timezone: null,
  event_status: null,
  venue: null,
  semantic_used: false,
  semantic_degraded: false,
};

const eventRow: SearchRpcRow = {
  ...placeRow,
  entity_id: 'f94d8c23-055a-4db3-9d78-7b0ea329e370',
  entity_type: 'EVENT',
  display_name: 'Friluftsmuseets dag',
  factual_summary: null,
  place_status: null,
  event_starts_at: '2026-08-15T08:00:00.000Z',
  event_ends_at: '2026-08-15T12:00:00.000Z',
  event_timezone: 'Europe/Stockholm',
  event_status: 'SCHEDULED',
  venue: { name: 'Stadsparken Jönköping' },
};

function mockClient(result: { data: SearchRpcRow[] | null; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => result);
  const schema = vi.fn(() => ({ rpc }));
  return { client: { schema } as SearchRpcClient, schema, rpc };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/functions/v1/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('EDGE-01 search handler', () => {
  it.each([
    '  Café   Väster  ',
    "O'Learys–Jönköping",
    'BADA  BING!',
  ])('matches the shared norm-v1 result for %s', (input) => {
    expect(normalizeForEdgeSearch(input)).toEqual(normalizeForSearch(input));
  });

  it('returns one safely shaped Place after exactly one api.search_v1 call', async () => {
    const mocked = mockClient({ data: [placeRow], error: null });
    const handler = createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID });

    const response = await handler(post(baseRequest, { authorization: 'Bearer client-credential' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(mocked.schema).toHaveBeenCalledOnce();
    expect(mocked.schema).toHaveBeenCalledWith('api');
    expect(mocked.rpc).toHaveBeenCalledOnce();
    expect(mocked.rpc).toHaveBeenCalledWith('search_v1', expect.objectContaining({
      p_request_id: REQUEST_ID,
      p_query_norm: 'evergreen restaurang pizzeria',
      p_query_ascii: 'evergreen restaurang pizzeria',
      p_query_vector: null,
      p_search_config_version: 'event-01-time-v1',
    }));
    expect(body).toEqual({
      requestId: REQUEST_ID,
      semanticDegraded: false,
      metadata: { limit: 10, resultCount: 1 },
      results: [{
        canonicalId: ENTITY_ID,
        type: 'PLACE',
        name: 'Evergreen Restaurang & Pizzeria',
        categories: [{ id: 'category-1', slug: 'dining', label: 'Dining' }],
        location: { latitude: 57.781, longitude: 14.163 },
        placeStatus: 'UNKNOWN',
      }],
    });
    expect(JSON.stringify(body)).not.toMatch(/client-credential|result_position|semantic_used|diagnostic|score|payload/i);
  });

  it('uses TIME-01 for mixed and time-only queries while keeping exactly one RPC', async () => {
    const mocked = mockClient({ data: [eventRow], error: null });
    const handler = createSearchHandler({
      client: mocked.client,
      randomUUID: () => REQUEST_ID,
      clock: () => new Date('2026-08-15T07:00:00.000Z'),
    });

    const mixed = await handler(post({
      query: 'Friluftsmuseets dag tonight', uiLocale: 'en', scopeId: SCOPE_ID,
      entityTypes: ['EVENT'],
    }));
    expect(mixed.status).toBe(200);
    const mixedBody = await mixed.json();
    expect(mocked.rpc).toHaveBeenLastCalledWith('search_v1', expect.objectContaining({
      p_query: 'friluftsmuseets dag',
      p_query_norm: 'friluftsmuseets dag',
      p_time_start: '2026-08-15T16:00:00.000Z',
      p_time_end: '2026-08-16T00:00:00.000Z',
    }));
    expect(mixedBody.results[0]).toEqual(expect.objectContaining({
      type: 'EVENT', title: 'Friluftsmuseets dag', status: 'SCHEDULED',
    }));
    expect(JSON.stringify(mixedBody)).not.toMatch(
      /freshness|provenance|source_record|stageRank|contextMatch|manual/i,
    );

    const timeOnly = await handler(post({
      query: 'ikväll', uiLocale: 'sv', scopeId: SCOPE_ID, entityTypes: ['EVENT'],
    }));
    expect(timeOnly.status).toBe(200);
    expect(mocked.rpc).toHaveBeenCalledTimes(2);
    expect(mocked.rpc).toHaveBeenLastCalledWith('search_v1', expect.objectContaining({
      p_query: '', p_query_norm: '', p_query_ascii: '',
      p_time_start: '2026-08-15T16:00:00.000Z',
      p_time_end: '2026-08-16T00:00:00.000Z',
    }));
  });

  it('keeps unsupported temporal text lexical and rejects ambiguous time with safe 422', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({
      client: mocked.client,
      randomUUID: () => REQUEST_ID,
      clock: () => new Date('2026-08-15T07:00:00.000Z'),
    });
    const unsupported = await handler(post({
      query: 'sometime soon', uiLocale: 'en', scopeId: SCOPE_ID,
    }));
    expect(unsupported.status).toBe(200);
    expect(mocked.rpc).toHaveBeenCalledWith('search_v1', expect.objectContaining({
      p_query: 'sometime soon', p_time_start: null, p_time_end: null,
    }));

    const ambiguous = await handler(post({
      query: 'tomorrow next weekend', uiLocale: 'en', scopeId: SCOPE_ID,
    }));
    expect(ambiguous.status).toBe(422);
    expect((await ambiguous.json()).error.code).toBe('AMBIGUOUS_TIME');
    expect(mocked.rpc).toHaveBeenCalledOnce();
  });

  it('propagates a valid request ID and generates one for an invalid value', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID });
    const supplied = '95000000-0000-4000-8000-000000000002';
    const propagated = await handler(post(baseRequest, { 'x-request-id': supplied }));
    const generated = await handler(post(baseRequest, { 'x-request-id': 'not-a-uuid' }));
    expect((await propagated.json()).requestId).toBe(supplied);
    expect((await generated.json()).requestId).toBe(REQUEST_ID);
  });

  it('handles CORS preflight without a database call', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({ client: mocked.client });
    const response = await handler(new Request('http://localhost/functions/v1/search', { method: 'OPTIONS' }));
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('rejects unsupported methods without a database call', async () => {
    const mocked = mockClient({ data: [], error: null });
    const response = await createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID })(
      new Request('http://localhost/functions/v1/search'),
    );
    expect(response.status).toBe(405);
    expect((await response.json()).error.code).toBe('METHOD_NOT_ALLOWED');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON safely', async () => {
    const mocked = mockClient({ data: [], error: null });
    const request = new Request('http://localhost/functions/v1/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    });
    const response = await createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID })(request);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('MALFORMED_JSON');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('rejects non-JSON content and forbidden query controls', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID });
    const wrongContent = await handler(new Request('http://localhost/functions/v1/search', {
      method: 'POST', body: JSON.stringify(baseRequest),
    }));
    const control = await handler(post({ ...baseRequest, query: 'bad\rquery' }));
    expect(wrongContent.status).toBe(400);
    expect(control.status).toBe(400);
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['extra field', { ...baseRequest, functionName: 'private_function' }],
    ['invalid locale', { ...baseRequest, uiLocale: 'de' }],
    ['invalid scope', { ...baseRequest, scopeId: 'not-a-uuid' }],
    ['invalid limit', { ...baseRequest, limit: 21 }],
    ['invalid entity type', { ...baseRequest, entityTypes: ['VENUE'] }],
    ['invalid radius', { ...baseRequest, location: { latitude: 57, longitude: 14, radiusMeters: 50_001 } }],
  ])('rejects %s before calling the RPC', async (_name, body) => {
    const mocked = mockClient({ data: [], error: null });
    const response = await createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID })(post(body));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_REQUEST');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('rejects excessive Unicode and byte query lengths', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID });
    for (const query of ['a'.repeat(161), '😀'.repeat(129)]) {
      const response = await handler(post({ ...baseRequest, query }));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe('QUERY_TOO_LONG');
    }
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed and inverted time intervals', async () => {
    const mocked = mockClient({ data: [], error: null });
    const handler = createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID });
    const response = await handler(post({
      ...baseRequest,
      time: { start: '2026-08-14T12:00:00Z', end: '2026-08-14T11:00:00Z' },
    }));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe('TIME_INVALID');
    expect(mocked.rpc).not.toHaveBeenCalled();
  });

  it('returns a safe retryable error for RPC failures', async () => {
    const mocked = mockClient({ data: null, error: { code: 'XX000', message: 'raw database secret detail' } });
    const response = await createSearchHandler({ client: mocked.client, randomUUID: () => REQUEST_ID })(post(baseRequest));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).toContain('DATABASE_UNAVAILABLE');
    expect(text).not.toContain('raw database secret detail');
  });

  it('maps an unreachable database to the safe retryable response', async () => {
    const client = {
      schema: () => ({ rpc: async () => { throw new Error('connection detail'); } }),
    } as SearchRpcClient;
    const response = await createSearchHandler({ client, randomUUID: () => REQUEST_ID })(post(baseRequest));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).toContain('DATABASE_UNAVAILABLE');
    expect(text).not.toContain('connection detail');
  });
});

describe('EDGE-01 server RPC client', () => {
  it('uses only its backend credential for one fixed api.search_v1 request', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer backend-secret');
      expect(new Headers(init?.headers).get('content-profile')).toBe('api');
      expect(JSON.stringify(init?.body)).not.toContain('client-secret');
      return Response.json([]);
    });
    const client = createServerSearchClient('http://supabase.local/', 'backend-secret', fetchImpl as typeof fetch);
    const params = {
      p_request_id: REQUEST_ID,
      p_query: 'Evergreen',
      p_query_norm: 'evergreen',
      p_query_ascii: 'evergreen',
      p_ui_locale: 'en',
      p_scope_id: SCOPE_ID,
      p_latitude: null,
      p_longitude: null,
      p_radius_m: null,
      p_taxonomy_node_id: null,
      p_entity_types: ['PLACE'],
      p_time_start: null,
      p_time_end: null,
      p_query_vector: null,
      p_embedding_provider: 'voyage',
      p_embedding_model: 'voyage-4',
      p_embedding_revision: 'voyage-4-preflight-v1',
      p_embedding_dimension: 1024,
      p_limit: 10,
      p_search_config_version: 'event-01-time-v1',
    } satisfies SearchRpcParams;

    await client.schema('api').rpc('search_v1', params);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://supabase.local/rest/v1/rpc/search_v1');
  });
});
