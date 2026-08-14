begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(75);

select has_schema('app', 'private app schema exists');
select has_schema('api', 'public API schema exists');
select has_schema('diagnostic', 'restricted diagnostic schema exists');
select has_extension('postgis', 'PostGIS is installed');
select has_extension('pg_trgm', 'pg_trgm is installed');
select has_extension('unaccent', 'unaccent is installed');
select has_extension('vector', 'pgvector is installed');
select has_extension('pgcrypto', 'pgcrypto is installed');

select has_table('app', 'geographic_scopes', 'geographic scopes table exists');
select has_table('app', 'geographic_scope_boundaries', 'scope boundaries table exists');
select has_table('app', 'sources', 'sources table exists');
select has_table('app', 'ingestion_runs', 'ingestion runs table exists');
select has_table('app', 'source_records', 'source records table exists');
select has_table('app', 'source_record_versions', 'source record versions table exists');
select has_table('app', 'source_record_parse_attempts', 'parse attempts table exists');
select hasnt_column(
  'app', 'source_record_versions', 'parser_version',
  'parser version does not contaminate immutable captured content'
);
select hasnt_column(
  'app', 'source_record_versions', 'normalized_output',
  'parser output belongs to parse attempts, not source versions'
);
select has_index(
  'app', 'geographic_scopes', 'geographic_scopes_active_slug_idx',
  'active scope slug index exists'
);
select has_index(
  'app', 'geographic_scope_boundaries', 'geographic_scope_boundaries_boundary_idx',
  'scope boundary GiST index exists'
);
select has_index(
  'app', 'ingestion_runs', 'ingestion_runs_source_started_idx',
  'source run history index exists'
);
select has_index(
  'app', 'source_record_versions', 'source_record_versions_record_observed_idx',
  'record observation history index exists'
);
select has_index(
  'app', 'source_record_parse_attempts', 'source_record_parse_attempts_success_idx',
  'successful parser replay index exists'
);
select has_fk(
  'app', 'geographic_scope_boundaries',
  'scope boundaries retain scope ownership'
);
select has_fk('app', 'ingestion_runs', 'ingestion runs retain source/scope ownership');
select has_fk(
  'app', 'source_record_versions',
  'source versions retain record/run ownership'
);
select has_fk(
  'app', 'source_record_parse_attempts',
  'parse attempts retain version/run ownership'
);

select enum_has_labels(
  'app',
  'source_refresh_mode',
  array['COMPLETE_SNAPSHOT', 'PAGINATED_SNAPSHOT', 'DELTA_ONLY'],
  'source refresh modes are frozen'
);
select enum_has_labels(
  'app',
  'source_parse_attempt_status',
  array['STARTED', 'SUCCEEDED', 'FAILED'],
  'parse attempt states are frozen'
);
select has_role('lemon_ingestion', 'ingestion runtime role exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'app.source_records'::regclass),
  'RLS is enabled on source records'
);
select ok(
  not has_table_privilege('service_role', 'app.source_records', 'SELECT'),
  'service_role cannot read private source records'
);

insert into app.geographic_scopes (
  id,
  slug,
  name_en,
  name_sv,
  timezone,
  country_code
) values (
  '00000000-0000-0000-0000-000000000001',
  'jonkoping-test',
  'Jönköping test',
  'Jönköping test',
  'Europe/Stockholm',
  'SE'
);

insert into app.geographic_scope_boundaries (
  id,
  scope_id,
  version,
  boundary,
  source_name,
  source_url,
  licence,
  attribution,
  source_checksum,
  effective_from,
  is_active
) values (
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'test-v1',
  extensions.st_multi(
    extensions.st_geomfromtext(
      'POLYGON((14 57, 15 57, 15 58, 14 58, 14 57))',
      4326
    )
  ),
  'Test boundary',
  'https://example.invalid/boundary',
  'Test only',
  'Test only',
  repeat('0', 64),
  '2026-08-13 00:00:00+00',
  true
);

select ok(
  (
    select extensions.st_isvalid(boundary)
      and extensions.st_srid(boundary) = 4326
    from app.geographic_scope_boundaries
    where id = '00000000-0000-0000-0000-000000000011'
  ),
  'scope boundary is valid SRID 4326 geometry'
);

select throws_ok(
  $$
    update app.geographic_scope_boundaries
    set source_name = 'Changed source'
    where id = '00000000-0000-0000-0000-000000000011'
  $$,
  '55000',
  'geographic scope boundary evidence is immutable',
  'boundary evidence cannot be changed in place'
);

