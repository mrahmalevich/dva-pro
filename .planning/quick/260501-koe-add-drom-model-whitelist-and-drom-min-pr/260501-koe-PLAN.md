---
phase: quick
plan: 260501-koe
type: execute
wave: 1
depends_on: []
files_modified:
  - server/scrapers/drom/index.ts
  - server/tests/drom-integration.test.ts
  - data/scraped/README.md
autonomous: true
requirements: []

must_haves:
  truths:
    - "Setting DROM_MODEL_WHITELIST=x5 against a multi-model brand causes the orchestrator to process only the x5 model (parsed model list filtered before alphabetic sort + cursor logic)."
    - "Setting DROM_MIN_PRODUCTION_YEAR=2018 against a generation with year_to=2017 causes that generation to be skipped entirely (no record persisted, no hero image fetched, no per-comp loop, models_added not incremented)."
    - "Setting DROM_MIN_PRODUCTION_YEAR=2018 against a generation with year_to=2018 causes that generation to be KEPT (inclusive boundary)."
    - "A generation with year_to=null (still in production) is always kept regardless of the DROM_MIN_PRODUCTION_YEAR cutoff."
    - "The cursor-drift error message in the model loop names DROM_BRAND_WHITELIST AND DROM_MODEL_WHITELIST so an operator can diagnose which filter dropped the cursored model."
    - "An invalid (non-integer) DROM_MIN_PRODUCTION_YEAR logs a warning and is treated as unset (the run does NOT throw)."
    - "On startup, after parsing all three filters, the orchestrator emits a single `[drom] filters: brands=[...], models=[...], minYearTo=...` log line with `all` / `none` placeholders for empty values."
    - "All three filters compose with AND semantics — DROM_BRAND_WHITELIST=bmw + DROM_MODEL_WHITELIST=x5 + DROM_MIN_PRODUCTION_YEAR=2018 against a fixture with bmw/x5/year_to=2017 still drops the generation."
    - "`pnpm test` passes (current 161 + 3 new = 164 expected); `pnpm typecheck:server` passes."
    - "data/scraped/README.md documents all three drom filter env vars with at least one example invocation each."

  artifacts:
    - path: "server/scrapers/drom/index.ts"
      provides: "DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR parsing, filter application in model + generation loops, startup log line, updated cursor-drift throw message"
      contains: "DROM_MODEL_WHITELIST"
    - path: "server/scrapers/drom/index.ts"
      provides: "Year cutoff filter applied AFTER parseGenerationPage returns"
      contains: "DROM_MIN_PRODUCTION_YEAR"
    - path: "server/tests/drom-integration.test.ts"
      provides: "Three new integration tests covering model whitelist, year cutoff inclusive boundary + drop case, and year_to=null retention"
      contains: "DROM_MODEL_WHITELIST"
    - path: "data/scraped/README.md"
      provides: "Operator documentation for DROM_BRAND_WHITELIST + DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR with example invocations"
      contains: "DROM_MODEL_WHITELIST"

  key_links:
    - from: "server/scrapers/drom/index.ts (model loop)"
      to: "DROM_MODEL_WHITELIST env var"
      via: "filter applied to parseModelList output BEFORE the alphabetic sort + cursor index lookup"
      pattern: "DROM_MODEL_WHITELIST"
    - from: "server/scrapers/drom/index.ts (generation loop)"
      to: "DROM_MIN_PRODUCTION_YEAR env var"
      via: "year_to comparison after parseGenerationPage returns; null kept, >= cutoff kept, < cutoff dropped (no seen.set, no models_added++, no image fetch, no per-comp loop)"
      pattern: "DROM_MIN_PRODUCTION_YEAR"
---

<objective>
Add two new env-var filters to the drom orchestrator:

1. `DROM_MODEL_WHITELIST` — comma-separated list of model slugs, applied in the model loop AFTER `parseModelList` and BEFORE the alphabetic sort + cursor index logic. Mirrors the existing `DROM_BRAND_WHITELIST` parsing semantics exactly (lowercase, trim, drop empties, unset/empty = no filter).

2. `DROM_MIN_PRODUCTION_YEAR` — integer cutoff applied in the generation loop AFTER `parseGenerationPage` returns. Drop iff `year_to !== null && year_to < cutoff`. Keep iff `year_to === null` (still in production) OR `year_to >= cutoff` (inclusive boundary). When dropped, the generation is skipped entirely — no record persisted, no hero image fetch, no per-complectation deep-dive, no `seen.set`, `models_added` not incremented, one log line emitted.

Both filters compose with the existing `DROM_BRAND_WHITELIST` (AND semantics, all three independent). A startup log line summarizes the active filter state so operators can sanity-check before a multi-hour run.

