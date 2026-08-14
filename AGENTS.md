# Lemon Going-Out Search — Codex Repository Instructions

This repository implements the approved four-day Lemon Going-Out Search vertical slice.

These instructions are persistent execution rules for Codex.

They are not a substitute for the frozen project documents.

---

# 1. Authoritative Documents

The implementation authorities, in precedence order, are:

1. Requirements Baseline v1.1
2. Final Architecture v1.0
   - Status: ARCHITECTURE_APPROVED
3. Final Technical Specification v1.0
   - Status: FINAL_TECHNICAL_SPECIFICATION_FROZEN
4. Final Implementation Plan v1.0
   - Status: IMPLEMENTATION_PLAN_APPROVED

Use the actual repository copies of these documents.

Read `CODEX_HANDOFF.md` for current implementation state. The frozen authorities
are persisted locally at:

- `docs/requirements/Requirements_Baseline_v1_1.md`
- `docs/architecture/Final_Architecture_v1_0.md`
- `docs/specification/Final_Technical_Specification_v1_0.md`
- `docs/implementation/Final_Implementation_Plan_v1_0.md`

Their checksums and materialization provenance are recorded in
`docs/FROZEN_SOURCES.md`.

The Final Architecture, Final Technical Specification, and Final Implementation
Plan are frozen.

Do not reinterpret them from historical drafts, amendments, reviews, research
briefs, or previous implementation-plan versions.

Historical documents may be consulted only when explicitly requested to
investigate decision provenance.

If documents appear to conflict:

STOP.

Return:

SPEC_CHANGE_REQUIRED

with:

- exact conflicting documents/sections;
- exact behavior that cannot simultaneously be satisfied;
- smallest concrete explanation;
- work safely completed so far.

Do not resolve a frozen-document contradiction yourself.

---

# 2. Current Execution State

The project is in:

IMPLEMENTATION

Architecture/design/planning review is complete.

Do not:

- redesign architecture;
- rewrite specifications;
- reopen ADRs;
- create another implementation plan;
- introduce speculative abstractions;
- perform architecture cleanup merely because another design looks cleaner.

Implementation follows the approved Final Implementation Plan task queue.

Only execute the task explicitly requested in the current prompt.

Do not automatically begin the next task.

---

# 3. Core Implementation Philosophy

This is a four-day production-quality vertical slice.

Optimize in this order:

1. correctness;
2. data truth;
3. frozen-contract fidelity;
4. search quality;
5. reliability;
6. testability;
7. diagnosability;
8. deployment/reproducibility;
9. implementation speed;
10. UI polish.

Prefer:

- simple explicit SQL;
- deterministic logic;
- small TypeScript modules;
- direct tests;
- scripts instead of frameworks;
- explicit state transitions;
- bounded candidate sets;
- narrow interfaces;
- obvious failure behavior.

Avoid clever abstraction when straightforward code better exposes the frozen
contract.

---

# 4. Frozen Architecture Rules

The following are protected and must not be changed during implementation.

## Datastore

- Supabase/PostgreSQL is canonical.
- PostgreSQL is the sole four-day search datastore.
- No second search engine.
- No external vector datastore.
- No ANN index during the trial.
- Exact pgvector retrieval is the four-day vector strategy.

## Canonical/source separation

External source identity is separate from Lemon canonical identity.

Source evidence:

Source
→ SourceRecord
→ immutable SourceRecordVersion
→ rerunnable SourceRecordParseAttempt

Canonical truth exists separately.

Changing source-current evidence must not automatically mutate canonical truth.

## Place and Event

Place and Event are separate domain concepts with separate lifecycle semantics.

Do not collapse Event into Place tags.

## Taxonomy

Only the Active Going-Out Taxonomy may be loaded.

Taxonomy is:

- hierarchical;
- bilingual EN/SV;
- multi-label;
- evidence-bearing.

AI must not create taxonomy truth during the four-day implementation.

