# Lemon Going-Out Search — Final Technical Specification v1.0

**Architecture authority:** Lemon Going-Out Search — Final Architecture v1.0 (`ARCHITECTURE_APPROVED`)  
**Product/acceptance authority:** Requirements Baseline v1.1  
**Technical status:** `TECHNICAL_SPECIFICATION_APPROVED`  
**Final independent score:** `9.6995 / 10.000`  
**Scope:** One-engineer, four-day, production-quality vertical slice for the full Jönköping municipality

## Executive Summary

This document is the sole implementation-facing technical contract for the Lemon Going-Out Search four-day trial. It specifies a React Native/Expo mobile application, a thin Supabase Edge search boundary, one canonical Supabase/PostgreSQL datastore, offline source ingestion, deterministic and semantic retrieval, simple RRF fusion, broad-discovery non-collapse, diagnostics, evaluation, deployment, rollback, and trial-review artifacts.

The implementation preserves these central invariants:

- Source identity is `Source → SourceRecord → immutable SourceRecordVersion → rerunnable SourceRecordParseAttempt`.
- Source-current evidence is the explicitly selected successful `(version, parse attempt)` pair and is independent of canonical truth.
- Place and Event are separate canonical subtypes and lifecycle concepts.
- No heuristic cross-source auto-merge occurs; duplicate decisions are manual, append-only, evidence-pinned, and reversible.
- The active EN/SV hierarchical taxonomy is the only Going-Out taxonomy and is multi-label.
- Full Jönköping municipality eligibility uses versioned PostGIS boundaries.
- Public search makes one Edge-to-PostgreSQL RPC. Eligibility is applied before every retrieval/protection path.
- Eligible accent-preserving canonical exact and qualifying verified alias exact are protected. Prefix, trigram, FTS, taxonomy, Event/time, geo, and exact pgvector retrieval are additive ordinary evidence.
- Semantic failure degrades to deterministic search. Embeddings are the only launch AI dependency.
- Fixed RRF fuses ordinary lists. Broad discovery prevents pathological group collapse without promoting clearly weaker results for variety.
- Coverage is truthful: an active taxonomy leaf is `COMPLETE`, `SUPPLY_CONSTRAINED`, or `NEEDS_VALIDATION`; scarcity is never filled with fabricated or weakly classified entities.
- No request-time scraping, enrichment, canonical mutation, document generation, or document embedding occurs.

No consolidation conflict was found.

## Authority and Scope

This Final Technical Specification v1.0 supersedes the following as the implementation-facing technical contract:

- Lemon Going-Out Search — Technical Specification v1;
- Lemon Going-Out Search — Technical Specification Amendment v1.1; and
- Lemon Going-Out Search — Technical Specification Amendment v1.2.

Those documents remain historical review/decision records. Final Architecture v1.0 remains the architectural authority. Requirements Baseline v1.1 remains the product and acceptance authority. Architecture Research may support a declared tunable but cannot override an approved contract.

This Final Technical Specification v1.0 is a lossless consolidation of the approved Technical Specification v1 plus Technical Specification Amendments v1.1 and v1.2. Precedence within the consolidated contract is v1.2 over v1.1 over v1; no approved MUST is intentionally shortened into a recommendation or tunable.

Normative terms:

- **MUST:** hard implementation contract. Changing an architecture-frozen item requires ADR/architecture review; changing another technical-contract-frozen item requires an explicit specification amendment.
- **SHOULD:** default implementation choice; deviation requires a concrete documented engineering reason and must preserve every MUST/test.
- **TUNABLE:** versioned value expected to change through development-set evaluation or benchmarking without architecture review.
- **DEFERRED:** outside the four-day implementation.

This document defines the implementation contract; it is not the Implementation Plan and contains no implementation tasks or production code.

## Repository / Module Boundaries

### MUST repository layout

```text
lemon-going-out/
├── apps/
│   └── mobile/                       # Expo/React Native; Edge API client only
├── supabase/
│   ├── config.toml
│   ├── migrations/                   # extensions, schema, functions, grants, seeds
│   ├── functions/search/             # thin public Edge Function
│   └── seed.sql                       # reproducible local seed entrypoint
├── packages/
│   ├── contracts/                    # public TS request/response and shared enums
│   ├── normalization/                # deterministic name/query normalization
│   ├── time-parser/                  # EN/SV parser with injectable clock
│   ├── ingestion-domain/             # six-stage orchestration/contracts
│   ├── source-adapters/              # bounded selected adapters
│   ├── search-documents/             # deterministic projection/hash builder
│   ├── embeddings/                   # query/document embedding client + validation
│   ├── evaluation/                   # corpus, runner, judgments, metrics
│   └── diagnostics/                  # restricted explain/review tooling
├── reference/
│   ├── taxonomy/{active-going-out.v1.yaml,source-mappings.v1.yaml,checksum.txt}
│   ├── geography/{jonkoping-municipality.<version>.geojson,metadata.yaml}
│   └── sources/registry.<environment>.yaml
├── evaluation/{corpus.v1.jsonl,judgments.v1.jsonl,dataset-manifest.v1.json,expected-invariants.v1.yaml}
├── tests/{fixtures,unit,db,api,relevance,mobile-smoke}/
├── scripts/
│   ├── ingest.ts
│   ├── reparse-source-version.ts
│   ├── rebuild-search-documents.ts
│   ├── embed-documents.ts
│   ├── expire-events.ts
│   ├── revalidate-boundary.ts
│   ├── coverage-report.ts
│   ├── evaluate.ts
│   ├── diagnose-search.ts
│   └── verify-deployment.ts
├── docs/trial-review/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

Dependency direction:

```text
mobile → contracts → Edge API
Edge → contracts + normalization + time-parser + embeddings → api.search_v1
source-adapters → ingestion-domain → canonical database
canonical data → search-documents → embeddings
evaluation → public Edge API + restricted diagnostics
```

- Source adapters MUST NOT import ranking SQL, search configuration, evaluation judgments, or mobile code.
- Search-document generation may read canonical/source-backed facts but MUST NOT write canonical truth.
- Contracts contain no writer interfaces or secrets.
- SQL stages live in migrations/versioned SQL, not runtime string-built SQL.
- No additional service, queue, cache, crawler framework, outbox, or projector is introduced.

### SHOULD tooling

Use TypeScript, pnpm workspaces, Vitest, Supabase CLI, and Expo tooling. Equivalent test/package tooling may be chosen if it preserves the module boundaries and reproducible commands.

## Domain Types and State Machines

### PostgreSQL conventions

- Private tables/internal functions use schema `app`; public DB entry uses `api`; restricted explain functions use `diagnostic`.
- Data API exposes `api` only. `app` and `diagnostic` are not exposed schemas.
- Required extensions: `postgis`, `pg_trgm`, `unaccent`, `vector`, `pgcrypto`. No ANN index.
- IDs are `uuid DEFAULT gen_random_uuid()` except stable configuration/version strings.
- Instants use `timestamptz`; scope timezone is `Europe/Stockholm` for trial calendar interpretation.
- Mutable rows have `created_at` and `updated_at`; immutable observations have capture/observation timestamps and no general update path.
- SHA-256 hashes are lowercase `char(64)` with a hexadecimal CHECK.
- Display strings are preserved; normalized/accentless fields are separate.
- Canonical/source/history rows are not normally hard-deleted.

### Enums

| SQL enum | Values |
|---|---|
| `entity_type` | `PLACE`, `EVENT` |
| `publication_status` | `DRAFT`, `PUBLISHED`, `WITHHELD`, `MERGED` |
| `place_status` | `ACTIVE`, `TEMPORARILY_CLOSED`, `CLOSED`, `UNKNOWN` |
| `event_status` | `SCHEDULED`, `CANCELLED`, `COMPLETED`, `POSTPONED`, `UNKNOWN` |
| `duplicate_decision` | `OPEN`, `SAME`, `SEPARATE`, `UNSURE` |
| `taxonomy_membership_method` | `SOURCE_FACT`, `DETERMINISTIC_MAP`, `MANUAL` |
| `coverage_status` | `COMPLETE`, `SUPPLY_CONSTRAINED`, `NEEDS_VALIDATION` (artifact only) |
| `ingestion_run_status` | `STARTED`, `SUCCEEDED`, `PARTIAL`, `FAILED` |
| `source_refresh_mode` | `COMPLETE_SNAPSHOT`, `PAGINATED_SNAPSHOT`, `DELTA_ONLY` |
| `source_parse_attempt_status` | `STARTED`, `SUCCEEDED`, `FAILED` |
| `source_content_status` | `AVAILABLE`, `REDACTED` |
| `source_resolution_method` | `SOURCE_IDENTITY`, `SHARED_STABLE_ID`, `MANUAL_MAPPING`, `NEW_CANONICAL`, `UNRESOLVED` |
| `alias_kind` | `OFFICIAL`, `ALTERNATE`, `FORMER`, `CHAIN`, `MANUAL` |
| `embedding_status` | `READY`, `FAILED`, `STALE` |
| `fact_key` | `canonical_name`, `location`, `address`, `opening_hours`, `event_start`, `event_end`, `event_status` |

`VALIDATED` is not a canonical publication state. `UPCOMING` and `EXPIRED` are derived Event conditions. No immutable source-version validation enum exists; parser outcomes belong to parse attempts.

### Publication state

```text
DRAFT → PUBLISHED | WITHHELD | MERGED
WITHHELD → DRAFT | PUBLISHED | MERGED
PUBLISHED → WITHHELD | MERGED
MERGED → WITHHELD only through explicit merge reversal
```

DB constraints/triggers enforce subtype, scope/boundary, merged target, immutable type, and merged ineligibility. Application transactions enforce required provenance, taxonomy evidence, eligible location, active SearchDocument, and review decisions.

### Place state

`UNKNOWN → ACTIVE|TEMPORARILY_CLOSED|CLOSED`; `ACTIVE ↔ TEMPORARILY_CLOSED`; either may become `CLOSED`. Reopening CLOSED requires newer authoritative/manual evidence. ACTIVE, TEMPORARILY_CLOSED, and UNKNOWN are eligible; CLOSED is not. Source disappearance never changes Place state.

### Event state

`UNKNOWN → SCHEDULED|CANCELLED|POSTPONED`; `SCHEDULED → CANCELLED|COMPLETED|POSTPONED`; `POSTPONED → SCHEDULED|CANCELLED`. Only SCHEDULED is eligible. CANCELLED/COMPLETED may return to SCHEDULED only through newer authoritative correction. Time expiry is derived and withholds publication without inventing source status.

### Duplicate decision

An initial append-only OPEN/OPEN_REVIEW decision is followed by SAME, SEPARATE, or UNSURE. Any change in selected source version or successful parse-attempt identity makes a finalized decision stale. Before another SAME, SEPARATE, or UNSURE can be accepted, the candidate MUST append or confirm a current OPEN/OPEN_REVIEW decision that pins the new current evidence. Decisions are never overwritten. Incorrect SAME repair executes the recorded inverse before appending the required OPEN decision.

### Ingestion run

`STARTED → SUCCEEDED|PARTIAL|FAILED`; terminal runs are immutable. Retrying a terminal run creates a new run linked by `retry_of_run_id`.

## Final PostgreSQL Schema

All table names below are exact and belong to `app` unless qualified otherwise. FKs use `ON DELETE RESTRICT` unless stated. Normal writer roles have only the privileges explicitly described.

### `geographic_scopes`

| Column | Type/null/default | Contract |
|---|---|---|
| `id` | `uuid PK DEFAULT gen_random_uuid()` | Stable scope ID |
| `slug` | `text NOT NULL UNIQUE` | Immutable slug |
| `scope_type` | `text NOT NULL DEFAULT 'MUNICIPALITY'` | CHECK `MUNICIPALITY|CITY|REGION` |
| `name_en`, `name_sv` | `text NOT NULL` | Localized names |
| `timezone` | `text NOT NULL` | IANA timezone; `Europe/Stockholm` for trial |
| `country_code` | `char(2) NOT NULL` | Uppercase; `SE` for trial |
| `is_active` | `boolean NOT NULL DEFAULT false` | Reference scope active |
| `public_search_enabled` | `boolean NOT NULL DEFAULT false` | Public maintenance gate |
| timestamps | `timestamptz NOT NULL DEFAULT now()` | `created_at`, `updated_at` |

Indexes: partial `(slug) WHERE is_active`; `(public_search_enabled)`. Writer: migration/reference-data role. No delete after reference. Public search requires both flags true.

### `geographic_scope_boundaries`

Columns: `id uuid PK`, `scope_id uuid NOT NULL FK`, `version text NOT NULL`, `boundary geometry(MultiPolygon,4326) NOT NULL`, `source_name text NOT NULL`, `source_url text NOT NULL`, `licence text NOT NULL`, `attribution text NOT NULL`, `source_checksum char(64) NOT NULL`, `effective_from timestamptz NOT NULL`, `effective_to timestamptz NULL`, `is_active boolean NOT NULL DEFAULT false`, timestamps.

Constraints/indexes: `UNIQUE(scope_id,version)`, `UNIQUE(id,scope_id)`, partial `UNIQUE(scope_id) WHERE is_active`; valid/non-empty SRID 4326 geometry; `effective_to > effective_from`; GiST `boundary`; `(scope_id,effective_from DESC)`. Writer: reference-data role. Rows are immutable except activation/effective end. Rollback reactivates a prior row.

### `canonical_entities`

Columns: `id uuid PK`, `entity_type entity_type NOT NULL`, `canonical_name text NOT NULL`, `canonical_name_norm text NOT NULL`, `canonical_name_ascii text NOT NULL`, `publication_status publication_status NOT NULL DEFAULT 'DRAFT'`, `scope_id uuid NULL FK`, `scope_boundary_id uuid NULL`, `chain_key text NULL`, `chain_key_method text NULL CHECK SOURCE_STABLE_ID|MANUAL`, `merged_into_id uuid NULL self-FK`, `published_at timestamptz NULL`, timestamps.

Constraints/indexes: canonical name is intentionally non-unique; composite FK `(scope_boundary_id,scope_id)` to boundary; paired chain key/method; PUBLISHED requires scope, active boundary, subtype truth, eligible location, and `published_at`; MERGED requires non-self `merged_into_id`. Deferred trigger enforces exactly one matching subtype, no merge cycle, and non-merged target. Entity type is immutable. Partial accent-preserving/accentless prefix indexes by scope for PUBLISHED non-merged entities; `(scope_id,entity_type,publication_status)`, `(merged_into_id)`, partial `(chain_key)`. Writer: canonical ingestion/review. Chain grouping uses explicit source identity or manual review only—never normalized-name inference.

### `places`

Columns: `entity_id uuid PK/FK canonical_entities`, `location geography(Point,4326) NULL`, `street_address text NULL`, `postal_code text NULL`, `locality text NULL`, `country_code char(2) NOT NULL DEFAULT 'SE'`, `official_url text NULL`, `phone text NULL`, `status place_status NOT NULL DEFAULT 'UNKNOWN'`, `opening_hours jsonb NULL`, `opening_hours_verified boolean NOT NULL DEFAULT false`, `last_authoritative_observed_at timestamptz NULL`, timestamps.

Checks/indexes: publication requires location; hours must be a validated JSON object; GiST `location`; `(status)`. Writer: canonical ingestion/review. Disappearance never closes a Place; hard delete prohibited.

### `events`

Columns: `entity_id uuid PK/FK canonical_entities`, `venue_place_id uuid NULL FK places`, `standalone_venue_name text NULL`, `location geography(Point,4326) NULL`, standalone address fields, `starts_at timestamptz NOT NULL`, `ends_at timestamptz NULL`, `source_timezone text NOT NULL`, `status event_status NOT NULL DEFAULT 'UNKNOWN'`, `status_observed_at timestamptz NOT NULL`, `event_start_source_record_id uuid NOT NULL FK source_records`, `event_end_source_record_id uuid NULL FK source_records`, `event_status_source_record_id uuid NOT NULL FK source_records`, `information_url text NULL`, timestamps.

Checks/indexes: `ends_at IS NULL OR ends_at > starts_at`; if `ends_at` exists, `event_end_source_record_id` is required; either linked Place or standalone venue name plus point exists. Trigger enforces EVENT subtype, PLACE venue subtype, same scope, location, and evidence-record consistency. Partial `(starts_at,COALESCE(ends_at,starts_at),status) WHERE status='SCHEDULED'`; `(venue_place_id)`; indexes on three evidence-record FKs; GiST location. Writer: canonical ingestion/review; expiry changes publication eligibility, not source status.

### `sources`

Columns: `id uuid PK`, `key text UNIQUE NOT NULL`, `name text NOT NULL`, `kind text NOT NULL CHECK OSM_OVERPASS|MUNICIPAL|WIKIDATA|OFFICIAL_SITE|MANUAL|EVENT_FEED`, `base_url text NULL`, `licence text NOT NULL`, `licence_url text NULL`, `terms_url text NULL`, `attribution text NOT NULL`, `persistence_permission text NOT NULL CHECK FULL_PAYLOAD|EXTRACTED_FIELDS_ONLY|METADATA_ONLY`, `refresh_mode source_refresh_mode NOT NULL`, positive paired rate-limit request/window integers, `adapter_version text NOT NULL`, `credentials_secret_name text NULL`, `enabled boolean NOT NULL DEFAULT false`, `last_successful_refresh timestamptz NULL`, timestamps.

`last_successful_refresh` is optional stored materialization only, never independent truth. If stored, the ingestion finalization transaction sets it to the exact qualifying-run-derived value defined in **Ingestion Contract**. A constraint/integration test compares the materialized value with that formula; on mismatch the run-derived value governs and the materialization is repaired.

Index `(enabled,key)`. Writer: source-registry/admin. Enable only with licence, attribution, permission, adapter version, and refresh mode. Disable rather than delete.

### `ingestion_runs`

Columns: `id uuid PK`, `idempotency_key text UNIQUE NOT NULL`, `source_id uuid NOT NULL FK`, `scope_id uuid NOT NULL FK`, `adapter_version text NOT NULL`, `parser_version text NOT NULL`, `mapping_version text NOT NULL`, `retry_of_run_id uuid NULL self-FK`, `snapshot_key text NULL`, `refresh_unit_complete boolean NOT NULL DEFAULT false`, `snapshot_complete boolean NULL`, `status ingestion_run_status NOT NULL DEFAULT 'STARTED'`, start/finish timestamps, non-negative counters `fetched`, `valid`, `invalid`, `new_count`, `changed`, `unchanged`, `unresolved_duplicates`, `disappeared`, `published`, `error_code text NULL`, bounded `error_summary jsonb NULL`, `created_at`.

Checks: STARTED has no finish; terminal has finish. SUCCEEDED requires `refresh_unit_complete=true`. COMPLETE/PAGINATED snapshots additionally require `snapshot_complete=true`; DELTA_ONLY requires `snapshot_complete IS NULL` and cannot produce disappearance. Error summary contains codes/counts only, max 16 KiB. Indexes `(source_id,started_at DESC)`, `(status,started_at)`, `(retry_of_run_id)`. Writer: ingestion; terminal rows immutable.

### `source_records`

Columns: `id uuid PK`, `source_id uuid NOT NULL FK`, `external_key text NOT NULL`, `canonical_url text NULL`, paired `shared_identifier_scheme/value text NULL`, `canonical_entity_id uuid NULL FK`, `resolution_method source_resolution_method NOT NULL DEFAULT 'UNRESOLVED'`, `first_seen_at timestamptz NOT NULL`, `last_seen_at timestamptz NOT NULL`, `current_version_id uuid NULL`, `current_parse_attempt_id uuid NULL`, `miss_count integer NOT NULL DEFAULT 0`, `is_missing boolean NOT NULL DEFAULT false`, `last_complete_snapshot_run_id uuid NULL FK ingestion_runs`, timestamps.

Constraints/indexes: `UNIQUE(source_id,external_key)`; shared-ID fields paired; current version/attempt both NULL or both non-NULL; deferred FKs/triggers require the version belongs to this record and the attempt is SUCCEEDED and references it. Indexes `(canonical_entity_id)`, partial shared ID, `(source_id,is_missing,last_seen_at)`, `(current_version_id)`, `(current_parse_attempt_id)`. Source/external key immutable. One record maps to at most one entity. Writer: ingestion/review. Current pair means selected successful source evidence, not canonical truth.

### `source_record_versions`

Columns: `id uuid PK`, `source_record_id uuid NOT NULL FK`, `capture_run_id uuid NOT NULL FK ingestion_runs`, `content_hash char(64) NOT NULL`, `payload jsonb NULL`, `payload_storage_mode text NOT NULL CHECK FULL_PAYLOAD|EXTRACTED_ENVELOPE|METADATA_ENVELOPE`, permitted fetch metadata (`source_url`, `http_etag`, `http_last_modified`), `fetched_at timestamptz NOT NULL`, `observed_at timestamptz NOT NULL`, `content_status source_content_status NOT NULL DEFAULT 'AVAILABLE'`, `redaction_reason text NULL`, `redacted_at timestamptz NULL`, `redacted_by text NULL`, `redaction_operation_id uuid NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.

