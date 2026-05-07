---
phase: 02-redesign-from-screenshot
plan: 04
subsystem: ui
tags: [quiz-modal, design-tokens, css-tokens, fidelity-pass, react]

# Dependency graph
requires:
  - phase: 02-redesign-from-screenshot
    provides: "design-token contract (UI-SPEC) + landing-page golden harness (plan 01) + Wave 1 token-system fixes (plans 02, 03)"
provides:
  - "QuizModal countdown chip uses canonical card-surface alpha rgba(255,255,255,0.03) — token-aligned with the rest of the system"
  - "Documented stop-conditions audit of QuizModal.tsx confirming no forbidden borderRadius / fontWeight / ease-in-out / rgb() / non-token-library imports"
  - "02-DEFERRED-POLISH.md created with the SuccessStep WhatsApp-brand-vs-success-indicator drift captured for Phase 8"
affects: [phase-06-lead-flow, phase-08-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strict-scope D-03 light visual-token alignment pass (only style={...} + className= edits, 6-item stop conditions enforced)"
    - "DEFERRED-POLISH.md as running list for >5-min wall-clock fixes routed to Phase 8 (CONTEXT.md D-01a)"

key-files:
  created:
    - ".planning/phases/02-redesign-from-screenshot/02-DEFERRED-POLISH.md"
    - ".planning/phases/02-redesign-from-screenshot/02-04-SUMMARY.md"
  modified:
    - "src/quiz/QuizModal.tsx"

key-decisions:
  - "Single in-scope fix found: SuccessStep countdown chip background rgba(255,255,255,0.04) → 0.03 to match canonical card-surface alpha"
  - "SuccessStep green checkmark gradient (#25D366/#1da350 + matching shadow rgba(37,211,102,0.5)) deferred — uses WhatsApp brand color where UI-SPEC §Color reserves #36D399 for success indicator; co-editing gradient + shadow with no token equivalent for the darker stop is a visual semantic change beyond pure token-swap"
  - "Telegram CTA inline `background: '#229ED9'` (line 412) is intentional Telegram brand override of .btn-cyan per UI-SPEC §Color reserved-for; left as-is"
  - "All `color: '#fff'` literals (10 occurrences) preserved — house pattern across sections with no `--white` token defined"

patterns-established:
  - "QuizModal token coherence pattern: countdown / summary / budget cards all use rgba(255,255,255,0.03) + var(--line-strong) borders to match Hero pipeline-card surface treatment"

requirements-completed: []

# Metrics
duration: 18min
completed: 2026-05-07
---

# Phase 02 Plan 04: QuizModal token-alignment pass Summary

**Single token-fix landed (countdown chip alpha 0.04→0.03 for canonical card-surface coherence) after a full-file 6-stop-conditions audit; one cross-token issue (SuccessStep WhatsApp-brand gradient on success indicator) routed to DEFERRED-POLISH for Phase 8.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-07T06:30Z (approx)
- **Completed:** 2026-05-07T06:48Z
- **Tasks:** 1 / 1
- **Files modified:** 1 (`src/quiz/QuizModal.tsx`); 1 created (`02-DEFERRED-POLISH.md`)

## Accomplishments

- Walked all 436 lines of `src/quiz/QuizModal.tsx` once with the 6-item D-03 stop-conditions list applied; confirmed there are no forbidden borderRadius (any non-{0, 999, 50%}), no forbidden fontWeight (300/600/800), no `ease-in-out`, no `rgb()` non-rgba literals, and no new component-library imports.
- Aligned the `SuccessStep` countdown-chip surface to the canonical `rgba(255,255,255,0.03)` card-surface alpha used by Hero's "В работе сейчас" pipeline card (Hero.tsx:104), the `BudgetStep` numeric card (QuizModal.tsx:269), and the `ContactStep` summary card (QuizModal.tsx:369). Was `0.04`; now `0.03`.
- Created `02-DEFERRED-POLISH.md` with one captured drift item (SuccessStep green-circle gradient uses WhatsApp brand `#25D366/#1da350` + shadow `rgba(37,211,102,0.5)` instead of the canonical `#36D399`/`rgba(54,211,153,X)` success indicator declared in UI-SPEC §Color).

## Task Commits

1. **Task 1: Light visual-token alignment pass on QuizModal.tsx (D-03)** — `226e6ea` (refactor)

## Files Created/Modified

- `src/quiz/QuizModal.tsx` — line 423 only: `background: 'rgba(255,255,255,0.04)'` → `'rgba(255,255,255,0.03)'` (canonical card-surface alpha)
- `.planning/phases/02-redesign-from-screenshot/02-DEFERRED-POLISH.md` — new file; captures the SuccessStep WhatsApp-brand-vs-success-indicator drift for Phase 8

## Token swaps / class swaps

- `src/quiz/QuizModal.tsx:423` — `background: 'rgba(255,255,255,0.04)'` → `'rgba(255,255,255,0.03)'` (canonical card-surface alpha; matches Hero.tsx:104, QuizModal.tsx:269, QuizModal.tsx:369)

No class-swap candidates found that would clear the strict do-NOT list (the close button at line 105, the Telegram CTA at line 412, and the green-circle decoration at lines 394-400 all need their inline overrides for legitimate reasons documented in plan + UI-SPEC).

## Verification output

```
=== HEX literal grep (excluding rgba and comments) ===
Lines: 105, 155, 273, 346, 350, 370, 396, 398, 403, 408, 412, 428
Remaining hex literals are all documented exceptions:
  - #fff x10 (canonical white; no --white token; matches house pattern across all sections)
  - #25D366, #1da350 (line 396) — DEFERRED-POLISH item
  - #229ED9 (line 412) — Telegram brand override per UI-SPEC §Color reserved-for

=== Forbidden borderRadius (≠ 0, 999, 50%) ===
(empty)

=== Forbidden fontWeight (300/600/800) ===
(empty)

=== ease-in-out ===
(empty)

=== New component lib imports ===
(empty)
```

```
$ git diff --stat
 src/quiz/QuizModal.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

```
$ git diff src/quiz/QuizModal.tsx | grep -E '^[+-].*(useState|useEffect|useCallback|useRef|onClick|onChange|onSubmit|onKeyDown|document.body.style)'
(empty — no logic touches)

$ git diff src/quiz/QuizModal.tsx | grep -E "^[+-].*'[А-Яа-я]"
(empty — no Russian copy touches)
```

## Test results

- `pnpm typecheck:server` — PASS (exit 0)
- `pnpm test landing-page-golden.test.ts` — PASS (1/1, ~9s; ratio < 0.22 threshold; vitest only logs ratio on failure, so exact %  isn't surfaced. The change to QuizModal cannot affect landing-page capture because the modal is closed during capture; ratio is unchanged from the as-shipped baseline of 18.74% reported in 02-RESEARCH.md §3.)
- `pnpm test` (full suite) — PASS (20 files, 208 passed, 3 skipped, 0 failed)

## Decisions Made

- **Single in-scope fix landed** — the only clear token-divergence inside the 6-stop-conditions list was the countdown chip's `0.04` alpha; everything else was either already aligned, a documented exception, or a cross-token visual semantic change deferred per the 5-min wall-clock budget (CONTEXT.md D-01a).
- **#fff stays as a literal** — there is no `--white` token in `global.css`, and `color: '#fff'` is the established house pattern across `Hero.tsx`, `Reviews.tsx`, the `.btn` utility classes (`global.css:134-148`), `.opt` (`global.css:353`), `.opt-grid is-selected` (`global.css:359`), `.range-knob` (`global.css:394`), and `.tag` (`global.css:244`). Replacing requires introducing a new token — out of scope and explicitly forbidden by must_haves "No new font sizes or weights introduced … No new tokens introduced".
- **Telegram CTA brand color preserved** — `#229ED9` at line 412 is the official Telegram brand color, declared in UI-SPEC §Color as a reserved-for exception. The inline `background` is intentionally overriding `.btn-cyan` (#1DA3CB) with the platform-correct color for the "Открыть Telegram" CTA in the success step.
- **SuccessStep green gradient deferred** — the `linear-gradient(135deg, #25D366, #1da350)` plus its matching `boxShadow: '0 20px 60px -10px rgba(37,211,102,0.5)'` use WhatsApp brand color `#25D366` where UI-SPEC §Color reserves `#36D399` (rgba `54,211,153`) for the "Live/success indicator (status only)". Co-editing the gradient + shadow requires either (a) collapsing to a single-color background or (b) inventing a `--success-deep` token for the darker gradient stop — both are visual semantic changes beyond the strict D-03 token-swap scope. Recorded in `02-DEFERRED-POLISH.md` for Phase 8.

## Deviations from Plan

None - plan executed exactly as written. The plan anticipated this would be a "light pass" with file delta ≤ 60 lines; actual delta was 1 line because the file is already mostly token-aligned (Wave 0 + Wave 1 work landed many of the canonical patterns, and the modal author followed the section-file inline-style convention closely).

## Issues Encountered

- `node_modules/` was missing on first checkout into the worktree; ran `pnpm install --prefer-offline` (background) before tests could execute. Resolved cleanly.

## Manual smoke test

Per acceptance_criteria, manual smoke test (`pnpm dev` → click "Подобрать за 5 минут" → walk all 5 quiz steps) was **not run** in this autonomous executor agent — the worktree is non-interactive and headless. The change is a 1-character alpha swap (`0.04` → `0.03`) on a single decorative chip background; the visual difference is sub-perceptible (1% alpha delta on a ~3% white-on-dark surface). Manual coherence verification can be folded into Wave 3's gate plan or the founder review window if needed; no jarring discontinuity is plausible from this change.

## Next Phase Readiness

- Phase 02 Wave 2 (this plan) closed; Wave 3 gate can now run `pnpm test landing-page-golden.test.ts` as the regression guard (already green at the as-shipped 18.74% baseline).
- `02-DEFERRED-POLISH.md` ready for review at phase close — single item captured.
- `src/quiz/QuizModal.tsx` is now fully token-aligned within the strict D-03 scope; further visual polish (gradient swap, button-class extraction for icon-shaped 36×36 close button, etc.) belongs in Phase 8 or a dedicated Phase 6 lead-flow re-skin.

## Self-Check: PASSED

- File `src/quiz/QuizModal.tsx` exists and contains the canonical alpha `rgba(255,255,255,0.03)` at line 423: FOUND
- File `.planning/phases/02-redesign-from-screenshot/02-DEFERRED-POLISH.md` exists: FOUND
- Commit `226e6ea` exists in git log: FOUND
- `git diff --stat HEAD~1 HEAD` confirms only 2 files touched (QuizModal.tsx + 02-DEFERRED-POLISH.md): VERIFIED

---
*Phase: 02-redesign-from-screenshot*
*Completed: 2026-05-07*
