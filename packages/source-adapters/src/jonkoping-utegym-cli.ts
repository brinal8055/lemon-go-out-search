import {
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  runIngestion,
} from '@lemon/ingestion-domain';
import {
  JONKOPING_SCOPE_ID,
  JONKOPING_UTEGYM_ENDPOINT,
  JonkopingUtegymAdapter,
} from './jonkoping-utegym.ts';

const args = process.argv.slice(2);
const scopeIndex = args.indexOf('--scope');
const layerIndex = args.indexOf('--layer');
const scopeId = scopeIndex >= 0 ? args[scopeIndex + 1] : null;
const layer = layerIndex >= 0 ? args[layerIndex + 1] : null;
if (!args.includes('--bounded') || scopeId !== JONKOPING_SCOPE_ID || layer !== 'utegym') {
  console.error(`Usage: pnpm ingest:municipal --layer utegym --scope ${JONKOPING_SCOPE_ID} --bounded`);
  process.exit(2);
}

const connectionString = fixtureDatabaseUrl();
await prepareLocalIngestionRuntime(connectionString);
const store = new PostgresIngestionStore(connectionString);
try {
  const result = await runIngestion(store, new JonkopingUtegymAdapter());
  const insideScope = result.stageTrace.filter(({ stage }) => stage === 'canonical/taxonomy').length;
  console.log(JSON.stringify({
    runId: result.runId,
    status: result.status,
    layer: 'utegym',
    endpoint: JONKOPING_UTEGYM_ENDPOINT,
    counters: result.counters,
    insideScope,
    outsideScope: result.counters.valid - insideScope - result.counters.unresolved,
    unresolvedOverlaps: result.counters.unresolved,
    sampleExternalKeys: result.stageTrace
      .filter(({ stage, externalKey }) => stage === 'capture/version' && externalKey)
      .slice(0, 5)
      .map(({ externalKey }) => externalKey),
  }));
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : 'bounded municipal ingestion failed');
  process.exitCode = 1;
} finally {
  await store.close();
}
