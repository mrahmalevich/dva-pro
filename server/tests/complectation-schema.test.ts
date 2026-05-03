// server/tests/complectation-schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  Complectation,
  ModelRecord,
  Identity,
  Pricing,
  Drivetrain,
  Dimensions,
  Chassis,
  Comfort,
  Tires,
} from '../scrapers/shared/types.js';
import type { FieldCoverage } from '../scrapers/shared/types.js';

const allNullComplectation = {
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
};

describe('Complectation zod schema (R-2, R-3)', () => {
  it('R-2: accepts a record where every group leaf is null', () => {
    expect(() => Complectation.parse(allNullComplectation)).not.toThrow();
  });

  it('R-3: rejects a record missing the dimensions group key entirely', () => {
    const { dimensions, ...missingDimensions } = allNullComplectation;
    expect(() => Complectation.parse(missingDimensions)).toThrow();
  });

  it('R-3: each group has the D-06 leaf count (post Phase 01.2 extensions)', () => {
    expect(Object.keys(Identity.shape)).toHaveLength(7);
    expect(Object.keys(Pricing.shape)).toHaveLength(2);
    // Drivetrain: 6 original + 6 new (turbo, hybrid_type, battery_capacity_kwh,
    // electric_range_km, max_speed_kmh, acceleration_0_100_s) = 12.
    expect(Object.keys(Drivetrain.shape)).toHaveLength(12);
    // Dimensions: 9 original + 1 new (payload_kg) = 10.
    expect(Object.keys(Dimensions.shape)).toHaveLength(10);
    // Chassis: new group, 5 leaves.
    expect(Object.keys(Chassis.shape)).toHaveLength(5);
    expect(Object.keys(Comfort.shape)).toHaveLength(6);
    expect(Object.keys(Tires.shape)).toHaveLength(2);
  });

  it('accepts _extraction_errors annotation', () => {
    const withErrors = {
      ...allNullComplectation,
      _extraction_errors: [{ group: 'dimensions', message: 'table missing' }],
    };
    expect(() => Complectation.parse(withErrors)).not.toThrow();
  });

  it('rejects malformed _extraction_errors', () => {
    const bad = { ...allNullComplectation, _extraction_errors: 'not-an-array' };
    expect(() => Complectation.parse(bad)).toThrow();
  });
});

