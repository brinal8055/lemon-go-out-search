import { createHash } from 'node:crypto';
import { NORMALIZATION_VERSION, normalizePreserving } from '@lemon/normalization';
import pg from 'pg';
import { assertDestructiveDatabaseOperation } from '@lemon/contracts';

const { Client } = pg;

export const SEARCH_DOCUMENT_VERSION = 'search-document-v1';
export const SEARCH_DOCUMENT_TEMPLATE_VERSION = 'lexical-embedding-template-v1';
export const SEARCH_DOCUMENT_REBUILD_LIMIT = 5000;

export type TextValue = { value: string; norm: string; language: 'en' | 'sv' | 'und' };
export type TaxonomyValue = {
  id: string;
  path: string[];
  version: string;
  checksum: string;
  labelEn: string;
  labelSv: string;
  aliases: TextValue[];
};

export type SearchDocumentTruth = {
  entityId: string;
  displayName: string;
  canonicalNameNorm: string;
  aliases: TextValue[];
  directTaxonomy: TaxonomyValue[];
  ancestorTaxonomy: TaxonomyValue[];
  facts: string[];
  description: string;
  eventContext: string[];
};

export type BuiltSearchDocument = {
  documentVersion: string;
  templateVersion: string;
  contentHash: string;
  displayName: string;
  namesText: string;
  aliasesText: string;
  taxonomyEnText: string;
  taxonomySvText: string;
  factsText: string;
  descriptionText: string;
  eventContextText: string;
  embeddingText: string;
  directTaxonomyEnText: string;
  directTaxonomySvText: string;
  directTaxonomyUndText: string;
  ancestorTaxonomyEnText: string;
  ancestorTaxonomySvText: string;
  ancestorTaxonomyUndText: string;
};

export type SearchDocumentRebuildReport = {
  scanned: number;
  eligible: number;
  created: number;
  reactivated: number;
  unchanged: number;
  deactivated: number;
  embeddingsStaled: number;
  activeDocuments: number;
  contentChanges: number;
};

export type PlacePublicationEvidence = {
  entityId: string;
  sourceRecordId: string;
  sourceRecordVersionId: string;
  sourceRecordParseAttemptId: string;
};

export type PlacePublicationProjectionReport = {
  entityId: string;
  searchDocumentId: string;
  contentHash: string;
  documentOutcome: 'created' | 'reactivated' | 'unchanged';
  embeddingsStaled: number;
};

type EntityRow = {
  id: string;
  entity_type: 'PLACE' | 'EVENT';
  canonical_name: string;
  canonical_name_norm: string;
  publication_status: string;
  merged_into_id: string | null;
  boundary_active: boolean | null;
  subtype_eligible: boolean;
  street_address: string | null;
  postal_code: string | null;
  locality: string | null;
  country_code: string | null;
  opening_hours: unknown;
  starts_at: Date | null;
  ends_at: Date | null;
  event_status: string | null;
  venue_place_id: string | null;
  standalone_venue_name: string | null;
};

type AliasRow = { alias: string; alias_norm: string; language: 'en' | 'sv' | 'und' };
type TaxonomyRow = {
  id: string;
  path: string[];
  taxonomy_version: string;
  taxonomy_checksum: string;
  label_en: string;
  label_sv: string;
  direct: boolean;
};
type TaxonomyAliasRow = {
  taxonomy_node_id: string;
  alias: string;
  alias_norm: string;
  language: 'en' | 'sv' | 'und';
};

