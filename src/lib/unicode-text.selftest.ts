/**
 * Unicode and language-specific character checks for every puzzle type.
 * German, French, and Spanish samples must survive input → model → generator → layout
 * with their accents intact, and a visible character must stay one cell.
 *
 * Run via: npx tsx src/lib/unicode-text.selftest.ts
 */

import assert from 'node:assert/strict';

import {
  EXTENDED_PUZZLE_LETTERS,
  applyLetterCase,
  baseCodeLetter,
  getLanguageLetterAlphabet,
  graphemeCount,
  textNeedsExtendedLatin,
  isLetterGrapheme,
  lettersOnly,
  localeLowerCase,
  localeUpperCase,
  normalizePuzzleText,
  resolvePuzzleLocale,
  resolveUnicodeFontFamily,
  segmentGraphemes,
  transliterateToAscii,
  unicodeEqual,
  unicodeFoldKey,
  uniqueLetterGraphemes,
} from './unicode-text';
import { cleanCrosswordAnswer } from './crossword-settings';
import { formatCrosswordLetter } from './generic-puzzle-geometry';
import { normalizeGeneratedWordList } from './word-list-parse';
import { generateCryptogram } from './puzzles/cryptogram';
import { generateCrossword, validateCrosswordPuzzle } from './puzzles/crossword';
import { generateDotToDot } from './puzzles/dot-to-dot';
import { generateWordMatch } from './puzzles/word-match';
import { generateWordScramble } from './puzzles/word-scramble';
import { generateWordSearch } from './puzzles/word-search';
import {
  getFrenchCodewordDictionary,
  getGermanCodewordDictionary,
  getSpanishCodewordDictionary,
  normalizeCodewordWord,
} from './puzzles/codewords-dictionary';
import {
  normalizeWordSearchWord,
  uppercaseWordSearchWord,
} from './puzzles/word-search-letters';

/** Accented samples per language, written the way a user would type them. */
export const UNICODE_SAMPLE_WORDS = {
  de: ['Mädchen', 'Fußball', 'Grüße', 'Köln', 'Übung'],
  fr: ['forêt', 'élève', 'Noël', 'cœur', 'français'],
  es: ['niño', 'canción', 'pingüino', 'árbol', 'mañana'],
} as const;

function multiset(values: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of values) out.set(v, (out.get(v) ?? 0) + 1);
  return out;
}

function assertSameLetters(a: string, b: string, message: string): void {
  const left = multiset(segmentGraphemes(a));
  const right = multiset(segmentGraphemes(b));
  assert.equal(left.size, right.size, message);
  for (const [letter, count] of left) {
    assert.equal(right.get(letter), count, `${message} (${letter})`);
  }
}

function checkCoreHelpers(): void {
  // NFC: decomposed input must become the same single code point the model stores.
  assert.equal(normalizePuzzleText('cafe\u0301'), 'café');
  assert.ok(unicodeEqual('cafe\u0301', 'café'));
  assert.ok(!unicodeEqual('café', 'cafe'));

  // One visible character is one cell.
  assert.equal(graphemeCount('cafe\u0301'), 4);
  assert.equal(graphemeCount('niño'), 4);
  assert.equal(graphemeCount('Straße'), 6);
  assert.deepEqual(segmentGraphemes('n\u0303o'), ['ñ', 'o']);

  // Case mapping keeps every letter.
  assert.equal(localeUpperCase('Straße', 'de'), 'STRAßE');
  assert.equal(localeUpperCase('élève', 'fr'), 'ÉLÈVE');
  assert.equal(localeLowerCase('ÑOÑO', 'es'), 'ñoño');
  assert.equal(localeUpperCase('istanbul', 'tr'), 'İSTANBUL');
  assert.equal(applyLetterCase('Noël', 'lower', 'fr'), 'noël');
  assert.equal(applyLetterCase('Noël', 'upper', 'fr'), 'NOËL');

  // Duplicate detection folds case but not accents.
  assert.equal(unicodeFoldKey('Café', 'fr'), unicodeFoldKey('CAFÉ', 'fr'));
  assert.notEqual(unicodeFoldKey('Café', 'fr'), unicodeFoldKey('Cafe', 'fr'));

  assert.ok(isLetterGrapheme('é'));
  assert.ok(isLetterGrapheme('ß'));
  assert.ok(isLetterGrapheme('e\u0301'));
  assert.ok(!isLetterGrapheme('-'));
  assert.equal(lettersOnly("l'été, 2024"), 'lété');
  assert.equal(lettersOnly("l'été, 2024", { allowNumbers: true }), 'lété2024');
  assert.deepEqual(uniqueLetterGraphemes('élève'), ['é', 'l', 'è', 'v', 'e']);

  assert.equal(resolvePuzzleLocale('Deutsch'), 'de');
  assert.equal(resolvePuzzleLocale('français'), 'fr');
  assert.equal(resolvePuzzleLocale(''), 'und');

  assert.ok(textNeedsExtendedLatin('Grüße'));
  assert.ok(!textNeedsExtendedLatin('PUZZLE'));

  // Transliteration stays opt-in and is the only place folding is allowed.
  assert.equal(transliterateToAscii('Straße'), 'Strasse');
  assert.equal(transliterateToAscii('niño'), 'nino');
  assert.equal(transliterateToAscii('cœur'), 'coeur');

  assert.ok(EXTENDED_PUZZLE_LETTERS.includes('Ñ'));
  assert.ok(EXTENDED_PUZZLE_LETTERS.includes('ß'));
}

