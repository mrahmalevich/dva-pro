---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 06
subsystem: scrapers
tags: [cursor, symlink, atomic, fs-primitive, tdd, crash-recovery]

# Dependency graph
requires:
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: server/scrapers/shared/atomic-write.ts (Pattern 2; tmp + POSIX rename) — used by writeCursor (plan 01-02)
  - phase: 01-inventory-scrapers-drom-and-stubs
    provides: tsconfig.server.json + vitest.config.ts + server/scrapers/shared/ + server/tests/ tree (plan 01-01)
provides:
  - server/scrapers/shared/cursor.ts — readCursor / writeCursor / deleteCursor + Cursor type (D-15 brand-boundary checkpoint)
  - server/scrapers/shared/symlink.ts — pointCurrentAt(runDir) atomic symlink update (D-08; symlink-to-tmp + POSIX rename per RESEARCH A7)
  - server/tests/cursor.test.ts — 7 tests covering round-trip, idempotent delete, kill-mid-run resume
  - server/tests/symlink.test.ts — 4 tests covering atomic-replace visibility, relative target, no tmp leftover
affects:
  - "Plan 01-07 (drom orchestrator): can now writeCursor() after every brand and pointCurrentAt(runDir) after a successful run; deleteCursor() on clean exit"
  - "Plan 01-08 (data/scraped/README.md): documents Pitfall 7 — Phase 4 importer must always re-resolve current/ per invocation; never cache realpath()"
  - "Phase 4 importer: atomic visibility property guarantees a concurrent reader of current/ always lands on a complete run dir, never a half-state"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cursor is silently-corrupt-tolerant (try/catch around readFile + JSON.parse → null) so a hand-edited or partial .cursor.json never crashes the orchestrator on resume"
    - "deleteCursor swallows ENOENT (.catch(()=>{})) so successful runs end cleanly even on second invocation against an already-clean tree"
    - "Atomic symlink replace via symlink-to-tmp + rename: POSIX rename() over an existing symlink is atomic on the same filesystem (macOS APFS, Linux ext4); avoids the unlink-then-symlink race window where the link briefly does not exist"
    - "Symlink target is RELATIVE (basename(runDir), not the absolute path) so the link survives if the parent directory is moved (e.g., data/scraped/drom is rsynced to a new mount)"
    - "Per-PID + epoch tmp suffix on symlink (`current.tmp.${pid}.${epoch}`) avoids cross-PID collisions if two scrapers ever try to point at current/ simultaneously (single-machine v1 invariant, but cheap insurance)"
    - "TDD RED → GREEN gate enforced per task: test commit (failing import) → impl commit (passing tests)"

key-files:
  created:
    - server/scrapers/shared/cursor.ts
    - server/scrapers/shared/symlink.ts
    - server/tests/cursor.test.ts
    - server/tests/symlink.test.ts
  modified: []
  deleted: []

key-decisions:
  - "cursor.ts kept verbatim from PATTERNS.md sketch (lines 750-773). No fields added beyond {lastBrandSlug, lastModelSlug, completedAt}; finer-grained cursor (per-model, per-page) is a Phase 1.x candidate per Pitfall 3."
  - "symlink.ts is verbatim from RESEARCH.md A7 (lines 776-789). The relative-target choice is binding for D-08 atomic-visibility guarantees and for survival across `mv data/scraped/drom data/scraped/drom-archive` operations."
  - "deleteCursor uses .catch(()=>{}) rather than checking existsSync first — TOCTOU-safe (no file-existence race window) and matches the Pitfall 3 principle of 'cursor cleanup is fire-and-forget; absent file is the success state'."
  - "Cursor read-error is silently swallowed to null (no thrown exception). Rationale: a corrupt cursor only loses time (re-fetch up to 1 brand), never causes data corruption, because the orchestrator zod-validates each ModelRecord per Pitfall 1. Throwing here would force the orchestrator to add try/catch at the call site for no win."
  - "TDD per-task: RED commit (failing test) precedes GREEN commit (impl) for both cursor and symlink. Gate sequence is provable from git log (`test(01-06)` then `feat(01-06)` × 2)."

