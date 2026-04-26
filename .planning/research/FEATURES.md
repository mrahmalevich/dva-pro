# Feature Research — DVApro (Russian vehicle-import broker funnel)

**Domain:** Маркетинговый сайт + квиз → персональный PDF → лид-row для импортного авто-брокера (Корея/Япония/Китай в v1, заявленные US/AE/EU без скрейперов)
**Researched:** 2026-04-26
**Confidence:** MEDIUM-HIGH (comp set: Trust Encar, Japan Transit, AVADGE, Kimura, Drom.ru, Otrada, DSS Group, Carskorea — все живые ru-broker-сайты; конверсионная статистика квизов — Interact Quiz Report 2026, Marquiz; Bitrix24 REST API — официальная документация)

## TL;DR for the roadmap

1. **Existing scaffold уже покрывает 70% table-stakes** (Hero, Process, Founders, Catalog cards, FAQ, Reviews, FeedStrip, Live counters, 5-вопросный квиз, admin для всего этого). Не предлагать заново то, что есть.
2. **Острые гэпы для v1**: реальная PDF-генерация, реальная отправка email, реальная БД для лидов, реальная админ-аутентификация, мульти-маркет фильтр (расширение Country с 3 до 6), коммуникационные кнопки в фиксированном виджете (Telegram/WhatsApp/callback), правовые реквизиты (ИНН/ОГРН), Yandex Metrica с целями.
3. **Ключевой differentiator** — связка «брендированный PDF с landed-cost stub'ом + Founders-as-product (Денис/Алексей с биографиями + личной подписью на PDF)». В comp set у конкурентов либо PDF нет, либо он шаблонный, либо подбор замыкается на «менеджер перезвонит».
4. **Самый рискованный compliance-блокер на уровне фич**: 152-ФЗ требует чек-бокса согласия на обработку ПД при сабмите квиза + ссылку на политику конфиденциальности — это _уровень table stakes_ для любой формы в РФ, и в скаффолде этого пока нет.

---

## Feature Landscape

### Table Stakes (Без них доверие не строится)

Russian B2C-аудитория покупки авто 1.5–25M ₽ ожидает эти сигналы. Их отсутствие → вопрос «это вообще не скам?» в первые 10 секунд.

