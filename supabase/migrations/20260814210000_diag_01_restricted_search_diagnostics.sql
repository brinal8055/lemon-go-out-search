-- DIAG-01: ephemeral, restricted explanation of current deterministic search state.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lemon_diagnostic_owner') then
    create role lemon_diagnostic_owner nologin noinherit nosuperuser nobypassrls;
  end if;
end
$$;

grant usage on schema app, extensions, diagnostic to lemon_diagnostic_owner;
grant select on
  app.geographic_scopes,
  app.geographic_scope_boundaries,
  app.search_configs,
  app.canonical_entities,
  app.places,
  app.entity_aliases,
  app.taxonomy_nodes,
  app.taxonomy_aliases,
  app.entity_taxonomy_memberships,
  app.search_documents,
  app.search_eligible_places_v
to lemon_diagnostic_owner;

create policy geographic_scopes_diagnostic_owner_read
on app.geographic_scopes for select to lemon_diagnostic_owner using (true);
create policy geographic_scope_boundaries_diagnostic_owner_read
on app.geographic_scope_boundaries for select to lemon_diagnostic_owner using (true);
create policy search_configs_diagnostic_owner_read
on app.search_configs for select to lemon_diagnostic_owner using (true);
create policy canonical_entities_diagnostic_owner_read
on app.canonical_entities for select to lemon_diagnostic_owner using (true);
create policy places_diagnostic_owner_read
on app.places for select to lemon_diagnostic_owner using (true);
create policy entity_aliases_diagnostic_owner_read
on app.entity_aliases for select to lemon_diagnostic_owner using (true);
create policy taxonomy_nodes_diagnostic_owner_read
on app.taxonomy_nodes for select to lemon_diagnostic_owner using (true);
create policy taxonomy_aliases_diagnostic_owner_read
on app.taxonomy_aliases for select to lemon_diagnostic_owner using (true);
create policy entity_taxonomy_memberships_diagnostic_owner_read
on app.entity_taxonomy_memberships for select to lemon_diagnostic_owner using (true);
create policy search_documents_diagnostic_owner_read
on app.search_documents for select to lemon_diagnostic_owner using (true);

grant execute on function app.norm_v1_preserving(text) to lemon_diagnostic_owner;
grant execute on function app.norm_v1_accentless(text) to lemon_diagnostic_owner;
grant execute on function app.search_exact_candidates(text, uuid, integer)
to lemon_diagnostic_owner;
grant execute on function app.search_fuzzy_candidates(
  text, uuid, integer, integer, integer, integer, real, integer
) to lemon_diagnostic_owner;
grant execute on function app.search_lexical_candidates(text, uuid, integer)
to lemon_diagnostic_owner;
grant execute on function app.search_recognized_taxonomy_node(text)
to lemon_diagnostic_owner;
grant execute on function app.active_taxonomy_expansion(uuid)
to lemon_diagnostic_owner;
grant execute on function app.search_taxonomy_candidates(text, uuid, uuid, integer)
to lemon_diagnostic_owner;
grant execute on function app.search_deterministic_candidates(
  text, uuid, uuid, integer, integer, integer, integer, real, integer, integer, integer
) to lemon_diagnostic_owner;

