create schema if not exists extensions;

create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema app;
create schema api;
create schema diagnostic;

revoke all on schema app from public, anon, authenticated, service_role;
revoke all on schema api from public, anon, authenticated;
revoke all on schema diagnostic from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lemon_reference_admin') then
    create role lemon_reference_admin nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_ingestion') then
    create role lemon_ingestion nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_api_owner') then
    create role lemon_api_owner nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_reviewer') then
    create role lemon_reviewer nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_compliance_owner') then
    create role lemon_compliance_owner nologin noinherit;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_compliance') then
    create role lemon_compliance nologin;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'lemon_evaluation') then
    create role lemon_evaluation nologin;
  end if;
end
$$;

create type app.entity_type as enum ('PLACE', 'EVENT');
create type app.publication_status as enum ('DRAFT', 'PUBLISHED', 'WITHHELD', 'MERGED');
create type app.place_status as enum ('ACTIVE', 'TEMPORARILY_CLOSED', 'CLOSED', 'UNKNOWN');
create type app.event_status as enum ('SCHEDULED', 'CANCELLED', 'COMPLETED', 'POSTPONED', 'UNKNOWN');
create type app.duplicate_decision as enum ('OPEN', 'SAME', 'SEPARATE', 'UNSURE');
create type app.taxonomy_membership_method as enum ('SOURCE_FACT', 'DETERMINISTIC_MAP', 'MANUAL');
create type app.coverage_status as enum ('COMPLETE', 'SUPPLY_CONSTRAINED', 'NEEDS_VALIDATION');
create type app.ingestion_run_status as enum ('STARTED', 'SUCCEEDED', 'PARTIAL', 'FAILED');
create type app.source_refresh_mode as enum ('COMPLETE_SNAPSHOT', 'PAGINATED_SNAPSHOT', 'DELTA_ONLY');
create type app.source_parse_attempt_status as enum ('STARTED', 'SUCCEEDED', 'FAILED');
create type app.source_content_status as enum ('AVAILABLE', 'REDACTED');
create type app.source_resolution_method as enum (
  'SOURCE_IDENTITY',
  'SHARED_STABLE_ID',
  'MANUAL_MAPPING',
  'NEW_CANONICAL',
  'UNRESOLVED'
);
create type app.alias_kind as enum ('OFFICIAL', 'ALTERNATE', 'FORMER', 'CHAIN', 'MANUAL');
create type app.embedding_status as enum ('READY', 'FAILED', 'STALE');
create type app.fact_key as enum (
  'canonical_name',
  'location',
  'address',
  'opening_hours',
  'event_start',
  'event_end',
  'event_status'
);

create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function app.reject_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = format('%I rows cannot be deleted', tg_table_name);
end;
$$;

revoke execute on function app.set_updated_at() from public;
revoke execute on function app.reject_delete() from public;

create table app.geographic_scopes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  scope_type text not null default 'MUNICIPALITY'
    check (scope_type in ('MUNICIPALITY', 'CITY', 'REGION')),
  name_en text not null,
  name_sv text not null,
  timezone text not null,
  country_code char(2) not null check (country_code ~ '^[A-Z]{2}$'),
  is_active boolean not null default false,
  public_search_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index geographic_scopes_active_slug_idx
  on app.geographic_scopes (slug)
  where is_active;
create index geographic_scopes_public_search_enabled_idx
  on app.geographic_scopes (public_search_enabled);

create trigger geographic_scopes_set_updated_at
before update on app.geographic_scopes
for each row execute function app.set_updated_at();

create function app.protect_geographic_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception using errcode = '55000', message = 'geographic scope slug is immutable';
  end if;
  return new;
end;
$$;

create trigger geographic_scopes_protect
before update on app.geographic_scopes
for each row execute function app.protect_geographic_scope();
create trigger geographic_scopes_reject_delete
before delete on app.geographic_scopes
for each row execute function app.reject_delete();

