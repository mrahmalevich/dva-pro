// server/tests/drom-cr04-contract.test.ts
//
// Plan 01-12 — CR-04 contract enforcement test.
//
// Strategy: source-code contract assertion. The resume contract delivered by
// this plan ("when the cursor points at this brand, the brand is re-scraped
// from scratch — startFromModelIndex pinned to 0") is verified by inspecting
// the orchestrator source for the pinned assignment + the absence of the old
// idx-based assignment. A heavyweight resume integration test that exercises
// this code path end-to-end is the explicit scope of sibling plan 01-13; this
// test is the lightweight red→green companion that locks the contract at the
// source level so future maintainers cannot silently un-pin it.
//
// Acceptance:
// - The cursored-brand model-cursor block contains a comment tagging the
//   `CR-04 contract` (the pin's permanent annotation).
// - The post-throw final assignment in that block reads
//   `startFromModelIndex = 0` (NOT `startFromModelIndex = idx`), so the
//   cursored brand is always re-scraped from scratch.
// - The defensive `Cursor.lastModelSlug=` throw is preserved as a
//   cursor-drift signal even though it no longer drives positioning.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ORCHESTRATOR = resolve('server/scrapers/drom/index.ts');

describe('CR-04 contract — orchestrator pins startFromModelIndex = 0 on cursored brand', () => {
  const src = readFileSync(ORCHESTRATOR, 'utf-8');

  it('tags the cursored-brand pin with the CR-04 contract comment', () => {
    expect(src).toMatch(/CR-04 contract/);
  });

  it('uses the literal "re-scrape" wording in or near the pin', () => {
    expect(src).toMatch(/re-scrape/);
  });

  it('does NOT contain the legacy startFromModelIndex = idx assignment', () => {
    // Old plan-10 code position-derived from the cursor; CR-04 forbids that.
    // Allow whitespace variation between the identifier, '=', and 'idx'.
    expect(src).not.toMatch(/startFromModelIndex\s*=\s*idx\b/);
  });

  it('preserves the defensive cursor-drift throw for missing lastModelSlug', () => {
    // The shape check is retained even though it no longer drives positioning.
    expect(src).toMatch(/Cursor\.lastModelSlug=/);
  });

  it('contains the cursored-brand pin (startFromModelIndex = 0 inside the cursor branch)', () => {
    // The model-cursor branch must end with `startFromModelIndex = 0;` after
    // the defensive throw. We assert that the substring appears AFTER the
    // brand-equality test so we know it is the pin, not the initial declaration.
    const branchStart = src.indexOf('brand.brand_slug === cursor.lastBrandSlug');
    expect(branchStart).toBeGreaterThan(-1);
    const tail = src.slice(branchStart);
    // Inside the cursor branch, the final pin must be `= 0`.
    expect(tail).toMatch(/startFromModelIndex\s*=\s*0\s*;/);
    // And there must be no `= idx` assignment after the brand-equality test.
    expect(tail).not.toMatch(/startFromModelIndex\s*=\s*idx\b/);
  });
});
