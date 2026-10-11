/**
 * Fill-In — Word Fill-In / Number Fill-In (crossword-style grid, no clues).
 *
 * The solver gets an empty crossword grid and the list of entries grouped by
 * length; every maximal run of two or more white cells is exactly one entry.
 */

import type { DocumentBatchPuzzleMeta } from './types';

export type FillMode = 'word' | 'number';
export type FillModuleType = 'word-fill' | 'number-fill';
export type FillDirection = 'across' | 'down';

export interface FillEntry {
  id: string;
  text: string;
  row: number;
  col: number;
  direction: FillDirection;
  cells: Array<{ row: number; col: number }>;
}

export interface FillPuzzle extends DocumentBatchPuzzleMeta {
  type: FillModuleType;
  mode: FillMode;
  rows: number;
  columns: number;
  /** Complete solution characters ('' = block). */
  grid: string[][];
  /** Puzzle view: null = blank playable, string = given, '' = block. */
  puzzleGrid: (string | null)[][];
  entries: FillEntry[];
  starterEntryId?: string;
  metadata?: { seed?: number; createdAt?: string; requested?: number };
}

export type FillDigitCounts = Partial<Record<2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, number>>;

export interface FillGenerateOptions {
  mode?: FillMode;
  width?: number;
  height?: number;
  words?: string[];
  /**
   * Word mode: take the first N words from the pool (list order preserved).
   * Callers should pass the puzzle's consecutive chunk; this only truncates if needed.
   */
  wordsPerPuzzle?: number;
  /**
   * When true (crossword `exactClueCount` protocol): keep retrying until every
   * word in the pool is placed. Default false — accept the best layout found.
   */
  exactWordCount?: boolean;
  digitCounts?: FillDigitCounts;
  lettersToShow?: number;
  includeStarterWord?: boolean;
  seed?: number;
  /** Soft wall-clock budget for exact word-count search (crossword-style). */
  timeBudgetMs?: number;
  signal?: { cancelled?: boolean };
}

/** Same caps as crossword exactClueCount / fast modes. */
export const MAX_FILL_EXACT_ATTEMPTS = 100;
export const FAST_FILL_ATTEMPTS = 24;
const EXACT_NODES_PER_ATTEMPT = 4000;
const FAST_NODES_PER_ATTEMPT = 800;

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

/** Letters / digits that occupy grid cells (spaces from the words box are display-only). */
export function fillGridChars(text: string, mode: FillMode = 'word'): string[] {
  if (mode === 'number') {
    return charsOf(text).filter((ch) => ch >= '0' && ch <= '9');
  }
  return charsOf(text).filter((ch) => /\p{L}/u.test(ch));
}

export function fillModuleTypeForMode(mode: FillMode): FillModuleType {
  return mode === 'number' ? 'number-fill' : 'word-fill';
}

/**
 * Normalize one words-box line. Word mode keeps single spaces between words so
 * the printed list matches the box ("Cosmic Web"), while grid placement uses
 * {@link fillGridChars} (letters only).
 */
