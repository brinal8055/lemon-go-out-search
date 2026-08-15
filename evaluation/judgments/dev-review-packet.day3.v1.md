# EVAL-03 full DEV human judgment packet

- Split: DEV only
- Dataset manifest: dataset-manifest.day3-current.v1
- Dataset manifest checksum: 7bf3624aac182e701f3ea1c5420e75d7ae93f14983ee2846e1615a3bbb723194
- Dataset inventory checksum: 1af323658af3bdb1d20495bc3449ca0a5bd80aafa1f44439ce5aefaf43a9b972
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
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | Place; status=UNKNOWN; location=57.7850430516452,14.0818236375636; address=; locality= | sports (Sports / Sport) | a62735db50caee08f6c042432bb4d56df5d13ca4f4201526d7f463ced78782ac |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | Place; status=UNKNOWN; location=57.7793606,14.1570439; address=; locality= | dining (Dining / Restauranger); attractions (Attractions / Sevärdheter) | 6347d92c5e05a7eb1fbcafac6030ddd7ae5bee9f0a57eb259530633ee381268b |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | Place; status=UNKNOWN; location=57.7826,14.1618; address=; locality= | dining (Dining / Restauranger); indian (Indian / Indisk); attractions (Attractions / Sevärdheter) | NO_ACTIVE_DOCUMENT |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | Place; status=ACTIVE; location=57.7814,14.1618; address=; locality=Jönköping | culture (Culture / Kultur) | aae8fb153ed1ad8597d359223ae9250e89df1cc2c0d38d65970925ca12884999 |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | Place; status=ACTIVE; location=57.7814,14.1618; address=; locality=Jönköping | culture (Culture / Kultur) | NO_ACTIVE_DOCUMENT |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | Place; status=UNKNOWN; location=57.7826,14.1618; address=; locality= | dining (Dining / Restauranger); indian (Indian / Indisk); attractions (Attractions / Sevärdheter) | NO_ACTIVE_DOCUMENT |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | Place; status=UNKNOWN; location=57.7780921,14.1583465; address=; locality= | dining (Dining / Restauranger); indian (Indian / Indisk) | 48d2f551c56de4627575c96bdb4840ce679780fcf947644b304f9fd2cade51df |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | Place; status=UNKNOWN; location=57.6923150843818,14.0904687698558; address=; locality= | sports (Sports / Sport) | db9d1b77a6e845a9e014219ea8a473b9fc682746a34ce0c44ad07755f3842dff |
| 165c346a-5f76-445c-86c5-a998aa52d209 | Municipal Event ba482a13 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | 8d279d48d70a86cd1f3730f4824207a86378dbbef0220f638e0114834d0395db |
| 358deb23-1f5f-4f51-a623-869e7ae27680 | Municipal Event 728b3479 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | 012b25d8a68db278d75a528e667cb51ebf6b146f64614976c6ce49e29ae7b7d6 |
| 53a9c418-c852-4143-b656-b8b68451d732 | Municipal Event c2ab274a | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | e8fafd636407317b298c81da5fb5fe98532ad551927a89c02e78b63ff4e5c598 |
| 62c912d4-da32-4fd1-b416-a2fd5af65085 | Municipal Event 78340209 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| 63fef8df-9eb2-467c-af78-a5f93b83b55b | Municipal Event db5bb579 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | eea8ade2bdfa1ae35b78573097857129cf069d45b7e16ff9030a5a5891f6903d |
| 812d6f6d-2ccf-452a-b78f-b01c140173c3 | Municipal Event b9ce54c1 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | f3863ee9049c1b61b2c43b59ed5a870a0bbb19ecbc70b433f10c2b86dcbce899 |
| 904f7b9e-bdbb-4374-8a39-68f3799a64bb | Municipal Event 53ec0876 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| a144190b-0c57-4f25-8129-744025b521bb | Municipal Event e1e9e88f | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| a3211a3c-c4cb-4406-b016-19bebe014e17 | Municipal Event b4040d6b | EVENT | Event; status=SCHEDULED; starts=2026-08-21T16:00:00.000Z; ends=2026-08-21T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | 039f154c737255fbe260928c5aad40cfe50c9d69a3091e758c482da32bdcf44f |
| a52a7610-7538-4be3-bddd-1fc6f6361e0a | Municipal Event 57831c7d | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | add216dc134b11439344f44fb48ed37c2e48c9ce2b636ed8dd67206c075e30f2 |
| af1008ba-5846-4c77-80d4-d8c1619e63d4 | Municipal Event 5c9fdb2f | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| b29dd35d-ebb5-48bc-b8e8-74290bd02b7d | Municipal Event 46748e67 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| be20eafd-0baa-41c7-9641-e2a9ebb76fde | Municipal Event 3f8b6ddf | EVENT | Event; status=SCHEDULED; starts=2026-08-21T16:00:00.000Z; ends=2026-08-21T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| c60501f1-95d9-4f92-9095-071f1978f316 | Municipal Event b86c56f1 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| d1c1796c-ac21-467f-aeec-8739d678ff15 | Municipal Event 72f3e98e | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=POINT; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| dde7d4aa-4b7f-496a-b3bf-cdd031052b72 | Municipal Event bbc96215 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=POINT; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| f7b573e9-7d95-4849-9beb-dc195984fbf7 | Municipal Event 64175fc4 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |
| fc30b0cf-ba52-4921-a626-ee1048e4bffd | Municipal Event 18b27ec3 | EVENT | Event; status=SCHEDULED; starts=2026-08-20T16:00:00.000Z; ends=2026-08-20T18:00:00.000Z; venue=Rådhusparken; location=57.7814,14.1618 | events (Events / Evenemang) | NO_ACTIVE_DOCUMENT |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:RADIUS_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:RADIUS_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:RADIUS_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:RADIUS_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:ENTITY_TYPE_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:ENTITY_TYPE_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:ENTITY_TYPE_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:ENTITY_TYPE_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:ENTITY_TYPE_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:ENTITY_TYPE_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:ENTITY_TYPE_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:ENTITY_TYPE_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; 7ece4261-a03b-49a2-ab28-d028e735d88d:TAXONOMY_FILTER; a86362ac-bbaf-43a9-9242-d59d41fab5a9:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

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
- Hard-excluded inventory: 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7:TAXONOMY_FILTER; 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb:TAXONOMY_FILTER; 45c5a3a1-4815-4088-a274-8857f1eddce3:TAXONOMY_FILTER; b430d455-8dec-4979-a6ad-cdde267e4fc7:TAXONOMY_FILTER; c7ac25bc-bb7c-4643-93db-f95cc821fa22:TAXONOMY_FILTER; f191df6d-9aeb-4230-a048-7c2f7aafc2fd:TAXONOMY_FILTER; 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK+TAXONOMY_FILTER

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

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
- Hard-excluded inventory: 165c346a-5f76-445c-86c5-a998aa52d209:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 358deb23-1f5f-4f51-a623-869e7ae27680:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 53a9c418-c852-4143-b656-b8b68451d732:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 62c912d4-da32-4fd1-b416-a2fd5af65085:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 63fef8df-9eb2-467c-af78-a5f93b83b55b:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 812d6f6d-2ccf-452a-b78f-b01c140173c3:EVENT_EXPIRED_AT_EVALUATION_CLOCK; 904f7b9e-bdbb-4374-8a39-68f3799a64bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a144190b-0c57-4f25-8129-744025b521bb:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a3211a3c-c4cb-4406-b016-19bebe014e17:EVENT_EXPIRED_AT_EVALUATION_CLOCK; a52a7610-7538-4be3-bddd-1fc6f6361e0a:EVENT_EXPIRED_AT_EVALUATION_CLOCK; af1008ba-5846-4c77-80d4-d8c1619e63d4:EVENT_EXPIRED_AT_EVALUATION_CLOCK; b29dd35d-ebb5-48bc-b8e8-74290bd02b7d:EVENT_EXPIRED_AT_EVALUATION_CLOCK; be20eafd-0baa-41c7-9641-e2a9ebb76fde:EVENT_EXPIRED_AT_EVALUATION_CLOCK; c60501f1-95d9-4f92-9095-071f1978f316:EVENT_EXPIRED_AT_EVALUATION_CLOCK; d1c1796c-ac21-467f-aeec-8739d678ff15:EVENT_EXPIRED_AT_EVALUATION_CLOCK; dde7d4aa-4b7f-496a-b3bf-cdd031052b72:EVENT_EXPIRED_AT_EVALUATION_CLOCK; f7b573e9-7d95-4849-9beb-dc195984fbf7:EVENT_EXPIRED_AT_EVALUATION_CLOCK; fc30b0cf-ba52-4921-a626-ee1048e4bffd:EVENT_EXPIRED_AT_EVALUATION_CLOCK

| CanonicalEntity ID | Name | Type | Human grade 0/1/2/3 |
|---|---|---|---|
| 22ed1d70-f4a0-4c13-b9f3-9c2e935297e7 | IF Hallby SOK: utegym* | PLACE | __ |
| 3dd7bd3e-e299-4554-93b3-0fc8e4062ecb | Evergreen Restaurang & Pizzeria | PLACE | __ |
| 45c5a3a1-4815-4088-a274-8857f1eddce3 | Explicit Indian Restaurant | PLACE | __ |
| 7ece4261-a03b-49a2-ab28-d028e735d88d | Rådhusparken | PLACE | __ |
| a86362ac-bbaf-43a9-9242-d59d41fab5a9 | Rådhusparken | PLACE | __ |
| b430d455-8dec-4979-a6ad-cdde267e4fc7 | Explicit Indian Restaurant | PLACE | __ |
| c7ac25bc-bb7c-4643-93db-f95cc821fa22 | Tandori palace | PLACE | __ |
| f191df6d-9aeb-4230-a048-7c2f7aafc2fd | Jönköpings OK: utegym* | PLACE | __ |

- Human rationale: __
- Judged by: __
- Judged at: __
