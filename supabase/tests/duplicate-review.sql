begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(42);

grant lemon_ingestion, lemon_reviewer to postgres with set true;

select ok(to_regprocedure('app.create_duplicate_candidate(uuid,uuid,text)') is not null,
  'bounded candidate creation operation exists');
select ok(to_regprocedure('app.finalize_duplicate_candidate(uuid,uuid,app.duplicate_decision,text,uuid,uuid,uuid,text)') is not null,
  'manual finalization operation exists');
select ok(to_regprocedure('app.reverse_duplicate_same(uuid,uuid,text,text)') is not null,
  'manual reversal operation exists');
select ok(
  not has_function_privilege('anon', 'app.finalize_duplicate_candidate(uuid,uuid,app.duplicate_decision,text,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app.finalize_duplicate_candidate(uuid,uuid,app.duplicate_decision,text,uuid,uuid,uuid,text)', 'EXECUTE')
  and not has_function_privilege('service_role', 'app.finalize_duplicate_candidate(uuid,uuid,app.duplicate_decision,text,uuid,uuid,uuid,text)', 'EXECUTE'),
  'review mutation is unavailable to public API roles'
);

insert into app.geographic_scopes (id, slug, name_en, name_sv, timezone, country_code)
values ('dd000000-0000-0000-0000-000000000001', 'dedup-test', 'Dedup test', 'Dedup test', 'Europe/Stockholm', 'SE');
insert into app.sources (
  id, key, name, kind, licence, attribution, persistence_permission,
  refresh_mode, adapter_version, enabled
) values
('dd000000-0000-0000-0000-000000000101', 'DEDUP_TEST_A', 'Dedup A', 'MANUAL', 'TEST', 'TEST', 'FULL_PAYLOAD', 'DELTA_ONLY', 'v1', true),
('dd000000-0000-0000-0000-000000000102', 'DEDUP_TEST_B', 'Dedup B', 'MANUAL', 'TEST', 'TEST', 'FULL_PAYLOAD', 'DELTA_ONLY', 'v1', true);
insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version
) values
('dd000000-0000-0000-0000-000000000201', 'dedup-run-a', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000001', 'v1', 'parser-v1', 'map-v1'),
('dd000000-0000-0000-0000-000000000202', 'dedup-run-b', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000001', 'v1', 'parser-v1', 'map-v1');

create temp table fixture_records (
  fixture_key text primary key,
  record_id uuid not null,
  version_id uuid not null,
  attempt_id uuid not null,
  entity_id uuid null
);
create temp table fixture_candidates (fixture_key text primary key, candidate_id uuid not null);
create temp table fixture_decisions (fixture_key text primary key, decision_id uuid not null);

create function pg_temp.add_entity(p_name text)
returns uuid language plpgsql as $$
declare result_id uuid := gen_random_uuid();
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii
  ) values (result_id, 'PLACE', p_name, app.norm_v1_preserving(p_name), app.norm_v1_accentless(p_name));
  insert into app.places (entity_id) values (result_id);
  return result_id;
end;
$$;

create function pg_temp.add_record(
  p_fixture_key text,
  p_source_id uuid,
  p_run_id uuid,
  p_name text,
  p_entity_id uuid default null
)
returns uuid language plpgsql as $$
declare
  result_id uuid := gen_random_uuid();
  new_version_id uuid := gen_random_uuid();
  new_attempt_id uuid := gen_random_uuid();
  hash_value char(64) := encode(extensions.digest(convert_to(p_fixture_key, 'UTF8'), 'sha256'), 'hex');
  parser text;
begin
  select parser_version into parser from app.ingestion_runs where id = p_run_id;
  insert into app.source_records (
    id, source_id, external_key, canonical_entity_id, resolution_method,
    first_seen_at, last_seen_at
  ) values (
    result_id, p_source_id, p_fixture_key, p_entity_id,
    case when p_entity_id is null then 'UNRESOLVED'::app.source_resolution_method else 'NEW_CANONICAL'::app.source_resolution_method end,
    now(), now()
  );
  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload,
    payload_storage_mode, fetched_at, observed_at
  ) values (new_version_id, result_id, p_run_id, hash_value, jsonb_build_object('fixture', p_fixture_key), 'FULL_PAYLOAD', now(), now());
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (new_attempt_id, new_version_id, p_run_id, parser);
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = now(),
      normalized_output = jsonb_build_object(
        'entityType', 'PLACE',
        'names', jsonb_build_array(jsonb_build_object('value', p_name, 'language', 'und', 'kind', 'OFFICIAL')),
        'place', jsonb_build_object(
          'latitude', 57.7826, 'longitude', 14.1618,
          'locality', 'Jönköping', 'phone', '+46-' || substr(hash_value, 1, 8)
        )
      ),
      normalized_output_hash = hash_value
  where id = new_attempt_id;
  update app.source_records
  set current_version_id = new_version_id, current_parse_attempt_id = new_attempt_id
  where id = result_id;
  insert into fixture_records values (p_fixture_key, result_id, new_version_id, new_attempt_id, p_entity_id);
  return result_id;