describe('ModelRecord.complectations backward-compat (D-03 + .default([]))', () => {
  const legacyModel = {
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
    price_min_rub: 7000000,
    price_max_rub: 15000000,
    image_paths: [],
    source: 'drom-catalog' as const,
    source_url: 'https://www.drom.ru/catalog/bmw/x5/g05/',
    scraped_at: '2026-04-29T00:00:00.000Z',
  };

  it('legacy ModelRecord without complectations parses with default []', () => {
    const parsed = ModelRecord.parse(legacyModel);
    expect(parsed.complectations).toEqual([]);
  });

  it('ModelRecord with one complectation round-trips', () => {
    const populated = {
      ...legacyModel,
      complectations: [allNullComplectation],
    };
    const parsed = ModelRecord.parse(populated);
    expect(parsed.complectations).toHaveLength(1);
    expect(parsed.complectations[0].identity.name).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Locks the new Complectation shape introduced in Phase 01.2:
//   - 6 new drivetrain leaves (turbo / hybrid_type / battery_capacity_kwh /
//     electric_range_km / max_speed_kmh / acceleration_0_100_s)
//   - 1 new dimensions leaf (payload_kg)
//   - new Chassis group (5 string|null leaves)
//   - features bag (Array<{section, subsection, label, value}>) with default []
//   - FieldCoverage gains chassis (0..1 rate) + features_density (mean count)
describe('Phase 01.2 schema extensions', () => {
  it('accepts a Complectation with the 6 new drivetrain leaves populated', () => {
    const c = {
      ...allNullComplectation,
      drivetrain: {
        ...allNullComplectation.drivetrain,
        turbo: true,
        hybrid_type: 'plug-in' as const,
        battery_capacity_kwh: 24,
        electric_range_km: 80,
        max_speed_kmh: 250,
        acceleration_0_100_s: 5.6,
      },
    };
    const parsed = Complectation.safeParse(c);
    expect(parsed.success).toBe(true);
  });

  it('accepts a Complectation with dimensions.payload_kg populated', () => {
    const c = {
      ...allNullComplectation,
      dimensions: { ...allNullComplectation.dimensions, payload_kg: 720 },
    };
    expect(Complectation.safeParse(c).success).toBe(true);
  });

  it('accepts a Chassis group with all-null leaves', () => {
    const c = {
      ...allNullComplectation,
      chassis: {
        suspension_front: null, suspension_rear: null,
        brakes_front: null, brakes_rear: null,
        steering_type: null,
      },
    };
    expect(Complectation.safeParse(c).success).toBe(true);
  });

  it('accepts a Chassis group with string leaves', () => {
    const c = {
      ...allNullComplectation,
      chassis: {
        suspension_front: 'независимая, многорычажная',
        suspension_rear: 'независимая, многорычажная',
        brakes_front: 'дисковые вентилируемые',
        brakes_rear: 'дисковые вентилируемые',
        steering_type: 'реечный, с гидроусилителем',
      },
    };
    expect(Complectation.safeParse(c).success).toBe(true);
  });

  it('rejects a Chassis group with numeric leaf', () => {
    const c = {
      ...allNullComplectation,
      chassis: {
        suspension_front: 42 as unknown as string, // intentionally wrong type
        suspension_rear: null,
        brakes_front: null,
        brakes_rear: null,
        steering_type: null,
      },
    };
    expect(Complectation.safeParse(c).success).toBe(false);
  });

  it('accepts a features array with mixed value types (string, boolean, number)', () => {
    const c = {
      ...allNullComplectation,
      features: [
        { section: 'Экстерьер', subsection: 'Фары', label: 'LED', value: true },
        { section: 'Двигатель', subsection: null, label: 'Объём', value: 2998 },
        { section: 'Окраска', subsection: null, label: 'Цвет', value: 'чёрный металлик' },
      ],
    };
    expect(Complectation.safeParse(c).success).toBe(true);
  });

  it('rejects a features entry with object value', () => {
    const c = {
      ...allNullComplectation,
      features: [
        // value: { nested: 1 } is not in the union string|boolean|number
        { section: 'X', subsection: null, label: 'Y', value: { nested: 1 } as unknown as string },
      ],
    };
    expect(Complectation.safeParse(c).success).toBe(false);
  });

  it('defaults features to [] when key is omitted', () => {
    // Build an object with EVERY required group (incl. chassis) but no `features: ` key.
    // Use Complectation.parse so the .default([]) is materialised on the output.
    const inputWithoutFeatures = {
      identity: allNullComplectation.identity,
      pricing: allNullComplectation.pricing,
      drivetrain: allNullComplectation.drivetrain,
      dimensions: allNullComplectation.dimensions,
      chassis: allNullComplectation.chassis,
      comfort: allNullComplectation.comfort,
      tires: allNullComplectation.tires,
    };
    const parsed = Complectation.parse(inputWithoutFeatures);
    // Default `features: ` is materialised as an empty array.
    expect(parsed.features).toEqual([]);
  });

  it('FieldCoverage type carries chassis and features_density keys', () => {
    // Compile-time check — `pnpm typecheck:server` enforces the type shape.
    // If FieldCoverage drops chassis or features_density (or omits them),
    // this assignment fails at typecheck time and vitest never runs.
    const c: FieldCoverage = {
      identity: 0,
      pricing: 0,
      drivetrain: 0,
      dimensions: 0,
      chassis: 0,
      comfort: 0,
      tires: 0,
      features_density: 0,
    };
    expect(c.chassis).toBe(0);
    expect(c.features_density).toBe(0);
  });
});
