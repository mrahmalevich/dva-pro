// server/tests/brand-aliases.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mergeAliases, type AliasMap } from '../scrapers/shared/brand-aliases.js';

let workDir = '';
let aliasesPath = '';

beforeEach(async () => {
  workDir = await mkdtemp(resolve(tmpdir(), 'dva-aliases-'));
  aliasesPath = resolve(workDir, 'brand-aliases.json');
});

afterEach(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

const sample: AliasMap = {
  bmw: {
    ru: 'БМВ',
    latin: 'BMW',
    models: {
      x5: { ru: 'Х5', latin: 'X5' },
      x3: { ru: 'Х3', latin: 'X3' },
    },
  },
  audi: {
    ru: 'Ауди',
    latin: 'Audi',
    models: {
      a4: { ru: 'А4', latin: 'A4' },
    },
  },
};

describe('mergeAliases (D-16, SCRAPE-10)', () => {
  it('creates the file when missing and writes sorted keys', async () => {
    await mergeAliases(aliasesPath, sample);
    const contents = await readFile(aliasesPath, 'utf-8');
    const parsed = JSON.parse(contents) as AliasMap;
    expect(Object.keys(parsed)).toEqual(['audi', 'bmw']); // sorted alphabetically
    expect(Object.keys(parsed.bmw.models)).toEqual(['x3', 'x5']); // model keys sorted
  });

  it('is byte-identical when run twice with same input (idempotency)', async () => {
    await mergeAliases(aliasesPath, sample);
    const first = await readFile(aliasesPath, 'utf-8');
    await mergeAliases(aliasesPath, sample);
    const second = await readFile(aliasesPath, 'utf-8');
    expect(second).toBe(first);
  });

  it('preserves prior brands when a new brand is added', async () => {
    await mergeAliases(aliasesPath, sample);
    const additions: AliasMap = {
      mercedes: {
        ru: 'Мерседес',
        latin: 'Mercedes',
        models: { glc: { ru: 'ГЛК', latin: 'GLC' } },
      },
    };
    await mergeAliases(aliasesPath, additions);
    const merged = JSON.parse(await readFile(aliasesPath, 'utf-8')) as AliasMap;
    expect(Object.keys(merged)).toEqual(['audi', 'bmw', 'mercedes']);
    expect(merged.bmw.models.x5).toEqual({ ru: 'Х5', latin: 'X5' });
    expect(merged.audi.models.a4).toEqual({ ru: 'А4', latin: 'A4' });
  });

  it('union-merges models for an existing brand (last-write-wins on collisions)', async () => {
    await mergeAliases(aliasesPath, sample);
    const more: AliasMap = {
      bmw: {
        ru: 'БМВ',
        latin: 'BMW',
        models: {
          x5: { ru: 'Х5 (обновлено)', latin: 'X5' },  // overwrites existing x5
          m3: { ru: 'М3', latin: 'M3' },              // new model
        },
      },
    };
    await mergeAliases(aliasesPath, more);
    const merged = JSON.parse(await readFile(aliasesPath, 'utf-8')) as AliasMap;
    expect(merged.bmw.models.x5.ru).toBe('Х5 (обновлено)'); // last-write-wins
    expect(merged.bmw.models.x3.ru).toBe('Х3');             // preserved
    expect(merged.bmw.models.m3.ru).toBe('М3');             // added
    expect(Object.keys(merged.bmw.models)).toEqual(['m3', 'x3', 'x5']); // sorted
  });

  it('handles a corrupt existing file (treats as empty and overwrites)', async () => {
    await mkdir(workDir, { recursive: true });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(aliasesPath, '{not valid json');
    await expect(mergeAliases(aliasesPath, sample)).resolves.toBeUndefined();
    const merged = JSON.parse(await readFile(aliasesPath, 'utf-8')) as AliasMap;
    expect(Object.keys(merged)).toEqual(['audi', 'bmw']);
  });
});
