import { describe, expect, it } from 'vitest';

import { validateEnvironment } from '../../scripts/check-env.mjs';

describe('environment validation', () => {
  it('reports every missing mobile variable', () => {
    expect(validateEnvironment('mobile', {})).toEqual({
      ok: false,
      message:
        'Missing mobile environment variables: EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL',
    });
  });

  it('accepts a configured mobile environment', () => {
    expect(
      validateEnvironment('mobile', {
        EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL:
          'https://example.supabase.co/functions/v1/search',
      }),
    ).toEqual({
      ok: true,
      message: 'mobile environment is configured (1 variables).',
    });
  });

  it('rejects unknown targets', () => {
    expect(validateEnvironment('unknown', {})).toEqual({
      ok: false,
      message: 'Unknown environment target: unknown',
    });
  });
});

