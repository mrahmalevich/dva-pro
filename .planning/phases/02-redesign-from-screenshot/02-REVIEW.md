---
phase: 02-redesign-from-screenshot
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - server/tests/landing-page-golden.test.ts
  - src/quiz/QuizModal.tsx
  - src/sections/Hero.tsx
  - src/styles/global.css
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 02 was a tightly-scoped visual fidelity pass. Three of the four files reviewed have only single-line/single-character edits (`global.css` line 599, `QuizModal.tsx` SuccessStep alpha, the Hero blob block). The bulk of substantive changes is in the new `landing-page-golden.test.ts` file.

No critical security or correctness defects were found. However, the new test file exhibits multiple resource-management and robustness defects in its self-orchestration of the Vite dev server: there is no port-collision check, no signal-handler cleanup, no stdio drain, and the child process is killed with the default `SIGTERM` which Vite may ignore (process leakage). The new Hero coral-glow blob also misses an `aria-hidden` / decorative-only signal — minor a11y regression for the screen-reader experience, not a blocker.

The phase scope itself is honored: no new font weights, no new component libraries, sharp-corners token preserved, no new color tokens introduced. The two visible token edits (alpha 0.04 → 0.03, padding 18px → 20px) are correctly applied.

---

## Warnings

### WR-01: Port collision in `landing-page-golden.test.ts` is not handled — silent test contamination

**File:** `server/tests/landing-page-golden.test.ts:23-38`
**Issue:** `bringUpDevServer()` spawns Vite on a hardcoded port `5173` without checking whether the port is already in use. If a developer has `pnpm dev` already running, the spawned child will fail to bind, but the polling loop will succeed because the *existing* dev server answers `fetch('http://127.0.0.1:5173/')` with `200 OK`. The test then captures a screenshot from the developer's current working tree (which may include uncommitted edits) and compares it against the golden — producing **false-positive passes or false-negative failures unrelated to the code under test**. At test teardown, `dev.kill()` kills the orphan child process (which never bound), leaving the *real* dev server untouched but the test result is meaningless.
**Fix:** Either (a) bind to port `0` and parse the assigned port from Vite's stdout, or (b) probe the port first and refuse to run if already bound:
```ts
import { createServer } from 'node:net';
async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}
// in bringUpDevServer:
if (!(await isPortFree(5173))) {
  throw new Error('Port 5173 already in use — refusing to run golden test against unknown server.');
}
```

### WR-02: Process leakage on test failure / interrupt in `landing-page-golden.test.ts`

**File:** `server/tests/landing-page-golden.test.ts:23-93`
**Issue:** Two distinct leak paths:
1. The `bringUpDevServer` polling loop (lines 27-37) only kills the child if all 30 retries fail. If the test runner is interrupted (`SIGINT` / Ctrl-C) while polling, or if `fetch()` throws an unrecoverable error not caught by the bare `catch {}`, the child Vite process leaks indefinitely.
2. The `finally` block (lines 90-93) calls `dev.kill()` with default `SIGTERM`. Vite's dev server forks an esbuild subprocess and a Rollup watcher; on `SIGTERM` the parent often exits but **child processes survive** (orphaned to PID 1 on macOS/Linux). Subsequent test runs accumulate orphan node processes.

**Fix:**
```ts
// Register cleanup before launching to handle Ctrl-C / uncaught exits:
const cleanup = () => { try { child.kill('SIGKILL'); } catch {} };
process.once('SIGINT', cleanup);
process.once('SIGTERM', cleanup);
process.once('exit', cleanup);

// In the finally block, use SIGKILL and detached process group:
const dev = spawn('pnpm', ['exec', 'vite', ...], { stdio: 'pipe', detached: true });
// ... then on teardown:
try { process.kill(-dev.pid!, 'SIGKILL'); } catch {}
```

### WR-03: Unbounded stdio in spawned Vite child can deadlock the test on macOS

