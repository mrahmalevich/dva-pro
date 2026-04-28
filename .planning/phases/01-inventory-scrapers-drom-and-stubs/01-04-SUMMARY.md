---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 04
subsystem: scrapers/shared
tags: [sharp, webp, images, brand-aliases, idempotent-merge, atomic-write]
requires:
  - "server/scrapers/shared/atomic-write.ts (plan 02)"
  - "server/scrapers/shared/http.ts (plan 03 — wave-3 sibling, merged at orchestrator level)"
provides:
  - "downloadAndConvert(url, outRelative, runDir) → ImageWriteResult"
  - "transcodeBufferToWebp(buf, outRelative, runDir) → ImageWriteResult"
  - "type ImageWriteResult = { path; bytes; width; height }"
  - "mergeAliases(filePath, incoming) — idempotent, byte-stable JSON merge"
  - "type AliasMap, type BrandAlias, type ModelAlias"
affects:
  - "Plan 07 drom orchestrator (will call downloadAndConvert per record + mergeAliases per brand)"
tech-stack:
  added: []  # all deps already present (sharp ^0.34.5, p-limit ^7.3.0)
  patterns: [Pattern 2 atomic write, sharpLimit pLimit(4), libvips DoS hardening]
key-files:
  created:
    - "server/scrapers/shared/images.ts"
    - "server/scrapers/shared/brand-aliases.ts"
    - "server/tests/images.test.ts"
    - "server/tests/brand-aliases.test.ts"
    - "server/tests/fixtures/images/hero.jpg"
  modified: []
decisions:
  - "Used sharp 0.34.x failOn: 'error' instead of deprecated failOnError: true"
  - "transcodeBufferToWebp helper added so unit tests avoid network — orchestrator uses downloadAndConvert"
  - "Brand-aliases sort applied at BOTH brand-slug AND model-slug levels (JSON.stringify preserves insertion order)"
metrics:
  duration_seconds: 358
  duration_human: "5m 58s"
  tasks_completed: 2
  tests_added: 8
  test_pass_rate: "8/8"
  completed_at: "2026-04-28T11:57:17Z"
---

# Phase 01 Plan 04: Image Pipeline + Brand-Aliases Idempotent Merge Summary

Sharp-based JPEG→WebP transcoder with libvips DoS hardening, plus byte-stable idempotent JSON merge for the Cyrillic↔Latin brand-alias dictionary; both wired through the shared `atomicWriteFile` Pattern 2 to prevent partial-write artifacts.

## Objective Delivered

Two tightly-related shared modules implementing SCRAPE-06 (image rehost adapted to local WebP) and SCRAPE-10 (brand-alias auto-build with idempotent merge), each with vitest coverage:

- **`shared/images.ts`** exports `downloadAndConvert` (network) + `transcodeBufferToWebp` (test-friendly pure function), gated by `pLimit(4)` for CPU-bound sharp parallelism (D-14). Hardened with `limitInputPixels: 50_000_000` (Pitfall 5) and `failOn: 'error'` to refuse malformed input.
- **`shared/brand-aliases.ts`** exports `mergeAliases` — reads existing JSON (treating absent or corrupt files as empty), union-merges models per brand_slug (last-write-wins on collisions), and sorts both brand_slug AND model_slug keys via `localeCompare` so a re-run with the same input produces a byte-identical file (the SCRAPE-10 idempotency anchor).

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Image pipeline + JPEG fixture + tests | `143e140` | `server/scrapers/shared/images.ts`, `server/tests/images.test.ts`, `server/tests/fixtures/images/hero.jpg` |
| 2 | Brand-aliases idempotent merge module + tests | `84a1040` | `server/scrapers/shared/brand-aliases.ts`, `server/tests/brand-aliases.test.ts` |

## Key Artifacts

### `server/scrapers/shared/images.ts`
- `downloadAndConvert(imageUrl, outRelative, runDir): Promise<ImageWriteResult>` — fetches via `fetchBuffer` (plan 03), transcodes to WebP quality 80, writes atomically to `resolve(runDir, outRelative)`.
- `transcodeBufferToWebp(buf, outRelative, runDir): Promise<ImageWriteResult>` — pure transcode for tests; could be used by an orchestrator-level cache re-encode path later.
- `sharpLimit = pLimit(4)` — wraps both functions so concurrent calls cap libvips CPU at 4.
- Sharp pipeline: `sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error' })` — refuses anything > 50MP; fails fast on malformed input.

### `server/scrapers/shared/brand-aliases.ts`
- `mergeAliases(filePath, incoming): Promise<void>`
- Type chain: `AliasMap = Record<brand_slug, BrandAlias>`, `BrandAlias = { ru, latin, models }`, `ModelAlias = { ru, latin }`.
- Critical sort step: keys sorted at both brand and model level into fresh objects via insertion-order, then `JSON.stringify(_, null, 2)` produces byte-stable output.

### `server/tests/fixtures/images/hero.jpg`
- 100 × 80, 322 bytes, JPEG quality 90.
- Generated programmatically with sharp (per plan instruction) — no opaque binary blob; reproducible.

## Test Coverage

