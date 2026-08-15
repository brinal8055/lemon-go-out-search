begin;

create extension if not exists pgtap with schema extensions;
set search_path = extensions, public;

select plan(87);

select has_table('app', 'canonical_entities', 'canonical entities table exists');
select has_table('app', 'places', 'places table exists');
select has_table('app', 'events', 'events table exists');
select has_table('app', 'canonical_fact_provenance', 'targeted provenance table exists');
select has_table('app', 'entity_aliases', 'entity aliases table exists');
select has_table('app', 'duplicate_candidates', 'duplicate candidates table exists');
select has_table('app', 'duplicate_candidate_decisions', 'duplicate decisions table exists');
select has_table('app', 'taxonomy_nodes', 'taxonomy nodes table exists');
select has_table('app', 'taxonomy_aliases', 'taxonomy aliases table exists');
select has_table('app', 'entity_taxonomy_memberships', 'taxonomy memberships table exists');

select enum_has_labels(
  'app', 'entity_type', array['PLACE', 'EVENT'],
  'canonical entity types remain exactly Place and Event'
);
select enum_has_labels(
  'app', 'taxonomy_membership_method',
  array['SOURCE_FACT', 'DETERMINISTIC_MAP', 'MANUAL'],
  'taxonomy truth methods exclude generated or AI methods'
);
select enum_has_labels(
  'app', 'fact_key',
  array[
    'canonical_name', 'location', 'address', 'opening_hours',
    'event_start', 'event_end', 'event_status'
  ],
  'targeted provenance fact vocabulary is frozen'
);
select has_fk(
  'app', 'source_records',
  'source records now retain canonical entity ownership through an FK'
);

insert into app.geographic_scopes (
  id, slug, name_en, name_sv, timezone, country_code
) values (
  '10000000-0000-0000-0000-000000000001',
  'db-01b-scope',
  'DB-01B scope',
  'DB-01B område',
  'Europe/Stockholm',
  'SE'
);

insert into app.geographic_scopes (
  id, slug, name_en, name_sv, timezone, country_code
) values (
  '10000000-0000-0000-0000-000000000002',
  'db-01b-other-scope',
  'Other scope',
  'Annat område',
  'Europe/Stockholm',
  'SE'
);

insert into app.geographic_scope_boundaries (
  id, scope_id, version, boundary, source_name, source_url,
  licence, attribution, source_checksum, effective_from, is_active
) values (
  '10000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000001',
  'db-01b-v1',
  extensions.st_multi(extensions.st_geomfromtext(
    'POLYGON((14 57, 15 57, 15 58, 14 58, 14 57))', 4326
  )),
  'DB-01B test boundary',
  'https://example.invalid/db-01b-boundary',
  'Test only',
  'Test only',
  repeat('1', 64),
  '2026-08-13 00:00:00+00',
  true
);

insert into app.sources (
  id, key, name, kind, licence, attribution,
  persistence_permission, refresh_mode, adapter_version
) values (
  '10000000-0000-0000-0000-000000000101',
  'db-01b-source',
  'DB-01B source',
  'MANUAL',
  'Test only',
  'Test only',
  'FULL_PAYLOAD',
  'DELTA_ONLY',
  'adapter-v1'
);

insert into app.ingestion_runs (
  id, idempotency_key, source_id, scope_id,
  adapter_version, parser_version, mapping_version
) values
  (
    '10000000-0000-0000-0000-000000000201',
    'db-01b-run-v1',
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v1', 'mapping-v1'
  ),
  (
    '10000000-0000-0000-0000-000000000202',
    'db-01b-run-v2',
    '10000000-0000-0000-0000-000000000101',
    '10000000-0000-0000-0000-000000000001',
    'adapter-v1', 'parser-v2', 'mapping-v1'
  );

insert into app.source_records (
  id, source_id, external_key, first_seen_at, last_seen_at
) values
  (
    '10000000-0000-0000-0000-000000000301',
    '10000000-0000-0000-0000-000000000101',
    'record-a', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000302',
    '10000000-0000-0000-0000-000000000101',
    'record-b', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000303',
    '10000000-0000-0000-0000-000000000101',
    'record-event', now(), now()
  );

insert into app.source_record_versions (
  id, source_record_id, capture_run_id, content_hash, payload,
  payload_storage_mode, fetched_at, observed_at
) values
  (
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000301',
    '10000000-0000-0000-0000-000000000201',
    repeat('a', 64), '{"name":"Record A"}', 'FULL_PAYLOAD', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000402',
    '10000000-0000-0000-0000-000000000302',
    '10000000-0000-0000-0000-000000000201',
    repeat('b', 64), '{"name":"Record B"}', 'FULL_PAYLOAD', now(), now()
  ),
  (
    '10000000-0000-0000-0000-000000000403',
    '10000000-0000-0000-0000-000000000303',
    '10000000-0000-0000-0000-000000000201',
    repeat('c', 64), '{"name":"Event"}', 'FULL_PAYLOAD', now(), now()
  );

