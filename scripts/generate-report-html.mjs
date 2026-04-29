#!/usr/bin/env -S npx tsx
// scripts/generate-report-html.mjs
//
// Backward-compat one-shot CLI for runs predating the orchestrator's automatic
// HTML viewer integration (plan 01-15). For new runs the orchestrator already
// writes index.html alongside report.json — this script only matters for
// retroactive viewer generation against old run dirs.
//
// Usage:
//   pnpm exec tsx scripts/generate-report-html.mjs <run-dir>
//
// Example:
//   pnpm exec tsx scripts/generate-report-html.mjs data/scraped/drom/current
//
// All HTML logic lives in server/scrapers/shared/report-html.ts; this script is
// a thin delegator so the rendering is single-source-of-truth.

import { writeReportHtml } from '../server/scrapers/shared/report-html.ts';

const runDir = process.argv[2];
if (!runDir) {
  console.error('Usage: pnpm exec tsx scripts/generate-report-html.mjs <run-dir>');
  process.exit(1);
}

try {
  await writeReportHtml(runDir);
  console.log(`✓ wrote ${runDir}/index.html`);
} catch (err) {
  console.error(
    `✗ failed to write ${runDir}/index.html:`,
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
}
