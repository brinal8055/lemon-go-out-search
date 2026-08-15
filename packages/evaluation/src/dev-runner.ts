import { createHash } from 'node:crypto';

import type {
  EvalCorpusRecordV1,
  EvalDatasetManifestV1,
  EvalJudgmentRecordV1,
  EvalJudgmentSetV1,
  EvalLanguage,
} from './index.ts';

export type SearchResult = { canonicalId: string };
export type SearchExecution = (record: EvalCorpusRecordV1) => Promise<SearchResult[]>;
export type DiagnosticExecution = (
  record: EvalCorpusRecordV1,
  entityId: string,
) => Promise<Record<string, unknown>>;

type MetricName = 'hitAt1' | 'hitAt3' | 'mrr' | 'recallAt20' | 'precisionAt5' | 'ndcgAt5';
type QueryMetrics = Record<MetricName, number | null>;
type MetricSummary = { value: number | null; evaluatedQueries: number };
type Aggregate = {
  status: 'EVALUATED' | 'NOT_EVALUATED';
  queryCount: number;
  judgedQueryCount: number;
  zeroResultCount: number;
  zeroResultRate: number | null;
  inventoryUnavailableQueryCount: number;
  metrics: Record<MetricName, MetricSummary>;
  recallAt50: { status: 'NOT_REQUIRED'; value: null; evaluatedQueries: 0 };
};

export type FailureAttribution =
  | 'INVENTORY'
  | 'NORMALIZATION_ALIAS'
  | 'DEDUPE'
  | 'TAXONOMY'
  | 'DETERMINISTIC_INTERPRETATION'
  | 'CANDIDATE_RETRIEVAL'
  | 'SEMANTIC_REPRESENTATION'
  | 'FUSION_RANK'
  | 'ELIGIBILITY_EVENT_STATE'
  | 'UNSUPPORTED_CAPABILITY';

export type DevEvaluationReport = {
  reportVersion: 'dev-evaluation-report.v1';
  split: 'DEV';
  pins: {
    corpus: { version: string; checksum: string };
    judgments: { version: string; checksum: string };
    dataset: { version: string; checksum: string; inventoryChecksum: string | null; codeGitCommit: string };
    searchConfigVersion: string;
    taxonomy: { version: string; checksum: string };
    boundary: { version: string; checksum: string };
    evaluationClockUtc: string;
    searchDocuments: { templateVersion: string; documentVersion: string; hashes: string[] };
    model: { status: 'NOT_PARTICIPATING' };
  };
  capabilities: {
    deterministic: 'IMPLEMENTED';
    event: 'NOT_IMPLEMENTED';
    semantic: 'NOT_IMPLEMENTED';
    rrf: 'NOT_IMPLEMENTED';
    nonCollapse: 'NOT_IMPLEMENTED';
  };
  overall: Aggregate;
  byFamily: Record<string, Aggregate>;
  byLanguage: Record<string, Aggregate>;
  pairs: Array<{ pairGroupId: string; queryIds: string[] }>;
  queries: Array<{
    queryId: string;
    family: string;
    language: EvalLanguage;
    pairGroupId: string | null;
    topResultIds: string[];
    relevantEntityRanks: Array<{ entityId: string; grade: number; rank: number | null }>;
    metrics: QueryMetrics;
    inventoryUnavailable: boolean;
    productOutcome: 'QUERY_UNSATISFIED' | null;
    searchRankingAssessment: 'EVALUATED' | 'NOT_EVALUATED';
    failureAttribution: FailureAttribution | null;
  }>;
  failureAttributionSummary: Record<string, number>;
  contentChecksum: string;
};

export type EvaluationPins = {
  corpusChecksum: string;
  judgmentChecksum: string;
  manifestChecksum: string;
};

export type EvaluationCliArgs = {
  judgmentVersion: string;
  judgmentsPath: string;
  judgmentChecksumPath: string;
  manifestVersion: string;
  manifestPath: string;
  manifestChecksumPath: string;
  outputDirectory: string;
  edgeUrl: string;
};

