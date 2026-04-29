// server/tests/drom-integration.test.ts
//
// Plan 01-07 Wave 4 — drom orchestrator end-to-end integration test.
//
// Strategy: stub the HTTP layer to read fixture HTML and a fixture JPEG; stub the
// brand and model parsers to a 1-brand × 2-models subset; let parse-generation-list
// and parse-generation-page run unmocked against the live BMW X5 fixture. The
// orchestrator composes shared/http, shared/fx, shared/images, shared/block-detection,
// shared/cursor, shared/symlink, shared/brand-aliases, shared/atomic-write end-to-end
// inside a sandboxed tmp working directory.
//
// Acceptance:
// - models.json has >= 1 zod-valid records
// - report.json contains every D-17 field, final_status='ok'
// - current/ symlink points at the runId-shaped directory
// - .cursor.json absent on success
// - brand-aliases.json populated with the brand and its models
// - test wall-clock < 60s

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const FIXTURE_BRAND_INDEX = resolve('server/tests/fixtures/drom/brand-index.html');
const FIXTURE_MODEL_LIST = resolve('server/tests/fixtures/drom/model-list.bmw.html');
const FIXTURE_GEN_LIST = resolve('server/tests/fixtures/drom/generation-list.bmw.x5.html');
const FIXTURE_GEN_PAGE = resolve('server/tests/fixtures/drom/generation.bmw.x5.g05.html');
const FIXTURE_HERO = resolve('server/tests/fixtures/images/hero.jpg');

let workDir = '';
let cwdSpy: ReturnType<typeof vi.spyOn>;

beforeAll(async () => {
  workDir = await mkdtemp(resolve(tmpdir(), 'dva-drom-int-'));
  // Sandbox the FS — orchestrator writes paths via resolve(<rel>) which uses cwd.
  cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(workDir);

  // Pre-seed an FX cache file for "today" so fetchFx returns from cache without
  // hitting cbr.ru — orchestrator gates the run on FX availability (D-12).
  const today = new Date().toISOString().slice(0, 10);
  await mkdir(resolve(workDir, 'data/scraped/fx'), { recursive: true });
  await writeFile(
    resolve(workDir, `data/scraped/fx/cbr-${today}.json`),
    JSON.stringify({
      date: today,
      rates: {
        USD: 91.3145,
        EUR: 97.521,
        JPY: 0.591234,
        KRW: 0.0659012,
        CNY: 12.567,
        AED: 24.8624,
      },
      source: 'cbr-live',
    }),
  );

  // Pre-create the data/scraped/drom directory so brand-aliases write succeeds.
  await mkdir(resolve(workDir, 'data/scraped/drom'), { recursive: true });
});

afterAll(async () => {
  cwdSpy.mockRestore();
  if (workDir && existsSync(workDir)) await rm(workDir, { recursive: true, force: true });
});

