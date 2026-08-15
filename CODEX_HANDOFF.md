# Lemon Going-Out Search — Compact Codex Handoff

Last updated: 2026-08-15

Purpose: minimum durable context required to safely start a fresh Codex thread.

Do NOT duplicate detailed package specifications here.
Use frozen docs + explicit current task prompt for package details.

---

# 1. Authority

Frozen hierarchy:

1. `docs/requirements/Requirements_Baseline_v1_1.md`
2. `docs/architecture/Final_Architecture_v1_0.md`
3. `docs/specification/Final_Technical_Specification_v1_0.md`
4. `docs/implementation/Final_Implementation_Plan_v1_0.md`

Manifest:

`docs/FROZEN_SOURCES.md`

Authority:

Requirements > Architecture > Technical Specification > Implementation Plan

True conflict:

`SPEC_CHANGE_REQUIRED`

Rules:

- Git history is authoritative for accepted implementation state.
- Explicit task prompt defines the active package boundary.
- Read only task-relevant frozen sections.
- Do not reread full frozen docs/history.
- `CODEX_START_HERE.md` is deprecated/deleted; never recreate it.
- Never rewrite accepted commits/history.

---

# 2. Architecture

Scope:

full Jönköping municipality, Sweden

Production path:

Expo / React Native
→ Supabase Edge
→ one public `api.search_v1`
→ PostgreSQL / PostGIS / pgvector

Postgres is the sole canonical/search datastore.

No:

- Elasticsearch
- Redis search
- secondary search datastore
- request-time scraping
- ANN / HNSW / IVFFlat
- LLM router/rewriter/reranker
- learned ranking

Search stack:

protected exact
+ lexical/taxonomy
+ Event/time
+ semantic exact-pgvector
→ fixed RRF
→ broad-only non-collapse

Semantic is additive/fail-open.
Deterministic search must always work without Voyage.

---

# 3. Current milestone

DAY 1: COMPLETE
DAY 2: COMPLETE

DAY 3 backend/search stack: COMPLETE

SRC-03B → EVENT-01
EMBED-01B → SEM-01
RANK-01
NONCOLLAPSE-01

Current task:

`MOB-03`

Remaining Day 3:

MOB-03
→ EVAL-03

Then Day 4:

COVERAGE-01
→ QA-01
→ PERF-01
→ EVAL-04
→ DEPLOY-01
→ DOCS-01

Do not automatically begin the next package.

---

# 4. Accepted commit ledger

BOOT-01      `4e5ab768`
DB-01A       `18653d2e`
DB-01B       `78861bb5`  historical irregularity accepted
DB-01C       `be0d1096`  historical irregularity accepted
DB-02        `8c5dbe31`
REF-01       `c5dc7624`
EVAL-01      `3221f3f3`
ING-01       `8ea9b778`
SRC-01       `18fff86e`
DAY1-PUB-01  `1281c14b`
SEARCH-01    `8e1d6c09`
SEC-01       `a9cd73b`
EDGE-01      `d0e3f195`
MOB-01       `464c3f4d`
SRC-02       `d29d7a47`
DEDUP-01     `65816f0c`
PROV-01      `743049a`
TAX-01       `ec8d719`
DOC-01       `20916fd`
SEARCH-02    `8bc55b2`
DIAG-01      `6b1b505`
TIME-01      `7c27d99`
EMBED-01A    `779cef6`
SRC-03A      `205d022`
MOB-02       `4f26f92`
EVAL-02      `4b4a20c`
SRC-03B      `22f9fc1`
EVENT-01     `80715b9`
EMBED-01B    `0e39010749d244286900877df745a46123a6e790`
SEM-01       `febdb189c5a9a36e16a7d30c8fce67f29f586695`
RANK-01      `e7e13033e6c8765fe818faed1f34d4b566077713`
NONCOLLAPSE  `1609514041779866a70a881d43b14bfa7f88b954`