Constraints/indexes: `UNIQUE(source_record_id,content_hash)`; AVAILABLE requires payload and no redaction fields; REDACTED requires NULL payload and all redaction fields. `(source_record_id,observed_at DESC)`, `(capture_run_id)`, `(content_status)`. Writer: capture path; immutable after insert except privileged compliance redaction. Parser version/status/error do not belong here.

### `source_record_parse_attempts`

Columns: `id uuid PK`, `source_record_version_id uuid NOT NULL FK`, `ingestion_run_id uuid NOT NULL FK`, `parser_version text NOT NULL`, `status source_parse_attempt_status NOT NULL DEFAULT 'STARTED'`, `attempted_at timestamptz NOT NULL DEFAULT now()`, `finished_at timestamptz NULL`, `error_class text NULL`, `error_code text NULL`, `normalized_output jsonb NULL`, `normalized_output_hash char(64) NULL`, `output_redacted_at timestamptz NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.

Constraints/indexes: `UNIQUE(source_record_version_id,parser_version,ingestion_run_id)`. STARTED has no result/error/finish; SUCCEEDED has finish/hash/output unless privileged output redaction and no error; FAILED has finish/error class/code and no output/hash. Terminal attempts are immutable except privileged removal of prohibited normalized output while retaining identity/hash/status. Indexes `(source_record_version_id,attempted_at DESC)`, `(ingestion_run_id)`, partial `(source_record_version_id,parser_version) WHERE status='SUCCEEDED'`. Writer: ingestion parser; compliance has sole output-redaction exception.

### `canonical_fact_provenance`

Columns: `id uuid PK`, `entity_id uuid NOT NULL FK`, `fact_key fact_key NOT NULL`, `source_record_version_id uuid NOT NULL FK`, `selection_method text NOT NULL CHECK SOURCE_PRECEDENCE|MANUAL`, `selected_at timestamptz NOT NULL DEFAULT now()`, `is_current boolean NOT NULL DEFAULT true`, `superseded_at timestamptz NULL`, `note text NULL`, `created_by text NOT NULL`.

Partial `UNIQUE(entity_id,fact_key) WHERE is_current`; CHECK current iff no superseded timestamp; indexes `(entity_id,fact_key,selected_at DESC)`, `(source_record_version_id)`. Writer: canonical updater/reviewer. Replacement locks current, marks it historical, and inserts new current in one transaction. Taxonomy provenance remains on memberships. No hard delete.

### `entity_aliases`

Columns: `id uuid PK`, `entity_id uuid NOT NULL FK`, `alias text NOT NULL`, `alias_norm text NOT NULL`, `alias_ascii text NOT NULL`, `language text NOT NULL CHECK en|sv|und`, `kind alias_kind NOT NULL`, `source_record_version_id uuid NULL FK`, `verified boolean NOT NULL DEFAULT false`, `verified_by text NULL`, `verified_at timestamptz NULL`, `active boolean NOT NULL DEFAULT true`, timestamps.

Constraints/indexes: verified fields paired; source-backed aliases require evidence; MANUAL requires verifier; `UNIQUE(entity_id,alias_norm,kind)`; active exact/prefix B-tree and trigram GIN on normalized/accentless aliases; `(entity_id,active)`. Writer: ingestion/review. Deactivate, do not delete.

### `duplicate_candidates`

Columns: `id uuid PK`, ordered `record_a_id uuid NOT NULL FK`, `record_b_id uuid NOT NULL FK`, `entity_a_id uuid NULL FK`, `entity_b_id uuid NULL FK`, bounded `evidence_summary jsonb NOT NULL`, `evidence_hash char(64) NOT NULL`, `status duplicate_decision NOT NULL`, `current_decision_id uuid NOT NULL`, timestamps.

Constraints/indexes: `record_a_id < record_b_id`; `UNIQUE(record_a_id,record_b_id)`; current decision FK is `DEFERRABLE INITIALLY DEFERRED`; partial `(created_at) WHERE status='OPEN'`; record/entity indexes. Candidate and initial OPEN decision insert atomically. Candidate stores current status/pointer only; decision-specific reviewer/merge/reversal history lives below.

### `duplicate_candidate_decisions`

Columns: `id uuid PK`, `duplicate_candidate_id uuid NOT NULL FK`, `decision duplicate_decision NOT NULL`, `operation_type text NOT NULL CHECK OPEN_REVIEW|LINK_RECORD|MERGE_ENTITIES|NO_MERGE|UNSURE`, `reviewer text NOT NULL`, `decided_at timestamptz NOT NULL DEFAULT now()`, `evidence_version_ids uuid[] NOT NULL`, `evidence_parse_attempt_ids uuid[] NOT NULL`, `evidence_hash char(64) NOT NULL`, `supersedes_decision_id uuid NULL self-FK`, `target_entity_id uuid NULL FK`, `survivor_entity_id uuid NULL FK`, `loser_entity_id uuid NULL FK`, bounded `resolution_detail jsonb NULL`, `note text NULL`.

Constraints: both evidence arrays have cardinality 2 and equal cardinality; position 1/2 maps to candidate record A/B. Transaction/trigger verifies each version belongs to its positioned record and each attempt is SUCCEEDED and belongs to that version. `UNIQUE(supersedes_decision_id)` creates one linear chain. OPEN↔OPEN_REVIEW; SAME↔LINK_RECORD or MERGE_ENTITIES; SEPARATE↔NO_MERGE; UNSURE↔UNSURE. LINK requires target only; MERGE requires distinct survivor/loser; non-SAME forbids entity targets. Rows append-only. New decision supersedes current and atomically updates candidate pointer/status/hash.

### `taxonomy_nodes`

Columns: `id uuid PK`, `slug text NOT NULL`, `parent_id uuid NULL FK`, `taxonomy_version text NOT NULL`, `taxonomy_checksum char(64) NOT NULL`, `label_en text NOT NULL`, `label_sv text NOT NULL`, `depth smallint NOT NULL`, `path uuid[] NOT NULL`, `is_leaf boolean NOT NULL`, `active boolean NOT NULL DEFAULT true`, timestamps.

Constraints/indexes: `UNIQUE(taxonomy_version,slug)`; non-negative depth; trigger enforces acyclic same-version parentage and exact path/depth; seed test enforces leaf state. `(taxonomy_version,parent_id,active)`, GIN path, `(active,is_leaf)`. Writer: migration/taxonomy seed; version/deactivate, not destructive edit.

### `taxonomy_aliases`

Columns: `id uuid PK`, `taxonomy_node_id uuid NOT NULL FK`, `language text NOT NULL CHECK en|sv|und`, `alias text NOT NULL`, `alias_norm text NOT NULL`, `alias_ascii text NOT NULL`, `active boolean NOT NULL DEFAULT true`, timestamps. `UNIQUE(taxonomy_node_id,language,alias_norm)`; active exact/accentless indexes. Writer: taxonomy seed/review.

### `entity_taxonomy_memberships`

Columns: `id uuid PK`, `entity_id uuid NOT NULL FK`, `taxonomy_node_id uuid NOT NULL FK`, `method taxonomy_membership_method NOT NULL`, `source_record_version_id uuid NULL FK`, `mapping_ref text NULL`, `manual_evidence text NULL`, `reviewed_by text NULL`, `active boolean NOT NULL DEFAULT true`, timestamps.

Partial `UNIQUE(entity_id,taxonomy_node_id) WHERE active`; active taxonomy/entity and evidence indexes. SOURCE_FACT requires version; DETERMINISTIC_MAP requires version+mapping ref; MANUAL requires evidence+reviewer. AI output is never taxonomy truth. Deactivate/replace to preserve evidence.

### `search_documents`

Columns: `id uuid PK`, `entity_id uuid NOT NULL FK`, `document_version text NOT NULL`, `template_version text NOT NULL`, `content_hash char(64) NOT NULL`, `display_name text NOT NULL`, `names_text text NOT NULL`, `aliases_text text NOT NULL`, `taxonomy_en_text text NOT NULL`, `taxonomy_sv_text text NOT NULL`, `facts_text text NOT NULL`, `description_text text NOT NULL`, `event_context_text text NOT NULL DEFAULT ''`, `embedding_text text NOT NULL`, `fts tsvector NOT NULL`, `generated_at timestamptz NOT NULL`, `is_active boolean NOT NULL DEFAULT true`, `created_at timestamptz NOT NULL DEFAULT now()`.

`UNIQUE(entity_id,template_version,content_hash)`; partial `UNIQUE(entity_id) WHERE is_active`; active FTS GIN; entity/hash indexes. Writer: projection builder. Canonical change creates/reuses a deterministic evidence-grounded version, deactivates prior document, and marks dependent embeddings STALE in one transaction.

### `embeddings`

Columns: `id uuid PK`, `search_document_id uuid NOT NULL FK`, `entity_id uuid NOT NULL FK`, `provider text NOT NULL`, `model text NOT NULL`, `model_revision text NOT NULL`, `dimension smallint NOT NULL`, `metric text NOT NULL DEFAULT 'cosine'`, `embedding vector NULL`, `document_hash char(64) NOT NULL`, `status embedding_status NOT NULL`, `attempt_key text NOT NULL UNIQUE`, `attempted_at timestamptz NOT NULL`, `generated_at timestamptz NULL`, `error_class text NULL`, `error_code text NULL`, `stale_reason text NULL`, `created_at timestamptz NOT NULL DEFAULT now()`.

Checks:

- READY: vector non-NULL, `vector_dims=dimension`, all values finite and vector non-zero, generated time present, document hash/model contract matches, no error/stale reason.
- FAILED: vector NULL, attempted model/document/dimension contract and attempted time present, generated time absent, error class/code present, stale reason absent. FAILED is terminal and immutable.
- STALE: only a previously READY row may enter this state; its vector MUST remain non-NULL, finite, non-zero, dimension-valid and stored; its original `generated_at` MUST remain preserved; stale reason is required and active error fields are absent.

Partial READY uniqueness includes `(search_document_id,provider,model,model_revision,dimension) WHERE status='READY'`. Index model/dimension/status and entity/status. Semantic retrieval reads READY only. No HNSW/IVFFlat. New attempt rows may be inserted as READY or FAILED; direct STALE insertion is rejected. A constraint trigger rejects every normal post-insert mutation except `READY → STALE` and requires that transition to preserve vector and `generated_at`. FAILED cannot transition to READY or STALE. Retrying FAILED inserts a new row with a new unique `attempt_key`, preserving the failed attempt. Writer: embedding runner; document/model change marks old READY vectors STALE while retaining their vectors and generation timestamps.

### `search_configs`

One typed versioned table: `version text PK`, `config_checksum char(64) UNIQUE NOT NULL`, `is_active boolean NOT NULL DEFAULT false`, `prefix_min_length smallint NOT NULL`, `trigram_min_length smallint NOT NULL`, `trigram_threshold real NOT NULL`, positive `exact_cap/prefix_cap/trigram_cap/fts_cap/taxonomy_cap/event_cap/semantic_cap smallint NOT NULL`, `rrf_k smallint NOT NULL`, `semantic_enabled boolean NOT NULL`, `embedding_provider/model/revision text NOT NULL`, `embedding_dimension smallint NOT NULL`, `embedding_timeout_ms integer NOT NULL`, `semantic_trigger_terms text[] NOT NULL DEFAULT '{}'`, `event_horizon_days smallint NOT NULL`, `event_freshness_by_source jsonb NOT NULL`, `radius_cap_m integer NOT NULL`, `noncollapse_enabled boolean NOT NULL`, `broad_terms text[] NOT NULL DEFAULT '{}'`, `taxonomy_group_depth smallint NOT NULL`, `comparable_rrf_ratio real NOT NULL`, `top_k_group_cap smallint NOT NULL`, `chain_repetition_cap smallint NOT NULL`, `event_venue_repetition_cap smallint NOT NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `activated_at timestamptz NULL`, `created_by text NOT NULL`, `note text NULL`.

