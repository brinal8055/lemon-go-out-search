import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (existsSync('.env.test')) process.loadEnvFile('.env.test');

const result = spawnSync('vitest', process.argv.slice(2), { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
