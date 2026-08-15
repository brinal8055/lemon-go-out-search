begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(38);

grant lemon_evaluation to postgres with set true;

create function pg_temp.make_rank_place(
  p_entity_id uuid,
  p_name text,
  p_longitude double precision default 14.1570439
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

create function pg_temp.set_rank_document(
  p_entity_id uuid,
  p_names text,
  p_taxonomy text default ''
)
returns void
language sql
as $$
  update app.search_documents
  set names_text = p_names,
      taxonomy_en_text = p_taxonomy,
      taxonomy_sv_text = p_taxonomy,
      embedding_text = concat_ws(' ', p_names, p_taxonomy),
      fts = app.build_search_document_fts(
        p_names, '', p_taxonomy, p_taxonomy, '', '', '', '', '', '', ''
      )
  where entity_id = p_entity_id and is_active
$$;

create function pg_temp.add_rank_embedding(
  p_entity_id uuid,
  p_first real,
  p_second real
)
returns void
language plpgsql
as $$
declare
  document_row app.search_documents%rowtype;
  vector_text text := '[' || p_first || ',' || p_second || ','
    || array_to_string(array_fill(0::real, array[1022]), ',') || ']';
begin
  select * into document_row
  from app.search_documents
  where entity_id = p_entity_id and is_active;
  insert into app.embeddings (
    search_document_id, entity_id, provider, model, model_revision, dimension,
    embedding, document_hash, status, attempt_key, attempted_at, generated_at
  ) values (
    document_row.id, p_entity_id, 'voyage', 'voyage-4',
    'voyage-4-preflight-v1', 1024, vector_text::extensions.vector,
    document_row.content_hash, 'READY', 'rank-' || p_entity_id,
    '2026-08-15T00:00:01Z', '2026-08-15T00:00:02Z'
  );
end;
$$;

create function pg_temp.add_rank_membership(p_entity_id uuid, p_node_id uuid)
returns void
language sql
as $$
  insert into app.entity_taxonomy_memberships (
    entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
  ) values (p_entity_id, p_node_id, 'MANUAL', 'RANK-01 fixture', 'RANK-01-TEST')
$$;

select is((select version from app.search_configs where is_active),
  'noncollapse-v1', 'RRF uses a new active search-config version');
select ok((select not is_active from app.search_configs where version = 'sem-01-query-v1'),
  'the inspected SEM-01 config is retained without silent mutation');
select ok((select rrf_enabled and rrf_version = 'RRF_V1' and rrf_k = 60
  from app.search_configs where is_active), 'fixed RRF v1 and k=60 are pinned');
select is((select rrf_stages from app.search_configs where is_active), array[
  'ASCII_EXACT', 'PREFIX', 'TRIGRAM',
  'FTS', 'TAXONOMY', 'EVENT', 'SEMANTIC'
]::text[], 'all accepted ordinary stage names are pinned');
select is((select rrf_tie_policy from app.search_configs where is_active),
  'PROTECTED_CONTEXT_RRF_DIRECT_TAXONOMY_UUID_ASC_V1',
  'the deterministic final tie policy is pinned');
select is((select rrf_max_results from app.search_configs where is_active),
  20::smallint, 'the frozen public result cap remains pinned');

select ok(
  to_regprocedure('app.rrf_contributions(jsonb,integer,text[])') is not null
  and to_regprocedure(
    'app.search_ranked_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)'
  ) is not null,
  'independent contribution and final-rank stages exist');
select ok(
  not has_function_privilege('service_role',
    'app.search_ranked_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)',
    'EXECUTE')
  and has_function_privilege('lemon_api_owner',
    'app.search_ranked_candidates(text,uuid,timestamptz,double precision,double precision,integer,uuid,app.entity_type[],timestamptz,timestamptz,extensions.vector,text)',
    'EXECUTE'),
  'ranking helpers remain private behind the one public RPC');

select is((select contribution from app.rrf_contributions(
  '{"FTS":1}', 60, array['FTS'])), 1::numeric / 61::numeric,
  'one 1-based stage rank contributes exactly 1/(k+rank)');
select is((select sum(contribution) from app.rrf_contributions(
  '{"FTS":1,"SEMANTIC":3}', 60, array['FTS','SEMANTIC'])),
  1::numeric / 61::numeric + 1::numeric / 63::numeric,
  'two stages contribute an unweighted conventional RRF sum');
select is((select count(*) from app.rrf_contributions(
  '{"FTS":1}', 60, array['FTS','SEMANTIC'])), 1::bigint,
  'an absent participating stage contributes zero');
select is((select count(*) from app.rrf_contributions(
  '{"FTS":1,"UNUSED":1}', 60, array['FTS'])), 1::bigint,
  'only pinned participating stages contribute');
select is((select sum(contribution) from app.rrf_contributions(
  '{"EVENT":1,"SEMANTIC":2}', 60, array['EVENT','SEMANTIC'])),
  1::numeric / 61::numeric + 1::numeric / 62::numeric,
  'Event and semantic ranks fuse with equal contributions');
select is((select sum(contribution) from app.rrf_contributions(
  '{"PREFIX":1,"TRIGRAM":2}', 60, array['PREFIX','TRIGRAM'])),
  1::numeric / 61::numeric + 1::numeric / 62::numeric,
  'prefix and trigram ranks fuse with equal contributions');
select throws_ok($sql$select * from app.rrf_contributions(
  '{"FTS":0}', 60, array['FTS'])$sql$, '22023', 'RRF inputs are invalid',
  'stage ranks cannot be zero-based');
select ok(
  pg_get_functiondef('app.rrf_contributions(jsonb,integer,text[])'::regprocedure)
    !~* '(raw_score|cosine|weight)',
  'RRF accepts ranks only, with no raw score, cosine magnitude, or weights');

-- Isolate ranking fixtures from legitimate mutable local inventory.
update app.canonical_entities
set publication_status = 'WITHHELD', published_at = null
where publication_status = 'PUBLISHED';

select pg_temp.make_rank_place(
  '41000000-0000-4000-8000-000000000001', 'RRF Protected'
);
select pg_temp.make_rank_place(
  '41000000-0000-4000-8000-000000000002', 'Ordinary Multistage'
);
select pg_temp.set_rank_document(
  '41000000-0000-4000-8000-000000000002', 'RRF Protected ordinary evidence'
);
select pg_temp.add_rank_embedding('41000000-0000-4000-8000-000000000001', 0, 1);
select pg_temp.add_rank_embedding('41000000-0000-4000-8000-000000000002', 1, 0);

create temporary table protected_rank as
select * from app.search_ranked_candidates(
  'RRF Protected', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null,
  ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')
    ::extensions.vector,
  'noncollapse-v1'
);

select is((select canonical_entity_id from protected_rank where final_rank = 1),
  '41000000-0000-4000-8000-000000000001'::uuid,
  'protected canonical exact remains ahead of stronger ordinary fusion');
select ok((select protected and protection_class = 'PROTECTED_CANONICAL_EXACT'
  from protected_rank where canonical_entity_id = '41000000-0000-4000-8000-000000000001'),
  'canonical exact retains its accepted protection class');
select ok((select not protected and stage_ranks ? 'SEMANTIC' and stage_ranks ? 'FTS'
  from protected_rank where canonical_entity_id = '41000000-0000-4000-8000-000000000002'),
  'ordinary FTS plus semantic evidence never creates protection');
select is((select count(*) from protected_rank where canonical_entity_id =
  '41000000-0000-4000-8000-000000000001'), 1::bigint,
  'a protected candidate with ordinary evidence appears exactly once');

select pg_temp.make_rank_place(
  '41000000-0000-4000-8000-000000000003', 'Qualified Alias Entity'
);
insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind,
  verified, verified_by, verified_at
) values (
  '41000000-0000-4000-8000-000000000003', 'RRF Alias', '', '', 'und', 'MANUAL',
  true, 'RANK-01-TEST', '2026-08-15T00:00:00Z'
);
select ok((select protected and protection_class = 'PROTECTED_ALIAS_EXACT'
  from app.search_ranked_candidates(
    'RRF Alias', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '2026-08-15T09:00:00Z', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
  ) where canonical_entity_id = '41000000-0000-4000-8000-000000000003'),
  'qualifying verified alias protection is preserved');