Partial `UNIQUE((true)) WHERE is_active`; values bounded; freshness JSON shape `{sourceKey:{toleranceHours,nearTermHours,refreshTargetHours}}`. Writer: deployment/relevance-admin. Activation is atomic and rollback reactivates a retained version. This is configuration, not a policy engine.

### Ownership and deletion summary

| Area | Writer | Update/deletion rule |
|---|---|---|
| Geography/taxonomy/source registry | migration/reference admin | Version/deactivate; no referenced hard delete |
| Source capture/attempts/runs | ingestion | Append/finalize; versions immutable except compliance redaction |
| Canonical/subtypes/provenance/membership | canonical updater/reviewer | Transactional, history-preserving; no normal hard delete |
| Duplicate review | reviewer/system OPEN actor | Decisions append-only; candidate pointer/status mutable |
| Search documents/embeddings | projection/embedding runner | Version/deactivate/stale; rebuildable prohibited text may be purged |
| Search config | relevance/deployment admin | Version/activate/rollback; no in-place tuning |

## Source Capture and Parser Replay

### Source adapter contract

```ts
interface SourceAdapter<TCursor = unknown> {
  readonly config: {
    sourceKey: string;
    adapterVersion: string;
    refreshMode: 'COMPLETE_SNAPSHOT' | 'PAGINATED_SNAPSHOT' | 'DELTA_ONLY';
  };
  fetchPage(input: { cursor?: TCursor; signal: AbortSignal }): Promise<{
    items: unknown[];
    nextCursor?: TCursor;
    refreshUnitComplete: boolean;
    snapshotComplete?: boolean;
    fetchMeta: Record<string, string | number | null>;
  }>;
  externalStableId(raw: unknown): string;
  observedAt(raw: unknown, fetchMeta: unknown): Date;
  captureEnvelope(raw: unknown): unknown;
  parse(captured: unknown): NormalizedSourceRecord;
}

type NormalizedSourceRecord = {
  sourceKey: string;
  externalKey: string;
  entityType: 'PLACE' | 'EVENT';
  observedAt: ISOInstant;
  sharedStableId?: { scheme: string; value: string };
  names: Array<{ value: string; language: 'en'|'sv'|'und'; kind: string }>;
  place?: { location?: LatLng; address?: Address; status?: string; openingHours?: unknown };
  event?: { startsAt: ISOInstant; endsAt?: ISOInstant; timezone: string; status: string; venue?: VenueEvidence };
  sourceCategories: string[];
  explicitFacts: Record<string, unknown>;
  permittedEvidenceRefs: string[];
};
```

Adapters may differ in HTTP, paging, file, or manual acquisition behavior. The common output—not a crawler framework—is the contract. The selected trial adapters are bounded OSM/Overpass, selected Jönköping municipal data, official-site/manual or Wikidata enrichment, and one bounded Event source. Each registry entry declares licence, terms, attribution, persistence permission, rate limits, credentials reference, enabled state, adapter version, refresh mode, and external-key semantics.

Adapter profiles: OSM/Overpass uses stable element type+ID and a confirmed complete bounded query before disappearance; municipal adapters use declared dataset feature IDs and the dataset's published snapshot/delta contract; Wikidata uses QID only for explicit enrichment/shared identity; official/manual enrichment requires a stored explicit mapping; the selected Event adapter uses its published event/occurrence ID and declared refresh mode. None may infer identity from normalized name.

### Immutable capture and rerunnable parse

1. Fetch produces source observations and metadata.
2. Capture occurs before parse. The permitted envelope is hashed and inserted/reused by `(source_record_id,content_hash)`.
3. SourceRecordVersion represents immutable external content identity. It owns neither parser version nor validity.
4. Every parser execution creates/resumes a `source_record_parse_attempts` row keyed by `(version,parser_version,run)`.
5. Parser v1 may fail while v2 later succeeds against the same version H. H is not duplicated; both attempts remain diagnosable.
6. A terminal failed run retry creates a new ingestion run/attempt. A transient retry in the same live run resumes its STARTED attempt.
7. Canonical last-good truth persists until a later canonical transaction succeeds or an existing compliance/eligibility rule withholds it.

Classification:

| Class | Exact meaning |
|---|---|
| `NEW` | New `(source,external_key)` SourceRecord |
| `CHANGED` | Existing record with a newly captured content hash |
| `UNCHANGED` | Same known hash observed; update last-seen/counters, no new version |
| `INVALID` | Parse/validation attempt FAILED; version itself is not permanently invalid |
| `UNRESOLVED_DUPLICATE` | Successful valid evidence cannot safely resolve without manual review |
| `DISAPPEARED` | Previously observed record absent from a confirmed complete snapshot under configured rules |

DISAPPEARED is permitted only after COMPLETE_SNAPSHOT/PAGINATED_SNAPSHOT succeeds with confirmed completeness. It sets missing evidence/counters but never closes a Place. DELTA_ONLY absence means nothing.

## Source-Current Evidence

`source_records.current_version_id + current_parse_attempt_id` identify the currently selected successfully parsed and validated source evidence for that SourceRecord. They are both NULL or both non-NULL. The attempt must be SUCCEEDED, reference that version, and the version must belong to that record.

The pair may exist when `canonical_entity_id IS NULL`, duplicate review is unresolved, resolution failed, or canonical truth remains older. A FAILED newer attempt never replaces the prior successful pair. Parser v2 can replace parser v1 as selected evidence over the same version H without changing canonical truth.

“Current” is an explicit serialized selection, not `MAX(finished_at)`:

1. lock SourceRecord;
2. validate the SourceRecord owns the version and the attempt belongs to that version;
3. validate attempt status is SUCCEEDED, source content is AVAILABLE/legally usable, and the parser/output validation contract passes;
4. verify the attempt belongs to the active ingestion/parser execution that the caller is explicitly selecting;
5. compare caller's expected prior pair with the locked actual pair;
6. atomically update both columns; and
7. fail stale on mismatch. The loser of a race re-reads and re-evaluates; timestamps are diagnostic only.

An arbitrary historical SUCCEEDED attempt cannot become current merely because it belongs to the version. Selection is an explicit transaction-owned action tied to the named active run/parser execution. Parse completion and selection SHOULD occur in the same short transaction; if operational retry separates them, all checks and expected-pair CAS semantics still apply.

Entity resolution/canonical processing consumes an explicit immutable execution:

```ts
type SourceEvidenceExecution = {
  sourceRecordId: UUID;
  sourceRecordVersionId: UUID;
  sourceRecordParseAttemptId: UUID;
};
```

When processing current evidence, the transaction rechecks success, version/record ownership, and equality to the locked current pair. If the pair changed, it aborts before canonical mutation and re-evaluates current evidence. A different parse attempt over the same version is a distinct processing input.

## Canonical Truth and Provenance