| Feature | Why Expected | Complexity | Scaffold? | Notes |
|---|---|---|---|---|
| Юр-реквизиты компании в footer (ИНН/ОГРН/полное наименование ООО или ИП) | Все живые конкуренты (Trust Encar, AVADGE, OTRADA, DIAUTO) показывают это; без него «непонятно, кому платить» — продажа авто за 5–25M ₽ требует юрлица | S | Нет | Добавить в `SiteSettings` + `Footer.tsx`. Может тащить за собой банковские реквизиты в PDF (commercial offer уровня) |
| Согласие на обработку ПД (152-ФЗ чек-бокс) на формах | Юридически обязательно при сборе персданных в РФ; ФАС/Роскомнадзор штрафует. Без него и квиз, и callback-форма уязвимы | S | Нет | Чек-бокс по умолчанию unchecked + ссылка на `/privacy`. Касается **квиза, callback, любой формы**. Зависит от: страница `/privacy` (`/legal/personal-data-policy`) |
| Политика конфиденциальности и публичная оферта | Тот же 152-ФЗ + ЗоЗПП. Ссылки в footer + чек-бокс ссылается сюда | S | Нет | Можно generic-шаблон, кастомизированный под DVApro. Один markdown-роут |
| Мульти-канальная связь (телефон + Telegram + WhatsApp как минимум) | Trust Encar, Japan Transit, AVADGE — все 3 канала. RU-аудитория для дорогих покупок _предпочитает мессенджеры_, особенно во Владивостоке/ДВ. WhatsApp нестабильно работает в РФ → Telegram — основной | S | Частично (telegram/whatsapp ссылки в settings, нет UI-виджета) | Floating contact widget bottom-right — табы Telegram / WhatsApp / Callback. См. дифференциатор «callback-widget» ниже |
| Цена «под ключ» с явной расшифровкой (что входит) | Главный болевой паттерн в Drom-форумах: «привезли — и тут +600k к смете». Конкуренты (Trust Encar, Japan Transit) показывают _две цены_ — корейскую/японскую и «под ключ во Владивостоке». Это снимает страх скрытых платежей | M | Частично (есть `price` и `priceLocal` в Car) | Уже моделируется через `price` (под ключ) и `priceLocal` (в стране). FAQ-item «что входит в под-ключ» уже есть. Стоит добавить tooltip/details на hover карточки |
| FAQ с вопросами про сроки/документы/оплату/возврат | Все brokery имеют. Без FAQ конверсия падает — клиент уходит гуглить | S | Да (`Faq.tsx`, 6 items в seed) | Контент уже сильный. Доработать копирайт, добавить пару вопросов про US/AE/EU «coming soon» |
| Видимый процесс «как мы работаем» (timeline) | Trust Encar (8 этапов), Japan Transit (5), AVADGE (8) — все. Снижает FUD | S | Да (`Process.tsx`, 6 шагов) | Уже сильно. Возможно нужны иллюстрации/иконки на каждый шаг |
| Каталог карточек авто с фильтром по стране | Минимальный inventory-вид. Без него непонятно, что вообще привозят | S | Да (`Catalog.tsx`) | **CRITICAL расширение**: Country enum c `'jp'\|'cn'\|'kr'` → 6 стран; флаги для US/AE/EU; «coming soon» badge для рынков без скрейпера |
| Статус-бейджи «В наличии / В пути / Под заказ» на карточках | Стандарт RU-импорта (Drom, Avadge, Japan Transit). Снимает вопрос «это уже едет или мне неделями ждать?» | S | Да (`badges: string[]` свободной формы) | Стоит **типизировать** `badges` в enum для consistency: `in-stock`, `in-transit`, `on-order`, `auction`, плюс свободные тэги (Premium/Hybrid). Иначе админ напишет вариативный мусор |
| Отзывы клиентов с моделью авто и городом | Стандарт. Без них — «фотошоп-сайт» | S | Да (`Reviews.tsx`, 3 в seed) | Контент уже на хорошем уровне. Добавить возможность фото (опционально), доработать админку |
| Инфо о основателях с лицами и опытом | DVApro — это про «свои ребята», брендинг построен на founders. Trust Encar держится на «официальный бренд Encar», у DVApro — на людях. Без фото/биографий пропадает differentiator | S | Да (`Founders.tsx` + `founderRu`/`founderKr` в settings) | Заглушки уже под реальными именами. Перед запуском — реальные фото и биографии (нон-блокер для скаффолда) |
| Упоминание ключевых документов (СБКТС/ЭПТС/утильсбор) | Без этого — «непрофессионально». Все brokery упоминают. У DVApro в FAQ и Process уже есть | S | Да | Хорошо, ничего делать не надо |
| Объяснение видео-осмотра (раз есть инспекция) | Trust Encar / Drom посты явно: «без видео-осмотра не доверяй». В скаффолде это упомянуто в Process step 3 | S | Да | Можно усилить визуально на главной (см. дифференциатор «video-inspection sample») |
| Yandex Metrica с целями на конверсиях квиза | RU-аудитория = 73% Yandex (Statcounter 2025). Без Метрики не выйдет ни Директ-кампанию настроить, ни оптимизировать воронку | S | Нет | Установить счётчик; настроить goals на: open_quiz, complete_question_N, submit_lead, pdf_downloaded. Зависит от: бэкенд готов отправлять offline-conversion с lead.id |
| Mobile-responsive layout | 70%+ RU-трафика мобильный (Yandex Webmaster). Не отдельная фича, а дисциплина | M | Частично (нужно валидировать каждую секцию) | На скаффолде есть `flexbox`/`grid` но нужен полный mobile audit перед soft-launch |
| Yandex Browser совместимость | Из constraints. Yandex Browser ≈ Chromium-based, в основном работает, но требует QA | S | — | Тестовая матрица |
| Brand-consistent header с логотипом и навигацией | Базовый UX. Заметно, что в скаффолде нет отдельного `Header.tsx` — есть только `Hero` с inline-навом? Стоит проверить | S | ? | См. структуру `App.tsx`, может уже есть. Если нет — навигация должна закреплять CTA «Подобрать за 5 минут» |

### Differentiators (Конкурентное преимущество — стоит инвестировать в v1)

Эти фичи в comp set либо отсутствуют, либо реализованы слабо. Здесь DVApro может выиграть.

