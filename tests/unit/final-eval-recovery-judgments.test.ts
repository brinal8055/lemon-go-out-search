import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

describe('final-eval recovery frozen DEV judgments', () => {
  it('pins the approved v2 proposal to the recovery DEV inventory without held-out access', async () => {
    const [judgmentText, checksumText, proposalText, manifestText, inventoryText, packetText, reportText, schemaText] = await Promise.all([
      readFile(new URL('evaluation/judgments/judgments.final-eval-recovery.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/judgments/judgments.final-eval-recovery.v1.sha256', root), 'utf8'),
      readFile(new URL('evaluation/judgments/human-judgment-proposal.final-eval-recovery.v2.json', root), 'utf8'),
      readFile(new URL('evaluation/manifests/dataset-manifest.final-eval-recovery.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/inventories/dev-inventory.final-eval-recovery.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/judgments/dev-review-packet.final-eval-recovery.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/reports/final-eval-recovery/dev-judgment-freeze.v1.md', root), 'utf8'),
      readFile(new URL('packages/evaluation/schemas/judgment-set.v1.schema.json', root), 'utf8'),
    ]);
    const judgments = JSON.parse(judgmentText) as { judgment_version: string; status: string; split: string; corpus_checksum: string;
      dataset_manifest_version: string; dataset_manifest_checksum: string; dataset_inventory_checksum: string;
      selected_query_ids: string[]; records: Array<{ query_id: string; relevant: Array<{ entity_id: string; grade: number }> }>;
      approval: { authority: string; provenance: string }; freeze_metadata: { review_source: string; approved_proposal: string;
        approved_proposal_sha256: string; created_at: string; grading_rubric: unknown; grading_rubric_version: string } };
    const proposal = JSON.parse(proposalText) as { proposal_version: string; status: string; dev_inventory: { checksum: string };
      queries: Array<{ queryId: string; grades: Array<{ entityId: string; grade: number }> }>; aggregate_candidate_grade_counts: Record<string, number> };
    const manifest = JSON.parse(manifestText) as { manifest_version: string; query_corpus: { checksum: string } };
    const inventory = JSON.parse(inventoryText) as { inventory_checksum: string; query_corpus: { dev_query_count: number; semantic_dev_query_count: number }; entities: Array<{ canonicalEntityId: string }> };
    const packet = JSON.parse(packetText) as { held_out_guard: Record<string, unknown>; queries: Array<{ queryId: string; pairGroupId: string | null; candidatePool: Array<{ canonicalEntityId: string }> }> };
    const schema = JSON.parse(schemaText) as { properties: { freeze_metadata: { required: string[] } } };

    expect(createHash('sha256').update(judgmentText).digest('hex')).toBe(checksumText.trim());
    expect(createHash('sha256').update(proposalText).digest('hex')).toBe('c613ffa40663e53b8a54cafef0de9d5b2bd95e0ed2277fdb65d6f22b594daae5');
    expect(judgments).toMatchObject({
      judgment_version: 'judgments.final-eval-recovery.v1', status: 'FROZEN', split: 'DEV',
      corpus_checksum: 'bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c',
      dataset_manifest_version: manifest.manifest_version, dataset_manifest_checksum: 'f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82',
      dataset_inventory_checksum: '2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37',
      approval: { authority: 'ENGINEER', provenance: 'HUMAN_APPROVED_EXTERNAL_REVIEW' },
      freeze_metadata: { review_source: 'HUMAN_APPROVED_EXTERNAL_REVIEW', approved_proposal: proposal.proposal_version,
        approved_proposal_sha256: 'c613ffa40663e53b8a54cafef0de9d5b2bd95e0ed2277fdb65d6f22b594daae5', grading_rubric_version: proposal.proposal_version },
    });
    expect(judgments.records).toHaveLength(60);
    expect(Number.isNaN(Date.parse(judgments.freeze_metadata.created_at))).toBe(false);
    expect(schema.properties.freeze_metadata.required).toEqual([
      'created_at', 'review_source', 'approved_proposal', 'approved_proposal_sha256', 'grading_rubric', 'grading_rubric_version',
    ]);
    expect(judgments.selected_query_ids).toEqual(judgments.records.map(({ query_id }) => query_id));
    expect(inventory.query_corpus).toMatchObject({ dev_query_count: 60, semantic_dev_query_count: 16 });
    expect(proposal.status).toBe('PENDING_ENGINEER_APPROVAL');
    expect(proposal.dev_inventory.checksum).toBe(inventory.inventory_checksum);
    expect(manifest.query_corpus.checksum).toBe(judgments.corpus_checksum);
    const inventoryIds = new Set(inventory.entities.map(({ canonicalEntityId }) => canonicalEntityId));
    const pairs = judgments.records.flatMap(({ relevant }) => relevant);
    expect(pairs).toHaveLength(15_735);
    expect(pairs.every(({ entity_id, grade }) => inventoryIds.has(entity_id) && [0, 1, 2, 3].includes(grade))).toBe(true);
    expect([0, 1, 2, 3].map((grade) => pairs.filter((pair) => pair.grade === grade).length)).toEqual([10_397, 3_243, 1_341, 754]);
    expect(judgments.records.map(({ query_id, relevant }) => ({ queryId: query_id, grades: relevant.map(({ entity_id, grade }) => ({ entityId: entity_id, grade })) })))
      .toEqual(proposal.queries.map(({ queryId, grades }) => ({ queryId, grades })));
    const pairsByGroup = new Map<string, Array<{ queryId: string; grades: Array<{ entityId: string; grade: number }> }>>();
    for (const query of packet.queries) {
      if (!query.pairGroupId) continue;
      const matching = proposal.queries.find(({ queryId }) => queryId === query.queryId)!;
      pairsByGroup.set(query.pairGroupId, [...(pairsByGroup.get(query.pairGroupId) ?? []), matching]);
    }
    expect([...pairsByGroup.values()].every((group) => group.length === 2
      && signature(group[0]!.grades) === signature(group[1]!.grades))).toBe(true);
    expect(packet.held_out_guard).toEqual({
      parsed_splits: ['DEV'], sealed_queries_executed: 0, adversarial_queries_executed: 0,
      sealed_or_adversarial_judgments_loaded: false,
    });
    expect(reportText).toContain('HUMAN_REVIEW_COMPLETE = TRUE');
    expect(reportText).toContain('DEV_JUDGMENTS_FROZEN = TRUE');
    expect(reportText).toContain('SEALED_ACCESSED = FALSE');
    expect(reportText).toContain('ADVERSARIAL_ACCESSED = FALSE');
  });
});

function signature(grades: Array<{ entityId: string; grade: number }>): string {
  return grades.map(({ entityId, grade }) => `${entityId}:${grade}`).sort().join(',');
}
