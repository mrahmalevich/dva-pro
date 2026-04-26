# DVApro

## What This Is

DVApro — авто-импортный маркетплейс для российских покупателей. Денис и Алексей подбирают и привозят автомобили с зарубежных рынков (Корея, Япония, Китай, США, ОАЭ, Европа) в Россию с 2005 года. Сайт превращает входящий интерес в квалифицированный лид: рассказывает о компании и основателях, показывает живые данные пайплайна и пропускает посетителя через короткий квиз, на выходе которого клиент получает персональный PDF с подобранными машинами и оценкой стоимости «под ключ», а сделка автоматически попадает в Bitrix24.

## Core Value

Посетитель доходит до конца квиза → получает на email брендированный PDF с подобранными авто и оценкой landed-cost → одновременно становится квалифицированным лидом в продажной воронке. Всё остальное (контент, лента, админка, мульти-маркет каталог) служит этой воронке.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Публичный сайт обновлён под все 6 рынков (USA, UAE, Europe, China, Korea, Japan): копирайт Hero/Catalog/FAQ/Founders, расширен enum Country, флаги/иконки, плейсхолдеры «coming soon» для рынков, по которым ещё нет скрейпера
- [ ] Квиз → PDF → email → лид-row, end-to-end, на существующих 5 вопросах (бюджет, кузов, состояние, использование, сроки)
- [ ] Генерация брендированного PDF через @react-pdf/renderer с поддержкой кириллицы (подобранные авто + stub оценки landed-cost + контакты основателей)
- [ ] Email-доставка PDF клиенту + копия в продажный канал
- [ ] Inventory pipeline: расписные скрейперы для Encar (KR), BeForward (JP), Che168 + Autohome (CN); все привязаны к нормализованной схеме `Car` в БД
- [ ] Master DB моделей: скрейпер drom.ru/catalog → характеристики/описания/диапазоны цен для всех релевантных моделей (используется для подбора и отображения, когда конкретного объявления нет)
- [ ] Бэкенд + БД, размещённые на российской инфраструктуре (152-ФЗ-комплаенс) — стек выбираем по итогам research-фазы
- [ ] Админ-панель: мультипользовательский доступ (founders + sales reps) с ролями; админ редактирует cars, leads, FAQ, reviews, feed, timeline, settings, live-метрики
- [ ] Live-данные на главной (liveCount, totalDelivered, avgDeliveryDays, satisfactionPct, in-work feed, FeedStrip) питаются из admin-управляемых значений в v1; реальная связка с Bitrix24 — в более поздней фазе
- [ ] Stub-оценка landed-cost: видна в PDF и админе, но без настоящих формул (фиксированный коэффициент / ручной ввод admin'ом по типу машины); реальный расчёт пошлин — позже
- [ ] Сохранение лида (контакты + ответы квиза + ссылка на сгенерированный PDF) в собственной БД; синхронизация с Bitrix24 через webhooks/REST — отложена в отдельную фазу

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- E-commerce checkout — оплата принципиально остаётся офлайн через продажников; комиссия посредника + договор + банковский счёт ООО, никаких карт на сайте
- Публичные карточки конкретных авто (per-car detail pages) — каталог-карточки ведут в квиз, а не на лендинг машины; убирает риск устаревших страниц после ухода машины с торгов и не соответствует workflow брокера
- Мобильное приложение (iOS/Android) — адаптивный веб покрывает аудиторию v1; нативное приложение — нерелевантная сложность
- Реальная синхронизация с Bitrix24 — отложена в фазу после soft-launch, чтобы не блокировать запуск; до тех пор лиды живут в собственной БД и читаются админкой
- Реальные формулы Russian customs / утилизационного сбора — отложены; в v1 — stub, чтобы не вязнуть в регуляторике до запуска
- Скрейперы USA / UAE / Europe — не в v1; рынки заявлены публично, но техническая интеграция — следующие фазы
- Скрейпинг USS Auctions (Япония) — партнёрский логин + ToS-блок, риск разрыва давних JP-отношений; данные USS берутся через лицензированный exporter feed (japanesecartrade / providecars / partner CSV) по необходимости, не самостоятельным скрейпером
- Полная миграция на Next.js — отвергнута: Vercel заблокирован 152-ФЗ, re-platforming съест 1–1.5 недели без функционального выигрыша; существующий Vite SPA остаётся
- Английская локаль — не в v1; русский — единственный язык до soft-launch
- Customer self-service portal (трекер заказа для клиента) — после получения PDF клиент работает 1:1 с продажником; никакого личного кабинета в v1
- Платёжная криптовалюта / нал — явно: «никаких чёрных касс и крипты» (взято из FAQ scaffold)

## Context

- **Существующий scaffold:** Vite + React 18 + TypeScript + react-router. В `src/` уже есть рабочий визуальный mock: маркетинговые секции (Hero, Catalog, Process, Founders, FAQ, Reviews, FeedStrip, LeadMagnet, Marquee, Footer), модальный квиз с 5 вопросами (`src/quiz/quizSpec.ts`), in-memory CrmProvider (`src/crm/`) с типами для Car / TimelineStep / FaqItem / Review / FeedItem / SiteSettings / Lead, и админ-редактор (`src/admin/*`) для всех этих сущностей. Нет бэкенда, нет БД, нет аутентификации, нет PDF-пайплайна, нет интеграций.
- **Country enum** сейчас ограничен `'jp' | 'cn' | 'kr'` — нужно расширить до 6 рынков; вся UI-фильтрация и флаги должны последовать.
- **Brand identity** уже существует в коде: тёмная тема (`data-theme="dark"`), JetBrains Mono как mono, акценты `--coral` / `--cyan` на `--ink`, типографика с italic-display. Сохраняем без редизайна.
- **Founders content** в `src/crm/seed.ts` — placeholder-биографии, но уже под реальными именами (Денис Сахаров, Алексей Старовойтов). Перед запуском нужно ревью реальных биографий и фото.
- **Russian-specific knowledge** (СБКТС, ЭПТС, утилизационный сбор, аукционы Японии USS, Encar по Корее, Хоргос по Китаю) уже отражена в FAQ/Process scaffold — это сильный сигнал, что доменная модель имеет вес и должна быть отражена в скрейперах и landed-cost stub'е.
- **Регуляторный контекст:** 152-ФЗ требует хранения персональных данных граждан РФ на российской инфраструктуре. Это блокирует Vercel/Cloudflare Workers как backend и определяет выбор хостинга.
- **Bitrix24 instance уже существует**, но интеграция отложена. До этого момента собственная БД — единственный source of truth для лидов.

## Constraints

- **Tech stack (frontend):** React 18 + Vite + TypeScript + react-router — уже есть, не меняем; всё новое (страницы, квиз-логика, админ) встраивается в этот скелет
- **Tech stack (backend):** Node.js 22 LTS + Hono 4.12 (`@hono/node-server`) + Drizzle ORM 0.45 + PostgreSQL 16 + pg-boss queue (BullMQ-on-Redis upgrade path) + Crawlee/Playwright 1.59 + `@react-pdf/renderer` 4.5 + Better-Auth + Yandex Object Storage (S3-совместимое). Один codebase, два процесса (api + worker)
- **Timeline:** soft-launch 4–6 недель от старта (≈ 2026-06-07). Фазы режутся агрессивно ради этого срока
- **Compliance:** 152-ФЗ — персональные данные граждан РФ хранятся на российских серверах
- **Hosting:** Yandex Cloud `ru-central1` (managed PG, Object Storage, Compute, optional managed Redis). 152-ФЗ + FSTEC + UZ-1 посткра подтверждена в research
- **PDF tooling:** `@react-pdf/renderer` — обязательная поддержка кириллицы и брендового стиля
- **CRM target:** Bitrix24 (REST + webhooks) — интеграция отложена в отдельную фазу
- **Браузерная поддержка:** последние 2 версии Chrome / Safari / Firefox / Edge на desktop + mobile; Yandex Browser — обязательно
- **Locale:** RU only в v1
- **Inventory data sources (v1):** Encar.com (KR), BeForward (JP), Che168 + Autohome (CN), drom.ru/catalog (master models). USS — через лицензированный exporter feed по необходимости (не скрейпер). USA/UAE/Europe источники — не в v1
- **Email/SMTP:** Unisender Go (RU-резидентский транзакционный сервис; backups: SendPulse RU, Mailopost). DMARC + SPF + DKIM + 2-недельный warm-up отправляющего домена `dva.pro` обязательны

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| v1 заявляет все 6 рынков публично, но скрейперы только для KR/JP/CN | Брендинг и SEO работают сразу на полный масштаб; технический долг по US/AE/EU решается после soft-launch | — Pending |
| Inventory: scheduled scrape → собственная БД (не live-scrape) | Стабильность, скорость UX, контроль качества данных; цена — staleness, решается частотой обновления | — Pending |
| drom.ru/catalog как master-DB моделей и характеристик | Развязывает «нужно показать машину, которой нет в наличии» от наличия объявления; кириллический контент готов | — Pending |
| Landed-cost — stub в v1 (без реальных формул пошлин) | Регуляторные формулы (engine cc × age × фл/юл, утильсбор) — недели работы; продажник доводит цифру вручную; не блокируем запуск | — Pending |
| Live-метрики на главной питаются из admin-панели в v1, Bitrix24 sync позже | Декаплинг от внешней интеграции; админка уже существует | — Pending |
| PDF генерируется через `@react-pdf/renderer` | React-стек, Cyrillic-friendly, designer-friendly; альтернатива (Puppeteer) — тяжелее в проде | — Pending |
| Хостинг — российская инфраструктура | 152-ФЗ-комплаенс non-negotiable; конкретный провайдер выбирается в research | — Pending |
| Auth: multi-user с ролями (founder / sales rep) | И founders, и менеджеры заходят в админку; разделение прав предотвращает админ-хаос | — Pending |
| Backend стек: Hono 4.12 на Node 22 + Drizzle + Postgres 16 + pg-boss + Crawlee, deploy на Yandex Cloud ru-central1 | Минимальный re-platforming surface vs существующий Vite SPA, web-standards primitives, малый image, всё необходимое для 4–6 нед запуска; Yandex Cloud — единственный провайдер с явной 152-ФЗ + FSTEC + UZ-1 постурой. Next.js миграция отвергнута (Vercel заблокирован 152-ФЗ + 1.5 нед re-platforming за 0 функционального выигрыша) | — Pending |
| USS Auctions: НЕ скрейпим в v1 | Партнёрский логин, ToS-блок, риск permanent ban + утрата JP-партнёрства. Данные USS берутся через лицензированный exporter feed (japanesecartrade / providecars / partner CSV) когда нужно | — Pending |
| Queue: pg-boss в v1, BullMQ как upgrade-путь | pg-boss убирает Redis из критического пути запуска; BullMQ design'ится через интерфейс для механического свопа когда scraper throughput потребует | — Pending |
| Anti-features залочены: no e-commerce, no per-car pages, no mobile app | Защищает scope от ползучих расширений и фокусирует усилия на квиз-воронке | — Pending |
| Bitrix24 интеграция — отдельная фаза после soft-launch | Не блокирует запуск; собственная БД — source of truth до интеграции | — Pending |
| Существующий scaffold (Vite SPA) — основа, без редизайна | Брендинг уже на высоком уровне (тёмная тема, JetBrains Mono, --coral/--cyan); время → пайплайн, не на новый UI | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-26 after research synthesis (USS exclusion + backend stack lock)*
