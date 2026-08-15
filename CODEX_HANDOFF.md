# Lemon Going-Out Search — Codex Handoff

Last updated: 2026-08-15

This file is durable implementation context for fresh Codex sessions.

Do NOT treat this file as a replacement for the frozen sources of truth.
For normative behavior use the frozen hierarchy below.

---

# 1. Frozen sources of truth

Authority order:

1. `docs/requirements/Requirements_Baseline_v1_1.md`
2. `docs/architecture/Final_Architecture_v1_0.md`
3. `docs/specification/Final_Technical_Specification_v1_0.md`
4. `docs/implementation/Final_Implementation_Plan_v1_0.md`

Manifest:

`docs/FROZEN_SOURCES.md`

True conflict:

`SPEC_CHANGE_REQUIRED`

Do not rewrite frozen documents.

Do not reread all frozen documents for every task.
Search only task-relevant sections.

Git history + explicit task prompt are authoritative for accepted implementation
state.

`CODEX_START_HERE.md` is intentionally deprecated/deleted.
Do not recreate it.

---

# 2. Product / trial scope

Build a production-quality four-day vertical slice for:

Jönköping municipality, Sweden

Stack:

Expo / React Native
→ Supabase Edge Function
→ one public PostgreSQL search RPC
→ PostgreSQL / PostGIS / pgvector

Postgres is the single canonical/search datastore.

No:

- Elasticsearch
- Redis search
- ANN index
- request-time scraping
- secondary search datastore
- LLM reranker
- learned ranking

Search paths eventually include:

- protected canonical exact
- qualified verified alias exact
- accentless exact
- prefix
- trigram
- FTS
- taxonomy
- Event/time
- semantic exact-pgvector
- fixed/simple RRF
- bounded broad-discovery non-collapse

Semantic is additive and fail-open.
Deterministic search must always work.

---

# 3. Current milestone

DAY 1: COMPLETE
DAY 2: COMPLETE

Current next task:

SRC-03B — bounded real Event ingestion/canonicalization

Do NOT automatically begin later packages.

After SRC-03B:

EVENT-01

Independent semantic branch:

EMBED-01B
→ SEM-01

RANK-01 final completion requires:

EVENT-01 + SEM-01

Then:

RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

---

# 4. Accepted package commits

Accepted history must not be rewritten.

BOOT-01
`4e5ab768`
chore(boot): establish BOOT-01 repository foundation

DB-01A
`18653d2e`
feat(db): implement DB-01A source evidence foundation

DB-01B
`78861bb5`
historical commit irregularity accepted — do not rewrite

DB-01C
`be0d1096`
historical DB-01B/01C irregularity accepted — do not rewrite

DB-02
`8c5dbe31`
feat(db): implement DB-02 source-current evidence transactions

REF-01
`c5dc7624`
feat(ref): seed active taxonomy and Jonkoping scope

EVAL-01
`3221f3f3`
feat(eval): freeze evaluation corpus scaffold

ING-01
`8ea9b778`
feat(ingest): implement six-stage ingestion core

SRC-01
`18fff86e`
feat(source): add bounded OSM ingestion adapter

DAY1-PUB-01
`1281c14b`
fix(ingest): complete first-place publication bridge

SEARCH-01
`8e1d6c09`
feat(search): implement eligibility and known-item retrieval

SEC-01
`a9cd73b`
feat(security): implement SEC-01 search RPC boundary

EDGE-01
`d0e3f195`
thin fixed Edge → api.search_v1 boundary

MOB-01
`464c3f4d`
minimal Expo search UI

SRC-02
`d29d7a47`
feat(source): add bounded municipal ingestion

DEDUP-01
`65816f0c`
feat(dedup): implement manual duplicate review lifecycle

PROV-01
`743049a`
feat(provenance): implement targeted provenance and compliance redaction

TAX-01
`ec8d719`
feat(taxonomy): implement mappings and truthful coverage

DOC-01
`20916fd`
feat(search): implement deterministic search documents

SEARCH-02
`8bc55b2`
feat(search): add lexical and taxonomy discovery

DIAG-01
`6b1b505`
feat(search): add restricted diagnostics

TIME-01
`7c27d99`
feat(time): implement deterministic bilingual parser

EMBED-01A
`779cef6`
feat(embedding): implement lifecycle and provider preflight

SRC-03A
`205d022`
feat(source): prove event source viability

MOB-02
`4f26f92`
feat(mobile): add bilingual discovery experience

EVAL-02
`4b4a20c`
feat(eval): add deterministic dev runner

