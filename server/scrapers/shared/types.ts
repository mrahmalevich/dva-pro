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
}); // 6 leaves — D-06 threshold ≥4

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
}); // 9 leaves — D-06 threshold ≥6

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

export const Complectation = z.object({
  identity: Identity,
  pricing: Pricing,
  drivetrain: Drivetrain,
  dimensions: Dimensions,
  comfort: Comfort,
  tires: Tires,
  _extraction_errors: z
    .array(z.object({ group: z.string(), message: z.string() }))
    .optional(),
});
export type Complectation = z.infer<typeof Complectation>;

// Per-group sub-schemas re-exported for use in parser unit tests + per-section extractors.
export { Identity, Pricing, Drivetrain, Dimensions, Comfort, Tires };

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

export type FieldCoverage = {
  identity: number;
  pricing: number;
  drivetrain: number;
  dimensions: number;
  comfort: number;
  tires: number;
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
