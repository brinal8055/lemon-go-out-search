begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(33);

select has_table('app', 'search_documents', 'search documents table exists');
select has_table('app', 'embeddings', 'embeddings table exists');
select has_table('app', 'search_configs', 'versioned search config table exists');

insert into app.search_configs (
  version, config_checksum, is_active,
  prefix_min_length, trigram_min_length, trigram_threshold,
  exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
  rrf_k, semantic_enabled,
  embedding_provider, embedding_model, embedding_revision, embedding_dimension,
  embedding_timeout_ms, semantic_trigger_terms, event_horizon_days,
  event_freshness_by_source, radius_cap_m, noncollapse_enabled, broad_terms,
  taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
  chain_repetition_cap, event_venue_repetition_cap, activated_at, created_by
) values (
  'db-01c-v1', repeat('1', 64), true,
  2, 3, 0.3,
  20, 20, 20, 20, 20, 20, 20,
  60, true,
  'test-provider', 'test-model', 'test-revision', 3,
  700, array['broad'], 30,
  '{"db-01c-source":{"toleranceHours":1,"nearTermHours":2,"refreshTargetHours":3}}',
  10000, true, array['occasion'],
  2, 0.8, 2, 1, 1, now(), 'db-01c-test'
);

select lives_ok(
  $$
    insert into app.canonical_entities (
      id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii
    ) values (
      '20000000-0000-0000-0000-000000000001', 'PLACE',
      'DB-01C Place', 'db-01c place', 'db-01c place'
    )
  $$,
  'projection fixture canonical entity is accepted'
);
select lives_ok(
  $$
    insert into app.places (entity_id)
    values ('20000000-0000-0000-0000-000000000001')
  $$,
  'projection fixture matching Place subtype is accepted'
);

insert into app.search_documents (
  id, entity_id, document_version, template_version, content_hash,
  display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
  facts_text, description_text, embedding_text, fts, generated_at
) values (
  '20000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000001',
  'document-v1', 'template-v1', repeat('a', 64),
  'DB-01C Place', 'DB-01C Place', '', 'Food', 'Mat',
  'address', 'factual description', 'embedding text',
  setweight(to_tsvector('simple', 'DB-01C Place'), 'A'), now()
);

select ok(
  (select fts @@ to_tsquery('simple', 'db-01c') from app.search_documents where id = '20000000-0000-0000-0000-000000000101'),
  'SearchDocument FTS representation is structurally available'
);
select throws_ok(
  $$
    insert into app.search_documents (
      entity_id, document_version, template_version, content_hash,
      display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
      facts_text, description_text, embedding_text, fts, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000001',
      'document-v2', 'template-v1', repeat('a', 64),
      'DB-01C Place', 'DB-01C Place', '', 'Food', 'Mat',
      'address', 'factual description', 'embedding text', to_tsvector('simple', 'duplicate'), now()
    )
  $$,
  '23505', null,
  'SearchDocument entity/template/content identity is unique'
);
select throws_ok(
  $$
    insert into app.search_documents (
      entity_id, document_version, template_version, content_hash,
      display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
      facts_text, description_text, embedding_text, fts, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000001',
      'document-v2', 'template-v2', repeat('b', 64),
      'DB-01C Place', 'DB-01C Place', '', 'Food', 'Mat',
      'address', 'factual description', 'embedding text', to_tsvector('simple', 'second'), now()
    )
  $$,
  '23505', null,
  'only one active SearchDocument is allowed per entity'
);
select lives_ok(
  $$
    insert into app.search_documents (
      entity_id, document_version, template_version, content_hash,
      display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
      facts_text, description_text, embedding_text, fts, generated_at, is_active
    ) values (
      '20000000-0000-0000-0000-000000000001',
      'document-v2', 'template-v2', repeat('b', 64),
      'DB-01C Place', 'DB-01C Place', '', 'Food', 'Mat',
      'address', 'factual description', 'embedding text', to_tsvector('simple', 'historical'), now(), false
    )
  $$,
  'inactive historical SearchDocument version is retained'
);

