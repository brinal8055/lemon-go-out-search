import { createHash } from 'node:crypto';

import type { SearchRequestV1, SearchResponseV1 } from '@lemon/contracts';
import pg from 'pg';

import type { EvalCorpusRecordV1, EvalDatasetManifestV1 } from './index.ts';
import { stableJson } from './dev-runner.ts';
import { diagnoseDevQuery } from './search-diagnostics.ts';

export const DAY2_MANIFEST_VERSION = 'dataset-manifest.day2.v1';
export const DAY2_SELECTED_QUERY_IDS = [
  'eval-v1-dev-canonical-exact-same-name-01',
  'eval-v1-dev-canonical-exact-same-name-04',
  'eval-v1-dev-verified-colliding-aliases-02',
  'eval-v1-dev-prefix-04',
  'eval-v1-dev-typo-transposition-accent-spacing-03',
  'eval-v1-dev-typo-transposition-accent-spacing-04',
  'eval-v1-dev-taxonomy-parent-leaf-01',
  'eval-v1-dev-taxonomy-parent-leaf-04',
  'eval-v1-dev-taxonomy-parent-leaf-07',
  'eval-v1-dev-broad-discovery-01',
  'eval-v1-dev-broad-discovery-02',
  'eval-v1-dev-geo-scope-radius-02',
  'eval-v1-dev-scarcity-duplicate-state-01',
  'eval-v1-dev-broad-concentration-04',
] as const;

const requiredFamilies: Record<string, number> = {
  canonical_exact_same_name: 2,
  verified_colliding_aliases: 1,
  prefix: 1,
  typo_transposition_accent_spacing: 2,
  taxonomy_parent_leaf: 3,
  broad_discovery: 2,
  geo_scope_radius: 1,
  scarcity_duplicate_state: 1,
  broad_concentration: 1,
};

type PublicResult = SearchResponseV1['results'][number];
type TaxonomyMembership = { id: string; slug: string; labelEn: string; labelSv: string };
type ReviewResult = {
  rank: number;
  canonicalEntityId: string;
  displayName: string;
  taxonomyMemberships: TaxonomyMembership[];
  location: PublicResult['location'];
  scopeId: string;
  diagnostic: Record<string, unknown>;
  grade: null;
};
export type Day2ReviewPacket = {
  packetVersion: 'day2-review-packet.v1';
  datasetManifestVersion: string;
  datasetManifestChecksum: string;
  rubric: {
    grades: Record<'0' | '1' | '2' | '3', string>;
    hardConstraintRule: string;
  };
  queries: Array<{
    queryId: string;
    query: string;
    language: string;
    family: string;
    requestFilters: Record<string, unknown>;
    hardConstraints: string[];
    evaluationClockUtc: string | null;
    frozenTargetReference: Record<string, unknown> | null;
    frozenTargetInventoryMatches: Array<{ canonicalEntityId: string; displayName: string }>;
    missingTargetDiagnostic: Record<string, unknown> | null;
    results: ReviewResult[];
  }>;
};

type ReviewEntity = {
  canonicalEntityId: string;
  displayName: string;
  entityType: 'PLACE';
  publicationStatus: string;
  placeStatus: string;
  scopeId: string;
  scopeBoundaryId: string;
  insideActiveBoundary: boolean;
  location: { latitude: number; longitude: number; locality: string | null; streetAddress: string | null };
  taxonomyMemberships: Array<TaxonomyMembership & { path: string[] }>;
};

export type Day2ReviewPacketV11 = {
  packetVersion: 'day2-review-packet.v1.1';
  datasetManifestVersion: string;
  datasetManifestChecksum: string;
  datasetInventoryChecksum: string;
  rubric: Day2ReviewPacket['rubric'];
  queries: Array<{
    queryId: string;
    query: string;
    language: string;
    family: string;
    requestFilters: Record<string, unknown>;
    hardConstraints: string[];
    evaluationClockUtc: string | null;
    frozenTargetReference: Record<string, unknown> | null;
    targetInventoryStatus: 'TARGET_NOT_IN_FROZEN_DATASET' | 'TARGET_MATCHED' | 'NOT_APPLICABLE';
    primaryTargetFailureAttribution: 'INVENTORY' | null;
    entityReviewRows: Array<{
      canonicalEntityId: string;
      displayName: string;
      taxonomyMemberships: TaxonomyMembership[];
      location: ReviewEntity['location'];
      distanceMeters: number | null;
      hardFilterEvidence: Array<{
        filter: string;
        status: 'PASS' | 'FAIL';
        evidence: Record<string, unknown>;
      }>;
      currentSearchRank: number | null;
      stageEvidence: Record<string, unknown>;
      primaryFailure: string | null;
      grade: null;
    }>;
  }>;
};

