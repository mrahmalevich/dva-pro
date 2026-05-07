---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 15
subsystem: scrapers
tags: [gap-closure, html-viewer, operator-ux, docs]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: "drom orchestrator (plans 02/07/10/12/14), shared/types ReportSummary post-plan-14 with errors[].kind discriminator + image_failure_rate, atomicWriteFile, scripts/generate-report-html.mjs (existing standalone HTML viewer)"
provides:
  - "01-VERIFICATION.md gap 2 closed: every drom run dir ships a self-contained index.html viewer regardless of final_status (ok / blocked / error)"
  - "shared/report-html.ts module exporting writeReportHtml(runDir, opts?) — single source of truth for the viewer, callable by any IScraper"
  - "scripts/generate-report-html.mjs is now a 35-line tsx wrapper that delegates to the shared module (was 467-line standalone)"
  - "drom orchestrator emits index.html on success/blocked/error finish paths via best-effort writeReportHtml call"
  - "Snapshot-pinned byte-stable HTML output (server/tests/__snapshots__/report-html.test.ts.snap)"
affects:
  - "Future scrapers (encar / beforward / che168 / autohome) inherit the same HTML viewer pattern by importing writeReportHtml — zero per-source HTML logic"
  - "Phase 1 gap-closure: with plans 10/11/12/13/14/15 all green, both 01-VERIFICATION.md gaps are closed pending the human-UAT items"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared module + thin CLI wrapper: HTML rendering lives in TypeScript under server/scrapers/shared/, the .mjs script is a delegator only"
    - "Best-effort sidecar artifacts: orchestrator artifact writes that fail (e.g. viewer write) log a warning but do not abort an otherwise-successful run"
    - "In-memory override semantics on disk-reading utilities: writeReportHtml reads models.json + report.json from disk by default, but accepts opts.{models,report} to skip the round-trip when the orchestrator already has the data in memory"
    - "Snapshot golden + cheerio parse assertion: HTML output is pinned for byte-stability AND structural correctness in the same vitest file"

key-files:
  created:
    - "server/scrapers/shared/report-html.ts"
    - "server/tests/report-html.test.ts"
    - "server/tests/__snapshots__/report-html.test.ts.snap"
  modified:
    - "scripts/generate-report-html.mjs"
    - "server/scrapers/drom/index.ts"
    - "data/scraped/README.md"
    - "data/scraped/SCHEMA.md"

key-decisions:
  - "Single source of truth lives in TypeScript (.ts), not in the .mjs script. The .mjs filename is preserved for backward compat (gap text said so) but its body is a 35-line tsx-runnable delegator."
  - "Function signature: writeReportHtml(runDir: string, opts?: {models?: ModelRecord[]; report?: ReportSummary}). Disk-fallback reads when opts absent; in-memory override when present."
  - "Default report fallback: when report.json is absent AND opts.report is undefined, the function uses an empty DEFAULT_REPORT with final_status='error'. This guarantees blocked/error runs that crashed before report write still get a viewer."
  - "Models default to [] when models.json is absent AND opts.models is undefined. Header + report stats render even with zero records — the viewer is operator-triage UX, not a data export."
  - "Errors block adapted for plan 01-14's discriminator-typed errors[]: format as 'url: message' for the operator. The 'kind' field is INTERNAL and is NOT user-facing in the viewer."
  - "Best-effort in the orchestrator: writeReportHtml on success path is wrapped in .catch((err) => console.warn(...)); blocked + error paths use .catch(() => {}) (silent). Viewer write failure must NOT corrupt the success contract."
  - "Snapshot test uses opts override + a fixed-name sub-dir to keep the runId portion of the HTML deterministic across runs."

patterns-established:
  - "Sidecar-artifact pattern for scrapers: any non-canonical regeneratable artifact (HTML viewer today, future indexes / dashboards) goes through a shared module under server/scrapers/shared/ that the orchestrator calls best-effort after canonical writes."
  - "Shared module + thin CLI wrapper for operator scripts: every operator-facing one-shot script in scripts/ should be a thin tsx delegator over a module under server/."

