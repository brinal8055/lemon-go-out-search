# Demo submission package checklist

- [x] Repository clean before demo-package documentation work.
- [x] Expo SDK 54 / App Store Expo Go startup path documented.
- [x] Hosted `search` Edge Function active (deployment version 6).
- [x] Hosted logical corpus recorded: 392 Places, 3 Events, 395 active SearchDocuments, 395 compatible READY embeddings, 0 fixtures.
- [x] Direct deployed smoke: `Strömsholmsskogen`, HTTP 200, exact top result.
- [x] Category deployed smoke: `pizza`, HTTP 200, 10 results.
- [x] Short-discovery regressions: `something casual` and `any fun activities`, HTTP 200, 10 results each.
- [x] Swedish semantic smoke: `dejt`, HTTP 200, 10 results.
- [x] Current-clock Event check is truthful: `this weekend` returned no eligible Event; historical positive evidence is linked in the demo guide.
- [x] Focused routing/time/Edge tests, mobile test, typecheck, lint, committed-secret scan, and `git diff --check` pass.
- [x] Public-safe documentation contains no credentials.
- [x] `PERF_BLOCKED_DEFERRED` is disclosed; no latency target is claimed as passed.
- [x] SEALED and adversarial remain untouched.

## Not final frozen submission acceptance

`DEMO_SUBMISSION_PACKAGE_READY = TRUE`.

`FINAL_SUBMISSION_GATE_SATISFIED = FALSE`. The `9c32af4` routing correction needs fresh DEV validation and any required QA revalidation before performance work, candidate freeze, SEALED, adversarial, EVAL-04, and the final frozen submission gate.