select throws_ok(
  $$
    insert into app.geographic_scope_boundaries (
      scope_id, version, boundary, source_name, source_url,
      licence, attribution, source_checksum, effective_from, is_active
    ) values (
      '00000000-0000-0000-0000-000000000001',
      'test-v2',
      extensions.st_multi(
        extensions.st_geomfromtext(
          'POLYGON((14 57, 15 57, 15 58, 14 58, 14 57))',
          4326
        )
      ),
      'Test boundary', 'https://example.invalid/boundary',
      'Test only', 'Test only', repeat('1', 64), now(), true
    )
  $$,
  '23505',
  null,
  'only one boundary can be active for a scope'
);

insert into app.sources (
  id,
  key,
  name,
  kind,
  licence,
  attribution,
  persistence_permission,
  refresh_mode,
  adapter_version
) values
  (
    '00000000-0000-0000-0000-000000000101',
    'snapshot-test',
    'Snapshot test',
    'MANUAL',
    'Test only',
    'Test only',
    'FULL_PAYLOAD',
    'COMPLETE_SNAPSHOT',
    'adapter-v1'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'delta-test',
    'Delta test',
    'MANUAL',
    'Test only',
    'Test only',
    'METADATA_ONLY',
    'DELTA_ONLY',
    'adapter-v1'
  );

select ok(
  has_table_privilege('lemon_ingestion', 'app.ingestion_runs', 'SELECT,INSERT,UPDATE')
    and has_table_privilege('lemon_ingestion', 'app.source_records', 'SELECT,INSERT,UPDATE')
    and has_table_privilege('lemon_ingestion', 'app.source_record_versions', 'SELECT,INSERT')
    and not has_table_privilege('lemon_ingestion', 'app.source_record_versions', 'UPDATE')
    and has_table_privilege(
      'lemon_ingestion',
      'app.source_record_parse_attempts',
      'SELECT,INSERT,UPDATE'
    )
    and exists (
      select 1
      from pg_policies
      where schemaname = 'app'
        and tablename = 'source_records'
        and policyname = 'source_records_ingestion'
        and 'lemon_ingestion' = any(roles)
    ),
  'lemon_ingestion has the declared RLS-governed source capture privileges'
);

select throws_ok(
  $$
    insert into app.sources (
      key, name, kind, licence, attribution, persistence_permission,
      refresh_mode, rate_limit_requests, adapter_version
    ) values (
      'invalid-rate', 'Invalid rate', 'MANUAL', 'Test', 'Test',
      'METADATA_ONLY', 'DELTA_ONLY', 1, 'adapter-v1'
    )
  $$,
  '23514',
  null,
  'rate-limit fields must be paired and positive'
);

select throws_ok(
  $$
    update app.geographic_scopes
    set slug = 'renamed'
    where id = '00000000-0000-0000-0000-000000000001'
  $$,
  '55000',
  'geographic scope slug is immutable',
  'scope slug cannot be changed'
);

insert into app.ingestion_runs (
  id,
  idempotency_key,
  source_id,
  scope_id,
  adapter_version,
  parser_version,
  mapping_version
) values (
  '00000000-0000-0000-0000-000000000201',
  'snapshot-run-1',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'adapter-v1',
  'parser-v1',
  'mapping-v1'
);

select throws_ok(
  $$
    update app.ingestion_runs
    set status = 'SUCCEEDED',
        finished_at = '2026-08-13 10:00:00+00',
        refresh_unit_complete = true
    where id = '00000000-0000-0000-0000-000000000201'
  $$,
  '23514',
  'successful snapshot run must confirm snapshot completeness',
  'successful snapshot run requires complete snapshot evidence'
);

select lives_ok(
  $$
    update app.ingestion_runs
    set status = 'SUCCEEDED',
        finished_at = '2026-08-13 10:00:00+00',
        refresh_unit_complete = true,
        snapshot_complete = true,
        fetched = 1,
        valid = 1
    where id = '00000000-0000-0000-0000-000000000201'
  $$,
  'a complete snapshot run can succeed'
);

select is(
  (
    select last_successful_refresh
    from app.sources
    where id = '00000000-0000-0000-0000-000000000101'
  ),
  '2026-08-13 10:00:00+00'::timestamptz,
  'source health is derived from the qualifying run'
);

select throws_ok(
  $$
    update app.ingestion_runs
    set fetched = 2
    where id = '00000000-0000-0000-0000-000000000201'
  $$,
  '55000',
  'terminal ingestion runs are immutable',
  'terminal ingestion run cannot be edited'
);

insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id,
  adapter_version, parser_version, mapping_version
) values (
  '00000000-0000-0000-0000-000000000202',
  'snapshot-run-started',
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  'adapter-v1', 'parser-v2', 'mapping-v1'
);

select throws_ok(
  $$
    insert into app.ingestion_runs (
      idempotency_key, source_id, scope_id, adapter_version,
      parser_version, mapping_version, retry_of_run_id
    ) values (
      'invalid-retry',
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000001',
      'adapter-v1', 'parser-v2', 'mapping-v1',
      '00000000-0000-0000-0000-000000000202'
    )
  $$,
  '23514',
  'retry must reference a terminal run for the same source and scope',
  'retry cannot target an active run'
);

insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id,
  adapter_version, parser_version, mapping_version
) values (
  '00000000-0000-0000-0000-000000000203',
  'delta-run-1',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'adapter-v1', 'parser-v1', 'mapping-v1'
);

select throws_ok(
  $$
    update app.ingestion_runs
    set snapshot_complete = true
    where id = '00000000-0000-0000-0000-000000000203'
  $$,
  '23514',
  'DELTA_ONLY run snapshot_complete must be null',
  'DELTA_ONLY cannot claim snapshot completeness'
);

select throws_ok(
  $$
    update app.ingestion_runs
    set disappeared = 1
    where id = '00000000-0000-0000-0000-000000000203'
  $$,
  '23514',
  'DELTA_ONLY run cannot produce disappearance',
  'DELTA_ONLY absence cannot become disappearance'
);

select throws_ok(
  $$
    update app.ingestion_runs
    set error_summary = '{"raw":"not a bounded count"}'::jsonb
    where id = '00000000-0000-0000-0000-000000000203'
  $$,
  '23514',
  null,
  'error summary accepts codes and counts only'
);

select lives_ok(
  $$
    update app.ingestion_runs
    set status = 'SUCCEEDED',
        finished_at = '2026-08-13 11:00:00+00',
        refresh_unit_complete = true
    where id = '00000000-0000-0000-0000-000000000203'
  $$,
  'successful DELTA_ONLY polling advances without snapshot completeness'
);

select is(
  (
    select last_successful_refresh
    from app.sources
    where id = '00000000-0000-0000-0000-000000000102'
  ),
  '2026-08-13 11:00:00+00'::timestamptz,
  'qualifying DELTA_ONLY run advances source health'
);

insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id,
  adapter_version, parser_version, mapping_version
) values (
  '00000000-0000-0000-0000-000000000204',
  'delta-partial',
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  'adapter-v1', 'parser-v1', 'mapping-v1'
);

select lives_ok(
  $$
    update app.ingestion_runs
    set status = 'PARTIAL',
        finished_at = '2026-08-13 12:00:00+00'
    where id = '00000000-0000-0000-0000-000000000204'
  $$,
  'partial run is terminal but non-qualifying'
);

select is(
  (
    select last_successful_refresh
    from app.sources
    where id = '00000000-0000-0000-0000-000000000102'
  ),
  '2026-08-13 11:00:00+00'::timestamptz,
  'partial run cannot advance source health'
);

select lives_ok(
  $$
    insert into app.ingestion_runs (
      id, idempotency_key, source_id, scope_id, adapter_version,
      parser_version, mapping_version, retry_of_run_id
    ) values (
      '00000000-0000-0000-0000-000000000205',
      'snapshot-retry-1',
      '00000000-0000-0000-0000-000000000101',
      '00000000-0000-0000-0000-000000000001',
      'adapter-v1', 'parser-v2', 'mapping-v1',
      '00000000-0000-0000-0000-000000000201'
    )
  $$,
  'retry creates a new STARTED run linked to a terminal run'
);

insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id,
  adapter_version, parser_version, mapping_version
) values
  (
    '00000000-0000-0000-0000-000000000206',
    'snapshot-parser-v1',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v1', 'mapping-v1'
  ),
  (
    '00000000-0000-0000-0000-000000000207',
    'delta-capture-active',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v1', 'mapping-v1'
  );

insert into app.source_records (
  id, source_id, external_key, first_seen_at, last_seen_at
) values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000101',
    'record-1',
    '2026-08-13 09:00:00+00',
    '2026-08-13 09:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000101',
    'record-2',
    '2026-08-13 09:00:00+00',
    '2026-08-13 09:00:00+00'
  );

select throws_ok(
  $$
    insert into app.source_records (
      source_id, external_key, first_seen_at, last_seen_at
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'record-1', now(), now()
    )
  $$,
  '23505',
  null,
  'source and external key are idempotent identity'
);

