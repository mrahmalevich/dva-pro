---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 03
subsystem: scrapers
tags: [http, got, polite-delay, block-detection, normalize, tdd]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: pnpm + tsconfig.server.json + vitest.config.ts + server/scrapers/{drom,encar,beforward,che168,autohome,shared}/ tree (plan 01-01)
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: server/scrapers/shared/types.ts (IScraper / ScrapeResult / BlockReason union), server/scrapers/shared/atomic-write.ts (plan 01-02)
provides:
  - server/scrapers/shared/http.ts — got@15 instance with cookieJar, retry [408/429/500/502/503/504], 30s timeout, exponential calculateDelay; pLimit(1)-serialized fetchHtml(url) + fetchBuffer(url); politeDelay() exported as test seam (D-14: 10s base ± 20% jitter, 8s floor)
  - server/scrapers/shared/block-detection.ts — BlockedError class (reason discriminator matching ScrapeResult.blocked.reason from plan 02 types) + BlockDetector class (D-13 thresholds: ≥5 thin <2KB OR captcha keyword in {капча, проверка, robot, verify} → throws)
  - server/scrapers/shared/normalize.ts — slugify (Cyrillic→Latin via 33-letter map, ASCII slug), parsePrice (digit-strip, drom 'от' / '₽' / '—' aware), parseYear (MM.YYYY range OR 'н.в.' OR single-year fallback)
  - server/tests/http.test.ts — 5 tests (3 dromClient + 2 politeDelay fake-timer)
  - server/tests/block-detection.test.ts — 8 tests (3 thin + 5 captcha)
  - server/tests/normalize.test.ts — 11 tests (4 slugify + 3 parsePrice + 4 parseYear)
  - server/tests/fixtures/drom/thin-response.html — 112-byte synthetic fixture (< 2KB threshold)
  - server/tests/fixtures/drom/captcha-response.html — 239-byte fixture (contains 'Проверка' + 'капчу')
affects:
  - "Plan 01-04 (image pipeline / sharp): can import { fetchBuffer } from '../shared/http.js' for hero image downloads with the same polite-rate constraint"
  - "Plan 01-05 (FX / CBR cache): can import { fetchBuffer } and decode windows-1251 via iconv-lite (Pitfall 2 boundary)"
  - "Plan 01-07 (drom orchestrator): composes all three modules — fetchHtml() per page, BlockDetector.inspect() after each fetch, slugify/parsePrice/parseYear during DOM parse. Block thresholds (D-13) and rate (D-14) are now enforced uniformly."
  - "Future v1.x scrapers (Encar/BeForward/Che168/Autohome): block-detection.ts is source-agnostic — they reuse the BlockDetector class verbatim. http.ts is drom-named today; v1.x scrapers will likely instantiate their own got.extend(...) variants per source-specific UA/proxy needs."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "got.extend({ cookieJar, retry, headers, timeout }) for per-source HTTP client. got@15 retry shape (limit/statusCodes/methods/calculateDelay({attemptCount})) confirmed identical to got@13/14 (A1 verified)."
    - "tough-cookie@6 CookieJar instance held in module scope = process-local session persistence (T-03-01: no on-disk leak; cookies discarded at process exit)."
    - "p-limit(1) wrapping fetchHtml/fetchBuffer = D-14 single-flight HTTP per source; CPU-bound work (sharp WebP encode in plan 04) gets its own p-limit(4) per CONTEXT.md §D-14."
    - "Polite-delay state at module scope (lastRequestAt: number) — simplest implementation; vi.resetModules() per-test isolates the global for fake-timer assertions."
    - "BlockedError extends Error with discriminated reason matching ScrapeResult.blocked.reason — orchestrator catches BlockedError and produces {status:'blocked', reason, sampleUrl} ScrapeResult with no field translation."
    - "Source-agnostic block-detection: D-13 thresholds (5 thin / captcha keywords) live in module constants, not behind a config object. Acceptable today because all v1 scrapers share the same thresholds; introduce config when an Encar/etc. need diverges."

