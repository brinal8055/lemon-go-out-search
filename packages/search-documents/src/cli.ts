import { rebuildSearchDocuments, prepareLocalSearchDocumentRuntime } from './index.ts';

const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const rawLimit = process.argv.find((argument) => argument.startsWith('--limit='))?.slice('--limit='.length);
const limit = rawLimit === undefined ? undefined : Number(rawLimit);
await prepareLocalSearchDocumentRuntime(connectionString);
const report = await rebuildSearchDocuments(connectionString, limit);
console.log(JSON.stringify(report));
