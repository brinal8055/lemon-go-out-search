-- TAX-01: evidence-bearing taxonomy membership operations and active hierarchy expansion.

create function app.apply_source_taxonomy_membership(
  p_source_record_id uuid,
  p_source_record_version_id uuid,
  p_source_record_parse_attempt_id uuid,
  p_taxonomy_node_id uuid,
  p_method app.taxonomy_membership_method,
  p_mapping_ref text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_record app.source_records%rowtype;
  source_version app.source_record_versions%rowtype;
  parse_attempt app.source_record_parse_attempts%rowtype;
  taxonomy_node app.taxonomy_nodes%rowtype;
  current_membership app.entity_taxonomy_memberships%rowtype;
  current_membership_record_id uuid;
  membership_id uuid := gen_random_uuid();
begin
  if p_method not in ('SOURCE_FACT', 'DETERMINISTIC_MAP')
    or (p_method = 'SOURCE_FACT' and p_mapping_ref is not null)
    or (p_method = 'DETERMINISTIC_MAP' and (
      p_mapping_ref is null or btrim(p_mapping_ref) = '' or octet_length(p_mapping_ref) > 512
    ))
  then
    raise exception using errcode = '22023', message = 'source taxonomy membership evidence is invalid';
  end if;

  select record.* into source_record
  from app.source_records as record
  where record.id = p_source_record_id
  for update;
  if source_record.id is null or source_record.canonical_entity_id is null then
    raise exception using errcode = '23514', message = 'taxonomy source record must resolve to a canonical entity';
  end if;
  if source_record.current_version_id is distinct from p_source_record_version_id
    or source_record.current_parse_attempt_id is distinct from p_source_record_parse_attempt_id
  then
    raise exception using errcode = '40001', message = 'taxonomy mapping evidence is no longer source-current';
  end if;

  select version.* into source_version
  from app.source_record_versions as version
  where version.id = p_source_record_version_id;
  select attempt.* into parse_attempt
  from app.source_record_parse_attempts as attempt
  where attempt.id = p_source_record_parse_attempt_id;
  if source_version.id is null
    or source_version.source_record_id <> source_record.id
    or source_version.content_status <> 'AVAILABLE'
    or parse_attempt.id is null
    or parse_attempt.source_record_version_id <> source_version.id
    or parse_attempt.status <> 'SUCCEEDED'
    or parse_attempt.normalized_output is null
    or parse_attempt.output_redacted_at is not null
  then
    raise exception using errcode = '23514', message = 'taxonomy membership requires exact permitted successful H+A evidence';
  end if;

  select node.* into taxonomy_node
  from app.taxonomy_nodes as node
  where node.id = p_taxonomy_node_id;
  if taxonomy_node.id is null or not taxonomy_node.active
    or taxonomy_node.taxonomy_version <> 'active-going-out.v1'
  then
    raise exception using errcode = '23514', message = 'taxonomy membership requires an active trial taxonomy node';
  end if;

  perform 1 from app.canonical_entities as entity
  where entity.id = source_record.canonical_entity_id for update;
  select membership.* into current_membership
  from app.entity_taxonomy_memberships as membership
  where membership.entity_id = source_record.canonical_entity_id
    and membership.taxonomy_node_id = taxonomy_node.id
    and membership.active
  for update;
  if current_membership.source_record_version_id is not null then
    select version.source_record_id into current_membership_record_id
    from app.source_record_versions as version
    where version.id = current_membership.source_record_version_id;
  end if;

  if current_membership.id is not null
    and current_membership.method = p_method
    and current_membership.source_record_version_id = source_version.id
    and current_membership.mapping_ref is not distinct from p_mapping_ref
  then
    return current_membership.id;
  end if;
  if current_membership.id is not null
    and (current_membership.method = 'MANUAL'
      or current_membership_record_id is distinct from source_record.id)
  then
    return current_membership.id;
  end if;
  if current_membership.id is not null then
    update app.entity_taxonomy_memberships
    set active = false
    where id = current_membership.id;
  end if;

  insert into app.entity_taxonomy_memberships (
    id, entity_id, taxonomy_node_id, method,
    source_record_version_id, mapping_ref
  ) values (
    membership_id, source_record.canonical_entity_id, taxonomy_node.id, p_method,
    source_version.id, p_mapping_ref
  );
  return membership_id;
end;
$$;

create function app.add_manual_taxonomy_membership(
  p_entity_id uuid,
  p_taxonomy_node_id uuid,
  p_taxonomy_version text,
  p_reviewer text,
  p_evidence text,
  p_expected_current_membership_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  taxonomy_node app.taxonomy_nodes%rowtype;
  current_membership app.entity_taxonomy_memberships%rowtype;
  stored_evidence text;
  membership_id uuid := gen_random_uuid();
begin
  if p_reviewer is null or btrim(p_reviewer) = '' or octet_length(p_reviewer) > 200
    or p_evidence is null or btrim(p_evidence) = '' or octet_length(p_evidence) > 3500
  then
    raise exception using errcode = '22023', message = 'manual taxonomy review requires bounded reviewer and evidence';
  end if;
  select node.* into taxonomy_node
  from app.taxonomy_nodes as node
  where node.id = p_taxonomy_node_id;
  if taxonomy_node.id is null or not taxonomy_node.active
    or taxonomy_node.taxonomy_version <> p_taxonomy_version
    or taxonomy_node.taxonomy_version <> 'active-going-out.v1'
  then
    raise exception using errcode = '23514', message = 'manual membership requires the exact active taxonomy version';
  end if;
  perform 1 from app.canonical_entities as entity
  where entity.id = p_entity_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'manual taxonomy entity does not exist';
  end if;
  stored_evidence := 'taxonomy=' || taxonomy_node.taxonomy_version || '; evidence=' || btrim(p_evidence);

  select membership.* into current_membership
  from app.entity_taxonomy_memberships as membership
  where membership.entity_id = p_entity_id
    and membership.taxonomy_node_id = p_taxonomy_node_id
    and membership.active
  for update;
  if current_membership.id is not null
    and current_membership.method = 'MANUAL'
    and current_membership.reviewed_by = btrim(p_reviewer)
    and current_membership.manual_evidence = stored_evidence
  then
    return current_membership.id;
  end if;
  if current_membership.id is distinct from p_expected_current_membership_id then
    raise exception using errcode = '40001', message = 'manual taxonomy review expected current membership changed';
  end if;
  if current_membership.id is not null then
    update app.entity_taxonomy_memberships set active = false
    where id = current_membership.id;
  end if;

  insert into app.entity_taxonomy_memberships (
    id, entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
  ) values (
    membership_id, p_entity_id, taxonomy_node.id, 'MANUAL',
    stored_evidence, btrim(p_reviewer)
  );
  return membership_id;
end;
$$;

create function app.active_taxonomy_expansion(p_requested_node_id uuid)
returns table (
  taxonomy_node_id uuid,
  hierarchy_distance integer,
  is_requested_node boolean,
  is_leaf boolean,
  inclusion_kind text
)
language sql
stable
security definer
set search_path = ''
as $$
  select node.id,
         (node.depth - requested.depth)::integer,
         node.id = requested.id,
         node.is_leaf,
         case when node.id = requested.id then 'DIRECT' else 'DESCENDANT' end
  from app.taxonomy_nodes as requested
  join app.taxonomy_nodes as node
    on requested.id = any(node.path)
   and node.taxonomy_version = requested.taxonomy_version
   and node.taxonomy_checksum = requested.taxonomy_checksum
  where requested.id = p_requested_node_id
    and requested.active
    and requested.taxonomy_version = 'active-going-out.v1'
    and node.active
  order by node.depth, node.path, node.id
$$;

create function app.taxonomy_coverage_run_evidence(
  p_source_keys text[],
  p_limit integer default 500
)
returns table (
  id uuid,
  source_key text,
  status app.ingestion_run_status,
  refresh_unit_complete boolean,
  fetched integer,
  valid integer,
  invalid integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_source_keys is null
    or cardinality(p_source_keys) < 1
    or cardinality(p_source_keys) > 32
    or p_limit < 1
    or p_limit > 1000
  then
    raise exception using errcode = '22023', message = 'taxonomy coverage run lookup is out of bounds';
  end if;
  return query
  select run.id, source.key, run.status, run.refresh_unit_complete,
         run.fetched, run.valid, run.invalid
  from app.ingestion_runs as run
  join app.sources as source on source.id = run.source_id
  where source.key = any(p_source_keys)
    and run.status <> 'STARTED'
  order by run.started_at desc, run.id desc
  limit p_limit;
end;
$$;

revoke execute on function app.apply_source_taxonomy_membership(
  uuid, uuid, uuid, uuid, app.taxonomy_membership_method, text
) from public, anon, authenticated, service_role, lemon_reviewer;
revoke execute on function app.add_manual_taxonomy_membership(
  uuid, uuid, text, text, text, uuid
) from public, anon, authenticated, service_role, lemon_ingestion;
revoke execute on function app.active_taxonomy_expansion(uuid)
from public, anon, authenticated, service_role;
revoke execute on function app.taxonomy_coverage_run_evidence(text[], integer)
from public, anon, authenticated, service_role, lemon_ingestion;

grant execute on function app.apply_source_taxonomy_membership(
  uuid, uuid, uuid, uuid, app.taxonomy_membership_method, text
) to lemon_ingestion;
grant execute on function app.add_manual_taxonomy_membership(
  uuid, uuid, text, text, text, uuid
) to lemon_reviewer;
grant execute on function app.active_taxonomy_expansion(uuid)
to lemon_ingestion, lemon_reviewer;
grant execute on function app.taxonomy_coverage_run_evidence(text[], integer)
to lemon_reviewer;