export function parseEvaluationArgs(args: string[]): EvaluationCliArgs {
  const split = argumentValue(args, '--split');
  if (split === 'sealed') throw new Error('SEALED_EVALUATION_DENIED');
  if (split === 'adversarial') throw new Error('ADVERSARIAL_EVALUATION_DENIED');
  if (split !== 'dev') throw new Error('DEV_SPLIT_REQUIRED');
  return {
    judgmentVersion: requiredArgument(args, '--judgment-version'),
    judgmentsPath: requiredArgument(args, '--judgments'),
    judgmentChecksumPath: requiredArgument(args, '--judgment-checksum'),
    manifestVersion: requiredArgument(args, '--manifest-version'),
    manifestPath: requiredArgument(args, '--manifest'),
    manifestChecksumPath: requiredArgument(args, '--manifest-checksum'),
    outputDirectory: requiredArgument(args, '--output'),
    edgeUrl: requiredArgument(args, '--edge-url'),
  };
}

export async function evaluateDev(
  corpus: EvalCorpusRecordV1[],
  judgments: EvalJudgmentSetV1,
  manifest: EvalDatasetManifestV1,
  pins: EvaluationPins,
  search: SearchExecution,
  diagnose: DiagnosticExecution,
): Promise<DevEvaluationReport> {
  assertFrozenInputs(corpus, judgments, manifest, pins);
  const judgmentByQuery = new Map(judgments.records.map((record) => [record.query_id, record]));
  const evaluatedCorpus = corpus
    .filter((record) => judgmentByQuery.has(record.query_id))
    .sort((left, right) => left.query_id.localeCompare(right.query_id));
  const queries: DevEvaluationReport['queries'] = [];

  for (const record of evaluatedCorpus) {
    const judgment = judgmentByQuery.get(record.query_id)!;
    const topResultIds = (await search(record)).map(({ canonicalId }) => canonicalId).slice(0, 20);
    const queryMetrics = metricsFor(topResultIds, judgment);
    const relevantEntityRanks = judgment.relevant
      .filter(({ grade }) => grade > 0)
      .sort((left, right) => right.grade - left.grade || left.entity_id.localeCompare(right.entity_id))
      .map(({ entity_id: entityId, grade }) => ({
        entityId,
        grade,
        rank: rankOf(topResultIds, entityId),
      }));
    const inventoryUnavailable = judgment.known_item_inventory_status === 'TARGET_NOT_IN_FROZEN_DATASET';
    const diagnosticTarget = relevantEntityRanks.find(({ rank }) => rank === null || rank > 5);
    const failureAttribution = inventoryUnavailable
      ? 'INVENTORY'
      : diagnosticTarget
        ? classifyFailure(record, await diagnose(record, diagnosticTarget.entityId))
        : null;
    queries.push({
      queryId: record.query_id,
      family: record.family,
      language: record.language,
      pairGroupId: record.pair_group_id,
      topResultIds,
      relevantEntityRanks,
      metrics: queryMetrics,
      inventoryUnavailable,
      productOutcome: inventoryUnavailable ? 'QUERY_UNSATISFIED' : null,
      searchRankingAssessment: inventoryUnavailable ? 'NOT_EVALUATED' : 'EVALUATED',
      failureAttribution,
    });
  }

  const families = [...new Set(corpus.map(({ family }) => family))].sort();
  const languages = [...new Set(corpus.map(({ language }) => language))].sort();
  const reportWithoutChecksum = {
    reportVersion: 'dev-evaluation-report.v1' as const,
    split: 'DEV' as const,
    pins: {
      corpus: { version: 'corpus.v1', checksum: pins.corpusChecksum },
      judgments: { version: judgments.judgment_version, checksum: pins.judgmentChecksum },
      dataset: {
        version: manifest.manifest_version,
        checksum: pins.manifestChecksum,
        inventoryChecksum: manifest.dataset_inventory?.checksum ?? null,
        codeGitCommit: manifest.code_git_commit!,
      },
      searchConfigVersion: manifest.search_config_version!,
      taxonomy: manifest.taxonomy,
      boundary: { version: manifest.boundary.version, checksum: manifest.boundary.checksum },
      evaluationClockUtc: manifest.evaluation_clock_utc,
      searchDocuments: {
        templateVersion: manifest.search_documents.template_version!,
        documentVersion: manifest.search_documents.document_version!,
        hashes: [...manifest.search_documents.hashes].sort(),
      },
      model: { status: 'NOT_PARTICIPATING' as const },
    },
    capabilities: {
      deterministic: 'IMPLEMENTED' as const,
      event: 'NOT_IMPLEMENTED' as const,
      semantic: 'NOT_IMPLEMENTED' as const,
      rrf: 'NOT_IMPLEMENTED' as const,
      nonCollapse: 'NOT_IMPLEMENTED' as const,
    },
    overall: aggregate(queries, corpus.length),
    byFamily: Object.fromEntries(families.map((family) => [
      family,
      aggregate(
        queries.filter((query) => query.family === family),
        corpus.filter((record) => record.family === family).length,
      ),
    ])),
    byLanguage: Object.fromEntries(languages.map((language) => [
      language,
      aggregate(
        queries.filter((query) => query.language === language),
        corpus.filter((record) => record.language === language).length,
      ),
    ])),
    pairs: pairReport(queries),
    queries,
    failureAttributionSummary: failureSummary(queries),
  };
  return {
    ...reportWithoutChecksum,
    contentChecksum: sha256(stableJson(reportWithoutChecksum)),
  };
}

