# Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs - Research

**Researched:** 2026-04-28
**Domain:** Web scraping (RU-domestic public catalog) + image processing + CLI tooling on Node 22 + pnpm
**Confidence:** HIGH on stack picks (got/cheerio/sharp/p-limit/iconv-lite verified live), HIGH on drom DOM shape (3 catalog pages probed live), HIGH on CBR XML schema (live parsed), HIGH on D-04 verdict (drom partner API verified to NOT expose catalog data)

---

## Summary

- **D-04 verdict — drom partner API is NOT viable.** `https://baza.drom.ru/help/API` exposes only one endpoint (`/good/packet/api/sync`) — а это XLS/CSV/XML upload-only sync для прайс-листов *партнёров-продавцов*, не выдача каталога. Документация прямо запрещает коммерческое использование без партнёрского статуса. Идём только polite-scrape путём; запасного пути в этой фазе нет.
- **Toolchain pin:** `got@15` + `tough-cookie@6` + `cheerio@1.2` + `p-limit@7` + `sharp@0.34` + `iconv-lite@0.7` + `fast-xml-parser@4.5` + `tsx@4.21` + `vitest@4.1`. **`got-scraping` — EOL** (README прямо помечает deprecated, последний релиз 2026-02-24); `impit-node@0.13` ещё 0.x с Rust-binary deps и без документированного cookie jar — для RU-domestic public сайта чистый `got@15` достаточен и зрелее.
- **Drom DOM shape подтверждена живой проверкой:** brand index, model index и generation pages дают всё нужное — Cyrillic + Latin названия, body type, engine table, drive type, year range, price range, hero image. Generation page (`/catalog/<brand>/<model>/g_<YYYY>_<id>/`) — финальный уровень для одной строки `models.json` (D-10).
- **CBR XML feed подтверждён:** `windows-1251`, `<ValCurs Date="DD.MM.YYYY">`, `<Valute>` с `CharCode` (USD/EUR/JPY/KRW/CNY/AED все есть) и `Nominal`/`Value` (decimal comma!). `VunitRate` уже даёт нормированный курс per-unit — используем его, обходим Nominal-математику.
- **Phase 1 ставит весь Node-side scaffolding с нуля.** В репо сейчас только Vite SPA, npm с `package-lock.json`, 3 рантайм-зависимости. Миграция на pnpm — 1 plan, ~10 минут работы; никаких peer-deps конфликтов на таком тонком дереве не ожидается.

