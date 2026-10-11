/**
 * Kakuro / Cross Sums generator.
 * Independent of Sudoku — topology, run sums, unique digits 1–9 per run.
 */

import type { DocumentBatchPuzzleMeta } from './types';

export type KakuroDifficulty = 'easy' | 'medium' | 'hard';
export type KakuroPattern = 'asymmetric' | 'rotational';
export type KakuroGridSize = 7 | 8 | 9 | 10 | 12 | 15;

export const KAKURO_SIZES: KakuroGridSize[] = [7, 8, 9, 10, 12, 15];

export type KakuroCellKind = 'block' | 'clue' | 'playable';

export interface KakuroCell {
  type: KakuroCellKind;
  /** Across sum in upper-right triangle (null = none). */
  across: number | null;
  /** Down sum in lower-left triangle (null = none). */
  down: number | null;
}

export interface KakuroRun {
  id: string;
  direction: 'across' | 'down';
  clue: number;
  cells: Array<{ row: number; col: number }>;
}

export interface KakuroPuzzle extends DocumentBatchPuzzleMeta {
  type: 'kakuro';
  id?: string;
  rows: number;
  columns: number;
  size: number;
  difficulty: KakuroDifficulty;
  pattern: KakuroPattern;
  cells: KakuroCell[][];
  runs: KakuroRun[];
  /** Full digit grid; 0 = non-playable. */
  solution: number[][];
  metadata?: {
    seed?: number;
    difficultyScore?: number;
    whiteCount?: number;
    createdAt?: string;
  };
}

export interface KakuroGenerateOptions {
  rows?: number;
  columns?: number;
  size?: KakuroGridSize | number;
  difficulty?: KakuroDifficulty;
  pattern?: KakuroPattern;
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

export function isKakuroSize(value: unknown): value is KakuroGridSize {
  return (
    value === 7 ||
    value === 8 ||
    value === 9 ||
    value === 10 ||
    value === 12 ||
    value === 15
  );
}

export function kakuroMinSum(n: number): number {
  return (n * (n + 1)) / 2;
}

export function kakuroMaxSum(n: number): number {
  return (n * (19 - n)) / 2;
}

/** Precomputed distinct digit combinations for length/sum. */
const comboCache = new Map<string, number[][]>();

export function getKakuroCombinations(length: number, sum: number): number[][] {
  if (length < 2 || length > 9) return [];
  if (sum < kakuroMinSum(length) || sum > kakuroMaxSum(length)) return [];
  const key = `${length}:${sum}`;
  const cached = comboCache.get(key);
  if (cached) return cached;

  const out: number[][] = [];
  const pick = (start: number, left: number, remain: number, acc: number[]) => {
    if (left === 0) {
      if (remain === 0) out.push(acc.slice());
      return;
    }
    for (let d = start; d <= 10 - left; d++) {
      if (d > remain) break;
      acc.push(d);
      pick(d + 1, left - 1, remain - d, acc);
      acc.pop();
    }
  };
  pick(1, length, sum, []);
  comboCache.set(key, out);
  return out;
}

function digitMask(digits: Iterable<number>): number {
  let m = 0;
  for (const d of digits) m |= 1 << (d - 1);
  return m;
}

function maskHas(mask: number, d: number): boolean {
  return (mask & (1 << (d - 1))) !== 0;
}

function maskAdd(mask: number, d: number): number {
  return mask | (1 << (d - 1));
}

function maskRemove(mask: number, d: number): number {
  return mask & ~(1 << (d - 1));
}

function maskPopcount(mask: number): number {
  let n = 0;
  while (mask) {
    n += mask & 1;
    mask >>>= 1;
  }
  return n;
}

function maskToDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (maskHas(mask, d)) out.push(d);
  return out;
}

type WhiteMask = boolean[][]; // true = white/playable

function emptyWhiteMask(rows: number, cols: number): WhiteMask {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function cloneMask(mask: WhiteMask): WhiteMask {
  return mask.map((row) => row.slice());
}

/** Extract across/down runs from a white mask (no clues yet). */
function extractRunsFromMask(mask: WhiteMask): {
  across: Array<Array<{ row: number; col: number }>>;
  down: Array<Array<{ row: number; col: number }>>;
} {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const across: Array<Array<{ row: number; col: number }>> = [];
  const down: Array<Array<{ row: number; col: number }>> = [];

  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (!mask[r]![c]) {
        c += 1;
        continue;
      }
      const cells: Array<{ row: number; col: number }> = [];
      while (c < cols && mask[r]![c]) {
        cells.push({ row: r, col: c });
        c += 1;
      }
      across.push(cells);
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (!mask[r]![c]) {
        r += 1;
        continue;
      }
      const cells: Array<{ row: number; col: number }> = [];
      while (r < rows && mask[r]![c]) {
        cells.push({ row: r, col: c });
        r += 1;
      }
      down.push(cells);
    }
  }
  return { across, down };
}

export function validateKakuroTopologyMask(mask: WhiteMask): { ok: true } | { ok: false; reason: string } {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  if (rows < 3 || cols < 3) return { ok: false, reason: 'grid too small' };

  let white = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (mask[r]![c]) white += 1;
  }
  if (white < 4) return { ok: false, reason: 'too few white cells' };

  const { across, down } = extractRunsFromMask(mask);
  for (const run of across) {
    if (run.length === 1) return { ok: false, reason: 'one-cell across run' };
    if (run.length > 9) return { ok: false, reason: 'across run > 9' };
    const first = run[0]!;
    // Must be preceded by a non-white cell (or board edge → invalid; need clue cell)
    if (first.col === 0) return { ok: false, reason: 'across run starts at left edge' };
    if (mask[first.row]![first.col - 1]) return { ok: false, reason: 'across run not preceded by block' };
  }
  for (const run of down) {
    if (run.length === 1) return { ok: false, reason: 'one-cell down run' };
    if (run.length > 9) return { ok: false, reason: 'down run > 9' };
    const first = run[0]!;
    if (first.row === 0) return { ok: false, reason: 'down run starts at top edge' };
    if (mask[first.row - 1]![first.col]) return { ok: false, reason: 'down run not preceded by block' };
  }

  // Every white cell in exactly one across and one down
  const acrossOwner = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const downOwner = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (const run of across) for (const { row, col } of run) acrossOwner[row]![col]! += 1;
  for (const run of down) for (const { row, col } of run) downOwner[row]![col]! += 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r]![c]) continue;
      if (acrossOwner[r]![c] !== 1 || downOwner[r]![c] !== 1) {
        return { ok: false, reason: `white cell ${r},${c} run membership invalid` };
      }
    }
  }
  return { ok: true };
}

/**
 * Approximate 180° symmetry for playable cells only.
 * Prefer the UNION of whites so symmetry does not carve large black voids.
 * Do NOT mirror the top/left clue band onto the bottom/right edges.
 */
function apply180Symmetry(mask: WhiteMask): void {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  for (let c = 0; c < cols; c++) mask[0]![c] = false;
  for (let r = 0; r < rows; r++) mask[r]![0] = false;

  for (let r = 1; r < rows; r++) {
    for (let c = 1; c < cols; c++) {
      const rr = rows - 1 - r;
      const cc = cols - 1 - c;
      if (rr < 1 || cc < 1) continue;
      if (r * cols + c > rr * cols + cc) continue;
      const white = mask[r]![c]! || mask[rr]![cc]!;
      mask[r]![c] = white;
      mask[rr]![cc] = white;
    }
  }
}

function countWhite(mask: WhiteMask): number {
  let n = 0;
  for (const row of mask) for (const v of row) if (v) n += 1;
  return n;
}

function rowIsAllBlack(mask: WhiteMask, row: number): boolean {
  const cols = mask[0]?.length ?? 0;
  for (let c = 0; c < cols; c++) if (mask[row]![c]) return false;
  return true;
}

function colIsAllBlack(mask: WhiteMask, col: number): boolean {
  for (let r = 0; r < mask.length; r++) if (mask[r]![col]) return false;
  return true;
}

/** Count solid 2×2 black blocks inside the playable area (excludes forced clue bands). */
function countBlackVoids2x2(mask: WhiteMask): number {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  let void2 = 0;
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (
        !mask[r]![c] &&
        !mask[r]![c + 1] &&
        !mask[r + 1]![c] &&
        !mask[r + 1]![c + 1]
      ) {
        void2 += 1;
      }
    }
  }
  return void2;
}