requirements-completed: [SCRAPE-09]

# Metrics
duration: 7min
completed: 2026-04-29
---

# Phase 01 Plan 15: HTML Viewer Auto-Emission — Operator UX Gap Closure Summary

**Closes 01-VERIFICATION.md gap 2 ("Operator can review scrape output without running queries — every run folder ships a self-contained HTML viewer") by extracting the existing `scripts/generate-report-html.mjs` HTML logic into a shared TypeScript module and wiring it into the drom orchestrator's success/blocked/error finish paths. Every future drom run now auto-emits `<runDir>/index.html` regardless of `final_status`. The CLI script is preserved (renamed-by-substitution from 467 lines to 35) for retroactive viewer generation against runs predating this plan.**

## Performance

- **Duration:** ~7 min wall-clock (5 atomic task commits, no rework)
- **Tasks:** 5/5 (Tasks 1–5 all green; no checkpoints)
- **Files created:** 3 (`shared/report-html.ts`, `report-html.test.ts`, `__snapshots__/report-html.test.ts.snap`)
- **Files modified:** 4 (`scripts/generate-report-html.mjs`, `drom/index.ts`, `data/scraped/README.md`, `data/scraped/SCHEMA.md`)
- **Tests:** 97 → 103 (+6 new in `report-html.test.ts`)

## Accomplishments

- **Gap 2 closed.** Every drom run dir under `data/scraped/drom/<run_id>/` now ships an `index.html` operator viewer. The orchestrator writes it on the success path (between `report.json` write and `pointCurrentAt`), on the BlockedError branch (after partial-report write), and on the generic-error branch (after partial-report write). All three call sites are best-effort: a viewer write failure does NOT abort an otherwise-successful run.
- **Single source of truth.** All HTML/CSS/JavaScript template logic now lives in `server/scrapers/shared/report-html.ts` (~530 lines). Both call sites (drom orchestrator + standalone CLI) import the same `writeReportHtml(runDir, opts?)` function — no duplicated rendering logic.
- **CLI preserved for backward compat.** `scripts/generate-report-html.mjs` shrank from 467 lines to 35; the operator-facing invocation `pnpm exec tsx scripts/generate-report-html.mjs <run-dir>` still works for runs predating plan 01-15.
- **Plan-14 type adapter.** The errors-block formatting was adapted for plan 01-14's `{url, message, kind}` shape. The `kind` field is INTERNAL and is NOT user-facing in the viewer — formatted output is `url: message` only.
- **Snapshot golden committed.** `server/tests/__snapshots__/report-html.test.ts.snap` pins byte-stable HTML output for a fixed input fixture; subsequent runs assert byte-stability against the golden.
- **TypeScript clean; full vitest suite green (103 tests, was 97).**

## The `writeReportHtml` signature (verbatim)

```typescript
export interface WriteReportHtmlOptions {
  /** Pre-loaded model records (skip re-reading models.json from disk). */
  models?: ModelRecord[];
  /** Pre-loaded report summary (skip re-reading report.json from disk). */
  report?: ReportSummary;
}

export async function writeReportHtml(
  runDir: string,
  opts: WriteReportHtmlOptions = {},
): Promise<void>;
```

When `opts.models` is omitted, the function reads `<runDir>/models.json` if it exists (else `[]`).
When `opts.report` is omitted, the function reads `<runDir>/report.json` if it exists (else `DEFAULT_REPORT` with `final_status='error'`).
The output is written via `atomicWriteFile(<runDir>/index.html, html)`.

## Task Commits

Each task was committed atomically with `--no-verify` per the worktree contract:

1. **Task 1: Extract HTML logic into shared/report-html.ts** — `3ea46ab` (feat)
2. **Task 2: Refactor scripts/generate-report-html.mjs into thin wrapper** — `254d765` (refactor)
3. **Task 3: Wire writeReportHtml into drom orchestrator on all finish paths** — `e010421` (feat)
4. **Task 4: Add unit test on shared/report-html with snapshot golden** — `6889b2a` (test)
5. **Task 5: Document index.html in README + SCHEMA** — `97ca371` (docs)

