---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 12
subsystem: infra
tags: [scraper, drom, cursor, resume-contract, CR-04, gap-closure, docs]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: |
      plan 01-07 (drom orchestrator), plan 01-10 (sort-before-compare cursor
      semantics + missing-brand throw), d3bad88 (inheritFromPrevCurrent
      snapshot path that preserves prior brands' records and images across
      runs — the precondition that makes the "re-scrape cursored brand from
      scratch" remedy data-safe)
provides:
  - "CR-04 contract enforcement: when the cursor points at this brand, startFromModelIndex pinned to 0 — the cursored brand is re-scraped from scratch on resume"
  - "data/scraped/README.md §'Crash recovery (D-15)' rewritten to match the actual code contract; the misleading 'resume from the next model after lastModelSlug' claim removed"
  - "Source-level CR-04 contract test (server/tests/drom-cr04-contract.test.ts) that locks the pin against future maintainer regression"
affects: [01-13, 01-VERIFICATION, 01-REVIEW]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-code contract test: lock a single-line invariant (here, `startFromModelIndex = 0` inside the cursor branch) at the file-text level so a future maintainer cannot silently un-pin it. Used when an integration test that exercises the same invariant is owned by a sibling plan (here, 01-13)."
    - "Resume contract documented operator-side as 're-scrapes the cursored brand from scratch' — the literal phrase appears verbatim in both the README (operator-facing) and the orchestrator comment (maintainer-facing) so search/grep finds the same contract from either side."

key-files:
  created:
    - "server/tests/drom-cr04-contract.test.ts — 5-test contract suite (RED→GREEN companion to plan 01-13's resume integration test)"
  modified:
    - "server/scrapers/drom/index.ts — model-cursor branch: `startFromModelIndex = idx` → `startFromModelIndex = 0` (CR-04 pin) + rewritten comment block"
    - "data/scraped/README.md — §'Crash recovery (D-15)' rewritten as a 6-bullet contract"

key-decisions:
  - "Adopt the smaller-of-two CR-04 remedies recommended in 01-REVIEW.md: document and enforce 're-scrape cursored brand from scratch' instead of persisting brandModels/records to disk after every model. Rationale: the d3bad88 snapshot path already preserves prior brands' records and images across runs, so re-scraping only the cursored brand is data-safe; per-model checkpoint persistence would be heavier I/O for diminishing returns."
  - "Retain the defensive throw on `cursor.lastModelSlug` not present in the brand's sorted model list (plan 10's CR-02 fix) even though it no longer drives positioning. It surfaces cursor drift to the operator and is therefore a useful signal independent of the new pinning behavior."
  - "TDD shape: source-code contract test (RED→GREEN at file-text level) instead of a resume integration test, because plan 01-13 explicitly owns the resume-path integration coverage. Adding heavyweight resume integration here would step on plan 13's scope."
  - "Reconcile a plan-internal inconsistency between the prescribed Markdown (§'Crash recovery' uses 're-scraped from scratch') and the verifier (`grep -c 're-scrapes the cursored brand from scratch'`). Added a leading sentence using the exact verifier string so both human reading and automated verification pass without changing the substance of the prescribed numbered list."

patterns-established:
  - "Contract tagging in code comments: every CR-NN remedy carries a 'CR-NN contract' marker in the comment so future maintainers searching for the original review item can find both the bug and the fix."
  - "Operator-side contract documentation: README §'Crash recovery' enumerates contract numbered (1–6) so each clause can be referenced by index in future bug reports."

requirements-completed: [SCRAPE-05]

# Metrics
duration: 4m44s
completed: 2026-04-29
---

# Phase 01 Plan 12: CR-04 contract — re-scrape cursored brand from scratch Summary

**Pinned `startFromModelIndex = 0` for the cursored brand in the drom orchestrator and rewrote `data/scraped/README.md` §"Crash recovery" to match the actual code contract — closing the CR-04 data-loss window from 01-REVIEW.md without per-model checkpoint persistence.**

## Performance

- **Duration:** 4m44s
- **Started:** 2026-04-29T07:18:22Z
- **Completed:** 2026-04-29T07:23:06Z
- **Tasks:** 2 (1 TDD)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **CR-04 contract enforced in code.** When `cursor` is set and the loop reaches the brand whose `brand_slug === cursor.lastBrandSlug`, `startFromModelIndex = 0` regardless of `cursor.lastModelSlug`. Partial brand-aliases entries written before a mid-brand crash are reconstructed because the brand is fully re-scraped and `mergeAliases` runs at end-of-brand on the complete set. Records and images from OTHER brands are preserved by `inheritFromPrevCurrent` (d3bad88), so re-scraping only the cursored brand is data-safe.
- **README §"Crash recovery" rewritten** to honestly describe the resume contract delivered by plans 01-10 / 01-11 / 01-12. The misleading "resume from the next model after `lastModelSlug`" claim is gone; the new 6-bullet contract names `inheritFromPrevCurrent`, the `CorruptCursorError` exit, and the missing-brand abort.
- **Source-level CR-04 contract test added** (`server/tests/drom-cr04-contract.test.ts`, 5 tests) that locks the pin and the absence of the legacy `startFromModelIndex = idx` assignment at the file-text level. Plan 01-13 will add the resume integration test that exercises this contract end-to-end.
- **Defensive cursor-drift throw retained.** The plan-10 throw-on-missing-`lastModelSlug` shape check is preserved as an operator signal even though it no longer drives positioning.

## Task Commits

1. **Task 1 RED: Failing CR-04 contract test** — `723a815` (`test`)
2. **Task 1 GREEN: Pin `startFromModelIndex = 0` for cursored brand** — `97d99b8` (`feat`)
3. **Task 2: Rewrite README §"Crash recovery"** — `3249c87` (`docs`)

_Note: Task 1 followed TDD RED→GREEN; no REFACTOR commit needed (the change is a one-line assignment swap + comment rewrite, no further cleanup necessary)._

## Files Created/Modified

- `server/tests/drom-cr04-contract.test.ts` (created, 63 lines) — 5-test contract suite asserting (a) the `CR-04 contract` comment marker is present, (b) the `re-scrape` wording is present, (c) the legacy `startFromModelIndex = idx` assignment is gone, (d) the `Cursor.lastModelSlug=` throw is preserved, (e) the cursor-branch tail contains `startFromModelIndex = 0;`.
- `server/scrapers/drom/index.ts` (modified, +14/-6 lines around the model-cursor block) — replaced `startFromModelIndex = idx` with `startFromModelIndex = 0` and rewrote the surrounding comment to name the CR-04 contract, the `inheritFromPrevCurrent` precondition, and the rationale for retaining the defensive throw.
- `data/scraped/README.md` (modified, +11/-5 lines around §"Crash recovery") — rewrote the section as a 6-bullet contract with `inheritFromPrevCurrent`, `CorruptCursorError`, and missing-brand abort references; added the literal phrase "re-scrapes the cursored brand from scratch" to lock the contract for grep-based verifiers.

## Exact Diff Snippet — orchestrator model-cursor branch

```ts
// BEFORE (post plan 01-10):
        // Resume: if cursor is on this brand, position at lastModelSlug
        // (inclusive — the cursored model is included so it is re-scraped, per
        // the CR-04 "re-scrape cursored brand" contract documented and pinned
        // by sibling plan 01-12). Throw loudly when the cursored model is
        // absent from the current brand (CR-02 fix per 01-REVIEW.md).
        let startFromModelIndex = 0;
        if (cursor && brand.brand_slug === cursor.lastBrandSlug) {
          const idx = models.findIndex((m) => m.model_slug >= cursor.lastModelSlug);
          if (idx === -1) {
            throw new Error(...);
          }
          startFromModelIndex = idx;          // ← removed
        }

// AFTER (plan 01-12):
        // Resume contract (CR-04 enforcement, plan 01-12):
        //   When the cursor points at this brand, the brand is re-scraped from
        //   scratch — startFromModelIndex pinned to 0 — so partial brand-alias
        //   entries written before the mid-brand crash are reconstructed when
        //   mergeAliases runs at the end of the brand. Records and images
        //   from OTHER brands are preserved by inheritFromPrevCurrent above
        //   (d3bad88), so re-scraping only the cursored brand is data-safe.
        //
        //   The defensive shape check below remains: if the cursor file
        //   references a model that has vanished, surface cursor drift to the
        //   operator even though we will be re-scraping the brand fresh.
        let startFromModelIndex = 0;
        if (cursor && brand.brand_slug === cursor.lastBrandSlug) {
          const idx = models.findIndex((m) => m.model_slug >= cursor.lastModelSlug);
          if (idx === -1) {
            throw new Error(...);
          }
          // CR-04 contract: ignore idx for positioning — re-scrape from index 0.
          // The found-or-throw check above is preserved as a cursor-drift signal.
          startFromModelIndex = 0;            // ← new pin
        }
```

The only structural change is the final assignment: `startFromModelIndex = idx` → `startFromModelIndex = 0`.

## New §"Crash recovery" Markdown text

```markdown
### Crash recovery (D-15) — resume contract

If a `pnpm scrape:drom` run dies mid-brand, the next invocation reads `.cursor.json` and **re-scrapes the cursored brand from scratch** while preserving the prior successful run's data verbatim. The full contract:

1. **Prior brands are preserved verbatim** — `inheritFromPrevCurrent` copies records and images from the previous successful `current/` snapshot into the new run dir before scraping starts. Brands that completed before the crash do NOT need to be re-fetched.
2. **The cursored brand is re-scraped from scratch** — when the loop reaches the brand `cursor.lastBrandSlug`, `startFromModelIndex = 0`. Partial brand-aliases entries from the aborted brand are reconstructed because the brand is fully re-scraped and `mergeAliases` runs at end-of-brand on the complete set. Worst case: ~1 brand's worth of pages re-fetched (~7 hours at 10 s/req × ~30 pages/model × ~50 models for a brand-heavy entry like Toyota; smaller brands recover in minutes).
3. **Brands lexicographically after the cursored brand are scraped fresh** — they were never reached in the aborted run.
4. **A corrupt or hand-edited `.cursor.json` aborts the run loudly** — `readCursor` (post plan 01-11) distinguishes "file absent" (fresh start) from "file present but malformed" (`CorruptCursorError`, exit 1). Delete the file explicitly to start a fresh run after corruption.
5. **A `cursor.lastBrandSlug` no longer present in the catalog aborts the run** — `Cursor.lastBrandSlug='X' not present in current brand list` (plan 01-10). Either re-run without `--resume` semantics (delete `.cursor.json`) or correct the brand list (e.g. unset `DROM_BRAND_WHITELIST`).
6. **On clean completion `.cursor.json` is deleted.**

The brand-boundary granularity is a deliberate Phase 1 trade-off documented in `01-REVIEW.md` (CR-04). Finer-grained cursors (per-model checkpoint persistence) are a Phase 1.x candidate; the snapshot path makes the trade-off acceptable for v1 because no records are permanently lost — only the cursored brand's pages are re-fetched.
```

## Decisions Made

- **Adopted the smaller-of-two CR-04 remedies.** 01-REVIEW.md offered two options: (a) document and enforce "re-scrape cursored brand from scratch" with `startFromModelIndex = 0`, or (b) persist `brandModels`/`records[]`/`report` to disk after every model and rehydrate on resume. Option (a) is correct now that `inheritFromPrevCurrent` (d3bad88) preserves prior brands' records and images across runs — re-scraping only the cursored brand is data-safe and avoids the heavier I/O of per-model checkpointing. The brand-boundary granularity is a deliberate Phase 1 trade-off (worst case ~1 brand's pages re-fetched on resume).
- **Retained the defensive throw on missing `lastModelSlug`.** Plan 10 added the throw to surface cursor drift; CR-04 forces `startFromModelIndex = 0` regardless of `idx`, so the throw no longer affects positioning. Kept it anyway — a stale cursor referencing a model that has vanished is a useful operator signal even when the brand will be re-scraped fresh.
- **TDD shape: source-code contract test, not resume integration test.** Plan 01-13 explicitly owns the resume-path integration coverage. To avoid stepping on plan 13, this plan's TDD RED test asserts the contract at the file-text level (5 grep-style assertions on `server/scrapers/drom/index.ts`). The test fails before the change (3 of 5 fail) and passes after — a valid RED→GREEN cycle that locks the contract without overlapping plan 13's scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing node_modules**
- **Found during:** Task 1 RED verification (vitest not found)
- **Issue:** Worktree had `package.json` but no `node_modules` directory; `pnpm test` failed with "vitest not found".
- **Fix:** `pnpm install --frozen-lockfile`.
- **Files modified:** None tracked (only `node_modules/`, which is gitignored).
- **Verification:** `pnpm test` runs successfully; full 95-test suite passes.
- **Committed in:** N/A (install only, no source changes).

