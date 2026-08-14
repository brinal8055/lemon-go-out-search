-- PROV-01: targeted fact provenance, bounded revocation impact, and compliance redaction.

create table app.compliance_redaction_audit (
  operation_id uuid not null,
  source_record_version_id uuid not null
    references app.source_record_versions (id) on delete restrict,
  source_record_id uuid not null references app.source_records (id) on delete restrict,
  source_id uuid not null references app.sources (id) on delete restrict,
  actor text not null,
  reason_code text not null check (reason_code ~ '^[A-Z0-9][A-Z0-9_.:-]{0,127}$'),
  outcome text not null check (outcome = 'COMPLETED'),
  safe_counts jsonb not null check (app.is_bounded_error_summary(safe_counts)),
  completed_at timestamptz not null default statement_timestamp(),
  primary key (operation_id, source_record_version_id),
  unique (source_record_version_id)
);

alter table app.compliance_redaction_audit enable row level security;

create function app.extract_targeted_fact(
  p_normalized_output jsonb,
  p_fact_key app.fact_key,
  p_entity_type app.entity_type
)
returns jsonb
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  result jsonb;
begin
  case p_fact_key
    when 'canonical_name' then
      result := to_jsonb(coalesce(
        p_normalized_output #>> '{names,0,value}',
        p_normalized_output #>> '{place,canonicalName}',
        p_normalized_output #>> '{event,canonicalName}'
      ));
    when 'location' then
      if p_entity_type = 'PLACE' then
        if p_normalized_output #> '{place,latitude}' is not null
          and p_normalized_output #> '{place,longitude}' is not null
        then
          result := jsonb_build_object(
            'latitude', p_normalized_output #> '{place,latitude}',
            'longitude', p_normalized_output #> '{place,longitude}'
          );
        end if;
      elsif p_normalized_output #> '{event,latitude}' is not null
        and p_normalized_output #> '{event,longitude}' is not null
      then
        result := jsonb_build_object(
          'latitude', p_normalized_output #> '{event,latitude}',
          'longitude', p_normalized_output #> '{event,longitude}'
        );
      end if;
    when 'address' then
      if p_entity_type = 'PLACE' then
        result := jsonb_strip_nulls(jsonb_build_object(
          'streetAddress', p_normalized_output #>> '{place,streetAddress}',
          'postalCode', p_normalized_output #>> '{place,postalCode}',
          'locality', p_normalized_output #>> '{place,locality}',
          'countryCode', p_normalized_output #>> '{place,countryCode}'
        ));
      else
        result := jsonb_strip_nulls(jsonb_build_object(
          'streetAddress', p_normalized_output #>> '{event,streetAddress}',
          'postalCode', p_normalized_output #>> '{event,postalCode}',
          'locality', p_normalized_output #>> '{event,locality}',
          'countryCode', p_normalized_output #>> '{event,countryCode}'
        ));
      end if;
      if result = '{}'::jsonb then result := null; end if;
    when 'opening_hours' then
      if p_entity_type = 'PLACE' then
        result := p_normalized_output #> '{place,openingHours}';
      end if;
    when 'event_start' then
      if p_entity_type = 'EVENT' then result := to_jsonb(p_normalized_output #>> '{event,startsAt}'); end if;
    when 'event_end' then
      if p_entity_type = 'EVENT' then result := to_jsonb(p_normalized_output #>> '{event,endsAt}'); end if;
    when 'event_status' then
      if p_entity_type = 'EVENT' then result := to_jsonb(p_normalized_output #>> '{event,status}'); end if;
  end case;
  if result = 'null'::jsonb then return null; end if;
  return result;
end;
$$;

create function app.protect_compliance_redaction_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'compliance redaction audit is append-only';
end;
$$;

create trigger compliance_redaction_audit_protect
before update or delete on app.compliance_redaction_audit
for each row execute function app.protect_compliance_redaction_audit();

create function app.unambiguous_targeted_fact_value(
  p_source_record_version_id uuid,
  p_fact_key app.fact_key,
  p_entity_type app.entity_type
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  values_found jsonb[];
begin
  select array_agg(distinct extracted.fact_value)
  into values_found
  from (
    select app.extract_targeted_fact(attempt.normalized_output, p_fact_key, p_entity_type) as fact_value
    from app.source_record_parse_attempts as attempt
    where attempt.source_record_version_id = p_source_record_version_id
      and attempt.status = 'SUCCEEDED'
      and attempt.normalized_output is not null
      and attempt.output_redacted_at is null
  ) as extracted
  where extracted.fact_value is not null;

  if cardinality(values_found) = 1 then return values_found[1]; end if;
  return null;
end;
$$;

create function app.apply_targeted_fact_value(
  p_entity_id uuid,
  p_fact_key app.fact_key,
  p_value jsonb,
  p_source_record_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity app.canonical_entities%rowtype;
  evidence_record_id uuid;
  value_text text;
begin
  select item.* into entity from app.canonical_entities as item
  where item.id = p_entity_id for update;
  if entity.id is null then raise exception using errcode = 'P0002', message = 'canonical entity does not exist'; end if;
  select version.source_record_id into evidence_record_id
  from app.source_record_versions as version
  join app.source_records as record on record.id = version.source_record_id
  where version.id = p_source_record_version_id
    and version.content_status = 'AVAILABLE'
    and record.canonical_entity_id = p_entity_id;
  if evidence_record_id is null then
    raise exception using errcode = '23514', message = 'targeted fact evidence must be available and resolve to the entity';
  end if;

  case p_fact_key
    when 'canonical_name' then
      value_text := p_value #>> '{}';
      if value_text is null or btrim(value_text) = '' then
        raise exception using errcode = '22023', message = 'canonical_name requires a non-empty string';
      end if;
      update app.canonical_entities
      set canonical_name = value_text,
          canonical_name_norm = app.norm_v1_preserving(value_text),
          canonical_name_ascii = app.norm_v1_accentless(value_text)
      where id = p_entity_id;
    when 'location' then
      if jsonb_typeof(p_value) <> 'object'
        or p_value ->> 'latitude' is null or p_value ->> 'longitude' is null
      then raise exception using errcode = '22023', message = 'location requires latitude and longitude'; end if;
      if entity.entity_type = 'PLACE' then
        update app.places set location = extensions.st_setsrid(extensions.st_makepoint(
          (p_value ->> 'longitude')::double precision,
          (p_value ->> 'latitude')::double precision
        ), 4326)::extensions.geography where entity_id = p_entity_id;
      else
        update app.events set location = extensions.st_setsrid(extensions.st_makepoint(
          (p_value ->> 'longitude')::double precision,
          (p_value ->> 'latitude')::double precision
        ), 4326)::extensions.geography where entity_id = p_entity_id;
      end if;
    when 'address' then
      if jsonb_typeof(p_value) <> 'object' then
        raise exception using errcode = '22023', message = 'address requires an object';
      end if;
      if entity.entity_type = 'PLACE' then
        update app.places set
          street_address = p_value ->> 'streetAddress', postal_code = p_value ->> 'postalCode',
          locality = p_value ->> 'locality',
          country_code = coalesce(nullif(p_value ->> 'countryCode', ''), country_code)
        where entity_id = p_entity_id;
      else
        update app.events set
          standalone_street_address = p_value ->> 'streetAddress',
          standalone_postal_code = p_value ->> 'postalCode',
          standalone_locality = p_value ->> 'locality',
          standalone_country_code = p_value ->> 'countryCode'
        where entity_id = p_entity_id;
      end if;
    when 'opening_hours' then
      if entity.entity_type <> 'PLACE' or jsonb_typeof(p_value) <> 'object' then
        raise exception using errcode = '22023', message = 'opening_hours requires a Place object';
      end if;
      update app.places set opening_hours = p_value where entity_id = p_entity_id;
    when 'event_start' then
      if entity.entity_type <> 'EVENT' then raise exception using errcode = '22023', message = 'event_start requires Event'; end if;
      update app.events set starts_at = (p_value #>> '{}')::timestamptz,
        event_start_source_record_id = evidence_record_id where entity_id = p_entity_id;
    when 'event_end' then
      if entity.entity_type <> 'EVENT' then raise exception using errcode = '22023', message = 'event_end requires Event'; end if;
      update app.events set ends_at = (p_value #>> '{}')::timestamptz,
        event_end_source_record_id = evidence_record_id where entity_id = p_entity_id;
    when 'event_status' then
      if entity.entity_type <> 'EVENT' then raise exception using errcode = '22023', message = 'event_status requires Event'; end if;
      update app.events set status = upper(p_value #>> '{}')::app.event_status,
        status_observed_at = statement_timestamp(), event_status_source_record_id = evidence_record_id
      where entity_id = p_entity_id;
  end case;
end;
$$;

create function app.remove_or_withhold_targeted_fact(
  p_entity_id uuid,
  p_fact_key app.fact_key
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare entity app.canonical_entities%rowtype;
begin
  select item.* into entity from app.canonical_entities as item where item.id = p_entity_id for update;
  if p_fact_key in ('canonical_name', 'location', 'event_start', 'event_status') then
    if entity.publication_status <> 'MERGED' then
      update app.canonical_entities set publication_status = 'WITHHELD', published_at = null where id = p_entity_id;
    end if;
    return 'WITHHELD';
  end if;
  if p_fact_key = 'address' then
    if entity.entity_type = 'PLACE' then
      update app.places set street_address = null, postal_code = null, locality = null where entity_id = p_entity_id;
    else
      update app.events set standalone_street_address = null, standalone_postal_code = null,
        standalone_locality = null, standalone_country_code = null where entity_id = p_entity_id;
    end if;
  elsif p_fact_key = 'opening_hours' then
    update app.places set opening_hours = null, opening_hours_verified = false where entity_id = p_entity_id;
  elsif p_fact_key = 'event_end' then
    update app.events set ends_at = null, event_end_source_record_id = null where entity_id = p_entity_id;
  end if;
  return 'REMOVED_OPTIONAL';
end;
$$;

create or replace function app.validate_canonical_fact_provenance_current()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
  entity_status app.publication_status;
  entity_type app.entity_type;
  visible boolean := false;
begin
  select count(*) filter (where provenance.is_current)
  into current_count
  from app.canonical_fact_provenance as provenance
  where provenance.entity_id = new.entity_id and provenance.fact_key = new.fact_key;
  if current_count = 1 then return null; end if;
  if current_count > 1 then
    raise exception using errcode = '23514', message = 'targeted fact has more than one current provenance selection';
  end if;
  select entity.publication_status, entity.entity_type into entity_status, entity_type
  from app.canonical_entities as entity where entity.id = new.entity_id;
  if entity_status in ('WITHHELD', 'MERGED') then return null; end if;
  case new.fact_key
    when 'canonical_name' then visible := true;
    when 'location' then
      if entity_type = 'PLACE' then select place.location is not null into visible from app.places as place where place.entity_id = new.entity_id;
      else select event.location is not null into visible from app.events as event where event.entity_id = new.entity_id; end if;
    when 'address' then
      if entity_type = 'PLACE' then select place.street_address is not null or place.postal_code is not null or place.locality is not null into visible from app.places as place where place.entity_id = new.entity_id;
      else select event.standalone_street_address is not null or event.standalone_postal_code is not null or event.standalone_locality is not null into visible from app.events as event where event.entity_id = new.entity_id; end if;
    when 'opening_hours' then select place.opening_hours is not null into visible from app.places as place where place.entity_id = new.entity_id;
    when 'event_start', 'event_status' then visible := entity_type = 'EVENT';
    when 'event_end' then select event.ends_at is not null into visible from app.events as event where event.entity_id = new.entity_id;
  end case;
  if visible then
    raise exception using errcode = '23514', message = 'visible targeted fact must retain exactly one current provenance selection';
  end if;
  return null;
end;
$$;

create function app.replace_targeted_canonical_fact(
  p_entity_id uuid,
  p_fact_key app.fact_key,
  p_value jsonb,
  p_source_record_version_id uuid,
  p_selection_method text,
  p_created_by text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entity_type app.entity_type;
  supported_value jsonb;
  current_row app.canonical_fact_provenance%rowtype;
  result_id uuid := gen_random_uuid();
begin
  if p_selection_method is null
     or p_selection_method not in ('SOURCE_PRECEDENCE', 'MANUAL')
    or p_created_by is null or btrim(p_created_by) = ''
  then raise exception using errcode = '22023', message = 'targeted fact selection metadata is invalid'; end if;
  select entity.entity_type into entity_type from app.canonical_entities as entity
  where entity.id = p_entity_id for update;
  if entity_type is null then raise exception using errcode = 'P0002', message = 'canonical entity does not exist'; end if;
  supported_value := app.unambiguous_targeted_fact_value(p_source_record_version_id, p_fact_key, entity_type);
  if supported_value is null or supported_value is distinct from p_value then
    raise exception using errcode = '23514', message = 'targeted fact value is not unambiguously supported by the selected version';
  end if;
  select provenance.* into current_row from app.canonical_fact_provenance as provenance
  where provenance.entity_id = p_entity_id and provenance.fact_key = p_fact_key and provenance.is_current
  for update;
  perform app.apply_targeted_fact_value(p_entity_id, p_fact_key, p_value, p_source_record_version_id);
  if current_row.id is not null
    and current_row.source_record_version_id = p_source_record_version_id
    and current_row.selection_method = p_selection_method
  then return current_row.id; end if;
  if current_row.id is not null then
    update app.canonical_fact_provenance set is_current = false, superseded_at = statement_timestamp()
    where id = current_row.id;
  end if;
  insert into app.canonical_fact_provenance (
    id, entity_id, fact_key, source_record_version_id, selection_method, note, created_by
  ) values (
    result_id, p_entity_id, p_fact_key, p_source_record_version_id,
    p_selection_method, p_note, btrim(p_created_by)
  );
  return result_id;
end;
$$;

create or replace function app.reject_source_record_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user = 'lemon_compliance_owner'
    and old.content_status = 'AVAILABLE' and new.content_status = 'REDACTED'
    and (to_jsonb(new) - array['payload','source_url','http_etag','http_last_modified','content_status','redaction_reason','redacted_at','redacted_by','redaction_operation_id']::text[])
      = (to_jsonb(old) - array['payload','source_url','http_etag','http_last_modified','content_status','redaction_reason','redacted_at','redacted_by','redaction_operation_id']::text[])
    and new.payload is null and new.source_url is null and new.http_etag is null and new.http_last_modified is null
    and new.redaction_reason is not null and new.redacted_at is not null
    and new.redacted_by is not null and new.redaction_operation_id is not null
  then return new; end if;
  raise exception using errcode = '55000', message = 'source record versions are immutable outside compliance redaction';
end;
$$;

create or replace function app.protect_parse_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user = 'lemon_compliance_owner'
    and old.status = 'SUCCEEDED' and new.status = 'SUCCEEDED'
    and old.normalized_output is not null and new.normalized_output is null
    and old.output_redacted_at is null and new.output_redacted_at is not null
    and (to_jsonb(new) - array['normalized_output','output_redacted_at']::text[])
      = (to_jsonb(old) - array['normalized_output','output_redacted_at']::text[])
  then return new; end if;
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'source parse attempts cannot be deleted';
  end if;
  if old.status <> 'STARTED' then
    raise exception using errcode = '55000', message = 'terminal source parse attempts are immutable';
  end if;
  if new.id is distinct from old.id
    or new.source_record_version_id is distinct from old.source_record_version_id
    or new.ingestion_run_id is distinct from old.ingestion_run_id
    or new.parser_version is distinct from old.parser_version
    or new.attempted_at is distinct from old.attempted_at
    or new.created_at is distinct from old.created_at
  then raise exception using errcode = '55000', message = 'source parse attempt identity is immutable'; end if;
  return new;
end;
$$;

create or replace function app.enforce_source_current_evidence_selection()
returns trigger
language plpgsql
set search_path = ''
as $$
declare relation_owner name;
begin
  if (tg_op = 'INSERT' and (new.current_version_id is not null or new.current_parse_attempt_id is not null))
    or (tg_op = 'UPDATE' and (new.current_version_id is distinct from old.current_version_id
      or new.current_parse_attempt_id is distinct from old.current_parse_attempt_id))
  then
    select pg_catalog.pg_get_userbyid(relation.relowner) into relation_owner
    from pg_catalog.pg_class as relation where relation.oid = tg_relid;
    if current_user <> relation_owner and current_user <> 'lemon_compliance_owner' then
      raise exception using errcode = '42501', message = 'source-current evidence must be changed through the selection transaction';
    end if;
  end if;
  return new;
end;
$$;

create or replace function app.protect_duplicate_candidate_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and current_user = 'lemon_compliance_owner'
    and new.note = '[REDACTED]'
    and (to_jsonb(new) - 'note') = (to_jsonb(old) - 'note')
  then return new; end if;
  raise exception using errcode = '55000', message = 'duplicate candidate decisions are append-only';
end;
$$;

create function app.source_revocation_impact(p_source_id uuid, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'revocation report limit must be between 1 and 500';
  end if;
  if not exists (select 1 from app.sources where id = p_source_id) then
    raise exception using errcode = 'P0002', message = 'source does not exist';
  end if;
  with source_versions as (
    select version.id, version.source_record_id, version.observed_at
    from app.source_record_versions as version
    join app.source_records as record on record.id = version.source_record_id
    where record.source_id = p_source_id
  ), fact_dependencies as (
    select provenance.id, provenance.entity_id, provenance.fact_key,
           provenance.source_record_version_id
    from app.canonical_fact_provenance as provenance
    join source_versions as version on version.id = provenance.source_record_version_id
    where provenance.is_current
  ), membership_dependencies as (
    select membership.id, membership.entity_id, membership.taxonomy_node_id,
           membership.source_record_version_id
    from app.entity_taxonomy_memberships as membership
    join source_versions as version on version.id = membership.source_record_version_id
    where membership.active
  ), alias_dependencies as (
    select alias.id, alias.entity_id, alias.source_record_version_id
    from app.entity_aliases as alias
    join source_versions as version on version.id = alias.source_record_version_id
    where alias.active
  ), affected_entities as (
    select entity_id from fact_dependencies
    union select entity_id from membership_dependencies
    union select entity_id from alias_dependencies
  ), affected_documents as (
    select document.id, document.entity_id, document.content_hash
    from app.search_documents as document
    join affected_entities as entity on entity.entity_id = document.entity_id
  ), affected_embeddings as (
    select embedding.id, embedding.search_document_id, embedding.entity_id, embedding.status
    from app.embeddings as embedding
    join affected_documents as document on document.id = embedding.search_document_id
  ), affected_duplicates as (
    select distinct candidate.id
    from app.duplicate_candidates as candidate
    join app.duplicate_candidate_decisions as decision
      on decision.duplicate_candidate_id = candidate.id
    where decision.evidence_version_ids && array(select id from source_versions)
  )
  select jsonb_build_object(
    'sourceId', p_source_id,
    'counts', jsonb_build_object(
      'versions', (select count(*) from source_versions),
      'currentFacts', (select count(*) from fact_dependencies),
      'activeMemberships', (select count(*) from membership_dependencies),
      'activeAliases', (select count(*) from alias_dependencies),
      'entities', (select count(*) from affected_entities),
      'documents', (select count(*) from affected_documents),
      'embeddings', (select count(*) from affected_embeddings),
      'duplicateCandidates', (select count(*) from affected_duplicates)
    ),
    'versions', coalesce((select jsonb_agg(jsonb_build_object(
      'versionId', version.id, 'recordId', version.source_record_id
    ) order by version.observed_at, version.id) from (select * from source_versions order by observed_at, id limit p_limit) as version), '[]'::jsonb),
    'currentFacts', coalesce((select jsonb_agg(jsonb_build_object(
      'provenanceId', fact.id, 'entityId', fact.entity_id,
      'factKey', fact.fact_key, 'versionId', fact.source_record_version_id
    ) order by fact.entity_id, fact.fact_key) from (select * from fact_dependencies order by entity_id, fact_key limit p_limit) as fact), '[]'::jsonb),
    'activeMemberships', coalesce((select jsonb_agg(jsonb_build_object(
      'membershipId', membership.id, 'entityId', membership.entity_id,
      'taxonomyNodeId', membership.taxonomy_node_id, 'versionId', membership.source_record_version_id
    ) order by membership.entity_id, membership.taxonomy_node_id)
      from (select * from membership_dependencies order by entity_id, taxonomy_node_id limit p_limit) as membership), '[]'::jsonb),
    'affectedEntityIds', coalesce((select jsonb_agg(entity.entity_id order by entity.entity_id)
      from (select * from affected_entities order by entity_id limit p_limit) as entity), '[]'::jsonb),
    'derivedDocumentIds', coalesce((select jsonb_agg(document.id order by document.id)
      from (select * from affected_documents order by id limit p_limit) as document), '[]'::jsonb),
    'embeddingIds', coalesce((select jsonb_agg(embedding.id order by embedding.id)
      from (select * from affected_embeddings order by id limit p_limit) as embedding), '[]'::jsonb),
    'duplicateCandidateIds', coalesce((select jsonb_agg(candidate.id order by candidate.id)
      from (select * from affected_duplicates order by id limit p_limit) as candidate), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create function app.redact_source_record_version(
  p_version_id uuid,
  p_operation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_version app.source_record_versions%rowtype;
  selected_record app.source_records%rowtype;
  audit_row app.compliance_redaction_audit%rowtype;
  affected_entity_ids uuid[] := '{}'::uuid[];
  candidate_ids uuid[] := '{}'::uuid[];
  alternative_version_id uuid;
  alternative_attempt_id uuid;
  alternative_method text;
  alternative_value jsonb;
  alternative_membership_id uuid;
  provenance_row app.canonical_fact_provenance%rowtype;
  membership_row app.entity_taxonomy_memberships%rowtype;
  affected_entity_id uuid;
  entity_type app.entity_type;
  repair_outcome text;
  document_version text;
  template_version text;
  safe_name text;
  safe_aliases text;
  safe_taxonomy_en text;
  safe_taxonomy_sv text;
  safe_embedding_text text;
  safe_hash char(64);
  attempts_sanitized integer := 0;
  current_reselected integer := 0;
  current_cleared integer := 0;
  facts_reselected integer := 0;
  facts_withheld integer := 0;
  optional_facts_removed integer := 0;
  memberships_deactivated integer := 0;
  memberships_reactivated integer := 0;
  aliases_deactivated integer := 0;
  documents_sanitized integer := 0;
  embeddings_purged integer := 0;
  duplicate_candidates_sanitized integer := 0;
  duplicate_notes_sanitized integer := 0;
  mutation_rows integer := 0;
  safe_counts jsonb;
begin
  if p_version_id is null or p_operation_id is null
    or p_reason is null or p_reason !~ '^[A-Z0-9][A-Z0-9_.:-]{0,127}$'
  then raise exception using errcode = '22023', message = 'redaction requires version, operation, and bounded reason code'; end if;

  select version.* into selected_version from app.source_record_versions as version
  where version.id = p_version_id;
  if selected_version.id is null then raise exception using errcode = 'P0002', message = 'source record version does not exist'; end if;
  select record.* into selected_record from app.source_records as record
  where record.id = selected_version.source_record_id;
  perform 1 from app.sources as source where source.id = selected_record.source_id for share;
  select record.* into selected_record from app.source_records as record
  where record.id = selected_record.id for update;
  select version.* into selected_version from app.source_record_versions as version
  where version.id = p_version_id for update;

  if selected_version.content_status = 'REDACTED' then
    if selected_version.redaction_operation_id <> p_operation_id then
      raise exception using errcode = '40001', message = 'source record version was redacted by a different operation';
    end if;
    if selected_version.redaction_reason <> p_reason then
      raise exception using errcode = '40001', message = 'redaction retry reason does not match the original operation';
    end if;
    select audit.* into audit_row from app.compliance_redaction_audit as audit
    where audit.operation_id = p_operation_id and audit.source_record_version_id = p_version_id;
    if audit_row.operation_id is null then
      raise exception using errcode = '55000', message = 'redacted version is missing its compliance audit record';
    end if;
    return jsonb_build_object(
      'versionId', p_version_id, 'operationId', p_operation_id,
      'actor', audit_row.actor, 'reasonCode', audit_row.reason_code,
      'outcome', audit_row.outcome, 'idempotent', true, 'counts', audit_row.safe_counts
    );
  end if;
  if selected_version.content_status <> 'AVAILABLE' then
    raise exception using errcode = '23514', message = 'only AVAILABLE source record versions may be redacted';
  end if;

  select coalesce(array_agg(distinct dependency.entity_id order by dependency.entity_id), '{}'::uuid[])
  into affected_entity_ids
  from (
    select provenance.entity_id from app.canonical_fact_provenance as provenance
    where provenance.source_record_version_id = p_version_id and provenance.is_current
    union
    select membership.entity_id from app.entity_taxonomy_memberships as membership
    where membership.source_record_version_id = p_version_id and membership.active
    union
    select alias.entity_id from app.entity_aliases as alias
    where alias.source_record_version_id = p_version_id and alias.active
  ) as dependency;

  perform 1 from app.canonical_fact_provenance as provenance
  where provenance.source_record_version_id = p_version_id and provenance.is_current
  order by provenance.entity_id, provenance.fact_key for update;
  perform 1 from app.entity_taxonomy_memberships as membership
  where membership.source_record_version_id = p_version_id and membership.active
  order by membership.entity_id, membership.taxonomy_node_id for update;
  perform 1 from app.entity_aliases as alias
  where alias.source_record_version_id = p_version_id and alias.active
  order by alias.entity_id, alias.id for update;
  perform 1 from app.canonical_entities as entity
  where entity.id = any(affected_entity_ids) order by entity.id for update;
  perform 1 from app.search_documents as document
  where document.entity_id = any(affected_entity_ids) order by document.entity_id, document.id for update;
  perform 1 from app.embeddings as embedding
  where embedding.entity_id = any(affected_entity_ids) order by embedding.entity_id, embedding.id for update;

  select coalesce(array_agg(distinct candidate.id order by candidate.id), '{}'::uuid[])
  into candidate_ids
  from app.duplicate_candidates as candidate
  where candidate.record_a_id = selected_record.id or candidate.record_b_id = selected_record.id
    or exists (
      select 1 from app.duplicate_candidate_decisions as decision
      where decision.duplicate_candidate_id = candidate.id
        and p_version_id = any(decision.evidence_version_ids)
    );
  perform 1 from app.duplicate_candidates as candidate
  where candidate.id = any(candidate_ids) order by candidate.id for update;
  perform 1 from app.duplicate_candidate_decisions as decision
  where decision.duplicate_candidate_id = any(candidate_ids)
  order by decision.duplicate_candidate_id, decision.decided_at, decision.id for update;

  update app.source_record_parse_attempts
  set normalized_output = null, output_redacted_at = statement_timestamp()
  where source_record_version_id = p_version_id
    and status = 'SUCCEEDED' and normalized_output is not null;
  get diagnostics attempts_sanitized = row_count;

  update app.source_record_versions
  set payload = null, source_url = null, http_etag = null, http_last_modified = null,
      content_status = 'REDACTED', redaction_reason = p_reason,
      redacted_at = statement_timestamp(), redacted_by = session_user,
      redaction_operation_id = p_operation_id
  where id = p_version_id;

  if selected_record.current_version_id = p_version_id then
    select version.id, attempt.id
    into alternative_version_id, alternative_attempt_id
    from app.source_record_versions as version
    join lateral (
      select candidate_attempt.id
      from app.source_record_parse_attempts as candidate_attempt
      where candidate_attempt.source_record_version_id = version.id
        and candidate_attempt.status = 'SUCCEEDED'
        and candidate_attempt.normalized_output is not null
        and candidate_attempt.output_redacted_at is null
      order by candidate_attempt.attempted_at desc, candidate_attempt.id desc
      limit 1
    ) as attempt on true
    where version.source_record_id = selected_record.id
      and version.id <> p_version_id
      and version.content_status = 'AVAILABLE' and version.payload is not null
    order by version.observed_at desc, version.created_at desc, version.id desc
    limit 1;
    update app.source_records
    set current_version_id = alternative_version_id,
        current_parse_attempt_id = alternative_attempt_id
    where id = selected_record.id;
    if alternative_version_id is null then current_cleared := 1; else current_reselected := 1; end if;
  end if;

  for provenance_row in
    select provenance.* from app.canonical_fact_provenance as provenance
    where provenance.source_record_version_id = p_version_id and provenance.is_current
    order by provenance.entity_id, provenance.fact_key
  loop
    update app.canonical_fact_provenance
    set is_current = false, superseded_at = statement_timestamp()
    where id = provenance_row.id;
    select entity.entity_type into entity_type from app.canonical_entities as entity
    where entity.id = provenance_row.entity_id;
    select alternative.source_record_version_id, alternative.selection_method,
           app.unambiguous_targeted_fact_value(
             alternative.source_record_version_id, provenance_row.fact_key, entity_type
           )
    into alternative_version_id, alternative_method, alternative_value
    from app.canonical_fact_provenance as alternative
    join app.source_record_versions as version on version.id = alternative.source_record_version_id
    join app.source_records as record on record.id = version.source_record_id
    join app.sources as source on source.id = record.source_id
    where alternative.entity_id = provenance_row.entity_id
      and alternative.fact_key = provenance_row.fact_key
      and alternative.id <> provenance_row.id
      and version.content_status = 'AVAILABLE' and version.payload is not null
      and source.enabled and source.id <> selected_record.source_id
      and record.canonical_entity_id = provenance_row.entity_id
      and app.unambiguous_targeted_fact_value(
        alternative.source_record_version_id, provenance_row.fact_key, entity_type
      ) is not null
    order by alternative.selected_at desc, alternative.id desc
    limit 1;
    if alternative_version_id is not null then
      perform app.apply_targeted_fact_value(
        provenance_row.entity_id, provenance_row.fact_key, alternative_value, alternative_version_id
      );
      insert into app.canonical_fact_provenance (
        entity_id, fact_key, source_record_version_id, selection_method, note, created_by
      ) values (
        provenance_row.entity_id, provenance_row.fact_key, alternative_version_id,
        alternative_method, 'COMPLIANCE_RESELECTION:' || p_operation_id::text, session_user
      );
      facts_reselected := facts_reselected + 1;
    else
      repair_outcome := app.remove_or_withhold_targeted_fact(provenance_row.entity_id, provenance_row.fact_key);
      if repair_outcome = 'WITHHELD' then facts_withheld := facts_withheld + 1;
      else optional_facts_removed := optional_facts_removed + 1; end if;
    end if;
    alternative_version_id := null;
    alternative_method := null;
    alternative_value := null;
  end loop;

  for membership_row in
    select membership.* from app.entity_taxonomy_memberships as membership
    where membership.source_record_version_id = p_version_id and membership.active
    order by membership.entity_id, membership.taxonomy_node_id
  loop
    update app.entity_taxonomy_memberships set active = false where id = membership_row.id;
    memberships_deactivated := memberships_deactivated + 1;
    select alternative.id into alternative_membership_id
    from app.entity_taxonomy_memberships as alternative
    join app.source_record_versions as version on version.id = alternative.source_record_version_id
    join app.source_records as record on record.id = version.source_record_id
    join app.sources as source on source.id = record.source_id
    where alternative.entity_id = membership_row.entity_id
      and alternative.taxonomy_node_id = membership_row.taxonomy_node_id
      and not alternative.active and alternative.id <> membership_row.id
      and version.content_status = 'AVAILABLE' and source.enabled
      and source.id <> selected_record.source_id
    order by alternative.created_at desc, alternative.id desc
    limit 1;
    if alternative_membership_id is not null then
      update app.entity_taxonomy_memberships set active = true where id = alternative_membership_id;
      memberships_reactivated := memberships_reactivated + 1;
    end if;
    alternative_membership_id := null;
  end loop;

  update app.entity_aliases set active = false
  where source_record_version_id = p_version_id and active;
  get diagnostics aliases_deactivated = row_count;

  for affected_entity_id in select unnest(affected_entity_ids) order by 1
  loop
    if exists (
      select 1 from app.canonical_entities as entity
      where entity.id = affected_entity_id and entity.publication_status = 'PUBLISHED'
    ) and not exists (
      select 1 from app.entity_taxonomy_memberships as membership
      where membership.entity_id = affected_entity_id and membership.active
    ) then
      update app.canonical_entities set publication_status = 'WITHHELD', published_at = null
      where id = affected_entity_id;
      facts_withheld := facts_withheld + 1;
    end if;

    delete from app.embeddings as embedding where embedding.entity_id = affected_entity_id;
    get diagnostics mutation_rows = row_count;
    embeddings_purged := embeddings_purged + mutation_rows;

    select document.document_version, document.template_version
    into document_version, template_version
    from app.search_documents as document where document.entity_id = affected_entity_id
    order by document.is_active desc, document.generated_at desc, document.id desc limit 1;
    update app.search_documents as document
    set content_hash = pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
          'COMPLIANCE_REDACTED:' || document.id::text || ':' || p_operation_id::text, 'UTF8'
        ), 'sha256'), 'hex'),
        display_name = '[REDACTED]', names_text = '', aliases_text = '',
        taxonomy_en_text = '', taxonomy_sv_text = '', facts_text = '',
        description_text = '', event_context_text = '', embedding_text = '',
        fts = pg_catalog.to_tsvector('simple', ''), generated_at = statement_timestamp(),
        is_active = false
    where document.entity_id = affected_entity_id;
    get diagnostics mutation_rows = row_count;
    documents_sanitized := documents_sanitized + mutation_rows;

    if document_version is not null and exists (
      select 1 from app.canonical_entities as entity
      where entity.id = affected_entity_id and entity.publication_status = 'PUBLISHED'
    ) then
      select entity.canonical_name into safe_name from app.canonical_entities as entity
      where entity.id = affected_entity_id and exists (
        select 1 from app.canonical_fact_provenance as provenance
        join app.source_record_versions as version on version.id = provenance.source_record_version_id
        where provenance.entity_id = entity.id and provenance.fact_key = 'canonical_name'
          and provenance.is_current and version.content_status = 'AVAILABLE'
      );
      select coalesce(string_agg(alias.alias, ' ' order by alias.alias_norm, alias.id), '')
      into safe_aliases from app.entity_aliases as alias
      left join app.source_record_versions as version on version.id = alias.source_record_version_id
      where alias.entity_id = affected_entity_id and alias.active
        and (alias.source_record_version_id is null or version.content_status = 'AVAILABLE');
      select coalesce(string_agg(node.label_en, ' ' order by node.path, node.id), ''),
             coalesce(string_agg(node.label_sv, ' ' order by node.path, node.id), '')
      into safe_taxonomy_en, safe_taxonomy_sv
      from app.entity_taxonomy_memberships as membership
      join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
      left join app.source_record_versions as version on version.id = membership.source_record_version_id
      where membership.entity_id = affected_entity_id and membership.active
        and (membership.source_record_version_id is null or version.content_status = 'AVAILABLE');
      safe_embedding_text := pg_catalog.concat_ws(' ', safe_name, safe_aliases, safe_taxonomy_en, safe_taxonomy_sv);
      safe_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(jsonb_build_object(
        'displayName', safe_name, 'aliases', safe_aliases,
        'taxonomyEn', safe_taxonomy_en, 'taxonomySv', safe_taxonomy_sv,
        'facts', '', 'description', '', 'eventContext', '',
        'embeddingText', safe_embedding_text
      )::text, 'UTF8'), 'sha256'), 'hex')::char(64);
      insert into app.search_documents (
        entity_id, document_version, template_version, content_hash,
        display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
        facts_text, description_text, event_context_text, embedding_text,
        fts, generated_at, is_active
      ) values (
        affected_entity_id, document_version, template_version, safe_hash,
        safe_name, safe_name, safe_aliases, safe_taxonomy_en, safe_taxonomy_sv,
        '', '', '', safe_embedding_text,
        pg_catalog.to_tsvector('simple', pg_catalog.concat_ws(
          ' ', safe_name, safe_aliases, safe_taxonomy_en, safe_taxonomy_sv
        )), statement_timestamp(), true
      );
    end if;
    document_version := null;
    template_version := null;
    safe_name := null;
  end loop;

  update app.duplicate_candidates as candidate
  set evidence_summary = jsonb_build_object(
    'sanitized', true, 'recordAId', candidate.record_a_id, 'recordBId', candidate.record_b_id
  ) where candidate.id = any(candidate_ids);
  get diagnostics duplicate_candidates_sanitized = row_count;
  update app.duplicate_candidate_decisions as decision
  set note = '[REDACTED]'
  where decision.duplicate_candidate_id = any(candidate_ids)
    and decision.note is not null and decision.note <> '[REDACTED]';
  get diagnostics duplicate_notes_sanitized = row_count;

  safe_counts := jsonb_build_object(
    'attemptsSanitized', attempts_sanitized,
    'currentReselected', current_reselected,
    'currentCleared', current_cleared,
    'factsReselected', facts_reselected,
    'factsWithheld', facts_withheld,
    'optionalFactsRemoved', optional_facts_removed,
    'membershipsDeactivated', memberships_deactivated,
    'membershipsReactivated', memberships_reactivated,
    'aliasesDeactivated', aliases_deactivated,
    'documentsSanitized', documents_sanitized,
    'embeddingsPurged', embeddings_purged,
    'duplicateCandidatesSanitized', duplicate_candidates_sanitized,
    'duplicateNotesSanitized', duplicate_notes_sanitized
  );
  insert into app.compliance_redaction_audit (
    operation_id, source_record_version_id, source_record_id, source_id,
    actor, reason_code, outcome, safe_counts
  ) values (
    p_operation_id, p_version_id, selected_record.id, selected_record.source_id,
    session_user, p_reason, 'COMPLETED', safe_counts
  );
  return jsonb_build_object(
    'versionId', p_version_id, 'operationId', p_operation_id,
    'actor', session_user, 'reasonCode', p_reason,
    'outcome', 'COMPLETED', 'idempotent', false, 'counts', safe_counts
  );
end;
$$;

revoke execute on function app.extract_targeted_fact(jsonb, app.fact_key, app.entity_type)
from public, anon, authenticated, service_role;
revoke execute on function app.unambiguous_targeted_fact_value(uuid, app.fact_key, app.entity_type)
from public, anon, authenticated, service_role;
revoke execute on function app.apply_targeted_fact_value(uuid, app.fact_key, jsonb, uuid)
from public, anon, authenticated, service_role;
revoke execute on function app.remove_or_withhold_targeted_fact(uuid, app.fact_key)
from public, anon, authenticated, service_role;
revoke execute on function app.replace_targeted_canonical_fact(
  uuid, app.fact_key, jsonb, uuid, text, text, text
) from public, anon, authenticated, service_role;
revoke execute on function app.source_revocation_impact(uuid, integer)
from public, anon, authenticated, service_role;
revoke execute on function app.redact_source_record_version(uuid, uuid, text)
from public, anon, authenticated, service_role, lemon_ingestion, lemon_reviewer;
revoke execute on function app.protect_compliance_redaction_audit()
from public, anon, authenticated, service_role;

grant lemon_compliance_owner to postgres;
grant create on schema app to lemon_compliance_owner;
alter function app.redact_source_record_version(uuid, uuid, text)
owner to lemon_compliance_owner;
revoke create on schema app from lemon_compliance_owner;

grant usage on schema app, extensions to lemon_compliance_owner;
grant select on
  app.sources,
  app.ingestion_runs,
  app.source_records,
  app.source_record_versions,
  app.source_record_parse_attempts,
  app.canonical_entities,
  app.places,
  app.events,
  app.canonical_fact_provenance,
  app.entity_taxonomy_memberships,
  app.entity_aliases,
  app.taxonomy_nodes,
  app.search_documents,
  app.embeddings,
  app.duplicate_candidates,
  app.duplicate_candidate_decisions,
  app.compliance_redaction_audit
to lemon_compliance_owner;
grant update on app.sources to lemon_compliance_owner;
grant update (current_version_id, current_parse_attempt_id)
on app.source_records to lemon_compliance_owner;
grant update (
  payload, source_url, http_etag, http_last_modified, content_status,
  redaction_reason, redacted_at, redacted_by, redaction_operation_id
) on app.source_record_versions to lemon_compliance_owner;
grant update (normalized_output, output_redacted_at)
on app.source_record_parse_attempts to lemon_compliance_owner;
grant insert on app.canonical_fact_provenance to lemon_compliance_owner;
grant update (is_current, superseded_at)
on app.canonical_fact_provenance to lemon_compliance_owner;
grant update (active) on app.entity_taxonomy_memberships, app.entity_aliases
to lemon_compliance_owner;
grant update (publication_status, published_at)
on app.canonical_entities to lemon_compliance_owner;
grant insert, update on app.search_documents to lemon_compliance_owner;
grant update, delete on app.embeddings to lemon_compliance_owner;
grant update (evidence_summary) on app.duplicate_candidates to lemon_compliance_owner;
grant update (note) on app.duplicate_candidate_decisions to lemon_compliance_owner;
grant insert on app.compliance_redaction_audit to lemon_compliance_owner;
grant execute on function app.is_bounded_error_summary(jsonb)
to lemon_compliance_owner;
grant execute on function app.unambiguous_targeted_fact_value(uuid, app.fact_key, app.entity_type)
to lemon_compliance_owner;
grant execute on function app.apply_targeted_fact_value(uuid, app.fact_key, jsonb, uuid)
to lemon_compliance_owner;
grant execute on function app.remove_or_withhold_targeted_fact(uuid, app.fact_key)
to lemon_compliance_owner;

create policy sources_compliance_owner_read on app.sources
for select to lemon_compliance_owner using (true);
create policy ingestion_runs_compliance_owner_read on app.ingestion_runs
for select to lemon_compliance_owner using (true);
create policy source_records_compliance_owner on app.source_records
for all to lemon_compliance_owner using (true) with check (true);
create policy source_record_versions_compliance_owner on app.source_record_versions
for all to lemon_compliance_owner using (true) with check (true);
create policy source_record_parse_attempts_compliance_owner on app.source_record_parse_attempts
for all to lemon_compliance_owner using (true) with check (true);
create policy canonical_entities_compliance_owner on app.canonical_entities
for all to lemon_compliance_owner using (true) with check (true);
create policy places_compliance_owner_read on app.places
for select to lemon_compliance_owner using (true);
create policy events_compliance_owner_read on app.events
for select to lemon_compliance_owner using (true);
create policy canonical_fact_provenance_compliance_owner on app.canonical_fact_provenance
for all to lemon_compliance_owner using (true) with check (true);
create policy entity_taxonomy_memberships_compliance_owner on app.entity_taxonomy_memberships
for all to lemon_compliance_owner using (true) with check (true);
create policy entity_aliases_compliance_owner on app.entity_aliases
for all to lemon_compliance_owner using (true) with check (true);
create policy taxonomy_nodes_compliance_owner_read on app.taxonomy_nodes
for select to lemon_compliance_owner using (true);
create policy search_documents_compliance_owner on app.search_documents
for all to lemon_compliance_owner using (true) with check (true);
create policy embeddings_compliance_owner on app.embeddings
for all to lemon_compliance_owner using (true) with check (true);
create policy duplicate_candidates_compliance_owner on app.duplicate_candidates
for all to lemon_compliance_owner using (true) with check (true);
create policy duplicate_candidate_decisions_compliance_owner on app.duplicate_candidate_decisions
for all to lemon_compliance_owner using (true) with check (true);
create policy compliance_redaction_audit_owner on app.compliance_redaction_audit
for all to lemon_compliance_owner using (true) with check (true);

grant usage on schema app to lemon_compliance;
grant execute on function app.redact_source_record_version(uuid, uuid, text)
to lemon_compliance;
grant execute on function app.source_revocation_impact(uuid, integer)
to lemon_compliance, lemon_reviewer;
grant execute on function app.replace_targeted_canonical_fact(
  uuid, app.fact_key, jsonb, uuid, text, text, text
) to lemon_ingestion, lemon_reviewer;