insert into app.source_record_parse_attempts (
  id, source_record_version_id, ingestion_run_id, parser_version
) values
  (
    '10000000-0000-0000-0000-000000000501',
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000201',
    'parser-v1'
  ),
  (
    '10000000-0000-0000-0000-000000000502',
    '10000000-0000-0000-0000-000000000401',
    '10000000-0000-0000-0000-000000000202',
    'parser-v2'
  ),
  (
    '10000000-0000-0000-0000-000000000503',
    '10000000-0000-0000-0000-000000000402',
    '10000000-0000-0000-0000-000000000201',
    'parser-v1'
  ),
  (
    '10000000-0000-0000-0000-000000000504',
    '10000000-0000-0000-0000-000000000403',
    '10000000-0000-0000-0000-000000000201',
    'parser-v1'
  );

update app.source_record_parse_attempts
set status = 'SUCCEEDED',
    finished_at = now(),
    normalized_output = jsonb_build_object('attempt', id),
    normalized_output_hash = repeat(substr(id::text, 1, 1), 64)
where id in (
  '10000000-0000-0000-0000-000000000501',
  '10000000-0000-0000-0000-000000000502',
  '10000000-0000-0000-0000-000000000503',
  '10000000-0000-0000-0000-000000000504'
);

insert into app.source_record_parse_attempts (
  id, source_record_version_id, ingestion_run_id, parser_version
) values (
  '10000000-0000-0000-0000-000000000505',
  '10000000-0000-0000-0000-000000000402',
  '10000000-0000-0000-0000-000000000202',
  'parser-v2'
);

update app.source_record_parse_attempts
set status = 'FAILED', finished_at = now(),
    error_class = 'VALIDATION', error_code = 'TEST_FAILURE'
where id = '10000000-0000-0000-0000-000000000505';

set constraints all deferred;

insert into app.canonical_entities (
  id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
  publication_status, scope_id, scope_boundary_id, published_at
) values
  (
    '10000000-0000-0000-0000-000000000601',
    'PLACE', 'Shared Name', 'shared name', 'shared name',
    'PUBLISHED',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000602',
    'PLACE', 'Shared Name', 'shared name', 'shared name',
    'PUBLISHED',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000603',
    'EVENT', 'Point Event', 'point event', 'point event',
    'PUBLISHED',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000604',
    'PLACE', 'Merge survivor', 'merge survivor', 'merge survivor',
    'DRAFT',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000011',
    null
  );

update app.source_records
set canonical_entity_id = case id
  when '10000000-0000-0000-0000-000000000301' then '10000000-0000-0000-0000-000000000601'::uuid
  when '10000000-0000-0000-0000-000000000302' then '10000000-0000-0000-0000-000000000602'::uuid
  when '10000000-0000-0000-0000-000000000303' then '10000000-0000-0000-0000-000000000603'::uuid
end
where id in (
  '10000000-0000-0000-0000-000000000301',
  '10000000-0000-0000-0000-000000000302',
  '10000000-0000-0000-0000-000000000303'
);

insert into app.places (entity_id, location, status) values
  (
    '10000000-0000-0000-0000-000000000601',
    extensions.st_geogfromtext('SRID=4326;POINT(14.4 57.7)'),
    'ACTIVE'
  ),
  (
    '10000000-0000-0000-0000-000000000602',
    extensions.st_geogfromtext('SRID=4326;POINT(14.5 57.7)'),
    'ACTIVE'
  ),
  (
    '10000000-0000-0000-0000-000000000604',
    extensions.st_geogfromtext('SRID=4326;POINT(14.6 57.7)'),
    'UNKNOWN'
  );

insert into app.events (
  entity_id, standalone_venue_name, location, starts_at, ends_at,
  source_timezone, status, status_observed_at,
  event_start_source_record_id, event_status_source_record_id
) values (
  '10000000-0000-0000-0000-000000000603',
  'Standalone venue',
  extensions.st_geogfromtext('SRID=4326;POINT(14.45 57.75)'),
  '2026-08-14 18:00:00+00',
  null,
  'Europe/Stockholm',
  'SCHEDULED',
  now(),
  '10000000-0000-0000-0000-000000000303',
  '10000000-0000-0000-0000-000000000303'
);

set constraints all immediate;

