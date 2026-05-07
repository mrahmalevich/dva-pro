# Phase 02: redesign-from-screenshot — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 7 (1 create, 6 modify)
**Analogs found:** 7 / 7 (100% — every file has an in-repo analog)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `server/tests/landing-page-golden.test.ts` (CREATE) | test (vitest integration) | request-response (puppeteer→sharp→pixelmatch) | `server/tests/bmw-pilot-viewer.test.ts` | exact (same role, same data flow, same library set) |
| `.gitignore` (VERIFY-ONLY — already covered) | config | n/a | existing `server/tests/__snapshots__/*.diff.png` line | exact (wildcard already matches new diff PNG) |
| `src/sections/Hero.tsx` (MODIFY — G-01) | component (section) | render | `src/sections/LeadMagnet.tsx` | exact (same coral-glow CSS pattern, same insertion convention) |
| `src/styles/global.css:599` (MODIFY — G-11) | config (CSS) | render | `src/styles/global.css:69` (`.container { padding: 0 20px }`) | exact (same selector, same property, fix to align with declared mobile token) |
| `src/styles/global.css` `@font-face` (VERIFY G-08) | config (CSS) | render | `src/styles/global.css:1-27` (5 `@font-face` blocks, all already have `font-display: swap`) | already-correct (verify-only) |
| `src/quiz/QuizModal.tsx` (MODIFY — D-03 light pass) | component (modal) | render | section-file inline-style convention (e.g. `Hero.tsx`, `LeadMagnet.tsx`, `Reviews.tsx`) | partial (modal-specific class system, but token usage rules apply) |
| `src/sections/Catalog.tsx:39` (READ-ONLY — G-03) | component (section) | render | self — `borderRadius: 999` already present | already-correct (verify-only) |
| `src/sections/Reviews.tsx:30` (READ-ONLY — G-06) | component (section) | render | self — `color: 'var(--coral)'` already present | already-correct (verify-only) |
| `src/crm/seed.ts` + `src/sections/FeedStrip.tsx:6` (READ-ONLY — G-09) | model (seed) + component | data | self — 5 entries in `feed[]`, condition `state.feed.length === 0` returns null | already-correct (verify-only) |
| `src/sections/Footer.tsx` (CONTRACT-VERIFY — R-5) | component (section) | render | self — 2 `aria-label="Telegram"` + 2 `aria-label="WhatsApp"` already present | already-correct (verify-only) |

---

## Pattern Assignments

### `server/tests/landing-page-golden.test.ts` (CREATE — test, request-response)

**Analog:** `server/tests/bmw-pilot-viewer.test.ts` (318 lines; clone ~80% of structure)

**Reuse summary** (verbatim from RESEARCH.md §6 with line refs to the analog):

| Pattern | Source line(s) in `bmw-pilot-viewer.test.ts` | Reuse |
|---------|---------------------------------------------|-------|
| Import block | 21–28 | Yes — drop `writeReportHtml`, `ModelRecord`, `ReportSummary`; add `node:child_process` for dev-server bring-up + `sharp` import |
| Constants block | 32–35 | Yes — change `GOLDEN`/`DIFF_PATH` paths, change `DIFF_THRESHOLD` from `0.005` to `0.22`, change `VIEWPORT` to `{ width: 1280, height: 4000 }` |
| `puppeteer.launch({ headless: true, args: [...] })` | 257–260 | Yes — verbatim |
| `page.setViewport(VIEWPORT)` | 263 | Yes |
| `page.screenshot({ type: 'png', fullPage: true })` | 268 | Yes (already `fullPage: true`) |
| Buffer cast guard for puppeteer 24.x `Uint8Array` | 270–272 | Yes — same puppeteer version, same caveat |
| `PNG.sync.read(actualBuf)` shape checks | 275, 290–291 | Yes — but check 605×1280 (post-resize) |
| `pixelmatch(... { threshold: 0.1 })` | 294–301 | Yes — `0.1` is per-pixel YIQ tolerance, distinct from ratio threshold |
| Diff-PNG-on-failure write | 304–310 | Yes — change path |
| `expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD)` | 311 | Yes |
| `try { ... } finally { browser.close() }` graceful shutdown | 261–314 | Yes — extend `finally` to `dev.kill()` the dev-server child |
| Test timeout `30_000` | 316 | Bump to `60_000` for dev-server bring-up + `networkidle0` headroom |

