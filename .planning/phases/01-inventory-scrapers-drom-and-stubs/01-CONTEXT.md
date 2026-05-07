# Phase 01: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers a **runnable, infra-free drom.ru/catalog scraper** that writes structured JSON + WebP images to disk, plus **`IScraper` interface stubs for Encar / BeForward / Che168 / Autohome** that lock the contract for v1.x fillers.

The drom catalog scraper produces master-models data (NOT specific listings). Output records are 1:1 with the future `models` table sketch in `.planning/research/ARCHITECTURE.md:555` so Phase 4's importer becomes a near-pure JSON→SQL mapping.

**Out of phase (handled elsewhere):**
- Drizzle schemas, migrations, pg-boss queue (deferred to Phase 4)
- Yandex Object Storage / S3 image rehost (deferred to Phase 4 importer)
- Worker process / Hono worker entrypoint (this is a CLI script via `pnpm` scripts)
- Live Encar / BeForward / Che168 / Autohome scrapers — STUBS ONLY (full impls deferred to v1.x)
- Residential proxy budget commitments
- Per-source admin metrics endpoint (replaced with per-run `report.json`)
- Soft-delete by `last_seen_at` in DB (no DB; Phase 4 importer enforces)
- Matcher / quiz integration (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Stack & Layout
- **D-01:** Scraper TypeScript code lives at **`server/scrapers/`** at repo root. Layout: `server/scrapers/{drom,encar,beforward,che168,autohome}/index.ts` + `server/scrapers/shared/{http,normalize,images,fx,block-detection,types}.ts`. Phase 4 will add sibling `server/api/`, `server/db/`, `server/workers/` cleanly.
- **D-02:** **Switch to pnpm now.** Regenerate lockfile, install pnpm globally if needed. Justification: CLAUDE.md already names pnpm as the convention; only 3 deps in current `package.json` so migration cost is negligible; pnpm workspaces will be needed for `packages/shared` in Phase 4.
- **D-03:** Scraping toolchain: **lighter stack — `got-scraping` + `cheerio` + `p-limit` + `sharp`**. Drom is RU-domestic, public, static HTML — Crawlee/Playwright's anti-bot machinery is wasted here. Crawlee is reintroduced in v1.x specifically for Encar/Che168/Autohome where it earns its keep. The IScraper interface is toolchain-agnostic, so v1.x can mix Crawlee impls with the existing got-scraping ones without contract changes.

### Drom Access Route & Backfill
- **D-04:** **Researcher spike on drom partner API** at `https://baza.drom.ru/help/API` is the first task of Phase 1. Rule: if the API is reachable in <1 week onboarding and costs <$100/mo, use it. Otherwise fall back to polite scrape (Cheerio, 1 req/10–15s with ±20% jitter, respect `robots.txt` + `Crawl-delay`).
- **D-05:** **Full catalog backfill from day 1** — all brands, all generations. No "top-N first" smoke pass. Realistic budget: 1–2 weeks of polite scraping (per old D-06 carry-forward). Implication: scraper must be **resumable + idempotent** — write a `.cursor.json` with last-completed brand/model so an interrupted run continues where it left off without re-fetching, AND fixture-driven local tests must cover every code path before the long run starts.

### Output Artifact Contract
- **D-06:** **Output directory:** `data/scraped/` at repo root.
  - `data/scraped/drom/<run_id>/models.json` — main artifact (drom outputs MASTER MODELS, not specific car listings — corrects the SCOPE seed's `cars.json` naming)
  - `data/scraped/drom/<run_id>/images/<brand_slug>-<model_slug>-<generation>-hero.webp`
  - `data/scraped/drom/<run_id>/report.json` — run telemetry
  - `data/scraped/drom/<run_id>/.cursor.json` — resume state (deleted on successful completion)
  - `data/scraped/drom/current/` — symlink to most recent successful run dir, atomically updated at run end
  - `data/scraped/drom/brand-aliases.json` — Cyrillic↔Latin lookup, idempotent merge across runs
  - `data/scraped/fx/cbr-<YYYY-MM-DD>.json` — daily CBR FX cache
  - `data/scraped/SCHEMA.md` — record contract documentation (committed)
  - `data/scraped/README.md` — how to run + how Phase 4 will consume (committed)
  - `.gitignore` excludes `data/scraped/**/{models.json,images/,*.webp,report.json,.cursor.json,current,*.xml}` but tracks `data/scraped/SCHEMA.md`, `data/scraped/README.md`, and `data/scraped/drom/brand-aliases.json` (small, useful as a seed)
- **D-07:** **`run_id` format:** ISO-8601 UTC compact — `2026-04-28T07-30-00Z` (slashes/colons replaced with hyphens for filesystem safety). Sortable, unambiguous, works for multiple runs/day.
- **D-08:** **Re-run policy:** append a new `<run_id>/` directory each invocation. After successful completion, atomically update `data/scraped/drom/current/` symlink (write-to-tmp + `mv`-rename) to point at the new run. Phase 4 importer reads `current/`. Prior runs preserved for diffing/recovery; user prunes manually.
- **D-09:** **`IScraper` error contract:** discriminated union `ScrapeResult`:
  ```typescript
  type ScrapeResult =
    | { status: 'ok';             source: string; runId: string; recordsWritten: number; durationMs: number; report: ReportSummary }
    | { status: 'not_implemented'; source: string; deferredTo: 'v1.x'; todo: string }
    | { status: 'error';           source: string; runId?: string; error: { message: string; cause?: unknown } }
    | { status: 'blocked';         source: string; runId: string; reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'; sampleUrl?: string };
  ```
  CLI exit codes: `ok → 0`, `not_implemented → 2`, `error → 1`, `blocked → 3`. Stubs return `{status: 'not_implemented', source, deferredTo: 'v1.x', todo: 'Implement <source> scraper per IScraper contract'}` and log a single `console.warn(...)` line.

### JSON Record Schema
- **D-10:** **drom `models.json` records are 1:1 with `ARCHITECTURE.md:555` `models` table sketch** so Phase 4 importer is a pure JSON→SQL mapping. Fields:
  - `brand` (RU display, e.g., `BMW`), `brand_slug` (`bmw`)
  - `model` (RU display, e.g., `X5`), `model_slug` (`x5`)
  - `generation` (e.g., `G05`, `2018-present`), `year_from`, `year_to` (nullable for current generation)
  - `body_types: string[]` (e.g., `['SUV', 'Crossover']`)
  - `engine_options: { cc: number; hp: number; fuel: 'gas' | 'diesel' | 'hybrid' | 'electric' }[]`
  - `drive_options: string[]` (e.g., `['AWD', 'RWD']`)
  - `description_ru: string` (Cyrillic editorial blurb from drom catalog page)
  - `price_min_rub: number | null`, `price_max_rub: number | null` (range across generation)
  - `image_paths: string[]` (relative to run dir, e.g., `['images/bmw-x5-g05-hero.webp']` — exactly 1 hero per record per D-11)
  - `source: 'drom-catalog'`, `source_url: string`, `scraped_at: string` (ISO-8601 UTC)
  - **Uniqueness key** for upserts in Phase 4: `(brand_slug, model_slug, generation)` — matches `models.UNIQUE` in ARCHITECTURE.md
- **D-11:** **One hero image per model record.** Format: WebP via sharp, original dimensions preserved, quality 80. Filename: `<brand_slug>-<model_slug>-<generation>-hero.webp`. Skip if drom page has no usable image (record `image_paths: []` and continue).

### Operational Defaults (Claude's discretion — no founder pre-binding)
- **D-12:** **CBR FX failure mode:** fail-fast on the first run (no cached baseline yet). On subsequent runs, fall back to the most recent cached `cbr-<YYYY-MM-DD>.json` and set `fx_stale: true` in the run's `report.json` if the live fetch fails. Researcher confirms CBR endpoint behavior and windows-1251 encoding handling.
- **D-13:** **Block-detection thresholds:** halt the run when ≥5 consecutive thin (<2 KB) or empty HTTP responses arrive, OR when response body matches captcha keywords (`капча`, `проверка`, `robot`, `verify`, the standard set). On halt, write `report.json` with `status: 'blocked'`, then exit 3. Same module is reused (not specialized) by future Encar/etc. fillers per the IScraper contract.
- **D-14:** **Polite rate limit (scrape path only):** 1 req per 10s with ±20% jitter. Honor `Crawl-delay` from drom's `robots.txt` if larger than 10s. `p-limit(1)` for HTTP fetches, `p-limit(4)` for sharp image-decode/encode (CPU-bound, can parallelize without affecting drom load).
- **D-15:** **Resumable backfill cursor:** `.cursor.json` written at every brand boundary with `{lastBrandSlug, lastModelSlug, completedAt}`. Re-running a non-completed run resumes from `(lastBrandSlug, lastModelSlug)`. Successful completion deletes `.cursor.json`. Crash recovery is a guaranteed property, not a nice-to-have, given full-catalog-day-1 commits to a multi-day run.
- **D-16:** **Cyrillic↔Latin auto-build:** drom catalog pages expose both forms in the same DOM (header + URL slug). The scraper extracts both during parse and emits an upsert into `data/scraped/drom/brand-aliases.json` shaped as `{ brand_slug: { ru: string, latin: string, models: { model_slug: { ru, latin } } } }`. Idempotent merge by `brand_slug` (last write wins for canonical labels but preserves prior keys). Phase 7 admin can later override per-row.
- **D-17:** **Run report (`report.json`):** records `started_at`, `finished_at`, `duration_ms`, `pages_visited`, `models_added`, `models_updated`, `images_downloaded`, `images_skipped`, `errors: { url, message }[]`, `rate_limit_hits`, `blocked_responses`, `fx_stale: boolean`, `cursor_resumed: boolean`, `final_status: 'ok' | 'blocked' | 'error'`.

### Claude's Discretion
The following are explicitly delegated to the researcher and planner:
- Exact `got-scraping` config (user-agent rotation strategy, cookie jar persistence, retry-on-5xx specifics)
- `cheerio` selector strategies for drom catalog pages (researcher writes fixtures from sanitized real pages first)
- `sharp` WebP encoding precision (8-bit lossy at quality 80 vs 10-bit lossless if drom hero images are SVG-flat)
- Whether `data/scraped/drom/brand-aliases.json` lives at the brand-aliases level or inside each run dir (current decision: brand-aliases at the brand level so it accumulates; planner can split if conflicts emerge)
- CLI ergonomics — single `pnpm scrape <source>` dispatcher with `<source>` arg, vs separate `pnpm scrape:drom`, `pnpm scrape:encar` etc. (planner picks based on testing readability)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints (read first)
- `.planning/PROJECT.md` — locked stack (Node 22 LTS + Hono 4.12 + Drizzle 0.45 + Crawlee/Playwright 1.59 in CLAUDE.md, but Phase 1 narrows to got-scraping + cheerio + sharp), 152-ФЗ posture, USS exclusion, anti-features
- `.planning/REQUIREMENTS.md` §Inventory Scrapers — SCRAPE-05 (drom master models), SCRAPE-06 (image rehost — adapted to local WebP), SCRAPE-09 (per-source health — adapted to `report.json`), SCRAPE-10 (Cyrillic↔Latin lookup), SCRAPE-11 (CBR FX feed — adapted to JSON cache). SCRAPE-01..04 are stubs only, deferred to v1.x.
- `.planning/ROADMAP.md` §"Phase 1: Inventory Scrapers" — 10 success criteria, dependency surface (none), reorder log
- `.planning/STATE.md` — current position + carrying-forward decisions
- `.planning/phases/01-inventory-scrapers-drom-and-stubs/01-SCOPE.md` — founder-intent seed (verbatim brief, in/out lists, anchor questions). Will be moved to `.planning/transitions/` after Phase 1 completes.
- `CLAUDE.md` — backend stack pin (Node 22 LTS), Crawlee/Playwright/sharp/Drizzle versions, Yandex Cloud `ru-central1` for future phases

### Schema sketches (Phase 1 output target)
- `.planning/research/ARCHITECTURE.md:555` — `models` table SQL sketch — drom `models.json` records mirror this 1:1 (D-10)
- `.planning/research/ARCHITECTURE.md` §Component Responsibilities (line 95) — Inventory Service / Scraper Workers role separation (Phase 1 lives in the Scraper Workers row but as a CLI, not a worker process yet)
- `.planning/research/ARCHITECTURE.md` §Recommended Project Structure (line 114) — confirms `server/` is the home for backend code; Phase 1 establishes `server/scrapers/`

### Carrying-forward research (still relevant after scope reduction)
- `.planning/research/STACK.md` — sharp WebP, p-limit patterns, Cheerio + got-scraping vs Crawlee tradeoffs
- `.planning/research/PITFALLS.md` Pitfall 7 (drom partner API check — research-spike anchor for D-04)

### External docs (researcher will validate)
- `https://baza.drom.ru/help/API` — drom partner API ToS, fees, onboarding latency (D-04 trigger; researcher first-day spike)
- `https://www.cbr.ru/scripts/XML_daily.asp` — CBR daily FX XML feed; windows-1251 encoded (SCRAPE-11)
- `https://github.com/apify/got-scraping` — got-scraping README + options (anti-fingerprint headers, retry, cookie jar)
- `https://github.com/cheeriojs/cheerio` — cheerio docs (server-side jQuery-like DOM parsing)
- `https://sharp.pixelplumbing.com/` — sharp WebP encoding API (`.webp({ quality: 80 })`)
- `https://github.com/sindresorhus/p-limit` — p-limit concurrency primitive

### Internal frontend types (do not modify in Phase 1, but be aware)
- `src/crm/types.ts:1` — `Country = 'jp' | 'cn' | 'kr'` (will widen in Phase 5 to all 6 markets via Phase 4 country registry; Phase 1 drom output should set `country` to a value that maps cleanly into the eventual registry, although drom records are master-models so country isn't part of the record per ARCHITECTURE.md sketch)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None.** Existing repo is a Vite SPA only — `src/` is frontend-only. No `server/` tree, no `pnpm`, no Node-server deps. Phase 1 establishes the entire Node-side scaffolding: `server/scrapers/`, `pnpm-workspace.yaml` (single root for now), updated root `package.json` with `pnpm` scripts and Node-side deps.

### Established Patterns (from research, not yet in code)
- **Pattern 3 (Source-Attributed Inventory) — partial application** — every scraped record carries `(source, source_url)`; full `(source, source_id, last_seen_at)` UPSERT pattern moves to Phase 4 importer since there's no DB to UPSERT into. Phase 1 records carry `source: 'drom-catalog'` and the unique-key tuple `(brand_slug, model_slug, generation)` so Phase 4 can do the upsert work.
- **Pattern 4 (Job Queue as Async Boundary) — N/A in Phase 1** — pg-boss / queue patterns reserved for Phase 4+. Phase 1 is a CLI script.
- **Pattern 1 (Modular Monolith with Worker Sidecar) — N/A in Phase 1** — same Node binary / worker sidecar pattern reserved for Phase 4+. Phase 1 is a CLI script invoked via pnpm scripts; same binary as future workers but invoked directly, not via pg-boss dispatch.

### Integration Points
- **From this phase:** `data/scraped/drom/current/models.json` + `images/*.webp` + `brand-aliases.json` — read by Phase 4 `pnpm import:scraped` job; record schema is documented at `data/scraped/SCHEMA.md`.
- **To Phase 4 importer:** records are 1:1 with the `models` Drizzle schema; `(brand_slug, model_slug, generation)` is the unique key; image rehost from local `data/scraped/.../images/*.webp` → Yandex Object Storage `images/models/<brand_slug>/<model_slug>/<generation>-hero.webp` happens inside the importer, not here.
- **To Phase 6 matcher:** Phase 6's matcher's "под индивидуальный заказ" fallback reads `models` rows; Phase 1 + Phase 4 importer together populate that source of truth.
- **To Phase 7 admin:** brand-alias overrides (Cyrillic↔Latin lookup edits) — Phase 1 emits the auto-built `brand-aliases.json`, Phase 7 admin UI can override per-row in DB.

</code_context>

<specifics>
## Specific Ideas

- **Full-catalog-day-1 + resumability is non-negotiable.** The user picked full backfill (no top-N smoke pass), so the planner MUST design the run as crash-tolerant: brand-by-brand cursor, atomic per-model writes (write-to-tmp + rename), and fixture tests covering every code path BEFORE the long run starts. This includes a Phase 1 internal "go/no-go" gate: all parser + normalize + image + FX + brand-alias modules must have green local tests against sanitized fixtures before the production drom run is invoked.
- **Cyrillic↔Latin lookup auto-build is a co-product.** drom exposes both forms; the scraper extracts both *as a side effect* of its main parse loop, not as a second pass. `brand-aliases.json` is committed to git (small file, seed for Phase 7) and idempotently merged across runs.
- **`models.json` corrects the SCOPE seed's `cars.json` naming.** Drom outputs master models, not specific car listings. The SCOPE seed (written before this discussion) referenced `cars.json` throughout — that's wrong terminology. The four stub sources would emit `cars.json` if implemented (specific listings with VIN, mileage, photos); drom emits `models.json`. SCHEMA.md should document both shapes (drom = `models`, others = `cars`) even though only drom is real in Phase 1.
- **CBR XML is windows-1251 encoded.** Researcher confirms but the standard pattern is `iconv-lite` on the response body. `got-scraping` returns Buffer when `responseType: 'buffer'`; decode explicitly before parsing.
- **`p-limit(1)` for HTTP, `p-limit(4)` for sharp.** Drom rate limit is the bottleneck, not CPU; image-decode is CPU-bound and can parallelize at 4× concurrency without touching drom. Verifier should check this in run telemetry.
- **Symlink `data/scraped/drom/current/` is OS-specific.** macOS/Linux symlinks work; Windows needs Junction Points. Document Windows handling in `data/scraped/README.md` (the team uses macOS dev + Linux CI per CLAUDE.md, so symlink works in production paths; Windows is a documentation note only).

</specifics>

<deferred>
## Deferred Ideas

These came up during discussion or implication but belong to other phases:

- **Live Encar / BeForward / Che168 / Autohome scrapers** — explicitly deferred to v1.x. Phase 1 ships only IScraper-conforming stubs. v1.x team picks Crawlee + residential proxy strategy on top of the contract Phase 1 locks.
- **`data/scraped/` import to DB** — Phase 4 builds `pnpm import:scraped` that reads `data/scraped/drom/current/models.json` and writes Drizzle-managed Postgres rows. Out of Phase 1.
- **Image rehost to Yandex Object Storage** — Phase 4 importer rehosts WebP files to `images/models/<brand_slug>/<model_slug>/<generation>-hero.webp` in the bucket. Phase 1 only writes locally.
- **Per-source admin metrics endpoint (`GET /api/admin/scrapers/health`)** — Phase 7 admin reads from a DB-backed metrics table populated by Phase 4+ workers. Phase 1 emits `report.json` per run; the worker harness that pushes those into a metrics table is Phase 4.
- **Soft-delete via `last_seen_at`** — Phase 4 importer logic. Phase 1 has no concept of "missing models" since drom catalog is mostly additive.
- **Cron / scheduled invocation** — Phase 4+ wires drom into pg-boss recurring schedule (monthly per old D-07). Phase 1 is manual invocation.
- **Concurrency upgrades** (multi-threaded scraping with separate proxy IPs) — v1.x for Encar/Che168/Autohome where it earns its keep.
- **Brand whitelist or top-N smoke pass** — considered as scope option (Area 2 second sub-question), not chosen. Full-catalog-day-1 stands.
- **CI Cyrillic-fixture test for the scraper** — useful guardrail (parallel to PDF Cyrillic test in Phase 6) but not strictly Phase 1-blocking. Planner can include it as a Wave 0 fixture-test plan if budget allows; otherwise defer to Phase 4 alongside the importer's CI.
- **Brand-aliases conflict resolution UI** — Phase 7 admin can edit `brand_aliases` table rows; Phase 1 uses last-write-wins JSON merge by `brand_slug`.

</deferred>

---

*Phase: 01-inventory-scrapers-drom-and-stubs*
*Context gathered: 2026-04-28*
