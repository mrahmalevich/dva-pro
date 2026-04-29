---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 16
subsystem: server/scrapers
tags: [gap-closure, cursor, structural, cross-invocation, BLOCKER-1, resume]
gap_closure: true
requires:
  plans: [10, 11, 12, 13, 14]
  files:
    - server/scrapers/shared/cursor.ts
    - server/scrapers/drom/index.ts
    - server/tests/cursor.test.ts
    - server/tests/drom-integration.test.ts
    - data/scraped/README.md
provides:
  - "Stable, runId-agnostic cursor path: data/scraped/drom/.cursor.json"
  - "readCursor/writeCursor/deleteCursor take cursorPath:string (not runDir)"
  - "Cross-invocation cursor flow pinned by integration test"
affects:
  - "BLOCKER 1 of 01-REVIEW.md (cross-invocation cursor flow)"
tech-stack:
  added: []
  patterns:
    - "Caller-owned filesystem paths (cursor module no longer derives the path)"
    - "Cross-invocation persistence via stable filesystem location"
key-files:
  created: []
  modified:
    - server/scrapers/shared/cursor.ts
    - server/scrapers/drom/index.ts
    - server/tests/cursor.test.ts
    - server/tests/drom-integration.test.ts
    - data/scraped/README.md
decisions:
  - "Cursor path is now an external concern: the orchestrator computes it once at the top of run() and passes it to every cursor call site, instead of the cursor module deriving resolve(runDir, '.cursor.json') internally."
  - "Canonical path is data/scraped/drom/.cursor.json at the brand root, NOT inside per-run runId directories — this is what makes run N+1 read what run N wrote."
metrics:
  tasks_completed: 4
  duration_min: ~7
  duration_seconds: 411
  test_count: 108
  test_files: 13
  completed: 2026-04-29
---

# Phase 01 Plan 16: BLOCKER 1 Cross-invocation Cursor Flow Summary

Closed the structural gap behind 01-REVIEW.md BLOCKER 1: the cursor file now lives at a stable, runId-agnostic brand-root path (`data/scraped/drom/.cursor.json`) so the cursor written by run N is read by run N+1. Pinned by a new integration test that crashes mid-run, asserts the cursor exists at the brand-root path, and asserts the second invocation reads it via `report.cursor_resumed === true`.

## What Changed

### 1. `server/scrapers/shared/cursor.ts` — signature change

**Before** (paraphrased; full code in commit `59f00a3`):

```ts
const CURSOR_FILENAME = '.cursor.json';

export async function readCursor(runDir: string): Promise<Cursor | null> {
  const cursorPath = resolve(runDir, CURSOR_FILENAME);
  // ...read raw / parse / validate...
}

export async function writeCursor(runDir: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(resolve(runDir, CURSOR_FILENAME), JSON.stringify(cursor, null, 2));
}

export async function deleteCursor(runDir: string): Promise<void> {
  await unlink(resolve(runDir, CURSOR_FILENAME)).catch(() => {});
}
```

**After**:

```ts
export async function readCursor(cursorPath: string): Promise<Cursor | null> {
  // raw = await readFile(cursorPath, 'utf-8'); ENOENT → null;
  // JSON.parse → CorruptCursorError; CursorSchema.safeParse → CorruptCursorError; ok → Cursor
}

export async function writeCursor(cursorPath: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(cursorPath, JSON.stringify(cursor, null, 2));
}

export async function deleteCursor(cursorPath: string): Promise<void> {
  await unlink(cursorPath).catch(() => {});
}
```

The `CURSOR_FILENAME` constant is removed; `resolve(runDir, CURSOR_FILENAME)` derivation inside the module is removed. The path is now an external concern. CursorSchema, CorruptCursorError, and the Cursor type are unchanged.

### 2. `server/scrapers/drom/index.ts` — orchestrator owns the path

Four edits inside `drom.run()`:

- **Declaration (top of run, alongside `runRoot` / `runDir`):**
  ```ts
  const runRoot = resolve(RUN_ROOT_REL);
  const runDir = resolve(runRoot, runId);
  const cursorPath = resolve(runRoot, '.cursor.json'); // NEW
  const brandAliasesPath = resolve(runRoot, 'brand-aliases.json');
  ```
- **readCursor call site** (inside outer try, gated on `opts.resume`):
  ```ts
  cursor = await readCursor(cursorPath); // was readCursor(runDir)
  ```
- **writeCursor call site** (per-model checkpoint, end of model loop body):
  ```ts
  await writeCursor(cursorPath, { lastBrandSlug, lastModelSlug, completedAt });
  // was writeCursor(runDir, ...)
  ```