create table app.geographic_scope_boundaries (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references app.geographic_scopes (id) on delete restrict,
  version text not null,
  boundary extensions.geometry(MultiPolygon, 4326) not null,
  source_name text not null,
  source_url text not null,
  licence text not null,
  attribution text not null,
  source_checksum char(64) not null
    check (source_checksum ~ '^[0-9a-f]{64}$'),
  effective_from timestamptz not null,
  effective_to timestamptz null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope_id, version),
  unique (id, scope_id),
  check (not extensions.st_isempty(boundary)),
  check (extensions.st_isvalid(boundary)),
  check (extensions.st_srid(boundary) = 4326),
  check (effective_to is null or effective_to > effective_from)
);

create unique index geographic_scope_boundaries_one_active_idx
  on app.geographic_scope_boundaries (scope_id)
  where is_active;
create index geographic_scope_boundaries_boundary_idx
  on app.geographic_scope_boundaries using gist (boundary);
create index geographic_scope_boundaries_effective_idx
  on app.geographic_scope_boundaries (scope_id, effective_from desc);

create trigger geographic_scope_boundaries_set_updated_at
before update on app.geographic_scope_boundaries
for each row execute function app.set_updated_at();

create function app.protect_geographic_scope_boundary()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.scope_id is distinct from old.scope_id
    or new.version is distinct from old.version
    or extensions.st_asewkb(new.boundary) is distinct from extensions.st_asewkb(old.boundary)
    or new.source_name is distinct from old.source_name
    or new.source_url is distinct from old.source_url
    or new.licence is distinct from old.licence
    or new.attribution is distinct from old.attribution
    or new.source_checksum is distinct from old.source_checksum
    or new.effective_from is distinct from old.effective_from
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '55000',
      message = 'geographic scope boundary evidence is immutable';
  end if;
  return new;
end;
$$;

create trigger geographic_scope_boundaries_protect
before update on app.geographic_scope_boundaries
for each row execute function app.protect_geographic_scope_boundary();
create trigger geographic_scope_boundaries_reject_delete
before delete on app.geographic_scope_boundaries
for each row execute function app.reject_delete();

create table app.sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  kind text not null check (
    kind in ('OSM_OVERPASS', 'MUNICIPAL', 'WIKIDATA', 'OFFICIAL_SITE', 'MANUAL', 'EVENT_FEED')
  ),
  base_url text null,
  licence text not null,
  licence_url text null,
  terms_url text null,
  attribution text not null,
  persistence_permission text not null check (
    persistence_permission in ('FULL_PAYLOAD', 'EXTRACTED_FIELDS_ONLY', 'METADATA_ONLY')
  ),
  refresh_mode app.source_refresh_mode not null,
  rate_limit_requests integer null,
  rate_limit_window_seconds integer null,
  adapter_version text not null,
  credentials_secret_name text null,
  enabled boolean not null default false,
  last_successful_refresh timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (rate_limit_requests is null and rate_limit_window_seconds is null)
    or (
      rate_limit_requests is not null
      and rate_limit_window_seconds is not null
      and rate_limit_requests > 0
      and rate_limit_window_seconds > 0
    )
  ),
  check (
    not enabled
    or (
      btrim(licence) <> ''
      and btrim(attribution) <> ''
      and btrim(adapter_version) <> ''
    )
  )
);

create index sources_enabled_key_idx on app.sources (enabled, key);

create trigger sources_set_updated_at
before update on app.sources
for each row execute function app.set_updated_at();

create function app.protect_source_registry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.key is distinct from old.key then
    raise exception using errcode = '55000', message = 'source key is immutable';
  end if;

  if new.last_successful_refresh is distinct from old.last_successful_refresh
    and pg_trigger_depth() <= 1
  then
    raise exception using
      errcode = '55000',
      message = 'source refresh health is derived from qualifying ingestion runs';
  end if;

  return new;
end;
$$;

create trigger sources_protect
before update on app.sources
for each row execute function app.protect_source_registry();
create trigger sources_reject_delete
before delete on app.sources
for each row execute function app.reject_delete();

