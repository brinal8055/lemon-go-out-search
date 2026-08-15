import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import pg from 'pg';

import type { EvalCorpusRecordV1 } from './index.ts';
import { stableJson } from './dev-runner.ts';

const root = new URL('../../../', import.meta.url);
const phase = argumentValue(process.argv.slice(2), '--phase') ?? 'day3';
if (!['day3', 'day4-postcoverage'].includes(phase)) throw new Error('ARTIFACT_PHASE_UNSUPPORTED');
const artifactVersion = argumentValue(process.argv.slice(2), '--artifact-version') ?? '1';
if (!['1', '2'].includes(artifactVersion)) throw new Error('ARTIFACT_VERSION_UNSUPPORTED');
if (phase === 'day4-postcoverage' && artifactVersion !== '1') throw new Error('POST_COVERAGE_VERSION_MUST_START_AT_1');
const manifestVersion = phase === 'day3'
  ? `dataset-manifest.day3-current.v${artifactVersion}`
  : `dataset-manifest.day4-postcoverage.v${artifactVersion}`;
const packetVersion = phase === 'day3'
  ? `dev-review-packet.day3.v${artifactVersion}`
  : `dev-review-packet.day4-postcoverage.v${artifactVersion}`;
const evaluationClockUtc = '2026-10-15T12:00:00Z';
const outputRoot = resolve(argumentValue(process.argv.slice(2), '--output-root') ?? root.pathname);
const connectionString = process.env.LEMON_LOCAL_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

type TaxonomyMembership = {
  id: string;
  slug: string;
  labelEn: string;
  labelSv: string;
  path: string[];
};

type InventoryEntity = {
  canonicalEntityId: string;
  entityType: 'PLACE' | 'EVENT';
  canonicalName: string;
  publicationStatus: string;
  scopeId: string;
  scopeBoundaryId: string;
  insideActiveBoundary: boolean;
  chainKey: string | null;
  place: null | {
    status: string;
    latitude: number;
    longitude: number;
    streetAddress: string | null;
    locality: string | null;
  };
  event: null | {
    status: string;
    startsAt: string;
    endsAt: string | null;
    statusObservedAt: string;
    venuePlaceId: string | null;
    venueName: string | null;
    latitude: number | null;
    longitude: number | null;
    streetAddress: string | null;
    locality: string | null;
  };
  taxonomyMemberships: TaxonomyMembership[];
  sourceEvidence: Array<{ sourceKey: string; captureRunId: string }>;
  searchDocument: null | {
    contentHash: string;
    templateVersion: string;
    documentVersion: string;
  };
};

type CurrentMetadata = {
  boundary: { id: string; version: string; checksum: string };
  taxonomy: { version: string; checksum: string; nodeCount: number };
  searchConfig: Record<string, unknown>;
  searchDocuments: Array<{
    entityId: string;
    contentHash: string;
    templateVersion: string;
    documentVersion: string;
  }>;
  embeddingCounts: Array<{
    provider: string;
    model: string;
    revision: string;
    dimension: number;
    status: string;
    count: number;
  }>;
  canonicalStateCounts: Array<{ entityType: string; publicationStatus: string; count: number }>;
  entities: InventoryEntity[];
};

const priorJudgmentsPath = phase === 'day3'
  ? 'evaluation/judgments/judgments.day2.v1.json'
  : 'evaluation/judgments/judgments.day3.v1.json';
const priorManifestPath = phase === 'day3'
  ? 'evaluation/manifests/dataset-manifest.day2.v1.json'
  : 'evaluation/manifests/dataset-manifest.day3-current.v2.json';
