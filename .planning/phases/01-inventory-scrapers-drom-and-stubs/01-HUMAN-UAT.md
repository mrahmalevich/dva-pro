---
status: partial
phase: 01-inventory-scrapers-drom-and-stubs
source: [01-VERIFICATION.md]
started: 2026-04-28T16:02:34Z
updated: 2026-04-28T16:02:34Z
---

## Current Test

[awaiting human testing / decision]

## Tests

### 1. Resume-path live correctness against actual mid-run crash

expected: |
  Operator triggers `pnpm scrape:drom` (no whitelist), SIGKILLs mid-brand,
  re-runs. Second run: report.cursor_resumed=true, pages_visited reflects
  skipped brands, brand-aliases.json contains entries for both completed-pre-crash
  brands AND the brand the cursor pointed at (no entries permanently lost).
result: [pending]

### 2. Resume contract semantics — operator scope/risk decision

expected: |
  Documented decision: ship Phase 1 with coarse "resume re-scrapes the
  cursored brand from scratch" semantics (CR-01..CR-04 deferred to Phase 1.x),
  OR block Phase 1 sign-off pending CR-01..CR-04 fixes.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
