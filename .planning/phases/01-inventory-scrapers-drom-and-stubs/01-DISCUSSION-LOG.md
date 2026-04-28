# Phase 01: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 01-inventory-scrapers-drom-and-stubs
**Areas discussed:** Stack (layout / pkg mgr / toolchain), Drom (access route + first-run scope), Output contract (paths / run-id / re-run / IScraper), JSON schema depth (Phase 3 readiness)

---

## Stack — layout, pkg mgr, toolchain

### Where should scraper TypeScript code live?

| Option | Description | Selected |
|--------|-------------|----------|
| `server/scrapers/` | Matches CLAUDE.md convention. Phase 3 cleanly adds server/api/, server/db/, etc. alongside. server/scrapers/{drom,encar,beforward,che168,autohome,shared}/. Establishes the boundary now. | ✓ |
| `scrapers/` at repo root | Flatter; no implication that a server is coming. Easier as standalone CLI. Phase 3 either moves under server/ (churn) or leaves it sibling (slightly weird). | |
| `src/server/scrapers/` | Single tsconfig, single source root. Muddles client-only Vite SPA paths with Node-only server code; bundler config gets messier in Phase 3. | |

**User's choice:** `server/scrapers/`
**Notes:** Recommended option; aligns with CLAUDE.md convention.

### Stay on npm or switch to pnpm now?

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm | CLAUDE.md already names pnpm. Switching now is trivial (3 deps); switching later is a multi-PR migration including CI. pnpm workspaces help when Phase 3 adds packages/shared. | ✓ |
| Stay on npm | Zero migration cost; works fine for current scope. Loses CLAUDE.md alignment. | |

**User's choice:** pnpm
**Notes:** Recommended; switch happens during Phase 1 setup.

### Scraping toolchain for drom?

| Option | Description | Selected |
|--------|-------------|----------|
| Lighter stack: got-scraping + cheerio + p-limit + sharp | Drom is RU-domestic static HTML — Crawlee's anti-bot machinery is wasted. ~4 deps; reads like a normal Node script. Crawlee reintroduced in v1.x for Encar etc. where it earns its keep. | ✓ |
| Crawlee 3.x + CheerioCrawler | Matches CLAUDE.md stack pin. Uniform queue/retry/rate-limit out-of-the-box. ~15 deps + abstractions. Stub modules import Playwright types they don't need. | |
| Crawlee 3.x with PlaywrightCrawler reserved for stubs | CheerioCrawler for drom; stubs reference PlaywrightCrawler in type signatures. Forward-compatible but adds Playwright (~150MB) for code that won't run. | |

**User's choice:** Lighter stack — got-scraping + cheerio + p-limit + sharp
**Notes:** Recommended; IScraper contract is toolchain-agnostic so v1.x can reintroduce Crawlee per source without contract changes.

---

## Drom — access route + first-run scope

### Drom access route — partner API or polite scrape?

| Option | Description | Selected |
|--------|-------------|----------|
| Researcher checks API first | Per old D-05: gsd-phase-researcher does a one-day spike on baza.drom.ru/help/API. Use API if reachable in <1wk and <$100/mo. Otherwise polite scrape (Cheerio, 1 req/10–15s, robots.txt + Crawl-delay). | ✓ |
| Skip API check — polite scrape only | Commit to polite scrape now. Faster start. Locks out the API path even if it's free + instant. | |
| Use partner API only | Block phase on partner API onboarding. Risky if onboarding is >1wk or paid. | |

**User's choice:** Researcher checks API first
**Notes:** Recommended; gsd-phase-researcher is the spike vehicle. Decision rule (<1wk + <$100/mo) carried forward as D-04 trigger.

### First-run drom backfill scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-N brands first, then full | ~10 priority brands on day 1 to validate every code path; then full backfill. Catches schema mistakes early. | |
| Full catalog from day 1 | All brands, all generations on first run. ~1–2 wks polite scrape. If schema is wrong, you discover it after a week. | ✓ |
| Manual brand whitelist | User picks whitelist before each run. Smaller scope; delays full coverage indefinitely. | |

**User's choice:** Full catalog from day 1
**Notes:** Implication recorded as D-05 + Specifics §"Full-catalog-day-1 + resumability is non-negotiable". Planner MUST design crash-tolerant + fixture-test-gated.

---

## Output contract — paths, run-id, IScraper

### Output directory location?

