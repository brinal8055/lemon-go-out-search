import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

import { assertFinalEvalTarget } from '../packages/contracts/src/database-target.ts';

const labels = new Set(['post-recovery-a', 'post-recovery-b', 'pre-sealed-freeze']);
const label = process.argv[2];
if (!labels.has(label)) {
  throw new Error('usage: pnpm final-eval:checkpoint -- post-recovery-a|post-recovery-b|pre-sealed-freeze');
}

const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalTarget(connectionString, process.env);
if (process.env.ALLOW_FINAL_EVAL_BACKUP !== '1') {
  throw new Error('REFUSING_FINAL_EVAL_BACKUP');
}

const timestamp = new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replace(/\.\d{3}Z$/, 'Z');
const directory = 'private/backups/final-eval';
const dumpPath = `${directory}/${timestamp}.${label}.dump`;
await mkdir(directory, { recursive: true, mode: 0o700 });
const database = new URL(connectionString);

const result = spawnSync('pg_dump', [
  '--format', 'custom',
  '--no-owner',
  '--no-acl',
  '--file', dumpPath,
], {
  env: {
    ...process.env,
    PGHOST: database.hostname,
    PGPORT: database.port || '5432',
    PGUSER: decodeURIComponent(database.username),
    PGPASSWORD: decodeURIComponent(database.password),
    PGDATABASE: database.pathname.slice(1),
  },
  stdio: ['ignore', 'inherit', 'inherit'],
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const checksum = createHash('sha256').update(await readFile(dumpPath)).digest('hex');
await writeFile(`${dumpPath}.sha256`, `${checksum}  ${dumpPath.split('/').at(-1)}\n`, { mode: 0o600 });
console.log(`FINAL_EVAL checkpoint created: ${dumpPath} (sha256 ${checksum})`);
