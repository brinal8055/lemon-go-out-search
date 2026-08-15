begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(42);

create function pg_temp.make_discovery_place(
  entity_id uuid,
  place_name text,
  publication app.publication_status default 'PUBLISHED'
)
returns void
language plpgsql
as $$
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id, published_at
  ) values (
    entity_id, 'PLACE', place_name, '', '', publication,
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '0a39b199-4cd5-5358-85de-2c1a5f91a347',
    case when publication = 'PUBLISHED' then now() else null end
  );
  insert into app.places (entity_id, location, locality, status)
  values (
    entity_id,
    extensions.st_setsrid(extensions.st_makepoint(14.1570439, 57.7793606), 4326)
      ::extensions.geography,
    'Jönköping',
    'ACTIVE'
  );
end;
$$;

create function pg_temp.add_discovery_document(
  entity_id uuid,
  names text,
  aliases text default '',
  direct_en text default '',
  direct_sv text default '',
  direct_und text default '',
  facts text default '',
  ancestor_en text default '',
  ancestor_sv text default '',
  ancestor_und text default '',
  description text default '',
  active boolean default true
)
returns void
language plpgsql
as $$
declare
  deterministic_hash text := replace(entity_id::text, '-', '')
    || replace(entity_id::text, '-', '');
begin
  insert into app.search_documents (
    id, entity_id, document_version, template_version, content_hash,
    display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
    facts_text, description_text, event_context_text, embedding_text, fts,
    generated_at, is_active
  ) values (
    gen_random_uuid(), entity_id, 'search-document-v1', 'lexical-embedding-template-v1',
    deterministic_hash, names, names, aliases, direct_en || ' ' || ancestor_en,
    direct_sv || ' ' || ancestor_sv, facts, description, '',
    concat_ws(' ', names, aliases, direct_en, direct_sv, direct_und, facts,
      ancestor_en, ancestor_sv, ancestor_und, description),
    app.build_search_document_fts(
      names, aliases, direct_en, direct_sv, direct_und, facts,
      ancestor_en, ancestor_sv, ancestor_und, '', description
    ),
    '2026-08-14T00:00:00Z', active
  );
end;
$$;

create function pg_temp.add_manual_membership(entity_id uuid, node_id uuid)
returns void
language sql
as $$
  insert into app.entity_taxonomy_memberships (
    entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
  ) values (entity_id, node_id, 'MANUAL', 'SEARCH-02 deterministic fixture', 'SEARCH-02-TEST')
$$;

select ok(
  to_regprocedure('app.search_lexical_candidates(text,uuid,integer)') is not null
  and to_regprocedure('app.search_recognized_taxonomy_node(text)') is not null
  and to_regprocedure('app.search_taxonomy_candidates(text,uuid,uuid,integer)') is not null
  and to_regprocedure(
    'app.search_deterministic_candidates(text,uuid,uuid,integer,integer,integer,integer,real,integer,integer,integer)'
  ) is not null,
  'SEARCH-02 private stages exist independently'
);
select ok(
  not has_function_privilege('anon', 'app.search_lexical_candidates(text,uuid,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app.search_taxonomy_candidates(text,uuid,uuid,integer)', 'EXECUTE')
  and not has_function_privilege(
    'service_role',
    'app.search_deterministic_candidates(text,uuid,uuid,integer,integer,integer,integer,real,integer,integer,integer)',
    'EXECUTE'
  ),
  'private stages are not exposed to public API roles'
);
select is(
  (select version from app.search_configs where is_active),
  'event-01-time-v1',
  'the versioned SEARCH-02 config is active'
);
select ok(
  to_regclass('app.search_documents_active_fts_idx') is not null
  and to_regclass('app.taxonomy_nodes_path_idx') is not null
  and to_regclass('app.entity_taxonomy_memberships_node_active_idx') is not null,
  'bounded lexical and taxonomy indexes exist'
);

