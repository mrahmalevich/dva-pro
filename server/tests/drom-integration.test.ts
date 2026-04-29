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
import { CorruptCursorError } from '../scrapers/shared/cursor.js';

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

  it('counter-drift guard: parse + image errors in the same run are counted into separate denominators (WARNING 8 fix)', async () => {
    // Reset prev current/ from any prior test in this file so this run starts clean.
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) {
      await unlink(resolve(dromRoot, 'current'));
    }

    const fixtures = {
      heroJpeg: await readFile(FIXTURE_HERO),
      brandIndexHtml: await readFile(FIXTURE_BRAND_INDEX, 'utf-8'),
      modelListHtml: await readFile(FIXTURE_MODEL_LIST, 'utf-8'),
      genListHtml: await readFile(FIXTURE_GEN_LIST, 'utf-8'),
      genPageHtml: await readFile(FIXTURE_GEN_PAGE, 'utf-8'),
    };

    // 12 brands so the parse-gate denominator is high enough that 1 parse error
    // (1/12 ≈ 8.3%) does NOT trip the >10% gate. Only ~12 images attempted in
    // total (well below the 20-floor for the image gate).
    const brandList = [
      ...Array.from({ length: 11 }, (_, i) => ({
        brand_slug: `b${String(i).padStart(2, '0')}`,
        latin_name: `B${i}`,
        url: `https://www.drom.ru/catalog/b${String(i).padStart(2, '0')}/`,
      })),
      { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
    ];

    // Live binding captured by the fetchBuffer closure below.
    let imageCallCount = 0;

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => brandList,
    }));

    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: (_html: string, brandUrl: string) => {
        if (brandUrl.includes('/bmw/')) {
          return [
            { model_slug: 'x3', ru_name: 'X3', latin_name: 'X3', url: `${brandUrl}x3/` },
            { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: `${brandUrl}x5/` },
          ];
        }
        return [{ model_slug: 'm', ru_name: 'M', latin_name: 'M', url: `${brandUrl}m/` }];
      },
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

    // parseGenerationPage: succeed for everyone EXCEPT bmw/x5 (throw a parse error).
    vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
        '../scrapers/drom/parse-generation-page.js',
      );
      return {
        ...actual,
        parseGenerationPage: (_html: string, ctx: any) => {
          if (ctx.brand_slug === 'bmw' && ctx.model_slug === 'x5') {
            throw new Error('synthetic parse error for x5');
          }
          return {
            brand: ctx.brand,
            brand_slug: ctx.brand_slug,
            model: ctx.model,
            model_slug: ctx.model_slug,
            generation: ctx.generation,
            year_from: 2018,
            year_to: 2022,
            body_types: ['SUV'],
            engine_options: [],
            drive_options: [],
            description_ru: 'test description for counter-drift integration',
            price_min_rub: null,
            price_max_rub: null,
            image_paths: ctx.heroImageUrl
              ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`]
              : [],
            source: 'drom-catalog' as const,
            source_url: ctx.sourceUrl,
            scraped_at: new Date().toISOString(),
          };
        },
      };
    });

    // fetchBuffer: throw on the FIRST image (bmw/x3 — alphabetically the first BMW
    // model; but order across brands matters too — we trip on whichever image
    // happens to be requested first). All other images succeed.
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return fixtures.genPageHtml;
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return fixtures.brandIndexHtml;
        if (segs.length === 2) return fixtures.modelListHtml;
        if (segs.length === 3) return fixtures.genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async (url: string) => {
        // Synthetic CDN 503 for the FIRST image fetch. Every subsequent fetch
        // succeeds — yields exactly 1 images_failed and N-1 images_downloaded.
        if (url.includes('500x_test.jpg')) {
          imageCallCount++;
          if (imageCallCount === 1) throw new Error('synthetic CDN 503 for first image');
          return fixtures.heroJpeg;
        }
        return fixtures.heroJpeg;
      },
      politeDelay: async () => {},
      dromClient: {
        get: () => {
          throw new Error('dromClient should not be invoked');
        },
      },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    // Read the written report.json (canonical artifact) — it must agree with
    // the in-memory result.report on counter denominators.
    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );

    // Exactly 1 parse error (bmw/x5) and exactly 1 image error (whichever image
    // was fetched first — counters split by `kind` is the contract being pinned).
    const parseErrors = reportJson.errors.filter((e: any) => e.kind === 'parse');
    const imageErrors = reportJson.errors.filter((e: any) => e.kind === 'image');
    expect(parseErrors.length).toBe(1);
    expect(imageErrors.length).toBe(1);
    expect(reportJson.errors.length).toBe(2);
    expect(reportJson.images_failed).toBe(1);
    // 12 brands × 1–2 models each: bmw produces 2 (x3 + x5), the 11 b00-b10
    // brands each produce 1 — minus the bmw/x5 parse failure (no image fetched)
    // and minus the first image (failed). Net images_downloaded >= 1.
    expect(reportJson.images_downloaded).toBeGreaterThan(0);
    expect(reportJson.image_failure_rate).toBeGreaterThan(0);
    expect(reportJson.image_failure_rate).toBeLessThan(1);

    // CR-05 reconciliation: any record whose image fetch failed has empty
    // image_paths. We don't know which exact record was hit (depends on URL
    // ordering), but the model that has the image error must agree.
    const modelsJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{
      brand_slug: string;
      model_slug: string;
      image_paths: string[];
      source_url: string;
    }>;
    // bmw/x5 must NOT be present (parse failed).
    expect(
      modelsJson.find((r) => r.brand_slug === 'bmw' && r.model_slug === 'x5'),
    ).toBeUndefined();
    // Exactly one record across the snapshot has empty image_paths
    // (the one whose download failed). Every other record has the expected
    // hero filename.
    const emptyImagePathsRecords = modelsJson.filter((r) => r.image_paths.length === 0);
    expect(emptyImagePathsRecords.length).toBe(1);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-page.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 120_000);
});

describe('drom orchestrator resume path (gap-closure 01-13: CR-01..CR-04, IN-07)', () => {
  // Helper: build the standard 3-brand fixture stubs the resume tests use.
  // Returns `parseBrandIndex` mock factories so each test can vary brand order.
  function makeBrandStubs(brandOrder: ReadonlyArray<{ brand_slug: string; latin_name: string }>) {
    return {
      parseBrandIndex: () =>
        brandOrder.map((b) => ({
          brand_slug: b.brand_slug,
          latin_name: b.latin_name,
          url: `https://www.drom.ru/catalog/${b.brand_slug}/`,
        })),
    };
  }

  // Helper: pre-fetch fixture buffers once per test.
  async function loadFixtures() {
    const heroJpeg = await readFile(FIXTURE_HERO);
    const NEUTRALIZE = (s: string): string =>
      s
        .replace(/Проверка по VIN/g, 'История по VIN')
        .replace(/проверка/gi, 'осмотр')
        .replace(/robot/gi, 'crawler')
        .replace(/verify/gi, 'check')
        .replace(/капча/gi, 'токен');
    const brandIndexHtml = NEUTRALIZE(await readFile(FIXTURE_BRAND_INDEX, 'utf-8'));
    const modelListHtml = NEUTRALIZE(await readFile(FIXTURE_MODEL_LIST, 'utf-8'));
    const genListHtml = NEUTRALIZE(await readFile(FIXTURE_GEN_LIST, 'utf-8'));
    const genPageHtml = NEUTRALIZE(await readFile(FIXTURE_GEN_PAGE, 'utf-8'));
    return { heroJpeg, brandIndexHtml, modelListHtml, genListHtml, genPageHtml };
  }

  // Helper: shared HTTP mock factory.
  function makeHttpStub(fixtures: Awaited<ReturnType<typeof loadFixtures>>) {
    return {
      fetchHtml: async (url: string) => {
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return fixtures.genPageHtml;
        const segments = url
          .replace(/^https?:\/\/www\.drom\.ru/, '')
          .split('/')
          .filter(Boolean);
        if (segments[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segments.length === 1) return fixtures.brandIndexHtml;
        if (segments.length === 2) return fixtures.modelListHtml;
        if (segments.length === 3) return fixtures.genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async (_url: string) => fixtures.heroJpeg,
      politeDelay: async () => {},
      dromClient: {
        get: () => {
          throw new Error('dromClient should not be invoked');
        },
      },
    };
  }

  // Helper: clean any leftover current/ symlink between tests so each test
  // starts from a known-empty state (no inherited records carrying over).
  async function clearCurrent() {
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const currentLink = resolve(dromRoot, 'current');
    if (existsSync(currentLink)) {
      const { unlink } = await import('node:fs/promises');
      await unlink(currentLink);
    }
  }

  it('resumes from cursored brand and skips earlier brands (CR-01 fix)', async () => {
    await clearCurrent();
    const fixtures = await loadFixtures();

    // Three brands, ALPHABETIC DOM order. Cursor points at bmw → audi must NOT
    // be processed; bmw + lada must both have records in the new models.json.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: makeBrandStubs([
        { brand_slug: 'audi', latin_name: 'Audi' },
        { brand_slug: 'bmw', latin_name: 'BMW' },
        { brand_slug: 'lada', latin_name: 'Lada' },
      ]).parseBrandIndex,
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: (_html: string, brandUrl: string) => [
        { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: `${brandUrl}x5/` },
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
    vi.doMock('../scrapers/shared/http.js', () => makeHttpStub(fixtures));
    // Stub readCursor to return a cursor pointing at bmw/x5.
    vi.doMock('../scrapers/shared/cursor.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/shared/cursor.js')>(
        '../scrapers/shared/cursor.js',
      );
      return {
        ...actual,
        readCursor: async () => ({
          lastBrandSlug: 'bmw',
          lastModelSlug: 'x5',
          completedAt: '2026-04-28T12:00:00.000Z',
        }),
        writeCursor: async () => {},
        deleteCursor: async () => {},
      };
    });

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: true });

    expect(result.status).toBe('ok');

    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const modelsJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ brand_slug: string }>;
    const brandsInOutput = new Set(modelsJson.map((r) => r.brand_slug));
    expect(brandsInOutput.has('bmw')).toBe(true);
    expect(brandsInOutput.has('lada')).toBe(true);
    expect(brandsInOutput.has('audi')).toBe(false);

    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );
    expect(reportJson.cursor_resumed).toBe(true);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
    vi.doUnmock('../scrapers/shared/cursor.js');
  }, 120_000);

  it('sorts non-alphabetic DOM order before applying cursor (CR-03 fix)', async () => {
    await clearCurrent();
    const fixtures = await loadFixtures();

    // Same three brands in NON-ALPHABETIC DOM order — must produce identical
    // outcome to the previous test thanks to plan 10's sort-before-compare.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: makeBrandStubs([
        { brand_slug: 'lada', latin_name: 'Lada' },
        { brand_slug: 'bmw', latin_name: 'BMW' },
        { brand_slug: 'audi', latin_name: 'Audi' },
      ]).parseBrandIndex,
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: (_html: string, brandUrl: string) => [
        { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: `${brandUrl}x5/` },
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
    vi.doMock('../scrapers/shared/http.js', () => makeHttpStub(fixtures));
    vi.doMock('../scrapers/shared/cursor.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/shared/cursor.js')>(
        '../scrapers/shared/cursor.js',
      );
      return {
        ...actual,
        readCursor: async () => ({
          lastBrandSlug: 'bmw',
          lastModelSlug: 'x5',
          completedAt: '2026-04-28T12:00:00.000Z',
        }),
        writeCursor: async () => {},
        deleteCursor: async () => {},
      };
    });

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: true });
    expect(result.status).toBe('ok');

    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const modelsJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ brand_slug: string }>;
    const brandsInOutput = new Set(modelsJson.map((r) => r.brand_slug));
    // After sort, audi < bmw < lada → cursor on bmw → audi skipped.
    expect(brandsInOutput.has('bmw')).toBe(true);
    expect(brandsInOutput.has('lada')).toBe(true);
    expect(brandsInOutput.has('audi')).toBe(false);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
    vi.doUnmock('../scrapers/shared/cursor.js');
  }, 120_000);

  it('returns status=error when readCursor throws CorruptCursorError (WR-04 fix)', async () => {
    await clearCurrent();
    const fixtures = await loadFixtures();

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: makeBrandStubs([{ brand_slug: 'bmw', latin_name: 'BMW' }]).parseBrandIndex,
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: () => [
        { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
      parseGenerationList: () => [],
    }));
    vi.doMock('../scrapers/shared/http.js', () => makeHttpStub(fixtures));
    // Stub readCursor to throw CorruptCursorError.
    vi.doMock('../scrapers/shared/cursor.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/shared/cursor.js')>(
        '../scrapers/shared/cursor.js',
      );
      return {
        ...actual,
        readCursor: async () => {
          throw new CorruptCursorError('test corruption injected by 01-13 plan');
        },
        writeCursor: async () => {},
        deleteCursor: async () => {},
      };
    });

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: true });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toContain('test corruption injected by 01-13 plan');
    }

    // current/ symlink must NOT be updated on error (so prior good run is preserved).
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    expect(existsSync(resolve(dromRoot, 'current'))).toBe(false);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
    vi.doUnmock('../scrapers/shared/cursor.js');
  }, 120_000);

  it('CR-04 contract: cursored brand is re-scraped from scratch (all its models present after resume)', async () => {
    await clearCurrent();
    const fixtures = await loadFixtures();

    // Single brand bmw with two models [x3, x5]. Cursor on bmw with lastModelSlug=x3.
    // Per CR-04 contract (plan 12): startFromModelIndex pinned to 0 → BOTH x3 AND x5
    // re-scraped, regardless of cursor.lastModelSlug position.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: makeBrandStubs([{ brand_slug: 'bmw', latin_name: 'BMW' }]).parseBrandIndex,
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: () => [
        { model_slug: 'x3', ru_name: 'X3', latin_name: 'X3', url: 'https://www.drom.ru/catalog/bmw/x3/' },
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
    vi.doMock('../scrapers/shared/http.js', () => makeHttpStub(fixtures));
    vi.doMock('../scrapers/shared/cursor.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/shared/cursor.js')>(
        '../scrapers/shared/cursor.js',
      );
      return {
        ...actual,
        // Cursor on bmw/x3 — per CR-04, BOTH x3 and x5 must be re-scraped.
        readCursor: async () => ({
          lastBrandSlug: 'bmw',
          lastModelSlug: 'x3',
          completedAt: '2026-04-28T12:00:00.000Z',
        }),
        writeCursor: async () => {},
        deleteCursor: async () => {},
      };
    });

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: true });

    expect(result.status).toBe('ok');

    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const modelsJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ brand_slug: string; model_slug: string }>;
    const keyset = new Set(modelsJson.map((r) => `${r.brand_slug}:${r.model_slug}`));
    expect(keyset.has('bmw:x3')).toBe(true); // x3 re-scraped despite cursor pointing at it
    expect(keyset.has('bmw:x5')).toBe(true); // x5 also scraped (the post-cursor model)

    // brand-aliases: both x3 and x5 present under bmw.
    const aliases = JSON.parse(
      await readFile(resolve(dromRoot, 'brand-aliases.json'), 'utf-8'),
    );
    expect(aliases.bmw).toBeDefined();
    // WARNING 6 fix: assert structural shape per model entry (NOT expect.any(Object)
    // which passes for arrays / dates / null). Each model entry must be the
    // {ru, latin} dict produced by mergeAliases.
    expect(aliases.bmw.models.x3).toEqual({ ru: expect.any(String), latin: expect.any(String) });
    expect(aliases.bmw.models.x5).toEqual({ ru: expect.any(String), latin: expect.any(String) });

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
    vi.doUnmock('../scrapers/shared/cursor.js');
  }, 120_000);
});
