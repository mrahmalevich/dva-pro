# Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers) — Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** ~28 new files (server tree)
**Analogs found:** 1 in-repo (frontend `Car` shape contract) / 27 external-reference-only (greenfield server tree)

---

## Honest Up-Front Note

The current repo is **frontend-only** (`src/` = React 18 + Vite + react-router SPA). The entire `server/` tree where Phase 5 lands is **provisioned in Phase 1, populated in Phase 2, and extended by Phase 5**. It does not exist on disk yet.

Therefore:
- **Almost no in-repo code analogs exist for Phase 5 files.** Pretending otherwise would produce fabricated patterns.
- The **one binding in-repo contract** is the frontend `Car` interface at `src/crm/types.ts:4` — Phase 5's `normalize()` output, the `cars` table shape, and the `GET /api/cars` response must collectively round-trip into this exact field set so the existing UI (`src/sections/Catalog.tsx`, `src/admin/CarsAdmin.tsx`, etc.) continues to render unchanged.
- For each new file we list its closest **external** reference (Crawlee docs, pg-boss schedule API, Drizzle migration template, etc.) with a 1-line excerpt the planner can hand the executor. These are pinned to versions verified in `05-RESEARCH.md` (Crawlee 3.x, Playwright 1.59.x, pg-boss 12.18.1, Drizzle 0.45, sharp 0.34.5, @aws-sdk/client-s3 3.1037.0, @aws-sdk/lib-storage 3.1037.0, iconv-lite 0.7.2, fast-xml-parser 5.7.2).

---

## Project-Wide Conventions Phase 5 Files Must Respect

Extracted from existing repo configuration (`/Users/mikhailra/Developer/dva.pro/package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`):

| Convention | Source | Constraint on Phase 5 server/ files |
|------------|--------|-------------------------------------|
| **`"type": "module"` (ESM)** | `package.json:5` | All new `server/` `.ts` files use ESM `import`/`export`; no CommonJS `require`. Path-style imports must end in `.js` if `moduleResolution` is changed to `node16`/`nodenext` later — but current frontend uses `"moduleResolution": "bundler"` so import paths can be extension-less for now. Server `tsconfig` will likely be added separately (a Phase 1/2 task) and may pick `nodenext` — Phase 5 plans should match whatever that file picks. |
| **TypeScript strict mode** | `tsconfig.json:15` (`"strict": true`) | All new files compile under `strict`; no implicit `any`, no unchecked nullables. Drizzle schema columns need explicit `.notNull()` where the column is `NOT NULL` so the inferred insert type is correct. |
| **Target ES2022** | `tsconfig.json:3` | Top-level `await`, `Error.cause`, native class fields are available. Don't pull in older transpiles. |
| **`isolatedModules: true`** | `tsconfig.json:11` | Every file must be self-contained at the type level: `export type` (not bare `export`) for re-exporting types. |
| **`noFallthroughCasesInSwitch: true`** | `tsconfig.json:18` | Block-detection signal `switch` statements need explicit `break` / `return` per case. |
| **`.env`, `.env.local`, `*.log`, `.vite` ignored** | `.gitignore` | Phase 5 secrets (`IPROYAL_*`, `CARAPIS_API_KEY`, `YC_S3_*`, `DATABASE_URL`, `UNISENDER_GO_*`) live in `.env` (already ignored). Server logs to `.log` files locally (already ignored). The bucket name `dvapro-prod` is non-secret; the access key/secret are. |
| **No ESLint / Prettier configured** | (no `.eslintrc*`, no `.prettierrc*`, none in `package.json` devDeps) | Phase 5 is free to introduce one — but the planner should treat tooling setup as a Phase 1/2 concern, not Phase 5. If introduced in Phase 5, reuse standard `@typescript-eslint/recommended-strict` to match `strict: true` already set in tsconfig. |
| **No test framework installed** | `package.json:devDependencies` lacks vitest/jest/playwright | Phase 5's Wave 0 must `npm install -D vitest @playwright/test @aws-sdk/client-s3-mock nock` — confirmed in 05-RESEARCH.md §"Wave 0 gaps". |
| **Build via `tsc -b && vite build`** | `package.json:8` (root) | The server tree will need its own `tsc` invocation (separate `tsconfig.server.json` or workspace package). Phase 1/2 owns this. Phase 5 inherits. |
| **No path aliases yet** | `tsconfig.json` (no `paths`) | Imports between `server/src/workers/scrapers/` and `server/src/infra/`, etc., are relative until Phase 1/2 introduces a path-alias scheme. Don't invent one in Phase 5. |

---

## The One Hard In-Repo Contract: `Car` Shape

**Source:** `/Users/mikhailra/Developer/dva.pro/src/crm/types.ts:4-22`

This is the **only** file Phase 5 must respect at the type level — every other "analog" is greenfield. The frontend renders cars from this shape verbatim. The server-side `cars` table + `GET /api/cars` response + `normalize()` output must collectively produce values that the API serializer can map to these exact field names and types.

