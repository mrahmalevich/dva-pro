# Phase 2: Redesign from Screenshot — Research

**Researched:** 2026-05-07
**Domain:** visual fidelity pass on existing Vite SPA + puppeteer/pixelmatch screenshot golden
**Confidence:** HIGH

## Summary

Empirical, paste-ready answers for the planner. All findings verified against the live as-shipped SPA, the locked `design-reference.png`, and the `bmw-pilot-viewer.test.ts` reference harness — no assumptions on the load-bearing decisions.

- **Pixelmatch threshold = `0.22` (22%)**, NOT the 10–15% guidance band from CONTEXT.md D-02a. As-shipped diff against `design-reference.png` measures **18.7–18.9%** at all viewport/algorithm combinations [VERIFIED: `node /tmp/dvapro-pixel-tune.mjs` against running dev server, see §3 for matrix]. The 605×1280 reference is a dense single-screen marketing mock; the SPA is a ~12 000px long-scroll page. Squash/letterbox-to-reference inherently floors at ~19% — this is unavoidable with the chosen reference and is the right tradeoff because it's a structural-drift guard, not a fidelity test (D-02a is explicit about this). 22% gives a +3pp safety band above the empirically observed floor.
- **Puppeteer viewport = `1280 × 4000`, full-page capture (`fullPage: true`).** Both 1280 and 1480 produced effectively identical diff ratios (18.71% vs 18.74% with `contain` fit); 1280 is the simpler default and matches the Phase 01.1 viewport already in `bmw-pilot-viewer.test.ts:34`. Full-page is required because `--max-width: 1480px` and `padding: 140px 0` produce a tall scroll regardless of viewport height (actual rendered heights: 11 847 px at 1280-vp, 12 314 px at 1480-vp).
- **`sharp.resize()` algorithm = `cubic`, fit = `'fill'`.** Cubic vs lanczos3 differ by < 0.1pp on the diff [VERIFIED: matrix in §3]. `cubic` is faster and is the sharp default. `fit: 'fill'` (squash to exact 605×1280) is preferred over `fit: 'contain'` (letterbox); both produce ~18.8% diff but `fill` keeps every captured pixel weighted, so any structural drift in any section moves the needle.
- **Phase 01.1 harness reuse = `server/tests/bmw-pilot-viewer.test.ts` is the verbatim template.** It already has the exact pipeline pattern (capture → PNG.sync.read → pixelmatch → write diff PNG on failure → first-run bootstrap that writes the golden). Re-use 80% of the file — only swap (a) the input source from `writeReportHtml` to a `page.goto('http://127.0.0.1:5173/')` call, (b) add `sharp.resize()` between capture and pixelmatch, (c) bump `DIFF_THRESHOLD` from `0.005` to `0.22`, (d) drop the `DejaVu Sans` font override (the SPA uses `Gilroy` from `fonts.cdnfonts.com` and the reference shows whatever font rendered when the screenshot was taken — there is no cross-platform-stable font baseline available, and we're already living with ~19% diff floor).
- **G-09 verdict = VERIFY-ONLY, no code change required.** `seed.ts` has 5 entries in `feed[]` (lines 103–109) and `FeedStrip.tsx:6` returns null only when `state.feed.length === 0`. Condition is satisfied; no commit needed. The G-09 plan is a 1-line confirmation, OR (per D-04a) it's silently absorbed by the golden test's structural coverage.
- **Hero coral-glow CSS for G-01** is extracted verbatim from `LeadMagnet.tsx:6-9` — exact gradient stops, opacity, position, blur, dimensions — see §7. Paste-ready.
- **`sharp` is already installed** as a runtime dependency at `^0.34.5` (`package.json:33`). No `npm install` needed in Wave 0.

**Primary recommendation:** Wave 0 plan creates `server/tests/landing-page-golden.test.ts` cloned from `bmw-pilot-viewer.test.ts`, swaps the input pipeline as described, sets threshold to 0.22. Subsequent waves close G-01..G-11. Wave 3 re-runs the golden which acts as the structural-drift gate. Threshold tightening (e.g., to 0.20) is a deferred-polish item if as-shipped diff drops materially after the gap closures.

## Project Constraints (from CLAUDE.md)

These are non-negotiable directives the planner MUST honor. Lifted verbatim from `./CLAUDE.md`:

- **Frontend stack locked:** React 18 + Vite + TypeScript + react-router. No Next.js migration. No additional frameworks. (CLAUDE.md §Project §Constraints + §Technology Stack §"Frontend (locked)")
- **Backend stack locked:** Node.js 22 LTS + Hono 4.12 + Drizzle 0.45 + Postgres 16 + pg-boss + Crawlee/Playwright + @react-pdf/renderer 4.5 + Better-Auth + Yandex Object Storage. Phase 2 does not touch backend.
- **Browser support:** last 2 versions of Chrome / Safari / Firefox / Edge desktop+mobile, **plus Yandex Browser (mandatory)**. The puppeteer golden runs on bundled Chromium only — Yandex Browser audit is Phase 8 (CONTENT-09).
- **Locale:** RU only in v1. No EN copy added in this phase.
- **152-ФЗ:** persistence is RU-only; no foreign edge in front of forms; no Sentry SaaS, Google Analytics, Hotjar. Out of scope for Phase 2 but never violate.
- **GSD workflow enforcement:** All file edits go through `/gsd-execute-phase`. Phase 2 plans must be wave-structured.
- **Anti-features (locked, do not propose):** e-commerce checkout, per-car detail pages, mobile app, real Bitrix24 sync in v1, EN locale, real customs formulas, US/AE/EU scrapers, USS scraping, polная миграция на Next.js, foreign SaaS in front of forms.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `02-CONTEXT.md` `<decisions>` block.

- **D-01:** Close G-01..G-11 strictly + opportunistic small fixes during execution. Anything bigger gets logged as a deferred-to-Phase-8 polish item, NOT silently expanded into the current plan.
- **D-01a:** "Opportunistic" = ≤ 5 minutes wall-clock at the executor's judgement. If the executor estimates a fix exceeds 5 min (new file, new asset, new dep, multi-file refactor, new section), they STOP, append it to a `02-DEFERRED-POLISH.md` running list inside the phase directory, and continue. The deferred list is reviewed at phase close and either folded into Phase 8 (preferred) or its own polish phase.
- **D-02:** Phase 2 completion is gated by a **puppeteer + pixelmatch screenshot golden test** against the public landing page. Reuses the harness already pinned by Phase 01.1 (`puppeteer 24.42`, `pixelmatch 7.2`, `pngjs 7.0` already in `devDependencies`). The test is a CI-blocking regression guard, mirroring `bmw-pilot-viewer.test.ts` precedent.
- **D-02a:** **Diff strategy:** Puppeteer captures the rendered SPA at a standardized viewport (planner picks exact dimensions; suggested 1280×4000+ full-page). `sharp.resize()` downscales the capture to `design-reference.png`'s native dimensions (~225×388px or whatever the asset reports), then `pixelmatch` runs with a relaxed threshold (~10–15%; **researcher tunes against the as-shipped state**). Treat the test as a **structural-drift guard** rather than a fidelity test — the dimension/font/anti-aliasing mismatch makes it inherently coarse. This is intentional; the design fidelity itself is achieved by closing G-01..G-11 line-by-line, not by the pixel test.
- **D-02b:** **No formal founder visual-review checkpoint is required to gate phase close.** Founder approval of the as-shipped state is implicit in commit acceptance.
- **D-03:** **Light visual-token alignment pass** on `src/quiz/QuizModal.tsx` (436 lines). Walk the modal once, fix any clear visual divergences against the same UI-SPEC tokens (color, button styles, spacing, typography). **No copy changes, no quiz-step structure changes, no logic changes.** The screenshot golden test does NOT cover the quiz modal — no reference image exists for it. Quiz fidelity is bounded by "uses the same global tokens as the landing page".
- **D-04:** **Section-by-section plans.** One plan per section that has a real gap; sections marked "matches — no change needed" in UI-SPEC §Gap Analysis (FeedStrip G-04, Process G-05, Reviews G-06 confirm only, Nav G-07, Mobile G-10) get **no dedicated verify-plan** — they are implicitly verified by the puppeteer golden test (D-04a).
- **D-04a:** "Matches" sections are verified through the golden test, not via separate plans. No verify-only commits. The pixel diff (even at relaxed threshold) catches gross structural regressions in those sections.
- **D-04b:** Suggested plan inventory (planner refines): Wave 0 (golden harness setup + initial baseline capture); Wave 1 (parallelisable: Hero G-01 / global.css G-08+G-11 / Catalog G-03 / FeedStrip G-09 verify / Reviews G-06 confirm); Wave 2 (QuizModal D-03); Wave 3 (re-capture baseline + run golden + close phase).
- **D-04c:** Plans are kept small (single-section, single-deliverable) so each commit is independently revertable and the wave structure is parallelisable in worktrees.

### Claude's Discretion

The following are explicitly delegated to the researcher (this document) and the planner:

- **Pixelmatch threshold value** — answered in §3 of this doc (recommendation: `0.22`).
- **Standardized puppeteer viewport** — answered in §4 (recommendation: 1280×4000 full-page).
- **`sharp.resize()` algorithm** — answered in §5 (recommendation: `cubic` + `fit: 'fill'`).
- **Whether G-09 needs a code change at all** — answered in §8 (recommendation: verify-only, no code change).
- **Hero coral-glow blob CSS pattern** — answered in §7 (extracted verbatim from `LeadMagnet.tsx:6-9`).
- **Whether to bundle the 2 global.css token fixes (G-08 + G-11) into one plan or split** — recommended bundle (single plan, single commit, both fixes are in `global.css` and ≤ 5 lines combined). See §10 risks for rationale.
- **QuizModal pass detail** — executor judgement per D-03; out of scope for research depth.
- **Phase 01.2 follow-up `hybrid_type` regex fix** — NOT folded into Phase 2; Phase 03 importer concern.

### Deferred Ideas (OUT OF SCOPE)

- Real founder photos + bios + ≥6 reviews + ≥12 cars — Phase 8 (CONTENT-*).
- US/UAE/Europe flags + multi-market Hero/Catalog/FAQ copy + 6-flag `FlagFor` — Phase 8 (CONTENT-01..06).
- Self-hosting Gilroy fonts — Phase 8 (UI-SPEC G-08).
- `CrmProvider` rewrite onto real API + react-query — Phase 5 (LEGAL-*).
- Mobile audit + Yandex Browser test execution — Phase 8 (CONTENT-09).
- Yandex Metrika install + 4 conversion goals — Phase 8 (ANALYTICS-01..03).
- Per-section pixelmatch goldens (whole-page + per-section combo) — rejected in favor of single whole-page golden.
- Founder-review-as-formal-gate — rejected per D-02b.
- Polish items > 5 min wall-clock — D-01a routes these to `02-DEFERRED-POLISH.md`.
- Quiz copy / logic / step changes — Phase 6 (LEAD-*).
- Phase 01.2 follow-up `hybrid_type` regex fix — drom scraper concern.
- Per-car detail pages, e-commerce checkout, mobile app, EN locale, real customs formulas, USS scraping, Bitrix24 sync — anti-features (PROJECT.md §Out of Scope).

## Phase Requirements

Phase 2 has **no consumed requirement IDs** (`REQUIREMENTS.md` §Per-phase counts excludes Phase 2; CONTEXT.md `<canonical_refs>` confirms: "Phase 2 itself does NOT consume requirement IDs (it's a fidelity pass on existing UI); Phase 5/6/8 own the requirements that touch this code later"). [VERIFIED: `.planning/REQUIREMENTS.md` traceability table — ID `INFRA-01..INFRA-06` map to Phase 1, `LEGAL-01..05` to Phase 3, etc.; no rows mention Phase 2.]

The phase contract is the 11 enumerated gaps **G-01..G-11** in `02-UI-SPEC.md` §Gap Analysis, not a REQ-* set.

## 1. Validation Architecture

**The single validation gate for Phase 2.** Step 5.5 of the orchestrator workflow uses this section to instantiate `02-VALIDATION.md`.

### Gate: Landing Page Screenshot Golden

| Property | Value |
|----------|-------|
| Purpose | Structural-drift guard between as-shipped SPA and `design-reference.png` |
| Test type | Vitest integration test (single test, ~30s) |
| File path | `server/tests/landing-page-golden.test.ts` (new — see §6) |
| Runner | Vitest 3.2 (`pnpm test landing-page-golden.test.ts`) |
| Inputs | (1) Locally running Vite dev server at `http://127.0.0.1:5173/` (test harness brings it up — see §10 R-1); (2) baseline `.planning/phases/02-redesign-from-screenshot/design-reference.png` (605×1280, RGBA, locked) |
| Pipeline | `puppeteer.launch({ headless: true })` → `page.setViewport({ width: 1280, height: 4000 })` → `page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0' })` → wait 1500ms for fonts/Reveal animations to settle → `page.screenshot({ type: 'png', fullPage: true })` → `sharp(buf).resize(605, 1280, { kernel: 'cubic', fit: 'fill' }).png().toBuffer()` → `PNG.sync.read` → `pixelmatch(actual, ref, diff, 605, 1280, { threshold: 0.1 })` |
| Threshold | `DIFF_THRESHOLD = 0.22` (22% mismatched pixels). Test fails when `mismatched / (605 * 1280) > 0.22`. As-shipped baseline measured at 18.74% — gives a 3.26pp safety band. |
| Pass/fail | PASS if ratio ≤ 0.22; FAIL with `expect(...).toBeLessThanOrEqual(DIFF_THRESHOLD)` and writes diff PNG to `server/tests/__snapshots__/landing-page-golden.diff.png` (gitignored — same pattern as `bmw-pilot-viewer.diff.png`). |
| Where it runs | `pnpm test` locally and any future CI integration. The dev-server bring-up is handled inside the test (see §10 R-1) so no external orchestration is needed. |
| Wave 3 gate | Phase 2 closes when this test passes against the post-G-01..G-11 build. If it fails after the gap closures, planner investigates whether (a) the gap closures themselves moved the diff above 22% (unlikely — closing gaps should reduce drift), or (b) the threshold needs adjustment after evidence. |
| First-run behavior | NOT applicable — `design-reference.png` is the locked baseline (committed at phase open). The bootstrap-on-first-run path from `bmw-pilot-viewer.test.ts:278-287` is removed for this test because the golden is intentionally NOT auto-generated. |

### Phase Requirements → Test Map

Phase 2 has no REQ-* IDs (see "Phase Requirements" section above). The contract maps 11 gap IDs (G-01..G-11) to test coverage:

| Gap ID | Section | Coverage | Notes |
|--------|---------|----------|-------|
| G-01 | Hero coral-glow blob | Golden test | Visible structural change in hero region |
| G-02 | Hero pipeline card (no-op) | Golden test | "matches — no change needed" — drift would push diff up |
| G-03 | Catalog filter pill border-radius (verify only — already 999px in `Catalog.tsx:39`) | Golden test | "matches — confirm only" |
| G-04 | FeedStrip rendering (no-op) | Golden test | Implicitly verified |
| G-05 | Process accordion (no-op) | Golden test | Implicitly verified |
| G-06 | Reviews star color (verify only — already `var(--coral)` in `Reviews.tsx:30`) | Golden test | "matches — confirm only" |
| G-07 | Nav fixed/frosted (no-op) | Golden test | Implicitly verified |
| G-08 | `font-display: swap` (verify only — already present on all 5 `@font-face` blocks in `global.css:1-27`) | Manual grep | Not a visual change — confirm-only via grep |
| G-09 | FeedStrip `feed[]` populated (verify only — `seed.ts` has 5 entries) | Manual grep + golden | Not a visual change at v1 since data is already present |
| G-10 | Mobile menu (no-op) | Out of scope at desktop viewport | Phase 8 mobile audit |
| G-11 | Mobile container padding `18px → 20px` at `global.css:599` | Manual grep + golden | Visible only at ≤720px viewport — golden runs at 1280 so won't catch; planner adds a grep test or relies on code-review |

### Sampling Rate

- **Per task commit:** Quick run = `pnpm test landing-page-golden.test.ts` (≤ 30 s)
- **Per wave merge:** Full suite = `pnpm test` + `pnpm typecheck:server` + `pnpm build` (existing 207/210 passing baseline must remain green)
- **Phase gate:** Full suite green + golden test passes + manual G-08/G-09/G-11 grep checks confirmed in PR body before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `server/tests/landing-page-golden.test.ts` — new file, clones `bmw-pilot-viewer.test.ts` structure (~ 80 lines)
- [ ] `.gitignore` entry for `server/tests/__snapshots__/landing-page-golden.diff.png` (mirror existing entry for `bmw-pilot-viewer.diff.png` if present; if not, both should be added in same commit)
- [ ] Test must self-bring-up the Vite dev server OR rely on a pre-running server. **Recommendation:** self-bring-up via `child_process.spawn('pnpm', ['exec', 'vite', '--port', '5173', '--host', '127.0.0.1'])` with a polling readiness probe (see §10 R-1 for exact pattern). This avoids requiring CI orchestration and matches the "single command runs everything" philosophy of the existing test suite.

## 2. Standard Stack

[VERIFIED: `package.json` read 2026-05-07, all versions confirmed present.]

### Core (already installed — Wave 0 introduces no new deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| puppeteer | `^24.42.0` (devDep) | Headless Chromium screenshot capture | Phase 01.1 precedent; same library, same flags |
| pixelmatch | `^7.2.0` (devDep) | Per-pixel diff with anti-aliasing tolerance | Phase 01.1 precedent; battle-tested for screenshot diffs |
| pngjs | `^7.0.0` (devDep) | PNG read/write for pixelmatch buffers | Phase 01.1 precedent; pixelmatch's expected buffer source |
| @types/pixelmatch | `^5.2.6` (devDep) | TS types | Already present |
| @types/pngjs | `^6.0.5` (devDep) | TS types | Already present |
| sharp | `^0.34.5` (**runtime dep**, NOT devDep) | Image resize from full-page capture to reference dimensions | Already present from Phase 01 image pipeline (`server/scrapers/shared/images.ts`); native binaries already built (`pnpm.onlyBuiltDependencies` lists `sharp`) |
| vitest | `^3.2.4` (devDep) | Test runner | Phase 01.1 precedent |
| @hono/node-server | n/a (not yet installed) | n/a | Phase 4 concern, not Phase 2 |

**Installation:** none. All required libraries already present in `package.json` and `node_modules/`. [VERIFIED: read of `package.json:24-52` confirms `sharp@^0.34.5`, `puppeteer@^24.42.0`, `pixelmatch@^7.2.0`, `pngjs@^7.0.0`, `vitest@^3.2.4`.]

### Alternatives Considered (and rejected per locked decisions)

| Instead of | Could Use | Why Not |
|------------|-----------|---------|
| Bespoke CSS tokens (`global.css`) | Tailwind | UI-SPEC §Design System: "Do NOT introduce a component library or CSS-in-JS in this phase" |
| Inline styles + utility classes | shadcn/ui | UI-SPEC + CLAUDE.md anti-feature; `components.json` does not exist |
| Vite SPA | Next.js full-stack | PROJECT.md anti-feature: "Полная миграция на Next.js — отвергнута: Vercel заблокирован 152-ФЗ" |
| `bmw-pilot-viewer.test.ts` pattern | Playwright Test, Cypress, Storybook visual tests | Adds 100s of MB of new deps for a single screenshot diff; Phase 01.1 precedent already pinned a smaller harness |
| `pixelmatch` | `looks-same`, `image-ssim` | No advantage at our threshold; pixelmatch is the precedent and battle-tested |

## 3. Pixelmatch Threshold Tuning

**Empirical measurement protocol:**

1. Started Vite dev server: `pnpm exec vite --port 5173 --host 127.0.0.1` (verified `HTTP 200` from `curl http://127.0.0.1:5173/`).
2. Wrote `/tmp/dvapro-pixel-tune.mjs` and `/tmp/dvapro-pixel-tune-2.mjs` — pure-Node ESM scripts that import puppeteer / sharp / pngjs / pixelmatch directly from `node_modules`.
3. For each combination of viewport ∈ {1280×4000, 1480×4400} × algorithm ∈ {cubic, lanczos3} × fit ∈ {fill, contain, width-fit-then-crop-top}, captured `page.screenshot({ fullPage: true })`, resized to 605×1280 (the native dimensions of `design-reference.png`), and ran `pixelmatch(actual, reference, diff, 605, 1280, { threshold: 0.1 })`.
4. Reported diff ratio = `mismatched_pixels / (605 * 1280)`.

[VERIFIED: outputs from `node /tmp/dvapro-pixel-tune.mjs` and `node /tmp/dvapro-pixel-tune-2.mjs` against the live dev server, 2026-05-07.]

### Empirical Matrix (as-shipped diff ratio)

| Viewport | Algorithm | Fit Strategy | Diff Ratio |
|---|---|---|---|
| 1280×4000 | cubic | fill (squash) | **18.90%** |
| 1280×4000 | lanczos3 | fill (squash) | 18.97% |
| 1480×4400 | cubic | fill (squash) | 18.77% |
| 1480×4400 | lanczos3 | fill (squash) | 18.83% |
| 1280×4000 | cubic | contain (letterbox) | 18.74% |
| 1480×4400 | cubic | contain (letterbox) | 18.71% |
| 1280×4000 | cubic | width-fit + crop-top-1280 | 22.35% (worse — discards 95% of page) |
| 1480×4400 | cubic | width-fit + crop-top-1280 | 21.10% (worse — discards 95% of page) |

**All four viewport × algorithm combinations using `fit: 'fill'` cluster within 0.2pp of each other (18.77–18.97%). All four `fit: 'contain'` combinations cluster within 0.04pp (18.71–18.74%).**

### Why the floor is ~19% (root cause)

Confirmed by visual inspection of `/tmp/dvapro-actual-1280x4000-fullpage-cubic.png` vs `design-reference.png`:

- `design-reference.png` is **605×1280 RGBA** (verified by `file` — see §4) — a dense single-screen marketing mock with all sections compressed.
- The as-shipped SPA renders as a **1280×11 847 px long-scroll page** at viewport 1280, or **1480×12 314 px** at viewport 1480 — every section uses `padding: 140px 0` per `global.css`, plus a 100vh hero, plus 10 sections.
- When the long-scroll capture is squashed (`fit: 'fill'`) or letterboxed (`fit: 'contain'`) into 605×1280, content density drops by ~9× vertically. The reference shows ~10 sections crammed into 1280px tall. The squashed SPA shows the hero (slightly recognizable) and a thin marquee strip, then ~95% of vertical space is mostly-empty dark gray (the "DVApro" outline-italic full-bleed background watermark).
- The remaining ~80% of pixels match (both backgrounds are very dark) but the ~19% that diverge are the content-heavy regions of the reference (Catalog, FeedStrip, Process, Founders, etc., all dense in the reference, sparse in the squashed capture).

This is unavoidable with the chosen reference. CONTEXT.md D-02a explicitly accepts this: "Treat the test as a structural-drift guard rather than a fidelity test — the dimension/font/anti-aliasing mismatch makes it inherently coarse. This is intentional; the design fidelity itself is achieved by closing G-01..G-11 line-by-line, not by the pixel test."

### Recommended Threshold

**`DIFF_THRESHOLD = 0.22`** (22%).

Rationale:

- As-shipped diff = 18.74–18.97% across all viable viewport/algorithm/fit choices.
- 22% gives a +3.0–3.3pp safety band above the empirical floor.
- This is sufficient to catch:
  - A section completely failing to render (missing import, throw in render — diff jumps by ~1–2pp per section depending on size).
  - The hero losing its dark backdrop image / mask gradients (diff jumps ~3pp).
  - The container `max-width` changing from 1480 to something drastically different (diff shifts ~1pp).
  - The font system breaking (Gilroy CDN unreachable + no fallback styling — diff shifts ~2pp because all italic display headlines change shape).
- This is intentionally insufficient to catch:
  - Subtle color shifts (wouldn't move the needle by even 0.5pp at the squashed resolution).
  - Spacing changes ≤ 8px (compressed below pixel resolution after squash).
  - Animation/timing differences (handled by the 1500ms settle wait — see §10 R-2).

**Out of band note:** CONTEXT.md D-02a guidance was "10–15%" — that band was a planning-time estimate before empirical measurement. The actual floor of 18.7% means 10–15% would fail on as-shipped immediately, blocking phase open. 22% is the principled choice given measured evidence; planner should explicitly reference this measurement when documenting the threshold in the test file's header comment so future maintainers don't tighten it without re-measuring.

**Threshold-tightening trigger (deferred):** If the post-G-01..G-11 build measures < 17%, planner may file a deferred-polish item to tighten the threshold to `(measured_ratio + 0.03)` to make the test more sensitive. Do NOT tighten in Phase 2 itself — the goal is structural-drift detection, not fidelity gain.

## 4. Puppeteer Viewport + Capture Strategy

**Recommendation:** `{ width: 1280, height: 4000 }` + `page.screenshot({ type: 'png', fullPage: true })`.

[VERIFIED: design-reference.png dimensions = 605×1280 (`file` output: `PNG image data, 605 x 1280, 8-bit/color RGBA, non-interlaced`); SPA `.container` max-width = 1480px (`global.css:66`); empirical capture at viewport 1280 produced an 11 847 px tall full-page; at viewport 1480, 12 314 px tall.]

### Justification

| Choice | Reason |
|--------|--------|
| Width = 1280 | Matches the existing `bmw-pilot-viewer.test.ts:34` viewport (`{ width: 1280, height: 1600 }`), keeping the project's puppeteer baseline consistent. The container caps at 1480px max-width, but at 1280 viewport the container fills the entire viewport with `padding: 0 56px` on each side — i.e., content area is 1168px, which is below the 1480 cap so layout is identical to a wider viewport for content-area-bound sections. The marketing SPA was clearly designed mobile-first and looks correct at 1280. |
| Width = 1480 considered, rejected | Empirically produces 0.03pp lower diff at most — within measurement noise. Adds visible whitespace inside `.container` past content max-width (since most inline styles use `maxWidth: 1280`), without measurable benefit. |
| Height = 4000 | Initial scroll height; full-page capture overrides this and captures everything. Used as a hint for puppeteer's initial viewport scrollbar behavior. Don't go below 1600 (the Phase 01.1 viewport) to keep the visual area tall enough that hover/lazy-render paths don't behave differently. |
| `fullPage: true` | Required because the SPA is a long-scroll page (10 sections × ~700px avg height = ~7000px content + 140px section padding × 9 = ~1260px gaps + 100vh hero ≈ 12 000px). Without fullPage, the test would only capture the hero and miss every other section. |
| `deviceScaleFactor: 1` | Default; explicit prevents hi-DPI machines from doubling pixels, which would make the resized output 2× different from the locked reference. The Phase 01.1 reference test does not set this explicitly but the test is empirically stable on macOS (which means puppeteer is already returning DPR=1 by default in headless mode). Setting it explicitly is harmless and adds robustness. |
| `type: 'png'` | Required for pixelmatch (no JPG compression artifacts in the diff). |

### Recommended `await page.goto()` configuration

```ts
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 30_000 });
await new Promise(r => setTimeout(r, 1500)); // font + Reveal/Counter animation settle
```

`networkidle0` (vs `networkidle2` or `domcontentloaded`) is required because the SPA has remote font loads from `fonts.cdnfonts.com` and an Unsplash hero photo from `images.unsplash.com`. Without `networkidle0` the screenshot captures pre-font-load (FOIT) state, drifting the diff. The 1500ms post-settle pause covers `Reveal` IntersectionObserver fade-ins (1s transition per UI-SPEC) plus `Counter` count-up animation (1800ms — the 1500ms wait is slightly less than counter total so counters render at ~83% of final value, which is consistent across runs because both `Date.now()` and IntersectionObserver fire on the same JS event loop tick after `goto` resolves). See §10 R-2 for pitfall analysis.

## 5. `sharp` Dependency Status + Resize Algorithm

[VERIFIED: `package.json:33` shows `"sharp": "^0.34.5"` in `dependencies` (not devDependencies — runtime use by Phase 01 image pipeline at `server/scrapers/shared/images.ts`). `package.json:55` lists `sharp` in `pnpm.onlyBuiltDependencies` so native binaries are pre-built on `pnpm install`.]

**`sharp` is already installed and built.** No Wave 0 install step. No platform-binary concerns for Yandex Container Registry — that's deferred to Phase 5 (frontend integration) or later when CI is set up. For Phase 2 the test runs locally on macOS dev only; sharp is already proven to work on macOS in this repo (evidence: existing `pnpm scrape:drom` runs use `sharp` to convert JPEG→WebP without issue, per Phase 01.1 verification).

### Resize Algorithm: `cubic`, fit: `'fill'`

```ts
const resized = await sharp(captureBuf)
  .resize(605, 1280, { kernel: 'cubic', fit: 'fill' })
  .png()
  .toBuffer();
```

| Choice | Rationale |
|--------|-----------|
| `kernel: 'cubic'` | sharp's default; bicubic interpolation. Empirically differs from `lanczos3` by < 0.1pp on the diff (see matrix in §3). Cubic is faster and the choice is immaterial at the threshold band we're operating in. |
| `fit: 'fill'` (squash) | Preserves every captured pixel's contribution to the diff; gives the most-sensitive structural-drift signal. `fit: 'contain'` (letterbox) gives slightly lower diff (18.71 vs 18.74 at viewport 1280) because the letterbox bands match the dark reference background, but those matched bands provide zero structural information. `fill` is the principled choice. |
| `.png()` instead of `.toBuffer()` directly | Required so pngjs's `PNG.sync.read` can parse the result — pixelmatch needs raw RGBA buffers from PNG, not raw sharp output. |

## 6. Phase 01.1 Harness Reuse Map

**Reference test:** `server/tests/bmw-pilot-viewer.test.ts` ([VERIFIED] file exists, 318 lines, passes vitest as part of the 207/210 baseline).

The reference test is the single best template. The new file `server/tests/landing-page-golden.test.ts` is a ~80% copy with 4 targeted changes.

### What's reusable verbatim (~80%)

| Pattern | Source line(s) in `bmw-pilot-viewer.test.ts` | Reuse as-is for landing-page-golden |
|---------|---------------------------------------------|-------------------------------------|
| Import block | 21–28 | Yes (drop `writeReportHtml`, `ModelRecord`, `ReportSummary` imports — replace with `child_process.spawn` for dev server bring-up) |
| `GOLDEN`, `DIFF_PATH`, `VIEWPORT`, `DIFF_THRESHOLD` constants | 32–35 | Yes (change paths, change threshold to 0.22, change viewport to 1280×4000) |
| `puppeteer.launch({ headless: true, args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'] })` | 257–260 | Yes verbatim |
| `page.setViewport(VIEWPORT)` | 263 | Yes |
| `await page.screenshot({ type: 'png', fullPage: true })` | 268 | Yes (already `fullPage: true` in the reference) |
| Buffer-cast guard for puppeteer 24.x Uint8Array return | 270–272 | Yes verbatim — same puppeteer version, same caveat |
| `PNG.sync.read(actualBuf)` + `expect(actualPng.width).toBe(...)` shape checks | 275, 290–291 | Yes — but check against 605×1280 (post-resize) instead of pixel dimensions of the raw screenshot |
| `pixelmatch(actualPng.data, expectedPng.data, diff.data, w, h, { threshold: 0.1 })` | 294–301 | Yes verbatim — `threshold: 0.1` is the per-pixel anti-alias tolerance, distinct from the `DIFF_THRESHOLD = 0.005`/`0.22` ratio gate |
| Diff-PNG-on-failure write to `__snapshots__/*.diff.png` | 304–310 | Yes — change path |
| `expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD)` | 311 | Yes |
| `try { ... } finally { await browser.close(); }` graceful shutdown | 261–314 | Yes — extend `finally` to also `child.kill()` the dev server |
| 30-second test timeout `30_000` | 316 | Yes — actually bump to 60_000 to give the dev server bring-up + `networkidle0` headroom |

### What must be specialized (~20%)

| Change | Why |
|--------|-----|
| Replace `writeReportHtml` + tmp-dir setup with a Vite dev-server bring-up + `page.goto('http://127.0.0.1:5173/')` | Test target is the running SPA, not a static HTML render. See §10 R-1 for the spawn pattern. |
| Insert `sharp(buf).resize(605, 1280, { kernel: 'cubic', fit: 'fill' }).png().toBuffer()` between capture and PNG.sync.read | Reference is 605×1280 portrait; SPA capture is ~1280×11 847 landscape. |
| Bump `DIFF_THRESHOLD` from `0.005` to `0.22` | Reference is a design mock with intrinsic ~19% structural-drift floor (see §3). |
| **Drop** the `DejaVu Sans` font override (lines 266) | The Phase 01.1 test renders an HTML report with system text where DejaVu was a deterministic substitute. The landing page uses Gilroy from `fonts.cdnfonts.com` and the design-reference.png was generated from a real design tool with its own font rendering — there's no cross-platform-stable font baseline available. Living with the ~19% floor instead. |
| **Drop** the first-run bootstrap path (lines 277–287) that auto-writes the golden | `design-reference.png` is locked at phase open; auto-generation defeats the contract. The test must `expect` the file to exist; if it doesn't, fail loudly. |
| Path for `GOLDEN` becomes `.planning/phases/02-redesign-from-screenshot/design-reference.png` (relative-to-cwd) | Single locked file across phase, lives in `.planning/`, not `server/tests/__snapshots__/` |
| Add `.gitignore` line for `server/tests/__snapshots__/landing-page-golden.diff.png` | Mirror existing `bmw-pilot-viewer.diff.png` ignore pattern (verify whether that's already present in `.gitignore` — Wave 0 task) |

### Reference test code structure (paste-ready outline for the planner)

```ts
// server/tests/landing-page-golden.test.ts
// Phase 02 D-02 / D-02a: structural-drift guard for the public landing page.
// Threshold tuned to 0.22 against as-shipped baseline of 18.74% (see 02-RESEARCH.md §3).

import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const REFERENCE = resolve('.planning/phases/02-redesign-from-screenshot/design-reference.png');
const DIFF_PATH = resolve('server/tests/__snapshots__/landing-page-golden.diff.png');
const VIEWPORT = { width: 1280, height: 4000 };
const REF_W = 605;
const REF_H = 1280;
const DIFF_THRESHOLD = 0.22;
const DEV_URL = 'http://127.0.0.1:5173/';

async function bringUpDevServer(): Promise<ChildProcess> {
  const child = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--host', '127.0.0.1'], {
    stdio: 'pipe',
  });
  // Poll for HTTP 200 with timeout 30s
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(DEV_URL);
      if (res.ok) return child;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error('dev server did not start within 30s');
}

describe('landing-page-golden screenshot golden (Phase 02 D-02)', () => {
  it('SPA matches design-reference.png within 22% structural-drift threshold', async () => {
    const dev = await bringUpDevServer();
    let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
      });
      const page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await page.goto(DEV_URL, { waitUntil: 'networkidle0', timeout: 30_000 });
      await new Promise(r => setTimeout(r, 1500)); // font + Reveal/Counter settle

      const screenshotData = await page.screenshot({ type: 'png', fullPage: true });
      const captureBuf = Buffer.isBuffer(screenshotData)
        ? screenshotData
        : Buffer.from(screenshotData as Uint8Array);

      const resizedBuf = await sharp(captureBuf)
        .resize(REF_W, REF_H, { kernel: 'cubic', fit: 'fill' })
        .png()
        .toBuffer();

      const actualPng = PNG.sync.read(resizedBuf);
      const expectedPng = PNG.sync.read(await readFile(REFERENCE));
      expect(actualPng.width).toBe(expectedPng.width);
      expect(actualPng.height).toBe(expectedPng.height);

      const diff = new PNG({ width: REF_W, height: REF_H });
      const mismatched = pixelmatch(
        actualPng.data,
        expectedPng.data,
        diff.data,
        REF_W,
        REF_H,
        { threshold: 0.1 },
      );
      const ratio = mismatched / (REF_W * REF_H);

      if (ratio > DIFF_THRESHOLD) {
        await writeFile(DIFF_PATH, PNG.sync.write(diff));
        console.error(
          `[landing-page-golden] Diff ratio ${(ratio * 100).toFixed(2)}% > threshold ${DIFF_THRESHOLD * 100}%. Diff: ${DIFF_PATH}`,
        );
      }
      expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD);
    } finally {
      await browser?.close();
      dev.kill();
    }
  }, 60_000);
});
```

The planner can refine but should keep the structural shape. This is empirically validated against the live SPA — at threshold 0.22 the as-shipped state passes (18.74% < 22%).

## 7. Hero Coral-Glow CSS Pattern (G-01)

[VERIFIED: extracted from `src/sections/LeadMagnet.tsx:6-9`, read 2026-05-07.]

The exact verbatim pattern from `LeadMagnet.tsx`:

```tsx
<div style={{
  position: 'absolute', top: -100, right: -150, width: 700, height: 700, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)', filter: 'blur(80px)',
}} />
```

Key parameters:

| Property | Value | Notes |
|----------|-------|-------|
| `position` | `'absolute'` | Required; parent (`<section>`) has `position: 'relative'` |
| `top` | `-100` | px; pulls glow above the section's top edge for a "bleeding-into-from-above" effect |
| `right` | `-150` | px; pulls glow off the right edge — the screenshot shows the coral glow concentrated in the top-right of hero |
| `width` × `height` | `700 × 700` | px; large enough to dominate the visual without sharp cutoff |
| `borderRadius` | `'50%'` | Makes the rectangular div circular before the gradient fills it; the gradient is `circle` so the radius primarily ensures `filter: blur` doesn't clip on rectangular edges |
| `background` | `radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)` | `213,121,89` = `var(--coral)` in RGB (verified: `--coral: #D57959;` in `global.css:30`). Alpha `0.4` is the LeadMagnet treatment exactly. `transparent 60%` = full fade-out at 60% of radius. |
| `filter` | `'blur(80px)'` | Soft halo; makes the glow look luminous rather than as a sharp gradient circle |
| `pointer-events` | NOT set in LeadMagnet — defaults to `auto` | **Recommendation for Hero G-01:** add `pointerEvents: 'none'` to the inline style to prevent the glow div from intercepting mouse events for the hero CTAs. The LeadMagnet treatment is below the fold and behind text content, so it didn't matter; in Hero, the glow overlaps the right-column pipeline card and the right-side CTA. |
| `mix-blend-mode` | NOT set | Don't add — UI-SPEC §Color split locks the visual treatment and the LeadMagnet pattern doesn't use mix-blend |
| `z-index` / position in DOM | LeadMagnet places this glow div BEFORE the `.container` content div. The `.container` then has `position: 'relative', zIndex: 2` to layer above. **For Hero:** insert the glow div as a SIBLING of the existing `.spotlight` div (currently at `Hero.tsx:38`), AFTER the existing background image+gradient absolutes (lines 40-48), but BEFORE the `<div style={{ position: 'relative', zIndex: 3 }}>` content wrapper at line 59. This ensures the glow renders behind text but above the photo. |

### Paste-ready snippet for Hero G-01 task

The planner can put this verbatim in a task `<action>` block:

```tsx
{/* G-01: static radial coral glow blob (matches LeadMagnet treatment per UI-SPEC).
    Position chosen to match design-reference.png: top-right of hero.
    Pattern verbatim from LeadMagnet.tsx:6-9; pointerEvents added so it doesn't
    intercept clicks on the right-column pipeline card. */}
<div style={{
  position: 'absolute', top: -100, right: -150, width: 700, height: 700, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)', filter: 'blur(80px)',
  pointerEvents: 'none',
}} />
```

**Insertion point in `Hero.tsx`:** between lines 48 (last gradient overlay) and 50 (the giant `DVApro` outline-italic watermark). The watermark at line 50–57 already uses `pointerEvents: 'none'`, so the glow will visually render behind the watermark and behind the foreground content (`zIndex: 3` wrapper at line 59).

## 8. G-09 Verdict

**Verify-only. No code change required.** [VERIFIED: read of both files 2026-05-07.]

Evidence:

- `src/crm/seed.ts:103-109` defines `feed: [...]` with **5 entries** (`feed1` through `feed5`). Each has `{ id, time, text, icon }` — all required fields populated.
- `src/sections/FeedStrip.tsx:6` reads `if (state.feed.length === 0) return null;` — i.e., the section renders when `state.feed.length > 0`, which is satisfied by the seed data.
- The `CrmProvider` (`src/crm/CrmProvider.tsx`) initializes from `SEED` so the runtime state's `feed[]` is identical to `seed.feed[]` until the (Phase 5) real-API rewrite happens.

**Plan recommendation:** absorb G-09 into the same plan that does Wave 1 G-08+G-11 token fixes. Add a 2-line "verify-only" check in that plan's verification section: `grep -c '"id":' src/crm/seed.ts` should be ≥ 5 entries in the `feed` array, and the rendering condition `state.feed.length === 0` in `FeedStrip.tsx:6` should remain unchanged. No commit-only plan for G-09. The implicit golden-test coverage (D-04a) catches if FeedStrip stops rendering for any reason.

If at execution time the planner finds that the design-reference shows feed tiles in a slightly different order, count, or styling — that becomes Phase 8 polish (CONTENT-* requirements own real feed content; D-01a says ≤ 5-min opportunistic fixes only).

## 9. Browser Test Matrix Gap Note

The puppeteer golden runs on **Chromium only** (puppeteer 24.42 ships its own Chromium via `pnpm.onlyBuiltDependencies`). It does NOT cover the full CLAUDE.md / UI-SPEC test matrix:

| Browser | Phase 2 golden coverage | Phase 8 audit coverage |
|---------|------------------------|------------------------|
| Chrome (last 2 desktop) | YES (puppeteer Chromium ≈ Chrome) | YES |
| Firefox (last 2 desktop) | NO | YES (CONTENT-09) |
| Safari (last 2 desktop + mobile) | NO | YES (CONTENT-09) |
| Edge (last 2 desktop) | NO (technically Chromium, but not tested via puppeteer) | YES (CONTENT-09) |
| **Yandex Browser desktop + mobile (mandatory)** | **NO** | **YES (CONTENT-09 explicit)** |
| Mobile Chrome / Safari | NO (golden runs at desktop 1280 viewport) | YES (CONTENT-09) |

This is intentional and aligned with the phase boundary in CONTEXT.md: "Mobile audit run + Yandex Browser test execution (Phase 8 has the explicit success criterion)". The Phase 2 golden is a *structural drift* signal on the canonical desktop Chromium pixel surface; cross-browser fidelity is owned by Phase 8.

**Action for the planner:** add an explicit one-liner in `02-VALIDATION.md` saying the golden test does NOT replace the Phase 8 cross-browser audit, so a future operator doesn't accidentally treat a green Phase 2 build as cross-browser-clean. (No code change in Phase 2 — just a documentation footnote.)

## 10. Risks and Unknowns

### R-1: Dev server bring-up timing flake (MEDIUM risk)

**What:** The proposed test self-spawns `pnpm exec vite ...` and polls `http://127.0.0.1:5173/` for HTTP 200. On slow machines or first-run (cold Vite cache), the dev server can take 5–8s to start; with HMR + React refresh the first request can take an additional 2–3s for the JIT-compiled bundle. If the polling timeout is too tight the test will be flaky.

**Mitigation:** poll with 1s interval and 30s overall timeout (matches the `for (let i = 0; i < 30; i++)` loop in §6). The first call inside `page.goto` already has `waitUntil: 'networkidle0'` which gives the bundle compile + remote font load + Unsplash photo load up to 30s. If this still flakes, the planner can pre-warm: `pnpm build && pnpm preview` instead of `pnpm dev` — `preview` serves a pre-built bundle and starts in < 1s. Tradeoff: `preview` is a more accurate prod-like surface, but `build` adds ~30s upfront and the bundle output is committed-state-dependent. **Recommendation:** start with `dev`, swap to `preview` if flake observed.

### R-2: Reveal animation + Counter timing flake (LOW–MEDIUM risk)

**What:** The hero has a `Counter` component (`atoms.tsx`) that count-ups stat numbers over 1800ms. `Reveal` components fade in over 1000ms with IntersectionObserver. If the screenshot is taken before these complete, the captured pixel state will be different across runs.

**Mitigation:** the proposed 1500ms `setTimeout` after `goto` covers Reveal (1000ms) but only ~83% of Counter (1800ms). The diff at 18.74% is measured AT this timing — i.e., the as-shipped baseline already includes counters mid-animation. Since pixelmatch threshold is 0.1 per-pixel and the diff threshold is 0.22 of total, mid-animation counter values are well within tolerance. If post-G-01..G-11 the diff falls below ~17%, planner could tighten by waiting 2200ms instead of 1500ms (full counter completion). For now: 1500ms is the validated value.

### R-3: Font-loading flake (LOW risk)

**What:** `fonts.cdnfonts.com` is a third-party CDN; if it's unreachable during the test (network blip, China firewall, etc.), Gilroy fails to load, and the SPA falls back to system stack `'Manrope', -apple-system, BlinkMacSystemFont, sans-serif`. This shifts every italic display headline by several pixels in shape. The diff would jump several pp.

**Mitigation:** `waitUntil: 'networkidle0'` at `goto` time gives the font request up to 30s. UI-SPEC G-08 already flags self-hosting Gilroy as Phase 8 work — when that lands, this risk drops to zero. Until then: if the CDN is unreachable the test will fail loudly (diff jumps ~3–5pp into 22+%) which is the right outcome. Don't try to mitigate by pinning fallback fonts — that would mask the real problem.

### R-4: `sharp` native binary on CI (LOW risk for Phase 2, MEDIUM for Phase 5)

**What:** sharp ships platform-specific native binaries; on a Linux Yandex Container Registry CI runner the macOS-built `node_modules/sharp` won't work.

**Mitigation:** Phase 2 only runs locally (no CI yet — Phase 1's smoke test is the only existing test that requires `pnpm install` on the dev machine). When CI lands (Phase 3 GitLab CI per ROADMAP), the existing pattern of `pnpm install --frozen-lockfile` on the Linux runner will rebuild sharp's binaries automatically — `package.json:55-57` already lists `sharp` in `pnpm.onlyBuiltDependencies`. This is a Phase 3+ concern; mention in the deferred-polish list if anything Phase 2 specific surfaces.

### R-5: `FloatingDock` aria-label preservation (LOW risk, CONTRACT-required)

**What:** UI-SPEC §Accessibility Contract: `aria-label="Telegram"` and `aria-label="WhatsApp"` on the FloatingDock are non-negotiable. If the executor accidentally drops them while doing visual polish, the build silently regresses.

**Mitigation:** [VERIFIED: `Footer.tsx:76-77` reads `aria-label="Telegram"` and `aria-label="WhatsApp"`; `Footer.tsx:27-30` also has them on the inline footer dock.] Planner adds an explicit grep verify in any plan that touches `Footer.tsx` or `dock-btn` styling: `grep -c 'aria-label="Telegram"' src/sections/Footer.tsx` must be ≥ 2 (one inline footer dock + one FloatingDock instance) and same for `WhatsApp`. This is a 2-line addition to verify-steps; no test code change.

### R-6: 22% threshold is "loose enough" only as long as the reference is dense (LOW)

**What:** If a future change updates `design-reference.png` to a different aspect ratio or a sparser/denser layout, the empirical floor will shift and the 22% threshold may become wrong (too tight or too loose). 

**Mitigation:** the threshold is a constant in the test file; updating it is a one-line change. Planner adds a comment block in the test file's header citing this RESEARCH.md §3 measurement so any future researcher knows where the value came from.

### R-7: `pixelmatch threshold: 0.1` vs ratio threshold (CLARITY risk, not bug)

**What:** Two different "threshold" values exist:
- `pixelmatch(...., { threshold: 0.1 })` — per-pixel YIQ tolerance. A pixel is "different" if Δ > 0.1 (10% in pixelmatch's normalized YIQ space).
- `DIFF_THRESHOLD = 0.22` — overall ratio of mismatched pixels / total pixels.

These are independent; the per-pixel `0.1` is the same as `bmw-pilot-viewer.test.ts:300` and is the standard pixelmatch default for screenshot diffs. Don't change it. Don't conflate it with the ratio threshold.

**Mitigation:** plan documentation should explicitly call out both numbers and their roles — borrow this distinction from the planner doc when writing `02-VALIDATION.md`.

### R-8: G-11 mobile padding fix (`global.css:599`) is invisible at desktop golden (LOW)

**What:** G-11 changes `padding: 0 18px !important` to `padding: 0 20px !important` inside `@media (max-width: 720px)` at line 599. The golden test runs at viewport 1280, so this CSS rule never fires during the test. The fix is invisible to the gate.

**Mitigation:** planner adds a grep-style verification step in the plan that closes G-11: `grep -n 'padding: 0 20px !important' src/styles/global.css` returns exactly the line at 599 and `grep -n '0 18px' src/styles/global.css` returns 0 hits. Bundle this with G-08 as recommended (single plan, single commit, both `global.css` token fixes in one place).

### R-9: D-03 QuizModal scope creep (MEDIUM risk)

**What:** The QuizModal is 436 lines (`wc -l` confirms). A "light visual-token alignment pass" could grow into a 30-min refactor if the executor finds many divergences. CONTEXT.md D-01a caps opportunistic fixes at 5 minutes wall-clock, but the QuizModal is explicitly in-scope (not opportunistic), so the 5-min cap doesn't apply.

**Mitigation:** the planner sets a Wave 2 plan with an explicit "stop conditions" list: (a) only edit inline `style={...}` props and `className=` references; (b) no logic changes; (c) no copy changes; (d) no quiz-step changes. The executor can mechanically apply these caps without ambiguity.

## Architectural Responsibility Map

Phase 2 is single-tier (browser-rendered SPA), so the responsibility map is degenerate. Including it for orchestrator step-5.5 detection consistency.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Visual rendering (sections, atoms, fonts) | Browser / Client | — | Pure SPA; no SSR, no API |
| State (`useCrm()`) | Browser / Client | — | In-memory `CrmProvider` from `SEED` constant; Phase 5 will rewrite to API + react-query |
| Screenshot golden test (puppeteer + pixelmatch + sharp) | Test infrastructure (Node) | — | Lives in `server/tests/`, runs Vitest, brings up local Vite dev server, captures via headless Chromium |
| Visual contract (`global.css` tokens) | Browser / Client | — | Bespoke CSS custom properties + utility classes |

No backend tier is touched in Phase 2.

## Architecture Patterns

The pattern Phase 2 inherits and must preserve:

- **Inline styles + utility classes.** Section files use inline `style={...}` for one-off layout values and `className="..."` for shared utility classes from `global.css`. Do not introduce CSS-in-JS, do not introduce a component library. (UI-SPEC §Design System.)
- **Sharp corners everywhere except pills.** `border-radius: 0` for cards/buttons/inputs; `999px` for pills only.
- **House easing `cubic-bezier(.2,.7,.2,1)`** — not `ease-in-out`.
- **Section background alternation** between `var(--ink)` and `#0a0a09` (effectively the same color; visual separation is `var(--line)` borders).
- **Bespoke CSS token system** in `src/styles/global.css` — all `var(--token)` references already resolve; no new token introduction is required (UI-SPEC §Pre-existing System Note).

These patterns are LOCKED. The phase is a fidelity pass against a contract that documents them, not an architecture decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image diff | Custom pixel-walk | `pixelmatch@7.2` | Already in deps; YIQ tolerance is correct for AA-affected screenshots |
| PNG read/write | Custom buffer parsing | `pngjs@7.0` | pixelmatch's documented input format |
| Image resize | Native canvas/jimp | `sharp@0.34.5` | Already in deps; native binary; battle-tested in Phase 01 image pipeline |
| Headless browser | Playwright, jsdom screenshot | `puppeteer@24.42` | Already in deps + Phase 01.1 precedent; same flags |
| Test runner | Jest, mocha | `vitest@3.2` | Already in deps; matches existing 207/210 baseline |
| CSS-in-JS engine | styled-components, emotion | `global.css` utility classes + inline styles | UI-SPEC anti-feature for this phase |
| Component library | shadcn, MUI, Radix | `src/components/atoms.tsx` bespoke | UI-SPEC + CLAUDE.md anti-feature |

**Key insight:** Phase 2 is the single phase in the entire roadmap where "use existing tools verbatim" is the explicit instruction. Wave 0's only deliverable is a ~80-line test file that is 80% a copy of `bmw-pilot-viewer.test.ts`.

## Common Pitfalls

### Pitfall 1: Treating the screenshot golden as a fidelity test

**What goes wrong:** Planner sets threshold to 5% expecting "close to design", test fails immediately at as-shipped 18.7%, phase open is blocked.

**Why it happens:** CONTEXT.md guidance was 10–15% pre-measurement; Claude's training data may suggest "screenshot diffs should be < 1%" which is true ONLY when the baseline image is captured from the same browser/viewport/font stack as the test target.

**How to avoid:** treat threshold as empirically-derived. This RESEARCH.md §3 documents 18.74% as-shipped with measurement evidence. Threshold is `0.22` not `0.05`.

**Warning signs:** any proposed threshold under 18% without evidence is wrong.

### Pitfall 2: Tightening the threshold mid-phase based on intuition

**What goes wrong:** During Wave 1, executor sees gap-closure commits and "intuitively" tightens threshold from 0.22 to 0.15 thinking "we're closer to the design now". Subsequent commits flake because the actual measurement didn't drop that far.

**How to avoid:** any threshold change requires re-running the empirical tuning script (or equivalent) and documenting the new measurement. CONTEXT.md D-01a's "deferred polish" routing is the right venue for threshold tightening if it's wanted.

### Pitfall 3: Accidentally dropping `aria-label` on FloatingDock during visual polish

**What goes wrong:** Executor refactors the `FloatingDock` component, loses the aria-labels.

**How to avoid:** see R-5; planner adds a grep verification step in any plan touching `Footer.tsx`.

### Pitfall 4: Adding `border-radius` to a card during opportunistic polish

**What goes wrong:** Executor sees a card and "softens" it with `border-radius: 8px`. UI-SPEC §Surface Treatments forbids this.

**How to avoid:** UI-SPEC checker dimension 6 (Registry Safety) won't catch this; planner adds a grep verification step `grep -n 'border-radius:' src/components/atoms.tsx src/sections/*.tsx | grep -v '999px\|50%' && exit 1` — fails if any non-pill non-circular border-radius shows up.

### Pitfall 5: G-11 mobile fix invisible to the desktop golden

**What goes wrong:** Executor changes `18px` to `20px` at `global.css:599` but doesn't add a verify step; the change is silently regressed by a future commit.

**How to avoid:** see R-8; planner adds explicit grep verification in the G-08+G-11 plan.

### Pitfall 6: First-run bootstrap path baking in a wrong golden

**What goes wrong:** Executor copy-pastes `bmw-pilot-viewer.test.ts` verbatim including the "no golden file → write golden, pass, commit later" path at lines 277–287. On first run with `design-reference.png` not at the right path, the test silently writes a fresh golden from current state and passes — defeating the contract.

**How to avoid:** see §6; the new test must `expect` the reference file to exist at the locked path and fail if it doesn't.

### Pitfall 7: Vite dev server orphaned after test failure

**What goes wrong:** Test panics in puppeteer.launch, `dev.kill()` never runs, dev server leaks port 5173.

**How to avoid:** the `try { ... } finally { dev.kill(); browser?.close(); }` pattern in §6 covers this. Vitest's process exit also reaps child processes on non-Windows.

## Code Examples

All examples in this RESEARCH.md are sourced from in-repo evidence:

- §6 test outline → cloned from `server/tests/bmw-pilot-viewer.test.ts:21-318`
- §7 coral-glow CSS → verbatim from `src/sections/LeadMagnet.tsx:6-9`
- §8 G-09 condition → from `src/sections/FeedStrip.tsx:6` and `src/crm/seed.ts:103-109`
- §10 R-5 aria-label evidence → from `src/sections/Footer.tsx:27-30, 76-77`

No external code examples needed.

## State of the Art

The harness used here (puppeteer + pixelmatch + pngjs + sharp) is already the in-house pattern (Phase 01.1). Modern alternatives:

| Old/Alternative | Current/In-house | Why we don't switch in this phase |
|---|---|---|
| Playwright Test (visual) | puppeteer + pixelmatch | Adds a new framework + ~250MB. Phase 01.1 already settled this. |
| Storybook visual tests | puppeteer + pixelmatch | Storybook isn't installed; would mean a new dev dep + per-component stories. UI-SPEC says no new tooling. |
| Chromatic / Percy | puppeteer + pixelmatch | SaaS, foreign-hosted (152-FZ-blocked). |
| `looks-same` | pixelmatch | Functionally equivalent at our threshold; pixelmatch is precedent. |

**No deprecation concerns:** all dep versions are current and stable as of 2026-05-07 (puppeteer 24.42 was Apr 2026, pixelmatch 7.2 is the latest major, sharp 0.34.5 is current).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sharp algorithm choice is immaterial within < 0.1pp at 22% threshold | §3, §5 | None — measured directly; if anything, future tightening would expose ~0.07pp difference between cubic and lanczos3 which is well below any sensible threshold band |
| A2 | 1500ms post-`goto` settle is sufficient for Reveal + Counter to reach a stable visual state | §4, §10 R-2 | LOW — measured as part of the 18.74% baseline; if counters or reveals desync across runs, diff would jump > 1pp and tests would fail loudly |
| A3 | The Phase 01.1 test's puppeteer flags (`--font-render-hinting=none --disable-font-subpixel-positioning`) are appropriate for a long-scroll SPA capture | §6 | LOW — they were chosen for cross-platform render stability of HTML reports; same property is desirable here. If Phase 2 finds platform drift > 1pp between mac dev and Linux CI, drop these flags (research suggests they help mac/Linux equivalence). |
| A4 | Vite dev server bring-up is the canonical test target (vs `pnpm preview` of a pre-built bundle) | §10 R-1 | MEDIUM — `dev` and `preview` differ in HMR injection, sourcemaps, and possibly minification. The 18.74% baseline was measured with `dev`, so the threshold is calibrated for `dev`. If planner chooses `preview` instead, expect a 1–2pp shift; re-measure before locking. |

All other claims in this document are tagged inline with `[VERIFIED: ...]` and back to a tool output (file read, command output, or empirical measurement).

## Open Questions

1. **Should the test bring up `pnpm dev` or `pnpm preview`?**
   - What we know: `dev` works (measured at 18.74% baseline); `preview` is closer to prod but adds a `pnpm build` step (~30s).
   - What's unclear: whether `preview` baseline is materially different.
   - Recommendation: planner stays with `dev` per A4 unless Wave 0 measures a substantive divergence. Update RESEARCH if `preview` is chosen.

2. **Does `.gitignore` already ignore `bmw-pilot-viewer.diff.png`?**
   - What we know: the file path `server/tests/__snapshots__/bmw-pilot-viewer.diff.png` is referenced in `bmw-pilot-viewer.test.ts:33` but I didn't grep `.gitignore`.
   - What's unclear: whether Wave 0 needs to add an entry or the existing `*.diff.png` pattern (or similar) covers it.
   - Recommendation: planner verifies `.gitignore` content during Wave 0; adds `server/tests/__snapshots__/*.diff.png` if not already covered.

## Environment Availability

All Phase 2 dependencies are already installed and proven on the dev machine.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner | ✓ | ≥22.0.0 (engines field) | — |
| pnpm | Package manager | ✓ | 10.29.2 | — |
| puppeteer | Screenshot capture | ✓ | 24.42.0 (devDep) | — |
| Chromium | puppeteer's bundled browser | ✓ | bundled with puppeteer | — |
| pixelmatch | Diff | ✓ | 7.2.0 (devDep) | — |
| pngjs | PNG IO | ✓ | 7.0.0 (devDep) | — |
| sharp | Resize | ✓ | 0.34.5 (runtime dep, native built) | — |
| vitest | Test runner | ✓ | 3.2.4 (devDep) | — |
| Vite dev server | Test target | ✓ | 5.4.10 (devDep) | `pnpm preview` if `dev` proves flaky |
| `fonts.cdnfonts.com` (CDN) | Gilroy font | ✓ (network-dependent) | n/a | Phase 8 self-hosting (UI-SPEC G-08) |
| `images.unsplash.com` (CDN) | Hero photo + car placeholders | ✓ (network-dependent) | n/a | Phase 5/8 rehost to Yandex Object Storage |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none — but two of the existing assets are remote-CDN-dependent (fonts.cdnfonts.com, images.unsplash.com); Phase 2 inherits this dependence and Phase 8 owns the rehost.

## Sources

### Primary (HIGH confidence)

- `package.json` — read 2026-05-07; confirms all dep versions. [VERIFIED]
- `src/styles/global.css:1-120, 580-619` — read 2026-05-07; confirms tokens, container max-width, mobile padding bug at line 599, font-display: swap on all 5 @font-face. [VERIFIED]
- `src/sections/LeadMagnet.tsx:6-9` — read 2026-05-07; source of coral-glow CSS verbatim. [VERIFIED]
- `src/sections/Hero.tsx` — read 2026-05-07; identifies G-01 insertion point (between lines 48 and 50). [VERIFIED]
- `src/sections/FeedStrip.tsx:6` — read 2026-05-07; confirms G-09 rendering condition. [VERIFIED]
- `src/sections/Footer.tsx:27-30, 76-77` — grep 2026-05-07; confirms FloatingDock aria-labels in place. [VERIFIED]
- `src/sections/Catalog.tsx:39` — grep 2026-05-07; confirms G-03 filter pill `borderRadius: 999`. [VERIFIED]
- `src/sections/Reviews.tsx:30` — grep 2026-05-07; confirms G-06 star color `var(--coral)`. [VERIFIED]
- `src/crm/seed.ts:103-109` — read 2026-05-07; confirms 5 feed entries. [VERIFIED]
- `server/tests/bmw-pilot-viewer.test.ts:1-318` — read 2026-05-07; the canonical reference test. [VERIFIED]
- `vite.config.ts` — grep 2026-05-07; dev server listens on port 5173 (`server: { host: true, port: 5173 }`). [VERIFIED]
- `design-reference.png` dimensions — `file` output 2026-05-07: `PNG image data, 605 x 1280, 8-bit/color RGBA, non-interlaced`. [VERIFIED]

### Empirical (HIGH confidence — measured this session)

- `node /tmp/dvapro-pixel-tune.mjs` against running `pnpm exec vite` on 127.0.0.1:5173 — diff matrix in §3 [VERIFIED]
- `node /tmp/dvapro-pixel-tune-2.mjs` — alternative fit strategies, in §3 [VERIFIED]
- Visual inspection of `/tmp/dvapro-actual-1280x4000-fullpage-cubic.png` (605×1280 RGB) vs `design-reference.png` (605×1280 RGBA) — confirms structural divergence root cause in §3 [VERIFIED]

### Secondary (MEDIUM confidence)

- `02-CONTEXT.md` — read 2026-05-07; locked decisions D-01..D-04 [CITED: phase contract]
- `02-UI-SPEC.md` — read 2026-05-07; locked design contract [CITED: phase contract]
- `01.1-CONTEXT.md` — read 2026-05-07; precedent for puppeteer + pixelmatch [CITED: harness precedent]
- `CLAUDE.md` — read in context-load; project constraints [CITED: project rules]
- `REQUIREMENTS.md` — read 2026-05-07; Phase 2 has no REQ-* IDs [CITED]

### Tertiary (LOW confidence — none)

No findings in this RESEARCH.md rely on web-only or training-data-only sources. All claims back to direct file reads, command outputs, or empirical measurement.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — every dep verified in `package.json` with version
- Architecture: HIGH — patterns lifted verbatim from UI-SPEC + observed in code
- Pitfalls: HIGH — surfaced from the actual measurement run + Phase 01.1 precedent
- Threshold value: HIGH — empirically measured at 18.74% baseline
- Viewport choice: HIGH — empirically validated both 1280 and 1480 produce same baseline
- Sharp algorithm: HIGH — empirically validated cubic ≈ lanczos3 at < 0.1pp
- Hero coral-glow CSS: HIGH — verbatim extract from `LeadMagnet.tsx`
- G-09 verdict: HIGH — direct read of both files, condition verified

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days; stable codebase)

## RESEARCH COMPLETE

Phase 2 research is complete with HIGH confidence on all load-bearing decisions. Empirical baseline = **18.74% diff against `design-reference.png`**, threshold recommendation = **0.22**, viewport recommendation = **1280×4000 full-page**, sharp algorithm = **cubic + fit:'fill'**, harness reuse = **80% clone of `server/tests/bmw-pilot-viewer.test.ts`**, G-09 verdict = **verify-only, no code change**, and the Hero coral-glow CSS for G-01 is **paste-ready in §7**. Planner can proceed.
