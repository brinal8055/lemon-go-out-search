import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const checksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const taxonomyUrl = new URL('reference/taxonomy/active-going-out.v1.yaml', root);
const judgmentUrl = new URL('evaluation/judgments/dev/judgments.v1.json', root);
const judgmentChecksumUrl = new URL('evaluation/judgments/dev/checksum.v1.txt', root);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.v1.template.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/checksum.v1.txt', root);

export const frozenAllocation = {
  canonical_exact_same_name: { DEV: 5, SEALED: 3, ADVERSARIAL: 1 },
  verified_colliding_aliases: { DEV: 3, SEALED: 2, ADVERSARIAL: 1 },
  prefix: { DEV: 4, SEALED: 2, ADVERSARIAL: 1 },
  typo_transposition_accent_spacing: { DEV: 5, SEALED: 2, ADVERSARIAL: 2 },
  taxonomy_parent_leaf: { DEV: 7, SEALED: 3, ADVERSARIAL: 2 },
  broad_discovery: { DEV: 4, SEALED: 2, ADVERSARIAL: 2 },
  semantic_occasion_language: { DEV: 16, SEALED: 8, ADVERSARIAL: 6 },
  event_time: { DEV: 6, SEALED: 3, ADVERSARIAL: 2 },
  geo_scope_radius: { DEV: 3, SEALED: 2, ADVERSARIAL: 1 },
  scarcity_duplicate_state: { DEV: 3, SEALED: 2, ADVERSARIAL: 1 },
  broad_concentration: { DEV: 4, SEALED: 1, ADVERSARIAL: 1 },
};

