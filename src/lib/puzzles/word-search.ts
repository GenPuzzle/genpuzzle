import {
  Position,
  Direction,
  WordPlacement,
  WordSearchPuzzle,
} from './types';

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
  direction: Direction
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
  directions: Direction[]
): { start: Position; direction: Direction } | null {
  const rows = grid.length;
  const cols = grid[0].length;

  // Shuffle directions for randomness
  const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

  for (const dir of shuffledDirs) {
    const { dr, dc } = getDirectionVector(dir);
    const positions: Position[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        positions.push({ row: r, col: c });
      }
    }

    // Shuffle positions for randomness
    positions.sort(() => Math.random() - 0.5);

    for (const pos of positions) {
      if (canPlaceWord(grid, word, pos, dir)) {
        return { start: pos, direction: dir };
      }
    }
  }

  return null;
}

function fillEmptyCells(grid: string[][], language: string = 'English'): void {
  let letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  if (language === 'Arabic') {
    // Arabic letters (excluding diacritics, using main alphabet)
    letters = 'ابجدهوزحطيكلمنسعفصقرشتثخذضظغ';
  }
  
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
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
  language: string = 'English'
): WordSearchPuzzle {
  // Helper function to check if character is Arabic
  const isArabicChar = (char: string): boolean => {
    return /[\u0600-\u06FF]/.test(char);
  };

  // Helper function to check if character is English
  const isEnglishChar = (char: string): boolean => {
    return /[A-Za-z]/.test(char);
  };

  // Create a mapping from cleaned word to original word (for display)
  const cleanToDisplay = new Map<string, string>();

  // Clean and process words based on language
  let cleanWords: string[];
  
  const maxWordLength = Math.max(lettersAcross, lettersDown);

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
    // For English and other languages: convert to uppercase, keep only A-Z for grid
    // But preserve spaces in the display version
    cleanWords = words
      .map((w) => {
        const trimmed = w.trim().toUpperCase();
        const cleaned = trimmed.replace(/[^A-Z]/g, '');
        cleanToDisplay.set(cleaned, trimmed);
        return cleaned;
      })
      .filter((w) => w.length > 1 && w.length <= maxWordLength)
      .sort((a, b) => b.length - a.length);
  }

  // Initialize rectangular grid
  const grid: string[][] = Array(lettersDown)
    .fill(null)
    .map(() => Array(lettersAcross).fill(''));

  const placements: WordPlacement[] = [];
  const usedWords = new Set<string>();

  // Place words
  for (const word of cleanWords) {
    if (usedWords.has(word)) continue;

    const result = findValidPosition(grid, word, directions);
    if (result) {
      const placement = placeWord(grid, word, result.start, result.direction);
      placements.push(placement);
      usedWords.add(word);
    }
  }

  // Fill remaining cells
  fillEmptyCells(grid, language);

  // Create solution map
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
    solution.set(placement.word, positions);
  }

  // Map placements to their display words
  const displayWords = placements.map((p) => cleanToDisplay.get(p.word) || p.word);

  return {
    type: 'word-search',
    grid,
    placements,
    words: placements.map((p) => p.word),
    displayWords, // Include the display words with spaces preserved
    solution,
  };
}

export function generateWordSearchSolution(
  puzzle: WordSearchPuzzle,
  solutionPositions: Map<string, Position[]>
): string[][] {
  const solution = puzzle.grid.map((row) => [...row]);
  return solution;
}
