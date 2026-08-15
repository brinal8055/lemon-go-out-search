# COVERAGE-01 inventory audit — post-coverage.v1

- Generated: `2026-08-15T14:09:24.528Z`
- Frozen DEV clock: `2026-10-15T12:00:00Z`
- Report checksum: `d05ee77d5dfc6843bc1e34a0bc5a2743687a1c1019f7fbac4323b7de729dfba3`
- Overall: `{"sourceRecords":411,"currentSuccessfulEvidencePairs":411,"canonicalPlaces":407,"canonicalEvents":3,"publishedPlaces":392,"publishedEvents":3,"searchablePlaces":392,"searchableEvents":3,"activeSearchDocuments":395,"compatibleReadyEmbeddings":0}`
- Stage funnel: `[{"sourceKey":"JONKOPING_EVENT_CALENDAR","discovered":3,"parsed":3,"canonicalized":3,"published":3,"searchable":3},{"sourceKey":"JONKOPING_MUNICIPAL_UTEGYM","discovered":28,"parsed":28,"canonicalized":28,"published":26,"searchable":26},{"sourceKey":"OSM_OVERPASS","discovered":380,"parsed":380,"canonicalized":379,"published":366,"searchable":366}]`
- Leaf bands: `{"atLeastFive":7,"oneToFour":18,"zero":21}`
- Duplicate states: `[{"state":"OPEN","count":3}]`
- Event coverage: `{"fetchedSourceEventCount":27,"acceptedSingleOccurrenceCount":3,"invalidOrUnsupportedCountAcrossRuns":3,"publishedEventCount":3,"linkedEventPlaceCount":0,"standaloneEventCount":3,"activeEventSearchDocumentCount":3,"eligibleAtFrozenDevClock":0,"retainedSourceEventRecordCount":3,"unsupportedMultiOccurrenceCount":4,"invalidCount":1,"invalidOrUnsupportedCount":5,"sourceRunId":"7f3cca4e-6108-4b58-9f01-24a39d93c3d8"}`
- Embeddings: `[]`
- Data-quality audit: `{"fixtureShapedCanonicalNames":0,"fixtureSources":0,"sameNameSameLocationCanonicalGroups":0,"sameSourceIdentityDuplicateGroups":0}`

## Active taxonomy nodes

