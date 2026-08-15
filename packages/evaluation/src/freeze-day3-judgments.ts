import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import type { EvalCorpusRecordV1, EvalJudgmentSetV1, RelevanceGrade } from './index.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.day3-current.v2.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.day3-current.v2.sha256', root);
const packetUrl = new URL('evaluation/judgments/dev-review-packet.day3.v2.json', root);
const packetChecksumUrl = new URL('evaluation/judgments/dev-review-packet.day3.v2.sha256', root);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const judgmentUrl = new URL('evaluation/judgments/judgments.day3.v1.json', root);
const judgmentChecksumUrl = new URL('evaluation/judgments/judgments.day3.v1.sha256', root);
const judgmentVersion = 'judgments.day3.v1';
const evergreenId = 'ddcca624-5540-47b3-8309-ca771e5e29b7';
const expectedManifestChecksum = '11a1a73e37bd2af71b7948823c6509dfb98edd86c6629834e2fc54d8a2afe4f1';
const expectedInventoryChecksum = 'aab903847c5fcfd840fe3285601d8da44d7596b5b985a2200de4f0a886b2e1fb';

const grade3 = ids(`
eval-v1-dev-broad-concentration-01
eval-v1-dev-taxonomy-parent-leaf-03
eval-v1-dev-taxonomy-parent-leaf-04`);
const grade2 = ids(`
eval-v1-dev-geo-scope-radius-03`);
const grade1 = ids(`
eval-v1-dev-broad-concentration-04
eval-v1-dev-broad-discovery-01
eval-v1-dev-broad-discovery-02
eval-v1-dev-broad-discovery-03
eval-v1-dev-broad-discovery-04
eval-v1-dev-geo-scope-radius-02
eval-v1-dev-semantic-occasion-language-01
eval-v1-dev-semantic-occasion-language-02
eval-v1-dev-semantic-occasion-language-05
eval-v1-dev-semantic-occasion-language-06
eval-v1-dev-semantic-occasion-language-07
eval-v1-dev-semantic-occasion-language-08
eval-v1-dev-semantic-occasion-language-15
eval-v1-dev-semantic-occasion-language-16`);
const grade0 = ids(`
eval-v1-dev-canonical-exact-same-name-01
eval-v1-dev-canonical-exact-same-name-02
eval-v1-dev-canonical-exact-same-name-03
eval-v1-dev-canonical-exact-same-name-04
eval-v1-dev-canonical-exact-same-name-05
eval-v1-dev-prefix-01
eval-v1-dev-prefix-02
eval-v1-dev-prefix-03
eval-v1-dev-prefix-04
eval-v1-dev-typo-transposition-accent-spacing-01
eval-v1-dev-typo-transposition-accent-spacing-02
eval-v1-dev-typo-transposition-accent-spacing-03
eval-v1-dev-typo-transposition-accent-spacing-04
eval-v1-dev-typo-transposition-accent-spacing-05
eval-v1-dev-verified-colliding-aliases-01
eval-v1-dev-verified-colliding-aliases-02
eval-v1-dev-verified-colliding-aliases-03
eval-v1-dev-scarcity-duplicate-state-02
eval-v1-dev-semantic-occasion-language-03
eval-v1-dev-semantic-occasion-language-04
eval-v1-dev-semantic-occasion-language-09
eval-v1-dev-semantic-occasion-language-10
eval-v1-dev-semantic-occasion-language-11
eval-v1-dev-semantic-occasion-language-12`);
const empty = ids(`
eval-v1-dev-broad-concentration-02
eval-v1-dev-broad-concentration-03
eval-v1-dev-event-time-01
eval-v1-dev-event-time-02
eval-v1-dev-event-time-03
eval-v1-dev-event-time-04
eval-v1-dev-event-time-05
eval-v1-dev-event-time-06
eval-v1-dev-geo-scope-radius-01
eval-v1-dev-scarcity-duplicate-state-01
eval-v1-dev-scarcity-duplicate-state-03
eval-v1-dev-semantic-occasion-language-13
eval-v1-dev-semantic-occasion-language-14
eval-v1-dev-taxonomy-parent-leaf-01
eval-v1-dev-taxonomy-parent-leaf-02
eval-v1-dev-taxonomy-parent-leaf-05
eval-v1-dev-taxonomy-parent-leaf-06
eval-v1-dev-taxonomy-parent-leaf-07`);
const targetUnavailable = new Set(ids(`
eval-v1-dev-canonical-exact-same-name-01
eval-v1-dev-canonical-exact-same-name-02
eval-v1-dev-canonical-exact-same-name-03
eval-v1-dev-canonical-exact-same-name-04
eval-v1-dev-canonical-exact-same-name-05
eval-v1-dev-prefix-01
eval-v1-dev-prefix-02
eval-v1-dev-prefix-03
eval-v1-dev-prefix-04
eval-v1-dev-typo-transposition-accent-spacing-01
eval-v1-dev-typo-transposition-accent-spacing-02
eval-v1-dev-typo-transposition-accent-spacing-03
eval-v1-dev-typo-transposition-accent-spacing-04
eval-v1-dev-typo-transposition-accent-spacing-05
eval-v1-dev-verified-colliding-aliases-01
eval-v1-dev-verified-colliding-aliases-02
eval-v1-dev-verified-colliding-aliases-03
eval-v1-dev-scarcity-duplicate-state-02
eval-v1-dev-event-time-06`));
const gradeByQuery = new Map<string, RelevanceGrade>([
  ...grade3.map((queryId) => [queryId, 3] as const),
  ...grade2.map((queryId) => [queryId, 2] as const),
  ...grade1.map((queryId) => [queryId, 1] as const),
  ...grade0.map((queryId) => [queryId, 0] as const),
]);
const emptySet = new Set(empty);

