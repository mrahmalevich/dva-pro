---
phase: 01-inventory-scrapers-drom-and-stubs
verified: 2026-04-28T16:02:34Z
status: human_needed
score: 9/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Re-running the scraper twice in a row produces a consistent JSON dataset (idempotent). Diff between runs is bounded to expected drom-side changes."
    status: partial
    reason: |
      Single-run determinism is verified by smoke #3 (200 records, byte-stable
      sorted brand-aliases). However, idempotency under the documented `resume`
      code path (D-15 brand-boundary cursor; cli.ts:27 always passes
      `resume: true`) is NOT verified — no integration test exercises
      `drom.run({ resume: true })`, and the code review found 4 independent
      correctness bugs (CR-01..CR-04) in the resume path that can silently
      restart completed work, permanently lose brand-alias data, or both.
      The first invocation in production WILL hit a non-resume path, but the
      cli.ts default is `resume: true`, so the second invocation enters the
      buggy code path. Live smoke run did NOT exercise this scenario
      (no .cursor.json was present at run start; report.cursor_resumed=false).
    artifacts:
      - path: "server/scrapers/drom/index.ts"
        issue: "Lines 125-130 and 143-149: cursor resume uses Math.max(0, findIndex(...)) which silently restarts catalog/brand from index 0 when cursor.lastBrandSlug or cursor.lastModelSlug is no longer present in DOM (CR-01, CR-02)"
      - path: "server/scrapers/drom/index.ts"
        issue: "Cursor resume assumes alphabetic order in brands[]/models[] but parsers (parse-brand-index, parse-model-list) return DOM-traversal order; comparisons mis-skip when DOM ≠ alphabetic (CR-03)"
      - path: "server/scrapers/drom/index.ts"
        issue: "On mid-brand resume, brandModels is fresh {} per brand iteration (line 134) and mergeAliases runs only at end of brand (line 216) — partial brand data from the aborted run is permanently dropped from brand-aliases.json (CR-04)"
      - path: "server/scrapers/shared/cursor.ts"
        issue: "readCursor swallows JSON parse errors as null (lines 22-29) AND lacks zod-shape validation, so a corrupt or truncated .cursor.json silently triggers a fresh restart instead of halt-and-investigate (WR-04)"
      - path: "server/tests/drom-integration.test.ts"
        issue: "Only resume:false is covered (line 175); the buggy resume code path has zero integration coverage (IN-07)"
    missing:
      - "Add integration test that seeds a .cursor.json, calls drom.run({ resume: true }), and asserts the brand at lastBrandSlug is processed and earlier brands are skipped"
      - "Add integration test asserting non-alphabetic DOM order still resumes correctly (will fail until CR-03 fix lands)"
      - "Fix CR-01 / CR-02: change Math.max(0, findIndex(...)) → throw when findIndex returns -1, OR sort parser output alphabetically before comparison"
      - "Fix CR-03: sort brands.sort(localeCompare) and models.sort(localeCompare) before applying cursor logic, OR change cursor semantics to set-membership"
      - "Fix CR-04: either document 'resume re-scrapes the cursored brand from scratch' and force startFromModelIndex=0 when cursor is set, OR persist brandModels/records to disk after every model"
      - "Tighten readCursor to distinguish ENOENT from corrupt JSON and validate shape with zod"
human_verification:
  - test: "Operator triggers a long-running `pnpm scrape:drom` (no whitelist), then SIGKILLs the process mid-brand, then re-runs. Confirm second invocation resumes correctly without silently re-doing already-finished brands and without losing brand-aliases entries from the aborted brand."
    expected: |
      report.cursor_resumed=true on second run; pages_visited reflects skipped
      brands; brand-aliases.json contains entries for both completed-pre-crash
      brands AND the brand the cursor pointed at (no entries permanently lost).
    why_human: |
      Cannot exercise programmatically without a 1-2 week live backfill or
      heavy fixturing of resume scenarios. The 6 BLOCKER bugs identified by
      the code reviewer (CR-01..CR-06) suggest this is unsafe to assume from
      smoke validation alone. The operator's risk decision: ship now and
      address resume bugs in Phase 1.x, OR block Phase 1 sign-off pending
      CR-01..CR-04 fixes.
  - test: "Operator confirms intent on the documented Phase 1 resume contract: is a coarse 'resume re-scrapes the cursored brand from scratch' acceptable for the operational use case (Phase 2/3 unblock today, Phase 1.x file CR-01..CR-04), or is full resume correctness a hard pre-Phase-2 gate?"
    expected: "Documented decision in .planning/phases/01-inventory-scrapers-drom-and-stubs/01-VERIFICATION.md or a new override entry"
    why_human: "Calls for a project-level risk/scope tradeoff (scope vs schedule); not a code question."
