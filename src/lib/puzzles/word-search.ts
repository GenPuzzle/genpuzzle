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

function fillEmptyCells(grid: string[][]): void {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
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
  gridSize: number = 15,
  directions: Direction[] = DIRECTIONS
): WordSearchPuzzle {
  // Clean and uppercase words
  const cleanWords = words
    .map((w) => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length > 1 && w.length <= gridSize)
    .sort((a, b) => b.length - a.length); // Sort by length, longest first

  // Initialize empty grid
  const grid: string[][] = Array(gridSize)
    .fill(null)
    .map(() => Array(gridSize).fill(''));

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
  fillEmptyCells(grid);

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

  return {
    type: 'word-search',
    grid,
    placements,
    words: placements.map((p) => p.word),
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
