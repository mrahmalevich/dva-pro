// server/tests/bmw-pilot-viewer.test.ts
// Plan 01.1-09: screenshot-diff golden test for the BMW pilot viewer.
//
// Pins the rendered HTML report viewer against a committed PNG golden
// using puppeteer (headless Chromium) + pixelmatch + pngjs.
//
// Behaviour contract:
//   - First run (no golden on disk): captures PNG, writes it as the golden,
//     logs a warning, and PASSES. Operator commits the PNG.
//   - Subsequent runs: pixelmatch diff ratio must be ≤ 0.005 (0.5%) to pass.
//   - On failure: writes a diff PNG to __snapshots__/bmw-pilot-viewer.diff.png
//     for operator inspection (gitignored).
//
// Pitfall 6 mitigation: fixture runDir has a fixed sub-dir name ("fixed-snapshot-runid")
//   so the runId portion of the rendered HTML is byte-stable across runs.
// Pitfall 7 mitigation: CSS override forces 'DejaVu Sans' as font family so
//   macOS dev and Linux CI render identically.
//
// SPEC: R-8 (PNG golden half).

import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { writeReportHtml } from '../scrapers/shared/report-html.js';
import type { ModelRecord, ReportSummary } from '../scrapers/shared/types.js';

const GOLDEN = resolve('server/tests/__snapshots__/bmw-pilot-viewer.png');
const DIFF_PATH = resolve('server/tests/__snapshots__/bmw-pilot-viewer.diff.png');
const VIEWPORT = { width: 1280, height: 1600 };
const DIFF_THRESHOLD = 0.005; // 0.5% per SPEC R-8

/** Hand-crafted 3-trim BMW fixture with fully-populated leaves (matches the bmw-pilot.test.ts shape). */
const fixtureModels: ModelRecord[] = [
  {
    brand: 'BMW',
    brand_slug: 'bmw',
    model: 'X5',
    model_slug: 'x5',
    generation: 'IV (G05)',
    year_from: 2018,
    year_to: null,
    body_types: ['SUV'],
    engine_options: [{ cc: 2993, hp: 249, fuel: 'diesel' }],
    drive_options: ['AWD'],
    description_ru: 'BMW X5 G05 — fixture for screenshot golden',
    price_min_rub: 7190000,
    price_max_rub: 15000000,
    image_paths: [],
    source: 'drom-catalog',
    source_url: 'https://www.drom.ru/catalog/bmw/x5/g05/',
    scraped_at: '2026-04-29T00:00:00.000Z',
    complectations: [
      {
        identity: {
          name: 'xDrive 30d AT Base',
          period_from: '04.2020',
          period_to: '03.2022',
          tier: 'Базовая',
          engine_code: 'B47B20',
          frame_code: 'G05',
          source_url: 'https://www.drom.ru/catalog/bmw/x5/207354/',
        },
        pricing: { price_new_rub: 7190000, price_used_from_rub: null },
        drivetrain: {
          engine_cc: 2993,
          engine_hp: 249,
          engine_fuel: 'diesel',
          drive: 'AWD',
          transmission_type: 'AT',
          transmission_gears: 8,
        },
        dimensions: {
          length_mm: 4922,
          width_mm: 2004,
          height_mm: 1745,
          wheelbase_mm: 2975,
          clearance_mm: 214,
          trunk_min_l: 645,
          trunk_max_l: 1860,
          curb_weight_kg: 2105,
          gross_weight_kg: 2890,
        },
        comfort: {
          seats: 5,
          doors: 5,
          fuel_consumption_city_l: 8.5,
          fuel_consumption_highway_l: 6.2,
          fuel_consumption_combined_l: 7.1,
          tank_l: 80,
        },
        tires: { tires_front: '275/45 R20 110Y', tires_rear: '305/40 R20 112Y' },
      },
      {
        identity: {
          name: 'xDrive 30d AT M Sport Plus',
          period_from: '04.2020',
          period_to: '03.2022',
          tier: 'Предмаксимальная',
          engine_code: 'B47B20',
          frame_code: 'G05',
          source_url: 'https://www.drom.ru/catalog/bmw/x5/252766/',
        },
        pricing: { price_new_rub: 8990000, price_used_from_rub: null },
        drivetrain: {
          engine_cc: 2993,
          engine_hp: 249,
          engine_fuel: 'diesel',
          drive: 'AWD',
          transmission_type: 'AT',
          transmission_gears: 8,
        },
        dimensions: {
          length_mm: 4922,
          width_mm: 2004,
          height_mm: 1745,
          wheelbase_mm: 2975,
          clearance_mm: 214,
          trunk_min_l: 645,
          trunk_max_l: 1860,
          curb_weight_kg: 2150,
          gross_weight_kg: 2920,
        },
        comfort: {
          seats: 5,
          doors: 5,
          fuel_consumption_city_l: 8.5,
          fuel_consumption_highway_l: 6.2,
          fuel_consumption_combined_l: 7.1,
          tank_l: 80,
        },
        tires: { tires_front: '275/45 R20 110Y', tires_rear: '305/40 R20 112Y' },
      },
      {
        identity: {
          name: 'M Competition',
          period_from: '04.2020',
          period_to: '03.2022',
          tier: null,
          engine_code: 'S63B44',
          frame_code: 'F95',
          source_url: 'https://www.drom.ru/catalog/bmw/x5/265067/',
        },
        pricing: { price_new_rub: 12990000, price_used_from_rub: null },
        drivetrain: {
          engine_cc: 4395,
          engine_hp: 625,
          engine_fuel: 'gas',
          drive: 'AWD',
          transmission_type: 'AT',
          transmission_gears: 8,
        },
        dimensions: {
          length_mm: 4938,
          width_mm: 2016,
          height_mm: 1745,
          wheelbase_mm: 2975,
          clearance_mm: 200,
          trunk_min_l: 645,
          trunk_max_l: 1860,
          curb_weight_kg: 2310,
          gross_weight_kg: 2810,
        },
        comfort: {
          seats: 5,
          doors: 5,
          fuel_consumption_city_l: 14.5,
          fuel_consumption_highway_l: 9.6,
          fuel_consumption_combined_l: 11.4,
          tank_l: 80,
        },
        tires: { tires_front: '295/35 R21 107Y', tires_rear: '315/30 R22 111Y' },
      },
    ],
  },
];

