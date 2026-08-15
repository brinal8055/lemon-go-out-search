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

Final search stack:

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

Deterministic search must always continue to work if semantic/provider behavior
fails.

---

# 3. Current milestone

DAY 1: COMPLETE

DAY 2: COMPLETE

DAY 3 EVENT BRANCH: COMPLETE

SRC-03B
→ EVENT-01

DAY 3 SEMANTIC BRANCH: COMPLETE

EMBED-01B
→ SEM-01

Both prerequisites for final ranking are now complete:

EVENT-01
+
SEM-01
↓
RANK-01

Current next task:

`RANK-01 — fixed/simple deterministic RRF ranking`

Then:

RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

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

EMBED-01B
`0e39010749d244286900877df745a46123a6e790`
feat(embedding): generate selected model vectors

SEM-01
`febdb189c5a9a36e16a7d30c8fce67f29f586695`
feat(search): add semantic query retrieval

Current working tree after SEM-01:

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

Manual/human Event status resolution pins exact supporting H+A.

Never falsely classify a human/manual canonical interpretation as SOURCE_FACT.

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

- deterministic evidence-backed source mapping
- SOURCE_FACT
- controlled manual paths according to TAX-01

Do not stretch taxonomy to hit supply quotas.

Coverage must remain truthful.

Unsupported scarcity claims are prohibited.

---

# 10. Search status after SEM-01

Implemented:

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
- `event_candidates`
- Event expiry
- linked/standalone Event venue behavior
- selected multilingual document embeddings
- deterministic `shouldEmbed`
- Voyage query embeddings
- exact pgvector cosine retrieval
- `semantic_candidates`
- semantic failure/degradation fallback
- restricted lexical/Event/semantic diagnostics

Not yet implemented:

- final fixed/simple RRF
- broad-discovery non-collapse

Current search architecture therefore has all retrieval stages required by
RANK-01.

---

# 11. Exact protection invariants

Protected:

1. eligible accent-preserving canonical exact;
2. qualifying verified alias exact only when unique among eligible entities and
   not colliding with an eligible canonical name.

Not protected:

- accentless exact
- prefix
- typo
- trigram
- FTS
- taxonomy
- Event evidence
- semantic evidence

Eligibility is applied before every retriever/protection decision.

A protected entity may also appear in ordinary stages but must appear exactly
once in final results.

RANK-01 must preserve protection rather than recreating it.

---

# 12. SearchDocuments

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

Invalidation exists for:

- canonical change
- provenance change
- taxonomy change
- withheld/merged state
- document replacement

Event SearchDocuments support factual:

- Event title
- taxonomy
- linked Place venue context
- standalone venue/location context

Do not create another embedding representation.

Use existing:

`embedding_text`

Do not place unsupported editorial/generated content into SearchDocuments.

---

# 13. Event source contract

Source:

`JONKOPING_EVENT_CALENDAR`

Acquisition:

bounded public Jönköping municipality Event Calendar / Sitevision path

Policy:

`EXTRACTED_FIELDS_ONLY`

Refresh:

`DELTA_ONLY`

Absence has NO disappearance/cancellation meaning.

Stable accepted source identity:

`event/<source-event-uuid>`

Accepted canonicalization is only for:

occurrence_count == 1

Multi-occurrence:

`UNSUPPORTED_MULTI_OCCURRENCE_IDENTITY`

1 → N cardinality change:

`IDENTITY_BECAME_AMBIGUOUS`

Never use as identity:

- title
- date
- start/end
- venue
- array index
- timestamp
- hash
- generated/random UUID

Schedule changes preserve source identity.

---

# 14. Event status decision

The source does not expose a reliable literal SCHEDULED status field.

Accepted bounded canonical interpretation:

SCHEDULED

when all are true:

1. official Event Calendar emits the occurrence;
2. accepted single-occurrence identity;
3. explicit future start;
4. sufficient location/venue evidence;
5. no explicit cancellation/postponement evidence.

Implementation provenance:

`MANUAL`

with exact supporting H+A.

Cancellation requires explicit evidence.

Never infer CANCELLED / COMPLETED / POSTPONED from:

- DELTA absence
- disappearance
- timeout
- 5xx
- partial response
- source outage
- time passage alone

Do not reopen this decision in ranking packages.

---

# 15. SRC-03B accepted state

Commit:

`22f9fc1`

Established:

municipal Event source
→ immutable capture/version
→ ParseAttempt
→ selected H+A
→ CanonicalEntity EVENT
→ Event
→ provenance
→ taxonomy
→ publication/SearchDocument

Original SRC-03B completion snapshot:

- 18 source records fetched/run;
- 4 invalid retained visibly;
- 2 accepted canonical Events;
- 2 multi-occurrence skipped;
- 0 ambiguous;
- live venue mode 0 linked / 2 standalone;
- SCHEDULED with MANUAL H+A provenance;
- rerun idempotent.

That snapshot was not intended to be permanent inventory.

The source is live + DELTA_ONLY.

---

# 16. EVENT-01 accepted state

Commit:

`80715b9`

Implemented:

- Event authoritative eligibility
- 30-day horizon
- 48h Jönköping critical-fact freshness
- exact known-end interval behavior
- exact point-Event behavior
- `event_candidates`
- TIME-01 → Edge → one RPC integration
- Event SearchDocument factual context
- expiry command
- search/expiry predicate agreement
- restricted Event diagnostics

Command:

`pnpm expire:events`

Expiry never invents COMPLETED.

Search-time expiry is authoritative even before offline withholding.

---

# 17. Event interval contract

Query time interval:

`[query_start, query_end)`

Known-end Event overlaps iff:

`starts_at < query_end`
AND
`ends_at > query_start`

Known-end current/upcoming iff:

`ends_at > now`
AND
`starts_at < horizon_end`

Important equalities:

`ends_at = query_start`
→ no match

`starts_at = query_end`
→ no match

`ends_at = now`
→ expired

Point Event:

`ends_at IS NULL`

matches iff:

`query_start <= starts_at`
AND
`starts_at < query_end`

Point Event current/upcoming iff:

`starts_at >= now`
AND
`starts_at < horizon_end`

Never invent Event duration.

---

# 18. Event freshness contract

Initial Event source freshness tolerance:

48 hours

Freshness uses current critical provenance and the supporting SourceRecord
observations.

Conceptually use conservative minimum across applicable:

- event_start observation
- event_end observation if explicit
- event_status observation

Do NOT substitute:

`Source.last_successful_refresh`

for per-Event fact freshness.

Successful DELTA source poll may advance source health.

Absent Event does NOT get its critical last_seen refreshed.

Therefore absence may eventually cause freshness exclusion without implying
cancellation/disappearance.

---

# 19. Time parser

TIME-01 accepted.

Required deterministic expressions include:

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
- conservative unsupported/ambiguous handling
- machine-timezone independent

Ambiguous recognized temporal intent retains safe 422 behavior.

Do not replace TIME-01 with AI parsing.

---

# 20. Local DB recovery history

During EMBED-01B a clean-reset verification accidentally reset the primary local
DB instead of the intended temporary DB.

The first reset used:

`--no-seed`

which removed required reference/source state.

Recovery was intentionally controlled.

Sequence:

1. accidental primary local DB reset;
2. one authorized `pnpm ingest:event` attempt failed before ingestion because
   active scope/source seed state was absent;
3. one explicitly-authorized normal SEEDED local reset;
4. required scope/source/taxonomy reference state restored;
5. one authorized `pnpm ingest:event` reconstruction run;
6. Event corpus reconstructed legitimately;
7. Place corpus was initially absent;
8. narrow reconstruction through existing accepted Place pipeline restored the
   accepted current Place corpus.

No:

- manual canonical insertion
- manual SearchDocument insertion
- manual Event reconstruction
- source broadening
- ingestion logic modification

occurred.

This recovery is accepted local-state restoration and is not an implementation
scope violation.

Do not attempt to recreate historical local UUIDs.

---

# 21. Current reconstructed corpus

At EMBED-01B completion the mechanically discovered active corpus was:

PLACE:
1

EVENT:
3

TOTAL:
4 active SearchDocuments

These counts are a dynamic local reconstructed snapshot.

Do NOT hardcode them into application/search logic.

Historical EVAL-02 inventory counts remain separate immutable evaluation
snapshot data.

Current DB state should always be discovered mechanically when package behavior
depends on corpus contents.

---

# 22. Embedding lifecycle

EMBED-01A commit:

`779cef6`

Lifecycle:

READY
FAILED
STALE

READY requires:

- exact active SearchDocument/hash
- provider/model/config identity
- correct dimension
- finite vector
- non-zero vector
- generated_at populated

FAILED:

- terminal immutable
- vector NULL
- generated_at NULL
- safe bounded error retained

FAILED → READY:
rejected

FAILED → STALE:
rejected

Retry:

new attempt identity / row

READY → STALE:
allowed

STALE retains:

- vector
- generated_at
- historical identity

but becomes incompatible/retrieval-ineligible.

SearchDocument replacement stales old READY compatibility.

No ANN.

---

# 23. EMBED-01B accepted state

Commit:

`0e39010749d244286900877df745a46123a6e790`

Selected contract:

provider:

Voyage

model:

`voyage-4`

revision/config:

`voyage-4-preflight-v1`

dimension:

1024

document input:

`document`

query input:

`query`

EMBED-01B completion corpus:

1 Place
+
3 Events
=
4 documents

First generation outcome:

READY:
3

- 1 Place
- 2 Events

FAILED:
1 Event

Failure:

`RATE_LIMIT / PROVIDER_RATE_LIMIT`

Historical failed attempt:

`b721e3e9-bb58-4313-ba0c-9421d3ed0602`

Coverage at EMBED-01B commit:

75% READY

100% accounted as READY or explicit FAILED.

Other accepted properties:

- dimensions PASS
- finite/non-zero PASS
- document hash compatibility PASS
- partial success retained
- rerun idempotent
- compatible READY skipped
- contract-change stale PASS
- no ANN
- key/raw vectors not logged

---

# 24. Pre-SEM embedding retry

Before SEM-01, exactly one retry of the failed Event embedding was authorized.

Result:

SUCCESS

The original FAILED row remains preserved.

Retry used a new attempt identity.

Current semantic corpus after retry:

compatible READY:
4

historical FAILED:
1

STALE:
0

Do not delete or rewrite the historical failed attempt.

Current active SearchDocuments therefore had compatible READY embeddings for:

1 Place
+
3 Events

during SEM-01.

---

# 25. Selected semantic contract

Selected trial semantic contract:

provider:

Voyage

model:

`voyage-4`

revision/config:

`voyage-4-preflight-v1`

dimension:

1024

document input type:

`document`

query input type:

`query`

Query template:

`semantic-query-template-v1`

Do not switch model/provider during ranking.

Do not run provider bake-offs.

No ANN.

Exact pgvector scan is frozen.

---

# 26. SEM-01 accepted state

Commit:

`febdb189c5a9a36e16a7d30c8fce67f29f586695`

Implemented:

- deterministic EN/SV `shouldEmbed` v1
- query template versioning
- Voyage request-time query embedding
- `input_type=query`
- 1024-dimensional validation
- 700 ms timeout
- minimal Edge-local circuit breaker
- exact pgvector cosine scan
- `semantic_candidates`
- authoritative eligibility reapplied
- protected exact behavior preserved
- deterministic NULL-vector fallback
- public `semanticDegraded`
- restricted semantic diagnostics
- semantic telemetry
- one Edge → one `api.search_v1` RPC

No:

- RRF
- reranker
- non-collapse
- LLM router
- query rewrite
- AI date parsing
- AI taxonomy

---