function checkLanguageAlphabets(): void {
  assert.equal(getLanguageLetterAlphabet('english').length, 26);
  for (const [language, expected] of [
    ['german', ['Ä', 'Ö', 'Ü', 'ß']],
    ['french', ['À', 'Ç', 'É', 'Ê', 'Œ']],
    ['spanish', ['Á', 'Ñ', 'Ü']],
  ] as const) {
    const alphabet = getLanguageLetterAlphabet(language);
    assert.ok(alphabet.length > 26, `${language} alphabet must exceed 26 letters`);
    for (const letter of expected) {
      assert.ok(alphabet.includes(letter), `${language} alphabet must contain ${letter}`);
    }
    assert.equal(new Set(alphabet).size, alphabet.length, `${language} alphabet must be distinct`);
  }
}

function checkWordSearch(): void {
  assert.equal(uppercaseWordSearchWord('Fußball', 'german'), 'FUßBALL');
  assert.equal(normalizeWordSearchWord('Mädchen', 'german'), 'MÄDCHEN');
  assert.equal(normalizeWordSearchWord('cafe\u0301', 'french'), 'CAFÉ');
  assert.equal(normalizeWordSearchWord("l'été", 'french'), 'LÉTÉ');

  for (const [language, words] of [
    ['German', UNICODE_SAMPLE_WORDS.de],
    ['French', UNICODE_SAMPLE_WORDS.fr],
    ['Spanish', UNICODE_SAMPLE_WORDS.es],
  ] as const) {
    const puzzle = generateWordSearch([...words], 16, 16, undefined, language);
    const placed = puzzle.placements.map((p) => p.word);
    assert.ok(placed.length > 0, `${language} word search must place words`);

    // Every cell holds exactly one visible character, so accents never shift the grid.
    for (const row of puzzle.grid) {
      for (const cell of row) {
        if (cell === '') continue;
        assert.equal(graphemeCount(cell), 1, `${language} grid cell "${cell}" must be one letter`);
      }
    }

    const gridLetters = new Set(puzzle.grid.flat().filter(Boolean));
    for (const word of placed) {
      for (const letter of uniqueLetterGraphemes(word)) {
        assert.ok(
          gridLetters.has(letter),
          `${language} grid lost ${letter} from "${word}"`
        );
      }
    }
    assert.ok(
      placed.some((word) => textNeedsExtendedLatin(word)),
      `${language} word search must keep its accented words`
    );
  }
}

function checkWordScramble(): void {
  for (const [language, words] of [
    ['de', UNICODE_SAMPLE_WORDS.de],
    ['fr', UNICODE_SAMPLE_WORDS.fr],
    ['es', UNICODE_SAMPLE_WORDS.es],
  ] as const) {
    const puzzle = generateWordScramble([...words], language);
    assert.equal(puzzle.words.length, words.length, `${language} scramble keeps every word`);
    puzzle.words.forEach((entry, i) => {
      const expected = localeUpperCase(words[i]!, language);
      assert.equal(entry.original, expected, `${language} scramble keeps accents`);
      assertSameLetters(
        entry.scrambled,
        expected,
        `${language} scramble must reuse the same letters`
      );
    });
  }
}

