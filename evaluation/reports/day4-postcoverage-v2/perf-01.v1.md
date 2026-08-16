# PERF-01 — Post-Coverage Performance and Provider Reliability

Overall: **PASS_WITH_OPERATIONAL_RISK**

## Frozen targets

| Population | p50 | p95 | Decision |
|---|---:|---:|---|
| Direct/category backend | ≤100 ms | ≤300 ms | PASS |
| Semantic backend | ≤750 ms | ≤1,500 ms | PASS |
| Voyage request deadline | — | 700 ms per request | RISK |

The frozen methodology also requires separate Edge/cold-start, provider, DB,
backend-total, and client measurements; EN/SV warm/cold samples; and the frozen
representative family mix at approximately 1,000-entity trial scale. No numeric
minimum sample count is frozen.

## Corpus and measurement boundary

- Evidence: **REAL_POSTCOVERAGE / HISTORICAL_ACCEPTED_EVAL** from
  `dataset-manifest.day4-postcoverage.v2` and accepted POSTCOV-EVAL-01 artifacts.
- Frozen inventory: 395 published unmerged entities, 395 active SearchDocuments,
  and 395 compatible READY embeddings;
  inventory checksum `ed0e23189783959180c39ea73ff4d01cf344f6f8f08ddd079ffffa5e7a2f0209`.
- Candidate: `eval-03-baseline.v1`; config `noncollapse-v1`; clock
  `2026-10-15T12:00:00Z`.
- Runtime boundary: local Node search handler → one logical `api.search_v1`
  evaluator invocation → direct PostgreSQL. The evaluator DB interval contains
  ranked search plus a semantic-candidate diagnostic statement.
- Deployed Edge runtime, PostgREST transport, client network, Edge cold start, and
  client-perceived latency were not captured. No component was derived by subtraction.
- PERF-01 made **zero Voyage calls**, did no acquisition/reconstruction/reembedding,
  and did not tune search or change the frozen 700 ms timeout.

## Direct/category latency

Evidence: **REAL_POSTCOVERAGE / HISTORICAL_ACCEPTED_EVAL**. The 32-request lexical
population contains canonical exact, verified/colliding alias, prefix, typo/fuzzy,
taxonomy/category, broad-discovery, and broad-concentration DEV families. Evaluator
provider pacing is absent.

| Metric | n | p50 | p95 | max |
|---|---:|---:|---:|---:|
| Handler/backend request | 32 | 14.334 ms | 37.328 ms | 164.893 ms |
| PostgreSQL evaluator interval | 32 | 13.418 ms | 37.063 ms | 131.863 ms |

| Family | n | p50 | p95 | max |
|---|---:|---:|---:|---:|
| Canonical exact | 5 | 14.334 | 14.622 | 14.622 |
| Verified/colliding alias family | 3 | 13.482 | 13.996 | 13.996 |
| Prefix | 4 | 13.459 | 14.299 | 14.299 |
| Typo/fuzzy | 5 | 13.795 | 14.716 | 14.716 |
| Taxonomy/category | 7 | 15.571 | 21.618 | 21.618 |
| Broad discovery | 4 | 17.702 | 37.328 | 37.328 |
| Broad concentration | 4 | 31.324 | 164.893 | 164.893 |

Decision: **DIRECT_CATEGORY_LATENCY: PASS**.

## Semantic latency by component

Semantic backend totals use only the first successful semantic request from each
of three complete 26/26, zero-degradation Hybrid runs. Those three requests precede
the evaluator's 31-second spacing wait. Later Hybrid request totals are rejected
because they include pacing sleeps.

| Component | Evidence | n | p50 | p95 | max |
|---|---|---:|---:|---:|---:|
| Backend request total | REAL_POSTCOVERAGE / HISTORICAL_ACCEPTED_EVAL | 3 | 472.115 ms | 514.223 ms | 514.223 ms |
| Accepted-baseline DB interval | REAL_POSTCOVERAGE / HISTORICAL_ACCEPTED_EVAL | 26 | 73.865 ms | 99.027 ms | 100.540 ms |
| Direct Voyage invocation, all retained successful samples | REAL_PROVIDER / HISTORICAL_ACCEPTED_EVAL | 38 | 392.838 ms | 553.205 ms | 689.371 ms |
| Direct Voyage invocation, accepted baseline | REAL_PROVIDER / HISTORICAL_ACCEPTED_EVAL | 26 | 391.069 ms | 412.671 ms | 524.067 ms |
| Accepted provider wrapper including journal completion | REAL_PROVIDER / HISTORICAL_ACCEPTED_EVAL | 26 | 400 ms | 460 ms | 536 ms |
| Edge/application overhead | unavailable | 0 | — | — | — |
| Client perceived | unavailable | 0 | — | — | — |

