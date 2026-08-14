import { createHash } from 'node:crypto';
import pg from 'pg';
import { canonicalJson, prepareLocalIngestionRuntime } from './postgres-store.ts';

const { Client } = pg;

export const FIRST_PLACE_EXTERNAL_KEY = 'node/254912492';
export const FIRST_PLACE_TEMPLATE_VERSION = 'day1-first-place-v1';
export const FIRST_PLACE_MAPPING_REF = 'day1-pub-01:osm:amenity=restaurant->dining:v1';

type CandidateRow = {
  entity_id: string;
  canonical_name: string;
  source_record_id: string;
  source_record_version_id: string;
  source_record_parse_attempt_id: string;
  scope_id: string;
  boundary_id: string;
  payload: { tags?: Record<string, unknown> };
};

type TaxonomyRow = {
  id: string;
  slug: string;
  label_en: string;
  label_sv: string;
};

export type FirstPlaceDocument = {
  templateVersion: string;
  contentHash: string;
  documentVersion: string;
  displayName: string;
  namesText: string;
  aliasesText: string;
  taxonomyEnText: string;
  taxonomySvText: string;
  factsText: string;
  descriptionText: string;
  eventContextText: string;
  embeddingText: string;
};

export type FirstPlacePublicationReport = {
  canonicalEntityId: string;
  canonicalName: string;
  externalKey: string;
  sourceRecordId: string;
  sourceRecordVersionId: string;
  sourceRecordParseAttemptId: string;
  taxonomyNodeId: string;
  taxonomySlug: string;
  taxonomyMethod: 'DETERMINISTIC_MAP';
  mappingRef: string;
  provenanceFactKeys: string[];
  scopeId: string;
  boundaryId: string;
  searchDocumentId: string;
  templateVersion: string;
  contentHash: string;
  publicationStatus: 'PUBLISHED';
  placeStatus: string;
};

export function buildFirstPlaceDocument(
  entityId: string,
  canonicalName: string,
  aliases: string[],
  taxonomy: TaxonomyRow,
): FirstPlaceDocument {
  const factsText = 'amenity=restaurant';
  const content = canonicalJson({
    aliases,
    displayName: canonicalName,
    entityId,
    facts: [factsText],
    names: [canonicalName],
    taxonomy: [{
      id: taxonomy.id,
      labelEn: taxonomy.label_en,
      labelSv: taxonomy.label_sv,
      slug: taxonomy.slug,
    }],
    templateVersion: FIRST_PLACE_TEMPLATE_VERSION,
  });
  const contentHash = createHash('sha256').update(content).digest('hex');
  const aliasesText = aliases.join(' ');
  const embeddingText = [
    canonicalName,
    aliasesText,
    taxonomy.label_en,
    taxonomy.label_sv,
    factsText,
  ].filter(Boolean).join('\n');

  return {
    templateVersion: FIRST_PLACE_TEMPLATE_VERSION,
    contentHash,
    documentVersion: `${FIRST_PLACE_TEMPLATE_VERSION}-${contentHash.slice(0, 12)}`,
    displayName: canonicalName,
    namesText: canonicalName,
    aliasesText,
    taxonomyEnText: taxonomy.label_en,
    taxonomySvText: taxonomy.label_sv,
    factsText,
    descriptionText: '',
    eventContextText: '',
    embeddingText,
  };
}