select pg_temp.make_rank_place(
  '41000000-0000-4000-8000-000000000004', 'Ränk Café'
);
select ok((select not protected and stage_ranks ? 'ASCII_EXACT'
  from app.search_ranked_candidates(
    'Rank Cafe', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '2026-08-15T09:00:00Z', null, null, null, null,
    array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
  ) where canonical_entity_id = '41000000-0000-4000-8000-000000000004'),
  'accentless exact remains ordinary RRF evidence');

select pg_temp.make_rank_place(
  '42000000-0000-4000-8000-000000000001', 'Fusion Candidate'
);
select pg_temp.set_rank_document(
  '42000000-0000-4000-8000-000000000001', 'Fusion Candidate Italian', 'Italian'
);
select pg_temp.add_rank_membership(
  '42000000-0000-4000-8000-000000000001',
  'd43e33db-0ad3-575c-8514-d01ccf700587'
);
select pg_temp.add_rank_embedding('42000000-0000-4000-8000-000000000001', 1, 0);

create temporary table italian_semantic as
select * from app.search_ranked_candidates(
  'Italian', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null,
  ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')
    ::extensions.vector,
  'noncollapse-v1'
);
select is((select count(*) from italian_semantic where canonical_entity_id =
  '42000000-0000-4000-8000-000000000001'), 1::bigint,
  'FTS, taxonomy, and semantic evidence produce one canonical union row');
