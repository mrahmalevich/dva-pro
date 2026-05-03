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

// Cheerio v1.2 dropped the `cheerio.Element` namespace export; rather than
// pull in `domhandler` as a direct dep just for the Element node type, we
// derive the wrapper type from `CheerioAPI`'s call signature. `$('td')`
// returns a Cheerio<Element> for any selector so this matches what the
// walker passes around.
type CheerioWrapper = ReturnType<cheerio.CheerioAPI>;

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

// -- Phase 01.2 Plan 02 — generic section-walker primitives --
// extractCellValue / walkSections / isFeatureValue are pure helpers used by
// parseComplectationPage to populate (a) typed slots in drivetrain/dimensions/
// chassis and (b) the open-ended features bag. Internal — not exported.

/**
 * Walked-row record produced by walkSections; consumed by applyWalkedRows.
 */
interface WalkedRow {
  section: string;
  subsection: string | null;
  label: string;
  normalisedValue: string | boolean | number | null;
}

/**
 * Normalise a value <td> from a comp data row.
 * Order of checks matters: SVG (yes/no) → boolean; «опция» badge → string;
 * numeric+optional-unit → number; else trimmed text.
 *
 * Returns null only when the cell is empty.
 *
 * Threat T-01.2-04 (tampering): callers must pass the VALUE td (`tds[1]`),
 * never the label td — `find('use[xlink\\:href="#yes"]')` would otherwise
 * lift a forged SVG out of a manipulated label cell.
 */
