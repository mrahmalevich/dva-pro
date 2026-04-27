# Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs — Scope Seed

**Created:** 2026-04-27
**Status:** Awaiting `/gsd-discuss-phase 1` (will produce 01-CONTEXT.md, then `/gsd-plan-phase 1` produces 01-XX-PLAN.md plans)
**Predecessor:** This phase replaces the original Phase 5 (Inventory Pipeline — Encar + drom + JP/CN scrapers). The 8 plans, CONTEXT, RESEARCH, PATTERNS, VALIDATION, DISCUSSION-LOG written for that scope were discarded on 2026-04-27 because the new scope has no DB, no S3, no queue, and no live scrapers (Encar/BeForward/Che168/Autohome are stubs only).

> This is a **scope seed**, not a CONTEXT.md. The discuss-phase agent should consume this as the founder's intent, ask clarifying questions, and produce a fresh `01-CONTEXT.md` per the standard GSD discuss-phase workflow.

---

## Founder Intent (verbatim from 2026-04-27 chat)

1. Reorder phases: this scraping work is the FIRST step (Phase 1). Old Phase 1 (Compliance & Infra) becomes Phase 2; everything else shifts down by one. Done — see ROADMAP.md `## Reorder Log`.
2. This phase creates **scraping infrastructure for drom + stubs for the other services** (Encar, BeForward, Che168, Autohome). The four "other" sources are not implemented; they get an `IScraper` interface implementation that returns `{ status: 'not_implemented' }` and logs a TODO so the contract is locked.
3. This phase scrapes data into **structured JSON files + WebP images** on disk. The JSON output must be importable to a DB later (Phase 3), once architectural decisions about the DB schema are finalized.
4. Acceptance: running this phase's output should let me execute drom.ru/catalog scraping with JSON/WebP output (single-shot CLI script, e.g. `pnpm scrape:drom`).

## What's IN scope

- `IScraper` TypeScript interface — locks the contract drom proves out
- Real working drom.ru/catalog scraper (master models DB) — CheerioCrawler + polite rate limit, OR partner API if onboarding is fast (<1wk, <$100/mo per old D-05 rule)
- Shared modules: `http` (got-scraping or undici-based), `normalize` (brand/model canonicalization, currency parsing), `images` (download + sharp WebP conversion), `block-detection` (5+ thin/empty responses → halt)
- CBR daily FX XML feed — fetched per run, cached as JSON
- Cyrillic↔Latin brand/model lookup — auto-built from drom catalog parses, written to `data/scraped/drom/brand-aliases.json`
- Run report JSON per run (`report.json`) — started_at, finished_at, pages_visited, models_added, errors[], blocked_responses
- Stub modules for Encar / BeForward / Che168 / Autohome — implement `IScraper`, return `{ status: 'not_implemented' }`, log TODO, exit non-zero when invoked
- JSON schema documentation (`data/scraped/SCHEMA.md`) precise enough that a future Phase 3 importer can map deterministically to the DB
- README explaining how to run, where output lands, what stubs do

## What's OUT of scope (vs the original Phase 5)

- ❌ Drizzle schemas (deferred to new Phase 3)
- ❌ pg-boss queue + cron schedules (deferred to new Phase 3 worker)
- ❌ Yandex Object Storage / S3 image rehost (replaced with local WebP files)
- ❌ Worker process / Hono worker entrypoint (this is a CLI script)
- ❌ Live Encar scraper (Crawlee Playwright Firefox + KR residential proxy + Carapis fallback) → STUB ONLY
- ❌ Live BeForward scraper → STUB ONLY
- ❌ Live Che168 scraper → STUB ONLY
- ❌ Live Autohome scraper → STUB ONLY
- ❌ Residential proxy budget commitments
- ❌ Per-source admin metrics endpoint (replaced with `report.json`)
- ❌ Soft-delete via `last_seen_at` in DB (no DB; soft-delete logic moves to Phase 3 importer)
- ❌ `(source, source_id)` UNIQUE constraint enforcement at DB level (no DB; Phase 3 importer enforces it)

## Acceptance Criteria

