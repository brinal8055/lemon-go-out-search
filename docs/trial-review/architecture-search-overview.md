# Architecture and search overview

## Public path

```text
Expo mobile → Supabase Edge `search` → `api.search_v1` → private `app` schema
```

The mobile app has only the public Edge URL. Database, service, and Voyage credentials remain server-side. The Edge Function makes one shaped PostgreSQL RPC call; private source evidence and provenance relations are not exposed to the client.

## Retrieval and ranking

PostgreSQL is the only canonical and search datastore. Candidate families are canonical and verified-alias exact, prefix, pg_trgm typo matching, weighted FTS, taxonomy, Event/time, geo, and additive semantic exact-pgvector retrieval. Eligibility is enforced before protected exact behavior and all weaker retrieval paths.

Known canonical exact matches and qualifying unambiguous verified aliases are protected. Candidate families are combined with fixed `RRF_V1` (`k=60`), then a deterministic broad-only non-collapse step. There is no learned ranker, LLM reranker, ANN index, or secondary search engine.

## Semantic and Event behavior

Semantic retrieval uses Voyage `voyage-4`, query input, 1024 dimensions, and a 700 ms deadline. It performs exact pgvector retrieval only. A provider failure returns deterministic results with a degraded semantic state; raw query vectors are not persisted.

Events are distinct canonical records rather than Place tags. Relative-time parsing uses the current Europe/Stockholm product clock and half-open Event intervals. Supported expressions are limited to the documented parser vocabulary; `today` / `idag` is not supported.

## Demo-package boundary

The deployed `search` function is active on hosted project `zrxdjorrwcunprbykdtg`. This documentation describes the founder/demo package, not final frozen acceptance: the `9c32af4` routing change is focused-tested and deployed, but fresh DEV/QA, performance revalidation, candidate freeze, SEALED, adversarial, and EVAL-04 remain outstanding.
