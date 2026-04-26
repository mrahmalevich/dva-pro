# Architecture Research

**Domain:** Russian vehicle-import marketplace (lead-funnel + scraper-fed inventory + brokered fulfilment)
**Researched:** 2026-04-26
**Confidence:** HIGH on component boundaries and data flows, MEDIUM on deployment topology (depends on hosting provider chosen in STACK), MEDIUM on schema details (will iterate during phase research)

---

## Summary

DVApro is **not** a traditional e-commerce site. It is a **lead-generation funnel** with three feeder systems hanging off a single Postgres + a single Node API:

1. A **public SPA** (already built) that funnels visitors into a quiz.
2. A **scraper fleet** that periodically refills inventory from foreign auction/listing sites.
3. An **admin panel** (already built, in-memory) that founders/sales reps use to curate everything the SPA shows and triage everything the quiz produces.

The architectural job for this milestone is to **swap the in-memory `CrmProvider` for a real API + DB**, **add the scraper pipeline behind it**, and **bolt on the quiz-to-PDF-to-email flow** — all without redesigning the frontend and all on Russian hosting (152-FZ).

The recommended shape is a **modular monolith**: one HTTP API process, one worker process (scrapers + PDF + email), one Postgres, one S3 bucket, one Redis (or pg-boss instead, if minimizing infra). Microservices are explicitly the wrong call at 4–6 weeks.

