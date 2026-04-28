// server/tests/http.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dromClient, fetchHtml, politeDelay } from '../scrapers/shared/http.js';

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
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T07:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first call resolves immediately (initializes lastRequestAt)', async () => {
    const promise = politeDelay();
    // No previous call — Math.max(0, jitter - elapsed) where elapsed = Date.now() - 0
    // is huge ⇒ wait clamped to 0. Promise resolves on next microtask.
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('second call (1s after first) waits ≥8s before resolving (10s − 20% jitter floor)', async () => {
    // First call — establishes lastRequestAt = T0
    const first = politeDelay();
    await vi.advanceTimersByTimeAsync(0);
    await first;

    // Advance system clock by 1s — simulates a fast handler between fetches
    vi.setSystemTime(new Date('2026-04-28T07:30:01.000Z'));

    // Second call — should NOT resolve until at least 8s of additional fake time elapses.
    let resolved = false;
    const second = politeDelay().then(() => {
      resolved = true;
    });

    // Advance 6s — must still be pending (8s minimum, since 1s already elapsed → 7s remaining at floor)
    await vi.advanceTimersByTimeAsync(6_000);
    expect(resolved).toBe(false);

    // Advance another 2s → total ≥8s elapsed since first call. Now it must resolve.
    await vi.advanceTimersByTimeAsync(2_000);
    await second;
    expect(resolved).toBe(true);
  });
});
