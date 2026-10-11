/**
 * Codewords / Mots Codés generator.
 * Dense crossword-style grid fill with letter↔number mapping.
 * Independent from the classic Crossword layout algorithm.
 */

import type { DocumentBatchPuzzleMeta } from './types';
import {
  buildPatternIndex,
  getCodewordDictionary,
  wordsMatchingPattern,
  type CodewordDictionary,
  type PatternIndex,
} from './codewords-dictionary';
import {
  baseCodeLetter,
  getLanguageLetterAlphabet,
  isLetterGrapheme,
  localeCompareText,
} from '../unicode-text';

/** Resolve the A–Z code for a (possibly accented) grid letter. */
function codeForLetter(
  letterToNumber: Record<string, number>,
  letter: string,
  language?: string | null
): number | null {
  const base = baseCodeLetter(letter, language);
  if (!base) return null;
  const n = letterToNumber[base];
  return typeof n === 'number' ? n : null;
}

/** Collect distinct base A–Z letters used in a filled solution. */
function usedBaseLetters(
  solutionLetters: (string | null)[][],
  blocked: boolean[][],
  language?: string | null
): string[] {
  const seen = new Set<string>();
  for (let r = 0; r < blocked.length; r++) {
    for (let c = 0; c < (blocked[r]?.length ?? 0); c++) {
      if (blocked[r]![c]) continue;
      const ch = solutionLetters[r]?.[c];
      if (!ch) continue;
      const base = baseCodeLetter(ch, language);
      if (base) seen.add(base);
    }
  }
  return [...seen];
}
export type CodewordDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard';
export type CodewordHintMode = 'all-occurrences' | 'single-occurrence';
export type CodewordLetterCase = 'upper' | 'lower';

export const CODEWORD_GRID_PRESETS = [11, 13, 15, 17, 19, 21] as const;
export type CodewordGridSize = (typeof CODEWORD_GRID_PRESETS)[number];

export interface CodewordAlphabetEntry {
  number: number;
  letter: string | null;
  revealed: boolean;
}

export interface CodewordSolutionCell {
  blocked: boolean;
  letter: string | null;
}

export interface CodewordPuzzleCell {
  blocked: boolean;
  code: number | null;
  letter: string | null;
  isHint: boolean;
}

export interface CodewordPuzzle extends DocumentBatchPuzzleMeta {
  type: 'codewords';
  id?: string;
  rows: number;
  cols: number;
  /** Alias for layout cell sizing (same as rows for square grids). */
  size: number;
  solutionGrid: CodewordSolutionCell[][];
  puzzleGrid: CodewordPuzzleCell[][];
  letterToNumber: Record<string, number>;
  numberToLetter: Record<number, string>;
  hintLetters: string[];
  hintMode: CodewordHintMode;
  alphabetEntries: CodewordAlphabetEntry[];
  difficulty: CodewordDifficulty;
  metadata: {
    seed?: number;
    language: string;
    createdAt?: string;
  };
}

export interface CodewordGenerateOptions {
  dictionary?: CodewordDictionary;
  alphabet?: string[];
  rows: number;
  cols: number;
  difficulty?: CodewordDifficulty;
  hintCount?: number;
  hintMode?: CodewordHintMode;
  seed?: number;
  language?: string;
  /** Soft time budget in ms (best-effort; yields between attempts). */
  timeBudgetMs?: number;
  signal?: { cancelled?: boolean };
}

export type CodewordGenerationState =
  | 'idle'
  | 'generating'
  | 'success'
  | 'failed'
  | 'cancelled';

type Slot = {
  id: number;
  row: number;
  col: number;
  dir: 'across' | 'down';
  length: number;
};

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

export function defaultHintCountForDifficulty(d: CodewordDifficulty): number {
  switch (d) {
    case 'easy':
      return 6;
    case 'medium':
      return 4;
    case 'hard':
      return 2;
    case 'very-hard':
      return 1;
    default:
      return 3;
  }
}

export function createLetterNumberMapping(
  alphabet: string[],
  seed: number
): { letterToNumber: Record<string, number>; numberToLetter: Record<number, string> } {
  const letters = [...alphabet];
  const rand = mulberry32(seed || 1);
  shuffleInPlace(letters, rand);
  const letterToNumber: Record<string, number> = {};
  const numberToLetter: Record<number, string> = {};
  letters.forEach((letter, i) => {
    const n = i + 1;
    letterToNumber[letter] = n;
    numberToLetter[n] = letter;
  });
  return { letterToNumber, numberToLetter };
}