select is(
  (select count(*) from app.canonical_entities where canonical_name = 'Shared Name'),
  2::bigint,
  'legitimate same canonical names are allowed'
);
select is(
  (select count(*) from app.places where entity_id in (
    '10000000-0000-0000-0000-000000000601',
    '10000000-0000-0000-0000-000000000602'
  )),
  2::bigint,
  'valid PLACE canonical entities have Place subtypes'
);
select is(
  (select count(*) from app.events where entity_id = '10000000-0000-0000-0000-000000000603'),
  1::bigint,
  'valid EVENT canonical entity has an Event subtype'
);

select throws_ok(
  $$
    update app.canonical_entities
    set entity_type = 'EVENT'
    where id = '10000000-0000-0000-0000-000000000601'
  $$,
  '55000',
  'canonical entity type is immutable',
  'entity type cannot change'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.canonical_entities (
      id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii
    ) values (
      '10000000-0000-0000-0000-000000000605',
      'PLACE', 'Missing subtype', 'missing subtype', 'missing subtype'
    );
    set constraints all immediate
  $$,
  '23514',
  'canonical entity must have exactly one matching subtype',
  'canonical entity cannot commit without its matching subtype'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.canonical_entities (
      id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii
    ) values (
      '10000000-0000-0000-0000-000000000606',
      'PLACE', 'Wrong subtype', 'wrong subtype', 'wrong subtype'
    );
    insert into app.source_records (
      id, source_id, external_key, canonical_entity_id, first_seen_at, last_seen_at
    ) values (
      '10000000-0000-0000-0000-000000000304',
      '10000000-0000-0000-0000-000000000101',
      'cross-subtype-event',
      '10000000-0000-0000-0000-000000000606',
      now(), now()
    );
    insert into app.events (
      entity_id, standalone_venue_name, location, starts_at, source_timezone,
      status_observed_at, event_start_source_record_id, event_status_source_record_id
    ) values (
      '10000000-0000-0000-0000-000000000606',
      'Wrong subtype venue',
      extensions.st_geogfromtext('SRID=4326;POINT(14.4 57.7)'),
      now() + interval '1 day', 'Europe/Stockholm', now(),
      '10000000-0000-0000-0000-000000000304',
      '10000000-0000-0000-0000-000000000304'
    );
    set constraints all immediate
  $$,
  '23514',
  'canonical entity must have exactly one matching subtype',
  'PLACE canonical cannot carry an Event subtype'
);

select throws_ok(
  $$
    update app.canonical_entities
    set publication_status = 'MERGED',
        merged_into_id = id
    where id = '10000000-0000-0000-0000-000000000601'
  $$,
  '23514',
  null,
  'self merge is rejected'
);

select throws_ok(
  $$
    update app.canonical_entities
    set publication_status = 'MERGED',
        merged_into_id = '10000000-0000-0000-0000-000000000601'
    where id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23514',
  'merged canonical entity must target a compatible non-merged survivor without a cycle',
  'Event cannot merge into a Place target'
);

select throws_ok(
  $$
    set constraints all deferred;
    update app.canonical_entities
    set publication_status = 'MERGED',
        merged_into_id = '10000000-0000-0000-0000-000000000604'
    where id = '10000000-0000-0000-0000-000000000602';
    update app.canonical_entities
    set publication_status = 'MERGED',
        merged_into_id = '10000000-0000-0000-0000-000000000602'
    where id = '10000000-0000-0000-0000-000000000604';
    set constraints all immediate
  $$,
  '23514',
  'merged canonical entity must target a compatible non-merged survivor without a cycle',
  'merge cycles and merged targets are rejected'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.canonical_entities (
      id, entity_type, canonical_name, canonical_name_norm, canonical_name_ascii,
      publication_status, published_at
    ) values (
      '10000000-0000-0000-0000-000000000607',
      'PLACE', 'Malformed published', 'malformed published', 'malformed published',
      'PUBLISHED', now()
    )
  $$,
  '23514',
  null,
  'published entity requires scope and boundary identifiers'
);

select lives_ok(
  $$
    update app.places
    set opening_hours = '{"monday":[]}'::jsonb
    where entity_id = '10000000-0000-0000-0000-000000000601'
  $$,
  'opening hours JSON object is accepted'
);
select throws_ok(
  $$
    update app.places
    set location = null
    where entity_id = '10000000-0000-0000-0000-000000000601'
  $$,
  '23514',
  'published canonical entity requires an active assigned boundary and covered location',
  'published Place requires a location'
);
select throws_ok(
  $$
    update app.places
    set status = 'CLOSED'
    where entity_id = '10000000-0000-0000-0000-000000000601'
  $$,
  '23514',
  'published Place must be eligible',
  'CLOSED Place cannot remain published'
);
select throws_ok(
  $$
    update app.canonical_entities
    set scope_id = '10000000-0000-0000-0000-000000000002'
    where id = '10000000-0000-0000-0000-000000000604'
  $$,
  '23503',
  null,
  'scope boundary must belong to the assigned scope'
);
select throws_ok(
  $$
    update app.places
    set opening_hours = '[]'::jsonb
    where entity_id = '10000000-0000-0000-0000-000000000601'
  $$,
  '23514',
  null,
  'opening hours must be a JSON object'
);

