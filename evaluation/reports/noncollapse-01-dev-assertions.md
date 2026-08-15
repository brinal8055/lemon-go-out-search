# NONCOLLAPSE-01 bounded DEV assertions

- Run date: 2026-08-15
- Split: DEV only
- Corpus: `corpus.v1`
- Judgments: `judgments.day2.v1` (unchanged)
- Dataset manifest: `dataset-manifest.day2.v1` (unchanged)
- Search config: `noncollapse-v1`
- Scope: only `broad_discovery` and `broad_concentration` DEV records

| Query ID suffix | Applicability | Current results | Moved |
|---|---:|---:|---:|
| broad-discovery-01 | BROAD_TERM | 1 | 0 |
| broad-discovery-02 | BROAD_TERM | 0 | 0 |
| broad-discovery-03 | NOT_BROAD | 0 | 0 |
| broad-discovery-04 | BROAD_TERM | 0 | 0 |
| broad-concentration-01 | BROAD_TERM | 0 | 0 |
| broad-concentration-02 | NARROW_TAXONOMY | 0 | 0 |
| broad-concentration-03 | BROAD_TIME_DISCOVERY | 0 | 0 |
| broad-concentration-04 | BROAD_TERM | 0 | 0 |

`broad-concentration-02` correctly preserves explicit leaf-taxonomy semantics.
`broad-discovery-03` conservatively abstains because its residual text is not in
the pinned initial broad vocabulary; the config was not changed after inspection.

Outcome:

`NONCOLLAPSE_DEV_EFFECT_NOT_ASSESSABLE_DUE_TO_CURRENT_INVENTORY`

The only returned broad candidate had stable taxonomy grouping, unchanged base/final
rank, and `NO_CONCENTRATION`. Deterministic focused fixtures prove taxonomy, explicit
chain, linked Event-venue, relevance guard, protected exact, and exactly-once behavior.
No DEV judgment, manifest, inventory, threshold, or cap was modified.
