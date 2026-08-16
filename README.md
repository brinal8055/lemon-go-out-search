# Lemon Going-Out Search

Lemon is a bilingual (English and Swedish) going-out search trial for Jönköping municipality, Sweden. It has a React Native / Expo mobile client and a Supabase/PostgreSQL backend for direct-name, category, semantic-discovery, and time-aware Event search.

## Demo / quick start

Use Expo SDK 54 and the current App Store Expo Go app on an iPhone:

```bash
EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL='https://zrxdjorrwcunprbykdtg.supabase.co/functions/v1/search' \
pnpm --filter @lemon/mobile dev
```

Scan the QR code with the iPhone Camera and open the link in Expo Go. The mobile client needs only this public Edge URL; it never receives database, service-role, or Voyage credentials. See [the demo guide](docs/trial-review/demo-guide.md) for a 3–5 minute walkthrough.

## Architecture

```text
React Native / Expo
  → Supabase Edge Function (`search`)
  → optional Voyage query embedding
  → one PostgreSQL `api.search_v1` RPC
  → exact / alias / prefix / trigram / FTS / taxonomy / Event / geo / vector retrieval
  → fixed RRF and deterministic result projection
```

PostgreSQL is the sole canonical and search datastore. Vector retrieval uses exact pgvector; there is no ANN index and no secondary search engine. [Architecture and search overview](docs/trial-review/architecture-search-overview.md) records the reviewer-facing boundary.

## Search behavior

- Protected canonical exact matches and qualifying verified aliases preserve known-item behavior.
- Prefix and bounded typo matching support ordinary name search.
- The active bilingual taxonomy supports category discovery.
- English and Swedish natural-language discovery can add semantic candidates.
- Events are first-class records, separate from Places, and use Europe/Stockholm relative-time parsing.
- If Voyage is unavailable or exceeds its deadline, deterministic retrieval remains available and the response identifies the degraded semantic state.

Supported relative expressions include `tonight` / `ikväll`, `tomorrow` / `imorgon`, weekdays, `this weekend` / `i helgen`, and `next weekend` / `nästa helg`. Literal `today` / `idag` is intentionally unsupported.

## Hosted demo data and semantic contract

The hosted `zrxdjorrwcunprbykdtg` trial corpus has:

- 392 published Places;
- 3 published Events;
- 395 active SearchDocuments;
- 395 compatible READY embeddings; and
- no fixtures.

The trial sources include OpenStreetMap, Jönköping municipal Utegym, and the approved municipal Event-calendar pipeline. This is a bounded Jönköping municipality corpus, not a claim of complete local coverage.

Semantic search uses Voyage `voyage-4`, 1024 dimensions, exact pgvector retrieval, and a 700 ms provider deadline. Raw query vectors are not persisted.

## Evaluation and current status

Historical accepted DEV evidence for the pre-`9c32af4` routing lineage reports hybrid Recall@20 `0.4147`, Precision@5 `0.6000`, NDCG@5 `0.7507`, known-item Hit@1 `0.5714`, Hit@3 `1.0000`, and MRR `0.7143`; hard-constraint violations were `0`. Hybrid materially improved the documented discovery and semantic cases over lexical-only retrieval. QA was revalidated for that accepted lineage.

The current `9c32af4` semantic-routing correction was focused-tested and deployed for this demo package, but it has **not** received a fresh full DEV evaluation or QA revalidation. The final evaluation candidate is therefore not frozen; SEALED and adversarial suites remain unopened.

Functional validation is complete for the demo package. Performance revalidation remains `PERF_BLOCKED_DEFERRED`: an earlier hosted revalidation found a latency regression, so no latency SLO is claimed as passed. Voyage request latency is also an external dependency, with deterministic fail-open behavior.

See the [demo submission state](evaluation/reports/demo-submission-package-01/submission-state.v1.md) and [submission checklist](docs/trial-review/submission-checklist.md) for the exact status.

## Security

The client calls only the public Edge Function. Voyage, service, and database secrets remain server-side. The Edge Function makes one shaped `api.search_v1` RPC call; private source and provenance tables are not publicly exposed.

## Repository structure

- `apps/mobile` — Expo / React Native mobile client.
- `supabase/functions/search` — public Edge search boundary.
- `packages` — contracts, normalization, ingestion, embeddings, search documents, time parsing, and evaluation helpers.
- `scripts` — validation and operational commands.
- `evaluation` — versioned manifests and evaluation evidence.
- `docs/trial-review` — reviewer-oriented demo and architecture documentation.

## Local development and validation

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm env:scan-secrets
pnpm --filter @lemon/mobile dev
```

For local Supabase work, use `pnpm db:start`, `pnpm db:reset`, and `pnpm db:stop` with a Docker-compatible runtime. Configure secrets only in local backend environments or the Edge runtime; do not add them to Expo configuration or commit them.

## Known limitations

- Event inventory is intentionally small.
- `today` / `idag` is not a supported literal.
- The trial covers Jönköping municipality only.
- Semantic provider latency may trigger deterministic fail-open.
- Performance revalidation is deferred and not represented as a passed latency gate.
- Final DEV/QA revalidation, candidate freeze, SEALED, adversarial, and EVAL-04 remain outstanding for the `9c32af4` lineage.
