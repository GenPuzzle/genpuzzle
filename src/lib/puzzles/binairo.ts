/**
 * Binairo / Takuzu / Binary Puzzle generator.
 * Independent of Sudoku — balance, no triples, unique rows/columns.
 */

import type { DocumentBatchPuzzleMeta } from './types';

export type BinairoDifficulty = 'easy' | 'medium' | 'hard';
export type BinairoSymbols = '01' | 'xo';
export type BinairoSize = 4 | 6 | 8 | 10 | 12 | 14;

export const BINAIRO_SIZES: BinairoSize[] = [4, 6, 8, 10, 12, 14];

export type BinairoCell = 0 | 1 | null;

export interface BinairoPuzzle extends DocumentBatchPuzzleMeta {
  type: 'binairo';
  id?: string;
  rows: number;
  columns: number;
  /** Alias for square grids / layout helpers. */
  size: number;
  symbols: BinairoSymbols;
  difficulty: BinairoDifficulty;
  /** Playable grid: null = empty. */
  puzzle: BinairoCell[][];
  /** Complete valid solution (0/1 only). */
  solution: (0 | 1)[][];
  metadata?: {
    seed?: number;
    clueCount?: number;
    difficultyScore?: number;
    createdAt?: string;
  };
}

export interface BinairoGenerateOptions {
  rows?: number;
  columns?: number;
  size?: BinairoSize | number;
  difficulty?: BinairoDifficulty;
  symbols?: BinairoSymbols;
  seed?: number;
  timeBudgetMs?: number;
  signal?: { cancelled?: boolean };
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rand: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export function isBinairoSize(value: unknown): value is BinairoSize {
  return (
    value === 4 ||
    value === 6 ||
    value === 8 ||
    value === 10 ||
    value === 12 ||
    value === 14
  );
}

export function formatBinairoSymbol(
  value: 0 | 1 | null | undefined,
  symbols: BinairoSymbols = '01'
): string {
  if (value !== 0 && value !== 1) return '';
  if (symbols === 'xo') return value === 0 ? 'X' : 'O';
  return String(value);
}

function maxZeros(n: number): number {
  return Math.ceil(n / 2);
}

function maxOnes(n: number): number {
  return Math.ceil(n / 2);
}

function hasTriple(line: Array<0 | 1 | null>): boolean {
  for (let i = 0; i + 2 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const c = line[i + 2];
    if (a == null || b == null || c == null) continue;
    if (a === b && b === c) return true;
  }
  return false;
}

function lineKey(line: Array<0 | 1 | null>): string | null {
  if (line.some((v) => v == null)) return null;
  return line.join('');
}

function countsOf(line: Array<0 | 1 | null>): { zeros: number; ones: number; empty: number } {
  let zeros = 0;
  let ones = 0;
  let empty = 0;
  for (const v of line) {
    if (v === 0) zeros += 1;
    else if (v === 1) ones += 1;
    else empty += 1;
  }
  return { zeros, ones, empty };
}

function cloneBoard(board: BinairoCell[][]): BinairoCell[][] {
  return board.map((row) => row.slice());
}

function emptyBoard(rows: number, cols: number): BinairoCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => null));
}

/** Precomputed valid full lines for even N (balance + no triples). */
const validLineCache = new Map<number, Array<0 | 1>[]>();

