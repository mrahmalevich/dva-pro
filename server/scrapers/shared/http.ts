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
import * as iconv from 'iconv-lite';
import { ProbeDownLimiter } from './rate-limiter.js';

const cookieJar = new CookieJar();
const httpLimit = pLimit(1); // D-14: serial HTTP

// SPEC R-5: probe-down adaptive delay replaces the fixed 10s constant from Phase 01-D-14.
// The limiter starts at 10s ceiling; halves to 5s floor after 100 OK; resets on 429/5xx.
const limiter = new ProbeDownLimiter();
const JITTER_RATIO = 0.20; // D-14: ±20%

/**
 * D-09 / D-11: Denylist of cookies drom's feedback widget sets on every /catalog/* visit.
 * `npsPayload` is a base64-encoded list of component IDs that grows ~unboundedly across a
 * long crawl; once its value exceeds ~8KB the full Cookie header triggers nginx HTTP 431.
 * `npsType` and `showNPS` are companion flags from the same widget. Strip all three from
 * the outgoing header on every request. Affinity and region cookies are NOT in this set
 * and continue to flow untouched (ring, segSession, PHPSESSID, cookie_cityid, cookie_regionid,
 * my_geo, dr_df, veryFirstHit).
 */
const STRIP_COOKIES = new Set(['npsPayload', 'npsType', 'showNPS']);

let lastRequestAt = 0;

/**
 * Enforce polite spacing between sequential HTTP fetches per D-14 / SPEC R-5.
 * Base delay is adaptive: starts at 10s ceiling, halves to 5s floor after 100 OK responses.
 * Floor wait time is baseMs * (1 - JITTER_RATIO) = 4s at floor.
 *
 * Exported for fake-timer tests; production code paths invoke it locally inside fetchHtml/fetchBuffer.
 */
export async function politeDelay(): Promise<void> {
  const baseMs = limiter.getDelayMs();
  const elapsed = Date.now() - lastRequestAt;
  const jitter = baseMs * (1 + (Math.random() * 2 - 1) * JITTER_RATIO);
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
  hooks: {
    // D-10: Strip bloat cookies from the outgoing Cookie header before got sends the request.
    // The cookie jar (tough-cookie) is left untouched — only the header projection changes.
    beforeRequest: [
      (options) => {
        const raw = options.headers['cookie'];
        if (!raw) return;
        const filtered = String(raw)
          .split(/;\s*/)
          .filter((pair) => {
            const name = pair.split('=')[0].trim();
            return !STRIP_COOKIES.has(name);
          })
          .join('; ');
        options.headers['cookie'] = filtered;
      },
    ],
  },
});

/**
 * Pitfall 2 fix: drom.ru serves Content-Type: text/html; charset=windows-1251.
 * got's default text decoder assumes UTF-8 and produces mojibake on Cyrillic.
 * Always fetch as Buffer and decode via iconv-lite using the charset advertised
 * in the response Content-Type header. Defaults to utf-8 when no charset is given.
 */
function charsetFromContentType(contentType: string | undefined): string {
  if (!contentType) return 'utf-8';
  const match = contentType.match(/charset=([^;\s]+)/i);
  return match ? match[1].toLowerCase() : 'utf-8';
}

export async function fetchHtml(url: string): Promise<string> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'buffer' });
    limiter.onResponse(response.statusCode);   // SPEC R-5; Pitfall 5: got.retry runs INSIDE .get(), so this sees the FINAL post-retry status
    const charset = charsetFromContentType(response.headers['content-type']);
    return iconv.decode(response.body as Buffer, charset);
  });
}

export async function fetchBuffer(url: string): Promise<Buffer> {
  return httpLimit(async () => {
    await politeDelay();
    const response = await dromClient.get(url, { responseType: 'buffer' });
    return response.body as Buffer;
  });
}

/** Test-only export for integration tests + Plan 07 orchestrator wiring. */
export const _testOnly = { limiter };
