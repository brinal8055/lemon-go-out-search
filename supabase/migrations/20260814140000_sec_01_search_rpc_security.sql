grant usage on schema app, extensions to lemon_api_owner;
grant usage on schema app, extensions to service_role;

grant select on
  app.geographic_scopes,
  app.geographic_scope_boundaries,
  app.search_configs,
  app.canonical_entities,
  app.places,
  app.entity_aliases,
  app.taxonomy_nodes,
  app.entity_taxonomy_memberships,
  app.search_documents,
  app.search_eligible_places_v
to lemon_api_owner;

grant execute on function app.norm_v1_preserving(text) to lemon_api_owner;
grant execute on function app.norm_v1_accentless(text) to lemon_api_owner;
grant execute on function app.search_eligible_places(uuid) to lemon_api_owner;
grant execute on function app.search_exact_candidates(text, uuid, integer)
to lemon_api_owner;
grant execute on function app.search_fuzzy_candidates(
  text, uuid, integer, integer, integer, integer, real, integer
) to lemon_api_owner;
grant execute on function app.search_known_item_candidates(
  text, uuid, integer, integer, integer, integer, real, integer
) to lemon_api_owner;

create policy geographic_scopes_api_owner_read
on app.geographic_scopes
for select to lemon_api_owner
using (true);
create policy geographic_scope_boundaries_api_owner_read
on app.geographic_scope_boundaries
for select to lemon_api_owner
using (true);
create policy search_configs_api_owner_read
on app.search_configs
for select to lemon_api_owner
using (true);
create policy canonical_entities_api_owner_read
on app.canonical_entities
for select to lemon_api_owner
using (true);
create policy places_api_owner_read
on app.places
for select to lemon_api_owner
using (true);
create policy entity_aliases_api_owner_read
on app.entity_aliases
for select to lemon_api_owner
using (true);
create policy taxonomy_nodes_api_owner_read
on app.taxonomy_nodes
for select to lemon_api_owner
using (true);
create policy entity_taxonomy_memberships_api_owner_read
on app.entity_taxonomy_memberships
for select to lemon_api_owner
using (true);
create policy search_documents_api_owner_read
on app.search_documents
for select to lemon_api_owner
using (true);

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
    select 1
    from app.geographic_scopes as scope
    where scope.id = p_scope_id and scope.is_active
  ) then
    raise exception using errcode = 'P0002', message = 'scope was not found';
  end if;

  if not exists (
    select 1
    from app.geographic_scopes as scope
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
    select 1
    from app.taxonomy_nodes as node
    where node.id = p_taxonomy_node_id and node.active
  ) then
    raise exception using errcode = 'P0002', message = 'taxonomy node was not found';
  end if;

  return query
  with known_item as materialized (
    select candidate.*
    from app.search_known_item_candidates(
      p_query,
      p_scope_id,
      active_config.exact_cap,
      active_config.prefix_min_length,
      active_config.prefix_cap,
      active_config.trigram_min_length,
      active_config.trigram_threshold,
      active_config.trigram_cap
    ) as candidate
  ),
  eligible_results as (
    select candidate.canonical_entity_id,
           candidate.match_type,
           candidate.protected,
           candidate.candidate_rank,
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
                 extensions.st_makepoint(p_longitude, p_latitude),
                 4326
               )::extensions.geography
             ))::integer
           end as computed_distance_m
    from known_item as candidate
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
            extensions.st_makepoint(p_longitude, p_latitude),
            4326
          )::extensions.geography,
          p_radius_m
        )
      )
  ),
  ranked as (
    select result.*,
           row_number() over (
             order by
               case
                 when result.match_type = 'CANONICAL_EXACT' then 1
                 when result.match_type = 'VERIFIED_ALIAS_EXACT' and result.protected then 2
                 when result.match_type = 'VERIFIED_ALIAS_EXACT' then 3
                 when result.match_type = 'ACCENTLESS_EXACT' then 4
                 when result.match_type = 'PREFIX' then 5
                 else 6
               end,
               result.candidate_rank,
               result.canonical_entity_id
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

grant lemon_api_owner to postgres;
grant create on schema api to lemon_api_owner;

alter function api.search_v1(
  uuid, text, text, text, text, uuid,
  double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) owner to lemon_api_owner;

revoke create on schema api from lemon_api_owner;

revoke all on schema api from public, anon, authenticated;
grant usage on schema api to service_role;

revoke execute on function api.search_v1(
  uuid, text, text, text, text, uuid,
  double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) from public, anon, authenticated;
grant execute on function api.search_v1(
  uuid, text, text, text, text, uuid,
  double precision, double precision, integer, uuid,
  app.entity_type[], timestamptz, timestamptz, extensions.vector,
  text, text, text, integer, smallint, text
) to service_role;

revoke lemon_api_owner from postgres;

revoke all on all tables in schema app from anon, authenticated, service_role;
revoke all on all sequences in schema app from anon, authenticated, service_role;
revoke all on all functions in schema app from anon, authenticated, service_role;

alter default privileges in schema api
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema api
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema api
  revoke execute on functions from public, anon, authenticated;