```typescript
// src/crm/types.ts:1-22 — frozen frontend contract
export type Country = 'jp' | 'cn' | 'kr';                  // P2 extends to 6 markets per ARCHITECTURE.md; P5 writes any of those
export type Accent = 'coral' | 'cyan';                     // UI-side display flag; server can default

export interface Car {
  id: string;             // server: cars.id (uuid or bigserial-as-string)
  brand: string;          // server: cars.brand — Cyrillic-preferred display string per SCRAPE-10 normalization
  model: string;          // server: cars.model
  year: number;           // server: cars.year (smallint)
  country: Country;       // server: cars.country (enum/text)
  mileage: string;        // server: formatted from cars.mileage_km — e.g., "12 000 км"
  body: string;           // server: cars.body
  drive: string;          // server: cars.drive
  fuel: string;           // server: cars.fuel — RU strings: 'Бензин' | 'Дизель' | 'Гибрид' | 'Электро'
  transmission: string;   // server: cars.transmission — 'Автомат' | 'Механика' | 'Робот'
  price: string;          // server: formatted RUB — e.g., "14 800 000 ₽" (computed on read from price_local + cbr fx)
  priceLocal: string;     // server: formatted source-currency — e.g., "¥ 21,400,000" (from cars.price_local + price_local_ccy)
  badges: string[];       // server: derived (['В пути', 'Premium', 'Auction Grade 4.5']); P5 emits {needs_review} → 'Проверяется' badge
  accent: Accent;         // server default: 'coral' (visual-only; no DB column needed)
  eta: string;            // server: formatted from delivery state — e.g., "Доставка 28 апр." | "В наличии"
  spec: string;           // server: cars.spec_summary one-liner built in normalize() — e.g., "3.5 V6 · 415 л.с. · 4WD"
  img: string;             // server: signed URL to image_key in dvapro-prod (NOT raw foreign URL — SCRAPE-07)
}
```

**Implications for Phase 5 `normalize()`:**

1. Every per-source `normalize{Source}()` produces a `NormalizedCar` (DB-shape: `mileage_km` integer, `price_local` integer, `price_local_ccy` enum, `image_keys` array). The `→ Car` projection happens in `domain/inventory/service.ts` on read (Phase 4 owns the matcher; Phase 5 only needs to ensure the DB columns are populated).
2. `mileage` (string with thousands separator) and `price` / `priceLocal` (string with currency glyph) are **frontend-display formatting**, not DB columns. Server stores integers; the serializer formats. Phase 5's responsibility ends at integer storage.
3. `accent` has **no DB column** — it's UI-only. The serializer can default to `'coral'`. No work in Phase 5.
4. `badges` is computed from DB flags (`needs_review`, `is_admin_curated`, source, `ready_at`/`eta` state). Phase 5 emits the underlying flags; the serializer derives the strings.
5. `Country` is `'jp' | 'cn' | 'kr'` today; per CONTEXT.md §code_context, Phase 2 expands this to 6 markets. Phase 5 writes whatever values that registry exposes. **Don't widen the enum yourself — that's Phase 2's job.** Phase 5 plans should reference `cars.country` values via a typed import from the Phase 2 country registry, not via inline string literals.

---

## File Classification

