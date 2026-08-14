create function app.norm_v1_preserving(value text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  without_allowed_whitespace text;
begin
  without_allowed_whitespace := regexp_replace(value, E'[\t\n]', '', 'g');
  if without_allowed_whitespace ~ '[[:cntrl:]]' then
    raise exception using
      errcode = '22021',
      message = 'search text contains a disallowed control character';
  end if;

  return btrim(
    regexp_replace(
      lower(normalize(value, NFC)),
      '[[:punct:][:space:]]+',
      ' ',
      'g'
    )
  );
end;
$$;

create function app.norm_v1_accentless(value text)
returns text
language sql
stable
strict
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      extensions.unaccent(app.norm_v1_preserving(value)),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );
$$;

create function app.set_norm_v1_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'canonical_entities' then
    new.canonical_name_norm := app.norm_v1_preserving(new.canonical_name);
    new.canonical_name_ascii := app.norm_v1_accentless(new.canonical_name);
  else
    new.alias_norm := app.norm_v1_preserving(new.alias);
    new.alias_ascii := app.norm_v1_accentless(new.alias);
  end if;
  return new;
end;
$$;

revoke execute on function app.norm_v1_preserving(text)
from public, anon, authenticated, service_role;
revoke execute on function app.norm_v1_accentless(text)
from public, anon, authenticated, service_role;
revoke execute on function app.set_norm_v1_fields()
from public, anon, authenticated, service_role;

grant execute on function app.norm_v1_preserving(text), app.norm_v1_accentless(text)
to lemon_ingestion, lemon_reviewer, lemon_reference_admin;

create trigger canonical_entities_norm_v1
before insert or update of canonical_name on app.canonical_entities
for each row execute function app.set_norm_v1_fields();

create trigger entity_aliases_norm_v1
before insert or update of alias on app.entity_aliases
for each row execute function app.set_norm_v1_fields();

create trigger taxonomy_aliases_norm_v1
before insert or update of alias on app.taxonomy_aliases
for each row execute function app.set_norm_v1_fields();

update app.canonical_entities
set canonical_name_norm = app.norm_v1_preserving(canonical_name),
    canonical_name_ascii = app.norm_v1_accentless(canonical_name)
where (canonical_name_norm, canonical_name_ascii) is distinct from (
  app.norm_v1_preserving(canonical_name),
  app.norm_v1_accentless(canonical_name)
);

update app.entity_aliases
set alias_norm = app.norm_v1_preserving(alias),
    alias_ascii = app.norm_v1_accentless(alias)
where (alias_norm, alias_ascii) is distinct from (
  app.norm_v1_preserving(alias),
  app.norm_v1_accentless(alias)
);

update app.taxonomy_aliases
set alias_norm = app.norm_v1_preserving(alias),
    alias_ascii = app.norm_v1_accentless(alias)
where (alias_norm, alias_ascii) is distinct from (
  app.norm_v1_preserving(alias),
  app.norm_v1_accentless(alias)
);

set constraints all immediate;

create index canonical_entities_published_name_norm_trgm_idx
  on app.canonical_entities using gin (canonical_name_norm extensions.gin_trgm_ops)
  where publication_status = 'PUBLISHED' and merged_into_id is null;

create index canonical_entities_published_name_ascii_trgm_idx
  on app.canonical_entities using gin (canonical_name_ascii extensions.gin_trgm_ops)
  where publication_status = 'PUBLISHED' and merged_into_id is null;

create view app.search_eligible_places_v
with (security_invoker = true)
as
select canonical.id as entity_id,
       canonical.scope_id,
       canonical.canonical_name,
       canonical.canonical_name_norm,
       canonical.canonical_name_ascii
from app.canonical_entities as canonical
join app.places as place on place.entity_id = canonical.id
join app.geographic_scopes as scope
  on scope.id = canonical.scope_id and scope.is_active
join app.geographic_scope_boundaries as boundary
  on boundary.id = canonical.scope_boundary_id
  and boundary.scope_id = canonical.scope_id
  and boundary.is_active
where canonical.entity_type = 'PLACE'
  and canonical.publication_status = 'PUBLISHED'
  and canonical.merged_into_id is null
  and place.status in ('ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN')
  and place.location is not null
  and extensions.st_covers(boundary.boundary, place.location::extensions.geometry);

revoke all on app.search_eligible_places_v
from public, anon, authenticated, service_role;

create function app.search_eligible_places(p_scope_id uuid)
returns table (
  entity_id uuid,
  canonical_name text,
  canonical_name_norm text,
  canonical_name_ascii text
)
language sql
stable
set search_path = ''
as $$
  select eligible.entity_id,
         eligible.canonical_name,
         eligible.canonical_name_norm,
         eligible.canonical_name_ascii
  from app.search_eligible_places_v as eligible
  where eligible.scope_id = p_scope_id;