const [manifestText, manifestChecksumText, packetText, packetChecksumText, corpusText, corpusChecksumText] = await Promise.all([
  readFile(manifestUrl, 'utf8'),
  readFile(manifestChecksumUrl, 'utf8'),
  readFile(packetUrl, 'utf8'),
  readFile(packetChecksumUrl, 'utf8'),
  readFile(corpusUrl, 'utf8'),
  readFile(corpusChecksumUrl, 'utf8'),
]);
if (sha256(manifestText) !== expectedManifestChecksum
  || manifestChecksumText.trim() !== expectedManifestChecksum) throw new Error('DAY3_MANIFEST_CHECKSUM_MISMATCH');
if (sha256(packetText) !== packetChecksumText.trim()) throw new Error('DAY3_PACKET_CHECKSUM_MISMATCH');
if (sha256(corpusText) !== corpusChecksumText.trim()) throw new Error('DAY3_CORPUS_CHECKSUM_MISMATCH');
const manifest = JSON.parse(manifestText) as {
  manifest_version: string;
  canonical_dataset_version: string;
  taxonomy: { checksum: string };
  boundary: { version: string };
  corpus: { checksum: string };
  dataset_inventory: { checksum: string };
};
const packet = JSON.parse(packetText) as {
  dataset_manifest: { version: string; checksum: string };
  dataset_inventory_checksum: string;
  inventory: Array<{ canonicalEntityId: string; canonicalName: string }>;
  queries: Array<{
    queryId: string;
    query: string;
    candidatePool: Array<{ canonicalEntityId: string }>;
    targetInventoryEvidence: { statusToConfirm: string };
    hardConstraintExcludedInventory: Array<{ canonicalEntityId: string; reasons: string[] }>;
  }>;
  held_out_guard: Record<string, unknown>;
};
if (manifest.manifest_version !== 'dataset-manifest.day3-current.v2'
  || manifest.dataset_inventory.checksum !== expectedInventoryChecksum
  || packet.dataset_manifest.version !== manifest.manifest_version
  || packet.dataset_manifest.checksum !== expectedManifestChecksum
  || packet.dataset_inventory_checksum !== expectedInventoryChecksum
  || manifest.corpus.checksum !== corpusChecksumText.trim()) throw new Error('DAY3_JUDGMENT_PIN_MISMATCH');
