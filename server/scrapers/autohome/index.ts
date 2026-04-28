// server/scrapers/autohome/index.ts — STUB (deferred to v1.x)
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const autohome: IScraper = {
  source: 'autohome',
  async run(): Promise<ScrapeResult> {
    console.warn('[autohome] TODO: implement Autohome scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'autohome',
      deferredTo: 'v1.x',
      todo: 'Implement Autohome scraper per IScraper contract; PlaywrightCrawler + CN residential proxy',
    };
  },
};
