begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(38);

select is(
  (select count(*) from information_schema.tables where table_schema = 'api'),
  0::bigint,
  'the exposed api schema contains no tables or views'
);
select is(
  (select count(*) from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'api'),
  1::bigint,
  'the exposed api schema contains only one routine'
);
select has_function(
  'api',
  'search_v1',
  array[
    'uuid', 'text', 'text', 'text', 'text', 'uuid',
    'double precision', 'double precision', 'integer', 'uuid',
    'app.entity_type[]', 'timestamp with time zone', 'timestamp with time zone',
    'extensions.vector', 'text', 'text', 'text', 'integer', 'smallint', 'text'
  ],
  'the frozen search_v1 signature exists'
);
select is(
  (select rolname
   from pg_proc
   join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   join pg_roles on pg_roles.oid = pg_proc.proowner
   where pg_namespace.nspname = 'api' and pg_proc.proname = 'search_v1'),
  'lemon_api_owner',
  'search_v1 is owned by the dedicated non-login role'
);
select ok(
  (select prosecdef from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'api' and pg_proc.proname = 'search_v1'),
  'search_v1 is SECURITY DEFINER'
);
select is(
  (select proconfig from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'api' and pg_proc.proname = 'search_v1'),
  array['search_path=""'],
  'search_v1 has a fixed empty search_path'
);
select ok(
  (select not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
   from pg_roles where rolname = 'lemon_api_owner'),
  'lemon_api_owner is non-login, NOINHERIT, non-superuser, and subject to RLS'
);
select ok(
  not exists (
    select 1
    from pg_auth_members as membership
    join pg_roles as member on member.oid = membership.member
    join pg_roles as granted_role on granted_role.oid = membership.roleid
    where member.rolname = 'postgres'
      and granted_role.rolname = 'lemon_api_owner'
      and (membership.inherit_option or membership.set_option)
  ),
  'migration-time owner membership cannot be inherited or assumed after setup'
);
select ok(
  (select position('execute ' in lower(prosrc)) = 0
   from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'api' and pg_proc.proname = 'search_v1'),
  'search_v1 contains no dynamic SQL execution'
);

select ok(
  has_schema_privilege('service_role', 'api', 'USAGE'),
  'service_role has api schema usage'
);
select ok(
  has_function_privilege('service_role', 'api.search_v1(uuid,text,text,text,text,uuid,double precision,double precision,integer,uuid,app.entity_type[],timestamp with time zone,timestamp with time zone,extensions.vector,text,text,text,integer,smallint,text)', 'EXECUTE'),
  'service_role can execute only the shaped search routine'
);
select ok(
  not has_function_privilege('anon', 'api.search_v1(uuid,text,text,text,text,uuid,double precision,double precision,integer,uuid,app.entity_type[],timestamp with time zone,timestamp with time zone,extensions.vector,text,text,text,integer,smallint,text)', 'EXECUTE'),
  'anon cannot execute search_v1'
);
select ok(
  not has_function_privilege('authenticated', 'api.search_v1(uuid,text,text,text,text,uuid,double precision,double precision,integer,uuid,app.entity_type[],timestamp with time zone,timestamp with time zone,extensions.vector,text,text,text,integer,smallint,text)', 'EXECUTE'),
  'authenticated cannot execute search_v1'
);
select ok(
  not has_function_privilege('public', 'api.search_v1(uuid,text,text,text,text,uuid,double precision,double precision,integer,uuid,app.entity_type[],timestamp with time zone,timestamp with time zone,extensions.vector,text,text,text,integer,smallint,text)', 'EXECUTE'),
  'PUBLIC cannot execute search_v1'
);
select ok(
  not has_table_privilege('service_role', 'app.canonical_entities', 'SELECT'),
  'service_role cannot read canonical tables directly'
);
select ok(
  not has_table_privilege('service_role', 'app.source_record_versions', 'SELECT'),
  'service_role cannot read retained source evidence directly'
);
select ok(
  not has_schema_privilege('service_role', 'diagnostic', 'USAGE'),
  'service_role cannot use the diagnostic schema'
);

select ok(
  has_table_privilege('lemon_api_owner', 'app.canonical_entities', 'SELECT')
    and has_table_privilege('lemon_api_owner', 'app.places', 'SELECT')
    and has_table_privilege('lemon_api_owner', 'app.events', 'SELECT')
    and has_table_privilege('lemon_api_owner', 'app.event_critical_evidence_v', 'SELECT')
    and has_table_privilege('lemon_api_owner', 'app.search_configs', 'SELECT'),
  'lemon_api_owner has the required shaped-search reads'
);
select ok(
  not has_table_privilege('lemon_api_owner', 'app.canonical_entities', 'INSERT,UPDATE,DELETE'),
  'lemon_api_owner cannot mutate canonical truth'
);
select ok(
  not has_table_privilege('lemon_api_owner', 'app.source_record_versions', 'SELECT')
    and not has_table_privilege('lemon_api_owner', 'app.sources', 'SELECT')
    and has_table_privilege('lemon_api_owner', 'app.embeddings', 'SELECT'),
  'lemon_api_owner cannot read source payloads but can execute private exact-vector retrieval'
);
select is(
  (select count(*) from pg_policies where schemaname = 'app' and roles = '{lemon_api_owner}'),
  11::bigint,
  'lemon_api_owner has exactly the narrow read policies required by search'
);