| New File (Phase 5 builds) | Role | Data Flow | Closest Analog | Match Quality |
|---------------------------|------|-----------|----------------|---------------|
| `server/src/workers/scrapers/shared/http.ts` | shared module | request-response | got-scraping docs (no in-repo analog) | external-only |
| `server/src/workers/scrapers/shared/normalize.ts` | shared module | transform | None — frontend `Car` interface (`src/crm/types.ts:4`) is the output contract | contract-only |
| `server/src/workers/scrapers/shared/images.ts` | shared module | streaming + file-I/O | sharp + @aws-sdk/lib-storage docs (no in-repo analog) | external-only |
| `server/src/workers/scrapers/shared/block-detection.ts` | shared module | event-driven | None — greenfield (D-13 spec in CONTEXT.md) | greenfield |
| `server/src/workers/scrapers/shared/aliases.ts` | shared module | CRUD (read-mostly) | None — greenfield (SCRAPE-10) | greenfield |
| `server/src/workers/scrapers/shared/softdelete.ts` | shared module | batch CRUD | None — greenfield (SCRAPE-06) | greenfield |
| `server/src/workers/scrapers/dromCatalog.ts` | worker / scraper | request-response (HTTP+parse) | Crawlee `CheerioCrawler` example | external-only |
| `server/src/workers/scrapers/encar.ts` | worker / scraper | request-response (browser+parse) | Crawlee `PlaywrightCrawler` Firefox example | external-only |
| `server/src/workers/scrapers/encar/carapis-adapter.ts` | worker / adapter | request-response (REST API) | Carapis `@carapis/encar` Node SDK README | external-only |
| `server/src/workers/scrapers/beforward.ts` | worker / scraper | request-response (HTTP+parse) | Crawlee `CheerioCrawler` example | external-only |
| `server/src/workers/scrapers/che168.ts` | worker / scraper | request-response (browser+parse) | Crawlee `PlaywrightCrawler` Firefox example | external-only |
| `server/src/workers/scrapers/autohome.ts` | worker / scraper | request-response (browser+parse) | Crawlee `PlaywrightCrawler` Firefox example | external-only |
| `server/src/workers/scrapers/uss/README.md` | placeholder doc | n/a | None — stub-only per PROJECT.md | n/a |
| `server/src/workers/scrapers/uss/normalizeUssCsv.ts` | shared module (stub) | transform | None — placeholder for partner CSV | greenfield |
| `server/src/workers/index.ts` (extends P2) | worker entrypoint | event-driven | pg-boss `boss.work()` + `boss.schedule()` API | external-only |
| `server/src/infra/fx.ts` | infrastructure | request-response (HTTP+XML parse) | CBR XML feed spec + iconv-lite + fast-xml-parser | external-only |
| `server/src/http/routes/admin.scrapers.ts` | http route | request-response (REST) | Hono router docs; no in-repo analog | external-only |
| `server/src/http/routes/admin.brand-aliases.ts` | http route | CRUD (REST) | Hono router docs; no in-repo analog | external-only |
| `server/migrations/00XX_phase5_scraper_tables.sql` | migration | DDL | drizzle-kit generated SQL template | external-only |
| `server/src/db/schema/scraperConfig.ts` | drizzle schema | DDL (TS) | Drizzle 0.45 `pgTable` example | external-only |
| `server/src/db/schema/scraperRuns.ts` | drizzle schema | DDL (TS) | Drizzle 0.45 `pgTable` example | external-only |
| `server/src/db/schema/brandAliases.ts` | drizzle schema | DDL (TS) | Drizzle 0.45 `pgTable` example | external-only |
| `server/src/db/schema/fxRates.ts` | drizzle schema | DDL (TS) | Drizzle 0.45 `pgTable` example | external-only |
| `server/src/data/seed-cn-aliases.json` | fixture | static data | None — manual seed list (~50 CN brands) | greenfield |
| `server/tests/fixtures/{drom,encar,beforward,che168,autohome}/page-N.html` | test fixture | static data | None — recorded sample pages | greenfield |
| `server/tests/fixtures/cbr-xml-daily.xml` | test fixture | static data | None — windows-1251 sample | greenfield |
| `server/src/workers/scrapers/shared/*.test.ts` | test | request-response | Vitest 1.x docs (no in-repo analog) | external-only |
| `server/src/workers/scrapers/{source}/*.test.ts` | test | request-response | Vitest 1.x + nock docs | external-only |

**Out-of-phase but referenced (built earlier, consumed here):**
- `server/src/db/schema/cars.ts` (Phase 2) — Phase 5 inserts/upserts here
- `server/src/db/schema/models.ts` (Phase 2) — Phase 5 populates from drom
- `server/src/infra/db.ts`, `infra/queue.ts`, `infra/s3.ts`, `infra/mail.ts`, `infra/env.ts` (Phase 1/2) — Phase 5 imports
- `server/src/http/server.ts` (Phase 2) — Phase 5 mounts `/api/admin/scrapers/*` route on the existing app
- `packages/shared/types.ts` (Phase 2) — single source of truth for `Car`/`Country`; Phase 5's `normalize()` output type lives here

---

## Pattern Assignments (External References, Pinned to Verified Versions)

The format below gives the planner a 1-line code excerpt the executor can copy directly, plus the docs URL. All versions are taken from `05-RESEARCH.md` `npm view` verifications.

### `server/src/workers/scrapers/shared/http.ts` (shared, request-response)

**No in-repo analog.** Closest external reference: `got-scraping` (bundled by Crawlee 3.x).

**Reference excerpt** (RESEARCH.md §"shared/http.ts" — already a binding sketch):
```typescript
export async function fetchHtml(url: string, opts: {
  source: ScraperSource;
  proxyUrl?: string;
  acceptLanguage: string;
  timeoutMs?: number;
}): Promise<{ html: string; status: number; headers: Record<string, string> }> {
  // wraps got-scraping; 3 retries on 5xx/429 with exp backoff; per-host token-bucket rate limit
  // throws taxonomy: ThinResponseError | CaptchaDetectedError | RateLimitedError | NetworkError
}
```

**Error taxonomy** must be importable by `block-detection.ts`. Define error classes once and re-export:
```typescript
export class ThinResponseError extends Error {}
export class CaptchaDetectedError extends Error {}
export class RateLimitedError extends Error { constructor(public retryAfterSec?: number) { super('rate limited'); } }
export class NetworkError extends Error { constructor(public cause: unknown) { super('network error', { cause }); } }
```

**Docs:** https://crawlee.dev/js/api/utils/namespace/social#crawleegetGotScrapingInstance and (for the underlying `got-scraping`) https://www.npmjs.com/package/got-scraping

---

### `server/src/workers/scrapers/shared/normalize.ts` (shared, transform)

