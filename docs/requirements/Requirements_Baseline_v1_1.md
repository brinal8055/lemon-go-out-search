# Lemon Going-Out Search — Requirements Baseline v1.1

**Status:** FROZEN PRODUCT / ACCEPTANCE AUTHORITY

**Repository materialization note**

The original project history contains a complete standalone
`Requirements Baseline v1`, followed by explicit Lemon product clarifications
that downstream approved documents consistently identify as
`Requirements Baseline v1.1`.

No standalone historical v1.1 artifact was recoverable.

For repository continuity, this file is a provenance-preserving consolidation of:

1. the verbatim Requirements Baseline v1; and
2. the verbatim frozen v1.1 product-decision delta supplied before
   Architecture Draft v1.

No requirement has been inferred from later architecture or implementation
documents.

## Part A — Requirements Baseline v1

# Lemon Going-Out Search — Requirements Baseline v1

## 0. Purpose

This document converts the four-day Lemon Going-Out Search brief and the **Active Going-Out Taxonomy** into a precise requirements baseline.

It intentionally does **not** prescribe the final search architecture, ranking implementation, model provider, scraping framework, or infrastructure beyond the mandated:

* React Native + TypeScript mobile application
* Supabase + PostgreSQL backend/data layer

The four-day implementation should be treated as a **narrow production-quality vertical slice** for Jönköping whose core concepts can later extend to additional cities and Lemon's broader local-services vision without requiring premature future-scale infrastructure.

---

# 1. Source-of-truth classification

## 1.1 Facts explicitly stated in the assignment

The following are requirements, not assumptions:

* The product is for **Jönköping**.
* The app must be mobile-first.
* The mobile app must use **React Native with TypeScript**.
* The backend/data layer must use **Supabase and PostgreSQL**.
* Search must support:

  * direct place-name search;
  * ranked category/general discovery;
  * AI-powered natural-language semantic search.
* These must operate as **one coherent search product** with automatic routing/combination.
* Search must work with both:

  * English prompts;
  * Swedish prompts.
* The UI must provide an explicit English/Swedish language toggle.
* Switching language must update the interface.
* The Active Going-Out Taxonomy is the only taxonomy to use for this trial.
* The legacy taxonomy must not be used.
* At least **5–10 real Jönköping places per subcategory** must be scraped from public sources.
* Data collection must include:

  * scraping;
  * normalization;
  * deduplication;
  * validation;
  * storage.
* The pipeline must:

  * be rerunnable;
  * be expandable;
  * document source limitations;
  * document data-quality problems.
* Source terms and access controls must be respected.
* Search quality is the primary evaluation signal.
* Direct search should feel immediate.
* Semantic search should be responsive enough for a consumer product.
* UI must intentionally handle:

  * loading;
  * empty;
  * error states.
* Visible bugs, flicker, console errors, or unexplained broken states are unacceptable.
* Tests, logging, validation and error handling are expected.
* Broken or incomplete areas must be disclosed.
* A smaller reliable system is preferred over a larger fragile one.
* Deliverables include:

  * installable React Native experience;
  * GitHub repository with meaningful commit history;
  * Supabase project with read access;
  * runnable scraper;
  * data-source documentation;
  * architecture/search/trade-off writeup;
  * search-quality evaluation explanation;
  * known issues;
  * explanation of what was cut;
  * another-week plan.
* Final review may include:

  * unseen search queries;
  * code walkthrough;
  * backend walkthrough;
  * live debugging;
  * a small live modification.

---

# 2. Users and jobs-to-be-done

## 2.1 Primary user

A person in or around Jönköping trying to decide:

> "Where should I go or what should I do?"

The product is not primarily a directory browser.

The user should be able to express intent at different levels of specificity.

---

## 2.2 Core jobs

### JTBD-1 — Find a known place

> "I already know approximately what I want. Help me get to it immediately."

Examples:

* `STUK`
* `Aqua Dinner`
* misspelled venue name
* partial/prefix venue name

Success means identifying the intended entity with minimal latency and without requiring a semantically elaborate query.

---

### JTBD-2 — Explore a category

> "I know the type of thing I want, but not the exact place."

Examples:

* Italian restaurants
* cafés
* cocktails
* padel
* museums
* malls

The result must be **ranked by usefulness/relevance**, not merely by whether category text matches.

---

### JTBD-3 — Explore generally

> "I want ideas but don't have an exact category."

Examples:

* things to do in Jönköping
* places for tonight
* somewhere nice nearby
* something fun

The system should return meaningful, diverse, useful options rather than arbitrary inventory.

---

### JTBD-4 — Express an occasion or intent

> "I know what experience I want, but not what category maps to it."

Examples:

* romantic dinner for two
* somewhere quiet to drink coffee and work
* something fun with children
* lively place for drinks with friends
* something outdoors by the water
* somewhere to take my mom for her birthday

This is the central semantic-search job.

---

### JTBD-5 — Search naturally in Swedish

Equivalent intent must work without forcing the user to translate mentally.

Examples:

