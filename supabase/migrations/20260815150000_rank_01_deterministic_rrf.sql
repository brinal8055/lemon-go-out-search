-- RANK-01: canonical exactly-once union and fixed deterministic RRF.

alter table app.search_configs
  add column rrf_enabled boolean not null default false,
  add column rrf_version text not null default 'NOT_IMPLEMENTED'
    check (btrim(rrf_version) <> ''),
  add column rrf_stages text[] not null default '{}'
    check (array_position(rrf_stages, null) is null),
  add column rrf_tie_policy text not null default 'NOT_IMPLEMENTED'
    check (btrim(rrf_tie_policy) <> ''),
  add column rrf_max_results smallint not null default 20
    check (rrf_max_results between 1 and 20),
  add constraint search_configs_rrf_contract_check check (
    not rrf_enabled or (
      rrf_version = 'RRF_V1'
      and rrf_stages = array[
        'ASCII_EXACT', 'PREFIX', 'TRIGRAM',
        'FTS', 'TAXONOMY', 'EVENT', 'SEMANTIC'
      ]::text[]
      and rrf_tie_policy = 'PROTECTED_CONTEXT_RRF_DIRECT_TAXONOMY_UUID_ASC_V1'
    )
  );

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
  rrf_enabled, rrf_version, rrf_stages, rrf_tie_policy, rrf_max_results,
  activated_at, created_by, note
)
select 'rank-01-rrf-v1',
       '44f04fe7a1cab01bd8b1a537d10078145117141c3937da39f797e0567e0b0d6c',
       true,
       prefix_min_length, trigram_min_length, trigram_threshold,
       exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
       60, semantic_enabled,
       embedding_provider, embedding_model, embedding_revision, embedding_dimension,
       embedding_timeout_ms, semantic_trigger_terms, event_horizon_days,
       event_freshness_by_source, radius_cap_m, noncollapse_enabled, broad_terms,
       taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
       chain_repetition_cap, event_venue_repetition_cap,
       true, 'RRF_V1',
       array[
         'ASCII_EXACT', 'PREFIX', 'TRIGRAM',
         'FTS', 'TAXONOMY', 'EVENT', 'SEMANTIC'
       ]::text[],
       'PROTECTED_CONTEXT_RRF_DIRECT_TAXONOMY_UUID_ASC_V1', 20,
       statement_timestamp(), 'RANK-01',
       'Fixed equal-stage RRF k=60; protected exact precedes ordinary fusion.'
from app.search_configs
where version = 'sem-01-query-v1';

grant lemon_api_owner to postgres;
grant usage, create on schema app, api to lemon_api_owner;
set role lemon_api_owner;

create function app.rrf_contributions(
  p_stage_ranks jsonb,
  p_k integer,
  p_participating_stages text[]
)
returns table (
  stage text,
  stage_rank integer,
  contribution numeric
)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_k < 1
    or jsonb_typeof(p_stage_ranks) <> 'object'
    or p_participating_stages is null
    or array_position(p_participating_stages, null) is not null
    or exists (
      select 1
      from jsonb_each_text(p_stage_ranks) as item(stage_name, rank_text)
      where item.rank_text !~ '^[1-9][0-9]*$'
    )
  then
    raise exception using errcode = '22023', message = 'RRF inputs are invalid';
  end if;

  return query
  select item.stage_name,
         item.rank_text::integer,
         1::numeric / (p_k + item.rank_text::integer)::numeric
  from jsonb_each_text(p_stage_ranks) as item(stage_name, rank_text)
  where item.stage_name = any(p_participating_stages)
  order by array_position(p_participating_stages, item.stage_name);
end;
$$;