select lives_ok(
  $$
    insert into app.embeddings (
      id, search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000201',
      '20000000-0000-0000-0000-000000000101',
      '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, '[0.1,0.2,0.3]',
      repeat('a', 64), 'READY', 'ready-a1', now(), now()
    )
  $$,
  'valid READY embedding is accepted'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, repeat('a', 64), 'READY', 'ready-no-vector', now(), now()
    )
  $$,
  '23514', null,
  'READY embedding requires a vector'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, '[0.1,0.2,0.3]', repeat('a', 64), 'READY', 'ready-no-time', now()
    )
  $$,
  '23514', null,
  'READY embedding requires generated time'
);
select lives_ok(
  $$
    insert into app.embeddings (
      id, search_document_id, entity_id, provider, model, model_revision,
      dimension, document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '20000000-0000-0000-0000-000000000202',
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, repeat('a', 64),
      'FAILED', 'failed-a1', now(), 'TIMEOUT', 'upstream_timeout'
    )
  $$,
  'valid FAILED embedding is accepted'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, '[0.1,0.2,0.3]', repeat('a', 64),
      'FAILED', 'failed-with-vector', now(), 'TIMEOUT', 'upstream_timeout'
    )
  $$,
  '23514', null,
  'FAILED embedding cannot retain a vector'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, document_hash, status, attempt_key, attempted_at, generated_at, error_class, error_code
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, repeat('a', 64),
      'FAILED', 'failed-with-time', now(), now(), 'TIMEOUT', 'upstream_timeout'
    )
  $$,
  '23514', null,
  'FAILED embedding cannot retain generated time'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, repeat('a', 64),
      'FAILED', 'failed-a1', now(), 'TIMEOUT', 'upstream_timeout'
    )
  $$,
  '23505', null,
  'embedding retry requires a new attempt key'
);
select lives_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, repeat('a', 64),
      'FAILED', 'failed-a2', now(), 'TIMEOUT', 'upstream_timeout'
    )
  $$,
  'retry preserves the failed attempt as a separate row'
);
select lives_ok(
  $$
    update app.embeddings
    set status = 'STALE', stale_reason = 'document superseded'
    where id = '20000000-0000-0000-0000-000000000201'
  $$,
  'READY embedding may become STALE'
);
select ok(
  (select embedding is not null and generated_at is not null and stale_reason = 'document superseded'
   from app.embeddings where id = '20000000-0000-0000-0000-000000000201'),
  'STALE retains its vector and original generated time'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at, stale_reason
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, '[0.1,0.2,0.3]', repeat('a', 64),
      'STALE', 'stale-direct', now(), now(), 'not allowed'
    )
  $$,
  '23514', null,
  'direct STALE embedding insertion is rejected'
);
select throws_ok(
  $$
    update app.embeddings
    set status = 'READY', embedding = '[0.1,0.2,0.3]', generated_at = now(), error_class = null, error_code = null
    where id = '20000000-0000-0000-0000-000000000202'
  $$,
  '55000', null,
  'FAILED embedding cannot become READY'
);
select throws_ok(
  $$
    update app.embeddings
    set status = 'STALE', embedding = '[0.1,0.2,0.3]', generated_at = now(), stale_reason = 'bad transition', error_class = null, error_code = null
    where id = '20000000-0000-0000-0000-000000000202'
  $$,
  '55000', null,
  'FAILED embedding cannot become STALE'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 2, '[0.1,0.2,0.3]', repeat('a', 64), 'READY', 'bad-dimension', now(), now()
    )
  $$,
  '23514', null,
  'embedding dimension must match its retained model contract'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'wrong-model', 'test-revision', 3, '[0.1,0.2,0.3]', repeat('a', 64), 'READY', 'bad-model', now(), now()
    )
  $$,
  '23514', null,
  'embedding model must match a retained and active configuration contract'
);
select throws_ok(
  $$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '20000000-0000-0000-0000-000000000101', '20000000-0000-0000-0000-000000000001',
      'test-provider', 'test-model', 'test-revision', 3, '[0.1,0.2,0.3]', repeat('b', 64), 'READY', 'bad-document-hash', now(), now()
    )
  $$,
  '23514', null,
  'embedding document hash must match its SearchDocument'
);
select is_empty(
  $$
    select 1
    from pg_indexes
    where schemaname = 'app'
      and tablename = 'embeddings'
      and indexdef ~* '\\m(hnsw|ivfflat)\\M'
  $$,
  'no ANN index exists for embeddings'
);

select throws_ok(
  $$
    insert into app.search_configs (
      version, config_checksum, is_active,
      prefix_min_length, trigram_min_length, trigram_threshold,
      exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
      rrf_k, semantic_enabled, embedding_provider, embedding_model, embedding_revision,
      embedding_dimension, embedding_timeout_ms, event_horizon_days, event_freshness_by_source,
      radius_cap_m, noncollapse_enabled, taxonomy_group_depth, comparable_rrf_ratio,
      top_k_group_cap, chain_repetition_cap, event_venue_repetition_cap, activated_at, created_by
    ) values (
      'db-01c-v2', repeat('2', 64), true,
      2, 3, 0.3, 20, 20, 20, 20, 20, 20, 20,
      60, true, 'other', 'other', 'other', 3, 700, 30,
      '{}', 10000, true, 2, 0.8, 2, 1, 1, now(), 'db-01c-test'
    )
  $$,
  '23505', null,
  'only one search configuration may be active'
);
select throws_ok(
  $$
    update app.search_configs
    set trigram_threshold = 1.1
    where version = 'db-01c-v1'
  $$,
  '23514', null,
  'out-of-range trigram threshold is rejected'
);
select throws_ok(
  $$
    update app.search_configs
    set event_freshness_by_source = '{"source":{"toleranceHours":1}}'
    where version = 'db-01c-v1'
  $$,
  '23514', null,
  'malformed event freshness shape is rejected'
);
select ok(
  (select is_active and activated_at is not null from app.search_configs where version = 'db-01c-v1'),
  'valid versioned search configuration is retained as current'
);

select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'app.search_documents'::regclass, 'app.embeddings'::regclass, 'app.search_configs'::regclass
  )),
  'RLS is enabled on every DB-01C private table'
);
select ok(
  not has_schema_privilege('anon', 'app', 'USAGE')
    and not has_schema_privilege('authenticated', 'app', 'USAGE')
    and not has_table_privilege('anon', 'app.search_documents', 'SELECT')
    and not has_table_privilege('authenticated', 'app.embeddings', 'SELECT')
    and not has_table_privilege('service_role', 'app.search_configs', 'SELECT'),
  'DB-01C tables remain private to Data API roles'
);
select is(
  (select count(*) from information_schema.tables where table_schema = 'api'),
  0::bigint,
  'DB-01C exposes no relation through the API schema'
);

select * from finish();
rollback;
