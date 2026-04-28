// server/tests/fx.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFile, mkdir, rm, writeFile, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { decodeCbrXml, type FxRates } from '../scrapers/shared/fx.js';

const FIXTURE_BIN = resolve('server/tests/fixtures/cbr/XML_daily.windows-1251.xml');
const FIXTURE_GOLDEN = resolve('server/tests/fixtures/cbr/XML_daily.expected.json');

describe('decodeCbrXml (SCRAPE-11, A8)', () => {
  it('decodes windows-1251 + parses XML → all 6 currencies match golden output', async () => {
    const bytes = await readFile(FIXTURE_BIN);
    const golden = JSON.parse(await readFile(FIXTURE_GOLDEN, 'utf-8')) as FxRates;
    const decoded = decodeCbrXml(bytes, golden.date);
    expect(decoded.date).toBe(golden.date);
    expect(decoded.source).toBe('cbr-live');
    for (const code of ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const) {
      // Allow 1e-6 tolerance for FP arithmetic
      expect(decoded.rates[code]).toBeCloseTo(golden.rates[code], 6);
    }
  });

  it('throws if a required currency is missing', () => {
    // Hand-craft a windows-1251 XML missing EUR/JPY/KRW/CNY/AED — only USD + a
    // dummy second entry (NOK) present. The dummy is needed because
    // fast-xml-parser collapses a single <Valute> child into an object rather
    // than an array; with two children the array path engages and decodeCbrXml
    // can advance past the array-shape check to the missing-currency throw.
    // Plain ASCII bytes are identical in windows-1251 and utf-8.
    const bytes = Buffer.from(
      `<?xml version="1.0" encoding="windows-1251"?><ValCurs Date="28.04.2026">` +
        `<Valute><CharCode>USD</CharCode><Nominal>1</Nominal><Value>91,3145</Value><VunitRate>91,3145</VunitRate></Valute>` +
        `<Valute><CharCode>NOK</CharCode><Nominal>10</Nominal><Value>8,5</Value><VunitRate>0,85</VunitRate></Valute>` +
        `</ValCurs>`,
      'binary',
    );
    expect(() => decodeCbrXml(bytes, '2026-04-28')).toThrow(/missing currency/);
  });
});

describe('fetchFx — D-12 fail-fast and cached fallback', () => {
  let workDir = '';
  let cwdSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    workDir = await mkdtemp(resolve(tmpdir(), 'dva-fx-'));
    // cd into a sandbox so CACHE_DIR resolves to workDir/data/scraped/fx
    cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(workDir);
    vi.resetModules();
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    vi.doUnmock('../scrapers/shared/http.js');
    vi.resetModules();
    if (workDir && existsSync(workDir)) await rm(workDir, { recursive: true, force: true });
  });

  it('first-run network failure throws (fail-fast, no cache)', async () => {
    vi.doMock('../scrapers/shared/http.js', () => ({
      dromClient: {
        get: () => {
          throw new Error('simulated network failure');
        },
      },
    }));
    const fxFresh = await import('../scrapers/shared/fx.js');
    await expect(fxFresh.fetchFx({ firstRun: true })).rejects.toThrow(
      /CBR FX fetch failed on first run/,
    );
  });

  it('subsequent run with prior cache → returns cached + source=cbr-cache', async () => {
    // Seed a prior-day cache file
    const prior: FxRates = {
      date: '2026-04-27',
      rates: { USD: 90.0, EUR: 96.0, JPY: 0.5, KRW: 0.06, CNY: 12.0, AED: 24.5 },
      source: 'cbr-live',
    };
    await mkdir(resolve(workDir, 'data/scraped/fx'), { recursive: true });
    await writeFile(
      resolve(workDir, 'data/scraped/fx/cbr-2026-04-27.json'),
      JSON.stringify(prior),
    );

    vi.doMock('../scrapers/shared/http.js', () => ({
      dromClient: {
        get: () => {
          throw new Error('simulated network failure');
        },
      },
    }));
    const fxFresh = await import('../scrapers/shared/fx.js');
    const result = await fxFresh.fetchFx({ firstRun: false });
    expect(result.source).toBe('cbr-cache');
    expect(result.rates.USD).toBe(90.0);
  });

  it('same-UTC-day cache hit returns cache without network', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const cached: FxRates = {
      date: today,
      rates: { USD: 99.99, EUR: 100, JPY: 0.6, KRW: 0.07, CNY: 13, AED: 25 },
      source: 'cbr-live',
    };
    await mkdir(resolve(workDir, 'data/scraped/fx'), { recursive: true });
    await writeFile(
      resolve(workDir, `data/scraped/fx/cbr-${today}.json`),
      JSON.stringify(cached),
    );

    let networkHit = 0;
    vi.doMock('../scrapers/shared/http.js', () => ({
      dromClient: {
        get: () => {
          networkHit++;
          throw new Error('should not be called');
        },
      },
    }));
    const fxFresh = await import('../scrapers/shared/fx.js');
    const result = await fxFresh.fetchFx({ firstRun: true });
    expect(result.source).toBe('cbr-cache');
    expect(result.rates.USD).toBe(99.99);
    expect(networkHit).toBe(0);
  });
});
