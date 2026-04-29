// server/tests/cursor.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { existsSync } from 'node:fs';
import {
  readCursor,
  writeCursor,
  deleteCursor,
  CorruptCursorError,
  type Cursor,
} from '../scrapers/shared/cursor.js';

let runDir = '';
let cursorPath = '';

beforeEach(async () => {
  runDir = await mkdtemp(resolve(tmpdir(), 'dva-cursor-'));
  // Plan 01-16: callers own the cursor path; the canonical filename is
  // `.cursor.json` but the path itself is no longer derived inside the
  // cursor module. Test compute the path explicitly, mirroring how the
  // drom orchestrator computes `cursorPath = resolve(runRoot, '.cursor.json')`.
  cursorPath = resolve(runDir, '.cursor.json');
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
    expect(await readCursor(cursorPath)).toBeNull();
  });

  it('readCursor throws CorruptCursorError when .cursor.json is corrupt JSON (WR-04 fix)', async () => {
    await writeFile(cursorPath, '{not json');
    await expect(readCursor(cursorPath)).rejects.toBeInstanceOf(CorruptCursorError);
    await expect(readCursor(cursorPath)).rejects.toThrow(/corrupt JSON/);
  });

  it('readCursor throws CorruptCursorError when .cursor.json has shape mismatch', async () => {
    // Valid JSON but missing required fields (lastModelSlug, completedAt).
    await writeFile(cursorPath, JSON.stringify({ lastBrandSlug: 'bmw' }));
    await expect(readCursor(cursorPath)).rejects.toBeInstanceOf(CorruptCursorError);
    await expect(readCursor(cursorPath)).rejects.toThrow(/shape mismatch/);
  });

  it('readCursor throws CorruptCursorError when a field is the wrong type', async () => {
    await writeFile(
      cursorPath,
      JSON.stringify({
        lastBrandSlug: 42, // wrong type — must be string
        lastModelSlug: 'x5',
        completedAt: '2026-04-28T12:00:00.000Z',
      }),
    );
    await expect(readCursor(cursorPath)).rejects.toBeInstanceOf(CorruptCursorError);
  });

  it('readCursor propagates non-ENOENT read errors unchanged (EACCES is NOT wrapped in CorruptCursorError; Behavior 6)', async () => {
    // Seed a real file so the path exists, then chmod 000 to force a real
    // EACCES from the OS. This pins the contract that ONLY ENOENT becomes
    // null and ONLY parse/shape failures become CorruptCursorError; any other
    // OS-level read error propagates unchanged.
    //
    // Plan-vs-implementation note (01-11 deviation): the plan's recommended
    // approach `vi.spyOn(fsPromises, 'readFile')` is structurally unsupported
    // in vitest 3.x under ESM ("Cannot spy on export 'readFile'. Module
    // namespace is not configurable in ESM."). A real-FS EACCES via chmod 000
    // exercises the same code path with stronger fidelity (no mock layer),
    // and is the conventional vitest ESM pattern for filesystem-level errors.
    // Skipped automatically if the test runs as root (CI containers), since
    // root bypasses POSIX file permissions.
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      // running as root — POSIX read permissions don't apply, can't synthesize EACCES
      return;
    }
    await writeFile(cursorPath, JSON.stringify(sample));
    const { chmod } = await import('node:fs/promises');
    await chmod(cursorPath, 0o000);
    try {
      try {
        await readCursor(cursorPath);
        throw new Error('readCursor should have rejected with EACCES');
      } catch (err) {
        // MUST NOT be CorruptCursorError — it must be the original ErrnoException.
        expect(err).not.toBeInstanceOf(CorruptCursorError);
        expect((err as NodeJS.ErrnoException).code).toBe('EACCES');
        expect((err as Error).message).toMatch(/EACCES/);
      }
    } finally {
      // Restore perms so afterEach `rm -rf` can remove the file.
      await chmod(cursorPath, 0o600).catch(() => undefined);
    }
  });

  it('writeCursor then readCursor round-trips the same object', async () => {
    await writeCursor(cursorPath, sample);
    const got = await readCursor(cursorPath);
    expect(got).toEqual(sample);
  });

  it('writeCursor uses atomic write (no .tmp leftover on success)', async () => {
    await writeCursor(cursorPath, sample);
    expect(existsSync(cursorPath)).toBe(true);
    // No tmp suffix files left behind
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(runDir);
    const tmpFiles = entries.filter((e) => e.includes('.tmp'));
    expect(tmpFiles).toEqual([]);
  });

  it('deleteCursor removes .cursor.json', async () => {
    await writeCursor(cursorPath, sample);
    expect(existsSync(cursorPath)).toBe(true);
    await deleteCursor(cursorPath);
    expect(existsSync(cursorPath)).toBe(false);
  });

  it('deleteCursor is idempotent (no throw when file absent)', async () => {
    // No file written yet; deleteCursor should not throw
    await expect(deleteCursor(cursorPath)).resolves.toBeUndefined();
    // Calling again still fine
    await expect(deleteCursor(cursorPath)).resolves.toBeUndefined();
  });

  it('"kill mid-run" simulation: writeCursor + leave file → next process reads it', async () => {
    // Process A: write a cursor, then "die" mid-run
    await writeCursor(cursorPath, { ...sample, lastModelSlug: 'x3' });
    // Process B: starts fresh; reads cursor; resumes
    const resumed = await readCursor(cursorPath);
    expect(resumed).toEqual({ ...sample, lastModelSlug: 'x3' });
    // Process B successfully completes and clears the cursor
    await deleteCursor(cursorPath);
    expect(await readCursor(cursorPath)).toBeNull();
  });
});

