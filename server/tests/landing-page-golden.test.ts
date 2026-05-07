// server/tests/landing-page-golden.test.ts
// Phase 02 D-02 / D-02a: structural-drift guard for the public landing page.
// Threshold tuned to 0.22 against as-shipped baseline of 18.74% (see 02-RESEARCH.md §3).
// Test self-orchestrates Vite dev server bring-up; no external orchestration required.

import { describe, it, expect } from 'vitest';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const REFERENCE = resolve('.planning/phases/02-redesign-from-screenshot/design-reference.png');
const DIFF_PATH = resolve('server/tests/__snapshots__/landing-page-golden.diff.png');
const VIEWPORT = { width: 1280, height: 4000 };
const REF_W = 605;
const REF_H = 1280;
const DIFF_THRESHOLD = 0.22; // 22% — empirical as-shipped floor 18.74% + 3.26pp safety band; see 02-RESEARCH.md §3
const DEV_URL = 'http://127.0.0.1:5173/';

async function bringUpDevServer(): Promise<ChildProcess> {
  const child = spawn('pnpm', ['exec', 'vite', '--port', '5173', '--host', '127.0.0.1'], {
    stdio: 'pipe',
  });
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(DEV_URL);
      if (res.ok) return child;
    } catch {
      /* not ready yet */
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  child.kill();
  throw new Error('dev server did not start within 30s');
}

describe('landing-page-golden screenshot golden (Phase 02 D-02)', () => {
  it(
    'SPA matches design-reference.png within 22% structural-drift threshold',
    async () => {
      const dev = await bringUpDevServer();
      let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
      try {
        browser = await puppeteer.launch({
          headless: true,
          args: ['--font-render-hinting=none', '--disable-font-subpixel-positioning'],
        });
        const page = await browser.newPage();
        await page.setViewport(VIEWPORT);
        await page.goto(DEV_URL, { waitUntil: 'networkidle0', timeout: 30_000 });
        await new Promise(r => setTimeout(r, 1500)); // font + Reveal/Counter settle

        const screenshotData = await page.screenshot({ type: 'png', fullPage: true });
        // puppeteer 24.x returns Uint8Array; pngjs requires a Node.js Buffer.
        const captureBuf = Buffer.isBuffer(screenshotData)
          ? screenshotData
          : Buffer.from(screenshotData as Uint8Array);

        const resizedBuf = await sharp(captureBuf)
          .resize(REF_W, REF_H, { kernel: 'cubic', fit: 'fill' })
          .png()
          .toBuffer();

        const actualPng = PNG.sync.read(resizedBuf);
        const expectedPng = PNG.sync.read(await readFile(REFERENCE));
        expect(actualPng.width).toBe(expectedPng.width);
        expect(actualPng.height).toBe(expectedPng.height);

        const diff = new PNG({ width: REF_W, height: REF_H });
        const mismatched = pixelmatch(
          actualPng.data,
          expectedPng.data,
          diff.data,
          REF_W,
          REF_H,
          { threshold: 0.1 },
        );
        const ratio = mismatched / (REF_W * REF_H);

        if (ratio > DIFF_THRESHOLD) {
          await writeFile(DIFF_PATH, PNG.sync.write(diff));
          console.error(
            `[landing-page-golden] Diff ratio ${(ratio * 100).toFixed(2)}% > threshold ${DIFF_THRESHOLD * 100}%. Diff: ${DIFF_PATH}`,
          );
        }
        expect(ratio).toBeLessThanOrEqual(DIFF_THRESHOLD);
      } finally {
        await browser?.close();
        dev.kill();
      }
    },
    60_000,
  );
});