select throws_ok(
  $$
    update app.source_records
    set shared_identifier_scheme = 'wikidata'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '23514',
  null,
  'shared identifier fields must be paired'
);

select throws_ok(
  $$
    update app.source_records
    set external_key = 'changed-record-key'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '55000',
  'source record identity is immutable',
  'source external identity cannot be changed'
);

select throws_ok(
  $$
    update app.source_records
    set last_complete_snapshot_run_id = '00000000-0000-0000-0000-000000000203'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '23514',
  'last complete snapshot run is not qualifying evidence for this source record',
  'source record cannot select a different or non-snapshot run'
);

insert into app.source_record_versions (
  id,
  source_record_id,
  capture_run_id,
  content_hash,
  payload,
  payload_storage_mode,
  fetched_at,
  observed_at
) values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000206',
    repeat('a', 64),
    '{"name":"Evidence one"}',
    'FULL_PAYLOAD',
    '2026-08-13 09:00:00+00',
    '2026-08-13 09:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000206',
    repeat('b', 64),
    '{"name":"Evidence two"}',
    'FULL_PAYLOAD',
    '2026-08-13 09:00:00+00',
    '2026-08-13 09:00:00+00'
  );

select throws_ok(
  $$
    insert into app.source_record_versions (
      source_record_id, capture_run_id, content_hash, payload,
      payload_storage_mode, fetched_at, observed_at
    ) values (
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000206',
      repeat('a', 64), '{}', 'FULL_PAYLOAD', now(), now()
    )
  $$,
  '23505',
  null,
  'same content hash reuses immutable source version identity'
);

select throws_ok(
  $$
    insert into app.source_record_versions (
      source_record_id, capture_run_id, content_hash, payload,
      payload_storage_mode, fetched_at, observed_at
    ) values (
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000201',
      repeat('8', 64), '{}', 'FULL_PAYLOAD', now(), now()
    )
  $$,
  '23514',
  'capture run must be STARTED',
  'terminal run cannot receive new captured content'
);

select throws_ok(
  $$
    insert into app.source_record_versions (
      source_record_id, capture_run_id, content_hash, payload,
      payload_storage_mode, fetched_at, observed_at
    ) values (
      '00000000-0000-0000-0000-000000000301',
      '00000000-0000-0000-0000-000000000207',
      repeat('c', 64), '{}', 'METADATA_ENVELOPE', now(), now()
    )
  $$,
  '23514',
  'capture run must belong to the source record source',
  'capture run source must match source record source'
);

select throws_ok(
  $$
    insert into app.source_records (
      id, source_id, external_key, first_seen_at, last_seen_at
    ) values (
      '00000000-0000-0000-0000-000000000303',
      '00000000-0000-0000-0000-000000000102',
      'delta-record', now(), now()
    );
    insert into app.source_record_versions (
      source_record_id, capture_run_id, content_hash, payload,
      payload_storage_mode, fetched_at, observed_at
    ) values (
      '00000000-0000-0000-0000-000000000303',
      '00000000-0000-0000-0000-000000000207',
      repeat('d', 64), '{}', 'FULL_PAYLOAD', now(), now()
    )
  $$,
  '23514',
  'source policy forbids full payload storage',
  'source persistence policy constrains captured content'
);

select throws_ok(
  $$
    update app.source_record_versions
    set payload = '{"changed":true}'
    where id = '00000000-0000-0000-0000-000000000401'
  $$,
  '55000',
  'source record versions are immutable outside compliance redaction',
  'captured source evidence cannot be overwritten'
);

insert into app.source_record_parse_attempts (
  id,
  source_record_version_id,
  ingestion_run_id,
  parser_version
) values (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000206',
  'parser-v1'
);

select throws_ok(
  $$
    insert into app.source_record_parse_attempts (
      source_record_version_id, ingestion_run_id, parser_version
    ) values (
      '00000000-0000-0000-0000-000000000402',
      '00000000-0000-0000-0000-000000000201',
      'parser-v1'
    )
  $$,
  '23514',
  'parse attempt run must be STARTED',
  'terminal run cannot receive a new parser attempt'
);

select throws_ok(
  $$
    insert into app.source_record_parse_attempts (
      source_record_version_id, ingestion_run_id, parser_version
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000202',
      'parser-wrong'
    )
  $$,
  '23514',
  'parse attempt parser version must match its ingestion run',
  'parse attempt is pinned to the run parser version'
);

select lives_ok(
  $$
    update app.source_record_parse_attempts
    set status = 'FAILED',
        finished_at = now(),
        error_class = 'VALIDATION',
        error_code = 'MISSING_NAME'
    where id = '00000000-0000-0000-0000-000000000501'
  $$,
  'a failed parser attempt preserves the captured version'
);

