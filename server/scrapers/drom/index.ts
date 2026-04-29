// server/scrapers/drom/index.ts — drom catalog orchestrator (replaces plan 02 placeholder)
//
// Wave 4 (plan 01-07) — composes every Wave 3 shared module:
//   shared/http  — fetchHtml (polite, single-flight, retry)
//   shared/fx    — fetchFx (CBR daily XML; fail-fast on first run, cache fallback otherwise)
//   shared/images — downloadAndConvert (sharp WebP, atomic write under runDir)
//   shared/block-detection — BlockDetector + BlockedError
//   shared/cursor — readCursor / writeCursor / deleteCursor (D-15 brand-boundary)
//   shared/symlink — pointCurrentAt (D-08 atomic rename-over-symlink)
//   shared/brand-aliases — mergeAliases (D-16 idempotent + sorted)
//   shared/atomic-write — atomicWriteFile (writes models.json / report.json safely)
//   shared/types — IScraper, ModelRecord (zod), ScrapeResult, ReportSummary (D-17)
//
// And every Wave 4 parser:
//   parse-brand-index, parse-model-list, parse-generation-list, parse-generation-page
//
// Run flow:
//   1. fetchFx({firstRun: <no-cursor>})  — gates run on FX availability (D-12)
//   2. brand index → parseBrandIndex → optional DROM_BRAND_WHITELIST filter
//   3. for each brand: model list → for each model: generation list → for each
//      generation: generation page → ModelRecord (zod-validated) + hero image
//   4. per-brand mergeAliases; per-model writeCursor (D-15)
//   5. on success: atomicWriteFile models.json + report.json, pointCurrentAt, deleteCursor
//   6. on BlockedError: write partial report.json with final_status='blocked', do NOT
//      update current/, return {status:'blocked'}
//   7. on any other throw: write partial report.json with final_status='error', do NOT
//      update current/, return {status:'error'}
//   8. Pitfall 1 cap: if >10% of attempted records failed validation, treat as DOM
//      regression — return {status:'error'}
//
// Behavioral contract per PATTERNS.md §drom orchestrator (lines 1037-1054).

import { resolve } from 'node:path';
import { existsSync, readlinkSync, readdirSync } from 'node:fs';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { fetchHtml } from '../shared/http.js';
import { fetchFx } from '../shared/fx.js';
import { downloadAndConvert } from '../shared/images.js';
import { BlockDetector, BlockedError } from '../shared/block-detection.js';
import { readCursor, writeCursor, deleteCursor, type Cursor } from '../shared/cursor.js';
import { pointCurrentAt } from '../shared/symlink.js';
import { mergeAliases, type AliasMap } from '../shared/brand-aliases.js';
import { atomicWriteFile } from '../shared/atomic-write.js';
import {
  type IScraper,
  type ModelRecord,
  type ReportSummary,
  type ScrapeResult,
} from '../shared/types.js';
import { parseBrandIndex } from './parse-brand-index.js';
import { parseModelList } from './parse-model-list.js';
import { parseGenerationList } from './parse-generation-list.js';
import { parseGenerationPage } from './parse-generation-page.js';

const SOURCE = 'drom-catalog' as const;
const BRAND_INDEX_URL = 'https://www.drom.ru/catalog/';
// RUN_ROOT is relative; we always pass it through resolve() at runtime so the
// integration test (which spies on process.cwd) sees the right base.
const RUN_ROOT_REL = 'data/scraped/drom';

/** D-07: ISO-8601 UTC compact, e.g. '2026-04-28T07-30-00Z'. */
function makeRunId(now: Date = new Date()): string {
  // 2026-04-28T07:30:00.123Z → 2026-04-28T07-30-00Z
  return now.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
}