* mysigt café för en dejt
* något kul med barn
* bra ställe för drinkar
* något att göra utomhus

---

### JTBD-6 — Switch product language

The user can explicitly choose Swedish or English and expect:

* UI labels to change;
* category names to change;
* result metadata to be presented appropriately;
* search to remain usable in either language.

---

# 3. Search flows

## 3.1 Direct-name flow

### Happy path

1. User enters a known place name.
2. Search identifies high-confidence direct-name candidates.
3. Exact/intended place ranks first.
4. Results appear immediately.
5. User sees enough information to verify that it is the intended place.

### Critical failure paths

* typo returns zero results;
* partial name misses the intended place;
* exact name ranks below unrelated popular places;
* duplicate place records appear;
* alias/alternate spelling is not recognized;
* direct lookup unnecessarily depends on an AI provider;
* temporary model failure breaks known-place lookup.

---

# 4. Category/discovery flow

### Happy path

1. User searches/browses a taxonomy concept.
2. Relevant entities are retrieved.
3. Results are ranked according to usefulness rather than raw textual match.
4. Relevant subtype/specialty matches are preferred.
5. User receives enough information to compare options.

### Critical failures

* unrelated entities rank above clear category matches;
* popularity overwhelms query relevance;
* taxonomy classification is fabricated;
* broad categories repeatedly return the same narrow subtype;
* duplicate businesses occupy multiple result positions;
* stale/closed entities rank prominently;
* entities with weak data are ranked as if highly trustworthy.

---

# 5. Natural-language / semantic flow

### Happy path

1. User describes an occasion, constraints, or desired experience.
2. The system understands enough semantic intent to retrieve plausible candidates.
3. Multiple relevant signals may influence results.
4. The user receives a useful ranked list.
5. The result does not require literal keyword overlap.

Example:

> "somewhere cozy for a first date that isn't too expensive"

Relevant concepts may include:

* suitable venue type;
* cozy atmosphere;
* dating occasion;
* price preference.

### Critical failures

* semantic search reduces to keyword matching;
* semantically appropriate places are missed because their literal text differs;
* model hallucinations introduce unsupported venue characteristics;
* unsupported user constraints are silently treated as known facts;
* AI failure causes the entire search product to fail;
* semantic search becomes unacceptably slow.

---

# 6. Taxonomy requirements

## 6.1 Active taxonomy only

The system must exclusively use:

### Food & Dining

* Dining

  * American
  * Mexican
  * Italian
  * Japanese
  * Chinese
  * Thai
  * Indian
  * Greek
  * African
  * Seafood
  * Steakhouse
  * Vegan/Vegetarian
  * Cuban
  * French
  * Spanish
  * Mediterranean
* Casual

  * Burgers
  * Pizza
  * Tacos
  * Sushi
  * Poke
  * Chicken
  * Sandwiches
  * Food Truck
  * Bowls
* Cafés

  * Coffee Shop
  * Tea House
  * Bubble Tea
  * Dessert Café
* Bakeries
* Desserts
* Brunch

### Drinks & Nightlife

* Bars
* Cocktails
* Wine
* Breweries
* Nightlife

### Activities & Experiences

* Sports
* Games
* Tours
* Culture
* Events
* Classes
* Nature & Public Places
* Attractions
* Malls & Shopping Centers

The legacy taxonomy is explicitly prohibited.

---

# 7. Taxonomy semantics

## 7.1 Multi-label classification is required conceptually

A real-world entity may legitimately belong to more than one active taxonomy classification.

Example:

A venue may be simultaneously relevant to:

* Italian;
* Mediterranean;
* Brunch;
* Cocktails.

Therefore, the requirements baseline must **not assume that every place has exactly one category**.

---

## 7.2 Parent/child meaning matters

A query for:

> Dining

may include multiple dining specialties.

A query for:

> Italian

should preferentially return entities truthfully classified as Italian.

The system must preserve the distinction between:

* broad category;
* subcategory;
* specialty/leaf classification.

---

## 7.3 Classification evidence

Specialty matching may use:

* structured categories;
* tags;
* descriptions;
* menus/services;
* image-description metadata.

Classification must not be asserted merely to increase taxonomy coverage.

---

# 8. The "5–10 per subcategory" requirement

This is the most important ambiguity in the brief.

Some active taxonomy specialties may not have 5–10 legitimate Jönköping entities.

Examples could plausibly include:

* Cuban;
* African;
* Tea House;
* Bubble Tea;
* Breweries;
* certain Tours;
* certain Classes;
* some Attractions.

The baseline therefore adopts the following defensible rule.

## 8.1 Truthful Coverage Rule

For every active taxonomy node targeted for collection:

1. Search reasonable permitted public sources thoroughly.
2. Include only entities supported by credible evidence.
3. Target **5–10 legitimate entities wherever such supply exists**.
4. Never:

   * fabricate businesses;
   * duplicate one business to increase counts;
   * stretch a weakly related business into a specialty;
   * infer a specialty solely because coverage is missing.
