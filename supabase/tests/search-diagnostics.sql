begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(37);

grant lemon_evaluation to postgres with set true;

create temporary table diagnostic_baseline as
select count(*)::bigint as search_document_count from app.search_documents;

create function pg_temp.make_diagnostic_place(
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
    'Jönköping', 'ACTIVE'
  );
end;
$$;

create function pg_temp.add_diagnostic_document(
  entity_id uuid,
  names text,
  facts text default '',
  direct_taxonomy text default '',
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
    entity_id, document_version, template_version, content_hash,
    display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
    facts_text, description_text, event_context_text, embedding_text, fts,
    generated_at, is_active
  ) values (
    entity_id, 'search-document-v1', 'lexical-embedding-template-v1', deterministic_hash,
    names, names, '', direct_taxonomy, direct_taxonomy, facts, description, '',
    concat_ws(' ', names, facts, direct_taxonomy, description),
    app.build_search_document_fts(
      names, '', direct_taxonomy, direct_taxonomy, direct_taxonomy, facts,
      '', '', '', '', description
    ),
    '2026-08-14T00:00:00Z', active
  );
end;
$$;

select ok(
  to_regprocedure('diagnostic.explain_search_v1(jsonb,uuid)') is not null,
  'the frozen restricted diagnostic function exists'
);
select is(
  (select rolname
   from pg_proc
   join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   join pg_roles on pg_roles.oid = pg_proc.proowner
   where pg_namespace.nspname = 'diagnostic' and pg_proc.proname = 'explain_search_v1'),
  'lemon_diagnostic_owner',
  'diagnostic function has a dedicated non-login owner'
);
select ok(
  (select prosecdef and proconfig = array['search_path=""']
   from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'diagnostic' and pg_proc.proname = 'explain_search_v1'),
  'diagnostic function is SECURITY DEFINER with an empty search path'
);
select ok(
  (select not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
   from pg_roles where rolname = 'lemon_diagnostic_owner'),
  'diagnostic owner is non-login, NOINHERIT, non-superuser, and subject to RLS'
);
select ok(
  has_function_privilege('lemon_evaluation', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE')
  and not has_function_privilege('public', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE')
  and not has_function_privilege('lemon_api_owner', 'diagnostic.explain_search_v1(jsonb,uuid)', 'EXECUTE'),
  'only the restricted evaluation role may execute diagnostics'
);
select ok(
  not has_table_privilege('lemon_evaluation', 'app.search_documents', 'SELECT')
  and not has_table_privilege('lemon_evaluation', 'app.source_record_versions', 'SELECT')
  and not has_table_privilege('lemon_diagnostic_owner', 'app.source_record_versions', 'SELECT'),
  'diagnostic roles have no direct SearchDocument or raw source evidence access'
);

select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000001', 'Diagnostic Exact'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000001', 'Diagnostic Exact',
  description => 'TOP SECRET DOCUMENT TEXT'
);
insert into app.embeddings (
  search_document_id, entity_id, provider, model, model_revision, dimension,
  embedding, document_hash, status, attempt_key, attempted_at, generated_at
)
select document.id, document.entity_id, 'voyage', 'voyage-4',
       'voyage-4-preflight-v1', 1024,
       ('[1,' || array_to_string(array_fill(0::real, array[1023]), ',') || ']')::extensions.vector,
       document.content_hash, 'READY', 'diagnostic-semantic-ready',
       '2026-08-15T00:00:00Z', '2026-08-15T00:00:01Z'
from app.search_documents as document
where document.entity_id = 'd1000000-0000-4000-8000-000000000001' and document.is_active;
select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000002', 'Alias Venue'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000002', 'Alias Venue'
);
insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind,
  verified, verified_by, verified_at
) values (
  'd1000000-0000-4000-8000-000000000002', 'Secret Alias', '', '', 'und', 'MANUAL',
  true, 'DIAG-01-TEST', now()
);

select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000003', 'Collision One'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000003', 'Collision One'
);
select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000004', 'Collision Two'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000004', 'Collision Two'
);
insert into app.entity_aliases (
  entity_id, alias, alias_norm, alias_ascii, language, kind,
  verified, verified_by, verified_at
) values
  ('d1000000-0000-4000-8000-000000000003', 'Shared Alias', '', '', 'und', 'MANUAL', true, 'DIAG-01-TEST', now()),
  ('d1000000-0000-4000-8000-000000000004', 'Shared Alias', '', '', 'und', 'MANUAL', true, 'DIAG-01-TEST', now());