Source-current evidence is not canonical truth. Selecting a new SourceRecord pair MUST NOT automatically mutate CanonicalEntity, Place, Event, taxonomy memberships, canonical fact provenance, SearchDocument, Embedding, or publication state.

Canonical truth changes only in the approved resolution/canonical/taxonomy transaction. It may validly remain on prior evidence while newer source-current evidence awaits duplicate review, conflicts with current facts, or fails publication requirements.

### Identity/subtype invariants

| Invariant | Enforcement |
|---|---|
| Entity type immutable | SQL trigger + test |
| Exactly one subtype matching type | Deferred SQL constraint trigger + test |
| Same canonical name may identify multiple entities | Absence of uniqueness + same-name test |
| SourceRecord resolves to at most one CanonicalEntity | Single nullable FK + transaction/test |
| Source external key unique | `UNIQUE(source_id,external_key)` |
| MERGED entities ineligible | eligibility predicate + publication/merge constraints |
| Event venue link targets Place in same scope | deferred trigger + test |
| Standalone Event has venue name and point | CHECK/trigger + test |
| Published entity has active boundary/location | transition trigger + test |

### Targeted fact vocabulary

| Fact key | Singular/current | Publication significance | Default precedence and refresh sensitivity |
|---|---:|---|---|
| `canonical_name` | Yes | Required | official/municipal > OSM/Wikidata > manual correction; refresh on source change |
| `location` | Yes | Required | authoritative coordinates > OSM > manual; boundary-sensitive |
| `address` | Yes | Place/standalone Event required when applicable | official/municipal > OSM > manual |
| `opening_hours` | Yes | Optional; never fabricate | official > OSM > manual; freshness-sensitive |
| `event_start` | Yes | Event required | selected Event source/official correction; near-term freshness-sensitive |
| `event_end` | Yes when present | Optional; no default duration | same occurrence source; freshness-sensitive |
| `event_status` | Yes | Event required | explicit selected status source/official correction; cancellation-sensitive |

Replacement locks the current row, marks it `is_current=false` with `superseded_at`, and inserts one new current row. Partial uniqueness enforces one current selection per `(entity_id,fact_key)` while retaining history. Taxonomy provenance belongs to membership rows.

Source revocation workflow follows `source → records → versions → current critical provenance/memberships → affected entities`, then selects permitted alternative evidence or WITHHOLDS/rebuilds affected projections.

### Compliance redaction

Normal SourceRecordVersion content is immutable. The sole exception is `app.redact_source_record_version(version_id,operation_id,reason)`:

- SECURITY DEFINER, owner `lemon_compliance_owner`, fixed empty `search_path`, fully qualified SQL, no dynamic SQL;
- EXECUTE only by runtime role `lemon_compliance`; that role has no direct table UPDATE or public/Edge membership;
- AVAILABLE→REDACTED is idempotent for the same operation ID and conflicts for a different operation;
- records `redacted_by = session_user`, the authenticated compliance operator; it MUST NOT use SECURITY DEFINER `current_user`, which identifies the function owner, and actor identity is not accepted as an untrusted argument;
- preserves version ID, SourceRecord ID, original content hash, observation/capture identity, allowed fetch metadata, and provenance relationships;
- removes payload and prohibited permitted metadata, records reason/time/session actor/operation ID;
- removes successful attempt normalized output while retaining its hash/status/identity and sets `output_redacted_at`;
- if the redacted execution is source-current, selects the latest still-permitted successful execution or atomically clears both current-pair columns when none exists;
- reselects alternative facts or WITHHOLDS affected entities, rebuilds sanitized documents, and purges prohibited derived document/vector content;
- sanitizes prohibited bounded duplicate summaries/notes while retaining candidate/decision IDs, version/attempt arrays, evidence hashes, and permitted metadata needed to identify the reviewed execution;
- logs only identifiers, counts, actor, reason code, and completion—never removed content.

The immutability trigger permits only this bounded transition. REDACTED content cannot be parser-replayed. Ordinary ingestion, review, API, diagnostic, and mobile roles cannot invoke or emulate it.

## Ingestion Contract

The six stages execute offline:

| Stage | Input → output | Transaction/idempotency | Failure and last-good rule |
|---|---|---|---|
| 1. Fetch | adapter config/cursor → raw observations + declared refresh completion | No DB truth mutation except run STARTED; run idempotency key includes source/scope/adapter/refresh execution | transient network/rate-limit retry bounded; permanent auth/terms/parser mismatch fails run |
| 2. Capture/version | permitted observation → SourceRecord + immutable version/reused hash | record `(source,external_key)`; version `(record,content_hash)`; short upsert transaction | capture precedes parse; partial fetch never creates disappearance evidence |
| 3. Parse/validate | exact version → parse attempt + normalized typed envelope | `(version,parser_version,run)`; terminal attempt immutable | FAILED leaves prior source-current/canonical truth; corrected parser may replay same version |
| 4. Resolve | explicit successful evidence execution → existing/new entity, or DuplicateCandidate | locks record/candidate as required; identity-only auto-link | ambiguity becomes UNRESOLVED_DUPLICATE, not heuristic merge |
| 5. Canonical/taxonomy | resolved execution → facts, targeted provenance, memberships | one transaction; recheck current evidence; mapping version part of processing identity | stale/conflicting evidence aborts; last-good canonical truth remains |
| 6. Projection/embedding/publication | committed canonical truth → SearchDocument, embedding attempt, publication | deterministic content hash; embedding attempt key; publication after hard invariants | FAILED semantic generation leaves deterministic search; no incomplete publication |

### Refresh/run semantics

- A refresh is healthy when run status SUCCEEDED and the adapter completed its declared refresh unit.
- COMPLETE_SNAPSHOT requires complete response; PAGINATED_SNAPSHOT requires every expected page and complete terminal cursor; only then may absence increment missing/disappearance state.
- Normative source refresh health is derived from ingestion-run history:

```text
last_successful_refresh(source) = MAX(ingestion_runs.finished_at) where
  ingestion_runs.source_id = source.id
  and status = SUCCEEDED
  and refresh_unit_complete = true
  and (
    source.refresh_mode = DELTA_ONLY
    or snapshot_complete = true
  )
```

- DELTA_ONLY successful poll therefore advances source refresh health; `snapshot_complete` is NULL; absence cannot affect record `last_seen_at`, missing state, Event observation freshness, cancellation, or disappearance.
- PARTIAL/FAILED never qualify for the formula and never create disappearance evidence.
- If `sources.last_successful_refresh` is retained for convenience, it is a transactionally maintained cache of this exact formula. It is updated only while finalizing a qualifying run. Run-derived semantics win on mismatch.
- Run counters are deterministic and telemetry reports fetched, valid, invalid, new, changed, unchanged, unresolved, disappeared, published.
- Retry after terminal failure creates a new run with `retry_of_run_id`; no duplicate SourceRecordVersion or canonical/source rows result.

### Source freshness versus evidence freshness

- Source freshness: when the adapter last successfully completed its declared refresh unit.
- Record/Event observation freshness: when the particular record or critical fact/status was actually observed.
- Expiry: whether Event time is past.
- Cancellation: an explicitly observed status.

Source outage changes none of cancellation, closure, or past evidence. Monitoring compares last successful refresh with source target; near-term Event eligibility separately compares critical evidence observations with source-specific tolerance.

## Entity Resolution and Duplicate Review

### Auto-link boundary

MAY auto-link only:

- same source + stable external key;
- a genuinely shared explicit stable identifier whose scheme is approved; or
- a previously manually approved cross-source mapping.

MUST NOT auto-link based on name similarity, coordinate proximity, address, domain, phone, or any combination of heuristic similarity. These fields may produce a bounded DuplicateCandidate for human review only.

### Evidence identity and hash

Each candidate is the unique ordered SourceRecord pair. Every decision pins two positionally paired arrays:

```text
record_a ↔ evidence_version_ids[1] ↔ evidence_parse_attempt_ids[1]
record_b ↔ evidence_version_ids[2] ↔ evidence_parse_attempt_ids[2]
```

Each version belongs to its record; each attempt is SUCCEEDED and belongs to its version. The evidence hash is SHA-256 over canonical ordered JSON containing candidate/record IDs, version IDs, parse-attempt IDs, parser versions, normalized-output hashes, and bounded legally permitted identity evidence. It never includes unrestricted/prohibited raw payload. H+A1 and H+A2 are different review executions even when H is identical.

### Reopen and reversal

For either side, if locked current `(version_id,parse_attempt_id)` is distinct from the active finalized decision's pair, the decision evidence is stale. No new SAME, SEPARATE, or UNSURE may be accepted against that stale evidence.

Mandatory sequencing is:

1. preserve the existing finalized decision and pinned evidence unchanged;
2. append or confirm a current OPEN/OPEN_REVIEW decision that supersedes it and pins the then-current evidence pairs; and
3. only after that OPEN_REVIEW is current may a reviewer append a new SAME, SEPARATE, or UNSURE based on those current pairs.

The OPEN_REVIEW may be appended by `SYSTEM:EVIDENCE_CHANGE`; it never auto-links or auto-merges. This rule applies to a new SourceRecordVersion and to a different successful ParseAttempt over the same version. If evidence changes again while OPEN review is pending, that OPEN evidence is stale and must be refreshed/reopened before finalization.

LINK_RECORD reversal restores the prior/unresolved mapping, reselects affected facts/memberships, and rebuilds projections. MERGE_ENTITIES reversal uses bounded `resolution_detail` and immutable source history to restore/separate entities. Repair succeeds before OPEN is appended.

### SAME Type A: unresolved record → existing entity

Lock candidate/current decision, both SourceRecords in UUID order, current evidence, target/used counterpart entities, then affected provenance/memberships. Recheck current decision, exact evidence pairs, unresolved status, target type/non-MERGED state, and absence of conflicting resolution. If stale, abort/reopen. If valid, link record with `MANUAL_MAPPING`, apply allowed canonical/provenance/taxonomy updates, and rebuild SearchDocument/embedding only if content changes. No loser entity or merge exists.

### SAME Type B: entity A + entity B

Under the same evidence rechecks, lock entities in UUID order; explicitly select survivor; relink appropriate SourceRecords; safely copy/deactivate aliases/memberships; update targeted provenance; mark loser MERGED/ineligible; rebuild survivor projection; record exact changed IDs/prior states for reversal. Abort before mutation on stale evidence.

Lock order is candidate → current decision → SourceRecords UUID order → CanonicalEntities UUID order → directly affected rows. Stale supersedes ID, changed evidence, different resolution, or MERGED/ineligible entity causes transaction conflict, not partial mutation.

## Taxonomy

- Node IDs are UUIDs; slugs are stable within version. Parent, depth, and UUID path represent hierarchy.
- Every node has EN/SV label; aliases are language-tagged and normalized/accentless.
- Taxonomy version and checksum identify the complete active seed. Active/leaf state is validated.
- Direct memberships prefer the most specific supported leaf. Parent query expands deterministically through `path`; it does not create synthetic memberships.
- Membership is multi-label and must be SOURCE_FACT, DETERMINISTIC_MAP, or MANUAL with required evidence.
- Source-category mapping is versioned YAML/JSON reference data keyed by source/category to taxonomy slugs. It is not a rule engine. AI cannot create taxonomy truth.
- Taxonomy recognition is deterministic over active labels/aliases. Narrow explicit leaf intent is preserved; parent queries include descendants with direct-leaf context preferred as a bounded tie-break after RRF.

Coverage report is a generated artifact, not runtime subsystem:

```ts
type CoverageRow = {
  taxonomyLeafId: UUID;
  taxonomyVersion: string;
  boundaryVersion: string;
  targetMin: 5;
  targetMax: 10;
  canonicalPublishedCount: number;
  sourceKeys: string[];
  ingestionRunIds: UUID[];
  status: 'COMPLETE' | 'SUPPLY_CONSTRAINED' | 'NEEDS_VALIDATION';
  generatedAt: string;
};
```

Scarce leaves report SUPPLY_CONSTRAINED with searched sources/runs; weak classifications report NEEDS_VALIDATION. Neither is padded.

## Geography

- SRID 4326 throughout. Boundaries use `geometry(MultiPolygon,4326)`; entity points use `geography(Point,4326)`; both have GiST indexes.
- Publication scope membership uses `ST_Covers(boundary, point::geometry)`, including boundary points. Invalid/missing coordinates make a Place/standalone Event ineligible; linked Events inherit their Place point.
- Publication stores both `scope_id` and active `scope_boundary_id`. Search filters that assignment and never merely trusts a source locality string.
- Radius input is capped by active config; eligibility uses `ST_DWithin(point,user_point,radius_m)` and result distance uses `ST_Distance`, both in metres.
- Future scopes insert separate scope/boundary/reference rows; no Jönköping-specific search branching is allowed.

Boundary activation command `scripts/revalidate-boundary.ts --scope <slug> --activate <version>`:

1. set `public_search_enabled=false` and commit;
2. validate candidate polygon/checksum/licence and atomically activate it while retaining prior version;
3. identify every non-MERGED entity assigned to scope and all unassigned entities with usable points near/candidate-covered by the boundary;
4. re-run `ST_Covers`, update scope/boundary assignment, WITHHOLD now-outside/invalid entities, and publish newly eligible entities only after all publication invariants;
5. rebuild changed SearchDocuments/embeddings and coverage artifact;
6. run restricted scope/search/coverage smoke; then enable public search.

