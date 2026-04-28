---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 05
subsystem: scrapers
tags: [fx, cbr, iconv-lite, fast-xml-parser, windows-1251, fail-fast, cache, tdd]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: server/scrapers/shared/atomic-write.ts (plan 01-02 — atomicWriteFile primitive)
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: server/scrapers/shared/http.ts (plan 01-03 — dromClient got@15 instance; this plan ships a temporary placeholder for parallel-worktree resolution)
provides:
  - server/scrapers/shared/fx.ts — fetchFx({firstRun}) → FxRates with D-12 fail-fast / cached-fallback policy + decodeCbrXml(bytes, today) pure helper exported for unit testing
  - server/tests/fixtures/cbr/XML_daily.windows-1251.xml — 1370 raw windows-1251 bytes; round-trip verified (Cyrillic «Доллар США» recovers); contains all 6 currencies with VunitRate per-1-unit precision (USD/EUR/CNY/AED Nominal=1, JPY Nominal=100 with VunitRate=0,591234, KRW Nominal=1000 with VunitRate=0,0659012)
  - server/tests/fixtures/cbr/XML_daily.expected.json — golden FxRates output mirroring the fixture's per-1-unit VunitRate values
  - server/tests/fx.test.ts — 5 vitest cases (decode-golden, missing-currency, fail-fast first run, cached fallback, same-UTC-day cache hit)
  - scripts/build-cbr-fixture.mjs — one-shot generator (utf-8 → iconv.encode('win1251') → write); committed for reproducibility
affects:
  - "Plan 01-07 (drom orchestrator): consumes fetchFx({firstRun}) as the very first step of every drom run; FxRates flows into report.json (fx_stale: source==='cbr-cache') per D-17"
  - "Plan 01-03 (sister wave-3 plan, parallel worktree): this worktree ships a minimal placeholder server/scrapers/shared/http.ts; orchestrator must accept plan 03's superset version at wave merge"
  - "Phase 3 importer: FxRates persistence (or downstream RUB conversion) is out of scope for v1; phase 1 only writes the CBR cache file"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure-function extraction for testability: decodeCbrXml(bytes, today) returns FxRates without I/O — unit tests run against the fixture without mocking dromClient. fetchFx() composes decodeCbrXml with the network + cache wrapper."
    - "Atomic cache write via atomicWriteFile (Pattern 2 from plan 01-02): cbr-<YYYY-MM-DD>.json is written tmp + rename, never partially observable."
    - "Same-UTC-day cache short-circuit (D-12): fetchFx checks cachePath FIRST, before any network call — even on firstRun=true. This is what makes the same-day-cache test deterministic regardless of network state."
    - "Decimal-comma normalization at the parse boundary: parseDecimalComma(s) is the only place commas are converted to dots; downstream code sees JS numbers."
    - "VunitRate preference: when present, VunitRate is the per-1-unit RUB rate already normalized by CBR — using it directly avoids client-side floating-point math (Value/Nominal). Important for JPY/KRW where Nominal is 100/1000."

key-files:
  created:
    - server/scrapers/shared/fx.ts
    - server/scrapers/shared/http.ts (TEMPORARY placeholder — plan 01-03 is authoritative)
    - server/tests/fx.test.ts
    - server/tests/fixtures/cbr/XML_daily.windows-1251.xml
    - server/tests/fixtures/cbr/XML_daily.expected.json
    - scripts/build-cbr-fixture.mjs
  modified: []

key-decisions:
  - "Extracted decodeCbrXml(bytes, today) as a pure exported helper. The plan called this out as the only divergence from RESEARCH.md verbatim. Rationale: lets the unit test verify decode + parse + 6-currency extraction without mocking dromClient and without hitting the network. fetchFx remains verbatim per RESEARCH.md."
  - "Shipped a minimal http.ts placeholder in this worktree (only exports dromClient as a got.extend() instance). Plan 01-03 is the authoritative author of http.ts (politeDelay, fetchHtml, fetchBuffer, retry config, cookie jar, pLimit). Decision rationale: TypeScript needs the import to resolve at type-check time, and vi.doMock('../scrapers/shared/http.js', ...) needs a resolvable path. Wave merge must accept plan 03's superset http.ts; the placeholder can be discarded."
  - "Test fixture for 'missing currency' uses TWO Valutes (USD + dummy NOK) instead of one. Reason: fast-xml-parser collapses a single <Valute> child into an object rather than an array, which trips the 'ValCurs.Valute is not an array' guard before reaching the missing-currency throw. Two children engage the array path. Documented inline in the test for future maintainers."
  - "Cache key uses UTC-derived YYYY-MM-DD (new Date().toISOString().slice(0, 10)). This is intentional: drom runs are scheduled UTC; if a run starts on the UTC-day boundary, the cache filename is unambiguous across timezones."
  - "fetchFx checks the same-UTC-day cache BEFORE the firstRun branch. This means a same-day re-call returns cache even when firstRun=true — which the test explicitly asserts (with a mocked dromClient that throws if called). This makes the firstRun argument an instruction about fallback behavior, not a forced refetch."

