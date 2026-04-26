# Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers) — Research

**Researched:** 2026-04-27
**Domain:** Multi-source web scraping for vehicle inventory + master-models catalog + image rehosting + FX feed + per-source health metrics
**Confidence:** HIGH on stack/architecture, drom catalog structure, CBR XML feed, Carapis fallback shape, image pipeline. MEDIUM-HIGH on proxy vendor pricing (verified against vendor pages, but country-specific GB rates are not always exposed; treat as best-public-evidence). MEDIUM on Encar/Che168/Autohome anti-bot specifics (no vendor publishes their stack; per-source posture confirmed only at first scrape attempt).

## Summary

Phase 5 splits cleanly into two halves: **shared plumbing (v1-blocking)** and **live scrapers (best-effort, May 31 cutoff)**. The shared plumbing — `shared/normalize.ts`, `shared/images.ts` (sharp → webp → S3 multipart), `shared/http.ts` (got-scraping wrapper + retry policy), `shared/block-detection.ts` (D-13 auto-halt), pg-boss recurring schedules, soft-delete sweep, CBR FX cache, per-source metrics endpoint, drom.ru/catalog populator — is mechanical and low-risk. The live scrapers are dominated by **anti-bot risk on Encar/Che168/Autohome** and by **proxy economics** ($300/mo + 15% premium ceiling for KR + CN combined).

The single most important research finding: **`baza.drom.ru/help/API` is an AUTO-PARTS price-list sync API, NOT a vehicle-catalog API**. D-05's "partner API path" does not exist for vehicle master-models data. The `www.drom.ru/catalog/` HTML *is* the canonical source, it is **server-side rendered** (Cheerio works), and it exposes the Cyrillic↔Latin pair on every brand/model page as "header in Cyrillic + URL slug in Latin" (e.g., header "Лексус", URL `/catalog/lexus/`). This makes SCRAPE-10 (Cyrillic↔Latin lookup auto-build) a deterministic byproduct of the SCRAPE-05 catalog scrape — no separate scraper needed.

The second finding: **drom.ru robots.txt has no Crawl-delay for general user-agents** (only AhrefsBot:1s) and no `/catalog/` Disallow, so polite Cheerio scraping is legal and unblocked. The 1-2 week backfill timeline (D-06) is realistic at 1 req/3-5s for ~30 brands × ~200 models × ~3-5 generations ≈ 20-30K pages.

The third finding: **pg-boss is at v12.18.1** (npm, published 2026-04-26 — yesterday). The Phase 5 plan should target this version, not the v10 referenced in older research artifacts. The `boss.schedule(name, cron, data?, options?)` API is the recommended cron mechanism (not OS cron).

**Primary recommendation:** Build `shared/*` first (Wave 1), then drom.ru/catalog populator (Wave 2) since it's RU-domestic and lowest-risk, then Encar via Crawlee Playwright Firefox + IPRoyal KR residential ($1.75/GB pay-as-you-go, traffic never expires) (Wave 3a). Day-3 checkpoint per D-03/CONTEXT.md §specifics: if Encar produces zero valid UPSERTs after 3 days of effort, flip to Carapis API (sign-up + free tier already documented). BeForward (RU-DC, Cheerio) and CN sources (CN residential) layer on Waves 3b/3c. May 31 hard cutoff defers any unfinished live scraper to v1.x.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cron-triggered scrape execution | Worker (Compute VM) | pg-boss schedule rows in PG | pg-boss `schedule()` table holds the cron → `boss.work()` consumer in worker process executes; never in API process per D-12 + Pitfall 14 |
| Page fetch + JS execution | Worker (Crawlee + Playwright Firefox) | Residential proxy egress | Foreign sites need browser fingerprint + non-RU-DC IP; PlaywrightCrawler isolates browser per run with `browser.close()` per SCRAPE-08 |
| HTML parse + normalize | Worker (Cheerio for static, Playwright `page.evaluate` for hydrated) | — | `shared/normalize.ts` is pure-function, no IO; testable in isolation |
| Image download + webp convert + rehost | Worker (sharp + @aws-sdk/lib-storage) | Yandex Object Storage (`storage.yandexcloud.net`) | sharp transcodes JPEG/PNG→webp in-memory; lib-storage handles multipart upload; D-16 + SCRAPE-07 |
| UPSERT to `cars` / `models` | Worker → Drizzle → managed PG (`ru-central1`) | — | Same DB pool as API; direct repo import; never cross-process HTTP |
| Block detection + auto-halt | Worker (`shared/block-detection.ts`) | settings table row + Unisender Go transactional | D-13 logic counts thin/captcha responses, writes `paused_until`, enqueues founder email job |
| Soft-delete sweep | Worker (separate pg-boss recurring job per source) | — | Pure SQL UPDATE; idempotent; D-15 windows seeded in migration |
| CBR FX feed fetch + cache | Worker (daily recurring job) | `fx_rates` table OR `settings.data.fx` JSON | SCRAPE-11 — fetch once daily 12:00 MSK after CBR publishes; cache-last-known-good on failure |
| Per-source metrics endpoint | API (Hono route) | Reads from `scraper_runs` event log | `GET /api/admin/scrapers/health` — auth-gated (Phase 6) but contract defined here |
| Brand-alias overrides | API (Hono route, Phase 6 UI) | `brand_aliases` table | Auto-built rows seeded from drom; admin overrides win per D-08 |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Proxy + Paid-API Economics:**
- D-01: KR + CN residential proxy ceiling $300/mo combined
- D-02: Single-vendor preferred; +15% premium (~$345/mo) acceptable
- D-03: Carapis = backup-only; auto-flip if Encar blocks progress >3 calendar days
- D-04: BeForward runs from RU datacenter, no JP residential proxy

**drom.ru/catalog Access Route:**
- D-05: Research-first decision — partner API <1wk + <$100/mo → use it; else polite Cheerio scrape (1 req/10-15s + robots.txt)
- D-06: Comprehensive scope — entire drom catalog, all brands, all generations; 1-2 week backfill realistic
- D-07: Post-backfill refresh = monthly full re-scrape (downgrade from SCRAPE-05 "weekly" wording); bumps to weekly if delta queries supported
- D-08: Cyrillic↔Latin brand/model lookup auto-built from drom catalog; admin overrides win

**Ship-Order & v1 Commitment:**
- D-09: Build order locked — `drom → Encar → BeForward → Che168 → Autohome`
- D-10: Ship floor — drom + shared plumbing only; live scrapers best-effort
  - **v1-blocking:** SCRAPE-05, SCRAPE-06, SCRAPE-07, SCRAPE-08, SCRAPE-09, SCRAPE-10, SCRAPE-11
  - **Best-effort:** SCRAPE-01..04
- D-11: May 31 hard cutoff for live scrapers
- D-12: Shared-infra v1 scope — `shared/normalize.ts` + `shared/images.ts` + `shared/http.ts` + image rehost + soft-delete + CBR FX + worker isolation + drom end-to-end + Cyrillic↔Latin lookup + per-source metrics endpoint

**Operational Policy:**
- D-13: Block-detection — ≥5 consecutive thin/captcha responses → `paused_until = now()+24h` + Unisender Go email + `last_run_status='blocked'` + auto-resume after 24h with rotated proxy
- D-14: Auto-publish (no review-queue gate); `needs_review=true` is filter-only
- D-15: Soft-delete window — Encar/Che168/Autohome 72h, BeForward 7d, drom-models ∞ (configurable per-source via Phase 6 UI; defaults seeded in migration)
- D-16: Image rehost format — webp via sharp, original dimensions; layout `images/cars/{source}/{source_id}/{primary|02|...}.webp`

### Claude's Discretion

- Specific residential proxy vendor (within $300 + 15% ceiling)
- drom.ru partner API vs scrape path (within <1wk / <$100/mo rule)
- Worker topology (single worker vs per-source container)
- Cron mechanism (pg-boss recurring vs OS cron)
- BeForward HTML parser shape (Cheerio vs Playwright)
- Per-source cron cadence specifics for live scrapers
- CBR FX fallback behavior when XML unreachable
- Image storage path layout under `images/cars/{source}/{source_id}/`

### Deferred Ideas (OUT OF SCOPE)

- Per-source moderation policy (auto-publish for drom + admin-review for live scrapers)
- Image resize cap (max 1600px width)
- Per-source 5-day budget per scraper
- Founder-curated whitelist for drom (~30-50 brands)
- Admin review queue gate (`needs_review=true` blocks publication)
- JP residential proxy

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRAPE-01 | Encar.com (KR) scraper via Crawlee + KR residential proxy; UPSERT `(source='encar', source_id)` | §"Source Playbook: Encar" + §"Proxy Vendor Decision" + §"Schema Deltas" |
| SCRAPE-02 | BeForward (JP) scraper on schedule (USS = licensed exporter feed, not scraper) | §"Source Playbook: BeForward" — confirmed SSR + no anti-bot, Cheerio sufficient + RU DC OK |
| SCRAPE-03 | Che168 (CN) scraper via CN residential proxy | §"Source Playbook: Che168" + §"Proxy Vendor Decision" |
| SCRAPE-04 | Autohome (CN) scraper via CN residential proxy | §"Source Playbook: Autohome" |
| SCRAPE-05 | drom.ru/catalog populates `models` master DB | §"Source Playbook: drom.ru/catalog" — partner API ruled out; SSR Cheerio scrape on locked URL pattern |
| SCRAPE-06 | Soft-delete via `last_seen_at` per source | §"Soft-Delete Sweep Design" — per-source recurring SQL UPDATE |
| SCRAPE-07 | Image rehost to Yandex Object Storage; no hot-linking | §"Shared Infrastructure: images.ts" — sharp + lib-storage multipart |
| SCRAPE-08 | Worker isolation: `MemoryMax=1G`, fresh browser, explicit `browser.close()` | §"Cron + Worker Topology" — systemd unit per source; Crawlee `keepAlive=false`; one-shot run-and-exit |
| SCRAPE-09 | Per-source `last_success_at`, `last_run_duration`, `cars_added`, `cars_marked_sold` metrics | §"Per-Source Metrics Endpoint" — `scraper_runs` event log + view-derived metrics |
| SCRAPE-10 | Brand/model canonicalised via Cyrillic↔Latin lookup | §"Cyrillic↔Latin Auto-Build" — drom catalog page exposes both forms; auto-populated `brand_aliases` |
| SCRAPE-11 | Source-currency price authoritative; RUB computed on read from CBR daily XML | §"CBR FX Feed Spec" — confirmed XML structure, KRW/JPY/CNY/EUR/USD all present, encoding=windows-1251 |

