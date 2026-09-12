import {
  Position,
  Direction,
  WordPlacement,
  WordSearchPuzzle,
} from './types';
import { isWordSearchShapeCell } from './word-search-shape-mask';
import { getWordSearchAlphabet, normalizeWordSearchWord, uppercaseWordSearchWord } from './word-search-letters';

const DIRECTIONS: Direction[] = [
  'horizontal',
  'vertical',
  'diagonal-down',
  'diagonal-up',
];

function getDirectionVector(dir: Direction): { dr: number; dc: number } {
  switch (dir) {
    case 'horizontal':
      return { dr: 0, dc: 1 };
    case 'horizontal-reverse':
      return { dr: 0, dc: -1 };
    case 'vertical':
      return { dr: 1, dc: 0 };
    case 'vertical-reverse':
      return { dr: -1, dc: 0 };
    case 'diagonal-down':
      return { dr: 1, dc: 1 };
    case 'diagonal-down-reverse':
      return { dr: -1, dc: -1 };
    case 'diagonal-up':
      return { dr: -1, dc: 1 };
    case 'diagonal-up-reverse':
      return { dr: 1, dc: -1 };
    default:
      return { dr: 0, dc: 1 };
  }
}

function canPlaceWord(
  grid: string[][],
  word: string,
  start: Position,
  direction: Direction,
  shapeMask?: boolean[][]
): boolean {
  const { dr, dc } = getDirectionVector(direction);
  const rows = grid.length;
  const cols = grid[0].length;

  for (let i = 0; i < word.length; i++) {
    const row = start.row + dr * i;
    const col = start.col + dc * i;

    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      return false;
    }

    if (!isWordSearchShapeCell(shapeMask, row, col)) {
      return false;
    }

    if (grid[row][col] !== '' && grid[row][col] !== word[i]) {
      return false;
    }
  }

  return true;
}

function placeWord(
  grid: string[][],
  word: string,
  start: Position,
  direction: Direction
): WordPlacement {
  const { dr, dc } = getDirectionVector(direction);
  const positions: Position[] = [];

  for (let i = 0; i < word.length; i++) {
    const row = start.row + dr * i;
    const col = start.col + dc * i;
    grid[row][col] = word[i];
    positions.push({ row, col });
  }

  return {
    word,
    start,
    direction,
    end: positions[positions.length - 1],
  };
}

function findValidPosition(
  grid: string[][],
  word: string,
  directions: Direction[],
  shapeMask?: boolean[][]
): { start: Position; direction: Direction } | null {
  const rows = grid.length;
  const cols = grid[0].length;

  // Shuffle directions for randomness
  const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

  for (const dir of shuffledDirs) {
    const positions: Position[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isWordSearchShapeCell(shapeMask, r, c)) continue;
        positions.push({ row: r, col: c });
      }
    }

    // Shuffle positions for randomness
    positions.sort(() => Math.random() - 0.5);

    for (const pos of positions) {
      if (canPlaceWord(grid, word, pos, dir, shapeMask)) {
        return { start: pos, direction: dir };
      }
    }
  }

  return null;
}

function fillEmptyCells(
  grid: string[][],
  language: string = 'English',
  shapeMask?: boolean[][],
  letterPool?: string
): void {
  let letters = getWordSearchAlphabet(language);

  if (language === 'Arabic') {
    // Arabic letters (excluding diacritics, using main alphabet)
    letters = 'ابجدهوزحطيكلمنسعفصقرشتثخذضظغ';
  }

  if (letterPool && letterPool.length > 0) {
    letters = letterPool;
  }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (!isWordSearchShapeCell(shapeMask, r, c)) {
        grid[r][c] = '';
        continue;
      }
      if (grid[r][c] === '') {
        grid[r][c] = letters[Math.floor(Math.random() * letters.length)];
      }
    }
  }
}

