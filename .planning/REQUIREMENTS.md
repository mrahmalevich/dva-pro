# Requirements: DVApro

**Defined:** 2026-04-26
**Core Value:** Посетитель доходит до конца квиза → получает на email брендированный PDF с подобранными авто и оценкой landed-cost → одновременно становится квалифицированным лидом в продажной воронке.

## v1 Requirements

### Compliance & Infrastructure

- [ ] **INFRA-01**: Production infrastructure provisioned on Yandex Cloud `ru-central1` (managed Postgres 16, Object Storage bucket, Compute VM(s)) with `ru_RU.UTF-8` collation
- [ ] **INFRA-02**: Roskomnadzor notification (уведомление об обработке ПДн, ст. 22 152-ФЗ) filed and confirmation received before any public form is live
- [ ] **INFRA-03**: Sender domain `dva.pro` configured with SPF + DKIM + DMARC and a 2-week deliverability warm-up plan executed against Unisender Go
- [ ] **INFRA-04**: Self-hosted GlitchTip (or equivalent RU-resident error tracking) deployed; no foreign SaaS observability captures PII or session data
- [ ] **INFRA-05**: GitLab CI with self-hosted runner deployed; deploy pipeline reaches staging + production environments
- [ ] **INFRA-06**: Object Storage bucket configured for generated PDFs and rehosted car images with signed-URL access only (no public ACL)

### Backend & Schema

- [ ] **API-01**: Hono server skeleton runs as `api` and `worker` processes from one image, deployable to Yandex Cloud
- [ ] **API-02**: Drizzle migrations define `cars`, `models`, `leads`, `users`, `sessions`, `audit_log`, `consent_log`, and CMS tables (`faq`, `reviews`, `feed`, `timeline`, `settings`)
- [ ] **API-03**: Country registry exposes 6 markets (`kr`, `jp`, `cn`, `us`, `ae`, `eu`) as a single source of truth with `scraperReady` flag per market; UI consumes this registry, no hardcoded enums
- [ ] **API-04**: Public read API exposes cars, faq, reviews, feed, timeline, and settings to the SPA with response types shared between server and frontend
- [ ] **API-05**: Server validates all input with Zod schemas; invalid input returns 400 with structured errors

### Frontend Integration & Legal

- [ ] **LEGAL-01**: `CrmProvider` is rewritten to back `useCrm()` with the public API + react-query; existing admin and section components do not change their consumption surface
- [ ] **LEGAL-02**: 152-ФЗ consent checkbox appears on quiz and callback forms (default unchecked, server rejects submissions without flag); each consent event is logged to `consent_log` with timestamp, IP, user-agent, and policy-text version
- [ ] **LEGAL-03**: `/legal/personal-data-policy` page is reachable from footer and from every form
- [ ] **LEGAL-04**: `/legal/offer` (договор-оферта) page is reachable from footer
- [ ] **LEGAL-05**: Footer displays юр. реквизиты (ИНН, ОГРН, юр. адрес) on every page

### Lead Capture (Quiz → PDF → Email)

- [ ] **LEAD-01**: Quiz uses the existing 5 questions (budget, body, condition, use, timing) without scope expansion in v1
- [ ] **LEAD-02**: `POST /api/public/leads` accepts quiz answers + contact (name, phone, email, optional Telegram) + idempotency key generated at quiz-start; duplicate submissions with the same key return the original lead row
- [ ] **LEAD-03**: Lead row persists with `consent_at`, `ip_address`, `user_agent`, `quiz_answers`, contact fields, and a state field (`new` → `pdf-sent` → `closed`)
- [ ] **LEAD-04**: Matching engine selects up to N cars from the inventory DB based on quiz answers (budget range, body, condition, use, timing) with deterministic ordering
- [ ] **LEAD-05**: When live inventory has insufficient matches, matcher falls back to admin-curated cars and then to model-DB recommendations (drom.ru/catalog) labelled «под индивидуальный заказ»
- [ ] **LEAD-06**: Quiz submission enqueues async PDF generation + email send via pg-boss; HTTP response returns within 100ms with `{queued: true}`
- [ ] **LEAD-07**: Quiz UI shows confirmation that PDF will arrive in email within 5 minutes; lead row updates to `pdf-sent` once email is dispatched
- [ ] **LEAD-08**: Lead persists even if PDF render or email send fails; failed steps mark the row (`pdf_failed` / `email_failed`) and notify admin

