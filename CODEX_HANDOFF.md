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

Final search paths:

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

Deterministic search must always work even if the embedding provider or semantic
path fails.

---

# 3. Current milestone

DAY 1: COMPLETE

DAY 2: COMPLETE

DAY 3 EVENT BRANCH:
COMPLETE THROUGH EVENT-01

Completed Day-3 Event branch:

SRC-03B
→ EVENT-01

Current next task:

EMBED-01B — selected multilingual embedding generation

Then:

EMBED-01B
→ SEM-01

Once semantic branch is complete:

EVENT-01 + SEM-01
→ RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

RANK-01 final completion requires both:

EVENT-01
+
SEM-01

Do NOT automatically begin later packages.

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

SRC-03B
`22f9fc1`
feat(events): add bounded municipal ingestion

EVENT-01
`80715b9`
feat(search): add event time retrieval

Current working tree after EVENT-01 provenance audit:

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

`OPEN_REVIEW`

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

Manual/human Event status resolution must still pin exact supporting H+A.

Do not falsely record a human interpretation as SOURCE_FACT.

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

Membership methods include:

- evidence-backed deterministic source mapping
- SOURCE_FACT
- controlled manual paths according to TAX-01

Do not stretch taxonomy to hit quotas.

Coverage must remain truthful.

Unsupported scarcity claims are prohibited.

---

# 10. Search status after EVENT-01

Implemented deterministic retrieval:

- authoritative eligibility
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
- deterministic EN/SV time parsing
- Event/time eligibility
- Event horizon filtering
- Event critical-fact freshness
- Event candidate retrieval
- linked/standalone Event venue support
- Event expiry predicate
- restricted diagnostics

Not yet implemented:

- semantic retrieval
- RRF
- broad-discovery non-collapse

Exact protection:

1. eligible accent-preserving canonical exact → protected
2. qualifying verified alias exact → protected only when unambiguous and not
   colliding with active eligible canonical name
3. accentless exact → ordinary
4. prefix → ordinary
5. discovery → ordinary

Eligibility is applied before every retriever/protection decision.

Event eligibility is also authoritative before Event candidate participation.

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

Invalidation exists for relevant:

- canonical changes
- provenance changes
- taxonomy changes
- withheld/merged state
- document replacement

Event SearchDocuments now support factual Event context including:

- Event title
- factual taxonomy
- linked Place venue context when deterministic
- standalone venue/location context

Do not put unsupported editorial text into embedding/search documents.

Do not generate a second embedding-specific representation.

Use existing `embedding_text`.

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

Schedule changes preserve source identity.

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

# 14. Human Event-status decision

The municipality source does NOT expose a reliable literal status field.

Engineer-approved bounded trial interpretation:

A concrete source occurrence may become canonical:

`SCHEDULED`

when all are true:

1. official Jönköping Event Calendar currently emits it;
2. it is an accepted single-occurrence record;
3. it has an explicit future start time;
4. it has sufficient venue/location evidence;
5. there is no explicit cancellation/postponement indication.

This is NOT a literal source `status=SCHEDULED` fact.

SRC-03B implements this as MANUAL provenance with exact supporting H+A evidence.

Cancellation requires explicit evidence.

Never infer:

- CANCELLED
- COMPLETED
- POSTPONED

from:

- disappearance
- DELTA absence
- timeout
- source outage
- partial response

This decision is already accepted.

Do not reopen it during later packages.

---

# 15. SRC-03B accepted Event ingestion state

Commit:

`22f9fc1`

Source:

`JONKOPING_EVENT_CALENDAR`

SRC-03B established:

bounded Event source
→ immutable source evidence
→ selected H+A
→ CanonicalEntity EVENT
→ Event
→ provenance
→ taxonomy
→ publication

SRC-03B completion run reported:

- 18 source records fetched/run;
- 4 invalid retained visibly;
- 2 canonical Events published;
- 2 accepted single-occurrence;
- 2 multi-occurrence skipped;
- 0 identity-ambiguous;
- live venue mode: 0 linked / 2 standalone;
- status = SCHEDULED;
- status provenance = MANUAL + exact H+A;
- rerun idempotent;
- zero duplicate entities/events/documents.

Stable Event identity survives schedule updates.

Prior provenance history is retained.

Cancellation remains explicit-evidence only.

Refresh mode remains:

`DELTA_ONLY`

---

# 16. Current Event inventory after reconstruction

EVENT-01 reconstruction legitimately changed the live DELTA inventory.

Provenance audit classification:

`LEGITIMATE_RECONSTRUCTION_CHANGE`

This was NOT:

- fixture contamination;
- EVENT-01 source acquisition expansion;
- EVENT-01 canonicalization expansion.

Existing accepted SRC-03B behavior was rerun and the public DELTA source had
changed.