/** Remap an existing solution grid to a fresh letter↔number mapping. */
export function remapCodewordPuzzle(
  puzzle: CodewordPuzzle,
  seed: number
): CodewordPuzzle {
  const language = puzzle.metadata?.language;
  const alphabet = Object.keys(puzzle.letterToNumber).sort((a, b) =>
    localeCompareText(a, b, language)
  );
  const { letterToNumber, numberToLetter } = createLetterNumberMapping(
    alphabet.length > 0 ? alphabet : getLanguageLetterAlphabet('en'),
    seed
  );
  // Hints are always plain A–Z base letters, never accented forms.
  const hintSet = new Set(
    puzzle.hintLetters.map((h) => baseCodeLetter(h, language)).filter(Boolean)
  );
  const puzzleGrid = puzzle.solutionGrid.map((row) =>
    row.map((cell) => {
      if (cell.blocked || !cell.letter) {
        return { blocked: true, code: null, letter: null, isHint: false };
      }
      const base = baseCodeLetter(cell.letter, language);
      const isHint = hintSet.has(base);
      return {
        blocked: false,
        code: codeForLetter(letterToNumber, cell.letter, language),
        // Show the real (possibly accented) letter on the grid when hinted.
        letter: isHint && puzzle.hintMode === 'all-occurrences' ? cell.letter : null,
        isHint: false,
      };
    })
  );
  // Apply single-occurrence hints
  if (puzzle.hintMode === 'single-occurrence') {
    const placed = new Set<string>();
    for (let r = 0; r < puzzleGrid.length; r++) {
      for (let c = 0; c < (puzzleGrid[r]?.length ?? 0); c++) {
        const sol = puzzle.solutionGrid[r]![c]!;
        if (sol.blocked || !sol.letter) continue;
        const base = baseCodeLetter(sol.letter, language);
        if (!hintSet.has(base) || placed.has(base)) continue;
        puzzleGrid[r]![c]!.letter = sol.letter;
        puzzleGrid[r]![c]!.isHint = true;
        placed.add(base);
      }
    }
  } else {
    for (let r = 0; r < puzzleGrid.length; r++) {
      for (let c = 0; c < (puzzleGrid[r]?.length ?? 0); c++) {
        const cell = puzzleGrid[r]![c]!;
        if (cell.letter) cell.isHint = true;
      }
    }
  }
  const alphabetEntries: CodewordAlphabetEntry[] = Object.keys(numberToLetter)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => {
      const letter = numberToLetter[n]!;
      const revealed = hintSet.has(letter);
      return { number: n, letter: revealed ? letter : null, revealed };
    });
  return {
    ...puzzle,
    letterToNumber,
    numberToLetter,
    puzzleGrid,
    alphabetEntries,
    hintLetters: [...hintSet],
    metadata: { ...puzzle.metadata, seed },
  };
}

function makeEmptyBlocked(rows: number, cols: number): boolean[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function cloneBlocked(blocked: boolean[][]): boolean[][] {
  return blocked.map((row) => row.slice());
}

function applySymmetry(blocked: boolean[][]): void {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blocked[r]![c]) blocked[rows - 1 - r]![cols - 1 - c] = true;
    }
  }
}

function patternLooksViable(blocked: boolean[][]): boolean {
  if (!isConnected(blocked)) return false;
  const white = playableCells(blocked).length;
  const total = blocked.length * (blocked[0]?.length ?? 0);
  if (white < total * 0.4) return false;
  const slots = extractSlots(blocked);
  return slots.length >= 4;
}

/**
 * Constructive dense fill: place intersecting words, then black unused cells.
 * More reliable than pattern-first fill for modest dictionaries.
 */
