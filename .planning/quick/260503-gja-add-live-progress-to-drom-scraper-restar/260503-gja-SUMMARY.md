---
phase: quick/260503-gja
plan: 01
subsystem: scraping/drom
tags: [drom, observability, live-progress, bmw-pilot]
requires:
  - server/scrapers/shared/atomic-write.ts (atomicWriteFile)
  - server/scrapers/shared/types.ts (ModelRecord, ReportSummary)
provides:
  - server/scrapers/drom/index.ts::snapshotModelsJson()
  - "[drom]"-prefixed per-loop progress logs (brand/model/gen/comp/image/per-model)
affects:
  - data/scraped/drom/<runId>/models.json (now written incrementally during runs)
  - data/scraped/drom/smoke.log (verbose progress output)
tech-stack:
  added: []
  patterns:
    - best-effort live snapshots wrapped in .catch() (non-fatal failure mode)
    - per-loop console.log w/ // eslint-disable-next-line no-console pragma
key-files:
  created: []
  modified:
    - server/scrapers/drom/index.ts (+70 / -0)
  deleted:
    - data/scraped/drom/2026-04-28T14-31-09Z/index.html (state wipe; rest of dir + 3 sibling untracked dirs + current/ symlink + .cursor.json removed off-history via rm -rf)
decisions:
  - Snapshot writes are best-effort (.catch swallows + pushes to report.errors kind:'orchestrator'). End-of-run write at line ~744 remains authoritative.
  - "[drom]" log prefix + // eslint-disable-next-line no-console pragma matches existing style at lines 322 and 439-441.
  - Per-model summary uses report.models_added/updated deltas captured at model-loop entry + a per-model perModelComplectations counter incremented after record.complectations.push(comp).
metrics:
  duration: 5m38s
  completed: "2026-05-03T05:06:42Z"
  tasks_total: 2
  tasks_completed: 2
  files_modified: 1
  lines_added: 70
  lines_deleted: 0 (additive only in code; +396 deletions in wipe commit are stale tracked WebPs/index.html)
---

# Quick Task 260503-gja: Add live progress to drom scraper + restart Summary

**One-liner:** Wired in-loop `models.json` snapshots + nine `[drom]`-prefixed
per-loop console logs to the drom orchestrator so multi-hour BMW X5 runs are
no longer black boxes; wiped stale scrape state and kicked off a fresh
backgrounded BMW/X5 run that survives worktree teardown.

## Tasks

| # | Task                                                                          | Commit    | Files                                                                  |
| - | ----------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 1 | Add live progress (snapshot helper + 2 snapshot calls + 9 log sites)          | `0de3753` | `server/scrapers/drom/index.ts` (+70, -0)                              |
| 2 | Wipe drom scrape state and kick off backgrounded BMW X5-only restart          | `790278a` | `data/scraped/drom/2026-04-28T14-31-09Z/` (tracked `index.html` + untracked WebPs, JSON; sibling dirs + symlink + cursor wiped off-history) |

## What was built

**Code (Task 1):**
- New `snapshotModelsJson(runDir, seen)` helper inserted between
  `inheritFromPrevCurrent` (~line 179) and `emptyReport` (~line 200). Writes
  `[...seen.values()]` to `<runDir>/models.json` via `atomicWriteFile`.
- Two best-effort call sites: gen loop (after `seen.set(key, record)`) and
  per-complectation loop (after `record.complectations.push(comp)`). Both
  wrapped in `.catch(snapErr => …)` that logs and pushes to
  `report.errors` (kind:`'orchestrator'`) without aborting.