const [corpusText, corpusChecksumText, priorJudgmentsText, priorManifestText] = await Promise.all([
  readFile(new URL('evaluation/corpus/corpus.v1.jsonl', root), 'utf8'),
  readFile(new URL('evaluation/corpus/checksum.v1.txt', root), 'utf8'),
  readFile(new URL(priorJudgmentsPath, root), 'utf8'),
  readFile(new URL(priorManifestPath, root), 'utf8'),
]);
const corpusChecksum = corpusChecksumText.trim();
if (sha256(corpusText) !== corpusChecksum) throw new Error('CORPUS_CHECKSUM_MISMATCH');
const devRecords = corpusText.split(/\r?\n/)
  .filter((line) => line.includes('"split":"DEV"'))
  .map((line) => JSON.parse(line) as EvalCorpusRecordV1)
  .sort((left, right) => left.query_id.localeCompare(right.query_id));
if (devRecords.length !== 60 || devRecords.some(({ split }) => split !== 'DEV')) {
  throw new Error('FULL_DEV_SELECTION_INVALID');
}
const clocks = new Set(devRecords.map(({ evaluation_clock_utc: clock }) => clock));
if (clocks.size !== 1 || !clocks.has(evaluationClockUtc)) throw new Error('DEV_CLOCK_MISMATCH');

const client = new pg.Client({ connectionString });
await client.connect();
let metadata: CurrentMetadata;
try {
  await client.query('begin isolation level repeatable read read only');
  metadata = await readCurrentMetadata(client);
  await client.query('commit');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

const inventoryChecksum = sha256(stableJson(metadata.entities));
const priorJudgments = JSON.parse(priorJudgmentsText) as {
  judgment_version: string;
  records: unknown[];
  dataset_inventory_checksum?: string;
};
const priorManifest = JSON.parse(priorManifestText) as {
  manifest_version: string;
  dataset_inventory?: { checksum?: string };
};
const currentJudgedCount = phase === 'day3'
  && priorJudgments.dataset_inventory_checksum === inventoryChecksum
  && priorManifest.dataset_inventory?.checksum === inventoryChecksum
  ? priorJudgments.records.length
  : 0;
const sourceRuns = [...new Map(metadata.entities.flatMap(({ sourceEvidence }) => sourceEvidence)
  .map((evidence) => [`${evidence.sourceKey}:${evidence.captureRunId}`, evidence])).values()]
  .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey)
    || left.captureRunId.localeCompare(right.captureRunId));
const activeConfig = metadata.searchConfig;
const activeReadyEmbeddings = metadata.embeddingCounts
  .filter(({ status }) => status === 'READY')
  .reduce((sum, { count }) => sum + count, 0);