Current legitimate source-backed canonical Events:

1. `ac712ce7-982e-46d7-b99e-a1f72acbff76`
   - title: Grenna Bluegrass Festival
   - external key:
     `event/ceca15b4-8ecb-4e90-81f1-a35a6c6269fc`
   - SearchDocument:
     `4ddca9fb-a343-481b-a97d-c53710668588`
   - SearchDocument status: ACTIVE

2. `b1dc351c-0321-4764-9f12-122d69bf0848`
   - title: Jönköpings Kanotklubb 90 år
   - external key:
     `event/f2f70042-e9b2-478b-8a48-201376fb693d`
   - SearchDocument:
     `e93bb0bd-b2bd-4cf7-8d76-4fd8d84e09f7`
   - SearchDocument status: ACTIVE

3. `192c5ebb-0cb2-476b-b8ab-69216fb027b3`
   - title: Grenna Bluegrassfestival
   - external key:
     `event/f630fa46-e3bf-4c35-9a60-22553ffbc219`
   - SearchDocument:
     `1c21b8b6-837b-4015-8c45-90e78e897751`
   - SearchDocument status: ACTIVE

All three:

- originate from `JONKOPING_EVENT_CALENDAR`;
- are legitimate source-backed inventory;
- have exact valid selected H+A;
- are not fixture-only entities;
- were created through existing `jonkoping-event-v1` /
  `jonkoping-event-parser-v1` behavior.

Current active Event SearchDocuments:

3

Important:

The overall active SearchDocument corpus must be discovered mechanically by
EMBED-01B.

Do NOT assume total corpus size from this handoff.

---

# 17. EVENT-01 accepted behavior

Commit:

`80715b9`

EVENT-01 implements Event retrieval/time eligibility.

Real inspected Events:

3 / 3 eligible at completion.

All were:

- EVENT
- PUBLISHED
- SCHEDULED
- fresh
- in-scope
- within applicable horizon
- valid standalone venue/location

Live venue mode:

0 linked
/
3 standalone

Linked Place Event behavior is fixture-tested.

## Event horizon

30 days.

Exclusive start boundary:

starts_at < horizon_end

Event starting exactly at horizon_end is excluded.

## Source freshness

Initial accepted Jönköping Event freshness tolerance:

48 hours

Freshness is based on current critical provenance + SourceRecord observations.

Do NOT substitute:

Source.last_successful_refresh

for per-Event critical fact freshness.

Critical freshness uses the conservative minimum of applicable:

- event_start evidence observation
- event_end evidence observation when present
- event_status evidence observation

A successful DELTA source run does NOT refresh an absent Event's evidence.

## Event status eligibility

Searchable:

SCHEDULED only

Excluded:

- CANCELLED
- POSTPONED
- COMPLETED
- UNKNOWN

Explicit cancellation becomes immediately ineligible.

DELTA absence never changes Event status.

## Known-end interval

Query interval is half-open:

[query_start, query_end)

Known-end Event overlaps iff:

starts_at < query_end
AND
ends_at > query_start

Current/upcoming iff:

ends_at > now
AND
starts_at < horizon_end

Equality rules:

ends_at = query_start
→ no overlap

starts_at = query_end
→ no overlap

ends_at = now
→ expired/ineligible

## Point Event

If:

ends_at IS NULL

query match iff:

query_start <= starts_at
AND
starts_at < query_end

Current/upcoming iff:

starts_at >= now
AND
starts_at < horizon_end

Equality:

starts_at = query_start
→ match

starts_at = query_end
→ no match

starts_at = now
→ current

starts_at < now
→ expired

Never invent duration.

---

# 18. Event candidates / expiry / diagnostics

EVENT-01 added explicit:

`event_candidates`

Properties:

- authoritative Event eligibility first;
- bounded;
- deterministic;
- CanonicalEntity ID unique in union;
- supports title evidence;
- factual venue evidence;
- taxonomy/category evidence;
- deterministic time evidence;
- time-only Event discovery;
- no RRF;
- no semantic ranking;
- no popularity score.

Event candidates participate in the existing canonical union.

## Expiry

Command:

`pnpm expire:events`

Search-time expiry is authoritative even if the command is delayed.

Known-end:

ends_at <= now
→ expired

Point:

starts_at < now
→ expired

Expiry command:

- uses same predicate as search;
- withholds expired publication;
- preserves canonical Event;
- preserves source-backed/manual status;
- preserves provenance/history;
- is idempotent.

Expired Events are absent from search BEFORE the command runs.

Do NOT infer COMPLETED solely from time passage.

## Diagnostics

Restricted diagnostics now expose bounded Event information including:

- status eligibility
- start/end
- point/known-end mode
- query interval
- interval match
- horizon eligibility
- schedule freshness
- status freshness
- effective freshness
- freshness tolerance
- scope/taxonomy/radius eligibility
- venue mode
- event_candidates presence/rank
- candidate-union presence

Do not expose internal Event diagnostics publicly.

---

# 19. Time parser

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

EVENT-01 wires TIME-01 through:

Edge
→ one `api.search_v1` RPC

Recognized ambiguous time remains safe 422.

Do not replace with LLM time parsing.

---

# 20. Embedding lifecycle / preflight

EMBED-01A accepted.

Commit:

`779cef6`

Provider:

Voyage

Validated model:

`voyage-4`

Validated dimension:

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

READY:
- valid compatible vector only;
- exact SearchDocument/hash pinned;
- provider/model/config/dimension pinned;
- finite;
- non-zero;
- generated_at present.

FAILED:
- terminal immutable;
- vector NULL;
- generated_at NULL;
- safe error identity retained.

FAILED → READY:
rejected

FAILED → STALE:
rejected

Retry:
new attempt identity

READY → STALE:
allowed

STALE:
- original vector retained;
- generated_at retained;
- history retained;
- no longer retrievable.

SearchDocument replacement stales old compatible READY embeddings.

No ANN.

---

# 21. Selected embedding contract for EMBED-01B

The engineer has completed the bounded human model-selection decision.

Final four-day trial embedding contract:

provider:

Voyage

model:

`voyage-4`

dimension:

1024

document input type:

`document`

query input type:

`query`

This is the ONE selected semantic contract for the trial.

Rationale:

- primary frozen architecture candidate;
- EMBED-01A real provider smoke passed;
- document embedding passed;
- query embedding passed;
- requested/returned 1024 dimensions passed;
- vectors finite/non-zero;
- lifecycle compatibility exists;
- no evidence justifies spending constrained trial time on a broad
  multi-provider bake-off.

Do NOT compare more providers during EMBED-01B unless this selected contract
fails a mandatory correctness/compatibility gate.

Do NOT silently switch model/provider.

If selected provider/model contract is no longer usable:

`EMBED_PROVIDER_CONTRACT_BLOCKED`

or:

`MODEL_SELECTION_REOPEN_REQUIRED`

as applicable.

---

# 22. Current next task: EMBED-01B

Objective:

generate compatible selected-model vectors for the CURRENT active eligible
SearchDocument corpus.

Expected path:

active eligible SearchDocument
→ deterministic `embedding_text`
→ bounded offline Voyage request
→ response validation
→ READY or explicit FAILED attempt

Selected contract:

Voyage
/
voyage-4
/
1024 dimensions
/
document input type

EMBED-01B must mechanically discover:

- active Place SearchDocuments;
- active Event SearchDocuments;
- total active eligible documents;
- existing compatible READY;
- FAILED;
- STALE;
- missing compatible embeddings.

Current Event subset contains 3 legitimate active Event SearchDocuments.

Do not hardcode overall corpus count.

Required EMBED-01B properties:

- deterministic batching/order;
- bounded provider calls;
- partial success preservation;
- retry with new attempt identity;
- rerun skips compatible READY;
- no duplicate compatible READY;
- in-flight SearchDocument hash change cannot attach wrong vector;
- contract/hash change stales old READY;
- exact selected contract compatibility;
- state/coverage report;
- no raw vectors in logs;
- API key never logged;
- no ANN.

EMBED-01B does NOT implement:

- production query embedding
- shouldEmbed
- semantic_candidates
- cosine retrieval
- semantic fail-open
- RRF
- non-collapse

Those belong to SEM-01 or later.

Expected commit:

`feat(embedding): generate selected model vectors`

Stop after EMBED-01B.

---

# 23. Evaluation state

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

Judgment checksum prefix/suffix:

`0b4df5f2…b83f`

Judgments:

84 total

- grade 0: 60
- grade 1: 15
- grade 2: 6
- grade 3: 3

14 DEV queries evaluated.

Baseline:

- 6 inventory-unavailable known-item queries;
- Hit@1: NOT_EVALUATED for absent intended targets;
- Hit@3: NOT_EVALUATED;
- MRR: NOT_EVALUATED;
- Recall@20: 0.2333;
- Recall@50: NOT_REQUIRED;
- Precision@5: 0.1600;
- NDCG@5: 0.2832;
- EN P@5: 0.1000;
- SV P@5: 0.2000;
- EN NDCG@5: 0.2080;
- SV NDCG@5: 0.3333;
- zero-result: 12/14 = 85.71%;
- failure attribution:
  - INVENTORY 6
  - CANDIDATE_RETRIEVAL 4

Rerun:

byte-identical

Report content checksum:

`bae1ad69…34f7`

