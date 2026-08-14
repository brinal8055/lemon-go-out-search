import { spawnSync } from 'node:child_process';

const suite = process.argv.slice(2).find((argument) => argument !== '--');
const supportedSuites = new Map([
  ['db-01a', 'supabase/tests/db-01a.sql'],
  ['db-01b', 'supabase/tests/db-01b.sql'],
  ['db-01c', 'supabase/tests/db-01c.sql'],
  ['db-02', 'supabase/tests/db-02.sql'],
  ['ref-01', 'supabase/tests/ref-01.sql'],
  ['src-01', 'supabase/tests/src-01.sql'],
  ['day1-pub-01', 'supabase/tests/day1-pub-01.sql'],
]);

if (!suite || !supportedSuites.has(suite)) {
  console.error(`Usage: pnpm test:db -- ${[...supportedSuites.keys()].join('|')}`);
  process.exit(1);
}

const result = spawnSync(
  'supabase',
  ['test', 'db', supportedSuites.get(suite), '--local'],
  { stdio: 'inherit' },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
