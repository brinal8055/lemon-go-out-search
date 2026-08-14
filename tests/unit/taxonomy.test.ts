import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addManualTaxonomyMembership,
  applyTaxonomyMappings,
  classifyCoverageStatus,
  fixtureDatabaseUrl,
  generateCoverageDocument,
  loadCoverageEvidence,
  loadSourceMappingCatalog,
  matchTaxonomyRules,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  prepareLocalTaxonomyRuntime,
  runIngestion,
  TAXONOMY_MAPPING_VERSION,
  TAXONOMY_VERSION,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import { JonkopingUtegymAdapter } from '../../packages/source-adapters/src/jonkoping-utegym.ts';
import { OsmOverpassAdapter } from '../../packages/source-adapters/src/osm.ts';
import type { CoverageReview, CoverageRunEvidence } from '../../packages/ingestion-domain/src/taxonomy-coverage.ts';

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const numericNamespace = Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 9), 16);
const municipalGuid = randomUUID();
const osmKeys = {
  indian: `node/${numericNamespace + 1}`,
  unknown: `node/${numericNamespace + 2}`,
  attraction: `node/${numericNamespace + 3}`,
};
const municipalKey = `layer-41/globalid/${municipalGuid}`;
let osmRunId: string;
let municipalRunId: string;
let indianEntityId: string;
let attractionEntityId: string;

beforeAll(async () => {
  await prepareLocalIngestionRuntime(connectionString);
  await prepareLocalTaxonomyRuntime(connectionString);
  const osm = new OsmOverpassAdapter({
    fetchImpl: (async () => jsonResponse({ elements: [
      osmElement(numericNamespace + 1, 'Explicit Indian Restaurant', { amenity: 'restaurant', cuisine: 'indian' }),
      osmElement(numericNamespace + 2, 'Unmapped International Restaurant', { amenity: 'restaurant', cuisine: 'international' }),
      osmElement(numericNamespace + 3, 'Explicit Attraction', { tourism: 'attraction' }),
    ] })) as typeof fetch,
    sleep: async () => undefined,
    now: () => new Date('2026-08-14T09:00:00Z'),
  });
  const municipal = new JonkopingUtegymAdapter({
    fetchImpl: (async () => jsonResponse({
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      features: [{
        attributes: {
          OBJECTID: 1,
          GlobalID: `{${municipalGuid.toUpperCase()}}`,
          name: 'Explicit Municipal Utegym',
          visit_url: 'https://www.jonkoping.se/',
          street: null,
          house_number: null,
          postcode: null,
          city: null,
          phone: null,
          andrad_datum: 1748345472000,
        },
        geometry: { x: 14.1618, y: 57.7826 },
      }],
      exceededTransferLimit: false,
    })) as typeof fetch,
    sleep: async () => undefined,
    now: () => new Date('2026-08-14T09:00:00Z'),
  });
  osmRunId = (await runIngestion(store, osm)).runId;
  municipalRunId = (await runIngestion(store, municipal)).runId;
  await applyTaxonomyMappings(connectionString);
  const entities = await fixtureQuery<{ external_key: string; canonical_entity_id: string }>(connectionString, `
    select record.external_key, record.canonical_entity_id
    from app.source_records as record
    join app.sources as source on source.id = record.source_id
    where (source.key = 'OSM_OVERPASS' and record.external_key = any($1::text[]))
       or (source.key = 'JONKOPING_MUNICIPAL_UTEGYM' and record.external_key = $2)
  `, [Object.values(osmKeys), municipalKey]);
  const byKey = new Map(entities.map((row) => [row.external_key, row.canonical_entity_id]));
  indianEntityId = required(byKey, osmKeys.indian);
  attractionEntityId = required(byKey, osmKeys.attraction);
});

afterAll(async () => {
  await store.close();
});

