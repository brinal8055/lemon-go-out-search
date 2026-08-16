import { describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_QUERY_INPUT_TYPE,
  EmbeddingRequestError,
  requestVoyageEmbedding,
} from '../../packages/embedding/src/voyage-client.ts';
import {
  buildSemanticQueryInput,
  CIRCUIT_OPEN_MS,
  SEMANTIC_CANDIDATE_CAP,
  SEMANTIC_CONFIG_VERSION,
  SEMANTIC_QUERY_TEMPLATE_VERSION,
  SEMANTIC_TIMEOUT_MS,
  SemanticCircuitBreaker,
  shouldEmbed,
  validateQueryVector,
} from '../../supabase/functions/search/semantic.ts';
import { recognizeTaxonomyQuery } from '../../supabase/functions/search/semantic-taxonomy.ts';
import { parseTimeExpression, STOCKHOLM_TIME_ZONE } from '../../packages/time-parser/src/index.ts';

const vector = (first = 1) => [first, ...Array.from({ length: EMBEDDING_DIMENSION - 1 }, () => 0)];

describe('SEM-01 deterministic query policy', () => {
  it('pins the selected query contract and tunables', () => {
    expect({
      config: SEMANTIC_CONFIG_VERSION,
      template: SEMANTIC_QUERY_TEMPLATE_VERSION,
      timeout: SEMANTIC_TIMEOUT_MS,
      cap: SEMANTIC_CANDIDATE_CAP,
      inputType: EMBEDDING_QUERY_INPUT_TYPE,
      dimension: EMBEDDING_DIMENSION,
    }).toEqual({
      config: 'noncollapse-v1',
      template: 'semantic-query-template-v1',
      timeout: 700,
      cap: 30,
      inputType: 'query',
      dimension: 1024,
    });
  });

  it.each([
    [{ normalizedQuery: 'anything', semanticEnabled: false }, 'SEMANTIC_DISABLED'],
    [{ normalizedQuery: 'anything', semanticEnabled: true, circuitOpen: true }, 'CIRCUIT_OPEN'],
    [{ normalizedQuery: '', semanticEnabled: true }, 'EMPTY_QUERY'],
    [{ normalizedQuery: '', semanticEnabled: true, hasTime: true }, 'TIME_ONLY'],
    [{ normalizedQuery: 'italian restaurants', semanticEnabled: true, recognizedTaxonomyOnly: true }, 'TAXONOMY_ONLY'],
    [{ normalizedQuery: 'evergreen pizzeria', semanticEnabled: true }, 'CONSERVATIVE_KNOWN_ITEM'],
  ] as const)('skips provider work conservatively: %j', (input, reason) => {
    expect(shouldEmbed(input)).toEqual({ shouldEmbed: false, reason });
  });

  it.each([
    ['things to do in jönköping', {}, 'BROAD_DISCOVERY'],
    ['saker att göra i jönköping', {}, 'BROAD_DISCOVERY'],
    ['date night ideas', {}, 'OCCASION_INTENT'],
    ['något för en dejt', {}, 'OCCASION_INTENT'],
    ['something casual', {}, 'OCCASION_INTENT'],
    ['any fun activities', {}, 'BROAD_DISCOVERY'],
    ['something fun', {}, 'BROAD_DISCOVERY'],
    ['dinner', { hasTaxonomyConstraint: true }, 'MIXED_CONSTRAINTS'],
    ['somewhere pleasant', { hasLocationConstraint: true }, 'BROAD_DISCOVERY'],
    ['things to do', { hasTime: true }, 'MIXED_CONSTRAINTS'],
    ['a quiet place suitable for conversation', {}, 'UNCERTAIN_MULTI_TOKEN'],
  ] as const)('embeds semantic intent: %s', (normalizedQuery, flags, reason) => {
    expect(shouldEmbed({ normalizedQuery, semanticEnabled: true, ...flags })).toEqual({
      shouldEmbed: true,
      reason,
    });
  });

  it('classifies a non-empty timed occasion query as mixed constraints', () => {
    const parsed = parseTimeExpression('place for casual dinner tonight', {
      now: new Date('2026-08-17T12:00:00.000Z'),
      timeZone: STOCKHOLM_TIME_ZONE,
    });
    expect(parsed).toMatchObject({ status: 'PARSED', lexicalText: 'place for casual dinner' });
    if (parsed?.status !== 'PARSED') throw new Error('TIME_PARSE_EXPECTED');

    expect(shouldEmbed({
      normalizedQuery: parsed.lexicalText,
      semanticEnabled: true,
      hasTime: true,
    })).toEqual({ shouldEmbed: true, reason: 'MIXED_CONSTRAINTS' });
  });

  it('keeps a recognized taxonomy-only query deterministic', () => {
    expect(shouldEmbed({
      normalizedQuery: 'casual',
      semanticEnabled: true,
      recognizedTaxonomyOnly: true,
    })).toEqual({ shouldEmbed: false, reason: 'TAXONOMY_ONLY' });
  });

  it('treats a taxonomy-recognized query with time as mixed constraints', () => {
    expect(shouldEmbed({
      normalizedQuery: 'casual',
      semanticEnabled: true,
      recognizedTaxonomyOnly: true,
      hasTime: true,
    })).toEqual({ shouldEmbed: true, reason: 'MIXED_CONSTRAINTS' });
  });

  it('recognizes accepted taxonomy labels plus one generic noun', () => {
    expect(recognizeTaxonomyQuery('italian restaurants')).toEqual(expect.objectContaining({
      id: 'd43e33db-0ad3-575c-8514-d01ccf700587',
      en: 'Italian',
      sv: 'Italiensk',
    }));
    expect(recognizeTaxonomyQuery('italiensk restaurang')).toEqual(expect.objectContaining({
      id: 'd43e33db-0ad3-575c-8514-d01ccf700587',
    }));
  });

  it('builds only deterministic normalized taxonomy/time context', () => {
    expect(buildSemanticQueryInput(
      'things to do',
      { en: 'Culture', sv: 'Kultur' },
      { start: '2026-08-15T16:00:00.000Z', end: '2026-08-16T00:00:00.000Z' },
    )).toBe([
      'query: things to do',
      'taxonomy: Culture | Kultur',
      'time: 2026-08-15T16:00:00.000Z / 2026-08-16T00:00:00.000Z',
    ].join('\n'));
  });
});

