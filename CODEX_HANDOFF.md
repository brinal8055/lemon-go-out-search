# Lemon Going-Out Search — Compact Codex Handoff

Last updated: 2026-08-15

Purpose: minimum durable context required to start a fresh Codex thread safely.

Do not use this file instead of the frozen sources.
Do not expand this file with detailed package specifications already present
elsewhere.

---

# 1. Authority

Frozen source hierarchy:

1. `docs/requirements/Requirements_Baseline_v1_1.md`
2. `docs/architecture/Final_Architecture_v1_0.md`
3. `docs/specification/Final_Technical_Specification_v1_0.md`
4. `docs/implementation/Final_Implementation_Plan_v1_0.md`

Manifest:

`docs/FROZEN_SOURCES.md`

Authority rule:

Requirements > Architecture > Technical Specification > Implementation Plan

True conflict:

`SPEC_CHANGE_REQUIRED`

Other rules:

- Git history is authoritative for accepted implementation state.
- Explicit current task prompt defines the package boundary.
- Read only task-relevant frozen sections.
- Do not reread all frozen documents/history.
- `CODEX_START_HERE.md` is deprecated/deleted; never recreate it.
- Never rewrite accepted commits/history.

---

# 2. Architecture in one screen

Trial scope:

full Jönköping municipality, Sweden

Production path:

Expo / React Native
→ Supabase Edge
→ one public `api.search_v1` PostgreSQL RPC
→ private PostgreSQL/PostGIS/pgvector stages

Postgres is the sole canonical/search datastore.

No:

- Elasticsearch
- Redis search
- secondary search datastore
- request-time scraping
- ANN/HNSW/IVFFlat
- LLM router/rewriter/reranker
- learned ranking

Search stack:

protected exact
+ ordinary lexical/taxonomy
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

DAY 3 completed:

SRC-03B
→ EVENT-01

EMBED-01B
→ SEM-01

EVENT-01 + SEM-01
→ RANK-01

Current task:

`NONCOLLAPSE-01`

Remaining Day 3:

NONCOLLAPSE-01
→ MOB-03
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

Accepted package history:

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

Expected working tree at package boundary:

CLEAN

---

# 5. Evidence / identity invariants

Source lineage:

Source
→ SourceRecord
→ immutable SourceRecordVersion H
→ ParseAttempt A

Source-current evidence is exact:

current_version_id H
+
current_parse_attempt_id A

Rules:

- capture before parse;
- H immutable;
- parser replay = same H + new A;
- failed newer parse never destroys last-good H+A;
- source-current evidence != canonical-current truth.

CanonicalEntity identity is separate from SourceRecord identity.

No heuristic cross-source auto-merge.

Duplicate decisions pin exact H+A.

Changed pinned evidence reopens finalized duplicate decisions through:

`OPEN_REVIEW`

Targeted provenance/history is retained.

Compliance invariant:

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

Geometry eligibility:

`ST_Covers`

Active taxonomy:

`active-going-out.v1`

Nodes:

52

Taxonomy checksum:

`ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2`

No legacy taxonomy.
Do not stretch taxonomy to satisfy supply targets.

---

# 7. Exact / eligibility invariants

Protected only:

1. eligible accent-preserving canonical exact;
2. qualifying verified alias exact when unique among eligible entities and
   without eligible canonical-name conflict.

Not protected:

- accentless/ASCII exact
- prefix
- typo
- trigram
- FTS
- taxonomy
- Event evidence
- semantic evidence

Eligibility always precedes protection/retrieval/ranking.

Every final CanonicalEntity appears exactly once.

Hard filters can never be bypassed by semantic, RRF or non-collapse.

---

# 8. Event branch — accepted

Event source:

`JONKOPING_EVENT_CALENDAR`

Policy:

`EXTRACTED_FIELDS_ONLY`

Refresh:

`DELTA_ONLY`

Stable key:

`event/<source-event-uuid>`

Only accepted source records:

`occurrence_count == 1`

Multi-occurrence:

`UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY`

1→N:

`IDENTITY_BECAME_AMBIGUOUS`