**File:** `server/tests/landing-page-golden.test.ts:24-26`
**Issue:** `spawn(..., { stdio: 'pipe' })` allocates pipes for stdout/stderr but the test never drains them. Vite's dev server emits hundreds of lines on HMR connection / request logging. Once the OS pipe buffer (~64KB on Linux, ~16KB on macOS) fills, Vite blocks on its next `process.stdout.write`, which deadlocks the dev server and hangs the test until the 60s timeout. This is intermittent (depends on how chatty the page is during screenshot capture) but reproducible under verbose logging.
**Fix:** Either drain explicitly, or use `'ignore'` if logs aren't needed:
```ts
const child = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'ignore', 'ignore'], // or 'inherit' if you want to see Vite output
});
```
If you keep `'pipe'` to detect "ready" from Vite stdout, attach `child.stdout?.on('data', () => {})` and `child.stderr?.on('data', () => {})` to keep them flowing.

### WR-04: Hardcoded threshold `0.22` masks visual regressions silently

**File:** `server/tests/landing-page-golden.test.ts:20`
**Issue:** A 22% pixel-mismatch tolerance is enormous for a structural-drift guard. The comment cites "as-shipped floor 18.74%" — meaning this test will accept any change that drifts by less than ~3.3 percentage points, which on a 605×1280 = 774,400-pixel image equals **~25,200 pixels of unflagged drift**. That is more than enough to silently let through entire missing UI elements (e.g., a hidden button, a cropped section, a misaligned hero blob — the very thing this phase introduced). The test will pass even if the page is half-broken.
This is a logic/design-quality issue: the test is configured such that the bug class it claims to detect (visual regression) cannot trigger it in practice. Either the baseline floor needs reducing (better font stability, mocked time/dynamic content, fixed-seed Reveal animations) or the test should be a smoke test of structural elements (DOM presence) rather than a pixel diff.
**Fix:** Document this as an explicit "smoke" test rather than a "golden" test. Consider replacing pixel diff with DOM-snapshot of key landmarks (header, hero CTA presence, stats grid count) which are stable and meaningful:
```ts
// Lower threshold + freeze sources of drift:
// 1. Stub Math.random / Date.now in dev mode
// 2. Disable Reveal animations via `prefers-reduced-motion: reduce` emulation:
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
// 3. Then bring threshold down to e.g. 0.05.
```

### WR-05: New decorative blob in Hero lacks `aria-hidden` — screen reader noise

**File:** `src/sections/Hero.tsx:54-58`
**Issue:** The newly inserted coral-glow `<div>` is purely decorative (no text content, no semantic role) but is not marked `aria-hidden="true"`. While most screen readers will ignore an empty div with no role, the convention in this codebase is to mark decorative absolute-positioned overlays explicitly — see also the unsplash-image div at lines 40-46 which is *also* missing `aria-hidden` (pre-existing; out-of-scope but worth flagging the inconsistency for the new code). Phase context explicitly calls this out as a check item.
**Fix:**
```tsx
<div aria-hidden="true" style={{
  position: 'absolute', top: -100, right: -150, width: 700, height: 700, borderRadius: '50%',
  background: 'radial-gradient(circle, rgba(213,121,89,0.4), transparent 60%)', filter: 'blur(80px)',
  pointerEvents: 'none',
}} />
```

---

## Info

### IN-01: Magic numbers in `landing-page-golden.test.ts` retry loop

**File:** `server/tests/landing-page-golden.test.ts:27, 34`
**Issue:** `for (let i = 0; i < 30; i++)` and `setTimeout(..., 1000)` express "30 seconds, polled every 1s" via two unrelated literals. Future maintainers tweaking either side risk drift between the loop budget and per-iteration delay. Same with the magic `1500` ms settle on line 54.
**Fix:** Extract:
```ts
const READINESS_TIMEOUT_MS = 30_000;
const READINESS_POLL_MS = 1_000;
const POST_LOAD_SETTLE_MS = 1_500;
```

### IN-02: `Buffer.isBuffer` defensive branch is dead code on current puppeteer