select lives_ok(
  $$
    update app.events
    set ends_at = starts_at + interval '2 hours',
        event_end_source_record_id = event_start_source_record_id
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  'Event end strictly after start is accepted'
);
select throws_ok(
  $$
    update app.events
    set ends_at = starts_at,
        event_end_source_record_id = event_start_source_record_id
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23514',
  null,
  'zero-duration Event is rejected'
);
select throws_ok(
  $$
    update app.events
    set ends_at = starts_at - interval '1 minute',
        event_end_source_record_id = event_start_source_record_id
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23514',
  null,
  'Event ending before start is rejected'
);
select throws_ok(
  $$
    update app.events
    set ends_at = starts_at + interval '1 hour',
        event_end_source_record_id = null
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23514',
  null,
  'Event end evidence is required when an end exists'
);
select lives_ok(
  $$
    update app.events
    set ends_at = null,
        event_end_source_record_id = null
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  'point Event with no invented duration is accepted'
);
select throws_ok(
  $$
    update app.events
    set venue_place_id = '10000000-0000-0000-0000-000000000603'
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23503',
  null,
  'Event venue cannot target an Event subtype'
);
select throws_ok(
  $$
    update app.events
    set venue_place_id = null,
        standalone_venue_name = null,
        location = null
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  '23514',
  null,
  'Event without linked or standalone location evidence is rejected'
);
select throws_ok(
  $$
    update app.source_records
    set canonical_entity_id = '10000000-0000-0000-0000-000000000601'
    where id = '10000000-0000-0000-0000-000000000303'
  $$,
  '23514',
  'Event evidence records must resolve to the Event canonical entity',
  'later source-record relinking cannot invalidate Event evidence ownership'
);
select lives_ok(
  $$
    update app.events
    set venue_place_id = '10000000-0000-0000-0000-000000000604'
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  'Event may link to a located Place in the same scope'
);
select throws_ok(
  $$
    update app.canonical_entities
    set scope_id = '10000000-0000-0000-0000-000000000002',
        scope_boundary_id = null
    where id = '10000000-0000-0000-0000-000000000604'
  $$,
  '23514',
  'Event venue must be a located Place in the same scope',
  'later venue scope mutation cannot invalidate linked Event scope'
);
select throws_ok(
  $$
    update app.places
    set location = null
    where entity_id = '10000000-0000-0000-0000-000000000604'
  $$,
  '23514',
  'Event venue must be a located Place in the same scope',
  'later venue mutation cannot invalidate linked Event location'
);
select lives_ok(
  $$
    update app.events
    set venue_place_id = null
    where entity_id = '10000000-0000-0000-0000-000000000603'
  $$,
  'linked Event can return to its sufficient standalone venue and point'
);
select throws_ok(
  $$
    update app.geographic_scope_boundaries
    set is_active = false
    where id = '10000000-0000-0000-0000-000000000011'
  $$,
  '23514',
  'inactive boundary cannot remain assigned to a published canonical entity',
  'active boundary cannot be removed beneath published entities'
);

insert into app.canonical_fact_provenance (
  id, entity_id, fact_key, source_record_version_id,
  selection_method, created_by
) values (
  '10000000-0000-0000-0000-000000000801',
  '10000000-0000-0000-0000-000000000601',
  'canonical_name',
  '10000000-0000-0000-0000-000000000401',
  'SOURCE_PRECEDENCE',
  'DB-01B TEST'
);

select throws_ok(
  $$
    insert into app.canonical_fact_provenance (
      entity_id, fact_key, source_record_version_id, selection_method, created_by
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'canonical_name',
      '10000000-0000-0000-0000-000000000401',
      'MANUAL',
      'DB-01B TEST'
    )
  $$,
  '23505',
  null,
  'only one current singular fact selection is allowed'
);

select throws_ok(
  $$
    update app.canonical_fact_provenance
    set is_current = false, superseded_at = now()
    where id = '10000000-0000-0000-0000-000000000801'
  $$,
  '23514',
  'visible targeted fact must retain exactly one current provenance selection',
  'provenance history cannot commit without a current selection'
);