| Feature | Value Proposition | Complexity | Scaffold? | Notes |
|---|---|---|---|---|
| **5-вопросный квиз с моментальной выдачей PDF на email** (а не «менеджер перезвонит, чтобы что-то прислать») | В comp set: Trust Encar — 8 шагов с финальным «бонус», без PDF; Japan Transit — короткая форма; Marquiz-стиль «оставьте телефон» — без артефакта. **PDF-в-почте — мгновенный результат,** который остаётся у клиента и работает как commercial offer. Interact Quiz Report 2026: интерактивные lead-magnet-квизы конвертят в 16x относительно статичных форм | L | Частично (квиз есть как UI, нет PDF + email + persistence) | См. dependency map ниже. Связка: quiz → backend POST /leads → PDF render (`@react-pdf/renderer`) → email-отправка → save lead. Это — **сердце v1** |
| **5-вопросный квиз** (а не 8–10, как у конкурентов) | Interact Quiz Report 2026: completion rate начинает резко падать после 7 вопросов; «sweet spot» 5–7 при чёткой ценности. У DVApro сейчас 5 — это правильно. Не растягивать | — | Да (`quizSpec.ts`) | Сохраняем 5 вопросов. Ловушка — растянуть до 8 «чтобы лучше квалифицировать»; вместо этого — **квалификацию делать в admin/sales**, не в квизе |
| **Брендированный PDF с подобранными авто + landed-cost stub + контактами founders с подписью** | В comp set брокеры либо PDF не отправляют, либо это generic-каталог. PDF с _именованной подписью_ Дениса/Алексея под каждой опцией — материализация бренда «свои ребята». Клиент держит PDF в руках = retention | L | Нет | `@react-pdf/renderer` уже выбран в STACK. Cyrillic font (`PT Sans` / `Inter`) необходим. См. PITFALLS |
| **Multi-market бренд (6 стран) при scrapers только на 3** | Конкуренты обычно специализируются (Корея ИЛИ Япония ИЛИ Китай); кто работает с US/AE/EU (AVADGE, OTRADA) — отдельные витрины. DVApro заявляет 6 рынков сразу = шире SEO-охват, чище позиционирование «международный брокер» | M | Частично (`Country` нужно расширить + UI флаги/копирайт) | UX-паттерн: фильтры в каталоге показывают флаги всех 6, но карточки US/AE/EU помечены `coming-soon` или «под индивидуальный заказ — оставьте заявку». Не врать, что есть inventory которого нет |
| **Live-counter «X авто в пути сейчас» + admin-управляемый feed-ticker «в работе сейчас»** | Trust Encar — счётчик просмотров на карточке (слабый сигнал); AVADGE — статичный «470+ доставлено». DVApro имеет _оба слоя_ — общая статистика (totalDelivered, satisfactionPct) **и** живая лента «Lexus LX 600 — выгружен во Владивостоке, 2 мин назад». Это материализует «работа кипит». **Этический аспект**: feed должен быть _реальным_ (управляется админом, не fake-генератор) — Nudgify/Fomo прямо запрещают подделку | M | Да (`liveCount`, `feed`, `FeedStrip`, `Counter` атом, admin-редактор) | Уже хорошо. Перед launch — продумать workflow: кто и как часто обновляет feed (минимум 5–7 событий за день, иначе «3 часа назад» убивает доверие). Возможен будущий auto-pull из Bitrix24 — но это пост-v1 |
| **Founders-as-product** (Денис + Алексей как главные лица, не безликий «менеджер») | Уникально в comp set. DSS, Trust Encar, Japan Transit — обезличенные «наши специалисты». В РФ B2C-сегменте 5–25M ₽ персонификация работает (паттерн Тинькоф, Дзена) | S (контент) | Да (`Founders.tsx`) | Контент-тяжёлая работа: фото, био, видео-обращение от каждого. Можно — короткий видео-pitch на главной (1 мин «о нас»). См. nice-to-have «video-pitch» |
| **Floating multi-channel contact widget (Telegram + WhatsApp + Callback)** в углу страницы | Все RU-broker-сайты имеют либо звонок, либо одну кнопку. RedConnect/UpToCall дают +30–80% конверсии в звонки. У DVApro в settings уже есть telegram/whatsapp ссылки — нужен **виджет**, который их использует | M | Нет UI (есть данные) | Bottom-right floating button → expand на 3 кнопки. Callback — модалка «введите телефон, перезвоним за 30 сек». Должна писать `Lead` с источником `'callback'`, чтобы в admin было видно. **Не использовать сторонние сервисы** (Envybox, RedConnect) — лидаются их домены, и 152-ФЗ заставит их быть в РФ |
| **Прозрачная смета в PDF** с разбивкой: цена авто + аукционный сбор + фрахт + страхование + таможня + утильсбор + СБКТС/ЭПТС + доставка по РФ | Это **anti-«скрытые платежи»**. Конкуренты дают калькулятор-блек-бокс («2.4M ₽ под ключ»). DVApro в PDF может показать **построчную смету**, даже если значения — stub-коэффициенты | M | Нет (но landed-cost stub в плане) | Зависит от: PDF-pipeline. Уже в Active requirements |
| **Admin-управляемые «карточки моделей» (master-DB из drom.ru/catalog) для подбора, когда живого объявления нет** | Уникальное преимущество архитектурное: в comp set если нет в наличии — нет в каталоге. У DVApro подбор может вернуть «вот такая модель, привезём за 35 дней» с реалистичными характеристиками | L | Нет (это в Active requirements как scraper-задача) | Это в фазе scrapers. Зависит от scraper drom.ru/catalog → master-DB |
| **Marketing copy под мульти-маркет с гео-контекстом** (Корея — «быстро и доступно», Япония — «премиум и аукционная прозрачность», Китай — «свежий новый», US — «эксклюзив», UAE — «Gulf-spec», EU — «leftover/end-of-cycle») | В comp set один тон для всех стран. DVApro может per-market-копирайт — это и SEO-сигнал, и UX | S (контент) | Частично (Hero копирайт generic) | Зависит от: расширения Country и country-aware filter в каталоге |

### Nice-to-have (Defer to v1.x / v2)

| Feature | Why defer | Trigger to add |
|---|---|---|
| Видео-обзоры моделей (YouTube embed на карточке) | Перетягивает фокус с funnel на «развлечение». AVADGE имеет видео-отзывы — это _результат_, ОК; видео-обзоры — отдельный контент-проект. | После 100+ доставленных машин с подписанным согласием на использование видео |
| Блог / контент-маркетинг секция (Yandex SEO long-tail) | Yandex SEO критичен, но блог — отдельная производственная единица. На v1 — посадочные страницы под топ-запросы (см. ниже). | После soft-launch + первой Direct-кампании, когда станет ясно по каким запросам клики идут |
| Yandex Дзен присутствие | Дзен как канал органики работает, но требует контент-стратегии и регулярного постинга. Не блокирует funnel. | После v1.x, когда есть 3–5 живых клиентских кейсов |
| Trade-in / кредит / лизинг как отдельные потоки | В FAQ упоминается, но как отдельная функциональность — отвлекает от core flow. Кредит → Bitrix24 deal-stage, не отдельная фича сайта | После Bitrix24 sync + первых клиентов с потребностью |
| AI-adaptive квиз (вопросы зависят от ответов) | Interact 2026: AI-adaptive — 47.3% conversion vs 40.1% linear. Прирост есть, но 5 вопросов linear уже работает. Усложнение QA, бранчинг логики, A/B сложность. | Если линейный квиз даёт <30% completion — попробовать ветвление по `body` (sedan/suv) → разные `use`-варианты |
| Per-car detail pages | **БЛОКИРОВАН anti-feature** (см. ниже) | — |
| Личный кабинет клиента / трекер заказа | **БЛОКИРОВАН anti-feature** | — |
| English locale | **БЛОКИРОВАН в v1** | After soft-launch validates RU-only is too narrow |
| Telegram-bot для подписки на «новые поступления» | Useful retention-канал, но требует контент-движка и Telegram-бота на бэке. Можно жить без него | После 3 месяцев работы, когда есть аудитория для подписки |
| Динамические landing pages под Yandex Direct (`/auto-iz-korei`, `/auto-iz-yaponii` etc) | Critical для Yandex Direct, но первый запуск — 1 сильный landing > 6 слабых | После настройки Direct и понимания топ-CTR-страниц |
| A/B тесты квиза (Optimizely / Yandex Variants) | Нужен трафик: бессмысленно тестировать на <500 visits/нед | Пост soft-launch когда трафик стабилизируется |
| Турбо-страницы Yandex для блог-постов | Турбо-страницы дают +30% глубины просмотра на мобайле — но только для контентных страниц, не для funnel-LP | После запуска блога |
| Авто-обнаружение города посетителя (по IP) для расчёта доставки | Удобно, но не критично; в admin-панели города уже фигурируют как строка | v1.x при росте трафика |
| Калькулятор стоимости как отдельная страница (без квиза) | Конкуренты имеют, но это конкурирует с квизом за ту же конверсию. У DVApro квиз = калькулятор-замена. Не дублировать. | Если SEO-исследование покажет, что «калькулятор авто из Кореи» — топовый интент-запрос с трафиком |

### Anti-Features (Не строить — обоснование чтобы не вернулось)

Эти фичи **залочены** в PROJECT.md, но добавляю обоснование на уровне FEATURES чтобы не возвращалось.

| Anti-Feature | Why It Seems Good | Why It's Wrong For DVApro | What To Do Instead |
|---|---|---|---|
| **Публичные per-car detail pages** | «Так у всех! SEO! Карточка с галереей и кнопкой `купить`!» | (1) Inventory динамичный — авто уходят с торгов за дни → 404 / outdated content → SEO penalty + UX травма. (2) Брокерский workflow: цена меняется к моменту сделки, спека уточняется при осмотре, обязательства фиксируются в _договоре_, а не на странице. (3) Конкурентам кидают цену, перебивают за день. (4) Per-car page = e-commerce checkout pressure, а сделка офлайн. | Карточка → клик → **открывает квиз с предзаполненной маркой/моделью**. Клиент попадает в funnel, а не на статичную страницу. |
| **E-commerce checkout (карта/Apple Pay/крипта)** | «Современно! Меньше трения!» | Авто 5–25M ₽ в РФ покупаются (а) договором ООО→физлицо (б) оплатой по реквизитам в банк (в) с залогом/предоплатой по этапам. Карта/крипта = физически невозможно для такой суммы + не закрывает 6-НДФЛ/НДС вопросы для ООО. И в FAQ scaffold явно: «никаких чёрных касс и крипты». | Sales rep ведёт сделку 1:1 после квиза. Sayте «оплата на расчётный счёт ООО, поэтапно» как trust signal. |
| **Customer self-service portal / трекер заказа** | «Клиенту удобно отслеживать!» | (1) Sales rep _должен_ говорить с клиентом раз в неделю — это часть LTV / репутации. Портал убивает touchpoint. (2) Real-time tracking требует интеграций со scrapers + carriers + custom — недели работы для фичи, которая снижает retention. (3) Конкуренты имеют (Trust Encar упоминает), но используют как маркетинг — не как замену общению. | Sales rep шлёт WhatsApp/Telegram-update раз в 5–7 дней с фото/видео. Клиент чувствует личное внимание. После 100+ клиентов — пересмотреть. |
| **Mobile app (iOS/Android)** | «Все любят приложения!» | RU-B2C для дорогих покупок — 1–2 раза в жизни. App install → нулевой ROI. PWA / адаптивный веб — в 100x дешевле. | Mobile-first responsive. Возможно — иконка «add to home screen» (PWA manifest), не больше. |
| **English locale в v1** | «Почему бы и нет, экспаты в Москве?» | Аудитория v1 — рос. покупатели РФ-резиденты. EN дублирует контент-работу x2 (UI копирайт, SEO, FAQ, договоры, поддержка) ради <2% потенциальной аудитории. | После soft-launch — оценить, есть ли запрос. Тогда — возможно. |
| **Реальная синхронизация с Bitrix24 в v1** | «Лиды должны сразу падать в CRM!» | Bitrix24 sync = новая интеграция, тестирование, custom fields setup. Может выявиться permission/network issue → блок запуска. **Своя БД** = source of truth, sync — фоновая задача. | v1: Lead → собственная БД + email уведомление продажникам. Sync с Bitrix24 — отдельная фаза. Sales reps смотрят в admin-панель / получают email. |
| **Реальные формулы customs / утилизационного сбора в v1** | «Калькулятор-точное-число выглядит профессионально!» | Формулы зависят от: возраст авто, объём двигателя, физлицо/юрлицо, акциз, НДС, льготные коэффициенты — в 2026 г регулирование меняется. Wrong number в PDF = подрыв доверия. **Stub** = «расчёт ориентировочный, итог фиксируется в договоре». | PDF: «Ориентировочно X ₽ под ключ во Владивостоке. Итоговая смета — после согласования с менеджером.» Это тот же honesty-сигнал. |
| **Скрейперы US/UAE/Europe в v1** | «Заявили 6 рынков — давайте сразу!» | Каждый scraper = недели работы (CAPTCHA, региональные специфики). v1 deadline 4–6 недель не выдержит. UI же может **показывать** маркеты с placeholder-карточками | Карточки US/AE/EU = «Под индивидуальный заказ. Оставьте заявку — найдём.» → ведёт на квиз. |
| **Fake activity-feed / fake counters** | «Соцпруф работает!» | Nudgify/Fomo: подделка _уничтожает_ репутацию когда вскрывается (а вскрывается). Соцпруф работает только на _реальных_ данных. У DVApro feed уже admin-управляемый — это правильно. | `feed` обновляется админом из реальных событий. Минимум 5/день, максимум 15. Если нечего написать — лучше старое событие с честным «3 ч назад». |

