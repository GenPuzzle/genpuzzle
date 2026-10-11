import { SudokuPuzzle, Difficulty, type SudokuInequality } from './types';
import { generateGreaterThanSudoku } from './sudoku-greater-than';

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

export function isSudokuXPuzzle(puzzle: Pick<SudokuPuzzle, 'variant'> | null | undefined): boolean {
  return puzzle?.variant === 'x';
}

export function isSudokuGreaterThanPuzzle(
  puzzle: Pick<SudokuPuzzle, 'variant'> | null | undefined
): boolean {
  return puzzle?.variant === 'greater-than';
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
/** Full valid Sudoku grid (exported for Greater Than generation). */
export function generateFilledSudokuGrid(size: SudokuSize): number[][] {
  return generateCompleteGrid(size);
}

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

/** True when both main diagonals contain each symbol once (Sudoku X). */
export function hasUniqueDiagonals(grid: number[][]): boolean {
  const size = grid.length;
  if (size < 1) return false;
  const main = new Set<number>();
  const anti = new Set<number>();
  for (let i = 0; i < size; i++) {
    const a = grid[i]?.[i] ?? 0;
    const b = grid[i]?.[size - 1 - i] ?? 0;
    if (a < 1 || b < 1) return false;
    main.add(a);
    anti.add(b);
  }
  return main.size === size && anti.size === size;
}

function inequalitiesAllow(
  grid: number[][],
  row: number,
  col: number,
  num: number,
  inequalities: SudokuInequality[]
): boolean {
  for (const ineq of inequalities) {
    let a = 0;
    let b = 0;
    if (ineq.r1 === row && ineq.c1 === col) {
      a = num;
      b = grid[ineq.r2]?.[ineq.c2] ?? 0;
    } else if (ineq.r2 === row && ineq.c2 === col) {
      a = grid[ineq.r1]?.[ineq.c1] ?? 0;
      b = num;
    } else {
      continue;
    }
    if (a === 0 || b === 0) continue;
    if (ineq.gt ? !(a > b) : !(a < b)) return false;
  }
  return true;
}

function isValid(
  grid: number[][],
  row: number,
  col: number,
  num: number,
  size: number,
  boxH: number,
  boxW: number,
  diagonals: boolean,
  inequalities: SudokuInequality[]
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
  if (diagonals) {
    if (row === col) {
      for (let i = 0; i < size; i++) {
        if (i !== row && grid[i][i] === num) return false;
      }
    }
    if (row + col === size - 1) {
      for (let i = 0; i < size; i++) {
        if (i !== row && grid[i][size - 1 - i] === num) return false;
      }
    }
  }
  if (inequalities.length && !inequalitiesAllow(grid, row, col, num, inequalities)) {
    return false;
  }
  return true;
}

/**
 * Complete Sudoku X grid: backtracking with diagonal constraints and a
 * randomized digit order so batches are not identical.
 */
function generateCompleteDiagonalGrid(size: SudokuSize): number[][] {
  const { boxH, boxW } = SUDOKU_BOX[size];
  const grid = createEmptyGrid(size);
  const base = shuffleInPlace(Array.from({ length: size }, (_, i) => i + 1));

  function fill(pos: number): boolean {
    if (pos === size * size) return true;
    const row = (pos / size) | 0;
    const col = pos % size;
    const offset = (Math.random() * size) | 0;
    for (let i = 0; i < size; i++) {
      const num = base[(i + offset) % size]!;
      if (isValid(grid, row, col, num, size, boxH, boxW, true, [])) {
        grid[row][col] = num;
        if (fill(pos + 1)) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    for (let r = 0; r < size; r++) grid[r]!.fill(0);
    shuffleInPlace(base);
    if (fill(0) && hasUniqueDiagonals(grid)) {
      return grid.map((row) => [...row]);
    }
  }
  throw new Error(`Sudoku X: failed to build a complete ${size}×${size} diagonal grid`);
}

/** Count solutions up to `limit` (used for uniqueness on smaller boards). */
function countSolutions(
  grid: number[][],
  size: number,
  boxH: number,
  boxW: number,
  diagonals: boolean,
  inequalities: SudokuInequality[],
  limit: number = 2
): number {
  let count = 0;
  const nums = Array.from({ length: size }, (_, i) => i + 1);

  function solve(): boolean {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (grid[row][col] === 0) {
          for (const num of nums) {
            if (isValid(grid, row, col, num, size, boxH, boxW, diagonals, inequalities)) {
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

/** Target filled-cell ratio by difficulty (size-agnostic). Classic Sudoku only. */
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

/** All orthogonal adjacent pairs as inequalities consistent with `solution`. */
export function collectSolutionInequalities(solution: number[][]): SudokuInequality[] {
  const size = solution.length;
  const out: SudokuInequality[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = solution[r]![c]!;
      if (c + 1 < size) {
        const right = solution[r]![c + 1]!;
        out.push({ r1: r, c1: c, r2: r, c2: c + 1, gt: v > right });
      }
      if (r + 1 < size) {
        const below = solution[r + 1]![c]!;
        out.push({ r1: r, c1: c, r2: r + 1, c2: c, gt: v > below });
      }
    }
  }
  return out;
}

export function inequalitiesMatchSolution(
  solution: number[][],
  inequalities: SudokuInequality[]
): boolean {
  for (const ineq of inequalities) {
    const a = solution[ineq.r1]?.[ineq.c1];
    const b = solution[ineq.r2]?.[ineq.c2];
    if (a == null || b == null || a < 1 || b < 1) return false;
    if (Math.abs(ineq.r1 - ineq.r2) + Math.abs(ineq.c1 - ineq.c2) !== 1) return false;
    if (ineq.gt ? !(a > b) : !(a < b)) return false;
  }
  return true;
}

function removeNumbers(
  grid: number[][],
  clueCount: number,
  size: SudokuSize,
  checkUnique: boolean,
  diagonals: boolean,
  inequalities: SudokuInequality[]
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
      if (countSolutions(testGrid, size, boxH, boxW, diagonals, inequalities, 2) === 1) {
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
  /** Classic when absent/`standard`; `'x'` = Sudoku X; `'greater-than'` = inequalities. */
  variant?: 'standard' | 'x' | 'greater-than';
  /** Greater Than only: include a few prefilled digits (hybrid). Default false = inequality-only. */
  greaterThanHybrid?: boolean;
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
  const diagonals = opts.variant === 'x';
  const greaterThan = opts.variant === 'greater-than';

  if (greaterThan) {
    // ~65% of random grids have a unique full-inequality pattern; a few retries suffice.
    for (let attempt = 0; attempt < 24; attempt++) {
      const built = generateGreaterThanSudoku({
        difficulty,
        size,
        hybrid: opts.greaterThanHybrid === true,
        solution: generateCompleteGrid(size),
      });
      if (built) return built;
    }
    throw new Error('Greater Than: could not build a unique inequality-only puzzle');
  }

  const solution = diagonals ? generateCompleteDiagonalGrid(size) : generateCompleteGrid(size);
  const total = size * size;
  const { min, max } = getClueRatio(difficulty);
  const clueCount = Math.max(
    size, // at least one clue per row-ish floor
    Math.floor(total * (min + Math.random() * (max - min)))
  );

  // Uniqueness dig is expensive beyond 9×9 — skip for larger boards.
  const checkUnique = size <= 9;
  const puzzleGrid = removeNumbers(solution, clueCount, size, checkUnique, diagonals, []);

  const puzzle: SudokuPuzzle = {
    type: 'sudoku',
    grid: puzzleGrid,
    solution,
    difficulty,
    size,
  };
  if (diagonals) puzzle.variant = 'x';
  return puzzle;
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