**Primary recommendation:** Сделать Wave 0 «Foundations» (pnpm migration + tsconfig.server.json + IScraper types + CLI dispatcher + shared/* модули с фикстур-тестами) → Wave 1 «Drom end-to-end» (HTTP client → DOM parsers → image pipeline → cursor → report → integration test против sanitized fixture catalog) → Wave 2 «Production run gate» (live drom run, 1–2 недели в фоне, не блокирует следующие фазы).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack & Layout**
- **D-01:** Scraper TypeScript code lives at `server/scrapers/` at repo root. Layout: `server/scrapers/{drom,encar,beforward,che168,autohome}/index.ts` + `server/scrapers/shared/{http,normalize,images,fx,block-detection,types}.ts`.
- **D-02:** Switch to pnpm now. Regenerate lockfile, install pnpm globally if needed.
- **D-03:** Scraping toolchain — lighter stack: `got-scraping` + `cheerio` + `p-limit` + `sharp`. Drom is RU-domestic, public, static HTML — Crawlee/Playwright wasted here. **Researcher note:** `got-scraping` EOL → substitute with plain `got@15` + `tough-cookie@6` (preserves D-03 spirit; see Section 4).

**Drom Access Route & Backfill**
- **D-04:** Researcher spike on drom partner API is the first task. Rule: if API reachable in <1 week and <$100/mo, use it. Otherwise polite scrape. **Researcher verdict — partner API does NOT expose catalog data; polite scrape is the only path (see Section 2).**
- **D-05:** Full catalog backfill from day 1. Realistic budget: 1–2 weeks of polite scraping. Scraper must be resumable + idempotent.

**Output Artifact Contract**
- **D-06:** Output directory `data/scraped/` at repo root. Layout per CONTEXT.md (multi-run dirs + `current/` symlink + `brand-aliases.json` at brand level + `fx/cbr-<YYYY-MM-DD>.json` + `SCHEMA.md` + `README.md`).
- **D-07:** `run_id` = ISO-8601 UTC compact (`2026-04-28T07-30-00Z`) — colons/slashes replaced with hyphens.
- **D-08:** Append per-run dirs; atomic symlink update (`current/`) at run end.
- **D-09:** `ScrapeResult` discriminated union — exit codes `ok→0`, `error→1`, `not_implemented→2`, `blocked→3`.

**JSON Record Schema**
- **D-10:** drom `models.json` records 1:1 with `ARCHITECTURE.md:555` `models` table sketch.
- **D-11:** One hero WebP per record, quality 80, original dimensions; filename `<brand_slug>-<model_slug>-<generation>-hero.webp`. Skip if no usable image (`image_paths: []`).

**Operational Defaults**
- **D-12:** CBR FX fail-fast on first run; cached fallback subsequent (`fx_stale: true` in report).
- **D-13:** Block-detection ≥5 thin (<2 KB) or empty responses, OR captcha keywords (`капча`, `проверка`, `robot`, `verify`).
- **D-14:** 1 req per 10s with ±20% jitter; honor `Crawl-delay` if larger. `p-limit(1)` HTTP, `p-limit(4)` sharp.
- **D-15:** `.cursor.json` brand-boundary checkpoint with `{lastBrandSlug, lastModelSlug, completedAt}`. Successful completion deletes `.cursor.json`.
- **D-16:** Cyrillic↔Latin auto-build side-effect of parse loop; `brand-aliases.json` idempotent merge by `brand_slug`.
- **D-17:** `report.json` field list per CONTEXT.md.

### Claude's Discretion
- Exact `got` config (UA strategy, cookie jar persistence, retry-on-5xx specifics) → **Section 4**.
- Cheerio selector strategies for drom catalog pages → **Section 3**, fixture-driven.
- Sharp WebP encoding precision (8-bit lossy quality 80 confirmed correct default; D-11 holds) → **Section 6**.
- Whether `brand-aliases.json` lives at brand level or inside each run dir → **brand level kept** (CONTEXT decision; planner can split if conflicts).
- CLI ergonomics — single dispatcher vs per-source scripts → **Section 10 recommends single dispatcher with per-source npm-script aliases**.

### Deferred Ideas (OUT OF SCOPE)
- Live Encar/BeForward/Che168/Autohome scrapers (v1.x — stubs only here).
- `data/scraped/` → DB import (Phase 3 `pnpm import:scraped`).
- Image rehost to Yandex Object Storage (Phase 3 importer).
- Per-source admin metrics endpoint (replaced with `report.json`).
- Soft-delete via `last_seen_at` (Phase 3 importer logic).
- Cron / scheduled invocation (Phase 3+).
- Concurrency upgrades / multi-IP scraping (v1.x).
- Brand whitelist / top-N smoke pass (full backfill confirmed).
- CI Cyrillic-fixture test (defer to Phase 3 alongside importer's CI; Phase 1 does *local* fixture tests, see Section 15).
- Brand-aliases conflict resolution UI (Phase 6 admin).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRAPE-05 | drom.ru/catalog scraper populates `models` master DB | Section 2 (route), Section 3 (DOM parse), Section 8 (resumable backfill). All `models` table fields per `ARCHITECTURE.md:555` extractable from drom generation page (Section 3, live verified). |
| SCRAPE-06 | Image rehost (adapted: convert to WebP on disk, not S3) | Section 6 (sharp pipeline, atomic write). Output filename `<brand>-<model>-<generation>-hero.webp` per D-11. |
| SCRAPE-09 | Per-source health (adapted: emit `report.json`, not admin endpoint) | Section 7 (block detection feeds `report.json`); D-17 lists field set; report written at run end (and on `blocked`/`error` exits). |
| SCRAPE-10 | Cyrillic↔Latin lookup | Section 3 (drom exposes both forms — Cyrillic «БМВ X5» + Latin «BMW X5» on same DOM); Section 9 (idempotent merge into `brand-aliases.json`). |
| SCRAPE-11 | CBR FX feed (adapted: JSON cache file, not DB row) | Section 5 (windows-1251 XML, fast-xml-parser, fail-fast/cached fallback per D-12). |
| SCRAPE-01..04 | Encar/BeForward/Che168/Autohome scrapers — STUB ONLY | Section 10 (`IScraper` contract; stub returns `{status:'not_implemented'}` and logs TODO; CLI exit 2). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | How Phase 1 Honors It |
|-----------|--------|------------------------|
| Backend stack: Node 22 LTS | CLAUDE.md «Constraints» | Pin `engines.node: ">=22"` + `packageManager: "pnpm@10.x"` in package.json. |
| Tech stack pin: Crawlee/Playwright 1.59 in CLAUDE.md but D-03 narrows Phase 1 to `got + cheerio + sharp` | CONTEXT.md `<canonical_refs>` line 100 | Phase 1 keeps Crawlee out; Phase 1.x reintroduces it for Encar/Che168/Autohome. CLAUDE.md mention of Crawlee is forward-compatible — same `IScraper` contract works for both toolchains. |
| 152-ФЗ: PII on Russian servers | CLAUDE.md | Phase 1 has zero PII surface (drom catalog is master-models data, not user data) — no compliance impact. |
| Locale: RU only | CLAUDE.md | Output JSON has `description_ru` (Cyrillic editorial blurb); no English path. |
| GSD Workflow Enforcement: planning before edits | CLAUDE.md | This RESEARCH.md → planner → executor; no direct edits. |
| Inventory data sources v1: Encar / BeForward / Che168 + Autohome / drom.ru/catalog (USS = licensed feed, not scraper) | CLAUDE.md | Aligned. Phase 1 ships drom real + 4 stubs; USS not in scope. |
| pnpm convention | CLAUDE.md «Conventions» (implicit, see DISCUSSION-LOG D-02 rationale) | D-02: switch from npm to pnpm now. |
| No Crawlee / Playwright migration in Phase 1 | D-03 (CONTEXT.md) | got-scraping path; Crawlee deferred to v1.x. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP fetching of drom catalog pages | Node CLI process (single thread) | — | Phase 1 is intentionally infra-free; one Node process owns the whole pipeline. |
| HTML parsing (Cheerio) | Node CLI process | — | Static HTML, no headless browser needed (D-03). |
| Image download → WebP encode | Node CLI + libvips (via sharp native) | — | sharp is C++ binary, runs in-process; CPU work parallelized with `p-limit(4)`. |
| FX feed fetch + decode | Node CLI process | Filesystem cache (`data/scraped/fx/cbr-YYYY-MM-DD.json`) | Per-day cache prevents redundant CBR hits; fail-fast on first run, fallback cached. |
| Resume cursor | Filesystem (`data/scraped/drom/<run_id>/.cursor.json`) | — | Crash-tolerance is on disk only; no DB in Phase 1. |
| Brand-alias dictionary | Filesystem (`data/scraped/drom/brand-aliases.json`) | — | Side-effect of parse loop; merged idempotently across runs. |
| Run telemetry | Filesystem (`data/scraped/drom/<run_id>/report.json`) | — | Replaces admin endpoint per phase scope. |
| `IScraper` contract | TypeScript interface in `server/scrapers/shared/types.ts` | CLI dispatcher in `server/scrapers/cli.ts` | Single contract drom and 4 stubs implement; Phase 3+ workers reuse. |
| Phase 3 importer hand-off | Filesystem `data/scraped/drom/current/` symlink | `models.json` schema (`SCHEMA.md`) | Phase 3 reads symlinked dir; never embeds knowledge of `<run_id>` path. |

**Sanity-check:** Phase 1 has *no* HTTP server, *no* DB, *no* browser, *no* worker process. All capabilities run inside one Node CLI invocation. The architectural map exists to confirm that nothing in this phase tries to leak into infra layers reserved for later phases.

---

## Standard Stack

### Core (verified live against npm registry on 2026-04-28)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `got` | **15.0.3** | HTTP client (cookieJar, retry, timeout, hooks) | Sindre Sorhus' got — the standard Node HTTP client; ESM-only; replaces deprecated `got-scraping` for Phase 1's RU-domestic sites where browser-fingerprint emulation is unnecessary. [VERIFIED: `npm view got version`] |
| `tough-cookie` | **6.0.1** | RFC 6265 cookie jar for got | Standard companion to got; keeps drom session cookies alive across the multi-day backfill. [VERIFIED: `npm view tough-cookie version`] |
| `cheerio` | **1.2.0** | Server-side jQuery-like DOM parser | Drom is static HTML — Cheerio is the right tool. [VERIFIED] |
| `p-limit` | **7.3.0** | Concurrency primitive | ESM-only; `pLimit(1)` for HTTP, `pLimit(4)` for sharp encode (D-14). [VERIFIED: `npm view p-limit version`; published 2026-02-03] |
| `sharp` | **0.34.5** | libvips wrapper — JPEG/PNG → WebP, metadata | Battle-tested; preserves dimensions by default; quality 80 default matches D-11. Engine pin: `node ^18.17 \|\| ^20.3 \|\| >=21`. [VERIFIED] |
| `iconv-lite` | **0.7.2** | windows-1251 → utf-8 decoder | Mature pure-JS decoder; CBR XML feed encoding (Section 5). [VERIFIED] |
| `fast-xml-parser` | **4.5.3** | XML → JS object | Pure-JS, zero deps, handles `<ValCurs>` / `<Valute>` shape from CBR XML. [VERIFIED] |
| `zod` | **3.24** *(repo carries `^3` for Vite already)* | Runtime validation of parsed records before write | Forces schema-conformant `models.json` output; catches drom DOM regressions early. Use `^3` to match ecosystem; bumping to v4 has breaking changes — out of scope. [VERIFIED: zod@3.x stable; CONTEXT D-10 schema is the validator target] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tsx` | **4.21.0** | TypeScript runner for CLI (`tsx server/scrapers/cli.ts <source>`) | Direct invocation of TS without a build step; standard for CLI tools in 2026. [VERIFIED] |
| `vitest` | **4.1.5** | Test runner | ESM-native, fast, Vite-aligned (frontend already uses Vite — same toolchain). [VERIFIED] |
| `@types/node` | **25.6.0** | Node type defs | Match Node 22 LTS runtime. [VERIFIED] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `got@15` | `got-scraping@4.2.1` | got-scraping is **explicitly EOL** in its README ("⚠️⚠️⚠️ `got-scraping` is EOL ⚠️⚠️⚠️", verbatim, 2026-02-24 release). For Encar/Che168 (anti-bot heavy) Crawlee+Playwright is the v1.x path; Phase 1 drom is RU-domestic public — no fingerprint emulation needed. [CITED: https://github.com/apify/got-scraping README banner] |
| `got@15` | `impit-node@0.13.1` | impit is the project author's own successor recommendation but is at 0.x, requires Rust binary builds, has thinner Node docs (no documented cookieJar/retry config in current README). Pre-1.0 + RU `npm install` reliability concerns make this premature for Phase 1's 1–2 week production run. Re-evaluate at v1.x. [VERIFIED: `npm view impit-node version` → 0.13.1] |
| `got@15` | `undici@8` (built into Node) | undici is fast and built-in but lacks `got`'s declarative retry/cookieJar/hooks/timeouts API. We'd hand-roll everything — exactly what D-03 ("don't hand-roll") wants to avoid. |
| `vitest` | `node:test` (built-in) | node:test is shipped with Node 22 and viable for unit tests, but vitest's watch mode + snapshot + coverage + clearer matchers cost ~30 MB and pay back many times in fixture-driven scraper development. |
| `fast-xml-parser` | `xml2js` | fast-xml-parser is faster, has zero deps, simpler API. xml2js is older and uses callbacks. Either works for CBR XML; `fast-xml-parser` is the 2026 default. |
| `tough-cookie@6` | `tough-cookie@4` | v6 is the current major (2024+); v5/v6 are RFC 6265bis-aligned and ESM-friendly. [VERIFIED] |

**Installation (Wave 0 — performed once, lockfile committed):**
```bash
# Step 1 — install pnpm if missing (already installed: pnpm 10.29.2 verified)
npm install -g pnpm

# Step 2 — bootstrap from existing repo (npm → pnpm migration; see Section 11)
rm -rf node_modules package-lock.json
pnpm install   # generates pnpm-lock.yaml from existing package.json

# Step 3 — Phase 1 deps
pnpm add got@^15 tough-cookie@^6 cheerio@^1.2 p-limit@^7 sharp@^0.34 \
         iconv-lite@^0.7 fast-xml-parser@^4.5 zod@^3
pnpm add -D tsx@^4.21 vitest@^4.1 @types/node@^25 \
            @types/tough-cookie
```

### Version verification

All versions above were verified live on 2026-04-28 against the npm registry via `npm view <pkg> version`. Document this in commit message of Wave 0's pnpm migration plan. **Re-verify on the day of execution** — Phase 1 may run any time within ~30 days; minor version bumps are fine, major bumps (e.g. zod 3 → 4) require revisiting validators.

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────┐
                         │  pnpm scrape:drom (CLI invocation) │
                         └───────────────┬──────────────────┘
                                         │
                                         ▼
                  ┌─────────────────────────────────────────────────┐
                  │ server/scrapers/cli.ts (dispatcher)             │
                  │ - parse argv → source name                      │
                  │ - call IScraper#run() for chosen source         │
                  │ - map ScrapeResult → exit code (0/1/2/3)        │
                  └───────────────┬──────────────────────┬──────────┘
                                  │                      │
                          source = drom         source = encar/...
                                  │                      │
                                  ▼                      ▼
              ┌─────────────────────────┐   ┌──────────────────────┐
              │ server/scrapers/drom/   │   │ server/scrapers/     │
              │ index.ts                │   │ {encar,beforward,    │
              │                         │   │  che168,autohome}/   │
              │ (real implementation)   │   │ index.ts             │
              │                         │   │ (stub: returns       │
              │                         │   │ not_implemented)     │
              └────────┬────────────────┘   └──────────────────────┘
                       │
        ┌──────────────┼──────────────┬─────────────┬──────────────┐
        ▼              ▼              ▼             ▼              ▼
  ┌──────────┐  ┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐
  │ shared/  │  │ shared/      │ │ shared/  │ │ shared/  │ │ shared/    │
  │ http.ts  │  │ block-       │ │ images.ts│ │ fx.ts    │ │ normalize  │
  │ (got +   │  │ detection.ts │ │ (sharp + │ │ (CBR XML │ │ .ts        │
  │ cookieJar│  │ (≥5 thin/    │ │ atomic   │ │ + iconv- │ │ (slugs,    │
  │ + retry +│  │ captcha →    │ │ write)   │ │ lite +   │ │ Cyr↔Lat,   │
  │ jitter   │  │ exit 3)      │ │          │ │ FXP)     │ │ price/year │
  │ rate-    │  │              │ │          │ │          │ │ parsers)   │
  │ limiter) │  │              │ │          │ │          │ │            │
  └──────────┘  └──────────────┘ └──────────┘ └──────────┘ └────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┬─────────────┐
        ▼              ▼              ▼              ▼             ▼
   data/scraped/   data/scraped/  data/scraped/  data/scraped/  data/scraped/
   drom/<run_id>/  drom/<run_id>/ drom/<run_id>/ drom/<run_id>/ drom/
   models.json     images/        report.json    .cursor.json   brand-
                   *.webp                        (deleted on    aliases.json
                                                  success)      (idempotent
                                                                 merge)

       Phase 3 importer reads:
       data/scraped/drom/current/ ──symlink──▶  data/scraped/drom/<latest_run_id>/
```

### Recommended Project Structure

```
dva.pro/
├── package.json                                   # NEW scripts: scrape, scrape:drom, scrape:<stub>, test
├── pnpm-lock.yaml                                 # NEW (replaces package-lock.json)
├── tsconfig.json                                  # EXISTING (frontend)
├── tsconfig.server.json                           # NEW — Node-side TS config (target ES2023, module NodeNext, strict)
│
├── src/                                           # UNCHANGED (Vite SPA)
│
├── server/                                        # NEW
│   └── scrapers/
│       ├── cli.ts                                 # CLI dispatcher (argv → IScraper#run)
│       ├── shared/
│       │   ├── types.ts                           # IScraper, ScrapeResult, ModelRecord (zod schema)
│       │   ├── http.ts                            # got instance: cookieJar, retry, rate-limit, jitter, UA, block-detect-aware
│       │   ├── normalize.ts                       # slugify, Cyr↔Lat, parsePrice("от 5 470 000"), parseYear("06.2018 - 03.2022")
│       │   ├── images.ts                          # download via http.ts → sharp WebP → atomic write
│       │   ├── fx.ts                              # CBR XML fetch + iconv-lite + fast-xml-parser → JSON cache
│       │   ├── block-detection.ts                 # ≥5 thin/empty or captcha keywords → throw BlockedError
│       │   ├── cursor.ts                          # .cursor.json read/write/delete (atomic via tmp+rename)
│       │   ├── symlink.ts                         # atomic update of `current/` (tmp symlink + rename)
│       │   └── brand-aliases.ts                   # idempotent merge into brand-aliases.json
│       ├── drom/
│       │   ├── index.ts                           # IScraper#run() — orchestrator
│       │   ├── parse-brand-index.ts               # /catalog/ → brand list
│       │   ├── parse-model-list.ts                # /catalog/<brand>/ → model list
│       │   ├── parse-generation-list.ts           # /catalog/<brand>/<model>/ → generation list
│       │   └── parse-generation-page.ts           # /catalog/<brand>/<model>/g_<year>_<id>/ → ModelRecord (one row of models.json)
│       ├── encar/index.ts                         # stub
│       ├── beforward/index.ts                     # stub
│       ├── che168/index.ts                        # stub
│       └── autohome/index.ts                      # stub
│
├── server/tests/                                  # NEW — vitest suite (Section 15)
│   ├── fixtures/
│   │   ├── drom/
│   │   │   ├── brand-index.html                   # sanitized snapshot of /catalog/
│   │   │   ├── model-list.bmw.html                # sanitized /catalog/bmw/
│   │   │   ├── generation-list.bmw.x5.html        # sanitized /catalog/bmw/x5/
│   │   │   ├── generation.bmw.x5.g05.html         # sanitized /catalog/bmw/x5/g_2018_8395/
│   │   │   └── thin-response.html                 # < 2 KB body for block-detect test
│   │   ├── cbr/
│   │   │   ├── XML_daily.windows-1251.xml         # raw bytes (windows-1251)
│   │   │   └── XML_daily.expected.json            # expected normalized output
│   │   └── images/
│   │       └── hero.jpg                           # tiny test JPEG
│   ├── http.test.ts
│   ├── normalize.test.ts
│   ├── images.test.ts
│   ├── fx.test.ts
│   ├── block-detection.test.ts
│   ├── cursor.test.ts
│   ├── symlink.test.ts
│   ├── brand-aliases.test.ts
│   ├── drom-parsers.test.ts                       # 4 unit tests, one per parse-* module
│   └── drom-integration.test.ts                   # end-to-end against fixture catalog (1 brand, 2 models)
│
└── data/                                          # NEW
    └── scraped/
        ├── SCHEMA.md                              # COMMITTED — record contract
        ├── README.md                              # COMMITTED — how to run, where output lands, how Phase 3 consumes
        ├── drom/
        │   ├── brand-aliases.json                 # COMMITTED (small, useful seed)
        │   ├── current/   ──symlink──▶            # IGNORED via .gitignore
        │   └── <run_id>/                          # IGNORED — run artifacts
        │       ├── models.json
        │       ├── images/*.webp
        │       ├── report.json
        │       └── .cursor.json (only if run unfinished)
        └── fx/
            └── cbr-<YYYY-MM-DD>.json              # IGNORED
```

### Pattern 1: IScraper-as-Discriminated-Union-Result

**What:** All scraper modules export a `run()` that returns `Promise<ScrapeResult>` — a discriminated union — and never throw to the CLI; throws are caught at the top and mapped to `status: 'error'`. The CLI maps the union to a process exit code.

**When:** Phase 1 has heterogeneous "real" vs "stub" implementations and a mandatory exit-code contract for CI/automation.

**Example:**
```typescript
// server/scrapers/shared/types.ts
import { z } from 'zod';

export const ModelRecord = z.object({
  brand: z.string(),
  brand_slug: z.string(),
  model: z.string(),
  model_slug: z.string(),
  generation: z.string(),
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),
  body_types: z.array(z.string()),
  engine_options: z.array(z.object({
    cc: z.number().int(),
    hp: z.number().int(),
    fuel: z.enum(['gas', 'diesel', 'hybrid', 'electric']),
  })),
  drive_options: z.array(z.string()),
  description_ru: z.string(),
  price_min_rub: z.number().nullable(),
  price_max_rub: z.number().nullable(),
  image_paths: z.array(z.string()),
  source: z.literal('drom-catalog'),
  source_url: z.string().url(),
  scraped_at: z.string().datetime(),
});
export type ModelRecord = z.infer<typeof ModelRecord>;

export type ReportSummary = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pages_visited: number;
  models_added: number;
  models_updated: number;   // for Phase 1: always 0; placeholder for Phase 3 importer parity
  images_downloaded: number;
  images_skipped: number;
  errors: { url: string; message: string }[];
  rate_limit_hits: number;
  blocked_responses: number;
  fx_stale: boolean;
  cursor_resumed: boolean;
  final_status: 'ok' | 'blocked' | 'error';
};

export type ScrapeResult =
  | { status: 'ok';              source: string; runId: string; recordsWritten: number; durationMs: number; report: ReportSummary }
  | { status: 'not_implemented'; source: string; deferredTo: 'v1.x'; todo: string }
  | { status: 'error';           source: string; runId?: string; error: { message: string; cause?: unknown } }
  | { status: 'blocked';         source: string; runId: string; reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'; sampleUrl?: string };

export interface IScraper {
  readonly source: string;          // 'drom-catalog' | 'encar' | 'beforward' | 'che168' | 'autohome'
  run(opts?: { resume?: boolean }): Promise<ScrapeResult>;
}
```

```typescript
// server/scrapers/encar/index.ts — STUB EXAMPLE
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const encar: IScraper = {
  source: 'encar',
  async run(): Promise<ScrapeResult> {
    console.warn('[encar] TODO: implement Encar scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'encar',
      deferredTo: 'v1.x',
      todo: 'Implement Encar scraper per IScraper contract; uses Crawlee+Playwright Firefox + KR residential proxy + Carapis fallback',
    };
  },
};
```

```typescript
// server/scrapers/cli.ts — DISPATCHER
import { drom } from './drom/index.js';
import { encar } from './encar/index.js';
import { beforward } from './beforward/index.js';
import { che168 } from './che168/index.js';
import { autohome } from './autohome/index.js';
import type { IScraper, ScrapeResult } from './shared/types.js';

const SCRAPERS: Record<string, IScraper> = {
  drom: drom,
  encar: encar,
  beforward: beforward,
  che168: che168,
  autohome: autohome,
};

const EXIT_CODES = { ok: 0, error: 1, not_implemented: 2, blocked: 3 } as const;

const sourceArg = process.argv[2];
if (!sourceArg || !SCRAPERS[sourceArg]) {
  console.error(`Usage: pnpm scrape <${Object.keys(SCRAPERS).join('|')}>`);
  process.exit(1);
}

let result: ScrapeResult;
try {
  result = await SCRAPERS[sourceArg].run({ resume: true });
} catch (e) {
  result = {
    status: 'error',
    source: sourceArg,
    error: { message: e instanceof Error ? e.message : String(e), cause: e },
  };
}
console.log(JSON.stringify(result, null, 2));
process.exit(EXIT_CODES[result.status]);
```

### Pattern 2: Atomic Filesystem Write

**What:** Every artifact write goes via *write-to-tmp + rename*. POSIX rename is atomic on the same filesystem.

**When:** All writes that survive crash mid-write — `models.json`, `.cursor.json`, `report.json`, `current/` symlink, individual WebP files, `cbr-*.json`.

**Example:**
```typescript
// server/scrapers/shared/atomic-write.ts
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function atomicWriteFile(target: string, content: Buffer | string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, target);
}
```

### Pattern 3: One-File-Per-Source

**What:** Each scraper lives in its own directory under `server/scrapers/<source>/`; `shared/*` modules hold reused logic. Stubs are 10-line files that satisfy `IScraper`.

**When:** Always — sources fail differently and evolve at different cadences. Isolation keeps the blast radius small for v1.x fillers.

### Anti-Patterns to Avoid

- **Truncate-and-reload (PITFALLS Pitfall 8a):** Phase 1 runs are append-only — each `<run_id>` is a new directory. Phase 3 importer (separate phase) handles UPSERT semantics; Phase 1 NEVER deletes a previous run.
- **Single global mutable buffer for `models.json`:** stream rows to a tmp file as they're parsed; rename to `models.json` only at end. (Or write a JSON array opening `[`, append objects with comma, close `]` — but a final `JSON.stringify(allRecords, null, 2)` write at end is simpler given expected total <50K rows.) **Decision: collect in memory, single atomic write at end** — total bytes ~50K rows × ~1 KB = ~50 MB, acceptable for one-time backfill on a dev machine.
- **`fetch()` with no timeout:** drom returns 5xx occasionally; without `timeout: { request: 30000 }` the run hangs.
- **Concurrent HTTP without `p-limit(1)`:** would burst drom and trip block-detection.
- **Hot-link source images (PITFALLS Pitfall 10):** explicitly out — Phase 1 downloads + WebP-encodes locally; Phase 3 rehosts to S3.
- **Single-cookie-jar-shared-with-image-fetches:** drom image CDN (`s.auto.drom.ru`) is a different host; cookieJar should still work (it's host-scoped) — no special handling.
- **Skipping JS-rendered pages:** verified via live probe — drom catalog pages do NOT require JS for any of brand list / model list / generation list / generation page. Plain HTTP + Cheerio is sufficient.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP retry / timeout / cookie jar | Manual fetch + setTimeout + Map<string,string> for cookies | `got@15` instance with `retry`, `timeout`, `cookieJar` options | got handles ETIMEDOUT / ECONNRESET / 5xx with exponential backoff; tough-cookie handles RFC 6265 path/domain/expires correctly. |
| windows-1251 → utf-8 decoding | `Buffer.toString('utf-8')` (mojibake) | `iconv-lite.decode(buffer, 'win1251')` | Node's built-in encoder doesn't ship Windows codepages. CBR XML is windows-1251 even in 2026. |
| XML parsing | Regex on `<Valute>` | `fast-xml-parser` | Edge cases: numeric attribute values, comma decimals, whitespace. FXP handles them. |
| WebP encoding | imagemagick CLI shell-out | `sharp` | sharp ships libvips static binary; no system deps; cross-platform; 5–10× faster than ImageMagick. |
| HTML parsing | Regex on `<a href="...">` | `cheerio` | drom's link grouping varies per page; jQuery-style selectors handle it. |
| Concurrency limiting | Counting promises manually | `p-limit` | One line of code; FIFO queueing; cancellable. |
| File atomicity | Direct `writeFile` to target | tmp + `rename()` | rename is atomic on POSIX; protects against crash mid-write. |
| Cyrillic transliteration | Hand-rolled char map | Just **read both forms from drom DOM** (D-16) — drom exposes Cyrillic + Latin side-by-side. No transliteration library needed. | Drom is the canonical source for Russian-market models; both forms are first-class in its DOM. |

**Key insight:** The "don't hand-roll" list is the entire purpose of the lighter stack (D-03). Sharp, got, cheerio, p-limit, iconv-lite, fast-xml-parser collectively replace ~2000 lines of custom code that would otherwise be needed for production-grade scraping.

---

## Code Examples

Verified patterns from official sources and live verification.

### Drom HTTP fetcher (Section 4)
```typescript
// server/scrapers/shared/http.ts
import got from 'got';
import { CookieJar } from 'tough-cookie';
import pLimit from 'p-limit';

const cookieJar = new CookieJar();
const httpLimit = pLimit(1);   // D-14: serial HTTP

const POLITE_BASE_MS = 10_000;          // D-14: 1 req per 10s
const JITTER_RATIO   = 0.20;            // D-14: ±20%

let lastRequestAt = 0;

async function politeDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const jitter = POLITE_BASE_MS * (1 + (Math.random() * 2 - 1) * JITTER_RATIO);
  const wait = Math.max(0, jitter - elapsed);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export const dromClient = got.extend({
  cookieJar,
  timeout: { request: 30_000 },
  retry: {
    limit: 3,
    statusCodes: [408, 429, 500, 502, 503, 504],
    methods: ['GET'],
    calculateDelay: ({ attemptCount }) => Math.min(60_000, 2_000 * 2 ** attemptCount),
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

export async function fetchHtml(url: string): Promise<string> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'text' });
    return response.body;
  });
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'buffer' });
    return response.body as Buffer;
  });
}
```
[ASSUMED — got@15 retry/cookieJar API matches got@13/14] — got@15 README confirmed ESM-only and the `extend()` pattern is unchanged, but the WebFetch could not retrieve verbatim retry config docs from `documentation/7-retry.md`. The `retry` option shape (limit/statusCodes/calculateDelay) has been stable since got@11; verify in Wave 0 by writing a test that asserts retry on a 503 mock. [Verification step: `tests/http.test.ts` mocks 503 response, asserts 3 retry attempts, asserts exponential backoff timing.]

### Drom catalog parsers (Section 3)
```typescript
// server/scrapers/drom/parse-brand-index.ts
import * as cheerio from 'cheerio';

export type BrandRef = { brand_slug: string; latin_name: string; url: string };

const CATALOG_BASE = 'https://www.drom.ru/catalog';

export function parseBrandIndex(html: string): BrandRef[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const brands: BrandRef[] = [];

  // Verified live: brands are <a> tags whose href matches /catalog/<slug>/
  $('a[href^="/catalog/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/^\/catalog\/([a-z0-9_-]+)\/?$/i);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (seen.has(slug)) return;
    if (slug === 'all') return; // skip aggregator links
    seen.add(slug);

    // brand text comes from the link's text content or an <img alt> attribute
    const text = $(el).text().trim() || $(el).find('img').attr('alt') || slug;
    brands.push({
      brand_slug: slug,
      latin_name: text,
      url: `${CATALOG_BASE}/${slug}/`,
    });
  });
  return brands;
}
```

```typescript
// server/scrapers/drom/parse-generation-list.ts
import * as cheerio from 'cheerio';

export type GenerationRef = {
  generation_id: string;       // e.g., 'g_2018_8395'
  generation_label: string;    // e.g., 'G05' or '2018-2023' (derived from card text)
  url: string;
  hero_image_url?: string;
};

export function parseGenerationList(html: string, modelUrl: string): GenerationRef[] {
  const $ = cheerio.load(html);
  const refs: GenerationRef[] = [];
  // Verified live: generation cards are <a href="g_<YYYY>_<id>/">
  $(`a[href*="g_"]`).each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/g_(\d{4,6})_(\d+)\/?$/);
    if (!m) return;
    const generation_id = `g_${m[1]}_${m[2]}`;
    const url = new URL(href, modelUrl).toString();
    const label = $(el).text().trim();
    const hero = $(el).find('img').attr('src');
    refs.push({ generation_id, generation_label: label, url, hero_image_url: hero });
  });
  return refs;
}
```

```typescript
// server/scrapers/drom/parse-generation-page.ts
import * as cheerio from 'cheerio';
import type { ModelRecord } from '../shared/types.js';
import { ModelRecord as ModelRecordSchema } from '../shared/types.js';

export function parseGenerationPage(
  html: string,
  ctx: { brand: string; brand_slug: string; model: string; model_slug: string; generation: string; sourceUrl: string }
): ModelRecord {
  const $ = cheerio.load(html);
  const text = (sel: string) => $(sel).first().text().trim();

  // Verified live (BMW X5 G05 page):
  //   - body type: in spec table row "Тип кузова"  (use a TABLE-row finder)
  //   - engines:   spec table list of B47B20/B57D30/B58B30M0/N63B44 with cc/hp/fuel
  //   - year_from/year_to: heading e.g. "06.2018 - 03.2022"  →  parse "MM.YYYY - MM.YYYY"
  //   - drive: typically "4WD" / "AWD" / "RWD" in spec table
  //   - price min/max: spec table rows "Цена нового авто" + "от X" / "до Y"
  //   - hero img: largest <img src> matching s.auto.drom.ru/...
  //   - description_ru: <p> following <h2> Описание (or first <p> in main column)
  //   - Latin model name: page title or breadcrumb (Cyr+Lat coexist)

  const description_ru = $('h2:contains("Описание")').nextUntil('h2', 'p').first().text().trim()
                       || $('article p').first().text().trim();

  const yearMatch = $('h1').first().text().match(/(\d{2})\.(\d{4})\s*-\s*(\d{2}\.\d{4}|н\.\s*в\.?)/i);
  const year_from = yearMatch ? Number(yearMatch[2]) : null;
  const year_to = yearMatch && yearMatch[3] && !/н\.\s*в/i.test(yearMatch[3])
                ? Number(yearMatch[3].split('.')[1]) : null;

  // ... body_types / engine_options / drive_options / price_min_rub / price_max_rub extraction
  //     follows same find-by-row-label pattern; see fixtures for exact selectors

  const heroImg = $('img[src*="s.auto.drom.ru"]').first().attr('src');

  const record: ModelRecord = {
    brand: ctx.brand,
    brand_slug: ctx.brand_slug,
    model: ctx.model,
    model_slug: ctx.model_slug,
    generation: ctx.generation,
    year_from,
    year_to,
    body_types: [], // populate via table parse — see fixtures
    engine_options: [],
    drive_options: [],
    description_ru,
    price_min_rub: null,
    price_max_rub: null,
    image_paths: heroImg ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
    source: 'drom-catalog',
    source_url: ctx.sourceUrl,
    scraped_at: new Date().toISOString(),
  };
  return ModelRecordSchema.parse(record); // zod validates D-10 contract
}
```

[ASSUMED — exact CSS selector for description and spec table] — Live WebFetch confirmed the *presence* of these fields on `https://www.drom.ru/catalog/bmw/x5/g_2018_8395/`, but the WebFetch tool cannot reliably extract precise CSS selectors. The plan's first sub-task in Wave 1 is **fixture sanitization**: download 4 reference pages (brand index, model list for BMW, generation list for X5, generation page for G05), strip cookies/CSRF/Yandex Metrika, save under `server/tests/fixtures/drom/`, and write the parsers against the actual HTML. The selectors above are illustrative scaffolding.

### CBR FX (Section 5)
```typescript
// server/scrapers/shared/fx.ts
import { dromClient } from './http.js';            // reuse got instance
import * as iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CBR_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CACHE_DIR = 'data/scraped/fx';

export type FxRates = {
  date: string;                                  // ISO YYYY-MM-DD
  rates: { USD: number; EUR: number; JPY: number; KRW: number; CNY: number; AED: number };
  source: 'cbr-live' | 'cbr-cache';
};

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function parseDecimalComma(s: string): number {
  return Number(s.replace(',', '.'));
}

export async function fetchFx(opts: { firstRun: boolean }): Promise<FxRates> {
  const today = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD UTC
  const cachePath = resolve(CACHE_DIR, `cbr-${today}.json`);

  // Same-UTC-day cache hit (any subsequent invocation in same day)
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf-8')) as FxRates;
    return { ...cached, source: 'cbr-cache' };
  } catch { /* not cached today, fetch live */ }

  try {
    const buf = await dromClient.get(CBR_URL, { responseType: 'buffer' }).then(r => r.body as Buffer);
    const xml = iconv.decode(buf, 'win1251');
    const parsed = PARSER.parse(xml);
    const valutes = parsed.ValCurs.Valute as Array<{
      CharCode: string; Nominal: string; Value: string; VunitRate?: string;
    }>;
    const want = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const;
    const rates = {} as FxRates['rates'];
    for (const code of want) {
      const v = valutes.find(x => x.CharCode === code);
      if (!v) throw new Error(`CBR XML missing currency ${code}`);
      // Use VunitRate (per-1-unit RUB rate) when present, else Value/Nominal
      const rub = v.VunitRate
        ? parseDecimalComma(v.VunitRate)
        : parseDecimalComma(v.Value) / Number(v.Nominal);
      rates[code] = rub;
    }
    const result: FxRates = { date: today, rates, source: 'cbr-live' };
    await mkdir(CACHE_DIR, { recursive: true });
    await atomicWriteFile(cachePath, JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    if (opts.firstRun) {
      // D-12: fail-fast on first run — no fallback yet
      throw new Error(`CBR FX fetch failed on first run; cannot proceed: ${e instanceof Error ? e.message : e}`);
    }
    // D-12: subsequent runs — fall back to most recent cached file
    const dir = resolve(CACHE_DIR);
    const files = await readdir(dir).catch(() => []);
    const candidates = files.filter(f => /^cbr-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
    if (candidates.length === 0) throw new Error('CBR live fetch failed and no cache available');
    const latest = JSON.parse(await readFile(resolve(dir, candidates[0]), 'utf-8')) as FxRates;
    return { ...latest, source: 'cbr-cache' };
  }
}
```

### sharp WebP (Section 6)
```typescript
// server/scrapers/shared/images.ts
import sharp from 'sharp';
import pLimit from 'p-limit';
import { fetchBuffer } from './http.js';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sharpLimit = pLimit(4);   // D-14: parallel sharp encoding

export type ImageWriteResult = { path: string; bytes: number; width: number; height: number };

export async function downloadAndConvert(
  imageUrl: string,
  outRelative: string,        // e.g., 'images/bmw-x5-g_2018_8395-hero.webp'
  runDir: string              // e.g., 'data/scraped/drom/2026-04-28T07-30-00Z'
): Promise<ImageWriteResult> {
  return sharpLimit(async () => {
    const buf = await fetchBuffer(imageUrl);
    const pipeline = sharp(buf);
    const meta = await pipeline.metadata();         // {width, height, format}
    const webp = await pipeline.webp({ quality: 80 }).toBuffer();
    const target = resolve(runDir, outRelative);
    await mkdir(dirname(target), { recursive: true });
    await atomicWriteFile(target, webp);
    return { path: outRelative, bytes: webp.length, width: meta.width ?? 0, height: meta.height ?? 0 };
  });
}
```

### Atomic symlink for `current/` (Section 9)
```typescript
// server/scrapers/shared/symlink.ts
import { symlink, rename, lstat, unlink } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';

export async function pointCurrentAt(runDir: string): Promise<void> {
  // runDir = 'data/scraped/drom/2026-04-28T07-30-00Z'
  // target = 'data/scraped/drom/current'
  const linkPath = resolve(dirname(runDir), 'current');
  const tmpLink = `${linkPath}.tmp.${Date.now()}`;
  // Symlink target is RELATIVE (basename of run dir) so the link survives directory moves
  await symlink(basename(runDir), tmpLink, 'dir');
  // rename() atomically replaces existing symlink on POSIX (macOS APFS, Linux ext4)
  await rename(tmpLink, linkPath);
}
```

[VERIFIED: Node.js docs] — `fs.rename()` is atomic on POSIX when same filesystem. macOS APFS and Linux ext4 both qualify. Windows: `rename` over an existing symlink fails — out of scope per CLAUDE.md (team uses macOS+Linux). Document this in `data/scraped/README.md`.

---

## Common Pitfalls

### Pitfall 1: drom DOM regression silently produces empty `models.json`

**What goes wrong:** drom changes a class name or moves the spec table from `<table>` to `<dl>`. Cheerio selectors return `null`. Validation passes (zod allows `body_types: []`). `models.json` has 50K rows but every row has empty arrays — Phase 3 importer happily writes garbage rows.

**Why it happens:** Permissive zod schemas (`array(string).default([])`) hide the failure.

**How to avoid:** **Tighten validators**: every drom record must have `body_types.length >= 1` AND `engine_options.length >= 1` AND non-empty `description_ru`. Records that fail validation increment `report.errors[]` with the URL but don't write to `models.json`. If `>10%` of records fail in a run, exit 1 (treat as DOM regression). [VERIFIED: pattern from PITFALLS Pitfall 8 + zod refinements.]

**Warning signs:** `report.json` shows `models_added: 50000` but the run took 2 hours instead of 1–2 weeks; spot-checking 5 records shows empty `body_types`.

### Pitfall 2: Cyrillic mojibake from encoding misdetect

**What goes wrong:** got returns `responseType: 'text'`; under the hood it sniffs `Content-Type` charset. If drom serves a page declared as `windows-1251` but actually utf-8 (or vice versa), Cheerio loads garbage. Or `description_ru` reads `«Ð'нÐ¾Ð²Ð¾Ðµ Ð¿Ð¾ÐºÐ¾Ð»ÐµÐ½Ð¸Ðµ»` instead of «новое поколение».

**Why it happens:** Encoding sniffing in HTTP libraries is heuristic.

**How to avoid:** **Force `responseType: 'buffer'` and decode explicitly.** Live verification on `https://www.drom.ru/catalog/bmw/x5/g_2018_8395/` showed Cyrillic rendering correctly through WebFetch (which uses utf-8 by default), suggesting drom is utf-8. Confirm by checking the response `Content-Type` charset attr in Wave 0 (write a test that fetches one page and asserts `Content-Type ~= utf-8`). If utf-8: `Buffer.toString('utf-8')` → cheerio.load is safe. If windows-1251: pipe through iconv-lite. [ASSUMED utf-8 — verify in Wave 0 fixture sanitization.]

**Warning signs:** `description_ru` field has Latin-1 high-bytes; sample byte sequence `\xd0\xa1\xd0\xb5\xd0\xb4` (utf-8 bytes for "Сед") appears as Latin chars.

### Pitfall 3: `.cursor.json` resume restarts whole brand instead of mid-brand

**What goes wrong:** D-15 says cursor written at brand boundary, but if a run dies mid-brand-X with model 47/100 done, the cursor is still at brand-(X-1). On resume, brand X starts from scratch — model 1/100. Net result: 47 models re-scraped (~7 hours wasted at 10s/req × ~30 pages/model).

**Why it happens:** Brand-boundary checkpoints are coarser than ideal for crash recovery.

**How to avoid:** **Two-level cursor.** Write cursor at brand boundary (per D-15) AND keep a second in-memory pointer that's flushed every 50 model rows (or 30 minutes, whichever comes first). On resume: read brand-level cursor first, then check if the brand's run dir already contains partial `<brand>-models.partial.json`; if so, skip already-completed models within that brand. **Decision: keep D-15 simple (brand boundary only) for Phase 1.** Worst case: re-scrape one full brand on resume. With ~70 brands and average ~50 models/brand, worst case is ~7 hours wasted. Acceptable given total run is 1–2 weeks. Document this trade-off in `data/scraped/README.md`. (Phase 1.x can add finer-grained cursor if it bites.)

**Warning signs:** Resume immediately re-fetches pages that were fetched yesterday; HTTP cache headers show 304 Not Modified for many requests (drom *might* honor If-Modified-Since — opportunity for Phase 1.x to leverage).

### Pitfall 4: drom hero image URL changes between fetch and write

**What goes wrong:** `parseGenerationPage` extracts `hero_image_url`; 30 minutes later the image fetcher tries to download it; drom CDN serves 404 or a different image (cache-bust path).

**Why it happens:** drom's CDN uses cache-busting query strings (`?816434` seen in live probe — looks like an asset version number).

**How to avoid:** **Fetch image immediately during page parse, not in a deferred batch.** This already follows from `pLimit(1)` HTTP — by the time the next generation page is fetched, the previous page's image is already on disk. Sequential by construction.

### Pitfall 5: WebP encode OOM on giant source images

**What goes wrong:** drom serves a 12 MB JPEG; sharp loads the full bitmap into RAM (~150 MB at 6000×4000 RGB); a node process with default 1.5 GB heap eventually crashes after enough images.

**Why it happens:** sharp does full-resolution decode by default.

**How to avoid:** **Defensive `sharp(buf, { failOnError: true, limitInputPixels: 50_000_000 })`.** 50 megapixels is well above typical car photos; anything over is suspect (and probably not a useful hero). Test with the largest drom hero image observed.

### Pitfall 6: Phase 3 importer breaks because Phase 1 schema drifts

**What goes wrong:** Phase 1 ships v1 of `models.json` schema; Phase 3 begins; someone adds a field to Phase 1's drom parser without updating SCHEMA.md; Phase 3 importer reads stale schema; data drift.

**Why it happens:** Schema lives in two places (zod + SCHEMA.md).

**How to avoid:** **SCHEMA.md is generated from the zod schema** via a `scripts/build-schema-md.ts` invocation in CI/pre-commit. Or manually keep SCHEMA.md as a derived doc with a comment "edit `server/scrapers/shared/types.ts` instead". Phase 1 plan should include this consistency check as a verification step.

### Pitfall 7: Symlink breaks Phase 3 importer that uses `path.realpath`

**What goes wrong:** Phase 3's `pnpm import:scraped` reads `data/scraped/drom/current/models.json`, calls `fs.realpathSync()` for logging, and the path is now `data/scraped/drom/2026-04-28T07-30-00Z/models.json`. Phase 3 importer caches that real path and re-uses it across runs — but the symlink target changed.

**Why it happens:** `realpath` resolves symlinks; if the importer assumes the resolved path is stable, it gets stale.

**How to avoid:** **Phase 3 importer MUST always re-resolve `current/` per invocation** — never cache the realpath. Document this contract in `data/scraped/README.md` Section "How Phase 3 will consume". Phase 1 cannot enforce this technically, only contractually.

---

## Runtime State Inventory

> Phase 1 establishes new infrastructure from scratch — no existing data to migrate. This section is **partial**: only the pnpm migration has any "before state".

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 1 is greenfield (no DB, no cloud, no existing scraper output). | None. |
| Live service config | None — no n8n/Datadog/cron registrations exist for this codebase. | None. |
| OS-registered state | None — no pm2/systemd/launchd/Task Scheduler entries reference `dva.pro` scrapers. | None. |
| Secrets/env vars | **None required for Phase 1** — drom is public, CBR is public, no API keys. Phase 1 explicitly does NOT need `.env`. | Document in `data/scraped/README.md`: "Phase 1 requires zero secrets. If you see env-var prompts, something has gone wrong." |
| Build artifacts / installed packages | `node_modules/` (npm-installed, ~50 MB) + `package-lock.json` (npm format) — both must be deleted before pnpm migration to avoid pnpm warnings. | Wave 0 task: `rm -rf node_modules package-lock.json && pnpm install`. Reinstall is mandatory; no carry-over. |

**The canonical question — *"After every file in the repo is updated, what runtime systems still have the old string cached?"* — answer for Phase 1:** N/A. There are no old strings. This is a greenfield phase.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Everything | ✓ | v25.6.0 (dev machine) | — must be ≥22 LTS in CI/prod (per CLAUDE.md). v25 works for dev but pin `engines.node: ">=22.0.0 <26"` in package.json to declare intent. |
| pnpm | Package manager (D-02) | ✓ | 10.29.2 | — globally installed. `pnpm@10` is current; pin `packageManager: "pnpm@10.29.2"` in package.json so all environments match. |
| Internet egress to `drom.ru` | drom scraper run (Wave 2) | ✓ (assumed in dev) | — | If dev machine cannot reach drom.ru (rare), document VPN requirement in `data/scraped/README.md`. |
| Internet egress to `cbr.ru` | FX feed | ✓ (assumed) | — | Same as above. |
| Disk space | Output artifacts | ✓ | — | Estimate: ~50K models × (~1 KB JSON + ~50 KB WebP) = ~2.5 GB per full run. Multi-run accumulation: pruned manually per D-08. |
| sharp native binary | WebP encoding | (will install) | 0.34.5 | sharp ships pre-built binaries for darwin-arm64 + linux-x64 + linux-arm64 via `optionalDependencies`. pnpm handles per-platform install correctly. **Verify by running `pnpm install` on macOS dev and a Linux CI runner; both should resolve sharp without compilation.** |
| iconv native? | windows-1251 decode | N/A | — | `iconv-lite` is **pure JS**, no native compilation. [VERIFIED: package description] |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

**Phase 1 is unusually clean for environment dependencies — by design (CLI script, no infra).**

---

## Validation Architecture

> nyquist_validation enabled by default — full section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | **vitest 4.1.5** (ESM-native, Vite-aligned, fast watch mode) |
| Config file | `vitest.config.ts` at repo root (Wave 0 deliverable) |
| Quick run command | `pnpm vitest run server/tests/<file>` (per-file, ~1s) |
| Full suite command | `pnpm vitest run` (all tests, expected ~20–30s) |
| Coverage target | Lines 80%+ for `server/scrapers/shared/*` and `server/scrapers/drom/parse-*` (the parse logic must be exhaustively tested against fixtures); lower bar (60%) acceptable for `server/scrapers/cli.ts` (smoke test only). Report via `pnpm vitest run --coverage`. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCRAPE-05 | drom catalog scraper produces `models.json` 1:1 with `ARCHITECTURE.md:555` schema | unit | `pnpm vitest run server/tests/drom-parsers.test.ts` | ❌ Wave 0 — fixture fixtures + parser tests |
| SCRAPE-05 | Full pipeline produces deterministic output against fixture catalog (1 brand 2 models) | integration | `pnpm vitest run server/tests/drom-integration.test.ts` | ❌ Wave 1 |
| SCRAPE-06 | JPEG → WebP round-trip preserves dimensions, file <orig × 1.0 size, valid WebP magic bytes | unit | `pnpm vitest run server/tests/images.test.ts` | ❌ Wave 0 |
| SCRAPE-09 | `report.json` written even on `blocked` exit; contains all D-17 fields | unit | `pnpm vitest run server/tests/drom-parsers.test.ts -t "report.json on blocked"` | ❌ Wave 1 |
| SCRAPE-10 | `brand-aliases.json` idempotent merge — running merge with same input twice produces identical file | unit | `pnpm vitest run server/tests/brand-aliases.test.ts` | ❌ Wave 0 |
| SCRAPE-11 | CBR XML fixture decoded windows-1251 → expected JSON shape (USD/EUR/JPY/KRW/CNY/AED present) | unit | `pnpm vitest run server/tests/fx.test.ts` | ❌ Wave 0 |
| SCRAPE-11 | First-run no-cache → throws; subsequent run cached fallback marks `fx_stale: true` | unit | `pnpm vitest run server/tests/fx.test.ts -t "fail-fast"` | ❌ Wave 0 |
| D-13 | Block-detection: 5 thin responses → throws BlockedError; 4 thin → OK | unit | `pnpm vitest run server/tests/block-detection.test.ts` | ❌ Wave 0 |
| D-13 | Captcha keyword match (`капча`/`проверка`/`robot`/`verify`) → throws BlockedError | unit | `pnpm vitest run server/tests/block-detection.test.ts -t "captcha"` | ❌ Wave 0 |
| D-15 | Cursor: write → read cycle round-trips; SIGKILL mid-run → resume reads last cursor; success deletes cursor | integration | `pnpm vitest run server/tests/cursor.test.ts` | ❌ Wave 0 |
| D-08 | Symlink `current/` atomically updated; readers during update see either old or new run, never partial | integration | `pnpm vitest run server/tests/symlink.test.ts` | ❌ Wave 0 |
| D-09 | Stub `IScraper#run()` returns `{status: 'not_implemented'}`; CLI maps to exit 2 | unit + smoke | `pnpm vitest run server/tests/stubs.test.ts` + `pnpm scrape:encar; echo "exit=$?"` (must print 2) | ❌ Wave 0 |
| D-14 | Polite rate limit: 5 sequential requests space ≥ 8s apart (10s − 20% jitter) | unit (timing) | `pnpm vitest run server/tests/http.test.ts -t "polite delay"` | ❌ Wave 0 |
| **Live drom run** (Wave 2) | Manual: `pnpm scrape:drom` against drom.ru completes within 1–2 weeks, exits 0, populates `current/models.json` | manual | `INTEGRATION=1 pnpm scrape:drom` (gated env var) | ❌ Wave 2 — manual only, NOT in automated CI |

### Sampling Rate

- **Per task commit:** `pnpm vitest run` (full suite, ~30s) — green required for commit.
- **Per wave merge:** `pnpm vitest run --coverage` — coverage report attached to wave merge note.
- **Phase gate:** Full suite green + 1 successful E2E fixture-catalog integration run + `data/scraped/drom/current/models.json` populated by *one* live small-scope drom run (smoke: 1 brand) before invoking `/gsd-verify-work`.

### Wave 0 Gaps

**Test files to create:**
- [ ] `vitest.config.ts` — root config (env: 'node', include `server/tests/**/*.test.ts`)
- [ ] `server/tests/fixtures/drom/brand-index.html` — sanitized snapshot of `https://www.drom.ru/catalog/`
- [ ] `server/tests/fixtures/drom/model-list.bmw.html` — sanitized `/catalog/bmw/`
- [ ] `server/tests/fixtures/drom/generation-list.bmw.x5.html` — sanitized `/catalog/bmw/x5/`
- [ ] `server/tests/fixtures/drom/generation.bmw.x5.g05.html` — sanitized `/catalog/bmw/x5/g_2018_8395/`
- [ ] `server/tests/fixtures/drom/thin-response.html` — synthetic <2 KB body
- [ ] `server/tests/fixtures/drom/captcha-response.html` — synthetic body with «капча»
- [ ] `server/tests/fixtures/cbr/XML_daily.windows-1251.xml` — captured raw bytes from CBR
- [ ] `server/tests/fixtures/cbr/XML_daily.expected.json` — golden output
- [ ] `server/tests/fixtures/images/hero.jpg` — small JPEG (~10 KB)
- [ ] `server/tests/http.test.ts` — got instance + cookieJar + retry + polite delay tests
- [ ] `server/tests/normalize.test.ts` — slugify, parsePrice, parseYear, Cyr↔Lat helpers
- [ ] `server/tests/images.test.ts` — JPEG → WebP round-trip
- [ ] `server/tests/fx.test.ts` — CBR XML decode + cache + fail-fast/fallback paths
- [ ] `server/tests/block-detection.test.ts` — 5-counter + captcha keywords
- [ ] `server/tests/cursor.test.ts` — kill-mid-run resume
- [ ] `server/tests/symlink.test.ts` — atomic update verified
- [ ] `server/tests/brand-aliases.test.ts` — idempotent merge
- [ ] `server/tests/drom-parsers.test.ts` — 4 parsers (brand index, model list, generation list, generation page)
- [ ] `server/tests/drom-integration.test.ts` — Wave 1 deliverable: full pipeline against fixture catalog
- [ ] `server/tests/stubs.test.ts` — 4 stubs return `not_implemented` shape

**Framework install:** `pnpm add -D vitest @types/node` — done in Wave 0 alongside other Phase 1 deps.

**Acceptance evidence shape:** Each task in PLAN.md cites a specific test file path; planner verifies with `test -f <path>` and includes a "Test snapshot" check in the wave merge gate (last 5 lines of `pnpm vitest run` output should show `Test Files  X passed (X)` and zero failures).

---

## Plan Dependency Map

> Feeds the planner's wave structure. Box = single PLAN.md task; arrow = strict ordering.

```
                      Wave 0 — Foundations (parallel-safe internally)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  P-01  pnpm migration + tsconfig.server.json + .gitignore + scripts │
   │  P-02  shared/types.ts (IScraper + ScrapeResult + ModelRecord zod)  │
   │  P-03  shared/atomic-write.ts + tests                               │
   │  P-04  shared/http.ts (got + cookieJar + retry + polite delay)      │ depends on: P-01
   │  P-05  shared/normalize.ts (slugify, parsePrice, parseYear)         │
   │  P-06  shared/images.ts (sharp WebP + atomic write) + tests         │ depends on: P-03, P-04
   │  P-07  shared/fx.ts (CBR XML + iconv + FXP) + tests                 │ depends on: P-04, P-03
   │  P-08  shared/block-detection.ts + tests                            │
   │  P-09  shared/cursor.ts + tests                                     │ depends on: P-03
   │  P-10  shared/symlink.ts + tests                                    │ depends on: P-03
   │  P-11  shared/brand-aliases.ts (idempotent merge) + tests           │ depends on: P-03
   │  P-12  Stubs (encar/beforward/che168/autohome) + tests              │ depends on: P-02
   │  P-13  CLI dispatcher (server/scrapers/cli.ts) + smoke              │ depends on: P-02, P-12
   └─────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                      Wave 1 — Drom End-to-End (sequential within wave)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  P-14  Sanitize fixtures (4 drom pages) — manual content task       │
   │  P-15  drom/parse-brand-index.ts + tests                            │ depends on: P-14, P-02
   │  P-16  drom/parse-model-list.ts + tests                             │ depends on: P-14, P-02
   │  P-17  drom/parse-generation-list.ts + tests                        │ depends on: P-14, P-02
   │  P-18  drom/parse-generation-page.ts + tests (zod-validated)        │ depends on: P-14, P-02, P-05
   │  P-19  drom/index.ts orchestrator (combines parsers + http +        │ depends on: ALL Wave 0 except P-12, plus P-15..18
   │        images + fx + cursor + symlink + brand-aliases + report)    │
   │  P-20  drom-integration.test.ts (1 brand 2 models against fixtures) │ depends on: P-19
   │  P-21  data/scraped/SCHEMA.md + README.md (committed)               │ depends on: P-02, P-19
   └─────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                      Wave 2 — Live Drom Production Run (background, gated)
   ┌─────────────────────────────────────────────────────────────────────┐
   │  P-22  Live smoke run: 1 brand only (e.g., LADA — small + RU)       │ depends on: P-19, P-21
   │        Verify report.json, current/ symlink, no blocks, no errors. │
   │  P-23  Full backfill run (background, 1–2 weeks)                    │ depends on: P-22
   │        Watched but not blocking — Phase 2/3 can begin in parallel. │
   └─────────────────────────────────────────────────────────────────────┘
```

**Wave 0 parallelism:** P-02..P-13 are mostly independent within Wave 0 except for the `depends on` annotations. After P-01 (pnpm + tsconfig) lands, multiple workers can proceed in parallel on the shared modules.

**Wave 1 sequencing:** Parsers (P-15..P-18) depend on fixtures (P-14); orchestrator (P-19) depends on all parsers + Wave 0 modules; integration test (P-20) depends on orchestrator.

**Wave 2 timing:** P-22 (smoke run) is on the critical path of Phase 1 completion. P-23 (full backfill) is *not* on the critical path — Phase 2 (Compliance & Infra) and Phase 3 (Schema + API) can begin while P-23 runs in the background. Phase 3's importer eventually consumes whatever `current/` points at when it executes; if P-23 hasn't finished, Phase 3 imports a partial dataset and re-imports later. This is fine.

---

## Risks

### Risk 1: drom DOM regression mid-backfill

**Probability:** MEDIUM (drom is a 25-year-old site; templates change incrementally).
**Impact:** HIGH (full re-run on stale fixtures wastes 1–2 weeks).
**Mitigation:**
- Strict zod validation per record (Pitfall 1). Rejects > 10% → exit 1.
- Sanitize fixtures from *current* drom HTML in Wave 1; never older than the day before live run starts.
- Run smoke (P-22) on 1 brand before full backfill (P-23) — if smoke fails, fix parsers, fixtures, repeat smoke; only proceed when smoke is green.

### Risk 2: drom rate-limits or temporarily blocks the dev IP

**Probability:** LOW (RU-domestic, 1 req/10s is well within polite norms; PITFALLS Pitfall 3 says "weekly not daily" for drom).
**Impact:** HIGH (blocks Wave 2; need to wait or swap IP).
**Mitigation:**
- Block-detection halts the run cleanly with `report.json status: 'blocked'`.
- If blocked: wait 24 hours, retry from cursor.
- Document that P-22/P-23 should run from a residential IP (founder's home connection) rather than a cloud VM (more likely to be rate-limited).

### Risk 3: pnpm migration breaks existing Vite SPA build

**Probability:** LOW (Vite + React + react-router is one of the most-used pnpm targets).
**Impact:** MEDIUM (blocks all dev until fixed).
**Mitigation:**
- After `pnpm install`, run `pnpm dev` and `pnpm build` — both must succeed before committing the lockfile.
- If a peer-dep warning appears, document and resolve in Wave 0 (most likely a non-issue with only 3 runtime deps).

### Risk 4: sharp native binary fails to install on a teammate's machine

**Probability:** LOW (sharp is one of the most-used native packages; pre-built binaries cover macOS arm64/x64 and Linux x64/arm64).
**Impact:** MEDIUM (teammate cannot run scrapers locally).
**Mitigation:**
- Pin `sharp@0.34.5` exactly in lockfile.
- Document `pnpm install --config.shamefully-hoist=true` as a fallback flag if optionalDependencies fail.
- If a teammate is on Windows ARM64 (rare), document Docker workaround (`docker run --rm -v $(pwd):/work -w /work node:22-alpine ...`).

### Risk 5: windows-1251 in CBR XML breaks decoding on first encounter

**Probability:** LOW (CBR has used windows-1251 stably for 20+ years; iconv-lite handles it daily for thousands of RU projects).
**Impact:** LOW (CBR is small XML — rerun cost is seconds).
**Mitigation:**
- Wave 0 fixture test (`server/tests/fixtures/cbr/XML_daily.windows-1251.xml`) captures actual bytes; test fails if decode produces mojibake.
- Verified live during research: CBR returns `<?xml version="1.0" encoding="windows-1251"?>` and `<Valute>` shape; this is stable.

### Risk 6: CONTEXT D-04 spike conclusion (partner API not viable) is wrong

**Probability:** LOW (verified live: drom partner API endpoint is `/good/packet/api/sync` — XLS/CSV/XML upload, not catalog read; doc explicitly says "не может являться коммерческой деятельностью").
**Impact:** HIGH (would mean we should have used the API path, saving 1–2 weeks of polite scraping).
**Mitigation:**
- Researcher fully ruled out the API path with verbatim doc evidence (Section 2). If founder Денис wants a second confirmation, propose a short email to drom partner support: "Does your partner API expose `/catalog` master-models data, or only listings sync?" Estimated reply latency: 3–5 business days. **Recommendation:** Don't block Wave 2 on this; proceed with polite scrape; if drom replies positively before backfill finishes, plan a Phase 1.x switch.

### Risk 7: Phase 1 runs over schedule and blocks Phase 3

**Probability:** MEDIUM (1–2 weeks of polite scraping + DOM debugging is hard to estimate precisely).
**Impact:** MEDIUM (Phase 3 importer can't be tested end-to-end without drom data).
**Mitigation:**
- Phase 3 schema design does NOT depend on a complete drom run — it depends on the **schema contract** (`SCHEMA.md`), which is a Wave 1 deliverable (P-21). Phase 3 can begin work immediately after P-21.
- Smoke run (P-22) produces a small but valid `models.json` for Phase 3 development tests. Full backfill (P-23) is not on Phase 3's critical path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | got@15 retry option shape (`limit`, `statusCodes`, `calculateDelay`) is unchanged from got@13/14 | Section 4 (`http.ts` example) | LOW — verified by Wave 0 test that mocks 503 and asserts retry. Worst case: rewrite retry config in 1 line. |
| A2 | drom catalog pages are utf-8 (not windows-1251) | Section 3, Pitfall 2 | LOW — verified visually via WebFetch (Cyrillic rendered correctly); confirm in Wave 0 fixture sanitization (assert response Content-Type charset). Worst case: pipe one extra `iconv-lite.decode` call. |
| A3 | drom does NOT JS-render catalog pages — plain HTTP + Cheerio is sufficient | Section 3 | LOW — verified live via WebFetch (which does no JS execution). Worst case: switch drom to PlaywrightCrawler (already a documented Crawlee path; would push drom into the v1.x toolchain). |
| A4 | Generation slug regex `g_(\d{4,6})_(\d+)` covers all drom generation URLs | Section 3 (`parse-generation-list.ts`) | LOW — pattern observed on multiple generation pages (G05: g_2018_8395, F15: g_2013_2087, E53: g_1999_5122, G05-LCI: g_202304_18115). The 6-digit form (202304) suggests YYYYMM. Worst case: regex misses some generations; add to fixtures + relax regex. |
| A5 | drom robots.txt has no `Crawl-delay` for `User-agent: *` (only AhrefsBot has `Crawl-delay: 1`) | Section 4 (D-14 honor `Crawl-delay`) | LOW — verified live. Implementation must still parse robots.txt at run start and respect any future `Crawl-delay` value if drom adds one for `*`. |
| A6 | pnpm migration will not break Vite SPA build | Section 11, Risk 3 | LOW — pnpm 10.x is broadly used with Vite + React; 3-dep tree minimizes peer-dep risk. Verify via `pnpm dev` + `pnpm build` smoke before lockfile commit. |
| A7 | macOS APFS `rename()` over an existing symlink is atomic and replaces the link in-place | Section 9 (`symlink.ts`) | LOW — POSIX semantics; if it fails, `lstat` + `unlink` + `symlink` is the fallback (tiny window where readers see no symlink — acceptable since Phase 3 importer is not concurrent with Phase 1 runs). |
| A8 | CBR XML `<VunitRate>` is present for all currencies (USD/EUR/JPY/KRW/CNY/AED) | Section 5 | LOW — verified live for all 6. Code falls back to `Value/Nominal` math if `VunitRate` is missing for safety. |
| A9 | drom `description_ru` is always non-empty on a generation page | Pitfall 1 (validator) | MEDIUM — observed on BMW X5 G05 but not exhaustively verified. If empty for some generations, the strict validator would skip them. Two options: (a) loosen the validator (allow empty `description_ru`), (b) keep strict and accept some drop-out. **Recommendation: keep strict for Phase 1; revisit after smoke run if >5% drop-out.** |
| A10 | drom hero image URLs are publicly accessible without referer/auth | Section 6 | LOW — drom CDN (`s.auto.drom.ru`) is public asset host; verified live URLs like `https://s.auto.drom.ru/i24222/c/photos/generations/500x_bmw_x5_g8395.jpg` resolve directly. If a future hero needs Referer header, add it to image fetch's per-request headers. |

---

## Open Questions (RESOLVED)

1. **Should `brand-aliases.json` schema include generation-level aliases or only brand+model?**
   - What we know: D-16 spec is `{brand_slug: {ru, latin, models: {model_slug: {ru, latin}}}}`. No generation level.
   - What's unclear: drom generations like «G05» (Latin) and «Г05» (would be the Cyrillic transliteration if anyone uses it — they don't; generation codes are universally Latin).
   - RESOLVED: **Stick with brand+model only.** Generations are universally Latin codes; no Cyrillic counterpart needs aliasing.

2. **What does `report.json` look like for a stub run?**
   - What we know: stubs return `{status: 'not_implemented'}` and exit 2; no `<run_id>` directory is created.
   - What's unclear: should stubs still write a stub `report.json` somewhere (e.g., `data/scraped/encar/last-attempt.json`) for observability?
   - RESOLVED: **No.** Stubs are no-ops; the only artifact is the console.warn TODO line and the exit code. Phase 3+ workers will add their own observability surfaces.

3. **What's the policy for pruning old `<run_id>` dirs?**
   - What we know: D-08 says user prunes manually.
   - What's unclear: should `data/scraped/README.md` recommend a retention (e.g., keep last 3 successful runs)?
   - RESOLVED: **Yes, document a 3-run retention recommendation + add a `pnpm scrape:prune` script in Phase 1.x (not Phase 1 — keep scope tight).** Phase 1 just documents the manual command: `find data/scraped/drom -maxdepth 1 -name "20*Z" -mtime +30 -exec rm -rf {} +`.

4. **Should we capture the raw HTML of every fetched drom page for debugging/replay?**
   - What we know: Phase 1 only writes `models.json` + `images/*.webp` + `report.json`.
   - What's unclear: a "raw HTML cache" (under `<run_id>/raw/<brand>/<model>.html`) would let us re-run parsers without re-fetching, but adds ~5 GB to the run.
   - RESOLVED: **Defer to Phase 1.x.** Adds complexity without a clear Phase 1 use case. If DOM regression Pitfall (Risk 1) bites, we'd want it — but the smoke run in P-22 catches that pre-Wave-2.

5. **Does drom catalog have non-`/catalog/<brand>/<model>/` URL shapes we need to handle?**
   - What we know: WebFetch verified the canonical pattern. drom also has `/catalog/all/`, `/catalog/<brand>/all/`, `/catalog/year_<NNNN>/`, etc.
   - What's unclear: which of these are aggregator pages vs unique brand/model pages.
   - RESOLVED: **Filter strictly to `/^\/catalog\/[a-z0-9_-]+\/$/` for brand index; `/^\/catalog\/[a-z0-9_-]+\/[a-z0-9_-]+\/$/` for model list; `/g_\d{4,6}_\d+\/$/` for generation pages. Skip aggregators (`all`, year-based, etc).** Wave 1 fixture-driven dev catches edge cases.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `got-scraping@4` for browser-like requests | Plain `got@15` for RU-domestic public sites; **`impit-node`** for v1.x anti-bot heavy sites (replacing got-scraping fully) | got-scraping marked EOL in README on or before 2026-02-24 | Phase 1: use plain `got@15` (no browser emulation needed). Phase 1.x for Encar/Che168 evaluates impit OR Crawlee+Playwright; this research punts that decision since stubs only. |
| `axios` + manual cookie handling | `got@15` + `tough-cookie@6` | got@13+ has been the consensus since 2024 | Idiomatic ESM Node HTTP. |
| `xml2js` (callback-based) | `fast-xml-parser@4` (sync, zero-dep) | 2022+ | Simpler API for one-shot CBR XML parse. |
| `iconv` (native binding) | `iconv-lite@0.7` (pure JS) | 2021+ | No native binary required; works on all platforms. |
| ImageMagick CLI for image conversion | `sharp` (libvips wrapper) | 2018+ | 5–10× faster, no system deps, cross-platform. |
| `node:test` only (built-in) for new projects | `vitest@4` for richer DX (watch, snapshots, coverage) | 2023+ | Vitest is now the default for ESM-native projects with Vite alongside. |

**Deprecated/outdated for this phase:**
- `got-scraping` — EOL 2026-02-24; do not use for new code.
- `lucia` — auth library, deprecated Mar 2025; not relevant to Phase 1 (no auth) but called out for awareness.
- `request` / `request-promise` — deprecated since 2020; never use.

---

## Sources

### Primary (HIGH confidence)
- **drom.ru live probes** (verified 2026-04-28 via WebFetch):
  - `https://www.drom.ru/catalog/` — brand index DOM shape
  - `https://www.drom.ru/catalog/bmw/` — model list DOM shape
  - `https://www.drom.ru/catalog/bmw/x5/` — generation list with hero images and price ranges
  - `https://www.drom.ru/catalog/bmw/x5/g_2018_8395/` — generation page with description, body, engine table, drive, year range, price min/max
  - `https://www.drom.ru/robots.txt` — no `Crawl-delay` for `User-agent: *`
  - `https://baza.drom.ru/help/API` — partner API verified to NOT expose catalog data; only XLS/CSV/XML packet sync upload; explicit ToS bar on commercial scraping
- **CBR XML feed live probe** (verified 2026-04-28): `https://www.cbr.ru/scripts/XML_daily.asp` — windows-1251, `<ValCurs Date="DD.MM.YYYY">`, all 6 needed currencies (USD/EUR/JPY/KRW/CNY/AED) present with `VunitRate`
- **npm registry live verification** (verified 2026-04-28): `npm view <pkg> version` for got, tough-cookie, cheerio, p-limit, sharp, iconv-lite, fast-xml-parser, vitest, tsx, @types/node, impit, undici
- **got-scraping README** (verified 2026-04-28): explicit "⚠️⚠️⚠️ `got-scraping` is EOL ⚠️⚠️⚠️" deprecation notice, recommends impit for new projects
- **CONTEXT.md D-01..D-17** (locked decisions, verbatim from `01-CONTEXT.md`)
- **ARCHITECTURE.md:555** (`models` table SQL sketch — schema target for `models.json`)

### Secondary (MEDIUM confidence)
- **PITFALLS.md Pitfall 3, 7, 8, 20** (drom rate-limit posture, idempotent scrape pattern, Cyrillic↔Latin)
- **STACK.md §6** (Crawlee/Playwright/Cheerio tradeoffs — informs why Phase 1 picks lighter stack)
- **WebFetch on `https://github.com/sindresorhus/p-limit`** (p-limit 7.3.0, ESM-only, FIFO behavior assumed standard)
- **WebFetch on `https://sharp.pixelplumbing.com/api-output/`** (`.webp({quality:80})` defaults preserve dimensions)
- **WebFetch on `https://github.com/apify/impit`** (impit 0.13.x — pre-1.0, Rust-binary, thinner docs — informs decision NOT to adopt yet)

### Tertiary (LOW confidence — flagged for Wave 0 verification)
- **got@15 retry config shape** — assumed unchanged from got@13/14 docs; verify via Wave 0 test against mock 503.
- **Specific Cheerio selectors for spec table rows** on drom generation pages — illustrative scaffolding; actual selectors derived in Wave 1 fixture work.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every version verified live against npm registry; deprecation status of got-scraping confirmed via README banner.
- Architecture: **HIGH** — domain is constrained (single CLI, no infra), patterns are standard Node/CLI patterns.
- Drom DOM: **HIGH** — 4 reference pages probed live; partner API verdict has verbatim doc evidence.
- CBR XML: **HIGH** — encoding, schema, and target currencies all confirmed live.
- Pitfalls: **MEDIUM** — informed by PITFALLS.md + research session; one or two (e.g., DOM regression) only emerge during Wave 2.
- Validation architecture: **HIGH** — vitest is well-known; fixture strategy is mechanical.

**Research date:** 2026-04-28
**Valid until:** ~2026-05-28 (30 days). drom DOM is the highest-churn dependency; if execution starts after this date, re-sanitize fixtures from live drom before Wave 1 runs.

---

## RESEARCH COMPLETE
