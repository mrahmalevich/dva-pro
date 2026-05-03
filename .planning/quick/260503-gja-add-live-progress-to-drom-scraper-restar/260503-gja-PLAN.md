---
phase: quick/260503-gja
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/scrapers/drom/index.ts
  - data/scraped/drom/2026-04-28T14-31-09Z
  - data/scraped/drom/2026-04-30T04-07-47Z
  - data/scraped/drom/2026-05-01T07-28-27Z
  - data/scraped/drom/2026-05-01T08-10-05Z
  - data/scraped/drom/current
  - data/scraped/drom/.cursor.json
  - data/scraped/drom/smoke.log
autonomous: true
requirements:
  - quick/260503-gja
---

<objective>
Add live progress visibility to the drom scraper orchestrator (live `models.json` snapshots
+ `[drom]`-prefixed console logs at every loop layer), then wipe the existing scrape state
and kick off a fresh BMW X5-only run so the operator can monitor progress in real time.

Purpose: The current drom orchestrator writes `models.json` only at the end of a successful
run (line 676-679), which means a 5-7h BMW pilot is a black box until it terminates. Adding
in-loop snapshots + structured console logging lets the operator `tail -f` the log and
`jq` the in-progress JSON to see exactly which brand/model/generation/complectation is
being processed and what data has accumulated so far.

Output:
- `server/scrapers/drom/index.ts` patched with `snapshotModelsJson()` helper, two snapshot
  call sites, six `[drom]`-prefixed log statements (brand/model/gen/comp/image/per-model summary).
- `data/scraped/drom/` cleaned of all stale run dirs + symlink + cursor.
- A new `2026-05-03T*Z` run dir actively being populated by a backgrounded `pnpm scrape:drom`
  process scoped to `bmw/x5` only, with `smoke.log` capturing live output.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.planning/STATE.md
@server/scrapers/drom/index.ts
@server/scrapers/shared/atomic-write.ts
@server/scrapers/shared/types.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from the codebase. No exploration required. -->

From server/scrapers/shared/atomic-write.ts (already imported in drom/index.ts at line 43):
```typescript
export async function atomicWriteFile(target: string, content: Buffer | string): Promise<void>;
```

From server/scrapers/shared/types.ts (ModelRecord, ReportSummary already imported):
```typescript
export type ModelRecord = z.infer<typeof ModelRecord>; // includes brand_slug, model_slug, generation, complectations[]
export type ReportSummary = {
  // ...
  errors: { url: string; message: string; kind: 'parse' | 'image' | 'orchestrator' | 'inherit' }[];
  models_added: number;
  models_updated: number;
  // ...
};
```

Existing imports in server/scrapers/drom/index.ts (do NOT re-add):
- `resolve` from 'node:path' (line 33)
- `atomicWriteFile` from '../shared/atomic-write.js' (line 43)
- `ModelRecord`, `ReportSummary` types (lines 47-48)

Existing helper placement (where to insert `snapshotModelsJson`):
- `inheritFromPrevCurrent` at lines 99-179
- `emptyReport` at lines 181-200
- Insert `snapshotModelsJson` between them (after line 179, before line 181) so it sits
  alongside the other module-scope helpers.

Snapshot call sites (verified line numbers):
- Site 1: gen loop, immediately after `seen.set(key, record); modelsTouchedThisRun++;` at lines 451-452
- Site 2: per-complectation loop, immediately after `record.complectations.push(comp);` at line 547

Console log sites (existing `[drom]`-prefixed logs to mimic style — see line 322 `[drom] filters: ...`
and line 439 `[drom] skipping generation ...`):
- Brand start: top of `for (let bi = startFromBrandIndex; ...)` at line 348
- Model start: top of `for (let mi = startFromModelIndex; ...)` at line 403
- Generation start: top of `for (const gen of gens)` at line 413
- Per-complectation: top of `for (let ci = startIndex; ci < enrichedTrimRows.length; ci++)` at line 499
- Image branches: lines 567-585 (four branches: skipped/inherited, downloaded, failed, no-source)
- End-of-model summary: after the per-model `writeCursor` at lines 598-603