key-files:
  created:
    - server/scrapers/shared/http.ts
    - server/scrapers/shared/block-detection.ts
    - server/scrapers/shared/normalize.ts
    - server/tests/http.test.ts
    - server/tests/block-detection.test.ts
    - server/tests/normalize.test.ts
    - server/tests/fixtures/drom/thin-response.html
    - server/tests/fixtures/drom/captcha-response.html
  modified: []
  deleted: []

key-decisions:
  - "politeDelay is exported as a named function (test seam). Production paths still call it locally inside fetchHtml/fetchBuffer; the export adds 0 runtime overhead and is the cleanest way to runtime-verify D-14 timing without a wall-clock test."
  - "Polite-delay tests use vi.spyOn(Math,'random').mockReturnValue(0) so jitter floor (8s = 10s × (1-0.20)) is deterministic. Without this, jitter dice rolls between 8s–12s, and the assertion 'second call resolves only after ≥8s' would be flaky on the upper end."
  - "Polite-delay tests use vi.resetModules() in before/afterEach so the module-scoped lastRequestAt is fresh per test. Without this, the 3 dromClient real-timer tests above contaminate it with Date.now() of the real clock; subsequent vi.setSystemTime() to 2026-04-28T07:30:00Z (which may be in the past relative to the contaminated value) would yield a negative elapsed → wait = jitter + |elapsed| ≈ billions of ms → setTimeout hang. This is a Rule 3 deviation (test-isolation fix) documented in the GREEN commit message."
  - "Polite-delay second-call test advances 1s via vi.advanceTimersByTimeAsync(1_000) instead of vi.setSystemTime. Reason: vi.setSystemTime alone moves the clock but does not tick already-scheduled setTimeouts; advanceTimersByTime advances both. (The plan's original test specified setSystemTime; this is a Rule 3 micro-deviation for runtime correctness.)"

requirements-completed: []

# Metrics
duration: 9m45s
duration_minutes: 10
completed_date: "2026-04-28"
tasks_completed: 3
files_created: 8
files_modified: 0
files_deleted: 0
---

# Phase 01 Plan 03: Shared HTTP + Block-Detection + Normalize Summary

Shipped the three policy-rich shared modules that the drom orchestrator (plan 07) composes: `shared/http.ts` (got@15 + cookieJar + polite delay + retry + pLimit(1)), `shared/block-detection.ts` (D-13 thresholds: 5-thin counter + captcha keyword regex set), `shared/normalize.ts` (drom-format-aware slugify / parsePrice / parseYear). Every module ships under TDD (RED test → GREEN impl, distinct commits) and passes vitest end-to-end. **A1 (the only research-flagged ASSUMPTION — got@15 retry shape unchanged from got@13/14) is now verified by the 503-retry test in `http.test.ts`.**

## What Shipped

| Artifact | Purpose |
|---|---|
| `server/scrapers/shared/http.ts` | got@15 dromClient (cookieJar, retry on 6 status codes incl. 503, 30s timeout, exp backoff, ru-RU header), pLimit(1)-serialized `fetchHtml`/`fetchBuffer`, `politeDelay()` per D-14 (10s base ± 20% jitter, 8s floor) |
| `server/scrapers/shared/block-detection.ts` | `BlockedError` class + `BlockDetector` class with D-13 contract (≥5 thin <2KB → throws thin_responses; captcha regex match → throws captcha; healthy ≥2KB resets counter); source-agnostic for v1.x reuse |
| `server/scrapers/shared/normalize.ts` | `slugify` (Cyrillic→Latin via 33-letter map + ASCII strip), `parsePrice` (drom 'от 5 470 000' / '5 470 000 ₽' / '—' / '' → number\|null), `parseYear` (MM.YYYY range OR 'н.в.' OR single-year fallback) |
| `server/tests/http.test.ts` | 5 tests (Accept-Language, 503-retry verifier, pLimit serialization, polite-delay first-call, polite-delay second-call ≥8s floor) |
| `server/tests/block-detection.test.ts` | 8 tests (4-thin OK, 5-thin throws, healthy resets, 4 captcha keywords × throws, healthy negative) |
| `server/tests/normalize.test.ts` | 11 tests (4 slugify + 3 parsePrice + 4 parseYear) |
| `server/tests/fixtures/drom/thin-response.html` | 112 bytes < 2 KB threshold — drives the 5-counter arm |
| `server/tests/fixtures/drom/captcha-response.html` | 239 bytes, contains 'Проверка' + 'капчу' — drives 2 of 4 keyword arms |

