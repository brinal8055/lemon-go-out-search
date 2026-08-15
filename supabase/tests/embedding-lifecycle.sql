begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(31);

select is(
  (select version from app.search_configs where is_active),
  'embed-01b-voyage-4-v1',
  'selected EMBED-01B config version is active'
);

select is(
  (select concat_ws('/', embedding_provider, embedding_model, embedding_revision, embedding_dimension)
   from app.search_configs where is_active),
  'voyage/voyage-4/voyage-4-preflight-v1/1024',
  'active config pins the Voyage preflight contract'
);
select ok(
  not (select semantic_enabled from app.search_configs where is_active),
  'embedding preflight does not enable semantic retrieval'
);

insert into app.canonical_entities (
  id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
  publication_status, scope_id, scope_boundary_id, published_at
) values (
  '21000000-0000-0000-0000-000000000001', 'PLACE',
  'Embedding Fixture', 'embedding fixture', 'embedding fixture', 'PUBLISHED',
  'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
  '0a39b199-4cd5-5358-85de-2c1a5f91a347',
  '2026-08-15T00:00:00Z'
);
insert into app.places (entity_id, location, locality, status)
values (
  '21000000-0000-0000-0000-000000000001',
  extensions.st_setsrid(extensions.st_makepoint(14.1570439, 57.7793606), 4326)
    ::extensions.geography,
  'Jönköping',
  'ACTIVE'
);
insert into app.search_documents (
  id, entity_id, document_version, template_version, content_hash,
  display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
  facts_text, description_text, embedding_text, fts, generated_at
) values (
  '21000000-0000-0000-0000-000000000101',
  '21000000-0000-0000-0000-000000000001',
  'search-document-v1', 'lexical-embedding-template-v1', repeat('a', 64),
  'Embedding Fixture', 'Embedding Fixture', '', '', '', '', '', 'Embedding Fixture',
  to_tsvector('simple', 'Embedding Fixture'), '2026-08-15T00:00:00Z'
);

select lives_ok(
  format($sql$
    insert into app.embeddings (
      id, search_document_id, entity_id, provider, model, model_revision,
      dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000201',
      '21000000-0000-0000-0000-000000000101',
      '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-ready-a1', '2026-08-15T00:01:00Z', '2026-08-15T00:02:00Z'
    )
  $sql$,
    '[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']',
    repeat('a', 64)
  ),
  'valid 1024-dimensional READY embedding is accepted'
);
select ok(
  (select embedding is not null and extensions.vector_dims(embedding) = 1024
     and generated_at is not null and error_class is null and stale_reason is null
   from app.embeddings where id = '21000000-0000-0000-0000-000000000201'),
  'READY retains vector, dimension, generation time, and clean error state'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-ready-duplicate', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23505', null,
  'duplicate compatible READY contract is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-wrong-hash', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']', repeat('b', 64)),
  '23514', null,
  'document hash mismatch is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'other', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-wrong-provider', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23514', null,
  'provider mismatch is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'other', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-wrong-model', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23514', null,
  'model mismatch is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'other', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-wrong-revision', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23514', null,
  'revision mismatch is rejected'
);
select throws_ok(
  $sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1023,
      ('[' || array_to_string(array_fill(0.02::real, array[1023]), ',') || ']')::extensions.vector,
      repeat('a', 64), 'READY', 'embed-wrong-dimension', now(), now()
    )
  $sql$,
  '23514', null,
  'declared dimension mismatch is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-zero', now(), now()
    )
  $sql$, '[' || array_to_string(array_fill(0::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23514', null,
  'zero-norm READY vector is rejected'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'READY', 'embed-non-finite', now(), now()
    )
  $sql$, '[NaN,' || array_to_string(array_fill(0.01::real, array[1023]), ',') || ']', repeat('a', 64)),
  '22000', null,
  'non-finite READY vector is rejected'
);

