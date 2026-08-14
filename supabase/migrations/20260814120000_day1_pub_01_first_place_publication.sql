create function app.publish_place_from_current_evidence(
  p_entity_id uuid,
  p_source_record_id uuid,
  p_source_record_version_id uuid,
  p_source_record_parse_attempt_id uuid,
  p_document_template_version text,
  p_document_content_hash text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  entity app.canonical_entities%rowtype;
  place_row app.places%rowtype;
  record app.source_records%rowtype;
  scope_active boolean;
  boundary extensions.geometry(MultiPolygon, 4326);
  boundary_active boolean;
begin
  if p_document_template_version is null
    or btrim(p_document_template_version) = ''
    or p_document_content_hash is null
    or p_document_content_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception using
      errcode = '22023',
      message = 'publication requires a valid document template and content hash';
  end if;

  perform app.assert_source_record_current_evidence(
    p_source_record_id,
    p_source_record_version_id,
    p_source_record_parse_attempt_id
  );

  select source_record.*
  into record
  from app.source_records as source_record
  where source_record.id = p_source_record_id
  for update;

  select canonical.*
  into entity
  from app.canonical_entities as canonical
  where canonical.id = p_entity_id
  for update;

  select place.*
  into place_row
  from app.places as place
  where place.entity_id = p_entity_id
  for update;

  if entity.id is null
    or record.id is null
    or record.canonical_entity_id is distinct from entity.id
    or entity.entity_type <> 'PLACE'
    or place_row.entity_id is null
    or entity.publication_status not in ('DRAFT', 'PUBLISHED')
    or entity.merged_into_id is not null
    or btrim(entity.canonical_name) = ''
    or btrim(entity.canonical_name_norm) = ''
    or btrim(entity.canonical_name_ascii) = ''
    or place_row.location is null
    or place_row.status not in ('ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN')
  then
    raise exception using
      errcode = '23514',
      message = 'entity is not an eligible publishable Place';
  end if;

  select geographic_scope.is_active
  into scope_active
  from app.geographic_scopes as geographic_scope
  where geographic_scope.id = entity.scope_id;

  select scope_boundary.boundary, scope_boundary.is_active
  into boundary, boundary_active
  from app.geographic_scope_boundaries as scope_boundary
  where scope_boundary.id = entity.scope_boundary_id
    and scope_boundary.scope_id = entity.scope_id;

  if scope_active is distinct from true
    or boundary is null
    or boundary_active is distinct from true
    or not extensions.st_covers(boundary, place_row.location::extensions.geometry)
  then
    raise exception using
      errcode = '23514',
      message = 'publication requires an active scope and covered active boundary';
  end if;

  if not exists (
    select 1
    from app.canonical_fact_provenance as provenance
    where provenance.entity_id = entity.id
      and provenance.fact_key = 'canonical_name'
      and provenance.source_record_version_id = p_source_record_version_id
      and provenance.is_current
  ) or not exists (
    select 1
    from app.canonical_fact_provenance as provenance
    where provenance.entity_id = entity.id
      and provenance.fact_key = 'location'
      and provenance.source_record_version_id = p_source_record_version_id
      and provenance.is_current
  ) then
    raise exception using
      errcode = '23514',
      message = 'publication requires current canonical-name and location provenance';
  end if;

  if not exists (
    select 1
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as taxonomy_node
      on taxonomy_node.id = membership.taxonomy_node_id
    where membership.entity_id = entity.id
      and membership.active
      and membership.source_record_version_id = p_source_record_version_id
      and membership.method in ('SOURCE_FACT', 'DETERMINISTIC_MAP')
      and taxonomy_node.active
  ) then
    raise exception using
      errcode = '23514',
      message = 'publication requires active source-evidenced taxonomy truth';
  end if;

  if not exists (
    select 1
    from app.search_documents as document
    where document.entity_id = entity.id
      and document.template_version = p_document_template_version
      and document.content_hash = p_document_content_hash
      and document.display_name = entity.canonical_name
      and document.names_text = entity.canonical_name
      and document.is_active
  ) then
    raise exception using
      errcode = '23514',
      message = 'publication requires the active deterministic SearchDocument';
  end if;

  if exists (
    select 1
    from app.duplicate_candidates as candidate
    where (candidate.record_a_id = record.id or candidate.record_b_id = record.id)
      and candidate.status in ('OPEN', 'UNSURE')
  ) then
    raise exception using
      errcode = '23514',
      message = 'publication is blocked by unresolved duplicate review';
  end if;

  if entity.publication_status = 'DRAFT' then
    update app.canonical_entities
    set publication_status = 'PUBLISHED',
        published_at = statement_timestamp()
    where id = entity.id;
  end if;
end;
$$;

revoke execute on function app.publish_place_from_current_evidence(
  uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated, service_role;

grant execute on function app.publish_place_from_current_evidence(
  uuid, uuid, uuid, uuid, text, text
) to lemon_ingestion;
