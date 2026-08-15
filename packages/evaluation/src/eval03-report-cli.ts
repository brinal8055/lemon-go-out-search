import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const reportRoot = 'evaluation/reports/eval-03-baseline.v1/';
const inputs = {
  manifest: 'evaluation/manifests/dataset-manifest.day3-current.v2.json',
  manifestChecksum: 'evaluation/manifests/dataset-manifest.day3-current.v2.sha256',
  judgments: 'evaluation/judgments/judgments.day3.v1.json',
  judgmentsChecksum: 'evaluation/judgments/judgments.day3.v1.sha256',
  hybridLegacy: `${reportRoot}hybrid-run-1/dev-result.v1.json`,
  hybrid1Operational: `${reportRoot}hybrid-run-1/operational.v1.json`,
  lexicalLegacy: `${reportRoot}lexical-run-1/dev-result.v1.json`,
  lexical1Operational: `${reportRoot}lexical-run-1/operational.v1.json`,
  hybrid: `${reportRoot}hybrid-run-2/dev-result.v1.json`,
  hybridOperational: `${reportRoot}hybrid-run-2/operational.v1.json`,
  hybridRerun: `${reportRoot}hybrid-run-3/dev-result.v1.json`,
  hybridRerunOperational: `${reportRoot}hybrid-run-3/operational.v1.json`,
  lexical: `${reportRoot}lexical-run-2/dev-result.v1.json`,
  lexicalOperational: `${reportRoot}lexical-run-2/operational.v1.json`,
} as const;
const outputJson = `${reportRoot}eval-03-report.v1.json`;
const outputMarkdown = `${reportRoot}eval-03-report.v1.md`;
const outputChecksum = `${reportRoot}eval-03-report.v1.sha256`;
const artifactChecksums = `${reportRoot}artifacts.v1.sha256`;

const texts = Object.fromEntries(await Promise.all(Object.entries(inputs).map(async ([key, path]) => (
  [key, await readFile(new URL(path, root), 'utf8')]
)))) as Record<keyof typeof inputs, string>;
const manifest = JSON.parse(texts.manifest);
const judgments = JSON.parse(texts.judgments);
const hybrid = JSON.parse(texts.hybrid);
const hybridRerun = JSON.parse(texts.hybridRerun);
const lexical = JSON.parse(texts.lexical);
const operationalRuns = [
  ['hybrid-run-1', JSON.parse(texts.hybrid1Operational)],
  ['hybrid-run-2', JSON.parse(texts.hybridOperational)],
  ['hybrid-run-3', JSON.parse(texts.hybridRerunOperational)],
  ['lexical-run-1', JSON.parse(texts.lexical1Operational)],
  ['lexical-run-2', JSON.parse(texts.lexicalOperational)],
] as const;

assert(sha256(texts.manifest) === texts.manifestChecksum.trim(), 'MANIFEST_CHECKSUM_MISMATCH');
assert(sha256(texts.judgments) === texts.judgmentsChecksum.trim(), 'JUDGMENT_CHECKSUM_MISMATCH');
assert(manifest.manifest_version === 'dataset-manifest.day3-current.v2', 'MANIFEST_VERSION_MISMATCH');
assert(manifest.dataset_inventory.checksum === 'aab903847c5fcfd840fe3285601d8da44d7596b5b985a2200de4f0a886b2e1fb', 'INVENTORY_CHECKSUM_MISMATCH');
assert(judgments.judgment_version === 'judgments.day3.v1' && judgments.records.length === 60, 'JUDGMENT_VERSION_MISMATCH');
assert(judgments.dataset_manifest_checksum === texts.manifestChecksum.trim(), 'JUDGMENT_MANIFEST_PIN_MISMATCH');
assert(hybrid.overall.queryCount === 60 && lexical.overall.queryCount === 60, 'FULL_DEV_REQUIRED');
assert(JSON.stringify(hybrid) === JSON.stringify(hybridRerun), 'DETERMINISM_MISMATCH');
assert(hybrid.heldOutGuard.sealed_queries_executed === 0
  && hybrid.heldOutGuard.adversarial_queries_executed === 0
  && hybrid.heldOutGuard.sealed_or_adversarial_judgments_loaded === false, 'HELD_OUT_GUARD_FAILED');