select lives_ok(
  $sql$
    insert into app.embeddings (
      id, search_document_id, entity_id, provider, model, model_revision, dimension,
      document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '21000000-0000-0000-0000-000000000202',
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, repeat('a', 64),
      'FAILED', 'embed-failed-a1', '2026-08-15T00:03:00Z', 'TIMEOUT', 'PROVIDER_TIMEOUT'
    )
  $sql$,
  'valid FAILED attempt retains contract and error identity'
);
select ok(
  (select embedding is null and generated_at is null and attempted_at is not null
      and error_class = 'TIMEOUT' and error_code = 'PROVIDER_TIMEOUT' and stale_reason is null
   from app.embeddings where id = '21000000-0000-0000-0000-000000000202'),
  'FAILED has null vector/generated time and complete attempted error identity'
);

delete from app.embeddings
where id = '21000000-0000-0000-0000-000000000201';

select throws_ok(
  $sql$
    update app.embeddings set status = 'READY',
      embedding = ('[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']')::extensions.vector,
      generated_at = now(), error_class = null, error_code = null
    where id = '21000000-0000-0000-0000-000000000202'
  $sql$,
  '55000', null,
  'FAILED to READY is rejected'
);
select throws_ok(
  $sql$
    update app.embeddings set status = 'STALE',
      embedding = ('[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']')::extensions.vector,
      generated_at = now(), error_class = null, error_code = null, stale_reason = 'invalid'
    where id = '21000000-0000-0000-0000-000000000202'
  $sql$,
  '55000', null,
  'FAILED to STALE is rejected'
);

insert into app.embeddings (
  id, search_document_id, entity_id, provider, model, model_revision,
  dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
) values (
  '21000000-0000-0000-0000-000000000201',
  '21000000-0000-0000-0000-000000000101',
  '21000000-0000-0000-0000-000000000001',
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  ('[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']')::extensions.vector,
  repeat('a', 64), 'READY', 'embed-ready-a1',
  '2026-08-15T00:01:00Z', '2026-08-15T00:02:00Z'
);

select lives_ok(
  $sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      document_hash, status, attempt_key, attempted_at, error_class, error_code
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, repeat('a', 64),
      'FAILED', 'embed-failed-a2', now(), 'TRANSPORT', 'PROVIDER_TRANSPORT'
    )
  $sql$,
  'retry creates a new FAILED row with a new attempt key'
);
select is(
  (select count(*) from app.embeddings
   where status = 'FAILED' and attempt_key in ('embed-failed-a1', 'embed-failed-a2')),
  2::bigint,
  'retry preserves complete failed attempt history'
);
select lives_ok(
  $sql$
    update app.embeddings set status = 'STALE', stale_reason = 'SEARCH_DOCUMENT_REPLACED'
    where id = '21000000-0000-0000-0000-000000000201'
  $sql$,
  'READY to STALE succeeds'
);
select ok(
  (select embedding is not null and generated_at = '2026-08-15T00:02:00Z'
      and stale_reason = 'SEARCH_DOCUMENT_REPLACED'
   from app.embeddings where id = '21000000-0000-0000-0000-000000000201'),
  'STALE retains vector, generation time, and receives a reason'
);
select is_empty(
  $sql$select 1 from app.embeddings where id = '21000000-0000-0000-0000-000000000201' and status = 'READY'$sql$,
  'STALE is excluded from READY semantic eligibility'
);
select throws_ok(
  format($sql$
    insert into app.embeddings (
      search_document_id, entity_id, provider, model, model_revision, dimension,
      embedding, document_hash, status, attempt_key, attempted_at, generated_at, stale_reason
    ) values (
      '21000000-0000-0000-0000-000000000101', '21000000-0000-0000-0000-000000000001',
      'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024, %L::extensions.vector,
      %L, 'STALE', 'embed-direct-stale', now(), now(), 'invalid'
    )
  $sql$, '[' || array_to_string(array_fill(0.01::real, array[1024]), ',') || ']', repeat('a', 64)),
  '23514', null,
  'direct STALE insert is rejected'
);
select throws_ok(
  $sql$update app.embeddings set status = 'READY', stale_reason = null
       where id = '21000000-0000-0000-0000-000000000201'$sql$,
  '55000', null,
  'STALE to READY is rejected'
);
select throws_ok(
  $sql$update app.embeddings
       set embedding = ('[' || array_to_string(array_fill(0.02::real, array[1024]), ',') || ']')::extensions.vector
       where id = '21000000-0000-0000-0000-000000000201'$sql$,
  '55000', null,
  'STALE vector mutation is rejected'
);