describe('CursorSchema lastComplectationIndex (Phase 01.1, D-01..D-03)', () => {
  it('forward-compat: cursor with lastComplectationIndex=12 round-trips', async () => {
    const cursor = {
      lastBrandSlug: 'bmw',
      lastModelSlug: 'x5',
      lastComplectationIndex: 12,
      completedAt: '2026-04-29T12:00:00.000Z',
    };
    await writeCursor(cursorPath, cursor);
    const read = await readCursor(cursorPath);
    expect(read).not.toBeNull();
    expect(read!.lastComplectationIndex).toBe(12);
    expect(read!.lastBrandSlug).toBe('bmw');
    expect(read!.lastModelSlug).toBe('x5');
  });

  it('backward-compat: legacy Phase-01 cursor without lastComplectationIndex parses cleanly', async () => {
    const legacyJson = JSON.stringify({
      lastBrandSlug: 'bmw',
      lastModelSlug: 'x5',
      completedAt: '2026-04-29T12:00:00.000Z',
    });
    await writeFile(cursorPath, legacyJson, 'utf-8');
    const read = await readCursor(cursorPath);
    expect(read).not.toBeNull();
    expect(read!.lastBrandSlug).toBe('bmw');
    // Field absent → loaded as undefined (or null if zod normalises); accept either.
    expect(read!.lastComplectationIndex == null).toBe(true);
  });

  it('D-03 reset: cursor with lastComplectationIndex=null is accepted', async () => {
    const cursor = {
      lastBrandSlug: 'bmw',
      lastModelSlug: 'x5',
      lastComplectationIndex: null,
      completedAt: '2026-04-29T12:00:00.000Z',
    };
    await writeCursor(cursorPath, cursor);
    const read = await readCursor(cursorPath);
    expect(read).not.toBeNull();
    expect(read!.lastComplectationIndex).toBeNull();
  });

  it('rejects negative lastComplectationIndex (zod .min(0) constraint) → CorruptCursorError', async () => {
    const malformed = JSON.stringify({
      lastBrandSlug: 'bmw',
      lastModelSlug: 'x5',
      lastComplectationIndex: -1,
      completedAt: '2026-04-29T12:00:00.000Z',
    });
    await writeFile(cursorPath, malformed, 'utf-8');
    await expect(readCursor(cursorPath)).rejects.toThrow(CorruptCursorError);
  });

  it('rejects string lastComplectationIndex (zod .int() constraint) → CorruptCursorError', async () => {
    const malformed = JSON.stringify({
      lastBrandSlug: 'bmw',
      lastModelSlug: 'x5',
      lastComplectationIndex: 'twelve',
      completedAt: '2026-04-29T12:00:00.000Z',
    });
    await writeFile(cursorPath, malformed, 'utf-8');
    await expect(readCursor(cursorPath)).rejects.toThrow(CorruptCursorError);
  });
});