**Output contract:** the frontend `Car` shape at `src/crm/types.ts:4`. See "The One Hard In-Repo Contract" above.

**Reference excerpt** (RESEARCH.md §"shared/normalize.ts"):
- One per-source `normalize{Source}` exported (e.g., `normalizeEncar(raw): NormalizedCar`).
- Brand/model canonicalisation via `brand_aliases` lookup (in-memory cache reloaded per scrape run from PG).
- Body type enum mapping: `세단 → 'sedan'`, `SUV → 'suv'`, `クーペ → 'coupe'`, `轿车 → 'sedan'`.
- Mileage parser: `"101,697 km" → 101697` integer.
- Price parser: source-currency minor units (KRW: `"21,400만" → 214000000`; JPY: `"¥10,860" → 10860`; CNY: `"15万元" → 150000`).
- Pure functions, no IO — testable with frozen JSON fixtures.

**Test file:** `normalize.{source}.test.ts` per source under `server/tests/fixtures/{source}/`.

**Docs:** No external library equivalent. The pattern is bespoke. Pure functions; framework: vitest.

---

### `server/src/workers/scrapers/shared/images.ts` (shared, streaming + file-I/O)

**No in-repo analog.** External references:

- sharp 0.34.5 (verified `npm view sharp version` 2026-04-27): https://sharp.pixelplumbing.com/api-output/#webp
- @aws-sdk/client-s3 3.1037.0 + @aws-sdk/lib-storage 3.1037.0: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-lib-storage/

**Reference excerpt** (RESEARCH.md §"shared/images.ts" — already binding):
```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';

const s3 = new S3Client({
  endpoint: 'https://storage.yandexcloud.net',
  region: 'ru-central1',
  credentials: { accessKeyId: env.YC_S3_KEY, secretAccessKey: env.YC_S3_SECRET },
  forcePathStyle: false,
});

// per image:
// 1) fetch source URL via fetchHtml (responseType:'buffer') with 30s timeout
// 2) const webp = await sharp(buf).webp({ quality: 80 }).toBuffer();   // keeps original dims (D-16)
// 3) key = `images/cars/${source}/${sourceId}/${index === 0 ? 'primary' : String(index+1).padStart(2,'0')}.webp`
// 4) HeadObject first; skip if exists w/ same Content-Length (idempotency)
// 5) await new Upload({ client: s3, params: { Bucket:'dvapro-prod', Key: key, Body: webp,
//                       ContentType:'image/webp', CacheControl:'public, max-age=31536000, immutable' } }).done();
```

**Safety rails (RESEARCH.md §Security Domain):**
- SSRF: whitelist source hostnames per source (e.g., `pic*.encar.com`, `i.beforward.jp`, `img.che168.com`); reject RFC1918/link-local resolutions.
- Image bomb: `sharp().limitInputPixels(268_000_000)` and content-length cap of 10 MB before transcode.

---

### `server/src/workers/scrapers/shared/block-detection.ts` (shared, event-driven)

**No in-repo analog.** Greenfield, fully spec'd in CONTEXT.md D-13 + RESEARCH.md §"shared/block-detection.ts".

**Reference excerpt** (RESEARCH.md — binding):
```typescript
const CAPTCHA_PATTERNS = /验证|请稍候|보안 인증|잠시만 기다려 주세요|recaptcha|cf-challenge|prove you('|')re human|robot.{0,10}check|please verify/i;
const BLOCK_THRESHOLD = 5;       // ≥5 consecutive → halt
const COOLDOWN_HOURS = 24;       // paused_until = now()+24h

export type BlockSignal = 'thin_body' | 'captcha_keyword' | 'http_403' | 'http_429';

export function detectBlock(r: { html: string; status: number }): BlockSignal | null {
  if (r.status === 403) return 'http_403';
  if (r.status === 429) return 'http_429';
  if (r.html.length < 1024) return 'thin_body';
  if (CAPTCHA_PATTERNS.test(r.html)) return 'captcha_keyword';
  return null;
}

export async function haltSource(src: ScraperSource, reason: BlockSignal, db: DB, queue: Queue) {
  await db.update(scraperConfig).set({
    pausedUntil: sql`NOW() + INTERVAL '24 hours'`,
    lastRunStatus: 'blocked',
    lastBlockReason: reason,
  }).where(eq(scraperConfig.source, src));
  await queue.send('email.founder-alert', { template: 'scraper-blocked', source: src, reason, paused_until: '24h' });
}
```

**Test:** RESEARCH.md §Validation: `block-detection.test.ts` — inject 5-thin sequence, assert paused + email queued + counter reset.

---

### `server/src/workers/scrapers/dromCatalog.ts` (worker / scraper, request-response)

**No in-repo analog.** Closest external reference: Crawlee 3.x `CheerioCrawler` example.