create function app.search_ranked_candidates(
  p_query text,
  p_scope_id uuid,
  p_now timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_taxonomy_node_id uuid,
  p_entity_types app.entity_type[],
  p_time_start timestamptz,
  p_time_end timestamptz,
  p_query_vector extensions.vector,
  p_search_config_version text
)
returns table (
  canonical_entity_id uuid,
  entity_type app.entity_type,
  protected boolean,
  protection_class text,
  stage_ranks jsonb,
  rrf_contributions jsonb,
  rrf_score numeric,
  pre_protection_fused_rank integer,
  final_rank integer,
  direct_taxonomy boolean,
  distance_m integer,
  semantic_present boolean,
  tie_break_key uuid,
  tie_break_reason text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  active_config app.search_configs%rowtype;
begin
  select config.* into active_config
  from app.search_configs as config
  where config.is_active;

  if active_config.version is null
    or p_search_config_version is distinct from active_config.version
    or not active_config.rrf_enabled
    or active_config.rrf_version <> 'RRF_V1'
  then
    raise exception using errcode = '55000', message = 'RRF configuration is unavailable';
  end if;

  return query
  with deterministic as materialized (
    select candidate.*
    from app.search_deterministic_candidates(
      p_query, p_scope_id, p_taxonomy_node_id,
      active_config.exact_cap, active_config.prefix_min_length,
      active_config.prefix_cap, active_config.trigram_min_length,
      active_config.trigram_threshold, active_config.trigram_cap,
      active_config.fts_cap, active_config.taxonomy_cap
    ) as candidate
  ),
  place_candidates as materialized (
    select deterministic.*,
           'PLACE'::app.entity_type as entity_type,
           coalesce((
             select bool_or((evidence.value->>'directTaxonomy')::boolean)
             from jsonb_array_elements(deterministic.stage_evidence) as evidence(value)
             where evidence.value->>'stage' = 'TAXONOMY'
           ), false) as direct_taxonomy,
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             place.location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end as distance_m
    from deterministic
    join app.places as place on place.entity_id = deterministic.canonical_entity_id
    where (p_entity_types is null or 'PLACE'::app.entity_type = any(p_entity_types))
      and (p_taxonomy_node_id is null or exists (
        select 1
        from app.entity_taxonomy_memberships as membership
        join app.taxonomy_nodes as node
          on node.id = membership.taxonomy_node_id and node.active
        where membership.entity_id = deterministic.canonical_entity_id
          and membership.active
          and p_taxonomy_node_id = any(node.path)
      ))
      and (p_radius_m is null or extensions.st_dwithin(
        place.location,
        extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
          ::extensions.geography,
        p_radius_m
      ))
  ),
  event_candidates as materialized (
    select candidate.*, eligible.effective_location
    from app.search_event_candidates(
      p_query, p_scope_id, p_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id,
      p_entity_types, active_config.event_cap
    ) as candidate
    join app.search_event_eligibility(
      p_scope_id, p_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types
    ) as eligible
      on eligible.entity_id = candidate.canonical_entity_id and eligible.eligible
  ),
  semantic_candidates as materialized (
    select candidate.*
    from app.search_semantic_candidates(
      p_query_vector, p_scope_id, p_now,
      active_config.event_horizon_days, active_config.event_freshness_by_source,
      p_time_start, p_time_end, p_latitude, p_longitude, p_radius_m,
      p_taxonomy_node_id, p_entity_types,
      active_config.embedding_provider, active_config.embedding_model,
      active_config.embedding_revision, active_config.embedding_dimension,
      active_config.semantic_cap
    ) as candidate
  ),
  candidate_sources as (
    select place.canonical_entity_id, place.entity_type,
           place.protected, place.protection_class,
           place.direct_taxonomy, place.distance_m
    from place_candidates as place

    union all

    select event.canonical_entity_id, 'EVENT'::app.entity_type,
           false, null::text,
           coalesce(exists (
             select 1 from app.entity_taxonomy_memberships as membership
             where membership.entity_id = event.canonical_entity_id
               and membership.active
               and membership.taxonomy_node_id = p_taxonomy_node_id
           ), false),
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             event.effective_location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end
    from event_candidates as event

    union all

    select semantic.canonical_entity_id, semantic.entity_type,
           false, null::text,
           coalesce(exists (
             select 1 from app.entity_taxonomy_memberships as membership
             where membership.entity_id = semantic.canonical_entity_id
               and membership.active
               and membership.taxonomy_node_id = p_taxonomy_node_id
           ), false),
           case
             when p_latitude is null then null::integer
             when semantic.entity_type = 'PLACE' then (
               select round(extensions.st_distance(
                 place.location,
                 extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
                   ::extensions.geography
               ))::integer
               from app.places as place
               where place.entity_id = semantic.canonical_entity_id
             )
             else (
               select round(extensions.st_distance(
                 eligible.effective_location,
                 extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
                   ::extensions.geography
               ))::integer
               from app.search_event_eligibility(
                 p_scope_id, p_now, active_config.event_horizon_days,
                 active_config.event_freshness_by_source, p_time_start, p_time_end,
                 p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types
               ) as eligible
               where eligible.entity_id = semantic.canonical_entity_id and eligible.eligible
             )
           end
    from semantic_candidates as semantic
  ),
  candidate_entities as (
    select source.canonical_entity_id,
           min(source.entity_type::text)::app.entity_type as entity_type,
           bool_or(source.protected) as protected,
           min(source.protection_class) filter (where source.protected) as protection_class,
           bool_or(source.direct_taxonomy) as direct_taxonomy,
           min(source.distance_m) as distance_m
    from candidate_sources as source
    group by source.canonical_entity_id
  ),
  deterministic_stage_rows as (
    select place.canonical_entity_id,
           evidence.value->>'stage' as stage,
           (evidence.value->>'stageRank')::integer as stage_rank
    from place_candidates as place
    cross join lateral jsonb_array_elements(place.stage_evidence) as evidence(value)
    where (evidence.value->>'stage') = any(active_config.rrf_stages)
      and not (
        place.protected
        and evidence.value->>'stage' in ('CANONICAL_EXACT', 'ALIAS_EXACT')
      )
  ),
  all_stage_rows as (
    select * from deterministic_stage_rows
    union all
    select event.canonical_entity_id, 'EVENT', event.candidate_rank
    from event_candidates as event
    union all
    select semantic.canonical_entity_id, 'SEMANTIC', semantic.candidate_rank
    from semantic_candidates as semantic
  ),
  deduplicated_stage_rows as (
    select stage_row.*
    from (
      select all_stage_rows.*,
             row_number() over (
               partition by all_stage_rows.canonical_entity_id, all_stage_rows.stage
               order by all_stage_rows.stage_rank
             ) as stage_row_number
      from all_stage_rows
      where all_stage_rows.stage = any(active_config.rrf_stages)
    ) as stage_row
    where stage_row.stage_row_number = 1
  ),
  entity_stage_ranks as (
    select stage_row.canonical_entity_id,
           jsonb_object_agg(
             stage_row.stage, stage_row.stage_rank
             order by array_position(active_config.rrf_stages, stage_row.stage)
           ) as stage_ranks
    from deduplicated_stage_rows as stage_row
    group by stage_row.canonical_entity_id
  ),
  scored as (
    select entity.*,
           coalesce(stage.stage_ranks, '{}'::jsonb) as stage_ranks,
           coalesce(contribution.rows, '[]'::jsonb) as contributions,
           coalesce(contribution.total, 0::numeric) as total_rrf,
           coalesce((stage.stage_ranks ? 'SEMANTIC'), false) as semantic_present
    from candidate_entities as entity
    left join entity_stage_ranks as stage
      on stage.canonical_entity_id = entity.canonical_entity_id
    left join lateral (
      select jsonb_agg(jsonb_build_object(
               'stage', item.stage,
               'rank', item.stage_rank,
               'contribution', item.contribution
             ) order by array_position(active_config.rrf_stages, item.stage)) as rows,
             sum(item.contribution) as total
      from app.rrf_contributions(
        coalesce(stage.stage_ranks, '{}'::jsonb),
        active_config.rrf_k,
        active_config.rrf_stages
      ) as item
    ) as contribution on true
  ),
  pre_fused as (
    select scored.*,
           row_number() over (
             order by scored.total_rrf desc,
                      scored.direct_taxonomy desc,
                      scored.canonical_entity_id
           )::integer as fused_rank
    from scored
  ),
  final as (
    select pre_fused.*,
           row_number() over (
             order by
               case pre_fused.protection_class
                 when 'PROTECTED_CANONICAL_EXACT' then 1
                 when 'PROTECTED_ALIAS_EXACT' then 2
                 else 3
               end,
               case when pre_fused.protected then pre_fused.direct_taxonomy end desc,
               case when pre_fused.protected then pre_fused.distance_m end nulls last,
               case when not pre_fused.protected then pre_fused.total_rrf end desc,
               case when not pre_fused.protected then pre_fused.direct_taxonomy end desc,
               pre_fused.canonical_entity_id
           )::integer as ranked_position
    from pre_fused
  )
  select final.canonical_entity_id,
         final.entity_type,
         final.protected,
         final.protection_class,
         final.stage_ranks,
         final.contributions,
         final.total_rrf,
         final.fused_rank,
         final.ranked_position,
         final.direct_taxonomy,
         final.distance_m,
         final.semantic_present,
         final.canonical_entity_id,
         case when final.protected
           then 'PROTECTED_CONTEXT_THEN_UUID'
           else 'RRF_DIRECT_TAXONOMY_THEN_UUID'
         end
  from final
  order by final.ranked_position;
end;
$$;

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
  request_now timestamptz := statement_timestamp();
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'request ID is required';
  end if;
  if p_query is null or char_length(p_query) > 160 or octet_length(p_query) > 512 then
    raise exception using errcode = '22023', message = 'query is invalid';
  end if;
  computed_query_norm := app.norm_v1_preserving(p_query);
  computed_query_ascii := app.norm_v1_accentless(p_query);
  if p_query_norm is distinct from computed_query_norm
    or p_query_ascii is distinct from computed_query_ascii then
    raise exception using errcode = '22023', message = 'query normalization is invalid';
  end if;
  if computed_query_norm = '' and p_taxonomy_node_id is null and p_time_start is null then
    raise exception using errcode = '22023', message = 'query is required';
  end if;
  if p_ui_locale not in ('en', 'sv') then
    raise exception using errcode = '22023', message = 'UI locale is invalid';
  end if;
  if p_scope_id is null or not exists (
    select 1 from app.geographic_scopes as scope where scope.id = p_scope_id and scope.is_active
  ) then raise exception using errcode = 'P0002', message = 'scope was not found'; end if;
  if not exists (
    select 1 from app.geographic_scopes as scope
    where scope.id = p_scope_id and scope.is_active and scope.public_search_enabled
  ) then raise exception using errcode = '55000', message = 'scope is unavailable'; end if;

  select config.* into active_config from app.search_configs as config where config.is_active;
  if active_config.version is null or p_search_config_version is distinct from active_config.version then
    raise exception using errcode = '55000', message = 'search configuration is unavailable';
  end if;
  if p_embedding_provider is distinct from active_config.embedding_provider
    or p_embedding_model is distinct from active_config.embedding_model
    or p_embedding_revision is distinct from active_config.embedding_revision
    or p_embedding_dimension is distinct from active_config.embedding_dimension::integer then
    raise exception using errcode = '22023', message = 'embedding contract is invalid';
  end if;
  if p_query_vector is not null and (
    not active_config.semantic_enabled
    or extensions.vector_dims(p_query_vector) <> active_config.embedding_dimension
  ) then raise exception using errcode = '22023', message = 'query vector is invalid'; end if;
  if p_limit is null or p_limit < 1 or p_limit > active_config.rrf_max_results then
    raise exception using errcode = '22023', message = 'limit is invalid';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90))
    or (p_longitude is not null and (p_longitude < -180 or p_longitude > 180))
    or (p_radius_m is not null and (
      p_latitude is null or p_radius_m < 1 or p_radius_m > active_config.radius_cap_m
    )) then raise exception using errcode = '22023', message = 'location is invalid'; end if;
  if p_entity_types is not null and (
    cardinality(p_entity_types) = 0 or array_position(p_entity_types, null) is not null
  ) then raise exception using errcode = '22023', message = 'entity types are invalid'; end if;
  if (p_time_start is null) <> (p_time_end is null)
    or (p_time_start is not null and p_time_end <= p_time_start) then
    raise exception using errcode = '22023', message = 'time interval is invalid';
  end if;
  if p_taxonomy_node_id is not null and not exists (
    select 1 from app.taxonomy_nodes as node
    where node.id = p_taxonomy_node_id and node.active
  ) then raise exception using errcode = 'P0002', message = 'taxonomy node was not found'; end if;

  return query
  with ranked as materialized (
    select candidate.*
    from app.search_ranked_candidates(
      p_query, p_scope_id, request_now,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types,
      p_time_start, p_time_end, p_query_vector, p_search_config_version
    ) as candidate
  )
  select ranked.final_rank::smallint,
         ranked.canonical_entity_id,
         ranked.entity_type,
         canonical.canonical_name,
         coalesce(category.categories, '[]'::jsonb),
         case when ranked.entity_type = 'PLACE'
           then extensions.st_y(place.location::extensions.geometry)
           else extensions.st_y(event.effective_location::extensions.geometry)
         end,
         case when ranked.entity_type = 'PLACE'
           then extensions.st_x(place.location::extensions.geometry)
           else extensions.st_x(event.effective_location::extensions.geometry)
         end,
         ranked.distance_m,
         case when ranked.entity_type = 'PLACE'
           then nullif(btrim(document.description_text), '')
           else null::text
         end,
         place.status,
         place.opening_hours,
         event.starts_at,
         event.ends_at,
         event.source_timezone,
         event.event_status,
         case when ranked.entity_type = 'EVENT' then jsonb_strip_nulls(jsonb_build_object(
           'canonicalPlaceId', event.venue_place_id, 'name', event.venue_name
         )) else null::jsonb end,
         ranked.semantic_present,
         active_config.semantic_enabled and p_query_vector is null
  from ranked
  join app.canonical_entities as canonical on canonical.id = ranked.canonical_entity_id
  left join app.places as place
    on place.entity_id = ranked.canonical_entity_id and ranked.entity_type = 'PLACE'
  left join app.search_documents as document
    on document.entity_id = ranked.canonical_entity_id and document.is_active
  left join lateral (
    select eligible.*
    from app.search_event_eligibility(
      p_scope_id, request_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types
    ) as eligible
    where eligible.entity_id = ranked.canonical_entity_id
      and eligible.eligible
      and ranked.entity_type = 'EVENT'
  ) as event on true
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', node.id,
      'slug', node.slug,
      'label', case when p_ui_locale = 'sv' then node.label_sv else node.label_en end
    ) order by node.slug) as categories
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
    where membership.entity_id = ranked.canonical_entity_id and membership.active
  ) as category on true
  where ranked.final_rank <= p_limit
  order by ranked.final_rank;
