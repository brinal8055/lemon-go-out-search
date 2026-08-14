begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(17);

select is(
  (select count(*)::integer from app.sources where key = 'OSM_OVERPASS'),
  1,
  'exactly one OSM_OVERPASS source is seeded'
);
select is((select kind from app.sources where key = 'OSM_OVERPASS'), 'OSM_OVERPASS', 'source kind is OSM_OVERPASS');
select is((select name from app.sources where key = 'OSM_OVERPASS'), 'OpenStreetMap via Overpass', 'reviewed source name is retained');
select is((select base_url from app.sources where key = 'OSM_OVERPASS'), 'https://overpass-api.de/api/interpreter', 'approved endpoint is retained');
select is((select licence from app.sources where key = 'OSM_OVERPASS'), 'ODbL 1.0', 'ODbL 1.0 licence is retained');
select is((select licence_url from app.sources where key = 'OSM_OVERPASS'), 'https://www.openstreetmap.org/copyright', 'licence reference is retained');
select is((select terms_url from app.sources where key = 'OSM_OVERPASS'), 'https://dev.overpass-api.de/overpass-doc/en/preface/commons.html', 'Overpass usage terms are retained');
select is((select attribution from app.sources where key = 'OSM_OVERPASS'), '© OpenStreetMap contributors', 'required attribution is retained');
select is((select persistence_permission from app.sources where key = 'OSM_OVERPASS'), 'EXTRACTED_FIELDS_ONLY', 'only extracted fields may persist');
select is((select refresh_mode::text from app.sources where key = 'OSM_OVERPASS'), 'DELTA_ONLY', 'bounded OSM uses DELTA_ONLY');
select is((select rate_limit_requests from app.sources where key = 'OSM_OVERPASS'), 1, 'source permits one request per window');
select is((select rate_limit_window_seconds from app.sources where key = 'OSM_OVERPASS'), 5, 'source rate window is five seconds');
select ok(
  (select rate_limit_requests > 0 and rate_limit_window_seconds > 0 from app.sources where key = 'OSM_OVERPASS'),
  'rate-limit pair is valid'
);
select is((select adapter_version from app.sources where key = 'OSM_OVERPASS'), 'osm-overpass-v1', 'registry and adapter versions match');
select is((select credentials_secret_name from app.sources where key = 'OSM_OVERPASS'), null, 'no credentials secret is required');
select ok((select enabled from app.sources where key = 'OSM_OVERPASS'), 'OSM source is enabled');
select ok(
  not has_schema_privilege('anon', 'app', 'USAGE')
  and not has_schema_privilege('authenticated', 'app', 'USAGE')
  and not has_schema_privilege('service_role', 'app', 'USAGE'),
  'private app schema exposure remains unchanged'
);

select * from finish();
rollback;