**Reference excerpt** (one-liner showing the pattern; full sketch in RESEARCH.md §"Source Playbook A"):
```typescript
import { CheerioCrawler } from 'crawlee';
const crawler = new CheerioCrawler({
  maxRequestsPerCrawl: 30000,
  maxConcurrency: 1,
  navigationTimeoutSecs: 30,
  async requestHandler({ request, $, enqueueLinks }) {
    // /catalog/             → enqueue brand pages (a[href^="/catalog/"])
    // /catalog/{brand}/      → extract brand cyrillic <h1>, enqueue model links
    // /catalog/{brand}/{m}/  → extract model, enqueue generation pages
    // /catalog/{b}/{m}/g_…/  → parse <dl>/<table> spec ranges, UPSERT into models, write brand_aliases pair
  },
});
```

**Rate-limit:** built-in `requestHandlerTimeoutSecs` is per-request; pacing is enforced via the shared `http.ts` token bucket at 1 req/5s ±2s jitter (RESEARCH.md §A — note: drom robots.txt has no Crawl-delay for `*`).

**Idempotent resumability** (CONTEXT.md §specifics): pg-boss job state stores `cursor.last_completed_brand_slug`; on restart, scraper skips brands already complete. UPSERT into `models` is naturally idempotent via `(brand_slug, model_slug, generation)` UNIQUE.

**Cyrillic↔Latin extraction** (D-08, RESEARCH.md §"Cyrillic↔Latin Auto-Build"): for each brand page, `<h1>` text = Cyrillic, URL slug = Latin. UPSERT into `brand_aliases` with `is_admin_override = false`; `ON CONFLICT … WHERE NOT is_admin_override`.

**Docs:** https://crawlee.dev/js/api/cheerio-crawler/class/CheerioCrawler

---

### `server/src/workers/scrapers/encar.ts` (worker / scraper, request-response)

**No in-repo analog.** Closest external reference: Crawlee 3.x `PlaywrightCrawler` with Firefox launcher.

**Reference excerpt:**
```typescript
import { PlaywrightCrawler } from 'crawlee';
import { firefox } from 'playwright';

const crawler = new PlaywrightCrawler({
  launchContext: { launcher: firefox, launchOptions: { headless: true } },
  proxyConfiguration: await getIproyalKrConfig(),
  browserPoolOptions: { maxOpenPagesPerBrowser: 1, retireBrowserAfterPageCount: 50 },
  navigationTimeoutSecs: 60,
  async requestHandler({ page, request }) {
    await page.waitForSelector('[data-carid]');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'ko-KR,ko;q=0.9' });
    // detail-page: extract carid, spec table <dl>, gallery <ul.gallery>
    // run detectBlock() on page.content(); on signal, throw → outer guard halts source
  },
});
try { await crawler.run(seedUrls); } finally { await crawler.teardown(); }   // SCRAPE-08 isolation
```

**Day-3 checkpoint** (D-03 trigger): plan must include explicit task at +3 days asking "≥1 valid UPSERT?". If NO → swap to `carapis-adapter.ts` at the same `normalize()` boundary.

**Docs:** https://crawlee.dev/js/api/playwright-crawler/class/PlaywrightCrawler ; https://playwright.dev/docs/api/class-firefox

---

### `server/src/workers/scrapers/encar/carapis-adapter.ts` (worker / adapter, REST)

**No in-repo analog.** External: `@carapis/encar` Node SDK published at https://github.com/markolofsen/carapis-encar-npm (per RESEARCH.md §G).

**Reference pattern:**
```typescript
import { CarapisEncar } from '@carapis/encar';   // SDK package; verify exact name at sign-up
const client = new CarapisEncar({ apiKey: env.CARAPIS_API_KEY });
const page = await client.listings.search({ since: lastSeenAt, limit: 100 });
// page.results: Array<{ id, title (KR+EN bilingual), price, specifications, location, seller, market_data }>
// adapter shape: same NormalizedCar output as encar.ts → drop-in replacement at normalize() boundary
```

**Trigger:** D-03 + RESEARCH.md §G — auto-flip rule. Free trial 1k req before paid tier; founder approval needed before paid subscription.

**Docs:** https://docs.carapis.com/parsers/encar.com/intro

---

### `server/src/workers/scrapers/beforward.ts` (worker / scraper, request-response)

**No in-repo analog.** Same pattern as `dromCatalog.ts` (CheerioCrawler) — RESEARCH.md §C confirms SSR + no anti-bot, no Playwright needed, RU DC IP fine, 1 req/3-5s.

**Reference:** see `dromCatalog.ts` excerpt; difference is the URL pattern (`https://www.beforward.jp/stocklist/`) and currency parsing (JPY).

---

### `server/src/workers/scrapers/{che168,autohome}.ts` (worker / scraper, request-response)

**No in-repo analog.** Same pattern as `encar.ts` (PlaywrightCrawler Firefox + CN residential proxy + Accept-Language `zh-CN`). RESEARCH.md §D, §E.

**Distinguishing constraint:** geo-restricted from non-CN IPs (will 451/redirect without CN residential). No fallback API ready (no Carapis-equivalent). If blocked > 3 days, defer to v1.x per D-11.

