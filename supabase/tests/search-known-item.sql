begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(45);

create function pg_temp.make_search_place(
  place_name text,
  publication app.publication_status default 'PUBLISHED',
  place_state app.place_status default 'UNKNOWN',
  selected_scope_id uuid default 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  selected_boundary_id uuid default '0a39b199-4cd5-5358-85de-2c1a5f91a347'
)
returns uuid
language plpgsql
as $$
declare
  entity_id uuid := gen_random_uuid();
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id, published_at
  ) values (
    entity_id, 'PLACE', place_name, '', '', publication,
    selected_scope_id, selected_boundary_id,
    case when publication = 'PUBLISHED' then now() else null end
  );
  insert into app.places (entity_id, location, status)
  values (
    entity_id,
    st_setsrid(st_makepoint(14.1570439, 57.7793606), 4326)::extensions.geography,
    place_state
  );
  return entity_id;
end;
$$;

create function pg_temp.add_verified_alias(entity_id uuid, alias_text text)
returns uuid
language plpgsql
as $$
declare
  created_alias_id uuid := gen_random_uuid();
begin
  insert into app.entity_aliases (
    id, entity_id, alias, alias_norm, alias_ascii, language, kind,
    verified, verified_by, verified_at
  ) values (
    created_alias_id, entity_id, alias_text, '', '', 'und', 'MANUAL',
    true, 'SEARCH-01-TEST', now()
  );
  return created_alias_id;
end;
$$;

select ok(
  to_regprocedure('app.search_eligible_places(uuid)') is not null
  and to_regprocedure('app.search_exact_candidates(text,uuid,integer)') is not null
  and to_regprocedure(
    'app.search_fuzzy_candidates(text,uuid,integer,integer,integer,integer,real,integer)'
  ) is not null
  and to_regprocedure(
    'app.search_known_item_candidates(text,uuid,integer,integer,integer,integer,real,integer)'
  ) is not null,
  'private SEARCH-01 stages exist'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.search_known_item_candidates(text,uuid,integer,integer,integer,integer,real,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app.search_known_item_candidates(text,uuid,integer,integer,integer,integer,real,integer)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app.search_known_item_candidates(text,uuid,integer,integer,integer,integer,real,integer)',
    'EXECUTE'
  ),
  'known-item stages remain unavailable to public API roles'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'api'
     and p.proname in (
       'search_eligible_places',
       'search_exact_candidates',
       'search_fuzzy_candidates',
       'search_known_item_candidates'
     )),
  0::bigint,
  'SEARCH-01 candidate helpers remain private after SEC-01'
);

select ok(
  to_regclass('app.canonical_entities_published_name_norm_trgm_idx') is not null
  and to_regclass('app.canonical_entities_published_name_ascii_trgm_idx') is not null,
  'canonical trigram indexes support bounded fuzzy retrieval'
);

select is(app.norm_v1_preserving('  Café   Väster  '), 'café väster', 'norm-v1 preserves accents');
select is(app.norm_v1_accentless('  Café   Väster  '), 'cafe vaster', 'norm-v1 derives accentless separately');
select is(
  app.norm_v1_preserving(E'O''Learys–Jönköping'),
  'o learys jönköping',
  'norm-v1 maps apostrophe and dash punctuation to spaces'
);

create temporary table search_fixture_ids (key text primary key, entity_id uuid not null);

insert into search_fixture_ids values
  ('canonical', pg_temp.make_search_place('Café Väster')),
  ('same-a', pg_temp.make_search_place('Samma Namn')),
  ('same-b', pg_temp.make_search_place('Samma Namn')),
  ('alias-qualified', pg_temp.make_search_place('Alias Target')),
  ('collision-a', pg_temp.make_search_place('Collision A')),
  ('collision-b', pg_temp.make_search_place('Collision B')),
  ('canonical-conflict', pg_temp.make_search_place('Central')),
  ('alias-conflict', pg_temp.make_search_place('Other Central Place')),
  ('accentless', pg_temp.make_search_place('Jönköping Café')),
  ('prefix-exact', pg_temp.make_search_place('STUK')),
  ('prefix-other', pg_temp.make_search_place('STUK Café')),
  ('trigram', pg_temp.make_search_place('Tandoori Palace')),
  ('withheld', pg_temp.make_search_place('Hidden Exact', 'WITHHELD')),
  ('closed', pg_temp.make_search_place('Closed Exact', 'DRAFT', 'CLOSED'));

select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'alias-qualified'),
  'Hemliga Namnet'
);
select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'collision-a'),
  'Gemensam'
);
select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'collision-b'),
  'Gemensam'
);
select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'alias-conflict'),
  'Central'
);
select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'prefix-exact'),
  'STUK'
);
select pg_temp.add_verified_alias(
  (select entity_id from search_fixture_ids where key = 'canonical'),
  E'O''Learys–Jönköping'
);

