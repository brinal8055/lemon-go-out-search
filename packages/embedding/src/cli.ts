import { performance } from 'node:perf_hooks';
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_MODEL,
  EMBEDDING_MODEL_REVISION,
  EMBEDDING_PROVIDER,
  persistReadyEmbedding,
  prepareLocalEmbeddingRuntime,
  requestVoyageEmbedding,
  selectEmbeddingSmokeTarget,
} from './index.ts';

const apiKey = process.env.VOYAGE_API_KEY;
if (!apiKey) throw new Error('EMBED_PROVIDER_ACCESS_BLOCKED: VOYAGE_API_KEY is unavailable');
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

await prepareLocalEmbeddingRuntime(connectionString);
const target = await selectEmbeddingSmokeTarget(connectionString);
const documentStarted = performance.now();
const documentVector = await requestVoyageEmbedding(target.embeddingText, 'document', apiKey);
const documentLatencyMs = Math.round(performance.now() - documentStarted);
const persisted = await persistReadyEmbedding(connectionString, target, documentVector);
const queryStarted = performance.now();
const queryVector = await requestVoyageEmbedding('restaurang och aktiviteter', 'query', apiKey);
const queryLatencyMs = Math.round(performance.now() - queryStarted);

console.log(JSON.stringify({
  provider: EMBEDDING_PROVIDER,
  model: EMBEDDING_MODEL,
  revision: EMBEDDING_MODEL_REVISION,
  requestedDimension: EMBEDDING_DIMENSION,
  documentDimension: documentVector.length,
  queryDimension: queryVector.length,
  documentId: target.documentId,
  canonicalEntityId: target.entityId,
  status: 'READY',
  documentLatencyMs,
  queryLatencyMs,
  queryDocumentCompatibility: documentVector.length === queryVector.length ? 'PASS' : 'FAIL',
  embeddingId: persisted.id,
}));
