# Post-Coverage DEV Quality Evidence

Status: SEARCH_QUALITY_EVALUATION_COMPLETE

- Dataset: dataset-manifest.day4-postcoverage.v2 / c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0
- Judgments: judgments.day4-postcoverage.v1 / c3b9a4a49702fd519aa0e80b0cf0e8bcf1509e5a7df64f82349761f46e903eaa
- Evaluation clock: 2026-10-15T12:00:00Z
- Quality evidence: lexical 60/60 and fresh Hybrid baseline 60/60. Failed reruns are excluded from relevance metrics.

## Lexical → valid Hybrid

- Known item Hit@1 / Hit@3 / MRR: 0.571429 / 1.000000 / 0.785714 → 0.571429 / 1.000000 / 0.785714
- Overall: recallAt20 0.372288 → 0.415375; precisionAt5 0.275000 → 0.605000; ndcgAt5 0.466213 → 0.771503; zero 34 → 19
- EN: recallAt20 0.231659 → 0.294396; precisionAt5 0.262500 → 0.737500; ndcgAt5 0.359734 → 0.810096; zero 17 → 9
- SV: recallAt20 0.297314 → 0.337297; precisionAt5 0.222222 → 0.533333; ndcgAt5 0.444444 → 0.722545; zero 17 → 10
- Semantic occasion/language: recallAt20 0.000000 → 0.092226; precisionAt5 0.000000 → 0.714286; ndcgAt5 0.000000 → 0.653728; zero 16 → 4
- Broad discovery: recallAt20 0.002551 → 0.052684; precisionAt5 0.200000 → 0.750000; ndcgAt5 0.188935 → 0.703788; zero 3 → 1
- Broad concentration: recallAt20 0.333333 → 0.333333; precisionAt5 0.200000 → 0.200000; ndcgAt5 0.333333 → 0.333333; zero 3 → 3
- Non-collapse moves/promotions: 0/0.

## Determinism and reliability

- INTERNAL_SEARCH_DETERMINISM: PASS.
- END_TO_END_SEMANTIC_PROVIDER_REPEATABILITY: NOT_ESTABLISHED.
- HTTP-200 failure: PROVIDER_DEADLINE_DURING_RESPONSE_BODY_CONSUMPTION; The evaluator observed HTTP 200 only after fetch resolved headers. Later JSON/schema failures are explicitly wrapped, while response.text() may surface an AbortError outside that wrapper. The failed call lasted 708.95 ms under AbortSignal.timeout(700).
- The failed historical journal retained no raw exception name, so this is not a raw-error-proof attribution.
- VOYAGE_REQUEST_TIME_RELIABILITY_RISK: Successful zero-degradation full runs are possible, but repeated request-time runs are not consistently reliable. Characterize this in QA-01/PERF-01 without changing the frozen Voyage/voyage-4/1024/700ms contract.

## Decision

Semantic retrieval provides measurable lift without known-item or non-collapse regression. BOUNDED_TUNING_JUSTIFIED; shouldEmbed conservative-known-item classification is the single proposed candidate and is not implemented.

Event/time remains EVENT_DEV_REAL_INVENTORY_UNAVAILABLE_AT_FROZEN_CLOCK. SEALED and adversarial were not accessed. SPEC_CHANGE_REQUIRED: NONE.

Content checksum: f50a1af2e6c764f1139dc92fe89bd92ce9af06d86c95f4ac88045c10e181a8e8