**File:** `server/tests/landing-page-golden.test.ts:58-60`
**Issue:** Comment claims puppeteer 24.x returns `Uint8Array`. In puppeteer 24.x `page.screenshot({ type: 'png' })` actually returns `Buffer | string` per type defs (string only when `encoding: 'base64'`). The `Buffer.isBuffer(screenshotData) ? screenshotData : Buffer.from(screenshotData as Uint8Array)` branch with `as Uint8Array` cast either never takes the false path on the runtime version pinned, or it's lying about types. Cast is also unsafe — `Buffer.from(screenshotData as Uint8Array)` would succeed even if `screenshotData` were a string (silent corruption).
**Fix:** Type-narrow without unsafe casts:
```ts
const screenshotData = await page.screenshot({ type: 'png', fullPage: true });
if (typeof screenshotData === 'string') {
  throw new Error('Expected binary PNG buffer, got base64 string');
}
const captureBuf = Buffer.isBuffer(screenshotData) ? screenshotData : Buffer.from(screenshotData);
```

### IN-03: Unsplash image URL hardcoded in `Hero.tsx` — single point of failure for hero background

**File:** `src/sections/Hero.tsx:42`
**Issue:** Pre-existing (not a phase-2 introduction) — flagged for awareness only. The hero background image points to `images.unsplash.com/photo-1603386329225-...`. If Unsplash takes the asset down or changes URL format, the hero gets a broken/missing background. Russian-locale users on residential ISPs may also hit Unsplash rate limits or geo-blocks. Not in scope to fix in this phase, but worth tracking — and it argues against the screenshot-diff test (WR-04) being able to detect this kind of failure mode reliably.
**Fix:** (Out of scope — track in roadmap.) Move hero image to local `public/` asset or Yandex Object Storage per the project's stated 152-FZ-aligned hosting story.

### IN-04: `Math.max(0, parseInt(settings.liveCount, 10) - 3)` — silent NaN handling

**File:** `src/sections/Hero.tsx:117`
**Issue:** Pre-existing (not a phase-2 change), flagged for awareness. `settings.liveCount` is typed as `string` (per `src/crm/types.ts:55`), edited via free-form input in the admin (`SettingsAdmin.tsx:25`). If an admin enters a non-numeric value (e.g. "many"), `parseInt(...)` returns `NaN`, then `NaN - 3 = NaN`, and `Math.max(0, NaN) = NaN` (because `Math.max` propagates NaN). The output renders as `+NaN в пути` to end users.
**Fix:** (Out of scope.) Parse with default:
```tsx
const live = Number.parseInt(settings.liveCount, 10);
const remaining = Math.max(0, (Number.isFinite(live) ? live : 0) - 3);
```

---

## Notes on phase scope compliance (no findings — confirmed clean)

- **No new font sizes/weights:** Verified. Both edits use existing tokens (`var(--coral)`, `var(--mute)`, etc.) and the `clamp()` size scales already present in `global.css`. No `font-weight: 300` introduced in new code.
- **No new component libraries:** Verified. No imports of shadcn/MUI/chakra/headless-ui/Tailwind in any reviewed file.
- **Sharp corners preserved:** Verified. `border-radius: 0` on `.btn`, `.card`, `.input` unchanged. The only `border-radius: 999px` is on `.pill` (line 155), and `border-radius: 50%` on dots/dock-buttons (acceptable per project convention — circular elements are a separate role from rounded rectangles).
- **House easing:** Verified. New code in QuizModal/Hero touches no animation timings; existing `cubic-bezier(.2,.7,.2,1)` instances unchanged.
- **FloatingDock untouched:** Verified — `Hero.tsx`, `QuizModal.tsx`, `global.css`, and the new test file do not modify `FloatingDock.tsx` or its aria-labels.
- **G-11 mobile container token alignment:** `global.css:599` correctly reads `padding: 0 20px !important` (matches the desktop `.container` padding ladder of `56px → 20px` at 720px breakpoint, line 69).
- **G-01 hero glow:** The blob style on `Hero.tsx:54-58` is a **byte-for-byte copy** of `LeadMagnet.tsx:6-9` plus `pointerEvents: 'none'`. Pattern reuse is correct.
- **QuizModal alpha alignment:** `QuizModal.tsx:423` SuccessStep countdown chip uses `rgba(255,255,255,0.03)` — matches the canonical card-surface alpha used at lines 269 (BudgetStep panel) and 369 (ContactStep summary box). The remaining `rgba(255,255,255,0.04)` instances in the codebase (Footer.tsx:15, atoms.tsx:76, atoms.tsx:138) are intentional outliers (mega-text watermark, status pill, diagonal-stripe pattern) — not in this phase's alignment scope.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
