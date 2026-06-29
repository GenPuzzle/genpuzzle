import type { WordSearchPuzzle, WordSearchSettings } from './puzzles/types';

/**
 * 0-based index into per-document lines (fun facts, custom titles).
 * Multi-document books use global puzzleNumber for display but each document
 * has its own line list starting at line 0.
 */
export function getPuzzleContentLineIndex(
  puzzle: WordSearchPuzzle,
  settings?: WordSearchSettings
): number {
  if (
    typeof puzzle.puzzleIndexInDocument === 'number' &&
    puzzle.puzzleIndexInDocument >= 0
  ) {
    return puzzle.puzzleIndexInDocument;
  }

  const puzzleNum = puzzle.puzzleNumber ?? 1;
  const start = settings?.core?.puzzlesStartingNumber ?? 1;
  return Math.max(0, puzzleNum - start);
}

export function getPuzzleContentLine(
  lines: string[],
  puzzle: WordSearchPuzzle,
  settings?: WordSearchSettings,
  fallbackToLast = false
): string {
  if (lines.length === 0) return '';
  const index = getPuzzleContentLineIndex(puzzle, settings);
  if (fallbackToLast) {
    return lines[index] ?? lines[lines.length - 1];
  }
  return lines[index] ?? '';
}

/** Assign per-document 0-based indices (fun facts / custom titles) after batch generation. */
export function normalizeBatchPuzzleDocumentIndices(
  puzzles: WordSearchPuzzle[]
): WordSearchPuzzle[] {
  const counters = new Map<string, number>();
  return puzzles.map((puzzle) => {
    const pageKey = puzzle.pageId ?? '__default__';
    const index = counters.get(pageKey) ?? 0;
    counters.set(pageKey, index + 1);
    return { ...puzzle, puzzleIndexInDocument: index };
  });
}