5. If fewer than five legitimate entities can be identified:

   * ingest every credible matching entity found;
   * mark the taxonomy node as **supply constrained**;
   * record:

     * number found;
     * sources searched;
     * evidence/limitations;
     * unresolved uncertainty.
6. Include a machine-readable or documented **taxonomy coverage report**.

Example:

```text
Italian                 10   COMPLETE
Indian                   7   COMPLETE
Bubble Tea               3   SCARCE
Cuban                    0   SCARCE
Padel                    8   COMPLETE
Boat Tours               2   SCARCE
```

## 8.2 Prohibited outcome

> Meeting a numeric coverage target through false classification is worse than explicitly reporting genuine local scarcity.

This should be defended during review if challenged.

---

# 9. Place versus event requirements

The assignment includes both persistent venues and **Events**.

These represent materially different entities.

## 9.1 Place

A persistent physical destination.

Examples:

* restaurant;
* café;
* museum;
* padel venue;
* park;
* mall.

Relevant characteristics may include:

* identity;
* location;
* category;
* regular opening availability;
* persistent attributes.

---

## 9.2 Event

A time-bound occurrence.

Examples:

* concert;
* festival;
* theatre performance;
* sporting event;
* comedy show.

Relevant characteristics may include:

* event identity;
* date/time;
* duration;
* venue/location;
* event status;
* booking/information link.

---

## 9.3 Invariant

A time-bound event must not be represented as if it were simply a permanent place.

The eventual implementation must support search experiences such as:

* concerts this weekend;
* events tonight;
* things happening Saturday;

without corrupting permanent place semantics.

How this is technically implemented remains an architectural decision.

---

# 10. Data requirements

Every searchable entity should have enough trusted information to support:

* identity;
* display;
* taxonomy matching;
* ranking;
* semantic retrieval;
* provenance;
* freshness assessment.

Potential fields are implementation decisions, but the following **information classes are requirements**.

## 10.1 Identity

At minimum:

* canonical identity;
* display name;
* source identity where available.

---

## 10.2 Location

Enough location data must exist to establish that the entity is genuinely relevant to Jönköping.

---

## 10.3 Taxonomy

Classification against the Active Going-Out Taxonomy.

Classification should preserve uncertainty where necessary.

---

## 10.4 Descriptive/searchable information

Enough factual information should be collected to support useful discovery.

Examples may include:

* descriptions;
* cuisine;
* services;
* venue type;
* menu information;
* activities;
* public-space type;
* relevant venue attributes.

---

## 10.5 Source provenance

For every canonical entity, the system must retain enough provenance to answer:

> Where did this information come from?

At minimum:

* source;
* source identifier or URL where available;
* collection timestamp.

For derived classifications or AI-enriched data, provenance/evidence should remain distinguishable from authoritative source facts.

---

# 11. Data freshness

The brief explicitly requires a rerunnable pipeline.

Therefore:

* collected data cannot be treated as permanently correct;
* collection time must be knowable;
* updates must be capable of being reapplied;
* rerunning collection must not arbitrarily duplicate existing entities.

The implementation should be able to identify at least:

* new entity;
* unchanged entity;
* changed entity;
* rejected/invalid entity.

Deletion/closure semantics may remain implementation-specific during the trial but stale entities must be acknowledged as a production concern.

---

# 12. Normalization requirements

Different sources may describe the same concept differently.

Normalization must cover as applicable:

* names;
* whitespace/casing;
* addresses;
* taxonomy labels;
* URLs;
* coordinates;
* category representations;
* language representation;
* known source-specific formatting differences.

Normalization must not destroy the raw source representation needed for debugging/provenance.

---

# 13. Deduplication requirements

The system must prevent the same real-world place appearing multiple times merely because:

* multiple sources describe it;
* its spelling differs;
* accents differ;
* address formatting differs;
* one source includes a suffix such as "Jönköping";
* one source uses an alias.

## Dedup invariant

> One real-world place should normally correspond to one canonical searchable entity.

Ambiguous possible duplicates should prefer:

> unresolved/manual-review state over destructive false merging.

---

# 14. Validation requirements

Before data is published into user-facing search, validation must be capable of detecting:

* missing identity;
* impossible/invalid coordinates;
* invalid taxonomy assignment;
* malformed URLs where applicable;
* obviously incomplete records;
* duplicate identities;
* unsupported classifications;
* malformed event dates/times;
* records outside the intended geographic scope.

Validation failures must be visible rather than silently discarded.

---

# 15. Bilingual requirements

## 15.1 UI language

Explicit user-facing toggle:

* English;
* Swedish.

Changing it must update interface text.

---

## 15.2 Search-language independence

Search must accept:

* English query while UI is English;
* Swedish query while UI is Swedish;
* Swedish query while UI is English;
* English query while UI is Swedish.

The language toggle must not artificially restrict query language.

---

## 15.3 Mixed-language behavior

Reasonable mixed-language queries should still work.

Examples:

* `mysigt cafe for date`
* `bra cocktail bar downtown`
* `Italian restaurang`

The system does not need perfect arbitrary code-switching, but common mixed-language intent must degrade gracefully.

---

