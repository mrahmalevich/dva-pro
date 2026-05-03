// server/scrapers/drom/parse-complectation-page.ts
//
// SPEC R-1 + R-3 + R-6: per-complectation page parser.
// FAIL-SOFT contract (inverts Phase 01's fail-loud Pitfall 1 mitigation
// at this boundary, per SPEC R-6 — no must-have fields).
//   - Each per-section extractor is wrapped in try/catch returning null.
//   - Final ComplectationSchema.safeParse (NOT .parse) — never raises.
//   - Schema or extraction failure → all-null record + _extraction_errors[].
//
// DEVIATION from plan's specified label texts — labels verified against
// live captured fixtures (see server/tests/fixtures/drom/complectation/207354.html):
//   - Dimensions: "Габариты кузова (Д x Ш x В), мм" → combined "L x W x H" value
//   - Seats: "Число мест" (not "Количество мест")
//   - Doors: "Число дверей" (not "Количество дверей")
//   - Clearance: "Клиренс (высота дорожного просвета), мм"
//   - Curb weight: "Масса, кг" (not "Снаряженная масса, кг")
//   - Max weight: "Допустимая полная масса, кг" (not "Максимальная допустимая масса, кг")
//   - Fuel city: "Расход топлива в городском цикле, л/100 км"
//   - Fuel highway: "Расход топлива за городом, л/100 км"
//   - Fuel combined: "Расход топлива в смешанном цикле, л/100 км"
//   - Tires: "Передние колеса" / "Задние колеса" (in detail table) with
//            "Передние шины" / "Задние шины" fallback (in summary block)
//   - Transmission gears: derived from "Тип трансмиссии" value (e.g. "АКПП 8" → 8)

import * as cheerio from 'cheerio';
import {
  Complectation as ComplectationSchema,
  type Complectation,
} from '../shared/types.js';
import type { TrimRowRef } from './parse-generation-page.js';

export interface ComplectationPageContext {
  brand_slug: string;
  model_slug: string;
  comp_id: string;
  sourceUrl: string;
  trimRow: TrimRowRef;
}

type ExtractionError = { group: string; message: string };

