---
phase: 02
slug: redesign-from-screenshot
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-07
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` §1 Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2 |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `pnpm test landing-page-golden.test.ts` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds (golden test alone); existing 207/210 passing baseline must remain green |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test landing-page-golden.test.ts`
- **After every plan wave:** Run `pnpm test` + `pnpm typecheck:server` + `pnpm build`
- **Before `/gsd-verify-work`:** Full suite must be green AND golden test passes AND manual G-08/G-09/G-11 grep checks confirmed in PR body
- **Max feedback latency:** ~30 seconds (single golden test); ~3 minutes for full suite

---

## Per-Task Verification Map

Phase 2 has **no REQ-* IDs** (verified — `02-RESEARCH.md` §"Phase Requirements"). Coverage is mapped via 11 gap IDs (G-01..G-11) instead of the standard task→REQ matrix.

| Gap ID | Section | Wave | Test Type | Automated Command | Status |
|--------|---------|------|-----------|-------------------|--------|
| G-01 | Hero coral-glow blob | 1 | golden | `pnpm test landing-page-golden.test.ts` | ⬜ pending |
| G-02 | Hero pipeline card (no-op) | n/a | golden (regression guard) | `pnpm test landing-page-golden.test.ts` | ⬜ pending |
| G-03 | Catalog filter pill `border-radius: 999px` (verify) | 1 | golden + grep | `pnpm test landing-page-golden.test.ts && grep -n "border-radius:.*999px\|borderRadius:.*999" src/sections/Catalog.tsx` | ⬜ pending |
| G-04 | FeedStrip rendering (no-op) | n/a | golden (regression guard) | `pnpm test landing-page-golden.test.ts` | ⬜ pending |
| G-05 | Process accordion (no-op) | n/a | golden (regression guard) | `pnpm test landing-page-golden.test.ts` | ⬜ pending |
| G-06 | Reviews star color `var(--coral)` (verify) | 1 | golden + grep | `pnpm test landing-page-golden.test.ts && grep -n "var(--coral)" src/sections/Reviews.tsx` | ⬜ pending |
| G-07 | Nav fixed/frosted (no-op) | n/a | golden (regression guard) | `pnpm test landing-page-golden.test.ts` | ⬜ pending |
| G-08 | `font-display: swap` on `@font-face` blocks (verify) | 1 | grep | `grep -c "font-display:[[:space:]]*swap" src/styles/global.css` (expect ≥5) | ⬜ pending |
| G-09 | FeedStrip `feed[]` populated (verify) | 1 | grep | `node -e "const s=require('./src/crm/seed.ts');..."` or grep entries in `src/crm/seed.ts` | ⬜ pending |
| G-10 | Mobile menu (no-op) | n/a | out of scope @ desktop | n/a (Phase 8 mobile audit) | ⬜ deferred |
| G-11 | Mobile container padding `18px → 20px` at `global.css:599` | 1 | grep | `grep -n "padding:[[:space:]]*0[[:space:]]*20px[[:space:]]*!important" src/styles/global.css` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · 🟡 deferred*

---

## Wave 0 Requirements

- [ ] `server/tests/landing-page-golden.test.ts` — new file, ~80 lines, clones `server/tests/bmw-pilot-viewer.test.ts` structure (see `02-RESEARCH.md` §6 for paste-ready outline). Self-brings-up Vite dev server via `child_process.spawn` with polling readiness probe.
- [ ] `.gitignore` entry for `server/tests/__snapshots__/landing-page-golden.diff.png` (mirror existing `bmw-pilot-viewer.diff.png` entry — add both in same commit if missing).
- [ ] No new dependencies required — `puppeteer@^24.42.0`, `pixelmatch@^7.2.0`, `pngjs@^7.0.0`, `sharp@^0.34.5`, `vitest@^3.2.4` are all already installed in `package.json` (verified `02-RESEARCH.md` §2).

---

## Gate: Landing Page Screenshot Golden

| Property | Value |
|----------|-------|
| Purpose | Structural-drift guard between as-shipped SPA and `design-reference.png` (per CONTEXT.md D-02) |
| File | `server/tests/landing-page-golden.test.ts` |
| Pipeline | `puppeteer.launch({ headless: true })` → `page.setViewport({ width: 1280, height: 4000 })` → `page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' })` → wait 1500ms for fonts/Reveal animations → `page.screenshot({ type: 'png', fullPage: true })` → `sharp(buf).resize(605, 1280, { kernel: 'cubic', fit: 'fill' }).png().toBuffer()` → `PNG.sync.read` → `pixelmatch(actual, ref, diff, 605, 1280, { threshold: 0.1 })` |
| **Threshold** | `DIFF_THRESHOLD = 0.22` (22%) — empirical as-shipped baseline = 18.74–18.97%; 3.0–3.3pp safety band above floor (per `02-RESEARCH.md` §3) |
| Pass condition | `mismatched / (605 * 1280) ≤ 0.22` |
| Fail behavior | Vitest `expect(...).toBeLessThanOrEqual(DIFF_THRESHOLD)` fails AND writes diff PNG to `server/tests/__snapshots__/landing-page-golden.diff.png` (gitignored) |
| Where it runs | `pnpm test` locally; future CI integration. Test self-orchestrates dev server bring-up — no external orchestration required. |
| Wave 3 phase gate | Phase 2 closes only when this test passes against the post-G-01..G-11 build. |

---

## Manual-Only Verifications

| Behavior | Why Manual | Test Instructions |
|----------|------------|-------------------|
| G-08 `font-display: swap` | Not a visual change — won't show in golden | `grep -c "font-display:[[:space:]]*swap" src/styles/global.css` returns ≥5 (one per `@font-face` block) |
| G-09 `seed.ts.feed[]` populated | Not a visual change at v1 (data already present) | Visually inspect `src/crm/seed.ts` `feed[]` array contains ≥1 entry; `FeedStrip.tsx:6` returns null only at length 0 |
| G-11 mobile container padding | Visible only at ≤720px; golden runs at 1280 viewport (won't catch) | `grep -n "padding:[[:space:]]*0[[:space:]]*20px[[:space:]]*!important" src/styles/global.css:599` returns the fixed line |
| Cross-browser (Yandex Browser, Firefox, Safari) | Golden runs on puppeteer's bundled Chromium only | Out of phase — Phase 8 owns the explicit cross-browser audit (per `02-RESEARCH.md` §9) |
| Founder visual review of as-shipped state | D-02b: founder approval is implicit in commit acceptance | None — no formal sign-off step |

---

## Validation Sign-Off

- [ ] All Wave 1+ tasks have golden-test or grep verification mapped above
- [ ] Sampling continuity: every Wave 1 commit runs `pnpm test landing-page-golden.test.ts` (≤30s feedback)
- [ ] Wave 0 covers all MISSING references (the new golden test file + `.gitignore` entry)
- [ ] No watch-mode flags used in CI commands
- [ ] Feedback latency < 30s (per-task) / < 3min (per-wave full suite)
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 ships and the golden test runs green against as-shipped baseline

**Approval:** pending
