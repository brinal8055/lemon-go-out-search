# Human judgment proposal — final-eval recovery DEV v2

**Status:** `PENDING_ENGINEER_APPROVAL`

- Dataset manifest: `dataset-manifest.final-eval-recovery.v1`
- Manifest checksum: `f51638a4ed7c699d48b08423c14d060a9d406a18235ca5f2efbab6b7d59ffa82`
- DEV inventory: `dev-inventory.final-eval-recovery.v1`
- Inventory checksum: `2b2246064bcdf1b76f77312c7f6bda573c9f724ee4d291704451c52f9ea76f37`
- DEV queries: 60/60
- Candidate/entity pairs: 15,735/15,735
- Second-pass changed pairs: 14
- SEALED/adversarial: not loaded or accessed
- Proposal JSON SHA-256: `c613ffa40663e53b8a54cafef0de9d5b2bd95e0ed2277fdb65d6f22b594daae5`

## Second-pass corrections

Only the paired indoor/rainy-day queries changed. The v1 rule was too broad for some culture/game entities.

| Entity | Old | New | Reason |
|---|---:|---:|---|
| Brunstorp Gård | 2 | 1 | Culture site is plausible, but current frozen evidence does not establish indoor status. |
| Rogberga Hembygdsgård | 2 | 1 | Culture site is plausible, but current frozen evidence does not establish indoor status. |
| Kruthuset | 2 | 1 | Culture site is plausible, but current frozen evidence does not establish indoor status. |
| Rasmus kvarn | 2 | 1 | Culture site is plausible, but current frozen evidence does not establish indoor status. |
| Grännabergets friluftsmuseum | 2 | 0 | Name explicitly identifies an open-air museum; violates the indoor intent. |
| Friluftsmuseet | 2 | 0 | Name explicitly identifies an open-air museum; violates the indoor intent. |
| Aventyrsminigolf | 3 | 1 | Activity is plausible, but current frozen evidence does not establish indoor status. |

The exact same corrections are applied to both EN and SV paired intents.

## Revised aggregate grade distribution

| Grade | Count |
|---:|---:|
| 0 | 10,397 |
| 1 | 3,243 |
| 2 | 1,341 |
| 3 | 754 |

## Decision

No other material grading discrepancy was found in the second-pass review. This remains a proposal until explicit engineer approval.
