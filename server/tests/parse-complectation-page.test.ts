// server/tests/parse-complectation-page.test.ts
//
// Phase 01.1, Plan 05 — fixture-driven tests for parseComplectationPage.
// Covers R-1 (correct extraction), R-3 (six field groups populated), R-6 (fail-soft).
//
// NOTE on label deviations: the actual drom DOM uses different labels than the plan
// specified (e.g. "Число мест" not "Количество мест"). The implementation uses the
// real DOM labels observed in captured fixtures. Tests assert on actual output.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseComplectationPage, type ComplectationPageContext } from '../scrapers/drom/parse-complectation-page.js';
import { Complectation } from '../scrapers/shared/types.js';
import type { TrimRowRef } from '../scrapers/drom/parse-generation-page.js';

const fix = (rel: string) =>
  readFileSync(resolve('server/tests/fixtures/drom/complectation', rel), 'utf-8');

/** Synthetic TrimRowRef seed; tests construct a ctx from this with overrides per fixture. */
const makeCtx = (compId: string, override: Partial<TrimRowRef> = {}): ComplectationPageContext => ({
  brand_slug: 'bmw',
  model_slug: 'x5',
  comp_id: compId,
  sourceUrl: `https://www.drom.ru/catalog/bmw/x5/${compId}/`,
  trimRow: {
    comp_id: compId,
    url: `https://www.drom.ru/catalog/bmw/x5/${compId}/`,
    name: 'xDrive 30d AT Base',
    period_from: '04.2020',
    period_to: '03.2022',
    tier: 'Базовая',
    engine_code: 'B47B20',
    frame_code: 'G05',
    price_new_rub: 7190000,
    price_used_from_rub: null,
    engine_cc: 2993,
    engine_hp: 249,
    engine_fuel: 'diesel',
    drive: 'AWD',
    ...override,
  },
});

describe('parseComplectationPage (R-1, R-3, R-6)', () => {
  it('R-1 + R-3: returns a zod-valid Complectation against captured BMW xDrive 30d Base fixture (207354)', () => {
    const html = fix('207354.html');
    const record = parseComplectationPage(html, makeCtx('207354'));
    const parsed = Complectation.safeParse(record);
    expect(parsed.success).toBe(true);
  });

  it('R-1 + R-3: returns a zod-valid Complectation against M Sport Plus fixture (252766)', () => {
    const html = fix('252766.html');
    const record = parseComplectationPage(html, makeCtx('252766', {
      name: 'xDrive 30d AT M Sport Plus',
      tier: 'Предмаксимальная',
    }));
    expect(Complectation.safeParse(record).success).toBe(true);
  });

  it('R-1 + R-3: returns a zod-valid Complectation against M Competition fixture (265067)', () => {
    const html = fix('265067.html');
    const record = parseComplectationPage(html, makeCtx('265067', {
      name: 'M Competition',
      tier: null,    // M-series may not have a standard tier label
    }));
    expect(Complectation.safeParse(record).success).toBe(true);
  });

  it('R-3: dimensions.length_mm extracted from valid fixture is in [4000, 6000]', () => {
    const record = parseComplectationPage(fix('207354.html'), makeCtx('207354'));
    expect(record.dimensions.length_mm).not.toBeNull();
    expect(record.dimensions.length_mm).toBeGreaterThan(4000);
    expect(record.dimensions.length_mm).toBeLessThan(6000);
  });

  it('Pitfall 3: trunk_min_l is extracted from valid fixture (BMW X5 has 645 L trunk)', () => {
    const record = parseComplectationPage(fix('207354.html'), makeCtx('207354'));
    // BMW X5 G05 trunk is 645 (1860) per live spec.
    // Acceptance: at minimum, trunk_min_l is non-null.
    expect(record.dimensions.trunk_min_l).not.toBeNull();
    expect(record.dimensions.trunk_min_l).toBeGreaterThan(0);
  });

  it('R-3: tires.tires_front is a non-null string on valid fixture', () => {
    const record = parseComplectationPage(fix('207354.html'), makeCtx('207354'));
    expect(typeof record.tires.tires_front).toBe('string');
    expect(record.tires.tires_front!.length).toBeGreaterThan(0);
  });

  it('R-3: comfort.seats is an integer in [2, 9] on valid fixture (BMW X5 has 5 seats)', () => {
    const record = parseComplectationPage(fix('207354.html'), makeCtx('207354'));
    expect(record.comfort.seats).not.toBeNull();
    expect(record.comfort.seats! >= 2 && record.comfort.seats! <= 9).toBe(true);
  });

  it('R-3: drivetrain.transmission_type derived from trim name regex (AT for xDrive 30d AT Base)', () => {
    const record = parseComplectationPage(fix('207354.html'), makeCtx('207354'));
    expect(record.drivetrain.transmission_type).toBe('AT');
  });

  it('R-6: broken-missing-dimensions fixture has null length/width/height (gabarity section missing)', () => {
    const record = parseComplectationPage(fix('broken-missing-dimensions.html'), makeCtx('207354'));
    // The fixture removes "Габариты кузова (Д x Ш x В), мм" combined row —
    // so L/W/H are null, but wheelbase/clearance/trunk/weight fields remain.
    expect(record.dimensions.length_mm).toBeNull();
    expect(record.dimensions.width_mm).toBeNull();
    expect(record.dimensions.height_mm).toBeNull();
    // The fixture does not raise — fail-soft contract preserved
    expect(() => parseComplectationPage(fix('broken-missing-dimensions.html'), makeCtx('207354'))).not.toThrow();
  });

  it('R-6: broken-truncated.html does not raise; returns a Complectation with all-null dimensions', () => {
    expect(() => parseComplectationPage(fix('broken-truncated.html'), makeCtx('207354'))).not.toThrow();
    const record = parseComplectationPage(fix('broken-truncated.html'), makeCtx('207354'));
    // Truncated mid-body; many label-text scans fail; dimensions should be all-null
    const dimensionsAllNull = Object.values(record.dimensions).every((v) => v === null);
    expect(dimensionsAllNull).toBe(true);
  });

  it('R-6: empty string input returns Complectation, never raises', () => {
    expect(() => parseComplectationPage('', makeCtx('999999'))).not.toThrow();
    const record = parseComplectationPage('', makeCtx('999999'));
    expect(Complectation.safeParse(record).success).toBe(true);
  });

  it('R-6: broken-missing-dimensions result is still a zod-valid Complectation', () => {
    const record = parseComplectationPage(fix('broken-missing-dimensions.html'), makeCtx('207354'));
    expect(Complectation.safeParse(record).success).toBe(true);
  });

  it('Identity: source_url comes from ctx.sourceUrl; name comes from ctx.trimRow.name (NOT per-comp HTML)', () => {
    const ctx = makeCtx('207354', { name: 'CUSTOM TRIM NAME' });
    const record = parseComplectationPage(fix('207354.html'), ctx);
    expect(record.identity.source_url).toBe('https://www.drom.ru/catalog/bmw/x5/207354/');
    expect(record.identity.name).toBe('CUSTOM TRIM NAME');
  });

  it('Pricing: price_new_rub and price_used_from_rub come from ctx.trimRow (not per-comp HTML)', () => {
    const ctx = makeCtx('207354', { price_new_rub: 9876543, price_used_from_rub: 5432100 });
    const record = parseComplectationPage(fix('207354.html'), ctx);
    expect(record.pricing.price_new_rub).toBe(9876543);
    expect(record.pricing.price_used_from_rub).toBe(5432100);
  });
});