const fixtureShapedEventCount = metadata.entities.filter(({ entityType, canonicalName }) => (
  entityType === 'EVENT' && /^Municipal Event [0-9a-f]{8}$/.test(canonicalName)
)).length;
const fixtureFingerprintCount = metadata.entities.filter(({ canonicalName, sourceEvidence }) => (
  canonicalName === 'Explicit Indian Restaurant'
  || sourceEvidence.some(({ sourceKey }) => sourceKey.startsWith('src03b-place-'))
)).length + fixtureShapedEventCount;
const missingActiveDocumentCount = metadata.entities.filter(({ searchDocument }) => searchDocument === null).length;
if ((artifactVersion === '2' || phase === 'day4-postcoverage') && (
  metadata.entities.length === 0 || fixtureFingerprintCount > 0 || missingActiveDocumentCount > 0
)) {
  throw new Error('V2_CLEAN_DATASET_ACCEPTANCE_FAILED');
}
const publishedEntityCount = metadata.entities.length;
const activeSearchDocumentCount = metadata.searchDocuments.length;
const codeGitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const manifest = {
  manifest_version: manifestVersion,
  ...(phase === 'day4-postcoverage'
    ? { supersedes: 'dataset-manifest.day3-current.v2' }
    : artifactVersion === '2' ? { supersedes: 'dataset-manifest.day3-current.v1' } : {}),
  status: 'FROZEN_FOR_HUMAN_REVIEW',
  purpose: phase === 'day4-postcoverage'
    ? 'COVERAGE_01_POST_COVERAGE_DEV_JUDGMENT_PREPARATION_ONLY'
    : 'EVAL_03_DEV_JUDGMENT_PREPARATION_ONLY',
  canonical_dataset_version: phase === 'day4-postcoverage'
    ? `day4-postcoverage.v${artifactVersion}-${inventoryChecksum.slice(0, 12)}`
    : `day3-current.v${artifactVersion}-${inventoryChecksum.slice(0, 12)}`,
  source_record_ingestion_runs: sourceRuns,
  boundary: metadata.boundary,
  taxonomy: metadata.taxonomy,
  normalization_version: 'norm-v1',
  search_documents: {
    template_version: unique(metadata.searchDocuments.map(({ templateVersion }) => templateVersion), 'DOCUMENT_TEMPLATE'),
    document_version: unique(metadata.searchDocuments.map(({ documentVersion }) => documentVersion), 'DOCUMENT_VERSION'),
    hashes: metadata.searchDocuments.map(({ contentHash }) => contentHash).sort(),
  },
  embedding: {
    provider: activeConfig.embedding_provider,
    model: activeConfig.embedding_model,
    revision: activeConfig.embedding_revision,
    dimension: activeConfig.embedding_dimension,
    query_template_version: 'semantic-query-template-v1',
    current_rows_by_status: metadata.embeddingCounts,
    compatible_ready_count: activeReadyEmbeddings,
  },
  search_config: {
    active_database_version: activeConfig.version,
    config_checksum: activeConfig.config_checksum,
    baseline_candidate_version: 'eval-03-baseline.v1',
    values: activeConfig,
    semantic_runtime: {
      timeout_ms: 700,
      circuit_failures: 3,
      cooldown_seconds: 30,
    },
  },
  evaluation_clock_utc: evaluationClockUtc,
  corpus: { version: 'corpus.v1', checksum: corpusChecksum, dev_query_count: 60 },
  judgment: {
    version: null,
    checksum: null,
    current_dataset_complete_count: currentJudgedCount,
    current_dataset_missing_count: 60 - currentJudgedCount,
    prior_version: priorJudgments.judgment_version,
    prior_manifest_version: priorManifest.manifest_version,
    prior_dataset_inventory_checksum: priorJudgments.dataset_inventory_checksum ?? null,
    prior_version_compatible_with_current_inventory: currentJudgedCount > 0,
  },
  code_git_commit: codeGitCommit,
  dataset_inventory: {
    published_unmerged_entities: publishedEntityCount,
    active_search_documents: activeSearchDocumentCount,
    checksum: inventoryChecksum,
    canonical_state_counts: metadata.canonicalStateCounts,
  },
  current_state_observations_requiring_human_inventory_confirmation: {
    active_ready_embeddings: activeReadyEmbeddings,
    fixture_shaped_event_names: fixtureShapedEventCount,
    fixture_fingerprints: fixtureFingerprintCount,
    no_active_document_entities: missingActiveDocumentCount,
    instruction: 'Confirm this is the intended legitimate inventory before approving judgments. If inventory changes, create a new version; never edit this manifest or packet in place.',
  },
  held_out_access: {
    parsed_splits: ['DEV'],
    sealed_queries_executed: 0,
    adversarial_queries_executed: 0,
    sealed_or_adversarial_judgments_loaded: false,
  },
};
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const manifestChecksum = sha256(manifestText);

