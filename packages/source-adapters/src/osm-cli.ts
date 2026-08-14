import {
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  runIngestion,
} from '@lemon/ingestion-domain';
import {
  BOUNDED_OSM_QUERY,
  JONKOPING_SCOPE_ID,
  OSM_ENDPOINT,
  OsmOverpassAdapter,
} from './osm.ts';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const scopeIndex = args.indexOf('--scope');
const scopeId = scopeIndex >= 0 ? args[scopeIndex + 1] : null;
if (!args.includes('--bounded') || scopeId !== JONKOPING_SCOPE_ID) {
  console.error(`Usage: pnpm ingest:osm --scope ${JONKOPING_SCOPE_ID} --bounded`);
  process.exit(2);
}

const connectionString = fixtureDatabaseUrl();
await prepareLocalIngestionRuntime(connectionString);
const store = new PostgresIngestionStore(connectionString);
try {
  const result = await runIngestion(store, new OsmOverpassAdapter());
  const processed = result.stageTrace.filter(({ stage }) => stage === 'canonical/taxonomy').length;
  console.log(JSON.stringify({
    runId: result.runId,
    status: result.status,
    endpoint: OSM_ENDPOINT,
    querySha256: createHash('sha256').update(BOUNDED_OSM_QUERY).digest('hex'),
    counters: result.counters,
    insideScope: processed,
    outsideScope: 0,
    sampleExternalKeys: result.stageTrace
      .filter(({ stage, externalKey }) => stage === 'capture/version' && externalKey)
      .slice(0, 5)
      .map(({ externalKey }) => externalKey),
  }));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'bounded OSM ingestion failed');
  process.exitCode = 1;
} finally {
  await store.close();
}
