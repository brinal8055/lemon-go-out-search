create table app.canonical_entities (
  id uuid primary key default gen_random_uuid(),
  entity_type app.entity_type not null,
  canonical_name text not null,
  canonical_name_norm text not null,
  canonical_name_ascii text not null,
  publication_status app.publication_status not null default 'DRAFT',
  scope_id uuid null references app.geographic_scopes (id) on delete restrict,
  scope_boundary_id uuid null,
  chain_key text null,
  chain_key_method text null check (chain_key_method in ('SOURCE_STABLE_ID', 'MANUAL')),
  merged_into_id uuid null references app.canonical_entities (id) on delete restrict,
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (scope_boundary_id, scope_id)
    references app.geographic_scope_boundaries (id, scope_id)
    on delete restrict,
  check (
    (chain_key is null and chain_key_method is null)
    or (chain_key is not null and chain_key_method is not null)
  ),
  check (merged_into_id is null or merged_into_id <> id),
  check (
    (publication_status = 'MERGED' and merged_into_id is not null)
    or (publication_status <> 'MERGED' and merged_into_id is null)
  ),
  check (
    publication_status <> 'PUBLISHED'
    or (scope_id is not null and scope_boundary_id is not null and published_at is not null)
  )
);

create index canonical_entities_published_name_norm_idx
  on app.canonical_entities (scope_id, canonical_name_norm text_pattern_ops)
  where publication_status = 'PUBLISHED' and merged_into_id is null;
create index canonical_entities_published_name_ascii_idx
  on app.canonical_entities (scope_id, canonical_name_ascii text_pattern_ops)
  where publication_status = 'PUBLISHED' and merged_into_id is null;
create index canonical_entities_scope_type_status_idx
  on app.canonical_entities (scope_id, entity_type, publication_status);
create index canonical_entities_scope_boundary_idx
  on app.canonical_entities (scope_boundary_id, scope_id);
create index canonical_entities_merged_into_idx
  on app.canonical_entities (merged_into_id);
create index canonical_entities_chain_key_idx
  on app.canonical_entities (chain_key)
  where chain_key is not null;

alter table app.source_records
  add constraint source_records_canonical_entity_fk
  foreign key (canonical_entity_id)
  references app.canonical_entities (id)
  on delete restrict;

