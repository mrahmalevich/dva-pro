// scripts/build-cbr-fixture.mjs
// One-shot generator for the CBR windows-1251 test fixture.
// Encodes a known-valid CBR-shaped XML in utf-8 → windows-1251 bytes via iconv-lite,
// then writes the raw bytes to server/tests/fixtures/cbr/XML_daily.windows-1251.xml.
//
// Run: node scripts/build-cbr-fixture.mjs
import iconv from 'iconv-lite';
import { writeFile, mkdir } from 'node:fs/promises';

await mkdir('server/tests/fixtures/cbr', { recursive: true });

const xmlUtf8 = `<?xml version="1.0" encoding="windows-1251"?>
<ValCurs Date="28.04.2026" name="Foreign Currency Market">
  <Valute ID="R01235">
    <NumCode>840</NumCode>
    <CharCode>USD</CharCode>
    <Nominal>1</Nominal>
    <Name>Доллар США</Name>
    <Value>91,3145</Value>
    <VunitRate>91,3145</VunitRate>
  </Valute>
  <Valute ID="R01239">
    <NumCode>978</NumCode>
    <CharCode>EUR</CharCode>
    <Nominal>1</Nominal>
    <Name>Евро</Name>
    <Value>97,5210</Value>
    <VunitRate>97,5210</VunitRate>
  </Valute>
  <Valute ID="R01820">
    <NumCode>392</NumCode>
    <CharCode>JPY</CharCode>
    <Nominal>100</Nominal>
    <Name>Японских иен</Name>
    <Value>59,1234</Value>
    <VunitRate>0,591234</VunitRate>
  </Valute>
  <Valute ID="R01815">
    <NumCode>410</NumCode>
    <CharCode>KRW</CharCode>
    <Nominal>1000</Nominal>
    <Name>Вон Республики Корея</Name>
    <Value>65,9012</Value>
    <VunitRate>0,0659012</VunitRate>
  </Valute>
  <Valute ID="R01375">
    <NumCode>156</NumCode>
    <CharCode>CNY</CharCode>
    <Nominal>1</Nominal>
    <Name>Китайский юань</Name>
    <Value>12,5670</Value>
    <VunitRate>12,5670</VunitRate>
  </Valute>
  <Valute ID="R01230">
    <NumCode>784</NumCode>
    <CharCode>AED</CharCode>
    <Nominal>1</Nominal>
    <Name>Дирхам ОАЭ</Name>
    <Value>24,8624</Value>
    <VunitRate>24,8624</VunitRate>
  </Valute>
</ValCurs>
`;

const win1251Bytes = iconv.encode(xmlUtf8, 'win1251');
await writeFile('server/tests/fixtures/cbr/XML_daily.windows-1251.xml', win1251Bytes);
console.log(`Wrote ${win1251Bytes.length} bytes (windows-1251 encoded)`);

// Round-trip verification
const roundTrip = iconv.decode(win1251Bytes, 'win1251');
if (!roundTrip.includes('Доллар США')) {
  console.error('FATAL: round-trip failed — Cyrillic mismatch');
  process.exit(1);
}
console.log('Round-trip OK: «Доллар США» recovered from windows-1251 bytes.');
