---
phase: 01-inventory-scrapers-drom-and-stubs
verified: 2026-04-29T15:10:00Z
status: passed
score: 10/10 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 9/10
  gaps_closed:
    - "Gap 1: Re-running the scraper twice in a row produces a consistent JSON dataset (idempotent) — closed by plans 01-10 (CR-01/02/03 sort+throw), 01-11 (WR-04 CursorSchema + CorruptCursorError), 01-12 (CR-04 re-scrape cursored brand contract), 01-13 (IN-07 resume integration tests), 01-14 (CR-05/CR-06 image-path reconciliation + split abort gates), 01-16 (BLOCKER 1 brand-root cursor path)"
    - "Gap 2: Operator can review scrape output without running queries — closed by plan 01-15 (writeReportHtml shared module + orchestrator wiring on success/blocked/error)"
  gaps_remaining: []
  regressions: []
  human_verification_resolved:
    - "Resume correctness — operator decision to fix-before-sign-off was taken (Phase 01 plans 10..16 closed every CR/WR/IN review item rather than ship with documented limitations). The original `human_needed` items asked the operator to choose between 'accept and ship' vs 'fix before sign-off'; the operator picked option B and the resulting plans landed."
    - "Resume contract semantics — README §'Crash recovery' rewritten by plan 01-12 to honestly describe the 're-scrapes the cursored brand from scratch' contract. The misleading 'resume from the next model after lastModelSlug' claim is gone; the new 6-bullet contract names inheritFromPrevCurrent (preservation), CorruptCursorError (halt-and-investigate), missing-brand throw, and the brand-root cursor path."