export function constructiveFill(
  rows: number,
  cols: number,
  index: PatternIndex,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): { blocked: boolean[][]; letters: (string | null)[][]; debug?: string } | null {
  const grid: (string | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null)
  );
  const occupied: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );

  const allWords = [...(index.wordsByLength.get(5) ?? [])];
  for (const len of [4, 6, 7, 3, 8]) {
    allWords.push(...(index.wordsByLength.get(len) ?? []));
  }
  if (allWords.length < 20) {
    return null;
  }
  shuffleInPlace(allWords, rand);

  const used = new Set<string>();

  const canPlace = (word: string, r: number, c: number, across: boolean): boolean => {
    if (across) {
      if (c + word.length > cols) return false;
      if (c > 0 && occupied[r]![c - 1]) return false;
      if (c + word.length < cols && occupied[r]![c + word.length]) return false;
      let crosses = 0;
      for (let i = 0; i < word.length; i++) {
        const cell = grid[r]![c + i];
        if (occupied[r]![c + i]) {
          if (cell !== word[i]) return false;
          crosses += 1;
        } else {
          // New cell must not touch occupied cells above/below (prevents incidental downs)
          if (r > 0 && occupied[r - 1]![c + i]) return false;
          if (r + 1 < rows && occupied[r + 1]![c + i]) return false;
        }
      }
      const hasContent = used.size > 0;
      if (hasContent && crosses === 0) return false;
      return true;
    }
    if (r + word.length > rows) return false;
    if (r > 0 && occupied[r - 1]![c]) return false;
    if (r + word.length < rows && occupied[r + word.length]![c]) return false;
    let crosses = 0;
    for (let i = 0; i < word.length; i++) {
      const cell = grid[r + i]![c];
      if (occupied[r + i]![c]) {
        if (cell !== word[i]) return false;
        crosses += 1;
      } else {
        // New cell must not touch occupied cells left/right (prevents incidental across)
        if (c > 0 && occupied[r + i]![c - 1]) return false;
        if (c + 1 < cols && occupied[r + i]![c + 1]) return false;
      }
    }
    const hasContent = used.size > 0;
    if (hasContent && crosses === 0) return false;
    return true;
  };

  const doPlace = (word: string, r: number, c: number, across: boolean) => {
    for (let i = 0; i < word.length; i++) {
      const rr = across ? r : r + i;
      const cc = across ? c + i : c;
      grid[rr]![cc] = word[i]!;
      occupied[rr]![cc] = true;
    }
    used.add(word);
  };

  // Index words by letter for fast crossing lookup
  const wordsByLetter = new Map<string, string[]>();
  for (const w of allWords) {
    const seen = new Set<string>();
    for (const ch of w) {
      if (seen.has(ch)) continue;
      seen.add(ch);
      const list = wordsByLetter.get(ch);
      if (list) list.push(w);
      else wordsByLetter.set(ch, [w]);
    }
  }

  // Seed word near center
  const seed = allWords.find((w) => w.length <= cols && canPlace(w, Math.floor(rows / 2), Math.floor((cols - w.length) / 2), true));
  if (!seed) {
    return null;
  }
  doPlace(seed, Math.floor(rows / 2), Math.floor((cols - seed.length) / 2), true);

  let idle = 0;
  let placeCount = 1;
  while (idle < 60 && Date.now() < deadline && !signal?.cancelled) {
    let placed = false;
    const anchors: Array<{ r: number; c: number; ch: string }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (occupied[r]![c] && grid[r]![c]) anchors.push({ r, c, ch: grid[r]![c]! });
      }
    }
    shuffleInPlace(anchors, rand);

    outer: for (const anchor of anchors) {
      const candidates = [...(wordsByLetter.get(anchor.ch) ?? [])].filter((w) => !used.has(w));
      shuffleInPlace(candidates, rand);
      for (const word of candidates.slice(0, 120)) {
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== anchor.ch) continue;
          const c0 = anchor.c - i;
          if (c0 >= 0 && canPlace(word, anchor.r, c0, true)) {
            doPlace(word, anchor.r, c0, true);
            placed = true;
            placeCount += 1;
            break outer;
          }
          const r0 = anchor.r - i;
          if (r0 >= 0 && canPlace(word, r0, anchor.c, false)) {
            doPlace(word, r0, anchor.c, false);
            placed = true;
            placeCount += 1;
            break outer;
          }
        }
      }
    }
    if (placed) idle = 0;
    else idle += 1;
  }

  if (placeCount < 4) {
    return null;
  }

  // Convert unoccupied → blocked; keep occupied letters.
  const blocked = makeEmptyBlocked(rows, cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      blocked[r]![c] = !occupied[r]![c];
    }
  }

  // Black cells that are not part of any ≥3-letter across OR down slot.
  const partOfLongSlot: boolean[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false)
  );
  const markSlots = () => {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) partOfLongSlot[r]![c] = false;
    }
    for (const slot of extractSlots(blocked)) {
      for (let i = 0; i < slot.length; i++) {
        const rr = slot.dir === 'across' ? slot.row : slot.row + i;
        const cc = slot.dir === 'across' ? slot.col + i : slot.col;
        partOfLongSlot[rr]![cc] = true;
      }
    }
  };
  markSlots();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!blocked[r]![c] && !partOfLongSlot[r]![c]) {
        blocked[r]![c] = true;
        grid[r]![c] = null;
        occupied[r]![c] = false;
      }
    }
  }

  if (!isConnected(blocked)) {
    return null;
  }
  let slots = extractSlots(blocked);
  if (slots.length < 3) {
    return null;
  }

  const wordSet = new Set<string>();
  for (const list of index.wordsByLength.values()) {
    for (const w of list) wordSet.add(w);
  }

  // Destroy slots that are not dictionary words (incidental alignments).
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    slots = extractSlots(blocked);
    for (const slot of slots) {
      let word = '';
      let complete = true;
      for (let i = 0; i < slot.length; i++) {
        const r = slot.dir === 'across' ? slot.row : slot.row + i;
        const c = slot.dir === 'across' ? slot.col + i : slot.col;
        const ch = grid[r]![c];
        if (!ch) {
          complete = false;
          break;
        }
        word += ch;
      }
      if (complete && wordSet.has(word)) continue;
      // Black this slot out
      for (let i = 0; i < slot.length; i++) {
        const r = slot.dir === 'across' ? slot.row : slot.row + i;
        const c = slot.dir === 'across' ? slot.col + i : slot.col;
        blocked[r]![c] = true;
        grid[r]![c] = null;
        occupied[r]![c] = false;
      }
      changed = true;
    }
    if (!changed) break;
    // Re-clear orphans after destroying bad slots
    markSlots();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!blocked[r]![c] && !partOfLongSlot[r]![c]) {
          blocked[r]![c] = true;
          grid[r]![c] = null;
          occupied[r]![c] = false;
        }
      }
    }
  }

  if (!isConnected(blocked)) {
    return null;
  }
  slots = extractSlots(blocked);
  if (slots.length < 3) {
    return null;
  }

  const letterGrid: (string | null)[][] = grid.map((row) => row.slice());
  let allValid = true;
  for (const slot of slots) {
    let word = '';
    for (let i = 0; i < slot.length; i++) {
      const r = slot.dir === 'across' ? slot.row : slot.row + i;
      const c = slot.dir === 'across' ? slot.col + i : slot.col;
      const ch = letterGrid[r]![c];
      if (!ch) {
        allValid = false;
        break;
      }
      word += ch;
    }
    if (!allValid || !wordSet.has(word)) {
      allValid = false;
      break;
    }
  }

  if (!allValid) {
    return null;
  }

  const white = playableCells(blocked).length;
  if (white < Math.min(18, rows * cols * 0.22)) {
    return null;
  }

  return { blocked, letters: letterGrid };
}

