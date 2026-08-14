import {
  diagnoseDevQuery,
  loadDevQuery,
  parseDiagnosticArgs,
  prepareLocalDiagnosticRuntime,
} from './search-diagnostics.ts';

try {
  const input = parseDiagnosticArgs(process.argv.slice(2));
  const record = await loadDevQuery(input.queryId);
  const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
    ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  await prepareLocalDiagnosticRuntime(connectionString);
  const diagnostic = await diagnoseDevQuery(connectionString, record, input.entityId);
  console.log(JSON.stringify({
    queryId: record.query_id,
    query: record.query,
    requestedEntityId: input.entityId,
    diagnostic,
  }, null, 2));
} catch (error) {
  const code = error instanceof Error ? error.message : 'DIAGNOSTIC_FAILED';
  console.error(code);
  process.exitCode = 1;
}
