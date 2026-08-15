import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const outputDirectory = resolve('artifacts/coverage');
const frozenClockUtc = '2026-10-15T12:00:00Z';
const client = new Client({ connectionString });
await client.connect();

type Seed = { entityId: string; displayName: string };
type TaxonomySeed = { id: string; slug: string; entityCount: number };
type Result = {
  result_position: number;
  entity_id: string;
  entity_type: 'PLACE' | 'EVENT';
  display_name: string;
  semantic_used: boolean;
  semantic_degraded: boolean;
};
type Smoke = {
  key: string;
  family: string;
  query: string;
  locale: 'en' | 'sv';
  taxonomySlug: string | null;
  resultCount: number;
  topResults: Array<{ position: number; id: string; type: string; name: string }>;
  semanticDegraded: boolean;
  obviousEligibilityViolationCount: number;
  duplicateCanonicalIdCount: number;
  diagnosticStages: string;
};

let smokes: Smoke[];
try {
  await client.query('begin isolation level repeatable read read only');
  const seed = (await client.query<Seed>(`
    select entity.id as "entityId", entity.canonical_name as "displayName"
      from app.canonical_entities as entity
      join app.places as place on place.entity_id = entity.id
      join app.search_documents as document on document.entity_id = entity.id and document.is_active
     where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
       and place.status <> 'CLOSED'
     order by entity.canonical_name_norm, entity.id
     limit 1
  `)).rows[0];
  if (!seed) throw new Error('no legitimate searchable Place is available for real search smoke');
  const taxonomySeed = (await client.query<TaxonomySeed>(`
    select node.id, node.slug, count(distinct document.entity_id)::int as "entityCount"
      from app.taxonomy_nodes as node
      join app.entity_taxonomy_memberships as membership
        on membership.taxonomy_node_id = node.id and membership.active
      join app.search_documents as document on document.entity_id = membership.entity_id and document.is_active
     where node.active and node.is_leaf and node.slug <> 'events'
     group by node.id
    having count(distinct document.entity_id) >= 2
     order by count(distinct document.entity_id) desc, node.slug
     limit 1
  `)).rows[0];
  if (!taxonomySeed) throw new Error('no active leaf has multiple legitimate searchable entities');
  const events = (await client.query<{ id: string; slug: string }>(`
    select id, slug from app.taxonomy_nodes
     where active and taxonomy_version = 'active-going-out.v1' and slug = 'events'
  `)).rows[0];
  if (!events) throw new Error('active Event leaf is unavailable');

  const prefix = seed.displayName.slice(0, Math.max(2, Math.min(6, seed.displayName.length - 1)));
  const typo = seed.displayName.length >= 4
    ? `${seed.displayName.slice(0, 1)}${seed.displayName.slice(2)}`
    : prefix;
  const now = new Date();
  const eventEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const cases = [
    { key: 'A', family: 'direct_real_place_name', query: seed.displayName, locale: 'sv' as const },
    { key: 'B', family: 'prefix_typo_real_place', query: typo, locale: 'sv' as const },
    { key: 'C', family: 'broad_food_dining', query: 'mat', locale: 'sv' as const },
    { key: 'D', family: 'active_leaf_multiple_entities', query: '', locale: 'en' as const, taxonomyId: taxonomySeed.id, taxonomySlug: taxonomySeed.slug },
    { key: 'E', family: 'broad_activity_discovery', query: 'aktiviteter', locale: 'sv' as const },
    { key: 'F', family: 'en_semantic_occasion', query: 'cozy place for a date', locale: 'en' as const },
    { key: 'G', family: 'sv_semantic_occasion', query: 'mysigt ställe för en dejt', locale: 'sv' as const },
    { key: 'H', family: 'event_time', query: '', locale: 'sv' as const, taxonomyId: events.id, taxonomySlug: events.slug, timeStart: now.toISOString(), timeEnd: eventEnd.toISOString() },
    { key: 'I', family: 'mixed_result_broad', query: 'aktiviteter', locale: 'sv' as const },
    { key: 'J', family: 'noncollapse_capable_broad', query: 'restaurang', locale: 'sv' as const },
  ];

  smokes = [];
  for (const input of cases) {
    const results = (await client.query<Result>(`
      select result_position, entity_id, entity_type::text, display_name,
             semantic_used, semantic_degraded
        from api.search_v1(
          $1::uuid, $2::text, app.norm_v1_preserving($2::text), app.norm_v1_accentless($2::text),
          $3::text, (select id from app.geographic_scopes where slug = 'jonkoping-municipality'),
          null::double precision, null::double precision, null::integer, $4::uuid,
          null::app.entity_type[], $5::timestamptz, $6::timestamptz, null::extensions.vector,
          (select embedding_provider from app.search_configs where is_active),
          (select embedding_model from app.search_configs where is_active),
          (select embedding_revision from app.search_configs where is_active),
          (select embedding_dimension::integer from app.search_configs where is_active),
          10::smallint,
          (select version from app.search_configs where is_active)
        )
       order by result_position
    `, [randomUUID(), input.query, input.locale, input.taxonomyId ?? null, input.timeStart ?? null, input.timeEnd ?? null])).rows;
    const uniqueIds = new Set(results.map((result) => result.entity_id));
    const obviousEligibilityViolationCount = results.filter((result) => (
      !result.entity_id || !result.display_name || !['PLACE', 'EVENT'].includes(result.entity_type)
    )).length;
    smokes.push({
      key: input.key,
      family: input.family,
      query: input.query,
      locale: input.locale,
      taxonomySlug: input.taxonomySlug ?? null,
      resultCount: results.length,
      topResults: results.slice(0, 5).map((result) => ({
        position: result.result_position,
        id: result.entity_id,
        type: result.entity_type,
        name: result.display_name,
      })),
      semanticDegraded: results.length === 0 || results.some((result) => result.semantic_degraded),
      obviousEligibilityViolationCount,
      duplicateCanonicalIdCount: results.length - uniqueIds.size,
      diagnosticStages: 'RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE',
    });
  }
  await client.query('commit');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

const report = {
  reportVersion: 'coverage-01-real-search-smoke.v1',
  generatedAt: new Date().toISOString(),
  selectionPolicy: 'QUERY_FAMILY_AND_RESULTING_LEGITIMATE_INVENTORY_ONLY',
  tuningPerformed: false,
  frozenClockUtc,
  frozenClockEventInventoryStatus: 'EVENT_DEV_REAL_INVENTORY_UNAVAILABLE_AT_FROZEN_CLOCK',
  smokes,
};
const checksum = createHash('sha256').update(JSON.stringify(report)).digest('hex');
const document = { ...report, reportChecksum: checksum };
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(resolve(outputDirectory, 'real-search-smoke.v1.json'), `${JSON.stringify(document, null, 2)}\n`),
  writeFile(resolve(outputDirectory, 'real-search-smoke.v1.md'), renderMarkdown(document)),
]);
console.log(JSON.stringify({ smokes: smokes.length, reportChecksum: checksum }));

function renderMarkdown(document: typeof report & { reportChecksum: string }): string {
  const sections = document.smokes.map((smoke) => (
    `## ${smoke.key}. ${smoke.family}\n\n`
    + `- Query: \`${smoke.query || '(taxonomy/time filter only)'}\`\n`
    + `- Locale / taxonomy: \`${smoke.locale}\` / \`${smoke.taxonomySlug ?? 'none'}\`\n`
    + `- Results / semantic degraded / eligibility violations / duplicate IDs: `
    + `\`${smoke.resultCount} / ${smoke.semanticDegraded} / ${smoke.obviousEligibilityViolationCount} / ${smoke.duplicateCanonicalIdCount}\`\n`
    + `- Top results: \`${JSON.stringify(smoke.topResults)}\`\n`
    + `- Diagnostics: \`${smoke.diagnosticStages}\`\n`
  )).join('\n');
  return `# COVERAGE-01 real search smoke\n\n`
    + `- Generated: \`${document.generatedAt}\`\n`
    + `- Selection: \`${document.selectionPolicy}\`\n`
    + `- Tuning performed: \`${document.tuningPerformed}\`\n`
    + `- Report checksum: \`${document.reportChecksum}\`\n\n${sections}`;
}
