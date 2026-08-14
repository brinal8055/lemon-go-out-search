import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? '';
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(?:"(.*)"|(.*))$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2] ?? match[3] ?? '']),
  );
}

let assertions = 0;
function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`Security smoke failed: ${message}`);
}

const diagnosticsRequested = process.argv.slice(2).includes('diagnostics');

run('pnpm', ['test:db', '--', 'sec-01']);
if (diagnosticsRequested) run('pnpm', ['test:db', '--', 'search-diagnostics']);

const local = parseEnvironment(run('pnpm', ['exec', 'supabase', 'status', '-o', 'env']));
const restUrl = local.REST_URL;
const publishableKey = local.PUBLISHABLE_KEY ?? local.ANON_KEY;
const backendKey = local.SERVICE_ROLE_KEY ?? local.SECRET_KEY;

assert(Boolean(restUrl), 'local REST URL is unavailable');
assert(Boolean(publishableKey), 'local publishable key is unavailable');
assert(Boolean(backendKey), 'local backend key is unavailable');

const rpcUrl = `${restUrl}/rpc/search_v1`;
const requestBody = JSON.stringify({
  p_request_id: '92000000-0000-0000-0000-000000000001',
  p_query: 'security smoke no match',
  p_query_norm: 'security smoke no match',
  p_query_ascii: 'security smoke no match',
  p_ui_locale: 'en',
  p_scope_id: 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  p_latitude: null,
  p_longitude: null,
  p_radius_m: null,
  p_taxonomy_node_id: null,
  p_entity_types: ['PLACE'],
  p_time_start: null,
  p_time_end: null,
  p_query_vector: null,
  p_embedding_provider: 'not-configured',
  p_embedding_model: 'not-configured',
  p_embedding_revision: 'not-configured',
  p_embedding_dimension: 1,
  p_limit: 10,
  p_search_config_version: 'search-02-deterministic-v1',
});

const noKey = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: requestBody,
});
assert(!noKey.ok, 'no-key RPC access unexpectedly succeeded');
assert([401, 403].includes(noKey.status), 'no-key RPC did not fail as authentication');

const publishable = await fetch(rpcUrl, {
  method: 'POST',
  headers: {
    apikey: publishableKey,
    authorization: `Bearer ${publishableKey}`,
    'content-type': 'application/json',
  },
  body: requestBody,
});
assert(!publishable.ok, 'publishable-key RPC access unexpectedly succeeded');
assert([401, 403, 404].includes(publishable.status), 'publishable-key RPC did not fail closed');

const backendHeaders = {
  apikey: backendKey,
  authorization: `Bearer ${backendKey}`,
  'content-type': 'application/json',
};
const backend = await fetch(rpcUrl, {
  method: 'POST',
  headers: backendHeaders,
  body: requestBody,
});
const backendText = await backend.text();
assert(backend.ok, 'backend-key RPC access failed');
const backendPayload = JSON.parse(backendText);
assert(Array.isArray(backendPayload), 'backend RPC response is not the shaped result array');
assert(backendPayload.length === 0, 'no-match security smoke returned unexpected data');

const privateRead = await fetch(`${restUrl}/canonical_entities?select=id`, {
  headers: backendHeaders,
});
assert(!privateRead.ok, 'backend key reached a private table through the exposed schema');

const privateProfileRead = await fetch(`${restUrl}/canonical_entities?select=id`, {
  headers: { ...backendHeaders, 'accept-profile': 'app' },
});
assert(!privateProfileRead.ok, 'backend key selected the private app schema');

const openApi = await fetch(`${restUrl}/`, {
  headers: { ...backendHeaders, accept: 'application/openapi+json' },
});
assert(openApi.ok, 'OpenAPI document was unavailable to the backend path');
const openApiPayload = await openApi.json();
const paths = Object.keys(openApiPayload.paths ?? {});
assert(paths.includes('/rpc/search_v1'), 'OpenAPI does not expose search_v1');
assert(
  paths.filter((path) => path !== '/').length === 1,
  'OpenAPI exposes more than the one shaped RPC',
);

const inspectedBodies = [await noKey.text(), await publishable.text(), backendText];
const forbiddenLeakPattern = /(source_payload|raw_payload|query_vector|prosrc|stack trace|service_role_key|secret_key)/i;
assert(
  inspectedBodies.every((body) => !forbiddenLeakPattern.test(body)),
  'an HTTP response exposed a forbidden internal field or secret name',
);
assert(
  inspectedBodies.every((body) => !body.includes(backendKey) && !body.includes(publishableKey)),
  'an HTTP response reflected a credential',
);

console.log(
  `SEC-01 security smoke: PASS (${assertions} HTTP/config assertions + 38 pgTAP assertions${diagnosticsRequested ? ' + 34 diagnostic pgTAP assertions' : ''})`,
);
