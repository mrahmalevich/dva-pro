# Pitfalls Research

**Domain:** Russian vehicle-import marketplace + scrapers (Encar/USS/BeForward/Che168/Autohome/drom.ru) + quiz funnel + Cyrillic PDF + Bitrix24 CRM + 152-FZ data residency
**Researched:** 2026-04-26
**Confidence:** MEDIUM-HIGH (152-FZ regulatory specifics: HIGH from official sources; scraper specifics: MEDIUM, mostly second-hand reports because target sites don't publish anti-bot details; Bitrix24 quirks: HIGH from official docs; team/UX pitfalls: MEDIUM from analogous founder-led broker projects)

---

## Critical Pitfalls

These are the catastrophic class — they kill the launch, cost money, or burn weeks of rework.

---

### Pitfall 1: 152-FZ "primary collection" violation via Cloudflare/Vercel/Sentry/Google Analytics/Hotjar

**What goes wrong:**
The site collects a phone/email/quiz answer through a form and the bytes touch a foreign server *first* — Cloudflare proxy, Vercel Edge, Sentry SaaS, Google Analytics tag, Hotjar session recording, Tilda/Wix-style hosted forms, even a Mailgun/SendGrid endpoint that processes the payload before storage. Since 1 July 2025, this is no longer "cross-border transfer that needs a notification" — it is a direct violation of localization (primary collection must occur on Russian soil). Roskomnadzor fines for legal entities: 1–6 million ₽ first time, 6–18 million ₽ for repeat. The 2025 wording explicitly closes the "we just route through a foreign CDN" loophole.

**Why it happens:**
- Default Vite/React deploys to Vercel/Netlify; no one notices the form POST goes to a foreign edge before it ever reaches Russia.
- "Cloudflare is just a CDN" is the universal first instinct of a JS dev — but Cloudflare terminates TLS in foreign DCs, which means the cleartext form payload exists abroad.
- Sentry/PostHog/Mixpanel/Amplitude are added casually for "just error tracking" and they capture quiz answers in breadcrumbs.
- Google Analytics/Yandex Metrica with extended tracking may capture form values into US-side GA buckets.

**How to avoid:**
- **Hosting:** backend + form ingestion endpoint on a Russian provider (Yandex Cloud / Selectel / Timeweb / VK Cloud / Cloud.ru). Datacenter region must be inside RF.
- **No foreign CDN/WAF/proxy in front of any path that accepts personal data.** If you want CDN for static assets, put it on a Russian CDN (Yandex CDN, Selectel CDN, BeGet, NGENIX) or self-host. Separate "static.dva.pro" (CDN-fronted, no PII) from "dva.pro" (Russian-direct, accepts forms).
- **Self-hosted observability:** GlitchTip (Sentry-compatible OSS) or Highlight self-hosted, in the same Russian datacenter. NOT Sentry SaaS.
- **Analytics:** Yandex Metrica only (Russian-hosted by definition); skip Google Analytics. If you need product analytics, self-host PostHog on the Russian box.
- **Email transport:** use a Russian SMTP relay (UniSender, SendPulse RU, Yandex 360 SMTP, mail.ru SMTP) for outbound to clients. Foreign SMTP (Mailgun, Resend, SendGrid) means quiz email + PDF link transit through US-side queues — that's processing of PII abroad.
- **Forms:** never embed Tilda/Tally/Typeform/Calendly/Google Forms.
- **Cookie/consent banner:** explicit non-prechecked checkbox on the quiz, with "Согласие на обработку персональных данных" link (separate page). Per 1 Sep 2025 rules, consent must be a *separate document* from the user agreement, not a clause inside it.
- **Roskomnadzor notification:** before launch, file the уведомление об обработке персональных данных at pd.rkn.gov.ru. Free, 5-day processing.

**Warning signs:**
- `vercel.app`, `netlify.app`, `*.workers.dev`, `cloudflare.com` anywhere in the network tab when submitting the quiz.
- `sentry.io`, `ingest.sentry.io`, `posthog.com`, `mixpanel.com`, `googletagmanager.com` in network requests after a form submit.
- `mailgun.org`, `sendgrid.net`, `resend.com` as the SMTP host in mail headers.
- Any third-party JS chunk loading from non-RF origins on the quiz page.

**Phase to address:** Phase 0/1 — backend & hosting selection. This is irreversible once leads start landing; you cannot retroactively make foreign-routed PII compliant.

**Severity:** **Catastrophic.** Fines start at 1M ₽ and scale with revenue percentage on repeat. Roskomnadzor blocks the domain in extreme cases.

---

### Pitfall 2: Pre-checked consent checkbox / consent buried in user agreement

**What goes wrong:**
Quiz submit form has the "Согласен на обработку ПД" checkbox pre-ticked, OR consent text is a single сlause inside a broader "Пользовательское соглашение". Both became illegal as of 1 Sep 2025. Roskomnadzor in inspection treats this as *no consent given at all* → all leads collected since launch are unlawfully processed → fines + mandated deletion.

**Why it happens:**
- Universal "convert better with pre-checked box" UX trick from US/EU markets — but RU regulator explicitly bans it.
- Devs combine ToS, privacy policy, and consent into one block to reduce visual friction.

**How to avoid:**
- Two separate explicit checkboxes (or one — minimum), unchecked by default, blocking submit until the user actively clicks.
- Each checkbox label links to a *separate* document: «Согласие на обработку персональных данных» (not bundled with «Пользовательское соглашение» or «Политика конфиденциальности»).
- The submit button MUST be disabled until the box is ticked — otherwise auditor argues "user could submit without consent."
- Log the consent event server-side with timestamp + IP + version of the consent text shown. This is your defense in inspection.
- Do not rely on browser-side validation alone; reject the API call server-side if the consent flag is missing.

**Warning signs:**
- `<input type="checkbox" checked>` next to a privacy text on the quiz.
- One "I agree to ToS, Privacy Policy, and consent to PD processing" line covering everything.
- No `consents` table / `consent_id` foreign key on the `leads` row.

**Phase to address:** Phase that builds the quiz submit endpoint (Phase 1 or 2).

**Severity:** **Catastrophic.** Penalties for invalid consent: 300–700K ₽ per the Sep 2025 amendments; per-violation, not per-incident, so multiplies across the lead database.

---

### Pitfall 3: Encar / Che168 / Autohome scraping from a single Russian IP — instant ban + zero data

**What goes wrong:**
Scraper runs from Yandex Cloud / Selectel datacenter IP. Encar (KR), Che168 (CN), Autohome (CN) detect non-residential, non-local IP within first 10–50 requests, return 403/captcha/empty pages, and ban the IP for 24h+. Encar specifically expects a Korean residential or KR-mobile IP profile — datacenter IPs from any country fingerprint as "scraper" and serve a fake/empty catalog. Che168 and Autohome run aggressive device fingerprinting (TLS JA3/JA4, header order, Canvas/WebGL fingerprints) typical of Chinese e-commerce — they'll serve cached/stripped HTML to bots and the scraper "works" but ingests garbage.

**Why it happens:**
- Naive scraper uses `axios`/`fetch` from Node, hits the public catalog page, gets 200 OK with a sparse HTML, parses 0 cars, devs assume "site changed."
- Thinking residential proxy is overkill for a 6-week MVP; it's not — these sites deploy commercial anti-bot (Cloudflare/Akamai/DataDome equivalents) by default.
- No KR/CN proxy budget allocated; cheapest residential proxy plans are $50–200/mo per region.

**How to avoid:**
- **Per-source proxy strategy** (encode in stack from day one):
  - Encar (KR) → Korean residential proxy (Oxylabs/Bright Data/Soax/Decodo KR pool). Korean Supreme Court (2022Do1533, May 2022) ruled scraping public data is legal in KR — legal risk is low; technical risk is high.
  - USS-Auctions (JP) → not scrapeable as-is. Login required, B2B-only, no public catalog. Strategy: partner with a licensed JP auction agent who provides API/CSV exports (e.g., providecars, japanesecartrade, japanstat). Trying to scrape behind login = ToS violation + ban + lost agent relationship.
  - BeForward (JP) → public catalog, milder anti-bot, but still rate-limited. Use 1 req/2–5s per IP, JP residential preferred but not required for v1.
  - Che168 / Autohome (CN) → Chinese residential/mobile proxy + headless browser with realistic fingerprint (playwright-stealth or rebrowser-puppeteer). Datacenter proxies are useless. Budget proxy time.
  - drom.ru/catalog → Russian residential or polite scraping from Russian DC IP with strong rate limit (1 req/3s, respect `Crawl-delay`). They have an official partner API (`baza.drom.ru/help/API`) — check whether commercial use of `/catalog` data needs that route legally.
- **Headless browser, not raw HTTP** for Encar/Che168/Autohome (defeats TLS fingerprinting). Use `playwright` with `playwright-stealth` plugin; rotate user agents *and* viewport sizes.
- **Realistic delays:** randomize 3–10s between requests with jitter; never burst-parallelize across same domain.
- **Detect blocks early:** if 5 consecutive responses < N bytes, or contain captcha keywords ("验证", "보안 인증", "robot"), HALT and alert. Don't keep slamming a banned IP.
- **Per-source success metrics in admin:** "last successful Encar scrape: 2h ago, 47 cars". When it goes red, founders see it.

**Warning signs:**
- Scraper "works" but inventory volume drops to 0 or stays flat for >24h.
- HTTP 200 with HTML body length < 5KB on a catalog page that should be 100KB.
- Captcha images, cookie challenges, or "请稍候 / 잠시만 기다려 주세요" text in scraped HTML.
- Sudden surge in 403/429 status codes.

**Phase to address:** Phase that builds inventory pipeline. Don't defer proxy strategy — write the first scraper *with* the proxy in mind, even if v1 has just one source.

**Severity:** **Catastrophic for the inventory pipeline.** No inventory = no PDF content = product is broken. This *is* the product on the data side.

---

### Pitfall 4: USS Auctions scraping attempt — account ban + legal blowback in JP

**What goes wrong:**
Team gets a USS member login (often through a Japanese intermediary the founders already know) and writes a scraper against the member portal. USS detects automated session use, bans the member account permanently, and the intermediary loses *their* USS membership — destroying a relationship that took years to build. Worse, USS is owned by listed company USS Co. (TYO:4732); they have lawyers. ToS explicitly forbids scraping the member portal.

**Why it happens:**
- "We have a login, why not just script it?" — overlooks that the login belongs to a partner, not to DVApro.
- USS data is genuinely valuable (auction sheets, grades) and there's no public alternative, so the temptation is large.

**How to avoid:**
- USS data **must come through a licensed exporter API** (japanesecartrade, providecars, autoportal — many have B2B feeds). Treat USS as "buy the data, don't scrape."
- For v1, BeForward fills the JP slot for *publicly listed* JP cars. USS-grade auction data can wait until there's a paid feed.
- If a partner agrees to share their data, get it as a daily CSV/API push from *them*, not a scrape behind their login.
- Document this constraint in the inventory pipeline README so future devs don't try.

**Warning signs:**
- Code referencing `ussnet.co.jp/auction/` URLs.
- Any `cookie: PHPSESSID=...` hardcoded or stored credentials for USS in the repo.

**Phase to address:** Inventory pipeline phase. Decide JP source = BeForward + partner-CSV before writing any USS code.

**Severity:** **Catastrophic for partner relationships.** Money cost is one ban; reputation cost in a small JP exporter community is years.

---

### Pitfall 5: Cyrillic in @react-pdf/renderer — silent box characters in production

**What goes wrong:**
PDF renders fine in dev with a default font. In production, the client opens the brand PDF and every Cyrillic character is `□□□` or just blank. Why: @react-pdf ships with Helvetica only, which has no Cyrillic glyphs. Worse, when a custom font is registered but a `fontWeight: 'bold'` Text uses no bold variant, react-pdf falls back to Helvetica for that *one element* — so half the PDF is in Cyrillic and the «жирные заголовки» become boxes. This is the single most-reported issue in the @react-pdf repo (issues #1366, #2862, #796, #2730).

**Why it happens:**
- Fonts are registered with one variant only (`Inter-Regular.ttf`), and code uses `fontWeight: 700` somewhere → fallback to Helvetica → no Cyrillic.
- Fonts are loaded as `.woff2` because that's what the web app uses → react-pdf only supports TTF/WOFF (not WOFF2).
- Font CDN URL is foreign (Google Fonts) → on a Russian box with restricted egress, font fetch hangs → PDF generation stalls indefinitely (issue #2675 — `usePDF` stuck on `loading`).
- Tested only on Mac with Helvetica installed system-wide → false positive locally.

**How to avoid:**
- Pick a font with full Cyrillic coverage AND multiple weights. Recommended: **Inter** (broad Cyrillic support, Latin + Cyrillic, all weights), **Roboto**, **PT Sans/Serif** (designed for Cyrillic), **Manrope**, or **JetBrains Mono** (already in brand stack — has Cyrillic).
- **Bundle the .ttf files in the repo / static assets, do NOT load from Google Fonts CDN at runtime.** Self-host on the same Russian server.
- **Register every weight/style as a separate `src` entry** in a single `Font.register()` call:
  ```ts
  Font.register({
    family: 'Inter',
    fonts: [
      { src: '/fonts/Inter-Regular.ttf', fontWeight: 400 },
      { src: '/fonts/Inter-Medium.ttf', fontWeight: 500 },
      { src: '/fonts/Inter-Bold.ttf', fontWeight: 700 },
      { src: '/fonts/Inter-Italic.ttf', fontWeight: 400, fontStyle: 'italic' },
    ],
  });
  ```
- Set a fallback inside the document: `<Document><Page style={{ fontFamily: 'Inter' }}>` so nothing accidentally inherits Helvetica.
- **Test PDF in CI** with a known-Cyrillic fixture string («Денис Сахаров — заявка №12345 от 26.04.2026») and assert non-empty rendered text via pdf-parse or similar.
- Test in real Russian email clients: download attachment in Yandex.Mail webapp, open in Yandex Browser PDF viewer, AND in Adobe Reader on Windows (different font fallback chains).

**Warning signs:**
- Test PDF on a Linux CI box has fewer characters than on Mac.
- Some weights render and others show boxes.
- `usePDF` hook stuck in `loading: true` forever on production server.
- PDF file size suspiciously small (under 50KB for a content-rich page often means font wasn't embedded).

**Phase to address:** PDF generation phase. Write the font test on day 1.

**Severity:** **Catastrophic.** A broken PDF reaches the client *after* they've completed the funnel — first impression is "amateur." It also hits the sales rep (PDF is also their qualification artifact). Recovery cost = re-send + apology.

---

### Pitfall 6: Email PDFs landing in mail.ru / yandex.ru spam folders

**What goes wrong:**
Quiz completion fires, server sends PDF attachment to client@mail.ru. Email arrives in Spam (or never delivered — yandex.ru drops outright). Founder thinks the lead is dead; client thinks DVApro is broken. mail.ru and yandex.ru run their own spam filters (Спамоборона) that are more aggressive than Gmail and very sensitive to: (a) missing/misaligned SPF/DKIM/DMARC, (b) sending domain reputation = 0, (c) attachments from low-volume senders, (d) HTML-heavy templates with embedded images, (e) certain trigger words in Russian («БЕСПЛАТНО», «КРЕДИТ», «АВТО ПОД КЛЮЧ» in subject).

**Why it happens:**
- Devs use a foreign SMTP (Mailgun/SendGrid) that has poor reputation in RF mail networks AND violates 152-FZ as noted above.
- DMARC not set; mail.ru downgrades unauthenticated mail aggressively.
- Sender domain (`@dva.pro`) has no warm-up history; first 100 emails get filtered.
- PDF attachment > 5MB triggers heuristic "promotional bulk".

**How to avoid:**
- **SMTP via Russian provider:** Yandex 360 (yandex.ru reputation built-in), mail.ru for Business, UniSender, SendPulse, or self-hosted Postfix on Russian DC + careful warm-up.
- **DNS BEFORE first send:**
  - SPF record covering the SMTP relay's send IPs.
  - DKIM with at least 1024-bit key (2048 preferred), signature aligned to the From: domain.
  - DMARC: start with `p=none rua=mailto:dmarc@dva.pro` to monitor; tighten to `p=quarantine` after 2 weeks of clean reports.
  - PTR (reverse DNS) on sending IP must match the HELO hostname. yandex.ru drops mail with broken PTR.
- **Use postoffice.yandex.com** (Yandex Postmaster) and **postmaster.mail.ru** to monitor delivery rates. These are the only ground-truth signals.
- **Domain warmup:** first week, send only to founder/QA mailboxes on @yandex.ru, @mail.ru, @gmail.com, @rambler.ru — confirm Inbox placement before exposing real users.
- **Email body content:**
  - Use Russian, but avoid all-caps and excess `!!!`.
  - Plain text part + HTML part (multipart/alternative); never HTML-only.
  - Don't put PDF *inline*; attach it. Don't embed huge base64 images in HTML.
  - Plain link to download from your own Russian-hosted server is more deliverable than 10MB attachment, but breaks for users who never click links → attach a *compressed* version (≤2MB) AND give the download link.
- **PDF compression:**
  - Resize embedded car photos to max 1280px wide, JPEG quality 75, before embedding. Don't ship 4K phone photos.
  - Aim for total PDF ≤ 2MB. >5MB risks rejection from corporate mailboxes and angry mobile users.
- **Subject line:** keep neutral («Подбор автомобилей DVApro для вас») — avoid spam-trigger words.
- **List-Unsubscribe header** even though it's a transactional email — improves reputation with mail.ru.

**Warning signs:**
- Test sends to mail.ru land in «Спам» — DON'T launch.
- yandex.ru postmaster shows "Жалоб: 0 / Доставлено в спам: >5%".
- Attachment scan blocks the PDF (often happens with corporate Exchange).
- `Reply-To` ≠ `From` causes flag.

**Phase to address:** Email delivery phase, before any real traffic. Treat as a 2–3 day mini-project: DNS, warmup, monitoring.

**Severity:** **Catastrophic.** The PDF *is* the conversion. If it doesn't arrive, the funnel doesn't close. This is invisible to the team until users complain.

---

### Pitfall 7: Quiz submit race → duplicate leads, duplicate PDFs, duplicate Bitrix entries

**What goes wrong:**
User taps "Отправить" on slow mobile, sees no spinner immediately, taps again. Two API calls → two leads → two PDFs generated → two emails sent → eventually two Bitrix24 deals (with the duplicate-control merge cleanup running once a day, so for 24h the sales rep sees double). Worse: scrolling through a quiz on iOS with autofill can fire submit twice from a single tap. At higher scale, retries from Bitrix webhook delivery (which can be retried after 5–10 min delay) compound the problem.

**Why it happens:**
- No client-side debounce + no server-side idempotency key.
- POST endpoint has no uniqueness constraint on (phone, quiz_session_id) within N minutes.
- `crm.lead.add` REST call from the backend has no `INTERNAL` flag handling, fires every time the queue retries.

**How to avoid:**
- **Client side:** disable the submit button on click + show a spinner; debounce 500ms; on network error show retry, but use the same idempotency key.
- **Server side (the real fix):** generate an `idempotency_key = uuid()` when the quiz starts (NOT when it ends), include it in every submit attempt; backend's submit endpoint runs `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`. If a duplicate request comes in 30s later with the same key, return the *existing* lead/PDF instead of creating a new one.
- **PDF generation:** keyed by `lead_id` not by request — same lead = same PDF URL, regenerate is a no-op.
- **Bitrix sync:** queue with at-least-once delivery + dedupe at consumer using `lead_id` as external_id. Bitrix duplicate control by phone+email is a *cleanup* not a *prevention* — don't rely on it.
- **For Bitrix24 specifically:** custom field `dvapro_lead_id` on Lead entity, indexed; before `crm.lead.add` call `crm.lead.list filter[UF_CRM_DVAPRO_LEAD_ID]=...` and update instead of add if found.

**Warning signs:**
- Dev console shows two POST /api/leads from one click.
- Bitrix duplicate-control email digest shows >0 merges per day.
- Sales rep complains "I called the same person twice."

**Phase to address:** Quiz submit endpoint phase + Bitrix sync phase.

**Severity:** **Serious.** Doesn't kill launch but rapidly destroys sales-team trust in the data and pollutes pipeline metrics.

---

### Pitfall 8: Master DB scraper for drom.ru/catalog ingests 0 cars / cars stay forever after sale

**What goes wrong:**
Two related sub-pitfalls in one domain:
- **(a)** drom.ru/catalog scrape works on day 1, 50K models ingested, then on day 2 the table is empty because the scraper does `DELETE FROM cars; INSERT ...` instead of upsert. Or worse, scraper crashes mid-run and the table is half-empty.
- **(b)** Inventory scrapers from Encar/BeForward/Che168 ingest active listings by scraping listing pages — but never *remove* a car when it's sold/expired on the source. After 3 months, your DB shows cars that no longer exist anywhere, sales reps quote them, clients are frustrated.

**Why it happens:**
- "Truncate-and-reload" feels safer than upsert until it isn't.
- No "last seen" timestamp → no way to know what's stale.
- Source sites silently 404 sold listings; scraper just skips them, never marks them sold.

**How to avoid:**
- **Upsert pattern, always:** `INSERT ... ON CONFLICT (source, external_id) DO UPDATE SET ..., last_seen_at = NOW()`. Never `DELETE` whole tables.
- **Soft delete via "last seen":** every scrape run updates `last_seen_at`; cars not seen in N runs (e.g., 3 days) get `status = 'inactive'` (don't hard delete — keep for analytics and so the lead PDF history stays valid).
- **Don't show inactive cars in catalog or PDF generation queries:** `WHERE status = 'active' AND last_seen_at > NOW() - INTERVAL '7 days'`.
- **Idempotent scrapes:** running the same scrape twice in a row produces the same DB state. Test this in CI.
- **Scrape failure is loud:** if a scrape run inserts 0 new + updates 0 existing (and last successful run had >100), alert. Means the parser broke or got banned.
- **Per-source sequencing not parallelism:** running all 6 scrapers concurrently on a 2GB Russian VPS will OOM. Schedule them serially via cron with locks (only one of `scrape:encar` runs at a time).
- **Long-running scrape cannot block deploys:** run scrapers as separate cron jobs, not inside the API server process. Use a process supervisor (systemd, pm2) or a dedicated worker.

**Warning signs:**
- Catalog count drops to 0 right after a scrape window.
- A car shown in PDF that the source site returns 404 for.
- Memory usage of scraper grows unboundedly across runs (Puppeteer leak — see Pitfall 14).
- A deploy fails because the scraper holds the DB connection.

**Phase to address:** Inventory pipeline phase.

**Severity:** **Serious.** Burns trust with clients ("you sold me a car that wasn't available") and sales reps lose hours hunting for cars that don't exist.

---

### Pitfall 9: Stale pricing — currency conversion locked at scrape time, displayed weeks later

**What goes wrong:**
Scraper fetches Encar listing in KRW → converts to RUB at the scrape moment using a hardcoded rate or yesterday's CBR rate → stores `price_rub: 8950000`. Three weeks later that car is shown in a PDF to a client at 8.95M ₽. KRW/RUB has moved 8% since scrape. Client signs based on the PDF → company eats the FX loss; OR the rep has to re-quote and the client distrusts.

**Why it happens:**
- "Show RUB" feels like a simple display problem; FX volatility is invisible until it isn't.
- No clear contract on when the price is "fixed" vs "indicative."

**How to avoid:**
- **Store source-currency price separately and authoritatively:** `price_source: 21400000`, `price_source_currency: 'JPY'`. Never overwrite this.
- **Compute RUB on-the-fly using a rate fetched daily** (CBR API: `https://www.cbr.ru/scripts/XML_daily.asp` is free, official, no auth). Cache for 24h.
- **Add a margin buffer in the displayed RUB price** (e.g., +3-5%) to absorb intraday FX moves, OR display a range: `≈ 14 800 000 ₽ (по курсу ЦБ на 26.04.2026)`.
- **PDF must show:** source currency price + RUB-equivalent + rate date + "финальная цена фиксируется при оплате авто" disclaimer. This matches the FAQ promise («фиксация курса»).
- **Settle accounts in source currency** internally; RUB is for marketing display only.

**Warning signs:**
- Hardcoded `EXCHANGE_RATE = 0.65` in code.
- Sales rep manually editing prices in admin to "fix" PDFs.
- Client comes back with PDF dated >7 days ago expecting that price.

**Phase to address:** Inventory pipeline + PDF generation.

**Severity:** **Serious.** Each mispriced sale can cost 200K–500K ₽; cumulative over a quarter, this is a real number for a 3-person team.

---

### Pitfall 10: Image hot-linking to source sites — broken images on day 30 / legal risk

**What goes wrong:**
Catalog cards and PDFs hot-link to images at `https://ci.encar.com/...jpg`. Three things go wrong:
- (a) Encar/Che168 add Referer-based hotlink protection or rotate CDN URLs; images 404 silently in production. Next day every card shows a broken image and PDFs ship to clients with `[image not loaded]` placeholders.
- (b) Russian users on slow connections: images load slowly because they're served from KR/CN/JP origins.
- (c) Korean copyright law (and Chinese) is murky on hot-linking commercial use; could draw a takedown.

**Why it happens:**
- "It's just a URL" — easiest path is to write the URL to DB and forget.
- Image storage on R2/S3 feels like extra infra for v1.

**How to avoid:**
- **Cache images to your own object storage:**
  - Russian S3-compatible: Yandex Object Storage, VK Cloud Object Storage, Selectel Cloud Storage. Stay in RF infra (also satisfies 152-FZ if PII ever shows up in image metadata, which it can — auction sheet photos sometimes include names).
  - At scrape time, download → resize (max 1600px wide) → re-encode JPEG quality 80 → upload to your bucket → store *your* URL in DB.
- **Cache deduplication:** key by sha256 of the original URL or image bytes; same URL pulled twice doesn't re-download.
- **PDF generation reads from your cache, not the source.** Otherwise PDF generation can hang for 30s waiting on a slow KR server.
- **Don't expose source URLs in HTML/PDF metadata** — partly helps with copyright deniability, partly avoids leaking internals.

**Warning signs:**
- `<img src="https://ci.encar.com/...">` in compiled HTML.
- Image load times in DevTools >2s for catalog cards.
- "Broken image" reports from clients.

**Phase to address:** Inventory pipeline phase.

**Severity:** **Serious.** Directly degrades product visual quality and PDF deliverability (slow PDF gen → timeout → user gets nothing).

---

### Pitfall 11: "Mock data confusing real customers in production"

**What goes wrong:**
The current scaffold ships with seed cars (LX 600, GV80, M5 Comp), seed founders, seed reviews, seed live-feed («Lexus LX 600 — выгружен во Владивостоке 2 мин назад»), seed live counter ("47 в работе"). On launch day, real users see this fictional data, sales reps get calls about cars that don't exist, founder credibility takes a hit. Plus the live-feed timestamps tick with `setInterval` based on first page load → users see "2 мин назад" stuck for 6 hours.

**Why it happens:**
- Seed data designed to make the scaffold look alive in dev — never marked as "REPLACE BEFORE LAUNCH."
- No environment guard between dev seed and prod data.
- Admin-managed live metrics are easier to forget about than scraped ones.

**How to avoid:**
- **Hard separation:** seed data lives in `seed.dev.ts`, only loaded when `NODE_ENV !== 'production'` AND `DATABASE_URL` is the dev one. Production starts with empty tables.
- **Pre-launch checklist:**
  - Real founder bios + photos (currently placeholder strings in `seed.ts`).
  - Real phone, email, Telegram, WhatsApp links (currently `+7 (999) 999-99-99`, `dvapro@gmail.com`).
  - Real reviews (or hide the section if none yet — better than fake testimonials, which are illegal under «закон о рекламе» if they misrepresent existing customers).
  - Real cars from at least one working scraper, OR catalog hidden until inventory is ingested.
  - Live counter and feed: connect to real data source OR explicitly mark with «демо-данные» badge OR remove from launch homepage entirely.
- **Audit log on admin-edited live metrics:** who changed `liveCount` from 47 to 47 (i.e., touched it) and when? This catches founders accidentally setting numbers that drift from reality.
- **Banner in admin:** "PROD — изменения видны клиентам сразу" header to prevent accidental edits as if it were staging.

**Warning signs:**
- `seed.ts` contents visible on the live site.
- A car ID that exists in `seed.ts` is referenced in a real client conversation.
- Sales rep calls about "Mercedes GLE 53" but it doesn't exist.

**Phase to address:** Pre-launch checklist + admin phase.

**Severity:** **Serious for credibility.** Recovery is fast (replace the data) but first-impression damage is real. For founders who have built reputation since 2005, this matters more than for a startup.

---

### Pitfall 12: "Просто смотрю варианты" leads polluting Bitrix and burning rep time

**What goes wrong:**
The 5-question quiz catches every visitor including price-shopping browsers, tire-kickers, competitors doing market research. They all hit Bitrix as «Новый лид». Sales reps call them, waste 10–15 min each, slowly stop calling within 2h, then real hot leads fall through the cracks. Lead-to-deal conversion looks terrible.

**Why it happens:**
- Quiz designed to maximize conversion-to-lead, not conversion-to-qualified-lead.
- Equal treatment of "хочу купить за 3 месяца" and "просто посмотреть".

**How to avoid:**
- **One qualifier question early:** «Когда планируете покупку?» with options [«В течение месяца», «1–3 месяца», «3+ месяца / просто смотрю»].
- **Two-tier handling:**
  - Hot/warm leads (≤3 mo) → Bitrix24 with stage = «Новая», alert sales rep within 1h.
  - Cold/browse leads → still get the PDF (good for brand), but go to a separate Bitrix funnel «Долгий цикл» OR stay in own DB only with an email-nurture tag, NOT pinged to a rep.
- **Track quiz drop-off per question** in the admin to identify which questions kill the funnel. (5 questions is borderline; each adds friction.)
- **"Honeypot" + simple velocity check** instead of CAPTCHA: hidden form field that bots fill but humans don't; reject submits faster than 5s after quiz open. CAPTCHAs nuke conversion; honeypot is invisible.

**Warning signs:**
- Bitrix funnel shows hundreds of leads, sales reps stopped working them.
- Lead-to-call conversion <40%.
- Sales rep complaint: "all leads are time-wasters."

**Phase to address:** Quiz design phase + Bitrix sync phase.

**Severity:** **Serious.** Directly destroys the value the funnel creates by exhausting the sales team.

---

### Pitfall 13: Country enum hardcoded, breaks UI when adding US/AE/EU later

**What goes wrong:**
Current `Country` enum is `'jp' | 'cn' | 'kr'`. PROJECT.md actively expands it to all 6 markets. UI components do `if (country === 'jp') ...` switches. Phase 3 adds `'us' | 'ae' | 'eu'` → flag rendering breaks, filter UI breaks (some markets have empty placeholder cards), PDF templates miss copy for new countries, Bitrix custom field for «Страна» has dropdown of old values, scraper config map is a closed list.

**Why it happens:**
- Enum-as-switch is the easy path in TypeScript.
- "We'll add the new countries when we add the scrapers" — but UI is built first.

**How to avoid:**
- **Single source of truth for country metadata:**
  ```ts
  export const COUNTRIES = {
    kr: { code: 'kr', label: 'Корея', labelEn: 'South Korea', flag: '🇰🇷', currency: 'KRW', deliveryDays: '14-25', scraperReady: true },
    jp: { ..., scraperReady: true },
    cn: { ..., scraperReady: true },
    us: { ..., scraperReady: false },
    ae: { ..., scraperReady: false },
    eu: { ..., scraperReady: false },
  } as const;
  export type Country = keyof typeof COUNTRIES;
  ```
- UI iterates `Object.values(COUNTRIES)`, never hardcodes the list.
- "Coming soon" cards filtered by `scraperReady === false` — single flag flip when a scraper lands.
- PDF country-specific copy in a same-shaped table.
- Bitrix field is a "free-text + suggested values" pattern, not a fixed list.

**Warning signs:**
- `if (country === 'jp')` anywhere in components.
- Hardcoded array of countries in 3+ files.
- New country added → 8 files changed.

**Phase to address:** Phase 1 (UI rewrite for 6 markets) — design the schema right *now*, even though only 3 scrapers exist.

**Severity:** **Annoying, not catastrophic** but compounds — every new country becomes 1-day refactor instead of a config row. With 3 markets pending, this is real time.

---

### Pitfall 14: Scrapers run inside the API server process → memory leak, OOM, deploys break

**What goes wrong:**
For convenience, scrapers run on an interval inside the same Node process as the API. After 3 days of scraping with Puppeteer: Chrome processes orphan, RSS climbs from 200MB to 2GB, the box OOM-kills the process, API goes down, monitoring screams at 3am. The team restarts. Three days later it happens again. This is **the** documented Puppeteer/Playwright failure mode in production.

**Why it happens:**
- `setInterval(scrape, 60_000)` inside `index.ts` "just works" until it doesn't.
- Chrome itself fragments memory across thousands of page loads; not a JS leak you can fix.
- `browser.disconnect()` instead of `browser.close()` orphans the process.
- Single Browser instance kept "for performance" → leaks.

**How to avoid:**
- **Scrapers run as separate processes**, scheduled via cron (system cron / node-cron / a real job runner like BullMQ workers). NOT inside the API server.
- **Each scrape run = fresh browser:** spawn → scrape → `await browser.close()` → exit process. Let the OS reclaim everything. Memory leaks become impossible because the process dies.
- **Hard timeout per scrape run:** if a scrape takes >10 min, kill it. Prevents zombie processes.
- **Resource limits in systemd / Docker:** `MemoryMax=1G`, `Restart=on-failure`. If scraper exceeds limit, restart contained.
- **Don't run all scrapers in parallel:** stagger via cron (`0 */2 * * *` for Encar, `30 */2 * * *` for BeForward, ...).
- **Monitor RSS over time** (Yandex Cloud monitoring or self-hosted Prometheus); alert if scraper RSS >800MB at process exit.

**Warning signs:**
- `ps -ef | grep chrome` shows >5 chrome processes.
- API latency spikes during scrape windows.
- "Out of memory" in syslog.
- Deploy fails because the API process is too slow to drain.

**Phase to address:** Inventory pipeline phase. Architect with separate workers from day 1, even if there's one scraper.

**Severity:** **Serious-to-catastrophic.** Down-API during business hours = no leads captured = direct revenue loss.

---

### Pitfall 15: Founders / sales reps share one admin login → no audit trail

**What goes wrong:**
Single shared `admin@dva.pro / Admin123!` password Slack-pasted to the team. Someone deletes a car or edits a real lead's phone number. No way to know who. Worst case: a disgruntled employee (or compromised laptop) edits live metrics on the homepage to «-3 в работе» and «satisfactionPct: 0», everyone scrambles. PROJECT.md explicitly mentions "founders sharing one login (audit-trail loss)" as a concern.

**Why it happens:**
- "We're 3 people, why bother."
- Magic-link onboarding feels heavyweight.
- No RBAC built initially because it's "later."

**How to avoid:**
- **Multi-user auth in v1, not v2.** Each person has their own account. PROJECT.md already lists this as Active.
- **Two roles minimum:** `founder` (full access including settings/users), `sales_rep` (leads + cars read; no settings/users edit; no destructive deletes).
- **Audit log table:** every admin write = row with `(actor_user_id, entity, entity_id, action, before, after, timestamp, ip)`. Visible to founders only.
- **Magic link auth via Russian SMTP** (see Pitfall 6) — if magic link hits spam, sales reps can't log in. Test on @yandex.ru / @mail.ru before launch.
- **Backup auth:** founders can always log in via password (in case email is broken); sales reps can be reset by founders without email.
- **Admin session timeout:** 24h max, re-auth required after.
- **Banner showing logged-in user** in admin top bar — social pressure prevents casual edits.

**Warning signs:**
- One password in Notion/Slack used by multiple people.
- No `users` table; just env-var ADMIN_PASSWORD.
- No `audit_log` table.
- `req.user.id` is hardcoded.

**Phase to address:** Auth phase. Don't ship admin without RBAC.

**Severity:** **Serious.** Catastrophic if the team grows to 5+; recoverable if the team is 3 and trust holds; either way, fixes get harder later.

---

### Pitfall 16: Long scrape blocks deploys / chained scrapers exhaust resources

**What goes wrong:**
Daily scrape at 3am takes 45 min. If a deploy is attempted at 3:15am, the API is half-restarted while the scraper holds a DB transaction → migration stuck → site down for 30 min. Or: trying to run all 6 scrapers in one cron line → memory exhaustion (Pitfall 14) + bandwidth saturation on a 100Mbps Russian VPS → all scrapes return partial data.

**Why it happens:**
- Scraper architecture not separated from API process.
- "Run them all" assumed to be parallel-safe.

**How to avoid:**
- **Migration locks:** use a tool like Prisma `prisma migrate deploy` or db-migrate that takes an advisory lock; if scraper holds it, deploy waits or aborts cleanly.
- **Long-running scrapes have a heartbeat** (write `last_heartbeat` every 30s); if heartbeat stops, supervisor kills it.
- **Per-scraper cron windows, not bursts:** Encar 02:00, BeForward 03:00, Che168 04:00, Autohome 05:00, drom-master 06:00 (weekly, not daily — model catalog doesn't change much). Quiet hours only — avoids API competition with frontend traffic.
- **Drom master DB is a *weekly* job**, not daily. Model catalog churns slowly.

**Warning signs:**
- Deploy hangs > 2 min on migrations.
- Cron logs show all scrapers starting at 00:00.
- Network usage flat at 100Mbps for hours.

**Phase to address:** Inventory pipeline phase + ops setup.

**Severity:** **Serious operational.**

---

### Pitfall 17: PDF stub landed-cost numbers shown as if they were real

**What goes wrong:**
PROJECT.md explicitly: "Stub-оценка landed-cost: видна в PDF и админе, но без настоящих формул." Risk: PDF says «Оценочная стоимость под ключ: 14 800 000 ₽» without disclaimer. Client signs based on PDF; actual customs/утильсбор/СБКТС comes in 1.5M ₽ higher. Client sues for breach (the PDF is a written quote). Russian law on advertising («Закон о рекламе») requires that advertised prices not be misleading; this is a clear-cut violation.

**Why it happens:**
- Stubs without disclaimers feel "good enough for v1".
- Designer prefers clean PDF; legal disclaimers are ugly.

**How to avoid:**
- **Visible disclaimer on every PDF page** with a price: «Указанная стоимость — предварительная оценка. Финальный расчёт фиксируется в договоре после уточнения параметров пошлин и логистики на дату покупки.»
- **Range, not point:** show «≈ 14.5–15.2 млн ₽» with the disclaimer about the range.
- **Sales rep workflow:** PDF is the *opening conversation*, договор is the *commitment*. Sales process must reinforce this (script, follow-up call mentions "финальная цена в договоре").
- **Audit log in admin** for any landed-cost edit, who changed the multiplier, when — so disputes can be traced.

**Warning signs:**
- PDF shows a number with no nearby qualifier word (≈, оценка, до, от).
- Sales rep complains client is "anchored" on PDF price.

**Phase to address:** PDF generation phase + landed-cost stub phase.

**Severity:** **Serious / potentially catastrophic.** Lawsuit risk. The FAQ explicitly promises «Никаких "сюрпризов" в финале» — the PDF disclaimer keeps that promise.

---

### Pitfall 18: Yandex Browser CSS/JS quirks not tested

**What goes wrong:**
Site looks great in Chrome. Yandex Browser (Chromium fork, but lags 2–3 versions and has its own ad-blocker, Турбо-режим, и «Алиса» integration that injects DOM) renders the quiz modal partially clipped, or the brand `--coral` accent renders flat because of color-management differences. Quiz works in Chrome desktop; on Yandex Browser mobile, the autofill triggers double-submit (Pitfall 7). PROJECT.md explicitly: "Yandex Browser — обязательно".

**Why it happens:**
- Devs use Chrome/Safari/Firefox; Yandex Browser usage in RF is ~15-25% (varies by region; high in regions outside Moscow/SPb).
- Турбо-режим compresses images/CSS through a Yandex proxy → can break custom fonts or distort layout.

**How to avoid:**
- **Install Yandex Browser locally** (free). Test the quiz flow E2E on it.
- **Test on Yandex Browser mobile** (iOS via TestFlight or Android emulator). Mobile is harder than desktop.
- **CSS:** avoid newest features (`@container queries`, `:has()` if mobile target — Yandex Browser supports them but lag varies). Prefer Tailwind / well-tested CSS over experimental.
- **Don't rely on system fonts;** specify the font stack with web-safe fallbacks. JetBrains Mono is bundled, OK.
- **Test PDF download flow:** does it open in-browser PDF viewer (Yandex Browser has its own), does it offer "сохранить" properly?
- **Add Yandex Browser to BrowserStack / LambdaTest** matrix if budget allows; otherwise manual.

**Warning signs:**
- Designer screenshot looks different from Yandex Browser screenshot.
- Quiz button doesn't fire on Yandex mobile.
- Unicode characters in PDF download filename get mangled.

**Phase to address:** QA phase before launch.

**Severity:** **Serious for regional users.** A founder in Vladivostok who tests on Yandex Browser will catch this; a Moscow dev on Chrome won't.

---

### Pitfall 19: Magic-link / password-reset email lands in spam → admin locked out

**What goes wrong:**
Admin auth uses magic-link via foreign SMTP. Sales rep at @mail.ru tries to log in, magic link goes to Spam, they don't know, they're locked out, founder has to reset manually. At launch this happens to multiple reps; admin becomes a "we'll get to it" black box, founders edit data through the dev backdoor → no audit trail (Pitfall 15 amplified).

**Why it happens:**
- Same root cause as Pitfall 6 — but with double the impact because admin auth gates *internal* operations.

**How to avoid:**
- Same mail-deliverability hygiene as Pitfall 6: Russian SMTP, SPF/DKIM/DMARC, postmaster monitoring.
- **Always-available password backup** for admin login — magic link should be additive convenience, not the sole gate.
- **OTP/TOTP option** (Aegis, Google Authenticator) for admin — bypasses email entirely, more secure.
- **Test the auth flow on @mail.ru, @yandex.ru, @rambler.ru, @gmail.com mailboxes** as part of launch QA.

**Warning signs:**
- "I didn't get the link" complaints from team members.
- Founder regularly resetting passwords for sales reps.

**Phase to address:** Auth phase.

**Severity:** **Annoying-to-serious** depending on team size.

---

### Pitfall 20: Cyrillic vs Latin model name confusion in catalog/search

**What goes wrong:**
drom.ru/catalog has «Лексус LX 600» as title. Encar has "Lexus LX 600". Che168 has "雷克萨斯 LX 600". After normalization, three brand strings in DB: `Лексус`, `Lexus`, `雷克萨斯`. Filter UI shows duplicates. PDF shows mixed: «Лексус LX 600 (Lexus LX 600)». User searches "BMW M5", gets 0 hits because DB has «БМВ M5».

**Why it happens:**
- Each source uses native script.
- Naive normalization: store-as-given.

**How to avoid:**
- **Canonical brand/model registry**, mapped from each source's strings. drom.ru/catalog *is* this canonical source for the Russian market — use it as the master and map foreign-source strings to it.
- **Normalization function:** `normalizeBrand("Лексус") === normalizeBrand("Lexus") === "lexus"` (lowercase, transliterate Cyrillic→Latin OR keep Cyrillic and transliterate Latin→Cyrillic, pick one and stick with it).
- **Display strategy:** show in Cyrillic (Russian users expect it: «Лексус»), but also store the Latin canonical for SEO and filter URLs (`/catalog/lexus/lx-600`).
- **Dual-script search:** match on either input — user types "lexus" or "Лексус", both find the same cars.
- **Test with a corpus of 20 popular brands** in both scripts.

**Warning signs:**
- Filter dropdown shows "Lexus" and "Лексус" as separate options.
- Search for "Genesis" returns nothing because DB has «Дженезис».

**Phase to address:** Inventory pipeline + catalog UI.

**Severity:** **Annoying** but UX-killing. Founders will catch this in QA.

---

### Pitfall 21: PostgreSQL/MySQL UTF-8 collation defaults break Cyrillic sort

**What goes wrong:**
Default Postgres collation on a fresh server (especially Russian distros) might be `C` or `en_US.UTF-8` → Cyrillic sort order in catalog filter is wrong («Я» comes before «А» alphabetically with C collation). Bigger problem: case-insensitive search with `LIKE '%лексус%'` doesn't match `Лексус` because `lower()` is locale-dependent.

**Why it happens:**
- Default collation on cloud databases is often C or en_US.
- No one tests sort with «Я» vs «А».

**How to avoid:**
- **Database created with `LC_COLLATE='ru_RU.UTF-8'` / `LC_CTYPE='ru_RU.UTF-8'`** — set at DB creation, hard to change after.
- **Or use ICU collation:** Postgres 12+ supports `CREATE COLLATION ru_icu (provider = icu, locale = 'ru-RU-u-ks-level2-ka-shifted')` — handles Russian sorting + case-insensitivity properly.
- **For search:** use `ILIKE` (Postgres) or proper full-text search with Russian dictionary (`to_tsvector('russian', ...)`).
- **Test sort with Cyrillic strings** in CI.

**Warning signs:**
- `ORDER BY brand` puts «Я-brands» before «А-brands».
- Search input «лексус» returns 0 even though DB has `Лексус`.

**Phase to address:** Database setup phase.

**Severity:** **Annoying** but very visible.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded FX rate (e.g., `KRW_RUB=0.65`) | One-line, ships today | Stale prices → angry clients → FX losses (Pitfall 9) | Never in production |
| Foreign SMTP (Resend/Mailgun) for "v1 simplicity" | Working email in 5 min | 152-FZ violation + spam folders (Pitfalls 1, 6) | Never for prod |
| Sentry SaaS for error tracking | Zero ops, free tier | 152-FZ violation when stack traces include user input | Never; use GlitchTip self-hosted |
| Single shared admin password | Onboarding speed | Audit-trail loss, no accountability (Pitfall 15) | Never; build RBAC in v1 |
| Truncate-and-reload scraper pattern | Simple SQL, idempotent results | Empty catalog windows; mid-run failure = data loss (Pitfall 8) | Never for production data |
| Hot-link scraped images | No storage cost, no upload pipeline | Broken images on day 30, slow PDFs, copyright risk (Pitfall 10) | Maybe in dev/staging only |
| Pre-checked consent checkbox | +5% conversion | Catastrophic 152-FZ fines (Pitfall 2) | Never |
| Scrapers in API process | Single deploy unit | OOM, downtime, blocked deploys (Pitfall 14) | Only with very small data + non-headless requests |
| Seed data left in prod DB | Demo-able homepage on day 1 | Real users see fake reviews, fake cars (Pitfall 11) | Never past launch checklist |
| Single-source-of-truth Country enum hardcoded as union | Type safety | Refactor for every new country (Pitfall 13) | Acceptable when country count is truly fixed forever |
| Skip Bitrix idempotency, rely on its dedupe job | Less code | Pipeline pollution for 24h, lost rep trust (Pitfall 7) | Only if leads volume <5/day forever |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Encar.com | Scrape from Russian DC IP with raw HTTP | KR residential proxy + Playwright stealth, polite rate limit, monitor for empty responses |
| USS Auctions | Scrape behind partner login | Don't scrape — use licensed exporter API or partner CSV |
| BeForward | Burst parallel requests for speed | 1 req per 2–5s, single thread, retry with backoff on 429 |
| Che168 / Autohome | Datacenter proxy + axios | CN residential/mobile proxy + Playwright with realistic fingerprint; expect empty pages even when "succeeding" |
| drom.ru/catalog | Heavy scraping of HTML | Check `baza.drom.ru/help/API` first; respect Crawl-delay; weekly not daily |
| Bitrix24 | Synchronous `crm.lead.add` on quiz submit | Queue async, dedupe by external_id custom field, retry with idempotency key |
| Bitrix24 | Custom fields named `UF_CRM_FIELD1` | Named `UF_CRM_DVAPRO_LEAD_ID` etc; future-proof and self-documenting |
| Bitrix24 | Rely on its 1/day duplicate merge | Implement dedupe at write side; merge is cleanup not prevention |
| Bitrix24 | Treat webhook delivery as exactly-once | At-least-once; consumer must be idempotent (5-10 min retry delay possible) |
| Yandex Object Storage | Use foreign S3 SDK assuming endpoint compat | Test signature v4 with `endpoint: 'https://storage.yandexcloud.net'`; some SDKs default to AWS regions |
| CBR exchange rates | Scrape HTML page | Use official XML feed `https://www.cbr.ru/scripts/XML_daily.asp` (free, no key) |
| Yandex 360 SMTP | Send 1000 emails first day | Warm up: 50/day → 200 → 1000 over 2 weeks |
| Roskomnadzor notification | Submit after launch | Submit BEFORE first real PII collection; 5-day processing window |
| Google Fonts CDN for PDF | Convenient | Self-host TTF — Russian server may not have egress to fonts.googleapis.com, and 152-FZ |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| All scrapers parallel on 2GB VPS | OOM, half-empty catalog | Stagger via cron, serialize per-source | First week of production |
| PDF generation in API request thread | API timeouts under load | Queue PDFs (BullMQ); return "PDF готовится, ссылка на email" | At ≥5 concurrent quiz submits |
| Image hot-linking to source | Slow load, broken images | Cache to Russian S3, resize at ingest | At ≥100 catalog cards on a slow KR network |
| `SELECT * FROM cars` in catalog API | Slow page loads as inventory grows | Pagination + indexed filters from day 1 | At ≥1000 cars |
| No per-source success metrics | Silent scraper failures | Per-source `last_success_at`; alert if stale | Always |
| Synchronous Bitrix sync on quiz submit | Quiz submit fails when Bitrix is down | Queue, retry with backoff | First Bitrix outage |
| Puppeteer browser kept alive | RSS climbs to OOM (Pitfall 14) | New browser per scrape run, `browser.close()` | After 3-5 days of scraping |
| Live-counter SSE/WebSocket per visitor | Connection limit on cheap VPS | Polling at 30-60s OR push only on stat update via SSE with shared connection | At ≥100 concurrent users |
| Full-text search via `LIKE '%term%'` | Slow as catalog grows | `to_tsvector('russian', ...)` + GIN index | At ≥5000 cars |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing Bitrix webhook URL in client-side code | Anyone can spoof leads → pollute pipeline | Webhook secret server-side only; sign requests |
| Admin UI accessible without HTTPS | Credential theft on public WiFi | HSTS + Russian SSL (Let's Encrypt works in RF) |
| Scraper cookies/sessions stored in repo | If repo leaks, lose source-site access | Env vars + secret manager (Yandex Lockbox / VK Secret Manager) |
| Phone numbers in URL params (`?phone=+7...`) | Logged in nginx access logs, web bugs | POST body only; sanitize logs to redact `phone`, `email`, `name` |
| PDF URLs are guessable (`/pdf/lead-1.pdf`) | Anyone can enumerate other clients' PDFs | Random opaque tokens (`/pdf/abc123-uuid`); time-limited signed URLs from S3 |
| Admin endpoints behind only Basic Auth | Brute-force, no MFA | Real auth + rate limit + IP allowlist if feasible |
| No input sanitization on quiz answers → stored in PDF / shown to admin | XSS if admin views raw HTML, malicious content in PDFs | Treat all user input as untrusted, escape on render, strict allowlist for any rich content |
| Founder edits live metrics without limits | Easy to display absurd numbers | Validation on backend (`liveCount` > 0 and < 9999, etc.) |
| Roskomnadzor notification missing | Operational risk during inspection | File before launch — non-negotiable |
| No DDoS protection but on Russian DC | First Habr post → site down | Yandex DDoS Protection / StormWall / Qrator (all RF-friendly) |
| Logs include personal data | Subject access requests / 152-FZ violation | Structured logger with PII redaction by field |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Quiz length 7+ questions | 40-60% drop-off after Q5 | Stay at 5; add Q6 only if it's a measured lift in lead quality, not just lead volume |
| Pre-checked consent checkbox | Illegal (Pitfall 2) AND feels coercive to RU users | Explicit unchecked checkbox, prominent label |
| PDF arrives 5 minutes later (queue delay) | User assumes broken, leaves | Show "ссылка на PDF придёт через минуту" + immediate on-screen PDF preview link |
| Phone number field not formatted | Users type `+7-999-...` vs `89999999999` → DB inconsistency | Mask input to `+7 (___) ___-__-__`, store normalized E.164 |
| No loading state on quiz submit | Double-submit (Pitfall 7) | Disabled button + spinner + idempotency key |
| Catalog cards link to per-car page that doesn't exist | 404s, looks broken | PROJECT.md correctly forbids this; ensure CTAs go to quiz, not non-existent /cars/{id} |
| Russian users on slow regions (DV, Сибирь) hit 5MB image-heavy homepage | Bounces, never sees quiz | Image lazy-load, AVIF/WebP, srcset, ≤200KB per hero image |
| Whatsapp/Telegram/Phone link broken on mobile | User can't contact at peak intent moment | Use `tel:` and proper `https://wa.me/` and `https://t.me/` formats; test on iOS Safari & Yandex Browser mobile |
| Live-feed timestamps stale ("2 мин назад" for 6h) | Looks fake → trust loss | Compute timestamps server-side relative to render OR refresh client-side ticker |
| Founder photos missing/placeholder on launch | "Who am I trusting with 14M ₽?" loss of credibility | Real photos + real bios block launch (Pitfall 11) |
| Currency shown only in RUB without source currency | User can't sanity-check FX (Pitfall 9) | Always show both in PDF and catalog cards |

---

## "Looks Done But Isn't" Checklist

Pre-launch verification — things that appear complete but are missing critical pieces.

- [ ] **152-FZ compliance:** Roskomnadzor notification filed — verify by checking pd.rkn.gov.ru registry shows ИНН of the operating ООО.
- [ ] **152-FZ compliance:** All form-handling endpoints serve directly from RF DC — verify with `traceroute dva.pro` and network tab on quiz submit (no `*.cloudflare.com` / `*.vercel.app` / `*.workers.dev`).
- [ ] **Consent flow:** Quiz submit fails server-side if consent flag is missing — verify by curl-ing the API directly without consent.
- [ ] **Email deliverability:** SPF/DKIM/DMARC pass on mxtoolbox AND emails arrive in Inbox (not Spam) at @yandex.ru, @mail.ru, @rambler.ru, @gmail.com — verify with seed sends.
- [ ] **PDF Cyrillic:** every weight/style of every font registered, renders on Linux server, file ≤2MB — verify with `pdftotext` on generated file showing Cyrillic.
- [ ] **PDF disclaimer:** «Предварительная оценка» visible on every page with prices.
- [ ] **Inventory:** at least one scraper runs end-to-end and ingests >50 cars; per-source `last_success_at` visible in admin.
- [ ] **Inventory:** soft-delete works — manually expire a test car in source data, verify it's marked inactive within 1 scrape cycle.
- [ ] **Idempotency:** double-submit the quiz — verify only one lead, one PDF, one Bitrix entry.
- [ ] **Bitrix sync:** Bitrix outage simulation (block their IP) — verify quiz still works and leads queue for retry.
- [ ] **Admin RBAC:** sales_rep cannot edit settings, cannot delete cars; verified by switching role in test.
- [ ] **Audit log:** every admin write produces a log row visible to founders.
- [ ] **Currency:** FX rate updates daily from CBR; PDF shows rate date.
- [ ] **No seed data in prod:** founder bios, reviews, feed, live counter all populated with real values OR sections hidden.
- [ ] **Yandex Browser:** quiz E2E + PDF download tested on Yandex Browser desktop AND mobile.
- [ ] **Image cache:** verify catalog images served from your domain, not source (`<img src="https://static.dva.pro/...">`, not `https://ci.encar.com/...`).
- [ ] **Scraper isolation:** scraper process is separate from API; killing scraper doesn't take down API.
- [ ] **DB collation:** Cyrillic sort order + case-insensitive search work — test with «Я» vs «А» strings.
- [ ] **Magic-link auth:** sales rep on @mail.ru can actually log in (verify in Inbox, not Spam).
- [ ] **Country enum:** adding a 7th country (e.g., `'th'`) is a single config-file edit; no other files change.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| 152-FZ violation discovered post-launch | HIGH | Halt collection, file Roskomnadzor notification, migrate data to RF infra, audit logs, prepare for inspection. Probably engage 152-FZ specialist law firm. |
| Pre-checked consent shipped | HIGH | Hotfix to require explicit consent; for affected leads, treat as unconsented (delete or get explicit consent retroactively via call). |
| Encar/Che168 IP banned | MEDIUM | Switch proxy pool, slow down rate, change fingerprint. May need 1–2 days of empty Encar inventory. |
| USS scraping caught by partner | HIGH | Apologize publicly to partner, may permanently lose USS data access. Switch JP source to BeForward + paid feed. |
| PDF Cyrillic boxes in production | MEDIUM | Hotfix font registration, regenerate already-sent PDFs, email apology + corrected PDF to affected clients. |
| Email landing in spam | MEDIUM | Switch SMTP provider, fix DNS records, warm up new sending IP, send affected clients direct re-issue. |
| Duplicate leads in Bitrix | LOW-MEDIUM | Bitrix duplicate merge job + manual cleanup. Add idempotency key going forward. |
| Inventory shows sold cars | LOW | Run "verify-still-exists" sweep against source URLs; mark 404s as inactive. Add soft-delete logic. |
| Stale FX → mispriced PDF | MEDIUM | Sales rep calls client with corrected price BEFORE договор; absorb the cost on already-signed deals. |
| Mock data shown to real users | LOW | Replace immediately, send brief explainer to anyone who interacted. |
| Admin shared password leaked | MEDIUM | Reset all passwords, audit recent admin actions, build RBAC if not yet built. |
| Scraper OOM took down API | MEDIUM | Restart, separate scraper into worker process, set memory limits. Affected lead window: minutes-hours. |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Foreign infra → 152-FZ | Phase 0/1 (hosting & backend stack selection) | Network trace on quiz submit; Roskomnadzor notification filed |
| 2. Pre-checked consent | Phase that builds quiz submit | Server rejects submit without consent flag |
| 3. Scraper anti-bot per source | Phase: inventory pipeline | Per-source `cars_ingested` > threshold for 7 days |
| 4. USS scrape attempt | Phase: inventory pipeline (kickoff decision) | No `ussnet.co.jp` in code; partner-CSV path documented |
| 5. PDF Cyrillic | Phase: PDF generation | CI test asserts Cyrillic text appears in generated PDF |
| 6. Email spam folders | Phase: email delivery (dedicated 2-3 day mini-project) | Inbox placement at all 4 major RF mail providers |
| 7. Quiz race / duplicate leads | Phase: quiz submit + Bitrix sync | Double-submit test produces 1 lead |
| 8. Scraper upsert / soft delete | Phase: inventory pipeline | Idempotency test in CI; "still-exists" sweep |
| 9. FX stale pricing | Phase: inventory + PDF | CBR rate cached daily; PDF has rate date |
| 10. Image hot-linking | Phase: inventory pipeline | Catalog/PDF images served from own domain |
| 11. Mock data in prod | Phase: pre-launch checklist | Real bios/reviews/cars or hidden sections |
| 12. Browse-tier leads polluting Bitrix | Phase: quiz design + Bitrix sync | Two-tier funnel; sales-rep alerts only on hot |
| 13. Country enum hardcoded | Phase 1 (UI rewrite) | Adding country = 1-file edit |
| 14. Scraper memory leak | Phase: inventory pipeline (architecture) | Scraper as separate process, RSS bounded |
| 15. Shared admin login | Phase: auth | Multi-user with RBAC, audit log |
| 16. Long scrape blocks deploy | Phase: ops setup | Scraper supervisor + migration locks |
| 17. Stub landed-cost as real | Phase: PDF + landed-cost stub | Disclaimer visible on every PDF page with price |
| 18. Yandex Browser quirks | Phase: pre-launch QA | E2E quiz + PDF tested on Yandex Browser |
| 19. Magic-link to spam | Phase: auth + email delivery | Sales rep magic-link inbox-tested at mail.ru |
| 20. Cyrillic/Latin model name | Phase: inventory + catalog UI | Search "Lexus" and "Лексус" return same cars |
| 21. DB collation for Cyrillic | Phase: database setup | `ORDER BY brand` orders А→Я correctly |

---

## Sources

### 152-FZ / Roskomnadzor (HIGH confidence — official + recent legal commentary)
- [Comply: Локализация и трансграничная передача персональных данных. Что изменилось с 1 июля 2025 года](https://comply.ru/tpost/c43ezsout1-lokalizatsiya-i-transgranichnaya-peredac)
- [Е-Офис 24: Трансграничная передача персональных данных: новые требования, уведомление в РКН и запрет Google Analytics](https://e-office24.ru/news/transgranichnaya-peredacha-personalnykh-dannykh/)
- [PR-CY: Аналоги Cloudflare в России — чем заменить CDN, WAF и защиту от DDoS](https://pr-cy.ru/news/p/10636-analogi-cloudflare-v-rf)
- [vc.ru: Новые требования РКН в 2025 — гайд по 152-ФЗ без юридического булшита](https://vc.ru/legal/2149867-novye-trebovaniya-rkn-2025-kak-izbezhat-shtrafov-za-lokalizatsiyu-dannyh)
- [b-152.ru: Хранение персональных данных за границей — что разрешено в 2025](https://b-152.ru/hranenie-personalnyh-dannyh-za-granicej)
- [Klerk: Как выполнить требования Роскомнадзора к сайтам, чтобы избежать штрафа до 18 млн руб.](https://www.klerk.ru/blogs/data-sec/664827/)
- [Profdelo: Можно ли ставить галочку согласия по умолчанию в 2025 году](https://www.profdelo.com/blog/galochka-kotoraya-stoit-milliony-pochemu-soglasie-po-umolchaniyu-bolshe-ne-schitaetsya-soglasiem/)
- [ic-tech: Можно ли оформить согласие на обработку персональных данных через чекбокс?](https://ic-tech.ru/blog/faq/questions-152fz/mozhno-li-oformit-soglasie-galochkoy-v-chekbokse/)
- [Garant: Согласие на обработку персональных данных с 1 сентября 2025 года](https://www.garant.ru/article/1862510/)
- [pd.rkn.gov.ru: Форма уведомления оператора](https://pd.rkn.gov.ru/operators-registry/notification/form/)
- [Контур.Экстерн: Как уведомить Роскомнадзор об обработке персональных данных](https://www.kontur-extern.ru/info/25487-kto_i_kogda_dolzhen_uvedomit_roskomnadzor_ob_obrabotke_personalnyx_dannyx)
- [КонсультантПлюс: Федеральный закон 152-ФЗ (последняя редакция)](https://www.consultant.ru/document/cons_doc_LAW_61801/)
- [Cloud.ru: 152-ФЗ в облаке](https://cloud.ru/blog/152-fz-v-oblake)

### Scraping target sites (MEDIUM confidence — second-hand reports + community)
- [Carapis docs: Encar.com Parser](https://docs.carapis.com/parsers/encar.com/intro)
- [Korean Supreme Court 2021Do1533 — scraping public data is legal in KR (Lexology)](https://www.lexology.com/library/detail.aspx?g=1ae8c0a9-660b-45b7-9ef6-030f387d6e29)
- [USS Auto Auction — official site](https://www.ussnet.co.jp/en/auction/index.html)
- [Provide Cars: USS Auction Guide for Japanese Used Car Exporters](https://providecars.co.jp/about-auction/about-uss-auction/)
- [drom.ru API help](https://baza.drom.ru/help/API)
- [vnpavlukov/drom.ru parser (community)](https://github.com/vnpavlukov/drom.ru)
- [Datacol: Парсер drom.ru](https://web-data-extractor.net/parser-drom-ru/)
- [niespodd/browser-fingerprinting analysis](https://github.com/niespodd/browser-fingerprinting)

### Russian email deliverability (HIGH confidence)
- [Skysnag: Understanding Yandex Mail DMARC Reports](https://www.skysnag.com/blog/dmarc-report-received-from-yandex-mail-what-you-need-to-know/)
- [Validity Return Path: Yandex deliverability best practices](https://help.returnpath.com/hc/en-us/articles/115002967447-Yandex-deliverability-best-practices)
- [MXToolbox: Yandex Mail SPF & DKIM Setup](https://mxtoolbox.com/c/outboundemailsources?public=Yandex-Mail)
- Yandex Postmaster (postoffice.yandex.com) and mail.ru Postmaster (postmaster.mail.ru) — official tools

### @react-pdf/renderer (HIGH confidence — official docs + GitHub issues)
- [react-pdf.org: Fonts](https://react-pdf.org/fonts)
- [Issue #1366: Fonts dont apply to PDF (cyrillic)](https://github.com/diegomura/react-pdf/issues/1366)
- [Issue #2862: Font not working](https://github.com/diegomura/react-pdf/issues/2862)
- [Issue #2675: Custom font causes usePDF stuck loading](https://github.com/diegomura/react-pdf/issues/2675)
- [Issue #796: fontWeight doesn't work](https://github.com/diegomura/react-pdf/issues/796)
- [Issue #2730: 3.4.4 font changes no longer apply](https://github.com/diegomura/react-pdf/issues/2730)

### Bitrix24 (HIGH confidence — official docs)
- [Bitrix24: REST API Limits](https://apidocs.bitrix24.com/limits.html)
- [Bitrix24: Incoming and Outgoing Webhooks](https://apidocs.bitrix24.com/local-integrations/local-webhooks.html)
- [Bitrix24 Helpdesk: Duplicate Control](https://helpdesk.bitrix24.com/open/18346126/)
- [Bitrix24 Helpdesk: Custom fields in CRM](https://helpdesk.bitrix24.com/open/22067852/)
- [Bitrix24 Helpdesk: Automatic duplicate merging in CRM](https://helpdesk.bitrix24.com/open/25404806/)
- [Bitrix24 REST: Create a Custom Field for Leads](https://apidocs.bitrix24.com/api-reference/crm/leads/userfield/crm-lead-userfield-add.html)

### Puppeteer/Playwright memory issues (HIGH confidence)
- [Puppeteer Issue #5893: Chrome memory leak](https://github.com/puppeteer/puppeteer/issues/5893)
- [Puppeteer Issue #4059: page.evaluate leaking memory](https://github.com/puppeteer/puppeteer/issues/4059)
- [Devforth: Universal way to fix RAM leaks in Puppeteer](https://devforth.io/blog/how-to-simply-workaround-ram-leaking-libraries-like-puppeteer-universal-way-to-fix-ram-leaks-once-and-forever/)
- [Browserless: Hunting White Whales — JavaScript Memory leaks](https://docs.browserless.io/blog/2020/09/02/finding-memory-leaks.html)
- [Medium / Dina Matveev: The Hidden Cost of Headless Browsers](https://medium.com/@matveev.dina/the-hidden-cost-of-headless-browsers-a-puppeteer-memory-leak-journey-027e41291367)

### Russian customs / utilization fee 2024-2026 (MEDIUM confidence — recent commentary)
- [The Insider: Wheels of fortune — Inside the car smuggling trade feeding Vladivostok](https://theins.ru/en/economics/275736)
- [AutoCango: 2024 Guide to Import Used Cars from China to Russia](https://www.autocango.com/blog-detail/Guide-Importing-Used-Cars-China-Russia-2024)
- [Dantful: Ultimate Guide to Import and Ship Cars from China to Russia 2024](https://www.dantful.com/import-and-ship-cars-from-china-to-russia/)

### Project context
- /Users/mikhailra/Developer/dva.pro/.planning/PROJECT.md
- /Users/mikhailra/Developer/dva.pro/src/crm/seed.ts

---
*Pitfalls research for: DVApro — Russian vehicle-import marketplace*
*Researched: 2026-04-26*
