type ProviderResult = { embedding: unknown; totalTokens: number | null };
type ProviderRequest = (input: string, timeoutMs: number) => Promise<ProviderResult>;
type RequestObservation = { startedAtMs: number; totalTokens: number };

export type EvaluationProviderPacingSnapshot = {
  spacingMs: number;
  requestCount: number;
  successfulRequestCount: number;
  reportedInputTokens: number;
  observedMaxRpm: number;
  observedMaxTpm: number;
  rateLimitCount: number;
  retryAfterMs: number[];
  providerElapsedMs: { count: number; p50: number | null; p95: number | null; max: number | null };
};

export function createEvaluationProviderPacer(input: {
  spacingMs: number;
  request: ProviderRequest;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}): {
  embed: (text: string, timeoutMs: number) => Promise<unknown>;
  snapshot: () => EvaluationProviderPacingSnapshot;
} {
  if (!Number.isInteger(input.spacingMs) || input.spacingMs < 31_000) throw new Error('PROVIDER_SPACING_UNSAFE');
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const observations: RequestObservation[] = [];
  const retryAfterMs: number[] = [];
  const providerElapsedMs: number[] = [];
  let lastRequestStartedAt: number | null = null;
  let blockedUntil = 0;
  let successfulRequestCount = 0;
  let rateLimitCount = 0;

  const embed = async (text: string, timeoutMs: number): Promise<unknown> => {
    let consecutiveRateLimits = 0;
    while (true) {
      const earliestStart = Math.max(blockedUntil, (lastRequestStartedAt ?? -Infinity) + input.spacingMs);
      if (earliestStart > now()) await sleep(earliestStart - now());
      const startedAtMs = now();
      lastRequestStartedAt = startedAtMs;
      const observation = { startedAtMs, totalTokens: 0 };
      observations.push(observation);
      try {
        const providerStartedAt = now();
        const result = await input.request(text, timeoutMs);
        providerElapsedMs.push(Math.max(0, now() - providerStartedAt));
        observation.totalTokens = result.totalTokens ?? 0;
        successfulRequestCount += 1;
        return result.embedding;
      } catch (error) {
        if (providerErrorCode(error) !== 'PROVIDER_RATE_LIMIT') throw error;
        rateLimitCount += 1;
        consecutiveRateLimits += 1;
        const suppliedRetry = providerRetryAfterMs(error);
        if (suppliedRetry !== null) retryAfterMs.push(suppliedRetry);
        if (consecutiveRateLimits >= 3) throw error;
        const fallback = input.spacingMs * (2 ** (consecutiveRateLimits - 1));
        blockedUntil = Math.max(blockedUntil, now() + (suppliedRetry ?? fallback));
      }
    }
  };

  return {
    embed,
    snapshot: () => ({
      spacingMs: input.spacingMs,
      requestCount: observations.length,
      successfulRequestCount,
      reportedInputTokens: observations.reduce((sum, item) => sum + item.totalTokens, 0),
      observedMaxRpm: rollingMaximum(observations, () => 1),
      observedMaxTpm: rollingMaximum(observations, ({ totalTokens }) => totalTokens),
      rateLimitCount,
      retryAfterMs: [...retryAfterMs],
      providerElapsedMs: percentiles(providerElapsedMs),
    }),
  };
}

function percentiles(values: number[]): { count: number; p50: number | null; p95: number | null; max: number | null } {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? null;
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1) ?? null };
}

function rollingMaximum(observations: RequestObservation[], value: (item: RequestObservation) => number): number {
  let maximum = 0;
  for (const end of observations) {
    maximum = Math.max(maximum, observations
      .filter(({ startedAtMs }) => startedAtMs > end.startedAtMs - 60_000 && startedAtMs <= end.startedAtMs)
      .reduce((sum, item) => sum + value(item), 0));
  }
  return maximum;
}

function providerErrorCode(error: unknown): unknown {
  return error !== null && typeof error === 'object' ? (error as { errorCode?: unknown }).errorCode : undefined;
}

function providerRetryAfterMs(error: unknown): number | null {
  const value = error !== null && typeof error === 'object' ? (error as { retryAfterMs?: unknown }).retryAfterMs : null;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