/**
 * Prefer Across/Down run starts near the clue band (col/row 1–3),
 * so white playable area begins quickly instead of a left black slab.
 */
function pickStartNearClueBand(maxStart: number, rand: () => number): number {
  if (maxStart < 1) return 1;
  const roll = rand();
  if (maxStart >= 1 && roll < 0.48) return 1;
  if (maxStart >= 2 && roll < 0.78) return 2;
  if (maxStart >= 3 && roll < 0.92) return Math.min(3, maxStart);
  return 1 + Math.floor(rand() * maxStart);
}

function lengthMix(
  minLen: number,
  maxLen: number,
  rand: () => number
): number {
  // Bias toward a mix: more 3–5, fewer extremes.
  const span = Math.max(0, maxLen - minLen);
  if (span === 0) return minLen;
  const roll = rand();
  if (roll < 0.18) return minLen;
  if (roll < 0.78) {
    const midMin = Math.min(maxLen, Math.max(minLen, 3));
    const midMax = Math.min(maxLen, Math.max(midMin, 5));
    return midMin + Math.floor(rand() * (midMax - midMin + 1));
  }
  return minLen + Math.floor(rand() * (span + 1));
}

function repairMask(mask: WhiteMask, maxLen = 9): boolean {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const splitAt = Math.min(9, Math.max(2, maxLen));
  for (let pass = 0; pass < 16; pass++) {
    let changed = false;
    // Only top row / left column are forced black (clue hosts).
    // Never force bottom row or rightmost column black.
    for (let r = 0; r < rows; r++) mask[r]![0] = false;
    for (let c = 0; c < cols; c++) mask[0]![c] = false;

    const { across, down } = extractRunsFromMask(mask);
    for (const run of [...across, ...down]) {
      if (run.length === 1) {
        mask[run[0]!.row]![run[0]!.col] = false;
        changed = true;
      } else if (run.length > splitAt) {
        // Split long runs so clues stay combinatorially tractable / unique-friendly
        const mid = run[Math.floor(run.length / 2)]!;
        mask[mid.row]![mid.col] = false;
        changed = true;
      }
    }

    const { across: a2, down: d2 } = extractRunsFromMask(mask);
    const acrossLen = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    const downLen = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
    for (const run of a2) for (const { row, col } of run) acrossLen[row]![col] = run.length;
    for (const run of d2) for (const { row, col } of run) downLen[row]![col] = run.length;
    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        if (!mask[r]![c]) continue;
        if ((acrossLen[r]![c] ?? 0) < 2 || (downLen[r]![c] ?? 0) < 2) {
          mask[r]![c] = false;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return validateKakuroTopologyMask(mask).ok;
}

function topologyQuality(mask: WhiteMask, difficulty: KakuroDifficulty): number {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const { across, down } = extractRunsFromMask(mask);
  const runs = [...across, ...down];
  if (runs.length < 6) return -1;

  const white = countWhite(mask);
  const usable = Math.max(1, rows * cols - rows - cols + 1);
  const density = white / usable;
  const densTarget =
    difficulty === 'easy' ? 0.52 : difficulty === 'medium' ? 0.55 : 0.58;
  let score = 45 - Math.abs(density - densTarget) * 140;

  const lengths = runs.map((r) => r.length);
  const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const lenTarget = difficulty === 'easy' ? 3.2 : difficulty === 'medium' ? 3.6 : 4.1;
  score += 22 - Math.abs(avg - lenTarget) * 10;

  const short = lengths.filter((l) => l === 2).length;
  const long = lengths.filter((l) => l >= 6).length;
  const mid = lengths.filter((l) => l >= 3 && l <= 5).length;
  score += Math.min(22, mid * 1.35);
  score -= Math.max(0, short - runs.length * 0.45) * 2.4;
  score -= long * 2.5;

  // Balanced Across vs Down count
  const balance =
    1 -
    Math.abs(across.length - down.length) /
      Math.max(1, across.length + down.length);
  score += balance * 14;

  const void2 = countBlackVoids2x2(mask);
  score -= void2 * 3.2;

  // Penalize left-side black slab in columns 1–2 (0-based) of playable rows
  let leftBlack = 0;
  let leftCells = 0;
  for (let r = 1; r < rows; r++) {
    for (let c = 1; c <= Math.min(2, cols - 1); c++) {
      leftCells += 1;
      if (!mask[r]![c]) leftBlack += 1;
    }
  }
  const leftBlackRatio = leftCells > 0 ? leftBlack / leftCells : 0;
  score -= Math.max(0, leftBlackRatio - 0.42) * 55;

  // Reward Across runs that start near the left clue band (col 1–3)
  let earlyAcross = 0;
  for (const a of across) {
    const startCol = a[0]!.col;
    if (startCol <= 3) earlyAcross += 1;
  }
  score += Math.min(18, earlyAcross * 1.6);

  let dual = 0;
  for (const a of across) {
    const ar = a[0]!.row;
    const ac = a[0]!.col - 1;
    for (const d of down) {
      if (d[0]!.row - 1 === ar && d[0]!.col === ac) dual += 1;
    }
  }
  score += Math.min(18, dual * 2.1);

  // No decorative black frame on bottom / right
  if (rowIsAllBlack(mask, rows - 1)) score -= 35;
  else score += 12;
  if (colIsAllBlack(mask, cols - 1)) score -= 35;
  else score += 12;

  let edgeEnds = 0;
  for (const run of across) {
    if (run[run.length - 1]!.col === cols - 1) edgeEnds += 1;
  }
  for (const run of down) {
    if (run[run.length - 1]!.row === rows - 1) edgeEnds += 1;
  }
  score += Math.min(14, edgeEnds * 2);

  return score;
}

/**
 * Professional-style Kakuro topology: dense playable white area, Across runs
 * usually starting at col 2–3 (1-based), clues distributed, fewer black slabs.
 * Bottom row and rightmost column may contain playable cells.
 */
function generateTopologyMask(
  rows: number,
  cols: number,
  difficulty: KakuroDifficulty,
  pattern: KakuroPattern,
  rand: () => number,
  deadline: number
): WhiteMask | null {
  const minLen = 2;
  const maxLen =
    rows >= 10
      ? difficulty === 'hard'
        ? 5
        : 4
      : rows >= 9
        ? difficulty === 'easy'
          ? 4
          : 5
        : rows >= 8
          ? difficulty === 'easy'
            ? 4
            : 5
          : difficulty === 'easy'
            ? 5
            : difficulty === 'medium'
              ? 6
              : 7;
  const usable = Math.max(1, rows * cols - rows - cols + 1);
  // Left-start look with enough black separators for unique clues.
  const baseDens =
    difficulty === 'easy' ? 0.52 : difficulty === 'medium' ? 0.55 : 0.58;
  const sizePenalty = rows >= 10 ? 0.08 : rows >= 9 ? 0.05 : 0;
  const densTarget = Math.max(0.42, baseDens - sizePenalty);
  const targetWhite = Math.round(usable * densTarget);

  let best: WhiteMask | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 700; attempt++) {
    if (Date.now() > deadline) break;
    const mask = emptyWhiteMask(rows, cols);

    const tryPaint = (horizontal: boolean, length: number, row: number, col: number) => {
      if (horizontal) {
        if (row < 1 || col < 1 || col + length > cols) return false;
        if (mask[row]![col - 1]) return false;
        for (let i = 0; i < length; i++) mask[row]![col + i] = true;
        return true;
      }
      if (col < 1 || row < 1 || row + length > rows) return false;
      if (mask[row - 1]![col]) return false;
      for (let i = 0; i < length; i++) mask[row + i]![col] = true;
      return true;
    };

    // Primary Across: prefer starts at col 1–3 so whites begin near the left clue band
    for (let row = 1; row < rows; row++) {
      const length = lengthMix(minLen, maxLen, rand);
      const maxStart = cols - length;
      if (maxStart < 1) continue;
      const preferred = pickStartNearClueBand(maxStart, rand);
      const starts = [
        preferred,
        ...[1, 2, 3].filter((c) => c <= maxStart && c !== preferred),
        ...Array.from({ length: maxStart }, (_, i) => i + 1),
      ];
      const seen = new Set<number>();
      for (const col of starts) {
        if (seen.has(col)) continue;
        seen.add(col);
        if (tryPaint(true, length, row, col)) break;
      }
      // Optional second Across further right (black separator from tryPaint)
      if (cols >= 7 && rand() < (cols >= 9 ? 0.45 : 0.65)) {
        const length2 = lengthMix(minLen, Math.min(maxLen, 5), rand);
        const maxStart2 = cols - length2;
        if (maxStart2 >= 2) {
          const start2 = Math.min(
            maxStart2,
            3 + Math.floor(rand() * Math.max(1, maxStart2 - 2))
          );
          tryPaint(true, length2, row, start2);
        }
      }
    }

    // Primary Down: prefer starts near top clue band (row 1–3)
    for (let col = 1; col < cols; col++) {
      const length = lengthMix(minLen, maxLen, rand);
      const maxStart = rows - length;
      if (maxStart < 1) continue;
      const preferred = pickStartNearClueBand(maxStart, rand);
      const starts = [
        preferred,
        ...[1, 2, 3].filter((r) => r <= maxStart && r !== preferred),
        ...Array.from({ length: maxStart }, (_, i) => i + 1),
      ];
      const seen = new Set<number>();
      for (const row of starts) {
        if (seen.has(row)) continue;
        seen.add(row);
        if (tryPaint(false, length, row, col)) break;
      }
      if (rows >= 7 && rand() < (rows >= 9 ? 0.45 : 0.65)) {
        const length2 = lengthMix(minLen, Math.min(maxLen, 5), rand);
        const maxStart2 = rows - length2;
        if (maxStart2 >= 2) {
          const start2 = Math.min(
            maxStart2,
            3 + Math.floor(rand() * Math.max(1, maxStart2 - 2))
          );
          tryPaint(false, length2, start2, col);
        }
      }
    }

    // Seed left-side Across explicitly (col start 1 or 2) on many rows
    for (let row = 1; row < rows; row++) {
      if (rand() > 0.82) continue;
      const length = lengthMix(minLen, Math.min(maxLen, 6), rand);
      const start = rand() < 0.65 ? 1 : 2;
      if (start + length <= cols) tryPaint(true, length, row, start);
    }

    // Seed top-side Down explicitly (row start 1 or 2) on many cols
    for (let col = 1; col < cols; col++) {
      if (rand() > 0.82) continue;
      const length = lengthMix(minLen, Math.min(maxLen, 6), rand);
      const start = rand() < 0.65 ? 1 : 2;
      if (start + length <= rows) tryPaint(false, length, start, col);
    }

    // Edge-ending runs (right / bottom) for a published Kakuro silhouette
    {
      const bottom = rows - 1;
      const right = cols - 1;
      for (let n = 0; n < 4; n++) {
        const length = lengthMix(minLen, Math.min(maxLen, 5), rand);
        tryPaint(true, length, bottom, Math.max(1, right - length + 1));
      }
      for (let n = 0; n < 4; n++) {
        const length = lengthMix(minLen, Math.min(maxLen, 5), rand);
        tryPaint(false, length, Math.max(1, bottom - length + 1), right);
      }
      for (let n = 0; n < Math.max(2, Math.floor(rows / 3)); n++) {
        const row = 1 + Math.floor(rand() * (rows - 1));
        const length = lengthMix(minLen, Math.min(maxLen, 5), rand);
        tryPaint(true, length, row, Math.max(1, right - length + 1));
      }
      for (let n = 0; n < Math.max(2, Math.floor(cols / 3)); n++) {
        const col = 1 + Math.floor(rand() * (cols - 1));
        const length = lengthMix(minLen, Math.min(maxLen, 5), rand);
        tryPaint(false, length, Math.max(1, bottom - length + 1), col);
      }
    }

    // Grow density with a left-start bias
    let guard = 0;
    while (countWhite(mask) < targetWhite && guard++ < 140) {
      const horizontal = rand() < 0.52;
      const length = lengthMix(minLen, maxLen, rand);
      if (horizontal) {
        const row = 1 + Math.floor(rand() * (rows - 1));
        const maxStart = cols - length;
        if (maxStart < 1) continue;
        tryPaint(true, length, row, pickStartNearClueBand(maxStart, rand));
      } else {
        const col = 1 + Math.floor(rand() * (cols - 1));
        const maxStart = rows - length;
        if (maxStart < 1) continue;
        tryPaint(false, length, pickStartNearClueBand(maxStart, rand), col);
      }
    }

    // Break large black voids with short white runs
    for (let pass = 0; pass < 4; pass++) {
      if (countBlackVoids2x2(mask) === 0) break;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          if (
            mask[r]![c] ||
            mask[r]![c + 1] ||
            mask[r + 1]![c] ||
            mask[r + 1]![c + 1]
          ) {
            continue;
          }
          const length = 2 + Math.floor(rand() * 2);
          if (rand() < 0.55) {
            tryPaint(true, length, r, Math.max(1, Math.min(c, cols - length)));
          } else {
            tryPaint(false, length, Math.max(1, Math.min(r, rows - length)), c);
          }
        }
      }
    }

    if (pattern === 'rotational') apply180Symmetry(mask);

    // After symmetry, densify again if whites were lost / voids appeared
    guard = 0;
    while (countWhite(mask) < targetWhite && guard++ < 80) {
      const length = lengthMix(minLen, Math.min(maxLen, 5), rand);
      if (rand() < 0.55) {
        const row = 1 + Math.floor(rand() * (rows - 1));
        const maxStart = cols - length;
        if (maxStart >= 1) {
          tryPaint(true, length, row, pickStartNearClueBand(maxStart, rand));
        }
      } else {
        const col = 1 + Math.floor(rand() * (cols - 1));
        const maxStart = rows - length;
        if (maxStart >= 1) {
          tryPaint(false, length, pickStartNearClueBand(maxStart, rand), col);
        }
      }
    }

    // Gentle thin only if significantly over target — avoid creating left slabs
    guard = 0;
    while (countWhite(mask) > targetWhite * 1.18 && guard++ < 40) {
      const r = 1 + Math.floor(rand() * (rows - 1));
      // Prefer thinning deeper columns, not the left playable band
      const cMin = Math.min(cols - 1, 3);
      const c = cMin + Math.floor(rand() * Math.max(1, cols - cMin));
      if (c >= 1 && mask[r]![c]) mask[r]![c] = false;
    }

    const ensureEdgePlayable = () => {
      const bottom = rows - 1;
      const right = cols - 1;
      if (rowIsAllBlack(mask, bottom) || colIsAllBlack(mask, right)) {
        for (let n = 0; n < 6; n++) {
          const length = 2 + Math.floor(rand() * 3);
          tryPaint(true, length, bottom, Math.max(1, right - length + 1));
          tryPaint(false, length, Math.max(1, bottom - length + 1), right);
          const row = 1 + Math.floor(rand() * (rows - 1));
          const col = 1 + Math.floor(rand() * (cols - 1));
          tryPaint(true, length, row, Math.max(1, right - length + 1));
          tryPaint(false, length, Math.max(1, bottom - length + 1), col);
        }
      }
    };
    ensureEdgePlayable();

    if (!repairMask(mask, maxLen)) continue;

    if (rowIsAllBlack(mask, rows - 1) || colIsAllBlack(mask, cols - 1)) {
      ensureEdgePlayable();
      if (!repairMask(mask, maxLen)) continue;
      if (rowIsAllBlack(mask, rows - 1) || colIsAllBlack(mask, cols - 1)) continue;
    }

    const white = countWhite(mask);
    const dens = white / usable;
    if (dens < densTarget - 0.12 || dens > densTarget + 0.14) continue;

    const score = topologyQuality(mask, difficulty);
    if (score < 34) continue;
    if (score > bestScore) {
      bestScore = score;
      best = cloneMask(mask);
    }
    if (score >= 62 && dens >= densTarget - 0.06 && countBlackVoids2x2(mask) <= 2) {
      return mask;
    }
  }

  return best;
}