**Specialization (~20%):**

| Change | Why |
|--------|-----|
| Replace `writeReportHtml` + tmp-dir setup with `child_process.spawn('pnpm', ['exec', 'vite', ...])` + readiness-poll + `page.goto('http://127.0.0.1:5173/')` | Test target is the running SPA, not a static HTML render |
| Insert `sharp(buf).resize(605, 1280, { kernel: 'cubic', fit: 'fill' }).png().toBuffer()` between `page.screenshot` and `PNG.sync.read` | Reference is 605×1280; SPA capture is ~1280×11 847 |
| Bump `DIFF_THRESHOLD` from `0.005` to `0.22` | Reference is a design mock with intrinsic ~19% structural-drift floor (RESEARCH.md §3 measured 18.74% as-shipped; 22% gives 3.26pp safety band) |
| **Drop** the `DejaVu Sans` font override (analog line 266) | SPA uses Gilroy from `fonts.cdnfonts.com`; no cross-platform-stable font baseline — living with the ~19% floor |
| **Drop** the first-run bootstrap path (analog lines 277–287) that auto-writes the golden | `design-reference.png` is locked at phase open; auto-generation defeats the contract — `expect` the file to exist; fail loudly if missing |
| `GOLDEN` (renamed `REFERENCE`) path = `.planning/phases/02-redesign-from-screenshot/design-reference.png` | Single locked file across phase, lives in `.planning/`, not `server/tests/__snapshots__/` |

**Imports excerpt** (from `bmw-pilot-viewer.test.ts:21-28`):

```ts
import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
```

For the new file, drop `mkdir`, `mkdtempSync`, `tmpdir`, `join` from the analog set (no tmp dir needed) and add:

```ts
import sharp from 'sharp';
import { spawn, type ChildProcess } from 'node:child_process';
```

**Constants pattern** (from `bmw-pilot-viewer.test.ts:32-35`):

```ts
const GOLDEN = resolve('server/tests/__snapshots__/bmw-pilot-viewer.png');
const DIFF_PATH = resolve('server/tests/__snapshots__/bmw-pilot-viewer.diff.png');
const VIEWPORT = { width: 1280, height: 1600 };
const DIFF_THRESHOLD = 0.005; // 0.5% per SPEC R-8
```

For the new file (per RESEARCH.md §1 + §3 + §4 + §5):

```ts
const REFERENCE = resolve('.planning/phases/02-redesign-from-screenshot/design-reference.png');
const DIFF_PATH = resolve('server/tests/__snapshots__/landing-page-golden.diff.png');
const VIEWPORT = { width: 1280, height: 4000 };
const REF_W = 605;
const REF_H = 1280;
const DIFF_THRESHOLD = 0.22; // 22% — empirical as-shipped floor 18.74% + 3.26pp safety band, see 02-RESEARCH.md §3
const DEV_URL = 'http://127.0.0.1:5173/';
```

**Puppeteer launch pattern** (from `bmw-pilot-viewer.test.ts:257-260`, reuse verbatim):

```ts
const browser = await puppeteer.launch({
  headless: true,
  args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
});
```

**Capture + Buffer-cast pattern** (from `bmw-pilot-viewer.test.ts:268-272`, reuse verbatim):

```ts
const screenshotData = await page.screenshot({ type: 'png', fullPage: true });
// puppeteer 24.x returns Uint8Array; pngjs requires a Node.js Buffer.
const actualBuf = Buffer.isBuffer(screenshotData)
  ? screenshotData
  : Buffer.from(screenshotData as Uint8Array);
```

**Diff + threshold pattern** (from `bmw-pilot-viewer.test.ts:289-311`, paths and dimensions adapted):

```ts
const expectedPng = PNG.sync.read(goldenBuf);
expect(actualPng.width).toBe(expectedPng.width);
expect(actualPng.height).toBe(expectedPng.height);

const diff = new PNG({ width: actualPng.width, height: actualPng.height });
const mismatched = pixelmatch(
  actualPng.data,
  expectedPng.data,
  diff.data,
  actualPng.width,
  actualPng.height,
  { threshold: 0.1 },
);
const ratio = mismatched / (actualPng.width * actualPng.height);

if (ratio > DIFF_THRESHOLD) {
  await writeFile(DIFF_PATH, PNG.sync.write(diff));
  console.error(
    `[bmw-pilot-viewer] Diff ratio ${(ratio * 100).toFixed(2)}% > threshold ${DIFF_THRESHOLD * 100}%. Diff: ${DIFF_PATH}`,
  );
}
expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD);
```

