begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(51);

create function pg_temp.make_event(
  p_entity_id uuid,
  p_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_observed_at timestamptz,
  p_status app.event_status default 'SCHEDULED',
  p_status_observed_at timestamptz default null
)
returns void
language plpgsql
as $$
declare
  source_id uuid;
  run_id uuid := gen_random_uuid();
  record_id uuid := gen_random_uuid();
  version_id uuid := gen_random_uuid();
  attempt_id uuid := gen_random_uuid();
  status_record_id uuid := gen_random_uuid();
  status_version_id uuid := gen_random_uuid();
  status_attempt_id uuid := gen_random_uuid();
  status_observed_at timestamptz := coalesce(p_status_observed_at, p_observed_at);
  normalized jsonb;
  events_node_id uuid;
begin
  select id into source_id from app.sources where key = 'JONKOPING_EVENT_CALENDAR';
  select id into events_node_id from app.taxonomy_nodes where slug = 'events' and active;
  normalized := jsonb_build_object(
    'names', jsonb_build_array(jsonb_build_object('value', p_name)),
    'event', jsonb_strip_nulls(jsonb_build_object(
      'canonicalName', p_name,
      'latitude', 57.7814,
      'longitude', 14.1618,
      'streetAddress', 'Rådhusparken 1',
      'locality', 'Jönköping',
      'countryCode', 'SE',
      'startsAt', p_starts_at::text,
      'endsAt', p_ends_at::text,
      'status', p_status::text
    ))
  );

  insert into app.ingestion_runs (
    id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version,
    status, started_at
  ) values (
    run_id, 'event-01-' || p_entity_id,
    source_id, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    'event-01-fixture', 'event-01-fixture-parser', 'source-taxonomy.v1',
    'STARTED', p_observed_at
  );
  insert into app.source_records (
    id, source_id, external_key, first_seen_at, last_seen_at
  ) values (record_id, source_id, 'event/' || p_entity_id, p_observed_at, p_observed_at);
  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload, payload_storage_mode,
    fetched_at, observed_at
  ) values (
    version_id, record_id, run_id,
    replace(p_entity_id::text, '-', '') || replace(p_entity_id::text, '-', ''),
    normalized, 'EXTRACTED_ENVELOPE', p_observed_at, p_observed_at
  );
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version, status, attempted_at
  ) values (
    attempt_id, version_id, run_id, 'event-01-fixture-parser', 'STARTED', p_observed_at
  );
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = p_observed_at,
      normalized_output = normalized,
      normalized_output_hash = repeat('a', 64)
  where id = attempt_id;
  perform app.select_source_record_current_evidence(
    record_id, version_id, attempt_id, run_id, 'event-01-fixture-parser', null, null
  );
  insert into app.source_records (
    id, source_id, external_key, first_seen_at, last_seen_at
  ) values (
    status_record_id, source_id, 'event/' || p_entity_id || '/status',
    status_observed_at, status_observed_at
  );
  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload, payload_storage_mode,
    fetched_at, observed_at
  ) values (
    status_version_id, status_record_id, run_id,
    replace(p_entity_id::text, '-', '') || replace(p_entity_id::text, '-', ''),
    normalized, 'EXTRACTED_ENVELOPE', status_observed_at, status_observed_at
  );
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version, status, attempted_at
  ) values (
    status_attempt_id, status_version_id, run_id, 'event-01-fixture-parser',
    'STARTED', status_observed_at
  );
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = status_observed_at,
      normalized_output = normalized, normalized_output_hash = repeat('b', 64)
  where id = status_attempt_id;
  perform app.select_source_record_current_evidence(
    status_record_id, status_version_id, status_attempt_id, run_id,
    'event-01-fixture-parser', null, null
  );

  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id
  ) values (
    p_entity_id, 'EVENT', p_name, '', '', 'DRAFT',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '0a39b199-4cd5-5358-85de-2c1a5f91a347'
  );
  update app.source_records
  set canonical_entity_id = p_entity_id, resolution_method = 'NEW_CANONICAL'
  where id in (record_id, status_record_id);
  insert into app.events (
    entity_id, standalone_venue_name, location, standalone_street_address,
    standalone_locality, standalone_country_code, starts_at, ends_at,
    source_timezone, status, status_observed_at,
    event_start_source_record_id, event_end_source_record_id,
    event_status_source_record_id
  ) values (
    p_entity_id, 'Rådhusparken',
    extensions.st_setsrid(extensions.st_makepoint(14.1618, 57.7814), 4326)
      ::extensions.geography,
    'Rådhusparken 1', 'Jönköping', 'SE', p_starts_at, p_ends_at,
    'Europe/Stockholm', p_status, p_observed_at,
    record_id, case when p_ends_at is null then null else record_id end, status_record_id
  );

  perform app.replace_targeted_canonical_fact(
    p_entity_id, 'canonical_name', to_jsonb(p_name), version_id,
    'SOURCE_PRECEDENCE', 'EVENT-01-TEST'
  );
  perform app.replace_targeted_canonical_fact(
    p_entity_id, 'location', jsonb_build_object('latitude', 57.7814, 'longitude', 14.1618),
    version_id, 'SOURCE_PRECEDENCE', 'EVENT-01-TEST'
  );
  perform app.replace_targeted_canonical_fact(
    p_entity_id, 'address', jsonb_build_object(
      'streetAddress', 'Rådhusparken 1', 'locality', 'Jönköping', 'countryCode', 'SE'
    ), version_id, 'SOURCE_PRECEDENCE', 'EVENT-01-TEST'
  );
  perform app.replace_targeted_canonical_fact(
    p_entity_id, 'event_start', to_jsonb(p_starts_at::text), version_id,
    'SOURCE_PRECEDENCE', 'EVENT-01-TEST'
  );
  if p_ends_at is not null then
    perform app.replace_targeted_canonical_fact(
      p_entity_id, 'event_end', to_jsonb(p_ends_at::text), version_id,
      'SOURCE_PRECEDENCE', 'EVENT-01-TEST'
    );
  end if;
  perform app.replace_targeted_canonical_fact(
    p_entity_id, 'event_status', to_jsonb(p_status::text), status_version_id,
    case when p_status = 'SCHEDULED' then 'MANUAL' else 'SOURCE_PRECEDENCE' end,
    'EVENT-01-TEST'
  );
  insert into app.entity_taxonomy_memberships (
    entity_id, taxonomy_node_id, method, source_record_version_id,
    mapping_ref
  ) values (
    p_entity_id, events_node_id, 'DETERMINISTIC_MAP', version_id,
    'jonkoping-event-calendar-occurrence-events'
  );
  update app.canonical_entities
  set publication_status = 'PUBLISHED', published_at = p_observed_at
  where id = p_entity_id;
  insert into app.search_documents (
    entity_id, document_version, template_version, content_hash,
    display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
    facts_text, description_text, event_context_text, embedding_text, fts,
    generated_at, is_active
  ) values (
    p_entity_id, 'search-document-v1', 'lexical-embedding-template-v1',
    replace(p_entity_id::text, '-', '') || replace(p_entity_id::text, '-', ''),
    p_name, p_name, '', 'Events', 'Evenemang',
    'Address: Rådhusparken 1, Jönköping, SE', '', 'Venue: Rådhusparken',
    concat_ws(E'\n', p_name, 'Events', 'Evenemang', 'Venue: Rådhusparken'),
    app.build_search_document_fts(
      p_name, '', 'Events', 'Evenemang', '',
      'Address: Rådhusparken 1, Jönköping, SE', '', '', '',
      'Venue: Rådhusparken', ''
    ), p_observed_at, true
  );
