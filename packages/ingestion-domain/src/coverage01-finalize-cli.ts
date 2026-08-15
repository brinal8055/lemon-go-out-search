import { writeFile } from 'node:fs/promises';

import pg from 'pg';

import {
  COVERAGE_VERSION,
  fixtureDatabaseUrl,
  loadSourceMappingCatalog,
} from './index.ts';

const { Client } = pg;
const connectionString = fixtureDatabaseUrl();
const catalog = await loadSourceMappingCatalog();
const client = new Client({ connectionString });
await client.connect();

type Run = {
  id: string;
  sourceKey: string;
  status: string;
  refreshUnitComplete: boolean;
  fetched: number;
  valid: number;
  invalid: number;
  finishedAt: string;
};

let runs: Run[];
let counts: Array<{ slug: string; count: number }>;
try {
  runs = (await client.query<Run>(`
    select distinct on (source.key)
           run.id, source.key as "sourceKey", run.status::text,
           run.refresh_unit_complete as "refreshUnitComplete",
           run.fetched, run.valid, run.invalid, run.finished_at as "finishedAt"
      from app.ingestion_runs as run
      join app.sources as source on source.id = run.source_id
     where source.key in ('OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM', 'JONKOPING_EVENT_CALENDAR')
       and run.refresh_unit_complete
     order by source.key, run.finished_at desc, run.id
  `)).rows;
  counts = (await client.query<{ slug: string; count: number }>(`
    select node.slug, count(distinct entity.id)::int as count
      from app.taxonomy_nodes as node
      left join app.entity_taxonomy_memberships as membership
        on membership.taxonomy_node_id = node.id and membership.active
      left join app.canonical_entities as entity
        on entity.id = membership.entity_id
       and entity.publication_status = 'PUBLISHED'
       and entity.merged_into_id is null
     where node.active and node.is_leaf and node.taxonomy_version = 'active-going-out.v1'
     group by node.id
     order by node.path, node.id
  `)).rows;
} finally {
  await client.end();
}

const runBySource = new Map(runs.map((run) => [run.sourceKey, run]));
for (const sourceKey of ['OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM', 'JONKOPING_EVENT_CALENDAR']) {
  if (!runBySource.has(sourceKey)) throw new Error(`missing final coverage run for ${sourceKey}`);
}
for (const sourceKey of ['OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM']) {
  if (runBySource.get(sourceKey)?.status !== 'SUCCEEDED') {
    throw new Error(`final coverage run is not successful for ${sourceKey}`);
  }
}
const countBySlug = new Map(counts.map((row) => [row.slug, row.count]));
const leaves = catalog.taxonomyNodes.filter((node) => node.active && node.is_leaf);
const generatedAt = new Date().toISOString();
const leafReviews = leaves.map((leaf) => {
  const count = countBySlug.get(leaf.slug) ?? 0;
  const sourceKeys = leaf.slug === 'events'
    ? ['JONKOPING_EVENT_CALENDAR']
    : leaf.slug === 'sports'
      ? ['JONKOPING_MUNICIPAL_UTEGYM', 'OSM_OVERPASS']
      : ['OSM_OVERPASS'];
  const sourceRuns = sourceKeys.map((sourceKey) => runBySource.get(sourceKey)!);
  const sourceRunsSucceeded = sourceRuns.every((run) => run.status === 'SUCCEEDED');
  const runSummary = sourceRuns.map((run) => (
    `${run.sourceKey} run ${run.id}: fetched=${run.fetched}, valid=${run.valid}, invalid=${run.invalid}`
  )).join('; ');
  return {
    leaf_slug: leaf.slug,
    status: sourceRunsSucceeded
      ? (count >= 5 ? 'COMPLETE' : 'SUPPLY_CONSTRAINED')
      : 'NEEDS_VALIDATION',
    reviewed_by: 'COVERAGE-01-BOUNDED-STOPPING-RULE',
    reviewed_at: generatedAt,
    notes: !sourceRunsSucceeded
      ? `${count} legitimate published entities remain searchable, but the bounded source run completed ${sourceRuns.map((run) => run.status).join('/')} because unsupported or invalid source observations were skipped. ${runSummary}.`
      : count >= 5
      ? `${count} legitimate published entities meet the coverage minimum after approved full-scope acquisition. ${runSummary}.`
      : `${count} legitimate published entities remained after approved full-scope acquisition; existing bounded source classes were exhausted without stretching taxonomy truth. ${runSummary}.`,
    source_keys: sourceKeys,
    ingestion_run_ids: sourceRuns.map((run) => run.id),
    ...(sourceRunsSucceeded && count < 5 ? { stop_reason: 'SOURCES_EXHAUSTED' } : {}),
  };
});
const evidence = {
  coverage_version: COVERAGE_VERSION,
  taxonomy_version: catalog.taxonomy_version,
  taxonomy_checksum: catalog.taxonomy_checksum,
  leaf_reviews: leafReviews,
};
const output = new URL('../../../reference/taxonomy/coverage-evidence.v1.json', import.meta.url);
await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({
  leaves: leafReviews.length,
  complete: leafReviews.filter(({ status }) => status === 'COMPLETE').length,
  supplyConstrained: leafReviews.filter(({ status }) => status === 'SUPPLY_CONSTRAINED').length,
  needsValidation: leafReviews.filter(({ status }) => status === 'NEEDS_VALIDATION').length,
  runIds: Object.fromEntries(runs.map((run) => [run.sourceKey, run.id])),
}));
