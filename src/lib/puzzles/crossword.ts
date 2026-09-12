import type { CrosswordPuzzle, CrosswordCell } from './types';
import { cleanCrosswordAnswer } from '../crossword-settings';

export const MIN_CROSSWORD_ENTRY_LENGTH = 3;
export const MAX_CROSSWORD_GENERATION_ATTEMPTS = 100;
export const FAST_CROSSWORD_GENERATION_ATTEMPTS = 8;
const MAX_NODES_PER_ATTEMPT = 2500;
const FAST_NODES_PER_ATTEMPT = 800;

const INTERSECTION_WEIGHT = 140;
const SIZE_PENALTY = 6;
const CENTER_PENALTY = 3;
const EXPANSION_PENALTY = 8;

const CROSSWORD_DEBUG =
  typeof process !== 'undefined' && process.env.CROSSWORD_DEBUG === '1';

type Direction = 'across' | 'down';

interface PlacedWord {
  word: string;
  clue: string;
  row: number;
  col: number;
  direction: Direction;
  id?: number;
}

interface CandidatePlacement {
  row: number;
  col: number;
  direction: Direction;
  intersections: number;
  score: number;
}

export interface CrosswordValidationResult {
  isValid: boolean;
  errors: string[];
  placedAnswers: string[];
  failedAnswers: string[];
  intersectionCountByAnswer: Record<string, number>;
  detectedAcross: string[];
  detectedDown: string[];
  connectedComponents: number;
  ghostEntries: string[];
  shortEntries: string[];
  letterConflicts: string[];
  numberingIsValid: boolean;
  allAnswersPlaced: boolean;
  detectedEntriesCount: number;
  intendedEntriesCount: number;
  attempt?: number;
  score?: number;
}

interface DetectedEntry {
  row: number;
  col: number;
  direction: Direction;
  word: string;
}

interface PreparedWord {
  word: string;
  clue: string;
  id: number;
}

/** Logical grid: '' = unused/blocked, A–Z = letter. */
type LogicalGrid = string[][];

function createLogicalGrid(rows: number, cols: number): LogicalGrid {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function inBounds(grid: LogicalGrid, r: number, c: number): boolean {
  return r >= 0 && c >= 0 && r < grid.length && c < grid[0].length;
}

function letterAt(grid: LogicalGrid, r: number, c: number): string {
  if (!inBounds(grid, r, c)) return '';
  return grid[r][c];
}

function isPlayable(grid: LogicalGrid, r: number, c: number): boolean {
  return letterAt(grid, r, c) !== '';
}

function delta(direction: Direction): { dr: number; dc: number } {
  return direction === 'across' ? { dr: 0, dc: 1 } : { dr: 1, dc: 0 };
}

function entryKey(entry: { row: number; col: number; direction: Direction; word: string }): string {
  return `${entry.row},${entry.col},${entry.direction},${entry.word}`;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function readRun(
  grid: LogicalGrid,
  row: number,
  col: number,
  direction: Direction
): string {
  const { dr, dc } = delta(direction);
  let word = '';
  let r = row;
  let c = col;
  while (isPlayable(grid, r, c)) {
    word += grid[r][c];
    r += dr;
    c += dc;
  }
  return word;
}

/**
 * Scan the physical grid for Across/Down entries (independent of placement metadata).
 */
export function detectCrosswordEntries(grid: LogicalGrid): DetectedEntry[] {
  const entries: DetectedEntry[] = [];
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isPlayable(grid, r, c)) continue;

      const startsAcross = !isPlayable(grid, r, c - 1) && isPlayable(grid, r, c + 1);
      if (startsAcross) {
        entries.push({
          row: r,
          col: c,
          direction: 'across',
          word: readRun(grid, r, c, 'across'),
        });
      }

      const startsDown = !isPlayable(grid, r - 1, c) && isPlayable(grid, r + 1, c);
      if (startsDown) {
        entries.push({
          row: r,
          col: c,
          direction: 'down',
          word: readRun(grid, r, c, 'down'),
        });
      }
    }
  }

  return entries;
}

function playableCellCount(grid: LogicalGrid): number {
  let n = 0;
  for (const row of grid) {
    for (const ch of row) {
      if (ch) n += 1;
    }
  }
  return n;
}

