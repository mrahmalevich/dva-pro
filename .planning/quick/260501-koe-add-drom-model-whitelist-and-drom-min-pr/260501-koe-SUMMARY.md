---
phase: quick
plan: 260501-koe
subsystem: server/scrapers/drom
tags: [scraper, drom, env-filter, operator-ux]
dependency_graph:
  requires: []
  provides: [DROM_MODEL_WHITELIST filter, DROM_MIN_PRODUCTION_YEAR filter]
  affects: [server/scrapers/drom/index.ts]
tech_stack:
  added: []
  patterns: [env-var filter mirroring DROM_BRAND_WHITELIST shape, year cutoff with null-retention semantics]
key_files:
  modified:
    - server/scrapers/drom/index.ts
    - server/tests/drom-integration.test.ts
    - data/scraped/README.md
decisions:
  - "Model whitelist applied BEFORE alphabetic sort + cursor index so cursor logic operates on post-filter list, mirroring exact brand-whitelist shape"
  - "Invalid DROM_MIN_PRODUCTION_YEAR logs warn and treats as unset (no throw) — operator typo resilience over fail-fast"
  - "year_to=null (still in production) always passes regardless of cutoff — semantic correctness over simplicity"
  - "continue inside gen-loop try block skips seen.set, models_added++, BMW per-comp, and hero image fetch atomically"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-29"
  tasks_completed: 1
  files_modified: 3
---

# Phase quick Plan 260501-koe: DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR Filters Summary

**One-liner:** Two new env-var filters for scoped drom re-runs: model-slug whitelist and minimum-production-year cutoff with null-retention semantics, composing AND with existing brand whitelist.

## What Was Built

Added two new operator-facing env-var filters to `server/scrapers/drom/index.ts`:

1. **`DROM_MODEL_WHITELIST`** — comma-separated model_slug list (lowercased, trim, filter-empty). Applied in the model loop AFTER `parseModelList` returns and BEFORE the alphabetic sort + cursor index lookup. Mirrors `DROM_BRAND_WHITELIST` parsing exactly.

2. **`DROM_MIN_PRODUCTION_YEAR`** — integer cutoff applied in the generation loop AFTER `parseGenerationPage` returns. Drop iff `year_to !== null && year_to < cutoff`. Keep iff `year_to === null` (in production, "н.в.") OR `year_to >= cutoff` (inclusive boundary). Invalid non-integer value logs a warning and is treated as unset — the run does not abort.

Both compose with AND semantics with the existing `DROM_BRAND_WHITELIST`. A startup log line summarises all three active filters before the scraping loop starts.

The cursor-drift throw message in the model loop was extended to name both `DROM_BRAND_WHITELIST/DROM_MODEL_WHITELIST` so operators can diagnose which filter excluded the cursored model.

## Commits

| Hash | Description |
|------|-------------|
| dbc9072 | feat(260501-koe): add DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR env-var filters |

## Tasks

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR filters with 3 integration tests | dbc9072 | Done |

## Verification Results

- `pnpm test` (via vitest): 164 tests passed (161 existing + 3 new)
- `pnpm typecheck:server`: 0 errors
- `grep -c "DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts`: 3 (parsing + filter + cursor-drift message)
- `grep -c "DROM_MIN_PRODUCTION_YEAR" server/scrapers/drom/index.ts`: 3 (parsing + warn path + filter)
- `grep -F "DROM_BRAND_WHITELIST/DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts`: present
- `data/scraped/README.md`: documents all three filters with 4 example invocations

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All three filters are fully wired in the orchestrator.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes. Purely orchestrator-level loop logic gated on env vars.

## Self-Check: PASSED

- server/scrapers/drom/index.ts: modified and committed (dbc9072)
- server/tests/drom-integration.test.ts: modified and committed (dbc9072)
- data/scraped/README.md: modified and committed (dbc9072)
- Commit dbc9072: confirmed in git log
- 164 tests green, 0 typecheck errors