create table app.places (
  entity_id uuid primary key
    references app.canonical_entities (id) on delete restrict,
  location extensions.geography(Point, 4326) null,
  street_address text null,
  postal_code text null,
  locality text null,
  country_code char(2) not null default 'SE'
    check (country_code ~ '^[A-Z]{2}$'),
  official_url text null,
  phone text null,
  status app.place_status not null default 'UNKNOWN',
  opening_hours jsonb null check (
    opening_hours is null or jsonb_typeof(opening_hours) = 'object'
  ),
  opening_hours_verified boolean not null default false,
  last_authoritative_observed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_location_idx on app.places using gist (location);
create index places_status_idx on app.places (status);

create table app.events (
  entity_id uuid primary key
    references app.canonical_entities (id) on delete restrict,
  venue_place_id uuid null references app.places (entity_id) on delete restrict,
  standalone_venue_name text null,
  location extensions.geography(Point, 4326) null,
  standalone_street_address text null,
  standalone_postal_code text null,
  standalone_locality text null,
  standalone_country_code char(2) null
    check (standalone_country_code is null or standalone_country_code ~ '^[A-Z]{2}$'),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  source_timezone text not null,
  status app.event_status not null default 'UNKNOWN',
  status_observed_at timestamptz not null,
  event_start_source_record_id uuid not null
    references app.source_records (id) on delete restrict,
  event_end_source_record_id uuid null
    references app.source_records (id) on delete restrict,
  event_status_source_record_id uuid not null
    references app.source_records (id) on delete restrict,
  information_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (ends_at is null or event_end_source_record_id is not null),
  check (
    venue_place_id is not null
    or (standalone_venue_name is not null and btrim(standalone_venue_name) <> '' and location is not null)
  )
);

create index events_scheduled_interval_idx
  on app.events (starts_at, (coalesce(ends_at, starts_at)), status)
  where status = 'SCHEDULED';
create index events_venue_place_idx on app.events (venue_place_id);
create index events_start_source_record_idx on app.events (event_start_source_record_id);
create index events_end_source_record_idx on app.events (event_end_source_record_id);
create index events_status_source_record_idx on app.events (event_status_source_record_id);
create index events_location_idx on app.events using gist (location);

create function app.protect_canonical_entity_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.entity_type is distinct from old.entity_type then
    raise exception using errcode = '55000', message = 'canonical entity type is immutable';
  end if;
  return new;
end;
$$;

create function app.validate_canonical_entity_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_entity_id uuid;
  entity app.canonical_entities%rowtype;
  place_row app.places%rowtype;
  event_row app.events%rowtype;
  place_count integer;
  event_count integer;
  target_type app.entity_type;
  target_status app.publication_status;
  eligible_point extensions.geography(Point, 4326);
  boundary extensions.geometry(MultiPolygon, 4326);
  boundary_active boolean;
begin
  if tg_table_name = 'canonical_entities' then
    target_entity_id := coalesce(new.id, old.id);
  else
    target_entity_id := coalesce(new.entity_id, old.entity_id);
  end if;

  select canonical.*
  into entity
  from app.canonical_entities as canonical
  where canonical.id = target_entity_id;

  if entity.id is null then
    return null;
  end if;

  select count(*) into place_count from app.places where entity_id = entity.id;
  select count(*) into event_count from app.events where entity_id = entity.id;

  if place_count + event_count <> 1
    or (entity.entity_type = 'PLACE' and place_count <> 1)
    or (entity.entity_type = 'EVENT' and event_count <> 1)
  then
    raise exception using
      errcode = '23514',
      message = 'canonical entity must have exactly one matching subtype';
  end if;

  if entity.publication_status = 'MERGED' then
    select target.entity_type, target.publication_status
    into target_type, target_status
    from app.canonical_entities as target
    where target.id = entity.merged_into_id;

    if target_type is null
      or target_type <> entity.entity_type
      or target_status = 'MERGED'
      or exists (
        with recursive merge_chain as (
          select target.id, target.merged_into_id, array[target.id] as visited
          from app.canonical_entities as target
          where target.id = entity.merged_into_id
          union all
          select next_target.id,
                 next_target.merged_into_id,
                 chain.visited || next_target.id
          from merge_chain as chain
          join app.canonical_entities as next_target on next_target.id = chain.merged_into_id
          where not next_target.id = any(chain.visited)
        )
        select 1 from merge_chain where id = entity.id
      )
    then
      raise exception using
        errcode = '23514',
        message = 'merged canonical entity must target a compatible non-merged survivor without a cycle';
    end if;
  end if;

  if entity.publication_status = 'MERGED'
    and exists (
      select 1
      from app.canonical_entities as merged_entity
      where merged_entity.merged_into_id = entity.id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'merged canonical entity cannot remain the survivor of another merge';
  end if;

  if entity.publication_status = 'PUBLISHED' then
    select scope_boundary.boundary, scope_boundary.is_active
    into boundary, boundary_active
    from app.geographic_scope_boundaries as scope_boundary
    where scope_boundary.id = entity.scope_boundary_id
      and scope_boundary.scope_id = entity.scope_id;

    if entity.entity_type = 'PLACE' then
      select place.* into place_row from app.places as place where place.entity_id = entity.id;
      eligible_point := place_row.location;
      if place_row.status = 'CLOSED' then
        raise exception using errcode = '23514', message = 'published Place must be eligible';
      end if;
    else
      select event.* into event_row from app.events as event where event.entity_id = entity.id;
      if event_row.status <> 'SCHEDULED' then
        raise exception using errcode = '23514', message = 'published Event must be scheduled';
      end if;
      if event_row.venue_place_id is not null then
        select place.location
        into eligible_point
        from app.places as place
        where place.entity_id = event_row.venue_place_id;
      else
        eligible_point := event_row.location;
      end if;
    end if;

    if boundary is null
      or boundary_active is distinct from true
      or eligible_point is null
      or not extensions.st_covers(boundary, eligible_point::extensions.geometry)
    then
      raise exception using
        errcode = '23514',
        message = 'published canonical entity requires an active assigned boundary and covered location';
    end if;
  end if;

  return null;
end;
$$;

create function app.assert_event_structure(target_event_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  event_row app.events%rowtype;
  event_scope_id uuid;
  venue_scope_id uuid;
  venue_type app.entity_type;
  venue_location extensions.geography(Point, 4326);
  event_record_id uuid;
  record_entity_id uuid;
begin
  select event.* into event_row
  from app.events as event
  where event.entity_id = target_event_id;

  if event_row.entity_id is null then
    return;
  end if;

  select canonical.scope_id
  into event_scope_id
  from app.canonical_entities as canonical
  where canonical.id = event_row.entity_id;

  if event_row.venue_place_id is not null then
    select canonical.entity_type, canonical.scope_id, place.location
    into venue_type, venue_scope_id, venue_location
    from app.places as place
    join app.canonical_entities as canonical on canonical.id = place.entity_id
    where place.entity_id = event_row.venue_place_id;

    if venue_type is distinct from 'PLACE'
      or venue_scope_id is distinct from event_scope_id
      or venue_location is null
    then
      raise exception using
        errcode = '23514',
        message = 'Event venue must be a located Place in the same scope';
    end if;
  elsif event_row.location is null
    or event_row.standalone_venue_name is null
    or btrim(event_row.standalone_venue_name) = ''
  then
    raise exception using
      errcode = '23514',
      message = 'standalone Event requires a venue name and point';
  end if;

  foreach event_record_id in array array[
    event_row.event_start_source_record_id,
    event_row.event_end_source_record_id,
    event_row.event_status_source_record_id
  ]
  loop
    if event_record_id is not null then
      select record.canonical_entity_id
      into record_entity_id
      from app.source_records as record
      where record.id = event_record_id;

      if record_entity_id is distinct from event_row.entity_id then
        raise exception using
          errcode = '23514',
          message = 'Event evidence records must resolve to the Event canonical entity';
      end if;
    end if;
  end loop;

  return;
end;
$$;

create function app.validate_event_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_event_id uuid;
begin
  if tg_table_name = 'events' then
    perform app.assert_event_structure(new.entity_id);
  elsif tg_table_name = 'places' then
    for target_event_id in
      select event.entity_id
      from app.events as event
      where event.venue_place_id = new.entity_id
    loop
      perform app.assert_event_structure(target_event_id);
    end loop;
  elsif tg_table_name = 'canonical_entities' then
    perform app.assert_event_structure(new.id);
    for target_event_id in
      select event.entity_id
      from app.events as event
      where event.venue_place_id = new.id
    loop
      perform app.assert_event_structure(target_event_id);
    end loop;
  elsif tg_table_name = 'source_records' then
    for target_event_id in
      select event.entity_id
      from app.events as event
      where event.event_start_source_record_id = new.id
        or event.event_end_source_record_id = new.id
        or event.event_status_source_record_id = new.id
    loop
      perform app.assert_event_structure(target_event_id);
    end loop;
  end if;

  return null;
end;
$$;

create function app.validate_boundary_assignments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active is distinct from true
    and exists (
      select 1
      from app.canonical_entities as canonical
      where canonical.scope_boundary_id = new.id
        and canonical.publication_status = 'PUBLISHED'
    )
  then
    raise exception using
      errcode = '23514',
      message = 'inactive boundary cannot remain assigned to a published canonical entity';
  end if;

  return null;
end;
$$;

revoke execute on function app.protect_canonical_entity_type() from public;
revoke execute on function app.validate_canonical_entity_structure() from public;
revoke execute on function app.assert_event_structure(uuid) from public;
revoke execute on function app.validate_event_structure() from public;
revoke execute on function app.validate_boundary_assignments() from public;

create trigger canonical_entities_set_updated_at
before update on app.canonical_entities
for each row execute function app.set_updated_at();
create trigger canonical_entities_protect_type
before update on app.canonical_entities
for each row execute function app.protect_canonical_entity_type();
create trigger canonical_entities_reject_delete
before delete on app.canonical_entities
for each row execute function app.reject_delete();

create trigger places_set_updated_at
before update on app.places
for each row execute function app.set_updated_at();
create trigger places_reject_delete
before delete on app.places
for each row execute function app.reject_delete();

create trigger events_set_updated_at
before update on app.events
for each row execute function app.set_updated_at();
create trigger events_reject_delete
before delete on app.events
for each row execute function app.reject_delete();

create constraint trigger canonical_entities_validate_structure
after insert or update on app.canonical_entities
deferrable initially deferred
for each row execute function app.validate_canonical_entity_structure();
create constraint trigger places_validate_entity_structure
after insert or update on app.places
deferrable initially deferred
for each row execute function app.validate_canonical_entity_structure();
create constraint trigger events_validate_entity_structure
after insert or update on app.events
deferrable initially deferred
for each row execute function app.validate_canonical_entity_structure();
create constraint trigger events_validate_structure
after insert or update on app.events
deferrable initially deferred
for each row execute function app.validate_event_structure();
create constraint trigger places_validate_linked_events
after insert or update on app.places
deferrable initially deferred
for each row execute function app.validate_event_structure();
create constraint trigger canonical_entities_validate_events
after insert or update on app.canonical_entities
deferrable initially deferred
for each row execute function app.validate_event_structure();
create constraint trigger source_records_validate_event_evidence
after update of canonical_entity_id on app.source_records
deferrable initially deferred
for each row execute function app.validate_event_structure();
create constraint trigger geographic_scope_boundaries_validate_assignments
after update of is_active on app.geographic_scope_boundaries
deferrable initially deferred
for each row execute function app.validate_boundary_assignments();

create table app.canonical_fact_provenance (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references app.canonical_entities (id) on delete restrict,
  fact_key app.fact_key not null,
  source_record_version_id uuid not null
    references app.source_record_versions (id) on delete restrict,
  selection_method text not null check (selection_method in ('SOURCE_PRECEDENCE', 'MANUAL')),
  selected_at timestamptz not null default now(),
  is_current boolean not null default true,
  superseded_at timestamptz null,
  note text null,
  created_by text not null,
  check (
    (is_current and superseded_at is null)
    or (not is_current and superseded_at is not null)
  )
);

create unique index canonical_fact_provenance_one_current_idx
  on app.canonical_fact_provenance (entity_id, fact_key)
  where is_current;
create index canonical_fact_provenance_history_idx
  on app.canonical_fact_provenance (entity_id, fact_key, selected_at desc);
create index canonical_fact_provenance_source_version_idx
  on app.canonical_fact_provenance (source_record_version_id);

create function app.protect_canonical_fact_provenance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'canonical fact provenance cannot be deleted';
  end if;

  if not old.is_current
    or new.id is distinct from old.id
    or new.entity_id is distinct from old.entity_id
    or new.fact_key is distinct from old.fact_key
    or new.source_record_version_id is distinct from old.source_record_version_id
    or new.selection_method is distinct from old.selection_method
    or new.selected_at is distinct from old.selected_at
    or new.note is distinct from old.note
    or new.created_by is distinct from old.created_by
    or new.is_current
    or new.superseded_at is null
  then
    raise exception using
      errcode = '55000',
      message = 'canonical fact provenance history is immutable';
  end if;

  return new;
end;
$$;

create function app.validate_canonical_fact_provenance_current()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count integer;
begin
  select count(*) filter (where provenance.is_current)
  into current_count
  from app.canonical_fact_provenance as provenance
  where provenance.entity_id = new.entity_id
    and provenance.fact_key = new.fact_key;

  if current_count <> 1 then
    raise exception using
      errcode = '23514',
      message = 'canonical fact provenance history must retain exactly one current selection';
  end if;

  return null;
end;
$$;

revoke execute on function app.protect_canonical_fact_provenance() from public;
revoke execute on function app.validate_canonical_fact_provenance_current() from public;

create trigger canonical_fact_provenance_protect
before update or delete on app.canonical_fact_provenance
for each row execute function app.protect_canonical_fact_provenance();
create constraint trigger canonical_fact_provenance_validate_current
after insert or update on app.canonical_fact_provenance
deferrable initially deferred
for each row execute function app.validate_canonical_fact_provenance_current();

create table app.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references app.canonical_entities (id) on delete restrict,
  alias text not null,
  alias_norm text not null,
  alias_ascii text not null,
  language text not null check (language in ('en', 'sv', 'und')),
  kind app.alias_kind not null,
  source_record_version_id uuid null
    references app.source_record_versions (id) on delete restrict,
  verified boolean not null default false,
  verified_by text null,
  verified_at timestamptz null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_id, alias_norm, kind),
  check (
    (verified and verified_by is not null and verified_at is not null)
    or (not verified and verified_by is null and verified_at is null)
  ),
  check (
    (kind = 'MANUAL' and source_record_version_id is null and verified)
    or (kind <> 'MANUAL' and source_record_version_id is not null)
  )
);

create index entity_aliases_active_norm_idx
  on app.entity_aliases (alias_norm text_pattern_ops)
  where active;
create index entity_aliases_active_ascii_idx
  on app.entity_aliases (alias_ascii text_pattern_ops)
  where active;
create index entity_aliases_active_norm_trgm_idx
  on app.entity_aliases using gin (alias_norm extensions.gin_trgm_ops)
  where active;
create index entity_aliases_active_ascii_trgm_idx
  on app.entity_aliases using gin (alias_ascii extensions.gin_trgm_ops)
  where active;
create index entity_aliases_entity_active_idx on app.entity_aliases (entity_id, active);
create index entity_aliases_source_version_idx
  on app.entity_aliases (source_record_version_id);

create trigger entity_aliases_set_updated_at
before update on app.entity_aliases
for each row execute function app.set_updated_at();
create trigger entity_aliases_reject_delete
before delete on app.entity_aliases
for each row execute function app.reject_delete();

create table app.duplicate_candidates (
  id uuid primary key default gen_random_uuid(),
  record_a_id uuid not null references app.source_records (id) on delete restrict,
  record_b_id uuid not null references app.source_records (id) on delete restrict,
  entity_a_id uuid null references app.canonical_entities (id) on delete restrict,
  entity_b_id uuid null references app.canonical_entities (id) on delete restrict,
  evidence_summary jsonb not null check (
    jsonb_typeof(evidence_summary) = 'object'
    and octet_length(evidence_summary::text) <= 16384
  ),
  evidence_hash char(64) not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  status app.duplicate_decision not null,
  current_decision_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (record_a_id < record_b_id),
  unique (record_a_id, record_b_id)
);

create index duplicate_candidates_open_created_idx
  on app.duplicate_candidates (created_at)
  where status = 'OPEN';
create index duplicate_candidates_record_a_idx on app.duplicate_candidates (record_a_id);
create index duplicate_candidates_record_b_idx on app.duplicate_candidates (record_b_id);
create index duplicate_candidates_entity_a_idx on app.duplicate_candidates (entity_a_id);
create index duplicate_candidates_entity_b_idx on app.duplicate_candidates (entity_b_id);
create index duplicate_candidates_current_decision_idx
  on app.duplicate_candidates (current_decision_id);

create table app.duplicate_candidate_decisions (
  id uuid primary key default gen_random_uuid(),
  duplicate_candidate_id uuid not null
    references app.duplicate_candidates (id) on delete restrict,
  decision app.duplicate_decision not null,
  operation_type text not null check (
    operation_type in ('OPEN_REVIEW', 'LINK_RECORD', 'MERGE_ENTITIES', 'NO_MERGE', 'UNSURE')
  ),
  reviewer text not null,
  decided_at timestamptz not null default now(),
  evidence_version_ids uuid[] not null,
  evidence_parse_attempt_ids uuid[] not null,
  evidence_hash char(64) not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  supersedes_decision_id uuid null
    references app.duplicate_candidate_decisions (id) on delete restrict,
  target_entity_id uuid null references app.canonical_entities (id) on delete restrict,
  survivor_entity_id uuid null references app.canonical_entities (id) on delete restrict,
  loser_entity_id uuid null references app.canonical_entities (id) on delete restrict,
  resolution_detail jsonb null check (
    resolution_detail is null
    or (
      jsonb_typeof(resolution_detail) = 'object'
      and octet_length(resolution_detail::text) <= 16384
    )
  ),
  note text null,
  unique (supersedes_decision_id),
  check (supersedes_decision_id is null or supersedes_decision_id <> id),
  check (
    cardinality(evidence_version_ids) = 2
    and cardinality(evidence_parse_attempt_ids) = 2
    and cardinality(evidence_version_ids) = cardinality(evidence_parse_attempt_ids)
    and array_position(evidence_version_ids, null) is null
    and array_position(evidence_parse_attempt_ids, null) is null
  ),
  check (
    (
      decision = 'OPEN'
      and operation_type = 'OPEN_REVIEW'
      and target_entity_id is null
      and survivor_entity_id is null
      and loser_entity_id is null
    )
    or (
      decision = 'SAME'
      and operation_type = 'LINK_RECORD'
      and target_entity_id is not null
      and survivor_entity_id is null
      and loser_entity_id is null
    )
    or (
      decision = 'SAME'
      and operation_type = 'MERGE_ENTITIES'
      and target_entity_id is null
      and survivor_entity_id is not null
      and loser_entity_id is not null
      and survivor_entity_id <> loser_entity_id
    )
    or (
      decision = 'SEPARATE'
      and operation_type = 'NO_MERGE'
      and target_entity_id is null
      and survivor_entity_id is null
      and loser_entity_id is null
    )
    or (
      decision = 'UNSURE'
      and operation_type = 'UNSURE'
      and target_entity_id is null
      and survivor_entity_id is null
      and loser_entity_id is null
    )
  )
);

alter table app.duplicate_candidates
  add constraint duplicate_candidates_current_decision_fk
  foreign key (current_decision_id)
  references app.duplicate_candidate_decisions (id)
  on delete restrict
  deferrable initially deferred;

create unique index duplicate_candidate_decisions_one_root_idx
  on app.duplicate_candidate_decisions (duplicate_candidate_id)
  where supersedes_decision_id is null;
create index duplicate_candidate_decisions_candidate_decided_idx
  on app.duplicate_candidate_decisions (duplicate_candidate_id, decided_at desc);
create index duplicate_candidate_decisions_target_idx
  on app.duplicate_candidate_decisions (target_entity_id);
create index duplicate_candidate_decisions_survivor_idx
  on app.duplicate_candidate_decisions (survivor_entity_id);
create index duplicate_candidate_decisions_loser_idx
  on app.duplicate_candidate_decisions (loser_entity_id);

create function app.protect_duplicate_candidate_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'duplicate candidate decisions are append-only';
end;
$$;

create function app.validate_duplicate_decision_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate app.duplicate_candidates%rowtype;
  positioned_record_id uuid;
  version_record_id uuid;
  attempt_version_id uuid;
  attempt_status app.source_parse_attempt_status;
  position integer;
  prior_candidate_id uuid;
begin
  select item.* into candidate
  from app.duplicate_candidates as item
  where item.id = new.duplicate_candidate_id;

  if candidate.id is null then
    raise exception using errcode = '23503', message = 'duplicate candidate does not exist';
  end if;

  for position in 1..2 loop
    positioned_record_id := case position when 1 then candidate.record_a_id else candidate.record_b_id end;

    select version.source_record_id
    into version_record_id
    from app.source_record_versions as version
    where version.id = new.evidence_version_ids[position];

    select attempt.source_record_version_id, attempt.status
    into attempt_version_id, attempt_status
    from app.source_record_parse_attempts as attempt
    where attempt.id = new.evidence_parse_attempt_ids[position];

    if version_record_id is distinct from positioned_record_id
      or attempt_version_id is distinct from new.evidence_version_ids[position]
      or attempt_status is distinct from 'SUCCEEDED'
    then
      raise exception using
        errcode = '23514',
        message = 'duplicate decision evidence must positionally match successful record evidence';
    end if;
  end loop;

  if new.supersedes_decision_id is not null then
    select prior.duplicate_candidate_id
    into prior_candidate_id
    from app.duplicate_candidate_decisions as prior
    where prior.id = new.supersedes_decision_id;

    if prior_candidate_id is distinct from new.duplicate_candidate_id then
      raise exception using
        errcode = '23514',
        message = 'superseded decision must belong to the same duplicate candidate';
    end if;
  elsif new.decision <> 'OPEN' then
    raise exception using
      errcode = '23514',
      message = 'initial duplicate candidate decision must be OPEN';
  end if;

  return null;
end;
$$;

create function app.validate_duplicate_candidate_chain()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  candidate_id uuid;
  candidate app.duplicate_candidates%rowtype;
  current_decision app.duplicate_candidate_decisions%rowtype;
  decision_count integer;
  chain_count integer;
begin
  if tg_table_name = 'duplicate_candidates' then
    candidate_id := new.id;
  else
    candidate_id := new.duplicate_candidate_id;
  end if;

  select item.* into candidate
  from app.duplicate_candidates as item
  where item.id = candidate_id;

  if candidate.id is null then
    return null;
  end if;

  select decision_row.* into current_decision
  from app.duplicate_candidate_decisions as decision_row
  where decision_row.id = candidate.current_decision_id
    and decision_row.duplicate_candidate_id = candidate.id;

  if current_decision.id is null
    or current_decision.decision <> candidate.status
    or current_decision.evidence_hash <> candidate.evidence_hash
    or exists (
      select 1
      from app.duplicate_candidate_decisions as later
      where later.supersedes_decision_id = current_decision.id
    )
  then
    raise exception using
      errcode = '23514',
      message = 'duplicate candidate current pointer must reference its matching terminal decision';
  end if;

  select count(*) into decision_count
  from app.duplicate_candidate_decisions as decision_row
  where decision_row.duplicate_candidate_id = candidate.id;

  with recursive decision_chain as (
    select decision_row.id
    from app.duplicate_candidate_decisions as decision_row
    where decision_row.duplicate_candidate_id = candidate.id
      and decision_row.supersedes_decision_id is null
    union all
    select next_decision.id
    from decision_chain as chain
    join app.duplicate_candidate_decisions as next_decision
      on next_decision.supersedes_decision_id = chain.id
    where next_decision.duplicate_candidate_id = candidate.id
  )
  select count(*) into chain_count from decision_chain;

  if decision_count = 0 or chain_count <> decision_count then
    raise exception using
      errcode = '23514',
      message = 'duplicate candidate decisions must form one linear supersession chain';
  end if;

  return null;
end;
$$;

revoke execute on function app.protect_duplicate_candidate_decision() from public;
revoke execute on function app.validate_duplicate_decision_evidence() from public;
revoke execute on function app.validate_duplicate_candidate_chain() from public;

create trigger duplicate_candidates_set_updated_at
before update on app.duplicate_candidates
for each row execute function app.set_updated_at();
create trigger duplicate_candidates_reject_delete
before delete on app.duplicate_candidates
for each row execute function app.reject_delete();
create trigger duplicate_candidate_decisions_protect
before update or delete on app.duplicate_candidate_decisions
for each row execute function app.protect_duplicate_candidate_decision();

create constraint trigger duplicate_candidate_decisions_validate_evidence
after insert on app.duplicate_candidate_decisions
deferrable initially deferred
for each row execute function app.validate_duplicate_decision_evidence();
create constraint trigger duplicate_candidates_validate_current
after insert or update of current_decision_id, status, evidence_hash on app.duplicate_candidates
deferrable initially deferred
for each row execute function app.validate_duplicate_candidate_chain();
create constraint trigger duplicate_candidate_decisions_validate_chain
after insert on app.duplicate_candidate_decisions
deferrable initially deferred
for each row execute function app.validate_duplicate_candidate_chain();

create table app.taxonomy_nodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  parent_id uuid null references app.taxonomy_nodes (id) on delete restrict,
  taxonomy_version text not null,
  taxonomy_checksum char(64) not null check (taxonomy_checksum ~ '^[0-9a-f]{64}$'),
  label_en text not null,
  label_sv text not null,
  depth smallint not null check (depth >= 0),
  path uuid[] not null,
  is_leaf boolean not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxonomy_version, slug),
  check (cardinality(path) = depth + 1),
  check (array_position(path, null) is null)
);

