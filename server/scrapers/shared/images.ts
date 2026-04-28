// server/scrapers/shared/images.ts
import sharp from 'sharp';
import pLimit from 'p-limit';
import { fetchBuffer } from './http.js';
import { atomicWriteFile } from './atomic-write.js';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sharpLimit = pLimit(4);   // D-14: parallel sharp encoding (CPU-bound, doesn't affect drom load)

export type ImageWriteResult = { path: string; bytes: number; width: number; height: number };

/**
 * Download an image via the shared http client, transcode to WebP (quality 80),
 * preserve original dimensions, and atomically write under runDir.
 *
 * D-11: one hero WebP per record, quality 80, original dims preserved.
 * Pitfall 5: limitInputPixels caps memory on absurdly large source images.
 */
export async function downloadAndConvert(
  imageUrl: string,
  outRelative: string,        // e.g. 'images/bmw-x5-g_2018_8395-hero.webp'
  runDir: string              // e.g. 'data/scraped/drom/2026-04-28T07-30-00Z'
): Promise<ImageWriteResult> {
  return sharpLimit(async () => {
    const buf = await fetchBuffer(imageUrl);
    const pipeline = sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error' });
    const meta = await pipeline.metadata();
    const webp = await pipeline.webp({ quality: 80 }).toBuffer();
    const target = resolve(runDir, outRelative);
    await mkdir(dirname(target), { recursive: true });
    await atomicWriteFile(target, webp);
    return {
      path: outRelative,
      bytes: webp.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  });
}

/**
 * Pure transcode (no network) — used by tests against the fixture.
 * Public so the orchestrator could later add cached re-encode without re-fetching.
 */
export async function transcodeBufferToWebp(
  buf: Buffer,
  outRelative: string,
  runDir: string,
): Promise<ImageWriteResult> {
  return sharpLimit(async () => {
    const pipeline = sharp(buf, { limitInputPixels: 50_000_000, failOn: 'error' });
    const meta = await pipeline.metadata();
    const webp = await pipeline.webp({ quality: 80 }).toBuffer();
    const target = resolve(runDir, outRelative);
    await mkdir(dirname(target), { recursive: true });
    await atomicWriteFile(target, webp);
    return {
      path: outRelative,
      bytes: webp.length,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    };
  });
}
