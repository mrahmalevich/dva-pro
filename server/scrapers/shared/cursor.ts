// server/scrapers/shared/cursor.ts
import { readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';

/**
 * D-15 brand-boundary cursor.
 *
 * Pitfall 3 trade-off (RESEARCH.md lines 818-826): brand-boundary checkpointing
 * is coarser than ideal — worst-case ~7 hours wasted on a mid-brand crash.
 * Phase 1 keeps this simple; finer-grained cursor is a Phase 1.x candidate.
 * Documented in `data/scraped/README.md` (plan 08).
 *
 * Plan 01-11 (gap-closure): readCursor now distinguishes ENOENT from corrupt
 * JSON and validates shape via zod. A hand-edited or truncated cursor file
 * throws CorruptCursorError instead of silently triggering a fresh restart
 * (WR-04 in 01-REVIEW.md).
 */

export const CursorSchema = z.object({
  lastBrandSlug: z.string().min(1),
  lastModelSlug: z.string().min(1),
  completedAt: z.string().datetime(),
});
export type Cursor = z.infer<typeof CursorSchema>;

const CURSOR_FILENAME = '.cursor.json';

/**
 * Thrown when `.cursor.json` exists but cannot be parsed as a valid Cursor.
 * Distinct from "file absent" (returns null) and "file unreadable for OS
 * reasons" (propagates the underlying NodeJS error). Caller should surface
 * this to the operator and refuse to start a fresh run silently.
 */
export class CorruptCursorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'CorruptCursorError';
  }
}

export async function readCursor(runDir: string): Promise<Cursor | null> {
  const cursorPath = resolve(runDir, CURSOR_FILENAME);
  let raw: string;
  try {
    raw = await readFile(cursorPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    // Permission denied, IO error, etc — propagate, do NOT swallow.
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new CorruptCursorError(
      `Cursor at ${cursorPath} is corrupt JSON; refusing to silently restart. ` +
        `Delete the file explicitly to begin a fresh run.`,
      err,
    );
  }
  const result = CursorSchema.safeParse(parsed);
  if (!result.success) {
    throw new CorruptCursorError(
      `Cursor at ${cursorPath} has shape mismatch (expected {lastBrandSlug, lastModelSlug, completedAt}); ` +
        `refusing to silently restart. zod issues: ${JSON.stringify(result.error.issues)}`,
      result.error,
    );
  }
  return result.data;
}

export async function writeCursor(runDir: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(resolve(runDir, CURSOR_FILENAME), JSON.stringify(cursor, null, 2));
}

export async function deleteCursor(runDir: string): Promise<void> {
  await unlink(resolve(runDir, CURSOR_FILENAME)).catch(() => {
    /* idempotent — no throw if absent (run completed cleanly) */
  });
}
