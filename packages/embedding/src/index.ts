import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';

const { Client } = pg;

export const EMBEDDING_PROVIDER = 'voyage';
export const EMBEDDING_MODEL = 'voyage-4';
export const EMBEDDING_MODEL_REVISION = 'voyage-4-preflight-v1';
export const EMBEDDING_DIMENSION = 1024;
export const EMBEDDING_TIMEOUT_MS = 10_000;
export const EMBEDDING_CONFIG_VERSION = 'embed-01a-preflight-v1';
export const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';
const MAX_RESPONSE_BYTES = 256 * 1024;

export type EmbeddingInputType = 'document' | 'query';
export type EmbeddingContract = {
  provider: typeof EMBEDDING_PROVIDER;
  model: typeof EMBEDDING_MODEL;
  modelRevision: typeof EMBEDDING_MODEL_REVISION;
  dimension: typeof EMBEDDING_DIMENSION;
};
export type EmbeddingTarget = {
  documentId: string;
  entityId: string;
  documentHash: string;
  embeddingText: string;
  displayName: string;
};
export type EmbeddingFailure = {
  errorClass: string;
  errorCode: string;
};

export class EmbeddingRequestError extends Error {
  readonly errorClass: string;
  readonly errorCode: string;

  constructor(
    message: string,
    errorClass: string,
    errorCode: string,
  ) {
    super(message);
    this.errorClass = errorClass;
    this.errorCode = errorCode;
  }
}

export const EMBEDDING_CONTRACT: EmbeddingContract = {
  provider: EMBEDDING_PROVIDER,
  model: EMBEDDING_MODEL,
  modelRevision: EMBEDDING_MODEL_REVISION,
  dimension: EMBEDDING_DIMENSION,
};

export async function requestVoyageEmbedding(
  text: string,
  inputType: EmbeddingInputType,
  apiKey: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<number[]> {
  if (!apiKey) throw new EmbeddingRequestError('Voyage credential is unavailable', 'AUTH', 'MISSING_CREDENTIAL');
  if (!text.trim()) throw new EmbeddingRequestError('Embedding input is empty', 'REQUEST', 'EMPTY_INPUT');
  const fetchImpl = options.fetch ?? fetch;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? EMBEDDING_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(VOYAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        input: [text],
        model: EMBEDDING_MODEL,
        input_type: inputType,
        output_dimension: EMBEDDING_DIMENSION,
        output_dtype: 'float',
        truncation: false,
      }),
      signal: timeout,
    });
  } catch (error) {
    if (timeout.aborted || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw new EmbeddingRequestError('Voyage request timed out', 'TIMEOUT', 'PROVIDER_TIMEOUT');
    }
    throw new EmbeddingRequestError('Voyage transport failed', 'TRANSPORT', 'PROVIDER_TRANSPORT');
  }
  if (!response.ok) {
    const classification = classifyHttpStatus(response.status);
    throw new EmbeddingRequestError('Voyage returned a non-success status', classification.errorClass, classification.errorCode);
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new EmbeddingRequestError('Voyage response exceeded the size limit', 'PROVIDER_RESPONSE', 'RESPONSE_TOO_LARGE');
  }
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new EmbeddingRequestError('Voyage response exceeded the size limit', 'PROVIDER_RESPONSE', 'RESPONSE_TOO_LARGE');
  }
  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new EmbeddingRequestError('Voyage response was not JSON', 'PROVIDER_RESPONSE', 'INVALID_JSON');
  }
  const model = objectValue(payload, 'model');
  const data = objectValue(payload, 'data');
  if (model !== EMBEDDING_MODEL || !Array.isArray(data) || data.length !== 1) {
    throw new EmbeddingRequestError('Voyage response contract did not match the request', 'PROVIDER_RESPONSE', 'INVALID_RESPONSE');
  }
  const embedding = objectValue(data[0], 'embedding');
  return validateEmbeddingVector(embedding, EMBEDDING_DIMENSION);
}

export function validateEmbeddingVector(value: unknown, dimension: number): number[] {
  if (!Array.isArray(value)) {
    throw new EmbeddingRequestError('Embedding vector is missing', 'VALIDATION', 'VECTOR_MISSING');
  }
  if (value.length !== dimension) {
    throw new EmbeddingRequestError('Embedding dimension is invalid', 'VALIDATION', 'WRONG_DIMENSION');
  }
  if (!value.every((component) => typeof component === 'number' && Number.isFinite(component))) {
    throw new EmbeddingRequestError('Embedding contains a non-finite value', 'VALIDATION', 'NON_FINITE_VECTOR');
  }
  const vector = value as number[];
  if (vector.every((component) => component === 0)) {
    throw new EmbeddingRequestError('Embedding vector has zero norm', 'VALIDATION', 'ZERO_VECTOR');
  }
  return vector;
}

export function createAttemptKey(target: EmbeddingTarget, attemptId: string): string {
  if (!attemptId.trim()) throw new Error('attempt ID is required');
  return createHash('sha256').update(JSON.stringify({
    attemptId,
    documentId: target.documentId,
    documentHash: target.documentHash,
    ...EMBEDDING_CONTRACT,
  })).digest('hex');
}

