# EVAL-03 full DEV human judgment packet

- Split: DEV only
- Dataset manifest: dataset-manifest.day3-current.v2
- Dataset manifest checksum: 11a1a73e37bd2af71b7948823c6509dfb98edd86c6629834e2fc54d8a2afe4f1
- Dataset inventory checksum: aab903847c5fcfd840fe3285601d8da44d7596b5b985a2200de4f0a886b2e1fb
- DEV judged for this inventory: 0
- DEV missing: 60
- SEALED/adversarial queries and judgments: not loaded or exposed

## Rubric and target handling

- 0 = not relevant; 1 = marginal; 2 = relevant; 3 = highly relevant.
- Explicit hard-constraint violations receive grade 0 regardless of textual similarity.
- Codex has left every relevance grade blank.
- Confirm TARGET_NOT_IN_FROZEN_DATASET before using it. When confirmed: leave the target ID null, record product outcome QUERY_UNSATISFIED, primary attribution INVENTORY, and ranking assessment NOT_EVALUATED.
- Confirm the manifest's current-state observations before approving judgments. An inventory repair requires a new manifest and packet version.

## Frozen inventory

| CanonicalEntity ID | Name | Type | Factual context | Taxonomy | SearchDocument |
|---|---|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | Place; status=UNKNOWN; location=57.7793606,14.1570439; address=; locality= | dining (Dining / Restauranger) | ccdaa63b3d3bd530d005596ee46869fb0e4449ae8292ab42a94a757268c32ee6 |
| ab9d91e4-8b37-4f39-9b4c-0217e08a9690 | Smålandstriennalen: Berätta om oron och skönheten | EVENT | Event; status=SCHEDULED; starts=2026-05-29T15:00:00.000Z; ends=2026-08-30T13:00:00.000Z; venue=Österängens konsthall; location=57.7868256,14.243184 | events (Events / Evenemang) | b260b36a8df2a828b7e733d56b1638b75f141c74308cf4d0ba231669c5b21a8f |

## eval-v1-dev-broad-concentration-01

- Query: places to eat
- Language: en
- Family: broad_concentration
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-concentration-02

- Query: coffee around Jönköping
- Language: en
- Family: broad_concentration
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"92167dc5-bf32-5014-9d07-46f7c4f902dd","slug":"coffee-shop"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-concentration-03

- Query: events this weekend
- Language: en
- Family: broad_concentration
- Pair group: none
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"WEEKEND"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-concentration-04

- Query: något kul i stan
- Language: sv
- Family: broad_concentration
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-discovery-01

- Query: things to do in Jönköping
- Language: en
- Family: broad_discovery
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-discovery-02

- Query: saker att göra i Jönköping
- Language: sv
- Family: broad_discovery
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-discovery-03