---

## Russian Market Specific Patterns

5+ паттернов RU-аудитории, которые НЕ переносятся из generic SaaS-advice:

1. **Telegram > WhatsApp как primary channel.** WhatsApp в РФ нестабилен (периодические замедления), Telegram — де-факто стандарт для бизнес-коммуникации. Виджет должен ставить Telegram первым. WhatsApp для тех, у кого нет TG (старшая аудитория). MAX (Yandex Messenger) растёт — Trust Encar его уже указал. Стоит резервировать поле `max` в `SiteSettings`.
2. **Прозрачность под ключ / страх «доплат».** Главный pain в RU-форумах. Двухуровневая цена (`price` под ключ + `priceLocal` в стране) уже моделируется — это **правильный паттерн**. PDF должен показывать построчную разбивку, даже если значения — stub.
3. **Юр-реквизиты (ИНН/ОГРН) = trust-anchor.** Без них — «скам». В comp set все указывают (Trust Encar 7801739565, OTRADA 425000489708, DIAUTO 261103338566). Не выводить = терять серьёзных клиентов.
4. **Yandex-first SEO.** Yandex 73% рынка (Statcounter 2025). Title/meta/structured data — под Yandex (yandex-verification, sitemap.xml для Yandex Webmaster, может быть Турбо-страницы для блога во v1.x). Google — приятный бонус, не цель.
5. **152-ФЗ согласие — обязательное.** Чек-бокс default-unchecked + ссылка на политику конфиденциальности на _каждой_ форме. Скаффолд этого пока не делает — критический gap.
6. **Региональная мульти-город-логика (`Владивосток · Москва · Сеул`).** Российский авто-импорт географически распределён: Владивосток — порт прибытия, Москва — продажи, исходные офисы в стране закупки (Сеул/Токио/Шанхай). В скаффолде уже есть `cities` строка — это сильный паттерн, оставить.
7. **«Под ключ» как термин, а не «полная стоимость».** Жаргон рынка. Если написать «полная стоимость владения» — RU-аудитория не считает это родным. Маленькая copy-деталь.
8. **«Свои ребята» как позиционирование.** Уникальный РФ-этос: доверие через личные связи, не через бренд. В brandQuote scaffold уже встроено — это **сильный** сигнал, держать в копирайте.
9. **Hint of Драйв2 / Drom-форум-аудитории**: упоминания «аукционный лист», «4.5 grade», «Хоргос» в FAQ/seed signal-ируют экспертизу — это insider-language, его уважают.

---

## Feature Dependencies

```
Quiz UI (есть)
    └──submits──> POST /api/leads (нет)
                       └──persists──> Backend DB (нет)
                                       └──reads──> Admin panel (есть UI, нет auth+API)
                       └──triggers──> PDF render (нет)
                                       └──renders──> @react-pdf/renderer + Cyrillic font
                                       └──sends──> Email service (нет)
                                                       └──to──> Client + sales channel
                       └──tracks──> Yandex Metrica goal (нет)

Country enum (jp|cn|kr) — РАСШИРИТЬ → 6 стран
    └──drives──> Catalog filter UI (есть)
    └──drives──> Hero chips / FlagFor icons (есть, надо добавить иконки)
    └──drives──> "Coming soon" badges для US/AE/EU (нет)

Floating contact widget (нет)
    └──reads──> SiteSettings (есть phone/telegram/whatsapp)
    └──callback-button──> POST /api/leads (тот же endpoint, source='callback')
    └──tracks──> Yandex Metrica goal

Юр. реквизиты (нет)
    └──в Footer (есть)
    └──в PDF (нет)
    └──в Privacy Policy page (нет)

152-ФЗ согласие (нет)
    └──нужно на каждой форме: квиз finish, callback, любая
    └──ссылается на /privacy (нет страницы)

Live feed (есть)
    └──обновляется админом (есть)
    └──позже──> auto-pull из Bitrix24 (НЕ в v1)

Master-DB моделей (нет, scraper-задача)
    └──даёт──> "вот такая модель, привезём" в quiz-результате PDF
    └──зависит──> drom.ru/catalog scraper

Statuses карточек (есть как badges: string[])
    └──типизировать──> enum {in-stock, in-transit, on-order, auction}
    └──+freeform tags для маркетинга
```

