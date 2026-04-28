# Phase 01: Inventory Scrapers — drom.ru → JSON/WebP + Source Stubs - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 35 (1 modified, 34 new)
**Analogs found:** 3 partial / 35 (greenfield phase — Node-side scaffolding from scratch)

> **READ-FIRST FOR PLANNER.** This phase establishes the entire `server/` tree from a frontend-only Vite SPA repo. The honest truth — confirmed by reading every file in `src/` plus root configs — is **"no analog exists for ~32 of 35 files."** That's not a defect; it's the phase's defining property. The planner MUST therefore embed concrete code excerpts directly into PLAN.md actions (the planner's normal "follow analog X" pattern does not work here). The excerpts are sourced from `01-RESEARCH.md` §"Code Examples" and §"Architecture Patterns", which were fixture-verified live by the researcher on 2026-04-28. Where any partial analog exists in the existing repo (TypeScript style, discriminated-union types, ESM imports, package.json shape), it is called out in §"Partial Analogs From Existing Repo".
>
> **Key consequence for planner:** every PLAN.md action that creates a file in `server/scrapers/**` must include a verbatim code excerpt from RESEARCH.md, NOT a "match `src/foo.ts` pattern" reference. The "shared patterns" section below is the closest the existing repo gets, and it covers only style (TS strict, ESM, type-first design), not behavior.

---

## File Classification

> All paths are repo-root-relative. **Status:** `NEW` = creates file, `MOD` = edits existing file, `COMMIT` = file content committed to git, `IGNORE` = file gated by .gitignore.

### Wave 0 — Foundations (P-01 .. P-13)

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `package.json` | MOD/COMMIT | config (manifest) | n/a | `package.json` (existing) | exact-shape |
| `pnpm-lock.yaml` | NEW/COMMIT | config (lockfile) | n/a | `package-lock.json` (existing, will be deleted) | shape-only |
| `pnpm-workspace.yaml` | NEW/COMMIT | config (workspace) | n/a | NONE — greenfield | NONE |
| `tsconfig.server.json` | NEW/COMMIT | config (TS for Node side) | n/a | `tsconfig.json` (frontend) | role-match (different target/module/lib) |
| `vitest.config.ts` | NEW/COMMIT | config (test runner) | n/a | `vite.config.ts` (existing) | role-match (Vite-aligned config) |
| `.gitignore` | MOD/COMMIT | config (VCS exclusion) | n/a | `.gitignore` (existing) | exact-shape |
| `server/scrapers/cli.ts` | NEW/COMMIT | controller (CLI dispatcher) | request-response (argv → ScrapeResult) | NONE — greenfield | NONE |
| `server/scrapers/shared/types.ts` | NEW/COMMIT | model (zod + TS contracts) | n/a | `src/crm/types.ts` (existing) | role-match (TS domain types) |
| `server/scrapers/shared/atomic-write.ts` | NEW/COMMIT | utility (FS primitive) | file-I/O | NONE — greenfield | NONE |
| `server/scrapers/shared/http.ts` | NEW/COMMIT | service (HTTP client) | request-response (host → text/buffer) | NONE — greenfield | NONE |
| `server/scrapers/shared/normalize.ts` | NEW/COMMIT | utility (string parsers) | transform (raw → normalized) | NONE — greenfield | NONE |
| `server/scrapers/shared/images.ts` | NEW/COMMIT | service (image pipeline) | streaming + file-I/O (URL → WebP file) | NONE — greenfield | NONE |
| `server/scrapers/shared/fx.ts` | NEW/COMMIT | service (FX feed) | request-response + cache (CBR XML → JSON) | NONE — greenfield | NONE |
| `server/scrapers/shared/block-detection.ts` | NEW/COMMIT | utility (heuristic guard) | event-driven (counter → throw) | NONE — greenfield | NONE |
| `server/scrapers/shared/cursor.ts` | NEW/COMMIT | utility (resume state) | file-I/O | NONE — greenfield | NONE |
| `server/scrapers/shared/symlink.ts` | NEW/COMMIT | utility (FS primitive) | file-I/O | NONE — greenfield | NONE |
| `server/scrapers/shared/brand-aliases.ts` | NEW/COMMIT | service (idempotent merge) | file-I/O + transform | NONE — greenfield | NONE |
| `server/scrapers/encar/index.ts` | NEW/COMMIT | scraper (stub) | request-response (no-op) | NONE — greenfield | NONE |
| `server/scrapers/beforward/index.ts` | NEW/COMMIT | scraper (stub) | request-response (no-op) | NONE — greenfield | NONE |
| `server/scrapers/che168/index.ts` | NEW/COMMIT | scraper (stub) | request-response (no-op) | NONE — greenfield | NONE |
| `server/scrapers/autohome/index.ts` | NEW/COMMIT | scraper (stub) | request-response (no-op) | NONE — greenfield | NONE |

