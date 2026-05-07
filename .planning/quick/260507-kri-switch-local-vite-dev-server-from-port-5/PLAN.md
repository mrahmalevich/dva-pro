---
type: quick
quick_id: 260507-kri
slug: switch-local-vite-dev-server-from-port-5
description: switch local Vite dev server from port 5173 to 5174
date: 2026-05-07
status: in-progress
---

# Switch local Vite dev server from port 5173 to 5174

**Why:** Port 5173 had a long-running Vite from this project that interfered with the Phase 02 golden-test capture (`02-REVIEW.md` WR-01 flagged the polling loop's port-collision blind spot). Bumping the canonical dev port to 5174 frees 5173 for ad-hoc/parallel work and keeps the test harness deterministic.

## Files to update

1. `vite.config.ts` — `server.port: 5173` → `5174`
2. `server/tests/landing-page-golden.test.ts` — `DEV_URL` constant + `--port 5173` spawn arg
3. `tmp/capture-current-state.mjs` — `DEV_URL` constant (gitignored throwaway, fix for consistency)

## Acceptance

- `grep -c "5173" vite.config.ts server/tests/landing-page-golden.test.ts` returns 0
- `grep -cE "127\.0\.0\.1:5174|port.*5174" server/tests/landing-page-golden.test.ts` returns ≥2 (DEV_URL + spawn arg)
- `pnpm test landing-page-golden.test.ts` exits 0 against the new port
- Existing Vite dev process on 5173 must be killed/restarted by user to take effect — flag in SUMMARY

## Out of scope

- Planning artifacts in `.planning/phases/*` that mention 5173 historically (Phase 2 RESEARCH/PATTERNS/SUMMARY/REVIEW). These are the historical record; retroactive edits would diverge from the actual commits described.
- Phase 1 PATTERNS reference (unrelated phase).
- The Vite client HMR port (defaults to same as server.port; no separate config).