## 15.4 Semantic equivalence

Equivalent English and Swedish queries should produce substantially overlapping relevant results when the user intent is equivalent.

Example:

> `cozy café for a date`

and

> `mysigt café för en dejt`

should not produce completely unrelated result sets without a legitimate data reason.

---

# 16. Ranking requirements

The assignment explicitly says:

> Ranked discovery should return the best places, not merely text matches.

Therefore ranking must distinguish:

* retrieval eligibility;
* relevance;
* relative ordering.

## 16.1 Ranking principles

### Query relevance dominates unrelated popularity

A globally/popularly strong entity must not rank above a clearly more relevant entity solely because it is popular.

### Strong specialty match beats weak broad match

For:

> Italian restaurant

a strongly supported Italian entity should normally outrank an unrelated generic restaurant.

### Semantic intent matters

For:

> quiet place for coffee and work

relevance should reflect the expressed experience, not just the term `coffee`.

### Low-confidence data should not masquerade as authoritative

Where ranking relies on uncertain derived information, its uncertainty should be considered.

---

# 17. Search-quality acceptance requirements

Final exact thresholds may be tuned after the real dataset is known, but the baseline establishes minimum measurable expectations.

## 17.1 Exact-name search

For all canonical entities in the curated evaluation sample:

**Acceptance:**

* exact canonical-name query:

  * intended entity at rank #1 ≥ **98%**;
* known alias exact query:

  * intended entity in top 1–3 ≥ **95%**.

Zero-result exact known-name searches are prohibited except for intentionally excluded entities.

---

## 17.2 Prefix search

For meaningful unique prefixes of known entities:

* intended entity top-3 ≥ **95%**;
* intended entity rank #1 when the prefix unambiguously identifies it ≥ **90%**.

Very short ambiguous prefixes may return multiple plausible candidates.

---

## 17.3 Typo/fuzzy search

Evaluation should include:

* character transposition;
* missing character;
* extra character;
* single-character substitution;
* spacing differences;
* accent differences where appropriate.

For reasonable one-edit or common typo queries:

* intended entity top-3 ≥ **90%**.

No unrelated semantic result should outrank a very strong fuzzy-name candidate without clear justification.

---

# 18. Category discovery acceptance

Create manually judged evaluation queries spanning all major active categories.

For each query, manually judge relevance.

Measure at minimum:

* Recall@5;
* NDCG@5 or equivalent ranked-quality measure.

Initial target:

* Recall@5 ≥ **0.85** for categories with adequate underlying supply;
* NDCG@5 ≥ **0.80** on the curated category evaluation set.

Scarcity-constrained taxonomy nodes should be evaluated relative to the known legitimate supply, not an invented denominator.

---

# 19. General discovery acceptance

General discovery requires useful diversity.

For broad queries such as:

* things to do;
* places to go;
* something fun;

the top results should:

* contain genuinely eligible Jönköping entities;
* avoid duplicate entities;
* avoid obviously stale/invalid entities;
* not collapse into one taxonomy subtype unless query/context supports it.

Exact diversity formula remains an implementation decision.

---

# 20. Semantic-search acceptance

Evaluation set should include previously unseen-style intent queries.

Categories should include:

* occasion;
* group composition;
* atmosphere;
* activity intent;
* budget;
* indoor/outdoor;
* family;
* romantic/social;
* food/drink preference;
* combinations of multiple constraints.

For judged semantic queries:

* NDCG@5 target ≥ **0.75**;
* Recall@5 target ≥ **0.80** where sufficient relevant supply exists.

More importantly:

> top-ranked results must be explainably connected to the expressed user intent.

---

# 21. Bilingual search acceptance

Maintain paired intent queries.

Example:

```text
cozy café for a date
mysigt café för en dejt
```

For paired queries:

* top-5 result overlap should generally be ≥ **60%** where semantic meaning is effectively identical and supply is sufficient;
* both result sets must independently satisfy relevance judgments.

Overlap is a diagnostic metric, not a substitute for relevance.

---

# 22. Search latency requirements

The assignment provides qualitative latency requirements:

* direct search: immediate;
* semantic search: consumer-responsive.

For the four-day vertical slice, use the following measurable targets under normal conditions:

## Direct-name/category search

* p50 server/search processing ≤ **100 ms**
* p95 ≤ **300 ms**

excluding unavoidable client/network transport where separately measurable.

## Semantic search

* p50 end-to-end backend search processing ≤ **750 ms**
* p95 ≤ **1.5 s**

If an external AI model is invoked synchronously, its latency must be separately measured.

These are trial targets, not permanent SLOs.

---

# 23. AI/model dependency requirements

AI must be meaningful for semantic intent.

However:

## Invariant

> Core direct-name search must not require an AI/model provider to be available.

When AI/model infrastructure is unavailable:

* exact-name lookup must remain functional;
* fuzzy/name lookup should remain functional;
* basic category discovery should remain functional;
* semantic quality may degrade;
* user should receive a useful fallback where possible;
* internal logs should indicate fallback/degradation.

---

## Prohibited AI behavior