patterns-established:
  - "windows-1251 decode is the ONLY place CBR-XML encoding is handled (iconv.decode(buf, 'win1251')). All consumers downstream see utf-8 strings. Pitfall 2 mitigation."
  - "Strict 6-currency tuple: const want = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const — readonly array drives the for-loop AND the FxRates type. Adding a 7th currency requires updating both."
  - "Error-message format for D-12 fail-fast: `CBR FX fetch failed on first run; cannot proceed: <inner>` — the prefix is the regex anchor used by tests. Future error-message rewrites must keep the prefix stable or update the test."

requirements-completed: [SCRAPE-11]

# Metrics
duration: 6 min
duration_minutes: 6
completed_date: "2026-04-28"
tasks_completed: 1
files_created: 6
files_modified: 0
files_deleted: 0
---

# Phase 01 Plan 05: CBR FX Feed Module Summary

**windows-1251 → utf-8 CBR XML decode via iconv-lite + fast-xml-parser, extracts all 6 currencies (USD/EUR/JPY/KRW/CNY/AED) per VunitRate, cached at `data/scraped/fx/cbr-<YYYY-MM-DD>.json` with D-12 fail-fast on first run / cached fallback on subsequent runs.**

## Performance

- **Duration:** ~6 min
- **Tasks:** 1
- **Files created:** 6 (1 source, 1 placeholder, 1 test, 2 fixtures, 1 generator script)
- **Files modified:** 0

## What Shipped

| Artifact | Purpose |
|---|---|
| `server/scrapers/shared/fx.ts` | `fetchFx({firstRun})` → `FxRates` with D-12 contract; `decodeCbrXml(bytes, today)` pure helper |
| `server/scrapers/shared/http.ts` | **TEMPORARY placeholder** — minimal `dromClient = got.extend(...)` so fx.ts's `import { dromClient } from './http.js'` resolves; plan 01-03 (sister wave-3 plan) is authoritative |
| `server/tests/fx.test.ts` | 5 vitest cases (golden decode, missing-currency, fail-fast, cached fallback, same-UTC-day cache hit) |
| `server/tests/fixtures/cbr/XML_daily.windows-1251.xml` | 1370 raw windows-1251 bytes; round-trip verified (Cyrillic «Доллар США» recovers via iconv) |
| `server/tests/fixtures/cbr/XML_daily.expected.json` | Golden output: per-1-unit RUB rates for all 6 currencies |
| `scripts/build-cbr-fixture.mjs` | One-shot generator; constructs utf-8 XML → `iconv.encode('win1251')` → writes bytes; committed for reproducibility |

## D-12 Contract (verified)

| Scenario | Behavior | Test |
|---|---|---|
| Same-UTC-day cache file exists | Read cache, return `source: 'cbr-cache'`; no network call (even when `firstRun: true`) | ✅ same-UTC-day cache hit returns cache without network |
| No same-day cache + network OK | Fetch live, write `cbr-<today>.json`, return `source: 'cbr-live'` | (covered end-to-end by plan 09 live smoke run; not exercised here) |
| No same-day cache + network fails + `firstRun: true` | Throw `CBR FX fetch failed on first run; cannot proceed: ...` | ✅ first-run network failure throws (fail-fast, no cache) |
| No same-day cache + network fails + prior-day cache exists | Read newest `cbr-YYYY-MM-DD.json`, return `source: 'cbr-cache'` | ✅ subsequent run with prior cache → returns cached + source=cbr-cache |
| No same-day cache + network fails + no cache at all + `firstRun: false` | Throw `CBR live fetch failed and no cache available` | (defensive branch; not unit-tested in this plan) |

## A8 Currency Coverage (verified)

CBR XML lists `Valute` rows for many currencies; `decodeCbrXml` enforces all 6 we care about must be present:

```
const want = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const;
for (const code of want) {
  const v = valutes.find((x) => x.CharCode === code);
  if (!v) throw new Error(`CBR XML missing currency ${code}`);
  ...
}
```

The fixture covers all 6; the missing-currency test asserts the throw fires when only USD + a dummy NOK are present.

## VunitRate vs Value/Nominal

CBR exposes both shapes:

| Code | Nominal | Value (RUB per Nominal) | VunitRate (RUB per 1) | Used |
|---|---|---|---|---|
| USD | 1 | 91.3145 | 91.3145 | VunitRate (same as Value/Nominal here) |
| EUR | 1 | 97.5210 | 97.5210 | VunitRate |
| JPY | 100 | 59.1234 | 0.591234 | **VunitRate** (avoids 59.1234 / 100 client-side math) |
| KRW | 1000 | 65.9012 | 0.0659012 | **VunitRate** |
| CNY | 1 | 12.5670 | 12.5670 | VunitRate |
| AED | 1 | 24.8624 | 24.8624 | VunitRate |

`decodeCbrXml` prefers `VunitRate` when present (it always is for these 6 per A8) and falls back to `parseDecimalComma(Value) / Number(Nominal)` for safety. The fallback is exercised structurally (the conditional is in the source) but not asserted by a separate test — A8 verifies that VunitRate is always present for these currencies.

## Verifications (all green)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (worktree node_modules bootstrap) |
| `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 |
| `pnpm vitest run server/tests/fx.test.ts` | exit 0 — **Test Files 1 passed (1) / Tests 5 passed (5)** |
| `pnpm vitest run` (full suite) | exit 0 — 17/17 passing (12 stubs + 5 fx) |
| `file server/tests/fixtures/cbr/XML_daily.windows-1251.xml` | `XML 1.0 document text, ISO-8859 text` (windows-1251 is in the ISO-8859 family — confirms not utf-8) |
| `iconv -f windows-1251 -t utf-8 server/tests/fixtures/cbr/XML_daily.windows-1251.xml \| grep -q "Доллар США"` | exit 0 (Cyrillic round-trips) |
| `wc -c server/tests/fixtures/cbr/XML_daily.windows-1251.xml` | 1370 bytes |
| `xxd ... \| grep "Name>"` shows bytes `c4 ee eb eb e0 f0` (= "Доллар" in CP1251 high-byte range, NOT utf-8 `d0 94...`) | confirmed |
| `grep -q "iconv.decode" server/scrapers/shared/fx.ts` | found |
| `grep -q "VunitRate" server/scrapers/shared/fx.ts` | found |
| `grep -q "fail-fast on first run" server/scrapers/shared/fx.ts` | found (D-12 grep anchor) |
| `grep -q "decodeCbrXml" server/scrapers/shared/fx.ts` | found (export) |
| `grep -q "fetchFx" server/scrapers/shared/fx.ts` | found (export) |
| `grep -q "FxRates" server/scrapers/shared/fx.ts` | found (export) |

## Test Output

```
 RUN  v3.2.4
 ✓ server/tests/fx.test.ts (5 tests) 16ms
   ✓ decodeCbrXml (SCRAPE-11, A8) > decodes windows-1251 + parses XML → all 6 currencies match golden output
   ✓ decodeCbrXml (SCRAPE-11, A8) > throws if a required currency is missing
   ✓ fetchFx — D-12 fail-fast and cached fallback > first-run network failure throws (fail-fast, no cache)
   ✓ fetchFx — D-12 fail-fast and cached fallback > subsequent run with prior cache → returns cached + source=cbr-cache
   ✓ fetchFx — D-12 fail-fast and cached fallback > same-UTC-day cache hit returns cache without network

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

## Decisions Made