**New `goto` + settle pattern** (NOT in analog — RESEARCH.md §4 introduces):

```ts
await page.goto(DEV_URL, { waitUntil: 'networkidle0', timeout: 30_000 });
await new Promise(r => setTimeout(r, 1500)); // font + Reveal/Counter settle
```

**New `sharp.resize` insertion pattern** (NOT in analog — RESEARCH.md §5 introduces):

```ts
const resizedBuf = await sharp(captureBuf)
  .resize(REF_W, REF_H, { kernel: 'cubic', fit: 'fill' })
  .png()
  .toBuffer();
const actualPng = PNG.sync.read(resizedBuf);
```

**New dev-server bring-up pattern** (NOT in analog — RESEARCH.md §6 + §10 R-1 introduces):

```ts
async function bringUpDevServer(): Promise<ChildProcess> {
  const child = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--host', '127.0.0.1'], {
    stdio: 'pipe',
  });
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
```

**No first-run-bootstrap path** (deliberately omitted — analog has it at lines 277–287, do NOT clone):

```ts
// REMOVED: the first-run bootstrap from bmw-pilot-viewer.test.ts:277-287 that auto-writes
// the golden on missing file. design-reference.png is locked at phase open; if it's missing
// at run time, fail loudly instead of silently regenerating.
```

The full paste-ready outline is in `02-RESEARCH.md` §6 (the planner can paste verbatim into a task `<action>` block).

---

### `.gitignore` (VERIFY-ONLY — already covered)

**Status:** No change needed.

**Evidence:** `.gitignore` line 21 (verified 2026-05-07):

```
# Phase 01.1 — screenshot diff PNGs (operator-inspection-only; never committed)
server/tests/__snapshots__/*.diff.png
```

The wildcard `*.diff.png` already matches the new `landing-page-golden.diff.png`. The Wave 0 plan adds a 1-line grep verification and proceeds — no file edit required.

**Verification command for the plan:**

```bash
grep -n 'server/tests/__snapshots__/\*\.diff\.png' .gitignore
# Expected: 1 hit on line ~21
```

If the planner prefers an explicit entry for clarity (defensive against future `.gitignore` cleanups), they may append:

```
# Phase 02 — landing-page golden diff (covered by *.diff.png wildcard above; explicit for clarity)
server/tests/__snapshots__/landing-page-golden.diff.png
```

…but this is opportunistic per CONTEXT.md D-01a (≤5-min) — adds zero functional change.

---

### `src/sections/Hero.tsx` (MODIFY — G-01, component, render)

**Analog:** `src/sections/LeadMagnet.tsx` lines 5–9 (verbatim coral-glow blob pattern).

**Coral-glow blob pattern** (from `LeadMagnet.tsx:5-9`):

```tsx
<section id="lead-magnet" className="grain" style={{ background: 'var(--ink)', color: '#fff', position: 'relative', overflow: 'hidden' }}>
  <div style={{
    position: 'absolute', top: -100, right: -150, width: 700, height: 700, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)', filter: 'blur(80px)',
  }} />
  <div className="container" style={{ position: 'relative', zIndex: 2 }}>
```

**Key parameter table** (RESEARCH.md §7):

| Property | Value | Notes |
|----------|-------|-------|
| `position` | `'absolute'` | Required; parent `<section>` already has `position: 'relative'` (Hero line 37) |
| `top` | `-100` | px; pulls glow above section's top edge |
| `right` | `-150` | px; pulls glow off right edge — matches design-reference.png top-right concentration |
| `width` × `height` | `700 × 700` | px |
| `borderRadius` | `'50%'` | Ensures `filter: blur` doesn't clip on rectangular edges |
| `background` | `radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)` | `213,121,89` = `var(--coral) #D57959` (verified `global.css:30`); alpha 0.4 (LeadMagnet exact); fade-out at 60% |
| `filter` | `'blur(80px)'` | Soft halo |
| `pointerEvents` | `'none'` (NEW for Hero — NOT in LeadMagnet) | Hero's right column has the pipeline-card with click targets; the glow must not intercept |