function buildCellsAndRuns(
  mask: WhiteMask,
  solution: number[][]
): { cells: KakuroCell[][]; runs: KakuroRun[] } {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const { across, down } = extractRunsFromMask(mask);
  const cells: KakuroCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      if (mask[r]![c]) return { type: 'playable' as const, across: null, down: null };
      return { type: 'block' as const, across: null, down: null };
    })
  );

  const runs: KakuroRun[] = [];
  let aId = 0;
  let dId = 0;

  for (const runCells of across) {
    const clueCell = { row: runCells[0]!.row, col: runCells[0]!.col - 1 };
    let sum = 0;
    for (const { row, col } of runCells) sum += solution[row]![col]!;
    const host = cells[clueCell.row]![clueCell.col]!;
    host.type = 'clue';
    host.across = sum;
    aId += 1;
    runs.push({
      id: `A${aId}`,
      direction: 'across',
      clue: sum,
      cells: runCells,
    });
  }
  for (const runCells of down) {
    const clueCell = { row: runCells[0]!.row - 1, col: runCells[0]!.col };
    let sum = 0;
    for (const { row, col } of runCells) sum += solution[row]![col]!;
    const host = cells[clueCell.row]![clueCell.col]!;
    if (host.type === 'block') host.type = 'clue';
    host.type = 'clue';
    host.down = sum;
    dId += 1;
    runs.push({
      id: `D${dId}`,
      direction: 'down',
      clue: sum,
      cells: runCells,
    });
  }
  return { cells, runs };
}