- **`decodeCbrXml(bytes, today)` extracted as a pure exported helper.** The plan explicitly called this out as the only divergence from RESEARCH.md verbatim. Rationale: enables a unit test that verifies the windows-1251 → fast-xml-parser → 6-currency extraction pipeline without mocking `dromClient` and without network. `fetchFx` itself remains the verbatim composition (cache check → network → cache write → fail-fast / fallback) per RESEARCH.md.
- **Same-UTC-day cache check runs BEFORE the `firstRun` branch.** Effect: a same-day re-call returns the cache even when `firstRun: true`, which the test asserts with a mocked `dromClient` that throws if called. This makes `firstRun` a fallback-policy flag, not a forced-refetch flag. (See test "same-UTC-day cache hit returns cache without network".)
- **Cache key derives from UTC** (`new Date().toISOString().slice(0, 10)`), not local time. Drom orchestrator (plan 07) runs scheduled UTC; ambiguity at the day boundary is avoided by using UTC consistently.
- **Test fixture for `missing-currency` uses two Valutes** (USD + dummy NOK), not one. Reason: fast-xml-parser collapses a single child into an object rather than an array, which trips the `'ValCurs.Valute is not an array'` guard before reaching the missing-currency throw. Adding a second child engages the array path. The same quirk would catch any future contributor who tries to author a single-Valute fixture; the test comment documents this.
- **Used named-import `import * as iconv from 'iconv-lite'`** (not default import). iconv-lite is CJS and exposes `decode`/`encode` as named exports on the namespace object; with `esModuleInterop: true` (already in `tsconfig.server.json`) both forms work, but the namespace import keeps the call site explicit (`iconv.decode(buf, 'win1251')`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created temporary `server/scrapers/shared/http.ts` placeholder**
- **Found during:** Task 1 (test setup)
- **Issue:** fx.ts imports `dromClient` from `./http.js`, which is owned by sister plan 01-03 (also wave 3, executed in a parallel worktree). In this worktree neither the file nor its build output exists, so vitest's module resolution fails and `vi.doMock('../scrapers/shared/http.js', ...)` cannot bind to a non-existent path.
- **Fix:** Wrote a minimal `server/scrapers/shared/http.ts` with only `export const dromClient = got.extend({...})` and explicit per-file leading comment marking it as a parallel-worktree placeholder. The orchestrator must accept plan 03's superset version (which adds `politeDelay`, `fetchHtml`, `fetchBuffer`, retry config, cookie jar, `pLimit(1)`) at wave merge.
- **Files modified:** `server/scrapers/shared/http.ts` (new)
- **Verification:** `pnpm tsc -p tsconfig.server.json --noEmit` exits 0; `pnpm vitest run server/tests/fx.test.ts` passes 5/5 with the http module mocked away in 3 of the 5 tests; the other 2 tests (decode-golden, missing-currency) never touch http.
- **Committed in:** `e16680a` (RED-phase commit)

**2. [Rule 1 - Test bug] Fixed `missing-currency` test fixture to use two Valutes**
- **Found during:** Task 1 (GREEN-phase test run)
- **Issue:** Initial test hand-crafted a single-Valute XML (only USD). fast-xml-parser collapsed the lone child into an object, so `parsed.ValCurs.Valute` was not an array and `decodeCbrXml`'s array-shape guard fired (`'ValCurs.Valute is not an array'`) before the missing-currency throw could be tested.
- **Fix:** Added a dummy second `<Valute>` (NOK) to the test XML so the array path engages. The test then correctly asserts the missing-currency throw fires for the absent EUR/JPY/etc.
- **Files modified:** `server/tests/fx.test.ts` (test refinement only — production code unchanged)
- **Verification:** Test now passes; the test comment documents the fast-xml-parser quirk for future maintainers.
- **Committed in:** `cd2c0f0` (GREEN-phase commit, alongside fx.ts)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 test correction)
**Impact on plan:** Both auto-fixes were necessary for the plan's tests to compile + pass. No scope creep; the placeholder http.ts is explicitly temporary and the test fix is a fixture correction, not a contract relaxation.

## Issues Encountered

- `pnpm vitest` initially failed with `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL` — the parallel worktree had no `node_modules`. Resolved by running `pnpm install --frozen-lockfile` once. This is a worktree-bootstrap step, not a project bug.

## Threat Model Compliance

| Threat ID | Status |
|---|---|
| T-05-01 (malicious XML triggers fast-xml-parser bug) | **Mitigated.** fast-xml-parser 4.5.x is pure-JS, zero deps, pinned via lockfile. `decodeCbrXml` extracts specific named fields (`CharCode`, `Nominal`, `Value`, `VunitRate`) and rejects the structure as soon as `ValCurs.Valute` is not an array OR any of the 6 required currencies is absent. No XPath, no eval, no schema-dynamic field selection. |
| T-05-02 (dromClient leaks Referer to cbr.ru) | **Accepted** per plan threat register. cbr.ru is the operator of the resource; same-origin Referer is not third-party leakage. |
| T-05-03 (hand-edited cached `cbr-*.json` injects bad rates) | **Mitigated.** Cache file is gitignored, owned by the dev's machine; only the dev or this module writes to it. Cache JSON is read with `JSON.parse` → typed cast (no `eval`). zod validation of the cache file is deferred (would catch corruption but adds startup cost — out of scope for v1 per plan). |
| T-05-04 (CBR XML response is gigabytes) | **Mitigated.** `dromClient.timeout: { request: 30_000 }` from http.ts caps the request. fast-xml-parser parses synchronously after decode — for a CBR document (typical ~6KB) this is bounded. No streaming parse needed at this size. |
| T-05-05 (DNS poisoning swaps cbr.ru rate values) | **Accepted.** Phase 1 runs from a single dev machine; CBR is HTTPS; cert validation is got's default. Out of scope for v1 (no MitM defense beyond TLS). |

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface beyond what the plan's threat register already covers. The CBR HTTPS GET and the local cache write are both explicitly modeled.