Per-model counters needed for the end-of-model summary log:
- `report.models_added` and `report.models_updated` are already incremented inside the gen
  loop (lines 446-450). Snapshot them BEFORE the model loop body (`const startModelsAdded = report.models_added;`)
  and compute deltas at the end (`report.models_added - startModelsAdded`).
- For complectation count: track `let perModelComplectations = 0;` and increment it inside
  the per-comp loop right after `record.complectations.push(comp);`.

Existing scraper invocation (from package.json — verify before running):
- `pnpm scrape:drom` runs `tsx server/scrapers/cli.ts drom` (or equivalent). Honors
  `DROM_BRAND_WHITELIST` and `DROM_MODEL_WHITELIST` env vars (added in quick/260501-koe).
- Process name to grep: `tsx server/scrapers/cli.ts`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add live progress (snapshot helper + 2 snapshot calls + 6 log sites) to drom orchestrator</name>
  <files>server/scrapers/drom/index.ts</files>
  <action>
Edit `server/scrapers/drom/index.ts` per these EXACT sub-steps. All changes are additive
(no existing logic moves or deletes). TypeScript strict, no `any`.

**1. Add `snapshotModelsJson` helper.**
Insert this function between `inheritFromPrevCurrent` (ends at line 179) and `emptyReport`
(starts at line 181):

```ts
/**
 * Best-effort live snapshot of the in-progress `seen` map to `<runDir>/models.json`.
 * Called from inside the gen + per-complectation loops so an operator can `jq length`
 * the file and `tail -f` smoke.log to monitor multi-hour runs in real time.
 *
 * MUST be best-effort: a snapshot write failure is logged to `report.errors` (kind:
 * 'orchestrator') but does NOT abort the run. The end-of-run final write at line 676
 * is the authoritative one.
 */
async function snapshotModelsJson(
  runDir: string,
  seen: Map<string, ModelRecord>,
): Promise<void> {
  await atomicWriteFile(
    resolve(runDir, 'models.json'),
    JSON.stringify([...seen.values()], null, 2),
  );
}
```

**2. Wire two snapshot call sites.** Both wrapped in `.catch()` so failures are non-fatal.

Site A — after the existing `seen.set(key, record); modelsTouchedThisRun++;` (lines 451-452).
Insert immediately after line 452:
```ts
              await snapshotModelsJson(runDir, seen).catch((snapErr) => {
                // eslint-disable-next-line no-console
                console.error(
                  `[drom] snapshot failed: ${snapErr instanceof Error ? snapErr.message : String(snapErr)}`,
                );
                report.errors.push({
                  url: 'snapshot:gen',
                  message: `snapshot: ${snapErr instanceof Error ? snapErr.message : String(snapErr)}`,
                  kind: 'orchestrator',
                });
              });
```

Site B — after the existing `record.complectations.push(comp);` (line 547). Insert
immediately after line 547:
```ts
                  await snapshotModelsJson(runDir, seen).catch((snapErr) => {
                    // eslint-disable-next-line no-console
                    console.error(
                      `[drom] snapshot failed: ${snapErr instanceof Error ? snapErr.message : String(snapErr)}`,
                    );
                    report.errors.push({
                      url: 'snapshot:comp',
                      message: `snapshot: ${snapErr instanceof Error ? snapErr.message : String(snapErr)}`,
                      kind: 'orchestrator',
                    });
                  });
```

**3. Add per-model delta counters.** Just BEFORE the gen loop (`for (const gen of gens)` at
line 413), inside the model loop, capture starting values:
```ts
          // Live-progress accounting for the per-model summary log emitted after the gen loop.
          const startModelsAdded = report.models_added;
          const startModelsUpdated = report.models_updated;
          let perModelComplectations = 0;
```

Inside the per-comp loop, immediately after the snapshot Site B above (or equivalently
after `record.complectations.push(comp);` if you prefer reading order), increment:
```ts
                  perModelComplectations++;
```

