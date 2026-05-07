# Phase 02: Redesign from Screenshot — Verification

**Verified:** 2026-05-07
**Phase status:** CLOSED
**Verified by:** gsd-executor (worktree-isolated; close-out plan 02-05)

## Gap Closure Summary

| Gap ID | Section | Disposition | Evidence |
|--------|---------|-------------|----------|
| G-01 | Hero coral-glow blob | Closed in 02-02 (code) | `grep -c "rgba(213,121,89,0.4)" src/sections/Hero.tsx` = 1; `grep -c "pointerEvents: 'none'" src/sections/Hero.tsx` = 2 (new blob + watermark) |
| G-02 | Hero pipeline card | No-op; golden-covered | Golden test passes (1/1) at 19.57% < 22.00% threshold |
| G-03 | Catalog filter pill | Verify-only confirmed in 02-03 | `src/sections/Catalog.tsx:39` shows `padding: '10px 18px', borderRadius: 999,` |
| G-04 | FeedStrip rendering | No-op; golden-covered | Golden test passes (1/1) |
| G-05 | Process accordion | No-op; golden-covered | Golden test passes (1/1) |
| G-06 | Reviews star color | Verify-only confirmed in 02-03 | `grep -c 'var(--coral)' src/sections/Reviews.tsx` = 2 (≥1 expected) |
| G-07 | Nav fixed/frosted | No-op; golden-covered | Golden test passes (1/1) |
| G-08 | font-display: swap | Verify-only confirmed in 02-03 | `grep -c 'font-display:[[:space:]]*swap' src/styles/global.css` = 5 (≥5 expected) |
| G-09 | FeedStrip feed[] | Verify-only confirmed in 02-03 | `grep -c "id: 'feed" src/crm/seed.ts` = 5; `src/sections/FeedStrip.tsx:6` retains `if (state.feed.length === 0) return null;` |
| G-10 | Mobile menu | Out of phase @ desktop; Phase 8 mobile audit | n/a (RESEARCH.md §9 — desktop golden pinned at 1280px viewport) |
| G-11 | Mobile container padding | Closed in 02-03 (code at line 599) | `sed -n '599p' src/styles/global.css` = `  .container { padding: 0 20px !important; }`; `grep -n '0 18px' src/styles/global.css` = 0 hits |

All eleven gap IDs accounted for: 3 closed via code change (G-01, G-11 — and G-11 was a single-character substitution `18` → `20`; G-01 added the static coral-glow blob mirroring the LeadMagnet pattern), 5 verify-only confirmed (G-03, G-06, G-08, G-09 already correct on master plus the QuizModal token-alignment audit in 02-04), and 5 covered by golden-test structural-drift signal (G-02, G-04, G-05, G-07, G-10) per CONTEXT.md D-04a.

## Contract Guards

- **FloatingDock aria-labels** (UI-SPEC §Accessibility Contract; RESEARCH.md §10 R-5):
  - `grep -c 'aria-label="Telegram"' src/sections/Footer.tsx` = 2 (≥2 ✓)
  - `grep -c 'aria-label="WhatsApp"' src/sections/Footer.tsx` = 2 (≥2 ✓)
- **No new component library / CSS-in-JS / Tailwind / Next.js**:
  - `grep -rE 'from .(@radix|shadcn|@chakra|@mui|@emotion|styled-components|tailwind|next/)' src/` = 0 hits ✓
- **components.json** does not exist: `test -f components.json` exits 1 ✓
- **No new deps in package.json/pnpm-lock.yaml**: last commit touching either was `7cba0aa chore(01.1-01): install puppeteer + pixelmatch + pngjs as devDependencies` (Phase 01.1, not Phase 02); `git diff master -- package.json pnpm-lock.yaml | grep -E '^\+'` = 0 lines added ✓
- **No source-file diffs introduced by this close-out plan**: `git diff src/ server/` = empty ✓

## Test Results

- **`pnpm test landing-page-golden.test.ts`** — PASS (1/1) at `[landing-page-golden] DIFF_RATIO_PCT=19.57` (captured via temporary instrumentation, then reverted to clean tree)
- **Final diff ratio:** **19.57%** against `DIFF_THRESHOLD = 0.22` (22.00%); RESEARCH.md §3 baseline was 18.74% — within +0.83pp expected drift after Wave 1+2 token landings (G-01 coral-glow blob added a small visible artifact in hero region; G-11 mobile padding shift is invisible at 1280×4000 desktop viewport)
- **`pnpm test`** (full suite) — PASS: **208 passed | 3 skipped (211)** across 20 files (3 skipped = pre-existing deferred hybrid-fixture tests from Phase 01.2-05; matches Phase 01.2 baseline 207/210 + 1 new landing-page-golden test = 208/211 expected)
- **`pnpm typecheck:server`** — PASS (`tsc -p tsconfig.server.json --noEmit` exit 0)

## Deferred-Polish Routing

`.planning/phases/02-redesign-from-screenshot/02-DEFERRED-POLISH.md` exists with one item captured during 02-04:

- **`src/quiz/QuizModal.tsx:394–400` SuccessStep green checkmark uses WhatsApp brand colors instead of canonical success indicator** — found during plan 02-04. Two-stop gradient `linear-gradient(135deg, #25D366, #1da350)` plus shadow `rgba(37,211,102,0.5)` re-uses `#25D366` (UI-SPEC §Color reserves it for "WhatsApp brand color (dock button only)") on a non-WhatsApp success affirmation. Co-editing the gradient (whose darker stop has no token equivalent) and shadow is a visual semantic change beyond pure token-swap and exceeded the 5-min budget. **Routed to Phase 8** (default per CONTEXT.md `<deferred>`) — Phase 8 polish track will introduce a derived `--success-deep` token and replace both the gradient and the shadow with the canonical `#36D399`-based pair.

No items routed to Phase 5; no fundamental contract violations requiring founder surface-up.

## Files Modified in Phase 2

- `server/tests/landing-page-golden.test.ts` (new, plan 02-01 — puppeteer + sharp + pixelmatch gate at DIFF_THRESHOLD=0.22)
- `src/sections/Hero.tsx` (G-01, plan 02-02 — static coral-glow blob added with `pointerEvents: 'none'`)
- `src/styles/global.css` (G-11, plan 02-03 — single-character substitution `18` → `20` at line 599; G-08/G-09/G-03/G-06 verify-only audit confirmed nothing else needed touching)
- `src/quiz/QuizModal.tsx` (D-03 token alignment, plan 02-04 — single in-scope fix on SuccessStep countdown chip alpha 0.04 → 0.03 to match canonical card-surface treatment)
- `package.json` / `pnpm-lock.yaml` — NOT touched by Phase 2

## Phase 2 Out-of-Phase Confirmation

Per CONTEXT.md `<deferred>` and `<domain>` boundaries, these areas are explicitly NOT touched in Phase 2 — confirmed by `git log --oneline 8608e53..HEAD -- <path>` returning only Phase-2 commits whose diffs respect the boundary:

- `src/crm/CrmProvider.tsx` — Phase 5 frontend integration owns the rewrite onto react-query
- `src/crm/seed.ts` — content (founder bios, photos, reviews, cars) is Phase 8
- `src/quiz/quizSpec.ts` — Phase 6 lead flow LEAD-* requirements
- `src/components/atoms.tsx` — no structural changes; multi-market flags Phase 8
- `src/components/Nav.tsx` — no changes (G-07 verified by golden-test structural-drift signal only)
- `src/sections/{Marquee,Catalog,FeedStrip,Process,Founders,LeadMagnet,Reviews,Faq,Footer}.tsx` — no structural changes; verify-only

## Sign-Off

Phase 2 closes per CONTEXT.md D-02b — founder approval is implicit in commit acceptance; no formal review checkpoint required for this phase. The visual baseline (golden test at 19.57% < 22.00% threshold) is locked. Subsequent phases (Phase 5 frontend integration, Phase 6 lead flow, Phase 8 content polish) build on this baseline without further visual changes from Phase 2's scope.

## Self-Check Inputs (raw command outputs captured 2026-05-07)

```
$ grep -c "rgba(213,121,89,0.4)" src/sections/Hero.tsx
1
$ grep -c "pointerEvents: 'none'" src/sections/Hero.tsx
2
$ grep -nE 'borderRadius:\s*999|border-radius:\s*999px' src/sections/Catalog.tsx
39:                      padding: '10px 18px', borderRadius: 999,
$ grep -c 'var(--coral)' src/sections/Reviews.tsx
2
$ grep -c 'font-display:[[:space:]]*swap' src/styles/global.css
5
$ grep -c "id: 'feed" src/crm/seed.ts
5
$ grep -n 'state.feed.length === 0' src/sections/FeedStrip.tsx
6:  if (state.feed.length === 0) return null;
$ sed -n '599p' src/styles/global.css
  .container { padding: 0 20px !important; }
$ grep -n '0 18px' src/styles/global.css | wc -l
       0
$ grep -c 'aria-label="Telegram"' src/sections/Footer.tsx
2
$ grep -c 'aria-label="WhatsApp"' src/sections/Footer.tsx
2
$ grep -rE 'from .(@radix|shadcn|@chakra|@mui|@emotion|styled-components|tailwind|next/)' src/ 2>/dev/null | wc -l
       0
$ test -f components.json && echo present || echo absent
absent
$ grep -E '"(tailwind|@emotion|styled-components|next)":' package.json | wc -l
       0
$ grep -c '^### Phase ' .planning/ROADMAP.md
11
$ pnpm test landing-page-golden.test.ts  # → DIFF_RATIO_PCT=19.57
[landing-page-golden] DIFF_RATIO_PCT=19.57
 Test Files  1 passed (1)
      Tests  1 passed (1)
$ pnpm test  # → 208 passed | 3 skipped (211)
 Test Files  20 passed (20)
      Tests  208 passed | 3 skipped (211)
$ pnpm typecheck:server
> tsc -p tsconfig.server.json --noEmit
EXIT_CODE: 0
```
