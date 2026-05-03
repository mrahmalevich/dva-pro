// server/tests/report-html.test.ts
// Plan 01-15: unit test on the report-html shared module.
//
// Pins the contract:
//   1. writeReportHtml writes <runDir>/index.html given models.json + report.json on disk.
//   2. The output parses via cheerio.load() without throwing.
//   3. Missing models.json on disk is handled gracefully (uses []).
//   4. opts.models / opts.report override on-disk values.
//   5. The model data is embedded verbatim in a <script type="application/json"> block
//      (data-embedding contract — pinned via brand_slug round-trip).
//   6. The rendered HTML is byte-stable for a fixed input fixture (snapshot stability).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import * as cheerio from 'cheerio';
import { writeReportHtml } from '../scrapers/shared/report-html.js';
import type { ModelRecord, ReportSummary } from '../scrapers/shared/types.js';

let runDir = '';

beforeEach(async () => {
  runDir = await mkdtemp(resolve(tmpdir(), 'dva-report-html-'));
});

afterEach(async () => {
  if (runDir) await rm(runDir, { recursive: true, force: true });
});

const sampleModel: ModelRecord = {
  brand: 'BMW',
  brand_slug: 'bmw',
  model: 'X5',
  model_slug: 'x5',
  generation: 'g_201808_8395',
  year_from: 2018,
  year_to: 2022,
  body_types: ['SUV'],
  engine_options: [{ cc: 2998, hp: 340, fuel: 'gas' }],
  drive_options: ['AWD'],
  description_ru: 'Четвёртое поколение премиального кроссовера.',
  price_min_rub: 5470000,
  price_max_rub: 9890000,
  image_paths: ['images/bmw-x5-g_201808_8395-hero.webp'],
  source: 'drom-catalog',
  source_url: 'https://www.drom.ru/catalog/bmw/x5/g_201808_8395/',
  scraped_at: '2026-04-28T12:00:00.000Z',
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
        // Phase 01.2 — null preserves byte-stable HTML golden snapshot.
        turbo: null, hybrid_type: null, battery_capacity_kwh: null,
        electric_range_km: null, max_speed_kmh: null, acceleration_0_100_s: null,
      },
      dimensions: {
        length_mm: 4922,
        width_mm: 2004,
        height_mm: 1745,
        wheelbase_mm: 2975,
        clearance_mm: 215,
        trunk_min_l: 645,
        trunk_max_l: 1860,
        curb_weight_kg: 2140,
        gross_weight_kg: 2760,
        payload_kg: null,
      },
      chassis: {
        suspension_front: null, suspension_rear: null,
        brakes_front: null, brakes_rear: null,
        steering_type: null,
      },
      comfort: {
        seats: 5,
        doors: 5,
        fuel_consumption_city_l: 8.9,
        fuel_consumption_highway_l: 6.2,
        fuel_consumption_combined_l: 7.2,
        tank_l: 83,
      },
      tires: { tires_front: '275/45 R20 110Y', tires_rear: '275/45 R20 110Y' },
      features: [],
    },
  ],
};

const sampleReport: ReportSummary = {
  started_at: '2026-04-28T12:00:00.000Z',
  finished_at: '2026-04-28T12:05:00.000Z',
  duration_ms: 300_000,
  pages_visited: 5,
  models_added: 1,
  models_updated: 0,
  images_downloaded: 1,
  images_skipped: 0,
  images_failed: 0,
  errors: [],
  rate_limit_hits: 0,
  blocked_responses: 0,
  fx_stale: false,
  cursor_resumed: false,
  image_failure_rate: 0,
  // Phase 01.2 — chassis + features_density added; values 0 to keep snapshot stable
  // (Plan 03 viewer + Plan 04 coverage will start emitting real values).
  field_coverage: { identity: 0.92, pricing: 0.85, drivetrain: 0.78, dimensions: 0.74, chassis: 0, comfort: 0.81, tires: 0.71, features_density: 0 },
  final_status: 'ok',
};