end;
$$;

create function pg_temp.advance_version(p_fixture_key text, p_suffix text)
returns uuid language plpgsql as $$
declare
  fixture fixture_records%rowtype;
  run_id uuid;
  new_version_id uuid := gen_random_uuid();
  new_attempt_id uuid := gen_random_uuid();
  hash_value char(64) := encode(extensions.digest(convert_to(p_fixture_key || p_suffix, 'UTF8'), 'sha256'), 'hex');
begin
  select * into fixture from fixture_records where fixture_key = p_fixture_key;
  select case when source_id = 'dd000000-0000-0000-0000-000000000101' then 'dd000000-0000-0000-0000-000000000201'::uuid
    else 'dd000000-0000-0000-0000-000000000202'::uuid end into run_id
  from app.source_records where id = fixture.record_id;
  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload,
    payload_storage_mode, fetched_at, observed_at
  ) values (new_version_id, fixture.record_id, run_id, hash_value, jsonb_build_object('fixture', p_fixture_key, 'revision', p_suffix), 'FULL_PAYLOAD', now(), now());
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (new_attempt_id, new_version_id, run_id, 'parser-v1');
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = now(),
      normalized_output = jsonb_build_object(
        'entityType', 'PLACE',
        'names', jsonb_build_array(jsonb_build_object('value', p_fixture_key || p_suffix)),
        'place', jsonb_build_object('latitude', 57.7826, 'longitude', 14.1618)),
      normalized_output_hash = hash_value
  where id = new_attempt_id;
  update app.source_records set current_version_id = new_version_id, current_parse_attempt_id = new_attempt_id
  where id = fixture.record_id;
  update fixture_records set version_id = new_version_id, attempt_id = new_attempt_id
  where fixture_key = p_fixture_key;
  return new_attempt_id;
end;
$$;

create function pg_temp.advance_attempt_same_version(p_fixture_key text, p_suffix text)
returns uuid language plpgsql as $$
declare
  fixture fixture_records%rowtype;
  source_id uuid;
  run_id uuid := gen_random_uuid();
  new_attempt_id uuid := gen_random_uuid();
  hash_value char(64) := encode(extensions.digest(convert_to(p_fixture_key || p_suffix, 'UTF8'), 'sha256'), 'hex');
begin
  select * into fixture from fixture_records where fixture_key = p_fixture_key;
  select item.source_id into source_id from app.source_records as item where item.id = fixture.record_id;
  insert into app.ingestion_runs (
    id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version
  ) values (run_id, 'dedup-attempt-' || p_fixture_key || p_suffix, source_id,
    'dd000000-0000-0000-0000-000000000001', 'v1', 'parser-' || p_suffix, 'map-v1');
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (new_attempt_id, fixture.version_id, run_id, 'parser-' || p_suffix);
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = now(),
      normalized_output = jsonb_build_object(
        'entityType', 'PLACE',
        'names', jsonb_build_array(jsonb_build_object('value', p_fixture_key || p_suffix)),
        'place', jsonb_build_object('latitude', 57.7826, 'longitude', 14.1618)),
      normalized_output_hash = hash_value
  where id = new_attempt_id;
  update app.source_records set current_parse_attempt_id = new_attempt_id where id = fixture.record_id;
  update fixture_records set attempt_id = new_attempt_id where fixture_key = p_fixture_key;
  return new_attempt_id;
end;
$$;

create function pg_temp.bad_position(p_candidate_id uuid)
returns void language plpgsql as $$
declare
  current_row app.duplicate_candidate_decisions%rowtype;
  invalid_decision_id uuid := gen_random_uuid();
