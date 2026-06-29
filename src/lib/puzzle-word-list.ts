import type { TitleWordsSettings, WordSearchPuzzle } from './puzzles/types';

export function getPuzzleIndexInDocument(puzzle: WordSearchPuzzle): number {
  return Math.max(0, puzzle.puzzleIndexInDocument ?? 0);
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