export function countPlayableComponents(grid: LogicalGrid): number {
  const total = playableCellCount(grid);
  if (total === 0) return 0;

  const rows = grid.length;
  const cols = grid[0].length;
  const seen: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  let components = 0;

  const flood = (sr: number, sc: number) => {
    const stack: Array<[number, number]> = [[sr, sc]];
    seen[sr][sc] = true;
    while (stack.length) {
      const [r, c] = stack.pop()!;
      const neighbors: Array<[number, number]> = [
        [r - 1, c],
        [r + 1, c],
        [r, c - 1],
        [r, c + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (!inBounds(grid, nr, nc) || seen[nr][nc] || !grid[nr][nc]) continue;
        seen[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!grid[r][c] || seen[r][c]) continue;
      components += 1;
      flood(r, c);
    }
  }

  return components;
}

function answersAreConnected(placed: PlacedWord[]): boolean {
  if (placed.length <= 1) return true;
  const parent = placed.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unite = (a: number, b: number) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent[pa] = pb;
  };

  const cells = new Map<string, number[]>();
  placed.forEach((word, index) => {
    const { dr, dc } = delta(word.direction);
    for (let i = 0; i < word.word.length; i++) {
      const key = `${word.row + dr * i},${word.col + dc * i}`;
      const list = cells.get(key) ?? [];
      list.push(index);
      cells.set(key, list);
    }
  });
  for (const indices of cells.values()) {
    for (let i = 1; i < indices.length; i++) unite(indices[0]!, indices[i]!);
  }
  const root = find(0);
  return placed.every((_, i) => find(i) === root);
}

function intersectionCountForWord(grid: LogicalGrid, word: PlacedWord, others: PlacedWord[]): number {
  const { dr, dc } = delta(word.direction);
  const otherCells = new Set<string>();
  for (const other of others) {
    if (other === word) continue;
    const od = delta(other.direction);
    for (let i = 0; i < other.word.length; i++) {
      otherCells.add(`${other.row + od.dr * i},${other.col + od.dc * i}`);
    }
  }
  let n = 0;
  for (let i = 0; i < word.word.length; i++) {
    if (otherCells.has(`${word.row + dr * i},${word.col + dc * i}`)) n += 1;
  }
  return n;
}

function letterConflicts(grid: LogicalGrid, placed: PlacedWord[]): string[] {
  const conflicts: string[] = [];
  for (const word of placed) {
    const { dr, dc } = delta(word.direction);
    for (let i = 0; i < word.word.length; i++) {
      const r = word.row + dr * i;
      const c = word.col + dc * i;
      const expected = word.word[i];
      const actual = letterAt(grid, r, c);
      if (actual !== expected) {
        conflicts.push(`${word.word}@${r},${c} expected ${expected} got ${actual || 'empty'}`);
      }
    }
  }
  return conflicts;
}

function logicalFromPuzzleGrid(grid: CrosswordCell[][]): LogicalGrid {
  return grid.map((row) => row.map((cell) => (cell.isBlack || !cell.letter ? '' : cell.letter)));
}

function bbox(grid: LogicalGrid): { minR: number; maxR: number; minC: number; maxC: number; area: number } | null {
  let minR = Infinity;
  let maxR = -1;
  let minC = Infinity;
  let maxC = -1;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (!grid[r][c]) continue;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (maxR < 0) return null;
  return { minR, maxR, minC, maxC, area: (maxR - minR + 1) * (maxC - minC + 1) };
}

function centerOfMass(grid: LogicalGrid): { r: number; c: number } {
  let rSum = 0;
  let cSum = 0;
  let n = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (!grid[r][c]) continue;
      rSum += r;
      cSum += c;
      n += 1;
    }
  }
  if (n === 0) {
    return { r: (grid.length - 1) / 2, c: (grid[0].length - 1) / 2 };
  }
  return { r: rSum / n, c: cSum / n };
}

/**
 * Whether `word` can occupy (row,col) in `direction` on the logical grid.
 * After the first word, at least one crossing is required.
 */
export function canPlaceWord(
  grid: LogicalGrid,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  requireIntersection: boolean
): { ok: true; intersections: number } | { ok: false } {
  const { dr, dc } = delta(direction);
  const rows = grid.length;
  const cols = grid[0].length;

  if (row < 0 || col < 0) return { ok: false };
  const endR = row + dr * (word.length - 1);
  const endC = col + dc * (word.length - 1);
  if (endR >= rows || endC >= cols) return { ok: false };

  // Word boundaries: cells immediately before/after must be unused or outside.
  if (isPlayable(grid, row - dr, col - dc)) return { ok: false };
  if (isPlayable(grid, endR + dr, endC + dc)) return { ok: false };

  let intersections = 0;
  let newCells = 0;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const existing = grid[r][c];
    const nextCh = word[i];

    if (existing) {
      if (existing !== nextCh) return { ok: false };
      intersections += 1;
    } else {
      newCells += 1;
      // Perpendicular neighbors must be empty unless this cell is a real crossing.
      if (direction === 'across') {
        if (isPlayable(grid, r - 1, c) || isPlayable(grid, r + 1, c)) return { ok: false };
      } else if (isPlayable(grid, r, c - 1) || isPlayable(grid, r, c + 1)) {
        return { ok: false };
      }
    }
  }

  if (newCells === 0) return { ok: false };
  if (requireIntersection && intersections === 0) return { ok: false };
  return { ok: true, intersections };
}

