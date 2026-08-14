import { describe, expect, it, vi } from 'vitest';
import {
  createAttemptKey,
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  requestVoyageEmbedding,
  type EmbeddingTarget,
  validateEmbeddingVector,
} from '../../packages/embedding/src/index.ts';

const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index + 1) / 10_000);
const target: EmbeddingTarget = {
  documentId: '10000000-0000-0000-0000-000000000001',
  entityId: '20000000-0000-0000-0000-000000000001',
  documentHash: 'a'.repeat(64),
  embeddingText: 'Evergreen Restaurang & Pizzeria',
  displayName: 'Evergreen Restaurang & Pizzeria',
};

function voyageResponse(embedding: unknown = vector, model = EMBEDDING_MODEL): Response {
  return new Response(JSON.stringify({
    object: 'list',
    data: [{ object: 'embedding', embedding, index: 0 }],
    model,
    usage: { total_tokens: 4 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('EMBED-01A Voyage client', () => {
  it.each(['document', 'query'] as const)('sends one bounded %s request and validates 1024 floats', async (inputType) => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        input: ['bounded input'],
        model: 'voyage-4',
        input_type: inputType,
        output_dimension: 1024,
        output_dtype: 'float',
        truncation: false,
      });
      expect(init?.method).toBe('POST');
      return voyageResponse();
    });
    const result = await requestVoyageEmbedding('bounded input', inputType, 'test-key', {
      fetch: fetchMock as typeof fetch,
    });
    expect(result).toEqual(vector);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects wrong dimension, non-finite values, and zero norm', () => {
    expect(() => validateEmbeddingVector([1], EMBEDDING_DIMENSION)).toThrowError(/dimension/);
    expect(() => validateEmbeddingVector([...vector.slice(0, -1), Number.NaN], EMBEDDING_DIMENSION))
      .toThrowError(/non-finite/);
    expect(() => validateEmbeddingVector(Array(EMBEDDING_DIMENSION).fill(0), EMBEDDING_DIMENSION))
      .toThrowError(/zero norm/);
  });

  it.each([
    [401, 'PROVIDER_AUTH'],
    [429, 'PROVIDER_RATE_LIMIT'],
    [422, 'PROVIDER_4XX'],
    [503, 'PROVIDER_5XX'],
  ])('classifies provider HTTP %i without reading or logging response content', async (status, code) => {
    const fetchMock = vi.fn(async () => new Response('not retained', { status }));
    await expect(requestVoyageEmbedding('input', 'document', 'test-key', {
      fetch: fetchMock as typeof fetch,
    })).rejects.toMatchObject({ errorCode: code });
  });

  it('classifies timeout and transport failures safely', async () => {
    const timeoutFetch = vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError'); });
    await expect(requestVoyageEmbedding('input', 'document', 'test-key', {
      fetch: timeoutFetch as typeof fetch,
    })).rejects.toMatchObject({ errorCode: 'PROVIDER_TIMEOUT' });
    const transportFetch = vi.fn(async () => { throw new Error('private upstream details'); });
    await expect(requestVoyageEmbedding('input', 'document', 'test-key', {
      fetch: transportFetch as typeof fetch,
    })).rejects.toMatchObject({ errorCode: 'PROVIDER_TRANSPORT' });
  });

  it('rejects invalid JSON, response shape, model, dimension, and vector values', async () => {
    const cases: Array<[Response, string]> = [
      [new Response('{', { status: 200 }), 'INVALID_JSON'],
      [new Response(JSON.stringify({ model: EMBEDDING_MODEL, data: [] }), { status: 200 }), 'INVALID_RESPONSE'],
      [voyageResponse(vector, 'other-model'), 'INVALID_RESPONSE'],
      [voyageResponse([1]), 'WRONG_DIMENSION'],
      [voyageResponse([...vector.slice(0, -1), Number.POSITIVE_INFINITY]), 'NON_FINITE_VECTOR'],
      [voyageResponse(Array(EMBEDDING_DIMENSION).fill(0)), 'ZERO_VECTOR'],
    ];
    for (const [response, errorCode] of cases) {
      const fetchMock = vi.fn(async () => response);
      await expect(requestVoyageEmbedding('input', 'document', 'test-key', {
        fetch: fetchMock as typeof fetch,
      })).rejects.toMatchObject({ errorCode });
    }
  });

  it('derives a deterministic unique attempt key from explicit attempt identity', () => {
    const first = createAttemptKey(target, 'attempt-1');
    expect(createAttemptKey(target, 'attempt-1')).toBe(first);
    expect(createAttemptKey(target, 'attempt-2')).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});
