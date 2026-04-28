// server/scrapers/shared/fx.ts
import { dromClient } from './http.js';            // reuse got instance
import * as iconv from 'iconv-lite';
import { XMLParser } from 'fast-xml-parser';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const CBR_URL = 'https://www.cbr.ru/scripts/XML_daily.asp';
const CACHE_DIR = 'data/scraped/fx';

export type FxRates = {
  date: string;                                  // ISO YYYY-MM-DD UTC
  rates: { USD: number; EUR: number; JPY: number; KRW: number; CNY: number; AED: number };
  source: 'cbr-live' | 'cbr-cache';
};

const PARSER = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function parseDecimalComma(s: string): number {
  return Number(s.replace(',', '.'));
}

/**
 * Pure decode + parse helper — exported for testability against the fixture.
 * Takes raw windows-1251 bytes, returns the live-shape FxRates (without writing cache).
 */
export function decodeCbrXml(bytes: Buffer, today: string): FxRates {
  const xml = iconv.decode(bytes, 'win1251');
  const parsed = PARSER.parse(xml);
  const rawValutes = parsed?.ValCurs?.Valute;
  if (!Array.isArray(rawValutes)) {
    throw new Error('CBR XML: ValCurs.Valute is not an array');
  }
  const valutes = rawValutes as Array<{
    CharCode: string;
    Nominal: string;
    Value: string;
    VunitRate?: string;
  }>;
  const want = ['USD', 'EUR', 'JPY', 'KRW', 'CNY', 'AED'] as const;
  const rates = {} as FxRates['rates'];
  for (const code of want) {
    const v = valutes.find((x) => x.CharCode === code);
    if (!v) throw new Error(`CBR XML missing currency ${code}`);
    const rub = v.VunitRate
      ? parseDecimalComma(v.VunitRate)
      : parseDecimalComma(v.Value) / Number(v.Nominal);
    rates[code] = rub;
  }
  return { date: today, rates, source: 'cbr-live' };
}

/**
 * D-12 contract:
 *   - same-UTC-day cache hit → return cached, no network
 *   - else attempt live; on success, write cache, return live
 *   - on live failure with opts.firstRun=true → throw (fail-fast)
 *   - on live failure with prior cached file → return cached, source='cbr-cache'
 */
export async function fetchFx(opts: { firstRun: boolean }): Promise<FxRates> {
  const today = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD UTC
  const cachePath = resolve(CACHE_DIR, `cbr-${today}.json`);

  // Same-UTC-day cache hit
  try {
    const cached = JSON.parse(await readFile(cachePath, 'utf-8')) as FxRates;
    return { ...cached, source: 'cbr-cache' };
  } catch {
    /* not cached today, fetch live */
  }

  try {
    const buf = await dromClient.get(CBR_URL, { responseType: 'buffer' }).then((r) => r.body as Buffer);
    const result = decodeCbrXml(buf, today);
    await mkdir(CACHE_DIR, { recursive: true });
    await atomicWriteFile(cachePath, JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    if (opts.firstRun) {
      // fail-fast on first run (D-12) — no cached baseline yet, cannot fall back
      throw new Error(
        `CBR FX fetch failed on first run; cannot proceed: ${e instanceof Error ? e.message : e}`,
      );
    }
    const dir = resolve(CACHE_DIR);
    const files = await readdir(dir).catch(() => []);
    const candidates = files
      .filter((f) => /^cbr-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort()
      .reverse();
    if (candidates.length === 0) throw new Error('CBR live fetch failed and no cache available');
    const latest = JSON.parse(await readFile(resolve(dir, candidates[0]), 'utf-8')) as FxRates;
    return { ...latest, source: 'cbr-cache' };
  }
}