Purpose: enable scoped re-runs (e.g. just BMW X5 from 2018 onwards) without modifying code, mirroring the existing brand-whitelist operator UX. Reduces the cost of targeted fixture refreshes and pilot iteration.

Output: `server/scrapers/drom/index.ts` extended with parsing + two filter call sites + startup log; 3 new integration tests in `server/tests/drom-integration.test.ts`; `data/scraped/README.md` updated with a "Filtering" subsection covering all three env vars.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@server/scrapers/drom/index.ts
@server/scrapers/drom/parse-generation-page.ts
@server/scrapers/shared/types.ts
@server/tests/drom-integration.test.ts
@data/scraped/README.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. No exploration needed. -->

From server/scrapers/shared/types.ts (year_to is nullable int — the field the year cutoff consults):
```typescript
export const ModelRecord = z.object({
  // ...
  year_from: z.number().int().nullable(),
  year_to: z.number().int().nullable(),   // null === "in production" (н.в.)
  // ...
});
export type ModelRecord = z.infer<typeof ModelRecord>;
```

From server/scrapers/drom/parse-model-list.ts:
```typescript
export function parseModelList(html: string, brandUrl: string): ModelRef[];
// where ModelRef = { model_slug, ru_name, latin_name, url }
```

From server/scrapers/drom/parse-generation-page.ts:
```typescript
export function parseGenerationPage(html: string, ctx: GenerationPageContext): ModelRecord;
// Returns a zod-validated ModelRecord; the orchestrator catches throws into report.errors[].
```

From server/scrapers/drom/index.ts (existing pattern at lines 266-303 — what we mirror):
```typescript
// Optional brand whitelist via env var (smoke-run gate per plan 09).
// Comma-separated brand_slug list, lowercased. Unset/empty = full catalog.
const whitelist = (process.env.DROM_BRAND_WHITELIST ?? '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);
const filteredBrands =
  whitelist.length > 0
    ? allBrands.filter((b) => whitelist.includes(b.brand_slug))
    : allBrands;
const brands = [...filteredBrands].sort((a, b) =>
  a.brand_slug.localeCompare(b.brand_slug),
);
// ... cursor index lookup uses `brands` (the filtered+sorted list).
```

From server/scrapers/drom/index.ts (existing throw text at line 297-300 — to be extended):
```typescript
throw new Error(
  `Cursor.lastBrandSlug='${c.lastBrandSlug}' not present in current brand list ` +
    `(removed from drom or filtered by DROM_BRAND_WHITELIST). ` +
    `Refusing silent restart; delete .cursor.json explicitly to start over.`,
);
```

