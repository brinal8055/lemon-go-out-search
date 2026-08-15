# EVAL-03 full DEV HYBRID

- Dataset: dataset-manifest.day4-postcoverage.v2 / c0b025eec53f7f36ea1def046cef2b8873065491a0e63aca1091aa34028834d0
- Judgments: judgments.day4-postcoverage.v1 / c3b9a4a49702fd519aa0e80b0cf0e8bcf1509e5a7df64f82349761f46e903eaa
- Config: eval-03-baseline.v1 / noncollapse-v1
- Clock: 2026-10-15T12:00:00Z
- Queries: 60
- Hit@1 / Hit@3 / MRR: {"value":0.5714285714285714,"evaluatedQueries":7} / {"value":1,"evaluatedQueries":7} / {"value":0.7857142857142857,"evaluatedQueries":7}
- Recall@20: {"value":0.4153753789085865,"evaluatedQueries":40}
- Precision@5 / NDCG@5: {"value":0.605,"evaluatedQueries":40} / {"value":0.7715032039240972,"evaluatedQueries":40}
- Zero results: 19 / 60
- Semantic participation: ENABLED
- Semantic candidates: 395

## Families

| Family | Queries | Zero | Recall@20 | NDCG@5 |
|---|---:|---:|---|---|
| broad_concentration | 4 | 3 | {"value":0.3333333333333333,"evaluatedQueries":3} | {"value":0.3333333333333333,"evaluatedQueries":3} |
| broad_discovery | 4 | 1 | {"value":0.05268411712511091,"evaluatedQueries":4} | {"value":0.7037877621074919,"evaluatedQueries":4} |
| canonical_exact_same_name | 5 | 1 | {"value":1,"evaluatedQueries":3} | {"value":0.8769765845238192,"evaluatedQueries":3} |
| event_time | 6 | 6 | {"value":null,"evaluatedQueries":0} | {"value":null,"evaluatedQueries":0} |
| geo_scope_radius | 3 | 0 | {"value":0.28359979889391657,"evaluatedQueries":3} | {"value":1,"evaluatedQueries":3} |
| prefix | 4 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.8154648767857288,"evaluatedQueries":2} |
| scarcity_duplicate_state | 3 | 2 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |
| semantic_occasion_language | 16 | 4 | {"value":0.09222598458320741,"evaluatedQueries":14} | {"value":0.6537277034156818,"evaluatedQueries":14} |
| taxonomy_parent_leaf | 7 | 0 | {"value":0.608902215285194,"evaluatedQueries":7} | {"value":1,"evaluatedQueries":7} |
| typo_transposition_accent_spacing | 5 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.8154648767857288,"evaluatedQueries":2} |
| verified_colliding_aliases | 3 | 0 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |

Content checksum: c8c028d73e75b6a9dbd04e3be80e35f21d768caffbbf13acfb41dba5906b0680