begin
  select decision.* into current_row
  from app.duplicate_candidates as candidate
  join app.duplicate_candidate_decisions as decision on decision.id = candidate.current_decision_id
  where candidate.id = p_candidate_id;
  insert into app.duplicate_candidate_decisions (
    id, duplicate_candidate_id, decision, operation_type, reviewer,
    evidence_version_ids, evidence_parse_attempt_ids, evidence_hash, supersedes_decision_id
  ) values (
    invalid_decision_id, p_candidate_id, 'OPEN', 'OPEN_REVIEW', 'bad-position',
    array[current_row.evidence_version_ids[2], current_row.evidence_version_ids[1]],
    current_row.evidence_parse_attempt_ids, current_row.evidence_hash, current_row.id
  );
  update app.duplicate_candidates set current_decision_id = invalid_decision_id
  where id = p_candidate_id;
  set constraints all immediate;
end;
$$;

-- Candidate generation is bounded, pair-unique, atomic, and never resolves identity.
select pg_temp.add_record('generate-a', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000201', 'Shared factual name', pg_temp.add_entity('Generate A'));
select pg_temp.add_record('generate-b', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000202', 'Shared factual name', pg_temp.add_entity('Generate B'));
do $$ begin perform * from app.generate_duplicate_candidates(100); end $$;
insert into fixture_candidates
select 'generate', candidate.id
from app.duplicate_candidates as candidate
where candidate.record_a_id = least(
    (select record_id from fixture_records where fixture_key = 'generate-a'),
    (select record_id from fixture_records where fixture_key = 'generate-b')
  )
  and candidate.record_b_id = greatest(
    (select record_id from fixture_records where fixture_key = 'generate-a'),
    (select record_id from fixture_records where fixture_key = 'generate-b')
  );
select is((select record_a_id < record_b_id from app.duplicate_candidates where id = (select candidate_id from fixture_candidates where fixture_key = 'generate')), true,
  'candidate pair ordering is deterministic');
select is(app.create_duplicate_candidate(
  (select record_id from fixture_records where fixture_key = 'generate-b'),
  (select record_id from fixture_records where fixture_key = 'generate-a'), 'repeat'),
  (select candidate_id from fixture_candidates where fixture_key = 'generate'), 'pair creation is idempotently unique');
select is((select count(*)::integer from app.duplicate_candidate_decisions where duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'generate')), 1,
  'candidate and its initial OPEN decision are created atomically');
select is((select status::text from app.duplicate_candidates where id = (select candidate_id from fixture_candidates where fixture_key = 'generate')), 'OPEN',
  'generated candidate begins OPEN');
select is((select count(distinct canonical_entity_id)::integer from app.source_records where id in (
  (select record_id from fixture_records where fixture_key = 'generate-a'),
  (select record_id from fixture_records where fixture_key = 'generate-b'))), 2,
  'candidate similarity does not auto-link or merge');
select ok((select evidence_version_ids[1] = (select version_id from fixture_records where fixture_key = 'generate-a')
  or evidence_version_ids[1] = (select version_id from fixture_records where fixture_key = 'generate-b')
  from app.duplicate_candidate_decisions where id = (select current_decision_id from app.duplicate_candidates where id = (select candidate_id from fixture_candidates where fixture_key = 'generate'))),
  'ordered decision pins a version for record A');
select throws_ok(format('select pg_temp.bad_position(%L::uuid)', (select candidate_id from fixture_candidates where fixture_key = 'generate')),
  '23514', 'duplicate decision evidence must positionally match successful record evidence',
  'positional version and ParseAttempt ownership is enforced');

-- SAME Type A and reversal.
select pg_temp.add_record('type-a-unresolved', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000201', 'Type A place');
select pg_temp.add_record('type-a-target', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000202', 'Type A place', pg_temp.add_entity('Type A target'));
insert into fixture_candidates values ('type-a', app.create_duplicate_candidate(
  (select record_id from fixture_records where fixture_key = 'type-a-unresolved'),
  (select record_id from fixture_records where fixture_key = 'type-a-target'), 'test'));
insert into fixture_decisions
select 'type-a-same', app.finalize_duplicate_candidate(candidate.id, candidate.current_decision_id, 'SAME', 'reviewer-a',
  (select record_id from fixture_records where fixture_key = 'type-a-unresolved'),
  (select entity_id from fixture_records where fixture_key = 'type-a-target'), null, 'type a')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'type-a');
select is((select canonical_entity_id from app.source_records where id = (select record_id from fixture_records where fixture_key = 'type-a-unresolved')),
  (select entity_id from fixture_records where fixture_key = 'type-a-target'), 'Type A links unresolved record to existing entity');
select is((select resolution_method::text from app.source_records where id = (select record_id from fixture_records where fixture_key = 'type-a-unresolved')), 'MANUAL_MAPPING',
  'Type A uses MANUAL_MAPPING');
select is((select count(*)::integer from app.canonical_entities where publication_status = 'MERGED' and id = (select entity_id from fixture_records where fixture_key = 'type-a-target')), 0,
  'Type A creates no loser and no MERGED entity');
insert into fixture_decisions
select 'type-a-open', app.reverse_duplicate_same(candidate.id, candidate.current_decision_id, 'reviewer-a', 'reverse type a')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'type-a');
select is((select canonical_entity_id from app.source_records where id = (select record_id from fixture_records where fixture_key = 'type-a-unresolved')), null::uuid,
  'Type A inverse executes before replacement OPEN');
select ok((select resolution_detail @> jsonb_build_object('inverseExecuted', true)
  from app.duplicate_candidate_decisions where id = (select decision_id from fixture_decisions where fixture_key = 'type-a-open')),
  'reversal records inverse completion on the new OPEN');
select is((select count(*)::integer from app.duplicate_candidate_decisions where duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'type-a')), 3,
  'Type A review and reversal preserve complete history');

