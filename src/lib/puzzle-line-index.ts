import type { WordSearchPuzzle, WordSearchSettings } from './puzzles/types';

/**
 * Display puzzle number from Quantity → Starting Number + per-document index.
 * Prefer index+start so changing Starting Number updates PDF/PPT without regenerate.
 */
export function resolvePuzzleDisplayNumber(
  puzzle: WordSearchPuzzle,
  settings?: WordSearchSettings,
  fallbackIndex = 0
): number {
  const start = Math.max(1, Math.round(settings?.core?.puzzlesStartingNumber ?? 1));
  if (typeof puzzle.puzzleIndexInDocument === 'number' && puzzle.puzzleIndexInDocument >= 0) {
    return start + puzzle.puzzleIndexInDocument;
  }
  if (typeof puzzle.puzzleNumber === 'number' && Number.isFinite(puzzle.puzzleNumber)) {
    return puzzle.puzzleNumber;
  }
  return start + Math.max(0, fallbackIndex);
}

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

function splitMultilineContent(text: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n/);
}

/** Read one line from multiline book text without trimming or dropping blank lines. */
export function getRawContentLineAt(text: string, index: number): string {
  const lines = splitMultilineContent(text);
  return lines[index] ?? '';
}

/** Replace one line in multiline book text, padding with empty lines as needed. */
export function setRawContentLineAt(text: string, index: number, value: string): string {
  const lines = splitMultilineContent(text);
  while (lines.length <= index) lines.push('');
  lines[index] = value;
  return lines.join('\n');
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