### PDF Generation

- [ ] **PDF-01**: Branded PDF renders server-side via `@react-pdf/renderer` with self-hosted TTF fonts covering Cyrillic + brand JetBrains Mono accent; every weight and style is registered explicitly
- [ ] **PDF-02**: PDF includes founder signatures (Денис + Алексей), matched cars (photo, brand/model/year, spec, price «под ключ» + local currency), total landed-cost stub range, and contact widget
- [ ] **PDF-03**: «Предварительная оценка» disclaimer appears on every page of the PDF that contains a price
- [ ] **PDF-04**: Generated PDF is uploaded to Yandex Object Storage; signed-URL is referenced from the lead row and email
- [ ] **PDF-05**: PDF size kept under 2 MB to maximise inbox placement and mobile-client compatibility
- [ ] **PDF-06**: CI runs a Cyrillic fixture test that asserts no `□` boxes appear in rendered PDF text

### Email Delivery

- [ ] **MAIL-01**: Transactional email sends via Unisender Go (RU-resident) using SPF/DKIM/DMARC-signed `dva.pro` sender domain
- [ ] **MAIL-02**: Lead email contains personalized greeting, brief recap of quiz answers, PDF attachment, and contact CTAs (Telegram, WhatsApp, phone)
- [ ] **MAIL-03**: Sales-channel BCC (founder mailbox) receives every lead email
- [ ] **MAIL-04**: Email-send failures retry with exponential backoff; final failure flips lead state to `email_failed` and notifies admin
- [ ] **MAIL-05**: Inbox-placement smoke test passes for @yandex.ru, @mail.ru, @rambler.ru, @gmail.com before launch

### Inventory Scrapers

- [ ] **SCRAPE-01**: Encar.com (KR) scraper runs on schedule via Crawlee + KR residential proxy; UPSERTs to `cars` with `(source='encar', source_id)` UNIQUE
- [ ] **SCRAPE-02**: BeForward (JP) scraper runs on schedule (USS data path is licensed exporter feed, NOT a scraper — see Out of Scope)
- [ ] **SCRAPE-03**: Che168 (CN) scraper runs on schedule via CN residential proxy
- [ ] **SCRAPE-04**: Autohome (CN) scraper runs on schedule via CN residential proxy
- [ ] **SCRAPE-05**: drom.ru/catalog scraper runs weekly and populates `models` master DB (brand, model, year range, body, drivetrain, engine, base price range, descriptions); used by matcher when no live inventory matches
- [ ] **SCRAPE-06**: Every scraper marks unseen cars via `last_seen_at` (soft-delete); public UI hides cars not seen for N days; admin can override
- [ ] **SCRAPE-07**: Every scraper rehosts source images to Yandex Object Storage; public UI never hot-links to source domains
- [ ] **SCRAPE-08**: Every scraper runs in a separate worker process with `MemoryMax=1G`, fresh browser per run, explicit `browser.close()`
- [ ] **SCRAPE-09**: Per-source `last_success_at`, `last_run_duration`, `cars_added`, `cars_marked_sold` metrics are surfaced in admin
- [ ] **SCRAPE-10**: Brand and model names canonicalised via lookup table (Cyrillic ↔ Latin) before write
- [ ] **SCRAPE-11**: Source-currency price stored authoritatively; RUB equivalent computed on read from CBR daily XML feed; rate date shown alongside price in UI and PDF

### Admin Auth & Audit

- [ ] **AUTH-01**: Admin signs in with email + password; sessions persist in Postgres (revocable)
- [ ] **AUTH-02**: Magic-link login is offered as an alternative; verified against @yandex.ru, @mail.ru, @rambler.ru, @gmail.com mailboxes (no spam placement)
- [ ] **AUTH-03**: Two roles exist: `founder` (full access incl. settings/users) and `sales_rep` (leads + cars CRUD only)
- [ ] **AUTH-04**: Every admin mutation (leads / cars / settings / faq / reviews / feed / timeline / users) is recorded in `audit_log` (actor, entity, before, after, timestamp, IP)
- [ ] **AUTH-05**: No shared logins; each user has individual credentials; founder can revoke a session immediately