function placeWordOnGrid(
  grid: LogicalGrid,
  word: string,
  row: number,
  col: number,
  direction: Direction
): void {
  const { dr, dc } = delta(direction);
  for (let i = 0; i < word.length; i++) {
    grid[row + dr * i][col + dc * i] = word[i];
  }
}

function futureCrossingPotential(word: string, remaining: string[]): number {
  if (remaining.length === 0) return 0;
  let n = 0;
  for (const other of remaining) {
    for (let i = 0; i < word.length; i++) {
      if (other.includes(word[i]!)) {
        n += 1;
        break;
      }
    }
  }
  return n;
}

function scorePlacement(
  grid: LogicalGrid,
  word: string,
  row: number,
  col: number,
  direction: Direction,
  intersections: number,
  remaining: string[] = []
): number {
  const rows = grid.length;
  const cols = grid[0].length;
  const before = bbox(grid);
  const { dr, dc } = delta(direction);
  let minR = before?.minR ?? row;
  let maxR = before?.maxR ?? row;
  let minC = before?.minC ?? col;
  let maxC = before?.maxC ?? col;
  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
  }
  const areaAfter = (maxR - minR + 1) * (maxC - minC + 1);
  const expansion = areaAfter - (before?.area ?? 0);
  const com = centerOfMass(grid);
  const midR = row + (dr * (word.length - 1)) / 2;
  const midC = col + (dc * (word.length - 1)) / 2;
  const dist = Math.hypot(midR - com.r, midC - com.c);
  const bboxCenterR = (minR + maxR) / 2;
  const bboxCenterC = (minC + maxC) / 2;
  const imbalance =
    Math.abs(bboxCenterR - (rows - 1) / 2) + Math.abs(bboxCenterC - (cols - 1) / 2);

  return (
    intersections * INTERSECTION_WEIGHT -
    expansion * EXPANSION_PENALTY -
    (before ? expansion * SIZE_PENALTY : 0) -
    dist * CENTER_PENALTY -
    imbalance * 4 +
    futureCrossingPotential(word, remaining) * 12
  );
}

function connectivityPotential(word: string, others: string[]): number {
  const letters = new Map<string, number>();
  for (const other of others) {
    if (other === word) continue;
    for (const ch of other) {
      letters.set(ch, (letters.get(ch) ?? 0) + 1);
    }
  }
  let score = 0;
  const seen = new Set<string>();
  for (const ch of word) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    score += letters.get(ch) ?? 0;
  }
  return score + word.length * 2;
}

/**
 * Validate a logical crossword against intended placements.
 */