Working tree after EVAL-02:

CLEAN

---

# 5. Core source/evidence invariants

Source lineage:

Source
→ SourceRecord
→ immutable SourceRecordVersion
→ ParseAttempt

Current source evidence is the exact pair:

SourceRecordVersion H
+
ParseAttempt A

represented by:

current_version_id
+
current_parse_attempt_id

Rules:

- capture before parse;
- H is immutable;
- parser replay uses same H with new A;
- current H+A changes only through DB-02 contract;
- only successful valid parsing may become selected current evidence;
- newer failed parsing must not destroy last-good source-current evidence;
- source-current evidence is independent of canonical-current truth.

Canonical truth may remain unchanged even when source-current H+A advances.

---

# 6. Identity / dedupe invariants

CanonicalEntity identity is separate from SourceRecord identity.

No heuristic cross-source auto-merge.

Duplicate decisions pin exact H+A evidence.

Any pinned H+A change makes a finalized decision stale and forces:

OPEN_REVIEW

Type A:

SourceRecord → existing CanonicalEntity

Type B:

explicit survivor merge/relink

No fake loser entity for Type A.

---

# 7. Provenance invariants

Targeted canonical facts:

- canonical_name
- location
- address
- opening_hours
- event_start
- event_end
- event_status

Current selected provenance is exact and evidence-backed.

History is retained.

Revocation/redaction must preserve required audit identity while removing
prohibited payload.

Compliance:

`redacted_by = session_user`

Source revocation may rebuild/withhold canonical/search truth according to
accepted PROV-01 behavior.

---

# 8. Geography

Scope:

full Jönköping municipality

Municipality scope ID:

`a4b19b09-b272-5748-80ef-2c91d9d33ca6`

Boundary ID:

`0a39b199-4cd5-5358-85de-2c1a5f91a347`

Boundary version:

`lm-current-2026-08-14`

Boundary checksum:

`257a277667cde164bcb70eae16ca6985578fe34666df92ff289af519a262df1d`

Municipality code:

0680

Timezone:

Europe/Stockholm

Boundary semantics:

PostGIS `ST_Covers`

Do not use city-center approximation.

---

# 9. Taxonomy

Active taxonomy version:

`active-going-out.v1`

52 active nodes.

Checksum:

`ec2d43046a9c1646cecdcc55c4091db31434bb8e78ca1a6483bc475a9a0d88c2`

Only active taxonomy is valid.

No legacy taxonomy.

Membership methods include evidence-backed deterministic source mapping /
SOURCE_FACT / controlled manual paths according to TAX-01.

Do not stretch taxonomy to hit quotas.

Coverage currently remains truthful; unsupported scarcity claims are prohibited.

---

# 10. Search status after Day 2

Implemented deterministic retrieval:

- eligibility
- protected accent-preserving canonical exact
- qualified verified alias exact
- accentless ordinary exact
- prefix
- trigram
- FTS
- taxonomy recognition
- descendant expansion
- category browse
- bilingual lexical behavior
- restricted diagnostics

Not yet implemented:

- Event candidates
- semantic retrieval
- RRF
- non-collapse

Exact protection:

1. eligible accent-preserving canonical exact → protected
2. qualifying verified alias exact → protected only when unambiguous and not
   colliding with active eligible canonical name
3. accentless exact → ordinary
4. prefix → ordinary
5. discovery → ordinary

Eligibility is applied before every retriever/protection decision.

---

# 11. SearchDocuments

Current versions:

document:

`search-document-v1`

template:

`lexical-embedding-template-v1`

SearchDocuments are deterministic, evidence-grounded projections.

Weights:

A:
names / qualifying aliases

B:
strong factual/direct taxonomy

C:
ancestor/context

D:
description

Invalidation already exists for relevant canonical/provenance/taxonomy changes.

Do not put unsupported editorial text into embedding/search documents.

---

# 12. Event source — accepted SRC-03A facts

Selected source:

Jönköping municipality Event Calendar

Source concept:

`JONKOPING_EVENT_CALENDAR`

Acquisition path:

bounded public Sitevision `/search` / Event-calendar structured path

Policy:

`EXTRACTED_FIELDS_ONLY`

Refresh mode:

`DELTA_ONLY`

Absence has NO disappearance/cancellation meaning.

SRC-03A real smoke:

- two bounded runs;
- 6 requests/run;
- 9 hits/run;
- 5 usable single-occurrence Events/run;
- 5/5 stable UUID-derived identities across runs.

Stable logical source Event UUID is exposed.

For accepted records:

occurrence_count == 1

