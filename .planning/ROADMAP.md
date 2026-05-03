# Roadmap: DVApro

**Created:** 2026-04-26
**Last reordered:** 2026-04-27 — Phase 5 (Inventory Pipeline) promoted to Phase 1 with reduced file-output scope; Compliance & Infra demoted to Phase 2; Phases 2–4 shifted down by one. See `## Reorder Log` at bottom for rationale.
**Granularity:** standard (8 phases)
**Soft-launch target:** ≈ 2026-06-07 (4–6 weeks)
**Total v1 requirements:** 73, all mapped (100% coverage)

> Core value: посетитель проходит квиз → получает на email брендированный PDF с подобранными авто и landed-cost stub → одновременно становится квалифицированным лидом в продажной воронке. Каждая фаза существует, чтобы эта петля закрылась end-to-end на soft-launch и не нарушала 152-ФЗ.

---

## Phases

- [ ] **Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs** — Crawlee/Cheerio drom.ru/catalog scraper that writes structured JSON files + WebP images on disk; `IScraper` interface stubs for Encar / BeForward / Che168 / Autohome; no DB, no cloud, no queue — single-shot CLI script
- [ ] **Phase 2: Compliance & Infra Foundation** — Yandex Cloud `ru-central1` + Roskomnadzor notification + DNS warm-up — всё, что не ускоряется кодом и должно стартовать первым
- [ ] **Phase 3: Schema, API Skeleton & Country Registry** — Drizzle schema всех таблиц, Hono `api` + `worker` процессы, public read API, единый реестр 6 стран; importer для Phase 1 JSON → `cars`/`models`
- [ ] **Phase 4: Frontend Integration, Consent & Legal** — `CrmProvider` поверх real API + react-query, 152-ФЗ чек-бокс, `/legal/*` страницы, ИНН/ОГРН в footer
- [ ] **Phase 5: Lead Flow End-to-End (Quiz → PDF → Email)** — `POST /api/public/leads`, pg-boss pipeline, Cyrillic PDF, Unisender Go отправка с landed-cost stub
- [ ] **Phase 6: Admin Auth, RBAC & Real Admin Panel** — Better-Auth с ролями founder/sales_rep, audit_log, LeadsAdmin/CarsAdmin/SettingsAdmin поверх real DB
- [ ] **Phase 7: Public Site Polish, Multi-Market UI & Analytics** — копирайт под 6 рынков, floating widget, флаги/бейджи, Yandex Metrika + 4 цели, mobile/Yandex Browser smoke-test
- [ ] **Phase 8: Pre-Launch Checklist & Soft-Launch** — «Looks Done But Isn't» check, 2× E2E прогона, 24h мониторинг, тренинг команды

---

## Phase Details

### Phase 1: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs

**Goal:** Build a runnable scraping pipeline that produces deterministic, importable artifacts on disk — `cars.json` records and WebP images — *without* any backend infrastructure (no DB, no cloud, no queue). The drom.ru/catalog scraper is real and end-to-end; Encar / BeForward / Che168 / Autohome modules implement the same `IScraper` contract but return `{ status: 'not_implemented' }` plus a TODO log line, so the contract is locked and future fillers don't have to invent it. Output is the v1 source of truth for the catalog until Phase 3 adds an importer.
**Depends on:** ничего — стартует первой; не требует Phase 2 инфраструктуры (всё локально на dev машине)
**Requirements (v1-blocking subset of SCRAPE-*):** SCRAPE-05 (drom master models), SCRAPE-06 (image rehost — adapted: convert to WebP on disk, not S3), SCRAPE-09 (per-source health/metrics — adapted: emit run report JSON, not admin endpoint), SCRAPE-10 (Cyrillic↔Latin lookup), SCRAPE-11 (CBR FX feed — adapted: cache as JSON file, not DB row). SCRAPE-01..04 (Encar/BeForward/Che168/Autohome) are scoped to **stub-only** in this phase; full implementations deferred to v1.x.
**Success Criteria** (what must be TRUE):
  1. `pnpm scrape:drom` executes end-to-end on a fresh `git clone` (no Postgres, no Redis, no cloud creds), exits 0, and writes `data/scraped/drom/<run_id>/cars.json` + `data/scraped/drom/<run_id>/images/*.webp`. Re-running on the same day overwrites or appends without crashing.
  2. A documented JSON contract lives at `data/scraped/SCHEMA.md` (or equivalent) describing every field of a scraped car record (brand, model, generation, body, engine, year_range, price_range_rub, source, source_id, source_url, scraped_at, image_paths[], etc.) precise enough that Phase 3's importer can write a deterministic mapping to the eventual `cars`/`models` schema.
  3. `IScraper` interface is defined in `server/scrapers/types.ts` (or chosen location). Modules `server/scrapers/encar/`, `server/scrapers/beforward/`, `server/scrapers/che168/`, `server/scrapers/autohome/` each export an implementation that, when called, returns `{ status: 'not_implemented', source: '<name>', deferred_to: 'v1.x' }` and writes a TODO log line. `pnpm scrape:<source>` for any of these prints the TODO and exits non-zero (so CI / future runners can detect the stub).
  4. CBR daily FX XML is fetched once per scrape run (or cached per UTC date) and written to `data/scraped/fx/cbr-<YYYY-MM-DD>.json` as a normalized `{date, rates: {USD: ..., KRW: ..., JPY: ..., CNY: ..., EUR: ..., AED: ...}}` shape. Stale-cache fallback documented.
  5. Cyrillic↔Latin brand/model lookup is auto-built from drom catalog page parses (drom exposes both forms) and written to `data/scraped/drom/brand-aliases.json`. Re-running merges new brands into the existing file without losing manual edits (idempotent merge by `brand_slug`).
  6. Image pipeline downloads source images via the shared `http` module, converts JPEG/PNG → WebP via `sharp`, preserves original dimensions, names them `images/<brand_slug>-<model_slug>-<index>.webp`. Bandwidth/disk usage logged per run.
  7. Run report JSON (`data/scraped/drom/<run_id>/report.json`) captures: started_at, finished_at, duration_ms, pages_visited, models_added, models_updated, images_downloaded, errors[], rate_limit_hits, blocked_responses (drom should be ~0 — RU-domestic).
  8. Block-detection logic exists in shared scraper code (5+ thin/empty responses or captcha keywords → halt run, write `report.json` with `status: 'blocked'`); even though drom is unlikely to trigger it, the code is in place ready for Phase 1.x scrapers.
  9. Re-running the scraper twice in a row produces a consistent JSON dataset (idempotent). Diff between runs is bounded to expected drom-side changes.
  10. README at `data/scraped/README.md` (or repo top-level docs) explains how to run, where output lands, what stubs do, and how Phase 3's future importer should consume the JSON.