/** Fill white cells with digits 1–9 unique within each across/down run.
 * Brief unique-sum attempt, then reliable extreme-biased cell fill.
 */
function generateDigitAssignment(
  mask: WhiteMask,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): number[][] | null {
  const span = Math.max(0, deadline - Date.now());
  if (span >= 80) {
    const strict = generateDigitAssignmentByCombos(
      mask,
      rand,
      Math.min(deadline, Date.now() + Math.min(400, span * 0.25)),
      signal,
      { uniqueOnly: true }
    );
    if (strict) return strict;
  }
  if (span >= 80 && Date.now() + 50 < deadline) {
    const soft = generateDigitAssignmentByCombos(
      mask,
      rand,
      Math.min(deadline, Date.now() + Math.min(400, span * 0.2)),
      signal,
      { uniqueOnly: false, maxAmbiguity: 2 }
    );
    if (soft) return soft;
  }
  if (signal?.cancelled || Date.now() > deadline) return null;
  return generateDigitAssignmentByCells(mask, rand, deadline, signal);
}

/** Places low-ambiguity combinations first so published-style unique clues are likely. */
function generateDigitAssignmentByCombos(
  mask: WhiteMask,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean },
  opts?: { uniqueOnly?: boolean; maxAmbiguity?: number }
): number[][] | null {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const { across, down } = extractRunsFromMask(mask);
  const runs = [...across, ...down];
  // Shorter runs first — lock unique small sums, then fit longer crossings
  runs.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    return rand() < 0.5 ? -1 : 1;
  });

  const acrossOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  const downOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  across.forEach((run, i) => run.forEach(({ row, col }) => (acrossOf[row]![col] = i)));
  down.forEach((run, i) => run.forEach(({ row, col }) => (downOf[row]![col] = i)));

  const acrossMask = across.map(() => 0);
  const downMask = down.map(() => 0);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

  const setDigit = (row: number, col: number, d: number) => {
    grid[row]![col] = d;
    const ai = acrossOf[row]![col]!;
    const di = downOf[row]![col]!;
    acrossMask[ai] = maskAdd(acrossMask[ai]!, d);
    downMask[di] = maskAdd(downMask[di]!, d);
  };
  const clearDigit = (row: number, col: number, d: number) => {
    grid[row]![col] = 0;
    const ai = acrossOf[row]![col]!;
    const di = downOf[row]![col]!;
    acrossMask[ai] = maskRemove(acrossMask[ai]!, d);
    downMask[di] = maskRemove(downMask[di]!, d);
  };

  const canPlace = (row: number, col: number, d: number) => {
    const ai = acrossOf[row]![col]!;
    const di = downOf[row]![col]!;
    return !maskHas(acrossMask[ai]!, d) && !maskHas(downMask[di]!, d);
  };

  const permutations = (digits: number[]): number[][] => {
    if (digits.length <= 1) return [digits.slice()];
    const out: number[][] = [];
    for (let i = 0; i < digits.length; i++) {
      const rest = digits.slice(0, i).concat(digits.slice(i + 1));
      for (const p of permutations(rest)) out.push([digits[i]!, ...p]);
    }
    return out;
  };

  const placeRun = (runIdx: number): boolean => {
    if (signal?.cancelled || Date.now() > deadline) return false;
    if (runIdx >= runs.length) return true;

    const run = runs[runIdx]!;
    const open = run.filter(({ row, col }) => grid[row]![col] === 0);
    if (open.length === 0) return placeRun(runIdx + 1);

    const filled = run.filter(({ row, col }) => grid[row]![col] !== 0);
    let used = 0;
    let usedSum = 0;
    for (const { row, col } of filled) {
      const d = grid[row]![col]!;
      used = maskAdd(used, d);
      usedSum += d;
    }
    const n = run.length;
    const remain = open.length;

    type Cand = { rem: number[]; ambiguity: number; extremeness: number };
    const cands: Cand[] = [];
    for (let sum = kakuroMinSum(n); sum <= kakuroMaxSum(n); sum++) {
      const combos = getKakuroCombinations(n, sum);
      if (combos.length === 0) continue;
      const ambiguity = combos.length;
      const mid = (kakuroMinSum(n) + kakuroMaxSum(n)) / 2;
      const extremeness = Math.abs(sum - mid);
      for (const combo of combos) {
        const cm = digitMask(combo);
        if ((cm & used) !== used) continue;
        const rem = combo.filter((d) => !maskHas(used, d));
        if (rem.length !== remain) continue;
        if (usedSum + rem.reduce((a, b) => a + b, 0) !== sum) continue;
        cands.push({ rem, ambiguity, extremeness });
      }
    }

    cands.sort((a, b) => {
      if (a.ambiguity !== b.ambiguity) return a.ambiguity - b.ambiguity;
      if (a.extremeness !== b.extremeness) return b.extremeness - a.extremeness;
      return rand() < 0.5 ? -1 : 1;
    });

    // Prefer unique (ambiguity 1) sums; allow more options only if needed
    const maxAmb = opts?.uniqueOnly ? 1 : (opts?.maxAmbiguity ?? 9);
    const filtered = cands.filter((c) => c.ambiguity <= maxAmb);
    const uniqueOnly = filtered.filter((c) => c.ambiguity === 1);
    const pool =
      !opts?.uniqueOnly && uniqueOnly.length > 0 && rand() < 0.72
        ? uniqueOnly
        : filtered;
    if (pool.length === 0) return false;
    const limited = pool.slice(0, Math.min(pool.length, opts?.uniqueOnly ? 12 : 20));
    shuffleInPlace(limited.slice(0, Math.min(5, limited.length)), rand);

    for (const cand of limited) {
      let perms = permutations(cand.rem);
      if (perms.length > 24) {
        shuffleInPlace(perms, rand);
        perms = perms.slice(0, 24);
      } else {
        shuffleInPlace(perms, rand);
      }
      for (const perm of perms) {
        let ok = true;
        for (let i = 0; i < open.length; i++) {
          const { row, col } = open[i]!;
          if (!canPlace(row, col, perm[i]!)) {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        for (let i = 0; i < open.length; i++) {
          const { row, col } = open[i]!;
          setDigit(row, col, perm[i]!);
        }
        if (placeRun(runIdx + 1)) return true;
        for (let i = 0; i < open.length; i++) {
          const { row, col } = open[i]!;
          clearDigit(row, col, perm[i]!);
        }
      }
    }
    return false;
  };

  return placeRun(0) ? grid : null;
}

/** Fast MRV cell fill with extreme-digit bias (fallback when combo placement fails). */
function generateDigitAssignmentByCells(
  mask: WhiteMask,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): number[][] | null {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const { across, down } = extractRunsFromMask(mask);
  const whites: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (mask[r]![c]) whites.push({ row: r, col: c });
  }

  const acrossOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  const downOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  across.forEach((run, i) => run.forEach(({ row, col }) => (acrossOf[row]![col] = i)));
  down.forEach((run, i) => run.forEach(({ row, col }) => (downOf[row]![col] = i)));

  const acrossMask = across.map(() => 0);
  const downMask = down.map(() => 0);
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const order = whites.slice();
  shuffleInPlace(order, rand);

  // Prefer extremes harder: mid-range sums are combinatorially ambiguous.
  const extremity = (d: number) => Math.min(d - 1, 9 - d);
  const candidates = (r: number, c: number): number[] => {
    const ai = acrossOf[r]![c]!;
    const di = downOf[r]![c]!;
    const used = acrossMask[ai]! | downMask[di]!;
    const opts: number[] = [];
    for (let d = 1; d <= 9; d++) if (!maskHas(used, d)) opts.push(d);
    if (rand() < 0.06) shuffleInPlace(opts, rand);
    else {
      opts.sort((a, b) => extremity(a) - extremity(b) || (rand() < 0.5 ? -1 : 1));
      if (rand() < 0.48) opts.reverse();
    }
    return opts;
  };

  const search = (filled: number): boolean => {
    if (signal?.cancelled || Date.now() > deadline) return false;
    if (filled >= order.length) return true;
    let bestIdx = -1;
    let bestOpts: number[] = [];
    for (let i = 0; i < order.length; i++) {
      const { row, col } = order[i]!;
      if (grid[row]![col]) continue;
      const opts = candidates(row, col);
      if (opts.length === 0) return false;
      if (bestIdx < 0 || opts.length < bestOpts.length) {
        bestIdx = i;
        bestOpts = opts;
        if (opts.length === 1) break;
      }
    }
    if (bestIdx < 0) return true;
    const { row, col } = order[bestIdx]!;
    const ai = acrossOf[row]![col]!;
    const di = downOf[row]![col]!;
    for (const d of bestOpts) {
      grid[row]![col] = d;
      acrossMask[ai] = maskAdd(acrossMask[ai]!, d);
      downMask[di] = maskAdd(downMask[di]!, d);
      if (search(filled + 1)) return true;
      acrossMask[ai] = maskRemove(acrossMask[ai]!, d);
      downMask[di] = maskRemove(downMask[di]!, d);
      grid[row]![col] = 0;
    }
    return false;
  };

  return search(0) ? grid : null;
}

