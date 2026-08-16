import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROVIDER,
  EmbeddingRequestError,
  requestVoyageEmbedding,
} from '../packages/embedding/src/voyage-client.ts';
import type { EvalCorpusRecordV1 } from '../packages/evaluation/src/index.ts';
import { normalizeForEdgeSearch } from '../supabase/functions/search/normalization.ts';
import {
  buildSemanticQueryInput,
  classifySemanticFailure,
  SEMANTIC_QUERY_TEMPLATE_VERSION,
  SEMANTIC_TIMEOUT_MS,
  SemanticCircuitBreaker,
} from '../supabase/functions/search/semantic.ts';

const QUERY_IDS = Array.from({ length: 10 }, (_, index) => (
  `eval-v1-dev-semantic-occasion-language-${String(index + 1).padStart(2, '0')}`
));
const args = process.argv.slice(2);
const outputPath = resolve(requiredArg('--output'));
const spacingMs = Number(optionalArg('--provider-spacing-ms') ?? '31000');
if (!Number.isInteger(spacingMs) || spacingMs < 31_000) throw new Error('PROVIDER_SPACING_UNSAFE');
const apiKey = process.env.VOYAGE_API_KEY;
if (!apiKey) throw new Error('VOYAGE_API_KEY_REQUIRED');

const root = new URL('../', import.meta.url);
const corpusText = await readFile(new URL('evaluation/corpus/corpus.v1.jsonl', root), 'utf8');
const records = corpusText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as EvalCorpusRecordV1);
const selected = QUERY_IDS.map((queryId) => {
  const record = records.find((candidate) => candidate.query_id === queryId && candidate.split === 'DEV');
  if (!record || record.family !== 'semantic_occasion_language' || !['en', 'sv'].includes(record.language)) {
    throw new Error(`REPRESENTATIVE_DEV_QUERY_MISSING:${queryId}`);
  }
  const normalizedQuery = normalizeForEdgeSearch(record.query).preserving;
  return {
    queryId,
    language: record.language,
    providerInput: buildSemanticQueryInput(normalizedQuery, null, undefined),
  };
});

const breaker = new SemanticCircuitBreaker();
const results: Array<Record<string, unknown>> = [];
let lastProviderStart = -Infinity;
for (const query of selected) {
  const waitMs = Math.max(0, lastProviderStart + spacingMs - Date.now());
  if (waitMs > 0) await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
  const startedAt = Date.now();
  lastProviderStart = startedAt;
  const circuitBefore = breaker.isOpen(startedAt) ? 'OPEN' : 'CLOSED';
  const acquired = breaker.acquire(startedAt);
  if (!acquired) {
    results.push({
      queryId: query.queryId,
      language: query.language,
      attempted: false,
      outcome: 'CIRCUIT_SUPPRESSED',
      providerTimeoutMs: SEMANTIC_TIMEOUT_MS,
      circuitBefore,
      circuitAfter: breaker.isOpen(Date.now()) ? 'OPEN' : 'CLOSED',
    });
    continue;
  }

  let httpStatus: number | null = null;
  const timer = performance.now();
  try {
    const vector = await requestVoyageEmbedding(query.providerInput, 'query', apiKey, {
      timeoutMs: SEMANTIC_TIMEOUT_MS,
      fetch: async (request, init) => {
        const response = await fetch(request, init);
        httpStatus = response.status;
        return response;
      },
    });
    const elapsedMs = performance.now() - timer;
    breaker.success();
    results.push({
      queryId: query.queryId,
      language: query.language,
      attempted: true,
      outcome: 'SUCCESS',
      httpStatus,
      providerTimeoutMs: SEMANTIC_TIMEOUT_MS,
      providerLatencyMs: elapsedMs,
      requestLatencyMs: elapsedMs,
      validDimension: vector.length === EMBEDDING_DIMENSION,
      finiteVector: vector.every(Number.isFinite),
      providerInputFingerprint: sha256(query.providerInput),
      vectorFingerprint: sha256(Buffer.from(new Float32Array(vector).buffer)),
      circuitBefore,
      circuitAfter: breaker.isOpen(Date.now()) ? 'OPEN' : 'CLOSED',
    });
  } catch (error) {
    const elapsedMs = performance.now() - timer;
    const classified = classifySemanticFailure(error);
    breaker.failure(Date.now(), classified.qualifying);
    results.push({
      queryId: query.queryId,
      language: query.language,
      attempted: true,
      outcome: classified.reason === 'TIMEOUT' ? 'TIMEOUT' : 'FAILURE',
      httpStatus,
      errorClass: error instanceof EmbeddingRequestError ? error.errorClass : 'UNKNOWN',
      errorCode: error instanceof EmbeddingRequestError ? error.errorCode : 'UNKNOWN',
      providerTimeoutMs: SEMANTIC_TIMEOUT_MS,
      providerLatencyMs: elapsedMs,
      requestLatencyMs: elapsedMs,
      validDimension: false,
      finiteVector: false,
      providerInputFingerprint: sha256(query.providerInput),
      circuitBefore,
      circuitAfter: breaker.isOpen(Date.now()) ? 'OPEN' : 'CLOSED',
    });
  }
}

const attempted = results.filter((result) => result.attempted === true);
const successes = attempted.filter((result) => result.outcome === 'SUCCESS');
const latencies = attempted.map((result) => result.providerLatencyMs as number).sort((a, b) => a - b);
const reportWithoutChecksum = {
  reportVersion: 'final-eval-provider-recovery-01.v1',
  contract: {
    provider: EMBEDDING_PROVIDER,
    model: EMBEDDING_MODEL,
    revision: EMBEDDING_MODEL_REVISION,
    inputType: 'query',
    dimension: EMBEDDING_DIMENSION,
    queryTemplateVersion: SEMANTIC_QUERY_TEMPLATE_VERSION,
    timeoutMs: SEMANTIC_TIMEOUT_MS,
    providerSpacingMs: spacingMs,
    concurrency: 1,
  },
  probe: {
    selectedQueryIds: QUERY_IDS,
    attempted: attempted.length,
    succeeded: successes.length,
    timeouts: attempted.filter((result) => result.outcome === 'TIMEOUT').length,
    rateLimited: attempted.filter((result) => result.httpStatus === 429).length,
    otherFailures: attempted.filter((result) => !['SUCCESS', 'TIMEOUT'].includes(result.outcome as string)).length,
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.at(-1) ?? null,
    },
  },
  results,
  guards: {
    searchRpcCalled: false,
    corpusWritten: false,
    judgmentsLoaded: false,
    documentEmbeddingsGenerated: false,
    sealedAccessed: false,
    adversarialAccessed: false,
  },
};
const report = { ...reportWithoutChecksum, contentChecksum: sha256(stableJson(reportWithoutChecksum)) };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(report.probe));

function optionalArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function requiredArg(name: string): string {
  const value = optionalArg(name);
  if (!value) throw new Error(`${name.slice(2).replaceAll('-', '_').toUpperCase()}_REQUIRED`);
  return value;
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  return values[Math.ceil(quantile * values.length) - 1] ?? null;
}

function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
