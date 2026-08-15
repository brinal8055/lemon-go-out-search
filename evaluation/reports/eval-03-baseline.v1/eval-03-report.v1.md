# EVAL-03 — Day-3 Gate D

Status: COMPLETE
Dataset: dataset-manifest.day3-current.v2 (11a1a73e37bd2af71b7948823c6509dfb98edd86c6629834e2fc54d8a2afe4f1)
Judgments: judgments.day3.v1 (e2c3a0be59a57b4e3dcd46a9e91ab1d67f0d003df3d8825accdb4ebaef88d754); 60/60 DEV human-reviewed before results
Evaluation clock: 2026-10-15T12:00:00Z
Selected candidate: eval-03-baseline.v1; exactly one configuration evaluated

## Decision

DEV_TUNING_NOT_MEANINGFUL_DUE_TO_INSUFFICIENT_INVENTORY

SEARCH_QUALITY_CONFIDENCE_DEFERRED_TO_POST_COVERAGE_DEV_REVALIDATION

No tuning was performed. The clean v2 inventory has one eligible Place and one legitimate Event that is expired at the frozen clock. Changing configuration would be overfitting/noise, so the accepted baseline is retained for Day-4 continuation; this is not the final EVAL-04 freeze. Search-quality confidence is LOW / NOT YET ESTABLISHED. Sparse results are inventory-dominated and do not establish that the ranking configuration is bad.

Engineering correctness is supported by accepted automated and fixture tests for EVENT-01, SEM-01, RANK-01, NONCOLLAPSE-01, and MOB-03. Known local state noise remains: MOB-03 reported 260 full-suite passes and two documented reconstructed-local-DB state failures.

## Full 60 DEV baseline

Known-item Hit@1 / Hit@3 / MRR: N/A (0 evaluable; 19 inventory-unavailable).
Recall@20: 0.111111 (n=18)
Precision@5: 0.022222 (n=18)
NDCG@5: 0.111111 (n=18)
Zero results: 58/60 (96.67%).
Failure attribution: CANDIDATE_RETRIEVAL=16, ELIGIBILITY=17, INVENTORY=19, OTHER=0, PROVIDER_DEGRADED=0, RANKING=0, UNION=0.

| Locale | Queries | Recall@20 | Precision@5 | NDCG@5 | Zero |
| --- | ---: | ---: | ---: | ---: | ---: |
| EN | 23 | 0.111111 (n=9) | 0.022222 (n=9) | 0.111111 (n=9) | 22 |
| SV | 31 | 0.111111 (n=9) | 0.022222 (n=9) | 0.111111 (n=9) | 30 |

Semantic family EN and SV each have Recall@20=0, Precision@5=0, and NDCG@5=0 over four graded queries; all 16 semantic queries returned zero results. Paired comparisons are not measurable because both sides are empty.

| Family | Queries | Recall@20 | Precision@5 | NDCG@5 | Zero | Inventory unavailable |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| broad_concentration | 4 | 0.000000 (n=2) | 0.000000 (n=2) | 0.000000 (n=2) | 4 | 0 |
| broad_discovery | 4 | 0.000000 (n=4) | 0.000000 (n=4) | 0.000000 (n=4) | 4 | 0 |
| canonical_exact_same_name | 5 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 5 | 5 |
| event_time | 6 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 6 | 1 |
| geo_scope_radius | 3 | 0.000000 (n=2) | 0.000000 (n=2) | 0.000000 (n=2) | 3 | 0 |
| prefix | 4 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 4 | 4 |
| scarcity_duplicate_state | 3 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 3 | 1 |
| semantic_occasion_language | 16 | 0.000000 (n=8) | 0.000000 (n=8) | 0.000000 (n=8) | 16 | 0 |
| taxonomy_parent_leaf | 7 | 1.000000 (n=2) | 0.200000 (n=2) | 1.000000 (n=2) | 5 | 0 |
| typo_transposition_accent_spacing | 5 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 5 | 5 |
| verified_colliding_aliases | 3 | N/A (n=0) | N/A (n=0) | N/A (n=0) | 3 | 3 |

## Lexical-only versus hybrid

Both runs use the same manifest, judgments, clock, code, and accepted deterministic retrieval. Ranked IDs and metrics match for all 60 queries; all overall and EN/SV deltas are 0. Hybrid produced zero semantic candidates because the frozen manifest has no compatible READY document embeddings. No meaningful semantic lift can be measured from one eligible Place, and no semantic tuning was performed to manufacture lift.

## Event/time and broad non-collapse

All 6 Event/time queries returned zero results: the sole legitimate Event is expired at the evaluation clock, and one named Event target is absent. Attribution is eligibility plus inventory, not ranking. All 8 broad queries returned zero results; non-collapse moved 0 candidates, promoted no clearly weaker candidate, and concentration was not applicable because there were no multiple comparable alternatives.

## Determinism and operations

Hybrid runs 2 and 3 are byte-identical for deterministic result content (6462a2690699733ed6b98b80bce415a2c6a1874d284914e5901a400a20dc57fd); rankings and metrics reproduce exactly. Operational timing/provider observations are intentionally separate and non-deterministic.

| Run | Mode | Provider degraded | Attempts | Successes | DB p50 / p95 ms | Request p50 / p95 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| hybrid-run-1 | HYBRID | 42 | 6 | 3 | 7.149 / 56.029 | 8.496 / 364.176 |
| hybrid-run-2 | HYBRID | 42 | 6 | 3 | 6.841 / 41.031 | 7.838 / 346.122 |
| hybrid-run-3 | HYBRID | 57 | 3 | 0 | 7.097 / 33.370 | 8.219 / 285.276 |
| lexical-run-1 | LEXICAL_ONLY | 0 | 0 | 0 | 6.568 / 11.851 | 7.212 / 16.192 |
| lexical-run-2 | LEXICAL_ONLY | 0 | 0 | 0 | 6.723 / 15.126 | 7.532 / 19.160 |

## Guards and next validation

SEALED: NO ACCESS. ADVERSARIAL: NO ACCESS. Only DEV was parsed. No judgments or dataset versions were mutated after inspection, no brute-force tuning occurred, and no source, entity, retriever, provider/model, ANN, weighted/learned fusion, runtime/mobile, or COVERAGE-01 change was made. SPEC_CHANGE_REQUIRED: NONE.

After COVERAGE-01 materially changes inventory, create a new immutable dataset manifest and tied judgment version, then rerun all 60 DEV before final EVAL-04 freeze.