type SolverRun = {
  clue: number;
  cells: Array<{ row: number; col: number }>;
  combos: number[][]; // digit sets as sorted arrays
};

function buildSolverState(puzzle: KakuroPuzzle): {
  rows: number;
  cols: number;
  cellCand: number[][]; // bitmask per cell; 0 if non-playable
  acrossRuns: SolverRun[];
  downRuns: SolverRun[];
  acrossOf: number[][];
  downOf: number[][];
} {
  const rows = puzzle.rows;
  const cols = puzzle.columns;
  const cellCand = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (puzzle.cells[r]![c]!.type === 'playable') cellCand[r]![c] = 0x1ff; // 1–9
    }
  }
  const acrossRuns: SolverRun[] = [];
  const downRuns: SolverRun[] = [];
  const acrossOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));
  const downOf = Array.from({ length: rows }, () => Array.from({ length: cols }, () => -1));

  for (const run of puzzle.runs) {
    const combos = getKakuroCombinations(run.cells.length, run.clue);
    const sr: SolverRun = { clue: run.clue, cells: run.cells, combos };
    if (run.direction === 'across') {
      const idx = acrossRuns.length;
      acrossRuns.push(sr);
      for (const { row, col } of run.cells) acrossOf[row]![col] = idx;
    } else {
      const idx = downRuns.length;
      downRuns.push(sr);
      for (const { row, col } of run.cells) downOf[row]![col] = idx;
    }
  }
  return { rows, cols, cellCand, acrossRuns, downRuns, acrossOf, downOf };
}

function knownDigit(cand: number): number {
  if (cand === 0 || maskPopcount(cand) !== 1) return 0;
  for (let d = 1; d <= 9; d++) if (maskHas(cand, d)) return d;
  return 0;
}

function propagateKakuro(state: ReturnType<typeof buildSolverState>): boolean {
  const { cellCand, acrossRuns, downRuns } = state;
  let changed = true;
  while (changed) {
    changed = false;
    for (const runs of [acrossRuns, downRuns]) {
      for (const run of runs) {
        // Digits already placed in this run
        let used = 0;
        let solvedSum = 0;
        const openIdx: number[] = [];
        for (let i = 0; i < run.cells.length; i++) {
          const { row, col } = run.cells[i]!;
          const k = knownDigit(cellCand[row]![col]!);
          if (k) {
            if (maskHas(used, k)) return false;
            used = maskAdd(used, k);
            solvedSum += k;
          } else openIdx.push(i);
        }
        const remainCells = openIdx.length;
        const remainSum = run.clue - solvedSum;
        if (remainCells === 0) {
          if (remainSum !== 0) return false;
          continue;
        }
        if (remainSum < kakuroMinSum(remainCells) || remainSum > kakuroMaxSum(remainCells)) {
          return false;
        }

        // Filter combinations compatible with used digits + open cell candidates.
        // Narrowing run.combos is safe only when search() restores them on backtrack.
        const validCombos: number[][] = [];
        for (const combo of run.combos) {
          const cm = digitMask(combo);
          if ((cm & used) !== used) continue; // must contain all used digits
          // Remaining digits in combo after removing used
          const remMask = cm & ~used;
          if (maskPopcount(remMask) !== remainCells) continue;
          validCombos.push(combo);
        }
        if (validCombos.length === 0) return false;
        run.combos = validCombos;

        // Union of remaining digits across valid combos
        let unionRem = 0;
        for (const combo of validCombos) {
          unionRem |= digitMask(combo) & ~used;
        }

        for (const i of openIdx) {
          const { row, col } = run.cells[i]!;
          const before = cellCand[row]![col]!;
          const next = before & unionRem & ~used;
          if (next !== before) {
            cellCand[row]![col] = next;
            changed = true;
          }
          if (cellCand[row]![col] === 0) return false;
        }

        // Position-wise digits from permutations of remaining set (approx via combo remainders)
        // For each open cell, intersect with digits that appear in some valid assignment
        if (remainCells <= 5 && validCombos.length <= 40) {
          const remDigitsList = validCombos.map((combo) =>
            combo.filter((d) => !maskHas(used, d))
          );
          // Permute remaining digits into open slots checking cell cand
          const posUnion = openIdx.map(() => 0);
          const assign = (digits: number[], depth: number, usedLocal: number): boolean => {
            if (depth >= openIdx.length) return true;
            const { row, col } = run.cells[openIdx[depth]!]!;
            let any = false;
            for (const d of digits) {
              if (maskHas(usedLocal, d)) continue;
              if (!maskHas(cellCand[row]![col]!, d)) continue;
              posUnion[depth]! |= 1 << (d - 1);
              any = true;
              // Don't full recurse all — just mark possible; use light recursion
            }
            // Light: mark all digits that fit this cell from rem set
            return any || depth === 0;
          };
          for (const rem of remDigitsList) {
            for (let pi = 0; pi < openIdx.length; pi++) {
              const { row, col } = run.cells[openIdx[pi]!]!;
              for (const d of rem) {
                if (maskHas(cellCand[row]![col]!, d)) posUnion[pi]! |= 1 << (d - 1);
              }
            }
          }
          for (let pi = 0; pi < openIdx.length; pi++) {
            const { row, col } = run.cells[openIdx[pi]!]!;
            const before = cellCand[row]![col]!;
            const next = before & posUnion[pi]!;
            if (next !== before) {
              cellCand[row]![col] = next;
              changed = true;
            }
            if (cellCand[row]![col] === 0) return false;
          }
          void assign;
        }
      }
    }
  }
  return true;
}

function boardFromCand(state: ReturnType<typeof buildSolverState>): number[][] | null {
  const { rows, cols, cellCand } = state;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cand = cellCand[r]![c]!;
      if (cand === 0) continue;
      const d = knownDigit(cand);
      if (!d) return null;
      grid[r]![c] = d;
    }
  }
  return grid;
}

function findMrvCell(state: ReturnType<typeof buildSolverState>): { r: number; c: number; opts: number[] } | null {
  let best: { r: number; c: number; opts: number[] } | null = null;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cand = state.cellCand[r]![c]!;
      if (cand === 0) continue;
      if (knownDigit(cand)) continue;
      const opts = maskToDigits(cand);
      if (!best || opts.length < best.opts.length) {
        best = { r, c, opts };
        if (opts.length <= 1) return best;
      }
    }
  }
  return best;
}

function cloneCand(cellCand: number[][]): number[][] {
  return cellCand.map((row) => row.slice());
}

/** Count solutions up to `limit` (typically 2). Uses only topology + clues.
 * Returns -1 if the uniqueness search hits its node/time budget (inconclusive).
 */