function extractCellValue(
  $: cheerio.CheerioAPI,
  td: CheerioWrapper,
): string | boolean | number | null {
  // 1. yes/no SVG. Drom emits `<use xlink:href="#yes"|"#no">` but cheerio v1.2
  // (htmlparser2 default mode) normalises the namespaced attribute to plain
  // `href` — confirmed empirically against fixture 207354. Match on `href`
  // (works for both source forms after normalisation).
  const useEl = td.find('use[href="#yes"], use[href="#no"]').first();
  if (useEl.length > 0) {
    const href = useEl.attr('href') ?? '';
    if (href === '#yes') return true;
    if (href === '#no') return false;
  }
  // 2. «опция» badge — drom wraps it in nested spans; look for any descendant
  // whose trimmed text === 'опция'.
  const optionSpan = td
    .find('span')
    .filter((_, el) => $(el).text().trim() === 'опция')
    .first();
  if (optionSpan.length > 0) return 'опция';
  // 3. text — collapse internal whitespace and trim.
  const raw = td.text().replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  // Skip cells that contain only an em-dash placeholder ("—" / "&mdash;") —
  // drom uses these for "field not applicable to this trim".
  if (raw === '—' || raw === '—') return null;
  // 4. numeric? Match leading number with optional decimal (comma or dot).
  // Bounded character classes — no nested quantifiers (T-01.2-05 mitigation).
  const numMatch = raw.match(/^(-?\d+(?:[.,]\d+)?)(?:\s|\(|$)/);
  if (numMatch) {
    const n = Number(numMatch[1].replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return raw;
}

/**
 * Walk every `<tr>` inside the comp specs table; emit one WalkedRow per
 * data row, scoped by the most recent section + subsection headers.
 *
 * Section markers:    `b-text_size_xxl`  (e.g. "Основные параметры")
 * Subsection markers: `b-text_size_xl`   (e.g. "Размеры кузова")
 * Data rows:          `b-table__row_cols_2`
 *
 * Selector `table.b-table tr` is broad on purpose — drom may add or rename
 * the wrapping div; section/subsection/data-row markers stay stable.
 *
 * Fail-soft: if no sections are found, returns []. If a data row appears
 * before any section header, it is skipped silently (no NPE on
 * `currentSection === null`).
 */
function walkSections($: cheerio.CheerioAPI): WalkedRow[] {
  const rows: WalkedRow[] = [];
  let currentSection: string | null = null;
  let currentSubsection: string | null = null;

  $('table.b-table tr').each((_, tr) => {
    const $tr = $(tr);
    const cls = $tr.attr('class') ?? '';
    const isSection = /\bb-text_size_xxl\b/.test(cls);
    const isSubsection = /\bb-text_size_xl\b/.test(cls) && !isSection;
    const isDataRow = /\bb-table__row_cols_2\b/.test(cls);

    if (isSection) {
      currentSection = $tr.find('td').first().text().replace(/\s+/g, ' ').trim();
      currentSubsection = null;
      return;
    }
    if (isSubsection) {
      currentSubsection = $tr.find('td').first().text().replace(/\s+/g, ' ').trim();
      return;
    }
    if (isDataRow && currentSection) {
      const tds = $tr.find('> td');
      if (tds.length < 2) return;
      const label = $(tds[0]).text().replace(/\s+/g, ' ').trim();
      if (!label) return;
      const value = extractCellValue($, $(tds[1]));
      rows.push({
        section: currentSection,
        subsection: currentSubsection,
        label,
        normalisedValue: value,
      });
    }
  });

  return rows;
}

/**
 * Type guard for valid feature-bag value union.
 * The features[] schema rejects null entries — callers must filter through
 * this guard before pushing.
 */
function isFeatureValue(v: unknown): v is string | boolean | number {
  return typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number';
}

// -- Phase 01.2 Plan 02 — typed-slot mapping table --
// Each entry maps a Russian label regex (tested against label.toLowerCase())
// to a dotted `[group, leaf]` slot path on Complectation. Coerce funcs reject
// the wrong runtime type (returning null) so we never write a string into a
// number slot.
//
// All regexes are anchored at `^` and use bounded character classes — no
// catastrophic backtracking (T-01.2-05 mitigation). Walker iterates over a
// bounded ~167-row table, so total regex work is O(rows × mappings) ≈ 167×12.

type SlotGroup = 'drivetrain' | 'dimensions' | 'chassis';
type TypedSlotMapping = {
  matcher: RegExp;
  path: readonly [SlotGroup, string];
  coerce: (v: string | boolean | number | null) => string | boolean | number | null;
};

const asBool = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);
const asNum = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const asStr = (v: unknown): string | null =>
  typeof v === 'string' && v.length > 0 ? v : null;
const asHybridType = (v: unknown): 'mild' | 'plug-in' | 'full' | null => {
  if (typeof v !== 'string') return null;
  if (/plug.?in|подключ|внешн/i.test(v)) return 'plug-in';
  if (/mild|мягк/i.test(v)) return 'mild';
  if (/^(full|полн|hybrid|гибрид)/i.test(v)) return 'full';
  return null;
};

// Plan-specified label patterns adjusted to match the actual drom DOM observed
// in fixture 207354.html (verified via grep):
//   * The boolean turbo cell uses label "Нагнетатель" — not "Турбонаддув".
//     ("Тип нагнетателя" → string "Турбина" stays in features[].)
//   * Payload label is "Максимальная грузоподъёмность" with optional prefix.
//   * Acceleration label is "Время разгона 0-100 км/ч, с".
//   * Steering label may only appear as a subsection header on most trims —
//     mapping kept for completeness, null is allowed by the schema.
const TYPED_SLOT_MAPPINGS: ReadonlyArray<TypedSlotMapping> = [
  // drivetrain
  { matcher: /^нагнетатель$|^турбонаддув$|^наддув$/, path: ['drivetrain', 'turbo'], coerce: asBool },
  { matcher: /^тип гибридной системы|^гибридная система|^тип гибрида/, path: ['drivetrain', 'hybrid_type'], coerce: asHybridType },
  { matcher: /^ёмкость батареи|^объём батареи|^ёмкость аккумулятор|^ёмкость тягового аккумулятор/, path: ['drivetrain', 'battery_capacity_kwh'], coerce: asNum },
  { matcher: /^запас хода на электро|^электрический запас хода|^запас хода \(электро/, path: ['drivetrain', 'electric_range_km'], coerce: asNum },
  { matcher: /^максимальная скорость/, path: ['drivetrain', 'max_speed_kmh'], coerce: asNum },
  { matcher: /^разгон 0.{1,5}100|^разгон до 100|^время разгона 0.{1,5}100/, path: ['drivetrain', 'acceleration_0_100_s'], coerce: asNum },
  // dimensions
  { matcher: /(^|\b)(максимальная )?грузоподъ[её]мность|^полезная нагрузка/, path: ['dimensions', 'payload_kg'], coerce: asNum },
  // chassis
  { matcher: /^передняя подвеска$|^тип передней подвески/, path: ['chassis', 'suspension_front'], coerce: asStr },
  { matcher: /^задняя подвеска$|^тип задней подвески/, path: ['chassis', 'suspension_rear'], coerce: asStr },
  { matcher: /^передние тормоза$|^тип передних тормоз/, path: ['chassis', 'brakes_front'], coerce: asStr },
  { matcher: /^задние тормоза$|^тип задних тормоз/, path: ['chassis', 'brakes_rear'], coerce: asStr },
  { matcher: /^тип рулевого управления|^рулевое управление$/, path: ['chassis', 'steering_type'], coerce: asStr },
];

/**
 * Labels already extracted by per-label functions (extractDimensions,
 * extractDrivetrain, extractComfort, extractTires) or by trimRow context —
 * drop these from features[] to avoid duplication with the typed groups.
 * Match against label.toLowerCase().
 */
const SUPPRESS_LABELS: ReadonlySet<string> = new Set([
  // Identity (from trimRow, but if drom shows them, drop)
  'название комплектации',
  'период выпуска',
  'тип привода',
  'тип кузова',
  'тип трансмиссии',
  // Existing dimensions slots (extracted by extractDimensions)
  'габариты кузова (д x ш x в), мм',
  'колесная база, мм',
  'клиренс (высота дорожного просвета), мм',
  'объем багажника, л',
  'масса, кг',
  'допустимая полная масса, кг',
  // Existing comfort slots
  'число мест',
  'число дверей',
  'расход топлива в городском цикле, л/100 км',
  'расход топлива за городом, л/100 км',
  'расход топлива в смешанном цикле, л/100 км',
  'объем топливного бака, л',
  // Existing tire slots
  'передние колеса',
  'задние колеса',
  'передние шины',
  'задние шины',
]);

/**
 * Apply walked rows: (a) populate typed slots in `slots`; (b) push remaining
 * rows into `features` (skipping suppressed labels and null values).
 * Mutates `slots` and `features` in place.
 */
function applyWalkedRows(
  walked: ReadonlyArray<WalkedRow>,
  slots: {
    drivetrain: Complectation['drivetrain'];
    dimensions: Complectation['dimensions'];
    chassis: Complectation['chassis'];
  },
  features: Complectation['features'],
): void {
  for (const row of walked) {
    const labelLower = row.label.toLowerCase();
    let matched = false;
    for (const m of TYPED_SLOT_MAPPINGS) {
      if (m.matcher.test(labelLower)) {
        const coerced = m.coerce(row.normalisedValue);
        if (coerced !== null) {
          const [group, leaf] = m.path;
          (slots[group] as Record<string, unknown>)[leaf] = coerced;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (SUPPRESS_LABELS.has(labelLower)) continue;
    // Drop null cells silently (em-dash placeholders, empty values).
    if (!isFeatureValue(row.normalisedValue)) continue;
    features.push({
      section: row.section,
      subsection: row.subsection,
      label: row.label,
      value: row.normalisedValue,
    });
  }
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

  // Phase 01.2 Plan 02 — generic walker:
  // (a) overlay typed-slot mappings on top of per-section extractor stubs,
  // (b) push everything else into the open-ended features bag.
  const features: Complectation['features'] = [];
  const walked = safeExtract(() => walkSections($), 'walk-sections', errors) ?? [];
  safeExtract(
    () => applyWalkedRows(walked, { drivetrain, dimensions, chassis }, features),
    'apply-walked-rows',
    errors,
  );

  const candidate: Complectation = {
    identity, pricing, drivetrain, dimensions, chassis, comfort, tires,
    features,
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
