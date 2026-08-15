# COVERAGE-01 real search smoke

- Generated: `2026-08-15T14:05:54.818Z`
- Selection: `QUERY_FAMILY_AND_RESULTING_LEGITIMATE_INVENTORY_ONLY`
- Tuning performed: `false`
- Report checksum: `b754e98d51f9a5dce13b286490036149c70b062020f6c61bb3b305c5d6eb438b`

## A. direct_real_place_name

- Query: `1988 Beijing`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `1 / true / 0 / 0`
- Top results: `[{"position":1,"id":"48ff5241-aa65-4fe7-b1da-62109fb13196","type":"PLACE","name":"1988 Beijing"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## B. prefix_typo_real_place

- Query: `188 Beijing`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `1 / true / 0 / 0`
- Top results: `[{"position":1,"id":"48ff5241-aa65-4fe7-b1da-62109fb13196","type":"PLACE","name":"1988 Beijing"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## C. broad_food_dining

- Query: `mat`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `10 / true / 0 / 0`
- Top results: `[{"position":1,"id":"7dfd3376-6a05-42a7-ad94-378bd1d52e6a","type":"PLACE","name":"Mat & Vänner"},{"position":2,"id":"5c4aac44-a65b-4806-93c6-e1097705bf8b","type":"PLACE","name":"Sajens Mat & Möten"},{"position":3,"id":"f3447316-4289-41d8-bedd-eb77ea1ba0cb","type":"PLACE","name":"Anna-Gretas Bar & Mat"},{"position":4,"id":"06c8ddcd-8f63-49d2-8165-1a145c6fb81a","type":"PLACE","name":"Brooklyn Burger Express"},{"position":5,"id":"0eba8c45-55b9-44fe-8a98-041599592080","type":"PLACE","name":"La Mia Pizzeria"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## D. active_leaf_multiple_entities

- Query: `(taxonomy/time filter only)`
- Locale / taxonomy: `en` / `nature-and-public-places`
- Results / semantic degraded / eligibility violations / duplicate IDs: `10 / true / 0 / 0`
- Top results: `[{"position":1,"id":"02c66e02-95bd-4bf5-94bb-71719fe8b337","type":"PLACE","name":"Fåglarödjan"},{"position":2,"id":"07754db0-9a1e-45bf-bef3-72913224c276","type":"PLACE","name":"Boerydsbergets naturreservat"},{"position":3,"id":"08f00d26-c360-4dd8-bedd-04c339820ad3","type":"PLACE","name":"Lasarettsparken"},{"position":4,"id":"0da88647-5735-40ce-8154-e78323db7f59","type":"PLACE","name":"Taberg"},{"position":5,"id":"0e7a3f70-e47f-48bc-be2a-ec6672302693","type":"PLACE","name":"Målabråten"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## E. broad_activity_discovery

- Query: `aktiviteter`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `10 / true / 0 / 0`
- Top results: `[{"position":1,"id":"02c66e02-95bd-4bf5-94bb-71719fe8b337","type":"PLACE","name":"Fåglarödjan"},{"position":2,"id":"2251b704-d6ff-4306-95ed-7402c0f8ce29","type":"EVENT","name":"Blödaren - filmvisning & regissörsbesök"},{"position":3,"id":"045efd6b-25d5-46a8-82f5-1e3eabef5a88","type":"PLACE","name":"Nordic Wellness"},{"position":4,"id":"6cea63b7-9f56-4bb5-87bc-bed1218b5228","type":"EVENT","name":"Järstorpsdagen"},{"position":5,"id":"04b6902a-1447-461d-bd79-a6adef0e85e5","type":"PLACE","name":"Jönköpings OK: utegym*"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## F. en_semantic_occasion

- Query: `cozy place for a date`
- Locale / taxonomy: `en` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `0 / true / 0 / 0`
- Top results: `[]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## G. sv_semantic_occasion

- Query: `mysigt ställe för en dejt`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `0 / true / 0 / 0`
- Top results: `[]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## H. event_time

- Query: `(taxonomy/time filter only)`
- Locale / taxonomy: `sv` / `events`
- Results / semantic degraded / eligibility violations / duplicate IDs: `3 / true / 0 / 0`
- Top results: `[{"position":1,"id":"2251b704-d6ff-4306-95ed-7402c0f8ce29","type":"EVENT","name":"Blödaren - filmvisning & regissörsbesök"},{"position":2,"id":"6cea63b7-9f56-4bb5-87bc-bed1218b5228","type":"EVENT","name":"Järstorpsdagen"},{"position":3,"id":"cc2d21c8-0e66-416c-98aa-9f68b7e899c3","type":"EVENT","name":"Järstorpsdagen"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## I. mixed_result_broad

- Query: `aktiviteter`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `10 / true / 0 / 0`
- Top results: `[{"position":1,"id":"02c66e02-95bd-4bf5-94bb-71719fe8b337","type":"PLACE","name":"Fåglarödjan"},{"position":2,"id":"2251b704-d6ff-4306-95ed-7402c0f8ce29","type":"EVENT","name":"Blödaren - filmvisning & regissörsbesök"},{"position":3,"id":"045efd6b-25d5-46a8-82f5-1e3eabef5a88","type":"PLACE","name":"Nordic Wellness"},{"position":4,"id":"6cea63b7-9f56-4bb5-87bc-bed1218b5228","type":"EVENT","name":"Järstorpsdagen"},{"position":5,"id":"04b6902a-1447-461d-bd79-a6adef0e85e5","type":"PLACE","name":"Jönköpings OK: utegym*"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`

## J. noncollapse_capable_broad

- Query: `restaurang`
- Locale / taxonomy: `sv` / `none`
- Results / semantic degraded / eligibility violations / duplicate IDs: `10 / true / 0 / 0`
- Top results: `[{"position":1,"id":"a7cbbcc3-0f2b-45b5-9e33-5d5e89226164","type":"PLACE","name":"Restaurang Munken"},{"position":2,"id":"d92272ac-d67c-4391-a88e-28971cf4327c","type":"PLACE","name":"Restaurang SOYA"},{"position":3,"id":"6b44ba50-5b33-4d94-a9f3-cd1780ac9169","type":"PLACE","name":"Restaurang Brahehus"},{"position":4,"id":"26a1586a-628b-4b2c-8164-d9626d975e23","type":"PLACE","name":"Restaurang Fjällstugan"},{"position":5,"id":"d4b5323a-d8be-45bd-846a-9e84f9743e5d","type":"PLACE","name":"Restaurang Dragon"}]`
- Diagnostics: `RESTRICTED_DIAGNOSTICS_NOT_REQUESTED_FOR_NON_EVALUATION_SMOKE`