export function assertFrozenInputs(
  corpus: EvalCorpusRecordV1[],
  judgments: EvalJudgmentSetV1,
  manifest: EvalDatasetManifestV1,
  pins: EvaluationPins,
): void {
  if (judgments.split !== 'DEV') throw new Error(`${judgments.split}_EVALUATION_DENIED`);
  if (judgments.status !== 'FROZEN' || judgments.records.length === 0) throw new Error('EVAL_JUDGMENTS_BLOCKED');
  if (manifest.status !== 'FROZEN') throw new Error('DATASET_MANIFEST_NOT_FROZEN');
  if (judgments.corpus_checksum !== pins.corpusChecksum
    || manifest.corpus.checksum !== pins.corpusChecksum) throw new Error('CORPUS_CHECKSUM_MISMATCH');
  const judgmentPinnedByManifest = manifest.judgment.version === judgments.judgment_version
    && manifest.judgment.checksum === pins.judgmentChecksum;
  const judgmentPinsFrozenManifest = judgments.dataset_manifest_version === manifest.manifest_version
    && judgments.dataset_manifest_checksum === pins.manifestChecksum
    && judgments.dataset_inventory_checksum === manifest.dataset_inventory?.checksum;
  if (!judgmentPinnedByManifest && !judgmentPinsFrozenManifest) throw new Error('JUDGMENT_PIN_MISMATCH');
  if (judgments.dataset_version !== manifest.canonical_dataset_version) throw new Error('DATASET_VERSION_MISMATCH');
  if (judgments.taxonomy_checksum !== manifest.taxonomy.checksum) throw new Error('TAXONOMY_PIN_MISMATCH');
  if (judgments.boundary_version !== manifest.boundary.version) throw new Error('BOUNDARY_PIN_MISMATCH');
  for (const required of [
    manifest.canonical_dataset_version,
    manifest.normalization_version,
    manifest.search_config_version,
    manifest.search_documents.template_version,
    manifest.search_documents.document_version,
    manifest.code_git_commit,
  ]) {
    if (!required) throw new Error('DATASET_MANIFEST_INCOMPLETE');
  }
  if (manifest.source_record_ingestion_run_ids.length === 0
    || manifest.search_documents.hashes.length === 0) throw new Error('DATASET_MANIFEST_INCOMPLETE');
  if (Object.values(manifest.embedding).some((value) => value !== null)) {
    throw new Error('SEMANTIC_MODEL_MUST_NOT_PARTICIPATE');
  }
  const devIds = new Set(corpus.filter(({ split }) => split === 'DEV').map(({ query_id }) => query_id));
  const judgmentIds = new Set<string>();
  for (const record of judgments.records) {
    if (!devIds.has(record.query_id)) throw new Error('NON_DEV_JUDGMENT_DENIED');
    if (judgmentIds.has(record.query_id)) throw new Error('DUPLICATE_JUDGMENT_QUERY');
    judgmentIds.add(record.query_id);
    const corpusRecord = corpus.find(({ query_id }) => query_id === record.query_id)!;
    if (record.query_text !== undefined && record.query_text !== corpusRecord.query) {
      throw new Error('JUDGMENT_QUERY_TEXT_MISMATCH');
    }
    if (record.judgment_version !== judgments.judgment_version
      || record.dataset_version !== judgments.dataset_version
      || record.taxonomy_checksum !== judgments.taxonomy_checksum
      || record.boundary_version !== judgments.boundary_version) throw new Error('JUDGMENT_RECORD_PIN_MISMATCH');
    if (record.relevant.some(({ grade }) => ![0, 1, 2, 3].includes(grade))) {
      throw new Error('INVALID_RELEVANCE_GRADE');
    }
    if (new Set(record.relevant.map(({ entity_id }) => entity_id)).size !== record.relevant.length) {
      throw new Error('DUPLICATE_ENTITY_JUDGMENT');
    }
  }
  if (judgments.judgment_version === 'judgments.day2.v1') {
    const grades = judgments.records.flatMap(({ relevant }) => relevant.map(({ grade }) => grade));
    const gradeCounts = [0, 1, 2, 3].map((grade) => grades.filter((value) => value === grade).length);
    const inventoryUnavailable = judgments.records.filter(
      ({ known_item_inventory_status }) => known_item_inventory_status === 'TARGET_NOT_IN_FROZEN_DATASET',
    );
    if (judgments.records.length !== 14 || grades.length !== 84
      || gradeCounts.join(',') !== '60,15,6,3') throw new Error('DAY2_JUDGMENT_COUNTS_MISMATCH');
    if (judgments.selected_query_ids?.join(',') !== judgments.records.map(({ query_id }) => query_id).join(',')) {
      throw new Error('DAY2_SELECTED_QUERY_IDS_MISMATCH');
    }
    if (inventoryUnavailable.length !== 6 || inventoryUnavailable.some((record) => (
      record.primary_failure_attribution !== 'INVENTORY'
      || record.search_ranking_assessment !== 'NOT_EVALUATED'
      || record.known_item_target !== null
    ))) throw new Error('DAY2_INVENTORY_ATTRIBUTION_MISMATCH');
  }
}

