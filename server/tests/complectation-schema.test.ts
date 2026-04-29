// server/tests/complectation-schema.test.ts
import { describe, it, expect } from 'vitest';
import {
  Complectation,
  ModelRecord,
  Identity,
  Pricing,
  Drivetrain,
  Dimensions,
  Comfort,
  Tires,
} from '../scrapers/shared/types.js';

const allNullComplectation = {
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
};

describe('Complectation zod schema (R-2, R-3)', () => {
  it('R-2: accepts a record where every group leaf is null', () => {
    expect(() => Complectation.parse(allNullComplectation)).not.toThrow();
  });

  it('R-3: rejects a record missing the dimensions group key entirely', () => {
    const { dimensions, ...missingDimensions } = allNullComplectation;
    expect(() => Complectation.parse(missingDimensions)).toThrow();
  });

  it('R-3: each group has the D-06 leaf count', () => {
    expect(Object.keys(Identity.shape)).toHaveLength(7);
    expect(Object.keys(Pricing.shape)).toHaveLength(2);
    expect(Object.keys(Drivetrain.shape)).toHaveLength(6);
    expect(Object.keys(Dimensions.shape)).toHaveLength(9);
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