if (packet.inventory.length !== 2
  || !packet.inventory.some(({ canonicalEntityId, canonicalName }) => (
    canonicalEntityId === evergreenId && canonicalName === 'Evergreen Restaurang & Pizzeria'
  ))) throw new Error('DAY3_FROZEN_INVENTORY_MISMATCH');
if (JSON.stringify(packet.held_out_guard) !== JSON.stringify({
  parsed_splits: ['DEV'],
  sealed_queries_executed: 0,
  adversarial_queries_executed: 0,
  sealed_or_adversarial_judgments_loaded: false,
})) throw new Error('DAY3_HELD_OUT_GUARD_MISMATCH');

const corpus = corpusText.split(/\r?\n/)
  .filter((line) => line.includes('"split":"DEV"'))
  .map((line) => JSON.parse(line) as EvalCorpusRecordV1)
  .sort((left, right) => left.query_id.localeCompare(right.query_id));
const judgedAt = new Date().toISOString();
const records = corpus.map((record) => {
  const review = packet.queries.find(({ queryId }) => queryId === record.query_id);
  if (!review || review.query !== record.query) throw new Error(`DAY3_REVIEW_PACKET_MISMATCH:${record.query_id}`);
  const grade = gradeByQuery.get(record.query_id);
  const isEmpty = emptySet.has(record.query_id);
  if ((grade === undefined) === !isEmpty) throw new Error(`DAY3_HUMAN_MAPPING_MISSING:${record.query_id}`);
  if (isEmpty && review.candidatePool.length !== 0) throw new Error(`DAY3_EMPTY_POOL_MISMATCH:${record.query_id}`);
  if (!isEmpty && !review.candidatePool.some(({ canonicalEntityId }) => canonicalEntityId === evergreenId)) {
    throw new Error(`DAY3_EVERGREEN_POOL_MISMATCH:${record.query_id}`);
  }
  const inventoryUnavailable = targetUnavailable.has(record.query_id);
  if (inventoryUnavailable && review.targetInventoryEvidence.statusToConfirm !== 'TARGET_NOT_IN_FROZEN_DATASET') {
    throw new Error(`DAY3_TARGET_STATUS_MISMATCH:${record.query_id}`);
  }
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  const excluded = review.hardConstraintExcludedInventory
    .find(({ canonicalEntityId }) => canonicalEntityId === evergreenId)?.reasons ?? [];
  return {
    judgment_version: judgmentVersion,
    query_id: record.query_id,
    query_text: record.query,
    relevant: isEmpty ? [] : [{ entity_id: evergreenId, grade: grade! }],
    known_item_target: null,
    known_item_inventory_status: inventoryUnavailable ? 'TARGET_NOT_IN_FROZEN_DATASET' as const : 'NOT_APPLICABLE' as const,
    primary_failure_attribution: inventoryUnavailable ? 'INVENTORY' as const : null,
    search_ranking_assessment: inventoryUnavailable ? 'NOT_EVALUATED' as const : 'EVALUATED' as const,
    acceptable_taxonomy_node_ids: typeof taxonomy?.node_id === 'string' ? [taxonomy.node_id] : [],
    acceptable_group_keys: [],
    expected_protected_behavior: [],
    expected_ineligible_behavior: inventoryUnavailable
      ? ['TARGET_NOT_IN_FROZEN_DATASET', 'PRODUCT_OUTCOME:QUERY_UNSATISFIED', 'PRIMARY_FAILURE:INVENTORY', 'SEARCH_RANKING:NOT_EVALUATED']
      : isEmpty ? ['NO_HARD_ELIGIBLE_CANDIDATE', ...excluded.map((reason) => `EVERGREEN:${reason}`)] : [],
    rationale: rationaleFor(grade, isEmpty, inventoryUnavailable),
    judged_by: 'engineer-approved',
    judged_at: judgedAt,
    dataset_version: manifest.canonical_dataset_version,
    taxonomy_checksum: manifest.taxonomy.checksum,
    boundary_version: manifest.boundary.version,
  };
});
const queryCounts = [0, 1, 2, 3].map((grade) => records.filter((record) => (
  record.relevant.length === 1 && record.relevant[0]!.grade === grade
)).length);
const emptyCount = records.filter(({ relevant }) => relevant.length === 0).length;
const unavailable = records.filter(({ known_item_inventory_status: status }) => status === 'TARGET_NOT_IN_FROZEN_DATASET');
if (records.length !== 60 || queryCounts.join(',') !== '24,14,1,3' || emptyCount !== 18
  || unavailable.length !== 19 || unavailable.some((record) => (
    record.known_item_target !== null
    || record.primary_failure_attribution !== 'INVENTORY'
    || record.search_ranking_assessment !== 'NOT_EVALUATED'
  ))) throw new Error('HUMAN_JUDGMENT_MAPPING_VALIDATION_FAILED');
