# Project State: DVApro

**Last updated:** 2026-04-26
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
- `.planning/ROADMAP.md` — 8-phase plan with success criteria
- `.planning/research/SUMMARY.md` — synthesized research (P0–P7 critical path, tensions, sources)
- `.planning/research/STACK.md` — locked stack with versions
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flows, schema sketches
- `.planning/research/PITFALLS.md` — pitfalls with phase mapping
- `.planning/research/FEATURES.md` — table-stakes / differentiators / anti-features

---

## Current Position

**Phase:** 1 — Compliance & Infra Foundation
**Plan:** none yet (awaiting `/gsd-plan-phase 1`)
**Status:** Roadmap created; ready for plan-phase
**Progress:** 0 / 8 phases complete

```
[                                                  ] 0%
Phase 1   2   3   4   5   6   7   8
   ░    ░   ░   ░   ░   ░   ░   ░
```

**Next action:** `/gsd-plan-phase 1` — derive plans for Phase 1 (Compliance & Infra Foundation), with research-spike for Yandex Cloud post-2026-05-01 pricing + Roskomnadzor operator-identity question + Unisender Go warm-up calendar.

---

## Performance Metrics

**Roadmapping:**
- v1 requirements identified: 73
- Requirements mapped to phases: 73 / 73 (100% coverage)
- Phases derived: 8 (standard granularity)
- Research-spike phases flagged: 4 (P1, P4, P5, P6)
- Parallelisable tracks identified: 5 (founder content, PDF template, scraper plumbing, admin polish, DNS warm-up)

**Execution:** (will populate as phases close)
- Phases completed: 0 / 8
- Plans completed: 0 / TBD
- Avg time per phase: TBD

---

## Accumulated Context

### Decisions Logged (from PROJECT.md + research)

| Decision | Phase locked-in | Rationale |
|----------|-----------------|-----------|
| Backend: Hono 4.12 + Drizzle 0.45 + Postgres 16 + pg-boss + Crawlee on Yandex Cloud `ru-central1` | Pre-roadmap (research) | Minimal re-platforming surface vs existing Vite SPA; web-standards primitives; 152-ФЗ + FSTEC + UZ-1 posture |
| pg-boss for v1 (BullMQ as upgrade path) | Pre-roadmap (research) | Removes Redis from critical-path of week-1 launch; design Queue interface so swap is mechanical |
| USS Auctions: NOT scraped in v1 | Pre-roadmap (research) | Partner login + ToS block + risk of permanent ban + JP relationship loss; data via licensed exporter feed |
| Auth: Better-Auth (Lucia deprecated) | Pre-roadmap (research) | Lucia deprecated Mar 2025; Better-Auth has Hono integration + roles plugin + sessions in Postgres |
| Email: Unisender Go (RU-resident) | Pre-roadmap (research) | 152-ФЗ alignment + better deliverability to .ru inboxes than foreign SMTP |
| Frontend stack frozen (no Next.js migration) | Pre-roadmap (research) | Vercel blocked by 152-ФЗ; re-platforming cost 1–1.5 weeks for zero functional gain |
| 8-phase roadmap (standard granularity) | 2026-04-26 | Derived from research P0–P7 + LAUNCH; matches 4–6 week calendar |

### Open Questions (surface to founders before respective phase)

- **Phase 1:** Какой ИНН/ОГРН какого юрлица оператор ПДн (DVApro ООО? founder ИП?) — affects Roskomnadzor подача и ИНН/ОГРН в footer
- **Phase 1:** Sender-domain `dva.pro` ownership и DNS access — needed для SPF/DKIM/DMARC + warm-up
- **Phase 1:** Yandex Cloud post-2026-05-01 pricing — re-confirm budget
- **Phase 4:** Cyrillic font choice (Inter vs PT Sans vs IBM Plex Sans) + license verification
- **Phase 5:** KR + CN residential proxy provider + monthly budget; Encar fingerprint detection severity
- **Phase 7:** Real founder bios + photos + optional video-pitch — content kickoff в Phase 1

### Todos (carry-forward across phases)

- [ ] Founder content writing (биографии, фото, ≥6 отзывов) — start in P1, deliver in P7
- [ ] Unisender Go domain reputation monitoring — start in P1, ongoing through P8
- [ ] PDF template design draft — start once P2 schema is committed

### Blockers

(none — roadmap creation complete; awaiting `/gsd-plan-phase 1`)

---

## Session Continuity

**Last session:** 2026-04-26 — gsd-roadmapper subagent created ROADMAP.md, STATE.md, and updated REQUIREMENTS.md traceability.
**Next session:** Run `/gsd-plan-phase 1` to derive plans for Phase 1 (Compliance & Infra Foundation). Phase 1 is calendar-bound (Roskomnadzor 5-day window + Unisender Go 14-day warm-up), so it must start *immediately* — code-phases 2–4 can layer on top once Phase 1 plans are defined.

**Parallel work that can start in same session:**
- Founder content collection (biographies, photos, reviews) — independent of code, blocks P7 launch credibility

---
*State initialized: 2026-04-26 by gsd-roadmapper*
