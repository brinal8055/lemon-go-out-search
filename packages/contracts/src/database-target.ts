export const DESTRUCTIVE_DATABASE_REFUSAL = 'REFUSING_DESTRUCTIVE_DATABASE_OPERATION';
export const FINAL_EVAL_WRITE_REFUSAL = 'REFUSING_FINAL_EVAL_WRITE_OPERATION';

const LOCAL_DATABASE_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  'host.docker.internal',
  'supabase_db_lemon-going-out-search',
]);

export type DatabaseEnvironment = Record<string, string | undefined>;

export type FinalEvalWriteOperation =
  | 'migration-deploy'
  | 'reference-deploy'
  | 'corpus-recovery-a'
  | 'corpus-recovery-b'
  | 'edge-deploy';

export function assertDestructiveDatabaseOperation(
  connectionString: string,
  environment: DatabaseEnvironment,
): void {
  let hostname: string;
  try {
    hostname = new URL(connectionString).hostname.toLowerCase();
  } catch {
    refuseDestructive();
  }

  if (
    environment.DB_TARGET !== 'local-test'
    || environment.ALLOW_DESTRUCTIVE_DB_TESTS !== '1'
    || !LOCAL_DATABASE_HOSTS.has(hostname!)
  ) {
    refuseDestructive();
  }
}

export function assertFinalEvalTarget(
  connectionString: string,
  environment: DatabaseEnvironment,
): void {
  if (environment.DB_TARGET !== 'final-eval') refuseFinalEvalWrite();

  const projectRef = environment.SUPABASE_PROJECT_ID?.trim();
  if (!projectRef) refuseFinalEvalWrite();

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    refuseFinalEvalWrite();
  }

  const directHost = `db.${projectRef}.supabase.co`;
  const poolerIdentity = url!.hostname.endsWith('.pooler.supabase.com')
    && url!.username === `postgres.${projectRef}`;
  if (url!.hostname !== directHost && !poolerIdentity) refuseFinalEvalWrite();
}

export function assertFinalEvalWriteOperation(
  connectionString: string,
  operation: FinalEvalWriteOperation,
  environment: DatabaseEnvironment,
): void {
  assertFinalEvalTarget(connectionString, environment);
  if (
    environment.ALLOW_FINAL_EVAL_WRITES !== '1'
    || environment.FINAL_EVAL_WRITE_OPERATION !== operation
    || environment.ALLOW_DESTRUCTIVE_DB_TESTS === '1'
  ) {
    refuseFinalEvalWrite();
  }
}

function refuseDestructive(): never {
  throw new Error(DESTRUCTIVE_DATABASE_REFUSAL);
}

function refuseFinalEvalWrite(): never {
  throw new Error(FINAL_EVAL_WRITE_REFUSAL);
}