# 27. shouldEmbed v1

shouldEmbed controls ONLY provider invocation.

It must never suppress deterministic retrieval.

FALSE includes:

- semantic disabled
- circuit open
- normalized query empty
- time-only query
- taxonomy-only recognized intent with accepted generic-noun behavior
- conservative short name-shaped known-item query
- other accepted wholly-known-item cases

TRUE includes:

- broad discovery language
- occasion/natural-language intent
- mixed constraints
- uncertain multi-token NL
- broad NL + recognized time

A false negative only loses semantic evidence.

It can never remove deterministic exact/alias/prefix/trigram/FTS/taxonomy/Event
retrieval.

---

# 28. Semantic provider/runtime config

Query timeout:

700 ms

Circuit breaker:

3 consecutive qualifying failures
→ OPEN

Open duration:

30 seconds

After cooldown:

one HALF_OPEN probe

Probe success:

→ CLOSED / reset

Probe failure:

→ OPEN again

Qualifying failures include:

- timeout
- HTTP 429
- provider 5xx
- invalid embedding response

Circuit state is local to a warm Edge isolate.

No distributed circuit coordination.

No Redis/service/cache.

---

# 29. Semantic degradation contract

Provider/circuit failure produces:

query vector:
NULL

Edge still calls:

`api.search_v1`

exactly once.

DB still executes all deterministic retrieval.

Public response:

HTTP 200

with:

`semanticDegraded = true`

for genuine provider/circuit degradation.

Normal `shouldEmbed=false` is not automatically degradation.

Do NOT expose provider details/errors publicly.

DB failure remains a DB failure and is not converted into semantic degradation.

---

# 30. semantic_candidates contract

Stage:

`semantic_candidates`

Query vector:

nullable

NULL vector:

zero semantic candidates

Valid vector:

exact cosine retrieval against compatible READY document embeddings.

Compatible document embedding requires:

- status READY
- active SearchDocument
- exact active document/hash compatibility
- provider Voyage
- model voyage-4
- active compatible config/revision
- dimension 1024
- currently eligible CanonicalEntity

Exclude:

- FAILED
- STALE
- inactive SearchDocument
- incompatible hash/model/config
- ineligible entity

Semantic candidate cap:

30

Ordering:

1. best cosine evidence
2. stable CanonicalEntity UUID tie-break

No public semantic score.

No ANN.

---

# 31. Semantic eligibility invariants

Semantic similarity never grants eligibility.

Reapply/retain authoritative:

- municipality scope
- publication state
- merge/withheld state
- taxonomy filter
- radius
- entity-type constraints
- effective location
- Event SCHEDULED status
- Event freshness
- Event horizon
- Event expiry

High semantic similarity + hard-filter failure:

NOT RETURNED

Semantic evidence can never create protected exact status.

---

# 32. SEM-01 real smoke

Real EN smoke:

`things to do in Jönköping`

shouldEmbed:

TRUE

Real Voyage query embedding:

PASS

Semantic candidates included:

- Tennisens dag
- Grenna Event
- Grenna Event
- Evergreen Restaurang & Pizzeria

Provider latency:

404 ms

DB latency:

123 ms

Total backend latency:

547 ms

Public semantic path:

PASS

Swedish real call was intentionally not issued after successful EN provider
smoke in order to conserve quota.

Injected Swedish broad/occasion semantic paths:

PASS

Formal DEV lift:

`SEMANTIC_DEV_LIFT_NOT_ASSESSABLE_DUE_TO_CURRENT_INVENTORY`

Do not fabricate semantic relevance judgments from this smoke.

---

# 33. SEM-01 tests / known local-suite issue

Focused SEM-01 gates passed:

- semantic unit tests
- shouldEmbed
- provider validation/failure
- circuit behavior
- DB semantic retrieval
- eligibility
- diagnostics
- security
- one-RPC
- typecheck
- lint

Optional full unit run:

247 PASS

3 failures:

primary-local-DB fixture-state conflicts caused by reconstructed local database
assumptions.

