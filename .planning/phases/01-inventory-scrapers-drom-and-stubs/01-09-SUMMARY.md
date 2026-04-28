---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 09
subsystem: scraping
tags: [smoke-run, live-drom, gate, manual, encoding-fix, captcha-regex]

requires:
  - phase: 01-07
    provides: drom orchestrator + parsers + DROM_BRAND_WHITELIST env
  - phase: 01-03
    provides: shared/http.ts + shared/block-detection.ts (both patched here)
  - phase: 01-08
    provides: README.md operator runbook + SCHEMA.md output contract

provides:
  - Live-validated drom scraper (200 records on LADA, 0 blocks, 0 errors)
  - Two production fixes uncovered ONLY by live wire (Pitfall 2 + 01-07 deferred captcha-regex)
  - Resume signal `approved — smoke green` for plan 09 task 1

affects: [phase 02 compliance, phase 03 importer]

tech-stack:
  added: []
  patterns:
    - "iconv-lite-aware fetchHtml: detect charset from Content-Type, decode via iconv"
    - "Block-detection captcha regex: specific multi-word phrases, not bare words"

key-files:
  created:
    - .planning/phases/01-inventory-scrapers-drom-and-stubs/01-09-SUMMARY.md
  modified:
    - server/scrapers/shared/http.ts (windows-1251 decoding)
    - server/scrapers/shared/block-detection.ts (tightened captcha regex)
    - server/tests/http.test.ts (windows-1251 regression test)
    - server/tests/block-detection.test.ts (rewrote captcha-keyword tests)

key-decisions:
  - "fetchHtml decodes via iconv-lite using charset from response Content-Type header — closes Pitfall 2 false negative"
  - "Captcha regex set rewritten: specific multi-word challenge phrases + widget identifiers (captcha, recaptcha/hcaptcha/cf-challenge/cf-turnstile, капча, я не робот, подтвердите ... не робот, введите ... символ). Drops bare /проверка/i, /robot/i, /verify/i which false-positived on legitimate nav."
  - "Bad smoke-#1 run dir (mojibake'd records, 2026-04-28T12-59-06Z) deleted before re-run; 2nd run dir (2026-04-28T14-27-23Z, blocked) deleted before 3rd run"
  - "Task 2 (full backfill) deferred per plan — operator decision when ready for 1–2 week unattended run; Phase 2/3 do not block on it (RESEARCH Risk 7 mitigation)"

patterns-established:
  - "Live smoke gate as data-quality test, not just connectivity test — caught both bugs that fixture tests missed because fixtures were sanitized to UTF-8"
  - "Architectural deviations from prior plans get inline gap-closure when discovered during checkpoint plans, atomically committed with full deviation context"

requirements-completed: [SCRAPE-05]

duration: ~165min  # 3 smoke attempts + 2 inline fixes
completed: 2026-04-28
---

# Phase 01 Plan 09: Live drom smoke run gate — Summary

**Live LADA smoke passed on 3rd attempt: 200 records, readable Cyrillic, 0 blocks, 0 errors. Two production bugs that fixture tests missed were uncovered and fixed inline.**

## Performance

