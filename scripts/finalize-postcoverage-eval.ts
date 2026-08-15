import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import { stableJson } from '../packages/evaluation/src/dev-runner.ts';

const root = new URL('../', import.meta.url);
const reportRoot = 'evaluation/reports/day4-postcoverage-v2';
const files = {
  manifest: 'evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json',
  manifestChecksum: 'evaluation/manifests/dataset-manifest.day4-postcoverage.v2.sha256',
  judgments: 'evaluation/judgments/judgments.day4-postcoverage.v1.json',
  judgmentChecksum: 'evaluation/judgments/judgments.day4-postcoverage.v1.sha256',
  lexical: `${reportRoot}/lexical-only/dev-result.v1.json`,
  hybrid: `${reportRoot}/hybrid-fingerprinted-baseline-v2/dev-result.v1.json`,
  hybridOperational: `${reportRoot}/hybrid-fingerprinted-baseline-v2/operational.v1.json`,
  hybridStatus: `${reportRoot}/hybrid-fingerprinted-baseline-v2/run-status.v1.json`,
  rerunJournal: `${reportRoot}/hybrid-fingerprinted-rerun-v2/operational-journal.v1.jsonl`,
  rerunStatus: `${reportRoot}/hybrid-fingerprinted-rerun-v2/run-status.v1.json`,
} as const;
const text = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => (
  [key, await readFile(new URL(file, root), 'utf8')]
)))) as Record<keyof typeof files, string>;
const manifest = JSON.parse(text.manifest) as Manifest;
const judgments = JSON.parse(text.judgments) as Judgments;
const lexical = JSON.parse(text.lexical) as EvaluationResult;
const hybrid = JSON.parse(text.hybrid) as EvaluationResult;
const hybridOperational = JSON.parse(text.hybridOperational) as Operational;
const hybridStatus = JSON.parse(text.hybridStatus) as RunStatus;
const rerunStatus = JSON.parse(text.rerunStatus) as RunStatus;
const rerunAttempts = text.rerunJournal.trim().split('\n').map((line) => JSON.parse(line) as JournalRecord)
  .filter((record): record is ProviderAttempt => record.recordType === 'PROVIDER_ATTEMPT');
const failedAttempt = rerunAttempts.at(-1);

assert(sha256(text.manifest) === text.manifestChecksum.trim(), 'MANIFEST_CHECKSUM_MISMATCH');
assert(sha256(text.judgments) === text.judgmentChecksum.trim(), 'JUDGMENT_CHECKSUM_MISMATCH');
assert(manifest.manifest_version === 'dataset-manifest.day4-postcoverage.v2', 'MANIFEST_VERSION_MISMATCH');
assert(judgments.judgment_version === 'judgments.day4-postcoverage.v1' && judgments.records.length === 60, 'JUDGMENT_VERSION_MISMATCH');
assert(lexical.overall.queryCount === 60 && hybrid.overall.queryCount === 60, 'FULL_DEV_REQUIRED');
assert(hybridOperational.providerAttemptCount === 26 && hybridOperational.providerSuccessCount === 26
  && hybridOperational.providerDegradationCount === 0, 'VALID_HYBRID_BASELINE_REQUIRED');
assert(hybridStatus.status === 'COMPLETED' && hybridStatus.validForQualityMetrics, 'HYBRID_STATUS_INVALID');
assert(rerunStatus.status === 'FAILED' && !rerunStatus.validForQualityMetrics, 'RERUN_STATUS_INVALID');
assert(failedAttempt?.queryId === 'eval-v1-dev-semantic-occasion-language-02'
  && failedAttempt.httpStatus === 200 && failedAttempt.providerElapsedMs > 700, 'RERUN_FAILURE_EVIDENCE_INVALID');
assert(hybrid.heldOutGuard.sealed_queries_executed === 0
  && hybrid.heldOutGuard.adversarial_queries_executed === 0
  && !hybrid.heldOutGuard.sealed_or_adversarial_judgments_loaded, 'HELD_OUT_GUARD_FAILED');