select lives_ok(
  $$
    set constraints all deferred;
    update app.canonical_fact_provenance
    set is_current = false, superseded_at = now()
    where id = '10000000-0000-0000-0000-000000000801';
    insert into app.canonical_fact_provenance (
      id, entity_id, fact_key, source_record_version_id,
      selection_method, created_by
    ) values (
      '10000000-0000-0000-0000-000000000802',
      '10000000-0000-0000-0000-000000000601',
      'canonical_name',
      '10000000-0000-0000-0000-000000000401',
      'MANUAL',
      'DB-01B TEST'
    );
    set constraints all immediate
  $$,
  'current provenance can be replaced without destroying history'
);
select is(
  (select count(*) from app.canonical_fact_provenance
   where entity_id = '10000000-0000-0000-0000-000000000601'
     and fact_key = 'canonical_name'),
  2::bigint,
  'historical provenance rows coexist'
);
select throws_ok(
  $$
    insert into app.canonical_fact_provenance (
      entity_id, fact_key, source_record_version_id, selection_method, created_by
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'unsupported_fact',
      '10000000-0000-0000-0000-000000000401',
      'MANUAL',
      'DB-01B TEST'
    )
  $$,
  '22P02',
  null,
  'unsupported provenance fact key is rejected'
);

select lives_ok(
  $$
    insert into app.entity_aliases (
      id, entity_id, alias, alias_norm, alias_ascii, language, kind,
      source_record_version_id
    ) values (
      '10000000-0000-0000-0000-000000000821',
      '10000000-0000-0000-0000-000000000601',
      'Källalias', 'källalias', 'kallalias', 'sv', 'ALTERNATE',
      '10000000-0000-0000-0000-000000000401'
    )
  $$,
  'source-backed alias with evidence is accepted'
);
select lives_ok(
  $$
    insert into app.entity_aliases (
      id, entity_id, alias, alias_norm, alias_ascii, language, kind,
      verified, verified_by, verified_at
    ) values (
      '10000000-0000-0000-0000-000000000822',
      '10000000-0000-0000-0000-000000000601',
      'Manual alias', 'manual alias', 'manual alias', 'en', 'MANUAL',
      true, 'reviewer@example.invalid', now()
    )
  $$,
  'manual verified alias with reviewer is accepted'
);
select throws_ok(
  $$
    insert into app.entity_aliases (
      entity_id, alias, alias_norm, alias_ascii, language, kind,
      source_record_version_id, verified, verified_by
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'Broken verification', 'broken verification', 'broken verification',
      'en', 'ALTERNATE', '10000000-0000-0000-0000-000000000401',
      true, 'reviewer@example.invalid'
    )
  $$,
  '23514',
  null,
  'alias verification fields must be complete'
);
select throws_ok(
  $$
    insert into app.entity_aliases (
      entity_id, alias, alias_norm, alias_ascii, language, kind
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'Unreviewed manual', 'unreviewed manual', 'unreviewed manual', 'en', 'MANUAL'
    )
  $$,
  '23514',
  null,
  'manual alias requires verifier evidence'
);
select throws_ok(
  $$
    insert into app.entity_aliases (
      entity_id, alias, alias_norm, alias_ascii, language, kind
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'Missing source', 'missing source', 'missing source', 'en', 'OFFICIAL'
    )
  $$,
  '23514',
  null,
  'source-backed alias requires source-version evidence'
);
select throws_ok(
  $$
    insert into app.entity_aliases (
      entity_id, alias, alias_norm, alias_ascii, language, kind,
      source_record_version_id
    ) values (
      '10000000-0000-0000-0000-000000000601',
      'KÄLLALIAS', 'källalias', 'kallalias', 'sv', 'ALTERNATE',
      '10000000-0000-0000-0000-000000000401'
    )
  $$,
  '23505',
  null,
  'entity alias normalized-kind uniqueness is enforced'
);

select throws_ok(
  $$
    insert into app.duplicate_candidates (
      record_a_id, record_b_id, evidence_summary, evidence_hash,
      status, current_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000302',
      '10000000-0000-0000-0000-000000000301',
      '{}', repeat('d', 64), 'OPEN', gen_random_uuid()
    )
  $$,
  '23514',
  null,
  'duplicate candidate record ordering is enforced'
);

select lives_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidates (
      id, record_a_id, record_b_id, entity_a_id, entity_b_id,
      evidence_summary, evidence_hash, status, current_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000701',
      '10000000-0000-0000-0000-000000000301',
      '10000000-0000-0000-0000-000000000302',
      '10000000-0000-0000-0000-000000000601',
      '10000000-0000-0000-0000-000000000602',
      '{"reason":"test"}', repeat('d', 64), 'OPEN',
      '10000000-0000-0000-0000-000000000711'
    );
    insert into app.duplicate_candidate_decisions (
      id, duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash
    ) values (
      '10000000-0000-0000-0000-000000000711',
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('d', 64)
    );
    set constraints all immediate
  $$,
  'candidate and initial OPEN decision bootstrap atomically'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidates (
      id, record_a_id, record_b_id, evidence_summary, evidence_hash,
      status, current_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000702',
      '10000000-0000-0000-0000-000000000301',
      '10000000-0000-0000-0000-000000000302',
      '{}', repeat('e', 64), 'OPEN',
      '10000000-0000-0000-0000-000000000712'
    )
  $$,
  '23505',
  null,
  'ordered duplicate candidate pair is unique'
);

