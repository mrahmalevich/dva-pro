---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 13
subsystem: infra
tags: [scraper, drom, integration-test, resume, gap-closure, IN-07, CR-01, CR-03, CR-04, WR-04]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: |
      plan 01-07 (drom orchestrator + initial integration test scaffold), plan
      01-10 (sort-before-compare cursor + missing-slug throw — CR-01/CR-02/CR-03
      fixes), plan 01-11 (CorruptCursorError + zod CursorSchema — WR-04 fix),
      plan 01-12 (CR-04 contract: pin startFromModelIndex = 0 for cursored
      brand), plan 01-14 (errors[] kind discriminator + split parse/image abort
      gates — CR-05/CR-06), d3bad88 (inheritFromPrevCurrent snapshot path that
      makes "re-scrape cursored brand" data-safe).
provides:
  - "Resume-path integration coverage: 4 new it() cases inside a new describe('drom orchestrator resume path ...') block in server/tests/drom-integration.test.ts. Each test exercises drom.run({ resume: true }) end-to-end against fixtures and stubs readCursor via vi.doMock to inject deterministic Cursor values (cross-invocation cursor flow is sibling 01-16 territory)."
  - "Orchestrator IScraper contract hardened: a thrown CorruptCursorError from readCursor() now becomes {status: 'error', error: {message}} instead of an unhandled rejection. Prior code violated the 'drom.run returns ScrapeResult; never throws' invariant for the corrupt-cursor failure mode."
affects: [01-VERIFICATION, 01-REVIEW]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vi.doMock + vi.importActual partial-stub pattern for shared/cursor.js — re-exports the original module surface (CorruptCursorError class, CursorSchema, deleteCursor) and only overrides readCursor / writeCursor for the test. Lets tests inject controlled Cursor values without re-implementing the full module API."
    - "Local-const TS narrowing rescue: when a `let cursor: T | null` is referenced inside a closure (`findIndex((b) => ... cursor.x ...)`), TypeScript re-widens the type to `T | null` because the outer mutable binding could in principle be re-assigned between the type guard and the closure invocation. Capture into `const c = cursor` immediately after the guard so the closure sees the narrowed type."

key-files:
  created: []
  modified:
    - "server/tests/drom-integration.test.ts — added 1 new import (CorruptCursorError) + 1 new describe block (336 LOC) with 4 it() cases. Existing 3 tests untouched."
    - "server/scrapers/drom/index.ts — moved readCursor() call from outside the outer try/catch to inside it; captured `cursor` into local consts at the two findIndex closure sites to retain TS narrowing. No behavioral change to CR-01/CR-02/CR-04 paths."

key-decisions:
  - "Mock readCursor via vi.doMock rather than seeding a real `.cursor.json` on disk. The orchestrator generates a fresh runId per invocation and reads `.cursor.json` from `<runRoot>/<runId>/`, which is unknown to the test before drom.run() starts. Mocking the cursor module sidesteps the dynamic-runId problem and stays within plan scope (cross-invocation cursor flow is sibling 01-16 territory). The plan's `<scope_boundary>` documents this explicitly."
  - "Auto-fix the orchestrator's outer try/catch boundary as a Rule 1 deviation. The plan's prescribed Test 3 expects `result.status === 'error'` for a CorruptCursorError, but the unmodified orchestrator throws (readCursor sat outside the outer try). Per IScraper contract in shared/types.ts (`run(): Promise<ScrapeResult>`), the orchestrator is supposed to translate every known failure mode into a structured ScrapeResult. The plan's behavior expectation is the operator-experience contract; the unmodified code violated it. Fix is minimal: shift the cursor-read 4 lines down past `try {`."
  - "Use `await readFile` of the prior fixture HTML files inside a `loadFixtures()` helper rather than top-level constants. Each test calls it independently, which keeps the four resume tests order-independent (no shared mutable buffers) and matches the existing two integration tests' style of computing fixture buffers per-test."