- **deleteCursor call site** (success branch, after pointCurrentAt):
  ```ts
  await deleteCursor(cursorPath); // was deleteCursor(runDir)
  ```

`runRoot` is computed unconditionally at the top of `run()` and `runDir` is created via `mkdir(runDir, { recursive: true })`, which implicitly ensures `runRoot` exists — so `writeCursor` on `<runRoot>/.cursor.json` is never asked to create a missing directory.

### 3. `server/tests/cursor.test.ts` — tests pass `cursorPath` explicitly

Added `let cursorPath = ''` at module scope; `beforeEach` now computes `cursorPath = resolve(runDir, '.cursor.json')` after the `mkdtemp(...)` call. Every `readCursor / writeCursor / deleteCursor` call site updated. Direct `writeFile(resolve(runDir, '.cursor.json'), ...)` seeds (corrupt JSON, shape mismatch, EACCES test) collapsed to `writeFile(cursorPath, ...)`.

All 10 cursor tests still pass:
1. readCursor returns null when absent
2. readCursor throws CorruptCursorError on corrupt JSON
3. readCursor throws CorruptCursorError on shape mismatch
4. readCursor throws CorruptCursorError on wrong field type
5. readCursor propagates EACCES unchanged
6. writeCursor → readCursor round-trips
7. writeCursor uses atomic write (no .tmp leftovers)
8. deleteCursor removes the file
9. deleteCursor is idempotent
10. "kill mid-run" simulation (process A writes, process B reads, completes, deletes)

### 4. `server/tests/drom-integration.test.ts` — cross-invocation flow test

New test at the end of the first `describe` block: `cross-invocation cursor flow: cursor written by run N is read by run N+1 (BLOCKER 1 fix, plan 01-16)`.

What it pins:

1. Run #1 invokes `drom.run({ resume: false })` against a 1-brand × 2-model fixture (bmw / [x3, x5]). The HTTP stub throws on x5's generation page — synthetic mid-run crash.
2. Result is `status: 'error'`. The test asserts `<workDir>/data/scraped/drom/.cursor.json` exists (brand-root path, NOT inside any runId dir) and contains `{ lastBrandSlug: 'bmw', lastModelSlug: 'x3' }` — x3 completed before the crash.
3. Run #2 invokes `drom.run({ resume: true })` with the synthetic crash disabled. The orchestrator reads the cursor from the SAME brand-root path the first run wrote to, sets `report.cursor_resumed = true`, re-scrapes the bmw brand from scratch (CR-04 contract from plan 01-12), and completes with `status: 'ok'`.
4. The test asserts the cursor file is deleted on success.

This is the structural pin the plan-13 tests were missing. Plan 13's IN-07 tests stub `readCursor` via `vi.doMock`, validating the resume *logic* under a cursor-present assumption — they do NOT exercise the file-system flow. This new test goes through the real `readCursor`/`writeCursor`/`deleteCursor` against a real filesystem path, proving run-N and run-N+1 share state.

### 5. `data/scraped/README.md` — documentation

- §"Output directory layout" diagram: `.cursor.json` moved out of the per-runId block and placed at `data/scraped/drom/` brand root, with a `plan 01-16` reference (this was a stale reference now corrected — Rule 1).
- §"Crash recovery (D-15) — resume contract": new bullet 4 explicitly names the brand-root path and explains why it is stable across invocations. Subsequent bullets renumbered (5/6/7).

## Why This Was Needed

01-REVIEW.md flagged BLOCKER 1: every `drom.run()` invocation generated a fresh `runId` and a fresh `runDir`, then called `readCursor(runDir)` — which always read from a brand-new empty directory and returned `null`. The resume contract was structurally broken in production: `cli.ts:27` always passed `resume: true`, but the cursor written into run N's directory was never seen by run N+1. The plan-13 integration tests passed only because they `vi.doMock` `readCursor` to inject a synthetic cursor.

The fix is a 4-line structural change (path declaration in the orchestrator + three call-site edits) plus a signature shift in the cursor module (the path is now an external concern, not derived internally). The new integration test ensures regressions are caught.

## Verification Gates

All 8 gates from `<verification>` pass:

| # | Gate | Expected | Actual |
| - | ---- | -------- | ------ |
| 1 | `grep -c 'readCursor(cursorPath: string)' server/scrapers/shared/cursor.ts` | 1 | 1 |
| 2 | `grep -c 'CURSOR_FILENAME' server/scrapers/shared/cursor.ts` | 0 | 0 |
| 3 | `grep -c 'cursorPath = resolve(runRoot' server/scrapers/drom/index.ts` | 1 | 1 |
| 4 | `grep -cE '(readCursor\|writeCursor\|deleteCursor)\(runDir' server/scrapers/drom/index.ts` | 0 | 0 |
| 5 | `grep -c 'cross-invocation cursor flow' server/tests/drom-integration.test.ts` | >= 1 | 1 |
| 6 | `grep -c 'data/scraped/drom/.cursor.json' data/scraped/README.md` | >= 1 | 1 |
| 7 | `pnpm typecheck:server` | exit 0 | exit 0 |
| 8 | `pnpm vitest run` | exit 0 | exit 0 (108 tests / 13 files green) |

## Test Counts

- `cursor.test.ts`: 10 tests (was 10 post-plan-11; signature change is internal to test bodies, count unchanged).
- `drom-integration.test.ts`: 8 tests (was 7 post-plan-13/14; +1 cross-invocation test added by this plan).
- Full suite: 108 tests across 13 files, all green.

## TDD Gate Compliance

Each task followed RED → GREEN:

- **Task 1 (cursor.ts signatures)**: cumulative TS+test gate is post-Task-3 because Tasks 1–3 form a single signature-change cycle. Task 1 alone breaks call sites (expected); the gate runs after Task 2 (TS) and Task 3 (tests).
- **Task 3 (cursor.test.ts)**: explicit RED → GREEN cycle observed. After Task 1+2 landed, `pnpm vitest run server/tests/cursor.test.ts` failed 9/10 with `EISDIR: illegal operation on a directory, rename ... -> .../dva-cursor-XXXXXX` (the new signature interpreted `runDir` as a file path; atomicWriteFile tried to rename onto a directory). Task 3 updated tests to pass `cursorPath = resolve(runDir, '.cursor.json')`; rerun → 10/10 green.
- **Task 4 (cross-invocation integration test)**: the test exercises a code path that previously did not exist (no path was stable across invocations); without Tasks 1+2 the test would still fail because `readCursor(cursorPath)` would not even compile. With Tasks 1+2+3 landed, Task 4's new test passes on first run alongside the existing 7 integration tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] README directory layout had stale `.cursor.json` location**

- **Found during:** Task 4 (README edit step)
- **Issue:** The directory-layout diagram in §"Output directory layout" still listed `.cursor.json` *inside* the per-runId dir, which is exactly the structure this plan eliminates. Leaving it as-is would have produced contradictory documentation: bullet 4 of §"Crash recovery" says the cursor is at the brand root, but the diagram says it is inside the run dir.
- **Fix:** Moved `.cursor.json` in the layout diagram to the brand-root level (alongside `brand-aliases.json` and `current/`) with a `plan 01-16` reference. Removed the trailing `└── .cursor.json` from the runId block.
- **Files modified:** `data/scraped/README.md`
- **Commit:** `b3dcb08` (folded into Task 4)

The plan's `<action>` for Task 4 only specified updating the §"Crash recovery" bullets; the layout diagram was not in scope. Updating it is a Rule 1 bug fix because the diagram became inconsistent with the actual filesystem layout immediately after Task 2 landed, and leaving it would have misled operators looking for the cursor file.

### Auth Gates

None.

## Cross-plan Notes

With plans 10..16 all green, both gaps from `01-VERIFICATION.md` are closed AND the structural cross-invocation cursor flow is pinned by integration test. The cursor's resume contract is now production-correct, not just logic-correct. Re-verification handoff: `/gsd-verify-phase 01`.

## Self-Check: PASSED

Files created/modified:
- `server/scrapers/shared/cursor.ts` — FOUND (commit `59f00a3`)
- `server/scrapers/drom/index.ts` — FOUND (commit `051b3fa`)
- `server/tests/cursor.test.ts` — FOUND (commit `f51e86b`)
- `server/tests/drom-integration.test.ts` — FOUND (commit `b3dcb08`)
- `data/scraped/README.md` — FOUND (commit `b3dcb08`)

Commits:
- `59f00a3` — feat(01-16): readCursor/writeCursor/deleteCursor take cursorPath, not runDir — FOUND in `git log`
- `051b3fa` — feat(01-16): orchestrator computes brand-root cursorPath once — FOUND in `git log`
- `f51e86b` — test(01-16): cursor.test.ts passes cursorPath, not runDir — FOUND in `git log`
- `b3dcb08` — test(01-16): cross-invocation cursor flow integration test + README path update — FOUND in `git log`