/** Hand-crafted ReportSummary with deterministic timestamps + populated field_coverage. */
const fixtureReport: ReportSummary = {
  started_at: '2026-04-29T00:00:00.000Z',
  finished_at: '2026-04-29T05:30:00.000Z',
  duration_ms: 5 * 60 * 60 * 1000 + 30 * 60 * 1000,
  pages_visited: 100,
  models_added: 1,
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
  final_status: 'ok',
  field_coverage: {
    identity: 0.92,
    pricing: 0.85,
    drivetrain: 0.78,
    dimensions: 0.74,
    comfort: 0.81,
    tires: 0.71,
  },
};

describe('bmw-pilot-viewer screenshot golden (R-8)', () => {
  it(
    'viewer renders identically to the golden PNG (or writes the golden on first run)',
    async () => {
      // 1. Render the viewer with deterministic fixture data into a tmp dir.
      //    Use a fixed-name sub-dir to keep the runId portion of the HTML deterministic
      //    (mirrors the report-html.test.ts pattern for snapshot stability — Pitfall 6).
      const tmpRoot = mkdtempSync(join(tmpdir(), 'bmw-pilot-viewer-'));
      const fixedDir = join(tmpRoot, 'fixed-snapshot-runid');
      await mkdir(fixedDir, { recursive: true });
      await writeReportHtml(fixedDir, { models: fixtureModels, report: fixtureReport });
      const indexHtml = await readFile(join(fixedDir, 'index.html'), 'utf-8');

      // 2. Render the HTML in headless Chromium with deterministic flags.
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
      });
      try {
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        // Pitfall 7 mitigation: pin font to a Chromium-bundled family so macOS dev
        // and Linux CI render identically.
        const fontOverride = `<style>* { font-family: 'DejaVu Sans', sans-serif !important; }</style>`;
        await page.setContent(fontOverride + indexHtml, { waitUntil: 'load' });
        const screenshotData = await page.screenshot({ type: 'png', fullPage: true });
        // puppeteer 24.x returns Uint8Array; pngjs requires a Node.js Buffer.
        const actualBuf = Buffer.isBuffer(screenshotData)
          ? screenshotData
          : Buffer.from(screenshotData as Uint8Array);

        // 3. Compare against the golden PNG.
        const actualPng = PNG.sync.read(actualBuf);

        let goldenBuf: Buffer | null = null;
        try {
          goldenBuf = await readFile(GOLDEN);
        } catch {
          // First run: write the golden and skip the diff (operator commits on green).
          await writeFile(GOLDEN, actualBuf);
          console.warn(
            `[bmw-pilot-viewer] First run: wrote golden at ${GOLDEN}. Commit and re-run to validate diff.`,
          );
          return;
        }

        const expectedPng = PNG.sync.read(goldenBuf);
        expect(actualPng.width).toBe(expectedPng.width);
        expect(actualPng.height).toBe(expectedPng.height);

        const diff = new PNG({ width: actualPng.width, height: actualPng.height });
        const mismatched = pixelmatch(
          actualPng.data,
          expectedPng.data,
          diff.data,
          actualPng.width,
          actualPng.height,
          { threshold: 0.1 },
        );
        const ratio = mismatched / (actualPng.width * actualPng.height);

        if (ratio > DIFF_THRESHOLD) {
          // Write diff PNG for operator inspection.
          await writeFile(DIFF_PATH, PNG.sync.write(diff));
          console.error(
            `[bmw-pilot-viewer] Diff ratio ${(ratio * 100).toFixed(2)}% > threshold ${DIFF_THRESHOLD * 100}%. Diff: ${DIFF_PATH}`,
          );
        }
        expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD);
      } finally {
        await browser.close();
      }
    },
    30_000,
  );
});
