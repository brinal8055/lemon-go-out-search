# Lemon demo guide

This is a 3–5 minute founder demo of the hosted Jönköping trial. Start the app using the [README quick start](../../README.md#demo--quick-start), then switch the language control as noted below.

1. **Open (20 seconds).** “Lemon helps people discover places and Events around Jönköping in English or Swedish. It combines reliable name/category search with optional semantic discovery.”
2. **Direct name (30 seconds).** Search `Strömsholmsskogen`. It should return the exact Place first. Fallback: `Pizza & Kolgrill`.
3. **Category (30 seconds).** Select a visible category, or search `pizza`, to show multiple factual Place cards. Fallback: open another populated taxonomy category in the browser.
4. **English discovery (45 seconds).** Search `something casual`. This deployed demo-package regression query returns Places with semantic retrieval available. Fallback: `date night`.
5. **Swedish discovery (45 seconds).** Switch to Svenska and search `dejt`. Fallback: `något roligt`.
6. **Event boundary (20 seconds).** Do not promise a live positive Event result: the current-clock `this weekend` smoke returned no eligible Event on 2026-08-17. Explain that Events are separate, current-time-filtered records; use the existing [live Event evidence](../../evaluation/reports/final-eval-live-event-smoke/live-event-smoke.v1.md) for the previously observed truthful positive flow.
7. **Architecture (30 seconds).** “Expo calls one public Supabase Edge Function. The backend optionally calls Voyage for a query vector, then PostgreSQL combines exact, lexical, taxonomy, Event, geo, and exact-pgvector candidates with fixed RRF. If Voyage fails, deterministic search still works.”

The demonstration uses only public, demo-safe queries. It does not run held-out evaluation queries, and it does not claim the final internal submission gate has passed.