### Dependency Notes

- **Quiz → PDF → Email — критический tightly-coupled путь.** Любая фаза должна иметь fallback: если PDF не сгенерировался, lead всё равно сохраняется + email с «менеджер свяжется». Не блокировать lead-capture на PDF success.
- **Country enum расширение — атомарно с UI.** Менять Country = трогать Catalog filter, Hero chips, FlagFor (иконки), Car form в админке. Одно PR.
- **Yandex Metrica зависит от backend** (offline-conversion api), поэтому goals на success-сабмит лучше делать после того, как backend готов. До этого — JS-event на frontend submit.
- **Юр.реквизиты + privacy + 152-ФЗ согласие — единый блок,** должны идти вместе. Не имеет смысла полу-меры.
- **Floating widget может быть до бэкенда** — callback просто шлёт mailto/tel сначала, апгрейдится до lead-create позже.

---

## MVP Definition (v1, soft-launch 4–6 недель)

### Launch With (v1)

Минимум, чтобы воронка работала и легально/доверительно выглядела.

**Already-in-scaffold (доработать, не строить заново)**:
- [x] Hero / Catalog / Process / Founders / FAQ / Reviews / FeedStrip / LeadMagnet / Marquee / Footer секции — UI готов
- [x] 5-вопросный квиз UI — готов (`QuizModal.tsx`, `quizSpec.ts`)
- [x] In-memory CRM с типами и admin-редактором — готов

**Build (закрывает gaps до launch)**:
- [ ] **Расширение `Country` до 6 стран** + флаги + UI «coming soon» для US/AE/EU — без этого PROJECT-обещание невыполнимо
- [ ] **Backend + БД** на рос. инфре — лиды должны где-то жить
- [ ] **Auth для admin** (founders + sales reps, роли) — не отдать админку публично
- [ ] **PDF-генерация** через `@react-pdf/renderer` с Cyrillic-шрифтом
- [ ] **Email-доставка** PDF клиенту + копия в продажный канал
- [ ] **Lead persist + источник** (`source`: 'quiz' | 'callback' | 'direct') в БД
- [ ] **Юр. реквизиты ООО/ИП** в Footer + страница `/legal/personal-data-policy` (политика конф) + `/legal/offer` (оферта)
- [ ] **152-ФЗ чек-бокс** на квиз finish + callback форма
- [ ] **Floating contact widget** (Telegram + WhatsApp + Callback) bottom-right
- [ ] **Yandex Metrica + 4 goals** (open_quiz, complete_q5, submit_lead, pdf_downloaded)
- [ ] **Типизация `badges`** в enum-of-known-statuses + freeform-tags (предотвращает мусор от админа)
- [ ] **Mobile audit** всех секций (70%+ трафика) + Yandex Browser smoke-test
- [ ] **landed-cost stub** — фиксированный коэффициент или ручной ввод в админке, виден в PDF и в admin
- [ ] **Mark feed as admin-managed honestly** — короткий disclosure где-нибудь («лента обновляется командой») чтобы не пахло fake-данными

**Содержательная работа (не код)**:
- [ ] Реальные фото и биографии Founders
- [ ] 6+ настоящих отзывов с разрешением на публикацию
- [ ] Реалистичный seed-каталог 12–24 авто (текущие 6 — недостаточно для «есть выбор»)
- [ ] Финальный текст FAQ (8–12 вопросов; добавить про US/AE/EU «coming soon»; добавить про 152-ФЗ/безопасность данных; добавить про оплату)

### Add After Validation (v1.x — недели после soft-launch)

- [ ] Bitrix24 sync (deals, contacts, custom fields для quiz-ответов)
- [ ] Скрейперы Encar, USS+BeForward, Che168+Autohome → нормализованная схема `Car`
- [ ] Мaster-DB моделей через drom.ru/catalog scraper (для подбора, когда нет живого объявления)
- [ ] Реальные формулы landed-cost (не stub)
- [ ] Feed auto-pull из Bitrix24 (когда sync есть)
- [ ] Yandex Metrica offline-conversion с lead.id (когда backend пишет в Bitrix24)
- [ ] Авто-обнаружение города (geo-IP) для расчёта доставки

### Future Consideration (v2+)

- [ ] Скрейперы US/UAE/Europe (когда v1 stabilizes)
- [ ] EN locale (если запрос подтвердится)
- [ ] Блог + Yandex Дзен присутствие
- [ ] Telegram-бот для подписки на новые поступления
- [ ] AI-adaptive квиз (если linear даёт <30% completion)
- [ ] A/B тесты квиза (после стабильного трафика)
- [ ] Динамические landing-pages под Yandex Direct

---

## Feature Prioritization Matrix

Только новые фичи — то, что есть в скаффолде, P0 по умолчанию (не выпилить).

