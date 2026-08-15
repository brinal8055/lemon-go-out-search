begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select no_plan();

grant lemon_evaluation to postgres with set true;

create function pg_temp.make_noncollapse_place(
  p_entity_id uuid,
  p_name text,
  p_document_text text,
  p_longitude double precision default 14.1570439,
  p_chain_key text default null
)
returns void
language plpgsql
as $$
declare
  document_hash text := replace(p_entity_id::text, '-', '')
    || replace(p_entity_id::text, '-', '');
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id, chain_key, chain_key_method,
    published_at
  ) values (
    p_entity_id, 'PLACE', p_name, '', '', 'PUBLISHED',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '0a39b199-4cd5-5358-85de-2c1a5f91a347',
    p_chain_key, case when p_chain_key is null then null else 'MANUAL' end,
    '2026-08-15T00:00:00Z'
  );
  insert into app.places (entity_id, location, locality, status)
  values (
    p_entity_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, 57.7793606), 4326)
      ::extensions.geography,
    'Jönköping', 'ACTIVE'
  );
  insert into app.search_documents (
    entity_id, document_version, template_version, content_hash,
    display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
    facts_text, description_text, event_context_text, embedding_text, fts,
    generated_at, is_active
  ) values (
    p_entity_id, 'search-document-v1', 'lexical-embedding-template-v1', document_hash,
    p_name, p_document_text, '', '', '', '', '', '', p_document_text,
    app.build_search_document_fts(p_document_text, '', '', '', '', '', '', '', '', '', ''),
    '2026-08-15T00:00:00Z', true
  );
end;
$$;

create function pg_temp.add_noncollapse_membership(p_entity_id uuid, p_node_id uuid)
returns void
language sql
as $$
  insert into app.entity_taxonomy_memberships (
    entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
  ) values (
    p_entity_id, p_node_id, 'MANUAL', 'NONCOLLAPSE-01 fixture', 'NONCOLLAPSE-01-TEST'
  )
$$;

create function pg_temp.make_noncollapse_event(
  p_entity_id uuid,
  p_name text,
  p_venue_place_id uuid,
  p_standalone_venue_name text default null
)
returns void
language plpgsql
as $$
declare
  source_id uuid;
  evidence_record_id uuid := gen_random_uuid();
begin
  select id into source_id from app.sources where key = 'JONKOPING_EVENT_CALENDAR';
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id
  ) values (
    p_entity_id, 'EVENT', p_name, '', '', 'DRAFT',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '0a39b199-4cd5-5358-85de-2c1a5f91a347'
  );
  insert into app.source_records (
    id, source_id, external_key, canonical_entity_id, resolution_method,
    first_seen_at, last_seen_at
  ) values (
    evidence_record_id, source_id, 'noncollapse/' || p_entity_id,
    p_entity_id, 'NEW_CANONICAL', '2026-08-15T00:00:00Z', '2026-08-15T00:00:00Z'
  );
  insert into app.events (
    entity_id, venue_place_id, standalone_venue_name, location,
    standalone_locality, standalone_country_code,
    starts_at, source_timezone, status, status_observed_at,
    event_start_source_record_id, event_status_source_record_id
  ) values (
    p_entity_id, p_venue_place_id, p_standalone_venue_name,
    case when p_venue_place_id is null then
      extensions.st_setsrid(extensions.st_makepoint(14.16, 57.78), 4326)
        ::extensions.geography
    else null end,
    case when p_venue_place_id is null then 'Jönköping' else null end,
    case when p_venue_place_id is null then 'SE' else null end,
    '2026-08-20T18:00:00Z', 'Europe/Stockholm', 'SCHEDULED',
    '2026-08-15T00:00:00Z', evidence_record_id, evidence_record_id
  );
end;
$$;

select is((select version from app.search_configs where is_active),
  'noncollapse-v1', 'the initial non-collapse search config is active');
select ok((select not is_active from app.search_configs where version = 'rank-01-rrf-v1'),
  'the accepted RANK-01 config is retained without silent mutation');
