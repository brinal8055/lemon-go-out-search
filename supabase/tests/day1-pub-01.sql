begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(23);

grant lemon_ingestion to postgres with set true;

create function pg_temp.make_day1_place(
  fixture_key text,
  longitude double precision default 14.1570439,
  latitude double precision default 57.7793606,
  place_state app.place_status default 'UNKNOWN'
)
returns jsonb
language plpgsql
as $$
declare
  run_id uuid := gen_random_uuid();
  record_id uuid := gen_random_uuid();
  version_id uuid := gen_random_uuid();
  attempt_id uuid := gen_random_uuid();
  entity_id uuid := gen_random_uuid();
  selected_source_id uuid;
  selected_scope_id uuid;
  selected_boundary_id uuid;
begin
  select source.id into selected_source_id
  from app.sources as source where source.key = 'OSM_OVERPASS';
  select scope.id into selected_scope_id
  from app.geographic_scopes as scope
  where slug = 'jonkoping-municipality' and is_active;
  select boundary.id into selected_boundary_id
  from app.geographic_scope_boundaries as boundary
  where boundary.scope_id = selected_scope_id and boundary.is_active;

  insert into app.ingestion_runs (
    id, idempotency_key, source_id, scope_id, adapter_version,
    parser_version, mapping_version
  ) values (
    run_id, 'day1-pub-01-' || fixture_key, selected_source_id, selected_scope_id,
    'osm-overpass-v1', 'osm-place-parser-v1', 'osm-no-taxonomy-map-v1'
  );

  insert into app.source_records (
    id, source_id, external_key, canonical_url, first_seen_at, last_seen_at
  ) values (
    record_id, selected_source_id, 'node/' || fixture_key,
    'https://www.openstreetmap.org/node/' || fixture_key, now(), now()
  );

  insert into app.source_record_versions (
    id, source_record_id, capture_run_id, content_hash, payload,
    payload_storage_mode, source_url, fetched_at, observed_at
  ) values (
    version_id, record_id, run_id,
    encode(digest('version-' || fixture_key, 'sha256'), 'hex'),
    jsonb_build_object(
      'elementType', 'node',
      'elementId', fixture_key::bigint,
      'location', jsonb_build_object('latitude', latitude, 'longitude', longitude),
      'tags', jsonb_build_object('name', 'DAY1 ' || fixture_key, 'amenity', 'restaurant'),
      'osmUrl', 'https://www.openstreetmap.org/node/' || fixture_key
    ),
    'EXTRACTED_ENVELOPE',
    'https://www.openstreetmap.org/node/' || fixture_key,
    now(), now()
  );

  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (
    attempt_id, version_id, run_id, 'osm-place-parser-v1'
  );
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED',
      finished_at = now(),
      normalized_output = jsonb_build_object(
      'entityType', 'PLACE',
      'externalKey', 'node/' || fixture_key,
      'sourceCategories', jsonb_build_array('amenity=restaurant')
      ),
      normalized_output_hash = encode(digest('output-' || fixture_key, 'sha256'), 'hex')
  where id = attempt_id;

  perform app.select_source_record_current_evidence(
    record_id, version_id, attempt_id, run_id, 'osm-place-parser-v1', null, null
  );

  update app.ingestion_runs
  set status = 'SUCCEEDED', finished_at = now(), refresh_unit_complete = true,
      fetched = 1, valid = 1, new_count = 1
  where id = run_id;

  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    scope_id, scope_boundary_id
  ) values (
    entity_id, 'PLACE', 'DAY1 ' || fixture_key, 'day1 ' || fixture_key,
    'day1 ' || fixture_key, selected_scope_id, selected_boundary_id
  );

  insert into app.places (entity_id, location, status)
  values (
    entity_id,
    st_setsrid(st_makepoint(longitude, latitude), 4326)::extensions.geography,
    place_state
  );

  update app.source_records
  set canonical_entity_id = entity_id, resolution_method = 'NEW_CANONICAL'
  where id = record_id;

  return jsonb_build_object(
    'run', run_id,
    'record', record_id,
    'version', version_id,
    'attempt', attempt_id,
    'entity', entity_id,
    'scope', selected_scope_id,
    'boundary', selected_boundary_id,
    'documentHash', encode(digest('document-' || fixture_key, 'sha256'), 'hex')
  );