**Plans:** 16 plans across 11 waves (gap-closure plans 10–16 added per 01-VERIFICATION.md)
- [x] 01-01-PLAN.md — pnpm migration + Node-side scaffolding (tsconfig.server.json, vitest.config.ts, .gitignore)
- [x] 01-02-PLAN.md — IScraper contract + 4 stubs + CLI dispatcher (SCRAPE-01..04 stub)
- [x] 01-03-PLAN.md — Shared HTTP (got@15) + block-detection + normalize modules
- [x] 01-04-PLAN.md — Image pipeline (sharp WebP) + brand-aliases idempotent merge (SCRAPE-06, SCRAPE-10)
- [x] 01-05-PLAN.md — CBR FX feed module (SCRAPE-11)
- [x] 01-06-PLAN.md — Cursor + symlink filesystem primitives (D-15, D-08)
- [x] 01-07-PLAN.md — Drom DOM parsers + orchestrator + integration test (SCRAPE-05, SCRAPE-09)
- [x] 01-08-PLAN.md — SCHEMA.md + README.md docs (Phase 3 handoff)
- [x] 01-09-PLAN.md — Live drom smoke run gate (manual, gates Phase 1 completion)
- [x] 01-10-PLAN.md — Cursor sort-before-compare + -1-throw guards (CR-01/02/03 fix)
- [x] 01-11-PLAN.md — Cursor zod schema + CorruptCursorError (WR-04 fix)
- [x] 01-12-PLAN.md — CR-04 contract: re-scrape cursored brand + README crash-recovery rewrite
- [x] 01-13-PLAN.md — Resume-path integration tests (cursor LOGIC under cursor-present assumption; IN-07)
- [x] 01-14-PLAN.md — Image_paths reconciliation + parse/image error split + bounded image-failure abort (CR-05/06)
- [x] 01-15-PLAN.md — Per-run HTML viewer auto-emitted by orchestrator + shared report-html module
- [x] 01-16-PLAN.md — Brand-root cursor path for cross-invocation resume (BLOCKER 1 follow-up)
**Complexity:** M — narrowed scope (one real scraper + 4 stubs + shared plumbing) makes this smaller than the original Phase 5 design
**Research-spike:** YES — drom.ru/catalog access route check (`baza.drom.ru/help/API` partner API vs polite scrape — within <1wk / <$100/mo rule); Crawlee CheerioCrawler patterns for resumable backfill; sharp WebP encoding settings for dimension preservation
**Parallelisable with:** Phase 2 (Compliance & Infra) — no shared dependency surface; founder content collection
**UI hint:** no
**Notes on what was cut from original Phase 5:**
- No Drizzle schemas, migrations, or pg-boss queue (deferred to Phase 3)
- No Yandex Object Storage rehost (replaced with local WebP files on disk)
- No worker process / cron schedules (this phase is a CLI script)
- No admin metrics endpoint (replaced with `report.json` per run)
- No live Encar / BeForward / Che168 / Autohome scraping (replaced with `IScraper` stubs that lock the contract)
- No proxy budget commitments — drom is RU-domestic and runs from dev machines or a single RU VM without proxies

