# Project Research Summary — DVApro

**Project:** DVApro — Russian vehicle-import marketplace (lead funnel + scrapers + Cyrillic PDF + admin)
**Domain:** Founder-led broker funnel on Russian-resident infra (152-FZ), 6 markets declared / 3 scraped
**Researched:** 2026-04-26
**Confidence (overall):** MEDIUM-HIGH — stack/architecture are HIGH; scraper anti-bot specifics and per-source proxy economics are MEDIUM and will surface real costs only when P4 starts.

---

## TL;DR

- **The product is a quiz → branded Cyrillic PDF → email → lead-row pipeline** bolted onto an already-built Vite/React SPA. Everything else (scrapers, admin, multi-market, live feed) feeds that single loop. Architecture, features, and pitfalls all converge on this.
- **152-FZ is the load-bearing constraint, not a checkbox.** Since 1 Jul 2025, *primary collection* of Russian PII through any foreign edge (Cloudflare, Vercel, Sentry SaaS, Mailgun, GA) is illegal — fines start at 1M ₽. This locks: Russian hosting (Yandex Cloud `ru-central1`), Russian SMTP (Unisender Go), self-hosted observability (GlitchTip), Yandex Metrika only, Roskomnadzor notification *before* first lead.
- **Stack converged with high confidence:** Hono on Node 22 + Drizzle + Postgres 16 + BullMQ-on-Redis (or pg-boss) + Crawlee/Playwright + `@react-pdf/renderer` + Better-Auth + Yandex Object Storage. The frontend Vite SPA stays — no Next.js migration.
- **Scope is dominated by what *not* to build:** v1 ships landed-cost as a stub, Bitrix24 sync deferred, US/AE/EU scrapers deferred, no per-car pages, no checkout, no client portal, no EN locale. Everything is sized so the quiz→PDF→email loop closes end-to-end before scraper fleet polish.
- **One scraper end-to-end (Encar) is the inventory critical path** — the second through fifth scraper share `normalize/images/http` plumbing and parallelise after P4. Don't build all 6 in parallel before one works.
- **Two pitfalls have unbounded recovery cost and must be addressed in P0/P1:** foreign-edge PII collection (Pitfall 1) and pre-checked / bundled consent (Pitfall 2). Everything else is recoverable in days; these are recoverable in months and 7-figure ₽.
- **Email deliverability is its own 2–3 day mini-project** (SPF/DKIM/DMARC + Yandex Postmaster + warm-up) sitting on the same critical path as PDF rendering — without it, the conversion artifact never reaches the inbox.
- **Cyrillic PDF is a known-bug minefield in `@react-pdf/renderer`** — register every weight/style explicitly, self-host TTF (no Google Fonts CDN), CI-test with a Cyrillic fixture string. Treat as P0 risk, not P3 polish.

---

## Locked stack & infra