export function getValidBinairoLines(n: number): Array<0 | 1>[] {
  const cached = validLineCache.get(n);
  if (cached) return cached;
  const out: Array<0 | 1>[] = [];
  const target0 = Math.floor(n / 2);
  const target1 = n - target0;
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const line: Array<0 | 1> = [];
    let zeros = 0;
    let ones = 0;
    let ok = true;
    for (let i = 0; i < n; i++) {
      const bit = ((mask >> (n - 1 - i)) & 1) as 0 | 1;
      line.push(bit);
      if (bit === 0) zeros += 1;
      else ones += 1;
      if (i >= 2 && line[i] === line[i - 1] && line[i - 1] === line[i - 2]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (n % 2 === 0) {
      if (zeros !== target0 || ones !== target1) continue;
    } else {
      if (Math.abs(zeros - ones) > 1) continue;
    }
    out.push(line);
  }
  validLineCache.set(n, out);
  return out;
}

function rowOf(board: BinairoCell[][], r: number): BinairoCell[] {
  return board[r]!;
}

function colOf(board: BinairoCell[][], c: number): BinairoCell[] {
  return board.map((row) => row[c]!);
}

function placementCreatesTriple(
  board: BinairoCell[][],
  r: number,
  c: number,
  value: 0 | 1
): boolean {
  const cols = board[0]?.length ?? 0;
  const rows = board.length;
  // Horizontal window around c
  for (let start = Math.max(0, c - 2); start <= c && start + 2 < cols; start++) {
    const a = start === c ? value : board[r]![start];
    const b = start + 1 === c ? value : board[r]![start + 1];
    const d = start + 2 === c ? value : board[r]![start + 2];
    if (a === value && b === value && d === value) return true;
  }
  // Vertical
  for (let start = Math.max(0, r - 2); start <= r && start + 2 < rows; start++) {
    const a = start === r ? value : board[start]![c];
    const b = start + 1 === r ? value : board[start + 1]![c];
    const d = start + 2 === r ? value : board[start + 2]![c];
    if (a === value && b === value && d === value) return true;
  }
  return false;
}

function canPlace(
  board: BinairoCell[][],
  r: number,
  c: number,
  value: 0 | 1
): boolean {
  if (board[r]![c] != null) return false;
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  if (placementCreatesTriple(board, r, c, value)) return false;

  const row = rowOf(board, r);
  const col = colOf(board, c);
  const rowCounts = countsOf(row);
  const colCounts = countsOf(col);
  if (value === 0) {
    if (rowCounts.zeros + 1 > maxZeros(cols)) return false;
    if (colCounts.zeros + 1 > maxZeros(rows)) return false;
  } else {
    if (rowCounts.ones + 1 > maxOnes(cols)) return false;
    if (colCounts.ones + 1 > maxOnes(rows)) return false;
  }

  // Completed row uniqueness
  const nextRow = row.slice() as BinairoCell[];
  nextRow[c] = value;
  const rk = lineKey(nextRow);
  if (rk) {
    for (let rr = 0; rr < rows; rr++) {
      if (rr === r) continue;
      if (lineKey(rowOf(board, rr)) === rk) return false;
    }
  }
  const nextCol = col.slice() as BinairoCell[];
  nextCol[r] = value;
  const ck = lineKey(nextCol);
  if (ck) {
    for (let cc = 0; cc < cols; cc++) {
      if (cc === c) continue;
      if (lineKey(colOf(board, cc)) === ck) return false;
    }
  }
  return true;
}

/** Apply forced logical moves; returns false if contradiction. */
export function propagateBinairo(board: BinairoCell[][]): boolean {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let changed = true;
  while (changed) {
    changed = false;

    // Triple patterns + balance on rows
    for (let r = 0; r < rows; r++) {
      const row = rowOf(board, r);
      // XX_ / _XX / X_X
      for (let c = 0; c < cols; c++) {
        if (row[c] != null) continue;
        for (const v of [0, 1] as const) {
          const other = (1 - v) as 0 | 1;
          // left pair
          if (c >= 2 && row[c - 1] === v && row[c - 2] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
          // right pair
          if (c + 2 < cols && row[c + 1] === v && row[c + 2] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
          // sandwich
          if (c > 0 && c + 1 < cols && row[c - 1] === v && row[c + 1] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
        }
      }
      // Balance fill
      const counts = countsOf(rowOf(board, r));
      if (counts.zeros === maxZeros(cols) && counts.empty > 0) {
        for (let c = 0; c < cols; c++) {
          if (board[r]![c] != null) continue;
          if (!canPlace(board, r, c, 1)) return false;
          board[r]![c] = 1;
          changed = true;
        }
      }
      if (counts.ones === maxOnes(cols) && counts.empty > 0) {
        for (let c = 0; c < cols; c++) {
          if (board[r]![c] != null) continue;
          if (!canPlace(board, r, c, 0)) return false;
          board[r]![c] = 0;
          changed = true;
        }
      }
    }

    // Same for columns
    for (let c = 0; c < cols; c++) {
      const col = colOf(board, c);
      for (let r = 0; r < rows; r++) {
        if (col[r] != null) continue;
        for (const v of [0, 1] as const) {
          const other = (1 - v) as 0 | 1;
          if (r >= 2 && col[r - 1] === v && col[r - 2] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
          if (r + 2 < rows && col[r + 1] === v && col[r + 2] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
          if (r > 0 && r + 1 < rows && col[r - 1] === v && col[r + 1] === v) {
            if (!canPlace(board, r, c, other)) return false;
            board[r]![c] = other;
            changed = true;
            break;
          }
        }
      }
      const counts = countsOf(colOf(board, c));
      if (counts.zeros === maxZeros(rows) && counts.empty > 0) {
        for (let r = 0; r < rows; r++) {
          if (board[r]![c] != null) continue;
          if (!canPlace(board, r, c, 1)) return false;
          board[r]![c] = 1;
          changed = true;
        }
      }
      if (counts.ones === maxOnes(rows) && counts.empty > 0) {
        for (let r = 0; r < rows; r++) {
          if (board[r]![c] != null) continue;
          if (!canPlace(board, r, c, 0)) return false;
          board[r]![c] = 0;
          changed = true;
        }
      }
    }

    // Forced single-candidate cells
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (board[r]![c] != null) continue;
        const z = canPlace(board, r, c, 0);
        const o = canPlace(board, r, c, 1);
        if (!z && !o) return false;
        if (z && !o) {
          board[r]![c] = 0;
          changed = true;
        } else if (!z && o) {
          board[r]![c] = 1;
          changed = true;
        }
      }
    }

    // Partial uniqueness: if two empties remain, ban duplicate of completed lines
    for (let r = 0; r < rows; r++) {
      const row = rowOf(board, r);
      const empties: number[] = [];
      for (let c = 0; c < cols; c++) if (row[c] == null) empties.push(c);
      if (empties.length !== 2) continue;
      const [c0, c1] = empties as [number, number];
      const options: Array<[0 | 1, 0 | 1]> = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ];
      const valid: Array<[0 | 1, 0 | 1]> = [];
      for (const [a, b] of options) {
        if (!canPlace(board, r, c0, a)) continue;
        board[r]![c0] = a;
        const okB = canPlace(board, r, c1, b);
        board[r]![c0] = null;
        if (!okB) continue;
        // Would completed row duplicate?
        const trial = row.slice() as BinairoCell[];
        trial[c0] = a;
        trial[c1] = b;
        if (hasTriple(trial)) continue;
        const key = lineKey(trial);
        let dup = false;
        if (key) {
          for (let rr = 0; rr < rows; rr++) {
            if (rr === r) continue;
            if (lineKey(rowOf(board, rr)) === key) {
              dup = true;
              break;
            }
          }
        }
        if (dup) continue;
        valid.push([a, b]);
      }
      if (valid.length === 0) return false;
      if (valid.length === 1) {
        const [a, b] = valid[0]!;
        board[r]![c0] = a;
        board[r]![c1] = b;
        changed = true;
      } else {
        // Force shared bits
        if (valid.every((p) => p[0] === valid[0]![0])) {
          board[r]![c0] = valid[0]![0];
          changed = true;
        }
        if (valid.every((p) => p[1] === valid[0]![1])) {
          board[r]![c1] = valid[0]![1];
          changed = true;
        }
      }
    }

    for (let c = 0; c < cols; c++) {
      const col = colOf(board, c);
      const empties: number[] = [];
      for (let r = 0; r < rows; r++) if (col[r] == null) empties.push(r);
      if (empties.length !== 2) continue;
      const [r0, r1] = empties as [number, number];
      const options: Array<[0 | 1, 0 | 1]> = [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ];
      const valid: Array<[0 | 1, 0 | 1]> = [];
      for (const [a, b] of options) {
        if (!canPlace(board, r0, c, a)) continue;
        board[r0]![c] = a;
        const okB = canPlace(board, r1, c, b);
        board[r0]![c] = null;
        if (!okB) continue;
        const trial = col.slice() as BinairoCell[];
        trial[r0] = a;
        trial[r1] = b;
        if (hasTriple(trial)) continue;
        const key = lineKey(trial);
        let dup = false;
        if (key) {
          for (let cc = 0; cc < cols; cc++) {
            if (cc === c) continue;
            if (lineKey(colOf(board, cc)) === key) {
              dup = true;
              break;
            }
          }
        }
        if (dup) continue;
        valid.push([a, b]);
      }
      if (valid.length === 0) return false;
      if (valid.length === 1) {
        const [a, b] = valid[0]!;
        board[r0]![c] = a;
        board[r1]![c] = b;
        changed = true;
      } else {
        if (valid.every((p) => p[0] === valid[0]![0])) {
          board[r0]![c] = valid[0]![0];
          changed = true;
        }
        if (valid.every((p) => p[1] === valid[0]![1])) {
          board[r1]![c] = valid[0]![1];
          changed = true;
        }
      }
    }
  }
  return true;
}

function findMrvCell(board: BinairoCell[][]): { r: number; c: number; opts: Array<0 | 1> } | null {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  let best: { r: number; c: number; opts: Array<0 | 1> } | null = null;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r]![c] != null) continue;
      const opts: Array<0 | 1> = [];
      if (canPlace(board, r, c, 0)) opts.push(0);
      if (canPlace(board, r, c, 1)) opts.push(1);
      if (opts.length === 0) return { r, c, opts: [] };
      if (!best || opts.length < best.opts.length) {
        best = { r, c, opts };
        if (opts.length === 1) return best;
      }
    }
  }
  return best;
}

function boardFull(board: BinairoCell[][]): boolean {
  for (const row of board) for (const v of row) if (v == null) return false;
  return true;
}

export function validateBinairoSolution(board: BinairoCell[][] | (0 | 1)[][]): boolean {
  const rows = board.length;
  if (rows === 0) return false;
  const cols = board[0]?.length ?? 0;
  if (cols === 0) return false;
  for (const row of board) {
    if (row.length !== cols) return false;
    for (const v of row) {
      if (v !== 0 && v !== 1) return false;
    }
  }
  for (let r = 0; r < rows; r++) {
    const row = rowOf(board as BinairoCell[][], r);
    const { zeros, ones } = countsOf(row);
    if (cols % 2 === 0) {
      if (zeros !== cols / 2 || ones !== cols / 2) return false;
    } else if (Math.abs(zeros - ones) > 1) return false;
    if (hasTriple(row)) return false;
  }
  for (let c = 0; c < cols; c++) {
    const col = colOf(board as BinairoCell[][], c);
    const { zeros, ones } = countsOf(col);
    if (rows % 2 === 0) {
      if (zeros !== rows / 2 || ones !== rows / 2) return false;
    } else if (Math.abs(zeros - ones) > 1) return false;
    if (hasTriple(col)) return false;
  }
  const rowKeys = new Set<string>();
  for (let r = 0; r < rows; r++) {
    const key = lineKey(rowOf(board as BinairoCell[][], r));
    if (!key || rowKeys.has(key)) return false;
    rowKeys.add(key);
  }
  const colKeys = new Set<string>();
  for (let c = 0; c < cols; c++) {
    const key = lineKey(colOf(board as BinairoCell[][], c));
    if (!key || colKeys.has(key)) return false;
    colKeys.add(key);
  }
  return true;
}

/** Count solutions up to `limit` (typically 2). Exhausted search budget → treat as `limit` (ambiguous). */
export function countBinairoSolutions(
  puzzle: BinairoCell[][],
  limit = 2,
  signal?: { cancelled?: boolean },
  budget?: { maxNodes?: number; deadline?: number }
): number {
  const board = cloneBoard(puzzle);
  if (!propagateBinairo(board)) return 0;
  let count = 0;
  let nodes = 0;
  const maxNodes = budget?.maxNodes ?? Number.POSITIVE_INFINITY;
  const digDeadline = budget?.deadline ?? Number.POSITIVE_INFINITY;

  const search = (): void => {
    if (signal?.cancelled || count >= limit) return;
    if (nodes > maxNodes || Date.now() > digDeadline) {
      // Safe for dig: keep the clue rather than risk a non-unique puzzle.
      count = Math.max(count, limit);
      return;
    }
    nodes += 1;
    if (!propagateBinairo(board)) return;
    if (boardFull(board)) {
      if (validateBinairoSolution(board)) count += 1;
      return;
    }
    const cell = findMrvCell(board);
    if (!cell || cell.opts.length === 0) return;
    const { r, c, opts } = cell;
    for (const v of opts) {
      if (count >= limit) return;
      const snapshot = cloneBoard(board);
      board[r]![c] = v;
      search();
      for (let rr = 0; rr < board.length; rr++) {
        for (let cc = 0; cc < (board[0]?.length ?? 0); cc++) {
          board[rr]![cc] = snapshot[rr]![cc]!;
        }
      }
    }
  };

  search();
  return count;
}

