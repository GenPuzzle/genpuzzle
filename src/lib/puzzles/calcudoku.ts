/**
 * Calcudoku (KenKen-style) generator.
 * Builds a randomized Latin square, partitions it into orthogonal cages of 2–5 cells,
 * assigns operations by difficulty (Easy +, Medium +−, Hard +−×, Expert +−×÷),
 * then accepts the puzzle only when an independent solver finds exactly one solution.
 */

import type {
  CalcudokuCage,
  CalcudokuOperation,
  Position,
  SudokuPuzzle,
} from './types';
import {
  cageArithmeticHolds,
  cagesAreOrthogonallyConnected,
  cagesCoverBoardExactly,
  countCalcudokuSolutions,
  solveCalcudoku,
} from './calcudoku-solver';

export const CALCUDOKU_GRID_SIZES = [4, 5, 6, 7, 8, 9] as const;
export type CalcudokuGridSize = (typeof CALCUDOKU_GRID_SIZES)[number];

export function isCalcudokuGridSize(value: unknown): value is CalcudokuGridSize {
  return (
    value === 4 ||
    value === 5 ||
    value === 6 ||
    value === 7 ||
    value === 8 ||
    value === 9
  );
}

export type CalcudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface CalcudokuGenerationOptions {
  size: number;
  difficulty?: CalcudokuDifficulty;
  cageSizeWeights?: Partial<Record<2 | 3 | 4 | 5, number>>;
  operationWeights?: { add?: number; subtract?: number; multiply?: number; divide?: number };
  allowedOperations?: CalcudokuOperation[];
  seed?: number;
  seenFingerprints?: Set<string>;
  maxBoardAttempts?: number;
  maxCageAttempts?: number;
}