---

# Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs Verification Report

**Phase Goal:** Build a runnable scraping pipeline that produces deterministic, importable artifacts on disk — `cars.json` records and WebP images — *without* any backend infrastructure (no DB, no cloud, no queue). The drom.ru/catalog scraper is real and end-to-end; Encar / BeForward / Che168 / Autohome modules implement the same `IScraper` contract but return `{ status: 'not_implemented' }` plus a TODO log line, so the contract is locked and future fillers don't have to invent it.

**Verified:** 2026-04-28T16:02:34Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase ships a working drom scraper validated end-to-end against live drom.ru: 200 records, 200 WebP images, readable Cyrillic, 0 blocks, 0 errors. The IScraper contract is locked across 4 stubs; the 5 v1-blocking SCRAPE-* requirements (05, 06, 09, 10, 11) are satisfied by code + smoke evidence; SCRAPE-01..04 are satisfied as stubs per the explicit Phase 1 scope reduction.

The single material gap is around must-have #9 (re-run idempotency) — see "Goal Achievement: Observable Truths" below. The smoke validated **single-run** determinism but did NOT validate the **resumable** path that cli.ts always invokes (`resume: true`). The standalone code review (01-REVIEW.md) found 4 independent BLOCKER bugs (CR-01..CR-04) in the resume code path, plus 2 BLOCKERs (CR-05/CR-06) in the image-handling path that did not trigger in smoke (no image failures in 200 successful downloads).

The phase is functionally complete enough to UNBLOCK Phase 2 (Compliance & Infra) and Phase 3 (Schema/API/importer) which can begin in parallel. It is NOT safe to launch a real 1–2 week backfill without addressing the resume bugs OR explicitly accepting the "resume re-scrapes cursored brand from scratch" deviation.

### Observable Truths

