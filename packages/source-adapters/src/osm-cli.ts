import { fixtureDatabaseUrl, prepareLocalIngestionRuntime } from '@lemon/ingestion-domain';
import { JONKOPING_SCOPE_ID } from './osm.ts';
import { runBoundedOsmIngestion } from './osm-ingestion.ts';

const args = process.argv.slice(2);
const scopeIndex = args.indexOf('--scope');
const scopeId = scopeIndex >= 0 ? args[scopeIndex + 1] : null;
if (!args.includes('--bounded') || scopeId !== JONKOPING_SCOPE_ID) {
  console.error(`Usage: pnpm ingest:osm --scope ${JONKOPING_SCOPE_ID} --bounded`);
  process.exit(2);
}

const connectionString = fixtureDatabaseUrl();
await prepareLocalIngestionRuntime(connectionString);
try {
  const report = await runBoundedOsmIngestion(connectionString);
  console.log(JSON.stringify({
    runId: report.result.runId,
    status: report.result.status,
    endpoint: report.endpoint,
    querySha256: report.querySha256,
    counters: report.result.counters,
    insideScope: report.insideScope,
    outsideScope: report.outsideScope,
    sampleExternalKeys: report.sampleExternalKeys,
  }));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'bounded OSM ingestion failed');
  process.exitCode = 1;
}