export interface CalcudokuPuzzle extends SudokuPuzzle {
  variant: 'calcudoku';
  cages: CalcudokuCage[];
  size: number;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function createSeededRng(seed?: number): () => number {
  if (seed === undefined || !Number.isFinite(seed)) {
    return () => Math.random();
  }
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function shuffledBalancedPlan<T>(items: T[], count: number, rng: () => number = Math.random): T[] {
  if (items.length === 0 || count <= 0) return [];
  const plan: T[] = [];
  for (let i = 0; i < count; i++) plan.push(items[i % items.length]);
  return shuffleInPlace(plan, rng);
}

export function sampleOrCyclePlan<T>(source: T[], count: number, rng: () => number = Math.random): T[] {
  if (count <= 0) return [];
  if (source.length === 0) return [];
  if (source.length >= count) {
    return shuffleInPlace([...source], rng).slice(0, count);
  }
  return shuffledBalancedPlan(source, count, rng);
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function randomCoprime(n: number, rng: () => number): number {
  const candidates: number[] = [];
  for (let k = 1; k < n; k++) {
    if (gcd(k, n) === 1) candidates.push(k);
  }
  if (candidates.length === 0) return 1;
  return candidates[Math.floor(rng() * candidates.length)]!;
}

export function isLatinSquare(grid: number[][]): boolean {
  const n = grid.length;
  if (n < 2) return false;
  const expected = Array.from({ length: n }, (_, i) => i + 1);
  for (let r = 0; r < n; r++) {
    if (grid[r]?.length !== n) return false;
    const row = [...grid[r]].sort((a, b) => a - b);
    if (row.some((v, i) => v !== expected[i])) return false;
  }
  for (let c = 0; c < n; c++) {
    const col = grid.map((row) => row[c]).sort((a, b) => a - b);
    if (col.some((v, i) => v !== expected[i])) return false;
  }
  return true;
}

/** Randomized Latin square via cyclic construction + row/col/symbol shuffles. */
export function generateLatinSquare(size: number, rng: () => number): number[][] {
  const k = randomCoprime(size, rng);
  const shift = Math.floor(rng() * size);
  let grid = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => ((k * r + c + shift) % size) + 1)
  );

  const symbols = shuffleInPlace(
    Array.from({ length: size }, (_, i) => i + 1),
    rng
  );
  grid = grid.map((row) => row.map((v) => symbols[v - 1]!));

  const rowOrder = shuffleInPlace(
    Array.from({ length: size }, (_, i) => i),
    rng
  );
  grid = rowOrder.map((r) => grid[r]!);

  const colOrder = shuffleInPlace(
    Array.from({ length: size }, (_, i) => i),
    rng
  );
  grid = grid.map((row) => colOrder.map((c) => row[c]!));

  if (rng() < 0.5) {
    grid = grid[0]!.map((_, c) => grid.map((row) => row[c]!));
  }

  return grid;
}

export function operationsForDifficulty(difficulty: CalcudokuDifficulty): CalcudokuOperation[] {
  if (difficulty === 'easy') return ['+'];
  if (difficulty === 'medium') return ['+', '-'];
  if (difficulty === 'hard') return ['+', '-', '*'];
  return ['+', '-', '*', '/'];
}

export function cageSizeWeightsForDifficulty(
  size: number,
  difficulty: CalcudokuDifficulty
): Record<2 | 3 | 4 | 5, number> {
  if (difficulty === 'easy') {
    if (size >= 8) return { 2: 18, 3: 40, 4: 32, 5: 10 };
    if (size >= 6) return { 2: 22, 3: 44, 4: 28, 5: 6 };
    return { 2: 28, 3: 48, 4: 22, 5: 2 };
  }
  if (size >= 9) return { 2: 92, 3: 7, 4: 1, 5: 0 };
  if (size >= 8) return { 2: 88, 3: 10, 4: 2, 5: 0 };
  if (size >= 7) return { 2: 80, 3: 16, 4: 4, 5: 0 };
  return { 2: 72, 3: 21, 4: 6, 5: 1 };
}

/** @deprecated Prefer cageSizeWeightsForDifficulty(size, difficulty). */
export function easyCageSizeWeights(size: number): Record<2 | 3 | 4 | 5, number> {
  return cageSizeWeightsForDifficulty(size, 'medium');
}

function pickWeightedSize(
  weights: Record<2 | 3 | 4 | 5, number>,
  allowed: number[],
  rng: () => number
): number {
  const entries = allowed.filter((s) => s >= 2 && s <= 5);
  if (entries.length === 0) return 2;
  const total = entries.reduce((sum, s) => sum + Math.max(0, weights[s as 2 | 3 | 4 | 5] ?? 0), 0);
  if (total <= 0) return entries[Math.floor(rng() * entries.length)] ?? 2;
  let roll = rng() * total;
  for (const size of entries) {
    roll -= Math.max(0, weights[size as 2 | 3 | 4 | 5] ?? 0);
    if (roll <= 0) return size;
  }
  return entries[entries.length - 1] ?? 2;
}

/** Cage sizes 2–5 that leave this component empty or with at least 2 cells. */
function validCageSizesForComponent(componentLen: number): number[] {
  const sizes: number[] = [];
  for (let s = 2; s <= Math.min(5, componentLen); s++) {
    const rem = componentLen - s;
    if (rem === 0 || rem >= 2) sizes.push(s);
  }
  return sizes;
}

export function cageSizesAreValid(
  cages: Array<{ cells: Position[] }>,
  min = 2,
  max = 5
): boolean {
  return cages.every((cage) => cage.cells.length >= min && cage.cells.length <= max);
}

function cellKey(row: number, col: number): number {
  return (row << 8) | col;
}

function fromKey(key: number): Position {
  return { row: key >> 8, col: key & 0xff };
}

function bboxArea(cells: Position[], extra?: Position): number {
  let minR = extra ? extra.row : cells[0]!.row;
  let maxR = minR;
  let minC = extra ? extra.col : cells[0]!.col;
  let maxC = minC;
  for (const cell of cells) {
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
  }
  if (extra) {
    if (extra.row < minR) minR = extra.row;
    if (extra.row > maxR) maxR = extra.row;
    if (extra.col < minC) minC = extra.col;
    if (extra.col > maxC) maxC = extra.col;
  }
  return (maxR - minR + 1) * (maxC - minC + 1);
}

function neighborKeys(key: number, size: number): number[] {
  const { row, col } = fromKey(key);
  const out: number[] = [];
  for (const [dr, dc] of DIRS) {
    const nr = row + dr;
    const nc = col + dc;
    if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
    out.push(cellKey(nr, nc));
  }
  return out;
}

function connectedComponents(free: Set<number>, size: number): number[][] {
  const seen = new Set<number>();
  const comps: number[][] = [];
  for (const start of free) {
    if (seen.has(start)) continue;
    const stack = [start];
    const comp: number[] = [];
    seen.add(start);
    while (stack.length) {
      const key = stack.pop()!;
      comp.push(key);
      for (const next of neighborKeys(key, size)) {
        if (!free.has(next) || seen.has(next)) continue;
        seen.add(next);
        stack.push(next);
      }
    }
    comps.push(comp);
  }
  return comps;
}

function remainingComponentsOk(free: Set<number>, size: number): boolean {
  return connectedComponents(free, size).every((comp) => comp.length !== 1);
}

function twoSumAmbiguity(a: number, b: number, n: number): number {
  const s = a + b;
  let count = 0;
  for (let x = 1; x <= n; x++) {
    const y = s - x;
    if (y >= 1 && y <= n && y !== x) count += 1;
  }
  return count;
}

function growCageFrom(
  start: Position,
  targetSize: number,
  free: Set<number>,
  size: number,
  rng: () => number,
  solution?: number[][],
  pairHeuristic: 'diff' | 'sum' = 'diff'
): Position[] {
  const used = new Set<number>([cellKey(start.row, start.col)]);
  if (!free.has(cellKey(start.row, start.col))) return [];
  const cells: Position[] = [start];
  while (cells.length < targetSize) {
    const frontier: Position[] = [];
    const seen = new Set<number>();
    for (const cell of cells) {
      for (const [dr, dc] of DIRS) {
        const nr = cell.row + dr;
        const nc = cell.col + dc;
        if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
        const k = cellKey(nr, nc);
        if (!free.has(k) || used.has(k) || seen.has(k)) continue;
        seen.add(k);
        frontier.push({ row: nr, col: nc });
      }
    }
    if (frontier.length === 0) break;
    let pick: Position;
    if (solution && cells.length === 1) {
      const origin = solution[cells[0]!.row]![cells[0]!.col]!;
      let best = frontier[0]!;
      let bestScore = pairHeuristic === 'sum' ? Infinity : -Infinity;
      for (const cell of frontier) {
        const other = solution[cell.row]![cell.col]!;
        const score =
          pairHeuristic === 'sum'
            ? twoSumAmbiguity(origin, other, size) + rng() * 0.2
            : Math.abs(origin - other) + rng() * 0.35;
        if (pairHeuristic === 'sum' ? score < bestScore : score > bestScore) {
          bestScore = score;
          best = cell;
        }
      }
      pick = best;
    } else if (rng() < 0.55) {
      pick = frontier[Math.floor(rng() * frontier.length)]!;
    } else {
      let best = frontier[0]!;
      let bestScore = Infinity;
      for (const cell of frontier) {
        const score = bboxArea(cells, cell) + rng() * 0.2;
        if (score < bestScore) {
          bestScore = score;
          best = cell;
        }
      }
      pick = best;
    }
    cells.push(pick);
    used.add(cellKey(pick.row, pick.col));
  }
  return cells;
}

function commitCage(cells: Position[], cages: Position[][], free: Set<number>): void {
  cages.push(cells.map((cell) => ({ row: cell.row, col: cell.col })));
  for (const cell of cells) free.delete(cellKey(cell.row, cell.col));
}

function cellsConnected(cells: Position[]): boolean {
  if (cells.length <= 1) return true;
  return cagesAreOrthogonallyConnected([{ cells, operation: '+', target: 0 }]);
}

function findHostCage(cages: Position[][], row: number, col: number): Position[] | undefined {
  return cages.find((cage) => cage.some((cell) => cell.row === row && cell.col === col));
}

/** Merge a leftover cell into an adjacent cage of size 2–4. */
function tryMergeLeftover(
  cell: Position,
  cages: Position[][],
  free: Set<number>,
  size: number,
  rng: () => number
): boolean {
  const hosts: Position[][] = [];
  for (const [dr, dc] of shuffleInPlace([...DIRS], rng)) {
    const nr = cell.row + dr;
    const nc = cell.col + dc;
    if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
    const host = findHostCage(cages, nr, nc);
    if (host && host.length < 5 && !hosts.includes(host)) hosts.push(host);
  }
  hosts.sort((a, b) => a.length - b.length);
  if (hosts.length === 0) return false;
  hosts[0]!.push({ row: cell.row, col: cell.col });
  free.delete(cellKey(cell.row, cell.col));
  return true;
}

/**
 * Steal one cell from an adjacent cage (size 3–5) to form a new 2-cell cage
 * with the leftover, leaving the donor connected and still 2–5 cells.
 */
function tryStealForLeftover(
  cell: Position,
  cages: Position[][],
  free: Set<number>,
  size: number,
  rng: () => number
): boolean {
  const donors: Array<{ cage: Position[]; stolen: Position }> = [];
  for (const [dr, dc] of shuffleInPlace([...DIRS], rng)) {
    const nr = cell.row + dr;
    const nc = cell.col + dc;
    if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
    const cage = findHostCage(cages, nr, nc);
    if (!cage || cage.length < 3) continue;
    const stolen = { row: nr, col: nc };
    const rest = cage.filter((c) => c.row !== stolen.row || c.col !== stolen.col);
    if (rest.length < 2 || rest.length > 5) continue;
    if (!cellsConnected(rest)) continue;
    donors.push({ cage, stolen });
  }
  if (donors.length === 0) return false;
  const pick = donors[Math.floor(rng() * donors.length)]!;
  pick.cage.splice(
    pick.cage.findIndex((c) => c.row === pick.stolen.row && c.col === pick.stolen.col),
    1
  );
  cages.push([
    { row: cell.row, col: cell.col },
    { row: pick.stolen.row, col: pick.stolen.col },
  ]);
  free.delete(cellKey(cell.row, cell.col));
  return true;
}

function rescueSingletons(
  cages: Position[][],
  free: Set<number>,
  size: number,
  rng: () => number
): boolean {
  const singles = connectedComponents(free, size).filter((comp) => comp.length === 1);
  if (singles.length === 0) return true;
  for (const comp of singles) {
    const cell = fromKey(comp[0]!);
    if (tryMergeLeftover(cell, cages, free, size, rng)) continue;
    if (tryStealForLeftover(cell, cages, free, size, rng)) continue;
    return false;
  }
  return connectedComponents(free, size).every((comp) => comp.length !== 1);
}

function backtrackLastCage(cages: Position[][], free: Set<number>): boolean {
  const last = cages.pop();
  if (!last) return false;
  for (const cell of last) free.add(cellKey(cell.row, cell.col));
  return true;
}

function countDistinctSubsetSum(k: number, target: number, n: number): number {
  let count = 0;
  const walk = (next: number, left: number, rem: number) => {
    if (left === 0) {
      if (rem === 0) count += 1;
      return;
    }
    for (let v = next; v <= n; v++) {
      if (v > rem) break;
      walk(v + 1, left - 1, rem - v);
    }
  };
  walk(1, k, target);
  return count;
}

function seedUniqueAdditionCages(
  free: Set<number>,
  cages: Position[][],
  size: number,
  solution: number[][],
  rng: () => number
): void {
  const starts = shuffleInPlace([...free], rng);
  for (const sk of starts) {
    if (!free.has(sk)) continue;
    const start = fromKey(sk);
    const neighbors: Position[] = [];
    for (const [dr, dc] of DIRS) {
      const nr = start.row + dr;
      const nc = start.col + dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      if (free.has(cellKey(nr, nc))) neighbors.push({ row: nr, col: nc });
    }
    const origin = solution[start.row]![start.col]!;
    const uniquePairs = neighbors.filter(
      (cell) =>
        countDistinctSubsetSum(2, origin + solution[cell.row]![cell.col]!, size) === 1
    );
    if (uniquePairs.length > 0) {
      const other = uniquePairs[Math.floor(rng() * uniquePairs.length)]!;
      const grown = [start, other];
      const nextFree = new Set(free);
      for (const cell of grown) nextFree.delete(cellKey(cell.row, cell.col));
      if (!remainingComponentsOk(nextFree, size)) continue;
      commitCage(grown, cages, free);
      continue;
    }
    if (neighbors.length === 0) continue;
    const grown = growCageFrom(start, 3, free, size, rng, solution, 'sum');
    if (grown.length !== 3) continue;
    const sum = grown.reduce((total, cell) => total + solution[cell.row]![cell.col]!, 0);
    if (countDistinctSubsetSum(3, sum, size) !== 1) continue;
    const nextFree = new Set(free);
    for (const cell of grown) nextFree.delete(cellKey(cell.row, cell.col));
    if (!remainingComponentsOk(nextFree, size)) continue;
    commitCage(grown, cages, free);
  }
}

function partitionCages(
  size: number,
  rng: () => number,
  weights: Record<2 | 3 | 4 | 5, number>,
  solution?: number[][],
  preferPairs = true,
  pairHeuristic: 'diff' | 'sum' = 'diff'
): Position[][] | null {
  const free = new Set<number>();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) free.add(cellKey(r, c));
  }
  const cages: Position[][] = [];
  if (solution && pairHeuristic === 'sum') {
    seedUniqueAdditionCages(free, cages, size, solution, rng);
  }
  const maxSteps = size * size * 12;
  let steps = 0;
  let backtracks = 0;
  const maxBacktracks = size * size * 3;

  while (free.size > 0) {
    if (++steps > maxSteps) return null;

    if (!remainingComponentsOk(free, size)) {
      if (!rescueSingletons(cages, free, size, rng)) {
        if (backtracks++ >= maxBacktracks || !backtrackLastCage(cages, free)) return null;
      }
      continue;
    }

    const comps = connectedComponents(free, size);
    comps.sort((a, b) => a.length - b.length);
    const component = comps[0];
    if (!component) break;

    if (component.length === 1) {
      if (!rescueSingletons(cages, free, size, rng)) {
        if (backtracks++ >= maxBacktracks || !backtrackLastCage(cages, free)) return null;
      }
      continue;
    }

    const allowed = validCageSizesForComponent(component.length);
    if (allowed.length === 0) {
      if (backtracks++ >= maxBacktracks || !backtrackLastCage(cages, free)) return null;
      continue;
    }

    const starts = shuffleInPlace([...component], rng).slice(0, Math.min(8, component.length));

    if (solution && pairHeuristic === 'sum' && allowed.includes(2)) {
      let placedUnique = false;
      for (const sk of starts) {
        const grown = growCageFrom(fromKey(sk), 2, free, size, rng, solution, pairHeuristic);
        if (grown.length !== 2) continue;
        const sum =
          solution[grown[0]!.row]![grown[0]!.col]! + solution[grown[1]!.row]![grown[1]!.col]!;
        if (countDistinctSubsetSum(2, sum, size) !== 1) continue;
        const nextFree = new Set(free);
        for (const cell of grown) nextFree.delete(cellKey(cell.row, cell.col));
        if (!remainingComponentsOk(nextFree, size)) continue;
        commitCage(grown, cages, free);
        placedUnique = true;
        break;
      }
      if (placedUnique) continue;
    }

    let target: number;
    if (component.length === 2 || component.length === 3) {
      target = component.length;
    } else if (preferPairs && allowed.includes(2) && (size >= 7 || rng() < 0.72)) {
      target = 2;
    } else {
      target = pickWeightedSize(weights, allowed, rng);
    }

    const tryCommitSize = (cageSize: number): boolean => {
      if (cageSize < 2 || cageSize > 5 || !allowed.includes(cageSize)) return false;
      for (const sk of starts) {
        const grown = growCageFrom(fromKey(sk), cageSize, free, size, rng, solution, pairHeuristic);
        if (grown.length !== cageSize) continue;
        const nextFree = new Set(free);
        for (const cell of grown) nextFree.delete(cellKey(cell.row, cell.col));
        if (!remainingComponentsOk(nextFree, size)) continue;
        commitCage(grown, cages, free);
        return true;
      }
      return false;
    };

    let committed = tryCommitSize(target);
    if (!committed) {
      for (const other of allowed) {
        if (other === target) continue;
        if (tryCommitSize(other)) {
          committed = true;
          break;
        }
      }
    }

    if (!committed) {
      if (!tryCommitSize(2) && !tryCommitSize(3)) {
        if (backtracks++ >= maxBacktracks || !backtrackLastCage(cages, free)) return null;
      }
    }
  }

  if (cages.some((cage) => cage.length < 2 || cage.length > 5)) return null;
  if (free.size !== 0) return null;
  return cages;
}