## Search

Deterministic retrieval always remains available.

Approved retrieval families include:

- canonical exact;
- verified alias exact;
- prefix;
- pg_trgm fuzzy;
- weighted FTS;
- taxonomy;
- Event/time;
- semantic exact-vector retrieval.

Semantic retrieval is additive.

Provider failure must degrade to deterministic search.

## Exact protection

Eligibility executes before protection.

Protected:

1. eligible accent-preserving canonical exact;
2. qualifying verified alias exact only when unambiguous and non-conflicting.

Not protected:

- accentless exact;
- prefix;
- trigram;
- FTS;
- taxonomy;
- semantic.

## Fusion

Use the approved simple/fixed RRF contract.

Do not introduce:

- learned-to-rank;
- score-calibration framework;
- cross-encoder;
- LLM reranking;
- per-family large weight matrices.

## Broad non-collapse

Broad-discovery non-collapse:

- applies only to clearly broad discovery;
- runs after relevance;
- must not affect known-item queries;
- must not affect narrow taxonomy queries;
- must not promote clearly weaker candidates;
- uses explicit chain identity only;
- must not infer chains solely from normalized names.

## Edge boundary

Runtime path:

Mobile
→ Supabase Edge Function
→ Supabase Data API/PostgREST
→ api.search_v1
→ private app schema

There is one public search DB call.

Mobile never receives backend/service-role/provider/scraper secrets.

---

# 5. High-Risk Frozen Technical Invariants

These are implementation law.

---

## 5.1 SourceRecordVersion

SourceRecordVersion represents immutable captured source evidence.

Parser execution does not define SourceRecordVersion identity.

The same captured content H may have:

H + A1 FAILED
H + A2 SUCCEEDED

without creating another SourceRecordVersion.

Do not put mutable parser lifecycle into SourceRecordVersion.

---

## 5.2 SourceRecordParseAttempt

A ParseAttempt represents one parser execution over one immutable
SourceRecordVersion.

Failed attempts remain diagnosable.

Successful corrected parser attempts may coexist with older attempts for the same
version.

H+A1 and H+A2 are distinct evidence executions.

---

## 5.3 Source-current evidence

SourceRecord:

current_version_id
+
current_parse_attempt_id

is one indivisible selected evidence pair.

The pair must be:

(NULL, NULL)

or a valid successful SourceRecordVersion + ParseAttempt pair.

Selection is explicit.

Never implement:

"latest timestamp wins".

Selection must validate the exact frozen ownership, success, legal availability,
execution identity, and expected-prior-pair/CAS semantics.

---

## 5.4 Source-current vs canonical-current

Source-current evidence is not canonical truth.

Advancing source-current evidence must not automatically mutate:

- source_records.canonical_entity_id;
- canonical_entities;
- places;
- events;
- canonical_fact_provenance;
- entity_taxonomy_memberships;
- search_documents;
- embeddings;
- publication state.

Canonical updates happen only through their approved canonical transaction.

---

## 5.5 Parser replay / stale processing

Downstream processing consumes an explicit:

(version_id, parse_attempt_id)

pair.

If the current selected pair changes before commit, stale processing must abort.

Same H but different A is still different evidence.

H+A1 must not be treated as equivalent to H+A2.

---

## 5.6 DuplicateCandidate evidence

Duplicate decisions must pin exact evidence execution.

Both sides carry:

- SourceRecord identity;
- SourceRecordVersion identity;
- successful ParseAttempt identity.

Evidence arrays/identity remain positionally associated with candidate record A/B.

A different ParseAttempt for the same SourceRecordVersion means different review
evidence.

---

## 5.7 Duplicate decisions

Decision history is append-only.

A stale finalized DuplicateCandidate decision must pass through current:

OPEN / OPEN_REVIEW

before another final SAME / SEPARATE / UNSURE decision is accepted.

Do not overwrite decision history.

---

## 5.8 SAME Type A