export async function prepareLocalEmbeddingRuntime(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('embedding role preparation is restricted to a local database');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function selectEmbeddingSmokeTarget(connectionString: string): Promise<EmbeddingTarget> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query<{
      document_id: string;
      entity_id: string;
      document_hash: string;
      embedding_text: string;
      display_name: string;
    }>(`
      select document.id as document_id, document.entity_id, document.content_hash as document_hash,
             document.embedding_text, document.display_name
      from app.search_documents as document
      join app.canonical_entities as entity on entity.id = document.entity_id
      where document.is_active
        and document.embedding_text <> ''
        and entity.publication_status = 'PUBLISHED'
        and entity.merged_into_id is null
      order by (document.display_name = 'Evergreen Restaurang & Pizzeria') desc,
               document.entity_id
      limit 1
    `);
    const row = result.rows[0];
    if (!row) throw new Error('no active eligible SearchDocument is available for embedding smoke');
    return {
      documentId: row.document_id,
      entityId: row.entity_id,
      documentHash: row.document_hash,
      embeddingText: row.embedding_text,
      displayName: row.display_name,
    };
  } finally {
    await client.end();
  }
}

export async function persistReadyEmbedding(
  connectionString: string,
  target: EmbeddingTarget,
  vector: number[],
  options: { attemptId?: string; attemptedAt?: Date; generatedAt?: Date } = {},
): Promise<{ id: string; attemptKey: string }> {
  validateEmbeddingVector(vector, EMBEDDING_DIMENSION);
  const attemptId = options.attemptId ?? randomUUID();
  const attemptKey = createAttemptKey(target, attemptId);
  const attemptedAt = options.attemptedAt ?? new Date();
  const generatedAt = options.generatedAt ?? new Date();
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await client.query('begin');
    try {
      await assertCurrentContract(client, target);
      const result = await client.query<{ id: string }>(`
        insert into app.embeddings (
          search_document_id, entity_id, provider, model, model_revision,
          dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
        ) values ($1, $2, $3, $4, $5, $6, $7::extensions.vector, $8, 'READY', $9, $10, $11)
        returning id
      `, [
        target.documentId, target.entityId, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
        EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION, vectorLiteral(vector),
        target.documentHash, attemptKey, attemptedAt, generatedAt,
      ]);
      await client.query('commit');
      return { id: result.rows[0].id, attemptKey };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}

export async function persistFailedEmbedding(
  connectionString: string,
  target: EmbeddingTarget,
  failure: EmbeddingFailure,
  options: { attemptId?: string; attemptedAt?: Date } = {},
): Promise<{ id: string; attemptKey: string }> {
  const attemptId = options.attemptId ?? randomUUID();
  const attemptKey = createAttemptKey(target, attemptId);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const result = await client.query<{ id: string }>(`
      insert into app.embeddings (
        search_document_id, entity_id, provider, model, model_revision,
        dimension, document_hash, status, attempt_key, attempted_at, error_class, error_code
      ) values ($1, $2, $3, $4, $5, $6, $7, 'FAILED', $8, $9, $10, $11)
      returning id
    `, [
      target.documentId, target.entityId, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
      EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION, target.documentHash,
      attemptKey, options.attemptedAt ?? new Date(), failure.errorClass, failure.errorCode,
    ]);
    return { id: result.rows[0].id, attemptKey };
  } finally {
    await client.end();
  }
}

async function assertCurrentContract(client: pg.Client, target: EmbeddingTarget): Promise<void> {
  const document = await client.query(`
    select 1 from app.search_documents
    where id = $1 and entity_id = $2 and content_hash = $3 and is_active
    for share
  `, [target.documentId, target.entityId, target.documentHash]);
  if (document.rowCount !== 1) throw new Error('SearchDocument is no longer active or hash-compatible');
  const config = await client.query(`
    select 1 from app.search_configs
    where is_active and version = $1 and embedding_provider = $2 and embedding_model = $3
      and embedding_revision = $4 and embedding_dimension = $5
  `, [
    EMBEDDING_CONFIG_VERSION, EMBEDDING_PROVIDER, EMBEDDING_MODEL,
    EMBEDDING_MODEL_REVISION, EMBEDDING_DIMENSION,
  ]);
  if (config.rowCount !== 1) throw new Error('active embedding configuration is incompatible');
}

function classifyHttpStatus(status: number): EmbeddingFailure {
  if ([401, 403].includes(status)) return { errorClass: 'AUTH', errorCode: 'PROVIDER_AUTH' };
  if (status === 429) return { errorClass: 'RATE_LIMIT', errorCode: 'PROVIDER_RATE_LIMIT' };
  if (status >= 500) return { errorClass: 'PROVIDER', errorCode: 'PROVIDER_5XX' };
  return { errorClass: 'PROVIDER', errorCode: 'PROVIDER_4XX' };
}

function objectValue(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function vectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
