# Roadmap: DVApro

**Created:** 2026-04-26
**Granularity:** standard (8 phases)
**Soft-launch target:** ≈ 2026-06-07 (4–6 weeks)
**Total v1 requirements:** 73, all mapped (100% coverage)

> Core value: посетитель проходит квиз → получает на email брендированный PDF с подобранными авто и landed-cost stub → одновременно становится квалифицированным лидом в продажной воронке. Каждая фаза существует, чтобы эта петля закрылась end-to-end на soft-launch и не нарушала 152-ФЗ.

---

## Phases

- [ ] **Phase 1: Compliance & Infra Foundation** — Yandex Cloud `ru-central1` + Roskomnadzor notification + DNS warm-up — всё, что не ускоряется кодом и должно стартовать первым
- [ ] **Phase 2: Schema, API Skeleton & Country Registry** — Drizzle schema всех таблиц, Hono `api` + `worker` процессы, public read API, единый реестр 6 стран
- [ ] **Phase 3: Frontend Integration, Consent & Legal** — `CrmProvider` поверх real API + react-query, 152-ФЗ чек-бокс, `/legal/*` страницы, ИНН/ОГРН в footer
- [ ] **Phase 4: Lead Flow End-to-End (Quiz → PDF → Email)** — `POST /api/public/leads`, pg-boss pipeline, Cyrillic PDF, Unisender Go отправка с landed-cost stub
- [ ] **Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers)** — Crawlee fleet, residential proxy, image rehosting, soft-delete, CBR FX feed
- [ ] **Phase 6: Admin Auth, RBAC & Real Admin Panel** — Better-Auth с ролями founder/sales_rep, audit_log, LeadsAdmin/CarsAdmin/SettingsAdmin поверх real DB
- [ ] **Phase 7: Public Site Polish, Multi-Market UI & Analytics** — копирайт под 6 рынков, floating widget, флаги/бейджи, Yandex Metrika + 4 цели, mobile/Yandex Browser smoke-test
- [ ] **Phase 8: Pre-Launch Checklist & Soft-Launch** — «Looks Done But Isn't» check, 2× E2E прогона, 24h мониторинг, тренинг команды

---

## Phase Details

### Phase 1: Compliance & Infra Foundation

**Goal:** Поднять российскую инфраструктуру и юридический фундамент так, чтобы ни одна последующая фаза не блокировалась 152-ФЗ или email-deliverability календарём.
**Depends on:** ничего — стартует первой
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
**Parallelisable with:** Founder content collection (биографии, фото, отзывы) — pure-content track, не зависит от кода
**UI hint:** no

---

### Phase 2: Schema, API Skeleton & Country Registry

**Goal:** Развернуть бэкенд-скелет (Hono `api` + `worker`), все Drizzle-схемы и public read API так, чтобы P3 (frontend integration) и P4 (lead flow) могли строиться параллельно по реальному контракту.
**Depends on:** Phase 1 (нужны provisioned PG + image registry + GitLab CI)
**Requirements:** API-01, API-02, API-03, API-04, API-05
**Success Criteria** (what must be TRUE):
  1. `api` и `worker` процессы запускаются из одного Docker image и деплоятся в Yandex Cloud; `/healthz` возвращает 200
  2. Drizzle migrations применены: существуют таблицы `cars`, `models`, `leads`, `users`, `sessions`, `audit_log`, `consent_log`, `faq`, `reviews`, `feed`, `timeline`, `settings`
  3. Country registry экспортирует 6 рынков (`kr`, `jp`, `cn`, `us`, `ae`, `eu`) с `scraperReady` flag; SPA импортирует именно отсюда — `grep` по `'jp' | 'cn' | 'kr'` в `src/` возвращает 0 совпадений
  4. Public read endpoints (`GET /api/public/{cars,faq,reviews,feed,timeline,settings}`) возвращают данные с TS-типами, разделяемыми между сервером и фронтом через `packages/shared`
  5. Все public/admin endpoints валидируют payload через Zod; невалидный payload даёт HTTP 400 со структурированной ошибкой (`{code, field, message}`)
**Plans**: TBD
**Complexity:** M
**Research-spike:** no — Drizzle schema механически выводится из ARCHITECTURE.md
**Parallelisable with:** Founder content writing (продолжается из P1), PDF template design draft (можно начинать как только schema готова)
**UI hint:** no

---

### Phase 3: Frontend Integration, Consent & Legal