create function app.is_bounded_error_summary(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and octet_length(value::text) <= 16384
    and not exists (
      select 1
      from jsonb_each(value) as item
      where jsonb_typeof(item.value) <> 'number'
    )
    and not exists (
      select 1
      from jsonb_each(value) as item
      where jsonb_typeof(item.value) = 'number'
        and ((item.value #>> '{}')::numeric < 0
        or trunc((item.value #>> '{}')::numeric) <> (item.value #>> '{}')::numeric
        )
    );
$$;

revoke execute on function app.is_bounded_error_summary(jsonb) from public;

create table app.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  source_id uuid not null references app.sources (id) on delete restrict,
  scope_id uuid not null references app.geographic_scopes (id) on delete restrict,
  adapter_version text not null,
  parser_version text not null,
  mapping_version text not null,
  retry_of_run_id uuid null references app.ingestion_runs (id) on delete restrict,
  snapshot_key text null,
  refresh_unit_complete boolean not null default false,
  snapshot_complete boolean null,
  status app.ingestion_run_status not null default 'STARTED',
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  fetched integer not null default 0 check (fetched >= 0),
  valid integer not null default 0 check (valid >= 0),
  invalid integer not null default 0 check (invalid >= 0),
  new_count integer not null default 0 check (new_count >= 0),
  changed integer not null default 0 check (changed >= 0),
  unchanged integer not null default 0 check (unchanged >= 0),
  unresolved_duplicates integer not null default 0 check (unresolved_duplicates >= 0),
  disappeared integer not null default 0 check (disappeared >= 0),
  published integer not null default 0 check (published >= 0),
  error_code text null,
  error_summary jsonb null check (
    error_summary is null or app.is_bounded_error_summary(error_summary)
  ),
  created_at timestamptz not null default now(),
  check (retry_of_run_id is null or retry_of_run_id <> id),
  check (
    (status = 'STARTED' and finished_at is null)
    or (status <> 'STARTED' and finished_at is not null)
  )
);

create index ingestion_runs_source_started_idx
  on app.ingestion_runs (source_id, started_at desc);
create index ingestion_runs_status_started_idx
  on app.ingestion_runs (status, started_at);
create index ingestion_runs_retry_idx on app.ingestion_runs (retry_of_run_id);

create function app.validate_ingestion_run()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  declared_refresh_mode app.source_refresh_mode;
begin
  if tg_op = 'INSERT' and new.status <> 'STARTED' then
    raise exception using
      errcode = '23514',
      message = 'ingestion run must begin in STARTED state';
  end if;

  select source.refresh_mode
  into declared_refresh_mode
  from app.sources as source
  where source.id = new.source_id;

  if declared_refresh_mode is null then
    raise exception using errcode = '23503', message = 'ingestion run source does not exist';
  end if;

  if new.retry_of_run_id is not null and not exists (
    select 1
    from app.ingestion_runs as prior
    where prior.id = new.retry_of_run_id
      and prior.status <> 'STARTED'
      and prior.source_id = new.source_id
      and prior.scope_id = new.scope_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'retry must reference a terminal run for the same source and scope';
  end if;

  if new.status = 'SUCCEEDED' and not new.refresh_unit_complete then
    raise exception using
      errcode = '23514',
      message = 'successful ingestion run must complete its refresh unit';
  end if;

  if declared_refresh_mode = 'DELTA_ONLY' then
    if new.snapshot_complete is not null then
      raise exception using
        errcode = '23514',
        message = 'DELTA_ONLY run snapshot_complete must be null';
    end if;
    if new.disappeared <> 0 then
      raise exception using
        errcode = '23514',
        message = 'DELTA_ONLY run cannot produce disappearance';
    end if;
  elsif new.status = 'SUCCEEDED' and new.snapshot_complete is distinct from true then
    raise exception using
      errcode = '23514',
      message = 'successful snapshot run must confirm snapshot completeness';
  end if;

  return new;
end;
$$;

create function app.protect_ingestion_run()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'ingestion runs cannot be deleted';
  end if;

  if old.status <> 'STARTED' then
    raise exception using errcode = '55000', message = 'terminal ingestion runs are immutable';
  end if;

  if new.id is distinct from old.id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.source_id is distinct from old.source_id
    or new.scope_id is distinct from old.scope_id
    or new.adapter_version is distinct from old.adapter_version
    or new.parser_version is distinct from old.parser_version
    or new.mapping_version is distinct from old.mapping_version
    or new.retry_of_run_id is distinct from old.retry_of_run_id
    or new.started_at is distinct from old.started_at
    or new.created_at is distinct from old.created_at
  then
    raise exception using errcode = '55000', message = 'ingestion run identity is immutable';
  end if;

  return new;
end;
$$;

create function app.refresh_source_health()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.sources as source
  set last_successful_refresh = (
    select max(run.finished_at)
    from app.ingestion_runs as run
    where run.source_id = new.source_id
      and run.status = 'SUCCEEDED'
      and run.refresh_unit_complete
      and (
        source.refresh_mode = 'DELTA_ONLY'
        or run.snapshot_complete = true
      )
  )
  where source.id = new.source_id;

  return null;
end;
$$;

revoke execute on function app.validate_ingestion_run() from public;
revoke execute on function app.protect_ingestion_run() from public;
revoke execute on function app.refresh_source_health() from public;

create trigger ingestion_runs_protect
before update or delete on app.ingestion_runs
for each row execute function app.protect_ingestion_run();
create trigger ingestion_runs_validate
before insert or update on app.ingestion_runs
for each row execute function app.validate_ingestion_run();
create trigger ingestion_runs_refresh_source_health
after insert or update on app.ingestion_runs
for each row
when (new.status = 'SUCCEEDED')
execute function app.refresh_source_health();

create function app.refresh_source_health_after_mode_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update app.sources as source
  set last_successful_refresh = (
    select max(run.finished_at)
    from app.ingestion_runs as run
    where run.source_id = new.id
      and run.status = 'SUCCEEDED'
      and run.refresh_unit_complete
      and (
        new.refresh_mode = 'DELTA_ONLY'
        or run.snapshot_complete = true
      )
  )
  where source.id = new.id;

  return null;
end;
$$;

revoke execute on function app.refresh_source_health_after_mode_change() from public;

create trigger sources_refresh_health_after_mode_change
after update of refresh_mode on app.sources
for each row
when (new.refresh_mode is distinct from old.refresh_mode)
execute function app.refresh_source_health_after_mode_change();

create table app.source_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references app.sources (id) on delete restrict,
  external_key text not null,
  canonical_url text null,
  shared_identifier_scheme text null,
  shared_identifier_value text null,
  canonical_entity_id uuid null,
  resolution_method app.source_resolution_method not null default 'UNRESOLVED',
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  current_version_id uuid null,
  current_parse_attempt_id uuid null,
  miss_count integer not null default 0 check (miss_count >= 0),
  is_missing boolean not null default false,
  last_complete_snapshot_run_id uuid null
    references app.ingestion_runs (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_key),
  check (
    (shared_identifier_scheme is null and shared_identifier_value is null)
    or (shared_identifier_scheme is not null and shared_identifier_value is not null)
  ),
  check (
    (current_version_id is null and current_parse_attempt_id is null)
    or (current_version_id is not null and current_parse_attempt_id is not null)
  ),
  check (last_seen_at >= first_seen_at)
);

create index source_records_canonical_entity_idx
  on app.source_records (canonical_entity_id);
create index source_records_shared_identifier_idx
  on app.source_records (shared_identifier_scheme, shared_identifier_value)
  where shared_identifier_scheme is not null;
create index source_records_missing_idx
  on app.source_records (source_id, is_missing, last_seen_at);
create index source_records_current_version_idx
  on app.source_records (current_version_id);
create index source_records_current_parse_attempt_idx
  on app.source_records (current_parse_attempt_id);

create trigger source_records_set_updated_at
before update on app.source_records
for each row execute function app.set_updated_at();

create function app.protect_source_record()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.source_id is distinct from old.source_id
    or new.external_key is distinct from old.external_key
  then
    raise exception using errcode = '55000', message = 'source record identity is immutable';
  end if;
  return new;
end;
$$;

create function app.validate_last_complete_snapshot_run()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected_run app.ingestion_runs%rowtype;
  declared_refresh_mode app.source_refresh_mode;
begin
  if new.last_complete_snapshot_run_id is null then
    return new;
  end if;

  select run.*
  into selected_run
  from app.ingestion_runs as run
  where run.id = new.last_complete_snapshot_run_id;

  select source.refresh_mode
  into declared_refresh_mode
  from app.sources as source
  where source.id = new.source_id;

  if selected_run.id is null
    or selected_run.source_id <> new.source_id
    or selected_run.status <> 'SUCCEEDED'
    or selected_run.snapshot_complete is distinct from true
    or declared_refresh_mode = 'DELTA_ONLY'
  then
    raise exception using
      errcode = '23514',
      message = 'last complete snapshot run is not qualifying evidence for this source record';
  end if;

  return new;
end;
$$;

revoke execute on function app.protect_source_record() from public;
revoke execute on function app.validate_last_complete_snapshot_run() from public;

create trigger source_records_protect
before update on app.source_records
for each row execute function app.protect_source_record();
create trigger source_records_validate_snapshot_run
before insert or update of source_id, last_complete_snapshot_run_id on app.source_records
for each row execute function app.validate_last_complete_snapshot_run();
create trigger source_records_reject_delete
before delete on app.source_records
for each row execute function app.reject_delete();

create table app.source_record_versions (
  id uuid primary key default gen_random_uuid(),
  source_record_id uuid not null
    references app.source_records (id) on delete restrict,
  capture_run_id uuid not null
    references app.ingestion_runs (id) on delete restrict,
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb null,
  payload_storage_mode text not null check (
    payload_storage_mode in ('FULL_PAYLOAD', 'EXTRACTED_ENVELOPE', 'METADATA_ENVELOPE')
  ),
  source_url text null,
  http_etag text null,
  http_last_modified text null,
  fetched_at timestamptz not null,
  observed_at timestamptz not null,
  content_status app.source_content_status not null default 'AVAILABLE',
  redaction_reason text null,
  redacted_at timestamptz null,
  redacted_by text null,
  redaction_operation_id uuid null,
  created_at timestamptz not null default now(),
  unique (source_record_id, content_hash),
  check (
    (
      content_status = 'AVAILABLE'
      and payload is not null
      and redaction_reason is null
      and redacted_at is null
      and redacted_by is null
      and redaction_operation_id is null
    )
    or (
      content_status = 'REDACTED'
      and payload is null
      and redaction_reason is not null
      and redacted_at is not null
      and redacted_by is not null
      and redaction_operation_id is not null
    )
  )
);

create index source_record_versions_record_observed_idx
  on app.source_record_versions (source_record_id, observed_at desc);
create index source_record_versions_capture_run_idx
  on app.source_record_versions (capture_run_id);
create index source_record_versions_content_status_idx
  on app.source_record_versions (content_status);

create function app.validate_source_record_version_capture()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  record_source_id uuid;
  run_source_id uuid;
  run_status app.ingestion_run_status;
  permitted_storage text;
begin
  select record.source_id, source.persistence_permission
  into record_source_id, permitted_storage
  from app.source_records as record
  join app.sources as source on source.id = record.source_id
  where record.id = new.source_record_id;

  select run.source_id, run.status
  into run_source_id, run_status
  from app.ingestion_runs as run
  where run.id = new.capture_run_id;

  if record_source_id is null or run_source_id is null or record_source_id <> run_source_id then
    raise exception using
      errcode = '23514',
      message = 'capture run must belong to the source record source';
  end if;

  if run_status <> 'STARTED' then
    raise exception using
      errcode = '23514',
      message = 'capture run must be STARTED';
  end if;

  if new.payload_storage_mode = 'FULL_PAYLOAD' and permitted_storage <> 'FULL_PAYLOAD' then
    raise exception using errcode = '23514', message = 'source policy forbids full payload storage';
  end if;

  if new.payload_storage_mode = 'EXTRACTED_ENVELOPE'
    and permitted_storage = 'METADATA_ONLY'
  then
    raise exception using
      errcode = '23514',
      message = 'source policy forbids extracted field storage';
  end if;

  return new;
end;
$$;

create function app.reject_source_record_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'source record versions are immutable outside compliance redaction';
end;
$$;

revoke execute on function app.validate_source_record_version_capture() from public;
revoke execute on function app.reject_source_record_version_mutation() from public;

create trigger source_record_versions_validate_capture
before insert on app.source_record_versions
for each row execute function app.validate_source_record_version_capture();
create trigger source_record_versions_reject_mutation
before update or delete on app.source_record_versions
for each row execute function app.reject_source_record_version_mutation();

create table app.source_record_parse_attempts (
  id uuid primary key default gen_random_uuid(),
  source_record_version_id uuid not null
    references app.source_record_versions (id) on delete restrict,
  ingestion_run_id uuid not null
    references app.ingestion_runs (id) on delete restrict,
  parser_version text not null,
  status app.source_parse_attempt_status not null default 'STARTED',
  attempted_at timestamptz not null default now(),
  finished_at timestamptz null,
  error_class text null,
  error_code text null,
  normalized_output jsonb null,
  normalized_output_hash char(64) null
    check (normalized_output_hash is null or normalized_output_hash ~ '^[0-9a-f]{64}$'),
  output_redacted_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (source_record_version_id, parser_version, ingestion_run_id),
  check (
    (
      status = 'STARTED'
      and finished_at is null
      and error_class is null
      and error_code is null
      and normalized_output is null
      and normalized_output_hash is null
      and output_redacted_at is null
    )
    or (
      status = 'SUCCEEDED'
      and finished_at is not null
      and error_class is null
      and error_code is null
      and normalized_output_hash is not null
      and (
        (normalized_output is not null and output_redacted_at is null)
        or (normalized_output is null and output_redacted_at is not null)
      )
    )
    or (
      status = 'FAILED'
      and finished_at is not null
      and error_class is not null
      and error_code is not null
      and normalized_output is null
      and normalized_output_hash is null
      and output_redacted_at is null
    )
  )
);

create index source_record_parse_attempts_version_attempted_idx
  on app.source_record_parse_attempts (source_record_version_id, attempted_at desc);
create index source_record_parse_attempts_run_idx
  on app.source_record_parse_attempts (ingestion_run_id);
create index source_record_parse_attempts_success_idx
  on app.source_record_parse_attempts (source_record_version_id, parser_version)
  where status = 'SUCCEEDED';

create function app.validate_parse_attempt_execution()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  record_source_id uuid;
  run_source_id uuid;
  run_parser_version text;
  run_status app.ingestion_run_status;
  version_status app.source_content_status;
begin
  if tg_op = 'INSERT' and new.status <> 'STARTED' then
    raise exception using
      errcode = '23514',
      message = 'source parse attempt must begin in STARTED state';
  end if;

  select record.source_id, version.content_status
  into record_source_id, version_status
  from app.source_record_versions as version
  join app.source_records as record on record.id = version.source_record_id
  where version.id = new.source_record_version_id;

  select run.source_id, run.parser_version, run.status
  into run_source_id, run_parser_version, run_status
  from app.ingestion_runs as run
  where run.id = new.ingestion_run_id;

  if record_source_id is null or run_source_id is null or record_source_id <> run_source_id then
    raise exception using
      errcode = '23514',
      message = 'parse attempt run must belong to the source record source';
  end if;

  if new.parser_version <> run_parser_version then
    raise exception using
      errcode = '23514',
      message = 'parse attempt parser version must match its ingestion run';
  end if;

  if run_status <> 'STARTED' then
    raise exception using
      errcode = '23514',
      message = 'parse attempt run must be STARTED';
  end if;

  if version_status <> 'AVAILABLE' then
    raise exception using errcode = '23514', message = 'redacted source content cannot be parsed';
  end if;

  return new;
end;
$$;

create function app.protect_parse_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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
  then
    raise exception using errcode = '55000', message = 'source parse attempt identity is immutable';
  end if;

  return new;
end;
$$;

revoke execute on function app.validate_parse_attempt_execution() from public;
revoke execute on function app.protect_parse_attempt() from public;

create trigger source_record_parse_attempts_protect
before update or delete on app.source_record_parse_attempts
for each row execute function app.protect_parse_attempt();
create trigger source_record_parse_attempts_validate_execution
before insert or update on app.source_record_parse_attempts
for each row execute function app.validate_parse_attempt_execution();

alter table app.source_records
  add constraint source_records_current_version_fk
    foreign key (current_version_id)
    references app.source_record_versions (id)
    on delete restrict
    deferrable initially deferred,
  add constraint source_records_current_parse_attempt_fk
    foreign key (current_parse_attempt_id)
    references app.source_record_parse_attempts (id)
    on delete restrict
    deferrable initially deferred;

create function app.validate_source_current_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  selected_version app.source_record_versions%rowtype;
  selected_attempt app.source_record_parse_attempts%rowtype;
begin
  if new.current_version_id is null then
    return new;
  end if;

  select version.*
  into selected_version
  from app.source_record_versions as version
  where version.id = new.current_version_id;

  select attempt.*
  into selected_attempt
  from app.source_record_parse_attempts as attempt
  where attempt.id = new.current_parse_attempt_id;

  if selected_version.id is null
    or selected_version.source_record_id <> new.id
    or selected_version.content_status <> 'AVAILABLE'
    or selected_attempt.id is null
    or selected_attempt.source_record_version_id <> selected_version.id
    or selected_attempt.status <> 'SUCCEEDED'
    or selected_attempt.normalized_output_hash is null
  then
    raise exception using
      errcode = '23514',
      message = 'source current evidence must select an available owned version and successful owned parse attempt';
  end if;

  return new;
end;
$$;

revoke execute on function app.validate_source_current_evidence() from public;

create constraint trigger source_records_validate_current_evidence
after insert or update of current_version_id, current_parse_attempt_id
on app.source_records
deferrable initially deferred
for each row execute function app.validate_source_current_evidence();

alter table app.geographic_scopes enable row level security;
alter table app.geographic_scope_boundaries enable row level security;
alter table app.sources enable row level security;
alter table app.ingestion_runs enable row level security;
alter table app.source_records enable row level security;
alter table app.source_record_versions enable row level security;
alter table app.source_record_parse_attempts enable row level security;

grant usage on schema app to lemon_reference_admin, lemon_ingestion;

grant select, insert, update on
  app.geographic_scopes,
  app.geographic_scope_boundaries,
  app.sources
to lemon_reference_admin;

grant select on
  app.geographic_scopes,
  app.geographic_scope_boundaries,
  app.sources
to lemon_ingestion;

grant select, insert, update on
  app.ingestion_runs,
  app.source_records,
  app.source_record_parse_attempts
to lemon_ingestion;

grant select, insert on app.source_record_versions to lemon_ingestion;

create policy geographic_scopes_reference_admin
on app.geographic_scopes
for all to lemon_reference_admin
using (true) with check (true);
create policy geographic_scope_boundaries_reference_admin
on app.geographic_scope_boundaries
for all to lemon_reference_admin
using (true) with check (true);
create policy sources_reference_admin
on app.sources
for all to lemon_reference_admin
using (true) with check (true);

create policy geographic_scopes_ingestion_read
on app.geographic_scopes
for select to lemon_ingestion
using (true);
create policy geographic_scope_boundaries_ingestion_read
on app.geographic_scope_boundaries
for select to lemon_ingestion
using (true);
create policy sources_ingestion_read
on app.sources
for select to lemon_ingestion
using (true);
create policy ingestion_runs_ingestion
on app.ingestion_runs
for all to lemon_ingestion
using (true) with check (true);
create policy source_records_ingestion
on app.source_records
for all to lemon_ingestion
using (true) with check (true);
create policy source_record_versions_ingestion
on app.source_record_versions
for all to lemon_ingestion
using (true) with check (true);
create policy source_record_parse_attempts_ingestion
on app.source_record_parse_attempts
for all to lemon_ingestion
using (true) with check (true);

revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all sequences in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema app from public, anon, authenticated, service_role;

alter default privileges in schema app
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges in schema app
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges in schema app
  revoke all on functions from public, anon, authenticated, service_role;