- Nine new `[drom]`-prefixed `console.log` statements:
  1. **Brand start:** `[drom] brand {bi+1}/{n}: {brand_slug}`
  2. **Model start:** `[drom]   model {mi+1}/{n}: {model_slug}`
  3. **Gen start:** `[drom]     gen {generation_id} ({i+1}/{n})`
  4. **Comp start:** `[drom]       comp {ci+1}/{n}: {comp_id}`
  5. **Image: skipped (inherited)** — for the `existsSync(heroAbs)` branch
  6. **Image: downloaded** — for the success branch
  7. **Image: FAILED** — for the catch-block branch (includes error message)
  8. **Image: skipped (no source)** — for the no-`hero_image_url` branch
  9. **Per-model summary** — `done {model_slug}: {N} added, {N} updated, {N} complectations`
- Per-model deltas computed by capturing
  `startModelsAdded = report.models_added` and
  `startModelsUpdated = report.models_updated` at the top of the model-loop
  body, plus an inline `perModelComplectations` counter incremented after
  the per-comp snapshot.
- Diff is purely additive: 70 insertions, 0 deletions. No existing logic
  moved or weakened. `pnpm typecheck:server` exits 0.

**State (Task 2):**
- `data/scraped/drom/` wiped to `brand-aliases.json` + `smoke.log` only (then
  immediately repopulated with the new run dir by the kicked-off scraper).
- Scraper kicked off in detached background via `nohup … &; disown` from the
  original repo path (NOT the worktree) so the process survives worktree
  teardown by the orchestrator merge step:
  ```bash
  cd /Users/mikhailra/Developer/dva.pro
  nohup env DROM_BRAND_WHITELIST=bmw DROM_MODEL_WHITELIST=x5 \
    pnpm scrape:drom > data/scraped/drom/smoke.log 2>&1 &
  disown
  ```

## Run dir captured

**runId:** `2026-05-03T05-05-16Z`
**Full path:** `data/scraped/drom/2026-05-03T05-05-16Z/`
**PIDs (at SUMMARY-write time, will change):** 59447 (pnpm wrapper), 59453 (tsx loader), 59609+ (per-image worker children — vary)

## Operator watch commands

Substitute `<runId>` with `2026-05-03T05-05-16Z`:

```bash
# Live console output (filter for [drom] tag)
tail -f /Users/mikhailra/Developer/dva.pro/data/scraped/drom/smoke.log

# Live model accumulation count (refresh every 5s)
watch -n 5 'jq "length" /Users/mikhailra/Developer/dva.pro/data/scraped/drom/2026-05-03T05-05-16Z/models.json 2>/dev/null'

# Live last-record peek (which generation was just snapshotted)
watch -n 5 'jq ".[-1] | {brand_slug, model_slug, generation, complectations: (.complectations | length)}" /Users/mikhailra/Developer/dva.pro/data/scraped/drom/2026-05-03T05-05-16Z/models.json 2>/dev/null'

# Process aliveness check (the old "tsx server/scrapers" pgrep pattern is stale for tsx 4.x — use this instead)
pgrep -af 'server/scrapers/cli.ts drom' | grep -v Claude
```

## Verification (end-of-plan checks)

| # | Check                                  | Result                                                                                |
| - | -------------------------------------- | ------------------------------------------------------------------------------------- |
| 1 | Code change committed                  | ✅ `feat(260503-gja): add live progress snapshots + per-loop logs to drom orchestrator` |
| 2 | Wipe committed                         | ✅ `chore(260503-gja): wipe drom scrape state for BMW X5 restart`                       |
| 3 | `pnpm typecheck:server` exits 0        | ✅ exit 0, no output                                                                    |
| 4 | Scraper running                        | ✅ pids 59447 + 59453 present (+ ephemeral child workers)                               |
| 5 | Smoke log shows filters                | ✅ `[drom] filters: brands=[bmw], models=[x5], minYearTo=none` confirmed                |
| 6 | Drom dir shape (brand-aliases + smoke.log + ONE new 2026-05-* run dir) | ✅ confirmed: 3 entries match (`brand-aliases.json`, `smoke.log`, `2026-05-03T05-05-16Z/`) |
| 7 | Live snapshot working                  | ✅ `models.json` length=1 after first generation; comp logs firing                       |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Residual untracked content in `2026-04-28T14-31-09Z/` after `git rm -r`**
- **Found during:** Task 2 step 4 (verify wipe).
- **Issue:** Plan step 2 (`git rm -r data/scraped/drom/2026-04-28T14-31-09Z`) only removed the tracked `index.html` from that dir. The dir also contained ~78 untracked WebP images + `models.json` + `report.json` (left over from a prior run that wrote them after the index was committed). `rm` does not delete a non-empty dir, and `git rm` does not touch untracked files, so the dir survived step 3 of the plan.
- **Fix:** `rm -rf data/scraped/drom/2026-04-28T14-31-09Z` after step 3 to remove the residual untracked content. Same operation the plan uses on the other three sibling dirs in step 3, just applied to one more dir.
- **Files modified:** none in git (untracked content); `index.html` deletion already captured in commit `790278a`.
- **Commit:** `790278a` (the wipe commit; cleanup done before the commit so the commit accurately reflects "drom dir is empty post-wipe except brand-aliases.json + smoke.log").

