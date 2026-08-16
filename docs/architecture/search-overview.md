# Lemon search architecture

Lemon keeps the public search experience simple while preserving the evidence and lifecycle rules that make local recommendations trustworthy. A mobile user sees one bilingual search box; behind it, independent retrieval paths contribute different kinds of evidence.

## Public boundary

```text
Expo mobile → Supabase Edge search function → api.search_v1 → private app schema
```

The mobile client has only the public Edge URL. Database, service, and Voyage credentials stay server-side. The Edge function makes one shaped PostgreSQL RPC call; private source evidence, provenance, and operational tables are not exposed to the client.

## Data model and truth boundary

External source identity is deliberately separate from Lemon canonical identity:

```text
Source → SourceRecord → immutable SourceRecordVersion → ParseAttempt
                                      ↓
                         selected successful evidence pair
                                      ↓
                    canonical Place or Event, with provenance
```

This prevents a new capture, parser rerun, or source correction from silently changing a canonical Place or Event. Source observations are versioned; canonical updates are explicit. Duplicate review is conservative and evidence-pinned, preserving temporary uncertainty instead of risking destructive automatic merges.

Places and Events are separate canonical concepts. A Place is a persistent destination. An Event is a scheduled occurrence with timing, status, cancellation, expiry, and an optional venue relationship. That distinction keeps expired or cancelled Events out of search without making incorrect claims about the underlying venue.

## Retrieval and ranking

PostgreSQL is the only canonical and search datastore. It supports these candidate families:

- canonical and verified-alias exact matches for known items;
- prefix and `pg_trgm` typo matching for ordinary names;
- weighted full-text search and the active bilingual taxonomy for discovery;
- Event/time and geographic retrieval for contextual constraints; and
- additive semantic retrieval through exact pgvector search.

Eligibility is applied before protected exact behavior and before every weaker candidate path. Eligible accent-preserving canonical exact names and qualifying unambiguous aliases are protected. Ordinary candidate lists are combined with fixed `RRF_V1` (`k=60`), then projected deterministically. A broad-only non-collapse step can reduce repetitive groups after relevance, but never changes known-item or narrow-taxonomy behavior and never promotes clearly weaker results.

## Semantic behavior

Voyage `voyage-4` provides multilingual query embeddings with 1024 dimensions and a 700 ms deadline. PostgreSQL performs exact pgvector retrieval; there is no ANN index or external vector datastore. Query vectors are transient and never stored.

Semantic retrieval is additive, not authoritative. If the provider is unavailable or too slow, Lemon continues with deterministic lexical, taxonomy, Event, and geo retrieval and reports the degraded semantic state. AI never creates Place, Event, or taxonomy truth.

## Why one PostgreSQL system

For this corpus size, PostgreSQL combines the transactional domain model with B-tree indexing, `pg_trgm`, FTS, PostGIS, and pgvector. A dedicated search engine would add a projection pipeline, synchronization and reconciliation concerns, and index lifecycle management before there is evidence that it improves relevance. The public API and SearchDocument boundary leave a clean extension seam if future benchmarks justify a separate projection.

## Operational extension points

The current design is intentionally ready for measured evolution:

- approved source adapters can add legitimate inventory while preserving source-version history;
- scheduled ingestion can advance selected evidence without collapsing it into canonical truth;
- more Event adapters can extend coverage without changing Place semantics;
- latency work can target provider, Edge, or database timing independently; and
- a different index strategy can be assessed only when corpus scale and benchmarks justify its synchronization cost.

The frozen [architecture](Final_Architecture_v1_0.md) and [technical specification](../specification/Final_Technical_Specification_v1_0.md) remain the detailed engineering authorities.