| Node ID | Slug | Parent | Places | Events | Active docs | Compatible READY | Sources | Supply status |
|---|---|---|---:|---:|---:|---:|---|---|
| 27ae3159-554d-5ebe-9aa1-45ef0cbf1fa1 | food-and-dining | ROOT | 185 | 0 | 185 | 0 | {"OSM_OVERPASS":185} | PARENT |
| 12aab5bf-b624-5e76-b306-38cf4daa8ea3 | casual | food-and-dining | 54 | 0 | 54 | 0 | {"OSM_OVERPASS":54} | PARENT |
| 4516fcf5-4c53-5f7e-8d47-bbd7a93542bf | chicken | casual | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| 5a61890b-e633-5ea0-93eb-f1a18863f0cd | poke | casual | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 63d2b4df-0fd9-5296-bab2-1cf5fd457cbc | pizza | casual | 29 | 0 | 29 | 0 | {"OSM_OVERPASS":29} | COMPLETE |
| 6ab10ddc-f9ef-5743-b44f-433d2d4884bf | food-truck | casual | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 6aea79ed-2599-5748-b2fe-a78e1aaeb78d | sushi | casual | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| acda530f-d654-5027-97b8-a5a912e4b752 | burgers | casual | 23 | 0 | 23 | 0 | {"OSM_OVERPASS":23} | COMPLETE |
| b48854d0-1ed6-5e1b-a101-83f74ad048c1 | sandwiches | casual | 1 | 0 | 1 | 0 | {"OSM_OVERPASS":1} | SUPPLY_CONSTRAINED |
| c519a006-ea39-509b-bde4-8dd92cf9505a | bowls | casual | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| f734c4f1-8cfa-5a5a-b4ee-4e65022cf21b | tacos | casual | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 15904283-fd01-5fc3-ac00-c42e62e8422e | dining | food-and-dining | 121 | 0 | 121 | 0 | {"OSM_OVERPASS":121} | PARENT |
| 18a33f0c-8408-59ce-9927-cceae1a4e4c1 | greek | dining | 1 | 0 | 1 | 0 | {"OSM_OVERPASS":1} | SUPPLY_CONSTRAINED |
| 27693ef7-a722-551d-ac89-bb8a7b1d5c97 | spanish | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 3a51d1cf-31c9-529f-b585-1102253dc735 | japanese | dining | 1 | 0 | 1 | 0 | {"OSM_OVERPASS":1} | SUPPLY_CONSTRAINED |
| 3ae33c42-f401-5989-be69-5ab9223aded2 | seafood | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 3dd38a02-124b-5b4e-aa96-3566ed575340 | mediterranean | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 3e7336f3-5dbc-51d8-884e-e677e7e1108c | french | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 493d4231-5caf-5300-a489-bdc6cf98de6c | indian | dining | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| 65c34f92-d992-50e7-aff2-f31fd1871345 | african | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 6ab01ce5-750f-51f3-b0a5-39b3398c66cd | mexican | dining | 1 | 0 | 1 | 0 | {"OSM_OVERPASS":1} | SUPPLY_CONSTRAINED |
| a1c93f96-63bb-5f5b-b929-bac7b2f133dd | american | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| a4e93169-34db-52d0-a474-f42045679a81 | chinese | dining | 1 | 0 | 1 | 0 | {"OSM_OVERPASS":1} | SUPPLY_CONSTRAINED |
| a7d01142-e735-51c9-bf56-b20250c527f1 | cuban | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| d43e33db-0ad3-575c-8514-d01ccf700587 | italian | dining | 3 | 0 | 3 | 0 | {"OSM_OVERPASS":3} | SUPPLY_CONSTRAINED |
| dcdb5cb7-4ebf-5b55-a867-f1f86b164c8c | steakhouse | dining | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| de848fba-6b54-551a-9fcb-e3b3c25b1d3b | thai | dining | 4 | 0 | 4 | 0 | {"OSM_OVERPASS":4} | SUPPLY_CONSTRAINED |
| f2acebc7-8b7e-5c22-9bb5-36a0e29ba4b8 | vegan-vegetarian | dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 89cc433a-423a-5eba-9d6a-17c9745d66d8 | cafes | food-and-dining | 34 | 0 | 34 | 0 | {"OSM_OVERPASS":34} | PARENT |
| 8187ab7f-f040-5594-9a14-b01871086788 | tea-house | cafes | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 92167dc5-bf32-5014-9d07-46f7c4f902dd | coffee-shop | cafes | 3 | 0 | 3 | 0 | {"OSM_OVERPASS":3} | SUPPLY_CONSTRAINED |
| 9bd7d2c9-205f-5bc3-8321-ab9c63a14294 | bubble-tea | cafes | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 9d3578bc-0108-5a05-90f0-ef1b717013c4 | dessert-cafe | cafes | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| b4176896-4ce9-5815-a445-30a1bd3272e9 | bakeries | food-and-dining | 4 | 0 | 4 | 0 | {"OSM_OVERPASS":4} | SUPPLY_CONSTRAINED |
| dc6dafd8-bb60-5989-a4f4-2b2ba86329ef | desserts | food-and-dining | 3 | 0 | 3 | 0 | {"OSM_OVERPASS":3} | SUPPLY_CONSTRAINED |
| fa1b8735-3c31-5c2c-9762-036a4c74fa06 | brunch | food-and-dining | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 2a046d43-20d8-5bb1-9378-e0f66c7d86c1 | drinks-and-nightlife | ROOT | 12 | 0 | 12 | 0 | {"OSM_OVERPASS":12} | PARENT |
| 14257b1c-8bed-5909-97c1-8f2fc6936135 | bars | drinks-and-nightlife | 10 | 0 | 10 | 0 | {"OSM_OVERPASS":10} | COMPLETE |
| 1a48f9c0-9247-554e-9fcf-07ea8707c8cd | breweries | drinks-and-nightlife | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 20c64458-9996-56ad-a8a6-0cad74c82506 | nightlife | drinks-and-nightlife | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| 687fb02d-72a2-55a7-af0f-aea3b992aff3 | cocktails | drinks-and-nightlife | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| d5056f41-1b30-5f6f-8eb0-d65cac76f86b | wine | drinks-and-nightlife | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 3751ea70-17c8-5ef0-ae44-d9dea192d29f | activities-and-experiences | ROOT | 195 | 3 | 198 | 0 | {"OSM_OVERPASS":169,"JONKOPING_EVENT_CALENDAR":3,"JONKOPING_MUNICIPAL_UTEGYM":26} | PARENT |
| 231bbce4-ee4e-552e-a34c-d5a08f0debb1 | classes | activities-and-experiences | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| 445e443a-1dcc-5479-8da2-fddaa1032c50 | malls-and-shopping-centers | activities-and-experiences | 4 | 0 | 4 | 0 | {"OSM_OVERPASS":4} | SUPPLY_CONSTRAINED |
| 4b839f2a-5da8-5aff-b66b-2c34e9715b26 | attractions | activities-and-experiences | 7 | 0 | 7 | 0 | {"OSM_OVERPASS":7} | COMPLETE |
| 6432bde9-17e2-5a04-92b3-9bf6f4589cf2 | culture | activities-and-experiences | 24 | 0 | 24 | 0 | {"OSM_OVERPASS":24} | COMPLETE |
| 90f47852-7a14-50d0-a8d0-a9440b62fee0 | tours | activities-and-experiences | 0 | 0 | 0 | 0 | {} | SUPPLY_CONSTRAINED |
| ab9ee0ec-2e7e-5f14-b2bb-15c66aaf979f | sports | activities-and-experiences | 64 | 0 | 64 | 0 | {"OSM_OVERPASS":38,"JONKOPING_MUNICIPAL_UTEGYM":26} | COMPLETE |
| e0aa09ec-717d-5e2e-8552-4dd33ba5b5fe | games | activities-and-experiences | 2 | 0 | 2 | 0 | {"OSM_OVERPASS":2} | SUPPLY_CONSTRAINED |
| e1a9cc86-214f-5967-b0a5-6925694b01d5 | events | activities-and-experiences | 0 | 3 | 3 | 0 | {"JONKOPING_EVENT_CALENDAR":3} | NEEDS_VALIDATION |
| f5978b3b-3c95-52fe-8c9c-bf5b6fae9d77 | nature-and-public-places | activities-and-experiences | 94 | 0 | 94 | 0 | {"OSM_OVERPASS":94} | COMPLETE |

