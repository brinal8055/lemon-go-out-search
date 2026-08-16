# FINAL-EVAL-LIVE-EVENT-SMOKE v1

- Actual Europe/Stockholm clock used: `2026-08-16 15:12:29` (`2026-08-16T13:12:29.241Z`).
- Current published Event count: `3`.
- `25b23a40-cf26-4cd3-91f1-c8bc93215681` — Järstorpsdagen; `2026-08-16T09:00:00Z` to `2026-08-16T13:00:00Z`; `SCHEDULED`; Järstorps hembygdsgård; expired/ineligible at the actual clock.
- `e52a7016-dbdf-40b1-a5ed-ff7fa8b2a893` — Järstorpsdagen; `2026-08-16T09:00:00Z` to `2026-08-16T13:00:00Z`; `SCHEDULED`; Järstorps hembygdsgård; expired/ineligible at the actual clock.
- `580a3943-a0ca-4d51-beaa-97b5aa691c33` — Dans, musik och aktiviteter för hela familjen; `2026-08-16T12:00:00Z` to `2026-08-16T17:00:00Z`; `SCHEDULED`; KFUM Gården Vidablick; eligible at the actual clock.
- `LIVE_TODAY_EVENT_AVAILABLE = NO`: `today` is not a supported parser expression.
- Positive query: `this weekend` (paired Swedish check: `i helgen`); it truthfully includes the eligible Saturday Event.
- Positive deployed result: both client-equivalent Edge requests returned HTTP `200`, one result, and the expected Event ID/title/start/end/status; `api.search_v1` was reached through Edge.
- Negative assertion: real-clock `tomorrow` returned HTTP `200` with zero Event results; the currently eligible Event is outside its half-open interval and was not eligible.
- Product clock source: the deployed Edge request has no clock override; its handler defaults to `new Date()` and parses relative time in `Europe/Stockholm`.
- DEV clock source: injected `2026-10-15T12:00:00Z`; it is used only by the DEV evaluator, not the deployed request path.
- `NO_FROZEN_CLOCK_LEAK_IN_PRODUCT_PATH = TRUE`: the August 16 Event appeared for the live weekend request; it would be expired/outside the October 15 DEV-clock weekend.
- Fixture/corpus/config/search mutation: none. SEALED/adversarial: not accessed.