const reportWithoutChecksum = {
  reportVersion: 'postcoverage-eval-comparison.v1',
  task: 'POSTCOV-EVAL-01',
  status: 'SEARCH_QUALITY_EVALUATION_COMPLETE',
  pins: {
    manifest: { version: manifest.manifest_version, checksum: text.manifestChecksum.trim(), inventoryChecksum: manifest.dataset_inventory.checksum },
    judgments: { version: judgments.judgment_version, checksum: text.judgmentChecksum.trim() },
    config: hybrid.pins.config,
    evaluationClockUtc: hybrid.pins.evaluationClockUtc,
  },
  relevanceQualityEvidence: {
    lexicalOnly: evidence(lexical),
    validFreshHybridBaseline: evidence(hybrid),
    excludedIncompleteHybridRerun: {
      status: rerunStatus.status,
      validForQualityMetrics: rerunStatus.validForQualityMetrics,
      lastCompletedQueryId: rerunStatus.lastCompletedQueryId,
      failedQueryId: failedAttempt.queryId,
      providerCallOrdinal: failedAttempt.providerCallOrdinal,
      providerElapsedMs: failedAttempt.providerElapsedMs,
      httpStatus: failedAttempt.httpStatus,
      rawRedactedCategory: failedAttempt.providerErrorCategory,
      exclusion: 'OPERATIONAL_RELIABILITY_EVIDENCE_ONLY',
    },
  },
  lexicalToHybrid: {
    knownItem: comparison(lexical.knownItem, hybrid.knownItem),
    overall: comparison(lexical.overall, hybrid.overall),
    en: comparison(lexical.byLanguage.en, hybrid.byLanguage.en),
    sv: comparison(lexical.byLanguage.sv, hybrid.byLanguage.sv),
    semanticOccasionLanguage: comparison(lexical.semanticFamily.overall, hybrid.semanticFamily.overall),
    broadDiscovery: comparison(lexical.byFamily.broad_discovery, hybrid.byFamily.broad_discovery),
    broadConcentration: comparison(lexical.byFamily.broad_concentration, hybrid.byFamily.broad_concentration),
    failureAttribution: { lexical: lexical.failureAttribution, hybrid: hybrid.failureAttribution },
    nonCollapse: {
      lexical: { movedCount: lexical.broadNonCollapse.movedCount, clearlyWeakerPromotionCount: lexical.broadNonCollapse.clearlyWeakerPromotionCount },
      hybrid: { movedCount: hybrid.broadNonCollapse.movedCount, clearlyWeakerPromotionCount: hybrid.broadNonCollapse.clearlyWeakerPromotionCount },
    },
  },
  qualityAssessment: {
    semanticRetrievalLift: 'MEASURABLE',
    knownItemRegression: 'NONE_OBSERVED',
    hybridReducedZeroResults: hybrid.overall.zeroResultCount < lexical.overall.zeroResultCount,
    rrfOrNonCollapseRegression: 'NONE_OBSERVED',
    topRemainingFailures: [
      'Six Event/time queries are ineligible at the frozen clock: EVENT_DEV_REAL_INVENTORY_UNAVAILABLE_AT_FROZEN_CLOCK.',
      'Semantic occasion/language budget pair (07/08) is gated as CONSERVATIVE_KNOWN_ITEM and returns no candidates.',
      'Broad concentration has three zero-result queries, two CANDIDATE_RETRIEVAL and one ELIGIBILITY.',
    ],
  },
  determinism: {
    internalSearchDeterminism: 'PASS',
    internalEvidence: [
      'Lexical stages deterministic.',
      'Selected document embeddings frozen and identical.',
      'Semantic SQL is deterministic for the same in-memory query vector.',
      'RRF and non-collapse are deterministic.',
    ],
    endToEndSemanticProviderRepeatability: 'NOT_ESTABLISHED',
    providerReliabilityFinding: 'VOYAGE_REQUEST_TIME_RELIABILITY_RISK',
    latestHttp200Failure: {
      classification: 'PROVIDER_DEADLINE_DURING_RESPONSE_BODY_CONSUMPTION',
      confidence: 'CODE_PATH_AND_TIMING_SUPPORTED',
      explanation: 'The evaluator observed HTTP 200 only after fetch resolved headers. Later JSON/schema failures are explicitly wrapped, while response.text() may surface an AbortError outside that wrapper. The failed call lasted 708.95 ms under AbortSignal.timeout(700).',
      evidenceLimit: 'The failed historical journal retained no raw exception name, so this is not a raw-error-proof attribution.',
    },
    carryForward: 'Successful zero-degradation full runs are possible, but repeated request-time runs are not consistently reliable. Characterize this in QA-01/PERF-01 without changing the frozen Voyage/voyage-4/1024/700ms contract.',
  },
  tuningDecision: {
    decision: 'BOUNDED_TUNING_JUSTIFIED',
    candidates: [{
      seam: 'shouldEmbed conservative-known-item classification',
      observedFailure: 'Semantic occasion/language 07/08 are non-embedded, zero-result CANDIDATE_RETRIEVAL queries.',
      expectedGain: 'Permit semantic retrieval for clearly multi-token occasion queries without weakening protected exact behavior.',
      regressionRisk: 'More provider calls and exposure to the documented request-time reliability risk; protected exact behavior must remain unchanged.',
    }],
    implementation: 'NOT_PERFORMED',
  },
  providerOperationalEvidence: {
    contract: 'Voyage / voyage-4 / voyage-4-preflight-v1 / 1024 / input_type=query / timeout=700ms',
    pacing: hybridOperational.providerPacing,
    freshBaseline: { providerCalls: hybridOperational.providerAttemptCount, successes: hybridOperational.providerSuccessCount, degradationCount: hybridOperational.providerDegradationCount },
    probes: { successes: 3, elapsedMs: [442, 417, 399] },
  },
  eventTime: 'EVENT_DEV_REAL_INVENTORY_UNAVAILABLE_AT_FROZEN_CLOCK',
  guards: { sealedAccess: 'NO_ACCESS', adversarialAccess: 'NO_ACCESS', specChangeRequired: 'NONE' },
};
const report = { ...reportWithoutChecksum, contentChecksum: sha256(stableJson(reportWithoutChecksum)) };
const json = `${stableJson(report)}\n`;
const jsonChecksum = sha256(json);
const outputJson = resolve(new URL(`${reportRoot}/comparison.v1.json`, root).pathname);
const outputMarkdown = resolve(new URL(`${reportRoot}/comparison.v1.md`, root).pathname);
const outputChecksum = resolve(new URL(`${reportRoot}/comparison.v1.sha256`, root).pathname);
await mkdir(dirname(outputJson), { recursive: true });
await Promise.all([
  writeFile(outputJson, json, { flag: 'wx' }),
  writeFile(outputMarkdown, markdown(report), { flag: 'wx' }),
  writeFile(outputChecksum, `${jsonChecksum}\n`, { flag: 'wx' }),
]);
console.log(JSON.stringify({ comparison: `${reportRoot}/comparison.v1.json`, checksum: jsonChecksum, contentChecksum: report.contentChecksum }, null, 2));

