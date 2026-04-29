// server/scrapers/cli.ts — DISPATCHER
import { drom } from './drom/index.js';
import { encar } from './encar/index.js';
import { beforward } from './beforward/index.js';
import { che168 } from './che168/index.js';
import { autohome } from './autohome/index.js';
import type { IScraper, ScrapeResult } from './shared/types.js';

const SCRAPERS: Record<string, IScraper> = {
  drom,
  encar,
  beforward,
  che168,
  autohome,
};

const EXIT_CODES = { ok: 0, error: 1, not_implemented: 2, blocked: 3 } as const;

const sourceArg = process.argv[2];
if (!sourceArg || !SCRAPERS[sourceArg]) {
  console.error(`Usage: pnpm scrape <${Object.keys(SCRAPERS).join('|')}>`);
  process.exit(1);
}

if (sourceArg === 'drom' && process.argv[3] === '--capture-fixture') {
  const compId = process.argv[4];
  if (!compId || !/^\d+$/.test(compId)) {
    console.error('Usage: pnpm scrape drom --capture-fixture <comp_id>');
    process.exit(1);
  }
  const { fetchHtml } = await import('./shared/http.js');
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const url = `https://www.drom.ru/catalog/bmw/x5/${compId}/`;
  const html = await fetchHtml(url);
  const outDir = resolve('server/tests/fixtures/drom/complectation');
  await mkdir(outDir, { recursive: true });
  const out = resolve(outDir, `${compId}.html`);
  await writeFile(out, html, 'utf-8');
  console.log(`Wrote ${html.length} bytes to ${out}`);
  process.exit(0);
}

let result: ScrapeResult;
try {
  result = await SCRAPERS[sourceArg].run({ resume: true });
} catch (e) {
  result = {
    status: 'error',
    source: sourceArg,
    error: { message: e instanceof Error ? e.message : String(e), cause: e },
  };
}
console.log(JSON.stringify(result, null, 2));
process.exit(EXIT_CODES[result.status]);
