import { describe, expect, it } from 'vitest';

import {
  loadDevQuery,
  parseDiagnosticArgs,
  prepareLocalDiagnosticRuntime,
} from '../../packages/evaluation/src/search-diagnostics.ts';

describe('restricted search diagnostic CLI', () => {
  it('accepts a DEV query and optional explicit entity UUID', () => {
    expect(parseDiagnosticArgs([
      '--query-id',
      'eval-v1-dev-canonical-exact-same-name-01',
      '--entity-id=10000000-0000-4000-8000-000000000001',
    ])).toEqual({
      queryId: 'eval-v1-dev-canonical-exact-same-name-01',
      entityId: '10000000-0000-4000-8000-000000000001',
    });
  });

  it('fails closed for missing, malformed, or non-DEV arguments', () => {
    expect(() => parseDiagnosticArgs([])).toThrow('QUERY_ID_REQUIRED');
    expect(() => parseDiagnosticArgs(['--query-id', 'unknown'])).toThrow('UNKNOWN_QUERY_ID');
    expect(() => parseDiagnosticArgs([
      '--query-id',
      'eval-v1-dev-canonical-exact-same-name-01',
      '--entity-id',
      'not-a-uuid',
    ])).toThrow('ENTITY_ID_INVALID');
  });

  it('denies SEALED identifiers before corpus access', async () => {
    expect(() => parseDiagnosticArgs(['--query-id', 'eval-v1-sealed-denied-01']))
      .toThrow('SEALED_QUERY_DENIED');
    await expect(loadDevQuery('eval-v1-sealed-denied-01')).rejects.toThrow('SEALED_QUERY_DENIED');
  });

  it('loads only the exact requested DEV record', async () => {
    const record = await loadDevQuery('eval-v1-dev-canonical-exact-same-name-01');
    expect(record.query_id).toBe('eval-v1-dev-canonical-exact-same-name-01');
    expect(record.split).toBe('DEV');
  });

  it('fails clearly for an unknown DEV-shaped identifier', async () => {
    await expect(loadDevQuery('eval-v1-dev-does-not-exist')).rejects.toThrow('UNKNOWN_QUERY_ID');
  });

  it('will not prepare a diagnostic role against a non-local database', async () => {
    await expect(prepareLocalDiagnosticRuntime('postgresql://example.com/postgres'))
      .rejects.toThrow('REFUSING_DESTRUCTIVE_DATABASE_OPERATION');
  });
});