---

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (existing SPA)                          │
│   Vite/React/TS + react-router  •  /  (Site)   •   /admin/* (Admin)       │
│   ─────────────────────────────────────────────────────────────────────   │
│   Sections (Hero, Catalog, FAQ, Reviews, FeedStrip…)   QuizModal          │
│                          ↑                                                │
│                          │ replaces in-memory CrmProvider                 │
│                          ↓                                                │
│                  src/api/  (typed fetch client)                           │
└──────────────────────────────────────────────────────────────────────────┘
                                   │ HTTPS (REST/JSON)
       ┌───────────────────────────┼─────────────────────────────────┐
       ↓                           ↓                                 ↓
┌──────────────┐          ┌─────────────────┐               ┌───────────────┐
│  Public API  │          │   Admin API     │               │ Internal API  │
│  (no auth)   │          │ (cookie session)│               │ (HMAC / token)│
│  GET /cars   │          │  CRUD all       │               │ POST /scrape/ │
│  GET /faq    │          │  entities       │               │  webhook      │
│  POST /leads │          │  /leads triage  │               │ POST /pdf/gen │
│  GET /feed   │          │  /settings      │               │  (internal)   │
│  GET /metrics│          │                 │               │               │
└──────┬───────┘          └────────┬────────┘               └───────┬───────┘
       └──────────┬────────────────┴──────────────┬──────────────────┘
                  │  one API process (Hono/Fastify/FastAPI — STACK chooses)
                  │  middlewares: auth, rate-limit, request-id, audit
                  ▼
       ┌────────────────────────────────────────────────────────────┐
       │                      DOMAIN SERVICES                        │
       │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐    │
       │  │ Inventory│ │ Quiz/    │ │ Lead    │ │ Content      │    │
       │  │ Service  │ │ Matching │ │ Service │ │ Service      │    │
       │  │          │ │ Service  │ │         │ │ (FAQ/feed/…) │    │
       │  └────┬─────┘ └────┬─────┘ └────┬────┘ └──────┬───────┘    │
       │       │            │            │             │            │
       │       │       enqueues          │             │            │
       │       │      "PDF + email"      │             │            │
       │       │            ↓            │             │            │
       │  ┌────┴────────────┴────────────┴─────────────┴───────┐    │
       │  │           Repository layer (Drizzle/Prisma)        │    │
       │  └─────────────────────────┬──────────────────────────┘    │
       └────────────────────────────┼───────────────────────────────┘
                                    ↓
            ┌──────────────────────────────────────────┐
            │           Postgres (ru-central1)          │
            │  cars · models · leads · users · content  │
            │  jobs (pg-boss schema) · audit_log        │
            └──────────────────────────────────────────┘
                                    ↑
                                    │ same DB (single source of truth)
                                    │
       ┌────────────────────────────┴───────────────────────────────┐
       │                     WORKER PROCESS                         │
       │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
       │  │ Scraper jobs │  │ PDF render   │  │ Email send       │  │
       │  │ (cron-       │  │ (@react-pdf/ │  │ (SMTP via        │  │
       │  │  triggered)  │  │  renderer)   │  │  Russian relay)  │  │
       │  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
       │         │                 │                 │              │
       │         ▼                 ▼                 ▼              │
       │   Encar/USS/Che168    Yandex Object     Mailopost /        │
       │   /BeForward/Autohome /Storage           UniSender /        │
       │   /drom.ru/catalog   (PDFs, images)      Postmark-like     │
       └────────────────────────────────────────────────────────────┘
```

The dotted-line takeaway: **one DB, one bucket, one Redis-or-not, two long-running processes (api + worker)**. Everything else is a module inside one of those processes.

### Component Responsibilities

| Component | Owns | Implementation Sketch |
|-----------|------|------------------------|
| **Frontend SPA** | All visual rendering, quiz UX, admin forms, optimistic UI | Existing `src/` — replace `CrmProvider` localStorage layer with `src/api/` fetch client + react-query (or SWR) |
| **API process** | HTTP surface, auth, validation, orchestration of domain services | Single Node process; routes thin, services fat |
| **Inventory Service** | `cars` and `models` reads/writes; deduplication; "show this normalized listing" | Module inside API process; called by scraper workers via repository directly (not HTTP) |
| **Quiz/Matching Service** | Take answers → pick 6–8 cars from DB → enqueue PDF job → return synchronous "we'll email you" response | Module; matching is a SQL query in v1, not ML |
| **Lead Service** | Persist lead, attach generated PDF, expose status updates to admin, *future* Bitrix sync hook | Module; designed with `external_refs` JSON column from day 1 so Bitrix sync is additive |
| **Content Service** | FAQ / reviews / feed / timeline / settings — admin writes, public reads | Module; cached aggressively (CDN-friendly cache headers + ETags) |
| **Auth Service** | Sessions (cookie), users, roles (founder/sales-rep), password hashing | Module; *no* third-party identity provider in v1 (compliance + simplicity) |
| **Scraper Workers** | Per-source fetchers (Encar, USS, BeForward, Che168, Autohome, drom-catalog), each with normalize() + upsert() | Worker process; one job class per source; cron-triggered via pg-boss / BullMQ |
| **PDF Worker** | Render `@react-pdf/renderer` template to a Buffer, upload to S3, attach key to lead | Worker process; same Node binary as scrapers |
| **Email Worker** | Send branded email with PDF attachment + sales-channel notification | Worker process; SMTP through Russian transactional provider |
| **Object Storage** | PDF blobs + scraped car images (rehosted, not hot-linked) | Yandex Object Storage `ru-central1` bucket; S3 SDK |
| **Job Queue** | Schedule + retries for scraper/PDF/email | `pg-boss` (recommended for v1 — no Redis) **or** BullMQ + Redis (if STACK pre-picked Redis) |

---

## Recommended Project Structure

The frontend `src/` is **untouched** structurally — only `src/crm/CrmProvider.tsx` swaps from localStorage to API calls, and a new `src/api/` is added.

The new backend lives in a sibling top-level folder. Final shape:

```
dva.pro/
├── src/                          # FRONTEND — existing scaffold, near-zero structural change
│   ├── api/                      # NEW: typed fetch client, react-query hooks
│   │   ├── client.ts             # base fetch + auth cookie + error normalizer
│   │   ├── cars.ts               # useCars(), getCar(id) etc.
│   │   ├── leads.ts              # submitLead(payload)
│   │   ├── content.ts            # FAQ, reviews, settings, feed
│   │   └── admin.ts              # admin-only mutations
│   ├── crm/
│   │   ├── CrmProvider.tsx       # CHANGED: thin wrapper that hydrates from API
│   │   │                         #          (keeps same useCrm() surface so admin/* and sections/* don't change)
│   │   ├── types.ts              # CHANGED: extend Country to 6 markets, expand Car
│   │   └── seed.ts               # KEPT for storybook/dev fallback only
│   ├── admin/                    # UNCHANGED — same forms, now writing through API
│   ├── pages/                    # UNCHANGED
│   ├── sections/                 # UNCHANGED
│   ├── quiz/
│   │   ├── QuizModal.tsx         # CHANGED: addLead() now POSTs to /api/leads
│   │   └── quizSpec.ts           # UNCHANGED
│   └── …
│
├── server/                       # NEW: backend
│   ├── src/
│   │   ├── http/
│   │   │   ├── server.ts         # bootstrap (Hono/Fastify)
│   │   │   ├── routes/
│   │   │   │   ├── public.ts     # GET /cars, /faq, /reviews, /feed, /metrics, POST /leads
│   │   │   │   ├── admin.ts      # auth-gated CRUD
│   │   │   │   └── internal.ts   # HMAC-protected: /scrape/webhook, /pdf/render
│   │   │   └── middleware/
│   │   │       ├── auth.ts       # cookie session
│   │   │       ├── audit.ts      # log all admin writes
│   │   │       └── ratelimit.ts  # protect /leads
│   │   ├── domain/
│   │   │   ├── inventory/
│   │   │   │   ├── service.ts
│   │   │   │   ├── matcher.ts    # quiz-answers → SQL filter → top N cars
│   │   │   │   └── repo.ts
│   │   │   ├── leads/
│   │   │   ├── content/
│   │   │   ├── auth/
│   │   │   └── pdf/
│   │   │       ├── template.tsx  # @react-pdf/renderer document
│   │   │       └── render.ts     # renderToBuffer(template, props)
│   │   ├── workers/
│   │   │   ├── index.ts          # worker entrypoint, registers all jobs
│   │   │   ├── scrapers/
│   │   │   │   ├── encar.ts      # one file per source
│   │   │   │   ├── uss.ts
│   │   │   │   ├── beforward.ts
│   │   │   │   ├── che168.ts
│   │   │   │   ├── autohome.ts
│   │   │   │   ├── dromCatalog.ts
│   │   │   │   └── shared/
│   │   │   │       ├── normalize.ts   # raw → Car shape
│   │   │   │       ├── images.ts      # rehost foreign images to our bucket
│   │   │   │       └── http.ts        # fetch-with-retry, proxy support
│   │   │   ├── pdfJob.ts
│   │   │   └── emailJob.ts
│   │   ├── infra/
│   │   │   ├── db.ts             # Postgres pool + Drizzle/Prisma
│   │   │   ├── queue.ts          # pg-boss client (or BullMQ)
│   │   │   ├── s3.ts             # Yandex Object Storage client
│   │   │   ├── mail.ts           # SMTP transport
│   │   │   └── env.ts            # zod-validated env
│   │   └── shared/
│   │       ├── types.ts          # Car, Lead, etc — *single source of truth*, frontend imports via path alias
│   │       └── errors.ts
│   ├── migrations/               # SQL files (Drizzle Kit / Prisma migrate)
│   ├── tests/
│   └── package.json
│
├── packages/                     # OPTIONAL but recommended
│   └── shared/                   # shared types between frontend & backend
│       └── types.ts              # the contract
│
└── .planning/                    # GSD lifecycle docs
```

### Structure Rationale

- **`src/` untouched structurally** — the existing visual mock is brand-equity; touch only what must change. The `useCrm()` hook surface is preserved so admin forms keep working.
- **`server/` is one process tree, two entrypoints** (`http/server.ts` and `workers/index.ts`). Same code, same DB, different command. Avoids premature microservices.
- **`domain/` not `controllers/`** — services own logic; routes are 5–10 lines of "validate, call service, return". Makes Bitrix sync, alternative frontends, or CLI tools trivial later.
- **`workers/scrapers/` is one file per source** — sources fail differently and evolve at different cadences; isolating them keeps blast radius small when Encar changes its HTML on Tuesday.
- **`packages/shared/types.ts`** — single canonical type definitions imported by both halves. Prevents the "Car has 8 fields on the server but 7 on the client" class of bug. If full monorepo tooling feels heavy, a path-alias import (`@dvapro/shared`) suffices.
- **Migrations are SQL files in repo** — predictable, reviewable, replayable. No ORM auto-migration in production.

---

## Architectural Patterns

### Pattern 1: Modular Monolith with Worker Sidecar

**What:** Two processes — `api` (HTTP) and `worker` (queue consumer + cron) — sharing one codebase, one database, one Redis (or pg-boss). Domain logic lives in plain modules importable from either.

**When to use:** You have <10 engineers and <100k req/day, but you do have background work (scrapers, PDFs, emails) that can't block HTTP requests.

**Trade-offs:** Cheap to operate, easy to reason about, fast to deploy. Loses the option to scale the PDF renderer independently of the API — but at 4–6 weeks to launch, that option isn't worth paying for.

**Example:**
```typescript
// server/src/domain/leads/service.ts — used by both processes
export async function createLead(input: NewLead, deps: { db: DB; queue: Queue }) {
  const lead = await deps.db.insert(leads).values({ ...input, status: 'new' }).returning();
  await deps.queue.send('pdf.generate', { leadId: lead.id });
  return lead;
}

// server/src/http/routes/public.ts — HTTP entrypoint
app.post('/leads', async (c) => {
  const input = leadSchema.parse(await c.req.json());
  const lead = await createLead(input, { db, queue });
  return c.json({ id: lead.id });
});

// server/src/workers/index.ts — worker entrypoint
queue.work('pdf.generate', async ({ data }) => {
  await renderAndEmailPdf(data.leadId, { db, s3, mail });
});
```

### Pattern 2: Stable Public Read API + Auth-Gated Admin API + Internal-Only API

**What:** Three distinct "contracts" served by the same process, each with different security posture:

- **Public** (`/api/public/*`) — no auth, aggressive caching, rate-limited per IP. Read-only except `POST /leads`.
- **Admin** (`/api/admin/*`) — cookie session, role-checked, audited, no caching.
- **Internal** (`/api/internal/*`) — HMAC or shared-secret token, network-restricted if possible. Used by workers calling back, or for cron triggers.

**When to use:** Always, when one app serves both anonymous public traffic and authenticated dashboards. Lets you reason about CSRF, caching, rate limits, and audit logging at the route-prefix level.

**Trade-offs:** Slightly more boilerplate per route. Hugely simpler security review.

### Pattern 3: Source-Attributed Inventory with Soft-Deletes

**What:** Every `cars` row carries `(source, source_id, source_url, last_seen_at)`. Scrapers UPSERT by `(source, source_id)`. Cars not seen for N hours get `is_active=false` rather than deleted. Admin can override `is_active` and `is_admin_curated` to pin manual entries.

**When to use:** Whenever data comes from sources you don't control. Lets you (a) trace any UI car back to its origin, (b) recover from a bad scrape run, (c) mix scraped and admin-entered cars.

**Trade-offs:** Schema is slightly heavier; needs a "stale cars" cleanup job. Worth it.

### Pattern 4: Job Queue as the Async Boundary

**What:** Anything slow, flaky, or external goes through the queue. HTTP handlers do `INSERT + ENQUEUE` and return in <100 ms. Workers retry with exponential backoff.

**Critical for:**
- PDF rendering (200ms–2s) — never inline in `POST /leads`
- Email sending (network flakiness)
- Scraper runs (minutes-long)
- Image rehosting (download foreign image, upload to bucket)

**Implementation choice:** **`pg-boss` for v1** (recommended) — uses the Postgres you already have, no Redis to provision, no extra failure mode. Ship faster. Switch to BullMQ + Redis later if scraper throughput demands it (very unlikely at <500 leads/day).

### Pattern 5: Frontend Hook Surface Preservation

**What:** Keep `useCrm()` API identical when swapping localStorage → real API. Existing admin components (`CarsAdmin`, `LeadsAdmin`, etc.) and section components don't change.

**Implementation:**
```typescript
// src/crm/CrmProvider.tsx — new shape, same surface
export function CrmProvider({ children }) {
  const queryClient = useQueryClient();
  const carsQ = useQuery({ queryKey: ['cars'], queryFn: api.cars.list });
  const upsertCarM = useMutation({
    mutationFn: api.cars.upsert,
    onSuccess: () => queryClient.invalidateQueries(['cars']),
  });
  // …
  const value: CrmContextValue = {
    state: { cars: carsQ.data ?? [], /* … */ },
    upsertCar: upsertCarM.mutate,
    // … same shape as today
  };
  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}