type DatasetMetadata = {
  boundary: { id: string; version: string; checksum: string };
  taxonomy: { version: string; checksum: string };
  searchConfigVersion: string;
  templateVersion: string;
  documentVersion: string;
  documentHashes: string[];
  ingestionRuns: Array<{ runId: string; sourceKey: string }>;
  inventoryRows: unknown[];
};

export async function loadSelectedDevQueries(corpusText: string): Promise<EvalCorpusRecordV1[]> {
  const selectedIds = new Set<string>(DAY2_SELECTED_QUERY_IDS);
  const records = corpusText.split(/\r?\n/)
    .filter((line) => line.includes('"split":"DEV"'))
    .map((line) => JSON.parse(line) as EvalCorpusRecordV1)
    .filter(({ query_id: queryId }) => selectedIds.has(queryId))
    .sort((left, right) => DAY2_SELECTED_QUERY_IDS.indexOf(left.query_id as never)
      - DAY2_SELECTED_QUERY_IDS.indexOf(right.query_id as never));
  if (records.length !== 14 || records.some(({ split }) => split !== 'DEV')) {
    throw new Error('DAY2_DEV_SELECTION_INVALID');
  }
  const familyCounts = countBy(records.map(({ family }) => family));
  if (stableJson(familyCounts) !== stableJson(requiredFamilies)) throw new Error('DAY2_FAMILY_ALLOCATION_INVALID');
  if (records.some(({ family }) => ['semantic_occasion_language', 'event_time'].includes(family))) {
    throw new Error('DAY2_UNSUPPORTED_FAMILY_SELECTED');
  }
  return records;
}

export async function collectDay2Artifacts(input: {
  connectionString: string;
  edgeUrl: string;
  corpusText: string;
  corpusChecksum: string;
  codeGitCommit: string;
  fixtureFiles: Array<{ sourceKey: string; path: string; text: string }>;
}): Promise<{ manifest: EvalDatasetManifestV1; packet: Day2ReviewPacket }> {
  const records = await loadSelectedDevQueries(input.corpusText);
  const client = new pg.Client({ connectionString: input.connectionString });
  await client.connect();
  let diagnosticMembership: 'ABSENT' | 'NO_SET' | 'SET' = 'ABSENT';
  try {
    const role = await client.query<{ set_option: boolean }>(`
        select membership.set_option
        from pg_auth_members as membership
        join pg_roles as granted on granted.oid = membership.roleid
        join pg_roles as recipient on recipient.oid = membership.member
        where granted.rolname = 'lemon_evaluation' and recipient.rolname = session_user
    `);
    diagnosticMembership = role.rows.length === 0 ? 'ABSENT' : role.rows[0]!.set_option ? 'SET' : 'NO_SET';
    if (diagnosticMembership !== 'SET') {
      await client.query('grant lemon_evaluation to postgres with set true');
    }
    const metadata = await readDatasetMetadata(client);
    const inventoryChecksum = sha256(stableJson(metadata.inventoryRows));
    const fixtureRun = new Map(metadata.ingestionRuns.map(({ sourceKey, runId }) => [sourceKey, runId]));
    const sourceFixtures = input.fixtureFiles.map(({ sourceKey, path, text }) => {
      const ingestionRunId = fixtureRun.get(sourceKey);
      if (!ingestionRunId) throw new Error(`DAY2_INGESTION_RUN_MISSING:${sourceKey}`);
      return { source_key: sourceKey, path, checksum: sha256(text), ingestion_run_id: ingestionRunId };
    });
    const manifest: EvalDatasetManifestV1 = {
      manifest_version: DAY2_MANIFEST_VERSION,
      status: 'FROZEN',
      canonical_dataset_version: `day2-deterministic.v1-${inventoryChecksum.slice(0, 12)}`,
      source_record_ingestion_run_ids: metadata.ingestionRuns.map(({ runId }) => runId).sort(),
      boundary: metadata.boundary,
      taxonomy: metadata.taxonomy,
      normalization_version: 'norm-v1',
      search_documents: {
        template_version: metadata.templateVersion,
        document_version: metadata.documentVersion,
        hashes: metadata.documentHashes,
      },
      embedding: { provider: null, model: null, revision: null, dimension: null },
      search_config_version: metadata.searchConfigVersion,
      evaluation_clock_utc: '2026-10-15T12:00:00Z',
      corpus: { version: 'corpus.v1', checksum: input.corpusChecksum },
      judgment: { version: null, checksum: null },
      code_git_commit: input.codeGitCommit,
      code_state: 'Accepted deterministic search code at Git HEAD; uncommitted EVAL-02 tooling does not alter search behavior.',
      dataset_inventory: {
        eligible_published_entities: metadata.inventoryRows.length,
        active_search_documents: metadata.documentHashes.length,
        checksum: inventoryChecksum,
      },
      source_fixtures: sourceFixtures,
      capabilities: {
        exact: 'IMPLEMENTED', alias: 'IMPLEMENTED', accentless: 'IMPLEMENTED',
        prefix: 'IMPLEMENTED', trigram: 'IMPLEMENTED', fts: 'IMPLEMENTED', taxonomy: 'IMPLEMENTED',
        event: 'NOT_IMPLEMENTED', semantic: 'NOT_IMPLEMENTED', rrf: 'NOT_IMPLEMENTED',
        non_collapse: 'NOT_IMPLEMENTED',
      },
    };
    const manifestChecksum = sha256(`${JSON.stringify(manifest, null, 2)}\n`);
    const queries: Day2ReviewPacket['queries'] = [];
    for (const record of records) {
      const publicResults = await executePublicSearch(input.edgeUrl, record);
      const memberships = await readMemberships(client, publicResults.map(({ canonicalId }) => canonicalId));
      const results: ReviewResult[] = [];
      for (const [index, result] of publicResults.entries()) {
        results.push({
          rank: index + 1,
          canonicalEntityId: result.canonicalId,
          displayName: result.type === 'PLACE' ? result.name : result.title,
          taxonomyMemberships: memberships.get(result.canonicalId) ?? [],
          location: result.location,
          scopeId: record.scope.scope_id,
          diagnostic: selectDiagnostic(await diagnoseDevQuery(input.connectionString, record, result.canonicalId)),
          grade: null,
        });
      }
      const targetMatches = await matchFrozenTargetLabels(client, frozenTargetLabels(record.known_item_target));
      const targetLabels = frozenTargetLabels(record.known_item_target);
      const missingMatch = targetMatches.find(({ canonicalEntityId }) => !results.some(
        (result) => result.canonicalEntityId === canonicalEntityId,
      ));
      queries.push({
        queryId: record.query_id,
        query: record.query,
        language: record.language,
        family: record.family,
        requestFilters: record.request_filters,
        hardConstraints: record.hard_constraints,
        evaluationClockUtc: record.evaluation_clock_utc,
        frozenTargetReference: record.known_item_target,
        frozenTargetInventoryMatches: targetMatches,
        missingTargetDiagnostic: missingMatch
          ? selectDiagnostic(await diagnoseDevQuery(input.connectionString, record, missingMatch.canonicalEntityId))
          : targetLabels.length > 0 && targetMatches.length === 0
            ? { status: 'NOT_RUN', reasonCode: 'NO_CANONICAL_ENTITY_ID_IN_FROZEN_DATASET', targetLabels }
            : null,
        results,
      });
    }
    return {
      manifest,
      packet: {
        packetVersion: 'day2-review-packet.v1',
        datasetManifestVersion: DAY2_MANIFEST_VERSION,
        datasetManifestChecksum: manifestChecksum,
        rubric: {
          grades: { '0': 'not relevant', '1': 'marginal', '2': 'relevant', '3': 'highly relevant' },
          hardConstraintRule: 'Any explicit structured or hard-constraint violation receives grade 0 regardless of textual similarity.',
        },
        queries,
      },
    };
  } finally {
    if (diagnosticMembership !== 'SET') {
      await client.query('revoke lemon_evaluation from postgres granted by postgres');
    }
    await client.end();
  }
}

export async function collectDay2ExpandedReviewPacket(input: {
  connectionString: string;
  edgeUrl: string;
  corpusText: string;
  corpusChecksum: string;
  codeGitCommit: string;
  fixtureFiles: Array<{ sourceKey: string; path: string; text: string }>;
  queryIds?: readonly string[];
}): Promise<{ manifest: EvalDatasetManifestV1; packet: Day2ReviewPacketV11 }> {
  const { manifest, packet: currentResults } = await collectDay2Artifacts(input);
  const selected = await loadSelectedDevQueries(input.corpusText);
  const requestedIds = new Set(input.queryIds ?? DAY2_SELECTED_QUERY_IDS);
  const records = selected.filter(({ query_id: queryId }) => requestedIds.has(queryId));
  if (records.length !== requestedIds.size) throw new Error('DAY2_REVIEW_BATCH_SELECTION_INVALID');
  const client = new pg.Client({ connectionString: input.connectionString });
  await client.connect();
  const membership = await enableTemporaryDiagnosticRole(client);
  const diagnosticClient = new pg.Client({ connectionString: input.connectionString });
  let diagnosticConnected = false;
  try {
    await diagnosticClient.connect();
    diagnosticConnected = true;
    await diagnosticClient.query('begin');
    await diagnosticClient.query('set local role lemon_evaluation');
    const entities = await readReviewEntities(client);
    if (entities.length !== 6 || manifest.dataset_inventory?.eligible_published_entities !== 6) {
      throw new Error('DAY2_REVIEW_ENTITY_COUNT_MISMATCH');
    }
    const queries: Day2ReviewPacketV11['queries'] = [];
    for (const record of records) {
      const current = currentResults.queries.find(({ queryId }) => queryId === record.query_id);
      if (!current) throw new Error(`DAY2_CURRENT_RESULTS_MISSING:${record.query_id}`);
      const rankByEntity = new Map(current.results.map(({ canonicalEntityId, rank }) => [canonicalEntityId, rank]));
      const distances = await readDistances(client, entities, record.request_filters.location);
      const targetLabels = frozenTargetLabels(record.known_item_target);
      const targetMatches = await matchFrozenTargetLabels(client, targetLabels);
      const targetInventoryStatus = targetLabels.length === 0
        ? 'NOT_APPLICABLE' as const
        : targetMatches.length === 0
          ? 'TARGET_NOT_IN_FROZEN_DATASET' as const
          : 'TARGET_MATCHED' as const;
      const entityReviewRows = [];
      for (const entity of entities) {
        const diagnostic = selectDiagnostic(await diagnoseWithClient(
          diagnosticClient, record, entity.canonicalEntityId,
        ));
        const reasonCodes = Array.isArray(diagnostic.reasonCodes) ? diagnostic.reasonCodes : [];
        entityReviewRows.push({
          canonicalEntityId: entity.canonicalEntityId,
          displayName: entity.displayName,
          taxonomyMemberships: entity.taxonomyMemberships.map(({ id, slug, labelEn, labelSv }) => ({
            id, slug, labelEn, labelSv,
          })),
          location: entity.location,
          distanceMeters: distances.get(entity.canonicalEntityId) ?? null,
          hardFilterEvidence: buildHardFilterEvidence(record, entity, distances.get(entity.canonicalEntityId) ?? null),
          currentSearchRank: rankByEntity.get(entity.canonicalEntityId) ?? null,
          stageEvidence: diagnostic,
          primaryFailure: rankByEntity.has(entity.canonicalEntityId)
            ? null
            : typeof reasonCodes[0] === 'string' ? reasonCodes[0] : 'NOT_RETURNED_NO_REASON_CODE',
          grade: null,
        });
      }
      queries.push({
        queryId: record.query_id,
        query: record.query,
        language: record.language,
        family: record.family,
        requestFilters: record.request_filters,
        hardConstraints: record.hard_constraints,
        evaluationClockUtc: record.evaluation_clock_utc,
        frozenTargetReference: record.known_item_target,
        targetInventoryStatus,
        primaryTargetFailureAttribution: targetInventoryStatus === 'TARGET_NOT_IN_FROZEN_DATASET' ? 'INVENTORY' : null,
        entityReviewRows,
      });
    }
    return {
      manifest,
      packet: {
        packetVersion: 'day2-review-packet.v1.1',
        datasetManifestVersion: DAY2_MANIFEST_VERSION,
        datasetManifestChecksum: currentResults.datasetManifestChecksum,
        datasetInventoryChecksum: manifest.dataset_inventory!.checksum,
        rubric: currentResults.rubric,
        queries,
      },
    };
  } finally {
    if (diagnosticConnected) {
      await diagnosticClient.query('rollback').catch(() => undefined);
      await diagnosticClient.end();
    }
    await restoreTemporaryDiagnosticRole(client, membership);
    await client.end();
  }
}

