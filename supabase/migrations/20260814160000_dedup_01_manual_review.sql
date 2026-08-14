-- DEDUP-01: bounded candidate generation and evidence-pinned manual review.

create function app.build_duplicate_review_evidence(
  p_candidate_id uuid,
  p_record_a_id uuid,
  p_record_b_id uuid
)
returns table (
  evidence_summary jsonb,
  evidence_version_ids uuid[],
  evidence_parse_attempt_ids uuid[],
  evidence_hash char(64),
  entity_a_id uuid,
  entity_b_id uuid
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  record_a app.source_records%rowtype;
  record_b app.source_records%rowtype;
  attempt_a app.source_record_parse_attempts%rowtype;
  attempt_b app.source_record_parse_attempts%rowtype;
  side_a jsonb;
  side_b jsonb;
  exact_identity jsonb;
begin
  if p_record_a_id is null or p_record_b_id is null or p_record_a_id >= p_record_b_id then
    raise exception using errcode = '22023', message = 'duplicate evidence requires an ordered record pair';
  end if;

  select item.* into record_a from app.source_records as item where item.id = p_record_a_id;
  select item.* into record_b from app.source_records as item where item.id = p_record_b_id;

  if record_a.id is null or record_b.id is null
    or record_a.current_version_id is null or record_a.current_parse_attempt_id is null
    or record_b.current_version_id is null or record_b.current_parse_attempt_id is null
  then
    raise exception using errcode = '23514', message = 'duplicate review requires selected evidence for both records';
  end if;

  select item.* into attempt_a
  from app.source_record_parse_attempts as item
  where item.id = record_a.current_parse_attempt_id;
  select item.* into attempt_b
  from app.source_record_parse_attempts as item
  where item.id = record_b.current_parse_attempt_id;

  if attempt_a.id is null
    or attempt_a.status <> 'SUCCEEDED'
    or attempt_a.source_record_version_id <> record_a.current_version_id
    or attempt_a.normalized_output is null
    or attempt_a.output_redacted_at is not null
    or attempt_b.id is null
    or attempt_b.status <> 'SUCCEEDED'
    or attempt_b.source_record_version_id <> record_b.current_version_id
    or attempt_b.normalized_output is null
    or attempt_b.output_redacted_at is not null
  then
    raise exception using errcode = '23514', message = 'duplicate review evidence must be current successful permitted output';
  end if;

  side_a := jsonb_strip_nulls(jsonb_build_object(
    'recordId', record_a.id,
    'name', coalesce(
      attempt_a.normalized_output #>> '{names,0,value}',
      attempt_a.normalized_output #>> '{place,name}'
    ),
    'latitude', attempt_a.normalized_output #> '{place,latitude}',
    'longitude', attempt_a.normalized_output #> '{place,longitude}',
    'streetAddress', attempt_a.normalized_output #>> '{place,streetAddress}',
    'postalCode', attempt_a.normalized_output #>> '{place,postalCode}',
    'locality', attempt_a.normalized_output #>> '{place,locality}',
    'officialUrl', attempt_a.normalized_output #>> '{place,officialUrl}',
    'phone', attempt_a.normalized_output #>> '{place,phone}'
  ));
  side_b := jsonb_strip_nulls(jsonb_build_object(
    'recordId', record_b.id,
    'name', coalesce(
      attempt_b.normalized_output #>> '{names,0,value}',
      attempt_b.normalized_output #>> '{place,name}'
    ),
    'latitude', attempt_b.normalized_output #> '{place,latitude}',
    'longitude', attempt_b.normalized_output #> '{place,longitude}',
    'streetAddress', attempt_b.normalized_output #>> '{place,streetAddress}',
    'postalCode', attempt_b.normalized_output #>> '{place,postalCode}',
    'locality', attempt_b.normalized_output #>> '{place,locality}',
    'officialUrl', attempt_b.normalized_output #>> '{place,officialUrl}',
    'phone', attempt_b.normalized_output #>> '{place,phone}'
  ));

  exact_identity := jsonb_build_object(
    'candidateId', p_candidate_id,
    'records', jsonb_build_array(
      jsonb_build_object(
        'recordId', record_a.id,
        'versionId', record_a.current_version_id,
        'parseAttemptId', record_a.current_parse_attempt_id,
        'parserVersion', attempt_a.parser_version,
        'normalizedOutputHash', attempt_a.normalized_output_hash,
        'identityEvidence', side_a
      ),
      jsonb_build_object(
        'recordId', record_b.id,
        'versionId', record_b.current_version_id,
        'parseAttemptId', record_b.current_parse_attempt_id,
        'parserVersion', attempt_b.parser_version,
        'normalizedOutputHash', attempt_b.normalized_output_hash,
        'identityEvidence', side_b
      )
    )
  );

  evidence_summary := jsonb_build_object('recordA', side_a, 'recordB', side_b);
  evidence_version_ids := array[record_a.current_version_id, record_b.current_version_id];
  evidence_parse_attempt_ids := array[record_a.current_parse_attempt_id, record_b.current_parse_attempt_id];
  evidence_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(exact_identity::text, 'UTF8'), 'sha256'),
    'hex'
  )::char(64);
  entity_a_id := record_a.canonical_entity_id;
  entity_b_id := record_b.canonical_entity_id;
  return next;
