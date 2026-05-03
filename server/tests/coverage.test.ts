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
    turbo: null, hybrid_type: null, battery_capacity_kwh: null,
    electric_range_km: null, max_speed_kmh: null, acceleration_0_100_s: null,
  },
  dimensions: {
    length_mm: null, width_mm: null, height_mm: null,
    wheelbase_mm: null, clearance_mm: null,
    trunk_min_l: null, trunk_max_l: null,
    curb_weight_kg: null, gross_weight_kg: null,
    payload_kg: null,
  },
  chassis: {
    suspension_front: null, suspension_rear: null,
    brakes_front: null, brakes_rear: null,
    steering_type: null,
  },
  comfort: {
    seats: null, doors: null,
    fuel_consumption_city_l: null,
    fuel_consumption_highway_l: null,
    fuel_consumption_combined_l: null,
    tank_l: null,
  },
  tires: { tires_front: null, tires_rear: null },
  features: [],
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
    // Phase 01.2 — populated leaves still pass the existing 4-of-original-6 threshold;
    // these extras don't affect coverage rates because thresholds were not raised.
    turbo: true, hybrid_type: null, battery_capacity_kwh: null,
    electric_range_km: null, max_speed_kmh: 230, acceleration_0_100_s: 6.5,
  },
  dimensions: {
    length_mm: 4922, width_mm: 2004, height_mm: 1745,
    wheelbase_mm: 2975, clearance_mm: 214,
    trunk_min_l: 645, trunk_max_l: 1860,
    curb_weight_kg: 2105, gross_weight_kg: 2890,
    payload_kg: 785,
  },
  chassis: {
    suspension_front: 'независимая, многорычажная',
    suspension_rear: 'независимая, многорычажная',
    brakes_front: 'дисковые вентилируемые',
    brakes_rear: 'дисковые вентилируемые',
    steering_type: 'реечный, с гидроусилителем',
  },
  comfort: {
    seats: 5, doors: 5,
    fuel_consumption_city_l: 8.5,
    fuel_consumption_highway_l: 6.2,
    fuel_consumption_combined_l: 7.1,
    tank_l: 80,
  },
  tires: { tires_front: '275/45 R20 110Y', tires_rear: '305/40 R20 112Y' },
  features: [],
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
  it('returns zeros across all groups (incl. chassis + features_density) on empty records input', () => {
    expect(computeFieldCoverage([])).toEqual({
      identity: 0, pricing: 0, drivetrain: 0, dimensions: 0,
      chassis: 0, comfort: 0, tires: 0, features_density: 0,
    });
  });

  it('returns 1.0 across all 0..1 groups + 0 features_density for one fully-populated trim with no features', () => {
    const records = wrapAsRecords([makeAllPopulatedComp()]);
    expect(computeFieldCoverage(records)).toEqual({
      identity: 1, pricing: 1, drivetrain: 1, dimensions: 1,
      chassis: 1, comfort: 1, tires: 1, features_density: 0,
    });
  });

  it('returns 0 across all groups for one all-null trim', () => {
    const records = wrapAsRecords([makeAllNullComp()]);
    expect(computeFieldCoverage(records)).toEqual({
      identity: 0, pricing: 0, drivetrain: 0, dimensions: 0,
      chassis: 0, comfort: 0, tires: 0, features_density: 0,
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
  it('returns true when all groups >= 0.70 and chassis + features_density meet Plan 04 floors', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      // Phase 01.2 Plan 04: chassis ≥ 0.30, features_density ≥ 50 enforced.
      chassis: 0.55, features_density: 120,
    })).toBe(true);
  });

  it('returns false when any group < 0.70', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.69,  // <0.70
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      chassis: 0.55, features_density: 120,
    })).toBe(false);
  });

  it('returns true at the exact 0.70 boundary (legacy groups) with new floors satisfied', () => {
    expect(meetsCoverageGate({
      identity: 0.70, pricing: 0.70, drivetrain: 0.70,
      dimensions: 0.70, comfort: 0.70, tires: 0.70,
      chassis: 0.30, features_density: 50,
    })).toBe(true);
  });
});

