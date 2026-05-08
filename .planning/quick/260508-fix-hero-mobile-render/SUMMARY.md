---
type: quick
slug: fix-hero-mobile-render
date: 2026-05-08
status: complete
files_modified:
  - src/styles/global.css
key_files:
  modified:
    - src/styles/global.css
commits:
  - "fix(quick): mobile-collapse Hero 2-col body grid + tighten pill row (header rule was missing — section selector didn't match Hero's <header> wrapper)"
---

# Quick: Fix Hero mobile rendering

## What changed

Single-file CSS edit to `src/styles/global.css` inside the existing `@media (max-width: 720px)` block (lines 605-606 area). Three new rule blocks added immediately after the existing `header div[style*="repeat(4"]` rule (the 4-stat strip mobile rule):

```css
header div[style*="1fr 1fr"] {
  grid-template-columns: 1fr !important;
  gap: 28px !important;
  align-items: flex-start !important;
}
header div[style*="gap: 10"][style*="flexWrap"] { gap: 6px !important; margin-bottom: 20px !important; }
header div[style*="gap: 10"][style*="flexWrap"] > * { padding: 6px 10px !important; font-size: 11px !important; }
```

## Root cause

The generic mobile rule at `global.css:555` collapses inline 2-col grids to 1-col but it scopes to `section [style*="gridTemplateColumns"]`. Hero is wrapped in `<header>`, not `<section>`, so the rule never matched. The 2-column body (`gridTemplateColumns: '1fr 1fr'` at `Hero.tsx:88`) stayed 2-column at 390px, causing the right-column "В работе сейчас" pipeline card to overlap the headline and CTAs.

The pill-row tightening rule additionally targets the `flex` container at `Hero.tsx:72` to keep 5 chips on 1-2 lines instead of 3 cluttered lines.

## Verification

Re-captured at iPhone-13 (390×844, deviceScaleFactor 2). Before/after at `tmp/hero-mobile-hero-only.png`:

| Issue | Before | After |
|-------|--------|-------|
| 2-col grid collapse | pipeline card overlapped headline | pipeline card stacks below CTA buttons |
| Pill row | wrapped to 3 cluttered lines | wraps to 2 tight lines |
| Headline visibility | partly obscured by right-column | fully visible, full width |
| DVApro watermark intrusion | visible behind text | suppressed (mobile rule at `:589` already handles) |

Desktop golden test unaffected — selector is scoped to `header` + the inline-style attr-match, and only fires under `max-width: 720px`. `pnpm test`: 208 passed, 3 skipped, 20 files green (golden test passes at 0.28 threshold, desktop layout untouched).

## Notes for future

- The selector `[style*="1fr 1fr"]` is intentional — matches the inline `gridTemplateColumns: '1fr 1fr'`. Same pattern as the existing `header div[style*="repeat(4"]` rule for the 4-stat strip. Brittle to JSX edits but consistent with the codebase's inline-styles convention.
- If a future phase replaces inline styles with Tailwind/CSS-modules, both these mobile selectors (the existing 4-stat one AND this new 2-col one) will need a corresponding refactor.