-- SAME Type B and reversal, including bounded repair state.
select pg_temp.add_record('type-b-a', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000201', 'Type B place', pg_temp.add_entity('Type B survivor'));
select pg_temp.add_record('type-b-b', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000202', 'Type B place', pg_temp.add_entity('Type B loser'));
insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind, source_record_version_id
) values (
  (select entity_id from fixture_records where fixture_key = 'type-b-b'), 'Loser alias', 'loser alias', 'loser alias', 'en', 'OFFICIAL',
  (select version_id from fixture_records where fixture_key = 'type-b-b')
);
insert into app.entity_taxonomy_memberships (
  entity_id, taxonomy_node_id, method, source_record_version_id, mapping_ref
)
select (select entity_id from fixture_records where fixture_key = 'type-b-b'),
       node.id, 'DETERMINISTIC_MAP',
       (select version_id from fixture_records where fixture_key = 'type-b-b'),
       'dedup-test-map-v1'
from app.taxonomy_nodes as node
where node.active and node.is_leaf
order by node.id
limit 1;
insert into fixture_candidates values ('type-b', app.create_duplicate_candidate(
  (select record_id from fixture_records where fixture_key = 'type-b-a'),
  (select record_id from fixture_records where fixture_key = 'type-b-b'), 'test'));
insert into fixture_decisions
select 'type-b-same', app.finalize_duplicate_candidate(candidate.id, candidate.current_decision_id, 'SAME', 'reviewer-b', null, null,
  (select entity_id from fixture_records where fixture_key = 'type-b-a'), 'type b')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'type-b');
select is((select publication_status::text from app.canonical_entities where id = (select entity_id from fixture_records where fixture_key = 'type-b-b')), 'MERGED',
  'Type B marks the explicit loser MERGED');
select is((select merged_into_id from app.canonical_entities where id = (select entity_id from fixture_records where fixture_key = 'type-b-b')),
  (select entity_id from fixture_records where fixture_key = 'type-b-a'), 'Type B points loser to explicit survivor');
select is((select canonical_entity_id from app.source_records where id = (select record_id from fixture_records where fixture_key = 'type-b-b')),
  (select entity_id from fixture_records where fixture_key = 'type-b-a'), 'Type B relinks loser records transactionally');
select is((select count(*)::integer from app.entity_aliases where entity_id = (select entity_id from fixture_records where fixture_key = 'type-b-a') and alias_norm = 'loser alias' and active), 1,
  'Type B safely copies active loser aliases');
select is((select count(*)::integer from app.entity_taxonomy_memberships where entity_id = (select entity_id from fixture_records where fixture_key = 'type-b-a') and active), 1,
  'Type B safely copies active loser taxonomy memberships');
