import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { assertFinalEvalWriteOperation } from '../packages/contracts/src/database-target.ts';

const mode = process.argv[2];
if (!['--dry-run', '--apply'].includes(mode)) {
  throw new Error('usage: pnpm final-eval:migrations:dry-run | pnpm final-eval:migrations:deploy');
}

const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalWriteOperation(connectionString, 'migration-deploy', process.env);
assertLinkedProject();

runSupabase(['migration', 'list', '--linked']);
runSupabase(['db', 'push', '--linked', ...(mode === '--dry-run' ? ['--dry-run'] : [])]);

function assertLinkedProject() {
  let linkedRef;
  try {
    linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
  } catch {
    throw new Error('FINAL_EVAL_PROJECT_NOT_LINKED');
  }
  if (linkedRef !== process.env.SUPABASE_PROJECT_ID) {
    throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');
  }
}

function runSupabase(args) {
  const result = spawnSync('supabase', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