export function metricsFor(resultIds: string[], judgment: EvalJudgmentRecordV1): QueryMetrics {
  const relevant = judgment.relevant.filter(({ grade }) => grade > 0);
  const knownRank = judgment.known_item_target ? rankOf(resultIds, judgment.known_item_target) : null;
  const relevantSet = new Set(relevant.map(({ entity_id }) => entity_id));
  const retrievedRelevant = resultIds.slice(0, 20).filter((id) => relevantSet.has(id)).length;
  const dcg = dcgAt5(resultIds, judgment);
  const idealDcg = [...relevant]
    .sort((left, right) => right.grade - left.grade || left.entity_id.localeCompare(right.entity_id))
    .slice(0, 5)
    .reduce((sum, item, index) => sum + gain(item.grade) / Math.log2(index + 2), 0);
  return {
    hitAt1: judgment.known_item_target ? Number(knownRank === 1) : null,
    hitAt3: judgment.known_item_target ? Number(knownRank !== null && knownRank <= 3) : null,
    mrr: judgment.known_item_target ? (knownRank === null ? 0 : 1 / knownRank) : null,
    recallAt20: relevant.length === 0 ? null : retrievedRelevant / relevant.length,
    precisionAt5: relevant.length === 0 ? null : resultIds.slice(0, 5).filter((id) => relevantSet.has(id)).length / 5,
    ndcgAt5: idealDcg === 0 ? null : dcg / idealDcg,
  };
}