export function generateWordSearch(
  words: string[],
  lettersAcross: number = 15,
  lettersDown: number = 15,
  directions: Direction[] = DIRECTIONS,
  language: string = 'English',
  shapeMask?: boolean[][],
  wordRepeatCount: number = 1,
  fillWithWordLettersOnly: boolean = false
): WordSearchPuzzle {
  // Helper function to check if character is Arabic
  const isArabicChar = (char: string): boolean => {
    return /[\u0600-\u06FF]/.test(char);
  };

  // Create a mapping from cleaned word to original word (for display)
  const cleanToDisplay = new Map<string, string>();

  // Clean and process words based on language
  let cleanWords: string[];

  const maxWordLength = Math.max(lettersAcross, lettersDown);
  const repeats = Math.max(1, Math.min(40, Math.round(wordRepeatCount) || 1));

  if (language === 'Arabic') {
    // For Arabic: convert to uppercase (Arabic doesn't have case), keep only Arabic chars
    cleanWords = words
      .map((w) => w.trim().toUpperCase())
      .map((w) => {
        const cleaned = w.split('').filter(isArabicChar).join('');
        cleanToDisplay.set(cleaned, w);
        return cleaned;
      })
      .filter((w) => w.length > 1 && w.length <= maxWordLength)
      .sort((a, b) => b.length - a.length);
  } else {
    // Preserve the language's accented letters in the grid.
    // But preserve spaces in the display version
    cleanWords = words
      .map((w) => {
        const trimmed = uppercaseWordSearchWord(w.trim(), language);
        const cleaned = normalizeWordSearchWord(trimmed, language);
        cleanToDisplay.set(cleaned, trimmed);
        return cleaned;
      })
      .filter((w) => w.length > 1 && w.length <= maxWordLength)
      .sort((a, b) => b.length - a.length);
  }

  // De-dupe input list for placement targets (repeat count handles multiple placements)
  const uniqueCleanWords: string[] = [];
  const seenInput = new Set<string>();
  for (const word of cleanWords) {
    if (seenInput.has(word)) continue;
    seenInput.add(word);
    uniqueCleanWords.push(word);
  }

  // Initialize rectangular grid
  const grid: string[][] = Array(lettersDown)
    .fill(null)
    .map(() => Array(lettersAcross).fill(''));

  const placements: WordPlacement[] = [];

  // Shape grids / dense repeats are harder to pack — retry each placement.
  const placementAttempts = shapeMask || repeats > 1 ? 6 : 1;

  // Place each unique word `repeats` times on the grid
  for (const word of uniqueCleanWords) {
    for (let t = 0; t < repeats; t++) {
      let placed = false;
      for (let attempt = 0; attempt < placementAttempts && !placed; attempt++) {
        const result = findValidPosition(grid, word, directions, shapeMask);
        if (result) {
          const placement = placeWord(grid, word, result.start, result.direction);
          placements.push(placement);
          placed = true;
        }
      }
    }
  }

  // Fill remaining cells (inside shape only)
  let fillerPool: string | undefined;
  if (fillWithWordLettersOnly && uniqueCleanWords.length > 0) {
    const chars = new Set<string>();
    for (const word of uniqueCleanWords) {
      for (const ch of word) chars.add(ch);
    }
    fillerPool = [...chars].join('');
  }
  fillEmptyCells(grid, language, shapeMask, fillerPool);

  // Create solution map (merge all placements of the same word)
  const solution = new Map<string, Position[]>();
  for (const placement of placements) {
    const positions: Position[] = [];
    const { dr, dc } = getDirectionVector(placement.direction);
    for (let i = 0; i < placement.word.length; i++) {
      positions.push({
        row: placement.start.row + dr * i,
        col: placement.start.col + dc * i,
      });
    }
    const existing = solution.get(placement.word) ?? [];
    solution.set(placement.word, existing.concat(positions));
  }

  // Word list shows each word once (even if placed many times on the grid)
  const uniquePlaced = [...new Set(placements.map((p) => p.word))];
  const displayWords = uniquePlaced.map((w) => cleanToDisplay.get(w) || w);

  return {
    type: 'word-search',
    grid,
    placements,
    words: uniquePlaced,
    displayWords,
    solution,
    ...(shapeMask ? { shapeMask } : {}),
  };
}

export function generateWordSearchSolution(
  puzzle: WordSearchPuzzle,
  solutionPositions: Map<string, Position[]>
): string[][] {
  const solution = puzzle.grid.map((row) => [...row]);
  return solution;
}
