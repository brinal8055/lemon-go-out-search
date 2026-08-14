# Lemon Going-Out Search — Codex Implementation Handoff

## Purpose

This file allows a fresh Codex session to continue Lemon implementation without
access to previous Codex conversation history.

Read in this order:

1. `AGENTS.md`
2. `CODEX_HANDOFF.md`
3. `docs/FROZEN_SOURCES.md`
4. only the frozen document sections needed for the current task

Do not routinely read historical drafts/reviews.

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

If a genuine frozen contradiction exists:

`SPEC_CHANGE_REQUIRED`

Do not reinterpret.

## Core architecture invariants

- Supabase/Postgres is canonical and the sole trial search datastore.
- Stable Lemon canonical identity is separate from external source identity.
- Place and Event lifecycles are separate.
- Only the Active Going-Out Taxonomy is valid.
- Geographic scope is the full Jönköping municipality.
- Source chain: Source → SourceRecord → immutable SourceRecordVersion →
  rerunnable ParseAttempt.
- Source-current evidence is the selected successful H+A pair.
- Source-current evidence and canonical-current truth are independent.
- No heuristic cross-source auto-merge.
- Deterministic retrieval always remains available.
- Semantic retrieval is optional/additive.
- Eligible accent-preserving canonical exact is protected.
- Verified alias exact is protected only when qualifying/unambiguous.
- Accentless/prefix/trigram are ordinary evidence.
- Simple fixed RRF is added later.
- Broad non-collapse runs after relevance later.
- The trial uses exact pgvector scan, with no ANN.
- The public path is Mobile → Edge → one public PostgreSQL search contract.
- Embeddings are the only launch AI dependency.
- Evaluation corpus, judgments, and manifests are frozen/versioned.

## Accepted implementation

### BOOT-01

commit: `4e5ab76898886f8111cb5913ed64e4ad38edb903`

message: `chore(boot): establish BOOT-01 repository foundation`

### DB-01A

commit: `18653d2eaeebd1de15355c3b4b2cfc44eb902475`

message: `feat(db): implement DB-01A source evidence foundation`

### DB-01B

commit: `78861bb5f7f57e8e67d83801af4e7972ef91de1b`

message: `feat(db): implement DB-01B canonical domain taxonomy schemaReadMe changes`

### DB-01C

commit: `be0d10963faf71a6c579e6a82fd676d9bac2cf2c`

message: `feat(db): implement DB-01C search projection configuration schema`

### DB-02

commit: `8c5dbe31980ae37a6eeffd69e54e4f75424cbfe7`

message: `feat(db): implement DB-02 source-current evidence transactions`

### REF-01

commit: `c5dc762449962064c44da681e1dd031b2980a087`

message: `feat(ref): seed active taxonomy and Jonkoping scope`

### EVAL-01

commit: `3221f3f3cda64d95efb5472fa6f81dbc2408f2b7`

message: `feat(eval): freeze evaluation corpus scaffold`

### ING-01

commit: `8ea9b7783fe8bccedac9478208545fc4c23252f6`

message: `feat(ingest): implement six-stage ingestion core`

### SRC-01

commit: `18fff86e1b837a13876c98b35e19ea905c2e2ff5`

message: `feat(source): add bounded OSM ingestion adapter`

### DAY1-PUB-01

commit: `1281c14b9faebf16accd45fa298784069f0fed3b`

message: `fix(ingest): complete first-place publication bridge`

### SEARCH-01

commit: `8e1d6c09664c08088fc6882da67cf2ebe3204d9a`

message: `feat(search): implement eligibility and known-item retrieval`

The accepted DB-01B/DB-01C history is preserved exactly as Git records it,
including the irregular DB-01B subject. Do not normalize or rewrite it.

Previously accepted Git history must not be amended, squashed, rebased, or
rewritten unless explicitly instructed.

## Current implementation state

### Reference data

- Active Going-Out Taxonomy: 52 nodes.
- Taxonomy version: `active-going-out.v1`.
- Taxonomy checksum:
  `ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2`.
- Jönköping municipality scope ID:
  `a4b19b09-b272-5748-80ef-2c91d9d33ca6`.
- The municipality boundary is frozen from Lantmäteriet.
- Boundary ID: `0a39b199-4cd5-5358-85de-2c1a5f91a347`.
- Boundary version: `lm-current-2026-08-14`.
- Boundary artifact checksum:
  `257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d`.
