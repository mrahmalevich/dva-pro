# Phase 02: Redesign from Screenshot - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 is a **visual fidelity pass** on the existing public landing page (`src/sections/*`) to close the gap between the current implementation and `design-reference.png`. All 10 sections (Hero, Marquee, Catalog, FeedStrip, Process, Founders, LeadMagnet, Reviews, FAQ, Footer) plus FloatingDock and QuizModal already exist in code. The visual contract is **locked in `02-UI-SPEC.md`** (status: approved). Phase 2 does not introduce new sections, new component libraries, or new framework adoption.

**In phase:**
- Close the 11 enumerated gaps G-01..G-11 from UI-SPEC §Gap Analysis
- Opportunistic ≤5-min wall-clock fixes encountered during execution
- Light visual-token alignment pass on QuizModal (no copy/logic changes)
- Puppeteer + pixelmatch screenshot golden harness for the public landing page
- `seed.ts` data touch-up only where needed to make a section render (G-09 feed visibility)
- Mobile container padding fix at `src/styles/global.css:599` (G-11: 18px → 20px)

**Out of phase (handled elsewhere):**
- `CrmProvider` rewrite onto real API + react-query (Phase 5)
- US/UAE/Europe flags + multi-market Hero/Catalog/FAQ copy (Phase 8)
- Real founder photos + bios + ≥6 real reviews + ≥12 real cars (Phase 8)
- Self-hosting Gilroy fonts (deferred to Phase 8 per UI-SPEC G-08)
- Mobile audit run + Yandex Browser test execution (Phase 8 has the explicit success criterion)
- Yandex Metrika installation (Phase 8)
- Quiz copy/logic/step changes (Phase 6 lead flow)
- New shadcn/component library adoption (locked anti-feature)
- Next.js migration (locked anti-feature)

</domain>

<decisions>
## Implementation Decisions

### Scope of fidelity sweep

- **D-01:** Close G-01..G-11 strictly + opportunistic small fixes during execution. Anything bigger gets logged as a deferred-to-Phase-8 polish item, NOT silently expanded into the current plan.
- **D-01a:** "Opportunistic" = **≤ 5 minutes wall-clock** at the executor's judgement. If the executor estimates a fix exceeds 5 min (new file, new asset, new dep, multi-file refactor, new section), they STOP, append it to a `02-DEFERRED-POLISH.md` running list inside the phase directory, and continue. The deferred list is reviewed at phase close and either folded into Phase 8 (preferred) or its own polish phase.

### Verification gate

- **D-02:** Phase 2 completion is gated by a **puppeteer + pixelmatch screenshot golden test** against the public landing page. Reuses the harness already pinned by Phase 01.1 (`puppeteer 24.42`, `pixelmatch 7.2`, `pngjs 7.0` already in `devDependencies`). The test is a CI-blocking regression guard, mirroring `bmw-pilot-viewer.test.ts` precedent.
- **D-02a:** **Diff strategy:** Puppeteer captures the rendered SPA at a standardized viewport (planner picks exact dimensions; suggested 1280×4000+ full-page). `sharp.resize()` downscales the capture to `design-reference.png`'s native dimensions (~225×388px or whatever the asset reports), then `pixelmatch` runs with a relaxed threshold (~10–15%; **researcher tunes against the as-shipped state**). Treat the test as a **structural-drift guard** rather than a fidelity test — the dimension/font/anti-aliasing mismatch makes it inherently coarse. This is intentional; the design fidelity itself is achieved by closing G-01..G-11 line-by-line, not by the pixel test.
- **D-02b:** **No formal founder visual-review checkpoint is required to gate phase close.** Founder approval of the as-shipped state is implicit in commit acceptance. (If founder later wants a visual review step added, it can be inserted as a standalone checkpoint plan without disturbing the rest of the plan structure.)

### Quiz modal scope

- **D-03:** **Light visual-token alignment pass** on `src/quiz/QuizModal.tsx` (436 lines). Walk the modal once, fix any clear visual divergences against the same UI-SPEC tokens (color, button styles, spacing, typography). **No copy changes, no quiz-step structure changes, no logic changes.** The screenshot golden test does NOT cover the quiz modal — no reference image exists for it. Quiz fidelity is bounded by "uses the same global tokens as the landing page".

### Plan granularity / waves

