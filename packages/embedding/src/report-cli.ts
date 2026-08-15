import {
  getEmbeddingCoverageReport,
  prepareLocalEmbeddingRuntime,
} from './index.ts';

if (process.argv.length !== 2) throw new Error('usage: pnpm embeddings:report');
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

await prepareLocalEmbeddingRuntime(connectionString);
console.log(JSON.stringify(await getEmbeddingCoverageReport(connectionString), null, 2));
