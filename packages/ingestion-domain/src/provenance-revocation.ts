import pg from 'pg';
import type { QueryResultRow } from 'pg';

const { Client } = pg;

export type SourceRevocationImpact = {
  sourceId: string;
  counts: {
    versions: number;
    currentFacts: number;
    activeMemberships: number;
    activeAliases: number;
    entities: number;
    documents: number;
    embeddings: number;
    duplicateCandidates: number;
  };
  versions: Array<{ versionId: string; recordId: string }>;
  currentFacts: Array<{
    provenanceId: string;
    entityId: string;
    factKey: string;
    versionId: string;
  }>;
  activeMemberships: Array<{
    membershipId: string;
    entityId: string;
    taxonomyNodeId: string;
    versionId: string;
  }>;
  affectedEntityIds: string[];
  derivedDocumentIds: string[];
  embeddingIds: string[];
  duplicateCandidateIds: string[];
};

export type RedactionResult = {
  versionId: string;
  operationId: string;
  actor: string;
  reasonCode: string;
  outcome: 'COMPLETED';
  idempotent: boolean;
  counts: Record<string, number>;
};

async function complianceQuery<T extends QueryResultRow>(
  connectionString: string,
  sql: string,
  values: unknown[],
): Promise<T[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role lemon_compliance');
    const result = await client.query<T>(sql, values);
    await client.query('commit');
    return result.rows;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

export async function prepareLocalComplianceRuntime(connectionString: string): Promise<void> {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('compliance role preparation is restricted to a local database');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_compliance to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function reportSourceRevocation(
  connectionString: string,
  sourceId: string,
  limit = 100,
): Promise<SourceRevocationImpact> {
  validateLimit(limit);
  const rows = await complianceQuery<{ impact: SourceRevocationImpact }>(
    connectionString,
    'select app.source_revocation_impact($1, $2) as impact',
    [sourceId, limit],
  );
  const impact = rows[0]?.impact;
  if (!impact) throw new Error('source revocation report returned no result');
  return impact;
}

export async function redactSourceRecordVersion(
  connectionString: string,
  versionId: string,
  operationId: string,
  reasonCode: string,
): Promise<RedactionResult> {
  const rows = await complianceQuery<{ result: RedactionResult }>(
    connectionString,
    'select app.redact_source_record_version($1, $2, $3) as result',
    [versionId, operationId, reasonCode],
  );
  const result = rows[0]?.result;
  if (!result) throw new Error('source record version redaction returned no result');
  return result;
}

export async function redactSource(
  connectionString: string,
  sourceId: string,
  operationId: string,
  reasonCode: string,
  limit = 100,
): Promise<{ impact: SourceRevocationImpact; redactions: RedactionResult[] }> {
  const impact = await reportSourceRevocation(connectionString, sourceId, limit);
  if (impact.counts.versions > impact.versions.length) {
    throw new Error(`source has ${impact.counts.versions} versions; increase --limit before redaction`);
  }
  const redactions: RedactionResult[] = [];
  for (const version of impact.versions) {
    redactions.push(await redactSourceRecordVersion(
      connectionString,
      version.versionId,
      operationId,
      reasonCode,
    ));
  }
  return { impact, redactions };
}

function validateLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('limit must be an integer between 1 and 500');
  }
}