patterns-established:
  - "Resume-path integration test pattern: stub readCursor via vi.doMock, stub the four parsers + shared/http per the existing integration-test idiom, call vi.resetModules() + dynamic-import the orchestrator, await drom.run({ resume: true }), assert against the runDir on-disk artifacts (current/models.json, current/report.json, brand-aliases.json). Replayable for any future resume-related test."
  - "TS narrowing inside closures referenced by mutable `let`: use `const c = cursor` immediately after the type guard. Search for this pattern via grep `// Capture into a const so TS narrows` in server/scrapers/drom/index.ts."

requirements-completed: [SCRAPE-05]

# Metrics
duration: 6m20s
completed: 2026-04-29
---

# Phase 01 Plan 13: Resume-path integration tests (IN-07) Summary

**Closed IN-07 by adding 4 resume-path integration tests that pin the contracts delivered by plans 01-10 (CR-01/CR-03 sort-before-compare), 01-11 (WR-04 CorruptCursorError), and 01-12 (CR-04 re-scrape cursored brand from scratch); auto-fixed a Rule 1 bug where readCursor sat outside the orchestrator's outer try/catch and a thrown CorruptCursorError propagated as an unhandled rejection instead of becoming a {status:'error'} ScrapeResult.**

## Performance

- **Duration:** ~6 minutes (RED → GREEN → typecheck → SUMMARY)
- **Tasks:** 1 (TDD: RED + GREEN)
- **Test deltas:** +4 integration tests (3 → 7 in `drom-integration.test.ts`); whole-suite count: 97 → 101
- **Files touched:** 2 modified, 0 created

## Accomplishments

- **4 resume-path integration tests added** to `server/tests/drom-integration.test.ts`:
  1. `resumes from cursored brand and skips earlier brands (CR-01 fix)` — closes the CR-01 silent-restart bug. Brands `[audi, bmw, lada]` in alphabetic DOM order with `cursor.lastBrandSlug = 'bmw'` → `audi` skipped, `bmw` and `lada` produce records, `report.cursor_resumed === true`.
  2. `sorts non-alphabetic DOM order before applying cursor (CR-03 fix)` — closes the CR-03 DOM-order assumption bug. Brands `[lada, bmw, audi]` (non-alphabetic DOM order) with the same cursor → after the orchestrator's plan-10 sort, the loop iterates `[bmw, lada]` → identical outcome to test 1.
  3. `returns status=error when readCursor throws CorruptCursorError (WR-04 fix)` — closes the WR-04 silent-corruption bug AND the IScraper contract hole. `readCursor` stubbed to reject with `new CorruptCursorError('test corruption injected by 01-13 plan')` → `drom.run({ resume: true })` returns `{ status: 'error', error: { message: '...' } }`. `current/` symlink is NOT updated. (RED → GREEN: this test was the one that drove the orchestrator fix.)
  4. `CR-04 contract: cursored brand is re-scraped from scratch (all its models present after resume)` — closes the CR-04 data-loss bug. Single brand `bmw` with models `[x3, x5]`, cursor `{lastBrandSlug: 'bmw', lastModelSlug: 'x3'}` → both `bmw:x3` and `bmw:x5` end up in `models.json`; `brand-aliases.json` has both `x3` and `x5` under `bmw` with structurally-correct `{ru, latin}` shape.
- **Existing integration tests unchanged** — the original `describe('drom orchestrator (SCRAPE-05, SCRAPE-09 end-to-end)', ...)` block (3 tests) is byte-for-byte identical post-edit; only the import block and the file's tail (after the closing `});`) were modified.
- **Orchestrator IScraper contract hardened.** `readCursor` was lifted into the outer `try { ... }` block so a thrown CorruptCursorError now becomes `{status: 'error'}` per the documented IScraper contract in `server/scrapers/shared/types.ts`. The fix is 4 lines of structural movement plus 2 local-const captures to retain TS narrowing inside `findIndex` closures. No behavioral change to the CR-01 / CR-02 / CR-04 paths — same throw messages, same indices, same pin to `0`.

## Task Commits

1. **Task 1 RED — failing resume integration tests** — `5253f32` (`test`)
   - Adds the new describe block with all 4 it() cases.
   - Tests 1, 2, and 4 pass against the unmodified orchestrator; test 3 fails because the thrown CorruptCursorError propagates as an unhandled rejection instead of becoming a ScrapeResult.

