import { readFile } from 'node:fs/promises';
import pg from 'pg';

import type { EvalCorpusRecordV1 } from './index.ts';

const corpusUrl = new URL('../../../evaluation/corpus/corpus.v1.jsonl', import.meta.url);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DiagnosticCliInput = {
  queryId: string;
  entityId: string | null;
};

export function parseDiagnosticArgs(args: string[]): DiagnosticCliInput {
  const queryId = argumentValue(args, '--query-id');
  const entityId = argumentValue(args, '--entity-id');
  if (!queryId) throw new Error('QUERY_ID_REQUIRED');
  if (queryId.includes('-sealed-')) throw new Error('SEALED_QUERY_DENIED');
  if (!queryId.startsWith('eval-v1-dev-')) throw new Error('UNKNOWN_QUERY_ID');
  if (entityId && !uuidPattern.test(entityId)) throw new Error('ENTITY_ID_INVALID');
  return { queryId, entityId };
}

export async function loadDevQuery(queryId: string): Promise<EvalCorpusRecordV1> {
  if (queryId.includes('-sealed-')) throw new Error('SEALED_QUERY_DENIED');
  if (!queryId.startsWith('eval-v1-dev-')) throw new Error('UNKNOWN_QUERY_ID');

  const lines = (await readFile(corpusUrl, 'utf8')).split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('"split":"DEV"') || !line.includes(`"query_id":"${queryId}"`)) continue;
    const record = JSON.parse(line) as EvalCorpusRecordV1;
    if (record.split !== 'DEV' || record.query_id !== queryId) break;
    return record;
  }
  throw new Error('UNKNOWN_QUERY_ID');
}

export async function diagnoseDevQuery(
  connectionString: string,
  record: EvalCorpusRecordV1,
  entityId: string | null,
): Promise<Record<string, unknown>> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role lemon_evaluation');
    const result = await client.query<{ diagnostic: Record<string, unknown> }>(
      'select diagnostic.explain_search_v1($1::jsonb, $2::uuid) as diagnostic',
      [JSON.stringify(toDiagnosticRequest(record)), entityId],
    );
    await client.query('rollback');
    const diagnostic = result.rows[0]?.diagnostic;
    if (!diagnostic) throw new Error('DIAGNOSTIC_RESULT_MISSING');
    return diagnostic;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

export async function prepareLocalDiagnosticRuntime(connectionString: string): Promise<() => Promise<void>> {
  const url = new URL(connectionString);
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('diagnostic role preparation is restricted to a local database');
  }
  const client = new pg.Client({ connectionString });
  await client.connect();
  let granted = false;
  try {
    const membership = await client.query<{ set_option: boolean }>(`
      select membership.set_option
      from pg_catalog.pg_auth_members as membership
      join pg_catalog.pg_roles as member_role on member_role.oid = membership.member
      join pg_catalog.pg_roles as granted_role on granted_role.oid = membership.roleid
      where member_role.rolname = session_user
        and granted_role.rolname = 'lemon_evaluation'
        and membership.set_option
      limit 1
    `);
    if (membership.rowCount === 0) {
      await client.query('grant lemon_evaluation to postgres with set true');
      granted = true;
    }
  } finally {
    await client.end();
  }
  return async () => {
    if (!granted) return;
    const cleanup = new pg.Client({ connectionString });
    await cleanup.connect();
    try {
      await cleanup.query('revoke lemon_evaluation from postgres granted by postgres');
    } finally {
      await cleanup.end();
    }
  };
}

function toDiagnosticRequest(record: EvalCorpusRecordV1): Record<string, unknown> {
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = record.request_filters.location as {
    latitude?: unknown;
    longitude?: unknown;
    radius_meters?: unknown;
  } | undefined;
  const entityTypes = record.request_filters.entity_types;
  return {
    query: record.query,
    scopeId: record.scope.scope_id,
    ...(typeof taxonomy?.node_id === 'string' ? { taxonomyNodeId: taxonomy.node_id } : {}),
    ...(Array.isArray(entityTypes) ? { entityTypes } : {}),
    ...(typeof location?.latitude === 'number'
      && typeof location.longitude === 'number'
      && typeof location.radius_meters === 'number'
      ? {
          location: {
            latitude: location.latitude,
            longitude: location.longitude,
            radiusMeters: location.radius_meters,
          },
        }
      : {}),
  };
}

function argumentValue(args: string[], name: string): string | null {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1) || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}