select throws_ok(
  $$
    update app.duplicate_candidate_decisions
    set note = 'mutated'
    where id = '10000000-0000-0000-0000-000000000711'
  $$,
  '55000',
  'duplicate candidate decisions are append-only',
  'duplicate decisions cannot be updated'
);
select throws_ok(
  $$
    delete from app.duplicate_candidate_decisions
    where id = '10000000-0000-0000-0000-000000000711'
  $$,
  '55000',
  'duplicate candidate decisions are append-only',
  'duplicate decisions cannot be deleted'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidate_decisions (
      id, duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000714',
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array['10000000-0000-0000-0000-000000000401'::uuid],
      array['10000000-0000-0000-0000-000000000501'::uuid],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711'
    );
    update app.duplicate_candidates
    set current_decision_id = '10000000-0000-0000-0000-000000000714',
        evidence_hash = repeat('e', 64)
    where id = '10000000-0000-0000-0000-000000000701';
    set constraints all immediate
  $$,
  '23514',
  null,
  'duplicate decision evidence arrays require exactly two positions'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidate_decisions (
      id, duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000715',
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000402'::uuid,
        '10000000-0000-0000-0000-000000000401'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000503'::uuid,
        '10000000-0000-0000-0000-000000000501'::uuid
      ],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711'
    );
    update app.duplicate_candidates
    set current_decision_id = '10000000-0000-0000-0000-000000000715',
        evidence_hash = repeat('e', 64)
    where id = '10000000-0000-0000-0000-000000000701';
    set constraints all immediate
  $$,
  '23514',
  'duplicate decision evidence must positionally match successful record evidence',
  'version and attempt evidence ownership is positional'
);

select throws_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidate_decisions (
      id, duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000716',
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000505'::uuid
      ],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711'
    );
    update app.duplicate_candidates
    set current_decision_id = '10000000-0000-0000-0000-000000000716',
        evidence_hash = repeat('e', 64)
    where id = '10000000-0000-0000-0000-000000000701';
    set constraints all immediate
  $$,
  '23514',
  'duplicate decision evidence must positionally match successful record evidence',
  'failed ParseAttempt cannot become review evidence'
);

select throws_ok(
  $$
    insert into app.duplicate_candidate_decisions (
      duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000701',
      'SAME', 'LINK_RECORD', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711'
    )
  $$,
  '23514',
  null,
  'LINK_RECORD requires target entity and forbids merge identities'
);

select throws_ok(
  $$
    insert into app.duplicate_candidate_decisions (
      duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id, survivor_entity_id, loser_entity_id
    ) values (
      '10000000-0000-0000-0000-000000000701',
      'SAME', 'MERGE_ENTITIES', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711',
      '10000000-0000-0000-0000-000000000601',
      '10000000-0000-0000-0000-000000000601'
    )
  $$,
  '23514',
  null,
  'MERGE_ENTITIES requires distinct survivor and loser'
);
select throws_ok(
  $$
    insert into app.duplicate_candidate_decisions (
      duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id, target_entity_id
    ) values (
      '10000000-0000-0000-0000-000000000701',
      'SEPARATE', 'NO_MERGE', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('e', 64),
      '10000000-0000-0000-0000-000000000711',
      '10000000-0000-0000-0000-000000000601'
    )
  $$,
  '23514',
  null,
  'non-SAME decisions forbid target, survivor, and loser entities'
);