2. **Task 1 GREEN — orchestrator outer-try fix** — `aa484ce` (`fix`)
   - Moves `readCursor()` inside the existing outer try/catch.
   - Captures `cursor` into local consts at each `findIndex` call site so TypeScript retains narrowing inside the arrow-function closures.
   - All 4 new tests + all 97 prior tests pass; `pnpm tsc -p tsconfig.server.json --noEmit` exits 0.

_Note: TDD shape was RED→GREEN with no REFACTOR commit (the change is a minimal structural move; the local-const captures are paired with the move and need no further cleanup)._

## Files Modified

- **`server/tests/drom-integration.test.ts`** (+336 LOC):
  - Added `import { CorruptCursorError } from '../scrapers/shared/cursor.js';` immediately after the existing top-of-file imports.
  - Appended a new `describe('drom orchestrator resume path (gap-closure 01-13: CR-01..CR-04, IN-07)', () => {...})` block at end-of-file with 4 it() cases.
  - Existing `describe('drom orchestrator (SCRAPE-05, SCRAPE-09 end-to-end)', ...)` block byte-for-byte unchanged.
- **`server/scrapers/drom/index.ts`** (+23/-8 LOC, no functional change to CR-01/CR-02/CR-04 contracts):
  - Lifted the `if (opts.resume) { cursor = await readCursor(runDir); ... }` block 2 lines down so it now lives inside the existing `try { ... }` block. Comment block above the new location names IN-07 and the IScraper contract.
  - Captured `cursor` into a `const c` immediately after each `if (cursor)` / `if (cursor && ...)` guard, used `c.lastBrandSlug` / `c.lastModelSlug` inside the `findIndex` arrow callbacks. (TS narrows the captured `const` inside closures even when the source `let` is potentially mutable.)

## Cross-plan note

This plan validates plans **01-10**, **01-11**, **01-12**, and **01-14** end-to-end:
- **Plan 01-10** (sort-before-compare + throw-on-missing-slug) is exercised by tests 1 and 2.
- **Plan 01-11** (CorruptCursorError + zod CursorSchema) is exercised by test 3.
- **Plan 01-12** (CR-04 re-scrape pin) is exercised by test 4.
- **Plan 01-14** (errors[] kind discriminator) is implicitly validated because the new tests use the post-14 `ReportSummary` type and `pnpm tsc -p tsconfig.server.json --noEmit` exits 0.

With this plan green, **gap 1 in 01-VERIFICATION.md (resume code path correctness)** is fully closed for the cursor-present case. Cross-invocation cursor flow (the orchestrator currently writes/reads the cursor inside the per-run runDir, so a fresh runId per invocation defeats resume) remains a structural concern tracked by sibling **plan 01-16**, which moves the cursor file to a stable brand-root location and adds a real two-invocation integration test.

## Whole-suite trace

| Metric                       | Before | After | Delta |
| ---------------------------- | ------ | ----- | ----- |
| `drom-integration.test.ts`   | 3      | 7     | +4    |
| Whole vitest suite (`pnpm vitest run`) | 97 | 101 | +4 |
| `pnpm tsc -p tsconfig.server.json --noEmit` exit code | 0 | 0 | — |

Pre-existing tests (1 SCRAPE-05/SCRAPE-09 end-to-end, 1 incremental snapshot, 1 counter-drift guard) continue to pass byte-for-byte unchanged.

## Decisions Made

- **Mock the cursor module rather than seed `.cursor.json` on disk.** The orchestrator generates a fresh `runId` per invocation and reads `.cursor.json` from `<runRoot>/<runId>/`, which is not known to the test before `drom.run()` starts. Mocking `readCursor` via `vi.doMock` lets the test inject deterministic Cursor values without fighting the dynamic-runId problem. The plan's `<scope_boundary>` documents this explicitly: cross-invocation cursor flow is sibling **plan 01-16**'s territory.
- **Auto-fix the orchestrator's outer try/catch boundary as a Rule 1 deviation.** The plan's prescribed Test 3 expects `result.status === 'error'` for a CorruptCursorError, but the pre-fix orchestrator threw (because `readCursor` sat outside the outer `try`). Per the IScraper contract in `shared/types.ts` (`run(): Promise<ScrapeResult>`), the orchestrator is supposed to translate every known failure mode — including the cursor-read errors that plan 01-11 introduced — into a structured ScrapeResult. The plan's behavior expectation is the operator-experience contract; the unmodified code violated it. The fix is the minimal structural move required to honor that contract.
- **Capture `cursor` into local consts inside the two `findIndex` closures.** TS re-widens a mutable `let cursor: T | null` to `T | null` inside arrow-function callbacks (because the outer binding could in principle be re-assigned between the guard and the closure invocation). Pattern is a standard rescue and adds two `const c = cursor;` lines; no behavioral change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Orchestrator's `readCursor()` call sat outside the outer try/catch**