grant lemon_diagnostic_owner to postgres;
grant create on schema diagnostic to lemon_diagnostic_owner;
set role lemon_diagnostic_owner;

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
  active_config app.search_configs%rowtype;
  target_entity app.canonical_entities%rowtype;
  target_place app.places%rowtype;
  target_id uuid := p_entity_id;
  query_text text;
  requested_scope_id uuid;
  requested_taxonomy_node_id uuid;
  requested_entity_types app.entity_type[];
  request_latitude double precision;
  request_longitude double precision;
  request_radius_m integer;
  has_time_filter boolean;
  entity_exists boolean := false;
  eligible boolean := false;
  eligibility_reason text := 'ENTITY_NOT_FOUND';
  resolution_status text := case when p_entity_id is null then 'UNRESOLVED' else 'EXPLICIT_ENTITY_ID' end;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception using errcode = '22023', message = 'diagnostic request must be an object';
  end if;

  query_text := p_request->>'query';
  if query_text is null or char_length(query_text) > 160 or octet_length(query_text) > 512 then
    raise exception using errcode = '22023', message = 'diagnostic query is invalid';
  end if;

  begin
    requested_scope_id := (p_request->>'scopeId')::uuid;
    requested_taxonomy_node_id := nullif(p_request->>'taxonomyNodeId', '')::uuid;
    request_latitude := nullif(p_request#>>'{location,latitude}', '')::double precision;
    request_longitude := nullif(p_request#>>'{location,longitude}', '')::double precision;
    request_radius_m := nullif(p_request#>>'{location,radiusMeters}', '')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'diagnostic request identifiers or location are invalid';
  end;

  if requested_scope_id is null then
    raise exception using errcode = '22023', message = 'diagnostic scope is required';
  end if;

  if p_request ? 'entityTypes' then
    if jsonb_typeof(p_request->'entityTypes') <> 'array' then
      raise exception using errcode = '22023', message = 'diagnostic entity types are invalid';
    end if;
    begin
      select array_agg(value::app.entity_type order by ordinal)
      into requested_entity_types
      from jsonb_array_elements_text(p_request->'entityTypes') with ordinality as item(value, ordinal);
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'diagnostic entity types are invalid';
    end;
  end if;

  has_time_filter := p_request ? 'timeStart' or p_request ? 'timeEnd';

  select config.* into active_config
  from app.search_configs as config
  where config.is_active;
  if active_config.version is null then
    raise exception using errcode = '55000', message = 'active search configuration is unavailable';
  end if;

  if target_id is null then
    select case when count(*) = 1 then min(entity.id::text)::uuid end
    into target_id
    from app.canonical_entities as entity
    where entity.scope_id = requested_scope_id
      and entity.canonical_name_norm = app.norm_v1_preserving(query_text);
    if target_id is not null then
      resolution_status := 'UNIQUE_CANONICAL_NAME';
    end if;
  end if;

  if target_id is not null then
    select entity.* into target_entity
    from app.canonical_entities as entity
    where entity.id = target_id;
    entity_exists := target_entity.id is not null;
  end if;

  if entity_exists and target_entity.entity_type = 'PLACE' then
    select place.* into target_place
    from app.places as place
    where place.entity_id = target_id;
  end if;

  if not entity_exists then
    eligibility_reason := case
      when p_entity_id is null then 'ENTITY_ID_UNRESOLVED'
      else 'ENTITY_NOT_FOUND'
    end;
  elsif requested_entity_types is not null
    and not (target_entity.entity_type = any(requested_entity_types)) then
    eligibility_reason := 'ENTITY_TYPE_FILTER_MISMATCH';
  elsif has_time_filter then
    eligibility_reason := 'TIME_FILTER_NOT_IMPLEMENTED_FOR_PLACE';
  elsif target_entity.publication_status <> 'PUBLISHED' then
    eligibility_reason := 'PUBLICATION_NOT_PUBLISHED';
  elsif target_entity.merged_into_id is not null then
    eligibility_reason := 'ENTITY_MERGED';
  elsif target_entity.scope_id <> requested_scope_id then
    eligibility_reason := 'SCOPE_MISMATCH';
  elsif not exists (
    select 1 from app.geographic_scopes as scope
    where scope.id = target_entity.scope_id and scope.is_active and scope.public_search_enabled
  ) then
    eligibility_reason := 'SCOPE_INACTIVE_OR_DISABLED';
  elsif not exists (
    select 1 from app.geographic_scope_boundaries as boundary
    where boundary.id = target_entity.scope_boundary_id
      and boundary.scope_id = target_entity.scope_id
      and boundary.is_active
  ) then
    eligibility_reason := 'BOUNDARY_INACTIVE';
  elsif target_entity.entity_type <> 'PLACE' then
    eligibility_reason := 'ENTITY_TYPE_NOT_IMPLEMENTED';
  elsif target_place.entity_id is null then
    eligibility_reason := 'PLACE_ROW_MISSING';
  elsif target_place.status not in ('ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN') then
    eligibility_reason := 'PLACE_STATUS_INELIGIBLE';
  elsif target_place.location is null then
    eligibility_reason := 'LOCATION_MISSING';
  elsif not exists (
    select 1 from app.search_eligible_places_v as candidate
    where candidate.entity_id = target_id and candidate.scope_id = requested_scope_id
  ) then
    eligibility_reason := 'OUTSIDE_ACTIVE_BOUNDARY';
  elsif requested_taxonomy_node_id is not null and not exists (
    select 1
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as node
      on node.id = membership.taxonomy_node_id and node.active
    where membership.entity_id = target_id
      and membership.active
      and requested_taxonomy_node_id = any(node.path)
  ) then
    eligibility_reason := 'TAXONOMY_FILTER_MISMATCH';
  elsif request_radius_m is not null and (
    request_latitude is null
    or request_longitude is null
    or not extensions.st_dwithin(
      target_place.location,
      extensions.st_setsrid(
        extensions.st_makepoint(request_longitude, request_latitude), 4326
      )::extensions.geography,
      request_radius_m
    )
  ) then
    eligibility_reason := 'RADIUS_FILTER_MISMATCH';
  else
    eligibility_reason := 'ELIGIBLE';
    eligible := true;
  end if;

  return (
    with exact_rows as materialized (
      select candidate.*
      from app.search_exact_candidates(query_text, requested_scope_id, active_config.exact_cap) as candidate
      where candidate.canonical_entity_id = target_id
    ),
    fuzzy_rows as materialized (
      select candidate.*
      from app.search_fuzzy_candidates(
        query_text, requested_scope_id, active_config.exact_cap,
        active_config.prefix_min_length, active_config.prefix_cap,
        active_config.trigram_min_length, active_config.trigram_threshold,
        active_config.trigram_cap
      ) as candidate
      where candidate.canonical_entity_id = target_id
    ),
    lexical_row as materialized (
      select candidate.*
      from app.search_lexical_candidates(query_text, requested_scope_id, active_config.fts_cap) as candidate
      where candidate.canonical_entity_id = target_id
    ),
    taxonomy_row as materialized (
      select candidate.*
      from app.search_taxonomy_candidates(
        query_text, requested_taxonomy_node_id, requested_scope_id, active_config.taxonomy_cap
      ) as candidate
      where candidate.canonical_entity_id = target_id
    ),
    union_rows as materialized (
      select candidate.*
      from app.search_deterministic_candidates(
        query_text, requested_scope_id, requested_taxonomy_node_id,
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
    filtered_union as materialized (
      select union_candidate.canonical_entity_id,
             row_number() over (
               order by union_candidate.provisional_rank,
                        union_candidate.canonical_entity_id
             )::integer as result_rank
      from union_rows as union_candidate
      join app.canonical_entities as entity
        on entity.id = union_candidate.canonical_entity_id
      join app.places as place on place.entity_id = entity.id
      where (requested_entity_types is null or entity.entity_type = any(requested_entity_types))
        and not has_time_filter
        and (
          requested_taxonomy_node_id is null
          or exists (
            select 1
            from app.entity_taxonomy_memberships as membership
            join app.taxonomy_nodes as node
              on node.id = membership.taxonomy_node_id and node.active
            where membership.entity_id = entity.id
              and membership.active
              and requested_taxonomy_node_id = any(node.path)
          )
        )
        and (
          request_radius_m is null
          or extensions.st_dwithin(
            place.location,
            extensions.st_setsrid(
              extensions.st_makepoint(request_longitude, request_latitude), 4326
            )::extensions.geography,
            request_radius_m
          )
        )
    ),
    document_row as (
      select document.id,
             document.document_version,
             document.template_version,
             document.content_hash,
             document.is_active
      from app.search_documents as document
      where document.entity_id = target_id
      order by document.is_active desc, document.generated_at desc, document.id
      limit 1
    ),
    version_context as (
      select
        (select boundary.version from app.geographic_scope_boundaries as boundary
         where boundary.id = target_entity.scope_boundary_id) as boundary_version,
        (select node.taxonomy_version from app.taxonomy_nodes as node
         where node.active order by node.taxonomy_version limit 1) as taxonomy_version,
        (select node.taxonomy_checksum from app.taxonomy_nodes as node
         where node.active order by node.taxonomy_version limit 1) as taxonomy_checksum
    ),
    facts as (
      select
        exists (select 1 from exact_rows where match_type = 'CANONICAL_EXACT') as canonical_exact_present,
        exists (select 1 from exact_rows where match_type = 'VERIFIED_ALIAS_EXACT') as alias_exact_present,
        exists (select 1 from fuzzy_rows where match_type = 'ACCENTLESS_EXACT') as accentless_present,
        exists (select 1 from fuzzy_rows where match_type = 'PREFIX') as prefix_present,
        exists (select 1 from fuzzy_rows where match_type = 'TRIGRAM') as trigram_present,
        exists (select 1 from lexical_row) as lexical_present,
        exists (select 1 from taxonomy_row) as taxonomy_present,
        exists (select 1 from union_rows where canonical_entity_id = target_id) as union_present,
        (select provisional_rank from union_rows where canonical_entity_id = target_id) as union_rank,
        (select result_rank from filtered_union where canonical_entity_id = target_id) as result_rank
    )
    select jsonb_build_object(
      'entityId', target_id,
      'entityResolution', resolution_status,
      'entityExists', entity_exists,
      'eligible', eligible,
      'eligibilityFailureReason', eligibility_reason,
      'reasonCodes', case
        when not entity_exists then jsonb_build_array(eligibility_reason)
        when not eligible then jsonb_build_array(eligibility_reason)
        when not facts.union_present then jsonb_build_array('NOT_IN_CANDIDATE_UNION')
        when facts.result_rank is null then jsonb_build_array('HARD_FILTERED_AFTER_UNION')
        when facts.result_rank > 5 then jsonb_build_array('OUTSIDE_TOP_5')
        else jsonb_build_array('TOP_5')
      end,
      'exactQualification', jsonb_build_object(
        'canonical', coalesce((
          select jsonb_build_object(
            'status', 'EXECUTED', 'present', true, 'rank', candidate_rank,
            'protected', protected, 'protectionClass', protection_class
          )
          from exact_rows where match_type = 'CANONICAL_EXACT' limit 1
        ), jsonb_build_object(
          'status', 'EXECUTED', 'present', false, 'rank', null,
          'protected', false, 'protectionClass', null
        )),
        'verifiedAlias', coalesce((
          select jsonb_build_object(
            'status', 'EXECUTED', 'present', true, 'rank', candidate_rank,
            'protected', protected, 'qualificationReason', alias_qualification_reason
          )
          from exact_rows
          where match_type = 'VERIFIED_ALIAS_EXACT'
          order by protected desc, candidate_rank
          limit 1
        ), jsonb_build_object(
          'status', 'EXECUTED', 'present', false, 'rank', null,
          'protected', false,
          'qualificationReason', case when eligible then 'NO_MATCH' else 'ENTITY_INELIGIBLE' end
        ))
      ),
      'stages', jsonb_build_object(
        'accentless', jsonb_build_object(
          'status', 'EXECUTED', 'present', facts.accentless_present,
          'rank', (select candidate_rank from fuzzy_rows where match_type = 'ACCENTLESS_EXACT' limit 1)
        ),
        'prefix', jsonb_build_object(
          'status', 'EXECUTED', 'present', facts.prefix_present,
          'rank', (select candidate_rank from fuzzy_rows where match_type = 'PREFIX' limit 1)
        ),
        'trigram', jsonb_build_object(
          'status', 'EXECUTED', 'present', facts.trigram_present,
          'rank', (select candidate_rank from fuzzy_rows where match_type = 'TRIGRAM' limit 1),
          'rawScore', (select trigram_similarity from fuzzy_rows where match_type = 'TRIGRAM' limit 1)
        ),
        'lexical', jsonb_build_object(
          'status', 'EXECUTED', 'present', facts.lexical_present,
          'rank', (select candidate_rank from lexical_row),
          'rawScore', (select raw_score from lexical_row),
          'matchedWeight', (select matched_weight from lexical_row),
          'absenceReason', case
            when facts.lexical_present then null
            when not exists (select 1 from document_row where is_active) then 'SEARCH_DOCUMENT_NOT_ACTIVE'
            else 'NO_FTS_MATCH'
          end
        ),
        'taxonomy', jsonb_build_object(
          'status', 'EXECUTED', 'present', facts.taxonomy_present,
          'rank', (select candidate_rank from taxonomy_row),
          'direct', (select direct_taxonomy from taxonomy_row),
          'matchedNodeId', (select matched_taxonomy_node_id from taxonomy_row),
          'hierarchyDistance', (select hierarchy_distance from taxonomy_row)
        ),
        'event', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'present', null, 'rank', null),
        'semantic', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'present', null, 'rank', null),
        'rrf', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'rank', null, 'contribution', null),
        'nonCollapse', jsonb_build_object('status', 'NOT_IMPLEMENTED', 'applied', null, 'rank', null)
      ),
      'candidateUnion', jsonb_build_object(
        'present', facts.union_present,
        'provisionalUnionRank', facts.union_rank,
        'postFilterRank', facts.result_rank,
        'reachedTop5', coalesce(facts.result_rank between 1 and 5, false),
        'stageEvidence', (select stage_evidence from union_rows where canonical_entity_id = target_id),
        'stagePresenceImpliesUnion', not (
          (facts.canonical_exact_present or facts.alias_exact_present
           or facts.accentless_present or facts.prefix_present or facts.trigram_present
           or facts.lexical_present or facts.taxonomy_present)
          and not facts.union_present
        )
      ),
      'versions', jsonb_build_object(
        'searchConfigVersion', active_config.version,
        'boundaryVersion', version_context.boundary_version,
        'taxonomyVersion', version_context.taxonomy_version,
        'taxonomyChecksum', version_context.taxonomy_checksum,
        'searchDocument', coalesce((
          select jsonb_build_object(
            'status', case when document.is_active then 'ACTIVE' else 'INACTIVE' end,
            'id', document.id,
            'documentVersion', document.document_version,
            'templateVersion', document.template_version,
            'contentHash', document.content_hash
          ) from document_row as document
        ), jsonb_build_object(
          'status', 'MISSING', 'id', null, 'documentVersion', null,
          'templateVersion', null, 'contentHash', null
        )),
        'embedding', jsonb_build_object(
          'status', 'NOT_IMPLEMENTED', 'provider', null,
          'model', null, 'revision', null, 'dimension', null
        )
      )
    )
    from facts
    cross join version_context
  );
end;
$$;

revoke execute on function diagnostic.explain_search_v1(jsonb, uuid)
from public, anon, authenticated, service_role, lemon_api_owner,
  lemon_ingestion, lemon_reviewer, lemon_compliance;
grant execute on function diagnostic.explain_search_v1(jsonb, uuid)
to lemon_evaluation;

reset role;
grant usage on schema diagnostic to lemon_evaluation;
revoke create on schema diagnostic from lemon_diagnostic_owner;
revoke lemon_diagnostic_owner from postgres;
