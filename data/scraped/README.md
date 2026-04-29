# data/scraped/ — Runbook

This directory holds output of Phase 1 inventory scrapers. Phase 1 ships **one real scraper (drom.ru/catalog)** plus 4 stubs (encar / beforward / che168 / autohome). Live implementations of the 4 stubs are deferred to v1.x.

For schema documentation see `SCHEMA.md` in this directory. For the project-level workflow rules see `/CLAUDE.md` and `.planning/`.

---

## Quick start

```bash
# One-shot drom backfill (1–2 weeks of polite scraping; runs in foreground)
pnpm scrape:drom

# Each stub source — exits 2 (not_implemented)
pnpm scrape:encar
pnpm scrape:beforward
pnpm scrape:che168
pnpm scrape:autohome

# Generic dispatcher
pnpm scrape <drom|encar|beforward|che168|autohome>
```

### Exit codes (D-09)

| Code | Meaning | When |
|------|---------|------|
| `0` | `ok` | Run completed successfully; `current/` updated; `.cursor.json` deleted |
| `1` | `error` | Unhandled error or DOM regression > 10% (Pitfall 1) |
| `2` | `not_implemented` | Stub source — drom is the only real scraper in Phase 1 |
| `3` | `blocked` | 5 thin responses or captcha keyword detected (D-13); run halted, cursor preserved for resume |

---

## Output directory layout

```
data/scraped/
├── SCHEMA.md                                   # ← committed
├── README.md                                   # ← this file, committed
├── drom/
│   ├── brand-aliases.json                      # ← committed (small Cyrillic↔Latin seed)
│   ├── current/                                # ← symlink to most recent successful run (gitignored)
│   └── 2026-04-28T07-30-00Z/                   # ← per-run dir (gitignored)
│       ├── models.json                         # ← drom master-model records
│       ├── images/                             # ← hero WebP files
│       │   ├── bmw-x5-g_2018_8395-hero.webp
│       │   └── ...
│       ├── report.json                         # ← run telemetry (D-17)
│       └── .cursor.json                        # ← present only if run unfinished
└── fx/
    └── cbr-2026-04-28.json                     # ← per-UTC-day FX cache (gitignored)
```

`run_id` format (D-07): ISO-8601 UTC with `:` and `.` replaced by `-`, e.g. `2026-04-28T07-30-00Z`. Sortable, filesystem-safe, unambiguous.

### `current/` symlink (D-08)

After a successful run, `data/scraped/drom/current/` atomically points at the new run dir. Phase 3's importer reads from `current/` and never embeds knowledge of the timestamped dir.

**Phase 3 contract (Pitfall 7):** the importer MUST always re-resolve `current/` per invocation. Never cache `realpath()` across runs — the symlink target rotates with each successful scrape.

---

## Running drom: what happens

1. **FX feed** — fetches CBR daily XML, decodes windows-1251, caches as `fx/cbr-<YYYY-MM-DD>.json`. First run with no cache MUST succeed; subsequent runs fall back to most recent cached file (D-12).
2. **Brand index** — fetches `https://www.drom.ru/catalog/`, parses ~70 brand anchors.
3. **Model list per brand** — for each brand, fetches `/catalog/<brand>/`, parses ~5–30 model anchors.
4. **Generation list per model** — for each model, fetches `/catalog/<brand>/<model>/`, parses ~1–10 generation anchors.
5. **Generation page** — for each generation, fetches `/catalog/<brand>/<model>/g_<YYYY>_<id>/`, extracts a full `ModelRecord` (zod-validated).
6. **Hero image** — for each record, downloads source JPEG, transcodes to WebP via sharp (quality 80, original dims), atomically writes under `<run_dir>/images/`.
7. **Brand-boundary checkpoint** — after every model, writes `.cursor.json` with `{lastBrandSlug, lastModelSlug, completedAt}`.
8. **End-of-brand alias merge** — appends Cyrillic↔Latin lookup into `data/scraped/drom/brand-aliases.json` (idempotent merge by `brand_slug`).
9. **Run end** — writes `models.json` + `report.json` atomically, updates `current/` symlink, deletes `.cursor.json`.

### Polite rate limit (D-14)

- 1 HTTP request per 10 seconds, ±20 % jitter.
- Honors `Crawl-delay` from drom's `robots.txt` if larger.
- `p-limit(1)` for HTTP fetches; `p-limit(4)` for sharp WebP encoding.
- Total expected runtime for full backfill: **1–2 weeks**.

### Crash recovery (D-15) — resume contract

If a `pnpm scrape:drom` run dies mid-brand, the next invocation reads `.cursor.json` and **re-scrapes the cursored brand from scratch** while preserving the prior successful run's data verbatim. The full contract:

1. **Prior brands are preserved verbatim** — `inheritFromPrevCurrent` copies records and images from the previous successful `current/` snapshot into the new run dir before scraping starts. Brands that completed before the crash do NOT need to be re-fetched.
2. **The cursored brand is re-scraped from scratch** — when the loop reaches the brand `cursor.lastBrandSlug`, `startFromModelIndex = 0`. Partial brand-aliases entries from the aborted brand are reconstructed because the brand is fully re-scraped and `mergeAliases` runs at end-of-brand on the complete set. Worst case: ~1 brand's worth of pages re-fetched (~7 hours at 10 s/req × ~30 pages/model × ~50 models for a brand-heavy entry like Toyota; smaller brands recover in minutes).
3. **Brands lexicographically after the cursored brand are scraped fresh** — they were never reached in the aborted run.
4. **A corrupt or hand-edited `.cursor.json` aborts the run loudly** — `readCursor` (post plan 01-11) distinguishes "file absent" (fresh start) from "file present but malformed" (`CorruptCursorError`, exit 1). Delete the file explicitly to start a fresh run after corruption.
5. **A `cursor.lastBrandSlug` no longer present in the catalog aborts the run** — `Cursor.lastBrandSlug='X' not present in current brand list` (plan 01-10). Either re-run without `--resume` semantics (delete `.cursor.json`) or correct the brand list (e.g. unset `DROM_BRAND_WHITELIST`).
6. **On clean completion `.cursor.json` is deleted.**

