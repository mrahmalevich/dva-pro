// server/scrapers/drom/parse-generation-page.ts
//
// Wave 4 (plan 01-07) — Drom generation page DOM parser → ModelRecord.
//
// Source page: https://www.drom.ru/catalog/<brand>/<model>/g_<YYYY|YYYYMM>_<id>/
// Behavior: extract every D-10 ModelRecord field, run zod validation, throw on
// schema violation (Pitfall 1 mitigation — empty body_types/engine_options must
// not silently pass through).
//
// DOM findings (Wave 4 sanitization, server/tests/fixtures/drom/generation.bmw.x5.g05.html):
//   - Editorial blurb: NO <h2>"Описание"</h2> heading on the live page; the
//     description lives in <meta name='description' content='...'>. We use that
//     as the canonical source and fall back to article paragraphs / h1 if absent.
//   - <h1>: "BMW X5 2018, джип/suv 5 дв., 4 поколение, G05 (06.2018 - 03.2022) -
//     технические характеристики и комплектации". We extract:
//       * year_from / year_to via shared/normalize parseYear (handles 'н.в.' too)
//       * body_types from "джип/suv" (split on /,;)
//   - Engine spec rows: <div class="r6hmq22"> with text like
//     "3.0 л, 249 л.с., дизель, АКПП, полный привод (4WD)". We extract cc (3.0 L
//     -> 3000 cc), hp (249), fuel (дизель -> diesel), and drive code in parens.
//   - Prices: complectation table cells <td class="y7l57t0">N N N <U+20BD></td>;
//     we take min/max across all such cells. The page header "цены от X рублей"
//     consistently equals the min.
//   - Hero image: prefer the generation-specific URL pattern
//     /photos/generations/<...>.jpg; fall back to first /photos/fullsize/.
//
// Pattern reference: PATTERNS.md §parse-generation-page.ts; RESEARCH.md lines 608-664;
// Pitfall 1 (line 1033) — strict zod validation is the DOM-regression detector.
import * as cheerio from 'cheerio';
import type { ModelRecord } from '../shared/types.js';
import { ModelRecord as ModelRecordSchema } from '../shared/types.js';
import { parsePrice, parseYear } from '../shared/normalize.js';

export interface GenerationPageContext {
  brand: string;
  brand_slug: string;
  model: string;
  model_slug: string;
  generation: string;
  sourceUrl: string;
  /**
   * Hero image URL surfaced by parseGenerationList (single source of truth
   * per CR-05 fix). When provided non-empty, parseGenerationPage emits a
   * corresponding image_paths entry; the orchestrator then attempts the
   * download. When undefined/empty, image_paths = [] and no download.
   */
  heroImageUrl?: string;
}

type EngineSpec = {
  cc: number;
  hp: number;
  fuel: 'gas' | 'diesel' | 'hybrid' | 'electric';
};

const FUEL_MAP: Array<[RegExp, EngineSpec['fuel']]> = [
  [/электр/i, 'electric'],
  [/гибрид/i, 'hybrid'],
  [/дизел/i, 'diesel'],
  [/бензин/i, 'gas'],
];

function detectFuel(s: string): EngineSpec['fuel'] | null {
  for (const [re, fuel] of FUEL_MAP) if (re.test(s)) return fuel;
  return null;
}

/**
 * Parse one engine-spec line of the form:
 *   "3.0 л, 249 л.с., дизель, АКПП, полный привод (4WD)"
 * Returns null if the required fields (cc, hp, fuel) cannot be extracted.
 */
