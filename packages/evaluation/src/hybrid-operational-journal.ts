import { mkdir, open, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export type HybridProviderOutcome = 'SUCCESS' | 'TIMEOUT' | 'PROVIDER_ERROR' | 'HTTP_ERROR' | 'INVALID_RESPONSE';
export type HybridRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

type Counts = {
  providerSuccessCount: number;
  providerFailureCount: number;
  timeoutCount: number;
  providerErrorCount: number;
  http429Count: number;
};

export type HybridProviderAttempt = {
  queryId: string;
  language: string;
  shouldEmbed: boolean;
  providerCallOrdinal: number;
  queryVectorFingerprint: string | null;
  providerInvocationStartedAt: string;
  providerElapsedMs: number;
  outcome: HybridProviderOutcome;
  httpStatus: number | null;
  providerErrorCategory: string | null;
};

export type HybridSearchOutcome = {
  queryId: string;
  providerCallOrdinal: number;
  semanticCandidateCount: number;
  semanticDegraded: boolean;
};

type JournalRecord =
  | ({ recordType: 'PROVIDER_ATTEMPT'; runId: string; mode: 'HYBRID'; cumulative: Counts } & HybridProviderAttempt)
  | ({ recordType: 'SEARCH_OUTCOME'; runId: string; mode: 'HYBRID' } & HybridSearchOutcome);

type StatusPayload = {
  reportVersion: 'postcov-hybrid-run-status.v1';
  runId: string;
  mode: 'HYBRID';
  status: HybridRunStatus;
  validForQualityMetrics: boolean;
  lastCompletedQueryId: string | null;
  nextQueryId: string | null;
  counts: Counts;
  failureCategory: string | null;
  finalArtifacts: string[];
};

export function createHybridOperationalJournal(input: {
  directory: string;
  runId: string;
}): {
  start: () => Promise<void>;
  setNextQuery: (queryId: string) => Promise<void>;
  recordProviderAttempt: (attempt: HybridProviderAttempt) => Promise<void>;
  recordSearchOutcome: (outcome: HybridSearchOutcome) => Promise<void>;
  markQueryCompleted: (queryId: string) => Promise<void>;
  complete: (finalArtifacts: string[]) => Promise<void>;
  fail: (failureCategory: string) => Promise<void>;
  paths: { journal: string; status: string };
} {
  const directory = resolve(input.directory);
  const paths = {
    journal: resolve(directory, 'operational-journal.v1.jsonl'),
    status: resolve(directory, 'run-status.v1.json'),
  };
  const counts: Counts = {
    providerSuccessCount: 0,
    providerFailureCount: 0,
    timeoutCount: 0,
    providerErrorCount: 0,
    http429Count: 0,
  };
  let lastCompletedQueryId: string | null = null;
  let nextQueryId: string | null = null;

  const status = (state: HybridRunStatus, validForQualityMetrics: boolean, failureCategory: string | null, finalArtifacts: string[]): StatusPayload => ({
    reportVersion: 'postcov-hybrid-run-status.v1',
    runId: input.runId,
    mode: 'HYBRID',
    status: state,
    validForQualityMetrics,
    lastCompletedQueryId,
    nextQueryId,
    counts: { ...counts },
    failureCategory,
    finalArtifacts,
  });

  return {
    async start() {
      await mkdir(directory, { recursive: true });
      await writeStatus(paths.status, status('RUNNING', false, null, []));
    },
    async setNextQuery(queryId) {
      nextQueryId = queryId;
      await writeStatus(paths.status, status('RUNNING', false, null, []));
    },
    async recordProviderAttempt(attempt) {
      if (attempt.outcome === 'SUCCESS') counts.providerSuccessCount += 1;
      else counts.providerFailureCount += 1;
      if (attempt.outcome === 'TIMEOUT') counts.timeoutCount += 1;
      if (attempt.outcome === 'PROVIDER_ERROR' || attempt.outcome === 'INVALID_RESPONSE') counts.providerErrorCount += 1;
      if (attempt.httpStatus === 429) counts.http429Count += 1;
      await appendDurable(paths.journal, {
        recordType: 'PROVIDER_ATTEMPT',
        runId: input.runId,
        mode: 'HYBRID',
        ...attempt,
        cumulative: { ...counts },
      });
      await writeStatus(paths.status, status('RUNNING', false, null, []));
    },
    async recordSearchOutcome(outcome) {
      await appendDurable(paths.journal, { recordType: 'SEARCH_OUTCOME', runId: input.runId, mode: 'HYBRID', ...outcome });
    },
    async markQueryCompleted(queryId) {
      lastCompletedQueryId = queryId;
      nextQueryId = null;
      await writeStatus(paths.status, status('RUNNING', false, null, []));
    },
    async complete(finalArtifacts) {
      await writeStatus(paths.status, status('COMPLETED', true, null, finalArtifacts));
    },
    async fail(failureCategory) {
      await writeStatus(paths.status, status('FAILED', false, failureCategory, []));
    },
    paths,
  };
}

async function appendDurable(path: string, record: JournalRecord): Promise<void> {
  const handle = await open(path, 'a');
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function writeStatus(path: string, status: StatusPayload): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(status, null, 2)}\n`);
  await rename(temporary, path);
}