end;
$$;

select is((select version from app.search_configs where is_active), 'sem-01-query-v1',
  'the selected embedding config retains the EVENT-01 search settings');
select is((select event_horizon_days from app.search_configs where is_active), 30::smallint,
  'the active Event horizon is exactly 30 days');
select is((select event_freshness_by_source#>>'{JONKOPING_EVENT_CALENDAR,toleranceHours}'
  from app.search_configs where is_active), '48', 'municipal Event freshness is 48 hours');
select ok(
  not has_function_privilege('service_role',
    'app.search_event_candidates(text,uuid,timestamptz,integer,jsonb,timestamptz,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],integer)',
    'EXECUTE')
  and has_function_privilege('lemon_api_owner',
    'app.search_event_candidates(text,uuid,timestamptz,integer,jsonb,timestamptz,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],integer)',
    'EXECUTE'),
  'Event candidate helpers remain private behind api.search_v1'
);

select ok(app.event_interval_overlaps(
  '2026-08-15T09:00Z', '2026-08-15T11:00Z', '2026-08-15T10:00Z', '2026-08-15T12:00Z'
), 'known-end overlap uses both strict half-open inequalities');
select ok(not app.event_interval_overlaps(
  '2026-08-15T08:00Z', '2026-08-15T10:00Z', '2026-08-15T10:00Z', '2026-08-15T12:00Z'
), 'known-end ends=query_start does not overlap');
select ok(not app.event_interval_overlaps(
  '2026-08-15T12:00Z', '2026-08-15T13:00Z', '2026-08-15T10:00Z', '2026-08-15T12:00Z'
), 'known-end starts=query_end does not overlap');
select ok(app.event_interval_overlaps(
  '2026-08-15T10:00Z', null, '2026-08-15T10:00Z', '2026-08-15T12:00Z'
), 'point start=query_start overlaps');
select ok(not app.event_interval_overlaps(
  '2026-08-15T12:00Z', null, '2026-08-15T10:00Z', '2026-08-15T12:00Z'
), 'point start=query_end does not overlap');
select ok(app.event_is_expired('2026-08-15T08:00Z', '2026-08-15T10:00Z', '2026-08-15T10:00Z'),
  'known-end ends=now is expired');
