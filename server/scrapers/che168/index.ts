// server/scrapers/che168/index.ts — STUB (deferred to v1.x)
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const che168: IScraper = {
  source: 'che168',
  async run(): Promise<ScrapeResult> {
    console.warn('[che168] TODO: implement Che168 scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'che168',
      deferredTo: 'v1.x',
      todo: 'Implement Che168 scraper per IScraper contract; PlaywrightCrawler + CN residential proxy',
    };
  },
};
