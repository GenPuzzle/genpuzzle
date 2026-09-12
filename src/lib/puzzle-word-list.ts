import type { TitleWordsSettings, WordSearchPuzzle, WordListSettings } from './puzzles/types';

export function getPuzzleIndexInDocument(puzzle: WordSearchPuzzle): number {
  return Math.max(0, puzzle.puzzleIndexInDocument ?? 0);
}

/** Words assigned to each puzzle from the master list (1 when one-word mode is on). */
export function getEffectiveWordsPerPuzzle(wordList: Pick<WordListSettings, 'wordsPerPuzzle' | 'oneWordPerPuzzle'>): number {
  if (wordList.oneWordPerPuzzle) return 1;
  return Math.max(1, wordList.wordsPerPuzzle || 1);
}

/** How many times to place the puzzle's word(s) on the grid. */
export function getWordRepeatCount(wordList: Pick<WordListSettings, 'oneWordPerPuzzle' | 'wordRepeatCount'>): number {
  if (!wordList.oneWordPerPuzzle) return 1;
  return Math.max(1, Math.min(40, Math.round(wordList.wordRepeatCount ?? 5) || 5));
}

/** Whether empty grid cells should use only letters from the puzzle word(s). */
export function getFillWithWordLettersOnly(
  wordList: Pick<WordListSettings, 'oneWordPerPuzzle' | 'fillWithWordLettersOnly'>
): boolean {
  return Boolean(wordList.oneWordPerPuzzle && wordList.fillWithWordLettersOnly);
}

export function getWordsForPuzzlePage(
  puzzle: WordSearchPuzzle | undefined,
  titleWords: TitleWordsSettings,
  wordsPerPuzzle: number,
  source: 'puzzle' | 'titleWords' = 'puzzle'
): string[] {
  if (!puzzle) return [];
  const idx = getPuzzleIndexInDocument(puzzle);
  const fromTitle = titleWords.words.slice(idx * wordsPerPuzzle, idx * wordsPerPuzzle + wordsPerPuzzle);
  if (source === 'titleWords') return fromTitle;
  if (puzzle.words?.length) return [...puzzle.words];
  return fromTitle;
}

export function replacePuzzleWordsInTitleList(
  titleWords: TitleWordsSettings,
  puzzleIndexInDocument: number,
  wordsPerPuzzle: number,
  newWords: string[]
): TitleWordsSettings {
  const start = puzzleIndexInDocument * wordsPerPuzzle;
  const before = titleWords.words.slice(0, start);
  const after = titleWords.words.slice(start + wordsPerPuzzle);
  const slotWords = newWords.slice(0, wordsPerPuzzle);
  while (slotWords.length < wordsPerPuzzle) {
    slotWords.push('');
  }
  return { ...titleWords, words: [...before, ...slotWords, ...after] };
}

/** One line per word slot; caps at wordsPerPuzzle lines. */
export function parsePuzzleWordLines(value: string, wordsPerPuzzle: number): string[] {
  const lines = value.split('\n').slice(0, wordsPerPuzzle);
  const slots: string[] = [];
  for (let i = 0; i < wordsPerPuzzle; i++) {
    slots.push((lines[i] ?? '').trim());
  }
  return slots;
}

export function formatPuzzleWordLines(words: string[], wordsPerPuzzle: number): string {
  const slots: string[] = [];
  for (let i = 0; i < wordsPerPuzzle; i++) {
    slots.push(words[i] ?? '');
  }
  return slots.join('\n');
}

export function clampPuzzleWordLineInput(value: string, wordsPerPuzzle: number): string {
  const lines = value.split('\n');
  if (lines.length <= wordsPerPuzzle) return value;
  return lines.slice(0, wordsPerPuzzle).join('\n');
}

export function countPuzzleWordLines(value: string): number {
  if (!value) return 1;
  return value.split('\n').length;
}

/** Remove one puzzle's word slot from the shared document word list. */
export function removePuzzleWordsFromTitleList(
  titleWords: TitleWordsSettings,
  puzzleIndexInDocument: number,
  wordsPerPuzzle: number
): TitleWordsSettings {
  const wpp = Math.max(1, Math.round(wordsPerPuzzle) || 1);
  const idx = Math.max(0, Math.round(puzzleIndexInDocument) || 0);
  const start = idx * wpp;
  if (start >= titleWords.words.length) {
    return { ...titleWords, words: [...titleWords.words] };
  }
  return {
    ...titleWords,
    words: [...titleWords.words.slice(0, start), ...titleWords.words.slice(start + wpp)],
  };
}

/** Remove one line from multiline title / fun-fact text (keeps blank lines elsewhere). */
export function removeContentLineAt(text: string, index: number): string {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  if (index < 0 || index >= lines.length) return text;
  lines.splice(index, 1);
  return lines.join('\n');
}
