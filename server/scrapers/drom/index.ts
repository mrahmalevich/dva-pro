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
    errors: [],
    rate_limit_hits: 0,
    blocked_responses: 0,
    fx_stale: false,
    cursor_resumed: false,
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
    const records: ModelRecord[] = [];

    let cursor: Cursor | null = null;
    if (opts.resume) {
      cursor = await readCursor(runDir);
      report.cursor_resumed = cursor !== null;
    }

    try {
      // 1. FX feed first — fail-fast if no cache exists yet (D-12).
      const fx = await fetchFx({ firstRun: !cursor });
      report.fx_stale = fx.source === 'cbr-cache';

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
      const brands =
        whitelist.length > 0
          ? allBrands.filter((b) => whitelist.includes(b.brand_slug))
          : allBrands;

      // Resume: drop brands lexicographically < lastBrandSlug.
      const startFromBrandIndex = cursor
        ? Math.max(
            0,
            brands.findIndex((b) => b.brand_slug >= cursor!.lastBrandSlug),
          )
        : 0;

      for (let bi = startFromBrandIndex; bi < brands.length; bi++) {
        const brand = brands[bi];
        const brandModels: Record<string, { ru: string; latin: string }> = {};

        // 3. Model list per brand.
        const modelListHtml = await fetchHtml(brand.url);
        detector.inspect(brand.url, modelListHtml);
        report.pages_visited++;
        const models = parseModelList(modelListHtml, brand.url);

        // Resume: if cursor is on this brand, drop already-completed models.
        const startFromModelIndex =
          cursor && brand.brand_slug === cursor.lastBrandSlug
            ? Math.max(
                0,
                models.findIndex((m) => m.model_slug > cursor!.lastModelSlug),
              )
            : 0;

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
              });
              records.push(record);
              report.models_added++;

              // 6. Hero image download (sequenced via shared/images.ts pLimit(4)).
              if (gen.hero_image_url && record.image_paths.length > 0) {
                try {
                  await downloadAndConvert(gen.hero_image_url, record.image_paths[0], runDir);
                  report.images_downloaded++;
                } catch (imgErr) {
                  report.images_skipped++;
                  report.errors.push({
                    url: gen.hero_image_url,
                    message: `image: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`,
                  });
                }
              } else {
                report.images_skipped++;
              }
            } catch (parseErr) {
              report.errors.push({
                url: gen.url,
                message: `parse: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
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

      // Pitfall 1: if >10 % of attempted records failed validation, treat as DOM regression.
      const totalAttempted = report.models_added + report.errors.length;
      if (totalAttempted > 0 && report.errors.length / totalAttempted > 0.1) {
        throw new Error(
          `Validation drop-out > 10% (${report.errors.length} of ${totalAttempted}); likely DOM regression`,
        );
      }

      // 7. Write artifacts atomically.
      const finishedAt = new Date().toISOString();
      report.finished_at = finishedAt;
      report.duration_ms = Date.now() - new Date(startedAt).getTime();
      report.final_status = 'ok';

      await atomicWriteFile(resolve(runDir, 'models.json'), JSON.stringify(records, null, 2));
      await atomicWriteFile(resolve(runDir, 'report.json'), JSON.stringify(report, null, 2));
      await pointCurrentAt(runDir);
      await deleteCursor(runDir);

      return {
        status: 'ok',
        source: SOURCE,
        runId,
        recordsWritten: records.length,
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
