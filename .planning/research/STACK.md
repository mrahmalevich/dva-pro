# Technology Stack — DVApro

**Project:** DVApro — Russian vehicle-import marketplace (lead-funnel + scrapers + PDF + admin)
**Researched:** 2026-04-26
**Mode:** Project research (greenfield, milestone 1)
**Overall confidence:** HIGH on backend framework / DB / ORM / hosting, MEDIUM on email + scraping anti-bot specifics, MEDIUM-LOW on Bitrix24 SDK fit (verify before integration phase).

---

## TL;DR — The Recommended Stack

| Layer | Pick | Version (verified Apr 2026) | One-line rationale |
|---|---|---|---|
| Backend runtime | Node.js (LTS) | **22.x LTS** | Same language as frontend, mature Playwright + @react-pdf/renderer, single-team JS context |
| HTTP framework | **Hono** + `@hono/node-server` | hono **4.12.x** | Smallest, fastest modern Node framework; first-class TS; trivial Docker container; can re-target serverless later if needed |
| Database | PostgreSQL | **16.x** (managed) | LTS-stable, supported on every Russian provider; PG17 is fine but 16 is the safer default until 1Q 2027 |
| ORM / migrations | **Drizzle ORM** + drizzle-kit | drizzle-orm **0.45.x**, drizzle-kit matching | TS-native schema, raw-SQL escape hatch we will need for analytics, smaller cold start than Prisma, no Rust binary |
| Schema validation | **Zod** (built into Drizzle 1.0-beta path) | zod **3.x** | Used to validate quiz payloads, lead inputs, scraper outputs |
| Job queue / cron | **BullMQ** + managed Redis | bullmq **5.x** | Production-proven, native cron expressions, persistence in Redis; Yandex/Selectel both offer managed Redis |
| Headless scraping | **Crawlee for JS** + Playwright | crawlee **3.x**, playwright **1.59.x** | Built-in fingerprint randomisation, session pool, request queue; saves us 2 weeks of plumbing |
| HTTP scraping | got-scraping (bundled in Crawlee) + cheerio | — | For pages that don't need JS execution (drom.ru/catalog) |
| PDF | **@react-pdf/renderer** (locked) | **4.5.x** | Already chosen; Cyrillic via `Font.register()` of a TTF (Inter / IBM Plex Sans / PT Sans) |
| Auth | **Better-Auth** | **1.x** | Lucia is officially deprecated (Mar 2025); Better-Auth is the 2026 default for self-hosted TS, supports org/role plugin |
| Email | **Unisender Go** (RU-hosted) | API v1.85 | Russian infrastructure → 152-FZ aligned; SendPulse RU as backup; Mailgun/Postmark/Resend rejected (sanctions / payment friction) |
| Object storage | **Yandex Object Storage** (S3-compatible) | — | 152-FZ-certified, AWS S3 SDK works as-is, same control plane as DB |
| Hosting (primary) | **Yandex Cloud**, region `ru-central1` (зоны `a`/`b`/`d`) | — | Most mature 152-FZ posture, managed PG + Redis + Object Storage + Container Registry + Serverless Containers + cron Triggers in one console |
| Containerisation | Docker (multi-stage), `node:22-alpine` base | — | Standard; runs identically on Compute VM, K8s, or Serverless Containers |
| CI/CD | **GitLab CI** with self-hosted runner on Yandex Compute VM | — | Bypasses GitHub Actions IP/runner reliability concerns from RU; first-class Yandex Cloud tutorials exist |
| Observability | **Yandex Monitoring** + **GlitchTip** (self-hosted, Sentry SDK-compatible) | — | Both inside RU; Sentry SaaS is off-limits for personal data |
| Frontend (locked) | React 18 + Vite + TS + react-router | unchanged | Do **not** migrate to Next.js (see "Rejected" below) |

---

## Why these choices for THIS project

### 1. Backend framework: Hono on Node 22

