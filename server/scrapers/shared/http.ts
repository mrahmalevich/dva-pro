// server/scrapers/shared/http.ts
//
// Shared HTTP client for scrapers (Phase 1: drom only; reused by v1.x scrapers via IScraper).
// Policy-rich: cookie jar, exponential retry, polite delay, single-flight serialization.
// Block-detection is intentionally NOT integrated here — the orchestrator (plan 07) feeds
// each response through shared/block-detection.ts. Keep this module policy-free w.r.t. drom.
//
// References:
// - D-14 (CONTEXT.md): 1 req per 10s with ±20% jitter; pLimit(1) for HTTP serialization.
// - A1 (RESEARCH.md line 541, 1088): got@15 retry shape (limit/statusCodes/methods/calculateDelay).
// - Pitfall 2: never decode windows-1251 sources via Buffer.toString('utf-8'); use fetchBuffer + iconv-lite.
// - Pitfall 4: pLimit(1) keeps HTTP serial so image URLs do not drift between page parse and image fetch.

import got from 'got';
import { CookieJar } from 'tough-cookie';
import pLimit from 'p-limit';

const cookieJar = new CookieJar();
const httpLimit = pLimit(1); // D-14: serial HTTP

const POLITE_BASE_MS = 10_000; // D-14: 1 req per 10s
const JITTER_RATIO = 0.20; // D-14: ±20%

let lastRequestAt = 0;

/**
 * Enforce polite spacing between sequential HTTP fetches per D-14.
 * Floor wait time is POLITE_BASE_MS * (1 - JITTER_RATIO) = 8s.
 *
 * Exported for fake-timer tests; production code paths invoke it locally inside fetchHtml/fetchBuffer.
 */
export async function politeDelay(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const jitter = POLITE_BASE_MS * (1 + (Math.random() * 2 - 1) * JITTER_RATIO);
  const wait = Math.max(0, jitter - elapsed);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

export const dromClient = got.extend({
  cookieJar,
  timeout: { request: 30_000 },
  retry: {
    limit: 3,
    statusCodes: [408, 429, 500, 502, 503, 504],
    methods: ['GET'],
    calculateDelay: ({ attemptCount }) => Math.min(60_000, 2_000 * 2 ** attemptCount),
  },
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
});

export async function fetchHtml(url: string): Promise<string> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'text' });
    return response.body;
  });
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'buffer' });
    return response.body as Buffer;
  });
}
