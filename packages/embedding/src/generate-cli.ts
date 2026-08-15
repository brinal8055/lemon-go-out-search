import { readFile } from 'node:fs/promises';
import {
  generateSelectedModelEmbeddings,
  getEmbeddingCoverageReport,
  prepareLocalEmbeddingRuntime,
  validateSelectedEmbeddingConfig,
} from './index.ts';

const args = process.argv.slice(2);
const configIndex = args.indexOf('--config');
if (configIndex === -1 || !args[configIndex + 1]) {
  throw new Error('usage: pnpm embeddings:generate --config <selected-config> [--retry-failed|--retry-rate-limited]');
}
const unexpected = args.filter((argument, index) => (
  argument !== '--config'
  && argument !== '--retry-failed'
  && argument !== '--retry-rate-limited'
  && index !== configIndex + 1
));
if (unexpected.length > 0) throw new Error(`unsupported argument: ${unexpected[0]}`);
if (args.includes('--retry-failed') && args.includes('--retry-rate-limited')) {
  throw new Error('choose only one embedding retry mode');
}

const apiKey = process.env.VOYAGE_API_KEY;
if (!apiKey) throw new Error('EMBED_PROVIDER_CONTRACT_BLOCKED: VOYAGE_API_KEY is unavailable');
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const config = validateSelectedEmbeddingConfig(JSON.parse(await readFile(args[configIndex + 1], 'utf8')));

await prepareLocalEmbeddingRuntime(connectionString);
const generation = await generateSelectedModelEmbeddings(connectionString, apiKey, config, {
  retryFailed: args.includes('--retry-failed'),
  retryRateLimited: args.includes('--retry-rate-limited'),
  onProgress: (progress) => console.log(JSON.stringify({ checkpoint: progress })),
  onProviderRequest: (request) => console.log(JSON.stringify({ providerRequest: request })),
});
const coverage = await getEmbeddingCoverageReport(connectionString);
console.log(JSON.stringify({ generation, coverage }, null, 2));