const queries = devRecords.map((record) => buildReviewQuery(record, metadata.entities));
const packet = {
  packet_version: packetVersion,
  ...(phase === 'day4-postcoverage'
    ? { supersedes: 'dev-review-packet.day3.v2' }
    : artifactVersion === '2' ? { supersedes: 'dev-review-packet.day3.v1' } : {}),
  status: 'HUMAN_DEV_JUDGMENT_REQUIRED',
  dataset_manifest: { version: manifestVersion, checksum: manifestChecksum },
  dataset_inventory_checksum: inventoryChecksum,
  split: 'DEV',
  dev_queries_total: 60,
  current_dataset_judgments_complete: currentJudgedCount,
  current_dataset_judgments_missing: 60 - currentJudgedCount,
  rubric: {
    grades: {
      '0': 'not relevant',
      '1': 'marginal',
      '2': 'relevant',
      '3': 'highly relevant',
    },
    hard_constraint_rule: 'Any explicit structured or hard-constraint violation receives grade 0 regardless of textual similarity.',
    prohibition: 'Do not invent entity IDs or infer relevance grades from query wording.',
  },
  target_not_in_frozen_dataset_handling: {
    required_human_confirmation: true,
    known_item_target_id: null,
    product_outcome: 'QUERY_UNSATISFIED',
    primary_failure_attribution: 'INVENTORY',
    search_ranking_assessment: 'NOT_EVALUATED',
    instruction: 'Use only after confirming the target is absent from the frozen inventory; do not convert absence into a ranking miss.',
  },
  pooling_method: 'EXHAUSTIVE_HARD_ELIGIBLE_CURRENT_CANONICAL_INVENTORY; no search results or configuration metrics were inspected',
  inventory: metadata.entities,
  queries,
  held_out_guard: manifest.held_out_access,
};
const packetText = `${JSON.stringify(packet, null, 2)}\n`;
const packetMarkdown = renderMarkdown(packet);

const manifestDirectory = resolve(outputRoot, 'evaluation/manifests');
const judgmentDirectory = resolve(outputRoot, 'evaluation/judgments');
await Promise.all([mkdir(manifestDirectory, { recursive: true }), mkdir(judgmentDirectory, { recursive: true })]);
await Promise.all([
  writeNew(resolve(manifestDirectory, `${manifestVersion}.json`), manifestText),
  writeNew(resolve(manifestDirectory, `${manifestVersion}.sha256`), `${manifestChecksum}\n`),
  writeNew(resolve(judgmentDirectory, `${packetVersion}.json`), packetText),
  writeNew(resolve(judgmentDirectory, `${packetVersion}.md`), packetMarkdown),
  writeNew(resolve(judgmentDirectory, `${packetVersion}.sha256`), `${sha256(packetText)}\n`),
]);
console.log(JSON.stringify({
  manifestVersion,
  manifestChecksum,
  inventoryChecksum,
  publishedEntityCount,
  activeSearchDocumentCount,
  activeReadyEmbeddings,
  fixtureShapedEventCount,
  devQueries: queries.length,
  currentJudgedCount,
  missingJudgmentCount: 60 - currentJudgedCount,
  parsedSplits: ['DEV'],
}));