export function validateCrossword(
  grid: LogicalGrid | CrosswordCell[][],
  placedWords: PlacedWord[]
): CrosswordValidationResult {
  const sample = grid[0]?.[0];
  const logical: LogicalGrid =
    typeof sample === 'string' ? (grid as LogicalGrid) : logicalFromPuzzleGrid(grid as CrosswordCell[][]);

  const errors: string[] = [];
  const placedAnswers = placedWords.map((w) => w.word);
  const intersectionCountByAnswer: Record<string, number> = {};
  placedWords.forEach((word, i) => {
    const key = `${word.word}#${i}`;
    intersectionCountByAnswer[key] = intersectionCountForWord(
      logical,
      word,
      placedWords.filter((_, j) => j !== i)
    );
  });

  const detected = detectCrosswordEntries(logical);
  const detectedAcross = detected.filter((e) => e.direction === 'across').map((e) => e.word);
  const detectedDown = detected.filter((e) => e.direction === 'down').map((e) => e.word);
  const shortEntries = detected.filter((e) => e.word.length < MIN_CROSSWORD_ENTRY_LENGTH).map(entryKey);
  const validDetected = detected.filter((e) => e.word.length >= MIN_CROSSWORD_ENTRY_LENGTH);

  if (shortEntries.length > 0) {
    errors.push(`short entries: ${shortEntries.join('; ')}`);
  }

  const intendedKeys = placedWords.map(entryKey).sort();
  const detectedKeys = validDetected.map(entryKey).sort();
  const intendedSet = new Set(intendedKeys);
  const detectedSet = new Set(detectedKeys);
  const ghostEntries = detectedKeys.filter((k) => !intendedSet.has(k));
  const missing = intendedKeys.filter((k) => !detectedSet.has(k));

  if (ghostEntries.length > 0) {
    errors.push(`ghost entries: ${ghostEntries.join('; ')}`);
  }
  if (missing.length > 0) {
    errors.push(`missing intended entries: ${missing.join('; ')}`);
  }

  const conflicts = letterConflicts(logical, placedWords);
  if (conflicts.length > 0) {
    errors.push(`letter conflicts: ${conflicts.join('; ')}`);
  }

  const connectedComponents = countPlayableComponents(logical);
  if (playableCellCount(logical) > 0 && connectedComponents !== 1) {
    errors.push(`connected components: ${connectedComponents}`);
  }
  if (!answersAreConnected(placedWords)) {
    errors.push('answers are not one intersecting component');
  }

  placedWords.forEach((word, i) => {
    if (i === 0) return;
    const crosses = intersectionCountByAnswer[`${word.word}#${i}`] ?? 0;
    if (crosses === 0) {
      errors.push(`isolated answer: ${word.word} at ${word.row},${word.col}`);
    }
  });

  const startCells = new Map<string, DetectedEntry[]>();
  for (const entry of validDetected) {
    const key = `${entry.row},${entry.col}`;
    const list = startCells.get(key) ?? [];
    list.push(entry);
    startCells.set(key, list);
  }
  const sortedStarts = [...startCells.keys()]
    .map((key) => {
      const [r, c] = key.split(',').map(Number);
      const hasAcross = (startCells.get(key) ?? []).some((e) => e.direction === 'across');
      return { r, c, key, hasAcross };
    })
    // Mirror the Across-first sort used in numberGridFromGeometry.
    .sort((a, b) => {
      const aGroup = a.hasAcross ? 0 : 1;
      const bGroup = b.hasAcross ? 0 : 1;
      if (aGroup !== bGroup) return aGroup - bGroup;
      return a.r - b.r || a.c - b.c;
    });

  let numberingIsValid = true;
  if (sample && typeof sample === 'object') {
    const puzzleGrid = grid as CrosswordCell[][];
    const usedNumbers = new Set<number>();
    sortedStarts.forEach((start, i) => {
      const expected = i + 1;
      const cell = puzzleGrid[start.r]?.[start.c];
      if (!cell || cell.clueNumber !== expected) {
        numberingIsValid = false;
        errors.push(`numbering at ${start.r},${start.c}: expected ${expected} got ${cell?.clueNumber ?? 'none'}`);
      } else if (usedNumbers.has(expected)) {
        numberingIsValid = false;
        errors.push(`duplicate clue number ${expected}`);
      } else {
        usedNumbers.add(expected);
      }
    });
    for (let r = 0; r < puzzleGrid.length; r++) {
      for (let c = 0; c < puzzleGrid[0].length; c++) {
        const num = puzzleGrid[r][c].clueNumber;
        if (num == null) continue;
        if (!startCells.has(`${r},${c}`)) {
          numberingIsValid = false;
          errors.push(`number ${num} on non-start cell ${r},${c}`);
        }
      }
    }
  }

  const isValid =
    errors.length === 0 &&
    numberingIsValid &&
    ghostEntries.length === 0 &&
    shortEntries.length === 0 &&
    conflicts.length === 0 &&
    (playableCellCount(logical) === 0 || connectedComponents === 1) &&
    intendedKeys.length === detectedKeys.length;

  return {
    isValid,
    errors,
    placedAnswers,
    failedAnswers: [],
    intersectionCountByAnswer,
    detectedAcross,
    detectedDown,
    connectedComponents,
    ghostEntries,
    shortEntries,
    letterConflicts: conflicts,
    numberingIsValid,
    allAnswersPlaced: missing.length === 0 && ghostEntries.length === 0,
    detectedEntriesCount: validDetected.length,
    intendedEntriesCount: placedWords.length,
  };
}

export function validateCrosswordPuzzle(puzzle: CrosswordPuzzle): CrosswordValidationResult {
  const logical = logicalFromPuzzleGrid(puzzle.grid);
  const placed: PlacedWord[] = [];
  const starts = new Map<string, { r: number; c: number }>();

  for (let r = 0; r < puzzle.grid.length; r++) {
    for (let c = 0; c < puzzle.grid[0].length; c++) {
      const num = puzzle.grid[r][c].clueNumber;
      if (num != null) starts.set(String(num), { r, c });
    }
  }

  for (const clue of puzzle.acrossClues) {
    const start = starts.get(String(clue.number));
    if (!start) continue;
    placed.push({
      word: clue.answer.toUpperCase(),
      clue: clue.clue,
      row: start.r,
      col: start.c,
      direction: 'across',
    });
  }
  for (const clue of puzzle.downClues) {
    const start = starts.get(String(clue.number));
    if (!start) continue;
    placed.push({
      word: clue.answer.toUpperCase(),
      clue: clue.clue,
      row: start.r,
      col: start.c,
      direction: 'down',
    });
  }

  return validateCrossword(puzzle.grid, placed);
}

