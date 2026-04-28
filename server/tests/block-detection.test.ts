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

describe('BlockDetector — captcha challenge phrases (D-13, tightened post-plan-09)', () => {
  it('throws BlockedError on the captcha fixture (matches "капча" + "не робот")', () => {
    const det = new BlockDetector();
    const captchaBody = fixture('drom/captcha-response.html');
    expect(() => det.inspect('https://drom.ru/captcha', captchaBody)).toThrow(BlockedError);
    try {
      det.inspect('https://drom.ru/captcha', captchaBody);
    } catch (e) {
      expect((e as BlockedError).reason).toBe('captcha');
    }
  });

  it('throws on a body containing "captcha" (English/standard widget)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <form id="captcha-form">enter the captcha</form>';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on a recaptcha widget marker', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <div class="g-recaptcha" data-sitekey="x"></div>';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on Russian "Я не робот"', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <h1>Я не робот</h1>';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on "Подтвердите, что вы не робот" (multi-word challenge)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <p>Подтвердите, что вы не робот</p>';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  it('throws on "Введите символы с изображения" (captcha image directive)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <p>Введите символы с изображения</p>';
    expect(() => det.inspect('https://drom.ru/x', body)).toThrow(BlockedError);
  });

  // Regression: legitimate drom nav copy that previously false-positive'd in the live smoke.
  it('does NOT throw on legitimate drom nav "Проверка по VIN"', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <a href="/vin">Проверка по VIN</a>';
    expect(() => det.inspect('https://drom.ru/catalog/', body)).not.toThrow();
  });

  // Regression: vague "проверка" alone (no captcha context) must not block.
  it('does NOT throw on bare "Проверка безопасности" (vague — no captcha indicator)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <p>Проверка безопасности данных</p>';
    expect(() => det.inspect('https://drom.ru/x', body)).not.toThrow();
  });

  // Regression: bare English words without a captcha phrase must not block.
  it('does NOT throw on bare "robot" or "verify" (too generic)', () => {
    const det = new BlockDetector();
    const body = HEALTHY_BODY + ' <p>Robot vacuum reviews — please verify your subscription</p>';
    expect(() => det.inspect('https://drom.ru/x', body)).not.toThrow();
  });

  it('does not throw on a clean healthy body', () => {
    const det = new BlockDetector();
    expect(() => det.inspect('https://drom.ru/clean', HEALTHY_BODY)).not.toThrow();
  });
});