type Metric = { value: number | null; evaluatedQueries: number };
type Summary = { queryCount: number; zeroResultCount: number; metrics: Record<string, Metric> };
type EvaluationResult = {
  contentChecksum: string;
  pins: { config: unknown; evaluationClockUtc: string };
  heldOutGuard: { sealed_queries_executed: number; adversarial_queries_executed: number; sealed_or_adversarial_judgments_loaded: boolean };
  overall: Summary;
  knownItem: Record<string, Metric>;
  byLanguage: Record<string, Summary>;
  byFamily: Record<string, Summary>;
  semanticFamily: { overall: Summary };
  broadNonCollapse: { movedCount: number; clearlyWeakerPromotionCount: number };
  failureAttribution: Record<string, number>;
};
type Manifest = { manifest_version: string; dataset_inventory: { checksum: string } };
type Judgments = { judgment_version: string; records: unknown[] };
type Operational = { providerAttemptCount: number; providerSuccessCount: number; providerDegradationCount: number; providerPacing: unknown };
type RunStatus = { status: string; validForQualityMetrics: boolean; lastCompletedQueryId: string | null };
type ProviderAttempt = { recordType: 'PROVIDER_ATTEMPT'; queryId: string; providerCallOrdinal: number; providerElapsedMs: number; httpStatus: number | null; providerErrorCategory: string | null };
type JournalRecord = ProviderAttempt | { recordType: 'SEARCH_OUTCOME' };

function evidence(result: EvaluationResult) {
  return {
    contentChecksum: result.contentChecksum,
    knownItem: result.knownItem,
    overall: result.overall,
    en: result.byLanguage.en,
    sv: result.byLanguage.sv,
    semanticOccasionLanguage: result.semanticFamily.overall,
    broadDiscovery: result.byFamily.broad_discovery,
    broadConcentration: result.byFamily.broad_concentration,
    failureAttribution: result.failureAttribution,
  };
}

