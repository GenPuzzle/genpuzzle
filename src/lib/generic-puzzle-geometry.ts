/**
 * Shared geometry for generic/crossword native PDF + PPT drawing.
 * Coordinates are top-origin points unless noted.
 */

import { SUDOKU_BOX, formatSudokuSymbol, isSudokuSize } from './puzzles/sudoku';
import { solveMazePath } from './puzzles/maze';
import type { CrosswordPuzzle, MazePuzzle, MazeSolutionPathStyle, Position, SudokuPuzzle } from './puzzles/types';
import { greyscaleToCss, INTERIOR_LIGHT_GREY_FILL } from './crossword-settings';
import { findInteriorUnusedCells } from './puzzles/crossword';
import type { CrosswordSettings } from './crossword-settings';
import { cssPxToPoints } from './puzzle-layout';

import { fitScale, type RectPt } from './generic-puzzle-page-layout';

export function sudokuDigitFillRatio(fontSizePt: number): number {
  const t = Math.max(6, Math.min(56, fontSizePt));
  return 0.32 + ((t - 6) / 50) * (0.92 - 0.32);
}

export function sudokuSizeOf(puzzle: SudokuPuzzle): number {
  const n = Number(puzzle.size ?? puzzle.grid?.length ?? puzzle.solution?.length ?? 9);
  if (Number.isFinite(n) && n >= 2 && n <= 36) return Math.round(n);
  return 9;
}

export function sudokuBoxOf(size: number): { boxH: number; boxW: number } {
  if (isSudokuSize(size)) return SUDOKU_BOX[size];
  return { boxH: size, boxW: size };
}

export interface FittedGrid {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
  cellPt: number;
  cols: number;
  rows: number;
}

export function fitUniformGrid(
  cols: number,
  rows: number,
  preferredCellPt: number,
  slot: RectPt
): FittedGrid {
  const naturalW = Math.max(1, cols) * preferredCellPt;
  const naturalH = Math.max(1, rows) * preferredCellPt;
  const scale = fitScale(naturalW, naturalH, slot.widthPt, slot.heightPt);
  const cellPt = preferredCellPt * scale;
  const widthPt = cols * cellPt;
  const heightPt = rows * cellPt;
  return {
    leftPt: slot.leftPt + (slot.widthPt - widthPt) / 2,
    topPt: slot.topPt,
    widthPt,
    heightPt,
    cellPt,
    cols,
    rows,
  };
}

/** Place a grid at an exact cell size — never shrink to fit leftover page space. */
export function placeFixedUniformGrid(
  cols: number,
  rows: number,
  cellPt: number,
  slot: RectPt
): FittedGrid {
  const safeCell = Math.max(0.5, cellPt);
  const widthPt = Math.max(1, cols) * safeCell;
  const heightPt = Math.max(1, rows) * safeCell;
  return {
    leftPt: slot.leftPt + (slot.widthPt - widthPt) / 2,
    topPt: slot.topPt,
    widthPt,
    heightPt,
    cellPt: safeCell,
    cols,
    rows,
  };
}

export function emptySquareFill(squareColorRange: number): string {
  const v = Math.max(0, Math.min(255, Math.round(squareColorRange)));
  const hex = v.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

export function formatCrosswordLetter(letter: string, answerCase: CrosswordSettings['core']['answerCase']): string {
  if (answerCase === 'lower') return letter.toLowerCase();
  if (answerCase === 'original') return letter;
  return letter.toUpperCase();
}

export interface CrosswordCellGeom {
  r: number;
  c: number;
  leftPt: number;
  topPt: number;
  sizePt: number;
  isBlack: boolean;
  fill: string | null;
  letter?: string;
  clueNumber?: number;
}


export function crosswordCells(
  puzzle: CrosswordPuzzle,
  grid: FittedGrid,
  cw: CrosswordSettings,
  showSolution: boolean
): CrosswordCellGeom[] {
  const emptyFill = emptySquareFill(cw.colors.squareColorRange);
  const unusedTransparent =
    cw.colors.unusedBoxesTransparent === true ||
    (cw.colors.blackSquareGreyscale ?? 255) === 0;
  const blackFill = unusedTransparent ? null : greyscaleToCss(cw.colors.blackSquareGreyscale ?? 255);
  const interiorUnused = findInteriorUnusedCells(puzzle.grid);
  const out: CrosswordCellGeom[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = puzzle.grid[r]?.[c];
      if (!cell) continue;
      const isInterior = interiorUnused[r]?.[c] === true;
      const cellFill = cell.isBlack
        ? (unusedTransparent ? (isInterior ? INTERIOR_LIGHT_GREY_FILL : null) : blackFill)
        : emptyFill;
      out.push({
        r,
        c,
        leftPt: grid.leftPt + c * grid.cellPt,
        topPt: grid.topPt + r * grid.cellPt,
        sizePt: grid.cellPt,
        isBlack: !!cell.isBlack,
        fill: cellFill,
        letter: showSolution && cell.letter ? formatCrosswordLetter(cell.letter, cw.core.answerCase) : undefined,
        clueNumber: !showSolution && cell.clueNumber != null ? cell.clueNumber : undefined,
      });
    }
  }
  return out;
}