patterns-established:
  - "Filesystem checkpoint pattern: try-read + JSON.parse → null on any error; atomic write through atomicWriteFile; idempotent delete via .catch(()=>{}). Reusable for any future per-run checkpoint files."
  - "Atomic symlink swap pattern: pre-compute linkPath = resolve(dirname(runDir), 'current'); tmpLink = `${linkPath}.tmp.${pid}.${epoch}`; symlink(basename(target), tmpLink); rename(tmpLink, linkPath). No intermediate unlink — POSIX rename() handles the atomic replace."
  - "Test convention: each FS test uses mkdtemp(tmpdir(), 'dva-<feature>-') in beforeEach + rm(recursive,force) in afterEach; assertion patterns rely on existsSync (sync) for present/absent + readFile / readlink for content/target equality."

requirements-completed: []

# Metrics
duration: ~3m
duration_minutes: 3
completed_date: "2026-04-28"
tasks_completed: 2
files_created: 4
files_modified: 0
files_deleted: 0
---

# Phase 01 Plan 06: Cursor + Symlink Filesystem Primitives Summary

Two crash-tolerance FS primitives for the drom backfill: `shared/cursor.ts` (D-15 brand-boundary `.cursor.json` checkpoint, round-tripping through `atomicWriteFile`) and `shared/symlink.ts` (D-08 / A7 atomic update of `data/scraped/drom/current/` via symlink-to-tmp + POSIX rename with a relative target). 11 vitest cases (7 cursor + 4 symlink) green; both modules committed under TDD RED→GREEN gates.

## What Shipped

| Artifact | Purpose |
|---|---|
| `server/scrapers/shared/cursor.ts` | `Cursor` type (`{lastBrandSlug, lastModelSlug, completedAt}`) + `readCursor` (null on absent or corrupt) + `writeCursor` (via `atomicWriteFile`) + `deleteCursor` (silently idempotent). D-15 brand-boundary checkpoint per Pitfall 3 trade-off |
| `server/scrapers/shared/symlink.ts` | `pointCurrentAt(runDir)` — atomic update of `<dirname(runDir)>/current` symlink to `basename(runDir)` via tmp-link + `rename`. D-08 atomic visibility per RESEARCH A7 |
| `server/tests/cursor.test.ts` | 7 vitest cases: absent → null, corrupt → null, write+read round-trip, no `.tmp` leftover, delete removes file, delete is idempotent (no throw on missing), kill-mid-run resume simulation |
| `server/tests/symlink.test.ts` | 4 vitest cases: first-call create, atomic replace + visibility (read through `current/models.json` switches A → B), no `current.tmp.*` leftover, target is relative basename |

## Test Output

```
 RUN  v3.2.4

 ✓ server/tests/symlink.test.ts (4 tests) 8ms
 ✓ server/tests/cursor.test.ts (7 tests) 10ms

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Duration  267ms
```

11 = 7 (cursor) + 4 (symlink). Meets the success-criteria floor (≥7 + 4 = ≥11). Each test resets state in `beforeEach`/`afterEach` with `mkdtemp` + `rm(recursive,force)`.

