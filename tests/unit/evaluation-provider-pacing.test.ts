import { describe, expect, it } from 'vitest';

import { createEvaluationProviderPacer } from '../../packages/evaluation/src/provider-pacing.ts';

describe('evaluation provider pacing', () => {
  it('spaces sequential provider calls and reports rolling limits', async () => {
    let clock = 0;
    const invocations: Array<{ at: number; timeoutMs: number }> = [];
    const pacer = createEvaluationProviderPacer({
      spacingMs: 31_000,
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
      request: async (_text, timeoutMs) => {
        invocations.push({ at: clock, timeoutMs });
        return { embedding: [1], totalTokens: 100 };
      },
    });
    await pacer.embed('one', 700);
    await pacer.embed('two', 700);
    await pacer.embed('three', 700);
    expect(invocations).toEqual([
      { at: 0, timeoutMs: 700 },
      { at: 31_000, timeoutMs: 700 },
      { at: 62_000, timeoutMs: 700 },
    ]);
    expect(pacer.snapshot()).toEqual({
      spacingMs: 31_000,
      requestCount: 3,
      successfulRequestCount: 3,
      reportedInputTokens: 300,
      observedMaxRpm: 2,
      observedMaxTpm: 200,
      rateLimitCount: 0,
      retryAfterMs: [],
      providerElapsedMs: { count: 3, p50: 0, p95: 0, max: 0 },
    });
  });

  it('honors Retry-After and retries a rate-limited call', async () => {
    let clock = 0;
    let calls = 0;
    const pacer = createEvaluationProviderPacer({
      spacingMs: 31_000,
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
      request: async () => {
        calls += 1;
        if (calls === 1) throw Object.assign(new Error('rate limited'), { errorCode: 'PROVIDER_RATE_LIMIT', retryAfterMs: 45_000 });
        return { embedding: [1], totalTokens: 80 };
      },
    });
    await expect(pacer.embed('one', 700)).resolves.toEqual([1]);
    expect(clock).toBe(45_000);
    expect(pacer.snapshot()).toMatchObject({ requestCount: 2, successfulRequestCount: 1, rateLimitCount: 1, retryAfterMs: [45_000] });
  });

  it('stops after three consecutive rate limits', async () => {
    let clock = 0;
    const error = Object.assign(new Error('rate limited'), { errorCode: 'PROVIDER_RATE_LIMIT', retryAfterMs: null });
    const pacer = createEvaluationProviderPacer({
      spacingMs: 31_000,
      now: () => clock,
      sleep: async (milliseconds) => { clock += milliseconds; },
      request: async () => { throw error; },
    });
    await expect(pacer.embed('one', 700)).rejects.toBe(error);
    expect(pacer.snapshot()).toMatchObject({ requestCount: 3, rateLimitCount: 3, observedMaxRpm: 2 });
  });
});