end;
$$;

create function app.create_duplicate_candidate(
  p_record_one_id uuid,
  p_record_two_id uuid,
  p_actor text default 'candidate-generator'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ordered_record_a_id uuid := least(p_record_one_id, p_record_two_id);
  ordered_record_b_id uuid := greatest(p_record_one_id, p_record_two_id);
  candidate_id uuid;
  decision_id uuid := gen_random_uuid();
  evidence record;
begin
  if p_actor is null or btrim(p_actor) = '' or ordered_record_a_id is null or ordered_record_b_id is null
    or ordered_record_a_id = ordered_record_b_id
  then
    raise exception using errcode = '22023', message = 'candidate requires two different records and an actor';
  end if;

  perform 1 from app.source_records as item
  where item.id in (ordered_record_a_id, ordered_record_b_id)
  order by item.id
  for update;
  if (select count(*) from app.source_records where id in (ordered_record_a_id, ordered_record_b_id)) <> 2 then
    raise exception using errcode = 'P0002', message = 'candidate source record does not exist';
  end if;

  select item.id into candidate_id
  from app.duplicate_candidates as item
  where item.record_a_id = ordered_record_a_id and item.record_b_id = ordered_record_b_id;
  if candidate_id is not null then
    return candidate_id;
  end if;

  candidate_id := gen_random_uuid();
  select * into evidence
  from app.build_duplicate_review_evidence(candidate_id, ordered_record_a_id, ordered_record_b_id);

  insert into app.duplicate_candidates (
    id, record_a_id, record_b_id, entity_a_id, entity_b_id,
    evidence_summary, evidence_hash, status, current_decision_id
  ) values (
    candidate_id, ordered_record_a_id, ordered_record_b_id, evidence.entity_a_id, evidence.entity_b_id,
    evidence.evidence_summary, evidence.evidence_hash, 'OPEN', decision_id
  );
  insert into app.duplicate_candidate_decisions (
    id, duplicate_candidate_id, decision, operation_type, reviewer,
    evidence_version_ids, evidence_parse_attempt_ids, evidence_hash
  ) values (
    decision_id, candidate_id, 'OPEN', 'OPEN_REVIEW', btrim(p_actor),
    evidence.evidence_version_ids, evidence.evidence_parse_attempt_ids, evidence.evidence_hash
  );
  return candidate_id;
end;
$$;

create function app.generate_duplicate_candidates(p_limit integer default 50)
returns table (candidate_id uuid, record_a_id uuid, record_b_id uuid, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  pair record;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using errcode = '22023', message = 'candidate generation limit must be between 1 and 100';
  end if;

  for pair in
    with current_facts as (
      select record.id,
             record.source_id,
             record.canonical_entity_id,
             app.norm_v1_preserving(coalesce(
               attempt.normalized_output #>> '{names,0,value}',
               attempt.normalized_output #>> '{place,name}'
             )) as name_norm,
             nullif(regexp_replace(lower(coalesce(attempt.normalized_output #>> '{place,phone}', '')), '[^0-9+]', '', 'g'), '') as phone_norm,
             nullif(lower(attempt.normalized_output #>> '{place,officialUrl}'), '') as url_norm
      from app.source_records as record
      join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      where attempt.status = 'SUCCEEDED' and attempt.normalized_output is not null
    )
    select a.id as record_a_id,
           b.id as record_b_id,
           case
             when a.name_norm <> '' and a.name_norm = b.name_norm then 'EXACT_NORMALIZED_NAME'
             when a.phone_norm is not null and a.phone_norm = b.phone_norm then 'EXACT_PHONE'
             else 'EXACT_OFFICIAL_URL'
           end as reason
    from current_facts as a
    join current_facts as b on a.id < b.id and a.source_id <> b.source_id
    left join app.duplicate_candidates as existing
      on existing.record_a_id = a.id and existing.record_b_id = b.id
    where existing.id is null
      and (a.canonical_entity_id is null
        or b.canonical_entity_id is null
        or a.canonical_entity_id <> b.canonical_entity_id)
      and (
        (a.name_norm <> '' and a.name_norm = b.name_norm)
        or (a.phone_norm is not null and a.phone_norm = b.phone_norm)
        or (a.url_norm is not null and a.url_norm = b.url_norm)
      )
    order by a.id, b.id
    limit p_limit
  loop
    candidate_id := app.create_duplicate_candidate(pair.record_a_id, pair.record_b_id, 'candidate-generator');
    record_a_id := pair.record_a_id;
    record_b_id := pair.record_b_id;
    reason := pair.reason;
    return next;
  end loop;
end;
$$;

create function app.reopen_duplicate_candidate(
  p_candidate_id uuid,
  p_expected_current_decision_id uuid,
  p_reviewer text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate app.duplicate_candidates%rowtype;
  current_decision app.duplicate_candidate_decisions%rowtype;
  evidence record;
  next_id uuid := gen_random_uuid();
begin
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception using errcode = '22023', message = 'reviewer is required';
  end if;
  select item.* into candidate from app.duplicate_candidates as item
  where item.id = p_candidate_id for update;
  if candidate.id is null then raise exception using errcode = 'P0002', message = 'candidate does not exist'; end if;
  select item.* into current_decision from app.duplicate_candidate_decisions as item
  where item.id = candidate.current_decision_id for update;
  if current_decision.id is distinct from p_expected_current_decision_id then
    raise exception using errcode = '40001', message = 'stale duplicate decision';
  end if;

  perform 1 from app.source_records as item
  where item.id in (candidate.record_a_id, candidate.record_b_id)
  order by item.id for update;
  select * into evidence from app.build_duplicate_review_evidence(
    candidate.id, candidate.record_a_id, candidate.record_b_id
  );

  if current_decision.decision = 'SAME' then
    raise exception using errcode = '23514', message = 'SAME decisions must be reversed before reopening';
  end if;
  if current_decision.decision = 'OPEN'
    and current_decision.evidence_version_ids = evidence.evidence_version_ids
    and current_decision.evidence_parse_attempt_ids = evidence.evidence_parse_attempt_ids
    and current_decision.evidence_hash = evidence.evidence_hash
  then
    return current_decision.id;
  end if;

  insert into app.duplicate_candidate_decisions (
    id, duplicate_candidate_id, decision, operation_type, reviewer,
    evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
    supersedes_decision_id, resolution_detail, note
  ) values (
    next_id, candidate.id, 'OPEN', 'OPEN_REVIEW', btrim(p_reviewer),
    evidence.evidence_version_ids, evidence.evidence_parse_attempt_ids, evidence.evidence_hash,
    current_decision.id, jsonb_build_object('reason', 'REOPEN_OR_EVIDENCE_REFRESH'), p_note
  );
  update app.duplicate_candidates
  set entity_a_id = evidence.entity_a_id, entity_b_id = evidence.entity_b_id,
      evidence_summary = evidence.evidence_summary, evidence_hash = evidence.evidence_hash,
      status = 'OPEN', current_decision_id = next_id
  where id = candidate.id;
  return next_id;
end;
$$;

create function app.finalize_duplicate_candidate(
  p_candidate_id uuid,
  p_expected_current_decision_id uuid,
  p_decision app.duplicate_decision,
  p_reviewer text,
  p_unresolved_record_id uuid default null,
  p_target_entity_id uuid default null,
  p_survivor_entity_id uuid default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate app.duplicate_candidates%rowtype;
  current_decision app.duplicate_candidate_decisions%rowtype;
  record_a app.source_records%rowtype;
  record_b app.source_records%rowtype;
  target_entity app.canonical_entities%rowtype;
  survivor app.canonical_entities%rowtype;
  loser app.canonical_entities%rowtype;
  evidence record;
  next_id uuid := gen_random_uuid();
  operation_type text;
  resolution_detail jsonb;
  record_inverse jsonb := '[]'::jsonb;
  cloned_alias_ids uuid[] := '{}'::uuid[];
  deactivated_alias_ids uuid[] := '{}'::uuid[];
  cloned_membership_ids uuid[] := '{}'::uuid[];
  deactivated_membership_ids uuid[] := '{}'::uuid[];
  alias_row app.entity_aliases%rowtype;
  membership_row app.entity_taxonomy_memberships%rowtype;
  cloned_id uuid;
  reviewed_entity_type text;
begin
  if p_reviewer is null or btrim(p_reviewer) = ''
    or p_decision not in ('SAME', 'SEPARATE', 'UNSURE')
  then
    raise exception using errcode = '22023', message = 'a supported final decision and reviewer are required';
  end if;

  select item.* into candidate from app.duplicate_candidates as item
  where item.id = p_candidate_id for update;
  if candidate.id is null then raise exception using errcode = 'P0002', message = 'candidate does not exist'; end if;
  select item.* into current_decision from app.duplicate_candidate_decisions as item
  where item.id = candidate.current_decision_id for update;
  if current_decision.id is distinct from p_expected_current_decision_id
    or current_decision.decision <> 'OPEN'
  then
    raise exception using errcode = '40001', message = 'finalization requires the expected current OPEN_REVIEW';
  end if;

  perform 1 from app.source_records as item
  where item.id in (candidate.record_a_id, candidate.record_b_id)
     or item.canonical_entity_id in (candidate.entity_a_id, candidate.entity_b_id)
  order by item.id for update;
  select * into record_a from app.source_records where id = candidate.record_a_id;
  select * into record_b from app.source_records where id = candidate.record_b_id;
  select * into evidence from app.build_duplicate_review_evidence(
    candidate.id, candidate.record_a_id, candidate.record_b_id
  );

  if current_decision.evidence_version_ids <> evidence.evidence_version_ids
    or current_decision.evidence_parse_attempt_ids <> evidence.evidence_parse_attempt_ids
    or current_decision.evidence_hash <> evidence.evidence_hash
    or candidate.entity_a_id is distinct from record_a.canonical_entity_id
    or candidate.entity_b_id is distinct from record_b.canonical_entity_id
  then
    raise exception using errcode = '40001', message = 'review evidence or source resolution changed; refresh OPEN_REVIEW first';
  end if;

  if p_decision in ('SEPARATE', 'UNSURE') then
    if p_unresolved_record_id is not null or p_target_entity_id is not null or p_survivor_entity_id is not null then
      raise exception using errcode = '22023', message = 'SEPARATE and UNSURE do not accept identity mutation parameters';
    end if;
    operation_type := case p_decision when 'SEPARATE' then 'NO_MERGE' else 'UNSURE' end;
  elsif p_unresolved_record_id is not null or p_target_entity_id is not null then
    if p_unresolved_record_id is null or p_target_entity_id is null or p_survivor_entity_id is not null
      or p_unresolved_record_id not in (candidate.record_a_id, candidate.record_b_id)
    then
      raise exception using errcode = '22023', message = 'SAME Type A requires one candidate record and one target entity';
    end if;

    select item.* into target_entity from app.canonical_entities as item
    where item.id = p_target_entity_id for update;
    if target_entity.id is null or target_entity.publication_status = 'MERGED' then
      raise exception using errcode = '23514', message = 'Type A target must be a current canonical entity';
    end if;
    select coalesce(attempt.normalized_output ->> 'entityType', attempt.normalized_output ->> 'kind')
    into reviewed_entity_type
    from app.source_records as reviewed_record
    join app.source_record_parse_attempts as attempt
      on attempt.id = reviewed_record.current_parse_attempt_id
    where reviewed_record.id = p_unresolved_record_id;
    if upper(reviewed_entity_type) is distinct from target_entity.entity_type::text then
      raise exception using errcode = '23514', message = 'Type A source and target entity types must match';
    end if;
    if not exists (
      select 1 from app.source_records as counterpart
      where counterpart.id in (candidate.record_a_id, candidate.record_b_id)
        and counterpart.id <> p_unresolved_record_id
        and counterpart.canonical_entity_id = p_target_entity_id
    ) then
      raise exception using errcode = '23514', message = 'Type A target must be the reviewed counterpart entity';
    end if;
    if not exists (
      select 1 from app.source_records as unresolved
      where unresolved.id = p_unresolved_record_id
        and unresolved.canonical_entity_id is null
        and unresolved.resolution_method = 'UNRESOLVED'
    ) then
      raise exception using errcode = '40001', message = 'Type A source record is no longer unresolved';
    end if;

    update app.source_records
    set canonical_entity_id = p_target_entity_id, resolution_method = 'MANUAL_MAPPING'
    where id = p_unresolved_record_id;
    operation_type := 'LINK_RECORD';
    resolution_detail := jsonb_build_object(
      'inverse', jsonb_build_object(
        'type', 'TYPE_A', 'recordId', p_unresolved_record_id,
        'priorEntityId', null, 'priorResolutionMethod', 'UNRESOLVED'
      )
    );
  else
    if p_survivor_entity_id is null
      or record_a.canonical_entity_id is null or record_b.canonical_entity_id is null
      or record_a.canonical_entity_id = record_b.canonical_entity_id
      or p_survivor_entity_id not in (record_a.canonical_entity_id, record_b.canonical_entity_id)
    then
      raise exception using errcode = '22023', message = 'SAME Type B requires two entities and an explicit survivor';
    end if;

    perform 1 from app.canonical_entities as item
    where item.id in (record_a.canonical_entity_id, record_b.canonical_entity_id)
    order by item.id for update;
    select item.* into survivor from app.canonical_entities as item
    where item.id = p_survivor_entity_id;
    select item.* into loser from app.canonical_entities as item
    where item.id = case when record_a.canonical_entity_id = p_survivor_entity_id
      then record_b.canonical_entity_id else record_a.canonical_entity_id end;
    if survivor.publication_status = 'MERGED' or loser.publication_status = 'MERGED'
      or survivor.entity_type <> loser.entity_type
    then
      raise exception using errcode = '23514', message = 'Type B requires compatible current canonical entities';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'recordId', item.id, 'entityId', item.canonical_entity_id,
      'resolutionMethod', item.resolution_method::text
    ) order by item.id), '[]'::jsonb)
    into record_inverse
    from app.source_records as item
    where item.canonical_entity_id = loser.id;

    update app.source_records
    set canonical_entity_id = survivor.id, resolution_method = 'MANUAL_MAPPING'
    where canonical_entity_id = loser.id;

    for alias_row in select item.* from app.entity_aliases as item
      where item.entity_id = loser.id and item.active order by item.id for update
    loop
      update app.entity_aliases set active = false where id = alias_row.id;
      deactivated_alias_ids := array_append(deactivated_alias_ids, alias_row.id);
      if not exists (
        select 1 from app.entity_aliases as existing
        where existing.entity_id = survivor.id
          and existing.alias_norm = alias_row.alias_norm and existing.kind = alias_row.kind
      ) then
        insert into app.entity_aliases (
          entity_id, alias, alias_norm, alias_ascii, language, kind,
          source_record_version_id, verified, verified_by, verified_at, active
        ) values (
          survivor.id, alias_row.alias, alias_row.alias_norm, alias_row.alias_ascii,
          alias_row.language, alias_row.kind, alias_row.source_record_version_id,
          alias_row.verified, alias_row.verified_by, alias_row.verified_at, true
        ) returning id into cloned_id;
        cloned_alias_ids := array_append(cloned_alias_ids, cloned_id);
      end if;
    end loop;

    for membership_row in select item.* from app.entity_taxonomy_memberships as item
      where item.entity_id = loser.id and item.active order by item.id for update
    loop
      update app.entity_taxonomy_memberships set active = false where id = membership_row.id;
      deactivated_membership_ids := array_append(deactivated_membership_ids, membership_row.id);
      if not exists (
        select 1 from app.entity_taxonomy_memberships as existing
        where existing.entity_id = survivor.id
          and existing.taxonomy_node_id = membership_row.taxonomy_node_id and existing.active
      ) then
        insert into app.entity_taxonomy_memberships (
          entity_id, taxonomy_node_id, method, source_record_version_id,
          mapping_ref, manual_evidence, reviewed_by, active
        ) values (
          survivor.id, membership_row.taxonomy_node_id, membership_row.method,
          membership_row.source_record_version_id, membership_row.mapping_ref,
          membership_row.manual_evidence, membership_row.reviewed_by, true
        ) returning id into cloned_id;
        cloned_membership_ids := array_append(cloned_membership_ids, cloned_id);
      end if;
    end loop;

    update app.canonical_entities
    set publication_status = 'MERGED', merged_into_id = survivor.id, published_at = null
    where id = loser.id;
    operation_type := 'MERGE_ENTITIES';
    resolution_detail := jsonb_build_object(
      'inverse', jsonb_build_object(
        'type', 'TYPE_B', 'records', record_inverse,
        'loserEntityId', loser.id,
        'loserPublicationStatus', loser.publication_status,
        'loserMergedIntoId', loser.merged_into_id,
        'loserPublishedAt', loser.published_at,
        'deactivatedAliasIds', to_jsonb(deactivated_alias_ids),
        'clonedAliasIds', to_jsonb(cloned_alias_ids),
        'deactivatedMembershipIds', to_jsonb(deactivated_membership_ids),
        'clonedMembershipIds', to_jsonb(cloned_membership_ids)
      ),
      'canonicalRepair', 'SURVIVOR_FACTS_UNCHANGED'
    );
  end if;

  insert into app.duplicate_candidate_decisions (
    id, duplicate_candidate_id, decision, operation_type, reviewer,
    evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
    supersedes_decision_id, target_entity_id, survivor_entity_id, loser_entity_id,
    resolution_detail, note
  ) values (
    next_id, candidate.id, p_decision, operation_type, btrim(p_reviewer),
    evidence.evidence_version_ids, evidence.evidence_parse_attempt_ids, evidence.evidence_hash,
    current_decision.id,
    case when operation_type = 'LINK_RECORD' then p_target_entity_id end,
    case when operation_type = 'MERGE_ENTITIES' then survivor.id end,
    case when operation_type = 'MERGE_ENTITIES' then loser.id end,
    resolution_detail, p_note
  );
  select * into record_a from app.source_records where id = candidate.record_a_id;
  select * into record_b from app.source_records where id = candidate.record_b_id;
  update app.duplicate_candidates
  set entity_a_id = record_a.canonical_entity_id, entity_b_id = record_b.canonical_entity_id,
      status = p_decision, current_decision_id = next_id
  where id = candidate.id;
  return next_id;
end;
$$;

create function app.reverse_duplicate_same(
  p_candidate_id uuid,
  p_expected_current_decision_id uuid,
  p_reviewer text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate app.duplicate_candidates%rowtype;
  current_decision app.duplicate_candidate_decisions%rowtype;
  evidence record;
  inverse_detail jsonb;
  record_item jsonb;
  target_id_text text;
  next_id uuid := gen_random_uuid();
  entity_a uuid;
  entity_b uuid;
begin
  if p_reviewer is null or btrim(p_reviewer) = '' then
    raise exception using errcode = '22023', message = 'reviewer is required';
  end if;
  select item.* into candidate from app.duplicate_candidates as item
  where item.id = p_candidate_id for update;
  if candidate.id is null then raise exception using errcode = 'P0002', message = 'candidate does not exist'; end if;
  select item.* into current_decision from app.duplicate_candidate_decisions as item
  where item.id = candidate.current_decision_id for update;
  if current_decision.id is distinct from p_expected_current_decision_id
    or current_decision.decision <> 'SAME'
  then
    raise exception using errcode = '40001', message = 'reversal requires the expected current SAME decision';
  end if;
  inverse_detail := current_decision.resolution_detail -> 'inverse';
  if inverse_detail is null then
    raise exception using errcode = '23514', message = 'SAME decision lacks reversible detail';
  end if;

  perform 1 from app.source_records as item
  where item.id in (candidate.record_a_id, candidate.record_b_id)
     or item.id in (
       select (value ->> 'recordId')::uuid
       from jsonb_array_elements(coalesce(inverse_detail -> 'records', '[]'::jsonb))
     )
  order by item.id for update;
  perform 1 from app.canonical_entities as item
  where item.id in (
    current_decision.target_entity_id,
    current_decision.survivor_entity_id,
    current_decision.loser_entity_id
  ) order by item.id for update;
  perform 1 from app.entity_aliases as item
  where item.id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(inverse_detail -> 'clonedAliasIds', '[]'::jsonb))
    union all
    select value::uuid
    from jsonb_array_elements_text(coalesce(inverse_detail -> 'deactivatedAliasIds', '[]'::jsonb))
  ) order by item.id for update;
  perform 1 from app.entity_taxonomy_memberships as item
  where item.id in (
    select value::uuid
    from jsonb_array_elements_text(coalesce(inverse_detail -> 'clonedMembershipIds', '[]'::jsonb))
    union all
    select value::uuid
    from jsonb_array_elements_text(coalesce(inverse_detail -> 'deactivatedMembershipIds', '[]'::jsonb))
  ) order by item.id for update;

  if inverse_detail ->> 'type' = 'TYPE_A' then
    update app.source_records
    set canonical_entity_id = null,
        resolution_method = (inverse_detail ->> 'priorResolutionMethod')::app.source_resolution_method
    where id = (inverse_detail ->> 'recordId')::uuid
      and canonical_entity_id = current_decision.target_entity_id;
    if not found then
      raise exception using errcode = '40001', message = 'Type A inverse no longer matches current resolution';
    end if;
  elsif inverse_detail ->> 'type' = 'TYPE_B' then
    if not exists (
      select 1 from app.canonical_entities as loser
      where loser.id = current_decision.loser_entity_id
        and loser.publication_status = 'MERGED'
        and loser.merged_into_id = current_decision.survivor_entity_id
    ) then
      raise exception using errcode = '40001', message = 'Type B inverse no longer matches current merge';
    end if;
    for record_item in select value from jsonb_array_elements(inverse_detail -> 'records')
    loop
      update app.source_records
      set canonical_entity_id = (record_item ->> 'entityId')::uuid,
          resolution_method = (record_item ->> 'resolutionMethod')::app.source_resolution_method
      where id = (record_item ->> 'recordId')::uuid
        and canonical_entity_id = current_decision.survivor_entity_id;
      if not found then
        raise exception using errcode = '40001', message = 'Type B record inverse no longer matches current resolution';
      end if;
    end loop;
    for target_id_text in select value from jsonb_array_elements_text(inverse_detail -> 'clonedAliasIds')
    loop
      update app.entity_aliases set active = false where id = target_id_text::uuid and active;
      if not found then raise exception using errcode = '40001', message = 'Type B cloned alias inverse is stale'; end if;
    end loop;
    for target_id_text in select value from jsonb_array_elements_text(inverse_detail -> 'deactivatedAliasIds')
    loop
      update app.entity_aliases set active = true where id = target_id_text::uuid and not active;
      if not found then raise exception using errcode = '40001', message = 'Type B loser alias inverse is stale'; end if;
    end loop;
    for target_id_text in select value from jsonb_array_elements_text(inverse_detail -> 'clonedMembershipIds')
    loop
      update app.entity_taxonomy_memberships set active = false where id = target_id_text::uuid and active;
      if not found then raise exception using errcode = '40001', message = 'Type B cloned membership inverse is stale'; end if;
    end loop;
    for target_id_text in select value from jsonb_array_elements_text(inverse_detail -> 'deactivatedMembershipIds')
    loop
      update app.entity_taxonomy_memberships set active = true where id = target_id_text::uuid and not active;
      if not found then raise exception using errcode = '40001', message = 'Type B loser membership inverse is stale'; end if;
    end loop;
    update app.canonical_entities
    set publication_status = (inverse_detail ->> 'loserPublicationStatus')::app.publication_status,
        merged_into_id = nullif(inverse_detail ->> 'loserMergedIntoId', '')::uuid,
        published_at = nullif(inverse_detail ->> 'loserPublishedAt', '')::timestamptz
    where id = current_decision.loser_entity_id;
  else
    raise exception using errcode = '23514', message = 'unknown SAME inverse type';
  end if;

  -- The inverse above deliberately completes before the replacement OPEN is appended.
  select * into evidence from app.build_duplicate_review_evidence(
    candidate.id, candidate.record_a_id, candidate.record_b_id
  );
  insert into app.duplicate_candidate_decisions (
    id, duplicate_candidate_id, decision, operation_type, reviewer,
    evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
    supersedes_decision_id, resolution_detail, note
  ) values (
    next_id, candidate.id, 'OPEN', 'OPEN_REVIEW', btrim(p_reviewer),
    evidence.evidence_version_ids, evidence.evidence_parse_attempt_ids, evidence.evidence_hash,
    current_decision.id,
    jsonb_build_object('reversalOf', current_decision.id, 'inverseExecuted', true), p_note
  );
  select canonical_entity_id into entity_a from app.source_records where id = candidate.record_a_id;
  select canonical_entity_id into entity_b from app.source_records where id = candidate.record_b_id;
  update app.duplicate_candidates
  set entity_a_id = entity_a, entity_b_id = entity_b,
      evidence_summary = evidence.evidence_summary, evidence_hash = evidence.evidence_hash,
      status = 'OPEN', current_decision_id = next_id
  where id = candidate.id;
  return next_id;
end;
$$;

revoke execute on function app.build_duplicate_review_evidence(uuid, uuid, uuid)
from public, anon, authenticated, service_role;
revoke execute on function app.create_duplicate_candidate(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke execute on function app.generate_duplicate_candidates(integer)
from public, anon, authenticated, service_role;
revoke execute on function app.reopen_duplicate_candidate(uuid, uuid, text, text)
from public, anon, authenticated, service_role;
revoke execute on function app.finalize_duplicate_candidate(
  uuid, uuid, app.duplicate_decision, text, uuid, uuid, uuid, text
) from public, anon, authenticated, service_role;
revoke execute on function app.reverse_duplicate_same(uuid, uuid, text, text)
from public, anon, authenticated, service_role;

grant execute on function app.create_duplicate_candidate(uuid, uuid, text)
to lemon_ingestion, lemon_reviewer;
grant execute on function app.generate_duplicate_candidates(integer)
to lemon_ingestion, lemon_reviewer;
grant execute on function app.reopen_duplicate_candidate(uuid, uuid, text, text)
to lemon_reviewer;
grant execute on function app.finalize_duplicate_candidate(
  uuid, uuid, app.duplicate_decision, text, uuid, uuid, uuid, text
) to lemon_reviewer;
grant execute on function app.reverse_duplicate_same(uuid, uuid, text, text)
to lemon_reviewer;
