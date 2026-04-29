import { describe, it, expect } from 'vitest';
import { ProbeDownLimiter } from '../scrapers/shared/rate-limiter.js';

describe('ProbeDownLimiter (R-5)', () => {
  it('starts at 10s ceiling', () => {
    expect(new ProbeDownLimiter().getDelayMs()).toBe(10_000);
  });

  it('halves to 5s after 100 consecutive 200 OKs', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 100; i++) l.onResponse(200);
    expect(l.getDelayMs()).toBe(5_000);
  });

  it('floor 5s never crossed (200 consecutive OKs caps at 5s, not 2.5s)', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 200; i++) l.onResponse(200);
    expect(l.getDelayMs()).toBe(5_000);
  });

  it('resets to 10s on 429', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 100; i++) l.onResponse(200);
    expect(l.getDelayMs()).toBe(5_000);
    l.onResponse(429);
    expect(l.getDelayMs()).toBe(10_000);
  });

  it('resets to 10s on 5xx', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 100; i++) l.onResponse(200);
    l.onResponse(503);
    expect(l.getDelayMs()).toBe(10_000);
  });

  it('onBlock() resets ceiling and counter', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 99; i++) l.onResponse(200);
    l.onBlock();
    expect(l.getDelayMs()).toBe(10_000);
    expect(l.consecutiveOkCount).toBe(0);
  });

  it('3xx and unhandled status codes leave delay unchanged', () => {
    const l = new ProbeDownLimiter();
    for (let i = 0; i < 99; i++) l.onResponse(200);  // counter at 99, delay still 10s
    l.onResponse(301);  // no-op
    l.onResponse(404);  // no-op (4xx except 429)
    l.onResponse(200);  // counter at 100 -> halve
    expect(l.getDelayMs()).toBe(5_000);
  });
});
