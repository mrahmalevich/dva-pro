// server/scrapers/shared/types.ts
import { z } from 'zod';

// -- Complectation sub-schema (Phase 01.1) --
const Identity = z.object({
  name: z.string().nullable(),
  period_from: z.string().nullable(),
  period_to: z.string().nullable(),
  tier: z.enum(['Базовая', 'Предмаксимальная', 'Максимальная']).nullable(),
  engine_code: z.string().nullable(),
  frame_code: z.string().nullable(),
  source_url: z.string().url().nullable(),
}); // 7 leaves — D-06 threshold ≥5

const Pricing = z.object({
  price_new_rub: z.number().nullable(),
  price_used_from_rub: z.number().nullable(),
}); // 2 leaves — D-06 threshold ≥2 (effectively all)

const Drivetrain = z.object({
  engine_cc: z.number().int().nullable(),
  engine_hp: z.number().int().nullable(),
  engine_fuel: z.enum(['gas', 'diesel', 'hybrid', 'electric']).nullable(),
  drive: z.string().nullable(),
  transmission_type: z.enum(['AT', 'MT', 'CVT', 'AMT']).nullable(),
  transmission_gears: z.number().int().nullable(),
  // Phase 01.2 extensions — extra typed slots for the "Двигатель, КПП, рулевое
  // управление" and "Основные параметры" drom comp tables.
  turbo: z.boolean().nullable(),
  hybrid_type: z.enum(['mild', 'plug-in', 'full']).nullable(),
  battery_capacity_kwh: z.number().nullable(),
  electric_range_km: z.number().nullable(),
  max_speed_kmh: z.number().nullable(),
  acceleration_0_100_s: z.number().nullable(),
}); // 12 leaves — D-06 threshold ≥4 (kept; extras dominate sparse legacy gens)

const Dimensions = z.object({
  length_mm: z.number().nullable(),
  width_mm: z.number().nullable(),
  height_mm: z.number().nullable(),
  wheelbase_mm: z.number().nullable(),
  clearance_mm: z.number().nullable(),
  trunk_min_l: z.number().nullable(),
  trunk_max_l: z.number().nullable(),
  curb_weight_kg: z.number().nullable(),
  gross_weight_kg: z.number().nullable(),
  // Phase 01.2 extension — appears under "Размеры → вес" section.
  payload_kg: z.number().nullable(),
}); // 10 leaves — D-06 threshold ≥6

// Phase 01.2 extension — new typed group for "Подвеска / Ходовая часть" rows
// that map cleanly onto compute-relevant slots. Sparse on legacy gens.
const Chassis = z.object({
  suspension_front: z.string().nullable(),
  suspension_rear: z.string().nullable(),
  brakes_front: z.string().nullable(),
  brakes_rear: z.string().nullable(),
  steering_type: z.string().nullable(),
}); // 5 leaves — D-06-equivalent threshold ≥ ⌈2/3 × 5⌉ = 4 (set in coverage.ts Plan 04)

const Comfort = z.object({
  seats: z.number().int().nullable(),
  doors: z.number().int().nullable(),
  fuel_consumption_city_l: z.number().nullable(),
  fuel_consumption_highway_l: z.number().nullable(),
  fuel_consumption_combined_l: z.number().nullable(),
  tank_l: z.number().nullable(),
}); // 6 leaves — D-06 threshold ≥4

const Tires = z.object({
  tires_front: z.string().nullable(),
  tires_rear: z.string().nullable(),
}); // 2 leaves — D-06 threshold ≥2 (effectively all)

// Phase 01.2 extension — open-ended bag for the ~130 drom comp rows that do
// NOT map onto a typed slot (per SCOPE Strategy B). Section / subsection
// labels stay in Russian — no RU→EN naming churn.
const FeatureEntry = z.object({
  section: z.string(),               // ru: 'Экстерьер и внешнее оснащение'
  subsection: z.string().nullable(), // ru: 'Фары и оптика' | null
  label: z.string(),                 // ru: 'Светодиодные фары'
  value: z.union([z.string(), z.boolean(), z.number()]),
});

export const Complectation = z.object({
  identity: Identity,
  pricing: Pricing,
  drivetrain: Drivetrain,
  dimensions: Dimensions,
  // Phase 01.2: chassis between dimensions and comfort to preserve section-walk order.
  chassis: Chassis,
  comfort: Comfort,
  tires: Tires,
  // Phase 01.2: features bag defaults to [] for back-compat with Phase 01.1
  // models.json that has no `features` key.
  features: z.array(FeatureEntry).default([]),
  _extraction_errors: z
    .array(z.object({ group: z.string(), message: z.string() }))
    .optional(),
});
export type Complectation = z.infer<typeof Complectation>;

// Per-group sub-schemas re-exported for use in parser unit tests + per-section extractors.
export { Identity, Pricing, Drivetrain, Dimensions, Chassis, Comfort, Tires, FeatureEntry };

export const ModelRecord = z.object({
  brand: z.string(),
  brand_slug: z.string(),
  model: z.string(),
  model_slug: z.string(),
  generation: z.string(),
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),
  body_types: z.array(z.string()),
  engine_options: z.array(z.object({
    cc: z.number().int(),
    hp: z.number().int(),
    fuel: z.enum(['gas', 'diesel', 'hybrid', 'electric']),
  })),
  drive_options: z.array(z.string()),
  description_ru: z.string(),
  price_min_rub: z.number().nullable(),
  price_max_rub: z.number().nullable(),
  image_paths: z.array(z.string()),
  source: z.literal('drom-catalog'),
  source_url: z.string().url(),
  scraped_at: z.string().datetime(),
  complectations: z.array(Complectation).default([]),
});
export type ModelRecord = z.infer<typeof ModelRecord>;

/**
 * Per-group field coverage rates as 0..1 fractions, EXCEPT `features_density`
 * which is the mean number of `features[]` entries per complectation (≥ 0).
 *
 * Per D-03 cross-phase contract, `features_density` is intentionally numeric
 * and unbounded — distinct from the 0..1 group rates — because the features
 * bag is open-ended and a "rate" makes no sense without a fixed denominator.
 */
export type FieldCoverage = {
  identity: number;
  pricing: number;
  drivetrain: number;
  dimensions: number;
  chassis: number;          // Phase 01.2 — Plan 04 will compute
  comfort: number;
  tires: number;
  features_density: number; // Phase 01.2 — avg features.length per comp (NOT a 0..1 rate)
};

export type ReportSummary = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pages_visited: number;
  models_added: number;
  models_updated: number;
  images_downloaded: number;
  images_skipped: number;
  images_failed: number;
  errors: { url: string; message: string; kind: 'parse' | 'image' | 'orchestrator' | 'inherit' }[];
  rate_limit_hits: number;
  blocked_responses: number;
  fx_stale: boolean;
  cursor_resumed: boolean;
  image_failure_rate: number;
  field_coverage?: FieldCoverage;
  final_status: 'ok' | 'blocked' | 'error';
};

export type ScrapeResult =
  | { status: 'ok'; source: string; runId: string; recordsWritten: number; durationMs: number; report: ReportSummary }
  | { status: 'not_implemented'; source: string; deferredTo: 'v1.x'; todo: string }
  | { status: 'error'; source: string; runId?: string; error: { message: string; cause?: unknown } }
  | { status: 'blocked'; source: string; runId: string; reason: 'thin_responses' | 'captcha' | 'rate_limited' | 'http_error'; sampleUrl?: string };

export interface IScraper {
  readonly source: string;
  run(opts?: { resume?: boolean }): Promise<ScrapeResult>;
}
