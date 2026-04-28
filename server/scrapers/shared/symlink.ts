// server/scrapers/shared/symlink.ts
import { symlink, rename } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';

/**
 * D-08 atomic symlink update for `data/scraped/drom/current/`.
 *
 * Pattern (RESEARCH.md A7): write a tmp symlink, then `rename()` to the target name.
 * POSIX `rename()` over an existing symlink is atomic on the same filesystem
 * (verified for macOS APFS and Linux ext4 — production targets per CLAUDE.md).
 *
 * Symlink target is RELATIVE (basename of runDir) so the link survives if the
 * parent directory is moved.
 *
 * Windows: out of scope for v1 (team uses macOS dev + Linux CI per CLAUDE.md).
 * Documented in `data/scraped/README.md` (plan 08).
 */
export async function pointCurrentAt(runDir: string): Promise<void> {
  const linkPath = resolve(dirname(runDir), 'current');
  const tmpLink = `${linkPath}.tmp.${process.pid}.${Date.now()}`;
  // Symlink target is RELATIVE so the link survives directory moves.
  await symlink(basename(runDir), tmpLink, 'dir');
  // rename() atomically replaces an existing symlink on POSIX.
  await rename(tmpLink, linkPath);
}
