/**
 * Shared Codewords layout elements (canvas / PDF / PPTX).
 * Alphabet key is always a fixed 2×13 (26) box: number top-left, letter centered (puzzle pages only).
 * Grid and key share the same number/letter font settings.
 */

import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import { fitUniformGrid } from '../generic-puzzle-geometry';
import type { CodewordPuzzle } from '../puzzles/codewords';
import {
  localeLowerCase,
  localeUpperCase,
  resolveUnicodeFontFamily,
  textNeedsExtendedLatin,
} from '../unicode-text';
import type { ResolvedElement } from './types';

function applyCase(
  letter: string,
  letterCase: 'upper' | 'lower',
  language?: string
): string {
  return letterCase === 'lower'
    ? localeLowerCase(letter, language)
    : localeUpperCase(letter, language);
}

/** Honor the user size; only shrink when it cannot fit the cell. */
function fitFontSize(requested: number, maxPt: number, minPt: number): number {
  const req = Number.isFinite(requested) ? requested : minPt;
  return Math.max(minPt, Math.min(req, maxPt));
}

export type CodewordsBox = { x: number; y: number; w: number; h: number };

export type CodewordsFontHit = {
  target: 'code-numbers' | 'code-letters';
  scope: 'grid' | 'key';
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CodewordsElementParts = {
  widthPt: number;
  heightPt: number;
  gridBox: CodewordsBox;
  keyBox: CodewordsBox | null;
  grid: ResolvedElement[];
  gridNumbers: ResolvedElement[];
  gridLetters: ResolvedElement[];
  key: ResolvedElement[];
  keyNumbers: ResolvedElement[];
  keyLetters: ResolvedElement[];
  /** Non-overlapping hit regions (numbers = top-left; letters = remaining cell). */
  fontHits: CodewordsFontHit[];
};

type CodeFont = { family: string; size: number; bold: boolean; italic: boolean };

function numberFontOf(gp: GenericPuzzleSettings): CodeFont {
  return {
    family:
      gp.typography.codewordsNumberFontFamily ||
      gp.typography.puzzleFontFamily ||
      'Arial',
    size: gp.typography.codewordsNumberFontSize ?? Math.max(8, (gp.typography.puzzleFontSize ?? 14) * 0.55),
    bold: gp.typography.codewordsNumberBold === true,
    italic: gp.typography.codewordsNumberItalic === true,
  };
}

function letterFontOf(gp: GenericPuzzleSettings, showSolution: boolean): CodeFont {
  return {
    family:
      gp.typography.codewordsLetterFontFamily ||
      (showSolution
        ? gp.typography.answerFontFamily || gp.typography.puzzleFontFamily
        : gp.typography.puzzleFontFamily) ||
      'Arial',
    size:
      gp.typography.codewordsLetterFontSize ??
      (showSolution ? gp.typography.answerFontSize ?? 16 : gp.typography.puzzleFontSize ?? 14),
    bold: gp.typography.codewordsLetterBold !== false,
    italic: gp.typography.codewordsLetterItalic === true,
  };
}

/** Split a cell into number (top-left) and letter (remaining) hit boxes — no overlap. */
function pushCellFontHits(
  hits: CodewordsFontHit[],
  scope: 'grid' | 'key',
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  includeNumbers: boolean
) {
  const numW = cellW * 0.48;
  const numH = cellH * 0.38;
  if (includeNumbers) {
    hits.push({ target: 'code-numbers', scope, x, y, w: numW, h: numH });
    // Letter = L-shaped remainder as two rects (right of number + below number band).
    hits.push({
      target: 'code-letters',
      scope,
      x: x + numW,
      y,
      w: cellW - numW,
      h: numH,
    });
    hits.push({
      target: 'code-letters',
      scope,
      x,
      y: y + numH,
      w: cellW,
      h: cellH - numH,
    });
  } else {
    hits.push({ target: 'code-letters', scope, x, y, w: cellW, h: cellH });
  }
}

export function buildCodewordsElementParts(args: {
  puzzle: CodewordPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): CodewordsElementParts {
  const { puzzle, slot, gp, showSolution, preferredCellPt } = args;
  const rows = puzzle.rows;
  const cols = puzzle.cols;
  const language = puzzle.metadata?.language || 'en';
  const letterCase = gp.core.letterCase === 'lower' ? 'lower' : 'upper';
  const showKey = !showSolution && gp.core.showCodewordsCodeBox !== false;
  const blockedColor = gp.core.codewordsBlockedCellColor || '#888888';
  const playableColor = gp.core.codewordsPlayableCellColor || '#FFFFFF';
  const lineColor = gp.core.codewordsGridLineColor || gp.colors.gridColor || '#000000';
  const strokeW = Math.max(0.5, gp.core.codewordsGridStrokeWidth ?? 1);
  const numberColor = gp.core.codewordsNumberColor || '#000000';
  const letterColor = gp.core.codewordsLetterColor || '#000000';
  const numFont = numberFontOf(gp);
  const letFont = letterFontOf(gp, showSolution);
  const sampleLetters = Object.values(puzzle.numberToLetter).filter(Boolean).join('');
  if (textNeedsExtendedLatin(sampleLetters)) {
    letFont.family = resolveUnicodeFontFamily(letFont.family, sampleLetters);
  }

  const alphabetCount = 26;
  const keyCols = 13;
  const keyRows = 2;
  const keyGap = showKey ? 12 : 0;
  const keyCellMin = Math.max(16, letFont.size * 1.45);
  const keyBlockH = showKey ? keyRows * keyCellMin : 0;

  const gridSlot: RectPt = {
    ...slot,
    heightPt: Math.max(40, slot.heightPt - (showKey ? keyBlockH + keyGap : 0)),
  };
  const grid = fitUniformGrid(cols, rows, preferredCellPt, gridSlot);

  const gridEls: ResolvedElement[] = [];
  const gridNumbers: ResolvedElement[] = [];
  const gridLetters: ResolvedElement[] = [];
  const fontHits: CodewordsFontHit[] = [];

  gridEls.push({
    kind: 'rect',
    x: grid.leftPt,
    y: grid.topPt,
    w: grid.widthPt,
    h: grid.heightPt,
    fill: playableColor,
    stroke: lineColor,
    strokeWidth: strokeW * 1.5,
  });

  // Same requested fonts as the alphabet box — only shrink to fit the cell.
  const numberPt = fitFontSize(numFont.size, grid.cellPt * 0.5, 4);
  const letterPt = fitFontSize(letFont.size, grid.cellPt * (showSolution ? 0.72 : 0.62), 5);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sol = puzzle.solutionGrid[r]![c]!;
      const puz = puzzle.puzzleGrid[r]![c]!;
      const x = grid.leftPt + c * grid.cellPt;
      const y = grid.topPt + r * grid.cellPt;

      if (sol.blocked) {
        gridEls.push({
          kind: 'rect',
          x,
          y,
          w: grid.cellPt,
          h: grid.cellPt,
          fill: blockedColor,
          stroke: lineColor,
          strokeWidth: strokeW,
        });
        continue;
      }

      gridEls.push({
        kind: 'rect',
        x,
        y,
        w: grid.cellPt,
        h: grid.cellPt,
        fill: playableColor,
        stroke: lineColor,
        strokeWidth: strokeW,
      });

      const code = puz.code;
      const showLetter = showSolution ? sol.letter : puz.letter;

      pushCellFontHits(fontHits, 'grid', x, y, grid.cellPt, grid.cellPt, !showSolution);

      if (!showSolution && code != null) {
        gridNumbers.push({
          kind: 'text',
          x: x + 1.2,
          y: y + 0.8,
          w: grid.cellPt * 0.55,
          h: numberPt * 1.25,
          text: String(code),
          lines: [String(code)],
          fontFamily: numFont.family,
          fontSize: numberPt,
          color: numberColor,
          align: 'left',
          valign: 'top',
          lineHeight: numberPt,
          bold: numFont.bold,
          italic: numFont.italic,
        });
      }

      if (showLetter) {
        const display = applyCase(showLetter, letterCase, language);
        gridLetters.push({
          kind: 'text',
          x,
          y: y + grid.cellPt * 0.18,
          w: grid.cellPt,
          h: grid.cellPt * 0.72,
          text: display,
          lines: [display],
          fontFamily: letFont.family,
          fontSize: letterPt,
          color: letterColor,
          align: 'center',
          valign: 'middle',
          lineHeight: letterPt,
          bold: letFont.bold,
          italic: letFont.italic,
        });
      }
    }
  }

  const keyEls: ResolvedElement[] = [];
  const keyNumbers: ResolvedElement[] = [];
  const keyLetters: ResolvedElement[] = [];
  let keyBox: CodewordsBox | null = null;

  if (showKey) {
    const byNumber = new Map(
      puzzle.alphabetEntries.map((entry) => [entry.number, entry] as const)
    );
    const entries = Array.from({ length: alphabetCount }, (_, i) => {
      const number = i + 1;
      const existing = byNumber.get(number);
      return (
        existing ?? {
          number,
          letter: puzzle.numberToLetter[number] ?? null,
          revealed: false,
        }
      );
    });
    const keyWidth = grid.widthPt;
    const cellW = keyWidth / keyCols;
    const cellH = Math.max(keyCellMin, keyBlockH / keyRows);
    const keyTop = grid.topPt + grid.heightPt + keyGap;
    const keyHeight = keyRows * cellH;
    keyBox = { x: grid.leftPt, y: keyTop, w: keyWidth, h: keyHeight };

    const keyNumPt = fitFontSize(numFont.size, Math.min(cellW, cellH) * 0.5, 5);
    const keyLetPt = fitFontSize(letFont.size, cellH * 0.58, 6);

    for (let i = 0; i < alphabetCount; i++) {
      const entry = entries[i]!;
      const row = Math.floor(i / keyCols);
      const col = i % keyCols;
      const x = grid.leftPt + col * cellW;
      const y = keyTop + row * cellH;

      keyEls.push({
        kind: 'rect',
        x,
        y,
        w: cellW,
        h: cellH,
        fill: playableColor,
        stroke: lineColor,
        strokeWidth: strokeW,
      });

      pushCellFontHits(fontHits, 'key', x, y, cellW, cellH, true);

      keyNumbers.push({
        kind: 'text',
        x: x + 1.2,
        y: y + 0.8,
        w: cellW * 0.55,
        h: keyNumPt * 1.2,
        text: String(entry.number),
        lines: [String(entry.number)],
        fontFamily: numFont.family,
        fontSize: keyNumPt,
        color: numberColor,
        align: 'left',
        valign: 'top',
        lineHeight: keyNumPt,
        bold: numFont.bold,
        italic: numFont.italic,
      });

      const revealed = entry.revealed
        ? entry.letter || puzzle.numberToLetter[entry.number] || null
        : entry.letter;
      if (revealed) {
        const display = applyCase(revealed, letterCase, language);
        keyLetters.push({
          kind: 'text',
          x,
          y: y + cellH * 0.2,
          w: cellW,
          h: cellH * 0.7,
          text: display,
          lines: [display],
          fontFamily: letFont.family,
          fontSize: keyLetPt,
          color: letterColor,
          align: 'center',
          valign: 'middle',
          lineHeight: keyLetPt,
          bold: letFont.bold,
          italic: letFont.italic,
        });
      }
    }
  }

  const bottom = keyBox ? keyBox.y + keyBox.h : grid.topPt + grid.heightPt;
  return {
    widthPt: slot.widthPt,
    heightPt: Math.max(slot.heightPt, bottom - slot.topPt),
    gridBox: {
      x: grid.leftPt,
      y: grid.topPt,
      w: grid.widthPt,
      h: grid.heightPt,
    },
    keyBox,
    grid: gridEls,
    gridNumbers,
    gridLetters,
    key: keyEls,
    keyNumbers,
    keyLetters,
    fontHits,
  };
}

export function buildCodewordsElements(args: {
  puzzle: CodewordPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  const parts = buildCodewordsElementParts(args);
  return [
    ...parts.grid,
    ...parts.gridNumbers,
    ...parts.gridLetters,
    ...parts.key,
    ...parts.keyNumbers,
    ...parts.keyLetters,
  ];
}
