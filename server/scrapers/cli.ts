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