select ok((select noncollapse_enabled and noncollapse_version = 'NONCOLLAPSE_V1'
  from app.search_configs where is_active), 'the versioned rule is enabled');
select is((select noncollapse_top_k from app.search_configs where is_active),
  5::smallint, 'the protected adjustment window is top five');
select ok((select top_k_group_cap = 2 and chain_repetition_cap = 2
  and event_venue_repetition_cap = 2 from app.search_configs where is_active),
  'taxonomy, chain, and Event-venue concentration caps are two');
select is((select comparable_rrf_ratio from app.search_configs where is_active),
  0.9::real, 'base-RRF comparability is pinned at 90 percent');
select is((select taxonomy_group_depth from app.search_configs where is_active),
  1::smallint, 'taxonomy grouping uses stable active path depth one');
select is((select noncollapse_group_priority from app.search_configs where is_active),
  array['TAXONOMY','CHAIN','EVENT_VENUE']::text[],
  'multiple concentration dimensions have explicit deterministic priority');

select is(app.noncollapse_applicability_v1(
  'things to do in Jönköping', null, false, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'BROAD_TERM', 'broad English with residual geo context applies');
select is(app.noncollapse_applicability_v1(
  'något kul i stan', null, false, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'BROAD_TERM', 'broad Swedish applies');
select is(app.noncollapse_applicability_v1(
  'something fun with friends', null, true, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'BROAD_TERM', 'broad residual intent with time applies');
select is(app.noncollapse_applicability_v1(
  'events', null, true, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'BROAD_TIME_DISCOVERY', 'broad Event discovery with a time constraint applies');
select is(app.noncollapse_applicability_v1(
  '', '3751ea70-17c8-5ef0-ae44-d9dea192d29f', false, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'BROAD_STRUCTURED_BROWSE', 'broad Activities and Experiences browse applies');
select is(app.noncollapse_applicability_v1(
  'STUK', null, false, true, true,
  (select broad_terms from app.search_configs where is_active)
), 'KNOWN_ITEM', 'canonical known-item evidence disables adjustment');
select is(app.noncollapse_applicability_v1(
  'Vox Hotel', null, false, true, true,
  (select broad_terms from app.search_configs where is_active)
), 'KNOWN_ITEM', 'verified-alias known-item evidence disables adjustment');
select is(app.noncollapse_applicability_v1(
  'short name', null, false, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'NOT_BROAD', 'short name-shaped queries default to no adjustment');
select is(app.noncollapse_applicability_v1(
  'Italian restaurants', 'd43e33db-0ad3-575c-8514-d01ccf700587',
  false, false, true, (select broad_terms from app.search_configs where is_active)
), 'NARROW_TAXONOMY', 'explicit narrow taxonomy disables adjustment');
select is(app.noncollapse_applicability_v1(
  'surprise me near the lake', null, false, false, true,
  (select broad_terms from app.search_configs where is_active)
), 'NOT_BROAD', 'uncertain but not clearly broad defaults to abstention');

create temporary table taxonomy_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"51000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"51000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"51000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"51000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.95,"taxonomyKeys":["bbbbbbbb-0000-4000-8000-000000000001"]},
    {"entityId":"51000000-0000-4000-8000-000000000005","baseRank":5,"baseRrf":0.94,"taxonomyKeys":["cccccccc-0000-4000-8000-000000000001"]}
  ]'::jsonb, true, null, 5, 2, 2, 2, 0.90
);

select results_eq(
  $sql$select entity_id from taxonomy_adjusted order by final_rank$sql$,
  array[
    '51000000-0000-4000-8000-000000000001'::uuid,
    '51000000-0000-4000-8000-000000000002'::uuid,
    '51000000-0000-4000-8000-000000000004'::uuid,
    '51000000-0000-4000-8000-000000000005'::uuid,
    '51000000-0000-4000-8000-000000000003'::uuid
  ], 'comparable taxonomy alternatives keep the top-five group at its cap');
select ok((select moved and move_direction = 'UP' and base_rank = 4 and final_rank = 3
  from taxonomy_adjusted where entity_id = '51000000-0000-4000-8000-000000000004'),
  'the promoted taxonomy alternative retains before and after rank');
select ok((select concentration_details#>>'{0,type}' = 'TAXONOMY'
  and concentration_details#>>'{0,key}' = 'aaaaaaaa-0000-4000-8000-000000000001'
  and count_before = 2 and configured_cap = 2
  from taxonomy_adjusted where entity_id = '51000000-0000-4000-8000-000000000004'),
  'taxonomy movement exposes stable key and bounded count');
select ok((select comparability_result and displaced_rrf = 0.98
  from taxonomy_adjusted where entity_id = '51000000-0000-4000-8000-000000000004'),
  'movement reports the base-RRF comparability evidence');
select is((select count(*) from taxonomy_adjusted), 5::bigint,
  'non-collapse does not create or remove candidates');
select is((select count(distinct entity_id) from taxonomy_adjusted), 5::bigint,
  'non-collapse preserves canonical exactly-once output');
select is((select sum(base_rrf) from taxonomy_adjusted), 4.86::numeric,
  'base RRF values remain unchanged');
select is(
  (select array_agg(entity_id order by final_rank) from taxonomy_adjusted),
  (select array_agg(entity_id order by final_rank) from app.apply_noncollapse_v1(
    '[
      {"entityId":"51000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
      {"entityId":"51000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
      {"entityId":"51000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
      {"entityId":"51000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.95,"taxonomyKeys":["bbbbbbbb-0000-4000-8000-000000000001"]},
      {"entityId":"51000000-0000-4000-8000-000000000005","baseRank":5,"baseRrf":0.94,"taxonomyKeys":["cccccccc-0000-4000-8000-000000000001"]}
    ]'::jsonb, true, null, 5, 2, 2, 2, 0.90)),
  'the same candidate corpus reruns identically');

create temporary table weak_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"52000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"52000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"52000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"52000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.80,"taxonomyKeys":["bbbbbbbb-0000-4000-8000-000000000001"]}
  ]'::jsonb, true, null, 5, 2, 2, 2, 0.90
);
select results_eq(
  $sql$select entity_id from weak_adjusted order by final_rank$sql$,
  $sql$select entity_id from weak_adjusted order by base_rank$sql$,
  'a materially weaker alternative cannot be promoted');
select is((select abstention_reason from weak_adjusted where base_rank = 3),
  'NO_COMPARABLE_ALTERNATIVE', 'weak alternatives produce a restricted abstention reason');

create temporary table chain_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"53000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":[],"chainKey":"chain-x"},
    {"entityId":"53000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":[],"chainKey":"chain-x"},
    {"entityId":"53000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":[],"chainKey":"chain-x"},
    {"entityId":"53000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.96,"taxonomyKeys":[],"chainKey":"chain-y"}
  ]'::jsonb, true, null, 5, 2, 2, 2, 0.90
);
select is((select entity_id from chain_adjusted where final_rank = 3),
  '53000000-0000-4000-8000-000000000004'::uuid,
  'an explicit alternative chain can relieve same-chain concentration');
select is((select concentration_details#>>'{0,type}' from chain_adjusted where final_rank = 3),
  'CHAIN', 'chain movement is explicitly typed');

create temporary table venue_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"54000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":[],"eventVenueKey":"aaaaaaaa-0000-4000-8000-000000000001"},
    {"entityId":"54000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":[],"eventVenueKey":"aaaaaaaa-0000-4000-8000-000000000001"},
    {"entityId":"54000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":[],"eventVenueKey":"aaaaaaaa-0000-4000-8000-000000000001"},
    {"entityId":"54000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.96,"taxonomyKeys":[],"eventVenueKey":"bbbbbbbb-0000-4000-8000-000000000001"}
  ]'::jsonb, true, null, 5, 2, 2, 2, 0.90
);
select is((select entity_id from venue_adjusted where final_rank = 3),
  '54000000-0000-4000-8000-000000000004'::uuid,
  'an alternative linked venue can relieve Event-venue concentration');
select is((select concentration_details#>>'{0,type}' from venue_adjusted where final_rank = 3),
  'EVENT_VENUE', 'Event-venue movement is explicitly typed');

create temporary table multi_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"55000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"],"chainKey":"chain-x"},
    {"entityId":"55000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"],"chainKey":"chain-x"},
    {"entityId":"55000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"],"chainKey":"chain-x"},
    {"entityId":"55000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.96,"taxonomyKeys":["bbbbbbbb-0000-4000-8000-000000000001"],"chainKey":"chain-y"}
  ]'::jsonb, true, null, 5, 2, 2, 2, 0.90
);
select is((select jsonb_array_length(concentration_details) from multi_adjusted where final_rank = 3),
  2, 'multiple saturated dimensions remain positionally visible');
