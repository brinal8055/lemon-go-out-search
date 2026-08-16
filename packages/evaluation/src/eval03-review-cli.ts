import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import pg from 'pg';

import type { EvalCorpusRecordV1 } from './index.ts';
import { stableJson } from './dev-runner.ts';

const root = new URL('../../../', import.meta.url);
const phase = argumentValue(process.argv.slice(2), '--phase') ?? 'day3';
if (!['day3', 'day4-postcoverage', 'final-eval-recovery'].includes(phase)) {
  throw new Error('ARTIFACT_PHASE_UNSUPPORTED');
}
const artifactVersion = argumentValue(process.argv.slice(2), '--artifact-version') ?? '1';
if (!['1', '2'].includes(artifactVersion)) throw new Error('ARTIFACT_VERSION_UNSUPPORTED');
const manifestVersion = phase === 'day3'
  ? `dataset-manifest.day3-current.v${artifactVersion}`
  : `dataset-manifest.day4-postcoverage.v${artifactVersion}`;
const packetVersion = phase === 'day3'
  ? `dev-review-packet.day3.v${artifactVersion}`
  : `dev-review-packet.day4-postcoverage.v${artifactVersion}`;
const evaluationClockUtc = '2026-10-15T12:00:00Z';
const outputRoot = resolve(argumentValue(process.argv.slice(2), '--output-root') ?? root.pathname);
const connectionString = phase === 'final-eval-recovery'
  ? process.env.LEMON_FINAL_EVAL_DATABASE_URL ?? ''
  : process.env.LEMON_LOCAL_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

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
  embeddingAttempts: Array<{
    id: string;
    searchDocumentId: string;
    entityId: string;
    provider: string;
    model: string;
    revision: string;
    dimension: number;
    documentHash: string;
    status: string;
    attemptKey: string;
    attemptedAt: string;
    generatedAt: string | null;
    errorClass: string | null;
    errorCode: string | null;
    staleReason: string | null;
  }>;
  compatibleReadyEmbeddings: Array<{
    id: string;
    searchDocumentId: string;
    entityId: string;
    documentHash: string;
    attemptKey: string;
    generatedAt: string;
  }>;
  sourceRunState: Array<{
    sourceKey: string;
    runId: string;
    status: string;
    refreshUnitComplete: boolean;
    fetched: number;
    valid: number;
    invalid: number;
    finishedAt: string;
  }>;
  fixtureAudit: { fixtureSources: number; fixtureSourceRecords: number };
  canonicalStateCounts: Array<{ entityType: string; publicationStatus: string; count: number }>;
  entities: InventoryEntity[];
  recoveryDocumentRows: Array<{
    id: string;
    entityId: string;
    entityType: 'PLACE' | 'EVENT';
    contentHash: string;
  }>;
  recoveryEmbeddingRows: Array<{
    id: string;
    searchDocumentId: string;
    entityId: string;
    documentHash: string;
    vectorHash: string;
  }>;
  currentEvidence: Array<{
    entityId: string;
    sourceRecordId: string;
    sourceKey: string;
    externalKey: string;
    versionId: string;
    captureRunId: string;
    contentHash: string;
    contentStatus: string;
    parseAttemptId: string;
    parserVersion: string;
    normalizedOutputHash: string;
    parseStatus: string;
  }>;
  canonicalFactProvenance: Array<{
    entityId: string;
    provenanceId: string;
    factKey: string;
    sourceRecordVersionId: string;
    selectionMethod: string;
    selectedAt: string;
  }>;
  duplicateCandidates: Array<{
    candidateId: string;
    recordAId: string;
    recordBId: string;
    entityAId: string | null;
    entityBId: string | null;
    evidenceHash: string;
    status: string;
    currentDecisionId: string;
  }>;
  activeTaxonomyMembershipCount: number;
};

const priorJudgmentsPath = phase === 'day3'
  ? 'evaluation/judgments/judgments.day2.v1.json'
  : phase === 'final-eval-recovery'
    ? 'evaluation/judgments/judgments.day4-postcoverage.v1.json'
    : 'evaluation/judgments/judgments.day3.v1.json';
const priorManifestPath = phase === 'day3'
  ? 'evaluation/manifests/dataset-manifest.day2.v1.json'
  : phase === 'final-eval-recovery'
    ? 'evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json'
    : artifactVersion === '2'
    ? 'evaluation/manifests/dataset-manifest.day4-postcoverage.v1.json'
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

