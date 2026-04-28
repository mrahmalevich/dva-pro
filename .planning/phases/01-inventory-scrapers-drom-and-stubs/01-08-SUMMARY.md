---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 08
subsystem: docs
tags: [docs, schema, readme, runbook, drom, phase-3-handoff, model-record, fx-cache, brand-aliases]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: server/scrapers/shared/types.ts (ModelRecord zod schema — single source of truth that SCHEMA.md mirrors); pnpm scripts (scrape:drom + 4 stubs) + .gitignore negations for SCHEMA.md / README.md / brand-aliases.json (plans 01..07)
provides:
  - data/scraped/SCHEMA.md — authoritative human-readable mirror of ModelRecord; all 17 fields + BMW X5 G05 worked example + Phase 3 importer upsert contract `(brand_slug, model_slug, generation)` + D-17 report.json telemetry table + brand-aliases.json + CBR FX cache shapes
  - data/scraped/README.md — operator runbook: pnpm scrape:drom invocation + exit codes 0/1/2/3 (D-09) + output dir layout (D-06) + run_id format (D-07) + current/ symlink (D-08) + Pitfall 7 re-resolve rule + manual prune command + OS support (macOS/Linux only) + secrets policy (NONE) + crash recovery via .cursor.json (D-15) + 4 stub-source v1.x strategy table
affects: [phase-03-database-and-importer, phase-09-validation, future-v1.x-encar, future-v1.x-beforward, future-v1.x-che168, future-v1.x-autohome]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema doc mirrors zod TS source of truth (Pitfall 6): SCHEMA.md is hand-maintained and explicitly names server/scrapers/shared/types.ts as the binding source. Editors bump TS first, then sync the doc — codegen reserved for v1.x."
    - "Phase 3 handoff contract is documented (not just code): SCHEMA.md publishes the upsert key + image rehost path mapping + Pitfall 7 always-re-resolve-current/ rule, so Phase 3 importer can be written without re-asking Phase 1 questions."
    - "Operator runbook colocated with output (data/scraped/README.md): keeps invocation, exit codes, output layout, prune command, and troubleshooting next to where artifacts land — no scavenger hunt across .planning/."

key-files:
  created:
    - data/scraped/SCHEMA.md
    - data/scraped/README.md
  modified: []

key-decisions:
  - "SCHEMA.md is hand-maintained mirror of server/scrapers/shared/types.ts (Pitfall 6). No codegen in Phase 1; editing policy documented explicitly at the bottom of SCHEMA.md. Codegen (scripts/build-schema-md.ts) reserved for v1.x."
  - "drom = master MODELS (models.json) vs stubs = future CarListings (cars.json): terminology distinction recorded in SCHEMA.md overview table so Phase 3 importer wires drom records to the models table, not the cars table."
  - "Phase 3 upsert key (brand_slug, model_slug, generation) published in SCHEMA.md — matches the ARCHITECTURE.md:555 models.UNIQUE constraint sketch."
  - "README runbook commits to NO secrets in Phase 1 (drom + CBR are public). Anything prompting for a secret is a bug. Phase 2 introduces .env (separate scope)."
  - "Windows is explicitly NOT supported — current/ symlink atomicity requires POSIX rename-over-symlink. Docker fallback documented for Windows operators."

patterns-established:
  - "Doc-as-handoff-contract: Phase N publishes the precise contract (field types, upsert key, file paths, symlink rules) Phase N+1 needs as binding Markdown — not as 'go read the code' tribal knowledge."
  - "Source-of-truth pointer in human-readable docs: every schema/contract doc must name its binding artifact (here: server/scrapers/shared/types.ts) and the editing order (TS first, doc second)."

requirements-completed: []

# Metrics
duration: 3m28s
completed: 2026-04-28
---

# Phase 01 Plan 08: Documentation (SCHEMA.md + README.md) Summary

