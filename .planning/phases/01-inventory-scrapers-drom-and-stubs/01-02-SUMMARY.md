---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 02
subsystem: scrapers
tags: [iscraper, contract, stubs, cli, dispatcher, zod, atomic-write, tdd]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: pnpm + tsconfig.server.json + vitest.config.ts + server/scrapers/{drom,encar,beforward,che168,autohome,shared}/ tree (plan 01-01)
provides:
  - server/scrapers/shared/types.ts — IScraper interface, ScrapeResult discriminated union (4 arms), ModelRecord zod schema (17 fields, strict per Pitfall 1), ReportSummary type (D-17 telemetry shape)
  - server/scrapers/shared/atomic-write.ts — atomicWriteFile() helper (Pattern 2; tmp + POSIX rename) used by every artifact write in plans 03..07
  - server/scrapers/{encar,beforward,che168,autohome}/index.ts — 4 v1.x stubs returning {status:'not_implemented'}; each logs exactly one '[<source>] TODO:' warning per run() invocation
  - server/scrapers/drom/index.ts — TEMPORARY placeholder (replaced by plan 01-07's real orchestrator); allows cli.ts to compile NOW
  - server/scrapers/cli.ts — argv → IScraper.run() dispatcher with EXIT_CODES = { ok: 0, error: 1, not_implemented: 2, blocked: 3 } (D-09)
  - server/tests/stubs.test.ts — 12 tests covering all 4 stubs (3 assertions × 4 stubs)
affects:
  - "Wave 3+ plans (03..07): every Phase 1 plan now imports from server/scrapers/shared/types.ts and uses atomicWriteFile() — contract is locked"
  - "Plan 01-07 (drom orchestrator): will overwrite server/scrapers/drom/index.ts with the real implementation; cli.ts already imports it correctly"
  - "Phase 4 importer: ModelRecord zod shape is now binding (matches data/scraped/SCHEMA.md line-by-line)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated-union ScrapeResult with TS-exhaustive EXIT_CODES lookup: cli.ts maps result.status → exit code via Record<status, number>; missing arm = compile error"
    - "Strict zod schema (no .default([]), no .optional() on required fields) per Pitfall 1: schema is the DOM-regression detector; permissive validators silently produce 50K rows of empty arrays"
    - "Atomic file write via tmp + POSIX rename (Pattern 2): models.json / .cursor.json / report.json / hero WebPs / brand-aliases all write through atomicWriteFile() so partial writes are impossible"
    - "Top-level await in cli.ts (NodeNext + type:module) — no async wrapper, no IIFE; thrown errors caught explicitly into {status:'error'}"
    - "Local imports use .js extension (TS source is .ts; tsx rewrites at runtime; required by Node ESM resolution)"

key-files:
  created:
    - server/scrapers/shared/types.ts
    - server/scrapers/shared/atomic-write.ts
    - server/scrapers/encar/index.ts
    - server/scrapers/beforward/index.ts
    - server/scrapers/che168/index.ts
    - server/scrapers/autohome/index.ts
    - server/scrapers/drom/index.ts
    - server/scrapers/cli.ts
    - server/tests/stubs.test.ts
  modified: []
  deleted:
    - server/scrapers/shared/scaffold.ts

key-decisions:
  - "drom placeholder ships in this plan (overwritten by plan 01-07). Without it, cli.ts cannot import './drom/index.js' and tsc fails. Per-file leading comment documents the temporary nature; replaces cleanly in plan 07."
  - "ScrapeResult is a 4-arm discriminated union (ok | not_implemented | error | blocked) — these are the four states the orchestrator's run() will ever return. The CLI's EXIT_CODES Record is exhaustive at compile time; adding a 5th arm to ScrapeResult would force cli.ts to be updated."
  - "ModelRecord zod schema is verbatim from RESEARCH.md lines 312-335 (no .default, no .optional on required) — Pitfall 1 mitigated. SCHEMA.md (plan 01-08) mirrors these 17 fields one-to-one."
  - "Top-level await is allowed because tsconfig.server.json uses module: NodeNext AND package.json has \"type\": \"module\". No IIFE wrapper needed."
  - "The 4 stubs share an identical shape (only source + todo differ); tests parameterise across them via a shared stubs[] array (DRY)."

patterns-established:
  - "IScraper contract = source: string (literal-narrow recommended) + run(opts?): Promise<ScrapeResult>. Plan 07 implements drom against this; v1.x authors implement encar/beforward/che168/autohome against this."
  - "Stub shape: console.warn('[<source>] TODO: ...') exactly once per run(), then return {status:'not_implemented', source, deferredTo:'v1.x', todo:<non-empty hint>}. v1.x authors swap the body without changing the file path or export name."
  - "CLI usage error contract: pnpm scrape (no arg) OR pnpm scrape <unknown> → stderr 'Usage: pnpm scrape <drom|encar|...>' + exit 1. Documented and shell-verified."

requirements-completed: [SCRAPE-01, SCRAPE-02, SCRAPE-03, SCRAPE-04]

# Metrics
duration: 3m20s
duration_minutes: 3
completed_date: "2026-04-28"
tasks_completed: 3
files_created: 9
files_modified: 0
files_deleted: 1
---

# Phase 01 Plan 02: IScraper Contract + 4 Stubs + CLI Dispatcher Summary

Locked the IScraper contract (typed source + Promise<ScrapeResult> + 4-arm discriminated union) and the atomicWriteFile() FS primitive in `server/scrapers/shared/`, shipped 4 v1.x stubs (encar/beforward/che168/autohome) returning `{status:'not_implemented'}`, plus a temporary drom placeholder so `cli.ts` compiles NOW (plan 01-07 overwrites it). The CLI dispatcher maps `ScrapeResult.status` → exit codes 0/1/2/3 per D-09; 12 unit tests in `server/tests/stubs.test.ts` exercise the not_implemented branch from the consumer side.

## What Shipped

| Artifact | Purpose |
|---|---|
| `server/scrapers/shared/types.ts` | `IScraper` interface, `ScrapeResult` discriminated union (4 arms), `ModelRecord` zod schema (17 fields, 1:1 with D-10 / SCHEMA.md), `ReportSummary` type (D-17) |
| `server/scrapers/shared/atomic-write.ts` | `atomicWriteFile()` — write tmp + POSIX rename; foundation for every artifact write in plans 03..07 |
| `server/scrapers/encar/index.ts` | `encar` IScraper stub (deferred to v1.x; Crawlee+Playwright Firefox + KR proxy + Carapis fallback) |
| `server/scrapers/beforward/index.ts` | `beforward` IScraper stub (deferred to v1.x; HttpCrawler + Cheerio) |
| `server/scrapers/che168/index.ts` | `che168` IScraper stub (deferred to v1.x; PlaywrightCrawler + CN proxy) |
| `server/scrapers/autohome/index.ts` | `autohome` IScraper stub (deferred to v1.x; PlaywrightCrawler + CN proxy) |
| `server/scrapers/drom/index.ts` | **TEMPORARY placeholder** — replaced by plan 01-07's real orchestrator; exists only so cli.ts imports compile |
| `server/scrapers/cli.ts` | argv → IScraper.run() dispatcher; SCRAPERS map (5 keys) + EXIT_CODES (D-09); top-level await + try/catch → `{status:'error'}` |
| `server/tests/stubs.test.ts` | 4 stubs × 3 assertions = 12 tests; verifies source identifier + not_implemented payload + single TODO warning per run() |

## IScraper Contract (final shape — locked)

```typescript
export interface IScraper {
  readonly source: string;
  run(opts?: { resume?: boolean }): Promise<ScrapeResult>;
}

export type ScrapeResult =
  | { status: 'ok'; source: string; runId: string; recordsWritten: number; durationMs: number; report: ReportSummary }
  | { status: 'not_implemented'; source: string; deferredTo: 'v1.x'; todo: string }
  | { status: 'error'; source: string; runId?: string; error: { message: string; cause?: unknown } }
  | { status: 'blocked'; source: string; runId: string; reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'; sampleUrl?: string };
```

**Divergences from RESEARCH.md verbatim:** **none**. The types.ts contents are byte-for-byte the block specified in the plan's `<action>` (which itself mirrors RESEARCH.md lines 312-368). No fields added, removed, or relaxed.

## CLI Exit-Code Contract (D-09)

| ScrapeResult.status | Exit code | Shell-verified |
|---|---|---|
| `ok` | 0 | (will be exercised by plan 07's drom orchestrator) |
| `error` | 1 | `pnpm scrape` (no arg) → exit 1 (also covers thrown-error path via try/catch) |
| `not_implemented` | 2 | `pnpm scrape:encar`, `:beforward`, `:che168`, `:autohome` → all exit 2 |
| `blocked` | 3 | (will be exercised by plan 07's BlockedError path) |

## Verifications (all green)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (179 packages, 929ms) |
| `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 |
| `pnpm vitest run server/tests/stubs.test.ts` | exit 0 — **Test Files 1 passed (1) / Tests 12 passed (12)** |
| `pnpm scrape:encar; echo $?` | `2` |
| `pnpm scrape:beforward; echo $?` | `2` |
| `pnpm scrape:che168; echo $?` | `2` |
| `pnpm scrape:autohome; echo $?` | `2` |
| `pnpm scrape; echo $?` (no arg) | `1` (with usage: `Usage: pnpm scrape <drom\|encar\|beforward\|che168\|autohome>`) |
| `grep -c "ScrapeResult" server/scrapers/shared/types.ts` | 2 (export + interface ref) |
| `grep -c console.warn server/scrapers/{encar,beforward,che168,autohome}/index.ts` | exactly 1 per stub |
| `grep -E "\.default\(\|\.optional\(\)" server/scrapers/shared/types.ts` | empty (Pitfall 1: strictness preserved) |
| `head -1 server/scrapers/drom/index.ts` | `// server/scrapers/drom/index.ts — TEMPORARY PLACEHOLDER (replaced by plan 01-07)` |

## Test Output

```
 RUN  v3.2.4
 ✓ server/tests/stubs.test.ts (12 tests) 2ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Duration  284ms
```

12 = 4 stubs × 3 assertions:
- exposes the expected source identifier
- resolves to a not_implemented ScrapeResult (with non-empty `todo`)
- logs exactly one TODO warning per run() invocation

## Stub Sample Output (encar)

```
[encar] TODO: implement Encar scraper per IScraper contract (deferred to v1.x)
{
  "status": "not_implemented",
  "source": "encar",
  "deferredTo": "v1.x",
  "todo": "Implement Encar scraper per IScraper contract; uses Crawlee+Playwright Firefox + KR residential proxy + Carapis fallback"
}
ELIFECYCLE Command failed with exit code 2.
```

## Decisions Made

- **drom placeholder ships in this plan** (overwritten by plan 01-07). Without it, `cli.ts` cannot import `./drom/index.js` at compile time. The placeholder satisfies `IScraper` and returns `{status:'not_implemented', deferredTo:'v1.x'}`; per-file leading comment makes the temporary nature explicit.
- **Top-level await in cli.ts** is permitted because `tsconfig.server.json` uses `module: NodeNext` AND `package.json` declares `"type": "module"`. No IIFE wrapper needed; thrown errors are caught explicitly and mapped to `{status:'error'}`.
- **ModelRecord zod schema kept verbatim strict** (no `.default`, no `.optional` on required fields). Pitfall 1 mitigation. Plan 07's drom orchestrator must add records that fail validation to `report.errors[]`, not relax the schema — this is also documented as T-02-04 in the plan's threat model.
- **The 4 stubs are intentionally near-identical** (same shape, differ only on `source` and `todo`). Tests are parameterised over a shared `stubs[]` array. v1.x authors swap the function body without renaming exports or files.

## Deviations from Plan

None — plan executed exactly as written. All file contents are the verbatim blocks specified in the plan's `<action>` sections.

One incidental action not in the task list itself but called out by the orchestrator's worktree note: **deleted `server/scrapers/shared/scaffold.ts`** (the plan 01-01 throwaway placeholder). This was committed as part of Task 1 because once the real `types.ts` lands, the scaffold is no longer needed to keep `tsc` happy. Documented inline in the Task 1 commit message.

## Threat Model Compliance

| Threat ID | Status |
|---|---|
| T-02-01 (argv injection into SCRAPERS lookup) | **Mitigated.** `cli.ts` uses `Record<string, IScraper>` with explicit hardcoded keys; lookup is `SCRAPERS[sourceArg]`. Invalid keys hit `if (!SCRAPERS[sourceArg])` → exit 1. No `eval`, no `require(arg)`, no prototype-pollution surface. Shell-verified: `pnpm scrape unknown` → exit 1 with usage. |
| T-02-02 (stub `console.warn` reveals architecture) | **Accepted.** TODOs are intentional documentation aids for v1.x authors; no secrets, no PII. Output goes to stderr, not stdout. |
| T-02-03 (malformed ScrapeResult crashes CLI) | **Mitigated.** TS discriminated union + `EXIT_CODES[result.status]` lookup is exhaustive at compile time. The `try/catch` wrapping `run()` maps any runtime throw to `{status:'error'}`, never an unhandled rejection. |
| T-02-04 (future plan widens ModelRecord permissively) | **Mitigated by structure.** types.ts has zero `.default(`/`.optional()` on required fields; verified with grep `\.default\(\|\.optional\(\)` → empty match. Plan 07 acceptance criteria forbid relaxing the schema. |

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries are introduced. The only argv-handling surface (cli.ts) is covered by the threat register above (T-02-01).

## Known Stubs

- `server/scrapers/encar/index.ts`, `server/scrapers/beforward/index.ts`, `server/scrapers/che168/index.ts`, `server/scrapers/autohome/index.ts` — these are **intentional v1.x stubs** explicitly scoped out of v1 (per CLAUDE.md "Inventory data sources (v1)" and the plan's must_haves). They return `{status:'not_implemented', deferredTo:'v1.x', todo:<hint>}` so the IScraper contract surface is exercised end-to-end and v1.x authors have a precise contract to fill. Tested in `server/tests/stubs.test.ts`.
- `server/scrapers/drom/index.ts` — **temporary placeholder**, will be overwritten by plan 01-07's real orchestrator. Per-file leading comment documents this. Not a deferred feature; just a build-order artifact.

These stubs are a **deliberate** Phase 1 outcome (the plan's purpose includes "4 stubs returning not_implemented"). They do not block the Phase 1 goal — drom is the Phase 1 master-models source, and plan 07 implements it.

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | `bf1666d` | `feat(01-02): add IScraper contract types and atomicWriteFile primitive` |
| 2 | `c5005a8` | `feat(01-02): add 4 v1.x stubs + drom placeholder + CLI dispatcher` |
| 3 | `24716db` | `test(01-02): add stubs.test.ts covering 4 stub IScrapers (12 tests)` |

(Plan-metadata commit will be made by the orchestrator after wave 2 completes.)

## Next Phase Readiness

- **Plans 03..06 (wave 3+):** can now `import type { IScraper, ScrapeResult, ModelRecord } from '../shared/types.js'` and `import { atomicWriteFile } from '../shared/atomic-write.js'` against a stable, type-checked surface.
- **Plan 01-07 (drom orchestrator):** will overwrite `server/scrapers/drom/index.ts` with the real implementation; `cli.ts` already imports `./drom/index.js` correctly. The exit-code contract (D-09) is locked.
- **Phase 4 importer:** `ModelRecord` zod schema is the binding contract — it matches `data/scraped/SCHEMA.md` (plan 01-08) field-for-field.

## Self-Check: PASSED

**File existence checks:**
- `server/scrapers/shared/types.ts` — FOUND
- `server/scrapers/shared/atomic-write.ts` — FOUND
- `server/scrapers/encar/index.ts` — FOUND
- `server/scrapers/beforward/index.ts` — FOUND
- `server/scrapers/che168/index.ts` — FOUND
- `server/scrapers/autohome/index.ts` — FOUND
- `server/scrapers/drom/index.ts` — FOUND
- `server/scrapers/cli.ts` — FOUND
- `server/tests/stubs.test.ts` — FOUND
- `server/scrapers/shared/scaffold.ts` — CORRECTLY ABSENT (deleted in Task 1)

**Commit hash checks:**
- `bf1666d` — FOUND in `git log --oneline`
- `c5005a8` — FOUND in `git log --oneline`
- `24716db` — FOUND in `git log --oneline`

**Pipeline checks:**
- `pnpm tsc -p tsconfig.server.json --noEmit` — exit 0
- `pnpm vitest run server/tests/stubs.test.ts` — exit 0 (12/12 tests passed)
- `pnpm scrape:encar` — exit 2
- `pnpm scrape:beforward` — exit 2
- `pnpm scrape:che168` — exit 2
- `pnpm scrape:autohome` — exit 2
- `pnpm scrape` (no arg) — exit 1
- `grep -E "\.default\(|\.optional\(\)" server/scrapers/shared/types.ts` — empty (Pitfall 1 preserved)

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Plan: 02*
*Completed: 2026-04-28*
