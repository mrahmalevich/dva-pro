---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-04-29T08:39:09.164Z"
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 16
  completed_plans: 16
  percent: 100
---

# Project State: DVApro

**Last updated:** 2026-04-27
**Maintained by:** GSD orchestrator (auto-updated at phase/plan transitions)

---

## Project Reference

**Core value:** Посетитель проходит квиз → получает на email брендированный PDF с подобранными авто и landed-cost stub → одновременно становится квалифицированным лидом в продажной воронке.

**Constraints:**

- Soft-launch deadline ≈ 2026-06-07 (4–6 weeks)
- 152-ФЗ: персональные данные граждан РФ хранятся на российских серверах (Yandex Cloud `ru-central1`)
- Frontend stack locked: React 18 + Vite + TypeScript + react-router (no Next.js migration)
- Backend stack locked: Node 22 LTS + Hono 4.12 + Drizzle 0.45 + Postgres 16 + pg-boss + Crawlee/Playwright + @react-pdf/renderer 4.5 + Better-Auth + Yandex Object Storage
- Anti-features locked: no e-commerce checkout, no per-car detail pages, no mobile app, no real Bitrix24 sync in v1, no real customs formulas in v1, no US/AE/EU scrapers in v1, no EN locale, no foreign edge in front of forms

**Linked documents:**

- `.planning/PROJECT.md` — vision, requirements, decisions, anti-features
- `.planning/REQUIREMENTS.md` — v1 requirements with traceability
- `.planning/ROADMAP.md` — 8-phase plan with success criteria (reordered 2026-04-27 — see Reorder Log)
- `.planning/research/SUMMARY.md` — synthesized research (P0–P7 critical path, tensions, sources)
- `.planning/research/STACK.md` — locked stack with versions
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flows, schema sketches
- `.planning/research/PITFALLS.md` — pitfalls with phase mapping
- `.planning/research/FEATURES.md` — table-stakes / differentiators / anti-features

---

## Current Position

Phase: 01 (inventory-scrapers-drom-and-stubs) — EXECUTING
Plan: 1 of 16
**Phase:** 1 — Inventory Scrapers (drom.ru → JSON/WebP + IScraper stubs)
**Plan:** none yet (context gathered 2026-04-28; awaiting `/gsd-plan-phase 1`)
**Status:** Executing Phase 01
**Progress:** 0 / 8 phases complete

```
[                                                  ] 0%
Phase 1   2   3   4   5   6   7   8
   ░    ░   ░   ░   ░   ░   ░   ░
```

**Next action:** `/gsd-plan-phase 1` — derive plans from `01-CONTEXT.md` (committed 2026-04-28). Includes a researcher spike on `baza.drom.ru/help/API` (D-04, decision rule: <1wk + <## Current Position

00/mo). After planning, `/gsd-execute-phase 1`. Phase 2 (Compliance & Infra) can run in parallel via `/gsd-discuss-phase 2`.

**Parallel work that can start immediately (independent of Phase 1):**

- **Phase 2 prep** — Compliance & Infra. Roskomnadzor 5-day window + Unisender Go 14-day warm-up are calendar-bound; user can begin in parallel via `/gsd-discuss-phase 2`.
- **Founder content collection** (биографии, фото, отзывы) — pure-content track, blocks Phase 7 launch credibility.

---

## Performance Metrics

**Roadmapping:**

- v1 requirements identified: 73
- Requirements mapped to phases: 73 / 73 (100% coverage)
- Phases derived: 8 (standard granularity)
- Research-spike phases flagged: 4 (P1 drom path, P2 infra/compliance, P5 PDF/email, P6 admin auth)
- Parallelisable tracks identified: 5 (founder content, PDF template, Phase 1 + Phase 2 in week 1, admin polish, DNS warm-up)

**Execution:** (will populate as phases close)

- Phases completed: 0 / 8
- Plans completed: 0 / TBD
- Avg time per phase: TBD

---

## Accumulated Context

### Roadmap Evolution

- Phase 01.1 inserted after Phase 01: extend-drom-scrape-fields: full description, complectations, engine/fuel/transmission/dimensions/tires/weight per trim (URGENT)

### Decisions Logged (from PROJECT.md + research + reorder)