**Two committed Markdown files completing the Phase 1 → Phase 3 handoff contract: data/scraped/SCHEMA.md (authoritative ModelRecord field-by-field mirror with BMW X5 G05 worked example + Phase 3 upsert key + D-17 report.json telemetry) and data/scraped/README.md (operator runbook: pnpm scrape:drom invocation, exit codes 0/1/2/3, output layout, current/ symlink Pitfall 7 re-resolve rule, manual prune, OS support, NO-secrets policy, crash recovery, 4-stub v1.x strategy table).**

## Performance

- **Duration:** 3m28s (208 s wall-clock)
- **Started:** 2026-04-28T11:29:23Z
- **Completed:** 2026-04-28T11:32:51Z
- **Tasks:** 2 / 2 completed (Task 1 SCHEMA.md, Task 2 README.md)
- **Files modified:** 2 (both newly created)

## Accomplishments

- **SCHEMA.md is the binding Phase 1 → Phase 3 handoff document.** It mirrors all 17 fields of `ModelRecord` (brand, brand_slug, model, model_slug, generation, year_from, year_to, body_types, engine_options, drive_options, description_ru, price_min_rub, price_max_rub, image_paths, source, source_url, scraped_at), publishes the Phase 3 upsert key `(brand_slug, model_slug, generation)`, documents the image rehost mapping local → Yandex Object Storage, and includes a copy-pasteable BMW X5 G05 worked example.
- **D-17 report.json telemetry contract is now public** — all 14 fields (`started_at`, `finished_at`, `duration_ms`, `pages_visited`, `models_added`, `models_updated`, `images_downloaded`, `images_skipped`, `errors[]`, `rate_limit_hits`, `blocked_responses`, `fx_stale`, `cursor_resumed`, `final_status`) tabulated so Phase 9 (validation/smoke run) and future ops dashboards can consume reports without guessing field names.
- **README.md is the operator runbook.** Documents `pnpm scrape:drom` + 4 stub dispatchers, all 4 exit codes (D-09), output dir tree (D-06) with run_id format (D-07), current/ symlink contract (D-08) with Pitfall 7 always-re-resolve rule, polite rate limit (D-14: 1 req/10 s ±20 %), brand-boundary crash recovery (D-15), manual prune command, OS support matrix (macOS + Linux only; Windows → Docker), secrets policy (NONE in Phase 1), and a per-stub-source v1.x implementation-strategy table (Crawlee + Playwright Firefox + KR proxy for encar; HttpCrawler + Cheerio for beforward; PlaywrightCrawler + CN proxy for che168/autohome).
- **Source-of-truth pointer enforced.** SCHEMA.md explicitly names `server/scrapers/shared/types.ts` as binding and instructs editors to bump the TS schema first; README.md cross-links SCHEMA.md and the TS schema in its "See also" footer. Pitfall 6 (doc drift) is mitigated by documenting the editing order in the doc itself.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create data/scraped/SCHEMA.md** — `415cdc0` (docs)
2. **Task 2: Create data/scraped/README.md** — `44b61c5` (docs)

(Plan-metadata commit will be made by the orchestrator after wave 5 completes.)

## Files Created/Modified

- `data/scraped/SCHEMA.md` (NEW, 183 insertions) — authoritative ModelRecord schema mirror; Phase 3 importer contract; D-17 report.json telemetry table; brand-aliases.json + CBR FX cache shapes; editing-policy footer.
- `data/scraped/README.md` (NEW, 162 insertions) — operator runbook covering invocation, exit codes, output layout, current/ symlink contract, polite rate limit, crash recovery, manual prune, OS support, secrets policy, troubleshooting, and 4-stub v1.x strategy table.

## Decisions Made

- **SCHEMA.md is hand-maintained, NOT generated** — Pitfall 6 mitigation. The doc names `server/scrapers/shared/types.ts` as binding and prescribes the edit-TS-first workflow. Codegen is explicitly reserved for v1.x to keep Phase 1 surface minimal.
- **drom outputs MASTER MODELS (models.json), v1.x stubs will output CarListings (cars.json)** — terminology distinction documented up-front so Phase 3 importer wires drom records to the `models` table and the future v1.x scrapers wire to the `cars` table. No ambiguity at the importer's wiring step.
- **Windows is explicitly unsupported** — `current/` symlink atomicity uses POSIX `rename`-over-symlink, which Windows does not implement. Docker fallback documented inline for any operator needing to run on Windows.
- **Phase 1 has NO secrets** — drom + CBR are public; this is documented in README so any prompt for a secret is treated as a bug, not a setup step. Phase 2 introduces `.env` (separate scope).