export function renderDay2ReviewMarkdownV11(packet: Day2ReviewPacketV11): string {
  const sections = packet.queries.map((query) => {
    const rows = query.entityReviewRows.map((row) => {
      const taxonomy = row.taxonomyMemberships
        .map(({ id, slug, labelEn, labelSv }) => `${slug} (${labelEn} / ${labelSv}; ${id})`)
        .join('; ') || 'None';
      return `### ${row.canonicalEntityId}\n\n`
        + `- Display name: ${row.displayName}\n`
        + `- Taxonomy memberships: ${taxonomy}\n`
        + `- Factual location: \`${JSON.stringify(row.location)}\`\n`
        + `- Distance from requested coordinate (meters): ${row.distanceMeters ?? 'not applicable'}\n`
        + `- Hard-filter evidence: \`${JSON.stringify(row.hardFilterEvidence)}\`\n`
        + `- Current search rank: ${row.currentSearchRank ?? 'NOT_RETURNED'}\n`
        + `- Stage/DIAG-01 evidence: \`${JSON.stringify(row.stageEvidence)}\`\n`
        + `- Primary failure when not returned: ${row.primaryFailure ?? 'not applicable'}\n`
        + `- grade: __`;
    }).join('\n\n');
    return `## ${query.queryId}\n\n`
      + `- Query: ${query.query}\n`
      + `- Language: ${query.language}\n`
      + `- Family: ${query.family}\n`
      + `- Request filters: \`${JSON.stringify(query.requestFilters)}\`\n`
      + `- Hard constraints: ${query.hardConstraints.join('; ')}\n`
      + `- Evaluation clock: ${query.evaluationClockUtc ?? 'not applicable'}\n`
      + `- Frozen target reference: \`${JSON.stringify(query.frozenTargetReference)}\`\n`
      + `- Target inventory status: ${query.targetInventoryStatus}\n`
      + `- Primary target failure attribution: ${query.primaryTargetFailureAttribution ?? 'not applicable'}\n\n`
      + rows;
  }).join('\n\n');
  return `# Day-2 DEV exhaustive human judgment packet v1.1\n\n`
    + `- Dataset manifest: ${packet.datasetManifestVersion}\n`
    + `- Dataset manifest file checksum: ${packet.datasetManifestChecksum}\n`
    + `- Dataset inventory checksum: ${packet.datasetInventoryChecksum}\n`
    + `- Selected DEV queries: ${packet.queries.length}\n`
    + `- Candidate pool: all six eligible CanonicalEntities for every query\n`
    + `- Grades in this packet: blank for human review\n\n`
    + `## Frozen rubric\n\n`
    + `- 0 = ${packet.rubric.grades['0']}\n`
    + `- 1 = ${packet.rubric.grades['1']}\n`
    + `- 2 = ${packet.rubric.grades['2']}\n`
    + `- 3 = ${packet.rubric.grades['3']}\n`
    + `- ${packet.rubric.hardConstraintRule}\n\n`
    + `${sections}\n`;
}

export function renderDay2ReviewMarkdown(packet: Day2ReviewPacket): string {
  const sections = packet.queries.map((query) => {
    const results = query.results.length === 0
      ? '_No current results._'
      : query.results.map((result) => {
        const taxonomy = result.taxonomyMemberships
          .map(({ id, slug, labelEn, labelSv }) => `${slug} (${labelEn} / ${labelSv}; ${id})`)
          .join('; ') || 'None';
        return `#### Rank ${result.rank}\n\n`
          + `- CanonicalEntity ID: \`${result.canonicalEntityId}\`\n`
          + `- Display name: ${result.displayName}\n`
          + `- Taxonomy memberships: ${taxonomy}\n`
          + `- Location/scope: \`${JSON.stringify({ ...result.location, scopeId: result.scopeId })}\`\n`
          + `- DIAG-01 evidence: \`${JSON.stringify(result.diagnostic)}\`\n`
          + `- grade: __`;
      }).join('\n\n');
    return `## ${query.queryId}\n\n`
      + `- Query: ${query.query}\n`
      + `- Language: ${query.language}\n`
      + `- Family: ${query.family}\n`
      + `- Request filters: \`${JSON.stringify(query.requestFilters)}\`\n`
      + `- Hard constraints: ${query.hardConstraints.join('; ')}\n`
      + `- Evaluation clock: ${query.evaluationClockUtc ?? 'not applicable'}\n`
      + `- Frozen target reference: \`${JSON.stringify(query.frozenTargetReference)}\`\n`
      + `- Target inventory matches: \`${JSON.stringify(query.frozenTargetInventoryMatches)}\`\n`
      + `- Missing-target DIAG-01 evidence: \`${JSON.stringify(query.missingTargetDiagnostic)}\`\n\n`
      + `${results}`;
  }).join('\n\n');
  return `# Day-2 DEV human judgment packet v1\n\n`
    + `- Dataset manifest: ${packet.datasetManifestVersion}\n`
    + `- Dataset manifest checksum: ${packet.datasetManifestChecksum}\n`
    + `- Selected DEV queries: ${packet.queries.length}\n`
    + `- Grades in this packet: blank for human review\n\n`
    + `## Frozen rubric\n\n`
    + `- 0 = ${packet.rubric.grades['0']}\n`
    + `- 1 = ${packet.rubric.grades['1']}\n`
    + `- 2 = ${packet.rubric.grades['2']}\n`
    + `- 3 = ${packet.rubric.grades['3']}\n`
    + `- ${packet.rubric.hardConstraintRule}\n\n`
    + `${sections}\n`;
}