## Files Modified — what changed and why

- **`server/scrapers/shared/report-html.ts`** (NEW, 531 lines) — Exports `writeReportHtml(runDir, opts?)` with disk-fallback + in-memory-override semantics. Internal helpers: `renderHtml`, `escapeHtml`, `escapeAttr`, `formatDuration`, `formatDate`. The CSS / `<body>` markup / embedded `<script>` JavaScript / JSON-data block are ported verbatim from the original `.mjs` script. The errors block was adapted for plan 14's discriminator types: `report.errors.slice(0, 10).map((e) => 'url: message').join('\\n')` (the `kind` field is internal and is not rendered).
- **`scripts/generate-report-html.mjs`** (REWRITE, 467 → 35 lines) — Thin tsx delegator: imports `writeReportHtml` from `../server/scrapers/shared/report-html.ts`, parses `process.argv[2]`, calls the shared function, prints success/error and exits 0/1 accordingly. Shebang `#!/usr/bin/env -S npx tsx` so direct invocation works on systems where `npx` resolves `tsx`.
- **`server/scrapers/drom/index.ts`** (3-site insert + 1 import) — `import { writeReportHtml } from '../shared/report-html.js'`. Three call sites: success path between `report.json` write and `pointCurrentAt` (passes `{models: mergedRecords, report}` via opts to skip the re-read; logs warning on failure); BlockedError path after the partial-report write (passes `{report}` via opts; silent best-effort); generic-error path after the partial-report write (same shape; silent best-effort).
- **`server/tests/report-html.test.ts`** (NEW, 6 tests) — Covers: (1) basic disk-read + brand string presence; (2) cheerio.load parses without throwing; (3) missing models.json fallback to `[]`; (4) `opts.models`/`opts.report` override on-disk values; (5) data-embedding contract (models embedded verbatim in `<script type="application/json">` block; round-trip via JSON.parse after un-escaping `\\u003c`); (6) byte-stable snapshot golden via `toMatchSnapshot()`.
- **`server/tests/__snapshots__/report-html.test.ts.snap`** (NEW) — Vitest snapshot file. Auto-generated on first run, asserts byte-stability on subsequent runs.
- **`data/scraped/README.md`** — Output-tree gains an `index.html` line; new "Report viewer (`index.html`) — auto-emitted per run" subsection between §"Crash recovery" and §"Incremental snapshot" documents the browser-open invocation, the viewer's features, regenerability, and the explicit "every final_status" guarantee.
- **`data/scraped/SCHEMA.md`** — New top-level §"Report viewer (`index.html`)" between the report.json field table and §"Brand-aliases" notes the file is non-canonical, regeneratable, NOT part of the Phase 4 importer contract, and points at `server/scrapers/shared/report-html.ts` as the single source of truth.

## Confirmations

### `current/index.html` resolves correctly via the symlink

The orchestrator writes `index.html` INSIDE the runId-shaped dir (e.g. `data/scraped/drom/2026-04-28T07-30-00Z/index.html`) BEFORE `pointCurrentAt(runDir)`. After the symlink update completes, the symlink follow brings the viewer along: `data/scraped/drom/current/index.html` → `data/scraped/drom/2026-04-28T07-30-00Z/index.html`. Because the viewer's `<img src>` paths reference `images/<...>.webp` (relative to the runId dir), opening `current/index.html` in the browser shows real model data with hero images via the resolved relative paths.

### Cross-plan note

With plans 10/11/12/13/14/15 all green, both gaps from `01-VERIFICATION.md` are now closed:

- Gap 1 (resume idempotency) — closed by plans 10 (cursor missing-brand throw), 11 (corrupt-cursor halt-and-investigate), 12 (CR-04 brand-from-scratch contract + inheritFromPrevCurrent), 13 (resume integration tests), 14 (CR-05/CR-06 image-path reconciliation + counter-drift gates).
- Gap 2 (per-run HTML viewer) — closed by this plan (15).