## Project Constraints (from CLAUDE.md)

- **PII storage:** All personal data of RU citizens stays in `ru-central1` (152-ФЗ). Phase 5 does NOT directly write PII — but image rehost downloads from foreign domains and writes to Yandex Object Storage. Confirm no foreign URL passes through any user-facing API response except the rehosted Yandex Object Storage URL.
- **No foreign edge in front of forms / no Sentry SaaS** — error tracking goes to GlitchTip (self-hosted). Phase 5 worker errors must be reported via `@sentry/node` SDK pointed at the GlitchTip DSN, not Sentry SaaS.
- **Email = Unisender Go.** Block-detection notifications (D-13) must use Unisender Go transactional API, not raw SMTP and not foreign provider.
- **No Yandex Browser–breaking image format** — webp is supported on all targeted Yandex Browser versions per CLAUDE.md. webp is safe.
- **Locked stack:** pg-boss (NOT BullMQ), Crawlee + Playwright 1.59 (Firefox engine recommended for Chromium-detection sites), Drizzle 0.45, `@aws-sdk/client-s3` against `storage.yandexcloud.net`. Hono 4.12 for the metrics endpoint route.
- **Locale:** RU only in v1 — no English locale strings in scraper logs/admin.
- **GSD workflow enforcement:** Plans must use Edit/Write through GSD commands; no direct repo edits outside the workflow.

## Source-by-Source Playbook

### A. drom.ru/catalog (SCRAPE-05, SCRAPE-10) — v1-BLOCKING

**Target URLs:** `https://www.drom.ru/catalog/` (root → list of brands), `https://www.drom.ru/catalog/{brand-latin}/` (brand page → list of models), `https://www.drom.ru/catalog/{brand-latin}/{model-latin}/` (model page → list of generations), `https://www.drom.ru/catalog/{brand-latin}/{model-latin}/g_{year}_{id}/` (generation page → spec ranges, body types, engine options, RU description).

**Parser stack:** **Cheerio + got-scraping** (server-side rendered confirmed via WebFetch). No JS execution needed. **No proxy** — RU-domestic IP from Yandex Compute VM is fine.

**Rate-limit:** **1 request per 5 seconds** with ±2s jitter (well within polite-scrape budget — robots.txt has no Crawl-delay for `User-agent: *`, only `AhrefsBot: 1s`). Respect `Disallow` (none on `/catalog/`). Pagination params allowed for pages 2-10 only — limit to that range.

**Expected fingerprint difficulty:** **LOW** — same-country, public catalog, no anti-bot measures observed in sample fetch.

**Sample selectors (verify on page during impl):**
- Brand name (Cyrillic): `<h1>` on brand page → "Лексус"
- Brand slug (Latin): URL path segment after `/catalog/`
- Model list links: `a[href^="/catalog/{brand}/"]` — link href contains Latin slug, link text contains Cyrillic + Latin (e.g., "Лексус RX350" — model code in Latin)
- Generation cards: `.b-product-block` or similar (verify in impl)
- Spec ranges (engine cc/hp, body type, drive, fuel) on generation page in `<dl>`/`<table>` blocks

**Cyrillic↔Latin pair extraction:** Header `<h1>` of `/catalog/lexus/` → "Лексус". URL slug → "lexus". Pair stored as `brand_aliases (canonical='lexus', cyrillic='Лексус', latin='Lexus', source='drom-auto', is_admin_override=false)`. Same pattern for model — model name in display text uses model code in Latin (RX350) wrapped in Russian text ("Лексус RX350"); rare cases where the model has its own Cyrillic transliteration (e.g., «Лада Веста» — Vesta) are extracted by parsing the `<h1>` of the model page which exposes both forms.

**Mapping to `models` columns:**
| drom field | `models` column |
|------------|----------------|
| brand-latin (URL) | `brand_slug` |
| brand-cyrillic (`<h1>`) | `brand` |
| model-latin (URL) | `model_slug` |
| model-cyrillic+latin (display) | `model` (canonical Cyrillic-preferred, Latin in `brand_aliases`) |
| generation code (URL `g_{year}_{id}`) | `generation` |
| year range from generation page | `year_from`, `year_to` |
| body types list | `body_types[]` |
| engine block (cc, hp, fuel) | `engine_options` JSONB array |
| drive options | `drive_options[]` |
| RU description | `description_ru` |
| min/max price across generation | `price_min_rub`, `price_max_rub` |
| `https://www.drom.ru/catalog/{brand}/{model}/g_{year}_{id}/` | `source_url` |
| `'drom-catalog'` | `source` |

**Scope estimate:** ~30 brands visible on root × ~200 models avg × ~3-5 generations = **20-30K pages**. At 1 req/5s = **28-42h pure scraping** + parse/upsert overhead → realistically **1-2 weeks wall-clock** with retries, idempotent resumability, and the 1 req/5s rate. **Idempotent resumable design**: pg-boss job stores cursor (last completed brand) in job state; worker can be killed/restarted without losing progress. Run in parallel with Encar build (different threads, no proxy contention since drom is RU-domestic) per CONTEXT.md §specifics.

**Refresh cadence:** **Monthly full re-scrape** per D-07 (model facts drift slowly).

