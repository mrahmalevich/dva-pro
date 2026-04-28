---
phase: 01-inventory-scrapers-drom-and-stubs
plan: 01
subsystem: infrastructure
tags: [pnpm, node, scaffolding, tsconfig, vitest, gitignore]
dependency_graph:
  requires: []
  provides:
    - "pnpm@10.29.2 toolchain + lockfile"
    - "Phase 1 runtime deps (got, cheerio, p-limit, sharp, iconv-lite, fast-xml-parser, zod, tough-cookie)"
    - "Phase 1 dev deps (tsx, vitest, @types/node)"
    - "tsconfig.server.json (NodeNext / ES2023 / no DOM)"
    - "vitest.config.ts (environment: node, include: server/tests/**)"
    - "server/scrapers/{drom,encar,beforward,che168,autohome,shared}/ tree"
    - "server/tests/ vitest root"
    - "data/scraped/** gitignore rules with documented exceptions"
  affects:
    - "Wave 2+ plans (02..08): every Phase 1 plan now has a working pnpm + tsc + vitest pipeline"
    - "Frontend Vite SPA build (verified still green at 250.96 kB)"
tech_stack:
  added:
    - "pnpm@10.29.2 (replaces npm)"
    - "got@15.0.3, tough-cookie@6.0.1, cheerio@1.2.0, p-limit@7.3.0"
    - "sharp@0.34.5 (darwin-arm64 libvips, esbuild + sharp postinstalls approved via pnpm.onlyBuiltDependencies)"
    - "iconv-lite@0.7.2, fast-xml-parser@4.5.6, zod@3.25.76"
    - "tsx@4.21.0, vitest@3.2.4 (NOT 4.x — see deviations)"
  patterns:
    - "Single root tsconfig.server.json keeps Node-side TS isolated from frontend Vite tsconfig.json"
    - "Vitest reuses Vite plugin pipeline via vitest/config (env: node)"
    - "pnpm.onlyBuiltDependencies whitelist replaces interactive `pnpm approve-builds` for esbuild + sharp"
key_files:
  created:
    - "tsconfig.server.json"
    - "vitest.config.ts"
    - "pnpm-lock.yaml"
    - "server/scrapers/.gitkeep"
    - "server/scrapers/drom/.gitkeep"
    - "server/scrapers/encar/.gitkeep"
    - "server/scrapers/beforward/.gitkeep"
    - "server/scrapers/che168/.gitkeep"
    - "server/scrapers/autohome/.gitkeep"
    - "server/scrapers/shared/.gitkeep"
    - "server/scrapers/shared/scaffold.ts"
    - "server/tests/.gitkeep"
  modified:
    - "package.json"
    - ".gitignore"
  deleted:
    - "package-lock.json"
decisions:
  - "Pinned vitest@^3.2.4 instead of plan-specified ^4.1.5 (vitest 4 requires vite 6+; frontend is locked at vite 5.4.x)"
  - "Scaffolded server/scrapers/ subtree in this plan rather than deferring to plans 02..07 (D-01 said 'foundations' here, and plans 02..07 in waves 2+ assume the directories exist)"
  - "Added one placeholder server/scrapers/shared/scaffold.ts so tsc -p tsconfig.server.json finds an input (avoids TS18003 against an empty tree); placeholder will be replaced once shared/types.ts lands"
  - "Added pnpm.onlyBuiltDependencies whitelist for esbuild + sharp so postinstall scripts run non-interactively in CI"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-28"
  tasks_completed: 3
  files_created: 12
  files_modified: 2
  files_deleted: 1
---

# Phase 01 Plan 01: Node-side Scaffolding + pnpm Migration Summary

Migrated the repo from npm → pnpm, added the entire Phase 1 backend dep tree (got + cheerio + p-limit + sharp + iconv-lite + fast-xml-parser + zod + tough-cookie + tsx + vitest + @types/node), and created the server-side TS / vitest configs plus the `server/scrapers/` directory tree — Phase 1 plans 02..08 now land on a green pipeline.

## What Shipped

| Artifact | Purpose |
|---|---|
| `package.json` | engines.node + packageManager pin + scrape:* / test / typecheck:server scripts + Phase 1 deps |
| `pnpm-lock.yaml` | Reproducible install (replaces package-lock.json) |
| `tsconfig.server.json` | Node-side TS config: NodeNext / ES2023 / no DOM / include `server/` |
| `vitest.config.ts` | Vitest root: environment `node`, include `server/tests/**/*.test.ts`, coverage scoped to `server/scrapers/**` |
| `.gitignore` | Excludes runtime scrape artifacts (`data/scraped/**/{models.json,images/,*.webp,report.json,...}`) but tracks `SCHEMA.md`, `README.md`, `drom/brand-aliases.json`. Also excludes `package-lock.json` (npm artifact). |
| `server/scrapers/{drom,encar,beforward,che168,autohome,shared}/` | Directory tree per D-01; placeholder `.gitkeep` files document each subsystem's purpose. Plans 02..07 fill them. |
| `server/tests/` | Vitest test root (empty, gitkept). |
| `server/scrapers/shared/scaffold.ts` | Tiny placeholder (`export const SCAFFOLD_VERSION = '01-01'`) so `tsc` finds at least one input. Will be deleted when real shared modules land. |