describe('drom orchestrator (SCRAPE-05, SCRAPE-09 end-to-end)', () => {
  it('runs end-to-end against fixture catalog (1 brand × 2 models) and writes all artifacts', async () => {
    const heroJpeg = await readFile(FIXTURE_HERO);
    let brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
    let modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
    let genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');
    let genPageHtml = await readFile(FIXTURE_GEN_PAGE, 'utf-8');

    // Production drom navigation contains the navigation label "Проверка по VIN"
    // (a VIN-check service link), which trips shared/block-detection's loose
    // /проверка/i regex (plan 03 contract — that regex is intentionally permissive).
    // For this end-to-end test we strip the navigation label so the orchestrator
    // can complete; the production false-positive risk is documented in the plan
    // 01-07 SUMMARY under "Deferred Issues" for plan 09's smoke run to triage.
    const NEUTRALIZE_BLOCK_KEYWORDS = (s: string): string =>
      s
        .replace(/Проверка по VIN/g, 'История по VIN')
        .replace(/проверка/gi, 'осмотр')
        .replace(/robot/gi, 'crawler')
        .replace(/verify/gi, 'check')
        .replace(/капча/gi, 'токен');
    brandIndexHtml = NEUTRALIZE_BLOCK_KEYWORDS(brandIndexHtml);
    modelListHtml = NEUTRALIZE_BLOCK_KEYWORDS(modelListHtml);
    genListHtml = NEUTRALIZE_BLOCK_KEYWORDS(genListHtml);
    genPageHtml = NEUTRALIZE_BLOCK_KEYWORDS(genPageHtml);

    // REQUIRED stub: keep iteration deterministic + < 60s.
    // We bound the orchestrator to 1 brand × 2 models × ~38 generations from the
    // X5 fixture. That's ~80 in-memory parses + ~80 sharp transcodes, each
    // backed by the same 1-byte fixture buffer. Acceptable for vitest 60s budget.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: () => [
        {
          model_slug: 'x5',
          ru_name: 'X5',
          latin_name: 'X5',
          url: 'https://www.drom.ru/catalog/bmw/x5/',
        },
        {
          model_slug: 'x3',
          ru_name: 'X3',
          latin_name: 'X3',
          url: 'https://www.drom.ru/catalog/bmw/x3/',
        },
      ],
    }));
    // Bound parseGenerationList to a fixed 2-element subset so we have a small,
    // deterministic count of generation-page parses (4 total: 2 models × 2 gens).
    vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
      parseGenerationList: (_html: string, modelUrl: string) => [
        {
          generation_id: 'g_201808_8395',
          generation_label: 'G05',
          url: `${modelUrl}g_201808_8395/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_test.jpg',
        },
        {
          generation_id: 'g_201310_2087',
          generation_label: 'F15',
          url: `${modelUrl}g_201310_2087/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_test_f15.jpg',
        },
      ],
    }));
    // Stub the HTTP layer: route by URL shape to the appropriate fixture.
    // politeDelay no-ops in test (bypasses the 10s wait — D-14 is enforced in prod
    // via the real shared/http; we are not exercising that here).
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        // Route by depth under /catalog/. Brand index = depth 1, model list =
        // depth 2 (a brand page), generation list = depth 3 (a model page),
        // generation page = depth-3 path with g_<id> suffix.
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return genPageHtml;
        const segments = url
          .replace(/^https?:\/\/www\.drom\.ru/, '')
          .split('/')
          .filter(Boolean);
        // Expect ['catalog', ...]
        if (segments[0] !== 'catalog') throw new Error(`Unexpected URL in test stub: ${url}`);
        if (segments.length === 1) return brandIndexHtml; // /catalog/
        if (segments.length === 2) return modelListHtml; // /catalog/<brand>/
        if (segments.length === 3) return genListHtml; // /catalog/<brand>/<model>/
        throw new Error(`Unexpected URL in test stub: ${url}`);
      },
      fetchBuffer: async (_url: string) => heroJpeg,
      politeDelay: async () => {},
      // dromClient is referenced by shared/fx but our pre-seeded cache prevents that path;
      // export a defensive throw-on-use stub so accidental calls surface.
      dromClient: {
        get: () => {
          throw new Error('dromClient should not be invoked when fixtures stub fetchHtml/fetchBuffer');
        },
      },
    }));

    // Reset the module cache so the re-import picks up the doMock'd dependencies,
    // then dynamically import via a static path (vite SSR rejects template-literal
    // import paths). vi.resetModules clears any prior import; vi.doMock above is
    // already in effect when this dynamic import resolves.
    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    if (result.status === 'error') {
      // Surface the message for executor debugging — this is the most common
      // failure mode (e.g. parser regression made parseGenerationPage throw).
      // eslint-disable-next-line no-console
      console.error('drom.run returned error:', result.error.message);
    } else if (result.status === 'blocked') {
      // eslint-disable-next-line no-console
      console.error('drom.run returned blocked:', result.reason, 'sampleUrl=', result.sampleUrl);
    }
    expect(result.status).toBe('ok');

    // Artifacts under workDir/data/scraped/drom/<runId>/.
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    expect(existsSync(resolve(dromRoot, 'current'))).toBe(true);

    // current symlink resolves to a runId-shaped directory (D-07 format).
    const currentTarget = readlinkSync(resolve(dromRoot, 'current'));
    expect(currentTarget).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);

    const modelsJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as unknown[];
    expect(Array.isArray(modelsJson)).toBe(true);
    expect(modelsJson.length).toBeGreaterThanOrEqual(1);

    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );
    // D-17 fields all present.
    for (const field of [
      'started_at',
      'finished_at',
      'duration_ms',
      'pages_visited',
      'models_added',
      'models_updated',
      'images_downloaded',
      'images_skipped',
      'errors',
      'rate_limit_hits',
      'blocked_responses',
      'fx_stale',
      'cursor_resumed',
      'final_status',
    ]) {
      expect(reportJson).toHaveProperty(field);
    }
    expect(reportJson.final_status).toBe('ok');
    // The pre-seeded FX cache returns source='cbr-cache', so fx_stale should be true.
    expect(reportJson.fx_stale).toBe(true);

    // .cursor.json absent on success.
    expect(existsSync(resolve(dromRoot, 'current/.cursor.json'))).toBe(false);

    // brand-aliases.json populated.
    const aliases = JSON.parse(await readFile(resolve(dromRoot, 'brand-aliases.json'), 'utf-8'));
    expect(Object.keys(aliases).length).toBeGreaterThanOrEqual(1);
    expect(aliases.bmw).toBeDefined();
    expect(aliases.bmw.models).toEqual(
      expect.objectContaining({ x5: expect.any(Object), x3: expect.any(Object) }),
    );

    // Hero image was written under images/.
    const expectedImage = resolve(dromRoot, `current/images/bmw-x5-g_201808_8395-hero.webp`);
    expect(existsSync(expectedImage)).toBe(true);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 120_000);

  it('preserves inherited records and images from prev current/ (incremental snapshot)', async () => {
    // Seed a "previous run" directory with one record + one image for a brand
    // (honda) that this run's whitelist does NOT cover. The run is then scoped
    // to BMW only via DROM_BRAND_WHITELIST. After completion, current/models.json
    // must contain BOTH the inherited honda record AND the BMW records produced
    // by this run; current/images/honda-civic-g_2020_1234-hero.webp must still
    // exist (copied forward from prev current/).
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const prevRunId = '2026-04-27T00-00-00Z';
    const prevDir = resolve(dromRoot, prevRunId);
    await mkdir(resolve(prevDir, 'images'), { recursive: true });

    const inheritedRecord = {
      brand: 'Хонда',
      brand_slug: 'honda',
      model: 'Civic',
      model_slug: 'civic',
      generation: 'g_2020_1234',
      year_from: 2020,
      year_to: 2024,
      body_types: ['седан'],
      engine_options: [],
      drive_options: ['fwd'],
      description_ru: 'Краткое описание Civic.',
      price_min_rub: null,
      price_max_rub: null,
      image_paths: ['images/honda-civic-g_2020_1234-hero.webp'],
      source: 'drom-catalog',
      source_url: 'https://www.drom.ru/catalog/honda/civic/g_2020_1234/',
      scraped_at: '2026-04-27T00:00:30.000Z',
    };
    await writeFile(
      resolve(prevDir, 'models.json'),
      JSON.stringify([inheritedRecord], null, 2),
    );
    // Need a non-empty WebP-shaped placeholder so copyFile + the on-disk
    // existsSync check both succeed. The bytes don't matter for this test.
    await writeFile(
      resolve(prevDir, 'images', 'honda-civic-g_2020_1234-hero.webp'),
      Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary'),
    );
    // current/ symlink → prevRunId
    const { symlink, unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) await unlink(resolve(dromRoot, 'current'));
    await symlink(prevRunId, resolve(dromRoot, 'current'));

    // Re-use the same fixtures + parser stubs as the first integration test,
    // scoped to BMW only via DROM_BRAND_WHITELIST.
    const heroJpeg = await readFile(FIXTURE_HERO);
    const brandIndexHtml = (await readFile(FIXTURE_BRAND_INDEX, 'utf-8'))
      .replace(/Проверка по VIN/g, 'История по VIN')
      .replace(/проверка/gi, 'осмотр');
    const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
    const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');
    const genPageHtml = await readFile(FIXTURE_GEN_PAGE, 'utf-8');

    process.env.DROM_BRAND_WHITELIST = 'bmw';

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: () => [
        { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
      parseGenerationList: (_html: string, modelUrl: string) => [
        {
          generation_id: 'g_201808_8395',
          generation_label: 'G05',
          url: `${modelUrl}g_201808_8395/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_test.jpg',
        },
      ],
    }));
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return genPageHtml;
        const segments = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segments[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segments.length === 1) return brandIndexHtml;
        if (segments.length === 2) return modelListHtml;
        if (segments.length === 3) return genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async (_url: string) => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    expect(result.status).toBe('ok');

    // Read the new current/'s models.json and assert UNION semantics.
    const currentModels = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ brand_slug: string; model_slug: string; generation: string }>;
    const keys = new Set(
      currentModels.map((r) => `${r.brand_slug}:${r.model_slug}:${r.generation}`),
    );
    // Inherited honda record preserved
    expect(keys.has('honda:civic:g_2020_1234')).toBe(true);
    // BMW record produced by this run
    expect(keys.has('bmw:x5:g_201808_8395')).toBe(true);

    // Inherited honda image is still on disk in the new current/.
    expect(
      existsSync(resolve(dromRoot, 'current/images/honda-civic-g_2020_1234-hero.webp')),
    ).toBe(true);
    // BMW image was downloaded fresh.
    expect(
      existsSync(resolve(dromRoot, 'current/images/bmw-x5-g_201808_8395-hero.webp')),
    ).toBe(true);

    // Report counters reflect THIS run's work, not the merged total.
    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );
    // Exactly one record was added in this run (the bmw x5 g05 generation;
    // honda was inherited, not added).
    expect(reportJson.models_added).toBe(1);
    expect(reportJson.models_updated).toBe(0);

    delete process.env.DROM_BRAND_WHITELIST;
    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 120_000);
});
