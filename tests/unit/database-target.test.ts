import { describe, expect, it } from 'vitest';

import {
  assertDestructiveDatabaseOperation,
  assertFinalEvalWriteOperation,
  DESTRUCTIVE_DATABASE_REFUSAL,
  FINAL_EVAL_WRITE_REFUSAL,
} from '../../packages/contracts/src/database-target.ts';

const localUrl = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const hostedUrl = 'postgresql://postgres.safeproject@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
const localEnvironment = {
  DB_TARGET: 'local-test',
  ALLOW_DESTRUCTIVE_DB_TESTS: '1',
};

describe('database target safety', () => {
  it('allows the explicit local destructive-test target', () => {
    expect(() => assertDestructiveDatabaseOperation(localUrl, localEnvironment)).not.toThrow();
  });

  it.each([
    hostedUrl,
    'postgresql://postgres:postgres@database.internal:5432/postgres',
  ])('refuses destructive operations against non-local host %s', (url) => {
    expect(() => assertDestructiveDatabaseOperation(url, localEnvironment))
      .toThrow(DESTRUCTIVE_DATABASE_REFUSAL);
  });

  it('fails closed when DB_TARGET is missing', () => {
    expect(() => assertDestructiveDatabaseOperation(localUrl, { ALLOW_DESTRUCTIVE_DB_TESTS: '1' }))
      .toThrow(DESTRUCTIVE_DATABASE_REFUSAL);
  });

  it('fails closed when destructive acknowledgement is missing', () => {
    expect(() => assertDestructiveDatabaseOperation(localUrl, { DB_TARGET: 'local-test' }))
      .toThrow(DESTRUCTIVE_DATABASE_REFUSAL);
  });

  it('does not let a final-eval write acknowledgement enable destructive tests', () => {
    const remoteEnvironment = {
      DB_TARGET: 'final-eval',
      SUPABASE_PROJECT_ID: 'safeproject',
      ALLOW_FINAL_EVAL_WRITES: '1',
      FINAL_EVAL_WRITE_OPERATION: 'corpus-recovery-a',
    };
    expect(() => assertFinalEvalWriteOperation(hostedUrl, 'corpus-recovery-a', remoteEnvironment))
      .not.toThrow();
    expect(() => assertDestructiveDatabaseOperation(hostedUrl, remoteEnvironment))
      .toThrow(DESTRUCTIVE_DATABASE_REFUSAL);
  });

  it('refuses a final-eval write if destructive tests are also acknowledged', () => {
    expect(() => assertFinalEvalWriteOperation(hostedUrl, 'corpus-recovery-a', {
      DB_TARGET: 'final-eval',
      SUPABASE_PROJECT_ID: 'safeproject',
      ALLOW_FINAL_EVAL_WRITES: '1',
      FINAL_EVAL_WRITE_OPERATION: 'corpus-recovery-a',
      ALLOW_DESTRUCTIVE_DB_TESTS: '1',
    })).toThrow(FINAL_EVAL_WRITE_REFUSAL);
  });
});
