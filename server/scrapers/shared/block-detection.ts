// server/scrapers/shared/block-detection.ts
//
// Source-agnostic block-detection policy reused by every IScraper (drom in Phase 1, Encar/etc. in v1.x).
// Per D-13 (CONTEXT.md):
//   - 5 consecutive thin (<2KB) responses → BlockedError(reason='thin_responses')
//   - body matches a CAPTCHA-CHALLENGE phrase (specific multi-word patterns or
//     widget identifiers, case-insensitive) → BlockedError(reason='captcha')
//   - any healthy response (≥2KB, no captcha keyword) resets the thin counter
//
// Architectural change after plan-09 live smoke (2026-04-28):
//   The original keyword set used bare words /проверка/i, /robot/i, /verify/i
//   which false-positive on legitimate nav copy ("Проверка по VIN" on drom's
//   brand index, "robotics" / "verified" on countless sites). Tightened to
//   require either a captcha-widget identifier or a specific multi-word
//   challenge phrase. Validated against the live drom catalog response.
//
// Threat-model (T-03-02): bounded patterns only — fixed-width gaps `{0,40}` in
// multi-word phrases, no nested quantifiers — no ReDoS surface.

const THIN_THRESHOLD_BYTES = 2_048;
const CONSECUTIVE_THIN_LIMIT = 5;
const CAPTCHA_KEYWORDS: RegExp[] = [
  /captcha/i,
  /recaptcha|hcaptcha|cf-(challenge|turnstile)/i,
  /капча/i,
  /я не робот/i,
  /подтвердите.{0,40}не робот/i,
  /введите.{0,40}символ/i,
];

export type BlockReason = 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error';

export class BlockedError extends Error {
  constructor(
    public reason: BlockReason,
    public sampleUrl?: string,
  ) {
    super(`Blocked: ${reason}${sampleUrl ? ` (${sampleUrl})` : ''}`);
    this.name = 'BlockedError';
  }
}

export class BlockDetector {
  private thinCount = 0;

  /**
   * Inspect a fetched response body. Throws BlockedError when D-13 thresholds trip.
   * Counter is reset on a healthy response (≥THIN_THRESHOLD_BYTES, no captcha keyword).
   */
  inspect(url: string, body: string): void {
    if (CAPTCHA_KEYWORDS.some((re) => re.test(body))) {
      throw new BlockedError('captcha', url);
    }
    const size = Buffer.byteLength(body, 'utf-8');
    if (size < THIN_THRESHOLD_BYTES) {
      this.thinCount++;
      if (this.thinCount >= CONSECUTIVE_THIN_LIMIT) {
        throw new BlockedError('thin_responses', url);
      }
    } else {
      this.thinCount = 0;
    }
  }

  /** Test-only accessor for counter introspection. */
  get consecutiveThin(): number {
    return this.thinCount;
  }
}
