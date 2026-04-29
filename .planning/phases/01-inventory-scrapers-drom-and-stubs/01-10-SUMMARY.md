---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 10
subsystem: scrapers/drom
tags: [gap-closure, cursor, resume, correctness, CR-01, CR-02, CR-03]
gap_closure: true
requires: [07]
provides:
  - "Sort-before-compare cursor logic for drom orchestrator"
  - "Loud-throw guard when cursor brand/model is absent from current catalog"
affects:
  - server/scrapers/drom/index.ts
tech-stack:
  added: []
  patterns:
    - "DOM-order parser output → orchestrator-owned alphabetic sort → cursor lexicographic comparison"
    - "findIndex === -1 → throw Error (no silent restart)"
key-files:
  created: []
  modified:
    - server/scrapers/drom/index.ts
decisions:
  - "Parsers continue to return DOM-traversal order; the orchestrator owns the alphabetic sort immediately before cursor index calculation. Avoids touching `parse-brand-index.ts` and `parse-model-list.ts` (D-15 cursor contract preserved)."
  - "On missing cursor brand/model, throw a quoted-slug Error instead of silently restarting from index 0. The error propagates to the existing top-level catch which writes a partial report.json with final_status='error' (CR-01/CR-02 mitigation per 01-REVIEW.md)."
  - "Use `>=` on `lastModelSlug` (inclusive) so the cursored model is re-scraped on resume; plan 01-12 stacks on top by pinning `startFromModelIndex = 0` for the cursored brand to enforce full brand re-scrape (CR-04 contract)."
metrics:
  duration: "~7 minutes"
  completed: 2026-04-29
requirements: [SCRAPE-05]
---

# Phase 1 Plan 10: Cursor Correctness (CR-01/02/03 Fix) Summary

Sort drom orchestrator's brand and model arrays alphabetically immediately before the cursor lexicographic comparison, and replace both `Math.max(0, findIndex(...))` silent-fallback positioners with explicit `findIndex === -1 → throw` guards. Single-file change, no parser/contract/schema modifications.

## Objective

Close the three cursor-correctness BLOCKERs identified in `01-REVIEW.md`:

- **CR-01** — Cursor resume restarts entire catalog when `lastBrandSlug` is no longer in the (post-whitelist) brand list.
- **CR-02** — Cursor model-resume restarts entire brand when `lastModelSlug` has no equal-or-greater successor.
- **CR-03** — Cursor logic assumed alphabetic order, but `parseBrandIndex` / `parseModelList` return DOM-traversal order; comparisons mis-skipped when DOM ≠ alphabetic.

All three derive from the same root cause (`Math.max(0, findIndex(...))` over a DOM-ordered array used as a lexicographic cursor base), so a single coherent change closes all three.

## Tasks Executed

### Task 1: Sort brands and models alphabetically and replace `Math.max(0, findIndex)` with -1-throw guards

- **Status:** completed
- **Commit:** `ca1f9c5`
- **File modified:** `server/scrapers/drom/index.ts` (+49 / -18)
- **Verification:** all five plan-level checks pass:
  - `grep -nE 'Math\.max\(0,\s*(brands|models)\.findIndex' server/scrapers/drom/index.ts` → 0 matches (exit 1).
  - `grep -c localeCompare server/scrapers/drom/index.ts` → 2.
  - `grep -c "Cursor.lastBrandSlug=" server/scrapers/drom/index.ts` → 1.
  - `grep -c "Cursor.lastModelSlug=" server/scrapers/drom/index.ts` → 1.
  - `pnpm typecheck:server` → exit 0.
  - `pnpm vitest run` → 11 files / 87 tests pass (zero regression).

## Exact Lines Replaced

### Brand block (formerly lines 232–249)

The whitelist filter is preserved; the post-filter array is renamed `filteredBrands`. A new `brands` constant is the alphabetic sort of `filteredBrands` via `localeCompare`. The cursor positioner is rewritten as an explicit `if (cursor) { ... }` block with a `findIndex === -1 → throw` guard.

