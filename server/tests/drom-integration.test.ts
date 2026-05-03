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
import { existsSync, readlinkSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CorruptCursorError } from '../scrapers/shared/cursor.js';

const FIXTURE_BRAND_INDEX = resolve('server/tests/fixtures/drom/brand-index.html');
const FIXTURE_MODEL_LIST = resolve('server/tests/fixtures/drom/model-list.bmw.html');
const FIXTURE_GEN_LIST = resolve('server/tests/fixtures/drom/generation-list.bmw.x5.html');
const FIXTURE_GEN_PAGE = resolve('server/tests/fixtures/drom/generation.bmw.x5.g05.html');
const FIXTURE_HERO = resolve('server/tests/fixtures/images/hero.jpg');
// Phase 01.1 per-comp fixtures — resolved at module load time (before cwd spy installs).
const FIXTURE_COMP_207354 = resolve('server/tests/fixtures/drom/complectation/207354.html');

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

  it('cross-invocation cursor flow: cursor written by run N is read by run N+1 (BLOCKER 1 fix, plan 01-16)', async () => {
    // Reset any prior current/ symlink from earlier tests in this file so the
    // first run below starts from a clean state (no inherited records).
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) {
      await unlink(resolve(dromRoot, 'current'));
    }
    // Also delete any stale .cursor.json from prior tests — the BLOCKER 1 fix
    // means the cursor file lives at the brand-root path; failing to clear it
    // would let prior-test state leak into run #1.
    const cursorPath = resolve(dromRoot, '.cursor.json');
    if (existsSync(cursorPath)) await unlink(cursorPath);

    const fixtures = {
      heroJpeg: await readFile(FIXTURE_HERO),
      brandIndexHtml: await readFile(FIXTURE_BRAND_INDEX, 'utf-8'),
      modelListHtml: await readFile(FIXTURE_MODEL_LIST, 'utf-8'),
      genListHtml: await readFile(FIXTURE_GEN_LIST, 'utf-8'),
      genPageHtml: await readFile(FIXTURE_GEN_PAGE, 'utf-8'),
    };

    // Single brand bmw with two models [x3, x5]. Run #1 succeeds for x3 and
    // throws for x5's generation page (synthetic mid-run crash). The cursor
    // written after x3 completes must persist at the brand-root path so run
    // #2 (resume:true) can pick it up.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: (_html: string, brandUrl: string) => [
        { model_slug: 'x3', ru_name: 'X3', latin_name: 'X3', url: `${brandUrl}x3/` },
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

    // phase=1: throw on the x5 generation page fetch (mid-run crash).
    // phase=2: every fetch succeeds (run #2 resumes cleanly).
    let phase = 1;
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        if (phase === 1 && /\/x5\/g_/.test(url)) {
          throw new Error('synthetic mid-run crash on x5');
        }
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return fixtures.genPageHtml;
        const segs = url
          .replace(/^https?:\/\/www\.drom\.ru/, '')
          .split('/')
          .filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return fixtures.brandIndexHtml;
        if (segs.length === 2) return fixtures.modelListHtml;
        if (segs.length === 3) return fixtures.genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async () => fixtures.heroJpeg,
      politeDelay: async () => {},
      dromClient: {
        get: () => {
          throw new Error('dromClient should not be invoked');
        },
      },
    }));

    vi.resetModules();
    const { drom: dromRun1 } = await import('../scrapers/drom/index.js');
    const result1 = await dromRun1.run({ resume: false });
    expect(result1.status).toBe('error');

    // BLOCKER 1 fix verification: the cursor file lives at the brand-root path,
    // NOT inside any per-run dir. This is what makes cross-invocation resume
    // work — run N+1 reads the same path run N wrote to.
    expect(existsSync(cursorPath)).toBe(true);
    const cursorRaw = await readFile(cursorPath, 'utf-8');
    const cursorData = JSON.parse(cursorRaw);
    expect(cursorData.lastBrandSlug).toBe('bmw');
    // x3 completed before x5 crashed → cursor records x3 as the last completed model.
    expect(cursorData.lastModelSlug).toBe('x3');

    // Run #2: phase=2 disables the synthetic crash. Resume must read the
    // cursor from the brand-root path. CR-04 contract (plan 01-12) re-scrapes
    // the cursored brand from scratch, so both x3 and x5 succeed cleanly.
    phase = 2;
    vi.resetModules();
    const { drom: dromRun2 } = await import('../scrapers/drom/index.js');
    const result2 = await dromRun2.run({ resume: true });
    expect(result2.status).toBe('ok');
    if (result2.status === 'ok') {
      expect(result2.report.cursor_resumed).toBe(true);
    }

    // After clean completion, the cursor at the brand-root path is deleted.
    expect(existsSync(cursorPath)).toBe(false);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 180_000);
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

