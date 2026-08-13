create table app.search_documents (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references app.canonical_entities (id) on delete restrict,
  document_version text not null,
  template_version text not null,
  content_hash char(64) not null check (content_hash ~ '^[0-9a-f]{64}$'),
  display_name text not null,
  names_text text not null,
  aliases_text text not null,
  taxonomy_en_text text not null,
  taxonomy_sv_text text not null,
  facts_text text not null,
  description_text text not null,
  event_context_text text not null default '',
  embedding_text text not null,
  fts tsvector not null,
  generated_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (entity_id, template_version, content_hash)
);

create unique index search_documents_one_active_entity_idx
  on app.search_documents (entity_id)
  where is_active;
create index search_documents_active_fts_idx
  on app.search_documents using gin (fts)
  where is_active;
create index search_documents_entity_content_hash_idx
  on app.search_documents (entity_id, content_hash);

create table app.search_configs (
  version text primary key,
  config_checksum char(64) not null unique check (config_checksum ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default false,
  prefix_min_length smallint not null check (prefix_min_length > 0),
  trigram_min_length smallint not null check (trigram_min_length > 0),
  trigram_threshold real not null check (trigram_threshold >= 0 and trigram_threshold <= 1),
  exact_cap smallint not null check (exact_cap > 0),
  prefix_cap smallint not null check (prefix_cap > 0),
  trigram_cap smallint not null check (trigram_cap > 0),
  fts_cap smallint not null check (fts_cap > 0),
  taxonomy_cap smallint not null check (taxonomy_cap > 0),
  event_cap smallint not null check (event_cap > 0),
  semantic_cap smallint not null check (semantic_cap > 0),
  rrf_k smallint not null check (rrf_k > 0),
  semantic_enabled boolean not null,
  embedding_provider text not null check (btrim(embedding_provider) <> ''),
  embedding_model text not null check (btrim(embedding_model) <> ''),
  embedding_revision text not null check (btrim(embedding_revision) <> ''),
  embedding_dimension smallint not null check (embedding_dimension > 0),
  embedding_timeout_ms integer not null check (embedding_timeout_ms > 0),
  semantic_trigger_terms text[] not null default '{}' check (array_position(semantic_trigger_terms, null) is null),
  event_horizon_days smallint not null check (event_horizon_days >= 0),
  event_freshness_by_source jsonb not null,
  radius_cap_m integer not null check (radius_cap_m > 0),
  noncollapse_enabled boolean not null,
  broad_terms text[] not null default '{}' check (array_position(broad_terms, null) is null),
  taxonomy_group_depth smallint not null check (taxonomy_group_depth >= 0),
  comparable_rrf_ratio real not null check (comparable_rrf_ratio > 0 and comparable_rrf_ratio <= 1),
  top_k_group_cap smallint not null check (top_k_group_cap > 0),
  chain_repetition_cap smallint not null check (chain_repetition_cap > 0),
  event_venue_repetition_cap smallint not null check (event_venue_repetition_cap > 0),
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  created_by text not null check (btrim(created_by) <> ''),
  note text null,
  check ((is_active and activated_at is not null) or (not is_active and activated_at is null))
);

create unique index search_configs_one_active_idx
  on app.search_configs ((true))
  where is_active;
create index search_configs_active_version_idx
  on app.search_configs (version)
  where is_active;

create function app.is_valid_event_freshness_by_source(value jsonb)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and not exists (
      select 1
      from jsonb_each(value) as source(key, settings)
      where source.key = ''
        or jsonb_typeof(source.settings) <> 'object'
        or source.settings ?| array['toleranceHours', 'nearTermHours', 'refreshTargetHours'] is false
        or (select count(*) from jsonb_object_keys(source.settings)) <> 3
        or exists (
          select 1
          from jsonb_each_text(source.settings) as setting(key, setting_value)
          where setting.key not in ('toleranceHours', 'nearTermHours', 'refreshTargetHours')
            or setting.setting_value !~ '^[0-9]+$'
            or setting.setting_value::numeric < 0
        )
    );
$$;

alter table app.search_configs
  add constraint search_configs_event_freshness_shape_check
  check (app.is_valid_event_freshness_by_source(event_freshness_by_source));

create function app.validate_embedding_contract()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  document_row app.search_documents%rowtype;
begin
  select document.* into document_row
  from app.search_documents as document
  where document.id = new.search_document_id;

  if document_row.id is null
    or document_row.entity_id <> new.entity_id
    or document_row.content_hash <> new.document_hash
  then
    raise exception using
      errcode = '23514',
      message = 'embedding must match its search document entity and content hash';
  end if;

  if not exists (
    select 1
    from app.search_configs as config
    where config.embedding_provider = new.provider
      and config.embedding_model = new.model
      and config.embedding_revision = new.model_revision
      and config.embedding_dimension = new.dimension
  ) then
    raise exception using
      errcode = '23514',
      message = 'embedding model contract must be retained by a search configuration';
  end if;

  if new.status = 'READY' and not exists (
    select 1
    from app.search_configs as config
    where config.is_active
      and config.embedding_provider = new.provider
      and config.embedding_model = new.model
      and config.embedding_revision = new.model_revision
      and config.embedding_dimension = new.dimension
  ) then
    raise exception using
      errcode = '23514',
      message = 'ready embedding must match the active search configuration';
  end if;

  return new;
end;
$$;

create function app.validate_embedding_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'STALE' then
      raise exception using errcode = '23514', message = 'embeddings cannot be inserted stale';
    end if;
    return new;
  end if;

  if old.status = 'READY' and new.status = 'STALE'
    and new.embedding::text is not distinct from old.embedding::text
    and new.generated_at is not distinct from old.generated_at
    and new.search_document_id is not distinct from old.search_document_id
    and new.entity_id is not distinct from old.entity_id
    and new.provider is not distinct from old.provider
    and new.model is not distinct from old.model
    and new.model_revision is not distinct from old.model_revision
    and new.dimension is not distinct from old.dimension
    and new.metric is not distinct from old.metric
    and new.document_hash is not distinct from old.document_hash
    and new.attempt_key is not distinct from old.attempt_key
    and new.attempted_at is not distinct from old.attempted_at
    and new.error_class is null
    and new.error_code is null
    and new.stale_reason is not null
    and btrim(new.stale_reason) <> ''
  then
    return new;
  end if;

  raise exception using
    errcode = '55000',
    message = 'embedding attempts are immutable except READY to STALE';
end;
$$;

create table app.embeddings (
  id uuid primary key default gen_random_uuid(),
  search_document_id uuid not null references app.search_documents (id) on delete restrict,
  entity_id uuid not null references app.canonical_entities (id) on delete restrict,
  provider text not null check (btrim(provider) <> ''),
  model text not null check (btrim(model) <> ''),
  model_revision text not null check (btrim(model_revision) <> ''),
  dimension smallint not null check (dimension > 0),
  metric text not null default 'cosine' check (metric = 'cosine'),
  embedding extensions.vector null,
  document_hash char(64) not null check (document_hash ~ '^[0-9a-f]{64}$'),
  status app.embedding_status not null,
  attempt_key text not null unique check (btrim(attempt_key) <> ''),
  attempted_at timestamptz not null,
  generated_at timestamptz null,
  error_class text null,
  error_code text null,
  stale_reason text null,
  created_at timestamptz not null default now(),
  check (
    (status = 'READY'
      and embedding is not null
      and extensions.vector_dims(embedding) = dimension
      and extensions.vector_norm(embedding) > 0
      and extensions.vector_norm(embedding) < 'Infinity'::real
      and generated_at is not null
      and error_class is null
      and error_code is null
      and stale_reason is null)
    or (status = 'FAILED'
      and embedding is null
      and generated_at is null
      and error_class is not null
      and btrim(error_class) <> ''
      and error_code is not null
      and btrim(error_code) <> ''
      and stale_reason is null)
    or (status = 'STALE'
      and embedding is not null
      and extensions.vector_dims(embedding) = dimension
      and extensions.vector_norm(embedding) > 0
      and extensions.vector_norm(embedding) < 'Infinity'::real
      and generated_at is not null
      and error_class is null
      and error_code is null
      and stale_reason is not null
      and btrim(stale_reason) <> '')
  )
);

create unique index embeddings_one_ready_model_document_idx
  on app.embeddings (search_document_id, provider, model, model_revision, dimension)
  where status = 'READY';
create index embeddings_model_dimension_status_idx
  on app.embeddings (provider, model, model_revision, dimension, status);
create index embeddings_entity_status_idx
  on app.embeddings (entity_id, status);

revoke execute on function app.is_valid_event_freshness_by_source(jsonb) from public;
revoke execute on function app.validate_embedding_contract() from public;
revoke execute on function app.validate_embedding_transition() from public;

create trigger embeddings_validate_contract
before insert or update on app.embeddings
for each row execute function app.validate_embedding_contract();
create constraint trigger embeddings_validate_transition
after insert or update on app.embeddings
deferrable initially immediate
for each row execute function app.validate_embedding_transition();

alter table app.search_documents enable row level security;
alter table app.embeddings enable row level security;
alter table app.search_configs enable row level security;

grant select, insert, update on app.search_documents, app.embeddings
to lemon_ingestion, lemon_reviewer;
grant select, insert, update on app.search_configs
to lemon_reference_admin, lemon_reviewer;

create policy search_documents_ingestion
on app.search_documents
for all to lemon_ingestion
using (true) with check (true);
create policy embeddings_ingestion
on app.embeddings
for all to lemon_ingestion
using (true) with check (true);
create policy search_documents_reviewer
on app.search_documents
for all to lemon_reviewer
using (true) with check (true);
create policy embeddings_reviewer
on app.embeddings
for all to lemon_reviewer
using (true) with check (true);
create policy search_configs_reference_admin
on app.search_configs
for all to lemon_reference_admin
using (true) with check (true);
create policy search_configs_reviewer
on app.search_configs
for all to lemon_reviewer
using (true) with check (true);

revoke all on app.search_documents, app.embeddings, app.search_configs
from public, anon, authenticated, service_role;
