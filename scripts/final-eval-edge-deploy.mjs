import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import { assertFinalEvalWriteOperation } from '../packages/contracts/src/database-target.ts';

const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalWriteOperation(connectionString, 'edge-deploy', process.env);

const projectRef = process.env.SUPABASE_PROJECT_ID;
const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (linkedRef !== projectRef) throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');

const secretFile = 'supabase/functions/.env.local';
const secretNames = new Map(
  readFileSync(secretFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2].trim()]),
);
for (const name of ['LEMON_SUPABASE_SECRET_KEY']) {
  if (!secretNames.get(name)) throw new Error(`missing Edge secret: ${name}`);
}
if (secretNames.has('SUPABASE_URL')) {
  throw new Error('SUPABASE_URL is platform-provided and must not be uploaded as a custom secret');
}
if ([...secretNames.keys()].some((name) => name.startsWith('EXPO_PUBLIC_'))) {
  throw new Error('Edge secret file contains a mobile-public variable');
}

runSupabase(['secrets', 'set', '--env-file', secretFile, '--project-ref', projectRef]);
runSupabase(['functions', 'deploy', 'search', '--project-ref', projectRef, '--no-verify-jwt']);

function runSupabase(args) {
  const result = spawnSync('supabase', args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