// ---------------------------------------------------------------------------
// Phase 01.1 Plan 07: BMW pilot per-comp integration tests (R-4, R-6, R-7)
// ---------------------------------------------------------------------------
//
// Strategy: use the same shared workDir, beforeAll/afterAll as the tests above.
// Re-use existing mock helpers. Per-comp URLs are those matching
// /catalog/bmw/<model>/<digits>/ (4 path segments under /catalog/).
// The BMW G05 generation fixture has 33 trim rows; mocked fetchHtml routes
// those URLs to appropriate fixture HTML.
//
// Key fixture constants:
//   BMW_COMP_RICH_HTML   — server/tests/fixtures/drom/complectation/207354.html
//                          Real BMW X5 G05 xDrive 30d AT Base fixture.
//                          All 6 groups extractable → coverage gate passes.
//   BMW_AUDI_GEN_HTML    — minimal HTML with no comp links (0 trim rows returned
//                          by extractTrimRows for audi/x5 slug)

describe('Phase 01.1: BMW pilot per-comp integration (R-4, R-6, R-7)', () => {
  // Helper: neutralize block-detection keywords (same as first test in suite).
  function neutralize(s: string): string {
    return s
      .replace(/Проверка по VIN/g, 'История по VIN')
      .replace(/проверка/gi, 'осмотр')
      .replace(/robot/gi, 'crawler')
      .replace(/verify/gi, 'check')
      .replace(/капча/gi, 'токен');
  }

  // Helper: clear current/ symlink between tests so each starts from a clean state.
  async function clearCurrentAndCursor() {
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const currentLink = resolve(dromRoot, 'current');
    const cursorFile = resolve(dromRoot, '.cursor.json');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(currentLink)) await unlink(currentLink);
    if (existsSync(cursorFile)) await unlink(cursorFile);
  }

  // R-4: BMW filter — orchestrator fetches per-comp pages ONLY for bmw,
  // skips other brands (verifies BMW_PILOT_BRANDS.has() gate).
  it('R-4: BMW filter — orchestrator fetches per-comp pages ONLY for bmw, skips other brands', async () => {
    await clearCurrentAndCursor();

    const heroJpeg = await readFile(FIXTURE_HERO);
    const bmwGenHtml = neutralize(readFileSync(FIXTURE_GEN_PAGE, 'utf-8'));
    // Minimal gen-page HTML for audi: has no comp table → extractTrimRows returns 0 rows.
    const audiGenHtml = '<html><body><h1>Audi A6 2020</h1></body></html>';
    const genListHtml = neutralize(readFileSync(FIXTURE_GEN_LIST, 'utf-8'));

    // Track every URL that fetchHtml is called with.
    const fetchedUrls: string[] = [];

    // Two brands: bmw and audi, each with 1 model and 1 generation.
    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'audi', latin_name: 'Audi', url: 'https://www.drom.ru/catalog/audi/' },
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: (_html: string, brandUrl: string) => {
        if (brandUrl.includes('/bmw/')) {
          return [{ model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: `${brandUrl}x5/` }];
        }
        return [{ model_slug: 'a6', ru_name: 'A6', latin_name: 'A6', url: `${brandUrl}a6/` }];
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
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        fetchedUrls.push(url);
        // Per-comp URLs: /catalog/<brand>/<model>/<digits>/ — 4 segments under /catalog/
        const perCompMatch = url.match(/\/catalog\/(bmw|audi)\/[^/]+\/(\d+)\/?$/);
        if (perCompMatch) {
          // Do NOT return anything for per-comp pages — let them throw so we get
          // orchestrator-kind errors. This is enough to verify R-4 (the filter).
          throw new Error(`Stub: per-comp URL not handled in R-4 test: ${url}`);
        }
        // Generation pages (gen_id-shaped URLs)
        if (/g_\d{4,6}_\d+\/?$/.test(url)) {
          return url.includes('/audi/') ? audiGenHtml : bmwGenHtml;
        }
        // Brand + model list pages
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return '<html><body></body></html>'; // brand index (mocked out)
        if (segs.length === 2) return '<html><body></body></html>'; // model list (mocked out)
        if (segs.length === 3) return genListHtml;                   // gen list
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async () => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    // The run should complete (ok or error); what matters is URL filtering.
    // R-4 acceptance: audi per-comp URLs were NEVER fetched.
    const audiCompUrls = fetchedUrls.filter((u) => u.match(/\/catalog\/audi\/[^/]+\/\d+\/?$/));
    expect(audiCompUrls).toHaveLength(0);

    // BMW per-comp URLs WERE attempted (extractTrimRows returns 33 rows from G05 fixture).
    const bmwCompUrls = fetchedUrls.filter((u) => u.match(/\/catalog\/bmw\/[^/]+\/\d+\/?$/));
    expect(bmwCompUrls.length).toBeGreaterThanOrEqual(1);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 120_000);

  // R-6: per-comp fetch failures push to report.errors (kind:'orchestrator') but
  // the run continues and final_status remains 'ok'. The per-comp fail-soft contract
  // (SPEC R-6 / RESEARCH.md §Pitfall 1 inversion) means the 10% parse-error gate
  // is not triggered by per-comp failures, and the coverage gate is skipped when
  // no complectations were successfully parsed.
  it('R-6: per-comp fetch failures push to report.errors but final_status remains ok', async () => {
    await clearCurrentAndCursor();

    const heroJpeg = await readFile(FIXTURE_HERO);
    const bmwGenHtml = neutralize(readFileSync(FIXTURE_GEN_PAGE, 'utf-8'));
    const genListHtml = neutralize(readFileSync(FIXTURE_GEN_LIST, 'utf-8'));

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
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
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        // All per-comp URLs throw a fetch error — simulating network/server failure.
        // The orchestrator should handle this as kind:'orchestrator' and continue.
        if (url.match(/\/catalog\/bmw\/x5\/\d+\/?$/)) {
          throw new Error('Synthetic per-comp fetch failure');
        }
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return bmwGenHtml;
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return '<html><body></body></html>'; // brand index
        if (segs.length === 2) return '<html><body></body></html>'; // model list
        if (segs.length === 3) return genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async () => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    // R-6 contract: per-comp failures do NOT abort the run.
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.report.final_status).toBe('ok');
    // Errors from per-comp fetch failures are pushed as kind:'orchestrator'
    // so they do not trip the 10% parse-error DOM-regression gate.
    const compErrors = result.report.errors.filter(
      (e) => e.kind === 'orchestrator' && e.message.startsWith('complectation-fetch:'),
    );
    expect(compErrors.length).toBeGreaterThan(0);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 120_000);

  // R-7 (success): report.field_coverage emitted after a BMW run that parses
  // real per-comp HTML; meetsCoverageGate=true → final_status='ok'.
  it('R-7: report.field_coverage emitted; meetsCoverageGate=true → final_status ok', async () => {
    await clearCurrentAndCursor();

    const heroJpeg = await readFile(FIXTURE_HERO);
    const bmwGenHtml = neutralize(readFileSync(FIXTURE_GEN_PAGE, 'utf-8'));
    const genListHtml = neutralize(readFileSync(FIXTURE_GEN_LIST, 'utf-8'));
    // Real BMW X5 per-comp fixture (all 6 groups parseable → coverage ≥ 0.70).
    // Use module-level constant resolved before cwd spy installs (avoids ENOENT in tmpdir).
    const compRichHtml = readFileSync(FIXTURE_COMP_207354, 'utf-8');

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
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
    // Phase 01.2 Plan 04: wrap parseComplectationPage to inject realistic
    // chassis + features values so the new chassis ≥ 0.30 and
    // features_density ≥ 50 floors pass. The real parser (Plan 02) will
    // populate these from fixture HTML directly — until then we simulate
    // its post-extraction shape so this integration test isolates Plan 04
    // floor-tightening from Plan 02 parser work running in a parallel
    // worktree.
    vi.doMock('../scrapers/drom/parse-complectation-page.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/drom/parse-complectation-page.js')>(
        '../scrapers/drom/parse-complectation-page.js',
      );
      return {
        ...actual,
        parseComplectationPage: (...args: Parameters<typeof actual.parseComplectationPage>) => {
          const comp = actual.parseComplectationPage(...args);
          return {
            ...comp,
            chassis: {
              suspension_front: 'независимая, многорычажная',
              suspension_rear: 'независимая, многорычажная',
              brakes_front: 'дисковые вентилируемые',
              brakes_rear: 'дисковые вентилируемые',
              steering_type: 'реечный, с гидроусилителем',
            },
            // 60 features ≥ 50 floor; well above the floor and well below
            // typical drom comp counts (~150 features on G05).
            features: Array.from({ length: 60 }, (_, i) => ({
              section: 'Комфорт',
              subsection: null,
              label: 'feature_' + i,
              value: true as const,
            })),
          };
        },
      };
    });
    // Mock extractTrimRows to return 2 controlled trim rows with ALL pricing fields
    // populated. Pricing data comes from trimRow context (not per-comp HTML), so without
    // this mock the pricing coverage would reflect the actual G05 fixture trim table —
    // many rows have null price_used_from_rub, dropping pricing coverage below 0.70.
    vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
        '../scrapers/drom/parse-generation-page.js',
      );
      return {
        ...actual,
        extractTrimRows: (_html: string, ctx: any) => [
          {
            comp_id: '207354',
            url: `https://www.drom.ru/catalog/${ctx.brand_slug}/${ctx.model_slug}/207354/`,
            name: 'xDrive 30d Base',
            period_from: '06.2018',
            period_to: '03.2022',
            tier: 'Базовая' as const,
            engine_code: 'G05',
            frame_code: null,
            price_new_rub: 7190000,
            price_used_from_rub: 4500000,
            engine_cc: 2993,
            engine_hp: 249,
            engine_fuel: 'diesel' as const,
            drive: '4WD',
          },
          {
            comp_id: '207355',
            url: `https://www.drom.ru/catalog/${ctx.brand_slug}/${ctx.model_slug}/207355/`,
            name: 'xDrive 40i M Sport',
            period_from: '06.2018',
            period_to: '03.2022',
            tier: 'Максимальная' as const,
            engine_code: 'G05',
            frame_code: null,
            price_new_rub: 9500000,
            price_used_from_rub: 6200000,
            engine_cc: 2998,
            engine_hp: 340,
            engine_fuel: 'gas' as const,
            drive: '4WD',
          },
        ],
      };
    });
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        // Per-comp pages: return the real BMW X5 fixture so all groups parse successfully.
        if (url.match(/\/catalog\/bmw\/x5\/\d+\/?$/)) return compRichHtml;
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return bmwGenHtml;
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return '<html><body></body></html>'; // brand index
        if (segs.length === 2) return '<html><body></body></html>'; // model list
        if (segs.length === 3) return genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async () => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    if (result.status === 'error') {
      // eslint-disable-next-line no-console
      console.error('[R-7 success] drom.run returned error:', result.error.message);
    }
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.report.final_status).toBe('ok');
    // R-7: field_coverage must be emitted and shaped correctly.
    // Phase 01.2 added `chassis` (0..1 rate) and `features_density` (mean count, ≥ 0).
    expect(result.report.field_coverage).toBeDefined();
    expect(Object.keys(result.report.field_coverage!).sort()).toEqual(
      ['chassis', 'comfort', 'dimensions', 'drivetrain', 'features_density', 'identity', 'pricing', 'tires'],
    );
    // All 0..1 group rates must be numbers in [0, 1]; features_density is unbounded ≥ 0.
    const RATE_GROUPS = ['identity', 'pricing', 'drivetrain', 'dimensions', 'chassis', 'comfort', 'tires'] as const;
    for (const group of RATE_GROUPS) {
      const rate = result.report.field_coverage![group];
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    }
    expect(result.report.field_coverage!.features_density).toBeGreaterThanOrEqual(0);
    // With controlled trim rows (all pricing populated) + real 207354.html fixture,
    // all LEGACY groups must meet the 0.70 threshold (gate passes → final_status=ok).
    // Phase 01.2 Plan 04: chassis ≥ 0.30 and features_density ≥ 50 are also enforced
    // (parser-mock injects 5/5 chassis leaves + 60 features per comp → both pass).
    const LEGACY_GROUPS_WITH_THRESHOLD = ['identity', 'drivetrain', 'dimensions', 'comfort', 'tires'] as const;
    for (const group of LEGACY_GROUPS_WITH_THRESHOLD) {
      const rate = result.report.field_coverage![group];
      expect(rate, `group '${group}' coverage`).toBeGreaterThanOrEqual(0.70);
    }
    expect(result.report.field_coverage!.chassis, 'chassis coverage').toBeGreaterThanOrEqual(0.30);
    expect(result.report.field_coverage!.features_density, 'features_density').toBeGreaterThanOrEqual(50);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-page.js');
    vi.doUnmock('../scrapers/drom/parse-complectation-page.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 180_000);

  // R-7 (gate failure): when per-comp pages return empty HTML, all groups score 0%
  // → meetsCoverageGate=false → orchestrator throws → final_status='error'.
  it('R-7: meetsCoverageGate=false → orchestrator throws; final_status=error with diagnostic message', async () => {
    await clearCurrentAndCursor();

    const heroJpeg = await readFile(FIXTURE_HERO);
    const bmwGenHtml = neutralize(readFileSync(FIXTURE_GEN_PAGE, 'utf-8'));
    const genListHtml = neutralize(readFileSync(FIXTURE_GEN_LIST, 'utf-8'));
    // Empty per-comp body: identity still comes from trimRow context (always non-null),
    // but dimensions/comfort/tires all-null → fails 0.70 gate on multiple groups.
    const compEmptyHtml = '<html><body></body></html>';

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
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
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        // Per-comp pages: return empty HTML → all-null groups (dimensions/comfort/tires fail).
        if (url.match(/\/catalog\/bmw\/x5\/\d+\/?$/)) return compEmptyHtml;
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return bmwGenHtml;
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return '<html><body></body></html>'; // brand index
        if (segs.length === 2) return '<html><body></body></html>'; // model list
        if (segs.length === 3) return genListHtml;
        throw new Error(`Unexpected URL: ${url}`);
      },
      fetchBuffer: async () => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    // R-7 gate failure: run must return 'error' because coverage is below 0.70.
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    // Diagnostic message names the failing groups and rates.
    expect(result.error.message).toMatch(/coverage gate failed/i);

    vi.doUnmock('../scrapers/drom/parse-brand-index.js');
    vi.doUnmock('../scrapers/drom/parse-model-list.js');
    vi.doUnmock('../scrapers/drom/parse-generation-list.js');
    vi.doUnmock('../scrapers/shared/http.js');
  }, 180_000);
});