[CITED: https://www.drom.ru/catalog/, https://www.drom.ru/robots.txt, https://www.drom.ru/catalog/lexus/]

---

### B. Encar.com (SCRAPE-01) — BEST-EFFORT, MAY 31 CUTOFF

**Target URLs:** `https://www.encar.com/dc/dc_carsearchlist.do?...` (Korean listing pages with query params for car class) — exact filter pattern verified during impl. Detail pages at `/dc/dc_carsearchview.do?carid={source_id}`.

**Parser stack:** **Crawlee `PlaywrightCrawler` with Firefox engine** (the current stable Playwright version is 1.59.1 [VERIFIED: `npm view playwright version` 2026-04-27]). Firefox is preferred over Chromium for Chromium-targeted bot detection per STACK.md research. Crawlee's built-in fingerprint randomization is enabled by default and removes the need for `playwright-stealth`.

**Proxy strategy:** **KR residential rotating proxy.** Datacenter proxies are useless on Encar — site fingerprints non-residential and non-Korean IPs as scraper within first 10-50 requests per PITFALLS.md Pitfall 3. Korean Supreme Court (2022Do1533, May 2022) ruled scraping public data legal — legal risk LOW; technical risk HIGH.

**Rate-limit:** **1 request per 8-15s** randomized with jitter; never burst-parallel; one Playwright browser, one tab, sequential page navigation. ~150 listings per scrape run target (cap to keep proxy GB cost bounded).

**Expected fingerprint difficulty:** **HIGH.** Sources for the 2026 anti-bot landscape on `.kr` automotive sites suggest commercial anti-bot (likely Akamai-class TLS+JA3+behavioral). Naive Playwright is detected; Crawlee's default fingerprint helps but is not a guarantee. [VERIFIED: PITFALLS.md Pitfall 3 + Apify "Scraping Naver and Korean Websites" guide]

**Sample response shape (verify in impl):**
- Listing page returns HTML grid of listing cards; each card has `data-carid` attribute and price/year/mileage cells.
- Detail page returns full spec table with `<dl>` blocks, image gallery in `<ul class="...gallery...">`.

**Mapping to `cars` columns** (based on ARCHITECTURE.md Pattern 3 schema):
| Encar field | `cars` column |
|-------------|---------------|
| `data-carid` | `source_id` |
| `'encar'` | `source` |
| Detail URL | `source_url` |
| 제조사 (manufacturer) | `brand` (canonicalised via lookup) |
| 모델 (model) | `model` (canonicalised) |
| 연식 (year) | `year` |
| `'kr'` | `country` |
| 차종 (body) | `body` |
| 구동 (drive) → 전륜/후륜/4WD/AWD | `drive` |
| 연료 (fuel) → 가솔린/디젤/하이브리드/전기 | `fuel` |
| 변속기 (transmission) | `transmission` |
| 주행거리 (km) | `mileage_km` |
| 가격 (KRW, in 만 units = ×10000) | `price_local`, `price_local_ccy='KRW'` |
| Image gallery URLs | rehosted → `image_key` |

**Day-3 checkpoint (D-03 + CONTEXT.md §specifics):** Plan must include an explicit checkpoint task at +3 calendar days into Encar build effort that asks: "Has Encar produced ≥1 valid UPSERT into `cars`?" If NO → flip to Carapis API path without further founder approval.

**Carapis fallback details:**
- Sign-up at `my.carapis.com` (free tier; "no credit card needed" — confirmed homepage)
- Free trial: ~1,000 requests for testing per generic plan tier docs (3 tiers: Standard 1k req/h, Professional 10k req/h, Enterprise 100k req/h — exact USD pricing not on public docs; planner must capture from sign-up)
- Official Node SDK published: `markolofsen/carapis-encar-npm` GitHub
- API returns Korean + English bilingual fields (e.g., `"2022 현대 투싼 1.6T 프리미엄"` paired with `"2022 Hyundai Tucson 1.6T Premium"`) — useful for Cyrillic↔Latin reconciliation
- Field shape (per docs): `id`, `title`, `price`, `specifications`, `location`, `seller`, `market_data` — aligns with `cars` schema; thin adapter `shared/encar/carapis-adapter.ts` swaps in for the Crawlee scraper at the same `normalize()` boundary
- Update tracking: docs do not explicitly describe delta queries — assume polling with `last_seen_at` soft-delete pattern still applies [ASSUMED]

[CITED: https://docs.carapis.com/parsers/encar.com/intro, https://carapis.com/, .planning/research/PITFALLS.md Pitfall 3]

---

### C. BeForward (SCRAPE-02) — BEST-EFFORT, MAY 31 CUTOFF

**Target URLs:** `https://www.beforward.jp/stocklist/` with filter query params (e.g., `?make=toyota`, pagination `&page=2`). Detail pages at `/{ref-no}/{slug}`.

**Parser stack:** **Cheerio + got-scraping** — confirmed server-side rendered with full listing data (brand/model/year/mileage/price) in initial HTML; pagination links visible as `[1] [2] [3] ... [4000]`; no Cloudflare/reCAPTCHA interstitial detected. **No Playwright needed** — saves ~500MB of browser RAM per worker run.

**Proxy strategy:** **No JP residential proxy** per D-04. Runs from RU datacenter Yandex Compute VM with a polite 1 req/3-5s rate-limit. Confirmed acceptable in research review and CONTEXT.md.

**Rate-limit:** **1 request per 3-5s** with jitter; cap at 200 listings per run.

**Expected fingerprint difficulty:** **LOW.** Public catalog, milder anti-bot, RU DC IP fine.

**Mapping to `cars` columns:**
| BeForward field | `cars` column |
|-----------------|---------------|
| `ref-no` (e.g., `BF12345678`) | `source_id` |
| `'beforward'` | `source` |
| `2018 TOYOTA CAMRY HYBRID G` (parsed: year + brand + model + grade) | `year`, `brand`, `model` |
| Mileage cell (e.g., `101,697 km`) → integer parse | `mileage_km` |
| Price cell (`$10,860` or `¥...`) — BeForward defaults USD; switch to JPY display via locale param | `price_local`, `price_local_ccy='JPY'` (preferred — auction/source true currency) |
| FOB vs CIF — store FOB only (CIF includes shipping which we recompute landed-cost stub from) | `price_local` = FOB |
| Country: `'jp'` | `country` |
| Image gallery URLs | rehosted → `image_key` |

[CITED: https://www.beforward.jp/stocklist/ via WebFetch, .planning/research/STACK.md]

---

### D. Che168.com (SCRAPE-03) — BEST-EFFORT, MAY 31 CUTOFF

**Target URLs:** `https://www.che168.com/china/` city-list, `https://www.che168.com/{city-pinyin}/{filter-codes}/` listing pages. Detail pages at `/dealer/{shop_id}/{car_id}.html` or `/owner/{car_id}.html`.

**Parser stack:** **Crawlee `PlaywrightCrawler` Firefox + CN residential proxy.** PITFALLS.md Pitfall 3 confirms aggressive device fingerprinting (TLS JA3/JA4, header order, Canvas/WebGL) typical of Chinese e-commerce. Datacenter proxies serve cached/stripped HTML — scraper "works" but ingests garbage. Headless browser mandatory.

**Proxy strategy:** **CN residential/mobile proxy** — see §"Proxy Vendor Decision."

**Rate-limit:** **1 request per 10-15s** with jitter (Chinese sites less tolerant); cap at 100 listings per run (lower than Encar to manage proxy GB).

**Expected fingerprint difficulty:** **HIGH** — geo-restricted (will likely 451/redirect from non-CN IPs) AND strong fingerprinting; both must be defeated.

**Mapping to `cars` columns:** Mandarin brand/model strings (e.g., `雷克萨斯 LX 600`) → canonicalise via `brand_aliases` (drom seeds Cyrillic↔Latin; CN→Latin must be added by Phase 6 admin override OR auto-built from a one-time CN→Latin mapping seed list — see §"Cyrillic↔Latin Auto-Build" for handling). Mileage in 公里 (km), price in 万元 (×10000 RMB), `price_local_ccy='CNY'`, `country='cn'`.

[CITED: .planning/research/PITFALLS.md Pitfall 3, Crawlee anti-blocking guide]

---

### E. Autohome.com.cn (SCRAPE-04) — BEST-EFFORT, MAY 31 CUTOFF

**Target URLs:** `https://www.autohome.com.cn/` brand index, `https://car.autohome.com.cn/2sc/{brand_id}/{spec_id}/` used-car listings. Treat as inventory source primarily; richer spec data than Che168 [VERIFIED via STACK.md scraper notes].

**Parser stack:** Same as Che168 — **PlaywrightCrawler Firefox + CN residential proxy.**

**Rate-limit:** **1 request per 10-15s.**

**Mapping to `cars` columns:** Same shape as Che168; `source='autohome'`.

**Cross-source dedup risk:** Autohome and Che168 sometimes list the same physical car — the schema's `(source, source_id)` UNIQUE prevents collision because each source has its own listing ID, but two cars representing the same VIN appear as two `cars` rows. v1 accepts this; v1.x can add VIN-based dedup if VIN parsing succeeds reliably.

[CITED: .planning/research/STACK.md per-source notes, .planning/research/PITFALLS.md Pitfall 3]

---

### F. USS Auctions (JP) — STUB ONLY, NOT BUILT

Per PROJECT.md + PITFALLS.md Pitfall 4: **DO NOT scrape.** USS data path is "licensed exporter feed" (japanesecartrade / providecars / partner CSV) — Phase 5 ships **a documented placeholder in scraper README**: `server/src/workers/scrapers/uss/README.md` containing the explicit boundary statement, the source attribution `'uss'` reserved in the `cars.source` enum, and a stub `normalizeUssCsv()` that operators can wire to a CSV upload endpoint when a partner provides data. **No scraper code, no cron, no proxy line.**

---

### G. Carapis API (Encar fallback) — CONDITIONAL, AUTO-FLIPPED ON D-03 TRIGGER

**Stack:** `@carapis/encar` Node SDK (official Node client published in `markolofsen/carapis-encar-npm` GitHub repo). Replaces Crawlee scraper at the `shared/normalize.ts` boundary — adapter pattern.

**Auth:** API key from `my.carapis.com` sign-up, stored in env var `CARAPIS_API_KEY`, sourced via SOPS-encrypted env. [CITED: https://docs.carapis.com/parsers/encar.com/intro]

**Rate limits:** Standard 1k req/h, Professional 10k req/h, Enterprise 100k req/h. Plan flips to free trial first (1k requests) for verification; founder must approve subscription tier before production traffic. [CITED: https://docs.carapis.com/parsers/encar.com/faq via search results]

**Fields returned:** `id`, `title` (KR + EN bilingual), `price` (KRW with conversion), `specifications`, `location`, `seller`, `market_data`. Maps cleanly onto `cars` schema with thin adapter; bilingual title is an unexpected bonus for Cyrillic↔Latin reconciliation (KR brand → EN brand, no Cyrillic but reduces normalisation risk).

**Sold-listing tracking:** Not explicitly documented as delta query [ASSUMED]. Use the same `last_seen_at` soft-delete pattern — listing not returned in current poll → `last_seen_at` doesn't update → swept after 72h.

**Cost (USD):** Not on public pricing page (per WebFetch on `carapis.com`). Plan must capture during sign-up and surface in Day-3 checkpoint task. Anchor: comparable car-data APIs run $99-$299/mo; if it's <$300/mo it fits within the proxy budget envelope being freed by NOT running KR residential. If >$300/mo, founder approval needed.

## Proxy Vendor Decision Matrix

**Selection criteria (from D-01/D-02):**
- Single-vendor strongly preferred (one bill, one dashboard)
- Combined KR + CN budget ceiling: $300/mo (acceptable up to $345/mo for single-vendor)
- Residential pool required (datacenter proxies useless per PITFALLS.md Pitfall 3)
- KR + CN geo-targeting both available
- Pay-as-you-go preferred (uneven throughput from cron-based scraping)

**Vendor comparison:**

| Vendor | Residential KR+CN | Pricing model | Effective cost @ 30 GB/mo | Strengths | Weaknesses |
|--------|-------------------|---------------|---------------------------|-----------|------------|
| **IPRoyal** ⭐ | ✓ both, included in base price (city-level targeting standard) | $1.75-$7/GB pay-as-you-go; **traffic never expires**; no monthly minimum | **~$210/mo** at $7/GB PAYG (worst case); **as low as ~$53/mo** at $1.75/GB on bulk | No contracts, generous geo, traffic carries over month-to-month → ideal for cron-driven uneven usage | Smaller pool than Bright Data (~32M IPs) but adequate for Encar/Che168 volumes |
| Bright Data | ✓ both (premium KR/CN pools) | $10-$12/GB residential, volume discounts at scale | **~$300-360/mo** | Largest pool, strongest reputation, official "Korean residential" KT/SKT/LG U+ ISP-targeting | At/over our ceiling at typical project volume; KYC onboarding may slow Phase 5 by a week |
| Smartproxy (Decodo) | ✓ both | $3.5/GB pay-as-you-go (rebrand pricing), $8.5/GB on micro plans | **~$105/mo** at PAYG | Better value than Bright Data at our scale | Recent rebrand churn; less battle-tested for `.kr` automotive specifically |
| Oxylabs | ✓ both | $10-$12/GB residential, volume discounts | **~$300-360/mo** | Strong Korean coverage; premium support | Same price-ceiling concern as Bright Data; minimum commits common |
| Soax | ✓ both | $99/mo entry plan + concurrency cap | **~$99-$200/mo** | Cheap entry tier | Concurrency limits unfavorable for cron bursts |

**Recommendation: IPRoyal (PAYG residential) — single vendor.** Reasoning:
- Fits squarely under the $300/mo ceiling at all volume scenarios; even the worst-case $7/GB PAYG rate at 30 GB/mo lands at $210, leaving headroom for Carapis if D-03 triggers.
- "Traffic never expires" is the **critical fit** for our usage pattern: cron-driven, uneven, with Encar Day-3 checkpoint potentially flipping us off-vendor mid-month — paid-but-unused proxy GB doesn't evaporate.
- KR + CN geo-targeting both included in base price — single account, single auth, single dashboard satisfies D-02.
- No monthly minimum → can pause/resume during May 31 cutoff scenarios.

**Runner-up: Smartproxy/Decodo PAYG** at $3.5/GB if IPRoyal sessions prove unstable for Encar/Che168. Switch trigger: ≥3 consecutive D-13 block-detection halts on KR or CN despite proxy rotation in a 7-day window.

**Rejected:**
- Bright Data, Oxylabs — over budget ceiling at expected volume
- Soax — concurrency cap incompatible with cron-burst pattern
- Multi-vendor (KR from one, CN from another) — explicitly forbidden by D-02 unless single-vendor demonstrably fails

**Operational note for proxy session config:**
- Use **sticky sessions** (10-30 min) to keep cookies/captcha solves valid across same scrape run. IPRoyal supports sticky sessions in PAYG tier per docs. [CITED: https://iproyal.com/pricing/residential-proxies/]
- Rotate IP **between** runs (per source) — not within. Rotation happens automatically per session expiry.
- Use Korean Accept-Language `ko-KR` for Encar; Chinese `zh-CN` for Che168/Autohome — per PITFALLS.md Pitfall 3.

[VERIFIED: https://iproyal.com/pricing/residential-proxies/, https://decodo.com/blog/web-scraping-with-cheerio-and-node-js (Smartproxy rebrand), https://use-apify.com/blog/best-residential-proxies-2026]

## Shared Infrastructure Design

### `server/src/workers/scrapers/shared/http.ts`

**Responsibility:** got-scraping wrapper for static-HTML sources (drom, BeForward) with retry, jitter, proxy support, and per-host rate-limit token bucket.

**Key behaviours:**
- Wraps `got-scraping` (bundled in Crawlee) with default 3 retries on 5xx/429 with exponential backoff (1s → 2s → 4s).
- Per-host rate limiter (in-process token bucket, e.g., `bottleneck` or hand-rolled) keyed by hostname — drom 1 req/5s, BeForward 1 req/3-5s.
- Optional proxy URL passed via `HttpsProxyAgent` (only set for KR/CN sources at runtime).
- Sets `Accept-Language` header per source (drom: `ru-RU,ru`, BeForward: `en-US,en;q=0.9,ja;q=0.8`).
- Returns response body + status + headers; throws taxonomy: `ThinResponseError`, `CaptchaDetectedError`, `RateLimitedError`, `NetworkError` — block-detection consumes these.

```typescript
// shared/http.ts (sketch)
export async function fetchHtml(url: string, opts: {
  source: ScraperSource;
  proxyUrl?: string;
  acceptLanguage: string;
  timeoutMs?: number;
}): Promise<{ html: string; status: number; headers: Record<string, string> }> {
  // ... got-scraping wrapper, retry, throws typed errors
}
```

### `server/src/workers/scrapers/shared/normalize.ts`

**Responsibility:** Pure-function transformers from raw scraped objects to `Car` / `Model` shape. One per-source `normalize{Source}` exported, all returning the same `NormalizedCar` Drizzle insert shape.

**Key behaviours:**
- Brand/model canonicalisation via `brand_aliases` lookup (in-memory cache reloaded per scrape run from PG).
- Body type enum mapping (e.g., 세단 → `'sedan'`, SUV → `'suv'`, クーペ → `'coupe'`).
- Mileage to integer km (parse `"101,697 km"` → 101697).
- Price to integer minor units in source currency (e.g., `21400000` JPY = stored `21400000`, NOT 214 ten-thousand units).
- Build `spec_summary` one-liner string for frontend Card UI.
- Build `image_urls[]` list (still source URLs at this stage; rehost happens in `images.ts`).

**Test surface:** Pure-function with fixture inputs (saved JSON of raw page → expected NormalizedCar). No IO.

### `server/src/workers/scrapers/shared/images.ts`

**Responsibility:** Download source image, transcode to webp via sharp, upload to Yandex Object Storage via S3 SDK with multipart, return `image_key`.

**Key dependencies:**
- `sharp@0.34.5` [VERIFIED: `npm view sharp version` 2026-04-27]
- `@aws-sdk/client-s3@3.1037.0` [VERIFIED: `npm view @aws-sdk/client-s3 version` 2026-04-27]
- `@aws-sdk/lib-storage@3.1037.0` (the `Upload` helper handles multipart automatically)

**S3 config for Yandex Object Storage:**
```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const s3 = new S3Client({
  endpoint: 'https://storage.yandexcloud.net',
  region: 'ru-central1',
  credentials: { accessKeyId: env.YC_S3_KEY, secretAccessKey: env.YC_S3_SECRET },
  forcePathStyle: false,
});
```

**Pipeline (per image):**
1. Fetch source URL via `got-scraping` with `responseType: 'buffer'` (timeout 30s).
2. Transcode: `sharp(buf).webp({ quality: 80 }).toBuffer()` — keeps original dimensions per D-16.
3. Compute key: `images/cars/{source}/{source_id}/{primary|02|03|...}.webp`. Index 01 → `primary.webp` (special name for hero image), others numbered.
4. Multipart upload via `Upload({ client: s3, params: { Bucket: 'dvapro-prod', Key: key, Body: webpBuf, ContentType: 'image/webp', CacheControl: 'public, max-age=31536000, immutable' } }).done()`.
5. Return `key` (NOT a URL — public URL is derived in API/PDF layer).

**Failure modes + retry policy:**
| Failure | Retry policy |
|---------|--------------|
| Source 404 | Skip image, log warning, continue (don't fail whole car upsert) |
| Source 5xx / timeout | 3 retries with backoff, then skip |
| sharp transcode error (corrupt source) | Skip image, log error, continue |
| S3 5xx | 5 retries (lib-storage handles), throw if all fail (will fail whole upsert — alert) |
| S3 partial upload | lib-storage cleans up automatically on abort |
| Image already exists at key (idempotent re-run) | `HeadObject` first to short-circuit; if exists with same `Content-Length`, skip upload |

**Deduplication:** Key is deterministic (`{source}/{source_id}/{index}.webp`) — re-running the scraper is a no-op for unchanged cars. `HeadObject` check before upload skips bandwidth.

**Bucket layout (confirms ARCHITECTURE.md storage layout):**
```
s3://dvapro-prod/
  images/
    cars/
      drom/                        # NOT used — drom only writes to models, models has no images in v1
      encar/
        12345678/
          primary.webp
          02.webp
          03.webp
      beforward/
        BF12345678/
          primary.webp
          02.webp
      che168/
        ...
      autohome/
        ...
```

[VERIFIED: `npm view sharp` (0.34.5), `npm view @aws-sdk/client-s3` (3.1037.0), `npm view @aws-sdk/lib-storage` (3.1037.0)]
[CITED: .planning/research/ARCHITECTURE.md Storage Layout]

### `server/src/workers/scrapers/shared/block-detection.ts`

**Responsibility:** Implement D-13 — count thin/captcha responses, halt source on threshold, queue founder email, set `paused_until`.

```typescript
// shared/block-detection.ts (sketch)
type BlockSignal = 'thin_body' | 'captcha_keyword' | 'http_403' | 'http_429';

interface RunCounters {
  source: ScraperSource;
  consecutiveBlocks: number;
  signals: BlockSignal[];
}

export function detectBlock(response: { html: string; status: number }): BlockSignal | null {
  if (response.status === 403) return 'http_403';
  if (response.status === 429) return 'http_429';
  if (response.html.length < 1024) return 'thin_body';
  const captchaRegex = /验证|보안 인증|robot|recaptcha|cf-challenge|please verify|prove you('|')re human/i;
  if (captchaRegex.test(response.html)) return 'captcha_keyword';
  return null;
}

export async function recordBlockResult(...): Promise<void> {
  // increment per-run counter; if ≥5 consecutive → call haltSource()
}

export async function haltSource(source: ScraperSource, reason: string, db: DB, queue: Queue): Promise<void> {
  await db.update(scraperConfig).set({
    paused_until: sql`NOW() + INTERVAL '24 hours'`,
    last_run_status: 'blocked',
    last_block_reason: reason,
  }).where(eq(scraperConfig.source, source));
  await queue.send('email.founder-alert', {
    template: 'scraper-blocked',
    source,
    reason,
    paused_until: '24h from now',
  });
}
```

**Counter scope:** **Per single scrape run (in-memory)** — resets when worker process exits. The count is consecutive (a single non-block response resets it to 0). This matches D-13 wording "≥5 consecutive thin/empty responses."

**Auto-resume:** No active code — when next cron tick fires the scrape job, the job's first action is `SELECT paused_until FROM scraper_config WHERE source = $1` and skips with log line `"source paused until {timestamp}"` if `paused_until > now()`. 24h after the halt, the next tick proceeds; the proxy session is automatically rotated by IPRoyal's session expiry.

**Captcha keyword list (locked v1):**
- Chinese: `验证`, `请稍候`
- Korean: `보안 인증`, `잠시만 기다려 주세요`
- English: `recaptcha`, `cf-challenge`, `prove you('|')re human`, `robot|please verify` (case-insensitive)
- Russian (defensive — drom unlikely): `проверка|капча`

**Email payload to founder (Unisender Go transactional):**
```
Subject: [DVApro] Scraper {source} auto-halted — {reason}
Body: Сборщик {source} автоматически остановлен в {timestamp_msk}. Причина: {reason}.
      Возобновление автоматическое в {paused_until_msk}.
      Метрики: {last_success_at}, {cars_added_in_last_run}.
      Подробнее в /admin/scrapers.
```

[CITED: CONTEXT.md D-13, .planning/research/PITFALLS.md Pitfall 3]

## Cron + Worker Topology

### Cron mechanism: pg-boss recurring schedules (NOT OS cron)

**Why pg-boss schedule, not OS cron:**
- Locked stack (PROJECT.md + STATE.md decisions) commits to pg-boss as the queue.
- Schedule survives worker restarts (lives in PG, not in OS state files).
- Idempotency: only one worker instance picks up the scheduled job per tick (PG row lock).
- Founder dashboard (Phase 6 admin) can read `pgboss.schedule` table to show "next Encar run at HH:MM."

**API:**
```typescript
// pg-boss v12 schedule signature: boss.schedule(name, cron, data?, options?)
await boss.schedule('scrape:drom-catalog', '0 3 1 * *', {}, { tz: 'Europe/Moscow' });
//                                          ^ "at 03:00 on day-of-month 1" = monthly per D-07
await boss.schedule('scrape:encar', '0 */4 * * *', {}, { tz: 'Europe/Moscow' });
//                                  ^ every 4 hours
await boss.schedule('scrape:beforward', '15 */4 * * *', {}, { tz: 'Europe/Moscow' });
//                                       ^ +15min offset to stagger (Pitfall 16)
await boss.schedule('scrape:che168', '30 */4 * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('scrape:autohome', '45 */4 * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('softdelete:sweep', '*/30 * * * *', {}, { tz: 'Europe/Moscow' });
//                                       ^ every 30 min (cheap SQL)
await boss.schedule('fx:cbr-fetch', '0 12 * * *', {}, { tz: 'Europe/Moscow' });
//                                   ^ daily 12:00 MSK (after CBR publishes)

// Worker side
await boss.work('scrape:encar', async (job) => {
  await runEncarScrape({ db, queue, s3 });
});
```

[VERIFIED: pg-boss 12.18.1 published 2026-04-26 via `npm view pg-boss`; cron-schedule API documented in DeepWiki + pg-boss release notes]

### Worker topology recommendation: Single worker process, per-source job names

**Topology pick: ONE long-running worker process** running all `boss.work()` handlers, deployed as a **single systemd unit** on a dedicated Yandex Compute VM (NOT inside the API VM).

**Reasoning:**
- 4-6 week timeline cannot absorb operating multiple worker containers.
- pg-boss already isolates failures per-job (one job crashes → only that job's promise rejects → next tick proceeds).
- Crawlee/Playwright isolation is at the **browser-instance level**, not the **process level** — `await browser.close()` per scrape run + `keepAlive: false` on the crawler accomplishes SCRAPE-08's "fresh browser per run, explicit `browser.close()`."
- systemd `MemoryMax=1G` per SCRAPE-08 — set on the worker unit; if a single Playwright run leaks past 1G, the unit restarts (Restart=on-failure), the in-flight job is requeued by pg-boss with retry attempt 2.
- Stagger cron times (15 min offsets above) prevents simultaneous browser launches.

**Alternative considered: per-source systemd unit** (5 separate worker processes, one per scraper). Rejected because:
- 5× the deploy artifacts, env management, log streams.
- pg-boss can route work by job name to a single process equally well.
- The benefit (blast-radius isolation) is already captured by per-job try/catch + pg-boss retries.

**Worker unit config (systemd):**
```ini
[Service]
ExecStart=/usr/bin/node /app/server/dist/workers/index.js
MemoryMax=1G
Restart=on-failure
RestartSec=5s
TimeoutStopSec=120s    # graceful shutdown for in-flight Playwright
Environment="NODE_ENV=production"
EnvironmentFile=/etc/dvapro/worker.env
```

**Browser isolation contract (SCRAPE-08):**
- Crawlee's `PlaywrightCrawler` constructor: `keepAlive: false` (default; do not override).
- Each `runEncarScrape()` call creates a fresh `PlaywrightCrawler`, runs `await crawler.run(urls)`, then **explicitly** `await crawler.teardown()` in a `finally` block.
- Use `browserPoolOptions: { maxOpenPagesPerBrowser: 1, retireBrowserAfterPageCount: 50 }` to recycle Chrome processes well before they grow unbounded.

**Resource sizing (Yandex Compute VM for worker):**
- 2 vCPU, 4 GB RAM, 30 GB SSD — fits one Playwright Firefox + room for sharp transcode + image upload buffers.
- Separate from API VM (per ARCHITECTURE.md Pattern 1).

[CITED: .planning/research/PITFALLS.md Pitfall 14, .planning/research/ARCHITECTURE.md Pattern 1]

## CBR FX Feed Spec + Caching Policy

**Endpoint:** `https://www.cbr.ru/scripts/XML_daily.asp` (no auth, free, official, RU-resident).

**Optional date param:** `?date_req=DD/MM/YYYY` (e.g., `?date_req=27/04/2026`). Without param → returns latest published rate for last business day. **For v1, omit param** — we always want the most recent CBR rate.

**XML structure (verified):**
```xml
<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="27.04.2026" name="Foreign Currency Market">
  <Valute ID="R01010">
    <NumCode>036</NumCode>
    <CharCode>AUD</CharCode>
    <Nominal>1</Nominal>
    <Name>Австралийский доллар</Name>
    <Value>59,8261</Value>
    <VunitRate>59.8261</VunitRate>
  </Valute>
  <!-- ... ~50 currencies including KRW, JPY, CNY, USD, EUR ... -->
</ValCurs>
```

**Critical encoding note:** **Windows-1251** (Cyrillic), NOT UTF-8. Must decode via `iconv-lite@0.7.2` [VERIFIED: `npm view iconv-lite version`] before XML parsing.

**Currency presence (verified):**
- KRW: `<CharCode>KRW</CharCode>`, `<Nominal>1000</Nominal>` → divide value by 1000 to get RUB-per-1-KRW
- JPY: `<CharCode>JPY</CharCode>`, `<Nominal>100</Nominal>` → divide value by 100
- CNY: `<CharCode>CNY</CharCode>`, `<Nominal>1</Nominal>`
- USD: `<CharCode>USD</CharCode>`, `<Nominal>1</Nominal>`
- EUR: `<CharCode>EUR</CharCode>`, `<Nominal>1</Nominal>`

**Implementation sketch:**
```typescript
import iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';     // 5.7.2 [VERIFIED: npm view]

export async function fetchCbrRates(): Promise<FxSnapshot> {
  const buf = await fetchHtml('https://www.cbr.ru/scripts/XML_daily.asp', { ... });
  const decoded = iconv.decode(Buffer.from(buf), 'win1251');
  const xml = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false }).parse(decoded);
  const date = xml.ValCurs['@_Date'];                   // "27.04.2026"
  const valutes = xml.ValCurs.Valute as Array<{ CharCode: string; Nominal: string; Value: string }>;
  const rates = Object.fromEntries(
    valutes
      .filter(v => ['KRW', 'JPY', 'CNY', 'USD', 'EUR'].includes(v.CharCode))
      .map(v => [v.CharCode, Number(v.Value.replace(',', '.')) / Number(v.Nominal)])
  );
  return { date, rates };  // { date: '27.04.2026', rates: { KRW: 0.0612, JPY: 0.6234, ... } }
}
```

**Caching policy (recommended for D's "Claude's Discretion" section):**
- Daily fetch at 12:00 MSK (CBR publishes for the next day around 11:30 MSK; 12:00 leaves margin).
- **Cache-on-success**, **fallback-on-fail**: store latest snapshot in `fx_rates` table (one row per fetch); reads always pick `ORDER BY fetched_at DESC LIMIT 1`. If today's fetch fails, yesterday's row still serves.
- **Hard staleness alert**: if latest row is >48h old, queue founder email "FX feed stale" via Unisender Go.
- `price_rub_est` is **computed on read** (per SCRAPE-11), NOT stored on the `cars` row — the read query joins or lookups the latest `fx_rates` row at query time.

**Schema delta:**
```sql
CREATE TABLE fx_rates (
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cbr_date   DATE NOT NULL,
  rates      JSONB NOT NULL,       -- { KRW: 0.0612, JPY: 0.6234, ... }
  PRIMARY KEY (fetched_at)
);
CREATE INDEX fx_rates_date_idx ON fx_rates (cbr_date DESC);
```

[CITED: https://www.cbr.ru/scripts/XML_daily.asp via WebFetch, https://www.cbr.ru/development/sxml/]

## Schema Deltas vs Phase 2

Phase 2 ships `cars` and `models` per ARCHITECTURE.md sketch. Phase 5 adds the following **new tables** + extends existing schema. **All deltas baked into Phase 5 migrations** (drizzle-kit generated).

### New table: `scraper_config` (per-source operational state)
```sql
CREATE TABLE scraper_config (
  source              TEXT PRIMARY KEY,    -- 'drom-catalog' | 'encar' | 'beforward' | 'che168' | 'autohome'
  enabled             BOOLEAN NOT NULL DEFAULT true,
  paused_until        TIMESTAMPTZ,         -- D-13 auto-halt; NULL = active
  last_block_reason   TEXT,                -- 'thin_body' | 'captcha_keyword' | 'http_403' | ...
  soft_delete_hours   INT NOT NULL,        -- D-15 — seeded: encar/che168/autohome=72, beforward=168, drom=NULL
  cron_expression     TEXT NOT NULL,       -- 'every 4h staggered'
  proxy_pool_label    TEXT,                -- 'iproyal-kr-residential' | 'iproyal-cn-residential' | NULL
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Migration seeds (D-15 defaults):**
```sql
INSERT INTO scraper_config (source, soft_delete_hours, cron_expression, proxy_pool_label) VALUES
  ('drom-catalog', NULL,  '0 3 1 * *',     NULL),
  ('encar',        72,    '0 */4 * * *',   'iproyal-kr-residential'),
  ('beforward',    168,   '15 */4 * * *',  NULL),
  ('che168',       72,    '30 */4 * * *',  'iproyal-cn-residential'),
  ('autohome',     72,    '45 */4 * * *',  'iproyal-cn-residential');
```

### New table: `scraper_runs` (event log, source for SCRAPE-09 metrics)
```sql
CREATE TABLE scraper_runs (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ,
  duration_ms     INT,
  status          TEXT NOT NULL,    -- 'running' | 'success' | 'partial' | 'failed' | 'blocked'
  pages_fetched   INT NOT NULL DEFAULT 0,
  cars_seen       INT NOT NULL DEFAULT 0,
  cars_added      INT NOT NULL DEFAULT 0,
  cars_updated    INT NOT NULL DEFAULT 0,
  cars_marked_sold INT NOT NULL DEFAULT 0,
  images_rehosted INT NOT NULL DEFAULT 0,
  error_message   TEXT,
  block_signal    TEXT
);
CREATE INDEX scraper_runs_source_started_idx ON scraper_runs (source, started_at DESC);
```

### New table: `brand_aliases` (Cyrillic↔Latin lookup, SCRAPE-10)
```sql
CREATE TABLE brand_aliases (
  id              BIGSERIAL PRIMARY KEY,
  canonical_slug  TEXT NOT NULL,         -- 'lexus' (always lowercase Latin)
  cyrillic_form   TEXT,                  -- 'Лексус' | NULL
  latin_form      TEXT NOT NULL,         -- 'Lexus'
  alt_form        TEXT,                  -- alternate (e.g., '雷克萨斯')
  source_kind     TEXT NOT NULL,         -- 'brand' | 'model'
  parent_brand_slug TEXT,                -- for models: 'lexus'; for brands: NULL
  source          TEXT NOT NULL,         -- 'drom-auto' | 'admin' | 'encar-bilingual' | ...
  is_admin_override BOOLEAN NOT NULL DEFAULT FALSE,  -- D-08 — admin overrides win
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_kind, canonical_slug, parent_brand_slug)
);
```

### New table: `fx_rates` (CBR daily snapshot)
See §"CBR FX Feed Spec" above.

### Extension to existing `cars` (Phase 2 schema):
- No new columns required if Phase 2 already shipped the columns listed in ARCHITECTURE.md `cars` schema. Verify these exist:
  - `(source, source_id)` UNIQUE ✓
  - `is_active`, `is_admin_curated`, `needs_review` ✓
  - `first_seen_at`, `last_seen_at` ✓
  - `image_key`, `price_local`, `price_local_ccy` ✓
  - `model_id` FK to `models` (nullable) ✓

**`price_rub_est` column choice:** ARCHITECTURE.md schema sketch has `price_rub_est BIGINT` on `cars`. **Phase 5 recommendation: leave it nullable and unused; compute RUB on read** per SCRAPE-11. If Phase 2 already shipped it as required-non-null, Phase 5 fills it at scrape time using the day's CBR rate AND the read-side query also recomputes (the stored value becomes a fallback). Planner picks; the fully-correct path is read-time compute.

### Extension to existing `models`:
- No new columns. Phase 5 fills the existing columns via the drom catalog scraper.

## Soft-Delete Sweep Design (SCRAPE-06)

**Mechanism:** A pg-boss recurring job `softdelete:sweep` runs **every 30 minutes** (cheap, idempotent). For each source in `scraper_config WHERE soft_delete_hours IS NOT NULL`, executes:

```sql
UPDATE cars
SET is_active = FALSE,
    updated_at = NOW()
WHERE source = $1
  AND is_active = TRUE
  AND is_admin_curated = FALSE   -- D-15 implicit; admin-curated cars are protected
  AND last_seen_at < NOW() - (soft_delete_hours * INTERVAL '1 hour')
RETURNING id;
```

**Why every 30 min, not on each scrape:**
- Decoupling — soft-delete logic doesn't depend on scrape success (a blocked source still has its inventory aged out correctly).
- Per-source `last_seen_at` semantics — only cars NOT touched in this scrape's UPSERT will fail the `last_seen_at` predicate; freshly UPSERTed rows have `last_seen_at = NOW()`.
- Idempotent — running the sweep N times in a row is the same as running it once.

**`scraper_runs.cars_marked_sold` metric:** Each sweep run records the count of `RETURNING id` rows per source into a `scraper_runs` row with `status='success'`, `source='softdelete-sweep'`, and per-source breakdown in a JSONB column (or one `scraper_runs` row per source-sweep). For the metrics endpoint shape, recommend collapsing into per-source counters.

**Admin override:** `is_admin_curated = TRUE` cars are never auto-deactivated. ARCHITECTURE.md Pattern 3 already encodes this; verify the WHERE clause includes the predicate.

**Reactivation:** When a previously soft-deleted car reappears in a scrape (the source listing returns), the UPSERT updates `is_active = TRUE` and `last_seen_at = NOW()`. This is a normal UPSERT outcome, no special handling needed.

[CITED: .planning/research/PITFALLS.md Pitfall 8, .planning/research/ARCHITECTURE.md Pattern 3]

## Per-Source Metrics Endpoint Contract (SCRAPE-09)

**Endpoint:** `GET /api/admin/scrapers/health` — auth-gated by Phase 6 RBAC; Phase 5 ships the route + handler with auth stub returning 401 until Phase 6 adds the middleware.

**JSON contract:**
```json
{
  "as_of": "2026-04-27T15:00:00.000Z",
  "sources": [
    {
      "source": "encar",
      "enabled": true,
      "paused_until": null,
      "last_run_status": "success",
      "last_run_started_at": "2026-04-27T14:00:00.000Z",
      "last_run_finished_at": "2026-04-27T14:08:23.123Z",
      "last_run_duration_ms": 503123,
      "last_success_at": "2026-04-27T14:00:00.000Z",
      "cars_added_last_run": 3,
      "cars_updated_last_run": 47,
      "cars_marked_sold_last_24h": 12,
      "block_signal": null,
      "soft_delete_hours": 72,
      "proxy_pool_label": "iproyal-kr-residential",
      "next_run_at": "2026-04-27T18:00:00.000Z"
    },
    {
      "source": "drom-catalog",
      "enabled": true,
      "paused_until": null,
      "last_run_status": "success",
      ...
    }
  ]
}
```

**Implementation: derived from `scraper_runs` event log, not a snapshot table.** Reasoning:
- Single source of truth (no risk of snapshot drift).
- Cheap query — index on `(source, started_at DESC)` covers the hot path (`SELECT ... ORDER BY started_at DESC LIMIT 1` per source).
- Historical metrics (last week's run rate, p95 duration) are a free byproduct.

**SQL (sketch):**
```sql
WITH latest_run AS (
  SELECT DISTINCT ON (source) source, status, started_at, finished_at,
         duration_ms, cars_added, cars_updated, block_signal
  FROM scraper_runs
  ORDER BY source, started_at DESC
),
last_success AS (
  SELECT DISTINCT ON (source) source, started_at AS last_success_at
  FROM scraper_runs WHERE status = 'success'
  ORDER BY source, started_at DESC
),
sold_24h AS (
  SELECT source, SUM(cars_marked_sold) AS cars_marked_sold_last_24h
  FROM scraper_runs
  WHERE started_at > NOW() - INTERVAL '24 hours'
  GROUP BY source
)
SELECT sc.*, lr.*, ls.last_success_at, COALESCE(s24.cars_marked_sold_last_24h, 0) AS cars_marked_sold_last_24h
FROM scraper_config sc
LEFT JOIN latest_run lr ON sc.source = lr.source
LEFT JOIN last_success ls ON sc.source = ls.source
LEFT JOIN sold_24h s24 ON sc.source = s24.source;
```

**`next_run_at` field:** Read from pg-boss schedule table (`pgboss.schedule.next_run_at` or computed from cron expression — pg-boss exposes this).

[CITED: CONTEXT.md §code_context "To Phase 6"]

## Block-Detection Implementation Spec (D-13)

See `shared/block-detection.ts` sketch above. Specifics for executor:

**Thin response definition:**
- HTTP body length **<1024 bytes** on a page that is expected to be ≥10KB (listing pages).
- For Playwright runs, `page.content().then(html => html.length < 1024)` after `domcontentloaded`.

**Captcha keyword regex (locked v1):**
```typescript
const CAPTCHA_PATTERNS = /验证|请稍候|보안 인증|잠시만 기다려 주세요|recaptcha|cf-challenge|prove you('|')re human|robot.{0,10}check|please verify/i;
```

**Counter scope:** Per single scrape run, in-memory `consecutiveBlocks` integer. A single non-block response resets to 0. Threshold: **5**.

**Halt action:**
1. `UPDATE scraper_config SET paused_until = NOW() + INTERVAL '24 hours', last_run_status = 'blocked', last_block_reason = '{signal}' WHERE source = '{source}'`
2. `INSERT INTO scraper_runs (source, status, block_signal, started_at, finished_at) VALUES (...)` — close out the run with `status='blocked'`
3. `boss.send('email.founder-alert', { template: 'scraper-blocked', source, reason, paused_until })` — separate pg-boss job to send via Unisender Go (decouples from scrape worker; survives if email provider blips)
4. `return` from scrape function — do NOT continue requests during the cooldown.

**Auto-resume:** Next cron tick (4h later for Encar) checks `paused_until > NOW()` first thing; if still paused, log and return. Once 24h passes, scrape proceeds with rotated IPRoyal session (rotation is automatic per session expiry).

[CITED: CONTEXT.md D-13]

## Cyrillic↔Latin Auto-Build Strategy (SCRAPE-10)

**Sources of pairs:**

| Pair source | When extracted | Coverage |
|-------------|---------------|----------|
| **drom catalog brand pages** | During SCRAPE-05 monthly run | All brands+models drom carries (~30 brands, ~5K models) — covers RU+global mainstream |
| **Encar bilingual titles** (KR + EN — Carapis only) | At Encar scrape time IF Carapis path active | KR brand+model in Latin only (no Cyrillic from Encar) — used to enrich Latin form, not Cyrillic |
| **Manual admin override** (Phase 6 UI) | On-demand | Edge cases (e.g., Genesis Cyrillic = Дженезис, missed by drom) |

**Algorithm (drom-driven primary path):**

1. drom catalog scraper visits `/catalog/lexus/`. Header: "Лексус". URL: `/catalog/lexus/`.
2. Extract pair: `(canonical='lexus', cyrillic='Лексус', latin='Lexus', source_kind='brand', source='drom-auto')`.
3. UPSERT into `brand_aliases` with `ON CONFLICT (source_kind, canonical_slug, parent_brand_slug) DO UPDATE SET cyrillic_form = EXCLUDED.cyrillic_form, latin_form = EXCLUDED.latin_form, updated_at = NOW() WHERE NOT brand_aliases.is_admin_override` (admin-overridden rows are protected — D-08).
4. For each model link on the brand page, extract pair: `(canonical='lx', cyrillic='Лексус LX' or 'LX' depending on display text, latin='LX', source_kind='model', parent_brand_slug='lexus')`. Note: drom display often shows model number-only Cyrillic-side (e.g., "Лексус LX 600" — only "Лексус" is true Cyrillic; "LX 600" remains Latin). Treat that as no Cyrillic form (NULL) — model code is universal.
5. Store the (canonical_slug, cyrillic_form, latin_form) tuple. Reads use this table to canonicalise foreign-source brand strings.

**Used at scrape time:**
- Encar normalize: incoming `현대` → look up `brand_aliases WHERE alt_form = '현대' OR latin_form = 'Hyundai'` → canonical `'hyundai'` → set `cars.brand = 'Hyundai'` (or Cyrillic preferred display per UI choice).
- Che168/Autohome normalize: `雷克萨斯` → `brand_aliases WHERE alt_form = '雷克萨斯'` → canonical `'lexus'` → set `cars.brand = 'Лексус'` (preferred Cyrillic for RU UI).
- Unmatched brand on first sight → write a row with `latin_form` only, `cyrillic_form = NULL`, `source = 'encar-bilingual'` (or per source). Phase 6 admin can override later.

**Admin override precedence (D-08 enforcement):**
```sql
-- pseudo: when drom auto-build wants to update a row
UPDATE brand_aliases
SET cyrillic_form = $1, latin_form = $2, updated_at = NOW()
WHERE source_kind = $3 AND canonical_slug = $4 AND parent_brand_slug = $5
  AND is_admin_override = FALSE;     -- KEY: admin rows untouched
```

**CN→Latin seed (one-time):** Ship a static `data/seed-cn-aliases.json` of ~50 popular brand mappings (`'雷克萨斯' → 'lexus'`, `'丰田' → 'toyota'`) loaded into `brand_aliases` during P5 migration; auto-extends as Che168/Autohome scrapers encounter new brands and write canonical-only rows for admin reconciliation later.

[CITED: WebFetch on https://www.drom.ru/catalog/lexus/, CONTEXT.md D-08]

## Risk Register: Top 5 Phase 5 Derail Modes

| # | Risk | Probability | Impact | Mitigation |
|---|------|------------|--------|------------|
| 1 | **Encar fingerprint defeats Crawlee+Firefox+IPRoyal residential** | MEDIUM | HIGH (zero KR inventory) | D-03 auto-flip to Carapis at +3 days. Day-3 checkpoint task in plan. Carapis trial sign-up done in Wave 1 to de-risk the flip latency. |
| 2 | **drom catalog backfill exceeds 2-week budget** | MEDIUM | MEDIUM (matcher fallback degraded) | Idempotent resumable scrape (cursor in pg-boss job state). Run in parallel with Encar build (no proxy contention). Page-cap defensible scope: top 50 brands first, long-tail second pass. |
| 3 | **IPRoyal session quality insufficient for Encar/Che168/Autohome** | LOW-MED | HIGH | Runner-up Smartproxy/Decodo PAYG ($3.5/GB) ready to swap. Block-detection auto-flip to runner-up after 3 D-13 halts in 7 days. Need accounts pre-provisioned. |
| 4 | **pg-boss v12.18 schedule API has unexpected behavior** | LOW | MEDIUM (cron silently skips runs) | Wave 0 task: simple smoke test schedule on staging that increments a counter every minute for 1 hour, verify exactly 60 runs. Fall back to OS cron + one-shot worker if needed (planner picks; cost: 1 day). |
| 5 | **Image rehost pipeline saturates worker bandwidth or S3 budget** | LOW | MEDIUM (broken images in PDF) | Concurrency cap at 5 parallel uploads per scrape run; sharp `quality:80` for ~70% size reduction; multipart via lib-storage handles partial-failure cleanup. Size monitoring alarm at >100GB/mo Yandex Object Storage budget. |

## Validation Architecture

**Test framework:**
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x + @playwright/test 1.59 (for E2E) [ASSUMED — no test infrastructure exists yet in this repo; Wave 0 must establish] |
| Config file | none — Wave 0 task creates `server/vitest.config.ts` |
| Quick run command | `pnpm vitest run --include 'server/src/workers/scrapers/**/*.test.ts'` (or npm equivalent) |
| Full suite command | `pnpm vitest run && pnpm playwright test` |

### Test taxonomy

| Layer | Approach | Examples |
|-------|----------|----------|
| **Unit** | Pure function tests for `normalize()` per source with frozen JSON fixtures | `normalize.encar.test.ts` — feed raw scraped HTML/JSON, assert output `NormalizedCar` |
| **Integration: HTTP cassette** | nock-recorded fixtures from real fetches; tests replay recorded responses | `http.drom.test.ts` — assert correct rate-limit, retry on 429, error taxonomy |
| **Integration: image pipeline** | Real sharp + mocked S3 client (`@aws-sdk/client-s3-mock`) | `images.test.ts` — assert webp output, correct key, idempotency via HeadObject mock |
| **Integration: block-detection** | Inject thin/captcha responses, assert state transitions | `block-detection.test.ts` — 5-thin-response sequence → halts source, queues email job |
| **Integration: dedup** | Run scraper twice with same fixture, assert UPSERT idempotency | `encar.dedup.test.ts` — running 2× produces same row count, no duplicates by `(source, source_id)` |
| **Integration: soft-delete sweep** | Seed cars with various `last_seen_at`, run sweep, assert `is_active` flips | `softdelete.test.ts` — protect `is_admin_curated`, age out per source-specific window |
| **Integration: CBR FX** | mocked HTTP returns canned XML (incl. windows-1251 encoded fixture), assert correct rate parsing + fallback | `fx.cbr.test.ts` — KRW/JPY/CNY/USD/EUR all decoded, fallback to last `fx_rates` row on fetch fail |
| **Integration: Cyrillic↔Latin** | Seed `brand_aliases` with drom data, run normalize against foreign-source strings | `aliases.test.ts` — `'현대' → 'hyundai'`, `'雷克萨斯' → 'lexus'`, admin overrides win |
| **E2E "dry-run"** | scrape against fixtures that mock the live URL via Crawlee `requestHandler` mocking; full pipeline excluding actual UPSERT | `encar.dry-run.test.ts` — fetch fixture → normalize → image rehost (mocked S3) → upsert (mocked DB) — assert log of operations |
| **Stress / regression** | 100-image fixture batch through `images.ts` | `images.stress.test.ts` — process 100 fixtures, assert no leaks, all keys correct |
| **Manual** | Production smoke run after deploy: each source scrapes ≤10 listings, founder verifies `/admin/scrapers/health` shows green | (no automation; Wave N task) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test type | Automated command | File / status |
|--------|----------|-----------|-------------------|---------------|
| SCRAPE-01 | Encar Crawlee + KR proxy UPSERT no dupes | unit + integration:dedup | `vitest run server/src/workers/scrapers/encar/*.test.ts` | ❌ Wave 0 — fixture + test files |
| SCRAPE-02 | BeForward Cheerio scrape | unit + integration | `vitest run server/src/workers/scrapers/beforward/*.test.ts` | ❌ Wave 0 |
| SCRAPE-03 | Che168 Playwright + CN proxy | unit + integration | `vitest run server/src/workers/scrapers/che168/*.test.ts` | ❌ Wave 0 |
| SCRAPE-04 | Autohome Playwright + CN proxy | unit + integration | `vitest run server/src/workers/scrapers/autohome/*.test.ts` | ❌ Wave 0 |
| SCRAPE-05 | drom catalog populates `models` weekly→monthly | integration + e2e dry-run | `vitest run server/src/workers/scrapers/drom/*.test.ts` | ❌ Wave 0 |
| SCRAPE-06 | Soft-delete via `last_seen_at` per source | integration:soft-delete | `vitest run server/src/workers/scrapers/shared/softdelete.test.ts` | ❌ Wave 0 |
| SCRAPE-07 | Image rehost to YOS, no hot-link | integration:image-pipeline + stress | `vitest run server/src/workers/scrapers/shared/images.test.ts` | ❌ Wave 0 |
| SCRAPE-08 | Worker isolation: MemoryMax=1G, fresh browser | manual + smoke (systemd unit reload + `ps`/`free` check after run) | `bash scripts/scraper-isolation-smoke.sh` | ❌ Wave 0 |
| SCRAPE-09 | Per-source metrics endpoint shape | integration:http (Hono test client) | `vitest run server/src/http/routes/admin.scrapers.test.ts` | ❌ Wave 0 |
| SCRAPE-10 | Brand/model canonicalised | integration:aliases | `vitest run server/src/workers/scrapers/shared/aliases.test.ts` | ❌ Wave 0 |
| SCRAPE-11 | Source-currency authoritative; RUB on read from CBR | integration:fx | `vitest run server/src/infra/fx.test.ts` | ❌ Wave 0 |

### Sampling rate
- **Per task commit:** `vitest run --changed` (only files touched + dependents)
- **Per wave merge:** `pnpm vitest run` (full unit + integration)
- **Phase gate (`/gsd-verify-work`):** full suite + manual smoke run on staging worker VM

### Wave 0 gaps
- [ ] `server/vitest.config.ts` — establish framework
- [ ] `server/tests/conftest.ts` — shared fixtures (mock pg-boss, mock S3, mock HTTP)
- [ ] `server/tests/fixtures/{drom,encar,beforward,che168,autohome}/page-{1,2,3}.html` — recorded sample pages (sanitised)
- [ ] `server/tests/fixtures/cbr-xml-daily.xml` — windows-1251-encoded sample
- [ ] `server/tests/fixtures/images/sample-{toyota,lexus,...}.jpg` — for sharp transcode tests
- [ ] Framework install: `pnpm add -D vitest @playwright/test @aws-sdk/client-s3-mock nock`

## Security Domain

> Required (security_enforcement absent in config = enabled). Phase 5 has limited security surface (no PII writes, no auth surface), but the metrics endpoint and image-rehost pipeline have specific concerns.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `/api/admin/scrapers/health` route + `/api/admin/brand-aliases` CRUD endpoints — auth-gated by Phase 6 RBAC; Phase 5 ships with stub middleware returning 401 |
| V3 Session Management | indirect | Inherits Better-Auth session model from Phase 6 — no Phase 5-specific session work |
| V4 Access Control | yes | Phase 6 enforces founder/sales-rep RBAC; Phase 5 endpoints stamped `requireRole('founder')` for scraper config writes, `requireRole('sales_rep' \| 'founder')` for read |
| V5 Input Validation | yes | Zod schemas for `PUT /api/admin/scrapers/:source/config` body (ensure `soft_delete_hours` is positive integer, `enabled` is boolean, `cron_expression` matches valid cron regex) |
| V6 Cryptography | yes (defensively) | Yandex Object Storage SSE at rest (default); presigned URLs for any private-bucket access; SOPS-encrypted secrets for `IPROYAL_PROXY_USER`, `IPROYAL_PROXY_PASS`, `CARAPIS_API_KEY`, `YC_S3_KEY`/`SECRET` — never plaintext in env files |
| V8 Data Protection | yes | Image filenames are deterministic + non-PII (source + source_id) — no leakage |
| V12 File and Resources | yes | `images/cars/...` paths are server-generated — no user-controlled paths reach the S3 PUT |

### Known Threat Patterns for Phase 5 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via image URL (scraper fetches `http://169.254.169.254/...` from a poisoned listing) | Tampering / Info disclosure | Whitelist source URL hostnames per source (`encar.com`, `pic{N}.encar.com`, `i.beforward.jp`, `img.che168.com`, etc.); reject URLs that resolve to RFC1918 / link-local addresses; got-scraping `dnsLookup` filter |
| HTML injection via parsed listing fields stored to `cars.spec_summary` etc. | XSS in admin/public UI | Frontend renders as text only (React default-escapes); for any `dangerouslySetInnerHTML` (none in v1) — sanitize via DOMPurify. Server-side: Zod schemas reject control characters in normalized fields |
| pg-boss schedule poisoning (a malicious admin schedules `; DROP TABLE`) | Tampering | Schedule names are server-controlled enums (`'scrape:encar'` etc.); admin endpoints only toggle `enabled`/`paused_until`/`soft_delete_hours`, never insert raw cron strings |
| Image upload bomb (zip-bomb-style large source image OOMs sharp) | DoS | sharp `limitInputPixels` set to safe default (~268M pixels = 16384×16384); content-length cap on download (10 MB) before transcode |
| Captcha solving service required → vendor risk | Repudiation / 152-FZ | NOT in v1 scope; D-13 auto-halt is the response. If v1.x adds 2captcha, ensure the vendor doesn't proxy through non-RU servers + that no PII is sent (image only) |
| Proxy credential leakage in error logs | Info disclosure | Logger redactor strips `IPROYAL_PROXY_*` and `CARAPIS_*` from any error stringification before send to GlitchTip |

## Sources

### Primary (HIGH confidence)
- [Carapis Encar Parser API docs](https://docs.carapis.com/parsers/encar.com/intro) — fields, SDK, bilingual response shape
- [Carapis homepage](https://carapis.com/) — sign-up + free-tier confirmation (pricing not on public page)
- [drom.ru/catalog root](https://www.drom.ru/catalog/) — URL pattern, brand list, SSR confirmation
- [drom.ru/catalog/lexus/](https://www.drom.ru/catalog/lexus/) — Cyrillic↔Latin pair extraction confirmation
- [drom.ru robots.txt](https://www.drom.ru/robots.txt) — no Crawl-delay for `*`, no `/catalog/` Disallow
- [BeForward stocklist](https://www.beforward.jp/stocklist/) — SSR confirmation, no anti-bot detected
- [CBR daily XML feed](https://www.cbr.ru/scripts/XML_daily.asp) — XML structure, windows-1251 encoding, KRW/JPY/CNY/USD/EUR coverage
- [CBR XML interface docs](https://www.cbr.ru/development/sxml/) — `date_req` parameter format
- [pg-boss GitHub](https://github.com/timgit/pg-boss) — v12.18.1 release confirmation
- [pg-boss v10 release notes](https://github.com/timgit/pg-boss/releases/tag/10.0.0) — schedule API + sendOnce removal context
- [Crawlee anti-blocking guide](https://crawlee.dev/js/docs/guides/avoid-blocking) — built-in fingerprinting defaults
- [Apify: Scraping Naver and Korean Websites](https://use-apify.com/blog/scrape-naver-korean-websites) — Korean residential proxy + KT/SKT/LG U+ ISP-targeting recommendation

### Primary — internal research (HIGH confidence)
- [.planning/research/STACK.md](.planning/research/STACK.md) — locked stack + per-source notes
- [.planning/research/ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) — Pattern 3 + storage layout + schema sketches
- [.planning/research/PITFALLS.md Pitfall 3](.planning/research/PITFALLS.md) — Encar/Che168/Autohome anti-bot; proxy strategy specifics
- [.planning/research/PITFALLS.md Pitfall 4](.planning/research/PITFALLS.md) — USS legal blowback (confirms exclusion)
- [.planning/research/PITFALLS.md Pitfall 7](.planning/research/PITFALLS.md) — drom.ru partner API check (KEY: research found this is auto-parts API, not vehicle catalog)
- [.planning/research/PITFALLS.md Pitfall 8](.planning/research/PITFALLS.md) — UPSERT idempotency + `last_seen_at` soft-delete pattern
- [.planning/research/PITFALLS.md Pitfall 9](.planning/research/PITFALLS.md) — FX volatility (CBR XML feed)
- [.planning/research/PITFALLS.md Pitfall 14](.planning/research/PITFALLS.md) — scraper isolation (separate worker, fresh browser, MemoryMax)
- [.planning/research/PITFALLS.md Pitfall 16](.planning/research/PITFALLS.md) — staggered cron windows
- [.planning/research/PITFALLS.md Pitfall 20](.planning/research/PITFALLS.md) — Cyrillic vs Latin canonicalisation
- [.planning/research/SUMMARY.md](.planning/research/SUMMARY.md) — proxy budget tension flag

### Secondary (MEDIUM confidence — verified against multiple sources)
- [IPRoyal pricing](https://iproyal.com/pricing/residential-proxies/) — $1.75-$7/GB residential, traffic-never-expires
- [Apify Best Residential Proxies 2026](https://use-apify.com/blog/best-residential-proxies-2026) — Bright Data/Oxylabs/IPRoyal comparison
- [Decodo / Smartproxy rebrand pricing](https://decodo.com/blog/web-scraping-with-cheerio-and-node-js) — $3.5/GB PAYG
- [Scrapfly: How to Bypass Cloudflare in 2026](https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping) — anti-bot landscape
- [Scrapfly: How to Bypass Akamai in 2026](https://scrapfly.io/blog/posts/how-to-bypass-akamai-anti-scraping) — TLS JA3/JA4 detection
- [pg-boss DeepWiki cron-based scheduling](https://deepwiki.com/timgit/pg-boss/10.1-cron-based-scheduling) — schedule API context

### Tertiary (LOW confidence — would benefit from in-flight verification)
- [Carapis pricing (USD)](https://docs.carapis.com/) — not on public pages; planner must capture during Day-3 trial sign-up
- Encar exact anti-bot vendor (Cloudflare? Akamai? PerimeterX?) — no public confirmation; treat as opaque commercial anti-bot. Mitigation: Crawlee defaults + IPRoyal residential + D-03 auto-flip ceiling

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Phase 2 ships `cars` and `models` schema with all columns from ARCHITECTURE.md sketch | Schema Deltas | If Phase 2 ships a leaner schema, Phase 5 migrations include the missing columns — minor scope creep |
| A2 | Carapis returns "delta" via natural absence-from-poll (not an explicit changelog endpoint) | Source Playbook G | If they have explicit changelog API, P5 misses an efficiency win — recoverable in v1.x |
| A3 | Vitest is the test framework choice (no test infra exists yet) | Validation Architecture | Planner picks alternative (e.g., node:test); minor refactor |
| A4 | Carapis pricing ≤$300/mo for our volume tier | Source Playbook G | If >$300 and Encar Crawlee path also fails, founder approval gate at Day-4 |
| A5 | Encar listing detail pages have a stable `data-carid` (or equivalent stable identity attribute) | Source Playbook B | If only URL contains the ID, parse from URL — minor adapter change |
| A6 | drom.ru catalog page count fits backfill in ≤2 weeks at 1 req/5s | Source Playbook A | If actual page count is 3-5× higher, plan invokes founder-curated whitelist (deferred per CONTEXT.md but available as escape hatch) |
| A7 | sharp + lib-storage handle webp-multipart correctly to Yandex Object Storage S3 endpoint | Shared infra: images.ts | If endpoint compat breaks (e.g., signature v4 strict-mode mismatch), use simple `PutObject` for sub-multipart sizes (typical car images are <5MB → multipart not strictly required) |
| A8 | Yandex Object Storage tolerates `Cache-Control: immutable` directive on PUT | Shared infra: images.ts | Header is purely advisory; if rejected, drop directive — public CDN cacheability unaffected |
| A9 | IPRoyal sticky sessions persist captcha solves across the same scrape run sequence | Proxy Vendor Decision | If sessions break mid-run, increase Crawlee `sessionPool.maxPoolSize` and retire on first block — extra cost: ~10% more proxy GB |
| A10 | The `CARAPIS_API_KEY` (when used) is sent as `Authorization` header per typical SDK convention | Source Playbook G | If query-param auth is required, SDK abstracts it; no plan change |
| A11 | All 5 scrape sources exhibit `last_seen_at` soft-delete signal correctly (sold listings disappear, not 404 with old data) | Soft-Delete Sweep | If a source returns "old listing in archive state" instead of dropping it, sweep correctness depends on per-source detail-page status check — adapter-level concern, not architecture |

**This is the canonical list of claims that should be confirmed during Day-1 of execution or surfaced to the user during `/gsd-discuss-phase` if it had time. Most are LOW risk and are recoverable in-flight.**

## Open Questions

1. **Phase 2 actual `cars` / `models` columns shipped vs ARCHITECTURE.md sketch.**
   - What we know: ARCHITECTURE.md sketch documented; Phase 2 plans not yet written.
   - What's unclear: Phase 2 may ship a leaner first cut.
   - Recommendation: Phase 5 plan adds a "schema verification" Wave 0 task that diffs actual deployed schema vs expected; missing columns are added in Phase 5 migrations.

2. **Carapis pricing for production (USD/mo).**
   - What we know: free trial 1k requests; tier names exist (Standard/Pro/Enterprise).
   - What's unclear: actual USD prices.
   - Recommendation: Wave 1 task — sign up for Carapis trial; capture pricing matrix; document in PLAN.md before Day-3 checkpoint fires.

3. **Encar's actual anti-bot vendor (Cloudflare/Akamai/PerimeterX/in-house).**
   - What we know: it's commercial-grade; native IP/Korean-language detection layer; PITFALLS Pitfall 3 confirms.
   - What's unclear: which vendor specifically.
   - Recommendation: Day 1 of Encar Wave — run a single Playwright Firefox + IPRoyal KR test fetch with `nslookup` of any anti-bot CNAME visible in `Server` header. Adapt config (e.g., add `bm_sz` cookie pre-warm if Akamai is detected).

4. **CN→Latin seed list for `brand_aliases` first batch.**
   - What we know: drom doesn't expose CN forms; manual seed needed.
   - What's unclear: which 50 brands matter most for Russian buyers (likely BYD, Geely, Haval, Chery, Great Wall, Lixiang, Nio, etc.).
   - Recommendation: Wave 1 task — founder spends 30 min listing the top 50 CN brands by RU buyer interest; researcher transliterates to seed JSON.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | Worker runtime | ✓ (machine has v25.6.0) | v25.6.0 — newer than required (v22 LTS); confirm Yandex Compute VM image uses v22 explicitly | — |
| Docker | Container build | ✓ | v29.2.0 | — |
| ffmpeg | (not used in P5) | ✓ | v8.0.1 | n/a |
| psql client | DB introspection during dev | ✗ | — | Use `npx drizzle-kit studio` or remote PG via Yandex managed PG console |
| redis-cli | (NOT NEEDED — pg-boss replaces Redis) | ✗ | — | n/a |
| Playwright browsers | Encar/Che168/Autohome scrape | ✗ (not installed; deps installed at Phase 5 worker image build) | n/a | `npx playwright install --with-deps firefox chromium` in worker Dockerfile |
| sharp native binaries | Image transcode | ✗ on dev machine; will install via npm | n/a | `npm install sharp` resolves prebuilt binary for darwin-arm64 / linux-x64 |
| pg-boss | Cron + queue | ✗ | n/a | `npm install pg-boss@12.18.1` in P5 |
| Yandex Object Storage | Image rehost target | n/a (provisioned in Phase 1) | n/a | Phase 1 already provisions `dvapro-prod` bucket (per INFRA-06) |
| IPRoyal account | KR/CN proxy egress | ✗ | n/a | Wave 1 task — founder/admin signs up at iproyal.com; PAYG no minimum |
| Carapis account | Encar fallback | ✗ | n/a | Wave 1 task — sign up free tier at my.carapis.com |
| Unisender Go | Block-detection alert email | n/a (provisioned in Phase 1) | n/a | Phase 1 already provisions account (per INFRA-03) |

**Missing dependencies with no fallback:** None — all gaps are addressed by either Phase 1 prerequisites or Wave 1 onboarding tasks within Phase 5.

**Missing dependencies with fallback:** Playwright browser install + sharp native binary — handled by Dockerfile in worker image build.

---

## RESEARCH COMPLETE
