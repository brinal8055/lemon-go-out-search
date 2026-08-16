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

  it.each([
    'EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'EXPO_PUBLIC_VOYAGE_API_KEY',
    'EXPO_PUBLIC_DATABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ACCESS_TOKEN',
    'EXPO_PUBLIC_ADMIN_KEY',
  ])('rejects privileged mobile variable %s', (name) => {
    const result = validateEnvironment('mobile', {
      EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL: 'https://example.test/search',
      [name]: 'must-not-be-public',
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain(name);
  });
});
