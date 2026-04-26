---
phase: 5
slug: inventory-pipeline-encar-drom-ru-catalog-jp-cn-scrapers
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for the framework + test taxonomy is `05-RESEARCH.md` §Validation Architecture; this file is the executor-facing checklist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (unit + integration) + @playwright/test 1.59 (E2E dry-run) — [ASSUMED A3 in research; no test infra exists yet, Wave 0 establishes] |
| **Config file** | `server/vitest.config.ts` — created in Wave 0 |
| **Quick run command** | `pnpm vitest run --changed` |
| **Full suite command** | `pnpm vitest run && pnpm playwright test` |
| **Estimated runtime** | ~30-60 seconds for unit+integration; ~2-3 min full incl. E2E dry-runs |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run --changed`
- **After every plan wave:** Run `pnpm vitest run` (full unit + integration)
- **Before `/gsd-verify-work`:** Full suite green + manual smoke run on staging worker VM (each source scrapes ≤10 listings, `/api/admin/scrapers/health` shows green)
- **Max feedback latency:** 60 seconds for incremental, 180 seconds for full

---

## Per-Task Verification Map

> Populated as plans land. Each plan's tasks must reference rows here (or extend with new rows). Status starts ⬜ pending; flips to ✅ when test file lands and passes.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-00-01 | 00 (Wave 0) | 0 | infra | — | Vitest configured, fixtures dir present | bootstrap | `pnpm vitest run --reporter=verbose` shows ≥1 passing smoke test | ❌ W0 | ⬜ pending |
| 5-shared-norm | shared | 1 | SCRAPE-01..04 | — | Pure normalize() output schema-correct per source | unit | `pnpm vitest run server/src/workers/scrapers/shared/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-http | shared | 1 | SCRAPE-01..04, SCRAPE-08 | T-5-http-retry | Polite rate-limit + retry-with-backoff on 429/5xx | integration:cassette (nock) | `pnpm vitest run server/src/workers/scrapers/shared/http.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-img | shared | 1 | SCRAPE-07 | T-5-img-leak | Image transcoded to webp + uploaded to YOS, never hot-linked | integration:image-pipeline | `pnpm vitest run server/src/workers/scrapers/shared/images.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-img-stress | shared | 1 | SCRAPE-07 | — | 100-image batch processes without leaks | stress | `pnpm vitest run server/src/workers/scrapers/shared/images.stress.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-block | shared | 1 | D-13 | T-5-block-detect | 5 thin/captcha responses → halts source 24h + queues founder email | integration:block-detection | `pnpm vitest run server/src/workers/scrapers/shared/block-detection.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-soft | shared | 1 | SCRAPE-06 | — | Per-source `last_seen_at < now()-N` flips `is_active=false`, `is_admin_curated` protected | integration:soft-delete | `pnpm vitest run server/src/workers/scrapers/shared/softdelete.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-fx | shared | 1 | SCRAPE-11 | — | CBR XML windows-1251 decode, KRW/JPY/CNY/USD/EUR parsed, fallback-on-fail | integration:fx | `pnpm vitest run server/src/infra/fx.test.ts` | ❌ W0 | ⬜ pending |
| 5-shared-aliases | shared | 1 | SCRAPE-10 | — | Auto-built aliases work; admin overrides win | integration:aliases | `pnpm vitest run server/src/workers/scrapers/shared/aliases.test.ts` | ❌ W0 | ⬜ pending |
| 5-drom-norm | drom | 2 | SCRAPE-05 | — | drom HTML → `models` rows + Cyrillic↔Latin pair | unit + integration | `pnpm vitest run server/src/workers/scrapers/drom/*.test.ts` | ❌ W0 | ⬜ pending |
| 5-drom-resume | drom | 2 | SCRAPE-05, D-06 | — | Backfill is idempotent + resumable across worker restarts | integration | `pnpm vitest run server/src/workers/scrapers/drom/resume.test.ts` | ❌ W0 | ⬜ pending |
| 5-encar-norm | encar | 3a | SCRAPE-01 | — | Encar HTML/JSON → `cars` row | unit | `pnpm vitest run server/src/workers/scrapers/encar/normalize.test.ts` | ❌ W0 | ⬜ pending |
| 5-encar-dedup | encar | 3a | SCRAPE-01 | — | Running scraper 2× same fixture produces no duplicates by `(source,source_id)` | integration:dedup | `pnpm vitest run server/src/workers/scrapers/encar/dedup.test.ts` | ❌ W0 | ⬜ pending |
| 5-encar-dryrun | encar | 3a | SCRAPE-01 | — | E2E pipeline: fetch fixture → normalize → mocked image rehost → mocked UPSERT | e2e:dry-run | `pnpm vitest run server/src/workers/scrapers/encar/dry-run.test.ts` | ❌ W0 | ⬜ pending |
| 5-beforward-norm | beforward | 3b | SCRAPE-02 | — | BeForward Cheerio HTML → `cars` row | unit + integration | `pnpm vitest run server/src/workers/scrapers/beforward/*.test.ts` | ❌ W0 | ⬜ pending |
| 5-che168-norm | che168 | 3c | SCRAPE-03 | — | Che168 Playwright → `cars` row | unit + integration | `pnpm vitest run server/src/workers/scrapers/che168/*.test.ts` | ❌ W0 | ⬜ pending |
| 5-autohome-norm | autohome | 3c | SCRAPE-04 | — | Autohome Playwright → `cars` row | unit + integration | `pnpm vitest run server/src/workers/scrapers/autohome/*.test.ts` | ❌ W0 | ⬜ pending |
| 5-metrics-api | metrics | 2 | SCRAPE-09 | — | `GET /api/admin/scrapers/health` returns per-source `last_success_at`, `last_run_duration`, `cars_added`, `cars_marked_sold`, `last_run_status`, `paused_until` | integration:http | `pnpm vitest run server/src/http/routes/admin.scrapers.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/vitest.config.ts` — Vitest config + path aliases
- [ ] `server/tests/conftest.ts` (or `server/tests/setup.ts`) — shared fixtures: mock pg-boss, mock S3 (`@aws-sdk/client-s3-mock`), mock HTTP (`nock`), mock Drizzle DB
- [ ] `server/tests/fixtures/drom/page-{1,2,3}.html` — recorded sample drom catalog pages (sanitised)
- [ ] `server/tests/fixtures/encar/page-{1,2,3}.html` — recorded sample Encar listings (sanitised)
- [ ] `server/tests/fixtures/beforward/page-{1,2,3}.html` — recorded sample BeForward listings (sanitised)
- [ ] `server/tests/fixtures/che168/page-{1,2,3}.html` — recorded sample Che168 listings (sanitised)
- [ ] `server/tests/fixtures/autohome/page-{1,2,3}.html` — recorded sample Autohome listings (sanitised)
- [ ] `server/tests/fixtures/cbr-xml-daily.xml` — windows-1251-encoded sample CBR FX XML
- [ ] `server/tests/fixtures/images/sample-{toyota,lexus,kia,...}.jpg` — for sharp transcode tests (≤5 fixtures sufficient for unit; 100 generated programmatically for stress)
- [ ] Framework install: `pnpm add -D vitest @playwright/test @aws-sdk/client-s3-mock nock iconv-lite-fixtures-helper` (or whatever the executor confirms)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Worker isolation: `MemoryMax=1G`, fresh browser per run, explicit `browser.close()` | SCRAPE-08 | systemd unit + Playwright lifecycle is deploy-time, not unit-testable | After deploy to staging worker VM, run `systemctl status dvapro-worker-encar`, verify `MemoryMax=1G`, run scraper once, observe `ps` shows browser exits within 30s of completion, run again and confirm fresh PID. Capture in `scripts/scraper-isolation-smoke.sh`. |
| Production proxy connectivity | SCRAPE-01..04 | Live proxy auth is gated by paid account credentials not present in CI | Wave 3a: founder pre-funds IPRoyal (or chosen vendor) account; executor stores creds in Yandex Lockbox; first Encar scrape on staging confirms 200 OK + non-RU egress IP via `https://api.ipify.org` self-check. |
| Smoke: each source scrapes ≤10 listings on staging | SCRAPE-01..05 | First-attempt anti-bot posture only confirmable against live target | Manual run via `boss.send('scraper.{source}.smoke')`. Verify `/api/admin/scrapers/health` shows `last_run_status=ok` for each source after smoke. |
| drom backfill 1-2 week real-clock progress | SCRAPE-05 + D-06 | 20-30K-page polite scrape can't complete in CI | Founder monitors progress via metrics endpoint daily during Wave 2. Resumability validated via integration test 5-drom-resume. |
| Encar Day-3 checkpoint | D-03 | Wall-clock checkpoint, not a code test | At Day-3 of Encar wave: query `cars` for ≥1 valid `source='encar'` row. If zero, executor flips to Carapis API path without further approval. |
| May 31 cutoff for live scrapers | D-11 | Calendar gate, not a code test | On 2026-05-31: any of Encar/BeForward/Che168/Autohome with zero valid UPSERTs gets reclassified as v1.x deferral via REQUIREMENTS.md updater pass. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s incremental / < 180s full
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