describe('TAX-01 source mapping catalogue', () => {
  it('validates the versioned catalogue and checksum against active REF-01 truth', async () => {
    const catalog = await loadSourceMappingCatalog();
    expect(catalog.mapping_version).toBe(TAXONOMY_MAPPING_VERSION);
    expect(catalog.taxonomy_version).toBe(TAXONOMY_VERSION);
    expect(catalog.mappingChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(catalog.rules.length).toBeGreaterThan(5);
  });

  it('references only nodes that exist and are active in the current taxonomy', async () => {
    const catalog = await loadSourceMappingCatalog();
    const activeSlugs = new Set(catalog.taxonomyNodes.filter(({ active }) => active).map(({ slug }) => slug));
    expect(catalog.rules.every(({ target_slug }) => activeSlugs.has(target_slug))).toBe(true);
  });

  it('uses only SOURCE_FACT and DETERMINISTIC_MAP automatic methods', async () => {
    const catalog = await loadSourceMappingCatalog();
    expect(new Set(catalog.rules.map(({ method }) => method))).toEqual(
      new Set(['SOURCE_FACT', 'DETERMINISTIC_MAP']),
    );
  });

  it('maps exact OSM facts and supports legitimate multi-label evidence', async () => {
    const catalog = await loadSourceMappingCatalog();
    const matches = matchTaxonomyRules(catalog, 'OSM_OVERPASS', ['amenity=restaurant', 'cuisine=indian']);
    expect(matches.map(({ target_slug }) => target_slug).sort()).toEqual(['dining', 'indian']);
  });

  it('does not invent a mapping for unknown source values', async () => {
    const catalog = await loadSourceMappingCatalog();
    expect(matchTaxonomyRules(catalog, 'OSM_OVERPASS', ['cuisine=international'])).toEqual([]);
  });

  it('maps municipal layer identity only to the justified sports node', async () => {
    const catalog = await loadSourceMappingCatalog();
    const matches = matchTaxonomyRules(
      catalog,
      'JONKOPING_MUNICIPAL_UTEGYM',
      ['municipal_layer=utegym'],
    );
    expect(matches.map(({ target_slug }) => target_slug)).toEqual(['sports']);
  });

  it('contains no legacy or AI-created mapping method', async () => {
    const catalog = await loadSourceMappingCatalog();
    expect(catalog.taxonomy_version).toBe('active-going-out.v1');
    expect(JSON.stringify(catalog.rules)).not.toContain('AI');
  });
});

describe('TAX-01 evidence-bearing membership operations', () => {
  it('persists the OSM multi-label membership without copying the entity', async () => {
    const rows = await membershipsFor(osmKeys.indian);
    expect(rows.map(({ slug }) => slug).sort()).toEqual(['dining', 'indian']);
  });

  it('leaves the ambiguous OSM cuisine unmapped while retaining the explicit restaurant parent', async () => {
    const rows = await membershipsFor(osmKeys.unknown);
    expect(rows.map(({ slug }) => slug)).toEqual(['dining']);
  });

  it('gives municipal Utegym only its evidence-backed sports membership', async () => {
    const rows = await membershipsFor(municipalKey);
    expect(rows.map(({ slug }) => slug)).toEqual(['sports']);
  });

  it('traces source memberships through exact versions to ingestion runs and mapping references', async () => {
    const rows = await fixtureQuery<{
      slug: string; method: string; capture_run_id: string; mapping_ref: string | null;
    }>(connectionString, `
      select node.slug, membership.method, version.capture_run_id, membership.mapping_ref
      from app.entity_taxonomy_memberships as membership
      join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
      join app.source_record_versions as version on version.id = membership.source_record_version_id
      where membership.entity_id = $1 and membership.active
      order by node.slug
    `, [indianEntityId]);
    expect(rows.find(({ slug }) => slug === 'indian')).toMatchObject({
      method: 'SOURCE_FACT', capture_run_id: osmRunId, mapping_ref: null,
    });
    expect(rows.find(({ slug }) => slug === 'dining')?.mapping_ref).toContain(TAXONOMY_MAPPING_VERSION);
  });

  it('reruns idempotently without duplicate active memberships', async () => {
    const before = await membershipsFor(osmKeys.indian);
    await applyTaxonomyMappings(connectionString);
    const after = await membershipsFor(osmKeys.indian);
    expect(after).toEqual(before);
  });

  it('provides a controlled evidence-bearing MANUAL path and idempotent review', async () => {
    const [node] = await fixtureQuery<{ id: string }>(connectionString, `
      select id from app.taxonomy_nodes where taxonomy_version = $1 and slug = 'attractions' and active
    `, [TAXONOMY_VERSION]);
    const first = await addManualTaxonomyMembership(connectionString, {
      entityId: indianEntityId,
      taxonomyNodeId: node.id,
      taxonomyVersion: TAXONOMY_VERSION,
      reviewer: 'taxonomy-human-reviewer',
      evidence: 'Explicit reviewed local classification evidence.',
    });
    const second = await addManualTaxonomyMembership(connectionString, {
      entityId: indianEntityId,
      taxonomyNodeId: node.id,
      taxonomyVersion: TAXONOMY_VERSION,
      reviewer: 'taxonomy-human-reviewer',
      evidence: 'Explicit reviewed local classification evidence.',
    });
    const [membership] = await fixtureQuery<{
      method: string; source_record_version_id: string | null; manual_evidence: string; reviewed_by: string;
    }>(connectionString, 'select method, source_record_version_id, manual_evidence, reviewed_by from app.entity_taxonomy_memberships where id = $1', [first]);
    expect(second).toBe(first);
    expect(membership).toMatchObject({
      method: 'MANUAL', source_record_version_id: null, reviewed_by: 'taxonomy-human-reviewer',
    });
    expect(membership.manual_evidence).toContain(`taxonomy=${TAXONOMY_VERSION}`);
  });

  it('expands an active parent to descendants with direct and leaf metadata', async () => {
    const [parent] = await fixtureQuery<{ id: string }>(connectionString, `
      select id from app.taxonomy_nodes where taxonomy_version = $1 and slug = 'activities-and-experiences'
    `, [TAXONOMY_VERSION]);
    const rows = await fixtureQuery<{
      slug: string; hierarchy_distance: number; is_requested_node: boolean; is_leaf: boolean; inclusion_kind: string;
    }>(connectionString, `
      select node.slug, expansion.hierarchy_distance, expansion.is_requested_node,
             expansion.is_leaf, expansion.inclusion_kind
      from app.active_taxonomy_expansion($1) as expansion
      join app.taxonomy_nodes as node on node.id = expansion.taxonomy_node_id
      order by node.slug
    `, [parent.id]);
    expect(rows.find(({ slug }) => slug === 'activities-and-experiences')).toMatchObject({
      hierarchy_distance: 0, is_requested_node: true, inclusion_kind: 'DIRECT',
    });
    expect(rows.find(({ slug }) => slug === 'sports')).toMatchObject({
      hierarchy_distance: 1, is_requested_node: false, is_leaf: true, inclusion_kind: 'DESCENDANT',
    });
  });

  it('keeps a requested leaf directly identifiable without synthetic memberships', async () => {
    const [sports] = await fixtureQuery<{ id: string }>(connectionString, `
      select id from app.taxonomy_nodes where taxonomy_version = $1 and slug = 'sports'
    `, [TAXONOMY_VERSION]);
    const rows = await fixtureQuery<{
      taxonomy_node_id: string; hierarchy_distance: number; is_requested_node: boolean; is_leaf: boolean;
    }>(connectionString, 'select * from app.active_taxonomy_expansion($1)', [sports.id]);
    expect(rows).toEqual([expect.objectContaining({
      taxonomy_node_id: sports.id,
      hierarchy_distance: 0,
      is_requested_node: true,
      is_leaf: true,
    })]);
  });

  it('does not expose controlled membership functions to public API roles', async () => {
    const [privileges] = await fixtureQuery<{ private: boolean }>(connectionString, `
      select not has_function_privilege('anon', 'app.apply_source_taxonomy_membership(uuid,uuid,uuid,uuid,app.taxonomy_membership_method,text)', 'EXECUTE')
         and not has_function_privilege('authenticated', 'app.add_manual_taxonomy_membership(uuid,uuid,text,text,text,uuid)', 'EXECUTE') as private
    `);
    expect(privileges.private).toBe(true);
  });
});

describe('TAX-01 truthful coverage', () => {
  const successfulRun: CoverageRunEvidence = {
    id: '10000000-0000-0000-0000-000000000001',
    sourceKey: 'OSM_OVERPASS',
    status: 'SUCCEEDED',
    refreshUnitComplete: true,
    fetched: 5,
    valid: 5,
    invalid: 0,
  };
  const reviewed = (status: CoverageReview['status']): CoverageReview => ({
    leaf_slug: 'indian',
    status,
    reviewed_by: 'human-reviewer',
    reviewed_at: '2026-08-14T10:00:00Z',
    notes: 'Reviewed bounded source evidence.',
    source_keys: ['OSM_OVERPASS'],
    ingestion_run_ids: [successfulRun.id],
  });

  it('marks COMPLETE only for reviewed target-range inventory', () => {
    expect(classifyCoverageStatus(5, reviewed('COMPLETE'), [successfulRun])).toBe('COMPLETE');
    expect(classifyCoverageStatus(4, reviewed('COMPLETE'), [successfulRun])).toBe('NEEDS_VALIDATION');
  });

  it('requires an explicit stopping reason for SUPPLY_CONSTRAINED', () => {
    const review = reviewed('SUPPLY_CONSTRAINED');
    expect(classifyCoverageStatus(2, review, [successfulRun])).toBe('NEEDS_VALIDATION');
    review.stop_reason = 'SOURCES_EXHAUSTED';
    expect(classifyCoverageStatus(2, review, [successfulRun])).toBe('SUPPLY_CONSTRAINED');
  });

  it('uses NEEDS_VALIDATION when source/run evidence is insufficient', () => {
    expect(classifyCoverageStatus(7, undefined, [successfulRun])).toBe('NEEDS_VALIDATION');
    expect(classifyCoverageStatus(7, reviewed('COMPLETE'), [])).toBe('NEEDS_VALIDATION');
  });

  it('loads an intentionally conservative reviewed-evidence file', async () => {
    const evidence = await loadCoverageEvidence();
    expect(evidence.coverage_version).toBe('taxonomy-coverage.v1');
    expect(evidence.leaf_reviews).toEqual([]);
  });

  it('reports every active leaf exactly once with target 5–10', async () => {
    const catalog = await loadSourceMappingCatalog();
    const document = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    const expectedLeaves = catalog.taxonomyNodes.filter(({ active, is_leaf }) => active && is_leaf).length;
    expect(document.leaves).toHaveLength(expectedLeaves);
    expect(new Set(document.leaves.map(({ taxonomyLeafId }) => taxonomyLeafId)).size).toBe(expectedLeaves);
    expect(document.leaves.every(({ targetMin, targetMax }) => targetMin === 5 && targetMax === 10)).toBe(true);
  });

  it('keeps coverage content deterministic when only evaluation time changes', async () => {
    const first = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    const second = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T11:00:00Z' });
    expect(second.contentChecksum).toBe(first.contentChecksum);
    expect(second.generatedAt).not.toBe(first.generatedAt);
  });

  it('counts unique eligible published canonicals and ignores duplicate SourceRecords and merged entities', async () => {
    await fixtureQuery(connectionString, `
      update app.canonical_entities
      set publication_status = 'PUBLISHED', published_at = now()
      where id = any($1::uuid[])
    `, [[indianEntityId, attractionEntityId]]);
    const beforeMerge = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    const beforeCount = requiredLeaf(beforeMerge, 'attractions').canonicalPublishedCount;
    await fixtureQuery(connectionString, `
      insert into app.source_records (
        source_id, external_key, canonical_entity_id, resolution_method, first_seen_at, last_seen_at
      ) select source.id, $1, $2, 'MANUAL_MAPPING', now(), now()
        from app.sources as source where source.key = 'OSM_OVERPASS'
    `, [`taxonomy-duplicate-${randomUUID()}`, indianEntityId]);
    const withDuplicateRecord = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    expect(requiredLeaf(withDuplicateRecord, 'attractions').canonicalPublishedCount).toBe(beforeCount);

    await fixtureQuery(connectionString, `
      update app.canonical_entities
      set publication_status = 'MERGED', merged_into_id = $2
      where id = $1
    `, [attractionEntityId, indianEntityId]);
    const afterMerge = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    expect(requiredLeaf(afterMerge, 'attractions').canonicalPublishedCount).toBe(beforeCount - 1);
    expect(new Set(requiredLeaf(afterMerge, 'attractions').supportingEntityIds).size)
      .toBe(requiredLeaf(afterMerge, 'attractions').supportingEntityIds.length);
  });

  it('retains source/run evidence for leaves with exercised mapping rules', async () => {
    const document = await generateCoverageDocument(connectionString, { generatedAt: '2026-08-14T10:00:00Z' });
    expect(requiredLeaf(document, 'indian')).toMatchObject({
      sourceKeys: expect.arrayContaining(['OSM_OVERPASS']),
      ingestionRunIds: expect.arrayContaining([osmRunId]),
      status: 'NEEDS_VALIDATION',
    });
    expect(requiredLeaf(document, 'sports')).toMatchObject({
      sourceKeys: expect.arrayContaining(['JONKOPING_MUNICIPAL_UTEGYM']),
      ingestionRunIds: expect.arrayContaining([municipalRunId]),
      status: 'NEEDS_VALIDATION',
    });
  });
});

async function membershipsFor(externalKey: string): Promise<Array<{
  id: string; slug: string; method: string; source_record_version_id: string | null; mapping_ref: string | null;
}>> {
  return fixtureQuery(connectionString, `
    select membership.id, node.slug, membership.method,
           membership.source_record_version_id, membership.mapping_ref
    from app.source_records as record
    join app.entity_taxonomy_memberships as membership
      on membership.entity_id = record.canonical_entity_id and membership.active
    join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
    where record.external_key = $1
    order by node.slug, membership.id
  `, [externalKey]);
}

function osmElement(id: number, name: string, tags: Record<string, string>): Record<string, unknown> {
  return {
    type: 'node',
    id,
    version: 1,
    timestamp: '2026-08-14T09:00:00Z',
    lat: 57.7826,
    lon: 14.1618,
    tags: { name, ...tags },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function required(values: Map<string, string>, key: string): string {
  const value = values.get(key);
  if (!value) throw new Error(`missing fixture entity ${key}`);
  return value;
}

function requiredLeaf(document: Awaited<ReturnType<typeof generateCoverageDocument>>, slug: string) {
  const leaf = document.leaves.find(({ leafSlug }) => leafSlug === slug);
  if (!leaf) throw new Error(`missing coverage leaf ${slug}`);
  return leaf;
}
