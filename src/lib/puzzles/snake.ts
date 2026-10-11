/**
 * Snake — Word Snake / Number Snake (continuous orthogonal path).
 */

import type { DocumentBatchPuzzleMeta } from './types';

export type SnakeMode = 'word' | 'number';

export interface SnakeEntry {
  text: string;
  pathStartIndex: number;
  pathEndIndex: number;
}

export interface SnakePuzzle extends DocumentBatchPuzzleMeta {
  type: 'snake';
  mode: SnakeMode;
  rows: number;
  columns: number;
  grid: string[][];
  path: Array<{ row: number; col: number }>;
  entries: SnakeEntry[];
  metadata?: { seed?: number; createdAt?: string };
}

export type SnakeDigitCounts = Partial<Record<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;

export interface SnakeGenerateOptions {
  mode?: SnakeMode;
  width?: number;
  height?: number;
  words?: string[];
  digitCounts?: SnakeDigitCounts;
  wordsPerPuzzle?: number;
  allowNumbersInGrid?: boolean;
  includeFiller?: string;
  excludeFiller?: string;
  seed?: number;
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

function clampInt(n: number, lo: number, hi: number, fallback: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, v));
}

function charsOf(text: string): string[] {
  return Array.from(text);
}

/** Letters / digits that occupy snake cells (spaces from the words box are display-only). */
function gridChars(text: string, mode: SnakeMode = 'word'): string[] {
  if (mode === 'number') {
    return charsOf(text).filter((ch) => ch >= '0' && ch <= '9');
  }
  return charsOf(text).filter((ch) => /\p{L}/u.test(ch));
}

/**
 * Normalize one words-box line. Word mode keeps single spaces ("Cosmic Web") for
 * the printed list; path placement uses {@link gridChars}.
 */
