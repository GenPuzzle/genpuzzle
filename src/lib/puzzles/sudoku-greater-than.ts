/**
 * Greater Than Sudoku: inequality-only (default) or optional hybrid with givens.
 * Difficulty is rated by a logical solver (bounds, singles, pairs), not clue count.
 *
 * Intentionally does not import `./sudoku` (avoids a circular dependency).
 */
import type { Difficulty, SudokuInequality, SudokuPuzzle } from './types';

type SudokuSize = 4 | 6 | 9 | 12 | 16 | 25;

const SUDOKU_BOX: Record<SudokuSize, { boxH: number; boxW: number }> = {
  4: { boxH: 2, boxW: 2 },
  6: { boxH: 2, boxW: 3 },
  9: { boxH: 3, boxW: 3 },
  12: { boxH: 3, boxW: 4 },
  16: { boxH: 4, boxW: 4 },
  25: { boxH: 5, boxW: 5 },
};

export type GreaterThanGenerateOptions = {
  difficulty?: Difficulty;
  size?: SudokuSize;
  /** When true, allow a few prefilled digits (hybrid). Default: inequality-only. */
  hybrid?: boolean;
  /** Pre-built complete Sudoku solution (from sudoku.ts). */
  solution?: number[][];
};

type Technique = 'bounds' | 'nakedSingle' | 'hiddenSingle' | 'nakedPair';

