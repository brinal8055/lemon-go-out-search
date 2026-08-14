# Lemon Going-Out Search — Codex Implementation Handoff

## Purpose

This file allows a fresh Codex session to continue Lemon implementation without
access to previous Codex conversation history.

Codex should use:

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. `docs/FROZEN_SOURCES.md`
4. only the frozen document sections required for the explicitly supplied
   current task

`CODEX_START_HERE.md` is deprecated and intentionally removed.

Do not require or recreate it.

Do not routinely read historical drafts, amendments, reviews, research documents,
or previously accepted task conversations.

Git history is authoritative for completed implementation work.

The explicit user task prompt is authoritative for the current approved task.

---

## Frozen authority hierarchy

Requirements
>
Final Architecture
>
Final Technical Specification
>
Final Implementation Plan

Paths:

- `docs/requirements/Requirements_Baseline_v1_1.md`
- `docs/architecture/Final_Architecture_v1_0.md`
- `docs/specification/Final_Technical_Specification_v1_0.md`
- `docs/implementation/Final_Implementation_Plan_v1_0.md`

Frozen-source checksums and materialization metadata live in:

- `docs/FROZEN_SOURCES.md`

If a genuine contradiction exists between frozen authorities:

`SPEC_CHANGE_REQUIRED`

Do not reinterpret, silently reconcile, or infer a new contract.

---

## Usage discipline

Codex usage is constrained.

Optimize token/model usage without weakening implementation quality.

For every task:

- do not reread accepted task history;
- do not read all four frozen documents end-to-end;
- search/open only current-task-relevant sections and direct cross-references;
- inspect only implementation files needed by the current package;
- do not produce architecture/design essays when architecture is already frozen;
- perform dependency preflight internally;
- if dependencies pass, continue automatically through implementation,
  verification, diff inspection, scope audit, and commit;
- stop early only for a genuine blocker or frozen-contract conflict;
- keep successful command/test output concise;
- inspect verbose logs only when something fails;
- do not rerun expensive unrelated live-source/evaluation suites unless the
  current change actually requires them;
- do not use a stronger model than the task requires;
- return concise completion reports.

Quality gates, frozen contracts, security requirements, and tests remain
unchanged.

---

## Core architecture invariants

- Supabase/Postgres is canonical and the sole trial search datastore.
- Stable Lemon canonical identity is separate from external source identity.
- Place and Event lifecycles are separate.
- Only the Active Going-Out Taxonomy is valid.
- Geographic scope is the full Jönköping municipality.
- Source chain:

  Source
  → SourceRecord
  → immutable SourceRecordVersion
  → rerunnable ParseAttempt

- Source-current evidence is the selected successful H+A pair.
- Source-current evidence and canonical-current truth are independent.
- No heuristic cross-source auto-merge.
- Deterministic retrieval always remains available.
- Semantic retrieval is optional/additive.
- Eligible accent-preserving canonical exact is protected.
- Verified alias exact is protected only when qualifying/unambiguous.
- Accentless exact, prefix, and trigram are ordinary evidence.
- Simple fixed RRF is added later.
- Broad non-collapse runs after ranking/relevance later.
- The trial uses exact pgvector scan; no ANN.
- Public search path:

  Mobile
  → Edge
  → `api.search_v1`
  → private PostgreSQL search implementation

- Mobile never receives backend/service-role/database/provider secrets.
- Edge performs exactly one public search RPC for a normal search request.
- Embeddings are the only launch AI dependency.
- Evaluation corpus, judgments, and manifests are frozen/versioned.
- SEALED evaluation data is not available to ordinary DEV tuning.

---

# Accepted implementation

There are currently 14 accepted implementation packages.

## BOOT-01

commit: `4e5ab76898886f8111cb5913ed64e4ad38edb903`

message: `chore(boot): establish BOOT-01 repository foundation`

## DB-01A

commit: `18653d2eaeebd1de15355c3b4b2cfc44eb902475`

message: `feat(db): implement DB-01A source evidence foundation`

## DB-01B

commit: `78861bb5f7f57e8e67d83801af4e7972ef91de1b`

message: `feat(db): implement DB-01B canonical domain taxonomy schemaReadMe changes`

## DB-01C

commit: `be0d10963faf71a6c579e6a82fd676d9bac2cf2c`

message: `feat(db): implement DB-01C search projection configuration schema`

## DB-02

commit: `8c5dbe31980ae37a6eeffd69e54e4f75424cbfe7`

message: `feat(db): implement DB-02 source-current evidence transactions`

## REF-01

commit: `c5dc762449962064c44da681e1dd031b2980a087`