create index taxonomy_nodes_version_parent_active_idx
  on app.taxonomy_nodes (taxonomy_version, parent_id, active);
create index taxonomy_nodes_parent_idx on app.taxonomy_nodes (parent_id);
create index taxonomy_nodes_path_idx on app.taxonomy_nodes using gin (path);
create index taxonomy_nodes_active_leaf_idx on app.taxonomy_nodes (active, is_leaf);

create function app.validate_taxonomy_node_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent app.taxonomy_nodes%rowtype;
begin
  if new.parent_id is null then
    if new.depth <> 0 or new.path <> array[new.id] then
      raise exception using
        errcode = '23514',
        message = 'taxonomy root path and depth are inconsistent';
    end if;
    return new;
  end if;

  select node.* into parent
  from app.taxonomy_nodes as node
  where node.id = new.parent_id;

  if parent.id is null
    or parent.taxonomy_version <> new.taxonomy_version
    or parent.taxonomy_checksum <> new.taxonomy_checksum
    or new.id = any(parent.path)
    or new.depth <> parent.depth + 1
    or new.path <> parent.path || new.id
  then
    raise exception using
      errcode = '23514',
      message = 'taxonomy node must have acyclic same-version exact parent path and depth';
  end if;

  return new;
end;
$$;

create function app.protect_taxonomy_node()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'taxonomy nodes cannot be deleted';
  end if;

  if new.id is distinct from old.id
    or new.slug is distinct from old.slug
    or new.parent_id is distinct from old.parent_id
    or new.taxonomy_version is distinct from old.taxonomy_version
    or new.taxonomy_checksum is distinct from old.taxonomy_checksum
    or new.label_en is distinct from old.label_en
    or new.label_sv is distinct from old.label_sv
    or new.depth is distinct from old.depth
    or new.path is distinct from old.path
    or new.is_leaf is distinct from old.is_leaf
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '55000',
      message = 'taxonomy node identity and hierarchy are immutable within a version';
  end if;

  return new;