### Admin Panel

- [ ] **ADMIN-01**: LeadsAdmin reads leads from real DB; sales rep can update lead status, attach notes, view the generated PDF via signed URL, and trigger PDF re-send
- [ ] **ADMIN-02**: CarsAdmin can pin cars (`is_admin_curated=true`), edit overrides protected from scraper overwrites, hide cars from public, and add manually-curated cars
- [ ] **ADMIN-03**: SettingsAdmin (founder role only) manages live metrics (`liveCount`, `totalDelivered`, `yearsOnMarket`, `avgDeliveryDays`, `satisfactionPct`), contact details, founder bios, and brand quote
- [ ] **ADMIN-04**: FaqAdmin / ReviewsAdmin / FeedAdmin / TimelineAdmin support CRUD on their respective public-content collections
- [ ] **ADMIN-05**: Live-metric and feed edits write to `audit_log`; server validates `liveCount` ∈ (0, 9999], rejects timestamps in the future, and computes feed timestamps server-relative

### Public Site Content & 6-Market Expansion

- [ ] **CONTENT-01**: Hero, Catalog, Founders, and FAQ copy updated to mention all 6 source markets (USA, UAE, Europe, China, Korea, Japan); USA/UAE/Europe explicitly labelled «под индивидуальный заказ» until scrapers exist
- [ ] **CONTENT-02**: Country flags and `FlagFor` icons render for all 6 markets
- [ ] **CONTENT-03**: Catalog filter pills include all 6 markets with disabled / "coming soon" styling for markets without inventory
- [ ] **CONTENT-04**: Floating widget with Telegram, WhatsApp, phone, and callback-request CTAs appears on every public page
- [ ] **CONTENT-05**: Real founder bios and photos replace `src/crm/seed.ts` placeholder text
- [ ] **CONTENT-06**: At least 6 real customer reviews are present (or Reviews section is hidden until populated)
- [ ] **CONTENT-07**: At least 12 cars (scraped or admin-curated) are visible in catalog at launch
- [ ] **CONTENT-08**: FAQ contains at least 10 items covering payment, security, ПД-комплаенс, СБКТС/ЭПТС/утильсбор, и сценарий «под индивидуальный заказ» для US/AE/EU
- [ ] **CONTENT-09**: Site is fully responsive across desktop and mobile viewports; smoke-tested on Yandex Browser (desktop + mobile), Chrome, Safari, Firefox, Edge
- [ ] **CONTENT-10**: Car status badges use a typed enum (e.g. `in_transit`, `in_stock`, `to_order`, `auction`); admin cannot enter freeform strings

### Analytics

- [ ] **ANALYTICS-01**: Yandex Metrika installed on all public pages; no foreign analytics
- [ ] **ANALYTICS-02**: Conversion goals defined and firing: `open_quiz`, `complete_quiz_q5`, `submit_lead`, `pdf_downloaded`
- [ ] **ANALYTICS-03**: Founders have access to a Yandex Metrika funnel report covering the 4 goals

### Pre-Launch & Soft-Launch