function checkCrossword(): void {
  const languages = [
    ['french', ['FRANÇAIS', 'MAISON', 'ÉLÈVE', 'ARBRE', 'FORÊT']],
    ['german', ['MÄDCHEN', 'KÖLN', 'FUßBALL', 'GRÜßE', 'NACHT']],
    ['spanish', ['CANCIÓN', 'NIÑO', 'ÁRBOL', 'MAÑANA', 'NOCHE']],
  ] as const;

  for (const [language, answers] of languages) {
    const puzzle = generateCrossword(
      answers.map((word) => ({ word, clue: `Clue for ${word}` })),
      { lettersAcross: 18, lettersDown: 18, language }
    );
    const clues = [...puzzle.acrossClues, ...puzzle.downClues];
    assert.ok(clues.length > 0, `${language} crossword must place answers`);

    // Every filled cell holds exactly one visible character, so é never takes two cells.
    for (const row of puzzle.grid) {
      for (const cell of row) {
        if (cell.isBlack || !cell.letter) continue;
        assert.equal(
          graphemeCount(cell.letter),
          1,
          `${language} crossword cell "${cell.letter}" must be one letter`
        );
      }
    }

    // Reading each entry back off the grid must reproduce the answer letter for letter.
    const starts = new Map<number, { r: number; c: number }>();
    puzzle.grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell.clueNumber != null) starts.set(cell.clueNumber, { r, c });
      })
    );
    for (const [list, dr, dc] of [
      [puzzle.acrossClues, 0, 1],
      [puzzle.downClues, 1, 0],
    ] as const) {
      for (const clue of list) {
        const start = starts.get(clue.number);
        assert.ok(start, `${language} clue ${clue.number} must have a numbered start cell`);
        const letters = segmentGraphemes(clue.answer);
        const onGrid = letters.map(
          (_, i) => puzzle.grid[start.r + dr * i]?.[start.c + dc * i]?.letter ?? ''
        );
        assert.deepEqual(
          onGrid,
          letters,
          `${language} entry "${clue.answer}" must sit one letter per cell`
        );
      }
    }

    assert.ok(
      clues.some((clue) => textNeedsExtendedLatin(clue.answer)),
      `${language} crossword must keep its accented answers`
    );
    assert.ok(
      validateCrosswordPuzzle(puzzle).isValid,
      `${language} crossword must validate without folding accents or ß`
    );
  }
}

function checkWordMatchAndDotToDot(): void {
  const match = generateWordMatch([...UNICODE_SAMPLE_WORDS.de], 2, 'de');
  assert.deepEqual(
    match.leftColumn,
    UNICODE_SAMPLE_WORDS.de.map((word) => localeUpperCase(word, 'de')),
    'word match keeps umlauts and ß'
  );
  assertSameLetters(
    match.rightColumn.join(''),
    match.leftColumn.join(''),
    'word match shuffles the same words'
  );

  const dots = generateDotToDot([...UNICODE_SAMPLE_WORDS.fr], 'fr');
  assert.deepEqual(
    dots.labels,
    UNICODE_SAMPLE_WORDS.fr.map((word) => lettersOnly(localeUpperCase(word, 'fr'))),
    'dot-to-dot labels keep their accents'
  );
}

function checkCryptogram(): void {
  for (const [language, phrase] of [
    ['de', 'MÄDCHEN GRÜSSE KÖLN'],
    ['fr', 'LA FORÊT DE NOËL'],
    ['es', 'EL NIÑO CANTA UNA CANCIÓN'],
  ] as const) {
    const puzzle = generateCryptogram(phrase, { language, hintCount: 2 });
    assert.equal(puzzle.originalText, localeUpperCase(phrase, language));

    const cipherLetters = new Set(Object.values(puzzle.letterMapping));
    for (const letter of uniqueLetterGraphemes(puzzle.originalText)) {
      assert.ok(
        cipherLetters.has(letter),
        `${language} cryptogram must cipher ${letter} instead of passing it through`
      );
    }

    // Decoding the cipher must return the original phrase, accents included.
    const decoded = segmentGraphemes(puzzle.encodedText)
      .map((g) => puzzle.letterMapping[g] ?? g)
      .join('');
    assert.equal(decoded, puzzle.originalText, `${language} cryptogram must round-trip`);
  }
}

