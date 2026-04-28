// server/scrapers/shared/normalize.ts
//
// Drom-format-aware string normalizers. Pure functions, no I/O, no module state.
// Reused by drom orchestrator (plan 07) — and conceptually portable to v1.x scrapers,
// though their normalization needs may differ.
//
// References:
// - D-16 (CONTEXT.md): drom exposes both Cyrillic and Latin in DOM; transliterator
//   below is a defensive fallback for niche brands that only ship Cyrillic.
// - PATTERNS.md §normalize.ts (lines 519-543) — contract + test cases
// - RESEARCH.md lines 633-637 — year regex including 'н.в.' (= 'настоящее время')

// Cyrillic→Latin character map sufficient for drom brand+model slugs.
const CYR_TO_LAT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterate(s: string): string {
  return s
    .split('')
    .map((ch) => CYR_TO_LAT[ch.toLowerCase()] ?? ch)
    .join('');
}

/**
 * slugify(s): produce a lowercase ASCII slug for filesystem-safe paths and DB keys.
 * Strips non-alphanumeric except `-`, collapses whitespace to `-`.
 */
export function slugify(s: string): string {
  return transliterate(s)
    .toLowerCase()
    .trim()
    .replace(/[^\p{ASCII}]/gu, '') // strip leftover non-ASCII (defensive)
    .replace(/[^a-z0-9\-\s]/g, '') // keep alphanumeric, hyphen, whitespace
    .replace(/\s+/g, '-') // whitespace → hyphen
    .replace(/-{2,}/g, '-') // collapse runs of hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * parsePrice('от 5 470 000') → 5470000
 * parsePrice('5 470 000 ₽') → 5470000
 * parsePrice('—' | '' | 'бесплатно') → null
 */
export function parsePrice(s: string | null | undefined): number | null {
  if (!s) return null;
  // Strip everything except digits
  const digits = s.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * parseYear('06.2018 - 03.2022') → {from: 2018, to: 2022}
 * parseYear('06.2018 - н.в.') → {from: 2018, to: null}
 * parseYear('1999') → {from: 1999, to: null}
 * parseYear('') → {from: null, to: null}
 */
export function parseYear(s: string | null | undefined): { from: number | null; to: number | null } {
  if (!s) return { from: null, to: null };
  // Range form: MM.YYYY - MM.YYYY  OR  MM.YYYY - н.в.  (with optional space inside 'н. в.')
  const range = s.match(/(\d{2})\.(\d{4})\s*-\s*(?:(\d{2})\.(\d{4})|н\.\s*в\.?)/i);
  if (range) {
    const from = Number(range[2]);
    const to = range[4] ? Number(range[4]) : null;
    return { from, to };
  }
  // Single 4-digit year fallback
  const single = s.match(/(\d{4})/);
  if (single) {
    return { from: Number(single[1]), to: null };
  }
  return { from: null, to: null };
}