function parseEngineLine(text: string): { engine: EngineSpec; drive: string | null } | null {
  // 3.0 л → 3000 cc; 4.4 л → 4400 cc; 1.5 л → 1500 cc
  const litreMatch = text.match(/(\d+(?:[.,]\d)?)\s*л(?![а-яё])/i);
  // 249 л.с.  (л.с. = "лошадиных сил" / horsepower)
  const hpMatch = text.match(/(\d{2,4})\s*л\.с\./i);
  if (!litreMatch || !hpMatch) return null;

  const litres = Number(litreMatch[1].replace(',', '.'));
  if (!Number.isFinite(litres) || litres <= 0) return null;
  const cc = Math.round(litres * 1000);
  const hp = Number(hpMatch[1]);
  if (!Number.isFinite(hp) || hp <= 0) return null;

  const fuel = detectFuel(text);
  if (!fuel) return null;

  // Drive code lives in parentheses after «полный/задний/передний привод»:
  // (4WD), (AWD), (RWD), (FWD). Fall back to recognizing Cyrillic phrasing.
  const driveCodeMatch = text.match(/\((4WD|AWD|RWD|FWD)\)/i);
  let drive: string | null = driveCodeMatch ? driveCodeMatch[1].toUpperCase() : null;
  if (!drive) {
    if (/полный\s+привод/i.test(text)) drive = 'AWD';
    else if (/задний\s+привод/i.test(text)) drive = 'RWD';
    else if (/передний\s+привод/i.test(text)) drive = 'FWD';
  }

  return { engine: { cc, hp, fuel }, drive };
}

/**
 * Extract body_types from the h1 (e.g. "джип/suv 5 дв.") or from the meta
 * description if h1 lacks it. Split on `/`, `,`, `;` and return non-empty
 * trimmed tokens up to a sensible cap so noise like "5 дв." is filtered.
 */
