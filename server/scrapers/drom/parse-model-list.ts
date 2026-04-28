// server/scrapers/drom/parse-model-list.ts
//
// Wave 4 (plan 01-07) — Drom model list DOM parser (per brand).
//
// Source page: https://www.drom.ru/catalog/<brand>/
// Behavior: walk every <a href> matching the model-page URL form for the given brand,
// dedupe by slug, skip /all/ and /year_*/ aggregators, return [{model_slug, ru_name,
// latin_name, url}].
//
// DOM finding (Wave 4 sanitization, server/tests/fixtures/drom/model-list.bmw.html):
//   - Drom emits ONLY the Latin label in the link text (e.g. "BMW X5", "X5", "iX1").
//     The naive Cyrillic/Latin split heuristic from the plan scaffolding does not
//     match the live DOM — Cyrillic model names live elsewhere (e.g. "Х5" appears
//     in image alt text on the generation page, not in the model-list anchor).
//   - For Phase 1 we set both ru_name and latin_name to the link text and let the
//     orchestrator's mergeAliases call upgrade ru_name when a Cyrillic source surfaces.
//     This keeps the parser simple and the contract honest (no synthetic Cyrillic).
//
// Pattern reference: PATTERNS.md §parse-model-list.ts; RESEARCH.md Open Question 5.
import * as cheerio from 'cheerio';

export type ModelRef = {
  model_slug: string;
  ru_name: string;
  latin_name: string;
  url: string;
};

const CATALOG_BASE = 'https://www.drom.ru/catalog';
// Brand slug must come from a well-formed brand URL; we extract it then build a
// per-brand regex. URL forms accepted: /catalog/<brand>/ or absolute drom URL.
const BRAND_FROM_URL_REGEX = /\/catalog\/([a-z0-9_-]+)\/?$/i;

export function parseModelList(html: string, brandUrl: string): ModelRef[] {
  const brandMatch = brandUrl.match(BRAND_FROM_URL_REGEX);
  if (!brandMatch) return [];
  const brandSlug = brandMatch[1].toLowerCase();

  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const models: ModelRef[] = [];

  // Match either '/catalog/<brand>/<model>/' or full https drom URL.
  // Use a regex template so the slug character set stays in sync with parse-brand-index.
  const modelHrefRegex = new RegExp(
    `^(?:https?:\\/\\/www\\.drom\\.ru)?\\/catalog\\/${brandSlug}\\/([a-z0-9_-]+)\\/?$`,
    'i',
  );

  $('a[href*="/catalog/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(modelHrefRegex);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (slug === 'all') return;
    if (slug.startsWith('year_')) return;
    if (seen.has(slug)) return;
    seen.add(slug);

    const text = $(el).text().trim() || $(el).find('img').attr('alt')?.trim() || slug;
    models.push({
      model_slug: slug,
      // Drom model anchors expose only Latin labels (Wave 4 finding); ru_name is
      // initialized to the same text and may be overridden by future Cyrillic
      // sources via the brand-aliases merge (D-16, plan 04).
      ru_name: text,
      latin_name: text,
      url: `${CATALOG_BASE}/${brandSlug}/${slug}/`,
    });
  });

  return models;
}
