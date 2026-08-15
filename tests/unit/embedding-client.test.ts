import { describe, expect, it, vi } from 'vitest';
import {
  createAttemptKey,
  EMBEDDING_CONFIG_VERSION,
  EMBEDDING_DIMENSION,
  EMBEDDING_DOCUMENT_INPUT_TYPE,
  EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
  EMBEDDING_QUERY_INPUT_TYPE,
  requestVoyageEmbedding,
  requestVoyageEmbeddings,
  type EmbeddingTarget,
  validateSelectedEmbeddingConfig,
  validateEmbeddingVector,
} from '../../packages/embedding/src/index.ts';

const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index + 1) / 10_000);
const target: EmbeddingTarget = {
  documentId: '10000000-0000-0000-0000-000000000001',
  entityId: '20000000-0000-0000-0000-000000000001',
  entityType: 'PLACE',
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

function voyageBatchResponse(embeddings: unknown[]): Response {
  return new Response(JSON.stringify({
    object: 'list',
    data: embeddings.map((embedding, index) => ({ object: 'embedding', embedding, index })),
    model: EMBEDDING_MODEL,
    usage: { total_tokens: 12 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('EMBED-01A Voyage client', () => {
  it('pins the selected trial config and both input types', () => {
    expect(validateSelectedEmbeddingConfig({
      version: EMBEDDING_CONFIG_VERSION,
      provider: EMBEDDING_PROVIDER,
      model: EMBEDDING_MODEL,
      revision: 'voyage-4-preflight-v1',
      dimension: EMBEDDING_DIMENSION,
      documentInputType: EMBEDDING_DOCUMENT_INPUT_TYPE,
      queryInputType: EMBEDDING_QUERY_INPUT_TYPE,
      documentVersion: 'search-document-v1',
      documentTemplateVersion: EMBEDDING_DOCUMENT_TEMPLATE_VERSION,
      batchSize: 8,
      corpusLimit: 500,
    })).toMatchObject({
      provider: 'voyage',
      model: 'voyage-4',
      dimension: 1024,
      documentInputType: 'document',
      queryInputType: 'query',
    });
  });

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

  it('sends multiple document inputs in one request and returns provider token usage', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ input: ['first', 'second'] });
      return voyageBatchResponse([vector, vector]);
    });
    await expect(requestVoyageEmbeddings(['first', 'second'], 'document', 'test-key', {
      fetch: fetchMock as typeof fetch,
    })).resolves.toEqual({ embeddings: [vector, vector], totalTokens: 12 });
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

  it('captures bounded Retry-After metadata on HTTP 429', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '45' } }));
    await expect(requestVoyageEmbedding('input', 'document', 'test-key', {
      fetch: fetchMock as typeof fetch,
    })).rejects.toMatchObject({ errorCode: 'PROVIDER_RATE_LIMIT', retryAfterMs: 45_000 });
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
      [new Response(JSON.stringify({ model: EMBEDDING_MODEL, data: [{ index: 1, embedding: vector }] }), {
        status: 200,
      }), 'INVALID_RESPONSE'],
      [new Response(JSON.stringify({ model: EMBEDDING_MODEL, data: [{ index: 0 }] }), {
        status: 200,
      }), 'VECTOR_MISSING'],
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