## A1 Verification (got@15 retry shape — RESEARCH.md line 541, 1088)

The verbatim retry config in `dromClient` —
```typescript
retry: {
  limit: 3,
  statusCodes: [408, 429, 500, 502, 503, 504],
  methods: ['GET'],
  calculateDelay: ({ attemptCount }) => Math.min(60_000, 2_000 * 2 ** attemptCount),
}
```
— compiles cleanly under `got@15.0.3` and behaves correctly: the 503-retry test stands up an HTTP server that returns 503 twice then 200, and asserts (a) `body === 'finally ok'`, (b) `calls === 3`, (c) elapsed ≥ 50ms (one retry waited).

**Result: A1 confirmed — no breaking shape change.** The only got@15 cosmetic difference vs prior major versions is that the `RetryFunction` argument is now typed as `RetryObject = { attemptCount, retryOptions, error, computedValue }` (we use only `attemptCount` via destructuring, so this is a non-breaking superset).

## Test Counts

| Suite | Tests | Status |
|---|---|---|
| `server/tests/http.test.ts` | 5 | green |
| `server/tests/block-detection.test.ts` | 8 | green |
| `server/tests/normalize.test.ts` | 11 | green |
| **Plan 03 total** | **24** | green |
| (regression) `server/tests/stubs.test.ts` (plan 02) | 12 | still green |
| **Repo total after plan 03** | **36** | green |

`pnpm vitest run` exit 0; `pnpm tsc -p tsconfig.server.json --noEmit` exit 0.