const TECHNIQUE_RANK: Record<Technique, number> = {
  bounds: 0,
  nakedSingle: 1,
  hiddenSingle: 2,
  nakedPair: 3,
};

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function emptyGrid(size: number): number[][] {
  return Array.from({ length: size }, () => Array(size).fill(0));
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

function collectSolutionInequalities(solution: number[][]): SudokuInequality[] {
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

function inequalitiesMatchSolution(
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

function cellIndex(r: number, c: number, size: number): number {
  return r * size + c;
}

type IneqEdge = {
  a: number;
  b: number;
  /** true ⇒ value(a) > value(b) */
  gt: boolean;
};

function toEdges(inequalities: SudokuInequality[], size: number): IneqEdge[] {
  return inequalities.map((ineq) => ({
    a: cellIndex(ineq.r1, ineq.c1, size),
    b: cellIndex(ineq.r2, ineq.c2, size),
    gt: ineq.gt,
  }));
}

function buildAdj(edges: IneqEdge[], nCells: number): number[][] {
  const adj: number[][] = Array.from({ length: nCells }, () => []);
  for (let i = 0; i < edges.length; i++) {
    adj[edges[i]!.a]!.push(i);
    adj[edges[i]!.b]!.push(i);
  }
  return adj;
}

/** Fast uniqueness check with MRV + bitmasks. Returns 0, 1, or 2 (+). */
export function countGreaterThanSolutions(
  grid: number[][],
  inequalities: SudokuInequality[],
  limit: number = 2,
  nodeBudget: number = 120_000
): number {
  const size = grid.length;
  if (!isSudokuSizeSafe(size)) return 0;
  const { boxH, boxW } = SUDOKU_BOX[size as SudokuSize];
  const nCells = size * size;
  const allMask = (1 << size) - 1;
  const edges = toEdges(inequalities, size);
  const adj = buildAdj(edges, nCells);

  const rowMask = new Int32Array(size);
  const colMask = new Int32Array(size);
  const boxMask = new Int32Array(size);
  const values = new Int32Array(nCells);
  const given = new Uint8Array(nCells);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r]![c]!;
      const idx = cellIndex(r, c, size);
      if (v >= 1 && v <= size) {
        const bit = 1 << (v - 1);
        const b = Math.floor(r / boxH) * (size / boxW) + Math.floor(c / boxW);
        if (rowMask[r]! & bit || colMask[c]! & bit || boxMask[b]! & bit) return 0;
        rowMask[r]! |= bit;
        colMask[c]! |= bit;
        boxMask[b]! |= bit;
        values[idx] = v;
        given[idx] = 1;
      }
    }
  }

  // Inequality vs givens
  for (const e of edges) {
    const va = values[e.a]!;
    const vb = values[e.b]!;
    if (va && vb) {
      if (e.gt ? !(va > vb) : !(va < vb)) return 0;
    }
  }

  let count = 0;
  let nodes = 0;
  let exhausted = true;

  function candMask(idx: number): number {
    const r = (idx / size) | 0;
    const c = idx % size;
    const b = Math.floor(r / boxH) * (size / boxW) + Math.floor(c / boxW);
    let mask = allMask & ~(rowMask[r]! | colMask[c]! | boxMask[b]!);
    if (!mask) return 0;
    for (const ei of adj[idx]!) {
      const e = edges[ei]!;
      const other = e.a === idx ? e.b : e.a;
      const ov = values[other]!;
      if (!ov) continue;
      // idx ? other
      if (e.a === idx) {
        // idx > other or idx < other
        if (e.gt) {
          // idx > ov ⇒ bits for digits > ov
          let keep = 0;
          for (let d = ov + 1; d <= size; d++) keep |= 1 << (d - 1);
          mask &= keep;
        } else {
          let keep = 0;
          for (let d = 1; d < ov; d++) keep |= 1 << (d - 1);
          mask &= keep;
        }
      } else {
        // other is a, idx is b: a > b or a < b
        if (e.gt) {
          // other > idx ⇒ idx < ov
          let keep = 0;
          for (let d = 1; d < ov; d++) keep |= 1 << (d - 1);
          mask &= keep;
        } else {
          // other < idx ⇒ idx > ov
          let keep = 0;
          for (let d = ov + 1; d <= size; d++) keep |= 1 << (d - 1);
          mask &= keep;
        }
      }
    }
    return mask;
  }

  function place(idx: number, v: number): void {
    const r = (idx / size) | 0;
    const c = idx % size;
    const b = Math.floor(r / boxH) * (size / boxW) + Math.floor(c / boxW);
    const bit = 1 << (v - 1);
    values[idx] = v;
    rowMask[r]! |= bit;
    colMask[c]! |= bit;
    boxMask[b]! |= bit;
  }

  function unplace(idx: number, v: number): void {
    const r = (idx / size) | 0;
    const c = idx % size;
    const b = Math.floor(r / boxH) * (size / boxW) + Math.floor(c / boxW);
    const bit = 1 << (v - 1);
    values[idx] = 0;
    rowMask[r]! &= ~bit;
    colMask[c]! &= ~bit;
    boxMask[b]! &= ~bit;
  }

  function search(): boolean {
    if (++nodes > nodeBudget) {
      // Incomplete search — caller must not treat this as a proven multi-solution.
      exhausted = false;
      return true;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = size + 1;
    for (let idx = 0; idx < nCells; idx++) {
      if (values[idx]) continue;
      const mask = candMask(idx);
      const bits = popcount(mask);
      if (bits === 0) return false;
      if (bits < bestCount) {
        bestCount = bits;
        best = idx;
        bestMask = mask;
        if (bits === 1) break;
      }
    }
    if (best < 0) {
      count++;
      return count >= limit;
    }
    let mask = bestMask;
    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;
      const v = bitIndex(bit) + 1;
      place(best, v);
      if (search()) {
        unplace(best, v);
        return true;
      }
      unplace(best, v);
    }
    return false;
  }

  search();
  // -1 ⇒ search budget exhausted before uniqueness could be proven.
  if (!exhausted && count < limit) return -1;
  return Math.min(count, limit);
}

function popcount(x: number): number {
  let n = x;
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

function bitIndex(bit: number): number {
  let i = 0;
  let b = bit;
  while (b > 1) {
    b >>= 1;
    i++;
  }
  return i;
}

function isSudokuSizeSafe(size: number): size is SudokuSize {
  return size === 4 || size === 6 || size === 9 || size === 12 || size === 16 || size === 25;
}

function isUnique(
  grid: number[][],
  inequalities: SudokuInequality[],
  nodeBudget: number
): boolean {
  return countGreaterThanSolutions(grid, inequalities, 2, nodeBudget) === 1;
}

/**
 * Uniqueness via the bitmask solver with a generous budget.
 * Returns true only when a full search proves exactly one solution.
 */
function isUniqueExact(
  grid: number[][],
  inequalities: SudokuInequality[],
  nodeBudget: number = 500_000
): boolean {
  return countGreaterThanSolutions(grid, inequalities, 2, nodeBudget) === 1;
}

type LogicalResult = {
  solved: boolean;
  maxTechnique: Technique;
  steps: number;
  level: Difficulty;
};

/**
 * Logical solver: inequality bound propagation + naked/hidden singles + naked pairs.
 * Does not guess — unsolved ⇒ expert-level (needs search).
 */
export function rateGreaterThanPuzzle(
  grid: number[][],
  inequalities: SudokuInequality[]
): LogicalResult {
  const size = grid.length;
  if (!isSudokuSizeSafe(size)) {
    return { solved: false, maxTechnique: 'bounds', steps: 0, level: 'expert' };
  }
  const { boxH, boxW } = SUDOKU_BOX[size];
  const nCells = size * size;
  const edges = toEdges(inequalities, size);
  const adj = buildAdj(edges, nCells);

  // candidates[idx] = bitmask
  const allMask = (1 << size) - 1;
  const cand = new Int32Array(nCells).fill(allMask);
  const values = new Int32Array(nCells);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = grid[r]![c]!;
      if (v >= 1 && v <= size) {
        const idx = cellIndex(r, c, size);
        values[idx] = v;
        cand[idx] = 1 << (v - 1);
      }
    }
  }

  let maxTechnique: Technique = 'bounds';
  let steps = 0;

  const bump = (t: Technique) => {
    if (TECHNIQUE_RANK[t] > TECHNIQUE_RANK[maxTechnique]) maxTechnique = t;
  };

  const eliminate = (idx: number, bit: number, technique: Technique): boolean => {
    if (!(cand[idx]! & bit) || values[idx]) return false;
    cand[idx]! &= ~bit;
    bump(technique);
    steps++;
    return true;
  };

  const assign = (idx: number, v: number, technique: Technique): boolean => {
    if (values[idx]) return values[idx] === v;
    const bit = 1 << (v - 1);
    if (!(cand[idx]! & bit)) return false;
    values[idx] = v;
    cand[idx] = bit;
    bump(technique);
    steps++;
    // Peel from peers
    const r = (idx / size) | 0;
    const c = idx % size;
    const br = Math.floor(r / boxH) * boxH;
    const bc = Math.floor(c / boxW) * boxW;
    for (let cc = 0; cc < size; cc++) {
      const peer = cellIndex(r, cc, size);
      if (peer !== idx) eliminate(peer, bit, technique);
    }
    for (let rr = 0; rr < size; rr++) {
      const peer = cellIndex(rr, c, size);
      if (peer !== idx) eliminate(peer, bit, technique);
    }
    for (let rr = br; rr < br + boxH; rr++) {
      for (let cc = bc; cc < bc + boxW; cc++) {
        const peer = cellIndex(rr, cc, size);
        if (peer !== idx) eliminate(peer, bit, technique);
      }
    }
    return true;
  };

  // Seed givens into peer eliminations (values already set — peel peers directly).
  for (let idx = 0; idx < nCells; idx++) {
    if (!values[idx]) continue;
    const v = values[idx]!;
    const bit = 1 << (v - 1);
    const r = (idx / size) | 0;
    const c = idx % size;
    const br = Math.floor(r / boxH) * boxH;
    const bc = Math.floor(c / boxW) * boxW;
    for (let cc = 0; cc < size; cc++) {
      const peer = cellIndex(r, cc, size);
      if (peer !== idx) eliminate(peer, bit, 'bounds');
    }
    for (let rr = 0; rr < size; rr++) {
      const peer = cellIndex(rr, c, size);
      if (peer !== idx) eliminate(peer, bit, 'bounds');
    }
    for (let rr = br; rr < br + boxH; rr++) {
      for (let cc = bc; cc < bc + boxW; cc++) {
        const peer = cellIndex(rr, cc, size);
        if (peer !== idx) eliminate(peer, bit, 'bounds');
      }
    }
  }

  function propagateBounds(): boolean {
    let changed = false;
    // For each cell, tighten via inequality neighbors' candidate extrema
    for (let idx = 0; idx < nCells; idx++) {
      if (values[idx]) continue;
      for (const ei of adj[idx]!) {
        const e = edges[ei]!;
        const other = e.a === idx ? e.b : e.a;
        const oMask = cand[other]!;
        if (!oMask) continue;
        // min/max of other
        let oMin = size;
        let oMax = 1;
        for (let d = 1; d <= size; d++) {
          if (oMask & (1 << (d - 1))) {
            oMin = Math.min(oMin, d);
            oMax = Math.max(oMax, d);
          }
        }
        if (e.a === idx) {
          if (e.gt) {
            // idx > other ⇒ idx >= oMin+1
            for (let d = 1; d <= oMin; d++) {
              if (eliminate(idx, 1 << (d - 1), 'bounds')) changed = true;
            }
          } else {
            // idx < other ⇒ idx <= oMax-1
            for (let d = oMax; d <= size; d++) {
              if (eliminate(idx, 1 << (d - 1), 'bounds')) changed = true;
            }
          }
        } else if (e.gt) {
          // other > idx ⇒ idx <= oMax-1
          for (let d = oMax; d <= size; d++) {
            if (eliminate(idx, 1 << (d - 1), 'bounds')) changed = true;
          }
        } else {
          // other < idx ⇒ idx >= oMin+1
          for (let d = 1; d <= oMin; d++) {
            if (eliminate(idx, 1 << (d - 1), 'bounds')) changed = true;
          }
        }
      }
      // Pairwise: remove digits with no supporting partner digit
      for (const ei of adj[idx]!) {
        const e = edges[ei]!;
        const other = e.a === idx ? e.b : e.a;
        const oMask = cand[other]!;
        let m = cand[idx]!;
        while (m) {
          const bit = m & -m;
          m ^= bit;
          const d = bitIndex(bit) + 1;
          let ok = false;
          let om = oMask;
          while (om) {
            const ob = om & -om;
            om ^= ob;
            const od = bitIndex(ob) + 1;
            if (e.a === idx) {
              if (e.gt ? d > od : d < od) {
                ok = true;
                break;
              }
            } else if (e.gt ? od > d : od < d) {
              ok = true;
              break;
            }
          }
          if (!ok && eliminate(idx, bit, 'bounds')) changed = true;
        }
      }
    }
    return changed;
  }

  function nakedSingles(): boolean {
    let changed = false;
    for (let idx = 0; idx < nCells; idx++) {
      if (values[idx]) continue;
      const mask = cand[idx]!;
      if (mask === 0) return changed;
      if (popcount(mask) === 1) {
        const v = bitIndex(mask) + 1;
        if (assign(idx, v, 'nakedSingle')) changed = true;
      }
    }
    return changed;
  }

  function hiddenSingles(): boolean {
    let changed = false;
    const units: number[][] = [];
    for (let r = 0; r < size; r++) {
      units.push(Array.from({ length: size }, (_, c) => cellIndex(r, c, size)));
    }
    for (let c = 0; c < size; c++) {
      units.push(Array.from({ length: size }, (_, r) => cellIndex(r, c, size)));
    }
    for (let br = 0; br < size; br += boxH) {
      for (let bc = 0; bc < size; bc += boxW) {
        const cells: number[] = [];
        for (let r = br; r < br + boxH; r++) {
          for (let c = bc; c < bc + boxW; c++) cells.push(cellIndex(r, c, size));
        }
        units.push(cells);
      }
    }
    for (const unit of units) {
      for (let d = 1; d <= size; d++) {
        const bit = 1 << (d - 1);
        let place = -1;
        let hits = 0;
        for (const idx of unit) {
          if (values[idx] === d) {
            hits = 99;
            break;
          }
          if (!values[idx] && cand[idx]! & bit) {
            hits++;
            place = idx;
          }
        }
        if (hits === 1 && place >= 0) {
          if (assign(place, d, 'hiddenSingle')) changed = true;
        }
      }
    }
    return changed;
  }

  function nakedPairs(): boolean {
    let changed = false;
    const units: number[][] = [];
    for (let r = 0; r < size; r++) {
      units.push(Array.from({ length: size }, (_, c) => cellIndex(r, c, size)));
    }
    for (let c = 0; c < size; c++) {
      units.push(Array.from({ length: size }, (_, r) => cellIndex(r, c, size)));
    }
    for (let br = 0; br < size; br += boxH) {
      for (let bc = 0; bc < size; bc += boxW) {
        const cells: number[] = [];
        for (let r = br; r < br + boxH; r++) {
          for (let c = bc; c < bc + boxW; c++) cells.push(cellIndex(r, c, size));
        }
        units.push(cells);
      }
    }
    for (const unit of units) {
      const open = unit.filter((idx) => !values[idx] && popcount(cand[idx]!) === 2);
      for (let i = 0; i < open.length; i++) {
        for (let j = i + 1; j < open.length; j++) {
          const a = open[i]!;
          const b = open[j]!;
          if (cand[a] !== cand[b]) continue;
          const pair = cand[a]!;
          for (const idx of unit) {
            if (idx === a || idx === b || values[idx]) continue;
            const before = cand[idx]!;
            const next = before & ~pair;
            if (next !== before) {
              cand[idx] = next;
              bump('nakedPair');
              steps++;
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  }

  // Fix contradiction check
  const maxIter = size * size * 8;
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    if (propagateBounds()) changed = true;
    if (nakedSingles()) changed = true;
    if (hiddenSingles()) changed = true;
    if (nakedPairs()) changed = true;
    for (let idx = 0; idx < nCells; idx++) {
      if (!values[idx] && cand[idx] === 0) {
        return { solved: false, maxTechnique, steps, level: levelFromTechnique(maxTechnique, steps, false) };
      }
    }
    if (!changed) break;
  }

  let solved = true;
  for (let idx = 0; idx < nCells; idx++) {
    if (!values[idx]) {
      solved = false;
      break;
    }
  }
  return {
    solved,
    maxTechnique,
    steps,
    level: levelFromTechnique(maxTechnique, steps, solved),
  };
}

function levelFromTechnique(maxTechnique: Technique, steps: number, solved: boolean): Difficulty {
  if (!solved) return 'expert';
  if (maxTechnique === 'nakedPair' || steps >= sizeStepsHard()) return 'hard';
  if (maxTechnique === 'hiddenSingle' || steps >= sizeStepsMedium()) return 'medium';
  return 'easy';
}

function sizeStepsMedium(): number {
  return 40;
}
function sizeStepsHard(): number {
  return 90;
}

function difficultyRank(d: Difficulty): number {
  switch (d) {
    case 'easy':
      return 0;
    case 'medium':
      return 1;
    case 'hard':
      return 2;
    case 'expert':
      return 3;
    default:
      return 1;
  }
}

function ineqKey(ineq: SudokuInequality): string {
  return `${ineq.r1},${ineq.c1},${ineq.r2},${ineq.c2},${ineq.gt ? 1 : 0}`;
}

/** Hybrid: dig a few givens while preserving uniqueness (optional mode). */
function digHybridGivens(
  solution: number[][],
  inequalities: SudokuInequality[],
  difficulty: Difficulty,
  size: SudokuSize
): number[][] {
  const total = size * size;
  // Light givens only — inequalities remain primary.
  const ratio =
    difficulty === 'easy'
      ? 0.12
      : difficulty === 'medium'
        ? 0.08
        : difficulty === 'hard'
          ? 0.04
          : 0.02;
  const targetGivens = Math.max(0, Math.round(total * ratio));
  const puzzle = cloneGrid(solution);
  const positions: [number, number][] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) positions.push([r, c]);
  }
  shuffleInPlace(positions);
  let removed = 0;
  const targetRemoved = total - targetGivens;
  const budget = size <= 9 ? 60_000 : 20_000;
  for (const [r, c] of positions) {
    if (removed >= targetRemoved) break;
    const backup = puzzle[r]![c]!;
    puzzle[r]![c] = 0;
    if (isUnique(puzzle, inequalities, budget)) {
      removed++;
    } else {
      puzzle[r]![c] = backup;
    }
  }
  return puzzle;
}

export function generateGreaterThanSudoku(
  opts: GreaterThanGenerateOptions & { solution: number[][] }
): SudokuPuzzle | null {
  const difficulty = opts.difficulty ?? 'medium';
  const size: SudokuSize =
    opts.size === 4 ||
    opts.size === 6 ||
    opts.size === 9 ||
    opts.size === 12 ||
    opts.size === 16 ||
    opts.size === 25
      ? opts.size
      : ((opts.solution.length as SudokuSize) || 9);
  const hybrid = opts.hybrid === true;
  const target = difficultyRank(difficulty);
  // Timeout ⇒ not proven unique ⇒ keep the inequality (never claim uniqueness on timeout).
  const uniqueBudget = size <= 6 ? 120_000 : size <= 9 ? 400_000 : 50_000;
  const solution = opts.solution;
  const all = collectSolutionInequalities(solution);
  const grid0 = emptyGrid(size);

  if (!all.length) return null;
  // Full adjacent-inequality pattern must itself be unique — otherwise no subset can be.
  if (!isUniqueExact(grid0, all, uniqueBudget)) return null;

  let selected = [...all];
  const thinBudget = Math.floor(uniqueBudget * 0.4);

  // Phase 1: binary-search how many inequalities we can drop (few uniqueness checks).
  const removalCap =
    difficulty === 'easy'
      ? Math.floor(all.length * 0.2)
      : difficulty === 'medium'
        ? Math.floor(all.length * 0.35)
        : difficulty === 'hard'
          ? Math.floor(all.length * 0.5)
          : Math.floor(all.length * 0.65);
  const victims = shuffleInPlace([...all]).slice(0, removalCap);
  // Find largest m such that removing victims[0..m) stays unique.
  let lo = 0;
  let hi = victims.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    const drop = new Set(victims.slice(0, mid).map(ineqKey));
    const trial = all.filter((e) => !drop.has(ineqKey(e)));
    if (trial.length >= size && isUnique(grid0, trial, thinBudget)) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  if (lo > 0) {
    const drop = new Set(victims.slice(0, lo).map(ineqKey));
    selected = all.filter((e) => !drop.has(ineqKey(e)));
  }

  // Phase 2: tune difficulty via logical rating (add clues = easier).
  let rating = rateGreaterThanPuzzle(grid0, selected);
  const unused = shuffleInPlace(
    all.filter((e) => !selected.some((s) => ineqKey(s) === ineqKey(e)))
  );

  let addGuard = 0;
  while (difficultyRank(rating.level) > target && unused.length && addGuard < 48) {
    selected = [...selected, unused.pop()!];
    rating = rateGreaterThanPuzzle(grid0, selected);
    addGuard++;
  }

  if (!inequalitiesMatchSolution(solution, selected)) return null;
  // Final gate with full budget. If thinning overshot, revert to the proven-unique full set.
  if (!isUniqueExact(grid0, selected, uniqueBudget)) {
    selected = all;
  }

  const puzzleGrid = hybrid
    ? digHybridGivens(solution, selected, difficulty, size)
    : emptyGrid(size);

  if (hybrid && !isUniqueExact(puzzleGrid, selected, uniqueBudget)) {
    // Hybrid dig failed uniqueness — ship inequality-only instead.
    return {
      type: 'sudoku',
      grid: emptyGrid(size),
      solution,
      difficulty,
      size,
      variant: 'greater-than',
      inequalities: selected,
    };
  }

  return {
    type: 'sudoku',
    grid: puzzleGrid,
    solution,
    difficulty,
    size,
    variant: 'greater-than',
    inequalities: selected,
  };
}

export function gridHasNoGivens(grid: number[][]): boolean {
  return grid.every((row) => row.every((v) => v === 0));
}