const rankingsMatch = hybrid.queries.every((record: { queryId: string; topResultIds: string[] }, index: number) => {
  const comparison = lexical.queries[index];
  return comparison?.queryId === record.queryId
    && JSON.stringify(comparison.topResultIds) === JSON.stringify(record.topResultIds);
});
const metricsMatch = JSON.stringify(hybrid.overall.metrics) === JSON.stringify(lexical.overall.metrics)
  && JSON.stringify(hybrid.byLanguage) === JSON.stringify(lexical.byLanguage)
  && JSON.stringify(hybrid.semanticFamily) === JSON.stringify(lexical.semanticFamily);
assert(rankingsMatch && metricsMatch, 'LEXICAL_HYBRID_COMPARISON_MISMATCH');

const reportWithoutChecksum = {
  reportVersion: 'eval-03-day3-gate-d.v1',
  status: 'COMPLETE',
  task: 'EVAL-03',
  pins: hybrid.pins,
  judgment: {
    version: judgments.judgment_version,
    checksum: texts.judgmentsChecksum.trim(),
    status: judgments.status,
    reviewedDevQueries: judgments.records.length,
    datasetManifestVersion: judgments.dataset_manifest_version,
    datasetManifestChecksum: judgments.dataset_manifest_checksum,
    datasetInventoryChecksum: judgments.dataset_inventory_checksum,
    approval: judgments.approval,
  },
  inventoryAtClock: {
    evaluationClockUtc: manifest.evaluation_clock_utc,
    eligiblePlaces: [{
      canonicalEntityId: 'ddcca624-5540-47b3-8309-ca771e5e29b7',
      canonicalName: 'Evergreen Restaurang & Pizzeria',
    }],
    eligibleEventCount: 0,
    expiredLegitimateEventCount: 1,
    compatibleReadyEmbeddingCount: 0,
    inventoryChecksum: manifest.dataset_inventory.checksum,
  },
  engineeringCorrectness: {
    assessment: 'SUPPORTED_BY_ACCEPTED_AUTOMATED_AND_FIXTURE_TESTS',
    acceptedRuntimeGates: ['EVENT-01', 'SEM-01', 'RANK-01', 'NONCOLLAPSE-01', 'MOB-03'],
    knownTestStateNoise: 'MOB-03: 260 full-suite PASS; 2 documented reconstructed-local-DB state failures',
  },
  searchQuality: {
    confidence: 'LOW_NOT_YET_ESTABLISHED',
    reason: 'The clean v2 corpus contains only one eligible Place at the frozen evaluation clock.',
    interpretation: 'Sparse metrics are inventory-dominated and are not evidence that the accepted ranking configuration is bad.',
    deferredValidation: 'SEARCH_QUALITY_CONFIDENCE_DEFERRED_TO_POST_COVERAGE_DEV_REVALIDATION',
  },
  configSelection: {
    evaluated: ['eval-03-baseline.v1'],
    selected: 'eval-03-baseline.v1',
    rejected: [],
    tuningPerformed: false,
    decision: 'DEV_TUNING_NOT_MEANINGFUL_DUE_TO_INSUFFICIENT_INVENTORY',
    reason: 'Changing configuration on this corpus would be overfitting/noise; the simpler accepted baseline is retained.',
    finalEval04Freeze: false,
  },
  fullDevHybrid: {
    overall: hybrid.overall,
    knownItem: hybrid.knownItem,
    byFamily: hybrid.byFamily,
    byLanguage: hybrid.byLanguage,
    semanticFamily: hybrid.semanticFamily,
    eventTime: hybrid.eventTime,
    broadNonCollapse: hybrid.broadNonCollapse,
    pairComparison: hybrid.pairComparison,
    failureAttribution: hybrid.failureAttribution,
    semanticCandidateCount: hybrid.semanticCandidateCount,
  },
  lexicalOnlyVsHybrid: {
    sameManifest: hybrid.pins.dataset.manifestChecksum === lexical.pins.dataset.manifestChecksum,
    sameJudgments: hybrid.pins.judgments.checksum === lexical.pins.judgments.checksum,
    sameClock: hybrid.pins.evaluationClockUtc === lexical.pins.evaluationClockUtc,
    rankedIdsMatchAll60: rankingsMatch,
    overallAndLanguageMetricsMatch: metricsMatch,
    metricDelta: {
      recallAt20: difference(hybrid.overall.metrics.recallAt20.value, lexical.overall.metrics.recallAt20.value),
      precisionAt5: difference(hybrid.overall.metrics.precisionAt5.value, lexical.overall.metrics.precisionAt5.value),
      ndcgAt5: difference(hybrid.overall.metrics.ndcgAt5.value, lexical.overall.metrics.ndcgAt5.value),
    },
    semanticFamilyMetricDelta: {
      enRecallAt20: difference(hybrid.semanticFamily.en.metrics.recallAt20.value, lexical.semanticFamily.en.metrics.recallAt20.value),
      svRecallAt20: difference(hybrid.semanticFamily.sv.metrics.recallAt20.value, lexical.semanticFamily.sv.metrics.recallAt20.value),
    },
    measuredSemanticLift: 0,
    interpretation: 'No meaningful semantic lift can be measured because the manifest has no compatible READY document embeddings and only one eligible Place.',
  },
  determinism: {
    hybridRun: 'hybrid-run-2',
    exactRerun: 'hybrid-run-3',
    rankedIdsAndMetricsMatch: true,
    byteIdenticalDeterministicResult: true,
    contentChecksum: hybrid.contentChecksum,
    operationalTimingExcluded: true,
  },
  operationalEvidence: operationalRuns.map(([run, operational]) => ({
    run,
    mode: operational.mode,
    providerConfigured: operational.providerConfigured,
    providerDegradationCount: operational.providerDegradationCount,
    providerAttemptCount: operational.providerAttemptCount,
    providerSuccessCount: operational.providerSuccessCount,
    databaseLatencyMs: operational.databaseLatencyMs,
    requestLatencyMs: operational.requestLatencyMs,
  })),
  preservedInspectedResultVersions: [
    inputs.hybridLegacy,
    inputs.lexicalLegacy,
    inputs.hybrid,
    inputs.hybridRerun,
    inputs.lexical,
  ],
  nextValidation: {
    after: 'COVERAGE-01',
    requirements: [
      'NEW_IMMUTABLE_DATASET_MANIFEST',
      'NEW_JUDGMENT_VERSION_TIED_TO_THAT_MANIFEST',
      'FULL_60_DEV_RERUN_BEFORE_FINAL_EVAL_04_FREEZE',
    ],
  },
  guards: {
    sealedAccess: 'NO_ACCESS',
    adversarialAccess: 'NO_ACCESS',
    parsedSplits: ['DEV'],
  },
  scopeAudit: {
    judgmentMutationAfterInspection: false,
    datasetMutationInPlace: false,
    tuningOrGridSearch: false,
    sourceAcquisitionOrManualEntityInsertion: false,
    newRetrieverProviderModelOrAnn: false,
    weightedOrLearnedFusion: false,
    mobileOrRuntimeChanges: false,
    coverage01Work: false,
    specChangeRequired: 'NONE',
  },
};
const contentChecksum = sha256(stableJson(reportWithoutChecksum));
const report = { ...reportWithoutChecksum, contentChecksum };
const jsonText = `${stableJson(report)}\n`;
const markdownText = markdown(report);
const outputFileChecksum = sha256(jsonText);
const artifactChecksumText = Object.values(inputs)
  .map((path) => `${sha256(texts[keyForPath(path)])}  ${path}`)
  .sort()
  .join('\n') + '\n';