## Verifications

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 — got@15.0.3, tough-cookie@6.0.1, p-limit@7.3.0, vitest@3.2.4 confirmed |
| `pnpm vitest run server/tests/http.test.ts` | exit 0 — 5/5 passed (~12s; mostly the 11s pLimit serialization test that includes 2 polite-delay waits) |
| `pnpm vitest run server/tests/block-detection.test.ts` | exit 0 — 8/8 passed (~3 ms) |
| `pnpm vitest run server/tests/normalize.test.ts` | exit 0 — 11/11 passed (~2 ms) |
| `pnpm vitest run` (full repo) | exit 0 — 36/36 passed (4 files) |
| `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 |
| `wc -c server/tests/fixtures/drom/thin-response.html` | 112 — well under 2048 |
| `grep "from '\.\./scrapers/shared/" server/tests/*.test.ts` | All 3 test files use `.js` ESM import convention |
| `grep -rE "^import .+ from '" server/scrapers/shared/` | Only got, tough-cookie, p-limit, zod, node:fs/promises, node:path — all pinned in plan 01 |

## Decisions Made

- **`politeDelay` is exported as a named function** (test seam). Production paths still call it locally inside `fetchHtml`/`fetchBuffer`; the export adds 0 runtime overhead and is the cleanest way to runtime-verify D-14 timing without a wall-clock test.
- **Polite-delay tests pin `Math.random()` to 0** via `vi.spyOn(Math,'random').mockReturnValue(0)` so jitter floor (8s = 10s × (1−0.20)) is deterministic. Without this, jitter dice rolls between 8s–12s, and "second call resolves only after ≥8s" would be flaky on the upper end of the range.
- **Polite-delay tests use `vi.resetModules()` in before/afterEach** so module-scoped `lastRequestAt` is fresh per test. Without this, the 3 dromClient real-timer tests above contaminate `lastRequestAt` with `Date.now()` of the real clock; subsequently calling `vi.setSystemTime(2026-04-28T07:30:00Z)` (which can land in the past relative to that contaminated value, depending on local UTC offset and run timing) would yield a negative `elapsed` → `wait = jitter + |elapsed|` ≈ billions of ms → setTimeout hangs the test until the 5s timeout. This is documented inline in the Task 1 GREEN commit message.
- **Polite-delay second-call test advances 1s via `vi.advanceTimersByTimeAsync(1_000)`** instead of `vi.setSystemTime`. Reason: `setSystemTime` alone moves the clock but does NOT tick already-scheduled `setTimeout`s; `advanceTimersByTime` advances both. (The plan's original test sketch specified `setSystemTime`; this is a Rule 3 micro-deviation for runtime correctness — the assertion semantics are unchanged.)
- **Block-detection regex set is module-scope, not config**. D-13 says "Same module is reused (not specialized) by future Encar/etc." — so I deliberately did NOT introduce a `BlockDetectorConfig` type. When v1.x finds a source that needs different keywords, that's the time to introduce config; today YAGNI applies.
- **`slugify` uses a 2-stage strip**: `replace(/[^\p{ASCII}]/gu, '')` first (defensive, in case CYR_TO_LAT misses a niche letter like Latin-extended), then `replace(/[^a-z0-9\-\s]/g, '')`. The first regex is the catch-all; the second keeps only the slug-allowed character classes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Test Isolation] Polite-delay tests needed module reset**

- **Found during:** Task 1 GREEN — initial test run (with verbatim plan-spec test) showed both polite-delay tests timing out at 5s (despite the http.ts implementation being byte-exact to RESEARCH.md §Drom HTTP fetcher).
- **Issue:** The plan's polite-delay tests run after 3 dromClient tests that use real timers and call `fetchHtml` (which calls `politeDelay`). This sets `lastRequestAt` to `Date.now()` of the real clock (~1.77 trillion ms). The polite-delay tests then call `vi.useFakeTimers()` + `vi.setSystemTime(2026-04-28T07:30:00Z)`, which produced an `elapsed = fakeNow - realLastRequestAt`. Depending on whether the fake time landed before or after the real `Date.now()` (UTC offset–dependent), `elapsed` could be negative — making `wait = jitter - elapsed = jitter + |elapsed|` ≈ tens of millions of ms, which `setTimeout` then hung on for the entire test timeout.
- **Fix:** Added `vi.resetModules()` in `beforeEach`/`afterEach` of the `politeDelay` describe block, and switched to dynamic `await import('../scrapers/shared/http.js')` inside each test. This gives each test a fresh `lastRequestAt = 0` so `elapsed = fakeNow - 0` is huge (positive), `wait = max(0, jitter - elapsed) = 0`, and the test proceeds deterministically. Also pinned `Math.random` to 0 for jitter-floor determinism, and replaced `setSystemTime(+1s)` with `advanceTimersByTimeAsync(1_000)` so scheduled `setTimeout` queue advances correctly.
- **Files modified:** `server/tests/http.test.ts` (test-only — implementation `http.ts` is unchanged from RESEARCH.md verbatim).
- **Commit:** `7feeeb8` (commit message documents the test-isolation refinement explicitly).

No other deviations. Block-detection and normalize modules are exactly the plan-spec contents.

## Threat Model Compliance

| Threat ID | Status |
|---|---|
| T-03-01 (cookie-jar leakage) | **Mitigated.** `new CookieJar()` is module-scope — process-local; no `FileCookieStore` or persistence layer. Cookies live until process exit. |
| T-03-02 (ReDoS in CAPTCHA_KEYWORDS / year regex) | **Mitigated.** Captcha keywords are 4 word-level regexes (`/капча/i`, `/проверка/i`, `/robot/i`, `/verify/i`) — bounded literals, no quantifier nesting. Year regex `/(\d{2})\.(\d{4})\s*-\s*(?:(\d{2})\.(\d{4})|н\.\s*в\.?)/i` uses fixed `{2}` / `{4}` quantifiers with one optional `\s*` (bounded by `н\.` / `в\.?` literal anchors). Manual inspection: O(n) worst case. |
| T-03-03 (falsified Content-Type) | **Accepted (per plan).** Phase 1 uses `responseType: 'text'` for HTML and `'buffer'` for binary; encoding is utf-8 per Pitfall 2 / A2. Plan 05 (FX) handles windows-1251 explicitly via iconv-lite. Out of ASVS L1 scope. |
| T-03-04 (response body designed to evade detection) | **Accepted (per plan).** Phase 1 talks to drom only — public, RU-domestic, low adversary motivation. v1.x facing higher risk uses Crawlee+Playwright + fingerprint randomization. Documented out of v1 scope. |
| T-03-05 (gigabyte response DoS) | **Mitigated.** `timeout: { request: 30_000 }` bounds a single request; `pLimit(1)` bounds concurrency. http.ts itself does not cap response size — accepted residual risk for v1 (drom catalog pages observed at <500 KB). |

## Threat Flags

None — plan 03 introduces no new trust boundaries beyond the drom HTTP surface that the threat model already covers. The only additional file-access surface is `server/tests/fixtures/drom/*.html` reads in tests (read-only, hardcoded paths under `server/tests/fixtures`, no path-traversal vector).

## Known Stubs

None. All three shipped modules are fully functional and exercised by green tests. They are designed to be COMPOSED by the plan 07 drom orchestrator — that orchestrator does not yet exist (it's a separate plan), but that is by design and not a stub in the "placeholder UI" sense.

## Notes for Plan 07 (drom orchestrator)

- **Encoding assumption:** drom HTML is utf-8 (RESEARCH A2). `fetchHtml(url)` returns the body via got's automatic utf-8 decoding (`responseType: 'text'`). If plan 07 captures a real drom fixture and finds windows-1251 anywhere (unlikely but possible for legacy pages), use `fetchBuffer(url)` + iconv-lite explicitly — this is the same boundary as plan 05's CBR FX cache. The block-detection test in this plan synthesizes its own fixtures (utf-8 HTML), so we have no observed windows-1251 surface yet.
- **Block-detection counter is per-instance, not per-process.** Plan 07's drom orchestrator should construct ONE `BlockDetector` and pass each fetched body through `det.inspect(url, body)`. Sharing a detector across multiple parallel sources (which we don't do today — pLimit(1) makes everything serial) would conflate counters from different sources.
- **`captcha-response.html` fixture covers 2 of 4 keyword arms** ('проверка' via `Проверка` and 'капча' via `капчу`). The other 2 (`robot`, `verify`) are tested via inline string concatenation. If plan 07 captures a real drom captcha page, the same fixture pattern applies — sanitize to ≤500 bytes and drop into `server/tests/fixtures/drom/`.

## Commits

| Task | Phase | Hash | Message |
|---|---|---|---|
| 1 | RED | `346b54e` | `test(01-03): add failing http.test.ts (RED — D-14 polite-delay + A1 retry verifier)` |
| 1 | GREEN | `7feeeb8` | `feat(01-03): implement shared/http.ts (got@15 + cookieJar + polite-delay)` |
| 2 | RED | `4112acc` | `test(01-03): add failing block-detection.test.ts + 2 drom fixtures (RED — D-13)` |
| 2 | GREEN | `321ce12` | `feat(01-03): implement shared/block-detection.ts (D-13 thin counter + captcha)` |
| 3 | RED | `acd7397` | `test(01-03): add failing normalize.test.ts (RED — slugify/parsePrice/parseYear)` |
| 3 | GREEN | `d9981d8` | `feat(01-03): implement shared/normalize.ts (slugify + parsePrice + parseYear)` |

All 6 commits use `--no-verify` per parallel-executor protocol; no REFACTOR commits needed (verbatim-from-research code passes all tests on first GREEN).

## TDD Gate Compliance

Plan-level type is `execute`, but every task carried `tdd="true"`. Per-task gate sequence verified:
- Task 1: `test(...)` (346b54e) → `feat(...)` (7feeeb8) ✓
- Task 2: `test(...)` (4112acc) → `feat(...)` (321ce12) ✓
- Task 3: `test(...)` (acd7397) → `feat(...)` (d9981d8) ✓

No REFACTOR phase needed — plan-spec implementations passed GREEN immediately (Task 1 needed test-isolation refinement, but that's a test-only fix, not impl REFACTOR).

## Next Phase Readiness

- **Plans 01-04 / 01-05 / 01-07 (downstream in Phase 1):** Can `import { fetchHtml, fetchBuffer, dromClient } from '../shared/http.js'`, `import { BlockDetector, BlockedError } from '../shared/block-detection.js'`, `import { slugify, parsePrice, parseYear } from '../shared/normalize.js'` against a stable, type-checked, test-covered surface.
- **Plan 01-07 (drom orchestrator):** D-13 thresholds (5-thin / captcha) and D-14 rate (10s ± 20%) are now enforced uniformly. The orchestrator instantiates `new BlockDetector()` once per run, calls `det.inspect(url, body)` after each `fetchHtml`, catches `BlockedError`, and converts to `{status:'blocked', reason: e.reason, sampleUrl: e.sampleUrl}` per the plan-02 ScrapeResult union.
- **v1.x scrapers:** `block-detection.ts` is source-agnostic — Encar/BeForward/Che168/Autohome implementations can reuse the BlockDetector class as-is. `http.ts` is drom-named today; v1.x scrapers that need different UA / proxy / headers should instantiate their own `got.extend(...)` variants but can reference this file for the `politeDelay`/`pLimit` pattern.

## Self-Check: PASSED

**File existence checks:**
- `server/scrapers/shared/http.ts` — FOUND
- `server/scrapers/shared/block-detection.ts` — FOUND
- `server/scrapers/shared/normalize.ts` — FOUND
- `server/tests/http.test.ts` — FOUND
- `server/tests/block-detection.test.ts` — FOUND
- `server/tests/normalize.test.ts` — FOUND
- `server/tests/fixtures/drom/thin-response.html` — FOUND (112 bytes)
- `server/tests/fixtures/drom/captcha-response.html` — FOUND (239 bytes)

**Commit hash checks** (`git log --oneline | grep $hash`):
- `346b54e` — FOUND (Task 1 RED)
- `7feeeb8` — FOUND (Task 1 GREEN)
- `4112acc` — FOUND (Task 2 RED)
- `321ce12` — FOUND (Task 2 GREEN)
- `acd7397` — FOUND (Task 3 RED)
- `d9981d8` — FOUND (Task 3 GREEN)

**Pipeline checks:**
- `pnpm tsc -p tsconfig.server.json --noEmit` — exit 0
- `pnpm vitest run server/tests/http.test.ts` — exit 0 (5/5 passed)
- `pnpm vitest run server/tests/block-detection.test.ts` — exit 0 (8/8 passed)
- `pnpm vitest run server/tests/normalize.test.ts` — exit 0 (11/11 passed)
- `pnpm vitest run` (full repo) — exit 0 (36/36 passed across 4 files; no regressions in plan 02's stubs.test.ts)

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Plan: 03*
*Completed: 2026-04-28*