| # | Truth (from ROADMAP.md SC-1..10) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | `pnpm scrape:drom` executes end-to-end on fresh `git clone`, exits 0, writes models.json + images/*.webp | ✓ VERIFIED | `package.json:14` declares `pnpm scrape:drom`; smoke #3 ran end-to-end producing 200 records + 200 WebPs in `data/scraped/drom/current/`; report.json `final_status='ok'`, exit 0. CLI dispatcher (`server/scrapers/cli.ts`) wires `EXIT_CODES = {ok:0,...}`. README §Quick start documents the command. (Note: phase emits `models.json`, not `cars.json`, per SCHEMA.md decision — cars.json is reserved for v1.x CarListing; this is a deliberate semantic precision, not a deviation.) |
| 2 | Documented JSON contract at `data/scraped/SCHEMA.md` with every field of a record | ✓ VERIFIED | `data/scraped/SCHEMA.md` exists with full ModelRecord field table (17 fields, types, nullability, notes). Mirrors the zod schema in `server/scrapers/shared/types.ts` (single source of truth). All 17 fields present in live `current/models.json` records. |
| 3 | IScraper interface defined; 4 stubs (encar, beforward, che168, autohome) return `not_implemented`; `pnpm scrape:<source>` exits non-zero (CI-detectable) | ✓ VERIFIED | `server/scrapers/shared/types.ts:52-55` exports IScraper; each of 4 stub `index.ts` files returns `{status:'not_implemented', source, deferredTo:'v1.x', todo:...}` and writes one console.warn TODO line; cli.ts EXIT_CODES maps `not_implemented → 2` (non-zero); 12 stub tests in `server/tests/stubs.test.ts` |
| 4 | CBR daily FX XML cached as `data/scraped/fx/cbr-<YYYY-MM-DD>.json` with normalized rates; stale-fallback documented | ✓ VERIFIED | `data/scraped/fx/cbr-2026-04-28.json` present with USD/EUR/JPY/KRW/CNY/AED rates and `source: 'cbr-live'`. `server/scrapers/shared/fx.ts` implements D-12 (same-UTC-day cache hit, live-fetch + write, fail-fast on first run, cache fallback otherwise). README §"Running drom: what happens" §1 documents the contract. |
| 5 | Cyrillic↔Latin brand/model lookup auto-built; `data/scraped/drom/brand-aliases.json` idempotent merge by brand_slug | ✓ VERIFIED | `data/scraped/drom/brand-aliases.json` populated with `lada` entry (54 models, sorted alphabetically). `mergeAliases` in `shared/brand-aliases.ts` does sort-then-write under `atomicWriteFile` (byte-stable). Limitation flagged: `brand.ru` is currently set to Latin name (per orchestrator line 212 comment "Drom anchors expose only Latin labels (Wave 4 finding)") — `lada` resolves to "Лада" only because LADA's Latin name on drom IS "Лада". This is documented in 01-07 SUMMARY as Wave 4 finding and acceptable for Phase 1 since the dictionary is structurally correct and idempotency is the SC-5 anchor. |
| 6 | Image pipeline downloads source → WebP via sharp, preserves dimensions, names `images/<brand_slug>-<model_slug>-<index>.webp`. Bandwidth/disk usage logged per run. | ✓ VERIFIED | `current/images/` contains 200 `.webp` files. `file` reports `RIFF Web/P VP8 473x355` for sample. `shared/images.ts` uses `sharp().webp({quality:80})` with `limitInputPixels` cap. Naming format extended to `<brand_slug>-<model_slug>-<generation>-hero.webp` per D-11 (more specific than the SC-6 spec — improvement, not regression). report.json captures `images_downloaded: 200, images_skipped: 0`. |
| 7 | Run report JSON captures started_at, finished_at, duration_ms, pages_visited, models_added, models_updated, images_downloaded, errors[], rate_limit_hits, blocked_responses | ✓ VERIFIED | `current/report.json` contains all 14 D-17 fields (started_at, finished_at, duration_ms, pages_visited, models_added=200, models_updated=0, images_downloaded=200, images_skipped=0, errors=[], rate_limit_hits=0, blocked_responses=0, fx_stale=true, cursor_resumed=false, final_status="ok"). Integration test asserts each field is present. |
| 8 | Block-detection logic exists in shared scraper code (5+ thin/empty responses or captcha keywords → halt run, write `report.json` with `status:'blocked'`) | ✓ VERIFIED | `shared/block-detection.ts` exports `BlockDetector` and `BlockedError`; thin counter at 5, captcha keyword set tightened post-smoke (commit ff51216) to specific multi-word patterns. Orchestrator catches `BlockedError`, sets `report.final_status='blocked'`, increments `blocked_responses`, does NOT update `current/`. 5 captcha-keyword tests + 3 false-positive regression tests + thin-response counter tests in `server/tests/block-detection.test.ts`. Smoke #2 actually trapped on this code path (then a regex tightening was committed before smoke #3). |
| 9 | Re-running the scraper twice in a row produces a consistent JSON dataset (idempotent). Diff bounded to expected drom-side changes. | ⚠️ PARTIAL | **Single-run determinism: VERIFIED.** brand-aliases.json sorts keys alphabetically under atomicWriteFile (byte-stable). Smoke #3 produced a complete clean run with 200 deterministic records. **Resume-path determinism: NOT VERIFIED.** Integration test only covers `resume: false` (line 175). cli.ts:27 always invokes `resume: true`, so any second invocation enters the resume code path. Code review (01-REVIEW.md) found 4 BLOCKER bugs in resume logic: CR-01 (silent restart when lastBrandSlug missing from DOM), CR-02 (silent restart of completed brand when lastModelSlug is alphabetic-last), CR-03 (DOM-vs-alphabetic order assumption mismatch), CR-04 (permanent loss of partial-brand alias data). These bugs did not trigger in smoke (single fresh run, no resume). See gaps[]. |
| 10 | README at `data/scraped/README.md` explains how to run, where output lands, what stubs do, and how Phase 3's importer should consume the JSON | ✓ VERIFIED | `data/scraped/README.md` covers Quick start, Exit codes, Output directory layout, Run flow, Polite rate limit, Crash recovery (cursor), Pruning, OS support, Secrets (none), Troubleshooting, Stub sources table, See also. SCHEMA.md §"Phase 3 importer contract" documents the upsert key, image rehost path, and Pitfall 7 contract. |