$$;

create function app.search_exact_candidates(
  p_query text,
  p_scope_id uuid,
  p_cap integer default 20
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  protected boolean,
  protection_class text,
  normalized_query text,
  accentless_query text,
  matched_normalized_value text,
  matched_source text,
  alias_id uuid,
  alias_qualification_reason text,
  trigram_similarity real,
  candidate_rank integer,
  eligibility_passed boolean
)
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_cap < 1 or p_cap > 200 then
    raise exception using errcode = '22023', message = 'exact candidate cap is invalid';
  end if;

  return query
  with query_value as (
    select app.norm_v1_preserving(p_query) as preserving,
           app.norm_v1_accentless(p_query) as accentless
  ),
  eligible as not materialized (
    select eligible.entity_id,
           eligible.canonical_name,
           eligible.canonical_name_norm,
           eligible.canonical_name_ascii
    from app.search_eligible_places_v as eligible
    where eligible.scope_id = p_scope_id
  ),
  eligible_aliases as (
    select alias.id,
           alias.entity_id,
           alias.alias_norm
    from app.entity_aliases as alias
    join eligible on eligible.entity_id = alias.entity_id
    cross join query_value
    where alias.active
      and alias.verified
      and alias.alias_norm = query_value.preserving
  ),
  alias_summary as (
    select count(distinct entity_id) as eligible_entity_count
    from eligible_aliases
  ),
  evidence as (
    select eligible.entity_id,
           'CANONICAL_EXACT'::text as evidence_type,
           true as is_protected,
           'PROTECTED_CANONICAL_EXACT'::text as protected_class,
           query_value.preserving,
           query_value.accentless,
           eligible.canonical_name_norm as matched_value,
           'CANONICAL'::text as source_type,
           null::uuid as evidence_alias_id,
           'NOT_APPLICABLE'::text as qualification_reason,
           null::real as similarity_value,
           1 as evidence_priority
    from eligible
    cross join query_value
    where eligible.canonical_name_norm = query_value.preserving

    union all

    select eligible_alias.entity_id,
           'VERIFIED_ALIAS_EXACT'::text,
           alias_summary.eligible_entity_count = 1
             and not exists (
               select 1
               from eligible as canonical_conflict
               where canonical_conflict.canonical_name_norm = query_value.preserving
                 and canonical_conflict.entity_id <> eligible_alias.entity_id
             ),
           case
             when alias_summary.eligible_entity_count = 1
               and not exists (
                 select 1
                 from eligible as canonical_conflict
                 where canonical_conflict.canonical_name_norm = query_value.preserving
                   and canonical_conflict.entity_id <> eligible_alias.entity_id
               )
             then 'PROTECTED_ALIAS_EXACT'
             else null
           end,
           query_value.preserving,
           query_value.accentless,
           eligible_alias.alias_norm,
           'ALIAS'::text,
           eligible_alias.id,
           case
             when alias_summary.eligible_entity_count <> 1 then 'AMBIGUOUS_ALIAS'
             when exists (
               select 1
               from eligible as canonical_conflict
               where canonical_conflict.canonical_name_norm = query_value.preserving
                 and canonical_conflict.entity_id <> eligible_alias.entity_id
             ) then 'CANONICAL_NAME_CONFLICT'
             else 'QUALIFIED'
           end,
           null::real,
           2
    from eligible_aliases as eligible_alias
    cross join alias_summary
    cross join query_value
  ),
  capped as (
    select *
    from evidence
    order by evidence_priority, entity_id, evidence_alias_id nulls first
    limit p_cap
  )
  select capped.entity_id,
         capped.evidence_type,
         capped.is_protected,
         capped.protected_class,
         capped.preserving,
         capped.accentless,
         capped.matched_value,
         capped.source_type,
         capped.evidence_alias_id,
         capped.qualification_reason,
         capped.similarity_value,
         row_number() over (
           order by capped.evidence_priority, capped.entity_id,
                    capped.evidence_alias_id nulls first
         )::integer,
         true
  from capped
  order by capped.evidence_priority, capped.entity_id,
           capped.evidence_alias_id nulls first;
end;
$$;

