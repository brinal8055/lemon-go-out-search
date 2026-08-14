import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import type { QueryResultRow } from 'pg';
import type { SourceMappingCatalog } from './taxonomy-mapping.ts';
import { loadSourceMappingCatalog, TAXONOMY_VERSION } from './taxonomy-mapping.ts';

const { Client } = pg;
const COVERAGE_EVIDENCE_PATH = new URL('../../../reference/taxonomy/coverage-evidence.v1.json', import.meta.url);

export const COVERAGE_VERSION = 'taxonomy-coverage.v1';
export const COVERAGE_TARGET_MIN = 5 as const;
export const COVERAGE_TARGET_MAX = 10 as const;

export type CoverageStatus = 'COMPLETE' | 'SUPPLY_CONSTRAINED' | 'NEEDS_VALIDATION';
export type ScarcityStopReason = 'SOURCES_EXHAUSTED' | 'NO_INCREMENTAL_SUPPLY' | 'AUTHORITATIVE_LOW_SUPPLY';

export type CoverageReview = {
  leaf_slug: string;
  status: CoverageStatus;
  reviewed_by: string;
  reviewed_at: string;
  notes: string;
  source_keys: string[];
  ingestion_run_ids: string[];
  stop_reason?: ScarcityStopReason;
};

export type CoverageRunEvidence = {
  id: string;
  sourceKey: string;
  status: string;
  refreshUnitComplete: boolean;
  fetched: number;
  valid: number;
  invalid: number;
};

export type CoverageLeaf = {
  taxonomyLeafId: string;
  leafSlug: string;
  labelEn: string;
  labelSv: string;
  taxonomyVersion: string;
  taxonomyChecksum: string;
  boundaryVersion: string;
  targetMin: 5;
  targetMax: 10;
  canonicalPublishedCount: number;
  sourceKeys: string[];
  ingestionRunIds: string[];
  mappingRuleIds: string[];
  supportingEntityIds: string[];
  status: CoverageStatus;
  stopReason: ScarcityStopReason | null;
  notes: string;
  generatedAt: string;
};

export type CoverageDocument = {
  coverageVersion: string;
  taxonomyVersion: string;
  taxonomyChecksum: string;
  boundaryVersion: string;
  generatedAt: string;
  contentChecksum: string;
  target: { min: 5; max: 10 };
  statusCounts: Record<CoverageStatus, number>;
  leaves: CoverageLeaf[];
};

type CoverageEvidenceFile = {
  coverage_version: string;
  taxonomy_version: string;
  taxonomy_checksum: string;
  leaf_reviews: CoverageReview[];
};

type LeafRow = QueryResultRow & {
  id: string;
  slug: string;
  label_en: string;
  label_sv: string;
  taxonomy_version: string;
  taxonomy_checksum: string;
  supporting_entity_ids: string[];
};

type RunRow = QueryResultRow & {
  id: string;
  source_key: string;
  status: string;
  refresh_unit_complete: boolean;
  fetched: number;
  valid: number;
  invalid: number;
};

export async function loadCoverageEvidence(
  catalog?: SourceMappingCatalog,
): Promise<CoverageEvidenceFile> {
  catalog ??= await loadSourceMappingCatalog();
  const value: unknown = JSON.parse(await readFile(COVERAGE_EVIDENCE_PATH, 'utf8'));
  if (!isObject(value)
    || value.coverage_version !== COVERAGE_VERSION
    || value.taxonomy_version !== catalog.taxonomy_version
    || value.taxonomy_checksum !== catalog.taxonomy_checksum
    || !Array.isArray(value.leaf_reviews)) {
    throw new Error('coverage evidence identity does not match active taxonomy');
  }
  const reviews = value.leaf_reviews.map(readCoverageReview);
  if (new Set(reviews.map(({ leaf_slug }) => leaf_slug)).size !== reviews.length) {
    throw new Error('coverage evidence contains duplicate leaf reviews');
  }
  const activeLeaves = new Set(catalog.taxonomyNodes
    .filter(({ active, is_leaf }) => active && is_leaf)
    .map(({ slug }) => slug));
  if (reviews.some(({ leaf_slug }) => !activeLeaves.has(leaf_slug))) {
    throw new Error('coverage evidence references a missing, inactive, or non-leaf taxonomy node');
  }
  return {
    coverage_version: value.coverage_version,
    taxonomy_version: value.taxonomy_version,
    taxonomy_checksum: value.taxonomy_checksum,
    leaf_reviews: reviews,
  };
}

