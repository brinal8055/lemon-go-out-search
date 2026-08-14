begin;

create extension if not exists pgtap with schema extensions;

select plan(47);

grant lemon_ingestion to postgres with set true;
grant usage on schema extensions to lemon_ingestion;

select ok(
  to_regprocedure(
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)'
  ) is not null,
  'source-current selection transaction exists'
);
select ok(
  to_regprocedure(
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)'
  ) is not null,
  'source-current stale processing guard exists'
);
select ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'app.source_records'::regclass
      and tgname = 'source_records_enforce_current_selection'
      and not tgisinternal
  ),
  'source-current columns have a selector-only backend guard'
);
select ok(
  not has_function_privilege(
    'anon',
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)',
    'EXECUTE'
  ),
  'source-current selector is unavailable to public API roles'
);
select ok(
  not has_function_privilege(
    'anon',
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'source-current processing guard is unavailable to public API roles'
);
select is(
  (
    select count(*)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'api'
      and procedure.proname in (
        'select_source_record_current_evidence',
        'assert_source_record_current_evidence'
      )
  ),
  0::bigint,
  'DB-02 exposes no source-current helper through the Data API'
);

insert into app.geographic_scopes (
  id, slug, name_en, name_sv, timezone, country_code
) values (
  '20000000-0000-0000-0000-000000000001',
  'db-02-scope',
  'DB-02 scope',
  'DB-02 scope',
  'Europe/Stockholm',
  'SE'
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
  adapter_version,
  enabled
) values (
  '20000000-0000-0000-0000-000000000101',
  'db-02-source',
  'DB-02 source',
  'MANUAL',
  'Test only',
  'Test only',
  'FULL_PAYLOAD',
  'COMPLETE_SNAPSHOT',
  'adapter-v1',
  true
);

insert into app.ingestion_runs (
  id,
  idempotency_key,
  source_id,
  scope_id,
  adapter_version,
  parser_version,
  mapping_version
) values
  (
    '20000000-0000-0000-0000-000000000201',
    'db-02-parser-v1',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v1', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000202',
    'db-02-parser-v2',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v2', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000203',
    'db-02-parser-v3-failed',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v3', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000204',
    'db-02-parser-v4',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v4', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000205',
    'db-02-parser-v5',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v5', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000206',
    'db-02-parser-v6-other-record',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v6', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000207',
    'db-02-parser-v7-terminal',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v7', 'mapping-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000208',
    'db-02-parser-v8-redacted',
    '20000000-0000-0000-0000-000000000101',
    '20000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v8', 'mapping-v1'
  );

insert into app.source_records (
  id, source_id, external_key, first_seen_at, last_seen_at
) values
  (
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000101',
    'db-02-record-1',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:00:00+00'
  ),
  (
    '20000000-0000-0000-0000-000000000302',
    '20000000-0000-0000-0000-000000000101',
    'db-02-record-2',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:00:00+00'
  );

insert into app.source_record_versions (
  id,
  source_record_id,
  capture_run_id,
  content_hash,
  payload,
  payload_storage_mode,
  fetched_at,
  observed_at,
  content_status,
  redaction_reason,
  redacted_at,
  redacted_by,
  redaction_operation_id
) values
  (
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000201',
    repeat('1', 64),
    '{"name":"H1"}',
    'FULL_PAYLOAD',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:00:00+00',
    'AVAILABLE', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000402',
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000204',
    repeat('2', 64),
    '{"name":"H2"}',
    'FULL_PAYLOAD',
    '2026-08-13 11:00:00+00',
    '2026-08-13 11:00:00+00',
    'AVAILABLE', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000403',
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000205',
    repeat('3', 64),
    '{"name":"H3"}',
    'FULL_PAYLOAD',
    '2026-08-13 12:00:00+00',
    '2026-08-13 12:00:00+00',
    'AVAILABLE', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000404',
    '20000000-0000-0000-0000-000000000302',
    '20000000-0000-0000-0000-000000000206',
    repeat('4', 64),
    '{"name":"Other"}',
    'FULL_PAYLOAD',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:00:00+00',
    'AVAILABLE', null, null, null, null
  ),
  (
    '20000000-0000-0000-0000-000000000405',
    '20000000-0000-0000-0000-000000000301',
    '20000000-0000-0000-0000-000000000208',
    repeat('5', 64),
    null,
    'FULL_PAYLOAD',
    '2026-08-13 09:00:00+00',
    '2026-08-13 09:00:00+00',
    'REDACTED',
    'LEGAL_REMOVAL',
    '2026-08-13 12:30:00+00',
    'db-02-compliance',
    '20000000-0000-0000-0000-000000000901'
  );

insert into app.source_record_parse_attempts (
  id, source_record_version_id, ingestion_run_id, parser_version
) values
  (
    '20000000-0000-0000-0000-000000000501',
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000201',
    'parser-v1'
  ),
  (
    '20000000-0000-0000-0000-000000000502',
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000202',
    'parser-v2'
  ),
  (
    '20000000-0000-0000-0000-000000000503',
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000203',
    'parser-v3'
  ),
  (
    '20000000-0000-0000-0000-000000000504',
    '20000000-0000-0000-0000-000000000402',
    '20000000-0000-0000-0000-000000000203',
    'parser-v3'
  ),
  (
    '20000000-0000-0000-0000-000000000505',
    '20000000-0000-0000-0000-000000000402',
    '20000000-0000-0000-0000-000000000204',
    'parser-v4'
  ),
  (
    '20000000-0000-0000-0000-000000000506',
    '20000000-0000-0000-0000-000000000403',
    '20000000-0000-0000-0000-000000000205',
    'parser-v5'
  ),
  (
    '20000000-0000-0000-0000-000000000507',
    '20000000-0000-0000-0000-000000000404',
    '20000000-0000-0000-0000-000000000206',
    'parser-v6'
  ),
  (
    '20000000-0000-0000-0000-000000000508',
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000207',
    'parser-v7'
  );

update app.source_record_parse_attempts
set status = 'SUCCEEDED',
    finished_at = '2026-08-13 10:05:00+00',
    normalized_output = jsonb_build_object('attempt', id::text),
    normalized_output_hash = repeat('a', 64)
where id in (
  '20000000-0000-0000-0000-000000000501',
  '20000000-0000-0000-0000-000000000502',
  '20000000-0000-0000-0000-000000000505',
  '20000000-0000-0000-0000-000000000506',
  '20000000-0000-0000-0000-000000000507',
  '20000000-0000-0000-0000-000000000508'
);

update app.source_record_parse_attempts
set status = 'FAILED',
    finished_at = '2026-08-13 10:05:00+00',
    error_class = 'VALIDATION',
    error_code = 'INVALID_OUTPUT'
where id in (
  '20000000-0000-0000-0000-000000000503',
  '20000000-0000-0000-0000-000000000504'
);

set local session_replication_role = replica;
insert into app.source_record_parse_attempts (
  id,
  source_record_version_id,
  ingestion_run_id,
  parser_version,
  status,
  attempted_at,
  finished_at,
  normalized_output,
  normalized_output_hash,
  output_redacted_at
) values
  (
    '20000000-0000-0000-0000-000000000509',
    '20000000-0000-0000-0000-000000000405',
    '20000000-0000-0000-0000-000000000208',
    'parser-v8',
    'SUCCEEDED',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:05:00+00',
    '{"name":"removed"}',
    repeat('b', 64),
    null
  ),
  (
    '20000000-0000-0000-0000-000000000510',
    '20000000-0000-0000-0000-000000000401',
    '20000000-0000-0000-0000-000000000208',
    'parser-v8',
    'SUCCEEDED',
    '2026-08-13 10:00:00+00',
    '2026-08-13 10:05:00+00',
    null,
    repeat('c', 64),
    '2026-08-13 10:06:00+00'
  );
set local session_replication_role = origin;

update app.ingestion_runs
set status = 'SUCCEEDED',
    refresh_unit_complete = true,
    snapshot_complete = true,
    finished_at = '2026-08-13 10:10:00+00'
where id = '20000000-0000-0000-0000-000000000207';

set constraints all immediate;

create temporary table db02_canonical_snapshot as
select jsonb_build_object(
  'canonical_entities', (select count(*) from app.canonical_entities),
  'places', (select count(*) from app.places),
  'events', (select count(*) from app.events),
  'provenance', (select count(*) from app.canonical_fact_provenance),
  'memberships', (select count(*) from app.entity_taxonomy_memberships),
  'search_documents', (select count(*) from app.search_documents),
  'embeddings', (select count(*) from app.embeddings)
) as snapshot;

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      null,
      '20000000-0000-0000-0000-000000000201',
      'parser-v1',
      null,
      null
    )
  $$,
  '22023',
  'selected source evidence execution must be fully specified',
  'proposed source-current evidence must be a complete H+A pair'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501',
      '20000000-0000-0000-0000-000000000201',
      'parser-v1',
      '20000000-0000-0000-0000-000000000401',
      null
    )
  $$,
  '22023',
  'expected source-current evidence must be a complete pair',
  'CAS expected prior evidence must be a complete H+A pair'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000399',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501',
      '20000000-0000-0000-0000-000000000201',
      'parser-v1',
      null,
      null
    )
  $$,
  'P0002',
  'source record does not exist',
  'selection requires an existing SourceRecord'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000404',
      '20000000-0000-0000-0000-000000000507',
      '20000000-0000-0000-0000-000000000206',
      'parser-v6',
      null,
      null
    )
  $$,
  '23514',
  'selected source record version is not owned and available',
  'selected version must belong to the SourceRecord'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000507',
      '20000000-0000-0000-0000-000000000206',
      'parser-v6',
      null,
      null
    )
  $$,
  '23514',
  'selected parse attempt is not a valid successful output for the version',
  'selected attempt must belong to the selected version'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000503',
      '20000000-0000-0000-0000-000000000203',
      'parser-v3',
      null,
      null
    )
  $$,
  '23514',
  'selected parse attempt is not a valid successful output for the version',
  'FAILED attempt cannot become source-current evidence'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000405',
      '20000000-0000-0000-0000-000000000509',
      '20000000-0000-0000-0000-000000000208',
      'parser-v8',
      null,
      null
    )
  $$,
  '23514',
  'selected source record version is not owned and available',
  'REDACTED source evidence cannot become newly selected current evidence'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501',
      '20000000-0000-0000-0000-000000000202',
      'parser-v1',
      null,
      null
    )
  $$,
  '23514',
  'selected parse attempt does not match the intended execution',
  'successful attempt cannot be selected under a different run identity'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000510',
      '20000000-0000-0000-0000-000000000208',
      'parser-v8',
      null,
      null
    )
  $$,
  '23514',
  'selected parse attempt is not a valid successful output for the version',
  'redacted parser output cannot pass the selection output contract'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501',
      '20000000-0000-0000-0000-000000000201',
      'parser-v2',
      null,
      null
    )
  $$,
  '23514',
  'selected parse attempt does not match the intended execution',
  'successful attempt cannot be selected under a different parser identity'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000508',
      '20000000-0000-0000-0000-000000000207',
      'parser-v7',
      null,
      null
    )
  $$,
  '23514',
  'selected ingestion and parser execution is not active',
  'historical SUCCEEDED attempt from a terminal run cannot be selected'
);