end;
$$;

create function pg_temp.add_day1_requirements(
  fixture jsonb,
  add_taxonomy boolean default true,
  add_provenance boolean default true,
  add_document boolean default true
)
returns void
language plpgsql
as $$
declare
  taxonomy_id uuid;
  entity_name text;
begin
  select id into taxonomy_id from app.taxonomy_nodes
  where taxonomy_version = 'active-going-out.v1' and slug = 'dining' and active;
  select canonical_name into entity_name from app.canonical_entities
  where id = (fixture->>'entity')::uuid;

  if add_taxonomy then
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, source_record_version_id, mapping_ref
    ) values (
      (fixture->>'entity')::uuid, taxonomy_id, 'DETERMINISTIC_MAP',
      (fixture->>'version')::uuid,
      'day1-pub-01:osm:amenity=restaurant->dining:v1'
    );
  end if;

  if add_provenance then
    insert into app.canonical_fact_provenance (
      entity_id, fact_key, source_record_version_id,
      selection_method, created_by
    ) values
      ((fixture->>'entity')::uuid, 'canonical_name', (fixture->>'version')::uuid,
       'SOURCE_PRECEDENCE', 'DAY1-PUB-01-TEST'),
      ((fixture->>'entity')::uuid, 'location', (fixture->>'version')::uuid,
       'SOURCE_PRECEDENCE', 'DAY1-PUB-01-TEST');
  end if;

  if add_document then
    insert into app.search_documents (
      entity_id, document_version, template_version, content_hash,
      display_name, names_text, aliases_text, taxonomy_en_text,
      taxonomy_sv_text, facts_text, description_text, event_context_text,
      embedding_text, fts, generated_at
    ) values (
      (fixture->>'entity')::uuid, 'day1-test-v1', 'day1-first-place-v1',
      fixture->>'documentHash', entity_name, entity_name, '', 'Dining',
      'Restauranger', 'amenity=restaurant', '', '',
      entity_name || E'\nDining\nRestauranger\namenity=restaurant',
      to_tsvector('simple', entity_name || ' Dining Restauranger amenity restaurant'),
      now()
    );
  end if;
end;
$$;

select ok(
  to_regprocedure('app.publish_place_from_current_evidence(uuid,uuid,uuid,uuid,text,text)') is not null,
  'private first-place publication transaction exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'app.publish_place_from_current_evidence(uuid,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app.publish_place_from_current_evidence(uuid,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'service_role',
    'app.publish_place_from_current_evidence(uuid,uuid,uuid,uuid,text,text)',
    'EXECUTE'
  ),
  'publication transaction remains private'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'api'),
  0::bigint,
  'DAY1-PUB-01 exposes no Data API function'
);

create temporary table day1_fixtures (key text primary key, value jsonb);

insert into day1_fixtures values ('happy', pg_temp.make_day1_place('910000000001'));
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'happy'));
select lives_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'happy'),
    (select value->>'record' from day1_fixtures where key = 'happy'),
    (select value->>'version' from day1_fixtures where key = 'happy'),
    (select value->>'attempt' from day1_fixtures where key = 'happy'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'happy')
  ),
  'complete current evidence and publication truth transitions DRAFT to PUBLISHED'
);
select is(
  (select publication_status::text from app.canonical_entities
   where id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  'PUBLISHED',
  'happy-path Place is published'
);

insert into day1_fixtures values ('no-document', pg_temp.make_day1_place('910000000002'));
select pg_temp.add_day1_requirements(
  (select value from day1_fixtures where key = 'no-document'), true, true, false
);
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'no-document'),
    (select value->>'record' from day1_fixtures where key = 'no-document'),
    (select value->>'version' from day1_fixtures where key = 'no-document'),
    (select value->>'attempt' from day1_fixtures where key = 'no-document'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'no-document')
  ),
  '23514', 'publication requires the active deterministic SearchDocument',
  'missing SearchDocument blocks publication'
);
select is(
  (select publication_status::text from app.canonical_entities
   where id = (select (value->>'entity')::uuid from day1_fixtures where key = 'no-document')),
  'DRAFT',
  'failed document validation leaves publication state unchanged'
);