end;
$$;

revoke execute on function app.validate_taxonomy_node_structure() from public;
revoke execute on function app.protect_taxonomy_node() from public;

create trigger taxonomy_nodes_00_validate_structure
before insert or update on app.taxonomy_nodes
for each row execute function app.validate_taxonomy_node_structure();
create trigger taxonomy_nodes_set_updated_at
before update on app.taxonomy_nodes
for each row execute function app.set_updated_at();
create trigger taxonomy_nodes_protect
before update or delete on app.taxonomy_nodes
for each row execute function app.protect_taxonomy_node();

create table app.taxonomy_aliases (
  id uuid primary key default gen_random_uuid(),
  taxonomy_node_id uuid not null references app.taxonomy_nodes (id) on delete restrict,
  language text not null check (language in ('en', 'sv', 'und')),
  alias text not null,
  alias_norm text not null,
  alias_ascii text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (taxonomy_node_id, language, alias_norm)
);

create index taxonomy_aliases_active_norm_idx
  on app.taxonomy_aliases (language, alias_norm text_pattern_ops)
  where active;
create index taxonomy_aliases_active_ascii_idx
  on app.taxonomy_aliases (language, alias_ascii text_pattern_ops)
  where active;

create trigger taxonomy_aliases_set_updated_at
before update on app.taxonomy_aliases
for each row execute function app.set_updated_at();
create trigger taxonomy_aliases_reject_delete
before delete on app.taxonomy_aliases
for each row execute function app.reject_delete();