async function readCurrentMetadata(database: pg.Client): Promise<CurrentMetadata> {
  const boundary = await database.query<{ id: string; version: string; checksum: string }>(
    'select id, version, source_checksum as checksum from app.geographic_scope_boundaries where is_active order by id',
  );
  const taxonomy = await database.query<{ version: string; checksum: string; node_count: number }>(
    'select taxonomy_version as version, taxonomy_checksum as checksum, count(*)::int as node_count from app.taxonomy_nodes where active group by taxonomy_version, taxonomy_checksum',
  );
  const config = await database.query('select * from app.search_configs where is_active order by version');
  const documents = await database.query<{
    entity_id: string; content_hash: string; template_version: string; document_version: string;
  }>(
    'select entity_id, content_hash, template_version, document_version from app.search_documents where is_active order by entity_id',
  );
  const embeddingCounts = await database.query<{
    provider: string; model: string; model_revision: string; dimension: number; status: string; count: number;
  }>(
    'select provider, model, model_revision, dimension, status, count(*)::int from app.embeddings group by provider, model, model_revision, dimension, status order by provider, model, model_revision, dimension, status',
  );
  const canonicalStateCounts = await database.query<{
    entity_type: string; publication_status: string; count: number;
  }>(
    'select entity_type, publication_status, count(*)::int from app.canonical_entities where merged_into_id is null group by entity_type, publication_status order by entity_type, publication_status',
  );
  const entityRows = await database.query<{
      id: string; entity_type: 'PLACE' | 'EVENT'; canonical_name: string; publication_status: string;
      scope_id: string; scope_boundary_id: string; inside_active_boundary: boolean; chain_key: string | null;
      place_status: string | null; place_latitude: number | null; place_longitude: number | null;
      place_street_address: string | null; place_locality: string | null;
      event_status: string | null; starts_at: Date | null; ends_at: Date | null; status_observed_at: Date | null;
      venue_place_id: string | null; venue_name: string | null; event_latitude: number | null;
      event_longitude: number | null; event_street_address: string | null; event_locality: string | null;
  }>(
      `select entity.id, entity.entity_type, entity.canonical_name, entity.publication_status,
              entity.scope_id, entity.scope_boundary_id, entity.chain_key,
              case
                when entity.entity_type = 'PLACE' then extensions.st_covers(boundary.boundary, place.location::extensions.geometry)
                else extensions.st_covers(boundary.boundary, coalesce(event.location, venue.location)::extensions.geometry)
              end as inside_active_boundary,
              place.status as place_status,
              extensions.st_y(place.location::extensions.geometry) as place_latitude,
              extensions.st_x(place.location::extensions.geometry) as place_longitude,
              place.street_address as place_street_address, place.locality as place_locality,
              event.status as event_status, event.starts_at, event.ends_at, event.status_observed_at,
              event.venue_place_id, coalesce(venue_entity.canonical_name, event.standalone_venue_name) as venue_name,
              extensions.st_y(coalesce(event.location, venue.location)::extensions.geometry) as event_latitude,
              extensions.st_x(coalesce(event.location, venue.location)::extensions.geometry) as event_longitude,
              coalesce(venue.street_address, event.standalone_street_address) as event_street_address,
              coalesce(venue.locality, event.standalone_locality) as event_locality
       from app.canonical_entities as entity
       join app.geographic_scope_boundaries as boundary
         on boundary.id = entity.scope_boundary_id and boundary.scope_id = entity.scope_id and boundary.is_active
       left join app.places as place on place.entity_id = entity.id
       left join app.events as event on event.entity_id = entity.id
       left join app.places as venue on venue.entity_id = event.venue_place_id
       left join app.canonical_entities as venue_entity on venue_entity.id = event.venue_place_id
       where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
       order by entity.entity_type, entity.id`,
  );
  const memberships = await database.query<{
    entity_id: string; id: string; slug: string; label_en: string; label_sv: string; path: string[];
  }>(
    `select membership.entity_id, node.id, node.slug, node.label_en, node.label_sv, node.path
       from app.entity_taxonomy_memberships as membership
       join app.taxonomy_nodes as node on node.id = membership.taxonomy_node_id
       where membership.active and node.active
       order by membership.entity_id, node.path, node.id`,
  );
  const evidence = await database.query<{ entity_id: string; source_key: string; capture_run_id: string }>(
    `select distinct record.canonical_entity_id as entity_id, source.key as source_key,
              version.capture_run_id
       from app.source_records as record
       join app.sources as source on source.id = record.source_id
       join app.source_record_versions as version on version.id = record.current_version_id
       join app.canonical_entities as entity on entity.id = record.canonical_entity_id
       where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
       order by record.canonical_entity_id, source.key, version.capture_run_id`,
  );
  if (boundary.rows.length !== 1 || taxonomy.rows.length !== 1 || config.rows.length !== 1) {
    throw new Error('CURRENT_DATASET_METADATA_NOT_UNIQUE');
  }
  const documentsByEntity = new Map(documents.rows.map((row) => [row.entity_id, {
    contentHash: row.content_hash,
    templateVersion: row.template_version,
    documentVersion: row.document_version,
  }]));
  const membershipsByEntity = groupBy(memberships.rows, ({ entity_id: entityId }) => entityId);
  const evidenceByEntity = groupBy(evidence.rows, ({ entity_id: entityId }) => entityId);
  const entities: InventoryEntity[] = entityRows.rows.map((row) => ({
    canonicalEntityId: row.id,
    entityType: row.entity_type,
    canonicalName: row.canonical_name,
    publicationStatus: row.publication_status,
    scopeId: row.scope_id,
    scopeBoundaryId: row.scope_boundary_id,
    insideActiveBoundary: row.inside_active_boundary,
    chainKey: row.chain_key,
    place: row.entity_type === 'PLACE' ? {
      status: row.place_status!,
      latitude: row.place_latitude!,
      longitude: row.place_longitude!,
      streetAddress: row.place_street_address,
      locality: row.place_locality,
    } : null,
    event: row.entity_type === 'EVENT' ? {
      status: row.event_status!,
      startsAt: row.starts_at!.toISOString(),
      endsAt: row.ends_at?.toISOString() ?? null,
      statusObservedAt: row.status_observed_at!.toISOString(),
      venuePlaceId: row.venue_place_id,
      venueName: row.venue_name,
      latitude: row.event_latitude,
      longitude: row.event_longitude,
      streetAddress: row.event_street_address,
      locality: row.event_locality,
    } : null,
    taxonomyMemberships: (membershipsByEntity.get(row.id) ?? []).map((membership) => ({
      id: membership.id,
      slug: membership.slug,
      labelEn: membership.label_en,
      labelSv: membership.label_sv,
      path: membership.path,
    })),
    sourceEvidence: (evidenceByEntity.get(row.id) ?? []).map(({ source_key: sourceKey, capture_run_id: captureRunId }) => ({
      sourceKey,
      captureRunId,
    })),
    searchDocument: documentsByEntity.get(row.id) ?? null,
  }));
  return {
    boundary: boundary.rows[0]!,
    taxonomy: {
      version: taxonomy.rows[0]!.version,
      checksum: taxonomy.rows[0]!.checksum,
      nodeCount: taxonomy.rows[0]!.node_count,
    },
    searchConfig: config.rows[0]!,
    searchDocuments: documents.rows.map(({ entity_id: entityId, content_hash: contentHash, template_version: templateVersion, document_version: documentVersion }) => ({
      entityId, contentHash, templateVersion, documentVersion,
    })),
    embeddingCounts: embeddingCounts.rows.map(({ model_revision: revision, ...row }) => ({ ...row, revision })),
    canonicalStateCounts: canonicalStateCounts.rows.map(({ entity_type: entityType, publication_status: publicationStatus, count }) => ({
      entityType, publicationStatus, count,
    })),
    entities,
  };
}