function extractBodyTypes(h1: string, meta: string): string[] {
  const search = `${h1}\n${meta}`;
  const m = search.match(/(?:^|[\s,;.])((?:[A-Za-zА-Яа-яёЁ]+\/?){1,4})\s*\d{1,2}\s*дв/);
  // The above captures "джип/suv" right before " 5 дв." If that fails fall back to
  // any "джип|седан|купе|хетчбэк|универсал|кабриолет|пикап|минивэн|suv|crossover" hit.
  const out: string[] = [];
  if (m) {
    for (const t of m[1].split(/[\/,;]+/)) {
      const v = t.trim();
      if (v && v.length <= 20) out.push(v);
    }
  }
  if (out.length === 0) {
    const KNOWN_BODY_RE =
      /(джип|внедорожник|седан|купе|хетчбэк|универсал|кабриолет|пикап|минивэн|лифтбэк|родстер|suv|crossover|coupe|sedan|hatchback|wagon|pickup|convertible|minivan)/gi;
    const seen = new Set<string>();
    let mm: RegExpExecArray | null;
    while ((mm = KNOWN_BODY_RE.exec(search)) !== null) {
      const v = mm[1].toLowerCase();
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}

/**
 * Extract numeric RUB prices from every complectation-table cell that contains
 * the rouble glyph (U+20BD). Returns sorted [min, max] or [min, null] when only
 * one cell exists.
 */
function extractPrices($: cheerio.CheerioAPI): { min: number | null; max: number | null } {
  const ROUBLE_RE = /(\d[\d\s ]+)\s*₽/u;
  const nums: number[] = [];
  // The complectation table uses td.y7l57t0; restrict to that scope to skip the
  // sidebar's "Цена б/у" used-car cells, which are not new-car prices.
  $('td.y7l57t0').each((_, el) => {
    const text = $(el).text();
    const m = text.match(ROUBLE_RE);
    if (!m) return;
    const n = parsePrice(m[1]);
    if (n !== null) nums.push(n);
  });
  if (nums.length === 0) {
    // Fallback to the section heading "цены от X рублей" if the table is absent.
    const headingMatch = $.html().match(/цены\s+от\s+([\d\s ]+)\s*рубл/iu);
    if (headingMatch) {
      const n = parsePrice(headingMatch[1]);
      if (n !== null) return { min: n, max: null };
    }
    return { min: null, max: null };
  }
  nums.sort((a, b) => a - b);
  return { min: nums[0], max: nums.length > 1 ? nums[nums.length - 1] : null };
}

/**
 * Extract a hero image URL. Prefer the generation-specific photo
 * (s.auto.drom.ru/.../photos/generations/<...>.jpg) which is the canonical
 * card image; fall back to the first fullsize listing photo.
 */
export function extractHeroImageUrl(html: string): string | null {
  const $ = cheerio.load(html);
  const generationsImg = $('img[src*="s.auto.drom.ru"][src*="/photos/generations/"]')
    .first()
    .attr('src');
  if (generationsImg) return generationsImg;
  const fullsizeImg = $('img[src*="s.auto.drom.ru"][src*="/photos/fullsize/"]')
    .first()
    .attr('src');
  if (fullsizeImg) return fullsizeImg;
  return $('img[src*="s.auto.drom.ru"]').first().attr('src') ?? null;
}

export function parseGenerationPage(html: string, ctx: GenerationPageContext): ModelRecord {
  const $ = cheerio.load(html);

  // 1. description_ru — meta[name=description] is the canonical source on drom
  // generation pages (no <h2>Описание</h2> heading exists). Fall back to the first
  // article-style paragraph if meta is missing.
  const metaDescription =
    $('meta[name="description"]').attr('content')?.trim() ??
    $("meta[name='description']").attr('content')?.trim() ??
    '';
  const fallbackDescription =
    $('h2:contains("Описание")').nextUntil('h2', 'p').first().text().trim() ||
    $('article p').first().text().trim() ||
    $('h1').first().text().trim();
  const description_ru = metaDescription || fallbackDescription;

  // 2. year_from / year_to — h1 contains a "MM.YYYY - MM.YYYY" or "MM.YYYY - н.в." range.
  const h1Text = $('h1').first().text();
  const { from: year_from, to: year_to } = parseYear(h1Text);

  // 3. body_types — derived from h1 (and meta description as a backup).
  const body_types = extractBodyTypes(h1Text, metaDescription);

  // 4. engine_options + drive_options — walk every <div class="r6hmq22"> spec line.
  const engineOptions: EngineSpec[] = [];
  const driveSet = new Set<string>();
  // Dedup engines by (cc, hp, fuel) signature so we don't emit duplicates from the
  // generation table where the same engine appears in multiple complectations.
  const engineSeen = new Set<string>();
  $('div.r6hmq22').each((_, el) => {
    const text = $(el).text().trim();
    const parsed = parseEngineLine(text);
    if (!parsed) return;
    const key = `${parsed.engine.cc}|${parsed.engine.hp}|${parsed.engine.fuel}`;
    if (!engineSeen.has(key)) {
      engineSeen.add(key);
      engineOptions.push(parsed.engine);
    }
    if (parsed.drive) driveSet.add(parsed.drive);
  });
  const drive_options = Array.from(driveSet);

  // 5. price_min_rub / price_max_rub from the complectation table.
  const { min: price_min_rub, max: price_max_rub } = extractPrices($);

  // 6. Hero image URL → image_paths entry. Orchestrator passes ctx.heroImageUrl
  //    from parseGenerationList (single source of truth per CR-05 fix). Empty
  //    or undefined → image_paths = [] and the orchestrator skips the fetch.
  const image_paths =
    ctx.heroImageUrl && ctx.heroImageUrl.length > 0
      ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`]
      : [];

  const record: ModelRecord = {
    brand: ctx.brand,
    brand_slug: ctx.brand_slug,
    model: ctx.model,
    model_slug: ctx.model_slug,
    generation: ctx.generation,
    year_from,
    year_to,
    body_types,
    engine_options: engineOptions,
    drive_options,
    description_ru,
    price_min_rub,
    price_max_rub,
    image_paths,
    source: 'drom-catalog',
    source_url: ctx.sourceUrl,
    scraped_at: new Date().toISOString(),
    complectations: [],
  };

  // Pitfall 1: zod throws on schema violation (e.g. body_types had a non-string).
  // The orchestrator catches the throw and adds the URL to report.errors[].
  return ModelRecordSchema.parse(record);
}