AI must not:

* invent a business;
* invent an event;
* invent opening hours;
* invent factual venue capabilities;
* fabricate taxonomy evidence;
* fabricate ratings;
* convert speculative enrichment into authoritative source truth.

---

# 24. Degraded-behavior acceptance

Simulate:

* semantic provider timeout;
* semantic provider error;
* malformed model response where applicable.

Acceptance:

* search request must not crash the mobile app;
* direct-name and basic discovery capabilities remain available;
* fallback behavior is deterministic enough to debug;
* the failure is logged;
* the user receives either:

  * degraded results;
  * or an intentional recoverable error state.

Blank screen or indefinite spinner is prohibited.

---

# 25. Mobile-state requirements

The application must intentionally implement:

## Loading

* user sees feedback that search is running;
* stale results should not flicker unpredictably;
* rapid query changes must not display obviously mismatched old-query results.

## Empty

User receives:

* explicit indication that nothing suitable was found;
* no misleading fake recommendation.

## Error

User receives:

* understandable recoverable state;
* retry capability where appropriate.

## Success

Result needs enough information to allow the user to judge suitability.

Exactly which visual fields appear is a product/UI decision.

---

# 26. Security and trust boundaries

The trial is a discovery product, not an authenticated transaction platform.

Minimum boundaries:

* secrets must not be embedded in the mobile application/repository;
* privileged backend/database credentials must not be exposed client-side;
* source ingestion inputs are untrusted;
* externally obtained HTML/JSON/text is untrusted;
* model outputs are untrusted;
* API input must be validated;
* database permissions must prevent inappropriate public mutation;
* error messages must not expose secrets or sensitive infrastructure details.

No requirement currently exists for storing sensitive user personal data.

---

# 27. Deployment requirements

The final system must be demonstrably usable.

Required:

* installable mobile experience through Expo/equivalent;
* deployed/accessible backend;
* inspectable Supabase project;
* repository that can be checked out and run;
* clear environment/setup documentation;
* database migrations or equivalent reproducible schema setup;
* rerunnable ingestion path.

A reviewer should not need undocumented local state to reproduce the core product.

---

# 28. Logging and monitoring requirements

At minimum, the implementation must make it possible to answer:

### Search

* what query was executed;
* what type/path of search was used;
* how long it took;
* how many results were returned;
* whether fallback/degradation occurred;
* whether the request failed.

### Ingestion

* when ingestion ran;
* which source;
* how many records were:

  * seen;
  * accepted;
  * rejected;
  * added;
  * updated;
  * unresolved.

### Errors

Failures should include enough context for diagnosis without exposing secrets.

---

# 29. Testing requirements

Testing should emphasize system risk, not artificial coverage percentage.

Minimum test areas:

### Unit/logic

* normalization;
* taxonomy mapping;
* ranking-critical logic;
* deduplication helpers;
* query interpretation;
* validation.

### Integration

* database-backed search;
* ingestion idempotency;
* search fallback behavior;
* API validation.

### Search evaluation

Separate relevance/evaluation suite using manually judged queries.

### Mobile

Critical flow smoke coverage:

* search;
* result rendering;
* loading;
* empty;
* error;
* language toggle.

---

# 30. Reproducible relevance evaluation

Search quality must not be evaluated only by hand-picked demos.

Create a versioned evaluation corpus.

It should include:

* exact names;
* prefixes;
* typos;
* aliases;
* broad categories;
* specialties;
* general discovery;
* English semantic intent;
* Swedish semantic intent;
* mixed-language queries;
* multi-constraint queries;
* intentionally difficult/ambiguous cases;
* zero-supply/scarcity cases.

Judgments should be stored separately from ranking implementation.

Running the same search implementation against the same dataset/eval version should produce reproducible metrics, ignoring unavoidable non-deterministic external model behavior where documented.

---

# 31. Extensibility requirements

The vertical slice must not hardcode assumptions that make the following require a conceptual rewrite:

## Additional cities

Future expansion should be able to add:

* Stockholm;
* Gothenburg;
* Malmö;
* other countries/cities.

Jönköping must be treated as current scope, not embedded as an irreversible domain assumption.

---

## Additional taxonomy categories

Future Lemon categories may include broader local services.

The implementation should not require redesigning the basic notion of:

* entity identity;
* taxonomy;
* provenance;
* retrieval;
* ranking;

just because new taxonomy branches are introduced.

---

## More data sources

Additional source adapters should be conceptually possible without rebuilding the complete ingestion workflow.

---

## More ranking signals

Future signals may include:

* personalization;
* social activity;
* booking outcomes;
* availability;
* transaction history;
* user feedback.

The trial does not implement these, but current search semantics should not make them impossible to incorporate later.

---

# 32. Explicit non-goals

The four-day implementation does **not** need to build:

* Lemon's broader all-services taxonomy;
* beauty;
* home services;
* pets;
* automotive services;
* booking workflows;
* payments;
* vendor onboarding;
* vendor dashboards;
* user accounts unless technically required for the demo;
* personalized ranking;
* social graph;
* recommendations based on historical user behavior;
* production-scale distributed infrastructure;
* multi-region deployment;
* millions-of-entities scale;
* enterprise-level analytics platform;
* advanced ML training pipeline;
* perfect real-time business availability;
* comprehensive real-time event inventory;
* perfect translation of every source field;
* exact final architecture for Lemon's future global system.

These may influence extensibility decisions but must not consume core four-day implementation effort.

---

# 33. Invariants

The following must remain true regardless of implementation.

### Data truth

1. Every displayed real-world entity must correspond to a legitimate real-world entity.
2. No entity may be fabricated to satisfy taxonomy coverage.
3. Taxonomy assignment must be supported by data/evidence.
4. Source-derived facts and inferred/enriched attributes must remain conceptually distinguishable.
5. One real-world place should not appear repeatedly because of multiple data sources.

### Search

6. Exact known-name relevance beats general semantic relevance.
7. Query relevance takes precedence over unrelated popularity.
8. Semantic search must not require literal keyword overlap.
9. Direct-name search cannot depend entirely on an external AI provider.
10. AI outage must not cause complete search outage.
11. Search must not silently return fabricated results.

### Events

12. Time-bound events must retain time semantics.
13. Expired events must not behave as evergreen venues.

### Bilingual

14. UI language must not restrict query language.
15. Equivalent Swedish/English intent should produce meaningfully comparable relevance.

### UX

16. No indefinite loading.
17. No unexplained blank/error screen.
18. No stale-result flicker that visibly mismatches the current query.

### Operations

19. Ingestion must be rerunnable.
20. Reruns must not create duplicate entities merely because they are reruns.
21. Search and ingestion failures must be diagnosable.

---

# 34. Reasonable assumptions

Unless Lemon states otherwise, the implementer can safely assume:

1. Jönköping city/urban area is the geographic trial scope.
2. Search can return entities even where transactional booking is unavailable.
3. Search relevance matters more than comprehensive local inventory.
4. Structured factual data may be combined from multiple permitted public sources.
5. Different entities may belong to multiple active taxonomy classifications.
6. Events and persistent places need distinct time semantics.
7. Scarcity should be disclosed rather than compensated for with weak classification.
8. User personalization is not required.
9. Anonymous/general search is sufficient for the trial.
10. Exact production traffic volume is not required to choose the four-day implementation.
11. Search evaluation may use a manually curated relevance dataset.
12. Reasonable engineering decisions can be made without requiring Lemon approval unless they materially alter product interpretation.

---

# 35. Decisions the implementer should own

These should **not** be escalated unless new information materially changes them:

* exact database schema;
* internal service/module boundaries;
* fuzzy-search method;
* full-text retrieval approach;
* vector/embedding approach;
* semantic model provider;
* model choice;
* ranking formula;
* scoring weights;
* caching strategy;
* scraper implementation;
* dedup algorithm;
* enrichment workflow;
* API shape;
* source priority;
* exact mobile component library;
* automated test framework;
* observability tooling;
* internal query routing mechanism;
* evaluation metric implementation.

These are engineering decisions to justify, measure and revise.

---

# 36. Material open questions for Lemon

Ranked by **Impact × Uncertainty**.

## P0 — Must clarify before final taxonomy/data architecture is frozen

### Q1. What exactly does "5–10 places per subcategory" mean?

Possible interpretations:

**A. Leaf level**

5–10 for every specialty:

* American;
* Mexican;
* Cuban;
* Tea House;
* Bubble Tea;
* etc.

**B. Immediate subcategory level**

5–10 for:

* Dining;
* Casual;
* Cafés;
* Bars;
* Sports;
* Games;
* Tours;
* etc.

**C. Best-effort across every taxonomy node with explicit scarcity reporting**

### Impact: Very High

### Uncertainty: High

Why material:

The interpretation can change required dataset size by several multiples and may be impossible to satisfy truthfully for some specialties within Jönköping.

### Recommended temporary rule

Proceed using the **Truthful Coverage Rule** above until Lemon clarifies.

---

## P1 — Clarify early but does not block initial implementation

### Q2. What geographic boundary counts as "Jönköping"?

Possibilities:

* municipality;
* city proper;
* metro/nearby area;
* practical local-going-out radius.

### Impact: Medium/High

### Uncertainty: Medium

Risk:

Coverage and category counts may change significantly depending on boundary.

Temporary assumption:

Use a clearly documented, defensible city-level boundary.

---

## P1

### Q3. Are live/upcoming Events expected to be part of the scraped trial dataset, or is venue-based Culture/Activities sufficient?

The taxonomy explicitly includes:

> Events: concerts, theatre, sports, festivals and comedy.

### Impact: High

### Uncertainty: Medium

Risk:

Time-bound event ingestion introduces meaningful freshness and lifecycle requirements.

Architecture should preserve event semantics regardless, but required trial depth depends on this answer.

---

# 37. Questions intentionally not escalated

Do not ask Lemon:

* Which vector database should we use?
* Which embedding model?
* Should we use fuzzy matching?
* What database tables should we create?
* Which API framework?
* How should ranking weights work?
* Which scraper framework?
* Which test framework?
* Should retrieval be hybrid?
* Should exact name outrank semantic relevance?

These belong to implementation ownership.

---

# 38. Risks if open questions remain unanswered

## R1 — Taxonomy over-classification

If "5–10 per subcategory" is interpreted literally at every leaf, engineers may feel pressured to classify unsuitable businesses merely to meet counts.

Mitigation:

Truthful Coverage Rule + coverage report.

---

## R2 — Dataset explosion

A leaf-level requirement could require several hundred legitimate entities, disproportionate to a four-day trial.

Effect:

Less time for the primary evaluation criterion: search quality.

---

## R3 — Event scope expansion

If live Events are required but discovered late, ingestion/freshness requirements could materially expand late in the trial.

---

## R4 — Geographic inconsistency

Without a defined Jönköping boundary, entities may appear arbitrarily included/excluded.

---

## R5 — Evaluation overfitting

A very small hand-selected evaluation set could result in tuning ranking specifically to known examples.

Mitigation:

Separate development and held-out/adversarial evaluation queries.

---

# 39. Requirements Baseline v1

## Goals

Build a production-quality Jönköping vertical slice that demonstrates:

* trustworthy real-world data;
* excellent known-place lookup;
* useful ranked discovery;
* meaningful natural-language semantic retrieval;
* Swedish and English support;
* dependable mobile behavior;
* measurable search relevance;
* rerunnable data ingestion;
* clean foundations for future cities/categories.

---

## Non-goals

Do not build:

* broader Lemon services;
* booking;
* payments;
* personalization;
* social systems;
* vendor tooling;
* future-scale distributed infrastructure;
* complete global data ingestion;
* premature scalability systems unrelated to current requirements.

---

## Functional requirements

The user can:

1. search an exact place;
2. search with a prefix;
3. search with reasonable typos;
4. discover by category;
5. perform general discovery;
6. express natural-language intent;
7. search in Swedish;
8. search in English;
9. use reasonable mixed-language queries;
10. toggle UI language;
11. receive intentionally handled loading/error/empty states.

Search must behave as one coherent product.

---

## Data requirements

The system must:

* collect legitimate Jönköping entities;
* use only the Active Going-Out Taxonomy;
* retain provenance;
* normalize source data;
* deduplicate entities;
* validate records;
* support reruns;
* record data freshness;
* report taxonomy scarcity;
* distinguish persistent places from time-bound events;
* preserve evidence for classifications.

---

## Search/relevance requirements

Search must provide:

* high-confidence known-name retrieval;
* prefix and fuzzy matching;
* ranked taxonomy discovery;
* broad discovery;
* semantic intent matching;
* relevance-dominant ranking;
* deterministic fallback capability;
* versioned reproducible evaluation.

Primary evaluation metrics:

* Recall@K;
* MRR for known-item retrieval;
* NDCG@5 for ranked relevance;
* latency;
* zero-result rate.

---

## Bilingual requirements

* English UI;
* Swedish UI;
* explicit toggle;
* English search;
* Swedish search;
* reasonable mixed-language search;
* semantically equivalent queries should have materially comparable relevance.

---

## NFRs

Target:

### Direct/category search

* p50 ≤ 100 ms
* p95 ≤ 300 ms

### Semantic search

* p50 ≤ 750 ms
* p95 ≤ 1.5 s

Additionally:

* no visible app crashes;
* no console errors left unexplained;
* graceful dependency degradation;
* deterministic/reproducible ingestion;
* diagnosable failures.

---

## Security/privacy boundaries

* no privileged secrets in mobile/client;
* validate API inputs;
* treat scraped content as untrusted;
* treat model output as untrusted;
* prevent unauthorised data mutation;
* avoid leaking infrastructure/secrets through errors;
* no unnecessary personal-data collection.

---

## Operational requirements

Provide:

* deployable mobile app;
* deployed backend;
* inspectable Supabase project;
* runnable ingestion;
* migrations/setup;
* structured logs;
* ingestion metrics;
* search latency metrics;
* failure visibility;
* documented limitations;
* meaningful Git history.

---

## Invariants

* Never fabricate supply.
* Never fabricate classification evidence.
* Never duplicate entities to satisfy coverage.
* Never make exact-name search dependent on AI.
* Never allow AI outage to cause total search outage.
* Never treat event timestamps as irrelevant.
* Never silently hide ingestion/search failures.
* Never let popularity override obviously stronger relevance.
* Never use the legacy taxonomy.
* Never treat UI language and query language as the same concept.

---

## Assumptions

Until clarified:

* Jönköping means a documented city-level geographic scope.
* taxonomy coverage is best-effort but truthful;
* scarcity is acceptable when documented;
* multi-label taxonomy membership is valid;
* events require distinct temporal semantics;
* anonymous search is sufficient;
* production extensibility matters more than premature production-scale infrastructure.

---

## Open questions

### P0

**What exactly does "5–10 real Jönköping places per subcategory" mean within the hierarchical Active Taxonomy?**