export function crosswordLetterFontPt(cw: CrosswordSettings, cellPt: number): number {
  const cssPx = Math.min(cw.typography.gridLetterFontSize || cellPt * 0.5 * (96 / 72), (cellPt * 96) / 72 * 0.72);
  return Math.min(cssPxToPoints(cssPx), cellPt * 0.72);
}

export function crosswordNumberFontPt(cw: CrosswordSettings, cellPt: number, showSolution: boolean): number {
  const cssPx = showSolution ? cw.typography.numberFontSizeAnswers : cw.typography.numberFontSizePuzzle;
  return Math.min(cssPxToPoints(Math.max(1, cssPx)), cellPt * 0.55);
}

export type ArrowDir = 'up' | 'down' | 'left' | 'right';

export function directionFromTo(from: Position, to: Position): ArrowDir {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (Math.abs(dr) >= Math.abs(dc)) return dr > 0 ? 'down' : 'up';
  return dc > 0 ? 'right' : 'left';
}

export function mazeStartDir(puzzle: MazePuzzle): ArrowDir {
  const path =
    puzzle.solutionPath && puzzle.solutionPath.length >= 2
      ? puzzle.solutionPath
      : solveMazePath(puzzle.grid, puzzle.start, puzzle.end);
  if (path.length >= 2) return directionFromTo(path[0], path[1]);
  return 'down';
}

export interface MazeLayout {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
  cellWPt: number;
  cellHPt: number;
  offsetXPt: number;
  offsetYPt: number;
  mazeWPt: number;
  mazeHPt: number;
  rows: number;
  cols: number;
}

export function layoutMaze(puzzle: MazePuzzle, slot: RectPt, preferredCellPt: number, framePt?: number | null): MazeLayout {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const boxW = framePt && framePt > 0 ? Math.min(framePt, slot.widthPt) : slot.widthPt;
  const boxH = framePt && framePt > 0 ? Math.min(framePt, slot.heightPt) : slot.heightPt;
  const fittedCell =
    rows > 0 && cols > 0
      ? Math.max(1.5, Math.min(boxW / cols, boxH / rows, preferredCellPt || boxW / cols))
      : preferredCellPt;
  const mazeWPt = cols * fittedCell;
  const mazeHPt = rows * fittedCell;
  const widthPt = framePt ? Math.min(framePt, slot.widthPt) : mazeWPt;
  const heightPt = framePt ? Math.min(framePt, slot.heightPt) : mazeHPt;
  const leftPt = slot.leftPt + (slot.widthPt - widthPt) / 2;
  const topPt = slot.topPt;
  return {
    leftPt,
    topPt,
    widthPt,
    heightPt,
    cellWPt: fittedCell,
    cellHPt: fittedCell,
    offsetXPt: (widthPt - mazeWPt) / 2,
    offsetYPt: (heightPt - mazeHPt) / 2,
    mazeWPt,
    mazeHPt,
    rows,
    cols,
  };
}

export function mazeCenter(layout: MazeLayout, col: number, row: number): { xPt: number; yPt: number } {
  return {
    xPt: layout.leftPt + layout.offsetXPt + (col + 0.5) * layout.cellWPt,
    yPt: layout.topPt + layout.offsetYPt + (row + 0.5) * layout.cellHPt,
  };
}

