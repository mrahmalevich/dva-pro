// server/scrapers/beforward/index.ts — STUB (deferred to v1.x)
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const beforward: IScraper = {
  source: 'beforward',
  async run(): Promise<ScrapeResult> {
    console.warn('[beforward] TODO: implement BeForward scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'beforward',
      deferredTo: 'v1.x',
      todo: 'Implement BeForward scraper per IScraper contract; HttpCrawler + Cheerio (mostly static)',
    };
  },
};