(See ROADMAP.md §"Phase 1: Inventory Scrapers" success criteria — 10 SC items, condensed: `pnpm scrape:drom` runs end-to-end on a fresh clone with no infra and produces a deterministic, idempotent, schema-documented `cars.json` + `images/*.webp` directory; stubs exist for the 4 other sources and report `not_implemented` cleanly.)

## Anchors for the Discussion Phase

The discuss-phase agent should ask the user about:
- **Output directory** — `data/scraped/`? `out/scraped/`? `server/scraped/`? Repo top-level vs under `server/`?
- **Run identifier** — UTC timestamp `2026-04-27T11-00-00Z`? Daily slug `2026-04-27`? Sequential `run-001`?
- **Drom backfill scope** — full catalog (1–2 weeks polite scrape per old D-06) on first run? Or top-N brands first to validate the pipeline shape, then full?
- **Concurrency** — single-thread polite (1 req/10–15s)? Or 2–3 parallel with separate cooldowns?
- **Re-run policy** — append new `run_id` directory each invocation? Or upsert into a single canonical `current/` directory + keep previous N runs?
- **Image dimensions** — preserve original (per old D-16) or cap at e.g. 1600px width?
- **Stub error contract** — do stubs throw, return a Result, or just log + return `{ status: 'not_implemented' }` and exit 1?
- **Crawlee vs lighter alternative** — drom is RU-domestic, public, no JS rendering needed. Crawlee+CheerioCrawler is overkill if a thinner stack (got-scraping + cheerio + p-limit + tough-cookie) suffices. Researcher should recommend.
- **CBR FX behavior** — hard-fail run on CBR XML unreachable, or use last cached value with a `stale_fx: true` flag in `report.json`?
- **`server/` vs flat repo layout** — original Phase 5 assumed a `server/` tree (also a Phase 2/3 deliverable). Without DB, do we still want `server/` as the home for scraper code, or `scrapers/` at repo root, or under existing `src/`?

## Useful Context (carry-forward from prior thinking)

- **Frontend `Country` enum** at `src/crm/types.ts:1` is `'jp' | 'cn' | 'kr'` — Phase 4 (formerly 3) widens this to all 6 markets; Phase 1 scraper output should write country values matching the eventual 6-market registry.
- **Frontend `Car` interface** at `src/crm/types.ts:4` defines public fields — drom output's normalized records should populate fields that map cleanly to this shape so the future Phase 3 importer doesn't need a heavy translation layer.
- **Tech stack pin from CLAUDE.md** — Crawlee/Playwright 1.59 + Drizzle 0.45 + sharp + Node 22 LTS. Drom doesn't need Playwright (static HTML); Cheerio path is preferred. Sharp is required for WebP.

## Files-Modified Estimate (informational, not binding)

- `package.json` — add `pnpm scrape:drom` + `pnpm scrape:<stub>` scripts; add deps (`crawlee` or `got-scraping`+`cheerio`, `sharp`, `zod`)
- `tsconfig.*` — server/scraper TS config
- `server/scrapers/types.ts` — `IScraper` interface
- `server/scrapers/shared/http.ts` — polite HTTP fetch with rate limit + retry
- `server/scrapers/shared/normalize.ts` — brand/model/price/year canonicalization
- `server/scrapers/shared/images.ts` — download + WebP conversion via sharp
- `server/scrapers/shared/fx.ts` — CBR XML fetcher → JSON cache
- `server/scrapers/shared/block-detection.ts` — thin/empty/captcha response detector
- `server/scrapers/drom/index.ts` — drom catalog scraper (real)
- `server/scrapers/{encar,beforward,che168,autohome}/index.ts` — `IScraper` stubs
- `server/scripts/scrape.ts` (or per-source CLIs) — entry points wired to `pnpm` scripts
- `data/scraped/SCHEMA.md` — JSON record contract
- `data/scraped/README.md` — how to run / where output lands / how Phase 3 will consume
- (No `.gitkeep` needed — `data/scraped/` content is gitignored, only schemas and READMEs are tracked)
- `.gitignore` — ignore scraped output dirs except docs

---

*Once the user invokes `/gsd-discuss-phase 1`, the discuss-phase workflow will produce a fresh `01-CONTEXT.md` based on the conversation. This SCOPE.md becomes a historical seed and may be deleted or moved to `.planning/transitions/` afterward.*
