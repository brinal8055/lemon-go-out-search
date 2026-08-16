import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { assertFinalEvalWriteOperation } from '../packages/contracts/src/database-target.ts';

const connectionString = process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? '';
assertFinalEvalWriteOperation(connectionString, 'reference-deploy', process.env);

const projectRef = process.env.SUPABASE_PROJECT_ID;
const linkedRef = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
if (linkedRef !== projectRef) throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');

const seedFile = 'supabase/seed.sql';
const seed = readFileSync(seedFile, 'utf8');
const allowedTargets = new Set([
  'geographic_scopes',
  'geographic_scope_boundaries',
  'sources',
  'taxonomy_nodes',
  'taxonomy_aliases',
  'search_configs',
]);
const targets = [
  ...seed.matchAll(/(?:insert\s+into|update|delete\s+from|truncate(?:\s+table)?)\s+app\.([a-z_]+)/gi),
].map((match) => match[1]);
if (targets.length === 0 || targets.some((target) => !allowedTargets.has(target))) {
  throw new Error('FINAL_EVAL_REFERENCE_SEED_CONTAINS_NON_REFERENCE_WRITES');
}

const require = createRequire(new URL('../packages/ingestion-domain/package.json', import.meta.url));
const pg = require('pg');
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query('begin');
  await client.query(seed);
  await client.query('commit');
  console.log('FINAL_EVAL reference data deployed.');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