export interface LineSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function mazeWallSegments(puzzle: MazePuzzle, layout: MazeLayout): LineSeg[] {
  const { rows, cols } = layout;
  const isOutside = (r: number, c: number) => puzzle.outside?.[r]?.[c] === true;
  const isWallCell = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && puzzle.grid[r][c] && !isOutside(r, c);
  const segs: LineSeg[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWallCell(r, c)) continue;
      const a = mazeCenter(layout, c, r);
      if (isWallCell(r, c + 1)) {
        const b = mazeCenter(layout, c + 1, r);
        segs.push({ x1: a.xPt, y1: a.yPt, x2: b.xPt, y2: b.yPt });
      }
      if (isWallCell(r + 1, c)) {
        const b = mazeCenter(layout, c, r + 1);
        segs.push({ x1: a.xPt, y1: a.yPt, x2: b.xPt, y2: b.yPt });
      }
      if (
        !isWallCell(r, c + 1) &&
        !isWallCell(r + 1, c) &&
        !isWallCell(r, c - 1) &&
        !isWallCell(r - 1, c)
      ) {
        segs.push({ x1: a.xPt, y1: a.yPt, x2: a.xPt, y2: a.yPt });
      }
    }
  }
  return segs;
}

export function mazePathPoints(puzzle: MazePuzzle, layout: MazeLayout, showSolution: boolean): Array<{ xPt: number; yPt: number }> {
  if (!showSolution) return [];
  const path =
    puzzle.solutionPath && puzzle.solutionPath.length > 1
      ? puzzle.solutionPath
      : solveMazePath(puzzle.grid, puzzle.start, puzzle.end);
  return path.map((p) => mazeCenter(layout, p.col, p.row));
}

export function mazeWallThicknessPt(layout: MazeLayout, wallThicknessPct: number): number {
  return Math.max(0.6, (Math.min(layout.cellWPt, layout.cellHPt) * Math.max(10, Math.min(100, wallThicknessPct))) / 100);
}

export function mazePathThicknessPt(layout: MazeLayout, pathThicknessPct: number): number {
  return Math.max(0.6, (Math.min(layout.cellWPt, layout.cellHPt) * Math.max(5, Math.min(100, pathThicknessPct))) / 100);
}

export function mazeDashArray(style: MazeSolutionPathStyle | undefined, strokePt: number): number[] | undefined {
  if (style === 'dashed') return [Math.max(3, strokePt * 2.4), Math.max(2, strokePt * 1.6)];
  if (style === 'dotted') return [0.01, Math.max(2, strokePt * 1.85)];
  return undefined;
}

export function mazeArrowPoints(
  cx: number,
  cy: number,
  size: number,
  dir: ArrowDir
): Array<{ x: number; y: number }> {
  const s = Math.max(6, size * 1.35);
  switch (dir) {
    case 'up':
      return [
        { x: cx, y: cy - s * 0.55 },
        { x: cx - s * 0.45, y: cy + s * 0.35 },
        { x: cx + s * 0.45, y: cy + s * 0.35 },
      ];
    case 'left':
      return [
        { x: cx - s * 0.55, y: cy },
        { x: cx + s * 0.35, y: cy - s * 0.45 },
        { x: cx + s * 0.35, y: cy + s * 0.45 },
      ];
    case 'right':
      return [
        { x: cx + s * 0.55, y: cy },
        { x: cx - s * 0.35, y: cy - s * 0.45 },
        { x: cx - s * 0.35, y: cy + s * 0.45 },
      ];
    case 'down':
    default:
      return [
        { x: cx, y: cy + s * 0.55 },
        { x: cx - s * 0.45, y: cy - s * 0.35 },
        { x: cx + s * 0.45, y: cy - s * 0.35 },
      ];
  }
}

export function mazeArrowRotate(dir: ArrowDir): number {
  if (dir === 'right') return 90;
  if (dir === 'down') return 180;
  if (dir === 'left') return 270;
  return 0;
}

export function sudokuLineScale(thicknessPercent: number): { thinPt: number; thickPt: number; outerPt: number } {
  const scale = Math.max(0.25, (thicknessPercent || 100) / 100);
  return {
    thinPt: Math.max(0.4, cssPxToPoints(1 * scale)),
    thickPt: Math.max(0.75, cssPxToPoints(2 * scale)),
    outerPt: Math.max(1.1, cssPxToPoints(2 * scale)),
  };
}

export { formatSudokuSymbol, SUDOKU_BOX };
