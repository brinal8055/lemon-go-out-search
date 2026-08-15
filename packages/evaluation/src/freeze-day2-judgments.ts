import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import type { EvalJudgmentSetV1, RelevanceGrade } from './index.ts';
import {
  DAY2_SELECTED_QUERY_IDS,
  loadSelectedDevQueries,
  type Day2ReviewPacketV11,
} from './day2-review-packet.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.day2.v1.sha256', root);
const packetUrl = new URL('evaluation/judgments/day2-review-packet.v1.1.json', root);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const judgmentUrl = new URL('evaluation/judgments/judgments.day2.v1.json', root);
const judgmentChecksumUrl = new URL('evaluation/judgments/judgments.day2.v1.sha256', root);
const judgmentVersion = 'judgments.day2.v1';
const entityOrder = [
  '17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6',
  '2e3c76fe-4b69-4070-86fb-e8d85f248f30',
  '87c64b6e-80ee-497e-ab0a-fb04079b396f',
  '911ac4cb-a19c-490d-beef-0062cd7fdb1a',
  'a1e519ee-93e3-429c-b51b-44d7986f9d22',
  'bf462ec4-f4b5-4781-a559-e9f260ee756c',
] as const;
const approvedGrades: Record<(typeof DAY2_SELECTED_QUERY_IDS)[number], RelevanceGrade[]> = {
  'eval-v1-dev-canonical-exact-same-name-01': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-canonical-exact-same-name-04': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-verified-colliding-aliases-02': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-prefix-04': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-typo-transposition-accent-spacing-03': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-typo-transposition-accent-spacing-04': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-taxonomy-parent-leaf-01': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-taxonomy-parent-leaf-04': [3, 3, 0, 0, 0, 3],
  'eval-v1-dev-taxonomy-parent-leaf-07': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-broad-discovery-01': [1, 1, 2, 2, 2, 1],
  'eval-v1-dev-broad-discovery-02': [1, 1, 2, 2, 2, 1],
  'eval-v1-dev-geo-scope-radius-02': [1, 1, 0, 0, 0, 1],
  'eval-v1-dev-scarcity-duplicate-state-01': [0, 0, 0, 0, 0, 0],
  'eval-v1-dev-broad-concentration-04': [1, 1, 1, 1, 1, 1],
};

const [manifestText, manifestChecksum, packetText, corpusText, corpusChecksum] = await Promise.all([
  readFile(manifestUrl, 'utf8'),
  readFile(manifestChecksumUrl, 'utf8'),
  readFile(packetUrl, 'utf8'),
  readFile(corpusUrl, 'utf8'),
  readFile(corpusChecksumUrl, 'utf8'),
]);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
if (hash(manifestText) !== manifestChecksum.trim()) throw new Error('DAY2_MANIFEST_CHECKSUM_MISMATCH');
const manifest = JSON.parse(manifestText);
const packet = JSON.parse(packetText) as Day2ReviewPacketV11;
const corpus = await loadSelectedDevQueries(corpusText);
if (packet.datasetManifestChecksum !== manifestChecksum.trim()
  || packet.datasetInventoryChecksum !== manifest.dataset_inventory.checksum
  || corpusChecksum.trim() !== manifest.corpus.checksum) throw new Error('DAY2_JUDGMENT_PIN_MISMATCH');
