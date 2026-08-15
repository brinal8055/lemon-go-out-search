-- EMBED-01B: activate the selected Voyage document-vector contract without
-- enabling query-time semantic behavior.

update app.search_configs
set is_active = false,
    activated_at = null
where is_active;

insert into app.search_configs (
  version, config_checksum, is_active,
  prefix_min_length, trigram_min_length, trigram_threshold,
  exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
  rrf_k, semantic_enabled,
  embedding_provider, embedding_model, embedding_revision, embedding_dimension,
  embedding_timeout_ms, semantic_trigger_terms, event_horizon_days,
  event_freshness_by_source, radius_cap_m, noncollapse_enabled, broad_terms,
  taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
  chain_repetition_cap, event_venue_repetition_cap,
  activated_at, created_by, note
) values (
  'embed-01b-voyage-4-v1',
  '379ab11563daa469d06c12d0f5bd29c03463a310daab4c3246f4441e533748ef',
  true,
  3, 4, 0.3,
  20, 20, 20, 20, 20, 20, 20,
  60, false,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  10000, '{}', 30,
  '{"JONKOPING_EVENT_CALENDAR":{"toleranceHours":48,"nearTermHours":720,"refreshTargetHours":24}}',
  50000, false, '{}',
  1, 0.8, 2,
  2, 2,
  statement_timestamp(), 'EMBED-01B',
  'Selected four-day Voyage-4 contract; document input, 1024 dimensions; semantic retrieval disabled.'
);

update app.embeddings as embedding
set status = 'STALE', stale_reason = 'EMBEDDING_CONTRACT_CHANGED'
where embedding.status = 'READY'
  and (
    embedding.provider <> 'voyage'
    or embedding.model <> 'voyage-4'
    or embedding.model_revision <> 'voyage-4-preflight-v1'
    or embedding.dimension <> 1024
  );

create view app.compatible_ready_embeddings_v
with (security_barrier = true, security_invoker = true)
as
select embedding.id,
       embedding.search_document_id,
       embedding.entity_id,
       embedding.provider,
       embedding.model,
       embedding.model_revision,
       embedding.dimension,
       embedding.metric,
       embedding.embedding,
       embedding.document_hash,
       embedding.generated_at
from app.embeddings as embedding
join app.search_documents as document
  on document.id = embedding.search_document_id
  and document.entity_id = embedding.entity_id
  and document.content_hash = embedding.document_hash
  and document.is_active
join app.canonical_entities as entity
  on entity.id = embedding.entity_id
  and entity.publication_status = 'PUBLISHED'
  and entity.merged_into_id is null
join app.search_configs as config
  on config.is_active
  and config.embedding_provider = embedding.provider
  and config.embedding_model = embedding.model
  and config.embedding_revision = embedding.model_revision
  and config.embedding_dimension = embedding.dimension
where embedding.status = 'READY';

revoke all on app.compatible_ready_embeddings_v from public, anon, authenticated, service_role;
grant select on app.compatible_ready_embeddings_v to lemon_ingestion, lemon_reviewer;