```
Keeps the admin migration from "rewrite 7 admin pages" to "rewrite one provider".

---

## Data Flow

### Flow 1: Quiz → PDF → Email → Lead (the money flow)

```
[Visitor completes 5 quiz questions + contact info]
        │
        ▼
[QuizModal] -- POST /api/public/leads -->  [API: leads route]
        │                                          │
        │  HTTP 200 { id, status: "queued" }       │
        ▼                                          │
[QuizModal SuccessStep — "5 minutes" countdown]    │
                                                   ▼
                                   [LeadService.create]
                                          │
                              ┌───────────┴────────────┐
                              ▼                        ▼
                    [INSERT leads row]          [enqueue pdf.generate]
                    status='new'                            │
                                                            ▼
                                              ┌─────────────────────────┐
                                              │ Worker: pdf.generate    │
                                              │ 1. read lead            │
                                              │ 2. MatchingService.pick │
                                              │    → 6–8 cars from DB   │
                                              │    matching budget,     │
                                              │    body, condition,     │
                                              │    timing               │
                                              │ 3. render PDF Buffer    │
                                              │ 4. PUT to S3            │
                                              │ 5. UPDATE lead.pdf_key  │
                                              │ 6. enqueue email.send   │
                                              └────────────┬────────────┘
                                                           ▼
                                              ┌─────────────────────────┐
                                              │ Worker: email.send      │
                                              │ 1. send to client w/PDF │
                                              │ 2. send sales-channel   │
                                              │    notification (TG/    │
                                              │    email/webhook)       │
                                              │ 3. UPDATE lead.status=  │
                                              │    'pdf-sent'           │
                                              └─────────────────────────┘

                            (FUTURE PHASE — Bitrix24 sync)
                                                           │
                                              ┌────────────▼────────────┐
                                              │ Worker: bitrix.sync     │
                                              │ on lead state change    │
                                              │ → POST to Bitrix REST   │
                                              │ → store bitrix_deal_id  │
                                              │   in lead.external_refs │
                                              └─────────────────────────┘
```

**Why async:** PDF render (200ms–2s) + SMTP send (1–10s) cannot block the HTTP response — that would push p95 latency over the cliff and cause user-visible failures on flaky email. The "5 minutes" UX message in the success step is honest and aligned with this model.

**Why DB matching, not ML:** v1 has at most ~hundreds of cars. A SQL query (`WHERE budget BETWEEN $min AND $max AND body = ANY($bodies) ORDER BY relevance_score`) is sufficient and explainable. Saves weeks.

### Flow 2: Scraper → Normalized DB

```
[Cron trigger: every 6h for Encar, daily for drom-catalog, etc.]
        │
        ▼
[Worker: scraper.encar]
        │
        ├── 1. Fetch listing pages (with retry, proxy if needed)
        ├── 2. Parse → raw records
        ├── 3. normalize() → Car-shaped objects (price → RUB est., enum mapping)
        ├── 4. For each: download primary image → upload to our bucket
        └── 5. UPSERT into cars (source='encar', source_id=...)
                │  set last_seen_at=now()
                ▼
        [INSERT or UPDATE on cars]
                │
                ▼
        [Mark stale: UPDATE cars SET is_active=false
                    WHERE source='encar' AND last_seen_at < now() - 24h]

[Optional admin moderation queue]
        │
        ▼
