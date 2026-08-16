# DEMO-SUBMISSION-PACKAGE-01 — submission state v1

## Pins

- Pre-documentation code pin: `9c32af4a50e44fdefde596d11885650a18c9821d` — `fix(search): embed short discovery and mixed-time queries`.
- Final documentation commit: recorded by this package commit.
- Mobile runtime: Expo SDK 54, React 19.1.0, React Native 0.81.5, App Store Expo Go.
- Hosted project: `zrxdjorrwcunprbykdtg`.
- Edge: `search`, `ACTIVE`, deployment version `6`, updated `2026-08-16T20:02:14.894Z`.
- Search configuration: `noncollapse-v1`; `RRF_V1`, `k=60`; `NONCOLLAPSE_V1` enabled.
- Semantic contract: Voyage `voyage-4`, revision `voyage-4-preflight-v1`, 1024 dimensions, query input, 700 ms deadline, exact pgvector, no ANN.
- Historical manifest identity: `dataset-manifest.final-eval-recovery.v1` / `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`.
- Hosted logical corpus: 392 published Places, 3 published Events, 395 active SearchDocuments, 395 compatible READY embeddings, 0 fixtures.

## Current evidence

- Focused routing/time/Edge tests: 88 passing tests; mobile: 25 passing tests.
- Typecheck, lint, committed-secret scan, and `git diff --check`: PASS.
- Public deployed smoke: direct exact, category, `something casual`, `any fun activities`, and Swedish `dejt` each returned HTTP 200 with results and `semanticDegraded=false`.
- Current-clock Event check: `this weekend` returned HTTP 200 with 0 results. `CURRENT_EVENT_POSITIVE_QUERY_UNAVAILABLE` is recorded; no Event-positive claim is made for the current clock.
- Historical DEV and QA evidence predates the `9c32af4` routing correction and does not validate this code lineage for final evaluation.

## Status

```text
DEMO_SUBMISSION_PACKAGE_READY = TRUE
FINAL_SUBMISSION_GATE_SATISFIED = FALSE
FINAL_EVALUATION_CANDIDATE_FROZEN = FALSE
PERF_REVALIDATION_STATUS = BLOCKED_DEFERRED
SEALED_ACCESSED = FALSE
ADVERSARIAL_ACCESSED = FALSE
```

This is a founder/demo submission package, not a final evaluation freeze. Required continuation is fresh DEV on the `9c32af4` lineage, QA revalidation if required, PERF diagnosis/revalidation, exact candidate freeze, SEALED once, adversarial once, EVAL-04, then final frozen submission-gate review.