function generateBlockedPattern(
  rows: number,
  cols: number,
  seed: number,
  attempt: number
): boolean[][] {
  const rand = mulberry32((seed ^ (attempt * 2654435761)) >>> 0);
  const blocked = makeEmptyBlocked(rows, cols);
  const preferredRuns = [5, 4, 6, 3, 5, 4];

  for (let r = 0; r < Math.ceil(rows / 2); r++) {
    const runLens: number[] = [];
    let remaining = cols;
    let ri = (r + attempt) % preferredRuns.length;
    while (remaining > 0) {
      let run = preferredRuns[ri % preferredRuns.length]!;
      ri += 1;
      if (run >= remaining) {
        if (remaining >= 3) runLens.push(remaining);
        else if (runLens.length) runLens[runLens.length - 1]! += remaining;
        else runLens.push(remaining);
        break;
      }
      if (remaining - run - 1 < 3) {
        runLens.push(remaining);
        break;
      }
      runLens.push(run);
      remaining -= run + 1;
    }
    let c = 0;
    for (let i = 0; i < runLens.length; i++) {
      c += runLens[i]!;
      if (i < runLens.length - 1 && c < cols) {
        blocked[r]![c] = true;
        c += 1;
      }
    }
  }
  applySymmetry(blocked);

  const extras = 1 + (attempt % 3);
  let placed = 0;
  let guard = 0;
  while (placed < extras && guard < rows * cols * 6) {
    guard += 1;
    const r = Math.floor(rand() * Math.ceil(rows / 2));
    const c = 1 + Math.floor(rand() * Math.max(1, cols - 2));
    if (blocked[r]![c]) continue;
    const trial = cloneBlocked(blocked);
    trial[r]![c] = true;
    applySymmetry(trial);
    enforceMinRunLength(trial, 3);
    applySymmetry(trial);
    enforceMinRunLength(trial, 3);
    if (!patternLooksViable(trial)) continue;
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) blocked[rr]![cc] = trial[rr]![cc]!;
    }
    placed += 1;
  }

  enforceMinRunLength(blocked, 3);
  applySymmetry(blocked);
  enforceMinRunLength(blocked, 3);

  if (!patternLooksViable(blocked)) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) blocked[r]![c] = false;
    if (cols >= 7) {
      const mid = Math.floor(cols / 2);
      for (let r = 0; r < Math.ceil(rows / 2); r++) {
        if ((r + attempt) % 2 === 1) blocked[r]![mid] = true;
      }
    }
    applySymmetry(blocked);
    enforceMinRunLength(blocked, 3);
    applySymmetry(blocked);
    enforceMinRunLength(blocked, 3);
  }

  return blocked;
}

function countBlocked(blocked: boolean[][]): number {
  let n = 0;
  for (const row of blocked) for (const b of row) if (b) n += 1;
  return n;
}

function enforceMinRunLength(blocked: boolean[][], minLen: number): void {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  // Horizontal
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      while (c < cols && blocked[r]![c]) c += 1;
      const start = c;
      while (c < cols && !blocked[r]![c]) c += 1;
      const len = c - start;
      if (len > 0 && len < minLen) {
        for (let i = start; i < c; i++) blocked[r]![i] = true;
      }
    }
  }
  // Vertical
  for (let c = 0; c < cols; c++) {
    let r = 0;
    while (r < rows) {
      while (r < rows && blocked[r]![c]) r += 1;
      const start = r;
      while (r < rows && !blocked[r]![c]) r += 1;
      const len = r - start;
      if (len > 0 && len < minLen) {
        for (let i = start; i < r; i++) blocked[i]![c] = true;
      }
    }
  }
}

function extractSlots(blocked: boolean[][]): Slot[] {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const slots: Slot[] = [];
  let id = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blocked[r]![c]) continue;
      const startAcross = c === 0 || blocked[r]![c - 1];
      if (startAcross) {
        let len = 0;
        while (c + len < cols && !blocked[r]![c + len]) len += 1;
        if (len >= 3) slots.push({ id: id++, row: r, col: c, dir: 'across', length: len });
      }
      const startDown = r === 0 || blocked[r - 1]![c];
      if (startDown) {
        let len = 0;
        while (r + len < rows && !blocked[r + len]![c]) len += 1;
        if (len >= 3) slots.push({ id: id++, row: r, col: c, dir: 'down', length: len });
      }
    }
  }
  return slots;
}

