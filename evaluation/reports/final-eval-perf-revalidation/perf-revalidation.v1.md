# FINAL-EVAL-PERF-REVALIDATION

Decision: **PERF_BLOCKED**

## Candidate and recovery corpus

- Candidate: `eval-03-baseline.v1`; `RRF_V1`, `k=60`; `noncollapse-v1` / `NONCOLLAPSE_V1`.
- Semantic: Voyage `voyage-4`, revision `voyage-4-preflight-v1`, query input, `1024D`, `700 ms`; exact pgvector; no ANN indexes.
- Manifest: `dataset-manifest.final-eval-recovery.v1` / `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`.
- DEV inventory logical checksum: `2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37`; DEV judgments: `e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70`.
- Hosted `zrxdjorrwcunprbykdtg`: 392 published Places, 3 published Events, 395 active SearchDocuments, 395 compatible READY embeddings, fixture contamination 0.
- Re-derived hosted document checksum `7e5d83ebeee39595944b9ef1bdb5cca8f72ff5aa6a2e2880471b6c4963981a51` and embedding checksum `6ad7ad8fb1d6902de8ee4dbbb66042050ed732789ed4ee7e8a0dbbd46f38f20b` match frozen recovery evidence.

## Measurements

| Population | n | p50 | p95 | max | Frozen target | Result |
|---|---:|---:|---:|---:|---|---|
| Direct/category deployed request | 48 | 440.812 ms | 1,140.536 ms | 1,981.734 ms | 100 / 300 ms | FAIL |
| Semantic deployed request, valid | 8 | 1,277.809 ms | 1,407.719 ms | 1,407.719 ms | 750 / 1,500 ms | FAIL (p50) |
| Direct Voyage, successful | 10 | 389.170 ms | 476.277 ms | 476.277 ms | 700 ms deadline | 10/10 valid |
| PostgreSQL semantic search | 20 | 197.251 ms | 245.333 ms | 872.138 ms | component only | measured |
| Injected-timeout fail-open | 6 | 925.726 ms | 1,171.493 ms | 1,171.493 ms | correctness/bounded | PASS |

- Direct/category covered canonical exact, prefix, and EN/SV taxonomy/category cases. Broad and geo cases were covered in the semantic population because the accepted router legitimately embeds them.
- Semantic covered EN/SV occasion, broad, geo, and mixed inputs through deployed Edge → Voyage → one `api.search_v1` → exact pgvector → RRF/non-collapse; 8/8 returned HTTP 200 without degradation.
- Voyage: 10 attempts, 10 successes, 0 timeouts, 0 provider errors, 0 HTTP 429, and 0 invalid vectors; concurrency 1 with 31-second pacing. No raw vector was persisted.
- PostgreSQL plan nodes used sequential/index scans and sort; hosted catalog inspection found no HNSW or IVFFlat index.
- Fail-open used the production handler, an injected 700 ms timeout, and hosted read-only RPC. All 6 returned HTTP 200, `semanticDegraded=true`, and the same deterministic ordering as semantic-disabled search. The broad probe legitimately had zero lexical matches in both paths.
- `EDGE_OVERHEAD = NOT_DIRECTLY_MEASURED`. Deployed wall timings include caller-to-Edge transport; no component was inferred by subtraction. Because internal Edge/backend totals are unavailable and the directly observed deployed path exceeds the frozen thresholds, the frozen backend targets cannot be independently established.

## Historical comparison and decision

- Prior direct/category: 14.334 / 37.328 ms p50/p95; current deployed wall: 440.812 / 1,140.536 ms — material observed regression.
- Prior semantic total: 472.115 / 514.223 ms; current: 1,277.809 / 1,407.719 ms — p50 target/regression failure, while p95 remains within 1,500 ms.
- Prior Voyage: 392.838 / 553.205 / 689.371 ms; current: 389.170 / 476.277 / 476.277 ms — no current provider latency regression.
- Prior DB semantic: 73.865 / 99.027 ms; current hosted client-observed DB interval: 197.251 / 245.333 ms, with one 872.138 ms maximum.
- `VOYAGE_REQUEST_TIME_RELIABILITY_RISK` remains carried from the accepted later 0/2 provider prechecks despite this run's 10/10 success.
- P0/P1/P2/P3: `0 / 0 / 1 / 1` (blocking performance evidence; carried intermittent-provider risk).
- Decision: **PERF_BLOCKED**. Candidate freeze was not performed.

## Safety and held-out firewall

- Read/search traffic only; no corpus, SearchDocument, embedding, judgment, taxonomy, source, configuration, timeout, model, ranking, or non-collapse mutation.
- No tuning, acquisition, re-embedding, fixture seeding, remote pgTAP, candidate freeze, or EVAL-04.
- `SEALED_ACCESSED = NO`; `ADVERSARIAL_ACCESSED = NO`.
- `SPEC_CHANGE_REQUIRED = NONE`.