| Feature | User Value | Implementation Cost | Priority | Notes |
|---|---|---|---|---|
| PDF-генерация + email-отправка | HIGH | HIGH | **P1** | Сердце value-prop |
| Backend + БД + lead persist | HIGH | HIGH | **P1** | Без этого ничего не работает |
| Admin auth (multi-user roles) | HIGH | MEDIUM | **P1** | Не отдать админку миру |
| Country enum → 6 стран + UI | HIGH | LOW | **P1** | Закрывает PROJECT-обещание |
| Юр. реквизиты + privacy page + 152-ФЗ чек-бокс | HIGH (legal) | LOW | **P1** | Юридический must |
| Floating contact widget | MEDIUM-HIGH | MEDIUM | **P1** | +30–80% callback conversion в comp data |
| Yandex Metrica + goals | HIGH | LOW | **P1** | Без этого не настроить Direct/SEO |
| Типизация badges | MEDIUM | LOW | **P1** | Защита от админ-мусора, дёшево |
| Реалистичный seed-каталог 12–24 авто | HIGH | LOW (контент) | **P1** | Без вариативности каталог пуст |
| landed-cost stub (видно в PDF + admin) | HIGH | MEDIUM | **P1** | Доверие к смете |
| Mobile audit | HIGH | MEDIUM | **P1** | 70% трафика |
| Реальные founders фото/био | MEDIUM | LOW (контент) | **P1** | Differentiator |
| 6+ настоящих отзывов | MEDIUM | LOW (контент) | **P1** | Trust |
| Финальные тексты FAQ (10–12) | MEDIUM | LOW | **P1** | Trust + SEO |
| Видео-pitch founders на главной | MEDIUM | MEDIUM | **P2** | После v1, если CR на квиз ниже ожидаемого |
| Bitrix24 sync | MEDIUM | HIGH | **P2** | Отдельная фаза, не блокирует launch |
| Scrapers KR/JP/CN | HIGH | HIGH | **P2** | Отдельная фаза; до этого — admin вручную или seed |
| drom.ru/catalog master-DB | HIGH | HIGH | **P2** | Отдельная фаза |
| Реальные customs формулы | HIGH | HIGH | **P3** | Регуляторика, отдельный компетенс |
| Per-market копирайт (6 стран) | MEDIUM | LOW (контент) | **P2** | После расширения Country |
| Турбо-страницы (Yandex) для будущего блога | LOW (нет блога ещё) | MEDIUM | **P3** | После v1.x |
| AI-adaptive квиз | LOW | MEDIUM | **P3** | Только если linear не работает |

---

## Competitor Feature Analysis

| Feature | Trust Encar | Japan Transit | AVADGE | Drom.ru "под заказ" | Our Approach (DVApro) |
|---|---|---|---|---|---|
| Кол-во вопросов в квизе/форме | 8 шагов | Минимальная форма (имя/телефон) | 2–3 поля | Нет встроенного квиза, ссылки на брокеров | **5 шагов** (sweet spot) |
| Артефакт после квиза | «бонус на авто» текстом | «менеджер свяжется» | «менеджер свяжется» | — | **Брендированный PDF на email** |
| Live-counters / лента | Счётчик просмотров на карточке | Telegram «100k подписчиков» | «470+ доставлено» статичный | — | **liveCount + admin-feed-ticker «в работе сейчас»** + 4 hero-stats |
| Status badges на карточках | «БЕЗ ДТП», «X ДТП», «В продаже» | Минимально | «В наличии», «Новинки», «Акция» | «В наличии / Под заказ / В пути» | **Типизированный enum** (in-stock/in-transit/on-order/auction) + freeform tags |
| Флаги стран на карточке | Нет (моно-Корея) | Косвенно через цену | Нет | Есть | **Да** (`FlagFor` атом, расширение до 6) |
| Цена «под ключ» vs локальная | Две цены (Корея + до Владивостока) | Интегрировано в цену | Одна цена | Зависит от продавца | **`price` под ключ + `priceLocal` в стране** |
| Per-car detail page | Да (Подробнее) | Нет | Да | Да | **НЕТ — anti-feature**; клик → квиз |
| Founders в лицах | Нет (бренд Encar) | Нет | Нет | — | **Денис + Алексей крупно** |
| Юр. реквизиты в footer | Да (ИНН + ОГРН) | Не на главной | Да (ИНН) | Не нужно (площадка) | **Да** (P1) |
| Floating contact widget | Кнопки в hero | Кнопки в hero | Иконки соцсетей в шапке | Чат на карточке | **Floating bottom-right** (Telegram/WhatsApp/Callback) |
| Channels | Звонок, WhatsApp, Telegram, MAX, email | Звонок, Telegram, WhatsApp, MAX, email | Звонок, Telegram, VK, YouTube | Чат | **Звонок, Telegram, WhatsApp** (MAX в v1.x) |
| Видео-осмотр на главной | Нет (упоминание в гарантиях) | 25+ видео-отзывов выдачи | 25+ видео-отзывов выдачи | — | **Process step 3 + reviews; видео-pitch — v1.x** |
| FAQ | Нет на главной (внутри), статьи блога | Нет | В Q&A форме | — | **Да, секция на главной** |
| Видимый процесс | 8 этапов | 5 этапов | 8 этапов | — | **6 этапов (timeline)** |
| Кол-во маркетов | 1 (Корея) | 3 (KR/JP/CN) | 6 (KR/EU/US/CN/JP/UAE) | Marketplace | **6 маркетов с гео-копирайтом, скрейперы на 3** |
| Multi-город география | Сеть в 38 городах | Владивосток-центрик | Москва-центрик | Marketplace | **Владивосток · Москва · Сеул** (расширяется по странам) |