/**
 * Incremental run support: read the previous `current/` snapshot (if any) and
 * pre-populate the new run's working set. Without this, a re-run scoped to a
 * subset of brands (e.g. DROM_BRAND_WHITELIST=lada after a full backfill) would
 * silently drop every other brand from the new `current/models.json`.
 *
 * Behavior:
 *   - If `current/` does not exist (first-ever run), returns empty state.
 *   - If `current/` exists, reads `models.json` into a Map keyed by
 *     `${brand_slug}:${model_slug}:${generation}` and copies every WebP under
 *     `current/images/` into `<newRunDir>/images/`. The new run will then
 *     UPSERT records into `seen` and SKIP image download for any image that
 *     was inherited (file already exists on disk).
 *
 * Robust to: missing models.json, malformed JSON, broken symlink, missing
 * images dir. Any inheritance failure logs to the report's error list and
 * starts the run with empty state — the prev `current/` snapshot is never
 * touched, so the operator can fall back manually.
 */
async function inheritFromPrevCurrent(
  runRoot: string,
  newRunDir: string,
  report: ReportSummary,
): Promise<{
  seen: Map<string, ModelRecord>;
  inheritedImageCount: number;
  prevRunId: string | null;
}> {
  const seen = new Map<string, ModelRecord>();
  const currentSymlink = resolve(runRoot, 'current');
  if (!existsSync(currentSymlink)) {
    return { seen, inheritedImageCount: 0, prevRunId: null };
  }

  let prevRunId: string | null = null;
  try {
    prevRunId = readlinkSync(currentSymlink);
  } catch {
    return { seen, inheritedImageCount: 0, prevRunId: null };
  }
  const prevDir = resolve(runRoot, prevRunId);
  if (!existsSync(prevDir)) {
    return { seen, inheritedImageCount: 0, prevRunId: null };
  }

  // 1. Inherit records from prev models.json.
  const prevModelsPath = resolve(prevDir, 'models.json');
  if (existsSync(prevModelsPath)) {
    try {
      const raw = await readFile(prevModelsPath, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const r of arr as ModelRecord[]) {
          if (r && r.brand_slug && r.model_slug && r.generation) {
            seen.set(`${r.brand_slug}:${r.model_slug}:${r.generation}`, r);
          }
        }
      }
    } catch (err) {
      report.errors.push({
        url: prevModelsPath,
        message: `inherit: ${err instanceof Error ? err.message : String(err)}`,
        kind: 'inherit',
      });
    }
  }

  // 2. Copy prev images/ into the new run dir so they are part of the new
  //    snapshot. Skipped image downloads in the loop will then no-op against
  //    on-disk files. fs.copyFile on Linux+macOS is fast (cp internally uses
  //    clonefile/reflink where supported) and portable to Windows.
  const prevImages = resolve(prevDir, 'images');
  let inheritedImageCount = 0;
  if (existsSync(prevImages)) {
    await mkdir(resolve(newRunDir, 'images'), { recursive: true });
    let entries: string[] = [];
    try {
      entries = readdirSync(prevImages);
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.endsWith('.webp')) continue;
      const src = resolve(prevImages, entry);
      const dst = resolve(newRunDir, 'images', entry);
      try {
        await copyFile(src, dst);
        inheritedImageCount++;
      } catch (err) {
        report.errors.push({
          url: src,
          message: `inherit-image: ${err instanceof Error ? err.message : String(err)}`,
          kind: 'inherit',
        });
      }
    }
  }

  return { seen, inheritedImageCount, prevRunId };
}

function emptyReport(startedAt: string): ReportSummary {
  return {
    started_at: startedAt,
    finished_at: '',
    duration_ms: 0,
    pages_visited: 0,
    models_added: 0,
    models_updated: 0,
    images_downloaded: 0,
    images_skipped: 0,
    images_failed: 0,
    errors: [],
    rate_limit_hits: 0,
    blocked_responses: 0,
    fx_stale: false,
    cursor_resumed: false,
    image_failure_rate: 0,
    final_status: 'error',
  };
}

