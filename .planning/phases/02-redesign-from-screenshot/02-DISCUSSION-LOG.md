# Phase 02: Redesign from Screenshot - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 02-redesign-from-screenshot
**Areas discussed:** Scope of fidelity sweep, Verification gate, Quiz modal in/out, Plan granularity / waves

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Scope of fidelity sweep | Strict G-01..G-11 vs broader polish + seed.ts touch-up | ✓ |
| Verification gate | Manual review vs puppeteer+pixelmatch vs both vs checklist | ✓ |
| Quiz modal in/out | In/out for QuizModal visual fidelity | ✓ |
| Plan granularity / waves | Section-by-section vs gap-bundle vs two-big vs Wave-0+per-gap | ✓ |

**User's choice:** All four areas selected (multi-select).

---

## Area 1: Scope of fidelity sweep

### Sub-question 1: Sweep scope

| Option | Description | Selected |
|--------|-------------|----------|
| Strict gap list — only G-01..G-11 | Tight scope, predictable plan size; misses unlisted divergences | |
| Gap list + opportunistic fixes | Close G-01..G-11 + obvious 1-line fixes; bigger items deferred | ✓ |
| Full fidelity sweep with running tally | Maximum fidelity; phase duration unbounded | |
| Strict list + one cleanup wave at end | Bounded sweep at end | |

**User's choice:** Gap list + opportunistic fixes.
**Notes:** Honors the 4–6 week launch deadline while not shipping with visible-but-unlisted divergences.

### Sub-question 2: Polish ceiling

| Option | Description | Selected |
|--------|-------------|----------|
| ≤ 5 lines of code, no new files | Code-shape heuristic | |
| Same section, no new dependency | Same-section, no new dep heuristic | |
| Founder discretion per fix | Per-item checkpoint | |
| ≤ 5 min wall-clock | Time-budget heuristic, executor's judgement | ✓ |

**User's choice:** ≤ 5 min wall-clock.
**Notes:** Captured as D-01a in CONTEXT.md. Bigger items go to `02-DEFERRED-POLISH.md` running list.

---

## Area 2: Verification gate

### Sub-question 1: Done gate

| Option | Description | Selected |
|--------|-------------|----------|
| Per-gap commit + final founder review | Subjective, no regression guard | |
| Puppeteer + pixelmatch screenshot golden | Reuses Phase 01.1 harness; CI regression guard | ✓ |
| Both — founder review + screenshot golden | Subjective + objective check, more setup | |
| Manual checklist per section | Traceable, no automated guard | |

**User's choice:** Puppeteer + pixelmatch screenshot golden.
**Notes:** Phase 01.1 already has `puppeteer 24.42`, `pixelmatch 7.2`, `pngjs 7.0` in devDeps. The `bmw-pilot-viewer.test.ts` pattern is the precedent.

### Sub-question 2: Golden source

| Option | Description | Selected |
|--------|-------------|----------|
| Captured rendered-SPA at approved state | New puppeteer capture as the golden | |
| design-reference.png itself | Compare rendered SPA directly against the screenshot | ✓ |
| Per-section goldens, not whole-page | Granular failure messages | |
| Whole-page + per-section combo | Slowest, most diagnostic | |

**User's choice:** design-reference.png itself.
**Notes:** Claude flagged that the rendered SPA at full viewport won't pixel-match the compressed thumbnail directly — required a follow-up sub-question.

### Sub-question 3: Diff strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Resize + high threshold | Capture → sharp.resize → pixelmatch with 10–15% threshold | ✓ |
| Recapture at full-res, design-reference.png as human spec | Same as Phase 01.1 pattern; design-reference.png is intent only | |
| Replace design-reference.png with a high-res reference | Founder delivers new asset | |
| Just keep my answer — design-reference.png as-is | No extra setup, weak guard | |

**User's choice:** Resize + high threshold.
**Notes:** Captured as D-02a. Treats the test as a structural-drift guard, not a fidelity test. Researcher tunes the exact threshold against as-shipped state.

---

## Area 3: Quiz modal in/out

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope — don't touch | Tight scope; visible jank on click-through | |
| Same global tokens, no structural fixes | Verify token changes don't break modal | |
| Light pass: align quiz visual to landing tokens | Walk modal once, fix visual divergences against UI-SPEC tokens | ✓ |
| Full quiz fidelity pass | Redesign under same contract; spec missing | |

**User's choice:** Light pass: align quiz visual to landing tokens.
**Notes:** No copy/logic/step changes. No screenshot test for quiz modal — no reference image exists.

---

## Area 4: Plan granularity / waves

### Sub-question 1: Plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| Section-by-section plans | One plan per section: ~10–11 plans, 2–3 waves | ✓ |
| Gap-bundle plans | Group by type: ~6 plans, 3 waves | |
| Two big plans | Minimal overhead, hard to checkpoint | |
| Wave 0 setup + per-gap plans + final cleanup | ~7–9 plans across ~4 waves | |

**User's choice:** Section-by-section plans.
**Notes:** Required follow-up because UI-SPEC marks several sections "matches — no change needed" (FeedStrip, Process, Reviews-confirm, Nav, Mobile).

### Sub-question 2: Verify-only sections

| Option | Description | Selected |
|--------|-------------|----------|
| Skip those sections entirely — no plan | Cleaner, only real-gap sections planned | |
| Verify-plan: 1 confirm commit per section | Full coverage, traceable, mostly no-op | |
| Single 'sweep' plan covering all verify-only sections | One sweep + per-gap plans | |
| Verify in the golden-test plan | Whole-page screenshot implicitly verifies all sections | ✓ |

**User's choice:** Verify in the golden-test plan.
**Notes:** No separate verify-only plans. The puppeteer golden test (D-02) implicitly covers FeedStrip, Process, Nav, Mobile, Reviews-confirm. Captured as D-04a.

---

## Claude's Discretion

The following were explicitly delegated to researcher / planner during discussion:

- Pixelmatch threshold value (10–15% guidance band; researcher tunes)
- Standardized puppeteer viewport dimensions (1280×4000+ suggested, planner picks)
- `sharp.resize()` algorithm (`cubic` vs `lanczos3`)
- Whether G-09 needs an actual code change (`seed.ts.feed[]` already populated)
- Hero coral-glow blob exact gradient stops/opacity/position (G-01)
- Whether to bundle G-08 + G-11 into one global.css plan or split
- Which inline styles to tighten in QuizModal light-pass (D-03)

## Deferred Ideas

Surfaced or implied during discussion, captured in CONTEXT.md `<deferred>`:

- Real founder photos / bios / reviews / cars → Phase 8
- US/UAE/Europe flags + multi-market copy → Phase 8
- Self-hosting Gilroy → Phase 8
- `CrmProvider` rewrite → Phase 5
- Mobile audit + Yandex Browser test run → Phase 8
- Yandex Metrika install → Phase 8
- Per-section pixelmatch goldens (rejected in Area 2 sub-question)
- Founder visual-review-as-formal-gate (rejected per D-02b)
- Quiz copy/logic/step changes → Phase 6
- Phase 01.2 `hybrid_type` regex follow-up → out-of-phase awareness only
- Polish items > 5 min wall-clock → `02-DEFERRED-POLISH.md` running list, folded into Phase 8 at close
