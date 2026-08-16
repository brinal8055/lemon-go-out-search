# EVAL-03 full DEV HYBRID

- Dataset: dataset-manifest.final-eval-recovery.v1 / f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82
- Judgments: judgments.final-eval-recovery.v1 / e604ba9bf0f04b500a37f2feb5cdc1a49d7b7031ef6055b917815ff60f5e0f70
- Config: eval-03-baseline.v1 / noncollapse-v1
- Clock: 2026-10-15T12:00:00Z
- Queries: 60
- Hit@1 / Hit@3 / MRR: {"value":0.5714285714285714,"evaluatedQueries":7} / {"value":1,"evaluatedQueries":7} / {"value":0.7142857142857143,"evaluatedQueries":7}
- Recall@20 / Recall@50: {"value":0.41469874073194823,"evaluatedQueries":40} / {"value":0.41469874073194823,"evaluatedQueries":40}
- Precision@5 / NDCG@5: {"value":0.5999999999999999,"evaluatedQueries":40} / {"value":0.7506957028179352,"evaluatedQueries":40}
- Zero results: 19 / 60
- Semantic participation: ENABLED
- Semantic candidates: 395

## Families

| Family | Queries | Zero | Recall@20 | NDCG@5 |
|---|---:|---:|---|---|
| broad_concentration | 4 | 3 | {"value":0.3333333333333333,"evaluatedQueries":3} | {"value":0.3333333333333333,"evaluatedQueries":3} |
| broad_discovery | 4 | 1 | {"value":0.05268411712511091,"evaluatedQueries":4} | {"value":0.7037877621074919,"evaluatedQueries":4} |
| canonical_exact_same_name | 5 | 1 | {"value":1,"evaluatedQueries":3} | {"value":0.8333333333333334,"evaluatedQueries":3} |
| event_time | 6 | 6 | {"value":null,"evaluatedQueries":0} | {"value":null,"evaluatedQueries":0} |
| geo_scope_radius | 3 | 0 | {"value":0.28359979889391657,"evaluatedQueries":3} | {"value":1,"evaluatedQueries":3} |
| prefix | 4 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.75,"evaluatedQueries":2} |
| scarcity_duplicate_state | 3 | 2 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |
| semantic_occasion_language | 16 | 4 | {"value":0.09029273264995548,"evaluatedQueries":14} | {"value":0.6223340760205313,"evaluatedQueries":14} |
| taxonomy_parent_leaf | 7 | 0 | {"value":0.608902215285194,"evaluatedQueries":7} | {"value":1,"evaluatedQueries":7} |
| typo_transposition_accent_spacing | 5 | 1 | {"value":1,"evaluatedQueries":2} | {"value":0.75,"evaluatedQueries":2} |
| verified_colliding_aliases | 3 | 0 | {"value":1,"evaluatedQueries":1} | {"value":1,"evaluatedQueries":1} |

Content checksum: 3e731eef22e3570d929fa2bcbd591b4056b3d70ea90984d20a48ea882359d3e9