async function readDatasetMetadata(client: pg.Client): Promise<DatasetMetadata> {
  const boundary = await client.query<{ id: string; version: string; checksum: string }>(`
      select id, version, source_checksum as checksum from app.geographic_scope_boundaries where is_active
    `);
  const taxonomy = await client.query<{ version: string; checksum: string }>(`
      select taxonomy_version as version, taxonomy_checksum as checksum
      from app.taxonomy_nodes where active group by taxonomy_version, taxonomy_checksum
    `);
  const config = await client.query<{ version: string }>('select version from app.search_configs where is_active');
  const documents = await client.query<{ template_version: string; document_version: string; content_hash: string }>(`
      select template_version, document_version, content_hash
      from app.search_documents where is_active order by entity_id
    `);
  const runs = await client.query<{ run_id: string; source_key: string }>(`
      select distinct run.id as run_id, source.key as source_key
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      join app.source_record_versions as version on version.id = record.current_version_id
      join app.ingestion_runs as run on run.id = version.capture_run_id
      join app.canonical_entities as entity on entity.id = record.canonical_entity_id
      where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
      order by source.key, run.id
    `);
  const inventory = await client.query(`
      select entity.id, entity.canonical_name, entity.entity_type, entity.publication_status,
             place.status as place_status,
             extensions.st_y(place.location::extensions.geometry) as latitude,
             extensions.st_x(place.location::extensions.geometry) as longitude,
             document.content_hash as search_document_hash,
             coalesce(array_agg(membership.taxonomy_node_id order by membership.taxonomy_node_id)
               filter (where membership.id is not null), '{}') as taxonomy_node_ids
      from app.canonical_entities as entity
      join app.places as place on place.entity_id = entity.id
      join app.search_documents as document on document.entity_id = entity.id and document.is_active
      left join app.entity_taxonomy_memberships as membership
        on membership.entity_id = entity.id and membership.active
      where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
      group by entity.id, place.status, place.location, document.content_hash
      order by entity.id
    `);
  if (boundary.rows.length !== 1 || taxonomy.rows.length !== 1 || config.rows.length !== 1
    || documents.rows.length === 0 || runs.rows.length !== 2 || inventory.rows.length !== documents.rows.length) {
    throw new Error('DAY2_DATASET_INVARIANT_FAILED');
  }
  const templateVersions = new Set(documents.rows.map(({ template_version: value }) => value));
  const documentVersions = new Set(documents.rows.map(({ document_version: value }) => value));
  if (templateVersions.size !== 1 || documentVersions.size !== 1) throw new Error('DAY2_DOCUMENT_VERSION_MISMATCH');
  return {
    boundary: boundary.rows[0]!, taxonomy: taxonomy.rows[0]!, searchConfigVersion: config.rows[0]!.version,
    templateVersion: documents.rows[0]!.template_version,
    documentVersion: documents.rows[0]!.document_version,
    documentHashes: documents.rows.map(({ content_hash: hash }) => hash).sort(),
    ingestionRuns: runs.rows.map(({ run_id: runId, source_key: sourceKey }) => ({ runId, sourceKey })),
    inventoryRows: inventory.rows,
  };
}

async function executePublicSearch(edgeUrl: string, record: EvalCorpusRecordV1): Promise<PublicResult[]> {
  const response = await fetch(edgeUrl, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toSearchRequest(record)),
  });
  const body = await response.json() as SearchResponseV1;
  if (!response.ok || !Array.isArray(body.results)) throw new Error(`PUBLIC_SEARCH_FAILED:${record.query_id}`);
  return body.results.slice(0, 10);
}

function toSearchRequest(record: EvalCorpusRecordV1): SearchRequestV1 {
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const location = record.request_filters.location as { latitude?: unknown; longitude?: unknown; radius_meters?: unknown } | undefined;
  return {
    query: record.query, uiLocale: record.ui_locale, scopeId: record.scope.scope_id, limit: 10,
    ...(typeof taxonomy?.node_id === 'string' ? { taxonomyNodeId: taxonomy.node_id } : {}),
    ...(Array.isArray(record.request_filters.entity_types)
      ? { entityTypes: record.request_filters.entity_types as SearchRequestV1['entityTypes'] } : {}),
    ...(typeof location?.latitude === 'number' && typeof location.longitude === 'number'
      && typeof location.radius_meters === 'number'
      ? { location: { latitude: location.latitude, longitude: location.longitude, radiusMeters: location.radius_meters } }
      : {}),
  };
}

async function readMemberships(client: pg.Client, entityIds: string[]): Promise<Map<string, TaxonomyMembership[]>> {
  if (entityIds.length === 0) return new Map();
  const rows = await client.query<{
    entity_id: string; id: string; slug: string; label_en: string; label_sv: string;
  }>(`
    select membership.entity_id, node.id, node.slug, node.label_en, node.label_sv
    from app.entity_taxonomy_memberships as membership
    join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
    where membership.active and node.active and membership.entity_id = any($1::uuid[])
    order by membership.entity_id, node.path, node.id
  `, [entityIds]);
  const result = new Map<string, TaxonomyMembership[]>();
  for (const row of rows.rows) {
    const list = result.get(row.entity_id) ?? [];
    list.push({ id: row.id, slug: row.slug, labelEn: row.label_en, labelSv: row.label_sv });
    result.set(row.entity_id, list);
  }
  return result;
}