function normalizeWord(text: string): string {
  return charsOf(text)
    .map((ch) => ch.toLocaleUpperCase())
    .filter((ch) => /\p{L}/u.test(ch) || ch === ' ' || ch === '\t')
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Random number with exactly `len` digits (no leading zero). */
function randomDigitString(len: number, rand: () => number): string {
  let s = String(1 + Math.floor(rand() * 9));
  for (let i = 1; i < len; i++) s += String(Math.floor(rand() * 10));
  return s;
}

function buildNumbers(counts: SnakeDigitCounts, rand: () => number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let len = 2; len <= 9; len++) {
    const n = Math.max(0, Math.round(counts[len as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9] ?? 0));
    for (let i = 0; i < n; i++) {
      let s = randomDigitString(len, rand);
      let g = 0;
      while (seen.has(s) && g++ < 40) s = randomDigitString(len, rand);
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function orthogonal(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function neighbors(
  r: number,
  c: number,
  rows: number,
  cols: number,
  used: Set<string>
): Array<{ row: number; col: number }> {
  const out: Array<{ row: number; col: number }> = [];
  for (const [dr, dc] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
    if (used.has(`${nr},${nc}`)) continue;
    out.push({ row: nr, col: nc });
  }
  return out;
}

function buildFillerAlphabet(
  mode: SnakeMode,
  allowNumbers: boolean,
  includeFiller: string,
  excludeFiller: string
): string[] {
  const exclude = new Set(charsOf(excludeFiller).map((ch) => ch.toLocaleUpperCase()));
  const include = charsOf(includeFiller)
    .map((ch) => ch.toLocaleUpperCase())
    .filter((ch) => /[\p{L}\p{N}]/u.test(ch) && !exclude.has(ch));
  // Number snakes hide among digits; word snakes among letters (digits optional).
  const base =
    mode === 'number'
      ? charsOf('0123456789')
      : charsOf(allowNumbers ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ');
  const pool = [...new Set([...include, ...base.filter((ch) => !exclude.has(ch))])];
  return pool.length ? pool : mode === 'number' ? charsOf('0123456789') : charsOf('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
}

/**
 * Self-avoiding orthogonal path of exactly `length` cells. Warnsdorff ordering
 * (fewest onward moves first, with a little randomness) plus bounded
 * backtracking lets dense snakes succeed where a plain random walk traps itself.
 */
function growPath(
  rows: number,
  cols: number,
  length: number,
  rand: () => number,
  budget: number
): Array<{ row: number; col: number }> | null {
  const startR = Math.floor(rand() * rows);
  const startC = Math.floor(rand() * cols);
  const path: Array<{ row: number; col: number }> = [{ row: startR, col: startC }];
  const used = new Set<string>([`${startR},${startC}`]);
  let steps = 0;

  const onward = (r: number, c: number) => neighbors(r, c, rows, cols, used).length;

  const dfs = (): boolean => {
    if (path.length >= length) return true;
    if (steps++ > budget) return false;
    const cur = path[path.length - 1]!;
    const nbrs = neighbors(cur.row, cur.col, rows, cols, used);
    if (nbrs.length === 0) return false;
    const scored = nbrs.map((n) => ({ n, score: onward(n.row, n.col) + rand() * 1.5 }));
    scored.sort((a, b) => a.score - b.score);
    for (const { n } of scored) {
      const key = `${n.row},${n.col}`;
      path.push(n);
      used.add(key);
      if (dfs()) return true;
      path.pop();
      used.delete(key);
      if (steps > budget) return false;
    }
    return false;
  };

  return dfs() ? path : null;
}

export function validateSnake(puzzle: SnakePuzzle): { ok: true } | { ok: false; reason: string } {
  if (!puzzle.path?.length) return { ok: false, reason: 'empty path' };
  const seen = new Set<string>();
  for (let i = 0; i < puzzle.path.length; i++) {
    const p = puzzle.path[i]!;
    const key = `${p.row},${p.col}`;
    if (seen.has(key)) return { ok: false, reason: 'path reuses cell' };
    seen.add(key);
    if (i > 0 && !orthogonal(puzzle.path[i - 1]!, p)) {
      return { ok: false, reason: `path not orthogonal at ${i}` };
    }
  }
  for (const entry of puzzle.entries) {
    const chars = gridChars(entry.text, puzzle.mode);
    if (entry.pathEndIndex - entry.pathStartIndex + 1 !== chars.length) {
      return { ok: false, reason: `entry length mismatch: ${entry.text}` };
    }
    for (let i = 0; i < chars.length; i++) {
      const cell = puzzle.path[entry.pathStartIndex + i];
      if (!cell) return { ok: false, reason: 'entry outside path' };
      if (puzzle.grid[cell.row]?.[cell.col] !== chars[i]) {
        return { ok: false, reason: `grid mismatch for ${entry.text}` };
      }
    }
  }
  return { ok: true };
}

export function snakeSignature(puzzle: SnakePuzzle): string {
  return `${puzzle.mode}:${puzzle.path.map((p) => `${p.row},${p.col}`).join('>')}:${puzzle.entries
    .map((e) => e.text)
    .join('|')}`;
}

export function generateSnake(options: SnakeGenerateOptions = {}): SnakePuzzle {
  const mode: SnakeMode = options.mode === 'number' ? 'number' : 'word';
  const width = clampInt(options.width ?? 12, 3, 30, 12);
  const height = clampInt(options.height ?? 12, 3, 30, 12);
  const seed = options.seed ?? (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
  const rand = mulberry32(seed);
  const allowNumbers = options.allowNumbersInGrid === true;
  const fillerPool = buildFillerAlphabet(
    mode,
    allowNumbers,
    options.includeFiller ?? '',
    options.excludeFiller ?? ''
  );

  let texts: string[] =
    mode === 'number'
      ? buildNumbers(options.digitCounts ?? { 2: 3, 3: 3, 4: 2 }, rand)
      : (options.words ?? [])
          .map(normalizeWord)
          .filter((w) => gridChars(w, 'word').length >= 2);
  // Unique by letter/digit sequence; keep spaces for the printed word list.
  {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const t of texts) {
      const key = gridChars(t, mode).join('');
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(t);
    }
    texts = unique;
  }

  if (mode === 'word' && texts.length === 0) {
    texts = ['CAT', 'DOG', 'BIRD', 'FISH', 'LION'];
  }
  if (mode === 'number' && texts.length === 0) {
    texts = buildNumbers({ 2: 3, 3: 3, 4: 2 }, rand);
  }
  const wpp = clampInt(options.wordsPerPuzzle ?? texts.length, 1, 100, texts.length);
  // Keep list order — consecutive chunks like Word Search (no random subset).
  if (wpp < texts.length) texts = texts.slice(0, wpp);

  const totalLen = texts.reduce((s, t) => s + gridChars(t, mode).length, 0);
  if (totalLen > width * height) {
    throw new Error(
      `Snake entries need ${totalLen} cells but the ${width}×${height} grid has ${width * height}. Use a larger grid or fewer entries.`
    );
  }

  for (let attempt = 0; attempt < 60; attempt++) {
    if (options.signal?.cancelled) throw new Error('Snake generation cancelled.');

    const path = growPath(height, width, totalLen, rand, 4000 + totalLen * 40);
    if (!path) continue;

    const grid: string[][] = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => '')
    );

    const entries: SnakeEntry[] = [];
    let idx = 0;
    for (const text of texts) {
      const chars = gridChars(text, mode);
      const start = idx;
      for (let i = 0; i < chars.length; i++) {
        const cell = path[idx++]!;
        grid[cell.row]![cell.col] = chars[i]!;
      }
      entries.push({ text, pathStartIndex: start, pathEndIndex: idx - 1 });
    }

    // Fill unused
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        if (!grid[r]![c]) {
          grid[r]![c] = fillerPool[Math.floor(rand() * fillerPool.length)]!;
        }
      }
    }

    const puzzle: SnakePuzzle = {
      type: 'snake',
      mode,
      rows: height,
      columns: width,
      grid,
      path,
      entries,
      metadata: { seed: seed + attempt, createdAt: new Date().toISOString() },
    };
    const check = validateSnake(puzzle);
    if (check.ok) return puzzle;
  }

  throw new Error('Unable to generate a valid Snake puzzle.');
}