Never infer identity from title/date/start/venue/index/hash.

Source does not provide reliable literal SCHEDULED status.

Accepted bounded interpretation:

`SCHEDULED`

with provenance method:

`MANUAL`

backed by exact H+A.

Never infer cancellation/completion/postponement from DELTA absence/outage/time.

EVENT-01 accepted config:

- horizon: 30 days
- source critical-fact freshness: 48h
- only SCHEDULED Events participate

Known-end overlap:

`starts_at < query_end AND ends_at > query_start`

Known-end current:

`ends_at > now`

Point Event:

`query_start <= starts_at AND starts_at < query_end`

Point current:

`starts_at >= now`

Never invent duration.

`event_candidates` and `pnpm expire:events` are accepted.

Do not recompute/redefine Event eligibility in later ranking packages.

---

# 9. SearchDocuments / embeddings

SearchDocument version:

`search-document-v1`

Embedding template:

`lexical-embedding-template-v1`

Use existing deterministic `embedding_text`.

Selected semantic contract:

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

Important:

- FAILED terminal immutable;
- retry = new attempt row/key;
- READY→STALE retains vector/history;
- old document hash/model/config never considered compatible;
- no ANN.

A historical provider-rate-limit FAILED attempt exists and must remain preserved:

`b721e3e9-bb58-4313-ba0c-9421d3ed0602`

Its later retry succeeded.

At SEM-01 completion:

4 compatible READY embeddings
+
1 historical FAILED attempt
+
0 STALE

Runtime corpus counts are dynamic; never hardcode them.

---

# 10. Semantic branch — accepted

SEM-01:

`febdb189c5a9a36e16a7d30c8fce67f29f586695`

Accepted runtime config:

- query timeout: 700 ms
- circuit open after 3 qualifying failures
- cooldown: 30 s
- one half-open probe
- semantic candidate cap: 30

`shouldEmbed` is deterministic EN/SV.

It controls provider invocation ONLY and never suppresses deterministic search.

`semantic_candidates` uses exact pgvector cosine over compatible READY
SearchDocuments only.

Provider/circuit failure:

query vector = NULL
→ one `api.search_v1` call still happens
→ deterministic search proceeds
→ HTTP 200
→ `semanticDegraded=true`

No request-time retry.

No ANN.

Real EN semantic smoke passed.

Formal semantic DEV lift remains:

`SEMANTIC_DEV_LIFT_NOT_ASSESSABLE_DUE_TO_CURRENT_INVENTORY`

---

# 11. RANK-01 — accepted base ranking

Commit:

`e7e13033e6c8765fe818faed1f34d4b566077713`

Config:

`rank-01-rrf-v1`

Algorithm:

`RRF_V1`

Formula:

`Σ 1/(60 + stage_rank)`

Equal-weight, rank-only.

Participating ordinary stages:

- ASCII/accentless exact
- prefix
- trigram
- FTS
- taxonomy
- Event
- semantic

No raw lexical/cosine magnitude in fusion.

No stage weights.
No learned ranking.
No reranker.

Protected exact precedes ordinary RRF.

Canonical IDs exactly once.

Semantic NULL/degraded path simply fuses remaining stages.

Accepted final deterministic tie context:

1. protected context;
2. direct taxonomy context;
3. CanonicalEntity UUID ascending.

NONCOLLAPSE-01 must consume this base order and must NOT modify RRF.

---

# 12. Local DB / test caveat

During EMBED-01B the primary local DB was accidentally reset.

Recovery used only approved seeded reset + accepted ingestion/reconstruction
paths.

No manual canonical/SearchDocument reconstruction occurred.

Historical evaluation snapshots and historical local UUIDs must NOT be forced
back into the current runtime DB.

Last reported reconstructed runtime snapshot:

1 Place
3 Events
4 active SearchDocuments
4 compatible READY embeddings

This snapshot is dynamic, not normative.

Known unrelated local-state test noise after RANK-01:

- 2 provenance fixture conflicts;
- 1 pre-existing EVENT diagnostic lint warning.

