import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

describe('post-Coverage frozen DEV judgments', () => {
  it('pins 60 approved DEV judgments without held-out records', async () => {
    const [text, checksumText, corpusText, proposalText] = await Promise.all([
      readFile(new URL('evaluation/judgments/judgments.day4-postcoverage.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/judgments/judgments.day4-postcoverage.v1.sha256', root), 'utf8'),
      readFile(new URL('evaluation/corpus/corpus.v1.jsonl', root), 'utf8'),
      readFile(new URL('evaluation/judgments/human-judgment-proposal.day4-postcoverage.v2.json', root), 'utf8'),
    ]);
    const artifact = JSON.parse(text) as {
      status: string; split: string; records: Array<{
        query_id: string; relevant: Array<{ entity_id: string; grade: number }>;
        approved_target_decision: { status: string; matched_entity_ids: string[] } | null;
      }>;
      selected_query_ids: string[]; dataset_manifest_version: string; dataset_manifest_checksum: string;
      dataset_inventory_checksum: string; approval: { authority: string };
    };
    const proposal = JSON.parse(proposalText) as { queries: Array<{
      queryId: string; grades: Array<{ entityId: string; grade: number }>;
      targetDecision: { status: string; matchedEntityIds: string[] } | null;
    }> };
    const devIds = corpusText.split(/\r?\n/).filter((line) => line.includes('"split":"DEV"'))
      .map((line) => (JSON.parse(line) as { query_id: string }).query_id).sort();
    expect(createHash('sha256').update(text).digest('hex')).toBe(checksumText.trim());
    expect(artifact.status).toBe('FROZEN');
    expect(artifact.split).toBe('DEV');
    expect(artifact.records).toHaveLength(60);
    expect(artifact.selected_query_ids).toEqual(artifact.records.map(({ query_id }) => query_id));
    expect(artifact.records.map(({ query_id }) => query_id).sort()).toEqual(devIds);
    expect(artifact.records.flatMap(({ relevant }) => relevant).every(({ grade }) => [0, 1, 2, 3].includes(grade))).toBe(true);
    expect(artifact.dataset_manifest_version).toBe('dataset-manifest.day4-postcoverage.v2');
    expect(artifact.dataset_manifest_checksum).toBe('c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0');
    expect(artifact.dataset_inventory_checksum).toBe('ed0e23189783959180c39ea73ff4d01cf344f6f8f08ddd079ffffa5e7a2f0209');
    expect(artifact.approval.authority).toBe('ENGINEER');
    expect(artifact.records.map((record) => ({
      queryId: record.query_id,
      grades: record.relevant.map(({ entity_id, grade }) => ({ entityId: entity_id, grade })),
      targetDecision: record.approved_target_decision ? {
        status: record.approved_target_decision.status,
        matchedEntityIds: record.approved_target_decision.matched_entity_ids,
      } : null,
    }))).toEqual(proposal.queries.map(({ queryId, grades, targetDecision }) => ({
      queryId, grades,
      targetDecision: targetDecision ? { status: targetDecision.status, matchedEntityIds: targetDecision.matchedEntityIds } : null,
    })));
  });
});