**Goal:** Перевести фронт с in-memory `CrmProvider` на real API и закрыть 152-ФЗ surface (consent UI + legal pages + ИНН/ОГРН) до того, как первая публичная форма пойдёт в продакшен.
**Depends on:** Phase 2 (нужны public read API + shared types)
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
**Parallelisable with:** Phase 4 lead-flow backend work (pipeline на бэке можно строить пока фронт мигрирует), founder content
**UI hint:** yes

---

### Phase 4: Lead Flow End-to-End (Quiz → PDF → Email)

**Goal:** Закрыть «money flow» — посетитель проходит квиз → лид в БД → PDF в S3 → email в inbox с подписями фаундеров и landed-cost stub. Это сердце продукта; всё остальное декорация.
**Depends on:** Phase 1 (DNS warm-up, S3 bucket), Phase 2 (`leads` schema + queue tables), Phase 3 (consent UI собирает согласие до сабмита)
**Requirements:** LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, LEAD-06, LEAD-07, LEAD-08, PDF-01, PDF-02, PDF-03, PDF-04, PDF-05, PDF-06, MAIL-01, MAIL-02, MAIL-03, MAIL-04, MAIL-05
**Success Criteria** (what must be TRUE):
  1. Тестовый посетитель проходит 5-вопросный квиз, видит SuccessStep «PDF придёт в почту в течение 5 минут», получает HTTP-ответ <100мс и `{queued: true}`
  2. PDF приходит на @yandex.ru / @mail.ru / @rambler.ru / @gmail.com inbox (не Spam), весит ≤ 2MB, содержит подобранные авто + подписи Дениса+Алексея + landed-cost stub + дисклеймер «предварительная оценка» на каждой странице с ценой
  3. CI Cyrillic-fixture тест («Денис Сахаров — заявка №12345 от 26.04.2026») проходит — никаких `□` в rendered PDF тексте; все веса/стили шрифта зарегистрированы явно
  4. `leads` row сохраняется до того, как PDF/email отрабатывают; failed PDF render → `pdf_failed`, failed email → `email_failed`, admin (founder mailbox) уведомлён; повторный submit с тем же idempotency key не создаёт новый лид
  5. Sales-channel (founder mailbox) получает BCC каждого лид-email; matcher выдаёт ≥1 авто из admin-curated fallback / model-DB даже когда live inventory ещё пуст
