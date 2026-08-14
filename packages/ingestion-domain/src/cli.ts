import { FixtureSourceAdapter } from './fixture-adapter.ts';
import { ensureFixtureSource, fixtureDatabaseUrl, PostgresIngestionStore } from './postgres-store.ts';
import { runIngestion } from './runner.ts';

const adapter = new FixtureSourceAdapter();
const connectionString = fixtureDatabaseUrl();
await ensureFixtureSource(connectionString, adapter.config);
const store = new PostgresIngestionStore(connectionString);

try {
  const result = await runIngestion(store, adapter);
  console.log(JSON.stringify({ runId: result.runId, status: result.status, counters: result.counters }));
  if (result.status === 'FAILED') process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'fixture ingestion failed');
  process.exitCode = 1;
} finally {
  await store.close();
}