function safeExtract<T>(
  fn: () => T,
  group: string,
  errors: ExtractionError[],
): T | null {
  try {
    return fn();
  } catch (e) {
    errors.push({ group, message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Find the value cell for a Russian label text.
 * Searches <td> elements for an exact label match, then returns the next sibling <td>.
 */
function valueByLabel($: cheerio.CheerioAPI, label: string): string | null {
  const labelCell = $('td, th, span, dt')
    .filter((_, el) => $(el).text().trim() === label)
    .first();
  if (labelCell.length === 0) return null;
  const value =
    labelCell.next('td, dd, span').text().trim() ||
    labelCell.parent().next().text().trim();
  return value || null;
}

function numFromLabel($: cheerio.CheerioAPI, label: string): number | null {
  const raw = valueByLabel($, label);
  if (!raw) return null;
  const m = raw.match(/(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function intFromLabel($: cheerio.CheerioAPI, label: string): number | null {
  const n = numFromLabel($, label);
  return n === null ? null : Math.trunc(n);
}

/**
 * Pitfall 3: "645 (1860)" → {min:645,max:1860}; "645" → {min:645,max:null}
 * The trunk volume value may have the expanded-folded format in the same text node.
 */
function trunkRange($: cheerio.CheerioAPI): { min: number | null; max: number | null } {
  const raw = valueByLabel($, 'Объем багажника, л');
  if (!raw) return { min: null, max: null };
  // Match "645 (1860)" or "645(1860)" or just "645"
  const m = raw.match(/(\d+)\s*(?:\(?\s*(\d+)\s*\)?)?/);
  if (!m) return { min: null, max: null };
  return {
    min: Number(m[1]),
    max: m[2] ? Number(m[2]) : null,
  };
}

/**
 * Extract dimensions from the combined "Габариты кузова (Д x Ш x В), мм" cell.
 * Value format: "4922 x 2004 x 1745"
 */
function extractGabarits($: cheerio.CheerioAPI): {
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
} {
  const raw = valueByLabel($, 'Габариты кузова (Д x Ш x В), мм');
  if (!raw) return { length_mm: null, width_mm: null, height_mm: null };
  const parts = raw.split(/\s*x\s*/i).map((p) => {
    const m = p.trim().match(/^(\d+)/);
    return m ? Number(m[1]) : null;
  });
  return {
    length_mm: parts[0] ?? null,
    width_mm: parts[1] ?? null,
    height_mm: parts[2] ?? null,
  };
}

/**
 * Extract tire size string from either the detailed table ("Передние колеса")
 * or the summary specs block ("Передние шины" in b-model-specs__label).
 * The value cell may include links; we only want the tire size text.
 */
function tireByLabel($: cheerio.CheerioAPI, detailLabel: string, summaryLabel: string): string | null {
  // Try detail table first (has the full tire spec including links to tire sales).
  const detailCell = $('td')
    .filter((_, el) => $(el).text().trim() === detailLabel)
    .first();
  if (detailCell.length > 0) {
    const nextTd = detailCell.next('td');
    if (nextTd.length > 0) {
      // Value cell has the tire size as first text node, followed by links.
      // Use .contents().first() to get just the text node.
      const firstText = nextTd.contents().first().text().trim();
      if (firstText) return firstText;
      // Fallback: extract digits/slashes/R from the whole text.
      const raw = nextTd.text();
      const m = raw.match(/\d{3}\/\d{2,3}\s*R\d{2}/);
      if (m) return m[0];
    }
  }
  // Try summary block (b-model-specs__label / b-model-specs__text pattern)
  const summaryGroup = $('.bm-modelSpecsGroup').filter((_, el) => {
    return $(el).find('.b-model-specs__label').text().trim() === summaryLabel;
  }).first();
  if (summaryGroup.length > 0) {
    const text = summaryGroup.find('.b-model-specs__text').text().trim();
    return text || null;
  }
  return null;
}

// -- Identity (from trimRow context, NOT from per-comp HTML) --
function buildIdentity(ctx: ComplectationPageContext): Complectation['identity'] {
  const tr = ctx.trimRow;
  return {
    name: tr.name,
    period_from: tr.period_from,
    period_to: tr.period_to,
    tier: tr.tier,
    engine_code: tr.engine_code,
    frame_code: tr.frame_code,
    source_url: ctx.sourceUrl,
  };
}

// -- Pricing (from trimRow context) --
function buildPricing(ctx: ComplectationPageContext): Complectation['pricing'] {
  return {
    price_new_rub: ctx.trimRow.price_new_rub,
    price_used_from_rub: ctx.trimRow.price_used_from_rub,
  };
}

// -- Drivetrain --
// engine_cc / engine_hp / engine_fuel / drive from trimRow context (orchestrator-populated).
// transmission_type from trim name regex; transmission_gears from per-comp HTML "Тип трансмиссии".
function extractDrivetrain($: cheerio.CheerioAPI, ctx: ComplectationPageContext): Complectation['drivetrain'] {
  const tr = ctx.trimRow;
  const transTypeMatch = (tr.name || '').match(/\b(AT|MT|CVT|AMT)\b/);
  const transmission_type = (transTypeMatch ? transTypeMatch[1] : null) as Complectation['drivetrain']['transmission_type'];

  // Extract gear count from "Тип трансмиссии" value, e.g. "АКПП 8" → 8, "МКПП 6" → 6.
  let transmission_gears: number | null = null;
  const transRaw = valueByLabel($, 'Тип трансмиссии');
  if (transRaw) {
    const gearsMatch = transRaw.match(/\b(\d{1,2})\s*$/);
    if (gearsMatch) transmission_gears = Number(gearsMatch[1]);
  }

  return {
    engine_cc: tr.engine_cc,
    engine_hp: tr.engine_hp,
    engine_fuel: tr.engine_fuel,
    drive: tr.drive,
    transmission_type,
    transmission_gears,
    // Phase 01.2 — extra typed slots; Plan 02 will populate from real DOM.
    turbo: null,
    hybrid_type: null,
    battery_capacity_kwh: null,
    electric_range_km: null,
    max_speed_kmh: null,
    acceleration_0_100_s: null,
  };
}

// -- Dimensions (per-comp HTML) --
// Uses the combined "Габариты кузова (Д x Ш x В), мм" cell for L/W/H.
function extractDimensions($: cheerio.CheerioAPI): Complectation['dimensions'] {
  const gabarits = extractGabarits($);
  const trunk = trunkRange($);
  return {
    length_mm: gabarits.length_mm,
    width_mm: gabarits.width_mm,
    height_mm: gabarits.height_mm,
    wheelbase_mm: numFromLabel($, 'Колесная база, мм'),
    clearance_mm: numFromLabel($, 'Клиренс (высота дорожного просвета), мм'),
    trunk_min_l: trunk.min,
    trunk_max_l: trunk.max,
    curb_weight_kg: numFromLabel($, 'Масса, кг'),
    gross_weight_kg: numFromLabel($, 'Допустимая полная масса, кг'),
    // Phase 01.2 — Plan 02 will populate from "Грузоподъёмность, кг" or similar label.
    payload_kg: null,
  };
}

// -- Chassis (per-comp HTML) — Phase 01.2 stub; Plan 02 populates --
function extractChassis(_$: cheerio.CheerioAPI): Complectation['chassis'] {
  return {
    suspension_front: null,
    suspension_rear: null,
    brakes_front: null,
    brakes_rear: null,
    steering_type: null,
  };
}

// -- Comfort (per-comp HTML) --
function extractComfort($: cheerio.CheerioAPI): Complectation['comfort'] {
  return {
    seats: intFromLabel($, 'Число мест'),
    doors: intFromLabel($, 'Число дверей'),
    fuel_consumption_city_l: numFromLabel($, 'Расход топлива в городском цикле, л/100 км'),
    fuel_consumption_highway_l: numFromLabel($, 'Расход топлива за городом, л/100 км'),
    fuel_consumption_combined_l: numFromLabel($, 'Расход топлива в смешанном цикле, л/100 км'),
    tank_l: numFromLabel($, 'Объем топливного бака, л'),
  };
}

// -- Tires (per-comp HTML) --
// Primary: "Передние колеса" / "Задние колеса" in the detailed specs table.
// Fallback: "Передние шины" / "Задние шины" in the summary specs block.
function extractTires($: cheerio.CheerioAPI): Complectation['tires'] {
  return {
    tires_front: tireByLabel($, 'Передние колеса', 'Передние шины'),
    tires_rear: tireByLabel($, 'Задние колеса', 'Задние шины'),
  };
}

// -- All-null fallback (used on schema failure or catastrophic error) --
function allNullComplectation(ctx: ComplectationPageContext, errors: ExtractionError[]): Complectation {
  return {
    identity: {
      name: null, period_from: null, period_to: null, tier: null,
      engine_code: null, frame_code: null, source_url: ctx.sourceUrl,
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
    _extraction_errors: errors.length > 0 ? errors : undefined,
  };
}

export function parseComplectationPage(html: string, ctx: ComplectationPageContext): Complectation {
  const errors: ExtractionError[] = [];
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (e) {
    errors.push({ group: 'cheerio-load', message: e instanceof Error ? e.message : String(e) });
    return allNullComplectation(ctx, errors);
  }

  // Identity + Pricing come from trimRow context — cannot fail, but wrap in safeExtract for symmetry.
  const identity = safeExtract(() => buildIdentity(ctx), 'identity', errors) ?? {
    name: null, period_from: null, period_to: null, tier: null,
    engine_code: null, frame_code: null, source_url: ctx.sourceUrl,
  };
  const pricing = safeExtract(() => buildPricing(ctx), 'pricing', errors) ?? {
    price_new_rub: null, price_used_from_rub: null,
  };

  const drivetrain = safeExtract(() => extractDrivetrain($, ctx), 'drivetrain', errors) ?? {
    engine_cc: null, engine_hp: null, engine_fuel: null,
    drive: null, transmission_type: null, transmission_gears: null,
    turbo: null, hybrid_type: null, battery_capacity_kwh: null,
    electric_range_km: null, max_speed_kmh: null, acceleration_0_100_s: null,
  };
  const dimensions = safeExtract(() => extractDimensions($), 'dimensions', errors) ?? {
    length_mm: null, width_mm: null, height_mm: null,
    wheelbase_mm: null, clearance_mm: null,
    trunk_min_l: null, trunk_max_l: null,
    curb_weight_kg: null, gross_weight_kg: null,
    payload_kg: null,
  };
  const chassis = safeExtract(() => extractChassis($), 'chassis', errors) ?? {
    suspension_front: null, suspension_rear: null,
    brakes_front: null, brakes_rear: null,
    steering_type: null,
  };
  const comfort = safeExtract(() => extractComfort($), 'comfort', errors) ?? {
    seats: null, doors: null,
    fuel_consumption_city_l: null, fuel_consumption_highway_l: null,
    fuel_consumption_combined_l: null, tank_l: null,
  };
  const tires = safeExtract(() => extractTires($), 'tires', errors) ?? {
    tires_front: null, tires_rear: null,
  };

  const candidate: Complectation = {
    identity, pricing, drivetrain, dimensions, chassis, comfort, tires,
    features: [],
    _extraction_errors: errors.length > 0 ? errors : undefined,
  };

  const parsed = ComplectationSchema.safeParse(candidate);
  if (!parsed.success) {
    return allNullComplectation(ctx, [
      ...errors,
      { group: 'schema', message: parsed.error.message },
    ]);
  }
  return parsed.data;
}
