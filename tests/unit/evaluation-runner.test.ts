import { describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

import {
  assertFrozenInputs,
  classifyFailure,
  evaluateDev,
  metricsFor,
  parseEvaluationArgs,
  renderMarkdown,
  stableJson,
  verifyChecksum,
} from '../../packages/evaluation/src/dev-runner.ts';
import type {
  EvalCorpusRecordV1,
  EvalDatasetManifestV1,
  EvalJudgmentRecordV1,
  EvalJudgmentSetV1,
} from '../../packages/evaluation/src/index.ts';

const entityA = '10000000-0000-4000-8000-000000000001';
const entityB = '10000000-0000-4000-8000-000000000002';
const entityC = '10000000-0000-4000-8000-000000000003';
const checksumA = 'a'.repeat(64);
const checksumB = 'b'.repeat(64);
const checksumC = 'c'.repeat(64);

describe('EVAL-02 metrics', () => {
  it('calculates Hit@1, Hit@3, and MRR from the known-item target rank', () => {
    expect(metricsFor([entityA], judgment({ known_item_target: entityA }))).toMatchObject({
      hitAt1: 1, hitAt3: 1, mrr: 1,
    });
    expect(metricsFor([entityB, entityA], judgment({ known_item_target: entityA }))).toMatchObject({
      hitAt1: 0, hitAt3: 1, mrr: 0.5,
    });
    expect(metricsFor([entityB, entityC], judgment({ known_item_target: entityA }))).toMatchObject({
      hitAt1: 0, hitAt3: 0, mrr: 0,
    });
  });

  it('calculates Recall@20 and Precision@5 with grade-zero excluded', () => {
    const metrics = metricsFor([entityA, entityC], judgment({
      relevant: [
        { entity_id: entityA, grade: 3 },
        { entity_id: entityB, grade: 2 },
        { entity_id: entityC, grade: 0 },
      ],
    }));
    expect(metrics.recallAt20).toBe(0.5);
    expect(metrics.precisionAt5).toBe(0.2);
  });

  it('calculates graded NDCG@5 with exponential gain', () => {
    const metrics = metricsFor([entityB, entityA], judgment({
      relevant: [{ entity_id: entityA, grade: 3 }, { entity_id: entityB, grade: 2 }],
    }));
    const actual = (3 + (7 / Math.log2(3))) / (7 + (3 / Math.log2(3)));
    expect(metrics.ndcgAt5).toBeCloseTo(actual, 12);
  });

  it('marks zero-relevant metrics not evaluated and handles zero results', () => {
    expect(metricsFor([], judgment({ relevant: [], known_item_target: null }))).toEqual({
      hitAt1: null,
      hitAt3: null,
      mrr: null,
      recallAt20: null,
      precisionAt5: null,
      ndcgAt5: null,
    });
    expect(metricsFor([], judgment({ known_item_target: entityA }))).toMatchObject({
      hitAt1: 0, hitAt3: 0, mrr: 0, recallAt20: 0, precisionAt5: 0, ndcgAt5: 0,
    });
  });
});

describe('EVAL-02 deterministic report', () => {
  it('aggregates families/languages, preserves pairs, pins versions, and remains byte deterministic', async () => {
    const corpus = [
      corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en'),
      corpusRecord('eval-v1-dev-semantic-en-01', 'semantic_occasion_language', 'en', 'sem-dev-pair'),
      corpusRecord('eval-v1-dev-semantic-sv-01', 'semantic_occasion_language', 'sv', 'sem-dev-pair'),
      corpusRecord('eval-v1-dev-event-01', 'event_time', 'sv'),
    ];
    const records = [
      judgment({ query_id: corpus[0]!.query_id, known_item_target: entityA }),
      judgment({ query_id: corpus[1]!.query_id, relevant: [{ entity_id: entityB, grade: 3 }] }),
      judgment({ query_id: corpus[2]!.query_id, relevant: [{ entity_id: entityC, grade: 2 }] }),
    ];
    const search = vi.fn(async (record: EvalCorpusRecordV1) => {
      if (record.query_id.endsWith('known-01')) return [{ canonicalId: entityA }];
      if (record.query_id.includes('semantic-sv')) return [{ canonicalId: entityC }];
      return [];
    });
    const diagnose = vi.fn(async () => diagnostic({
      reasonCodes: ['NOT_IN_CANDIDATE_UNION'],
      stages: { semantic: { status: 'NOT_IMPLEMENTED' } },
    }));
    const inputs = [corpus, judgmentSet(records), manifest(), pins()] as const;
    const first = await evaluateDev(...inputs, search, diagnose);
    const second = await evaluateDev(...inputs, search, diagnose);

    expect(stableJson(first)).toBe(stableJson(second));
    expect(first.contentChecksum).toMatch(/^[0-9a-f]{64}$/);
    expect(first.pins).toMatchObject({
      corpus: { version: 'corpus.v1', checksum: checksumA },
      judgments: { version: 'judgments.dev.v1', checksum: checksumB },
      dataset: { version: 'dataset.v1', checksum: checksumC },
      searchConfigVersion: 'search-config.v1',
      model: { status: 'NOT_PARTICIPATING' },
    });
    expect(first.byFamily.event_time).toMatchObject({ status: 'NOT_EVALUATED', queryCount: 1, judgedQueryCount: 0 });
    expect(first.byLanguage.en.judgedQueryCount).toBe(2);
    expect(first.byLanguage.sv.judgedQueryCount).toBe(1);
    expect(first.pairs).toEqual([{
      pairGroupId: 'sem-dev-pair',
      queryIds: ['eval-v1-dev-semantic-en-01', 'eval-v1-dev-semantic-sv-01'],
    }]);
    expect(first.queries.map(({ queryId }) => queryId)).toEqual([
      'eval-v1-dev-known-01',
      'eval-v1-dev-semantic-en-01',
      'eval-v1-dev-semantic-sv-01',
    ]);
    expect(first.failureAttributionSummary).toEqual({ UNSUPPORTED_CAPABILITY: 1 });
    expect(first.overall).toMatchObject({ queryCount: 4, judgedQueryCount: 3, zeroResultCount: 1, zeroResultRate: 1 / 3 });
    expect(first.overall.recallAt50).toEqual({ status: 'NOT_REQUIRED', value: null, evaluatedQueries: 0 });
    expect(renderMarkdown(first)).toContain('Event, semantic, RRF, and non-collapse stages: NOT_IMPLEMENTED.');
  });

  it('does not mutate judgments, corpus, manifest, or search configuration', async () => {
    const corpus = [corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en')];
    const judgments = judgmentSet([judgment({ query_id: corpus[0]!.query_id })]);
    const dataset = manifest();
    const before = structuredClone({ corpus, judgments, dataset });
    await evaluateDev(corpus, judgments, dataset, pins(), async () => [], async () => diagnostic());
    expect({ corpus, judgments, dataset }).toEqual(before);
  });

  it('attributes absent known-item targets to inventory and excludes them from ranking metrics', async () => {
    const record = corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en');
    const approved = judgment({
      query_id: record.query_id,
      relevant: [{ entity_id: entityA, grade: 0 }],
      known_item_target: null,
      known_item_inventory_status: 'TARGET_NOT_IN_FROZEN_DATASET',
      primary_failure_attribution: 'INVENTORY',
      search_ranking_assessment: 'NOT_EVALUATED',
    });
    const diagnose = vi.fn();
    const report = await evaluateDev(
      [record], judgmentSet([approved]), manifest(), pins(), async () => [], diagnose,
    );

    expect(diagnose).not.toHaveBeenCalled();
    expect(report.queries[0]).toMatchObject({
      inventoryUnavailable: true,
      productOutcome: 'QUERY_UNSATISFIED',
      searchRankingAssessment: 'NOT_EVALUATED',
      failureAttribution: 'INVENTORY',
      relevantEntityRanks: [],
      metrics: { hitAt1: null, hitAt3: null, mrr: null },
    });
    expect(report.overall.inventoryUnavailableQueryCount).toBe(1);
    expect(report.failureAttributionSummary).toEqual({ INVENTORY: 1 });
  });

  it('maps restricted diagnostic evidence to bounded failure classes', () => {
    const exact = corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en');
    const taxonomy = corpusRecord('eval-v1-dev-taxonomy-01', 'taxonomy_parent_leaf', 'sv');
    const event = corpusRecord('eval-v1-dev-event-01', 'event_time', 'en');
    expect(classifyFailure(exact, diagnostic({ entityExists: false }))).toBe('INVENTORY');
    expect(classifyFailure(exact, diagnostic({ eligible: false }))).toBe('ELIGIBILITY_EVENT_STATE');
    expect(classifyFailure(exact, diagnostic({ reasonCodes: ['OUTSIDE_TOP_5'] }))).toBe('FUSION_RANK');
    expect(classifyFailure(taxonomy, diagnostic({
      reasonCodes: ['NOT_IN_CANDIDATE_UNION'], stages: { taxonomy: { status: 'EXECUTED', present: false } },
    }))).toBe('TAXONOMY');
    expect(classifyFailure(event, diagnostic({ stages: { event: { status: 'NOT_IMPLEMENTED' } } })))
      .toBe('UNSUPPORTED_CAPABILITY');
  });
});

describe('EVAL-02 pins and access guards', () => {
  it('ships a machine-readable report schema with reproducibility fields', async () => {
    const schema = JSON.parse(await readFile(new URL(
      '../../packages/evaluation/schemas/dev-report.v1.schema.json',
      import.meta.url,
    ), 'utf8'));
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining([
      'pins', 'overall', 'byFamily', 'byLanguage', 'queries', 'contentChecksum',
    ]));
  });

  it('allows only explicit DEV CLI execution and requires every pinned path', () => {
    const args = parseEvaluationArgs([
      '--split=dev',
      '--judgment-version=judgments.dev.v1',
      '--judgments=j.json',
      '--judgment-checksum=j.sha256',
      '--manifest-version=dataset.v1',
      '--manifest=m.json',
      '--manifest-checksum=m.sha256',
      '--output=out',
      '--edge-url=http://127.0.0.1/search',
    ]);
    expect(args.judgmentsPath).toBe('j.json');
    expect(() => parseEvaluationArgs(['--split=dev'])).toThrow('JUDGMENT_VERSION_REQUIRED');
  });

  it('verifies corpus, judgment, and dataset artifact checksums', () => {
    const text = 'immutable artifact\n';
    const expected = '74769c053b02ea07dbef12cca379cb4562577ef2b9add734e0d5c6417a835de2';
    expect(() => verifyChecksum(text, expected, 'CORPUS')).not.toThrow();
    expect(() => verifyChecksum(`${text}changed`, expected, 'CORPUS')).toThrow('CORPUS_CHECKSUM_MISMATCH');
    expect(() => verifyChecksum(`${text}changed`, expected, 'JUDGMENT')).toThrow('JUDGMENT_CHECKSUM_MISMATCH');
    expect(() => verifyChecksum(`${text}changed`, expected, 'DATASET_MANIFEST')).toThrow('DATASET_MANIFEST_CHECKSUM_MISMATCH');
  });

  it('denies SEALED and adversarial before artifact arguments are inspected', () => {
    expect(() => parseEvaluationArgs(['--split=sealed'])).toThrow('SEALED_EVALUATION_DENIED');
    expect(() => parseEvaluationArgs(['--split=adversarial'])).toThrow('ADVERSARIAL_EVALUATION_DENIED');
    expect(() => parseEvaluationArgs(['--split=all'])).toThrow('DEV_SPLIT_REQUIRED');
  });

  it('rejects scaffold judgments and every mismatched immutable pin', () => {
    const corpus = [corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en')];
    const judgments = judgmentSet([judgment({ query_id: corpus[0]!.query_id })]);
    const dataset = manifest();
    expect(() => assertFrozenInputs(corpus, { ...judgments, status: 'SCAFFOLD_UNBOUND', records: [] }, dataset, pins()))
      .toThrow('EVAL_JUDGMENTS_BLOCKED');
    expect(() => assertFrozenInputs(corpus, judgments, { ...dataset, status: 'SCAFFOLD_UNBOUND' }, pins()))
      .toThrow('DATASET_MANIFEST_NOT_FROZEN');
    expect(() => assertFrozenInputs(corpus, judgments, dataset, { ...pins(), corpusChecksum: 'd'.repeat(64) }))
      .toThrow('CORPUS_CHECKSUM_MISMATCH');
    expect(() => assertFrozenInputs(corpus, judgments, {
      ...dataset, judgment: { ...dataset.judgment, checksum: 'd'.repeat(64) },
    }, pins())).toThrow('JUDGMENT_PIN_MISMATCH');
    expect(() => assertFrozenInputs(corpus, judgments, {
      ...dataset, canonical_dataset_version: 'other-dataset',
    }, pins())).toThrow('DATASET_VERSION_MISMATCH');
  });

  it('rejects non-DEV judgments, duplicate query judgments, and invalid grades', () => {
    const corpus = [
      corpusRecord('eval-v1-dev-known-01', 'canonical_exact_same_name', 'en'),
      { ...corpusRecord('eval-v1-adversarial-known-01', 'canonical_exact_same_name', 'en'), split: 'ADVERSARIAL' as const },
    ];
    const duplicate = judgment({ query_id: corpus[0]!.query_id });
    expect(() => assertFrozenInputs(corpus, judgmentSet([
      judgment({ query_id: corpus[1]!.query_id }),
    ]), manifest(), pins())).toThrow('NON_DEV_JUDGMENT_DENIED');
    expect(() => assertFrozenInputs(corpus, judgmentSet([duplicate, duplicate]), manifest(), pins()))
      .toThrow('DUPLICATE_JUDGMENT_QUERY');
    expect(() => assertFrozenInputs(corpus, judgmentSet([judgment({
      query_id: corpus[0]!.query_id,
      relevant: [{ entity_id: entityA, grade: 4 as never }],
    })]), manifest(), pins())).toThrow('INVALID_RELEVANCE_GRADE');
  });

  it('validates the immutable human-approved Day-2 judgment artifact', async () => {
    const root = new URL('../../', import.meta.url);
    const [text, expectedChecksum, manifestText, corpusText] = await Promise.all([
      readFile(new URL('evaluation/judgments/judgments.day2.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/judgments/judgments.day2.v1.sha256', root), 'utf8'),
      readFile(new URL('evaluation/manifests/dataset-manifest.day2.v1.json', root), 'utf8'),
      readFile(new URL('evaluation/corpus/corpus.v1.jsonl', root), 'utf8'),
    ]);
    expect(() => verifyChecksum(text, expectedChecksum, 'JUDGMENT')).not.toThrow();
    const approved = JSON.parse(text) as EvalJudgmentSetV1;
    const dataset = JSON.parse(manifestText) as EvalDatasetManifestV1;
    const corpus = corpusText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as EvalCorpusRecordV1);
    const grades = approved.records.flatMap(({ relevant }) => relevant.map(({ grade }) => grade));
    expect(approved.records).toHaveLength(14);
    expect(grades).toHaveLength(84);
    expect([0, 1, 2, 3].map((grade) => grades.filter((value) => value === grade).length))
      .toEqual([60, 15, 6, 3]);
    expect(approved.records.filter(
      ({ known_item_inventory_status }) => known_item_inventory_status === 'TARGET_NOT_IN_FROZEN_DATASET',
    )).toHaveLength(6);
    expect(() => assertFrozenInputs(corpus, approved, dataset, {
      corpusChecksum: approved.corpus_checksum,
      judgmentChecksum: expectedChecksum.trim(),
      manifestChecksum: approved.dataset_manifest_checksum!,
    })).not.toThrow();
  });
});

function corpusRecord(
  queryId: string,
  family: string,
  language: EvalCorpusRecordV1['language'],
  pairGroupId: string | null = null,
): EvalCorpusRecordV1 {
  return {
    query_id: queryId,
    corpus_version: 'corpus.v1',
    query: 'fixture query',
    family,
    split: 'DEV',
    language,
    pair_group_id: pairGroupId,
    ui_locale: 'en',
    scope: {
      scope_id: 'a4b19b09-b272-5748-80ef-2c91d9d33ca6',
      scope_slug: 'jonkoping-municipality',
      boundary_id: '0a39b199-4cd5-5358-85de-2c1a5f91a347',
      boundary_version: 'boundary.v1',
    },
    request_filters: {},
    evaluation_clock_utc: '2026-08-15T00:00:00Z',
    hard_constraints: ['fixture'],
    intended_assertions: ['fixture'],
    known_item_target: null,
    rationale: 'fixture',
    human_review_flags: [],
  };
}

function judgment(overrides: Partial<EvalJudgmentRecordV1> = {}): EvalJudgmentRecordV1 {
  return {
    judgment_version: 'judgments.dev.v1',
    query_id: 'eval-v1-dev-known-01',
    relevant: [{ entity_id: entityA, grade: 3 }],
    known_item_target: null,
    acceptable_taxonomy_node_ids: [],
    acceptable_group_keys: [],
    expected_protected_behavior: [],
    expected_ineligible_behavior: [],
    rationale: 'human fixture judgment',
    judged_by: 'fixture-human',
    judged_at: '2026-08-15T00:00:00Z',
    dataset_version: 'canonical.v1',
    taxonomy_checksum: checksumA,
    boundary_version: 'boundary.v1',
    ...overrides,
  };
}

function judgmentSet(records: EvalJudgmentRecordV1[]): EvalJudgmentSetV1 {
  return {
    judgment_version: 'judgments.dev.v1',
    status: 'FROZEN',
    split: 'DEV',
    corpus_version: 'corpus.v1',
    corpus_checksum: checksumA,
    dataset_version: 'canonical.v1',
    taxonomy_checksum: checksumA,
    boundary_version: 'boundary.v1',
    hard_constraint_policy: 'GRADE_0_REGARDLESS_OF_TEXT_SIMILARITY',
    records,
  };
}

function manifest(): EvalDatasetManifestV1 {
  return {
    manifest_version: 'dataset.v1',
    status: 'FROZEN',
    canonical_dataset_version: 'canonical.v1',
    source_record_ingestion_run_ids: ['20000000-0000-4000-8000-000000000001'],
    boundary: {
      id: '0a39b199-4cd5-5358-85de-2c1a5f91a347',
      version: 'boundary.v1',
      checksum: checksumA,
    },
    taxonomy: { version: 'active-going-out.v1', checksum: checksumA },
    normalization_version: 'norm-v1',
    search_documents: {
      template_version: 'search-document-v1',
      document_version: 'search-document-v1',
      hashes: [checksumA],
    },
    embedding: { provider: null, model: null, revision: null, dimension: null },
    search_config_version: 'search-config.v1',
    evaluation_clock_utc: '2026-08-15T00:00:00Z',
    corpus: { version: 'corpus.v1', checksum: checksumA },
    judgment: { version: 'judgments.dev.v1', checksum: checksumB },
    code_git_commit: '4f26f92',
  };
}

function pins() {
  return { corpusChecksum: checksumA, judgmentChecksum: checksumB, manifestChecksum: checksumC };
}

function diagnostic(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entityExists: true,
    eligible: true,
    reasonCodes: ['TOP_5'],
    stages: {},
    ...overrides,
  };
}
