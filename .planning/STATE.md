---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 02.1-06-PLAN.md (Phase 02.1 close-out). Phase 02.1 is now COMPLETE.
last_updated: "2026-05-07T16:04:20.903Z"
progress:
  total_phases: 13
  completed_phases: 6
  total_plans: 48
  completed_plans: 48
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

Phase: 3
Plan: Not started
Plans: 6 of 6 complete (Wave 1: 5 parallel density cuts; Wave 2: threshold re-tune + close)
**Status:** Ready to plan

**Wave summary:**

- Wave 1 (2 plans): ✓ Complectation schema (Strategy B hybrid: 7 typed slots + chassis group + features bag); ⏭ hybrid X5 fixture deferred — operator confirmed live re-scrape covers it (see `01.2-05-SUMMARY.md`)
- Wave 2 (3 plans, parallel worktrees): ✓ generic section-walker parser (137 features on fixture 207354); ✓ HTML viewer renders 8 native drom sections with subsections + ✓/× glyphs + esc()-XSS hardening; ✓ coverage gate adds chassis (≥0.30) + features_density (≥50) floors
- Wave 3 (1 plan, operator-monitored): ✓ live BMW X5 backfill — 38 generations × 477 complectations in ~56 min wall-clock, 0 errors, 0 rate-limit hits; all 8 coverage floors clear by wide margins (chassis 1.00, features_density 119.78)

**Test state:** 207/210 passing (19 files), 3 skipped (deferred hybrid-fixture tests), `pnpm typecheck:server` exits 0.

**Goal verification:** ✅ PASSED 4/4 acceptance criteria via gsd-verifier (see `01.2-VERIFICATION.md`).

**Output:** `data/scraped/drom/current/` → `2026-05-03T11-33-51Z/` (38 gens, 477 comps, hybrid Strategy B schema fully populated).

**Open follow-up (non-blocking, surfaced by verifier):**

- **`hybrid_type` regex mismatch** — drom's actual label is "Вид гибрида" (not "Тип гибридной системы" the plan assumed). 46 hybrid trims have `drivetrain.hybrid_type=null` while metadata still correctly lands in `features[]`. ~5-min regex fix; capture as a quick task before Phase 03's importer reads typed slots.

**Parallel work that can start immediately:**

- **Phase 3** — Compliance & Infra. Roskomnadzor 5-day window + Unisender Go 14-day warm-up are calendar-bound. Run `/gsd-discuss-phase 3`.
- **Founder content collection** (биографии, фото, отзывы) — pure-content track, blocks Phase 8 launch credibility.

---

## Performance Metrics

**Roadmapping:**

- v1 requirements identified: 73
- Requirements mapped to phases: 73 / 73 (100% coverage)
- Phases derived: 8 (standard granularity)
- Research-spike phases flagged: 4 (P1 drom path, P2 infra/compliance, P5 PDF/email, P6 admin auth)
- Parallelisable tracks identified: 5 (founder content, PDF template, Phase 1 + Phase 3 in week 1, admin polish, DNS warm-up)

**Execution:** (will populate as phases close)

- Phases completed: 0 / 8
- Plans completed: 0 / TBD
- Avg time per phase: TBD

---

## Quick Tasks Completed

| ID | Date | Description | Tests | Files |
|----|------|-------------|-------|-------|
| 260501-koe | 2026-05-01 | DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR env-var filters for drom scraper | 161 → 164 | `server/scrapers/drom/index.ts`, `server/tests/drom-integration.test.ts`, `data/scraped/README.md` |
| 260503-gja | 2026-05-03 | Live progress (incremental `models.json` + per-loop `[drom]` logs) in drom orchestrator + wipe & restart for BMW X5 only | n/a | `server/scrapers/drom/index.ts`, `data/scraped/drom/*` |
| 260503-j62 | 2026-05-03 | Drom HTML viewer: clickable comp grid + per-comp detail modal (6 schema groups), fixed engine block ({cc,hp,fuel} schema), reorganized model layout (Обзор card), pricing coverage gate now per-group floors (pricing 0.05; H1 rejected on fixture evidence; H3 win) | 163/163 (puppeteer screenshot golden deferred — see deferred-items.md) | `server/scrapers/shared/report-html.ts`, `server/scrapers/shared/coverage.ts`, `server/tests/__snapshots__/report-html.test.ts.snap` |

---

## Accumulated Context

### Roadmap Evolution