function buildReviewQuery(record: EvalCorpusRecordV1, entities: InventoryEntity[]) {
  const rows = entities.map((entity) => ({ entity, reasons: exclusionReasons(record, entity) }));
  const targetLabels = frozenTargetLabels(record.known_item_target);
  const exactMatches = entities.filter(({ canonicalName }) => targetLabels.includes(canonicalName));
  return {
    queryId: record.query_id,
    query: record.query,
    language: record.language,
    family: record.family,
    pairGroupId: record.pair_group_id,
    structuredFilters: record.request_filters,
    hardConstraints: record.hard_constraints,
    evaluationClockUtc: record.evaluation_clock_utc,
    frozenTargetReference: record.known_item_target,
    targetInventoryEvidence: {
      exactCanonicalNameMatches: exactMatches.map(({ canonicalEntityId, canonicalName }) => ({
        canonicalEntityId, canonicalName,
      })),
      statusToConfirm: targetLabels.length === 0
        ? 'NOT_APPLICABLE'
        : exactMatches.length === 0 ? 'TARGET_NOT_IN_FROZEN_DATASET' : 'TARGET_MATCHED',
      humanConfirmationRequired: targetLabels.length > 0,
    },
    candidatePool: rows.filter(({ reasons }) => reasons.length === 0).map(({ entity }) => ({
      canonicalEntityId: entity.canonicalEntityId,
      displayName: entity.canonicalName,
      entityType: entity.entityType,
      grade: null,
    })),
    hardConstraintExcludedInventory: rows.filter(({ reasons }) => reasons.length > 0).map(({ entity, reasons }) => ({
      canonicalEntityId: entity.canonicalEntityId,
      displayName: entity.canonicalName,
      reasons,
      gradeRuleAfterHumanConfirmation: '0',
    })),
    humanJudgment: {
      knownItemTargetId: null,
      relevant: rows.filter(({ reasons }) => reasons.length === 0).map(({ entity }) => ({
        entityId: entity.canonicalEntityId,
        grade: null,
      })),
      rationale: null,
      judgedBy: null,
      judgedAt: null,
    },
  };
}