- Timezone: `Europe/Stockholm`.

### Evaluation

- Corpus version: `corpus.v1`.
- Corpus checksum:
  `bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c`.
- Queries: 110 total; DEV 60; SEALED 30; ADVERSARIAL 20.
- Semantic allocation: 16 / 8 / 6.
- EN/SV paired semantic intents: 12 groups / 24 queries.
- SEALED judgments remain protected from normal DEV workflows.

### Ingestion

- The six-stage ingestion core exists.
- A bounded OSM/Overpass adapter exists.
- OSM source policy is `DELTA_ONLY + EXTRACTED_FIELDS_ONLY`.
- Real bounded OSM ingestion is working and rerunnable.
- Source-current selection uses the DB-02 H+A transaction contract.

### First published Place

OSM external key:
`node/254912492`

Canonical name:
`Evergreen Restaurang & Pizzeria`

- Publication status: `PUBLISHED`.
- Place status: `UNKNOWN` and eligible.
- Scope: active full Jönköping municipality.
- Taxonomy: Dining, deterministically mapped from `amenity=restaurant`.
- Current targeted provenance: `canonical_name` and `location`.
- An active deterministic Day-1 SearchDocument exists.
- Deterministic publication does not require an embedding.

CanonicalEntity UUID may change after a clean reset because the current fixture
does not freeze that UUID across database recreation. Locate the current reset
instance by OSM source identity plus canonical name; do not rely on a previously
reported runtime CanonicalEntity UUID.

### Search

SEARCH-01 is accepted.

Implemented:

- shared `norm-v1`;
- TypeScript and SQL golden equivalence;
- authoritative eligibility;
- protected canonical exact;
- conditional verified alias exact;
- ordinary accentless exact;
- ordinary prefix;
- bounded trigram;
- private match/protection diagnostics.

Not implemented yet:

- public `api.search_v1`;
- SEC-01 public security boundary;
- Edge;
- mobile;
- FTS/taxonomy discovery;
- Events;
- semantic retrieval;
- RRF;
- non-collapse.

## norm-v1

- Preserve the display string separately.
- Reject forbidden control characters.
- Apply NFC.
- Apply locale-independent lowercase/case-fold behavior suitable for EN/SV.
- Retain å/ä/ö in the accent-preserving form.
- Convert punctuation and separators to spaces.
- Convert internal apostrophes and hyphens to spaces.
- Collapse and trim whitespace.
- Derive a separate PostgreSQL-compatible unaccent fallback.

Implementation:

`packages/normalization/`

SQL helpers:

- `app.norm_v1_preserving`
- `app.norm_v1_accentless`

## Current next task

`SEC-01`

SEC-01 has NOT started.

A fresh session must not infer another task from this file if the user explicitly
supplies a different approved task.

## Expected near-term sequence

```text
SEC-01
EDGE-01
MOB-01
```

Then continue the remaining Day-2+ dependency graph from the Final
Implementation Plan.

Do not blindly execute multiple tasks. Work one approved package at a time.

## Package protocol

For every implementation task:

1. read `AGENTS.md`;
2. inspect `CODEX_HANDOFF.md`;
3. inspect only relevant frozen-document sections;
4. preflight dependencies;
5. state exact frozen contracts;
6. state non-goals;
7. implement only the current package;
8. run focused tests;
9. run required regression tests;
10. inspect the diff;
11. perform a scope audit;
12. auto-commit only if successful;
13. report completion;
14. STOP.

Never automatically begin the next task.

## Git discipline

From DB-02 onward, one accepted implementation task should normally correspond
to one Git unit. Previously accepted combined or irregular history does not need
rewriting.

Before automatic commit:

- tests PASS;
- required regressions PASS;
- `SPEC_CHANGE_REQUIRED=NONE`;
- no unresolved task-blocking source/reference blocker;
- inspect status and diff;
- stage only current-task files;
- exclude unrelated dirty files and secrets.

Report the commit hash, commit message, working-tree status, and next approved
task.

## Important non-goals

Unless a frozen task explicitly requires otherwise, do not introduce:

- new microservices;
- queues;
- Redis/cache;
- a secondary search engine;
- ANN;
- a crawler framework;
- an admin application;
- a generalized audit/evidence platform;
- generalized recurrence;
- LTR/reranking;
- an LLM router;
- subjective AI attributes;
- multiple production embedding providers;
- advanced observability infrastructure.
