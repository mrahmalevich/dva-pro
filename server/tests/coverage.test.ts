import { describe, it, expect } from 'vitest';
import { computeFieldCoverage, meetsCoverageGate } from '../scrapers/shared/coverage.js';
import type { ModelRecord, Complectation, FieldCoverage } from '../scrapers/shared/types.js';

/** Build a Complectation with all leaves null (passes Plan 02 zod parse). */
const makeAllNullComp = (): Complectation => ({
  identity: {
    name: null, period_from: null, period_to: null, tier: null,
    engine_code: null, frame_code: null, source_url: null,
  },
  pricing: { price_new_rub: null, price_used_from_rub: null },
  drivetrain: {
    engine_cc: null, engine_hp: null, engine_fuel: null,
    drive: null, transmission_type: null, transmission_gears: null,
  },
  dimensions: {
    length_mm: null, width_mm: null, height_mm: null,
    wheelbase_mm: null, clearance_mm: null,
    trunk_min_l: null, trunk_max_l: null,
    curb_weight_kg: null, gross_weight_kg: null,
  },
  comfort: {
    seats: null, doors: null,
    fuel_consumption_city_l: null,
    fuel_consumption_highway_l: null,
    fuel_consumption_combined_l: null,
    tank_l: null,
  },
  tires: { tires_front: null, tires_rear: null },
});

/** Build a Complectation with all leaves non-null (covers every group threshold). */
const makeAllPopulatedComp = (): Complectation => ({
  identity: {
    name: 'xDrive 30d AT Base', period_from: '04.2020', period_to: '03.2022',
    tier: 'Базовая', engine_code: 'B47B20', frame_code: 'G05',
    source_url: 'https://www.drom.ru/catalog/bmw/x5/207354/',
  },
  pricing: { price_new_rub: 7190000, price_used_from_rub: 6000000 },
  drivetrain: {
    engine_cc: 2993, engine_hp: 249, engine_fuel: 'diesel',
    drive: 'AWD', transmission_type: 'AT', transmission_gears: 8,
  },
  dimensions: {
    length_mm: 4922, width_mm: 2004, height_mm: 1745,
    wheelbase_mm: 2975, clearance_mm: 214,
    trunk_min_l: 645, trunk_max_l: 1860,
    curb_weight_kg: 2105, gross_weight_kg: 2890,
  },
  comfort: {
    seats: 5, doors: 5,
    fuel_consumption_city_l: 8.5,
    fuel_consumption_highway_l: 6.2,
    fuel_consumption_combined_l: 7.1,
    tank_l: 80,
  },
  tires: { tires_front: '275/45 R20 110Y', tires_rear: '305/40 R20 112Y' },
});

/** Wrap one or more Complectations into a ModelRecord container. */
const wrapAsRecords = (comps: Complectation[]): ModelRecord[] => [{
  brand: 'BMW',
  brand_slug: 'bmw',
  model: 'X5',
  model_slug: 'x5',
  generation: 'IV (G05)',
  year_from: 2018,
  year_to: null,
  body_types: ['SUV'],
  engine_options: [],
  drive_options: ['AWD'],
  description_ru: 'X5 G05',
  price_min_rub: 7190000,
  price_max_rub: 15000000,
  image_paths: [],
  source: 'drom-catalog' as const,
  source_url: 'https://www.drom.ru/catalog/bmw/x5/g05/',
  scraped_at: '2026-04-29T00:00:00.000Z',
  complectations: comps,
}];

describe('computeFieldCoverage (R-7 / D-05 / D-06 / D-08)', () => {
  it('returns six zeros on empty records input', () => {
    expect(computeFieldCoverage([])).toEqual({
      identity: 0, pricing: 0, drivetrain: 0, dimensions: 0, comfort: 0, tires: 0,
    });
  });

  it('returns 1.0 across all groups for one fully-populated trim', () => {
    const records = wrapAsRecords([makeAllPopulatedComp()]);
    expect(computeFieldCoverage(records)).toEqual({
      identity: 1, pricing: 1, drivetrain: 1, dimensions: 1, comfort: 1, tires: 1,
    });
  });

  it('returns 0 across all groups for one all-null trim', () => {
    const records = wrapAsRecords([makeAllNullComp()]);
    expect(computeFieldCoverage(records)).toEqual({
      identity: 0, pricing: 0, drivetrain: 0, dimensions: 0, comfort: 0, tires: 0,
    });
  });

  it('threshold edge: identity with exactly 5 non-null (out of 7) meets threshold', () => {
    const c = makeAllNullComp();
    c.identity = {
      name: 'X', period_from: '04.2020', period_to: '03.2022',
      tier: 'Базовая', engine_code: 'B47',
      frame_code: null, source_url: null,
    };
    const records = wrapAsRecords([c]);
    expect(computeFieldCoverage(records).identity).toBe(1); // 1/1 trim covers identity
  });

  it('threshold edge: identity with exactly 4 non-null (out of 7) does NOT meet threshold', () => {
    const c = makeAllNullComp();
    c.identity = {
      name: 'X', period_from: '04.2020', period_to: '03.2022',
      tier: 'Базовая',
      engine_code: null, frame_code: null, source_url: null,
    };
    const records = wrapAsRecords([c]);
    expect(computeFieldCoverage(records).identity).toBe(0); // 0/1 trim covers identity
  });

  it('rounds to 2 decimal places (1 of 3 trims meets dimensions threshold → 0.33)', () => {
    const populated = makeAllPopulatedComp();
    const empty1 = makeAllNullComp();
    const empty2 = makeAllNullComp();
    const records = wrapAsRecords([populated, empty1, empty2]);
    expect(computeFieldCoverage(records).dimensions).toBe(0.33);
  });
});

describe('meetsCoverageGate (R-7)', () => {
  it('returns true when all groups >= 0.70', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
    })).toBe(true);
  });

  it('returns false when any group < 0.70', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.69,  // <0.70
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
    })).toBe(false);
  });

  it('returns true at the exact 0.70 boundary', () => {
    expect(meetsCoverageGate({
      identity: 0.70, pricing: 0.70, drivetrain: 0.70,
      dimensions: 0.70, comfort: 0.70, tires: 0.70,
    })).toBe(true);
  });
});
