export const EMBEDDING_PROVIDER = 'voyage';
export const EMBEDDING_MODEL = 'voyage-4';
export const EMBEDDING_MODEL_REVISION = 'voyage-4-preflight-v1';
export const EMBEDDING_DIMENSION = 1024;
export const EMBEDDING_DOCUMENT_INPUT_TYPE = 'document';
export const EMBEDDING_QUERY_INPUT_TYPE = 'query';
export const VOYAGE_ENDPOINT = 'https://api.voyageai.com/v1/embeddings';

const MAX_RESPONSE_BYTES = 256 * 1024;

export type EmbeddingInputType = 'document' | 'query';

export class EmbeddingRequestError extends Error {
  readonly errorClass: string;
  readonly errorCode: string;
  readonly retryAfterMs: number | null;

  constructor(message: string, errorClass: string, errorCode: string, retryAfterMs: number | null = null) {
    super(message);
    this.errorClass = errorClass;
    this.errorCode = errorCode;
    this.retryAfterMs = retryAfterMs;
  }
}

export async function requestVoyageEmbedding(
  text: string,
  inputType: EmbeddingInputType,
  apiKey: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<number[]> {
  const result = await requestVoyageEmbeddings([text], inputType, apiKey, options);
  return validateEmbeddingVector(result.embeddings[0], EMBEDDING_DIMENSION);
}

export async function requestVoyageEmbeddings(
  texts: string[],
  inputType: EmbeddingInputType,
  apiKey: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ embeddings: unknown[]; totalTokens: number | null }> {
  if (!apiKey) throw new EmbeddingRequestError('Voyage credential is unavailable', 'AUTH', 'MISSING_CREDENTIAL');
  if (texts.length === 0 || texts.some((text) => !text.trim())) {
    throw new EmbeddingRequestError('Embedding input is empty', 'REQUEST', 'EMPTY_INPUT');
  }
  const fetchImpl = options.fetch ?? fetch;
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 10_000);
  let response: Response;
  try {
    response = await fetchImpl(VOYAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
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
    throw new EmbeddingRequestError(
      'Voyage returned a non-success status',
      classification.errorClass,
      classification.errorCode,
      response.status === 429 ? retryAfterMilliseconds(response.headers.get('retry-after')) : null,
    );
  }
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_RESPONSE_BYTES) {
    throw new EmbeddingRequestError('Voyage response exceeded the size limit', 'PROVIDER_RESPONSE', 'RESPONSE_TOO_LARGE');
  }
  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    if (timeout.aborted || (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw new EmbeddingRequestError('Voyage request timed out', 'TIMEOUT', 'PROVIDER_TIMEOUT');
    }
    throw new EmbeddingRequestError('Voyage response body failed', 'TRANSPORT', 'PROVIDER_TRANSPORT');
  }
  if (new TextEncoder().encode(responseText).byteLength > MAX_RESPONSE_BYTES) {
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
  if (model !== EMBEDDING_MODEL || !Array.isArray(data) || data.length !== texts.length
    || data.some((item, index) => objectValue(item, 'index') !== index)) {
    throw new EmbeddingRequestError('Voyage response contract did not match the request', 'PROVIDER_RESPONSE', 'INVALID_RESPONSE');
  }
  const usage = objectValue(payload, 'usage');
  const totalTokens = objectValue(usage, 'total_tokens');
  return {
    embeddings: data.map((item) => objectValue(item, 'embedding')),
    totalTokens: typeof totalTokens === 'number' && Number.isFinite(totalTokens) ? totalTokens : null,
  };
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

function classifyHttpStatus(status: number): { errorClass: string; errorCode: string } {
  if ([401, 403].includes(status)) return { errorClass: 'AUTH', errorCode: 'PROVIDER_AUTH' };
  if (status === 429) return { errorClass: 'RATE_LIMIT', errorCode: 'PROVIDER_RATE_LIMIT' };
  if (status >= 500) return { errorClass: 'PROVIDER', errorCode: 'PROVIDER_5XX' };
  return { errorClass: 'PROVIDER', errorCode: 'PROVIDER_4XX' };
}

function objectValue(value: unknown, key: string): unknown {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const at = Date.parse(value);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}