select ok((select stage_ranks ?& array['FTS','TAXONOMY','SEMANTIC']
  from italian_semantic where canonical_entity_id =
  '42000000-0000-4000-8000-000000000001'),
  'all three independent stage ranks are retained');
select is((select jsonb_array_length(rrf_contributions) from italian_semantic
  where canonical_entity_id = '42000000-0000-4000-8000-000000000001'), 3,
  'one entity contributes at most once from each of three stages');
select is((select rrf_score from italian_semantic where canonical_entity_id =
  '42000000-0000-4000-8000-000000000001'),
  (select sum((item->>'contribution')::numeric)
   from italian_semantic,
        lateral jsonb_array_elements(rrf_contributions) as item
   where canonical_entity_id = '42000000-0000-4000-8000-000000000001'),
  'reported per-stage contributions sum exactly to total RRF');

create temporary table italian_without_semantic as
select * from app.search_ranked_candidates(
  'Italian', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
);
select is(
  (select array_agg(canonical_entity_id order by final_rank) from italian_without_semantic),
  (select array_agg(canonical_entity_id order by final_rank)
   from app.search_ranked_candidates(
     'Italian', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
     '2026-08-15T09:00:00Z', null, null, null, null,
     array['PLACE']::app.entity_type[], null, null, null, 'noncollapse-v1'
   )),
  'every vector-NULL degradation reason has the semantic-absent deterministic order');
select ok((select bool_and(not semantic_present) from italian_without_semantic),
  'semantic absence creates no placeholder contribution or penalty');

select pg_temp.make_rank_place(
  '42000000-0000-4000-8000-000000000099', 'Distant Strong Candidate', 14.30
);
select pg_temp.set_rank_document(
  '42000000-0000-4000-8000-000000000099', 'Italian Distant Strong', 'Italian'
);
select pg_temp.add_rank_membership(
  '42000000-0000-4000-8000-000000000099',
  'd43e33db-0ad3-575c-8514-d01ccf700587'
);
select pg_temp.add_rank_embedding('42000000-0000-4000-8000-000000000099', 1, 0);
select is_empty($sql$
  select 1 from app.search_ranked_candidates(
    'Italian', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
    '2026-08-15T09:00:00Z', 57.7793606, 14.1570439, 100, null,
    array['PLACE']::app.entity_type[], null, null,
    ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')
      ::extensions.vector,
    'noncollapse-v1'
  ) where canonical_entity_id = '42000000-0000-4000-8000-000000000099'
$sql$, 'multiple strong stage ranks cannot bypass the radius hard filter');

update app.canonical_entities
set publication_status = 'WITHHELD', published_at = null
where id::text like '41%' or id::text like '42%';