These are not currently attributed to SEM-01 functionality.

Do NOT mutate accepted implementation or historical local IDs/counts merely to
hide these state-sensitive fixture conflicts.

During later tasks:

- run controlled focused fixtures;
- classify these same unrelated failures explicitly if they recur;
- fix them only if a later package actually causes/owns the failure.

---

# 34. Evaluation state

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

At least:

12 EN/SV semantic query pairs

SEALED remains inaccessible during tuning.

EVAL-02 commit:

`4b4a20c`

Dataset manifest:

`dataset-manifest.day2.v1`

Manifest checksum:

`5ade651f358bafed92d51ac5b29651cbea5123958380263633e18385b5d730f0`

Inventory checksum:

`ef89e8fb98246b4418a2094addc861ee5a85e2e842a3409c0e5c761f4ab0a1f2`

Judgment version:

`judgments.day2.v1`

Judgment checksum:

`0b4df5f2…b83f`

84 judgments:

- grade 0: 60
- grade 1: 15
- grade 2: 6
- grade 3: 3

14 DEV queries evaluated.

Day-2 baseline:

- inventory-unavailable known-item queries: 6
- Hit@1 / Hit@3 / MRR: NOT_EVALUATED for absent intended targets
- Recall@20: 0.2333
- Recall@50: NOT_REQUIRED
- Precision@5: 0.1600
- NDCG@5: 0.2832
- EN P@5: 0.1000
- SV P@5: 0.2000
- EN NDCG@5: 0.2080
- SV NDCG@5: 0.3333
- zero-result: 12/14
- zero-result rate: 85.71%
- failure attribution:
  - INVENTORY 6
  - CANDIDATE_RETRIEVAL 4

Rerun:

byte-identical

Report checksum:

`bae1ad69…34f7`

This remains a historical PRE-DAY-3 baseline.

Do NOT rewrite it after DB reconstruction.

---

# 35. Evaluation/inventory interpretation

The Day-2 evaluation inventory is an immutable historical snapshot.

It is NOT the current DB reconstruction target.

Historical:

6 published entities
6 active SearchDocuments

Current reconstructed runtime snapshot during SEM-01:

1 Place
3 Events
4 active SearchDocuments
4 compatible READY embeddings

These can legitimately differ.

Never:

- force current inventory back to 6;
- hand-insert frozen DEV targets;
- tune source acquisition around judged queries;
- inspect SEALED to influence acquisition/ranking.

Product failure because intended entity is absent may be attributed:

`INVENTORY`

rather than:

`RANKING`

when supported by evidence.

---

# 36. Current next task: RANK-01

Current task:

`RANK-01 — Fixed Deterministic Reciprocal Rank Fusion`

Prerequisites now complete:

SEARCH-01
+
SEARCH-02
+
EVENT-01
+
SEM-01

RANK-01 owns:

- versioned RRF configuration
- fixed/simple rank-only fusion
- canonical exactly-once result ranking
- protected exact preservation
- deterministic tie-breaking
- restricted RRF diagnostics
- degradation-safe ranking when semantic stage is absent

RANK-01 does NOT own:

- new retrieval
- semantic tuning
- Event retrieval changes
- weighted fusion
- learned ranking
- reranking
- non-collapse
- mobile behavior
- evaluation tuning

Do not begin NONCOLLAPSE-01 automatically.

---

# 37. RANK-01 RRF invariant

Use conventional fixed/simple rank-only RRF according to the frozen contract.

Conceptually:

`rrf(entity) = Σ 1 / (k + stage_rank)`

where:

- stage ranks are 1-based;
- absent stage contributes zero;
- entity contributes at most once per stage;
- only rank participates.

Do NOT use:

- raw FTS scores
- trigram magnitudes
- cosine magnitudes
- Event popularity
- weighted stages
- learned coefficients
- query-family weights
- ML ranking

Before implementation, Codex must inspect the frozen task sections for the
normative `k`, stage list and tie behavior.

