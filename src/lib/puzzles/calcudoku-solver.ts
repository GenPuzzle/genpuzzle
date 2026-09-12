/**
 * Independent Calcudoku (KenKen-style) solver.
 * Latin-square rows/columns, cage arithmetic, and unique digits inside each cage.
 * Stops as soon as `limit` solutions are found.
 */

import type { CalcudokuOperation, Position } from './types';

export interface CalcudokuPuzzleInput {
  size: number;
  cages: Array<{
    cells: Position[];
    operation: string;
    target: number;
  }>;
  /** Optional givens; 0 = empty. Generated Easy Calcudoku boards are fully empty. */
  grid?: number[][];
}

export interface CalcudokuSolveResult {
  count: number;
  solution: number[][] | null;
  timedOut: boolean;
}

interface CageState {
  cells: number[];
  operation: CalcudokuOperation;
  target: number;
  usedMask: number;
  filled: number;
  sum: number;
  prod: number;
}

function popcount(n: number): number {
  let c = 0;
  let x = n >>> 0;
  while (x) {
    x &= x - 1;
    c++;
  }
  return c;
}

function lowestBitValue(bits: number): number {
  return Math.log2(bits & -bits);
}

function parseOp(op: string): CalcudokuOperation {
  if (op === '-' || op === '−' || op === 'minus') return '-';
  if (op === '*' || op === '×' || op === 'x' || op === 'mul') return '*';
  if (op === '/' || op === '÷' || op === 'div') return '/';
  return '+';
}

function nodeBudget(size: number): number {
  if (size <= 4) return 50_000;
  if (size <= 5) return 120_000;
  if (size <= 6) return 350_000;
  if (size <= 7) return 800_000;
  if (size <= 8) return 2_500_000;
  return 8_000_000;
}

function idxOf(row: number, col: number, size: number): number {
  return row * size + col;
}

function sumSmallest(mask: number, count: number): number {
  let sum = 0;
  let left = count;
  let remaining = mask;
  while (remaining && left > 0) {
    const v = lowestBitValue(remaining);
    remaining &= remaining - 1;
    sum += v;
    left -= 1;
  }
  return left > 0 ? Infinity : sum;
}

function sumLargest(mask: number, count: number): number {
  if (count <= 0) return 0;
  const vals: number[] = [];
  let remaining = mask;
  while (remaining) {
    const v = lowestBitValue(remaining);
    remaining &= remaining - 1;
    vals.push(v);
  }
  if (vals.length < count) return -Infinity;
  let sum = 0;
  for (let i = vals.length - 1, k = 0; k < count; i--, k++) sum += vals[i]!;
  return sum;
}

function prodSmallest(mask: number, count: number): number {
  if (count <= 0) return 1;
  let prod = 1;
  let left = count;
  let remaining = mask;
  while (remaining && left > 0) {
    const v = lowestBitValue(remaining);
    remaining &= remaining - 1;
    prod *= v;
    left -= 1;
  }
  return left > 0 ? Infinity : prod;
}

function prodLargest(mask: number, count: number): number {
  if (count <= 0) return 1;
  const vals: number[] = [];
  let remaining = mask;
  while (remaining) {
    const v = lowestBitValue(remaining);
    remaining &= remaining - 1;
    vals.push(v);
  }
  if (vals.length < count) return 0;
  let prod = 1;
  for (let i = vals.length - 1, k = 0; k < count; i--, k++) prod *= vals[i]!;
  return prod;
}

function buildCages(size: number, cages: CalcudokuPuzzleInput['cages']): {
  states: CageState[];
  cellCage: Int16Array;
} {
  const cellCage = new Int16Array(size * size);
  cellCage.fill(-1);
  const states: CageState[] = cages.map((cage, cageIndex) => {
    const cells = cage.cells.map((cell) => idxOf(cell.row, cell.col, size));
    for (const idx of cells) cellCage[idx] = cageIndex;
    return {
      cells,
      operation: parseOp(cage.operation),
      target: cage.target,
      usedMask: 0,
      filled: 0,
      sum: 0,
      prod: 1,
    };
  });
  return { states, cellCage };
}

