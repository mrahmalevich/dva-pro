---
phase: 02-redesign-from-screenshot
plan: 01
subsystem: testing
tags: [vitest, puppeteer, sharp, pixelmatch, pngjs, visual-regression, vite-dev-server, golden-test]

# Dependency graph
requires:
  - phase: 01.1
    provides: "Reference test pattern at server/tests/bmw-pilot-viewer.test.ts (puppeteer + pngjs + pixelmatch + screenshot-diff golden harness)"
provides:
  - "Phase 2 structural-drift gate at server/tests/landing-page-golden.test.ts — vitest integration test that brings up Vite dev server, captures the SPA, downscales to 605x1280 via sharp, and pixelmatches against design-reference.png with DIFF_THRESHOLD=0.22"
  - "Self-orchestrating dev-server bring-up pattern via child_process.spawn + 30s polling readiness probe (no external orchestration required)"
  - "Empirically-tuned 22% structural-drift threshold (18.74% as-shipped floor + 3.26pp safety band) cited in test header for future maintainers"
affects: [02-02, 02-03, 02-04, 02-05, phase-02-close]

# Tech tracking
tech-stack:
  added: []  # No new dependencies — sharp, puppeteer, pixelmatch, pngjs, vitest all pre-installed (verified package.json before Task 1)
  patterns:
    - "Self-spawning Vite dev server inside vitest integration test (child_process.spawn + fetch-poll readiness gate)"
    - "Two-step image pipeline for golden tests: puppeteer fullPage capture → sharp.resize(refW, refH, { kernel: 'cubic', fit: 'fill' }) → pngjs/pixelmatch diff"
    - "Per-pixel pixelmatch threshold (0.1 YIQ tolerance) distinct from overall ratio threshold (DIFF_THRESHOLD = 0.22 mismatched/total)"
    - "Failure-only diff PNG artifact pattern (write only when ratio > threshold; .gitignore wildcard covers it)"

key-files:
  created:
    - "server/tests/landing-page-golden.test.ts (97 lines — Phase 2 structural-drift gate)"
  modified: []  # .gitignore already covered the diff PNG via wildcard at line 24; no edit needed

key-decisions:
  - "DIFF_THRESHOLD = 0.22 — empirical floor 18.74% + 3.26pp safety band (RESEARCH.md §3 measured 8 viewport×algorithm×fit combos)"
  - "Drop bmw-pilot-viewer's first-run bootstrap path — design-reference.png is locked at phase open per CONTEXT.md D-02; auto-write defeats the contract"
  - "Drop bmw-pilot-viewer's DejaVu Sans font override — SPA uses Gilroy from fonts.cdnfonts.com, no cross-platform-stable baseline (CONTEXT.md D-02a accepts ~19% floor)"
  - "Use pnpm dev (not preview) for the test target — 18.74% baseline was measured against dev; preview would shift threshold by 1–2pp (RESEARCH.md A4)"
  - "Test timeout 60_000 (vs analog 30_000) — dev-server bring-up + networkidle0 headroom (RESEARCH.md §10 R-1)"

patterns-established:
  - "Pattern: vitest integration tests can self-orchestrate background services via child_process.spawn + readiness polling — no external setup script required"
  - "Pattern: when a reference image and live capture have different aspect ratios, sharp.resize cubic/fill yields the most-sensitive structural-drift signal (vs contain-letterbox which adds matched dark-bg pixels)"
  - "Pattern: golden-test header docblock cites the RESEARCH.md section that justifies the threshold value, so future tightening is principled (re-measure → adjust → cite)"

requirements-completed: []  # Wave 0 builds the gate; gap closure (G-01..G-11) happens in Waves 1–2

# Metrics
duration: ~10min
completed: 2026-05-07
---

# Phase 02 Plan 01: Landing-Page Structural-Drift Gate Summary

**Vitest integration test (97 lines) that self-spawns the Vite dev server, captures the running SPA via puppeteer fullPage, downscales 1280×~12000 → 605×1280 via sharp.resize cubic/fill, and pixelmatches against the locked design-reference.png with DIFF_THRESHOLD=0.22. As-shipped diff measures 18.90%, well within the 22% gate.**

## Performance

- **Duration:** ~10 min (cd4cd9a → 8a3eadb)
- **Started:** 2026-05-07T13:23:00Z (approx)
- **Completed:** 2026-05-07T13:27:09Z (commit timestamp)
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- New file `server/tests/landing-page-golden.test.ts` exists at 97 lines (within plan target 70–130).
- Test passes against the as-shipped baseline: `pnpm test landing-page-golden.test.ts` → 1 passed in ~7s test body, ~12s total wall-clock including vitest startup.
- Measured diff ratio against current SPA: **18.90%** (well within 18.7–18.9% expected band per RESEARCH.md §3 matrix; matches the 1280×4000 cubic/fill row exactly).
- Full test suite still green: 208 passed + 3 skipped (was 207/210 baseline; +1 new passing test, exactly as plan predicted).
- `pnpm typecheck:server` exits 0 (no TS errors introduced).
- Diff PNG (`server/tests/__snapshots__/landing-page-golden.diff.png`) is NOT created on a passing run — verified via `ls` after test run; only written on failure.

## Task Commits

1. **Task 1: Create landing-page-golden.test.ts (Phase 2 structural-drift gate)** — `8a3eadb` (feat)

## Files Created/Modified