describe('SEM-01 Voyage query validation', () => {
  it('accepts one finite non-zero 1024 query vector and sends the exact contract once', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        input: ['query: things to do'],
        model: 'voyage-4',
        input_type: 'query',
        output_dimension: 1024,
        output_dtype: 'float',
        truncation: false,
      });
      return Response.json({ model: 'voyage-4', data: [{ index: 0, embedding: vector() }] });
    });
    await expect(requestVoyageEmbedding(
      'query: things to do', 'query', 'test-key', { fetch: fetchImpl as typeof fetch, timeoutMs: 700 },
    )).resolves.toHaveLength(1024);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing vector', undefined, 'VECTOR_MISSING'],
    ['wrong dimension', [1], 'WRONG_DIMENSION'],
    ['zero vector', vector(0), 'ZERO_VECTOR'],
    ['NaN', [Number.NaN, ...vector().slice(1)], 'NON_FINITE_VECTOR'],
    ['Infinity', [Number.POSITIVE_INFINITY, ...vector().slice(1)], 'NON_FINITE_VECTOR'],
  ])('rejects %s', (_name, value, code) => {
    expect(() => validateQueryVector(value)).toThrowError(expect.objectContaining({ errorCode: code }));
  });

  it.each([
    [429, 'PROVIDER_RATE_LIMIT'],
    [503, 'PROVIDER_5XX'],
  ])('surfaces HTTP %i without retry', async (status, errorCode) => {
    const fetchImpl = vi.fn(async () => new Response('provider detail', { status }));
    await expect(requestVoyageEmbedding('query: broad request', 'query', 'test-key', {
      fetch: fetchImpl as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({ errorCode }));
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([
    ['not-json', 'INVALID_JSON'],
    [JSON.stringify({ model: 'other', data: [{ index: 0, embedding: vector() }] }), 'INVALID_RESPONSE'],
    [JSON.stringify({ model: 'voyage-4', data: [] }), 'INVALID_RESPONSE'],
  ])('rejects malformed or incompatible provider response without retry', async (body, errorCode) => {
    const fetchImpl = vi.fn(async () => new Response(body, { status: 200 }));
    await expect(requestVoyageEmbedding('query: broad request', 'query', 'test-key', {
      fetch: fetchImpl as typeof fetch,
    })).rejects.toEqual(expect.objectContaining({ errorCode }));
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('enforces the request timeout with one provider attempt', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>(
      (_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
    ));
    await expect(requestVoyageEmbedding('query: broad request', 'query', 'test-key', {
      fetch: fetchImpl as typeof fetch,
      timeoutMs: 1,
    })).rejects.toEqual(expect.objectContaining({ errorCode: 'PROVIDER_TIMEOUT' }));
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

describe('SEM-01 isolate-local circuit breaker', () => {
  it('opens on the third qualifying failure and suppresses calls during cooldown', () => {
    const breaker = new SemanticCircuitBreaker();
    breaker.failure(0, true);
    expect(breaker.isOpen(0)).toBe(false);
    breaker.failure(1, true);
    expect(breaker.isOpen(1)).toBe(false);
    breaker.failure(2, true);
    expect(breaker.isOpen(2)).toBe(true);
    expect(breaker.acquire(2 + CIRCUIT_OPEN_MS - 1)).toBe(false);
  });

  it('allows one half-open probe, closes on success, and reopens on probe failure', () => {
    const breaker = new SemanticCircuitBreaker();
    for (let failure = 0; failure < 3; failure += 1) breaker.failure(failure, true);
    expect(breaker.acquire(2 + CIRCUIT_OPEN_MS)).toBe(true);
    expect(breaker.acquire(2 + CIRCUIT_OPEN_MS)).toBe(false);
    breaker.failure(2 + CIRCUIT_OPEN_MS, true);
    expect(breaker.isOpen(2 + CIRCUIT_OPEN_MS)).toBe(true);
    expect(breaker.acquire(2 + (2 * CIRCUIT_OPEN_MS))).toBe(true);
    breaker.success();
    expect(breaker.isOpen(2 + (2 * CIRCUIT_OPEN_MS))).toBe(false);
    expect(breaker.acquire(2 + (2 * CIRCUIT_OPEN_MS))).toBe(true);
  });

  it('starts each cold instance closed and ignores non-qualifying failures', () => {
    const first = new SemanticCircuitBreaker();
    const second = new SemanticCircuitBreaker();
    first.failure(0, false);
    first.failure(1, false);
    first.failure(2, false);
    expect(first.isOpen(2)).toBe(false);
    expect(second.isOpen(2)).toBe(false);
    expect(new EmbeddingRequestError('x', 'x', 'x')).toBeInstanceOf(Error);
  });
});
