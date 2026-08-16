# LOCAL_TEST and FINAL_EVAL runbook

`LOCAL_TEST` is the local Supabase/Docker database. Fixture ingestion, pgTAP,
regression suites, and database reset are permitted only here. The shared guard
requires `DB_TARGET=local-test`, `ALLOW_DESTRUCTIVE_DB_TESTS=1`, and an explicit
local hostname. Put these values in the gitignored `.env.test` file:

```dotenv
DB_TARGET=local-test
ALLOW_DESTRUCTIVE_DB_TESTS=1
LEMON_LOCAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Use `pnpm db:reset` and `pnpm test:db -- <suite>`. Both load `.env.test` and
terminate with `REFUSING_DESTRUCTIVE_DATABASE_OPERATION` unless all local
conditions pass. Other fixture-mutating commands must be run with the same two
variables and a local URL. Repository-supported reset always passes `--local`;
there is no linked/remote reset or seed workflow.

> REGRESSION / FIXTURE / DB RESET SUITES MUST NEVER RUN AGAINST FINAL_EVAL.

`FINAL_EVAL` is one hosted Supabase project for real corpus data only. Put its
credentials in gitignored `.env.final-eval`, and Edge runtime values in
gitignored `supabase/functions/.env.local`. Never put database, service-role,
admin, access-token, or Voyage secrets in an `EXPO_PUBLIC_*` variable.

```dotenv
DB_TARGET=final-eval
SUPABASE_PROJECT_ID=<hosted-project-ref>
SUPABASE_ACCESS_TOKEN=
SUPABASE_DB_PASSWORD=
LEMON_FINAL_EVAL_DATABASE_URL=<direct-or-pooler-postgres-url>
ALLOW_FINAL_EVAL_WRITES=1
FINAL_EVAL_WRITE_OPERATION=migration-deploy
```

The remote-write guard additionally verifies that the database hostname or
pooler username identifies `SUPABASE_PROJECT_ID`. Supported named write
acknowledgements are `migration-deploy`, `corpus-recovery-a`,
`corpus-recovery-b`, and `edge-deploy`. Set exactly one only for its explicit
workflow. It cannot enable destructive tests, resets, or fixtures.

Before any hosted write, link the CLI deliberately with `pnpm exec supabase link
--project-ref <ref>`, then verify `supabase/.temp/project-ref` equals the intended
project. Set `FINAL_EVAL_WRITE_OPERATION=migration-deploy`, inspect and dry-run
with `pnpm final-eval:migrations:dry-run`, then apply only accepted migrations
with `pnpm final-eval:migrations:deploy`; neither wrapper runs `supabase/seed.sql`.
Set `FINAL_EVAL_WRITE_OPERATION=edge-deploy` and deploy the accepted function
with `pnpm final-eval:edge:deploy`. The wrapper configures `SUPABASE_URL`,
`LEMON_SUPABASE_SECRET_KEY`, and an optional `VOYAGE_API_KEY` from
`supabase/functions/.env.local` through the Supabase secret store before deploy.
Run only connectivity, migration/extension, authorization,
RPC, Edge health, and empty/small-result canaries remotely—never normal tests.

Every database credential consumer is intentionally scoped as follows:

- `LEMON_LOCAL_DATABASE_URL`: local ingestion, publication, taxonomy, dedupe,
  provenance, SearchDocument, embedding, diagnostics, evaluation, pgTAP, and
  local Edge/mobile smoke tooling.
- Supabase CLI local credentials: `scripts/test-security.mjs` obtains ephemeral
  local URL/publishable/backend values from `supabase status -o env`.
- `SUPABASE_URL` and `LEMON_SUPABASE_SECRET_KEY`: Edge Function only.
- `VOYAGE_API_KEY`: Edge semantic calls and explicit offline embedding/evaluation
  commands only.
- `EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL`: the only mobile-exposed value.
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD`, and
  `LEMON_FINAL_EVAL_DATABASE_URL`: hosted deployment/checkpoint tooling only.

The concrete credential reads are: `apps/mobile/App.tsx` (public Edge URL),
`supabase/functions/search/index.ts` (Edge Supabase/Voyage secrets),
`scripts/check-env.mjs` (presence validation), `scripts/test-security.mjs`
(ephemeral local CLI credentials), the `final-eval-*` scripts (hosted deployment
and backup credentials), `packages/embedding/src/{cli,generate-cli}.ts` and
`scripts/{eval03-full-dev,postcov-semantic-probe}.ts` (Voyage), and the local DB
CLIs under `packages/{ingestion-domain,source-adapters,search-documents,
embedding,evaluation}/src` plus evaluation scripts (local PostgreSQL URL).

Logical checkpoints preserve schema and data in private custom-format dumps.
After Recovery-A, Recovery-B/embedding completion, and immediately before the
SEALED freeze, set `ALLOW_FINAL_EVAL_BACKUP=1` and run respectively:

```text
pnpm final-eval:checkpoint -- post-recovery-a
pnpm final-eval:checkpoint -- post-recovery-b
pnpm final-eval:checkpoint -- pre-sealed-freeze
```

Dumps and SHA-256 sidecars are written under gitignored
`private/backups/final-eval/`. Do not create an empty pre-recovery checkpoint.
Run `pnpm env:scan-secrets` before committing.
