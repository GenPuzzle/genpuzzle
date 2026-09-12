import { SudokuPuzzle, Difficulty } from './types';

/** Supported Sudoku board sizes (cells per side). */
export type SudokuSize = 4 | 6 | 9 | 12 | 16 | 25;

export const SUDOKU_SIZES: SudokuSize[] = [4, 6, 9, 12, 16, 25];

/** Box height × width for each board size (boxH * boxW === size). */
export const SUDOKU_BOX: Record<SudokuSize, { boxH: number; boxW: number }> = {
  4: { boxH: 2, boxW: 2 },
  6: { boxH: 2, boxW: 3 },
  9: { boxH: 3, boxW: 3 },
  12: { boxH: 3, boxW: 4 },
  16: { boxH: 4, boxW: 4 },
  25: { boxH: 5, boxW: 5 },
};

export function isSudokuSize(value: unknown): value is SudokuSize {
  return (
    value === 4 ||
    value === 6 ||
    value === 9 ||
    value === 12 ||
    value === 16 ||
    value === 25
  );
}

/** Display digit: 1–9 as numbers, 10+ as A, B, C… */
export function formatSudokuSymbol(value: number): string {
  if (!value || value < 1) return '';
  if (value <= 9) return String(value);
  return String.fromCharCode('A'.charCodeAt(0) + (value - 10));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createEmptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

/**
 * Build a valid complete Sudoku via the classic band/stack pattern, then
 * shuffle bands, stacks, rows-within-band, cols-within-stack, and symbols.
 * Works for any size where boxH * boxW === size.
 */
function generateCompleteGrid(size: SudokuSize): number[][] {
  const { boxH, boxW } = SUDOKU_BOX[size];
  const bandCount = size / boxH; // === boxW
  const stackCount = size / boxW; // === boxH

  // Pattern: ((r * boxW + floor(r / boxH) + c) % size) + 1
  let grid = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      return ((r * boxW + Math.floor(r / boxH) + c) % size) + 1;
    })
  );

  const remapSymbols = (g: number[][], map: number[]) =>
    g.map((row) => row.map((v) => map[v - 1]));

  // Shuffle symbol labels
  const symbols = shuffleInPlace(Array.from({ length: size }, (_, i) => i + 1));
  grid = remapSymbols(grid, symbols);

  // Shuffle bands (groups of boxH rows)
  const bandOrder = shuffleInPlace(Array.from({ length: bandCount }, (_, i) => i));
  grid = bandOrder.flatMap((b) => grid.slice(b * boxH, b * boxH + boxH));

  // Shuffle rows within each band
  for (let b = 0; b < bandCount; b++) {
    const rows = grid.slice(b * boxH, b * boxH + boxH);
    shuffleInPlace(rows);
    for (let i = 0; i < boxH; i++) grid[b * boxH + i] = rows[i];
  }

  // Shuffle stacks (groups of boxW cols) via transpose-like remapping
  const stackOrder = shuffleInPlace(Array.from({ length: stackCount }, (_, i) => i));
  grid = grid.map((row) =>
    stackOrder.flatMap((s) => row.slice(s * boxW, s * boxW + boxW))
  );

  // Shuffle cols within each stack
  for (let s = 0; s < stackCount; s++) {
    const colIdx = Array.from({ length: boxW }, (_, i) => s * boxW + i);
    shuffleInPlace(colIdx);
    grid = grid.map((row) => {
      const next = [...row];
      for (let i = 0; i < boxW; i++) {
        next[s * boxW + i] = row[colIdx[i]];
      }
      return next;
    });
  }

  return grid;
}

function isValid(
  grid: number[][],
  row: number,
  col: number,
  num: number,
  size: number,
  boxH: number,
  boxW: number
): boolean {
  for (let c = 0; c < size; c++) {
    if (grid[row][c] === num) return false;
  }
  for (let r = 0; r < size; r++) {
    if (grid[r][col] === num) return false;
  }
  const boxRow = Math.floor(row / boxH) * boxH;
  const boxCol = Math.floor(col / boxW) * boxW;
  for (let r = boxRow; r < boxRow + boxH; r++) {
    for (let c = boxCol; c < boxCol + boxW; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

/** Count solutions up to `limit` (used for uniqueness on smaller boards). */
function countSolutions(
  grid: number[][],
  size: number,
  boxH: number,
  boxW: number,
  limit: number = 2
): number {
  let count = 0;
  const nums = Array.from({ length: size }, (_, i) => i + 1);

  function solve(): boolean {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (grid[row][col] === 0) {
          for (const num of nums) {
            if (isValid(grid, row, col, num, size, boxH, boxW)) {
              grid[row][col] = num;
              if (solve()) {
                if (count >= limit) {
                  grid[row][col] = 0;
                  return true;
                }
              }
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    count++;
    return count >= limit;
  }

  solve();
  return count;
}

/** Target filled-cell ratio by difficulty (size-agnostic). */
function getClueRatio(difficulty: Difficulty): { min: number; max: number } {
  switch (difficulty) {
    case 'easy':
      return { min: 0.48, max: 0.58 };
    case 'medium':
      return { min: 0.36, max: 0.46 };
    case 'hard':
    case 'expert':
      return { min: 0.26, max: 0.35 };
    default:
      return { min: 0.36, max: 0.46 };
  }
}

function removeNumbers(
  grid: number[][],
  clueCount: number,
  size: SudokuSize,
  checkUnique: boolean
): number[][] {
  const { boxH, boxW } = SUDOKU_BOX[size];
  const puzzle = grid.map((row) => [...row]);
  const positions: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      positions.push([r, c]);
    }
  }
  shuffleInPlace(positions);

  let removed = 0;
  const targetRemoved = size * size - clueCount;

  for (const [row, col] of positions) {
    if (removed >= targetRemoved) break;
    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    if (checkUnique) {
      const testGrid = puzzle.map((r) => [...r]);
      if (countSolutions(testGrid, size, boxH, boxW, 2) === 1) {
        removed++;
      } else {
        puzzle[row][col] = backup;
      }
    } else {
      removed++;
    }
  }

  return puzzle;
}

export interface GenerateSudokuOptions {
  difficulty?: Difficulty;
  size?: SudokuSize;
}

export function generateSudoku(
  difficultyOrOptions: Difficulty | GenerateSudokuOptions = 'medium'
): SudokuPuzzle {
  const opts: GenerateSudokuOptions =
    typeof difficultyOrOptions === 'string'
      ? { difficulty: difficultyOrOptions }
      : difficultyOrOptions;

  const difficulty = opts.difficulty ?? 'medium';
  const size: SudokuSize = isSudokuSize(opts.size) ? opts.size : 9;

  const solution = generateCompleteGrid(size);
  const total = size * size;
  const { min, max } = getClueRatio(difficulty);
  const clueCount = Math.max(
    size, // at least one clue per row-ish floor
    Math.floor(total * (min + Math.random() * (max - min)))
  );

  // Uniqueness dig is expensive beyond 9×9 — skip for larger boards.
  const checkUnique = size <= 9;
  const puzzleGrid = removeNumbers(solution, clueCount, size, checkUnique);

  return {
    type: 'sudoku',
    grid: puzzleGrid,
    solution,
    difficulty,
    size,
  };
}

/** @deprecated Prefer generateSudoku({ difficulty, size }) */
export function isSudokuComplete(grid: number[][]): boolean {
  const size = grid.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return true;
}

/** Empty helper kept for API compatibility. */
export function createEmptySudokuGrid(size: SudokuSize = 9): number[][] {
  return createEmptyGrid(size);
}
