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

  constructor(message: string, errorClass: string, errorCode: string) {
    super(message);
    this.errorClass = errorClass;
    this.errorCode = errorCode;
  }
}

export async function requestVoyageEmbedding(
  text: string,
  inputType: EmbeddingInputType,
  apiKey: string,
  options: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<number[]> {
  if (!apiKey) throw new EmbeddingRequestError('Voyage credential is unavailable', 'AUTH', 'MISSING_CREDENTIAL');
  if (!text.trim()) throw new EmbeddingRequestError('Embedding input is empty', 'REQUEST', 'EMPTY_INPUT');
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
  if (model !== EMBEDDING_MODEL || !Array.isArray(data) || data.length !== 1
    || objectValue(data[0], 'index') !== 0) {
    throw new EmbeddingRequestError('Voyage response contract did not match the request', 'PROVIDER_RESPONSE', 'INVALID_RESPONSE');
  }
  return validateEmbeddingVector(objectValue(data[0], 'embedding'), EMBEDDING_DIMENSION);
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