create table app.entity_taxonomy_memberships (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references app.canonical_entities (id) on delete restrict,
  taxonomy_node_id uuid not null references app.taxonomy_nodes (id) on delete restrict,
  method app.taxonomy_membership_method not null,
  source_record_version_id uuid null
    references app.source_record_versions (id) on delete restrict,
  mapping_ref text null,
  manual_evidence text null,
  reviewed_by text null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (
      method = 'SOURCE_FACT'
      and source_record_version_id is not null
      and mapping_ref is null
      and manual_evidence is null
      and reviewed_by is null
    )
    or (
      method = 'DETERMINISTIC_MAP'
      and source_record_version_id is not null
      and mapping_ref is not null
      and manual_evidence is null
      and reviewed_by is null
    )
    or (
      method = 'MANUAL'
      and source_record_version_id is null
      and mapping_ref is null
      and manual_evidence is not null
      and reviewed_by is not null
    )
  )
);

create unique index entity_taxonomy_memberships_one_active_idx
  on app.entity_taxonomy_memberships (entity_id, taxonomy_node_id)
  where active;
create index entity_taxonomy_memberships_entity_active_idx
  on app.entity_taxonomy_memberships (entity_id, active);
create index entity_taxonomy_memberships_node_active_idx
  on app.entity_taxonomy_memberships (taxonomy_node_id, active);
