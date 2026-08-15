import { EmbeddingRequestError } from './voyage-client.ts';

export type EvaluationProviderFailure = {
  outcome: 'TIMEOUT' | 'PROVIDER_ERROR' | 'HTTP_ERROR' | 'INVALID_RESPONSE';
  category: string;
};

export function classifyEvaluationProviderFailure(error: unknown, httpStatus: number | null): EvaluationProviderFailure {
  if (isDeadlineAbort(error)) return { outcome: 'TIMEOUT', category: 'PROVIDER_TIMEOUT_DURING_RESPONSE_BODY' };
  if (error instanceof EmbeddingRequestError && error.errorCode === 'PROVIDER_TIMEOUT') {
    return { outcome: 'TIMEOUT', category: error.errorCode };
  }
  if (error instanceof EmbeddingRequestError && ['INVALID_RESPONSE', 'INVALID_JSON', 'RESPONSE_TOO_LARGE'].includes(error.errorCode)) {
    return { outcome: 'INVALID_RESPONSE', category: error.errorCode };
  }
  if (httpStatus !== null && (httpStatus < 200 || httpStatus >= 300)) {
    return { outcome: 'HTTP_ERROR', category: error instanceof EmbeddingRequestError ? error.errorCode : 'UNEXPECTED_PROVIDER_EXCEPTION' };
  }
  return { outcome: 'PROVIDER_ERROR', category: error instanceof EmbeddingRequestError ? error.errorCode : 'UNEXPECTED_PROVIDER_EXCEPTION' };
}

function isDeadlineAbort(error: unknown): boolean {
  return error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name);
}
