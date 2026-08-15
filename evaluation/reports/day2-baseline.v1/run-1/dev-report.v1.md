# Deterministic DEV evaluation

- Report: dev-evaluation-report.v1
- Corpus: corpus.v1 / bc2da4670e68532fe9b66c700157c3647c3a73181d460f21b4e443980d23242c
- Judgments: judgments.day2.v1 / 0b4df5f25445dd85749431c300ceb7a33670fa23c8cddb3213903f33a37c8b83
- Dataset: dataset-manifest.day2.v1 / 5ade651f358bafed92d51ac5b29651cbea5123958380263633e18385b5d730f0
- Search config: embed-01a-preflight-v1
- Evaluation clock: 2026-10-15T12:00:00Z
- Queries: 14
- Hit@1 / Hit@3 / MRR: NOT_EVALUATED / NOT_EVALUATED / NOT_EVALUATED
- Recall@20: 0.2333
- Precision@5 / NDCG@5: 0.1600 / 0.2832
- Zero results: 12 / 14
- Inventory unavailable: 6
- Recall@50: NOT_REQUIRED

## Families

| Family | Status | Queries | NDCG@5 |
|---|---:|---:|---:|
| broad_concentration | EVALUATED | 1 | 0.0000 |
| broad_discovery | EVALUATED | 2 | 0.2080 |
| canonical_exact_same_name | EVALUATED | 2 | NOT_EVALUATED |
| event_time | NOT_EVALUATED | 0 | NOT_EVALUATED |
| geo_scope_radius | EVALUATED | 1 | 0.0000 |
| prefix | EVALUATED | 1 | NOT_EVALUATED |
| scarcity_duplicate_state | EVALUATED | 1 | NOT_EVALUATED |
| semantic_occasion_language | NOT_EVALUATED | 0 | NOT_EVALUATED |
| taxonomy_parent_leaf | EVALUATED | 3 | 1.0000 |
| typo_transposition_accent_spacing | EVALUATED | 2 | NOT_EVALUATED |
| verified_colliding_aliases | EVALUATED | 1 | NOT_EVALUATED |

## Languages

| Language | Status | Queries | NDCG@5 |
|---|---:|---:|---:|
| en | EVALUATED | 4 | 0.2080 |
| language-neutral | EVALUATED | 2 | NOT_EVALUATED |
| mixed | EVALUATED | 2 | NOT_EVALUATED |
| sv | EVALUATED | 6 | 0.3333 |

## Queries

| Query ID | Top result IDs | Relevant ranks | Product outcome | Ranking assessment | Failure attribution |
|---|---|---|---|---|---|
| eval-v1-dev-broad-concentration-04 |  | 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6:g1@MISS, 2e3c76fe-4b69-4070-86fb-e8d85f248f30:g1@MISS, 87c64b6e-80ee-497e-ab0a-fb04079b396f:g1@MISS, 911ac4cb-a19c-490d-beef-0062cd7fdb1a:g1@MISS, a1e519ee-93e3-429c-b51b-44d7986f9d22:g1@MISS, bf462ec4-f4b5-4781-a559-e9f260ee756c:g1@MISS | SATISFIED_OR_NOT_ASSERTED | EVALUATED | CANDIDATE_RETRIEVAL |
| eval-v1-dev-broad-discovery-01 | 911ac4cb-a19c-490d-beef-0062cd7fdb1a | 87c64b6e-80ee-497e-ab0a-fb04079b396f:g2@MISS, 911ac4cb-a19c-490d-beef-0062cd7fdb1a:g2@1, a1e519ee-93e3-429c-b51b-44d7986f9d22:g2@MISS, 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6:g1@MISS, 2e3c76fe-4b69-4070-86fb-e8d85f248f30:g1@MISS, bf462ec4-f4b5-4781-a559-e9f260ee756c:g1@MISS | SATISFIED_OR_NOT_ASSERTED | EVALUATED | CANDIDATE_RETRIEVAL |
| eval-v1-dev-broad-discovery-02 |  | 87c64b6e-80ee-497e-ab0a-fb04079b396f:g2@MISS, 911ac4cb-a19c-490d-beef-0062cd7fdb1a:g2@MISS, a1e519ee-93e3-429c-b51b-44d7986f9d22:g2@MISS, 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6:g1@MISS, 2e3c76fe-4b69-4070-86fb-e8d85f248f30:g1@MISS, bf462ec4-f4b5-4781-a559-e9f260ee756c:g1@MISS | SATISFIED_OR_NOT_ASSERTED | EVALUATED | CANDIDATE_RETRIEVAL |
| eval-v1-dev-canonical-exact-same-name-01 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |
| eval-v1-dev-canonical-exact-same-name-04 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |
| eval-v1-dev-geo-scope-radius-02 |  | 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6:g1@MISS, 2e3c76fe-4b69-4070-86fb-e8d85f248f30:g1@MISS, bf462ec4-f4b5-4781-a559-e9f260ee756c:g1@MISS | SATISFIED_OR_NOT_ASSERTED | EVALUATED | CANDIDATE_RETRIEVAL |
| eval-v1-dev-prefix-04 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |
| eval-v1-dev-scarcity-duplicate-state-01 |  |  | SATISFIED_OR_NOT_ASSERTED | EVALUATED | NONE |
| eval-v1-dev-taxonomy-parent-leaf-01 |  |  | SATISFIED_OR_NOT_ASSERTED | EVALUATED | NONE |
| eval-v1-dev-taxonomy-parent-leaf-04 | 2e3c76fe-4b69-4070-86fb-e8d85f248f30, 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6, bf462ec4-f4b5-4781-a559-e9f260ee756c | 17b30a56-fef9-4a2d-b2c6-ea5bfd153bd6:g3@2, 2e3c76fe-4b69-4070-86fb-e8d85f248f30:g3@1, bf462ec4-f4b5-4781-a559-e9f260ee756c:g3@3 | SATISFIED_OR_NOT_ASSERTED | EVALUATED | NONE |
| eval-v1-dev-taxonomy-parent-leaf-07 |  |  | SATISFIED_OR_NOT_ASSERTED | EVALUATED | NONE |
| eval-v1-dev-typo-transposition-accent-spacing-03 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |
| eval-v1-dev-typo-transposition-accent-spacing-04 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |
| eval-v1-dev-verified-colliding-aliases-02 |  |  | QUERY_UNSATISFIED | NOT_EVALUATED | INVENTORY |

## Failure attribution

| Reason | Count |
|---|---:|
| CANDIDATE_RETRIEVAL | 4 |
| INVENTORY | 6 |

Event, semantic, RRF, and non-collapse stages: NOT_IMPLEMENTED.
Content checksum: bae1ad696df6d6a868e51254285444d109a55d3f4a7f8c0fa3d863daf3ef34f7
