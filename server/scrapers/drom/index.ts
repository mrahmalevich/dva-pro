// server/scrapers/drom/index.ts — TEMPORARY PLACEHOLDER (replaced by plan 01-07)
import type { IScraper, ScrapeResult } from '../shared/types.js';

export const drom: IScraper = {
  source: 'drom-catalog',
  async run(): Promise<ScrapeResult> {
    console.warn('[drom] TODO: replaced by real orchestrator in plan 01-07');
    return {
      status: 'not_implemented',
      source: 'drom-catalog',
      deferredTo: 'v1.x',
      todo: 'Replaced by real drom orchestrator in plan 01-07',
    };
  },
};
