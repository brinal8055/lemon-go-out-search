import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

import type { EvalCorpusRecordV1, EvalJudgmentSetV1, RelevanceGrade } from './index.ts';

const root = new URL('../../../', import.meta.url);
const manifestUrl = new URL('evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json', root);
const manifestChecksumUrl = new URL('evaluation/manifests/dataset-manifest.day4-postcoverage.v2.sha256', root);
const packetUrl = new URL('evaluation/judgments/dev-review-packet.day4-postcoverage.v2.json', root);
const packetChecksumUrl = new URL('evaluation/judgments/dev-review-packet.day4-postcoverage.v2.sha256', root);
const proposalUrl = new URL('evaluation/judgments/human-judgment-proposal.day4-postcoverage.v2.json', root);
const corpusUrl = new URL('evaluation/corpus/corpus.v1.jsonl', root);
const corpusChecksumUrl = new URL('evaluation/corpus/checksum.v1.txt', root);
const judgmentUrl = new URL('evaluation/judgments/judgments.day4-postcoverage.v1.json', root);
const judgmentChecksumUrl = new URL('evaluation/judgments/judgments.day4-postcoverage.v1.sha256', root);
const judgmentVersion = 'judgments.day4-postcoverage.v1';
const expectedManifestChecksum = 'c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0';
const expectedInventoryChecksum = 'ed0e23189783959180c39ea73ff4d01cf344f6f8f08ddd079ffffa5e7a2f0209';

type Manifest = {
  manifest_version: string;
  status: string;
  canonical_dataset_version: string;
  dataset_inventory: { checksum: string };
  taxonomy: { checksum: string };
  boundary: { version: string };
  corpus: { version: string; checksum: string; dev_query_count: number };
  held_out_access: HeldOutGuard;
};
type HeldOutGuard = {
  parsed_splits: string[];
  sealed_queries_executed: number;
  adversarial_queries_executed: number;
  sealed_or_adversarial_judgments_loaded: boolean;
};
type Candidate = { canonicalEntityId: string; grade: null };
type Excluded = { canonicalEntityId: string };
type PacketQuery = {
  queryId: string; query: string; language: string; family: string; pairGroupId: string | null;
  structuredFilters: Record<string, unknown>; candidatePool: Candidate[];
  hardConstraintExcludedInventory: Excluded[];
};
type Packet = {
  packet_version: string; status: string; split: string; dev_queries_total: number;
  current_dataset_judgments_complete: number; current_dataset_judgments_missing: number;
  dataset_manifest: { version: string; checksum: string }; dataset_inventory_checksum: string;
  held_out_guard: HeldOutGuard; queries: PacketQuery[];
};
type TargetDecision = {
  status: 'TARGET_MATCHED' | 'TARGET_SET_MATCHED' | 'TARGET_NOT_IN_FROZEN_DATASET' | 'TARGET_VENUE_MATCHED_BUT_NO_ELIGIBLE_EVENT';
  matchedEntityIds: string[]; additionalHighlyRelevantEntityIds?: string[];
};
type ProposalQuery = {
  queryId: string; query: string; language: string; family: string; candidateCount: number;
  gradeDistribution: Record<string, number>; targetDecision: TargetDecision | null;
  rationale: string; grades: Array<{ entityId: string; grade: number }>;
};
type Proposal = {
  proposal_version: string; status: string;
  dataset_manifest: { version: string; checksum: string }; dataset_inventory_checksum: string;
  source_packet: string; source_packet_sha256: string;
  queries: ProposalQuery[]; aggregate_candidate_grade_counts: Record<string, number>;
};