- **Found during:** Task 1 RED verification (Test 3 'returns status=error when readCursor throws CorruptCursorError' failed because the thrown CorruptCursorError propagated through `await drom.run({ resume: true })` instead of becoming a ScrapeResult).
- **Issue:** The IScraper contract in `server/scrapers/shared/types.ts` declares `run(opts?): Promise<ScrapeResult>` — the implementation is supposed to translate every known failure mode (BlockedError, parse errors, network errors, etc.) into a structured `ScrapeResult` instead of rejecting the promise. The pre-plan-11 orchestrator predated `CorruptCursorError`, so the cursor-read happened OUTSIDE the outer `try`; after plan 11 introduced the throw, the orchestrator silently violated its own IScraper contract for this failure mode and there was no integration test to catch it (IN-07).
- **Fix:** Lifted the `if (opts.resume) { cursor = await readCursor(runDir); ... }` block 2 lines down so it now lives inside the existing `try { ... }` block. Added a comment block above the new location naming IN-07 and the IScraper contract. The existing `catch (err) { ... }` arm at the bottom of `run()` already converts every other thrown error into `{status: 'error'}`; CorruptCursorError now flows through that same arm.
- **Files modified:** `server/scrapers/drom/index.ts`
- **Verification:** Test 3 passes; all other tests still pass; `pnpm tsc -p tsconfig.server.json --noEmit` exits 0.
- **Committed in:** `aa484ce`

**2. [Rule 3 — Blocking] TS narrowing breakage after the cursor-block move**

- **Found during:** First `pnpm tsc -p tsconfig.server.json --noEmit` after the orchestrator fix.
- **Issue:** Two `findIndex` closures (`(b) => b.brand_slug >= cursor.lastBrandSlug` at the brand-cursor block, `(m) => m.model_slug >= cursor.lastModelSlug` at the model-cursor block) raised TS18047 "'cursor' is possibly 'null'" — TypeScript re-widens the mutable `let cursor: Cursor | null` inside arrow-function callbacks. The pre-fix code happened to escape this because the assignment to `cursor` lived outside the `try`, so TS could narrow more aggressively; moving the assignment inside `try` exposed the latent narrowing limitation.
- **Fix:** Captured `cursor` into a local `const c = cursor;` immediately after each `if (cursor)` / `if (cursor && ...)` guard; used `c.lastBrandSlug` / `c.lastModelSlug` inside the closures and the throw messages. Added a 1-line comment naming the pattern at each capture site.
- **Files modified:** `server/scrapers/drom/index.ts` (same change as deviation 1, no extra commit).
- **Verification:** `pnpm tsc -p tsconfig.server.json --noEmit` exits 0; behavior unchanged (the `const` aliases the same value; throw messages and indices identical).
- **Committed in:** `aa484ce` (same commit as the readCursor lift; the two changes are paired structurally — moving the `await readCursor` inside `try` is what triggered the narrowing breakage, and the `const c = cursor;` captures are the rescue).

### Auth / Architectural / Out-of-scope

- **None.** No authentication gates encountered (offline integration tests). No architectural changes proposed (the readCursor lift is a 4-line structural move, not a re-architecture). No out-of-scope discoveries logged to `deferred-items.md` — the orchestrator change is directly required by the plan's Test 3 contract.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking; both in the same commit because they are structurally coupled). **Impact on plan:** Both auto-fixes were necessary to satisfy the plan's prescribed Test 3 contract and pass `pnpm tsc -p tsconfig.server.json --noEmit`. The plan's `<scope>` says "No production code changes" but the prescribed test contract demands a structural fix; the change made is the smallest possible (4-line lift + 2 local-const captures, zero behavior change to the in-scope cursor paths).