Failure leaves scope gated. Rollback gates scope, reactivates prior boundary, repeats revalidation/projection, smokes, and re-enables. No separate job infrastructure is added.

## Event / Time / Freshness

### Event location, occurrence, and updates

- Linked Event search/display uses venue Place name and location. Standalone Event requires explicit venue name and point/address.
- Same occurrence from the same source is the same SourceRecord stable key. Cross-source same occurrence is not auto-merged unless explicit shared stable identity/manual mapping exists.
- Schedule update creates/reuses version, successful parse attempt, selected source-current pair, then approved canonical transaction. Cancellation requires explicit status evidence. Outage/absence is never cancellation.
- At-least-daily expiry withholds known-end Events when `ends_at <= now` and point Events when `starts_at < now`, preserving source status/history. Search applies the same predicate if the command is late. Inventory is bounded to active horizon plus short diagnostic history; no recurrence engine. Recurring source items are ingested only as explicit occurrences with stable occurrence keys.

### Half-open Event predicates

For request `[request_start,request_end)`:

```sql
-- Known end
events.starts_at < request_end
AND events.ends_at > request_start

-- Point event
request_start <= events.starts_at
AND events.starts_at < request_end
```

Known-end Event is current/future only while `ends_at > now`; `ends_at = now` is expired. Point Event is current/upcoming while `starts_at >= now` and expires once `starts_at < now`. No default duration is invented.

Authoritative Event eligibility additionally requires PUBLISHED/non-MERGED entity, enabled scope, SCHEDULED state, effective location, start before `now + horizon`, requested interval overlap if supplied, freshness, taxonomy/type/radius filters, and non-cancellation.

### Critical-source freshness

```text
schedule_freshness = min(
  start_record.last_seen_at,
  end_record.last_seen_at when ends_at exists
)
status_freshness = status_record.last_seen_at
effective_freshness = min(schedule_freshness,status_freshness)
```

The Event's start/end/status SourceRecord FKs correspond to current critical provenance. If facts come from different records, the most conservative required observation governs near-term eligibility; status freshness is independently diagnosable. A required missing record or observation older than its source-specific tolerance withholds a near-term SCHEDULED Event. CANCELLED is excluded immediately. Successful DELTA polling advances source health but only emitted records update their observations.

### Deterministic EN/SV time parser

The parser uses an injected clock and `Europe/Stockholm`; calendar arithmetic is performed in local time, then converted to instants using the timezone database. DST gaps advance to the first valid instant; overlaps use the earlier offset for start and later offset for end so the local interval is covered.

| Expression | Exact local half-open interval |
|---|---|
| `tonight`, `this evening`, `ikväll` | Target evening `[D 18:00,D+1 02:00)`. If local now is before 02:00, target starts D−1; otherwise D. Clamp start to now; if start ≥ end, return null. Evening boundaries are TUNABLE. |
| `tomorrow`, `imorgon` | next calendar day 00:00 → following day 00:00 |
| bare weekday (`Friday`, `fredag`, all EN/SV weekdays) | Next occurrence including today if its day has not ended; `[max(now,target 00:00),target+1 00:00)` |
| `this Friday`, `på fredag` and corresponding weekdays | Same next-occurrence rule; explicit `this`/`på` never selects a past day |
| `this weekend`, `i helgen` | Nearest Saturday whose weekend has not ended; `[max(now,Sat 00:00),Mon 00:00)` |
| `next weekend`, `nästa helg` | Saturday of the ISO week after the nearest/current weekend; `[Sat 00:00,Mon 00:00)` |
| `YYYY-MM-DD` | SHOULD support `[date 00:00,next date 00:00)`; locale-dependent numeric dates are unsupported |

Recognition is case-insensitive after query normalization. Multiple incompatible phrases return 422 `AMBIGUOUS_TIME`; a query phrase and structured interval may coexist only when identical. Unsupported expressions remain lexical text. No LLM/date parser is permitted.

Clock fixtures (Stockholm local time):

| Clock | Query | Expected local interval |
|---|---|---|
| Mon 2026-08-10 12:00 | tonight | Mon 18:00 → Tue 02:00 |
| Tue 2026-08-11 01:00 | ikväll | Tue 01:00 → 02:00 (prior evening clamped) |
| Mon 2026-08-10 12:00 | imorgon | Tue 00:00 → Wed 00:00 |
| Fri 2026-08-14 10:00 | Friday | Fri 10:00 → Sat 00:00 |
| Fri 2026-08-14 23:30 | på fredag | Fri 23:30 → Sat 00:00 |
| Sun 2026-08-16 11:00 | i helgen | Sun 11:00 → Mon 00:00 |
| Mon 2026-08-10 12:00 | next weekend | Sat 2026-08-22 → Mon 2026-08-24 |
| spring-forward/fall-back date | tomorrow | 23/25 UTC hours respectively |
| any | tomorrow next weekend | 422 `AMBIGUOUS_TIME` |

Boundary tests cover Event ends=request_start excluded, starts=request_end excluded, ends=now expired, point starts=request_start included, and point starts=request_end excluded.

## SearchDocument and Embeddings

SearchDocument is a deterministic, evidence-grounded projection. It contains display/canonical names, verified aliases, EN/SV taxonomy labels/aliases, explicit structured facts, factual descriptions, Event/venue context, and a deterministic embedding text. It excludes unsupported subjective claims and prohibited/redacted evidence. Content/template/document versions and hash make regeneration idempotent.

FTS representation uses weights:

- A: canonical name + verified aliases;
- B: direct taxonomy labels/aliases and factual structured terms;
- C: ancestor taxonomy labels and Event venue context;
- D: factual description.

`fts` is the concatenation of `to_tsvector('simple', names/aliases/structured terms)`, `swedish` vectors for SV fields, and `english` vectors for EN fields with the weights above. Query creates `websearch_to_tsquery` for `simple` and selected UI locale; for mixed/unknown text it uses simple plus both language configurations. Names must outrank descriptions; no complex language detector.

Embedding document generation occurs offline only. Query and document vectors must match active provider/model/revision/dimension, contain expected finite non-zero values, and use cosine distance. READY is searchable; FAILED and STALE are not. Missing vector merely removes that semantic candidate source.

## Public Search API

```ts
type SearchRequestV1 = {
  query: string;                         // 0..160 Unicode code points; max 512 UTF-8 bytes
  uiLocale: 'en' | 'sv';
  scopeId: string;
  location?: { latitude: number; longitude: number; radiusMeters?: number };
  taxonomyNodeId?: string;
  entityTypes?: Array<'PLACE' | 'EVENT'>;
  time?: { start: string; end: string };
  limit?: number;                         // 1..20, default 10
};

type SearchResponseV1 = {
  requestId: string;
  semanticDegraded: boolean;
  metadata: { limit: number; resultCount: number };
  results: Array<PlaceCard | EventCard>;
};

type PlaceCard = {
  canonicalId: string;
  type: 'PLACE';
  name: string;
  categories: Array<{ id: string; slug: string; label: string }>;
  location: { latitude: number; longitude: number; locality?: string };
  distanceMeters?: number;
  factualSummary?: string;
  hours?: { state: 'OPEN' | 'CLOSED' | 'UNKNOWN'; text?: string };
  placeStatus: 'ACTIVE' | 'TEMPORARILY_CLOSED' | 'UNKNOWN';
};

type EventCard = {
  canonicalId: string;
  type: 'EVENT';
  title: string;
  categories: Array<{ id: string; slug: string; label: string }>;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  venue: { canonicalPlaceId?: string; name: string };
  location: { latitude: number; longitude: number; locality?: string };
  distanceMeters?: number;
  status: 'SCHEDULED';
};
```

`resultCount === results.length` and `0..limit`; no pagination/cursor. Empty query is allowed only with valid `taxonomyNodeId` category browse; otherwise 400 `QUERY_REQUIRED`. Coordinates are paired and bounded; radius requires location, is positive, and is capped. Location without radius may compute distance but does not hard-filter. Invalid/excessive input is 400; unknown/inactive scope/node is 404; ambiguous/inverted time is 422; disabled scope is redacted retryable 503; DB unavailable is 503; unhandled is 500. Extra/unsupported fields are rejected. Provider failure returns 200 deterministic results with `semanticDegraded=true`. No ranks, scores, provenance, payload, internal reasons, model error, or precise diagnostic trace is public.

Error shape: `{requestId,error:{code,message,retryable}}` with safe codes/messages.

### Normalization

The shared authoritative algorithm is `norm-v1`, with TypeScript/SQL golden-equivalence tests. Preserve original text; reject controls except allowed input whitespace; map whitespace to spaces; Unicode NFC; locale-neutral lowercase/case fold preserving Swedish `å/ä/ö`; map punctuation/separators (including apostrophe/hyphen) to spaces; collapse/trim. Derive accentless form separately using PostgreSQL-compatible `unaccent` plus collapse. Run at ingestion and query time. Original display/source strings remain untouched. Canonical exact uses the accent-preserving form; accentless is fallback evidence only.

## Edge Function and DB Authentication

The one trial path is:

```text
Mobile → public Supabase Edge Function
       → Supabase Data API/PostgREST RPC using Edge-held secret key
       → api.search_v1
       → private app schema
```

The Edge MUST validate/cap input, create/request-propagate UUID request ID, normalize public input, deterministically recognize taxonomy/time, decide `shouldEmbed`, call embedding provider with configured timeout/circuit state, validate returned vector, call exactly one `api.search_v1` RPC with vector or NULL, emit essential telemetry, and shape the public response.

The trial discovery Edge endpoint accepts POST JSON plus OPTIONS/CORS and is deployed with platform JWT verification disabled; the mobile-facing endpoint is public, while the backend secret remains private. All other methods fail safely.

It MUST NOT generate candidate lists/RRF, resolve entities, scrape, mutate truth, build SearchDocuments, or generate document embeddings.

Edge stores `SUPABASE_URL` and `LEMON_SUPABASE_SECRET_KEY` as environment secrets. Mobile receives only the Edge URL—no publishable/service/secret key and no direct Data API path. Edge creates a server-only client and calls exactly `.schema('api').rpc('search_v1', validatedParams)`, never forwarding client Authorization into this client.

PostgREST sees `service_role`; Data API exposes `api` only. `api` contains no tables/views and only shaped `api.search_v1`. The routine is SECURITY DEFINER owned by non-login `lemon_api_owner`, has fixed empty search_path, fully qualifies every object, validates parameters, and uses no dynamic SQL. Public/anon/authenticated EXECUTE and all private-table access are revoked; only service_role has `USAGE api` and EXECUTE. App tables remain unexposed and unreadable via the public path. The Edge-held broad backend credential is acceptable only inside this bounded secret/exposed-schema/function boundary and is rotated on suspected exposure.

Minimal circuit breaker is per Edge instance: after a small tunable consecutive failure count, skip semantic calls for a short tunable interval; deterministic RPC continues. Timeout, rate limit, 5xx, invalid/wrong-dimension/non-finite/model-mismatch, or open circuit all map to vector NULL plus degraded telemetry.

## Internal Search Stages

Public SQL contract, conceptually:

```sql
api.search_v1(
  p_request_id uuid,
  p_query text,
  p_query_norm text,
  p_query_ascii text,
  p_ui_locale text,
  p_scope_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_taxonomy_node_id uuid,
  p_entity_types app.entity_type[],
  p_time_start timestamptz,
  p_time_end timestamptz,
  p_query_vector vector,
  p_embedding_provider text,
  p_embedding_model text,
  p_embedding_revision text,
  p_embedding_dimension integer,
  p_limit smallint,
  p_search_config_version text
) RETURNS TABLE (
  result_position smallint,
  entity_id uuid,
  entity_type app.entity_type,
  display_name text,
  categories jsonb,
  latitude double precision,
  longitude double precision,
  distance_m integer,
  factual_summary text,
  place_status app.place_status,
  opening_hours jsonb,
  event_starts_at timestamptz,
  event_ends_at timestamptz,
  event_timezone text,
  event_status app.event_status,
  venue jsonb,
  semantic_used boolean,
  semantic_degraded boolean
)
```

The function loads the single active config and rejects a supplied stale/mismatching version. Production clock is `statement_timestamp()`; only restricted test helpers accept injected clocks. One SQL execution uses named CTEs/helper SQL functions; stages do not make network round trips. Common internal candidate shape:

```ts
type Candidate = {
  entityId: UUID;
  retriever: 'CANONICAL_EXACT'|'ALIAS_EXACT'|'ASCII_EXACT'|'PREFIX'|'TRIGRAM'|'FTS'|'TAXONOMY'|'EVENT'|'SEMANTIC';
  retrieverRank: number;
  protectedClass?: 'CANONICAL_EXACT'|'ALIAS_EXACT';
  directTaxonomy?: boolean;
  distanceM?: number;
  diagnostic: Record<string, string | number | boolean | null>;
};
```

