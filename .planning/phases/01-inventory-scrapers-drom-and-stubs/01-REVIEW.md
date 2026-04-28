---
phase: 01-inventory-scrapers-drom-and-stubs
reviewed: 2026-04-28T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - data/scraped/README.md
  - data/scraped/SCHEMA.md
  - data/scraped/drom/brand-aliases.json
  - scripts/build-cbr-fixture.mjs
  - server/scrapers/autohome/index.ts
  - server/scrapers/beforward/index.ts
  - server/scrapers/che168/index.ts
  - server/scrapers/cli.ts
  - server/scrapers/drom/index.ts
  - server/scrapers/drom/parse-brand-index.ts
  - server/scrapers/drom/parse-generation-list.ts
  - server/scrapers/drom/parse-generation-page.ts
  - server/scrapers/drom/parse-model-list.ts
  - server/scrapers/encar/index.ts
  - server/scrapers/shared/atomic-write.ts
  - server/scrapers/shared/block-detection.ts
  - server/scrapers/shared/cursor.ts
  - server/scrapers/shared/fx.ts
  - server/scrapers/shared/http.ts
  - server/scrapers/shared/normalize.ts
  - server/scrapers/shared/symlink.ts
  - server/scrapers/shared/types.ts
  - server/tests/block-detection.test.ts
  - server/tests/cursor.test.ts
  - server/tests/drom-integration.test.ts
  - server/tests/drom-parsers.test.ts
  - server/tests/fx.test.ts
  - server/tests/http.test.ts
  - server/tests/normalize.test.ts
  - server/tests/stubs.test.ts
findings:
  critical: 6
  warning: 11
  info: 7
  total: 24
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-28
**Depth:** standard
**Files Reviewed:** 29 (plus the two transitively-imported `shared/images.ts` and `shared/brand-aliases.ts` that the orchestrator depends on)
**Status:** issues_found

## Summary

The phase ships a working drom scraper plus four well-isolated stubs. The shared
modules (`http`, `fx`, `block-detection`, `symlink`, `atomic-write`, `cursor`) each
have a clean single-purpose contract, are unit-tested in isolation, and the
recently-tightened `block-detection` regex set looks correct (no ReDoS, validated
against the false-positive Phase 1 nav copy). The recently-fixed
`charsetFromContentType` path in `fetchHtml` correctly delegates to `iconv-lite`
when drom advertises `charset=windows-1251`, and `http.test.ts` covers the
round-trip end-to-end against a local server.

However, the **orchestrator's resume / cursor logic in `server/scrapers/drom/index.ts`
contains four independent correctness bugs** that together undermine the whole
crash-recovery story (D-15). Two of them silently restart already-completed work
on resume; one permanently loses brand-alias data; one mis-classifies image-fetch
failures as DOM regressions and aborts the run. The integration test does not
cover `resume: true` so none of these are caught by the existing suite.

A second bug class is the asymmetry in hero-image handling between
`parseGenerationList` (the URL source) and `parseGenerationPage` (the
`image_paths` decision): empty/missing-hero combinations produce orphan paths
in `models.json` or orphan WebP files on disk.

A third bug is in `fetchFx`: the orchestrator wires the `firstRun` flag to
"there is no resume cursor", but the function's contract is "there is no
ANY cache file". A clean (non-resumed) run after a successful first run will
fail-fast on a transient CBR network blip even though older same-month caches
exist.

There are also smaller correctness issues (engine-line regex matches "л.с." as
"litres" if DOM order shifts; cli.ts can crash trying to JSON.serialize a
circular `cause`; the integration test bypasses block-detection and its comment
is stale post-tightening).

The four stubs and the shared utility modules are clean.

---

## Critical Issues

### CR-01: Cursor resume restarts entire catalog when `lastBrandSlug` is no longer in DOM

**File:** `server/scrapers/drom/index.ts:125-130`
**Issue:** After resume, the orchestrator computes the brand start-index as:
```ts
const startFromBrandIndex = cursor
  ? Math.max(0, brands.findIndex((b) => b.brand_slug >= cursor!.lastBrandSlug))
  : 0;
```
`Array.findIndex` returns `-1` when no element matches. `Math.max(0, -1) === 0`,
so any of these conditions silently restart the whole catalog from index 0:
1. Drom removed the cursored brand between runs (e.g. discontinued sub-brand).
2. `DROM_BRAND_WHITELIST` was changed between runs to exclude the cursored brand.
3. Brand list is returned in DOM order but `cursor.lastBrandSlug` is
   lexicographically greater than every remaining brand (see CR-03).