---

## Sources

### Live Russian competitor sites analyzed

- [Trust Encar — главная и каталог](https://trust-encar.ru) — 8-шаговый квиз, ИНН/ОГРН, две цены, мульти-канальная связь, сеть офисов в 38 городах
- [Japan Transit — главная](https://japantransit.ru) — 5-этапный процесс, 100k+ Telegram-подписчиков, видео-отзывы, 17-этапное отслеживание в личном кабинете, гарантийный взнос 30k ₽
- [AVADGE — главная и каталог](https://avadge.com) — 6 рынков (KR/EU/US/CN/JP/AE), 470+ доставленных, видео-отзывы галерея, конфигураторы по брендам, Telegram/VK/YouTube
- [Kimura Cars — главная](https://kimuracars.com) — минимальный сайт, 25 лет работы, узкий фокус
- [DSS Group](https://dss-g.com) и [OTRADA Cars](https://otradacars.ru) — упомянуты в обзорах, мульти-маркет
- [DIAUTO](https://diautotrading.ru) и [carskorea.shop](https://carskorea.shop) — RU брокеры с калькуляторами

### Industry data

- [Quiz Conversion Rate Report 2026 — Interact Blog](https://www.tryinteract.com/blog/quiz-conversion-rate-report/) — 40.1% start rate; 47.3% AI-adaptive; 5–7 вопросов sweet spot
- [TOP 20 Lead Magnet Conversion Statistics 2026](https://www.amraandelma.com/lead-magnet-conversion-statistics/) — completion ~83% при 2–3 мин квизе
- [Interactive Forms vs Static — Outgrow](https://outgrow.co/blog/interactive-forms-lead-generation-2025/) — интерактивные формы x16 vs статичные
- [Quiz Funnels vs Lead Magnets 2026 — Dashform](https://getaiform.com/blog/quiz-funnels-vs-static-lead-magnets-interactive-content-conversion-2026) — quiz funnels конвертят 10x лучше статичных PDF
- [Marquiz — конструктор квизов](https://marquiz.ru/) — RU-стандарт; конверсия квизов 12–25% vs стандарт-форм 1–3%

### Trust / social proof / ethics

- [How Fake Social Proof Could Destroy Your Business — Nudgify](https://www.nudgify.com/fake-social-proof/)
- [Deceptive Patterns: Fake social proof](https://www.deceptive.design/types/fake-social-proof)

### Russian regulatory / SEO

- [SEO продвижение в Yandex 2025 — Demis](https://www.demis.ru/articles/optimizaciya-saita-pod-yandeks/) — Yandex 73% доли рынка
- [Турбо-страницы — Yandex Webmaster](https://webmaster.yandex.ru/blog/dlya-kakikh-saytov-mozhno-vklyuchit-turbo-stranitsy)
- [Yandex Metrica goal-tracking для квизов](https://kokoc.com/blog/kak-nastroit-celi-v-yandeks-metrike/)

### Bitrix24 integration patterns (для v1.x sync-фазы)

- [Bitrix24 REST API: crm.lead.add](https://apidocs.bitrix24.ru/api-reference/crm/leads/crm-lead-add.html)
- [Custom fields в сделках (UF_CRM_*)](https://apidocs.bitrix24.ru/api-reference/crm/deals/crm-deal-fields.html)
- [Вебхуки Битрикс24 — Habr / Otus](https://habr.com/ru/companies/otus/articles/1017116/)
- [Автоматическое создание лидов через входящий вебхук — vc.ru / KONTUR](https://vc.ru/u/484564-kontur-agency/163067-avtomaticheskoe-sozdanie-lidov-v-bitriks24-pri-pomoshchi-vhodyashchego-vebhuka)

### Callback / contact widgets in RU

- [TOP-15 callback-сервисов 2025 — Timeweb](https://timeweb.com/ru/community/articles/reyting-top-15-luchshih-servisov-obratnogo-zvonka-dlya-sayta-v-2025-godu) — для бенчмарка UX, не для покупки
- [UpToCall](https://uptocall.com/), [Envybox](https://envybox.io/products/obratnyy-zvonok/), [RedConnect](https://redconnect.ru/) — UX-референсы

### Communication channels in RU

- [WhatsApp/Telegram alternatives in Russia 2026 — imo blog](https://imo.im/blog/guides/whatsapp-telegram-alternatives-russia) — статус каналов в РФ; рост MAX

### Customs / "под ключ" pricing

- [Расчёт авто из Кореи — Drom.ru калькулятор](https://www.drom.ru/world/calculator/korea/)
- [Полная стоимость под ключ с примерами — Priority Auto](https://priority-auto.ru/blog/avto-iz-korei-polnaya-stoimost-pod-klyuch-s-primerami/)

### Video inspection / trust patterns

- [Чек-лист проверки авто с аукциона — Priority Auto](https://priority-auto.ru/blog/chek-list-proverki-avto-do-pokupki/)

---

*Feature research for: Russian vehicle-import broker funnel (DVApro v1)*
*Researched: 2026-04-26*