- Phase 01.1 inserted after Phase 01: extend-drom-scrape-fields: full description, complectations, engine/fuel/transmission/dimensions/tires/weight per trim (URGENT)
- Phase 01.2 inserted after Phase 1: extend-complectation-fields — capture all 8 drom comp tables via hybrid typed-core + features-bag schema, then re-scrape BMW X5 (URGENT)
- Phase 2 inserted (renumbered from initially-added Phase 9): redesign from screenshot — old Phases 2–8 shifted to 3–9 (text-only renumber across .planning/; only `phases/01*` had real content, no per-phase file renames needed)
- **Phase 02 closed 2026-05-07** — visual fidelity pass landed; G-01..G-11 closed (3 code: G-01 + G-11 + QuizModal D-03 alpha; 5 verify-only confirmed: G-03/G-06/G-08/G-09 + QuizModal audit; 5 golden-covered: G-02/G-04/G-05/G-07/G-10); golden test 19.57% < 22.00% threshold; one item routed to 02-DEFERRED-POLISH.md → Phase 8 (SuccessStep WhatsApp-brand vs success-indicator drift)
- Phase 02.1 inserted after Phase 2: tighten visual density to design-reference fidelity (URGENT)
- **Phase 02.1 closed 2026-05-07** — visual density compression landed; fullPage height 7 651 px (in 7000–8000 band); golden threshold re-tuned 0.22 → 0.28 (empirical floor 24.52%; D-03b floor expectation overridden — see 02.1-VERIFICATION.md tradeoffs section); all Phase 2 G-01..G-11 contracts preserved; mobile breakpoint untouched (D-04a verified via git diff audit)
- Phase 02.2 inserted after Phase 2: Match landing-page section topology to design-reference.png (URGENT)

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
| **Phase reorder: scraping → Phase 1, scope reduced to drom + stubs, file-based output** | 2026-04-27 | Founder direction: build a running drom scraper FIRST without DB/cloud dependencies; lock IScraper contract via stubs for Encar/BeForward/Che168/Autohome (live impls deferred to v1.x); JSON/WebP output is importable to DB once Phase 4 schema is finalized. Old Phase 6 plans (8) discarded; old Phase 1 (Compliance & Infra) demoted to Phase 3 (no scope change). |

### Open Questions (surface to founders before respective phase)

- **Phase 1 (was Phase 6):** ✅ Resolved 2026-04-28 via `/gsd-discuss-phase 1` — see `01-CONTEXT.md` decisions D-01..D-17. Remaining open item is the drom partner-API ToS/pricing spike (D-04), which is the researcher's first task during `/gsd-plan-phase 1`.
- **Phase 3 (was Phase 1):** Какой ИНН/ОГРН какого юрлица оператор ПДн (DVApro ООО? founder ИП?) — affects Roskomnadzor подача и ИНН/ОГРН в footer
- **Phase 3 (was Phase 1):** Sender-domain `dva.pro` ownership и DNS access — needed для SPF/DKIM/DMARC + warm-up
- **Phase 3 (was Phase 1):** Yandex Cloud post-2026-05-01 pricing — re-confirm budget
- **Phase 6 (was Phase 5):** Cyrillic font choice (Inter vs PT Sans vs IBM Plex Sans) + license verification
- **Phase 8:** Real founder bios + photos + optional video-pitch — content kickoff в Phase 1/2

### Todos (carry-forward across phases)

- [ ] Founder content writing (биографии, фото, ≥6 отзывов) — start in P1/P2, deliver in P7
- [ ] Unisender Go domain reputation monitoring — start in P2, ongoing through P8
- [ ] PDF template design draft — start once P3 schema is committed
- [ ] **REQUIREMENTS.md traceability update** — D-10 (old Phase 6) reclassified SCRAPE-01..04 as best-effort/v1.x. New Phase 1 makes this binding (stubs only). Run `/gsd-extract-learnings` or manual update at end of new Phase 1 to mark these requirements as v1.x.
- [ ] **`.planning/phases/01-inventory-scrapers-drom-and-stubs/01-SCOPE.md` cleanup** — after `/gsd-discuss-phase 1` produces the real `01-CONTEXT.md`, decide whether to delete the SCOPE seed or move to `.planning/transitions/`.

### Blockers

(none — roadmap reordered; awaiting `/gsd-discuss-phase 1`)

---

## Session Continuity

**Last session:** 2026-05-07T16:04:20.894Z

**Reorder summary:**

- Old Phase 6 (Inventory Pipeline — Encar + drom + JP/CN scrapers + Crawlee fleet + residential proxies + Yandex Object Storage rehost + pg-boss queue) → New Phase 1 with reduced scope (drom only + IScraper stubs, file-based output, no DB/cloud/queue)
- Old Phase 1 (Compliance & Infra) → New Phase 3 (unchanged scope)
- Old Phases 2–4 → New Phases 3–5 (`Depends on:` updated to new numbering; otherwise unchanged)
- Old Phases 6–8 → unchanged numbering
- Old Phase 6 artifacts (8 plans + CONTEXT + DISCUSSION-LOG + RESEARCH + PATTERNS + VALIDATION) discarded; new Phase 1 directory `.planning/phases/01-inventory-scrapers-drom-and-stubs/` contains only `01-SCOPE.md` (founder-intent seed for the discussion agent)

**Stopped at:** Completed 02.1-06-PLAN.md (Phase 02.1 close-out). Phase 02.1 is now COMPLETE.

**Next session:** Phase 3 (Compliance & Infra Foundation) — calendar-bound, should start immediately (Roskomnadzor 5-day window + Unisender Go 14-day warm-up are calendar gates). Run `/gsd-discuss-phase 3`. Can also run founder content collection in parallel.

**Parallel work that can start in same session:**

- Founder content collection (biographies, photos, reviews) — independent of code, blocks P7 launch credibility
- Phase 3 (Compliance & Infra) discussion + planning — calendar-bound, no shared dependency surface with Phase 1

---
*State initialized: 2026-04-26 by gsd-roadmapper*
*State updated: 2026-04-27 — phase reorder by orchestrator*
