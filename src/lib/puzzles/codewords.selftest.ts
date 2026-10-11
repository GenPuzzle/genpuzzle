/**
 * Codewords unit selftests.
 * Run via: npx tsx src/lib/puzzles/codewords.selftest.ts
 */
import {
  createLetterNumberMapping,
  generateCodewordPuzzle,
  remapCodewordPuzzle,
  validateCodewordPuzzle,
  type CodewordPuzzle,
} from './codewords';
import {
  getEnglishCodewordDictionary,
  getFrenchCodewordDictionary,
  getGermanCodewordDictionary,
  getSpanishCodewordDictionary,
  getCodewordDictionary,
  normalizeCodewordWord,
} from './codewords-dictionary';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function testMapping(): void {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const a = createLetterNumberMapping(alphabet, 42);
  const b = createLetterNumberMapping(alphabet, 42);
  assert(
    JSON.stringify(a.letterToNumber) === JSON.stringify(b.letterToNumber),
    'seeded mapping must be deterministic'
  );
  const nums = new Set(Object.values(a.letterToNumber));
  assert(nums.size === 26, 'mapping must be one-to-one (numbers)');
  const letters = new Set(Object.keys(a.letterToNumber));
  assert(letters.size === 26, 'mapping must be one-to-one (letters)');
  for (const [letter, n] of Object.entries(a.letterToNumber)) {
    assert(a.numberToLetter[n] === letter, `inverse mismatch for ${letter}`);
  }
}

function testHints(puzzle: CodewordPuzzle): void {
  assert(puzzle.hintLetters.length === 3, 'expected 3 hint letters');
  const distinct = new Set(puzzle.hintLetters);
  assert(distinct.size === puzzle.hintLetters.length, 'hint letters must be distinct');

  const allMode = generateCodewordPuzzle({
    rows: 11,
    cols: 11,
    seed: 7,
    hintCount: 2,
    hintMode: 'all-occurrences',
    timeBudgetMs: 15000,
  });
  for (const h of allMode.hintLetters) {
    let count = 0;
    for (const row of allMode.puzzleGrid) {
      for (const cell of row) {
        if (!cell.blocked && cell.letter === h) count += 1;
      }
    }
    const solCount = allMode.solutionGrid
      .flat()
      .filter((c) => !c.blocked && c.letter === h).length;
    assert(count === solCount && count > 0, `all-occurrences for ${h}`);
  }

  const oneMode = generateCodewordPuzzle({
    rows: 11,
    cols: 11,
    seed: 7,
    hintCount: 2,
    hintMode: 'single-occurrence',
    timeBudgetMs: 15000,
  });
  for (const h of oneMode.hintLetters) {
    let count = 0;
    for (const row of oneMode.puzzleGrid) {
      for (const cell of row) {
        if (!cell.blocked && cell.letter === h && cell.isHint) count += 1;
      }
    }
    assert(count === 1, `single-occurrence for ${h} got ${count}`);
  }
}

function testGrid(puzzle: CodewordPuzzle): void {
  const v = validateCodewordPuzzle(puzzle, getEnglishCodewordDictionary());
  assert(v.ok, v.ok ? '' : v.reason);
}

function testRemap(puzzle: CodewordPuzzle): void {
  const remapped = remapCodewordPuzzle(puzzle, 99);
  assert(
    JSON.stringify(remapped.solutionGrid) === JSON.stringify(puzzle.solutionGrid),
    'remap must keep solution letters'
  );
  assert(
    JSON.stringify(remapped.letterToNumber) !== JSON.stringify(puzzle.letterToNumber),
    'remap should change mapping for different seed'
  );
  const v = validateCodewordPuzzle(remapped, getEnglishCodewordDictionary());
  assert(v.ok, v.ok ? 'remap valid' : `remap invalid: ${v.reason}`);
}

