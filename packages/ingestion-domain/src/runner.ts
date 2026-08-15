import { randomUUID } from 'node:crypto';
import type {
  IngestionStore,
  ProjectionOutcome,
  RunCounters,
  RunResult,
  SourceAdapter,
  SourceEvidenceExecution,
  StageTrace,
} from './types.ts';
import { FixtureParseError, IngestionRunError } from './types.ts';

export type RunIngestionOptions = {
  retryOfRunId?: string;
  executionId?: string;
  signal?: AbortSignal;
  projectionOrchestrator?: () => Promise<ProjectionOutcome>;
};

const PENDING_PROJECTION: ProjectionOutcome = {
  searchDocument: 'PENDING',
  embedding: 'PENDING',
  publication: 'PENDING',
};

export async function runIngestion(
  store: IngestionStore,
  adapter: SourceAdapter,
  options: RunIngestionOptions = {},
): Promise<RunResult> {
  const executionId = options.executionId ?? randomUUID();
  const signal = options.signal ?? new AbortController().signal;
  const idempotencyKey = [
    adapter.config.sourceKey,
    adapter.config.scopeSlug,
    adapter.config.adapterVersion,
    adapter.config.parserVersion,
    executionId,
  ].join(':');
  const runId = await store.startRun({
    idempotencyKey,
    config: adapter.config,
    retryOfRunId: options.retryOfRunId ?? null,
    snapshotKey: adapter.config.refreshMode === 'DELTA_ONLY' ? null : executionId,
  });
  const counters = emptyCounters();
  const stageTrace: StageTrace[] = [];
  const projectionOutcomes: ProjectionOutcome[] = [];
  let fetchResult: Awaited<ReturnType<SourceAdapter['fetch']>> | null = null;

  try {
    fetchResult = await adapter.fetch({ signal });
    validateFetchResult(adapter, fetchResult);
    counters.fetched = fetchResult.observations.length;
    counters.invalid = fetchResult.invalidCount ?? 0;
    stageTrace.push({ stage: 'fetch', externalKey: null, outcome: fetchResult.refreshUnitComplete ? 'COMPLETE' : 'PARTIAL' });

    for (const rawObservation of fetchResult.observations) {
      signal.throwIfAborted();
      const externalKey = adapter.externalStableId(rawObservation);
      const observation = { ...rawObservation, externalKey };
      const envelope = adapter.captureEnvelope(observation);
      const capture = await store.capture(runId, adapter.config, observation, envelope);
      incrementCapture(counters, capture.classification);
      stageTrace.push({ stage: 'capture/version', externalKey, outcome: capture.classification });

      const alreadySelected = capture.classification === 'UNCHANGED'
        && capture.expectedCurrentVersionId === capture.sourceRecordVersionId
        && capture.expectedCurrentParseAttemptId !== null
        && capture.selectedParserVersion === adapter.config.parserVersion;
      let normalized;
      let evidence: SourceEvidenceExecution;
      if (alreadySelected) {
        counters.valid += 1;
        evidence = {
          sourceRecordId: capture.sourceRecordId,
          sourceRecordVersionId: capture.sourceRecordVersionId,
          sourceRecordParseAttemptId: capture.expectedCurrentParseAttemptId!,
        };
        normalized = await store.readSelectedNormalized(evidence);
        stageTrace.push({ stage: 'parse/validate', externalKey, outcome: 'REUSED_SELECTED' });
      } else {
        const attemptId = await store.beginParseAttempt(
          runId,
          capture.sourceRecordVersionId,
          adapter.config.parserVersion,
        );
        try {
          normalized = adapter.parse(envelope, observation);
        } catch (error) {
          const errorCode = error instanceof FixtureParseError ? error.code : 'PARSER_ERROR';
          await store.failParseAttempt(attemptId, error instanceof Error ? error.name : 'ParserError', errorCode);
          counters.invalid += 1;
          stageTrace.push({ stage: 'parse/validate', externalKey, outcome: `FAILED:${errorCode}` });
          continue;
        }

        evidence = await store.succeedParseAttemptAndSelect({
          runId,
          parserVersion: adapter.config.parserVersion,
          attemptId,
          capture,
          normalized,
        });
        counters.valid += 1;
        stageTrace.push({ stage: 'parse/validate', externalKey, outcome: 'SUCCEEDED_SELECTED' });
      }

      const resolution = await store.resolve(evidence, normalized);
      stageTrace.push({ stage: 'resolve', externalKey, outcome: resolution.kind });
      if (resolution.kind === 'UNRESOLVED') {
        counters.unresolved += 1;
        continue;
      }

      const applied = await store.applyCanonical({
        evidence,
        candidate: normalized,
        mappingVersion: adapter.config.mappingVersion,
        beforeCommit: options.projectionOrchestrator ?? (async () => PENDING_PROJECTION),
      });
      if (applied.canonicalChanged) counters.canonicalApplied += 1;
      if (applied.published) counters.published += 1;
      if (applied.projection) projectionOutcomes.push(applied.projection);
      stageTrace.push({
        stage: 'canonical/taxonomy',
        externalKey,
        outcome: applied.canonicalChanged ? (resolution.kind === 'NEW' ? 'CREATED' : 'UPDATED') : 'UNCHANGED',
      });
      stageTrace.push({
        stage: 'projection/publication',
        externalKey,
        outcome: applied.projection ? 'PENDING' : 'NOT_REQUIRED',
      });
    }

    const status = fetchResult.refreshUnitComplete && counters.invalid === 0 && counters.unresolved === 0
      ? 'SUCCEEDED'
      : 'PARTIAL';
    counters.disappeared = await store.finishRun({
      runId,
      status,
      refreshMode: adapter.config.refreshMode,
      refreshUnitComplete: fetchResult.refreshUnitComplete,
      snapshotComplete: fetchResult.snapshotComplete,
      counters,
      observedExternalKeys: fetchResult.observations.map((observation) => adapter.externalStableId(observation)),
    });
    return { runId, status, counters, projectionOutcomes, stageTrace };
  } catch (error) {
    try {
      await store.finishRun({
        runId,
        status: 'FAILED',
        refreshMode: adapter.config.refreshMode,
        refreshUnitComplete: false,
        snapshotComplete: fetchResult?.snapshotComplete ?? (adapter.config.refreshMode === 'DELTA_ONLY' ? null : false),
        counters,
        observedExternalKeys: fetchResult?.observations.map((observation) => adapter.externalStableId(observation)) ?? [],
        errorCode: safeErrorCode(error),
      });
    } catch (finishError) {
      throw new AggregateError(
        [error, finishError],
        'ingestion failed and its run could not be finalized',
        { cause: finishError },
      );
    }
    throw new IngestionRunError(runId, counters, error);
  }
}