create function app.search_fuzzy_candidates(
  p_query text,
  p_scope_id uuid,
  p_ascii_cap integer default 20,
  p_prefix_min_length integer default 3,
  p_prefix_cap integer default 20,
  p_trigram_min_length integer default 4,
  p_trigram_threshold real default 0.3,
  p_trigram_cap integer default 20
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  protected boolean,
  protection_class text,
  normalized_query text,
  accentless_query text,
  matched_normalized_value text,
  matched_source text,
  alias_id uuid,
  alias_qualification_reason text,
  trigram_similarity real,
  candidate_rank integer,
  eligibility_passed boolean
)
language plpgsql
volatile
set search_path = ''
as $$
begin
  if p_ascii_cap < 1 or p_ascii_cap > 200
    or p_prefix_min_length < 1 or p_prefix_min_length > 32
    or p_prefix_cap < 1 or p_prefix_cap > 200
    or p_trigram_min_length < 1 or p_trigram_min_length > 32
    or p_trigram_threshold < 0 or p_trigram_threshold > 1
    or p_trigram_cap < 1 or p_trigram_cap > 200
  then
    raise exception using errcode = '22023', message = 'fuzzy candidate bounds are invalid';
  end if;

  perform pg_catalog.set_config(
    'pg_trgm.similarity_threshold',
    p_trigram_threshold::text,
    true
  );

  return query
  with query_value as (
    select app.norm_v1_preserving(p_query) as preserving,
           app.norm_v1_accentless(p_query) as accentless
  ),
  eligible as not materialized (
    select eligible.entity_id,
           eligible.canonical_name,
           eligible.canonical_name_norm,
           eligible.canonical_name_ascii
    from app.search_eligible_places_v as eligible
    where eligible.scope_id = p_scope_id
  ),
  evidence as (
    select eligible.entity_id,
           'ACCENTLESS_EXACT'::text as evidence_type,
           query_value.preserving,
           query_value.accentless,
           eligible.canonical_name_ascii as matched_value,
           'CANONICAL'::text as source_type,
           null::uuid as evidence_alias_id,
           'ORDINARY_ACCENTLESS'::text as qualification_reason,
           null::real as similarity_value,
           1 as source_priority,
           character_length(eligible.canonical_name_ascii) as completion_length
    from eligible
    cross join query_value
    where eligible.canonical_name_ascii = query_value.accentless
      and eligible.canonical_name_norm <> query_value.preserving

    union all

    select eligible.entity_id,
           'ACCENTLESS_EXACT'::text,
           query_value.preserving,
           query_value.accentless,
           alias.alias_ascii,
           'ALIAS'::text,
           alias.id,
           'ORDINARY_ACCENTLESS'::text,
           null::real,
           2,
           character_length(alias.alias_ascii)
    from eligible
    join app.entity_aliases as alias on alias.entity_id = eligible.entity_id
    cross join query_value
    where alias.active
      and alias.alias_ascii = query_value.accentless
      and alias.alias_norm <> query_value.preserving

    union all

    select eligible.entity_id,
           'PREFIX'::text,
           query_value.preserving,
           query_value.accentless,
           eligible.canonical_name_norm,
           'CANONICAL'::text,
           null::uuid,
           'ORDINARY_PREFIX'::text,
           null::real,
           1,
           character_length(eligible.canonical_name_norm)
    from eligible
    cross join query_value
    where character_length(query_value.preserving) >= p_prefix_min_length
      and eligible.canonical_name_norm like query_value.preserving || '%'
      and eligible.canonical_name_norm <> query_value.preserving

    union all

    select eligible.entity_id,
           'PREFIX'::text,
           query_value.preserving,
           query_value.accentless,
           alias.alias_norm,
           'ALIAS'::text,
           alias.id,
           'ORDINARY_PREFIX'::text,
           null::real,
           2,
           character_length(alias.alias_norm)
    from eligible
    join app.entity_aliases as alias on alias.entity_id = eligible.entity_id
    cross join query_value
    where alias.active
      and character_length(query_value.preserving) >= p_prefix_min_length
      and alias.alias_norm like query_value.preserving || '%'
      and alias.alias_norm <> query_value.preserving

    union all

    select eligible.entity_id,
           'TRIGRAM'::text,
           query_value.preserving,
           query_value.accentless,
           eligible.canonical_name_norm,
           'CANONICAL'::text,
           null::uuid,
           'ORDINARY_TRIGRAM'::text,
           extensions.similarity(eligible.canonical_name_norm, query_value.preserving),
           1,
           character_length(eligible.canonical_name_norm)
    from eligible
    cross join query_value
    where character_length(query_value.preserving) >= p_trigram_min_length
      and eligible.canonical_name_norm <> query_value.preserving
      and eligible.canonical_name_norm
        operator(extensions.%) query_value.preserving
      and extensions.similarity(eligible.canonical_name_norm, query_value.preserving)
        >= p_trigram_threshold

    union all

    select eligible.entity_id,
           'TRIGRAM'::text,
           query_value.preserving,
           query_value.accentless,
           alias.alias_norm,
           'ALIAS'::text,
           alias.id,
           'ORDINARY_TRIGRAM'::text,
           extensions.similarity(alias.alias_norm, query_value.preserving),
           2,
           character_length(alias.alias_norm)
    from eligible
    join app.entity_aliases as alias on alias.entity_id = eligible.entity_id
    cross join query_value
    where alias.active
      and character_length(query_value.preserving) >= p_trigram_min_length
      and alias.alias_norm <> query_value.preserving
      and alias.alias_norm operator(extensions.%) query_value.preserving
      and extensions.similarity(alias.alias_norm, query_value.preserving)
        >= p_trigram_threshold
  ),
  ranked as (
    select evidence.*,
           row_number() over (
             partition by evidence_type
             order by
               case when evidence_type = 'TRIGRAM' then similarity_value end desc nulls last,
               source_priority,
               completion_length,
               entity_id,
               evidence_alias_id nulls first
           )::integer as evidence_rank
    from evidence
  ),
  capped as (
    select *
    from ranked
    where evidence_rank <= case evidence_type
      when 'ACCENTLESS_EXACT' then p_ascii_cap
      when 'PREFIX' then p_prefix_cap
      else p_trigram_cap
    end
  )
  select capped.entity_id,
         capped.evidence_type,
         false,
         null::text,
         capped.preserving,
         capped.accentless,
         capped.matched_value,
         capped.source_type,
         capped.evidence_alias_id,
         capped.qualification_reason,
         capped.similarity_value,
         capped.evidence_rank,
         true
  from capped
  order by case capped.evidence_type
             when 'ACCENTLESS_EXACT' then 1
             when 'PREFIX' then 2
             else 3
           end,
           capped.evidence_rank;