gap_closure_verification:
  - cr_id: "CR-01"
    title: "Cursor resume restarts entire catalog when lastBrandSlug is no longer in DOM"
    closed_by: "plan 01-10"
    status: PASS
    evidence:
      - "server/scrapers/drom/index.ts:271-285 — explicit `if (cursor) { const idx = ... ; if (idx === -1) throw ... }` guard replaces `Math.max(0, findIndex(...))`"
      - "Throw message at line 278-282 quotes the missing brand_slug and instructs the operator to delete .cursor.json explicitly"
      - "grep -nE 'Math\\.max\\(0,\\s*(brands|models)\\.findIndex' server/scrapers/drom/index.ts → 0 matches"
      - "Resume integration test at server/tests/drom-integration.test.ts:747 ('resumes from cursored brand and skips earlier brands (CR-01 fix)') exercises the no-silent-restart path against a 3-brand fixture"
  - cr_id: "CR-02"
    title: "Cursor model-resume restarts entire brand when lastModelSlug has no greater successor"
    closed_by: "plan 01-10 (throw guard) + plan 01-12 (CR-04 contract supersedes positioning)"
    status: PASS
    evidence:
      - "server/scrapers/drom/index.ts:315-331 — `if (idx === -1) throw ...` defensive guard preserved (cursor-drift signal); positioning is independent (CR-04 contract pins startFromModelIndex = 0)"
      - "Plan 01-12 made CR-02 functionally moot for happy-path resume because the cursored brand is now re-scraped from scratch regardless of model index — but the throw is intentionally retained as cursor-drift telemetry"
  - cr_id: "CR-03"
    title: "Cursor logic assumed lexicographic order; parsers return DOM order"
    closed_by: "plan 01-10"
    status: PASS
    evidence:
      - "server/scrapers/drom/index.ts:262-264 — `const brands = [...filteredBrands].sort((a, b) => a.brand_slug.localeCompare(b.brand_slug))` orchestrator-side alphabetic sort before cursor compare"
      - "server/scrapers/drom/index.ts:299-301 — same sort on parsedModels via `m.model_slug.localeCompare(b.model_slug)`"
      - "grep -c 'localeCompare' server/scrapers/drom/index.ts → 2 (one per loop level)"
      - "Resume integration test at server/tests/drom-integration.test.ts:817 ('sorts non-alphabetic DOM order before applying cursor (CR-03 fix)') seeds brands in [lada, bmw, audi] DOM order with cursor 'bmw' → asserts post-sort iteration is [bmw, lada]"
  - cr_id: "CR-04"
    title: "Aborted brand-aliases entries lost on the next resume"
    closed_by: "plan 01-12 (re-scrape cursored brand contract) + d3bad88 (inheritFromPrevCurrent precondition)"
    status: PASS
    evidence:
      - "server/scrapers/drom/index.ts:303-331 — orchestrator pins `startFromModelIndex = 0` for the cursored brand; explicit comment block names CR-04 contract and inheritFromPrevCurrent precondition"
      - "server/scrapers/drom/index.ts:87-167 — inheritFromPrevCurrent copies records + images from prev `current/` snapshot before scraping starts so OTHER brands' data is preserved across runs"
      - "data/scraped/README.md §'Crash recovery (D-15) — resume contract' bullet 1 (inheritFromPrevCurrent), bullet 2 ('re-scrapes the cursored brand from scratch' verbatim), bullet 6 ('on clean completion .cursor.json is deleted')"
      - "Source-level contract test at server/tests/drom-cr04-contract.test.ts (5 assertions) locks the file-text invariant — no future maintainer can silently un-pin"
      - "Resume integration test at server/tests/drom-integration.test.ts:976 ('CR-04 contract: cursored brand is re-scraped from scratch (all its models present after resume)') exercises the contract end-to-end"
      - "grep -c 're-scrapes the cursored brand from scratch' data/scraped/README.md → 1; grep -c 'resume from the next model after' → 0"
  - cr_id: "CR-05"
    title: "image_paths decision desynchronized between list and page parsers"
    closed_by: "plan 01-14"
    status: PASS
    evidence:
      - "server/scrapers/drom/parse-generation-page.ts:47 — `heroImageUrl?: string` added to GenerationPageContext"
      - "server/scrapers/drom/parse-generation-page.ts:228-232 — image_paths now derives from `ctx.heroImageUrl` (single source of truth) instead of re-running extractHeroImageUrl(html)"
      - "server/scrapers/drom/index.ts:357 — orchestrator passes `heroImageUrl: gen.hero_image_url` from parseGenerationList into parseGenerationPage ctx"
      - "server/scrapers/drom/index.ts:389-390 — on image-fetch failure orchestrator clears `record.image_paths = []` BEFORE serialization, eliminating orphan-path desync entirely (CR-05 contract)"
      - "Counter-drift test at server/tests/drom-integration.test.ts (counter-drift guard) asserts exactly 1 record with `image_paths === []` when an image fetch fails synthetically"
  - cr_id: "CR-06"
    title: "Image-fetch failures abort runs by misclassification as DOM regressions"
    closed_by: "plan 01-14"
    status: PASS
    evidence:
      - "server/scrapers/shared/types.ts:39 — `errors[]` element type widened with required `kind: 'parse' | 'image' | 'orchestrator' | 'inherit'` discriminator"
      - "server/scrapers/drom/index.ts:382-388 — image push site tagged `kind: 'image'`; pushes to `images_failed` (not `images_skipped`)"
      - "server/scrapers/drom/index.ts:395-400 — parse push site tagged `kind: 'parse'`"
      - "server/scrapers/drom/index.ts:506-510 — orchestrator catch tagged `kind: 'orchestrator'`"
      - "server/scrapers/drom/index.ts:127-131 + 156-161 — both inheritFromPrevCurrent push sites tagged `kind: 'inherit'`"
      - "server/scrapers/drom/index.ts:423-432 — parse-only 10% gate: `report.errors.filter((e) => e.kind === 'parse').length` — image errors no longer cross-contaminate the DOM-regression denominator"
      - "server/scrapers/drom/index.ts:434-447 — bounded image-fetch gate: aborts only when `imagesAttempted >= 20 AND images_failed/imagesAttempted > 0.20`"
      - "server/scrapers/shared/types.ts — `images_failed` and `image_failure_rate` fields added to ReportSummary; surfaced in report.json for operator review when below abort threshold"
  - cr_id: "WR-04"
    title: "readCursor swallows JSON parse errors and lacks shape validation"
    closed_by: "plan 01-11 (CursorSchema + CorruptCursorError) + plan 01-13 (orchestrator outer-try lift so throw surfaces as ScrapeResult)"
    status: PASS
    evidence:
      - "server/scrapers/shared/cursor.ts:23-27 — `CursorSchema = z.object({ lastBrandSlug, lastModelSlug, completedAt: z.string().datetime() })` zod schema"
      - "server/scrapers/shared/cursor.ts:36-41 — `CorruptCursorError extends Error` with `cause` property"
      - "server/scrapers/shared/cursor.ts:48-76 — readCursor distinguishes ENOENT (returns null) from corrupt JSON (throws CorruptCursorError) from shape mismatch (throws CorruptCursorError) from other ErrnoException (propagates unchanged)"
      - "server/tests/cursor.test.ts (10 tests including: 'readCursor throws CorruptCursorError when .cursor.json is corrupt JSON (WR-04 fix)', 'readCursor throws CorruptCursorError when .cursor.json has shape mismatch', 'readCursor throws CorruptCursorError when a field is the wrong type', 'readCursor propagates non-ENOENT read errors unchanged')"
      - "server/scrapers/drom/index.ts:225-235 — readCursor moved inside the outer try/catch by plan 01-13, so a thrown CorruptCursorError now surfaces as `{status: 'error'}` per IScraper contract"
      - "Resume integration test at server/tests/drom-integration.test.ts:894 ('returns status=error when readCursor throws CorruptCursorError (WR-04 fix)') asserts the end-to-end ScrapeResult contract"
  - cr_id: "IN-07"
    title: "Resume code path has zero integration coverage"
    closed_by: "plan 01-13 (4 new resume integration tests) + plan 01-16 (cross-invocation flow test)"
    status: PASS
    evidence:
      - "server/tests/drom-integration.test.ts:680-1011 — new describe block 'drom orchestrator resume path (gap-closure 01-13: CR-01..CR-04, IN-07)' with 4 it() cases"
      - "Test 1 (line 747): 'resumes from cursored brand and skips earlier brands (CR-01 fix)' — pins CR-01"
      - "Test 2 (line 817): 'sorts non-alphabetic DOM order before applying cursor (CR-03 fix)' — pins CR-03"
      - "Test 3 (line 894): 'returns status=error when readCursor throws CorruptCursorError (WR-04 fix)' — pins WR-04 + IScraper contract"
      - "Test 4 (line 976): 'CR-04 contract: cursored brand is re-scraped from scratch (all its models present after resume)' — pins CR-04"
      - "grep -c 'drom\\.run\\(\\{ resume: true \\}\\)' server/tests/drom-integration.test.ts → 4 (was 0 at prior verification)"
      - "Plan 01-16 added a fifth resume test at line 567 ('cross-invocation cursor flow: cursor written by run N is read by run N+1') that exercises the real readCursor/writeCursor against the brand-root path"
  - cr_id: "Gap 2 (verification gap)"
    title: "Operator can review scrape output without running queries — every run folder ships a self-contained HTML viewer"
    closed_by: "plan 01-15"
    status: PASS
    evidence:
      - "server/scrapers/shared/report-html.ts (NEW, 531 lines) — exports `writeReportHtml(runDir, opts?)` as single source of truth; both call sites (orchestrator + CLI script) import the same function"
      - "scripts/generate-report-html.mjs (35 lines, was 467) — thin tsx delegator that imports writeReportHtml from the shared module; preserves backward compat for retroactive viewer generation against pre-plan-15 runs"
      - "server/scrapers/drom/index.ts:44 — `import { writeReportHtml } from '../shared/report-html.js'`"
      - "server/scrapers/drom/index.ts:465-470 — success path: `writeReportHtml(runDir, { models: mergedRecords, report })` between report.json write and pointCurrentAt; best-effort with warning on failure"
      - "server/scrapers/drom/index.ts:495 — BlockedError path: `writeReportHtml(runDir, { report })` after partial-report write; silent best-effort"
      - "server/scrapers/drom/index.ts:516 — generic-error path: `writeReportHtml(runDir, { report })` after partial-report write; silent best-effort"
      - "server/tests/report-html.test.ts (6 tests, all passing): basic disk read + brand string presence; cheerio.load parses without throwing; missing models.json fallback to []; opts.{models,report} override; data-embedding contract; byte-stable snapshot golden"
      - "server/tests/__snapshots__/report-html.test.ts.snap pinned"
      - "data/scraped/drom/current/index.html exists on disk (262KB), regenerated retroactively against the pre-existing smoke-run dir"
      - "data/scraped/README.md §'Report viewer (index.html) — auto-emitted per run' documents the auto-emission contract; SCHEMA.md §'Report viewer (index.html)' marks as non-canonical and not part of Phase 4 importer contract"
  - cr_id: "BLOCKER 1 (plan-checker review)"
    title: "Cross-invocation cursor flow undefined — readCursor read from per-runId paths that fresh runs cannot find"
    closed_by: "plan 01-16"
    status: PASS
    evidence:
      - "server/scrapers/shared/cursor.ts — `CURSOR_FILENAME` constant removed (`grep -c CURSOR_FILENAME` → 0)"
      - "server/scrapers/shared/cursor.ts:48,82,89 — readCursor/writeCursor/deleteCursor signature changed to take `cursorPath: string` (caller-owned path)"
      - "server/scrapers/drom/index.ts:200 — `const cursorPath = resolve(runRoot, '.cursor.json')` computed once at the top of run() at the brand-root path (NOT inside per-runId dir)"
      - "server/scrapers/drom/index.ts:233, 407, 472 — readCursor/writeCursor/deleteCursor all called with cursorPath (`grep -cE '(readCursor|writeCursor|deleteCursor)\\(runDir' server/scrapers/drom/index.ts` → 0)"
      - "server/tests/cursor.test.ts (10 tests, all passing) — every test passes cursorPath explicitly via mkdtemp+resolve"
      - "server/tests/drom-integration.test.ts:567 — 'cross-invocation cursor flow: cursor written by run N is read by run N+1 (BLOCKER 1 fix, plan 01-16)' — real-FS test with real readCursor/writeCursor (NO vi.doMock cursor module): run 1 throws on x5, asserts cursor file present at brand-root path with lastModelSlug='x3'; run 2 with resume:true reads same path and completes ok with cursor_resumed=true"
      - "data/scraped/README.md:44 layout diagram shows .cursor.json at brand-root level; bullet 4 of §'Crash recovery' explicitly names brand-root path; `grep -c 'data/scraped/drom/.cursor.json' data/scraped/README.md` → 1"
