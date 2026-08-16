# FINAL-EVAL-DEV-TUNE-01 retrieval diagnostics

- Decision: `TUNING_REJECTED`; retain `eval-03-baseline.v1`.
- Inputs remained pinned to manifest `f51638a4…`, inventory `2b224606…`, judgments `e604ba9…`, and the same 60 DEV queries.
- All 27 Hybrid `CANDIDATE_RETRIEVAL` failures were inspected against existing stage functions and frozen Hybrid telemetry.
- Root causes: 16 public top-20 depth saturation; 5 conservative `shouldEmbed` false decisions with no deterministic candidate; 6 selected missing targets absent from deterministic stages and semantic cap 30.
- Language split: EN `8/2/3`, SV `7/3/3`, mixed `1/0/0` in depth / shouldEmbed / semantic-absence order.
- Family split: broad concentration `0/2/0`; broad discovery `3/1/0`; geo `3/0/0`; semantic `6/2/6`; taxonomy `4/0/0`.
- Segments: semantic family 14; broad discovery 4; known-item family 0; taxonomy/category 4.

The plurality cause is not a safe tuning target: those 16 queries already return 20 judged-relevant results, and the public contract is capped at 20. Raising semantic depth from 30 cannot change semantic-only top-20 ordering for the six semantic-absence cases under unchanged RRF.

The only bounded candidate was the explicitly tunable `shouldEmbed` broad vocabulary. Adding `places to eat`, `något roligt`, and `något kul` changed exactly three diagnosed false decisions to `BROAD_DISCOVERY` in the unit precheck (35/35 tests passed), without protected-status knowledge or another DB call.

The required live precheck then timed out at the frozen 700 ms Voyage limit. Together with the earlier cap diagnostic, task-local provider telemetry was 0/2 successes and 2/2 timeouts. The timeout was not raised. Candidate code was reverted, no search config was created, and no 60-query tuned campaign was run.

The accepted recovered baseline remains valid: 60/60 Hybrid; R@20 `0.414699`; P@5 `0.600000`; NDCG@5 `0.750696`; zero results `19`; hard-constraint violations `0`; non-collapse moves/promotions `0/0`; provider `26/26` successful.

SEALED and adversarial were not accessed. No corpus, judgment, inventory, taxonomy, Event, document, embedding, eligibility, protected-exact, RRF, model, dimension, or timeout change was made. `SPEC_CHANGE_REQUIRED = NONE`.