**4. Add `[drom]`-prefixed console.log statements.**
Match the existing style (see line 322 `[drom] filters: ...` and line 439 `[drom] skipping
generation ...`). Each line uses the `// eslint-disable-next-line no-console` pragma
already used by surrounding lines.

Brand start — insert as the FIRST line inside `for (let bi = startFromBrandIndex; bi < brands.length; bi++) {` (right after line 348, before `const brand = brands[bi];`):
```ts
        // eslint-disable-next-line no-console
        console.log(`[drom] brand ${bi + 1}/${brands.length}: ${brands[bi].brand_slug}`);
```

Model start — insert as the FIRST line inside `for (let mi = startFromModelIndex; mi < models.length; mi++) {` (right after line 403, before `const model = models[mi];`):
```ts
          // eslint-disable-next-line no-console
          console.log(`[drom]   model ${mi + 1}/${models.length}: ${models[mi].model_slug}`);
```

Generation start — insert as the FIRST line inside `for (const gen of gens) {` (right after line 413, before `// 5. Generation page → ModelRecord.`):
```ts
            // eslint-disable-next-line no-console
            console.log(`[drom]     gen ${gen.generation_id} (${gens.indexOf(gen) + 1}/${gens.length})`);
```

Per-complectation start — insert as the FIRST line inside `for (let ci = startIndex; ci < enrichedTrimRows.length; ci++) {` (right after line 499, before `const trimRow = enrichedTrimRows[ci];`):
```ts
                  // eslint-disable-next-line no-console
                  console.log(`[drom]       comp ${ci + 1}/${enrichedTrimRows.length}: ${enrichedTrimRows[ci].comp_id}`);
```

Image — modify the four existing branches (lines 567-585):
- After `report.images_skipped++;` at line 568 (inherited branch), append:
  ```ts
                // eslint-disable-next-line no-console
                console.log(`[drom]       image: skipped (inherited)`);
  ```
- After `report.images_downloaded++;` at line 572 (success branch), append:
  ```ts
                  // eslint-disable-next-line no-console
                  console.log(`[drom]       image: downloaded`);
  ```
- After `record.image_paths = [];` at line 581 (failure branch), append:
  ```ts
                  // eslint-disable-next-line no-console
                  console.log(`[drom]       image: FAILED ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`);
  ```
- After `report.images_skipped++;` at line 584 (no-source branch), append:
  ```ts
                // eslint-disable-next-line no-console
                console.log(`[drom]       image: skipped (no source)`);
  ```

End-of-model summary — insert AFTER the per-model `writeCursor(...)` block at lines
598-603 (i.e. after the closing `});` of the writeCursor call), still inside the model
loop. Use the deltas + counter from step 3:
```ts
          // eslint-disable-next-line no-console
          console.log(
            `[drom]   done ${model.model_slug}: ` +
              `${report.models_added - startModelsAdded} added, ` +
              `${report.models_updated - startModelsUpdated} updated, ` +
              `${perModelComplectations} complectations`,
          );
```

**Constraints (do NOT violate):**
- Do NOT change `current/` symlink semantics — only repointed in success path (line 689).
- Do NOT change the >10% Pitfall-1 gate (line 624) or the image-failure gate (line 638).
- Do NOT remove or weaken the existing `[drom] filters: ...` or `[drom] skipping generation ...` logs.
- Snapshot writes MUST be best-effort (`.catch` swallows the throw, pushes to `report.errors`).
- TypeScript strict mode, no `any`. Use `ModelRecord` / `ReportSummary` types as already imported.
- Use the `// eslint-disable-next-line no-console` pragma on every console call (matches surrounding code).

After all edits, commit Task 1 atomically:
```bash
git add server/scrapers/drom/index.ts
git commit -m "feat(260503-gja): add live progress snapshots + per-loop logs to drom orchestrator"
```
  </action>
  <verify>
    <automated>pnpm typecheck:server</automated>
  </verify>
  <done>
