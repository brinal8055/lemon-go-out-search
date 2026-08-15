# EVAL-03 full DEV LEXICAL_ONLY

- Dataset: dataset-manifest.day4-postcoverage.v2 / c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0
- Judgments: judgments.day4-postcoverage.v1 / c3b9a4a49702fd519aa0e80b0cf0e8bcf1509e5a7df64f82349761f46e903eaa
- Config: eval-03-baseline.v1 / noncollapse-v1
- Clock: 2026-10-15T12:00:00Z
- Queries: 60
- Hit@1 / Hit@3 / MRR: {"value":0.5714285714285714,"evaluatedQueries":7} / {"value":1,"evaluatedQueries":7} / {"value":0.7857142857142857,"evaluatedQueries":7}
- Recall@20: {"value":0.37228810283789726,"evaluatedQueries":40}
- Precision@5 / NDCG@5: {"value":0.27499999999999997,"evaluatedQueries":40} / {"value":0.466213269536104,"evaluatedQueries":40}
- Zero results: 34 / 60
- Semantic participation: DISABLED_THROUGH_EXISTING_HANDLER_SEAM
- Semantic candidates: 0

## Families

| Family | Queries | Zero | Recall@20 | NDCG@5 |
|---|---:|---:|---|---|
| broad_concentration | 4 | 3 | {"value":0.3333333333333333,"evaluatedQueries":3} | {"value":0.3333333333333333,"evaluatedQueries":3} |
| broad_discovery | 4 | 3 | {"value":0.002551020408163265,"evaluatedQueries":4} | {"value":0.18893538018244652,"evaluatedQueries":4} |
| canonical_exact_same_name | 5 | 1 | {"value":1,"evaluatedQueries":3} | {"value":0.8769765845238192,"evaluatedQueries":3} |
| event_time | 6 | 6 | {"value":null,"evaluatedQueries":0} | {"value":null,"evaluatedQueries":0} |
| geo_scope_radius | 3 | 1 | {"value":0.2063348416289593,"evaluatedQueries":3} | {"value":0.6666666666666666,"evaluatedQueries":3} |
| prefix | 4 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.8154648767857288,"evaluatedQueries":2} |
| scarcity_duplicate_state | 3 | 2 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |
| semantic_occasion_language | 16 | 16 | {"value":0,"evaluatedQueries":14} | {"value":0,"evaluatedQueries":14} |
| taxonomy_parent_leaf | 7 | 0 | {"value":0.608902215285194,"evaluatedQueries":7} | {"value":1,"evaluatedQueries":7} |
| typo_transposition_accent_spacing | 5 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.8154648767857288,"evaluatedQueries":2} |
| verified_colliding_aliases | 3 | 0 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |

Content checksum: f11fc775fc6ea3a6dcbdeb6522f5983764555efa3381517aa796063af74ee39e