export function solveBinairo(
  puzzle: BinairoCell[][],
  signal?: { cancelled?: boolean }
): (0 | 1)[][] | null {
  const board = cloneBoard(puzzle);
  if (!propagateBinairo(board)) return null;

  const search = (): boolean => {
    if (signal?.cancelled) return false;
    if (!propagateBinairo(board)) return false;
    if (boardFull(board)) return validateBinairoSolution(board);
    const cell = findMrvCell(board);
    if (!cell || cell.opts.length === 0) return false;
    const { r, c } = cell;
    const opts = [...cell.opts];
    for (const v of opts) {
      const snapshot = cloneBoard(board);
      board[r]![c] = v;
      if (propagateBinairo(board) && search()) return true;
      for (let rr = 0; rr < board.length; rr++) {
        for (let cc = 0; cc < (board[0]?.length ?? 0); cc++) {
          board[rr]![cc] = snapshot[rr]![cc]!;
        }
      }
    }
    return false;
  };

  if (!search()) return null;
  return board.map((row) => row.map((v) => v as 0 | 1));
}

/** Whether pattern can be placed as row `r` without breaking column constraints so far. */
function rowPatternFits(
  board: BinairoCell[][],
  r: number,
  pattern: Array<0 | 1>,
  rows: number,
  cols: number
): boolean {
  const remainingAfter = rows - r - 1;
  const target0 = Math.floor(rows / 2);
  const target1 = rows - target0;

  for (let c = 0; c < cols; c++) {
    const v = pattern[c]!;
    if (board[r]![c] != null && board[r]![c] !== v) return false;

    // Vertical triple ending at this row
    if (r >= 2 && board[r - 1]![c] === v && board[r - 2]![c] === v) return false;

    let zeros = 0;
    let ones = 0;
    for (let rr = 0; rr < r; rr++) {
      if (board[rr]![c] === 0) zeros += 1;
      else ones += 1;
    }
    if (v === 0) zeros += 1;
    else ones += 1;

    if (zeros > target0 || ones > target1) return false;
    if (zeros + remainingAfter < target0) return false;
    if (ones + remainingAfter < target1) return false;
  }

  // Completed columns must stay unique
  if (remainingAfter === 0) {
    const keys = new Set<string>();
    for (let c = 0; c < cols; c++) {
      const col: Array<0 | 1> = [];
      for (let rr = 0; rr < rows; rr++) {
        const cell = rr === r ? pattern[c]! : (board[rr]![c] as 0 | 1);
        col.push(cell);
      }
      if (hasTriple(col)) return false;
      const key = col.join('');
      if (keys.has(key)) return false;
      keys.add(key);
    }
  }

  return true;
}

/**
 * Build a full valid Binairo grid.
 * Large sizes must avoid wide early branching (6^10 explodes on 14×14).
 * Strategy: greedy random row picks + many restarts; backtrack only on the last rows.
 */