- **D-04:** **Section-by-section plans.** One plan per section that has a real gap; sections marked "matches — no change needed" in UI-SPEC §Gap Analysis (FeedStrip G-04, Process G-05, Reviews G-06 confirm only, Nav G-07, Mobile G-10) get **no dedicated verify-plan** — they are implicitly verified by the puppeteer golden test (D-04a).
- **D-04a:** **"Matches" sections are verified through the golden test, not via separate plans.** No verify-only commits. The pixel diff (even at relaxed threshold) catches gross structural regressions in those sections.
- **D-04b:** Suggested plan inventory (planner refines):
  - Wave 0 (foundation): puppeteer + pixelmatch golden harness setup + initial baseline capture
  - Wave 1 (parallelisable, worktree-friendly):
    - Hero polish (G-01: static radial coral glow blob)
    - global.css token fixes (G-08 confirm `font-display: swap`, G-11 mobile padding 18→20px)
    - Catalog (G-03 confirm pill `border-radius: 999px`, opportunistic)
    - FeedStrip data fix (G-09 ensure `seed.ts.feed[]` populated → already populated; verify the rendering condition is acceptable)
    - Reviews (G-06 confirm star color is `var(--coral)`, opportunistic)
  - Wave 2: QuizModal light visual-token alignment pass (D-03)
  - Wave 3 (gate): re-capture baseline + run pixelmatch golden + close phase
- **D-04c:** Plans are kept small (single-section, single-deliverable) so each commit is independently revertable and the wave structure is parallelisable in worktrees (matches Phase 01.x precedent of 6-16 plans across 3-11 waves).

### Claude's Discretion

The following are explicitly delegated to the researcher and planner:

- **Pixelmatch threshold value** — D-02a sets a 10–15% guidance band; researcher tunes against actual as-shipped output and explains the choice in `02-RESEARCH.md`.
- **Standardized puppeteer viewport** — width/height the golden test uses (D-02a). Suggested 1280×4000+ full-page; planner may pick 1480×N to match `--max-width` of `.container`.
- **`sharp.resize()` algorithm** — `cubic` vs `lanczos3` for the downscale; either is fine for a structural-drift test.
- **Whether G-09 needs a code change at all** — `seed.ts.feed[]` currently has 5 entries (verified during scout). The "renders only when `state.feed.length > 0`" condition is already satisfied. The G-09 plan may be a 1-line "verify only" with no commit required if the researcher confirms the rendering condition is sound.
- **Hero coral-glow blob exact gradient stops, opacity, and position** — UI-SPEC G-01 says "similar to LeadMagnet treatment". Executor matches the LeadMagnet glow's CSS pattern.
- **Whether to bundle the 2 global.css token fixes (G-08 + G-11) into one plan or split** — planner picks based on test-readability.
- **QuizModal pass detail** — which inline styles to tighten; light-pass means executor's judgement on what to touch within token-alignment scope.
- **Phase 01.2 follow-up `hybrid_type` regex fix (5-min quick task per STATE.md)** — NOT folded into Phase 2; it's a Phase 03 importer concern. Captured here only to confirm we're aware it exists.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract (read first)
- `.planning/phases/02-redesign-from-screenshot/02-UI-SPEC.md` — **LOCKED visual contract**, status: approved. Source of truth for design system, color, typography, spacing, surfaces, motion, copy, components, breakpoints, gap analysis (G-01..G-11), and accessibility contract.
- `.planning/phases/02-redesign-from-screenshot/design-reference.png` — design intent (human-readable spec); used by D-02a as the literal pixelmatch target after `sharp.resize()`.