### Wave 0 — Tests (created alongside Wave 0 modules)

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `server/tests/http.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/normalize.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/images.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/fx.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/block-detection.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/cursor.test.ts` | NEW/COMMIT | test (integration) | n/a | NONE — greenfield | NONE |
| `server/tests/symlink.test.ts` | NEW/COMMIT | test (integration) | n/a | NONE — greenfield | NONE |
| `server/tests/brand-aliases.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/stubs.test.ts` | NEW/COMMIT | test (unit) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/cbr/XML_daily.windows-1251.xml` | NEW/COMMIT | fixture (binary) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/cbr/XML_daily.expected.json` | NEW/COMMIT | fixture (golden output) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/images/hero.jpg` | NEW/COMMIT | fixture (binary) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/drom/thin-response.html` | NEW/COMMIT | fixture (synthetic HTML) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/drom/captcha-response.html` | NEW/COMMIT | fixture (synthetic HTML) | n/a | NONE — greenfield | NONE |

### Wave 1 — Drom End-to-End (P-14 .. P-21)

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `server/tests/fixtures/drom/brand-index.html` | NEW/COMMIT | fixture (sanitized live HTML) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/drom/model-list.bmw.html` | NEW/COMMIT | fixture (sanitized live HTML) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/drom/generation-list.bmw.x5.html` | NEW/COMMIT | fixture (sanitized live HTML) | n/a | NONE — greenfield | NONE |
| `server/tests/fixtures/drom/generation.bmw.x5.g05.html` | NEW/COMMIT | fixture (sanitized live HTML) | n/a | NONE — greenfield | NONE |
| `server/scrapers/drom/parse-brand-index.ts` | NEW/COMMIT | parser (DOM → typed list) | transform (HTML → BrandRef[]) | NONE — greenfield | NONE |
| `server/scrapers/drom/parse-model-list.ts` | NEW/COMMIT | parser (DOM → typed list) | transform (HTML → ModelRef[]) | NONE — greenfield | NONE |
| `server/scrapers/drom/parse-generation-list.ts` | NEW/COMMIT | parser (DOM → typed list) | transform (HTML → GenerationRef[]) | NONE — greenfield | NONE |
| `server/scrapers/drom/parse-generation-page.ts` | NEW/COMMIT | parser (DOM → ModelRecord) | transform (HTML → ModelRecord) | NONE — greenfield | NONE |
| `server/scrapers/drom/index.ts` | NEW/COMMIT | scraper (orchestrator) | batch + request-response | NONE — greenfield | NONE |
| `server/tests/drom-parsers.test.ts` | NEW/COMMIT | test (unit, fixture-driven) | n/a | NONE — greenfield | NONE |
| `server/tests/drom-integration.test.ts` | NEW/COMMIT | test (E2E against fixture catalog) | n/a | NONE — greenfield | NONE |
| `data/scraped/SCHEMA.md` | NEW/COMMIT | docs (record contract) | n/a | NONE — greenfield | NONE |
| `data/scraped/README.md` | NEW/COMMIT | docs (run + consume guide) | n/a | NONE — greenfield | NONE |
| `data/scraped/drom/brand-aliases.json` | NEW/COMMIT (seed) | data (Cyrillic↔Latin lookup) | n/a | NONE — greenfield | NONE |

### Wave 2 — Live Drom Run (P-22 .. P-23)

| File | Status | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `data/scraped/drom/<run_id>/models.json` | RUNTIME/IGNORE | runtime artifact | n/a | n/a (runtime) | n/a |
| `data/scraped/drom/<run_id>/images/*.webp` | RUNTIME/IGNORE | runtime artifact | n/a | n/a (runtime) | n/a |
| `data/scraped/drom/<run_id>/report.json` | RUNTIME/IGNORE | runtime artifact | n/a | n/a (runtime) | n/a |
| `data/scraped/drom/current/` (symlink) | RUNTIME/IGNORE | runtime artifact | n/a | n/a (runtime) | n/a |
| `data/scraped/fx/cbr-<YYYY-MM-DD>.json` | RUNTIME/IGNORE | runtime artifact | n/a | n/a (runtime) | n/a |

**Wave 2 produces no source files** — only runtime artifacts that match the SCHEMA.md contract authored in Wave 1. The smoke run (P-22) is a *manual command*, not a code task; it verifies the orchestrator end-to-end against live drom.

---

## Pattern Assignments

### Conventions Used Below

For every file marked `NONE — greenfield`, the planner cannot say "match analog X". Instead, the planner MUST embed the **research-verified code excerpt** in the PLAN.md action's "Implementation" block. This file pre-extracts those excerpts (sourced from `01-RESEARCH.md`, line ranges noted) so the planner can copy them in directly.

For files with a partial analog (TS style, package.json shape, etc.), the partial analog is called out and the gap (what the new file needs that the analog doesn't have) is listed.

---

### `package.json` (config, MOD)

**Analog:** `/Users/mikhailra/Developer/dva.pro/package.json` (existing, lines 1-23) — exact-shape match.

**What carries over from existing:**
```json
{
  "name": "dva-pro",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.27.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

**What new file MUST add (per RESEARCH.md §"Standard Stack" + §"Recommended Project Structure"):**
- `engines.node`: `">=22.0.0 <26"` (constraint per CLAUDE.md Node 22 LTS pin)
- `packageManager`: `"pnpm@10.29.2"` (locked exact version per RESEARCH.md §"Environment Availability")
- `scripts.scrape`: `"tsx server/scrapers/cli.ts"`
- `scripts.scrape:drom`: `"tsx server/scrapers/cli.ts drom"`
- `scripts.scrape:encar` / `scrape:beforward` / `scrape:che168` / `scrape:autohome`: same pattern, per-source aliases
- `scripts.test`: `"vitest run"`
- `scripts.test:watch`: `"vitest"`
- New runtime deps (verified versions from RESEARCH.md §"Standard Stack" line 121-132): `got@^15`, `tough-cookie@^6`, `cheerio@^1.2`, `p-limit@^7`, `sharp@^0.34`, `iconv-lite@^0.7`, `fast-xml-parser@^4.5`, `zod@^3`
- New devDeps: `tsx@^4.21`, `vitest@^4.1`, `@types/node@^25`, `@types/tough-cookie`

**Critical preservation:** `"type": "module"` already present — KEEP. All Phase 1 deps are ESM-only (`got@15`, `p-limit@7`); breaking ESM would break Vite SPA build.

**Risk:** Vite SPA build (`pnpm build`) MUST still succeed after migration. Wave 0 plan must include `pnpm dev` + `pnpm build` smoke check before lockfile commit (per RESEARCH.md Risk 3).

---

### `tsconfig.server.json` (config, NEW)

**Analog:** `/Users/mikhailra/Developer/dva.pro/tsconfig.json` (existing, lines 1-23) — role-match. Different target/module/lib because Node-side, not browser-side.

**Existing tsconfig.json (frontend) shows the project's TS style:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["src"]
}
```

**Style to preserve:** `strict: true`, `esModuleInterop: true`, `isolatedModules: true`, `moduleDetection: "force"`, `resolveJsonModule: true`, `skipLibCheck: true`, `noFallthroughCasesInSwitch: true`.

**Differences for Node-side `tsconfig.server.json` (per RESEARCH.md §"Recommended Project Structure" line 237):**
- `target`: `"ES2023"` (Node 22 supports it)
- `module`: `"NodeNext"` (NOT `"ESNext"` — Node-side resolution differs from Vite bundler)
- `moduleResolution`: `"NodeNext"` (NOT `"bundler"`)
- `lib`: `["ES2023"]` (NO `"DOM"` — Node-side has no window/document)
- `jsx`: REMOVE (no JSX in scrapers)
- `noEmit`: KEEP `true` (tsx runs TS directly; `tsc -b` only for type-check, no .js emission)
- `include`: `["server"]` (NOT `["src"]`)
- `exclude`: `["node_modules", "dist", "src", "**/*.test.ts", "data"]`

**Key gap from analog:** existing tsconfig uses `"moduleResolution": "bundler"` which is wrong for Node CLI. The new file must use `"NodeNext"` so `import './foo.js'` (note `.js` ext on TS source) resolves correctly per ESM Node rules.

---

### `vitest.config.ts` (config, NEW)

**Analog:** `/Users/mikhailra/Developer/dva.pro/vite.config.ts` (existing, lines 1-7) — role-match (Vite-aligned config). Vitest reuses Vite plugin pipeline.

**Existing vite.config.ts (style to mirror — minimal, defineConfig pattern):**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
```

**New `vitest.config.ts` (per RESEARCH.md §"Validation Architecture" line 906-911):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['server/scrapers/**/*.ts'],
      exclude: ['server/scrapers/**/index.ts'],
    },
  },
});
```

**Key consideration:** `environment: 'node'` (default `'jsdom'` would load DOM globals — wrong for scraper testing). `include` glob must NOT match `src/**` to keep frontend out of the test suite.

---

### `.gitignore` (config, MOD)

**Analog:** `/Users/mikhailra/Developer/dva.pro/.gitignore` (existing, lines 1-7) — exact-shape, append-only edit.

**Existing content (preserved verbatim):**
```
node_modules
dist
.DS_Store
.env
.env.local
*.log
.vite
```

**Lines to append (per CONTEXT D-06 line 48):**
```
# Phase 01 — runtime scrape artifacts (commit only SCHEMA.md / README.md / brand-aliases.json)
data/scraped/**/models.json
data/scraped/**/images/
data/scraped/**/*.webp
data/scraped/**/report.json
data/scraped/**/.cursor.json
data/scraped/**/current
data/scraped/**/*.xml
data/scraped/fx/cbr-*.json
# Phase 01 — keep tracked
!data/scraped/SCHEMA.md
!data/scraped/README.md
!data/scraped/drom/brand-aliases.json
# Phase 01 — pnpm migration
package-lock.json
```

**Critical:** the `package-lock.json` line ensures the old npm lockfile (currently committed at `/Users/mikhailra/Developer/dva.pro/package-lock.json`) doesn't get re-added. The Wave 0 task explicitly deletes it before `pnpm install`.

---

### `server/scrapers/cli.ts` (controller, NEW — request-response: argv → ScrapeResult → exit code)

**Analog:** NONE — greenfield. No CLI entrypoint exists in the repo.

**Embed verbatim from RESEARCH.md lines 388-425 (verified, complete):**
```typescript
// server/scrapers/cli.ts — DISPATCHER
import { drom } from './drom/index.js';
import { encar } from './encar/index.js';
import { beforward } from './beforward/index.js';
import { che168 } from './che168/index.js';
import { autohome } from './autohome/index.js';
import type { IScraper, ScrapeResult } from './shared/types.js';

const SCRAPERS: Record<string, IScraper> = {
  drom: drom,
  encar: encar,
  beforward: beforward,
  che168: che168,
  autohome: autohome,
};

const EXIT_CODES = { ok: 0, error: 1, not_implemented: 2, blocked: 3 } as const;

const sourceArg = process.argv[2];
if (!sourceArg || !SCRAPERS[sourceArg]) {
  console.error(`Usage: pnpm scrape <${Object.keys(SCRAPERS).join('|')}>`);
  process.exit(1);
}

let result: ScrapeResult;
try {
  result = await SCRAPERS[sourceArg].run({ resume: true });
} catch (e) {
  result = {
    status: 'error',
    source: sourceArg,
    error: { message: e instanceof Error ? e.message : String(e), cause: e },
  };
}
console.log(JSON.stringify(result, null, 2));
process.exit(EXIT_CODES[result.status]);
```