[Admin sees newly-scraped cars in /admin/cars with "needs review" filter]
        │
        ▼
[Admin can: hide, edit, promote (is_admin_curated=true)]
```

**Two scraper categories:**
- **Inventory scrapers** (Encar, USS, BeForward, Che168, Autohome) → write `cars`
- **Catalog scraper** (drom.ru/catalog) → writes `models` (slower cadence, weekly is fine)

**Critical separation:** `cars` (specific listings, ephemeral) vs `models` (canonical model facts, durable). A `Car` row references a `Model` row via `(brand, model_slug, year)` — so the SPA can show "BMW X5 2023 — 4.4 L V8" even if no specific listing exists right now.

### Flow 3: Admin Edit → Public Read

```
[Founder or Sales Rep logs into /admin]
        │
        ▼
[Admin form (e.g. SettingsAdmin updates liveCount)]
        │
        ▼  PUT /api/admin/settings
[Auth middleware: verify cookie session, check role]
        │
        ▼
[ContentService.updateSettings(patch)]
        │  audit_log INSERT (who, what, when, before, after)
        ▼
[UPDATE settings row]
        │
        ▼
[react-query invalidates ['settings'] in admin tab]

[Independently — public traffic]
        │
        ▼  GET /api/public/settings (or /metrics)
[Cached response with ETag / Cache-Control: max-age=60, stale-while-revalidate=300]
        │
        ▼
[FeedStrip / Hero / etc render fresh values within ~1 minute]
```

**Why short cache, not realtime:** Real-time updates (WebSocket) cost complexity for marginal gain on a marketing site. 60-second eventual consistency is invisible to users and lets the public API absorb traffic spikes without DB load.

**Audit log is non-negotiable:** With multiple sales reps writing, "who changed the founder bio yesterday" must be answerable.

---

## Database Schema Sketches

Showing the **top 3 most important** tables in detail; the rest are sketched in the appendix.

### Table: `cars` (the heart of the inventory)

```sql
CREATE TABLE cars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity & provenance
  source          TEXT NOT NULL,              -- 'encar' | 'uss' | 'beforward' | 'che168' | 'autohome' | 'admin'
  source_id       TEXT NOT NULL,              -- ID at the source ('admin' uses generated UUID)
  source_url      TEXT,
  UNIQUE (source, source_id),

  -- Canonical model linkage (FK to models if known, else free-text fallback)
  model_id        UUID REFERENCES models(id) ON DELETE SET NULL,
  brand           TEXT NOT NULL,              -- always populated even if model_id is null
  model           TEXT NOT NULL,
  year            INT  NOT NULL,

  -- Origin market — drives flag UI, eligibility messaging
  country         TEXT NOT NULL,              -- 'jp'|'kr'|'cn'|'us'|'ae'|'eu' (extended from current 3)

  -- Spec fields (matching what frontend Car interface expects, made strict)
  body            TEXT NOT NULL,              -- 'sedan'|'suv'|'coupe'|'minivan'|'pickup'|'wagon'
  drive           TEXT,                       -- 'awd'|'fwd'|'rwd'|'4wd'
  fuel            TEXT,                       -- 'gas'|'diesel'|'hybrid'|'ev'
  transmission    TEXT,                       -- 'auto'|'manual'|'cvt'|'dct'
  mileage_km      INT,                        -- nullable for new cars

  -- Pricing (normalized to integers in source currency + RUB estimate)
  price_local     BIGINT,                     -- in source currency minor units
  price_local_ccy TEXT,                       -- 'KRW'|'JPY'|'CNY'|'USD'|'AED'|'EUR'
  price_rub_est   BIGINT,                     -- rough conversion + landed-cost stub
  price_display   TEXT,                       -- pre-rendered display string (e.g. "от 4.2 млн ₽")

  -- Logistics
  eta_days        INT,                        -- estimated delivery
  spec_summary    TEXT,                       -- short one-liner like "AWD · 2.0T · 360 hp"

  -- Visuals & promotion
  image_key       TEXT,                       -- S3 key after rehosting; not source URL
  badges          JSONB DEFAULT '[]'::jsonb,  -- array of strings
  accent          TEXT DEFAULT 'coral',       -- 'coral'|'cyan' (from existing UI)

  -- Lifecycle
  is_active       BOOLEAN NOT NULL DEFAULT true,    -- false when scraper hasn't seen it lately
  is_admin_curated BOOLEAN NOT NULL DEFAULT false,  -- pinned by admin; protected from auto-deactivation
  needs_review    BOOLEAN NOT NULL DEFAULT false,   -- new scrape, not yet approved

  -- Timestamps
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for the matching query
CREATE INDEX cars_active_country_body_idx ON cars (country, body) WHERE is_active = true;
CREATE INDEX cars_active_price_idx       ON cars (price_rub_est) WHERE is_active = true;
CREATE INDEX cars_model_idx              ON cars (model_id);
```

**Why this shape:** Every constraint here pays back later. `(source, source_id)` UNIQUE is what makes scraper UPSERT safe. `is_active` + `last_seen_at` is what makes "scraper failed today, don't nuke the catalog" possible. `price_display` is a pre-rendered string so the frontend doesn't have to reimplement the formatting. Strict enums on `body`/`country` align with the quiz options.

### Table: `leads`

```sql
CREATE TABLE leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  telegram        TEXT,

  -- Quiz answers (typed columns for the answers we know exist;
  --              answers_raw JSONB for forward compatibility as quiz evolves)
  budget_min_rub  BIGINT NOT NULL,
  budget_max_rub  BIGINT NOT NULL,
  body_types      TEXT[] NOT NULL,            -- ['sedan','suv',...]
  condition       TEXT,                       -- 'new'|'lo'|'mid'|'any'
  use_case        TEXT,                       -- 'city'|'family'|'status'|'offroad'|'sport'
  timing          TEXT,                       -- 'now'|'1m'|'3m'|'browse'
  answers_raw     JSONB NOT NULL DEFAULT '{}'::jsonb,  -- full original payload

  -- Generated artifacts
  pdf_key         TEXT,                       -- S3 key when ready
  matched_car_ids UUID[],                     -- snapshot of which cars made it into the PDF

  -- Workflow status (matches existing frontend Lead.status)
  status          TEXT NOT NULL DEFAULT 'new', -- 'new'|'in-progress'|'pdf-sent'|'closed'
  assigned_to     UUID REFERENCES users(id) ON DELETE SET NULL,

  -- External integrations (designed for additive Bitrix sync later)
  external_refs   JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {bitrix_deal_id: "...", ...}

  -- Compliance & audit
  ip_address      INET,                       -- for fraud / rate-limit forensics
  user_agent      TEXT,
  consent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 152-FZ consent timestamp

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX leads_status_idx     ON leads (status, created_at DESC);
CREATE INDEX leads_assigned_idx   ON leads (assigned_to) WHERE assigned_to IS NOT NULL;
```

**Why this shape:**
- `external_refs` JSONB present from day 1 → adding Bitrix deal IDs, MyTracker IDs, AmoCRM IDs later is a no-op migration.
- `answers_raw` JSONB alongside typed columns → quiz can grow new questions without a schema change for every iteration.
- `consent_at` and `ip_address` directly support 152-FZ audit obligations.
- `matched_car_ids[]` snapshots which cars went into the PDF, so a sales rep weeks later can answer "what did the client see?"

### Table: `models` (master DB from drom.ru/catalog)

```sql
CREATE TABLE models (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Canonical identity
  brand           TEXT NOT NULL,              -- 'BMW'
  brand_slug      TEXT NOT NULL,              -- 'bmw'
  model           TEXT NOT NULL,              -- 'X5'
  model_slug      TEXT NOT NULL,              -- 'x5'
  generation      TEXT,                       -- 'G05', '2018-present'
  year_from       INT,
  year_to         INT,                        -- nullable = current generation
  UNIQUE (brand_slug, model_slug, generation),

  -- Spec ranges (from drom catalog)
  body_types      TEXT[] NOT NULL DEFAULT '{}',
  engine_options  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{cc: 2998, hp: 333, fuel: 'gas'}, ...]
  drive_options   TEXT[] DEFAULT '{}',
  description_ru  TEXT,                       -- Cyrillic editorial blurb from drom
  price_min_rub   BIGINT,                     -- range across all generations seen
  price_max_rub   BIGINT,

  -- Provenance
  source          TEXT NOT NULL DEFAULT 'drom-catalog',
  source_url      TEXT,
  scraped_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Admin overrides (rare but supported)
  is_curated      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX models_brand_idx ON models (brand_slug);
