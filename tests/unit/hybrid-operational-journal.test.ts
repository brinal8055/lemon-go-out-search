import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createHybridOperationalJournal } from '../../packages/evaluation/src/hybrid-operational-journal.ts';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lemon-hybrid-journal-'));
  directories.push(directory);
  return directory;
}

function successfulAttempt() {
  return {
    queryId: 'semantic-occasion-language-01',
    language: 'en',
    shouldEmbed: true,
    providerCallOrdinal: 1,
    queryVectorFingerprint: 'fingerprint-only',
    providerInvocationStartedAt: '2026-10-15T12:00:00.000Z',
    providerElapsedMs: 412,
    outcome: 'SUCCESS' as const,
    httpStatus: 200,
    providerErrorCategory: null,
  };
}

describe('hybrid operational journal', () => {
  it('persists provider and search outcomes before completion', async () => {
    const directory = await temporaryDirectory();
    const journal = createHybridOperationalJournal({ directory, runId: 'run-success' });
    await journal.start();
    await journal.setNextQuery('semantic-occasion-language-01');
    await journal.recordProviderAttempt(successfulAttempt());
    await journal.recordSearchOutcome({
      queryId: 'semantic-occasion-language-01', providerCallOrdinal: 1, semanticCandidateCount: 30, semanticDegraded: false,
    });
    await journal.markQueryCompleted('semantic-occasion-language-01');

    const records = (await readFile(journal.paths.journal, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
    expect(records).toMatchObject([
      { recordType: 'PROVIDER_ATTEMPT', outcome: 'SUCCESS', queryVectorFingerprint: 'fingerprint-only', cumulative: { providerSuccessCount: 1 } },
      { recordType: 'SEARCH_OUTCOME', semanticCandidateCount: 30, semanticDegraded: false },
    ]);
    expect(JSON.parse(await readFile(journal.paths.status, 'utf8'))).toMatchObject({
      status: 'RUNNING', lastCompletedQueryId: 'semantic-occasion-language-01', counts: { providerSuccessCount: 1 },
    });
  });

  it.each([
    ['TIMEOUT', 'PROVIDER_TIMEOUT'],
    ['PROVIDER_ERROR', 'PROVIDER_TRANSPORT'],
  ] as const)('persists %s before a failed run is finalized', async (outcome, providerErrorCategory) => {
    const directory = await temporaryDirectory();
    const journal = createHybridOperationalJournal({ directory, runId: `run-${outcome}` });
    await journal.start();
    await journal.setNextQuery('semantic-occasion-language-02');
    await journal.recordProviderAttempt({
      ...successfulAttempt(),
      queryId: 'semantic-occasion-language-02',
      outcome,
      queryVectorFingerprint: null,
      httpStatus: null,
      providerErrorCategory,
    });
    await journal.fail('SEMANTIC_DEGRADED');

    const journalText = await readFile(journal.paths.journal, 'utf8');
    expect(journalText).toContain(`"outcome":"${outcome}"`);
    expect(JSON.parse(await readFile(journal.paths.status, 'utf8'))).toMatchObject({
      status: 'FAILED', validForQualityMetrics: false, nextQueryId: 'semantic-occasion-language-02',
      failureCategory: 'SEMANTIC_DEGRADED',
    });
  });

  it('contains fingerprints and categories but never vectors or credentials', async () => {
    const directory = await temporaryDirectory();
    const journal = createHybridOperationalJournal({ directory, runId: 'run-redaction' });
    await journal.start();
    await journal.recordProviderAttempt(successfulAttempt());
    const persisted = `${await readFile(journal.paths.journal, 'utf8')}\n${await readFile(journal.paths.status, 'utf8')}`;
    expect(persisted).toContain('fingerprint-only');
    expect(persisted).not.toContain('[0.125,0.25,0.5]');
    expect(persisted).not.toContain('voyage-secret-value');
  });

  it('marks only a fully finalized run completed', async () => {
    const directory = await temporaryDirectory();
    const journal = createHybridOperationalJournal({ directory, runId: 'run-complete' });
    await journal.start();
    await writeFile(join(directory, 'dev-result.v1.json'), '{}\n');
    await journal.complete(['dev-result.v1.json']);
    expect(JSON.parse(await readFile(journal.paths.status, 'utf8'))).toMatchObject({
      status: 'COMPLETED', validForQualityMetrics: true, finalArtifacts: ['dev-result.v1.json'],
    });
  });
});
