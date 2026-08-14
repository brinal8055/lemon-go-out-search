begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(48);

grant lemon_compliance, lemon_ingestion, lemon_reviewer to postgres with set true;

insert into app.geographic_scopes (id, slug, name_en, name_sv, timezone, country_code)
values ('77000000-0000-0000-0000-000000000001', 'prov-test', 'Provenance test', 'Provenienstest', 'Europe/Stockholm', 'SE');
insert into app.geographic_scope_boundaries (
  id, scope_id, version, boundary, source_name, source_url, licence,
  attribution, source_checksum, effective_from, is_active
) values (
  '77000000-0000-0000-0000-000000000002',
  '77000000-0000-0000-0000-000000000001', 'prov-v1',
  extensions.st_multi(extensions.st_geomfromtext(
    'POLYGON((14 57,15 57,15 58,14 58,14 57))', 4326
  )), 'Fixture', 'https://example.invalid/boundary', 'TEST', 'TEST',
  repeat('7', 64), '2026-01-01T00:00:00Z', true
);
insert into app.sources (
  id, key, name, kind, licence, attribution, persistence_permission,
  refresh_mode, adapter_version, enabled
) values
('77000000-0000-0000-0000-000000000011', 'PROV_REVOKED', 'Revoked fixture', 'MANUAL', 'TEST', 'TEST', 'FULL_PAYLOAD', 'DELTA_ONLY', 'v1', true),
('77000000-0000-0000-0000-000000000012', 'PROV_ALLOWED', 'Allowed fixture', 'MANUAL', 'TEST', 'TEST', 'FULL_PAYLOAD', 'DELTA_ONLY', 'v1', true);
insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version
) values
('77000000-0000-0000-0000-000000000021', 'prov-run-revoked', '77000000-0000-0000-0000-000000000011', '77000000-0000-0000-0000-000000000001', 'v1', 'parser-v1', 'map-v1'),
('77000000-0000-0000-0000-000000000022', 'prov-run-allowed', '77000000-0000-0000-0000-000000000012', '77000000-0000-0000-0000-000000000001', 'v1', 'parser-v1', 'map-v1'),
('77000000-0000-0000-0000-000000000023', 'prov-run-replay', '77000000-0000-0000-0000-000000000011', '77000000-0000-0000-0000-000000000001', 'v1', 'parser-replay', 'map-v1');

insert into app.canonical_entities (
  id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
  publication_status, scope_id, scope_boundary_id, published_at
) values
('77000000-0000-0000-0000-000000000061', 'PLACE', 'Safe Alternative', 'safe alternative', 'safe alternative', 'PUBLISHED', '77000000-0000-0000-0000-000000000001', '77000000-0000-0000-0000-000000000002', now()),
('77000000-0000-0000-0000-000000000062', 'PLACE', 'Unsupported Required', 'unsupported required', 'unsupported required', 'DRAFT', null, null, null),
('77000000-0000-0000-0000-000000000063', 'PLACE', 'Stable Old', 'stable old', 'stable old', 'DRAFT', null, null, null),
('77000000-0000-0000-0000-000000000064', 'PLACE', 'Other Entity', 'other entity', 'other entity', 'DRAFT', null, null, null);
insert into app.places (entity_id, location, opening_hours) values
('77000000-0000-0000-0000-000000000061', extensions.st_setsrid(extensions.st_makepoint(14.16, 57.78), 4326)::extensions.geography, '{"raw":"PROHIBITED HOURS"}'),
('77000000-0000-0000-0000-000000000062', extensions.st_setsrid(extensions.st_makepoint(14.17, 57.79), 4326)::extensions.geography, null),
('77000000-0000-0000-0000-000000000063', null, null),
('77000000-0000-0000-0000-000000000064', null, null);