CREATE INDEX models_search_idx ON models USING gin (to_tsvector('russian', brand || ' ' || model || ' ' || COALESCE(description_ru, '')));
```

**Why a separate models table:** Decouples "showing what a BMW X5 is" from "having a specific BMW X5 listing". This is the architectural answer to the brief's call-out — `cars.model_id` is nullable; the SPA falls back to free-text `cars.brand`/`cars.model` when no master model row exists.

### Other tables (sketches, brief)

```sql
-- Users & roles for admin
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,                -- argon2id
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL,                -- 'founder' | 'sales-rep'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,             -- store hash, not token
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address    INET,
  user_agent    TEXT
);

-- Admin-managed content (collapse all into one of two patterns)
CREATE TABLE faq_items     (id UUID PK, sort INT, q TEXT, a TEXT, updated_at TIMESTAMPTZ);
CREATE TABLE reviews       (id UUID PK, name TEXT, city TEXT, car TEXT, text TEXT, rating INT, sort INT);
CREATE TABLE feed_items    (id UUID PK, time TEXT, text TEXT, icon TEXT, sort INT, created_at TIMESTAMPTZ);
CREATE TABLE timeline_steps(id UUID PK, code TEXT, title TEXT, sub TEXT, dur TEXT, sort INT);

-- Site settings — single-row table is fine
CREATE TABLE settings (
  id            INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data          JSONB NOT NULL,               -- entire SiteSettings shape
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES users(id)
);

-- Audit log (mandatory)
CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  actor_id      UUID REFERENCES users(id),
  action        TEXT NOT NULL,                -- 'lead.update' | 'car.upsert' | ...
  target_type   TEXT NOT NULL,
  target_id     TEXT,
  before        JSONB,
  after         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Storage Layout

### Postgres (single instance, ru-central1)

- One database per environment (`dvapro_prod`, `dvapro_staging`).
- All tables above + the `pg-boss` schema (auto-created in its own schema namespace).
- Daily logical backups to Yandex Object Storage (separate bucket).
- PITR (point-in-time recovery) via the managed DB provider's WAL archive — both Yandex Managed Postgres and Selectel Managed Postgres support this.

### Object Storage (Yandex / Selectel — S3-compatible)

```
s3://dvapro-prod/
├── pdfs/
│   └── leads/
│       └── 2026/04/26/
│           └── lead-{uuid}.pdf
├── images/
│   └── cars/
│       └── {source}/
│           └── {source_id}/
│               ├── primary.webp
│               └── 02.webp
└── exports/                    # admin CSV exports etc.
```