## Known Stubs

- `server/scrapers/shared/http.ts` — **temporary placeholder for parallel-worktree execution.** Will be overwritten by plan 01-03's authoritative version at wave merge. Per-file leading comment documents this. NOT a deferred feature, just a build-order artifact.

`fetchFx` itself is exercised end-to-end during the live smoke run (plan 01-09); plan 05 only exercises the unit-level decode + cache logic.

## Commits

| Phase | Hash | Message |
|---|---|---|
| RED | `e16680a` | `test(01-05): add failing fx test + windows-1251 fixture + golden JSON` |
| GREEN | `cd2c0f0` | `feat(01-05): implement CBR FX feed module with D-12 fail-fast/cached fallback` |

(Plan-metadata commit will be made by the orchestrator after wave 3 is reconciled. STATE.md and ROADMAP.md updates are intentionally NOT performed by this parallel executor per the orchestrator's instructions.)

## TDD Gate Compliance

- ✅ RED gate: `e16680a` is a `test(...)` commit; tests fail with `Cannot find module '../scrapers/shared/fx.js'`.
- ✅ GREEN gate: `cd2c0f0` is a `feat(...)` commit after RED; all 5 tests pass.
- ⏭️ REFACTOR gate: not needed — fx.ts is RESEARCH.md-verbatim plus the planned `decodeCbrXml` extraction; no further cleanup warranted.

## Next Phase Readiness

- **Plan 01-07 (drom orchestrator):** can `import { fetchFx, type FxRates } from '../shared/fx.js'` and call it as the first step of every drom run. Cache is at `data/scraped/fx/cbr-<YYYY-MM-DD>.json`; `result.source === 'cbr-cache'` propagates to `report.json` as `fx_stale: true` per D-17.
- **Plan 01-09 (live smoke run):** will be the first end-to-end exercise of `fetchFx({firstRun: true})` against the real CBR endpoint. Failure mode is well-defined: throws with the `CBR FX fetch failed on first run; cannot proceed:` prefix.
- **Wave merge (plans 01-03 / 01-04 / 01-05 / 01-06 reconciliation):** the `server/scrapers/shared/http.ts` placeholder shipped here MUST be replaced by plan 01-03's superset version. fx.ts's import surface (`{ dromClient }`) is preserved by both — the merge concern is the placeholder's missing exports (`politeDelay`, `fetchHtml`, `fetchBuffer`), which plan 03 supplies.

## Self-Check

**File existence checks:**
- `server/scrapers/shared/fx.ts` — FOUND
- `server/scrapers/shared/http.ts` — FOUND (placeholder)
- `server/tests/fx.test.ts` — FOUND
- `server/tests/fixtures/cbr/XML_daily.windows-1251.xml` — FOUND (1370 bytes)
- `server/tests/fixtures/cbr/XML_daily.expected.json` — FOUND
- `scripts/build-cbr-fixture.mjs` — FOUND

**Commit hash checks:**
- `e16680a` (RED) — FOUND in `git log --oneline`
- `cd2c0f0` (GREEN) — FOUND in `git log --oneline`

**Pipeline checks:**
- `pnpm tsc -p tsconfig.server.json --noEmit` — exit 0
- `pnpm vitest run server/tests/fx.test.ts` — exit 0 (5/5)
- `pnpm vitest run` — exit 0 (17/17 across the worktree)
- `iconv -f windows-1251 -t utf-8 server/tests/fixtures/cbr/XML_daily.windows-1251.xml | grep -q 'Доллар США'` — exit 0
- `file server/tests/fixtures/cbr/XML_daily.windows-1251.xml` reports ISO-8859 (windows-1251 family, confirms NOT utf-8)

## Self-Check: PASSED

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Plan: 05*
*Completed: 2026-04-28*