**Pattern notes:**
- Top-level `await` is allowed because `tsconfig.server.json` uses `module: NodeNext` and `package.json` declares `"type": "module"`.
- `.js` extension on local imports (`./drom/index.js`) is REQUIRED by Node ESM resolution — TS source is `.ts` but emit/runtime resolves via the `.js` form.
- Exit code mapping is the single source of truth for the D-09 contract (`ok→0, error→1, not_implemented→2, blocked→3`).

**Test reference:** `server/tests/stubs.test.ts` (D-09 verification per RESEARCH.md line 927).

---

### `server/scrapers/shared/types.ts` (model, NEW — domain contracts)

**Analog:** `/Users/mikhailra/Developer/dva.pro/src/crm/types.ts` (existing) — **role-match (TS domain types via `interface` and union types).** Shows the project's existing domain-modeling style and naming conventions.

**Existing pattern from `src/crm/types.ts` (the project's only existing domain-types file):**
```typescript
export type Country = 'jp' | 'cn' | 'kr';
export type Accent = 'coral' | 'cyan';

export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  country: Country;
  // ...
}

export interface Lead {
  id: string;
  // ...
  status: 'new' | 'in-progress' | 'pdf-sent' | 'closed';
}
```

**Style to mirror:**
- `export type` for unions, `export interface` for object shapes (mixed style is fine, project precedent allows both).
- Literal-string union for status fields (e.g., `Lead.status` uses `'new' | 'in-progress' | ...`).
- One file per domain area; no barrel `index.ts`.

**What new file adds beyond the analog (per RESEARCH.md lines 312-368, fixture-verified):**
1. **zod runtime validation** (analog `src/crm/types.ts` is type-only — types.ts here doubles as runtime guard).
2. **Discriminated union with `status` literal as the discriminant** (analog uses literal unions on a single field, not full discriminated unions).
3. **D-10 `ModelRecord` schema must be kept 1:1 with `ARCHITECTURE.md:555` `models` table sketch** — this is the Phase 3 importer contract.

**Embed verbatim from RESEARCH.md lines 312-368:**
```typescript
// server/scrapers/shared/types.ts
import { z } from 'zod';

export const ModelRecord = z.object({
  brand: z.string(),
  brand_slug: z.string(),
  model: z.string(),
  model_slug: z.string(),
  generation: z.string(),
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),
  body_types: z.array(z.string()),
  engine_options: z.array(z.object({
    cc: z.number().int(),
    hp: z.number().int(),
    fuel: z.enum(['gas', 'diesel', 'hybrid', 'electric']),
  })),
  drive_options: z.array(z.string()),
  description_ru: z.string(),
  price_min_rub: z.number().nullable(),
  price_max_rub: z.number().nullable(),
  image_paths: z.array(z.string()),
  source: z.literal('drom-catalog'),
  source_url: z.string().url(),
  scraped_at: z.string().datetime(),
});
export type ModelRecord = z.infer<typeof ModelRecord>;

export type ReportSummary = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pages_visited: number;
  models_added: number;
  models_updated: number;   // for Phase 1: always 0; placeholder for Phase 3 importer parity
  images_downloaded: number;
  images_skipped: number;
  errors: { url: string; message: string }[];
  rate_limit_hits: number;
  blocked_responses: number;
  fx_stale: boolean;
  cursor_resumed: boolean;
  final_status: 'ok' | 'blocked' | 'error';
};

export type ScrapeResult =
  | { status: 'ok';              source: string; runId: string; recordsWritten: number; durationMs: number; report: ReportSummary }
  | { status: 'not_implemented'; source: string; deferredTo: 'v1.x'; todo: string }
  | { status: 'error';           source: string; runId?: string; error: { message: string; cause?: unknown } }
  | { status: 'blocked';         source: string; runId: string; reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'; sampleUrl?: string };

export interface IScraper {
  readonly source: string;          // 'drom-catalog' | 'encar' | 'beforward' | 'che168' | 'autohome'
  run(opts?: { resume?: boolean }): Promise<ScrapeResult>;
}
```

**Pitfall guard (from RESEARCH.md Pitfall 1, line 798-806):** the planner SHOULD NOT loosen `body_types`/`engine_options`/`description_ru` to allow empty arrays/strings via `.default([])` — strict validation is the DOM-regression detector. Records that fail validation go into `report.errors[]` instead of `models.json`.

**SCHEMA.md generation note (Pitfall 6, line 844-850):** schema lives ONLY here in TS; `data/scraped/SCHEMA.md` is generated/derived from this file. Planner may add a `scripts/build-schema-md.ts` follow-up but it's not Phase 1-blocking.

---

### `server/scrapers/shared/atomic-write.ts` (utility, NEW — file-I/O primitive)

**Analog:** NONE — greenfield. No filesystem helpers exist in the repo.

**Embed verbatim from RESEARCH.md lines 434-445:**
```typescript
// server/scrapers/shared/atomic-write.ts
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function atomicWriteFile(target: string, content: Buffer | string): Promise<void> {
  await mkdir(dirname(target), { recursive: true });
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, content);
  await rename(tmp, target);
}
```

**Pattern notes (from RESEARCH.md "Pattern 2: Atomic Filesystem Write" line 427-446):**
- POSIX `rename()` is atomic on the same filesystem; macOS APFS + Linux ext4 both qualify (verified per Risk 5 / Pitfall 7 / Assumption A7).
- Tmp filename includes `process.pid + Date.now()` to avoid collisions across concurrent test runs.
- Used by EVERY artifact write: `models.json`, `.cursor.json`, `report.json`, individual WebP files, `cbr-*.json`, brand-aliases merge. Symlink update (`current/`) uses a SIMILAR but DIFFERENT pattern (see `symlink.ts` below).

**Test reference:** every `*.test.ts` in `server/tests/` exercises this transitively; no dedicated test file (it's a one-line composition of stdlib).

---

### `server/scrapers/shared/http.ts` (service, NEW — HTTP client + polite delay)

**Analog:** NONE — greenfield. No HTTP client exists.

**Embed verbatim from RESEARCH.md lines 487-540:**
```typescript
// server/scrapers/shared/http.ts
import got from 'got';
import { CookieJar } from 'tough-cookie';
import pLimit from 'p-limit';

const cookieJar = new CookieJar();
const httpLimit = pLimit(1);   // D-14: serial HTTP

const POLITE_BASE_MS = 10_000;          // D-14: 1 req per 10s
const JITTER_RATIO   = 0.20;            // D-14: ±20%

let lastRequestAt = 0;

async function politeDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const jitter = POLITE_BASE_MS * (1 + (Math.random() * 2 - 1) * JITTER_RATIO);
  const wait = Math.max(0, jitter - elapsed);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export const dromClient = got.extend({
  cookieJar,
  timeout: { request: 30_000 },
  retry: {
    limit: 3,
    statusCodes: [408, 429, 500, 502, 503, 504],
    methods: ['GET'],
    calculateDelay: ({ attemptCount }) => Math.min(60_000, 2_000 * 2 ** attemptCount),
  },
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

export async function fetchHtml(url: string): Promise<string> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'text' });
    return response.body;
  });
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'buffer' });
    return response.body as Buffer;
  });
}
```

**ASSUMPTION flag (RESEARCH.md line 541, A1):** got@15 retry option shape is assumed unchanged from got@13/14. The Wave 0 plan MUST include a test that mocks 503 and asserts retry-with-backoff actually fires — if the API has shifted, this test will catch it on the first run, before fixtures are even sanitized. See `server/tests/http.test.ts`.

**Pitfall coverage:**
- Pitfall 2 (Cyrillic mojibake, line 808-816): `fetchBuffer` returns raw bytes — the FX module decodes windows-1251 explicitly via `iconv-lite`.
- Pitfall 4 (image URL drift, line 828-834): `pLimit(1)` makes HTTP serial; image fetched immediately after page parse, so URL doesn't drift.

**Block-detection integration (from D-13, RESEARCH.md line 47):** `http.ts` does NOT itself check for thin/captcha responses — it returns body to the caller. The orchestrator (`drom/index.ts`) feeds each response through `block-detection.ts` and halts the run if the threshold trips. Keep `http.ts` policy-free.

---

### `server/scrapers/shared/normalize.ts` (utility, NEW — string parsers)

**Analog:** NONE — greenfield. No string normalization helpers exist.

**Per RESEARCH.md §"Recommended Project Structure" line 247-248, the file must export:**
- `slugify(s: string): string` — produces `brand_slug`, `model_slug`. ASCII-only output for filesystem safety.
- `parsePrice(s: string): number | null` — handles drom display strings like `"от 5 470 000"` and `"5 470 000 ₽"`. Returns RUB integer.
- `parseYear(s: string): { from: number | null, to: number | null }` — handles `"06.2018 - 03.2022"` and `"06.2018 - н.в."` (н.в. = "до настоящего времени" = currently produced).
- `cyrToLat(s: string): string` (optional helper) — drom exposes both forms in DOM, so transliteration is a fallback only. **Not used in main path** per RESEARCH.md line 476: "Just **read both forms from drom DOM** (D-16) — drom exposes Cyrillic + Latin side-by-side. No transliteration library needed."

**Concrete excerpts from RESEARCH.md line 633-637 (year parsing example):**
```typescript
const yearMatch = $('h1').first().text().match(/(\d{2})\.(\d{4})\s*-\s*(\d{2}\.\d{4}|н\.\s*в\.?)/i);
const year_from = yearMatch ? Number(yearMatch[2]) : null;
const year_to = yearMatch && yearMatch[3] && !/н\.\s*в/i.test(yearMatch[3])
              ? Number(yearMatch[3].split('.')[1]) : null;
```

**Test cases (must cover):**
- `slugify('BMW')` → `'bmw'`
- `slugify('Mercedes-AMG')` → `'mercedes-amg'`
- `parsePrice('от 5 470 000')` → `5470000`
- `parsePrice('—')` or empty → `null`
- `parseYear('06.2018 - 03.2022')` → `{from: 2018, to: 2022}`
- `parseYear('06.2018 - н.в.')` → `{from: 2018, to: null}`

---

### `server/scrapers/shared/images.ts` (service, NEW — image pipeline: URL → WebP file)

**Analog:** NONE — greenfield.

**Embed verbatim from RESEARCH.md lines 745-771:**
```typescript
// server/scrapers/shared/images.ts
import sharp from 'sharp';
import pLimit from 'p-limit';
import { fetchBuffer } from './http.js';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sharpLimit = pLimit(4);   // D-14: parallel sharp encoding

export type ImageWriteResult = { path: string; bytes: number; width: number; height: number };

export async function downloadAndConvert(
  imageUrl: string,
  outRelative: string,        // e.g., 'images/bmw-x5-g_2018_8395-hero.webp'
  runDir: string              // e.g., 'data/scraped/drom/2026-04-28T07-30-00Z'
): Promise<ImageWriteResult> {
  return sharpLimit(async () => {
    const buf = await fetchBuffer(imageUrl);
    const pipeline = sharp(buf);
    const meta = await pipeline.metadata();         // {width, height, format}
    const webp = await pipeline.webp({ quality: 80 }).toBuffer();
    const target = resolve(runDir, outRelative);
    await mkdir(dirname(target), { recursive: true });
    await atomicWriteFile(target, webp);
    return { path: outRelative, bytes: webp.length, width: meta.width ?? 0, height: meta.height ?? 0 };
  });
}
```

**Pitfall 5 mitigation (RESEARCH.md line 836-842, defensive sharp options):** the planner SHOULD harden the `sharp(buf)` call to `sharp(buf, { failOnError: true, limitInputPixels: 50_000_000 })` to bound memory on absurdly large drom heroes. Recommend planner include this hardening in the PLAN.md action; the verbatim excerpt above is the minimal happy-path.

---

### `server/scrapers/shared/fx.ts` (service, NEW — CBR XML feed)

**Analog:** NONE — greenfield.

**Embed verbatim from RESEARCH.md lines 671-740 (full module, fail-fast + cached fallback):**
```typescript
// server/scrapers/shared/fx.ts
import { dromClient } from './http.js';            // reuse got instance
import * as iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CBR_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CACHE_DIR = 'data/scraped/fx';

export type FxRates = {
  date: string;                                  // ISO YYYY-MM-DD
  rates: { USD: number; EUR: number; JPY: number; KRW: number; CNY: number; AED: number };
  source: 'cbr-live' | 'cbr-cache';
};

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function parseDecimalComma(s: string): number {
  return Number(s.replace(',', '.'));
}

export async function fetchFx(opts: { firstRun: boolean }): Promise<FxRates> {
  const today = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD UTC
  const cachePath = resolve(CACHE_DIR, `cbr-${today}.json`);

  // Same-UTC-day cache hit (any subsequent invocation in same day)
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf-8')) as FxRates;
    return { ...cached, source: 'cbr-cache' };
  } catch { /* not cached today, fetch live */ }

  try {
    const buf = await dromClient.get(CBR_URL, { responseType: 'buffer' }).then(r => r.body as Buffer);
    const xml = iconv.decode(buf, 'win1251');
    const parsed = PARSER.parse(xml);
    const valutes = parsed.ValCurs.Valute as Array<{
      CharCode: string; Nominal: string; Value: string; VunitRate?: string;
    }>;
    const want = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const;
    const rates = {} as FxRates['rates'];
    for (const code of want) {
      const v = valutes.find(x => x.CharCode === code);
      if (!v) throw new Error(`CBR XML missing currency ${code}`);
      // Use VunitRate (per-1-unit RUB rate) when present, else Value/Nominal
      const rub = v.VunitRate
        ? parseDecimalComma(v.VunitRate)
        : parseDecimalComma(v.Value) / Number(v.Nominal);
      rates[code] = rub;
    }
    const result: FxRates = { date: today, rates, source: 'cbr-live' };
    await mkdir(CACHE_DIR, { recursive: true });
    await atomicWriteFile(cachePath, JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    if (opts.firstRun) {
      // D-12: fail-fast on first run — no fallback yet
      throw new Error(`CBR FX fetch failed on first run; cannot proceed: ${e instanceof Error ? e.message : e}`);
    }
    // D-12: subsequent runs — fall back to most recent cached file
    const dir = resolve(CACHE_DIR);
    const files = await readdir(dir).catch(() => []);
    const candidates = files.filter(f => /^cbr-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
    if (candidates.length === 0) throw new Error('CBR live fetch failed and no cache available');
    const latest = JSON.parse(await readFile(resolve(dir, candidates[0]), 'utf-8')) as FxRates;
    return { ...latest, source: 'cbr-cache' };
  }
}
```

**Concrete contracts:**
- D-12 fail-fast on first run (no cache yet): planner test must assert this throws.
- D-12 cached fallback on subsequent run: planner test must assert `fx_stale: true` propagates to `report.json`.
- Currency set frozen: `USD, EUR, JPY, KRW, CNY, AED` (per RESEARCH.md A8 — all 6 verified live in CBR XML).

**Encoding note (RESEARCH.md line 154 + Pitfall 2):** `iconv.decode(buf, 'win1251')` is required — Node built-in `Buffer.toString('utf-8')` produces mojibake on CBR XML. This is the only place windows-1251 decoding occurs in Phase 1 (drom HTML is utf-8 per A2).

---

### `server/scrapers/shared/block-detection.ts` (utility, NEW — heuristic guard)

**Analog:** NONE — greenfield.

**No verbatim excerpt in RESEARCH.md, but contract is fully specified by D-13 (CONTEXT line 78) + RESEARCH.md line 47.** The planner must construct from the contract:

**Behavioral contract:**
- Module exports a class `BlockDetector` (or stateful helper functions; class is cleaner).
- Stateful counter incremented on each "thin" response (`<2 KB body`).
- Counter resets on a healthy response.
- ≥5 consecutive thin OR captcha-keyword match → throws a typed `BlockedError` with `reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'`.
- Captcha keyword set: `капча`, `проверка`, `robot`, `verify` (D-13 names "the standard set"; planner should case-insensitive match).

**Sketch (planner authoritative; not in RESEARCH.md verbatim):**
```typescript
// server/scrapers/shared/block-detection.ts
const THIN_THRESHOLD_BYTES = 2_048;
const CONSECUTIVE_THIN_LIMIT = 5;
const CAPTCHA_KEYWORDS = [/капча/i, /проверка/i, /robot/i, /verify/i];

export class BlockedError extends Error {
  constructor(public reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error', public sampleUrl?: string) {
    super(`Blocked: ${reason}${sampleUrl ? ` (${sampleUrl})` : ''}`);
  }
}

export class BlockDetector {
  private thinCount = 0;
  inspect(url: string, body: string): void {
    if (CAPTCHA_KEYWORDS.some(re => re.test(body))) throw new BlockedError('captcha', url);
    if (Buffer.byteLength(body, 'utf-8') < THIN_THRESHOLD_BYTES) {
      this.thinCount++;
      if (this.thinCount >= CONSECUTIVE_THIN_LIMIT) throw new BlockedError('thin_responses', url);
    } else {
      this.thinCount = 0;
    }
  }
}
```

**Tests must cover (RESEARCH.md line 923-924):**
- 5 thin responses → throws `BlockedError`.
- 4 thin + 1 healthy → resets counter, no throw.
- Each captcha keyword → throws.

**Reuse note (D-13):** "Same module is reused (not specialized) by future Encar/etc. fillers per the IScraper contract." Keep the module source-agnostic; do not embed drom-specific selectors here.

---

### `server/scrapers/shared/cursor.ts` (utility, NEW — resume state)

**Analog:** NONE — greenfield. Closest stylistic precedent is the `loadInitialState` pattern in `src/crm/CrmProvider.tsx:7-25` — `try { JSON.parse(localStorage…) } catch { return SEED }`. Same pattern transposed to disk.

**Existing pattern from `src/crm/CrmProvider.tsx` (style only):**
```typescript
function loadInitialState(): CrmState {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    const parsed = JSON.parse(raw) as Partial<CrmState>;
    return { /* merged with defaults */ };
  } catch {
    return SEED;
  }
}
```

**Transposed to disk for `cursor.ts` (per CONTEXT D-15 + RESEARCH.md line 251):**

**Behavioral contract:**
- Type: `Cursor = { lastBrandSlug: string; lastModelSlug: string; completedAt: string }`.
- `readCursor(runDir): Promise<Cursor | null>` — returns null if absent or unparseable.
- `writeCursor(runDir, cursor): Promise<void>` — uses `atomicWriteFile`.
- `deleteCursor(runDir): Promise<void>` — silently skip if absent (run completed cleanly).

**Sketch:**
```typescript
// server/scrapers/shared/cursor.ts
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { atomicWriteFile } from './atomic-write.js';

export type Cursor = { lastBrandSlug: string; lastModelSlug: string; completedAt: string };

export async function readCursor(runDir: string): Promise<Cursor | null> {
  try {
    const raw = await readFile(resolve(runDir, '.cursor.json'), 'utf-8');
    return JSON.parse(raw) as Cursor;
  } catch {
    return null;
  }
}

export async function writeCursor(runDir: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(resolve(runDir, '.cursor.json'), JSON.stringify(cursor, null, 2));
}

export async function deleteCursor(runDir: string): Promise<void> {
  await unlink(resolve(runDir, '.cursor.json')).catch(() => { /* idempotent */ });
}
```

**Pitfall 3 (RESEARCH.md line 818-826):** brand-boundary cursor is coarser than ideal — worst case ~7 hours wasted on a mid-brand crash. Decision is to keep this design simple in Phase 1; finer-grained cursor is a Phase 1.x candidate. Document this trade-off in `data/scraped/README.md`.

---

### `server/scrapers/shared/symlink.ts` (utility, NEW — atomic symlink update)

**Analog:** NONE — greenfield.

**Embed verbatim from RESEARCH.md lines 776-789:**
```typescript
// server/scrapers/shared/symlink.ts
import { symlink, rename, lstat, unlink } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';

export async function pointCurrentAt(runDir: string): Promise<void> {
  // runDir = 'data/scraped/drom/2026-04-28T07-30-00Z'
  // target = 'data/scraped/drom/current'
  const linkPath = resolve(dirname(runDir), 'current');
  const tmpLink = `${linkPath}.tmp.${Date.now()}`;
  // Symlink target is RELATIVE (basename of run dir) so the link survives directory moves
  await symlink(basename(runDir), tmpLink, 'dir');
  // rename() atomically replaces existing symlink on POSIX (macOS APFS, Linux ext4)
  await rename(tmpLink, linkPath);
}
```

**OS note (RESEARCH.md line 156, 792):** symlinks work on macOS+Linux (production targets per CLAUDE.md). Windows requires Junction Points; document handling in `data/scraped/README.md` as "team uses macOS dev + Linux CI; Windows is not supported in v1."

**Test contract (RESEARCH.md line 926):** test must assert that `current/` ALWAYS resolves either to old run or new run, never partial — i.e., a concurrent reader during update sees one of the two states.

---

### `server/scrapers/shared/brand-aliases.ts` (service, NEW — idempotent merge)

**Analog:** NONE — greenfield.

**Behavioral contract (CONTEXT D-16, RESEARCH.md line 253):**
- Shape: `{ [brand_slug]: { ru: string, latin: string, models: { [model_slug]: { ru, latin } } } }`.
- `mergeAliases(filePath, newEntries): Promise<void>` — read existing, deep-merge new entries (last-write-wins for conflicting `ru`/`latin` keys, but never lose existing `models` map keys), write atomically via `atomic-write.ts`.
- Idempotent: running merge twice with same input produces identical file (test SCRAPE-10, line 920).

**Sketch:**
```typescript
// server/scrapers/shared/brand-aliases.ts
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './atomic-write.js';

type ModelAlias = { ru: string; latin: string };
type BrandAlias = { ru: string; latin: string; models: Record<string, ModelAlias> };
export type AliasMap = Record<string, BrandAlias>;

export async function mergeAliases(filePath: string, incoming: AliasMap): Promise<void> {
  let current: AliasMap = {};
  try {
    current = JSON.parse(await readFile(filePath, 'utf-8')) as AliasMap;
  } catch { /* fresh file */ }

  const merged: AliasMap = { ...current };
  for (const [brandSlug, brand] of Object.entries(incoming)) {
    const existing = merged[brandSlug];
    merged[brandSlug] = {
      ru: brand.ru,           // last-write-wins canonical labels
      latin: brand.latin,
      models: { ...(existing?.models ?? {}), ...brand.models },
    };
  }
  // Stable key ordering for deterministic output (idempotency)
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  await atomicWriteFile(filePath, JSON.stringify(sorted, null, 2));
}
```

**Idempotency requirement (test SCRAPE-10):** the planner MUST sort keys alphabetically before write so that running the same merge twice produces byte-identical output. Otherwise the test fails on JSON key ordering.

---

### Stub scrapers — `server/scrapers/{encar,beforward,che168,autohome}/index.ts` (4 files, NEW)

**Analog:** NONE — greenfield, but all four stubs are identical-shape (template).

**Embed verbatim from RESEARCH.md lines 371-385 (Encar example; reuse for all 4):**
```typescript
// server/scrapers/encar/index.ts — STUB EXAMPLE
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const encar: IScraper = {
  source: 'encar',
  async run(): Promise<ScrapeResult> {
    console.warn('[encar] TODO: implement Encar scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'encar',
      deferredTo: 'v1.x',
      todo: 'Implement Encar scraper per IScraper contract; uses Crawlee+Playwright Firefox + KR residential proxy + Carapis fallback',
    };
  },
};
```

**Per-stub `todo` field text (planner authoritative):**
- `encar`: "Implement Encar scraper per IScraper contract; uses Crawlee+Playwright Firefox + KR residential proxy + Carapis fallback"
- `beforward`: "Implement BeForward scraper per IScraper contract; HttpCrawler + Cheerio (mostly static)"
- `che168`: "Implement Che168 scraper per IScraper contract; PlaywrightCrawler + CN residential proxy"
- `autohome`: "Implement Autohome scraper per IScraper contract; PlaywrightCrawler + CN residential proxy"

**Test (per RESEARCH.md line 927):** `server/tests/stubs.test.ts` asserts each stub returns `{status: 'not_implemented'}` and that `console.warn` is called once. Smoke test: `pnpm scrape:encar; echo "exit=$?"` must print `exit=2`.

---

### Drom parsers — Wave 1 (4 parser modules + 1 orchestrator, NEW)

**Analog:** NONE — greenfield. drom DOM shape is verified live by researcher; selectors are illustrative scaffolding (RESEARCH.md line 667).

#### `server/scrapers/drom/parse-brand-index.ts`

**Embed verbatim from RESEARCH.md lines 545-577:**
```typescript
// server/scrapers/drom/parse-brand-index.ts
import * as cheerio from 'cheerio';

export type BrandRef = { brand_slug: string; latin_name: string; url: string };

const CATALOG_BASE = 'https://www.drom.ru/catalog';

export function parseBrandIndex(html: string): BrandRef[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const brands: BrandRef[] = [];

  // Verified live: brands are <a> tags whose href matches /catalog/<slug>/
  $('a[href^="/catalog/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/^\/catalog\/([a-z0-9_-]+)\/?$/i);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (seen.has(slug)) return;
    if (slug === 'all') return; // skip aggregator links
    seen.add(slug);

    // brand text comes from the link's text content or an <img alt> attribute
    const text = $(el).text().trim() || $(el).find('img').attr('alt') || slug;
    brands.push({
      brand_slug: slug,
      latin_name: text,
      url: `${CATALOG_BASE}/${slug}/`,
    });
  });
  return brands;
}
```

**URL filtering (Open Question 5, line 1124-1126):** `/^\/catalog\/[a-z0-9_-]+\/$/` for brand index; skip `/catalog/all/`, `/catalog/year_NNNN/`, etc.

#### `server/scrapers/drom/parse-model-list.ts`

**Embed:** Not in RESEARCH.md verbatim. Planner must derive selectors from `server/tests/fixtures/drom/model-list.bmw.html` during Wave 1 task P-16 (fixture-driven). Output type: `ModelRef = { model_slug: string; ru_name: string; latin_name: string; url: string }`.

**Filter rule (Open Question 5):** `/^\/catalog\/<brand>\/[a-z0-9_-]+\/$/` for valid model URL; skip `/catalog/<brand>/all/`.

#### `server/scrapers/drom/parse-generation-list.ts`

**Embed verbatim from RESEARCH.md lines 580-605:**
```typescript
// server/scrapers/drom/parse-generation-list.ts
import * as cheerio from 'cheerio';

export type GenerationRef = {
  generation_id: string;       // e.g., 'g_2018_8395'
  generation_label: string;    // e.g., 'G05' or '2018-2023' (derived from card text)
  url: string;
  hero_image_url?: string;
};

export function parseGenerationList(html: string, modelUrl: string): GenerationRef[] {
  const $ = cheerio.load(html);
  const refs: GenerationRef[] = [];
  // Verified live: generation cards are <a href="g_<YYYY>_<id>/">
  $(`a[href*="g_"]`).each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(/g_(\d{4,6})_(\d+)\/?$/);
    if (!m) return;
    const generation_id = `g_${m[1]}_${m[2]}`;
    const url = new URL(href, modelUrl).toString();
    const label = $(el).text().trim();
    const hero = $(el).find('img').attr('src');
    refs.push({ generation_id, generation_label: label, url, hero_image_url: hero });
  });
  return refs;
}
```

**Regex assumption (A4, line 1091):** `g_(\d{4,6})_(\d+)` covers 4-digit year (`g_2018_8395`) and 6-digit `YYYYMM` (`g_202304_18115`). Wave 1 fixtures must include both forms.

#### `server/scrapers/drom/parse-generation-page.ts`

**Embed verbatim from RESEARCH.md lines 608-664:**
```typescript
// server/scrapers/drom/parse-generation-page.ts
import * as cheerio from 'cheerio';
import type { ModelRecord } from '../shared/types.js';
import { ModelRecord as ModelRecordSchema } from '../shared/types.js';

export function parseGenerationPage(
  html: string,
  ctx: { brand: string; brand_slug: string; model: string; model_slug: string; generation: string; sourceUrl: string }
): ModelRecord {
  const $ = cheerio.load(html);
  const text = (sel: string) => $(sel).first().text().trim();

  // Verified live (BMW X5 G05 page):
  //   - body type: in spec table row "Тип кузова"
  //   - engines:   spec table list of B47B20/B57D30/B58B30M0/N63B44 with cc/hp/fuel
  //   - year_from/year_to: heading e.g. "06.2018 - 03.2022"
  //   - drive: typically "4WD" / "AWD" / "RWD" in spec table
  //   - price min/max: spec table rows "Цена нового авто" + "от X" / "до Y"
  //   - hero img: largest <img src> matching s.auto.drom.ru/...
  //   - description_ru: <p> following <h2> Описание (or first <p> in main column)
  //   - Latin model name: page title or breadcrumb (Cyr+Lat coexist)

  const description_ru = $('h2:contains("Описание")').nextUntil('h2', 'p').first().text().trim()
                       || $('article p').first().text().trim();

  const yearMatch = $('h1').first().text().match(/(\d{2})\.(\d{4})\s*-\s*(\d{2}\.\d{4}|н\.\s*в\.?)/i);
  const year_from = yearMatch ? Number(yearMatch[2]) : null;
  const year_to = yearMatch && yearMatch[3] && !/н\.\s*в/i.test(yearMatch[3])
                ? Number(yearMatch[3].split('.')[1]) : null;

  // ... body_types / engine_options / drive_options / price_min_rub / price_max_rub extraction
  //     follows same find-by-row-label pattern; see fixtures for exact selectors

  const heroImg = $('img[src*="s.auto.drom.ru"]').first().attr('src');

  const record: ModelRecord = {
    brand: ctx.brand,
    brand_slug: ctx.brand_slug,
    model: ctx.model,
    model_slug: ctx.model_slug,
    generation: ctx.generation,
    year_from,
    year_to,
    body_types: [], // populate via table parse — see fixtures
    engine_options: [],
    drive_options: [],
    description_ru,
    price_min_rub: null,
    price_max_rub: null,
    image_paths: heroImg ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
    source: 'drom-catalog',
    source_url: ctx.sourceUrl,
    scraped_at: new Date().toISOString(),
  };
  return ModelRecordSchema.parse(record); // zod validates D-10 contract
}
```

**ASSUMPTION flag (RESEARCH.md line 667):** the spec-table selectors (body_types / engine_options / drive_options / price_min_rub / price_max_rub) are STUBBED in the excerpt — the planner's P-18 task must derive exact selectors from the sanitized fixture during Wave 1, NOT before. The excerpt is scaffolding; selectors come from real fixture HTML.

**Pitfall 1 mitigation:** zod validation at end via `ModelRecordSchema.parse(record)` is the DOM-regression detector. Records that fail validation must be caught at the orchestrator level and added to `report.errors[]` with the URL.

#### `server/scrapers/drom/index.ts` (orchestrator)

**Analog:** NONE — greenfield. No verbatim excerpt in RESEARCH.md.

**Behavioral contract (composes everything from Wave 0):**
- Implements `IScraper` interface from `shared/types.ts`.
- Generates `runId` per D-07: `new Date().toISOString().replace(/[:.]/g, '-')` ≈ `2026-04-28T07-30-00-000Z` (planner: refine to D-07 exact format `2026-04-28T07-30-00Z` by stripping ms).
- Reads cursor (P-09); resumes if present.
- Calls `fetchFx({firstRun: !cursorExists})` — gates run on FX availability per D-12.
- Iterates: brand index → model list per brand → generation list per model → generation page per generation.
- Each fetch flows through `BlockDetector` (P-08).
- Each ModelRecord → `parseGenerationPage` → zod validate → push to in-memory array; errors push to `report.errors[]`.
- Per-record image: `downloadAndConvert(heroUrl, ...)` (P-06).
- Side-effect per brand: `mergeAliases(brandAliasesPath, {brandSlug: {ru, latin, models: {...}}})` (P-11).
- Brand-boundary checkpoint: `writeCursor(runDir, {lastBrandSlug, lastModelSlug, completedAt})` (P-09).
- On success: write `models.json` (atomic), write `report.json` (atomic), `pointCurrentAt(runDir)` (P-10), `deleteCursor(runDir)` (P-09), return `{status: 'ok', ...}`.
- On `BlockedError`: write partial `report.json` with `final_status: 'blocked'`, return `{status: 'blocked', ...}`. Do NOT update `current/` symlink (P-22 acceptance test depends on this — only successful runs become `current/`).
- On any other thrown error: write partial `report.json` with `final_status: 'error'`, return `{status: 'error', ...}`. Do NOT update `current/` symlink.

**Memory note (RESEARCH.md line 456 anti-pattern):** "collect in memory, single atomic write at end — total bytes ~50K rows × ~1 KB = ~50 MB, acceptable for one-time backfill on a dev machine." Planner: do NOT use streaming JSON unless memory pressure observed in P-22 smoke run.

---

### Documentation files (Wave 1, P-21)

#### `data/scraped/SCHEMA.md` (NEW/COMMIT)

**Analog:** NONE — greenfield.

**Contents (per CONTEXT.md `<specifics>` line 153):**
- Document BOTH `models.json` (drom; real in Phase 1) AND `cars.json` (specific listings; stub-only in Phase 1, real in v1.x for Encar/BeForward/Che168/Autohome).
- Field-by-field table for `ModelRecord` mirroring the zod schema in `shared/types.ts` (single source of truth — Pitfall 6).
- Worked example: one `ModelRecord` for BMW X5 G05.
- Phase 3 importer contract: `(brand_slug, model_slug, generation)` is the unique key for upsert.

#### `data/scraped/README.md` (NEW/COMMIT)

**Contents (per CONTEXT.md `<code_context>` line 141 + RESEARCH.md line 156, 792, Pitfall 7):**
- How to run: `pnpm scrape:drom`, exit codes (0/1/2/3), where output lands.
- Phase 3 consume contract: ALWAYS re-resolve `current/` symlink per invocation; never cache the realpath.
- Manual prune: `find data/scraped/drom -maxdepth 1 -name "20*Z" -mtime +30 -exec rm -rf {} +` (Open Question 3).
- OS support: macOS dev + Linux CI; Windows not supported in v1 (symlinks).
- No secrets required (RESEARCH.md line 871).

#### `data/scraped/drom/brand-aliases.json` (NEW/COMMIT, seed)

**Initial content:** Empty object `{}` (file gets populated on first drom run; committed empty as a placeholder seed so the path exists for Phase 6 admin reference).

---

## Shared Patterns

> Cross-cutting patterns that apply to multiple Phase 1 files. **All sourced from `01-RESEARCH.md` "Architecture Patterns" §"Pattern 1/2/3" (lines 305-462).**

### 1. ESM-only with `.js` extension on imports

**Source:** Existing `package.json` line 5 (`"type": "module"`) + RESEARCH.md line 12 (entire stack is ESM-only — `got@15`, `p-limit@7`, `cheerio@1.2`, `vitest@4`).

**Apply to:** Every file in `server/scrapers/**` and `server/tests/**`.

**Rule:** Local relative imports must use `.js` extension on the import string, even though source files are `.ts`:
```typescript
import type { IScraper } from '../shared/types.js';     // ✓ correct
import type { IScraper } from '../shared/types';        // ✗ ESM resolution fails at runtime
import type { IScraper } from '../shared/types.ts';     // ✗ rejected by tsconfig (allowImportingTsExtensions: false)
```

**Why:** Node ESM resolution does NOT do automatic extension lookup; tsx/tsc rewrites `.js` to the actual `.ts` source at runtime. This is the same convention every modern TS+Node project uses in 2026.

### 2. Atomic Filesystem Write (Pattern 2)

**Source:** RESEARCH.md "Pattern 2" lines 427-446.

**Apply to:** All file writes that survive crash mid-write — `models.json`, `.cursor.json`, `report.json`, individual WebP files, `cbr-*.json`, `brand-aliases.json` merge.

**Concrete:** Use `atomicWriteFile()` from `server/scrapers/shared/atomic-write.ts`. NEVER call `fs.writeFile(target, content)` directly for any artifact in `data/scraped/**`.

**Symlink exception:** `data/scraped/drom/current/` uses a *separate* but related pattern via `symlink.ts`: `symlink()` to tmp link → `rename()` over existing link. Same atomicity guarantee, different stdlib call.

### 3. Discriminated-Union Result with CLI Exit-Code Mapping (Pattern 1)

**Source:** RESEARCH.md "Pattern 1" lines 305-425.

**Apply to:** `IScraper#run()` return type for ALL scrapers (drom + 4 stubs). CLI dispatcher maps the union to exit codes 0/1/2/3.

**Concrete:** Every `run()` returns `Promise<ScrapeResult>` and never throws to the CLI; throws are caught in the dispatcher and mapped to `{status: 'error'}`. Stubs return `{status: 'not_implemented'}` synchronously.

### 4. zod-validated Domain Records

**Source:** RESEARCH.md line 132 + lines 312-339 + Pitfall 1 (line 798-806).

**Apply to:** `ModelRecord` (drom) — strict validation at parse time so DOM regressions surface as record errors, not silent garbage rows.

**Anti-pattern:** Permissive defaults like `body_types: z.array(z.string()).default([])`. Zod's strictness is the regression detector — keep it strict.

### 5. p-limit for All Concurrency

**Source:** RESEARCH.md line 128 + line 154.

**Apply to:** ALL concurrent operations.
- `pLimit(1)` for HTTP — wraps every drom and CBR fetch (`http.ts`).
- `pLimit(4)` for sharp encoding (`images.ts`).

**Anti-pattern:** Manual counting of in-flight promises, semaphores, or `Promise.all([...])` without limit — produces drom request bursts → block-detection trips → run halts.

### 6. POSIX-style relative paths in code, absolute paths via `path.resolve(...)` only at I/O boundary

**Source:** RESEARCH.md examples consistently — `runDir = 'data/scraped/drom/2026-04-28T07-30-00Z'` (relative); `resolve(runDir, outRelative)` at the moment of file write.

**Apply to:** All filesystem code in `server/scrapers/shared/**` and `server/scrapers/drom/**`.

**Why:** Repo-relative paths are testable (no `__dirname` shenanigans across test/runtime); absolute resolution only at I/O leaves the caller in control of the cwd.

### 7. TypeScript style — strict, ESM, type-first design

**Source:** Existing `tsconfig.json` lines 1-22 (frontend); applies to Node-side via mirroring strict flags.

**Apply to:** All TS files in `server/`.

**Style baseline (from existing repo):**
- `strict: true` — non-negotiable.
- `esModuleInterop: true` + `allowSyntheticDefaultImports: true` — for libraries with default-export quirks (e.g., `iconv-lite`).
- `isolatedModules: true` — required for tsx and Vitest's per-file compilation.
- `noFallthroughCasesInSwitch: true` — defensive for the `ScrapeResult` discriminant switch in CLI.
- Existing repo permits `noUnusedLocals: false` / `noUnusedParameters: false` — KEEP this leniency for Node-side too (matches frontend).

**Type-first preference:** the project's existing `src/crm/types.ts` puts domain types in a single file, separate from logic. Mirror this: `server/scrapers/shared/types.ts` is the canonical types file; per-module local types (e.g., `BrandRef`, `GenerationRef`) live in their parser file but EXPORTED so tests can import them.

---

## No Analog Found

> Files with no close match in the existing codebase. **For these, the planner MUST embed code excerpts from RESEARCH.md / this file directly into the PLAN.md action's "Implementation" block.** This is the operational consequence of greenfield scaffolding.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `server/scrapers/cli.ts` | controller (CLI dispatcher) | request-response | No CLI exists. Excerpt: see this file's `cli.ts` section above. |
| `server/scrapers/shared/atomic-write.ts` | utility (FS) | file-I/O | No FS helpers exist. Excerpt: above. |
| `server/scrapers/shared/http.ts` | service (HTTP client) | request-response | No HTTP client exists. Excerpt: above. |
| `server/scrapers/shared/normalize.ts` | utility (parsers) | transform | No string parsers exist. Contract: above. |
| `server/scrapers/shared/images.ts` | service (image pipeline) | streaming | No image processing exists. Excerpt: above. |
| `server/scrapers/shared/fx.ts` | service (FX feed) | request-response | No FX integration exists. Excerpt: above. |
| `server/scrapers/shared/block-detection.ts` | utility (heuristic guard) | event-driven | No anti-bot guards exist. Sketch: above. |
| `server/scrapers/shared/cursor.ts` | utility (resume state) | file-I/O | No persistence layer exists (closest precedent: `localStorage` in `CrmProvider.tsx` — same try/catch shape, disk-transposed). |
| `server/scrapers/shared/symlink.ts` | utility (FS) | file-I/O | No FS helpers exist. Excerpt: above. |
| `server/scrapers/shared/brand-aliases.ts` | service (idempotent merge) | file-I/O + transform | No data-merge service exists. Sketch: above. |
| `server/scrapers/encar/index.ts` | scraper (stub) | request-response | No scraper exists. Stub template: above. |
| `server/scrapers/beforward/index.ts` | scraper (stub) | request-response | No scraper exists. Stub template: above. |
| `server/scrapers/che168/index.ts` | scraper (stub) | request-response | No scraper exists. Stub template: above. |
| `server/scrapers/autohome/index.ts` | scraper (stub) | request-response | No scraper exists. Stub template: above. |
| `server/scrapers/drom/parse-brand-index.ts` | parser | transform | No DOM parsers exist. Excerpt: above. |
| `server/scrapers/drom/parse-model-list.ts` | parser | transform | No DOM parsers exist. Selectors derived in P-16 from fixture. |
| `server/scrapers/drom/parse-generation-list.ts` | parser | transform | No DOM parsers exist. Excerpt: above. |
| `server/scrapers/drom/parse-generation-page.ts` | parser | transform | No DOM parsers exist. Excerpt: above (selector stubs noted). |
| `server/scrapers/drom/index.ts` | orchestrator | batch | No scraper orchestrators exist. Behavioral contract: above. |
| `server/tests/*.test.ts` (12 files) | test (unit/integration) | n/a | No tests exist. Coverage targets per RESEARCH.md §"Validation Architecture" line 906-928. |
| `server/tests/fixtures/**` (10+ files) | test fixture | n/a | No fixtures exist. Sources per RESEARCH.md §"Wave 0 Gaps" line 941-949. |
| `data/scraped/SCHEMA.md` | docs | n/a | No data docs exist. Contents per CONTEXT line 153. |
| `data/scraped/README.md` | docs | n/a | No data docs exist. Contents per RESEARCH.md Pitfall 7 + line 156. |
| `data/scraped/drom/brand-aliases.json` | seed data | n/a | No seed data exists. Initial content `{}`. |

---

## Partial Analogs From Existing Repo

> Three places in the existing repo provide partial guidance for new files. None give behavior; all give style.

### Partial Analog 1 — `package.json` shape

**File:** `/Users/mikhailra/Developer/dva.pro/package.json` (existing, lines 1-23).
**Applies to:** root `package.json` modification.
**What it provides:** existing `name`, `version`, `private`, `type: "module"`, `dependencies` block (preserve verbatim), `devDependencies` block (preserve verbatim, append new entries).
**What's new:** `engines.node`, `packageManager`, `scripts.scrape*`, `scripts.test*`, all Phase 1 deps.

### Partial Analog 2 — `tsconfig.json` style

**File:** `/Users/mikhailra/Developer/dva.pro/tsconfig.json` (existing, lines 1-23).
**Applies to:** new `tsconfig.server.json`.
**What it provides:** the project's strict TS conventions (`strict: true`, `esModuleInterop: true`, `isolatedModules: true`, `moduleDetection: "force"`, `resolveJsonModule: true`, `skipLibCheck: true`, `noFallthroughCasesInSwitch: true`).
**What's different:** target ES2023 (Node 22) not ES2022 (browser); module/moduleResolution NodeNext not ESNext/bundler; lib drops DOM; jsx removed; include `["server"]` not `["src"]`.

### Partial Analog 3 — `src/crm/types.ts` domain-types style

**File:** `/Users/mikhailra/Developer/dva.pro/src/crm/types.ts` (existing, lines 1-95).
**Applies to:** new `server/scrapers/shared/types.ts`.
**What it provides:** the project's existing pattern of (a) one canonical types file per domain, (b) `export type` for unions, `export interface` for object shapes (mixed style allowed), (c) literal-string unions on status fields (`'new' | 'in-progress' | ...`), (d) no barrel `index.ts` reexport.
**What's new:** zod runtime validation (frontend uses TS types only, no zod); discriminated unions with `status` discriminant (frontend uses single-field literals, not full discriminants); strict schema mirroring an external contract (`ARCHITECTURE.md:555` `models` table).

### Partial Analog 4 — `vite.config.ts` minimal config style

**File:** `/Users/mikhailra/Developer/dva.pro/vite.config.ts` (existing, lines 1-7).
**Applies to:** new `vitest.config.ts`.
**What it provides:** the project's existing config-file pattern — `defineConfig` import, default-export, single-object config, no inline comments needed.
**What's different:** import from `'vitest/config'` not `'vite'`; `test.environment: 'node'` not browser-targeting plugins; `test.include` glob points to `server/tests/**`.

### Partial Analog 5 — `src/crm/CrmProvider.tsx:7-25` `loadInitialState` shape

**File:** `/Users/mikhailra/Developer/dva.pro/src/crm/CrmProvider.tsx` (existing, lines 7-25).
**Applies to:** new `server/scrapers/shared/cursor.ts` `readCursor` function.
**What it provides:** the project's existing pattern for "try parse persistence, fall back to default on any error" — `try { JSON.parse(raw) as Type } catch { return DEFAULT }`.
**What's different:** disk not localStorage (`readFile` not `getItem`), null fallback not `SEED` fallback, no React hook surrounding it.

---

## Metadata

**Analog search scope:** Entire `/Users/mikhailra/Developer/dva.pro` repo (root configs, `src/**`, `node_modules` excluded).
**Files scanned:** All 26 source files in `src/` (full enumeration via Glob); root configs (package.json, tsconfig.json, vite.config.ts, .gitignore, package-lock.json existence noted).
**Files read (for pattern extraction):** package.json, tsconfig.json, vite.config.ts, .gitignore, src/main.tsx, src/crm/types.ts, src/crm/seed.ts, src/crm/CrmProvider.tsx (lines 1-80).
**Pattern extraction date:** 2026-04-28.
**Greenfield ratio:** 32 of 35 source files have NO behavior analog (any analog is style-only). This is expected — Phase 1 is "establish the entire Node-side scaffolding".

**Planner consumption guide:**
1. For files with `Closest Analog: NONE — greenfield`: copy the verbatim code excerpt from this file's "Pattern Assignments" section into the PLAN.md action.
2. For files with a partial analog: note the analog file + lines in PLAN.md "Approach" section, then specify the gap (what new file does that analog doesn't).
3. For tests and fixtures: refer to RESEARCH.md §"Validation Architecture" lines 906-964 — all test names and per-test acceptance criteria are pre-specified there.
4. For documentation files (`SCHEMA.md`, `README.md`): contents are spec'd in CONTEXT D-06/D-08 + RESEARCH.md Pitfall 7 + Open Question 3.

---

## PATTERN MAPPING COMPLETE