create index entity_taxonomy_memberships_source_version_idx
  on app.entity_taxonomy_memberships (source_record_version_id);

create function app.protect_entity_taxonomy_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'taxonomy memberships cannot be deleted';
  end if;

  if new.id is distinct from old.id
    or new.entity_id is distinct from old.entity_id
    or new.taxonomy_node_id is distinct from old.taxonomy_node_id
    or new.method is distinct from old.method
    or new.source_record_version_id is distinct from old.source_record_version_id
    or new.mapping_ref is distinct from old.mapping_ref
    or new.manual_evidence is distinct from old.manual_evidence
    or new.reviewed_by is distinct from old.reviewed_by
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '55000',
      message = 'taxonomy membership evidence is immutable';
  end if;

  return new;
end;
$$;

revoke execute on function app.protect_entity_taxonomy_membership() from public;

create trigger entity_taxonomy_memberships_set_updated_at
before update on app.entity_taxonomy_memberships
for each row execute function app.set_updated_at();
create trigger entity_taxonomy_memberships_protect
before update or delete on app.entity_taxonomy_memberships
for each row execute function app.protect_entity_taxonomy_membership();

alter table app.canonical_entities enable row level security;
alter table app.places enable row level security;
alter table app.events enable row level security;
alter table app.canonical_fact_provenance enable row level security;
alter table app.entity_aliases enable row level security;
alter table app.duplicate_candidates enable row level security;
alter table app.duplicate_candidate_decisions enable row level security;
alter table app.taxonomy_nodes enable row level security;
alter table app.taxonomy_aliases enable row level security;
alter table app.entity_taxonomy_memberships enable row level security;

