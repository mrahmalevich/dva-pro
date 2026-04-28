// server/scrapers/shared/http.ts
//
// MINIMAL placeholder for parallel-worktree execution of plan 01-05 (fx.ts).
// Plan 01-03 (sister wave-3 plan, executed in a separate worktree) is the
// authoritative author of this module — it adds politeDelay, fetchHtml,
// fetchBuffer, retry config, cookie jar, and the rate limiter (D-14).
//
// This stub exists ONLY so that:
//   1. `import { dromClient } from './http.js'` in fx.ts resolves at type-check time.
//   2. Vitest's `vi.doMock('../scrapers/shared/http.js', ...)` in fx.test.ts has a
//      resolvable path to mock against.
//
// At wave merge time the orchestrator must reconcile this file with plan 03's
// richer implementation (plan 03 is the superset — accept plan 03's version).
import got from 'got';

export const dromClient = got.extend({
  timeout: { request: 30_000 },
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});