The user gets a "resumed" run that quietly re-fetches ~70 brand pages and a week
of work, with no warning. `report.cursor_resumed: true` will still be reported
even though nothing was actually skipped.

**Fix:**
```ts
const idx = cursor
  ? brands.findIndex((b) => b.brand_slug >= cursor.lastBrandSlug)
  : 0;
if (cursor && idx === -1) {
  throw new Error(
    `Cursor.lastBrandSlug='${cursor.lastBrandSlug}' not present in current brand list ` +
    `(removed from drom or filtered by DROM_BRAND_WHITELIST). Refusing silent restart; ` +
    `delete .cursor.json explicitly to start over.`,
  );
}
const startFromBrandIndex = cursor ? idx : 0;
```

---

### CR-02: Cursor model-resume restarts entire brand when `lastModelSlug` is the lexicographically last model

**File:** `server/scrapers/drom/index.ts:143-149`
**Issue:** Same `Math.max(0, findIndex(...))` bug as CR-01 at the model level:
```ts
const startFromModelIndex =
  cursor && brand.brand_slug === cursor.lastBrandSlug
    ? Math.max(0, models.findIndex((m) => m.model_slug > cursor!.lastModelSlug))
    : 0;
```
`findIndex(m => m.model_slug > cursor.lastModelSlug)` returns `-1` whenever
`cursor.lastModelSlug` is greater than or equal to every model in the current
brand. Two ways this happens in production:

1. **Brand fully completed**: cursor is written per-model, brand-aliases is merged
   at end of brand, but **no cursor write tells the orchestrator the brand is
   done**. So if process A completes brand `bmw` (writes alias), then crashes
   between `mergeAliases` and the start of the next brand, `cursor.lastBrandSlug
   === 'bmw'` AND `cursor.lastModelSlug === <last model alphabetically beyond
   any further model>`. On resume, brand-resume picks BMW (CR-01: `>=` keeps it),
   model-resume returns -1 → falls back to 0 → re-fetches every BMW model and
   re-downloads every image. Wasted ~1 day at 10s/req.
2. **Brand partially completed but lexicographic last model done**: e.g. BMW's
   final model alphabetically is `z4`. Cursor written after `z4`. Crash. Resume
   re-fetches all of BMW.

This silently loses up to ~1 day of work on every "happy" resume after a
brand-end crash, which is the single most likely crash window because
`mergeAliases` writes a tracked file (`data/scraped/drom/brand-aliases.json`)
near the end of each brand.

**Fix:** Distinguish "brand fully completed" with a sentinel marker and a
separate code path. Suggested cursor schema extension:
```ts
export type Cursor = {
  lastBrandSlug: string;
  lastModelSlug: string | null;  // null ⇒ brand fully completed; advance to next brand
  completedAt: string;
};
```
And after the inner model loop completes for a brand:
```ts
await writeCursor(runDir, {
  lastBrandSlug: brand.brand_slug,
  lastModelSlug: null,
  completedAt: new Date().toISOString(),
});
```
Then in resume:
```ts
if (cursor.lastModelSlug === null) {
  // Brand was fully done; advance to the NEXT brand
  startFromBrandIndex = brands.findIndex((b) => b.brand_slug > cursor.lastBrandSlug);
  if (startFromBrandIndex === -1) return /* nothing left */;
}
```
Also add explicit `findIndex === -1` handling for the model index to throw
loudly rather than restart silently.

---

### CR-03: Cursor logic assumes lexicographic order, but parsers return DOM order

**File:** `server/scrapers/drom/index.ts:127, 147` and `parse-brand-index.ts:31-54`, `parse-model-list.ts:34-72`
**Issue:** The cursor resume logic uses string comparison (`b.brand_slug >=
cursor.lastBrandSlug`, `m.model_slug > cursor.lastModelSlug`) which only works
correctly if the brand and model arrays are returned in **alphabetically sorted
order**. But neither parser sorts: both walk `$('a[href*="/catalog/"]').each(...)`
in DOM-traversal order, which is whatever drom emits. `<noscript>` blocks may
list brands A-Z, but scripted templates often list "popular" brands first or
group by region. When DOM order ≠ alphabetic order, the comparison silently
mis-skips:

- DOM order = `[lada, bmw, audi]`, cursor `lastBrandSlug='bmw'` →
  `findIndex(b => b.brand_slug >= 'bmw')` returns index 1 (bmw) — but lada
  should also have been skipped if it was processed earlier in the prior run.
  Actually worse: if lada was processed and written, AND we restart at bmw,
  audi is processed too. Result depends on cursor data + DOM order in
  unpredictable ways.

- For models: DOM order = `[x5, x3, x1]`, cursor `lastModelSlug='x5'` →
  `findIndex(m => m.model_slug > 'x5')` returns -1 → falls back to 0 → repeats
  x5. Same orphan-restart pattern as CR-02.

**Fix:** Either (a) sort the parser output (`brands.sort((a, b) =>
a.brand_slug.localeCompare(b.brand_slug))`) so the lexicographic assumption
holds, OR (b) change cursor semantics to "list of completed brand_slugs / model_slugs"
(set membership instead of position). Option (a) is the smaller change and is
already idempotent. Add a regression test in `cursor.test.ts` that constructs
an out-of-order brand array and confirms resume skips correctly.

---

### CR-04: Aborted brand-aliases entries are lost on the next resume

**File:** `server/scrapers/drom/index.ts:151-216`
**Issue:** `brandModels` is a fresh `{}` per brand iteration (line 134), and
`mergeAliases` is only called once the brand's full model loop completes
(line 216). On resume mid-brand:

1. Process A finishes models `[m1, m2, m3]` of brand X, crashes before m4. No
   `mergeAliases` call yet for X (it sits AFTER the model loop).
2. Process B resumes from m4. `brandModels` starts empty for X. Even if
   `mergeAliases` runs at end of brand, only `[m4, m5, ...]` are merged.
3. Models `m1, m2, m3` of X are **never** added to `brand-aliases.json`.

This is a permanent data loss for the alias map. The `models.json` records for
m1-m3 are also lost because `records: ModelRecord[]` is a fresh in-memory array
in the new run. The new run only writes records collected in this run.

**The deeper problem:** Phase 1 conflates "scrape this run" with "scrape until
done". Each invocation is a fresh `runId`, fresh `runDir`, fresh records array.
But the cursor tries to make multiple invocations look like one logical run.
The two are incompatible: the resume cursor is brand-boundary, but the data
emission (`models.json`, alias merge) is per-run, so the prior run's partial
data is never folded in.

**Fix (smallest correct change):** Document the contract: "resume re-scrapes the
brand the cursor points to from scratch; partial brand data from the aborted
run is discarded." Then in the orchestrator, when `cursor` is set, set
`startFromModelIndex = 0` (always re-do the cursored brand fresh). This makes
the data-loss visible and predictable. The trade-off (re-fetch ~1 brand of
pages on resume) is already documented in `data/scraped/README.md:88-89`.

**Fix (full correctness):** Persist `brandModels`, `records[]`, and `report` to
disk after every model (not just the cursor), and rehydrate them on resume.
This is the larger v1.x cursor-refactor mentioned in the README.

Either way, the current behaviour silently loses data and must not ship.

---

### CR-05: `parseGenerationPage`'s `image_paths` decision is desynchronized from the orchestrator's image fetch

**File:** `server/scrapers/drom/parse-generation-page.ts:163-174, 222-225` and `server/scrapers/drom/index.ts:180-193`
**Issue:** Two independent code paths decide hero-image presence and write
disagreeing artifacts:

1. `parseGenerationList` (called once per model) sets `gen.hero_image_url` from
   `<img>` inside the gen-list anchor. This URL is what the orchestrator
   downloads at `index.ts:182`.
2. `parseGenerationPage` (called once per generation) calls
   `extractHeroImageUrl(html)` which **re-loads the entire page DOM** and
   searches for an `s.auto.drom.ru` image. This decides whether `image_paths`
   is `[]` or `['images/<hero>.webp']` in the final record.