export function countKakuroSolutions(
  puzzle: KakuroPuzzle,
  limit = 2,
  signal?: { cancelled?: boolean },
  budget?: { maxNodes?: number; deadline?: number }
): number {
  const state = buildSolverState(puzzle);
  if (!propagateKakuro(state)) return 0;
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const maxNodes = budget?.maxNodes ?? 200000;
  const digDeadline = budget?.deadline ?? Number.POSITIVE_INFINITY;

  const snapCombos = () => ({
    across: state.acrossRuns.map((r) => r.combos),
    down: state.downRuns.map((r) => r.combos),
  });
  const restoreCombos = (snap: { across: number[][][]; down: number[][][] }) => {
    for (let i = 0; i < state.acrossRuns.length; i++) {
      state.acrossRuns[i]!.combos = snap.across[i]!;
    }
    for (let i = 0; i < state.downRuns.length; i++) {
      state.downRuns[i]!.combos = snap.down[i]!;
    }
  };

  const search = (): void => {
    if (signal?.cancelled || count >= limit || aborted) return;
    if (++nodes > maxNodes || Date.now() > digDeadline) {
      aborted = true;
      return;
    }
    if (!propagateKakuro(state)) return;
    if (!findMrvCell(state)) {
      const grid = boardFromCand(state);
      if (grid && validateKakuroSolution(puzzle, grid).ok) count += 1;
      return;
    }
    const cell = findMrvCell(state);
    if (!cell || cell.opts.length === 0) return;
    const { r, c, opts } = cell;
    for (const d of opts) {
      if (count >= limit || aborted) return;
      const snapCand = cloneCand(state.cellCand);
      const snapCombo = snapCombos();
      state.cellCand[r]![c] = 1 << (d - 1);
      search();
      state.cellCand = snapCand;
      restoreCombos(snapCombo);
    }
  };

  search();
  if (aborted) return -1;
  return count;
}

/**
 * Fast uniqueness test when a valid solution is already known:
 * force each playable cell away from the known digit (among live candidates) and try to solve.
 * Returns 1 (unique), 2 (alternate exists), or -1 (inconclusive).
 */
function countKakuroSolutionsWithKnown(
  puzzle: KakuroPuzzle,
  known: number[][],
  signal?: { cancelled?: boolean },
  budget?: { maxNodes?: number; deadline?: number }
): number {
  const res = findAlternateKakuroSolution(puzzle, known, signal, budget);
  if (res.status === 'invalid') return 0;
  if (res.status === 'inconclusive') return -1;
  return res.status === 'alternate' ? 2 : 1;
}

type AlternateSearchResult =
  | { status: 'unique' }
  | { status: 'alternate'; alt: number[][] }
  | { status: 'inconclusive' }
  | { status: 'invalid' };

/**
 * Like `countKakuroSolutionsWithKnown`, but hands back the alternate grid so the
 * generator can repair the fill exactly where the ambiguity lives.
 */
function findAlternateKakuroSolution(
  puzzle: KakuroPuzzle,
  known: number[][],
  signal?: { cancelled?: boolean },
  budget?: { maxNodes?: number; deadline?: number }
): AlternateSearchResult {
  if (!validateKakuroSolution(puzzle, known).ok) return { status: 'invalid' };

  const digDeadline = budget?.deadline ?? Number.POSITIVE_INFINITY;
  const maxNodes = budget?.maxNodes ?? 200000;
  let nodesUsed = 0;

  const base = buildSolverState(puzzle);
  if (!propagateKakuro(base)) return { status: 'invalid' };

  const whites: Array<{ row: number; col: number; alts: number[] }> = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.columns; c++) {
      if (puzzle.cells[r]![c]!.type !== 'playable') continue;
      const knownD = known[r]![c]!;
      const alts = maskToDigits(base.cellCand[r]![c]!).filter((d) => d !== knownD);
      if (alts.length > 0) whites.push({ row: r, col: c, alts });
    }
  }
  // Cells with the most alternate candidates first — multi-solution often shows up quickly
  whites.sort((a, b) => b.alts.length - a.alts.length);

  let altGrid: number[][] | null = null;
  const trySolveWithFixed = (fr: number, fc: number, digit: number): number => {
    const state = buildSolverState(puzzle);
    state.cellCand[fr]![fc] = 1 << (digit - 1);
    if (!propagateKakuro(state)) return 0;

    const snapCombos = () => ({
      across: state.acrossRuns.map((r) => r.combos),
      down: state.downRuns.map((r) => r.combos),
    });
    const restoreCombos = (snap: { across: number[][][]; down: number[][][] }) => {
      for (let i = 0; i < state.acrossRuns.length; i++) {
        state.acrossRuns[i]!.combos = snap.across[i]!;
      }
      for (let i = 0; i < state.downRuns.length; i++) {
        state.downRuns[i]!.combos = snap.down[i]!;
      }
    };

    let found = false;
    let aborted = false;
    const search = (): void => {
      if (signal?.cancelled || found || aborted) return;
      if (++nodesUsed > maxNodes || Date.now() > digDeadline) {
        aborted = true;
        return;
      }
      if (!propagateKakuro(state)) return;
      if (!findMrvCell(state)) {
        const grid = boardFromCand(state);
        if (grid && validateKakuroSolution(puzzle, grid).ok) {
          found = true;
          altGrid = grid;
        }
        return;
      }
      const cell = findMrvCell(state);
      if (!cell || cell.opts.length === 0) return;
      for (const d of cell.opts) {
        if (found || aborted) return;
        const snapCand = cloneCand(state.cellCand);
        const snapCombo = snapCombos();
        state.cellCand[cell.r]![cell.c] = 1 << (d - 1);
        search();
        state.cellCand = snapCand;
        restoreCombos(snapCombo);
      }
    };
    search();
    if (aborted) return -1;
    return found ? 1 : 0;
  };

  if (whites.length === 0) return { status: 'unique' }; // fully determined after propagate

  for (const { row, col, alts } of whites) {
    if (signal?.cancelled) return { status: 'inconclusive' };
    if (Date.now() > digDeadline || nodesUsed > maxNodes) return { status: 'inconclusive' };
    for (const d of alts) {
      const res = trySolveWithFixed(row, col, d);
      if (res < 0) return { status: 'inconclusive' };
      if (res > 0 && altGrid) return { status: 'alternate', alt: altGrid };
    }
  }
  return { status: 'unique' };
}

/**
 * Targeted repair: the alternate solution differs from the fill on a set of
 * cells; changing one of those digits (keeping run digits distinct) changes two
 * clue sums and destroys that ambiguity. `patterns` accumulates the ambiguity
 * patterns seen for this fill so a move cannot resurrect an earlier one.
 * Mutates `solution`; returns false when no useful move exists.
 */
