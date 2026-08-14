-- SEARCH-02: bounded multilingual FTS, deterministic taxonomy retrieval, and
-- a traceable canonical candidate union. Final RRF remains intentionally absent.

create index taxonomy_nodes_active_label_en_norm_idx
  on app.taxonomy_nodes (app.norm_v1_preserving(label_en))
  where active;
create index taxonomy_nodes_active_label_sv_norm_idx
  on app.taxonomy_nodes (app.norm_v1_preserving(label_sv))
  where active;

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
  'search-02-deterministic-v1',
  '2e5cf5050a1c3662436d12528a9f011a00525b7e02942c584042f2b5743c8d37',
  true,
  3, 4, 0.3,
  20, 20, 20, 20, 20, 20, 20,
  60, false,
  'not-configured', 'not-configured', 'not-configured', 1,
  1000, '{}', 30,
  '{}', 50000, false, '{}',
  1, 0.8, 2,
  2, 2,
  '2026-08-14T00:00:00Z', 'SEARCH-02',
  'Deterministic exact, fuzzy, multilingual FTS, and taxonomy candidate stages.'
);

create function app.search_lexical_candidates(
  p_query text,
  p_scope_id uuid,
  p_cap integer default 50
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  raw_score real,
  matched_weight text,
  candidate_rank integer,
  eligibility_passed boolean
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_cap < 1 or p_cap > 200 then
    raise exception using errcode = '22023', message = 'lexical candidate cap is invalid';
  end if;

  if app.norm_v1_preserving(p_query) = '' then
    return;
  end if;

  return query
  with raw_queries as (
    select pg_catalog.websearch_to_tsquery('pg_catalog.simple'::regconfig, p_query) as simple,
           pg_catalog.websearch_to_tsquery('pg_catalog.swedish'::regconfig, p_query) as swedish,
           pg_catalog.websearch_to_tsquery('pg_catalog.english'::regconfig, p_query) as english
  ),
  query_value as (
    select raw_queries.*,
           raw_queries.simple || raw_queries.swedish || raw_queries.english as combined
    from raw_queries
  ),
  matching_documents as materialized (
    select document.entity_id,
           greatest(
             pg_catalog.ts_rank_cd(document.fts, query_value.simple),
             pg_catalog.ts_rank_cd(document.fts, query_value.swedish),
             pg_catalog.ts_rank_cd(document.fts, query_value.english)
           )::real as score,
           case
             when pg_catalog.ts_filter(document.fts, array['A'::"char"])
                    @@ query_value.simple
               or pg_catalog.ts_filter(document.fts, array['A'::"char"])
                    @@ query_value.swedish
               or pg_catalog.ts_filter(document.fts, array['A'::"char"])
                    @@ query_value.english then 'A'
             when pg_catalog.ts_filter(document.fts, array['B'::"char"])
                    @@ query_value.simple
               or pg_catalog.ts_filter(document.fts, array['B'::"char"])
                    @@ query_value.swedish
               or pg_catalog.ts_filter(document.fts, array['B'::"char"])
                    @@ query_value.english then 'B'
             when pg_catalog.ts_filter(document.fts, array['C'::"char"])
                    @@ query_value.simple
               or pg_catalog.ts_filter(document.fts, array['C'::"char"])
                    @@ query_value.swedish
               or pg_catalog.ts_filter(document.fts, array['C'::"char"])
                    @@ query_value.english then 'C'
             when pg_catalog.ts_filter(document.fts, array['D'::"char"])
                    @@ query_value.simple
               or pg_catalog.ts_filter(document.fts, array['D'::"char"])
                    @@ query_value.swedish
               or pg_catalog.ts_filter(document.fts, array['D'::"char"])
                    @@ query_value.english then 'D'
             else 'MIXED'
           end as weight_class
    from app.search_documents as document
    cross join query_value
    where document.is_active
      and document.fts @@ query_value.combined
  ),
  scored as (
    select matching.entity_id, matching.score, matching.weight_class
    from matching_documents as matching
    join app.search_eligible_places_v as eligible
      on eligible.entity_id = matching.entity_id
     and eligible.scope_id = p_scope_id
  ),
  ranked as (
    select scored.*,
           row_number() over (order by scored.score desc, scored.entity_id)::integer as rank
    from scored
  )
  select ranked.entity_id,
         'FTS'::text,
         ranked.score,
         ranked.weight_class,
         ranked.rank,
         true
  from ranked
  where ranked.rank <= p_cap
  order by ranked.rank;
end;
$$;

create function app.search_recognized_taxonomy_node(p_query text)
returns table (
  taxonomy_node_id uuid,
  match_source text,
  normalized_query text
)
language sql
stable
set search_path = ''
as $$
  with query_value as (
    select app.norm_v1_preserving(p_query) as normalized
  ),
  evidence as (
    select node.id as node_id, 'LABEL_EN'::text as source, 1 as priority
    from app.taxonomy_nodes as node
    cross join query_value
    where node.active
      and query_value.normalized <> ''
      and app.norm_v1_preserving(node.label_en) = query_value.normalized

    union all

    select node.id, 'LABEL_SV'::text, 2
    from app.taxonomy_nodes as node
    cross join query_value
    where node.active
      and query_value.normalized <> ''
      and app.norm_v1_preserving(node.label_sv) = query_value.normalized

    union all

    select alias.taxonomy_node_id, 'ALIAS_' || upper(alias.language), 3
    from app.taxonomy_aliases as alias
    join app.taxonomy_nodes as node
      on node.id = alias.taxonomy_node_id and node.active
    cross join query_value
    where alias.active
      and query_value.normalized <> ''
      and alias.alias_norm = query_value.normalized
  ),
  unambiguous as (
    select min(node_id::text)::uuid as node_id
    from evidence
    having count(distinct node_id) = 1
  )
  select evidence.node_id,
         evidence.source,
         query_value.normalized
  from unambiguous
  join lateral (
    select candidate.*
    from evidence as candidate
    where candidate.node_id = unambiguous.node_id
    order by candidate.priority, candidate.source
    limit 1
  ) as evidence on true
  cross join query_value;
$$;

create function app.search_taxonomy_candidates(
  p_query text,
  p_taxonomy_node_id uuid,
  p_scope_id uuid,
  p_cap integer default 100
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  requested_taxonomy_node_id uuid,
  matched_taxonomy_node_id uuid,
  hierarchy_distance integer,
  direct_taxonomy boolean,
  recognition_source text,
  candidate_rank integer,
  eligibility_passed boolean
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_cap < 1 or p_cap > 500 then
    raise exception using errcode = '22023', message = 'taxonomy candidate cap is invalid';
  end if;

  return query
  with requested as (
    select p_taxonomy_node_id as node_id, 'EXPLICIT_FILTER'::text as source
    where p_taxonomy_node_id is not null
      and exists (
        select 1 from app.taxonomy_nodes as node
        where node.id = p_taxonomy_node_id and node.active
      )

    union all

    select recognized.taxonomy_node_id, recognized.match_source
    from app.search_recognized_taxonomy_node(p_query) as recognized
    where p_taxonomy_node_id is null
  ),
  evidence as (
    select eligible.entity_id,
           requested.node_id as requested_node_id,
           membership.taxonomy_node_id as matched_node_id,
           expansion.hierarchy_distance,
           expansion.is_requested_node as is_direct,
           requested.source
    from requested
    cross join lateral app.active_taxonomy_expansion(requested.node_id) as expansion
    join app.entity_taxonomy_memberships as membership
      on membership.taxonomy_node_id = expansion.taxonomy_node_id
     and membership.active
    join app.search_eligible_places_v as eligible
      on eligible.entity_id = membership.entity_id
     and eligible.scope_id = p_scope_id
  ),
  best_entity_evidence as (
    select evidence.*,
           row_number() over (
             partition by evidence.entity_id
             order by evidence.is_direct desc,
                      evidence.hierarchy_distance,
                      evidence.matched_node_id
           ) as entity_evidence_rank
    from evidence
  ),
  ranked as (
    select best.*,
           row_number() over (
             order by best.is_direct desc,
                      best.hierarchy_distance,
                      best.entity_id
           )::integer as rank
    from best_entity_evidence as best
    where best.entity_evidence_rank = 1
  )
  select ranked.entity_id,
         'TAXONOMY'::text,
         ranked.requested_node_id,
         ranked.matched_node_id,
         ranked.hierarchy_distance,
         ranked.is_direct,
         ranked.source,
         ranked.rank,
         true
  from ranked
  where ranked.rank <= p_cap
  order by ranked.rank;
end;
$$;

create function app.search_deterministic_candidates(
  p_query text,
  p_scope_id uuid,
  p_taxonomy_node_id uuid,
  p_exact_cap integer,
  p_prefix_min_length integer,
  p_prefix_cap integer,
  p_trigram_min_length integer,
  p_trigram_threshold real,
  p_trigram_cap integer,
  p_fts_cap integer,
  p_taxonomy_cap integer
)
returns table (
  canonical_entity_id uuid,
  best_match_type text,
  protected boolean,
  protection_class text,
  provisional_rank integer,
  stage_evidence jsonb,
  eligibility_passed boolean
)
language sql
volatile
set search_path = ''
as $$
  with stage_rows as (
    select exact.canonical_entity_id,
           case exact.match_type
             when 'CANONICAL_EXACT' then 'CANONICAL_EXACT'
             else 'ALIAS_EXACT'
           end as stage,
           exact.match_type,
           exact.protected,
           exact.protection_class,
           exact.candidate_rank as stage_rank,
           null::real as raw_score,
           null::boolean as direct_taxonomy,
           case
             when exact.match_type = 'CANONICAL_EXACT' then 1
             when exact.protected then 2
             else 3
           end as stage_priority,
           jsonb_build_object(
             'matchedSource', exact.matched_source,
             'aliasQualification', exact.alias_qualification_reason
           ) as diagnostic
    from app.search_exact_candidates(p_query, p_scope_id, p_exact_cap) as exact

    union all

    select fuzzy.canonical_entity_id,
           case fuzzy.match_type
             when 'ACCENTLESS_EXACT' then 'ASCII_EXACT'
             else fuzzy.match_type
           end,
           fuzzy.match_type,
           false,
           null::text,
           fuzzy.candidate_rank,
           fuzzy.trigram_similarity,
           null::boolean,
           case fuzzy.match_type
             when 'ACCENTLESS_EXACT' then 4
             when 'PREFIX' then 5
             else 6
           end,
           jsonb_build_object(
             'matchedSource', fuzzy.matched_source,
             'aliasQualification', fuzzy.alias_qualification_reason
           )
    from app.search_fuzzy_candidates(
      p_query, p_scope_id, p_exact_cap,
      p_prefix_min_length, p_prefix_cap,
      p_trigram_min_length, p_trigram_threshold, p_trigram_cap
    ) as fuzzy

    union all

    select lexical.canonical_entity_id,
           'FTS', lexical.match_type, false, null::text,
           lexical.candidate_rank, lexical.raw_score, null::boolean, 7,
           jsonb_build_object('matchedWeight', lexical.matched_weight)
    from app.search_lexical_candidates(p_query, p_scope_id, p_fts_cap) as lexical

    union all

    select taxonomy.canonical_entity_id,
           'TAXONOMY', taxonomy.match_type, false, null::text,
           taxonomy.candidate_rank, null::real, taxonomy.direct_taxonomy, 8,
           jsonb_build_object(
             'requestedNodeId', taxonomy.requested_taxonomy_node_id,
             'matchedNodeId', taxonomy.matched_taxonomy_node_id,
             'hierarchyDistance', taxonomy.hierarchy_distance,
             'recognitionSource', taxonomy.recognition_source
           )
    from app.search_taxonomy_candidates(
      p_query, p_taxonomy_node_id, p_scope_id, p_taxonomy_cap
    ) as taxonomy
  ),
  best_evidence as (
    select stage_rows.*,
           row_number() over (
             partition by stage_rows.canonical_entity_id
             order by stage_rows.stage_priority,
                      stage_rows.stage_rank,
                      stage_rows.stage,
                      stage_rows.match_type
           ) as entity_evidence_rank
    from stage_rows
  ),
  aggregated as (
    select evidence.canonical_entity_id,
           min(evidence.match_type) filter (where evidence.entity_evidence_rank = 1) as best_match,
           bool_or(evidence.protected) as is_protected,
           min(evidence.protection_class) filter (where evidence.protected) as protected_class,
           min(evidence.stage_priority) as best_stage_priority,
           min(evidence.stage_rank) filter (where evidence.entity_evidence_rank = 1) as best_stage_rank,
           jsonb_agg(
             jsonb_build_object(
               'stage', evidence.stage,
               'stageRank', evidence.stage_rank,
               'rawScore', evidence.raw_score,
               'matchKind', evidence.match_type,
               'directTaxonomy', evidence.direct_taxonomy,
               'diagnostic', evidence.diagnostic
             ) order by evidence.stage_priority,
                        evidence.stage_rank,
                        evidence.stage,
                        evidence.match_type
           ) as evidence_rows
    from best_evidence as evidence
    group by evidence.canonical_entity_id
  ),
  ranked as (
    select aggregated.*,
           row_number() over (
             order by aggregated.best_stage_priority,
                      aggregated.best_stage_rank,
                      aggregated.canonical_entity_id
           )::integer as rank
    from aggregated
  )
  select ranked.canonical_entity_id,
         ranked.best_match,
         ranked.is_protected,
         ranked.protected_class,
         ranked.rank,
         ranked.evidence_rows,
         true
  from ranked
  order by ranked.rank;
$$;

revoke execute on function app.search_lexical_candidates(text, uuid, integer)
from public, anon, authenticated, service_role;
revoke execute on function app.search_recognized_taxonomy_node(text)
from public, anon, authenticated, service_role;
revoke execute on function app.search_taxonomy_candidates(text, uuid, uuid, integer)
from public, anon, authenticated, service_role;
revoke execute on function app.search_deterministic_candidates(
  text, uuid, uuid, integer, integer, integer, integer, real, integer, integer, integer
) from public, anon, authenticated, service_role;

grant select on app.taxonomy_aliases to lemon_api_owner;
create policy taxonomy_aliases_api_owner_read
on app.taxonomy_aliases
for select to lemon_api_owner
using (true);

grant execute on function app.active_taxonomy_expansion(uuid) to lemon_api_owner;
grant execute on function app.search_lexical_candidates(text, uuid, integer)
to lemon_api_owner;
grant execute on function app.search_recognized_taxonomy_node(text)
to lemon_api_owner;
grant execute on function app.search_taxonomy_candidates(text, uuid, uuid, integer)
to lemon_api_owner;
grant execute on function app.search_deterministic_candidates(
  text, uuid, uuid, integer, integer, integer, integer, real, integer, integer, integer
) to lemon_api_owner;

grant lemon_api_owner to postgres;
grant create on schema api to lemon_api_owner;
set role lemon_api_owner;

create or replace function api.search_v1(
  p_request_id uuid,
  p_query text,
  p_query_norm text,
  p_query_ascii text,
  p_ui_locale text,
  p_scope_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_taxonomy_node_id uuid,
  p_entity_types app.entity_type[],
  p_time_start timestamptz,
  p_time_end timestamptz,
  p_query_vector extensions.vector,
  p_embedding_provider text,
  p_embedding_model text,
  p_embedding_revision text,
  p_embedding_dimension integer,
  p_limit smallint,
  p_search_config_version text
)
returns table (
  result_position smallint,
  entity_id uuid,
  entity_type app.entity_type,
  display_name text,
  categories jsonb,
  latitude double precision,
  longitude double precision,
  distance_m integer,
  factual_summary text,
  place_status app.place_status,
  opening_hours jsonb,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  event_timezone text,
  event_status app.event_status,
  venue jsonb,
  semantic_used boolean,
  semantic_degraded boolean
)
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  active_config app.search_configs%rowtype;
  computed_query_norm text;
  computed_query_ascii text;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request ID is required';
  end if;

  if p_query is null
    or char_length(p_query) > 160
    or octet_length(p_query) > 512
  then
    raise exception using errcode = '22023', message = 'query is invalid';
  end if;

  computed_query_norm := app.norm_v1_preserving(p_query);
  computed_query_ascii := app.norm_v1_accentless(p_query);

  if p_query_norm is distinct from computed_query_norm
    or p_query_ascii is distinct from computed_query_ascii
  then
    raise exception using errcode = '22023', message = 'query normalization is invalid';
  end if;

  if computed_query_norm = '' and p_taxonomy_node_id is null then
    raise exception using errcode = '22023', message = 'query is required';
  end if;

  if p_ui_locale not in ('en', 'sv') then
    raise exception using errcode = '22023', message = 'UI locale is invalid';
  end if;

  if p_scope_id is null or not exists (
    select 1 from app.geographic_scopes as scope
    where scope.id = p_scope_id and scope.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'scope was not found';
  end if;

  if not exists (
    select 1 from app.geographic_scopes as scope
    where scope.id = p_scope_id
      and scope.is_active
      and scope.public_search_enabled
  ) then
    raise exception using errcode = '55000', message = 'scope is unavailable';
  end if;

  select config.* into active_config
  from app.search_configs as config
  where config.is_active;

  if active_config.version is null
    or p_search_config_version is distinct from active_config.version
  then
    raise exception using errcode = '55000', message = 'search configuration is unavailable';
  end if;

  if p_embedding_provider is distinct from active_config.embedding_provider
    or p_embedding_model is distinct from active_config.embedding_model
    or p_embedding_revision is distinct from active_config.embedding_revision
    or p_embedding_dimension is distinct from active_config.embedding_dimension::integer
  then
    raise exception using errcode = '22023', message = 'embedding contract is invalid';
  end if;

  if p_query_vector is not null then
    if not active_config.semantic_enabled
      or extensions.vector_dims(p_query_vector) <> active_config.embedding_dimension
    then
      raise exception using errcode = '22023', message = 'query vector is invalid';
    end if;
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception using errcode = '22023', message = 'limit is invalid';
  end if;

  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90))
    or (p_longitude is not null and (p_longitude < -180 or p_longitude > 180))
    or (p_radius_m is not null and (
      p_latitude is null
      or p_radius_m < 1
      or p_radius_m > active_config.radius_cap_m
    ))
  then
    raise exception using errcode = '22023', message = 'location is invalid';
  end if;

  if p_entity_types is not null and (
    cardinality(p_entity_types) = 0
    or array_position(p_entity_types, null) is not null
  ) then
    raise exception using errcode = '22023', message = 'entity types are invalid';
  end if;

  if (p_time_start is null) <> (p_time_end is null)
    or (p_time_start is not null and p_time_end <= p_time_start)
  then
    raise exception using errcode = '22023', message = 'time interval is invalid';
  end if;

  if p_taxonomy_node_id is not null and not exists (
    select 1 from app.taxonomy_nodes as node
    where node.id = p_taxonomy_node_id and node.active
  ) then
    raise exception using errcode = 'P0002', message = 'taxonomy node was not found';
  end if;

  return query
  with candidates as materialized (
    select candidate.*
    from app.search_deterministic_candidates(
      p_query,
      p_scope_id,
      p_taxonomy_node_id,
      active_config.exact_cap,
      active_config.prefix_min_length,
      active_config.prefix_cap,
      active_config.trigram_min_length,
      active_config.trigram_threshold,
      active_config.trigram_cap,
      active_config.fts_cap,
      active_config.taxonomy_cap
    ) as candidate
  ),
  eligible_results as (
    select candidate.canonical_entity_id,
           candidate.best_match_type as match_type,
           candidate.protected,
           candidate.provisional_rank,
           canonical.canonical_name,
           place.location,
           place.locality,
           place.status,
           place.opening_hours,
           document.description_text,
           case
             when p_latitude is null then null::integer
             else round(extensions.st_distance(
               place.location,
               extensions.st_setsrid(
                 extensions.st_makepoint(p_longitude, p_latitude), 4326
               )::extensions.geography
             ))::integer
           end as computed_distance_m
    from candidates as candidate
    join app.canonical_entities as canonical
      on canonical.id = candidate.canonical_entity_id
    join app.places as place on place.entity_id = canonical.id
    left join app.search_documents as document
      on document.entity_id = canonical.id and document.is_active
    where (p_entity_types is null or 'PLACE'::app.entity_type = any(p_entity_types))
      and p_time_start is null
      and (
        p_taxonomy_node_id is null
        or exists (
          select 1
          from app.entity_taxonomy_memberships as membership
          join app.taxonomy_nodes as node
            on node.id = membership.taxonomy_node_id and node.active
          where membership.entity_id = canonical.id
            and membership.active
            and p_taxonomy_node_id = any(node.path)
        )
      )
      and (
        p_radius_m is null
        or extensions.st_dwithin(
          place.location,
          extensions.st_setsrid(
            extensions.st_makepoint(p_longitude, p_latitude), 4326
          )::extensions.geography,
          p_radius_m
        )
      )
  ),
  ranked as (
    select result.*,
           row_number() over (
             order by result.provisional_rank, result.canonical_entity_id
           ) as position
    from eligible_results as result
  )
  select ranked.position::smallint,
         ranked.canonical_entity_id,
         'PLACE'::app.entity_type,
         ranked.canonical_name,
         coalesce(category.categories, '[]'::jsonb),
         extensions.st_y(ranked.location::extensions.geometry),
         extensions.st_x(ranked.location::extensions.geometry),
         ranked.computed_distance_m,
         nullif(btrim(ranked.description_text), ''),
         ranked.status,
         ranked.opening_hours,
         null::timestamptz,
         null::timestamptz,
         null::text,
         null::app.event_status,
         null::jsonb,
         false,
         active_config.semantic_enabled and p_query_vector is null
  from ranked
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'id', node.id,
        'slug', node.slug,
        'label', case when p_ui_locale = 'sv' then node.label_sv else node.label_en end
      ) order by node.slug
    ) as categories
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as node
      on node.id = membership.taxonomy_node_id and node.active
    where membership.entity_id = ranked.canonical_entity_id
      and membership.active
  ) as category on true
  where ranked.position <= p_limit
  order by ranked.position;
end;
$$;

reset role;
revoke create on schema api from lemon_api_owner;
revoke lemon_api_owner from postgres;