insert into app.embeddings (
  id, search_document_id, entity_id, provider, model, model_revision,
  dimension, embedding, document_hash, status, attempt_key, attempted_at, generated_at
) values (
  '21000000-0000-0000-0000-000000000203',
  '21000000-0000-0000-0000-000000000101',
  '21000000-0000-0000-0000-000000000001',
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  ('[' || array_to_string(array_fill(0.03::real, array[1024]), ',') || ']')::extensions.vector,
  repeat('a', 64), 'READY', 'embed-contract-change-ready',
  '2026-08-15T00:10:00Z', '2026-08-15T00:11:00Z'
);
select is(
  (select count(*) from app.compatible_ready_embeddings_v
   where id = '21000000-0000-0000-0000-000000000203'),
  1::bigint,
  'compatible READY seam requires the active document and selected contract'
);
update app.search_configs set is_active = false, activated_at = null where is_active;
insert into app.search_configs (
  version, config_checksum, is_active,
  prefix_min_length, trigram_min_length, trigram_threshold,
  exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
  rrf_k, semantic_enabled, embedding_provider, embedding_model, embedding_revision,
  embedding_dimension, embedding_timeout_ms, semantic_trigger_terms,
  event_horizon_days, event_freshness_by_source, radius_cap_m, noncollapse_enabled,
  broad_terms, taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
  chain_repetition_cap, event_venue_repetition_cap, activated_at, created_by, note
)
select 'embed-contract-change-fixture', repeat('f', 64), true,
       prefix_min_length, trigram_min_length, trigram_threshold,
       exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
       rrf_k, semantic_enabled, embedding_provider, embedding_model, 'fixture-revision',
       embedding_dimension, embedding_timeout_ms, semantic_trigger_terms,
       event_horizon_days, event_freshness_by_source, radius_cap_m, noncollapse_enabled,
       broad_terms, taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
       chain_repetition_cap, event_venue_repetition_cap, now(), 'EMBED-01B-TEST', null
from app.search_configs where version = 'embed-01b-voyage-4-v1';
select lives_ok(
  $sql$
    update app.embeddings as embedding
    set status = 'STALE', stale_reason = 'EMBEDDING_CONTRACT_CHANGED'
    where embedding.status = 'READY'
      and not exists (
        select 1 from app.search_configs as config
        where config.is_active
          and config.embedding_provider = embedding.provider
          and config.embedding_model = embedding.model
          and config.embedding_revision = embedding.model_revision
          and config.embedding_dimension = embedding.dimension
      )
  $sql$,
  'contract change moves old READY rows through READY to STALE only'
);
select ok(
  (select status = 'STALE' and embedding is not null
      and generated_at = '2026-08-15T00:11:00Z'
      and stale_reason = 'EMBEDDING_CONTRACT_CHANGED'
   from app.embeddings where id = '21000000-0000-0000-0000-000000000203'),
  'contract-change STALE retains vector, generation time, and history'
);
select is_empty(
  $sql$select 1 from app.compatible_ready_embeddings_v
       where id = '21000000-0000-0000-0000-000000000203'$sql$,
  'contract-change STALE is absent from the compatible READY seam'
);
select is_empty(
  $sql$
    select 1 from pg_indexes
    where schemaname = 'app' and tablename = 'embeddings'
      and indexdef ~* '\m(hnsw|ivfflat)\M'
  $sql$,
  'no ANN embedding index exists'
);
select is_empty(
  $sql$
    select 1 from pg_proc
    where proname ~* '(semantic_candidates|cosine)' and pronamespace = 'app'::regnamespace
  $sql$,
  'no semantic candidate or cosine retrieval function exists'
);

select * from finish();
rollback;