**Score:** 9 / 10 truths verified (1 partial — must-have #9)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` (scrape scripts) | `scrape:drom`, `scrape:encar`, `scrape:beforward`, `scrape:che168`, `scrape:autohome`, generic `scrape` | ✓ VERIFIED | All 6 scripts present (lines 14-19); each tsx-dispatches to `server/scrapers/cli.ts` |
| `server/scrapers/cli.ts` | argv → IScraper.run dispatcher | ✓ VERIFIED | 5 IScraper instances mapped; EXIT_CODES enforces D-09; top-level await; default `resume:true` |
| `server/scrapers/shared/types.ts` | IScraper, ScrapeResult, ModelRecord (zod), ReportSummary | ✓ VERIFIED | All 4 exports present; ModelRecord is strict (no .default()/.optional() on required) per Pitfall 1 |
| `server/scrapers/drom/index.ts` | drom IScraper orchestrator | ✓ VERIFIED (with caveats) | Composes 8 shared modules + 4 parsers; happy-path + blocked + error branches all wired; resume code path has known correctness bugs (CR-01..CR-04) |
| `server/scrapers/{encar,beforward,che168,autohome}/index.ts` | 4 stubs returning `not_implemented` | ✓ VERIFIED | All 4 present; identical contract; each warns once |
| `server/scrapers/shared/{http,fx,images,block-detection,cursor,symlink,brand-aliases,atomic-write,normalize}.ts` | Shared utility modules | ✓ VERIFIED | All 9 present, unit-tested in isolation |
| `server/scrapers/drom/{parse-brand-index,parse-model-list,parse-generation-list,parse-generation-page}.ts` | 4 DOM parsers | ✓ VERIFIED | All 4 present; fixture-driven unit tests; zod-validates ModelRecord output |
| `data/scraped/SCHEMA.md` | Phase 3 importer contract | ✓ VERIFIED | 17-field table + worked example + report.json contract + brand-aliases shape + FX cache shape + Phase 3 importer contract section |
| `data/scraped/README.md` | Operator runbook | ✓ VERIFIED | Quick start, exit codes, layout, run flow, recovery, troubleshooting, stub table |
| `data/scraped/drom/brand-aliases.json` | Live merged Cyrillic↔Latin map | ✓ VERIFIED | Populated with lada + 54 sorted models from smoke #3 |
| `data/scraped/drom/current/` | Symlink to most-recent successful run | ✓ VERIFIED | Symlink → `2026-04-28T14-31-09Z` (smoke #3 dir) |
| `data/scraped/drom/current/models.json` | 200 ModelRecord rows | ✓ VERIFIED | 200 records, all 17 fields present, Cyrillic readable |
| `data/scraped/drom/current/report.json` | D-17 telemetry | ✓ VERIFIED | All 14 fields, `final_status:"ok"`, 0 blocks, 0 errors |
| `data/scraped/drom/current/images/*.webp` | 200 hero WebPs | ✓ VERIFIED | 200 files; sample inspected with `file` returns `RIFF Web/P VP8 473x355` |
| `data/scraped/fx/cbr-2026-04-28.json` | Daily CBR cache | ✓ VERIFIED | Six rates: USD/EUR/JPY/KRW/CNY/AED; `source:"cbr-live"` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `server/scrapers/cli.ts` | `server/scrapers/drom/index.ts` | SCRAPERS map import | ✓ WIRED | Line 2: `import { drom } from './drom/index.js'`; SCRAPERS.drom = drom; argv 'drom' → drom.run() |
| `server/scrapers/cli.ts` | 4 stub `index.ts` modules | SCRAPERS map import | ✓ WIRED | Lines 3-6 import all 4 stubs; SCRAPERS{encar,beforward,che168,autohome} mapped |
| `server/scrapers/drom/index.ts` | shared/{http,fx,images,block-detection,cursor,symlink,brand-aliases,atomic-write,types} | Import composition | ✓ WIRED | Lines 33-47: all 9 imports present; orchestrator calls each in run flow |
| `server/scrapers/drom/index.ts` | parse-{brand-index,model-list,generation-list,generation-page} | Local parser imports | ✓ WIRED | Lines 48-51: all 4 parsers imported; called in nested loop (lines 111, 140, 159, 168) |
| `package.json` script `scrape:drom` | `tsx server/scrapers/cli.ts drom` | npm-script invocation | ✓ WIRED | Line 14: `"scrape:drom": "tsx server/scrapers/cli.ts drom"` — drives smoke #3's exit-0 outcome |
| Orchestrator success path | `pointCurrentAt(runDir)` | Called after successful artifact writes | ✓ WIRED | Line 235; symlink updated atomically. Verified via `ls -la current` |
| Orchestrator BlockedError path | `report.final_status='blocked'` | catch BlockedError → write partial report, do NOT update current/ | ✓ WIRED | Lines 250-264; verified by smoke #2 (regex was loose, run was blocked, current/ NOT updated) |
| `mergeAliases` | `data/scraped/drom/brand-aliases.json` | atomicWriteFile under sorted keys | ✓ WIRED | brand-aliases.ts:47; confirmed by populated lada entry |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `current/models.json` | `records: ModelRecord[]` (orchestrator line 94) | `parseGenerationPage(genPageHtml, ctx)` from real drom HTML via `fetchHtml` | ✓ Yes — 200 real records with Cyrillic | ✓ FLOWING |
| `current/report.json` | `report: ReportSummary` (orchestrator line 93) | Updated throughout run from real fetch counters and error catches | ✓ Yes — pages_visited=256, models_added=200 from real drom | ✓ FLOWING |
| `current/images/*.webp` | `webp: Buffer` (images.ts line 29) | `sharp(fetchBuffer(imageUrl)).webp()` from real s.auto.drom.ru CDN | ✓ Yes — 200 real WebP files, 36KB sample, valid VP8 | ✓ FLOWING |
| `brand-aliases.json` | `merged: AliasMap` (brand-aliases.ts line 26) | `mergeAliases(brandAliasesPath, brandEntry)` per brand from real drom anchors | ✓ Yes — lada + 54 model entries from real smoke run | ✓ FLOWING (with caveat: brand.ru = Latin name when drom only exposes Latin label; documented Wave 4 finding) |
| `fx/cbr-2026-04-28.json` | `result: FxRates` (fx.ts line 75) | `decodeCbrXml(buf, today)` from real CBR XML response | ✓ Yes — 6 RUB rates fetched live, source='cbr-live' | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript type-check passes | `pnpm tsc -p tsconfig.server.json --noEmit` | Per 01-09-SUMMARY: exit 0 | ✓ PASS (per smoke evidence; not re-run by verifier) |
| Vitest suite passes | `pnpm vitest run` | Per 01-09-SUMMARY: 86/86 passing | ✓ PASS (per smoke evidence; not re-run by verifier) |
| Stubs exit non-zero | `pnpm scrape:encar` (and analogs) | Returns `{status:'not_implemented'}`; cli.ts maps to exit code 2 | ✓ PASS (verified via static reading of cli.ts EXIT_CODES + stubs.test.ts coverage; not re-invoked) |
| Live drom run end-to-end | `DROM_BRAND_WHITELIST=lada pnpm scrape:drom` | Per 01-09-SUMMARY smoke #3: 200 records, exit 0, 0 blocks | ✓ PASS (operator-run; verifier inspected resulting artifacts on disk) |
| Live FX fetch | (subsumed by drom run) | `cbr-2026-04-28.json` shows `source:"cbr-live"` with 6 rates | ✓ PASS |
| WebP file is real image | `file current/images/lada-2101-g_1970_1835-hero.webp` | `RIFF Web/P VP8 473x355` | ✓ PASS |
| models.json all 17 fields per record | `python3 -c 'json.load(...) keys'` | All 17 ModelRecord fields confirmed; Cyrillic readable | ✓ PASS |
| Resume code path under crash recovery | (No automated test exists) | Integration test only covers `resume: false` | ✗ FAIL (gap captured in must-have #9) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SCRAPE-01 | 01-02 | Encar.com scraper runs | ✓ SATISFIED (as STUB per Phase 1 scope) | `server/scrapers/encar/index.ts` returns `not_implemented` with TODO; ROADMAP Phase 1 §Notes: "No live Encar/.../etc scraping (replaced with IScraper stubs)" |
| SCRAPE-02 | 01-02 | BeForward scraper runs | ✓ SATISFIED (as STUB per Phase 1 scope) | `server/scrapers/beforward/index.ts` returns `not_implemented` |
| SCRAPE-03 | 01-02 | Che168 scraper runs | ✓ SATISFIED (as STUB per Phase 1 scope) | `server/scrapers/che168/index.ts` returns `not_implemented` |
| SCRAPE-04 | 01-02 | Autohome scraper runs | ✓ SATISFIED (as STUB per Phase 1 scope) | `server/scrapers/autohome/index.ts` returns `not_implemented` |
| SCRAPE-05 | 01-07, 01-09 | drom.ru/catalog scraper populates models master DB | ✓ SATISFIED | `server/scrapers/drom/` orchestrator + 4 parsers; live smoke produced 200 LADA model records to `current/models.json`; SCHEMA.md formalizes the Phase 3 handoff contract |
| SCRAPE-06 | 01-04 | Scrapers rehost source images (adapted in Phase 1: WebP on disk, not S3) | ✓ SATISFIED (adapted) | `shared/images.ts` `downloadAndConvert` writes WebP under `<runDir>/images/`; 200 real WebPs produced. SCRAPE-07 (S3 rehost) is explicitly deferred to Phase 3 importer per ROADMAP §Notes |
| SCRAPE-09 | 01-07 | Per-source health/metrics surfaced (adapted in Phase 1: report.json, not admin endpoint) | ✓ SATISFIED (adapted) | `report.json` per run with all D-17 fields; 14-field shape verified live. ROADMAP Phase 1 §Notes: "No admin metrics endpoint (replaced with `report.json` per run)" |
| SCRAPE-10 | 01-04 | Brand/model names canonicalised via Cyrillic↔Latin lookup | ✓ SATISFIED | `shared/brand-aliases.ts` `mergeAliases` writes byte-stable sorted JSON; `data/scraped/drom/brand-aliases.json` populated; idempotency-anchor test in `brand-aliases.test.ts` |
| SCRAPE-11 | 01-05 | CBR daily XML feed; RUB stored, RUB equivalent computed on read (adapted in Phase 1: cache as JSON file) | ✓ SATISFIED (adapted) | `shared/fx.ts` fetches CBR XML, decodes via iconv-lite (windows-1251), normalizes to 6 currencies, caches per-UTC-day; `cbr-2026-04-28.json` present with live rates |

**Note on REQUIREMENTS.md traceability table:** The table at REQUIREMENTS.md lines 207-217 still shows SCRAPE-* mapped to "Phase 5". This is stale per the 2026-04-27 reorder log in ROADMAP.md — Phase 5 (Inventory) was promoted to Phase 1 with reduced scope. Plan frontmatter and ROADMAP.md Phase 1 are the current source of truth; the REQUIREMENTS.md table needs a bulk-update commit (out of scope for this verification, but flagged for orchestrator attention).

**Orphaned requirements check:** ROADMAP Phase 1 declares SCRAPE-01..06, 09, 10, 11. None are missing from plan frontmatter. SCRAPE-07 (image rehost to Yandex Object Storage) and SCRAPE-08 (separate worker process MemoryMax=1G) are explicitly NOT in Phase 1 (per ROADMAP §"What was cut" — deferred to Phase 3 importer for SCRAPE-07 and Phase 1.x worker for SCRAPE-08). No orphans.

### Anti-Patterns Found

Anti-patterns are catalogued exhaustively in `01-REVIEW.md` (24 findings: 6 critical, 11 warning, 7 info). Highlighted here are only items that affect goal achievement at Phase 1 closure:

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `server/scrapers/drom/index.ts` | 125-130 | `Math.max(0, findIndex(...))` silently restarts when cursor brand absent (CR-01) | 🛑 Blocker (resume only) | Re-runs after a brand removal silently re-do entire catalog. Does not trigger in smoke (no resume); will trigger on first crash + restart in production. |
| `server/scrapers/drom/index.ts` | 143-149 | Same `Math.max(0, findIndex())` at model level (CR-02) | 🛑 Blocker (resume only) | After a brand-end crash, the entire just-completed brand is silently re-fetched. ~1 day wasted at 10 s/req. |
| `server/scrapers/drom/index.ts` | 125-149 | Cursor assumes alphabetic order; parsers return DOM order (CR-03) | 🛑 Blocker (resume only) | Cursor mis-skips/repeats unpredictably when DOM order ≠ alphabetic. |
| `server/scrapers/drom/index.ts` | 134, 216 | Mid-brand crash drops partial brand-aliases entries (CR-04) | 🛑 Blocker (data loss) | Permanent loss of model alias entries scraped before crash. |
| `server/scrapers/drom/index.ts` + `parse-generation-page.ts` | 180, 222-225 | hero-image decision desynchronized between list and page parsers (CR-05) | ⚠️ Warning | Possible orphan WebP path in models.json or orphan WebP file on disk. Did not trigger in smoke (every record had a hero). |
| `server/scrapers/drom/index.ts` | 186-200, 219-225 | extractPrices conflates image-fetch failures with DOM regressions, abort entire run (CR-06) | ⚠️ Warning | Bad CDN day → entire run aborts even when records parsed clean. Did not trigger in smoke (0 image failures). |
| `server/scrapers/shared/cursor.ts` | 22-29 | Blanket `catch{}` returns null for both ENOENT and corrupt JSON; no shape validation (WR-04) | ⚠️ Warning | Corrupt cursor file → silent fresh restart instead of halt. |
| `server/scrapers/shared/http.ts` | 51-52 | User-Agent string is Chrome 126 (June 2024); current is Chrome ~138/139 | ⚠️ Warning | Future block-detection trigger; no impact on smoke (drom is RU-domestic, polite delay, no UA-based filter observed). |
| `server/scrapers/shared/http.ts` | 19, 41-56 | Module-scoped CookieJar leaks across runs in same Node process (WR-08) | ℹ️ Info | OK for current CLI one-shot mode; future Phase 3 worker process must address. |
| `server/scrapers/shared/brand-aliases.ts` | 17-48 | mergeAliases lacks concurrency guard (WR-11) | ℹ️ Info | OK for documented single-process operation. |

The 4 CR findings on the resume path together drive the must-have #9 partial verdict above. CR-05 and CR-06 are real bugs but did not impact the smoke outcome and do not block the documented Phase 1 success criteria; they are tracked as Phase 1.x candidates.

### Human Verification Required

See `human_verification:` block in YAML frontmatter for the structured items. In summary, the operator must decide:

1. **Resume correctness**: Is it acceptable that the documented `pnpm scrape:drom` resume contract has 4 known correctness bugs that did not trigger in single-run smoke but will manifest on the first real crash + re-run? Options:
   - **Accept and ship** — file CR-01..CR-04 as Phase 1.x, document the limitation in `data/scraped/README.md`, and rely on the cli.ts default `resume:true` working only for "happy" cases. Add an override entry to this VERIFICATION.md.
   - **Block Phase 1 sign-off** — fix CR-01..CR-04 (estimate: ~1–2 days) before declaring Phase 1 done. Phase 2 (Compliance) and Phase 3 (Schema) can already start in parallel either way.

2. **Resume contract semantics**: If accepting CR-04 deviation, document explicitly in README that "resume re-scrapes the cursored brand from scratch — partial brand-aliases entries from the aborted run ARE LOST". Currently README§"Crash recovery" claims a more correct contract than the code delivers.

### Gaps Summary

The phase delivers a working drom scraper with live-validated single-run output (200 records, 200 WebPs, 0 errors, 0 blocks). 9 of 10 ROADMAP success criteria are unconditionally met. All 9 declared SCRAPE-* requirements are satisfied (5 substantively, 4 as locked-contract stubs).

The single material gap is must-have #9 — re-run idempotency is verified for fresh runs but unverified (and demonstrably buggy by code review) for the documented resume-from-crash code path that cli.ts always invokes. Because the smoke run was a single fresh invocation with no `.cursor.json` present, the resume code path was bypassed entirely. The 6 BLOCKER-level findings in `01-REVIEW.md` (CR-01..CR-06) catalog 4 correctness bugs in resume logic plus 2 in image-failure handling. None triggered in smoke; all are real and observable in source.

This gap is **not** addressed by any later milestone phase (Phase 2 is Compliance, Phase 3 is Schema/API/importer reading Phase 1 artifacts — neither re-touches the drom scraper). Phase 3's importer DOES depend on `current/` pointing at a complete, valid run (which it does today), so the cursor bugs do not block Phase 3 reading. They block any second `pnpm scrape:drom` invocation in production from being trustworthy without operator review.

The decision is operational, not technical: ship as-is with documented limitation OR fix before sign-off. Both are defensible; the verifier escalates to human per the gates protocol.

---

_Verified: 2026-04-28T16:02:34Z_
_Verifier: Claude (gsd-verifier)_