select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000005', 'Lexical Target'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000005', 'Lexical Target', facts => 'hidden garden'
);
select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000006', 'Pizza Diagnostic'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000006', 'Pizza Diagnostic', direct_taxonomy => 'Pizza'
);
insert into app.entity_taxonomy_memberships (
  entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
) values (
  'd1000000-0000-4000-8000-000000000006',
  '63d2b4df-0fd9-5296-bab2-1cf5fd457cbc',
  'MANUAL', 'DIAG-01 deterministic fixture', 'DIAG-01-TEST'
);
select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000007', 'Inactive Document Target'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000007', 'Inactive Document Target',
  facts => 'inactivelexical', active => false
);
select pg_temp.make_diagnostic_place(
  'd1000000-0000-4000-8000-000000000008', 'Withheld Target', 'WITHHELD'
);
select pg_temp.add_diagnostic_document(
  'd1000000-0000-4000-8000-000000000008', 'Withheld Target'
);

select pg_temp.make_diagnostic_place(
  ('d2000000-0000-4000-8000-' || lpad(candidate::text, 12, '0'))::uuid,
  'Discovery Candidate ' || candidate
)
from generate_series(1, 7) as candidate;
select pg_temp.add_diagnostic_document(
  ('d2000000-0000-4000-8000-' || lpad(candidate::text, 12, '0'))::uuid,
  'Discovery Candidate ' || candidate,
  facts => 'common discovery'
)
from generate_series(1, 7) as candidate;

grant lemon_diagnostic_owner to postgres with set true;
set local role lemon_diagnostic_owner;
grant execute on function diagnostic.explain_search_v1(jsonb, uuid) to postgres;
reset role;