function playableCells(blocked: boolean[][]): Array<{ r: number; c: number }> {
  const out: Array<{ r: number; c: number }> = [];
  for (let r = 0; r < blocked.length; r++) {
    for (let c = 0; c < (blocked[r]?.length ?? 0); c++) {
      if (!blocked[r]![c]) out.push({ r, c });
    }
  }
  return out;
}

function isConnected(blocked: boolean[][]): boolean {
  const cells = playableCells(blocked);
  if (cells.length === 0) return false;
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const seen = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;
  const stack = [cells[0]!];
  seen.add(key(cells[0]!.r, cells[0]!.c));
  while (stack.length) {
    const { r, c } = stack.pop()!;
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
      if (blocked[nr]![nc]) continue;
      const k = key(nr, nc);
      if (seen.has(k)) continue;
      seen.add(k);
      stack.push({ r: nr, c: nc });
    }
  }
  return seen.size === cells.length;
}

function patternOfSlot(
  grid: (string | null)[][],
  slot: Slot
): string {
  let p = '';
  for (let i = 0; i < slot.length; i++) {
    const r = slot.dir === 'across' ? slot.row : slot.row + i;
    const c = slot.dir === 'across' ? slot.col + i : slot.col;
    const ch = grid[r]![c];
    p += ch ?? '?';
  }
  return p;
}

function placeWord(
  grid: (string | null)[][],
  slot: Slot,
  word: string
): Array<{ r: number; c: number; prev: string | null }> {
  const undo: Array<{ r: number; c: number; prev: string | null }> = [];
  for (let i = 0; i < slot.length; i++) {
    const r = slot.dir === 'across' ? slot.row : slot.row + i;
    const c = slot.dir === 'across' ? slot.col + i : slot.col;
    undo.push({ r, c, prev: grid[r]![c] });
    grid[r]![c] = word[i]!;
  }
  return undo;
}

function revert(
  grid: (string | null)[][],
  undo: Array<{ r: number; c: number; prev: string | null }>
): void {
  for (const u of undo) grid[u.r]![u.c] = u.prev;
}

function fillGrid(
  blocked: boolean[][],
  slots: Slot[],
  index: PatternIndex,
  rand: () => number,
  deadline: number,
  signal?: { cancelled?: boolean }
): (string | null)[][] | null {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const grid: (string | null)[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (blocked[r]![c] ? '#' : null))
  );

  const usedWords = new Set<string>();
  const filled = new Array(slots.length).fill(false);

  const candidatesFor = (slot: Slot): string[] => {
    const pattern = patternOfSlot(grid, slot);
    return wordsMatchingPattern(index, pattern).filter((w) => !usedWords.has(w));
  };

  const forwardOk = (justFilledIdx: number): boolean => {
    for (let i = 0; i < slots.length; i++) {
      if (filled[i] || i === justFilledIdx) continue;
      if (candidatesFor(slots[i]!).length === 0) return false;
    }
    return true;
  };

  const pickSlot = (): number => {
    let best = -1;
    let bestCount = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (filled[i]) continue;
      const count = candidatesFor(slots[i]!).length;
      if (count < bestCount) {
        bestCount = count;
        best = i;
        if (bestCount === 0) return i;
      }
    }
    return best;
  };

  let steps = 0;
  const search = (): boolean => {
    if (signal?.cancelled) return false;
    if (Date.now() > deadline) return false;
    steps += 1;
    if (steps > 400000) return false;

    const idx = pickSlot();
    if (idx < 0) return true;

    const slot = slots[idx]!;
    const cands = candidatesFor(slot);
    if (cands.length === 0) return false;
    shuffleInPlace(cands, rand);
    const limit = Math.min(cands.length, cands.length <= 80 ? cands.length : 60);
    for (let i = 0; i < limit; i++) {
      const word = cands[i]!;
      const undo = placeWord(grid, slot, word);
      usedWords.add(word);
      filled[idx] = true;
      if (forwardOk(idx) && search()) return true;
      filled[idx] = false;
      usedWords.delete(word);
      revert(grid, undo);
    }
    return false;
  };

  const ok = search();
  if (!ok) return null;
  return grid.map((row, r) => row.map((ch, c) => (blocked[r]![c] ? null : ch)));
}

function selectHintLetters(
  usedLetters: string[],
  count: number,
  seed: number
): string[] {
  // Only clue letters that actually appear on the puzzle grid (plain A–Z base forms).
  const letters = usedLetters.filter((l) => /^[A-Z]$/.test(l));
  const rand = mulberry32(seed ^ 0x9e3779b9);
  shuffleInPlace(letters, rand);
  const isVowel = (letter: string) => 'AEIOU'.includes(letter);
  const vowels = letters.filter(isVowel);
  const consonants = letters.filter((l) => !isVowel(l));
  const ordered = [...vowels.slice(0, 2), ...consonants, ...vowels.slice(2)];
  const unique = [...new Set(ordered)];
  return unique.slice(0, Math.max(0, Math.min(count, unique.length)));
}

