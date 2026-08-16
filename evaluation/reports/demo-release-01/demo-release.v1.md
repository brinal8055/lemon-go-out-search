# DEMO-RELEASE-01 — demo release pin v1

- Demo Git pin: `a9e922dcf7b1c092cc8076e776a5c2301ce62e1a` (base: `a9e922dcf7b1c092cc8076e776a5c2301ce62e1a`).
- Candidate: `eval-03-baseline.v1`; RRF_V1 k=60; noncollapse-v1; Voyage voyage-4/1024/query/700 ms; exact pgvector; no ANN.
- Manifest: `dataset-manifest.final-eval-recovery.v1` / `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`.
- Hosted project: `zrxdjorrwcunprbykdtg`; 392 Places, 3 Events, 395 active SearchDocuments, 395 compatible READY embeddings, 0 fixtures.
- DEMO_CORPUS_LOGICAL_IDENTITY = VERIFIED; SearchDocument logical hashes and embedding vector fingerprints match; REPRESENTATION_ONLY_DRIFT = ACKNOWLEDGED.
- Edge: search ACTIVE; public path `Edge -> api.search_v1`; no redeploy was required.
- Mobile: `apps/mobile` uses only `EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL`; backend secrets are absent from client source/config.

## Deployed demo smoke

- direct_canonical: `Strömsholmsskogen` — HTTP 200, 1 result(s), top `Strömsholmsskogen`, semanticDegraded=false, 2019 ms.
- category_discovery: `pizza` — HTTP 200, 10 result(s), top `Pizza & Kolgrill`, semanticDegraded=false, 411 ms.
- semantic_english: `date night` — HTTP 200, 10 result(s), top `Karlssons salonger`, semanticDegraded=false, 1467 ms.
- semantic_swedish: `dejt` — HTTP 200, 10 result(s), top `Dumme mosse`, semanticDegraded=false, 1412 ms.
- live_event: `this weekend` — HTTP 200, 1 result(s), top `Dans, musik och aktiviteter för hela familjen`, semanticDegraded=false, 1217 ms.

## Accepted fail-open evidence

Provider failure leaves HTTP/search available via deterministic retrieval and sets `semanticDegraded=true`; accepted evidence verified 6/6 injected timeout samples without damaging deployment.

## Status

DEMO_RELEASE_READY = TRUE
DEMO_CORPUS_LOGICAL_IDENTITY = VERIFIED
REPRESENTATION_ONLY_DRIFT = ACKNOWLEDGED
FINAL_EVALUATION_CANDIDATE_FROZEN = FALSE
PERF_REVALIDATION_STATUS = BLOCKED_DEFERRED
SEALED_ACCESSED = FALSE
ADVERSARIAL_ACCESSED = FALSE

## Limitations

- PERF revalidation is BLOCKED and deferred; latency targets are not claimed as passed.
- Voyage retains an intermittent 700 ms deadline reliability risk.
- Published Event inventory is small (3 Events at the pinned corpus state).
- Literal today/idag is outside the frozen supported time-parser contract.
- The frozen DEV clock is evaluation-only; product/demo uses current Europe/Stockholm time.
- Representation-sensitive document/embedding checksums differ, while canonical logical content and vector fingerprints remain verified.

## Remaining submission documentation gaps

- SUBMISSION-DOCS-01: expand README from bootstrap wording to the implemented install, Expo, Edge, migration, search, EN/SV, Event, evaluation, and demo paths.
- SUBMISSION-DOCS-01: add the required docs/trial-review sources, architecture/search overview, evaluation report, known issues/cuts, and submission checklist artifacts.