function productOf(values: number[]): number {
  return values.reduce((a, b) => a * b, 1);
}

function subtractTarget(values: number[]): number | null {
  if (values.length !== 2) return null;
  const diff = Math.abs(values[0]! - values[1]!);
  return diff > 0 ? diff : null;
}

function divideTarget(values: number[]): number | null {
  if (values.length !== 2) return null;
  const hi = Math.max(values[0]!, values[1]!);
  const lo = Math.min(values[0]!, values[1]!);
  if (lo < 1 || hi % lo !== 0) return null;
  const q = hi / lo;
  return q >= 2 ? q : null;
}

function targetForOp(values: number[], op: CalcudokuOperation): number | null {
  if (op === '+') return values.reduce((a, b) => a + b, 0);
  if (op === '-') return subtractTarget(values);
  if (op === '*') return productOf(values);
  return divideTarget(values);
}

function legalOpsForValues(
  values: number[],
  allowed: CalcudokuOperation[]
): CalcudokuOperation[] {
  return allowed.filter((op) => targetForOp(values, op) != null);
}

function pickOperation(
  values: number[],
  allowed: CalcudokuOperation[],
  difficulty: CalcudokuDifficulty,
  rng: () => number
): CalcudokuOperation {
  const legal = legalOpsForValues(values, allowed);
  if (legal.length === 0) return '+';
  if (difficulty === 'easy') return '+';

  const weights = new Map<CalcudokuOperation, number>();
  const add = (op: CalcudokuOperation, weight: number) => {
    if (legal.includes(op) && weight > 0) weights.set(op, (weights.get(op) ?? 0) + weight);
  };

  if (values.length === 2) {
    if (difficulty === 'medium') {
      add('+', 30);
      add('-', 70);
    } else if (difficulty === 'hard') {
      add('+', 22);
      add('-', 38);
      add('*', 40);
    } else {
      add('+', 18);
      add('-', 28);
      add('*', 28);
      add('/', 26);
    }
  } else if (difficulty === 'medium') {
    add('+', 100);
  } else if (difficulty === 'hard') {
    add('+', 45);
    add('*', 55);
  } else {
    add('+', 40);
    add('*', 60);
  }

  const entries = [...weights.entries()];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return legal.includes('+') ? '+' : legal[0]!;
  let roll = rng() * total;
  for (const [op, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return op;
  }
  return entries[entries.length - 1]![0];
}

function assignOperations(
  solution: number[][],
  groups: Position[][],
  rng: () => number,
  allowed: CalcudokuOperation[],
  difficulty: CalcudokuDifficulty
): CalcudokuCage[] {
  return groups.map((cells, index) => {
    if (cells.length < 2 || cells.length > 5) {
      throw new Error(`Calcudoku cage must have 2–5 cells (got ${cells.length}).`);
    }
    const values = cells.map((cell) => solution[cell.row]![cell.col]!);
    const operation = pickOperation(values, allowed, difficulty, rng);
    const target = targetForOp(values, operation);
    return {
      id: `cage-${index + 1}`,
      cells: cells.map((cell) => ({ row: cell.row, col: cell.col })),
      operation: target == null ? '+' : operation,
      target: target ?? values.reduce((a, b) => a + b, 0),
    };
  });
}

function applyCageOp(cage: CalcudokuCage, solution: number[][], op: CalcudokuOperation): boolean {
  const values = cage.cells.map((cell) => solution[cell.row]![cell.col]!);
  const target = targetForOp(values, op);
  if (target == null) return false;
  cage.operation = op;
  cage.target = target;
  return true;
}

function ensureSignatureOps(
  cages: CalcudokuCage[],
  solution: number[][],
  allowed: CalcudokuOperation[],
  rng: () => number
): void {
  const used = new Set(cages.map((cage) => cage.operation));
  for (const op of allowed) {
    if (op === '+' || used.has(op)) continue;
    const candidates = cages.filter((cage) => {
      const values = cage.cells.map((cell) => solution[cell.row]![cell.col]!);
      return targetForOp(values, op) != null;
    });
    if (candidates.length === 0) continue;
    const cage = candidates[Math.floor(rng() * candidates.length)]!;
    if (applyCageOp(cage, solution, op)) used.add(op);
  }
}

export function calcudokuFingerprint(puzzle: {
  size: number;
  cages: CalcudokuCage[];
}): string {
  const cages = puzzle.cages
    .map((cage) => {
      const cells = [...cage.cells]
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((cell) => `${cell.row},${cell.col}`)
        .join(';');
      return `${cells}:${cage.operation}:${cage.target}`;
    })
    .sort();
  return `${puzzle.size}|${cages.join('|')}`;
}

export function isCalcudokuPuzzle(
  puzzle: SudokuPuzzle | null | undefined
): puzzle is CalcudokuPuzzle {
  return (
    !!puzzle &&
    puzzle.type === 'sudoku' &&
    puzzle.variant === 'calcudoku' &&
    Array.isArray(puzzle.cages) &&
    puzzle.cages.length > 0
  );
}

export function calcudokuCageLabel(cage: Pick<CalcudokuCage, 'target' | 'operation'>): string {
  const op =
    cage.operation === '-' ? '−' : cage.operation === '*' ? '×' : cage.operation === '/' ? '÷' : '+';
  return `${cage.target}${op}`;
}

export function calcudokuLabelCell(cage: Pick<CalcudokuCage, 'cells'>): Position {
  return cage.cells.reduce(
    (best, cell) =>
      cell.row < best.row || (cell.row === best.row && cell.col < best.col) ? cell : best,
    cage.cells[0]!
  );
}

export function buildCalcudokuCageIdGrid(
  size: number,
  cages: CalcudokuCage[]
): (string | null)[][] {
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null)
  );
  for (const cage of cages) {
    for (const cell of cage.cells) {
      if (cell.row >= 0 && cell.col >= 0 && cell.row < size && cell.col < size) {
        grid[cell.row]![cell.col] = cage.id;
      }
    }
  }
  return grid;
}