function exclusionReasons(record: EvalCorpusRecordV1, entity: InventoryEntity): string[] {
  const reasons: string[] = [];
  if (entity.scopeId !== record.scope.scope_id || !entity.insideActiveBoundary) reasons.push('OUTSIDE_REQUEST_SCOPE');
  const requestedTypes = record.request_filters.entity_types;
  if (Array.isArray(requestedTypes) && !requestedTypes.includes(entity.entityType)) reasons.push('ENTITY_TYPE_FILTER');
  if (entity.place && !['ACTIVE', 'TEMPORARILY_CLOSED', 'UNKNOWN'].includes(entity.place.status)) {
    reasons.push('PLACE_STATUS_INELIGIBLE');
  }
  if (entity.event) {
    if (entity.event.status !== 'SCHEDULED') reasons.push('EVENT_STATUS_INELIGIBLE');
    const clock = Date.parse(record.evaluation_clock_utc!);
    const expiry = Date.parse(entity.event.endsAt ?? entity.event.startsAt);
    if (entity.event.endsAt ? expiry <= clock : expiry < clock) reasons.push('EVENT_EXPIRED_AT_EVALUATION_CLOCK');
  }
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  if (typeof taxonomy?.node_id === 'string' && !entity.taxonomyMemberships.some(({ path }) => (
    path.includes(taxonomy.node_id as string)
  ))) reasons.push('TAXONOMY_FILTER');
  const location = record.request_filters.location as {
    latitude?: unknown; longitude?: unknown; radius_meters?: unknown;
  } | undefined;
  if (typeof location?.latitude === 'number' && typeof location.longitude === 'number'
    && typeof location.radius_meters === 'number') {
    const point = entity.place ?? entity.event;
    if (!point || point.latitude === null || point.longitude === null
      || distanceMeters(location.latitude, location.longitude, point.latitude, point.longitude) > location.radius_meters) {
      reasons.push('RADIUS_FILTER');
    }
  }
  return reasons;
}