const [manifestText, manifestChecksumText, packetText, packetChecksumText, proposalText, corpusText, corpusChecksumText] = await Promise.all([
  readFile(manifestUrl, 'utf8'), readFile(manifestChecksumUrl, 'utf8'), readFile(packetUrl, 'utf8'),
  readFile(packetChecksumUrl, 'utf8'), readFile(proposalUrl, 'utf8'), readFile(corpusUrl, 'utf8'), readFile(corpusChecksumUrl, 'utf8'),
]);
const fail = (): never => { throw new Error('APPROVED_JUDGMENT_MAPPING_VALIDATION_FAILED'); };
const assert = (condition: unknown): void => { if (!condition) fail(); };
assert(sha256(manifestText) === manifestChecksumText.trim() && manifestChecksumText.trim() === expectedManifestChecksum);
assert(sha256(packetText) === packetChecksumText.trim());
assert(sha256(corpusText) === corpusChecksumText.trim());

const manifest = JSON.parse(manifestText) as Manifest;
const packet = JSON.parse(packetText) as Packet;
const proposal = JSON.parse(proposalText) as Proposal;
const devCorpus = corpusText.split(/\r?\n/).filter((line) => line.includes('"split":"DEV"'))
  .map((line) => JSON.parse(line) as EvalCorpusRecordV1);
assert(manifest.manifest_version === 'dataset-manifest.day4-postcoverage.v2'
  && manifest.status === 'FROZEN_FOR_HUMAN_REVIEW'
  && manifest.dataset_inventory.checksum === expectedInventoryChecksum
  && manifest.corpus.checksum === corpusChecksumText.trim()
  && manifest.corpus.dev_query_count === 60);
assert(packet.packet_version === 'dev-review-packet.day4-postcoverage.v2'
  && packet.status === 'HUMAN_DEV_JUDGMENT_REQUIRED' && packet.split === 'DEV'
  && packet.dev_queries_total === 60 && packet.queries.length === 60
  && packet.current_dataset_judgments_complete === 0 && packet.current_dataset_judgments_missing === 60
  && packet.dataset_manifest.version === manifest.manifest_version
  && packet.dataset_manifest.checksum === expectedManifestChecksum
  && packet.dataset_inventory_checksum === expectedInventoryChecksum);
assert(proposal.proposal_version === 'human-judgment-proposal.day4-postcoverage.v2'
  && proposal.status === 'PENDING_ENGINEER_APPROVAL'
  && proposal.dataset_manifest.version === manifest.manifest_version
  && proposal.dataset_manifest.checksum === expectedManifestChecksum
  && proposal.dataset_inventory_checksum === expectedInventoryChecksum
  && proposal.source_packet === packet.packet_version
  && proposal.source_packet_sha256 === packetChecksumText.trim()
  && proposal.queries.length === 60);
for (const guard of [manifest.held_out_access, packet.held_out_guard]) {
  assert(guard.parsed_splits.join(',') === 'DEV' && guard.sealed_queries_executed === 0
    && guard.adversarial_queries_executed === 0 && !guard.sealed_or_adversarial_judgments_loaded);
}

const packetById = uniqueMap(packet.queries, ({ queryId }) => queryId);
const proposalById = uniqueMap(proposal.queries, ({ queryId }) => queryId);
const corpusById = uniqueMap(devCorpus, ({ query_id: queryId }) => queryId);
assert(packetById.size === 60 && proposalById.size === 60 && corpusById.size === 60);
assert(sameStrings([...packetById.keys()], [...proposalById.keys()]) && sameStrings([...packetById.keys()], [...corpusById.keys()]));
const allEligibleIds = new Set(packet.queries.flatMap(({ candidatePool }) => candidatePool.map(({ canonicalEntityId }) => canonicalEntityId)));
const totals = { 0: 0, 1: 0, 2: 0, 3: 0 };