function checkCodewords(): void {
  const dictionaries = [
    ['fr', getFrenchCodewordDictionary()],
    ['de', getGermanCodewordDictionary()],
    ['es', getSpanishCodewordDictionary()],
  ] as const;

  for (const [language, dict] of dictionaries) {
    // Coding key stays 2×13 (26). Accents stay on words; codes use base A–Z.
    assert.equal(dict.alphabet.length, 26, `${language} codewords alphabet stays 26`);
    assert.ok(dict.words.length > 100, `${language} codewords dictionary has words`);
    assert.ok(
      dict.words.some((word) => textNeedsExtendedLatin(word)),
      `${language} dictionary should include accented sample words`
    );
    for (const word of dict.words) {
      for (const letter of segmentGraphemes(word)) {
        const base = baseCodeLetter(letter, language);
        assert.ok(
          dict.alphabet.includes(base),
          `${language} word "${word}" letter ${letter} (base ${base}) has no code`
        );
      }
    }
  }

  const french = new Set(getFrenchCodewordDictionary().alphabet);
  assert.equal(normalizeCodewordWord('cafe\u0301', french, 'fr'), 'CAFÉ');
  assert.equal(normalizeCodewordWord("l'été", french, 'fr'), 'LÉTÉ');
  assert.equal(baseCodeLetter('É', 'fr'), 'E');
  assert.equal(baseCodeLetter('é', 'fr'), 'E');
  assert.equal(baseCodeLetter('Ñ', 'es'), 'N');
  assert.equal(baseCodeLetter('Ä', 'de'), 'A');
}

function checkSharedInputPaths(): void {
  // Answer-key / solution-cell casing is shared by canvas, PDF, and PPTX.
  assert.equal(formatCrosswordLetter('ß', 'upper', 'german'), 'ß');
  assert.equal(formatCrosswordLetter('FUßBALL', 'upper', 'german'), 'FUßBALL');
  assert.equal(formatCrosswordLetter('élève', 'upper', 'french'), 'ÉLÈVE');
  assert.equal(formatCrosswordLetter('ÉLÈVE', 'lower', 'french'), 'élève');
  assert.equal(formatCrosswordLetter('cafe\u0301', 'original', 'french'), 'café');

  assert.equal(cleanCrosswordAnswer('Mädchen', false, 'german'), 'MÄDCHEN');
  assert.equal(cleanCrosswordAnswer('cafe\u0301', false, 'french'), 'CAFÉ');
  assert.equal(cleanCrosswordAnswer("l'été 24", true, 'french'), 'LÉTÉ24');

  const list = normalizeGeneratedWordList(['Mädchen', 'mädchen', 'Madchen']);
  assert.ok(list.includes('MÄDCHEN'), 'word lists must keep umlauts');
  assert.ok(list.includes('MADCHEN'), 'an unaccented spelling is a different word');
  assert.equal(list.length, 2, 'case-only duplicates collapse, accent differences do not');
}

function checkFontFallback(): void {
  // A face that ships the accented glyphs is kept.
  assert.equal(resolveUnicodeFontFamily('Arial', 'Grüße'), 'Arial');
  assert.equal(resolveUnicodeFontFamily('Verdana', 'niño'), 'Verdana');
  // A display face without them falls back rather than printing blanks.
  assert.equal(resolveUnicodeFontFamily('Grow Year', 'Grüße'), 'Arial');
  // Plain ASCII keeps whatever the user picked.
  assert.equal(resolveUnicodeFontFamily('Grow Year', 'PUZZLE'), 'Grow Year');
}

export function runUnicodeTextChecks(): void {
  checkCoreHelpers();
  checkLanguageAlphabets();
  checkWordSearch();
  checkWordScramble();
  checkCrossword();
  checkWordMatchAndDotToDot();
  checkCryptogram();
  checkCodewords();
  checkSharedInputPaths();
  checkFontFallback();
}

if (process.argv[1] && process.argv[1].includes('unicode-text.selftest')) {
  runUnicodeTextChecks();
  console.log('unicode-text.selftest: OK');
}