select is(
  (select count(*) from app.search_configs where is_active),
  1::bigint,
  'exactly one search configuration is active'
);
select is(
  (select version from app.search_configs where is_active),
  'rank-01-rrf-v1',
  'the selected embedding configuration is active'
);
select ok(
  (select is_active and public_search_enabled
   from app.geographic_scopes where slug = 'jonkoping-municipality'),
  'the active Jönköping scope is enabled for the public boundary'
);

insert into app.canonical_entities (
  id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
  publication_status, scope_id, scope_boundary_id, published_at
)
select '91000000-0000-0000-0000-000000000001', 'PLACE',
       'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe',
       'PUBLISHED', boundary.scope_id, boundary.id, now()
from app.geographic_scope_boundaries as boundary
where boundary.is_active;

insert into app.places (entity_id, location, locality, status)
select '91000000-0000-0000-0000-000000000001',
       extensions.st_pointonsurface(boundary.boundary)::extensions.geography,
       'Jönköping', 'ACTIVE'
from app.geographic_scope_boundaries as boundary
where boundary.is_active;

set local role service_role;

select is(
  (select count(*) from api.search_v1(
    '91000000-0000-0000-0000-000000000099',
    'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'rank-01-rrf-v1'
  )),
  1::bigint,
  'service_role can execute the shaped RPC'
);
select is(
  (select display_name from api.search_v1(
    '91000000-0000-0000-0000-000000000099',
    'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'sv',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'rank-01-rrf-v1'
  )),
  'SEC Fixture Café',
  'the RPC returns the safe canonical display name'
);
select ok(
  (select not semantic_used and semantic_degraded
   from api.search_v1(
    '91000000-0000-0000-0000-000000000099',
    'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'rank-01-rrf-v1'
  )),
  'the DB reports vector-NULL semantic degradation while retaining deterministic results'
);
select is(
  (select count(*) from api.search_v1(
    '91000000-0000-0000-0000-000000000099',
    'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    null, null, null, null,
    array['EVENT']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'rank-01-rrf-v1'
  )),
  0::bigint,
  'an unsupported Event-only filter cannot leak Place results'
);

reset role;

select throws_ok(
  $$
    select * from api.search_v1(
      null, 'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 10::smallint, 'rank-01-rrf-v1'
    )
  $$,
  '22023',
  'request ID is required',
  'a missing request ID is rejected'
);
select throws_ok(
  $$
    select * from api.search_v1(
      gen_random_uuid(), 'SEC Fixture Café', 'wrong', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 10::smallint, 'rank-01-rrf-v1'
    )
  $$,
  '22023',
  'query normalization is invalid',
  'normalization mismatch is rejected'
);
select throws_ok(
  $$
    select * from api.search_v1(
      gen_random_uuid(), 'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 10::smallint, 'stale-config'
    )
  $$,
  '55000',
  'search configuration is unavailable',
  'stale search configuration is rejected'
);
select throws_ok(
  $$
    select * from api.search_v1(
      gen_random_uuid(), 'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 57.7, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 10::smallint, 'rank-01-rrf-v1'
    )
  $$,
  '22023',
  'location is invalid',
  'unpaired coordinates are rejected'
);
select throws_ok(
  $$
    select * from api.search_v1(
      gen_random_uuid(), 'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 21::smallint, 'rank-01-rrf-v1'
    )
  $$,
  '22023',
  'limit is invalid',
  'limit over the public cap is rejected'
);
set local role anon;
select throws_ok(
  $$
    select * from api.search_v1(
      '91000000-0000-0000-0000-000000000099',
      'SEC Fixture Café', 'sec fixture café', 'sec fixture cafe', 'en',
      'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
      null, null, null, null::extensions.vector, 'voyage', 'voyage-4',
      'voyage-4-preflight-v1', 1024, 10::smallint, 'rank-01-rrf-v1'
    )
  $$,
  '42501',
  null,
  'anon execution fails at the database boundary'
);
reset role;

select is(
  (select count(*)
   from information_schema.parameters
   where specific_schema = 'api' and parameter_mode = 'IN'),
  20::bigint,
  'the public routine has exactly the frozen twenty input parameters'
);
select ok(
  not exists (
    select 1
    from information_schema.parameters
    where specific_schema = 'api'
      and parameter_mode = 'OUT'
      and parameter_name in (
        'match_type', 'protected', 'score', 'rank', 'provenance',
        'query_vector', 'source_payload', 'diagnostic'
      )
  ),
  'the public result exposes no diagnostic, score, vector, provenance, or payload fields'
);
select is(
  (select count(*)
   from information_schema.parameters
   where specific_schema = 'api' and parameter_mode = 'OUT'),
  18::bigint,
  'the public result has exactly the frozen eighteen shaped fields'
);
select ok(
  (select every(parameter_name in (
     'result_position', 'entity_id', 'entity_type', 'display_name', 'categories',
     'latitude', 'longitude', 'distance_m', 'factual_summary', 'place_status',
     'opening_hours', 'event_starts_at', 'event_ends_at', 'event_timezone',
     'event_status', 'venue', 'semantic_used', 'semantic_degraded'
   ))
   from information_schema.parameters
   where specific_schema = 'api' and parameter_mode = 'OUT'),
  'the public result contains only frozen shaped fields'
);

select * from finish();
rollback;