for (const packetQuery of packet.queries) {
  const proposalQuery = proposalById.get(packetQuery.queryId)!;
  const corpusRecord = corpusById.get(packetQuery.queryId)!;
  assert(proposalQuery.query === packetQuery.query && proposalQuery.query === corpusRecord.query
    && proposalQuery.language === packetQuery.language && proposalQuery.language === corpusRecord.language
    && proposalQuery.family === packetQuery.family && proposalQuery.family === corpusRecord.family
    && proposalQuery.candidateCount === packetQuery.candidatePool.length);
  const pool = new Set(packetQuery.candidatePool.map(({ canonicalEntityId }) => canonicalEntityId));
  const excluded = new Set(packetQuery.hardConstraintExcludedInventory.map(({ canonicalEntityId }) => canonicalEntityId));
  assert([...pool].every((id) => !excluded.has(id)));
  const gradeIds = proposalQuery.grades.map(({ entityId }) => entityId);
  assert(new Set(gradeIds).size === gradeIds.length && sameStrings(gradeIds, [...pool]));
  const distribution = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const { entityId, grade } of proposalQuery.grades) {
    assert(pool.has(entityId) && !excluded.has(entityId) && Number.isInteger(grade) && grade >= 0 && grade <= 3);
    distribution[grade as RelevanceGrade] += 1;
    totals[grade as RelevanceGrade] += 1;
  }
  assert([0, 1, 2, 3].every((grade) => distribution[grade as RelevanceGrade] === proposalQuery.gradeDistribution[String(grade)]));
  assert(packetQuery.candidatePool.length > 0 || proposalQuery.grades.length === 0);
  validateTargetDecision(proposalQuery.targetDecision, pool, allEligibleIds, proposalQuery.grades);
}
assert([0, 1, 2, 3].every((grade) => totals[grade as RelevanceGrade] === proposal.aggregate_candidate_grade_counts[String(grade)]));

const paired = new Map<string, ProposalQuery[]>();
for (const query of packet.queries) {
  if (!query.pairGroupId) continue;
  const group = paired.get(query.pairGroupId) ?? [];
  group.push(proposalById.get(query.queryId)!);
  paired.set(query.pairGroupId, group);
}
for (const group of paired.values()) {
  assert(group.length === 2 && gradeSignature(group[0]!) === gradeSignature(group[1]!));
}

