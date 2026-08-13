create function app.select_source_record_current_evidence(
  p_source_record_id uuid,
  p_source_record_version_id uuid,
  p_source_record_parse_attempt_id uuid,
  p_ingestion_run_id uuid,
  p_parser_version text,
  p_expected_current_version_id uuid,
  p_expected_current_parse_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_record app.source_records%rowtype;
  selected_version app.source_record_versions%rowtype;
  selected_attempt app.source_record_parse_attempts%rowtype;
  selected_run app.ingestion_runs%rowtype;
  selected_source_enabled boolean;
  updated_rows integer;
begin
  if p_source_record_version_id is null
    or p_source_record_parse_attempt_id is null
    or p_ingestion_run_id is null
    or p_parser_version is null
    or btrim(p_parser_version) = ''
  then
    raise exception using
      errcode = '22023',
      message = 'selected source evidence execution must be fully specified';
  end if;

  if (p_expected_current_version_id is null)
    <> (p_expected_current_parse_attempt_id is null)
  then
    raise exception using
      errcode = '22023',
      message = 'expected source-current evidence must be a complete pair';
  end if;

  select record.*
  into selected_record
  from app.source_records as record
  where record.id = p_source_record_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'source record does not exist';
  end if;

  select source.enabled
  into selected_source_enabled
  from app.sources as source
  where source.id = selected_record.source_id;

  if selected_source_enabled is distinct from true then
    raise exception using
      errcode = '23514',
      message = 'source is not enabled for current-evidence selection';
  end if;

  select version.*
  into selected_version
  from app.source_record_versions as version
  where version.id = p_source_record_version_id;

  if not found
    or selected_version.source_record_id <> selected_record.id
    or selected_version.content_status <> 'AVAILABLE'
    or selected_version.payload is null
  then
    raise exception using
      errcode = '23514',
      message = 'selected source record version is not owned and available';
  end if;

  select attempt.*
  into selected_attempt
  from app.source_record_parse_attempts as attempt
  where attempt.id = p_source_record_parse_attempt_id;

  if not found
    or selected_attempt.source_record_version_id <> selected_version.id
    or selected_attempt.status <> 'SUCCEEDED'
    or selected_attempt.finished_at is null
    or selected_attempt.error_class is not null
    or selected_attempt.error_code is not null
    or selected_attempt.normalized_output is null
    or selected_attempt.normalized_output_hash is null
    or selected_attempt.output_redacted_at is not null
  then
    raise exception using
      errcode = '23514',
      message = 'selected parse attempt is not a valid successful output for the version';
  end if;

  if selected_attempt.ingestion_run_id <> p_ingestion_run_id
    or selected_attempt.parser_version <> p_parser_version
  then
    raise exception using
      errcode = '23514',
      message = 'selected parse attempt does not match the intended execution';
  end if;

  select run.*
  into selected_run
  from app.ingestion_runs as run
  where run.id = p_ingestion_run_id
  for share;

  if not found
    or selected_run.source_id <> selected_record.source_id
    or selected_run.status <> 'STARTED'
    or selected_run.parser_version <> p_parser_version
  then
    raise exception using
      errcode = '23514',
      message = 'selected ingestion and parser execution is not active';
  end if;

  if selected_record.current_version_id
      is distinct from p_expected_current_version_id
    or selected_record.current_parse_attempt_id
      is distinct from p_expected_current_parse_attempt_id
  then
    raise exception using
      errcode = '40001',
      message = 'stale source-current evidence selection';
  end if;

  update app.source_records as record
  set current_version_id = selected_version.id,
      current_parse_attempt_id = selected_attempt.id
  where record.id = selected_record.id
    and record.current_version_id
      is not distinct from p_expected_current_version_id
    and record.current_parse_attempt_id
      is not distinct from p_expected_current_parse_attempt_id;

  get diagnostics updated_rows = row_count;

  if updated_rows <> 1 then
    raise exception using
      errcode = '40001',
      message = 'stale source-current evidence selection';
  end if;
end;
$$;

create function app.assert_source_record_current_evidence(
  p_source_record_id uuid,
  p_source_record_version_id uuid,
  p_source_record_parse_attempt_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_record app.source_records%rowtype;
  selected_version app.source_record_versions%rowtype;
  selected_attempt app.source_record_parse_attempts%rowtype;
begin
  if p_source_record_version_id is null
    or p_source_record_parse_attempt_id is null
  then
    raise exception using
      errcode = '22023',
      message = 'processing evidence must be a complete pair';
  end if;

  select record.*
  into selected_record
  from app.source_records as record
  where record.id = p_source_record_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'source record does not exist';
  end if;

  if selected_record.current_version_id
      is distinct from p_source_record_version_id
    or selected_record.current_parse_attempt_id
      is distinct from p_source_record_parse_attempt_id
  then
    raise exception using
      errcode = '40001',
      message = 'stale source-current evidence processing';
  end if;

  select version.*
  into selected_version
  from app.source_record_versions as version
  where version.id = p_source_record_version_id;

  select attempt.*
  into selected_attempt
  from app.source_record_parse_attempts as attempt
  where attempt.id = p_source_record_parse_attempt_id;

  if selected_version.id is null
    or selected_version.source_record_id <> selected_record.id
    or selected_version.content_status <> 'AVAILABLE'
    or selected_attempt.id is null
    or selected_attempt.source_record_version_id <> selected_version.id
    or selected_attempt.status <> 'SUCCEEDED'
  then
    raise exception using
      errcode = '23514',
      message = 'selected source-current evidence is no longer processable';
  end if;
end;
$$;

create function app.enforce_source_current_evidence_selection()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  relation_owner name;
begin
  if (tg_op = 'INSERT'
      and (new.current_version_id is not null
        or new.current_parse_attempt_id is not null))
    or (tg_op = 'UPDATE'
      and (new.current_version_id is distinct from old.current_version_id
        or new.current_parse_attempt_id is distinct from old.current_parse_attempt_id))
  then
    select pg_catalog.pg_get_userbyid(relation.relowner)
    into relation_owner
    from pg_catalog.pg_class as relation
    where relation.oid = tg_relid;

    if current_user <> relation_owner then
      raise exception using
        errcode = '42501',
        message = 'source-current evidence must be changed through the selection transaction';
    end if;
  end if;

  return new;
end;
$$;

create trigger source_records_enforce_current_selection
before insert or update of current_version_id, current_parse_attempt_id
on app.source_records
for each row execute function app.enforce_source_current_evidence_selection();

revoke execute on function app.select_source_record_current_evidence(
  uuid, uuid, uuid, uuid, text, uuid, uuid
) from public, anon, authenticated, service_role;
revoke execute on function app.assert_source_record_current_evidence(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
revoke execute on function app.enforce_source_current_evidence_selection()
from public, anon, authenticated, service_role;

grant execute on function app.select_source_record_current_evidence(
  uuid, uuid, uuid, uuid, text, uuid, uuid
) to lemon_ingestion;
grant execute on function app.assert_source_record_current_evidence(
  uuid, uuid, uuid
) to lemon_ingestion;
