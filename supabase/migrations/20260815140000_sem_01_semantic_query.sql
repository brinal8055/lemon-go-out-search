-- SEM-01: exact compatible semantic candidates and additive vector-or-NULL search.

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
)
select 'sem-01-query-v1',
       'f8f64add5348d084e8525a08c122d24d8fe61750e2f27f8db39da750fafd492f',
       true,
       prefix_min_length, trigram_min_length, trigram_threshold,
       exact_cap, prefix_cap, trigram_cap, fts_cap, taxonomy_cap, event_cap, 30,
       rrf_k, true,
       embedding_provider, embedding_model, embedding_revision, embedding_dimension,
       700,
       array[
         'things to do', 'what to do', 'something to do', 'places to go',
         'saker att göra', 'vad kan man göra', 'något att göra', 'ställen att gå',
         'date night', 'family outing', 'with friends', 'birthday', 'celebrate',
         'dejt', 'familjeutflykt', 'med vänner', 'födelsedag', 'fira',
         'nearby', 'near me', 'within', 'outdoor', 'open now',
         'i närheten', 'nära mig', 'inom', 'utomhus', 'öppet nu'
       ],
       event_horizon_days, event_freshness_by_source, radius_cap_m,
       noncollapse_enabled,
       array[
         'things to do', 'what to do', 'something to do', 'places to go',
         'saker att göra', 'vad kan man göra', 'något att göra', 'ställen att gå'
       ],
       taxonomy_group_depth, comparable_rrf_ratio, top_k_group_cap,
       chain_repetition_cap, event_venue_repetition_cap,
       statement_timestamp(), 'SEM-01',
       'Voyage-4 query template v1, exact cosine candidates, 700 ms fail-open; RRF remains absent.'
from app.search_configs
where version = 'embed-01b-voyage-4-v1';

grant select on app.embeddings, app.compatible_ready_embeddings_v
to lemon_api_owner, lemon_diagnostic_owner;
create policy embeddings_semantic_owner_read
on app.embeddings for select to lemon_api_owner, lemon_diagnostic_owner using (true);

grant lemon_api_owner to postgres;
grant usage, create on schema app, api to lemon_api_owner;
set role lemon_api_owner;

alter function api.search_v1(
  uuid, text, text, text, text, uuid, double precision, double precision,
  integer, uuid, app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) set schema app;
alter function app.search_v1(
  uuid, text, text, text, text, uuid, double precision, double precision,
  integer, uuid, app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) rename to search_v1_deterministic_v1;

