import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { createServer, connect } from 'node:net';
import { basename, resolve } from 'node:path';

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

const dumpArguments = [
  '--format', 'custom',
  '--no-owner',
  '--no-acl',
  '--file', dumpPath,
];
const postgresEnvironment = {
  ...process.env,
  PGHOST: database.hostname,
  PGPORT: database.port || '5432',
  PGUSER: decodeURIComponent(database.username),
  PGPASSWORD: decodeURIComponent(database.password),
  PGDATABASE: database.pathname.slice(1),
};
let result = spawnSync('pg_dump', dumpArguments, {
  env: postgresEnvironment,
  stdio: ['ignore', 'inherit', 'inherit'],
});
if (result.error?.code === 'ENOENT') {
  const docker = process.platform === 'darwin'
    ? '/Applications/Docker.app/Contents/Resources/bin/docker'
    : 'docker';
  const proxyPort = process.env.FINAL_EVAL_BACKUP_PROXY_PORT;
  result = proxyPort
    ? spawnSync(docker, dockerDumpArguments(proxyPort), {
      env: { ...postgresEnvironment, PGHOST: 'host.docker.internal', PGPORT: proxyPort, PGCONNECT_TIMEOUT: '30' },
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    : await dockerDumpThroughHost(docker);
}
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const checksum = createHash('sha256').update(await readFile(dumpPath)).digest('hex');
await writeFile(`${dumpPath}.sha256`, `${checksum}  ${dumpPath.split('/').at(-1)}\n`, { mode: 0o600 });
console.log(`FINAL_EVAL checkpoint created: ${dumpPath} (sha256 ${checksum})`);

async function dockerDumpThroughHost(docker) {
  const relay = createServer((client) => {
    const upstream = connect({ host: database.hostname, port: Number(database.port || '5432') });
    client.pipe(upstream).pipe(client);
    upstream.on('error', () => client.destroy());
    client.on('error', () => upstream.destroy());
  });
  await new Promise((resolveRelay, rejectRelay) => {
    relay.once('error', rejectRelay);
    relay.listen(0, '127.0.0.1', resolveRelay);
  });
  const address = relay.address();
  if (!address || typeof address === 'string') throw new Error('unable to allocate checkpoint relay');
  try {
    return await new Promise((resolveDump) => {
      const child = spawn(docker, dockerDumpArguments(String(address.port)), {
        env: { ...postgresEnvironment, PGHOST: 'host.docker.internal', PGPORT: String(address.port), PGCONNECT_TIMEOUT: '30' },
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      child.on('error', (error) => resolveDump({ error, status: null }));
      child.on('close', (status) => resolveDump({ error: null, status }));
    });
  } finally {
    await new Promise((resolveRelay) => relay.close(resolveRelay));
  }
}

function dockerDumpArguments() {
  return [
    'run', '--rm', '--add-host', 'host.docker.internal:host-gateway',
    '--entrypoint', 'pg_dump', '--volume', `${resolve(directory)}:/backup`,
    '--env', 'PGHOST', '--env', 'PGPORT', '--env', 'PGUSER', '--env', 'PGPASSWORD', '--env', 'PGDATABASE', '--env', 'PGCONNECT_TIMEOUT',
    'public.ecr.aws/supabase/postgres:17.6.1.155',
    '--format', 'custom', '--no-owner', '--no-acl', '--file', `/backup/${basename(dumpPath)}`,
  ];
}