### Project-level constraints
- `CLAUDE.md` — frontend stack lock (React 18 + Vite + TS + react-router; no Next.js, no shadcn), browser test matrix (incl. Yandex Browser), RU locale only
- `.planning/PROJECT.md` — locked stack, 152-ФЗ posture, anti-features (no e-commerce, no per-car detail pages, no mobile app, no EN locale)
- `.planning/STATE.md` — current position (Phase 01.2 closed; Phase 02 inserted 2026-05-07); reorder log; carrying-forward decisions
- `.planning/ROADMAP.md` §Phase 2 (line 126) — phase goal and dependency on Phase 1; §Reorder Log entry 2026-05-07 explaining insertion
- `.planning/REQUIREMENTS.md` — note: Phase 2 itself does NOT consume requirement IDs (it's a fidelity pass on existing UI); Phase 5/6/8 own the requirements that touch this code later

### Phase 01.1 precedent (mandatory read for D-02 harness)
- `.planning/phases/01.1-extend-drom-scrape-fields/01.1-CONTEXT.md` — pixelmatch + puppeteer + pngjs harness was first introduced here
- `server/tests/bmw-pilot-viewer.test.ts` (or current location) — concrete reference implementation for screenshot-golden + pixelmatch
- `package.json` `devDependencies` — `puppeteer 24.42`, `pixelmatch 7.2`, `pngjs 7.0` already installed (Phase 01.1 work)

### Codebase entry points (read before planning each section plan)
- `src/styles/global.css` — bespoke CSS tokens, utility classes, breakpoints; line 599 has the G-11 mobile-padding bug to fix
- `src/components/atoms.tsx` — `Logo`, `Icon`, `FlagFor`, `Live`, `Chip`, `CarPlaceholder`, `FounderPortrait`, `Reveal`, `Counter` (do NOT structurally change in this phase)
- `src/components/Nav.tsx` — fixed nav (G-07 confirmed)
- `src/sections/Hero.tsx` — G-01 work lands here
- `src/sections/Marquee.tsx`, `Catalog.tsx`, `FeedStrip.tsx`, `Process.tsx`, `Founders.tsx`, `LeadMagnet.tsx`, `Reviews.tsx`, `Faq.tsx`, `Footer.tsx` — section files for the fidelity pass
- `src/quiz/QuizModal.tsx` (436 lines) — D-03 light pass target; do NOT change `quizSpec.ts`
- `src/crm/seed.ts` — verified during scout: 6 cars, 6 timeline steps, 6 FAQ items, 3 reviews, 5 feed events, settings populated; G-09 may not need a code change

### Out-of-phase references (so planner doesn't redo)
- `.planning/research/STACK.md` — frontend stack lock
- `.planning/research/ARCHITECTURE.md` — section ordering reference for Phase 5 `CrmProvider` rewrite

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Puppeteer + pixelmatch + pngjs harness** is already a `devDependency` (Phase 01.1 introduced it). The Wave 0 plan reuses the test-runner pattern from `bmw-pilot-viewer.test.ts` rather than scaffolding from scratch.
- **All UI atoms** (`Logo`, `Icon`, `FlagFor`, `Reveal`, `Counter`, `Live`, `Chip`, `CarPlaceholder`, `FounderPortrait`) are stable; do not modify their structure during fidelity pass.
- **Bespoke CSS token system** in `src/styles/global.css` — all `var(--token)` references already resolve; no new token introduction is required (UI-SPEC §Pre-existing System Note explicitly forbids new font sizes/weights).

### Established Patterns
- **Inline styles in TSX + global utility classes** (`.btn`, `.card`, `.h1`, etc.) — extend via additional utility classes, not via CSS-in-JS. Inline for one-off layout. (UI-SPEC §Design System.)
- **Sharp corners everywhere except pills** — `border-radius: 0` for cards/buttons/inputs, `999px` for pills only. Do not introduce intermediate radii.
- **House easing `cubic-bezier(.2,.7,.2,1)`** — UI-SPEC §Animation. Do not use `ease-in-out` for entrance animations.
- **Section background alternation between `var(--ink)` and `#0a0a09`** — same color; visual separation comes from `var(--line)` borders, not contrast.
- **Phase 01.x test pattern** — fixture-driven unit tests + a final "manual gate" plan (autonomous: false) for the live verification step. Phase 2's Wave 3 mirrors this with the founder-implicit-acceptance + golden-test gate.

### Integration Points
- **From this phase to Phase 5:** `CrmProvider` rewrite must keep the `useCrm()` consumer contract from changing. Phase 2 does NOT touch `src/crm/`; if a section fix needs more state, log it as deferred so Phase 5 can adapt.
- **From this phase to Phase 6:** `QuizModal` light visual pass (D-03). Phase 6 still owns the lead-flow logic, success-step copy, idempotency, and the LEAD-* requirements. Phase 2 ONLY touches the visual tokens used inside the modal.
- **From this phase to Phase 8:** the deferred-polish list (D-01a) feeds Phase 8's mobile audit + content polish + multi-market UI work.
- **CSS token surface:** `src/styles/global.css` is the single source of truth. Section files reference `var(--token)`. The G-11 fix at line 599 is the only `global.css` change Phase 2 strictly requires.

</code_context>

<specifics>
## Specific Ideas

- **Reuse the Phase 01.1 puppeteer+pixelmatch harness verbatim where possible** — the foundation is already in `devDependencies` and the test file pattern (capture → resize → pixelmatch → fail-on-diff) is proven against `bmw-pilot-viewer.test.ts`. Wave 0's job is to specialize the pattern for a public-landing capture, not to introduce new tooling.
- **`design-reference.png` IS the pixelmatch target** (after `sharp.resize()` to its native dimensions). Even though the dimension/font mismatch makes the threshold loose (~10–15%), the founder picked this option deliberately so the screenshot acts as both human-readable spec AND machine-readable structural anchor. Researcher should document the exact tuned threshold + rationale in `02-RESEARCH.md`.
- **Mobile padding bug at `global.css:599`** is the concrete trigger for the G-11 plan. Current value `padding: 0 18px !important` (not a multiple of 4); fix to `0 20px !important`. UI-SPEC §Spacing Scale already declares this exception inline.
- **No new component library, no shadcn init, no CSS-in-JS** — UI-SPEC §Design System: "Do NOT introduce a component library or CSS-in-JS in this phase." Extend `global.css` for new utility classes; use inline styles in TSX for one-off layout values.
- **No new font sizes or weights** — UI-SPEC §Typography: 12 size roles + 4 active weights are pre-existing; weight 300 is loaded but explicitly forbidden in any new code added in this phase.
- **Aria-labels on FloatingDock are non-negotiable** — UI-SPEC §Accessibility Contract. If executor touches `FloatingDock` styling for opportunistic fixes, the `aria-label="Telegram"` and `aria-label="WhatsApp"` MUST be preserved.

</specifics>

<deferred>
## Deferred Ideas

These came up during discussion or surfaced in upstream phases and belong elsewhere:

- **Real founder photos + bios + ≥6 reviews + ≥12 cars** — Phase 8 polish (CONTENT-* requirements). Phase 2 keeps Unsplash-placeholder car images and seed.ts founder bios as-is.
- **US/UAE/Europe flags + multi-market Hero/Catalog/FAQ copy + 6-flag `FlagFor`** — Phase 8 (CONTENT-01..06). UI-SPEC explicitly notes "US/AE/EU flags added in Phase 8".
- **Self-hosting Gilroy** to avoid third-party CDN (`fonts.cdnfonts.com`) — Phase 8 polish (UI-SPEC G-08 calls this out as deferred).
- **`CrmProvider` rewrite onto real API + react-query** — Phase 5 (LEGAL-* requirements; FE integration phase).
- **Mobile audit + Yandex Browser test execution** — Phase 8 (CONTENT-04 success criterion explicitly covers this; Phase 2 only ensures code is structurally correct).
- **Yandex Metrika install + 4 conversion goals** — Phase 8 (ANALYTICS-01..03).
- **Per-section pixelmatch goldens (whole-page + per-section combo)** — considered (Area 2 sub-question), rejected in favor of single whole-page golden. Revisit only if regressions in Phase 5/8 prove hard to localize.
- **Founder-review-as-formal-gate** — considered (Area 2 sub-question), rejected per D-02b. Founder can request it later as a one-off checkpoint plan without disturbing the rest of the structure.
- **Polish items >5min wall-clock** — D-01a routes these to a `02-DEFERRED-POLISH.md` running list inside the phase directory. Reviewed at phase close, folded into Phase 8 by default.
- **Quiz copy / logic / step changes** — Phase 6 lead flow E2E owns the LEAD-* requirements; D-03 explicitly excludes copy/logic from Phase 2.
- **Phase 01.2 follow-up `hybrid_type` regex fix** — STATE.md notes this 5-min quick task; NOT folded into Phase 2 (different concern: drom scraper, not landing page). Captured here only as awareness.
- **Per-car detail pages, e-commerce checkout, mobile app, EN locale, real customs formulas, USS scraping, Bitrix24 sync** — anti-features (PROJECT.md §Out of Scope). Will not surface in this or any v1 phase.

</deferred>

---

*Phase: 02-redesign-from-screenshot*
*Context gathered: 2026-05-07*