export function normalizeFillEntry(text: string, mode: FillMode): string {
  if (mode === 'number') {
    return charsOf(text).filter((ch) => ch >= '0' && ch <= '9').join('');
  }
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

function buildNumberList(counts: FillDigitCounts, rand: () => number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let len = 2; len <= 9; len++) {
    const n = Math.max(0, Math.round(counts[len as 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9] ?? 0));
    for (let i = 0; i < n; i++) {
      let s = randomDigitString(len, rand);
      let guard = 0;
      while (seen.has(s) && guard++ < 60) s = randomDigitString(len, rand);
      if (seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

type CellGrid = (string | null)[][]; // null = block / unused while building

type Placement = {
  row: number;
  col: number;
  dir: FillDirection;
  crossings: number;
  score: number;
};

function cellAt(grid: CellGrid, r: number, c: number): string | null {
  if (r < 0 || c < 0 || r >= grid.length || c >= (grid[0]?.length ?? 0)) return null;
  return grid[r]![c] ?? null;
}

/**
 * Crossword placement rules:
 *  - the cell before the first and after the last letter must be empty;
 *  - a new (empty) cell may not touch a filled cell sideways (that would create
 *    or extend a perpendicular run that is not an entry);
 *  - an already filled cell must hold the same character (a crossing).
 */
function evaluatePlacement(
  grid: CellGrid,
  chars: string[],
  row: number,
  col: number,
  dir: FillDirection
): { ok: boolean; crossings: number } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  const len = chars.length;
  const endR = row + dr * (len - 1);
  const endC = col + dc * (len - 1);
  if (row < 0 || col < 0 || endR >= rows || endC >= cols) return { ok: false, crossings: 0 };
  if (cellAt(grid, row - dr, col - dc) != null) return { ok: false, crossings: 0 };
  if (cellAt(grid, endR + dr, endC + dc) != null) return { ok: false, crossings: 0 };

  let crossings = 0;
  for (let i = 0; i < len; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const cur = grid[r]![c];
    if (cur != null) {
      if (cur !== chars[i]) return { ok: false, crossings: 0 };
      // A crossing must come from a perpendicular entry. Two filled cells in a
      // row along our direction mean we would extend an existing run, which
      // destroys that entry.
      if (cellAt(grid, r - dr, c - dc) != null || cellAt(grid, r + dr, c + dc) != null) {
        return { ok: false, crossings: 0 };
      }
      crossings += 1;
      continue;
    }
    // perpendicular neighbours must be empty for a fresh cell
    if (cellAt(grid, r + dc, c + dr) != null || cellAt(grid, r - dc, c - dr) != null) {
      return { ok: false, crossings: 0 };
    }
  }
  return { ok: true, crossings };
}

function placeOn(
  grid: CellGrid,
  chars: string[],
  row: number,
  col: number,
  dir: FillDirection
): Array<{ row: number; col: number }> {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  const cells: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < chars.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    grid[r]![c] = chars[i]!;
    cells.push({ row: r, col: c });
  }
  return cells;
}

/** Place and return only cells that were empty (for undo during backtracking). */
function placeTracked(
  grid: CellGrid,
  chars: string[],
  row: number,
  col: number,
  dir: FillDirection
): { cells: Array<{ row: number; col: number }>; written: Array<{ row: number; col: number }> } {
  const dr = dir === 'down' ? 1 : 0;
  const dc = dir === 'across' ? 1 : 0;
  const cells: Array<{ row: number; col: number }> = [];
  const written: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < chars.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (grid[r]![c] == null) written.push({ row: r, col: c });
    grid[r]![c] = chars[i]!;
    cells.push({ row: r, col: c });
  }
  return { cells, written };
}

function unplaceTracked(
  grid: CellGrid,
  written: Array<{ row: number; col: number }>
): void {
  for (const cell of written) {
    grid[cell.row]![cell.col] = null;
  }
}

function collectPlacementCandidates(
  grid: CellGrid,
  entryChars: string[],
  height: number,
  width: number,
  requireCrossing: boolean,
  rand: () => number
): Placement[] {
  const candidates: Placement[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      const cur = grid[r]![c];
      if (requireCrossing) {
        if (cur == null) continue;
        for (let i = 0; i < entryChars.length; i++) {
          if (entryChars[i] !== cur) continue;
          for (const dir of ['across', 'down'] as FillDirection[]) {
            const row = dir === 'down' ? r - i : r;
            const col = dir === 'across' ? c - i : c;
            const ev = evaluatePlacement(grid, entryChars, row, col, dir);
            if (!ev.ok || ev.crossings === 0) continue;
            const midR = row + (dir === 'down' ? entryChars.length / 2 : 0);
            const midC = col + (dir === 'across' ? entryChars.length / 2 : 0);
            const dist =
              Math.abs(midR - height / 2) / height + Math.abs(midC - width / 2) / width;
            candidates.push({
              row,
              col,
              dir,
              crossings: ev.crossings,
              score: ev.crossings * 4 - dist * 2 + rand(),
            });
          }
        }
      } else {
        for (const dir of ['across', 'down'] as FillDirection[]) {
          const ev = evaluatePlacement(grid, entryChars, r, c, dir);
          if (!ev.ok) continue;
          const midR = r + (dir === 'down' ? entryChars.length / 2 : 0);
          const midC = c + (dir === 'across' ? entryChars.length / 2 : 0);
          const dist =
            Math.abs(midR - height / 2) / height + Math.abs(midC - width / 2) / width;
          candidates.push({
            row: r,
            col: c,
            dir,
            crossings: ev.crossings,
            score: -dist * 2 + rand(),
          });
        }
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

/** All maximal runs (≥2 cells) in the solution grid. */
function collectRuns(
  grid: string[][]
): Array<{ row: number; col: number; dir: FillDirection; text: string; len: number }> {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const runs: Array<{ row: number; col: number; dir: FillDirection; text: string; len: number }> = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      if (!grid[r]![c]) {
        c++;
        continue;
      }
      const start = c;
      let text = '';
      while (c < cols && grid[r]![c]) {
        text += grid[r]![c];
        c++;
      }
      if (c - start >= 2) runs.push({ row: r, col: start, dir: 'across', text, len: c - start });
    }
  }
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      if (!grid[r]![c]) {
        r++;
        continue;
      }
      const start = r;
      let text = '';
      while (r < rows && grid[r]![c]) {
        text += grid[r]![c];
        r++;
      }
      if (r - start >= 2) runs.push({ row: start, col: c, dir: 'down', text, len: r - start });
    }
  }
  return runs;
}