const records = packet.queries.map((packetQuery) => {
  const proposalQuery = proposalById.get(packetQuery.queryId)!;
  const corpusRecord = corpusById.get(packetQuery.queryId)!;
  const decision = proposalQuery.targetDecision;
  const unavailable = decision?.status === 'TARGET_NOT_IN_FROZEN_DATASET';
  const matchedSingle = decision?.status === 'TARGET_MATCHED' ? decision.matchedEntityIds[0]! : null;
  const taxonomy = corpusRecord.request_filters.taxonomy as { node_id?: unknown } | undefined;
  return {
    judgment_version: judgmentVersion,
    query_id: packetQuery.queryId,
    query_text: packetQuery.query,
    relevant: proposalQuery.grades.map(({ entityId, grade }) => ({ entity_id: entityId, grade: grade as RelevanceGrade })),
    known_item_target: matchedSingle,
    known_item_inventory_status: unavailable ? 'TARGET_NOT_IN_FROZEN_DATASET' as const
      : matchedSingle ? 'TARGET_MATCHED' as const : 'NOT_APPLICABLE' as const,
    primary_failure_attribution: unavailable ? 'INVENTORY' as const : null,
    search_ranking_assessment: unavailable ? 'NOT_EVALUATED' as const : 'EVALUATED' as const,
    approved_target_decision: decision ? {
      status: decision.status,
      matched_entity_ids: decision.matchedEntityIds,
      ...(decision.additionalHighlyRelevantEntityIds
        ? { additional_highly_relevant_entity_ids: decision.additionalHighlyRelevantEntityIds } : {}),
    } : null,
    acceptable_taxonomy_node_ids: typeof taxonomy?.node_id === 'string' ? [taxonomy.node_id] : [],
    acceptable_group_keys: [],
    expected_protected_behavior: [],
    expected_ineligible_behavior: unavailable
      ? ['TARGET_NOT_IN_FROZEN_DATASET', 'PRODUCT_OUTCOME:QUERY_UNSATISFIED', 'PRIMARY_FAILURE:INVENTORY', 'SEARCH_RANKING:NOT_EVALUATED']
      : packetQuery.candidatePool.length === 0 ? ['NO_HARD_ELIGIBLE_CANDIDATE'] : [],
    rationale: proposalQuery.rationale,
    judged_by: 'engineer-approved',
    judged_at: '2026-08-15T00:00:00.000Z',
    dataset_version: manifest.canonical_dataset_version,
    taxonomy_checksum: manifest.taxonomy.checksum,
    boundary_version: manifest.boundary.version,
  };
});
const judgments: EvalJudgmentSetV1 = {
  judgment_version: judgmentVersion, status: 'FROZEN', split: 'DEV', corpus_version: 'corpus.v1',
  corpus_checksum: corpusChecksumText.trim(), dataset_version: manifest.canonical_dataset_version,
  dataset_manifest_version: manifest.manifest_version, dataset_manifest_checksum: expectedManifestChecksum,
  dataset_inventory_checksum: expectedInventoryChecksum, selected_query_ids: records.map(({ query_id }) => query_id),
  taxonomy_checksum: manifest.taxonomy.checksum, boundary_version: manifest.boundary.version,
  hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY',
  approval: { authority: 'ENGINEER', provenance: 'HUMAN_APPROVED_POSTCOV_JUDGE_01_TASK_PROMPT' }, records,
};
const judgmentText = `${JSON.stringify(judgments, null, 2)}\n`;
await Promise.all([
  writeFile(judgmentUrl, judgmentText, { flag: 'wx' }),
  writeFile(judgmentChecksumUrl, `${sha256(judgmentText)}\n`, { flag: 'wx' }),
]);
const decisions = proposal.queries.flatMap(({ targetDecision }) => targetDecision ? [targetDecision] : []);
console.log(JSON.stringify({
  judgmentVersion, checksum: sha256(judgmentText), reviewed: records.length,
  gradedEntityPairs: Object.values(totals).reduce((sum, count) => sum + count, 0), gradeDistribution: totals,
  zeroCandidateQueries: packet.queries.filter(({ candidatePool }) => candidatePool.length === 0).length,
  targetDecisionsPresent: decisions.filter(({ status }) => status !== 'TARGET_NOT_IN_FROZEN_DATASET').length,
  targetDecisionsAbsent: decisions.filter(({ status }) => status === 'TARGET_NOT_IN_FROZEN_DATASET').length,
  heldOutQueriesLoaded: 0,
}));

function validateTargetDecision(
  decision: TargetDecision | null, pool: Set<string>, allEligible: Set<string>, grades: Array<{ entityId: string; grade: number }>,
): void {
  if (!decision) return;
  const matched = decision.matchedEntityIds;
  assert(new Set(matched).size === matched.length);
  if (decision.status === 'TARGET_NOT_IN_FROZEN_DATASET') assert(matched.length === 0);
  if (decision.status === 'TARGET_MATCHED') assert(matched.length === 1 && pool.has(matched[0]!) && gradeOf(grades, matched[0]!) === 3);
  if (decision.status === 'TARGET_SET_MATCHED') {
    assert(matched.length > 1 && matched.every((id) => pool.has(id) && gradeOf(grades, id) === 3));
    assert((decision.additionalHighlyRelevantEntityIds ?? []).every((id) => pool.has(id) && gradeOf(grades, id) === 3));
  }
  if (decision.status === 'TARGET_VENUE_MATCHED_BUT_NO_ELIGIBLE_EVENT') {
    assert(pool.size === 0 && matched.length === 1 && allEligible.has(matched[0]!));
  }
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
function uniqueMap<T>(items: T[], key: (item: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) { const value = key(item); assert(!result.has(value)); result.set(value, item); }
  return result;
}
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