describe('writeReportHtml (plan 01-15)', () => {
  it('writes index.html with brand string when models.json + report.json on disk', async () => {
    await writeFile(resolve(runDir, 'models.json'), JSON.stringify([sampleModel]));
    await writeFile(resolve(runDir, 'report.json'), JSON.stringify(sampleReport));
    // Seed a placeholder webp so imageCount is > 0.
    await mkdir(resolve(runDir, 'images'), { recursive: true });
    await writeFile(
      resolve(runDir, 'images', 'bmw-x5-g_201808_8395-hero.webp'),
      Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary'),
    );

    await writeReportHtml(runDir);

    const indexPath = resolve(runDir, 'index.html');
    expect(existsSync(indexPath)).toBe(true);
    const html = await readFile(indexPath, 'utf-8');
    expect(html.length).toBeGreaterThan(1024);
    expect(html).toContain('BMW');
  });

  it('produces HTML that cheerio.load parses without throwing', async () => {
    await writeFile(resolve(runDir, 'models.json'), JSON.stringify([sampleModel]));
    await writeFile(resolve(runDir, 'report.json'), JSON.stringify(sampleReport));

    await writeReportHtml(runDir);

    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    expect(() => cheerio.load(html)).not.toThrow();
    const $ = cheerio.load(html);
    // Title contains the runId (basename of the tmp dir).
    const title = $('title').text();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain('Drom scrape');
  });

  it('falls back gracefully when models.json is missing on disk', async () => {
    // No models.json seeded — only report.json.
    await writeFile(resolve(runDir, 'report.json'), JSON.stringify(sampleReport));

    await writeReportHtml(runDir);

    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    expect(html.length).toBeGreaterThan(512);
    // No model data → grid is empty, but the header still renders.
    expect(html).toContain('Drom catalog scrape');
  });

  it('honors opts.models and opts.report over on-disk values', async () => {
    // Disk files would say "ok" with no records; opts override to "blocked" + 1 record.
    await writeFile(resolve(runDir, 'models.json'), '[]');
    await writeFile(
      resolve(runDir, 'report.json'),
      JSON.stringify({ ...sampleReport, final_status: 'ok' }),
    );

    await writeReportHtml(runDir, {
      models: [sampleModel],
      report: { ...sampleReport, final_status: 'blocked' },
    });

    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    expect(html).toContain('blocked');
    expect(html).toContain('BMW');
  });

  it('embeds models in a <script type="application/json"> block (data-embedding contract; BLOCKER 3 + WARNING 9)', async () => {
    await writeFile(resolve(runDir, 'models.json'), JSON.stringify([sampleModel]));
    await writeFile(resolve(runDir, 'report.json'), JSON.stringify(sampleReport));

    await writeReportHtml(runDir);

    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    const $ = cheerio.load(html);
    const dataBlock = $('script[type="application/json"]').html();
    expect(dataBlock).toBeTruthy();
    // The data-embedding contract: the JSON includes the model brand_slug verbatim.
    // If the renderer strips the wrapper or mis-encodes the JSON, this fails.
    expect(dataBlock).toContain('"brand_slug":"bmw"');
    // Round-trip: the embedded JSON must parse (after un-escaping the `<` shielding
    // applied by the renderer to neuter `</script>` payloads).
    const unescaped = (dataBlock as string).replace(/\\u003c/g, '<');
    const parsed = JSON.parse(unescaped) as {
      models: Array<{ brand_slug: string }>;
      runId: string;
    };
    expect(Array.isArray(parsed.models)).toBe(true);
    expect(parsed.models[0]?.brand_slug).toBe('bmw');
  });

  it('renders a byte-stable HTML for a fixed input fixture (snapshot stability; BLOCKER 3)', async () => {
    // Snapshot test — vitest auto-generates server/tests/__snapshots__/report-html.test.ts.snap
    // on first run, then asserts byte-stability against the golden on every subsequent run.
    // The runId is part of the rendered HTML; to keep the snapshot deterministic,
    // we use a sub-dir with a fixed name. The on-disk reads are skipped via opts.
    const fixedDir = resolve(runDir, 'fixed-snapshot-runid');
    await mkdir(fixedDir, { recursive: true });
    await writeReportHtml(fixedDir, {
      models: [sampleModel],
      report: sampleReport,
    });
    const html = await readFile(resolve(fixedDir, 'index.html'), 'utf-8');
    expect(html).toMatchSnapshot();
  });

  it('renders Комплектации modal section when present (R-8)', async () => {
    await writeReportHtml(runDir, {
      models: [sampleModel],
      report: sampleReport,
    });
    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    const $ = cheerio.load(html);
    // The complectations block is rendered as JS in the modal body script.
    // The string "Комплектации" appears in the renderModalBody function body.
    expect(html).toContain('Комплектации');
    // Coverage tiles should appear in the stats grid (server-side rendered).
    expect($('.stat-label:contains("Coverage / Identity")').length).toBe(1);
  });

  it('does NOT render coverage tiles when report.field_coverage is undefined', async () => {
    const reportWithoutCoverage: ReportSummary = { ...sampleReport, field_coverage: undefined };
    await writeReportHtml(runDir, {
      models: [sampleModel],
      report: reportWithoutCoverage,
    });
    const html = await readFile(resolve(runDir, 'index.html'), 'utf-8');
    const $ = cheerio.load(html);
    expect($('.stat-label:contains("Coverage / Identity")').length).toBe(0);
  });
});