### P1

**What geographic boundary constitutes Jönköping for this trial?**

### P1

**Are live/upcoming Events required as first-class trial inventory, or is the primary trial expected to focus on persistent places?**

Everything else can reasonably be owned by the implementer.

---

## Risks

Primary risks are:

1. false taxonomy coverage;
2. insufficient search-quality evaluation;
3. overengineering instead of relevance improvement;
4. stale or low-quality source data;
5. duplicate entities;
6. semantic-model dependency becoming a single point of failure;
7. bilingual relevance inconsistency;
8. late expansion of event requirements;
9. geographic-scope inconsistency;
10. sacrificing core relevance to build future features.

---

# 40. Acceptance criteria summary

The trial is acceptable when:

* legitimate Jönköping inventory covers the active taxonomy as deeply as truthful supply permits;
* scarcity is explicitly reported;
* exact known-place search is effectively perfect;
* prefixes and reasonable typos reliably find intended places;
* category results are ranked, not merely matched;
* natural-language queries return semantically useful results;
* equivalent Swedish and English intent behaves comparably;
* direct search feels immediate;
* semantic search is consumer-responsive;
* AI failure leaves basic search operational;
* ingestion is reproducible and does not duplicate records;
* source provenance can be inspected;
* loading/error/empty mobile states are intentional;
* search relevance is measured against a repeatable judged corpus;
* known limitations are disclosed;
* no legacy taxonomy is used;
* no fabricated places or weak classifications are introduced to satisfy coverage numbers.

---

# Architecture Gate

Before final architecture begins, **only one issue is truly blocking enough to seek immediate Lemon clarification**:

> **The intended semantic level of “5–10 real Jönköping places per subcategory.”**

The geographic boundary and Events depth should also be clarified early, but implementation can begin using the documented assumptions above without waiting.

Everything else in this baseline is sufficiently defined for the engineer to own the architectural decisions.

## Part B — v1.1 Frozen Product Clarifications

## Geographic scope

The four-day trial covers the **full Jönköping municipality**.

Jönköping must be modeled as configurable/versioned geographic data rather than
hardcoded core entity/search semantics.

---

## Taxonomy coverage

The "5–10 places per subcategory" requirement is literal **where legitimate
supply exists**.

For every Active Going-Out Taxonomy leaf:

- target 5–10 legitimate matching entities;
- if fewer genuinely exist within Jönköping municipality:
  - ingest all legitimate supply found;
  - mark the taxonomy node as `supply_constrained`;
  - preserve evidence of sources searched and count found;
  - disclose scarcity in documentation/evaluation.

Never:

- fabricate entities;
- duplicate entities to increase counts;
- stretch adjacent businesses into weak categories merely to satisfy coverage.

Only the Active Going-Out Taxonomy is permitted.

The legacy taxonomy is prohibited.

---

## Data sourcing

Lemon has given engineering ownership over the scraping/data acquisition
approach for this trial.

That does NOT override requirements to respect:

- source terms;
- licences;
- robots/access restrictions;
- API limits;
- authentication boundaries.

The resolved source direction is:

Base discovery:
- OpenStreetMap / Overpass;
- Jönköping municipality open data;
- Wikidata where useful.

Authoritative enrichment:
- official venue websites;
- official organizer websites;
- municipal sources for municipal assets.

Conditional/fallback:
- JKPG/Destination Jönköping only where permitted or used as validation/evidence
  without copying restricted editorial content;
- structured Event providers only where terms permit intended use.

Do not treat:

- Google Maps consumer data;
- social platforms;
- review databases;
- search-engine snippets;
- access-controlled pages

as harvestable canonical inventory unless explicitly licensed.

Maintain source provenance and licence metadata.

---

## AI/provider constraints

For this trial there are **no special provider, retention, regional-processing,
or vendor restrictions** that constrain architecture.

Provider/model selection is engineering-owned and should be based on:

- Swedish/English quality;
- mixed-language performance;
- latency;
- reliability;
- cost;
- integration simplicity.

Direct-name/category search must not depend on the provider.

---

## Events

Events are first-class time-bound entities, not permanent venue categories.

The resolved trial policy is:

- upcoming Event inventory supported;
- rolling horizon: next 30 days;
- target refresh frequency: daily;
- coverage best-effort from legitimate permitted sources;
- comprehensive Event coverage is not required.

Support eventual queries such as:

- events tonight;
- concerts this weekend;
- theatre Saturday;
- `evenemang ikväll`;
- `konsert i helgen`.

The 30-day/daily rule is a trial policy, not a permanent Lemon product rule.

Expired/cancelled Events must not behave as evergreen inventory.

---

## Important version semantics

Where Part B resolves an open question or temporary assumption in Part A,
Part B governs.

Do not otherwise alter Part A.

In particular, Part B freezes:

- full municipality rather than unresolved geographic scope;
- literal truthful leaf coverage;
- engineering-owned acquisition mechanics;
- no special embedding/provider constraints;
- first-class bounded upcoming Events.

Do not infer additional deltas.