Type A means:

unresolved SourceRecord
→ existing CanonicalEntity.

There is no loser CanonicalEntity.

There is no MERGED transition.

Use the frozen manual mapping semantics.

---

## 5.9 SAME Type B

Type B means:

CanonicalEntity A + CanonicalEntity B
→ one real canonical entity.

Use explicit survivor/loser semantics.

Loser becomes merged/ineligible as defined by the Final Technical Specification.

Do not heuristic-auto-merge.

---

## 5.10 Embedding lifecycle

READY:

- vector present;
- generated_at present;
- compatible provider/model/revision/dimension/document;
- semantic eligible.

FAILED:

- vector NULL;
- generated_at NULL;
- error information present;
- terminal;
- not searchable.

Retry after FAILED:

- new row;
- new attempt_key.

STALE:

- only READY → STALE;
- retains previous vector;
- retains generated_at;
- stale reason recorded;
- not searchable.

Forbidden:

- FAILED → READY;
- FAILED → STALE;
- direct STALE insertion;
- semantic use of FAILED/STALE vectors.

---

## 5.11 Events

Use half-open time intervals.

Known-end Event overlap:

starts_at < request_end
AND
ends_at > request_start

Point/no-end Event:

request_start <= starts_at
AND
starts_at < request_end

Do not invent a default duration.

Known-end Event is expired when:

ends_at <= now

Point Event is expired when:

starts_at < now

Cancellation must be explicit.

Source outage is not cancellation.

---

## 5.12 Source refresh

Supported modes:

- COMPLETE_SNAPSHOT
- PAGINATED_SNAPSHOT
- DELTA_ONLY

DELTA_ONLY successful polling may advance source health.

DELTA_ONLY absence must never imply disappearance.

Snapshot disappearance semantics require the exact frozen complete-snapshot
conditions.

last_successful_refresh derives from qualifying ingestion runs according to the
Final Technical Specification.

Do not create an independent competing truth.

---

## 5.13 Compliance redaction

SourceRecordVersion is normally immutable.

Only the approved privileged compliance workflow may redact legally forbidden
retained content.

Audit actor must use:

session_user

not SECURITY DEFINER current_user.

Do not accept an untrusted actor parameter as authoritative audit identity.

---

# 6. Explicitly Prohibited Infrastructure / Scope

Do not introduce unless a frozen document explicitly requires it:

- microservices;
- additional backend services;
- Redis;
- queues;
- Kafka;
- event buses;
- Kubernetes;
- generic workflow engines;
- generic crawler frameworks;
- admin dashboards;
- generalized audit platforms;
- generalized evidence graphs;
- generic entity-resolution frameworks;
- automatic heuristic cross-source merging;
- second search datastore;
- Elasticsearch/OpenSearch;
- Typesense;
- Meilisearch;
- external vector DB;
- HNSW;
- IVFFlat;
- ANN;
- search cache;
- outbox/projector;
- generalized recurrence engine;
- subjective AI attribute system;
- LLM query router;
- LLM query rewriting;
- LLM reranker;
- generative search answers;
- personalization;
- popularity-dominant ranking;
- social ranking;
- large observability/dashboard systems.

If one appears necessary to satisfy a frozen requirement:

STOP and report SPEC_CHANGE_REQUIRED.

---

# 7. Task Execution Protocol

For each explicitly requested task:

1. Read this AGENTS.md.
2. Inspect only repository files and frozen-document sections needed for the task.
3. Confirm task dependencies.
4. Identify exact frozen contracts.
5. Identify explicit non-goals.
6. Implement only the requested task.
7. Add/update task-owned tests.
8. Run the narrowest relevant tests.
9. Run required regressions.
10. Inspect the diff.
11. Perform a scope audit.
12. Commit automatically if fully successful.
13. Return the completion report.
14. STOP.

Do not begin the next approved task automatically.

---

# 8. Context / Usage Efficiency

