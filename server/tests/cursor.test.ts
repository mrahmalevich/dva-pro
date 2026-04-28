// server/tests/cursor.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import { readCursor, writeCursor, deleteCursor, type Cursor } from '../scrapers/shared/cursor.js';

let runDir = '';

beforeEach(async () => {
  runDir = await mkdtemp(resolve(tmpdir(), 'dva-cursor-'));
});

afterEach(async () => {
  if (runDir) await rm(runDir, { recursive: true, force: true });
});

const sample: Cursor = {
  lastBrandSlug: 'bmw',
  lastModelSlug: 'x5',
  completedAt: '2026-04-28T12:00:00.000Z',
};

describe('cursor.ts (D-15)', () => {
  it('readCursor returns null when .cursor.json is absent', async () => {
    expect(await readCursor(runDir)).toBeNull();
  });

  it('readCursor returns null when .cursor.json is corrupt', async () => {
    await writeFile(resolve(runDir, '.cursor.json'), '{not json');
    expect(await readCursor(runDir)).toBeNull();
  });

  it('writeCursor then readCursor round-trips the same object', async () => {
    await writeCursor(runDir, sample);
    const got = await readCursor(runDir);
    expect(got).toEqual(sample);
  });

  it('writeCursor uses atomic write (no .tmp leftover on success)', async () => {
    await writeCursor(runDir, sample);
    expect(existsSync(resolve(runDir, '.cursor.json'))).toBe(true);
    // No tmp suffix files left behind
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(runDir);
    const tmpFiles = entries.filter((e) => e.includes('.tmp'));
    expect(tmpFiles).toEqual([]);
  });

  it('deleteCursor removes .cursor.json', async () => {
    await writeCursor(runDir, sample);
    expect(existsSync(resolve(runDir, '.cursor.json'))).toBe(true);
    await deleteCursor(runDir);
    expect(existsSync(resolve(runDir, '.cursor.json'))).toBe(false);
  });

  it('deleteCursor is idempotent (no throw when file absent)', async () => {
    // No file written yet; deleteCursor should not throw
    await expect(deleteCursor(runDir)).resolves.toBeUndefined();
    // Calling again still fine
    await expect(deleteCursor(runDir)).resolves.toBeUndefined();
  });

  it('"kill mid-run" simulation: writeCursor + leave file → next process reads it', async () => {
    // Process A: write a cursor, then "die" mid-run
    await writeCursor(runDir, { ...sample, lastModelSlug: 'x3' });
    // Process B: starts fresh; reads cursor; resumes
    const resumed = await readCursor(runDir);
    expect(resumed).toEqual({ ...sample, lastModelSlug: 'x3' });
    // Process B successfully completes and clears the cursor
    await deleteCursor(runDir);
    expect(await readCursor(runDir)).toBeNull();
  });
});