The two sources may disagree:
- If `parseGenerationList` finds no hero (`gen.hero_image_url` is undefined)
  but `parseGenerationPage` finds one → `image_paths` lists a WebP, but the
  orchestrator's `if (gen.hero_image_url && record.image_paths.length > 0)`
  guard at line 180 falls through (because `gen.hero_image_url` is falsy), so
  `images_skipped++` is incremented and **no file is written**. Result:
  `models.json` references a WebP that doesn't exist on disk, and Phase 3's
  importer breaks.
- If `parseGenerationList` finds a hero but `parseGenerationPage`'s extraction
  fails (e.g. drom changes the s.auto.drom.ru CDN host) → `image_paths` is `[]`,
  and the same guard at line 180 still passes (`gen.hero_image_url` truthy)
  but `record.image_paths.length > 0` is false → no download. WebP file is not
  produced AND record has no path. Less severe (matches reality) but the
  control flow is still tangled.

Plus: `parseGenerationPage` calls `cheerio.load(html)` twice (once at line 177,
once inside `extractHeroImageUrl` at line 164) — wasteful re-parse of the same
HTML.

**Fix:** Single source of truth — let `parseGenerationPage` accept an optional
`heroImageUrl` from context:
```ts
export interface GenerationPageContext {
  // ...existing fields
  heroImageUrl?: string;  // from parseGenerationList
}
// In parseGenerationPage:
const image_paths = ctx.heroImageUrl
  ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`]
  : [];
```
And drop the second `cheerio.load` call. Orchestrator already has `gen.hero_image_url`
— pass it in the ctx object and the two paths become consistent by construction.

---

### CR-06: `extractPrices` mis-classifies image-fetch failures as DOM regressions, aborting the run

**File:** `server/scrapers/drom/index.ts:186-200, 219-225`
**Issue:** Image-fetch failures push to `report.errors[]`:
```ts
report.errors.push({
  url: gen.hero_image_url,
  message: `image: ${imgErr instanceof Error ? imgErr.message : String(imgErr)}`,
});
```
Then the run-end check at 219-225:
```ts
const totalAttempted = report.models_added + report.errors.length;
if (totalAttempted > 0 && report.errors.length / totalAttempted > 0.1) {
  throw new Error(`Validation drop-out > 10% ...; likely DOM regression`);
}
```
This conflates two separate failure modes:
- DOM regressions (parse failures from `parseGenerationPage`) — the legitimate
  Pitfall 1 trigger.
- Network/CDN failures from `s.auto.drom.ru` (e.g. timeout, 403, sharp decoding
  error) — completely unrelated to drom catalog HTML structure.

If drom's image CDN has a bad afternoon and >10% of hero downloads fail, the
entire run aborts with `final_status: 'error'` and **the symlink is not
updated, even though every record parsed and validated correctly**. The
`current/` pointer stays on the previous (potentially weeks-old) run, and the
new run dir is left orphaned. Phase 3 importer sees stale data.

**Fix:** Track parse errors and image errors separately:
```ts
// In ReportSummary:
errors: { url: string; message: string; kind: 'parse' | 'image' | 'orchestrator' }[];

// In the catch blocks, tag the error.kind. Then:
const parseErrors = report.errors.filter(e => e.kind === 'parse').length;
const totalAttempted = report.models_added + parseErrors;
if (totalAttempted > 0 && parseErrors / totalAttempted > 0.1) {
  throw new Error(...);
}
```

---

## Warnings

### WR-01: `fetchFx`'s `firstRun` flag conflates "no resume cursor" with "no ever-cached file"

**File:** `server/scrapers/drom/index.ts:104` and `server/scrapers/shared/fx.ts:61`
**Issue:** Orchestrator wires `await fetchFx({ firstRun: !cursor })`. The intent
of the `firstRun` flag in `fx.ts` (per the comment at lines 56-58, "fail-fast on
first run, no cache fallback") is "this is the first ever drom invocation,
there is no possible cached file to fall back to". But `!cursor` actually
means "this is a non-resumed run", which is true for any clean post-success
re-run.

Concretely: after one successful run, `cbr-2026-04-27.json` exists in
`data/scraped/fx/`. On the next morning's clean run with `cursor === null`,
`firstRun=true` is passed. If today's CBR fetch fails AND today's cache is
absent, `fx.ts` throws `CBR FX fetch failed on first run; cannot proceed`
even though `cbr-2026-04-27.json` exists and would be a perfectly good
fallback. The `else { ...candidates }` branch at lines 86-94 is unreachable
under this orchestrator wiring on a non-first-but-not-resumed run.

**Fix:** Detect "first ever" by inspecting the cache directory:
```ts
const fxCacheExists = (await readdir('data/scraped/fx').catch(() => []))
  .some(f => /^cbr-\d{4}-\d{2}-\d{2}\.json$/.test(f));
