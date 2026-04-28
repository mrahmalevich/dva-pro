// server/scrapers/encar/index.ts — STUB (deferred to v1.x)
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const encar: IScraper = {
  source: 'encar',
  async run(): Promise<ScrapeResult> {
    console.warn('[encar] TODO: implement Encar scraper per IScraper contract (deferred to v1.x)');
    return {
      status: 'not_implemented',
      source: 'encar',
      deferredTo: 'v1.x',
      todo: 'Implement Encar scraper per IScraper contract; uses Crawlee+Playwright Firefox + KR residential proxy + Carapis fallback',
    };
  },
};
