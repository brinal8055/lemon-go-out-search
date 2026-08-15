# Post-Coverage Manual DEV Evaluation Commands

Run from the repository root. The hybrid commands require `VOYAGE_API_KEY`; `LEMON_LOCAL_DATABASE_URL` is optional when using the standard local Supabase database. Variable names only are listed here—never paste secret values into reports.

## Baseline / hybrid (60 DEV)

```sh
pnpm eval:dev:full -- --all --mode HYBRID --config eval-03-baseline.v1 --manifest evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json --manifest-checksum evaluation/manifests/dataset-manifest.day4-postcoverage.v2.sha256 --judgments evaluation/judgments/judgments.day4-postcoverage.v1.json --judgment-checksum evaluation/judgments/judgments.day4-postcoverage.v1.sha256 --output evaluation/reports/day4-postcoverage-v2/hybrid
```

## Lexical-only comparison (60 DEV)

```sh
pnpm eval:dev:full -- --all --mode LEXICAL_ONLY --config eval-03-baseline.v1 --manifest evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json --manifest-checksum evaluation/manifests/dataset-manifest.day4-postcoverage.v2.sha256 --judgments evaluation/judgments/judgments.day4-postcoverage.v1.json --judgment-checksum evaluation/judgments/judgments.day4-postcoverage.v1.sha256 --output evaluation/reports/day4-postcoverage-v2/lexical-only
```

## Deterministic hybrid rerun

```sh
pnpm eval:dev:full -- --all --mode HYBRID --config eval-03-baseline.v1 --manifest evaluation/manifests/dataset-manifest.day4-postcoverage.v2.json --manifest-checksum evaluation/manifests/dataset-manifest.day4-postcoverage.v2.sha256 --judgments evaluation/judgments/judgments.day4-postcoverage.v1.json --judgment-checksum evaluation/judgments/judgments.day4-postcoverage.v1.sha256 --output evaluation/reports/day4-postcoverage-v2/hybrid-rerun
```

Each output directory will contain `dev-result.v1.json`, `dev-result.v1.md`, and `operational.v1.json`. Compare the two hybrid `contentChecksum` values for determinism.

Paste back Known-item Hit@1/Hit@3/MRR; Recall@20; Precision@5/NDCG@5; EN, SV, and semantic-family metrics; lexical-only versus hybrid; Event/time; broad/non-collapse; zero-result rate; failure attribution; provider degradation; and all evaluation/content/input checksums.