Do not modify accepted packages merely to hide unchanged state-sensitive noise.

Fix only failures genuinely caused by the active package.

---

# 13. Evaluation guardrails

Frozen corpus:

110 total

- DEV: 60
- SEALED: 30
- adversarial: 20

Semantic:

16 / 8 / 6

At least 12 EN/SV semantic pairs.

EVAL-02 historical baseline:

`dataset-manifest.day2.v1`

judgments:

`judgments.day2.v1`

Do NOT mutate viewed judgment/inventory versions.

SEALED is inaccessible during tuning.

Do not:

- inspect SEALED;
- tune acquisition around evaluation targets;
- hand-insert missing DEV entities;
- treat current runtime inventory as the historical EVAL-02 inventory.

Inventory absence may legitimately be attributed to:

`INVENTORY`

rather than automatically `RANKING`.

EVAL-03 owns full 60-DEV tuning/freeze.

---

# 14. Current task — NONCOLLAPSE-01

Current task:

`NONCOLLAPSE-01 — broad-only relevance-primary non-collapse`

Input:

accepted completed RRF base rank.

Purpose:

prevent pathological concentration on clearly broad discovery queries only when
sufficiently comparable already-retrieved alternatives exist.

Allowed concentration dimensions:

- active taxonomy grouping;
- explicit/stable chain grouping only;
- deterministic Event→Place venue grouping only.

Never infer:

- chain from similar names;
- Event venue relation from fuzzy strings;
- taxonomy from AI/semantic similarity.

Must NOT affect:

- known-item/navigation;
- protected exact;
- short name-shaped queries;
- explicit narrow taxonomy requests.

Rules:

- runs AFTER RRF;
- reorder only already-eligible candidates;
- relevance remains primary;
- weak candidate must not jump stronger result merely for variety;
- if no comparable alternative exists: ABSTAIN;
- same canonical candidate set;
- no truth mutation;
- deterministic;
- diagnostics restricted.

Do NOT implement:

- MMR
- generalized diversity framework
- new retriever
- weighted/learned diversity
- RRF changes
- client reranking
- source/taxonomy mutation

Exact NONCOLLAPSE implementation tunables belong in the explicit package prompt,
not this handoff.

Stop before MOB-03.

---

# 15. Remaining sequence

Current:

NONCOLLAPSE-01

Then:

MOB-03
→ EVAL-03

Then Day 4:

COVERAGE-01
→ QA-01
→ PERF-01
→ EVAL-04
→ DEPLOY-01
→ DOCS-01

Do not work ahead.

---

# 16. Codex execution discipline

Usage is constrained. Optimize context.

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

- rereading full frozen docs;
- rereading accepted package history;
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

# 17. Fresh-thread startup

Current task:

`NONCOLLAPSE-01`

Recommended model:

GPT-5.6 Sol
High reasoning

Fresh thread startup:

1. confirm clean working tree;
2. read `AGENTS.md`;
3. read this file;
4. confirm accepted history contains:
   `e7e13033e6c8765fe818faed1f34d4b566077713`
   plus any later docs-only handoff commit;
5. search only NONCOLLAPSE-relevant frozen sections;
6. execute explicit NONCOLLAPSE-01 prompt;
7. do not reopen RANK-01;
8. do not inspect SEALED;
9. do not begin MOB-03 automatically.

Expected implementation commit:

`feat(search): add broad non-collapse ranking`

---

# 18. Completion report

Keep successful package report <=20 lines.

For NONCOLLAPSE-01:

Task:
Commit:
Config/version:
Applicability:
Top-K / concentration cap:
Relevance cohort:
Taxonomy grouping:
Chain grouping:
Event-venue grouping:
Protected / known-item immunity:
Narrow taxonomy immunity:
Canonical uniqueness / eligibility:
Determinism:
Diagnostics:
Broad DEV assertions:
Real broad smoke:
Direct-name immunity:
Tests / known unrelated noise:
Scope audit / SPEC_CHANGE_REQUIRED:
Working tree:
Next task: MOB-03

STOP.