function renderMarkdown(packet: {
  dataset_manifest: { version: string; checksum: string };
  dataset_inventory_checksum: string;
  current_dataset_judgments_complete: number;
  current_dataset_judgments_missing: number;
  inventory: InventoryEntity[];
  queries: ReturnType<typeof buildReviewQuery>[];
}): string {
  const inventoryRows = packet.inventory.map((entity) => {
    const context = entity.place
      ? `Place; status=${entity.place.status}; location=${entity.place.latitude},${entity.place.longitude}; address=${entity.place.streetAddress ?? ''}; locality=${entity.place.locality ?? ''}`
      : `Event; status=${entity.event!.status}; starts=${entity.event!.startsAt}; ends=${entity.event!.endsAt ?? 'POINT'}; venue=${entity.event!.venueName ?? ''}; location=${entity.event!.latitude ?? ''},${entity.event!.longitude ?? ''}`;
    const taxonomy = entity.taxonomyMemberships.map(({ slug, labelEn, labelSv }) => `${slug} (${labelEn} / ${labelSv})`).join('; ');
    return `| ${entity.canonicalEntityId} | ${entity.canonicalName} | ${entity.entityType} | ${context} | ${taxonomy || 'none'} | ${entity.searchDocument?.contentHash ?? 'NO_ACTIVE_DOCUMENT'} |`;
  }).join('\n');
  const querySections = packet.queries.map((query) => {
    const candidates = query.candidatePool.length === 0
      ? '_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._'
      : query.candidatePool.map((candidate) => (
        `| ${candidate.canonicalEntityId} | ${candidate.displayName} | ${candidate.entityType} | __ |`
      )).join('\n');
    const excluded = query.hardConstraintExcludedInventory.map(({ canonicalEntityId, reasons }) => (
      `${canonicalEntityId}:${reasons.join('+')}`
    )).join('; ');
    return `## ${query.queryId}\n\n`
      + `- Query: ${query.query}\n`
      + `- Language: ${query.language}\n`
      + `- Family: ${query.family}\n`
      + `- Pair group: ${query.pairGroupId ?? 'none'}\n`
      + `- Structured filters: \`${JSON.stringify(query.structuredFilters)}\`\n`
      + `- Hard constraints: ${query.hardConstraints.join('; ')}\n`
      + `- Evaluation clock: ${query.evaluationClockUtc}\n`
      + `- Frozen target reference: \`${JSON.stringify(query.frozenTargetReference)}\`\n`
      + `- Target status to confirm: ${query.targetInventoryEvidence.statusToConfirm}\n`
      + `- Exact canonical-name matches: \`${JSON.stringify(query.targetInventoryEvidence.exactCanonicalNameMatches)}\`\n`
      + `- Hard-excluded inventory: ${excluded || 'none'}\n\n`
      + `| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |\n`
      + `|---|---|---|---|\n${candidates}\n\n`
      + `- Human rationale: __\n- Judged by: __\n- Judged at: __\n`;
  }).join('\n\n');
  return `# ${phase === 'day4-postcoverage' ? 'Post-coverage' : 'EVAL-03'} full DEV human judgment packet\n\n`
    + `- Split: DEV only\n`
    + `- Dataset manifest: ${packet.dataset_manifest.version}\n`
    + `- Dataset manifest checksum: ${packet.dataset_manifest.checksum}\n`
    + `- Dataset inventory checksum: ${packet.dataset_inventory_checksum}\n`
    + `- DEV judged for this inventory: ${packet.current_dataset_judgments_complete}\n`
    + `- DEV missing: ${packet.current_dataset_judgments_missing}\n`
    + `- SEALED/adversarial queries and judgments: not loaded or exposed\n\n`
    + `## Rubric and target handling\n\n`
    + `- 0 = not relevant; 1 = marginal; 2 = relevant; 3 = highly relevant.\n`
    + `- Explicit hard-constraint violations receive grade 0 regardless of textual similarity.\n`
    + `- Codex has left every relevance grade blank.\n`
    + `- Confirm TARGET_NOT_IN_FROZEN_DATASET before using it. When confirmed: leave the target ID null, record product outcome QUERY_UNSATISFIED, primary attribution INVENTORY, and ranking assessment NOT_EVALUATED.\n`
    + `- Confirm the manifest's current-state observations before approving judgments. An inventory repair requires a new manifest and packet version.\n\n`
    + `## Frozen inventory\n\n`
    + `| CanonicalEntity ID | Name | Type | Factual context | Taxonomy | SearchDocument |\n`
    + `|---|---|---|---|---|---|\n${inventoryRows}\n\n`
    + `${querySections.trimEnd()}\n`;
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

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value]);
  return groups;
}

function unique(values: string[], artifact: string): string {
  const distinct = [...new Set(values)];
  if (distinct.length !== 1) throw new Error(`${artifact}_NOT_UNIQUE`);
  return distinct[0]!;
}

function argumentValue(args: string[], name: string): string | undefined {
  const prefix = `${name}=`;
  return args.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function writeNew(path: string, text: string): Promise<void> {
  await writeFile(path, text, { flag: 'wx' });
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
