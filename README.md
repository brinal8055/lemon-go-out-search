# Lemon Going-Out Search

Lemon is a bilingual mobile search experience for finding real places and Events across Jönköping municipality, Sweden. A person should be able to type a known place, a category, a typo, a natural-language intent, Swedish or English, or a time-aware Event request—and get useful results from one search box.

That deceptively simple interaction is the point of the project. Each query calls for different evidence: names and aliases for a known place, taxonomy for category discovery, time-aware lifecycle rules for Events, and multilingual semantic retrieval for intent. Lemon combines those paths without asking the user to understand which one they need.

## What I built

This is a complete, hosted vertical slice:

- React Native / Expo mobile application with English and Swedish UI;
- direct place search with canonical names, verified aliases, prefix and bounded typo handling;
- category and discovery search over a bilingual, evidence-backed taxonomy;
- additive natural-language semantic search in English and Swedish;
- first-class Events with deterministic relative-time parsing and Europe/Stockholm interpretation;
- geographic Jönköping-municipality eligibility;
- versioned ingestion, canonical Place/Event identity, provenance, and duplicate-review boundaries;
- deterministic SearchDocuments and multilingual Voyage embeddings;
- hybrid PostgreSQL retrieval with exact pgvector, fixed RRF fusion, and deterministic ranking;
- deterministic lexical/taxonomy/Event fallback when the embedding provider is unavailable; and
- versioned evaluation infrastructure and a hosted Supabase deployment.

The hosted corpus contains **392 published Places**, **3 published Events**, **395 active SearchDocuments**, and **395 compatible READY embeddings**. Event coverage is intentionally bounded: the system models the lifecycle correctly and is ready for more approved adapters, without pretending to be a complete local Event calendar.

## The four-day journey

**Day 1 — understand the problem before writing search code.** I started with source rights, municipality scope, canonical identity, taxonomy, and provenance. PostgreSQL was selected as the sole canonical and search datastore, avoiding premature Typesense, OpenSearch, or ANN infrastructure.

**Day 2 — build reliable real-data foundations.** The work established versioned source observations, replayable parsing, conservative duplicate review, geographic eligibility, deterministic SearchDocuments, and a paced embedding lifecycle. The important outcome was not simply importing data; it was retaining the evidence needed to explain and safely update it.

**Day 3 — make different search modes feel like one box.** Protected exact and alias behavior, prefix/typo matching, FTS, taxonomy, Event/time, geo, and semantic retrieval became independent candidate families. Fixed RRF brought those candidates together while preserving known-item behavior and deterministic failure modes.

**Day 4 — evaluate, deploy, and refine the product.** The hosted corpus and versioned judgments supported lexical-versus-hybrid comparison, Edge deployment, physical iPhone validation, and mobile interaction polish. Production telemetry also made a recent short natural-language routing issue straightforward to diagnose: `shouldEmbed` had skipped semantic retrieval for queries such as “something casual,” rather than Voyage or PostgreSQL failing. The focused correction now routes those requests semantically without broadening the search contract.

For the fuller engineering narrative, see the [implementation journey](docs/implementation/journey.md).

## What changed my mind while building it

- **Trustworthy inventory and taxonomy matter more than a clever engine.** Retrieval cannot rescue weak, duplicated, or unsupported source truth.
- **A second datastore was not justified at this scale.** PostgreSQL already provides transactional domain data, B-tree access, `pg_trgm`, FTS, PostGIS, and pgvector.
- **Exact search and semantic discovery are different evidence.** They should contribute separately rather than compete through one opaque score.
- **Semantic search is strongest as an additive path.** It improves discovery but never replaces deterministic retrieval.
- **Events need their own lifecycle.** Treating an occurrence as a tag on a place loses cancellation, expiry, schedule, and venue semantics.
- **Ambiguous duplicate detection should be conservative.** Temporary duplication is less harmful than a destructive false merge.
- **Query routing needs observability.** The semantic-routing diagnosis was a routing false negative, not an AI-provider failure.
- **Mobile hierarchy shapes perceived search quality.** A results-first interface made the same backend capability quicker to discover and use.

## Search architecture

One search box feeds several independently useful retrieval methods:

```text
React Native / Expo
  → Supabase Edge Function
  → optional Voyage query embedding
  → one PostgreSQL api.search_v1 RPC
  → eligibility
  → exact / alias / prefix / trigram / FTS / taxonomy / Event-time / geo / semantic candidates
  → canonical union
  → protected exact tier
  → fixed RRF
  → deterministic result projection
```

The Edge Function is a thin public boundary. PostgreSQL applies eligibility before every candidate path, protects eligible accent-preserving canonical exact matches and qualifying unambiguous aliases, then combines ordinary evidence with fixed `RRF_V1` (`k=60`). Broad discovery has a deterministic non-collapse step that applies only after relevance and never alters known-item or narrow taxonomy behavior.

The [search architecture overview](docs/architecture/search-overview.md) explains the data model, trust boundary, trade-offs, and extension seams in more depth.

## Why PostgreSQL instead of a search engine

At roughly 400 entities, PostgreSQL already provides the capabilities Lemon needs: B-tree exact/prefix access, `pg_trgm` typo matching, weighted full-text search, PostGIS geography, pgvector, and transactional source/canonical records. Adding a second engine would have created a canonical database → projection worker → synchronization → reconciliation → index-lifecycle problem without a demonstrated relevance benefit.

The data and search boundaries leave room for a dedicated projection later, but only if benchmarks and corpus scale justify the operational cost. Until then, one database keeps correctness, provenance, and retrieval close together.