message: `feat(ref): seed active taxonomy and Jonkoping scope`

## EVAL-01

commit: `3221f3f3cda64d95efb5472fa6f81dbc2408f2b7`

message: `feat(eval): freeze evaluation corpus scaffold`

## ING-01

commit: `8ea9b7783fe8bccedac9478208545fc4c23252f6`

message: `feat(ingest): implement six-stage ingestion core`

## SRC-01

commit: `18fff86e1b837a13876c98b35e19ea905c2e2ff5`

message: `feat(source): add bounded OSM ingestion adapter`

## DAY1-PUB-01

commit: `1281c14b9faebf16accd45fa298784069f0fed3b`

message: `fix(ingest): complete first-place publication bridge`

## SEARCH-01

commit: `8e1d6c09664c08088fc6882da67cf2ebe3204d9a`

message: `feat(search): implement eligibility and known-item retrieval`

## SEC-01

commit: `a9cd73b28185804b65a1775e1af7ef55438eff22`

message: `feat(security): implement SEC-01 search RPC boundary`

## EDGE-01

commit: `d0e3f1951581de51894920538403995ce77244ea`

message: use the exact Git commit subject from repository history

## MOB-01

commit: `464c3f4d42ca961a82b051d74cfff5211611d75d`

message: use the exact Git commit subject from repository history

The accepted DB-01B/DB-01C history is preserved exactly as Git records it,
including historical irregularities.

Do not normalize or rewrite previously accepted history.

Previously accepted Git history must not be amended, squashed, rebased, or
rewritten unless explicitly instructed.

For EDGE-01 and MOB-01, Git history is authoritative for the exact commit
subjects if this handoff does not record them literally.

---

# Milestone status

## Day 1 — COMPLETE

The non-negotiable first vertical slice is complete:

Real OSM acquisition
→ source evidence
→ canonical Place
→ truthful taxonomy/provenance
→ deterministic SearchDocument
→ published Place
→ known-item search
→ protected exact behavior
→ secured public RPC
→ thin Edge endpoint
→ Expo/mobile search
→ real result rendered

The real smoke entity is:

OSM source identity:
`OSM_OVERPASS + node/254912492`

Canonical name:
`Evergreen Restaurang & Pizzeria`

A clean database reset may recreate a different CanonicalEntity UUID.

Do NOT treat a previously observed runtime CanonicalEntity UUID as durable across
resets.

Locate this real entity using source identity plus canonical name.

---

# Current implementation state

## Reference data

- Active Going-Out Taxonomy: 52 nodes.
- Taxonomy version: `active-going-out.v1`.
- Taxonomy checksum:

  `ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2`

- Jönköping municipality scope ID:

  `a4b19b09-b272-5748-80ef-2c91d9d33ca6`

- Municipality boundary is frozen from Lantmäteriet.
- Boundary ID:

  `0a39b199-4cd5-5358-85de-2c1a5f91a347`

- Boundary version:

  `lm-current-2026-08-14`

- Boundary artifact checksum:

  `257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d`

- Timezone:

  `Europe/Stockholm`

---

## Evaluation

- Corpus version: `corpus.v1`.
- Corpus checksum:

  `bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c`

- Total queries: 110.
- DEV: 60.
- SEALED: 30.
- ADVERSARIAL: 20.
- Semantic allocation:
  - DEV 16
  - SEALED 8
  - ADVERSARIAL 6
- EN/SV paired semantic intents:
  12 groups / 24 queries.
- SEALED judgments remain protected from normal DEV/tuning workflows.

---

## Ingestion

Implemented:

- six-stage ingestion core;
- capture-before-parse;
- immutable SourceRecordVersion;
- rerunnable ParseAttempt;
- NEW / CHANGED / UNCHANGED behavior;
- DB-02 source-current H+A selection;
- stale-processing protection;
- last-good preservation;
- snapshot/delta refresh semantics;
- fixture-driven rerun/idempotency;
- bounded real OSM/Overpass adapter.

OSM policy:

- refresh mode: `DELTA_ONLY`;
- persistence: `EXTRACTED_FIELDS_ONLY`;
- stable external identity:

  `node|way|relation/<id>`

- bounded real OSM ingestion works and reruns reproducibly;
- no heuristic cross-source merge exists.

---

## First published Place

Durable source identity:

`node/254912492`

Canonical name:

`Evergreen Restaurang & Pizzeria`

Current accepted behavior:

- publication status: `PUBLISHED`;
- Place status: `UNKNOWN` and eligible;
- scope: active full Jönköping municipality;
- boundary validated with frozen PostGIS semantics;
- taxonomy:
  `Dining`;