| Stage | Input/output | Required behavior/index/cap |
|---|---|---|
| `eligibility` | request filters → eligible entity IDs + effective point/Event facts | Authoritative scope/publication/status/time/freshness/radius predicate; PostGIS/B-tree; no cap |
| `exact_candidates` | eligible + normalized query → canonical/alias/ascii exact | norm/ascii B-tree; cap config; protected class only after qualification |
| `fuzzy_candidates` | eligible + norm/ascii → prefix/trigram | prefix B-tree, trigram GIN; separate caps |
| `lexical_candidates` | eligible + safe tsqueries → FTS ranks | active document FTS GIN; FTS cap |
| `taxonomy_candidates` | eligible + recognized node/path → direct/descendant ranks | taxonomy path/membership indexes; cap |
| `event_candidates` | eligible Events + parsed/structured interval → temporal/context ranks | start/status indexes; cap |
| `semantic_candidates` | eligible + compatible vector → exact cosine ranks | READY model/dimension index; exact scan; cap |
| `fuse_candidates` | ordinary ranked lists → RRF score/contributions | fixed formula; protected exact outside fusion |
| `rank_results` | protected + fused → non-collapse + cards | deterministic ties, unique entity emission, limit |

Candidate ordering is deterministic: evidence-specific primary order, then direct-taxonomy/context tie-break where allowed, then canonical UUID ascending. A cap applies after deterministic sorting. SearchDocument/vector joins are always intersected with eligibility; projections can never bypass hard filters.

### Authoritative eligibility

Place:

```text
PUBLISHED AND merged_into_id IS NULL
AND active/public-enabled requested scope and assigned active boundary
AND status IN (ACTIVE,TEMPORARILY_CLOSED,UNKNOWN)
AND entity type/taxonomy/radius filters match
```

Event adds:

```text
status=SCHEDULED
AND starts_at < now + configured horizon
AND corrected half-open overlap when requested
AND effective critical-source freshness within tolerance when near-term
AND effective location/radius/type/taxonomy filters match
```

CANCELLED, COMPLETED, POSTPONED, UNKNOWN, expired, stale near-term, out-of-scope, closed, withheld, draft, merged, or invalid-location entities are ineligible.

## Exact / Alias Retrieval

Precedence after eligibility:

1. accent-preserving canonical exact — protected;
2. qualifying verified alias exact — protected;
3. accentless exact — strong ordinary evidence;
4. prefix;
5. trigram/FTS/taxonomy/Event/semantic discovery evidence.

Canonical exact returns every eligible same-name entity; same canonical names are legal and each exact result is protected. Contextual order within that protected tier is explicit entity-type match, direct requested taxonomy, requested-radius distance, then UUID. Closed/out-of-scope/withheld/merged candidates receive no protection.

Verified alias exact qualifies only when alias is active+verified, maps to exactly one eligible entity in requested scope, and no other eligible active canonical name in scope equals that alias norm. Conceptual qualification:

```sql
COUNT(DISTINCT eligible_alias.entity_id) = 1
AND NOT EXISTS (
  SELECT 1 FROM eligible_entities e
  WHERE e.canonical_name_norm = :query_norm
    AND e.id <> eligible_alias.entity_id
)
```

Alias collision or ambiguity demotes alias match to ordinary evidence and is diagnostically reported. Accentless collision is ordinary only.

## Prefix / Trigram / FTS

Prefix uses accent-preserving normalized canonical/alias fields and optional ascii fallback, requires configured minimum length, uses `LIKE query || '%'` with `text_pattern_ops`, and caps before union. Tie order: canonical before alias, accent-preserving before ascii, shorter completion, then UUID.

Trigram uses `pg_trgm` GIN `gin_trgm_ops` on normalized canonical names/active aliases (and ascii fallback), `similarity >= configured threshold`, configured minimum query length, bounded cap, descending similarity then canonical-before-alias then UUID. No unbounded Levenshtein. A bounded edit-distance tie-break on already selected candidates is optional implementation detail.

FTS uses active SearchDocument weighted vector and safe `websearch_to_tsquery`; query ranks are bounded. Names/verified aliases outrank taxonomy/structured facts, which outrank descriptions. EN/SV/simple vectors are combined as specified above; unsupported syntax cannot become raw `to_tsquery` SQL.

## Taxonomy Retrieval

- Edge recognizes exact normalized active label/alias deterministically and passes node ID; malformed/unknown explicit node is rejected.
- DB expands selected parent through UUID `path`; leaf matches direct active memberships.
- Direct selected-leaf membership is preferred as a bounded context tie-break after RRF; ancestor/descendant relevance remains ordinary evidence.
- Empty-query browse requires structured discovery context and ranks within eligible taxonomy/time/geo universe.
- Taxonomy candidates obey Event/Place/scope/radius eligibility. No source mapping, AI label, or SearchDocument text can create membership at request time.

## Semantic Retrieval

`shouldEmbed` is a deterministic cost heuristic. Initial behavior returns false when semantic is disabled/circuit-open, normalized query is empty, query is time-only, the entire query is one recognized taxonomy label/alias plus optional generic noun, or a conservative name-shaped heuristic finds ≤4 tokens with no occasion/broad/constraint terms. It returns true for configured broad/occasion terms, mixed constraints, or otherwise uncertain multi-token queries. An eligible protected exact may also suppress semantic work when the request is wholly known-item. Invocation vocabulary/boundaries are TUNABLE on EN/SV dev quality, cost, and latency data; false never suppresses deterministic retrieval.

Query embedding input is normalized user text plus recognized deterministic taxonomy/time context in a fixed versioned template; it never includes private source content or fabricated rewrite. Provider response must match active provider/model/revision/dimension and finite non-zero vector validation.

Semantic candidates use exact cosine scan over READY embeddings matching active SearchDocument hash and model contract, intersected with eligibility. No ANN/HNSW. Missing/FAILED/STALE vector contributes nothing. Semantic evidence is additive: it cannot bypass filters or protected exact.

On timeout, rate limit, 5xx, invalid vector, dimension/model mismatch, or open circuit, Edge sends vector NULL, DB omits semantic stage, deterministic search remains complete, response marks `semanticDegraded=true`, and telemetry records a bounded reason. There is no LLM router, query rewriter, reranker, date parser, or AI taxonomy/subjective truth.

## RRF

Ordinary lists are ASCII exact, prefix, trigram, FTS, taxonomy, Event/context, and semantic when available. Each independently ranked list contributes equally:

$$
RRF(d)=\sum_{r \in R(d)} \frac{1}{k+rank_r(d)}
$$

`k` is one versioned tunable. A missing list contributes zero. Hard eligibility is before fusion. Protected canonical/qualifying alias exact is outside fusion and precedes ordinary results. No raw-score normalization, per-query-family weights, calibration, LTR, or family matrix. Direct-taxonomy/context and deterministic UUID ties occur after RRF and before non-collapse; they cannot override protected order.

## Broad-Discovery Non-Collapse

Applies only when deterministic recognition classifies the query as clearly broad discovery: broad term/empty structured browse/parent-level discovery with weak known-item evidence. It does not apply to protected/known-item, narrow explicit leaf, or strongly constrained intent.

Pipeline:

```text
eligibility → retrieval → canonical union → protected exact
→ ordinary RRF → relevance-primary non-collapse → unique output
```

Group keys are a configured taxonomy hierarchy level, explicit `chain_key`, and Event `venue_place_id`. Chain membership is never inferred from names; absent explicit identity means abstain. An entity may participate in relevant group dimensions, with deterministic priority defined by config.

Hard invariant: only candidates in the tunable comparable-relevance cohort may be interleaved to relieve a top-K group cap; a clearly weaker candidate cannot be promoted solely for variety. Protected exact never moves. Every emitted canonical ID enters `emitted_entity_ids`; later encounters are skipped, so each entity appears at most once.

Deterministic pseudocode:

```text
output = protected_unique
pending = ordinary candidates in RRF order excluding emitted IDs
while output.size < K and pending not exhausted:
  c = next pending
  if c.id already emitted: continue
  if noncollapse not applicable: emit(c); continue
  if c does not breach any configured group cap: emit(c); continue
  alt = earliest not-emitted candidate after c that:
        is within comparable-relevance cohort of c,
        improves the breached concentration,
        and breaches no stronger applicable group rule
  if alt exists: emit(alt); retain c for later
  else: emit(c)
```

Diagnostics record applied flag, group type/key, original/final rank, reason, cohort boundary, and skipped duplicate emission. Tunables control applicability vocabulary, hierarchy level, comparable relevance, concentration, chain/Event repetition—not the relevance-primary or exactly-once invariants.

## Diagnostics / Observability

Restricted `diagnostic.explain_search_v1(request,entity_id)`/CLI answers “Why did X not reach top five?” with:

- entity exists; current source evidence version/parse-attempt IDs where relevant;
- eligibility and exact failure reason;
- canonical/alias/ascii exact type and alias qualification/collision;
- rank/presence in each retriever and union;
- per-list RRF contribution and total;
- rank before non-collapse; applied group/key/movement/reason; final rank;
- active search-config, taxonomy, boundary, SearchDocument/template, embedding model/revision/dimension versions.

Duplicate-review diagnostics distinguish selected/decision version IDs and parse-attempt IDs without showing prohibited raw evidence. Detailed traces are never public.

Search structured event `search.completed` MUST contain: `request_id`; `semantic_attempted`; `semantic_status` in `SUCCESS|NOT_ATTEMPTED|TIMEOUT|RATE_LIMITED|PROVIDER_ERROR|INVALID_VECTOR|DIMENSION_MISMATCH|MODEL_MISMATCH|CIRCUIT_OPEN`; non-negative `edge_ms`, nullable `embedding_ms`, `db_ms`, `total_ms`; `result_count`; candidate counts for exact/prefix/trigram/FTS/taxonomy/Event/semantic/union; `search_config_version`, `search_document_version`, nullable `embedding_model_version`; query length/token count, locale, and presence of taxonomy/time/radius/type filters. Raw coordinates are absent.

`ingestion.started|completed|failed` MUST contain: run ID, source, scope/boundary, adapter/parser/mapping versions, refresh mode, refresh-unit/snapshot completion, status, fetched/valid/invalid/new/changed/unchanged/unresolved/disappeared/published, duration, coded error, and the run-derived `last_successful_refresh`.

Severity is fixed: INFO for success/degraded search and successful ingestion; WARN for provider degradation, validation-abuse pattern, backend budget breach, partial run, invalid-count spike, late Event refresh, or unexpected count delta; ERROR for DB/Edge failure or failed run/parser/schema/licence/persistence invariant. Compliance and credential events are restricted audit/security events. Provider degradation still returns 200 and is not ERROR unless sustained operationally.

Privacy/retention contract:

- Trial/production logs do not retain raw query text by default. Retain query length/token count, deterministic family flags, and a daily salted non-reversible fingerprint for aggregate duplicate diagnosis; salt is secret and rotates daily.
- Restricted reviewer-approved debugging may sample redacted normalized queries for at most 24 hours. Remove email, phone, URL, control text, and authorization headers.
- Never log exact latitude/longitude. Record only `has_location`, radius bucket, and optional municipality scope; no fine geohash.
- Source payloads, provider vectors/payloads, credentials/service keys, SQL errors, prohibited/redacted material, and precise locations are forbidden in logs.
- Trial operational logs SHOULD retain 14 days. Restricted diagnostic output is ephemeral unless manually attached to a reviewed evaluation result without raw personal/location data.

### Failure-mode contract

| Failure | Detection/state behavior | User-visible behavior/telemetry | Recovery/test |
|---|---|---|---|
| Source unavailable | fetch timeout/5xx; run FAILED/PARTIAL; last-good retained, no disappearance | existing results; source-health WARN with run/source | retry/new run; outage test |
| Parser regression | FAILED attempts spike by parser version; version remains usable | last-good canonical results | deploy parser v2/replay same H; replay test |
| Parser replay changes duplicate evidence | selected pair differs from finalized decision pair; preserve old decision and MUST append/confirm current OPEN_REVIEW before any new final resolution | existing canonical truth; unresolved preferred to stale merge; log old/current version+attempt IDs only | reviewer decides only after OPEN pins current evidence; A1→A2 sequencing test |
| Ingestion retry | terminal failure plus retry link | no duplicate visible records | new run/attempt; idempotency test |
| Partial snapshot | refresh unit/snapshot incomplete; no disappearance | last-good results | complete later run; partial test |
| Source disappearance | only complete snapshot evidence; mark missing, never close Place | Place remains unless other eligibility rule | later observation reverses missing; disappearance test |
| Invalid source record | FAILED parse/validation attempt | last-good or no publication | parser/data correction and replay; invalid fixture |
| Duplicate ambiguity | identity cannot resolve; OPEN candidate, record unresolved | duplicate/unresolved may remain absent | manual review; candidate test |
| Wrong manual merge | reviewer/operational detection; preserve decision/source history | stable safe last-good or temporary withholding | recorded reversal/rebuild/OPEN; reversal test |
| Taxonomy mapping missing | valid record lacks supported mapping; NEEDS_VALIDATION | not falsely shown in leaf | add versioned deterministic/manual mapping; coverage test |
| Out-of-boundary entity | `ST_Covers=false`/invalid point; WITHHELD | omitted | coordinate/boundary correction; scope test |
| Boundary version change | scope gate and revalidation diff | retryable scope maintenance during activation | activate/rollback/rebuild; boundary test |
| Embedding timeout/invalid vector | provider failure/validation; FAILED attempt or query vector NULL | deterministic results, degraded flag | retry/re-embed/provider recovery; API/DB fallback tests |
| Semantic weak result | hybrid evaluation regression without invariant violation | deterministic evidence still participates | tune invocation/model/caps on dev only; lexical-vs-hybrid test |
| Database timeout/error | Edge RPC timeout/error | safe retryable 503, no partial response | operational recovery; API injection test |
| Event stale/delta source | critical observation age fails; source health evaluated separately | stale near-term Event omitted, no cancellation claim | source emits current record/status; delta freshness tests |
| Event cancelled | explicit current status evidence | omitted immediately | authoritative correction only; cancellation test |
| Event expired | half-open now predicate/expiry command | omitted | newer occurrence/update; equality/expiry test |
| Alias collision | qualification count/canonical collision | ordinary evidence only | review/deactivate alias; collision test |
| Broad subtype/chain/venue collapse | diagnostic concentration assertion fails | relevance-primary interleaving of comparable alternatives | tune dev config; broad tests |
| Licence/persistence revocation | compliance request/source policy change | affected entity re-resolved/withheld; no prohibited content exposed | privileged redaction/sanitization; redaction test |
| Edge credential/config failure | auth 401/403 or exposed-schema/grant smoke failure | safe retryable service error | correct/rotate secret/config and redeploy; auth smoke |