create or replace function app.search_semantic_candidates(
  p_query_vector extensions.vector,
  p_scope_id uuid,
  p_now timestamptz,
  p_horizon_days integer,
  p_freshness_by_source jsonb,
  p_time_start timestamptz,
  p_time_end timestamptz,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_taxonomy_node_id uuid,
  p_entity_types app.entity_type[],
  p_provider text,
  p_model text,
  p_revision text,
  p_dimension integer,
  p_cap integer
)
returns table (
  canonical_entity_id uuid,
  entity_type app.entity_type,
  cosine_distance double precision,
  cosine_similarity double precision,
  candidate_rank integer,
  eligibility_passed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cap < 1 or p_cap > 200 then
    raise exception using errcode = '22023', message = 'semantic candidate cap is invalid';
  end if;
  if p_query_vector is null then return; end if;
  if extensions.vector_dims(p_query_vector) <> p_dimension
    or not (
      extensions.vector_norm(p_query_vector) > 0
      and extensions.vector_norm(p_query_vector) < 'Infinity'::real
    ) then
    raise exception using errcode = '22023', message = 'semantic query vector is invalid';
  end if;

  return query
  with eligible_places as materialized (
    select eligible.entity_id, 'PLACE'::app.entity_type as entity_type
    from app.search_eligible_places_v as eligible
    join app.places as place on place.entity_id = eligible.entity_id
    where eligible.scope_id = p_scope_id
      and (p_entity_types is null or 'PLACE'::app.entity_type = any(p_entity_types))
      and (p_taxonomy_node_id is null or exists (
        select 1
        from app.entity_taxonomy_memberships as membership
        join app.taxonomy_nodes as node
          on node.id = membership.taxonomy_node_id and node.active
        where membership.entity_id = eligible.entity_id and membership.active
          and p_taxonomy_node_id = any(node.path)
      ))
      and (p_radius_m is null or extensions.st_dwithin(
        place.location,
        extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
          ::extensions.geography,
        p_radius_m
      ))
  ),
  eligible_events as materialized (
    select eligible.entity_id, 'EVENT'::app.entity_type as entity_type
    from app.search_event_eligibility(
      p_scope_id, p_now, p_horizon_days, p_freshness_by_source,
      p_time_start, p_time_end, p_latitude, p_longitude, p_radius_m,
      p_taxonomy_node_id, p_entity_types
    ) as eligible
    where eligible.eligible
  ),
  eligible as (
    select * from eligible_places
    union all
    select * from eligible_events
  ),
  scored as materialized (
    select compatible.entity_id,
           eligible.entity_type,
           compatible.embedding operator(extensions.<=>) p_query_vector as distance
    from app.compatible_ready_embeddings_v as compatible
    join eligible on eligible.entity_id = compatible.entity_id
    where compatible.provider = p_provider
      and compatible.model = p_model
      and compatible.model_revision = p_revision
      and compatible.dimension = p_dimension
  ),
  bounded as (
    select scored.*
    from scored
    order by scored.distance, scored.entity_id
    limit p_cap
  )
  select bounded.entity_id,
         bounded.entity_type,
         bounded.distance,
         1.0 - bounded.distance,
         row_number() over (order by bounded.distance, bounded.entity_id)::integer,
         true
  from bounded
  order by bounded.distance, bounded.entity_id;
end;
$$;

revoke execute on function app.search_v1_deterministic_v1(
  uuid, text, text, text, text, uuid, double precision, double precision,
  integer, uuid, app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) from public, anon, authenticated, service_role;

create function api.search_v1(
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
  request_now timestamptz := statement_timestamp();
begin
  select config.* into active_config
  from app.search_configs as config
  where config.is_active;

  return query
  with deterministic as materialized (
    select result.*
    from app.search_v1_deterministic_v1(
      p_request_id, p_query, p_query_norm, p_query_ascii, p_ui_locale, p_scope_id,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types,
      p_time_start, p_time_end, p_query_vector,
      p_embedding_provider, p_embedding_model, p_embedding_revision,
      p_embedding_dimension, p_limit, p_search_config_version
    ) as result
  ),
  semantic as materialized (
    select candidate.*
    from app.search_semantic_candidates(
      p_query_vector, p_scope_id, request_now,
      active_config.event_horizon_days, active_config.event_freshness_by_source,
      p_time_start, p_time_end, p_latitude, p_longitude, p_radius_m,
      p_taxonomy_node_id, p_entity_types,
      p_embedding_provider, p_embedding_model, p_embedding_revision,
      p_embedding_dimension, active_config.semantic_cap
    ) as candidate
  ),
  semantic_places as (
    select semantic.canonical_entity_id as entity_id,
           semantic.entity_type,
           canonical.canonical_name as display_name,
           extensions.st_y(place.location::extensions.geometry) as latitude,
           extensions.st_x(place.location::extensions.geometry) as longitude,
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             place.location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end as distance_m,
           nullif(btrim(document.description_text), '') as factual_summary,
           place.status as place_status,
           place.opening_hours,
           null::timestamptz as event_starts_at,
           null::timestamptz as event_ends_at,
           null::text as event_timezone,
           null::app.event_status as event_status,
           null::jsonb as venue,
           semantic.candidate_rank
    from semantic
    join app.canonical_entities as canonical on canonical.id = semantic.canonical_entity_id
    join app.places as place on place.entity_id = semantic.canonical_entity_id
    left join app.search_documents as document
      on document.entity_id = semantic.canonical_entity_id and document.is_active
    where semantic.entity_type = 'PLACE'
  ),
  semantic_events as (
    select semantic.canonical_entity_id as entity_id,
           semantic.entity_type,
           eligible.canonical_name as display_name,
           extensions.st_y(eligible.effective_location::extensions.geometry) as latitude,
           extensions.st_x(eligible.effective_location::extensions.geometry) as longitude,
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             eligible.effective_location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end as distance_m,
           null::text as factual_summary,
           null::app.place_status as place_status,
           null::jsonb as opening_hours,
           eligible.starts_at as event_starts_at,
           eligible.ends_at as event_ends_at,
           eligible.source_timezone as event_timezone,
           eligible.event_status,
           jsonb_strip_nulls(jsonb_build_object(
             'canonicalPlaceId', eligible.venue_place_id, 'name', eligible.venue_name
           )) as venue,
           semantic.candidate_rank
    from semantic
    join app.search_event_eligibility(
      p_scope_id, request_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types
    ) as eligible
      on eligible.entity_id = semantic.canonical_entity_id and eligible.eligible
    where semantic.entity_type = 'EVENT'
  ),
  unioned as (
    select deterministic.entity_id, deterministic.entity_type, deterministic.display_name,
           deterministic.latitude, deterministic.longitude, deterministic.distance_m,
           deterministic.factual_summary, deterministic.place_status,
           deterministic.opening_hours, deterministic.event_starts_at,
           deterministic.event_ends_at, deterministic.event_timezone,
           deterministic.event_status, deterministic.venue,
           1 as source_order, deterministic.result_position::integer as source_rank,
           false as semantic_stage
    from deterministic
    union all
    select semantic_places.entity_id, semantic_places.entity_type,
           semantic_places.display_name, semantic_places.latitude, semantic_places.longitude,
           semantic_places.distance_m, semantic_places.factual_summary,
           semantic_places.place_status, semantic_places.opening_hours,
           semantic_places.event_starts_at, semantic_places.event_ends_at,
           semantic_places.event_timezone, semantic_places.event_status,
           semantic_places.venue, 2, semantic_places.candidate_rank, true
    from semantic_places
    union all
    select semantic_events.entity_id, semantic_events.entity_type,
           semantic_events.display_name, semantic_events.latitude, semantic_events.longitude,
           semantic_events.distance_m, semantic_events.factual_summary,
           semantic_events.place_status, semantic_events.opening_hours,
           semantic_events.event_starts_at, semantic_events.event_ends_at,
           semantic_events.event_timezone, semantic_events.event_status,
           semantic_events.venue, 2, semantic_events.candidate_rank, true
    from semantic_events
  ),
  annotated as (
    select unioned.*,
           bool_or(unioned.semantic_stage) over (partition by unioned.entity_id) as semantic_present,
           row_number() over (
             partition by unioned.entity_id
             order by unioned.source_order, unioned.source_rank, unioned.entity_id
           ) as entity_row
    from unioned
  ),
  ranked as (
    select annotated.*,
           row_number() over (
             order by annotated.source_order, annotated.source_rank, annotated.entity_id
           ) as position
    from annotated
    where annotated.entity_row = 1
  )
  select ranked.position::smallint,
         ranked.entity_id,
         ranked.entity_type,
         ranked.display_name,
         coalesce(category.categories, '[]'::jsonb),
         ranked.latitude,
         ranked.longitude,
         ranked.distance_m,
         ranked.factual_summary,
         ranked.place_status,
         ranked.opening_hours,
         ranked.event_starts_at,
         ranked.event_ends_at,
         ranked.event_timezone,
         ranked.event_status,
         ranked.venue,
         ranked.semantic_present,
         active_config.semantic_enabled and p_query_vector is null
  from ranked
  left join lateral (
    select jsonb_agg(jsonb_build_object(
      'id', node.id,
      'slug', node.slug,
      'label', case when p_ui_locale = 'sv' then node.label_sv else node.label_en end
    ) order by node.slug) as categories
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
    where membership.entity_id = ranked.entity_id and membership.active
  ) as category on true
  where ranked.position <= p_limit
  order by ranked.position;
end;
$$;

reset role;

revoke execute on function app.search_semantic_candidates(
  extensions.vector, uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[],
  text, text, text, integer, integer
) from public, anon, authenticated, service_role;
grant execute on function app.search_semantic_candidates(
  extensions.vector, uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[],
  text, text, text, integer, integer
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
rename to explain_search_pre_sem_v1;
revoke execute on function diagnostic.explain_search_pre_sem_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance, lemon_evaluation;

create or replace function diagnostic.explain_search_v1(
  p_request jsonb,
  p_entity_id uuid
)
returns jsonb
language plpgsql
security definer
stable
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
  candidate record;
  compatible_count integer;
  should_embed_reason text;
  degradation_reason text;
  semantic_present boolean;
  union_present boolean;
  stage_evidence jsonb;
begin
  base := diagnostic.explain_search_pre_sem_v1(p_request, p_entity_id);
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
        raise exception using errcode = '22023', message = 'semantic diagnostic vector is invalid';
      end if;
      select array_agg(value::double precision order by ordinal)::extensions.vector
      into query_vector
      from jsonb_array_elements_text(p_request->'queryVector')
        with ordinality as component(value, ordinal);
    end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'semantic diagnostic values are invalid';
  end;
  if p_request ? 'entityTypes' then
    begin
      select array_agg(value::app.entity_type order by ordinal)
      into requested_entity_types
      from jsonb_array_elements_text(p_request->'entityTypes')
        with ordinality as item(value, ordinal);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'semantic diagnostic entity types are invalid';
    end;
  end if;

  select count(*)::integer into compatible_count
  from app.compatible_ready_embeddings_v as compatible
  where compatible.provider = active_config.embedding_provider
    and compatible.model = active_config.embedding_model
    and compatible.model_revision = active_config.embedding_revision
    and compatible.dimension = active_config.embedding_dimension;

  select semantic.* into candidate
  from app.search_semantic_candidates(
    query_vector, requested_scope_id, request_now,
    active_config.event_horizon_days, active_config.event_freshness_by_source,
    request_time_start, request_time_end, request_latitude, request_longitude,
    request_radius_m, requested_taxonomy_node_id, requested_entity_types,
    active_config.embedding_provider, active_config.embedding_model,
    active_config.embedding_revision, active_config.embedding_dimension,
    active_config.semantic_cap
  ) as semantic
  where semantic.canonical_entity_id = p_entity_id;

  should_embed_reason := case
    when p_request#>>'{semantic,shouldEmbedReason}' = any(array[
      'SEMANTIC_DISABLED', 'CIRCUIT_OPEN', 'EMPTY_QUERY', 'TIME_ONLY',
      'TAXONOMY_ONLY', 'CONSERVATIVE_KNOWN_ITEM', 'BROAD_DISCOVERY',
      'OCCASION_INTENT', 'MIXED_CONSTRAINTS', 'UNCERTAIN_MULTI_TOKEN'
    ]) then p_request#>>'{semantic,shouldEmbedReason}'
    else 'UNAVAILABLE'
  end;
  degradation_reason := case
    when p_request#>>'{semantic,degradationReason}' = any(array[
      'CIRCUIT_OPEN', 'TIMEOUT', 'RATE_LIMIT', 'PROVIDER_5XX',
      'INVALID_VECTOR', 'INVALID_RESPONSE', 'PROVIDER_UNAVAILABLE', 'PROVIDER_ERROR'
    ]) then p_request#>>'{semantic,degradationReason}'
    else null
  end;
  semantic_present := candidate.canonical_entity_id is not null;
  union_present := coalesce((base#>>'{candidateUnion,present}')::boolean, false)
    or semantic_present;
  stage_evidence := coalesce(base#>'{candidateUnion,stageEvidence}', '[]'::jsonb)
    || case when semantic_present then jsonb_build_array(jsonb_build_object(
      'stage', 'semantic', 'rank', candidate.candidate_rank,
      'cosineDistance', round(candidate.cosine_distance::numeric, 8),
      'cosineSimilarity', round(candidate.cosine_similarity::numeric, 8)
    )) else '[]'::jsonb end;

  base := jsonb_set(base, '{semanticDecision}', jsonb_build_object(
    'shouldEmbed', case when p_request#>>'{semantic,shouldEmbed}' in ('true', 'false')
      then (p_request#>>'{semantic,shouldEmbed}')::boolean else null end,
    'reason', should_embed_reason,
    'attempted', coalesce((p_request#>>'{semantic,attempted}')::boolean, false),
    'success', coalesce((p_request#>>'{semantic,success}')::boolean, false),
    'degraded', coalesce((p_request#>>'{semantic,degraded}')::boolean, false),
    'degradationReason', degradation_reason,
    'queryVectorCompatibility', case when query_vector is null then 'ABSENT' else 'VALID' end
  ), true);
  base := jsonb_set(base, '{stages,semantic}', jsonb_build_object(
    'status', case when query_vector is null then 'SKIPPED' else 'EXECUTED' end,
    'present', semantic_present,
    'rank', candidate.candidate_rank,
    'cosineDistance', case when semantic_present
      then round(candidate.cosine_distance::numeric, 8) else null end,
    'cosineSimilarity', case when semantic_present
      then round(candidate.cosine_similarity::numeric, 8) else null end,
    'compatibleReadyCount', compatible_count,
    'cap', active_config.semantic_cap
  ), true);
  base := jsonb_set(base, '{candidateUnion,present}', to_jsonb(union_present), true);
  base := jsonb_set(base, '{candidateUnion,stageEvidence}', stage_evidence, true);
  base := jsonb_set(base, '{candidateUnion,stagePresenceImpliesUnion}', 'true'::jsonb, true);
  base := jsonb_set(base, '{versions,embedding}', jsonb_build_object(
    'status', case when semantic_present then 'READY_COMPATIBLE' else 'NOT_PRESENT_FOR_ENTITY' end,
    'provider', active_config.embedding_provider,
    'model', active_config.embedding_model,
    'revision', active_config.embedding_revision,
    'dimension', active_config.embedding_dimension,
    'queryTemplateVersion', 'semantic-query-template-v1'
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