end;
$$;

reset role;

revoke execute on function app.rrf_contributions(jsonb, integer, text[])
from public, anon, authenticated, service_role;
revoke execute on function app.search_ranked_candidates(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) from public, anon, authenticated, service_role;
grant execute on function app.rrf_contributions(jsonb, integer, text[])
to lemon_api_owner, lemon_diagnostic_owner, postgres;
grant execute on function app.search_ranked_candidates(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) to lemon_api_owner, lemon_diagnostic_owner, postgres;

revoke execute on function api.search_v1(
  uuid, text, text, text, text, uuid, double precision, double precision,
  integer, uuid, app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) from public, anon, authenticated;
grant execute on function api.search_v1(
  uuid, text, text, text, text, uuid, double precision, double precision,
  integer, uuid, app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) to service_role;

grant lemon_diagnostic_owner to postgres;
grant create on schema diagnostic to lemon_diagnostic_owner;
set role lemon_diagnostic_owner;

alter function diagnostic.explain_search_v1(jsonb, uuid)
rename to explain_search_pre_rank_v1;
revoke execute on function diagnostic.explain_search_pre_rank_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance, lemon_evaluation;

create function diagnostic.explain_search_v1(
  p_request jsonb,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = ''
as $$
declare
  base jsonb;
  active_config app.search_configs%rowtype;
  query_vector extensions.vector;
  requested_scope_id uuid;
  requested_taxonomy_node_id uuid;
  requested_entity_types app.entity_type[];
  request_latitude double precision;
  request_longitude double precision;
  request_radius_m integer;
  request_time_start timestamptz;
  request_time_end timestamptz;
  request_now timestamptz := statement_timestamp();
  ranked record;
  semantic_degraded boolean;
begin
  base := diagnostic.explain_search_pre_rank_v1(p_request, p_entity_id);
  select config.* into active_config
  from app.search_configs as config where config.is_active;

  begin
    requested_scope_id := (p_request->>'scopeId')::uuid;
    requested_taxonomy_node_id := nullif(p_request->>'taxonomyNodeId', '')::uuid;
    request_latitude := nullif(p_request#>>'{location,latitude}', '')::double precision;
    request_longitude := nullif(p_request#>>'{location,longitude}', '')::double precision;
    request_radius_m := nullif(p_request#>>'{location,radiusMeters}', '')::integer;
    request_time_start := coalesce(
      nullif(p_request->>'timeStart', '')::timestamptz,
      nullif(p_request#>>'{time,start}', '')::timestamptz
    );
    request_time_end := coalesce(
      nullif(p_request->>'timeEnd', '')::timestamptz,
      nullif(p_request#>>'{time,end}', '')::timestamptz
    );
    request_now := coalesce(nullif(p_request->>'now', '')::timestamptz, request_now);
    if p_request ? 'queryVector' then
      if jsonb_typeof(p_request->'queryVector') <> 'array'
        or jsonb_array_length(p_request->'queryVector') <> active_config.embedding_dimension then
        raise exception using errcode = '22023', message = 'ranking diagnostic vector is invalid';
      end if;
      select array_agg(value::double precision order by ordinal)::extensions.vector
      into query_vector
      from jsonb_array_elements_text(p_request->'queryVector')
        with ordinality as component(value, ordinal);
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'ranking diagnostic values are invalid';
  end;

  if p_request ? 'entityTypes' then
    begin
      select array_agg(value::app.entity_type order by ordinal)
      into requested_entity_types
      from jsonb_array_elements_text(p_request->'entityTypes')
        with ordinality as item(value, ordinal);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'ranking diagnostic entity types are invalid';
    end;
  end if;

  select candidate.* into ranked
  from app.search_ranked_candidates(
    coalesce(p_request->>'query', ''), requested_scope_id, request_now,
    request_latitude, request_longitude, request_radius_m,
    requested_taxonomy_node_id, requested_entity_types,
    request_time_start, request_time_end, query_vector, active_config.version
  ) as candidate
  where candidate.canonical_entity_id = p_entity_id;

  semantic_degraded := coalesce((p_request#>>'{semantic,degraded}')::boolean, false);
  base := jsonb_set(base, '{stages,rrf}', jsonb_build_object(
    'status', 'EXECUTED',
    'present', ranked.canonical_entity_id is not null,
    'protectedExact', ranked.protected,
    'protectionClass', ranked.protection_class,
    'participatingStages', active_config.rrf_stages,
    'stageRanks', coalesce(ranked.stage_ranks, '{}'::jsonb),
    'contributions', coalesce(ranked.rrf_contributions, '[]'::jsonb),
    'total', ranked.rrf_score,
    'preProtectionFusedRank', ranked.pre_protection_fused_rank,
    'finalRank', ranked.final_rank,
    'tieBreakKey', ranked.tie_break_key,
    'tieBreakReason', ranked.tie_break_reason,
    'semanticState', case
      when ranked.semantic_present then 'PRESENT'
      when semantic_degraded then 'DEGRADED_ABSENT'
      else 'ABSENT'
    end,
    'canonicalUnionPresence', ranked.canonical_entity_id is not null
  ), true);
  base := jsonb_set(base, '{candidateUnion,present}',
    to_jsonb(ranked.canonical_entity_id is not null), true);
  if ranked.canonical_entity_id is not null then
    base := jsonb_set(base, '{candidateUnion,provisionalUnionRank}',
      to_jsonb(ranked.pre_protection_fused_rank), true);
    base := jsonb_set(base, '{candidateUnion,postFilterRank}',
      to_jsonb(ranked.final_rank), true);
    base := jsonb_set(base, '{candidateUnion,reachedTop5}',
      to_jsonb(ranked.final_rank between 1 and 5), true);
    base := jsonb_set(base, '{reasonCodes}', jsonb_build_array(
      case when ranked.final_rank between 1 and 5 then 'TOP_5' else 'OUTSIDE_TOP_5' end
    ), true);
  end if;
  base := jsonb_set(base, '{versions,rrf}', jsonb_build_object(
    'configVersion', active_config.version,
    'rrfVersion', active_config.rrf_version,
    'k', active_config.rrf_k,
    'tiePolicy', active_config.rrf_tie_policy,
    'maxResults', active_config.rrf_max_results
  ), true);
  return base;
end;
$$;

revoke execute on function diagnostic.explain_search_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance;
grant execute on function diagnostic.explain_search_v1(jsonb, uuid)
to lemon_evaluation;

reset role;
revoke create on schema diagnostic from lemon_diagnostic_owner;
revoke lemon_diagnostic_owner from postgres;

revoke create on schema app, api from lemon_api_owner;
revoke lemon_api_owner from postgres;