## Issues Encountered

- **Worktree base mismatch on agent startup.** The worktree's HEAD was the initial commit `fdcd105`, not the expected base `c6cd812`. Resolved per the `<worktree_branch_check>` protocol via `git reset --hard c6cd812848876bdcbdd62b88cc3dba25db8ca371`. Verified `git rev-parse HEAD` matches expected base before proceeding.
- **`node_modules/` absent in fresh worktree.** Ran `pnpm install --frozen-lockfile` to populate dependencies (vitest, sharp, tough-cookie, etc.). Standard parallel-executor warmup; no source changes.
- **Vercel-plugin Read hook flagged the README/CLAUDE.md as a "bootstrap" pattern.** Ignored per project CLAUDE.md ("The Vercel-plugin auto-suggestion in this environment is a tooling artifact, not a project signal" — this project is React+Vite+Hono, not Next.js).

## Plan-level verification block

| # | Check | Required | Actual | Status |
|---|-------|----------|--------|--------|
| 1 | `grep -c "describe.*resume path" server/tests/drom-integration.test.ts` | == 1 | 1 | OK |
| 2 | `grep -c "drom.run({ resume: true })" server/tests/drom-integration.test.ts` | >= 4 | 4 | OK |
| 3 | `grep -c "CorruptCursorError" server/tests/drom-integration.test.ts` | >= 2 | 4 | OK |
| 4 | `grep -c "CR-04 contract" server/tests/drom-integration.test.ts` | >= 1 | 2 | OK |
| 5 | `pnpm vitest run server/tests/drom-integration.test.ts` exit code | 0 | 0 (7 tests pass) | OK |
| 6 | `pnpm vitest run` exit code | 0 | 0 (101 tests pass) | OK |
| 7 | `pnpm tsc -p tsconfig.server.json --noEmit` exit code | 0 | 0 | OK |

## Cross-plan note

This plan completes **gap 1** in `01-VERIFICATION.md` for the cursor-present case. Cross-invocation cursor flow remains a structural concern owned by sibling **plan 01-16** (move the cursor file to a stable brand-root location + add a real two-invocation integration test). Until plan 16 lands, the resume contract is correctly implemented but the cursor file is currently written to a per-runId path that fresh invocations cannot find — the integration tests in this plan validate the LOGIC under the cursor-present assumption, not the FILE-SYSTEM PATH that delivers the cursor across invocations.

## User Setup Required

None — all changes are server-side test code and one orchestrator try/catch lift; no external service configuration required.

## Next Phase Readiness

- **IN-07 closed.** The drom orchestrator's resume code path (CR-01..CR-04, WR-04) now has integration coverage; future regressions to plans 10/11/12/14 will trip the new tests.
- **IScraper contract honored end-to-end.** Every failure mode the orchestrator can encounter — BlockedError, parse error, network error, image-fetch error, FX cache miss, AND cursor-read error — now translates into a structured ScrapeResult instead of an unhandled rejection.
- **No new blockers introduced.** Full vitest suite passes (101/101); `pnpm tsc -p tsconfig.server.json --noEmit` exits 0.
- **Plan 01-16 unblocked.** With the resume LOGIC pinned by integration tests in this plan, plan 16 can focus on the cross-invocation cursor-flow structural fix without re-validating the underlying logic.

## Self-Check: PASSED

**Files:**
- `server/tests/drom-integration.test.ts` (modified, +1 import + 1 new describe block) — FOUND
- `server/scrapers/drom/index.ts` (modified, structural move + 2 const captures) — FOUND
- `.planning/phases/01-inventory-scrapers-drom-and-stubs/01-13-SUMMARY.md` (this file) — FOUND

**Commits:**
- `5253f32` (Task 1 RED — `test(01-13): add failing resume-path integration tests (IN-07 RED)`) — FOUND
- `aa484ce` (Task 1 GREEN — `fix(01-13): catch CorruptCursorError into ScrapeResult (Rule 1 — IN-07 GREEN)`) — FOUND

**Plan-level verification block (table above):**
- All 7 acceptance checks pass (4 grep counts + vitest file + vitest suite + tsc).

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Completed: 2026-04-29*
