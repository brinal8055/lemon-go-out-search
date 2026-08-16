import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import type { EvalJudgmentSetV1, RelevanceGrade } from './index.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json.sha256', root);
const inventoryUrl = new URL('evaluation/inventories/dev-inventory.final-eval-recovery.v1.json', root);
const inventoryChecksumUrl = new URL('evaluation/inventories/dev-inventory.final-eval-recovery.v1.sha256', root);
const packetUrl = new URL('evaluation/judgments/dev-review-packet.final-eval-recovery.v1.json', root);
const packetChecksumUrl = new URL('evaluation/judgments/dev-review-packet.final-eval-recovery.v1.sha256', root);
const proposalUrl = new URL('evaluation/judgments/human-judgment-proposal.final-eval-recovery.v2.json', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const judgmentUrl = new URL('evaluation/judgments/judgments.final-eval-recovery.v1.json', root);
const judgmentChecksumUrl = new URL('evaluation/judgments/judgments.final-eval-recovery.v1.sha256', root);
const reportUrl = new URL('evaluation/reports/final-eval-recovery/dev-judgment-freeze.v1.md', root);

const judgmentVersion = 'judgments.final-eval-recovery.v1';
const expectedProposalChecksum = 'c613ffa40663e53b8a54cafef0de9d5b2bd95e0ed2277fdb65d6f22b594daae5';
const expectedManifestChecksum = 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82';
const expectedInventoryChecksum = '2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37';
const expectedCorpusChecksum = 'bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c';
const expectedGrades = { 0: 10_397, 1: 3_243, 2: 1_341, 3: 754 };

type HeldOutGuard = {
  parsed_splits?: string[];
  SEALED?: string;
  ADVERSARIAL?: string;
  sealed_queries_executed?: number;
  adversarial_queries_executed?: number;
  sealed_or_adversarial_judgments_loaded?: boolean;
};
type Candidate = { canonicalEntityId: string; grade: null };
type Excluded = { canonicalEntityId: string };
type TargetDecision = {
  status: 'TARGET_MATCHED' | 'TARGET_SET_MATCHED' | 'TARGET_NOT_IN_FROZEN_DATASET' | 'TARGET_VENUE_MATCHED_BUT_NO_ELIGIBLE_EVENT';
  matchedEntityIds: string[];
  additionalHighlyRelevantEntityIds?: string[];
};
type PacketQuery = {
  queryId: string;
  query: string;
  language: string;
  family: string;
  pairGroupId: string | null;
  structuredFilters: { taxonomy?: { node_id?: unknown } };
  candidatePool: Candidate[];
  hardConstraintExcludedInventory: Excluded[];
};
type Packet = {
  packet_version: string;
  status: string;
  split: string;
  dev_queries_total: number;
  current_dataset_judgments_complete: number;
  current_dataset_judgments_missing: number;
  dataset_manifest: { version: string; checksum: string };
  dev_inventory: { version: string; checksum: string };
  held_out_guard: HeldOutGuard;
  queries: PacketQuery[];
};
type ProposalQuery = {
  queryId: string;
  query: string;
  language: string;
  family: string;
  candidateCount: number;
  gradeDistribution: Record<string, number>;
  targetDecision: TargetDecision | null;
  rationale: string;
  grades: Array<{ entityId: string; grade: number }>;
};
type Proposal = {
  proposal_version: string;
  status: string;
  dataset_manifest: { version: string; checksum: string };
  dev_inventory: { version: string; checksum: string };
  dev_queries: number;
  held_out_guard: HeldOutGuard;
  source_packet: string;
  source_packet_sha256: string;
  rubric: Record<string, unknown>;
  queries: ProposalQuery[];
  aggregate_candidate_grade_counts: Record<string, number>;
};
type Manifest = {
  manifest_version: string;
  status: string;
  canonical_dataset_version: string;
  taxonomy: { checksum: string };
  boundary: { boundary_version: string };
  query_corpus: { checksum: string };
};
type Inventory = {
  inventory_version: string;
  status: string;
  inventory_checksum: string;
  dataset_manifest: { version: string; checksum: string };
  query_corpus: { version: string; checksum: string; dev_query_count: number; semantic_dev_query_count: number };
  entities: Array<{ canonicalEntityId: string }>;
};

const [manifestText, manifestChecksumText, inventoryText, inventoryChecksumText, packetText, packetChecksumText, proposalText, corpusChecksumText] = await Promise.all([
  readFile(manifestUrl, 'utf8'), readFile(manifestChecksumUrl, 'utf8'), readFile(inventoryUrl, 'utf8'),
  readFile(inventoryChecksumUrl, 'utf8'), readFile(packetUrl, 'utf8'), readFile(packetChecksumUrl, 'utf8'),
  readFile(proposalUrl, 'utf8'), readFile(corpusChecksumUrl, 'utf8'),
]);

const manifest = JSON.parse(manifestText) as Manifest;
const inventory = JSON.parse(inventoryText) as Inventory;
const packet = JSON.parse(packetText) as Packet;
const proposal = JSON.parse(proposalText) as Proposal;
const manifestChecksum = checksumValue(manifestChecksumText);
const inventoryFileChecksum = checksumValue(inventoryChecksumText);
const packetChecksum = checksumValue(packetChecksumText);
const corpusChecksum = checksumValue(corpusChecksumText);
const fail = (code: string): never => { throw new Error(code); };
const assert = (condition: unknown, code: string): void => { if (!condition) fail(code); };

assert(sha256(proposalText) === expectedProposalChecksum, 'APPROVED_JUDGMENT_PROPOSAL_CHECKSUM_MISMATCH');
assert(sha256(manifestText) === manifestChecksum && manifestChecksum === expectedManifestChecksum,
  'RECOVERY_MANIFEST_MISMATCH');
assert(sha256(inventoryText) === inventoryFileChecksum && inventory.inventory_checksum === expectedInventoryChecksum,
  'DEV_INVENTORY_MISMATCH');
assert(sha256(packetText) === packetChecksum, 'DEV_INVENTORY_MISMATCH');
assert(corpusChecksum === expectedCorpusChecksum && manifest.query_corpus.checksum === expectedCorpusChecksum
  && inventory.query_corpus.checksum === expectedCorpusChecksum, 'RECOVERY_MANIFEST_MISMATCH');

assert(manifest.manifest_version === 'dataset-manifest.final-eval-recovery.v1'
  && manifest.status === 'FROZEN_PRE_JUDGMENT', 'RECOVERY_MANIFEST_MISMATCH');
assert(inventory.inventory_version === 'dev-inventory.final-eval-recovery.v1'
  && inventory.status === 'FROZEN_FOR_HUMAN_REVIEW'
  && inventory.dataset_manifest.version === manifest.manifest_version
  && inventory.dataset_manifest.checksum === expectedManifestChecksum
  && inventory.query_corpus.version === 'corpus.v1'
  && inventory.query_corpus.dev_query_count === 60
  && inventory.query_corpus.semantic_dev_query_count === 16, 'DEV_INVENTORY_MISMATCH');
assert(packet.packet_version === 'dev-review-packet.final-eval-recovery.v1'
  && packet.status === 'HUMAN_DEV_JUDGMENT_REQUIRED'
  && packet.split === 'DEV'
  && packet.dev_queries_total === 60
  && packet.current_dataset_judgments_complete === 0
  && packet.current_dataset_judgments_missing === 60
  && packet.dataset_manifest.version === manifest.manifest_version
  && packet.dataset_manifest.checksum === expectedManifestChecksum
  && packet.dev_inventory.version === inventory.inventory_version
  && packet.dev_inventory.checksum === expectedInventoryChecksum, 'DEV_INVENTORY_MISMATCH');
assert(proposal.proposal_version === 'human-judgment-proposal.final-eval-recovery.v2'
  && proposal.status === 'PENDING_ENGINEER_APPROVAL'
  && proposal.dataset_manifest.version === manifest.manifest_version
  && proposal.dataset_manifest.checksum === expectedManifestChecksum
  && proposal.dev_inventory.version === inventory.inventory_version
  && proposal.dev_inventory.checksum === expectedInventoryChecksum
  && proposal.dev_queries === 60
  && proposal.source_packet === packet.packet_version
  && proposal.source_packet_sha256 === packetChecksum
  && proposal.queries.length === 60, 'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
for (const guard of [packet.held_out_guard, proposal.held_out_guard]) {
  assert(guard.parsed_splits?.join(',') === 'DEV' || (guard.SEALED === 'NOT_LOADED_OR_ACCESSED'
    && guard.ADVERSARIAL === 'NOT_LOADED_OR_ACCESSED'), 'HELD_OUT_ACCESS_VIOLATION');
  assert(guard.sealed_queries_executed === undefined || guard.sealed_queries_executed === 0, 'HELD_OUT_ACCESS_VIOLATION');
  assert(guard.adversarial_queries_executed === undefined || guard.adversarial_queries_executed === 0, 'HELD_OUT_ACCESS_VIOLATION');
  assert(guard.sealed_or_adversarial_judgments_loaded === undefined || !guard.sealed_or_adversarial_judgments_loaded,
    'HELD_OUT_ACCESS_VIOLATION');
}

const packetById = uniqueMap(packet.queries, ({ queryId }) => queryId, 'JUDGMENT_PAIR_COUNT_MISMATCH');
const proposalById = uniqueMap(proposal.queries, ({ queryId }) => queryId, 'JUDGMENT_PAIR_COUNT_MISMATCH');
assert(packetById.size === 60 && proposalById.size === 60 && sameStrings([...packetById.keys()], [...proposalById.keys()]),
  'MISSING_QUERY_JUDGMENTS');
const inventoryIds = new Set(inventory.entities.map(({ canonicalEntityId }) => canonicalEntityId));
assert(inventoryIds.size === inventory.entities.length, 'DEV_INVENTORY_MISMATCH');
const totals = { 0: 0, 1: 0, 2: 0, 3: 0 };

for (const packetQuery of packet.queries) {
  const proposalQuery = proposalById.get(packetQuery.queryId)!;
  assert(proposalQuery.query === packetQuery.query && proposalQuery.language === packetQuery.language
    && proposalQuery.family === packetQuery.family && proposalQuery.candidateCount === packetQuery.candidatePool.length,
  'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
  const candidateIds = packetQuery.candidatePool.map(({ canonicalEntityId }) => canonicalEntityId);
  const pool = new Set(candidateIds);
  const excluded = new Set(packetQuery.hardConstraintExcludedInventory.map(({ canonicalEntityId }) => canonicalEntityId));
  assert(pool.size === candidateIds.length && [...pool].every((id) => inventoryIds.has(id) && !excluded.has(id))
    && [...excluded].every((id) => inventoryIds.has(id)), 'UNKNOWN_ENTITY_ID');
  const gradeIds = proposalQuery.grades.map(({ entityId }) => entityId);
  assert(new Set(gradeIds).size === gradeIds.length && sameStrings(gradeIds, [...pool]), 'JUDGMENT_PAIR_COUNT_MISMATCH');
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const { entityId, grade } of proposalQuery.grades) {
    assert(pool.has(entityId) && Number.isInteger(grade) && grade >= 0 && grade <= 3, 'UNKNOWN_ENTITY_ID');
    distribution[grade as RelevanceGrade] += 1;
    totals[grade as RelevanceGrade] += 1;
  }
  assert([0, 1, 2, 3].every((grade) => distribution[grade as RelevanceGrade] === proposalQuery.gradeDistribution[String(grade)]),
    'GRADE_DISTRIBUTION_MISMATCH');
  validateTargetDecision(proposalQuery.targetDecision, pool, inventoryIds, proposalQuery.grades);
}
assert(Object.values(totals).reduce((sum, count) => sum + count, 0) === 15_735, 'JUDGMENT_PAIR_COUNT_MISMATCH');
assert([0, 1, 2, 3].every((grade) => totals[grade as RelevanceGrade] === expectedGrades[grade as RelevanceGrade]
  && totals[grade as RelevanceGrade] === proposal.aggregate_candidate_grade_counts[String(grade)]), 'GRADE_DISTRIBUTION_MISMATCH');

const paired = new Map<string, ProposalQuery[]>();
for (const query of packet.queries) {
  if (!query.pairGroupId) continue;
  paired.set(query.pairGroupId, [...(paired.get(query.pairGroupId) ?? []), proposalById.get(query.queryId)!]);
}
assert([...paired.values()].every((group) => group.length === 2 && gradeSignature(group[0]!) === gradeSignature(group[1]!)),
  'EN_SV_JUDGMENT_MISMATCH');

const createdAt = new Date().toISOString();
const records = packet.queries.map((packetQuery) => {
  const proposalQuery = proposalById.get(packetQuery.queryId)!;
  const decision = proposalQuery.targetDecision;
  const unavailable = decision?.status === 'TARGET_NOT_IN_FROZEN_DATASET';
  const matchedSingle = decision?.status === 'TARGET_MATCHED' && decision.matchedEntityIds.length === 1
    ? decision.matchedEntityIds[0]! : null;
  const taxonomyNodeId = packetQuery.structuredFilters.taxonomy?.node_id;
  return {
    judgment_version: judgmentVersion,
    query_id: packetQuery.queryId,
    query_text: packetQuery.query,
    relevant: proposalQuery.grades.map(({ entityId, grade }) => ({ entity_id: entityId, grade: grade as RelevanceGrade })),
    known_item_target: matchedSingle,
    known_item_inventory_status: unavailable ? 'TARGET_NOT_IN_FROZEN_DATASET' as const
      : decision?.status === 'TARGET_MATCHED' ? 'TARGET_MATCHED' as const : 'NOT_APPLICABLE' as const,
    primary_failure_attribution: unavailable ? 'INVENTORY' as const : null,
    search_ranking_assessment: unavailable ? 'NOT_EVALUATED' as const : 'EVALUATED' as const,
    approved_target_decision: decision ? {
      status: decision.status,
      matched_entity_ids: decision.matchedEntityIds,
      ...(decision.additionalHighlyRelevantEntityIds
        ? { additional_highly_relevant_entity_ids: decision.additionalHighlyRelevantEntityIds } : {}),
    } : null,
    acceptable_taxonomy_node_ids: typeof taxonomyNodeId === 'string' ? [taxonomyNodeId] : [],
    acceptable_group_keys: [],
    expected_protected_behavior: [],
    expected_ineligible_behavior: unavailable
      ? ['TARGET_NOT_IN_FROZEN_DATASET', 'PRODUCT_OUTCOME:QUERY_UNSATISFIED', 'PRIMARY_FAILURE:INVENTORY', 'SEARCH_RANKING:NOT_EVALUATED']
      : packetQuery.candidatePool.length === 0 ? ['NO_HARD_ELIGIBLE_CANDIDATE'] : [],
    rationale: proposalQuery.rationale,
    judged_by: 'engineer-approved',
    judged_at: createdAt,
    dataset_version: manifest.canonical_dataset_version,
    taxonomy_checksum: manifest.taxonomy.checksum,
    boundary_version: manifest.boundary.boundary_version,
  };
});
const judgments: EvalJudgmentSetV1 = {
  judgment_version: judgmentVersion,
  status: 'FROZEN',
  split: 'DEV',
  corpus_version: 'corpus.v1',
  corpus_checksum: expectedCorpusChecksum,
  dataset_version: manifest.canonical_dataset_version,
  dataset_manifest_version: manifest.manifest_version,
  dataset_manifest_checksum: expectedManifestChecksum,
  dataset_inventory_checksum: expectedInventoryChecksum,
  selected_query_ids: records.map(({ query_id }) => query_id),
  taxonomy_checksum: manifest.taxonomy.checksum,
  boundary_version: manifest.boundary.boundary_version,
  hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY',
  approval: { authority: 'ENGINEER', provenance: 'HUMAN_APPROVED_EXTERNAL_REVIEW' },
  freeze_metadata: {
    created_at: createdAt,
    review_source: 'HUMAN_APPROVED_EXTERNAL_REVIEW',
    approved_proposal: proposal.proposal_version,
    approved_proposal_sha256: expectedProposalChecksum,
    grading_rubric: proposal.rubric,
    grading_rubric_version: proposal.proposal_version,
  },
  records,
};
const judgmentText = `${JSON.stringify(judgments, null, 2)}\n`;
const judgmentChecksum = sha256(judgmentText);
const reportText = renderReport({ createdAt, judgmentChecksum, records: records.length, totals });

await Promise.all([
  writeFile(judgmentUrl, judgmentText, { flag: 'wx' }),
  writeFile(judgmentChecksumUrl, `${judgmentChecksum}\n`, { flag: 'wx' }),
  writeFile(reportUrl, reportText, { flag: 'wx' }),
]);

console.log(JSON.stringify({
  judgmentVersion,
  judgmentChecksum,
  devQueries: records.length,
  semanticDevQueries: inventory.query_corpus.semantic_dev_query_count,
  candidateEntityPairs: Object.values(totals).reduce((sum, count) => sum + count, 0),
  gradeDistribution: totals,
  sealedAccessed: false,
  adversarialAccessed: false,
}));

function validateTargetDecision(
  decision: TargetDecision | null,
  pool: Set<string>,
  inventoryIds: Set<string>,
  grades: Array<{ entityId: string; grade: number }>,
): void {
  if (!decision) return;
  const matched = decision.matchedEntityIds;
  assert(new Set(matched).size === matched.length, 'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
  if (decision.status === 'TARGET_NOT_IN_FROZEN_DATASET') assert(matched.length === 0, 'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
  if (decision.status === 'TARGET_MATCHED') assert(matched.length > 0
    && matched.every((id) => pool.has(id) && gradeOf(grades, id) === 3),
    'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
  if (decision.status === 'TARGET_SET_MATCHED') assert(matched.length > 1
    && matched.every((id) => pool.has(id) && gradeOf(grades, id) === 3)
    && (decision.additionalHighlyRelevantEntityIds ?? []).every((id) => pool.has(id) && gradeOf(grades, id) === 3),
  'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
  if (decision.status === 'TARGET_VENUE_MATCHED_BUT_NO_ELIGIBLE_EVENT') assert(pool.size === 0
    && matched.length === 1 && inventoryIds.has(matched[0]!), 'APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED');
}

function renderReport(input: { createdAt: string; judgmentChecksum: string; records: number; totals: Record<RelevanceGrade, number> }): string {
  return `# Final-eval recovery DEV judgment freeze\n\n`
    + `HUMAN_REVIEW_COMPLETE = TRUE\n`
    + `DEV_JUDGMENTS_FROZEN = TRUE\n`
    + `SEALED_ACCESSED = FALSE\n`
    + `ADVERSARIAL_ACCESSED = FALSE\n\n`
    + `JUDGMENT_VERSION = ${judgmentVersion}\n`
    + `JUDGMENT_SHA256 = ${input.judgmentChecksum}\n`
    + `DATASET_MANIFEST = dataset-manifest.final-eval-recovery.v1\n`
    + `DATASET_MANIFEST_SHA256 = ${expectedManifestChecksum}\n`
    + `DEV_INVENTORY = dev-inventory.final-eval-recovery.v1\n`
    + `DEV_INVENTORY_CHECKSUM = ${expectedInventoryChecksum}\n`
    + `QUERY_CORPUS_SHA256 = ${expectedCorpusChecksum}\n`
    + `APPROVED_PROPOSAL_VERSION = human-judgment-proposal.final-eval-recovery.v2\n`
    + `APPROVED_PROPOSAL_SHA256 = ${expectedProposalChecksum}\n`
    + `REVIEW_SOURCE = HUMAN_APPROVED_EXTERNAL_REVIEW\n`
    + `CREATED_AT = ${input.createdAt}\n`
    + `DEV_QUERIES = ${input.records}\n`
    + `SEMANTIC_DEV_QUERIES = 16\n`
    + `CANDIDATE_ENTITY_PAIRS = 15735\n`
    + `GRADE_0_1_2_3 = ${input.totals[0]}/${input.totals[1]}/${input.totals[2]}/${input.totals[3]}\n`;
}

function gradeOf(grades: Array<{ entityId: string; grade: number }>, entityId: string): number | undefined {
  return grades.find(({ entityId: id }) => id === entityId)?.grade;
}
function gradeSignature(query: ProposalQuery): string {
  return query.grades.map(({ entityId, grade }) => `${entityId}:${grade}`).sort().join(',');
}
function sameStrings(left: string[], right: string[]): boolean {
  return [...left].sort().join(',') === [...right].sort().join(',');
}
function uniqueMap<T>(items: T[], key: (item: T) => string, code: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const value = key(item);
    assert(!result.has(value), code);
    result.set(value, item);
  }
  return result;
}
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
function checksumValue(value: string): string {
  const checksum = value.trim().split(/\s+/)[0];
  if (!checksum || !/^[0-9a-f]{64}$/.test(checksum)) fail('CHECKSUM_SIDECAR_INVALID');
  return checksum;
}