await Promise.all([
  writeFile(new URL(outputJson, root), jsonText, { flag: 'wx' }),
  writeFile(new URL(outputMarkdown, root), markdownText, { flag: 'wx' }),
  writeFile(new URL(outputChecksum, root), `${outputFileChecksum}\n`, { flag: 'wx' }),
  writeFile(new URL(artifactChecksums, root), artifactChecksumText, { flag: 'wx' }),
]);
console.log(JSON.stringify({
  report: outputJson,
  reportChecksum: outputFileChecksum,
  contentChecksum,
  deterministicResultChecksum: hybrid.contentChecksum,
  devQueries: hybrid.overall.queryCount,
  selectedConfig: report.configSelection.selected,
}, null, 2));

function keyForPath(path: string): keyof typeof inputs {
  const entry = Object.entries(inputs).find(([, inputPath]) => inputPath === path);
  if (!entry) throw new Error(`UNKNOWN_INPUT_PATH:${path}`);
  return entry[0] as keyof typeof inputs;
}

function difference(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : left - right;
}

function metric(value: { value: number | null; evaluatedQueries: number }): string {
  return value.value === null ? `N/A (n=${value.evaluatedQueries})` : `${value.value.toFixed(6)} (n=${value.evaluatedQueries})`;
}

function markdown(report: typeof reportWithoutChecksum & { contentChecksum: string }): string {
  const summary = report.fullDevHybrid;
  const languageRows = ['en', 'sv'].map((language) => {
    const item = summary.byLanguage[language];
    return `| ${language.toUpperCase()} | ${item.queryCount} | ${metric(item.metrics.recallAt20)} | ${metric(item.metrics.precisionAt5)} | ${metric(item.metrics.ndcgAt5)} | ${item.zeroResultCount} |`;
  }).join('\n');
  const familyRows = Object.entries(summary.byFamily as Record<string, {
    queryCount: number;
    metrics: {
      recallAt20: { value: number | null; evaluatedQueries: number };
      precisionAt5: { value: number | null; evaluatedQueries: number };
      ndcgAt5: { value: number | null; evaluatedQueries: number };
    };
    zeroResultCount: number;
    inventoryUnavailableQueryCount: number;
  }>).map(([family, item]) => (
    `| ${family} | ${item.queryCount} | ${metric(item.metrics.recallAt20)} | ${metric(item.metrics.precisionAt5)} | ${metric(item.metrics.ndcgAt5)} | ${item.zeroResultCount} | ${item.inventoryUnavailableQueryCount} |`
  )).join('\n');
  const operationRows = report.operationalEvidence.map((item) => (
    `| ${item.run} | ${item.mode} | ${item.providerDegradationCount} | ${item.providerAttemptCount} | ${item.providerSuccessCount} | ${item.databaseLatencyMs.p50.toFixed(3)} / ${item.databaseLatencyMs.p95.toFixed(3)} | ${item.requestLatencyMs.p50.toFixed(3)} / ${item.requestLatencyMs.p95.toFixed(3)} |`
  )).join('\n');
  return `# EVAL-03 — Day-3 Gate D\n\n` +
    `Status: COMPLETE\nDataset: ${report.judgment.datasetManifestVersion} (${report.judgment.datasetManifestChecksum})\n` +
    `Judgments: ${report.judgment.version} (${report.judgment.checksum}); 60/60 DEV human-reviewed before results\n` +
    `Evaluation clock: ${report.inventoryAtClock.evaluationClockUtc}\nSelected candidate: ${report.configSelection.selected}; exactly one configuration evaluated\n\n` +
    `## Decision\n\n${report.configSelection.decision}\n\n${report.searchQuality.deferredValidation}\n\n` +
    `No tuning was performed. The clean v2 inventory has one eligible Place and one legitimate Event that is expired at the frozen clock. Changing configuration would be overfitting/noise, so the accepted baseline is retained for Day-4 continuation; this is not the final EVAL-04 freeze. Search-quality confidence is LOW / NOT YET ESTABLISHED. Sparse results are inventory-dominated and do not establish that the ranking configuration is bad.\n\n` +
    `Engineering correctness is supported by accepted automated and fixture tests for EVENT-01, SEM-01, RANK-01, NONCOLLAPSE-01, and MOB-03. Known local state noise remains: MOB-03 reported 260 full-suite passes and two documented reconstructed-local-DB state failures.\n\n` +
    `## Full 60 DEV baseline\n\n` +
    `Known-item Hit@1 / Hit@3 / MRR: N/A (0 evaluable; 19 inventory-unavailable).\n` +
    `Recall@20: ${metric(summary.overall.metrics.recallAt20)}\nPrecision@5: ${metric(summary.overall.metrics.precisionAt5)}\nNDCG@5: ${metric(summary.overall.metrics.ndcgAt5)}\n` +
    `Zero results: ${summary.overall.zeroResultCount}/${summary.overall.queryCount} (${(summary.overall.zeroResultRate * 100).toFixed(2)}%).\n` +
    `Failure attribution: ${Object.entries(summary.failureAttribution).map(([key, value]) => `${key}=${value}`).join(', ')}.\n\n` +
    `| Locale | Queries | Recall@20 | Precision@5 | NDCG@5 | Zero |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${languageRows}\n\n` +
    `Semantic family EN and SV each have Recall@20=0, Precision@5=0, and NDCG@5=0 over four graded queries; all 16 semantic queries returned zero results. Paired comparisons are not measurable because both sides are empty.\n\n` +
    `| Family | Queries | Recall@20 | Precision@5 | NDCG@5 | Zero | Inventory unavailable |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${familyRows}\n\n` +
    `## Lexical-only versus hybrid\n\nBoth runs use the same manifest, judgments, clock, code, and accepted deterministic retrieval. Ranked IDs and metrics match for all 60 queries; all overall and EN/SV deltas are 0. Hybrid produced zero semantic candidates because the frozen manifest has no compatible READY document embeddings. No meaningful semantic lift can be measured from one eligible Place, and no semantic tuning was performed to manufacture lift.\n\n` +
    `## Event/time and broad non-collapse\n\nAll 6 Event/time queries returned zero results: the sole legitimate Event is expired at the evaluation clock, and one named Event target is absent. Attribution is eligibility plus inventory, not ranking. All 8 broad queries returned zero results; non-collapse moved 0 candidates, promoted no clearly weaker candidate, and concentration was not applicable because there were no multiple comparable alternatives.\n\n` +
    `## Determinism and operations\n\nHybrid runs 2 and 3 are byte-identical for deterministic result content (${report.determinism.contentChecksum}); rankings and metrics reproduce exactly. Operational timing/provider observations are intentionally separate and non-deterministic.\n\n` +
    `| Run | Mode | Provider degraded | Attempts | Successes | DB p50 / p95 ms | Request p50 / p95 ms |\n| --- | --- | ---: | ---: | ---: | ---: | ---: |\n${operationRows}\n\n` +
    `## Guards and next validation\n\nSEALED: NO ACCESS. ADVERSARIAL: NO ACCESS. Only DEV was parsed. No judgments or dataset versions were mutated after inspection, no brute-force tuning occurred, and no source, entity, retriever, provider/model, ANN, weighted/learned fusion, runtime/mobile, or COVERAGE-01 change was made. SPEC_CHANGE_REQUIRED: NONE.\n\n` +
    `After COVERAGE-01 materially changes inventory, create a new immutable dataset manifest and tied judgment version, then rerun all 60 DEV before final EVAL-04 freeze.\n`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