## Semantic search

Lemon uses Voyage `voyage-4` with 1024-dimensional multilingual document and query vectors. Search uses exact pgvector retrieval with a 700 ms provider deadline; raw query vectors are not persisted. Semantic candidates are additive, so a provider timeout or failure still leaves lexical, taxonomy, Event, and geo search usable.

AI does not invent Place or Event truth. Source evidence, canonical identity, and taxonomy remain deterministic, reviewable product data.

## Real data and truthfulness

The corpus is grounded in OpenStreetMap, an approved Jönköping municipal public-asset source, and an approved municipal Event-calendar pipeline. Source captures are versioned and kept distinct from Lemon’s canonical truth; changes in external evidence do not silently rewrite a Place or Event.

The active taxonomy is evidence-backed and bilingual. Where legitimate local supply is limited, the system keeps that limitation honest rather than fabricating listings or stretching adjacent categories. Google Maps is not scraped.

## Events and time

Events are first-class records with their own start/end times, status, cancellation and expiry rules, and optional venue relationship. Relative-time parsing uses the Europe/Stockholm product clock and deterministic half-open intervals. Supported language includes `tonight` / `ikväll`, `tomorrow` / `imorgon`, weekdays, `this weekend` / `i helgen`, and `next weekend` / `nästa helg`. Literal `today` / `idag` is intentionally outside the parser vocabulary.

## Evaluation

The repository contains a versioned evaluation design covering 60 DEV queries, sealed held-out queries, and adversarial cases across exact names, aliases, typos, category, broad discovery, EN/SV semantic intent, Events/time, geo, and hard constraints. Historical DEV evidence recorded hybrid Recall@20 `0.4147`, Precision@5 `0.6000`, NDCG@5 `0.7507`, known-item Hit@1 `0.5714`, Hit@3 `1.0000`, and MRR `0.7143`; it showed a material improvement in documented semantic and discovery cases over lexical-only retrieval.

The recent routing correction is focused-tested and deployed, but that historical evaluation is not presented as a fresh full validation of the current routing lineage. The sealed and adversarial sets remain the next independent release-validation layer; their query contents are intentionally not exposed here. See [evaluation artifacts](evaluation/README.md) for the corpus discipline and retained evidence.

## Production evolution

The implementation prioritizes correctness, relevance, and diagnosability. Hosted-path measurements identified Edge/DB end-to-end latency as the next bounded optimization area; the design already separates provider, database, and Edge timing, so this is a profiling problem rather than a redesign.

Natural next steps include additional approved Event adapters, scheduled ingestion, deeper query-plan and connection-path optimization, richer evidence-backed attributes, a larger bilingual benchmark, independent sealed/adversarial release validation, more municipalities, and only later an ANN or dedicated projection when measured scale warrants it.

## Mobile experience

The mobile app uses Expo SDK 54, React Native, and the current App Store Expo Go app. It presents results first, supports a segmented English/Swedish control, keeps categories collapsible, and renders distinct Place and Event cards with loading, empty, and degraded-search states.

## Run it

From the repository root:

```bash
pnpm install

EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL='https://zrxdjorrwcunprbykdtg.supabase.co/functions/v1/search' \
pnpm --filter @lemon/mobile dev
```

Install or open the current App Store **Expo Go** app on an iPhone, scan the QR code with the iPhone Camera, and open the project. **Xcode is not required** for this Expo Go workflow.

For local backend work, use `pnpm db:start`, `pnpm db:reset`, and `pnpm db:stop` with a Docker-compatible runtime. Configure secrets only in local backend environments or the Edge runtime—never in Expo configuration.

## Repository map

- `apps/mobile` — Expo / React Native client.
- `supabase/functions/search` — public Edge search boundary.
- `supabase/migrations` — PostgreSQL schema, retrieval contract, and access controls.
- `packages` — domain contracts, normalization, ingestion, embeddings, search documents, time parsing, and evaluation helpers.
- `reference` — source, taxonomy, and geography records.
- `evaluation` — versioned corpus, manifests, judgments, and reports.
- `docs/architecture` and `docs/implementation` — architecture overview, journey, and frozen engineering authorities.

## Security

The client receives one public Edge endpoint only. Voyage, service-role, and database credentials remain server-side. The Edge boundary makes one shaped `api.search_v1` RPC call, while private source evidence and provenance tables remain unavailable to public clients. Remote destructive-test guards and committed-secret checks help keep operational tooling separate from the mobile runtime.

## What I would build next

1. Add more approved Event adapters and scheduled source refreshes.
2. Profile and reduce hosted Edge/DB path latency.
3. Add richer evidence-backed Place and Event attributes.
4. Expand bilingual evaluation and run independent release validation.
5. Extend the same canonical/source model to additional municipalities.
6. Introduce ANN or a dedicated search projection only after measured scale requires it.

## Closing reflection

What began as a local search box turned out to be a problem about data rights, identity, provenance, ingestion reliability, taxonomy, multilingual retrieval, ranking, geography, Event lifecycle, evaluation, and mobile UX. That breadth is what made Lemon interesting: useful search depends as much on trustworthy data and explicit failure behavior as on the ranking algorithm.

For deeper design evidence, see the [architecture overview](docs/architecture/search-overview.md), [implementation journey](docs/implementation/journey.md), [frozen architecture](docs/architecture/Final_Architecture_v1_0.md), and [frozen technical specification](docs/specification/Final_Technical_Specification_v1_0.md).