export function classifyCoverageStatus(
  count: number,
  review: CoverageReview | undefined,
  availableRuns: CoverageRunEvidence[],
): CoverageStatus {
  if (!review || review.status === 'NEEDS_VALIDATION') return 'NEEDS_VALIDATION';
  const runById = new Map(availableRuns.map((run) => [run.id, run]));
  const reviewedRuns = review.ingestion_run_ids.map((id) => runById.get(id));
  const reviewedRunSources = new Set(reviewedRuns.flatMap((run) => run ? [run.sourceKey] : []));
  const evidenceIsSufficient = review.notes.trim() !== ''
    && review.source_keys.length > 0
    && review.ingestion_run_ids.length > 0
    && reviewedRuns.every((run) => run !== undefined
      && run.status === 'SUCCEEDED'
      && run.refreshUnitComplete
      && review.source_keys.includes(run.sourceKey))
    && review.source_keys.every((sourceKey) => reviewedRunSources.has(sourceKey));
  if (!evidenceIsSufficient) return 'NEEDS_VALIDATION';
  if (review.status === 'COMPLETE') {
    return count >= COVERAGE_TARGET_MIN && count <= COVERAGE_TARGET_MAX
      ? 'COMPLETE'
      : 'NEEDS_VALIDATION';
  }
  return count < COVERAGE_TARGET_MIN && review.stop_reason !== undefined
    ? 'SUPPLY_CONSTRAINED'
    : 'NEEDS_VALIDATION';
}