grant usage on schema app to lemon_reviewer;

grant select on app.taxonomy_nodes, app.taxonomy_aliases to lemon_ingestion, lemon_reviewer;
grant select, insert, update on app.taxonomy_nodes, app.taxonomy_aliases
to lemon_reference_admin;

grant select, insert, update on
  app.canonical_entities,
  app.places,
  app.events,
  app.canonical_fact_provenance,
  app.entity_aliases,
  app.duplicate_candidates,
  app.entity_taxonomy_memberships
to lemon_ingestion, lemon_reviewer;

grant select, insert on app.duplicate_candidate_decisions
to lemon_ingestion, lemon_reviewer;

grant select on
  app.geographic_scopes,
  app.geographic_scope_boundaries,
  app.source_records,
  app.source_record_versions,
  app.source_record_parse_attempts
to lemon_reviewer;

create policy taxonomy_nodes_reference_admin
on app.taxonomy_nodes
for all to lemon_reference_admin
using (true) with check (true);
create policy taxonomy_aliases_reference_admin
on app.taxonomy_aliases
for all to lemon_reference_admin
using (true) with check (true);

create policy taxonomy_nodes_ingestion_read
on app.taxonomy_nodes
for select to lemon_ingestion
using (true);
create policy taxonomy_aliases_ingestion_read
on app.taxonomy_aliases
for select to lemon_ingestion
using (true);
create policy taxonomy_nodes_reviewer_read
on app.taxonomy_nodes
for select to lemon_reviewer
using (true);
create policy taxonomy_aliases_reviewer_read
on app.taxonomy_aliases
for select to lemon_reviewer
using (true);