export function validateFill(puzzle: FillPuzzle): { ok: true } | { ok: false; reason: string } {
  if (!puzzle.entries?.length) return { ok: false, reason: 'no entries' };
  if (puzzle.grid.length !== puzzle.rows) return { ok: false, reason: 'row count mismatch' };
  for (const row of puzzle.grid) {
    if (row.length !== puzzle.columns) return { ok: false, reason: 'column count mismatch' };
  }
  const seenText = new Set<string>();
  const seenKeys = new Set<string>();
  for (const entry of puzzle.entries) {
    const chars = fillGridChars(entry.text, puzzle.mode);
    const key = chars.join('');
    if (chars.length < 2) return { ok: false, reason: `entry too short: ${entry.text}` };
    if (seenText.has(entry.text) || seenKeys.has(key)) {
      return { ok: false, reason: `duplicate entry: ${entry.text}` };
    }
    seenText.add(entry.text);
    seenKeys.add(key);
    if (entry.cells.length !== chars.length) {
      return { ok: false, reason: `cell count mismatch: ${entry.text}` };
    }
    for (let i = 0; i < chars.length; i++) {
      const { row, col } = entry.cells[i]!;
      if (puzzle.grid[row]?.[col] !== chars[i]) {
        return { ok: false, reason: `grid mismatch for ${entry.text} at ${row},${col}` };
      }
    }
  }
  // Every run is exactly one entry and every entry is a run.
  const runs = collectRuns(puzzle.grid);
  const runKey = (r: number, c: number, d: FillDirection) => `${d}:${r},${c}`;
  const entryKeys = new Set(puzzle.entries.map((e) => runKey(e.row, e.col, e.direction)));
  if (runs.length !== puzzle.entries.length) {
    return {
      ok: false,
      reason: `grid has ${runs.length} runs but ${puzzle.entries.length} entries`,
    };
  }
  for (const run of runs) {
    if (!entryKeys.has(runKey(run.row, run.col, run.dir))) {
      return { ok: false, reason: `stray run "${run.text}" at ${run.row},${run.col}` };
    }
  }
  // Single connected component (a fill-in with islands is two puzzles).
  const white: Array<[number, number]> = [];
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.columns; c++) if (puzzle.grid[r]![c]) white.push([r, c]);
  }
  if (white.length) {
    const seen = new Set<string>();
    const stack = [white[0]!];
    seen.add(`${white[0]![0]},${white[0]![1]}`);
    while (stack.length) {
      const [r, c] = stack.pop()!;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (!puzzle.grid[nr]?.[nc]) continue;
        const k = `${nr},${nc}`;
        if (seen.has(k)) continue;
        seen.add(k);
        stack.push([nr, nc]);
      }
    }
    if (seen.size !== white.length) return { ok: false, reason: 'grid is not connected' };
  }
  for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.columns; c++) {
      const given = puzzle.puzzleGrid[r]?.[c];
      const sol = puzzle.grid[r]?.[c] ?? '';
      if (sol === '' && given !== '') return { ok: false, reason: `block mismatch at ${r},${c}` };
      if (sol !== '' && given === '') return { ok: false, reason: `white cell blocked at ${r},${c}` };
      if (given != null && given !== '' && given !== sol) {
        return { ok: false, reason: `given mismatch at ${r},${c}` };
      }
    }
  }
  return { ok: true };
}

export function fillSignature(puzzle: FillPuzzle): string {
  return `${puzzle.mode}:${puzzle.grid.map((r) => r.join('')).join('/')}`;
}

/**
 * Single isolated unused cells fully surrounded by playable letters — same
 * protocol as crossword {@link findInteriorUnusedCells}. Larger unused regions
 * are left alone (each neighbour must be a letter cell).
 */
