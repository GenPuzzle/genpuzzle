/**
 * Word-search letter helpers — Unicode-aware, shared with unicode-text.
 * Accented letters are preserved; language only controls the filler alphabet.
 */

import {
  getLanguageLetterAlphabet,
  localeUpperCase,
  normalizePuzzleText,
  resolvePuzzleLocale,
  resolveUnicodeFontFamily,
  segmentGraphemes,
  isLetterGrapheme,
  textNeedsExtendedLatin,
} from '../unicode-text';

export function resolveWordSearchLanguageKey(language: string): string {
  const locale = resolvePuzzleLocale(language);
  if (locale === 'und') {
    const raw = language.trim().toLowerCase();
    return raw || 'english';
  }
  const names: Record<string, string> = {
    en: 'english',
    fr: 'french',
    de: 'german',
    es: 'spanish',
    it: 'italian',
    pt: 'portuguese',
  };
  return names[locale] ?? 'english';
}

export function getWordSearchAlphabet(language: string): string {
  return getLanguageLetterAlphabet(language).join('');
}

export const WORD_SEARCH_EXTENDED_LETTERS =
  'ÄÖÜßÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸÁÉÍÓÚÑÌÒÃÕ';

export function wordSearchFontFamily(fontFamily: string, puzzle: { grid: string[][] }): string {
  const sample = puzzle.grid.flat().join('');
  if (!textNeedsExtendedLatin(sample)) return fontFamily || 'Arial';
  return resolveUnicodeFontFamily(fontFamily, sample);
}

export function uppercaseWordSearchWord(word: string, language: string): string {
  return localeUpperCase(normalizePuzzleText(word), language);
}

export function normalizeWordSearchWord(word: string, language: string): string {
  const upper = uppercaseWordSearchWord(word, language);
  // Manual lists can contain accents even when the AI language setting is unchanged.
  // Preserve every Unicode letter; the selected language only controls filler letters.
  return segmentGraphemes(upper).filter((char) => isLetterGrapheme(char)).join('');
}

function uniqueLetters(source: string): string {
  const seen = new Set<string>();
  let out = '';
  for (const ch of segmentGraphemes(source)) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    out += ch;
  }
  return out;
}

/** Filler alphabet: language letters plus any accented letters already used in the word list. */
export function getWordSearchFillerAlphabet(language: string, extraLetters = ''): string {
  return uniqueLetters(getWordSearchAlphabet(language) + extraLetters);
}