If a mandatory value is intentionally human-selected and not frozen:

STOP with:

`RANK_CONFIG_DECISION_REQUIRED`

Do not optimize silently.

---

# 38. RANK-01 stage inputs

Use existing accepted stage evidence only.

Expected ordinary stages may include repository-specific representations of:

- accentless exact
- prefix
- trigram
- FTS / lexical
- taxonomy
- Event
- semantic

Do not invent duplicate stages.

Protected canonical/alias exact behavior remains first-class and outside normal
ordinary fusion semantics according to the frozen exact contract.

Semantic stage rank comes from:

`semantic_candidates`

Event stage rank comes from:

`event_candidates`

RANK-01 consumes these stages.

It does not recompute them.

---

# 39. RANK-01 protected exact contract

Eligible protected canonical exact cannot be displaced by ordinary fused
evidence where frozen protection guarantees placement.

Eligible verified alias exact protection remains subject to existing
qualification/conflict rules.

RRF must never elevate to protected:

- accentless exact
- prefix
- trigram
- typo
- taxonomy
- Event
- semantic

If protected candidate also appears in ordinary stages:

one final entity only.

---

# 40. RANK-01 semantic degradation behavior

If SEM-01 provides no semantic candidates due to:

- timeout
- 429
- 5xx
- invalid vector
- circuit-open
- shouldEmbed=false

RRF fuses the stages actually present.

No:

- placeholder semantic rank
- synthetic semantic contribution
- deterministic-candidate penalty

For provider degradation:

deterministic ranking over remaining identical stage evidence must remain
deterministic.

`semanticDegraded` remains metadata, not a ranking signal.

---

# 41. RANK-01 deterministic ranking

Final CanonicalEntity ID:

exactly once

Preserve internally:

- participating stages
- stage ranks
- per-stage RRF contribution
- total RRF
- protected class
- final rank
- deterministic tie reason/key

Tie-breaking must follow frozen contract.

If explicitly left as implementation detail and repository provides no stronger
convention:

stable CanonicalEntity UUID ordering is acceptable.

Never use:

- random
- DB physical order
- timestamp
- insertion order
- provider latency

---

# 42. RANK-01 diagnostics

Extend restricted diagnostics for RRF.

Internal/restricted fields may include:

- protected?
- protection class
- participating stages
- stage ranks
- per-stage contribution
- total RRF
- pre-protection fused rank
- final rank
- tie-break reason
- semantic degraded/absent state
- candidate-union presence
- ranking config version

Do not expose publicly:

- RRF score
- per-stage contributions
- semantic cosine
- internal stage ranks
- protected qualification internals

Public SearchResponse changes order only.

---

# 43. Security / production path

Production search remains:

Mobile
→ Edge
→ one `api.search_v1`
→ private PostgreSQL stages

Mobile never receives:

- DB/service credentials
- Voyage key
- raw vectors
- private diagnostics
- internal ranking scores

Edge may:

- validate
- normalize
- taxonomy recognize
- parse TIME-01
- shouldEmbed
- call Voyage
- call one DB RPC
- shape public response
- emit safe telemetry

Postgres owns:

- candidate stages
- eligibility
- semantic exact vector scan
- ranking
- later non-collapse

No request-time scraping.

---

# 44. No ANN invariant

There must remain NO:

- HNSW
- IVFFlat
- approximate vector retrieval

Semantic retrieval is exact pgvector cosine over the bounded compatible READY
universe.

Do not introduce ANN during ranking/performance work unless frozen architecture
is explicitly reopened.

---

# 45. Remaining Day-3 sequence

Completed:

SRC-03B
→ EVENT-01

Completed:

EMBED-01B
→ SEM-01

Current:

RANK-01

Then:

RANK-01
→ NONCOLLAPSE-01
→ MOB-03
→ EVAL-03

## NONCOLLAPSE-01

Will own:

- broad-discovery only
- post-ranking deterministic concentration reduction
- relevance-primary ordering
- no weak-result promotion
- no effect on known-item/narrow taxonomy queries

