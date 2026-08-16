# FINAL-EVAL-PERF-DIAG-01

Decision: **EDGE_NETWORK_REGRESSION_CONFIRMED**

## Frozen state

- Candidate remains `eval-03-baseline.v1`: `RRF_V1`, `k=60`, `NONCOLLAPSE_V1`, Voyage `voyage-4` / `voyage-4-preflight-v1`, `1024D`, `700 ms`, exact pgvector, no ANN.
- Manifest is `dataset-manifest.final-eval-recovery.v1` with the accepted manifest, inventory, and judgment checksums.
- Hosted state before and after measurement matched: 392 published Places, 3 published Events, 395 active SearchDocuments, 395 compatible READY embeddings, zero fixtures, and the accepted document/embedding checksums.
- No search/config/corpus drift occurred. The run made read-only search, metadata, and log requests only.

## Required target boundaries

Requirements Baseline v1.1 section 22 defines direct/category as server/search processing excluding unavoidable client/network transport where separately measurable. It defines semantic as end-to-end backend search processing and requires synchronous external-model latency to be measured separately. Final Technical Specification v1.0, Performance Measurement, repeats the two **backend** gates and requires Edge, provider, database, backend-total, client-perceived, and cold-start timing separately.

Therefore:

- direct/category target: deployed backend processing through Edge and its database RPC, excluding the caller-to-Edge public transport residual;
- semantic target: deployed Edge provider + database RPC + handler backend total, excluding the caller-to-Edge public transport residual;
- complete public request remains required diagnostic evidence but is not itself the frozen backend gate.

No target was weakened or reinterpreted.

## Historical PERF-01 semantics

Historical direct/category `14.334 / 37.328 ms` was client-observed wall time around a local Node production handler calling a custom evaluation RPC client over one persistent direct PostgreSQL connection. The evaluator executed ranked search plus a separate semantic-candidate diagnostic statement; it did not traverse deployed Edge or PostgREST. Its 32 selected DEV samples covered canonical exact, alias/collision, prefix, typo/fuzzy, taxonomy, broad-discovery, and broad-concentration families. Network between the Node client and PostgreSQL was included; server-only execution was not recorded.

Historical DB semantic `73.865 / 99.027 ms` was likewise client-observed time for two evaluator PostgreSQL statements, not server-side execution and not `api.search_v1` through PostgREST. The 26 samples came from the accepted Hybrid baseline. Historical semantic backend total `472.115 / 514.223 ms` used the first unpaced successful request from each of three complete Hybrid runs through the local Node handler, direct PostgreSQL, and Voyage; it excluded deployed Edge and PostgREST.

Historical environment evidence records Node `v25.8.1`, Darwin arm64, a persistent direct PostgreSQL client, and no explicit warm/cold tags. It does not record the client location, endpoint hostname, project/Edge region, connection establishment, or proxy/pooler identity. Consequently the historical wall timings are not like-for-like with current public Edge or server-only measurements.

## Layer timing and attribution

All values are milliseconds. Percentiles use the recorded nearest-rank method.

| Layer | n | p50 | p95 | max | Historical comparable? | Regression? | Confidence | Notes |
|---|---:|---:|---:|---:|---|---|---|---|
| PostgreSQL `api.search_v1`, lexical, server execution | 24 | 35.010 | 58.735 | 305.080 | No; historical was client wall/custom evaluator | No DB regression confirmed | High | Warm repeats p50/p95/max `33.968/40.878/40.878`; all shared reads zero |
| PostgreSQL broad deterministic, server execution | 8 | 22.541 | 23.181 | 23.181 | No | No DB regression confirmed | High | Function boundary, vector absent |
| PostgreSQL `api.search_v1`, semantic fixed vector, server execution | 8 | 57.139 | 62.417 | 62.417 | No; historical was two client-observed statements | No DB regression confirmed | High | Full RPC function, provider excluded |
| Exact pgvector stage, server execution | 12 | 4.021 | 4.370 | 4.370 | No | No | High | Exact 395-row scan, top-N heapsort, zero shared reads, no ANN |
| Direct PostgreSQL client, lexical | 24 | 179.837 | 190.088 | 192.688 | No | Not attributable as DB execution | High | Persistent direct `db.*:5432`; includes client-to-Tokyo transport |
| Direct PostgreSQL client, semantic fixed vector | 8 | 202.309 | 212.131 | 212.131 | No | Not attributable as DB execution | High | Same persistent direct connection |
| Direct PostgREST `api.search_v1`, lexical | 24 | 231.308 | 343.439 | 864.342 | Not measured historically | Current network/API variance | High | Caller-observed; Edge function excluded |
| Deployed Edge → PostgREST/RPC, lexical | 24 | 235 | 887 | 987 | Not measured historically | **Yes** | High | Same-request Edge telemetry; dominant backend interval |
| Deployed Edge backend total, lexical | 24 | 253 | 905 | 1,005 | Not measured historically | **Yes: frozen gate fails** | High | Target `100/300`; non-RPC handler work only `18/19/25` |
| Complete public Edge request, lexical | 24 | 398.597 | 1,033.964 | 1,127.140 | No | Diagnostic only | High | Same-request public residual `127.196/166.125/182.128` |
| Voyage direct, accepted revalidation | 10 | 389.170 | 476.277 | 476.277 | Yes | No | High | 10/10 success; prior `392.838/553.205/689.371` |
| Deployed Edge → PostgREST/RPC, semantic | 4 | 357 | 1,161 | 1,161 | Not measured historically | Current variance | Medium | Same-request telemetry; fixed production path |
| Deployed Edge backend total, semantic | 4 | 706 | 1,488 | 1,488 | No; historical local handler | No current gate failure | Medium | Target `750/1,500`; provider `318/337/337` |
| Complete public Edge request, semantic | 4 | 905.456 | 1,674.064 | 1,674.064 | Comparable to current revalidation only | Diagnostic boundary fails p50/p95 if misapplied | Medium | Public residual `180.135/199.456/199.456` |

