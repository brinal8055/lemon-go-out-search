begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

select is(
  (select count(*) from app.taxonomy_nodes where active),
  52::bigint,
  'the active taxonomy contains the frozen 52 nodes'
);
select is(
  (select count(*) from app.taxonomy_nodes where parent_id is null and active),
  3::bigint,
  'the active taxonomy has exactly three roots'
);
select is(
  array_to_string(array(
    select slug from app.taxonomy_nodes where parent_id is null and active order by slug
  ), ','),
  'activities-and-experiences,drinks-and-nightlife,food-and-dining',
  'the frozen root hierarchy is present'
);
select is(
  (select id from app.taxonomy_nodes where slug = 'food-and-dining'),
  '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'::uuid,
  'the checked-in Food & Dining ID is stable'
);
select is(
  (select taxonomy_version from app.taxonomy_nodes limit 1),
  'active-going-out.v1',
  'all taxonomy nodes use the frozen version'
);
select is(
  (select count(distinct taxonomy_checksum) from app.taxonomy_nodes),
  1::bigint,
  'all taxonomy nodes share one checksum'
);
select is(
  (select taxonomy_checksum from app.taxonomy_nodes limit 1),
  'ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2',
  'the taxonomy checksum matches the checked-in artifact'
);
select ok(
  not exists (
    select 1
    from app.taxonomy_nodes as node
    left join app.taxonomy_nodes as parent on parent.id = node.parent_id
    where node.parent_id is not null and parent.id is null
  ),
  'the taxonomy has no orphans'
);
select ok(
  not exists (
    select 1 from app.taxonomy_nodes
    where cardinality(path) <> depth + 1 or path[cardinality(path)] <> id
  ),
  'taxonomy paths and depths are exact'
);
select ok(
  not exists (
    select 1 from app.taxonomy_nodes where not active or taxonomy_version <> 'active-going-out.v1'
  ),
  'no legacy taxonomy node is loaded'
);
select is(
  (select count(*) from app.taxonomy_nodes where btrim(label_en) = '' or btrim(label_sv) = ''),
  0::bigint,
  'every taxonomy node has EN and SV labels'
);
select is(
  (select count(*) from app.taxonomy_aliases where active),
  104::bigint,
  'the frozen EN/SV aliases are loaded once'
);
select is(
  (select count(*) from app.taxonomy_aliases where language = 'en'),
  52::bigint,
  'each taxonomy node has its English alias'
);
select is(
  (select count(*) from app.taxonomy_aliases where language = 'sv'),
  52::bigint,
  'each taxonomy node has its Swedish alias'
);

select is(
  (select count(*) from app.geographic_scopes where slug = 'jonkoping-municipality'),
  1::bigint,
  'exactly one Jönköping municipality scope is seeded'
);
select is(
  (select timezone from app.geographic_scopes where slug = 'jonkoping-municipality'),
  'Europe/Stockholm',
  'the Jönköping scope uses Europe/Stockholm'
);
select ok(
  (select is_active and public_search_enabled from app.geographic_scopes where slug = 'jonkoping-municipality'),
  'the reference scope is active and enabled by SEC-01'
);
select is(
  (select count(*) from app.geographic_scope_boundaries where is_active),
  1::bigint,
  'exactly one active boundary exists'
);
select is(
  (select version from app.geographic_scope_boundaries where is_active),
  'lm-current-2026-08-14',
  'the frozen boundary version is active'
);
select ok(
  (select extensions.st_isvalid(boundary) and not extensions.st_isempty(boundary) and extensions.st_srid(boundary) = 4326 and extensions.st_geometrytype(boundary) = 'ST_MultiPolygon' from app.geographic_scope_boundaries where is_active),
  'the active boundary is a valid non-empty EPSG:4326 MultiPolygon'
);
select ok(
  (select source_name = 'Lantmäteriet' and licence = 'CC-BY-4.0' and source_checksum = '257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d' and btrim(attribution) <> '' from app.geographic_scope_boundaries where is_active),
  'boundary source, licence, attribution, and checksum are pinned'
);
select ok(
  (select extensions.st_covers(boundary, extensions.st_setsrid(extensions.st_makepoint(14.1618, 57.7815), 4326)) from app.geographic_scope_boundaries where is_active),
  'Jönköping city fixture is covered by the municipality boundary'
);
select ok(
  not (select extensions.st_covers(boundary, extensions.st_setsrid(extensions.st_makepoint(13.0000, 57.0000), 4326)) from app.geographic_scope_boundaries where is_active),
  'outside fixture is not covered by the municipality boundary'
);
select is(
  (select count(*) from app.sources where key = 'lantmateriet-kommun-lan-rike' and not enabled),
  1::bigint,
  'the reviewed Lantmäteriet source-registry skeleton remains disabled'
);

insert into app.taxonomy_nodes (
  id, slug, parent_id, taxonomy_version, taxonomy_checksum, label_en, label_sv, depth, path, is_leaf, active
)
select id, slug, parent_id, taxonomy_version, taxonomy_checksum, label_en, label_sv, depth, path, is_leaf, active
from app.taxonomy_nodes
where id = '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'
on conflict (id) do nothing;

insert into app.taxonomy_aliases (
  taxonomy_node_id, language, alias, alias_norm, alias_ascii, active
)
select taxonomy_node_id, language, alias, alias_norm, alias_ascii, active
from app.taxonomy_aliases
where taxonomy_node_id = '27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1'
on conflict (taxonomy_node_id, language, alias_norm) do nothing;

insert into app.geographic_scope_boundaries (
  id, scope_id, version, boundary, source_name, source_url, licence, attribution, source_checksum, effective_from, effective_to, is_active
)
select id, scope_id, version, boundary, source_name, source_url, licence, attribution, source_checksum, effective_from, effective_to, is_active
from app.geographic_scope_boundaries
where id = '0a39b199-4cd5-5358-85de-2c1a5f91a347'
on conflict (id) do nothing;

select is(
  (select count(*) from app.taxonomy_nodes),
  52::bigint,
  'repeated reference seed does not duplicate taxonomy nodes'
);
select is(
  (select count(*) from app.taxonomy_aliases),
  104::bigint,
  'repeated reference seed does not duplicate aliases'
);
select is(
  (select count(*) from app.geographic_scope_boundaries where is_active),
  1::bigint,
  'repeated reference seed does not create a second active boundary'
);
select is(
  (select count(*) from app.geographic_scopes where id = 'a4b19b09-b272-5748-80ef-2c91d9d33ca6'),
  1::bigint,
  'repeated reference seed retains the stable scope ID'
);

select * from finish();
rollback;