function numberGridFromGeometry(
  puzzleGrid: CrosswordCell[][],
  logical: LogicalGrid
): Map<string, number> {
  const detected = detectCrosswordEntries(logical).filter(
    (e) => e.word.length >= MIN_CROSSWORD_ENTRY_LENGTH
  );

  // Build a set of cells that start an Across word vs only a Down word.
  const acrossStarts = new Set(
    detected.filter((e) => e.direction === 'across').map((e) => `${e.row},${e.col}`)
  );
  const allStartKeys = new Set(detected.map((e) => `${e.row},${e.col}`));

  const starts = [...allStartKeys]
    .map((key) => {
      const [r, c] = key.split(',').map(Number);
      return { r, c, hasAcross: acrossStarts.has(key) };
    })
    /**
     * Sort so that cells starting an Across word always come before cells that
     * start only a Down word. Within each group, order is top-to-bottom then
     * left-to-right (standard crossword numbering within the group).
     *
     * Effect: "1 Across" is guaranteed to be the first clue number; Down-only
     * cells receive higher numbers after all Across-starting cells.
     */
    .sort((a, b) => {
      // Primary: Across-starting cells first (0 = has across, 1 = down-only)
      const aGroup = a.hasAcross ? 0 : 1;
      const bGroup = b.hasAcross ? 0 : 1;
      if (aGroup !== bGroup) return aGroup - bGroup;
      // Secondary: top-to-bottom, left-to-right within each group
      return a.r - b.r || a.c - b.c;
    });

  for (const row of puzzleGrid) {
    for (const cell of row) delete cell.clueNumber;
  }

  const numbers = new Map<string, number>();
  starts.forEach((start, i) => {
    const num = i + 1;
    const key = `${start.r},${start.c}`;
    numbers.set(key, num);
    const cell = puzzleGrid[start.r]?.[start.c];
    if (cell) cell.clueNumber = num;
  });
  return numbers;
}

function buildClueLists(
  placed: PlacedWord[],
  numbers: Map<string, number>
): {
  acrossClues: { number: number; clue: string; answer: string }[];
  downClues: { number: number; clue: string; answer: string }[];
} {
  const acrossClues: { number: number; clue: string; answer: string }[] = [];
  const downClues: { number: number; clue: string; answer: string }[] = [];

  for (const word of placed) {
    const num = numbers.get(`${word.row},${word.col}`);
    if (!num) continue;
    const clueObj = { number: num, clue: word.clue, answer: word.word };
    if (word.direction === 'across') acrossClues.push(clueObj);
    else downClues.push(clueObj);
  }

  acrossClues.sort((a, b) => a.number - b.number);
  downClues.sort((a, b) => a.number - b.number);
  return { acrossClues, downClues };
}

function toPuzzleGrid(logical: LogicalGrid): CrosswordCell[][] {
  return logical.map((row) =>
    row.map((ch) =>
      ch
        ? { isBlack: false, letter: ch }
        : { isBlack: true }
    )
  );
}

function findCandidates(
  grid: LogicalGrid,
  word: string,
  requireIntersection: boolean,
  remaining: string[] = []
): CandidatePlacement[] {
  const rows = grid.length;
  const cols = grid[0].length;
  const candidates: CandidatePlacement[] = [];
  const seen = new Set<string>();

  const consider = (row: number, col: number, direction: Direction) => {
    const key = `${row},${col},${direction}`;
    if (seen.has(key)) return;
    seen.add(key);
    const result = canPlaceWord(grid, word, row, col, direction, requireIntersection);
    if (!result.ok) return;
    candidates.push({
      row,
      col,
      direction,
      intersections: result.intersections,
      score: scorePlacement(grid, word, row, col, direction, result.intersections, remaining),
    });
  };

  if (!requireIntersection) {
    return firstWordCandidates(word, rows, cols, remaining, 0);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = grid[r][c];
      if (!ch) continue;
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== ch) continue;
        consider(r, c - i, 'across');
        consider(r - i, c, 'down');
      }
    }
  }

  return candidates;
}