export function buildSearchDocument(truth: SearchDocumentTruth): BuiltSearchDocument {
  if (normalizePreserving(truth.displayName) !== truth.canonicalNameNorm) {
    throw new Error('canonical name does not satisfy norm-v1');
  }
  const aliases = stableTextValues(truth.aliases);
  const direct = stableTaxonomy(truth.directTaxonomy);
  const directIds = new Set(direct.map(({ id }) => id));
  const ancestors = stableTaxonomy(truth.ancestorTaxonomy).filter(({ id }) => !directIds.has(id));
  const namesText = truth.displayName;
  const aliasesText = aliases.map(({ value }) => value).join('\n');
  const directEn = taxonomyTerms(direct, 'en');
  const directSv = taxonomyTerms(direct, 'sv');
  const directUnd = taxonomyTerms(direct, 'und');
  const ancestorEn = taxonomyTerms(ancestors, 'en');
  const ancestorSv = taxonomyTerms(ancestors, 'sv');
  const ancestorUnd = taxonomyTerms(ancestors, 'und');
  const taxonomyEnText = [...directEn, ...ancestorEn].join('\n');
  const taxonomySvText = [...directSv, ...ancestorSv].join('\n');
  const facts = stableUnique(truth.facts);
  const eventContext = stableUnique(truth.eventContext);
  const factsText = facts.join('\n');
  const eventContextText = eventContext.join('\n');
  const embeddingText = stableUnique([
    truth.displayName,
    ...aliases.map(({ value }) => value),
    ...directEn,
    ...directSv,
    ...directUnd,
    ...ancestorEn,
    ...ancestorSv,
    ...ancestorUnd,
    ...facts,
    truth.description,
    ...eventContext,
  ]).join('\n');
  const content = canonicalJson({
    documentVersion: SEARCH_DOCUMENT_VERSION,
    templateVersion: SEARCH_DOCUMENT_TEMPLATE_VERSION,
    normalizationVersion: NORMALIZATION_VERSION,
    entityId: truth.entityId,
    displayName: truth.displayName,
    canonicalNameNorm: truth.canonicalNameNorm,
    aliases,
    directTaxonomy: direct,
    ancestorTaxonomy: ancestors,
    facts,
    description: truth.description,
    eventContext,
    embeddingText,
  });
  return {
    documentVersion: SEARCH_DOCUMENT_VERSION,
    templateVersion: SEARCH_DOCUMENT_TEMPLATE_VERSION,
    contentHash: createHash('sha256').update(content).digest('hex'),
    displayName: truth.displayName,
    namesText,
    aliasesText,
    taxonomyEnText,
    taxonomySvText,
    factsText,
    descriptionText: truth.description,
    eventContextText,
    embeddingText,
    directTaxonomyEnText: directEn.join('\n'),
    directTaxonomySvText: directSv.join('\n'),
    directTaxonomyUndText: directUnd.join('\n'),
    ancestorTaxonomyEnText: ancestorEn.join('\n'),
    ancestorTaxonomySvText: ancestorSv.join('\n'),
    ancestorTaxonomyUndText: ancestorUnd.join('\n'),
  };
}

