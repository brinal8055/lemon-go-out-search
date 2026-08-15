import { describe, expect, it } from 'vitest';

import { EmbeddingRequestError } from '../../packages/embedding/src/voyage-client.ts';
import { classifyEvaluationProviderFailure } from '../../packages/embedding/src/provider-diagnostics.ts';

describe('evaluation provider diagnostics', () => {
  it('classifies a post-header abort as a deadline failure', () => {
    expect(classifyEvaluationProviderFailure(new DOMException('aborted', 'AbortError'), 200)).toEqual({
      outcome: 'TIMEOUT', category: 'PROVIDER_TIMEOUT_DURING_RESPONSE_BODY',
    });
  });

  it('does not call a successful HTTP status an HTTP error', () => {
    expect(classifyEvaluationProviderFailure(new Error('body stream failed'), 200)).toEqual({
      outcome: 'PROVIDER_ERROR', category: 'UNEXPECTED_PROVIDER_EXCEPTION',
    });
  });

  it('keeps explicit client error classifications intact', () => {
    expect(classifyEvaluationProviderFailure(new EmbeddingRequestError('timeout', 'TIMEOUT', 'PROVIDER_TIMEOUT'), null)).toEqual({
      outcome: 'TIMEOUT', category: 'PROVIDER_TIMEOUT',
    });
  });
});
