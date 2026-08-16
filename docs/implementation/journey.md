# Building Lemon Going-Out Search

Lemon was built as a four-day vertical slice for real local discovery in Jönköping municipality. The goal was not to demonstrate a single retrieval technique; it was to make a small mobile experience credible by giving its data, ranking, and failure behavior a solid engineering foundation.

## Day 1 — establish what can be trusted

The first decision was to treat sources, identity, and geography as product requirements rather than import details. Source rights and retention boundaries shaped which adapters could be used. The municipality boundary was versioned as data, and source observations were separated from canonical Place and Event truth.

That separation mattered immediately. A source can change, a parser can improve, and two records can be ambiguous without any of those facts being permission to silently rewrite a user-facing place. PostgreSQL was chosen as both the canonical and search datastore because it could hold those transactional boundaries alongside exact, text, geographic, and vector retrieval—without adding synchronization infrastructure before it was needed.

## Day 2 — turn source data into repeatable inventory

The data path became versioned capture, parsing, validation, conservative duplicate handling, canonical publication, SearchDocument generation, and embedding lifecycle management. The work included OpenStreetMap, approved municipal public assets, and an approved municipal Event source, with provenance retained for canonical facts.

Several practical lessons came from this stage. Municipality-boundary acquisition and source-policy review were as consequential as schema work. Provider limits required paced embedding backfill rather than an optimistic bulk request. Restarting a local database also made it clear that ephemeral working state is not evidence; the hosted corpus and versioned manifests became the durable basis for real-world validation.

## Day 3 — make retrieval modes cooperate

Search was built as a set of diagnosable candidate families, not a single score. Exact and verified alias matches protect known-place behavior. Prefix, typo matching, full-text search, taxonomy, Event/time, and geographic paths provide deterministic discovery. Voyage vectors add multilingual intent matching through exact pgvector retrieval.

Fixed reciprocal-rank fusion provides a transparent way to combine those families. Semantic search is additive and fail-open: if the provider misses its deadline, deterministic paths remain usable. Events were kept distinct from Places so their schedules, cancellation, expiry, and venue relationships could be handled honestly.

## Day 4 — evaluate, deploy, and refine the experience

The final stage brought the real corpus to hosted Supabase, froze versioned evaluation material, compared lexical and hybrid retrieval, and tested the public Edge path and mobile experience. A representation-only checksum drift was resolved by distinguishing data identity from serialization, rather than treating formatting as a corpus change.

The mobile client was aligned with Expo Go on SDK 54 and refined around a results-first hierarchy, bilingual control, and clear loading, empty, and degraded states. This was not cosmetic work: placing discovery controls ahead of results made good backend behavior feel harder to access.

One useful operational diagnosis came directly from Edge telemetry. Short natural-language queries such as “something casual” were not semantically weak because Voyage or PostgreSQL had failed; the routing heuristic had decided not to request an embedding. The focused `shouldEmbed` correction addressed that false negative and now treats time plus semantic intent as a mixed constraint. Observability made a bounded correction possible instead of an unnecessary ranking redesign.

## Deliberate boundaries

Several tempting additions were intentionally left out: a second search datastore, ANN indexing, automated cross-source merging, request-time scraping, LLM query rewriting or reranking, and fabricated supply for sparse taxonomy leaves. Each would have increased operational or correctness risk without serving the four-day product goal.

The current architecture is therefore narrow by design: one public Edge boundary, one PostgreSQL search contract, exact vector retrieval, versioned data evidence, and clear extension seams.

## Production evolution

The next phase is additive rather than corrective: approved Event sources and scheduled refreshes can expand inventory; hosted-path profiling can improve latency; richer source-supported attributes can improve cards and filters; and broader bilingual evaluation can increase confidence as the corpus grows. A dedicated search projection or ANN index remains a future option only when measured corpus size and benchmarks justify the extra synchronization responsibility.

The deeper technical rules are recorded in the frozen [architecture](../architecture/Final_Architecture_v1_0.md) and [technical specification](../specification/Final_Technical_Specification_v1_0.md).
