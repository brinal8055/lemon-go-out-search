import { readFile } from 'node:fs/promises';
import {
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  publishFirstPlace,
  runIngestion,
} from '../packages/ingestion-domain/src/index.ts';
import {
  JONKOPING_SCOPE_ID,
  OsmOverpassAdapter,
} from '../packages/source-adapters/src/osm.ts';

const rawFixture = JSON.parse(await readFile(
  new URL('../packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json', import.meta.url),
  'utf8',
));
const evergreen = rawFixture.elements.find((element) => element.type === 'node' && element.id === 254912492);
if (!evergreen) throw new Error('Frozen Evergreen OSM fixture is missing.');

const adapter = new OsmOverpassAdapter({
  fetchImpl: async () => Response.json({ elements: [evergreen] }),
  sleep: async () => undefined,
  now: () => new Date('2026-08-14T12:00:00Z'),
});
const connectionString = fixtureDatabaseUrl();
await prepareLocalIngestionRuntime(connectionString);
const store = new PostgresIngestionStore(connectionString);
try {
  await runIngestion(store, adapter);
} finally {
  await store.close();
}
const publication = await publishFirstPlace(connectionString);

const requestId = '96000000-0000-4000-8000-000000000001';
const response = await fetch('http://127.0.0.1:54321/functions/v1/search', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-request-id': requestId,
    authorization: 'Bearer client-value-must-not-be-forwarded',
  },
  body: JSON.stringify({
    query: 'Evergreen Restaurang & Pizzeria',
    uiLocale: 'en',
    scopeId: JONKOPING_SCOPE_ID,
    entityTypes: ['PLACE'],
    limit: 10,
  }),
});
const responseText = await response.text();
if (!response.ok) throw new Error(`Edge smoke returned safe HTTP ${response.status}.`);
const body = JSON.parse(responseText);
const result = body.results?.find((item) => item.name === 'Evergreen Restaurang & Pizzeria');
if (!result) throw new Error('Real published Evergreen Place was not returned through Edge.');
if (body.requestId !== requestId || response.headers.get('x-request-id') !== requestId) {
  throw new Error('Edge request ID was not correlated.');
}
if (result.canonicalId !== publication.canonicalEntityId || result.type !== 'PLACE') {
  throw new Error('Edge returned an unexpected real Place identity.');
}
if (/(service_role|secret|diagnostic|query_vector|raw_payload|result_position|score)/i.test(responseText)) {
  throw new Error('Edge response exposed a private field or credential marker.');
}

console.log(`EDGE-01 real smoke: PASS (${result.name}, ${result.canonicalId})`);
