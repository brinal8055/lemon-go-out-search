# QA-01 evidence report

Status: **PASS**

Evidence date: 2026-08-16

Pre-QA repository commit: `9de3d7e3cf433e1298ed16b5689bd5b2910ad748`

## Frozen-contract unblock decision

- Exact 392-Place / 3-Event / 395-document corpus required for QA-01 execution: **NO**.
- Exact corpus required in the final local database: **NO**.
- Prior real post-Coverage evidence + deterministic isolated tests + clean reduced local database permitted: **YES**.
- Full post-Coverage state reconstruction required: **NO**.
- `POSTCOV-STATE-01` introduced: **NO**.

The frozen documents require complete regression evidence, reproducible evaluation
against a pinned dataset/version, real deployed/mobile smoke, and clean
reset/reproducibility. They do not require all of those checks to execute against
one persistent local database state, and they specify no mandatory final local row
counts.

Relevant clauses:

- `docs/implementation/Final_Implementation_Plan_v1_0.md`, **Day 4 / Phase 2 — automated regression**: run clean migrations/reset and the complete behavioral regression.
- Same document, **QA-01 — full regression/security/search/mobile smoke**: execute the complete frozen automated suite; zero unresolved mandatory regression and a complete evidence artifact are the task DoD.
- Same document, **Testing Execution Plan / Day 4**: complete regression from clean reset/checkout "where practical" and separately execute public API, deployed security, mobile real-device, latency, and freeze checks.
- `docs/specification/Final_Technical_Specification_v1_0.md`, **Testing**: defines mandatory unit, DB/integration, API/mobile, relevance, and deliverable cases without assigning a required database row count to QA.
- Same document, **Evaluation**: the dataset manifest pins the canonical dataset, source runs, SearchDocument hashes, model/config, clock, corpus, and judgments. This makes the accepted post-Coverage evaluation evidence dataset-specific without requiring that dataset to remain loaded after the run.
- `docs/requirements/Requirements_Baseline_v1_1.md`, **Reproducible relevance evaluation**: the same implementation against the same dataset/evaluation version must reproduce metrics. The accepted evaluation artifacts retain those versions; this clause does not require the local operational database to retain that dataset after evaluation.
- Same document, **Testing requirements** and **Acceptance criteria summary**: requires risk-focused testing, critical mobile smoke, a repeatable judged corpus, and disclosed limitations; it specifies no final local corpus cardinality.

No explicit MUST was weakened. The final reduced database is used only for local
hygiene and deterministic fixture-backed checks. It is not used as post-Coverage
relevance, supply, or semantic-quality evidence.

## Evidence classes

### REAL_POSTCOVERAGE_EVIDENCE

- Accepted POSTCOV-EVAL-01 commit:
  `9de3d7e3cf433e1298ed16b5689bd5b2910ad748`.
- Frozen manifest: `evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json`.
- Manifest checksum: `c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0` — verified.
- Accepted full Hybrid DEV run: 60/60 queries; 26/26 provider successes; 0 provider degradation.
- Overall Recall@20 / Precision@5 / NDCG@5:
  `0.4153753789 / 0.6050 / 0.7715032039`.
- Semantic-family Recall@20 / Precision@5 / NDCG@5:
  `0.0922259846 / 0.7142857143 / 0.6537277034`.
- Pre-reset real QA smoke, accepted in the QA-01 continuation record:
  Mobile → Edge → PostgREST → one `api.search_v1`; exact, prefix, typo,
  taxonomy, broad, mixed-locale, geo, and Event/time paths passed; the real
  Event/time flow returned two Events.

### DETERMINISTIC_FUNCTIONAL_QA

- TypeScript typecheck: PASS.
- ESLint: PASS.
- Vitest: 25 files, 300 tests, PASS in one clean sequence with file parallelism
  disabled because DB-backed files share and mutate one local schema; no test
  was skipped. The same files also passed in focused isolation during triage.
- pgTAP: 19 files, 785 assertions, PASS.
- HTTP/Data API security matrix: 17 assertions, PASS; pgTAP security and
  diagnostics assertions were executed separately in the full DB run.
- Reference verification: 52 taxonomy nodes and 62 source mappings, PASS.
- Evaluation corpus validation: 110 queries and 12 EN/SV pairs, PASS.
- Clean migration/reset and pinned-fixture reconstruction: PASS.
- Supabase DB lint: command PASS; one pre-existing project-owned diagnostic
  volatility warning disclosed below. PostGIS extension diagnostics are
  third-party lint output.

### FINAL_LOCAL_HYGIENE

Final reconstruction used the existing
`packages/source-adapters/src/eval03-reconstruct-cli.ts` path and only repository
sanitized fixtures. It reported `networkRequests: 0`. No acquisition or embedding
generation occurred.

- canonical entities: 7
- Places: 6
- Events: 1
- published entities: 2
- active SearchDocuments: 1
- embeddings: 0
- unexpected canonical rows outside the seven pinned fixture identities: 0

