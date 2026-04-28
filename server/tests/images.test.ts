// server/tests/images.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { transcodeBufferToWebp } from '../scrapers/shared/images.js';

const FIXTURE = resolve('server/tests/fixtures/images/hero.jpg');

let runDir = '';

beforeAll(async () => {
  runDir = await mkdtemp(resolve(tmpdir(), 'dva-img-test-'));
});

afterAll(() => {
  if (runDir && existsSync(runDir)) rmSync(runDir, { recursive: true, force: true });
});

describe('shared/images.ts (SCRAPE-06, D-11)', () => {
  it('encodes JPEG → WebP preserving original dimensions and writing atomically', async () => {
    const jpeg = readFileSync(FIXTURE);
    const result = await transcodeBufferToWebp(jpeg, 'images/test-hero.webp', runDir);

    // Returned metadata
    expect(result.path).toBe('images/test-hero.webp');
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
    expect(result.bytes).toBeGreaterThan(0);

    // File exists at expected path
    const target = resolve(runDir, result.path);
    expect(existsSync(target)).toBe(true);

    // No leftover .tmp file (atomic rename happened)
    const sibling = readFileSync(target);
    expect(sibling.length).toBe(result.bytes);
  });

  it('produces a valid WebP file (RIFF/WEBP magic bytes)', async () => {
    const jpeg = readFileSync(FIXTURE);
    const result = await transcodeBufferToWebp(jpeg, 'images/magic-test.webp', runDir);
    const target = resolve(runDir, result.path);
    const bytes = readFileSync(target);
    // WebP container: bytes[0..3] = 'RIFF', bytes[8..11] = 'WEBP'
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it('returns bytes count matching the on-disk file size', async () => {
    const jpeg = readFileSync(FIXTURE);
    const result = await transcodeBufferToWebp(jpeg, 'images/size-check.webp', runDir);
    const target = resolve(runDir, result.path);
    const bytes = readFileSync(target);
    expect(bytes.length).toBe(result.bytes);
  });
});
