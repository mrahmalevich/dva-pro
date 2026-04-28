// server/scrapers/shared/brand-aliases.ts
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from './atomic-write.js';

export type ModelAlias = { ru: string; latin: string };
export type BrandAlias = { ru: string; latin: string; models: Record<string, ModelAlias> };
export type AliasMap = Record<string, BrandAlias>;

/**
 * Idempotent merge per D-16 + SCRAPE-10:
 *   - read existing file (or treat as empty if absent / unparseable)
 *   - for each incoming brand, merge models map (union; last-write-wins on key collisions)
 *   - last-write-wins on canonical labels (`ru`, `latin`)
 *   - SORT brand_slug keys + model_slug keys alphabetically for byte-identical re-runs
 *   - write atomically via atomicWriteFile
 */
export async function mergeAliases(filePath: string, incoming: AliasMap): Promise<void> {
  let current: AliasMap = {};
  try {
    const raw = await readFile(filePath, 'utf-8');
    current = JSON.parse(raw) as AliasMap;
  } catch {
    /* fresh file — empty current */
  }

  const merged: AliasMap = { ...current };
  for (const [brandSlug, brand] of Object.entries(incoming)) {
    const existing = merged[brandSlug];
    merged[brandSlug] = {
      ru: brand.ru,
      latin: brand.latin,
      models: { ...(existing?.models ?? {}), ...brand.models },
    };
  }

  // Deterministic key ordering — IDempotency test asserts byte-equality across runs.
  const sortedBrandKeys = Object.keys(merged).sort((a, b) => a.localeCompare(b));
  const sorted: AliasMap = {};
  for (const k of sortedBrandKeys) {
    const brand = merged[k];
    const sortedModelKeys = Object.keys(brand.models).sort((a, b) => a.localeCompare(b));
    const sortedModels: Record<string, ModelAlias> = {};
    for (const mk of sortedModelKeys) sortedModels[mk] = brand.models[mk];
    sorted[k] = { ru: brand.ru, latin: brand.latin, models: sortedModels };
  }

  await atomicWriteFile(filePath, JSON.stringify(sorted, null, 2));
}