function repairKakuroFill(
  mask: WhiteMask,
  solution: number[][],
  alt: number[][],
  patterns: number[][][],
  rand: () => number
): boolean {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;

  const digitsInRuns = (r: number, c: number): Set<number> => {
    const used = new Set<number>();
    for (let cc = c - 1; cc >= 0 && mask[r]![cc]; cc--) used.add(solution[r]![cc]!);
    for (let cc = c + 1; cc < cols && mask[r]![cc]; cc++) used.add(solution[r]![cc]!);
    for (let rr = r - 1; rr >= 0 && mask[rr]![c]; rr--) used.add(solution[rr]![c]!);
    for (let rr = r + 1; rr < rows && mask[rr]![c]; rr++) used.add(solution[rr]![c]!);
    return used;
  };

  // Tightness after constraint propagation: fewer remaining candidates means
  // the clue sums pin the grid down harder. Greedy descent on this measure
  // steers the fill toward uniqueness instead of wandering between swap cycles.
  const tightness = (): number => {
    const { cells, runs } = buildCellsAndRuns(mask, solution);
    const probe = {
      rows,
      columns: cols,
      cells,
      runs,
    } as unknown as KakuroPuzzle;
    const state = buildSolverState(probe);
    if (!propagateKakuro(state)) return Number.POSITIVE_INFINITY;
    let total = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cand = state.cellCand[r]![c]!;
        if (cand) total += maskPopcount(cand) - 1;
      }
    }
    return total;
  };

  // Every alternate differs from the fill by a delta pattern whose sum over
  // each run is zero, so "fill + k·delta" keeps all clues for any k. A pattern
  // is dead only when no such shift yields valid digits (1–9, distinct per
  // run). Remember every pattern seen for this fill and pick the move that
  // kills the most of them; tightness breaks ties.
  const deltaOf = (a: number[][]): number[][] =>
    a.map((row, r) => row.map((v, c) => (mask[r]![c] ? v - solution[r]![c]! : 0)));
  const alreadyKnown = (delta: number[][]): boolean =>
    patterns.some((p) =>
      p.every((row, r) => row.every((v, c) => v === delta[r]![c]))
    );
  const newDelta = deltaOf(alt);
  if (!alreadyKnown(newDelta)) patterns.push(newDelta);

  const patternAlive = (delta: number[][]): boolean => {
    for (let k = -8; k <= 8; k++) {
      if (k === 0) continue;
      let ok = true;
      for (let r = 0; r < rows && ok; r++) {
        for (let c = 0; c < cols; c++) {
          if (!mask[r]![c]) continue;
          const v = solution[r]![c]! + k * delta[r]![c]!;
          if (v < 1 || v > 9) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;
      // distinct digits per run
      const seen = new Set<number>();
      outer: for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!mask[r]![c]) continue;
          if (c === 0 || !mask[r]![c - 1]) {
            seen.clear();
            for (let cc = c; cc < cols && mask[r]![cc]; cc++) {
              const v = solution[r]![cc]! + k * delta[r]![cc]!;
              if (seen.has(v)) {
                ok = false;
                break outer;
              }
              seen.add(v);
            }
          }
          if (r === 0 || !mask[r - 1]![c]) {
            seen.clear();
            for (let rr = r; rr < rows && mask[rr]![c]; rr++) {
              const v = solution[rr]![c]! + k * delta[rr]![c]!;
              if (seen.has(v)) {
                ok = false;
                break outer;
              }
              seen.add(v);
            }
          }
        }
      }
      if (ok) return true;
    }
    return false;
  };
  const aliveCount = (): number => {
    let n = 0;
    for (const p of patterns) if (patternAlive(p)) n++;
    return n;
  };

  // Candidate cells: every cell touched by a live pattern (the newest first).
  const candidateCells: Array<{ r: number; c: number }> = [];
  const cellSeen = new Set<number>();
  const pushCells = (delta: number[][]) => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (mask[r]![c] && delta[r]![c] !== 0 && !cellSeen.has(r * cols + c)) {
          cellSeen.add(r * cols + c);
          candidateCells.push({ r, c });
        }
      }
    }
  };
  pushCells(newDelta);
  for (const p of patterns) if (p !== newDelta && patternAlive(p)) pushCells(p);

  type Move = { r: number; c: number; d: number; alive: number };
  const moves: Move[] = [];
  for (const { r, c } of candidateCells) {
    const used = digitsInRuns(r, c);
    const cur = solution[r]![c]!;
    for (let d = 1; d <= 9; d++) {
      if (d === cur || used.has(d)) continue;
      solution[r]![c] = d;
      moves.push({ r, c, d, alive: aliveCount() });
      solution[r]![c] = cur;
    }
  }
  if (!moves.length) return false;
  shuffleInPlace(moves, rand);
  moves.sort((a, b) => a.alive - b.alive);
  const bestAlive = moves[0]!.alive;
  const tied = moves.filter((m) => m.alive === bestAlive).slice(0, 16);

  let best: Move = tied[0]!;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const m of tied) {
    const cur = solution[m.r]![m.c]!;
    solution[m.r]![m.c] = m.d;
    const score = tightness();
    solution[m.r]![m.c] = cur;
    if (score < bestScore) {
      bestScore = score;
      best = m;
    }
  }
  solution[best.r]![best.c] = best.d;
  return true;
}

export function solveKakuro(
  puzzle: KakuroPuzzle,
  signal?: { cancelled?: boolean }
): number[][] | null {
  const state = buildSolverState(puzzle);
  if (!propagateKakuro(state)) return null;

  const snapCombos = () => ({
    across: state.acrossRuns.map((r) => r.combos),
    down: state.downRuns.map((r) => r.combos),
  });
  const restoreCombos = (snap: { across: number[][][]; down: number[][][] }) => {
    for (let i = 0; i < state.acrossRuns.length; i++) {
      state.acrossRuns[i]!.combos = snap.across[i]!;
    }
    for (let i = 0; i < state.downRuns.length; i++) {
      state.downRuns[i]!.combos = snap.down[i]!;
    }
  };

  const search = (): number[][] | null => {
    if (signal?.cancelled) return null;
    if (!propagateKakuro(state)) return null;
    if (!findMrvCell(state)) {
      const grid = boardFromCand(state);
      return grid && validateKakuroSolution(puzzle, grid).ok ? grid : null;
    }
    const cell = findMrvCell(state);
    if (!cell || cell.opts.length === 0) return null;
    const snapCand = cloneCand(state.cellCand);
    const snapCombo = snapCombos();
    for (const d of cell.opts) {
      state.cellCand = cloneCand(snapCand);
      restoreCombos(snapCombo);
      state.cellCand[cell.r]![cell.c] = 1 << (d - 1);
      const sol = search();
      if (sol) return sol;
    }
    state.cellCand = snapCand;
    restoreCombos(snapCombo);
    return null;
  };

  return search();
}

export function validateKakuroTopology(puzzle: KakuroPuzzle): { ok: true } | { ok: false; reason: string } {
  const mask = puzzle.cells.map((row) => row.map((cell) => cell.type === 'playable'));
  const base = validateKakuroTopologyMask(mask);
  if (!base.ok) return base;

  // Clue cells must match runs
  for (const run of puzzle.runs) {
    if (run.cells.length < 2 || run.cells.length > 9) {
      return { ok: false, reason: `bad run length ${run.id}` };
    }
    const first = run.cells[0]!;
    if (run.direction === 'across') {
      const host = puzzle.cells[first.row]?.[first.col - 1];
      if (!host || host.type !== 'clue' || host.across !== run.clue) {
        return { ok: false, reason: `across clue mismatch ${run.id}` };
      }
    } else {
      const host = puzzle.cells[first.row - 1]?.[first.col];
      if (!host || host.type !== 'clue' || host.down !== run.clue) {
        return { ok: false, reason: `down clue mismatch ${run.id}` };
      }
    }
    if (
      run.clue < kakuroMinSum(run.cells.length) ||
      run.clue > kakuroMaxSum(run.cells.length)
    ) {
      return { ok: false, reason: `impossible clue ${run.id}` };
    }
  }
  return { ok: true };
}

export function validateKakuroSolution(
  puzzle: KakuroPuzzle,
  solution: number[][]
): { ok: true } | { ok: false; reason: string } {
  const rows = puzzle.rows;
  const cols = puzzle.columns;
  if (solution.length !== rows) return { ok: false, reason: 'solution rows' };
  for (let r = 0; r < rows; r++) {
    if ((solution[r]?.length ?? 0) !== cols) return { ok: false, reason: 'solution cols' };
    for (let c = 0; c < cols; c++) {
      const playable = puzzle.cells[r]![c]!.type === 'playable';
      const v = solution[r]![c]!;
      if (playable) {
        if (!Number.isInteger(v) || v < 1 || v > 9) {
          return { ok: false, reason: `bad digit ${r},${c}` };
        }
      }
    }
  }
  for (const run of puzzle.runs) {
    const digits: number[] = [];
    let sum = 0;
    for (const { row, col } of run.cells) {
      const d = solution[row]![col]!;
      if (digits.includes(d)) return { ok: false, reason: `duplicate in ${run.id}` };
      digits.push(d);
      sum += d;
    }
    if (sum !== run.clue) return { ok: false, reason: `sum mismatch ${run.id}` };
  }
  return { ok: true };
}

export function validateKakuroPuzzle(
  puzzle: KakuroPuzzle
): { ok: true } | { ok: false; reason: string } {
  const topo = validateKakuroTopology(puzzle);
  if (!topo.ok) return topo;
  const sol = validateKakuroSolution(puzzle, puzzle.solution);
  if (!sol.ok) return sol;
  // Topology of solution playable cells must match
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.columns; c++) {
      const playable = puzzle.cells[r]![c]!.type === 'playable';
      const has = puzzle.solution[r]![c]! >= 1;
      if (playable !== has && playable && puzzle.solution[r]![c] === 0) {
        return { ok: false, reason: 'solution topology mismatch' };
      }
      if (playable && (puzzle.solution[r]![c]! < 1 || puzzle.solution[r]![c]! > 9)) {
        return { ok: false, reason: 'missing solution digit' };
      }
    }
  }
  if (countKakuroSolutions(puzzle, 2, undefined, {
    maxNodes: 350000,
    deadline: Date.now() + 20000,
  }) !== 1) {
    const known = countKakuroSolutionsWithKnown(puzzle, puzzle.solution, undefined, {
      maxNodes: 350000,
      deadline: Date.now() + 15000,
    });
    if (known !== 1) {
      return { ok: false, reason: 'puzzle is not uniquely solvable' };
    }
  }
  return { ok: true };
}

