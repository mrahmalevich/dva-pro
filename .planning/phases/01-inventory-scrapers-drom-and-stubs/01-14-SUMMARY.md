---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 14
subsystem: scrapers
tags: [drom, scrapers, gap-closure, CR-05, CR-06, error-classification, image-failure-rate]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: "drom orchestrator (plans 02/07/10/12), shared/types ReportSummary, parse-generation-page extractor, drom integration test harness"
provides:
  - "CR-05 closed: image_paths in models.json reflects ONLY images on disk (orphan paths cleared on fetch failure)"
  - "CR-06 closed: image-fetch failures no longer count toward the 10% DOM-regression abort; bounded image-fetch gate (rate > 20% AND attempted >= 20)"
  - "ReportSummary.errors[] gains a kind discriminator: 'parse' | 'image' | 'orchestrator' | 'inherit'"
  - "ReportSummary gains images_failed and image_failure_rate counters"
  - "GenerationPageContext.heroImageUrl?: single-source-of-truth pipeline from parseGenerationList → parseGenerationPage"
  - "Counter-drift integration test pins both gate denominators (parse-only for the 10% gate, image-only for the 20% gate)"
affects:
  - "Phase 1 plan 15 (HTML viewer + SCHEMA.md docs sweep — picks up the new report.json fields)"
  - "Phase 4 (importer can trust every image_paths entry corresponds to a WebP on disk)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated union via 'kind' field on push-pull error logs (4 distinct kinds, all required at compile time)"
    - "Self-consistent on-disk artifacts: in-memory record mutation reconciled with downstream filesystem state before serialization"
    - "Bounded threshold gates with floor (e.g. 'rate > X% AND attempted >= N') instead of ratio-only"

key-files:
  created: []
  modified:
    - "server/scrapers/shared/types.ts"
    - "server/scrapers/drom/parse-generation-page.ts"
    - "server/scrapers/drom/index.ts"
    - "server/tests/drom-parsers.test.ts"
    - "server/tests/drom-integration.test.ts"

key-decisions:
  - "ReportSummary.errors[].kind is REQUIRED (not optional) so TS surfaces every push site at compile time"
  - "'inherit' is a kind member alongside parse/image/orchestrator — covers BOTH push sites in inheritFromPrevCurrent (models.json read failure + per-image copyFile failure)"
  - "Image-fetch gate uses bounded threshold (rate > 0.20 AND attempted >= 20) to avoid aborting on a single early CDN hiccup with a small denominator"
  - "image_failure_rate is rounded to 4 decimal places (Math.round(rate * 10000) / 10000) for stable diff in report.json"
  - "extractHeroImageUrl stays exported so drom-parsers tests can derive heroImageUrl from the fixture without coupling to a hard-coded URL"
  - "On image-fetch failure the orchestrator clears record.image_paths to [] BEFORE serialization — guarantees Phase 4 importer sees no orphan paths"

patterns-established:
  - "Error classification: every report.errors.push site declares its kind, and downstream gates filter by kind to avoid counter-drift"
  - "Gate denominators are typed: parse-gate only counts parse errors, image-gate only counts image fetches"
  - "Shared parser/orchestrator data passed once via ctx (CR-05) — avoids re-parsing the same html in two places"

requirements-completed: [SCRAPE-05]

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 01 Plan 14: Image-Path Reconciliation + Error Kind Classification Summary

**Closes CR-05 (image_paths desync between list parser and page parser) and CR-06 (image-fetch failures aborting otherwise-clean drom runs) by introducing a discriminated `kind` field on every error push and splitting the abort thresholds per error category.**

## Performance

- **Duration:** ~6 min wall-clock (5 atomic task commits, no rework)
- **Tasks:** 5/5 (Tasks 1–4 type/code/tests, Task 5 counter-drift integration test)
- **Files modified:** 5

## Accomplishments