## Verifications (all green)

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | exit 0 (lockfile up to date, 372ms) |
| `pnpm build` (Vite SPA) | exit 0 (`dist/index.html` 0.96 kB, bundle 250.96 kB / 77.39 kB gzip, 347ms) |
| `pnpm tsc -p tsconfig.server.json --noEmit` | exit 0 (passes against the scaffold tree) |
| `pnpm vitest run --passWithNoTests` | exit 0 ("No test files found, exiting with code 0") |
| `git status` after commits | clean |
| Lockfile state | only `pnpm-lock.yaml` present; `package-lock.json` deleted and gitignored |
| `git check-ignore data/scraped/drom/<run>/models.json` | exit 0 (correctly ignored) |
| `git check-ignore data/scraped/SCHEMA.md` | exit 1 (correctly NOT ignored — negation works) |

## Sharp Native Binary

- Platform: **darwin-arm64** (Apple Silicon dev machine).
- libvips: 8.x bundled (sharp@0.34.5 reports `aom 3.13.1`, `cairo 1.18.4`, `freetype 2.14.1`, etc.).
- Postinstall: completed cleanly via `pnpm.onlyBuiltDependencies` allowlist (no interactive `pnpm approve-builds` prompt).
- Linux CI parity: `sharp@0.34.5` ships pre-built linux-x64 binaries; Phase 3 worker container should use `node:22-alpine` per CLAUDE.md (musl variants are also pre-built).

## Peer-Dep Warnings Observed

- **None on the final lockfile.** The first install (with `vitest@^4.1.5`) produced a peer-dep warning + a hard runtime failure (`ERR_PACKAGE_PATH_NOT_EXPORTED` against `vite/module-runner`). Switching to `vitest@^3.2.4` resolved both.
- One deprecated transitive dep flagged: `whatwg-encoding@3.1.1` (subdep of cheerio). Non-blocking — superseded internally by Node's built-in `TextDecoder` in modern releases.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Pinned `vitest@^3.2.4` instead of `^4.1.5`**
- **Found during:** Task 1 (first `pnpm install`).
- **Issue:** `vitest@4.x` declares `peerDependencies.vite: '^6.0.0 || ^7.0.0 || ^8.0.0'`. The frontend is locked at `vite@^5.4.10`. The peer warning was not just cosmetic — `pnpm vitest --version` worked but `pnpm vitest run` crashed at startup with `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './module-runner' is not defined by "exports" in vite/package.json`. Hard blocker on the plan's "vitest config wired" acceptance criterion.
- **Fix:** Downgraded to `vitest@^3.2.4` (latest 3.x). 3.x has no hard `vite` peer pin and works against vite 5.x.
- **Why not upgrade vite to 6:** vite 6 → vite 8 is a separate, larger migration that touches the frontend SPA build path. The plan explicitly preserves `vite@^5.4.10` (line 21 of the plan: "DO NOT modify the frontend tsconfig.json or vite.config.ts"). Downgrading vitest is the smaller, locally-scoped fix.
- **Forward note:** when the frontend eventually upgrades to vite 6+, vitest can be bumped to 4.x in lockstep. Until then, 3.2.4 is the stable choice — it is ESM-native, Vite-aligned, and well-supported.
- **Files modified:** `package.json` (devDependencies.vitest).
- **Commit:** 2e20674.

**2. [Rule 2 — Critical] Scaffolded the full `server/scrapers/` subtree in Task 2**
- **Found during:** Task 2 (running `pnpm tsc -p tsconfig.server.json --noEmit` returned `TS18003: No inputs were found`).
- **Issue:** D-01 says "server/scrapers/ tree established at repo root (foundations for {drom,encar,beforward,che168,autohome,shared} layout — actual files land in plans 02..07)". The plan's task list does not explicitly create the directory tree, yet (a) the must_haves D-01 line requires it and (b) the tsc verification fails without at least one TS input under `server/`.
- **Fix:** Created the six scraper subdirs + `shared/` + `tests/` with `.gitkeep` files documenting each subsystem's purpose. Plans 02..07 (waves 2+) will land real `IScraper` implementations and shared modules in these directories.
- **Files created:** `server/scrapers/.gitkeep`, `server/scrapers/{drom,encar,beforward,che168,autohome,shared}/.gitkeep`, `server/tests/.gitkeep`.
- **Commit:** 9027dc7.

