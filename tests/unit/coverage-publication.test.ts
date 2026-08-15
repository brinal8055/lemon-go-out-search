import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applyTaxonomyMappings,
  fixtureDatabaseUrl,
  PostgresIngestionStore,
  prepareLocalIngestionRuntime,
  prepareLocalTaxonomyRuntime,
  runIngestion,
} from '../../packages/ingestion-domain/src/index.ts';
import { fixtureQuery } from '../../packages/ingestion-domain/src/testing.ts';
import { OsmOverpassAdapter } from '../../packages/source-adapters/src/osm.ts';
import { publishEligiblePlaces } from '../../packages/source-adapters/src/publish-eligible-places.ts';

const connectionString = fixtureDatabaseUrl();
const store = new PostgresIngestionStore(connectionString);
const nodeId = Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 10), 16);
let runId: string;

beforeAll(async () => {
  await prepareLocalIngestionRuntime(connectionString);
  await prepareLocalTaxonomyRuntime(connectionString);
  const adapter = new OsmOverpassAdapter({
    fetchImpl: (async () => Response.json({ elements: [{
      type: 'node', id: nodeId, version: 1, timestamp: '2026-08-15T10:00:00Z',
      lat: 57.7826, lon: 14.1618,
      tags: { name: 'COVERAGE-01 publication fixture', amenity: 'restaurant', cuisine: 'italian;pizza' },
    }] })) as typeof fetch,
    sleep: async () => undefined,
    now: () => new Date('2026-08-15T10:00:00Z'),
  });
  runId = (await runIngestion(store, adapter)).runId;
  await applyTaxonomyMappings(connectionString);
});

afterAll(async () => {
  await store.close();
});

describe('COVERAGE-01 eligible Place publication', () => {
  it('publishes through evidence, deterministic taxonomy, and DOC-01 projection', async () => {
    const first = await publishEligiblePlaces(connectionString, { captureRunIds: [runId] });
    expect(first).toMatchObject({ candidates: 1, published: 1, documentsCreated: 1 });
    const [entity] = await fixtureQuery<{
      publication_status: string; active_documents: number; fact_keys: string[]; taxonomy_slugs: string[];
    }>(connectionString, `
      select entity.publication_status::text,
             count(distinct document.id)::int as active_documents,
             array_agg(distinct provenance.fact_key::text order by provenance.fact_key::text) as fact_keys,
             array_agg(distinct node.slug order by node.slug) as taxonomy_slugs
        from app.source_records as record
        join app.sources as source on source.id = record.source_id
        join app.canonical_entities as entity on entity.id = record.canonical_entity_id
        join app.search_documents as document on document.entity_id = entity.id and document.is_active
        join app.canonical_fact_provenance as provenance on provenance.entity_id = entity.id and provenance.is_current
        join app.entity_taxonomy_memberships as membership on membership.entity_id = entity.id and membership.active
        join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
       where source.key = 'OSM_OVERPASS' and record.external_key = $1
       group by entity.id
    `, [`node/${nodeId}`]);
    expect(entity.publication_status).toBe('PUBLISHED');
    expect(entity.active_documents).toBe(1);
    expect(entity.fact_keys).toEqual(expect.arrayContaining(['canonical_name', 'location']));
    expect(entity.taxonomy_slugs).toEqual(['dining', 'italian', 'pizza']);
  });

  it('is idempotent for unchanged current evidence and projection truth', async () => {
    const rerun = await publishEligiblePlaces(connectionString, { captureRunIds: [runId] });
    expect(rerun).toMatchObject({ candidates: 1, published: 1, documentsUnchanged: 1, embeddingsStaled: 0 });
  });
});