- `server/scrapers/drom/index.ts` contains `async function snapshotModelsJson` definition between `inheritFromPrevCurrent` and `emptyReport`.
- Two `await snapshotModelsJson(runDir, seen).catch(...)` call sites exist (gen loop + per-comp loop).
- Eight new `[drom]`-prefixed `console.log` statements present: brand start, model start, gen start, comp start, 4 image branches, per-model summary.
- `pnpm typecheck:server` exits 0.
- Diff is purely additive — no existing lines deleted or reordered.
- Atomic commit with subject `feat(260503-gja): add live progress snapshots + per-loop logs to drom orchestrator` exists.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wipe drom scrape state and kick off backgrounded BMW X5-only restart</name>
  <files>data/scraped/drom/* (multiple run dirs deleted), data/scraped/drom/current, data/scraped/drom/.cursor.json, data/scraped/drom/smoke.log</files>
  <action>
This task is a shell-driven sequence. Run from repo root (`/Users/mikhailra/Developer/dva.pro`)
in this exact order. Use ABSOLUTE paths in every Bash invocation.

**Step 1 — Verify no in-flight scraper processes.**
```bash
pgrep -af 'tsx server/scrapers/cli.ts' || true
```
If output is non-empty (any matching process listed), ABORT this task and report to the
user: "Scraper process(es) still running — please kill them with `kill <pid>` and re-run
the executor." Do NOT proceed to step 2 in that case.

**Step 2 — Remove the git-tracked old run dir.**
```bash
git rm -r data/scraped/drom/2026-04-28T14-31-09Z
```

**Step 3 — Remove untracked run dirs + symlink + cursor.**
```bash
rm -rf data/scraped/drom/2026-04-30T04-07-47Z \
       data/scraped/drom/2026-05-01T07-28-27Z \
       data/scraped/drom/2026-05-01T08-10-05Z \
       data/scraped/drom/current \
       data/scraped/drom/.cursor.json
```

**Step 4 — Verify the wipe.**
```bash
ls -la data/scraped/drom/
```
Expected remaining entries: `.` `..` `brand-aliases.json` `smoke.log` ONLY. If any
`2026-*` directory or `current` symlink or `.cursor.json` remains, investigate and clean
manually before proceeding.

**Step 5 — Commit the wipe (separate atomic commit from Task 1).**
```bash
git commit -m "chore(260503-gja): wipe drom scrape state for BMW X5 restart"
```
This commit captures the `git rm` of `2026-04-28T14-31-09Z` from step 2. The untracked
deletions in step 3 do not appear in git history (they were never tracked).

**Step 6 — Kick off the scraper in the background.**
CRITICAL: This is a long-running command (5-7h for the full BMW X5 set). Use the Bash
tool with `run_in_background: true`. Do NOT block the executor on completion. Capture
stdout+stderr to `data/scraped/drom/smoke.log` via `tee` so the operator can `tail -f` it.

```bash
DROM_BRAND_WHITELIST=bmw DROM_MODEL_WHITELIST=x5 pnpm scrape:drom 2>&1 | tee data/scraped/drom/smoke.log
```

**Step 7 — Wait briefly for the scraper to create its run dir, then capture the run id.**
After kicking off step 6, wait ~30s for the orchestrator to print `[drom] filters: ...`
and create its `runDir`. Then run:
```bash
sleep 30 && ls -la data/scraped/drom/ | grep -E '^d.*2026-05-' | tail -1
```
Capture the run dir name (format: `2026-05-03T*Z`) — this is the `<runId>` that goes into
SUMMARY.md so the operator can monitor with the watch commands below.

If after the sleep no `2026-05-*` dir exists, check `data/scraped/drom/smoke.log` for
errors (`tail -50 data/scraped/drom/smoke.log`) and report to the user instead of
proceeding. Common failure modes: missing `pnpm` on PATH, `tsx` not installed, FX feed
unreachable, `.cursor.json` deletion failed.

**Step 8 — Confirm the process is alive.**
```bash
pgrep -af 'tsx server/scrapers/cli.ts'
```
Expected: at least one matching process. If empty, the scraper has either crashed early
or completed (unlikely in 30s) — inspect `smoke.log` and report.

**Step 9 — Report run dir + watch commands in SUMMARY.md.**
The orchestrator (`/gsd-quick`) will write SUMMARY.md after Task 2 returns. Include in
your final assistant message back to the orchestrator:
- The captured run dir name (e.g. `2026-05-03T11-58-32Z`)
- The two operator watch commands (template below — substitute `<runId>` with actual)

Operator watch commands (for the SUMMARY):
```
tail -f data/scraped/drom/smoke.log
watch -n 5 'jq "length" data/scraped/drom/<runId>/models.json 2>/dev/null'
```

**Constraints:**
- Do NOT touch `data/scraped/fx/`, `brand-aliases.json` (only `smoke.log` gets overwritten by `tee` — that's expected).
- The scraper does NOT need to complete before SUMMARY.md is written — Task 2's goal is to
  start it and report the run dir + watch instructions.
- Do NOT `cd` between commands — use absolute paths consistently.
- The wipe commit (step 5) MUST be a separate atomic commit from the Task 1 code commit.
  </action>
  <verify>
    <automated>ls data/scraped/drom/ | grep -cE '^(brand-aliases\.json|smoke\.log|2026-05-)$' | grep -E '^[2-9]$'</automated>
  </verify>
  <done>
- `data/scraped/drom/` contains exactly: `brand-aliases.json`, `smoke.log`, and ONE new `2026-05-*Z` run dir (created by the backgrounded scraper).
- `current` symlink absent (will be (re)created by the scraper on success at end of run).
- `.cursor.json` absent (will be (re)created by the scraper at first per-model checkpoint).
- Wipe commit exists in git log with subject `chore(260503-gja): wipe drom scrape state for BMW X5 restart`.
- `pgrep -af 'tsx server/scrapers/cli.ts'` returns at least one matching process (scraper is running).
- `data/scraped/drom/smoke.log` contains the line `[drom] filters: brands=[bmw], models=[x5], minYearTo=none` (proves env-var filters were honored).
- The captured run dir name is reported back to the orchestrator for inclusion in SUMMARY.md.
  </done>
</task>

</tasks>

<verification>
End-of-plan checks (orchestrator runs these before writing SUMMARY.md):

1. **Code change committed:**
   ```bash
   git log -1 --format='%s' -- server/scrapers/drom/index.ts | grep -q '260503-gja'
   ```
2. **Wipe committed:**
   ```bash
   git log --format='%s' -n 5 | grep -q 'wipe drom scrape state for BMW X5 restart'
   ```
3. **Typecheck clean:**
   ```bash
   pnpm typecheck:server
   ```
4. **Scraper running:**
   ```bash
   pgrep -af 'tsx server/scrapers/cli.ts'
   ```
5. **Smoke log shows filters:**
   ```bash
   grep -F '[drom] filters: brands=[bmw], models=[x5]' data/scraped/drom/smoke.log
   ```
</verification>

<success_criteria>
- Task 1 atomic commit landed: `feat(260503-gja): add live progress snapshots + per-loop logs to drom orchestrator`.
- Task 2 atomic commit landed: `chore(260503-gja): wipe drom scrape state for BMW X5 restart`.
- `pnpm typecheck:server` exits 0.
- A backgrounded `pnpm scrape:drom` process is running with `DROM_BRAND_WHITELIST=bmw DROM_MODEL_WHITELIST=x5`.
- A new `data/scraped/drom/2026-05-*Z/` run dir exists and the operator can monitor live via `tail -f data/scraped/drom/smoke.log` + `jq length data/scraped/drom/<runId>/models.json`.
- The captured run dir name is reported back so it lands in SUMMARY.md.
</success_criteria>

<output>
After completion, the orchestrator (`/gsd-quick`) will create
`.planning/quick/260503-gja-add-live-progress-to-drom-scraper-restar/260503-gja-SUMMARY.md`
including the captured run dir name and the operator watch commands.
</output>
