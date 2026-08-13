# Lemon Going-Out Search

BOOT-01 establishes the reproducible repository foundation for the four-day Jönköping trial. Product schema, ingestion, search, ranking, and source selection are intentionally deferred to their approved work packages.

## Prerequisites

- Node.js 22.13 or newer
- pnpm 11.19.0
- A Docker-compatible container runtime for the local Supabase stack
- Expo Go or an Android/iOS simulator for interactive mobile development

## Install and validate

```bash
pnpm install
cp .env.example .env.local
pnpm env:check
pnpm typecheck
pnpm lint
pnpm test
```

DB contract packages add focused local PostgreSQL suites. With the local stack running:

```bash
pnpm test:db -- db-01a
```

`pnpm env:check` intentionally fails with a list of missing variables until `EXPO_PUBLIC_LEMON_SEARCH_EDGE_URL` is configured. Edge and deployment checks are separate so mobile development never needs backend secrets:

```bash
pnpm env:check:edge
pnpm env:check:deploy
```

Never place `LEMON_SUPABASE_SECRET_KEY`, `LEMON_EMBEDDING_API_KEY`, a Supabase access token, or any database credential in Expo configuration or an `EXPO_PUBLIC_*` variable.

## Mobile shell

```bash
pnpm dev
```

The terminal prints an Expo QR code and simulator options. A noninteractive bundle smoke is available with:

```bash
pnpm mobile:export
```

The shell does not call a backend until EDGE-01 and MOB-01 implement the frozen public path.

## Local Supabase

The CLI is pinned as a project dependency; no global installation is required.

```bash
pnpm supabase --help
pnpm db:start:bootstrap
pnpm db:reset
pnpm db:stop
```

These commands require a running Docker-compatible container runtime. BOOT-01's `db:start:bootstrap` starts PostgreSQL only, because the frozen `api`-only PostgREST schema is created by DB-01A and must not be implemented early. After DB-01A, `pnpm db:start` starts the complete local stack. `supabase/seed.sql` is deliberately empty until the relevant database/reference tasks.

The Edge bootstrap shell can be served locally with `pnpm edge:serve`. It returns a safe `BOOTSTRAP_ONLY` response and implements no search behavior.

## Repository boundaries

- `apps/mobile`: Expo/React Native; public Edge API client only
- `supabase`: local config, ordered migrations, seed entrypoint, and Edge functions
- `packages/contracts`: frozen public request/response TypeScript types
- `packages/ingestion-domain`: ingestion orchestration boundary, behavior deferred to ING-01
- `packages/evaluation`: evaluation boundary, behavior deferred to EVAL-01
- Remaining `packages/*`: protected module seams, intentionally deferred
- `reference` and `evaluation`: versioned trial data locations, intentionally unpopulated in BOOT-01
- `tests`: unit, DB, API, relevance, and mobile-smoke test boundaries
- `scripts`: environment validation now; approved task runners later
- `docs/trial-review`: reviewer artifacts accumulated by later tasks

Dependency direction and trust boundaries are defined by the frozen Technical Specification. Do not import mobile, search configuration, or evaluation judgments into source adapters or ingestion-domain code.

## Baseline quality commands

```bash
pnpm typecheck
pnpm lint
pnpm test
```

These commands are the BOOT-01 baseline. Later work packages add their narrow database, integration, API, mobile, and evaluation commands without replacing the baseline.