end;
$$;

create function app.search_known_item_candidates(
  p_query text,
  p_scope_id uuid,
  p_exact_cap integer default 20,
  p_prefix_min_length integer default 3,
  p_prefix_cap integer default 20,
  p_trigram_min_length integer default 4,
  p_trigram_threshold real default 0.3,
  p_trigram_cap integer default 20
)
returns table (
  canonical_entity_id uuid,
  match_type text,
  protected boolean,
  protection_class text,
  normalized_query text,
  accentless_query text,
  matched_normalized_value text,
  matched_source text,
  alias_id uuid,
  alias_qualification_reason text,
  trigram_similarity real,
  candidate_rank integer,
  eligibility_passed boolean
)
language sql
volatile
set search_path = ''
as $$
  with evidence as (
    select *
    from app.search_exact_candidates(p_query, p_scope_id, p_exact_cap)
    union all
    select *
    from app.search_fuzzy_candidates(
      p_query,
      p_scope_id,
      p_exact_cap,
      p_prefix_min_length,
      p_prefix_cap,
      p_trigram_min_length,
      p_trigram_threshold,
      p_trigram_cap
    )
  ),
  deduplicated as (
    select evidence.*,
           row_number() over (
             partition by canonical_entity_id
             order by
               case
                 when match_type = 'CANONICAL_EXACT' then 1
                 when match_type = 'VERIFIED_ALIAS_EXACT' and protected then 2
                 when match_type = 'VERIFIED_ALIAS_EXACT' then 3
                 when match_type = 'ACCENTLESS_EXACT' then 4
                 when match_type = 'PREFIX' then 5
                 else 6
               end,
               candidate_rank,
               alias_id nulls first
           ) as entity_evidence_rank
    from evidence
  )
  select canonical_entity_id,
         match_type,
         protected,
         protection_class,
         normalized_query,
         accentless_query,
         matched_normalized_value,
         matched_source,
         alias_id,
         alias_qualification_reason,
         trigram_similarity,
         candidate_rank,
         eligibility_passed
  from deduplicated
  where entity_evidence_rank = 1
  order by
    case
      when match_type = 'CANONICAL_EXACT' then 1
      when match_type = 'VERIFIED_ALIAS_EXACT' and protected then 2
      when match_type = 'VERIFIED_ALIAS_EXACT' then 3
      when match_type = 'ACCENTLESS_EXACT' then 4
      when match_type = 'PREFIX' then 5
      else 6
    end,
    candidate_rank,
    canonical_entity_id;
$$;

revoke execute on function app.search_eligible_places(uuid)
from public, anon, authenticated, service_role;
revoke execute on function app.search_exact_candidates(text, uuid, integer)
from public, anon, authenticated, service_role;
revoke execute on function app.search_fuzzy_candidates(
  text, uuid, integer, integer, integer, integer, real, integer
) from public, anon, authenticated, service_role;
revoke execute on function app.search_known_item_candidates(
  text, uuid, integer, integer, integer, integer, real, integer
) from public, anon, authenticated, service_role;