**3. [Rule 3 — Blocking] Added `server/scrapers/shared/scaffold.ts` placeholder**
- **Found during:** Task 2 (after creating `.gitkeep` files, `tsc` still failed with TS18003 because dotfiles and `.gitkeep` are not TypeScript inputs).
- **Issue:** TypeScript 5.x errors (`TS18003`) when an `include` glob matches no `.ts/.tsx/.d.ts` files. Initially tried `server/scrapers/shared/.scaffold.ts` (dot-prefixed) — TS skips dotfiles by default. Renamed to `scaffold.ts` (no dot) so `include: ["server"]` finds it.
- **Fix:** One-line module exporting `SCAFFOLD_VERSION = '01-01' as const`. Will be deleted when plans 02..07 land real `shared/types.ts`.
- **Files created:** `server/scrapers/shared/scaffold.ts`.
- **Commit:** 9027dc7.

**4. [Rule 2 — Critical] Added `pnpm.onlyBuiltDependencies` whitelist**
- **Found during:** Task 1 (first `pnpm install`).
- **Issue:** pnpm 10.x defaults to NOT running postinstall scripts and instead emits an interactive "Run `pnpm approve-builds` to pick which dependencies should be allowed to run scripts" prompt. CI/automation cannot answer that prompt; sharp would never download its libvips binary.
- **Fix:** Added `"pnpm": { "onlyBuiltDependencies": ["esbuild", "sharp"] }` to `package.json` so `esbuild` and `sharp` postinstalls run unattended.
- **Threat-model note:** This widens supply-chain surface (T-01-01) by exactly two packages — both top-50 npm packages with reproducible binaries. Trade-off accepted; pinned at `sharp@^0.34.5` and `esbuild@0.21/0.27` via lockfile.
- **Files modified:** `package.json`.
- **Commit:** 2e20674.

## Threat Model Compliance

| Threat ID | Status |
|---|---|
| T-01-01 (supply chain) | Mitigated: `packageManager: "pnpm@10.29.2"` pinned, lockfile committed, `pnpm install --frozen-lockfile` is the contract. `onlyBuiltDependencies` whitelist limits postinstall execution to two packages. |
| T-01-02 (sharp native binary) | Accepted as planned. Pinned at `^0.34.5`, postinstall completed cleanly on darwin-arm64. |
| T-01-03 (.env / runtime data leak) | Mitigated: `.gitignore` rules verified by functional test — `data/scraped/**/{models.json,images/,...}` ignored, `SCHEMA.md / README.md / brand-aliases.json` tracked, `package-lock.json` ignored. |
| T-01-04 (Vite SPA broken) | Mitigated: `pnpm build` smoke green (250.96 kB bundle, identical to pre-migration shape). |
| T-01-05 (lockfile drift) | Mitigated: `packageManager` pin + lockfile committed + `pnpm install --frozen-lockfile` confirmed. |

## Known Stubs

- `server/scrapers/shared/scaffold.ts` — single-export placeholder (`SCAFFOLD_VERSION`). Deletion deferred until plans 02..07 land real shared modules. Documented inline in the file.

These are intentional and unblock Phase 1 — they do not represent missing functionality for this plan's goal (the plan's goal is "scaffolding only, no real scraper code yet").

## Threat Flags

None — this plan adds no new network endpoints, auth paths, or trust boundaries.

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | 2e20674 | `chore(01-01): migrate npm → pnpm + add Phase 1 deps` |
| 2 | 9027dc7 | `chore(01-01): add tsconfig.server.json + vitest.config.ts + server/ tree` |
| 3 | d05c983 | `chore(01-01): extend .gitignore for data/scraped/** and pnpm migration` |

## Self-Check: PASSED

**File existence checks:**
- `package.json` — FOUND
- `pnpm-lock.yaml` — FOUND
- `tsconfig.server.json` — FOUND
- `vitest.config.ts` — FOUND
- `.gitignore` — FOUND
- `server/scrapers/shared/scaffold.ts` — FOUND
- All six `server/scrapers/*/.gitkeep` files — FOUND
- `server/tests/.gitkeep` — FOUND
- `package-lock.json` — CORRECTLY ABSENT

**Commit hash checks:**
- 2e20674 — FOUND in `git log`
- 9027dc7 — FOUND in `git log`
- d05c983 — FOUND in `git log`

**Pipeline checks:**
- `pnpm install --frozen-lockfile` — exit 0
- `pnpm build` — exit 0 (Vite SPA still green)
- `pnpm tsc -p tsconfig.server.json --noEmit` — exit 0
- `pnpm vitest run --passWithNoTests` — exit 0
- `git status` — clean
