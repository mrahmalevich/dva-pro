// server/tests/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { slugify, parsePrice, parseYear } from '../scrapers/shared/normalize.js';

describe('slugify', () => {
  it('lowercases and preserves hyphenated Latin names', () => {
    expect(slugify('BMW')).toBe('bmw');
    expect(slugify('Mercedes-AMG')).toBe('mercedes-amg');
    expect(slugify('Audi RS6')).toBe('audi-rs6');
  });

  it('trims whitespace and collapses internal whitespace to hyphen', () => {
    expect(slugify('  Audi  RS6  ')).toBe('audi-rs6');
  });

  it('transliterates Cyrillic to Latin (D-16 fallback)', () => {
    expect(slugify('Лада')).toBe('lada');
    expect(slugify('Лада Веста')).toBe('lada-vesta');
  });

  it('strips other punctuation but keeps hyphens', () => {
    expect(slugify('Rolls-Royce!')).toBe('rolls-royce');
  });
});

describe('parsePrice', () => {
  it('parses drom display strings with "от" prefix and spaces', () => {
    expect(parsePrice('от 5 470 000')).toBe(5_470_000);
  });

  it('parses display strings with ruble suffix', () => {
    expect(parsePrice('5 470 000 ₽')).toBe(5_470_000);
  });

  it('returns null for non-numeric inputs', () => {
    expect(parsePrice('—')).toBeNull();
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('бесплатно')).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});

describe('parseYear', () => {
  it('parses MM.YYYY - MM.YYYY ranges', () => {
    expect(parseYear('06.2018 - 03.2022')).toEqual({ from: 2018, to: 2022 });
  });

  it('parses MM.YYYY - н.в. (currently produced) → to: null', () => {
    expect(parseYear('06.2018 - н.в.')).toEqual({ from: 2018, to: null });
    expect(parseYear('06.2018 - н. в.')).toEqual({ from: 2018, to: null });
  });

  it('falls back to single 4-digit year', () => {
    expect(parseYear('1999')).toEqual({ from: 1999, to: null });
  });

  it('returns nulls for empty / unparseable', () => {
    expect(parseYear('')).toEqual({ from: null, to: null });
    expect(parseYear(null)).toEqual({ from: null, to: null });
    expect(parseYear('???')).toEqual({ from: null, to: null });
  });
});