| Option | Description | Selected |
|--------|-------------|----------|
| `data/scraped/` at repo root | data/scraped/drom/<run_id>/{models.json, images/*.webp, report.json}; data/scraped/fx/cbr-<date>.json. Top-level, instantly findable. .gitignore excludes content but tracks SCHEMA.md + README.md. | ✓ |
| `server/data/scraped/` | Co-located with server-side code. Hides output one level deeper; future server/data/ namespacing gets awkward. | |
| `.scraped/` (hidden) | Hidden dot-dir. Conventional for derived artifacts but harder for humans to spot during dev; some tools exclude dot-dirs. | |

**User's choice:** `data/scraped/` at repo root
**Notes:** Recommended.

### Run identifier format?

| Option | Description | Selected |
|--------|-------------|----------|
| ISO-8601 UTC compact | 2026-04-28T07-30-00Z (slashes/colons replaced with hyphens). Sortable, unambiguous, multiple runs/day distinguishable. | ✓ |
| Daily slug (2026-04-28) | One run per UTC day; same-day overwrites. Cleaner listings; loses sub-day history. | |
| Sequential run-NNN | run-001, run-002. Loses temporal info; need manifest to know when run-042 happened. | |

**User's choice:** ISO-8601 UTC compact
**Notes:** Recommended.

### Re-run policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Append new run dir + symlink current/ → latest | Each run is a fresh dated dir. current/ is atomically updated. Phase 3 reads current/. Prior runs preserved for diffing. | ✓ |
| Append-only (no current/ symlink) | Just dated dirs; consumer finds latest via lex sort. Simpler but couples consumer to layout. | |
| Overwrite canonical current/, keep last N as snapshots | current/ overwritten in place; snapshots in history/<run_id>/. Risk: in-progress run can corrupt current/. | |

**User's choice:** Append + symlink current/
**Notes:** Recommended. Atomic update: write-to-tmp + mv-rename. Specifics §"Symlink is OS-specific" — Windows handling documented in README, dev/CI is macOS/Linux.

### IScraper error shape for stub sources?

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union Result<T> | ScrapeResult = {status: 'ok'} \| {status: 'not_implemented'} \| {status: 'error'} \| {status: 'blocked'}. Type-safe; CLI maps to exit codes 0/2/1/3. | ✓ |
| Throw NotImplementedError + try/catch | Stubs throw; CLI catches and maps. Idiomatic but exception-driven control flow is a footgun with async stacks. | |
| Plain `{status: string}` | Simpler shape; loses payload-per-status type safety. | |

**User's choice:** Discriminated union Result<T>
**Notes:** Recommended; full type captured in CONTEXT.md D-09.

---

## JSON schema depth (Phase 3 readiness)

> Mid-discussion correction: drom outputs MASTER MODELS, not specific listings. The SCOPE seed's `cars.json` naming was wrong. drom → `models.json`; the four stub sources would emit `cars.json` if implemented. Recorded as Specifics §"`models.json` corrects the SCOPE seed's `cars.json` naming."

### How rich should each drom models.json record be?

| Option | Description | Selected |
|--------|-------------|----------|
| Full 1:1 with ARCHITECTURE.md models sketch | Every field of the future models table (brand, brand_slug, model, model_slug, generation, year_from, year_to, body_types[], engine_options[{cc,hp,fuel}], drive_options[], description_ru, price_min/max_rub, source_url, scraped_at). Phase 3 importer = pure JSON→SQL. Cost: scraper has to parse generation pages and engine spec tables. | ✓ |
| Minimal | Just brand/model/year_range/source_url + description_ru. Phase 3 fills the rest via re-fetch or admin. | |
| Hybrid | Scrape brand/model/generation/year_range/body_types/drive_options/description_ru; defer engine_options + price_range to Phase 3. | |

**User's choice:** Full 1:1 with ARCHITECTURE.md models sketch
**Notes:** Recommended. Captured in D-10 with field-by-field schema.

### Image scope per model record?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 hero image per model | One representative image as <brand_slug>-<model_slug>-<generation>-hero.webp. ~Hundreds of MB total. Sufficient for catalog cards and PDF embeds. | ✓ |
| All gallery images per model | Full gallery 5–10 images per model. ~Several GB total; overkill for master-models. | |
| No images in Phase 1 | Skip images entirely; rely on Encar/etc. + admin-curated for visuals. Simplest scraper but Phase 4/7 have no real visuals from drom. | |

**User's choice:** 1 hero image per model
**Notes:** Recommended. Captured in D-11.

---

## Claude's Discretion

User accepted all recommended defaults; explicitly delegated to Claude (per CONTEXT.md `<decisions> §Claude's Discretion`):

- Exact got-scraping config (UA rotation, cookie jar, retry-on-5xx)
- Cheerio selector strategies for drom catalog pages
- sharp WebP encoding precision
- brand-aliases.json location (current decision: at brand level, not per-run)
- CLI ergonomics (single dispatcher vs per-source pnpm scripts)

Operational defaults Claude set without asking (also user-accepted at the wrap-up question):

- CBR FX failure: fail-fast first run, cached fallback with `fx_stale: true` thereafter (D-12)
- Block-detection thresholds: ≥5 thin/empty or captcha-keyword responses → halt + exit 3 (D-13)
- Polite rate limit: 1 req/10s ±20% jitter; honor `Crawl-delay` if larger; p-limit(1) HTTP, p-limit(4) sharp (D-14)
- Resumable cursor: `.cursor.json` written at brand boundaries; deleted on success (D-15)
- Image dimensions: original preserved, WebP quality 80 (D-11)
- Cyrillic↔Latin lookup auto-built as side-effect of main parse (D-16)
- Run report contents (D-17)

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:

- Live Encar / BeForward / Che168 / Autohome scrapers → v1.x
- `data/scraped/` → DB import → Phase 3
- WebP rehost to Yandex Object Storage → Phase 3 importer
- Per-source admin metrics endpoint → Phase 6
- Soft-delete via last_seen_at → Phase 3
- Cron / scheduled invocation → Phase 3+ pg-boss
- Concurrency upgrades (multi-thread + per-IP proxies) → v1.x
- Brand whitelist or top-N smoke pass → considered, not chosen
- CI Cyrillic-fixture test for scraper → Wave 0 if budget allows, else Phase 3
- Brand-aliases admin override UI → Phase 6
