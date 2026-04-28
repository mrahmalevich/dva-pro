# data/scraped/ — Schema Reference

**Last updated:** when plan 01-08 lands.
**Single source of truth:** `server/scrapers/shared/types.ts` (zod schema). This document mirrors it for human consumption. **If a field name in this doc disagrees with the TS schema, the TS schema wins** — edit `server/scrapers/shared/types.ts` and re-sync this doc.

---

## Overview

Phase 1 produces two record shapes — only one is real in Phase 1; the other is reserved by IScraper contract for v1.x:

| File | Shape | Source(s) | Real in Phase 1? |
|------|-------|-----------|------------------|
| `data/scraped/drom/<run_id>/models.json` | `ModelRecord[]` (master models — brand × model × generation) | drom.ru/catalog | ✅ yes |
| `data/scraped/<source>/<run_id>/cars.json` | `CarListing[]` (specific listings with VIN, mileage, photos) | encar / beforward / che168 / autohome | ❌ no — stubs only; deferred to v1.x |

The terminology distinction matters: **drom outputs MASTER MODELS** (one row per brand+model+generation, with year ranges, body types, engine variants), **NOT specific car listings**. Phase 3's importer writes drom records to the `models` table; the (future) v1.x scrapers will write to the `cars` table.

---

## `ModelRecord` (drom — `models.json`)

**Uniqueness key for Phase 3 upsert:** `(brand_slug, model_slug, generation)`. This matches `models.UNIQUE` in `.planning/research/ARCHITECTURE.md:555`.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `brand` | `string` | yes | Display name (Cyrillic preferred where drom exposes it; otherwise Latin), e.g. `BMW` |
| `brand_slug` | `string` | yes | Lowercase ASCII slug, filesystem-safe, e.g. `bmw` |
| `model` | `string` | yes | Display name, e.g. `X5` |
| `model_slug` | `string` | yes | Lowercase ASCII slug, e.g. `x5` |
| `generation` | `string` | yes | Drom generation identifier, e.g. `g_2018_8395`. May also be `g_<YYYYMM>_<id>` for some models (per RESEARCH A4) |
| `year_from` | `number \| null` | yes (nullable) | 4-digit year of generation start; `null` if drom did not surface a year |
| `year_to` | `number \| null` | yes (nullable) | 4-digit year of generation end; `null` for currently-produced generations (drom shows «н.в.») |
| `body_types` | `string[]` | yes | Non-empty array, e.g. `["SUV"]` or `["SUV", "Crossover"]`. Strict zod validation rejects empty arrays — Pitfall 1 DOM-regression detector |
| `engine_options` | `{cc: number; hp: number; fuel: 'gas' \| 'diesel' \| 'hybrid' \| 'electric'}[]` | yes | Non-empty array of engine variants per generation; e.g. `[{"cc": 1995, "hp": 190, "fuel": "diesel"}, {"cc": 2998, "hp": 340, "fuel": "gas"}]` |
| `drive_options` | `string[]` | yes | Drivetrain types, e.g. `["AWD"]` or `["RWD", "AWD"]` |
| `description_ru` | `string` | yes | Cyrillic editorial blurb from drom catalog page; non-empty |
| `price_min_rub` | `number \| null` | yes (nullable) | New-car price floor in RUB; `null` if drom does not show a price (older generations no longer in production) |
| `price_max_rub` | `number \| null` | yes (nullable) | New-car price ceiling in RUB; `null` if drom shows only a single price |
| `image_paths` | `string[]` | yes | Relative paths under run dir, exactly 0 or 1 element per record. Per D-11: one hero WebP, format `images/<brand_slug>-<model_slug>-<generation>-hero.webp`. Empty array if drom page had no usable image |
| `source` | `'drom-catalog'` (literal) | yes | Always this exact string for Phase 1 |
| `source_url` | `string` (URL) | yes | Drom generation page URL |
| `scraped_at` | `string` (ISO-8601) | yes | UTC timestamp of when the record was parsed |

### Worked example — BMW X5 G05

```json
{
  "brand": "BMW",
  "brand_slug": "bmw",
  "model": "X5",
  "model_slug": "x5",
  "generation": "g_2018_8395",
  "year_from": 2018,
  "year_to": 2022,
  "body_types": ["SUV"],
  "engine_options": [
    { "cc": 1995, "hp": 190, "fuel": "diesel" },
    { "cc": 2998, "hp": 340, "fuel": "gas" }
  ],
  "drive_options": ["AWD"],
  "description_ru": "Четвёртое поколение премиального кроссовера...",
  "price_min_rub": 5470000,
  "price_max_rub": 9890000,
  "image_paths": ["images/bmw-x5-g_2018_8395-hero.webp"],
  "source": "drom-catalog",
  "source_url": "https://www.drom.ru/catalog/bmw/x5/g_2018_8395/",
  "scraped_at": "2026-04-28T12:00:00.000Z"
}
```

