import { WordMatchPuzzle } from './types';

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateWordMatch(
  words: string[],
  columnCount: number = 2
): WordMatchPuzzle {
  const cleanWords = words
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length > 0)
    .slice(0, 50); // Limit to 50 words

  if (cleanWords.length === 0) {
    return { type: 'word-match', leftColumn: [], rightColumn: [] };
  }

  // Shuffle for right column
  const rightColumn = shuffleArray(cleanWords);

  return {
    type: 'word-match',
    leftColumn: cleanWords,
    rightColumn,
  };
}