insert into app.source_records (
  id, source_id, external_key, canonical_entity_id, resolution_method,
  first_seen_at, last_seen_at
) values
('77000000-0000-0000-0000-000000000031', '77000000-0000-0000-0000-000000000011', 'main', '77000000-0000-0000-0000-000000000061', 'NEW_CANONICAL', now(), now()),
('77000000-0000-0000-0000-000000000032', '77000000-0000-0000-0000-000000000011', 'no-alternative', '77000000-0000-0000-0000-000000000062', 'NEW_CANONICAL', now(), now()),
('77000000-0000-0000-0000-000000000033', '77000000-0000-0000-0000-000000000012', 'alternative', '77000000-0000-0000-0000-000000000061', 'MANUAL_MAPPING', now(), now()),
('77000000-0000-0000-0000-000000000034', '77000000-0000-0000-0000-000000000012', 'independent', '77000000-0000-0000-0000-000000000063', 'NEW_CANONICAL', now(), now()),
('77000000-0000-0000-0000-000000000035', '77000000-0000-0000-0000-000000000012', 'other', '77000000-0000-0000-0000-000000000064', 'NEW_CANONICAL', now(), now());

create function pg_temp.add_evidence(
  p_version_id uuid,
  p_attempt_id uuid,
  p_record_id uuid,
  p_run_id uuid,
  p_observed_at timestamptz,
  p_output jsonb
) returns void language plpgsql as $$
declare content_hash char(64) := encode(extensions.digest(convert_to(p_version_id::text, 'UTF8'), 'sha256'), 'hex');
begin
  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload, payload_storage_mode,
    source_url, http_etag, http_last_modified, fetched_at, observed_at
  ) values (
    p_version_id, p_record_id, p_run_id, content_hash,
    jsonb_build_object('secret', 'PROHIBITED PAYLOAD', 'version', p_version_id),
    'FULL_PAYLOAD', 'https://example.invalid/prohibited', 'PROHIBITED-ETAG',
    'PROHIBITED-LAST-MODIFIED', p_observed_at, p_observed_at
  );
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (p_attempt_id, p_version_id, p_run_id, 'parser-v1');
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = now(), normalized_output = p_output,
      normalized_output_hash = encode(extensions.digest(convert_to(p_output::text, 'UTF8'), 'sha256'), 'hex')
  where id = p_attempt_id;
end;
$$;

select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000041', '77000000-0000-0000-0000-000000000051',
  '77000000-0000-0000-0000-000000000031', '77000000-0000-0000-0000-000000000021', '2026-01-01T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Fallback Same Source"}],"place":{"latitude":57.78,"longitude":14.16}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000052',
  '77000000-0000-0000-0000-000000000031', '77000000-0000-0000-0000-000000000021', '2026-02-01T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"PROHIBITED CANONICAL"}],"place":{"latitude":57.78,"longitude":14.16,"openingHours":{"raw":"PROHIBITED HOURS"}}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000043', '77000000-0000-0000-0000-000000000053',
  '77000000-0000-0000-0000-000000000032', '77000000-0000-0000-0000-000000000021', '2026-02-02T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Unsupported Required"}],"place":{"latitude":57.79,"longitude":14.17}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000044', '77000000-0000-0000-0000-000000000054',
  '77000000-0000-0000-0000-000000000033', '77000000-0000-0000-0000-000000000022', '2026-01-15T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Safe Alternative"}],"place":{"latitude":57.78,"longitude":14.16}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000045', '77000000-0000-0000-0000-000000000055',
  '77000000-0000-0000-0000-000000000035', '77000000-0000-0000-0000-000000000022', '2026-01-16T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Other Entity"}],"place":{"latitude":57.75,"longitude":14.12}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000046', '77000000-0000-0000-0000-000000000056',
  '77000000-0000-0000-0000-000000000034', '77000000-0000-0000-0000-000000000022', '2026-01-01T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Stable Old"}],"place":{}}'
);
select pg_temp.add_evidence(
  '77000000-0000-0000-0000-000000000047', '77000000-0000-0000-0000-000000000057',
  '77000000-0000-0000-0000-000000000034', '77000000-0000-0000-0000-000000000022', '2026-02-01T00:00:00Z',
  '{"entityType":"PLACE","names":[{"value":"Stable New"}],"place":{}}'
);