export async function generateCoverageDocument(
  connectionString: string,
  options: {
    generatedAt?: string;
    catalog?: SourceMappingCatalog;
    evidence?: CoverageEvidenceFile;
  } = {},
): Promise<CoverageDocument> {
  const catalog = options.catalog ?? await loadSourceMappingCatalog();
  const evidence = options.evidence ?? await loadCoverageEvidence(catalog);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('coverage generatedAt must be an ISO timestamp');
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set transaction isolation level repeatable read read only');
    await client.query('set local role lemon_reviewer');
    const boundary = (await client.query<{ version: string }>(`
      select boundary.version
      from app.geographic_scope_boundaries as boundary
      join app.geographic_scopes as scope on scope.id = boundary.scope_id
      where scope.slug = 'jonkoping-municipality' and boundary.is_active
    `)).rows;
    if (boundary.length !== 1) throw new Error('coverage requires exactly one active Jönköping boundary');
    const leaves = (await client.query<LeafRow>(`
      select node.id, node.slug, node.label_en, node.label_sv,
             node.taxonomy_version, btrim(node.taxonomy_checksum) as taxonomy_checksum,
             coalesce(array_agg(distinct entity.id::text order by entity.id::text)
               filter (where entity.id is not null), '{}'::text[]) as supporting_entity_ids
      from app.taxonomy_nodes as node
      left join app.entity_taxonomy_memberships as membership
        on membership.taxonomy_node_id = node.id and membership.active
      left join app.canonical_entities as entity
        on entity.id = membership.entity_id
       and entity.publication_status = 'PUBLISHED'
       and entity.merged_into_id is null
       and entity.scope_boundary_id = (
         select active_boundary.id
         from app.geographic_scope_boundaries as active_boundary
         join app.geographic_scopes as active_scope on active_scope.id = active_boundary.scope_id
         where active_scope.slug = 'jonkoping-municipality' and active_boundary.is_active
       )
       and not exists (
         select 1 from app.places as place
         where place.entity_id = entity.id and place.status = 'CLOSED'
       )
      where node.active and node.is_leaf
        and node.taxonomy_version = $1
      group by node.id
      order by node.path, node.id
    `, [TAXONOMY_VERSION])).rows;
    if (leaves.length !== catalog.taxonomyNodes.filter(({ active, is_leaf }) => active && is_leaf).length) {
      throw new Error('coverage database leaf set does not match active reference taxonomy');
    }
    if (leaves.some((leaf) => leaf.taxonomy_checksum !== catalog.taxonomy_checksum)) {
      throw new Error('coverage database taxonomy checksum does not match active reference taxonomy');
    }
    const mappedSourceKeys = [...new Set(catalog.rules.map(({ source_key }) => source_key))].sort();
    const runs = (await client.query<RunRow>(`
      select * from app.taxonomy_coverage_run_evidence($1::text[], 500)
    `, [mappedSourceKeys])).rows.map((run): CoverageRunEvidence => ({
      id: run.id,
      sourceKey: run.source_key,
      status: run.status,
      refreshUnitComplete: run.refresh_unit_complete,
      fetched: run.fetched,
      valid: run.valid,
      invalid: run.invalid,
    }));
    await client.query('commit');

    const reviewBySlug = new Map(evidence.leaf_reviews.map((review) => [review.leaf_slug, review]));
    const coverageLeaves = leaves.map((leaf): CoverageLeaf => {
      const rules = catalog.rules.filter(({ target_slug }) => target_slug === leaf.slug);
      const ruleSourceKeys = new Set<string>(rules.map(({ source_key }) => source_key));
      const relevantRuns = runs.filter(({ sourceKey }) => ruleSourceKeys.has(sourceKey));
      const review = reviewBySlug.get(leaf.slug);
      const sourceKeys = [...new Set([
        ...relevantRuns.map(({ sourceKey }) => sourceKey),
        ...(review?.source_keys ?? []),
      ])].sort();
      const ingestionRunIds = [...new Set([
        ...relevantRuns.map(({ id }) => id),
        ...(review?.ingestion_run_ids ?? []),
      ])].sort();
      const supportingEntityIds = [...new Set(leaf.supporting_entity_ids)].sort();
      const count = supportingEntityIds.length;
      const status = classifyCoverageStatus(count, review, runs);
      return {
        taxonomyLeafId: leaf.id,
        leafSlug: leaf.slug,
        labelEn: leaf.label_en,
        labelSv: leaf.label_sv,
        taxonomyVersion: leaf.taxonomy_version,
        taxonomyChecksum: leaf.taxonomy_checksum,
        boundaryVersion: boundary[0].version,
        targetMin: COVERAGE_TARGET_MIN,
        targetMax: COVERAGE_TARGET_MAX,
        canonicalPublishedCount: count,
        sourceKeys,
        ingestionRunIds,
        mappingRuleIds: rules.map(({ id }) => id).sort(),
        supportingEntityIds,
        status,
        stopReason: status === 'SUPPLY_CONSTRAINED' ? review?.stop_reason ?? null : null,
        notes: review?.notes ?? 'Insufficient reviewed source/run evidence; further validation required.',
        generatedAt,
      };
    });
    const statusCounts = countStatuses(coverageLeaves);
    const checksumInput = {
      coverageVersion: evidence.coverage_version,
      taxonomyVersion: catalog.taxonomy_version,
      taxonomyChecksum: catalog.taxonomy_checksum,
      boundaryVersion: boundary[0].version,
      target: { min: COVERAGE_TARGET_MIN, max: COVERAGE_TARGET_MAX },
      statusCounts,
      leaves: coverageLeaves.map((leaf) => {
        const stableLeaf = { ...leaf };
        delete (stableLeaf as Partial<CoverageLeaf>).generatedAt;
        return stableLeaf;
      }),
    };
    return {
      coverageVersion: evidence.coverage_version,
      taxonomyVersion: catalog.taxonomy_version,
      taxonomyChecksum: catalog.taxonomy_checksum,
      boundaryVersion: boundary[0].version,
      generatedAt,
      contentChecksum: sha256(JSON.stringify(checksumInput)),
      target: { min: COVERAGE_TARGET_MIN, max: COVERAGE_TARGET_MAX },
      statusCounts,
      leaves: coverageLeaves,
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

export function renderCoverageMarkdown(document: CoverageDocument): string {
  const lines = [
    '# Active Going-Out Taxonomy coverage',
    '',
    `- Coverage version: \`${document.coverageVersion}\``,
    `- Taxonomy: \`${document.taxonomyVersion}\``,
    `- Taxonomy checksum: \`${document.taxonomyChecksum}\``,
    `- Boundary version: \`${document.boundaryVersion}\``,
    `- Generated at: \`${document.generatedAt}\``,
    `- Stable content checksum (excludes generatedAt): \`${document.contentChecksum}\``,
    `- Statuses: COMPLETE ${document.statusCounts.COMPLETE}, SUPPLY_CONSTRAINED ${document.statusCounts.SUPPLY_CONSTRAINED}, NEEDS_VALIDATION ${document.statusCounts.NEEDS_VALIDATION}`,
    '',
    '| Leaf | EN | SV | Target | Published unique | Status | Sources / runs | Notes |',
    '|---|---|---|---:|---:|---|---|---|',
  ];
  for (const leaf of document.leaves) {
    const evidence = `${leaf.sourceKeys.join(', ') || 'none'} / ${leaf.ingestionRunIds.join(', ') || 'none'}`;
    lines.push(`| ${escapeCell(leaf.leafSlug)} | ${escapeCell(leaf.labelEn)} | ${escapeCell(leaf.labelSv)} | 5–10 | ${leaf.canonicalPublishedCount} | ${leaf.status} | ${escapeCell(evidence)} | ${escapeCell(leaf.notes)} |`);
  }
  return `${lines.join('\n')}\n`;
}

function readCoverageReview(value: unknown): CoverageReview {
  if (!isObject(value)
    || typeof value.leaf_slug !== 'string' || value.leaf_slug.trim() === ''
    || !['COMPLETE', 'SUPPLY_CONSTRAINED', 'NEEDS_VALIDATION'].includes(String(value.status))
    || typeof value.reviewed_by !== 'string' || value.reviewed_by.trim() === ''
    || typeof value.reviewed_at !== 'string' || !Number.isFinite(Date.parse(value.reviewed_at))
    || typeof value.notes !== 'string' || value.notes.trim() === ''
    || !isStringArray(value.source_keys)
    || !isStringArray(value.ingestion_run_ids)
    || (value.stop_reason !== undefined
      && !['SOURCES_EXHAUSTED', 'NO_INCREMENTAL_SUPPLY', 'AUTHORITATIVE_LOW_SUPPLY'].includes(String(value.stop_reason)))) {
    throw new Error('coverage leaf review schema is invalid');
  }
  return value as CoverageReview;
}

function countStatuses(leaves: CoverageLeaf[]): Record<CoverageStatus, number> {
  return {
    COMPLETE: leaves.filter(({ status }) => status === 'COMPLETE').length,
    SUPPLY_CONSTRAINED: leaves.filter(({ status }) => status === 'SUPPLY_CONSTRAINED').length,
    NEEDS_VALIDATION: leaves.filter(({ status }) => status === 'NEEDS_VALIDATION').length,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim() !== '');
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
