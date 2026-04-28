---
phase: 1
slug: inventory-scrapers-drom-and-stubs
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 (ESM-native, Node env) |
| **Config file** | `vitest.config.ts` at repo root (Wave 0 deliverable — currently absent) |
| **Quick run command** | `pnpm vitest run server/tests/<file>.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~25–35s full suite (cold), ~1–3s per file (warm) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run server/tests/<file>.test.ts` (touched-file scope)
- **After every plan wave:** Run `pnpm vitest run` (full suite, must be green)
- **Before `/gsd-verify-work`:** Full suite green + Wave 1 fixture-catalog integration run green + at least one successful smoke run (`pnpm scrape:drom` against 1 brand) populating `data/scraped/drom/current/models.json`
- **Max feedback latency:** ≤ 35 seconds (full suite) / ≤ 3 seconds (single file)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-XX | 01 | 0 | infra | — | pnpm migration completes without breaking Vite build | manual | `pnpm install && pnpm build` (Vite must succeed) | ❌ W0 | ⬜ pending |
| 01-02-XX | 02 | 0 | infra | — | TypeScript compiles `server/**/*.ts` cleanly | unit | `pnpm tsc -p tsconfig.server.json --noEmit` | ❌ W0 | ⬜ pending |
| 01-03-XX | 03 | 0 | D-09 | — | `IScraper` + `ScrapeResult` types compile and exported | unit | `pnpm tsc -p tsconfig.server.json --noEmit` | ❌ W0 | ⬜ pending |
| 01-04-XX | 04 | 0 | D-14 | — | `got@15` instance + cookieJar + retry + polite-delay timing | unit (timing) | `pnpm vitest run server/tests/http.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-XX | 05 | 0 | D-13 | — | 5 thin/empty responses → BlockedError; 4 thin → OK; captcha keywords match | unit | `pnpm vitest run server/tests/block-detection.test.ts` | ❌ W0 | ⬜ pending |
| 01-06-XX | 06 | 0 | SCRAPE-06 | — | JPEG → WebP round-trip preserves dimensions, valid WebP magic bytes | unit | `pnpm vitest run server/tests/images.test.ts` | ❌ W0 | ⬜ pending |
| 01-07-XX | 07 | 0 | SCRAPE-11 | — | CBR XML windows-1251 decode → `{USD,EUR,JPY,KRW,CNY,AED}`; first-run no-cache throws; subsequent stale fallback sets `fx_stale: true` | unit | `pnpm vitest run server/tests/fx.test.ts` | ❌ W0 | ⬜ pending |
| 01-08-XX | 08 | 0 | SCRAPE-10 | — | Idempotent merge of `brand-aliases.json` by `brand_slug` — running merge twice yields identical bytes | unit | `pnpm vitest run server/tests/brand-aliases.test.ts` | ❌ W0 | ⬜ pending |
| 01-09-XX | 09 | 0 | infra | — | `slugify`, `parsePrice`, `parseYear` helpers handle Cyrillic + edge cases | unit | `pnpm vitest run server/tests/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 01-10-XX | 10 | 0 | D-15 | — | Cursor write→read round-trips; SIGKILL mid-run leaves recoverable cursor; successful run deletes cursor | integration | `pnpm vitest run server/tests/cursor.test.ts` | ❌ W0 | ⬜ pending |
| 01-11-XX | 11 | 0 | D-08 | — | Symlink `current/` atomically updated (write-tmp + rename); readers see old or new, never partial | integration | `pnpm vitest run server/tests/symlink.test.ts` | ❌ W0 | ⬜ pending |
| 01-12-XX | 12 | 0 | D-09 | — | Stub `IScraper#run()` returns `{status:'not_implemented'}`; CLI dispatcher exits 2; logs TODO | unit + smoke | `pnpm vitest run server/tests/stubs.test.ts && pnpm scrape:encar; test $? -eq 2` | ❌ W0 | ⬜ pending |
| 01-13-XX | 13 | 1 | SCRAPE-05 | — | drom brand-index parser extracts brand list with Cyrillic + Latin slugs from fixture | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "brand index"` | ❌ W1 | ⬜ pending |
| 01-14-XX | 13 | 1 | SCRAPE-05 | — | drom model-list parser per brand → list of models with slugs | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "model list"` | ❌ W1 | ⬜ pending |
| 01-15-XX | 13 | 1 | SCRAPE-05 | — | drom generation-list parser → list of generations with year ranges | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "generation list"` | ❌ W1 | ⬜ pending |
| 01-16-XX | 13 | 1 | SCRAPE-05 / D-10 | — | drom generation-page parser produces full `models.json` row matching `ARCHITECTURE.md:555` schema 1:1 | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "generation page"` | ❌ W1 | ⬜ pending |
| 01-17-XX | 14 | 1 | SCRAPE-09 / D-17 | — | `report.json` written even on `blocked` exit; contains all D-17 fields | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "report.json"` | ❌ W1 | ⬜ pending |
| 01-18-XX | 15 | 1 | SCRAPE-05 (E2E) | — | Full pipeline against fixture catalog (1 brand × 2 models) produces deterministic `models.json` + WebP files; idempotent (re-run = same output) | integration | `pnpm vitest run server/tests/drom-integration.test.ts` | ❌ W1 | ⬜ pending |
| 01-19-XX | 16 | 1 | docs | — | `data/scraped/SCHEMA.md` documents every field of `models.json` per D-10 | manual | `test -f data/scraped/SCHEMA.md && grep -q "brand_slug\|model_slug\|generation\|image_paths" data/scraped/SCHEMA.md` | ❌ W1 | ⬜ pending |
| 01-20-XX | 16 | 1 | docs | — | `data/scraped/README.md` explains run + Phase 3 import contract | manual | `test -f data/scraped/README.md && grep -q "pnpm scrape\|current/\|Phase 3" data/scraped/README.md` | ❌ W1 | ⬜ pending |
| 01-21-XX | 17 | 2 | SCRAPE-05 (live) | — | Live `pnpm scrape:drom` smoke (1 brand) populates `data/scraped/drom/<run_id>/models.json` and updates `current/` symlink | manual | `INTEGRATION=1 pnpm scrape:drom --brand=bmw; test $? -eq 0 && test -L data/scraped/drom/current` | ❌ W2 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 must land **before** any Wave 1 task can begin. It establishes the test framework + all shared modules + every fixture file:

- [ ] `vitest.config.ts` — root config (env: 'node', include `server/tests/**/*.test.ts`)
- [ ] `tsconfig.server.json` — Node-side TS config inheriting from root
- [ ] `pnpm-lock.yaml` — generated by pnpm migration; `package-lock.json` removed
- [ ] `package.json` — adds `packageManager: "pnpm@9.x"`, `engines.pnpm`, `scripts.scrape:*`
- [ ] `server/scrapers/shared/types.ts` — `IScraper`, `ScrapeResult` discriminated union
- [ ] `server/scrapers/shared/http.ts` — got@15 instance + tough-cookie jar + polite delay + retry
- [ ] `server/scrapers/shared/normalize.ts` — slugify, parsePrice, parseYear, Cyr↔Lat helpers
- [ ] `server/scrapers/shared/images.ts` — sharp WebP encoder
- [ ] `server/scrapers/shared/fx.ts` — CBR XML decode + cache + fail-fast/fallback
- [ ] `server/scrapers/shared/block-detection.ts` — 5-counter + captcha keywords
- [ ] `server/scrapers/shared/brand-aliases.ts` — idempotent merge
- [ ] `server/scrapers/shared/cursor.ts` — `.cursor.json` read/write/delete with atomic semantics
- [ ] `server/scrapers/shared/symlink.ts` — atomic `current/` update
- [ ] `server/scrapers/cli.ts` — dispatcher (single `pnpm scrape <source>` or per-source — planner picks per CONTEXT.md Discretion)
- [ ] `server/scrapers/{encar,beforward,che168,autohome}/index.ts` — 4 stubs returning `{status:'not_implemented'}`
- [ ] All test files listed in §"Per-Task Verification Map" — Wave 0 stubs (RED) for Wave 1 to fill (GREEN)
- [ ] All fixture files listed in RESEARCH.md §"Validation Architecture" → Wave 0 Gaps

**Framework install:** `pnpm add -D vitest @types/node` as part of P-01 (pnpm migration).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live drom catalog scrape (full backfill, ~1–2 weeks) | SCRAPE-05 (full coverage) | Network-bound, multi-day, rate-limited; cannot run in CI | Run `pnpm scrape:drom` on a developer machine or single RU VM. Monitor `data/scraped/drom/<run_id>/report.json` for `final_status: 'ok'`. Verify `current/` symlink updates. |
| Smoke run on 1 brand before full backfill | SCRAPE-05 (smoke gate) | Network-bound | `pnpm scrape:drom --brand=bmw` (or whatever scope flag the planner picks). Verify exit 0 + `models.json` non-empty + `images/*.webp` present + report.json `final_status: 'ok'`. |
| Vite frontend build still works post pnpm migration | infra | Build step is end-to-end; not a unit test | `pnpm build` — must produce `dist/` with no errors. |
| `data/scraped/SCHEMA.md` is rich enough for Phase 3 importer | docs | Subjective — Phase 3 author signs off | Phase 3 planner reads SCHEMA.md and confirms every field maps to a Drizzle column without ambiguity. |
| `data/scraped/README.md` runnability test | docs | Documentation test | New developer (or `git clone` on a fresh box) follows README, runs `pnpm scrape:drom`, gets sensible output. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files referenced in Wave 1+ tasks
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 35s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter (after planner finalizes per-task mapping)

**Approval:** pending