update app.source_records set current_version_id = '77000000-0000-0000-0000-000000000042', current_parse_attempt_id = '77000000-0000-0000-0000-000000000052' where id = '77000000-0000-0000-0000-000000000031';
update app.source_records set current_version_id = '77000000-0000-0000-0000-000000000043', current_parse_attempt_id = '77000000-0000-0000-0000-000000000053' where id = '77000000-0000-0000-0000-000000000032';
update app.source_records set current_version_id = '77000000-0000-0000-0000-000000000044', current_parse_attempt_id = '77000000-0000-0000-0000-000000000054' where id = '77000000-0000-0000-0000-000000000033';
update app.source_records set current_version_id = '77000000-0000-0000-0000-000000000047', current_parse_attempt_id = '77000000-0000-0000-0000-000000000057' where id = '77000000-0000-0000-0000-000000000034';
update app.source_records set current_version_id = '77000000-0000-0000-0000-000000000045', current_parse_attempt_id = '77000000-0000-0000-0000-000000000055' where id = '77000000-0000-0000-0000-000000000035';

insert into app.canonical_fact_provenance (
  entity_id, fact_key, source_record_version_id, selection_method, created_by
) values
('77000000-0000-0000-0000-000000000061', 'canonical_name', '77000000-0000-0000-0000-000000000044', 'MANUAL', 'fixture-reviewer'),
('77000000-0000-0000-0000-000000000061', 'location', '77000000-0000-0000-0000-000000000044', 'MANUAL', 'fixture-reviewer'),
('77000000-0000-0000-0000-000000000061', 'opening_hours', '77000000-0000-0000-0000-000000000042', 'SOURCE_PRECEDENCE', 'fixture-ingestion'),
('77000000-0000-0000-0000-000000000062', 'canonical_name', '77000000-0000-0000-0000-000000000043', 'SOURCE_PRECEDENCE', 'fixture-ingestion'),
('77000000-0000-0000-0000-000000000063', 'canonical_name', '77000000-0000-0000-0000-000000000046', 'SOURCE_PRECEDENCE', 'fixture-ingestion');

select app.replace_targeted_canonical_fact(
  '77000000-0000-0000-0000-000000000061', 'canonical_name',
  '"PROHIBITED CANONICAL"'::jsonb, '77000000-0000-0000-0000-000000000042',
  'SOURCE_PRECEDENCE', 'fixture-ingestion', 'replacement fixture'
);

create temp table fixture_state (key text primary key, value jsonb not null);

insert into app.entity_taxonomy_memberships (
  entity_id, taxonomy_node_id, method, source_record_version_id, active
) select '77000000-0000-0000-0000-000000000061', node.id, 'SOURCE_FACT', '77000000-0000-0000-0000-000000000044', false
from app.taxonomy_nodes as node where node.active and node.is_leaf order by node.id limit 1;
insert into app.entity_taxonomy_memberships (
  entity_id, taxonomy_node_id, method, source_record_version_id, active
) select '77000000-0000-0000-0000-000000000061', node.id, 'SOURCE_FACT', '77000000-0000-0000-0000-000000000042', true
from app.taxonomy_nodes as node where node.active and node.is_leaf order by node.id limit 1;
insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind,
  source_record_version_id, verified, active
) values (
  '77000000-0000-0000-0000-000000000061', 'PROHIBITED ALIAS', 'prohibited alias',
  'prohibited alias', 'und', 'OFFICIAL', '77000000-0000-0000-0000-000000000042', false, true
);

insert into app.search_documents (
  id, entity_id, document_version, template_version, content_hash,
  display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
  facts_text, description_text, event_context_text, embedding_text,
  fts, generated_at, is_active
) values (
  '77000000-0000-0000-0000-000000000071', '77000000-0000-0000-0000-000000000061',
  'fixture-v1', 'fixture-template-v1', repeat('a', 64), 'PROHIBITED CANONICAL',
  'PROHIBITED CANONICAL', 'PROHIBITED ALIAS', 'Dining', 'Mat',
  'PROHIBITED HOURS', 'PROHIBITED DESCRIPTION', '', 'PROHIBITED EMBEDDING',
  to_tsvector('simple', 'PROHIBITED'), now(), true
);
insert into app.embeddings (
  search_document_id, entity_id, provider, model, model_revision, dimension,
  embedding, document_hash, status, attempt_key, attempted_at, generated_at
) select
  '77000000-0000-0000-0000-000000000071', '77000000-0000-0000-0000-000000000061',
  config.embedding_provider, config.embedding_model, config.embedding_revision,
  config.embedding_dimension,
  array_fill(1::real, array[config.embedding_dimension])::extensions.vector,
  repeat('a', 64), 'READY', 'prov-fixture-embedding', now(), now()