- **Duration:** ~165 min (2 inline fixes + 3 smoke attempts at ~75 min each — fixes ran in parallel with monitoring)
- **Started:** 2026-04-28T12:59:06Z (smoke #1)
- **Completed:** 2026-04-28T15:47:27Z (smoke #3 finish)
- **Tasks:** 1/2 complete (Task 1 PASSED; Task 2 optional full backfill DEFERRED)
- **Files modified:** 4 (2 src + 2 tests)

## Accomplishments

- **Smoke gate PASSED** with 200 records, 256 pages visited, 200 images downloaded as WebP, 0 blocked responses, 0 errors, 0 rate-limit hits.
- **Pitfall 2 false-negative fix**: `shared/http.ts` `fetchHtml` was using got's `responseType: 'text'` (UTF-8 decode) on drom which serves `Content-Type: text/html; charset=windows-1251`. All 200 records in smoke #1 came back mojibake'd (`brand: "����"`). Fixed by switching to buffer mode + iconv-lite charset-from-header decode.
- **01-07 deferred-issue resolved**: `shared/block-detection.ts` had bare-word captcha regex (`/проверка/i`, `/robot/i`, `/verify/i`) that 01-07's SUMMARY warned would false-positive on real drom (`Проверка по VIN` in nav). After the encoding fix exposed the cleartext, smoke #2 trapped on the very first fetch with `status: blocked, reason: captcha`. Tightened to specific multi-word challenge phrases + widget identifiers.
- **Live data quality verified**: Sample records show readable Cyrillic (`Лада`, `1111 Ока`, `Веста Кросс`, `Х-рей Кросс`, `body_types: ["хэтчбек", "универсал", "джип", "suv"]`). `description_ru` is human-readable Russian prose. Real WebP images (144x108 VP8 baseline).
- **`brand-aliases.json` populated**: `lada` entry has `ru: "Лада"`, 54 models, byte-stable sorted-key shape preserved.
- **Cursor cleanup**: no `.cursor.json` after clean completion.
- **FX cache populated**: `data/scraped/fx/cbr-2026-04-28.json` with USD/EUR/JPY/KRW/CNY/AED rates.

## Task Commits

Plan 09 is a checkpoint plan (no source files in `files_modified`). Two atomic gap-closure fixes were committed against the phase-01 deferred-issue queue:

1. **Pitfall 2 encoding fix** — `32c3b3f` `fix(01-09): decode windows-1251 in fetchHtml (Pitfall 2 false negative)`
2. **Captcha regex tightening** — `ff51216` `fix(01-09): tighten block-detection captcha regex (Rule 4 follow-up to 01-07)`

**Plan metadata commit (this SUMMARY)** to follow.

## Smoke Run Telemetry (run_id 2026-04-28T14-31-09Z)

```json
{
  "status": "ok",
  "source": "drom-catalog",
  "runId": "2026-04-28T14-31-09Z",
  "recordsWritten": 200,
  "durationMs": 4577762,
  "report": {
    "started_at": "2026-04-28T14:31:09.267Z",
    "finished_at": "2026-04-28T15:47:27.384Z",
    "duration_ms": 4577762,
    "pages_visited": 256,
    "models_added": 200,
    "models_updated": 0,
    "images_downloaded": 200,
    "images_skipped": 0,
    "errors": [],
    "rate_limit_hits": 0,
    "blocked_responses": 0,
    "fx_stale": true,
    "cursor_resumed": false,
    "final_status": "ok"
  }
}
```

`fx_stale: true` is benign — the CBR cache file from earlier in the day was reused (fx caching working as intended).

## Plan 09 Decision-Table Verdict

| Outcome | Status |
|---------|--------|
| Exit 0 + `final_status: "ok"` + ≥5 records + 0 blocks + < 10% errors | ✅ ALL met (200 ≫ 5; 0 blocks; 0 errors) |

**Resume signal:** `approved — smoke green, recordsWritten=200`.

## Task 2 — Full backfill (deferred)

Plan 09 task 2 is explicitly OPTIONAL and does not block phase-01 completion. The operator can launch `pnpm scrape:drom` (no whitelist) when ready for the 1–2 week unattended run. Phase 02 (Compliance) and Phase 03 (Schema/API/importer) can begin immediately in parallel — they do NOT wait on the full backfill (RESEARCH Risk 7 mitigation; plan 09 task 2 explicit guidance).

## Deviations

Two architectural deviations to prior plans, both committed inline with full context:

1. **Rule 4 deviation to plan 01-03 `shared/http.ts`** (commit `32c3b3f`):
   `fetchHtml`'s contract changed from "decode body as UTF-8 text" to "decode body as Buffer then iconv based on Content-Type charset". `fetchBuffer` unchanged. `dromClient` unchanged. Test surface added: `http.test.ts` now has a windows-1251 regression case using a 127.0.0.1 test server that serves Cyrillic bytes with `charset=windows-1251` and asserts the decoded string contains `"Лада"`/`"Проверка"` and no `"�"` replacement chars. Total tests: 80 → 81 (one added).

2. **Rule 4 deviation to plan 01-03 `shared/block-detection.ts`** (commit `ff51216`):
   `CAPTCHA_KEYWORDS` rewritten from `[/капча/i, /проверка/i, /robot/i, /verify/i]` to `[/captcha/i, /recaptcha|hcaptcha|cf-(challenge|turnstile)/i, /капча/i, /я не робот/i, /подтвердите.{0,40}не робот/i, /введите.{0,40}символ/i]`. All bounded patterns (no nested quantifiers, fixed-width gaps) — ReDoS-safe per T-03-02. Existing `captcha-response.html` fixture still triggers (matches `капча` + `Подтвердите ... не робот`). `block-detection.test.ts` rewrote the 4 bare-word tests as 6 specific-phrase tests + 3 regression tests for the live-drom false-positive cases (`Проверка по VIN`, `Проверка безопасности`, `robot vacuum / verify subscription`). Total tests: 81 → 86 (5 added).

Both deviations are the kind 01-07 SUMMARY had explicitly flagged as "Rule 4 architectural — do as a follow-up plan". Operator approval was obtained before each fix via interactive checkpoint.

## Verification

- `pnpm vitest run` → **86 / 86** passing (60 from waves 1–3 + 19 from 01-07 + 5 added here + 1 added in encoding fix + 1 already in 01-07 integration). 0 failures.
- `pnpm tsc -p tsconfig.server.json --noEmit` → exit 0
- `pnpm build` → 250.96 kB Vite bundle, no regressions
- `DROM_BRAND_WHITELIST=lada pnpm scrape:drom` → exit 0, 200 records, all Cyrillic readable, 0 blocks
- All 8 plan-09 task-1 post-run inspection checks satisfied (count ≥5, sample records schema-valid, report.final_status='ok' + 0 blocks + 0 errors, brand-aliases populated, cursor cleaned, FX cache populated)

## Self-Check: PASSED