select is((select concentration_details#>>'{0,type}' from multi_adjusted where final_rank = 3),
  'TAXONOMY', 'configured dimension priority is deterministic');
select is((select concentration_details#>>'{1,type}' from multi_adjusted where final_rank = 3),
  'CHAIN', 'a second dimension does not overwrite the first');

create temporary table inapplicable_adjusted as
select * from app.apply_noncollapse_v1(
  '[
    {"entityId":"56000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"56000000-0000-4000-8000-000000000002","baseRank":2,"baseRrf":0.99,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"56000000-0000-4000-8000-000000000003","baseRank":3,"baseRrf":0.98,"taxonomyKeys":["aaaaaaaa-0000-4000-8000-000000000001"]},
    {"entityId":"56000000-0000-4000-8000-000000000004","baseRank":4,"baseRrf":0.96,"taxonomyKeys":["bbbbbbbb-0000-4000-8000-000000000001"]}
  ]'::jsonb, false, 'KNOWN_ITEM', 5, 2, 2, 2, 0.90
);
select results_eq(
  $sql$select entity_id from inapplicable_adjusted order by final_rank$sql$,
  $sql$select entity_id from inapplicable_adjusted order by base_rank$sql$,
  'known-item/non-applicable input remains byte-order identical');
select ok((select bool_and(not moved and abstention_reason = 'KNOWN_ITEM')
  from inapplicable_adjusted), 'inapplicable candidates expose the abstention reason');
select is((select abstention_reason from app.apply_noncollapse_v1(
  '[{"entityId":"57000000-0000-4000-8000-000000000001","baseRank":1,"baseRrf":1.00,"taxonomyKeys":[]}]'::jsonb,
  true, null, 5, 2, 2, 2, 0.90
)), 'NO_STABLE_GROUP_KEY', 'missing reliable grouping evidence abstains explicitly');

-- Isolate integration fixtures from legitimate mutable local inventory.
update app.canonical_entities
set publication_status = 'WITHHELD', published_at = null
where publication_status = 'PUBLISHED';

select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000001', 'NC Tax A1', 'something fun'
);
select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000002', 'NC Tax A2', 'something fun'
);
select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000003', 'NC Tax A3', 'something fun'
);
select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000004', 'NC Tax B1', 'something fun', 14.1570439,
  'explicit-chain-y'
);
select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000005', 'NC Tax C1', 'something fun'
);
select pg_temp.make_noncollapse_place(
  '61000000-0000-4000-8000-000000000099', 'NC Radius Excluded', 'something fun', 14.30
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000001', 'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000002', 'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000003', 'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000004', '6432bde9-17e2-5a04-92b3-9bf6f4589cf2'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000005', '4b839f2a-5da8-5aff-b66b-2c34e9715b26'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000099', '6432bde9-17e2-5a04-92b3-9bf6f4589cf2'
);
select pg_temp.add_noncollapse_membership(
  '61000000-0000-4000-8000-000000000001', '6432bde9-17e2-5a04-92b3-9bf6f4589cf2'
);

