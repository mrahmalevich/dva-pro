---
type: quick
quick_id: 260507-kri
slug: switch-local-vite-dev-server-from-port-5
description: switch local Vite dev server from port 5173 to 5174
date: 2026-05-07
status: complete
---

# SUMMARY — Switch local Vite dev server from port 5173 to 5174

## What changed

| File | Change |
|------|--------|
| `vite.config.ts` | `server.port: 5173` → `5174` |
| `server/tests/landing-page-golden.test.ts` | `DEV_URL` constant + `--port` spawn arg → `5174` |
| `tmp/capture-current-state.mjs` | `DEV_URL` constant → `5174` (gitignored throwaway) |

## Verification

- `grep -c "5173"` across the three files → 0 matches
- `pnpm test landing-page-golden.test.ts` → 1 passed in 6.97s (against fresh server brought up on 5174)
- Pre-change Vite process on 5173 left running — does not interfere with test (test brings up its own server on 5174)

## Action required (user)

The pre-existing Vite dev process on **port 5173** (PID 73627 at session start) is still running with the old port. To pick up the new config:

```bash
# Kill the old process
lsof -ti :5173 | xargs kill
# Start fresh
pnpm dev
# Vite now listens on 5174
```

If you want both ports available temporarily (rare), leave the old process alive — the test on 5174 is unaffected.

## Out of scope (deliberately not changed)

- Historical planning artifacts in `.planning/phases/*` that mention 5173 (Phase 2 RESEARCH/PATTERNS/SUMMARY/REVIEW). Those are the historical record of work done with port 5173 — retroactive edits would diverge from the actual commits described.
- `.planning/phases/01-inventory-scrapers-drom-and-stubs/01-PATTERNS.md` (unrelated phase reference).

## Files

- `/Users/mikhailra/Developer/dva.pro/vite.config.ts`
- `/Users/mikhailra/Developer/dva.pro/server/tests/landing-page-golden.test.ts`
- `/Users/mikhailra/Developer/dva.pro/.planning/quick/260507-kri-switch-local-vite-dev-server-from-port-5/PLAN.md`
- `/Users/mikhailra/Developer/dva.pro/.planning/quick/260507-kri-switch-local-vite-dev-server-from-port-5/SUMMARY.md`
