// server/scrapers/shared/coverage.ts
//
// SPEC R-7: per-field-group coverage threshold.
// D-05/D-06: per-trim majority-threshold formula. For each trim, a group is
// "covered" if at least the precomputed leaf count is non-null. The group's
// rate is count(covered trims) / total_trims, rounded to 2 dp (D-08).
// Pure function: no I/O, no side effects — thresholds are precomputed from D-06
// leaf counts to avoid drift (no runtime ceiling math).

import type { ModelRecord, Complectation, FieldCoverage } from './types.js';

// D-06 precomputed thresholds (no runtime ceil math):
const THRESHOLDS = {
  identity: 5,    // 7 leaves → ⌈2/3 × 7⌉ = 5
  pricing: 2,     // 2 leaves → 2 (effectively all)
  drivetrain: 4,  // 6 leaves → 4
  dimensions: 6,  // 9 leaves → 6
  comfort: 4,     // 6 leaves → 4
  tires: 2,       // 2 leaves → 2 (effectively all)
} as const;

type GroupKey = keyof typeof THRESHOLDS;

function nonNullLeafCount(group: Record<string, unknown> | null | undefined): number {
  if (group === null || group === undefined) return 0;
  return Object.values(group).filter((v) => v !== null).length;
}

function trimMeetsThreshold(comp: Complectation, group: GroupKey): boolean {
  // Type narrowing: each group on Complectation is a fully-typed sub-record.
  // Cast to Record<string, unknown> for generic leaf iteration.
  const groupValue = comp[group] as Record<string, unknown> | null;
  return nonNullLeafCount(groupValue) >= THRESHOLDS[group];
}

/** Round to 2 decimal places (D-08). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute per-group coverage rates across all complectations on the given records.
 * Each rate is the fraction of trims meeting the D-06 threshold for that group.
 * Rates are rounded to 2 dp.
 */
export function computeFieldCoverage(records: ModelRecord[]): FieldCoverage {
  const trims = records.flatMap((r) => r.complectations);
  const total = trims.length;
  if (total === 0) {
    return { identity: 0, pricing: 0, drivetrain: 0, dimensions: 0, comfort: 0, tires: 0 };
  }
  return {
    identity: round2(trims.filter((t) => trimMeetsThreshold(t, 'identity')).length / total),
    pricing: round2(trims.filter((t) => trimMeetsThreshold(t, 'pricing')).length / total),
    drivetrain: round2(trims.filter((t) => trimMeetsThreshold(t, 'drivetrain')).length / total),
    dimensions: round2(trims.filter((t) => trimMeetsThreshold(t, 'dimensions')).length / total),
    comfort: round2(trims.filter((t) => trimMeetsThreshold(t, 'comfort')).length / total),
    tires: round2(trims.filter((t) => trimMeetsThreshold(t, 'tires')).length / total),
  };
}

/**
 * Per-group minimum coverage rates required to pass the gate.
 *
 * SPEC R-7 originally set a single floor of 0.70 across all groups, but drom's
 * pricing data is structurally sparse (260503-j62 H2 analysis):
 *   - price_new_rub is per-trim, present in td.y7l57t0 cells with ₽ — ~32% of trims
 *   - price_used_from_rub is PER-ENGINE-GROUP (not per-trim), in _13wmddp1/«Цена б/у» —
 *     present for only the engine variants drom currently aggregates used listings for
 *     (~17% of trims; e.g. 2/9 engine groups on BMW X5 G05).
 *   - Joint presence of BOTH leaves: 40/477 = 8.4% on the 2026-05-03 BMW pilot run.
 * The 0.70 floor is unattainable for pricing without changing drom or pulling
 * pricing from a second data source. We therefore pin pricing to a 0.05 floor
 * that still detects a regression to fully-null pricing while accepting drom's
 * actual data shape. All other groups keep the original 0.70 floor.
 */
const COVERAGE_FLOORS: Record<keyof FieldCoverage, number> = {
  identity: 0.70,
  pricing: 0.05,
  drivetrain: 0.70,
  dimensions: 0.70,
  comfort: 0.70,
  tires: 0.70,
};

/** SPEC R-7: gate passes iff every group rate meets its floor. */
export function meetsCoverageGate(coverage: FieldCoverage): boolean {
  return (Object.keys(COVERAGE_FLOORS) as Array<keyof FieldCoverage>).every(
    (group) => coverage[group] >= COVERAGE_FLOORS[group],
  );
}