export async function publishFirstPlace(
  connectionString: string,
): Promise<FirstPlacePublicationReport> {
  await prepareLocalIngestionRuntime(connectionString);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await client.query('begin');
    try {
      const candidate = await one<CandidateRow>(client, `
        select canonical.id as entity_id,
               canonical.canonical_name,
               record.id as source_record_id,
               record.current_version_id as source_record_version_id,
               record.current_parse_attempt_id as source_record_parse_attempt_id,
               canonical.scope_id,
               canonical.scope_boundary_id as boundary_id,
               version.payload
        from app.sources as source
        join app.source_records as record on record.source_id = source.id
        join app.source_record_versions as version on version.id = record.current_version_id
        join app.source_record_parse_attempts as attempt
          on attempt.id = record.current_parse_attempt_id
        join app.canonical_entities as canonical on canonical.id = record.canonical_entity_id
        join app.places as place on place.entity_id = canonical.id
        where source.key = 'OSM_OVERPASS'
          and record.external_key = $1
          and attempt.status = 'SUCCEEDED'
        for update of record, canonical, place
      `, [FIRST_PLACE_EXTERNAL_KEY]);

      if (candidate.payload.tags?.amenity !== 'restaurant') {
        throw new Error('selected first Place lacks explicit amenity=restaurant evidence');
      }

      await client.query(
        'select app.assert_source_record_current_evidence($1, $2, $3)',
        [
          candidate.source_record_id,
          candidate.source_record_version_id,
          candidate.source_record_parse_attempt_id,
        ],
      );

      const taxonomy = await one<TaxonomyRow>(client, `
        select id, slug, label_en, label_sv
        from app.taxonomy_nodes
        where taxonomy_version = 'active-going-out.v1'
          and slug = 'dining'
          and active
      `);

      await client.query(`
        insert into app.entity_taxonomy_memberships (
          entity_id, taxonomy_node_id, method, source_record_version_id, mapping_ref
        ) values ($1, $2, 'DETERMINISTIC_MAP', $3, $4)
        on conflict (entity_id, taxonomy_node_id) where active do nothing
      `, [candidate.entity_id, taxonomy.id, candidate.source_record_version_id, FIRST_PLACE_MAPPING_REF]);

      for (const factKey of ['canonical_name', 'location']) {
        await client.query(`
          insert into app.canonical_fact_provenance (
            entity_id, fact_key, source_record_version_id,
            selection_method, note, created_by
          ) values ($1, $2, $3, 'SOURCE_PRECEDENCE', $4, 'DAY1-PUB-01')
          on conflict (entity_id, fact_key) where is_current do nothing
        `, [
          candidate.entity_id,
          factKey,
          candidate.source_record_version_id,
          `First real OSM Place publication from ${FIRST_PLACE_EXTERNAL_KEY}`,
        ]);
      }

      const aliases = (await client.query<{ alias: string }>(`
        select alias
        from app.entity_aliases
        where entity_id = $1 and active and verified
        order by alias_norm, id
      `, [candidate.entity_id])).rows.map(({ alias }) => alias);
      const document = buildFirstPlaceDocument(
        candidate.entity_id,
        candidate.canonical_name,
        aliases,
        taxonomy,
      );

      const activeDocument = await client.query<{
        id: string;
        template_version: string;
        content_hash: string;
      }>(`
        select id, template_version, content_hash
        from app.search_documents
        where entity_id = $1 and is_active
        for update
      `, [candidate.entity_id]);
      if (activeDocument.rowCount === 1
        && (activeDocument.rows[0].template_version !== document.templateVersion
          || activeDocument.rows[0].content_hash !== document.contentHash)) {
        throw new Error('active SearchDocument does not match current first-place truth');
      }

      const searchDocument = await one<{ id: string }>(client, `
        insert into app.search_documents (
          entity_id, document_version, template_version, content_hash,
          display_name, names_text, aliases_text, taxonomy_en_text,
          taxonomy_sv_text, facts_text, description_text, event_context_text,
          embedding_text, fts, generated_at, is_active
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          pg_catalog.to_tsvector(
            'simple',
            pg_catalog.concat_ws(
              ' ', $6::text, $7::text, $8::text, $9::text, $10::text
            )
          ),
          statement_timestamp(), true
        )
        on conflict (entity_id, template_version, content_hash) do update
          set is_active = true
        returning id
      `, [
        candidate.entity_id,
        document.documentVersion,
        document.templateVersion,
        document.contentHash,
        document.displayName,
        document.namesText,
        document.aliasesText,
        document.taxonomyEnText,
        document.taxonomySvText,
        document.factsText,
        document.descriptionText,
        document.eventContextText,
        document.embeddingText,
      ]);

      await client.query(
        'select app.publish_place_from_current_evidence($1, $2, $3, $4, $5, $6)',
        [
          candidate.entity_id,
          candidate.source_record_id,
          candidate.source_record_version_id,
          candidate.source_record_parse_attempt_id,
          document.templateVersion,
          document.contentHash,
        ],
      );

      const report = await one<FirstPlacePublicationReport>(client, `
        select canonical.id as "canonicalEntityId",
               canonical.canonical_name as "canonicalName",
               record.external_key as "externalKey",
               record.id as "sourceRecordId",
               record.current_version_id as "sourceRecordVersionId",
               record.current_parse_attempt_id as "sourceRecordParseAttemptId",
               taxonomy_node.id as "taxonomyNodeId",
               taxonomy_node.slug as "taxonomySlug",
               membership.method::text as "taxonomyMethod",
               membership.mapping_ref as "mappingRef",
               array_agg(distinct provenance.fact_key::text order by provenance.fact_key::text)
                 as "provenanceFactKeys",
               canonical.scope_id as "scopeId",
               canonical.scope_boundary_id as "boundaryId",
               document.id as "searchDocumentId",
               document.template_version as "templateVersion",
               document.content_hash as "contentHash",
               canonical.publication_status::text as "publicationStatus",
               place.status::text as "placeStatus"
        from app.source_records as record
        join app.canonical_entities as canonical on canonical.id = record.canonical_entity_id
        join app.places as place on place.entity_id = canonical.id
        join app.entity_taxonomy_memberships as membership
          on membership.entity_id = canonical.id and membership.active
        join app.taxonomy_nodes as taxonomy_node on taxonomy_node.id = membership.taxonomy_node_id
        join app.canonical_fact_provenance as provenance
          on provenance.entity_id = canonical.id and provenance.is_current
        join app.search_documents as document
          on document.entity_id = canonical.id and document.is_active
        where record.id = $1 and document.id = $2
        group by canonical.id, record.id, taxonomy_node.id, membership.id, document.id, place.entity_id
      `, [candidate.source_record_id, searchDocument.id]);

      await client.query('commit');
      return report;
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function one<T extends pg.QueryResultRow>(
  client: pg.Client,
  query: string,
  values: unknown[] = [],
): Promise<T> {
  const result = await client.query<T>(query, values);
  if (result.rowCount !== 1) throw new Error(`expected one row, received ${result.rowCount ?? 0}`);
  return result.rows[0];
}