**Backend:** Node.js 22 LTS + **Hono 4.12** (`@hono/node-server`) running as two processes from one image (api + worker). **Drizzle ORM 0.45** + **PostgreSQL 16** managed on **Yandex Cloud** `ru-central1`. **BullMQ 5** on managed **Redis** for cron + retries (or pg-boss — see tension #1). **Crawlee + Playwright 1.59** for scraping (Firefox engine where Chromium is detected aggressively). **`@react-pdf/renderer` 4.5** with self-hosted TTF (Inter / IBM Plex Sans / PT Sans for Cyrillic; JetBrains Mono accent already in brand). **Better-Auth** (Lucia is deprecated since Mar 2025) with sessions in Postgres. **Unisender Go** for transactional email (RU-resident; backups: SendPulse RU, Mailopost). **Yandex Object Storage** (S3-compatible) for PDFs + rehosted images. **GlitchTip** self-hosted for errors; **Yandex Monitoring** for metrics. **GitLab CI** with self-hosted runner on a Yandex Compute VM. **Frontend stack untouched** (Vite + React 18 + TS + react-router).

**Disagreement to resolve:** STACK recommends **BullMQ + managed Redis** (production-proven, named queue dashboards via `bull-board`); ARCHITECTURE recommends **pg-boss** (no Redis to provision, ship faster, fine at <500 leads/day). Both are correct — pick by ops appetite. Recommendation: **adopt pg-boss for v1**, design queue interface so swap to BullMQ is mechanical if scraper throughput demands it. This avoids provisioning Redis in week 1 and matches ARCHITECTURE's "ship faster" priority on the 4–6 week deadline.

**No other stack disputes.** PDF tool, ORM, framework, hosting, email provider, auth — STACK and ARCHITECTURE agree.

---

## Critical path to soft-launch

ARCHITECTURE proposed P0–P7. Reconciling against STACK's compliance gates and PITFALLS' irreversibility:

```
P0  Hosting + DB provisioned (ru-central1) + Roskomnadzor notification filed
    + DB collation set to ru_RU.UTF-8 + email DNS (SPF/DKIM/DMARC) started warming
P1  Schema + migrations + API skeleton (Hono, public reads, auth scaffold)
    + Country enum extended to 6 markets via single-source-of-truth registry
P2  Frontend ↔ API integration (CrmProvider rewrite preserving useCrm() surface)
    + 152-FZ consent checkbox + /privacy + /offer pages live
P3  POST /leads + queue + PDF render (Cyrillic-safe) + email send
    + idempotency key wired through (quiz-start UUID, not submit UUID)
    + landed-cost stub with disclaimer on every PDF page
P4  ONE working scraper (Encar) end-to-end via Crawlee + KR residential proxy
    + per-source last_success_at metric + image rehosting to YOS bucket
    + soft-delete via last_seen_at
P5  Admin auth (Better-Auth, multi-user, founder/sales-rep roles)
    + audit_log on all admin writes + LeadsAdmin wired to real DB
P6  Content polish (real founder bios/photos/reviews, FAQ finalised, mobile audit,
    Yandex Browser smoke-test, floating contact widget,
    Yandex Metrika + 4 goals, ИНН/ОГРН in footer)
P7  Soft-launch — pre-launch checklist (see PITFALLS "Looks Done But Isn't")
```

**Parallelisable after P1:** PDF template design (P0 schema is enough), scraper plumbing for sources 2–5 (after P4 baseline), admin polish for non-leads entities, real founder/review content (no code dep), Unisender warm-up.

**Hard sequencing rationale:**
- P0 before everything because Roskomnadzor notification has a 5-day processing window and email warm-up takes ~2 weeks.
- One scraper before all scrapers because they share `normalize/images/http` plumbing.
- Lead-flow before scrapers because the matcher can be tested against hand-INSERTed cars; the matcher cannot be tested without lead-flow.
- Admin auth before LeadsAdmin because leads contain PII.

---

## Table-stakes vs differentiators vs anti-features

**Table stakes (without these the funnel doesn't open):**
ИНН/ОГРН in footer · 152-ФЗ consent checkbox + /privacy page · Telegram + WhatsApp + phone in a floating widget · "под ключ" price + local-currency price · FAQ · visible 6-step process · catalog cards with country flags + status badges (typed enum, not freeform strings) · Founders with real faces and bios · mention of СБКТС/ЭПТС/утильсбор · Yandex Metrika with 4 goals · mobile-responsive · Yandex Browser smoke-test.

**Differentiators (DVApro's wedge over Trust Encar / Japan Transit / AVADGE / Kimura):**
- 5-question quiz → branded Cyrillic PDF on email (competitors stop at "менеджер свяжется"; PDF is *the* artifact)
- Founders-as-product (Денис + Алексей signed PDF; competitors are anonymous)
- Multi-market brand (6 countries declared, US/AE/EU as "по индивидуальному заказу")
- Live admin-managed feed-ticker with 4 hero stats — *honest* social proof, no fake generators
- Master-DB of models from drom.ru/catalog → can recommend a model when no live listing exists
- Itemised landed-cost in PDF (even as stub) → counter to industry "хидден доплат" pain

**Anti-features (locked in PROJECT.md, reinforced by FEATURES + PITFALLS):**
no e-commerce checkout · no per-car detail pages · no client self-service portal · no mobile app · no real Bitrix24 sync in v1 · no real customs formulas in v1 · no US/AE/EU scrapers in v1 · no English locale · no Sentry SaaS / Google Analytics / Hotjar · no foreign CDN/SMTP in front of forms · no fake counters or fake feed.

---

## Top 10 pitfalls (severity-ranked)

1. **Foreign-edge PII collection (Cloudflare/Vercel/Sentry/GA in front of forms)** → 1–18M ₽ Roskomnadzor fine, irreversible. *Phase 0/1.*
2. **Pre-checked or bundled consent checkbox** → 300–700K ₽ per-violation under Sep 2025 amendments; multiplies across the lead DB. *Phase 1/3 (consent UI + server-side reject).*
3. **Encar / Che168 / Autohome scraped from Russian DC IP** → instant ban + zero data; product breaks on the data side. Need KR/CN residential proxy budget from day one. *Phase 4.*
4. **USS Auctions scrape attempt behind partner login** → permanent partner ban + JP relationship destroyed. Use BeForward + licensed exporter API; document this constraint in scraper README. *Phase 4 kickoff decision.*
5. **Cyrillic boxes (`□□□`) in `@react-pdf/renderer`** because a font weight isn't registered → falls back to Helvetica → no Cyrillic for that element. CI fixture test mandatory. *Phase 3.*
6. **PDFs landing in mail.ru / yandex.ru spam** → conversion artifact never reaches client; team thinks lead is dead. Russian SMTP + DMARC + 2-week warm-up + ≤2MB PDF. *Phase 0 (DNS) + Phase 3.*
7. **Quiz double-submit race → duplicate leads/PDFs/Bitrix entries.** Idempotency key generated at quiz-*start* (not submit), `INSERT ... ON CONFLICT DO NOTHING RETURNING id`, queue dedupe by lead_id. *Phase 3 + future Bitrix phase.*
8. **Scraper memory leak (Puppeteer/Playwright) inside API process → OOM, deploys break.** Each scrape = fresh browser, `browser.close()`, separate worker process, systemd `MemoryMax=1G`. *Phase 4 architecture.*
9. **Stale FX in PDF → mispriced sale → 200–500K ₽ loss per deal or distrust.** Store source-currency price authoritatively, compute RUB on-the-fly from CBR daily XML, show rate date + range + disclaimer in PDF. *Phase 3 + Phase 4.*
10. **Stub landed-cost shown without disclaimer → quote dispute / breach claim under «Закон о рекламе».** Disclaimer on every PDF page with a price; show range not point; sales script reinforces "финальная — в договоре". *Phase 3.*

(Honourable mentions in PITFALLS that don't make top 10 but should not be forgotten: shared admin login, scraper ingest "0 cars / never marks sold", country-enum-as-switch, image hot-linking, mock data in prod, browse-tier leads polluting Bitrix, Cyrillic vs Latin model-name canonicalisation, Postgres collation defaults.)

---

## Stub-vs-build for v1

**Stubbed (designed for clean upgrade path):**

| Feature | v1 stub | Real version | Why deferred |
|---|---|---|---|
| Landed-cost | Fixed coefficient + admin override per car; range with disclaimer in PDF | Real customs/utilsbor formulas (engine cc × age × фл/юл) | Weeks of regulatory research; sales rep closes gap manually |
| Bitrix24 sync | Lead in own Postgres only; sales rep reads admin / email | Worker job on lead state change, `external_refs` JSONB ready | New integration risk shouldn't block launch |
| Live metrics (liveCount, totalDelivered, satisfactionPct, feed) | Admin-edited, founders update weekly from real data | Computed from Bitrix or internal CRM | Decouples from Bitrix sync |
| US/AE/EU scrapers | "Под индивидуальный заказ" cards, country in quiz, matching falls back to admin-curated cars only | One scraper per source per market | 4–6 week budget can't absorb 3 more scrapers |
| Customer portal / order tracker | Doesn't exist | n/a — anti-feature | Sales rep keeps the touchpoint by design |
| Image CDN | Direct serve from Yandex Object Storage | CloudCDN / Selectel CDN in front | Bandwidth small at launch |
| Admin moderation queue (scraped cars) | `needs_review` field exists, no required-review-before-public | Workflow: scraped → review → approve | Trust-but-verify for sales-driven team |
| PDF preview in admin | Sales rep opens S3 link | In-admin iframe | Nice-to-have |

**Deferred to post-launch (not stubbed, just not present):**
EN locale · per-car pages · checkout · mobile app · real customs formulas · scrapers for US/AE/EU · video reviews · blog / Yandex Дзен · AI-adaptive quiz · A/B test infra · Telegram subscription bot · dynamic Direct landing pages · geo-IP city detection · admin moderation queue.

**Not stubbed, must be real on day one:**
PDF generation (real Cyrillic, real attachments) · email delivery (real DNS, real warm-up) · admin auth + RBAC + audit log · 152-FZ consent UI + Roskomnadzor notification · ИНН/ОГРН in footer · Encar scraper (one source end-to-end) · drom.ru/catalog scraper (master models) · Yandex Metrika with goals · mobile responsiveness · Yandex Browser compatibility · idempotency on lead submit · soft-delete on cars by `last_seen_at`.

---

## Cross-cutting tensions / disagreements

**1. BullMQ vs pg-boss for the queue.**
STACK picked **BullMQ + managed Redis** (production-proven, dashboards, scales). ARCHITECTURE picked **pg-boss** (one fewer service, ship faster, fine at projected volumes). Both correct. **Resolution:** pg-boss for v1, BullMQ as v1.x upgrade path; design `Queue` interface so the swap is mechanical. Lock in roadmap.

**2. Scraper toolchain vs USS reality.**
STACK lists "USS + BeForward (JP)" with Crawlee + authenticated PlaywrightCrawler + persistent session storage as the first approach, fallback "manual upload of CSV exports if scraping breaks." PITFALLS is much more emphatic: **USS scraping is a partner-relationship hazard** — the login belongs to a partner, USS Co. (TYO:4732) has lawyers, ToS forbids scraping the member portal, and a ban destroys years-old relationships. **Resolution:** PROJECT requirement should be amended — JP source for v1 = **BeForward only**; USS data via licensed exporter feed (japanesecartrade / providecars / partner CSV). Surface this to the orchestrator as a **PROJECT.md correction**, not a roadmap item.

**3. Bot-evasion budget vs "ship in 4–6 weeks."**
STACK acknowledges Cloudflare-protected Encar/Che168 may need residential proxies or commercial bypass services, with PITFALLS pricing them at $50–200/mo per region. ARCHITECTURE flags "Outbound proxy through a non-Russian datacenter" as "the single biggest hidden cost of scraper architecture." FEATURES doesn't price this. **Resolution:** roadmapper must include an **explicit "scraper proxy budget" line item** in the P4 phase plan. If Encar burns >3 days, switch to **Carapis paid API** (STACK already names it as the documented commercial fallback).

**4. Frontend stack lock vs auto-suggested Next.js.**
STACK explicitly rejects Next.js full-stack migration ("Vercel-plugin auto-suggestion in this environment is a tooling artifact, not a project signal"). ARCHITECTURE concurs (preserves Vite SPA, only swaps `CrmProvider` backing). PROJECT lists "полная миграция на Next.js" as a *candidate* for evaluation. **Resolution:** roadmap should treat Next.js migration as a **closed decision (rejected)**, not an open one. Reason: re-platforming costs 1–1.5 weeks of the 4–6 week budget for zero functional gain; Vercel is hard-blocked by 152-FZ regardless.

**5. Live feed: differentiator vs liability.**
FEATURES leans into the live feed-ticker and 4 hero stats as a wedge. PITFALLS warns that admin-managed seed values left in prod ("47 в работе" stuck for 6 hours) become a credibility hit, and that fake feeds are illegal under «закон о рекламе» if they misrepresent. **Resolution:** keep the feed (it's a real differentiator) **but** require a daily admin-edit rhythm (5–7 events/day), audit log on liveCount changes, server-relative timestamp computation (no client `setInterval` since first load), and a server-side validation rule (`liveCount` > 0 and < 9999).

**6. "5-question quiz keeps friction low" vs "browse-tier leads burn rep time."**
FEATURES is firm on 5 questions (Interact 2026: completion drops sharply past 7). PITFALLS warns that 5 questions catch tire-kickers and exhaust sales reps. **Resolution:** keep 5 questions, but the **timing question** (already in scaffold: «когда планируете покупку») becomes the routing key — hot/warm (≤3 mo) → sales-rep alert; cold/browse → still get the PDF (brand value), but go to a separate Bitrix funnel «Долгий цикл» when sync ships. No new quiz question needed.

**7. "Multi-market brand" copy vs "USA/UAE/Europe scrapers not in v1."**
PROJECT, FEATURES, and ARCHITECTURE all agree on the resolution: declare 6 markets in UI, scrape 3, label US/AE/EU as "под индивидуальный заказ" → CTA opens quiz with country pre-filled. **No tension** — listed here as confirmation.

**8. Auth provider.**
STACK locks Better-Auth (Lucia deprecated). ARCHITECTURE sketches a custom `users` + `sessions` table without naming the library but with the same shape (sessions in Postgres, Argon2id, cookie sessions over JWT). **Compatible** — Better-Auth's PG adapter produces exactly this shape via Drizzle. No disagreement, just different abstraction levels.

---

## Roadmap implications

**Suggested phase count: 7 + pre-launch.** ARCHITECTURE's P0–P7 reconciled with STACK + PITFALLS:

### Phase 0 — Compliance & Infra Foundation (week 1, partly parallel)
**Rationale:** 152-FZ blocks every later step; Roskomnadzor has a 5-day window; email warm-up needs 2 weeks of lead time. This is the only phase where calendar time runs *behind* code time.
**Delivers:** Yandex Cloud project + managed PG 16 + managed Redis + Object Storage bucket + Compute VM(s); GitLab repo + self-hosted runner; Roskomnadzor notification filed; sender-domain DNS (SPF/DKIM/DMARC) configured; Unisender Go account + first warm-up sends to founder mailboxes; DB initialised with `ru_RU.UTF-8` collation.
**Avoids pitfalls:** 1 (foreign edge), 6 (spam folders), 21 (collation).
**Research-spike needed:** Yandex Cloud cost re-confirmation post-2026-05-01 pricing change.

### Phase 1 — Schema + API Skeleton + Country Registry
**Rationale:** Schema unlocks both API and PDF template work in parallel. Country registry must precede UI rewrite to avoid hardcoded enums (Pitfall 13).
**Delivers:** Drizzle schemas (`cars`, `models`, `leads`, `users`, `sessions`, `audit_log`, CMS tables); migrations applied to staging + prod DB; Hono server with public read endpoints; Country = single-source registry with `scraperReady` flag; shared types package between SPA and server.
**Uses:** Hono, Drizzle, Better-Auth schema (tables only, flow in P5), Zod for validation.
**Avoids pitfalls:** 13 (country enum), 20 (Cyrillic/Latin canonicalisation in models table design).

### Phase 2 — Frontend ↔ API + Consent UI + Legal Pages
**Rationale:** `CrmProvider` rewrite is the integration point for everything downstream; consent UI must ship with the first form interaction to avoid Pitfall 2.
**Delivers:** `src/api/` typed fetch client + react-query; `CrmProvider` rewritten preserving `useCrm()` surface (admin pages don't change); `/legal/personal-data-policy`, `/legal/offer` pages; 152-FZ consent checkbox on quiz + callback (default unchecked, server-side reject without flag, consent event logged with timestamp+IP+text-version); footer with ИНН/ОГРН.
**Avoids pitfalls:** 2 (consent), 11 (mock data — seed.ts moves to dev-only fallback).

### Phase 3 — Lead Flow End-to-End (the money phase)
**Rationale:** This is the product. Until quiz → PDF → email closes for one test user, nothing else matters.
**Delivers:** `POST /api/public/leads` with idempotency key from quiz-start; lead persistence with `consent_at` + `ip_address`; pg-boss queue with `pdf.generate` + `email.send` job classes; `@react-pdf/renderer` template with all weights/styles registered, self-hosted TTF (Inter or PT Sans + JetBrains Mono accent), CI Cyrillic fixture test; Yandex Object Storage upload + signed URL; Unisender Go send with attachment + sales-channel BCC; landed-cost stub with disclaimer on every PDF page; lead state machine (`new` → `pdf-sent`); quiz "5 minutes" UX message aligned with async flow.
**Uses:** `@react-pdf/renderer`, Unisender Go, S3 SDK pointed at Yandex endpoint, BullMQ-or-pg-boss.
**Avoids pitfalls:** 5 (Cyrillic boxes), 6 (spam — needs Phase 0 DNS done), 7 (idempotency), 17 (stub disclaimer).
**Research-spike needed:** Cyrillic font choice + license verification; Unisender Go inbox-placement test results.

### Phase 4 — One Working Scraper + Master Models
**Rationale:** Encar + drom.ru/catalog cover both scraper categories (inventory + master models). The plumbing built here (`shared/normalize`, `shared/images`, `shared/http`, proxy config, soft-delete via `last_seen_at`) is reused for sources 2–5.
**Delivers:** Encar scraper via Crawlee + KR residential proxy; image rehosting to YOS; UPSERT pattern with `(source, source_id)` UNIQUE; soft-delete via `last_seen_at`; per-source `last_success_at` metric in admin; CBR daily FX rate fetch + RUB-est computed on read (not at scrape time); drom.ru/catalog scraper populating `models` table weekly; brand/model canonicalisation table (Cyrillic ↔ Latin); BeForward scraper as second source (publicly listed, milder anti-bot).
**Uses:** Crawlee, Playwright (Firefox engine where Chromium is detected), KR proxy provider, Yandex Object Storage.
**Avoids pitfalls:** 3 (anti-bot per source), 4 (USS — explicitly excluded, BeForward fills JP slot), 8 (upsert + soft-delete), 9 (FX), 10 (image rehosting), 14 (separate worker process, fresh browser per run, `MemoryMax=1G`), 16 (per-source cron windows + migration locks), 20 (model name canonicalisation).
**Research-spike needed:** KR + CN residential proxy provider selection + budget; Encar fingerprint detection severity (may force Carapis API fallback within 3 days).

### Phase 5 — Admin Auth + Real LeadsAdmin
**Rationale:** Leads contain PII; admin can't ship without login. Audit log must be in place from first admin write to satisfy 152-FZ + Pitfall 15.
**Delivers:** Better-Auth with founder + sales-rep roles; sessions in Postgres (instant revocation); `audit_log` table writes on every admin mutation; LeadsAdmin wired to real DB; CarsAdmin can pin `is_admin_curated`; magic-link tested on @yandex.ru / @mail.ru / @rambler.ru / @gmail.com mailboxes; password backup login for both roles.
**Uses:** Better-Auth, Argon2id, cookie sessions (HttpOnly, SameSite=Lax).
**Avoids pitfalls:** 15 (shared login), 19 (magic-link to spam).

### Phase 6 — Content Polish + Mobile + Yandex Browser + Widget + Metrika
**Rationale:** Pure content + UX work that runs against the working backend. Most of this is parallelisable from Phase 2 onward but converges here for QA.
**Delivers:** Real founder bios + photos; 6+ real reviews (or section hidden); 12–24 realistic seed cars (or hidden until scraper produces enough); finalised FAQ (10–12 items, including US/AE/EU "coming soon", оплата, безопасность ПД); floating Telegram + WhatsApp + Callback widget; Yandex Metrika + 4 goals (open_quiz, complete_q5, submit_lead, pdf_downloaded); mobile audit across all sections; Yandex Browser desktop + mobile smoke-test; per-market hero copy; typed `badges` enum for cars; `liveCount`/`feed` daily edit rhythm + audit log + server-side validation.
**Avoids pitfalls:** 11 (mock data), 18 (Yandex Browser), 12 (browse-tier handling tagged for Bitrix phase).

### Phase 7 — Pre-Launch Checklist + Soft-Launch
**Rationale:** Verification gate. PITFALLS provides the explicit checklist.
**Delivers:** Run the "Looks Done But Isn't" checklist (21 items); founder + 1 external user end-to-end test; first 24h of real traffic monitored; founders trained on admin live-feed rhythm.

### Post-launch (out of v1 scope, but designed-for)
- Bitrix24 sync (worker job on lead state change, dedupe via `dvapro_lead_id` UF, retry idempotent)
- Scrapers 3–5 complete (Che168, Autohome with CN residential proxy)
- Real customs/utilization-fee formulas
- Browse-tier lead routing to «Долгий цикл» Bitrix funnel
- US/AE/EU scrapers
- EN locale (only if validated demand)

### Phase ordering rationale
- **Calendar time, not just code time:** P0 first because Roskomnadzor (5d) + email warm-up (~14d) run in background.
- **Compliance before features:** 152-FZ violations are irreversible; consent UI ships before any form is live.
- **Schema before frontend integration:** swapping `CrmProvider` to call mocked endpoints is wasted work.
- **Lead-flow before scraper fleet:** matcher can be tested against hand-INSERTed cars; scrapers can't be tested without something to match against.
- **One scraper before all scrapers:** shared plumbing (`normalize/images/http`, proxy abstraction, soft-delete logic) gets stress-tested against the hardest source (Encar) first.
- **Auth before LeadsAdmin:** PII gate.
- **Content + QA last but not least:** founder bios, mobile audit, Yandex Browser tests are non-blocking on backend but blocking on launch credibility.

### Research flags

**Phases needing `/gsd-research-phase` upfront during planning:**
- **Phase 0** — Yandex Cloud post-May-2026 pricing tier confirmation; Roskomnadzor notification step-by-step (which ИНН of which legal entity is the operator?).
- **Phase 3** — Cyrillic font selection (Inter vs PT Sans vs IBM Plex Sans for brand fit) + license check; Unisender Go transactional template format + warm-up calendar; idempotency-key UX in quiz (where exactly is it generated and stored).
- **Phase 4** — Per-source proxy provider selection + monthly budget (KR + CN residential pools); Encar fingerprint detection level (does naive Crawlee work, or is Carapis API needed); BeForward HTML parser shape; drom.ru/catalog robots/Crawl-delay + whether `baza.drom.ru/help/API` covers the catalog data needed (legal route preferred).
- **Phase 5** — Better-Auth Hono integration specifics; magic-link template inbox-placement test plan.

**Phases with standard patterns (no research-phase needed):**
- **Phase 1** — Drizzle schema is mechanical from the table sketches in ARCHITECTURE.
- **Phase 2** — `CrmProvider` rewrite is a known pattern; consent UI is standard form work; legal pages are content.
- **Phase 6** — Mobile audit, Metrika setup, content authoring are well-documented standard tasks.
- **Phase 7** — Checklist execution.

---

## Confidence assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Hono, Drizzle, Postgres, Better-Auth, `@react-pdf/renderer`, Yandex Cloud all verified against npm registry, official docs, and 2026 commentary. Lucia deprecation confirmed Mar 2025. |
| Features | MEDIUM-HIGH | Comp set is 8 live RU broker sites; conversion stats from Interact Quiz Report 2026 + Marquiz; Bitrix24 patterns from official docs. Source quality strong; only weakness is that DVApro's specific funnel is unique enough that benchmarks are extrapolated. |
| Architecture | HIGH on shape (modular monolith, pg-boss, source-attributed cars), MEDIUM on deployment topology (depends on hosting choice, now resolved to Yandex), MEDIUM on schema details (will iterate during phase implementation). |
| Pitfalls | MEDIUM-HIGH | 152-FZ regulatory specifics: HIGH (official sources, recent legal commentary, dated by Sep 2025 amendments). Scraper specifics: MEDIUM (target sites don't publish anti-bot details; based on second-hand reports). Bitrix24 quirks: HIGH (official docs). Email deliverability: HIGH (Yandex Postmaster, mxtoolbox tooling). |

**Overall:** MEDIUM-HIGH. Stack and architecture are solid enough to start building; per-source scraper economics and proxy budget are the largest known unknowns and will surface real cost in Phase 4. Cyrillic PDF and email deliverability have well-documented prevention recipes that must be followed *exactly* — they are HIGH-confidence-but-fragile.

### Gaps to address during planning

- **Roskomnadzor operator identity.** Which legal entity (DVApro ООО? founder ИП?) files the уведомление? Affects timing of P0 and the ИНН/ОГРН shown in footer. Surface to founders before P0.
- **Proxy provider + budget for KR/CN scrapers.** Not a research gap — a budget gap. Roadmapper should add explicit line item.
- **USS data path.** PROJECT.md still lists USS as a v1 scraper source. Research strongly recommends BeForward + licensed exporter. Surface as a PROJECT.md correction, not just a phase task.
- **Founder content.** Real bios, photos, video pitch — pure content work but blocking on launch credibility. Start in P0/P1 in parallel with code.
- **Sender domain reputation.** `dva.pro` warm-up takes ~2 weeks; if domain isn't yet owned/configured, P0 is at risk.
- **Bitrix24 instance access.** PROJECT says it exists; confirm credentials + custom-field schema exist before the post-launch Bitrix sync phase begins (not blocking v1).
- **Designer-grade PDF template.** `@react-pdf/renderer` requires a specific component-tree layout; needs design input from P1 onward, not last-minute in P3.

---

## Sources

Aggregated from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md. Categorised by primary topic; full per-document sources remain in the underlying research files.

### Primary (HIGH confidence — official docs, recent verified commentary)
- Hono npm 4.12, official Node adapter docs, Hono+Better-Auth example
- Drizzle ORM 0.45 releases + 2026 comparison vs Prisma
- PostgreSQL 16 vs 17 production-readiness analysis
- Yandex Cloud — Managed PG, Object Storage, Container Registry, Serverless Containers, GitLab Runner tutorial, security/compliance (152-FZ, FSTEC, UZ-1)
- `@react-pdf/renderer` 4.5 docs (Fonts page, GitHub issues #1366 #2862 #2675 #796 #2730 — Cyrillic + font-weight bugs)
- Better-Auth official site + PostgreSQL adapter docs
- Unisender Go API v1.85 + SMTP API docs
- Bitrix24 REST API + webhooks + duplicate-control + custom fields docs
- 152-ФЗ official text (КонсультантПлюс) + Roskomnadzor notification form (pd.rkn.gov.ru) + Sep 2025 amendments commentary (Comply, Garant, Profdelo)
- Yandex Postmaster + Mail.ru Postmaster (deliverability ground truth)
- BullMQ + pg-boss official docs
- Crawlee for JS docs + 2026 production comparison vs Scrapy
- Korean Supreme Court 2021Do1533 (scraping public data legal in KR — Lexology)
- CBR daily FX XML feed (`https://www.cbr.ru/scripts/XML_daily.asp`)

### Secondary (MEDIUM confidence — community + comparative analysis)
- 8 live Russian broker sites analysed for feature comp set (Trust Encar, Japan Transit, AVADGE, Kimura Cars, DSS Group, OTRADA, DIAUTO, carskorea.shop)
- Interact Quiz Conversion Rate Report 2026 + Marquiz stats
- ZenRows / Scrapeway 2026 anti-bot guidance (Cloudflare bypass landscape)
- Carapis Encar parser docs (paid commercial fallback)
- Puppeteer/Playwright memory-leak community write-ups (Devforth, Browserless, GitHub issues #5893 #4059)
- Russian customs/utilsbor 2024–2026 commentary (The Insider, AutoCango, Dantful)
- Yandex SEO market share data (Statcounter 2025, Demis)
- USS Auto Auction official site + Provide Cars partner-feed pattern docs

### Tertiary (LOW confidence — informational, needs validation in phase)
- Specific KR/CN residential proxy provider pricing — verify in P4 spike
- BeForward HTML stability — verify in P4
- Yandex Browser CSS quirk inventory — verify in P6 manual QA
- Bitrix24 webhook delivery semantics for at-least-once — verify in post-launch phase

---
*Research synthesis completed: 2026-04-26*
*Ready for roadmap: yes*
*Tensions surfaced for orchestrator: 8 (see "Cross-cutting tensions" section)*
*PROJECT.md corrections recommended: USS scraper → BeForward + licensed exporter feed; Next.js candidate → closed (rejected)*