## MOB-03

Will own:

- Event card/time presentation
- semantic degraded UX
- EN/SV presentation
- no client ranking/provider work

## EVAL-03

Will own:

- full 60 DEV evaluation
- bounded reasoned configuration tuning
- final DEV freeze
- no SEALED access

RANK-01 must not preempt these packages.

---

# 46. Day-4 sequence after EVAL-03

After Day-3 acceptance:

COVERAGE-01
→ QA-01
→ PERF-01
→ EVAL-04
→ DEPLOY-01
→ DOCS-01

Do not implement Day-4 work early unless the frozen plan explicitly permits a
small prerequisite seam.

---

# 47. Usage / execution discipline

The user is operating under tight Codex usage limits.

Optimize context and turns.

At each package:

1. use explicit package prompt;
2. read `AGENTS.md`;
3. read this handoff;
4. inspect Git history only as needed;
5. search only task-relevant frozen sections;
6. preflight internally;
7. implement;
8. run focused tests;
9. run only relevant regression;
10. inspect diff/scope;
11. commit;
12. STOP.

Do not reread all accepted history.

Do not dump enormous successful test logs.

Do not ask unnecessary questions.

Stop only for:

- genuine source/access blocker
- legal/source truth blocker
- irreconcilable frozen contract
- `SPEC_CHANGE_REQUIRED`
- explicit required human decision

Missing generated artifacts owned by current package are normally not blockers.

Use forward-only fixes.

Never rewrite accepted commits/history.

One bounded package = one commit.

---

# 48. Thread/context guidance

RANK-01 should start in a fresh Codex thread.

Startup context:

1. `AGENTS.md`
2. this `CODEX_HANDOFF.md`
3. Git status/history only as needed
4. targeted RANK-01/RRF frozen sections
5. explicit RANK-01 task prompt

Do not paste old Codex conversations into the new thread.

Do not reread every frozen document.

After RANK-01:

NONCOLLAPSE-01 may remain in the same thread only if context remains compact.

A fresh thread before NONCOLLAPSE-01 is acceptable/preferred if ranking work
generated substantial context.

---

# 49. Model guidance

Mechanical mobile/docs:

Medium

Normal source/provider work:

Sol Medium

Contract-sensitive Event/search/provenance/semantic:

Sol High

High-risk ranking work:

High / strongest justified reasoning

Current RANK-01 recommendation:

GPT-5.6 Sol
High reasoning

NONCOLLAPSE-01 recommendation:

GPT-5.6 Sol
High reasoning

EVAL-03:

High reasoning

Final evaluation/performance:

use strongest reasoning only where useful.

---

# 50. Current fresh-thread startup

For the next Codex session:

1. confirm working tree clean;
2. read `AGENTS.md`;
3. read this handoff;
4. confirm HEAD contains:
   `febdb189c5a9a36e16a7d30c8fce67f29f586695`
   plus any later docs-only handoff commit;
5. search only RANK-01/RRF-relevant frozen sections;
6. execute the explicit RANK-01 prompt;
7. do not tune against DEV;
8. do not access SEALED;
9. do not begin NONCOLLAPSE-01 automatically.

Current task:

`RANK-01`

Expected implementation commit subject:

`feat(search): add deterministic rrf ranking`

---

# 51. Completion-report format

Keep successful reports <=20 lines.

For RANK-01 use:

Task: RANK-01
Commit:
RRF config/version:
RRF formula/k:
Participating stages:
Protected canonical exact:
Protected alias exact:
Canonical uniqueness:
Eligibility:
Semantic degraded fallback:
Event integration:
Tie-break:
Restricted diagnostics:
One-RPC:
Direct-name smoke:
Broad RRF smoke:
Determinism:
Tests:
Primary-DB fixture conflicts:
Scope audit / SPEC_CHANGE_REQUIRED:
Working tree:
Next task: NONCOLLAPSE-01

Do not automatically begin the next task.