| File | Cases | Pass |
|------|-------|------|
| `server/tests/images.test.ts` | 3 (dim preservation, RIFF/WEBP magic bytes, byte-count sanity) | 3/3 |
| `server/tests/brand-aliases.test.ts` | 5 (sorted-key creation, **byte-identical idempotency = SCRAPE-10 anchor**, prior-brand preservation, union-merge with last-write-wins, corrupt-file recovery) | 5/5 |
| **Total** | **8** | **8/8** |

`pnpm vitest run server/tests/images.test.ts server/tests/brand-aliases.test.ts` exits 0.
`pnpm tsc -p tsconfig.server.json --noEmit` exits 0 (with the wave-3 stub in place; verified before stub removal).

## Wave-3 Parallel-Wave Note

`server/scrapers/shared/images.ts` imports `fetchBuffer` from `./http.js`, which is provided by the **sibling plan 03** in the same wave 3 (parallel branch). To exercise the images test in this isolated worktree, a temporary local `http.ts` stub was placed at `server/scrapers/shared/http.ts`, `pnpm vitest` was run with both modules to confirm green, then the stub was deleted before final commit. The stub was never staged or committed — only the plan-04-specified files appear in the two commits. After the orchestrator merges plan 03's branch, the real `http.ts` (got@15 client, polite delay, retry, cookie jar) will satisfy the import for production use.

## Test Surface Note

Per plan instruction: this plan tests `transcodeBufferToWebp` only (no network). End-to-end exercise of `downloadAndConvert` happens in **plan 07** drom-integration.test, where the orchestrator stubs the shared HTTP client and asserts the full image flow (download → encode → atomic write → record image_paths in models.json).

## Decisions Made

- **`failOn: 'error'`** chosen over deprecated `failOnError: true` (sharp 0.34.x). Same intent — refuse malformed inputs immediately — using the supported API.
- **`transcodeBufferToWebp` exported** in addition to `downloadAndConvert`. Reasoning: keeps the unit test fully offline (no need to mock got/fetch), and gives the future orchestrator a hook for cached re-encoding without re-fetching the source image.
- **Sort applied at both levels** (brand-slug AND model-slug). `JSON.stringify` preserves the ECMAScript insertion order of plain object keys; sorting only at the brand level would leave model insertion order non-deterministic and break the SCRAPE-10 byte-equality test.
- **Corrupt-file recovery via empty try/catch on `JSON.parse`**. The file is committed to git and hand-edited only in reviewed PRs (per threat T-04-03 disposition); a wholesale overwrite on parse failure is acceptable because the merge call always supplies a complete brand snapshot for each brand the orchestrator just scraped.

## Threat Mitigations Applied

| Threat | Mitigation |
|--------|------------|
| T-04-01 (image OOM via 100MP source) | `limitInputPixels: 50_000_000` rejects anything larger before allocation. |
| T-04-02 (libvips parser bug on malformed input) | `failOn: 'error'` short-circuits decode on first error. Pinned sharp 0.34.x in lockfile. Residual risk accepted at ASVS L1. |
| T-04-03 (prototype pollution via `__proto__` in brand-aliases.json) | Merge writes into fresh object literals via spread + bracket assignment; `JSON.parse` does not pollute Object.prototype in modern Node. No additional zod gate added (file is git-tracked + reviewed). |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave-3 dependency on `./http.js` (plan 03 sibling)**
- **Found during:** Task 1 GREEN phase (vitest module-load failure for `images.ts`)
- **Issue:** `images.ts` imports `fetchBuffer` from `./http.js`, but the worktree (parallel wave 3) does not yet contain plan 03's `http.ts`. Vitest cannot load the module under test and reports `Cannot find module '../scrapers/shared/images.js'`.
- **Fix:** Added an unstaged local stub `server/scrapers/shared/http.ts` exporting throw-only `fetchBuffer` / `fetchHtml` to satisfy import resolution. The stub was deleted before any commit. The plan-04 commits contain only the plan-specified files. After the orchestrator merges plan 03, the real `http.ts` provides the runtime implementation.
- **Files modified:** none committed; ephemeral stub in worktree only.
- **Commit:** n/a (stub never staged)

No other deviations — the plan's pseudocode matched the final source verbatim.

## Key Files

- `server/scrapers/shared/images.ts` (NEW) — sharp WebP transcode + sharpLimit
- `server/scrapers/shared/brand-aliases.ts` (NEW) — idempotent JSON merge
- `server/tests/images.test.ts` (NEW) — 3 vitest cases against fixture
- `server/tests/brand-aliases.test.ts` (NEW) — 5 vitest cases incl. SCRAPE-10 byte-equality
- `server/tests/fixtures/images/hero.jpg` (NEW) — 100×80 JPEG, 322 bytes

## Self-Check: PASSED

Verified each created file exists on disk and each commit hash is present in `git log`:

```
FOUND: server/scrapers/shared/images.ts
FOUND: server/scrapers/shared/brand-aliases.ts
FOUND: server/tests/images.test.ts
FOUND: server/tests/brand-aliases.test.ts
FOUND: server/tests/fixtures/images/hero.jpg
FOUND: 143e140 (Task 1 commit)
FOUND: 84a1040 (Task 2 commit)
```

8/8 tests passing, tsc --noEmit clean (with stub), no untracked files in worktree, no `.tmp` artifacts left behind.