export function findInteriorUnusedFillCells(puzzle: FillPuzzle): boolean[][] {
  const rows = puzzle.rows;
  const cols = puzzle.columns;
  if (rows <= 0 || cols <= 0) return [];
  const isEnclosed: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const isActive = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    return (puzzle.grid[r]?.[c] ?? '') !== '';
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((puzzle.grid[r]?.[c] ?? '') !== '') continue;
      if (
        isActive(r - 1, c) &&
        isActive(r + 1, c) &&
        isActive(r, c - 1) &&
        isActive(r, c + 1)
      ) {
        isEnclosed[r]![c] = true;
      }
    }
  }
  return isEnclosed;
}

/** Word list for the page: grouped by length (ascending), alphabetical inside a group. */
export function fillWordListGroups(puzzle: FillPuzzle): Array<{ length: number; items: string[] }> {
  const byLen = new Map<number, string[]>();
  for (const entry of puzzle.entries) {
    const len = fillGridChars(entry.text, puzzle.mode).length;
    const list = byLen.get(len) ?? [];
    list.push(entry.text);
    byLen.set(len, list);
  }
  return [...byLen.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([length, items]) => ({
      length,
      items: items.sort((a, b) => a.localeCompare(b)),
    }));
}

function buildAttempt(
  texts: string[],
  width: number,
  height: number,
  mode: FillMode,
  rand: () => number
): { grid: CellGrid; placed: FillEntry[] } {
  const grid: CellGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );
  const placed: FillEntry[] = [];
  const remaining = texts.slice();
  const chars = (t: string) => fillGridChars(t, mode);

  // Seed word: longest that fits, centred, direction chosen by grid shape.
  remaining.sort((a, b) => chars(b).length - chars(a).length);
  const first = remaining.find((t) => chars(t).length <= Math.max(width, height));
  if (!first) return { grid, placed };
  remaining.splice(remaining.indexOf(first), 1);
  const firstChars = chars(first);
  const firstDir: FillDirection =
    firstChars.length <= width && (width >= height || firstChars.length > height)
      ? 'across'
      : 'down';
  const fr =
    firstDir === 'across'
      ? Math.floor(height / 2)
      : Math.floor((height - firstChars.length) / 2);
  const fc =
    firstDir === 'across'
      ? Math.floor((width - firstChars.length) / 2)
      : Math.floor(width / 2);
  placed.push({
    id: 'e0',
    text: first,
    row: fr,
    col: fc,
    direction: firstDir,
    cells: placeOn(grid, firstChars, fr, fc, firstDir),
  });

  // Greedy passes: each pass tries every remaining word once; stop when a full
  // pass places nothing.
  let progress = true;
  let passes = 0;
  while (progress && remaining.length && passes < 6) {
    progress = false;
    passes += 1;
    shuffleInPlace(remaining, rand);
    remaining.sort((a, b) => chars(b).length - chars(a).length + (rand() - 0.5) * 1.5);
    for (let wi = 0; wi < remaining.length; wi++) {
      const text = remaining[wi]!;
      const entryChars = chars(text);
      const candidates = collectPlacementCandidates(
        grid,
        entryChars,
        height,
        width,
        true,
        rand
      );
      if (!candidates.length) continue;
      const pick = candidates[Math.floor(rand() * Math.min(3, candidates.length))]!;
      placed.push({
        id: `e${placed.length}`,
        text,
        row: pick.row,
        col: pick.col,
        direction: pick.dir,
        cells: placeOn(grid, entryChars, pick.row, pick.col, pick.dir),
      });
      remaining.splice(wi, 1);
      wi -= 1;
      progress = true;
    }
  }
  return { grid, placed };
}

/**
 * Exact placement (crossword exactClueCount style): DFS + MRV until every
 * entry is on the grid, or the node budget is exhausted.
 * `attempt` varies seed ordering the same way crossword `orderWords` does.
 */