function buildPuzzleFromSolution(args: {
  solutionLetters: (string | null)[][];
  blocked: boolean[][];
  letterToNumber: Record<string, number>;
  numberToLetter: Record<number, string>;
  hintLetters: string[];
  hintMode: CodewordHintMode;
  language?: string | null;
}): { solutionGrid: CodewordSolutionCell[][]; puzzleGrid: CodewordPuzzleCell[][] } {
  const { solutionLetters, blocked, letterToNumber, hintLetters, hintMode, language } = args;
  const hintSet = new Set(hintLetters.map((h) => baseCodeLetter(h, language)).filter(Boolean));
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  const solutionGrid: CodewordSolutionCell[][] = [];
  const puzzleGrid: CodewordPuzzleCell[][] = [];
  const singlePlaced = new Set<string>();

  for (let r = 0; r < rows; r++) {
    const solRow: CodewordSolutionCell[] = [];
    const puzRow: CodewordPuzzleCell[] = [];
    for (let c = 0; c < cols; c++) {
      if (blocked[r]![c]) {
        solRow.push({ blocked: true, letter: null });
        puzRow.push({ blocked: true, code: null, letter: null, isHint: false });
        continue;
      }
      const letter = solutionLetters[r]![c]!;
      solRow.push({ blocked: false, letter });
      const base = baseCodeLetter(letter, language);
      const code = codeForLetter(letterToNumber, letter, language);
      let showLetter: string | null = null;
      let isHint = false;
      if (hintSet.has(base)) {
        if (hintMode === 'all-occurrences') {
          // Show the real accented form on the grid; key box still shows base E/A/…
          showLetter = letter;
          isHint = true;
        } else if (!singlePlaced.has(base)) {
          showLetter = letter;
          isHint = true;
          singlePlaced.add(base);
        }
      }
      puzRow.push({ blocked: false, code, letter: showLetter, isHint });
    }
    solutionGrid.push(solRow);
    puzzleGrid.push(puzRow);
  }
  return { solutionGrid, puzzleGrid };
}

export function validateCodewordPuzzle(
  puzzle: CodewordPuzzle,
  dictionary?: CodewordDictionary
): { ok: true } | { ok: false; reason: string } {
  const { rows, cols, solutionGrid, puzzleGrid, letterToNumber, numberToLetter, hintLetters } =
    puzzle;
  const language = puzzle.metadata?.language;
  if (solutionGrid.length !== rows || puzzleGrid.length !== rows) {
    return { ok: false, reason: 'Grid row count mismatch' };
  }

  const usedNumbers = new Set<number>();
  const usedLetters = new Set<string>();
  for (const [letter, num] of Object.entries(letterToNumber)) {
    if (numberToLetter[num] !== letter) {
      return { ok: false, reason: `Mapping inverse mismatch for ${letter}` };
    }
    if (usedNumbers.has(num)) return { ok: false, reason: `Duplicate number ${num}` };
    if (usedLetters.has(letter)) return { ok: false, reason: `Duplicate letter ${letter}` };
    usedNumbers.add(num);
    usedLetters.add(letter);
  }

  const hintSet = new Set(hintLetters.map((h) => baseCodeLetter(h, language)).filter(Boolean));

  const blocked: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    blocked[r] = [];
    if ((solutionGrid[r]?.length ?? 0) !== cols || (puzzleGrid[r]?.length ?? 0) !== cols) {
      return { ok: false, reason: 'Grid column count mismatch' };
    }
    for (let c = 0; c < cols; c++) {
      const sol = solutionGrid[r]![c]!;
      const puz = puzzleGrid[r]![c]!;
      blocked[r]![c] = sol.blocked;
      if (sol.blocked !== puz.blocked) {
        return { ok: false, reason: `Blocked mismatch at ${r},${c}` };
      }
      if (sol.blocked) {
        if (sol.letter || puz.code || puz.letter) {
          return { ok: false, reason: `Blocked cell not empty at ${r},${c}` };
        }
        continue;
      }
      if (!sol.letter || !isLetterGrapheme(sol.letter)) {
        return { ok: false, reason: `Missing solution letter at ${r},${c}` };
      }
      const expectedNum = codeForLetter(letterToNumber, sol.letter, language);
      if (expectedNum == null || puz.code !== expectedNum) {
        return { ok: false, reason: `Code mismatch at ${r},${c}` };
      }
      if (puz.letter && puz.letter !== sol.letter) {
        return { ok: false, reason: `Hint letter mismatch at ${r},${c}` };
      }
      const solBase = baseCodeLetter(sol.letter, language);
      if (puz.isHint && !hintSet.has(solBase)) {
        return { ok: false, reason: `Hint flag without hint letter at ${r},${c}` };
      }
    }
  }

  if (!isConnected(blocked)) {
    return { ok: false, reason: 'Playable cells are disconnected' };
  }

  const slots = extractSlots(blocked);
  if (slots.length === 0) return { ok: false, reason: 'No word slots' };

  const dict = dictionary ?? getCodewordDictionary(puzzle.metadata.language || 'en');
  const wordSet = new Set(dict.words);
  for (const slot of slots) {
    let word = '';
    for (let i = 0; i < slot.length; i++) {
      const r = slot.dir === 'across' ? slot.row : slot.row + i;
      const c = slot.dir === 'across' ? slot.col + i : slot.col;
      const ch = solutionGrid[r]![c]!.letter;
      if (!ch) return { ok: false, reason: `Empty slot cell at ${r},${c}` };
      word += ch;
    }
    if (slot.length < 3) return { ok: false, reason: `Slot shorter than 3: ${word}` };
    if (!wordSet.has(word)) {
      return { ok: false, reason: `Non-dictionary word: ${word}` };
    }
  }

  for (const h of hintLetters) {
    const base = baseCodeLetter(h, language);
    if (!base || letterToNumber[base] == null) {
      return { ok: false, reason: `Unknown hint letter ${h}` };
    }
  }

  for (const entry of puzzle.alphabetEntries) {
    const mapped = numberToLetter[entry.number];
    if (!mapped) return { ok: false, reason: `Key entry missing number ${entry.number}` };
    if (entry.revealed && entry.letter !== mapped) {
      return { ok: false, reason: `Key entry letter mismatch for ${entry.number}` };
    }
    if (!entry.revealed && entry.letter != null) {
      return { ok: false, reason: `Unrevealed key entry has letter for ${entry.number}` };
    }
  }

  return { ok: true };
}