describe('drom orchestrator filters: DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR (260501-koe)', () => {
  it('DROM_MODEL_WHITELIST=x5 against multi-model brand → only x5 model is processed', async () => {
    const heroJpeg = await readFile(FIXTURE_HERO);
    const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
    const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
    const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');
    const genPageHtml = await readFile(FIXTURE_GEN_PAGE, 'utf-8');

    process.env.DROM_BRAND_WHITELIST = 'bmw';
    process.env.DROM_MODEL_WHITELIST = 'x5';

    // Reset prev current/ so this test is isolated from earlier tests.
    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) {
      await unlink(resolve(dromRoot, 'current'));
    }

    vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
      parseBrandIndex: () => [
        { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
      parseModelList: () => [
        { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
        { model_slug: '3-series', ru_name: '3 серии', latin_name: '3-Series', url: 'https://www.drom.ru/catalog/bmw/3-series/' },
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

    const fetchedUrls: string[] = [];
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        fetchedUrls.push(url);
        if (/g_\d{4,6}_\d+\/?$/.test(url)) return genPageHtml;
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return brandIndexHtml;
        if (segs.length === 2) return modelListHtml;
        if (segs.length === 3) return genListHtml;
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
    // No URL under /catalog/bmw/3-series/ should have been fetched —
    // the model whitelist filtered it out before the model loop iterated.
    expect(fetchedUrls.some((u) => u.includes('/catalog/bmw/3-series/'))).toBe(false);
    // The x5 model-list page IS reached (it survived the whitelist).
    expect(fetchedUrls.some((u) => u.includes('/catalog/bmw/x5/'))).toBe(true);

    const models = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ model_slug: string }>;
    expect(models.length).toBe(1);
    expect(models[0].model_slug).toBe('x5');

    delete process.env.DROM_BRAND_WHITELIST;
    delete process.env.DROM_MODEL_WHITELIST;
  }, 60_000);

  it('DROM_MIN_PRODUCTION_YEAR=2018: year_to=2017 dropped, year_to=2018 kept (inclusive boundary)', async () => {
    const heroJpeg = await readFile(FIXTURE_HERO);
    const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
    const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
    const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');

    process.env.DROM_BRAND_WHITELIST = 'bmw';
    process.env.DROM_MIN_PRODUCTION_YEAR = '2018';

    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) {
      await unlink(resolve(dromRoot, 'current'));
    }

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
          generation_id: 'g_2017_old',
          generation_label: 'OLD',
          url: `${modelUrl}g_2017_old/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_old.jpg',
        },
        {
          generation_id: 'g_2018_new',
          generation_label: 'NEW',
          url: `${modelUrl}g_2018_new/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_new.jpg',
        },
      ],
    }));
    // Stub parseGenerationPage so we can pin year_to per generation_id.
    vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
        '../scrapers/drom/parse-generation-page.js',
      );
      return {
        ...actual,
        parseGenerationPage: (_html: string, ctx: import('../scrapers/drom/parse-generation-page.js').GenerationPageContext) => {
          const yearTo = ctx.generation === 'g_2017_old' ? 2017 : 2018;
          return {
            brand: ctx.brand,
            brand_slug: ctx.brand_slug,
            model: ctx.model,
            model_slug: ctx.model_slug,
            generation: ctx.generation,
            year_from: yearTo - 5,
            year_to: yearTo,
            body_types: ['джип'],
            engine_options: [{ cc: 3000, hp: 249, fuel: 'diesel' as const }],
            drive_options: ['AWD'],
            description_ru: `stub description for ${ctx.generation}`,
            price_min_rub: 5000000,
            price_max_rub: 6000000,
            image_paths: ctx.heroImageUrl ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
            source: 'drom-catalog' as const,
            source_url: ctx.sourceUrl,
            scraped_at: new Date().toISOString(),
            complectations: [],
          };
        },
      };
    });
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return brandIndexHtml;
        if (segs.length === 2) return modelListHtml;
        if (segs.length === 3) return genListHtml;
        return '<html></html>'; // gen pages — content irrelevant, parser is stubbed
      },
      fetchBuffer: async (_url: string) => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    expect(result.status).toBe('ok');

    const models = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ generation: string; year_to: number | null }>;
    const generations = models.map((m) => m.generation);
    expect(generations).toContain('g_2018_new');     // inclusive boundary kept
    expect(generations).not.toContain('g_2017_old'); // strictly below cutoff dropped
    expect(models.length).toBe(1);

    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );
    expect(reportJson.models_added).toBe(1); // only the kept generation counts

    delete process.env.DROM_BRAND_WHITELIST;
    delete process.env.DROM_MIN_PRODUCTION_YEAR;
  }, 60_000);

  it('DROM_MIN_PRODUCTION_YEAR set: year_to=null (still in production) is always kept', async () => {
    const heroJpeg = await readFile(FIXTURE_HERO);
    const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
    const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
    const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');

    process.env.DROM_BRAND_WHITELIST = 'bmw';
    process.env.DROM_MIN_PRODUCTION_YEAR = '2030'; // deliberately high

    const dromRoot = resolve(workDir, 'data/scraped/drom');
    const { unlink } = await import('node:fs/promises');
    if (existsSync(resolve(dromRoot, 'current'))) {
      await unlink(resolve(dromRoot, 'current'));
    }

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
          generation_id: 'g_2020_inprod',
          generation_label: 'IN-PROD',
          url: `${modelUrl}g_2020_inprod/`,
          hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_inprod.jpg',
        },
      ],
    }));
    vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
      const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
        '../scrapers/drom/parse-generation-page.js',
      );
      return {
        ...actual,
        parseGenerationPage: (_html: string, ctx: import('../scrapers/drom/parse-generation-page.js').GenerationPageContext) => ({
          brand: ctx.brand,
          brand_slug: ctx.brand_slug,
          model: ctx.model,
          model_slug: ctx.model_slug,
          generation: ctx.generation,
          year_from: 2020,
          year_to: null, // still in production ("н.в.")
          body_types: ['джип'],
          engine_options: [{ cc: 3000, hp: 249, fuel: 'diesel' as const }],
          drive_options: ['AWD'],
          description_ru: 'stub description in-production',
          price_min_rub: 5000000,
          price_max_rub: 6000000,
          image_paths: ctx.heroImageUrl ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
          source: 'drom-catalog' as const,
          source_url: ctx.sourceUrl,
          scraped_at: new Date().toISOString(),
          complectations: [],
        }),
      };
    });
    vi.doMock('../scrapers/shared/http.js', () => ({
      fetchHtml: async (url: string) => {
        const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
        if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
        if (segs.length === 1) return brandIndexHtml;
        if (segs.length === 2) return modelListHtml;
        if (segs.length === 3) return genListHtml;
        return '<html></html>';
      },
      fetchBuffer: async (_url: string) => heroJpeg,
      politeDelay: async () => {},
      dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
    }));

    vi.resetModules();
    const { drom } = await import('../scrapers/drom/index.js');
    const result = await drom.run({ resume: false });

    expect(result.status).toBe('ok');

    const models = JSON.parse(
      await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
    ) as Array<{ generation: string; year_to: number | null }>;
    expect(models.length).toBe(1);
    expect(models[0].generation).toBe('g_2020_inprod');
    expect(models[0].year_to).toBeNull();

    const reportJson = JSON.parse(
      await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
    );
    expect(reportJson.models_added).toBe(1);

    delete process.env.DROM_BRAND_WHITELIST;
    delete process.env.DROM_MIN_PRODUCTION_YEAR;
  }, 60_000);
});