select is(
  (select alias from app.entity_aliases
   where entity_id = (select entity_id from search_fixture_ids where key = 'canonical')
     and alias like 'O%'),
  E'O''Learys–Jönköping',
  'normalization preserves original alias display text'
);

select is(
  (select count(*) from app.search_exact_candidates(
    'Café Väster', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'canonical'
  ) and match_type = 'CANONICAL_EXACT'),
  1::bigint,
  'eligible accent-preserving canonical exact is returned'
);
select ok(
  (select protected and protection_class = 'PROTECTED_CANONICAL_EXACT'
   from app.search_exact_candidates(
     'Café Väster', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'canonical'
   ) and match_type = 'CANONICAL_EXACT'),
  'canonical exact is protected'
);
select is(
  (select count(*) from app.search_exact_candidates(
    'Cafe Vaster', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'canonical'
  ) and match_type = 'CANONICAL_EXACT'),
  0::bigint,
  'canonical exact remains accent-preserving'
);
select is(
  (select canonical_name from app.canonical_entities where id = (
    select entity_id from search_fixture_ids where key = 'canonical'
  )),
  'Café Väster',
  'canonical display name remains unchanged'
);

select is(
  (select count(*) from app.search_exact_candidates(
    'Samma Namn', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'CANONICAL_EXACT'),
  2::bigint,
  'same-name eligible canonical entities are both returned'
);
select ok(
  (select bool_and(protected) from app.search_exact_candidates(
    'Samma Namn', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'CANONICAL_EXACT'),
  'same-name canonical exact entities are both protected'
);
select is(
  (select count(distinct canonical_entity_id) from app.search_exact_candidates(
    'Samma Namn', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'CANONICAL_EXACT'),
  2::bigint,
  'same-name candidates preserve distinct canonical IDs'
);

select is(
  (select count(*) from app.search_exact_candidates(
    'Hemliga Namnet', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'alias-qualified'
  ) and match_type = 'VERIFIED_ALIAS_EXACT'),
  1::bigint,
  'unique verified alias exact is returned'
);
select ok(
  (select protected and alias_qualification_reason = 'QUALIFIED'
   from app.search_exact_candidates(
     'Hemliga Namnet', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'alias-qualified'
   )),
  'unique non-conflicting verified alias is protected'
);

select is(
  (select count(*) from app.search_exact_candidates(
    'Gemensam', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'VERIFIED_ALIAS_EXACT'),
  2::bigint,
  'colliding verified alias retains both ordinary evidence rows'
);
select ok(
  (select bool_and(not protected) from app.search_exact_candidates(
    'Gemensam', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'VERIFIED_ALIAS_EXACT'),
  'colliding alias gives neither entity protection'
);
select ok(
  (select bool_and(alias_qualification_reason = 'AMBIGUOUS_ALIAS')
   from app.search_exact_candidates(
     'Gemensam', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where match_type = 'VERIFIED_ALIAS_EXACT'),
  'alias collision is diagnostically visible'
);

select ok(
  (select protected and match_type = 'CANONICAL_EXACT'
   from app.search_exact_candidates(
     'Central', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'canonical-conflict'
   )),
  'canonical name wins protected exact in alias conflict'
);
select ok(
  (select not protected
   from app.search_exact_candidates(
     'Central', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'alias-conflict'
   )),
  'conflicting verified alias is not protected'
);
select is(
  (select alias_qualification_reason
   from app.search_exact_candidates(
     'Central', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'alias-conflict'
   )),
  'CANONICAL_NAME_CONFLICT',
  'alias/canonical conflict reason is diagnostic'
);

select is(
  (select count(*) from app.search_fuzzy_candidates(
    'Jonkoping Cafe', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'accentless'
  ) and match_type = 'ACCENTLESS_EXACT'),
  1::bigint,
  'accentless-only equality retrieves the candidate'
);
select is(
  (select match_type from app.search_known_item_candidates(
    'Jonkoping Cafe', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'accentless'
  )),
  'ACCENTLESS_EXACT',
  'accentless-only candidate keeps its ordinary match type'
);
select ok(
  (select not protected from app.search_known_item_candidates(
    'Jonkoping Cafe', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'accentless'
  )),
  'accentless exact is never protected'
);

select ok(
  (select protected and match_type = 'CANONICAL_EXACT'
   from app.search_known_item_candidates(
     'STUK', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
   ) where canonical_entity_id = (
     select entity_id from search_fixture_ids where key = 'prefix-exact'
   )),
  'canonical exact remains stronger than prefix evidence'
);
select is(
  (select match_type from app.search_known_item_candidates(
    'STUK', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'prefix-other'
  )),
  'PREFIX',
  'longer completion is a prefix candidate'
);
select ok(
  (select not protected from app.search_known_item_candidates(
    'STUK', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'prefix-other'
  )),
  'prefix candidate is ordinary evidence'
);
select is(
  (select count(*) from app.search_fuzzy_candidates(
    'st', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'PREFIX'),
  0::bigint,
  'too-short prefix is guarded'
);

select is(
  (select count(*) from app.search_fuzzy_candidates(
    'Tandoor Palace', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'trigram'
  ) and match_type = 'TRIGRAM'),
  1::bigint,
  'one-character typo retrieves the intended trigram candidate'
);
select is(
  (select count(*) from app.search_fuzzy_candidates(
    'Tandoroi Palace', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'trigram'
  ) and match_type = 'TRIGRAM'),
  1::bigint,
  'transposition retrieves the intended trigram candidate'
);
select ok(
  (select not protected from app.search_fuzzy_candidates(
    'Tandoor Palace', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'trigram'
  ) and match_type = 'TRIGRAM'),
  'trigram evidence is never protected'
);
select ok(
  (select count(*) <= 1 from app.search_fuzzy_candidates(
    'Tandoor Palace', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    20, 3, 20, 4, 0.3, 1
  ) where match_type = 'TRIGRAM'),
  'trigram candidate set respects its configured cap'
);
select is(
  (select count(*) from app.search_fuzzy_candidates(
    'a', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type in ('PREFIX', 'TRIGRAM')),
  0::bigint,
  'short generic query cannot produce fuzzy noise'
);

do $$
declare
  survivor_id uuid := pg_temp.make_search_place('Merge Survivor', 'DRAFT');
  merged_id uuid := pg_temp.make_search_place('Merged Exact', 'DRAFT');
begin
  update app.canonical_entities
  set publication_status = 'MERGED', merged_into_id = survivor_id
  where id = merged_id;
  insert into search_fixture_ids values ('merged', merged_id);
end;
$$;

insert into app.geographic_scopes (
  id, slug, name_en, name_sv, timezone, country_code, is_active
) values (
  '51000000-0000-0000-0000-000000000001', 'search-other-scope',
  'Other scope', 'Annan omfattning', 'Europe/Stockholm', 'SE', true
);
insert into app.geographic_scope_boundaries (
  id, scope_id, version, boundary, source_name, source_url, licence,
  attribution, source_checksum, effective_from, is_active
) values (
  '51000000-0000-0000-0000-000000000002',
  '51000000-0000-0000-0000-000000000001', 'search-test-v1',
  st_geomfromtext(
    'MULTIPOLYGON(((14.0 57.7,14.3 57.7,14.3 57.9,14.0 57.9,14.0 57.7)))',
    4326
  ),
  'SEARCH-01 test', 'https://example.invalid/search-01', 'TEST', 'TEST',
  repeat('5', 64), now(), true
);
insert into search_fixture_ids values (
  'other-scope',
  pg_temp.make_search_place(
    'Other Scope Exact', 'PUBLISHED', 'UNKNOWN',
    '51000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000002'
  )
);

select is(
  (select count(*) from app.search_known_item_candidates(
    'Hidden Exact', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  0::bigint,
  'WITHHELD exact candidate is absent'
);
select is(
  (select count(*) from app.search_known_item_candidates(
    'Merged Exact', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  0::bigint,
  'MERGED exact candidate is absent'
);
select is(
  (select count(*) from app.search_known_item_candidates(
    'Closed Exact', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  0::bigint,
  'CLOSED Place exact candidate is absent'
);
select is(
  (select count(*) from app.search_known_item_candidates(
    'Other Scope Exact', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  )),
  0::bigint,
  'out-of-scope exact candidate is absent'
);

select is(
  (select count(*) from app.search_known_item_candidates(
    'STUK', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where canonical_entity_id = (
    select entity_id from search_fixture_ids where key = 'prefix-exact'
  )),
  1::bigint,
  'combined helper deduplicates multiple evidence paths by canonical ID'
);
select is(
  (select count(*) from app.search_known_item_candidates(
    'Samma Namn', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'
  ) where match_type = 'CANONICAL_EXACT'),
  2::bigint,
  'combined helper does not collapse different same-name canonical IDs'
);

select is(
  (select alias_norm from app.entity_aliases
   where entity_id = (select entity_id from search_fixture_ids where key = 'canonical')
     and alias like 'O%'),
  'o learys jönköping',
  'alias preserving normalization uses norm-v1'
);
select is(
  (select alias_ascii from app.entity_aliases
   where entity_id = (select entity_id from search_fixture_ids where key = 'canonical')
     and alias like 'O%'),
  'o learys jonkoping',
  'alias accentless normalization remains separate'
);

select throws_ok(
  $$select * from app.search_fuzzy_candidates(
    'invalid', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    20, 0, 20, 4, 0.3, 20
  )$$,
  '22023', 'fuzzy candidate bounds are invalid',
  'invalid fuzzy bounds fail instead of scanning'
);
select ok(
  (select count(*) <= 1 from app.search_exact_candidates(
    'Samma Namn', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', 1
  )),
  'exact candidate set respects its configured cap'
);

select * from finish();
rollback;
