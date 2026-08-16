# FINAL-EVAL recovery DEV candidate readiness

- Decision: **BLOCKED**
- Reason: neither the initial Hybrid run nor its accepted fresh rerun produced an evaluator-valid complete run under the unchanged 700 ms provider timeout.
- Frozen inputs: `dataset-manifest.final-eval-recovery.v1` / `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`; inventory `2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37`; judgments `e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70`.
- Search candidate: `eval-03-baseline.v1`; active `noncollapse-v1` / `cf017f94090c80c905be8868dd0239740726f0a9b2df929ef010b04a8675a624`; RRF_V1 `k=60`; NONCOLLAPSE_V1.
- Recovery-B state: 392 published Places, 3 published Events, 395 active SearchDocuments, 395 exact compatible READY embedding identities, zero fixture contamination.

## Valid lexical evidence

- Queries: 60/60; zero results: 34.
- Hit@1 / Hit@3 / MRR: 0.571429 / 1.000000 / 0.714286.
- Recall@20 / Recall@50 / P@5 / NDCG@5: 0.372288 / 0.372288 / 0.275000 / 0.456394.
- Recall@50 equals Recall@20 because the frozen public search contract returns at most 20 results.
- EN Recall@20 / P@5 / NDCG@5 / zero: 0.231659 / 0.262500 / 0.359734 / 17.
- SV Recall@20 / P@5 / NDCG@5 / zero: 0.297314 / 0.222222 / 0.444444 / 17.
- Semantic-family Recall@20 / P@5 / NDCG@5 / zero: 0 / 0 / 0 / 16.
- Broad-discovery Recall@20 / P@5 / NDCG@5 / zero: 0.002551 / 0.200000 / 0.188935 / 3.
- Broad-concentration Recall@20 / P@5 / NDCG@5 / zero: 0.333333 / 0.200000 / 0.333333 / 3.
- Non-collapse moves/promotions: 0/0. Hard-constraint violations: 0.
- Full family, language, and per-query evidence is in `lexical/dev-result.v1.json`.

## Invalid Hybrid attempts

- Initial: intended 26; 15/16 actual calls succeeded; one HTTP-200 response-body timeout at 704.157 ms; stopped at semantic query 10.
- Fresh rerun: intended 26; 0/1 actual calls succeeded; one provider timeout at 704.595 ms; stopped at the first routed query.
- Combined: 17 calls, 15 successes, 2 degraded/timeouts, 0 provider errors, 0 HTTP 429s.
- All-attempt latency p50/p95/max: 405.522 / 704.595 / 704.595 ms; successful-only: 398.762 / 566.601 / 566.601 ms.
- Fifteen query-vector fingerprints were recorded; no raw query vector was persisted.
- Hybrid metrics, lexical-to-Hybrid deltas, and Hybrid regression claims are intentionally absent.

## Attribution and guards

- Lexical material attribution: INVENTORY 9; EVENT_CLOCK/INVENTORY 6; ELIGIBILITY 5; RETRIEVAL 13; expected lexical-only SEMANTIC_RETRIEVAL 14.
- Hybrid run-ending attribution: PROVIDER_DEGRADATION 2.
- Event limitation: August 2026 Events are ineligible at the frozen 2026-10-15 clock; the clock and inventory were not changed.
- Historical lexical context: Hit@1 unchanged 0.571429; Hit@3 unchanged 1.000000; MRR 0.785714→0.714286; Recall@20 unchanged 0.372288; P@5 unchanged 0.275000; NDCG@5 0.466213→0.456394. This is a new judgment lineage.
- SEALED accessed: NO. Adversarial accessed: NO. Tuning: NONE. SPEC_CHANGE_REQUIRED: NONE.