const fx = await fetchFx({ firstRun: !fxCacheExists });
```
Or better: drop the `firstRun` parameter entirely and let `fx.ts` always
attempt the cache fallback, throwing only if no cache file at all exists.

---

### WR-02: `parseEngineLine` misparses "249 л.с." as 249 litres if DOM text order shifts

**File:** `server/scrapers/drom/parse-generation-page.ts:67-72`
**Issue:** The litre regex
```ts
const litreMatch = text.match(/(\d+(?:[.,]\d)?)\s*л(?![а-яё])/i);
```
uses a negative lookahead `(?![а-яё])` to avoid matching "лошадиных". But the
character after `л` in "249 л.с." is `.`, which is NOT in `[а-яё]`, so the
regex DOES match `249 л` if it appears before `3.0 л` in the text. Today's
fixture orders "3.0 л, 249 л.с." (litres first), so `match()` (returns first
match) gets 3.0 → 3000cc. But if drom ever swaps the column order or
re-templates the cell, the same regex returns 249 → 249000cc, and the engine
record is wildly wrong.

**Fix:** Anchor the litre regex more specifically — e.g. require a comma or
end-of-pattern after the litres digit (and exclude `.`):
```ts
const litreMatch = text.match(/(\d+(?:[.,]\d)?)\s*л(?=[\s,;]|$)/i);
```
Or extend the negative lookahead: `(?![а-яё.])` to reject the dot too.

Also: `(\d+(?:[.,]\d)?)` only allows ONE decimal digit — `2.99` won't match,
only `2.9`. Drom uses single-decimal litres so this is OK today, but worth
documenting.

---

### WR-03: `cli.ts` can crash printing the result if a thrown `cause` is circular

**File:** `server/scrapers/cli.ts:28-36`
**Issue:**
```ts
} catch (e) {
  result = {
    status: 'error',
    source: sourceArg,
    error: { message: e instanceof Error ? e.message : String(e), cause: e },
  };
}
console.log(JSON.stringify(result, null, 2));
```
`cause: e` puts the raw error object — possibly a Node `AggregateError`,
`got.RequestError` with a self-referential `request` property, or an
`Error.cause` chain — into the JSON.stringify input. If anything in the chain
is non-serializable (BigInt, function, circular ref), `JSON.stringify` throws
and the CLI dies with an unrelated stack trace before exiting with the proper
code.

**Fix:** Don't include `cause` in the printed result, or sanitize first:
```ts
const safeCause = e instanceof Error
  ? { name: e.name, message: e.message, stack: e.stack }
  : undefined;
result = {
  status: 'error',
  source: sourceArg,
  error: { message: e instanceof Error ? e.message : String(e), cause: safeCause },
};
```

---

### WR-04: `readCursor` swallows JSON parse errors AND missing-field errors silently

**File:** `server/scrapers/shared/cursor.ts:22-29`
**Issue:**
```ts
export async function readCursor(runDir: string): Promise<Cursor | null> {
  try {
    const raw = await readFile(resolve(runDir, CURSOR_FILENAME), 'utf-8');
    return JSON.parse(raw) as Cursor;
  } catch {
    return null;
  }
}
```
Two problems:
1. The blanket `catch` lumps "file absent" (the legitimate "no cursor" case)
   with "file present but corrupt JSON" (a real error that should alert).
   Returning `null` for both means a corrupt cursor silently triggers a fresh
   restart instead of a halt-and-investigate.
2. `JSON.parse(raw) as Cursor` is an unchecked type assertion. If the JSON
   parses but is missing fields (e.g., legacy schema, hand-edited file), the
   orchestrator gets `cursor.lastBrandSlug === undefined`, then comparisons
   like `b.brand_slug >= undefined` are always false → `findIndex` returns -1
   → CR-01 silent restart.

**Fix:** Distinguish ENOENT from other errors AND validate the shape with zod:
```ts
import { z } from 'zod';
const CursorSchema = z.object({
  lastBrandSlug: z.string().min(1),
  lastModelSlug: z.string().min(1),
  completedAt: z.string().datetime(),
});

