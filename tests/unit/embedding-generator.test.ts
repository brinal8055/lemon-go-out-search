import { describe, expect, it, vi } from 'vitest';
import {
  EMBEDDING_DIMENSION,
  EmbeddingRequestError,
  buildEmbeddingBatches,
  estimateEmbeddingInputTokens,
  type EmbeddingFailure,
  type EmbeddingTarget,
  processEmbeddingTargets,
  processEmbeddingTargetsControlled,
} from '../../packages/embedding/src/index.ts';

const vector = Array.from({ length: EMBEDDING_DIMENSION }, (_, index) => (index + 1) / 10_000);
const targets: EmbeddingTarget[] = [
  {
    documentId: '10000000-0000-0000-0000-000000000001',
    entityId: '20000000-0000-0000-0000-000000000001',
    entityType: 'PLACE',
    documentHash: 'a'.repeat(64),
    embeddingText: 'English Swedish mixed Place document',
    displayName: 'Place document',
  },
  {
    documentId: '10000000-0000-0000-0000-000000000002',
    entityId: '20000000-0000-0000-0000-000000000002',
    entityType: 'EVENT',
    documentHash: 'b'.repeat(64),
    embeddingText: 'English svenska mixed Event document',
    displayName: 'Event document',
  },
  {
    documentId: '10000000-0000-0000-0000-000000000003',
    entityId: '20000000-0000-0000-0000-000000000003',
    entityType: 'EVENT',
    documentHash: 'c'.repeat(64),
    embeddingText: 'Third Event document',
    displayName: 'Third Event document',
  },
];