- [ ] **LAUNCH-01**: Pre-launch checklist (PITFALLS «Looks Done But Isn't») executed with founder sign-off
- [ ] **LAUNCH-02**: Two end-to-end test runs (founder + 1 external user) complete: quiz → PDF in inbox → admin sees lead → admin can re-send PDF
- [ ] **LAUNCH-03**: First 24 hours of real traffic monitored: no error-tracker spike, no email-deliverability incidents, no scraper failures unhandled
- [ ] **LAUNCH-04**: Founders + sales reps trained on admin daily live-feed edit rhythm and lead triage flow

## v2 Requirements

Deferred to post-soft-launch. Tracked but not in current roadmap.

### Bitrix24 Sync

- **BITRIX-01**: Lead state changes sync to Bitrix24 deal pipeline via webhook
- **BITRIX-02**: Bitrix duplicates prevented by `dvapro_lead_id` custom field (write-side idempotency)
- **BITRIX-03**: Live homepage metrics computed from Bitrix instead of admin-managed
- **BITRIX-04**: Browse-tier leads (timing=«просто смотрю») routed to «Долгий цикл» funnel; hot/warm leads (timing≤3mo) trigger sales-rep alert

### Scraper Expansion

- **SCRAPE-EXPAND-01**: USA scraper (Copart / IAAI / AutoTrader / Cars.com — provider TBD)
- **SCRAPE-EXPAND-02**: UAE scraper (Dubizzle / YallaMotor — provider TBD)
- **SCRAPE-EXPAND-03**: Europe scraper (Mobile.de / AutoScout24 — provider TBD)

### Real Customs Calculation

- **CUSTOMS-01**: Real Russian customs duty + утилизационный сбор + VAT formulas (engine cc × age × фл/юл tier) calculated per car; PDF shows real landed-cost instead of stub

### Localisation

- **EN-01**: English locale for site copy + PDF (only if validated demand)

### Admin & UX Polish

- **MODERATE-01**: Admin moderation queue — scraped cars require approval before becoming public
- **PDF-PREVIEW-01**: Admin can preview generated PDF inline without leaving the panel
- **CDN-01**: CloudCDN / Selectel CDN in front of Object Storage bucket once bandwidth justifies it

## Out of Scope

| Feature | Reason |
|---------|--------|
| E-commerce checkout / онлайн-оплата | Оплата принципиально остаётся офлайн через продажников; договор + банковский счёт ООО, никаких карт на сайте |
| Per-car detail pages (публичные карточки авто) | Каталог-карточки ведут в квиз; убирает риск устаревших страниц после ухода машины с торгов; не соответствует workflow брокера |
| Mobile app (iOS / Android) | Адаптивный веб покрывает аудиторию v1; нативное приложение — нерелевантная сложность |
| USS Auctions scraper | Партнёрский логин, ToS-блок, риск permanent ban + утрата JP-партнёрства; данные USS — через лицензированный exporter feed по необходимости |
| Real Bitrix24 sync в v1 | Отложено в фазу после soft-launch; собственная БД — source of truth до интеграции |
| Real customs / utilisation-fee formulas в v1 | Регуляторные формулы сложны (engine cc × age × фл/юл tiers); продажник доводит цифру вручную; не блокируем запуск |
| USA / UAE / Europe scrapers в v1 | 4–6 нед бюджет не вмещает 3 дополнительных скрейпера; рынки заявлены публично, но «по индивидуальному заказу» |
| English locale в v1 | Русский — единственный язык до soft-launch |
| Customer self-service portal (трекер заказа клиентом) | После PDF клиент работает 1:1 с продажником; никакого личного кабинета — намеренный дизайн |
| Sentry SaaS / Google Analytics / Hotjar / Mailgun / Cloudflare in front of forms | 152-ФЗ: первичный сбор PII через зарубежный edge — штраф 1–18 М ₽ за запись; используем GlitchTip / Yandex Metrika / Unisender Go |
| Полная миграция на Next.js | Vercel заблокирован 152-ФЗ; re-platforming съест 1–1.5 нед бюджета без функционального выигрыша |
| Платежи криптой / нал | Явное «никаких чёрных касс и крипты» (взято из FAQ scaffold) |
| Fake counters или fake feed-ticker | Запрещено законом «О рекламе» РФ; live-данные — реальные admin-managed или из CRM |

## Traceability

Mapping of every v1 requirement to exactly one phase. Populated by gsd-roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Pending |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Pending |
| INFRA-06 | Phase 1 | Pending |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| LEGAL-01 | Phase 3 | Pending |
| LEGAL-02 | Phase 3 | Pending |
| LEGAL-03 | Phase 3 | Pending |
| LEGAL-04 | Phase 3 | Pending |
| LEGAL-05 | Phase 3 | Pending |
| LEAD-01 | Phase 4 | Pending |
| LEAD-02 | Phase 4 | Pending |
| LEAD-03 | Phase 4 | Pending |
| LEAD-04 | Phase 4 | Pending |
| LEAD-05 | Phase 4 | Pending |
| LEAD-06 | Phase 4 | Pending |
| LEAD-07 | Phase 4 | Pending |
| LEAD-08 | Phase 4 | Pending |
| PDF-01 | Phase 4 | Pending |
| PDF-02 | Phase 4 | Pending |
| PDF-03 | Phase 4 | Pending |
| PDF-04 | Phase 4 | Pending |
| PDF-05 | Phase 4 | Pending |
| PDF-06 | Phase 4 | Pending |
| MAIL-01 | Phase 4 | Pending |
| MAIL-02 | Phase 4 | Pending |
| MAIL-03 | Phase 4 | Pending |
| MAIL-04 | Phase 4 | Pending |
| MAIL-05 | Phase 4 | Pending |
| SCRAPE-01 | Phase 5 | Pending |
| SCRAPE-02 | Phase 5 | Pending |
| SCRAPE-03 | Phase 5 | Pending |
| SCRAPE-04 | Phase 5 | Pending |
| SCRAPE-05 | Phase 5 | Pending |
| SCRAPE-06 | Phase 5 | Pending |
| SCRAPE-07 | Phase 5 | Pending |
| SCRAPE-08 | Phase 5 | Pending |
| SCRAPE-09 | Phase 5 | Pending |
| SCRAPE-10 | Phase 5 | Pending |
| SCRAPE-11 | Phase 5 | Pending |
| AUTH-01 | Phase 6 | Pending |
| AUTH-02 | Phase 6 | Pending |
| AUTH-03 | Phase 6 | Pending |
| AUTH-04 | Phase 6 | Pending |
| AUTH-05 | Phase 6 | Pending |
| ADMIN-01 | Phase 6 | Pending |
| ADMIN-02 | Phase 6 | Pending |
| ADMIN-03 | Phase 6 | Pending |
| ADMIN-04 | Phase 6 | Pending |
| ADMIN-05 | Phase 6 | Pending |
| CONTENT-01 | Phase 7 | Pending |
| CONTENT-02 | Phase 7 | Pending |
| CONTENT-03 | Phase 7 | Pending |
| CONTENT-04 | Phase 7 | Pending |
| CONTENT-05 | Phase 7 | Pending |
| CONTENT-06 | Phase 7 | Pending |
| CONTENT-07 | Phase 7 | Pending |
| CONTENT-08 | Phase 7 | Pending |
| CONTENT-09 | Phase 7 | Pending |
| CONTENT-10 | Phase 7 | Pending |
| ANALYTICS-01 | Phase 7 | Pending |
| ANALYTICS-02 | Phase 7 | Pending |
| ANALYTICS-03 | Phase 7 | Pending |
| LAUNCH-01 | Phase 8 | Pending |
| LAUNCH-02 | Phase 8 | Pending |
| LAUNCH-03 | Phase 8 | Pending |
| LAUNCH-04 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 73 total
- Mapped to phases: 73 / 73 (100%)
- Unmapped: 0
- Doubly-mapped: 0

**Per-phase requirement counts:**
- Phase 1 (Compliance & Infra Foundation): 6
- Phase 2 (Schema, API Skeleton & Country Registry): 5
- Phase 3 (Frontend Integration, Consent & Legal): 5
- Phase 4 (Lead Flow End-to-End): 19 (8 LEAD + 6 PDF + 5 MAIL)
- Phase 5 (Inventory Pipeline): 11
- Phase 6 (Admin Auth, RBAC & Real Admin Panel): 10 (5 AUTH + 5 ADMIN)
- Phase 7 (Public Site Polish, Multi-Market UI & Analytics): 13 (10 CONTENT + 3 ANALYTICS)
- Phase 8 (Pre-Launch Checklist & Soft-Launch): 4

---
*Requirements defined: 2026-04-26*
*Last updated: 2026-04-26 — traceability table populated by gsd-roadmapper (8 phases, 100% coverage)*