## Security / Privileges

| Principal | Schema/object privileges | Explicitly prohibited |
|---|---|---|
| Mobile/public caller | HTTPS invoke Edge only | Any DB/Data API credential or RPC/table access |
| Edge runtime | Reads Edge secrets; invokes Data API as service_role | Direct canonical writes, payload reads, diagnostics/compliance |
| `service_role` through exposed Data API | USAGE `api`; EXECUTE `api.search_v1` only in exposed surface | `app`/`diagnostic` exposed schemas; direct private-table grants |
| `lemon_api_owner` non-login | Owns SECURITY DEFINER search; minimal SELECT/internal EXECUTE required | Writes; source payloads; secrets; dynamic SQL |
| `lemon_ingestion` | Source/run/canonical/projection writes through declared functions/tables | Public auth/grant management; compliance mutation; config activation unless separately granted |
| `lemon_reviewer` | Duplicate/manual canonical/provenance/taxonomy review functions | Raw secret access; arbitrary DDL; compliance redaction |
| `lemon_compliance` | EXECUTE redaction function only | Direct UPDATE or public/Edge membership |
| `lemon_evaluation` | Public-safe canonical/reference/SearchDocument reads; restricted diagnostic EXECUTE | Source payloads, compliance-redacted data, precise user logs, writes |
| Trial reviewer login | Membership only in review-safe evaluation roles, time-bound | Project secrets, service/Edge key, ingestion/review/compliance write roles |

RLS remains enabled on app relations. SECURITY DEFINER owners have explicit minimal policies/privileges, fixed empty search_path, fully qualified objects, no dynamic SQL. Revoke PUBLIC function EXECUTE and apply safe default privileges. Secrets live in deployment secret stores and `.env.example` contains names only. Service-role key never enters Git, logs, Expo config, response, or reviewer access.