if (phase === 'final-eval-recovery') {
  await writeRecoveryArtifacts({
    metadata,
    devRecords,
    corpusChecksum,
    priorJudgmentsText,
    priorManifestText,
  });
  process.exit(0);
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
const activeReadyEmbeddings = metadata.compatibleReadyEmbeddings.length;
const embeddingStateChecksum = sha256(stableJson(metadata.embeddingAttempts));
const compatibleReadyChecksum = sha256(stableJson(metadata.compatibleReadyEmbeddings));
const fixtureShapedEventCount = metadata.entities.filter(({ entityType, canonicalName }) => (
  entityType === 'EVENT' && /^Municipal Event [0-9a-f]{8}$/.test(canonicalName)
)).length;
const fixtureFingerprintCount = metadata.entities.filter(({ canonicalName, sourceEvidence }) => (
  canonicalName === 'Explicit Indian Restaurant'
  || sourceEvidence.some(({ sourceKey }) => sourceKey.startsWith('src03b-place-'))
)).length + fixtureShapedEventCount;
const duplicateCanonicalIdCount = metadata.entities.length
  - new Set(metadata.entities.map(({ canonicalEntityId }) => canonicalEntityId)).size;
const missingActiveDocumentCount = metadata.entities.filter(({ searchDocument }) => searchDocument === null).length;
if ((artifactVersion === '2' || phase === 'day4-postcoverage') && (
  metadata.entities.length === 0
  || fixtureFingerprintCount > 0
  || metadata.fixtureAudit.fixtureSources > 0
  || metadata.fixtureAudit.fixtureSourceRecords > 0
  || duplicateCanonicalIdCount > 0
  || missingActiveDocumentCount > 0
)) {
  throw new Error('V2_CLEAN_DATASET_ACCEPTANCE_FAILED');
}
const publishedEntityCount = metadata.entities.length;
const activeSearchDocumentCount = metadata.searchDocuments.length;
if (phase === 'day4-postcoverage' && artifactVersion === '2'
  && activeReadyEmbeddings !== activeSearchDocumentCount) {
  throw new Error('POST_COVERAGE_HYBRID_READINESS_INCOMPLETE');
}
const codeGitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const manifest = {
  manifest_version: manifestVersion,
  ...(phase === 'day4-postcoverage'
    ? { supersedes: artifactVersion === '2'
      ? 'dataset-manifest.day4-postcoverage.v1'
      : 'dataset-manifest.day3-current.v2' }
    : artifactVersion === '2' ? { supersedes: 'dataset-manifest.day3-current.v1' } : {}),
  status: 'FROZEN_FOR_HUMAN_REVIEW',
  purpose: phase === 'day4-postcoverage'
    ? artifactVersion === '2'
      ? 'POSTCOV_READY_01_HYBRID_DEV_JUDGMENT_PREPARATION_ONLY'
      : 'COVERAGE_01_POST_COVERAGE_DEV_JUDGMENT_PREPARATION_ONLY'
    : 'EVAL_03_DEV_JUDGMENT_PREPARATION_ONLY',
  canonical_dataset_version: phase === 'day4-postcoverage'
    ? `day4-postcoverage.v${artifactVersion}-${inventoryChecksum.slice(0, 12)}`
    : `day3-current.v${artifactVersion}-${inventoryChecksum.slice(0, 12)}`,
  source_record_ingestion_runs: sourceRuns,
  source_run_state: metadata.sourceRunState,
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
    embedding_state_checksum: embeddingStateChecksum,
    compatible_ready_checksum: compatibleReadyChecksum,
    compatible_selected_vectors: metadata.compatibleReadyEmbeddings,
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
    fixture_sources: metadata.fixtureAudit.fixtureSources,
    fixture_source_records: metadata.fixtureAudit.fixtureSourceRecords,
    duplicate_canonical_ids: duplicateCanonicalIdCount,
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
    ? { supersedes: artifactVersion === '2'
      ? 'dev-review-packet.day4-postcoverage.v1'
      : 'dev-review-packet.day3.v2' }
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
  embeddingStateChecksum,
  compatibleReadyChecksum,
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
    id: string; entity_id: string; entity_type: 'PLACE' | 'EVENT'; content_hash: string;
    template_version: string; document_version: string;
  }>(
    `select document.id, document.entity_id, entity.entity_type, document.content_hash,
            document.template_version, document.document_version
       from app.search_documents as document
       join app.canonical_entities as entity on entity.id = document.entity_id
      where document.is_active
      order by document.entity_id`,
  );
  const embeddingCounts = await database.query<{
    provider: string; model: string; model_revision: string; dimension: number; status: string; count: number;
  }>(
    'select provider, model, model_revision, dimension, status, count(*)::int from app.embeddings group by provider, model, model_revision, dimension, status order by provider, model, model_revision, dimension, status',
  );
  const embeddingAttempts = await database.query<{
    id: string; search_document_id: string; entity_id: string; provider: string; model: string;
    model_revision: string; dimension: number; document_hash: string; status: string;
    attempt_key: string; attempted_at: Date; generated_at: Date | null; error_class: string | null;
    error_code: string | null; stale_reason: string | null;
  }>(`
    select id, search_document_id, entity_id, provider, model, model_revision, dimension,
           document_hash, status, attempt_key, attempted_at, generated_at,
           error_class, error_code, stale_reason
      from app.embeddings
     order by search_document_id, attempted_at, id
  `);
  const compatibleReadyEmbeddings = await database.query<{
    id: string; search_document_id: string; entity_id: string; document_hash: string;
    attempt_key: string; generated_at: Date; vector_hash: string;
  }>(`
    select compatible.id, compatible.search_document_id, compatible.entity_id,
           compatible.document_hash, embedding.attempt_key, compatible.generated_at,
           md5(compatible.embedding::text) as vector_hash
      from app.compatible_ready_embeddings_v as compatible
      join app.embeddings as embedding on embedding.id = compatible.id
     order by compatible.search_document_id, compatible.id
  `);
  const sourceRunState = await database.query<{
    source_key: string; run_id: string; status: string; refresh_unit_complete: boolean;
    fetched: number; valid: number; invalid: number; finished_at: Date;
  }>(`
    select distinct on (source.key) source.key as source_key, run.id as run_id,
           run.status::text, run.refresh_unit_complete, run.fetched, run.valid,
           run.invalid, run.finished_at
      from app.ingestion_runs as run
      join app.sources as source on source.id = run.source_id
     where source.key in ('OSM_OVERPASS', 'JONKOPING_MUNICIPAL_UTEGYM', 'JONKOPING_EVENT_CALENDAR')
       and run.status <> 'STARTED'
     order by source.key, run.finished_at desc, run.id
  `);
  const fixtureAudit = await database.query<{ fixture_sources: number; fixture_source_records: number }>(`
    select
      (select count(*)::int from app.sources
        where key like 'src03b-place-%' or licence ilike '%TEST%' or attribution ilike '%fixture%') as fixture_sources,
      (select count(*)::int
         from app.source_records as record
         join app.sources as source on source.id = record.source_id
        where source.key like 'src03b-place-%' or source.licence ilike '%TEST%'
           or source.attribution ilike '%fixture%')
        as fixture_source_records
  `);
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
  const currentEvidence = await database.query<{
    entity_id: string; source_record_id: string; source_key: string; external_key: string;
    version_id: string; capture_run_id: string; content_hash: string; content_status: string;
    parse_attempt_id: string; parser_version: string; normalized_output_hash: string; parse_status: string;
  }>(`
    select record.canonical_entity_id as entity_id, record.id as source_record_id,
           source.key as source_key, record.external_key, version.id as version_id,
           version.capture_run_id, version.content_hash, version.content_status::text,
           attempt.id as parse_attempt_id, attempt.parser_version,
           attempt.normalized_output_hash, attempt.status::text as parse_status
      from app.source_records as record
      join app.sources as source on source.id = record.source_id
      join app.source_record_versions as version on version.id = record.current_version_id
      join app.source_record_parse_attempts as attempt on attempt.id = record.current_parse_attempt_id
      join app.canonical_entities as entity on entity.id = record.canonical_entity_id
     where entity.publication_status = 'PUBLISHED' and entity.merged_into_id is null
     order by record.canonical_entity_id, source.key, record.id
  `);
  const canonicalFactProvenance = await database.query<{
    entity_id: string; provenance_id: string; fact_key: string; source_record_version_id: string;
    selection_method: string; selected_at: Date;
  }>(`
    select provenance.entity_id, provenance.id as provenance_id, provenance.fact_key::text,
           provenance.source_record_version_id, provenance.selection_method, provenance.selected_at
      from app.canonical_fact_provenance as provenance
      join app.canonical_entities as entity on entity.id = provenance.entity_id
     where provenance.is_current and entity.publication_status = 'PUBLISHED'
       and entity.merged_into_id is null
     order by provenance.entity_id, provenance.fact_key, provenance.id
  `);
  const duplicateCandidates = await database.query<{
    candidate_id: string; record_a_id: string; record_b_id: string;
    entity_a_id: string | null; entity_b_id: string | null; evidence_hash: string;
    status: string; current_decision_id: string;
  }>(`
    select candidate.id as candidate_id, candidate.record_a_id, candidate.record_b_id,
           candidate.entity_a_id, candidate.entity_b_id, candidate.evidence_hash,
           candidate.status::text, candidate.current_decision_id
      from app.duplicate_candidates as candidate
     order by candidate.id
  `);
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
    embeddingAttempts: embeddingAttempts.rows.map((row) => ({
      id: row.id,
      searchDocumentId: row.search_document_id,
      entityId: row.entity_id,
      provider: row.provider,
      model: row.model,
      revision: row.model_revision,
      dimension: row.dimension,
      documentHash: row.document_hash,
      status: row.status,
      attemptKey: row.attempt_key,
      attemptedAt: row.attempted_at.toISOString(),
      generatedAt: row.generated_at?.toISOString() ?? null,
      errorClass: row.error_class,
      errorCode: row.error_code,
      staleReason: row.stale_reason,
    })),
    compatibleReadyEmbeddings: compatibleReadyEmbeddings.rows.map((row) => ({
      id: row.id,
      searchDocumentId: row.search_document_id,
      entityId: row.entity_id,
      documentHash: row.document_hash,
      attemptKey: row.attempt_key,
      generatedAt: row.generated_at.toISOString(),
    })),
    sourceRunState: sourceRunState.rows.map((row) => ({
      sourceKey: row.source_key,
      runId: row.run_id,
      status: row.status,
      refreshUnitComplete: row.refresh_unit_complete,
      fetched: row.fetched,
      valid: row.valid,
      invalid: row.invalid,
      finishedAt: row.finished_at.toISOString(),
    })),
    fixtureAudit: {
      fixtureSources: fixtureAudit.rows[0].fixture_sources,
      fixtureSourceRecords: fixtureAudit.rows[0].fixture_source_records,
    },
    canonicalStateCounts: canonicalStateCounts.rows.map(({ entity_type: entityType, publication_status: publicationStatus, count }) => ({
      entityType, publicationStatus, count,
    })),
    entities,
    recoveryDocumentRows: documents.rows.map((row) => ({
      id: row.id,
      entityId: row.entity_id,
      entityType: row.entity_type,
      contentHash: row.content_hash,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    recoveryEmbeddingRows: compatibleReadyEmbeddings.rows.map((row) => ({
      id: row.id,
      searchDocumentId: row.search_document_id,
      entityId: row.entity_id,
      documentHash: row.document_hash,
      vectorHash: row.vector_hash,
    })).sort((left, right) => left.id.localeCompare(right.id)),
    currentEvidence: currentEvidence.rows.map((row) => ({
      entityId: row.entity_id,
      sourceRecordId: row.source_record_id,
      sourceKey: row.source_key,
      externalKey: row.external_key,
      versionId: row.version_id,
      captureRunId: row.capture_run_id,
      contentHash: row.content_hash,
      contentStatus: row.content_status,
      parseAttemptId: row.parse_attempt_id,
      parserVersion: row.parser_version,
      normalizedOutputHash: row.normalized_output_hash,
      parseStatus: row.parse_status,
    })),
    canonicalFactProvenance: canonicalFactProvenance.rows.map((row) => ({
      entityId: row.entity_id,
      provenanceId: row.provenance_id,
      factKey: row.fact_key,
      sourceRecordVersionId: row.source_record_version_id,
      selectionMethod: row.selection_method,
      selectedAt: row.selected_at.toISOString(),
    })),
    duplicateCandidates: duplicateCandidates.rows.map((row) => ({
      candidateId: row.candidate_id,
      recordAId: row.record_a_id,
      recordBId: row.record_b_id,
      entityAId: row.entity_a_id,
      entityBId: row.entity_b_id,
      evidenceHash: row.evidence_hash,
      status: row.status,
      currentDecisionId: row.current_decision_id,
    })),
    activeTaxonomyMembershipCount: memberships.rows.length,
  };
}

async function writeRecoveryArtifacts(input: {
  metadata: CurrentMetadata;
  devRecords: EvalCorpusRecordV1[];
  corpusChecksum: string;
  priorJudgmentsText: string;
  priorManifestText: string;
}): Promise<void> {
  const expectedManifestChecksum = 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82';
  const manifestVersion = 'dataset-manifest.final-eval-recovery.v1';
  const inventoryVersion = 'dev-inventory.final-eval-recovery.v1';
  const deltaVersion = 'dev-inventory-delta.final-eval-recovery.v1';
  const packetVersion = 'dev-review-packet.final-eval-recovery.v1';
  const historicalJudgmentVersion = 'judgments.day4-postcoverage.v1';
  const manifestUrl = new URL('evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json', root);
  const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json.sha256', root);
  const historicalPacketUrl = new URL('evaluation/judgments/dev-review-packet.day4-postcoverage.v2.json', root);
  const [manifestText, manifestChecksumText, historicalPacketText, linkedProject] = await Promise.all([
    readFile(manifestUrl, 'utf8'),
    readFile(manifestChecksumUrl, 'utf8'),
    readFile(historicalPacketUrl, 'utf8'),
    readFile(new URL('supabase/.temp/project-ref', root), 'utf8'),
  ]);
  const manifestChecksum = manifestChecksumText.trim().split(/\s+/)[0]!;
  if (sha256(manifestText) !== expectedManifestChecksum || manifestChecksum !== expectedManifestChecksum) {
    throw new Error('RECOVERY_MANIFEST_CHECKSUM_MISMATCH');
  }
  if (process.env.SUPABASE_PROJECT_ID !== 'zrxdjorrwcunprbykdtg'
    || linkedProject.trim() !== process.env.SUPABASE_PROJECT_ID) {
    throw new Error('FINAL_EVAL_PROJECT_IDENTITY_MISMATCH');
  }
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', '52d0b3d', 'HEAD'], { cwd: root, stdio: 'ignore' });
  } catch {
    throw new Error('RECOVERY_B_PREREQUISITE_MISSING');
  }

  const manifest = JSON.parse(manifestText) as RecoveryManifest;
  const historicalPacket = JSON.parse(historicalPacketText) as HistoricalPacket;
  const historicalJudgments = JSON.parse(input.priorJudgmentsText) as HistoricalJudgments;
  const historicalManifest = JSON.parse(input.priorManifestText) as { manifest_version: string };
  if (manifest.manifest_version !== manifestVersion || manifest.status !== 'FROZEN_PRE_JUDGMENT'
    || historicalJudgments.judgment_version !== historicalJudgmentVersion
    || historicalManifest.manifest_version !== 'dataset-manifest.day4-postcoverage.v2'
    || historicalPacket.inventory.length !== 395 || historicalJudgments.records.length !== 60) {
    throw new Error('RECOVERY_INPUT_IDENTITY_MISMATCH');
  }

  const documentInventoryChecksum = sha256Lines(input.metadata.recoveryDocumentRows.map((row) => (
    `${row.id}|${row.entityId}|${row.entityType}|${row.contentHash}`
  )));
  const embeddingIdentityChecksum = sha256Lines(input.metadata.recoveryEmbeddingRows.map((row) => (
    `${row.id}|${row.searchDocumentId}|${row.entityId}|${row.documentHash}|${row.vectorHash}`
  )));
  const publishedMembershipCount = input.metadata.entities.reduce((count, entity) => (
    count + entity.taxonomyMemberships.length
  ), 0);
  const currentSourceRuns = new Map(input.metadata.sourceRunState.map((run) => [run.sourceKey, run]));
  const sourceRunDrift = manifest.source_runs.some((expected) => {
    const current = currentSourceRuns.get(expected.source_key);
    return !current || current.runId !== expected.run_id || current.status !== expected.status;
  });
  const config = input.metadata.searchConfig;
  const stateChecks = {
    entityCount: input.metadata.entities.length === 395,
    searchDocumentCount: input.metadata.searchDocuments.length === 395,
    compatibleReadyEmbeddingCount: input.metadata.recoveryEmbeddingRows.length === 395,
    fixtureSources: input.metadata.fixtureAudit.fixtureSources === 0,
    fixtureSourceRecords: input.metadata.fixtureAudit.fixtureSourceRecords === 0,
    documentInventoryChecksum: documentInventoryChecksum === manifest.search_documents.inventory_checksum,
    embeddingIdentityChecksum: embeddingIdentityChecksum === manifest.compatible_ready_embeddings.identity_checksum,
    boundaryVersion: input.metadata.boundary.version === manifest.boundary.boundary_version,
    boundaryChecksum: input.metadata.boundary.checksum === manifest.boundary.boundary_checksum,
    taxonomyVersion: input.metadata.taxonomy.version === manifest.taxonomy.version,
    // Recovery-B copied Recovery-A's membershipsCreated count; three Event memberships predate that run.
    taxonomyMembershipCount: input.metadata.activeTaxonomyMembershipCount
      === manifest.taxonomy.active_memberships + 3,
    publishedTaxonomyMembershipCount: publishedMembershipCount === 447,
    embeddingProvider: config.embedding_provider === manifest.embedding.provider,
    embeddingModel: config.embedding_model === manifest.embedding.model,
    embeddingRevision: config.embedding_revision === manifest.embedding.revision,
    embeddingDimension: config.embedding_dimension === manifest.embedding.dimension,
    sourceRuns: !sourceRunDrift,
  };
  const failedStateChecks = Object.entries(stateChecks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failedStateChecks.length > 0) {
    const diagnostics = failedStateChecks.includes('taxonomyMembershipCount')
      ? `:all=${input.metadata.activeTaxonomyMembershipCount},published=${publishedMembershipCount},manifest=${manifest.taxonomy.active_memberships}`
      : '';
    throw new Error(`RECOVERY_B_STATE_DRIFT:${failedStateChecks.join(',')}${diagnostics}`);
  }

  const allocation = Object.fromEntries([...new Set(input.devRecords.map(({ family }) => family))]
    .sort().map((family) => [family, input.devRecords.filter((record) => record.family === family).length]));
  const expectedAllocation = {
    broad_concentration: 4,
    broad_discovery: 4,
    canonical_exact_same_name: 5,
    event_time: 6,
    geo_scope_radius: 3,
    prefix: 4,
    scarcity_duplicate_state: 3,
    semantic_occasion_language: 16,
    taxonomy_parent_leaf: 7,
    typo_transposition_accent_spacing: 5,
    verified_colliding_aliases: 3,
  };
  if (stableJson(allocation) !== stableJson(expectedAllocation)
    || input.corpusChecksum !== manifest.query_corpus.checksum
    || new Set(input.devRecords.map(({ query_id: queryId }) => queryId)).size !== 60) {
    throw new Error('DEV_CORPUS_ALLOCATION_MISMATCH');
  }
  const semanticRecords = input.devRecords.filter(({ family }) => family === 'semantic_occasion_language');
  const semanticPairGroups = new Set(semanticRecords.map(({ pair_group_id: pairGroupId }) => pairGroupId));
  if (semanticRecords.length !== 16 || semanticPairGroups.has(null) || semanticPairGroups.size !== 8
    || [...semanticPairGroups].some((pairGroupId) => (
      semanticRecords.filter((record) => record.pair_group_id === pairGroupId).length !== 2
    ))) throw new Error('DEV_SEMANTIC_PAIR_DISCIPLINE_FAILED');

  const evidenceByEntity = groupBy(input.metadata.currentEvidence, ({ entityId }) => entityId);
  const provenanceByEntity = groupBy(input.metadata.canonicalFactProvenance, ({ entityId }) => entityId);
  const duplicateIdsByEntity = new Map<string, string[]>();
  for (const candidate of input.metadata.duplicateCandidates) {
    for (const entityId of [candidate.entityAId, candidate.entityBId]) {
      if (entityId) duplicateIdsByEntity.set(entityId, [
        ...(duplicateIdsByEntity.get(entityId) ?? []), candidate.candidateId,
      ]);
    }
  }
  const recoveryEntities = input.metadata.entities.map((entity) => ({
    ...entity,
    currentSourceEvidence: evidenceByEntity.get(entity.canonicalEntityId) ?? [],
    currentCanonicalFactProvenance: provenanceByEntity.get(entity.canonicalEntityId) ?? [],
    duplicateCandidateIds: duplicateIdsByEntity.get(entity.canonicalEntityId) ?? [],
  }));
  const inventoryChecksum = sha256(stableJson(recoveryEntities));
  const createdAt = new Date().toISOString();
  const inventory = {
    inventory_version: inventoryVersion,
    status: 'FROZEN_FOR_HUMAN_REVIEW',
    created_at: createdAt,
    remote_project: process.env.SUPABASE_PROJECT_ID,
    dataset_manifest: { version: manifestVersion, checksum: manifestChecksum },
    query_corpus: {
      version: 'corpus.v1', checksum: input.corpusChecksum, dev_query_count: 60,
      family_allocation: allocation, semantic_dev_query_count: 16, semantic_pair_group_count: 8,
    },
    inventory_checksum: inventoryChecksum,
    entity_count: recoveryEntities.length,
    active_search_document_count: input.metadata.searchDocuments.length,
    compatible_ready_embedding_count: input.metadata.recoveryEmbeddingRows.length,
    recovery_b_remote_verification: {
      state: 'MATCHES_RECOVERY_B',
      document_inventory_checksum: documentInventoryChecksum,
      embedding_identity_checksum: embeddingIdentityChecksum,
      fixture_contamination: 0,
      source_run_drift: false,
    },
    taxonomy_coverage: manifest.coverage,
    duplicate_state: {
      summary: manifest.duplicate_state,
      candidates: input.metadata.duplicateCandidates,
    },
    entities: recoveryEntities,
    held_out_guard: heldOutGuard(),
  };
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;

  const queries = input.devRecords.map((record) => buildReviewQuery(record, input.metadata.entities));
  const delta = buildRecoveryDelta({
    historicalPacket,
    historicalJudgments,
    currentEntities: recoveryEntities,
    currentQueries: queries,
  });
  const deltaArtifact = {
    delta_version: deltaVersion,
    status: 'FROZEN_COMPARISON',
    created_at: createdAt,
    historical: {
      judgment_version: historicalJudgmentVersion,
      manifest_version: 'dataset-manifest.day4-postcoverage.v2',
      inventory_checksum: historicalPacket.dataset_inventory_checksum,
    },
    recovery: { inventory_version: inventoryVersion, inventory_checksum: inventoryChecksum },
    comparison_rule: 'Canonical entity identity is exact UUID identity; names are never used to infer equivalence.',
    carry_forward_contract: {
      permitted: false,
      reason: 'The frozen contract requires a new complete judgment version after material inventory change but does not clearly authorize grade carry-forward.',
      evidence_identical_pair_count: delta.counts.EXACT_EVIDENCE_IDENTICAL,
      carried_pair_count: 0,
    },
    classification_definitions: {
      EXACT_EVIDENCE_IDENTICAL: 'Canonical identity and all pinned judgment-relevant evidence are byte-identical.',
      CHANGED_EVIDENCE: 'At least one pinned judgment-relevant canonical field differs.',
      NEW_ENTITY: 'Canonical entity ID is absent from the historical inventory.',
      REMOVED_ENTITY: 'Canonical entity ID is absent from the recovery inventory.',
      ELIGIBILITY_CHANGED: 'The same canonical entity is not hard-eligible for the query in both inventories.',
      OTHER_MATERIAL_CHANGE: 'Exact evidence identity cannot be established for another material reason.',
    },
    counts: delta.counts,
    query_pair_classifications: delta.queryPairClassifications,
  };
  const deltaText = `${JSON.stringify(deltaArtifact, null, 2)}\n`;
  const packet = {
    packet_version: packetVersion,
    status: 'HUMAN_DEV_JUDGMENT_REQUIRED',
    created_at: createdAt,
    dataset_manifest: { version: manifestVersion, checksum: manifestChecksum },
    dev_inventory: { version: inventoryVersion, checksum: inventoryChecksum },
    historical_judgment_version: historicalJudgmentVersion,
    carry_forward_permitted: false,
    carry_forward_pair_count: 0,
    fresh_human_review_pair_count: delta.currentEligiblePairCount,
    split: 'DEV',
    dev_queries_total: 60,
    current_dataset_judgments_complete: 0,
    current_dataset_judgments_missing: 60,
    rubric: {
      grades: { '0': 'not relevant', '1': 'marginal', '2': 'relevant', '3': 'highly relevant' },
      hard_constraint_rule: 'Any explicit structured or hard-constraint violation receives grade 0 regardless of textual similarity.',
      conservative_rules: [
        'Do not infer romantic, cozy, cheap, or other subjective attributes without current evidence.',
        'Equivalent EN/SV paired intents require equivalent judgments when their meanings are identical.',
        'Known-item grade 3 requires confirming the current evidence.',
      ],
    },
    pooling_method: 'EXHAUSTIVE_HARD_ELIGIBLE_CURRENT_CANONICAL_INVENTORY; no search results or metrics inspected',
    inventory: recoveryEntities,
    queries,
    held_out_guard: heldOutGuard(),
  };
  const packetText = `${JSON.stringify(packet, null, 2)}\n`;
  const packetMarkdown = renderMarkdown({
    dataset_manifest: packet.dataset_manifest,
    dataset_inventory_checksum: inventoryChecksum,
    current_dataset_judgments_complete: 0,
    current_dataset_judgments_missing: 60,
    inventory: input.metadata.entities,
    queries,
  });

  const inventoryDirectory = resolve(outputRoot, 'evaluation/inventories');
  const reportDirectory = resolve(outputRoot, 'evaluation/reports/final-eval-recovery');
  const judgmentDirectory = resolve(outputRoot, 'evaluation/judgments');
  await Promise.all([
    mkdir(inventoryDirectory, { recursive: true }),
    mkdir(reportDirectory, { recursive: true }),
    mkdir(judgmentDirectory, { recursive: true }),
  ]);
  await Promise.all([
    writeNew(resolve(inventoryDirectory, `${inventoryVersion}.json`), inventoryText),
    writeNew(resolve(inventoryDirectory, `${inventoryVersion}.sha256`), `${sha256(inventoryText)}\n`),
    writeNew(resolve(reportDirectory, `${deltaVersion}.json`), deltaText),
    writeNew(resolve(reportDirectory, `${deltaVersion}.sha256`), `${sha256(deltaText)}\n`),
    writeNew(resolve(judgmentDirectory, `${packetVersion}.json`), packetText),
    writeNew(resolve(judgmentDirectory, `${packetVersion}.md`), packetMarkdown),
    writeNew(resolve(judgmentDirectory, `${packetVersion}.sha256`), `${sha256(packetText)}\n`),
  ]);
  console.log(JSON.stringify({
    remoteState: 'MATCHES_RECOVERY_B',
    manifestVersion,
    manifestChecksum,
    inventoryVersion,
    inventoryChecksum,
    devQueries: 60,
    semanticDevQueries: 16,
    deltaCounts: delta.counts,
    carryForwardPermitted: false,
    carryForwardPairCount: 0,
    freshHumanReviewPairCount: delta.currentEligiblePairCount,
    humanReviewStatus: 'DEV_HUMAN_JUDGMENT_REVIEW_REQUIRED',
    sealedAccessed: false,
    adversarialAccessed: false,
  }));
}

type RecoveryManifest = {
  manifest_version: string;
  status: string;
  source_runs: Array<{ source_key: string; run_id: string; status: string }>;
  boundary: { boundary_version: string; boundary_checksum: string };
  taxonomy: { version: string; active_memberships: number };
  embedding: { provider: string; model: string; revision: string; dimension: number };
  search_documents: { inventory_checksum: string };
  compatible_ready_embeddings: { identity_checksum: string };
  coverage: unknown;
  duplicate_state: Record<string, number>;
  query_corpus: { checksum: string };
};
type HistoricalInventoryEntity = InventoryEntity & {
  currentSourceEvidence?: unknown[];
  currentCanonicalFactProvenance?: unknown[];
};
type HistoricalPacket = {
  dataset_inventory_checksum: string;
  inventory: HistoricalInventoryEntity[];
};
type HistoricalJudgments = {
  judgment_version: string;
  records: Array<{ query_id: string; relevant: Array<{ entity_id: string; grade: number }> }>;
};

function buildRecoveryDelta(input: {
  historicalPacket: HistoricalPacket;
  historicalJudgments: HistoricalJudgments;
  currentEntities: Array<InventoryEntity & {
    currentSourceEvidence: unknown[];
    currentCanonicalFactProvenance: unknown[];
  }>;
  currentQueries: ReturnType<typeof buildReviewQuery>[];
}) {
  const oldEntities = new Map(input.historicalPacket.inventory.map((entity) => [entity.canonicalEntityId, entity]));
  const currentEntities = new Map(input.currentEntities.map((entity) => [entity.canonicalEntityId, entity]));
  const oldPairs = new Set(input.historicalJudgments.records.flatMap((record) => (
    record.relevant.map(({ entity_id: entityId }) => `${record.query_id}|${entityId}`)
  )));
  const currentPairs = new Set(input.currentQueries.flatMap((query) => (
    query.candidatePool.map(({ canonicalEntityId }) => `${query.queryId}|${canonicalEntityId}`)
  )));
  const queryIds = new Set([
    ...input.historicalJudgments.records.map(({ query_id: queryId }) => queryId),
    ...input.currentQueries.map(({ queryId }) => queryId),
  ]);
  const classificationsByQuery = new Map([...queryIds].sort().map((queryId) => (
    [queryId, emptyClassifications()]
  )));
  const counts: Record<DeltaClassification, number> = {
    EXACT_EVIDENCE_IDENTICAL: 0,
    CHANGED_EVIDENCE: 0,
    NEW_ENTITY: 0,
    REMOVED_ENTITY: 0,
    ELIGIBILITY_CHANGED: 0,
    OTHER_MATERIAL_CHANGE: 0,
  };
  for (const key of [...new Set([...oldPairs, ...currentPairs])].sort()) {
    const separator = key.indexOf('|');
    const queryId = key.slice(0, separator);
    const entityId = key.slice(separator + 1);
    const historicalEntity = oldEntities.get(entityId);
    const currentEntity = currentEntities.get(entityId);
    let classification: DeltaClassification;
    if (!historicalEntity && currentEntity) {
      classification = 'NEW_ENTITY';
    } else if (historicalEntity && !currentEntity) {
      classification = 'REMOVED_ENTITY';
    } else if (oldPairs.has(key) !== currentPairs.has(key)) {
      classification = 'ELIGIBILITY_CHANGED';
    } else if (hasExactComparableEvidence(historicalEntity!, currentEntity!)) {
      classification = 'EXACT_EVIDENCE_IDENTICAL';
    } else if (stableJson(stripRecoveryOnlyEvidence(historicalEntity!))
      !== stableJson(stripRecoveryOnlyEvidence(currentEntity!))) {
      classification = 'CHANGED_EVIDENCE';
    } else {
      classification = 'OTHER_MATERIAL_CHANGE';
    }
    counts[classification] += 1;
    const queryClassifications = classificationsByQuery.get(queryId) ?? emptyClassifications();
    queryClassifications[classification].push(entityId);
    classificationsByQuery.set(queryId, queryClassifications);
  }
  const queryPairClassifications = [...classificationsByQuery.entries()].map(([queryId, classifications]) => ({
    queryId,
    classifications: Object.fromEntries(Object.entries(classifications).filter(([, entityIds]) => entityIds.length > 0)),
  }));
  return { counts, queryPairClassifications, currentEligiblePairCount: currentPairs.size };
}

type DeltaClassification = 'EXACT_EVIDENCE_IDENTICAL' | 'CHANGED_EVIDENCE' | 'NEW_ENTITY'
  | 'REMOVED_ENTITY' | 'ELIGIBILITY_CHANGED' | 'OTHER_MATERIAL_CHANGE';

function emptyClassifications(): Record<DeltaClassification, string[]> {
  return {
    EXACT_EVIDENCE_IDENTICAL: [],
    CHANGED_EVIDENCE: [],
    NEW_ENTITY: [],
    REMOVED_ENTITY: [],
    ELIGIBILITY_CHANGED: [],
    OTHER_MATERIAL_CHANGE: [],
  };
}

function hasExactComparableEvidence(historical: HistoricalInventoryEntity, current: HistoricalInventoryEntity): boolean {
  return Array.isArray(historical.currentSourceEvidence)
    && Array.isArray(historical.currentCanonicalFactProvenance)
    && stableJson(historical) === stableJson(current);
}

function stripRecoveryOnlyEvidence(entity: HistoricalInventoryEntity): InventoryEntity {
  const comparable = { ...entity };
  delete comparable.currentSourceEvidence;
  delete comparable.currentCanonicalFactProvenance;
  return comparable;
}

function heldOutGuard() {
  return {
    parsed_splits: ['DEV'],
    sealed_queries_executed: 0,
    adversarial_queries_executed: 0,
    sealed_or_adversarial_judgments_loaded: false,
  };
}

function sha256Lines(lines: string[]): string {
  return sha256(lines.join('\n'));
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
  const title = phase === 'day4-postcoverage'
    ? 'Post-coverage'
    : phase === 'final-eval-recovery' ? 'Final-eval recovery' : 'EVAL-03';
  return `# ${title} full DEV human judgment packet\n\n`
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