Expected package-boundary working tree:

CLEAN

---

# 5. Evidence / identity invariants

Source lineage:

Source
→ SourceRecord
→ immutable SourceRecordVersion H
→ ParseAttempt A

Source-current evidence:

current_version_id H
+
current_parse_attempt_id A

Rules:

- capture before parse;
- H immutable;
- replay = same H + new A;
- failed newer parse never destroys last-good H+A;
- source-current evidence != canonical-current truth.

CanonicalEntity identity is separate from SourceRecord identity.

No heuristic cross-source auto-merge.

Duplicate decisions pin exact H+A.

Changed pinned evidence reopens finalized decisions through:

`OPEN_REVIEW`

Provenance/history retained.

Compliance:

`redacted_by = session_user`

---

# 6. Geography / taxonomy

Scope:

full Jönköping municipality

Municipality scope ID:

`a4b19b09-b272-5748-80ef-2c91d9d33ca6`

Boundary:

`lm-current-2026-08-14`

Boundary checksum:

`257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d`

Municipality code:

0680

Timezone:

Europe/Stockholm

Spatial eligibility:

`ST_Covers`

Active taxonomy:

`active-going-out.v1`

Nodes:

52

Checksum:

`ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2`

No legacy taxonomy.

Do not stretch taxonomy to satisfy inventory targets.

---

# 7. Exact / eligibility invariants

Protected only:

1. eligible accent-preserving canonical exact;
2. qualifying verified alias exact when unique among eligible entities and
   without eligible canonical-name conflict.

Not protected:

- ASCII/accentless exact
- prefix
- typo
- trigram
- FTS
- taxonomy
- Event
- semantic

Eligibility precedes retrieval/protection/ranking.

Final CanonicalEntity IDs are exactly once.

Hard filters can never be bypassed by semantic, RRF or non-collapse.

---

# 8. Event branch — accepted

Source:

`JONKOPING_EVENT_CALENDAR`

Policy:

`EXTRACTED_FIELDS_ONLY`

Refresh:

`DELTA_ONLY`

Stable source key:

`event/<source-event-uuid>`

Accepted only when:

`occurrence_count == 1`

Multi-occurrence:

`UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY`

1→N:

`IDENTITY_BECAME_AMBIGUOUS`

Never infer Event identity from title/date/start/venue/index/hash.

Source lacks reliable literal SCHEDULED status.

Accepted bounded canonical interpretation:

`SCHEDULED`

with:

`MANUAL`

provenance backed by exact H+A.

Never infer cancellation/completion/postponement from absence/outage/time.

EVENT-01 config:

- horizon: 30 days
- critical-fact freshness: 48h
- only SCHEDULED participates

Known-end overlap:

`starts_at < query_end AND ends_at > query_start`

Point Event:

`query_start <= starts_at AND starts_at < query_end`

Never invent duration.

`event_candidates` and `pnpm expire:events` are accepted.

---

# 9. SearchDocuments / semantic contract

SearchDocument:

`search-document-v1`

Embedding template:

`lexical-embedding-template-v1`

Use deterministic `embedding_text`.

Semantic contract:

provider:
Voyage

model:
`voyage-4`

config/revision:
`voyage-4-preflight-v1`

dimension:
1024

document input:
`document`

query input:
`query`

query template:
`semantic-query-template-v1`

Embedding lifecycle:

READY / FAILED / STALE

Rules:

- FAILED terminal immutable;
- retry = new attempt identity;
- READY→STALE retains vector/history;
- incompatible hash/model/config never retrievable;
- no ANN.

Historical FAILED attempt retained:

`b721e3e9-bb58-4313-ba0c-9421d3ed0602`

Its later retry succeeded.

At SEM-01 completion:

4 compatible READY
+
1 historical FAILED
+
0 STALE

Runtime counts are dynamic; never hardcode them.

---

# 10. SEM-01 — accepted

Commit:

`febdb189c5a9a36e16a7d30c8fce67f29f586695`

Runtime config:

- query timeout: 700 ms
- circuit: 3 qualifying failures
- cooldown: 30 s
- one half-open probe
- semantic candidate cap: 30

`shouldEmbed` is deterministic EN/SV and controls provider invocation only.

It must never suppress deterministic search.

`semantic_candidates`:

exact pgvector cosine over compatible READY docs only.

Provider/circuit degradation:

query_vector = NULL
→ one `api.search_v1`
→ deterministic search continues
→ HTTP 200
→ `semanticDegraded=true`

No request-time retry.
No ANN.

Real EN semantic smoke passed.

Formal lift:

`SEMANTIC_DEV_LIFT_NOT_ASSESSABLE_DUE_TO_CURRENT_INVENTORY`

---

# 11. RANK-01 — accepted

Commit:

`e7e13033e6c8765fe818faed1f34d4b566077713`

Config:

`rank-01-rrf-v1 / RRF_V1`

Formula:

`Σ 1/(60 + stage_rank)`

Equal-weight rank-only RRF.

Ordinary stages:

- ASCII/accentless exact
- prefix
- trigram
- FTS
- taxonomy
- Event
- semantic

No raw lexical/cosine magnitude.
No stage weights.
No learned ranking.
No reranker.

Protected exact precedes ordinary RRF.

Canonical IDs exactly once.

Semantic NULL/degraded path fuses remaining stages only.

Tie context:

1. protected context;
2. direct taxonomy context;
3. CanonicalEntity UUID ascending.

Do not reopen RANK-01 outside explicit EVAL-03 config tuning.

---

# 12. NONCOLLAPSE-01 — accepted

Commit:

`1609514041779866a70a881d43b14bfa7f88b954`

Config:

`noncollapse-v1 / NONCOLLAPSE_V1`

Initial rule:

- deterministic broad EN/SV/time/geo/parent-browse applicability;
- top-K window: 5;
- concentration cap: 2;
- comparable promotion requires:
  `candidate_base_rrf >= displaced_base_rrf * 0.90`.

Grouping:

taxonomy:
active membership path depth 1 using stable UUIDs; multi-label supported

chain:
explicit `chain_key` only

Event venue:
linked `Event.venue_place_id` only

Never infer chain or venue grouping heuristically.

Non-collapse:

- runs after RRF;
- changes order only;
- preserves same exactly-once eligible candidate set;
- does not change RRF values;
- protected/known-item queries are immune;
- leaf/narrow taxonomy queries abstain;
- weak alternatives are never promoted merely for diversity;
- no comparable alternative → abstain.

Real broad smoke:

applicable, but `NO_CONCENTRATION`; no movement.

DEV result:

`NONCOLLAPSE_DEV_EFFECT_NOT_ASSESSABLE_DUE_TO_CURRENT_INVENTORY`

This is accepted because deterministic fixtures prove behavior.

Do not reopen during MOB-03.

---

# 13. Local DB / test caveat

Primary local DB was accidentally reset during EMBED-01B.

Recovery used only approved seeded reset + accepted reconstruction paths.

No manual canonical/SearchDocument recreation occurred.

Do not force historical local IDs/counts into runtime state.

Last reported runtime snapshot:

1 Place
3 Events
4 active SearchDocuments
4 compatible READY embeddings

This is dynamic, not normative.

Latest known unrelated test noise:

- state-sensitive provenance fixture conflicts from reconstructed DB;
- one pre-existing Event diagnostic DB-lint warning.

NONCOLLAPSE-01 reported the diagnostic warning unchanged.

Do not mutate accepted history merely to hide unchanged unrelated noise.

---

# 14. Evaluation guardrails

Frozen corpus:

110 total

- DEV: 60
- SEALED: 30
- adversarial: 20

Semantic allocation:

16 / 8 / 6

At least 12 EN/SV semantic pairs.

