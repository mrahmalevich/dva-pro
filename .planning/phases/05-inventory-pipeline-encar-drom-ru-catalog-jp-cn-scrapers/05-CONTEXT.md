# Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers) - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the **shared scraper infrastructure** (worker harness, normalize/images/http modules, image rehost to Yandex Object Storage, soft-delete via `last_seen_at`, CBR FX feed, per-source health metrics, Cyrillic↔Latin brand/model lookup table) **plus the drom.ru/catalog master-models populator** end-to-end as the v1-blocking minimum.

Live inventory scrapers (Encar KR, BeForward JP, Che168 CN, Autohome CN) are best-effort with a hard May 31 deferral cutoff to v1.x. They are built in priority order on top of the shared plumbing once drom is stable.

**Out of phase (handled elsewhere):**
- Phase 4 lead-flow matcher logic — reads from `cars` and `models`; not built here
- Phase 6 admin UI for scraper metrics, per-source soft-delete configuration, brand-alias overrides, manual car curation — endpoints exposed by P5, UI built in P6
- USS Auctions scraper — explicitly OUT (locked at PROJECT.md level; data path is licensed exporter feed, not a scraper)
- US/UAE/Europe scrapers — v2 (SCRAPE-EXPAND-01..03)

</domain>

<decisions>
## Implementation Decisions

### Proxy + Paid-API Economics
- **D-01:** Monthly residential proxy ceiling for KR + CN combined: **$300/mo**. Researcher selects vendor + tier within this envelope.
- **D-02:** Single-vendor preferred over best-of-breed; up to **+15% premium (~$345/mo)** is acceptable to keep one bill, one dashboard, one auth flow (lower v1 ops surface).
- **D-03:** **Carapis paid Encar API = backup-only.** Build self-hosted Crawlee+Playwright Encar scraper first. **Auto-flip rule:** if Encar fingerprinting blocks progress for >3 calendar days during P5 execution, executor switches to Carapis without further founder approval.
- **D-04:** **BeForward (JP) runs from the RU datacenter** (same Yandex Compute VM as the worker) with a polite 1 req/3-5s rate-limit. No JP residential proxy line item.

