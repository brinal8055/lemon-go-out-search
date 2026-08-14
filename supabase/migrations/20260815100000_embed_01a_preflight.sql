-- EMBED-01A: retain deterministic search behavior while activating the bounded
-- Voyage document-vector contract. Semantic retrieval remains disabled.

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
  'embed-01a-preflight-v1',
  '4da8b1251aea5d08b7f02c34de2e117e65e5706ab56ac1d91268d49d4953e4e1',
  true,
  3, 4, 0.3,
  20, 20, 20, 20, 20, 20, 20,
  60, false,
  'voyage', 'voyage-4', 'voyage-4-preflight-v1', 1024,
  10000, '{}', 30,
  '{}', 50000, false, '{}',
  1, 0.8, 2,
  2, 2,
  statement_timestamp(), 'EMBED-01A',
  'Voyage-4 1024-dimensional Day-2 lifecycle/provider preflight; semantic retrieval disabled.'
);

-- READY/STALE validation reads the retained non-secret embedding contract.
-- lemon_ingestion owns bounded embedding writes and document invalidation.
grant select on app.search_configs to lemon_ingestion;

create policy search_configs_ingestion_read
on app.search_configs
for select to lemon_ingestion
using (true);