function firstWordCandidates(
  word: string,
  rows: number,
  cols: number,
  remaining: string[],
  attempt: number
): CandidatePlacement[] {
  const empty = createLogicalGrid(rows, cols);
  const centerR = Math.floor(rows / 2);
  const centerC = Math.floor(cols / 2);
  const dirs: Direction[] =
    attempt % 2 === 0 ? ['across', 'down'] : ['down', 'across'];
  const offsets = [0, -1, 1, -2, 2, -3, 3];
  const candidates: CandidatePlacement[] = [];
  const seen = new Set<string>();

  for (const direction of dirs) {
    for (const or of offsets) {
      for (const oc of offsets) {
        const row =
          direction === 'across'
            ? centerR + or
            : centerR - Math.floor(word.length / 2) + or;
        const col =
          direction === 'across'
            ? centerC - Math.floor(word.length / 2) + oc
            : centerC + oc;
        const key = `${row},${col},${direction}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const result = canPlaceWord(empty, word, row, col, direction, false);
        if (!result.ok) continue;
        candidates.push({
          row,
          col,
          direction,
          intersections: 0,
          score: scorePlacement(empty, word, row, col, direction, 0, remaining),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

function geometryAllowsPlacement(grid: LogicalGrid, placed: PlacedWord[]): boolean {
  return validateCrossword(grid, placed).isValid;
}

function rebuildGrid(rows: number, cols: number, placed: PlacedWord[]): LogicalGrid {
  const grid = createLogicalGrid(rows, cols);
  for (const word of placed) {
    placeWordOnGrid(grid, word.word, word.row, word.col, word.direction);
  }
  return grid;
}

export function unusedCrosswordMargins(grid: LogicalGrid): {
  left: number;
  right: number;
  top: number;
  bottom: number;
  minR: number;
  maxR: number;
  minC: number;
  maxC: number;
} | null {
  const box = bbox(grid);
  if (!box) return null;
  const rows = grid.length;
  const cols = grid[0].length;
  return {
    left: box.minC,
    right: cols - 1 - box.maxC,
    top: box.minR,
    bottom: rows - 1 - box.maxR,
    minR: box.minR,
    maxR: box.maxR,
    minC: box.minC,
    maxC: box.maxC,
  };
}

/** Translate the whole crossword so its bounding box is centered in the logical grid. */
export function centerCrosswordInGrid(
  grid: LogicalGrid,
  placed: PlacedWord[]
): { grid: LogicalGrid; placed: PlacedWord[] } {
  const rows = grid.length;
  const cols = grid[0].length;
  const box = bbox(grid);
  if (!box || placed.length === 0) return { grid, placed };

  const contentHeight = box.maxR - box.minR + 1;
  const contentWidth = box.maxC - box.minC + 1;
  const targetMinRow = Math.floor((rows - contentHeight) / 2);
  const targetMinCol = Math.floor((cols - contentWidth) / 2);
  const deltaRow = targetMinRow - box.minR;
  const deltaCol = targetMinCol - box.minC;
  if (deltaRow === 0 && deltaCol === 0) return { grid, placed };

  const moved = placed.map((word) => ({
    ...word,
    row: word.row + deltaRow,
    col: word.col + deltaCol,
  }));
  return { grid: rebuildGrid(rows, cols, moved), placed: moved };
}

function emptyPuzzle(rows: number, cols: number): CrosswordPuzzle {
  return {
    type: 'crossword',
    grid: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ isBlack: true }))
    ),
    acrossClues: [],
    downClues: [],
  };
}

function logDebug(info: Record<string, unknown>): void {
  if (!CROSSWORD_DEBUG) return;
  console.debug('[crossword-generator]', info);
}

function orderWords(prepared: PreparedWord[], attempt: number): PreparedWord[] {
  const ranked = [...prepared].sort((a, b) => {
    const cb = connectivityPotential(
      b.word,
      prepared.map((p) => p.word)
    );
    const ca = connectivityPotential(
      a.word,
      prepared.map((p) => p.word)
    );
    return cb - ca || b.word.length - a.word.length;
  });

  if (ranked.length <= 1) return ranked;

  const seedPool = ranked.slice(0, Math.min(5, ranked.length));
  const seed = seedPool[attempt % seedPool.length]!;
  const rest = ranked.filter((w) => w !== seed);
  if (attempt > 0) shuffleInPlace(rest);
  // Do not leave the weakest connectors for last: mix a low-connectivity word forward.
  if (rest.length > 2 && attempt % 3 === 1) {
    const weakest = [...rest].sort(
      (a, b) =>
        connectivityPotential(
          a.word,
          prepared.map((p) => p.word)
        ) -
        connectivityPotential(
          b.word,
          prepared.map((p) => p.word)
        )
    )[0];
    if (weakest) {
      const idx = rest.indexOf(weakest);
      if (idx > 0) {
        rest.splice(idx, 1);
        rest.splice(0, 0, weakest);
      }
    }
  }
  return [seed, ...rest];
}

function generateOnce(
  ordered: PreparedWord[],
  rows: number,
  cols: number,
  attempt: number,
  maxNodes = MAX_NODES_PER_ATTEMPT
): { grid: LogicalGrid; placed: PlacedWord[]; failed: PreparedWord[]; nodes: number } {
  const placed: PlacedWord[] = [];
  let nodes = 0;
  let bestPlaced: PlacedWord[] = [];

  const search = (remaining: PreparedWord[]): boolean => {
    if (placed.length > bestPlaced.length) bestPlaced = placed.map((p) => ({ ...p }));
    if (remaining.length === 0) return true;
    if (++nodes > maxNodes) return false;

    const grid = rebuildGrid(rows, cols, placed);
    const remainingWords = remaining.map((w) => w.word);

    let pick = remaining[0]!;
    let pickCands: CandidatePlacement[] = [];
    let pickCount = Infinity;

    if (placed.length === 0) {
      pick = remaining[0]!;
      pickCands = firstWordCandidates(pick.word, rows, cols, remainingWords.slice(1), attempt);
      pickCount = pickCands.length;
    } else {
      for (const item of remaining) {
        const others = remaining.filter((w) => w !== item).map((w) => w.word);
        const cands = findCandidates(grid, item.word, true, others);
        if (cands.length === 0) continue;
        if (cands.length < pickCount) {
          pickCount = cands.length;
          pick = item;
          pickCands = cands;
        }
      }
    }

    if (pickCands.length === 0) return false;

    pickCands.sort((a, b) => b.score - a.score || b.intersections - a.intersections);
    if (attempt > 0 && pickCands.length > 2) {
      const span = Math.min(4, pickCands.length - 1);
      for (let i = 0; i < span; i++) {
        if (Math.random() < 0.4) {
          const j = i + 1 + Math.floor(Math.random() * Math.max(1, span - i));
          if (j < pickCands.length) {
            [pickCands[i], pickCands[j]] = [pickCands[j]!, pickCands[i]!];
          }
        }
      }
    }

    const remainingAfter = remaining.filter((w) => w !== pick);
    const beam =
      remainingAfter.length <= 2
        ? Math.min(pickCands.length, 14)
        : pickCands.length <= 5
          ? pickCands.length
          : Math.min(pickCands.length, placed.length === 0 ? 6 : 8);

    for (let i = 0; i < beam; i++) {
      const cand = pickCands[i]!;
      placed.push({
        word: pick.word,
        clue: pick.clue,
        row: cand.row,
        col: cand.col,
        direction: cand.direction,
        id: pick.id,
      });
      if (remainingAfter.length === 0) {
        const nextGrid = rebuildGrid(rows, cols, placed);
        if (!geometryAllowsPlacement(nextGrid, placed)) {
          placed.pop();
          continue;
        }
      }
      if (search(remainingAfter)) return true;
      placed.pop();
    }
    return false;
  };

  const complete = search(ordered);
  const used = complete ? placed : bestPlaced;
  const usedIds = new Set(used.map((w) => w.id));
  const failed = ordered.filter((item) => !usedIds.has(item.id));
  return {
    grid: rebuildGrid(rows, cols, used),
    placed: used,
    failed,
    nodes,
  };
}

export interface GenerateCrosswordOptions {
  lettersAcross?: number;
  lettersDown?: number;
  allowNumbers?: boolean;
  maxAnswerLength?: number;
  /**
   * When true, keep searching until every requested clue is placed (slow).
   * When false, take the best layout after a short search.
   */
  exactClueCount?: boolean;
  language?: string;
}

export function generateCrossword(
  wordClues: { word: string; clue: string }[],
  gridSizeOrOptions: number | GenerateCrosswordOptions = 15
): CrosswordPuzzle {
  const options: GenerateCrosswordOptions =
    typeof gridSizeOrOptions === 'number'
      ? { lettersAcross: gridSizeOrOptions, lettersDown: gridSizeOrOptions }
      : gridSizeOrOptions;

  const cols = Math.max(5, options.lettersAcross ?? 15);
  const rows = Math.max(5, options.lettersDown ?? cols);
  const allowNumbers = options.allowNumbers ?? false;
  const maxAnswerLength = options.maxAnswerLength ?? 30;
  const exactClueCount = options.exactClueCount === true;
  const maxAttempts = exactClueCount
    ? MAX_CROSSWORD_GENERATION_ATTEMPTS
    : FAST_CROSSWORD_GENERATION_ATTEMPTS;
  const maxNodes = exactClueCount ? MAX_NODES_PER_ATTEMPT : FAST_NODES_PER_ATTEMPT;
  const completeLayoutsNeeded = exactClueCount ? 4 : 1;
  const maxFitLength = Math.max(cols, rows);
  const requestedClueCount = wordClues.length;

  const prepared: PreparedWord[] = wordClues
    .map((wc, id) => {
      let word = cleanCrosswordAnswer(wc.word, allowNumbers, options.language);
      if (maxAnswerLength > 0 && word.length > maxAnswerLength) {
        word = word.slice(0, maxAnswerLength);
      }
      if (word.length > maxFitLength) {
        return null;
      }
      return {
        id,
        word,
        clue: (wc.clue || '').trim() || `Clue for ${wc.word}`,
      };
    })
    .filter((w): w is PreparedWord => w !== null && w.word.length >= MIN_CROSSWORD_ENTRY_LENGTH);

  if (prepared.length === 0) {
    return emptyPuzzle(rows, cols);
  }

  const targetCount = prepared.length;
  const attemptSummaries: string[] = [];
  let best: {
    grid: LogicalGrid;
    placed: PlacedWord[];
    failed: PreparedWord[];
    validation: CrosswordValidationResult;
    attempt: number;
    score: number;
  } | null = null;
  let completeLayouts = 0;
  let placementLoopIterations = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ordered = orderWords(prepared, attempt);
    const { grid, placed, failed, nodes } = generateOnce(ordered, rows, cols, attempt, maxNodes);
    placementLoopIterations += ordered.length;
    attemptSummaries.push(`${placed.length}/${targetCount}`);

    if (placed.length === 0) continue;

    const validation = validateCrossword(grid, placed);
    if (!validation.isValid) continue;

    const box = bbox(grid);
    const margins = unusedCrosswordMargins(grid);
    const imbalance = margins
      ? Math.abs(margins.left - margins.right) + Math.abs(margins.top - margins.bottom)
      : 0;
    const score =
      placed.length * 100000 +
      Object.values(validation.intersectionCountByAnswer).reduce((s, n) => s + n, 0) * 20 -
      (box?.area ?? 0) * 4 -
      imbalance * 12;

    const better =
      !best ||
      placed.length > best.placed.length ||
      (placed.length === best.placed.length && score > best.score);

    if (better) {
      best = { grid, placed, failed, validation, attempt, score };
    }

    if (placed.length === targetCount) {
      completeLayouts += 1;
      if (completeLayouts >= completeLayoutsNeeded) break;
    }
    void nodes;
  }

  if (!best) {
    logDebug({
      event: 'generation-failed',
      requestedClueCount,
      availableAnswers: wordClues.length,
      answersPassedToGenerator: prepared.length,
      placementLoopIterations,
      placedAnswers: 0,
      failedAnswers: prepared.length,
    });
    return emptyPuzzle(rows, cols);
  }

  const centeredTry = centerCrosswordInGrid(best.grid, best.placed);
  const centeredOk = validateCrossword(centeredTry.grid, centeredTry.placed).isValid;
  const centered = centeredOk ? centeredTry : { grid: best.grid, placed: best.placed };
  const puzzleGrid = toPuzzleGrid(centered.grid);
  const numbers = numberGridFromGeometry(puzzleGrid, centered.grid);
  const { acrossClues, downClues } = buildClueLists(centered.placed, numbers);
  const numberedValidation = validateCrossword(puzzleGrid, centered.placed);
  const margins = unusedCrosswordMargins(centered.grid);
  const centeringPass =
    !!margins &&
    Math.abs(margins.left - margins.right) <= 1 &&
    Math.abs(margins.top - margins.bottom) <= 1;

  const summary = {
    requestedClueCount,
    availableAnswers: wordClues.length,
    answersPassedToGenerator: prepared.length,
    placementLoopIterations,
    placedAnswers: centered.placed.length,
    failedAnswers: best.failed.length,
    generationAttempts: attemptSummaries.length,
    attempts: attemptSummaries.slice(0, 12),
    selectedAttempt: best.attempt + 1,
    intersections: Object.values(best.validation.intersectionCountByAnswer).reduce(
      (s, n) => s + n,
      0
    ),
    grid: `${cols} × ${rows}`,
    boundingBox: margins
      ? { minRow: margins.minR, maxRow: margins.maxR, minCol: margins.minC, maxCol: margins.maxC }
      : null,
    unused: margins
      ? { left: margins.left, right: margins.right, top: margins.top, bottom: margins.bottom }
      : null,
    centering: centeringPass ? 'PASS' : 'FAIL',
  };
  logDebug(summary);
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.debug('[crossword-generator]', summary);
  }

  void numberedValidation;

  return {
    type: 'crossword',
    grid: puzzleGrid,
    acrossClues,
    downClues,
  };
}

export type { PlacedWord, DetectedEntry, LogicalGrid };

/**
 * Identify single isolated 1x1 unused (black) cells in a crossword grid
 * that are completely surrounded on all 4 orthogonal sides by active letter cells.
 */
export function findInteriorUnusedCells(grid: CrosswordCell[][]): boolean[][] {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0]?.length ?? 0;
  if (cols === 0) return [];

  const isEnclosed: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));

  const isActive = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const cell = grid[r]?.[c];
    return !!cell && !cell.isBlack;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r]?.[c]?.isBlack) {
        const topActive = isActive(r - 1, c);
        const botActive = isActive(r + 1, c);
        const leftActive = isActive(r, c - 1);
        const rightActive = isActive(r, c + 1);

        if (topActive && botActive && leftActive && rightActive) {
          isEnclosed[r][c] = true;
        }
      }
    }
  }

  return isEnclosed;
}


