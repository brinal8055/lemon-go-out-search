import { spawnSync } from 'node:child_process';

import { assertDestructiveDatabaseOperation } from '../packages/contracts/src/database-target.ts';

const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
assertDestructiveDatabaseOperation(connectionString, process.env);

const result = spawnSync('supabase', ['db', 'reset', '--local'], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
