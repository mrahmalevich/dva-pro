// server/scrapers/shared/types.ts
import { z } from 'zod';

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
});
export type ModelRecord = z.infer<typeof ModelRecord>;

export type ReportSummary = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  pages_visited: number;
  models_added: number;
  models_updated: number;
  images_downloaded: number;
  images_skipped: number;
  errors: { url: string; message: string }[];
  rate_limit_hits: number;
  blocked_responses: number;
  fx_stale: boolean;
  cursor_resumed: boolean;
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