Decision: **SEMANTIC_BACKEND_LATENCY: PASS**. The backend totals are small-sample
evidence because pacing contaminates the remaining accepted requests.

## Voyage reliability

Across distinct accepted post-Coverage runs, **91 attempts are reconstructible**:
90 successes (98.90%), one deadline-related failure, zero exclusive provider/HTTP
errors, and zero 429s under controlled pacing. Only 39 attempts retain direct raw
elapsed values: 38 successes plus the failure.

| Run | Attempts | Success | Failure | Timing retained |
|---|---:|---:|---:|---|
| Hybrid | 26 | 26 | 0 | counts only |
| Hybrid rerun | 26 | 26 | 0 | p50/p95/max 410/446/475 ms |
| Fingerprinted accepted baseline | 26 | 26 | 0 | 26 raw samples |
| Fingerprinted incomplete rerun | 10 | 9 | 1 | 10 raw samples |
| Controlled probe | 3 | 3 | 0 | 442.292/417.344/398.721 ms |

The failed call lasted **708.947 ms**. Its raw journal outcome is HTTP_ERROR with
HTTP 200 and `UNEXPECTED_PROVIDER_EXCEPTION`; accepted code-path and timing evidence
classifies it as `PROVIDER_DEADLINE_DURING_RESPONSE_BODY_CONSUMPTION`, without
claiming raw-error-proof attribution.

Decision: **PROVIDER_LATENCY: RISK** and **PROVIDER_REPEATABILITY: NOT_ESTABLISHED**.
Successful complete runs prove viability, while the preserved deadline crossing
keeps `VOYAGE_REQUEST_TIME_RELIABILITY_RISK` open at **P3**. Fail-open correctness
prevents a search-quality correctness failure but does not erase the reliability risk.

## Fail-open performance

Evidence: **FAULT_INJECTION / NON_PRODUCTION_PROVIDER**. One cold and five warm
samples per path exercised the real handler with an immediate mock RPC, asserted
one RPC and deterministic results, and made no network request.

| Path | cold | warm n | warm p50 | warm p95/max |
|---|---:|---:|---:|---:|
| Injected 700 ms timeout | 740.437 ms | 5 | 702.523 ms | 718.973 ms |
| Injected provider error | 0.547 ms | 5 | 0.236 ms | 0.285 ms |
| Open circuit | 0.162 ms | 5 | 0.108 ms | 0.119 ms |
| Semantic-disabled deterministic fallback | 0.101 ms | 5 | 0.095 ms | 0.110 ms |

Decision: **FAIL_OPEN_PERFORMANCE: PASS**. The timeout path remains bounded by the
700 ms injected provider wait plus small handler/fallback overhead; immediate error
and circuit paths do not introduce pathological latency.

## Limitations and integrity

- The accepted corpus has 395 entities/documents, below the frozen approximate
  1,000-entity reference, and the DEV families do not exactly reproduce the frozen
  percentage mix or empty structured browse.
- Accepted artifacts did not explicitly tag warm/cold state. First-run maxima and
  first provider calls are retained, not hidden.
- Edge/cold-start and client timing are unavailable; the report does not infer them.
- Older successful provider runs retain only counts or summary percentiles, so the
  direct successful-latency distribution covers 38 of 90 successes.
- The current **SMALL_LOCAL_SMOKE** state remains 7 entities, 1 active SearchDocument,
  and 0 fixture contamination; it is not used for latency certification.
- No evaluator pacing, tuning, ANN, acquisition, embedding generation, manifest or
  judgment mutation, SEALED access, or adversarial access is included.

## Final decision and findings

- `DIRECT_CATEGORY_LATENCY`: **PASS**
- `SEMANTIC_BACKEND_LATENCY`: **PASS**
- `PROVIDER_LATENCY`: **RISK**
- `PROVIDER_REPEATABILITY`: **NOT_ESTABLISHED**
- `FAIL_OPEN_PERFORMANCE`: **PASS**
- `OVERALL_PERF_01`: **PASS_WITH_OPERATIONAL_RISK**
- Open findings P0/P1/P2/P3: **0 / 0 / 0 / 2**. This comprises the P3 Voyage
  reliability risk and the inherited unchanged non-PERF diagnostic volatility warning.
- `SPEC_CHANGE_REQUIRED`: **NONE**
