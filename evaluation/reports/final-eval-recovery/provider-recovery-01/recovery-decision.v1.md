# FINAL-EVAL-PROVIDER-RECOVERY-01

- Decision: `PROVIDER_RECOVERED`
- Contract: Voyage / voyage-4 / query / 1024 / 700 ms
- Probe: 10 attempted, 10 succeeded, 0 timeouts, 0 HTTP 429, 0 other failures
- Latency p50 / p95 / max: 437.731 / 478.369 / 478.369 ms
- Vector validation: 10/10 valid dimension and finite
- Circuit transitions: 10 `CLOSED -> CLOSED`
- Prior failures: one request exceeded the deadline before headers; one HTTP 200 response body exceeded the deadline
- Implementation fix: response-body deadline aborts now normalize to `PROVIDER_TIMEOUT`; timeout and breaker settings are unchanged
- Search/corpus writes: none
- Full DEV rerun: not started
- SEALED/adversarial: not accessed
- SPEC_CHANGE_REQUIRED: none
- Next: `FINAL-EVAL-DEV-RUN`