## Publication blockers

- JONKOPING_MUNICIPAL_UTEGYM/layer-41/globalid/36055578-9494-4cbd-a1f8-58c0c4eb364a: Friaredalen* — MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, UNRESOLVED_DUPLICATE_REVIEW, NO_ACTIVE_SEARCH_DOCUMENT
- JONKOPING_MUNICIPAL_UTEGYM/layer-41/globalid/e9d68ebb-1b52-4d11-a9a7-60a5e5e23693: Esplanaden * — MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, UNRESOLVED_DUPLICATE_REVIEW, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1002552143: Pizzeria Dalvik — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1198637316: Solåsgrillen — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1759562302: Pizzeria Happy Time — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1819358547: Bergströms — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1819358587: Amalias Glasscafé — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/1819358605: Pir Kro — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/2271776523: Ali Baba Döner — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/2311060962: Pastabageriet — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/4382208596: Chop Chop Asian Express — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/node/560928398: Sushi bar — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/relation/10599711: Friaredalen — MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, UNRESOLVED_DUPLICATE_REVIEW, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/relation/7369244: Esplanaden — MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, UNRESOLVED_DUPLICATE_REVIEW, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/way/270350313: Ohio Burger — MISSING_SUPPORTED_TAXONOMY, MISSING_CANONICAL_NAME_PROVENANCE, MISSING_LOCATION_PROVENANCE, NO_ACTIVE_SEARCH_DOCUMENT
- OSM_OVERPASS/way/99536325: uncanonicalized — NOT_CANONICALIZED