create temporary table integrated_broad as
select * from app.search_noncollapse_candidates(
  'something fun', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', 57.7793606, 14.1570439, 1000, null,
  array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
);
select ok((select bool_and(noncollapse_applicable and applicability_reason = 'BROAD_TERM')
  from integrated_broad), 'the integrated broad + geo search activates deterministically');
select is((select canonical_entity_id from integrated_broad where final_rank = 3),
  '61000000-0000-4000-8000-000000000004'::uuid,
  'post-RRF integration promotes the earliest comparable alternative');
select is((select base_rank from integrated_broad where final_rank = 3), 4,
  'integration retains the accepted base rank separately');
select is_empty($sql$
  select 1 from integrated_broad
  where canonical_entity_id = '61000000-0000-4000-8000-000000000099'
$sql$, 'a radius-excluded candidate cannot be promoted');
select ok((select count(*) = count(distinct canonical_entity_id) from integrated_broad),
  'integrated final canonical IDs remain exactly once');
select is(
  (select array_agg(canonical_entity_id order by base_rank) from integrated_broad),
  (select array_agg(canonical_entity_id order by final_rank)
   from app.search_ranked_candidates_pre_noncollapse_v1(
     'something fun', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
     '2026-08-15T09:00:00Z', 57.7793606, 14.1570439, 1000, null,
     array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
   )), 'non-collapse consumes the completed accepted base order');

select pg_temp.make_noncollapse_place(
  '62000000-0000-4000-8000-000000000001', 'Explicit Chain Fixture', 'not broad',
  14.1570439, 'stable-chain-key'
);
select is((select chain_key from app.noncollapse_group_keys(
  '62000000-0000-4000-8000-000000000001', 1)),
  'stable-chain-key', 'chain grouping reads only the explicit stable chain key');
select pg_temp.make_noncollapse_place(
  '62000000-0000-4000-8000-000000000002', 'Explicit Chain Fixture Similar', 'not broad'
);
select is((select chain_key from app.noncollapse_group_keys(
  '62000000-0000-4000-8000-000000000002', 1)),
  null::text, 'name similarity alone never creates a chain key');
select is((select taxonomy_keys from app.noncollapse_group_keys(
  '61000000-0000-4000-8000-000000000001', 1)),
  array[
    '6432bde9-17e2-5a04-92b3-9bf6f4589cf2'::uuid,
    'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f'::uuid
  ], 'multi-label taxonomy grouping is sorted by stable IDs');

select pg_temp.make_noncollapse_place(
  '63000000-0000-4000-8000-000000000001', 'Linked Venue Place', 'venue fixture'
);
select pg_temp.make_noncollapse_event(
  '63000000-0000-4000-8000-000000000010', 'Linked Venue Event A',
  '63000000-0000-4000-8000-000000000001'
);
select pg_temp.make_noncollapse_event(
  '63000000-0000-4000-8000-000000000011', 'Linked Venue Event B',
  '63000000-0000-4000-8000-000000000001'
);
select is((select event_venue_key from app.noncollapse_group_keys(
  '63000000-0000-4000-8000-000000000010', 1)),
  '63000000-0000-4000-8000-000000000001'::uuid,
  'linked Events use the deterministic Event to Place relationship');
select pg_temp.make_noncollapse_event(
  '63000000-0000-4000-8000-000000000020', 'Standalone Event A', null, 'Lookalike Hall'
);
select pg_temp.make_noncollapse_event(
  '63000000-0000-4000-8000-000000000021', 'Standalone Event B', null, 'Lookalike Hall'
);
select ok((select event_venue_key is null from app.noncollapse_group_keys(
  '63000000-0000-4000-8000-000000000020', 1)),
  'standalone same-looking venue names are not heuristically grouped');
select is((select venue_place_id from app.events where entity_id =
  '63000000-0000-4000-8000-000000000010'),
  '63000000-0000-4000-8000-000000000001'::uuid,
  'non-collapse leaves the Event to Place relationship unchanged');

create temporary table protected_trace as
select * from app.search_noncollapse_candidates(
  'NC Tax A1', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
);
select ok((select not noncollapse_applicable and applicability_reason = 'KNOWN_ITEM'
  and abstention_reason = 'PROTECTED_TIER' and base_rank = final_rank
  from protected_trace where canonical_entity_id = '61000000-0000-4000-8000-000000000001'),
  'protected exact disables and cannot be displaced by non-collapse');

set local role lemon_evaluation;
create temporary table noncollapse_diagnostic as
select diagnostic.explain_search_v1(jsonb_build_object(
  'query', 'something fun',
  'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  'now', '2026-08-15T09:00:00Z',
  'location', jsonb_build_object(
    'latitude', 57.7793606, 'longitude', 14.1570439, 'radiusMeters', 1000
  ),
  'entityTypes', jsonb_build_array('PLACE')
), '61000000-0000-4000-8000-000000000004') as value;
reset role;
select ok((select (value#>>'{stages,nonCollapse,applicable}')::boolean
  and value#>>'{stages,nonCollapse,applicabilityReason}' = 'BROAD_TERM'
  from noncollapse_diagnostic), 'restricted diagnostics expose applicability and reason');
select ok((select (value#>>'{stages,nonCollapse,baseRank}')::integer = 4
  and (value#>>'{stages,nonCollapse,finalRank}')::integer = 3
  and (value#>>'{stages,nonCollapse,moved}')::boolean
  from noncollapse_diagnostic), 'restricted diagnostics expose movement before and after rank');
select ok((select value#>>'{stages,nonCollapse,concentrationType}' = 'TAXONOMY'
  and value#>>'{stages,nonCollapse,concentrationKey}' =
    'ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f'
  from noncollapse_diagnostic), 'restricted diagnostics expose stable concentration type and key');
select ok((select (value#>>'{stages,nonCollapse,comparabilityResult}')::boolean
  and value#>>'{stages,nonCollapse,movementReason}' =
    'EARLIEST_COMPARABLE_GROUP_RELIEF'
  from noncollapse_diagnostic), 'restricted diagnostics expose comparability and bounded reason');
select is((select value#>>'{versions,nonCollapse,ruleVersion}' from noncollapse_diagnostic),
  'NONCOLLAPSE_V1', 'restricted diagnostics pin the complete non-collapse version');

set local role service_role;
select ok((select row_to_json(result)::jsonb ?& array[
  'result_position','entity_id','entity_type','display_name','semantic_used'
] and not (row_to_json(result)::jsonb ?| array[
  'base_rank','final_rank','rrf_score','noncollapse_applicable',
  'concentration_details','comparability_result'
]) from api.search_v1(
  gen_random_uuid(), 'something fun', 'something fun', 'something fun', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 57.7793606, 14.1570439, 1000,
  null, array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  5::smallint, 'noncollapse-v1'
) as result limit 1), 'the public response leaks no RRF or non-collapse internals');
reset role;

select ok(
  not has_function_privilege('service_role',
    'app.search_noncollapse_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)',
    'EXECUTE')
  and has_function_privilege('lemon_api_owner',
    'app.search_noncollapse_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)',
    'EXECUTE'),
  'the final-order helper remains private behind the one public RPC');
select ok(
  pg_get_functiondef(
    'app.apply_noncollapse_v1(jsonb,boolean,text,integer,integer,integer,integer,real)'::regprocedure
  ) !~* '(mmr|random\(|cosine|rating|popularity|weight)',
  'the adjustment contains no MMR, random, second relevance score, popularity, or weights');
select ok(
  pg_get_functiondef(
    'app.apply_noncollapse_v1(jsonb,boolean,text,integer,integer,integer,integer,real)'::regprocedure
  ) !~* '(insert into|update app[.]|delete from|taxonomy_nodes|canonical_entities|events)',
  'the order-only adjustment cannot mutate canonical, taxonomy, or Event truth');
select ok(
  pg_get_functiondef(
    'app.search_noncollapse_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)'::regprocedure
  ) ~ 'search_ranked_candidates_pre_noncollapse_v1',
  'the final-order stage consumes the accepted completed rank');
select ok(
  pg_get_functiondef('app.noncollapse_group_keys(uuid,integer)'::regprocedure)
    ~ 'event.venue_place_id'
  and pg_get_functiondef('app.noncollapse_group_keys(uuid,integer)'::regprocedure)
    !~* '(similarity|canonical_name_norm|standalone_venue_name)',
  'stable grouping has no chain-name or Event-venue-name heuristic');

select * from finish();
rollback;
