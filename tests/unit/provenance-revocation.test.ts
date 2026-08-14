import { describe, expect, it } from 'vitest';
import {
  prepareLocalComplianceRuntime,
  reportSourceRevocation,
} from '../../packages/ingestion-domain/src/index.ts';

describe('PROV-01 revocation controls', () => {
  it('rejects an unbounded report before connecting', async () => {
    await expect(reportSourceRevocation(
      'postgresql://postgres:postgres@127.0.0.1:1/postgres',
      '00000000-0000-0000-0000-000000000000',
      501,
    )).rejects.toThrow('limit must be an integer between 1 and 500');
  });

  it('never prepares the compliance role against a remote database', async () => {
    await expect(prepareLocalComplianceRuntime(
      'postgresql://postgres:postgres@example.com:5432/postgres',
    )).rejects.toThrow('restricted to a local database');
  });
});
