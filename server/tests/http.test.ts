// server/tests/http.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dromClient, fetchHtml } from '../scrapers/shared/http.js';

function startTestServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, port });
    });
  });
}

describe('shared/http.ts (D-14, A1)', () => {
  it('sends Accept-Language ru-RU on every request', async () => {
    let seenAcceptLanguage = '';
    const { server, port } = await startTestServer((req, res) => {
      seenAcceptLanguage = String(req.headers['accept-language'] ?? '');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>ok</html>');
    });
    try {
      await dromClient.get(`http://127.0.0.1:${port}/`, { responseType: 'text' });
      expect(seenAcceptLanguage).toMatch(/ru-RU/);
    } finally {
      server.close();
    }
  });

  it('retries on 503 with exponential backoff (A1 verifier)', async () => {
    let calls = 0;
    const { server, port } = await startTestServer((_req, res) => {
      calls++;
      if (calls < 3) {
        res.writeHead(503);
        res.end('try again');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>finally ok</html>');
    });
    try {
      const start = Date.now();
      const resp = await dromClient.get(`http://127.0.0.1:${port}/`, {
        responseType: 'text',
        retry: {
          limit: 3,
          statusCodes: [503],
          methods: ['GET'],
          calculateDelay: () => 50,
        },
      });
      const elapsed = Date.now() - start;
      expect(resp.body).toMatch(/finally ok/);
      expect(calls).toBe(3); // 2 failed + 1 success
      expect(elapsed).toBeGreaterThanOrEqual(50); // at least one retry waited
    } finally {
      server.close();
    }
  }, 15_000);

  it('decodes windows-1251 response body via Content-Type charset (Pitfall 2)', async () => {
    // Encode "Лада" + "Проверка" as windows-1251 bytes
    const iconv = await import('iconv-lite');
    const cyrillic = '<html><head><title>Лада</title></head><body>Проверка</body></html>';
    const win1251 = iconv.encode(cyrillic, 'windows-1251');
    const { server, port } = await startTestServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=windows-1251' });
      res.end(win1251);
    });
    try {
      const html = await fetchHtml(`http://127.0.0.1:${port}/`);
      expect(html).toContain('Лада');
      expect(html).toContain('Проверка');
      // No replacement chars from misdecoding
      expect(html).not.toContain('�');
    } finally {
      server.close();
    }
  }, 30_000);

  it('serializes via pLimit(1): two parallel fetches do not overlap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const { server, port } = await startTestServer((_req, res) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      setTimeout(() => {
        inFlight--;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>ok</html>');
      }, 50);
    });
    try {
      // Kick off two fetches in parallel; pLimit(1) must serialize.
      // NOTE: politeDelay() will also gate; the assertion is purely about overlap, not timing.
      await Promise.all([
        fetchHtml(`http://127.0.0.1:${port}/a`),
        fetchHtml(`http://127.0.0.1:${port}/b`),
      ]);
      expect(maxInFlight).toBe(1);
    } finally {
      server.close();
    }
  }, 60_000);
});

describe('politeDelay (D-14)', () => {
  // Each test re-imports the module so module-scoped `lastRequestAt` is fresh
  // and not contaminated by the dromClient tests above (which used real timers).
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T07:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  it('first call resolves immediately (initializes lastRequestAt)', async () => {
    const { politeDelay } = await import('../scrapers/shared/http.js');
    const promise = politeDelay();
    // Module-scoped lastRequestAt is 0 → elapsed = Date.now() (a huge epoch ms) →
    // wait = max(0, jitter - elapsed) = 0. Promise resolves on next microtask.
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('second call (1s after first) waits ≥8s before resolving (10s − 20% jitter floor)', async () => {
    // Force Math.random() = 0.0 so jitter = base * (1 - JITTER_RATIO) = 8000 (the floor).
    // This makes the test deterministic regardless of jitter dice rolls.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const { politeDelay } = await import('../scrapers/shared/http.js');

      // First call — establishes lastRequestAt = T0
      const first = politeDelay();
      await vi.advanceTimersByTimeAsync(0);
      await first;

      // Advance system clock by 1s — simulates a fast handler between fetches
      await vi.advanceTimersByTimeAsync(1_000);

      // Second call — should NOT resolve until at least 7s of additional fake time elapses
      // (8s floor − 1s already elapsed = 7s remaining)
      let resolved = false;
      const second = politeDelay().then(() => {
        resolved = true;
      });

      // Advance 6s — still pending
      await vi.advanceTimersByTimeAsync(6_000);
      expect(resolved).toBe(false);

      // Advance another 2s → total ≥8s elapsed since first call. Now it must resolve.
      await vi.advanceTimersByTimeAsync(2_000);
      await second;
      expect(resolved).toBe(true);
    } finally {
      randomSpy.mockRestore();
    }
  });
});

describe('dromClient cookie strip (D-09..D-11)', () => {
  // Regression test for Gap 1 / VERIFICATION.md:
  // npsPayload accumulates ~8KB across a long crawl and causes HTTP 431 on drom's nginx.
  // The beforeRequest hook in http.ts must strip exactly the three bloat cookies from the
  // outgoing Cookie header while preserving affinity / region cookies.

  it('strips npsPayload, npsType, showNPS from outgoing Cookie header', async () => {
    let seenCookieHeader = '';
    const { server, port } = await startTestServer((req, res) => {
      seenCookieHeader = String(req.headers['cookie'] ?? '');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>ok</html>');
    });
    try {
      // Inject bloat cookies + one affinity cookie directly into the request headers.
      // We bypass the cookie jar here so we can control exactly what arrives at the
      // outgoing-header stage where the beforeRequest hook operates.
      await dromClient.get(`http://127.0.0.1:${port}/`, {
        responseType: 'text',
        headers: {
          cookie: 'ring=abc123; npsPayload=AAAA; npsType=survey; showNPS=1; cookie_cityid=54',
        },
      });
      // Affinity + region cookies MUST survive
      expect(seenCookieHeader).toContain('ring=abc123');
      expect(seenCookieHeader).toContain('cookie_cityid=54');
      // Bloat cookies MUST be absent
      expect(seenCookieHeader).not.toContain('npsPayload');
      expect(seenCookieHeader).not.toContain('npsType');
      expect(seenCookieHeader).not.toContain('showNPS');
    } finally {
      server.close();
    }
  }, 15_000);

  it('passes Cookie header unchanged when no bloat cookies are present', async () => {
    let seenCookieHeader = '';
    const { server, port } = await startTestServer((req, res) => {
      seenCookieHeader = String(req.headers['cookie'] ?? '');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>ok</html>');
    });
    try {
      await dromClient.get(`http://127.0.0.1:${port}/`, {
        responseType: 'text',
        headers: {
          cookie: 'ring=xyz; segSession=sess1; PHPSESSID=abc',
        },
      });
      expect(seenCookieHeader).toContain('ring=xyz');
      expect(seenCookieHeader).toContain('segSession=sess1');
      expect(seenCookieHeader).toContain('PHPSESSID=abc');
    } finally {
      server.close();
    }
  }, 15_000);
});