The brand-boundary granularity is a deliberate Phase 1 trade-off documented in `01-REVIEW.md` (CR-04). Finer-grained cursors (per-model checkpoint persistence) are a Phase 1.x candidate; the snapshot path makes the trade-off acceptable for v1 because no records are permanently lost — only the cursored brand's pages are re-fetched.

### Incremental snapshot (UPSERT semantics)

Each successful run **inherits** every record and image from the previous `current/` snapshot before scraping. Within the run, the new data UPSERTS into the inherited set keyed by `(brand_slug, model_slug, generation)` per the SCHEMA.md upsert contract.

Concretely: if you ran a full backfill yesterday (50 brands, 5000 records) and today re-run scoped to LADA only (`DROM_BRAND_WHITELIST=lada`), today's `current/models.json` contains:
- All 50 brands × 5000 records from yesterday — preserved verbatim
- LADA's records — re-scraped, replacing yesterday's LADA entries by `(brand_slug, model_slug, generation)`
- Total: ~5000 records, with LADA refreshed

Images already in the previous `current/images/` are copied forward into the new run dir (via `fs.copyFile`), so the network call for them is skipped — `report.images_skipped` includes "inherited from prev run". `report.images_downloaded` is only newly fetched images.

Counters reflect THIS run's work, not the merged total:
- `report.models_added` — keys this run produced that did NOT exist in prev current/
- `report.models_updated` — keys this run produced that DID exist in prev current/ (re-scraped)
- `result.recordsWritten` — total records in the new `current/models.json` (added + updated + inherited)

To start fresh and discard prior data, manually delete the `current/` symlink (and optionally the old run directories) before invoking `pnpm scrape:drom`.

---

## Pruning old runs

`run_id` directories are append-only — Phase 1 NEVER deletes a previous run. To prune manually after a successful new run:

```bash
# Delete drom run dirs older than 30 days (keeps current/ symlink intact)
find data/scraped/drom -maxdepth 1 -name "20*Z" -mtime +30 -exec rm -rf {} +

# Delete FX cache files older than 30 days
find data/scraped/fx -maxdepth 1 -name "cbr-*.json" -mtime +30 -delete
```

A `pnpm scrape:prune` automation is reserved for Phase 1.x.

---

## OS support

- **macOS** (Apple Silicon + Intel) — primary dev target.
- **Linux** (x86_64 + arm64) — CI + production.
- **Windows** — not supported in v1. The `current/` symlink uses POSIX `rename`-over-symlink atomicity which Windows does not implement (Junction Points required). If you need to run on Windows, use Docker: `docker run --rm -v $(pwd):/work -w /work node:22-alpine pnpm scrape:drom`.

---

## Secrets

Phase 1 requires **NO environment variables, NO API keys, NO `.env` file**. drom is public; CBR is public. If `pnpm scrape:drom` ever prompts for a secret, something has gone wrong — file a bug.

(Phase 2 introduces the `.env` for Yandex Cloud + Unisender Go; that's a different scope.)

---

## When things go wrong

### Run exits with code 3 (blocked)

Drom returned 5 consecutive thin responses or a captcha keyword (per D-13). Do NOT immediately retry — wait at least 24 hours, then resume from `.cursor.json`. If repeated blocks happen, run from a residential IP (founder home connection) rather than a cloud VM.

### Run exits with code 1 (error) and `report.json` shows > 10 % validation drop-out

Drom DOM regression. Re-sanitize the 4 fixtures under `server/tests/fixtures/drom/` from current live drom HTML, fix the affected parsers, re-run unit + integration tests, then retry. The fixture sanitation procedure lives in plan `01-07`.

### `pnpm install --frozen-lockfile` fails with sharp native binary

Try `pnpm install --config.shamefully-hoist=true`. If still failing, drop to Docker: `docker run --rm -v $(pwd):/work -w /work node:22-alpine sh -c "corepack enable && pnpm install"`.

---

## Stub sources (deferred to v1.x)

Each stub returns `{status: 'not_implemented'}` and writes nothing. The TODO log line names the planned implementation strategy:

| Source | Strategy (v1.x) |
|--------|-----------------|
| `encar` (KR) | Crawlee + Playwright Firefox + KR residential proxy + Carapis fallback |
| `beforward` (JP) | HttpCrawler + Cheerio (mostly static) |
| `che168` (CN) | PlaywrightCrawler + CN residential proxy |
| `autohome` (CN) | PlaywrightCrawler + CN residential proxy |

The `IScraper` contract is locked: v1.x authors fill the body of `run()` and the existing CLI dispatcher consumes them without changes.

---

## See also

- `SCHEMA.md` — record contract (this directory)
- `server/scrapers/shared/types.ts` — TypeScript / zod single source of truth
- `.planning/phases/01-inventory-scrapers-drom-and-stubs/` — Phase 1 design docs
- `CLAUDE.md` — project-level constraints (Node 22, pnpm, RU-only locale, etc.)