- `server/tests/landing-page-golden.test.ts` — New 97-line vitest integration test. Self-spawns `pnpm exec vite --port 5173 --host 127.0.0.1`, polls 30s for HTTP 200, launches headless puppeteer (1280×4000, font-render-hinting=none), waits for `networkidle0` + 1500ms settle, captures fullPage PNG, downscales to 605×1280 via `sharp.resize({ kernel: 'cubic', fit: 'fill' })`, runs `pixelmatch(...{ threshold: 0.1 })`, asserts `mismatched / (605 * 1280) <= 0.22`. Header docblock cites RESEARCH.md §3 for the threshold value.

## Decisions Made

All decisions were pre-locked in the plan body (CONTEXT.md D-02 / D-02a + RESEARCH.md §3, §6, §10 R-1, §10 R-7). Executed exactly as specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `pnpm install --frozen-lockfile` in fresh worktree**
- **Found during:** Task 1 verification (`pnpm test landing-page-golden.test.ts`)
- **Issue:** Worktree had no `node_modules` (`vitest: command not found`). Parallel-executor worktrees start clean.
- **Fix:** Ran `pnpm install --frozen-lockfile` to populate `node_modules` from existing lockfile. No source changes; no `package.json` edits.
- **Files modified:** `node_modules/` only (gitignored)
- **Verification:** Subsequent `pnpm test` and `pnpm typecheck:server` both exit 0; no `package.json`/`pnpm-lock.yaml` diff.
- **Committed in:** Not committed (install side-effects are gitignored)

### Acceptance-criteria observation (not a deviation, but documented for transparency)

**`grep -c "design-reference.png" landing-page-golden.test.ts` returns 2, not exactly 1 as listed in plan acceptance criteria.**

The plan's `<action>` step §9 explicitly mandates the it() block name: `'SPA matches design-reference.png within 22% structural-drift threshold'`. That string contains "design-reference.png", and the `REFERENCE` constant path also contains it — total 2 occurrences. The acceptance-criteria grep check (=1) was inconsistent with the explicit it() name spec. Followed the §9 spec (load-bearing — RESEARCH.md §6 also documents this exact it() name). All other 13 grep checks pass exactly.

---

**Total deviations:** 1 auto-fixed (1 blocking — pnpm install in fresh worktree)
**Impact on plan:** Zero scope creep. Source-file output matches the plan's spec byte-for-byte (97 lines, 1 file). The pnpm install was unavoidable — every parallel-executor worktree needs it before any vitest run.

## Issues Encountered

- Worktree branch base was older than expected (`fdcd105` vs `cd4cd9a`). Reset via `git reset --hard cd4cd9a2851d8abbb7b284cd1c878200dc163f77` per `<worktree_branch_check>` protocol; HEAD now matches expected base. Working tree was clean before reset, no work lost.

## Verification Evidence

| Check | Result |
|-------|--------|
| `test -f server/tests/landing-page-golden.test.ts` | PASS (file exists) |
| `wc -l server/tests/landing-page-golden.test.ts` | 97 (within 70–130 plan target) |
| `grep -c "DIFF_THRESHOLD = 0.22"` | 1 ✓ |
| `grep -c "REF_W = 605"` | 1 ✓ |
| `grep -c "REF_H = 1280"` | 1 ✓ |
| `grep -c "VIEWPORT = { width: 1280, height: 4000 }"` | 1 ✓ |
| `grep -c "DEV_URL = 'http://127.0.0.1:5173/'"` | 1 ✓ |
| `grep -c "bringUpDevServer"` | 2 (def + call) ✓ |
| `grep -c "kernel: 'cubic', fit: 'fill'"` | 1 ✓ |
| `grep -c "design-reference.png"` | 2 (REFERENCE constant + it() name per plan §9; documented as observation above) |
| `grep -c "writeFile(GOLDEN, actualBuf)"` | 0 (bootstrap dropped) ✓ |
| `grep -c "DejaVu"` | 0 (font override dropped) ✓ |
| `grep -c "fullPage: true"` | 1 ✓ |
| `grep -cE 'threshold:[[:space:]]*0\.1'` | 1 ✓ |
| `pnpm test landing-page-golden.test.ts` | 1 passed, ~12s wall-clock ✓ |
| `pnpm test` (full suite) | 208 passed + 3 skipped (was 207/210; +1 new) ✓ |
| `pnpm typecheck:server` | exit 0 ✓ |
| `.gitignore` line 24 | `server/tests/__snapshots__/*.diff.png` already in place — no edit ✓ |
| Measured diff ratio (out-of-band probe) | **18.90%** (within RESEARCH.md §3 expected 18.7–18.9% band) |
| Diff PNG present after passing run | NO (failure-only artifact; verified via `ls`) ✓ |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The Phase 2 structural-drift gate is in place and green.
- Wave 1 plans (G-01..G-07 gap closures) can run `pnpm test landing-page-golden.test.ts` as their primary regression check after each commit.
- Wave 3 phase-close plan can use this single test as the authoritative gate.
- **Gap-closure margin:** as-shipped 18.90% vs threshold 22.00% = 3.10pp slack. If post-G-01..G-11 the diff falls below 17%, deferred-polish item #1 should propose tightening the threshold to `(measured + 0.03)` (RESEARCH.md §3 trigger). Do NOT tighten in Phase 2 itself.
- **No blockers.** Wave 1 can proceed in parallel.

## Self-Check: PASSED

**Files claimed to exist:**
- `server/tests/landing-page-golden.test.ts` — FOUND (97 lines, committed in 8a3eadb)

**Commits claimed to exist:**
- `8a3eadb` (Task 1: feat — Phase 2 structural-drift gate) — FOUND in `git log`

---
*Phase: 02-redesign-from-screenshot*
*Completed: 2026-05-07*