insert into fixture_decisions
select 'type-b-open', app.reverse_duplicate_same(candidate.id, candidate.current_decision_id, 'reviewer-b', 'reverse type b')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'type-b');
select is((select publication_status::text from app.canonical_entities where id = (select entity_id from fixture_records where fixture_key = 'type-b-b')), 'DRAFT',
  'Type B reversal restores loser canonical state');
select is((select canonical_entity_id from app.source_records where id = (select record_id from fixture_records where fixture_key = 'type-b-b')),
  (select entity_id from fixture_records where fixture_key = 'type-b-b'), 'Type B reversal restores record resolution');
select is((select count(*)::integer from app.entity_aliases where entity_id = (select entity_id from fixture_records where fixture_key = 'type-b-b') and alias_norm = 'loser alias' and active), 1,
  'Type B reversal restores loser alias state');
select is((select count(*)::integer from app.entity_taxonomy_memberships where entity_id = (select entity_id from fixture_records where fixture_key = 'type-b-b') and active), 1,
  'Type B reversal restores loser taxonomy membership state');
select is((select count(*)::integer from app.duplicate_candidate_decisions where duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'type-b')), 3,
  'Type B reversal retains original SAME history');

-- SEPARATE and UNSURE are conservative final states.
select pg_temp.add_record('separate-a', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000201', 'Separate place', pg_temp.add_entity('Separate A'));
select pg_temp.add_record('separate-b', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000202', 'Separate place', pg_temp.add_entity('Separate B'));
insert into fixture_candidates values ('separate', app.create_duplicate_candidate(
  (select record_id from fixture_records where fixture_key = 'separate-a'),
  (select record_id from fixture_records where fixture_key = 'separate-b'), 'test'));
insert into fixture_decisions
select 'separate-final', app.finalize_duplicate_candidate(candidate.id, candidate.current_decision_id, 'SEPARATE', 'reviewer-c')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'separate');
select is((select count(distinct canonical_entity_id)::integer from app.source_records where id in (
  (select record_id from fixture_records where fixture_key = 'separate-a'),
  (select record_id from fixture_records where fixture_key = 'separate-b'))), 2, 'SEPARATE preserves distinct canonical identities');
select pg_temp.add_record('unsure-a', 'dd000000-0000-0000-0000-000000000101', 'dd000000-0000-0000-0000-000000000201', 'Unsure place');
select pg_temp.add_record('unsure-b', 'dd000000-0000-0000-0000-000000000102', 'dd000000-0000-0000-0000-000000000202', 'Unsure place');
insert into fixture_candidates values ('unsure', app.create_duplicate_candidate(
  (select record_id from fixture_records where fixture_key = 'unsure-a'),
  (select record_id from fixture_records where fixture_key = 'unsure-b'), 'test'));
insert into fixture_decisions
select 'unsure-final', app.finalize_duplicate_candidate(candidate.id, candidate.current_decision_id, 'UNSURE', 'reviewer-c')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'unsure');
select is((select count(*)::integer from app.source_records where id in (
  (select record_id from fixture_records where fixture_key = 'unsure-a'),
  (select record_id from fixture_records where fixture_key = 'unsure-b')) and canonical_entity_id is not null), 0,
  'UNSURE creates no identity linkage');

-- A finalized decision may only move through current evidence-pinned OPEN_REVIEW.
select pg_temp.advance_version('separate-a', '-v2');
select throws_ok(format('select app.finalize_duplicate_candidate(%L::uuid,%L::uuid,''SAME'',''stale'')',
  (select candidate_id from fixture_candidates where fixture_key = 'separate'),
  (select decision_id from fixture_decisions where fixture_key = 'separate-final')),
  '40001', 'finalization requires the expected current OPEN_REVIEW', 'stale final cannot jump directly to SAME');
select throws_ok(format('select app.finalize_duplicate_candidate(%L::uuid,%L::uuid,''SEPARATE'',''stale'')',
  (select candidate_id from fixture_candidates where fixture_key = 'separate'),
  (select decision_id from fixture_decisions where fixture_key = 'separate-final')),
  '40001', 'finalization requires the expected current OPEN_REVIEW', 'stale final cannot jump directly to SEPARATE');
select throws_ok(format('select app.finalize_duplicate_candidate(%L::uuid,%L::uuid,''UNSURE'',''stale'')',
  (select candidate_id from fixture_candidates where fixture_key = 'separate'),
  (select decision_id from fixture_decisions where fixture_key = 'separate-final')),
  '40001', 'finalization requires the expected current OPEN_REVIEW', 'stale final cannot jump directly to UNSURE');
