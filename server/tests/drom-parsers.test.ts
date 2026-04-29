// server/tests/drom-parsers.test.ts
//
// Plan 01-07 Wave 4 — drom DOM parsers fixture-driven unit tests.
// Each test reads a sanitized fixture (committed under server/tests/fixtures/drom/)
// and asserts the parser produces a populated, contract-shaped result.
//
// Pitfall 1 mitigation (RESEARCH.md lines 798-806): the parseGenerationPage test
// asserts non-empty body_types AND non-empty engine_options AND populated description_ru,
// because zod validation alone would not catch a regression that yields all-empty arrays.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseBrandIndex } from '../scrapers/drom/parse-brand-index.js';
import { parseModelList } from '../scrapers/drom/parse-model-list.js';
import { parseGenerationList } from '../scrapers/drom/parse-generation-list.js';
import {
  parseGenerationPage,
  extractHeroImageUrl,
} from '../scrapers/drom/parse-generation-page.js';
import { ModelRecord } from '../scrapers/shared/types.js';

const fix = (rel: string) => readFileSync(resolve('server/tests/fixtures/drom', rel), 'utf-8');

describe('parseBrandIndex (SCRAPE-05)', () => {
  it('extracts >= 30 brand refs from sanitized brand index', () => {
    const brands = parseBrandIndex(fix('brand-index.html'));
    expect(brands.length).toBeGreaterThanOrEqual(30);
    expect(brands.find((b) => b.brand_slug === 'bmw')).toBeTruthy();
  });

  it('skips the /catalog/all/ aggregator link', () => {
    const brands = parseBrandIndex(fix('brand-index.html'));
    expect(brands.find((b) => b.brand_slug === 'all')).toBeUndefined();
  });

  it('produces fully-formed BrandRef shape', () => {
    const brands = parseBrandIndex(fix('brand-index.html'));
    const audi = brands.find((b) => b.brand_slug === 'audi');
    expect(audi).toBeDefined();
    expect(audi).toEqual(
      expect.objectContaining({
        brand_slug: 'audi',
        latin_name: expect.any(String),
        url: expect.stringMatching(/^https:\/\/www\.drom\.ru\/catalog\/audi\/$/),
      }),
    );
    // latin_name should be non-empty (defensive: at minimum, the slug is used as fallback)
    expect(audi!.latin_name.length).toBeGreaterThan(0);
  });

  it('deduplicates anchors that appear multiple times on the page', () => {
    const brands = parseBrandIndex(fix('brand-index.html'));
    const slugs = brands.map((b) => b.brand_slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('parseModelList (SCRAPE-05) — BMW', () => {
  it('extracts >= 10 BMW models from sanitized model list', () => {
    const models = parseModelList(fix('model-list.bmw.html'), 'https://www.drom.ru/catalog/bmw/');
    expect(models.length).toBeGreaterThanOrEqual(10);
    expect(models.find((m) => m.model_slug === 'x5')).toBeTruthy();
  });

  it('produces ModelRef with model_slug + latin_name + url', () => {
    const models = parseModelList(fix('model-list.bmw.html'), 'https://www.drom.ru/catalog/bmw/');
    const x5 = models.find((m) => m.model_slug === 'x5');
    expect(x5).toBeDefined();
    expect(x5!.url).toMatch(/\/catalog\/bmw\/x5\/$/);
    expect(x5!.latin_name.length).toBeGreaterThan(0);
  });

  it('skips /catalog/bmw/all/ and /year_*/ aggregators (defensive even if absent)', () => {
    const models = parseModelList(fix('model-list.bmw.html'), 'https://www.drom.ru/catalog/bmw/');
    expect(models.find((m) => m.model_slug === 'all')).toBeUndefined();
    expect(models.find((m) => m.model_slug.startsWith('year_'))).toBeUndefined();
  });

  it('returns empty array if brandUrl is malformed', () => {
    const models = parseModelList(fix('model-list.bmw.html'), 'https://example.com/not-a-catalog');
    expect(models).toEqual([]);
  });
});

describe('parseGenerationList (SCRAPE-05) — BMW X5', () => {
  it('extracts >= 4 generations matching g_<year>_<id>', () => {
    const gens = parseGenerationList(
      fix('generation-list.bmw.x5.html'),
      'https://www.drom.ru/catalog/bmw/x5/',
    );
    expect(gens.length).toBeGreaterThanOrEqual(4);
    for (const g of gens) {
      expect(g.generation_id).toMatch(/^g_\d{4,6}_\d+$/);
      expect(g.url).toMatch(/^https:\/\/www\.drom\.ru\/catalog\/bmw\/x5\/g_\d{4,6}_\d+\/$/);
    }
  });

  it('handles the YYYYMM 6-digit form (BMW X5 G05 = g_201808_8395)', () => {
    const gens = parseGenerationList(
      fix('generation-list.bmw.x5.html'),
      'https://www.drom.ru/catalog/bmw/x5/',
    );
    const g05 = gens.find((g) => g.generation_id === 'g_201808_8395');
    expect(g05).toBeDefined();
  });
});

describe('parseGenerationPage (SCRAPE-05, D-10) — BMW X5 G05', () => {
  const ctx = {
    brand: 'BMW',
    brand_slug: 'bmw',
    model: 'X5',
    model_slug: 'x5',
    generation: 'g_201808_8395',
    sourceUrl: 'https://www.drom.ru/catalog/bmw/x5/g_201808_8395/',
  };

  it('produces a zod-valid ModelRecord 1:1 with D-10', () => {
    const html = fix('generation.bmw.x5.g05.html');
    const record = parseGenerationPage(html, ctx);

    // parseGenerationPage already returns a parsed record; re-assert via schema.
    const parsed = ModelRecord.parse(record);
    expect(parsed.brand_slug).toBe('bmw');
    expect(parsed.model_slug).toBe('x5');
    expect(parsed.generation).toBe('g_201808_8395');
    expect(parsed.source).toBe('drom-catalog');
  });

  it('Pitfall 1: non-empty body_types, engine_options, and description_ru', () => {
    const html = fix('generation.bmw.x5.g05.html');
    const record = parseGenerationPage(html, ctx);

    expect(record.body_types.length).toBeGreaterThanOrEqual(1);
    expect(record.engine_options.length).toBeGreaterThanOrEqual(1);
    expect(record.description_ru.length).toBeGreaterThan(10);
  });

  it('extracts a 4-digit year_from from the h1 date range', () => {
    const html = fix('generation.bmw.x5.g05.html');
    const record = parseGenerationPage(html, ctx);
    expect(record.year_from).not.toBeNull();
    expect(record.year_from!).toBeGreaterThanOrEqual(1990);
    expect(record.year_from!).toBeLessThanOrEqual(2030);
  });

  it('produces image_paths: [<expected hero filename>] when ctx.heroImageUrl is set (CR-05)', () => {
    const html = fix('generation.bmw.x5.g05.html');
    const heroImageUrl = extractHeroImageUrl(html) ?? undefined;
    expect(heroImageUrl).toBeDefined();
    const record = parseGenerationPage(html, { ...ctx, heroImageUrl });
    expect(record.image_paths).toEqual(['images/bmw-x5-g_201808_8395-hero.webp']);
  });

  it('produces image_paths: [] when ctx.heroImageUrl is undefined (CR-05)', () => {
    const html = fix('generation.bmw.x5.g05.html');
    const record = parseGenerationPage(html, ctx);
    expect(record.image_paths).toEqual([]);
  });
});

describe('DROM_BRAND_WHITELIST env var filter (plan 07 / plan 09 smoke gate)', () => {
  const ORIGINAL = process.env.DROM_BRAND_WHITELIST;

  beforeEach(() => {
    delete process.env.DROM_BRAND_WHITELIST;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DROM_BRAND_WHITELIST;
    else process.env.DROM_BRAND_WHITELIST = ORIGINAL;
  });

  // Helper that mirrors the orchestrator's filter logic verbatim. Kept inline so the
  // unit test does not depend on exporting an internal helper from drom/index.ts.
  function applyWhitelist<T extends { brand_slug: string }>(brands: T[]): T[] {
    const whitelist = (process.env.DROM_BRAND_WHITELIST ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    return whitelist.length > 0 ? brands.filter((b) => whitelist.includes(b.brand_slug)) : brands;
  }

  const ALL = [{ brand_slug: 'lada' }, { brand_slug: 'bmw' }, { brand_slug: 'audi' }];

  it('returns full list when env var is unset', () => {
    expect(applyWhitelist(ALL)).toEqual(ALL);
  });

  it('returns full list when env var is empty string', () => {
    process.env.DROM_BRAND_WHITELIST = '';
    expect(applyWhitelist(ALL)).toEqual(ALL);
  });

  it('restricts to a single brand when env var = "lada"', () => {
    process.env.DROM_BRAND_WHITELIST = 'lada';
    expect(applyWhitelist(ALL)).toEqual([{ brand_slug: 'lada' }]);
  });

  it('restricts to multiple brands and is case-insensitive', () => {
    process.env.DROM_BRAND_WHITELIST = 'LADA, BMW';
    expect(applyWhitelist(ALL)).toEqual([{ brand_slug: 'lada' }, { brand_slug: 'bmw' }]);
  });

  it('silently drops unknown brands in the whitelist', () => {
    process.env.DROM_BRAND_WHITELIST = 'lada,nosuchbrand';
    expect(applyWhitelist(ALL)).toEqual([{ brand_slug: 'lada' }]);
  });
});