- **CR-05 closed.** `image_paths` in `current/models.json` now reflects ONLY images that successfully landed on disk. The orchestrator clears `record.image_paths = []` on download failure; `parseGenerationPage` derives `image_paths` from `ctx.heroImageUrl` (passed once by the orchestrator) instead of re-parsing the html.
- **CR-06 closed.** The 10% drop-out gate counts ONLY parse errors (DOM-regression signal). Image-fetch errors get a separate, bounded gate: abort only when `images_failed / images_attempted > 0.20` AND `images_attempted >= 20`. Below that, the run completes and surfaces `image_failure_rate` in `report.json` for operator review.
- **Error classification.** Every `report.errors.push` site now carries a `kind` discriminator (`'parse' | 'image' | 'orchestrator' | 'inherit'`), required at the type level. Inherits the existing 5 push sites (2 in `inheritFromPrevCurrent`, 1 image, 1 parse, 1 orchestrator).
- **Counter-drift guard test.** New integration test seeds 12 brands so the parse-gate denominator is large, throws ONE parse error and ONE image error in the same run, and asserts the gate denominators do not cross-contaminate.
- **TypeScript clean; full vitest suite green (97 tests, was 96).**

## Task Commits

Each task was committed atomically (no `--no-verify` was needed for hooks; the orchestrator passed `--no-verify` per the worktree contract):

1. **Task 1: Extend ReportSummary types** — `b0bcea2` (feat)
2. **Task 2: Add heroImageUrl to GenerationPageContext** — `5e1582c` (feat)
3. **Task 3: Wire heroImageUrl + classify errors + split abort gates** — `971b9e4` (feat)
4. **Task 4: Update drom-parsers test for ctx.heroImageUrl** — `f2aab05` (test)
5. **Task 5: Counter-drift integration test** — `68d334a` (test)

## Files Modified

- **`server/scrapers/shared/types.ts`** — `ReportSummary.errors[]` element widened to `{url, message, kind: 'parse' | 'image' | 'orchestrator' | 'inherit'}` (kind required); two new fields `images_failed: number` and `image_failure_rate: number`.
- **`server/scrapers/drom/parse-generation-page.ts`** — `GenerationPageContext` gains optional `heroImageUrl?: string`; the inner `extractHeroImageUrl(html)` call is removed. The function `extractHeroImageUrl` remains EXPORTED so tests can still derive a URL from a fixture.
- **`server/scrapers/drom/index.ts`** — `emptyReport` initializes the two new counters; the orchestrator passes `heroImageUrl: gen.hero_image_url` to `parseGenerationPage`; image-fetch failures increment `images_failed` (not `images_skipped`), push errors with `kind: 'image'`, AND clear `record.image_paths = []`. Parse-error push gains `kind: 'parse'`; orchestrator-catch push gains `kind: 'orchestrator'`; both `inheritFromPrevCurrent` push sites gain `kind: 'inherit'`. End-of-run gate split: parse errors only for the 10% threshold; new bounded image gate.
- **`server/tests/drom-parsers.test.ts`** — Imports `extractHeroImageUrl` alongside `parseGenerationPage`; the image_paths-non-empty test now passes `ctx.heroImageUrl = extractHeroImageUrl(html) ?? undefined`; companion test asserts `image_paths === []` when `heroImageUrl` is undefined.
- **`server/tests/drom-integration.test.ts`** — New `it('counter-drift guard: ...')` test seeds 12 brands, throws synthetic parse error for `bmw/x5`, throws synthetic CDN 503 on the first image fetch, asserts `errors[]` splits cleanly into 1 parse + 1 image, asserts `image_failure_rate` between 0 and 1, asserts CR-05 reconciliation (exactly 1 record with `image_paths === []`).

## Confirmations

- **`extractHeroImageUrl` is still exported.** `parse-generation-page.ts` keeps the helper as `export function extractHeroImageUrl`; `drom-parsers.test.ts` consumes it. `grep -c 'export function extractHeroImageUrl' server/scrapers/drom/parse-generation-page.ts` = 1.
- **Both `inheritFromPrevCurrent` push sites carry `kind: 'inherit'`.** The models.json read failure AND the per-image copyFile failure. `grep -c "kind: 'inherit'" server/scrapers/drom/index.ts` = 2.
- **New abort thresholds.**
  - Parse gate: `parseErrors / (parseErrors + modelsTouchedThisRun) > 0.10` → throw.
  - Image gate: `images_failed / images_attempted > 0.20 AND images_attempted >= 20` → throw. Below floor → run completes; `image_failure_rate` exposed in report.json.