function buildAttemptExact(
  texts: string[],
  width: number,
  height: number,
  mode: FillMode,
  rand: () => number,
  nodeBudget: number,
  attempt = 0
): { grid: CellGrid; placed: FillEntry[] } | null {
  const chars = (t: string) => fillGridChars(t, mode);
  if (!texts.length) return null;

  // Crossword-style reorder: longest-first baseline, then shuffle rest on retries.
  const ordered = texts.slice().sort((a, b) => chars(b).length - chars(a).length);
  if (attempt > 0) {
    const seedWord = ordered[attempt % ordered.length]!;
    const rest = ordered.filter((t) => t !== seedWord);
    shuffleInPlace(rest, rand);
    if (rest.length > 2 && attempt % 3 === 1) {
      const i = 1 + Math.floor(rand() * (rest.length - 1));
      const j = 1 + Math.floor(rand() * (rest.length - 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    ordered.length = 0;
    ordered.push(seedWord, ...rest);
  } else {
    // Light jitter on first attempt so identical seeds still diverge.
    for (let i = 1; i < ordered.length; i++) {
      if (rand() < 0.25) {
        const j = 1 + Math.floor(rand() * (ordered.length - 1));
        [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
      }
    }
  }

  const seedPoolSize = Math.min(8, ordered.length);
  const seedPool = ordered.slice(0, seedPoolSize);
  if (attempt > 0) shuffleInPlace(seedPool, rand);

  let nodes = 0;
  const emptyGrid = (): CellGrid =>
    Array.from({ length: height }, () => Array.from({ length: width }, () => null));

  for (const first of seedPool) {
    if (nodes >= nodeBudget) break;
    const firstChars = chars(first);
    if (firstChars.length > Math.max(width, height)) continue;

    const seedCandidates = collectPlacementCandidates(
      emptyGrid(),
      firstChars,
      height,
      width,
      false,
      rand
    ).slice(0, attempt === 0 ? 8 : 14);
    if (!seedCandidates.length) {
      const firstDir: FillDirection =
        firstChars.length <= width && (width >= height || firstChars.length > height)
          ? 'across'
          : 'down';
      const fr =
        firstDir === 'across'
          ? Math.floor(height / 2)
          : Math.floor((height - firstChars.length) / 2);
      const fc =
        firstDir === 'across'
          ? Math.floor((width - firstChars.length) / 2)
          : Math.floor(width / 2);
      seedCandidates.push({
        row: fr,
        col: fc,
        dir: firstDir,
        crossings: 0,
        score: 1,
      });
    }

    for (const seed of seedCandidates) {
      if (nodes >= nodeBudget) break;
      if (!evaluatePlacement(emptyGrid(), firstChars, seed.row, seed.col, seed.dir).ok) {
        continue;
      }

      const grid = emptyGrid();
      const placed: FillEntry[] = [];
      const remaining = ordered.filter((t) => t !== first);
      const { cells } = placeTracked(grid, firstChars, seed.row, seed.col, seed.dir);
      placed.push({
        id: 'e0',
        text: first,
        row: seed.row,
        col: seed.col,
        direction: seed.dir,
        cells,
      });

      const dfs = (): boolean => {
        if (nodes++ > nodeBudget) return false;
        if (remaining.length === 0) return true;

        // MRV: place the word with the fewest legal crossings first.
        let bestIdx = -1;
        let bestCands: Placement[] = [];
        for (let i = 0; i < remaining.length; i++) {
          const cands = collectPlacementCandidates(
            grid,
            chars(remaining[i]!),
            height,
            width,
            true,
            rand
          );
          if (cands.length === 0) return false;
          if (bestIdx < 0 || cands.length < bestCands.length) {
            bestIdx = i;
            bestCands = cands;
          }
        }
        if (bestIdx < 0) return false;

        const text = remaining[bestIdx]!;
        const entryChars = chars(text);
        remaining.splice(bestIdx, 1);
        // Near the end, try every candidate (crossword widens when finishing a layout).
        const branchLimit =
          remaining.length <= 3
            ? bestCands.length
            : Math.min(bestCands.length, remaining.length > 10 ? 10 : 14);
        for (let i = 0; i < branchLimit; i++) {
          const pick = bestCands[i]!;
          const { cells: placedCells, written } = placeTracked(
            grid,
            entryChars,
            pick.row,
            pick.col,
            pick.dir
          );
          placed.push({
            id: `e${placed.length}`,
            text,
            row: pick.row,
            col: pick.col,
            direction: pick.dir,
            cells: placedCells,
          });
          if (dfs()) return true;
          placed.pop();
          unplaceTracked(grid, written);
        }
        remaining.splice(bestIdx, 0, text);
        return false;
      };

      if (dfs()) return { grid, placed };
    }
  }
  return null;
}

function cloneFillState(state: {
  grid: CellGrid;
  placed: FillEntry[];
}): { grid: CellGrid; placed: FillEntry[] } {
  return {
    grid: state.grid.map((row) => row.slice()),
    placed: state.placed.map((e) => ({
      ...e,
      cells: e.cells.map((c) => ({ ...c })),
    })),
  };
}

/**
 * From a near-complete layout, DFS only the missing words (and optionally
 * the last few placements after a backjump). Closes 14/15-style misses.
 */
function completeFromPartial(
  partial: { grid: CellGrid; placed: FillEntry[] },
  allTexts: string[],
  width: number,
  height: number,
  mode: FillMode,
  rand: () => number,
  nodeBudget: number,
  backjump = 0
): { grid: CellGrid; placed: FillEntry[] } | null {
  const chars = (t: string) => fillGridChars(t, mode);
  const state = cloneFillState(partial);
  const drop = Math.max(0, Math.min(backjump, state.placed.length - 1));
  for (let i = 0; i < drop; i++) {
    const last = state.placed.pop();
    if (!last) break;
    // Clear cells that no remaining entry still uses.
    const stillUsed = new Set<string>();
    for (const e of state.placed) {
      for (const cell of e.cells) stillUsed.add(`${cell.row},${cell.col}`);
    }
    for (const cell of last.cells) {
      const key = `${cell.row},${cell.col}`;
      if (!stillUsed.has(key)) state.grid[cell.row]![cell.col] = null;
    }
  }

  const placedKeys = new Set(
    state.placed.map((e) => fillGridChars(e.text, mode).join(''))
  );
  const remaining = allTexts.filter((t) => !placedKeys.has(chars(t).join('')));
  if (remaining.length === 0) return state;

  let nodes = 0;
  const dfs = (): boolean => {
    if (nodes++ > nodeBudget) return false;
    if (remaining.length === 0) return true;

    let bestIdx = -1;
    let bestCands: Placement[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const cands = collectPlacementCandidates(
        state.grid,
        chars(remaining[i]!),
        height,
        width,
        true,
        rand
      );
      if (cands.length === 0) return false;
      if (bestIdx < 0 || cands.length < bestCands.length) {
        bestIdx = i;
        bestCands = cands;
      }
    }
    if (bestIdx < 0) return false;

    const text = remaining[bestIdx]!;
    const entryChars = chars(text);
    remaining.splice(bestIdx, 1);
    const branchLimit =
      remaining.length <= 4 ? bestCands.length : Math.min(bestCands.length, 16);
    for (let i = 0; i < branchLimit; i++) {
      const pick = bestCands[i]!;
      const { cells, written } = placeTracked(
        state.grid,
        entryChars,
        pick.row,
        pick.col,
        pick.dir
      );
      state.placed.push({
        id: `e${state.placed.length}`,
        text,
        row: pick.row,
        col: pick.col,
        direction: pick.dir,
        cells,
      });
      if (dfs()) return true;
      state.placed.pop();
      unplaceTracked(state.grid, written);
    }
    remaining.splice(bestIdx, 0, text);
    return false;
  };

  return dfs() ? state : null;
}

/** Shift all content so the used bounding box is centred in the grid. */
function centreContent(
  grid: CellGrid,
  placed: FillEntry[],
  width: number,
  height: number
): { grid: CellGrid; placed: FillEntry[] } {
  let minR = height;
  let maxR = -1;
  let minC = width;
  let maxC = -1;
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r]![c] != null) {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR < 0) return { grid, placed };
  const dr = Math.floor((height - 1 - maxR - minR) / 2);
  const dc = Math.floor((width - 1 - maxC - minC) / 2);
  if (dr === 0 && dc === 0) return { grid, placed };
  const next: CellGrid = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null)
  );
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      next[r + dr]![c + dc] = grid[r]![c];
    }
  }
  return {
    grid: next,
    placed: placed.map((e) => ({
      ...e,
      row: e.row + dr,
      col: e.col + dc,
      cells: e.cells.map((cell) => ({ row: cell.row + dr, col: cell.col + dc })),
    })),
  };
}