select ok(not app.event_is_expired('2026-08-15T10:00Z', null, '2026-08-15T10:00Z'),
  'point start=now remains current');
select ok(app.event_is_expired('2026-08-15T09:59:59Z', null, '2026-08-15T10:00Z'),
  'point start before now is expired');

select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000001', 'Fresh Concert',
  '2026-08-15T11:00Z', '2026-08-15T13:00Z', '2026-08-15T09:00Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000002', 'Fresh Point',
  '2026-08-15T12:00Z', null, '2026-08-15T09:00Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000003', 'Stale Concert',
  '2026-08-15T11:00Z', '2026-08-15T13:00Z', '2026-08-13T09:59:59Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000004', 'Boundary Fresh',
  '2026-08-15T14:00Z', '2026-08-15T15:00Z', '2026-08-13T10:00Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000005', 'Horizon Edge',
  '2026-09-14T10:00Z', '2026-09-14T11:00Z', '2026-08-15T09:00Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000008', 'Status Stale',
  '2026-08-15T14:00Z', '2026-08-15T15:00Z', '2026-08-15T09:00Z',
  'SCHEDULED', '2026-08-13T09:59:59Z'
);

select ok((select eligible from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, array['EVENT']::app.entity_type[]
) where entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'fresh SCHEDULED known-end Event is eligible');
select ok((select eligible from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, array['EVENT']::app.entity_type[]
) where entity_id = 'e1000000-0000-4000-8000-000000000002'),
  'fresh point Event is eligible without invented duration');
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000003'),
  'SCHEDULE_STALE', 'stale critical schedule evidence is excluded');
select ok((select eligible and effective_freshness = '2026-08-13T10:00Z'
  from app.search_event_eligibility(
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    null, null, null, null, null, null, null
  ) where entity_id = 'e1000000-0000-4000-8000-000000000004'),
  'freshness equality at exactly 48 hours is eligible');
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000005'),
  'OUTSIDE_EVENT_HORIZON', 'start exactly at horizon_end is excluded');