insert into day1_fixtures values ('no-taxonomy', pg_temp.make_day1_place('910000000003'));
select pg_temp.add_day1_requirements(
  (select value from day1_fixtures where key = 'no-taxonomy'), false, true, true
);
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'no-taxonomy'),
    (select value->>'record' from day1_fixtures where key = 'no-taxonomy'),
    (select value->>'version' from day1_fixtures where key = 'no-taxonomy'),
    (select value->>'attempt' from day1_fixtures where key = 'no-taxonomy'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'no-taxonomy')
  ),
  '23514', 'publication requires active source-evidenced taxonomy truth',
  'missing taxonomy evidence blocks publication'
);

insert into day1_fixtures values ('no-provenance', pg_temp.make_day1_place('910000000004'));
select pg_temp.add_day1_requirements(
  (select value from day1_fixtures where key = 'no-provenance'), true, false, true
);
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'no-provenance'),
    (select value->>'record' from day1_fixtures where key = 'no-provenance'),
    (select value->>'version' from day1_fixtures where key = 'no-provenance'),
    (select value->>'attempt' from day1_fixtures where key = 'no-provenance'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'no-provenance')
  ),
  '23514', 'publication requires current canonical-name and location provenance',
  'missing targeted provenance blocks publication'
);

insert into day1_fixtures values (
  'outside', pg_temp.make_day1_place('910000000005', 18.0686, 59.3293)
);
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'outside'));
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'outside'),
    (select value->>'record' from day1_fixtures where key = 'outside'),
    (select value->>'version' from day1_fixtures where key = 'outside'),
    (select value->>'attempt' from day1_fixtures where key = 'outside'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'outside')
  ),
  '23514', 'publication requires an active scope and covered active boundary',
  'out-of-scope point blocks publication'
);

insert into day1_fixtures values (
  'closed', pg_temp.make_day1_place('910000000006', 14.1570439, 57.7793606, 'CLOSED')
);
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'closed'));
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'closed'),
    (select value->>'record' from day1_fixtures where key = 'closed'),
    (select value->>'version' from day1_fixtures where key = 'closed'),
    (select value->>'attempt' from day1_fixtures where key = 'closed'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'closed')
  ),
  '23514', 'entity is not an eligible publishable Place',
  'CLOSED Place blocks publication'
);

insert into day1_fixtures values ('stale', pg_temp.make_day1_place('910000000007'));
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'stale'));
do $$
declare
  fixture jsonb := (select value from day1_fixtures where key = 'stale');
  next_run uuid := gen_random_uuid();
  next_attempt uuid := gen_random_uuid();
  selected_source_id uuid;
  selected_scope_id uuid;
begin
  select record.source_id into selected_source_id
  from app.source_records as record where record.id = (fixture->>'record')::uuid;
  select canonical.scope_id into selected_scope_id
  from app.canonical_entities as canonical where canonical.id = (fixture->>'entity')::uuid;
  insert into app.ingestion_runs (
    id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version
  ) values (
    next_run, 'day1-pub-01-stale-replay', selected_source_id, selected_scope_id,
    'osm-overpass-v1', 'osm-place-parser-v2', 'osm-no-taxonomy-map-v1'
  );
  insert into app.source_record_parse_attempts (
    id, source_record_version_id, ingestion_run_id, parser_version
  ) values (
    next_attempt, (fixture->>'version')::uuid, next_run, 'osm-place-parser-v2'
  );
  update app.source_record_parse_attempts
  set status = 'SUCCEEDED', finished_at = now(),
      normalized_output = '{"entityType":"PLACE","replay":true}',
      normalized_output_hash = repeat('a', 64)
  where id = next_attempt;
  perform app.select_source_record_current_evidence(
    (fixture->>'record')::uuid, (fixture->>'version')::uuid, next_attempt,
    next_run, 'osm-place-parser-v2', (fixture->>'version')::uuid, (fixture->>'attempt')::uuid
  );
  update app.ingestion_runs
  set status = 'SUCCEEDED', finished_at = now(), refresh_unit_complete = true,
      fetched = 1, valid = 1, unchanged = 1
  where id = next_run;
end;
$$;
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'stale'),
    (select value->>'record' from day1_fixtures where key = 'stale'),
    (select value->>'version' from day1_fixtures where key = 'stale'),
    (select value->>'attempt' from day1_fixtures where key = 'stale'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'stale')
  ),
  '40001', 'stale source-current evidence processing',
  'stale H+A blocks publication'
);