export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function parseJsonLines(text) {
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readCorpus() {
  const [text, expectedChecksum] = await Promise.all([
    readFile(corpusUrl, 'utf8'),
    readFile(checksumUrl, 'utf8'),
  ]);
  return { text, records: parseJsonLines(text), expectedChecksum: expectedChecksum.trim() };
}

export async function validateCorpus() {
  const [{ text, records, expectedChecksum }, taxonomyText] = await Promise.all([
    readCorpus(),
    readFile(taxonomyUrl, 'utf8'),
  ]);
  const taxonomy = JSON.parse(taxonomyText);
  const taxonomyIds = new Map(taxonomy.nodes.map((node) => [node.slug, node.id]));
  const validSplits = new Set(['DEV', 'SEALED', 'ADVERSARIAL']);
  const validLanguages = new Set(['en', 'sv', 'mixed', 'language-neutral']);
  const ids = new Set();
  const pairGroups = new Map();
  const allowedFilterKeys = new Set(['taxonomy', 'location', 'entity_types', 'time_expression']);

  assert(sha256(text) === expectedChecksum, 'corpus checksum mismatch');
  assert(records.length === 110, 'corpus must contain exactly 110 records');

  for (const record of records) {
    assert(typeof record.query_id === 'string' && !ids.has(record.query_id), `duplicate or missing query_id: ${record.query_id}`);
    ids.add(record.query_id);
    assert(record.corpus_version === 'corpus.v1', `${record.query_id}: invalid corpus version`);
    assert(typeof record.query === 'string' && record.query.trim() !== '', `${record.query_id}: empty query`);
    assert(Object.hasOwn(frozenAllocation, record.family), `${record.query_id}: unknown family`);
    assert(validSplits.has(record.split), `${record.query_id}: invalid split`);
    assert(validLanguages.has(record.language), `${record.query_id}: invalid language`);
    assert(record.ui_locale === 'en' || record.ui_locale === 'sv', `${record.query_id}: invalid UI locale`);
    assert(Array.isArray(record.hard_constraints) && record.hard_constraints.length > 0, `${record.query_id}: missing hard constraints`);
    assert(Array.isArray(record.intended_assertions) && record.intended_assertions.length > 0, `${record.query_id}: missing assertions`);
    assert(record.scope?.scope_id === 'a4b19b09-b272-5748-80ef-2c91d9d33ca6', `${record.query_id}: wrong scope`);
    assert(Object.keys(record.request_filters).every((key) => allowedFilterKeys.has(key)), `${record.query_id}: unknown request filter`);
    if (record.request_filters?.taxonomy) {
      assert(taxonomyIds.get(record.request_filters.taxonomy.slug) === record.request_filters.taxonomy.node_id, `${record.query_id}: taxonomy reference is not active v1`);
    }
    if (record.family === 'event_time' || record.request_filters?.time_expression) {
      assert(typeof record.evaluation_clock_utc === 'string', `${record.query_id}: time-sensitive query lacks frozen clock`);
    }
    if (record.request_filters?.location) {
      const { latitude, longitude, radius_meters: radius } = record.request_filters.location;
      assert(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && Number.isInteger(radius) && radius > 0, `${record.query_id}: invalid location filter`);
    }
    if (record.request_filters?.entity_types) {
      assert(record.request_filters.entity_types.length > 0 && record.request_filters.entity_types.every((type) => type === 'PLACE' || type === 'EVENT'), `${record.query_id}: invalid entity-type filter`);
    }
    if (record.pair_group_id !== null) {
      assert(/^(sem|event)-(dev|sealed)-[a-z0-9-]+$/.test(record.pair_group_id), `${record.query_id}: invalid pair group`);
      const members = pairGroups.get(record.pair_group_id) ?? [];
      members.push(record);
      pairGroups.set(record.pair_group_id, members);
    }
  }

  for (const [family, allocation] of Object.entries(frozenAllocation)) {
    for (const [split, expected] of Object.entries(allocation)) {
      const actual = records.filter((record) => record.family === family && record.split === split).length;
      assert(actual === expected, `${family}/${split}: expected ${expected}, got ${actual}`);
    }
  }
  for (const [split, expected] of Object.entries({ DEV: 60, SEALED: 30, ADVERSARIAL: 20 })) {
    assert(records.filter((record) => record.split === split).length === expected, `${split}: wrong total`);
  }
  for (const [pairId, members] of pairGroups) {
    assert(members.length === 2, `${pairId}: pair must contain exactly two members`);
    assert(new Set(members.map((member) => member.split)).size === 1, `${pairId}: pair crosses splits`);
    assert(new Set(members.map((member) => member.language)).size === 2 && members.some((member) => member.language === 'en') && members.some((member) => member.language === 'sv'), `${pairId}: pair must be EN/SV`);
  }
  const semanticPairGroups = [...pairGroups.values()].filter((members) => members.every((member) => member.family === 'semantic_occasion_language'));
  assert(semanticPairGroups.length === 12, 'semantic corpus must contain exactly 12 EN/SV pair groups');
  const adversarialSemantic = records.filter((record) => record.family === 'semantic_occasion_language' && record.split === 'ADVERSARIAL');
  assert(adversarialSemantic.length === 6 && adversarialSemantic.every((record) => record.language === 'mixed'), 'adversarial semantic allocation must be six mixed-language queries');
  return { records, checksum: expectedChecksum, pairGroupCount: semanticPairGroups.length };
}

export function validateJudgmentSet(judgments) {
  assert(judgments.judgment_version && judgments.corpus_version === 'corpus.v1', 'invalid judgment identity');
  assert(['SCAFFOLD_UNBOUND', 'FROZEN'].includes(judgments.status), 'invalid judgment status');
  assert(['DEV', 'SEALED', 'ADVERSARIAL'].includes(judgments.split), 'invalid judgment split');
  assert(/^[0-9a-f]{64}$/.test(judgments.corpus_checksum), 'invalid judgment corpus checksum');
  assert(judgments.hard_constraint_policy === 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY', 'invalid hard-constraint judgment policy');
  assert(Array.isArray(judgments.records), 'judgment records must be an array');
  if (judgments.status === 'FROZEN') assert(typeof judgments.dataset_version === 'string' && judgments.dataset_version.length > 0, 'frozen judgments require a dataset version');
  for (const record of judgments.records) {
    assert(record.relevant.every(({ grade }) => [0, 1, 2, 3].includes(grade)), 'invalid relevance grade');
    assert(new Set(record.relevant.map(({ entity_id }) => entity_id)).size === record.relevant.length,
      'duplicate entity judgment');
  }
  if (judgments.judgment_version === 'judgments.day2.v1') {
    const grades = judgments.records.flatMap(({ relevant }) => relevant.map(({ grade }) => grade));
    const counts = [0, 1, 2, 3].map((grade) => grades.filter((value) => value === grade).length);
    assert(judgments.records.length === 14 && grades.length === 84, 'Day-2 judgments require 14 queries and 84 grades');
    assert(counts.join(',') === '60,15,6,3', 'Day-2 judgment grade distribution mismatch');
    assert(judgments.selected_query_ids?.join(',') === judgments.records.map(({ query_id }) => query_id).join(','),
      'Day-2 selected query IDs mismatch');
    assert(/^[0-9a-f]{64}$/.test(judgments.dataset_manifest_checksum), 'invalid Day-2 manifest checksum pin');
    assert(/^[0-9a-f]{64}$/.test(judgments.dataset_inventory_checksum), 'invalid Day-2 inventory checksum pin');
    const inventoryUnavailable = judgments.records.filter(
      ({ known_item_inventory_status }) => known_item_inventory_status === 'TARGET_NOT_IN_FROZEN_DATASET',
    );
    assert(inventoryUnavailable.length === 6, 'Day-2 inventory-unavailable query count mismatch');
    assert(inventoryUnavailable.every((record) => record.known_item_target === null
      && record.primary_failure_attribution === 'INVENTORY'
      && record.search_ranking_assessment === 'NOT_EVALUATED'),
    'invalid Day-2 inventory-unavailable treatment');
  }
  return judgments;
}

export function validateDatasetManifest(manifest) {
  assert(manifest.manifest_version && ['SCAFFOLD_UNBOUND', 'FROZEN'].includes(manifest.status), 'invalid manifest identity');
  assert(/^[0-9a-f]{64}$/.test(manifest.boundary?.checksum), 'invalid boundary checksum');
  assert(/^[0-9a-f]{64}$/.test(manifest.taxonomy?.checksum), 'invalid taxonomy checksum');
  assert(manifest.corpus?.version === 'corpus.v1' && /^[0-9a-f]{64}$/.test(manifest.corpus?.checksum), 'invalid corpus pin');
  if (manifest.status === 'FROZEN') {
    for (const key of ['canonical_dataset_version', 'normalization_version', 'search_config_version', 'code_git_commit']) {
      assert(typeof manifest[key] === 'string' && manifest[key].length > 0, `frozen manifest requires ${key}`);
    }
    const judgmentPendingReview = manifest.manifest_version === 'dataset-manifest.day2.v1'
      && manifest.judgment.version === null
      && manifest.judgment.checksum === null
      && /^[0-9a-f]{64}$/.test(manifest.dataset_inventory?.checksum)
      && manifest.capabilities?.event === 'NOT_IMPLEMENTED'
      && manifest.capabilities?.semantic === 'NOT_IMPLEMENTED';
    assert(judgmentPendingReview || (manifest.judgment.version && manifest.judgment.checksum),
      'frozen manifest requires judgment pin or explicit Day-2 human-review freeze');
    assert(manifest.source_record_ingestion_run_ids.length > 0, 'frozen manifest requires ingestion runs');
    assert(manifest.search_documents.template_version && manifest.search_documents.document_version && manifest.search_documents.hashes.length > 0, 'frozen manifest requires SearchDocument pins');
    const embeddingValues = [manifest.embedding.provider, manifest.embedding.model, manifest.embedding.revision, manifest.embedding.dimension];
    assert(embeddingValues.every((value) => value === null) || embeddingValues.every((value) => value !== null), 'frozen manifest embedding contract must be entirely absent or complete');
  }
  return manifest;
}

export async function loadTuningJudgments(split = 'DEV') {
  if (split !== 'DEV') throw new Error(`tuning judgment access denied for split: ${split}`);
  return validateJudgmentSet(JSON.parse(await readFile(judgmentUrl, 'utf8')));
}

export async function validateScaffolds() {
  const [judgments, judgmentText, judgmentChecksum, manifestText, manifestChecksum] = await Promise.all([
    loadTuningJudgments('DEV'),
    readFile(judgmentUrl, 'utf8'),
    readFile(judgmentChecksumUrl, 'utf8'),
    readFile(manifestUrl, 'utf8'),
    readFile(manifestChecksumUrl, 'utf8'),
  ]);
  assert(sha256(judgmentText) === judgmentChecksum.trim(), 'judgment scaffold checksum mismatch');
  assert(sha256(manifestText) === manifestChecksum.trim(), 'manifest scaffold checksum mismatch');
  const manifest = JSON.parse(manifestText);
  assert(judgments.corpus_checksum === manifest.corpus.checksum, 'judgment and manifest corpus pins differ');
  assert(manifest.corpus.checksum === (await readFile(checksumUrl, 'utf8')).trim(), 'manifest corpus pin is stale');
  validateDatasetManifest(manifest);
  return { judgments, manifest };
}