**Plans**: TBD
**Complexity:** L
**Research-spike:** YES — Cyrillic font selection (Inter vs PT Sans vs IBM Plex Sans + license check); Unisender Go transactional template format и inbox-placement smoke test против @yandex.ru/@mail.ru/@rambler.ru
**Parallelisable with:** Phase 5 scraper plumbing (можно стартовать как только `cars` schema есть из P2; matcher тестируется на hand-INSERT'ed cars), Phase 6 admin polish (но не leads-admin — она ждёт auth)
**UI hint:** yes

---

### Phase 5: Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers)

**Goal:** Поднять scraper fleet — сначала Encar end-to-end (тяжелейший anti-bot), потом drom.ru/catalog как master models, затем BeForward, Che168, Autohome — с общим shared/normalize/images/http и worker isolation.
**Depends on:** Phase 2 (`cars`, `models` schema), Phase 1 (Object Storage bucket для image rehosting)
**Requirements:** SCRAPE-01, SCRAPE-02, SCRAPE-03, SCRAPE-04, SCRAPE-05, SCRAPE-06, SCRAPE-07, SCRAPE-08, SCRAPE-09, SCRAPE-10, SCRAPE-11
**Success Criteria** (what must be TRUE):
  1. Encar scraper отрабатывает по cron (Crawlee + Playwright Firefox + KR residential proxy), UPSERT'ит в `cars` через `(source='encar', source_id)` UNIQUE; running дважды подряд не создаёт дубликатов
  2. drom.ru/catalog scraper еженедельно наполняет `models` master DB (brand, model, year range, body, drivetrain, engine, base price range, RU-описание); matcher из P4 falls back на эти модели когда live inventory не подходит
  3. BeForward (JP), Che168 (CN), Autohome (CN) scrapers работают по cron и пишут в `cars` через тот же shared plumbing (`normalize/images/http`); USS не скрейпится — вместо неё закладка под лицензированный exporter feed (документировано в README)
  4. Каждый scraper rehost'ит исходные картинки в Yandex Object Storage (`images/cars/{source}/{source_id}/`); публичный UI/PDF никогда не hot-link'ит на encar/che168/autohome домены; стресс-тест на 100 картинках проходит
  5. Per-source метрики (`last_success_at`, `last_run_duration`, `cars_added`, `cars_marked_sold`) экспортируются в admin endpoint; soft-delete через `last_seen_at` работает (UI скрывает cars старше N дней, admin может override); brand/model канонизируются через Cyrillic↔Latin lookup table; цена хранится в source-currency, RUB вычисляется на чтение из CBR daily XML
**Plans**: TBD
**Complexity:** L
**Research-spike:** YES — KR + CN residential proxy provider selection и monthly budget; Encar fingerprint detection severity (если >3 дней — fallback на Carapis API); drom.ru/catalog `baza.drom.ru/help/API` legal route check; BeForward HTML parser shape
**Parallelisable with:** Phase 6 admin auth (auth-stack независим от scrapers), founder content writing
**UI hint:** no

---

### Phase 6: Admin Auth, RBAC & Real Admin Panel

**Goal:** Дать founders + sales reps аутентифицированный доступ к real-DB админке с ролевой моделью и audit-log; без этого LeadsAdmin не имеет права жить в проде, потому что лиды — PII.
**Depends on:** Phase 2 (`users`, `sessions`, `audit_log` schema), Phase 4 (real `leads` table уже наполняется), Phase 5 (real `cars`/`models` уже наполняются — иначе CarsAdmin нечего показывать)
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
**Parallelisable with:** Phase 7 content polish, Phase 5 scraper sources 2–4 (если P5 ещё в полёте)
**UI hint:** yes

---

### Phase 7: Public Site Polish, Multi-Market UI & Analytics

**Goal:** Завершить публичный фронт под обещанные 6 рынков, поставить Yandex Metrika с целями и довести site до launch credibility (founder content, real reviews, mobile, Yandex Browser).
**Depends on:** Phase 3 (`CrmProvider` уже на real API), Phase 5 (хотя бы Encar даёт реальные cars в каталог), Phase 6 (admin может править content live)
**Requirements:** CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, CONTENT-06, CONTENT-07, CONTENT-08, CONTENT-09, CONTENT-10, ANALYTICS-01, ANALYTICS-02, ANALYTICS-03
**Success Criteria** (what must be TRUE):
  1. Hero/Catalog/Founders/FAQ копирайт упоминает все 6 рынков (USA, UAE, Europe, China, Korea, Japan); US/AE/EU явно помечены «под индивидуальный заказ»; Catalog filter pills включают все 6 с disabled/«coming soon» стилем для рынков без скрейпера; `FlagFor` рендерит 6 флагов
  2. Floating widget (Telegram + WhatsApp + phone + callback-request CTA) появляется на каждой публичной странице; callback пишется как `Lead` с `source='callback'`
  3. Реальные founder bios+фото заменили placeholder в `src/crm/seed.ts`; ≥6 реальных отзывов в Reviews (или секция спрятана); ≥12 авто в каталоге (scraped или admin-curated); FAQ ≥10 пунктов покрывает оплату/безопасность/152-ФЗ/СБКТС/ЭПТС/утильсбор/«под индивидуальный заказ»
  4. Сайт проходит mobile audit (desktop+mobile, последние 2 версии Chrome/Safari/Firefox/Edge + Yandex Browser desktop+mobile); car status badges используют typed enum (`in_transit`, `in_stock`, `to_order`, `auction`), admin не может ввести freeform
  5. Yandex Metrika установлена на всех публичных страницах; цели `open_quiz`, `complete_quiz_q5`, `submit_lead`, `pdf_downloaded` срабатывают в test-сессии и видны в Metrika funnel report; founder имеет логин с доступом
**Plans**: TBD
**Complexity:** M
**Research-spike:** no — стандартные UX/QA/Metrika задачи
**Parallelisable with:** Phase 5 scrapers (если ещё не закрыты), Phase 6 admin polish; founder content writing завершается здесь
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
| 1. Compliance & Infra Foundation | 0/0 | Not started | — |
| 2. Schema, API Skeleton & Country Registry | 0/0 | Not started | — |
| 3. Frontend Integration, Consent & Legal | 0/0 | Not started | — |
| 4. Lead Flow End-to-End (Quiz → PDF → Email) | 0/0 | Not started | — |
| 5. Inventory Pipeline (Encar + drom.ru/catalog + JP/CN scrapers) | 0/0 | Not started | — |
| 6. Admin Auth, RBAC & Real Admin Panel | 0/0 | Not started | — |
| 7. Public Site Polish, Multi-Market UI & Analytics | 0/0 | Not started | — |
| 8. Pre-Launch Checklist & Soft-Launch | 0/0 | Not started | — |

---

## Sequencing & Parallelisation Notes

**Hard sequence (calendar-bound):**
- Phase 1 первой — Roskomnadzor 5-day window + Unisender Go 14-day warm-up идут *в фоне*, поэтому код-фазы 2–7 могут стартовать в неделю 1, но Phase 4 не отправит первый production-email пока warm-up не завершён.
- Phase 2 schema до Phase 3 frontend rewrite — иначе CrmProvider пишется против моков, а потом переписывается дважды.
- Phase 3 consent UI до того, как любая публичная форма пойдёт live в Phase 4 — 152-ФЗ irreversible.
- Phase 4 lead flow до Phase 5 scraper fleet — matcher тестируется на hand-INSERT'ed cars; scrapers без matcher некуда подключать.
- Внутри Phase 5: Encar end-to-end раньше остальных трёх scrapers — shared `normalize/images/http` plumbing стресс-тестируется на самом сложном источнике.
- Phase 6 admin auth до того, как LeadsAdmin пойдёт live — leads = PII, нужен audit + RBAC gate.
- Phase 7 → Phase 8 — content/QA/analytics до launch checklist.

**Parallel tracks (config has parallelization=true):**
- **Founder content** (биографии, фото, отзывы, видео-pitch) — pure content, можно начинать в Phase 1 и завершать в Phase 7; не блокирует никакую код-фазу
- **PDF template design draft** — стартует как только schema из Phase 2 готова, готовится параллельно с Phase 3
- **Phase 5 scraper plumbing** — можно стартовать параллельно с Phase 4, если есть свободные руки; matcher из P4 тестируется на hand-INSERT'ed cars независимо
- **Phase 6 admin polish (CarsAdmin / FaqAdmin / ReviewsAdmin)** — параллельно с Phase 5, потому что cars/faq/reviews не требуют lead-flow
- **Unisender Go warm-up + DNS reputation monitoring** — продолжаются как фоновая задача с Phase 1 до Phase 8

---

## Calendar Sanity Check (4–6 weeks → soft-launch ≈ 2026-06-07)

| Week | Primary work | Parallel track |
|------|--------------|----------------|
| 1 (Apr 27 – May 3) | Phase 1 (infra + Roskomnadzor подача + DNS warm-up start) | Founder content kickoff |
| 2 (May 4 – May 10) | Phase 2 (schema + API skeleton + country registry) | Phase 3 prep, PDF template design |
| 3 (May 11 – May 17) | Phase 3 (CrmProvider rewrite + consent + legal) + Phase 4 start (PDF pipeline) | Phase 5 scraper plumbing scaffolding |
| 4 (May 18 – May 24) | Phase 4 finish (E2E lead flow на yandex.ru/mail.ru) + Phase 5 Encar end-to-end | Phase 6 auth scaffolding |
| 5 (May 25 – May 31) | Phase 5 finish (BeForward + Che168 + Autohome + drom.ru/catalog) + Phase 6 (auth + admin) | Phase 7 content + analytics |
| 6 (Jun 1 – Jun 7) | Phase 7 finish (mobile + Yandex Browser + Metrika) + Phase 8 (checklist + E2E + training + launch) | — |

**Risk lines:**
- If Encar fingerprint detection > 3 days → switch to Carapis paid API (decision in P5 research-spike)
- If Unisender Go warm-up has spam complaints in week 2 → tighten DMARC `p=quarantine` + delay first prod-email до week 3
- If P5 ест >2 недель → Che168 + Autohome могут уйти в v1.x, оставив Encar+BeForward+drom.ru как минимум для launch (CONTENT-07 требует 12+ авто в каталоге — admin-curated cars покрывают gap)

---

## Out of v1 Roadmap (deferred to post-soft-launch)

- Bitrix24 sync (BITRIX-01..04)
- US/UAE/Europe scrapers (SCRAPE-EXPAND-01..03)
- Real customs/utilsbor formulas (CUSTOMS-01)
- EN locale (EN-01)
- Admin moderation queue, PDF preview inline, CDN (MODERATE-01, PDF-PREVIEW-01, CDN-01)

These are tracked in REQUIREMENTS.md v2 and surface as separate milestones after soft-launch metrics validate priority.

---
*Last updated: 2026-04-26 — initial roadmap creation by gsd-roadmapper*