select lives_ok(
  $$
    set constraints all deferred;
    insert into app.duplicate_candidate_decisions (
      id, duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000713',
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000502'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('f', 64),
      '10000000-0000-0000-0000-000000000711'
    );
    update app.duplicate_candidates
    set current_decision_id = '10000000-0000-0000-0000-000000000713',
        status = 'OPEN',
        evidence_hash = repeat('f', 64)
    where id = '10000000-0000-0000-0000-000000000701';
    set constraints all immediate
  $$,
  'same version with a different successful ParseAttempt is distinct review evidence'
);
select isnt(
  (select evidence_parse_attempt_ids[1]
   from app.duplicate_candidate_decisions
   where id = '10000000-0000-0000-0000-000000000711'),
  (select evidence_parse_attempt_ids[1]
   from app.duplicate_candidate_decisions
   where id = '10000000-0000-0000-0000-000000000713'),
  'H+A1 and H+A2 retain distinct ParseAttempt identities'
);
select is(
  (select evidence_version_ids[1]
   from app.duplicate_candidate_decisions
   where id = '10000000-0000-0000-0000-000000000711'),
  (select evidence_version_ids[1]
   from app.duplicate_candidate_decisions
   where id = '10000000-0000-0000-0000-000000000713'),
  'H+A1 and H+A2 may share the same immutable version H'
);
select throws_ok(
  $$
    insert into app.duplicate_candidate_decisions (
      duplicate_candidate_id, decision, operation_type, reviewer,
      evidence_version_ids, evidence_parse_attempt_ids, evidence_hash,
      supersedes_decision_id
    ) values (
      '10000000-0000-0000-0000-000000000701',
      'OPEN', 'OPEN_REVIEW', 'DB-01B TEST',
      array[
        '10000000-0000-0000-0000-000000000401'::uuid,
        '10000000-0000-0000-0000-000000000402'::uuid
      ],
      array[
        '10000000-0000-0000-0000-000000000501'::uuid,
        '10000000-0000-0000-0000-000000000503'::uuid
      ],
      repeat('a', 64),
      '10000000-0000-0000-0000-000000000711'
    )
  $$,
  '23505',
  null,
  'one linear supersession chain prevents branching'
);
select throws_ok(
  $$
    update app.duplicate_candidates
    set evidence_hash = repeat('0', 64)
    where id = '10000000-0000-0000-0000-000000000701'
  $$,
  '23514',
  'duplicate candidate current pointer must reference its matching terminal decision',
  'candidate status/hash/current pointer cannot drift from current decision'
);

insert into app.taxonomy_nodes (
  id, slug, taxonomy_version, taxonomy_checksum,
  label_en, label_sv, depth, path, is_leaf
) values (
  '10000000-0000-0000-0000-000000000901',
  'activities', 'taxonomy-v1', repeat('9', 64),
  'Activities', 'Aktiviteter', 0,
  array['10000000-0000-0000-0000-000000000901'::uuid],
  false
);
select lives_ok(
  $$
    insert into app.taxonomy_nodes (
      id, slug, parent_id, taxonomy_version, taxonomy_checksum,
      label_en, label_sv, depth, path, is_leaf
    ) values (
      '10000000-0000-0000-0000-000000000902',
      'cinema',
      '10000000-0000-0000-0000-000000000901',
      'taxonomy-v1', repeat('9', 64),
      'Cinema', 'Bio', 1,
      array[
        '10000000-0000-0000-0000-000000000901'::uuid,
        '10000000-0000-0000-0000-000000000902'::uuid
      ],
      true
    )
  $$,
  'valid taxonomy parent and child are accepted'
);
select throws_ok(
  $$
    insert into app.taxonomy_nodes (
      id, slug, parent_id, taxonomy_version, taxonomy_checksum,
      label_en, label_sv, depth, path, is_leaf
    ) values (
      '10000000-0000-0000-0000-000000000903',
      'wrong-version',
      '10000000-0000-0000-0000-000000000901',
      'taxonomy-v2', repeat('8', 64),
      'Wrong', 'Fel', 1,
      array[
        '10000000-0000-0000-0000-000000000901'::uuid,
        '10000000-0000-0000-0000-000000000903'::uuid
      ],
      true
    )
  $$,
  '23514',
  'taxonomy node must have acyclic same-version exact parent path and depth',
  'taxonomy parent version and checksum must match'
);
select throws_ok(
  $$
    insert into app.taxonomy_nodes (
      id, slug, parent_id, taxonomy_version, taxonomy_checksum,
      label_en, label_sv, depth, path, is_leaf
    ) values (
      '10000000-0000-0000-0000-000000000904',
      'wrong-path',
      '10000000-0000-0000-0000-000000000901',
      'taxonomy-v1', repeat('9', 64),
      'Wrong path', 'Fel sökväg', 1,
      array[
        '10000000-0000-0000-0000-000000000904'::uuid,
        '10000000-0000-0000-0000-000000000901'::uuid
      ],
      true
    )
  $$,
  '23514',
  'taxonomy node must have acyclic same-version exact parent path and depth',
  'taxonomy path must be exact parent path plus self'
);
select throws_ok(
  $$
    update app.taxonomy_nodes
    set parent_id = '10000000-0000-0000-0000-000000000902',
        depth = 2,
        path = array[
          '10000000-0000-0000-0000-000000000901'::uuid,
          '10000000-0000-0000-0000-000000000902'::uuid,
          '10000000-0000-0000-0000-000000000901'::uuid
        ]
    where id = '10000000-0000-0000-0000-000000000901'
  $$,
  '23514',
  'taxonomy node must have acyclic same-version exact parent path and depth',
  'taxonomy cycle is rejected'
);

