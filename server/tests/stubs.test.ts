// server/tests/stubs.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encar } from '../scrapers/encar/index.js';
import { beforward } from '../scrapers/beforward/index.js';
import { che168 } from '../scrapers/che168/index.js';
import { autohome } from '../scrapers/autohome/index.js';

const stubs = [
  { name: 'encar', stub: encar, expectedSource: 'encar' },
  { name: 'beforward', stub: beforward, expectedSource: 'beforward' },
  { name: 'che168', stub: che168, expectedSource: 'che168' },
  { name: 'autohome', stub: autohome, expectedSource: 'autohome' },
];

describe('stub IScrapers (SCRAPE-01..04 — deferred to v1.x)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  for (const { name, stub, expectedSource } of stubs) {
    describe(name, () => {
      it('exposes the expected source identifier', () => {
        expect(stub.source).toBe(expectedSource);
      });

      it('resolves to a not_implemented ScrapeResult', async () => {
        const result = await stub.run();
        expect(result).toEqual({
          status: 'not_implemented',
          source: expectedSource,
          deferredTo: 'v1.x',
          todo: expect.any(String),
        });
        // todo must be non-empty so v1.x authors have a hint
        if (result.status === 'not_implemented') {
          expect(result.todo.length).toBeGreaterThan(0);
        }
      });

      it('logs exactly one TODO warning per run() invocation', async () => {
        await stub.run();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        const arg = warnSpy.mock.calls[0]?.[0];
        expect(arg).toEqual(expect.stringContaining(`[${expectedSource}] TODO`));
      });
    });
  }
});