function comparison(left: Summary | Record<string, Metric>, right: Summary | Record<string, Metric>) {
  const leftMetrics = 'metrics' in left ? left.metrics : left;
  const rightMetrics = 'metrics' in right ? right.metrics : right;
  return {
    lexical: { metrics: leftMetrics, zeroResultCount: 'zeroResultCount' in left ? left.zeroResultCount : null },
    hybrid: { metrics: rightMetrics, zeroResultCount: 'zeroResultCount' in right ? right.zeroResultCount : null },
    delta: Object.fromEntries(Object.keys(rightMetrics).map((name) => [name, difference(rightMetrics[name]?.value ?? null, leftMetrics[name]?.value ?? null)])),
    zeroResultDelta: 'zeroResultCount' in left && 'zeroResultCount' in right ? right.zeroResultCount - left.zeroResultCount : null,
  };
}

function difference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function markdown(report: typeof reportWithoutChecksum & { contentChecksum: string }): string {
  const all = report.lexicalToHybrid;
  const display = (item: ReturnType<typeof comparison>) => {
    const metrics = ['recallAt20', 'precisionAt5', 'ndcgAt5'].map((name) => `${name} ${value(item.lexical.metrics[name])} → ${value(item.hybrid.metrics[name])}`).join('; ');
    return `${metrics}; zero ${item.lexical.zeroResultCount} → ${item.hybrid.zeroResultCount}`;
  };
  return `# Post-Coverage DEV Quality Evidence\n\n`
    + `Status: ${report.status}\n\n`
    + `- Dataset: ${report.pins.manifest.version} / ${report.pins.manifest.checksum}\n`
    + `- Judgments: ${report.pins.judgments.version} / ${report.pins.judgments.checksum}\n`
    + `- Evaluation clock: ${report.pins.evaluationClockUtc}\n`
    + `- Quality evidence: lexical 60/60 and fresh Hybrid baseline 60/60. Failed reruns are excluded from relevance metrics.\n\n`
    + `## Lexical → valid Hybrid\n\n`
    + `- Known item Hit@1 / Hit@3 / MRR: ${value(all.knownItem.lexical.metrics.hitAt1)} / ${value(all.knownItem.lexical.metrics.hitAt3)} / ${value(all.knownItem.lexical.metrics.mrr)} → ${value(all.knownItem.hybrid.metrics.hitAt1)} / ${value(all.knownItem.hybrid.metrics.hitAt3)} / ${value(all.knownItem.hybrid.metrics.mrr)}\n`
    + `- Overall: ${display(all.overall)}\n`
    + `- EN: ${display(all.en)}\n`
    + `- SV: ${display(all.sv)}\n`
    + `- Semantic occasion/language: ${display(all.semanticOccasionLanguage)}\n`
    + `- Broad discovery: ${display(all.broadDiscovery)}\n`
    + `- Broad concentration: ${display(all.broadConcentration)}\n`
    + `- Non-collapse moves/promotions: ${all.nonCollapse.hybrid.movedCount}/${all.nonCollapse.hybrid.clearlyWeakerPromotionCount}.\n\n`
    + `## Determinism and reliability\n\n`
    + `- INTERNAL_SEARCH_DETERMINISM: PASS.\n`
    + `- END_TO_END_SEMANTIC_PROVIDER_REPEATABILITY: NOT_ESTABLISHED.\n`
    + `- HTTP-200 failure: ${report.determinism.latestHttp200Failure.classification}; ${report.determinism.latestHttp200Failure.explanation}\n`
    + `- ${report.determinism.latestHttp200Failure.evidenceLimit}\n`
    + `- ${report.determinism.providerReliabilityFinding}: ${report.determinism.carryForward}\n\n`
    + `## Decision\n\n`
    + `Semantic retrieval provides measurable lift without known-item or non-collapse regression. ${report.tuningDecision.decision}; ${report.tuningDecision.candidates[0].seam} is the single proposed candidate and is not implemented.\n\n`
    + `Event/time remains ${report.eventTime}. SEALED and adversarial were not accessed. SPEC_CHANGE_REQUIRED: NONE.\n\n`
    + `Content checksum: ${report.contentChecksum}\n`;
}

function value(metric: Metric | undefined): string {
  return metric?.value === null || metric === undefined ? 'N/A' : metric.value.toFixed(6);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
