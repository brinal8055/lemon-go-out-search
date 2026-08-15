begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(25);

create function pg_temp.make_semantic_place(
  p_entity_id uuid,
  p_name text,
  p_longitude double precision default 14.1570439
)
returns void
language plpgsql
as $$
declare
  document_hash text := replace(p_entity_id::text, '-', '') || replace(p_entity_id::text, '-', '');
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    publication_status, scope_id, scope_boundary_id, published_at
  ) values (
    p_entity_id, 'PLACE', p_name, '', '', 'PUBLISHED',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '0a39b199-4cd5-5358-85de-2c1a5f91a347',
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
    p_name, p_name, '', '', '', '', '', '', p_name,
    app.build_search_document_fts(p_name, '', '', '', '', '', '', '', '', '', ''),
    '2026-08-15T00:00:00Z', true
  );
end;
$$;

create function pg_temp.add_semantic_embedding(
  p_entity_id uuid,
  p_first real,
  p_second real,
  p_status app.embedding_status default 'READY',
  p_revision text default 'voyage-4-preflight-v1'
)
returns void
language plpgsql
as $$
declare
  document_row app.search_documents%rowtype;
  vector_text text := '[' || p_first || ',' || p_second || ','
    || array_to_string(array_fill(0::real, array[1022]), ',') || ']';
begin
  select * into document_row from app.search_documents
  where entity_id = p_entity_id and is_active;
  insert into app.embeddings (
    search_document_id, entity_id, provider, model, model_revision, dimension,
    embedding, document_hash, status, attempt_key, attempted_at, generated_at,
    error_class, error_code
  ) values (
    document_row.id, p_entity_id, 'voyage', 'voyage-4', p_revision, 1024,
    case when p_status = 'READY' then vector_text::extensions.vector else null end,
    document_row.content_hash, p_status, 'semantic-' || p_entity_id,
    '2026-08-15T00:00:01Z',
    case when p_status = 'READY' then '2026-08-15T00:00:02Z'::timestamptz else null end,
    case when p_status = 'FAILED' then 'PROVIDER' else null end,
    case when p_status = 'FAILED' then 'PROVIDER_5XX' else null end
  );
end;
$$;

-- Isolate deterministic ranking assertions from legitimate mutable local inventory.
update app.canonical_entities
set publication_status = 'WITHHELD', published_at = null
where publication_status = 'PUBLISHED';

select pg_temp.make_semantic_place(
  ('31000000-0000-4000-8000-' || lpad(candidate::text, 12, '0'))::uuid,
  'Semantic Eligible ' || candidate
)
from generate_series(1, 35) as candidate;
select pg_temp.add_semantic_embedding(
  ('31000000-0000-4000-8000-' || lpad(candidate::text, 12, '0'))::uuid,
  case when candidate = 1 then 1::real when candidate = 2 then 0.8::real else 0::real end,
  case when candidate = 1 then 0::real when candidate = 2 then 0.6::real else 1::real end
)
from generate_series(1, 35) as candidate;

select pg_temp.make_semantic_place('32000000-0000-4000-8000-000000000001', 'Semantic Failed');
select pg_temp.add_semantic_embedding(
  '32000000-0000-4000-8000-000000000001', 1, 0, 'FAILED'
);
select pg_temp.make_semantic_place('32000000-0000-4000-8000-000000000002', 'Semantic Stale');
select pg_temp.add_semantic_embedding('32000000-0000-4000-8000-000000000002', 1, 0);
update app.embeddings set status = 'STALE', stale_reason = 'DOCUMENT_REPLACED'
where entity_id = '32000000-0000-4000-8000-000000000002';
select pg_temp.make_semantic_place('32000000-0000-4000-8000-000000000004', 'Inactive Document');
select pg_temp.add_semantic_embedding('32000000-0000-4000-8000-000000000004', 1, 0);
update app.search_documents set is_active = false
where entity_id = '32000000-0000-4000-8000-000000000004';
select pg_temp.make_semantic_place('32000000-0000-4000-8000-000000000005', 'Withheld Semantic');
select pg_temp.add_semantic_embedding('32000000-0000-4000-8000-000000000005', 1, 0);
update app.canonical_entities set publication_status = 'WITHHELD', published_at = null
where id = '32000000-0000-4000-8000-000000000005';
select pg_temp.make_semantic_place('32000000-0000-4000-8000-000000000006', 'Merged Semantic');
select pg_temp.add_semantic_embedding('32000000-0000-4000-8000-000000000006', 1, 0);
update app.canonical_entities
set publication_status = 'MERGED', published_at = null,
    merged_into_id = '31000000-0000-4000-8000-000000000001'