**2. [Rule 1 - Doc bug] Plan's verify regex `^(brand-aliases\.json|smoke\.log|2026-05-)$` mismatches dir names**
- **Found during:** Task 2 verification check 6.
- **Issue:** The verify command `ls data/scraped/drom/ | grep -cE '^(...|2026-05-)$' | grep -E '^[2-9]$'` requires the matched line to END with `2026-05-`, but real run-dir names end in `Z` (e.g. `2026-05-03T05-05-16Z`). The regex would never match a real run dir, so the count would always be 2 (only `brand-aliases.json` + `smoke.log`).
- **Fix:** Re-ran with the corrected regex `^(brand-aliases\.json|smoke\.log|2026-05-.*Z)$` which returns the expected 3. State on disk matches plan's intent.
- **Action for future plans:** When writing dir-pattern verify regexes, anchor with `2026-05-.*Z` (or just `2026-05-`) without trailing `$`.

### Auth Gates

None.

## Process / surface notes

- The new pgrep pattern `server/scrapers/cli.ts drom` works for tsx 4.x; the
  plan's older `tsx server/scrapers/cli.ts` pattern does NOT (tsx 4.x splits
  the wrapper from the node child via `--require` + `--import`, so neither
  process command line contains the literal `tsx server/scrapers` substring).
- The scraper was launched from the ORIGINAL repo (`/Users/mikhailra/Developer/dva.pro`),
  NOT from the worktree, with `nohup` + `disown` so the orchestrator's
  worktree merge + teardown step does not kill the process. Output writes
  to the original repo's `data/scraped/drom/smoke.log` and run dir, so the
  operator's watch commands above continue to work after merge.
- The pre-existing modification to `data/scraped/drom/brand-aliases.json`
  (visible in `git status` at session start) was deliberately untouched
  per plan constraints. It will need a separate commit by the user (or a
  future quick task) to be cleaned up.
- The untracked `.claude/` directory in the worktree is similarly untouched.

## Self-Check: PASSED

- `server/scrapers/drom/index.ts` exists and contains 11 `console.log` calls (2 pre-existing `[drom]` + 9 new). FOUND.
- Snapshot helper `async function snapshotModelsJson` defined at line ~190. FOUND.
- Two `await snapshotModelsJson(runDir, seen).catch(...)` call sites at lines ~483 (gen loop) and ~591 (per-comp loop). FOUND.
- Commit `0de3753`: `feat(260503-gja): add live progress snapshots + per-loop logs to drom orchestrator`. FOUND in `git log`.
- Commit `790278a`: `chore(260503-gja): wipe drom scrape state for BMW X5 restart`. FOUND in `git log`.
- Run dir `data/scraped/drom/2026-05-03T05-05-16Z/` exists with non-empty `models.json`. FOUND.
- Scraper process pid 59453 still running (tsx loader). FOUND.
- `pnpm typecheck:server` exit 0. PASSED.