This is a deterministic Day-3-style local verification state. It is **not** the
full post-Coverage corpus and must not be cited as post-Coverage relevance evidence.

## Evidence matrix

| Requirement | Evidence type | Evidence source | Result | Limitations |
|---|---|---|---|---|
| Real post-Coverage search quality | HISTORICAL_ACCEPTED_EVAL | POSTCOV-EVAL-01 commit, frozen manifest, Hybrid DEV report | PASS | Applies only to `dataset-manifest.day4-postcoverage.v2`; not inferred from final local DB |
| Real end-to-end public flow and one RPC | REAL | Accepted pre-reset QA Edge/mobile smoke and current HTTP security matrix | PASS | Real smoke was captured before the destructive regression cleanup |
| Exact, prefix, typo, taxonomy, broad, mixed-locale, geo | REAL + DETERMINISTIC_FIXTURE | Accepted pre-reset smoke; pgTAP search suites | PASS | Reduced local DB provides functional, not relevance/supply, evidence |
| Real Event/time results | REAL | Accepted pre-reset QA smoke returned two Events | PASS | Final local DB contains only one pinned fixture Event |
| Event half-open, point, expiry, cancellation, freshness, outage/DELTA | DETERMINISTIC_FIXTURE | `event-01.sql`; Event ingestion/unit suites | PASS | Controlled clocks and fixtures |
| Source capture/version/parse/current pair and replay | DETERMINISTIC_FIXTURE | DB-01A, DB-02, ingestion and source suites | PASS | Fixture-backed transaction evidence |
| Duplicate stale review, Type A/B, reversal, concurrency | DETERMINISTIC_FIXTURE | `duplicate-review.sql` | PASS | Deterministic identities and evidence pairs |
| Provenance, revocation, compliance redaction/session actor | DETERMINISTIC_FIXTURE | `provenance-redaction.sql`; unit tests | PASS | Privileged paths are local test roles |
| Embedding READY/FAILED/STALE/retry/compatibility | DETERMINISTIC_FIXTURE | embedding lifecycle unit/pgTAP suites | PASS | No Voyage call or vector regeneration in QA-01 |
| Provider timeout/rate/5xx/invalid/dimension/circuit fallback | MOCK/FAULT_INJECTION | semantic Edge/unit/pgTAP suites | PASS | Injected failures; not a live provider reliability measurement |
| RRF, protected exact, ties, unique IDs | DETERMINISTIC_FIXTURE | rank and search pgTAP suites | PASS | Controlled candidate sets |
| Broad non-collapse and immunity/relevance guard | DETERMINISTIC_FIXTURE | non-collapse unit/pgTAP suites | PASS | Real post-Coverage smoke had no assessable concentration movement |
| API validation and safe errors | MOCK/FAULT_INJECTION + DETERMINISTIC_FIXTURE | Edge unit tests and HTTP matrix | PASS | Local Edge/Data API environment |
| Security denials, one exposed RPC, backend success, no response leakage | DETERMINISTIC_FIXTURE | sec-01/search-diagnostics pgTAP + 17 HTTP/config assertions | PASS | Local stack; accepted pre-reset real Edge smoke supplies end-to-end evidence |
| Mobile loading/empty/error/degraded/stale/order/EN-SV/Event states | MOCK/FAULT_INJECTION + DETERMINISTIC_FIXTURE + REAL | 200-test pure group includes mobile/Edge tests; accepted real mobile smoke | PASS | No new real-device execution after reset |
| Taxonomy/reference/corpus integrity | DETERMINISTIC_FIXTURE | reference verifier, taxonomy tests, corpus validator | PASS | SEALED/adversarial judgments not accessed |
| Clean reset and contamination-free local state | DETERMINISTIC_FIXTURE | migrations/seeds + existing pinned-fixture reconstruction + final SQL counts | PASS | Final state intentionally smaller than post-Coverage corpus |

## Findings and carry-forward

- P0: 0
- P1: 0
- P2: 0
- P3: 2
  - `VOYAGE_REQUEST_TIME_RELIABILITY_RISK`: accepted evidence contains a
    successful 26/26, zero-degradation provider run, but repeated request-time
    provider reliability is not established. PERF-01 must measure and disclose
    provider/request latency without changing the frozen provider contract.
  - `diagnostic.explain_search_place_v1` DB-lint warning: routine is marked
    STABLE while the linter sees a volatile expression. This warning predates
    QA-01, functional diagnostics tests pass, and QA-01 does not change
    production behavior to suppress it.

## Guard audit

- Source acquisition: **NONE**.
- Voyage calls: **NONE**.
- Embedding generation/regeneration: **NONE**.
- Search tuning or behavior changes: **NONE**.
- Manifest or judgment changes: **NONE**.
- SEALED access: **NONE**.
- Adversarial access: **NONE**.
- PERF-01 / EVAL-04 work: **NONE**.
- Frozen-document changes: **NONE**.
- `SPEC_CHANGE_REQUIRED`: **NONE**.