where id = '32000000-0000-4000-8000-000000000006';
select pg_temp.make_semantic_place(
  '32000000-0000-4000-8000-000000000007', 'Distant Semantic', 14.30
);
select pg_temp.add_semantic_embedding('32000000-0000-4000-8000-000000000007', 0, 1);

insert into app.entity_taxonomy_memberships (
  entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
) values (
  '31000000-0000-4000-8000-000000000001',
  '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
  'MANUAL', 'SEM-01 fixture', 'SEM-01-TEST'
);

create temporary table semantic_all as
select * from app.search_semantic_candidates(
  ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')::extensions.vector,
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', '2026-08-15T09:00:00Z', 30,
  '{"JONKOPING_EVENT_CALENDAR":{"toleranceHours":48}}',
  null, null, null, null, null, null, array['PLACE']::app.entity_type[],
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
);

select is((select version from app.search_configs where is_active), 'rank-01-rrf-v1',
  'the active semantic config is version-pinned');
select is((select semantic_cap from app.search_configs where is_active), 30::smallint,
  'the semantic candidate cap is 30');
select is((select embedding_timeout_ms from app.search_configs where is_active), 700,
  'the embedding timeout is 700 ms');
select is((select count(*) from semantic_all), 30::bigint,
  'exact semantic candidates are bounded before the union');
select is((select canonical_entity_id from semantic_all where candidate_rank = 1),
  '31000000-0000-4000-8000-000000000001'::uuid,
  'the lowest cosine distance ranks first');
select is((select canonical_entity_id from semantic_all where candidate_rank = 2),
  '31000000-0000-4000-8000-000000000002'::uuid,
  'cosine ordering precedes the UUID tie-break');
select is((select canonical_entity_id from semantic_all where candidate_rank = 3),
  '31000000-0000-4000-8000-000000000003'::uuid,
  'equal cosine distances use canonical UUID order');
select is_empty($sql$select * from app.search_semantic_candidates(
  null, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(), 30, '{}'::jsonb,
  null, null, null, null, null, null, null,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
)$sql$, 'NULL query vector contributes no semantic candidates');
select throws_ok($sql$select * from app.search_semantic_candidates(
  '[1,0,0]'::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(),
  30, '{}'::jsonb, null, null, null, null, null, null, null,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
)$sql$, '22023', 'semantic query vector is invalid', 'wrong-dimensional query vectors fail closed');
select throws_ok(format($sql$select * from app.search_semantic_candidates(
  %L::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(),
  30, '{}'::jsonb, null, null, null, null, null, null, null,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
)$sql$, '[NaN,' || array_to_string(array_fill(0::real, array[1023]), ',') || ']'),
  '22000', 'NaN not allowed in vector', 'NaN query vectors fail closed');
select throws_ok(format($sql$select * from app.search_semantic_candidates(
  %L::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(),
  30, '{}'::jsonb, null, null, null, null, null, null, null,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
)$sql$, '[Infinity,' || array_to_string(array_fill(0::real, array[1023]), ',') || ']'),
  '22000', 'infinite value not allowed in vector', 'Infinity query vectors fail closed');
select is_empty($sql$select * from semantic_all where canonical_entity_id in (
  '32000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000002',
  '32000000-0000-4000-8000-000000000004'
)$sql$, 'FAILED, STALE, and inactive-document embeddings are excluded');
select is_empty(format($sql$select * from app.search_semantic_candidates(
  %L::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(), 30, '{}'::jsonb,
  null, null, null, null, null, null, array['PLACE']::app.entity_type[],
  'voyage', 'voyage-4', 'fixture-other-revision', 1024, 30
)$sql$, '[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']'),
  'a wrong requested revision cannot match READY embeddings');