Normative public-boundary grants (with the migration's exact function signature):

```sql
REVOKE ALL ON SCHEMA api FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA api TO service_role;
REVOKE EXECUTE ON FUNCTION api.search_v1(/* exact signature */)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION api.search_v1(/* exact signature */) TO service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated, service_role;
GRANT USAGE ON SCHEMA app TO service_role; -- required type/signature visibility only
```

`lemon_api_owner` is not the table owner and receives only explicit search SELECT/internal EXECUTE grants plus RLS policies required by the function; it has no write or raw-source-payload privilege.

Smoke tests prove direct anon/publishable/no-key `api.search_v1` fails; Edge secret succeeds; private table/Data API reads fail; compliance ordinary mutation fails; diagnostic access is restricted.

## Testing

### Unit

| Test family | Required invariant |
|---|---|
| Normalization | NFC/case/space/punctuation deterministic; display retained; accentless fallback separate |
| Time parser EN/SV | Exact table semantics, injected clock, weekdays/weekends, DST and ambiguity |
| Taxonomy | version/checksum, acyclic paths, leaf state, descendant expansion/direct leaf |
| Capture classification | same hash unchanged/reused; new hash changed; parser INVALID separate from version |
| Alias qualification | verified/active, one eligible entity, no canonical collision |
| Non-collapse | broad applicability only, relevance cohort protection, exact-once IDs |
| Event eligibility | half-open equality, horizon, status, critical freshness, point expiry |

### DB/integration

| Area | Required cases |
|---|---|
| Parser replay/current evidence | v1 fail→v2 success same H/no duplicate version; successful unresolved H+A1 current with NULL entity; failed H2+A2 preserves H1+A1; same H+A2 replaces A1 without canonical mutation; explicit canonical stale-input rejection; arbitrary historical SUCCEEDED attempt rejected unless it is the explicitly selected active run/parser execution and passes every ownership/availability/validation/CAS check |
| Duplicate review | candidate creation; Type A record link/no loser; Type B merge; reversal history; same H parser A1→A2 stales decision; positional evidence ownership; stale final decision cannot go directly to SAME/SEPARATE/UNSURE; current OPEN_REVIEW must be appended/confirmed first, then a new final decision may supersede it; concurrency recheck before mutation |
| Provenance/redaction | one current singular fact with history; source revocation query; ordinary source-version update rejected; privileged redaction removes payload/derived content while preserving identity/hash/provenance; `redacted_by=session_user` even under SECURITY DEFINER ownership |
| Embeddings | READY requires valid vector/model/hash/dimension; FAILED requires NULL vector/generated time and required error; FAILED terminal; retry inserts new attempt key; FAILED→READY and FAILED→STALE rejected; only READY→STALE allowed; STALE retains vector/generated time and is ineligible; NULL semantic fallback; compatible exact cosine retrieval |
| Search | canonical exact/same-name; alias protected/collision; accentless ordinary; prefix; trigram typo; FTS; taxonomy parent/leaf; semantic additive; RRF contributions/ties; non-collapse relevance/exact-once |
| Eligibility | outside scope/boundary; disabled boundary gate; radius; closed/merged/withheld; projection/vector cannot bypass |
| Events | cancellation; known-end/point overlap equalities; ends=now expired; stale Event withheld; DELTA successful source health but absent Event not observed/disappeared; expiry job |
| Ingestion | failed run retry creates new run/attempt and no duplicate data; complete vs partial snapshot; DELTA absence; disappeared Place not closed; stored/derived `last_successful_refresh` equals qualifying-run MAX formula and run-derived value wins on mismatch |
| Geography | ST_Covers boundary edge; boundary revalidation, gating, changed assignments/projections, rollback |

### API/mobile/relevance

- API: malformed/empty/excess query, coordinate pairing/bounds, invalid/excess radius, bad scope/node, unsupported filter, provider timeout/rate-limit/invalid/wrong dimension, degraded flag, result metadata, safe error, no internal leakage, auth smoke.
- Mobile: exact, category, semantic, EN/SV switch, Event/time, loading, no-result, error, degraded semantic, usable deployed build.
- Relevance: exact fixed 60/30/20 and family allocation; semantic subset 16/8/6; at least 12 EN/SV pairs plus six mixed/adversarial queries; pair group never crosses split; sealed set unavailable during tuning; grade/hard-constraint assertions; dev score, lexical-only vs hybrid, known item, candidate recall, visible quality, broad concentration/relevance assertions.
- Deliverables: submission checklist/manual validation exists and links each required artifact before submission.

## Evaluation

The corpus allocation is fixed—not recommended—and totals 110 queries:

| Query family | Dev | Sealed held-out | Adversarial | Notes |
|---|---:|---:|---:|---|
| Canonical exact / same-name | 5 | 3 | 1 | Accent-preserving, duplicate names, out-of-scope exact |
| Verified/colliding aliases | 3 | 2 | 1 | Qualified and deliberately unqualified |
| Prefix | 4 | 2 | 1 | Unique and short ambiguous |
| Typo/transposition/accent/spacing | 5 | 2 | 2 | One-edit and short-token protection |
| Taxonomy parent/leaf | 7 | 3 | 2 | EN/SV labels, direct leaf, descendant expansion |
| Broad discovery | 4 | 2 | 2 | General Places/Activities and mixed eligible inventory |
| Semantic occasion/language | 16 | 8 | 6 | Dev: 8 EN/SV pairs; sealed: 4 pairs; adversarial: six mixed/multi-constraint queries |
| Event/time | 6 | 3 | 2 | EN/SV phrases, venue, horizon/freshness |
| Geo/scope/radius | 3 | 2 | 1 | Municipality edge, radius, missing point |
| Scarcity/duplicate/state | 3 | 2 | 1 | Supply constrained, duplicate ambiguity, cancelled/expired |
| Broad concentration | 4 | 1 | 1 | Subtype, chain, Event venue; explicit relevance guard |
| **Total** | **60** | **30** | **20** | **110 fixed** |

The semantic subset is fixed at 30 queries: at least 12 paired English/Swedish semantic intents (24 queries) plus at least 6 mixed/adversarial semantic queries. These queries are inside—not additional to—the 110-query corpus. Translation and close-paraphrase members share `pairGroupId`/`pair_group_id` and MUST remain in the same split.

Sealed judgments are unavailable to tuning until a candidate configuration is frozen. After sealed evaluation, any further change requires a new candidate version; the held-out set MUST NOT be iteratively mined or used as a development set.

Approved judgment schema:

```ts
type EvalJudgmentV1 = {
  queryId: string;                         // stable query/topic ID
  split: 'DEV' | 'SEALED' | 'ADVERSARIAL';
  family: string;
  query: string;
  queryLocale: 'en' | 'sv' | 'mixed';
  uiLocale: 'en' | 'sv';
  pairGroupId?: string;
  requestFilters: Omit<SearchRequestV1, 'query' | 'uiLocale'>;
  clockUtc: string;
  expectedTop?: string[];                  // known-item CanonicalEntity IDs where applicable
  relevant: Array<{ entityId: string; grade: 0 | 1 | 2 | 3 }>;
  forbidden: Array<{ entityId: string; reason: string }>;
  assertions: Array<
    | { kind: 'MAX_GROUP_IN_TOP5'; groupType: string; max: number; onlyIfComparableAlternatives: boolean }
    | { kind: 'MUST_BE_EMPTY' | 'MUST_DEGRADE' | 'MUST_NOT_DEGRADE' }
    | { kind: 'ENTITY_RANK_AT_MOST'; entityId: string; rank: number }
  >;
  judgmentVersion: string;
  judgedBy: string;
  rationale: string;
};
```

Grades are fixed: `0=not relevant`, `1=marginal`, `2=relevant`, `3=highly relevant`. Any entity violating an explicit structured/hard constraint—scope, radius, entity type, taxonomy filter, Event status/time/freshness, or other request filter—has relevance grade 0 regardless of textual similarity.

Dataset manifest pins canonical dataset and SourceRecord run IDs, active boundary and taxonomy checksum, normalization version, SearchDocument template/hash set, embedding provider/model/revision/dimension, search-config version, evaluation clock, corpus/judgment checksums, and code commit.

Metrics and approved gates:

| Concern | Metric / report |
|---|---|
| Known item | Hit@1, Hit@3, MRR; baseline exact Hit@1 ≥98%, alias top-3 ≥95% |
| Prefix/typo | Prefix top-3 ≥95% and unambiguous Hit@1 ≥90%; reasonable typo top-3 ≥90% |
| Candidate | Recall@20 by family/stage and zero-result rate |
| Visible rank | Precision@5 and NDCG@5; category NDCG@5 ≥0.80 and supply-relative recall ≥0.85 |
| Semantic | Lexical-only vs hybrid NDCG@5/Recall@5; target ≥0.75/≥0.80 where supply exists; report EN/SV separately |
| Bilingual | Paired-query overlap@5 diagnostic target generally ≥60%, plus independent relevance metrics |
| Broad | Precision@5/NDCG@5 first; per-query top-5 subtype/chain/venue assertions; verify no weaker-than-cohort promotion |

No aggregate may mask a known-item, Event-state, geographic, or protected non-collapse failure. Each evaluation failure receives exactly one primary attribution: inventory, normalization/alias, dedupe, taxonomy, deterministic interpretation, candidate retrieval, semantic representation, fusion/rank, or eligibility/Event state.

### Performance measurement

Targets are gates to benchmark, not claimed achievements:

- Direct/category backend: p50 ≤100 ms, p95 ≤300 ms.
- Semantic backend: p50 ≤750 ms, p95 ≤1.5 s.

Measure Edge overhead/cold start, embedding provider, DB, backend total, and client-perceived latency separately with request ID. Representative mix includes exact 20%, prefix/typo 15%, category 20%, broad 10%, semantic occasion 15%, Event/time 10%, geo 5%, empty structured browse 5%; run EN/SV and warm/cold samples against trial-scale fixtures (~1K entities plus bounded Events/documents/vectors). Report percentiles and failures rather than asserting targets before execution.

## Deployment / Rollback

Deployment order:

1. PostgreSQL extensions;
2. schemas/enums/tables/constraints/indexes;
3. functions/triggers/grants/RLS/default privileges;
4. Active Taxonomy version/checksum seed;
5. Jönköping scope and boundary seed;
6. source registry/config;
7. initial ingestion;
8. SearchDocuments;
9. document embeddings;
10. search config/internal functions/`api.search_v1`;
11. Edge secrets/function;
12. Expo application/config;
13. scheduled Event refresh and expiry commands;
14. deployment/evaluation smoke and coverage report.

Local/staging/trial each have isolated Supabase project/database, provider key, named Edge secret, source credentials, config activation, and Expo Edge URL. `.env.example`, migrations, reference checksums, and commands make setup reproducible. Scheduled commands may use Supabase-supported scheduling/CI already available; no new service.

Rollback/repair:

| Failure | Governing rollback/repair |
|---|---|
| Bad migration | Prefer forward corrective migration; reversible DDL down migration only when data-safe; backup/restore last resort |
| Edge deployment | Redeploy previous immutable function version and smoke |
| Search tuning/config | Atomically reactivate prior config row |
| Embedding model | Keep old READY compatible set/config; activate old contract; mark bad model STALE |
| Taxonomy mapping | Version mapping, deactivate bad memberships, regenerate projections/coverage |
| Source ingestion/parser | Disable source/version, retain last-good canonical truth, replay corrected parser/map, repair affected projections |
| Boundary | Gate scope, activate prior version, revalidate/rebuild/smoke, enable |
| Manual link/merge | Execute recorded Type A/Type B inverse from decision detail/evidence, rebuild, append OPEN/new decision |
| Compliance revocation | Cannot restore prohibited content; reacquire only under newly permitted terms; repair/withhold canonical truth |

No destructive rollback rewrites immutable source/decision/provenance history.

## Trial Review Deliverables

All are four-day MUST outputs:

- Repository with complete source, meaningful incremental Git history, and root reproducible README.
- Installable/runnable React Native/Expo app and documented trial/local build/run path.
- Reviewer-readable, time-bound, public-safe Supabase database access; no write role, secrets, source payload, or privileged project access.
- Runnable per-source/combined ingestion commands, config/credential/rate-limit/refresh/persistence requirements, bounded sample and idempotent rerun/parser replay instructions.
- `docs/trial-review/sources.md`: source URLs, licence/terms/attribution, retained fields/persistence mode, external-key/refresh/disappearance semantics, limitations.
- `architecture-search-overview.md`: data flow, identity/provenance, Place/Event, search paths, semantic fallback, security boundary, trade-offs.
- `evaluation-report.md` plus machine-readable results: all versions, 60/30/20 metrics, EN/SV, lexical/hybrid, known item, non-collapse, latency, failed assertions.
- `known-issues-and-cuts.md`: supply-constrained/needs-validation leaves, source/Event/relevance/operational limitations, intentional cuts, and concise “Another Week” improvements (not the four-day plan).
- `submission-checklist.md`: artifact/deployment links, secret absence, and final sign-off.

## Requirement Traceability

| Requirement | Technical contract | Verification | Four-day included? |
|---|---|---|---:|
| Name search | eligibility + protected canonical exact | exact/same-name/out-of-scope tests; Hit@1/3 | Yes |
| Alias | verified scope-local protected qualification | alias exact/collision tests | Yes |
| Prefix | normalized prefix retriever/index | unit/DB prefix + latency | Yes |
| Typo | bounded pg_trgm | trigram typo/threshold evaluation | Yes |
| Category leaf/parent | active bilingual taxonomy + path expansion | leaf/parent tests; Precision/NDCG | Yes |
| Broad discovery | structured/broad retrieval + RRF | broad relevance corpus | Yes |
| Non-collapse | relevance-primary group interleaving, unique IDs | concentration/relevance/exact-once tests | Yes |
| Semantic occasion | compatible exact pgvector additive path | lexical vs hybrid EN/SV | Yes |
| EN/SV | localized UI, normalization/FTS/taxonomy/time | locale switch, split metrics | Yes |
| Events | separate subtype, bounded occurrence inventory | status/venue/eligibility tests | Yes |
| Time phrases | deterministic half-open EN/SV parser | injected-clock/DST/equality tests | Yes |
| Full municipality | versioned PostGIS scope/boundary | scope/radius/boundary gate/revalidation | Yes |
| Truthful 5–10 coverage | versioned coverage artifact/status | coverage report/checklist | Yes |
| Rerunnable ingestion | six stages, hashes, attempts, retry runs | same hash/replay/retry tests | Yes |
| Dedupe | identity-only auto-link + manual candidates | ambiguity/SAME/reversal/stale evidence | Yes |
| Provenance | one current singular fact + history | replacement/revocation tests | Yes |
| Semantic outage | vector NULL deterministic fallback | timeout/invalid/circuit API tests | Yes |
| Loading/error/empty UX | public response/error contracts | mobile smoke | Yes |
| Observability | structured search/ingestion events + privacy | log-field/redaction verification | Yes |
| Evaluation | fixed 60/30/20 and family allocation, paired bilingual semantic minimum, graded judgments, sealed guard, metrics | corpus-validation tests and generated report | Yes |
| Deployment | ordered reproducible environment artifacts | deployment smoke | Yes |
| Git history | meaningful incremental commits | submission checklist/manual review | Yes |
| Runnable scraper/ingestion | adapter commands/documentation | reviewer bounded rerun | Yes |
| Reviewer Supabase access | dedicated read-safe login/roles | privilege smoke/manual handoff | Yes |
| Source documentation | required per-source fields/terms/limits | checklist | Yes |
| Architecture/search trade-offs | reviewer overview | checklist | Yes |
| Evaluation explanation | evaluation report with versions/metrics | checklist | Yes |
| Known issues | supply/source/Event/relevance/ops disclosure | checklist | Yes |
| Cuts | explicit four-day cuts | checklist | Yes |
| One-more-week plan | concise Another Week section | checklist | Yes |

## ADR Traceability

| ADR | Final schema/contract | Module/API | Verification |
|---|---|---|---|
| ADR-001 | PostgreSQL canonical sole datastore | migrations/ingestion/search RPC | deployment/data ownership tests |
| ADR-002 | Canonical identity separate from SourceRecord | canonical/source tables | identity and same-name tests |
| ADR-003 | Place/Event subtype split | `places`, `events`, subtype trigger | mismatch/venue/Event tests |
| ADR-004 | hierarchical bilingual multi-label taxonomy | taxonomy/membership tables | hierarchy/EN-SV/category tests |
| ADR-005 | truthful coverage/scarcity | coverage artifact | supply-constrained report tests |
| ADR-006 | source history + targeted provenance | versions, parse attempts, fact provenance | replay/history/revocation tests |
| ADR-007 | no heuristic auto-merge | candidates/decisions | ambiguity/manual SAME/reversal |
| ADR-008 | versioned municipality boundary | scope/boundary/PostGIS | scope/gate/revalidation/rollback |
| ADR-009 | thin Edge public boundary/one DB call | Edge + `api.search_v1` | API/auth/one-RPC smoke |
| ADR-010 | decomposed deterministic stages | internal CTE/helper contracts | per-stage rank/diagnostic tests |
| ADR-011 | additive pgvector exact scan | READY embeddings/semantic stage | hybrid/fallback/no-ANN checks |
| ADR-012 | protected exact semantics | exact/alias stage | accent/same-name/collision tests |
| ADR-013 | fixed simple RRF | fuse stage/config `rrf_k` | contribution/tie tests |
| ADR-014 | broad relevance-primary non-collapse | rank stage/group keys | concentration/relevance/exact-once |
| ADR-015 | versioned independent evaluation | corpus/judgment/report | split guard/metrics/reproducibility |

## Implementation-Owned Tunables

All values are versioned in `search_configs`/evaluation manifests. “TO BE TUNED ON DEV SET” means no unjustified acceptance claim is made.

| Tunable | Initial proposed value/range | Selection method | Gate |
|---|---|---|---|
| Prefix minimum length | 2–3; TO BE TUNED ON DEV SET | prefix recall/noise | Hit/Precision + DB latency |
| Trigram minimum length | 3 | dev typo families | Recall@20/Precision@5 |
| Trigram threshold | 0.25–0.45; TO BE TUNED | sweep dev | typo recall and false positives |
| Candidate depths | exact 20; others 20–50; semantic 30; TO BE TUNED | cap/latency sweep | Recall@20 + p95 DB |
| RRF `k` | 60 initial | small dev sweep | NDCG@5/no known-item regression |
| Semantic invocation | NL/occasion/weak deterministic; skip exact/short/structured-only | dev family heuristic | hybrid quality + cost/latency |
| Provider/model/dimension | one multilingual contract; TO BE SELECTED/TUNED ON DEV SET | EN/SV hybrid benchmark | quality, p95, valid dimension |
| Embedding timeout | 500–900 ms; initial 700 ms | provider latency benchmark | semantic p95/degrade correctness |
| Circuit failures/open period | 3 failures / 30 s initial | failure injection | deterministic availability |
| Event horizon | 30 days initial | approved bounded policy/dev inventory | Event tests/coverage |
| Event freshness by source | source-specific hours; TO BE TUNED | adapter cadence/outage simulation | stale/cancellation tests |
| Radius cap | 50 km initial maximum | municipality geometry/UX | geo validity/performance |
| Broad applicability vocabulary | versioned EN/SV broad terms | dev judgments | known-item/narrow unaffected |
| Comparable relevance | RRF ratio 0.80–0.95; TO BE TUNED | broad dev assertions | no weaker promotion + NDCG |
| Top-K concentration | 2–3 per group in top 5; TO BE TUNED | broad dev | concentration assertions |
| Taxonomy grouping depth | subtype/leaf-parent level; TO BE TUNED | taxonomy corpus | relevance/concentration |
| Chain repetition | 1–2 in top 5; TO BE TUNED | explicit-chain broad queries | non-collapse assertions |
| Event venue repetition | 1–2 in top 5; TO BE TUNED | Event broad queries | non-collapse assertions |
| Tie behavior | direct taxonomy/context then UUID; fixed default | deterministic verification | repeat-run identical order |

Approved eligibility, protected exact, alias qualification, simple RRF formula, semantic fallback, and relevance-primary non-collapse are not tunable.

## Deferred Extensions

DEFERRED outside the four-day implementation, with current seams only:

- heuristic automatic cross-source entity resolution (SourceRecord/DuplicateCandidate seam);
- subjective AI attributes or inferred claims (SearchDocument template/membership evidence seam);
- generalized diversity/personalization/social/popularity systems (post-RRF rank seam);
- calibrated/LTR ranking and rich semantic reranking (retriever/fusion interface);
- HNSW/ANN or external search engine (semantic/search datastore seam);
- outbox/projector/queue/service decomposition (canonical→projection transaction seam);
- comprehensive Events, recurrence engine, or unbounded inventory (explicit occurrence adapter seam);
- additional cities and broader service taxonomy (versioned scope/taxonomy seeds);
- advanced observability/dashboard architecture (structured event outputs).

Useful non-blocking implementation notes: UUID arrays are sufficient for duplicate evidence; schema comments/migrations should consistently say “current source evidence”; redacted historical duplicate evidence remains reproducible through allowed hash/metadata; helper SQL functions are optional conveniences if contracts/tests remain satisfied. These require no new specification cycle.

## Frozen Contract Classification

### Architecture-frozen — ADR/architecture review required

- Supabase/PostgreSQL sole canonical/search datastore; no external engine or ANN.
- Canonical/source identity separation; Place/Event separation; source history shape and targeted provenance.
- Hierarchical bilingual multi-label taxonomy and truthful scarcity.
- No heuristic auto-merge; versioned municipality boundary; thin Edge/one DB call.
- Deterministic staged retrieval plus additive embeddings and degradation.
- protected exact/alias rules; fixed simple RRF; relevance-primary broad non-collapse.
- deterministic evidence-grounded documents; explicit Event time/freshness; versioned independent evaluation; embeddings-only launch AI; no request-time scraping.

### Technical-contract-frozen — explicit specification amendment required

- Final columns/enums/constraints/currentness and READY/FAILED/STALE semantics.
- Source-current versus canonical-current separation and explicit processing identity.
- Duplicate decision evidence/reopen/Type A/Type B/reversal/locking behavior.
- Half-open Event/point/expiry predicates and refresh-mode/disappearance rules.
- Compliance-redaction boundary and single Edge→Data API→SECURITY DEFINER path.
- Eligibility-before-protection, alias qualification, search stage/API/security contracts.
- Evaluation corpus sizes/metrics and mandatory trial deliverables.

### Tunable — evaluation/benchmark change allowed

Only the versioned values in the preceding tunables table, with their stated test gates. Rollback retains/reactivates prior configuration/model contract.

### Implementation detail — freely selectable if contracts/tests pass

Package/test runner, SQL helper-versus-CTE decomposition, internal function names other than public contracts, adapter HTTP library, bounded edit-distance tie-break on selected candidates, formatting/report generators, and local command ergonomics.

## Specification Approval Record

The Final Technical Specification Acceptance Re-Review found no unresolved P0/P1, architecture contradiction, or ADR reopening. The consolidated body contains the accepted final state and removes superseded amendment wording.

## Technical Specification Status

TECHNICAL_SPECIFICATION_APPROVED

## Final Independent Score

9.6995 / 10.000

## P0 Findings

None.

## P1 Findings

None.

## Frozen Technical Source of Truth

This document supersedes Technical Specification v1 and Technical Specification Amendments v1.1/v1.2 as the implementation-facing technical contract.

Those documents remain historical decision/review records.

## Next State

TECHNICAL_SPECIFICATION_APPROVED
→ IMPLEMENTATION_PLAN