---

### Phase 01.2: extend-complectation-fields — capture all 8 drom comp tables via hybrid typed-core + features-bag schema, then re-scrape BMW X5 (INSERTED)

**Goal:** Extend the drom comp scraper to capture all fields from drom's 8 main complectation tables via a hybrid Strategy B schema (small typed core for compute-relevant values + a features bag for the remaining ~130 fields). Re-scrape BMW X5 so the next snapshot has complete data for Phase 03's importer.
**Requirements:** none (TBD — urgent scaffolding for Phase 03; SCOPE.md acceptance criteria used as goal-backward must_haves)
**Depends on:** Phase 1 (Phase 01.1's parser, orchestrator, cursor, polite-delay HTTP, per-run viewer)
**Plans:** 6/6 plans complete

Plans:
- [x] 01.2-01-PLAN.md — Wave 1: Schema extension (drivetrain/dimensions typed slots + chassis group + features bag)
- [x] 01.2-02-PLAN.md — Wave 2: Generic section-walker parser (typed slots + features[] from 11 drom comp sections)
- [x] 01.2-03-PLAN.md — Wave 2: HTML viewer renders 8 native drom sections from features[] in comp-detail modal
- [x] 01.2-04-PLAN.md — Wave 2: Coverage gate adds chassis (>=0.30) + features_density (>=50) floors
- [x] 01.2-05-PLAN.md — Wave 1: Capture hybrid X5 fixture (xDrive45e/50e) for parser regression coverage (autonomous: false)
- [x] 01.2-06-PLAN.md — Wave 3: Live BMW X5 re-scrape — wipe partial run + execute pnpm scrape:drom + verify gates (autonomous: false, ~5–7h)

### Phase 01.1: extend-drom-scrape-fields (INSERTED)

**Goal:** Extend the drom catalog scraper to walk per-complectation detail pages and persist a full per-trim record (six field groups: identity, pricing, drivetrain, dimensions, comfort, tires) nested inside each `ModelRecord`, validated end-to-end against a BMW-only pilot sweep with snapshot + screenshot regression goldens.
**Depends on:** Phase 01 (drom orchestrator, cheerio+zod parser pattern, cursor module, polite-delay HTTP client, snapshot golden plumbing, per-run HTML viewer all in place from plans 01..16).
**Requirements:** R-1, R-2, R-3, R-4, R-5, R-6, R-7, R-8 (locked in `01.1-SPEC.md`; ambiguity 0.13)
**Success Criteria** (what must be TRUE):
  1. `parse-complectation-page.ts` exists; unit tests pass against ≥ 3 captured BMW fixtures + ≥ 2 broken/missing-section fixtures (R-1)
  2. `Complectation` zod schema added to `server/scrapers/shared/types.ts`; `ModelRecord.complectations` is a non-optional array with `.default([])` for inheritFromPrevCurrent backward-compat (R-2, R-3)
  3. Drom orchestrator fetches per-comp pages **only** for BMW brand (`BMW_PILOT_BRANDS = new Set(['bmw'])`); non-BMW brands' generation handling unchanged (R-4)
  4. Probe-down rate limiter unit-tested: starts at 10 s, halves to 5 s after 100 OK, resets to 10 s on 429, never below 5 s (R-5)
  5. BMW pilot run produces `models.json` whose every BMW `ModelRecord` carries a non-empty `complectations[]` array AND `report.json.field_coverage` with all six groups ≥ 0.70 (R-2, R-7)
  6. Run completes with `final_status: 'ok'` even when individual per-comp pages have missing or broken sections — the per-comp parser is fail-soft (`safeParse`, never throws); failures emit `_extraction_errors[]` annotation (R-6)
  7. `bmw-pilot.test.ts` snapshot locks per-field-group coverage (six rates rounded to 2 dp); CI fails on snapshot mismatch (R-8)
  8. `bmw-pilot-viewer.png` screenshot golden locks HTML viewer rendering of complectation fields via puppeteer + pixelmatch + pngjs (devDep-only); CI fails on > 0.5 % image diff (R-8)
**Plans:** 10/10 plans complete
- [x] 01.1-01-PLAN.md — Wave 0: pnpm add -D puppeteer + pixelmatch + pngjs + @types/*; --capture-fixture CLI; capture 3 live + 2 hand-edited BMW fixtures (checkpoint:human-verify)
- [x] 01.1-02-PLAN.md — Wave 1: Complectation zod sub-schema + ModelRecord.complectations + ReportSummary.field_coverage + complectation-schema.test.ts (R-2, R-3)
- [x] 01.1-03-PLAN.md — Wave 1: ProbeDownLimiter pure module + http.ts wiring + rate-limiter.test.ts (R-5)
- [x] 01.1-04-PLAN.md — Wave 2: coverage.ts (computeFieldCoverage + meetsCoverageGate) + coverage.test.ts (R-7)
- [x] 01.1-05-PLAN.md — Wave 2: parseComplectationPage fail-soft + extractTrimRows + parse-complectation-page.test.ts (R-1, R-3, R-6)
- [x] 01.1-06-PLAN.md — Wave 1: cursor.ts gains lastComplectationIndex (D-01..D-04) + cursor.test.ts forward+backward-compat
- [x] 01.1-07-PLAN.md — Wave 3: drom/index.ts BMW filter + per-comp loop + engine cross-walk + per-trim cursor + coverage emit + drom-integration.test.ts (R-4, R-6, R-7)
- [x] 01.1-08-PLAN.md — Wave 4: report-html.ts Комплектации section + Coverage tiles + bmw-pilot.test.ts snapshot golden (R-8 snapshot half)
- [x] 01.1-09-PLAN.md — Wave 5: bmw-pilot-viewer.test.ts puppeteer+pixelmatch screenshot golden + SCHEMA.md/README.md docs + manual BMW pilot run gate (R-8 PNG half + R-2/R-4/R-7 manual end-to-end)
**Complexity:** M — pure extension of an in-flight scraper; every new module mirrors a Phase 01 analog (RESEARCH.md confidence HIGH)
**Research-spike:** Researched 2026-04-29 (`01.1-RESEARCH.md`); HIGH confidence; live-verified DOM against `/catalog/bmw/x5/207354/`; standard stack locked: puppeteer 24.42 + pixelmatch 7.2 + pngjs 7.0 (devDeps for one screenshot test)
**Parallelisable with:** Phase 2 (Compliance & Infra) — no shared dependency surface; founder content collection
**UI hint:** no — operator HTML viewer extension only
**Notes:**
- BMW-only by SPEC R-4; multi-brand sweep deferred to v1.x
- Probe-down rate-limit floor 5 s is hardcoded (SPEC C-1); CLI override deferred
- baza.drom.ru classifieds scraper for "average price" is NOT in scope — separate site, separate phase
- Drom partner-API spike (D-04 from 01-CONTEXT.md) kept deferred — re-evaluate after BMW pilot ships if multi-brand expansion is desired

---

### Phase 2: Compliance & Infra Foundation

**Goal:** Поднять российскую инфраструктуру и юридический фундамент так, чтобы ни одна последующая фаза не блокировалась 152-ФЗ или email-deliverability календарём.
**Depends on:** ничего — calendar-bound, может стартовать параллельно с Phase 1
**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. Yandex Cloud проект в `ru-central1` отвечает: managed Postgres 16 кластер с `ru_RU.UTF-8` collation подключается из локальной dev-машины и из staging VM
  2. Уведомление в Роскомнадзор об обработке ПДн подано через pd.rkn.gov.ru, подтверждение получено и сохранено
  3. DNS-записи `dva.pro` (SPF + DKIM + DMARC) валидируются в mxtoolbox; запущен 14-дневный warm-up Unisender Go (день 1 — фаундерские ящики + базовый transactional шаблон)
  4. GitLab CI с self-hosted runner на Yandex Compute VM деплоит «hello-world» Hono image из `master` в staging и production environments
  5. GlitchTip и приватный Object Storage bucket с signed-URL-only доступом подняты; foreign SaaS observability нигде не подключён
**Plans**: TBD
**Complexity:** L (calendar-bound, не код-bound)
**Research-spike:** YES — Yandex Cloud post-2026-05-01 pricing tier confirmation; Roskomnadzor operator-identity question (какой ИНН/ОГРН какого юрлица оператор ПДн); Unisender Go warm-up calendar и шаблон transactional template
**Parallelisable with:** Phase 1 (scraping is fully local), founder content collection
**UI hint:** no

---

### Phase 3: Schema, API Skeleton & Country Registry

**Goal:** Развернуть бэкенд-скелет (Hono `api` + `worker`), все Drizzle-схемы и public read API так, чтобы P4 (frontend integration) и P5 (lead flow) могли строиться параллельно по реальному контракту. Включает importer для Phase 1 JSON → `cars`/`models` так, что admin и quiz сразу работают на реальных данных drom.
**Depends on:** Phase 2 (нужны provisioned PG + image registry + GitLab CI), Phase 1 (JSON contract + drom output) — soft dependency: importer reads Phase 1 artifacts but Phase 3 schema can be designed in parallel as long as the JSON contract from Phase 1 §SC-2 is locked first
**Requirements:** API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. `api` и `worker` процессы запускаются из одного Docker image и деплоятся в Yandex Cloud; `/healthz` возвращает 200
  2. Drizzle migrations применены: существуют таблицы `cars`, `models`, `leads`, `users`, `sessions`, `audit_log`, `consent_log`, `faq`, `reviews`, `feed`, `timeline`, `settings`
  3. Country registry экспортирует 6 рынков (`kr`, `jp`, `cn`, `us`, `ae`, `eu`) с `scraperReady` flag; SPA импортирует именно отсюда — `grep` по `'jp' | 'cn' | 'kr'` в `src/` возвращает 0 совпадений
  4. Public read endpoints (`GET /api/public/{cars,faq,reviews,feed,timeline,settings}`) возвращают данные с TS-типами, разделяемыми между сервером и фронтом через `packages/shared`
  5. Все public/admin endpoints валидируют payload через Zod; невалидный payload даёт HTTP 400 со структурированной ошибкой (`{code, field, message}`)
  6. Importer (`pnpm import:scraped`) reads Phase 1 JSON output and upserts `models` + `cars` rows by `(source, source_id)`; rehosts WebP images from `data/scraped/.../images/*.webp` to Yandex Object Storage; idempotent on re-run
**Plans**: TBD
**Complexity:** M
**Research-spike:** no — Drizzle schema механически выводится from ARCHITECTURE.md
**Parallelisable with:** Phase 1 finishes the JSON contract before importer is locked; PDF template design draft (можно начинать как только schema готова); founder content writing
**UI hint:** no

---

### Phase 4: Frontend Integration, Consent & Legal

**Goal:** Перевести фронт с in-memory `CrmProvider` на real API и закрыть 152-ФЗ surface (consent UI + legal pages + ИНН/ОГРН) до того, как первая публичная форма пойдёт в продакшен.
**Depends on:** Phase 3 (нужны public read API + shared types)
**Requirements:** LEGAL-01, LEGAL-02, LEGAL-03, LEGAL-04, LEGAL-05
**Success Criteria** (what must be TRUE):
  1. `CrmProvider` rewritten поверх react-query + `src/api/`; ни один `*Admin.tsx` или `sections/*` не изменил импорта/контракта `useCrm()` (audit diff)
  2. Чек-бокс «Согласие на обработку ПДн» появляется на квиз-finish и callback-форме, default unchecked, кнопка submit задизейблена пока он не отмечен; сервер отклоняет submit без флага
  3. Каждое consent-событие пишется в `consent_log` (timestamp, IP, user-agent, версия текста политики) — проверяется ручным submit + SQL-запросом
  4. Страницы `/legal/personal-data-policy` и `/legal/offer` доступны из footer и из каждой формы; рендерятся с реальным юридическим текстом
  5. Footer на каждой публичной странице отображает ИНН + ОГРН + полное наименование юр.лица + юр.адрес
**Plans**: TBD
**Complexity:** M
**Research-spike:** no — стандартный pattern (CrmProvider rewrite + form validation + content)
**Parallelisable with:** Phase 5 lead-flow backend work (pipeline на бэке можно строить пока фронт мигрирует), founder content
**UI hint:** yes

---

### Phase 5: Lead Flow End-to-End (Quiz → PDF → Email)

**Goal:** Закрыть «money flow» — посетитель проходит квиз → лид в БД → PDF в S3 → email в inbox с подписями фаундеров и landed-cost stub. Это сердце продукта; всё остальное декорация.
**Depends on:** Phase 2 (DNS warm-up, S3 bucket), Phase 3 (`leads` schema + queue tables + cars from drom importer), Phase 4 (consent UI собирает согласие до сабмита)
**Requirements:** LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06, LEAD-07, LEAD-08, PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, MAIL-01, MAIL-02, MAIL-03, MAIL-04, MAIL-05
**Success Criteria** (what must be TRUE):
  1. Тестовый посетитель проходит 5-вопросный квиз, видит SuccessStep «PDF придёт в почту в течение 5 минут», получает HTTP-ответ <100мс и `{queued: true}`
  2. PDF приходит на @yandex.ru / @mail.ru / @rambler.ru / @gmail.com inbox (не Spam), весит ≤ 2MB, содержит подобранные авто + подписи Дениса+Алексея + landed-cost stub + дисклеймер «предварительная оценка» на каждой странице с ценой
  3. CI Cyrillic-fixture тест («Денис Сахаров — заявка №12345 от 26.04.2026») проходит — никаких `□` в rendered PDF тексте; все веса/стили шрифта зарегистрированы явно
  4. `leads` row сохраняется до того, как PDF/email отрабатывают; failed PDF render → `pdf_failed`, failed email → `email_failed`, admin (founder mailbox) уведомлён; повторный submit с тем же idempotency key не создаёт новый лид
  5. Sales-channel (founder mailbox) получает BCC каждого лид-email; matcher выдаёт ≥1 авто из admin-curated fallback / model-DB (drom data, imported in Phase 3) даже когда live inventory ещё пуст
**Plans**: TBD
**Complexity:** L
**Research-spike:** YES — Cyrillic font selection (Inter vs PT Sans vs IBM Plex Sans + license check); Unisender Go transactional template format и inbox-placement smoke test против @yandex.ru/@mail.ru/@rambler.ru
**Parallelisable with:** Phase 6 admin polish (но не leads-admin — она ждёт auth)
**UI hint:** yes

---

### Phase 6: Admin Auth, RBAC & Real Admin Panel

**Goal:** Дать founders + sales reps аутентифицированный доступ к real-DB админке с ролевой моделью и audit-log; без этого LeadsAdmin не имеет права жить в проде, потому что лиды — PII.
**Depends on:** Phase 3 (`users`, `sessions`, `audit_log` schema + drom-imported cars/models), Phase 5 (real `leads` table уже наполняется)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. Каждый user логинится по email+password (Argon2id, sessions в Postgres) ИЛИ через magic-link, доставляемый в @yandex.ru/@mail.ru/@rambler.ru/@gmail.com inbox (не Spam); founder может отозвать любую сессию мгновенно; нет shared logins
  2. RBAC enforced: `founder` видит SettingsAdmin/UsersAdmin, `sales_rep` — только Leads + Cars CRUD; попытка sales_rep дёрнуть settings endpoint даёт 403
  3. LeadsAdmin показывает leads из real DB, sales rep может изменить status (`new` → `in-progress` → `pdf-sent` → `closed`), приложить заметки, открыть PDF по signed URL, триггерить PDF re-send
  4. CarsAdmin поддерживает `is_admin_curated=true` (защищено от scraper-overwrite), hide-from-public, manual add; FaqAdmin/ReviewsAdmin/FeedAdmin/TimelineAdmin поддерживают CRUD на свои content collections
  5. Каждая admin-мутация (leads/cars/settings/faq/reviews/feed/timeline/users) пишется в `audit_log` (actor, entity, before, after, timestamp, IP); SettingsAdmin валидирует `liveCount` ∈ (0, 9999], отвергает timestamps в будущем, computes feed timestamps server-relative
**Plans**: TBD
**Complexity:** M
**Research-spike:** YES — Better-Auth + Hono integration specifics (адаптер, cookie attrs, magic-link template); magic-link inbox-placement test plan
**Parallelisable with:** Phase 7 content polish
**UI hint:** yes

---

### Phase 7: Public Site Polish, Multi-Market UI & Analytics

**Goal:** Завершить публичный фронт под обещанные 6 рынков, поставить Yandex Metrika с целями и довести site до launch credibility (founder content, real reviews, mobile, Yandex Browser).
**Depends on:** Phase 4 (`CrmProvider` уже на real API), Phase 3 (drom-imported cars в каталоге), Phase 6 (admin может править content live)
**Requirements:** CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, CONTENT-06, CONTENT-07, CONTENT-08, CONTENT-09, CONTENT-10, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03
**Success Criteria** (what must be TRUE):
  1. Hero/Catalog/Founders/FAQ копирайт упоминает все 6 рынков (USA, UAE, Europe, China, Korea, Japan); US/AE/EU явно помечены «под индивидуальный заказ»; Catalog filter pills включают все 6 с disabled/«coming soon» стилем для рынков без скрейпера; `FlagFor` рендерит 6 флагов
  2. Floating widget (Telegram + WhatsApp + phone + callback-request CTA) появляется на каждой публичной странице; callback пишется как `Lead` с `source='callback'`
  3. Реальные founder bios+фото заменили placeholder в `src/crm/seed.ts`; ≥6 реальных отзывов в Reviews (или секция спрятана); ≥12 авто в каталоге (drom-imported или admin-curated); FAQ ≥10 пунктов покрывает оплату/безопасность/152-ФЗ/СБКТС/ЭПТС/утильсбор/«под индивидуальный заказ»
  4. Сайт проходит mobile audit (desktop+mobile, последние 2 версии Chrome/Safari/Firefox/Edge + Yandex Browser desktop+mobile); car status badges используют typed enum (`in_transit`, `in_stock`, `to_order`, `auction`), admin не может ввести freeform
  5. Yandex Metrika установлена на всех публичных страницах; цели `open_quiz`, `complete_quiz_q5`, `submit_lead`, `pdf_downloaded` срабатывают в test-сессии и видны в Metrika funnel report; founder имеет логин с доступом
**Plans**: TBD
**Complexity:** M
**Research-spike:** no — стандартные UX/QA/Metrika задачи
**Parallelisable with:** Phase 6 admin polish; founder content writing завершается здесь
**UI hint:** yes

---

### Phase 8: Pre-Launch Checklist & Soft-Launch

**Goal:** Запустить «Looks Done But Isn't» verification gate из PITFALLS.md, прогнать E2E с реальными людьми, наблюдать первые 24 часа реального трафика, обучить команду daily-rhythm.
**Depends on:** Phase 7 (site complete) — gate, не creative work
**Requirements:** LAUNCH-01, LAUNCH-02, LAUNCH-03, LAUNCH-04
**Success Criteria** (what must be TRUE):
  1. Pre-launch checklist (PITFALLS «Looks Done But Isn't» — 21 пункт) пройден с founder sign-off; отчёт в `.planning/transitions/`
  2. Два E2E прогона (founder + 1 external user) завершены: квиз → PDF в inbox → admin видит лид → admin может re-send PDF; обе сессии задокументированы
  3. Первые 24 часа реального трафика мониторятся: GlitchTip без error spike, Yandex Postmaster без email-deliverability incident, scraper `last_success_at` не «красный»; incident-response runbook готов
  4. Founders + sales reps обучены: daily live-feed edit rhythm (5–7 событий/день), lead triage flow, как re-send PDF, как читать audit_log; training session задокументирован
**Plans**: TBD
**Complexity:** S
**Research-spike:** no
**Parallelisable with:** ничего — это финальный gate
**UI hint:** no

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Inventory Scrapers (drom + stubs, JSON/WebP) | 16/16 | Complete | 2026-04-29 |
| 01.1. extend-drom-scrape-fields | 10/10 | Complete   | 2026-04-30 |
| 2. Compliance & Infra Foundation | 0/0 | Not started | — |
| 3. Schema, API Skeleton & Country Registry | 0/0 | Not started | — |
| 4. Frontend Integration, Consent & Legal | 0/0 | Not started | — |
| 5. Lead Flow End-to-End (Quiz → PDF → Email) | 0/0 | Not started | — |
| 6. Admin Auth, RBAC & Real Admin Panel | 0/0 | Not started | — |
| 7. Public Site Polish, Multi-Market UI & Analytics | 0/0 | Not started | — |
| 8. Pre-Launch Checklist & Soft-Launch | 0/0 | Not started | — |

---

## Sequencing & Parallelisation Notes

**Hard sequence (calendar-bound):**
- Phase 1 (drom scraper → JSON/WebP) и Phase 2 (Compliance & Infra) стартуют параллельно в неделю 1 — у них нет общей dependency surface. Phase 1 локальный, Phase 2 — Roskomnadzor 5-day window + Unisender Go 14-day warm-up в фоне.
- Phase 01.1 (per-trim deep-dive) follows Phase 01; runs locally, no infra dependency. Inserted post-Phase-01 to bring complectation data into the JSON contract Phase 03 importer will consume.
- Phase 3 schema до Phase 4 frontend rewrite — иначе CrmProvider пишется против моков, а потом переписывается дважды. Phase 3 importer закрывает Phase 1 → DB переход.
- Phase 4 consent UI до того, как любая публичная форма пойдёт live в Phase 5 — 152-ФЗ irreversible.
- Phase 5 lead flow до Phase 6 (admin auth) — leads нужны до того, как LeadsAdmin может что-то показать.
- Phase 6 admin auth до того, как LeadsAdmin пойдёт live — leads = PII, нужен audit + RBAC gate.
- Phase 7 → Phase 8 — content/QA/analytics до launch checklist.

**Parallel tracks (config has parallelization=true):**
- **Phase 1 + Phase 2 в неделю 1** — независимые dependency surfaces. Phase 1 локальный, не требует Yandex Cloud; Phase 2 — pure infra/compliance.
- **Phase 01.1 + Phase 2** — also independent. Phase 01.1 is local-only (drom + dev machine); Phase 2 is pure infra/compliance.
- **Founder content** (биографии, фото, отзывы, видео-pitch) — pure content, можно начинать в Phase 1 и завершать в Phase 7; не блокирует никакую код-фазу.
- **PDF template design draft** — стартует как только schema из Phase 3 готова, готовится параллельно с Phase 4.
- **Phase 6 admin polish (CarsAdmin / FaqAdmin / ReviewsAdmin)** — может стартовать параллельно с Phase 5 backend (leads-admin ждёт auth, но cars/faq/reviews не требуют lead-flow).
- **Unisender Go warm-up + DNS reputation monitoring** — продолжаются как фоновая задача с Phase 2 до Phase 8.

---

## Calendar Sanity Check (4–6 weeks → soft-launch ≈ 2026-06-07)

| Week | Primary work | Parallel track |
|------|--------------|----------------|
| 1 (Apr 27 – May 3) | Phase 1 (drom scraper + stubs end-to-end) + Phase 2 (infra + Roskomnadzor подача + DNS warm-up start) | Founder content kickoff |
| 2 (May 4 – May 10) | Phase 01.1 (extend-drom-scrape-fields BMW pilot) + Phase 3 (schema + API skeleton + country registry + Phase 1 importer) | Phase 4 prep, PDF template design |
| 3 (May 11 – May 17) | Phase 4 (CrmProvider rewrite + consent + legal) + Phase 5 start (PDF pipeline) | Phase 6 admin scaffolding |
| 4 (May 18 – May 24) | Phase 5 finish (E2E lead flow на yandex.ru/mail.ru) | Phase 6 auth scaffolding |
| 5 (May 25 – May 31) | Phase 6 (auth + admin) | Phase 7 content + analytics |
| 6 (Jun 1 – Jun 7) | Phase 7 finish (mobile + Yandex Browser + Metrika) + Phase 8 (checklist + E2E + training + launch) | — |

**Risk lines:**
- If drom partner API onboarding > 1 week → fall back to polite scrape (Cheerio + 1 req/10–15s); already covered by D-05 in old Phase 5 context (carries forward).
- If Unisender Go warm-up has spam complaints in week 2 → tighten DMARC `p=quarantine` + delay first prod-email до week 3.
- Live scrapers (Encar/BeForward/Che168/Autohome) explicitly v1.x — Phase 1 ships only stubs. CONTENT-07 (≥12 авто в каталоге) covered by drom-imported models + admin-curated cars in Phase 6.
- Phase 01.1 BMW pilot run is real-network 5–7h continuous; if drom rate-limits at 5 s probe-down floor, run aborts and re-attempts; budgeted in week 2 alongside Phase 3 schema work.

---

## Out of v1 Roadmap (deferred to post-soft-launch)

- **Live scrapers for Encar / BeForward / Che168 / Autohome** — Phase 1 ships `IScraper` stubs only; full implementations (Crawlee + Playwright + residential proxies + Carapis fallback) deferred to v1.x
- **Multi-brand drom catalog deep-dive beyond BMW** — Phase 01.1 ships BMW only; multi-brand expansion deferred to v1.x
- **`baza.drom.ru` classifieds aggregator for "average price"** — separate site with separate bot-detection profile; future phase
- **Drom partner API spike** — kept deferred from Phase 01-D-04; re-evaluate after Phase 01.1 BMW pilot ships
- **Structured tire spec parsing** (`225/65R17 102H` → `width / aspect / diameter / load_index / speed_rating`) — deferred to v1.x or to Phase 03's importer
- Bitrix24 sync (BITRIX-01..04)
- US/UAE/Europe scrapers (SCRAPE-EXPAND-01..03)
- Real customs/utilsbor formulas (CUSTOMS-01)
- EN locale (EN-01)
- Admin moderation queue, PDF preview inline, CDN (MODERATE-01, PDF-PREVIEW-01, CDN-01)

These are tracked in REQUIREMENTS.md v2 and surface as separate milestones after soft-launch metrics validate priority.

---

## Reorder Log

**2026-04-27 — Phase 5 → Phase 1 promotion + scope reduction**

Original ordering had Inventory Pipeline (Encar + drom + JP/CN scrapers + Crawlee fleet + residential proxies + Yandex Object Storage rehost + pg-boss queue) as Phase 5, depending on Phases 1 (infra) and 2 (DB schema). New ordering pulls scraping forward as Phase 1 with a much smaller scope:

- **Drom.ru/catalog only** — full implementation, but writes to local JSON files + WebP images on disk (no DB, no S3, no queue)
- **Encar / BeForward / Che168 / Autohome** — `IScraper` interface stubs only (full implementations deferred to v1.x)
- **No infrastructure dependency** — runs on a fresh `git clone` without Postgres/Redis/cloud creds
- **DB integration** — moved to new Phase 3 (formerly Phase 2) as a separate `pnpm import:scraped` job that reads Phase 1 artifacts

Renumber map:
- Old 5 → New 1 (rewritten scope)
- Old 1 → New 2 (Compliance & Infra) — unchanged scope
- Old 2 → New 3 (Schema + API + importer) — added importer success criterion
- Old 3 → New 4 (Frontend + Consent) — depends_on bumped 2 → 3
- Old 4 → New 5 (Lead Flow) — depends_on bumped 1→2, 2→3, 3→4
- Old 6 → 6, Old 7 → 7, Old 8 → 8 — depends_on bumped accordingly

The 8 plans created against the old Phase 5 (DB+S3-coupled) were discarded; the new Phase 1 will be re-planned via `/gsd-discuss-phase 1` → `/gsd-plan-phase 1`. The old `05-RESEARCH.md` content (Crawlee/Playwright/Cheerio research, drom rate limits, source posture analysis, proxy economics) is partially still valuable but has been removed alongside the old plans — research-spike will redo what's needed for the narrower scope.

**2026-04-29 — Phase 01.1 inserted (extend-drom-scrape-fields)**

After Phase 01 closed (16/16 plans complete), founder requested extension of the drom scraper to walk per-complectation detail pages and capture six field groups (identity / pricing / drivetrain / dimensions / comfort / tires) per trim. Inserted as Phase 01.1 between Phase 01 and Phase 02 — fully local, no infra dependency, parallelisable with Phase 02 calendar work. Scoped to BMW-only pilot (~2000 per-comp pages, 5–7h continuous) per SPEC R-4; multi-brand expansion deferred to v1.x. 9 plans across 6 waves; SPEC.md (R-1..R-8, ambiguity 0.13), CONTEXT.md (D-01..D-08), RESEARCH.md, PATTERNS.md, VALIDATION.md all locked 2026-04-29.

---
*Last updated: 2026-04-29 — Phase 01.1 plans landed by gsd-planner*
*Original roadmap: 2026-04-26 — initial creation by gsd-roadmapper*