function validateFetchResult(
  adapter: SourceAdapter,
  result: Awaited<ReturnType<SourceAdapter['fetch']>>,
): void {
  if (adapter.config.refreshMode === 'DELTA_ONLY' && result.snapshotComplete !== null) {
    throw new Error('DELTA_ONLY adapter must return snapshotComplete=null');
  }
  if (adapter.config.refreshMode !== 'DELTA_ONLY' && result.snapshotComplete === null) {
    throw new Error('snapshot adapter must declare snapshot completeness');
  }
  const keys = result.observations.map((observation) => adapter.externalStableId(observation));
  if (result.invalidCount !== undefined
    && (!Number.isInteger(result.invalidCount) || result.invalidCount < 0)) {
    throw new Error('fetch invalidCount must be a non-negative integer');
  }
  if (new Set(keys).size !== keys.length || keys.some((key) => key.trim() === '')) {
    throw new Error('fetch result must contain unique non-empty external stable keys');
  }
}

function emptyCounters(): RunCounters {
  return {
    fetched: 0,
    valid: 0,
    invalid: 0,
    newCount: 0,
    changed: 0,
    unchanged: 0,
    unresolved: 0,
    disappeared: 0,
    canonicalApplied: 0,
    published: 0,
  };
}

function incrementCapture(counters: RunCounters, classification: 'NEW' | 'CHANGED' | 'UNCHANGED'): void {
  if (classification === 'NEW') counters.newCount += 1;
  if (classification === 'CHANGED') counters.changed += 1;
  if (classification === 'UNCHANGED') counters.unchanged += 1;
}

function safeErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code.slice(0, 80);
  }
  return error instanceof Error ? error.name.slice(0, 80) : 'INGESTION_FATAL';
}
