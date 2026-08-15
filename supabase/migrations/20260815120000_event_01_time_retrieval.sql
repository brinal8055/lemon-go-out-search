-- EVENT-01: authoritative Event/time/freshness eligibility, bounded Event
-- candidates, restricted diagnostics, and deterministic expiry.

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
  'event-01-time-v1',
  '2b7c5c9d54741b3a88bb8ae9d2e2b181bbf25d370b3d03d3d01f3249241277a1',
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
  statement_timestamp(), 'EVENT-01',
  'Initial bounded Event retrieval candidate: 30-day horizon and 48-hour municipal Event freshness.'
);

create index events_scheduled_start_end_idx
  on app.events (starts_at, ends_at, entity_id)
  where status = 'SCHEDULED';
create index events_known_end_expiry_idx
  on app.events (ends_at, entity_id)
  where status = 'SCHEDULED' and ends_at is not null;
create index events_point_expiry_idx
  on app.events (starts_at, entity_id)
  where status = 'SCHEDULED' and ends_at is null;

create function app.event_is_expired(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_now timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_ends_at is not null then p_ends_at <= p_now
    else p_starts_at < p_now
  end
$$;

create function app.event_interval_overlaps(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_query_start timestamptz,
  p_query_end timestamptz
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_query_start is null and p_query_end is null then true
    when p_query_start is null or p_query_end is null or p_query_start >= p_query_end then false
    when p_ends_at is not null
      then p_starts_at < p_query_end and p_ends_at > p_query_start
    else p_query_start <= p_starts_at and p_starts_at < p_query_end
  end
$$;

revoke execute on function app.event_is_expired(timestamptz, timestamptz, timestamptz)
from public, anon, authenticated, service_role;
revoke execute on function app.event_interval_overlaps(
  timestamptz, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated, service_role;

create view app.event_critical_evidence_v
with (security_barrier = true)
as
select event.entity_id,
       start_record.last_seen_at as start_freshness,
       end_record.last_seen_at as end_freshness,
       status_record.last_seen_at as status_freshness,
       start_source.key as start_source_key,
       end_source.key as end_source_key,
       status_source.key as status_source_key,
       start_provenance.id is not null
         and start_version.content_status = 'AVAILABLE'
         and start_record.id = event.event_start_source_record_id as start_provenance_ok,
       event.ends_at is null or (
         end_provenance.id is not null
         and end_version.content_status = 'AVAILABLE'
         and end_record.id = event.event_end_source_record_id
       ) as end_provenance_ok,
       status_provenance.id is not null
         and status_version.content_status = 'AVAILABLE'
         and status_record.id = event.event_status_source_record_id as status_provenance_ok
from app.events as event
left join app.canonical_fact_provenance as start_provenance
  on start_provenance.entity_id = event.entity_id
 and start_provenance.fact_key = 'event_start' and start_provenance.is_current
left join app.source_record_versions as start_version
  on start_version.id = start_provenance.source_record_version_id
left join app.source_records as start_record on start_record.id = start_version.source_record_id
left join app.sources as start_source on start_source.id = start_record.source_id
left join app.canonical_fact_provenance as end_provenance
  on end_provenance.entity_id = event.entity_id
 and end_provenance.fact_key = 'event_end' and end_provenance.is_current
left join app.source_record_versions as end_version
  on end_version.id = end_provenance.source_record_version_id
left join app.source_records as end_record on end_record.id = end_version.source_record_id
left join app.sources as end_source on end_source.id = end_record.source_id
left join app.canonical_fact_provenance as status_provenance
  on status_provenance.entity_id = event.entity_id
 and status_provenance.fact_key = 'event_status' and status_provenance.is_current
left join app.source_record_versions as status_version
  on status_version.id = status_provenance.source_record_version_id
left join app.source_records as status_record on status_record.id = status_version.source_record_id
left join app.sources as status_source on status_source.id = status_record.source_id;

revoke all on app.event_critical_evidence_v from public, anon, authenticated, service_role;
grant select on app.events, app.event_critical_evidence_v to lemon_api_owner;

create policy events_api_owner_read
on app.events for select to lemon_api_owner using (true);

grant execute on function app.event_is_expired(timestamptz, timestamptz, timestamptz)
to lemon_api_owner, lemon_ingestion;
grant execute on function app.event_interval_overlaps(
  timestamptz, timestamptz, timestamptz, timestamptz
) to lemon_api_owner;

grant lemon_api_owner to postgres;
grant create on schema app, api to lemon_api_owner;
set role lemon_api_owner;

create function app.search_event_eligibility(
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
  p_entity_types app.entity_type[]
)
returns table (
  entity_id uuid,
  canonical_name text,
  publication_status app.publication_status,
  event_status app.event_status,
  starts_at timestamptz,
  ends_at timestamptz,
  source_timezone text,
  venue_place_id uuid,
  venue_name text,
  venue_mode text,
  effective_location extensions.geography,
  street_address text,
  postal_code text,
  locality text,
  country_code text,
  schedule_freshness timestamptz,
  status_freshness timestamptz,
  effective_freshness timestamptz,
  tolerance_hours integer,
  horizon_end timestamptz,
  interval_overlap boolean,
  publication_eligible boolean,
  status_eligible boolean,
  current_eligible boolean,
  horizon_eligible boolean,
  provenance_eligible boolean,
  schedule_freshness_eligible boolean,
  status_freshness_eligible boolean,
  scope_eligible boolean,
  location_eligible boolean,
  taxonomy_eligible boolean,
  radius_eligible boolean,
  type_eligible boolean,
  eligible boolean,
  reason_code text
)
language sql
stable
security definer
set search_path = ''
as $$
  with facts as (
    select entity.id,
           entity.canonical_name,
           entity.publication_status,
           entity.merged_into_id,
           entity.scope_id,
           entity.scope_boundary_id,
           event.status,
           event.starts_at,
           event.ends_at,
           event.source_timezone,
           event.venue_place_id,
           case when event.venue_place_id is not null
             then venue_entity.canonical_name else event.standalone_venue_name end as venue_name,
           case when event.venue_place_id is not null then 'LINKED' else 'STANDALONE' end as venue_mode,
           case when event.venue_place_id is not null then venue.location else event.location end as location,
           case when event.venue_place_id is not null
             then venue.street_address else event.standalone_street_address end as street_address,
           case when event.venue_place_id is not null
             then venue.postal_code else event.standalone_postal_code end as postal_code,
           case when event.venue_place_id is not null
             then venue.locality else event.standalone_locality end as locality,
           case when event.venue_place_id is not null
             then venue.country_code else event.standalone_country_code end as country_code,
           boundary.boundary,
           scope.is_active and scope.public_search_enabled as scope_enabled,
           boundary.is_active as boundary_active,
           critical.start_freshness,
           critical.end_freshness,
           critical.status_freshness,
           nullif(pg_catalog.jsonb_extract_path_text(
             p_freshness_by_source, critical.start_source_key, 'toleranceHours'
           ), '')::integer as start_tolerance,
           nullif(pg_catalog.jsonb_extract_path_text(
             p_freshness_by_source, critical.end_source_key, 'toleranceHours'
           ), '')::integer as end_tolerance,
           nullif(pg_catalog.jsonb_extract_path_text(
             p_freshness_by_source, critical.status_source_key, 'toleranceHours'
           ), '')::integer as status_tolerance,
           coalesce(critical.start_provenance_ok, false) as start_provenance_ok,
           coalesce(critical.end_provenance_ok, false) as end_provenance_ok,
           coalesce(critical.status_provenance_ok, false) as status_provenance_ok
    from app.canonical_entities as entity
    join app.events as event on event.entity_id = entity.id
    left join app.places as venue on venue.entity_id = event.venue_place_id
    left join app.canonical_entities as venue_entity on venue_entity.id = event.venue_place_id
    left join app.geographic_scopes as scope on scope.id = entity.scope_id
    left join app.geographic_scope_boundaries as boundary
      on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id
    left join app.event_critical_evidence_v as critical on critical.entity_id = entity.id
  ),
  freshness as (
    select facts.*,
           case when facts.ends_at is null then facts.start_freshness
             when facts.start_freshness is null or facts.end_freshness is null then null
             else least(facts.start_freshness, facts.end_freshness) end as schedule_freshness,
           case when facts.ends_at is null then facts.start_tolerance
             when facts.start_tolerance is null or facts.end_tolerance is null then null
             else least(facts.start_tolerance, facts.end_tolerance) end as schedule_tolerance
    from facts
  ),
  checks as (
    select freshness.*,
           case when freshness.schedule_freshness is null or freshness.status_freshness is null
             then null else least(freshness.schedule_freshness, freshness.status_freshness) end
             as effective_freshness,
           case when freshness.schedule_tolerance is null or freshness.status_tolerance is null
             then null else least(freshness.schedule_tolerance, freshness.status_tolerance) end
             as tolerance_hours,
           freshness.publication_status = 'PUBLISHED'
             and freshness.merged_into_id is null as publication_ok,
           freshness.status = 'SCHEDULED' as status_ok,
           not app.event_is_expired(freshness.starts_at, freshness.ends_at, p_now) as current_ok,
           freshness.starts_at < p_now + pg_catalog.make_interval(days => p_horizon_days) as horizon_ok,
           freshness.start_provenance_ok and freshness.end_provenance_ok
             and freshness.status_provenance_ok as provenance_ok,
           freshness.schedule_freshness is not null
             and freshness.schedule_tolerance is not null
             and freshness.schedule_freshness >= p_now
               - pg_catalog.make_interval(hours => freshness.schedule_tolerance) as schedule_fresh_ok,
           freshness.status_freshness is not null
             and freshness.status_tolerance is not null
             and freshness.status_freshness >= p_now
               - pg_catalog.make_interval(hours => freshness.status_tolerance) as status_fresh_ok,
           freshness.scope_id = p_scope_id and coalesce(freshness.scope_enabled, false)
             and coalesce(freshness.boundary_active, false) as scope_ok,
           freshness.venue_name is not null and btrim(freshness.venue_name) <> ''
             and freshness.location is not null as location_ok,
           app.event_interval_overlaps(
             freshness.starts_at, freshness.ends_at, p_time_start, p_time_end
           ) as overlap_ok,
           p_entity_types is null or 'EVENT'::app.entity_type = any(p_entity_types) as type_ok,
           p_taxonomy_node_id is null or exists (
             select 1
             from app.entity_taxonomy_memberships as membership
             join app.taxonomy_nodes as node
               on node.id = membership.taxonomy_node_id and node.active
             where membership.entity_id = freshness.id and membership.active
               and p_taxonomy_node_id = any(node.path)
           ) as taxonomy_ok,
           p_radius_m is null or (
             p_latitude is not null and p_longitude is not null
             and extensions.st_dwithin(
               freshness.location,
               extensions.st_setsrid(
                 extensions.st_makepoint(p_longitude, p_latitude), 4326
               )::extensions.geography,
               p_radius_m
             )
           ) as radius_ok,
           freshness.location is not null and freshness.boundary is not null
             and extensions.st_covers(
               freshness.boundary, freshness.location::extensions.geometry
             ) as boundary_ok
    from freshness
  )
  select checks.id,
         checks.canonical_name,
         checks.publication_status,
         checks.status,
         checks.starts_at,
         checks.ends_at,
         checks.source_timezone,
         checks.venue_place_id,
         checks.venue_name,
         checks.venue_mode,
         checks.location,
         checks.street_address,
         checks.postal_code,
         checks.locality,
         checks.country_code,
         checks.schedule_freshness,
         checks.status_freshness,
         checks.effective_freshness,
         checks.tolerance_hours,
         p_now + pg_catalog.make_interval(days => p_horizon_days),
         checks.overlap_ok,
         checks.publication_ok,
         checks.status_ok,
         checks.current_ok,
         checks.horizon_ok,
         checks.provenance_ok,
         checks.schedule_fresh_ok,
         checks.status_fresh_ok,
         checks.scope_ok and checks.boundary_ok,
         checks.location_ok,
         checks.taxonomy_ok,
         checks.radius_ok,
         checks.type_ok,
         checks.publication_ok and checks.status_ok and checks.current_ok
           and checks.horizon_ok and checks.provenance_ok
           and checks.schedule_fresh_ok and checks.status_fresh_ok
           and checks.scope_ok and checks.boundary_ok and checks.location_ok
           and checks.overlap_ok and checks.taxonomy_ok and checks.radius_ok and checks.type_ok,
         case
           when not checks.publication_ok then case
             when checks.merged_into_id is not null then 'ENTITY_MERGED'
             else 'PUBLICATION_NOT_PUBLISHED' end
           when not checks.status_ok then 'EVENT_STATUS_INELIGIBLE'
           when not checks.current_ok then 'EVENT_EXPIRED'
           when not checks.horizon_ok then 'OUTSIDE_EVENT_HORIZON'
           when not checks.scope_ok then 'SCOPE_INACTIVE_OR_MISMATCH'
           when not checks.location_ok then 'EFFECTIVE_LOCATION_MISSING'
           when not checks.boundary_ok then 'OUTSIDE_ACTIVE_BOUNDARY'
           when not checks.provenance_ok then 'CRITICAL_PROVENANCE_MISSING'
           when not checks.schedule_fresh_ok then 'SCHEDULE_STALE'
           when not checks.status_fresh_ok then 'STATUS_STALE'
           when not checks.overlap_ok then 'TIME_INTERVAL_NO_OVERLAP'
           when not checks.taxonomy_ok then 'TAXONOMY_FILTER_MISMATCH'
           when not checks.radius_ok then 'RADIUS_FILTER_MISMATCH'
           when not checks.type_ok then 'ENTITY_TYPE_FILTER_MISMATCH'
           else 'ELIGIBLE'
         end
  from checks
$$;

create function app.search_event_candidates(
  p_query text,
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
  p_cap integer
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  context_match text,
  candidate_rank integer,
  stage_evidence jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  venue_mode text,
  eligibility_passed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_cap < 1 or p_cap > 200 then
    raise exception using errcode = '22023', message = 'Event candidate cap is invalid';
  end if;

  return query
  with query_value as (
    select app.norm_v1_preserving(p_query) as normalized,
           case when app.norm_v1_preserving(p_query) = '' then null::pg_catalog.tsquery
             else pg_catalog.websearch_to_tsquery('pg_catalog.simple'::regconfig, p_query)
               || pg_catalog.websearch_to_tsquery('pg_catalog.swedish'::regconfig, p_query)
               || pg_catalog.websearch_to_tsquery('pg_catalog.english'::regconfig, p_query)
           end as tsquery
  ),
  context as (
    select eligible.*,
           query_value.normalized <> ''
             and app.norm_v1_preserving(eligible.canonical_name) = query_value.normalized as title_exact,
           query_value.normalized <> '' and (
             app.norm_v1_preserving(eligible.canonical_name) like '%' || query_value.normalized || '%'
             or query_value.normalized like '%' || app.norm_v1_preserving(eligible.canonical_name) || '%'
           ) as title_lexical,
           query_value.normalized <> '' and (
             app.norm_v1_preserving(eligible.venue_name) like '%' || query_value.normalized || '%'
             or query_value.normalized like '%' || app.norm_v1_preserving(eligible.venue_name) || '%'
           ) as venue_lexical,
           query_value.tsquery is not null and document.fts @@ query_value.tsquery as document_lexical,
           query_value.normalized <> '' and exists (
             select 1
             from app.entity_taxonomy_memberships as membership
             join app.taxonomy_nodes as node
               on node.id = membership.taxonomy_node_id and node.active
             where membership.entity_id = eligible.entity_id and membership.active
               and query_value.normalized in (
                 app.norm_v1_preserving(node.label_en), app.norm_v1_preserving(node.label_sv)
               )
           ) as category_lexical
    from app.search_event_eligibility(
      p_scope_id, p_now, p_horizon_days, p_freshness_by_source,
      p_time_start, p_time_end, p_latitude, p_longitude, p_radius_m,
      p_taxonomy_node_id, p_entity_types
    ) as eligible
    cross join query_value
    left join app.search_documents as document
      on document.entity_id = eligible.entity_id and document.is_active
    where eligible.eligible
  ),
  qualified as (
    select context.*,
           case
             when context.title_exact then 'TITLE_EXACT'
             when context.title_lexical then 'TITLE_LEXICAL'
             when context.venue_lexical then 'VENUE_LEXICAL'
             when context.category_lexical then 'CATEGORY'
             when context.document_lexical then 'DOCUMENT_FTS'
             else 'TIME_ONLY'
           end as context_kind,
           case
             when context.title_exact then 1
             when context.title_lexical then 2
             when context.venue_lexical then 3
             when context.category_lexical then 4
             when context.document_lexical then 5
             else 6
           end as context_priority
    from context
    where p_time_start is not null
       or context.title_exact or context.title_lexical or context.venue_lexical
       or context.category_lexical or context.document_lexical
  ),
  ranked as (
    select qualified.*,
           row_number() over (
             order by qualified.context_priority, qualified.starts_at, qualified.entity_id
           )::integer as rank
    from qualified
  )
  select ranked.entity_id,
         'EVENT'::text,
         ranked.context_kind,
         ranked.rank,
         jsonb_build_object(
           'stage', 'EVENT',
           'stageRank', ranked.rank,
           'contextMatch', ranked.context_kind,
           'protected', ranked.title_exact,
           'protectionClass', case when ranked.title_exact then 'CANONICAL_EXACT' else null end,
           'titleMatched', ranked.title_exact or ranked.title_lexical,
           'venueMatched', ranked.venue_lexical,
           'categoryMatched', ranked.category_lexical,
           'documentMatched', ranked.document_lexical,
           'timeFiltered', p_time_start is not null,
           'venueMode', ranked.venue_mode
         ),
         ranked.starts_at,
         ranked.ends_at,
         ranked.venue_mode,
         true
  from ranked
  where ranked.rank <= p_cap
  order by ranked.rank;
end;
$$;

revoke execute on function app.search_event_eligibility(
  uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[]
) from public, anon, authenticated, service_role;
revoke execute on function app.search_event_candidates(
  text, uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[], integer
) from public, anon, authenticated, service_role;

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
  if p_limit is null or p_limit < 1 or p_limit > 20 then
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
  with place_candidates as materialized (
    select candidate.*
    from app.search_deterministic_candidates(
      p_query, p_scope_id, p_taxonomy_node_id,
      active_config.exact_cap, active_config.prefix_min_length, active_config.prefix_cap,
      active_config.trigram_min_length, active_config.trigram_threshold,
      active_config.trigram_cap, active_config.fts_cap, active_config.taxonomy_cap
    ) as candidate
  ),
  eligible_places as (
    select candidate.canonical_entity_id,
           case when candidate.protected then 1 else 3 end as sort_group,
           candidate.provisional_rank as sort_rank,
           canonical.canonical_name,
           place.location,
           place.status,
           place.opening_hours,
           document.description_text,
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             place.location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end as distance_m
    from place_candidates as candidate
    join app.canonical_entities as canonical on canonical.id = candidate.canonical_entity_id
    join app.places as place on place.entity_id = canonical.id
    left join app.search_documents as document
      on document.entity_id = canonical.id and document.is_active
    where (p_entity_types is null or 'PLACE'::app.entity_type = any(p_entity_types))
      and (p_taxonomy_node_id is null or exists (
        select 1 from app.entity_taxonomy_memberships as membership
        join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
        where membership.entity_id = canonical.id and membership.active
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
    select candidate.*
    from app.search_event_candidates(
      p_query, p_scope_id, request_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id,
      p_entity_types, active_config.event_cap
    ) as candidate
  ),
  eligible_events as (
    select candidate.canonical_entity_id,
           case when candidate.context_match = 'TITLE_EXACT' then 1
             when candidate.context_match in ('TITLE_LEXICAL', 'VENUE_LEXICAL') then 2
             else 4 end as sort_group,
           candidate.candidate_rank as sort_rank,
           eligible.canonical_name,
           eligible.effective_location as location,
           eligible.starts_at,
           eligible.ends_at,
           eligible.source_timezone,
           eligible.event_status,
           eligible.venue_place_id,
           eligible.venue_name,
           case when p_latitude is null then null::integer else round(extensions.st_distance(
             eligible.effective_location,
             extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)
               ::extensions.geography
           ))::integer end as distance_m
    from event_candidates as candidate
    join app.search_event_eligibility(
      p_scope_id, request_now, active_config.event_horizon_days,
      active_config.event_freshness_by_source, p_time_start, p_time_end,
      p_latitude, p_longitude, p_radius_m, p_taxonomy_node_id, p_entity_types
    ) as eligible on eligible.entity_id = candidate.canonical_entity_id and eligible.eligible
  ),
  union_results as (
    select place.canonical_entity_id, 'PLACE'::app.entity_type as entity_type,
           place.sort_group, place.sort_rank, place.canonical_name, place.location,
           place.distance_m, nullif(btrim(place.description_text), '') as factual_summary,
           place.status as place_status, place.opening_hours,
           null::timestamptz as starts_at, null::timestamptz as ends_at,
           null::text as source_timezone, null::app.event_status as event_status,
           null::jsonb as venue
    from eligible_places as place
    union all
    select event.canonical_entity_id, 'EVENT'::app.entity_type,
           event.sort_group, event.sort_rank, event.canonical_name, event.location,
           event.distance_m, null::text, null::app.place_status, null::jsonb,
           event.starts_at, event.ends_at, event.source_timezone, event.event_status,
           jsonb_strip_nulls(jsonb_build_object(
             'canonicalPlaceId', event.venue_place_id, 'name', event.venue_name
           ))
    from eligible_events as event
  ),
  ranked as (
    select union_results.*,
           row_number() over (
             partition by union_results.canonical_entity_id
             order by union_results.sort_group, union_results.sort_rank
           ) as entity_row,
           row_number() over (
             order by union_results.sort_group, union_results.sort_rank,
                      union_results.canonical_entity_id
           ) as position
    from union_results
  )
  select ranked.position::smallint,
         ranked.canonical_entity_id,
         ranked.entity_type,
         ranked.canonical_name,
         coalesce(category.categories, '[]'::jsonb),
         extensions.st_y(ranked.location::extensions.geometry),
         extensions.st_x(ranked.location::extensions.geometry),
         ranked.distance_m,
         ranked.factual_summary,
         ranked.place_status,
         ranked.opening_hours,
         ranked.starts_at,
         ranked.ends_at,
         ranked.source_timezone,
         ranked.event_status,
         ranked.venue,
         false,
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
    where membership.entity_id = ranked.canonical_entity_id and membership.active
  ) as category on true
  where ranked.entity_row = 1 and ranked.position <= p_limit
  order by ranked.position;
end;
$$;

reset role;
revoke create on schema app, api from lemon_api_owner;

grant execute on function app.search_event_eligibility(
  uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[]
) to lemon_diagnostic_owner, postgres;
grant execute on function app.search_event_candidates(
  text, uuid, timestamptz, integer, jsonb, timestamptz, timestamptz,
  double precision, double precision, integer, uuid, app.entity_type[], integer
) to lemon_diagnostic_owner, postgres;
revoke lemon_api_owner from postgres;

grant lemon_diagnostic_owner to postgres;
grant create on schema diagnostic to lemon_diagnostic_owner;
set role lemon_diagnostic_owner;

alter function diagnostic.explain_search_v1(jsonb, uuid)
rename to explain_search_place_v1;
revoke execute on function diagnostic.explain_search_place_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance, lemon_evaluation;

create function diagnostic.explain_search_event_v1(
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
  active_config app.search_configs%rowtype;
  query_text text;
  requested_scope_id uuid;
  requested_taxonomy_node_id uuid;
  requested_entity_types app.entity_type[];
  request_latitude double precision;
  request_longitude double precision;
  request_radius_m integer;
  request_time_start timestamptz;
  request_time_end timestamptz;
  request_now timestamptz := statement_timestamp();
  eligibility record;
  candidate record;
  document_row record;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' or p_entity_id is null then
    raise exception using errcode = '22023', message = 'Event diagnostic request is invalid';
  end if;
  query_text := coalesce(p_request->>'query', '');
  if char_length(query_text) > 160 or octet_length(query_text) > 512 then
    raise exception using errcode = '22023', message = 'diagnostic query is invalid';
  end if;
  begin
    requested_scope_id := (p_request->>'scopeId')::uuid;
    requested_taxonomy_node_id := nullif(p_request->>'taxonomyNodeId', '')::uuid;
    request_latitude := nullif(p_request#>>'{location,latitude}', '')::double precision;
    request_longitude := nullif(p_request#>>'{location,longitude}', '')::double precision;
    request_radius_m := nullif(p_request#>>'{location,radiusMeters}', '')::integer;
    request_time_start := nullif(p_request->>'timeStart', '')::timestamptz;
    request_time_end := nullif(p_request->>'timeEnd', '')::timestamptz;
    request_now := coalesce(nullif(p_request->>'now', '')::timestamptz, request_now);
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'Event diagnostic values are invalid';
  end;
  if requested_scope_id is null
    or (request_time_start is null) <> (request_time_end is null)
    or (request_time_start is not null and request_time_end <= request_time_start) then
    raise exception using errcode = '22023', message = 'Event diagnostic bounds are invalid';
  end if;
  if p_request ? 'entityTypes' then
    begin
      select array_agg(value::app.entity_type order by ordinal)
      into requested_entity_types
      from jsonb_array_elements_text(p_request->'entityTypes')
        with ordinality as item(value, ordinal);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'diagnostic entity types are invalid';
    end;
  end if;

  select config.* into active_config from app.search_configs as config where config.is_active;
  select result.* into eligibility
  from app.search_event_eligibility(
    requested_scope_id, request_now, active_config.event_horizon_days,
    active_config.event_freshness_by_source, request_time_start, request_time_end,
    request_latitude, request_longitude, request_radius_m,
    requested_taxonomy_node_id, requested_entity_types
  ) as result where result.entity_id = p_entity_id;
  select result.* into candidate
  from app.search_event_candidates(
    query_text, requested_scope_id, request_now, active_config.event_horizon_days,
    active_config.event_freshness_by_source, request_time_start, request_time_end,
    request_latitude, request_longitude, request_radius_m,
    requested_taxonomy_node_id, requested_entity_types, active_config.event_cap
  ) as result where result.canonical_entity_id = p_entity_id;
  select document.id, document.document_version, document.template_version,
         document.content_hash, document.is_active
  into document_row
  from app.search_documents as document
  where document.entity_id = p_entity_id
  order by document.is_active desc, document.generated_at desc, document.id
  limit 1;

  return jsonb_build_object(
    'entityId', p_entity_id,
    'entityResolution', 'EXPLICIT_ENTITY_ID',
    'entityExists', eligibility.entity_id is not null,
    'eligible', coalesce(eligibility.eligible, false),
    'eligibilityFailureReason', coalesce(eligibility.reason_code, 'ENTITY_NOT_FOUND'),
    'reasonCodes', jsonb_build_array(coalesce(eligibility.reason_code, 'ENTITY_NOT_FOUND')),
    'eventEligibility', jsonb_build_object(
      'publicationEligible', eligibility.publication_eligible,
      'status', eligibility.event_status,
      'statusEligible', eligibility.status_eligible,
      'now', request_now,
      'horizonEnd', eligibility.horizon_end,
      'startsAt', eligibility.starts_at,
      'endsAt', eligibility.ends_at,
      'pointEvent', eligibility.ends_at is null,
      'queryStart', request_time_start,
      'queryEnd', request_time_end,
      'intervalOverlap', eligibility.interval_overlap,
      'scheduleFreshness', eligibility.schedule_freshness,
      'statusFreshness', eligibility.status_freshness,
      'effectiveFreshness', eligibility.effective_freshness,
      'sourceToleranceHours', eligibility.tolerance_hours,
      'scheduleFreshnessEligible', eligibility.schedule_freshness_eligible,
      'statusFreshnessEligible', eligibility.status_freshness_eligible,
      'freshnessEligible', eligibility.schedule_freshness_eligible
        and eligibility.status_freshness_eligible,
      'scopeEligible', eligibility.scope_eligible,
      'radiusEligible', eligibility.radius_eligible,
      'taxonomyEligible', eligibility.taxonomy_eligible,
      'venueMode', eligibility.venue_mode
    ),
    'stages', jsonb_build_object(
      'event', jsonb_build_object(
        'status', 'EXECUTED', 'present', candidate.canonical_entity_id is not null,
        'rank', candidate.candidate_rank,
        'contextMatch', candidate.context_match,
        'venueMode', eligibility.venue_mode
      ),
      'semantic', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'present', null, 'rank', null),
      'rrf', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'rank', null, 'contribution', null),
      'nonCollapse', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'applied', null, 'rank', null)
    ),
    'candidateUnion', jsonb_build_object(
      'present', candidate.canonical_entity_id is not null,
      'provisionalUnionRank', candidate.candidate_rank,
      'postFilterRank', candidate.candidate_rank,
      'stageEvidence', candidate.stage_evidence,
      'stagePresenceImpliesUnion', true
    ),
    'versions', jsonb_build_object(
      'searchConfigVersion', active_config.version,
      'searchDocument', case when document_row.id is null then jsonb_build_object(
        'status', 'MISSING', 'id', null
      ) else jsonb_build_object(
        'status', case when document_row.is_active then 'ACTIVE' else 'INACTIVE' end,
        'id', document_row.id,
        'documentVersion', document_row.document_version,
        'templateVersion', document_row.template_version,
        'contentHash', document_row.content_hash
      ) end,
      'embedding', jsonb_build_object(
        'status', 'NOT_IMPLEMENTED', 'provider', null,
        'model', null, 'revision', null, 'dimension', null
      )
    )
  );
end;
$$;

create function diagnostic.explain_search_v1(
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
  target_type app.entity_type;
begin
  select entity.entity_type into target_type
  from app.canonical_entities as entity where entity.id = p_entity_id;
  if target_type = 'EVENT' then
    return diagnostic.explain_search_event_v1(p_request, p_entity_id);
  end if;
  return diagnostic.explain_search_place_v1(p_request, p_entity_id);
end;
$$;

revoke execute on function diagnostic.explain_search_event_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance, lemon_evaluation;
revoke execute on function diagnostic.explain_search_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance;
grant execute on function diagnostic.explain_search_v1(jsonb, uuid)
to lemon_evaluation;

reset role;
revoke create on schema diagnostic from lemon_diagnostic_owner;
revoke lemon_diagnostic_owner from postgres;

create function app.expire_events(p_now timestamptz default null)
returns table (
  withheld_count integer,
  documents_invalidated integer,
  embeddings_staled integer
)
language plpgsql
set search_path = ''
as $$
declare
  effective_now timestamptz := coalesce(p_now, statement_timestamp());
  expired_ids uuid[];
begin
  with expired as (
    update app.canonical_entities as entity
    set publication_status = 'WITHHELD', published_at = null
    from app.events as event
    where event.entity_id = entity.id
      and entity.publication_status = 'PUBLISHED'
      and entity.merged_into_id is null
      and app.event_is_expired(event.starts_at, event.ends_at, effective_now)
    returning entity.id
  )
  select array_agg(id order by id) into expired_ids from expired;

  if expired_ids is null then
    return query select 0, 0, 0;
    return;
  end if;

  update app.embeddings as embedding
  set status = 'STALE', stale_reason = 'EVENT_EXPIRED'
  from app.search_documents as document
  where document.entity_id = any(expired_ids)
    and document.id = embedding.search_document_id
    and document.is_active
    and embedding.status = 'READY';
  get diagnostics embeddings_staled = row_count;

  update app.search_documents as document
  set is_active = false
  where document.entity_id = any(expired_ids) and document.is_active;
  get diagnostics documents_invalidated = row_count;
  withheld_count := cardinality(expired_ids);
  return next;
end;
$$;

revoke execute on function app.expire_events(timestamptz)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_reviewer, lemon_compliance, lemon_evaluation, lemon_diagnostic_owner;
grant execute on function app.expire_events(timestamptz) to lemon_ingestion;