async function matchFrozenTargetLabels(
  client: pg.Client,
  labels: string[],
): Promise<Array<{ canonicalEntityId: string; displayName: string }>> {
  if (labels.length === 0) return [];
  const result = await client.query<{ id: string; canonical_name: string }>(`
    select id, canonical_name from app.canonical_entities
    where publication_status = 'PUBLISHED' and merged_into_id is null and canonical_name = any($1::text[])
    order by id
  `, [labels]);
  return result.rows.map(({ id, canonical_name: displayName }) => ({ canonicalEntityId: id, displayName }));
}

function frozenTargetLabels(target: Record<string, unknown> | null): string[] {
  if (!target) return [];
  const labels: string[] = [];
  if (typeof target.label === 'string') labels.push(target.label);
  if (Array.isArray(target.members)) {
    for (const member of target.members) {
      if (member && typeof member === 'object' && typeof (member as Record<string, unknown>).label === 'string') {
        labels.push((member as Record<string, unknown>).label as string);
      }
    }
  }
  return [...new Set(labels)].sort();
}

function selectDiagnostic(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(['entityExists', 'eligible', 'eligibilityFailureReason', 'reasonCodes',
    'exactQualification', 'stages', 'candidateUnion', 'versions']
    .filter((key) => key in value).map((key) => [key, value[key]]));
}

async function diagnoseWithClient(
  client: pg.Client,
  record: EvalCorpusRecordV1,
  entityId: string,
): Promise<Record<string, unknown>> {
  const result = await client.query<{ diagnostic: Record<string, unknown> }>(
    'select diagnostic.explain_search_v1($1::jsonb, $2::uuid) as diagnostic',
    [JSON.stringify(toDiagnosticRequest(record)), entityId],
  );
  const diagnostic = result.rows[0]?.diagnostic;
  if (!diagnostic) throw new Error('DIAGNOSTIC_RESULT_MISSING');
  return diagnostic;
}

function toDiagnosticRequest(record: EvalCorpusRecordV1): Record<string, unknown> {
  const request = toSearchRequest(record);
  return {
    query: request.query,
    scopeId: request.scopeId,
    ...(request.taxonomyNodeId ? { taxonomyNodeId: request.taxonomyNodeId } : {}),
    ...(request.entityTypes ? { entityTypes: request.entityTypes } : {}),
    ...(request.location ? { location: request.location } : {}),
  };
}

async function enableTemporaryDiagnosticRole(
  client: pg.Client,
): Promise<'ABSENT' | 'NO_SET' | 'SET'> {
  const role = await client.query<{ set_option: boolean }>(`
    select membership.set_option
    from pg_auth_members as membership
    join pg_roles as granted on granted.oid = membership.roleid
    join pg_roles as recipient on recipient.oid = membership.member
    where granted.rolname = 'lemon_evaluation' and recipient.rolname = session_user
  `);
  const state = role.rows.length === 0 ? 'ABSENT' : role.rows[0]!.set_option ? 'SET' : 'NO_SET';
  if (state !== 'SET') await client.query('grant lemon_evaluation to postgres with set true');
  return state;
}

async function restoreTemporaryDiagnosticRole(
  client: pg.Client,
  state: 'ABSENT' | 'NO_SET' | 'SET',
): Promise<void> {
  if (state !== 'SET') await client.query('revoke lemon_evaluation from postgres granted by postgres');
}