### drom.ru/catalog Access Route
- **D-05:** **Research-first decision** for drom path. Researcher checks `baza.drom.ru/help/API` ToS, fees, and onboarding latency. **Rule:** if the partner API is reachable in <1 week and costs <$100/mo, use it; otherwise fall back to polite scrape (Cheerio + 1 req/10-15s + robots.txt + Crawl-delay respect).
- **D-06:** **Comprehensive scope** for the master-models pull — entire drom catalog, all brands, all generations. **CALENDAR RISK:** initial backfill is realistically 1-2 weeks of polite scraping. Researcher flags if partner API enables faster bulk pull.
- **D-07:** Post-backfill refresh cadence: **monthly full re-scrape** (downgrade from SCRAPE-05's "weekly" wording — model-fact data drifts slowly enough). Bumps to weekly automatically if the partner API supports delta queries.
- **D-08:** **Cyrillic↔Latin brand/model lookup table** (SCRAPE-10) is **auto-built from drom catalog** (which exposes both forms in the same page). Phase 6 admin can override individual entries per-row; auto-built rows lose to admin overrides.

### Ship-Order & v1 Commitment
- **D-09:** Binding **build order:** `drom → Encar → BeForward → Che168 → Autohome`. Front-loads the safest source (drom is RU-domestic, no proxy, lowest ban risk), unlocks the Phase 4 matcher fallback first, then stress-tests `shared/normalize/images/http` against the highest-difficulty source (Encar) before easier ones inherit it.
- **D-10:** **Ship floor:** drom master-models DB live + full shared plumbing. **All 4 live scrapers (Encar, BeForward, Che168, Autohome) are best-effort and acceptable to ship in v1.x.** This reclassifies requirements:
  - **v1-blocking:** SCRAPE-05, SCRAPE-06, SCRAPE-07, SCRAPE-08, SCRAPE-09, SCRAPE-10, SCRAPE-11
  - **Best-effort with May 31 cutoff:** SCRAPE-01 (Encar), SCRAPE-02 (BeForward), SCRAPE-03 (Che168), SCRAPE-04 (Autohome)
  - REQUIREMENTS.md traceability needs an updater pass after this phase to record the v1.x re-scoping.
- **D-11:** **Defer trigger:** any live scraper not producing valid UPSERTs by **end of week 5 (May 31)** is automatically deferred to v1.x. Week 6 reserved for Phase 7 polish + Phase 8 launch checklist; no extension.
- **D-12:** **Shared-infra v1 scope:** ship `shared/normalize.ts` + `shared/images.ts` + `shared/http.ts` + image rehost to Yandex Object Storage + soft-delete via `last_seen_at` + CBR FX feed + per-source worker isolation pattern (`MemoryMax=1G`, fresh browser per run, explicit `browser.close()`) + drom integration end-to-end + Cyrillic↔Latin lookup auto-build + per-source metrics endpoint. **No live scraper is required to be "proven" for P5 to exit.** v1.x team builds Encar fresh on top of these abstractions.

### Operational Policy
- **D-13:** **Block-detection response:** when worker sees ≥5 consecutive thin/empty responses or captcha keywords (`验证`, `보안 인증`, `robot`), it **auto-halts the source's cron** (`paused_until = now() + 24h`), emails founder via Unisender Go transactional, marks `last_run_status='blocked'` in metrics, then **auto-resumes after 24h with rotated proxy**. No further requests during the cooldown.
- **D-14:** **Moderation gate = auto-publish.** New scraped cars become public immediately. `needs_review=true` field exists for filtering in CarsAdmin (Phase 6) but does not block visibility. Admin hides bad cars reactively via `is_active=false`. Matches research recommendation in ARCHITECTURE.md Stub-vs-Build table.
- **D-15:** **Soft-delete window N is configurable per-source via Phase 6 SettingsAdmin.** Phase 5 ships with sane defaults baked into the migration:
  - Encar / Che168 / Autohome: **72h** (auction-flavor sources, fast-moving inventory)
  - BeForward: **7 days** (catalogue-style, slower turnover)
  - drom (`models`): **N/A** (model facts don't go stale)
- **D-16:** **Image rehost format:** convert source images (JPEG/PNG) to **webp via sharp on download**, keep original dimensions. Saves ~40% bandwidth, faster public UI on mobile, smaller PDF embed sizes (relevant for PDF-05's 2MB cap). Yandex Browser supports webp on all targeted versions.

### Claude's Discretion
The following are explicitly delegated to the researcher and planner — no founder pre-binding:
- Specific residential proxy vendor (within $300 + 15% premium ceiling)
- drom.ru partner API vs scrape path (within the <1wk / <$100/mo rule)
- Worker topology (single worker process running all pg-boss schedulers vs per-source worker container) — planner picks based on Yandex Compute VM sizing
- Cron mechanism (pg-boss recurring jobs vs OS cron) — planner picks
- BeForward HTML parser shape (Cheerio vs minimal Playwright) — research-spike
- Per-source cron cadence specifics for live scrapers (within "live scrapers are best-effort" constraint)
- CBR FX fallback behavior when CBR XML unreachable (planner picks: cache-last-known-good vs hard-fail)
- Image storage path layout under `images/cars/{source}/{source_id}/` — researcher confirms

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level constraints (read first)
- `.planning/PROJECT.md` — locked stack (Hono 4.12 + Drizzle 0.45 + pg-boss + Crawlee/Playwright 1.59), 152-ФЗ posture, USS exclusion, anti-features
- `.planning/REQUIREMENTS.md` §Inventory Scrapers — SCRAPE-01..SCRAPE-11 source-of-truth wording (note: D-10 reclassifies SCRAPE-01..04 as best-effort)
- `.planning/ROADMAP.md` §Phase 5 — goal, success criteria, dependencies, research-spike list, calendar sanity check (esp. risk-line on Encar fingerprint > 3 days and CN scraper deferral to v1.x)
- `.planning/STATE.md` — current position + accumulated decisions

### Research artifacts (consume during planning + research)
- `.planning/research/STACK.md` — Crawlee 3.x + Playwright 1.59 (Firefox engine recommended for stricter Chromium-targeted bot detection), pg-boss vs BullMQ tradeoff, Yandex Object Storage S3 endpoint
- `.planning/research/ARCHITECTURE.md` §Pattern 3 (Source-Attributed Inventory with Soft-Deletes), §Pattern 4 (Job Queue as Async Boundary), §`cars` schema, §`models` schema, §Storage Layout, §Stub-vs-Build (auto-publish recommendation), §Anti-Pattern 1 (no live-scraping on quiz submission), §Anti-Pattern 4 (no hot-linking source images)
- `.planning/research/PITFALLS.md` Pitfall 3 (Encar/Che168/Autohome single-IP ban — proxy strategy specifics, headless browser requirement, block-detection thresholds), Pitfall 4 (USS legal/relationship blowback — confirms USS exclusion), Pitfall 7 (drom.ru partner API check — research-spike anchor)
- `.planning/research/FEATURES.md` — table-stakes inventory features
- `.planning/research/SUMMARY.md` — synthesized P0-P7 critical path with proxy-budget tension flag

### Schema dependencies (built in Phase 2, consumed here)
- Phase 2 produces `cars` table with `(source, source_id)` UNIQUE constraint, `is_active`, `is_admin_curated`, `needs_review`, `first_seen_at`, `last_seen_at`, `image_key`, `price_local`, `price_local_ccy`, `price_rub_est`, `model_id` columns (per ARCHITECTURE.md schema sketch)
- Phase 2 produces `models` table with `(brand_slug, model_slug, generation)` UNIQUE, `description_ru`, `body_types`, `engine_options`, `price_min_rub`, `price_max_rub` columns
- Phase 2 produces pg-boss schema (auto-created)
- Phase 1 provisions `dvapro-prod` Yandex Object Storage bucket; image path layout `images/cars/{source}/{source_id}/{primary|02|...}.webp`

### External docs (research-spike will validate)
- `https://baza.drom.ru/help/API` — drom partner API ToS, fees, onboarding (D-05 trigger)
- `https://docs.carapis.com/parsers/encar.com/intro` — Carapis Encar fallback API spec (D-03 trigger)
- `https://www.cbr.ru/scripts/XML_daily.asp` — CBR daily FX XML feed (SCRAPE-11)
- `https://crawlee.dev/` — Crawlee 3.x docs (PlaywrightCrawler + CheerioCrawler API)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **None directly applicable in `src/`** — Phase 5 lives entirely in the new `server/` tree (per ARCHITECTURE.md). The frontend `Country` enum at `src/crm/types.ts:1` (`'jp' | 'cn' | 'kr'`) is extended in Phase 2 to all 6 markets via the country registry; Phase 5 writes `cars.country` values that match that registry.
- The frontend `Car` interface at `src/crm/types.ts:4` defines public fields (`brand`, `model`, `year`, `country`, `mileage`, `body`, `drive`, `fuel`, `transmission`, `price`, `priceLocal`, `badges`, `accent`, `eta`, `spec`, `img`) — Phase 5's `normalize()` output must populate the corresponding server-side fields so the frontend's existing UI renders unchanged.

### Established Patterns
- **Pattern 3 (Source-Attributed Inventory with Soft-Deletes)** — every scraped row carries `(source, source_id, source_url, last_seen_at)`; UPSERT by `(source, source_id)`; cars not seen for N hours get `is_active=false`. Phase 5 must enforce this for every source it ships.
- **Pattern 4 (Job Queue as Async Boundary)** — pg-boss recurring jobs trigger scraper runs; image rehost is itself a queued job; queue smooths burstiness.
- **Pattern 1 (Modular Monolith with Worker Sidecar)** — same Node binary as the API, different entrypoint (`workers/index.ts`). Direct repository imports, not API calls. Worker process boundary is enforced by deploy (separate container/systemd unit), not by HTTP.

### Integration Points
- **From Phase 1:** Yandex Object Storage bucket `dvapro-prod`, S3 SDK pointed at `storage.yandexcloud.net` with `region=ru-central1`
- **From Phase 2:** `cars`, `models`, pg-boss schema; shared types via `packages/shared/types.ts` (or path-alias)
- **To Phase 4:** `cars` rows populate matcher input; `models` rows populate matcher's "под индивидуальный заказ" fallback
- **To Phase 6:** per-source health metrics endpoint (`GET /api/admin/scrapers/health` returning `last_success_at`, `last_run_duration`, `cars_added`, `cars_marked_sold`, `last_run_status`, `paused_until` per source); per-source soft-delete window config (`PUT /api/admin/scrapers/:source/config`); brand-alias override CRUD (`/api/admin/brand-aliases`)

</code_context>

<specifics>
## Specific Ideas

- **Encar test surface:** SCRAPE-01 says "running дважды подряд не создаёт дубликатов" — explicit dedup-by-`(source, source_id)` test required in Phase 5 acceptance.
- **drom CALENDAR RISK callout (D-06):** the comprehensive-catalog decision means initial backfill probably eats 1-2 weeks of polite scraping. The planner should design drom backfill as an idempotent resumable job (worker can be killed and restarted without losing progress) and consider running it in parallel with Encar build (different threads, no proxy contention since drom is RU-domestic).
- **Per-source defaults baked into migration (D-15):** Phase 5 migration must seed the `scraper_config` row (or equivalent settings table entries) with the agreed defaults — 72h Encar/Che168/Autohome, 7d BeForward, ∞/null for drom — so the system is operationally correct before Phase 6 SettingsAdmin UI ships.
- **Block-detection fixture:** D-13's auto-halt logic needs a unit/integration test that injects 5 thin responses + verifies the source is paused, the founder email is queued, and `paused_until` is set to `now()+24h`.
- **REQUIREMENTS.md traceability update:** D-10 reclassifies SCRAPE-01..04. Planner should append a note in PLAN.md flagging that REQUIREMENTS.md needs an updater pass at phase end (likely via `/gsd-extract-learnings` or manual update during transition) to mark these as "Best-effort, deferred to v1.x if missed by 2026-05-31".
- **Carapis flip-trigger ergonomics (D-03):** the >3-day rule is about real wall-clock progress. Planner should write the Encar plan with an explicit checkpoint at day-3 of build effort that asks: "Has Encar produced ≥1 valid UPSERT against the `cars` table? If no, switch to Carapis path."

</specifics>

<deferred>
## Deferred Ideas

- **Per-source moderation policy** (auto-publish for drom + admin-review for live scrapers) — considered as option in D-14, deferred. Single auto-publish policy applies to all sources in v1; revisit post-launch if quality complaints emerge.
- **Image resize cap** (max 1600px width) — considered in image-format question, deferred. v1 keeps original dimensions; revisit if storage bills demand it.
- **Per-source 5-day budget per scraper** (vs single May 31 cutoff) — considered as defer-trigger option, deferred. Single calendar cutoff is cleaner.
- **Founder-curated whitelist for drom** (~30-50 brands) — considered as scope option, deferred in favor of comprehensive scope.
- **Admin review queue gate** (`needs_review=true` blocks publication) — considered as moderation option, deferred. Auto-publish stands.
- **JP residential proxy** — considered, deferred. RU datacenter + rate-limit is sufficient for BeForward.

</deferred>

---

*Phase: 5-inventory-pipeline-encar-drom-ru-catalog-jp-cn-scrapers*
*Context gathered: 2026-04-27*