/** Lightweight difficulty score from run ambiguity + combination counts. */
export function estimateKakuroDifficultyScore(puzzle: KakuroPuzzle): number {
  let score = 0;
  let comboTotal = 0;
  for (const run of puzzle.runs) {
    const combos = getKakuroCombinations(run.cells.length, run.clue);
    const n = Math.max(1, combos.length);
    comboTotal += n;
    if (n === 1) score += 1;
    else if (n <= 3) score += 2;
    else if (n <= 6) score += 4;
    else score += 7;
    if (run.cells.length >= 5) score += 3;
    if (run.cells.length >= 7) score += 5;
  }
  const avg = comboTotal / Math.max(1, puzzle.runs.length);
  score += Math.round(avg * 2);
  // Attempt shallow unique-ish solve cost
  const nodesBefore = 0;
  void nodesBefore;
  const t0 = Date.now();
  countKakuroSolutions(puzzle, 2, undefined, { maxNodes: 8000, deadline: t0 + 400 });
  const elapsed = Date.now() - t0;
  score += Math.min(40, Math.floor(elapsed / 8));
  return score;
}

function scoreMatchesDifficulty(score: number, difficulty: KakuroDifficulty): boolean {
  if (difficulty === 'easy') return score <= 55;
  if (difficulty === 'medium') return score > 35 && score <= 110;
  return score > 70;
}

export function kakuroSignature(puzzle: KakuroPuzzle): string {
  const topo = puzzle.cells
    .map((row) =>
      row
        .map((c) => {
          if (c.type === 'playable') return '.';
          if (c.type === 'block') return '#';
          return `/${c.across ?? ''},${c.down ?? ''}`;
        })
        .join('')
    )
    .join('/');
  return `${puzzle.rows}x${puzzle.columns}:${topo}`;
}

export function generateKakuro(options: KakuroGenerateOptions = {}): KakuroPuzzle {
  const sizeOpt = options.size;
  const rows = Math.max(
    7,
    Math.min(15, Math.round(options.rows ?? (typeof sizeOpt === 'number' ? sizeOpt : 9)))
  );
  const columns = Math.max(
    7,
    Math.min(15, Math.round(options.columns ?? (typeof sizeOpt === 'number' ? sizeOpt : rows)))
  );
  const difficulty = options.difficulty ?? 'medium';
  const pattern = options.pattern ?? 'asymmetric';
  const seed = (options.seed ?? Date.now()) >>> 0;
  const timeBudgetMs =
    options.timeBudgetMs ??
    (rows >= 15 ? 70000 : rows >= 12 ? 50000 : rows >= 10 ? 40000 : rows >= 9 ? 35000 : rows >= 8 ? 30000 : 20000);
  const deadline = Date.now() + timeBudgetMs;
  const maxAttempts = rows >= 12 ? 120 : 180;
  let lastReason = 'unknown';

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.cancelled) throw new Error('Kakuro generation cancelled.');
    if (Date.now() > deadline) break;

    const rand = mulberry32((seed + attempt * 7919) >>> 0);
    const mask = generateTopologyMask(
      rows,
      columns,
      difficulty,
      pattern,
      rand,
      Math.min(deadline, Date.now() + Math.floor(timeBudgetMs * 0.18))
    );
    if (!mask) {
      lastReason = 'topology generation failed';
      continue;
    }

    // Stop starting new fills when there isn't time left to verify uniqueness
    const minUniqueMs = rows >= 9 ? 4000 : 2000;
    if (Date.now() + minUniqueMs > deadline) break;

    const fillTries = rows >= 9 ? 16 : 20;
    let accepted: KakuroPuzzle | null = null;
    for (let fill = 0; fill < fillTries; fill++) {
      if (options.signal?.cancelled) throw new Error('Kakuro generation cancelled.');
      if (Date.now() + minUniqueMs > deadline) break;

      const solution = generateDigitAssignment(
        mask,
        mulberry32((seed + attempt * 9973 + fill * 577) >>> 0),
        Math.min(deadline - minUniqueMs, Date.now() + Math.floor(timeBudgetMs * 0.14)),
        options.signal
      );
      if (!solution) {
        lastReason = 'solution generation failed';
        continue;
      }

      let whiteCount = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) if (mask[r]![c]) whiteCount += 1;
      }
      const buildPuzzle = (): KakuroPuzzle => {
        const { cells, runs } = buildCellsAndRuns(mask, solution);
        return {
          type: 'kakuro',
          id: `kakuro-${seed}-${attempt}-${fill}`,
          rows,
          columns,
          size: Math.max(rows, columns),
          difficulty,
          pattern,
          cells,
          runs,
          solution: solution.map((row) => row.slice()),
          metadata: {
            seed,
            whiteCount,
            createdAt: new Date().toISOString(),
          },
          puzzleNumber: 1,
        };
      };

      let puzzle = buildPuzzle();
      const topo = validateKakuroTopology(puzzle);
      if (!topo.ok) {
        lastReason = topo.reason;
        continue;
      }

      // Uniqueness with targeted repair: each alternate solution found tells us
      // exactly which cells are ambiguous; changing one of them (and thus two
      // clue sums) removes that ambiguity. A handful of rounds normally reaches
      // a unique puzzle where blind re-fills keep failing.
      const repairRand = mulberry32((seed + attempt * 31337 + fill * 101) >>> 0);
      // Larger grids hold more swap cycles; each repair retires at least one.
      const maxRepairs = Math.max(60, whiteCount * 4);
      const patterns: number[][][] = [];
      const perCheckNodes = rows >= 12 ? 160000 : rows >= 9 ? 120000 : 80000;
      let unique = false;
      let inconclusive = false;
      for (let repair = 0; repair <= maxRepairs; repair++) {
        if (options.signal?.cancelled) throw new Error('Kakuro generation cancelled.');
        if (Date.now() > deadline) {
          inconclusive = true;
          break;
        }
        if (!validateKakuroSolution(puzzle, solution).ok) break;
        const res = findAlternateKakuroSolution(puzzle, solution, options.signal, {
          maxNodes: perCheckNodes,
          deadline: Math.min(deadline, Date.now() + Math.max(minUniqueMs, timeBudgetMs * 0.12)),
        });
        if (res.status === 'unique') {
          unique = true;
          break;
        }
        if (res.status === 'inconclusive') {
          inconclusive = true;
          break;
        }
        if (res.status === 'invalid') break;
        if (!repairKakuroFill(mask, solution, res.alt, patterns, repairRand)) break;
        puzzle = buildPuzzle();
      }
      if (!unique) {
        lastReason = inconclusive ? 'uniqueness check inconclusive' : 'multiple solutions';
        // A fill that exhausts its repair budget means the topology itself is
        // swap-cycle rich (large white blocks); a fresh fill rarely helps, so
        // move on to a new topology after a couple of tries.
        if (!inconclusive && fill >= 1) break;
        continue;
      }
      // Belt and braces: the standard solver agrees.
      const recount = countKakuroSolutions(puzzle, 2, options.signal, {
        maxNodes: perCheckNodes * 2,
        deadline: Math.min(deadline, Date.now() + Math.max(minUniqueMs, timeBudgetMs * 0.12)),
      });
      if (recount === 0 || recount > 1) {
        lastReason = recount === 0 ? 'unsolvable from clues' : 'multiple solutions';
        continue;
      }

      const score = estimateKakuroDifficultyScore(puzzle);
      puzzle.metadata = { ...puzzle.metadata, difficultyScore: score };

      // Difficulty matching is soft — uniqueness is the hard gate
      if (attempt === 0 && fill === 0 && !scoreMatchesDifficulty(score, difficulty)) {
        if (difficulty === 'hard' && score < 40) {
          lastReason = 'difficulty too low';
          continue;
        }
        if (difficulty === 'easy' && score > 120) {
          lastReason = 'difficulty too high';
          continue;
        }
      }

      const final = validateKakuroPuzzle(puzzle);
      if (!final.ok) {
        lastReason = final.reason;
        continue;
      }
      accepted = puzzle;
      break;
    }
    if (accepted) return accepted;
  }

  throw new Error(
    `Unable to generate a valid ${rows}×${columns} Kakuro puzzle (${lastReason}).`
  );
}