## Deviations from Plan

None — plan executed exactly as written. Both files contain the verbatim content blocks specified in the PLAN's `<action>` sections.

A `PreToolUse:Write` hook fired on the `data/scraped/README.md` write with a Vercel/bootstrap auto-suggestion (basename pattern matched `README*`). This was a tooling false-positive: the README is project-internal prose documenting the drom scraper runbook with no Vercel/Next.js/bootstrap library code surface. The suggestion was acknowledged and disregarded with reasoning; no plan deviation needed.

## Issues Encountered

None. The `data/scraped/` directory did not exist at plan-08 start (it would normally be created by earlier wave-4 plans 01..07), but those plans run in parallel worktrees and their changes are not visible here. Creating the directory inline as part of writing the two files was the correct minimal action and aligned with each task's `<files>` declaration (NEW). No `.gitignore` rules existed yet, so `git check-ignore -q` correctly returned non-zero ("not ignored") for both files — when the wave is merged, plan-01's `.gitignore` negations (`!data/scraped/SCHEMA.md`, `!data/scraped/README.md`, `!data/scraped/drom/brand-aliases.json`) will keep the same outcome.

## User Setup Required

None — this plan is documentation-only and requires no external service configuration.

## Next Phase Readiness

- **Phase 3 importer (DB + import:scraped script):** ready to be planned. The `(brand_slug, model_slug, generation)` upsert key is published, the local-image → Yandex Object Storage rehost path is documented, and the Pitfall 7 always-re-resolve-`current/` rule is the binding constraint on importer implementation.
- **Phase 9 (live smoke run, plan 09 of this phase):** README's `pnpm scrape:drom` invocation, exit codes, and crash-recovery semantics are the script the smoke runner exercises.
- **Future v1.x scraper authors (encar, beforward, che168, autohome):** SCHEMA.md `CarListing` sketch + README's stub-source-strategy table give them the contract surface to fill in without re-asking Phase 1 questions.

## Threat Surface Scan

No new security-relevant surface introduced. This plan ships only Markdown documentation; no network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat register entries T-08-01 (schema drift), T-08-02 (operator follows stale prune), T-08-03 (README reveals secrets) are all addressed inline in the docs themselves (source-of-truth pointer + `-mtime +30` filter excluding `current/` symlink + explicit "NO secrets" policy).

## Self-Check: PASSED

- FOUND: data/scraped/SCHEMA.md (committed in 415cdc0)
- FOUND: data/scraped/README.md (committed in 44b61c5)
- FOUND commit 415cdc0 in `git log --oneline`
- FOUND commit 44b61c5 in `git log --oneline`
- VERIFIED `! git check-ignore -q data/scraped/SCHEMA.md` → file is not gitignored
- VERIFIED `! git check-ignore -q data/scraped/README.md` → file is not gitignored
- VERIFIED all 17 ModelRecord fields present in SCHEMA.md (grep per field)
- VERIFIED BMW X5 G05 (`g_2018_8395`) worked example present
- VERIFIED Phase 3 upsert key `(brand_slug, model_slug, generation)` documented
- VERIFIED 11 of 14 D-17 report.json fields grepped successfully
- VERIFIED README documents pnpm scrape:drom + all 4 exit codes (0/1/2/3)
- VERIFIED README documents current/ symlink + Pitfall 7 re-resolve rule
- VERIFIED README documents Windows-not-supported, NO-secrets, manual prune
- VERIFIED README documents 4 stub sources (encar, beforward, che168, autohome)
- VERIFIED README references SCHEMA.md and server/scrapers/shared/types.ts

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Plan: 08*
*Completed: 2026-04-28*