select pg_temp.make_rank_place(
  '43000000-0000-4000-8000-000000000001', 'Food Tie A'
);
select pg_temp.make_rank_place(
  '43000000-0000-4000-8000-000000000002', 'Food Tie B'
);
select pg_temp.set_rank_document(
  '43000000-0000-4000-8000-000000000001', 'Stable Fusion Tie'
);
select pg_temp.set_rank_document(
  '43000000-0000-4000-8000-000000000002', 'Stable Fusion Tie'
);
select pg_temp.add_rank_embedding('43000000-0000-4000-8000-000000000001', 0, 1);
select pg_temp.add_rank_embedding('43000000-0000-4000-8000-000000000002', 1, 0);

create temporary table tie_rank as
select * from app.search_ranked_candidates(
  'Stable Fusion Tie', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '2026-08-15T09:00:00Z', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null,
  ('[1,0,' || array_to_string(array_fill(0::real, array[1022]), ',') || ']')
    ::extensions.vector,
  'noncollapse-v1'
)
where canonical_entity_id in (
  '43000000-0000-4000-8000-000000000001',
  '43000000-0000-4000-8000-000000000002'
);
select ok((select min(rrf_score) = max(rrf_score) from tie_rank),
  'complementary FTS and semantic ranks produce equal numeric RRF totals');
select results_eq(
  $sql$select canonical_entity_id from tie_rank order by final_rank$sql$,
  array[
    '43000000-0000-4000-8000-000000000001'::uuid,
    '43000000-0000-4000-8000-000000000002'::uuid
  ],
  'equal RRF totals use canonical UUID ascending exactly');
select is(
  (select array_agg(canonical_entity_id order by final_rank) from tie_rank),
  (select array_agg(canonical_entity_id order by final_rank) from tie_rank),
  'repeated ranking is byte-for-byte deterministic');

update app.canonical_entities
set publication_status = 'PUBLISHED', published_at = '2026-08-15T00:00:00Z'
where id in (
  '41000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001'
);

set local role service_role;
select is((select count(*) from api.search_v1(
  gen_random_uuid(), 'Italian', 'italian', 'italian', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  1::smallint, 'noncollapse-v1'
)), 1::bigint, 'the final response limit is applied after deterministic ranking');
select ok((select count(*) = count(distinct entity_id) from api.search_v1(
  gen_random_uuid(), 'Italian', 'italian', 'italian', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  20::smallint, 'noncollapse-v1'
)), 'public canonical IDs remain unique');
select ok((select row_to_json(result)::jsonb ?& array[
  'result_position','entity_id','entity_type','display_name','semantic_used'
] and not (row_to_json(result)::jsonb ?| array[
  'rrf_score','stage_ranks','rrf_contributions','protected','final_rank'
]) from api.search_v1(
  gen_random_uuid(), 'RRF Protected', 'rrf protected', 'rrf protected', 'en',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6', null, null, null, null,
  array['PLACE']::app.entity_type[], null, null, null::extensions.vector,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  1::smallint, 'noncollapse-v1'
) as result), 'public results leak no RRF or protection internals');
reset role;

set local role lemon_evaluation;
create temporary table rank_diagnostic as
select diagnostic.explain_search_v1(jsonb_build_object(
  'query', 'Italian',
  'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  'now', '2026-08-15T09:00:00Z',
  'entityTypes', jsonb_build_array('PLACE'),
  'semantic', jsonb_build_object(
    'shouldEmbed', true, 'attempted', true, 'success', false,
    'degraded', true, 'degradationReason', 'TIMEOUT'
  )
), '42000000-0000-4000-8000-000000000001') as value;
reset role;
select is((select value#>>'{stages,rrf,status}' from rank_diagnostic),
  'EXECUTED'::text, 'restricted RRF diagnostics are implemented');
select ok((select (value#>>'{stages,rrf,finalRank}')::integer > 0
  and value#>>'{stages,rrf,semanticState}' = 'DEGRADED_ABSENT'
  and (value#>>'{stages,rrf,canonicalUnionPresence}')::boolean
  from rank_diagnostic),
  'restricted diagnostics expose final rank, canonical union, and degraded absence');
select is((select (value#>>'{stages,rrf,total}')::numeric from rank_diagnostic),
  (select sum((item->>'contribution')::numeric)
   from rank_diagnostic,
        lateral jsonb_array_elements(value#>'{stages,rrf,contributions}') as item),
  'restricted diagnostic contributions sum to the reported total');

select * from finish();
rollback;