export const drom: IScraper = {
  source: SOURCE,
  async run(opts: { resume?: boolean } = {}): Promise<ScrapeResult> {
    const startedAt = new Date().toISOString();
    const runId = makeRunId();
    const runRoot = resolve(RUN_ROOT_REL);
    const runDir = resolve(runRoot, runId);
    const brandAliasesPath = resolve(runRoot, 'brand-aliases.json');
    const detector = new BlockDetector();
    const report: ReportSummary = emptyReport(startedAt);

    // Incremental snapshot: pull forward records and images from the previous
    // `current/` so a scoped re-run (e.g. DROM_BRAND_WHITELIST=lada) does not
    // delete data from other brands. `seen` is keyed by upsert key per
    // SCHEMA.md §"Phase 3 importer contract" — `(brand_slug, model_slug, generation)`.
    await mkdir(runDir, { recursive: true });
    const { seen, inheritedImageCount, prevRunId } = await inheritFromPrevCurrent(
      runRoot,
      runDir,
      report,
    );
    // Track which records were inherited (vs. produced by this run) so the
    // add/update counters reflect THIS run's work, not the merged snapshot.
    const inheritedKeys = new Set<string>(seen.keys());
    // Track per-run "models touched" separately from the merged total — used
    // for the >10% Pitfall-1 validation cap below.
    let modelsTouchedThisRun = 0;
    void prevRunId; // reserved for future report.json field; suppressed for now

    let cursor: Cursor | null = null;
    if (opts.resume) {
      cursor = await readCursor(runDir);
      report.cursor_resumed = cursor !== null;
    }

    try {
      // 1. FX feed first — fail-fast if no cache exists yet (D-12).
      const fx = await fetchFx({ firstRun: !cursor });
      report.fx_stale = fx.source === 'cbr-cache';
      void inheritedImageCount; // reserved for future report.json field

      // 2. Brand index.
      const brandIndexHtml = await fetchHtml(BRAND_INDEX_URL);
      detector.inspect(BRAND_INDEX_URL, brandIndexHtml);
      report.pages_visited++;
      const allBrands = parseBrandIndex(brandIndexHtml);

      // Optional brand whitelist via env var (smoke-run gate per plan 09).
      // Comma-separated brand_slug list, lowercased. Unset/empty = full catalog.
      const whitelist = (process.env.DROM_BRAND_WHITELIST ?? '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const filteredBrands =
        whitelist.length > 0
          ? allBrands.filter((b) => whitelist.includes(b.brand_slug))
          : allBrands;
      // Sort alphabetically by brand_slug so the cursor's lexicographic
      // comparison below is semantically correct regardless of drom DOM order
      // (CR-01 / CR-03 fix per 01-REVIEW.md). Parsers return DOM-traversal
      // order; the orchestrator owns ordering for cursor purposes.
      const brands = [...filteredBrands].sort((a, b) =>
        a.brand_slug.localeCompare(b.brand_slug),
      );

      // Resume: skip brands lexicographically < lastBrandSlug.
      // Throw loudly when the cursored brand has vanished (drom removal or
      // whitelist exclusion) instead of silently restarting from index 0
      // (CR-01 fix per 01-REVIEW.md).
      let startFromBrandIndex = 0;
      if (cursor) {
        const idx = brands.findIndex((b) => b.brand_slug >= cursor.lastBrandSlug);
        if (idx === -1) {
          throw new Error(
            `Cursor.lastBrandSlug='${cursor.lastBrandSlug}' not present in current brand list ` +
              `(removed from drom or filtered by DROM_BRAND_WHITELIST). ` +
              `Refusing silent restart; delete .cursor.json explicitly to start over.`,
          );
        }
        startFromBrandIndex = idx;
      }

      for (let bi = startFromBrandIndex; bi < brands.length; bi++) {
        const brand = brands[bi];
        const brandModels: Record<string, { ru: string; latin: string }> = {};

        // 3. Model list per brand.
        const modelListHtml = await fetchHtml(brand.url);
        detector.inspect(brand.url, modelListHtml);
        report.pages_visited++;
        const parsedModels = parseModelList(modelListHtml, brand.url);
        // Sort alphabetically by model_slug so the cursor's lexicographic
        // comparison below is correct regardless of drom DOM order
        // (CR-02 / CR-03 fix per 01-REVIEW.md).
        const models = [...parsedModels].sort((a, b) =>
          a.model_slug.localeCompare(b.model_slug),
        );

        // Resume contract (CR-04 enforcement, plan 01-12):
        //   When the cursor points at this brand, the brand is re-scraped from
        //   scratch — startFromModelIndex pinned to 0 — so partial brand-alias
        //   entries written before the mid-brand crash are reconstructed when
        //   mergeAliases runs at the end of the brand. Records and images
        //   from OTHER brands are preserved by inheritFromPrevCurrent above
        //   (d3bad88), so re-scraping only the cursored brand is data-safe.
        //
        //   The defensive shape check below remains: if the cursor file
        //   references a model that has vanished, surface cursor drift to the
        //   operator even though we will be re-scraping the brand fresh.
        let startFromModelIndex = 0;
        if (cursor && brand.brand_slug === cursor.lastBrandSlug) {
          const idx = models.findIndex((m) => m.model_slug >= cursor.lastModelSlug);
          if (idx === -1) {
            throw new Error(
              `Cursor.lastModelSlug='${cursor.lastModelSlug}' not present in current model list ` +
                `for brand '${brand.brand_slug}'. Refusing silent restart of brand; ` +
                `delete .cursor.json explicitly to start over.`,
            );
          }
          // CR-04 contract: ignore idx for positioning — re-scrape from index 0.
          // The found-or-throw check above is preserved as a cursor-drift signal.
          startFromModelIndex = 0;
        }

        for (let mi = startFromModelIndex; mi < models.length; mi++) {
          const model = models[mi];
          brandModels[model.model_slug] = { ru: model.ru_name, latin: model.latin_name };

          // 4. Generation list per model.
          const genListHtml = await fetchHtml(model.url);
          detector.inspect(model.url, genListHtml);
          report.pages_visited++;
          const gens = parseGenerationList(genListHtml, model.url);

          for (const gen of gens) {
            // 5. Generation page → ModelRecord.
            const genPageHtml = await fetchHtml(gen.url);
            detector.inspect(gen.url, genPageHtml);
            report.pages_visited++;

            try {
              const record = parseGenerationPage(genPageHtml, {
                brand: brand.latin_name,
                brand_slug: brand.brand_slug,
                model: model.latin_name,
                model_slug: model.model_slug,
                generation: gen.generation_id,
                sourceUrl: gen.url,
                heroImageUrl: gen.hero_image_url,
              });
              const key = `${record.brand_slug}:${record.model_slug}:${record.generation}`;
              if (inheritedKeys.has(key)) {
                report.models_updated++;
              } else {
                report.models_added++;
              }
              seen.set(key, record);
              modelsTouchedThisRun++;

              // 6. Hero image download (sequenced via shared/images.ts pLimit(4)).
              //    Counters split per CR-06 / WR-06:
              //      images_skipped — inherited from prev current/, OR no source URL
              //      images_failed  — we tried and failed (network / transcode)
              //    On failure we ALSO clear record.image_paths so models.json
              //    never references a WebP that is not on disk (CR-05).
              const heroRel = record.image_paths[0];
              const heroAbs = heroRel ? resolve(runDir, heroRel) : null;
              if (heroAbs && existsSync(heroAbs)) {
                report.images_skipped++;
              } else if (gen.hero_image_url && heroRel) {
                try {
                  await downloadAndConvert(gen.hero_image_url, heroRel, runDir);
                  report.images_downloaded++;
                } catch (imgErr) {
                  report.images_failed++;
                  report.errors.push({
                    url: gen.hero_image_url,
                    message: `image: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`,
                    kind: 'image',
                  });
                  // CR-05: do not leave an orphan path in models.json.
                  record.image_paths = [];
                }
              } else {
                report.images_skipped++;
              }
            } catch (parseErr) {
              report.errors.push({
                url: gen.url,
                message: `parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
                kind: 'parse',
              });
            }
          }

          // Per-model checkpoint after every model — D-15 brand-boundary granularity.
          await writeCursor(runDir, {
            lastBrandSlug: brand.brand_slug,
            lastModelSlug: model.model_slug,
            completedAt: new Date().toISOString(),
          });
        }

        // Brand fully done → merge brand-aliases entry (idempotent + sorted output).
        const brandEntry: AliasMap[string] = {
          ru: brand.latin_name, // Drom anchors expose only Latin labels (Wave 4 finding);
          latin: brand.latin_name, // brand-aliases will gain Cyrillic via D-16 future sources.
          models: brandModels,
        };
        await mergeAliases(brandAliasesPath, { [brand.brand_slug]: brandEntry });
      }

      // Pitfall 1 (CR-06 split): the >10% drop-out gate counts ONLY parse errors
      // (DOM-regression signal). Image-fetch errors are tracked separately
      // (images_failed) and have their own bounded threshold below.
      const parseErrors = report.errors.filter((e) => e.kind === 'parse').length;
      const totalParseAttempted = modelsTouchedThisRun + parseErrors;
      if (totalParseAttempted > 0 && parseErrors / totalParseAttempted > 0.1) {
        throw new Error(
          `DOM regression: parse errors > 10% (${parseErrors} of ${totalParseAttempted})`,
        );
      }

      // CR-06 image abort gate: a bad CDN day must not lose an otherwise-clean
      // run. Abort only when the absolute count is meaningful AND the rate is
      // high; below that, surface via image_failure_rate in report.json.
      const imagesAttempted = report.images_downloaded + report.images_failed;
      report.image_failure_rate =
        imagesAttempted > 0
          ? Math.round((report.images_failed / imagesAttempted) * 10000) / 10000
          : 0;
      if (imagesAttempted >= 20 && report.images_failed / imagesAttempted > 0.20) {
        throw new Error(
          `Image-fetch failure rate > 20% (${report.images_failed} of ${imagesAttempted}); ` +
            `likely CDN outage — re-run after 24h`,
        );
      }

      // 7. Write artifacts atomically. models.json is the merged snapshot:
      //    [...inherited records from prev current/] ∪ [...records produced
      //    or updated by this run].
      const finishedAt = new Date().toISOString();
      report.finished_at = finishedAt;
      report.duration_ms = Date.now() - new Date(startedAt).getTime();
      report.final_status = 'ok';

      const mergedRecords = [...seen.values()];
      await atomicWriteFile(
        resolve(runDir, 'models.json'),
        JSON.stringify(mergedRecords, null, 2),
      );
      await atomicWriteFile(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2));
      await pointCurrentAt(runDir);
      await deleteCursor(runDir);

      return {
        status: 'ok',
        source: SOURCE,
        runId,
        recordsWritten: mergedRecords.length,
        durationMs: report.duration_ms,
        report,
      };
    } catch (err) {
      report.finished_at = new Date().toISOString();
      report.duration_ms = Date.now() - new Date(startedAt).getTime();

      if (err instanceof BlockedError) {
        report.final_status = 'blocked';
        report.blocked_responses++;
        // Best-effort write of partial report (mkdir runDir if absent).
        await atomicWriteFile(
          resolve(runDir, 'report.json'),
          JSON.stringify(report, null, 2),
        ).catch(() => {});
        return {
          status: 'blocked',
          source: SOURCE,
          runId,
          reason: err.reason,
          sampleUrl: err.sampleUrl,
        };
      }

      report.final_status = 'error';
      report.errors.push({
        url: 'orchestrator',
        message: err instanceof Error ? err.message : String(err),
        kind: 'orchestrator',
      });
      await atomicWriteFile(
        resolve(runDir, 'report.json'),
        JSON.stringify(report, null, 2),
      ).catch(() => {});
      return {
        status: 'error',
        source: SOURCE,
        runId,
        error: { message: err instanceof Error ? err.message : String(err), cause: err },
      };
    }
  },
};