- PDFs: **private** by default; served via signed URLs from the API or proxied through the API.
- Images: **public-read** (it's car photos), CDN-fronted if budget allows. Always rehosted — never hot-link Encar/USS image URLs (they expire, geo-block, or change).

### Why not store PDFs in Postgres
PDFs are 50–500 KB binaries that scale linearly with leads. Bloating Postgres rows hurts backup, replication, and cache efficiency. Object storage is the right home.

---

## Module Boundaries Inside the Existing `src/` Tree

The existing scaffold is preserved. Here is exactly **what changes** and **what doesn't**:

| File / folder | Today | After this milestone | Why |
|---|---|---|---|
| `src/main.tsx` | Wraps in `<CrmProvider>` | Wraps in `<QueryClientProvider><CrmProvider>` | react-query for data fetching |
| `src/crm/CrmProvider.tsx` | localStorage source of truth | Thin wrapper: `useCrm()` returns react-query results, mutations call `src/api/*` | **Same surface, new backing** — admin pages don't change |
| `src/crm/types.ts` | `Country = 'jp'\|'cn'\|'kr'` | Extended to all 6 markets; tightened `Car` field types to match server | Single canonical types via `packages/shared` |
| `src/crm/seed.ts` | Used as initial state | Used only for Storybook / first-run dev fallback | Not removed (still useful for offline UI dev) |
| `src/quiz/QuizModal.tsx` | `addLead()` writes to local state | `addLead()` calls `api.leads.submit()`, awaits HTTP 200, then shows success step | Real lead submission |
| `src/admin/*Admin.tsx` | Forms call `useCrm()` mutations | **Unchanged** — still call `useCrm()`, which now persists via API | The whole point of preserving the surface |
| `src/api/` | doesn't exist | NEW: typed fetch client, react-query hooks | Single boundary between SPA and backend |
| `src/sections/*` | Reads from `useCrm().state` | **Unchanged** | Hook surface preserved |

This is the minimum-intrusion path. The frontend team merges `src/api/` and `src/crm/CrmProvider.tsx` rewrite as a single PR; everything else continues working.

---

## Deployment Topology (Russian Hosting)

### Recommended Topology (single-region, ru-central1)

```
         ┌────────────────────────────────────────────────────┐
         │           User browser (anywhere)                   │
         └─────────────────────┬──────────────────────────────┘
                               │
                               ▼  HTTPS, Russian DNS
         ┌────────────────────────────────────────────────────┐
         │  Yandex Cloud Application Load Balancer (or Nginx)  │
         │  - TLS termination (Let's Encrypt or YC Certificate)│
         │  - HTTP/2, gzip/brotli                              │
         └─────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
    ┌──────────────┐   ┌──────────────┐    [static SPA]
    │ API container│   │ API container│    served from same
    │  (replica 1) │   │  (replica 2) │    container OR from
    │              │   │              │    Yandex Object
    │  Hono/Fastify│   │  same image  │    Storage as static site
    │  on Node 20  │   │              │
    └──────┬───────┘   └──────┬───────┘
           │                  │
           └────────┬─────────┘
                    ▼
         ┌────────────────────────┐         ┌──────────────────────┐
         │  Worker container x1   │         │ Yandex Managed       │
         │  (pg-boss consumer +   │ ──────→ │ Postgres             │
         │   cron triggers)       │         │ (HA pair + backups)  │
         └────────────┬───────────┘         └──────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │ Yandex Object Storage  │
         │ ru-central1            │
         │ (PDFs + car images)    │
         └────────────────────────┘
```

### Compute Options (in order of preference for v1)

1. **Yandex Cloud Serverless Containers** — pay-per-request, scales to zero, easy deploy. Good for API. Worker should be a long-running VM/Compute Cloud instance (because cron + queue consumer wants persistence).
2. **Yandex Compute Cloud VM (single $20/mo VM)** — both API and worker as systemd services or docker-compose. Simplest for MVP. Recommended if team has any sysadmin background.
3. **Selectel / Timeweb Cloud Apps** — alternative providers, similar shape; same architecture applies.

**For 4–6 week launch: option 2 (single VM)** is the right call. Promote to option 1 (managed containers) post-launch if warranted.

### Why single region is fine

DVApro's audience is Russian. Yandex Object Storage's `ru-central1` is the only relevant region. Multi-region adds complexity that does not buy meaningful availability for this user base.

### Outbound network considerations (scraper-specific)

- Scrapers hit foreign sites (Encar, USS, Che168, BeForward, Autohome, drom.ru). drom.ru is Russian → no issue. The others are foreign and may need:
  - **Outbound proxy** through a non-Russian datacenter (some sources rate-limit or geo-block Russian IPs). Plan budget for a proxy provider (BrightData, Smartproxy, or self-rolled VPS in JP/KR/HK).
  - This concern is the single biggest hidden cost of scraper architecture. Should be flagged in PITFALLS.md.

---

## Security Boundaries

### API Surface Tiers

| Tier | Path prefix | Auth | Rate limit | Caching | CSRF |
|------|-------------|------|------------|---------|------|
| Public read | `/api/public/*` GET | none | per-IP, generous | yes (CDN/edge) | n/a |
| Public lead | `POST /api/public/leads` | none | per-IP, strict (5/min) + per-phone (3/h) | none | none (CORS-restricted) |
| Admin | `/api/admin/*` | session cookie | per-user | none | yes (double-submit cookie or SameSite=Strict + origin check) |
| Internal | `/api/internal/*` | HMAC token in header | n/a (network-restricted ideally) | none | n/a |

### Auth Specifics

- **Sessions over JWT.** Server-stored sessions (the `sessions` table above) let founders revoke access instantly. JWT is the wrong tool for an admin panel with a small user count.
- **Argon2id for password hashing.** No bcrypt for new code in 2026.
- **Cookie attributes:** `HttpOnly; Secure; SameSite=Lax; Path=/`. Admin must be served from the same origin as the API (or use SameSite=None + CSRF tokens).
- **Roles in v1:** just `founder` and `sales-rep`. Founders can edit settings + manage users; sales reps can manage leads + cars + content. Don't build a permissions DSL yet.

### 152-FZ Compliance Touchpoints

1. **All PII storage in ru-central1** — Postgres + Object Storage.
2. **Consent capture on lead form** — quiz contact step needs a "согласие на обработку ПДн" checkbox or auto-consent text near the submit button. `leads.consent_at` records when.
3. **Data subject rights endpoint** (deferred to phase 2 but designed for): `/api/admin/leads/:id/export` and `/api/admin/leads/:id/delete` should be designed-in.
4. **No third-party trackers loaded before consent** (Yandex Metrika is fine and Russian-hosted; Google Analytics is not).

---

## Build Order — 4–6 Week Critical Path

The framework: **what must work end-to-end on launch day** is the quiz-to-PDF-to-email flow with at least one functioning scraper feeding the catalog. Everything else is decoration.

### Critical Path (sequential dependencies)

```
P0  Schema + migrations + DB up        ──┐
                                          ├─→  P1  API skeleton (auth, public reads)
P0' Yandex/Selectel infra provisioned  ──┘
                                                            │
                                                            ▼
                                       P2  Frontend ↔ API integration (CrmProvider rewrite)
                                                            │
                                                            ▼
                                       P3  POST /leads + queue + PDF render + email send
                                                            │
                                                            ▼
                                       P4  ONE working scraper (Encar) → real cars in DB
                                                            │
                                                            ▼
                                       P5  Admin auth + LeadsAdmin wired to real leads
                                                            │
                                                            ▼
                                       P6  Country expansion to 6 + content polish
                                                            │
                                                            ▼
                                       P7  Soft launch
```

### Parallelizable Tracks (after P1)

| Track | Can start when | Parallel with |
|-------|----------------|---------------|
| **PDF template design** | P0 done (have schema) | P1, P2, P3 |
| **Additional scrapers** (USS, BeForward, Che168, Autohome, drom-catalog) | P4 done (have one working) | P5, P6 |
| **Admin polish** (CarsAdmin, FAQ, etc.) | P2 done | P4, P6 |
| **Founder bio / FAQ / reviews content** | n/a — pure content | Everywhere |
| **Email transactional provider setup** | n/a | Everywhere |
| **Scraper proxy infrastructure** | Before P4 starts | P0, P1, P2, P3 |

### "Must come before" Dependency Reasoning

- **Schema before API** — without tables, routes are mocks.
- **API before frontend integration** — no point swapping `CrmProvider` to call endpoints that don't exist.
- **Frontend integration before lead-flow** — `POST /leads` from `QuizModal` is the integration point that proves the loop closed.
- **Lead-flow (synthetic test cars) before scrapers** — you can hand-INSERT 5 cars into the DB to test the matcher; you cannot test the matcher without the lead-flow.
- **One scraper before all scrapers** — the second through fifth scraper all share `shared/normalize.ts`, `shared/images.ts`, `shared/http.ts`. Build once, replicate.
- **Admin auth before admin LeadsAdmin** — leads contain PII; admin pages cannot ship without login.
- **Country expansion before launch** — public messaging promises 6 markets; the UI must support it. But scrapers for US/AE/EU are explicitly stubbed.

---

## Stub-vs-Build Recommendations for v1

The 4–6 week timeline only works if these features ship **as stubs** with clean upgrade paths:

| Feature | v1 approach | Real version (post-launch) | Why stub now |
|---------|-------------|----------------------------|--------------|
| **Landed-cost calculation** | Fixed-coefficient stub (`price_local * lookup_table[country] * age_factor` + admin override field per car), shown in PDF with disclaimer "финальная цифра — у менеджера" | Real customs/utilization-fee formulas (engine cc, age, фл/юл, утилизационный сбор) | Real formulas are weeks of regulatory research; sales rep closes the gap manually. **Already a Key Decision in PROJECT.md.** |
| **Bitrix24 sync** | Lead lives in own DB only; sales rep manually copies if needed; `external_refs` JSONB column ready | Worker job listens for lead state changes, POSTs to Bitrix REST, stores deal_id in `external_refs` | Bitrix integration is its own milestone-sized effort; own DB is source of truth pre-launch. **Already a Key Decision.** |
| **US/UAE/EU scrapers** | Country buttons render with "скоро" badges; quiz can ask the country; matching falls back to admin-curated cars only for these markets | One scraper per source per market | Product can market 6 markets immediately; tech debt is honest and contained. **Already a Key Decision.** |
| **English locale** | RU only; structure components for i18n later (no string extraction needed yet) | i18next or similar; full string extraction | Russian-only audience for v1; i18n is a multi-week refactor that doesn't earn revenue. **Already a Decision.** |
| **Real live-metrics** (liveCount, totalDelivered, avgDeliveryDays, satisfactionPct) | Admin-edited values in `settings` row; updated by founders weekly | Pulled from Bitrix24 deals or computed from internal CRM | Admin-edited is honest enough; founders update from real data; eliminates dependency on Bitrix sync. **Already a Decision.** |
| **Customer self-service portal** | Doesn't exist; client interacts 1:1 with sales rep after PDF | Order-tracker with stages, doc upload, payment status | Explicitly out of scope (PROJECT.md anti-feature). |
| **Per-car detail pages** | Catalog cards open quiz, not detail page | n/a — anti-feature | Explicitly out of scope. |
| **Admin moderation queue for scraped cars** | Field `needs_review` exists in schema; admin can filter; **no formal review-required-before-public flag in v1** (auto-publish, admin can hide) | Workflow: scraped → review → approve → public | Sales-driven team won't review every car; trust-but-verify is faster. |
| **Image rehosting CDN** | Direct serve from Yandex Object Storage | CloudCDN / Selectel CDN in front of bucket | Image traffic at launch is small; add CDN when bandwidth bill demands it. |
| **PDF preview in admin** | Sales rep opens the S3 link directly | In-admin iframe preview | Nice-to-have, not launch-blocking. |

### Build Order Decisions to Lock Now

1. **`pg-boss` over BullMQ** — saves provisioning Redis. One fewer moving part. Postgres handles the load fine for years at projected volumes.
2. **`@react-pdf/renderer` server-side via `Font.register`** — runs in Node, supports Cyrillic via custom font registration with absolute path. This is the right call for matching the brand visual fidelity.
3. **Same Node binary for API and worker, different entrypoint** — one codebase, one deploy artifact, one set of types. Two systemd services or two containers from the same image.
4. **`react-query` (TanStack Query) for SPA data fetching** — caching, refetching, optimistic updates with minimal code. No need for Redux/Zustand on top.
5. **Cookie sessions over JWT** — small admin user count, instant revocation matters more than statelessness.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **0–500 leads/day, ~5k cars** (launch year) | The recommended stack as-is. Single VM, single Postgres, single worker. |
| **500–5k leads/day, ~50k cars** | Add a second API replica behind the load balancer. Add image CDN. Add Postgres read-replica if `GET /cars` is hot. Worker stays single instance. |
| **5k+ leads/day, 100k+ cars** | Consider extracting scrapers to their own worker pool (independent scaling). Replace pg-boss with BullMQ + Redis if queue throughput becomes a bottleneck. Add full-text search (Postgres FTS or Meilisearch) if catalog search outgrows simple `WHERE`. |

### First Likely Bottlenecks

1. **Scraper scheduling collisions** — if all five scrapers start at midnight and each spawns 50 image-rehost jobs, the worker chokes. Mitigation: stagger cron times, cap worker concurrency per job type.
2. **Outbound proxy bandwidth** — scraper traffic from a Russian VM to foreign sites may be throttled or blocked. Mitigation: budget for proxy provider from day 1.
3. **PDF render concurrency** — `@react-pdf/renderer` is synchronous and CPU-bound. If lead burst arrives, queue depth grows. Mitigation: per-process concurrency limit (e.g. 2), and the queue smooths the rest. 5-minute UX promise covers this.
4. **Postgres connection count** — keep a small pool (e.g. 10 connections per process); use PgBouncer if more replicas are added.

---

## Anti-Patterns

### Anti-Pattern 1: Live-scraping on quiz submission
**What people do:** "User finishes quiz → call Encar API in real-time → show fresh results."
**Why it's wrong:** Encar/USS/etc. are slow, geo-blocked, rate-limited, and break weekly. Quiz response time would be 5–30s, fail rate 5–20%.
**Do this instead:** Scheduled scrape into own DB. Quiz reads from local DB. **Already locked as a Key Decision in PROJECT.md.**

### Anti-Pattern 2: Microservices from day 1
**What people do:** Separate "inventory service", "lead service", "PDF service" as independent deployables with HTTP between them.
**Why it's wrong:** Adds network latency, adds 3x deployment complexity, adds distributed-systems failure modes — for a system that fits in one process at launch volumes.
**Do this instead:** Modular monolith. Domain modules with clear boundaries inside one process. Extract later if metrics demand it.

### Anti-Pattern 3: PDF generation in the HTTP request handler
**What people do:** `POST /leads` → render PDF → send email → return 200.
**Why it's wrong:** PDF render is 200ms–2s; SMTP is 1–10s. Total 1–12s response time. p95 misses SLA. Email provider hiccup → user sees error.
**Do this instead:** `POST /leads` returns 200 in <100ms with `{queued: true}`. Workers handle the rest. UI shows the "5 minutes" message (already implemented in `SuccessStep`).

### Anti-Pattern 4: Hot-linking source images
**What people do:** `cars.image_url = 'https://encar.com/i/12345.jpg'`.
**Why it's wrong:** Foreign image URLs expire, change, geo-block, or watermark differently. Half your catalog goes blank one day.
**Do this instead:** Scraper downloads image, uploads to your bucket, stores `image_key`. Pay the bandwidth + storage; own the asset.

### Anti-Pattern 5: localStorage as production state
**What people do:** Ship the existing `CrmProvider` as-is to production "just for v1".
**Why it's wrong:** Each visitor has their own catalog. No shared state. No real leads captured. Defeats the entire product.
**Do this instead:** The CrmProvider rewrite (Pattern 5 above) is mandatory and on the critical path.

### Anti-Pattern 6: Storing PDF blobs in Postgres
**What people do:** `leads.pdf_bytes BYTEA`.
**Why it's wrong:** Bloats backups, slows replication, evicts hot data from buffer cache. Postgres is a database, not a blob store.
**Do this instead:** PDFs in S3-compatible bucket; only the key in Postgres.

### Anti-Pattern 7: Building a permissions DSL
**What people do:** Generic role/permission/resource system before there are real users.
**Why it's wrong:** Weeks of work for a system with two role names.
**Do this instead:** Hardcode `if (user.role !== 'founder') return 403` checks where needed. Refactor when there's a third role.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Encar (KR) | Scheduled HTTP scrape via worker job; HTML parsing (Cheerio); 6h cadence | May need outbound proxy. Site changes structure occasionally — isolate per-source parser. |
| USS-Auctions (JP) | Scheduled HTTP scrape; auction format means high churn | Ephemeral listings; mark stale aggressively. |
| BeForward (JP) | Scheduled HTTP scrape; cleaner HTML than USS | Same pattern as Encar. |
| Che168 (CN) | Scheduled HTTP scrape; Mandarin HTML | Need translation step in normalize() (model names → English/Russian). |
| Autohome (CN) | Scheduled HTTP scrape; richer spec data | Treat as model-fact source as well as listing source. |
| drom.ru/catalog | Scheduled HTTP scrape; weekly cadence; populates `models` | Russian site — no proxy needed, no translation needed. |
| Yandex Object Storage | S3 SDK with `endpoint=storage.yandexcloud.net`, `region=ru-central1` | Compatible with AWS S3 v3 SDK. |
| Email (transactional) | SMTP from worker | Russian provider mandatory for deliverability to .ru recipients (Mailopost, UniSender, SendPulse). Avoid SendGrid/Postmark — flagged by Yandex.Mail and Mail.ru. |
| Yandex Metrika | Client-side tag in SPA | Russian-hosted analytics; required when GA isn't viable. |
| Bitrix24 (FUTURE) | Outbound webhook from worker on lead state change; inbound webhook for deal-status updates | Deferred phase. `external_refs` JSONB ready. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| SPA ↔ API | HTTPS REST/JSON via `src/api/` client | Single source of truth for the wire format. |
| API process ↔ Worker process | Job queue (`pg-boss`); never direct HTTP | Decouples; survives worker restarts. |
| Worker ↔ Postgres | Same connection pool as API | Direct repository imports, not API calls. |
| Worker ↔ S3 | AWS S3 v3 SDK pointed at Yandex endpoint | Same SDK as API for consistency. |
| Frontend types ↔ Backend types | Shared `packages/shared/types.ts` (or path-aliased import) | Prevents drift. |
| Admin UI ↔ Existing CRM hook surface | `useCrm()` API preserved verbatim | Zero changes to existing admin pages. |

---

## Confidence Notes & Open Questions

**HIGH confidence:**
- Modular monolith is the right shape at this scale and timeline.
- `cars` / `models` / `leads` schema fundamentals.
- `@react-pdf/renderer` server-side with `Font.register` for Cyrillic.
- Yandex Object Storage S3-compat & 152-FZ posture.
- Async PDF/email via job queue.
- Frontend hook-surface preservation strategy.

**MEDIUM confidence (depends on STACK research outcome):**
- Specific framework (Hono vs Fastify vs Express vs FastAPI). Architecture survives any of these.
- pg-boss vs BullMQ — recommendation is pg-boss but BullMQ is fine if STACK already provisions Redis.
- VM vs Serverless Containers as the v1 deploy target. Recommend VM.

**LOW confidence (needs phase-specific research later):**
- Scraper-specific anti-bot evasion (proxy provider, fingerprinting, captcha) — likely to surface real costs in P4.
- Russian transactional email provider deliverability characteristics for outbound mass sends — needs benchmarking.
- Whether `pg_trgm` / Russian FTS is sufficient for catalog search at v2 scale, or whether Meilisearch is warranted.
- Exact Bitrix24 webhook contract and rate limits — not relevant until that phase.

**Open questions for the Roadmap to flag:**
1. Which Russian hosting provider exactly? (Yandex Cloud vs Selectel vs Timeweb) — affects only managed-service SKU choice, not architecture.
2. Outbound proxy budget — needs explicit line item.
3. Email provider trial/contract — start before P3.
4. Source content for Founders bios — block before launch but not before code.

---

## Sources

- [Yandex Object Storage — S3 Cloud Storage](https://yandex.cloud/en/services/storage) — confirms S3-compatible API, ru-central1 region, 152-FZ compliance posture (HIGH).
- [Yandex Object Storage — How to use the S3 API](https://yandex.cloud/en/docs/storage/s3/) — endpoint and SDK compatibility details (HIGH).
- [@react-pdf/renderer — Fonts documentation](https://react-pdf.org/fonts) — `Font.register` server-side usage with absolute paths for custom (incl. Cyrillic) fonts (HIGH).
- [Render PDF server-side with Node — react-pdf discussion #2402](https://github.com/diegomura/react-pdf/discussions/2402) — community-confirmed server-side rendering pattern (MEDIUM).
- [BullMQ — Job Schedulers documentation](https://docs.bullmq.io/guide/job-schedulers) — cron-style scheduling reference (HIGH).
- [Choosing the Right Node.js Job Queue — Judoscale](https://judoscale.com/blog/node-task-queues) — pg-boss vs BullMQ comparison; supports the "use Postgres if you already have it" recommendation (MEDIUM).
- [Cron Jobs vs Background Workers vs Queues — Railway Guides](https://docs.railway.com/guides/cron-workers-queues) — clarifies the "queue + scheduled trigger" pattern recommended here (MEDIUM).
- DVApro PROJECT.md — constraints, decisions, and out-of-scope boundaries that drive the stub-vs-build recommendations (HIGH).
- Existing `src/` scaffold — directly inspected to validate the hook-surface-preservation strategy (HIGH).

---
*Architecture research for: DVApro — Russian vehicle-import marketplace*
*Researched: 2026-04-26*