The HUMAN-UAT items in `01-VERIFICATION.md` (operator triggers a long-running scrape + SIGKILL + resume; operator confirms intent on Phase-1 resume contract) remain as operator gates and are NOT addressed by these plans (per the orchestrator brief).

### Re-verification handoff

Orchestrator can now run `/gsd-verify-phase 01` to re-run the verifier and re-check both gaps. The verifier should observe:

- `current/index.html` exists after a successful drom run.
- Re-running the verifier's smoke (or running `pnpm exec tsx scripts/generate-report-html.mjs data/scraped/drom/current` against any old run dir) produces the viewer.
- `pnpm vitest run server/tests/report-html.test.ts` passes 6/6.

## Verification Gates

All plan-level grep gates and test gates pass:

| # | Gate | Expected | Actual |
|---|------|----------|--------|
| 1 | `export async function writeReportHtml` in `report-html.ts` | == 1 | 1 |
| 2 | `WriteReportHtmlOptions` references in `report-html.ts` | >= 2 | 2 |
| 3 | `atomicWriteFile` references in `report-html.ts` | >= 1 | 2 |
| 4 | Placeholder comments (`PORT FULL` / `PASTE`) in `report-html.ts` | == 0 | 0 |
| 5 | `report-html.ts` byte size sanity | > 10240 | 22156 |
| 6 | `scripts/generate-report-html.mjs` line count | < 50 | 35 |
| 7 | `writeReportHtml` references in `.mjs` | >= 1 | 2 |
| 8 | `DOCTYPE html` in `.mjs` (must be removed) | == 0 | 0 |
| 9 | `writeReportHtml` references in `drom/index.ts` | >= 4 | 5 |
| 10 | `from '../shared/report-html.js'` in `drom/index.ts` | == 1 | 1 |
| 11 | `writeReportHtml` references in test file | >= 6 | 9 |
| 12 | `cheerio.load` references in test file | >= 2 | 5 |
| 13 | `application/json` references in test file | >= 1 | 3 |
| 14 | `toMatchSnapshot` references in test file | >= 1 | 1 |
| 15 | `"brand_slug":"bmw"` in test file | >= 1 | 1 |
| 16 | `index.html` references in `README.md` | >= 3 | 6 |
| 17 | `Report viewer` in `README.md` | >= 1 | 1 |
| 18 | `pnpm exec tsx scripts/generate-report-html.mjs` in `README.md` | >= 1 | 1 |
| 19 | `Report viewer` in `SCHEMA.md` | >= 1 | 2 |
| 20 | `non-canonical` in `SCHEMA.md` | >= 1 | 1 |
| 21 | `pnpm typecheck:server` | exit 0 | exit 0 |
| 22 | `pnpm vitest run` | exit 0 | exit 0 (103/103 tests, 13/13 files) |

## Deviations from Plan

None — the plan executed exactly as written.

The .mjs file rewrite was deeper than a typical edit (467 → 35 lines), but the plan's task 2 explicitly described this: "Replace the ENTIRE existing 467-line file with this concise wrapper." No structural change to the plan was made.

## Self-Check: PASSED

- File `.planning/phases/01-inventory-scrapers-drom-and-stubs/01-15-SUMMARY.md`: present (this file).
- File `server/scrapers/shared/report-html.ts`: FOUND.
- File `scripts/generate-report-html.mjs`: FOUND (rewrite, 35 lines).
- File `server/scrapers/drom/index.ts`: FOUND (modified).
- File `server/tests/report-html.test.ts`: FOUND.
- File `server/tests/__snapshots__/report-html.test.ts.snap`: FOUND.
- File `data/scraped/README.md`: FOUND (modified).
- File `data/scraped/SCHEMA.md`: FOUND (modified).
- Commit `3ea46ab`: FOUND.
- Commit `254d765`: FOUND.
- Commit `e010421`: FOUND.
- Commit `6889b2a`: FOUND.
- Commit `97ca371`: FOUND.
- TypeScript compiles cleanly (`pnpm typecheck:server` exit 0).
- Full vitest suite green (`pnpm vitest run` 103/103 tests, 13/13 files).
