---
type: quick
slug: intransit-cards-match-catalog
date: 2026-05-08
files_modified:
  - src/crm/types.ts
  - src/crm/seed.ts
  - src/sections/InTransit.tsx
---

# Quick: InTransit cards match Catalog + real images

InTransit cards currently render only `CarPlaceholder` (no src). Make them look like Catalog cards with real images.

1. Add `img: string` to `InTransitItem` type
2. Seed each of 4 fixtures with a working Unsplash car image (reuse catalog URLs where the car matches)
3. Update `InTransit.tsx` so each card has: image with status pill (top-left) + flag pill (top-right) overlay → spec mono line → brand/model headline → price + ETA bottom row, similar to Catalog