export function generateFill(options: FillGenerateOptions = {}): FillPuzzle {
  const mode: FillMode = options.mode === 'number' ? 'number' : 'word';
  const width = clampInt(options.width ?? 13, 5, 30, 13);
  const height = clampInt(options.height ?? 13, 5, 30, 13);
  const lettersToShow = Math.max(0, Math.round(options.lettersToShow ?? 0));
  const includeStarter = options.includeStarterWord !== false;
  const seed = (options.seed ?? (Date.now() ^ (Math.random() * 0x7fffffff))) >>> 0;
  const rand = mulberry32(seed);

  let pool: string[] =
    mode === 'number'
      ? buildNumberList(options.digitCounts ?? { 2: 4, 3: 4, 4: 2 }, rand)
      : (options.words ?? [])
          .map((w) => normalizeFillEntry(w, 'word'))
          .filter((w) => fillGridChars(w, 'word').length >= 2);

  if (mode === 'word' && pool.length === 0) {
    pool = ['APPLE', 'PEAR', 'GRAPE', 'PLUM', 'MANGO', 'MELON', 'BERRY', 'LEMON', 'LIME', 'FIG', 'KIWI', 'DATE'];
  }
  if (mode === 'number' && pool.length === 0) {
    pool = buildNumberList({ 2: 4, 3: 4, 4: 2 }, rand);
  }
  // Unique by letter/digit sequence; keep spaces for the printed word list.
  const maxLen = Math.max(width, height);
  const unique: string[] = [];
  const seenKeys = new Set<string>();
  for (const t of pool) {
    const chars = fillGridChars(t, mode);
    if (chars.length < 2 || chars.length > maxLen) continue;
    const key = chars.join('');
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push(t);
  }
  pool = unique;
  if (pool.length === 0) {
    throw new Error(`No Fill-In entries fit a ${width}×${height} grid.`);
  }
  // Exact count only when opted in (crossword “Make exactly N clues” checkbox).
  const exactWordCount = mode === 'word' && options.exactWordCount === true;
  if (mode === 'word' && options.wordsPerPuzzle != null) {
    const want = clampInt(options.wordsPerPuzzle, 1, 200, options.wordsPerPuzzle);
    if (exactWordCount && pool.length < want) {
      throw new Error(
        `Need ${want} placeable words but only ${pool.length} fit a ${width}×${height} grid (check length or duplicates).`
      );
    }
    // Keep list order — same consecutive-chunk model as Word Search (no random subset).
    pool = pool.slice(0, Math.min(want, pool.length));
  }
  const requested = pool.length;

  const maxAttempts = exactWordCount
    ? MAX_FILL_EXACT_ATTEMPTS
    : requested > 40
      ? 10
      : FAST_FILL_ATTEMPTS;
  const nodesPerAttempt = exactWordCount ? EXACT_NODES_PER_ATTEMPT : FAST_NODES_PER_ATTEMPT;
  // Crossword exact mode aims for several complete layouts before stopping.
  const completeLayoutsNeeded = exactWordCount ? 4 : 1;
  const deadline =
    options.timeBudgetMs != null && options.timeBudgetMs > 0
      ? Date.now() + options.timeBudgetMs
      : exactWordCount
        ? Date.now() + 20_000
        : null;

  let best: { grid: CellGrid; placed: FillEntry[] } | null = null;
  let completeLayouts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.cancelled) throw new Error('Fill generation cancelled.');
    if (deadline != null && Date.now() > deadline) break;

    let result: { grid: CellGrid; placed: FillEntry[] } | null = null;
    if (exactWordCount) {
      // Primary path: DFS exact search with per-attempt node budget.
      result = buildAttemptExact(
        pool,
        width,
        height,
        mode,
        rand,
        nodesPerAttempt,
        attempt
      );
      // Interleave cheap greedy probes for layout diversity (like crossword).
      if (!result || result.placed.length < requested) {
        const greedy = buildAttempt(pool, width, height, mode, rand);
        if (!result || greedy.placed.length > result.placed.length) result = greedy;
      }
    } else {
      result = buildAttempt(pool, width, height, mode, rand);
    }

    if (!result || result.placed.length === 0) continue;

    // Near-miss completion: finish 13–14/15 layouts by DFS on the remainder.
    if (
      exactWordCount &&
      result.placed.length < requested &&
      result.placed.length >= requested - 4
    ) {
      for (const backjump of [0, 1, 2, 3]) {
        const finished = completeFromPartial(
          result,
          pool,
          width,
          height,
          mode,
          rand,
          nodesPerAttempt * 3,
          backjump
        );
        if (finished && finished.placed.length === requested) {
          result = finished;
          break;
        }
      }
    }

    if (!best || result.placed.length > best.placed.length) best = result;

    if (result.placed.length === requested) {
      best = result;
      completeLayouts += 1;
      if (completeLayouts >= completeLayoutsNeeded) break;
    }
  }

  // Exact mode: full second window (not leftover crumbs) — same idea as crossword
  // spending its exactClueCount budget across many restarts.
  if (exactWordCount && (!best || best.placed.length !== requested)) {
    const extendMs = Math.max(options.timeBudgetMs ?? 20_000, 20_000);
    const extendDeadline = Date.now() + extendMs;
    let boost = 0;
    while (Date.now() < extendDeadline) {
      if (options.signal?.cancelled) throw new Error('Fill generation cancelled.');
      boost += 1;
      let result = buildAttemptExact(
        pool,
        width,
        height,
        mode,
        rand,
        nodesPerAttempt * (2 + Math.min(boost, 10)),
        maxAttempts + boost
      );
      if (!result) {
        result = buildAttempt(pool, width, height, mode, rand);
      }
      if (result && result.placed.length < requested && result.placed.length >= requested - 4) {
        for (const backjump of [0, 1, 2, 3, 4]) {
          const finished = completeFromPartial(
            result,
            pool,
            width,
            height,
            mode,
            rand,
            nodesPerAttempt * 4,
            backjump
          );
          if (finished && finished.placed.length === requested) {
            result = finished;
            break;
          }
        }
      }
      if (!result) continue;
      if (!best || result.placed.length > best.placed.length) best = result;
      if (result.placed.length === requested) {
        best = result;
        break;
      }
    }
  }

  // Final push: keep restarting until exact count (user chose N words).
  if (exactWordCount && (!best || best.placed.length !== requested)) {
    const hardDeadline = Date.now() + 90_000;
    let push = 0;
    while (Date.now() < hardDeadline && push < 400) {
      if (options.signal?.cancelled) throw new Error('Fill generation cancelled.');
      push += 1;
      let result =
        buildAttemptExact(
          pool,
          width,
          height,
          mode,
          rand,
          16_000 + push * 500,
          maxAttempts + 1000 + push
        ) ?? buildAttempt(pool, width, height, mode, rand);
      if (result.placed.length < requested && best && best.placed.length >= requested - 4) {
        // Also try completing the best near-miss found so far.
        for (const backjump of [0, 1, 2, 3, 4, 5]) {
          const finished = completeFromPartial(
            best,
            pool,
            width,
            height,
            mode,
            rand,
            25_000 + push * 200,
            backjump
          );
          if (finished && finished.placed.length === requested) {
            result = finished;
            break;
          }
        }
      }
      if (result.placed.length < requested && result.placed.length >= requested - 4) {
        for (const backjump of [0, 1, 2, 3, 4]) {
          const finished = completeFromPartial(
            result,
            pool,
            width,
            height,
            mode,
            rand,
            20_000,
            backjump
          );
          if (finished && finished.placed.length === requested) {
            result = finished;
            break;
          }
        }
      }
      if (!best || result.placed.length > best.placed.length) best = result;
      if (result.placed.length === requested) {
        best = result;
        break;
      }
    }
  }

  if (exactWordCount) {
    if (!best || best.placed.length !== requested) {
      throw new Error(
        `Could not place all ${requested} words on a ${width}×${height} grid after extended search (got ${best?.placed.length ?? 0}). Try a larger grid or different words.`
      );
    }
  } else if (!best || best.placed.length < Math.min(2, requested)) {
    throw new Error(
      `Unable to build a ${width}×${height} Fill-In from these entries. Use a larger grid or fewer entries.`
    );
  }

  const centred = centreContent(best.grid, best.placed, width, height);
  const solution: string[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => centred.grid[r]![c] ?? '')
  );
  const puzzleGrid: (string | null)[][] = Array.from({ length: height }, (_, r) =>
    Array.from({ length: width }, (_, c) => (solution[r]![c] === '' ? '' : null))
  );

  const placed = centred.placed;
  let starterEntryId: string | undefined;
  if (includeStarter && placed.length) {
    // Longest entry (most crossings → best foothold), ties broken randomly
    const longest = Math.max(...placed.map((e) => fillGridChars(e.text, mode).length));
    const pick = placed.filter((e) => fillGridChars(e.text, mode).length === longest);
    const starter = pick[Math.floor(rand() * pick.length)]!;
    starterEntryId = starter.id;
    for (const cell of starter.cells) {
      puzzleGrid[cell.row]![cell.col] = solution[cell.row]![cell.col]!;
    }
  }

  const hideable: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (solution[r]![c] && puzzleGrid[r]![c] == null) hideable.push({ row: r, col: c });
    }
  }
  shuffleInPlace(hideable, rand);
  for (let i = 0; i < Math.min(lettersToShow, hideable.length); i++) {
    const cell = hideable[i]!;
    puzzleGrid[cell.row]![cell.col] = solution[cell.row]![cell.col]!;
  }

  const puzzle: FillPuzzle = {
    type: fillModuleTypeForMode(mode),
    mode,
    rows: height,
    columns: width,
    grid: solution,
    puzzleGrid,
    entries: placed,
    starterEntryId,
    metadata: { seed, createdAt: new Date().toISOString(), requested },
  };
  const check = validateFill(puzzle);
  if (!check.ok) {
    throw new Error(`Unable to generate a valid Fill-In puzzle (${check.reason}).`);
  }
  return puzzle;
}