select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000001', 'Aurora Kitchen');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000001', 'Aurora Kitchen', facts => 'wood fired dining'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000002', 'Sjögläntan');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000002', 'Sjögläntan', direct_sv => 'Restauranger'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000003', 'Nordic Social');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000003', 'Nordic Social', facts => 'family träning'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000004', 'Starlight');
select pg_temp.add_discovery_document('a2000000-0000-0000-0000-000000000004', 'Starlight');
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000005', 'Quiet Corner');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000005', 'Quiet Corner', description => 'starlight'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000006', 'Inactive Match');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000006', 'Inactive Match', facts => 'hiddenlexical', active => false
);
select pg_temp.make_discovery_place(
  'a2000000-0000-0000-0000-000000000007', 'Withheld Match', 'WITHHELD'
);
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000007', 'Withheld Match', facts => 'hiddenlexical'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000008', 'Tie Alpha');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000008', 'Tie Alpha', facts => 'equalrank'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000009', 'Tie Beta');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000009', 'Tie Beta', facts => 'equalrank'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000013', 'Café Öster');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000013', 'Café Öster'
);

select is(
  (select canonical_entity_id from app.search_lexical_candidates(
    'wood fired', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) limit 1),
  'a2000000-0000-0000-0000-000000000001'::uuid,
  'English lexical query retrieves the expected entity'
);
select is(
  (select canonical_entity_id from app.search_lexical_candidates(
    'restaurang', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) limit 1),
  'a2000000-0000-0000-0000-000000000002'::uuid,
  'Swedish stemming retrieves the expected entity independently of UI locale'
);
select is(
  (select canonical_entity_id from app.search_lexical_candidates(
    'family träning', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) limit 1),
  'a2000000-0000-0000-0000-000000000003'::uuid,
  'mixed-language lexical query is deterministic'
);
select lives_ok(
  $$select * from app.search_lexical_candidates(
    E'''wood-fired'' (dining) !!!', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )$$,
  'special-character lexical input uses safe tsquery construction'
);
select ok(
  (select raw_score from app.search_lexical_candidates(
    'starlight', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000004')
  >
  (select raw_score from app.search_lexical_candidates(
    'starlight', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000005'),
  'DOC-01 name weight structurally outranks description-only evidence'
);
select is(
  (select count(*) from app.search_lexical_candidates(
    'hiddenlexical', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  0::bigint,
  'inactive and ineligible documents cannot retrieve entities'
);
select ok(
  (select count(*) <= 1 from app.search_lexical_candidates(
    'equalrank', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 1
  )),
  'lexical candidates respect the supplied cap'
);
select is(
  (select canonical_entity_id from app.search_lexical_candidates(
    'equalrank', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) order by candidate_rank limit 1),
  'a2000000-0000-0000-0000-000000000008'::uuid,
  'lexical score ties use canonical UUID ascending'
);
select is(
  (select matched_weight from app.search_lexical_candidates(
    'starlight', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000004'),
  'A',
  'lexical private evidence retains the matched weighted class'
);
select ok(
  (select not protected and best_match_type = 'ACCENTLESS_EXACT'
   from app.search_deterministic_candidates(
     'Cafe Oster', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000013'),
  'accentless exact evidence remains ordinary'
);

select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000010', 'Food Hall Direct');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000010', 'Food Hall Direct',
  direct_en => 'Food & Dining', direct_sv => 'Mat och restauranger'
);
select pg_temp.add_manual_membership(
  'a2000000-0000-0000-0000-000000000010', '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000011', 'Pizza Lantern');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000011', 'Pizza Lantern',
  direct_en => 'Pizza', direct_sv => 'Pizza',
  ancestor_en => 'Food & Dining', ancestor_sv => 'Mat och restauranger'
);
select pg_temp.add_manual_membership(
  'a2000000-0000-0000-0000-000000000011', '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc'
);
select pg_temp.add_manual_membership(
  'a2000000-0000-0000-0000-000000000011', 'acda530f-d654-5027-97b8-a5a912e4b752'
);
select pg_temp.make_discovery_place('a2000000-0000-0000-0000-000000000012', 'Burger Lantern');
select pg_temp.add_discovery_document(
  'a2000000-0000-0000-0000-000000000012', 'Burger Lantern', direct_en => 'Burgers'
);
select pg_temp.add_manual_membership(
  'a2000000-0000-0000-0000-000000000012', 'acda530f-d654-5027-97b8-a5a912e4b752'
);
insert into app.taxonomy_aliases (
  taxonomy_node_id, language, alias, alias_norm, alias_ascii, active
) values (
  '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc', 'en',
  'Pie places', '', '', true
);

select is(
  (select taxonomy_node_id from app.search_recognized_taxonomy_node('Food & Dining')),
  '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'::uuid,
  'English taxonomy label is recognized exactly'
);
select is(
  (select taxonomy_node_id from app.search_recognized_taxonomy_node('Mat och restauranger')),
  '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'::uuid,
  'Swedish taxonomy label is recognized exactly'
);
select is(
  (select taxonomy_node_id from app.search_recognized_taxonomy_node('Pie places')),
  '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc'::uuid,
  'approved taxonomy alias is recognized'
);
select is(
  (select match_source from app.search_recognized_taxonomy_node('Pie places')),
  'ALIAS_EN',
  'taxonomy alias recognition retains its exact approved evidence source'
);
select is(
  (select count(*) from app.search_recognized_taxonomy_node('pizza-ish nearby category')),
  0::bigint,
  'unknown taxonomy-like text does not invent a node'
);
select is(
  (select count(*) from app.search_taxonomy_candidates(
    '', '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  1::bigint,
  'an explicit taxonomy node retrieves category inventory'
);
select is(
  (select count(*) from app.search_taxonomy_candidates(
    'Food & Dining', null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  3::bigint,
  'parent taxonomy query expands active descendants without duplicate entities'
);
select is(
  (select count(*) from app.search_taxonomy_candidates(
    'Pizza', null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  1::bigint,
  'leaf taxonomy query remains narrow and does not expand to siblings'
);
select ok(
  (select direct_taxonomy and candidate_rank = 1
   from app.search_taxonomy_candidates(
     'Food & Dining', null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000010'),
  'direct membership ranks before descendant expansion'
);
select is(
  (select count(*) from app.search_taxonomy_candidates(
    'Food & Dining', null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  1::bigint,
  'multiple matching descendant memberships produce one taxonomy row per entity'
);
select ok(
  (select count(*) <= 1 from app.search_taxonomy_candidates(
    'Food & Dining', null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 1
  )),
  'taxonomy candidates respect the supplied cap'
);

select is(
  (select count(*) from app.search_deterministic_candidates(
    'Pizza', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
    20, 3, 20, 4, 0.3, 20, 20, 20
  ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  1::bigint,
  'candidate union emits each canonical entity exactly once'
);
select ok(
  (select stage_evidence @> '[{"stage":"FTS"}]'::jsonb
      and stage_evidence @> '[{"stage":"TAXONOMY"}]'::jsonb
   from app.search_deterministic_candidates(
     'Pizza', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  'candidate union retains every participating stage rank and evidence'
);
select ok(
  (select protected and protection_class = 'PROTECTED_CANONICAL_EXACT'
   from app.search_deterministic_candidates(
     'Pizza Lantern', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  'protected canonical exact remains protected in the union'
);

insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind,
  verified, verified_by, verified_at
) values (
  'a2000000-0000-0000-0000-000000000001', 'Aurora Secret', '', '', 'und', 'MANUAL',
  true, 'SEARCH-02-TEST', now()
);

select ok(
  (select protected and protection_class = 'PROTECTED_ALIAS_EXACT'
   from app.search_deterministic_candidates(
     'Aurora Secret', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000001'),
  'qualified verified alias remains protected in the union'
);
select ok(
  (select not protected
   from app.search_deterministic_candidates(
     'Auror Kitchen', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000001'),
  'trigram evidence remains ordinary'
);
select ok(
  (select stage_evidence @> '[{"stage":"PREFIX"}]'::jsonb and not protected
   from app.search_deterministic_candidates(
     'Pizza', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  'prefix evidence remains ordinary'
);
select is(
  (select array_agg(canonical_entity_id order by provisional_rank)
   from app.search_deterministic_candidates(
     'equalrank', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   )),
  (select array_agg(canonical_entity_id order by provisional_rank)
   from app.search_deterministic_candidates(
     'equalrank', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   )),
  'provisional stage ordering is deterministic across repeated runs'
);
select ok(
  not exists (
    select 1
    from app.search_deterministic_candidates(
      'Pizza', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
      20, 3, 20, 4, 0.3, 20, 20, 20
    ) as candidate
    cross join lateral jsonb_array_elements(candidate.stage_evidence) as evidence
    where evidence->>'stage' in ('EVENT', 'SEMANTIC', 'RRF')
  ),
  'Event, semantic, RRF, and non-collapse do not participate'
);
select throws_ok(
  $$select * from app.search_lexical_candidates(
    'bounded', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 0
  )$$,
  '22023', 'lexical candidate cap is invalid',
  'invalid lexical bounds fail closed instead of scanning'
);

set local role service_role;

select is(
  (select display_name from api.search_v1(
    gen_random_uuid(), 'wood fired', 'wood fired', 'wood fired', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'event-01-time-v1'
  ) limit 1),
  'Aurora Kitchen',
  'api.search_v1 returns representative lexical discovery'
);
select is(
  (select count(*) from api.search_v1(
    gen_random_uuid(), '', '', '', 'sv',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null,
    '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'event-01-time-v1'
  )),
  1::bigint,
  'empty query plus explicit taxonomy category browse works through the one public RPC'
);
select is(
  (select count(*) from api.search_v1(
    gen_random_uuid(), 'wood fired', 'wood fired', 'wood fired', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null,
    '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'event-01-time-v1'
  ) where entity_id = 'a2000000-0000-0000-0000-000000000001'),
  0::bigint,
  'explicit taxonomy filter remains an authoritative hard filter'
);
select throws_ok(
  $$select * from api.search_v1(
    gen_random_uuid(), '', '', '', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'event-01-time-v1'
  )$$,
  '22023', 'query is required',
  'unsupported empty query retains the frozen validation contract'
);
select is(
  (select count(*) from api.search_v1(
    gen_random_uuid(), 'Pizza', 'pizza', 'pizza', 'sv',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    10::smallint, 'event-01-time-v1'
  ) where entity_id = 'a2000000-0000-0000-0000-000000000011'),
  1::bigint,
  'api.search_v1 returns recognized taxonomy discovery without exposing stages'
);
select ok(
  (select count(*) = count(distinct entity_id) from api.search_v1(
    gen_random_uuid(), 'Food & Dining', 'food dining', 'food dining', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
    20::smallint, 'event-01-time-v1'
  )),
  'public results contain unique canonical IDs after stage union'
);

reset role;

select is(
  (select count(*) from information_schema.parameters
   where specific_schema = 'api' and parameter_mode = 'OUT'),
  18::bigint,
  'public response remains the frozen shaped contract with no stage evidence'
);
select ok(
  (select protected and provisional_rank = 1
   from app.search_deterministic_candidates(
     'Pizza Lantern', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null,
     20, 3, 20, 4, 0.3, 20, 20, 20
   ) where canonical_entity_id = 'a2000000-0000-0000-0000-000000000011'),
  'protected exact cannot be displaced by ordinary FTS or taxonomy evidence'
);

select * from finish();
rollback;