export async function readCursor(runDir: string): Promise<Cursor | null> {
  let raw: string;
  try {
    raw = await readFile(resolve(runDir, CURSOR_FILENAME), 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;  // permission denied, etc. — surface to caller
  }
  return CursorSchema.parse(JSON.parse(raw));  // throws on shape mismatch — by design
}
```
Update `cursor.test.ts:30-33` to test that corrupt JSON now THROWS rather than
returns null (current test "readCursor returns null when .cursor.json is
corrupt" enshrines the bug).

---

### WR-05: Integration test bypasses block-detection via stale `NEUTRALIZE_BLOCK_KEYWORDS`

**File:** `server/tests/drom-integration.test.ts:77-93`
**Issue:** The test pre-processes fixture HTML to strip every block-detection
keyword:
```ts
const NEUTRALIZE_BLOCK_KEYWORDS = (s: string): string =>
  s
    .replace(/Проверка по VIN/g, 'История по VIN')
    .replace(/проверка/gi, 'осмотр')
    .replace(/robot/gi, 'crawler')
    .replace(/verify/gi, 'check')
    .replace(/капча/gi, 'токен');
```
The accompanying comment claims `block-detection`'s regex is "intentionally
permissive". That was true before plan-09's tightening; the current
`block-detection.ts:22-29` regexes are specific (`/я не робот/i`,
`/cf-(challenge|turnstile)/i`, etc.) and would NOT trigger on `Проверка по
VIN` or bare `robot`/`verify`. So the neutralization is dead code that masks
two real risks:
1. The integration test no longer verifies the orchestrator's interaction with
   block-detection at all; the next time someone loosens the regex, the test
   won't catch it.
2. The stale comment will confuse future maintainers who think the regex is
   still permissive.

**Fix:** Remove `NEUTRALIZE_BLOCK_KEYWORDS` and the corresponding `.replace`
calls. The fixtures should pass through `block-detection` cleanly under the
post-tightening regex set. Then add a separate test case that asserts the
orchestrator returns `status: 'blocked'` when given a fixture that contains
`<h1>Я не робот</h1>`.

---

### WR-06: `report.errors` semantically conflates "image fetch failed" with "no hero available"

**File:** `server/scrapers/drom/index.ts:191-193`
**Issue:**
```ts
if (gen.hero_image_url && record.image_paths.length > 0) {
  try { await downloadAndConvert(...); report.images_downloaded++; }
  catch { report.images_skipped++; report.errors.push(...); }
} else {
  report.images_skipped++;  // no hero in source — neutral, not an error
}
```
`images_skipped` increments on BOTH (a) drom didn't have a hero (totally
normal for older generations) AND (b) we failed to download the hero (real
problem). This means `images_skipped` is unactionable as an alert metric, and
post-run triage requires correlating against the absence/presence of error
entries by URL.

**Fix:** Split the counter:
```ts
// in ReportSummary:
images_no_source: number;   // drom didn't expose a hero URL
images_failed: number;      // we tried and failed
```

---

### WR-07: User-Agent string is two years stale

**File:** `server/scrapers/shared/http.ts:51-52`
**Issue:**
```ts
'User-Agent':
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
```
Chrome 126 shipped in June 2024. Today is 2026-04-28; current Chrome is
~Chrome 138/139. Drom's bot-detection may down-rank old UAs as suspicious
(stale browsers correlate with bots / unattended scripts). This is a
quality risk now and a likely block-detection trigger later.

**Fix:** Bump to a current major. Better: pin a specific UA in a single
constant with a comment "verified working as of YYYY-MM"; add a calendar
reminder to refresh.

---

### WR-08: Module-scoped `cookieJar` leaks across runs in the same Node process

**File:** `server/scrapers/shared/http.ts:19, 41-56`
**Issue:** `const cookieJar = new CookieJar()` at module scope persists for
the lifetime of the Node process. In CLI mode (one-shot) this is fine. But the
moment the orchestrator is hosted under any long-lived process (Phase 3's
worker, or even a `pnpm scrape <a> && pnpm scrape <b>` sequence on a hot
module cache), drom-set tracking cookies (`__utma`, `_ym_uid`, etc.) accumulate
forever and cross-pollinate across scraper instances.

**Fix:** Either expose `cookieJar.removeAllCookies()` and call it at the start
of each `IScraper.run()`, or accept a per-run `CookieJar` parameter into a
factory function `makeDromClient()`.

---

### WR-09: `extractHeroImageUrl` is called inside `parseGenerationPage` but its result is only used as a presence check

**File:** `server/scrapers/drom/parse-generation-page.ts:163-174, 222-225`
**Issue:** `extractHeroImageUrl(html)` does work (re-loads cheerio,
runs three CSS selectors), then the result is only used as `heroImg ? [...] :
[]` — the URL itself is thrown away. The orchestrator uses
`gen.hero_image_url` (from `parseGenerationList`) for the actual download.
This is wasteful (extra parse pass over multi-MB HTML), and subtly buggy per
CR-05.

**Fix:** Take the hero URL from the generation-list context (see CR-05) and
delete `extractHeroImageUrl` from `parse-generation-page.ts`. Keep it as a
named export ONLY if a future code path needs it; otherwise remove for
single-source-of-truth.

---

### WR-10: `parsePrice` regex in `extractPrices` requires ≥2 chars after first digit

**File:** `server/scrapers/drom/parse-generation-page.ts:134`
**Issue:** `const ROUBLE_RE = /(\d[\d\s ]+)\s*₽/u;`. The `+` quantifier on
`[\d\s ]+` requires AT LEAST ONE more character (digit or space) after the
leading digit. So `9 ₽` matches (`9` + ` `), but `9₽` (no space, single
digit) does not. Drom uses spaced thousands separators so this is OK in
practice; flag for completeness.

Also: the character class `[\d\s ]` includes both `\s` and a literal space —
the literal space is redundant since `\s` already covers it.

**Fix:** Tighten to `/(\d[\d\s]*)\s*₽/u` — `*` allows single-digit prices and
removes the redundant literal space.

---

### WR-11: `mergeAliases` has no concurrency guard — second run overwrites first

**File:** `server/scrapers/shared/brand-aliases.ts:17-48`
**Issue:** `mergeAliases` does read-modify-write on a tracked file via
`atomicWriteFile`. There is no advisory lock. Two concurrent
`pnpm scrape:drom` invocations (e.g. dev runs locally while CI runs
nightly) will race: each reads the same baseline, each merges its slice,
each writes — last write wins. The phase deliberately runs single-process,
but a developer running `pnpm scrape:drom` while a previous one is still
churning would silently lose alias data from the older run.

**Fix:** Either (a) document loudly in `data/scraped/README.md` that
concurrent runs are unsupported, or (b) take an OS-level advisory lock
(e.g. `proper-lockfile` on the alias file path) at the start of `mergeAliases`.

---

## Info

### IN-01: Stale Chrome UA already covered in WR-07

(Tracked as WR-07; no separate Info entry.)

### IN-02: `decodeCbrXml` hardcodes `'win1251'` regardless of encoding declaration

**File:** `server/scrapers/shared/fx.ts:29`
**Issue:** `iconv.decode(bytes, 'win1251')` ignores the `<?xml encoding=...>`
declaration. Today CBR always emits windows-1251; on the day they switch to
UTF-8, the decoder will mojibake silently (Cyrillic in `<Name>` corrupts but
the field isn't asserted).
**Fix:** Read first 200 bytes as ASCII, sniff the `encoding="..."` attribute,
default to `windows-1251`. Or accept the risk and add a unit test that fails
if `<?xml encoding="utf-8"?>` is observed.

### IN-03: Redundant `mkdir` in `fetchFx` (already done by `atomicWriteFile`)

**File:** `server/scrapers/shared/fx.ts:76-77`
**Issue:** `await mkdir(CACHE_DIR, { recursive: true })` immediately followed
by `atomicWriteFile(cachePath, ...)` — the latter already calls
`mkdir(dirname(target), { recursive: true })`. Functional but duplicate.
**Fix:** Drop the explicit `mkdir`.

### IN-04: `report.errors.push({ url: 'orchestrator', ... })` uses a sentinel string instead of a real URL

**File:** `server/scrapers/drom/index.ts:268-271`
**Issue:** The `url` field on errors is typed `string`, so the sentinel
'orchestrator' is well-typed but inconsistent. A consumer iterating errors
to retry by URL will choke.
**Fix:** Change `errors[]` shape to `{ url?: string; kind: 'parse'|'image'|'orchestrator'; message: string }`
(see CR-06 fix).

### IN-05: `drom-parsers.test.ts` whitelist tests duplicate orchestrator logic instead of testing it

**File:** `server/tests/drom-parsers.test.ts:152-199`
**Issue:** The test re-implements the whitelist filter as
`applyWhitelist<T>()` and tests THAT inline copy. The real orchestrator's
filter at `drom/index.ts:115-122` is not exercised. If someone tweaks the
orchestrator's filter logic and forgets to update the inline test, the test
suite passes while production breaks.
**Fix:** Export the filter logic as a small named function from
`drom/index.ts` (e.g. `applyBrandWhitelist`) and have the test import it.

### IN-06: `console.warn` in stub scrapers is a poor signalling channel for v1.x authors

**File:** `server/scrapers/{encar,beforward,che168,autohome}/index.ts:7`
**Issue:** Each stub uses `console.warn('[<name>] TODO: ...')`. CI runs that
include these stubs (e.g. `pnpm scrape:encar` in a smoke test) will emit
warnings that may be filtered out of CI logs. The exit code 2 is the
authoritative signal; the warn is decorative.
**Fix:** Either keep as-is (cheap and visible) or move the TODO to the
returned `ScrapeResult.todo` field only (already present). Minor.

### IN-07: `drom-integration.test.ts` does not exercise the resume code path

**File:** `server/tests/drom-integration.test.ts:175`
**Issue:** Only `drom.run({ resume: false })` is tested end-to-end. The
buggy resume logic (CR-01..CR-04) has zero integration coverage. Per
`server/tests/cursor.test.ts`, the cursor module's read/write/delete
primitives are tested in isolation, but the orchestrator's USE of those
primitives is not.
**Fix:** Add a test that (a) seeds a `.cursor.json` in the run dir, (b)
runs `drom.run({ resume: true })`, (c) asserts that the brand at
`cursor.lastBrandSlug` is processed but earlier brands are skipped.
A second test should construct a brand list in non-alphabetic DOM order
and assert the resume still skips correctly (this will fail until CR-03
is fixed — desirable failing test).

---

## Notes on items NOT classified as findings

- **152-FZ**: confirmed clean. None of the scrapers handle PII. The only
  per-record logging is drom catalog URLs and parse error messages, both
  of which contain only public catalog content. `report.errors[].url` and
  `BlockedError.sampleUrl` are also drom catalog URLs. No telephone, email,
  or quiz-payload data is touched in Phase 1.
- **Block-detection ReDoS**: regexes use bounded `{0,40}` gaps and no nested
  quantifiers. Per the comment at `block-detection.ts:17-18`, the threat
  model has been considered. The fixture-based tests cover both positive
  and negative cases (regression coverage for the false-positives caught in
  the live smoke run).
- **Symlink atomicity**: `pointCurrentAt` writes to a unique tmp name then
  `rename()`s — POSIX-atomic on the same filesystem, correct for the
  documented OS targets (macOS APFS, Linux ext4). Windows is explicitly out
  of scope.
- **Atomic file writes**: `atomicWriteFile` uses `${process.pid}.${Date.now()}`
  tmp suffix and `rename()` — collision-free in single-process orchestration,
  acceptable.
- **`got` retry config**: `2_000 * 2 ** attemptCount` with `Math.min(60_000, ...)`
  caps backoff at 60s. Safe.
- **Polite delay (D-14)**: `lastRequestAt = Date.now()` updated AFTER the
  wait but BEFORE the actual fetch. This means the elapsed time used in the
  next call's calculation includes the polite wait but not the fetch
  duration — slightly more aggressive than 10s/req if fetches are fast,
  slightly more conservative if fetches are slow. Acceptable.

---

_Reviewed: 2026-04-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