export function classifyFailure(
  record: EvalCorpusRecordV1,
  diagnostic: Record<string, unknown>,
): FailureAttribution {
  if (diagnostic.entityExists === false) return 'INVENTORY';
  if (diagnostic.eligible === false) return 'ELIGIBILITY_EVENT_STATE';
  const reasonCodes = Array.isArray(diagnostic.reasonCodes) ? diagnostic.reasonCodes : [];
  if (reasonCodes.includes('OUTSIDE_TOP_5')) return 'FUSION_RANK';
  const stages = isRecord(diagnostic.stages) ? diagnostic.stages : {};
  if (record.family === 'event_time' && stageStatus(stages.event) === 'NOT_IMPLEMENTED') return 'UNSUPPORTED_CAPABILITY';
  if (record.family === 'semantic_occasion_language' && stageStatus(stages.semantic) === 'NOT_IMPLEMENTED') {
    return 'UNSUPPORTED_CAPABILITY';
  }
  if (record.family === 'taxonomy_parent_leaf' && stagePresent(stages.taxonomy) === false) return 'TAXONOMY';
  if (['canonical_exact_same_name', 'verified_colliding_aliases', 'typo_transposition_accent_spacing']
    .includes(record.family)) return 'NORMALIZATION_ALIAS';
  if (reasonCodes.includes('HARD_FILTERED_AFTER_UNION')) return 'ELIGIBILITY_EVENT_STATE';
  if (reasonCodes.includes('NOT_IN_CANDIDATE_UNION')) return 'CANDIDATE_RETRIEVAL';
  return 'DETERMINISTIC_INTERPRETATION';
}

export function stableJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

export function verifyChecksum(text: string, expected: string, artifact: string): void {
  if (sha256(text) !== expected.trim()) throw new Error(`${artifact}_CHECKSUM_MISMATCH`);
}

export function renderMarkdown(report: DevEvaluationReport): string {
  const metric = (name: MetricName) => formatMetric(report.overall.metrics[name]);
  const familyRows = Object.entries(report.byFamily)
    .map(([family, summary]) => `| ${family} | ${summary.status} | ${summary.judgedQueryCount} | ${formatMetric(summary.metrics.ndcgAt5)} |`)
    .join('\n');
  const languageRows = Object.entries(report.byLanguage)
    .map(([language, summary]) => `| ${language} | ${summary.status} | ${summary.judgedQueryCount} | ${formatMetric(summary.metrics.ndcgAt5)} |`)
    .join('\n');
  const queryRows = report.queries.map((query) => {
    const relevant = query.relevantEntityRanks
      .map(({ entityId, grade, rank }) => `${entityId}:g${grade}@${rank ?? 'MISS'}`)
      .join(', ');
    return `| ${query.queryId} | ${query.topResultIds.join(', ')} | ${relevant} | ${query.productOutcome ?? 'SATISFIED_OR_NOT_ASSERTED'} | ${query.searchRankingAssessment} | ${query.failureAttribution ?? 'NONE'} |`;
  }).join('\n');
  const failureRows = Object.entries(report.failureAttributionSummary)
    .map(([reason, count]) => `| ${reason} | ${count} |`)
    .join('\n') || '| NONE | 0 |';
  return `# Deterministic DEV evaluation\n\n`
    + `- Report: ${report.reportVersion}\n`
    + `- Corpus: ${report.pins.corpus.version} / ${report.pins.corpus.checksum}\n`
    + `- Judgments: ${report.pins.judgments.version} / ${report.pins.judgments.checksum}\n`
    + `- Dataset: ${report.pins.dataset.version} / ${report.pins.dataset.checksum}\n`
    + `- Search config: ${report.pins.searchConfigVersion}\n`
    + `- Evaluation clock: ${report.pins.evaluationClockUtc}\n`
    + `- Queries: ${report.overall.judgedQueryCount}\n`
    + `- Hit@1 / Hit@3 / MRR: ${metric('hitAt1')} / ${metric('hitAt3')} / ${metric('mrr')}\n`
    + `- Recall@20: ${metric('recallAt20')}\n`
    + `- Precision@5 / NDCG@5: ${metric('precisionAt5')} / ${metric('ndcgAt5')}\n`
    + `- Zero results: ${report.overall.zeroResultCount} / ${report.overall.judgedQueryCount}\n`
    + `- Inventory unavailable: ${report.overall.inventoryUnavailableQueryCount}\n`
    + `- Recall@50: NOT_REQUIRED\n\n`
    + `## Families\n\n| Family | Status | Queries | NDCG@5 |\n|---|---:|---:|---:|\n${familyRows}\n\n`
    + `## Languages\n\n| Language | Status | Queries | NDCG@5 |\n|---|---:|---:|---:|\n${languageRows}\n\n`
    + `## Queries\n\n| Query ID | Top result IDs | Relevant ranks | Product outcome | Ranking assessment | Failure attribution |\n|---|---|---|---|---|---|\n${queryRows}\n\n`
    + `## Failure attribution\n\n| Reason | Count |\n|---|---:|\n${failureRows}\n\n`
    + `Event, semantic, RRF, and non-collapse stages: NOT_IMPLEMENTED.\n`
    + `Content checksum: ${report.contentChecksum}\n`;
}

