// server/tests/symlink.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, readlink, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pointCurrentAt } from '../scrapers/shared/symlink.js';

let baseDir = '';

beforeEach(async () => {
  baseDir = await mkdtemp(resolve(tmpdir(), 'dva-symlink-'));
});

afterEach(async () => {
  if (baseDir) await rm(baseDir, { recursive: true, force: true });
});

describe('pointCurrentAt (D-08, A7)', () => {
  it('creates the current symlink on first invocation', async () => {
    const runId = '2026-04-28T07-30-00Z';
    const runDir = resolve(baseDir, runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(resolve(runDir, 'models.json'), '[]');

    await pointCurrentAt(runDir);

    const linkTarget = await readlink(resolve(baseDir, 'current'));
    expect(linkTarget).toBe(runId); // RELATIVE target

    // Reader path resolves into the new run dir
    const body = await readFile(resolve(baseDir, 'current/models.json'), 'utf-8');
    expect(body).toBe('[]');
  });

  it('replaces an existing current symlink atomically (visibility property)', async () => {
    const runIdA = '2026-04-28T07-30-00Z';
    const runIdB = '2026-04-28T08-30-00Z';
    const runDirA = resolve(baseDir, runIdA);
    const runDirB = resolve(baseDir, runIdB);
    await mkdir(runDirA, { recursive: true });
    await mkdir(runDirB, { recursive: true });
    await writeFile(resolve(runDirA, 'models.json'), '"run-A"');
    await writeFile(resolve(runDirB, 'models.json'), '"run-B"');

    await pointCurrentAt(runDirA);
    expect(await readFile(resolve(baseDir, 'current/models.json'), 'utf-8')).toBe('"run-A"');

    // Replace; reader sees either A or B, never a missing path
    await pointCurrentAt(runDirB);
    expect(await readFile(resolve(baseDir, 'current/models.json'), 'utf-8')).toBe('"run-B"');

    const linkTarget = await readlink(resolve(baseDir, 'current'));
    expect(linkTarget).toBe(runIdB);
  });

  it('does not leave .tmp.* link artifacts after successful update', async () => {
    const runDir = resolve(baseDir, '2026-04-28T07-30-00Z');
    await mkdir(runDir, { recursive: true });
    await pointCurrentAt(runDir);

    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(baseDir);
    const tmpEntries = entries.filter((e) => e.includes('current.tmp'));
    expect(tmpEntries).toEqual([]);
  });

  it('symlink target is relative (survives parent directory move)', async () => {
    const runDir = resolve(baseDir, '2026-04-28T07-30-00Z');
    await mkdir(runDir, { recursive: true });
    await pointCurrentAt(runDir);

    const target = await readlink(resolve(baseDir, 'current'));
    // Should be just the basename, not an absolute path
    expect(target).toBe('2026-04-28T07-30-00Z');
    expect(target.startsWith('/')).toBe(false);
    expect(target.includes(baseDir)).toBe(false);
  });
});