**2. [Rule 1 - Bug, plan-internal inconsistency] README literal-phrase reconciliation**
- **Found during:** Task 2 verification (initial `grep -c 're-scrapes the cursored brand from scratch'` returned 0).
- **Issue:** The plan's `<verify>` block requires the literal string `re-scrapes the cursored brand from scratch` (verb form "re-scrapes"), but the prescribed Markdown text in `<action>` Step 2 used "re-scraped from scratch" (past participle). The two are semantically identical but the verifier is text-exact.
- **Fix:** Added a leading summary sentence to the new §"Crash recovery" using the exact verifier-required phrase ("…reads `.cursor.json` and **re-scrapes the cursored brand from scratch** while preserving the prior successful run's data verbatim. The full contract:"). Kept the prescribed numbered list verbatim. The contract substance is unchanged; only one extra sentence was added.
- **Files modified:** `data/scraped/README.md`
- **Verification:** `grep -c 're-scrapes the cursored brand from scratch' data/scraped/README.md` returns 1 (must == 1). All other Task 2 acceptance criteria still pass.
- **Committed in:** `3249c87` (Task 2 commit).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 plan-internal inconsistency reconciled).
**Impact on plan:** Both auto-fixes were necessary to complete the plan as specified. No scope creep — the README addition is a single sentence that locks the verifier's exact phrase.

