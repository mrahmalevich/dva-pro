---
type: quick
slug: fix-hero-mobile-render
date: 2026-05-08
files_modified:
  - src/styles/global.css
---

# Quick: Fix Hero mobile rendering

## Problem

On mobile (≤720px, captured at 390×844 in `tmp/hero-mobile-hero-only.png`):
1. Hero's 2-column body grid (`gridTemplateColumns: '1fr 1fr'` at `src/sections/Hero.tsx:88`) does NOT collapse to single column. The right-side "В работе сейчас" pipeline card overlaps the headline and CTAs.
2. Pill row (5 chips at `Hero.tsx:72`) wraps awkwardly across 2-3 lines with default chip padding.
3. The DVApro watermark intrudes behind text because the layout is taller than expected.

Root cause: the existing generic mobile rule at `global.css:555` targets `section [style*="gridTemplateColumns"]` — but Hero is wrapped in `<header>`, not `<section>`. So the rule never applies to Hero.

## Fix

Add focused mobile rules INSIDE the existing `@media (max-width: 720px)` block at `global.css:567-655`:

1. Collapse Hero's body grid: `header div[style*="1fr 1fr"]` → `grid-template-columns: 1fr !important; gap: 28px; align-items: flex-start`.
2. Tighten pill row: `header div[style*="gap: 10"][style*="flexWrap"]` → reduce gap to 6 + reduce chip padding under it.

Single-file CSS edit. No JSX changes. No new dependencies.

## Verification

Re-capture mobile screenshot at 390×844 via `node tmp/capture-mobile-hero.mjs`. Confirm:
- Pipeline card stacks BELOW body+CTAs (not overlapping headline)
- Pills row fits in ≤2 lines without overlap
- Headline is fully visible
- Run `pnpm test` — all 208 tests still green; golden test at desktop 1280×4000 unaffected