| Decision | Phase locked-in | Rationale |
|----------|-----------------|-----------|
| Backend: Hono 4.12 + Drizzle 0.45 + Postgres 16 + pg-boss + Crawlee on Yandex Cloud `ru-central1` | Pre-roadmap (research) | Minimal re-platforming surface vs existing Vite SPA; web-standards primitives; 152-ФЗ + FSTEC + UZ-1 posture |
| pg-boss for v1 (BullMQ as upgrade path) | Pre-roadmap (research) | Removes Redis from critical-path of week-1 launch; design Queue interface so swap is mechanical |
| USS Auctions: NOT scraped in v1 | Pre-roadmap (research) | Partner login + ToS block + risk of permanent ban + JP relationship loss; data via licensed exporter feed |
| Auth: Better-Auth (Lucia deprecated) | Pre-roadmap (research) | Lucia deprecated Mar 2025; Better-Auth has Hono integration + roles plugin + sessions in Postgres |
| Email: Unisender Go (RU-resident) | Pre-roadmap (research) | 152-ФЗ alignment + better deliverability to .ru inboxes than foreign SMTP |
| Frontend stack frozen (no Next.js migration) | Pre-roadmap (research) | Vercel blocked by 152-ФЗ; re-platforming cost 1–1.5 weeks for zero functional gain |
| 8-phase roadmap (standard granularity) | 2026-04-26 | Derived from research P0–P7 + LAUNCH; matches 4–6 week calendar |
| **Phase reorder: scraping → Phase 1, scope reduced to drom + stubs, file-based output** | 2026-04-27 | Founder direction: build a running drom scraper FIRST without DB/cloud dependencies; lock IScraper contract via stubs for Encar/BeForward/Che168/Autohome (live impls deferred to v1.x); JSON/WebP output is importable to DB once Phase 3 schema is finalized. Old Phase 5 plans (8) discarded; old Phase 1 (Compliance & Infra) demoted to Phase 2 (no scope change). |

### Open Questions (surface to founders before respective phase)

- **Phase 1 (was Phase 5):** ✅ Resolved 2026-04-28 via `/gsd-discuss-phase 1` — see `01-CONTEXT.md` decisions D-01..D-17. Remaining open item is the drom partner-API ToS/pricing spike (D-04), which is the researcher's first task during `/gsd-plan-phase 1`.
- **Phase 2 (was Phase 1):** Какой ИНН/ОГРН какого юрлица оператор ПДн (DVApro ООО? founder ИП?) — affects Roskomnadzor подача и ИНН/ОГРН в footer
- **Phase 2 (was Phase 1):** Sender-domain `dva.pro` ownership и DNS access — needed для SPF/DKIM/DMARC + warm-up
- **Phase 2 (was Phase 1):** Yandex Cloud post-2026-05-01 pricing — re-confirm budget
- **Phase 5 (was Phase 4):** Cyrillic font choice (Inter vs PT Sans vs IBM Plex Sans) + license verification
- **Phase 7:** Real founder bios + photos + optional video-pitch — content kickoff в Phase 1/2

### Todos (carry-forward across phases)

- [ ] Founder content writing (биографии, фото, ≥6 отзывов) — start in P1/P2, deliver in P7
- [ ] Unisender Go domain reputation monitoring — start in P2, ongoing through P8
- [ ] PDF template design draft — start once P3 schema is committed
- [ ] **REQUIREMENTS.md traceability update** — D-10 (old Phase 5) reclassified SCRAPE-01..04 as best-effort/v1.x. New Phase 1 makes this binding (stubs only). Run `/gsd-extract-learnings` or manual update at end of new Phase 1 to mark these requirements as v1.x.
- [ ] **`.planning/phases/01-inventory-scrapers-drom-and-stubs/01-SCOPE.md` cleanup** — after `/gsd-discuss-phase 1` produces the real `01-CONTEXT.md`, decide whether to delete the SCOPE seed or move to `.planning/transitions/`.

### Blockers

(none — roadmap reordered; awaiting `/gsd-discuss-phase 1`)

---

## Session Continuity

**Last session:** 2026-04-28T09:59:17.466Z

**Reorder summary:**

- Old Phase 5 (Inventory Pipeline — Encar + drom + JP/CN scrapers + Crawlee fleet + residential proxies + Yandex Object Storage rehost + pg-boss queue) → New Phase 1 with reduced scope (drom only + IScraper stubs, file-based output, no DB/cloud/queue)
- Old Phase 1 (Compliance & Infra) → New Phase 2 (unchanged scope)
- Old Phases 2–4 → New Phases 3–5 (`Depends on:` updated to new numbering; otherwise unchanged)
- Old Phases 6–8 → unchanged numbering
- Old Phase 5 artifacts (8 plans + CONTEXT + DISCUSSION-LOG + RESEARCH + PATTERNS + VALIDATION) discarded; new Phase 1 directory `.planning/phases/01-inventory-scrapers-drom-and-stubs/` contains only `01-SCOPE.md` (founder-intent seed for the discussion agent)

**Next session:** Run `/gsd-discuss-phase 1` to gather context for the new Phase 1 (drom scraper + IScraper stubs + JSON/WebP output). Then `/gsd-plan-phase 1` → `/gsd-execute-phase 1`. Phase 2 (Compliance & Infra) can run in parallel.

**Parallel work that can start in same session:**

- Founder content collection (biographies, photos, reviews) — independent of code, blocks P7 launch credibility
- Phase 2 (Compliance & Infra) discussion + planning — calendar-bound, no shared dependency surface with Phase 1

---
*State initialized: 2026-04-26 by gsd-roadmapper*
*State updated: 2026-04-27 — phase reorder by orchestrator*