describe('EMBED-01B offline generator', () => {
  it('retains partial success, preserves deterministic order, and reports bounded progress', async () => {
    const ready: string[] = [];
    const failed: Array<{ id: string; failure: EmbeddingFailure }> = [];
    const progress: string[] = [];
    const requestEmbedding = vi.fn(async (text: string) => {
      if (text === targets[1].embeddingText) {
        throw new EmbeddingRequestError('private provider detail', 'PROVIDER', 'PROVIDER_5XX');
      }
      return vector;
    });
    const report = await processEmbeddingTargets(targets, 2, {
      requestEmbedding,
      persistReady: async (target) => { ready.push(target.documentId); },
      persistFailed: async (target, failure) => { failed.push({ id: target.documentId, failure }); },
    }, (checkpoint) => progress.push(`${checkpoint.documentId}:${checkpoint.outcome}`));

    expect(report).toEqual({ attempted: 3, ready: 2, failed: 1 });
    expect(requestEmbedding.mock.calls.map(([text]) => text)).toEqual(targets.map(({ embeddingText }) => embeddingText));
    expect(ready).toEqual([targets[0].documentId, targets[2].documentId]);
    expect(failed).toEqual([{ id: targets[1].documentId, failure: {
      errorClass: 'PROVIDER', errorCode: 'PROVIDER_5XX',
    } }]);
    expect(progress).toEqual([
      `${targets[0].documentId}:READY`,
      `${targets[1].documentId}:FAILED`,
      `${targets[2].documentId}:READY`,
    ]);
    expect(JSON.stringify({ report, progress })).not.toContain('private provider detail');
    expect(JSON.stringify({ report, progress })).not.toContain(String(vector[0]));
  });

  it('records an in-flight document replacement as FAILED and never persists READY', async () => {
    const failures: EmbeddingFailure[] = [];
    const persistReady = vi.fn(async () => {
      throw new Error('SearchDocument is no longer active or hash-compatible');
    });
    const report = await processEmbeddingTargets([targets[0]], 1, {
      requestEmbedding: async () => vector,
      persistReady,
      persistFailed: async (_target, failure) => { failures.push(failure); },
    });
    expect(report).toEqual({ attempted: 1, ready: 0, failed: 1 });
    expect(persistReady).toHaveBeenCalledOnce();
    expect(failures).toEqual([{ errorClass: 'DOCUMENT', errorCode: 'DOCUMENT_CHANGED_IN_FLIGHT' }]);
  });

  it.each([
    [[1], 'WRONG_DIMENSION'],
    [Array(EMBEDDING_DIMENSION).fill(0), 'ZERO_VECTOR'],
    [[...vector.slice(0, -1), Number.NaN], 'NON_FINITE_VECTOR'],
    [[...vector.slice(0, -1), Number.POSITIVE_INFINITY], 'NON_FINITE_VECTOR'],
  ] as const)('persists invalid provider output as terminal FAILED (%s)', async (invalid, errorCode) => {
    const failures: EmbeddingFailure[] = [];
    const report = await processEmbeddingTargets([targets[1]], 1, {
      requestEmbedding: async () => invalid as number[],
      persistReady: async () => { throw new Error('READY must not be persisted'); },
      persistFailed: async (_target, failure) => { failures.push(failure); },
    });
    expect(report.failed).toBe(1);
    expect(failures).toEqual([{ errorClass: 'VALIDATION', errorCode }]);
  });

  it('builds ordered batches under both document-count and conservative token targets', () => {
    const sized = targets.map((target, index) => ({
      ...target,
      embeddingText: 'x'.repeat([2_000, 1_500, 1_000][index]),
    }));
    expect(buildEmbeddingBatches(sized, 5, 4_000).map((batch) => batch.map(({ documentId }) => documentId)))
      .toEqual([[sized[0].documentId, sized[1].documentId], [sized[2].documentId]]);
    expect(estimateEmbeddingInputTokens(['åäö'])).toBe(6);
  });

  it('batches provider calls, spaces them below two RPM, and preserves per-document attempts', async () => {
    let clock = 0;
    const requestTimes: number[] = [];
    const ready: string[] = [];
    const report = await processEmbeddingTargetsControlled(targets, 2, {
      requestEmbeddings: async (texts) => {
        requestTimes.push(clock);
        return { embeddings: texts.map(() => vector), totalTokens: texts.length * 5 };
      },
      persistReady: async (target) => { ready.push(target.documentId); },
      persistFailed: async () => { throw new Error('FAILED must not be persisted'); },
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
    });
    expect(requestTimes).toEqual([0, 31_000]);
    expect(ready).toEqual(targets.map(({ documentId }) => documentId));
    expect(report).toMatchObject({
      attempted: 3,
      ready: 3,
      failed: 0,
      rateLimit: { providerRequests: 2, observedMaxRpm: 2, successfulBatches: 2 },
    });
  });

  it('honors 429 backoff, records immutable failures, then creates READY retry attempts', async () => {
    let clock = 0;
    let calls = 0;
    const failed: string[] = [];
    const ready: string[] = [];
    const requestTimes: number[] = [];
    const report = await processEmbeddingTargetsControlled(targets.slice(0, 2), 2, {
      requestEmbeddings: async () => {
        requestTimes.push(clock);
        calls += 1;
        if (calls <= 2) throw new EmbeddingRequestError('bounded', 'RATE_LIMIT', 'PROVIDER_RATE_LIMIT');
        return { embeddings: [vector, vector], totalTokens: 10 };
      },
      persistReady: async (target) => { ready.push(target.documentId); },
      persistFailed: async (target) => { failed.push(target.documentId); },
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
    });
    expect(requestTimes).toEqual([0, 31_000, 91_000]);
    expect(failed).toEqual([...targets.slice(0, 2), ...targets.slice(0, 2)].map(({ documentId }) => documentId));
    expect(ready).toEqual(targets.slice(0, 2).map(({ documentId }) => documentId));
    expect(report).toMatchObject({
      attempted: 6,
      ready: 2,
      failed: 4,
      rateLimit: { providerRequests: 3, rateLimitedResponses: 2, successfulBatches: 1 },
    });
  });

  it('stops after three consecutive compliant 429 responses without unbounded retries', async () => {
    let clock = 0;
    const persistFailed = vi.fn(async () => undefined);
    await expect(processEmbeddingTargetsControlled(targets.slice(0, 1), 1, {
      requestEmbeddings: async () => {
        throw new EmbeddingRequestError('bounded', 'RATE_LIMIT', 'PROVIDER_RATE_LIMIT', 35_000);
      },
      persistReady: async () => { throw new Error('READY must not be persisted'); },
      persistFailed,
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
    })).rejects.toMatchObject({ errorCode: 'VOYAGE_RATE_LIMIT_CAPACITY_REQUIRED' });
    expect(persistFailed).toHaveBeenCalledTimes(3);
    expect(clock).toBe(70_000);
  });
});
