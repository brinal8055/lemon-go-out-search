# FINAL-EVAL-QA-REVALIDATION

- Decision: `QA_REVALIDATED`
- Hosted FINAL_EVAL project: `zrxdjorrwcunprbykdtg`
- Selected candidate: `eval-03-baseline.v1`; `RRF_V1`, `k=60`; `noncollapse-v1`; semantic timeout `700 ms`.
- Semantic contract: Voyage `voyage-4`, revision `voyage-4-preflight-v1`, `1024` dimensions, exact pgvector; no ANN implementation.
- FINAL-EVAL-DEV-TUNE-01: `TUNING_REJECTED`; the accepted commit changes retrieval-diagnostic evidence only, with no search code or configuration change.

## Frozen recovery identity

- Manifest: `dataset-manifest.final-eval-recovery.v1` / `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`.
- DEV inventory logical checksum: `2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37`.
- DEV inventory file checksum: `de774184f5af261bf94dc6621d14112ba27f6eb30fb952eaa3a743070576b3af`; this is the separately recorded file checksum in the accepted candidate-readiness evidence.
- DEV judgments: `judgments.final-eval-recovery.v1` / `e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70`.

## Hosted read-only verification

- Published Places / Events: `392 / 3`; active SearchDocuments / compatible READY embeddings: `395 / 395`.
- Fixture contamination, invalid current-evidence pairs, canonical-evidence divergence, invalid active documents, inactive-taxonomy references, invalid published Place geo, and invalid published Events: all `0`.
- Candidate config verified remotely: `noncollapse-v1`, `rrf_k=60`, `700 ms`, Voyage `voyage-4`, revision `voyage-4-preflight-v1`, `1024` dimensions, semantic cap `30`, non-collapse enabled.
- Search invariants: canonical exact protection passed on the deployed Edge path; alias/exact ordinary behavior, taxonomy, geo, Event/time, RRF determinism, broad-only non-collapse, and semantic fail-open passed in focused local regression.

## Deployed Edge and security

- Client-equivalent Edge canaries: canonical exact, semantic EN, and semantic SV all returned HTTP `200`, correlated request IDs, shaped safe responses, and expected result counts (`1`, `10`, `10`).
- Direct no-key RPC was denied. Backend RPC succeeded; direct private/default and `app`-profile reads were denied. OpenAPI exposed only `/rpc/search_v1`; no tested response leaked private fields or credentials.
- Edge path verified: client-equivalent request → Edge search → `api.search_v1`. Unit coverage verifies one RPC call and provider-failure deterministic fallback.

## Limitations and decision

- Frozen DEV clock remains `2026-10-15T12:00:00Z`; the three real August Events are not required to satisfy that historical clock. Event interval, point/no-end, cancellation, source-outage, and DELTA semantics passed focused tests.
- Carry forward `VOYAGE_REQUEST_TIME_RELIABILITY_RISK` to PERF: QA does not alter or prove the frozen provider timeout/model contract.
- P0/P1/P2: `0 / 0 / 0`; P3: `1` (Voyage request-time reliability risk).
- Tests: 110 focused unit tests; 301 focused pgTAP assertions; `pnpm typecheck`, `pnpm lint`, and committed-secret scan passed.
- SEALED/adversarial: not accessed. No tuning, configuration, corpus, judgment, embedding, source, or production code change was made.
- `SPEC_CHANGE_REQUIRED`: `NONE`.