export function generateCodewordPuzzle(options: CodewordGenerateOptions): CodewordPuzzle {
  const language = options.language || 'en';
  const dict = options.dictionary ?? getCodewordDictionary(language);
  const alphabet = options.alphabet ?? dict.alphabet;
  const rows = Math.max(5, Math.min(25, Math.round(options.rows)));
  const cols = Math.max(5, Math.min(25, Math.round(options.cols)));
  const difficulty = options.difficulty ?? 'medium';
  const hintMode = options.hintMode ?? 'all-occurrences';
  const hintCount =
    options.hintCount != null
      ? Math.max(0, Math.min(alphabet.length, Math.round(options.hintCount)))
      : defaultHintCountForDifficulty(difficulty);
  const seed = (options.seed ?? Date.now()) >>> 0;
  const timeBudgetMs = options.timeBudgetMs ?? 4000;
  const deadline = Date.now() + timeBudgetMs;
  const index = buildPatternIndex(dict);
  const rand = mulberry32(seed);

  if (options.signal?.cancelled) {
    throw new Error('Codewords generation cancelled.');
  }

  let lastReason = 'unknown';
  const maxAttempts = 24;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.cancelled) {
      throw new Error('Codewords generation cancelled.');
    }
    if (Date.now() > deadline) break;

    let blocked: boolean[][] | null = null;
    let filled: (string | null)[][] | null = null;

    // Prefer constructive intersecting placement (more reliable).
    if (attempt % 2 === 0) {
      const built = constructiveFill(
        rows,
        cols,
        index,
        mulberry32((seed + attempt * 97) >>> 0),
        Math.min(deadline, Date.now() + 2000),
        options.signal
      );
      if (built) {
        blocked = built.blocked;
        filled = built.letters;
      } else {
        lastReason = 'constructive fill failed';
      }
    }

    if (!blocked || !filled) {
      blocked = generateBlockedPattern(rows, cols, seed, attempt);
      if (!isConnected(blocked)) {
        lastReason = 'disconnected pattern';
        continue;
      }
      const white = playableCells(blocked).length;
      if (white < rows * cols * 0.4) {
        lastReason = 'too many blocked cells';
        continue;
      }
      const slots = extractSlots(blocked);
      if (slots.length < 4) {
        lastReason = 'too few slots';
        continue;
      }
      let lengthsOk = true;
      for (const slot of slots) {
        if ((index.wordsByLength.get(slot.length) ?? []).length === 0) {
          lengthsOk = false;
          break;
        }
      }
      if (!lengthsOk) {
        lastReason = 'missing dictionary lengths';
        continue;
      }
      const attemptDeadline = Math.min(deadline, Date.now() + 1500);
      filled = fillGrid(
        blocked,
        slots,
        index,
        mulberry32((seed + attempt * 13) >>> 0),
        attemptDeadline,
        options.signal
      );
      if (!filled) {
        lastReason = 'fill failed';
        continue;
      }
    }

    const { letterToNumber, numberToLetter } = createLetterNumberMapping(alphabet, seed + attempt * 17);
    const used = usedBaseLetters(filled, blocked, dict.language);
    const hintLetters = selectHintLetters(used, hintCount, seed + attempt);
    const { solutionGrid, puzzleGrid } = buildPuzzleFromSolution({
      solutionLetters: filled,
      blocked,
      letterToNumber,
      numberToLetter,
      hintLetters,
      hintMode,
      language: dict.language,
    });

    const entries: CodewordAlphabetEntry[] = Object.keys(numberToLetter)
      .map(Number)
      .sort((a, b) => a - b)
      .map((number) => {
        const letter = numberToLetter[number]!;
        const revealed = hintLetters.includes(letter);
        return { number, letter: revealed ? letter : null, revealed };
      });

    const puzzle: CodewordPuzzle = {
      type: 'codewords',
      id: `codewords-${seed}-${attempt}`,
      rows,
      cols,
      size: Math.max(rows, cols),
      solutionGrid,
      puzzleGrid,
      letterToNumber,
      numberToLetter,
      hintLetters,
      hintMode,
      alphabetEntries: entries,
      difficulty,
      metadata: {
        seed,
        language: dict.language,
        createdAt: new Date().toISOString(),
      },
      puzzleNumber: 1,
    };

    const check = validateCodewordPuzzle(puzzle, dict);
    if (!check.ok) {
      lastReason = check.reason;
      continue;
    }
    return puzzle;
  }

  throw new Error(
    `Unable to generate a valid ${rows}×${cols} Codewords grid with the current dictionary (${lastReason}).`
  );
}