- **Counter-drift integration test.** `it('counter-drift guard: parse + image errors in the same run are counted into separate denominators (WARNING 8 fix)', ...)`. Pins parse-gate denominator (1 parse error / 12 brands ≈ 8.3% < 10%) AND image-gate denominator (1 attempted < 20 floor).
- **Cross-plan note.** SCHEMA.md documentation update for the new report.json fields (`images_failed`, `image_failure_rate`) and the `kind` discriminator rides along with plan 15's docs sweep.

## Verification Gates

All plan-level grep gates and test gates pass:

| # | Gate | Expected | Actual |
|---|------|----------|--------|
| 1 | `kind` union literal in `types.ts` | == 1 | 1 |
| 2 | `images_failed` in `types.ts` | == 1 | 1 |
| 3 | `image_failure_rate` in `types.ts` | == 1 | 1 |
| 4 | `heroImageUrl?: string` in `parse-generation-page.ts` | == 1 | 1 |
| 5 | `ctx.heroImageUrl` in `parse-generation-page.ts` | >= 1 | 2 |
| 6 | `kind: 'image'` in `drom/index.ts` | >= 1 | 1 |
| 7 | `kind: 'parse'` in `drom/index.ts` (push site) | >= 1 | 1 |
| 7b | `kind === 'parse'` in `drom/index.ts` (filter site) | >= 1 | 1 |
| 8 | `kind: 'orchestrator'` in `drom/index.ts` | >= 1 | 1 |
| 9 | `kind: 'inherit'` in `drom/index.ts` | >= 2 | 2 |
| 10 | `images_failed` in `drom/index.ts` | >= 3 | 8 |
| 11 | `image_failure_rate` in `drom/index.ts` | >= 2 | 3 |
| 12 | `record.image_paths = []` in `drom/index.ts` | == 1 | 1 |
| 12b | `Validation drop-out` (must be gone) | == 0 | 0 |
| 13 | `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 | exit 0 |
| 14 | `pnpm vitest run` | exit 0 | exit 0 (97/97 tests) |

Note on gate 7: the verification line in `01-14-PLAN.md` reads `>=2` for `grep -c "kind: 'parse'"`, but the action in step 6 explicitly writes the filter as `(e) => e.kind === 'parse'` (with `===`), which uses different syntax than the push site's `kind: 'parse',` (with `:`). The grep finds 1 match for the colon form (push) and 1 for the strict-equal form (filter); combined `'parse'` references = 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test stability] Cleanup of stale `current/` symlink before counter-drift test**

- **Found during:** Task 5 — when running the new integration test alongside the prior incremental-snapshot test, the prior test leaves `current/` pointing at a runId with inherited records, which would seep into this test's `seen` map and break the `bmw/x5` parse-failure assertion.
- **Fix:** The new test unlinks `current/` (if present) before resetting modules and importing the orchestrator, so `inheritFromPrevCurrent` returns empty state for this run.
- **Files modified:** `server/tests/drom-integration.test.ts` (only inside the new `it` block).
- **Commit:** `68d334a`

No other deviations from the plan.

## Self-Check: PASSED

- File `.planning/phases/01-inventory-scrapers-drom-and-stubs/01-14-SUMMARY.md`: present (this file).
- File `server/scrapers/shared/types.ts`: FOUND.
- File `server/scrapers/drom/parse-generation-page.ts`: FOUND.
- File `server/scrapers/drom/index.ts`: FOUND.
- File `server/tests/drom-parsers.test.ts`: FOUND.
- File `server/tests/drom-integration.test.ts`: FOUND.
- Commit `b0bcea2`: FOUND.
- Commit `5e1582c`: FOUND.
- Commit `971b9e4`: FOUND.
- Commit `f2aab05`: FOUND.
- Commit `68d334a`: FOUND.
- TypeScript compiles cleanly (`pnpm typecheck:server` exit 0).
- Full vitest suite green (`pnpm vitest run` 97/97 tests).