From server/scrapers/drom/index.ts (existing model-loop cursor-drift throw, lines ~339-345 — to be updated to mention both filters):
```typescript
if (idx === -1) {
  throw new Error(
    `Cursor.lastModelSlug='${c.lastModelSlug}' not present in current model list ` +
      `for brand '${brand.brand_slug}'. Refusing silent restart of brand; ` +
      `delete .cursor.json explicitly to start over.`,
  );
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR filters with 3 integration tests</name>

  <files>
    server/scrapers/drom/index.ts
    server/tests/drom-integration.test.ts
    data/scraped/README.md
  </files>

  <read_first>
    server/scrapers/drom/index.ts (lines 260-310 for the brand-whitelist pattern at lines 266-275 + cursor throw at ~297; lines 305-360 for the model loop where the model whitelist + updated throw land; lines 360-490 for the generation loop where the year cutoff lands BEFORE the `seen.set` / `models_added++` / hero image / per-comp blocks)
    server/scrapers/drom/parse-generation-page.ts (lines 220-280 — confirm `year_to` is on the returned record)
    server/scrapers/shared/types.ts (lines 70-95 — confirm `year_to: z.number().int().nullable()`)
    server/tests/drom-integration.test.ts (lines 1-70 setup pattern; lines 252-381 — the prev/current incremental snapshot test which is the closest sibling pattern: cwd spy, fixture HTML, parser stubs, http.js stub, vi.resetModules, dynamic import of drom.run)
    data/scraped/README.md (lines 60-100 — find the natural insertion point for a "Filtering" subsection, e.g. after the "Polite rate limit (D-14)" block and before "Crash recovery (D-15)" or as a new top-level subsection under "Running drom")
  </read_first>

  <behavior>
    Test 1 (DROM_MODEL_WHITELIST=x5 — multi-model brand → only x5 processed):
      - Stub parseModelList to return TWO models: { model_slug: 'x5', ... } and { model_slug: '3-series', ... }
      - Stub parseGenerationList to return one generation per model (so we can detect via fetchHtml call counts)
      - Wrap fetchHtml in a vi.fn so we can assert it was NEVER called for `/catalog/bmw/3-series/g_*` URLs
      - Set process.env.DROM_MODEL_WHITELIST = 'x5'; process.env.DROM_BRAND_WHITELIST = 'bmw'
      - Run drom.run({ resume: false })
      - Assert result.status === 'ok'
      - Assert NO fetchHtml call has a URL containing '/catalog/bmw/3-series/' (the model-list page itself for 3-series may also be skipped since the whitelist filters parseModelList output BEFORE the model loop iterates)
      - Assert current/models.json has exactly 1 record with model_slug === 'x5'
      - Cleanup: delete both env vars + vi.resetModules

    Test 2 (DROM_MIN_PRODUCTION_YEAR=2018 inclusive boundary — year_to=2017 dropped, year_to=2018 kept):
      - Stub parseGenerationList to return TWO generations for the same brand/model: one targeting a fixture stub returning year_to=2017, the other year_to=2018.
        - Practical approach: stub parseGenerationPage (NOT parseGenerationList) via vi.doMock to return two crafted ModelRecord objects keyed by `ctx.generation` — generation 'g_2017_old' → year_to: 2017; generation 'g_2018_new' → year_to: 2018. This avoids needing two new HTML fixtures.
        - parseGenerationList stub returns `[{ generation_id: 'g_2017_old', ..., url: '.../g_2017_old/' }, { generation_id: 'g_2018_new', ..., url: '.../g_2018_new/' }]`.
      - Set process.env.DROM_MIN_PRODUCTION_YEAR = '2018'; process.env.DROM_BRAND_WHITELIST = 'bmw'
      - Run drom.run({ resume: false })
      - Assert result.status === 'ok'
      - Assert current/models.json contains the g_2018_new record (year_to: 2018, kept on inclusive boundary)
      - Assert current/models.json does NOT contain the g_2017_old record (year_to: 2017, dropped)
      - Assert report.models_added === 1 (only the kept generation counts)
      - Cleanup

    Test 3 (year_to=null retention — cutoff set, generation in production kept):
      - Stub parseGenerationPage to return one record with year_to: null (still in production / "н.в.")
      - Set process.env.DROM_MIN_PRODUCTION_YEAR = '2030' (deliberately high to prove null bypasses the cutoff)
      - Run drom.run({ resume: false })
      - Assert result.status === 'ok'
      - Assert current/models.json contains the record (year_to: null kept regardless of cutoff)
      - Assert report.models_added === 1
      - Cleanup
  </behavior>

  <action>
    ### Step A — Add DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR parsing + startup log to `server/scrapers/drom/index.ts`

    Locate the existing `DROM_BRAND_WHITELIST` block (currently lines ~266-275, beginning with the comment `// Optional brand whitelist via env var`). Immediately AFTER the `whitelist`/`filteredBrands`/`brands` block, before the resume cursor lookup, insert the model whitelist + year cutoff parsing + the startup log line. The brand parsing stays exactly as is (do NOT rename the existing `whitelist` variable — the cursor-drift throw at line ~297 already references `DROM_BRAND_WHITELIST` by name in its message; we extend that message in Step B).

    Insert this block after the existing `brands` const (after the alphabetic sort `[...filteredBrands].sort(...)`):

    ```typescript
    // Optional model whitelist via env var (mirrors DROM_BRAND_WHITELIST).
    // Comma-separated model_slug list, lowercased. Unset/empty = all models.
    // Applied in the model loop AFTER parseModelList runs and BEFORE the
    // alphabetic sort + cursor index lookup, so the cursor compares against
    // the post-filter list (same shape as the brand filter above).
    const modelWhitelist = (process.env.DROM_MODEL_WHITELIST ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    // Optional minimum-production-year cutoff via env var.
    // Integer; unset/empty/non-integer = no filter. Operator typo MUST NOT
    // kill the run — log a warning and treat as unset.
    // Applied in the generation loop AFTER parseGenerationPage returns:
    //   keep iff year_to === null  (still in production, "н.в.")
    //        OR year_to >= cutoff  (inclusive boundary)
    //   drop iff year_to !== null && year_to < cutoff
    const rawMinYear = process.env.DROM_MIN_PRODUCTION_YEAR ?? '';
    let minProductionYearTo: number | null = null;
    if (rawMinYear.trim().length > 0) {
      const parsed = Number(rawMinYear.trim());
      if (Number.isInteger(parsed)) {
        minProductionYearTo = parsed;
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[drom] DROM_MIN_PRODUCTION_YEAR='${rawMinYear}' is not a valid integer; ignoring (no year filter applied)`,
        );
      }
    }

    // Single startup log summarising every active filter so the operator can
    // sanity-check before a multi-hour run.
    {
      const brandsLabel = whitelist.length > 0 ? `[${whitelist.join(',')}]` : 'all';
      const modelsLabel = modelWhitelist.length > 0 ? `[${modelWhitelist.join(',')}]` : 'all';
      const yearLabel = minProductionYearTo !== null ? String(minProductionYearTo) : 'none';
      // eslint-disable-next-line no-console
      console.log(
        `[drom] filters: brands=${brandsLabel}, models=${modelsLabel}, minYearTo=${yearLabel}`,
      );
    }
    ```

    ### Step B — Apply DROM_MODEL_WHITELIST in the model loop + extend cursor-drift throw

    In the per-brand body (currently around lines 305-340, beginning with `for (let bi = startFromBrandIndex; bi < brands.length; bi++) {`), find the block that calls `parseModelList(modelListHtml, brand.url)` and assigns to `parsedModels`, then sorts into `models`. Replace with:

    ```typescript
    const parsedModels = parseModelList(modelListHtml, brand.url);
    // Optional DROM_MODEL_WHITELIST filter, applied BEFORE the alphabetic sort
    // + cursor lookup so the cursor compares against the post-filter list
    // (same shape as DROM_BRAND_WHITELIST above).
    const modelFiltered =
      modelWhitelist.length > 0
        ? parsedModels.filter((m) => modelWhitelist.includes(m.model_slug))
        : parsedModels;
    // Sort alphabetically by model_slug so the cursor's lexicographic
    // comparison below is correct regardless of drom DOM order
    // (CR-02 / CR-03 fix per 01-REVIEW.md).
    const models = [...modelFiltered].sort((a, b) =>
      a.model_slug.localeCompare(b.model_slug),
    );
    ```

    Then in the cursor-drift throw inside the `if (cursor && brand.brand_slug === cursor.lastBrandSlug)` block (currently lines ~339-345), update the message to reference BOTH filters:

    ```typescript
    if (idx === -1) {
      throw new Error(
        `Cursor.lastModelSlug='${c.lastModelSlug}' not present in current model list ` +
          `for brand '${brand.brand_slug}' ` +
          `(removed from drom or filtered by DROM_BRAND_WHITELIST/DROM_MODEL_WHITELIST). ` +
          `Refusing silent restart of brand; ` +
          `delete .cursor.json explicitly to start over.`,
      );
    }
    ```

    ### Step C — Apply DROM_MIN_PRODUCTION_YEAR in the generation loop

    In the `for (const gen of gens)` loop body (currently lines 361-525), inside the inner `try` block IMMEDIATELY AFTER the `const record = parseGenerationPage(...)` call and BEFORE the `const key = ...; if (inheritedKeys.has(key)) ...; seen.set(...)` block, insert:

    ```typescript
    // DROM_MIN_PRODUCTION_YEAR: drop generations whose year_to is non-null
    // AND strictly less than the cutoff. year_to === null (still in
    // production, "н.в.") is always kept. Inclusive boundary at the cutoff.
    if (
      minProductionYearTo !== null &&
      record.year_to !== null &&
      record.year_to < minProductionYearTo
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `[drom] skipping generation ${brand.brand_slug}/${model.model_slug}/${gen.generation_id} (year_to=${record.year_to} < ${minProductionYearTo})`,
      );
      continue; // skip seen.set, models_added++, BMW per-comp loop, hero image fetch
    }
    ```

    The `continue` MUST land inside the `for (const gen of gens)` loop. Verify by reading the surrounding scope: the `try { const record = parseGenerationPage(...) ... } catch (parseErr) { ... }` is inside the gen loop, and `continue` from inside the try jumps to the next gen iteration — exactly what we want. (We do NOT need to push to `report.errors`; this is a deliberate drop, not a parse error.)

    ### Step D — Add 3 integration tests to `server/tests/drom-integration.test.ts`

    Add a new `describe(...)` block at the END of the file (after the existing `describe('Phase 01.1: BMW pilot per-comp integration ...')` block on line 1034). Use the existing test scaffolding pattern (cwd spy from beforeAll, FX cache pre-seeded, vi.doMock + vi.resetModules + dynamic import — same shape as the test at line 252).

    ```typescript
    describe('drom orchestrator filters: DROM_MODEL_WHITELIST + DROM_MIN_PRODUCTION_YEAR (260501-koe)', () => {
      it('DROM_MODEL_WHITELIST=x5 against multi-model brand → only x5 model is processed', async () => {
        const heroJpeg = await readFile(FIXTURE_HERO);
        const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
        const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
        const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');
        const genPageHtml = await readFile(FIXTURE_GEN_PAGE, 'utf-8');

        process.env.DROM_BRAND_WHITELIST = 'bmw';
        process.env.DROM_MODEL_WHITELIST = 'x5';

        // Reset prev current/ so this test is isolated from earlier tests.
        const dromRoot = resolve(workDir, 'data/scraped/drom');
        const { unlink } = await import('node:fs/promises');
        if (existsSync(resolve(dromRoot, 'current'))) {
          await unlink(resolve(dromRoot, 'current'));
        }

        vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
          parseBrandIndex: () => [
            { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
          parseModelList: () => [
            { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
            { model_slug: '3-series', ru_name: '3 серии', latin_name: '3-Series', url: 'https://www.drom.ru/catalog/bmw/3-series/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
          parseGenerationList: (_html: string, modelUrl: string) => [
            {
              generation_id: 'g_201808_8395',
              generation_label: 'G05',
              url: `${modelUrl}g_201808_8395/`,
              hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_test.jpg',
            },
          ],
        }));

        const fetchedUrls: string[] = [];
        vi.doMock('../scrapers/shared/http.js', () => ({
          fetchHtml: async (url: string) => {
            fetchedUrls.push(url);
            if (/g_\d{4,6}_\d+\/?$/.test(url)) return genPageHtml;
            const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
            if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
            if (segs.length === 1) return brandIndexHtml;
            if (segs.length === 2) return modelListHtml;
            if (segs.length === 3) return genListHtml;
            throw new Error(`Unexpected URL: ${url}`);
          },
          fetchBuffer: async (_url: string) => heroJpeg,
          politeDelay: async () => {},
          dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
        }));

        vi.resetModules();
        const { drom } = await import('../scrapers/drom/index.js');
        const result = await drom.run({ resume: false });

        expect(result.status).toBe('ok');
        // No URL under /catalog/bmw/3-series/ should have been fetched —
        // the model whitelist filtered it out before the model loop iterated.
        expect(fetchedUrls.some((u) => u.includes('/catalog/bmw/3-series/'))).toBe(false);
        // The x5 model-list page IS reached (it survived the whitelist).
        expect(fetchedUrls.some((u) => u.includes('/catalog/bmw/x5/'))).toBe(true);

        const models = JSON.parse(
          await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
        ) as Array<{ model_slug: string }>;
        expect(models.length).toBe(1);
        expect(models[0].model_slug).toBe('x5');

        delete process.env.DROM_BRAND_WHITELIST;
        delete process.env.DROM_MODEL_WHITELIST;
      });

      it('DROM_MIN_PRODUCTION_YEAR=2018: year_to=2017 dropped, year_to=2018 kept (inclusive boundary)', async () => {
        const heroJpeg = await readFile(FIXTURE_HERO);
        const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
        const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
        const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');

        process.env.DROM_BRAND_WHITELIST = 'bmw';
        process.env.DROM_MIN_PRODUCTION_YEAR = '2018';

        const dromRoot = resolve(workDir, 'data/scraped/drom');
        const { unlink } = await import('node:fs/promises');
        if (existsSync(resolve(dromRoot, 'current'))) {
          await unlink(resolve(dromRoot, 'current'));
        }

        vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
          parseBrandIndex: () => [
            { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
          parseModelList: () => [
            { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
          parseGenerationList: (_html: string, modelUrl: string) => [
            {
              generation_id: 'g_2017_old',
              generation_label: 'OLD',
              url: `${modelUrl}g_2017_old/`,
              hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_old.jpg',
            },
            {
              generation_id: 'g_2018_new',
              generation_label: 'NEW',
              url: `${modelUrl}g_2018_new/`,
              hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_new.jpg',
            },
          ],
        }));
        // Stub parseGenerationPage so we can pin year_to per generation_id.
        vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
          const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
            '../scrapers/drom/parse-generation-page.js',
          );
          return {
            ...actual,
            parseGenerationPage: (_html: string, ctx: import('../scrapers/drom/parse-generation-page.js').GenerationPageContext) => {
              const yearTo = ctx.generation === 'g_2017_old' ? 2017 : 2018;
              return {
                brand: ctx.brand,
                brand_slug: ctx.brand_slug,
                model: ctx.model,
                model_slug: ctx.model_slug,
                generation: ctx.generation,
                year_from: yearTo - 5,
                year_to: yearTo,
                body_types: ['джип'],
                engine_options: [{ cc: 3000, hp: 249, fuel: 'diesel' as const }],
                drive_options: ['AWD'],
                description_ru: `stub description for ${ctx.generation}`,
                price_min_rub: 5000000,
                price_max_rub: 6000000,
                image_paths: ctx.heroImageUrl ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
                source: 'drom-catalog' as const,
                source_url: ctx.sourceUrl,
                scraped_at: new Date().toISOString(),
                complectations: [],
              };
            },
          };
        });
        vi.doMock('../scrapers/shared/http.js', () => ({
          fetchHtml: async (url: string) => {
            const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
            if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
            if (segs.length === 1) return brandIndexHtml;
            if (segs.length === 2) return modelListHtml;
            if (segs.length === 3) return genListHtml;
            return '<html></html>'; // gen pages — content irrelevant, parser is stubbed
          },
          fetchBuffer: async (_url: string) => heroJpeg,
          politeDelay: async () => {},
          dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
        }));

        vi.resetModules();
        const { drom } = await import('../scrapers/drom/index.js');
        const result = await drom.run({ resume: false });

        expect(result.status).toBe('ok');

        const models = JSON.parse(
          await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
        ) as Array<{ generation: string; year_to: number | null }>;
        const generations = models.map((m) => m.generation);
        expect(generations).toContain('g_2018_new');     // inclusive boundary kept
        expect(generations).not.toContain('g_2017_old'); // strictly below cutoff dropped
        expect(models.length).toBe(1);

        const reportJson = JSON.parse(
          await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
        );
        expect(reportJson.models_added).toBe(1); // only the kept generation counts

        delete process.env.DROM_BRAND_WHITELIST;
        delete process.env.DROM_MIN_PRODUCTION_YEAR;
      });

      it('DROM_MIN_PRODUCTION_YEAR set: year_to=null (still in production) is always kept', async () => {
        const heroJpeg = await readFile(FIXTURE_HERO);
        const brandIndexHtml = await readFile(FIXTURE_BRAND_INDEX, 'utf-8');
        const modelListHtml = await readFile(FIXTURE_MODEL_LIST, 'utf-8');
        const genListHtml = await readFile(FIXTURE_GEN_LIST, 'utf-8');

        process.env.DROM_BRAND_WHITELIST = 'bmw';
        process.env.DROM_MIN_PRODUCTION_YEAR = '2030'; // deliberately high

        const dromRoot = resolve(workDir, 'data/scraped/drom');
        const { unlink } = await import('node:fs/promises');
        if (existsSync(resolve(dromRoot, 'current'))) {
          await unlink(resolve(dromRoot, 'current'));
        }

        vi.doMock('../scrapers/drom/parse-brand-index.js', () => ({
          parseBrandIndex: () => [
            { brand_slug: 'bmw', latin_name: 'BMW', url: 'https://www.drom.ru/catalog/bmw/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-model-list.js', () => ({
          parseModelList: () => [
            { model_slug: 'x5', ru_name: 'X5', latin_name: 'X5', url: 'https://www.drom.ru/catalog/bmw/x5/' },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-generation-list.js', () => ({
          parseGenerationList: (_html: string, modelUrl: string) => [
            {
              generation_id: 'g_2020_inprod',
              generation_label: 'IN-PROD',
              url: `${modelUrl}g_2020_inprod/`,
              hero_image_url: 'https://s.auto.drom.ru/i24222/c/photos/generations/500x_inprod.jpg',
            },
          ],
        }));
        vi.doMock('../scrapers/drom/parse-generation-page.js', async () => {
          const actual = await vi.importActual<typeof import('../scrapers/drom/parse-generation-page.js')>(
            '../scrapers/drom/parse-generation-page.js',
          );
          return {
            ...actual,
            parseGenerationPage: (_html: string, ctx: import('../scrapers/drom/parse-generation-page.js').GenerationPageContext) => ({
              brand: ctx.brand,
              brand_slug: ctx.brand_slug,
              model: ctx.model,
              model_slug: ctx.model_slug,
              generation: ctx.generation,
              year_from: 2020,
              year_to: null, // still in production ("н.в.")
              body_types: ['джип'],
              engine_options: [{ cc: 3000, hp: 249, fuel: 'diesel' as const }],
              drive_options: ['AWD'],
              description_ru: 'stub description in-production',
              price_min_rub: 5000000,
              price_max_rub: 6000000,
              image_paths: ctx.heroImageUrl ? [`images/${ctx.brand_slug}-${ctx.model_slug}-${ctx.generation}-hero.webp`] : [],
              source: 'drom-catalog' as const,
              source_url: ctx.sourceUrl,
              scraped_at: new Date().toISOString(),
              complectations: [],
            }),
          };
        });
        vi.doMock('../scrapers/shared/http.js', () => ({
          fetchHtml: async (url: string) => {
            const segs = url.replace(/^https?:\/\/www\.drom\.ru/, '').split('/').filter(Boolean);
            if (segs[0] !== 'catalog') throw new Error(`Unexpected URL: ${url}`);
            if (segs.length === 1) return brandIndexHtml;
            if (segs.length === 2) return modelListHtml;
            if (segs.length === 3) return genListHtml;
            return '<html></html>';
          },
          fetchBuffer: async (_url: string) => heroJpeg,
          politeDelay: async () => {},
          dromClient: { get: () => { throw new Error('dromClient should not be invoked'); } },
        }));

        vi.resetModules();
        const { drom } = await import('../scrapers/drom/index.js');
        const result = await drom.run({ resume: false });

        expect(result.status).toBe('ok');

        const models = JSON.parse(
          await readFile(resolve(dromRoot, 'current/models.json'), 'utf-8'),
        ) as Array<{ generation: string; year_to: number | null }>;
        expect(models.length).toBe(1);
        expect(models[0].generation).toBe('g_2020_inprod');
        expect(models[0].year_to).toBeNull();

        const reportJson = JSON.parse(
          await readFile(resolve(dromRoot, 'current/report.json'), 'utf-8'),
        );
        expect(reportJson.models_added).toBe(1);

        delete process.env.DROM_BRAND_WHITELIST;
        delete process.env.DROM_MIN_PRODUCTION_YEAR;
      });
    });
    ```

    Important env var hygiene: every existing test in this file that does NOT set these new env vars relies on them being unset. Since each new test deletes both `DROM_BRAND_WHITELIST` and the new var at the end, no cross-test pollution should occur — but if a test failure leaves an env var set, the next test will inherit it. The cleanup `delete` calls at the end of each test must run unconditionally. (Existing tests in this file use the same pattern; we mirror it exactly.)

    ### Step E — Update `data/scraped/README.md` with the operator docs

    Insert a new subsection titled "Filtering (env vars)" between the existing "Polite rate limit (D-14)" subsection and the "Crash recovery (D-15) — resume contract" subsection (around line 86 in the current file). Content:

    ```markdown
    ### Filtering (env vars)

    Three independent env vars compose with AND semantics — set any combination to scope a run without modifying code. Unset/empty = no filter.

    | Env var | Type | Effect |
    |---------|------|--------|
    | `DROM_BRAND_WHITELIST` | comma-separated `brand_slug` list (lowercased) | Only listed brands are visited. Brands not on the list are skipped before the brand loop iterates. |
    | `DROM_MODEL_WHITELIST` | comma-separated `model_slug` list (lowercased) | Within each visited brand, only listed models are visited. Applied BEFORE the alphabetic sort + cursor lookup. |
    | `DROM_MIN_PRODUCTION_YEAR` | integer (e.g. `2015`) | Drop generations whose `year_to` is non-null AND strictly less than the cutoff. `year_to === null` (still in production, "н.в.") is ALWAYS kept. Inclusive boundary at the cutoff. Invalid (non-integer) values log a warning and are treated as unset — the run does NOT abort on operator typo. |

    Each run logs a single startup line summarizing the active filters:

    ```text
    [drom] filters: brands=[bmw,lada], models=[x5], minYearTo=2015
    ```

    Empty arrays render as `all`; an unset year cutoff renders as `none`.

    Examples:

    ```bash
    # Just BMW
    DROM_BRAND_WHITELIST=bmw pnpm scrape:drom

    # Just BMW X5 (composes with brand whitelist)
    DROM_BRAND_WHITELIST=bmw DROM_MODEL_WHITELIST=x5 pnpm scrape:drom

    # All brands but only generations still in production OR ending in 2015+
    DROM_MIN_PRODUCTION_YEAR=2015 pnpm scrape:drom

    # All three composed: BMW X5 generations from 2018 onwards
    DROM_BRAND_WHITELIST=bmw DROM_MODEL_WHITELIST=x5 DROM_MIN_PRODUCTION_YEAR=2018 pnpm scrape:drom
    ```

    Generations dropped by the year cutoff log:

    ```text
    [drom] skipping generation bmw/x5/g_2007_4321 (year_to=2014 < 2018)
    ```

    Cursor-drift behaviour: if `.cursor.json` references a brand or model that the current filter set excludes, the orchestrator throws loudly (`Refusing silent restart`). Delete `.cursor.json` explicitly to start over.
    ```

    Ensure the new subsection's heading level (`###`) matches the surrounding subsection headings under the existing `## Running drom: what happens` parent section. Do NOT renumber any existing D-1x reference markers.
  </action>

  <verify>
    <automated>pnpm test -- server/tests/drom-integration.test.ts && pnpm typecheck:server && grep -c "DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts && grep -c "DROM_MIN_PRODUCTION_YEAR" server/scrapers/drom/index.ts && grep -v '^#' data/scraped/README.md | grep -c "DROM_MODEL_WHITELIST" && grep -v '^#' data/scraped/README.md | grep -c "DROM_MIN_PRODUCTION_YEAR"</automated>
  </verify>

  <acceptance_criteria>
    - `pnpm test` exits 0 with all integration tests passing (current 161 + 3 new = 164 expected).
    - `pnpm typecheck:server` exits 0.
    - `grep -c "DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts` returns ≥ 3 (parsing block + filter call site + cursor-drift throw message).
    - `grep -c "DROM_MIN_PRODUCTION_YEAR" server/scrapers/drom/index.ts` returns ≥ 2 (parsing block + filter call site at minimum).
    - The cursor-drift throw in the model loop contains the literal substring `DROM_BRAND_WHITELIST/DROM_MODEL_WHITELIST` (verifiable via `grep -F "DROM_BRAND_WHITELIST/DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts`).
    - `data/scraped/README.md` (excluding markdown header lines) contains at least one occurrence of each of `DROM_BRAND_WHITELIST`, `DROM_MODEL_WHITELIST`, `DROM_MIN_PRODUCTION_YEAR`, and at least one runnable example invocation per filter.
    - The dropped-generation log line uses the exact format `[drom] skipping generation {brand}/{model}/{generation_id} (year_to=${year_to} < ${cutoff})` (verifiable inside the new test by spying on `console.log` if the executor wants extra confidence — not required for acceptance).
    - No new fields added to `ModelRecord` zod schema, `Cursor` schema, or any other artifact outside the three files listed in `<files>`.
    - `BMW_PILOT_BRANDS` set is unchanged.
    - `DROM_BRAND_WHITELIST` parsing block at lines ~266-275 is unchanged in behaviour (only the cursor-drift throw text downstream gains the `/DROM_MODEL_WHITELIST` suffix).
  </acceptance_criteria>

  <done>
    Three env-var filters (DROM_BRAND_WHITELIST untouched + DROM_MODEL_WHITELIST new + DROM_MIN_PRODUCTION_YEAR new) compose cleanly in `server/scrapers/drom/index.ts`; the orchestrator emits a startup log summarising all three; an invalid year cutoff is logged and ignored (does not throw); the cursor-drift error message names both whitelist filters; three new integration tests cover model whitelist isolation, year cutoff inclusive boundary (drop year_to=2017, keep year_to=2018), and year_to=null retention; `data/scraped/README.md` documents all three filters with example invocations; `pnpm test` and `pnpm typecheck:server` both pass green.
  </done>
</task>

</tasks>

<verification>
- `pnpm test` exits 0; the existing 161 tests remain green and the 3 new tests pass.
- `pnpm typecheck:server` exits 0.
- `grep -c "DROM_MODEL_WHITELIST" server/scrapers/drom/index.ts` ≥ 1 (will be ≥ 3 after Step A + Step B).
- `grep -c "DROM_MIN_PRODUCTION_YEAR" server/scrapers/drom/index.ts` ≥ 1 (will be ≥ 2 after Step A + Step C).
- README.md documents both new env vars with at least one example each (Step E adds 4 example invocations covering all three filters).
- `git diff --stat` touches exactly 3 files: `server/scrapers/drom/index.ts`, `server/tests/drom-integration.test.ts`, `data/scraped/README.md`.
</verification>

<success_criteria>
- Operator can run `DROM_MODEL_WHITELIST=x5 pnpm scrape:drom` and observe only x5 being processed within each visited brand.
- Operator can run `DROM_MIN_PRODUCTION_YEAR=2018 pnpm scrape:drom` and observe pre-2018 generations being skipped with a `[drom] skipping generation ...` log line per drop.
- Operator can run `DROM_MIN_PRODUCTION_YEAR=abc pnpm scrape:drom` and observe a single warning log line + a normal run with no year filter (no throw).
- Every run logs a single `[drom] filters: brands=..., models=..., minYearTo=...` line at startup.
- A cursor pointing at a model that the new model whitelist excludes produces a throw whose message names both `DROM_BRAND_WHITELIST` and `DROM_MODEL_WHITELIST`.
- Test count is 161 + 3 = 164 (exact); typecheck remains clean.
</success_criteria>

<output>
This is a quick task — DO NOT create a SUMMARY.md, DO NOT update STATE.md, DO NOT update ROADMAP.md, DO NOT update any phase artifacts. The plan lives at `.planning/quick/260501-koe-add-drom-model-whitelist-and-drom-min-pr/260501-koe-PLAN.md` and the executor's only durable output is the three files in `<files>` plus a single git commit.
</output>
