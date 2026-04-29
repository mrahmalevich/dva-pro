// server/tests/bmw-pilot.test.ts
//
// Phase 01.1, Plan 08 — BMW pilot field-coverage snapshot golden (R-8).
// Parses 3 captured BMW X5 G05 complectation fixtures, wraps them into a
// ModelRecord, computes FieldCoverage, and snapshots the 6-key rate object.
//
// SPEC R-8: snapshot the RATES, not the records (RESEARCH §Anti-Patterns line 315).
// Do NOT include raw records in the snapshot — only the FieldCoverage object.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseComplectationPage, type ComplectationPageContext } from '../scrapers/drom/parse-complectation-page.js';
import { computeFieldCoverage } from '../scrapers/shared/coverage.js';
import type { ModelRecord, Complectation } from '../scrapers/shared/types.js';
import type { TrimRowRef } from '../scrapers/drom/parse-generation-page.js';

const fix = (rel: string) =>
  readFileSync(resolve('server/tests/fixtures/drom/complectation', rel), 'utf-8');

/** Build a ComplectationPageContext from minimal trim metadata. */
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

describe('BMW pilot field-coverage snapshot golden (R-8)', () => {
  it('locks per-group coverage rates rounded to 2 dp', () => {
    const trims: Complectation[] = [
      parseComplectationPage(fix('207354.html'), makeCtx('207354')),
      parseComplectationPage(fix('252766.html'), makeCtx('252766', {
        name: 'xDrive 30d AT M Sport Plus',
        tier: 'Предмаксимальная',
      })),
      parseComplectationPage(fix('265067.html'), makeCtx('265067', {
        name: 'M Competition',
        tier: null,
      })),
    ];

    // Wrap into a single ModelRecord that the coverage formula iterates over.
    const record: ModelRecord = {
      brand: 'BMW',
      brand_slug: 'bmw',
      model: 'X5',
      model_slug: 'x5',
      generation: 'IV (G05)',
      year_from: 2018,
      year_to: null,
      body_types: ['SUV'],
      engine_options: [{ cc: 2993, hp: 249, fuel: 'diesel' }],
      drive_options: ['AWD'],
      description_ru: 'X5 G05',
      price_min_rub: 7190000,
      price_max_rub: 15000000,
      image_paths: [],
      source: 'drom-catalog',
      source_url: 'https://www.drom.ru/catalog/bmw/x5/g05/',
      scraped_at: '2026-04-29T00:00:00.000Z',
      complectations: trims,
    };

    const coverage = computeFieldCoverage([record]);

    // R-8 acceptance: snapshot the FieldCoverage object (six rates rounded to 2 dp).
    // Per RESEARCH §Anti-Patterns: snapshot the RATES, not the underlying records.
    expect(coverage).toMatchSnapshot();
  });
});
