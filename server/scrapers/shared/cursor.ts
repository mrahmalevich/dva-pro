// server/scrapers/shared/cursor.ts
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { atomicWriteFile } from './atomic-write.js';

/**
 * D-15 brand-boundary cursor.
 *
 * Pitfall 3 trade-off (RESEARCH.md lines 818-826): brand-boundary checkpointing
 * is coarser than ideal — worst-case ~7 hours wasted on a mid-brand crash.
 * Phase 1 keeps this simple; finer-grained cursor is a Phase 1.x candidate.
 * Documented in `data/scraped/README.md` (plan 08).
 */
export type Cursor = {
  lastBrandSlug: string;
  lastModelSlug: string;
  completedAt: string;     // ISO-8601 UTC
};

const CURSOR_FILENAME = '.cursor.json';

export async function readCursor(runDir: string): Promise<Cursor | null> {
  try {
    const raw = await readFile(resolve(runDir, CURSOR_FILENAME), 'utf-8');
    return JSON.parse(raw) as Cursor;
  } catch {
    return null;
  }
}

export async function writeCursor(runDir: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(resolve(runDir, CURSOR_FILENAME), JSON.stringify(cursor, null, 2));
}

export async function deleteCursor(runDir: string): Promise<void> {
  await unlink(resolve(runDir, CURSOR_FILENAME)).catch(() => {
    /* idempotent — no throw if absent (run completed cleanly) */
  });
}