## Verifications (all green)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (not previously run in worktree; restored full deps) |
| `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 |
| `pnpm vitest run server/tests/cursor.test.ts server/tests/symlink.test.ts` | exit 0 — **Test Files 2 passed (2) / Tests 11 passed (11)** |
| Acceptance grep: `export type Cursor` in `cursor.ts` | match |
| Acceptance grep: `export async function {readCursor,writeCursor,deleteCursor}` in `cursor.ts` | all 3 match |
| Acceptance grep: `atomicWriteFile` in `cursor.ts` | match |
| Acceptance grep: literal `.cursor.json` in `cursor.ts` | match (CURSOR_FILENAME constant) |
| Acceptance grep: `kill mid-run` in `cursor.test.ts` | match |
| Acceptance grep: `idempotent` in `cursor.test.ts` | match (twice — describe + assertion) |
| Acceptance grep: `export async function pointCurrentAt` in `symlink.ts` | match |
| Acceptance grep: `rename` in `symlink.ts` | match |
| Acceptance grep: `basename(runDir)` in `symlink.ts` | match |
| Acceptance grep: `target.startsWith('/')` in `symlink.test.ts` | match |
| Atomic semantics — no `.tmp` leftover after `writeCursor` | asserted in test "writeCursor uses atomic write (no .tmp leftover on success)" |
| Atomic semantics — no `current.tmp.*` leftover after `pointCurrentAt` | asserted in test "does not leave .tmp.* link artifacts after successful update" |
| Post-commit deletion check | none in any commit |

## TDD Gate Compliance

Per-task TDD gates, in order:

| Task | RED commit (failing test) | GREEN commit (passing impl) |
|---|---|---|
| 1 (cursor) | `14ba0e5` `test(01-06): add failing cursor.ts tests (RED gate, D-15)` | `2b3e124` `feat(01-06): implement cursor.ts brand-boundary checkpoint (D-15, GREEN)` |
| 2 (symlink) | `d99dc70` `test(01-06): add failing pointCurrentAt tests (RED gate, D-08/A7)` | `34197c3` `feat(01-06): implement pointCurrentAt atomic symlink update (D-08, A7, GREEN)` |

RED commits demonstrably failed (`Cannot find module '../scrapers/shared/cursor.js'` / `'../scrapers/shared/symlink.js'`) before the corresponding implementation landed. Gate sequence fully provable from `git log --oneline`.

No REFACTOR commit was needed — both modules ship verbatim from the plan's `<action>` block (which mirrors PATTERNS.md / RESEARCH.md verbatim sketches).

## Decisions Made

- **`readCursor` swallows all errors → returns `null`.** Rationale: a corrupt or partially-written `.cursor.json` only forces re-fetch of up to 1 brand (Pitfall 3 worst-case ~7h). The orchestrator's per-record zod validation (Pitfall 1) means a bad cursor cannot cause data corruption — only time. Throwing here would force the orchestrator caller to add try/catch for zero correctness gain.
- **`deleteCursor` uses `unlink().catch(()=>{})` (no `existsSync` pre-check).** TOCTOU-safe (no file-existence race window between check and unlink) and matches the principle "absent cursor IS the success state". Two consecutive `deleteCursor` calls cost only one `ENOENT` syscall.
- **Symlink target is RELATIVE (basename), not absolute.** Two reasons: (1) D-08 atomicity is preserved across `mv data/scraped/drom data/scraped/drom-archive` operations; (2) `readlink` returning a clean basename (e.g., `2026-04-28T07-30-00Z`) is human-debuggable and stable across machines.
- **Tmp-link suffix includes `${pid}.${epoch}`.** Single-machine invariant means PID alone would suffice, but adding epoch makes the suffix unique even within a single PID across rapid successive calls. Defensive; tests don't depend on this beyond "no `current.tmp.*` left after success".
- **No REFACTOR commit per task.** The plan-prescribed implementations are minimal (39 + 25 lines including JSDoc) and have no logical dead weight. A refactor commit would be ceremony.

## Deviations from Plan

None. Both modules are byte-for-byte the verbatim blocks specified in the plan's `<action>` sections (which mirror PATTERNS.md `§cursor.ts` lines 750-773 and RESEARCH.md `§Atomic symlink` lines 776-789). Both test files are byte-for-byte the plan's verbatim test blocks.

One environmental action not in the task list itself: `pnpm install --frozen-lockfile` was run because the parallel worktree spawned without `node_modules`. This is environment setup, not a deviation from plan content — no files were created or committed by this step (lockfile already canonical from earlier wave).

## Threat Model Compliance

| Threat ID | Status |
|---|---|
| T-06-01 (Hand-edited `.cursor.json` causes wrong resume) | **Accepted as documented.** Cursor file is gitignored via plan 01's `.gitignore`. A bad cursor causes re-fetch of wrong models, not data corruption — orchestrator's zod validation per Pitfall 1 catches malformed records. Out of scope for ASVS L1. |
| T-06-02 (Symlink swapped between rename + Phase 4 read) | **Accepted as documented.** Phase 1 + Phase 4 do not run concurrently in v1 (single dev machine). Phase 4's documented contract is "always re-resolve `current/` per invocation" — Pitfall 7 — captured for plan 08's README. |
| T-06-03 (Malicious symlink target → Phase 4 reads `/etc/passwd`) | **Mitigated by structure.** `pointCurrentAt` computes the target via `basename(runDir)` — a pure baseName extraction with no `..` traversal possible. Even if `runDir` were attacker-controlled (it isn't — it comes from the orchestrator's run-id minting), the symlink target string is constrained to a single path component. Phase 4's importer is independently expected to validate that `realpath(current)` falls under `data/scraped/` (out of scope for this plan). |
| T-06-04 (`.cursor.json` accidentally committed) | **Mitigated by structure.** Plan 01's `.gitignore` already excludes `data/scraped/**/.cursor.json`. The orchestrator (plan 07) writes `.cursor.json` into per-run dirs that are themselves gitignored. |

## Threat Flags

None — no new network endpoints, auth paths, or schema changes at trust boundaries are introduced. The two new file-access patterns (`.cursor.json` per-run + `current` symlink) are in-scope for the plan's threat register above (T-06-01..04). No new threat surface to flag.

## Known Stubs

None. Both `cursor.ts` and `symlink.ts` are fully implemented and exercised by tests. No placeholder code, no TODO markers, no empty data flows.

## Forward-Carrying Notes (for plan 07 + plan 08)

- **Plan 07 (drom orchestrator) wiring:** `writeCursor(runDir, {lastBrandSlug, lastModelSlug, completedAt: new Date().toISOString()})` after every model in a brand boundary; `pointCurrentAt(runDir)` only after a successful run; `deleteCursor(runDir)` immediately after `pointCurrentAt` succeeds. Resume flow: at run start, `await readCursor(runDir)` → if non-null, skip brands ≤ `lastBrandSlug` and within that brand skip models ≤ `lastModelSlug`.
- **Plan 08 (`data/scraped/README.md`) Pitfall 7 callout:** Phase 4's importer MUST always re-resolve `current/` per invocation (never cache `realpath()` across runs) — the symlink target rotates with each successful scrape, and the importer's correctness depends on always reading the freshest target. The current README.md draft already documents this (lines 60-63); no further action needed in this plan.
- **Pitfall 3 escalation trigger:** if plan 09's smoke run shows a mid-brand crash burning >1 brand's worth of pages on resume, escalate to a Phase 1.x finer-grained cursor (per-model or per-page granularity). The current cursor shape is forward-compatible with adding optional fields like `lastGenerationSlug` without breaking existing `.cursor.json` files (`readCursor` already tolerates extra keys via `as Cursor` cast).

## Commits

| Task | Phase | Hash | Message |
|---|---|---|---|
| 1 (cursor) | RED | `14ba0e5` | `test(01-06): add failing cursor.ts tests (RED gate, D-15)` |
| 1 (cursor) | GREEN | `2b3e124` | `feat(01-06): implement cursor.ts brand-boundary checkpoint (D-15, GREEN)` |
| 2 (symlink) | RED | `d99dc70` | `test(01-06): add failing pointCurrentAt tests (RED gate, D-08/A7)` |
| 2 (symlink) | GREEN | `34197c3` | `feat(01-06): implement pointCurrentAt atomic symlink update (D-08, A7, GREEN)` |

(Plan-metadata commit will be made by the orchestrator after wave 3 merges.)

## Next Phase Readiness

- **Plan 01-07 (drom orchestrator):** can now `import { readCursor, writeCursor, deleteCursor } from '../shared/cursor.js'` and `import { pointCurrentAt } from '../shared/symlink.js'` against a stable, type-checked surface with green tests.
- **Plan 01-08 (data/scraped/README.md):** Pitfall 7 reader contract for `current/` is referenced verbatim in `symlink.ts` JSDoc; README.md task already includes this language.
- **Phase 4 importer:** the relative-target invariant is a hard constraint; importer must `realpath(current)` and validate it falls under the expected `data/scraped/<source>/` root.

## Self-Check: PASSED

**File existence checks:**
- `server/scrapers/shared/cursor.ts` — FOUND
- `server/scrapers/shared/symlink.ts` — FOUND
- `server/tests/cursor.test.ts` — FOUND
- `server/tests/symlink.test.ts` — FOUND

**Commit hash checks (all in `git log --oneline`):**
- `14ba0e5` — FOUND (test(01-06) RED cursor)
- `2b3e124` — FOUND (feat(01-06) GREEN cursor)
- `d99dc70` — FOUND (test(01-06) RED symlink)
- `34197c3` — FOUND (feat(01-06) GREEN symlink)

**Pipeline checks:**
- `pnpm tsc -p tsconfig.server.json --noEmit` — exit 0
- `pnpm vitest run server/tests/cursor.test.ts server/tests/symlink.test.ts` — exit 0 (11/11 tests passed)
- All acceptance greps from plan tasks 1 + 2 — match

---
*Phase: 01-inventory-scrapers-drom-and-stubs*
*Plan: 06*
*Completed: 2026-04-28*
