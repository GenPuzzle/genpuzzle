const LANGUAGE_ALPHABETS: Record<string, string> = {
  german: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜß',
  french: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ',
  spanish: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÜÑ',
};

export function getWordSearchAlphabet(language: string): string {
  return LANGUAGE_ALPHABETS[language.trim().toLowerCase()] ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
}

const EXTENDED_LETTERS = /[^A-Z]/;
export const WORD_SEARCH_EXTENDED_LETTERS = 'ÄÖÜßÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸÁÉÍÓÚÑ';

export function wordSearchFontFamily(fontFamily: string, puzzle: { grid: string[][] }): string {
  const hasExtendedLetter = puzzle.grid.some((row) => row.some((letter) => EXTENDED_LETTERS.test(letter)));
  return hasExtendedLetter ? 'Arial' : fontFamily || 'Arial';
}
export function uppercaseWordSearchWord(word: string, language: string): string {
  const preserveGermanSharpS = language.trim().toLowerCase() === 'german';
  return preserveGermanSharpS
    ? word.replace(/[ßẞ]/g, '\u0000').toUpperCase().replace(/\u0000/g, 'ß')
    : word.toUpperCase();
}

export function normalizeWordSearchWord(word: string, language: string): string {
  const upper = uppercaseWordSearchWord(word, language);
  // Manual lists can contain accents even when the AI language setting is unchanged.
  // Preserve every Unicode letter; the selected language only controls filler letters.
  return Array.from(upper).filter((char) => /\p{L}/u.test(char)).join('');
}