Codex usage is limited.

Use repository context efficiently.

Do not repeatedly reread:

- historical architecture drafts;
- historical amendments;
- review transcripts;
- previously superseded implementation plans;
- unrelated project files.

Prefer:

- root AGENTS.md;
- current task prompt;
- relevant frozen-document sections;
- relevant migrations/modules/tests;
- current Git diff.

Do not restate large frozen documents in task output.

Do not produce long design explanations unless required to resolve an
implementation issue.

Completion reports should remain concise.

If task context becomes large, retain only information necessary to continue the
approved implementation sequence.

---

# 9. Task Scope Discipline

Only change files necessary for the current approved task.

Do not opportunistically implement future tasks.

Do not "get ahead."

If later-task support is structurally unavoidable, distinguish:

STRUCTURAL_CURRENT_TASK

from:

LATER_BEHAVIOR

Only current-task structural support may land.

Do not perform unrelated refactors.

Do not rename/reorganize large areas merely for style.

Do not upgrade dependencies unless required for the current frozen contract.

If unrelated existing problems are discovered:

- fix only if they block the current task;
- otherwise report them.

---

# 10. Database Migration Discipline

Migrations are contract-bearing.

For every migration:

- deterministic migration order;
- correct FK dependency order;
- explicit constraints;
- explicit indexes where justified;
- clean reset support;
- private-schema posture;
- RLS/grants where owned by the task;
- no speculative infrastructure.

Prefer forward migrations once task history is accepted.

Do not rewrite earlier accepted migration history unless explicitly instructed.

Do not broaden database contracts merely because application-side validation
would be easier.

---

# 11. SQL Rules

Prefer:

- explicit schemas;
- fully-qualified relations where security matters;
- deterministic ordering;
- narrow functions;
- named constraints where useful;
- bounded candidate sets;
- explicit state checks;
- direct SQL tests.

Avoid:

- dynamic SQL;
- opaque generic frameworks;
- giant untestable search SQL;
- unnecessary stored-procedure abstraction;
- unbounded fuzzy/edit-distance scans.

Search implementation must preserve independently diagnosable stages.

Semantic candidates must never bypass eligibility.

Merged, out-of-scope, closed, cancelled, expired, stale, or otherwise ineligible
entities must not re-enter results through weaker candidate paths.

Final canonical result IDs must be unique.

---

# 12. Security Rules

Never:

- commit secrets;
- print secrets;
- place backend Supabase secrets in Expo;
- place embedding-provider keys in Expo;
- expose private app tables to anon/authenticated users;
- weaken SECURITY DEFINER controls for convenience;
- grant PUBLIC execution accidentally;
- use unsafe dynamic SQL;
- leak source credentials into logs;
- include service-role credentials in client configuration.

Where SECURITY DEFINER is required:

- use the exact approved owner model;
- revoke default PUBLIC execution;
- grant only intended backend/API role;
- control/fix search_path;
- schema-qualify relations/operators;
- avoid dynamic SQL;
- validate arguments.

Security tests are part of task completion when the task touches permissions.

---

# 13. Data / Source Rules

Do not fabricate:

- Places;
- Events;
- taxonomy memberships;
- source licences;
- source identifiers;
- source facts;
- scarcity evidence.

Do not stretch adjacent categories to reach the 5–10 target.

When legitimate supply is below target, use the approved:

SUPPLY_CONSTRAINED

behavior after the frozen stopping conditions are satisfied.

If source legal/access/persistence terms are unresolved:

stop only that source workstream and return:

SOURCE_POLICY_BLOCKED

or:

REFERENCE_DATA_BLOCKED

as appropriate.

Do not bypass:

- authentication;
- paywalls;
- CAPTCHA;
- robots/access controls;
- explicit source restrictions.

---

# 14. Human Judgment Boundary

Codex may automate deterministic transformations and prepare evidence.

Codex must not make final human decisions for:

- source legality;
- unclear persistence/licence terms;
- ambiguous duplicate identity;
- manual SAME/SEPARATE judgments;
- unsupported taxonomy truth;
- subjective Swedish-language quality;
- relevance judgments;
- ambiguous Event factual correctness;
- secret/access approval.

When human judgment is required:

report the exact decision and evidence needed.

Continue only safe independent work.

---

# 15. Evaluation Discipline

The frozen evaluation corpus contains:

- 60 DEV
- 30 SEALED
- 20 adversarial
- 110 total

Exact family allocation from the Final Technical Specification must remain
unchanged.

Semantic allocation remains:

- 16 DEV
- 8 SEALED
- 6 adversarial

At least:

- 12 paired EN/SV semantic intents = 24 queries;
- 6 mixed/adversarial semantic queries.

Translation pairs remain in the same split.

Before every tuning pass:

- freeze dataset manifest version;
- freeze judgment version.

After results are inspected:

do not silently mutate that judgment version.

Material inventory changes create a new explicit version.

Before full Day-3 DEV tuning:

all 60 DEV judgments used must be frozen.

SEALED remains inaccessible until candidate/config freeze.

Do not tune against SEALED.

Adversarial is post-freeze acceptance, not an unlimited tuning pool.

---

# 16. Testing Discipline

A task is not complete because code compiles.

Behavioral contracts require behavioral tests.

Relevant high-risk test families include:

## Source evidence

- same H with A1 fail and A2 success;
- same H with A1 success and A2 success;
- failed newer parse preserves last-good current evidence;
- current source evidence independent from canonical truth;
- stale H+A pair rejected;
- CAS prevents stale overwrite.

## Duplicate resolution

- stale evidence requires OPEN_REVIEW;
- SAME Type A;
- SAME Type B;
- SEPARATE;
- UNSURE;
- reversal;
- stale supersession;
- concurrency.

## Exact search

- canonical exact;
- legitimate same-name entities;
- verified alias exact;
- alias collision;
- canonical-name conflict;
- accentless ordinary evidence;
- prefix ordinary evidence;
- ineligible exact excluded.

## Events

- half-open left/right boundaries;
- point Event;
- expired Event;
- cancelled Event;
- stale Event;
- DELTA absence not disappearance;
- source outage not cancellation.

## Embeddings

- READY;
- FAILED;
- retry new row/attempt_key;
- READY → STALE;
- stale excluded;
- wrong dimension;
- model/document incompatibility;
- provider failure fallback.

## Non-collapse

- subtype concentration;
- explicit chain concentration;
- Event-venue concentration;
- known-item unaffected;
- narrow taxonomy unaffected;
- clearly weaker candidate not promoted;
- unique canonical output.

## Security

- no-key/private access denied;
- publishable/anon/auth direct access denied where frozen;
- Edge/API role succeeds;
- private schema denied;
- no secret exposure.

---

# 17. Standard Verification

Run only commands relevant to the current task plus required regression.

Common project checks:

pnpm typecheck
pnpm lint
pnpm test

Database tasks commonly require:

pnpm db:reset

and relevant suites:

pnpm test:db -- <suite>

When applicable also verify:

- prior DB task suites remain green;
- Supabase DB lint over owned schemas with warnings as failures;
- complete Supabase stack startup;
- expected Data API/OpenAPI exposure;
- secret/config scan.

Do not run expensive irrelevant commands merely for ceremony.

But never skip a frozen task Definition of Done.

---

# 18. Git / Task Commit Discipline

Each approved implementation task is its own Git unit from DB-02 onward.

Previously accepted combined history does not need rewriting.

After completing a task:

1. Run all required tests/regressions.
2. Inspect:
   - git status --short
   - git diff
   - staged diff before commit.
3. Verify:
   - no unrelated files;
   - no secrets;
   - no later-task implementation;
   - no accidental architecture/spec change.
