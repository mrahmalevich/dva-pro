// server/scrapers/shared/rate-limiter.ts
//
// SPEC R-5: probe-down polite-delay state machine for the drom scraper.
//   - Start at 10000ms (ceiling).
//   - After 100 consecutive 2xx responses, halve to floor 5000ms.
//   - On any 429 / 5xx, reset to ceiling 10000ms; reset consecutive-OK counter.
//   - onBlock() (block-detector match) resets the same way.
// Pure state machine: no I/O, no setTimeout. The HTTP wrapper sleeps
// getDelayMs() ms before each request and feeds response.statusCode back via
// onResponse(). Pitfall 5: the wrapper feeds the FINAL post-retry status only
// (got.retry handles 429/5xx internally; the limiter never sees per-attempt status).

const FLOOR_MS = 5_000;
const CEIL_MS = 10_000;
const HALVE_AFTER_OK = 100;

export class ProbeDownLimiter {
  private delayMs = CEIL_MS;
  private consecutiveOk = 0;

  /** Current polite delay between sequential requests, in milliseconds. */
  getDelayMs(): number {
    return this.delayMs;
  }

  /** Feed each request's FINAL post-retry status. */
  onResponse(statusCode: number): void {
    if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
      this.delayMs = CEIL_MS;
      this.consecutiveOk = 0;
      return;
    }
    if (statusCode >= 200 && statusCode < 300) {
      this.consecutiveOk++;
      if (this.consecutiveOk >= HALVE_AFTER_OK) {
        this.delayMs = Math.max(FLOOR_MS, Math.floor(this.delayMs / 2));
        this.consecutiveOk = 0;
      }
      return;
    }
    // 3xx, 4xx (except 429), or other unexpected: do nothing (delay unchanged).
  }

  /** Reset on block-detection match (captcha keywords, thin responses). */
  onBlock(): void {
    this.delayMs = CEIL_MS;
    this.consecutiveOk = 0;
  }

  /** Test-only accessor mirroring BlockDetector.consecutiveThin. */
  get consecutiveOkCount(): number {
    return this.consecutiveOk;
  }
}