---

## `CarListing` (v1.x reservation — `cars.json`)

NOT EMITTED by Phase 1. Sketched here so Phase 3's importer schema and v1.x scraper authors share a contract. Will be defined alongside the first v1.x scraper landing (encar → cars.json).

Expected fields (NON-binding sketch):
- `vin: string` — vehicle identification number
- `mileage_km: number`
- `condition: 'new' | 'used' | 'auction'`
- `country: 'kr' | 'jp' | 'cn' | 'us' | 'ae' | 'eu'`
- `source: 'encar' | 'beforward' | 'che168' | 'autohome'`
- `source_id: string` — listing-specific id from the source platform
- ...

**Phase 1 stubs return `{status: 'not_implemented'}` and write nothing.** When v1.x lands a real implementation, this section becomes binding.

---

## Run telemetry — `report.json`

Every drom run writes `report.json` with these fields (D-17):

| Field | Type | Notes |
|-------|------|-------|
| `started_at` | ISO-8601 | When `drom.run()` began |
| `finished_at` | ISO-8601 | When the run terminated (success / blocked / error) |
| `duration_ms` | number | `finished_at - started_at` in ms |
| `pages_visited` | number | Total drom HTTP fetches (brand index + model lists + generation lists + generation pages) |
| `models_added` | number | Records that passed zod validation and were written to `models.json` |
| `models_updated` | number | Always `0` in Phase 1 (no upsert); placeholder for Phase 3 importer parity |
| `images_downloaded` | number | WebP files written under `images/` |
| `images_skipped` | number | Records with no hero or with image-fetch failure |
| `errors[]` | `{url, message}[]` | Per-record parse / image-fetch failures (NOT fatal — run continues) |
| `rate_limit_hits` | number | Reserved for Phase 1.x — Phase 1 does not currently surface 429s into this counter |
| `blocked_responses` | number | Increments on `BlockedError` (5+ thin OR captcha keyword); run halts when this hits 1 |
| `fx_stale` | boolean | `true` if `fetchFx` returned `source: 'cbr-cache'` (live failed; cached fallback used per D-12) |
| `cursor_resumed` | boolean | `true` if `.cursor.json` was read at run start |
| `final_status` | `'ok' \| 'blocked' \| 'error'` | Mirrors the `ScrapeResult.status` returned by the orchestrator |

---

## Brand-aliases — `data/scraped/drom/brand-aliases.json`

Cyrillic↔Latin lookup, idempotent merge by `brand_slug` (D-16, SCRAPE-10):

```json
{
  "audi": {
    "ru": "Ауди",
    "latin": "Audi",
    "models": {
      "a4": { "ru": "А4", "latin": "A4" }
    }
  },
  "bmw": {
    "ru": "БМВ",
    "latin": "BMW",
    "models": {
      "x3": { "ru": "Х3", "latin": "X3" },
      "x5": { "ru": "Х5", "latin": "X5" }
    }
  }
}
```

Keys are sorted alphabetically (brand-level + model-level) for deterministic byte-stable output across runs.

---

## CBR FX cache — `data/scraped/fx/cbr-<YYYY-MM-DD>.json`

Per-day RUB rates (D-12, SCRAPE-11):

```json
{
  "date": "2026-04-28",
  "rates": {
    "USD": 91.3145,
    "EUR": 97.5210,
    "JPY": 0.591234,
    "KRW": 0.0659012,
    "CNY": 12.5670,
    "AED": 24.8624
  },
  "source": "cbr-live"
}
```

`source` is `'cbr-live'` when the file was just fetched; `'cbr-cache'` when it was returned to the orchestrator from a prior file (D-12 fallback).

---

## Phase 3 importer contract

Phase 3 (`pnpm import:scraped`) reads `data/scraped/drom/current/models.json` and upserts into the Drizzle `models` table.

- **Upsert key:** `(brand_slug, model_slug, generation)` — already enforced as a `UNIQUE` constraint in the `models` table sketch (`.planning/research/ARCHITECTURE.md:555`).
- **Image rehost:** local `data/scraped/drom/<run_id>/images/*.webp` → Yandex Object Storage `images/models/<brand_slug>/<model_slug>/<generation>-hero.webp`. The local path is RELATIVE under the run dir; the importer resolves via `current/` symlink.
- **Pitfall 7 contract:** the importer MUST always re-resolve `current/` per invocation. Never cache `realpath()` across runs.

---

## Editing this file

To change the schema:
1. Edit `server/scrapers/shared/types.ts` first (zod schema is the source of truth).
2. Run `pnpm tsc -p tsconfig.server.json --noEmit` to confirm no type errors.
3. Update this file to mirror the new schema.
4. Bump the "Last updated" line at the top.

If a future v1.x phase adds codegen (e.g., `scripts/build-schema-md.ts`), this manual sync step goes away.