update app.sources
set enabled = false
where id = '20000000-0000-0000-0000-000000000101';

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501',
      '20000000-0000-0000-0000-000000000201',
      'parser-v1',
      null,
      null
    )
  $$,
  '23514',
  'source is not enabled for current-evidence selection',
  'disabled source cannot advance current evidence'
);

update app.sources
set enabled = true
where id = '20000000-0000-0000-0000-000000000101';

select ok(
  (
    select current_version_id is null and current_parse_attempt_id is null
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  'failed validations roll back without changing the current pair'
);

set local role lemon_ingestion;
select app.select_source_record_current_evidence(
  '20000000-0000-0000-0000-000000000301',
  '20000000-0000-0000-0000-000000000401',
  '20000000-0000-0000-0000-000000000501',
  '20000000-0000-0000-0000-000000000201',
  'parser-v1',
  null,
  null
);
reset role;
select pass(
  'ingestion backend may transactionally select initial H+A evidence'
);

select is(
  (
    select current_version_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000401'::uuid,
  'initial selection stores the selected version'
);
select is(
  (
    select current_parse_attempt_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000501'::uuid,
  'initial selection stores the selected parse execution'
);
select is(
  (
    select canonical_entity_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  null::uuid,
  'source-current evidence may exist while canonical identity is unresolved'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502',
      '20000000-0000-0000-0000-000000000202',
      'parser-v2',
      null,
      null
    )
  $$,
  '40001',
  'stale source-current evidence selection',
  'stale expected prior pair cannot overwrite current evidence'
);

select is(
  (
    select current_parse_attempt_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000501'::uuid,
  'stale CAS failure leaves the selected attempt unchanged'
);

select lives_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502',
      '20000000-0000-0000-0000-000000000202',
      'parser-v2',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501'
    )
  $$,
  'same-H parser replay advances through exact expected-prior CAS'
);

select is(
  (
    select current_version_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000401'::uuid,
  'same-H replay keeps the immutable content identity selected'
);
select is(
  (
    select current_parse_attempt_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000502'::uuid,
  'same-H replay selects the distinct corrected parser execution'
);
select is(
  (
    select count(*)
    from app.source_record_versions
    where source_record_id = '20000000-0000-0000-0000-000000000301'
  ),
  4::bigint,
  'same-H parser replay creates no fake SourceRecordVersion'
);

select lives_ok(
  $$
    select app.assert_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  'stale processing guard accepts the exact current H+A2 execution'
);

select throws_ok(
  $$
    select app.assert_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000501'
    )
  $$,
  '40001',
  'stale source-current evidence processing',
  'same H with A1 is stale after A2 becomes current'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000503',
      '20000000-0000-0000-0000-000000000203',
      'parser-v3',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  '23514',
  'selected parse attempt is not a valid successful output for the version',
  'same-H failed newer parser execution cannot replace last-good A2'
);
select is(
  (
    select current_parse_attempt_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  '20000000-0000-0000-0000-000000000502'::uuid,
  'same-H failed parser preserves selected successful execution'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000402',
      '20000000-0000-0000-0000-000000000504',
      '20000000-0000-0000-0000-000000000203',
      'parser-v3',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  '23514',
  'selected parse attempt is not a valid successful output for the version',
  'failed newer H2 parser execution cannot replace last-good H1+A2'
);
select ok(
  (
    select current_version_id = '20000000-0000-0000-0000-000000000401'
      and current_parse_attempt_id = '20000000-0000-0000-0000-000000000502'
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  'failed newer H2 preserves the prior H1+A2 current pair'
);

select lives_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000402',
      '20000000-0000-0000-0000-000000000505',
      '20000000-0000-0000-0000-000000000204',
      'parser-v4',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  'first competing advancement wins with the correct expected prior pair'
);
select ok(
  (
    select current_version_id = '20000000-0000-0000-0000-000000000402'
      and current_parse_attempt_id = '20000000-0000-0000-0000-000000000505'
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  'winning CAS atomically stores H2+A4'
);

select throws_ok(
  $$
    select app.select_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000403',
      '20000000-0000-0000-0000-000000000506',
      '20000000-0000-0000-0000-000000000205',
      'parser-v5',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  '40001',
  'stale source-current evidence selection',
  'second competing advancement loses against the stale expected pair'
);
select ok(
  (
    select current_version_id = '20000000-0000-0000-0000-000000000402'
      and current_parse_attempt_id = '20000000-0000-0000-0000-000000000505'
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  'stale competing writer cannot overwrite the winning H2+A4 pair'
);

select throws_ok(
  $$
    select app.assert_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000401',
      '20000000-0000-0000-0000-000000000502'
    )
  $$,
  '40001',
  'stale source-current evidence processing',
  'changed version makes prior H1+A2 processing stale'
);
select lives_ok(
  $$
    select app.assert_source_record_current_evidence(
      '20000000-0000-0000-0000-000000000301',
      '20000000-0000-0000-0000-000000000402',
      '20000000-0000-0000-0000-000000000505'
    )
  $$,
  'processing guard accepts the exact winning H2+A4 pair'
);

set local role lemon_ingestion;
select throws_ok(
  $$
    update app.source_records
    set current_version_id = '20000000-0000-0000-0000-000000000403',
        current_parse_attempt_id = '20000000-0000-0000-0000-000000000506'
    where id = '20000000-0000-0000-0000-000000000301'
  $$,
  '42501',
  'source-current evidence must be changed through the selection transaction',
  'ordinary backend caller cannot bypass active-execution and CAS validation'
);
reset role;

select ok(
  (
    select current_version_id = '20000000-0000-0000-0000-000000000402'
      and current_parse_attempt_id = '20000000-0000-0000-0000-000000000505'
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  'rejected direct update leaves current evidence unchanged'
);

select is(
  jsonb_build_object(
    'canonical_entities', (select count(*) from app.canonical_entities),
    'places', (select count(*) from app.places),
    'events', (select count(*) from app.events),
    'provenance', (select count(*) from app.canonical_fact_provenance),
    'memberships', (select count(*) from app.entity_taxonomy_memberships),
    'search_documents', (select count(*) from app.search_documents),
    'embeddings', (select count(*) from app.embeddings)
  ),
  (select snapshot from db02_canonical_snapshot),
  'source-current advancement creates or mutates no canonical/search truth'
);
select is(
  (
    select canonical_entity_id
    from app.source_records
    where id = '20000000-0000-0000-0000-000000000301'
  ),
  null::uuid,
  'all source-current advancements preserve canonical_entity_id'
);
select ok(
  has_function_privilege(
    'lemon_ingestion',
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'lemon_ingestion',
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'only the ingestion backend receives DB-02 helper execution'
);
select ok(
  not has_function_privilege(
    'lemon_reviewer',
    'app.select_source_record_current_evidence(uuid,uuid,uuid,uuid,text,uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'lemon_reviewer',
    'app.assert_source_record_current_evidence(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'review role cannot invoke ingestion-only DB-02 helpers'
);

select * from finish();
rollback;