select is_empty($sql$select * from semantic_all where canonical_entity_id in (
  '32000000-0000-4000-8000-000000000005',
  '32000000-0000-4000-8000-000000000006'
)$sql$, 'withheld and merged entities cannot re-enter through semantic similarity');
select is_empty(format($sql$select * from app.search_semantic_candidates(
  %L::extensions.vector, 'ffffffff-ffff-4fff-8fff-ffffffffffff', now(), 30, '{}'::jsonb,
  null, null, null, null, null, null, array['PLACE']::app.entity_type[],
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 30
)$sql$, '[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']'),
  'out-of-scope high-similarity entities are excluded');
select is_empty(format($sql$select * from app.search_semantic_candidates(
  %L::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(), 30, '{}'::jsonb,
  null, null, 57.7793606, 14.1570439, 100, null, array['PLACE']::app.entity_type[],
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 50
) where canonical_entity_id = '32000000-0000-4000-8000-000000000007'$sql$,
  '[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']'),
  'radius-excluded high-similarity entities are excluded');
select results_eq(format($sql$select canonical_entity_id from app.search_semantic_candidates(
  %L::extensions.vector, 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', now(), 30, '{}'::jsonb,
  null, null, null, null, null, '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
  array['PLACE']::app.entity_type[], 'voyage', 'voyage-4',
  'voyage-4-preflight-v1', 1024, 30
)$sql$, '[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']'),
  array['31000000-0000-4000-8000-000000000001'::uuid],
  'explicit taxonomy filtering is reapplied to semantic candidates');
select is(
  (select count(distinct canonical_entity_id) = count(*) from semantic_all), true,
  'semantic stage canonical IDs are unique');
select ok(
  has_function_privilege('lemon_api_owner',
    'app.search_semantic_candidates(extensions.vector,uuid,timestamptz,integer,jsonb,timestamptz,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],text,text,text,integer,integer)',
    'EXECUTE')
  and not has_function_privilege('service_role',
    'app.search_semantic_candidates(extensions.vector,uuid,timestamptz,integer,jsonb,timestamptz,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],text,text,text,integer,integer)',
    'EXECUTE'),
  'the semantic stage remains private behind api.search_v1');
select is_empty($sql$select 1 from pg_indexes
  where indexdef ~* '\m(hnsw|ivfflat)\M'$sql$, 'no ANN index exists');
select is(
  (select entity_id from api.search_v1(
    '33000000-0000-4000-8000-000000000001', 'quiet rainy evening choice',
    'quiet rainy evening choice', 'quiet rainy evening choice', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null,
    ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 1::smallint, 'rank-01-rrf-v1'
  )),
  '31000000-0000-4000-8000-000000000001'::uuid,
  'a semantic-only eligible candidate reaches the current union');
select ok(
  (select semantic_used from api.search_v1(
    '33000000-0000-4000-8000-000000000002', 'quiet rainy evening choice',
    'quiet rainy evening choice', 'quiet rainy evening choice', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null,
    ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 1::smallint, 'rank-01-rrf-v1'
  )),
  'semantic evidence is retained on the unique union row');
select is(
  (select entity_id from api.search_v1(
    '33000000-0000-4000-8000-000000000003', 'Semantic Eligible 2',
    'semantic eligible 2', 'semantic eligible 2', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null,
    ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 1::smallint, 'rank-01-rrf-v1'
  )),
  '31000000-0000-4000-8000-000000000002'::uuid,
  'protected canonical exact remains ahead of stronger semantic-only similarity');
select ok(
  (select semantic_used from api.search_v1(
    '33000000-0000-4000-8000-000000000004', 'Semantic Eligible 2',
    'semantic eligible 2', 'semantic eligible 2', 'en',
    'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null,
    ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')::extensions.vector,
    'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, 1::smallint, 'rank-01-rrf-v1'
  )),
  'semantic evidence may coexist without creating or displacing exact protection');
select is(
  (select count(*) from information_schema.routines
   where routine_schema = 'app' and routine_name ~* '(rerank|rewrite|router)'),
  0::bigint,
  'semantic retrieval remains free of reranking, rewriting, and query routing');

select * from finish();
rollback;