## Issues Encountered

- **Worktree base mismatch on agent startup.** The worktree's HEAD was the initial commit `fdcd105`, not the expected base `92af791`. Resolved per the `<worktree_branch_check>` protocol via `git reset --hard 92af79141e58e0c6b5632ec1ca57412ab340eb15`. Verified `git rev-parse HEAD` matches expected base before proceeding.
- **Vercel-plugin Read hook flagged README as a "bootstrap" pattern.** The plugin tried to redirect to Vercel/Next.js docs; ignored per CLAUDE.md ("The Vercel-plugin auto-suggestion in this environment is a tooling artifact, not a project signal" — this project is React+Vite+Hono, not Next.js, and the README in question is for the scraper data directory).

## Cross-plan note

**Plan 01-13** (resume-path integration test, sibling plan in this same wave/cycle) will:
1. Seed `.cursor.json` and a prior `current/` snapshot before invoking the orchestrator.
2. Assert that brands NOT in the cursored set are present verbatim from the inherited snapshot.
3. Assert that the cursored brand is re-scraped from scratch (every model in the brand is re-fetched, regardless of `cursor.lastModelSlug`).
4. Assert that a corrupt cursor (post plan 01-11) throws and exits with code 1.

The source-level contract test added by this plan (`server/tests/drom-cr04-contract.test.ts`) is plan 13's safety net: if a future maintainer un-pins the assignment, the contract test fails before the integration test even has a chance to run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **CR-04 closed.** The data-loss window described in 01-REVIEW.md (lines 222–258) is documented and bounded to the cursored brand only; on resume the brand is re-scraped fresh and brand-aliases are reconstructed.
- **README operator contract is truthful.** Operators reading §"Crash recovery" now see the actual code contract delivered by plans 01-10 / 01-11 / 01-12, not the obsolete model-level-resume claim.
- **Plan 01-13 unblocked.** The resume integration test plan 13 is about to author can rely on the pinned `startFromModelIndex = 0` contract being stable (locked at the file-text level by `drom-cr04-contract.test.ts`).
- **No new blockers introduced.** Full vitest suite passes (95/95); `pnpm typecheck:server` exits 0.

## Self-Check: PASSED

**Files:**
- `server/tests/drom-cr04-contract.test.ts` — FOUND
- `server/scrapers/drom/index.ts` (modified) — FOUND
- `data/scraped/README.md` (modified) — FOUND

**Commits:**
- `723a815` (Task 1 RED) — FOUND
- `97d99b8` (Task 1 GREEN) — FOUND
- `3249c87` (Task 2 docs) — FOUND

**Plan-level verification block (lines 299–308):**
- 1. `grep -c 'CR-04 contract' server/scrapers/drom/index.ts` >= 1 → 1 ✓
- 2. `grep -nE 'startFromModelIndex\s*=\s*idx' server/scrapers/drom/index.ts` returns no matches → 0 ✓
- 3. `grep -c "re-scrapes the cursored brand from scratch" data/scraped/README.md` == 1 → 1 ✓
- 4. `grep -c 'resume from the next model after' data/scraped/README.md` == 0 → 0 ✓
- 5. `pnpm tsc -p tsconfig.server.json --noEmit` exits 0 → exit 0 ✓
- 6. `pnpm vitest run` exits 0 (95/95 tests pass) → exit 0 ✓

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Completed: 2026-04-29*