export async function prepareLocalSearchDocumentRuntime(connectionString: string): Promise<void> {
  assertDestructiveDatabaseOperation(connectionString, process.env);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_ingestion to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function rebuildSearchDocuments(
  connectionString: string,
  limit = SEARCH_DOCUMENT_REBUILD_LIMIT,
): Promise<SearchDocumentRebuildReport> {
  if (!Number.isInteger(limit) || limit < 1 || limit > SEARCH_DOCUMENT_REBUILD_LIMIT) {
    throw new Error(`limit must be an integer between 1 and ${SEARCH_DOCUMENT_REBUILD_LIMIT}`);
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    const entityIds = (await client.query<{ id: string }>(`
      select id from (
        select entity.id
        from app.canonical_entities as entity
        where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
        union
        select document.entity_id
        from app.search_documents as document
        where document.is_active
      ) as target
      order by id
      limit $1
    `, [limit + 1])).rows.map(({ id }) => id);
    if (entityIds.length > limit) {
      throw new Error(`search document rebuild exceeds the explicit limit of ${limit}`);
    }
    const report: SearchDocumentRebuildReport = {
      scanned: entityIds.length,
      eligible: 0,
      created: 0,
      reactivated: 0,
      unchanged: 0,
      deactivated: 0,
      embeddingsStaled: 0,
      activeDocuments: 0,
      contentChanges: 0,
    };
    for (const entityId of entityIds) {
      await client.query('begin');
      try {
        await client.query('set transaction isolation level repeatable read');
        const entity = await loadEntity(client, entityId);
        if (!isEligible(entity)) {
          const deactivated = await deactivateCurrentDocument(client, entityId, 'ENTITY_INELIGIBLE');
          report.deactivated += deactivated.documents;
          report.embeddingsStaled += deactivated.embeddings;
        } else {
          report.eligible += 1;
          const truth = await loadTruth(client, entity);
          const document = buildSearchDocument(truth);
          const outcome = await activateDocument(client, document, entityId);
          report[outcome.kind] += 1;
          report.embeddingsStaled += outcome.embeddingsStaled;
          if (outcome.kind !== 'unchanged') report.contentChanges += 1;
        }
        await client.query('commit');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
    report.activeDocuments = Number((await client.query<{ count: string }>(`
      select count(*) from app.search_documents where is_active
    `)).rows[0]?.count ?? 0);
    return report;
  } finally {
    await client.end();
  }
}

export async function publishPlaceWithSearchDocument(
  connectionString: string,
  evidence: PlacePublicationEvidence,
): Promise<PlacePublicationProjectionReport> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('set role lemon_ingestion');
    await client.query('begin');
    try {
      await client.query('set transaction isolation level repeatable read');
      const entity = await loadEntity(client, evidence.entityId);
      if (entity.entity_type !== 'PLACE'
        || !['DRAFT', 'PUBLISHED'].includes(entity.publication_status)
        || entity.merged_into_id !== null
        || entity.boundary_active !== true
        || !entity.subtype_eligible) {
        throw new Error(`Place ${evidence.entityId} is not an eligible publication candidate`);
      }
      const document = buildSearchDocument(await loadTruth(client, entity));
      const outcome = await activateDocument(client, document, evidence.entityId);
      const active = await client.query<{ id: string }>(`
        select id from app.search_documents
        where entity_id = $1 and template_version = $2 and content_hash = $3 and is_active
      `, [evidence.entityId, document.templateVersion, document.contentHash]);
      if (active.rowCount !== 1) throw new Error('publication SearchDocument was not activated uniquely');
      await client.query(
        'select app.publish_place_from_current_evidence($1, $2, $3, $4, $5, $6)',
        [
          evidence.entityId,
          evidence.sourceRecordId,
          evidence.sourceRecordVersionId,
          evidence.sourceRecordParseAttemptId,
          document.templateVersion,
          document.contentHash,
        ],
      );
      await client.query('commit');
      return {
        entityId: evidence.entityId,
        searchDocumentId: active.rows[0].id,
        contentHash: document.contentHash,
        documentOutcome: outcome.kind,
        embeddingsStaled: outcome.embeddingsStaled,
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
  } finally {
    await client.end();
  }
}

async function loadEntity(client: pg.Client, entityId: string): Promise<EntityRow> {
  const result = await client.query<EntityRow>(`
    select entity.id, entity.entity_type, entity.canonical_name, entity.canonical_name_norm,
           entity.publication_status, entity.merged_into_id,
           boundary.is_active as boundary_active,
           case
             when entity.entity_type = 'PLACE' then place.entity_id is not null
               and place.status <> 'CLOSED' and place.location is not null
               and boundary.boundary is not null
               and extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
             else event.entity_id is not null and event.status = 'SCHEDULED'
               and boundary.boundary is not null and coalesce(venue.location, event.location) is not null
               and extensions.st_covers(
                 boundary.boundary, coalesce(venue.location, event.location)::extensions.geometry
               )
           end as subtype_eligible,
           case when entity.entity_type = 'EVENT'
             then coalesce(venue.street_address, event.standalone_street_address)
             else place.street_address end
             as street_address,
           case when entity.entity_type = 'EVENT'
             then coalesce(venue.postal_code, event.standalone_postal_code)
             else place.postal_code end
             as postal_code,
           case when entity.entity_type = 'EVENT'
             then coalesce(venue.locality, event.standalone_locality)
             else place.locality end
             as locality,
           case when entity.entity_type = 'EVENT'
             then coalesce(venue.country_code, event.standalone_country_code)
             else place.country_code end
             as country_code,
           place.opening_hours,
           event.starts_at, event.ends_at, event.status::text as event_status,
           event.venue_place_id, event.standalone_venue_name
    from app.canonical_entities as entity
    left join app.geographic_scope_boundaries as boundary
      on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id
    left join app.places as place on place.entity_id = entity.id
    left join app.events as event on event.entity_id = entity.id
    left join app.places as venue on venue.entity_id = event.venue_place_id
    where entity.id = $1
    for update of entity
  `, [entityId]);
  if (result.rowCount !== 1) throw new Error(`canonical entity ${entityId} disappeared during rebuild`);
  return result.rows[0];
}

function isEligible(entity: EntityRow): boolean {
  return entity.publication_status === 'PUBLISHED'
    && entity.merged_into_id === null
    && entity.boundary_active === true
    && entity.subtype_eligible;
}

async function loadTruth(client: pg.Client, entity: EntityRow): Promise<SearchDocumentTruth> {
  const permittedFacts = new Set((await client.query<{ fact_key: string }>(`
    select provenance.fact_key::text
    from app.canonical_fact_provenance as provenance
    join app.source_record_versions as version on version.id = provenance.source_record_version_id
    where provenance.entity_id = $1 and provenance.is_current
      and version.content_status = 'AVAILABLE'
    order by provenance.fact_key
    for share of provenance
  `, [entity.id])).rows.map(({ fact_key }) => fact_key));
  const requiredFacts = entity.entity_type === 'EVENT'
    ? [
      'canonical_name',
      ...(entity.venue_place_id ? [] : ['location']),
      'event_start',
      'event_status',
    ]
    : ['canonical_name', 'location'];
  if (requiredFacts.some((fact) => !permittedFacts.has(fact))) {
    throw new Error(`published entity ${entity.id} lacks permitted required provenance`);
  }

  const aliases = (await client.query<AliasRow>(`
    select alias.alias, alias.alias_norm, alias.language
    from app.entity_aliases as alias
    left join app.source_record_versions as version on version.id = alias.source_record_version_id
    where alias.entity_id = $1 and alias.active and alias.verified
      and (alias.source_record_version_id is null or version.content_status = 'AVAILABLE')
    order by alias.language, alias.alias_norm, alias.id
    for share of alias
  `, [entity.id])).rows.map((alias) => ({
    value: alias.alias,
    norm: alias.alias_norm,
    language: alias.language,
  }));

  const taxonomyRows = (await client.query<TaxonomyRow>(`
    with direct as (
      select node.id, node.path, node.taxonomy_version, btrim(node.taxonomy_checksum) as taxonomy_checksum,
             node.label_en, node.label_sv
      from app.entity_taxonomy_memberships as membership
      join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
      left join app.source_record_versions as version on version.id = membership.source_record_version_id
      where membership.entity_id = $1 and membership.active
        and (membership.source_record_version_id is null or version.content_status = 'AVAILABLE')
    ), expanded as (
      select direct.*, true as direct from direct
      union
      select ancestor.id, ancestor.path, ancestor.taxonomy_version,
             btrim(ancestor.taxonomy_checksum), ancestor.label_en, ancestor.label_sv, false
      from direct
      join app.taxonomy_nodes as ancestor on ancestor.id = any(direct.path)
      where ancestor.active and ancestor.id <> direct.id
    )
    select distinct on (id) id, path, taxonomy_version, taxonomy_checksum,
           label_en, label_sv, direct
    from expanded
    order by id, direct desc
  `, [entity.id])).rows;
  if (!taxonomyRows.some(({ direct }) => direct)) {
    throw new Error(`published entity ${entity.id} lacks permitted active taxonomy evidence`);
  }
  const taxonomyAliases = taxonomyRows.length === 0 ? [] : (await client.query<TaxonomyAliasRow>(`
    select alias.taxonomy_node_id, alias.alias, alias.alias_norm, alias.language
    from app.taxonomy_aliases as alias
    where alias.taxonomy_node_id = any($1::uuid[]) and alias.active
    order by alias.taxonomy_node_id, alias.language, alias.alias_norm, alias.id
  `, [taxonomyRows.map(({ id }) => id)])).rows;
  const aliasesByNode = new Map<string, TextValue[]>();
  for (const alias of taxonomyAliases) {
    const values = aliasesByNode.get(alias.taxonomy_node_id) ?? [];
    values.push({ value: alias.alias, norm: alias.alias_norm, language: alias.language });
    aliasesByNode.set(alias.taxonomy_node_id, values);
  }
  const taxonomy = taxonomyRows.map((node): TaxonomyValue => ({
    id: node.id,
    path: node.path,
    version: node.taxonomy_version,
    checksum: node.taxonomy_checksum,
    labelEn: node.label_en,
    labelSv: node.label_sv,
    aliases: aliasesByNode.get(node.id) ?? [],
  }));

  const facts: string[] = [];
  if (permittedFacts.has('address')) {
    const address = [entity.street_address, entity.postal_code, entity.locality, entity.country_code]
      .filter((value): value is string => Boolean(value?.trim())).join(', ');
    if (address) facts.push(`Address: ${address}`);
  }
  if (permittedFacts.has('opening_hours') && entity.opening_hours !== null) {
    facts.push(`Opening hours: ${canonicalJson(entity.opening_hours)}`);
  }
  if (entity.entity_type === 'EVENT') {
    if (permittedFacts.has('event_start') && entity.starts_at) facts.push(`Starts: ${entity.starts_at.toISOString()}`);
    if (permittedFacts.has('event_end') && entity.ends_at) facts.push(`Ends: ${entity.ends_at.toISOString()}`);
    if (permittedFacts.has('event_status') && entity.event_status) facts.push(`Status: ${entity.event_status}`);
  }
  const eventContext: string[] = [];
  if (entity.entity_type === 'EVENT') {
    if (entity.venue_place_id) {
      const venue = await client.query<{ canonical_name: string }>(`
        select venue.canonical_name
        from app.canonical_entities as venue
        join app.canonical_fact_provenance as provenance
          on provenance.entity_id = venue.id and provenance.fact_key = 'canonical_name' and provenance.is_current
        join app.source_record_versions as version on version.id = provenance.source_record_version_id
        where venue.id = $1 and version.content_status = 'AVAILABLE'
      `, [entity.venue_place_id]);
      if (venue.rows[0]) eventContext.push(`Venue: ${venue.rows[0].canonical_name}`);
    } else if (permittedFacts.has('location') && entity.standalone_venue_name) {
      eventContext.push(`Venue: ${entity.standalone_venue_name}`);
    }
  }
  return {
    entityId: entity.id,
    displayName: entity.canonical_name,
    canonicalNameNorm: entity.canonical_name_norm,
    aliases,
    directTaxonomy: taxonomy.filter((_, index) => taxonomyRows[index].direct),
    ancestorTaxonomy: taxonomy.filter((_, index) => !taxonomyRows[index].direct),
    facts,
    description: '',
    eventContext,
  };
}

async function activateDocument(
  client: pg.Client,
  document: BuiltSearchDocument,
  entityId: string,
): Promise<{ kind: 'created' | 'reactivated' | 'unchanged'; embeddingsStaled: number }> {
  const active = await client.query<{ id: string; content_hash: string; template_version: string }>(`
    select id, content_hash, template_version
    from app.search_documents where entity_id = $1 and is_active for update
  `, [entityId]);
  if (active.rows[0]?.content_hash === document.contentHash
    && active.rows[0]?.template_version === document.templateVersion) {
    return { kind: 'unchanged', embeddingsStaled: 0 };
  }
  const existing = await client.query<{ id: string }>(`
    select id from app.search_documents
    where entity_id = $1 and template_version = $2 and content_hash = $3
  `, [entityId, document.templateVersion, document.contentHash]);
  let embeddingsStaled = 0;
  if (active.rows[0]) {
    const stale = await client.query(`
      update app.embeddings set status = 'STALE', stale_reason = 'SEARCH_DOCUMENT_REPLACED'
      where search_document_id = $1 and status = 'READY'
    `, [active.rows[0].id]);
    embeddingsStaled = stale.rowCount ?? 0;
    await client.query('update app.search_documents set is_active = false where id = $1', [active.rows[0].id]);
  }
  await client.query(`
    insert into app.search_documents (
      entity_id, document_version, template_version, content_hash,
      display_name, names_text, aliases_text, taxonomy_en_text, taxonomy_sv_text,
      facts_text, description_text, event_context_text, embedding_text,
      fts, generated_at, is_active
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      app.build_search_document_fts($6, $7, $14, $15, $16, $10, $17, $18, $19, $12, $11),
      statement_timestamp(), true
    )
    on conflict (entity_id, template_version, content_hash) do update set
      document_version = excluded.document_version,
      display_name = excluded.display_name,
      names_text = excluded.names_text,
      aliases_text = excluded.aliases_text,
      taxonomy_en_text = excluded.taxonomy_en_text,
      taxonomy_sv_text = excluded.taxonomy_sv_text,
      facts_text = excluded.facts_text,
      description_text = excluded.description_text,
      event_context_text = excluded.event_context_text,
      embedding_text = excluded.embedding_text,
      fts = excluded.fts,
      generated_at = excluded.generated_at,
      is_active = true
  `, [
    entityId, document.documentVersion, document.templateVersion, document.contentHash,
    document.displayName, document.namesText, document.aliasesText,
    document.taxonomyEnText, document.taxonomySvText, document.factsText,
    document.descriptionText, document.eventContextText, document.embeddingText,
    document.directTaxonomyEnText, document.directTaxonomySvText,
    document.directTaxonomyUndText, document.ancestorTaxonomyEnText,
    document.ancestorTaxonomySvText, document.ancestorTaxonomyUndText,
  ]);
  return { kind: existing.rowCount === 1 ? 'reactivated' : 'created', embeddingsStaled };
}

async function deactivateCurrentDocument(
  client: pg.Client,
  entityId: string,
  reason: string,
): Promise<{ documents: number; embeddings: number }> {
  const active = await client.query<{ id: string }>(`
    select id from app.search_documents where entity_id = $1 and is_active for update
  `, [entityId]);
  if (!active.rows[0]) return { documents: 0, embeddings: 0 };
  const stale = await client.query(`
    update app.embeddings set status = 'STALE', stale_reason = $2
    where search_document_id = $1 and status = 'READY'
  `, [active.rows[0].id, reason]);
  await client.query('update app.search_documents set is_active = false where id = $1', [active.rows[0].id]);
  return { documents: 1, embeddings: stale.rowCount ?? 0 };
}

function stableTextValues(values: TextValue[]): TextValue[] {
  const normalized = values.map((value) => {
    if (normalizePreserving(value.value) !== value.norm) throw new Error('text value does not satisfy norm-v1');
    return value;
  });
  return [...new Map(normalized
    .sort((left, right) => `${left.language}:${left.norm}:${left.value}`.localeCompare(`${right.language}:${right.norm}:${right.value}`, 'en'))
    .map((value) => [`${value.language}:${value.norm}`, value])).values()];
}

function stableTaxonomy(values: TaxonomyValue[]): TaxonomyValue[] {
  return [...new Map(values.map((value) => [value.id, {
    ...value,
    aliases: stableTextValues(value.aliases),
  }])).values()].sort((left, right) => {
    const pathOrder = left.path.join('/').localeCompare(right.path.join('/'), 'en');
    return pathOrder || left.id.localeCompare(right.id, 'en');
  });
}

function taxonomyTerms(values: TaxonomyValue[], language: 'en' | 'sv' | 'und'): string[] {
  const terms: string[] = [];
  for (const value of values) {
    if (language === 'en') terms.push(value.labelEn);
    if (language === 'sv') terms.push(value.labelSv);
    terms.push(...value.aliases.filter((alias) => alias.language === language).map(({ value: alias }) => alias));
  }
  return stableUnique(terms);
}

function stableUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, child]) => [key, sortValue(child)]));
  }
  return value;
}