---

### `server/src/workers/index.ts` (worker entrypoint extension)

**No in-repo analog.** Phase 2 creates the file; Phase 5 adds scraper registrations.

**External reference:** pg-boss 12.18.1 (verified `npm view pg-boss version` 2026-04-26).

**Reference excerpt** (RESEARCH.md §"Cron + Worker Topology" — binding):
```typescript
// pg-boss v12 cron schedule signature
await boss.schedule('scrape:drom-catalog', '0 3 1 * *',  {}, { tz: 'Europe/Moscow' });   // monthly
await boss.schedule('scrape:encar',        '0 */4 * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('scrape:beforward',    '15 */4 * * *', {}, { tz: 'Europe/Moscow' });   // staggered +15
await boss.schedule('scrape:che168',       '30 */4 * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('scrape:autohome',     '45 */4 * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('softdelete:sweep',    '*/30 * * * *', {}, { tz: 'Europe/Moscow' });
await boss.schedule('fx:cbr-fetch',        '0 12 * * *',   {}, { tz: 'Europe/Moscow' });

await boss.work('scrape:encar', { teamSize: 1, teamConcurrency: 1 }, async (job) => {
  await runEncarScrape({ db, queue, s3 });
});
```

**Single-process worker topology** (RESEARCH.md §"Worker topology recommendation"): all `boss.work()` handlers run in one systemd unit (`MemoryMax=1G`, `Restart=on-failure`). NOT per-source containers.

**Docs:** https://github.com/timgit/pg-boss/blob/master/docs/readme.md ; https://deepwiki.com/timgit/pg-boss/10.1-cron-based-scheduling

---

### `server/src/infra/fx.ts` (infrastructure, request-response + parse)

**No in-repo analog.** External references: iconv-lite 0.7.2 + fast-xml-parser 5.7.2 (both verified in RESEARCH.md).

**Reference excerpt** (RESEARCH.md §"CBR FX Feed Spec" — binding):
```typescript
import iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';
import { fetchHtml } from '../workers/scrapers/shared/http.js';

export async function fetchCbrRates(): Promise<FxSnapshot> {
  const buf = await fetchHtml('https://www.cbr.ru/scripts/XML_daily.asp', { /*...*/ });
  const decoded = iconv.decode(Buffer.from(buf), 'win1251');                    // CBR XML is windows-1251, NOT utf-8
  const xml = new XMLParser({ ignoreAttributes: false, parseAttributeValue: false }).parse(decoded);
  const date = xml.ValCurs['@_Date'];                                            // "27.04.2026"
  const valutes = xml.ValCurs.Valute as Array<{ CharCode: string; Nominal: string; Value: string }>;
  const rates = Object.fromEntries(
    valutes.filter(v => ['KRW','JPY','CNY','USD','EUR'].includes(v.CharCode))
           .map(v => [v.CharCode, Number(v.Value.replace(',', '.')) / Number(v.Nominal)])
  );
  return { date, rates };
}
```

**Cache policy** (RESEARCH.md §"Caching policy"): cache-on-success in `fx_rates` table; reads always pick most-recent row; 48h staleness alert via Unisender Go.

**Docs:** https://www.cbr.ru/scripts/XML_daily.asp ; https://www.npmjs.com/package/iconv-lite ; https://www.npmjs.com/package/fast-xml-parser

---

### `server/src/http/routes/admin.scrapers.ts` (http route, REST)

**No in-repo analog.** External: Hono 4.12.x router docs https://hono.dev/docs/api/routing.

**Reference excerpt** (Hono router pattern — version-pinned at 4.12.x per CLAUDE.md stack):
```typescript
import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { requireRole } from '../middleware/auth.js';      // P6 stub returning 401 in v1

export const adminScrapers = new Hono();

adminScrapers.get('/scrapers/health', requireRole(['founder', 'sales_rep']), async (c) => {
  const data = await getScraperHealth(c.var.db);          // SQL from RESEARCH.md §"Per-Source Metrics Endpoint"
  return c.json(data);
});

adminScrapers.put('/scrapers/:source/config',
  requireRole(['founder']),
  zValidator('param', z.object({ source: z.enum(['drom-catalog','encar','beforward','che168','autohome']) })),
  zValidator('json',  z.object({
    enabled: z.boolean().optional(),
    soft_delete_hours: z.number().int().positive().nullable().optional(),
    paused_until: z.string().datetime().nullable().optional(),
  })),
  async (c) => { /* update scraper_config row */ }
);
```

**Response shape:** RESEARCH.md §"Per-Source Metrics Endpoint Contract" — `{ as_of, sources: Array<{...per-source health fields}> }`. Phase 6 admin UI consumes this.

**Auth:** stub middleware returns 401 in Phase 5; Phase 6 wires Better-Auth + RBAC.

---

### `server/src/http/routes/admin.brand-aliases.ts` (http route, CRUD)

**No in-repo analog.** Same Hono pattern as above; standard CRUD over `brand_aliases` table.

