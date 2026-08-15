-- NONCOLLAPSE-01: broad-only, relevance-primary final-order adjustment.

alter table app.search_configs
  add column noncollapse_version text not null default 'NOT_IMPLEMENTED'
    check (btrim(noncollapse_version) <> ''),
  add column noncollapse_top_k smallint not null default 5
    check (noncollapse_top_k between 1 and 20),
  add column noncollapse_group_priority text[] not null default '{}'
    check (array_position(noncollapse_group_priority, null) is null),
  add column noncollapse_grouping_rules text[] not null default '{}'
    check (array_position(noncollapse_grouping_rules, null) is null),
  add column noncollapse_tie_policy text not null default 'NOT_IMPLEMENTED'
    check (btrim(noncollapse_tie_policy) <> ''),
  add constraint search_configs_noncollapse_contract_check check (
    not noncollapse_enabled or (
      noncollapse_version = 'NONCOLLAPSE_V1'
      and noncollapse_group_priority = array[
        'TAXONOMY', 'CHAIN', 'EVENT_VENUE'
      ]::text[]
      and noncollapse_grouping_rules = array[
        'TAXONOMY:ACTIVE_MEMBERSHIP_PATH_DEPTH',
        'CHAIN:EXPLICIT_CHAIN_KEY',
        'EVENT_VENUE:LINKED_PLACE_ID'
      ]::text[]
      and noncollapse_tie_policy = 'BASE_RRF_ORDER_EARLIEST_COMPARABLE_V1'
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
  noncollapse_version, noncollapse_top_k, noncollapse_group_priority,
  noncollapse_grouping_rules, noncollapse_tie_policy,
  activated_at, created_by, note
)
select 'noncollapse-v1',
       'cf017f94090c80c905be8868dd0239740726f0a9b2df929ef010b04a8675a624',
       true,
       prefix_min_length, trigram_min_length, trigram_threshold,
       exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, semantic_cap,
       rrf_k, semantic_enabled,
       embedding_provider, embedding_model, embedding_revision, embedding_dimension,
       embedding_timeout_ms, semantic_trigger_terms, event_horizon_days,
       event_freshness_by_source, radius_cap_m, true,
       array[
         'things to do', 'what to do', 'what should we do', 'something to do',
         'something fun', 'fun things', 'places to go', 'places to eat',
         'saker att göra', 'vad kan man göra', 'vad ska vi göra', 'något att göra',
         'något roligt', 'något kul', 'ställen att gå', 'ställen att äta'
       ],
       1, 0.90, 2,
       2, 2,
       rrf_enabled, rrf_version, rrf_stages, rrf_tie_policy, rrf_max_results,
       'NONCOLLAPSE_V1', 5,
       array['TAXONOMY', 'CHAIN', 'EVENT_VENUE']::text[],
       array[
         'TAXONOMY:ACTIVE_MEMBERSHIP_PATH_DEPTH',
         'CHAIN:EXPLICIT_CHAIN_KEY',
         'EVENT_VENUE:LINKED_PLACE_ID'
       ]::text[],
       'BASE_RRF_ORDER_EARLIEST_COMPARABLE_V1',
       statement_timestamp(), 'NONCOLLAPSE-01',
       'Broad EN/SV only; top-5 cap 2; base-RRF ratio 0.90; active taxonomy depth 1; explicit chain and linked Event venue keys.'
from app.search_configs
where version = 'rank-01-rrf-v1';

grant lemon_api_owner to postgres;
grant usage, create on schema app to lemon_api_owner;
set role lemon_api_owner;

create function app.noncollapse_group_keys(
  p_entity_id uuid,
  p_taxonomy_group_depth integer
)
returns table (
  taxonomy_keys uuid[],
  chain_key text,
  event_venue_key uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
           select array_agg(distinct node.path[p_taxonomy_group_depth + 1]
                            order by node.path[p_taxonomy_group_depth + 1])
           from app.entity_taxonomy_memberships as membership
           join app.taxonomy_nodes as node
             on node.id = membership.taxonomy_node_id and node.active
           where membership.entity_id = p_entity_id
             and membership.active
             and cardinality(node.path) > p_taxonomy_group_depth
         ), '{}'::uuid[]),
         canonical.chain_key,
         event.venue_place_id
  from app.canonical_entities as canonical
  left join app.events as event on event.entity_id = canonical.id
  where canonical.id = p_entity_id
$$;