select throws_ok(
  $$
    update app.source_record_parse_attempts
    set error_code = 'CHANGED_ERROR'
    where id = '00000000-0000-0000-0000-000000000501'
  $$,
  '55000',
  'terminal source parse attempts are immutable',
  'failed parser attempt is terminal and immutable'
);

insert into app.source_record_parse_attempts (
  id,
  source_record_version_id,
  ingestion_run_id,
  parser_version
) values (
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000401',
  '00000000-0000-0000-0000-000000000202',
  'parser-v2'
);

select lives_ok(
  $$
    update app.source_record_parse_attempts
    set status = 'SUCCEEDED',
        finished_at = now(),
        normalized_output = '{"name":"Parsed"}',
        normalized_output_hash = repeat('e', 64)
    where id = '00000000-0000-0000-0000-000000000502'
  $$,
  'a corrected parser succeeds against the same immutable version'
);

select throws_ok(
  $$
    insert into app.source_record_parse_attempts (
      source_record_version_id, ingestion_run_id, parser_version
    ) values (
      '00000000-0000-0000-0000-000000000401',
      '00000000-0000-0000-0000-000000000202',
      'parser-v2'
    )
  $$,
  '23505',
  null,
  'version, parser, and run identify one parser execution'
);

select is(
  (
    select count(*)
    from app.source_record_versions
    where source_record_id = '00000000-0000-0000-0000-000000000301'
  ),
  1::bigint,
  'parser replay does not create a fake source version'
);

insert into app.source_record_parse_attempts (
  id,
  source_record_version_id,
  ingestion_run_id,
  parser_version
) values (
  '00000000-0000-0000-0000-000000000503',
  '00000000-0000-0000-0000-000000000402',
  '00000000-0000-0000-0000-000000000202',
  'parser-v2'
);

update app.source_record_parse_attempts
set status = 'SUCCEEDED',
    finished_at = now(),
    normalized_output = '{"name":"Parsed two"}',
    normalized_output_hash = repeat('f', 64)
where id = '00000000-0000-0000-0000-000000000503';

set constraints all immediate;

select throws_ok(
  $$
    update app.source_records
    set current_version_id = '00000000-0000-0000-0000-000000000401'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '23514',
  null,
  'source-current version and attempt must be paired'
);

select lives_ok(
  $$
    update app.source_records
    set current_version_id = '00000000-0000-0000-0000-000000000401',
        current_parse_attempt_id = '00000000-0000-0000-0000-000000000502'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  'unresolved record may select owned successful evidence'
);

select throws_ok(
  $$
    update app.source_records
    set current_version_id = '00000000-0000-0000-0000-000000000402',
        current_parse_attempt_id = '00000000-0000-0000-0000-000000000503'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '23514',
  'source current evidence must select an available owned version and successful owned parse attempt',
  'source current evidence cannot select another record ownership'
);

select throws_ok(
  $$
    update app.source_records
    set current_version_id = '00000000-0000-0000-0000-000000000401',
        current_parse_attempt_id = '00000000-0000-0000-0000-000000000501'
    where id = '00000000-0000-0000-0000-000000000301'
  $$,
  '23514',
  'source current evidence must select an available owned version and successful owned parse attempt',
  'failed parse attempt cannot become current evidence'
);

select is(
  (
    select current_parse_attempt_id
    from app.source_records
    where id = '00000000-0000-0000-0000-000000000301'
  ),
  '00000000-0000-0000-0000-000000000502'::uuid,
  'failed newer selection preserves prior successful current evidence'
);

select is(
  (
    select canonical_entity_id
    from app.source_records
    where id = '00000000-0000-0000-0000-000000000301'
  ),
  null::uuid,
  'source-current evidence does not imply canonical truth'
);

select throws_ok(
  $$
    update app.sources
    set last_successful_refresh = now()
    where id = '00000000-0000-0000-0000-000000000101'
  $$,
  '55000',
  'source refresh health is derived from qualifying ingestion runs',
  'source health cache cannot be edited independently'
);

select ok(
  not has_schema_privilege('anon', 'app', 'USAGE')
    and not has_schema_privilege('authenticated', 'app', 'USAGE')
    and has_schema_privilege('service_role', 'app', 'USAGE'),
  'public roles cannot use app; service_role has signature-only schema usage'
);

select is(
  (
    select count(*)
    from information_schema.tables
    where table_schema = 'api'
  ),
  0::bigint,
  'public API schema contains no tables'
);

select * from finish();
rollback;