insert into fixture_decisions
select 'separate-open-v2', app.reopen_duplicate_candidate(candidate.id, candidate.current_decision_id, 'reviewer-c', 'new version')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'separate');
select is((select evidence_version_ids[1] = record.current_version_id or evidence_version_ids[2] = record.current_version_id
  from app.duplicate_candidate_decisions as decision
  join app.source_records as record on record.id = (select record_id from fixture_records where fixture_key = 'separate-a')
  where decision.id = (select decision_id from fixture_decisions where fixture_key = 'separate-open-v2')), true,
  'new SourceRecordVersion reopens with current evidence');
select is((select status::text from app.duplicate_candidates where id = (select candidate_id from fixture_candidates where fixture_key = 'separate')), 'OPEN',
  'stale finalized decision transitions to OPEN_REVIEW first');

select pg_temp.advance_attempt_same_version('unsure-a', '-parser2');
insert into fixture_decisions
select 'unsure-open-a2', app.reopen_duplicate_candidate(candidate.id, candidate.current_decision_id, 'reviewer-c', 'new parse attempt')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'unsure');
select ok((select (evidence_parse_attempt_ids[1] = record.current_parse_attempt_id
    or evidence_parse_attempt_ids[2] = record.current_parse_attempt_id)
    and evidence_version_ids @> array[record.current_version_id]
  from app.duplicate_candidate_decisions as decision
  join app.source_records as record on record.id = (select record_id from fixture_records where fixture_key = 'unsure-a')
  where decision.id = (select decision_id from fixture_decisions where fixture_key = 'unsure-open-a2')),
  'same version with a new successful ParseAttempt makes prior evidence stale');
select isnt(
  (select evidence_hash from app.duplicate_candidate_decisions where id = (select decision_id from fixture_decisions where fixture_key = 'unsure-final')),
  (select evidence_hash from app.duplicate_candidate_decisions where id = (select decision_id from fixture_decisions where fixture_key = 'unsure-open-a2')),
  'H+A1 and the same H+A2 have distinct review evidence hashes'
);

-- Evidence changing again while OPEN must refresh and blocks finalization.
select pg_temp.advance_attempt_same_version('unsure-a', '-parser3');
select throws_ok(format('select app.finalize_duplicate_candidate(%L::uuid,%L::uuid,''UNSURE'',''stale-open'')',
  (select candidate_id from fixture_candidates where fixture_key = 'unsure'),
  (select decision_id from fixture_decisions where fixture_key = 'unsure-open-a2')),
  '40001', 'review evidence or source resolution changed; refresh OPEN_REVIEW first',
  'evidence change while OPEN blocks finalization');
insert into fixture_decisions
select 'unsure-open-a3', app.reopen_duplicate_candidate(candidate.id, candidate.current_decision_id, 'reviewer-c', 'refresh pending open')
from app.duplicate_candidates as candidate where candidate.id = (select candidate_id from fixture_candidates where fixture_key = 'unsure');
select isnt((select decision_id from fixture_decisions where fixture_key = 'unsure-open-a3'),
  (select decision_id from fixture_decisions where fixture_key = 'unsure-open-a2'),
  'pending OPEN_REVIEW refresh appends a new current OPEN');
select is((select count(*)::integer from app.duplicate_candidate_decisions where duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'unsure')), 4,
  'OPEN refresh remains an append-only linear history');
select throws_ok(format('update app.duplicate_candidate_decisions set note = ''mutated'' where id = %L::uuid',
  (select decision_id from fixture_decisions where fixture_key = 'unsure-final')),
  '55000', 'duplicate candidate decisions are append-only', 'decision rows are immutable');
select is((select count(*)::integer from app.duplicate_candidate_decisions as decision
  where decision.duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'unsure')
    and decision.supersedes_decision_id is null), 1, 'decision history has one root');
select is((select count(*)::integer from app.duplicate_candidate_decisions as decision
  where decision.duplicate_candidate_id = (select candidate_id from fixture_candidates where fixture_key = 'unsure')
    and exists (select 1 from app.duplicate_candidate_decisions as later where later.supersedes_decision_id = decision.id)), 3,
  'decision history has one linear supersession path');

select * from finish();
rollback;
