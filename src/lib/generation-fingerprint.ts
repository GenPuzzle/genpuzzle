import type { TitleWordsSettings, WordSearchSettings } from './puzzles/types';

/** Settings that affect puzzle grids but are not reflected live until Generate/Update. */
export function computeWordSearchGenerationFingerprint(
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings
): string {
  const { core, wordList } = settings;
  return JSON.stringify({
    words: titleWords.words,
    lettersAcross: core.lettersAcross,
    lettersDown: core.lettersDown,
    numberOfPuzzles: core.numberOfPuzzles,
    wordsPerPuzzle: wordList.wordsPerPuzzle,
    allowRight: core.allowRight,
    allowLeft: core.allowLeft,
    allowDown: core.allowDown,
    allowUp: core.allowUp,
    allowDiagonalDown: core.allowDiagonalDown,
    allowDiagonalUp: core.allowDiagonalUp,
    allowDiagonalDownReverse: core.allowDiagonalDownReverse,
    allowDiagonalUpReverse: core.allowDiagonalUpReverse,
    aiLanguage: wordList.aiLanguage,
  });
}