- taxonomy evidence:
  `amenity=restaurant`;
- membership method:
  `DETERMINISTIC_MAP`;
- targeted provenance:
  - `canonical_name`
  - `location`
- active deterministic Day-1 SearchDocument exists;
- deterministic publication does not require an embedding.

The minimal Day-1 SearchDocument template is not a replacement for DOC-01.

DOC-01 still owns the full production SearchDocument builder.

---

## norm-v1

Authoritative shared implementation exists.

Package:

`packages/normalization/`

SQL helpers:

- `app.norm_v1_preserving`
- `app.norm_v1_accentless`

Frozen behavior:

- preserve original display string separately;
- reject forbidden control characters;
- NFC normalization;
- locale-independent lowercase/case-fold suitable for EN/SV;
- retain `å`, `ä`, `ö` in accent-preserving form;
- punctuation/separators → spaces;
- internal apostrophes/hyphens → spaces;
- collapse/trim whitespace;
- derive separate PostgreSQL-compatible unaccent fallback.

Accentless normalization is ordinary fallback evidence only.

It is never equivalent to protected canonical exact.

TypeScript and SQL implementations have golden-equivalence tests.

Because the Supabase Edge runtime cannot import repository packages outside
`supabase/functions`, EDGE-01 contains a self-contained norm-v1-equivalent
implementation.

That implementation is guarded by equivalence tests and must not diverge from
the authoritative norm-v1 contract.

---

# Search implementation

## SEARCH-01 — complete

Implemented privately:

- authoritative eligibility;
- accent-preserving canonical exact;
- protected canonical exact;
- same-name canonical coexistence;
- verified alias exact qualification;
- protected verified alias only when unique/unambiguous;
- alias collision removes protection;
- alias-vs-active-canonical-name conflict removes alias protection;
- ordinary accentless exact;
- ordinary prefix;
- bounded ordinary trigram;
- canonical-ID deduplication;
- internal match/protection diagnostics.

Not yet implemented:

- FTS candidates;
- taxonomy discovery candidates;
- Event candidates;
- semantic candidates;
- RRF;
- broad non-collapse.

---

# Security / public RPC

## SEC-01 — complete

Implemented:

- public shaped `api.search_v1` RPC;
- `SECURITY DEFINER`;
- empty/fixed controlled `search_path`;
- non-login `lemon_api_owner`;
- backend/service-role-only execution;
- minimal SELECT/RLS privileges;
- active deterministic search configuration;
- Jönköping public-search activation;
- no direct private-table exposure.

Security invariants already proven:

- public/no-key access denied as required;
- backend credential can execute RPC;
- private table/profile access denied;
- OpenAPI exposes only intended RPC surface;
- no private search diagnostic leakage.

Do NOT redesign this trust boundary in later tasks unless a frozen requirement
explicitly requires it.

---

# Edge

## EDGE-01 — complete

Implemented:

Mobile/client
→ thin Supabase Edge Function
→ exactly one fixed `api.search_v1` RPC
→ shaped public response

Implemented/proven:

- method validation;
- request validation/caps;
- request ID;
- CORS;
- backend-held credential;
- client authorization does not become privileged DB authorization;
- exactly one fixed RPC invocation;
- safe error shaping;
- no raw database/private diagnostic leakage;
- real Evergreen search smoke through Edge.

The Edge must remain thin.

Do not move ranking, canonical truth, direct private-table reads, ingestion, or
search-stage logic into Edge.

Semantic provider orchestration may be added later only according to frozen
EMBED/SEM packages.

---

# Mobile

## MOB-01 — complete

Implemented minimal Expo search slice:

- search input;
- search action;
- Edge-only search client;
- loading state;
- factual Place result card;
- empty state;
- recoverable error/retry;
- stale-response protection;
- no direct DB search path;
- no backend/service-role credential in mobile source/config.

Real smoke:

`Evergreen Restaurang & Pizzeria`

was rendered through:

Mobile
→ Edge
→ `api.search_v1`

No Day-2 mobile UX is implemented yet.

Deferred mobile work includes:

- EN/SV UI;
- richer card behavior;
- category/discovery UI;
- Event UI;
- semantic/degraded-state UX.

---

# Current next task

`SRC-02`

SRC-02 has NOT started unless Git history explicitly proves otherwise.

The explicit user task prompt always overrides the handoff's next-task pointer.

Never infer that another task should run automatically.

---

# Near-term Day-2 dependency sequence

Primary dependency spine:

```text
SRC-02
→ DEDUP-01
→ PROV-01
→ TAX-01
→ DOC-01
→ SEARCH-02
→ DIAG-01
→ MOB-02
→ EVAL-02