export function calcudokuInternalBorder(
  idGrid: (string | null)[][],
  row: number,
  col: number,
  edge: 'right' | 'bottom'
): 'thin' | 'thick' | 'none' {
  const n = idGrid.length;
  if (edge === 'right') {
    if (col >= n - 1) return 'none';
    const a = idGrid[row]?.[col];
    const b = idGrid[row]?.[col + 1];
    return a && a === b ? 'thin' : 'thick';
  }
  if (row >= n - 1) return 'none';
  const a = idGrid[row]?.[col];
  const b = idGrid[row + 1]?.[col];
  return a && a === b ? 'thin' : 'thick';
}

function recomputeCageFromSolution(
  cage: CalcudokuCage,
  solution: number[][],
  preferred: CalcudokuOperation | 'auto',
  allowed: CalcudokuOperation[]
): void {
  const values = cage.cells.map((cell) => solution[cell.row]![cell.col]!);
  if (preferred !== 'auto' && allowed.includes(preferred) && applyCageOp(cage, solution, preferred)) {
    return;
  }
  const fallback = legalOpsForValues(values, allowed)[0] ?? '+';
  if (!applyCageOp(cage, solution, fallback)) {
    cage.operation = '+';
    cage.target = values.reduce((a, b) => a + b, 0);
  }
}