select lives_ok(
  $$
    insert into app.taxonomy_aliases (
      taxonomy_node_id, language, alias, alias_norm, alias_ascii
    ) values (
      '10000000-0000-0000-0000-000000000902',
      'sv', 'Biograf', 'biograf', 'biograf'
    )
  $$,
  'taxonomy alias preserves language and normalized forms'
);
select throws_ok(
  $$
    insert into app.taxonomy_aliases (
      taxonomy_node_id, language, alias, alias_norm, alias_ascii
    ) values (
      '10000000-0000-0000-0000-000000000902',
      'sv', 'BIOGRAF', 'biograf', 'biograf'
    )
  $$,
  '23505',
  null,
  'taxonomy alias uniqueness uses node, language, and normalized form'
);

select lives_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      id, entity_id, taxonomy_node_id, method, source_record_version_id
    ) values (
      '10000000-0000-0000-0000-000000000921',
      '10000000-0000-0000-0000-000000000601',
      '10000000-0000-0000-0000-000000000902',
      'SOURCE_FACT',
      '10000000-0000-0000-0000-000000000401'
    )
  $$,
  'source-fact membership requires and accepts source evidence'
);
select throws_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, source_record_version_id
    ) values (
      '10000000-0000-0000-0000-000000000601',
      '10000000-0000-0000-0000-000000000902',
      'SOURCE_FACT',
      '10000000-0000-0000-0000-000000000401'
    )
  $$,
  '23505',
  null,
  'only one active entity-node membership is allowed'
);
select throws_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method
    ) values (
      '10000000-0000-0000-0000-000000000602',
      '10000000-0000-0000-0000-000000000902',
      'SOURCE_FACT'
    )
  $$,
  '23514',
  null,
  'SOURCE_FACT membership without source evidence is rejected'
);
select throws_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, source_record_version_id
    ) values (
      '10000000-0000-0000-0000-000000000602',
      '10000000-0000-0000-0000-000000000902',
      'DETERMINISTIC_MAP',
      '10000000-0000-0000-0000-000000000402'
    )
  $$,
  '23514',
  null,
  'DETERMINISTIC_MAP membership requires mapping reference'
);
select lives_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, source_record_version_id, mapping_ref
    ) values (
      '10000000-0000-0000-0000-000000000602',
      '10000000-0000-0000-0000-000000000902',
      'DETERMINISTIC_MAP',
      '10000000-0000-0000-0000-000000000402',
      'mapping-v1:cinema'
    )
  $$,
  'deterministic mapping membership retains version and mapping reference'
);
select throws_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method
    ) values (
      '10000000-0000-0000-0000-000000000603',
      '10000000-0000-0000-0000-000000000902',
      'MANUAL'
    )
  $$,
  '23514',
  null,
  'MANUAL membership requires evidence and reviewer'
);
select lives_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
    ) values (
      '10000000-0000-0000-0000-000000000603',
      '10000000-0000-0000-0000-000000000902',
      'MANUAL',
      'Reviewed Event classification',
      'reviewer@example.invalid'
    )
  $$,
  'manual membership retains manual evidence and reviewer'
);
select throws_ok(
  $$
    insert into app.entity_taxonomy_memberships (
      entity_id, taxonomy_node_id, method, manual_evidence, reviewed_by
    ) values (
      '10000000-0000-0000-0000-000000000604',
      '10000000-0000-0000-0000-000000000902',
      'AI_GENERATED',
      'model output',
      'model'
    )
  $$,
  '22P02',
  null,
  'AI-generated taxonomy truth is impossible'
);

select ok(
  (
    select bool_and(relrowsecurity)
    from pg_class
    where oid in (
      'app.canonical_entities'::regclass,
      'app.places'::regclass,
      'app.events'::regclass,
      'app.canonical_fact_provenance'::regclass,
      'app.entity_aliases'::regclass,
      'app.duplicate_candidates'::regclass,
      'app.duplicate_candidate_decisions'::regclass,
      'app.taxonomy_nodes'::regclass,
      'app.taxonomy_aliases'::regclass,
      'app.entity_taxonomy_memberships'::regclass
    )
  ),
  'RLS is enabled on every DB-01B private table'
);
select ok(
  not has_schema_privilege('anon', 'app', 'USAGE')
    and not has_schema_privilege('authenticated', 'app', 'USAGE')
    and has_schema_privilege('service_role', 'app', 'USAGE'),
  'DB-01B remains private while service_role has signature-only app usage'
);
select ok(
  not has_table_privilege('anon', 'app.canonical_entities', 'SELECT')
    and not has_table_privilege('authenticated', 'app.events', 'SELECT')
    and not has_table_privilege('service_role', 'app.taxonomy_nodes', 'SELECT'),
  'DB-01B tables have no unintended public or service-role grants'
);
select is(
  (select count(*) from information_schema.tables where table_schema = 'api'),
  0::bigint,
  'DB-01B adds no table to the exposed API schema'
);

select * from finish();
rollback;