create policy canonical_entities_ingestion
on app.canonical_entities
for all to lemon_ingestion
using (true) with check (true);
create policy places_ingestion
on app.places
for all to lemon_ingestion
using (true) with check (true);
create policy events_ingestion
on app.events
for all to lemon_ingestion
using (true) with check (true);
create policy canonical_fact_provenance_ingestion
on app.canonical_fact_provenance
for all to lemon_ingestion
using (true) with check (true);
create policy entity_aliases_ingestion
on app.entity_aliases
for all to lemon_ingestion
using (true) with check (true);
create policy duplicate_candidates_ingestion
on app.duplicate_candidates
for all to lemon_ingestion
using (true) with check (true);
create policy duplicate_candidate_decisions_ingestion
on app.duplicate_candidate_decisions
for all to lemon_ingestion
using (true) with check (true);
create policy entity_taxonomy_memberships_ingestion
on app.entity_taxonomy_memberships
for all to lemon_ingestion
using (true) with check (true);

create policy canonical_entities_reviewer
on app.canonical_entities
for all to lemon_reviewer
using (true) with check (true);
create policy places_reviewer
on app.places
for all to lemon_reviewer
using (true) with check (true);
create policy events_reviewer
on app.events
for all to lemon_reviewer
using (true) with check (true);
create policy canonical_fact_provenance_reviewer
on app.canonical_fact_provenance
for all to lemon_reviewer
using (true) with check (true);
create policy entity_aliases_reviewer
on app.entity_aliases
for all to lemon_reviewer
using (true) with check (true);
create policy duplicate_candidates_reviewer
on app.duplicate_candidates
for all to lemon_reviewer
using (true) with check (true);
create policy duplicate_candidate_decisions_reviewer
on app.duplicate_candidate_decisions
for all to lemon_reviewer
using (true) with check (true);
create policy entity_taxonomy_memberships_reviewer
on app.entity_taxonomy_memberships
for all to lemon_reviewer
using (true) with check (true);

create policy geographic_scopes_reviewer_read
on app.geographic_scopes
for select to lemon_reviewer
using (true);
create policy geographic_scope_boundaries_reviewer_read
on app.geographic_scope_boundaries
for select to lemon_reviewer
using (true);
create policy source_records_reviewer_read
on app.source_records
for select to lemon_reviewer
using (true);
create policy source_record_versions_reviewer_read
on app.source_record_versions
for select to lemon_reviewer
using (true);
create policy source_record_parse_attempts_reviewer_read
on app.source_record_parse_attempts
for select to lemon_reviewer
using (true);

revoke all on all tables in schema app from public, anon, authenticated, service_role;
revoke all on all sequences in schema app from public, anon, authenticated, service_role;
revoke all on all functions in schema app from public, anon, authenticated, service_role;