create function app.noncollapse_applicability_v1(
  p_query text,
  p_taxonomy_node_id uuid,
  p_has_time boolean,
  p_has_protected_exact boolean,
  p_enabled boolean,
  p_broad_terms text[]
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  query_norm text := app.norm_v1_preserving(coalesce(p_query, ''));
  taxonomy_node app.taxonomy_nodes%rowtype;
begin
  if not p_enabled then
    return 'NOT_BROAD';
  end if;
  if p_has_protected_exact then
    return 'KNOWN_ITEM';
  end if;

  if p_taxonomy_node_id is not null then
    select node.* into taxonomy_node
    from app.taxonomy_nodes as node
    where node.id = p_taxonomy_node_id and node.active;
    if taxonomy_node.id is null or taxonomy_node.is_leaf then
      return 'NARROW_TAXONOMY';
    end if;
    if query_norm = '' then
      return 'BROAD_STRUCTURED_BROWSE';
    end if;
    return 'BROAD_PARENT_TAXONOMY';
  end if;

  if p_has_time and query_norm in ('event', 'events', 'evenemang') then
    return 'BROAD_TIME_DISCOVERY';
  end if;
  if exists (
    select 1
    from unnest(p_broad_terms) as configured(term)
    where (' ' || query_norm || ' ') like ('% ' || configured.term || ' %')
  ) then
    return 'BROAD_TERM';
  end if;
  return 'NOT_BROAD';
end;
$$;

create function app.apply_noncollapse_v1(
  p_candidates jsonb,
  p_apply boolean,
  p_inapplicable_reason text,
  p_top_k integer,
  p_taxonomy_cap integer,
  p_chain_cap integer,
  p_event_venue_cap integer,
  p_comparable_ratio real
)
returns table (
  entity_id uuid,
  base_rank integer,
  final_rank integer,
  base_rrf numeric,
  moved boolean,
  move_direction text,
  concentration_details jsonb,
  count_before integer,
  configured_cap integer,
  displaced_entity_id uuid,
  displaced_rrf numeric,
  comparability_result boolean,
  movement_reason text,
  abstention_reason text
)
language plpgsql
volatile
set search_path = ''
as $$
declare
  pending jsonb := coalesce(p_candidates, '[]'::jsonb);
  output_rows jsonb := '[]'::jsonb;
  current_candidate jsonb;
  alternative jsonb;
  shifted jsonb;
  concentrations jsonb;
  taxonomy_key text;
  chain_value text;
  venue_value text;
  output_position integer;
  group_count integer;
  found_alternative boolean;
  has_any_group_key boolean;
begin
  if jsonb_typeof(pending) <> 'array'
    or p_top_k < 1
    or p_taxonomy_cap < 1
    or p_chain_cap < 1
    or p_event_venue_cap < 1
    or p_comparable_ratio <= 0
    or p_comparable_ratio > 1
  then
    raise exception using errcode = '22023', message = 'non-collapse inputs are invalid';
  end if;

  if jsonb_array_length(pending) = 0 then
    return;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(pending) as candidate(value)
    where candidate.value->>'entityId' is null
      or candidate.value->>'baseRank' !~ '^[1-9][0-9]*$'
      or candidate.value->>'baseRrf' !~ '^[0-9]+([.][0-9]+)?$'
      or jsonb_typeof(coalesce(candidate.value->'taxonomyKeys', '[]'::jsonb)) <> 'array'
  ) or (
    select count(*) <> count(distinct candidate.value->>'entityId')
      or count(*) <> count(distinct candidate.value->>'baseRank')
    from jsonb_array_elements(pending) as candidate(value)
  ) then
    raise exception using errcode = '22023', message = 'non-collapse candidates are invalid';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(pending) as candidate(value)
    where jsonb_array_length(coalesce(candidate.value->'taxonomyKeys', '[]'::jsonb)) > 0
      or candidate.value->>'chainKey' is not null
      or candidate.value->>'eventVenueKey' is not null
  ) into has_any_group_key;

  while jsonb_array_length(pending) > 0 loop
    current_candidate := pending->0;
    output_position := jsonb_array_length(output_rows) + 1;

    if not p_apply or output_position > p_top_k then
      current_candidate := current_candidate || jsonb_build_object(
        '_abstentionReason', case
          when not p_apply then p_inapplicable_reason
          else null
        end
      );
      output_rows := output_rows || jsonb_build_array(current_candidate);
      pending := pending - 0;
      continue;
    end if;

    concentrations := '[]'::jsonb;
    for taxonomy_key in
      select value
      from jsonb_array_elements_text(
        coalesce(current_candidate->'taxonomyKeys', '[]'::jsonb)
      ) as key(value)
      order by value
    loop
      select count(*) into group_count
      from jsonb_array_elements(output_rows) as emitted(value)
      where coalesce(emitted.value->'taxonomyKeys', '[]'::jsonb) ? taxonomy_key;
      if group_count >= p_taxonomy_cap then
        concentrations := concentrations || jsonb_build_array(jsonb_build_object(
          'type', 'TAXONOMY', 'key', taxonomy_key,
          'countBefore', group_count, 'cap', p_taxonomy_cap
        ));
      end if;
    end loop;

    chain_value := current_candidate->>'chainKey';
    if chain_value is not null then
      select count(*) into group_count
      from jsonb_array_elements(output_rows) as emitted(value)
      where emitted.value->>'chainKey' = chain_value;
      if group_count >= p_chain_cap then
        concentrations := concentrations || jsonb_build_array(jsonb_build_object(
          'type', 'CHAIN', 'key', chain_value,
          'countBefore', group_count, 'cap', p_chain_cap
        ));
      end if;
    end if;

    venue_value := current_candidate->>'eventVenueKey';
    if venue_value is not null then
      select count(*) into group_count
      from jsonb_array_elements(output_rows) as emitted(value)
      where emitted.value->>'eventVenueKey' = venue_value;
      if group_count >= p_event_venue_cap then
        concentrations := concentrations || jsonb_build_array(jsonb_build_object(
          'type', 'EVENT_VENUE', 'key', venue_value,
          'countBefore', group_count, 'cap', p_event_venue_cap
        ));
      end if;
    end if;

    if jsonb_array_length(concentrations) = 0 then
      current_candidate := current_candidate || jsonb_build_object(
        '_abstentionReason', case
          when has_any_group_key then 'NO_CONCENTRATION'
          else 'NO_STABLE_GROUP_KEY'
        end
      );
      output_rows := output_rows || jsonb_build_array(current_candidate);
      pending := pending - 0;
      continue;
    end if;

    found_alternative := false;
    if jsonb_array_length(pending) > 1 then
      for alternative_index in 1..jsonb_array_length(pending) - 1 loop
        alternative := pending->alternative_index;
        if (alternative->>'baseRrf')::numeric
             < (current_candidate->>'baseRrf')::numeric * p_comparable_ratio::numeric then
          continue;
        end if;

        if exists (
          select 1
          from jsonb_array_elements(concentrations) as breached(value)
          where case breached.value->>'type'
            when 'TAXONOMY' then
              coalesce(alternative->'taxonomyKeys', '[]'::jsonb) ? (breached.value->>'key')
            when 'CHAIN' then alternative->>'chainKey' = breached.value->>'key'
            when 'EVENT_VENUE' then alternative->>'eventVenueKey' = breached.value->>'key'
            else true
          end
        ) then
          continue;
        end if;

        if exists (
          select 1
          from jsonb_array_elements_text(
            coalesce(alternative->'taxonomyKeys', '[]'::jsonb)
          ) as alternative_key(value)
          where (
            select count(*)
            from jsonb_array_elements(output_rows) as emitted(value)
            where coalesce(emitted.value->'taxonomyKeys', '[]'::jsonb)
              ? alternative_key.value
          ) >= p_taxonomy_cap
        ) or (
          alternative->>'chainKey' is not null and (
            select count(*)
            from jsonb_array_elements(output_rows) as emitted(value)
            where emitted.value->>'chainKey' = alternative->>'chainKey'
          ) >= p_chain_cap
        ) or (
          alternative->>'eventVenueKey' is not null and (
            select count(*)
            from jsonb_array_elements(output_rows) as emitted(value)
            where emitted.value->>'eventVenueKey' = alternative->>'eventVenueKey'
          ) >= p_event_venue_cap
        ) then
          continue;
        end if;

        alternative := alternative || jsonb_build_object(
          '_concentrationDetails', concentrations,
          '_displacedEntityId', current_candidate->>'entityId',
          '_displacedRrf', (current_candidate->>'baseRrf')::numeric,
          '_comparabilityResult', true,
          '_movementReason', 'EARLIEST_COMPARABLE_GROUP_RELIEF'
        );

        for shifted_index in 0..alternative_index - 1 loop
          shifted := pending->shifted_index;
          if not shifted ? '_movementReason' then
            shifted := shifted || jsonb_build_object(
              '_concentrationDetails', concentrations,
              '_displacedEntityId', alternative->>'entityId',
              '_displacedRrf', (alternative->>'baseRrf')::numeric,
              '_comparabilityResult', true,
              '_movementReason', 'DEFERRED_BY_COMPARABLE_GROUP_RELIEF'
            );
            pending := jsonb_set(pending, array[shifted_index::text], shifted);
          end if;
        end loop;

        output_rows := output_rows || jsonb_build_array(alternative);
        pending := pending - alternative_index;
        found_alternative := true;
        exit;
      end loop;
    end if;

    if not found_alternative then
      current_candidate := current_candidate || jsonb_build_object(
        '_concentrationDetails', concentrations,
        '_comparabilityResult', false,
        '_abstentionReason', 'NO_COMPARABLE_ALTERNATIVE'
      );
      output_rows := output_rows || jsonb_build_array(current_candidate);
      pending := pending - 0;
    end if;
  end loop;

  return query
  select (item.value->>'entityId')::uuid,
         (item.value->>'baseRank')::integer,
         item.ordinality::integer,
         (item.value->>'baseRrf')::numeric,
         (item.value->>'baseRank')::integer <> item.ordinality::integer,
         case
           when (item.value->>'baseRank')::integer > item.ordinality then 'UP'
           when (item.value->>'baseRank')::integer < item.ordinality then 'DOWN'
           else 'UNCHANGED'
         end,
         coalesce(item.value->'_concentrationDetails', '[]'::jsonb),
         nullif(item.value#>>'{_concentrationDetails,0,countBefore}', '')::integer,
         nullif(item.value#>>'{_concentrationDetails,0,cap}', '')::integer,
         nullif(item.value->>'_displacedEntityId', '')::uuid,
         nullif(item.value->>'_displacedRrf', '')::numeric,
         nullif(item.value->>'_comparabilityResult', '')::boolean,
         item.value->>'_movementReason',
         item.value->>'_abstentionReason'
  from jsonb_array_elements(output_rows) with ordinality as item(value, ordinality)
  order by item.ordinality;
end;
$$;

alter function app.search_ranked_candidates(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) rename to search_ranked_candidates_pre_noncollapse_v1;

create function app.search_noncollapse_candidates(
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
  base_rank integer,
  final_rank integer,
  direct_taxonomy boolean,
  distance_m integer,
  semantic_present boolean,
  tie_break_key uuid,
  tie_break_reason text,
  noncollapse_applicable boolean,
  applicability_reason text,
  moved boolean,
  move_direction text,
  concentration_details jsonb,
  count_before integer,
  configured_cap integer,
  displaced_entity_id uuid,
  displaced_rrf numeric,
  comparability_result boolean,
  movement_reason text,
  abstention_reason text,
  taxonomy_group_keys uuid[],
  chain_group_key text,
  event_venue_group_key uuid
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
    or not active_config.noncollapse_enabled
    or active_config.noncollapse_version <> 'NONCOLLAPSE_V1'
  then
    raise exception using errcode = '55000', message = 'non-collapse configuration is unavailable';
  end if;

  return query
  with base as materialized (
    select ranked.*,
           ranked.final_rank as base_rank,
           grouped.taxonomy_keys as taxonomy_group_keys,
           grouped.chain_key as chain_group_key,
           grouped.event_venue_key as event_venue_group_key
    from app.search_ranked_candidates_pre_noncollapse_v1(
      p_query, p_scope_id, p_now, p_latitude, p_longitude, p_radius_m,
      p_taxonomy_node_id, p_entity_types, p_time_start, p_time_end,
      p_query_vector, p_search_config_version
    ) as ranked
    cross join lateral app.noncollapse_group_keys(
      ranked.canonical_entity_id, active_config.taxonomy_group_depth
    ) as grouped
  ),
  context as materialized (
    select app.noncollapse_applicability_v1(
             p_query, p_taxonomy_node_id, p_time_start is not null,
             coalesce(bool_or(base.protected), false),
             active_config.noncollapse_enabled, active_config.broad_terms
           ) as applicability,
           coalesce(jsonb_agg(jsonb_build_object(
             'entityId', base.canonical_entity_id,
             'baseRank', base.final_rank,
             'baseRrf', base.rrf_score,
             'taxonomyKeys', to_jsonb(base.taxonomy_group_keys),
             'chainKey', base.chain_group_key,
             'eventVenueKey', base.event_venue_group_key
           ) order by base.final_rank), '[]'::jsonb) as candidate_payload
    from base
  ),
  adjusted as materialized (
    select movement.*
    from context
    cross join lateral app.apply_noncollapse_v1(
      context.candidate_payload,
      context.applicability like 'BROAD_%',
      case when context.applicability = 'KNOWN_ITEM'
        then 'PROTECTED_TIER' else context.applicability end,
      active_config.noncollapse_top_k,
      active_config.top_k_group_cap,
      active_config.chain_repetition_cap,
      active_config.event_venue_repetition_cap,
      active_config.comparable_rrf_ratio
    ) as movement
  )
  select base.canonical_entity_id, base.entity_type, base.protected,
         base.protection_class, base.stage_ranks, base.rrf_contributions,
         base.rrf_score, base.pre_protection_fused_rank, base.base_rank,
         adjusted.final_rank, base.direct_taxonomy, base.distance_m,
         base.semantic_present, base.tie_break_key, base.tie_break_reason,
         context.applicability like 'BROAD_%', context.applicability,
         adjusted.moved, adjusted.move_direction,
         adjusted.concentration_details, adjusted.count_before,
         adjusted.configured_cap, adjusted.displaced_entity_id,
         adjusted.displaced_rrf, adjusted.comparability_result,
         adjusted.movement_reason, adjusted.abstention_reason,
         base.taxonomy_group_keys, base.chain_group_key, base.event_venue_group_key
  from adjusted
  join base
    on base.canonical_entity_id = adjusted.entity_id
  cross join context
  order by adjusted.final_rank;
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
language sql
volatile
security definer
set search_path = ''
as $$
  select candidate.canonical_entity_id, candidate.entity_type,
         candidate.protected, candidate.protection_class,
         candidate.stage_ranks, candidate.rrf_contributions,
         candidate.rrf_score, candidate.pre_protection_fused_rank,
         candidate.final_rank, candidate.direct_taxonomy, candidate.distance_m,
         candidate.semantic_present, candidate.tie_break_key, candidate.tie_break_reason
  from app.search_noncollapse_candidates(
    p_query, p_scope_id, p_now, p_latitude, p_longitude, p_radius_m,
    p_taxonomy_node_id, p_entity_types, p_time_start, p_time_end,
    p_query_vector, p_search_config_version
  ) as candidate
  order by candidate.final_rank
$$;

reset role;

revoke execute on function app.noncollapse_group_keys(uuid, integer)
from public, anon, authenticated, service_role;
revoke execute on function app.noncollapse_applicability_v1(
  text, uuid, boolean, boolean, boolean, text[]
) from public, anon, authenticated, service_role;
revoke execute on function app.apply_noncollapse_v1(
  jsonb, boolean, text, integer, integer, integer, integer, real
) from public, anon, authenticated, service_role;
revoke execute on function app.search_ranked_candidates_pre_noncollapse_v1(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) from public, anon, authenticated, service_role;
revoke execute on function app.search_noncollapse_candidates(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) from public, anon, authenticated, service_role;
revoke execute on function app.search_ranked_candidates(
  text, uuid, timestamptz, double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector, text
) from public, anon, authenticated, service_role;

grant execute on function app.noncollapse_group_keys(uuid, integer),
  app.noncollapse_applicability_v1(text, uuid, boolean, boolean, boolean, text[]),
  app.apply_noncollapse_v1(jsonb, boolean, text, integer, integer, integer, integer, real),
  app.search_ranked_candidates_pre_noncollapse_v1(
    text, uuid, timestamptz, double precision, double precision, integer, uuid,
    app.entity_type[], timestamptz, timestamptz, extensions.vector, text
  ),
  app.search_noncollapse_candidates(
    text, uuid, timestamptz, double precision, double precision, integer, uuid,
    app.entity_type[], timestamptz, timestamptz, extensions.vector, text
  ),
  app.search_ranked_candidates(
    text, uuid, timestamptz, double precision, double precision, integer, uuid,
    app.entity_type[], timestamptz, timestamptz, extensions.vector, text
  )
to lemon_api_owner, lemon_diagnostic_owner, postgres;

grant lemon_diagnostic_owner to postgres;
grant create on schema diagnostic to lemon_diagnostic_owner;
set role lemon_diagnostic_owner;

alter function diagnostic.explain_search_v1(jsonb, uuid)
rename to explain_search_pre_noncollapse_v1;
revoke execute on function diagnostic.explain_search_pre_noncollapse_v1(jsonb, uuid)
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
begin
  base := diagnostic.explain_search_pre_noncollapse_v1(p_request, p_entity_id);
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
        raise exception using errcode = '22023', message = 'non-collapse diagnostic vector is invalid';
      end if;
      select array_agg(value::double precision order by ordinal)::extensions.vector
      into query_vector
      from jsonb_array_elements_text(p_request->'queryVector')
        with ordinality as component(value, ordinal);
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'non-collapse diagnostic values are invalid';
  end;

  if p_request ? 'entityTypes' then
    begin
      select array_agg(value::app.entity_type order by ordinal)
      into requested_entity_types
      from jsonb_array_elements_text(p_request->'entityTypes')
        with ordinality as item(value, ordinal);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'non-collapse diagnostic entity types are invalid';
    end;
  end if;

  select candidate.* into ranked
  from app.search_noncollapse_candidates(
    coalesce(p_request->>'query', ''), requested_scope_id, request_now,
    request_latitude, request_longitude, request_radius_m,
    requested_taxonomy_node_id, requested_entity_types,
    request_time_start, request_time_end, query_vector, active_config.version
  ) as candidate
  where candidate.canonical_entity_id = p_entity_id;

  base := jsonb_set(base, '{stages,nonCollapse}', jsonb_build_object(
    'status', 'EXECUTED',
    'applicable', coalesce(ranked.noncollapse_applicable, false),
    'applicabilityReason', coalesce(ranked.applicability_reason,
      app.noncollapse_applicability_v1(
        coalesce(p_request->>'query', ''), requested_taxonomy_node_id,
        request_time_start is not null, false,
        active_config.noncollapse_enabled, active_config.broad_terms
      )),
    'configVersion', active_config.version,
    'ruleVersion', active_config.noncollapse_version,
    'baseRank', ranked.base_rank,
    'finalRank', ranked.final_rank,
    'moved', coalesce(ranked.moved, false),
    'moveDirection', ranked.move_direction,
    'concentrations', coalesce(ranked.concentration_details, '[]'::jsonb),
    'concentrationType', ranked.concentration_details#>>'{0,type}',
    'concentrationKey', ranked.concentration_details#>>'{0,key}',
    'countBefore', ranked.count_before,
    'configuredCap', ranked.configured_cap,
    'candidateBaseRrf', ranked.rrf_score,
    'displacedCandidateBaseRrf', ranked.displaced_rrf,
    'comparabilityResult', ranked.comparability_result,
    'movementReason', ranked.movement_reason,
    'abstentionReason', ranked.abstention_reason,
    'groupKeys', jsonb_build_object(
      'taxonomy', coalesce(to_jsonb(ranked.taxonomy_group_keys), '[]'::jsonb),
      'chain', ranked.chain_group_key,
      'eventVenue', ranked.event_venue_group_key
    )
  ), true);
  if ranked.canonical_entity_id is not null then
    base := jsonb_set(base, '{stages,rrf,finalRank}', to_jsonb(ranked.base_rank), true);
    base := jsonb_set(base, '{candidateUnion,postFilterRank}', to_jsonb(ranked.final_rank), true);
    base := jsonb_set(base, '{candidateUnion,reachedTop5}',
      to_jsonb(ranked.final_rank between 1 and 5), true);
  end if;
  base := jsonb_set(base, '{versions,nonCollapse}', jsonb_build_object(
    'configVersion', active_config.version,
    'ruleVersion', active_config.noncollapse_version,
    'broadTerms', active_config.broad_terms,
    'topK', active_config.noncollapse_top_k,
    'taxonomyGroupDepth', active_config.taxonomy_group_depth,
    'comparableRrfRatio', active_config.comparable_rrf_ratio,
    'taxonomyCap', active_config.top_k_group_cap,
    'chainCap', active_config.chain_repetition_cap,
    'eventVenueCap', active_config.event_venue_repetition_cap,
    'groupPriority', active_config.noncollapse_group_priority,
    'groupingRules', active_config.noncollapse_grouping_rules,
    'tiePolicy', active_config.noncollapse_tie_policy
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

revoke create on schema app from lemon_api_owner;
revoke lemon_api_owner from postgres;