### Model block (formerly lines 256–268)

`parseModelList` output is captured as `parsedModels`. A new `models` constant is the alphabetic sort via `localeCompare`. The model positioner is rewritten with a `findIndex === -1 → throw` guard, using `>=` on `lastModelSlug` so the cursored model is included.

## New Throw Messages (verbatim)

```
Cursor.lastBrandSlug='${cursor.lastBrandSlug}' not present in current brand list (removed from drom or filtered by DROM_BRAND_WHITELIST). Refusing silent restart; delete .cursor.json explicitly to start over.
```

```
Cursor.lastModelSlug='${cursor.lastModelSlug}' not present in current model list for brand '${brand.brand_slug}'. Refusing silent restart of brand; delete .cursor.json explicitly to start over.
```

These propagate to the existing top-level `try/catch` in `drom.run`, which writes a partial `report.json` with `final_status='error'` and returns `{ status: 'error', ... }`. The operator sees the bad slug verbatim in the error and either fixes / deletes `.cursor.json` explicitly.

## What Was NOT Modified

Confirmation per plan instructions:

- `server/scrapers/drom/parse-brand-index.ts` — **untouched**. Parser continues to return DOM-traversal order.
- `server/scrapers/drom/parse-model-list.ts` — **untouched**. Parser continues to return DOM-traversal order.
- `server/scrapers/shared/cursor.ts` — **untouched**. Cursor schema, `readCursor`, `writeCursor`, `deleteCursor` unchanged. WR-04 hardening is plan 01-11.
- `server/scrapers/shared/types.ts` — **untouched**.
- `inheritFromPrevCurrent` (lines 86–164) — **untouched**. The d3bad88 incremental-snapshot path is orthogonal.
- Brand-aliases / `mergeAliases` call site — **untouched**. CR-04 is plan 01-12.
- Image-fetch / image-paths logic — **untouched**. CR-05/CR-06 are plan 01-14.
- Existing tests — **untouched**. Resume-path integration tests are plan 01-13.

## Behavior Preserved by the Change

The two existing integration tests in `server/tests/drom-integration.test.ts` continue to pass without modification:

- **Test 1 (`runs end-to-end against fixture catalog`)**: 1 brand × 2 models `[x5, x3]`. The new sort reorders models to `[x3, x5]`. Test does not assert iteration order; `brand-aliases.json` assertions use `expect.objectContaining` and the records key by `brand_slug:model_slug:generation`. Both still satisfied.
- **Test 2 (`preserves inherited records and images from prev current/`)**: 1 model only — sort is a no-op.

## Cross-Plan Notes

- **Plan 01-11** hardens `readCursor` (zod-shape validation; distinguish ENOENT from corrupt JSON) — closes WR-04.
- **Plan 01-12** stacks on this plan: it additionally pins `startFromModelIndex = 0` for the cursored brand so the entire brand is re-scraped from scratch (the explicit CR-04 "re-scrape cursored brand" contract). The `>=` comparison introduced here is forward-compatible with that change — even if 01-12 never lands, the cursored model is included rather than skipped.
- **Plan 01-13** adds resume-path integration tests (seeded `.cursor.json`, non-alphabetic DOM order, missing-cursor-throw assertions). This plan is verified by code-reading + grep + non-regression of existing tests; integration coverage is intentionally deferred.
- **Plan 01-14** addresses CR-05 / CR-06 (image-paths desync, image-fetch failure abort threshold).

## Deviations from Plan

None — plan executed exactly as written. The two replacement blocks match the plan's `<action>` Step 1 and Step 2 verbatim, including identifiers (`filteredBrands`, `parsedModels`), comments, and indentation.

## Self-Check: PASSED

- File `server/scrapers/drom/index.ts` exists and contains both `localeCompare` calls and both throw messages.
- Commit `ca1f9c5` is present in git log.
- All acceptance-criteria greps and the full vitest suite executed and passed before the commit was made.