async function readReviewEntities(client: pg.Client): Promise<ReviewEntity[]> {
  const result = await client.query<{
    id: string;
    canonical_name: string;
    entity_type: 'PLACE';
    publication_status: string;
    place_status: string;
    scope_id: string;
    scope_boundary_id: string;
    inside_active_boundary: boolean;
    latitude: number;
    longitude: number;
    locality: string | null;
    street_address: string | null;
    taxonomy_memberships: Array<{
      id: string; slug: string; labelEn: string; labelSv: string; path: string[];
    }>;
  }>(`
    select entity.id, entity.canonical_name, entity.entity_type, entity.publication_status,
           place.status as place_status, entity.scope_id, entity.scope_boundary_id,
           extensions.st_covers(boundary.boundary, place.location::extensions.geometry) as inside_active_boundary,
           extensions.st_y(place.location::extensions.geometry) as latitude,
           extensions.st_x(place.location::extensions.geometry) as longitude,
           place.locality, place.street_address,
           coalesce(jsonb_agg(jsonb_build_object(
             'id', node.id,
             'slug', node.slug,
             'labelEn', node.label_en,
             'labelSv', node.label_sv,
             'path', node.path
           ) order by node.path, node.id) filter (where membership.id is not null), '[]'::jsonb)
             as taxonomy_memberships
    from app.canonical_entities as entity
    join app.places as place on place.entity_id = entity.id
    join app.geographic_scope_boundaries as boundary
      on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id and boundary.is_active
    join app.search_documents as document on document.entity_id = entity.id and document.is_active
    left join app.entity_taxonomy_memberships as membership
      on membership.entity_id = entity.id and membership.active
    left join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id and node.active
    where entity.publication_status = 'PUBLISHED'
      and entity.merged_into_id is null
      and place.status in ('ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN')
    group by entity.id, place.status, place.location, place.locality, place.street_address, boundary.boundary
    order by entity.id
  `);
  return result.rows.map((row) => ({
    canonicalEntityId: row.id,
    displayName: row.canonical_name,
    entityType: row.entity_type,
    publicationStatus: row.publication_status,
    placeStatus: row.place_status,
    scopeId: row.scope_id,
    scopeBoundaryId: row.scope_boundary_id,
    insideActiveBoundary: row.inside_active_boundary,
    location: {
      latitude: row.latitude,
      longitude: row.longitude,
      locality: row.locality,
      streetAddress: row.street_address,
    },
    taxonomyMemberships: row.taxonomy_memberships,
  }));
}

async function readDistances(
  client: pg.Client,
  entities: ReviewEntity[],
  rawLocation: unknown,
): Promise<Map<string, number>> {
  const location = rawLocation as { latitude?: unknown; longitude?: unknown; radius_meters?: unknown } | undefined;
  if (typeof location?.latitude !== 'number' || typeof location.longitude !== 'number'
    || typeof location.radius_meters !== 'number') return new Map();
  const result = await client.query<{ entity_id: string; distance_meters: number }>(`
    select place.entity_id,
           extensions.st_distance(
             place.location,
             extensions.st_setsrid(extensions.st_makepoint($1, $2), 4326)::extensions.geography
           ) as distance_meters
    from app.places as place
    where place.entity_id = any($3::uuid[])
    order by place.entity_id
  `, [location.longitude, location.latitude, entities.map(({ canonicalEntityId }) => canonicalEntityId)]);
  return new Map(result.rows.map(({ entity_id: entityId, distance_meters: distance }) => [
    entityId,
    Math.round(distance * 100) / 100,
  ]));
}

function buildHardFilterEvidence(
  record: EvalCorpusRecordV1,
  entity: ReviewEntity,
  distanceMeters: number | null,
): Day2ReviewPacketV11['queries'][number]['entityReviewRows'][number]['hardFilterEvidence'] {
  const evidence: Day2ReviewPacketV11['queries'][number]['entityReviewRows'][number]['hardFilterEvidence'] = [
    {
      filter: 'scope',
      status: entity.scopeId === record.scope.scope_id && entity.insideActiveBoundary ? 'PASS' : 'FAIL',
      evidence: {
        requestedScopeId: record.scope.scope_id,
        entityScopeId: entity.scopeId,
        entityBoundaryId: entity.scopeBoundaryId,
        insideActiveBoundary: entity.insideActiveBoundary,
      },
    },
    {
      filter: 'publication_eligibility',
      status: entity.publicationStatus === 'PUBLISHED'
        && ['ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN'].includes(entity.placeStatus) ? 'PASS' : 'FAIL',
      evidence: { publicationStatus: entity.publicationStatus, placeStatus: entity.placeStatus },
    },
  ];
  const entityTypes = record.request_filters.entity_types;
  if (Array.isArray(entityTypes)) {
    evidence.push({
      filter: 'entity_type',
      status: entityTypes.includes(entity.entityType) ? 'PASS' : 'FAIL',
      evidence: { requestedEntityTypes: entityTypes, entityType: entity.entityType },
    });
  }
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  if (typeof taxonomy?.node_id === 'string') {
    const matchedMembershipIds = entity.taxonomyMemberships
      .filter(({ path }) => path.includes(taxonomy.node_id as string))
      .map(({ id }) => id);
    evidence.push({
      filter: 'taxonomy',
      status: matchedMembershipIds.length > 0 ? 'PASS' : 'FAIL',
      evidence: { requestedTaxonomyNodeId: taxonomy.node_id, matchedMembershipIds },
    });
  }
  const location = record.request_filters.location as { radius_meters?: unknown } | undefined;
  if (typeof location?.radius_meters === 'number') {
    evidence.push({
      filter: 'radius',
      status: distanceMeters !== null && distanceMeters <= location.radius_meters ? 'PASS' : 'FAIL',
      evidence: { requestedRadiusMeters: location.radius_meters, distanceMeters },
    });
  }
  return evidence;
}

function countBy(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
