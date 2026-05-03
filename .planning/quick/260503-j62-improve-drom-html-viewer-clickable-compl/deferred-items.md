# Deferred Items — quick task 260503-j62

## bmw-pilot-viewer.test.ts golden PNG

**File:** `server/tests/__snapshots__/bmw-pilot-viewer.png` (deleted in this run; needs regen)

**Status:** Out of plan scope. Plan only mandated `pnpm typecheck:server`; this PNG-diff
test was not in the verify chain.

**Why deferred:** Tasks 1 and 2 deliberately reshape `renderModalBody` (new Обзор card,
fixed engine block, clickable comp grid). The committed PNG golden no longer matches.
On this machine, the test's hardcoded 30s timeout is too tight to launch headless
Chromium and capture a new golden first-run, so the test cannot self-heal here.

**To regenerate (operator, on a host where Chromium starts in <30s, e.g. CI):**

```bash
rm -f server/tests/__snapshots__/bmw-pilot-viewer.png
pnpm vitest run server/tests/bmw-pilot-viewer.test.ts
# Test prints "[bmw-pilot-viewer] First run: wrote golden ..." and PASSES.
git add server/tests/__snapshots__/bmw-pilot-viewer.png
git commit -m "chore(260503-j62): regenerate bmw-pilot-viewer golden after modal reshape"
```

**Alternative:** bump the per-test timeout in `bmw-pilot-viewer.test.ts:283` from
`30_000` to `60_000` if the operator's local environment also struggles to start
Chromium within 30s.