function splitCageIntoValidParts(
  cells: Position[],
  size: number,
  rng: () => number
): [Position[], Position[]] | null {
  if (cells.length < 4 || cells.length > 5) return null;
  const free = new Set(cells.map((cell) => cellKey(cell.row, cell.col)));
  const firstSize = 2;
  const keys = shuffleInPlace([...free], rng);
  for (const sk of keys) {
    const first = growCageFrom(fromKey(sk), firstSize, free, size, rng);
    if (first.length !== 2) continue;
    const rest = cells.filter(
      (cell) => !first.some((f) => f.row === cell.row && f.col === cell.col)
    );
    if (rest.length < 2 || rest.length > 5) continue;
    if (!cellsConnected(first) || !cellsConnected(rest)) continue;
    return [first, rest];
  }
  return null;
}

function refineCagesForUniqueness(
  solution: number[][],
  cages: CalcudokuCage[],
  rng: () => number,
  size: number,
  allowed: CalcudokuOperation[],
  difficulty: CalcudokuDifficulty
): CalcudokuCage[] | null {
  const next = cages.map((cage, index) => ({
    ...cage,
    id: `cage-${index + 1}`,
    cells: cage.cells.map((cell) => ({ row: cell.row, col: cell.col })),
  }));

  if (allowed.includes('-')) {
    const add2 = next.filter((cage) => cage.operation === '+' && cage.cells.length === 2);
    let flipped = 0;
    for (const cage of add2) {
      if (applyCageOp(cage, solution, '-')) flipped += 1;
    }
    if (flipped > 0) return next;
  }

  if (allowed.includes('/')) {
    const add2 = next.filter((cage) => cage.operation === '+' && cage.cells.length === 2);
    let flipped = 0;
    for (const cage of add2) {
      if (applyCageOp(cage, solution, '/')) flipped += 1;
    }
    if (flipped > 0) return next;
  }

  if (allowed.includes('*')) {
    const plus = next.filter((cage) => cage.operation === '+');
    if (plus.length > 0) {
      const cage = plus[Math.floor(rng() * plus.length)]!;
      if (applyCageOp(cage, solution, '*')) return next;
    }
  }

  if (difficulty === 'easy') return null;

  const bulky = next.filter((cage) => cage.cells.length >= 4);
  if (bulky.length > 0) {
    const cage = bulky[Math.floor(rng() * bulky.length)]!;
    const split = splitCageIntoValidParts(cage.cells, size, rng);
    if (split) {
      const [a, b] = split;
      cage.cells = a;
      recomputeCageFromSolution(cage, solution, 'auto', allowed);
      const extra: CalcudokuCage = {
        id: `cage-${next.length + 1}`,
        cells: b,
        operation: '+',
        target: 0,
      };
      recomputeCageFromSolution(extra, solution, 'auto', allowed);
      next.push(extra);
      if (!cageSizesAreValid(next)) return null;
      return next;
    }
  }

  return null;
}

