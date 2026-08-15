# Task runners

BOOT-01 provides environment validation only. The approved queue adds these focused runners when their owning behavior exists:

- `ingest.ts` and `reparse-source-version.ts` — ING-01
- `rebuild-search-documents.ts` — DOC-01
- `embed-documents.ts` — EMBED-01B
- `pnpm expire:events` — EVENT-01 server-clock expiry/withholding and projection invalidation
- `revalidate-boundary.ts` — REF-01/DEPLOY-01
- `coverage-report.ts` — TAX-01/COVERAGE-01
- `evaluate.ts` — EVAL-01 onward
- `diagnose-search.ts` — DIAG-01
- `verify-deployment.ts` — DEPLOY-01