function testSerialize(puzzle: CodewordPuzzle): void {
  const json = JSON.stringify(puzzle);
  const loaded = JSON.parse(json) as CodewordPuzzle;
  assert(loaded.type === 'codewords', 'type preserved');
  assert(
    JSON.stringify(loaded.solutionGrid) === JSON.stringify(puzzle.solutionGrid),
    'solution grid round-trip'
  );
  assert(
    JSON.stringify(loaded.letterToNumber) === JSON.stringify(puzzle.letterToNumber),
    'mapping round-trip'
  );
  const v = validateCodewordPuzzle(loaded, getEnglishCodewordDictionary());
  assert(v.ok, v.ok ? '' : v.reason);
}

function testDictionary(): void {
  const enAlpha = new Set(getEnglishCodewordDictionary().alphabet);
  assert(normalizeCodewordWord("don't", enAlpha) === 'DONT', 'normalize apostrophe');
  // Codewords coding alphabet stays A–Z (26). Accented forms are accepted via base letter.
  assert(normalizeCodewordWord('café', enAlpha, 'en') === 'CAFÉ', 'café kept with accents');
  const frAlpha = new Set(getFrenchCodewordDictionary().alphabet);
  assert(frAlpha.size === 26, 'french coding alphabet size');
  assert(normalizeCodewordWord('café', frAlpha, 'fr') === 'CAFÉ', 'preserve French é in word');
  assert(normalizeCodewordWord('école', frAlpha, 'fr') === 'ÉCOLE', 'preserve French école');
  const deAlpha = new Set(getGermanCodewordDictionary().alphabet);
  assert(normalizeCodewordWord('straße', deAlpha, 'de') === 'STRAßE', 'preserve German ß');
  assert(normalizeCodewordWord('Mädchen', deAlpha, 'de') === 'MÄDCHEN', 'preserve German ä');
  const esAlpha = new Set(getSpanishCodewordDictionary().alphabet);
  assert(normalizeCodewordWord('niño', esAlpha, 'es') === 'NIÑO', 'preserve Spanish ñ');
  assert(normalizeCodewordWord('corazón', esAlpha, 'es') === 'CORAZÓN', 'preserve Spanish ó');
  const dict = getEnglishCodewordDictionary();
  assert(dict.words.length > 500, 'english dictionary size');
  assert(dict.alphabet.length === 26, 'english alphabet');
  const fr = getFrenchCodewordDictionary();
  assert(fr.words.length > 200, 'french dictionary size');
  assert(fr.alphabet.length === 26, 'french coding alphabet stays 26');
  assert(fr.words.includes('ÉCOLE') || fr.words.includes('ÉLÈVE'), 'french keeps école/élève');
  assert(fr.words.some((w) => w.includes('É') || w.includes('È') || w.includes('Ç')), 'french bank has accents');
  assert(getCodewordDictionary('fr').language === 'fr', 'fr lookup');
  const de = getGermanCodewordDictionary();
  assert(de.words.length > 200, 'german dictionary size');
  assert(de.alphabet.length === 26, 'german coding alphabet stays 26');
  assert(de.words.some((w) => w.includes('Ä') || w.includes('Ö') || w.includes('Ü') || w.includes('ß')), 'german bank has umlauts/ß');
  assert(getCodewordDictionary('de').language === 'de', 'de lookup');
  const es = getSpanishCodewordDictionary();
  assert(es.words.length > 200, 'spanish dictionary size');
  assert(es.alphabet.length === 26, 'spanish coding alphabet stays 26');
  assert(es.words.some((w) => w.includes('Ñ') || w.includes('Á') || w.includes('Ó')), 'spanish bank has ñ/accents');
  assert(getCodewordDictionary('es').language === 'es', 'es lookup');
}

function main(): void {
  testDictionary();
  testMapping();
  const puzzle = generateCodewordPuzzle({
    rows: 11,
    cols: 11,
    seed: 42,
    hintCount: 3,
    hintMode: 'all-occurrences',
    difficulty: 'medium',
    timeBudgetMs: 20000,
  });
  testGrid(puzzle);
  testHints(puzzle);
  testRemap(puzzle);
  testSerialize(puzzle);
  console.log('codewords.selftest: OK');
}

main();