External key:

`event/<source-event-uuid>`

Identity explicitly excludes:

- title
- date
- start time
- end time
- venue
- array index
- hashes
- generated UUID

Schedule changes must preserve source identity.

Multi-occurrence rule:

occurrence_count > 1
→ `UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY`
→ skip

Cardinality change:

1 occurrence
→ N occurrences

becomes:

`IDENTITY_BECAME_AMBIGUOUS`

Do not arbitrarily reinterpret the old Event as one of N occurrences.

The public page-level Sitevision `id` is NOT an occurrence identifier.

The source's form bundle generates random occurrence UUIDs and they are NOT
durable.

---

# 13. Event factual fields permitted

Allowed bounded factual persistence:

- source Event UUID
- stable external key
- title
- explicit start
- explicit end
- venue name
- city/locality
- address
- coordinates
- factual categories
- source URL
- explicit factual status where available
- source observation/update timestamp where available

Excluded:

- long/editorial descriptions
- marketing copy
- images/image content
- applicant/submitter personal data
- organizer personal contacts
- unnecessary personal data

No invented duration.

Missing explicit end:

ends_at = NULL

---

# 14. Human Event-status decision for SRC-03B

The municipality source does NOT expose a reliable literal status field.

Engineer-approved bounded trial interpretation:

A concrete source occurrence may become canonical:

SCHEDULED

when all are true:

1. official Jönköping Event Calendar currently emits it;
2. it is an accepted single-occurrence record;
3. it has an explicit future start time;
4. it has sufficient venue/location evidence;
5. there is no explicit cancellation/postponement indication.

This is NOT a literal source `status=SCHEDULED` fact.

Record provenance using the actual approved manual/human resolution method
available in the frozen provenance model.

Do NOT mislabel this as SOURCE_FACT if the schema distinguishes manual
interpretation.

Cancellation requires explicit evidence.

Never infer CANCELLED/COMPLETED/POSTPONED from:

- disappearance
- DELTA absence
- timeout
- source outage
- partial response

If current provenance schema cannot represent this approved resolution cleanly:

STOP with `SPEC_CHANGE_REQUIRED`.

---

# 15. Event domain invariants

Event is separate from Place.

Event may have:

- deterministic linked Place; OR
- sufficient standalone venue/location.

Do not heuristic-link Place by:

- similar venue name
- proximity
- similar address

Standalone Event venue is valid when sufficient evidence exists.

Later linking to a Place must not change Event identity.

Canonical Event status domain includes frozen lifecycle values.

Only EVENT-01 later decides Event search eligibility/time overlap.

SRC-03B must NOT implement Event search.

Event time intervals are half-open.

Known-end overlap later:

starts_at < query_end
AND
ends_at > query_start

Missing end uses the frozen point-Event semantics owned by EVENT-01.

---

# 16. Time parser

TIME-01 is accepted.

Supports required EN/SV deterministic expressions including:

EN:
- tonight / this evening
- tomorrow
- weekday
- this Friday
- this weekend
- next weekend

SV:
- ikväll
- imorgon
- weekday equivalents
- på fredag
- i helgen
- nästa helg

Timezone:

Europe/Stockholm

Properties:

- injected clock
- half-open intervals
- DST-safe
- 23/25-hour days
- 47/49-hour weekends
- conservative unsupported/ambiguous results
- machine-timezone independent

Do not replace with LLM time parsing.

---

# 17. Embedding preflight

EMBED-01A accepted.

Provider preflight:

Voyage

Candidate model:

`voyage-4`

Requested/validated dimension:

1024

Real document + query embedding smoke:

PASS

Input types:

document → `document`
query → `query`

Lifecycle:

READY
FAILED
STALE

Rules:

- READY only with valid vector
- FAILED terminal immutable
- READY → STALE retains vector/history
- retries use distinct attempt identity
- SearchDocument replacement stales READY embedding
- no ANN

This is PRE-FLIGHT ONLY.

EMBED-01B must later perform bounded final human model selection and active
SearchDocument generation.

Do not begin EMBED-01B during SRC-03B.

---

# 18. Evaluation state

Frozen corpus:

110 total

DEV:
60

SEALED:
30

ADVERSARIAL:
20

Semantic allocation:

DEV 16
SEALED 8
ADVERSARIAL 6

At least 12 EN/SV semantic paired intents.

SEALED must remain unavailable during tuning.

EVAL-02 accepted Day-2 baseline:

Commit:

`4b4a20c`

Dataset manifest:

`dataset-manifest.day2.v1`

Manifest file SHA-256:

`5ade651f358bafed92d51ac5b29651cbea5123958380263633e18385b5d730f0`

Inventory checksum:

`ef89e8fb98246b4418a2094addc861ee5a85e2e842a3409c0e5c761f4ab0a1f2`

Judgment version:

`judgments.day2.v1`

Judgments:

84 total
- grade 0: 60
- grade 1: 15
- grade 2: 6
- grade 3: 3

14 DEV queries evaluated.

Baseline:

- 6 inventory-unavailable known-item queries
- Hit@1/Hit@3/MRR: NOT_EVALUATED for those absent targets
- Recall@20: 0.2333
- Recall@50: NOT_REQUIRED
- Precision@5: 0.1600
- NDCG@5: 0.2832
- EN P@5: 0.1000
- SV P@5: 0.2000
- EN NDCG@5: 0.2080
- SV NDCG@5: 0.3333
- zero-result: 12/14 = 85.71%
- failures: INVENTORY 6; CANDIDATE_RETRIEVAL 4

Rerun deterministic byte-identical.

Report content checksum:

`bae1ad69…34f7`

This is a PRE-DAY-3 baseline.

Do NOT tune against SEALED.

Do not rewrite inspected judgment versions.

---

# 19. Current inventory note

The deterministic Day-2 evaluation reconstruction contained:

6 published entities
6 active SearchDocuments

This is not intended to represent final Jönköping coverage.

Current sparse inventory is explicitly diagnosed by EVAL-02.

Do not hand-insert frozen DEV target entities merely to improve metrics.

Later legitimate source acquisition may naturally bring them into inventory.

Never inspect SEALED targets to drive acquisition.

---

# 20. Next task: SRC-03B

SRC-03B objective:

take the already-proven municipal Event source through the accepted ingestion
and canonicalization contracts.

Expected path:

bounded fetch
→ immutable capture/version
→ ParseAttempt
→ selected source-current H+A
→ deterministic canonical Event resolution
→ targeted provenance
→ taxonomy/location
→ reproducible publication

Real bounded sample should use legitimate upcoming single-occurrence Events.

Run real ingest twice.

Prove:

- stable source keys
- stable Lemon Event IDs
- no duplicate canonical Events
- exact H+A evidence
- factual schedule
- status provenance
- location/venue
- taxonomy
- DELTA_ONLY semantics
- idempotent rerun

Do NOT implement:

- `event_candidates`
- Event search
- expiry search behavior
- semantic retrieval
- RRF
- non-collapse
- MOB-03
- recurrence engine
- second Event source

Expected commit subject:

`feat(events): add bounded municipal ingestion`

Stop after SRC-03B.

---

# 21. Remaining Day-3 sequence

Recommended sequential execution:

SRC-03B
→ EVENT-01

EMBED-01B
→ SEM-01

Then:

EVENT-01 + SEM-01
→ RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

Event and semantic branches are independent until RANK-01.

RANK-01 final DoD requires both branches.

---

# 22. Usage / execution discipline

The user is operating under tight Codex usage limits.

Optimize context and turns.

At each package:

1. use explicit package prompt;
2. read AGENTS.md;
3. use this handoff;
4. inspect Git history only as needed;
5. search task-relevant frozen sections only;
6. preflight internally;
7. implement;
8. run focused tests;
9. run only relevant regression;
10. inspect diff/scope;
11. commit;
12. STOP.

Do not reread all accepted package history.

Do not dump enormous successful test logs.

Do not ask unnecessary questions.

Stop only for:

- genuine external/access blocker;
- missing legal/source truth;
- irreconcilable frozen contract;
- `SPEC_CHANGE_REQUIRED`;
- explicit human decision required by frozen plan.

Missing generated artifacts owned by the current package are normally not
blockers.

Use forward-only fixes.

Do not rewrite accepted commits/history.

One task = one commit for current clean package history.

---

# 23. Model guidance

Bounded/mechanical mobile/docs:
Medium

Normal source adapters/time/provider:
Sol Medium

Contract-sensitive Event/search/provenance/semantic:
Sol High

Use strongest reasoning only when justified, especially:

- DEDUP
- RANK
- NONCOLLAPSE
- final evaluation

Current SRC-03B recommendation:

GPT-5.6 Sol
High reasoning

---

# 24. Completion-report format

Keep successful reports <=20 lines.

Preferred:

Task:
Commit:
Primary result:
Tests:
Frozen invariants:
Scope audit:
Unexpected issues:
Blockers:
Working tree:
Next task:

Do not automatically begin the next task.