## EXPLAIN and database findings

- `api.search_v1` is opaque to the outer plan as a `Function Scan`, but `EXPLAIN (ANALYZE, BUFFERS)` records server execution and aggregate buffers. The first lexical canonical-exact sample was the 305.080 ms maximum; the following 18 warm-repeat lexical samples were `33.968/40.878/40.878` with no shared reads.
- The semantic full-function samples were `57.139/62.417/62.417`, below both backend gates before network/API layers.
- The isolated exact-vector plan scanned all 395 compatible embeddings, joined active documents/entities with index scans, and used a top-N heapsort for 30 rows. Its p95 was 4.370 ms with 3,706 shared-hit and zero shared-read blocks in the representative plan.
- No HNSW or IVFFlat index exists. There is no evidence of an exact-pgvector or PostgreSQL engine regression.

## Network, region, and warm/cold findings

- Measurement client: local Node `v25.8.1` on Darwin arm64, `Asia/Kolkata` timezone; physical client location was not independently asserted.
- Public calls entered Cloudflare POP `AMD` and Supabase Edge region `ap-south-1`. Hosted PostgreSQL is in project region `ap-northeast-1`. The Edge function calls the Supabase PostgREST endpoint, while the direct diagnostic connection used `db.<project>.supabase.co:5432`; no pooler was used by the direct path.
- New direct PostgreSQL connection plus `select 1` was `746.026/787.477/787.477` for four samples. This proves connection establishment is expensive from the measurement client but does not prove PostgREST opened a new database connection for any specific Edge request.
- The first public lexical request was 1,127.140 ms and its Edge backend/RPC timing was `1,005/987`. Cold-ish behavior exists, but excluding the first request still yields Edge backend p95 880 ms and RPC p95 863 ms. Slow samples therefore do not collapse to the first request.
- Edge execution IDs were distinct for 23/24 lexical requests and 4/4 semantic requests. This prevents a controlled warm-isolate comparison; no restart/redeploy was manufactured. Handler work outside provider/RPC remained stable at lexical `18/19/25` and semantic `18/19/19`, so application startup/processing is not the dominant observed cost.
- The frozen lexical failure is dominated by Edge → PostgREST/RPC latency, not caller transport, handler CPU, database execution, Voyage, or exact pgvector.

## Root cause and decision

The current revalidation's public direct/category `440.812/1,140.536` and semantic `1,277.809/1,407.719` figures included caller-to-Edge transport and were not comparable to historical PERF-01. That is a real measurement mismatch, but it is not the selected decision because the correctly correlated deployed lexical backend still fails the frozen gate at `253/905`.

PostgreSQL lexical execution passes at `35.010/58.735`, while the same deployed requests spend `235/887` in Edge → PostgREST/RPC and only `18/19` elsewhere in the handler. Edge executed in Mumbai and the database is in Tokyo. The exact contribution of inter-region transit, PostgREST/auth/proxy handling, and backend connection establishment cannot be split further from available telemetry; the combined Edge/network RPC layer is directly attributable.

Semantic's prior p50 failure is primarily a boundary mismatch: fresh same-request telemetry gives deployed semantic backend `706/1,488`, inside the frozen target, while complete public timing is `905/1,674`. Its large variance is again in the RPC interval, not Voyage or exact-vector execution.

Decision: **EDGE_NETWORK_REGRESSION_CONFIRMED**.

## One bounded remediation candidate

Route/pin the public search Edge invocation to the database region `ap-northeast-1` using Supabase's supported [regional-invocation mechanism](https://supabase.com/docs/guides/functions/regional-invocation), then rerun the same correlated backend/public benchmark. This is the single highest-evidence candidate because it removes the observed `ap-south-1` → `ap-northeast-1` backend region split without changing SQL, search behavior, provider/model, timeout, datastore, or vector strategy. It is proposed only; no remediation was implemented.

## Guards

- `SEALED_ACCESSED = NO`
- `ADVERSARIAL_ACCESSED = NO`
- `SPEC_CHANGE_REQUIRED = NONE`
- No SQL, migration, index, Edge, search, config, provider, timeout, corpus, embedding, judgment, acquisition, candidate-freeze, or production behavior change was made.