**Endpoints** (per CONTEXT.md "To Phase 6" + RESEARCH.md):
- `GET /api/admin/brand-aliases` → list (with filters by source_kind, parent_brand_slug)
- `POST /api/admin/brand-aliases` → admin override (sets `is_admin_override=true`)
- `PATCH /api/admin/brand-aliases/:id` → admin edit
- `DELETE /api/admin/brand-aliases/:id` → admin delete

---

### `server/src/db/schema/{scraperConfig,scraperRuns,brandAliases,fxRates}.ts` (drizzle schemas)

**No in-repo analog.** External: Drizzle ORM 0.45.x docs https://orm.drizzle.team/docs/sql-schema-declaration.

**Reference excerpt** (Drizzle 0.45 `pgTable` pattern):
```typescript
import { pgTable, text, boolean, integer, timestamp, jsonb, bigserial, primaryKey, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const scraperConfig = pgTable('scraper_config', {
  source:           text('source').primaryKey(),                        // 'drom-catalog'|'encar'|'beforward'|'che168'|'autohome'
  enabled:          boolean('enabled').notNull().default(true),
  pausedUntil:      timestamp('paused_until', { withTimezone: true }),
  lastBlockReason:  text('last_block_reason'),
  softDeleteHours:  integer('soft_delete_hours'),                       // null for drom-catalog
  cronExpression:   text('cron_expression').notNull(),
  proxyPoolLabel:   text('proxy_pool_label'),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// scraperRuns — see RESEARCH.md §"Schema Deltas" for full DDL; index on (source, started_at desc)
// brandAliases — UNIQUE (source_kind, canonical_slug, parent_brand_slug); flag is_admin_override
// fxRates      — PRIMARY KEY (fetched_at); INDEX (cbr_date desc); JSONB rates column
```

**Verified column DDL is in 05-RESEARCH.md §"Schema Deltas vs Phase 2"** (lines 642-700). Planner must convert that SQL to Drizzle TS — straightforward 1:1 mapping.

**Migration strategy:** drizzle-kit generate (RESEARCH.md confirms drizzle-kit is the migration tool). Migration file lives at `server/migrations/00XX_phase5_scraper_tables.sql` (auto-generated; reviewed and committed).

**Migration seeds** (D-15 defaults — RESEARCH.md lines 654-661):
```sql
INSERT INTO scraper_config (source, soft_delete_hours, cron_expression, proxy_pool_label) VALUES
  ('drom-catalog', NULL,  '0 3 1 * *',     NULL),
  ('encar',        72,    '0 */4 * * *',   'iproyal-kr-residential'),
  ('beforward',    168,   '15 */4 * * *',  NULL),
  ('che168',       72,    '30 */4 * * *',  'iproyal-cn-residential'),
  ('autohome',     72,    '45 */4 * * *',  'iproyal-cn-residential');
```

**Docs:** https://orm.drizzle.team/docs/sql-schema-declaration ; https://orm.drizzle.team/docs/kit-overview

---

### Test files (`*.test.ts`)

**No in-repo analog** (no test framework installed yet — confirmed via `package.json:devDependencies`).

**External:** Vitest 1.x docs https://vitest.dev/guide/ ; nock https://github.com/nock/nock ; @aws-sdk/client-s3-mock https://github.com/m-radzikowski/aws-sdk-client-mock.

**Setup task** (Wave 0 — RESEARCH.md §"Wave 0 gaps" lines 936-942):
```bash
npm install -D vitest @playwright/test @aws-sdk/client-s3-mock nock
# create server/vitest.config.ts
# create server/tests/conftest.ts (shared fixtures)
# record fixture pages: server/tests/fixtures/{drom,encar,beforward,che168,autohome}/page-{1,2,3}.html
# create server/tests/fixtures/cbr-xml-daily.xml (windows-1251 encoded)
```

---

## Shared Patterns (cross-cutting)

These apply to every Phase 5 file in their applicability column, sourced from RESEARCH.md.

### S1. Worker isolation (SCRAPE-08)
**Apply to:** every scraper worker (`encar.ts`, `che168.ts`, `autohome.ts`, `beforward.ts`, `dromCatalog.ts`)
**Source:** RESEARCH.md §"Browser isolation contract", §"Worker topology recommendation"
```typescript
// Every per-source run() function:
const crawler = new PlaywrightCrawler({ /* ... */ });   // or CheerioCrawler
try {
  await crawler.run(urls);
} finally {
  await crawler.teardown();   // explicit; SCRAPE-08 mandate
}
// Crawlee defaults: keepAlive=false; do not override.
// browserPoolOptions: { maxOpenPagesPerBrowser: 1, retireBrowserAfterPageCount: 50 }
```
And the systemd unit:
```ini
MemoryMax=1G
Restart=on-failure
RestartSec=5s
TimeoutStopSec=120s
```