// Phase 01.2 — chassis + features_density coverage
//
// Plan 04 promotes the two new floors from 0 (Plan 01 stub) to enforced
// minimums. Coverage tests below pin the per-trim chassis threshold (4-of-5
// non-null leaves), the features_density mean computation, and the
// meetsCoverageGate boundary behaviour for both new floors.
describe('Phase 01.2 — chassis + features_density coverage', () => {
  // Helper: build a Complectation with `count` of the 5 chassis leaves populated.
  const makeChassisCovered = (count: 0 | 1 | 2 | 3 | 4 | 5): Complectation => {
    const c = makeAllNullComp();
    const fields: Array<keyof Complectation['chassis']> = [
      'suspension_front', 'suspension_rear', 'brakes_front', 'brakes_rear', 'steering_type',
    ];
    for (let i = 0; i < count; i++) c.chassis[fields[i]] = 'независимая, многорычажная';
    return c;
  };

  // Helper: build a Complectation with N feature entries.
  const makeCompWithNFeatures = (n: number): Complectation => {
    const c = makeAllNullComp();
    c.features = Array.from({ length: n }, (_, i) => ({
      section: 'Test', subsection: null, label: 'L' + i, value: true,
    }));
    return c;
  };

  it('computeFieldCoverage returns chassis: 0 and features_density: 0 for empty records[]', () => {
    expect(computeFieldCoverage([])).toEqual({
      identity: 0, pricing: 0, drivetrain: 0, dimensions: 0,
      chassis: 0, comfort: 0, tires: 0, features_density: 0,
    });
  });

  it('chassis: trim with 4 of 5 leaves non-null counts as covered', () => {
    const records = wrapAsRecords([makeChassisCovered(4)]);
    expect(computeFieldCoverage(records).chassis).toBe(1);
  });

  it('chassis: trim with 3 of 5 leaves non-null does NOT count', () => {
    const records = wrapAsRecords([makeChassisCovered(3)]);
    expect(computeFieldCoverage(records).chassis).toBe(0);
  });

  it('chassis: trim with all 5 leaves non-null counts as covered', () => {
    const records = wrapAsRecords([makeChassisCovered(5)]);
    expect(computeFieldCoverage(records).chassis).toBe(1);
  });

  it('features_density: avg of 100, 50, 0 across 3 comps is 50.0', () => {
    const records = wrapAsRecords([
      makeCompWithNFeatures(100),
      makeCompWithNFeatures(50),
      makeCompWithNFeatures(0),
    ]);
    expect(computeFieldCoverage(records).features_density).toBe(50);
  });

  it('features_density: rounding to 2 dp', () => {
    // 17 + 22 + 18 = 57 / 3 = 19.0 (exact)
    const r1 = wrapAsRecords([
      makeCompWithNFeatures(17),
      makeCompWithNFeatures(22),
      makeCompWithNFeatures(18),
    ]);
    expect(computeFieldCoverage(r1).features_density).toBe(19);

    // 17 + 22 + 17 = 56 / 3 = 18.666..., rounds to 18.67
    const r2 = wrapAsRecords([
      makeCompWithNFeatures(17),
      makeCompWithNFeatures(22),
      makeCompWithNFeatures(17),
    ]);
    expect(computeFieldCoverage(r2).features_density).toBe(18.67);
  });

  it('meetsCoverageGate fails when chassis < 0.30', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      chassis: 0.25,            // below floor
      features_density: 120,
    })).toBe(false);
  });

  it('meetsCoverageGate passes when chassis === 0.30 (boundary)', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      chassis: 0.30,            // exact boundary, >= comparison
      features_density: 120,
    })).toBe(true);
  });

  it('meetsCoverageGate fails when features_density < 50', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      chassis: 0.55,
      features_density: 49.99,  // below floor
    })).toBe(false);
  });

  it('meetsCoverageGate passes when features_density === 50 (boundary)', () => {
    expect(meetsCoverageGate({
      identity: 0.92, pricing: 0.85, drivetrain: 0.78,
      dimensions: 0.74, comfort: 0.81, tires: 0.71,
      chassis: 0.55,
      features_density: 50,     // exact boundary
    })).toBe(true);
  });

  it('meetsCoverageGate passes with locked BMW X5 production rates: chassis 0.35, features_density 142.3, pricing 0.084, others ≥ 0.70', () => {
    expect(meetsCoverageGate({
      identity: 0.95,
      pricing: 0.084,           // matches drom-pricing-sparse 0.05 floor
      drivetrain: 0.91,
      dimensions: 0.88,
      chassis: 0.35,
      comfort: 0.79,
      tires: 0.92,
      features_density: 142.3,
    })).toBe(true);
  });
});