- Query: somewhere nice nearby
- Language: en
- Family: broad_discovery
- Pair group: none
- Structured filters: `{"location":{"latitude":57.7826,"longitude":14.1618,"radius_meters":3000}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+RADIUS_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-broad-discovery-04

- Query: något roligt att göra
- Language: sv
- Family: broad_discovery
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-canonical-exact-same-name-01

- Query: Rosenlunds rosarium
- Language: sv
- Family: canonical_exact_same_name
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Rosenlunds rosarium","reference":"https://www.jonkoping.se/fritid-kultur--natur/friluftsliv-natur-och-parker/parker/rosenlunds-herrgard-och-rosarium/om-rosenlunds-rosarium"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-canonical-exact-same-name-02

- Query: Kulturhuset Spira
- Language: sv
- Family: canonical_exact_same_name
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Kulturhuset Spira","reference":"https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-03-10-thank-you-for-the-music"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-canonical-exact-same-name-03

- Query: Stadsbiblioteket
- Language: sv
- Family: canonical_exact_same_name
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Stadsbiblioteket","reference":"https://bibliotek.jonkoping.se/-/stadsbibliotek"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-canonical-exact-same-name-04

- Query: Espresso House
- Language: language-neutral
- Family: canonical_exact_same_name
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_TARGET_SET","members":[{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Jönköping Central","reference":"https://dk.espressohouse.com/en/find-us/jonkoping-central"},{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Östra Storgatan Jönköping","reference":"https://espressohouse.com/hitta-oss/ostra-storgatan-jonkoping"}]}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-canonical-exact-same-name-05

- Query: Espresso House Jönköping Central
- Language: language-neutral
- Family: canonical_exact_same_name
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Jönköping Central","reference":"https://dk.espressohouse.com/en/find-us/jonkoping-central"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-01

- Query: events tonight
- Language: en
- Family: event_time
- Pair group: event-dev-tonight
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"TONIGHT"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-02

- Query: evenemang ikväll
- Language: sv
- Family: event_time
- Pair group: event-dev-tonight
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"TONIGHT"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-03

- Query: what is happening tomorrow
- Language: en
- Family: event_time
- Pair group: event-dev-tomorrow
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"TOMORROW"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-04

- Query: vad händer imorgon
- Language: sv
- Family: event_time
- Pair group: event-dev-tomorrow
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"TOMORROW"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-05

- Query: events on Saturday
- Language: en
- Family: event_time
- Pair group: none
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"WEEKDAY:SATURDAY"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-event-time-06

- Query: evenemang på Kulturhuset Spira i helgen
- Language: sv
- Family: event_time
- Pair group: none
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"WEEKEND"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Kulturhuset Spira","reference":"https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-03-10-thank-you-for-the-music"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-geo-scope-radius-01

- Query: cafés in Jönköping municipality
- Language: en
- Family: geo_scope_radius
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"89cc433a-423a-5eba-9d6a-17c9745d66d8","slug":"cafes"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-geo-scope-radius-02

- Query: things to do within 1 km
- Language: en
- Family: geo_scope_radius
- Pair group: none
- Structured filters: `{"location":{"latitude":57.7826,"longitude":14.1618,"radius_meters":1000}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+RADIUS_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-geo-scope-radius-03

- Query: restauranger nära mig
- Language: sv
- Family: geo_scope_radius
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-prefix-01

- Query: Rosenlunds rosa
- Language: sv
- Family: prefix
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Rosenlunds rosarium","reference":"https://www.jonkoping.se/fritid-kultur--natur/friluftsliv-natur-och-parker/parker/rosenlunds-herrgard-och-rosarium/om-rosenlunds-rosarium"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-prefix-02

- Query: Kulturhuset Spi
- Language: sv
- Family: prefix
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Kulturhuset Spira","reference":"https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-03-10-thank-you-for-the-music"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-prefix-03

- Query: Stadsbibliot
- Language: sv
- Family: prefix
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Stadsbiblioteket","reference":"https://bibliotek.jonkoping.se/-/stadsbibliotek"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-prefix-04

- Query: Espresso House Jönköping C
- Language: language-neutral
- Family: prefix
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Jönköping Central","reference":"https://dk.espressohouse.com/en/find-us/jonkoping-central"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-scarcity-duplicate-state-01

- Query: Cuban restaurants in Jönköping
- Language: en
- Family: scarcity_duplicate_state
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"a7d01142-e735-51c9-bf56-b20250c527f1","slug":"cuban"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-scarcity-duplicate-state-02

- Query: Espresso House
- Language: language-neutral
- Family: scarcity_duplicate_state
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_TARGET_SET","members":[{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Jönköping Central","reference":"https://dk.espressohouse.com/en/find-us/jonkoping-central"},{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Östra Storgatan Jönköping","reference":"https://espressohouse.com/hitta-oss/ostra-storgatan-jonkoping"}]}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-scarcity-duplicate-state-03

- Query: events happening yesterday
- Language: en
- Family: scarcity_duplicate_state
- Pair group: none
- Structured filters: `{"entity_types":["EVENT"],"time_expression":"YESTERDAY"}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:ENTITY_TYPE_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-01

- Query: a romantic place for two
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-romantic
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-02

- Query: ett romantiskt ställe för två
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-romantic
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-03

- Query: a fun family activity with children
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-family
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-04

- Query: en rolig familjeaktivitet med barn
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-family
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-05

- Query: somewhere cozy to talk with friends
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-cozy
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-06

- Query: någonstans mysigt att prata med vänner
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-cozy
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-07

- Query: an inexpensive evening out
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-budget
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-08

- Query: en billig kväll ute
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-budget
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-09

- Query: an indoor activity for a rainy day
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-indoor
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-10

- Query: en inomhusaktivitet för en regnig dag
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-indoor
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-11

- Query: a peaceful outdoor place to unwind
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-outdoor
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-12

- Query: en lugn plats utomhus för att koppla av
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-outdoor
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-13

- Query: vegan food for a relaxed dinner with friends
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-vegan-social
- Structured filters: `{"taxonomy":{"node_id":"f2acebc7-8b7e-5c22-9bb5-36a0e29ba4b8","slug":"vegan-vegetarian"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-14

- Query: vegansk mat för en avslappnad middag med vänner
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-vegan-social
- Structured filters: `{"taxonomy":{"node_id":"f2acebc7-8b7e-5c22-9bb5-36a0e29ba4b8","slug":"vegan-vegetarian"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-15

- Query: drinks somewhere with a pleasant atmosphere
- Language: en
- Family: semantic_occasion_language
- Pair group: sem-dev-drinks-view
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-semantic-occasion-language-16

- Query: något att dricka på ett ställe med trevlig stämning
- Language: sv
- Family: semantic_occasion_language
- Pair group: sem-dev-drinks-view
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-01

- Query: Japanese restaurants
- Language: en
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"3a51d1cf-31c9-529f-b585-1102253dc735","slug":"japanese"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-02

- Query: japanska restauranger
- Language: sv
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"3a51d1cf-31c9-529f-b585-1102253dc735","slug":"japanese"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-03

- Query: Food and dining
- Language: en
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1","slug":"food-and-dining"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-04

- Query: mat och restauranger
- Language: sv
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1","slug":"food-and-dining"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-05

- Query: coffee shops
- Language: en
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"92167dc5-bf32-5014-9d07-46f7c4f902dd","slug":"coffee-shop"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-06

- Query: natur och offentliga platser
- Language: sv
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"f5978b3b-3c95-52fe-8c9c-bf5b6fae9d77","slug":"nature-and-public-places"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-taxonomy-parent-leaf-07

- Query: culture och events
- Language: mixed
- Family: taxonomy_parent_leaf
- Pair group: none
- Structured filters: `{"taxonomy":{"node_id":"6432bde9-17e2-5a04-92b3-9bf6f4589cf2","slug":"culture"}}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `null`
- Target status to confirm: NOT_APPLICABLE
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ddcca624-5540-47b3-8309-ca771e5e29b7:TAXONOMY_FILTER; ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
_No hard-eligible current inventory rows. Human must still confirm target/inventory handling._

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-typo-transposition-accent-spacing-01

- Query: Rosenlunds rosairum
- Language: sv
- Family: typo_transposition_accent_spacing
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Rosenlunds rosarium","reference":"https://www.jonkoping.se/fritid-kultur--natur/friluftsliv-natur-och-parker/parker/rosenlunds-herrgard-och-rosarium/om-rosenlunds-rosarium"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-typo-transposition-accent-spacing-02

- Query: Kulturhuset Spra
- Language: sv
- Family: typo_transposition_accent_spacing
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Kulturhuset Spira","reference":"https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-03-10-thank-you-for-the-music"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-typo-transposition-accent-spacing-03

- Query: Jonkopings stadsbibliotek
- Language: sv
- Family: typo_transposition_accent_spacing
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Stadsbiblioteket","reference":"https://bibliotek.jonkoping.se/-/stadsbibliotek"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-typo-transposition-accent-spacing-04

- Query: EspressoHouse Jönköping Central
- Language: mixed
- Family: typo_transposition_accent_spacing
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Espresso House Jönköping Central","reference":"https://dk.espressohouse.com/en/find-us/jonkoping-central"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-typo-transposition-accent-spacing-05

- Query: Rosenlunds-rosarium
- Language: sv
- Family: typo_transposition_accent_spacing
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Rosenlunds rosarium","reference":"https://www.jonkoping.se/fritid-kultur--natur/friluftsliv-natur-och-parker/parker/rosenlunds-herrgard-och-rosarium/om-rosenlunds-rosarium"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-verified-colliding-aliases-01

- Query: Spira
- Language: sv
- Family: verified_colliding_aliases
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Kulturhuset Spira","reference":"https://www.jonkoping.se/evenemangskalender/evenemangskalender/evenemang/2026-03-10-thank-you-for-the-music"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-verified-colliding-aliases-02

- Query: Rosenlund
- Language: sv
- Family: verified_colliding_aliases
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Rosenlunds rosarium","reference":"https://www.jonkoping.se/fritid-kultur--natur/friluftsliv-natur-och-parker/parker/rosenlunds-herrgard-och-rosarium/om-rosenlunds-rosarium"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __


## eval-v1-dev-verified-colliding-aliases-03

- Query: Jönköpings bibliotek
- Language: sv
- Family: verified_colliding_aliases
- Pair group: none
- Structured filters: `{}`
- Hard constraints: scope:jonkoping-municipality; publication:eligible-only
- Evaluation clock: 2026-10-15T12:00:00Z
- Frozen target reference: `{"kind":"EXTERNAL_STABLE_TARGET","label":"Stadsbiblioteket","reference":"https://bibliotek.jonkoping.se/-/stadsbibliotek"}`
- Target status to confirm: TARGET_NOT_IN_FROZEN_DATASET
- Exact canonical-name matches: `[]`
- Hard-excluded inventory: ab9d91e4-8b37-4f39-9b4c-0217e08a9690:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| ddcca624-5540-47b3-8309-ca771e5e29b7 | Evergreen Restaurang & Pizzeria | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __
