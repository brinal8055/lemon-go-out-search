# COVERAGE-01 source-run evidence

- Scope: full Jönköping municipality.
- Acquisition: approved bounded adapters only; no evaluation-target acquisition.
- OSM/Overpass: `DELTA_ONLY` run `107fde8f-3bba-4abf-99c2-d6384b10edcc` succeeded; 385 remote observations, 379 inside the authoritative boundary, 6 outside, 379 valid, 77 new, 302 unchanged.
- Municipal utegym: `DELTA_ONLY` run `827ea9be-19fc-4c55-bfe1-14c575d87055` succeeded; 28 fetched/in-boundary/valid and 28 new.
- Municipal Events: run `7f3cca4e-6108-4b58-9f01-24a39d93c3d8` was partial under `DELTA_ONLY` / `EXTRACTED_FIELDS_ONLY`; 27 fetched, 3 accepted single occurrences, 4 unsupported multi-occurrences, 1 invalid, 3 published standalone Events, 0 linked Places.
- Frozen DEV clock Event supply: 0; `EVENT_DEV_REAL_INVENTORY_UNAVAILABLE_AT_FROZEN_CLOCK`.
- Embeddings: `EMBEDDING_COVERAGE_PARTIAL`; READY/FAILED/STALE `0/0/0` across 395 eligible active SearchDocuments. External provider payload egress was not approved, so no attempt rows were created or mutated.
- Search tuning: none.
