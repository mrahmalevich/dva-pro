// server/scrapers/drom/parse-generation-list.ts
//
// Wave 4 (plan 01-07) — Drom generation list DOM parser (per model).
//
// Source page: https://www.drom.ru/catalog/<brand>/<model>/
// Behavior: walk every <a href> matching the generation page URL form, dedupe by
// generation_id, return [{generation_id, generation_label, url, hero_image_url?}].
//
// DOM finding (Wave 4 sanitization, server/tests/fixtures/drom/generation-list.bmw.x5.html):
//   - Generation_id format covers BOTH 4-digit YYYY (g_2018_8395) and 6-digit YYYYMM
//     (g_201808_8395). Live BMW X5 G05 uses the 6-digit form.
//   - Anchors appear as RELATIVE hrefs (e.g. href="/catalog/bmw/x5/g_201808_8395/")
//     AND short relative form (href="g_201808_8395/") inside generation cards.
//     We accept both and normalize via URL().
//   - Hero image lives as an <img> child of the <a> in some card layouts; absent
//     for older generations.
//
// Pattern reference: PATTERNS.md §parse-generation-list.ts; RESEARCH.md A4 + lines 580-605.
import * as cheerio from 'cheerio';

export type GenerationRef = {
  generation_id: string; // e.g. 'g_2018_8395' or 'g_201808_8395'
  generation_label: string; // human label from the link text (e.g. 'G05' or '2018-2023')
  url: string;
  hero_image_url?: string;
};

// Regex covers /g_<4-or-6-digit>_<id>/ at the end of the href.
const GEN_ID_REGEX = /g_(\d{4,6})_(\d+)\/?$/;

export function parseGenerationList(html: string, modelUrl: string): GenerationRef[] {
  const $ = cheerio.load(html);
  const refs: GenerationRef[] = [];
  const seen = new Set<string>();

  $('a[href*="g_"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(GEN_ID_REGEX);
    if (!m) return;
    const generation_id = `g_${m[1]}_${m[2]}`;
    if (seen.has(generation_id)) return;
    seen.add(generation_id);

    const url = new URL(href, modelUrl).toString();
    const label = $(el).text().trim();
    const hero = $(el).find('img').attr('src') ?? undefined;

    refs.push({ generation_id, generation_label: label, url, hero_image_url: hero });
  });

  return refs;
}