function aggregate(queries: DevEvaluationReport['queries'], queryCount: number): Aggregate {
  const metricNames: MetricName[] = ['hitAt1', 'hitAt3', 'mrr', 'recallAt20', 'precisionAt5', 'ndcgAt5'];
  return {
    status: queries.length > 0 ? 'EVALUATED' : 'NOT_EVALUATED',
    queryCount,
    judgedQueryCount: queries.length,
    zeroResultCount: queries.filter(({ topResultIds }) => topResultIds.length === 0).length,
    zeroResultRate: queries.length === 0
      ? null
      : queries.filter(({ topResultIds }) => topResultIds.length === 0).length / queries.length,
    inventoryUnavailableQueryCount: queries.filter(({ inventoryUnavailable }) => inventoryUnavailable).length,
    metrics: Object.fromEntries(metricNames.map((name) => {
      const values = queries.map(({ metrics }) => metrics[name]).filter((value): value is number => value !== null);
      return [name, { value: values.length === 0 ? null : mean(values), evaluatedQueries: values.length }];
    })) as Record<MetricName, MetricSummary>,
    recallAt50: { status: 'NOT_REQUIRED', value: null, evaluatedQueries: 0 },
  };
}

function pairReport(queries: DevEvaluationReport['queries']): DevEvaluationReport['pairs'] {
  const groups = new Map<string, string[]>();
  for (const query of queries) {
    if (!query.pairGroupId) continue;
    groups.set(query.pairGroupId, [...(groups.get(query.pairGroupId) ?? []), query.queryId]);
  }
  return [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([pairGroupId, queryIds]) => ({
    pairGroupId,
    queryIds: queryIds.sort(),
  }));
}

function failureSummary(queries: DevEvaluationReport['queries']): Record<string, number> {
  const counts = new Map<string, number>();
  for (const { failureAttribution } of queries) {
    if (failureAttribution) counts.set(failureAttribution, (counts.get(failureAttribution) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)));
}

function dcgAt5(resultIds: string[], judgment: EvalJudgmentRecordV1): number {
  const grades = new Map(judgment.relevant.map(({ entity_id, grade }) => [entity_id, grade]));
  return resultIds.slice(0, 5).reduce((sum, id, index) => sum + gain(grades.get(id) ?? 0) / Math.log2(index + 2), 0);
}

function gain(grade: number): number {
  return (2 ** grade) - 1;
}

function rankOf(resultIds: string[], entityId: string): number | null {
  const index = resultIds.indexOf(entityId);
  return index === -1 ? null : index + 1;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stageStatus(value: unknown): unknown {
  return isRecord(value) ? value.status : null;
}

function stagePresent(value: unknown): unknown {
  return isRecord(value) ? value.present : null;
}

function formatMetric(metric: MetricSummary): string {
  return metric.value === null ? 'NOT_EVALUATED' : metric.value.toFixed(4);
}

function requiredArgument(args: string[], name: string): string {
  const value = argumentValue(args, name);
  if (!value) throw new Error(`${name.slice(2).replaceAll('-', '_').toUpperCase()}_REQUIRED`);
  return value;
}

function argumentValue(args: string[], name: string): string | null {
  const equals = args.find((argument) => argument.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1) || null;
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
}
