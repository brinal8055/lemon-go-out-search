-- DOC-01: frozen weighted multilingual SearchDocument vector construction.

create function app.build_search_document_fts(
  p_names text,
  p_aliases text,
  p_direct_taxonomy_en text,
  p_direct_taxonomy_sv text,
  p_direct_taxonomy_und text,
  p_facts text,
  p_ancestor_taxonomy_en text,
  p_ancestor_taxonomy_sv text,
  p_ancestor_taxonomy_und text,
  p_event_context text,
  p_description text
)
returns tsvector
language sql
immutable
parallel safe
set search_path = ''
as $$
  select
    pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.simple'::regconfig,
      pg_catalog.concat_ws(' ', p_names, p_aliases)), 'A')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.simple'::regconfig,
      pg_catalog.concat_ws(' ', p_facts, p_direct_taxonomy_und)), 'B')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.english'::regconfig,
      p_direct_taxonomy_en), 'B')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.swedish'::regconfig,
      p_direct_taxonomy_sv), 'B')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.simple'::regconfig,
      pg_catalog.concat_ws(' ', p_event_context, p_ancestor_taxonomy_und)), 'C')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.english'::regconfig,
      p_ancestor_taxonomy_en), 'C')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.swedish'::regconfig,
      p_ancestor_taxonomy_sv), 'C')
    || pg_catalog.setweight(pg_catalog.to_tsvector('pg_catalog.simple'::regconfig,
      p_description), 'D')
$$;

revoke execute on function app.build_search_document_fts(
  text, text, text, text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role, lemon_reviewer;
grant execute on function app.build_search_document_fts(
  text, text, text, text, text, text, text, text, text, text, text
) to lemon_ingestion;
