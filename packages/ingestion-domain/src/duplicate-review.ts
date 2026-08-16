import pg from 'pg';
import { assertDestructiveDatabaseOperation } from '@lemon/contracts';
import type { QueryResultRow } from 'pg';

const { Client } = pg;

export type DuplicateDecision = 'SAME' | 'SEPARATE' | 'UNSURE';

export type CandidateListItem = {
  id: string;
  record_a_id: string;
  record_b_id: string;
  entity_a_id: string | null;
  entity_b_id: string | null;
  status: 'OPEN' | DuplicateDecision;
  current_decision_id: string;
  evidence_summary: unknown;
  evidence_hash: string;
  updated_at: string;
};

export type CandidateReview = CandidateListItem & {
  decisions: Array<{
    id: string;
    decision: 'OPEN' | DuplicateDecision;
    operation_type: string;
    reviewer: string;
    decided_at: string;
    evidence_version_ids: string[];
    evidence_parse_attempt_ids: string[];
    evidence_hash: string;
    supersedes_decision_id: string | null;
    target_entity_id: string | null;
    survivor_entity_id: string | null;
    loser_entity_id: string | null;
    resolution_detail: unknown;
    note: string | null;
  }>;
};

async function controlledQuery<T extends QueryResultRow>(
  connectionString: string,
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role lemon_reviewer');
    const result = await client.query<T>(sql, values);
    await client.query('commit');
    return result.rows;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

export async function prepareLocalDuplicateReviewRuntime(connectionString: string): Promise<void> {
  assertDestructiveDatabaseOperation(connectionString, process.env);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('grant lemon_reviewer to postgres with set true');
  } finally {
    await client.end();
  }
}

export async function listDuplicateCandidates(
  connectionString: string,
  limit = 50,
): Promise<CandidateListItem[]> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }
  return controlledQuery<CandidateListItem>(connectionString, `
    select id, record_a_id, record_b_id, entity_a_id, entity_b_id,
           status, current_decision_id, evidence_summary, evidence_hash, updated_at
    from app.duplicate_candidates
    order by (status = 'OPEN') desc, updated_at, id
    limit $1
  `, [limit]);
}

export async function showDuplicateCandidate(
  connectionString: string,
  candidateId: string,
): Promise<CandidateReview> {
  const rows = await controlledQuery<CandidateReview>(connectionString, `
    select candidate.id, candidate.record_a_id, candidate.record_b_id,
           candidate.entity_a_id, candidate.entity_b_id, candidate.status,
           candidate.current_decision_id, candidate.evidence_summary,
           candidate.evidence_hash, candidate.updated_at,
           coalesce(jsonb_agg(jsonb_build_object(
             'id', decision.id,
             'decision', decision.decision,
             'operation_type', decision.operation_type,
             'reviewer', decision.reviewer,
             'decided_at', decision.decided_at,
             'evidence_version_ids', decision.evidence_version_ids,
             'evidence_parse_attempt_ids', decision.evidence_parse_attempt_ids,
             'evidence_hash', decision.evidence_hash,
             'supersedes_decision_id', decision.supersedes_decision_id,
             'target_entity_id', decision.target_entity_id,
             'survivor_entity_id', decision.survivor_entity_id,
             'loser_entity_id', decision.loser_entity_id,
             'resolution_detail', decision.resolution_detail,
             'note', decision.note
           ) order by decision.decided_at, decision.id), '[]'::jsonb) as decisions
    from app.duplicate_candidates as candidate
    join app.duplicate_candidate_decisions as decision
      on decision.duplicate_candidate_id = candidate.id
    where candidate.id = $1
    group by candidate.id
  `, [candidateId]);
  if (rows.length !== 1) throw new Error('duplicate candidate not found');
  return rows[0];
}

export async function generateDuplicateCandidates(
  connectionString: string,
  limit = 50,
): Promise<Array<{ candidate_id: string; record_a_id: string; record_b_id: string; reason: string }>> {
  return controlledQuery(connectionString, 'select * from app.generate_duplicate_candidates($1)', [limit]);
}

export async function createDuplicateCandidate(
  connectionString: string,
  recordOneId: string,
  recordTwoId: string,
  actor: string,
): Promise<string> {
  return oneId(connectionString, 'select app.create_duplicate_candidate($1, $2, $3) as id', [recordOneId, recordTwoId, actor]);
}

export async function reopenDuplicateCandidate(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return oneId(connectionString, 'select app.reopen_duplicate_candidate($1, $2, $3, $4) as id',
    [candidateId, expectedDecisionId, reviewer, note]);
}

export async function decideSameTypeA(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  unresolvedRecordId: string,
  targetEntityId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return finalize(connectionString, candidateId, expectedDecisionId, 'SAME', reviewer,
    unresolvedRecordId, targetEntityId, null, note);
}

export async function decideSameTypeB(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  survivorEntityId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return finalize(connectionString, candidateId, expectedDecisionId, 'SAME', reviewer,
    null, null, survivorEntityId, note);
}

export async function decideSeparate(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return finalize(connectionString, candidateId, expectedDecisionId, 'SEPARATE', reviewer, null, null, null, note);
}

export async function decideUnsure(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return finalize(connectionString, candidateId, expectedDecisionId, 'UNSURE', reviewer, null, null, null, note);
}

export async function reverseDuplicateSame(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  reviewer: string,
  note: string | null = null,
): Promise<string> {
  return oneId(connectionString, 'select app.reverse_duplicate_same($1, $2, $3, $4) as id',
    [candidateId, expectedDecisionId, reviewer, note]);
}

async function finalize(
  connectionString: string,
  candidateId: string,
  expectedDecisionId: string,
  decision: DuplicateDecision,
  reviewer: string,
  unresolvedRecordId: string | null,
  targetEntityId: string | null,
  survivorEntityId: string | null,
  note: string | null,
): Promise<string> {
  return oneId(connectionString, `
    select app.finalize_duplicate_candidate(
      $1, $2, $3::app.duplicate_decision, $4, $5, $6, $7, $8
    ) as id
  `, [candidateId, expectedDecisionId, decision, reviewer, unresolvedRecordId, targetEntityId, survivorEntityId, note]);
}

async function oneId(connectionString: string, sql: string, values: unknown[]): Promise<string> {
  const rows = await controlledQuery<{ id: string }>(connectionString, sql, values);
  if (rows.length !== 1) throw new Error('controlled duplicate review operation returned no decision');
  return rows[0].id;
}
