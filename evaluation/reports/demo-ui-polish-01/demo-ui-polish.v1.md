# DEMO-UI-POLISH-01 — Mobile UI polish

## Scope

- Changed `apps/mobile/App.tsx`, `apps/mobile/src/localization.ts`, the task-owned mobile test, and the supplied lemon logo asset.
- Search states and result cards now render directly after the search control. The category browser follows them and collapses after category selection.
- The three active top-level taxonomy categories are initially compact; opening one reveals only that section's descendants.
- English/Svenska is a single selected-state segmented control. The query remains literal and is never translated.
- Search, category, retry, and language controls have touch, pressed, disabled, and selected states. Place and Event cards are visibly distinct while showing only accepted API facts.

## Boundaries

- Dependencies added: none.
- Backend/search, taxonomy, evaluation, and Expo SDK configuration changes: none.
- Physical-iPhone validation remains required after this commit.

## Validation

- `pnpm --filter @lemon/mobile exec expo install --check`: PASS.
- `pnpm dlx expo-doctor@latest`: PASS (18/18 checks).
- `pnpm --filter @lemon/mobile typecheck`: PASS.
- `pnpm --filter @lemon/mobile test`: PASS (25 tests).
- Focused ESLint, committed-secret scan, and `git diff --check`: PASS.
- Expo Go Metro LAN startup and iOS bundle: PASS (704 modules).