gap_closure_summary: "All 7 gap-closure plans (01-10..01-16) verified against actual codebase state, not SUMMARY.md claims. Every CR-NN / WR-NN / IN-NN / Gap-N / BLOCKER item identified by 01-REVIEW.md and the prior 01-VERIFICATION.md is closed with code-on-disk evidence at named line ranges. 108 tests pass; typecheck exits 0."
---

# Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs Verification Report

**Phase Goal:** Build a runnable scraping pipeline that produces deterministic, importable artifacts on disk — `cars.json` records and WebP images — *without* any backend infrastructure (no DB, no cloud, no queue). The drom.ru/catalog scraper is real and end-to-end; Encar / BeForward / Che168 / Autohome modules implement the same `IScraper` contract but return `{ status: 'not_implemented' }` plus a TODO log line, so the contract is locked and future fillers don't have to invent it.

**Verified:** 2026-04-29T15:10:00Z (re-verification after gap closure)
**Status:** passed
**Re-verification:** Yes — all gaps from prior verification (2026-04-28T16:02:34Z) closed by plans 01-10..01-16

## Re-Verification Summary

The prior verification (2026-04-28) identified 1 partial truth (must-have #9 — re-run idempotency / resume code path) plus 1 missing artifact (Gap 2 — per-run HTML viewer auto-emission). The 01-REVIEW code review identified 6 critical findings (CR-01..CR-06), 1 supporting warning (WR-04), and 1 integration-coverage gap (IN-07). A subsequent plan-checker review against the gap-closure plans surfaced 1 structural blocker (cross-invocation cursor flow / BLOCKER 1).

Seven gap-closure plans landed atomically between 2026-04-29T07:00Z and 2026-04-29T14:00Z:

| Plan | Closes | Verified |
|------|--------|----------|
| 01-10 | CR-01, CR-02, CR-03 | PASS |
| 01-11 | WR-04 | PASS |
| 01-12 | CR-04 | PASS |
| 01-13 | IN-07 (also pins 01-10/01-11/01-12 end-to-end; auto-fixed an IScraper-contract bug) | PASS |
| 01-14 | CR-05, CR-06 | PASS |
| 01-15 | Gap 2 (HTML viewer auto-emission) | PASS |
| 01-16 | BLOCKER 1 (cross-invocation cursor flow) | PASS |

Per-item evidence is captured in the `gap_closure_verification:` block in this file's frontmatter (10 closure items × 4–8 evidence pointers each, all citing file:line ranges in the actual codebase, not SUMMARY.md claims).

## Goal Achievement

The phase ships a working drom scraper validated end-to-end against live drom.ru (200 records, 200 WebP images, readable Cyrillic, 0 blocks, 0 errors from the prior smoke run). The IScraper contract is locked across 4 stubs; the 5 v1-blocking SCRAPE-* requirements (05, 06, 09, 10, 11) are satisfied by code + smoke evidence; SCRAPE-01..04 are satisfied as stubs per the explicit Phase 1 scope reduction.

The single material gap from the prior verification (must-have #9 — resume idempotency under the documented `resume: true` code path) is now fully closed:

- **Logic correctness** — CR-01..CR-04 fixed by plans 01-10 / 01-12 with file-text contract tests pinning the invariants.
- **File-system correctness** — BLOCKER 1 fixed by plan 01-16 moving the cursor file to the brand-root path so cross-invocation resume actually works.
- **Robustness** — WR-04 fixed by plan 01-11 (zod CursorSchema + CorruptCursorError) so corrupt cursors halt-and-investigate instead of silently re-starting.
- **Image-path consistency** — CR-05/CR-06 fixed by plan 01-14 (single-source-of-truth heroImageUrl + split parse/image abort gates + image_failure_rate report field).
- **Integration coverage** — IN-07 fixed by plans 01-13 (4 resume tests via vi.doMock) and 01-16 (1 real-FS cross-invocation test). All resume code paths now have at least one integration test.

The phase is functionally complete. The two human-verification items from the prior verification (operator decision on resume correctness; operator decision on resume contract semantics) are resolved: the operator chose to fix-before-sign-off rather than ship with documented limitations, and the resulting plans 10..16 landed.

### Observable Truths

| # | Truth (from ROADMAP.md SC-1..10) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | `pnpm scrape:drom` executes end-to-end on fresh `git clone`, exits 0, writes models.json + images/*.webp | ✓ VERIFIED | (unchanged from 2026-04-28) `package.json:14` declares `pnpm scrape:drom`; smoke #3 ran end-to-end producing 200 records + 200 WebPs in `data/scraped/drom/current/`; report.json `final_status='ok'`, exit 0. CLI dispatcher (`server/scrapers/cli.ts`) wires `EXIT_CODES = {ok:0,...}`. README §Quick start documents the command. |
| 2 | Documented JSON contract at `data/scraped/SCHEMA.md` with every field of a record | ✓ VERIFIED | (unchanged) `data/scraped/SCHEMA.md` exists with full ModelRecord field table. Updated by plan 01-15 to add §"Report viewer (index.html)" as non-canonical artifact, and by plan 01-14 implicitly via ReportSummary type changes. |
| 3 | IScraper interface defined; 4 stubs return `not_implemented`; `pnpm scrape:<source>` exits non-zero (CI-detectable) | ✓ VERIFIED | (unchanged) `server/scrapers/shared/types.ts:54-57` exports IScraper; each of 4 stub `index.ts` files returns `{status:'not_implemented', source, deferredTo:'v1.x', todo:...}`; cli.ts EXIT_CODES maps `not_implemented → 2`. 12 stub tests in `server/tests/stubs.test.ts`. |
| 4 | CBR daily FX XML cached; stale-fallback documented | ✓ VERIFIED | (unchanged) `data/scraped/fx/cbr-2026-04-28.json` present; `server/scrapers/shared/fx.ts` implements D-12. |
| 5 | Cyrillic↔Latin brand/model lookup auto-built; `data/scraped/drom/brand-aliases.json` idempotent merge | ✓ VERIFIED | (unchanged) `data/scraped/drom/brand-aliases.json` populated; `mergeAliases` in `shared/brand-aliases.ts` does sort-then-write under `atomicWriteFile`. CR-04 contract (plan 01-12) ensures partial brand-aliases entries are reconstructed on resume because the cursored brand is re-scraped from scratch and `mergeAliases` runs at end-of-brand on the complete set. |
| 6 | Image pipeline downloads source → WebP via sharp, naming `<brand_slug>-<model_slug>-<index>.webp` | ✓ VERIFIED | (unchanged) `current/images/` contains 200 `.webp` files. Plan 01-14 added CR-05 reconciliation: `image_paths` in models.json now reflects ONLY images that successfully landed on disk (orchestrator clears `record.image_paths = []` on download failure). |
| 7 | Run report JSON captures all D-17 fields | ✓ VERIFIED | (unchanged) `current/report.json` contains all D-17 fields. Plan 01-14 added two new fields: `images_failed` and `image_failure_rate` for CR-06 telemetry; plan 01-15 extended SCHEMA.md to document them. |
| 8 | Block-detection logic exists; halts run; writes `report.json` with `status:'blocked'` | ✓ VERIFIED | (unchanged) `shared/block-detection.ts` exports `BlockDetector` and `BlockedError`; orchestrator catches `BlockedError`. Plan 01-15 added a `writeReportHtml` call on the BlockedError path so blocked runs also produce an operator viewer. |
| 9 | Re-running the scraper twice in a row produces a consistent JSON dataset (idempotent). Diff bounded to expected drom-side changes. | ✓ VERIFIED (was PARTIAL) | **Single-run determinism** (unchanged from 2026-04-28): smoke #3 produced a complete clean run with 200 deterministic records. **Resume-path determinism** (newly verified): 5 resume integration tests pin the contract (4 via vi.doMock cursor module per plan 01-13, 1 real-FS test per plan 01-16). All 7 review findings against the resume path (CR-01..CR-04, WR-04, IN-07, BLOCKER 1) closed with code evidence per the `gap_closure_verification:` frontmatter block. |
| 10 | README at `data/scraped/README.md` explains run, output, stubs, Phase 4 importer | ✓ VERIFIED | (unchanged) Plan 01-12 rewrote §"Crash recovery" to honestly describe the resume contract. Plan 01-15 added §"Report viewer (index.html) — auto-emitted per run". Plan 01-16 updated the directory-layout diagram to show .cursor.json at the brand-root level. |

**Score:** 10 / 10 truths verified (was 9/10 partial)

### Required Artifacts

| Artifact | Status | Re-verification details |
|----------|--------|---------------------------|
| `package.json` (scrape scripts) | ✓ VERIFIED | (unchanged) |
| `server/scrapers/cli.ts` | ✓ VERIFIED | (unchanged) |
| `server/scrapers/shared/types.ts` | ✓ VERIFIED | Plan 01-14 widened `errors[]` element type with `kind` discriminator (required at compile time); added `images_failed`, `image_failure_rate` to ReportSummary. |
| `server/scrapers/drom/index.ts` | ✓ VERIFIED | Plans 01-10 (sort-before-compare + throw guards), 01-12 (CR-04 pin), 01-13 (readCursor inside outer try; const c capture), 01-14 (heroImageUrl ctx pass; kind classifications; split abort gates; CR-05 image_paths clear), 01-15 (writeReportHtml call on all 3 finish paths), 01-16 (cursorPath at brand-root). |
| `server/scrapers/{encar,beforward,che168,autohome}/index.ts` | ✓ VERIFIED | (unchanged) |
| `server/scrapers/shared/cursor.ts` | ✓ VERIFIED | Plan 01-11 added CursorSchema + CorruptCursorError + zod-validating readCursor. Plan 01-16 changed signatures to take `cursorPath: string` (caller-owned path); removed `CURSOR_FILENAME` constant. |
| `server/scrapers/shared/report-html.ts` | ✓ VERIFIED (NEW per plan 01-15) | 531 lines; exports `writeReportHtml(runDir, opts?)`; single source of truth for the operator viewer. Used by both the orchestrator and the standalone CLI wrapper. |
| `scripts/generate-report-html.mjs` | ✓ VERIFIED | Plan 01-15 rewrote 467 → 35 lines as a thin tsx delegator over `shared/report-html.ts`. Preserved for retroactive viewer generation against runs predating plan 01-15. |
| `server/scrapers/drom/parse-generation-page.ts` | ✓ VERIFIED | Plan 01-14 added `heroImageUrl?: string` to GenerationPageContext; image_paths derives from ctx.heroImageUrl as single source of truth. |
| `data/scraped/SCHEMA.md` | ✓ VERIFIED | Plan 01-15 added §"Report viewer (index.html)" section as non-canonical artifact. |
| `data/scraped/README.md` | ✓ VERIFIED | Plan 01-12 rewrote §"Crash recovery" with 6-bullet contract including 're-scrapes the cursored brand from scratch'. Plan 01-15 added §"Report viewer". Plan 01-16 updated layout diagram to show .cursor.json at brand-root. |
| `data/scraped/drom/brand-aliases.json` | ✓ VERIFIED | (unchanged) |
| `data/scraped/drom/current/` (symlink) | ✓ VERIFIED | (unchanged) |
| `data/scraped/drom/current/models.json` | ✓ VERIFIED | (unchanged from smoke #3) |
| `data/scraped/drom/current/report.json` | ✓ VERIFIED | (unchanged from smoke #3 — pre-dates plan 01-14, so does not have `images_failed`/`image_failure_rate` fields. Future runs will include them.) |
| `data/scraped/drom/current/index.html` | ✓ VERIFIED (NEW per plan 01-15) | 262 KB, generated retroactively via `pnpm exec tsx scripts/generate-report-html.mjs data/scraped/drom/current` against the smoke-run dir. Future runs auto-emit it. |
| `data/scraped/drom/current/images/*.webp` | ✓ VERIFIED | (unchanged from smoke #3) |
| `data/scraped/fx/cbr-2026-04-28.json` | ✓ VERIFIED | (unchanged) |
| `server/tests/cursor.test.ts` | ✓ VERIFIED | 10 tests (was 6); plan 01-11 added 4 (corrupt JSON throw, shape mismatch, wrong type, EACCES propagation); plan 01-16 updated all sites to pass cursorPath explicitly. |
| `server/tests/drom-integration.test.ts` | ✓ VERIFIED | 8 tests (was 1); plans 01-13 (+4 resume tests), 01-14 (+1 counter-drift test), 01-16 (+1 cross-invocation test). |
| `server/tests/drom-cr04-contract.test.ts` (NEW per plan 01-12) | ✓ VERIFIED | 5 file-text contract assertions locking `startFromModelIndex = 0` invariant. |
| `server/tests/report-html.test.ts` (NEW per plan 01-15) | ✓ VERIFIED | 6 tests including byte-stable snapshot golden. |
| `server/tests/__snapshots__/report-html.test.ts.snap` (NEW per plan 01-15) | ✓ VERIFIED | Pinned. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `cli.ts` | `drom/index.ts` | SCRAPERS map import | ✓ WIRED (unchanged) |
| `drom/index.ts` | `shared/cursor.ts` | imports readCursor/writeCursor/deleteCursor + Cursor + (NEW) CorruptCursorError | ✓ WIRED |
| `drom/index.ts` | `shared/report-html.ts` (NEW) | `import { writeReportHtml } from '../shared/report-html.js'` | ✓ WIRED at line 44 |
| `drom/index.ts` (success path) | `writeReportHtml(runDir, {models, report})` | best-effort call between report.json write and pointCurrentAt (line 465) | ✓ WIRED |
| `drom/index.ts` (BlockedError path) | `writeReportHtml(runDir, {report})` | best-effort call after partial-report write (line 495) | ✓ WIRED |
| `drom/index.ts` (generic-error path) | `writeReportHtml(runDir, {report})` | best-effort call after partial-report write (line 516) | ✓ WIRED |
| `drom/index.ts` | brand-root `.cursor.json` path | `const cursorPath = resolve(runRoot, '.cursor.json')` at line 200 (NOT inside per-runId dir) | ✓ WIRED (BLOCKER 1 fix) |
| `parse-generation-page.ts` | `image_paths` decision | `ctx.heroImageUrl` (single source of truth) | ✓ WIRED (CR-05 fix) |
| `drom/index.ts` parse error path | `report.errors.push({kind: 'parse', ...})` | typed-discriminator push site | ✓ WIRED (CR-06 fix) |
| `drom/index.ts` image error path | `report.errors.push({kind: 'image', ...})` + `images_failed++` + `record.image_paths = []` | typed-discriminator push + counter + reconciliation | ✓ WIRED (CR-05 + CR-06) |
| `drom/index.ts` parse-gate denominator | `report.errors.filter((e) => e.kind === 'parse').length` (line 426) | filtered-by-kind | ✓ WIRED (CR-06 fix) |
| `drom/index.ts` image-gate threshold | `imagesAttempted >= 20 AND failureRate > 0.20` (line 442) | bounded-floor gate | ✓ WIRED (CR-06 fix) |
| `scripts/generate-report-html.mjs` | `shared/report-html.ts` | thin delegator imports writeReportHtml | ✓ WIRED |
| Cross-invocation cursor flow | run N writeCursor → run N+1 readCursor at SAME brand-root path | real-FS integration test at line 567 | ✓ WIRED (BLOCKER 1 fix) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript type-check passes | `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 | ✓ PASS (re-run by verifier 2026-04-29T15:05Z) |
| Vitest suite passes | `pnpm vitest run` | 108/108 tests across 13 files; 22.78s | ✓ PASS (re-run by verifier 2026-04-29T15:04Z) |
| No `Math.max(0, findIndex(...))` silent restart | `grep -nE 'Math\\.max\\(0,\\s*(brands\\|models)\\.findIndex' server/scrapers/drom/index.ts` | 0 matches (exit 1) | ✓ PASS |
| `localeCompare` sort present | `grep -c 'localeCompare' server/scrapers/drom/index.ts` | 2 | ✓ PASS |
| `CursorSchema` + `CorruptCursorError` exported | `grep -c 'CursorSchema\\|CorruptCursorError' server/scrapers/shared/cursor.ts` | 8 | ✓ PASS |
| CR-04 contract pin in code | `grep -c 'CR-04 contract\\|startFromModelIndex = 0' server/scrapers/drom/index.ts` | 3 | ✓ PASS |
| CR-04 contract phrase in README | `grep -c 're-scrapes the cursored brand from scratch' data/scraped/README.md` | 1 | ✓ PASS |
| Stale resume claim removed | `grep -c 'resume from the next model after' data/scraped/README.md` | 0 | ✓ PASS |
| `kind` discriminator on every push site | `grep -nE "kind: '(parse\\|image\\|orchestrator\\|inherit)'" server/scrapers/drom/index.ts` | 5 push sites tagged | ✓ PASS |
| `images_failed` + `image_failure_rate` in code | `grep -nE 'images_failed\\|image_failure_rate' server/scrapers/drom/index.ts` | 8 references | ✓ PASS |
| `record.image_paths = []` reconciliation | `grep -c 'record\\.image_paths = \\[\\]' server/scrapers/drom/index.ts` | 1 | ✓ PASS |
| `writeReportHtml` wired on all 3 finish paths | `grep -c 'writeReportHtml' server/scrapers/drom/index.ts` | 5 (1 import + 1 success + 1 blocked + 1 error + 1 warn-message reference) | ✓ PASS |
| `current/index.html` exists on disk | `ls data/scraped/drom/current/index.html` | 261487 bytes | ✓ PASS |
| Brand-root cursor path | `grep -c 'cursorPath = resolve(runRoot' server/scrapers/drom/index.ts` | 1 | ✓ PASS |
| No remaining `runDir`-based cursor calls | `grep -cE '(readCursor\\|writeCursor\\|deleteCursor)\\(runDir' server/scrapers/drom/index.ts` | 0 | ✓ PASS |
| `CURSOR_FILENAME` removed | `grep -c CURSOR_FILENAME server/scrapers/shared/cursor.ts` | 0 | ✓ PASS |
| Resume integration tests | `grep -c 'drom\\.run\\(\\{ resume: true \\}\\)' server/tests/drom-integration.test.ts` | 4 (was 0 at prior verification) | ✓ PASS |
| Cross-invocation flow test | `grep -c 'cross-invocation cursor flow' server/tests/drom-integration.test.ts` | 1 | ✓ PASS |

### Requirements Coverage

(Unchanged from 2026-04-28 — no requirement scope changes were introduced by the gap-closure plans; only correctness improvements within already-claimed requirements.)

| Requirement | Status |
|-------------|--------|
| SCRAPE-01..04 | ✓ SATISFIED (as STUB per Phase 1 scope) |
| SCRAPE-05 | ✓ SATISFIED (drom master-models populated; resume path now correct end-to-end) |
| SCRAPE-06 | ✓ SATISFIED (adapted: WebP on disk; CR-05 reconciliation now ensures models.json image_paths matches disk state) |
| SCRAPE-09 | ✓ SATISFIED (adapted: report.json + index.html viewer per run) |
| SCRAPE-10 | ✓ SATISFIED |
| SCRAPE-11 | ✓ SATISFIED (adapted: JSON cache) |

**Note on REQUIREMENTS.md traceability table:** Same as prior verification — table at REQUIREMENTS.md lines 207-217 still shows SCRAPE-* mapped to "Phase 6"; this is stale per the 2026-04-27 reorder log. Bulk update remains out of scope for this verification.

### Anti-Patterns Found

The 6 critical findings from `01-REVIEW.md` (CR-01..CR-06) are all closed by plans 01-10..01-16 with code-on-disk evidence. The original anti-pattern table is superseded by the `gap_closure_verification:` frontmatter block.

Remaining findings from 01-REVIEW.md (not addressed by these gap-closure plans, intentionally deferred):

| File | Lines | Pattern | Severity | Status |
|------|-------|---------|----------|--------|
| `shared/http.ts` | 51-52 | User-Agent string is Chrome 126 (June 2024) — WR-07 | ⚠️ Warning | DEFERRED — not goal-blocking; calendar-reminder candidate |
| `shared/http.ts` | 19, 41-56 | Module-scoped CookieJar leaks across runs in same Node process — WR-08 | ℹ️ Info | DEFERRED — OK for current CLI one-shot mode; Phase 4 worker process must address |
| `shared/brand-aliases.ts` | 17-48 | mergeAliases lacks concurrency guard — WR-11 | ℹ️ Info | DEFERRED — OK for documented single-process operation |
| `shared/fx.ts` | various | `firstRun` flag conflates "no resume cursor" with "no ever-cached file" — WR-01 | ⚠️ Warning | DEFERRED — does not affect the delivered SC-9 contract |
| `parse-generation-page.ts` | 67-72 | `parseEngineLine` litre regex edge case — WR-02 | ⚠️ Warning | DEFERRED — does not affect goal achievement |
| `cli.ts` | 28-36 | `cli.ts` can crash printing circular `cause` — WR-03 | ⚠️ Warning | DEFERRED — does not affect goal achievement |
| `drom-integration.test.ts` | (line 84+) | NEUTRALIZE_BLOCK_KEYWORDS dead code post-tightening — WR-05 | ⚠️ Warning | DEFERRED — does not affect goal achievement; cosmetic test cleanup |

Note: WR-06 ("`report.errors` semantically conflates 'image fetch failed' with 'no hero available'") is now closed by plan 01-14 indirectly — the CR-06 fix split counters into `images_failed` (real failures) and `images_skipped` (no source URL or already-inherited), which addresses the actionability concern. WR-09 ("extractHeroImageUrl called inside parseGenerationPage but only used as a presence check") is also closed by plan 01-14 via the ctx.heroImageUrl single-source-of-truth pattern.

### Human Verification Required

None remaining. Both items from the prior verification are resolved:

1. **Resume correctness** — operator chose option B ("fix before sign-off"); plans 10/11/12/13/14/16 landed.
2. **Resume contract semantics** — README §"Crash recovery" rewritten by plan 01-12 to match the actual code contract.

### Gaps Summary

The phase delivers a working drom scraper with live-validated single-run output (200 records, 200 WebPs, 0 errors, 0 blocks from prior smoke) PLUS a fully-correct, fully-tested resume code path validated by 5 integration tests covering CR-01..CR-04, WR-04, and BLOCKER 1.

All 10 ROADMAP success criteria are unconditionally met. All 9 declared SCRAPE-* requirements are satisfied (5 substantively, 4 as locked-contract stubs).

Both prior gaps are closed with code-on-disk evidence:

- **Gap 1** (resume idempotency): closed by plans 10/11/12/13/14/16 — all 6 critical review findings (CR-01..CR-06), the supporting WR-04 robustness finding, the IN-07 integration-coverage gap, AND the plan-checker-discovered BLOCKER 1 cross-invocation cursor flow are verified closed at named file:line ranges in this verification's frontmatter.
- **Gap 2** (per-run HTML viewer): closed by plan 15 — `writeReportHtml` shared module wired into the orchestrator on success/blocked/error paths, with backward-compat CLI script preserved for retroactive generation against pre-plan-15 runs.

Phase 1 is complete. Phase 3 (Compliance & Infra) and Phase 4 (Schema/API/importer) can begin.

---

_Re-verified: 2026-04-29T15:10:00Z_
_Verifier: Claude (gsd-verifier, goal-backward verification mode)_
_Initial verification: 2026-04-28T16:02:34Z_