**Confidence: HIGH** (Hono npm + Hono Docker production guide, Apr 2026).

We need: REST API for the SPA, a few server-rendered routes (PDF endpoint, OAuth/auth callbacks), webhook receivers (Bitrix24 in a later phase), and worker processes (scrapers + queue consumers). Hono fits because:

- **Web Standards request/response** — same primitives Playwright tests, easier to mock.
- **Tiny dep tree** — fewer 152-FZ-relevant supply-chain risks; faster CI; small Docker image (Hono guides ship a `node:22-alpine` two-stage Dockerfile in <70 lines).
- **Multi-runtime** — if we ever want to put just the public quiz behind a Russian edge (e.g., Yandex Cloud Functions), Hono is the only mainstream framework that runs there *and* on Node without rewriting.
- **`@hono/node-server`** is the official adapter, Node ≥18, supports graceful shutdown — important because our scrapers will be long-lived.

**Rejected alternatives:**

| Option | Why not |
|---|---|
| **Next.js full-stack migration** | Re-platforming the existing Vite SPA costs 1–1.5 weeks of our 4–6 week budget for zero functional gain. We don't need RSC, ISR, or App Router for a quiz form + admin; the public site is already a fast static SPA. The Vercel-plugin auto-suggestion in this environment is a tooling artifact, not a project signal. |
| **Fastify v5** (5.8.x) | Excellent and we'd happily use it; loses to Hono only on container-image size and the "one framework regardless of runtime" property. Pick this if the team is uncomfortable with Hono's smaller community. |
| **NestJS** | Decorator-heavy, opinionated DI we don't need for ~30 endpoints + 6 scrapers. Slower onboarding for a 2-person team. |
| **Express** | Active but in maintenance posture; modern alternatives have nothing to lose by switching. |
| **Python FastAPI** | Tempting because Crawlee-Python and Scrapy are mature, **but** it forces a second language for two devs already in TS, splits the type system across the app/scraper boundary, and our PDF library is React-based. Dual-stack cost > scraping ergonomics gain at our scale. |

### 2. Database: Postgres 16, managed

**Confidence: HIGH.** Every recommended Russian provider lists PG 16 as a first-class option; pgvector / TimescaleDB extensions available if we ever need them.

We will store: `cars` (denormalised inventory snapshots), `models` (drom.ru master catalog), `leads` + quiz answers, `users` + roles, `pdf_artifacts` (S3 keys), `scrape_runs` audit log, CMS tables (`faq`, `reviews`, `feed`, `timeline`, `settings`).

Choose **PG 16** over 17 because:
- Both Yandex and Selectel support 17 in production, but 16 has more battle-tested patches and our app does not need 17's vacuum / logical-replication wins.
- Re-evaluate at the next milestone.

### 3. ORM: Drizzle, not Prisma