/** Async wrapper that yields between attempts so the UI stays responsive. */
export async function generateCodewordPuzzleAsync(
  options: CodewordGenerateOptions
): Promise<CodewordPuzzle> {
  const language = options.language || 'en';
  const dict = options.dictionary ?? getCodewordDictionary(language);
  const alphabet = options.alphabet ?? dict.alphabet;
  const rows = Math.max(5, Math.min(25, Math.round(options.rows)));
  const cols = Math.max(5, Math.min(25, Math.round(options.cols)));
  const difficulty = options.difficulty ?? 'medium';
  const hintMode = options.hintMode ?? 'all-occurrences';
  const hintCount =
    options.hintCount != null
      ? Math.max(0, Math.min(alphabet.length, Math.round(options.hintCount)))
      : defaultHintCountForDifficulty(difficulty);
  const seed = (options.seed ?? Date.now()) >>> 0;
  const timeBudgetMs = options.timeBudgetMs ?? 12000;
  const deadline = Date.now() + timeBudgetMs;
  const index = buildPatternIndex(dict);
  let lastReason = 'unknown';
  const maxAttempts = 30;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (options.signal?.cancelled) {
      throw new Error('Codewords generation cancelled.');
    }
    await new Promise<void>((r) => setTimeout(r, 0));
    if (Date.now() > deadline) break;

    let blocked: boolean[][] | null = null;
    let filled: (string | null)[][] | null = null;

    const built = constructiveFill(
      rows,
      cols,
      index,
      mulberry32((seed + attempt * 97) >>> 0),
      Math.min(deadline, Date.now() + 2500),
      options.signal
    );
    if (built) {
      blocked = built.blocked;
      filled = built.letters;
    } else {
      lastReason = 'constructive fill failed';
      blocked = generateBlockedPattern(rows, cols, seed, attempt);
      if (!isConnected(blocked)) {
        lastReason = 'disconnected pattern';
        continue;
      }
      const white = playableCells(blocked).length;
      if (white < rows * cols * 0.4) {
        lastReason = 'too many blocked cells';
        continue;
      }
      const slots = extractSlots(blocked);
      if (slots.length < 4) {
        lastReason = 'too few slots';
        continue;
      }
      filled = fillGrid(
        blocked,
        slots,
        index,
        mulberry32((seed + attempt * 13) >>> 0),
        Math.min(deadline, Date.now() + 1500),
        options.signal
      );
      if (!filled) {
        lastReason = 'fill failed';
        continue;
      }
    }

    const { letterToNumber, numberToLetter } = createLetterNumberMapping(
      alphabet,
      seed + attempt * 17
    );
    const used = usedBaseLetters(filled!, blocked!, dict.language);
    const hintLetters = selectHintLetters(used, hintCount, seed + attempt);
    const { solutionGrid, puzzleGrid } = buildPuzzleFromSolution({
      solutionLetters: filled!,
      blocked: blocked!,
      letterToNumber,
      numberToLetter,
      hintLetters,
      hintMode,
      language: dict.language,
    });

    const entries: CodewordAlphabetEntry[] = Object.keys(numberToLetter)
      .map(Number)
      .sort((a, b) => a - b)
      .map((number) => {
        const letter = numberToLetter[number]!;
        const revealed = hintLetters.includes(letter);
        return { number, letter: revealed ? letter : null, revealed };
      });

    const puzzle: CodewordPuzzle = {
      type: 'codewords',
      id: `codewords-${seed}-${attempt}`,
      rows,
      cols,
      size: Math.max(rows, cols),
      solutionGrid,
      puzzleGrid,
      letterToNumber,
      numberToLetter,
      hintLetters,
      hintMode,
      alphabetEntries: entries,
      difficulty,
      metadata: {
        seed,
        language: dict.language,
        createdAt: new Date().toISOString(),
      },
      puzzleNumber: 1,
    };

    const check = validateCodewordPuzzle(puzzle, dict);
    if (!check.ok) {
      lastReason = check.reason;
      continue;
    }
    return puzzle;
  }

  throw new Error(
    `Unable to generate a valid ${rows}×${cols} Codewords grid with the current dictionary (${lastReason}).`
  );
}