This is the PRE-DAY-3 baseline.

Do NOT tune against SEALED.

Do not rewrite inspected judgment versions.

---

# 24. Inventory / evaluation interpretation

The deterministic Day-2 evaluation reconstruction contained:

6 published entities
6 active SearchDocuments

That was a snapshot, not intended final Jönköping coverage.

Later legitimate source reconstruction/acquisition may change inventory.

Current Event branch alone now has:

3 legitimate active Event SearchDocuments.

Do not infer the current overall active SearchDocument count from the old
Day-2 snapshot.

EMBED-01B must discover it mechanically.

Important evaluation distinction:

user query unsatisfied because intended real entity is absent
→ END-TO-END PRODUCT FAILURE

but engineering attribution:

→ INVENTORY

not automatically:

→ RANKING

Do not hand-insert frozen DEV target entities merely to improve metrics.

Legitimate source acquisition may naturally bring them into inventory.

Never inspect SEALED targets to drive acquisition.

---

# 25. Remaining Day-3 sequence

Completed:

SRC-03B
→ EVENT-01

Current:

EMBED-01B

Then:

EMBED-01B
→ SEM-01

After both branches:

EVENT-01
+
SEM-01
→ RANK-01

Then:

RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

## SEM-01

Will own:

- deterministic shouldEmbed;
- query-time Voyage embedding;
- exact compatible READY vector universe;
- exact cosine scan;
- `semantic_candidates`;
- safe timeout/failure behavior;
- deterministic fallback;
- `semanticDegraded`;
- no LLM router/rewriter/reranker.

## RANK-01

Will own:

- fixed/simple RRF;
- protected exact preservation;
- canonical exactly-once;
- deterministic ties;
- integration of lexical/taxonomy/Event/semantic stages.

No learned fusion.

## NONCOLLAPSE-01

Will own:

- broad-discovery only;
- post-ranking deterministic concentration reduction;
- relevance primary;
- no weak-result promotion;
- no effect on known-item/narrow taxonomy queries.

## MOB-03

Will own:

- Event cards/time presentation;
- semantic/degraded UX;
- EN/SV presentation;
- no client reranking/provider calls.

## EVAL-03

Will own:

- full 60 DEV pass;
- bounded tuning;
- reasoned candidate configs;
- final DEV freeze;
- no SEALED access.

---

# 26. Security / public-path invariants

Production search path remains:

Mobile
→ Edge
→ one `api.search_v1`
→ private PostgreSQL internals

Mobile never gets:

- DB/service credentials
- Voyage key
- direct RPC access
- private diagnostics

Edge holds required server-side secrets.

Restricted diagnostics remain restricted.

Embedding provider credentials must never enter:

- mobile bundle
- public response
- DB payload
- logs
- committed files

---

# 27. Usage / execution discipline

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

Prefer fresh Codex threads at major branch/package boundaries.

Current semantic branch:

EMBED-01B
→ SEM-01

may stay in one fresh thread because the packages are tightly coupled.

Start another fresh thread before RANK-01 if usage/context size warrants it.

---

# 28. Model guidance

Bounded/mechanical mobile/docs:

Medium

Normal source adapters/time/provider:

Sol Medium

Contract-sensitive Event/search/provenance/semantic:

Sol High

Use strongest reasoning when justified, especially:

- DEDUP
- RANK
- NONCOLLAPSE
- final evaluation

Current EMBED-01B recommendation:

GPT-5.6 Sol
High reasoning

SEM-01 recommendation:

GPT-5.6 Sol
High reasoning

RANK-01:

High / strongest justified reasoning

NONCOLLAPSE-01:

High / strongest justified reasoning

---

# 29. Current fresh-thread startup

For the next fresh Codex session:

1. read `AGENTS.md`;
2. read this `CODEX_HANDOFF.md`;
3. inspect Git status/history only as needed;
4. search only EMBED-01B-relevant frozen sections;
5. use the explicit EMBED-01B package prompt;
6. do not reread all accepted history;
7. do not begin SEM-01 automatically.

Current task:

`EMBED-01B`

Current accepted HEAD must contain at least:

`80715b9 — feat(search): add event time retrieval`

plus any later docs-only handoff commit.

Working tree should be clean before implementation.

---

# 30. Completion-report format

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

For EMBED-01B specifically prefer:

Task:
Commit:
Selected contract:
Active corpus Place/Event/total:
Real documents attempted:
Compatible READY:
FAILED:
STALE:
Coverage:
Dimension/finite/non-zero:
Document hash compatibility:
Partial-run recovery:
Rerun idempotency:
Contract-change stale:
Event document coverage:
No ANN:
Provider/key safety:
Tests:
Scope audit:
Working tree:
Next task: SEM-01

Do not automatically begin the next task.