select is(
  diagnostic.explain_search_v1(
    '{"query":"missing","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000009999'
  )#>>'{eligibilityFailureReason}',
  'ENTITY_NOT_FOUND',
  'a missing entity is attributed precisely'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Withheld Target","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000008'
  )#>>'{eligibilityFailureReason}',
  'PUBLICATION_NOT_PUBLISHED',
  'an ineligible entity reports its publication failure reason'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6","taxonomyNodeId":"63d2b4df-0fd9-5296-bab2-1cf5fd457cbc"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{eligibilityFailureReason}',
  'TAXONOMY_FILTER_MISMATCH',
  'hard taxonomy-filter failure is distinguishable from ranking'
);
select ok(
  (diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{exactQualification,canonical,protected}')::boolean,
  'canonical exact protection qualification is visible'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Secret Alias","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000002'
  )#>>'{exactQualification,verifiedAlias,qualificationReason}',
  'QUALIFIED',
  'qualified verified alias reason is visible'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Shared Alias","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000003'
  )#>>'{exactQualification,verifiedAlias,qualificationReason}',
  'AMBIGUOUS_ALIAS',
  'alias collision non-qualification is visible'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,taxonomy,present}',
  'false',
  'absence from an executed candidate stage is explicit'
);
select ok(
  (diagnostic.explain_search_v1(
    '{"query":"hidden garden","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000005'
  )#>>'{stages,lexical,rank}')::integer >= 1,
  'lexical stage presence includes its rank'
);
select ok(
  (diagnostic.explain_search_v1(
    '{"query":"Pizza","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000006'
  )#>>'{stages,taxonomy,direct}')::boolean,
  'taxonomy stage presence includes directness'
);
select ok(
  jsonb_array_length(diagnostic.explain_search_v1(
    '{"query":"Pizza","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000006'
  )#>'{candidateUnion,stageEvidence}') >= 2,
  'multiple participating stages remain visible at the union'
);
select ok(
  (diagnostic.explain_search_v1(
    '{"query":"Pizza","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000006'
  )#>>'{candidateUnion,stagePresenceImpliesUnion}')::boolean,
  'a present implemented stage always reaches the canonical union'
);

select is(
  diagnostic.explain_search_v1(
    '{"query":"common discovery","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd2000000-0000-4000-8000-000000000007'
  )#>>'{reasonCodes,0}',
  'OUTSIDE_TOP_5',
  'union candidate outside top five is attributed to provisional rank'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"common discovery","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd2000000-0000-4000-8000-000000000001'
  )#>>'{reasonCodes,0}',
  'TOP_5',
  'candidate inside top five is identified'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"inactivelexical","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000007'
  )#>>'{stages,lexical,absenceReason}',
  'SEARCH_DOCUMENT_NOT_ACTIVE',
  'inactive SearchDocument explains lexical absence'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"inactivelexical","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000007'
  )#>>'{versions,searchDocument,status}',
  'INACTIVE',
  'inactive SearchDocument version metadata remains visible'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{versions,searchConfigVersion}',
  'sem-01-query-v1',
  'active search configuration version is visible'
);
select ok(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{versions,searchDocument,documentVersion}' = 'search-document-v1'
  and diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{versions,searchDocument,templateVersion}' = 'lexical-embedding-template-v1',
  'active SearchDocument version and template are visible'
);
select ok(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,event,status}' = 'NOT_IMPLEMENTED'
  and diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,semantic,status}' = 'SKIPPED'
  and diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,rrf,status}' = 'NOT_IMPLEMENTED',
  'semantic skip is explicit while later RRF remains NOT_IMPLEMENTED'
);
select ok(
  (diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object(
        'shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY',
        'attempted', true, 'success', true, 'degraded', false
      )
    ),
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,semantic,present}')::boolean
  and (diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object('shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY')
    ),
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{stages,semantic,rank}')::integer = 1,
  'restricted diagnostics expose exact semantic stage presence and rank'
);
select ok(
  diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object('shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY')
    ),
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{versions,embedding,provider}' = 'voyage'
  and diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object('shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY')
    ),
    'd1000000-0000-4000-8000-000000000001'
  )#>>'{versions,embedding,queryTemplateVersion}' = 'semantic-query-template-v1',
  'restricted diagnostics pin the active semantic contract and query template'
);
select ok(
  (diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object('shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY')
    ),
    'd1000000-0000-4000-8000-000000000001'
  ) ? 'queryVector') = false
  and diagnostic.explain_search_v1(
    jsonb_build_object(
      'query', 'things to do',
      'scopeId', 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      'queryVector', to_jsonb(array[1::real] || array_fill(0::real, array[1023])),
      'semantic', jsonb_build_object('shouldEmbed', true, 'shouldEmbedReason', 'BROAD_DISCOVERY')
    ),
    'd1000000-0000-4000-8000-000000000001'
  )::text not like '%diagnostic-semantic-ready%',
  'restricted diagnostics expose neither vectors nor attempt identity'
);
select is(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  ),
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  ),
  'repeated diagnostics are byte-deterministic'
);
select ok(
  diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )::text not like '%TOP SECRET DOCUMENT TEXT%'
  and diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )::text not like '%payload%',
  'diagnostic output contains no SearchDocument text or raw payload'
);

set local role lemon_evaluation;
select diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  );
reset role;
select pass('restricted evaluation role can execute the diagnostic');

set local role service_role;
select throws_ok(
  $$select diagnostic.explain_search_v1(
    '{"query":"Diagnostic Exact","scopeId":"a4b19b09-b272-5748-80ef-2c91d9d33ca6"}',
    'd1000000-0000-4000-8000-000000000001'
  )$$,
  '42501', null,
  'normal API service role cannot execute diagnostics'
);
reset role;

select is(
  (select count(*) from information_schema.tables where table_schema = 'diagnostic'),
  0::bigint,
  'diagnostics persist no production trace tables'
);
select is(
  (select count(*) from pg_proc join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
   where pg_namespace.nspname = 'api'),
  1::bigint,
  'public API still exposes only search_v1'
);
select is(
  (select count(*) from information_schema.parameters
   where specific_schema = 'api' and parameter_mode = 'OUT'),
  18::bigint,
  'public search response shape remains unchanged'
);
select is(
  (select count(*) from app.search_configs where is_active),
  1::bigint,
  'diagnostics do not mutate active search configuration'
);
select is(
  (select count(*) from app.search_documents),
  (select search_document_count + 15 from diagnostic_baseline),
  'diagnostics do not persist or mutate SearchDocuments'
);
select is(
  (select count(*) from information_schema.tables
   where table_schema = 'diagnostic' and table_name like '%trace%'),
  0::bigint,
  'no detailed query trace history is persisted'
);

select * from finish();
rollback;
