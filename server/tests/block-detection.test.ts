// server/tests/block-detection.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BlockDetector, BlockedError } from '../scrapers/shared/block-detection.js';

const fixture = (rel: string) => readFileSync(resolve('server/tests/fixtures', rel), 'utf-8');

const HEALTHY_BODY = '<html><body>'.padEnd(3_000, 'x') + '</body></html>'; // > 2KB

describe('BlockDetector — thin-response counter (D-13)', () => {
  it('does not throw after 4 consecutive thin responses', () => {
    const det = new BlockDetector();
    const thin = fixture('drom/thin-response.html');
    for (let i = 0; i < 4; i++) {
      det.inspect(`https://drom.ru/page-${i}`, thin);
    }
    expect(det.consecutiveThin).toBe(4);
  });

  it('throws BlockedError on the 5th consecutive thin response', () => {
    const det = new BlockDetector();
    const thin = fixture('drom/thin-response.html');
    for (let i = 0; i < 4; i++) {
      det.inspect(`https://drom.ru/page-${i}`, thin);
    }
    expect(() => det.inspect('https://drom.ru/page-5', thin)).toThrow(BlockedError);
    try {
      det.inspect('https://drom.ru/page-6', thin);
    } catch (e) {
      expect(e).toBeInstanceOf(BlockedError);
      expect((e as BlockedError).reason).toBe('thin_responses');
    }
  });

  it('resets the counter after a healthy response', () => {
    const det = new BlockDetector();
    const thin = fixture('drom/thin-response.html');
    for (let i = 0; i < 4; i++) {
      det.inspect(`https://drom.ru/page-${i}`, thin);
    }
    expect(det.consecutiveThin).toBe(4);
    det.inspect('https://drom.ru/healthy', HEALTHY_BODY);
    expect(det.consecutiveThin).toBe(0);
    // 5 more thin would now have to accumulate again
    for (let i = 0; i < 4; i++) {
      det.inspect(`https://drom.ru/page-thin-${i}`, thin);
    }
    expect(det.consecutiveThin).toBe(4); // would only throw on the next thin
  });
});

describe('BlockDetector — captcha keyword (D-13)', () => {
  it('throws BlockedError when body contains "капча"', () => {
    const det = new BlockDetector();
    const captchaBody = fixture('drom/captcha-response.html');
    expect(() => det.inspect('https://drom.ru/captcha', captchaBody)).toThrow(BlockedError);
    try {
      det.inspect('https://drom.ru/captcha', captchaBody);
    } catch (e) {
      expect((e as BlockedError).reason).toBe('captcha');
    }
  });

  it('throws on "проверка" (case-insensitive)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' Проверка безопасности';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on "robot"', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' Are you a robot?';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on "verify"', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' Please verify';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('does not throw on a clean healthy body', () => {
    const det = new BlockDetector();
    expect(() => det.inspect('https://drom.ru/clean', HEALTHY_BODY)).not.toThrow();
  });
});