if (new Set(records.map(({ query_id: queryId }) => queryId)).size !== 60
  || new Set([...gradeByQuery.keys(), ...emptySet]).size !== 60) {
  throw new Error('HUMAN_JUDGMENT_MAPPING_VALIDATION_FAILED');
}
const judgments: EvalJudgmentSetV1 = {
  judgment_version: judgmentVersion,
  status: 'FROZEN',
  split: 'DEV',
  corpus_version: 'corpus.v1',
  corpus_checksum: corpusChecksumText.trim(),
  dataset_version: manifest.canonical_dataset_version,
  dataset_manifest_version: manifest.manifest_version,
  dataset_manifest_checksum: expectedManifestChecksum,
  dataset_inventory_checksum: expectedInventoryChecksum,
  selected_query_ids: records.map(({ query_id: queryId }) => queryId),
  taxonomy_checksum: manifest.taxonomy.checksum,
  boundary_version: manifest.boundary.version,
  hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY',
  approval: { authority: 'ENGINEER', provenance: 'HUMAN_APPROVED_EVAL_03_TASK_PROMPT' },
  records,
};
const judgmentText = `${JSON.stringify(judgments, null, 2)}\n`;
await Promise.all([
  writeFile(judgmentUrl, judgmentText, { flag: 'wx' }),
  writeFile(judgmentChecksumUrl, `${sha256(judgmentText)}\n`, { flag: 'wx' }),
]);
console.log(JSON.stringify({
  judgmentVersion,
  checksum: sha256(judgmentText),
  reviewed: records.length,
  grade3: queryCounts[3],
  grade2: queryCounts[2],
  grade1: queryCounts[1],
  grade0: queryCounts[0],
  empty: emptyCount,
  targetNotInFrozenDataset: unavailable.length,
}));

function rationaleFor(grade: RelevanceGrade | undefined, isEmpty: boolean, inventoryUnavailable: boolean): string {
  if (isEmpty) return 'Human reviewed: no hard-eligible candidate exists in the frozen v2 inventory.';
  if (inventoryUnavailable) return 'Human confirmed the stable named target is absent; Evergreen is not the target.';
  if (grade === 3) return 'Evergreen is factually a restaurant/dining entity and directly satisfies the request.';
  if (grade === 2) return 'Direct restaurant-category match; proximity is not fully established without an explicit request coordinate.';
  if (grade === 1) return 'Evergreen is a plausible general going-out/social venue; subjective requested attributes are not established by frozen evidence.';
  return 'Human determined Evergreen is not relevant; the requested facts are not established by frozen evidence.';
}

function ids(value: string): string[] {
  return value.trim().split(/\s+/);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