insert into day1_fixtures values ('merged', pg_temp.make_day1_place('910000000008'));
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'merged'));
do $$
declare
  fixture jsonb := (select value from day1_fixtures where key = 'merged');
  survivor_id uuid := gen_random_uuid();
begin
  insert into app.canonical_entities (
    id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
    scope_id, scope_boundary_id
  ) values (
    survivor_id, 'PLACE', 'DAY1 survivor', 'day1 survivor', 'day1 survivor',
    (fixture->>'scope')::uuid, (fixture->>'boundary')::uuid
  );
  insert into app.places (entity_id, location)
  values (survivor_id, st_setsrid(st_makepoint(14.1570439, 57.7793606), 4326)::extensions.geography);
  update app.canonical_entities
  set publication_status = 'MERGED', merged_into_id = survivor_id
  where id = (fixture->>'entity')::uuid;
end;
$$;
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'merged'),
    (select value->>'record' from day1_fixtures where key = 'merged'),
    (select value->>'version' from day1_fixtures where key = 'merged'),
    (select value->>'attempt' from day1_fixtures where key = 'merged'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'merged')
  ),
  '23514', 'entity is not an eligible publishable Place',
  'MERGED entity blocks publication'
);

insert into day1_fixtures values ('inactive-document', pg_temp.make_day1_place('910000000009'));
select pg_temp.add_day1_requirements((select value from day1_fixtures where key = 'inactive-document'));
update app.search_documents set is_active = false
where entity_id = (select (value->>'entity')::uuid from day1_fixtures where key = 'inactive-document');
select throws_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'inactive-document'),
    (select value->>'record' from day1_fixtures where key = 'inactive-document'),
    (select value->>'version' from day1_fixtures where key = 'inactive-document'),
    (select value->>'attempt' from day1_fixtures where key = 'inactive-document'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'inactive-document')
  ),
  '23514', 'publication requires the active deterministic SearchDocument',
  'inactive SearchDocument cannot satisfy publication'
);

select lives_ok(
  format(
    'select app.publish_place_from_current_evidence(%L,%L,%L,%L,%L,%L)',
    (select value->>'entity' from day1_fixtures where key = 'happy'),
    (select value->>'record' from day1_fixtures where key = 'happy'),
    (select value->>'version' from day1_fixtures where key = 'happy'),
    (select value->>'attempt' from day1_fixtures where key = 'happy'),
    'day1-first-place-v1',
    (select value->>'documentHash' from day1_fixtures where key = 'happy')
  ),
  'repeating publication is idempotent'
);
select is(
  (select count(*) from app.entity_taxonomy_memberships
   where entity_id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  1::bigint,
  'idempotent publication retains one taxonomy membership'
);
select is(
  (select count(*) from app.canonical_fact_provenance
   where entity_id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  2::bigint,
  'idempotent publication retains two targeted provenance selections'
);
select is(
  (select count(*) from app.search_documents
   where entity_id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  1::bigint,
  'idempotent publication retains one deterministic SearchDocument'
);
select is(
  (select count(*) from app.canonical_entities
   where id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  1::bigint,
  'idempotent publication retains one canonical entity'
);
select is(
  (select publication_status::text from app.canonical_entities
   where id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  'PUBLISHED',
  'idempotent publication remains PUBLISHED'
);
select ok(
  (select record.current_version_id = (fixture.value->>'version')::uuid
          and record.current_parse_attempt_id = (fixture.value->>'attempt')::uuid
   from day1_fixtures as fixture
   join app.source_records as record on record.id = (fixture.value->>'record')::uuid
   where fixture.key = 'happy'),
  'publication preserves the exact selected H+A pair'
);
select is(
  (select count(*) from app.embeddings
   where entity_id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  0::bigint,
  'embedding is optional for deterministic publication'
);
select ok(
  (select st_covers(boundary.boundary, place.location::extensions.geometry)
   from app.canonical_entities canonical
   join app.places place on place.entity_id = canonical.id
   join app.geographic_scope_boundaries boundary on boundary.id = canonical.scope_boundary_id
   where canonical.id = (select (value->>'entity')::uuid from day1_fixtures where key = 'happy')),
  'published Place is covered by its exact active boundary'
);

select * from finish();
rollback;