**Paste-ready snippet for the Hero G-01 task `<action>`:**

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

**Insertion point in `Hero.tsx`:** between the last gradient overlay at line 48 and the giant `DVApro` outline-italic watermark starting at line 50. The watermark already has `pointerEvents: 'none'`. Insertion preserves the layering: `[bg image] → [linear gradients] → [coral glow] → [DVApro watermark] → [content wrapper z-index 3]`.

**DO-NOT-do list (anti-patterns):**

- Do NOT add `mix-blend-mode` (LeadMagnet doesn't use it; UI-SPEC §Color split locks the visual treatment).
- Do NOT add `z-index` on the glow div — the parent `<div style={{ position: 'relative', zIndex: 3 }}>` content wrapper at Hero line 59 already layers the foreground above all absolutes.
- Do NOT use raw hex `#D57959` — use the `rgba(213,121,89,0.4)` form because the gradient stop needs alpha. (UI-SPEC §Color forbids hex literals in new code, but `rgba(213,121,89,...)` matches the LeadMagnet-verbatim pattern and is the documented exception.)
- Do NOT introduce a new CSS class for the glow — UI-SPEC §Design System: inline styles for one-off layout values; the glow is a one-off.

---

### `src/styles/global.css:599` (MODIFY — G-11, config CSS, render)

**Analog:** `src/styles/global.css:69` (the canonical `.container` mobile padding declaration).

**Canonical pattern** (from `global.css:69`):

```css
@media (max-width: 720px){ .container { padding: 0 20px; } }
```

**Drift to fix at `global.css:599`** (verified 2026-05-07):

```css
.container { padding: 0 18px !important; }
```

**Target state at `global.css:599`:**

```css
.container { padding: 0 20px !important; }
```

This brings the `≤720px` block at line 599 into alignment with the declared `0 20px` token at line 69. UI-SPEC §Spacing Scale Exceptions explicitly notes 18px is "not a multiple of 4 and conflicts with the 20px value declared at line 69".

**Verification command for the plan** (per VALIDATION.md):

```bash
grep -n 'padding:[[:space:]]*0[[:space:]]*20px[[:space:]]*!important' src/styles/global.css
# Expected: hit at line 599
grep -n '0 18px' src/styles/global.css
# Expected: 0 hits
```

**Do-not-do:**

- Do NOT change line 67 (`padding: 0 56px;` desktop) — that's the locked desktop value.
- Do NOT remove `!important` — line 599 lives inside `@media (max-width: 720px)` and overrides line 67's desktop padding via specificity-and-importance; removing `!important` would break the cascade against inline styles in section files.

---

### `src/styles/global.css` `@font-face` blocks (VERIFY G-08, config CSS, render)

**Status:** Already correct. No code change.

**Evidence:** `global.css:1-27` — all 5 `@font-face` blocks already declare `font-display: swap`:

```css
@font-face { font-family: 'Gilroy'; src: url('https://fonts.cdnfonts.com/s/15131/Gilroy-Light.woff') format('woff');
  font-weight: 300; font-display: swap; }
@font-face { font-family: 'Gilroy'; src: url('https://fonts.cdnfonts.com/s/15131/Gilroy-Regular.woff') format('woff');
  font-weight: 400; font-display: swap; }
@font-face { font-family: 'Gilroy'; src: url('https://fonts.cdnfonts.com/s/15131/Gilroy-Medium.woff') format('woff');
  font-weight: 500; font-display: swap; }
@font-face { font-family: 'Gilroy'; src: url('https://fonts.cdnfonts.com/s/15131/Gilroy-Bold.woff') format('woff');
  font-weight: 700; font-display: swap; }
@font-face { font-family: 'Gilroy'; src: url('https://fonts.cdnfonts.com/s/15131/Gilroy-Black.woff') format('woff');
  font-weight: 900; font-display: swap; }
```

**Verification command for the plan** (per VALIDATION.md):

```bash
grep -c "font-display:[[:space:]]*swap" src/styles/global.css
# Expected: ≥5
```

**Bundling recommendation** (RESEARCH.md §10 R-8): combine G-08 + G-11 into a single Wave 1 plan + commit, since both touch `global.css` and total ≤5 lines.

**Self-hosting Gilroy** is explicitly Phase 8 (UI-SPEC G-08; CONTEXT.md `<deferred>`).

---

### `src/quiz/QuizModal.tsx` (MODIFY — D-03 light visual-token alignment, component, render)

**Analog:** No single analog. The pattern is the **inline-style + utility-class convention** shared across all section files (`Hero.tsx`, `LeadMagnet.tsx`, `Reviews.tsx`, etc.).

**House style for inline-style usage** (extracted from `Hero.tsx:62, 94-95, 117-118` and `Reviews.tsx:23-32`):

| Pattern | Example | What to enforce in QuizModal |
|---------|---------|------------------------------|
| Color via `var(--token)` only | `style={{ color: 'var(--mute)' }}` (Hero:80) | All `color`/`background`/`border-color` values reference `var(--*)` tokens, never hex/rgb literals |
| `border-radius: 0` for sharp surfaces | Reviews card (line 23–32): no `borderRadius` | No new `borderRadius` values introduced; existing `999px` for pills + `50%` for circles preserved |
| Font weights from the 4-active set: 400/500/700/900 | Hero stat-num: 900 italic; mono labels: 500 | No weight 300; no intermediate weights |
| Spacing in multiples of 4 | `gap: 14, 24, 28, 32, 64, 80, 96` (LeadMagnet, Hero) | Existing `padding: 18 22` / `36` / `12 14` etc. — verify 4-multiple compliance; extension: 18 is the only exception declared in UI-SPEC §Spacing Scale Exceptions |
| Buttons: utility class `.btn .btn-primary`/`.btn-coral`/`.btn-ghost` + size modifiers | LeadMagnet:38 `className="btn btn-primary btn-lg"` | Quiz already uses `.btn .btn-primary` / `.btn .btn-ghost` (lines 125, 133). Verify no inline button styles bypass the class system |
| Pills via `.pill` utility | Hero:64 `<Chip>` (which uses `.pill` utility) | Any new pill-shaped UI uses the utility class, not custom inline `borderRadius: 999` |
| Mono labels: `className="mono"` + 11–13px + `letterSpacing: '0.08em'..'0.1em'` + `textTransform: uppercase` | Hero:100, LeadMagnet:71, FeedStrip:14 | QuizModal lines 104, 130 already follow this pattern — verify consistency |
| Card surface: `background: rgba(255,255,255,0.03)` + `border: 1px solid var(--line-strong)` | Hero pipeline card line 94 | QuizModal `BudgetStep` line 269 already uses this — verify other steps don't drift |

**Stop conditions for the QuizModal pass** (per CONTEXT.md D-03 + RESEARCH.md §10 R-9 — paste verbatim into the Wave 2 plan's `<action>` block):

```
1. ONLY edit inline `style={...}` props and `className=` references.
2. NO logic changes (no edits to `useState`, `useEffect`, `useCallback`, `useRef`, event handlers).
3. NO copy changes (do not edit any string between quotes that renders user-visible text).
4. NO quiz-step structure changes (do not add/remove/reorder `QUIZ` items in `quizSpec.ts`).
5. NO changes to the modal lifecycle (`open`/`onClose`/`document.body.style.overflow` block).
6. STOP if a single fix exceeds 5 minutes wall-clock — log to `02-DEFERRED-POLISH.md` and continue.
```

**Verification command for the Wave 2 plan:**

```bash
# Token-purity check: any non-token color in QuizModal?
grep -nE '#[0-9A-Fa-f]{3,6}|rgb\(' src/quiz/QuizModal.tsx | grep -v 'rgba(255,255,255,'
# Expected: 0 hits OR only rgba() variants of var(--mute)/var(--line) which are pre-existing
```

**Reference files for token examples** (planner adds these to the Wave 2 plan's `<read_first>`):

- `src/sections/Hero.tsx` — pipeline-card surface treatment (line 94), stat number inline styling (line 117–122)
- `src/sections/LeadMagnet.tsx` — benefit-list inline styling (line 30–35), button class usage (line 38)
- `src/sections/Reviews.tsx` — review-card surface (line 23–32), avatar inline-style (line 35)
- `src/styles/global.css:1-46` — token definitions
- `src/styles/global.css:117-200` — `.btn` utility class system

---

### `src/sections/Catalog.tsx` (READ-ONLY VERIFY — G-03)

**Status:** Already correct. No code change.

**Evidence:** `Catalog.tsx:39` (verified 2026-05-07):

```tsx
padding: '10px 18px', borderRadius: 999,
```

The filter-pill button uses `borderRadius: 999` (numeric, equivalent to CSS `999px`). Matches UI-SPEC §Pills "Border-radius: 999px (fully rounded)".

**Verification command for the plan** (per VALIDATION.md):

```bash
grep -n 'borderRadius:[[:space:]]*999\|border-radius:[[:space:]]*999px' src/sections/Catalog.tsx
# Expected: hit on line 39
```

**Anti-pattern guard:** if the executor opportunistically touches Catalog.tsx, they MUST NOT add `borderRadius` to the car cards (which are at lines further down) — UI-SPEC §Surface Treatments locks card corners at 0.

---

### `src/sections/Reviews.tsx` (READ-ONLY VERIFY — G-06)

**Status:** Already correct. No code change.

**Evidence:** `Reviews.tsx:30` (verified 2026-05-07):

```tsx
<div style={{ display: 'flex', gap: 4, marginBottom: 20, color: 'var(--coral)' }}>
  {Array.from({ length: r.rating }).map((_, k) => <Icon key={k} name="star" size={16} />)}
</div>
```

Star color is `var(--coral)` via the parent `<div>`'s `color` prop, inherited by the `<Icon>` SVG strokes. Matches UI-SPEC §Color §"Coral reserved for: ...Star ratings in Reviews".

**Verification command for the plan** (per VALIDATION.md):

```bash
grep -n "var(--coral)" src/sections/Reviews.tsx
# Expected: ≥1 hit (line 30 + line 35 alternation)
```

---

### `src/crm/seed.ts` + `src/sections/FeedStrip.tsx:6` (READ-ONLY VERIFY — G-09)

**Status:** Already correct. No code change. (RESEARCH.md §8 verdict: VERIFY-ONLY.)

**Evidence:**

`seed.ts:103-109` — 5 entries in `feed[]`:

```ts
feed: [
  { id: 'feed1', time: '2 мин назад', text: 'Lexus LX 600 — выгружен во Владивостоке', icon: 'truck' },
  { id: 'feed2', time: '14 мин назад', text: 'Genesis GV80 — VIN-проверка пройдена', icon: 'shield' },
  { id: 'feed3', time: '38 мин назад', text: 'BMW M5 — выкуплен на аукционе HAA Kobe', icon: 'sparkle' },
  { id: 'feed4', time: '1 ч назад', text: 'Li L9 — таможенное оформление завершено', icon: 'doc' },
  { id: 'feed5', time: '2 ч назад', text: 'Mercedes GLE 53 — отправлен из Йокогамы', icon: 'truck' },
],
```

`FeedStrip.tsx:6` — null-render guard satisfied:

```tsx
export const FeedStrip = () => {
  const { state } = useCrm();
  if (state.feed.length === 0) return null;
```

**Verification command for the plan** (per VALIDATION.md):

```bash
grep -c "id: 'feed" src/crm/seed.ts
# Expected: ≥1 (currently 5)
grep -n "state.feed.length === 0" src/sections/FeedStrip.tsx
# Expected: hit on line 6
```

**Bundling recommendation** (RESEARCH.md §8): absorb G-09 into the same Wave 1 plan that does G-08+G-11. Add the 2 grep checks to that plan's verification section. No commit-only G-09 plan.

---

### `src/sections/Footer.tsx` (CONTRACT-VERIFY — R-5 aria-label preservation)

**Status:** Already correct. No code change. Contract-required guard (RESEARCH.md §10 R-5).

**Evidence:** `Footer.tsx:27-30, 76-77` (verified 2026-05-07):

```tsx
// Lines 27–30: inline footer dock
<a className="dock-btn tg" href={settings.telegram} target="_blank" rel="noreferrer" style={{ position: 'static', width: 44, height: 44 }} aria-label="Telegram"><Icon name="tg" size={18} /></a>
<a className="dock-btn wa" href={settings.whatsapp} target="_blank" rel="noreferrer" style={{ position: 'static', width: 44, height: 44 }} aria-label="WhatsApp"><Icon name="wa" size={18} /></a>

// Lines 76–77: FloatingDock fixed bottom-right
<a className="dock-btn tg" href={state.settings.telegram} target="_blank" rel="noreferrer" title="Telegram" aria-label="Telegram"><Icon name="tg" size={22} /></a>
<a className="dock-btn wa" href={state.settings.whatsapp} target="_blank" rel="noreferrer" title="WhatsApp" aria-label="WhatsApp"><Icon name="wa" size={22} /></a>
```

**Verification command for any plan that touches `Footer.tsx`:**

```bash
grep -c 'aria-label="Telegram"' src/sections/Footer.tsx
# Expected: 2
grep -c 'aria-label="WhatsApp"' src/sections/Footer.tsx
# Expected: 2
```

UI-SPEC §Accessibility Contract: "These labels are non-negotiable. The dock is fixed/persistent; a screen reader user will encounter it on every page scroll event."

---

## Shared Patterns

### Inline-Style + Utility-Class Convention (applies to ALL section/component edits)

**Source:** `src/sections/Hero.tsx`, `src/sections/LeadMagnet.tsx`, `src/sections/Reviews.tsx`, `src/styles/global.css`

**Apply to:** Hero G-01, QuizModal D-03, any opportunistic section touch.

**Rule excerpt** (from UI-SPEC §Design System + observed across section files):

```tsx
// House pattern — inline `style={{...}}` for one-off layout values + className for shared utilities:
<section style={{ background: 'var(--ink)', color: '#fff' }}>
  <div className="container">
    <Reveal>
      <h2 className="h1" style={{ marginBottom: 28 }}>...</h2>
      <button className="btn btn-primary btn-lg" onClick={onOpenQuiz}>...</button>
    </Reveal>
  </div>
</section>
```

**Anti-patterns to forbid in any plan:**

- No CSS-in-JS (`styled-components`, `emotion`, `@emotion/react`).
- No new component library imports (no `shadcn`, `radix-ui`, `mui`, `chakra`, `headlessui`).
- No new `border-radius` values besides `0`, `999`/`999px`, or `50%`.
- No new font weights besides 400/500/700/900 (NO 300, NO 600, NO 800).
- No new font sizes besides the 12 declared in UI-SPEC §Typography.
- No new color hex literals — use `var(--coral) / var(--cyan) / var(--ink) / var(--line) / var(--mute) / ...` tokens. Exception: `rgba(213,121,89,...)` for coral with alpha (LeadMagnet-verbatim pattern, used by Hero G-01).

### House Easing

**Source:** `global.css` + `LeadMagnet.tsx:59`

**Apply to:** any new `transition` value introduced by Wave 1 / Wave 2 plans.

```css
/* House easing — DO use this: */
transition: transform .35s cubic-bezier(.2,.7,.2,1);

/* DO NOT use ease-in-out for entrance animations — UI-SPEC §Animation locks the easing. */
```

### Section Background Alternation

**Source:** UI-SPEC §Surface Treatments §"Section backgrounds (alternating pattern)"

**Apply to:** any new section-level `style.background` (none expected in Phase 2 — all 10 sections exist).

```tsx
// Odd-indexed sections (Hero, Catalog, Process, LeadMagnet, FAQ): background: 'var(--ink)'
// Even-indexed sections (Marquee, FeedStrip, Founders, Reviews): background: '#0a0a09'
// Footer: background: '#000'
```

### Test File Naming + Snapshot Path Convention

**Source:** `server/tests/bmw-pilot-viewer.test.ts:32-33`

**Apply to:** the new `landing-page-golden.test.ts`.

```ts
// Test file lives in `server/tests/`
// Snapshot artifacts (diff PNGs only — never the golden) live in `server/tests/__snapshots__/`
// The golden REFERENCE for Phase 02 lives in `.planning/phases/02-redesign-from-screenshot/`
//   because it's a phase-locked design contract, not an auto-generated snapshot.
```

### Per-pixel pixelmatch Threshold (do NOT change)

**Source:** `bmw-pilot-viewer.test.ts:300`

**Apply to:** the new `landing-page-golden.test.ts`.

```ts
{ threshold: 0.1 }  // per-pixel YIQ tolerance — pixelmatch standard for screenshot diffs.
                    // DO NOT confuse with DIFF_THRESHOLD (the ratio of mismatched/total pixels).
                    // See RESEARCH.md §10 R-7 for the distinction.
```

### Graceful Shutdown (always wrap puppeteer in try/finally)

**Source:** `bmw-pilot-viewer.test.ts:261-314`

**Apply to:** the new `landing-page-golden.test.ts` (extend `finally` to also `child.kill()` the dev server).

```ts
const dev = await bringUpDevServer();
let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
try {
  browser = await puppeteer.launch({ /* ... */ });
  // ... capture, resize, diff, expect ...
} finally {
  await browser?.close();
  dev.kill();
}
```

---

## No Analog Found

**None.** Every Phase 2 file has a high-quality in-repo analog. This is the cleanest pattern-mapping case in the roadmap so far — Phase 2 is a fidelity pass against an already-shipped system, not a feature introduction.

---

## Pattern Lock Summary (for the planner)

When constructing each plan's `<read_first>` and `<action>` blocks, the planner should reference these analog files with line numbers:

| Plan area | Required reads (`<read_first>`) | Verbatim-paste sources |
|-----------|-------------------------------|------------------------|
| Wave 0 — Golden harness | `server/tests/bmw-pilot-viewer.test.ts:1-318`; `02-RESEARCH.md` §6 outline | RESEARCH.md §6 paste-ready outline (390-line bash-quoted block) |
| Wave 1 — Hero G-01 | `src/sections/LeadMagnet.tsx:1-49`; `src/sections/Hero.tsx:30-130`; `02-RESEARCH.md` §7 | LeadMagnet.tsx:6-9 + `pointerEvents: 'none'` addition |
| Wave 1 — global.css G-08 + G-11 | `src/styles/global.css:1-27, 65-69, 580-619`; `02-UI-SPEC.md` §"Spacing Scale Exceptions" | Single-char fix at line 599: `18` → `20` |
| Wave 1 — verify-only (Catalog G-03 / Reviews G-06 / FeedStrip G-09 / Footer R-5) | `src/sections/Catalog.tsx:30-55`; `src/sections/Reviews.tsx:20-50`; `src/crm/seed.ts:103-109`; `src/sections/FeedStrip.tsx:1-10`; `src/sections/Footer.tsx:25-80` | Grep verification commands listed above |
| Wave 2 — QuizModal D-03 | `src/quiz/QuizModal.tsx:1-436` (full file — 436 lines is over the no-rereads cap; planner instructs executor to read in two slices: 1-218 and 219-436); `src/sections/Hero.tsx:90-130` (token-pattern reference); `src/sections/Reviews.tsx:20-50` (card surface reference); `02-PATTERNS.md` §"Inline-Style + Utility-Class Convention" | Stop-conditions list (6-item) above |
| Wave 3 — Re-run gate | `02-VALIDATION.md` (full file); `server/tests/landing-page-golden.test.ts` (just-created); `02-RESEARCH.md` §10 R-1..R-9 risk register | Single command: `pnpm test landing-page-golden.test.ts` (≤30s) |

---

## Metadata

**Analog search scope:**
- `server/tests/` (1 file matched: `bmw-pilot-viewer.test.ts`)
- `src/sections/` (10 files; `Hero.tsx`, `LeadMagnet.tsx`, `Catalog.tsx`, `FeedStrip.tsx`, `Reviews.tsx`, `Footer.tsx` directly referenced)
- `src/styles/` (1 file matched: `global.css`)
- `src/quiz/` (1 file: `QuizModal.tsx`)
- `src/crm/` (1 file: `seed.ts`)
- `.gitignore` (1 wildcard match for diff PNG)

**Files scanned:** 12 (within scope of Phase 2 file list)

**Pattern extraction date:** 2026-05-07

**Confidence:** HIGH — every pattern lifted verbatim from a verified source (file read this session) with line refs; 7 of 7 Phase-2 files have direct in-repo analogs; no patterns sourced from training data or unverified web docs.

---

## PATTERN MAPPING COMPLETE
