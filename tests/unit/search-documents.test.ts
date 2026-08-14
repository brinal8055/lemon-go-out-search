import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { normalizeForSearch } from '../../packages/normalization/src/index.ts';
import {
  addManualTaxonomyMembership,
  applyTaxonomyMappings,
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalComplianceRuntime,
  prepareLocalIngestionRuntime,
  prepareLocalTaxonomyRuntime,
  publishFirstPlace,
  redactSourceRecordVersion,
  runIngestion,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import {
  buildSearchDocument,
  prepareLocalSearchDocumentRuntime,
  rebuildSearchDocuments,
  SEARCH_DOCUMENT_TEMPLATE_VERSION,
  type SearchDocumentTruth,
  type TaxonomyValue,
} from '../../packages/search-documents/src/index.ts';
import { JonkopingUtegymAdapter } from '../../packages/source-adapters/src/jonkoping-utegym.ts';
import { OsmOverpassAdapter } from '../../packages/source-adapters/src/osm.ts';

type OsmElement = { id: number; tags: Record<string, string>; [key: string]: unknown };
type OsmFixture = { elements: OsmElement[] };
type MunicipalFixture = { features: unknown[]; exceededTransferLimit: boolean };
type EntityIdentity = { id: string; canonical_name: string };

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const osmFixtureUrl = new URL('../../packages/source-adapters/fixtures/osm/jonkoping-bounded.raw.json', import.meta.url);
const municipalFixtureUrl = new URL('../../packages/source-adapters/fixtures/municipal/utegym.layer-41.sanitized.json', import.meta.url);
const fixedNow = () => new Date('2026-08-14T09:00:00Z');
let originalOsm: OsmFixture;
let municipalFixture: MunicipalFixture;
let evergreenId: string;
let sajensId: string;
let tandoriId: string;
let municipalIds: string[];
let initialRunIds: string[];

const dining: TaxonomyValue = {
  id: '10000000-0000-0000-0000-000000000002',
  path: ['10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'],
  version: 'active-going-out.v1',
  checksum: 'a'.repeat(64),
  labelEn: 'Dining',
  labelSv: 'Restauranger',
  aliases: [
    { value: 'Matställen', norm: 'matställen', language: 'sv' },
    { value: 'Places to eat', norm: 'places to eat', language: 'en' },
  ],
};
const root: TaxonomyValue = {
  id: '10000000-0000-0000-0000-000000000001',
  path: ['10000000-0000-0000-0000-000000000001'],
  version: 'active-going-out.v1',
  checksum: 'a'.repeat(64),
  labelEn: 'Going out',
  labelSv: 'Gå ut',
  aliases: [],
};

function truth(overrides: Partial<SearchDocumentTruth> = {}): SearchDocumentTruth {
  return {
    entityId: '20000000-0000-0000-0000-000000000001',
    displayName: 'Evergreen Restaurang & Pizzeria',
    canonicalNameNorm: 'evergreen restaurang pizzeria',
    aliases: [
      { value: 'Evergreen Pizza', norm: 'evergreen pizza', language: 'und' },
      { value: 'Evergreen', norm: 'evergreen', language: 'sv' },
    ],
    directTaxonomy: [dining],
    ancestorTaxonomy: [root],
    facts: ['Address: Example 1, Jönköping, SE'],
    description: '',
    eventContext: [],
    ...overrides,
  };
}

describe('DOC-01 deterministic projection', () => {
  it('produces byte-identical content fields and hash for the same inputs', () => {
    expect(buildSearchDocument(truth())).toEqual(buildSearchDocument(truth()));
  });

  it('orders aliases and taxonomy independently of input row order', () => {
    const reversed = truth({
      aliases: [...truth().aliases].reverse(),
      directTaxonomy: [dining],
      ancestorTaxonomy: [root],
    });
    expect(buildSearchDocument(reversed)).toEqual(buildSearchDocument(truth()));
  });

  it('changes the hash when the canonical name changes', () => {
    const changed = truth({ displayName: 'Evergreen Pizzeria', canonicalNameNorm: 'evergreen pizzeria' });
    expect(buildSearchDocument(changed).contentHash).not.toBe(buildSearchDocument(truth()).contentHash);
  });

  it('changes the hash for projected factual truth and taxonomy changes', () => {
    const baseline = buildSearchDocument(truth()).contentHash;
    expect(buildSearchDocument(truth({ facts: ['Address: Other 2, Jönköping, SE'] })).contentHash).not.toBe(baseline);
    expect(buildSearchDocument(truth({ directTaxonomy: [root], ancestorTaxonomy: [] })).contentHash).not.toBe(baseline);
  });

  it('does not include volatile rebuild or evidence metadata in the hash', () => {
    const first = buildSearchDocument(truth());
    const second = buildSearchDocument({ ...truth() });
    expect(second.contentHash).toBe(first.contentHash);
  });

  it('builds deterministic evidence-grounded embedding text without a provider call', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider must not run'));
    try {
      const document = buildSearchDocument(truth());
      expect(document.embeddingText).toContain('Evergreen Restaurang & Pizzeria');
      expect(document.embeddingText).toContain('Dining');
      expect(document.embeddingText).toContain('Restauranger');
      expect(document.embeddingText).not.toContain('subjective');
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('DOC-01 database lifecycle', () => {
  beforeAll(async () => {
    await prepareLocalIngestionRuntime(connectionString);
    await prepareLocalTaxonomyRuntime(connectionString);
    await prepareLocalSearchDocumentRuntime(connectionString);
    originalOsm = JSON.parse(await readFile(osmFixtureUrl, 'utf8')) as OsmFixture;
    municipalFixture = JSON.parse(await readFile(municipalFixtureUrl, 'utf8')) as MunicipalFixture;
    initialRunIds = [await ingestOsm(originalOsm), await ingestMunicipal()];
    await applyTaxonomyMappings(connectionString);
    await publishFirstPlace(connectionString);
    await publishAllResolvedPlaces(initialRunIds);
    const entities = await fixtureQuery<EntityIdentity>(connectionString, `
      select distinct entity.id, entity.canonical_name
      from app.canonical_entities as entity
      join app.source_records as record on record.canonical_entity_id = entity.id
      join app.source_record_versions as version on version.id = record.current_version_id
      where entity.publication_status = 'PUBLISHED'
        and version.capture_run_id = any($1::uuid[])
      order by entity.canonical_name, entity.id
    `, [initialRunIds]);
    evergreenId = requiredEntity(entities, 'Evergreen Restaurang & Pizzeria');
    sajensId = requiredEntity(entities, 'Sajens Mat & Möten');
    tandoriId = requiredEntity(entities, 'Tandori palace');
    municipalIds = entities
      .filter(({ canonical_name }) => canonical_name.includes('utegym'))
      .map(({ id }) => id);
    if (municipalIds.length !== 3) throw new Error('expected three sanitized municipal entities');
  });

  afterAll(async () => {
    await store.close();
  });

  it('rebuilds Day-1 Evergreen and all sanitized OSM/municipal entities generically', async () => {
    const before = await activeDocument(evergreenId);
    expect(before.template_version).toBe('day1-first-place-v1');
    const report = await rebuildSearchDocuments(connectionString);
    expect(report).toMatchObject({ scanned: 6, eligible: 6, created: 6, activeDocuments: 6 });
    const evergreen = await activeDocument(evergreenId);
    expect(evergreen.template_version).toBe(SEARCH_DOCUMENT_TEMPLATE_VERSION);
    expect(evergreen.display_name).toBe('Evergreen Restaurang & Pizzeria');
    expect(evergreen.taxonomy_en_text).toContain('Dining');
  });

  it('is idempotent on rerun with zero content/hash changes', async () => {
    const before = await activeHashes();
    const report = await rebuildSearchDocuments(connectionString);
    expect(report).toMatchObject({ eligible: 6, unchanged: 6, contentChanges: 0, activeDocuments: 6 });
    expect(await activeHashes()).toEqual(before);
  });

  it('retains exactly one active document per eligible published canonical', async () => {
    const [counts] = await fixtureQuery<{ eligible: number; active: number; max_active: number }>(connectionString, `
      select count(*) filter (where entity.publication_status = 'PUBLISHED')::int as eligible,
             count(document.id)::int as active,
             max(coalesce(per_entity.count, 0))::int as max_active
      from app.canonical_entities as entity
      left join app.search_documents as document on document.entity_id = entity.id and document.is_active
      left join lateral (
        select count(*)::int as count from app.search_documents as each_document
        where each_document.entity_id = entity.id and each_document.is_active
      ) as per_entity on true
    `);
    expect(counts).toEqual({ eligible: 6, active: 6, max_active: 1 });
  });

  it('constructs simple, English, and Swedish vectors with A>B>C>D weighting', async () => {
    const [row] = await fixtureQuery<{ fts: string }>(connectionString, `
      select app.build_search_document_fts(
        'Evergreen Pizzerias', 'Known Alias', 'Dining Pizzerias', 'Restauranger', '',
        'Gjuterigatan', 'Going Out', 'Aktiviteter', '', 'Venue Context', 'Quiet description'
      )::text as fts
    `);
    expect(row.fts).toMatch(/'evergreen':\d+A/);
    expect(row.fts).toMatch(/'pizzerias':\d+A/);
    expect(row.fts).toMatch(/'pizzeria':\d+B/);
    expect(row.fts).toMatch(/'restaurang':\d+B/);
    expect(row.fts).toMatch(/'gjuterigatan':\d+B/);
    expect(row.fts).toMatch(/'aktivitet':\d+C/);
    expect(row.fts).toMatch(/'description':\d+(?:\s|$)/);
  });

  it('represents bilingual direct and ancestor taxonomy content deterministically', async () => {
    const evergreen = await activeDocument(evergreenId);
    expect(evergreen.taxonomy_en_text).toContain('Dining');
    expect(evergreen.taxonomy_sv_text).toContain('Restauranger');
    expect(evergreen.embedding_text).toContain('Food & Dining');
    expect(evergreen.embedding_text).toContain('Mat och restauranger');
  });

  it('invalidates when a verified manual alias is added', async () => {
    const before = await activeDocument(evergreenId);
    const normalized = normalizeForSearch('Evergreen Pizza Jönköping');
    await fixtureQuery(connectionString, `
      insert into app.entity_aliases (
        entity_id, alias, alias_norm, alias_ascii, language, kind,
        verified, verified_by, verified_at
      ) values ($1, 'Evergreen Pizza Jönköping', $2, $3, 'sv', 'MANUAL', true, 'doc-reviewer', now())
    `, [evergreenId, normalized.preserving, normalized.accentless]);
    const report = await rebuildSearchDocuments(connectionString);
    const after = await activeDocument(evergreenId);
    expect(report.contentChanges).toBe(1);
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(after.aliases_text).toContain('Evergreen Pizza Jönköping');
  });

  it('invalidates when active direct taxonomy truth changes', async () => {
    const before = await activeDocument(evergreenId);
    const [node] = await fixtureQuery<{ id: string }>(connectionString, `
      select id from app.taxonomy_nodes
      where taxonomy_version = 'active-going-out.v1' and slug = 'attractions' and active
    `);
    await addManualTaxonomyMembership(connectionString, {
      entityId: evergreenId,
      taxonomyNodeId: node.id,
      taxonomyVersion: 'active-going-out.v1',
      reviewer: 'doc-taxonomy-reviewer',
      evidence: 'Explicit DOC-01 fixture review for lifecycle verification.',
    });
    await rebuildSearchDocuments(connectionString);
    const after = await activeDocument(evergreenId);
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(after.taxonomy_en_text).toContain('Attractions');
  });

  it('ignores non-projected source observation metadata changes', async () => {
    const before = await activeDocument(evergreenId);
    await fixtureQuery(connectionString, `
      update app.source_records set last_seen_at = last_seen_at + interval '1 second'
      where canonical_entity_id = $1
    `, [evergreenId]);
    const report = await rebuildSearchDocuments(connectionString);
    expect(report.contentChanges).toBe(0);
    expect((await activeDocument(evergreenId)).content_hash).toBe(before.content_hash);
  });

  it('invalidates when a provenance-backed address changes and restores deterministically', async () => {
    const before = await activeDocument(sajensId);
    const changed = structuredClone(originalOsm);
    const element = requiredElement(changed, 2271410640);
    element.tags['addr:housenumber'] = '10';
    await ingestOsm(changed);
    await applyTaxonomyMappings(connectionString);
    await selectCurrentFacts(sajensId, ['address']);
    await rebuildSearchDocuments(connectionString);
    const changedDocument = await activeDocument(sajensId);
    expect(changedDocument.content_hash).not.toBe(before.content_hash);
    expect(changedDocument.facts_text).toContain('Gjuterigatan 10');

    await ingestOsm(originalOsm);
    await applyTaxonomyMappings(connectionString);
    await selectCurrentFacts(sajensId, ['address']);
    await rebuildSearchDocuments(connectionString);
    expect((await activeDocument(sajensId)).content_hash).toBe(before.content_hash);
  });

  it('invalidates a canonical-name change selected through targeted provenance', async () => {
    const before = await activeDocument(tandoriId);
    const changed = structuredClone(originalOsm);
    requiredElement(changed, 2271413648).tags.name = 'Tandori Palace Jönköping';
    await ingestOsm(changed);
    await applyTaxonomyMappings(connectionString);
    await selectCurrentFacts(tandoriId, ['canonical_name']);
    await rebuildSearchDocuments(connectionString);
    expect((await activeDocument(tandoriId)).content_hash).not.toBe(before.content_hash);

    await ingestOsm(originalOsm);
    await applyTaxonomyMappings(connectionString);
    await selectCurrentFacts(tandoriId, ['canonical_name']);
    await rebuildSearchDocuments(connectionString);
    expect((await activeDocument(tandoriId)).content_hash).toBe(before.content_hash);
  });

  it('cannot reintroduce redacted prohibited content on rebuild', async () => {
    const prohibitedAlias = 'Evergreen Redaction Alias';
    const versionId = await createRedactableAliasEvidence(evergreenId, prohibitedAlias);
    await rebuildSearchDocuments(connectionString);
    expect((await activeDocument(evergreenId)).aliases_text).toContain(prohibitedAlias);
    await prepareLocalComplianceRuntime(connectionString);
    await redactSourceRecordVersion(
      connectionString,
      versionId,
      randomUUID(),
      'DOC01_REDACTION_TEST',
    );
    await rebuildSearchDocuments(connectionString);
    const active = await activeDocument(evergreenId);
    const history = await fixtureQuery<{ searchable_text: string }>(connectionString, `
      select concat_ws(' ', display_name, names_text, aliases_text, facts_text, embedding_text) as searchable_text
      from app.search_documents where entity_id = $1
    `, [evergreenId]);
    expect(active.display_name).toBe('Evergreen Restaurang & Pizzeria');
    expect(active.aliases_text).not.toContain(prohibitedAlias);
    expect(history.every(({ searchable_text }) => !searchable_text.includes(prohibitedAlias))).toBe(true);
  });

  it('leaves a WITHHELD entity without an active searchable document', async () => {
    await fixtureQuery(connectionString, `
      update app.canonical_entities
      set publication_status = 'WITHHELD', published_at = null
      where id = $1
    `, [municipalIds[0]]);
    const report = await rebuildSearchDocuments(connectionString);
    expect(report.deactivated).toBe(1);
    expect(await hasActiveDocument(municipalIds[0])).toBe(false);
  });

  it('deactivates the loser document when an entity becomes MERGED', async () => {
    expect(await hasActiveDocument(sajensId)).toBe(true);
    await fixtureQuery(connectionString, `
      update app.canonical_entities
      set publication_status = 'MERGED', merged_into_id = $2, published_at = null
      where id = $1
    `, [sajensId, evergreenId]);
    const report = await rebuildSearchDocuments(connectionString);
    expect(report.deactivated).toBe(1);
    expect(await hasActiveDocument(sajensId)).toBe(false);
  });
});

async function ingestOsm(fixture: OsmFixture): Promise<string> {
  const response = () => new Response(JSON.stringify({ elements: fixture.elements }));
  return (await runIngestion(store, new OsmOverpassAdapter({
    fetchImpl: (async () => response()) as typeof fetch,
    sleep: async () => undefined,
    now: fixedNow,
  }))).runId;
}

async function ingestMunicipal(): Promise<string> {
  return (await runIngestion(store, new JonkopingUtegymAdapter({
    fetchImpl: (async () => new Response(JSON.stringify({
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      features: municipalFixture.features,
      exceededTransferLimit: municipalFixture.exceededTransferLimit,
    }))) as typeof fetch,
    sleep: async () => undefined,
    now: fixedNow,
  }))).runId;
}

async function publishAllResolvedPlaces(runIds: string[]): Promise<void> {
  const entities = await fixtureQuery<{ entity_id: string }>(connectionString, `
    select distinct entity.id as entity_id
    from app.canonical_entities as entity
    join app.source_records as record on record.canonical_entity_id = entity.id
    join app.source_record_versions as version on version.id = record.current_version_id
    join app.entity_taxonomy_memberships as membership on membership.entity_id = entity.id and membership.active
    where entity.entity_type = 'PLACE' and version.capture_run_id = any($1::uuid[])
    order by entity.id
  `, [runIds]);
  for (const entity of entities) {
    await selectCurrentFacts(entity.entity_id, ['canonical_name', 'location', 'address', 'opening_hours']);
    await fixtureQuery(connectionString, `
      update app.canonical_entities
      set publication_status = 'PUBLISHED', published_at = coalesce(published_at, now())
      where id = $1
    `, [entity.entity_id]);
  }
}

async function selectCurrentFacts(entityId: string, factKeys: string[]): Promise<void> {
  const [evidence] = await fixtureQuery<{ version_id: string; output: unknown }>(connectionString, `
    select record.current_version_id as version_id, attempt.normalized_output as output
    from app.source_records as record
    join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
    where record.canonical_entity_id = $1
    order by record.id limit 1
  `, [entityId]);
  if (!evidence) throw new Error(`missing current evidence for ${entityId}`);
  for (const factKey of factKeys) {
    await fixtureQuery(connectionString, `
      select app.replace_targeted_canonical_fact(
        $1, $2::app.fact_key,
        app.extract_targeted_fact($3::jsonb, $2::app.fact_key, 'PLACE'),
        $4, 'SOURCE_PRECEDENCE', 'DOC-01 fixture', 'deterministic projection verification'
      )
      where app.extract_targeted_fact($3::jsonb, $2::app.fact_key, 'PLACE') is not null
    `, [entityId, factKey, JSON.stringify(evidence.output), evidence.version_id]);
  }
}

async function activeDocument(entityId: string): Promise<{
  template_version: string;
  content_hash: string;
  display_name: string;
  aliases_text: string;
  taxonomy_en_text: string;
  taxonomy_sv_text: string;
  facts_text: string;
  embedding_text: string;
}> {
  const rows = await fixtureQuery<{
    template_version: string; content_hash: string; display_name: string; aliases_text: string;
    taxonomy_en_text: string; taxonomy_sv_text: string; facts_text: string; embedding_text: string;
  }>(connectionString, `
    select template_version, content_hash, display_name, aliases_text,
           taxonomy_en_text, taxonomy_sv_text, facts_text, embedding_text
    from app.search_documents where entity_id = $1 and is_active
  `, [entityId]);
  if (rows.length !== 1) throw new Error(`expected one active document for ${entityId}`);
  return rows[0];
}

async function activeHashes(): Promise<Array<{ entity_id: string; content_hash: string }>> {
  return fixtureQuery(connectionString, `
    select entity_id, content_hash from app.search_documents where is_active order by entity_id
  `);
}

async function hasActiveDocument(entityId: string): Promise<boolean> {
  const [row] = await fixtureQuery<{ active: boolean }>(connectionString, `
    select exists (
      select 1 from app.search_documents where entity_id = $1 and is_active
    ) as active
  `, [entityId]);
  return row.active;
}

async function createRedactableAliasEvidence(entityId: string, alias: string): Promise<string> {
  const runId = randomUUID();
  const recordId = randomUUID();
  const versionId = randomUUID();
  const attemptId = randomUUID();
  const normalized = normalizeForSearch(alias);
  await fixtureQuery(connectionString, `
    insert into app.ingestion_runs (
      id, idempotency_key, source_id, scope_id, adapter_version, parser_version, mapping_version
    ) select $1, $2, source.id, scope.id, 'doc-redaction-v1', 'doc-redaction-v1', 'doc-redaction-v1'
      from app.sources as source
      cross join app.geographic_scopes as scope
      where source.key = 'OSM_OVERPASS' and scope.slug = 'jonkoping-municipality'
  `, [runId, `doc-redaction-${runId}`]);
  await fixtureQuery(connectionString, `
    insert into app.source_records (
      id, source_id, external_key, canonical_entity_id, resolution_method, first_seen_at, last_seen_at
    ) select $1, source.id, $2, $3, 'MANUAL_MAPPING', now(), now()
      from app.sources as source where source.key = 'OSM_OVERPASS'
  `, [recordId, `doc-redaction/${recordId}`, entityId]);
  await fixtureQuery(connectionString, `
    insert into app.source_record_versions (
      id, source_record_id, capture_run_id, content_hash, payload, payload_storage_mode,
      source_url, fetched_at, observed_at
    ) values ($1, $2, $3, repeat('d', 64), jsonb_build_object('name', $4::text),
      'EXTRACTED_ENVELOPE', 'https://example.invalid/doc-redaction', now(), now())
  `, [versionId, recordId, runId, alias]);
  await fixtureQuery(connectionString, `
    insert into app.source_record_parse_attempts (
      id, source_record_version_id, ingestion_run_id, parser_version
    ) values ($1, $2, $3, 'doc-redaction-v1')
  `, [attemptId, versionId, runId]);
  await fixtureQuery(connectionString, `
    update app.source_record_parse_attempts
    set status = 'SUCCEEDED', finished_at = now(),
        normalized_output = jsonb_build_object(
          'entityType', 'PLACE', 'names', jsonb_build_array(jsonb_build_object('value', $2::text))
        ),
        normalized_output_hash = repeat('e', 64)
    where id = $1
  `, [attemptId, alias]);
  await fixtureQuery(connectionString, `
    insert into app.entity_aliases (
      entity_id, alias, alias_norm, alias_ascii, language, kind,
      source_record_version_id, verified, verified_by, verified_at
    ) values ($1, $2, $3, $4, 'und', 'OFFICIAL', $5, true, 'doc-reviewer', now())
  `, [entityId, alias, normalized.preserving, normalized.accentless, versionId]);
  return versionId;
}

function requiredEntity(entities: EntityIdentity[], name: string): string {
  const entity = entities.find(({ canonical_name }) => canonical_name === name);
  if (!entity) throw new Error(`missing entity ${name}`);
  return entity.id;
}

function requiredElement(fixture: OsmFixture, id: number): OsmElement {
  const element = fixture.elements.find((candidate) => candidate.id === id);
  if (!element) throw new Error(`missing OSM fixture element ${id}`);
  return element;
}