### S2. Block-detection wrapping (D-13)
**Apply to:** every scraper worker
**Source:** RESEARCH.md §"Block-Detection Implementation Spec"
- After every fetch (HTTP or Playwright `page.content()`), call `detectBlock()`.
- Maintain in-memory `consecutiveBlocks` counter per run; reset on any non-block response.
- On count ≥ 5: call `haltSource()`, abort the run.
- On run start: read `scraper_config.paused_until`; if `> NOW()`, log + return (no fetch).

### S3. UPSERT idempotency (Pattern 3)
**Apply to:** every scraper that writes to `cars` (encar, beforward, che168, autohome) and `models` (dromCatalog)
**Source:** RESEARCH.md §"Soft-Delete Sweep Design", ARCHITECTURE.md Pattern 3
```typescript
// Drizzle UPSERT by (source, source_id) UNIQUE → bumps last_seen_at on every sighting
await db.insert(cars).values({ ...normalized, source, sourceId, lastSeenAt: new Date(), firstSeenAt: new Date() })
  .onConflictDoUpdate({
    target: [cars.source, cars.sourceId],
    set: {
      lastSeenAt: sql`NOW()`,
      isActive: true,
      // … other fields that may have updated (price, mileage, badges)
      // do NOT overwrite firstSeenAt
    },
  });
```
**Test:** running 2× over same fixture produces same row count (SCRAPE-01 acceptance).

### S4. `scraper_runs` event log emission
**Apply to:** every scraper worker + softdelete sweep
**Source:** RESEARCH.md §"Per-Source Metrics Endpoint Contract" — derive metrics from event log
- At run start: `INSERT INTO scraper_runs (source, started_at, status='running') RETURNING id`.
- Maintain in-memory counters: `pages_fetched`, `cars_seen`, `cars_added`, `cars_updated`, `images_rehosted`.
- At run end (success/partial/failed/blocked): `UPDATE scraper_runs SET ... WHERE id = $1`.

### S5. SOPS-encrypted secrets (V6 Cryptography)
**Apply to:** `infra/env.ts` (Phase 1/2 owns) — Phase 5 just consumes
**Source:** RESEARCH.md §Security Domain
- All of: `IPROYAL_PROXY_USER`, `IPROYAL_PROXY_PASS`, `CARAPIS_API_KEY`, `YC_S3_KEY`, `YC_S3_SECRET`, `UNISENDER_GO_TOKEN`, `DATABASE_URL`.
- Logger redactor strips these patterns before sending errors to GlitchTip.

### S6. Logging redaction (Info-disclosure mitigation)
**Apply to:** every worker file that catches errors
- Before stringifying any error for GlitchTip / log: strip `IPROYAL_PROXY_*`, `CARAPIS_*`, presigned-URL signatures.

### S7. Hono Zod validation
**Apply to:** every admin route file
- Use `@hono/zod-validator` with explicit Zod schemas for `param`, `query`, `json`. No raw `c.req.json()` without parse.

---

## No Analog Found / Greenfield Files

| File | Role | Reason |
|------|------|--------|
| `server/src/workers/scrapers/shared/normalize.ts` | shared module | Bespoke transform layer — no library equivalent. The output type binds to `src/crm/types.ts` `Car` shape. |
| `server/src/workers/scrapers/shared/block-detection.ts` | shared module | D-13 is a project-specific operational policy, not a library pattern. |
| `server/src/workers/scrapers/shared/aliases.ts` | shared module | Cyrillic↔Latin canonicalisation is bespoke; algorithm sketched in RESEARCH.md §"Cyrillic↔Latin Auto-Build". |
| `server/src/workers/scrapers/shared/softdelete.ts` | shared module | One bespoke SQL UPDATE per source; algorithm sketched in RESEARCH.md §"Soft-Delete Sweep Design". |
| `server/src/workers/scrapers/uss/{README.md, normalizeUssCsv.ts}` | placeholder/stub | Per PROJECT.md: USS = licensed exporter feed, NOT a scraper. Stub only. |
| `server/src/data/seed-cn-aliases.json` | static seed | Manual list of ~50 popular CN brands (BYD/Geely/Haval/Chery/etc.) → Latin canonical. RESEARCH.md §Cyrillic↔Latin "CN→Latin seed". |
| `server/tests/fixtures/**/*` | test fixtures | Recorded sample HTML pages, sanitized, per source. Generated during Wave 0. |

For these files the **planner should treat the RESEARCH.md sketches as the authoritative reference**, not look for another file in the repo to copy.

---

## Metadata

**Analog search scope:** `/Users/mikhailra/Developer/dva.pro/src/**/*.{ts,tsx}` (frontend SPA — no backend exists yet); `/Users/mikhailra/Developer/dva.pro/.planning/research/ARCHITECTURE.md` (server-tree spec).
**Files scanned:** 22 frontend files (all of `src/`); 0 backend files (none exist yet).
**Pattern extraction date:** 2026-04-27.
**Research confidence:** HIGH on shared-infra design + drom + CBR + schema deltas; MEDIUM on Encar/CN anti-bot specifics (only verified at first scrape attempt).