if (packet.queries.map(({ queryId }) => queryId).join('\n') !== DAY2_SELECTED_QUERY_IDS.join('\n')) {
  throw new Error('DAY2_JUDGMENT_QUERY_SELECTION_MISMATCH');
}
const judgedAt = new Date().toISOString();
const records = corpus.map((record) => {
  const review = packet.queries.find(({ queryId }) => queryId === record.query_id);
  if (!review || review.query !== record.query || review.entityReviewRows.length !== 6) {
    throw new Error(`DAY2_REVIEW_PACKET_MISMATCH:${record.query_id}`);
  }
  const rowByEntity = new Map(review.entityReviewRows.map((row) => [row.canonicalEntityId, row]));
  const grades = approvedGrades[record.query_id as keyof typeof approvedGrades];
  const relevant = entityOrder.map((entityId, index) => {
    const row = rowByEntity.get(entityId);
    const grade = grades[index];
    if (!row || grade === undefined) throw new Error(`DAY2_ENTITY_GRADE_MISSING:${record.query_id}:${entityId}`);
    const explicitFailure = row.hardFilterEvidence.some(({ filter, status }) => (
      ['taxonomy', 'radius', 'entity_type'].includes(filter) && status === 'FAIL'
    ));
    if (explicitFailure && grade !== 0) throw new Error(`DAY2_HARD_FILTER_GRADE_MISMATCH:${record.query_id}:${entityId}`);
    return { entity_id: entityId, grade };
  });
  const targetUnavailable = review.targetInventoryStatus === 'TARGET_NOT_IN_FROZEN_DATASET';
  if (targetUnavailable && review.primaryTargetFailureAttribution !== 'INVENTORY') {
    throw new Error(`DAY2_INVENTORY_ATTRIBUTION_MISMATCH:${record.query_id}`);
  }
  const taxonomy = record.request_filters.taxonomy as { node_id?: unknown } | undefined;
  return {
    judgment_version: judgmentVersion,
    query_id: record.query_id,
    query_text: record.query,
    relevant,
    known_item_target: null,
    known_item_inventory_status: review.targetInventoryStatus,
    primary_failure_attribution: targetUnavailable ? 'INVENTORY' as const : null,
    search_ranking_assessment: targetUnavailable ? 'NOT_EVALUATED' as const : 'EVALUATED' as const,
    acceptable_taxonomy_node_ids: typeof taxonomy?.node_id === 'string' ? [taxonomy.node_id] : [],
    acceptable_group_keys: [],
    expected_protected_behavior: [],
    expected_ineligible_behavior: targetUnavailable
      ? ['TARGET_NOT_IN_FROZEN_DATASET', 'PRIMARY_FAILURE:INVENTORY', 'SEARCH_RANKING:NOT_EVALUATED']
      : [],
    rationale: 'Human-approved grades supplied in the EVAL-02 task prompt.',
    judged_by: 'engineer-approved',
    judged_at: judgedAt,
    dataset_version: manifest.canonical_dataset_version,
    taxonomy_checksum: manifest.taxonomy.checksum,
    boundary_version: manifest.boundary.version,
  };
});
const allGrades = records.flatMap(({ relevant }) => relevant.map(({ grade }) => grade));
const counts = [0, 1, 2, 3].map((grade) => allGrades.filter((value) => value === grade).length);
if (records.length !== 14 || allGrades.length !== 84 || counts.join(',') !== '60,15,6,3') {
  throw new Error(`DAY2_GRADE_COUNTS_INVALID:${counts.join(',')}`);
}
if (records.filter(({ known_item_inventory_status: status }) => status === 'TARGET_NOT_IN_FROZEN_DATASET').length !== 6) {
  throw new Error('DAY2_INVENTORY_UNAVAILABLE_COUNT_INVALID');
}
const judgments: EvalJudgmentSetV1 = {
  judgment_version: judgmentVersion,
  status: 'FROZEN',
  split: 'DEV',
  corpus_version: 'corpus.v1',
  corpus_checksum: corpusChecksum.trim(),
  dataset_version: manifest.canonical_dataset_version,
  dataset_manifest_version: manifest.manifest_version,
  dataset_manifest_checksum: manifestChecksum.trim(),
  dataset_inventory_checksum: manifest.dataset_inventory.checksum,
  selected_query_ids: [...DAY2_SELECTED_QUERY_IDS],
  taxonomy_checksum: manifest.taxonomy.checksum,
  boundary_version: manifest.boundary.version,
  hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY',
  approval: { authority: 'ENGINEER', provenance: 'HUMAN_APPROVED_EVAL_02_TASK_PROMPT' },
  records,
};
const judgmentText = `${JSON.stringify(judgments, null, 2)}\n`;
await Promise.all([
  writeFile(judgmentUrl, judgmentText, { flag: 'wx' }),
  writeFile(judgmentChecksumUrl, `${hash(judgmentText)}\n`, { flag: 'wx' }),
]);
console.log(JSON.stringify({
  judgmentVersion,
  checksum: hash(judgmentText),
  queries: records.length,
  grades: allGrades.length,
  counts,
  inventoryUnavailable: 6,
}));