**Confidence: HIGH** (Drizzle 0.45.x is current; Prisma 7 with the WASM engine narrowed but didn't close the gap).

- **Schema in TypeScript** — no separate `.prisma` DSL; refactors are normal IDE refactors.
- **Raw SQL when needed** — we will need it for inventory dedup, fuzzy-match between scraper rows and master models, geo-bounded analytics on the admin dashboard.
- **No Rust/WASM engine** — smaller image, faster cold start, fewer arch-specific binary headaches when building on macOS dev → Linux container.
- **drizzle-kit** generates and applies migrations idempotently from our TS schema files.
- The `drizzle-zod` schemas (now first-class in `drizzle-orm@1.0-beta.15+`) give us request validators "for free" from the DB schema.

**Rejected:** **Prisma** — fine and improving fast (v7 cut bundle from ~14MB to ~1.6MB), but the schema DSL adds a translation layer we don't need; **Kysely** — query builder only, no migration story we want to own at startup velocity; **TypeORM** — legacy patterns, decorator-heavy.

### 4. Hosting: Yandex Cloud, region `ru-central1`

**Confidence: HIGH** for the compliance posture; **MEDIUM-HIGH** vs Selectel which is the strongest runner-up.

- **152-FZ:** Yandex Cloud explicitly states compliance with Federal Law 152-FZ and meets UZ-1 (highest level) per FSTEC Order 21 / Resolution 1119. This is the strongest stated posture among the four mainstream RU providers.
- **All services in one console:**
  - **Managed Service for PostgreSQL** (PG 13–17, region ru-central1, zone-redundant)
  - **Managed Service for Redis** (for BullMQ)
  - **Object Storage** (S3-compatible, AWS SDK works unchanged)
  - **Container Registry**
  - **Serverless Containers** + **Timer Triggers** (cron expressions, UTC) — useful for low-frequency scrapers we don't want a dedicated worker for
  - **Managed Kubernetes** if/when we outgrow VMs
  - Optional **Compute Cloud VM** for everything in MVP if we want to keep cost flat
- **Pricing change to track:** new prices effective **2026-05-01** on certain Yandex Cloud SKUs — re-confirm budgets just before launch.

**Region/zones:** `ru-central1` with availability zones `a`, `b`, `d`. Place primary PG cluster in `a`, replica in `b`. Object Storage is region-scoped. Keep all personal-data buckets/clusters inside `ru-central1` only.

**Rejected:**
| Provider | Why not (for MVP) |
|---|---|
| **Selectel** | Strong second choice — managed PG (13–17), S3, K8s, all 152-FZ aligned. **Note their 2026-09-15 deadline:** old S3 settings (users, URLs) stop working — we'd inherit a forced migration in our first year. Yandex has no equivalent forced-migration window. Pick Selectel if Yandex pricing post-May-2026 is unacceptable. |
| **Timeweb Cloud** | Cheaper, simpler control panel, but managed services are thinner (esp. for queueing/observability) and English docs are sparse. Good budget option, weaker compliance documentation. |
| **VK Cloud** | Comparable to Yandex on paper but smaller ecosystem and slower docs cadence; some founders have political concerns about VK Group governance — worth checking with Денис/Алексей. |
| **Cloud.ru (ex-SberCloud)** | Bank-owned, very enterprise-targeted; KYC/onboarding overhead disproportionate for a 4–6wk launch. |
| **Vercel / Cloudflare / AWS / GCP / Azure** | Hard-blocked by 152-FZ for personal data and by sanctions/payments practical issues. Non-starter. |

### 5. Scheduled jobs: BullMQ on managed Redis (not Temporal, not Celery)

**Confidence: HIGH.**

We have ~6 scrapers (Encar, USS, BeForward, Che168, Autohome, drom.ru/catalog) plus PDF render + email send + Bitrix24 sync (later). Volume is low (hundreds-to-thousands of jobs/day), but we need:
- cron-style recurring scraper schedules,
- per-job retry/backoff,
- a dashboard for the founders to see "did the Encar scraper run last night?"

**BullMQ** gives us all of this with Redis as the only new infra dep. `bull-board` provides the founder-visible dashboard. Repeating jobs use BullMQ's job-scheduler API (cron expressions or fixed intervals) and persist across restarts in Redis.

**Rejected:**
- **Temporal** — overkill for this scale; one more infra service to host on `ru-central1`.
- **Celery** — would force Python.
- **Pure cron-in-container** — no retry, no observability, no fan-out; we'd reinvent BullMQ poorly within 2 weeks.
- **Yandex Timer Triggers + Serverless Containers** — useful as a *complement* (e.g., for the once-a-day drom.ru/catalog refresh), but cold-starting Playwright in a serverless container is painful; keep heavy scrapers on a dedicated worker VM with BullMQ.

### 6. Scraping toolchain: Crawlee (JS) + Playwright + got-scraping/cheerio

**Confidence: MEDIUM-HIGH.** Toolchain is mature; per-site anti-bot posture is the unknown.

- **Crawlee for JavaScript** (apify/crawlee, ~12K stars) wraps Playwright and HTTP crawlers with auto-fingerprint randomisation, session pool, request queue, persistent storage, and a uniform API. The Python version is mature but the JS version is more feature-complete and aligns with our Node stack.
- **`PlaywrightCrawler`** for sites that need JS execution (Encar, Che168, Autohome).
- **`CheerioCrawler` / `HttpCrawler`** for static HTML (drom.ru/catalog likely OK; verify).
- **Playwright with Firefox engine** is a concrete recommendation when sites have stricter Chromium-targeted bot detection.

**Per-source notes (verify in scraper-build phase):**

| Source | Likely posture | First approach | Fallback |
|---|---|---|---|
| **Encar (KR)** | Strong bot detection; commercial parser APIs (Carapis) exist, indicating rolling-your-own is non-trivial. Consider buying API access if we burn >3 days on it. | PlaywrightCrawler + RU residential proxy + Korean Accept-Language; respect 10–15s delay. | Carapis Encar API — paid but documented official Python/Node clients. |
| **USS (JP, auctions)** | Login wall; auction members-only data. Will need a member account + session re-use. | Authenticated PlaywrightCrawler with persistent session storage in Crawlee. | Manual upload of CSV exports if scraping breaks. |
| **BeForward (JP)** | Public listings, weaker protection. | HttpCrawler + Cheerio. | Playwright if listing pages are JS-rendered. |
| **Che168 + Autohome (CN)** | Geo-restricted (will likely 451/redirect from non-CN IPs); aggressive bot detection. | PlaywrightCrawler + CN residential proxy (essential), CN Accept-Language. | Pull from a CN-resident relay box if proxies prove unreliable. |
| **drom.ru/catalog (RU master models)** | Same-country, public catalog; moderate. | HttpCrawler + Cheerio + Crawl-delay respect. **Read robots.txt first** and rate-limit at 1 req / 10–15s minimum. | PlaywrightCrawler if catalog pages start hydrating client-side. |

**Anti-bot rules of thumb (2026):**
- Cloudflare-protected sites cannot be reliably scraped with vanilla Playwright/Puppeteer + stealth plugins anymore — those are explicitly noted as ineffective in 2026 guidance. Plan budget for either residential proxies (Bright Data / smartproxy / Russian providers) or commercial bypass services for Encar/Che168 if they sit behind CF.
- Adding "polite delays" does not bypass per-request bot scoring — it only reduces server-load risk. For protected sites the real lever is fingerprint quality + IP reputation.

**Rejected:**
- **Scrapy (Python)** — best-in-class for static HTML, but adds Python.
- **Puppeteer raw** — Crawlee is strictly more capable for the same code volume.

### 7. PDF: @react-pdf/renderer (locked) — Cyrillic

**Confidence: HIGH.**

`@react-pdf/renderer@4.5.x` is current and runs server-side under Node. **Critical requirement for Cyrillic:** call `Font.register()` with a TTF that explicitly includes the Cyrillic block (U+0400–U+04FF). The "fonts don't apply / Cyrillic boxes" issue is the #1 reported bug on the project — caused by registering a font that lacks the glyphs or by registering after the document tree mounts.

**Recommended fonts (all have Cyrillic + commercial licenses):**
- **Inter** (Variable + static TTFs, Cyrillic complete)
- **IBM Plex Sans** (Cyrillic complete) — pairs well with our existing JetBrains Mono accent
- **PT Sans / PT Serif** (Cyrillic-first, Russian heritage)

Embed TTFs into the worker image at build time (do not fetch over network at render time — cold-start latency + CDN dependency).

### 8. Auth: Better-Auth (not Lucia, not NextAuth)

**Confidence: HIGH.**

- **Lucia is officially deprecated** since March 2025 — author transformed it into "auth as documentation"; do not start a new project on it.
- **Better-Auth** is the 2026 consensus choice for self-hosted TS auth: TS-first, code-defined config, sessions in our own Postgres (no vendor lock-in), built-in plugins for **organisations + roles** (founders vs sales reps), 2FA, OAuth providers if we want Google/Yandex login later.
- Sessions in Postgres mean immediate revocation (kick a fired sales rep instantly).
- Has documented **Hono integration** (official example).
- **NextAuth/Auth.js v5** is the only credible alternative — but its sweet spot is Next.js apps; for our Hono + Vite stack Better-Auth is a cleaner fit.

Schema lives in our Drizzle `auth` schema; grant Postgres role privileges per Better-Auth docs.

### 9. Email: Unisender Go (RU-hosted)

**Confidence: MEDIUM-HIGH.** The provider's RU residency is documented; per-IP deliverability to gmail/yandex/mailru still needs production warm-up.

- **Unisender Go** (`go.unisender.ru`) — servers in RF, transactional API + SMTP, webhooks, 99.9% claimed delivery. JSON POST API up to 10MB (plenty for one PDF attachment).
- **SendPulse (RU instance)** is a viable backup — same approximate feature set.
- **RuSender** is a third option, listed in the same category.

**Why not the global names:**
- **Mailgun / Postmark / SendGrid / Resend** — payment from a Russian legal entity is friction-to-impossible since 2022; deliverability to .ru inboxes is also worse than RU-domestic providers; data residency is outside RF.

**Send pattern for v1:**
- Quiz completion → enqueue `send-pdf` job → worker renders PDF → uploads to Object Storage → calls Unisender Go API with PDF attachment + transactional template → BCC to founders' sales channel.

### 10. Object storage: Yandex Object Storage

**Confidence: HIGH.**
- S3-compatible HTTP API → use `@aws-sdk/client-s3` unchanged with a custom endpoint.
- Encrypted at rest, multi-DC replication inside `ru-central1`.
- Bucket layout: `dvapro-pdf-prod` (private, signed URLs), `dvapro-static-prod` (public, served via Yandex CDN if needed), `dvapro-scrape-cache-prod` (private, lifecycle-deleted at 30 days).

### 11. CI/CD: GitLab CI + self-hosted runner on Yandex Compute VM

**Confidence: HIGH** (Yandex publishes a tutorial for exactly this setup).

- **Why not GitHub Actions:** GitHub-hosted runners may be reachable from RU but billing and connectivity to RU services is fragile under the current sanctions environment; deploying to Yandex Cloud from GitHub-hosted runners requires hardcoded Yandex API keys in GitHub secrets — exfil risk.
- **Why GitLab:** repo can live on **gitlab.com** (still accessible) or self-hosted. Runner is a single Ubuntu 22.04 VM in `ru-central1` with the GitLab Runner package installed; pipelines build Docker images, push to **Yandex Container Registry**, then update the running service. Yandex publishes step-by-step docs.
- **Alternative if the team already uses GitHub:** keep the repo on GitHub but run the deploy steps from a **self-hosted GitHub runner** on a Yandex Compute VM. This works; choose based on team preference.

### 12. Observability: Yandex Monitoring + self-hosted GlitchTip

**Confidence: MEDIUM** on GlitchTip self-hosting practicalities (verify install).

- **Yandex Monitoring** — built-in metrics for managed PG / Redis / Object Storage / Compute, cheap, in-region.
- **GlitchTip** (self-hosted, Sentry-SDK-compatible) — replaces Sentry for error tracking. Single Docker host on a small Compute VM. Sentry SaaS is OK for non-PII errors *technically*, but the principle of "no personal data leaving RF" is cleaner if we just self-host.
- **Logs** — ship to Yandex Cloud Logging (managed) for the first phase.

**Rejected:** Sentry SaaS, Datadog, Grafana Cloud (data residency + payment friction).

### 13. Bitrix24 integration (later phase, not v1)

**Confidence: MEDIUM-LOW** on SDK fit — verify before integration phase.

- Use **`@bitrix24/b24jssdk`** (1.0.x) — official, supports Node back-end, async/await.
- Pattern: incoming webhooks for Bitrix → our Hono routes; outbound REST calls from a BullMQ worker (`sync-lead-to-bitrix`) so retries are free.
- Until that phase ships, our Postgres `leads` table is the single source of truth.

---

## Installation skeleton

```bash
# Backend deps
npm install hono @hono/node-server
npm install drizzle-orm postgres
npm install -D drizzle-kit
npm install zod
npm install bullmq ioredis
npm install crawlee playwright
npm install @react-pdf/renderer
npm install better-auth
npm install @aws-sdk/client-s3                      # talks to Yandex Object Storage
npm install pino pino-http                          # structured logs
npm install @sentry/node                            # points at self-hosted GlitchTip DSN

# Dev
npm install -D typescript tsx vitest
npm install -D @playwright/test                     # only if E2E tests live in same workspace
```

**Browsers for Playwright (in CI / Docker):**
```bash
npx playwright install --with-deps chromium firefox
```

---

## Minimum viable backend skeleton

Single repo, Vite SPA in `src/`, backend in `server/`, shared types in `packages/shared/`.

```
dva.pro/
├── src/                              # existing Vite SPA — unchanged
├── server/
│   ├── src/
│   │   ├── index.ts                  # Hono app entry (REST + auth + webhooks)
│   │   ├── env.ts                    # zod-parsed env
│   │   ├── db/
│   │   │   ├── client.ts             # postgres-js + drizzle()
│   │   │   ├── schema/
│   │   │   │   ├── cars.ts
│   │   │   │   ├── models.ts         # drom.ru master catalog
│   │   │   │   ├── leads.ts
│   │   │   │   ├── users.ts          # Better-Auth tables
│   │   │   │   ├── cms.ts            # faq, reviews, feed, timeline, settings
│   │   │   │   └── scrape.ts         # scrape_runs, scrape_errors
│   │   │   └── migrations/           # drizzle-kit output
│   │   ├── routes/
│   │   │   ├── public/quiz.ts        # POST /api/quiz/submit
│   │   │   ├── public/cars.ts        # GET /api/cars (filtered)
│   │   │   ├── admin/leads.ts
│   │   │   ├── admin/cms.ts
│   │   │   ├── admin/inventory.ts
│   │   │   └── webhooks/bitrix.ts    # phase 2
│   │   ├── auth/
│   │   │   └── better-auth.ts        # Better-Auth config + Hono adapter
│   │   ├── pdf/
│   │   │   ├── LeadPdf.tsx           # @react-pdf/renderer document
│   │   │   ├── fonts/                # IBM Plex Sans + JetBrains Mono TTFs
│   │   │   └── render.ts             # renderToBuffer()
│   │   ├── storage/
│   │   │   └── s3.ts                 # Yandex Object Storage client
│   │   ├── email/
│   │   │   └── unisender.ts
│   │   └── lib/                      # shared utilities
│   ├── workers/
│   │   ├── queue.ts                  # BullMQ Queue + Worker bootstrap
│   │   ├── jobs/
│   │   │   ├── send-pdf.ts
│   │   │   ├── scrape-encar.ts
│   │   │   ├── scrape-uss.ts
│   │   │   ├── scrape-beforward.ts
│   │   │   ├── scrape-che168.ts
│   │   │   ├── scrape-autohome.ts
│   │   │   ├── scrape-drom-catalog.ts
│   │   │   └── sync-bitrix.ts        # phase 2
│   │   └── schedules.ts              # cron registrations on boot
│   ├── scrapers/                     # Crawlee crawler builders, one per source
│   │   ├── encar/
│   │   ├── uss/
│   │   ├── beforward/
│   │   ├── che168/
│   │   ├── autohome/
│   │   └── drom-catalog/
│   ├── drizzle.config.ts
│   ├── tsconfig.json
│   └── package.json
├── packages/
│   └── shared/                       # zod schemas + types shared by SPA + server
│       └── src/
│           ├── quiz.ts
│           ├── car.ts
│           └── lead.ts
├── docker/
│   ├── api.Dockerfile                # Hono HTTP server
│   └── worker.Dockerfile             # BullMQ worker + Playwright browsers
├── .gitlab-ci.yml
└── package.json                      # root, workspaces
```

**Two deployable units (one image each):**
1. `api` — Hono HTTP server (small, ~150MB image).
2. `worker` — BullMQ consumer + Playwright (~1–1.5GB image with Chromium + Firefox).

Both images run on Yandex Compute VMs initially (one VM each is enough for soft-launch); migrate to Managed Kubernetes only when load demands.

---

## Compliance checklist (152-FZ) — pre-launch gates

- [ ] Все PII (имя, телефон, email, ответы квиза, IP) хранятся в Yandex Managed PG в `ru-central1`.
- [ ] Объектное хранилище для PDF — Yandex Object Storage в `ru-central1`.
- [ ] Логи и метрики — Yandex Cloud Logging + Yandex Monitoring (RU).
- [ ] Email-провайдер с серверами в РФ (Unisender Go).
- [ ] Подано **уведомление в Роскомнадзор** об обработке ПДн (статья 22 152-ФЗ; штраф за отсутствие — 100–300k₽). Это юридическое действие, не технологическое — заложить в pre-launch чек-лист.
- [ ] Политика обработки ПДн опубликована на сайте, чек-бокс согласия в форме квиза перед отправкой.
- [ ] Никаких сторонних аналитик с серверами вне РФ (Google Analytics, Hotjar, Mixpanel) — использовать **Yandex Metrika**.

---

## Sources

### Backend framework / runtime
- [Hono — npm (4.12.x)](https://www.npmjs.com/package/hono)
- [Hono — Node.js adapter docs](https://hono.dev/docs/getting-started/nodejs)
- [Hono — Docker production guide (2026)](https://oneuptime.com/blog/post/2026-02-08-how-to-containerize-a-hono-application-with-docker/view)
- [Express vs Hono in 2026 — PkgPulse](https://www.pkgpulse.com/blog/express-vs-hono-2026)
- [Fastify v5 — npm (5.8.x)](https://www.npmjs.com/package/fastify)
- [Hono + Better Auth integration example](https://hono.dev/examples/better-auth)

### Database / ORM
- [Drizzle ORM — releases (0.45.x)](https://github.com/drizzle-team/drizzle-orm/releases)
- [Drizzle ORM — latest releases](https://orm.drizzle.team/docs/latest-releases)
- [Drizzle vs Prisma in 2026 — Encore](https://encore.dev/articles/drizzle-vs-prisma)
- [PostgreSQL 16 vs 17 — version choice for production](https://sqlflash.ai/article/20250729_postgresql-version-chosssing/)
- [Selectel — PostgreSQL versions and configurations](https://docs.selectel.ru/en/managed-databases/postgresql/configurations/)

### Hosting / Russian providers
- [Yandex Managed Service for PostgreSQL — overview](https://yandex.cloud/en/services/managed-postgresql)
- [Yandex Managed PostgreSQL — pricing policy](https://yandex.cloud/en/docs/managed-postgresql/pricing) (note: new prices effective 2026-05-01)
- [Yandex Object Storage — service page](https://yandex.cloud/en/services/storage)
- [Yandex Cloud — security & compliance (152-FZ, FSTEC, UZ-1)](https://yandex.cloud/en/docs/security/conform)
- [Yandex Container Registry](https://yandex.cloud/en/services/container-registry)
- [Yandex Serverless Containers — concept](https://cloud.yandex.com/en/docs/serverless-containers/concepts/container)
- [Yandex Serverless — Timer trigger (cron)](https://cloud.yandex.com/en/docs/functions/concepts/trigger/timer)
- [Yandex tutorial — GitLab Runner on Compute VM](https://yandex.cloud/en/docs/tutorials/dev/install-gitlab-runner)
- [Selectel S3 — product description](https://docs.selectel.ru/en/s3/about/about-s3/)
- [Selectel — S3 update deadline 2026-09-15](https://docs.selectel.ru/en/s3/manage/configure-storage-update/)
- [Selectel review 2026 — services & data centers](https://dieg.info/en/review/review-selectel/)

### Job queue
- [BullMQ — official site](https://bullmq.io/)
- [BullMQ — scheduled tasks guide (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/)
- [BullMQ + Redis production guide (Jan 2026)](https://oneuptime.com/blog/post/2026-01-06-nodejs-job-queue-bullmq-redis/view)

### Scraping
- [Crawlee — JavaScript framework](https://crawlee.dev/blog/scrapy-vs-crawlee)
- [Crawlee Python vs JS production comparison (2026)](https://use-apify.com/blog/crawlee-vs-scrapy-vs-beautifulsoup-2026)
- [Playwright — npm (1.59.x)](https://www.npmjs.com/package/playwright)
- [How to bypass Cloudflare in 2026 — ZenRows](https://www.zenrows.com/blog/bypass-cloudflare)
- [Anti-bot services 2026 — which sites block scrapers](https://scrapeway.com/anti-bot-services)
- [Carapis — Encar parser docs (commercial fallback)](https://docs.carapis.com/parsers/encar.com/intro)

### PDF
- [@react-pdf/renderer — npm (4.5.x)](https://www.npmjs.com/package/@react-pdf/renderer)
- [react-pdf — Fonts docs (Font.register)](https://react-pdf.org/fonts)
- [react-pdf — Cyrillic issue thread (#1366)](https://github.com/diegomura/react-pdf/issues/1366)

### Auth
- [Better-Auth — official site](https://better-auth.com/)
- [Better-Auth — PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql)
- [Better-Auth vs Lucia vs NextAuth (2026) — PkgPulse](https://www.pkgpulse.com/blog/better-auth-vs-lucia-vs-nextauth-2026)
- [Lucia is dead — what's next for auth](https://www.wisp.blog/blog/lucia-auth-is-dead-whats-next-for-auth)

### Email
- [Unisender Go — main site](https://go.unisender.ru/)
- [Unisender Go — SMTP API docs](https://godocs.unisender.ru/smtp-api)
- [Unisender Go — Web API v1.85](https://godocs.unisender.ru/web-api-ref)
- [RuSender — transactional emails](https://rusender.ru/features/email/transactional/)

### Bitrix24
- [Bitrix24 — local webhooks docs](https://apidocs.bitrix24.com/local-integrations/local-webhooks.html)
- [Bitrix24 — REST API 3.0 overview](https://apidocs.bitrix24.com/api-reference/rest-v3/index.html)
- [@bitrix24/b24jssdk — npm](https://www.npmjs.com/package/@bitrix24/b24jssdk)
- [Bitrix24 SDK — official docs](https://apidocs.bitrix24.com/sdk/index.html)

### Compliance / regulatory
- [152-FZ — оператор ПДн, уведомление РКН (2026)](https://web-revenue.ru/internet-pravo/uvedomlenie-v-roskomnadzor)
- [152-ФЗ — требования и штрафы 2026 (Стахановец)](https://stakhanovets.ru/blog/152-fz-o-zashhite-personalnyh-dannyh-trebovaniya-i-shtrafy-v-2026-godu/)
- [Уведомление в РКН — пошаговая инструкция (Контур)](https://www.kontur-extern.ru/info/25487-kto_i_kogda_dolzhen_uvedomit_roskomnadzor_ob_obrabotke_personalnyx_dannyx)

### Observability
- [GlitchTip — Sentry-compatible self-hosted error tracker](https://oneuptime.com/blog/post/2026-03-31-10-best-sentry-alternatives/view)
- [Sentry alternatives 2026 — Better Stack](https://betterstack.com/community/comparisons/sentry-alternatives/)