Historical EVAL-02 artifacts:

`dataset-manifest.day2.v1`

`judgments.day2.v1`

Do not mutate viewed judgment/inventory versions.

SEALED is inaccessible during tuning.

Do not:

- inspect SEALED;
- hand-insert DEV targets;
- tune source acquisition around evaluation cases;
- force current runtime inventory to historical EVAL-02 state.

Inventory absence may legitimately be:

`INVENTORY`

rather than automatically `RANKING`.

EVAL-03 owns full 60-DEV tuning/freeze.

---

# 15. Current task — MOB-03

Current task:

`MOB-03 — Event + semantic/degraded mobile UX`

Backend ranking is complete through:

RRF
→ NONCOLLAPSE

MOB-03 owns presentation only.

Preserve:

- EN/SV language switch;
- UI language independent of query language;
- direct name search;
- category browse;
- broad/NL search;
- loading / empty / error;
- same Edge endpoint.

Add/complete:

- Event cards;
- known-end and point-Event time presentation;
- linked/standalone venue presentation;
- localized semantic-degraded state;
- mixed Place/Event rendering.

Critical invariant:

render server results in received order.

No client:

- reranking
- Event sorting
- semantic sorting
- diversity pass
- Voyage call
- direct PostgreSQL call
- second Event endpoint

`semanticDegraded=true` is successful deterministic fallback, NOT an error.

Mobile must not expose:

- provenance/H+A
- RRF/non-collapse internals
- semantic cosine
- Voyage/model details
- private diagnostics

If frozen-required Event presentation data is genuinely missing from the public
SearchResponse, STOP and report the contract gap rather than expanding backend
scope silently.

Stop before EVAL-03.

---

# 16. Remaining sequence

Current:

MOB-03

Then:

EVAL-03

Then Day 4:

COVERAGE-01
→ QA-01
→ PERF-01
→ EVAL-04
→ DEPLOY-01
→ DOCS-01

Do not work ahead.

---

# 17. Codex execution discipline

Usage is constrained.

For each package:

1. read `AGENTS.md`;
2. read this compact handoff;
3. read explicit package prompt;
4. inspect Git only as needed;
5. search only task-specific frozen sections;
6. preflight internally;
7. implement;
8. run focused tests;
9. run relevant regressions only;
10. inspect diff/scope;
11. commit;
12. STOP.

Avoid:

- full frozen-doc rereads;
- accepted-history rereads;
- huge successful logs;
- unnecessary questions;
- speculative cleanup.

Stop only for:

- real external/access blocker;
- missing legal/source truth;
- frozen-contract conflict;
- `SPEC_CHANGE_REQUIRED`;
- required explicit human decision.

Use forward-only fixes.

One package = one implementation commit.

---

# 18. Fresh-thread startup

Current task:

`MOB-03`

Recommended model:

GPT-5.6 Sol
Medium reasoning

Fresh thread:

1. confirm clean working tree;
2. read `AGENTS.md`;
3. read this file;
4. confirm accepted history contains:
   `1609514041779866a70a881d43b14bfa7f88b954`
   plus any later docs-only handoff commit;
5. read only MOB-03-relevant frozen sections;
6. execute explicit MOB-03 prompt;
7. do not change backend ranking;
8. do not inspect SEALED;
9. stop before EVAL-03.

Expected commit:

`feat(mobile): add event and semantic search UX`

---

# 19. MOB-03 completion report

Return <=20 lines:

Task: MOB-03
Commit:
Event card:
Point/known-end display:
Linked/standalone venue:
EN/SV:
semanticDegraded UX:
Loading/empty/error:
Server-order preservation:
Query-language independence:
Direct Place smoke:
Event smoke:
Broad smoke:
Accessibility/responsive:
Mobile security:
Tests:
Backend changes:
Scope audit:
SPEC_CHANGE_REQUIRED:
Working tree:
Next task: EVAL-03

STOP.