select ok((select schedule_freshness = status_freshness
  and effective_freshness = schedule_freshness
  from app.search_event_eligibility(
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    null, null, null, null, null, null, null
  ) where entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'schedule and status freshness remain separately diagnosable');
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000008'),
  'STATUS_STALE', 'stale status evidence is independently excluded');
select ok((select schedule_freshness > status_freshness
  and effective_freshness = status_freshness
  from app.search_event_eligibility(
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    null, null, null, null, null, null, null
  ) where entity_id = 'e1000000-0000-4000-8000-000000000008'),
  'different critical records use the conservative minimum observation');

update app.canonical_fact_provenance
set is_current = false, superseded_at = '2026-08-15T10:00Z'
where entity_id = 'e1000000-0000-4000-8000-000000000002'
  and fact_key = 'event_status' and is_current;
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000002'),
  'CRITICAL_PROVENANCE_MISSING', 'missing current critical provenance fails closed');
select app.replace_targeted_canonical_fact(
  'e1000000-0000-4000-8000-000000000002', 'event_status', to_jsonb('SCHEDULED'::text),
  version.id, 'MANUAL', 'EVENT-01-TEST-RESTORE'
)
from app.source_records as record
join app.source_record_versions as version on version.id = record.current_version_id
where record.canonical_entity_id = 'e1000000-0000-4000-8000-000000000002'
  and record.external_key like '%/status';

insert into app.canonical_entities (
  id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
  publication_status, scope_id, scope_boundary_id
) values (
  'e2000000-0000-4000-8000-000000000001', 'PLACE', 'Linked Rådhusparken', '', '',
  'DRAFT', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '0a39b199-4cd5-5358-85de-2c1a5f91a347'
);
insert into app.places (entity_id, location, locality, status) values (
  'e2000000-0000-4000-8000-000000000001',
  extensions.st_setsrid(extensions.st_makepoint(14.1618, 57.7814), 4326)
    ::extensions.geography,
  'Jönköping', 'ACTIVE'
);
update app.events set
  venue_place_id = 'e2000000-0000-4000-8000-000000000001', location = null
where entity_id = 'e1000000-0000-4000-8000-000000000002';
select ok((select eligible and venue_mode = 'LINKED'
  from app.search_event_eligibility(
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    null, null, null, null, null, null, null
  ) where entity_id = 'e1000000-0000-4000-8000-000000000002'),
  'deterministically linked Place venue is eligible');
update app.places set location = null
where entity_id = 'e2000000-0000-4000-8000-000000000001';
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000002'),
  'EFFECTIVE_LOCATION_MISSING', 'missing effective linked location is excluded');
update app.places set location = extensions.st_setsrid(
  extensions.st_makepoint(14.1618, 57.7814), 4326
)::extensions.geography where entity_id = 'e2000000-0000-4000-8000-000000000001';
update app.canonical_entities
set publication_status = 'PUBLISHED',
    canonical_name_norm = 'linked rådhusparken',
    canonical_name_ascii = 'linked radhusparken',
    published_at = statement_timestamp()
where id = 'e2000000-0000-4000-8000-000000000001';

set local role service_role;
select is((select count(distinct entity_type) from api.search_v1(
  gen_random_uuid(), 'Linked Rådhusparken', 'linked rådhusparken', 'linked radhusparken', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
  null, '2026-08-15T10:00Z', '2026-08-15T14:00Z', null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  20::smallint, 'sem-01-query-v1'
)), 2::bigint,
  'recognized time retains ordinary Place retrieval alongside eligible Events');
reset role;