function generateCompleteSolution(
  rows: number,
  cols: number,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): (0 | 1)[][] | null {
  const rowPatterns = getValidBinairoLines(cols);
  if (rowPatterns.length === 0) return null;
  const colPatterns = getValidBinairoLines(rows);

  const timedOut = () => Boolean(signal?.cancelled || Date.now() > deadline);

  /** Each column prefix must still match at least one valid full column line. */
  const columnsExtendable = (board: BinairoCell[][], filledRows: number): boolean => {
    for (let c = 0; c < cols; c++) {
      let matches = 0;
      for (const pattern of colPatterns) {
        let ok = true;
        for (let r = 0; r < filledRows; r++) {
          if (board[r]![c] !== pattern[r]) {
            ok = false;
            break;
          }
        }
        if (ok) {
          matches += 1;
          if (matches >= 2) break; // enough for possible uniqueness later
        }
      }
      if (matches === 0) return false;
    }

    // Identical column prefixes need ≥2 distinct completions
    for (let c1 = 0; c1 < cols; c1++) {
      for (let c2 = c1 + 1; c2 < cols; c2++) {
        let same = true;
        for (let r = 0; r < filledRows; r++) {
          if (board[r]![c1] !== board[r]![c2]) {
            same = false;
            break;
          }
        }
        if (!same) continue;
        let distinct = 0;
        const seen = new Set<string>();
        for (const pattern of colPatterns) {
          let ok = true;
          for (let r = 0; r < filledRows; r++) {
            if (board[r]![c1] !== pattern[r]) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
          const key = pattern.join('');
          if (!seen.has(key)) {
            seen.add(key);
            distinct += 1;
            if (distinct >= 2) break;
          }
        }
        if (distinct < 2) return false;
      }
    }
    return true;
  };

  const collectCandidates = (
    board: BinairoCell[][],
    r: number,
    usedRows: Set<string>
  ): Array<0 | 1>[] => {
    const out: Array<0 | 1>[] = [];
    for (const pattern of rowPatterns) {
      const key = pattern.join('');
      if (usedRows.has(key)) continue;
      if (!rowPatternFits(board, r, pattern, rows, cols)) continue;
      out.push(pattern);
    }

    // Cheap identical-prefix uniqueness prune (no full column-pattern scan)
    if (out.length === 0 || r + 1 < 2) return out;

    const filtered: Array<0 | 1>[] = [];
    for (const pattern of out) {
      for (let c = 0; c < cols; c++) board[r]![c] = pattern[c]!;
      let ok = true;
      // If two columns are identical through this row and remaining rows < 1... handled in rowPatternFits
      // If identical and only one distinct bit pattern can finish — approximate: when few rows left,
      // require columnsExtendable.
      if (rows - (r + 1) <= 3) {
        ok = columnsExtendable(board, r + 1);
      } else {
        // Fast check: identical columns still have room to diverge
        for (let c1 = 0; c1 < cols && ok; c1++) {
          for (let c2 = c1 + 1; c2 < cols; c2++) {
            let same = true;
            for (let rr = 0; rr <= r; rr++) {
              if (board[rr]![c1] !== board[rr]![c2]) {
                same = false;
                break;
              }
            }
            if (same && rows - (r + 1) === 0) {
              ok = false;
              break;
            }
          }
        }
      }
      for (let c = 0; c < cols; c++) board[r]![c] = null;
      if (ok) filtered.push(pattern);
    }
    return filtered;
  };

  const backtrackTail = (
    board: BinairoCell[][],
    r: number,
    usedRows: Set<string>
  ): boolean => {
    if (timedOut()) return false;
    if (r >= rows) return validateBinairoSolution(board);
    const candidates = collectCandidates(board, r, usedRows);
    shuffleInPlace(candidates, rand);
    for (const pattern of candidates) {
      const key = pattern.join('');
      for (let c = 0; c < cols; c++) board[r]![c] = pattern[c]!;
      usedRows.add(key);
      if (backtrackTail(board, r + 1, usedRows)) return true;
      usedRows.delete(key);
      for (let c = 0; c < cols; c++) board[r]![c] = null;
      if (timedOut()) return false;
    }
    return false;
  };

  // Greedy until the last `tailRows`, then exhaustive backtrack on the tail.
  const tailRows = rows >= 14 ? 4 : rows >= 12 ? 3 : 2;
  const greedyRows = Math.max(0, rows - tailRows);
  const maxRestarts =
    rows >= 14 ? 8000 : rows >= 12 ? 3000 : rows >= 10 ? 1000 : 200;

  for (let restart = 0; restart < maxRestarts; restart++) {
    if (timedOut()) break;
    const board = emptyBoard(rows, cols);
    const usedRows = new Set<string>();
    let ok = true;

    for (let r = 0; r < greedyRows; r++) {
      const candidates = collectCandidates(board, r, usedRows);
      if (candidates.length === 0) {
        ok = false;
        break;
      }
      const pattern = candidates[Math.floor(rand() * candidates.length)]!;
      const key = pattern.join('');
      for (let c = 0; c < cols; c++) board[r]![c] = pattern[c]!;
      usedRows.add(key);
    }

    if (!ok) continue;
    if (backtrackTail(board, greedyRows, usedRows)) {
      return board.map((row) => row.map((v) => v as 0 | 1));
    }
  }

  // Fallback: seed a few greedy rows, finish with cell MRV
  const board = emptyBoard(rows, cols);
  const usedSeed = new Set<string>();
  const seedRows = Math.min(rows - 2, Math.max(1, Math.floor(rows / 2)));
  for (let r = 0; r < seedRows; r++) {
    if (timedOut()) return null;
    const candidates = collectCandidates(board, r, usedSeed);
    if (candidates.length === 0) break;
    const pattern = candidates[Math.floor(rand() * candidates.length)]!;
    usedSeed.add(pattern.join(''));
    for (let c = 0; c < cols; c++) board[r]![c] = pattern[c]!;
  }

  const search = (target: BinairoCell[][]): boolean => {
    if (timedOut()) return false;
    if (!propagateBinairo(target)) return false;
    if (boardFull(target)) return validateBinairoSolution(target);
    const cell = findMrvCell(target);
    if (!cell || cell.opts.length === 0) return false;
    const opts = [...cell.opts];
    shuffleInPlace(opts, rand);
    const { r, c } = cell;
    for (const v of opts) {
      const snapshot = cloneBoard(target);
      target[r]![c] = v;
      if (propagateBinairo(target) && search(target)) return true;
      for (let rr = 0; rr < rows; rr++) {
        for (let cc = 0; cc < cols; cc++) target[rr]![cc] = snapshot[rr]![cc]!;
      }
      if (timedOut()) return false;
    }
    return false;
  };

  if (search(board)) return board.map((row) => row.map((v) => v as 0 | 1));

  const fresh = emptyBoard(rows, cols);
  return search(fresh) ? fresh.map((row) => row.map((v) => v as 0 | 1)) : null;
}

interface DigResult {
  puzzle: BinairoCell[][];
  clueCount: number;
  score: number;
}

function estimateDifficultyScore(puzzle: BinairoCell[][]): number {
  // Lightweight heuristic: fewer clues + more forced uniqueness pressure → higher score.
  let clues = 0;
  let empty = 0;
  for (const row of puzzle) {
    for (const v of row) {
      if (v == null) empty += 1;
      else clues += 1;
    }
  }
  const total = clues + empty;
  const density = total === 0 ? 1 : clues / total;
  // Attempt a shallow logical fill count
  const trial = cloneBoard(puzzle);
  propagateBinairo(trial);
  let forced = 0;
  for (let r = 0; r < trial.length; r++) {
    for (let c = 0; c < (trial[0]?.length ?? 0); c++) {
      if (puzzle[r]![c] == null && trial[r]![c] != null) forced += 1;
    }
  }
  const remaining = empty - forced;
  return Math.round((1 - density) * 40 + remaining * 1.2 + Math.max(0, remaining - forced) * 0.5);
}

function digClues(
  solution: (0 | 1)[][],
  difficulty: BinairoDifficulty,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): DigResult | null {
  const rows = solution.length;
  const cols = solution[0]?.length ?? 0;
  const total = rows * cols;
  const puzzle = solution.map((row) => row.slice() as BinairoCell[]);
  const cells: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  shuffleInPlace(cells, rand);

  // Hard digs stop near target — going much lower makes uniqueness checks explode.
  const targetClueRatio =
    difficulty === 'easy' ? 0.48 : difficulty === 'medium' ? 0.36 : 0.30;
  const minClues = Math.max(
    4,
    Math.floor(total * (difficulty === 'hard' ? targetClueRatio - 0.04 : targetClueRatio - 0.08))
  );
  const targetClues = Math.floor(total * targetClueRatio);
  let clueCount = total;

  const nodeBudget =
    total >= 196 ? 6000 : total >= 144 ? 5000 : total >= 100 ? 4000 : 8000;

  for (const { r, c } of cells) {
    if (signal?.cancelled || Date.now() > deadline) break;
    if (clueCount <= minClues) break;
    // Once at target, only keep digging briefly for hard/medium.
    if (clueCount <= targetClues) {
      if (difficulty === 'easy') break;
      if (difficulty === 'medium' && rand() < 0.55) break;
      if (difficulty === 'hard' && rand() < 0.7) break;
    }

    const saved = puzzle[r]![c];
    if (saved == null) continue;
    puzzle[r]![c] = null;
    const solutions = countBinairoSolutions(puzzle, 2, signal, {
      maxNodes: nodeBudget,
      deadline,
    });
    if (solutions !== 1) {
      puzzle[r]![c] = saved;
      continue;
    }
    clueCount -= 1;
  }

  if (countBinairoSolutions(puzzle, 2, signal, { maxNodes: nodeBudget * 3, deadline }) !== 1) {
    return null;
  }
  return { puzzle, clueCount, score: estimateDifficultyScore(puzzle) };
}

function scoreMatchesDifficulty(score: number, difficulty: BinairoDifficulty): boolean {
  if (difficulty === 'easy') return score <= 28;
  if (difficulty === 'medium') return score > 18 && score <= 42;
  return score > 30;
}

export function validateBinairoPuzzle(
  puzzle: BinairoPuzzle
): { ok: true } | { ok: false; reason: string } {
  const { rows, columns, puzzle: grid, solution } = puzzle;
  if (grid.length !== rows || solution.length !== rows) {
    return { ok: false, reason: 'row count mismatch' };
  }
  for (let r = 0; r < rows; r++) {
    if ((grid[r]?.length ?? 0) !== columns || (solution[r]?.length ?? 0) !== columns) {
      return { ok: false, reason: 'column count mismatch' };
    }
    for (let c = 0; c < columns; c++) {
      const clue = grid[r]![c];
      const sol = solution[r]![c];
      if (sol !== 0 && sol !== 1) return { ok: false, reason: `bad solution at ${r},${c}` };
      if (clue != null && clue !== 0 && clue !== 1) {
        return { ok: false, reason: `bad clue at ${r},${c}` };
      }
      if (clue != null && clue !== sol) {
        return { ok: false, reason: `clue mismatch at ${r},${c}` };
      }
    }
  }
  if (!validateBinairoSolution(solution)) {
    return { ok: false, reason: 'invalid solution' };
  }
  if (countBinairoSolutions(grid, 2) !== 1) {
    return { ok: false, reason: 'puzzle is not uniquely solvable' };
  }
  return { ok: true };
}

export function binairoSignature(puzzle: BinairoPuzzle): string {
  const p = puzzle.puzzle.map((row) => row.map((v) => (v == null ? '.' : String(v))).join('')).join('/');
  const s = puzzle.solution.map((row) => row.join('')).join('/');
  return `${puzzle.rows}x${puzzle.columns}:${p}|${s}`;
}

export function generateBinairo(options: BinairoGenerateOptions = {}): BinairoPuzzle {
  const sizeOpt = options.size;
  const rows = Math.max(
    4,
    Math.min(16, Math.round(options.rows ?? (typeof sizeOpt === 'number' ? sizeOpt : 10)))
  );
  const columns = Math.max(
    4,
    Math.min(16, Math.round(options.columns ?? (typeof sizeOpt === 'number' ? sizeOpt : rows)))
  );
  const difficulty = options.difficulty ?? 'medium';
  const symbols = options.symbols ?? '01';
  const seed = (options.seed ?? Date.now()) >>> 0;
  const rand = mulberry32(seed);
  const timeBudgetMs =
    options.timeBudgetMs ??
    (rows >= 14 ? 28000 : rows >= 12 ? (difficulty === 'hard' ? 12000 : 10000) : difficulty === 'hard' ? 9000 : 7000);
  const deadline = Date.now() + timeBudgetMs;

  // Warm line cache
  getValidBinairoLines(columns);
  getValidBinairoLines(rows);

  let lastReason = 'unknown';
  const maxAttempts = rows >= 14 ? 40 : difficulty === 'hard' ? 16 : 24;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.cancelled) throw new Error('Binairo generation cancelled.');
    if (Date.now() > deadline) break;

    // Solutions are cheap now; dig needs most of the budget on hard/large grids.
    const solutionShare = rows >= 14 ? 0.35 : 0.25;
    const solution = generateCompleteSolution(
      rows,
      columns,
      mulberry32((seed + attempt * 9973) >>> 0),
      Math.min(deadline, Date.now() + Math.floor(timeBudgetMs * solutionShare)),
      options.signal
    );
    if (!solution || !validateBinairoSolution(solution)) {
      lastReason = 'solution generation failed';
      continue;
    }

    const dug = digClues(
      solution,
      difficulty,
      mulberry32((seed + attempt * 7919) >>> 0),
      deadline,
      options.signal
    );
    if (!dug) {
      lastReason = 'clue digging failed';
      continue;
    }

    // Soft difficulty gate — only reject obvious mismatches on the first few tries.
    if (attempt < 3 && !scoreMatchesDifficulty(dug.score, difficulty)) {
      if (difficulty === 'hard' && dug.score < 20) {
        lastReason = 'difficulty too low';
        continue;
      }
      if (difficulty === 'easy' && dug.score > 40) {
        lastReason = 'difficulty too high';
        continue;
      }
    }

    const puzzle: BinairoPuzzle = {
      type: 'binairo',
      id: `binairo-${seed}-${attempt}`,
      rows,
      columns,
      size: Math.max(rows, columns),
      symbols,
      difficulty,
      puzzle: dug.puzzle,
      solution,
      metadata: {
        seed,
        clueCount: dug.clueCount,
        difficultyScore: dug.score,
        createdAt: new Date().toISOString(),
      },
      puzzleNumber: 1,
    };

    const check = validateBinairoPuzzle(puzzle);
    if (!check.ok) {
      lastReason = check.reason;
      continue;
    }
    return puzzle;
  }

  throw new Error(
    `Unable to generate a valid ${rows}×${columns} Binairo puzzle (${lastReason}).`
  );
}