from app.search_configs as config where config.is_active;

insert into fixture_state values (
  'candidate', to_jsonb(app.create_duplicate_candidate(
    '77000000-0000-0000-0000-000000000031',
    '77000000-0000-0000-0000-000000000035', 'prov-fixture'
  ))
);
insert into fixture_state
select 'initial-decision', to_jsonb(candidate.current_decision_id)
from app.duplicate_candidates as candidate
where candidate.id = ((select value #>> '{}' from fixture_state where key = 'candidate')::uuid);
insert into fixture_state values (
  'final-decision', to_jsonb(app.finalize_duplicate_candidate(
    (select (value #>> '{}')::uuid from fixture_state where key = 'candidate'),
    (select (value #>> '{}')::uuid from fixture_state where key = 'initial-decision'),
    'SEPARATE', 'prov-reviewer', null, null, null, 'PROHIBITED REVIEW NOTE'
  ))
);
insert into fixture_state
select 'candidate-evidence-hash', to_jsonb(btrim(candidate.evidence_hash))
from app.duplicate_candidates as candidate
where candidate.id = ((select value #>> '{}' from fixture_state where key = 'candidate')::uuid);
insert into fixture_state
select 'report', app.source_revocation_impact('77000000-0000-0000-0000-000000000011', 100);

select ok(to_regprocedure('app.redact_source_record_version(uuid,uuid,text)') is not null,
  'exact compliance redaction function exists');
select is(
  (select array_agg(enumlabel order by enumsortorder)::text from pg_enum where enumtypid = 'app.fact_key'::regtype),
  '{canonical_name,location,address,opening_hours,event_start,event_end,event_status}',
  'targeted fact vocabulary is closed and exact'
);
select is((select count(*) from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000061' and fact_key = 'canonical_name'), 2::bigint,
  'fact replacement preserves history');
select is((select count(*) from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000061' and fact_key = 'canonical_name' and is_current), 1::bigint,
  'fact replacement retains exactly one current selection');
select is((select source_record_version_id from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000061' and fact_key = 'canonical_name' and is_current), '77000000-0000-0000-0000-000000000042'::uuid,
  'current fact pins exact selected version evidence');
select is((select canonical_name from app.canonical_entities where id = '77000000-0000-0000-0000-000000000061'), 'PROHIBITED CANONICAL',
  'fact and provenance replacement is atomic');
select is((select source_record_version_id from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000063' and fact_key = 'canonical_name' and is_current), '77000000-0000-0000-0000-000000000046'::uuid,
  'advancing source-current evidence does not alter canonical provenance');
select cmp_ok(((select value from fixture_state where key = 'report') #>> '{counts,currentFacts}')::integer, '>=', 3,
  'revocation report finds current critical provenance');
select is(((select value from fixture_state where key = 'report') #>> '{counts,activeMemberships}')::integer, 1,
  'revocation report finds active taxonomy evidence');
select ok(
  ((select value from fixture_state where key = 'report') #>> '{counts,documents}')::integer >= 1
  and ((select value from fixture_state where key = 'report') #>> '{counts,embeddings}')::integer = 1
  and ((select value from fixture_state where key = 'report') #>> '{counts,duplicateCandidates}')::integer = 1,
  'revocation report finds affected projections and duplicate review evidence'
);
select is((select content_status::text from app.source_record_versions where id = '77000000-0000-0000-0000-000000000042'), 'AVAILABLE',
  'revocation reporting is read-only');
select throws_ok(
  $$update app.source_record_versions set source_url = 'https://example.invalid/mutation' where id = '77000000-0000-0000-0000-000000000042'$$,
  '55000', 'source record versions are immutable outside compliance redaction',
  'ordinary SourceRecordVersion update remains denied'
);
select ok(
  (select proowner::regrole::text = 'lemon_compliance_owner' from pg_proc where oid = 'app.redact_source_record_version(uuid,uuid,text)'::regprocedure)
  and not (select rolcanlogin from pg_roles where rolname = 'lemon_compliance_owner'),
  'redaction function is owned by the non-login compliance owner'
);
select ok(
  has_function_privilege('lemon_compliance', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('lemon_ingestion', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('lemon_reviewer', 'app.redact_source_record_version(uuid,uuid,text)', 'EXECUTE'),
  'only the compliance runtime role can execute redaction'
);
select ok(not has_table_privilege('lemon_compliance', 'app.source_record_versions', 'UPDATE'),
  'compliance runtime role has no direct SourceRecordVersion update');

select lives_ok(
  $$select app.redact_source_record_version('77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000091', 'LICENCE_REVOKED')$$,
  'AVAILABLE version redacts through the privileged operation'
);
select ok(
  (select content_status = 'REDACTED' and redaction_reason = 'LICENCE_REVOKED' and redaction_operation_id = '77000000-0000-0000-0000-000000000091'
   from app.source_record_versions where id = '77000000-0000-0000-0000-000000000042'),
  'redaction records the exact transition reason and operation'
);
select ok(
  (select payload is null and source_url is null and http_etag is null and http_last_modified is null
   from app.source_record_versions where id = '77000000-0000-0000-0000-000000000042'),
  'payload and prohibited fetch metadata are removed'
);
select is((select content_hash from app.source_record_versions where id = '77000000-0000-0000-0000-000000000042'), encode(extensions.digest(convert_to('77000000-0000-0000-0000-000000000042', 'UTF8'), 'sha256'), 'hex')::char(64),
  'immutable capture identity and original content hash are preserved');
select ok(
  (select normalized_output is null and output_redacted_at is not null from app.source_record_parse_attempts where id = '77000000-0000-0000-0000-000000000052'),
  'normalized ParseAttempt output is redacted'
);
select ok(
  (select status = 'SUCCEEDED' and normalized_output_hash is not null from app.source_record_parse_attempts where id = '77000000-0000-0000-0000-000000000052'),
  'ParseAttempt identity, status, and output hash remain intact'
);
select throws_ok(
  $$insert into app.source_record_parse_attempts (source_record_version_id, ingestion_run_id, parser_version) values ('77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000023', 'parser-replay')$$,
  '23514', 'redacted source content cannot be parsed',
  'redacted evidence cannot be parser-replayed'
);
select ok(
  (select current_version_id = '77000000-0000-0000-0000-000000000041' and current_parse_attempt_id = '77000000-0000-0000-0000-000000000051'
   from app.source_records where id = '77000000-0000-0000-0000-000000000031'),
  'selected current H+A reselects the latest permitted pair atomically'
);
select is((select source_record_version_id from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000061' and fact_key = 'canonical_name' and is_current), '77000000-0000-0000-0000-000000000044'::uuid,
  'canonical fact reselects an already-approved permitted alternative');
select is((select canonical_name from app.canonical_entities where id = '77000000-0000-0000-0000-000000000061'), 'Safe Alternative',
  'canonical truth is repaired from permitted evidence');
select ok(
  (select opening_hours is null from app.places where entity_id = '77000000-0000-0000-0000-000000000061')
  and not exists (select 1 from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000061' and fact_key = 'opening_hours' and is_current),
  'unsupported optional fact is removed with no false current provenance'
);
select is((select publication_status::text from app.canonical_entities where id = '77000000-0000-0000-0000-000000000061'), 'PUBLISHED',
  'permitted critical alternatives preserve publication eligibility');
select ok(
  not exists (select 1 from app.entity_taxonomy_memberships where source_record_version_id = '77000000-0000-0000-0000-000000000042' and active)
  and exists (select 1 from app.entity_taxonomy_memberships where source_record_version_id = '77000000-0000-0000-0000-000000000044' and active),
  'revoked membership is replaced only by existing permitted evidence'
);
select ok(not exists (select 1 from app.entity_aliases where source_record_version_id = '77000000-0000-0000-0000-000000000042' and active),
  'source-derived prohibited alias is deactivated');
select ok(not exists (
  select 1 from app.search_documents as document where document.entity_id = '77000000-0000-0000-0000-000000000061'
    and to_jsonb(document)::text like '%PROHIBITED%'
), 'affected SearchDocument content is sanitized');
select is((select count(*) from app.search_documents where entity_id = '77000000-0000-0000-0000-000000000061' and is_active), 1::bigint,
  'a sanitized SearchDocument is rebuilt from current permitted facts');
select is((select count(*) from app.embeddings where entity_id = '77000000-0000-0000-0000-000000000061'), 0::bigint,
  'prohibited derived embedding content is purged from searchability');
select ok(
  (select evidence_summary ->> 'sanitized' = 'true' from app.duplicate_candidates where id = ((select value #>> '{}' from fixture_state where key = 'candidate')::uuid)),
  'bounded duplicate evidence summary is sanitized'
);
select ok(
  (select count(*) = 2 from app.duplicate_candidate_decisions where duplicate_candidate_id = ((select value #>> '{}' from fixture_state where key = 'candidate')::uuid))
  and (select note = '[REDACTED]' from app.duplicate_candidate_decisions where id = ((select value #>> '{}' from fixture_state where key = 'final-decision')::uuid))
  and (select btrim(evidence_hash) = (select value #>> '{}' from fixture_state where key = 'candidate-evidence-hash') from app.duplicate_candidates where id = ((select value #>> '{}' from fixture_state where key = 'candidate')::uuid)),
  'duplicate decision identity, pinned evidence, and full history survive note cleanup'
);
select is((select actor from app.compliance_redaction_audit where source_record_version_id = '77000000-0000-0000-0000-000000000042'), session_user::text,
  'redacted_by audit actor is session_user');
select isnt((select redacted_by from app.source_record_versions where id = '77000000-0000-0000-0000-000000000042'), 'lemon_compliance_owner',
  'redacted_by is not SECURITY DEFINER current_user');
select ok(not exists (
  select 1 from app.compliance_redaction_audit as audit
  where source_record_version_id = '77000000-0000-0000-0000-000000000042'
    and to_jsonb(audit)::text like '%PROHIBITED%'
), 'audit log contains safe metadata only');

insert into fixture_state
select 'document-count-after-redaction', to_jsonb(count(*))
from app.search_documents where entity_id = '77000000-0000-0000-0000-000000000061';
select lives_ok(
  $$select app.redact_source_record_version('77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000091', 'LICENCE_REVOKED')$$,
  'same operation_id redaction retry succeeds idempotently'
);
select is((select count(*) from app.compliance_redaction_audit where source_record_version_id = '77000000-0000-0000-0000-000000000042'), 1::bigint,
  'redaction retry does not duplicate audit state');
select is(
  (select count(*) from app.search_documents where entity_id = '77000000-0000-0000-0000-000000000061'),
  ((select value #>> '{}' from fixture_state where key = 'document-count-after-redaction')::bigint),
  'full operation retry does not repeat derived repair'
);
select throws_ok(
  $$select app.redact_source_record_version('77000000-0000-0000-0000-000000000042', '77000000-0000-0000-0000-000000000092', 'LICENCE_REVOKED')$$,
  '40001', 'source record version was redacted by a different operation',
  'different operation_id conflicts with an already-redacted version'
);

select lives_ok(
  $$select app.redact_source_record_version('77000000-0000-0000-0000-000000000043', '77000000-0000-0000-0000-000000000093', 'PERSISTENCE_REVOKED')$$,
  'redaction succeeds when no replacement evidence exists'
);
select ok(
  (select current_version_id is null and current_parse_attempt_id is null from app.source_records where id = '77000000-0000-0000-0000-000000000032'),
  'no permitted current H+A alternative clears both columns atomically'
);
select is((select publication_status::text from app.canonical_entities where id = '77000000-0000-0000-0000-000000000062'), 'WITHHELD',
  'unsupported required publication fact causes WITHHELD');
select ok(not exists (
  select 1 from app.canonical_fact_provenance
  where entity_id = '77000000-0000-0000-0000-000000000062' and fact_key = 'canonical_name' and is_current
), 'unsupported required fact has no false current provenance');
select is((select count(*) from app.canonical_fact_provenance where entity_id = '77000000-0000-0000-0000-000000000062' and fact_key = 'canonical_name'), 1::bigint,
  'revocation does not fabricate replacement evidence');
select is((select redacted_by from app.source_record_versions where id = '77000000-0000-0000-0000-000000000043'), session_user::text,
  'every compliance transition records the authenticated invoker');
select ok(
  (select safe_counts ? 'factsReselected' and safe_counts ? 'embeddingsPurged' from app.compliance_redaction_audit where source_record_version_id = '77000000-0000-0000-0000-000000000042'),
  'completion audit retains bounded cleanup counts without removed content'
);

select * from finish();
rollback;