function gridsEqual(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r]!.length !== b[r]!.length) return false;
    for (let c = 0; c < a[r]!.length; c++) {
      if (a[r]![c] !== b[r]![c]) return false;
    }
  }
  return true;
}

function emptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

export function generateCalcudoku(options: CalcudokuGenerationOptions): CalcudokuPuzzle {
  const size = Math.round(options.size);
  if (!isCalcudokuGridSize(size)) {
    throw new Error(`Calcudoku supports 4×4 through 9×9 grids (got ${options.size}).`);
  }

  const difficulty: CalcudokuDifficulty =
    options.difficulty === 'medium' ||
    options.difficulty === 'hard' ||
    options.difficulty === 'expert'
      ? options.difficulty
      : 'easy';
  const rng = createSeededRng(options.seed);
  const weights = {
    ...cageSizeWeightsForDifficulty(size, difficulty),
    ...(options.cageSizeWeights ?? {}),
  } as Record<2 | 3 | 4 | 5, number>;
  const allowed = options.allowedOperations ?? operationsForDifficulty(difficulty);
  if (!allowed.some((op) => op === '+' || op === '-' || op === '*' || op === '/')) {
    throw new Error('Calcudoku requires at least one of +, −, ×, or ÷.');
  }

  const preferPairs = difficulty !== 'easy';
  const pairHeuristic: 'diff' | 'sum' = difficulty === 'easy' ? 'sum' : 'diff';
  const maxBoards =
    options.maxBoardAttempts ??
    (difficulty === 'easy' && size >= 9 ? 80 : size >= 9 ? 80 : size >= 8 ? 36 : 32);
  const maxCages =
    options.maxCageAttempts ?? (difficulty === 'easy' && size >= 9 ? 24 : size >= 9 ? 10 : size >= 8 ? 16 : 28);
  const seen = options.seenFingerprints;

  const opsAllowed = (current: CalcudokuCage[]) =>
    current.every((cage) => allowed.includes(cage.operation));

  for (let boardAttempt = 0; boardAttempt < maxBoards; boardAttempt++) {
    const solution = generateLatinSquare(size, rng);
    if (!isLatinSquare(solution)) continue;

    let abortBoard = false;
    for (let cageAttempt = 0; cageAttempt < maxCages; cageAttempt++) {
      const groups = partitionCages(
        size,
        rng,
        weights,
        solution,
        preferPairs,
        pairHeuristic
      );
      if (!groups || !cageSizesAreValid(groups.map((cells) => ({ cells })))) continue;

      let cages = assignOperations(solution, groups, rng, allowed, difficulty);
      cages = cages.map((cage) => {
        if (allowed.includes(cage.operation)) return cage;
        const values = cage.cells.map((cell) => solution[cell.row]![cell.col]!);
        return {
          ...cage,
          operation: '+' as const,
          target: values.reduce((a, b) => a + b, 0),
        };
      });
      ensureSignatureOps(cages, solution, allowed, rng);

      const partitionValid = (current: CalcudokuCage[]) =>
        cagesCoverBoardExactly(size, current) &&
        cagesAreOrthogonallyConnected(current) &&
        cageSizesAreValid(current) &&
        opsAllowed(current) &&
        cageArithmeticHolds(solution, current);

      if (!partitionValid(cages)) continue;

      if (size >= 8 && allowed.includes('-') && difficulty !== 'easy') {
        for (const cage of cages) {
          if (cage.cells.length === 2 && cage.operation === '+') {
            if (difficulty === 'medium') {
              applyCageOp(cage, solution, '-');
            } else if (allowed.includes('/') && applyCageOp(cage, solution, '/')) {
              // tighter 2-cell clue
            } else if (allowed.includes('*') && applyCageOp(cage, solution, '*')) {
              // multiplication 2-cell
            } else {
              applyCageOp(cage, solution, '-');
            }
          }
        }
        if (!partitionValid(cages)) continue;
      }

      const maxRepairs =
        difficulty === 'easy' ? 2 : size >= 9 ? 8 : size >= 8 ? 6 : 3;
      let accepted: CalcudokuCage[] | null = null;
      for (let repair = 0; repair <= maxRepairs; repair++) {
        if (!partitionValid(cages)) break;

        const fingerprint = calcudokuFingerprint({ size, cages });
        if (seen?.has(fingerprint)) {
          const refined = refineCagesForUniqueness(
            solution,
            cages,
            rng,
            size,
            allowed,
            difficulty
          );
          if (!refined || !partitionValid(refined)) break;
          cages = refined;
          continue;
        }

        const result = countCalcudokuSolutions({ size, cages }, 2, solution);
        if (result.timedOut) {
          if (difficulty !== 'easy') abortBoard = true;
          break;
        }
        if (
          result.count === 1 &&
          result.solution &&
          gridsEqual(result.solution, solution) &&
          partitionValid(cages)
        ) {
          accepted = cages;
          break;
        }
        const refined = refineCagesForUniqueness(
          solution,
          cages,
          rng,
          size,
          allowed,
          difficulty
        );
        if (!refined || !partitionValid(refined)) break;
        cages = refined;
      }

      if (abortBoard) break;
      if (!accepted || !partitionValid(accepted)) continue;
      cages = accepted;

      const fingerprint = calcudokuFingerprint({ size, cages });
      if (seen?.has(fingerprint)) continue;
      seen?.add(fingerprint);

      return {
        type: 'sudoku',
        variant: 'calcudoku',
        grid: emptyGrid(size),
        solution: cloneGrid(solution),
        cages,
        difficulty,
        size,
        seed: options.seed,
      };
    }
  }

  throw new Error(
    `Could not generate a unique ${size}×${size} Calcudoku puzzle after ${maxBoards} boards. Try again or use a smaller grid.`
  );
}

export {
  cageArithmeticHolds,
  cagesAreOrthogonallyConnected,
  cagesCoverBoardExactly,
  countCalcudokuSolutions,
  partitionCages as partitionCalcudokuCages,
  solveCalcudoku,
};