4. Stage only current-task files.
5. If all required checks PASS and:
   - SPEC_CHANGE_REQUIRED = NONE;
   - no task-blocking SOURCE_POLICY_BLOCKED;
   - no task-blocking REFERENCE_DATA_BLOCKED;
   then commit automatically.
6. Use the task's recommended commit message when provided.
7. Otherwise use a concise conventional commit describing the task.
8. Do not include unrelated/pre-existing dirty files.
9. Do not amend/squash/rebase/rewrite earlier accepted task history unless
   explicitly instructed.
10. If unrelated dirty files prevent safe isolation:
    - leave them untouched;
    - commit only safely isolatable task files;
    - report the boundary issue.
11. If any required test fails:
    - do not commit.
12. If SPEC_CHANGE_REQUIRED is raised:
    - do not commit incomplete speculative fixes.

After commit, report:

- commit hash;
- commit message;
- git status --short.

Do not begin the next task automatically.

---

# 19. Commit Message Style

Prefer concise conventional commits.

Examples:

chore(boot): establish repository foundation

feat(db): implement DB-01A source evidence foundation

feat(db): implement DB-01B canonical domain taxonomy schema

feat(db): implement DB-01C search projection configuration schema

feat(db): implement DB-02 source-current evidence transactions

feat(ref): seed active taxonomy and Jonkoping scope

feat(ingest): implement ingestion orchestration

feat(search): implement deterministic known-item retrieval

feat(search): implement hybrid candidate fusion

feat(security): enforce search API trust boundary

Use the task-specific recommended message if supplied.

---

# 20. Failure / Escalation Formats

## SPEC_CHANGE_REQUIRED

Use only for genuine frozen-contract conflict/impossibility.

Return:

# SPEC_CHANGE_REQUIRED

Task:
Frozen contract:
Implementation evidence:
Why contract cannot be satisfied:
Smallest required decision:
Safe work completed:

Do not silently modify the contract.

---

## SOURCE_POLICY_BLOCKED

Use when a source cannot safely proceed because access/licence/persistence policy
is unresolved.

Return:

# SOURCE_POLICY_BLOCKED

Source:
Intended use:
Unresolved policy:
Work stopped:
Safe independent work:

Do not ingest questionable source content.

---

## REFERENCE_DATA_BLOCKED

Use only when required reference TRUTH or an authoritative/legally usable
reference SOURCE cannot be established.

Missing generated repository artifacts are not automatically blockers when the
current approved task owns their creation.

Examples that are NOT blockers by themselves:

- missing seed YAML/JSON;
- missing stable UUID values not frozen elsewhere;
- missing checksum files;
- missing downloaded GeoJSON when the task owns acquisition;
- missing generated metadata files.

Examples that ARE blockers:

- frozen taxonomy semantics are absent/contradictory;
- required source authority cannot be determined;
- source terms do not permit required use;
- authoritative boundary cannot be obtained/validated;
- human-owned factual/localization decision is genuinely required before safe
  activation.

Never fabricate reference truth to avoid a blocker.

---

## TUNABLE_DECISION

Use when an implementation-owned tunable is reached.

Return briefly:

# TUNABLE_DECISION

Tunable:
Initial/default value:
Allowed semantics:
Evidence required:
DEV experiment:
Rollback/default:

Do not block implementation if the Final Implementation Plan allows the tunable
to remain provisional.

---

# 21. Schedule-Slip Rules

If execution falls behind, cut optional scope before frozen requirements.

Safe cuts include:

1. additional source adapters;
2. optional enrichment;
3. extra Event sources;
4. advanced opening-hours sophistication;
5. optional contact enrichment;
6. extra taxonomy alias refinement;
7. optional date expressions beyond required parser scope;
8. optional Levenshtein;
9. extra embedding-model experiments;
10. advanced breaker behavior;
11. UI polish;
12. richer diagnostic presentation.

Never independently cut:

- source/version/ParseAttempt semantics;
- source-current/canonical-current separation;
- legitimate real inventory;
- municipality/taxonomy truth;
- targeted provenance;
- conservative dedupe;
- deterministic search;
- required semantic search and fail-open;
- protected exact;
- fixed/simple RRF;
- broad non-collapse;
- bounded real Events/time;
- EN/SV behavior;
- evaluation;
- security;
- deployment;
- required submission artifacts.

If a required item appears impossible within schedule:

report the risk.

Do not silently remove it.

---

# 22. Task Completion Criteria

A task is complete only when:

- requested implementation exists;
- dependencies were satisfied;
- required tests pass;
- required regression passes;
- frozen invariants hold;
- scope audit passes;
- no unrelated refactor leaked in;
- no later-task work leaked in;
- no architecture/spec change occurred;
- security/privacy posture remains valid;
- repository remains runnable;
- successful task is committed cleanly.

"Build passes" is not sufficient.

---

# 23. Standard Completion Report

Keep completion reports concise.

Return:

## Task Completed

<Task ID — title>

## Files changed

Only task-owned files.

## Implementation summary

Short factual summary.

## Tests

- suites;
- assertion/test count where useful;
- PASS/FAIL.

## Verification

Commands + outcomes.

## Frozen-contract verification

Important task invariants:

- invariant — PASS/FAIL
- invariant — PASS/FAIL

## Scope audit

Explicitly confirm forbidden/later-task work was not introduced.

## Unexpected issues

Only material task-related issues.

## SOURCE_POLICY_BLOCKED

NONE unless applicable.

## REFERENCE_DATA_BLOCKED

NONE unless applicable.

## SPEC_CHANGE_REQUIRED

NONE unless applicable.

## Commit

- hash:
- message:

## Working-tree status

Output/summary of:

git status --short

## Next approved task

Name only.

Do not begin it.

---

# 24. Diff Review Before Commit

Before every automatic task commit, verify:

- only expected files changed;
- no secret files staged;
- no `.env` values staged;
- no temporary debugging artifacts;
- no generated junk;
- no test fixtures containing credentials;
- no accidental dependency upgrades;
- no historical frozen docs edited;
- no later-task implementation;
- no unrelated refactor;
- no new infrastructure;
- no hidden architecture change.

If any are present:

fix or unstage before committing.

---

# 25. Current Approved Task Queue

The authoritative dependency order comes from Final Implementation Plan v1.0.

Approximate queue:

## Day 1

BOOT-01
DB-01A
DB-01B
DB-01C
DB-02
REF-01
EVAL-01
ING-01
SRC-01
SEARCH-01
SEC-01
EDGE-01
MOB-01

## Day 2

SRC-02
DEDUP-01
PROV-01
TAX-01
DOC-01
SEARCH-02
DIAG-01
MOB-02
TIME-01
SRC-03A
EMBED-01A
EVAL-02

## Day 3

SRC-03B
EVENT-01
EMBED-01B
SEM-01
RANK-01
NONCOLLAPSE-01
MOB-03
EVAL-03

## Day 4

COVERAGE-01
QA-01
PERF-01
EVAL-04
DEPLOY-01
DOCS-01

Final Implementation Plan dependencies override this simple listing.

Never start a task whose dependencies are incomplete.

---

# Task Status

Do not maintain completed-task state in AGENTS.md.

The current approved task is supplied explicitly by the task prompt.

Git history plus accepted completion reports are authoritative for completed work.

Never infer that a task should be rerun merely because it is not listed here.

Never begin the next task automatically.

---

# 26. Final Rule

When forced to choose between:

- another abstraction;
- more infrastructure;
- generalized future support;

and:

- legitimate inventory;
- correctness;
- EN/SV search quality;
- evaluation;
- debugging;
- deployment;

choose the latter.

The purpose of this repository is to ship the approved Lemon Going-Out Search
vertical slice correctly within four days.

Implement the frozen system.

Do not redesign it.