export function countCalcudokuSolutions(
  puzzle: CalcudokuPuzzleInput,
  limit = 2,
  preferredGrid?: number[][]
): CalcudokuSolveResult {
  const size = puzzle.size;
  const cap = Math.max(1, limit);
  if (!Number.isInteger(size) || size < 2 || size > 16) {
    return { count: 0, solution: null, timedOut: false };
  }

  const { states, cellCage } = buildCages(size, puzzle.cages);
  for (let i = 0; i < size * size; i++) {
    if (cellCage[i] < 0) return { count: 0, solution: null, timedOut: false };
  }

  const allMask = ((1 << (size + 1)) - 2) >>> 0;
  const grid = new Int8Array(size * size);
  const cand = new Uint16Array(size * size);
  const rowMask = new Uint16Array(size);
  const colMask = new Uint16Array(size);
  cand.fill(allMask);

  const assign = (idx: number, value: number): boolean => {
    const bit = 1 << value;
    if (!(cand[idx] & bit) && grid[idx] !== value) return false;
    if (grid[idx] === value) return true;
    if (grid[idx] !== 0) return false;

    const r = (idx / size) | 0;
    const c = idx % size;
    if (rowMask[r] & bit || colMask[c] & bit) return false;
    const cage = states[cellCage[idx]];
    if (cage.usedMask & bit) return false;

    grid[idx] = value;
    cand[idx] = 0;
    rowMask[r] |= bit;
    colMask[c] |= bit;
    cage.usedMask |= bit;
    cage.filled += 1;
    cage.sum += value;
    cage.prod *= value;

    const clear = (peer: number) => {
      if (peer === idx || grid[peer] !== 0) return true;
      if (cand[peer] & bit) {
        cand[peer] &= ~bit;
        if (cand[peer] === 0) return false;
      }
      return true;
    };

    for (let cc = 0; cc < size; cc++) {
      if (!clear(idxOf(r, cc, size))) return false;
    }
    for (let rr = 0; rr < size; rr++) {
      if (!clear(idxOf(rr, c, size))) return false;
    }
    for (const peer of cage.cells) {
      if (!clear(peer)) return false;
    }

    if (cage.operation === '-' && cage.cells.length === 2) {
      const other = cage.cells[0] === idx ? cage.cells[1]! : cage.cells[0]!;
      if (grid[other] === 0) {
        let partner = 0;
        const hi = value + cage.target;
        const lo = value - cage.target;
        if (hi >= 1 && hi <= size) partner |= 1 << hi;
        if (lo >= 1 && lo <= size) partner |= 1 << lo;
        cand[other] &= partner;
        if (cand[other] === 0) return false;
      } else if (Math.abs(grid[other] - value) !== cage.target) {
        return false;
      }
    }

    if (cage.operation === '/' && cage.cells.length === 2) {
      const other = cage.cells[0] === idx ? cage.cells[1]! : cage.cells[0]!;
      if (grid[other] === 0) {
        let partner = 0;
        const mul = value * cage.target;
        if (mul >= 1 && mul <= size) partner |= 1 << mul;
        if (cage.target !== 0 && value % cage.target === 0) {
          const div = value / cage.target;
          if (div >= 1 && div <= size && Number.isInteger(div)) partner |= 1 << div;
        }
        cand[other] &= partner;
        if (cand[other] === 0) return false;
      } else {
        const hi = Math.max(grid[other], value);
        const lo = Math.min(grid[other], value);
        if (lo === 0 || hi % lo !== 0 || hi / lo !== cage.target) return false;
      }
    }

    if (cage.operation === '*') {
      if (cage.prod > cage.target) return false;
      if (cage.prod !== 0 && cage.target % cage.prod !== 0) return false;
    }

    if (cage.filled === cage.cells.length) {
      if (cage.operation === '+' && cage.sum !== cage.target) return false;
      if (cage.operation === '*' && cage.prod !== cage.target) return false;
    }
    return true;
  };

  const candidatesOf = (idx: number): number => {
    if (grid[idx] !== 0) return 0;
    const cage = states[cellCage[idx]];
    let bits = cand[idx];
    if (!bits) return 0;
    const emptyAfter = cage.cells.length - cage.filled - 1;
    const unused = allMask & ~cage.usedMask;
    let allowed = 0;
    let remaining = bits;
    while (remaining) {
      const v = lowestBitValue(remaining);
      remaining &= remaining - 1;
      const bit = 1 << v;
      if (!(unused & bit)) continue;
      if (cage.operation === '+') {
        const rem = cage.target - cage.sum - v;
        if (emptyAfter === 0) {
          if (rem === 0) allowed |= bit;
          continue;
        }
        const rest = unused & ~bit;
        const min = sumSmallest(rest, emptyAfter);
        const max = sumLargest(rest, emptyAfter);
        if (rem >= min && rem <= max) allowed |= bit;
      } else if (cage.operation === '-') {
        if (cage.cells.length !== 2) continue;
        const other = cage.cells[0] === idx ? cage.cells[1]! : cage.cells[0]!;
        if (grid[other] !== 0) {
          if (Math.abs(grid[other] - v) === cage.target) allowed |= bit;
        } else {
          const hi = v + cage.target;
          const lo = v - cage.target;
          if (
            (hi >= 1 && hi <= size && (cand[other] & (1 << hi))) ||
            (lo >= 1 && lo <= size && (cand[other] & (1 << lo)))
          ) {
            allowed |= bit;
          }
        }
      } else if (cage.operation === '*') {
        if (v < 1 || cage.prod * v > cage.target) continue;
        if (cage.prod * v !== 0 && cage.target % (cage.prod * v) !== 0) continue;
        const rem = cage.target / (cage.prod * v);
        if (emptyAfter === 0) {
          if (rem === 1) allowed |= bit;
          continue;
        }
        const rest = unused & ~bit;
        const min = prodSmallest(rest, emptyAfter);
        const max = prodLargest(rest, emptyAfter);
        if (rem >= min && rem <= max) allowed |= bit;
      } else if (cage.operation === '/') {
        if (cage.cells.length !== 2) continue;
        const other = cage.cells[0] === idx ? cage.cells[1]! : cage.cells[0]!;
        if (grid[other] !== 0) {
          const hi = Math.max(grid[other], v);
          const lo = Math.min(grid[other], v);
          if (lo > 0 && hi % lo === 0 && hi / lo === cage.target) allowed |= bit;
        } else {
          const mul = v * cage.target;
          const div = cage.target !== 0 && v % cage.target === 0 ? v / cage.target : 0;
          if (
            (mul >= 1 && mul <= size && (cand[other] & (1 << mul))) ||
            (div >= 1 && div <= size && Number.isInteger(div) && (cand[other] & (1 << div)))
          ) {
            allowed |= bit;
          }
        }
      } else {
        allowed |= bit;
      }
    }
    return allowed;
  };

  const givens = puzzle.grid;
  if (givens) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = givens[r]?.[c] ?? 0;
        if (!v) continue;
        if (v < 1 || v > size) return { count: 0, solution: null, timedOut: false };
        if (!assign(idxOf(r, c, size), v)) {
          return { count: 0, solution: null, timedOut: false };
        }
      }
    }
  }

  const startedAt = Date.now();
  const wallMs = size >= 9 ? 3500 : 0;
  let count = 0;
  let nodes = 0;
  let timedOut = false;
  const budget = nodeBudget(size);
  let firstSolution: number[][] | null = null;

  const snapshot = (): number[][] => {
    const out: number[][] = [];
    for (let r = 0; r < size; r++) {
      const row: number[] = [];
      for (let c = 0; c < size; c++) row.push(grid[idxOf(r, c, size)]);
      out.push(row);
    }
    return out;
  };

  const pushState = () => ({
    grid: Int8Array.from(grid),
    cand: Uint16Array.from(cand),
    rowMask: Uint16Array.from(rowMask),
    colMask: Uint16Array.from(colMask),
    cages: states.map((cage) => ({
      usedMask: cage.usedMask,
      filled: cage.filled,
      sum: cage.sum,
      prod: cage.prod,
    })),
  });

  const popState = (saved: ReturnType<typeof pushState>) => {
    grid.set(saved.grid);
    cand.set(saved.cand);
    rowMask.set(saved.rowMask);
    colMask.set(saved.colMask);
    for (let i = 0; i < states.length; i++) {
      states[i]!.usedMask = saved.cages[i]!.usedMask;
      states[i]!.filled = saved.cages[i]!.filled;
      states[i]!.sum = saved.cages[i]!.sum;
      states[i]!.prod = saved.cages[i]!.prod;
    }
  };

  const propagate = (): boolean => {
    let changed = true;
    while (changed) {
      changed = false;
      for (let idx = 0; idx < grid.length; idx++) {
        if (grid[idx] !== 0) continue;
        const bits = candidatesOf(idx);
        cand[idx] = bits as number;
        const nBits = popcount(bits);
        if (nBits === 0) return false;
        if (nBits === 1) {
          if (!assign(idx, lowestBitValue(bits))) return false;
          changed = true;
        }
      }
      if (changed) continue;

      for (let r = 0; r < size; r++) {
        for (let v = 1; v <= size; v++) {
          const bit = 1 << v;
          if (rowMask[r] & bit) continue;
          let found = -1;
          for (let c = 0; c < size; c++) {
            const idx = idxOf(r, c, size);
            if (grid[idx] !== 0) continue;
            if (cand[idx] & bit) {
              if (found >= 0) {
                found = -2;
                break;
              }
              found = idx;
            }
          }
          if (found === -1) return false;
          if (found >= 0) {
            if (!assign(found, v)) return false;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
      if (changed) continue;

      for (let c = 0; c < size; c++) {
        for (let v = 1; v <= size; v++) {
          const bit = 1 << v;
          if (colMask[c] & bit) continue;
          let found = -1;
          for (let r = 0; r < size; r++) {
            const idx = idxOf(r, c, size);
            if (grid[idx] !== 0) continue;
            if (cand[idx] & bit) {
              if (found >= 0) {
                found = -2;
                break;
              }
              found = idx;
            }
          }
          if (found === -1) return false;
          if (found >= 0) {
            if (!assign(found, v)) return false;
            changed = true;
            break;
          }
        }
        if (changed) break;
      }
    }
    return true;
  };

  const search = (): boolean => {
    if (timedOut) return true;
    if (++nodes > budget || (wallMs > 0 && (nodes & 255) === 0 && Date.now() - startedAt > wallMs)) {
      timedOut = true;
      return true;
    }
    if (!propagate()) return false;

    let bestIdx = -1;
    let bestBits = 0;
    let bestCount = 99;
    let empty = 0;
    for (let idx = 0; idx < grid.length; idx++) {
      if (grid[idx] !== 0) continue;
      empty += 1;
      const bits = cand[idx];
      const nBits = popcount(bits);
      if (nBits === 0) return false;
      if (nBits < bestCount) {
        bestCount = nBits;
        bestIdx = idx;
        bestBits = bits;
        if (nBits === 1) break;
      }
    }
    if (empty === 0) {
      count += 1;
      if (!firstSolution) firstSolution = snapshot();
      return count >= cap;
    }

    let remaining = bestBits;
    const prefer = preferredGrid
      ? preferredGrid[(bestIdx / size) | 0]![bestIdx % size]!
      : 0;
    const tryValues: number[] = [];
    while (remaining) {
      const v = lowestBitValue(remaining);
      remaining &= remaining - 1;
      tryValues.push(v);
    }
    if (prefer) {
      const at = tryValues.indexOf(prefer);
      if (at > 0) {
        tryValues.splice(at, 1);
        tryValues.unshift(prefer);
      }
    }
    for (const v of tryValues) {
      const saved = pushState();
      if (assign(bestIdx, v) && search()) {
        popState(saved);
        return true;
      }
      popState(saved);
    }
    return false;
  };

  search();
  if (timedOut && count < cap) {
    return { count: Math.max(count, 2), solution: firstSolution, timedOut: true };
  }
  return { count, solution: firstSolution, timedOut: false };
}

export function solveCalcudoku(puzzle: CalcudokuPuzzleInput): number[][] | null {
  const result = countCalcudokuSolutions(puzzle, 1);
  return result.timedOut ? null : result.solution;
}

export function cagesAreOrthogonallyConnected(cages: CalcudokuPuzzleInput['cages']): boolean {
  const dirs: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const cage of cages) {
    if (cage.cells.length === 0) return false;
    const key = (p: Position) => `${p.row},${p.col}`;
    const set = new Set(cage.cells.map(key));
    if (set.size !== cage.cells.length) return false;
    const start = cage.cells[0];
    const seen = new Set<string>([key(start)]);
    const queue: Position[] = [start];
    while (queue.length) {
      const cur = queue.pop()!;
      for (const [dr, dc] of dirs) {
        const next = { row: cur.row + dr, col: cur.col + dc };
        const k = key(next);
        if (!set.has(k) || seen.has(k)) continue;
        seen.add(k);
        queue.push(next);
      }
    }
    if (seen.size !== cage.cells.length) return false;
  }
  return true;
}

export function cagesCoverBoardExactly(
  size: number,
  cages: CalcudokuPuzzleInput['cages']
): boolean {
  const seen = new Set<string>();
  for (const cage of cages) {
    for (const cell of cage.cells) {
      if (cell.row < 0 || cell.col < 0 || cell.row >= size || cell.col >= size) return false;
      const k = `${cell.row},${cell.col}`;
      if (seen.has(k)) return false;
      seen.add(k);
    }
  }
  return seen.size === size * size;
}

export function cageArithmeticHolds(
  grid: number[][],
  cages: Array<{ cells: Position[]; operation: string; target: number }>
): boolean {
  for (const cage of cages) {
    const values = cage.cells.map((cell) => grid[cell.row]?.[cell.col] ?? 0);
    if (values.some((v) => v < 1)) return false;
    const op = parseOp(cage.operation);
    const unique = new Set(values);
    if (unique.size !== values.length) return false;
    if (op === '+') {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum !== cage.target) return false;
    } else if (op === '-') {
      if (values.length !== 2) return false;
      if (Math.abs(values[0]! - values[1]!) !== cage.target) return false;
    } else if (op === '*') {
      const prod = values.reduce((a, b) => a * b, 1);
      if (prod !== cage.target) return false;
    } else {
      if (values.length !== 2) return false;
      const hi = Math.max(values[0]!, values[1]!);
      const lo = Math.min(values[0]!, values[1]!);
      if (lo === 0 || hi % lo !== 0 || hi / lo !== cage.target) return false;
    }
  }
  return true;
}
