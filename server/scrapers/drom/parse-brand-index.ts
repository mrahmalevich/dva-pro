// server/scrapers/drom/parse-brand-index.ts
//
// Wave 4 (plan 01-07) — Drom catalog brand index DOM parser.
//
// Source page: https://www.drom.ru/catalog/
// Behavior: walk every <a href> matching the brand-page URL form, dedupe by slug,
// skip the /catalog/all/ aggregator, return a stable [{brand_slug, latin_name, url}]
// array.
//
// DOM finding (Wave 4 sanitization, server/tests/fixtures/drom/brand-index.html):
//   - Drom serves brand anchors as ABSOLUTE URLs (https://www.drom.ru/catalog/<slug>/)
//     in <noscript> blocks AND as relative URLs in scripted templates. We accept both.
//   - The full A-Z brand list (~250 brands) lives inside <noscript>. Sanitization
//     strips the <noscript> tag wrappers but preserves their contents (see Task 1
//     commit message), so the parser sees the same list a JS-disabled browser would.
//
// Pattern reference: PATTERNS.md §parse-brand-index.ts; RESEARCH.md lines 545-577.
import * as cheerio from 'cheerio';

export type BrandRef = {
  brand_slug: string;
  latin_name: string;
  url: string;
};

const CATALOG_BASE = 'https://www.drom.ru/catalog';
// Match either '/catalog/<slug>/' or 'https://www.drom.ru/catalog/<slug>/'
// (drom uses both forms). slug is [a-z0-9_-]+, case-insensitive.
const BRAND_HREF_REGEX = /^(?:https?:\/\/www\.drom\.ru)?\/catalog\/([a-z0-9_-]+)\/?$/i;

export function parseBrandIndex(html: string): BrandRef[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const brands: BrandRef[] = [];

  $('a[href*="/catalog/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const m = href.match(BRAND_HREF_REGEX);
    if (!m) return;
    const slug = m[1].toLowerCase();
    if (slug === 'all') return; // skip aggregator link
    if (seen.has(slug)) return;
    seen.add(slug);

    // Brand label comes from the link's text content, then <img alt>, then slug fallback.
    const text = $(el).text().trim() || $(el).find('img').attr('alt')?.trim() || slug;
    brands.push({
      brand_slug: slug,
      latin_name: text,
      url: `${CATALOG_BASE}/${slug}/`,
    });
  });

  return brands;
}
