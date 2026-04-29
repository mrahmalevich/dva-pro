// server/scrapers/shared/cursor.ts
import { readFile, unlink } from 'node:fs/promises';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';

/**
 * D-15 brand-boundary cursor.
 *
 * Pitfall 3 trade-off (RESEARCH.md lines 818-826): brand-boundary checkpointing
 * is coarser than ideal — worst-case ~7 hours wasted on a mid-brand crash.
 * Phase 1 keeps this simple; finer-grained cursor is a Phase 1.x candidate.
 *
 * Plan 01-11 (gap-closure): readCursor distinguishes ENOENT from corrupt JSON
 * and validates shape via zod (WR-04 fix).
 *
 * Plan 01-16 (gap-closure): the cursor file path is now an EXTERNAL concern.
 * Callers (the drom orchestrator) own the path and pass it explicitly. The
 * canonical location is `data/scraped/drom/.cursor.json` at the brand root —
 * NOT inside per-run runDirs (which are fresh per invocation and would defeat
 * cross-invocation resume). See data/scraped/README.md §"Crash recovery".
 */

export const CursorSchema = z.object({
  lastBrandSlug: z.string().min(1),
  lastModelSlug: z.string().min(1),
  // SPEC R-4 / D-01..D-03: per-trim resume granularity.
  //   - null on a fresh model (D-03 reset at model boundary).
  //   - undefined for cursors written before phase 01.1 (backward-compat).
  //   - non-negative integer = next trim index to process within the in-flight generation.
  lastComplectationIndex: z.number().int().min(0).nullable().optional(),
  completedAt: z.string().datetime(),
});
export type Cursor = z.infer<typeof CursorSchema>;

/**
 * Thrown when the cursor file exists but cannot be parsed as a valid Cursor.
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

/**
 * Read the cursor file at `cursorPath`. Returns null on ENOENT (fresh start).
 * Throws CorruptCursorError on corrupt JSON or shape mismatch. Propagates
 * other read errors (EACCES, etc.) unchanged.
 */
export async function readCursor(cursorPath: string): Promise<Cursor | null> {
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

/**
 * Atomically write the cursor to `cursorPath`. The caller is responsible for
 * ensuring the parent directory exists.
 */
export async function writeCursor(cursorPath: string, cursor: Cursor): Promise<void> {
  await atomicWriteFile(cursorPath, JSON.stringify(cursor, null, 2));
}

/**
 * Idempotently delete the cursor file. No-op on ENOENT.
 */
export async function deleteCursor(cursorPath: string): Promise<void> {
  await unlink(cursorPath).catch(() => {
    /* idempotent — no throw if absent */
  });
}