update app.events set status = 'CANCELLED'
where entity_id = 'e1000000-0000-4000-8000-000000000001';
select is((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'EVENT_STATUS_INELIGIBLE', 'CANCELLED is immediately excluded even while published/doc-active');
select is((select count(*) from app.search_event_candidates(
  'Fresh Concert', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
) where canonical_entity_id = 'e1000000-0000-4000-8000-000000000001'),
  0::bigint, 'ineligible Event cannot re-enter through an active SearchDocument');
update app.events set status = 'POSTPONED'
where entity_id = 'e1000000-0000-4000-8000-000000000001';
select isnt((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000001'), 'ELIGIBLE',
  'POSTPONED is excluded');
update app.events set status = 'COMPLETED'
where entity_id = 'e1000000-0000-4000-8000-000000000001';
select isnt((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000001'), 'ELIGIBLE',
  'COMPLETED is excluded');
update app.events set status = 'UNKNOWN'
where entity_id = 'e1000000-0000-4000-8000-000000000001';
select isnt((select reason_code from app.search_event_eligibility(
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null
) where entity_id = 'e1000000-0000-4000-8000-000000000001'), 'ELIGIBLE',
  'UNKNOWN is excluded');
update app.events set status = 'SCHEDULED'
where entity_id = 'e1000000-0000-4000-8000-000000000001';

select is((select context_match from app.search_event_candidates(
  'Fresh Concert', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
) where canonical_entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'TITLE_EXACT', 'Event title evidence enters event_candidates');
select ok((select stage_evidence @> '{"protected":true,"protectionClass":"CANONICAL_EXACT"}'::jsonb
  from app.search_event_candidates(
    'Fresh Concert', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    null, null, null, null, null, null, null, 20
  ) where canonical_entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'Eligible canonical Event title exact is explicitly protected');
select is((select context_match from app.search_event_candidates(
  'Rådhusparken', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
) where canonical_entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'VENUE_LEXICAL', 'factual venue evidence enters event_candidates');
select ok((select count(*) >= 2 from app.search_event_candidates(
  '', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  '2026-08-15T10:00Z', '2026-08-15T14:00Z', null, null, null, null,
  array['EVENT']::app.entity_type[], 20
)), 'time-only query returns eligible Event candidates');
select is((select count(*) from app.search_event_candidates(
  '', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  '2026-08-15T10:00Z', '2026-08-15T14:00Z', null, null, null, null,
  array['EVENT']::app.entity_type[], 1
)), 1::bigint, 'Event candidate cap is enforced');
select ok((select bool_and(candidate_rank = expected_rank) from (
  select candidate_rank, row_number() over (order by starts_at, canonical_entity_id)::integer as expected_rank
  from app.search_event_candidates(
    '', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    '2026-08-15T10:00Z', '2026-08-15T16:00Z', null, null, null, null,
    array['EVENT']::app.entity_type[], 20
  )
) ranked), 'time-only candidates order chronologically then by canonical ID');
select ok((select count(*) = count(distinct canonical_entity_id) from app.search_event_candidates(
  '', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  '2026-08-15T10:00Z', '2026-08-15T16:00Z', null, null, null, null,
  array['EVENT']::app.entity_type[], 20
)), 'event_candidates emits each canonical Event once');
select ok((select stage_evidence @> '{"stage":"EVENT","timeFiltered":true}'::jsonb
  from app.search_event_candidates(
    '', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
    (select event_freshness_by_source from app.search_configs where is_active),
    '2026-08-15T10:00Z', '2026-08-15T14:00Z', null, null, null, null,
    array['EVENT']::app.entity_type[], 20
  ) where canonical_entity_id = 'e1000000-0000-4000-8000-000000000001'),
  'Event stage retains bounded factual evidence');

set local role service_role;
select is((select count(*) from api.search_v1(
  gen_random_uuid(), 'Fresh Concert', 'fresh concert', 'fresh concert', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
  array['EVENT']::app.entity_type[], null, null, null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  10::smallint, 'sem-01-query-v1'
) where entity_id = 'e1000000-0000-4000-8000-000000000001'), 1::bigint,
  'production API uses its server clock and returns the current Event');
reset role;

grant lemon_evaluation to postgres with set true;
create temporary table event_diagnostic_result (value jsonb);
grant insert on event_diagnostic_result to lemon_evaluation;
set local role lemon_evaluation;
insert into event_diagnostic_result
select diagnostic.explain_search_v1(
    '{"query":"Fresh Concert","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6","now":"2026-08-15T10:00:00Z"}',
    'e1000000-0000-4000-8000-000000000001'
  );
reset role;
select ok(
  (select value#>>'{stages,event,status}' = 'EXECUTED'
    and value#>>'{eventEligibility,venueMode}' = 'STANDALONE'
   from event_diagnostic_result),
  'restricted Event diagnostics expose real Event stage and factual venue mode'
);
select ok(
  (select value::text not like '%source_record%' and value::text not like '%payload%'
   from event_diagnostic_result),
  'restricted Event diagnostics expose no raw source payload or evidence identities'
);

select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000006', 'Expired Known End',
  '2026-08-15T08:00Z', '2026-08-15T10:00Z', '2026-08-15T09:00Z'
);
select pg_temp.make_event(
  'e1000000-0000-4000-8000-000000000007', 'Expired Point',
  '2026-08-15T09:59:59Z', null, '2026-08-15T09:00Z'
);
select is((select count(*) from app.search_event_candidates(
  'Expired Known End', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
)), 0::bigint, 'search excludes known-end expiry before offline command');
select is((select count(*) from app.search_event_candidates(
  'Expired Point', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
)), 0::bigint, 'search excludes point expiry before offline command');
grant lemon_ingestion to postgres with set true;
create temporary table event_expiry_report (
  run_number integer primary key,
  withheld_count integer,
  documents_invalidated integer,
  embeddings_staled integer
);
grant insert on event_expiry_report to lemon_ingestion;
set local role lemon_ingestion;
insert into event_expiry_report
select 1, report.* from app.expire_events('2026-08-15T10:00Z') as report;
reset role;
select is((select withheld_count from event_expiry_report where run_number = 1), 2,
  'expiry command uses the same known-end and point predicates');
select ok((select bool_and(entity.publication_status = 'WITHHELD'
  and event.status = 'SCHEDULED')
  from app.canonical_entities as entity join app.events as event on event.entity_id = entity.id
  where entity.id in (
    'e1000000-0000-4000-8000-000000000006',
    'e1000000-0000-4000-8000-000000000007'
  )), 'expiry withholds publication without inventing COMPLETED');
select is((select count(*) from app.search_documents where entity_id in (
  'e1000000-0000-4000-8000-000000000006',
  'e1000000-0000-4000-8000-000000000007'
) and is_active), 0::bigint, 'expiry invalidates active Event SearchDocuments');
set local role lemon_ingestion;
insert into event_expiry_report
select 2, report.* from app.expire_events('2026-08-15T10:00Z') as report;
reset role;
select is((select withheld_count from event_expiry_report where run_number = 2), 0,
  'expiry command is idempotent');
select is((select count(*) from app.canonical_fact_provenance
  where entity_id = 'e1000000-0000-4000-8000-000000000006'
    and fact_key = 'event_status' and is_current), 1::bigint,
  'expiry preserves current status provenance');
select is((select count(*) from app.search_event_candidates(
  'Expired Known End', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T10:00Z', 30,
  (select event_freshness_by_source from app.search_configs where is_active),
  null, null, null, null, null, null, null, 20
)), 0::bigint, 'expired Event remains absent after expiry command');

select ok(to_regclass('app.events_known_end_expiry_idx') is not null
  and to_regclass('app.events_point_expiry_idx') is not null,
  'only bounded Event retrieval/expiry indexes were added');
select ok(not has_function_privilege('service_role', 'app.expire_events(timestamptz)', 'EXECUTE')
  and has_function_privilege('lemon_ingestion', 'app.expire_events(timestamptz)', 'EXECUTE'),
  'expiry command remains an ingestion-only private operation');
select is((select count(*) from information_schema.parameters
  where specific_schema = 'api' and parameter_mode = 'OUT'), 18::bigint,
  'public response shape remains frozen and contains no diagnostic fields');

select * from finish();
rollback;
