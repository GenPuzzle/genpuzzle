/**
 * Native PPT drawing for crossword / sudoku / maze / scramble / trivia / cryptogram.
 * Titles, letters, clues, walls, and grid lines are pptxgenjs text + shapes —
 * never a full-page raster.
 */

import type { CompiledPage } from './book-compiler';
import { getTitleWordsForDocument } from './book-compiler';
import type { DocumentPage } from './document-model';
import {
  getDefaultGenericPuzzleSettings,
  isGenericPuzzleModuleType,
  normalizeGenericPuzzleSettings,
  type GenericPuzzleSettings,
} from './generic-puzzle-settings';
import { addHeaderAssemblyToSlide } from './header-assembly-ppt-draw';
import { addPageNumberToSlide } from './page-number-ppt-draw';
import {
  drawPageVariablesOnPptSlide,
  pageVariablesFromDocument,
  resolvePageVariableContext,
} from './page-variables-draw';
import { textVariableContextFromDocument } from './ai/text-variable-context';
import { resolveGenericPageSurfaceColors } from './generic-page-chrome';
import { cssPxToPoints } from './puzzle-layout';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  type CrosswordSettings,
} from './crossword-settings';
import { findInteriorUnusedCells } from './puzzles/crossword';
import { getPageContainerFrameGeom } from './page-frame-geometry';

import {
  computeGenericPageLayout,
  type RectPt,
} from './generic-puzzle-page-layout';
import { computeCrosswordPuzzleBodyLayout } from './crossword-puzzle-page-layout';
import { renderResolvedPpt } from './resolved-layout/render-ppt';
import { buildMazeElements } from './resolved-layout/maze-elements';
import { buildSudokuElements } from './resolved-layout/sudoku-elements';
import { buildCodewordsElements } from './resolved-layout/codewords-elements';
import { buildBinairoElements } from './resolved-layout/binairo-elements';
import { buildKakuroElements } from './resolved-layout/kakuro-elements';
import { buildMathMazeElements } from './resolved-layout/math-maze-elements';
import { buildFillElements } from './resolved-layout/fill-elements';
import { buildSnakeElements } from './resolved-layout/snake-elements';
import {
  buildCrosswordElements,
  buildCryptogramElements,
  buildScrambleElements,
  buildTriviaElements,
} from './resolved-layout/book-elements';
import {
  crosswordCells,
  crosswordLetterFontPt,
  crosswordNumberFontPt,
  fitUniformGrid,
  placeFixedUniformGrid,
  layoutMaze,
  mazeArrowRotate,
  mazePathPoints,
  mazePathThicknessPt,
  mazeStartDir,
  mazeWallRuns,
  mazeWallThicknessPt,
  sudokuDigitFillRatio,
  sudokuLineScale,
  sudokuSizeOf,
  sudokuBoxOf,
  formatSudokuSymbol,
} from './generic-puzzle-geometry';
import {
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLetter,
} from './puzzles/trivia';
import {
  buildCalcudokuCageIdGrid,
  calcudokuCageLabel,
  calcudokuInternalBorder,
  calcudokuLabelCell,
  isCalcudokuPuzzle,
} from './puzzles/calcudoku';
import type {
  CrosswordPuzzle,
  MazePuzzle,
  SudokuPuzzle,
  TitleWordsSettings,
  TriviaPuzzle,
  WordScramblePuzzle,
  WordSearchSettings,
} from './puzzles/types';
import { toHex6 } from './color-utils';
import {
  FlattenedBackgroundPptCache,
  applyFlattenedBackgroundToSlide,
  puzzlePageBackgroundConfig,
  type PageBackgroundConfig,
} from './unified-background';
import { resolvePageFrameSettings, type PageFrameSettings } from './page-frame-settings';

type PptSlide = {
  background?: Record<string, unknown>;
  addText: (text: unknown, opts: Record<string, unknown>) => void;
  addShape: (shape: string, opts: Record<string, unknown>) => void;
  addImage?: (opts: Record<string, unknown>) => void;
};

type PptPres = { addSlide: () => PptSlide };

type RectIn = { x: number; y: number; w: number; h: number };

const ZERO_MARGIN: [number, number, number, number] = [0, 0, 0, 0];

function pt2in(pt: number): number {
  const v = pt / 72;
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function rectInFromPt(r: RectPt): RectIn {
  return { x: pt2in(r.leftPt), y: pt2in(r.topPt), w: pt2in(r.widthPt), h: pt2in(r.heightPt) };
}

function px2in(px: number): number {
  return Number.isFinite(px) ? Math.max(0, px / 96) : 0;
}

function px2pt(px: number): number {
  return Number.isFinite(px) ? Math.max(1, px * 0.75) : 8;
}

function safeIn(v: number, fallback = 0.01): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function hex6(hex: string | undefined, fallback = '000000'): string {
  return toHex6(hex, fallback);
}

function pptBackgroundOptions(pageFrame: { enabled: boolean; marginSizeIn: number }) {
  return {
    bakeInnerFrameFill: false as const,
    frameEnabled: pageFrame.enabled,
    frameMarginIn: pageFrame.marginSizeIn,
  };
}

function addPageContainerFrame(
  slide: PptSlide,
  pageWIn: number,
  pageHIn: number,
  frame: PageFrameSettings,
  pageBackgroundColor: string | undefined,
  hasBackgroundImage: boolean
): void {
  if (!frame.enabled) return;
  const { x, y, w, h, shapeType, roundProps, strokePt } = getPageContainerFrameGeom(
    pageWIn,
    pageHIn,
    frame
  );
  const strokeColor = hex6(frame.borderColor);
  if (strokePt <= 0) return;

  if (hasBackgroundImage && pageBackgroundColor) {
    slide.addShape(shapeType as any, {
      x,
      y,
      w,
      h,
      fill: { color: hex6(pageBackgroundColor, 'FFFFFF') },
      line: { color: strokeColor, width: strokePt },
      ...roundProps,
    });
    return;
  }
  slide.addShape(shapeType as any, {
    x,
    y,
    w,
    h,
    line: { color: strokeColor, width: strokePt },
    ...roundProps,
  });
}

function addLine(
  slide: PptSlide,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  widthPt: number,
  dashType?: 'solid' | 'dash' | 'sysDot'
): void {
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 0.0008 && h < 0.0008) {
    slide.addShape('ellipse', {
      x: x1 - px2in(widthPt),
      y: y1 - px2in(widthPt),
      w: px2in(widthPt * 2),
      h: px2in(widthPt * 2),
      fill: { color },
      line: { color, width: 0 },
    });
    return;
  }
  slide.addShape('line', {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.max(w, 0.001),
    h: Math.max(h, 0.001),
    flipH: x2 < x1,
    flipV: y2 < y1,
    line: {
      color,
      width: Math.max(0.4, widthPt),
      cap: 'round',
      ...(dashType && dashType !== 'solid' ? { dashType } : {}),
    },
  });
}

/** Filled pill matching SVG round-cap strokes (PowerPoint line shapes do not emit round caps). */
function addStadium(
  slide: PptSlide,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  thicknessPt: number
): void {
  const t = Math.max(pt2in(thicknessPt), 0.012);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const noLine = { type: 'none' as const };
  if (len < 0.0005) {
    slide.addShape('ellipse', {
      x: x1 - t / 2,
      y: y1 - t / 2,
      w: t,
      h: t,
      fill: { color },
      line: noLine,
    });
    return;
  }
  if (Math.abs(dy) <= Math.abs(dx) * 0.02) {
    slide.addShape('roundRect', {
      x: Math.min(x1, x2) - t / 2,
      y: (y1 + y2) / 2 - t / 2,
      w: len + t,
      h: t,
      rectRadius: t / 2,
      fill: { color },
      line: noLine,
    });
    return;
  }
  if (Math.abs(dx) <= Math.abs(dy) * 0.02) {
    slide.addShape('roundRect', {
      x: (x1 + x2) / 2 - t / 2,
      y: Math.min(y1, y2) - t / 2,
      w: t,
      h: len + t,
      rectRadius: t / 2,
      fill: { color },
      line: noLine,
    });
    return;
  }
  addLine(slide, x1, y1, x2, y2, color, thicknessPt);
}

function addCenteredText(
  slide: PptSlide,
  text: string,
  box: RectIn,
  opts: {
    fontSize: number;
    fontFace?: string;
    color?: string;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    wrap?: boolean;
  }
): void {
  if (!text) return;
  slide.addText(text, {
    x: box.x,
    y: box.y,
    w: safeIn(box.w),
    h: safeIn(box.h),
    fontSize: Math.max(1, opts.fontSize),
    fontFace: opts.fontFace || 'Arial',
    color: hex6(opts.color, '111111'),
    bold: opts.bold ?? false,
    align: opts.align ?? 'center',
    valign: opts.valign ?? 'middle',
    margin: ZERO_MARGIN,
    inset: 0,
    wrap: opts.wrap ?? true,
    isTextBox: true,
    fill: { type: 'none' as const },
    line: { color: 'FFFFFF', transparency: 100, width: 0 },
  });
}

function fitRect(innerW: number, innerH: number, slot: RectIn): RectIn {
  const scale = Math.min(1, slot.w / Math.max(0.01, innerW), slot.h / Math.max(0.01, innerH));
  const w = innerW * scale;
  const h = innerH * scale;
  return {
    x: slot.x + (slot.w - w) / 2,
    y: slot.y,
    w,
    h,
  };
}

function drawSudoku(
  slide: PptSlide,
  puzzle: SudokuPuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildSudokuElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawCodewords(
  slide: PptSlide,
  puzzle: import('./puzzles/codewords').CodewordPuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildCodewordsElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawBinairo(
  slide: PptSlide,
  puzzle: import('./puzzles/binairo').BinairoPuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildBinairoElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawKakuro(
  slide: PptSlide,
  puzzle: import('./puzzles/kakuro').KakuroPuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildKakuroElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawMathMaze(
  slide: PptSlide,
  puzzle: import('./puzzles/math-maze').MathMazePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildMathMazeElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawFill(
  slide: PptSlide,
  puzzle: import('./puzzles/fill').FillPuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildFillElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function drawSnake(
  slide: PptSlide,
  puzzle: import('./puzzles/snake').SnakePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildSnakeElements({ puzzle, slot: slotPt, gp, showSolution, preferredCellPt })
  );
}

function mazePptDash(style: string | undefined): 'solid' | 'dash' | 'sysDot' {
  if (style === 'dashed') return 'dash';
  if (style === 'dotted') return 'sysDot';
  return 'solid';
}

function drawMaze(
  slide: PptSlide,
  puzzle: MazePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  framePt: number | null
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildMazeElements({
      puzzle,
      slot: slotPt,
      preferredCellPt,
      framePt,
      gp,
      showSolution,
    })
  );
}
function drawCrosswordGrid(
  slide: PptSlide,
  puzzle: CrosswordPuzzle,
  slot: RectIn,
  cw: CrosswordSettings,
  showSolution: boolean,
  preferredCellPt: number,
  lockCell = false
): { gridBox: RectIn; cell: number } {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  const fitted = lockCell
    ? placeFixedUniformGrid(cols, rows, preferredCellPt, slotPt)
    : fitUniformGrid(cols, rows, preferredCellPt, slotPt);
  const gridBox = rectInFromPt(fitted);
  const cell = gridBox.w / Math.max(1, cols);
  const cells = crosswordCells(puzzle, fitted, cw, showSolution);
  const lineColor = hex6(cw.colors.lineColor, 'CCCCCC');
  const linePt = Math.max(0.4, cssPxToPoints(cw.colors.lineThicknessPx || 1));
  const letterColor = hex6(
    showSolution ? cw.colors.answersColor : cw.colors.hintLettersColor,
    '333333'
  );
  const numberColor = hex6(cw.colors.numbersColor, '333333');
  const letterPt = crosswordLetterFontPt(cw, fitted.cellPt);
  const numberPt = crosswordNumberFontPt(cw, fitted.cellPt, showSolution);

  /**
   * Draw strategy: cells as borderless filled rectangles first, then
   * overlay grid lines as separate line segments.
   *
   * This matches the CSS-grid-gap technique used in the UI canvas preview:
   * a single stroke at each shared edge, no doubled borders between adjacent
   * cells. Black filled cells are drawn borderless; transparent black cells
   * are skipped entirely (page background shows through).
   */

  // 1. Draw all cell fills (no border / line property).
  for (const cellData of cells) {
    const x = pt2in(cellData.leftPt);
    const y = pt2in(cellData.topPt);
    const size = pt2in(cellData.sizePt);

    if (cellData.isBlack) {
      if (cellData.fill) {
        // Filled black cell or interior light grey cell
        slide.addShape('rect', {
          x,
          y,
          w: size,
          h: size,
          fill: { color: hex6(cellData.fill) },
          line: { color: hex6(cellData.fill), width: 0 },
        });
      }
      // Transparent black cell → skip (nothing drawn).
      continue;
    }

    // White / active cell — fill only, no border.
    slide.addShape('rect', {
      x,
      y,
      w: size,
      h: size,
      fill: { color: hex6(cellData.fill || '#ffffff') },
      line: { color: lineColor, width: 0 },
    });

    // Clue number
    if (cellData.clueNumber != null) {
      addCenteredText(
        slide,
        String(cellData.clueNumber),
        { x: x + size * 0.04, y: y + size * 0.02, w: size * 0.65, h: size * 0.4 },
        {
          fontSize: numberPt,
          fontFace: cw.typography.numberFontFamily || 'Arial',
          color: numberColor,
          bold: true,
          align: 'left',
          valign: 'top',
          wrap: false,
        }
      );
    }

    // Answer letter
    if (cellData.letter) {
      addCenteredText(
        slide,
        cellData.letter,
        { x, y: y + size * 0.12, w: size, h: size * 0.82 },
        {
          fontSize: letterPt,
          fontFace: cw.typography.gridLetterFontFamily || cw.typography.numberFontFamily || 'Arial',
          color: letterColor,
          bold: true,
        }
      );
    }
  }

  // 2. Build a lookup for fast neighbour checks.
  const unusedTransparent =
    cw.colors.unusedBoxesTransparent === true ||
    (cw.colors.blackSquareGreyscale ?? 255) === 0;
  const interiorUnused = findInteriorUnusedCells(puzzle.grid);
  const isCellVisible = (r: number, c: number): boolean => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const cell = puzzle.grid[r]?.[c];
    if (!cell) return false;
    if (!cell.isBlack) return true;
    if (unusedTransparent) return interiorUnused[r]?.[c] === true;
    return true;
  };

  // 3. Draw grid lines between visible cells and at their outer edges.
  //    Each line segment is drawn exactly once:
  //      - Vertical lines: drawn on the LEFT edge of a cell when the cell to
  //        its left is visible or it is the leftmost visible cell in that run.
  //        We draw one segment per contiguous vertical run of visible cells.
  //      - Horizontal lines: same logic on the TOP edge.

  // Helper: absolute position of a cell's left / top corner in inches.
  const cellLeft = (c: number) => pt2in(fitted.leftPt + c * fitted.cellPt);
  const cellTop  = (r: number) => pt2in(fitted.topPt  + r * fitted.cellPt);

  // Draw vertical lines (separators between columns and outer left/right edges).
  for (let c = 0; c <= cols; c++) {
    let runStart = -1;
    const flushVRun = (endR: number) => {
      if (runStart < 0) return;
      const y1 = cellTop(runStart);
      const y2 = cellTop(endR);
      const x = cellLeft(c);
      addLine(slide, x, y1, x, y2, lineColor, linePt);
      runStart = -1;
    };
    for (let r = 0; r < rows; r++) {
      const leftActive = isCellVisible(r, c - 1);
      const rightActive = isCellVisible(r, c);
      const needLine = leftActive !== rightActive || (leftActive && rightActive);
      if (needLine) {
        if (runStart < 0) runStart = r;
      } else {
        flushVRun(r);
      }
    }
    flushVRun(rows);
  }

  // Draw horizontal lines (separators between rows and outer top/bottom edges).
  for (let r = 0; r <= rows; r++) {
    let runStart = -1;
    const flushHRun = (endC: number) => {
      if (runStart < 0) return;
      const x1 = cellLeft(runStart);
      const x2 = cellLeft(endC);
      const y = cellTop(r);
      addLine(slide, x1, y, x2, y, lineColor, linePt);
      runStart = -1;
    };
    for (let c = 0; c < cols; c++) {
      const topActive = isCellVisible(r - 1, c);
      const bottomActive = isCellVisible(r, c);
      const needLine = topActive !== bottomActive || (topActive && bottomActive);
      if (needLine) {
        if (runStart < 0) runStart = c;
      } else {
        flushHRun(c);
      }
    }
    flushHRun(cols);
  }

  return { gridBox, cell };
}


function drawCrosswordClues(
  slide: PptSlide,
  puzzle: CrosswordPuzzle,
  area: RectIn,
  cw: CrosswordSettings,
  body: ReturnType<typeof computeCrosswordPuzzleBodyLayout>
): void {
  const columns = body.columns;
  const gap = pt2in(body.spacing.columnGap);
  const colW = (area.w - (columns === 2 ? gap : 0)) / columns;
  const headingPt = body.headingFontSize;
  const cluePt = body.clueFontSize;
  const headingFont = cw.typography.acrossDownFontFamily || cw.typography.clueFontFamily || 'Arial';
  const clueFont = cw.typography.clueFontFamily || 'Arial';
  const headingColor = hex6(cw.colors.cluesColor, '333333');
  const numberColor = hex6(cw.colors.numbersColor || cw.colors.cluesColor, '333333');
  const clueColor = hex6(cw.colors.cluesColor, '333333');

  const headingAfterPt = body.spacing.headingAfter;
  const itemGapPt = body.spacing.itemGap;
  const sectionGapPt = body.spacing.sectionGap;

  const buildGroupRuns = (
    title: string,
    clues: { number: number; clue: string }[],
    isLastGroup: boolean
  ) => {
    const runs: Array<{ text: string; options: Record<string, unknown> }> = [];

    // Group Title ("Across" or "Down")
    runs.push({
      text: title,
      options: {
        fontSize: headingPt,
        fontFace: headingFont,
        color: headingColor,
        bold: true,
        align: 'left',
        breakLine: true,
        paraSpaceAfter: headingAfterPt,
      },
    });

    // Clue items
    clues.forEach((clue, ci) => {
      const isLastClueInGroup = ci === clues.length - 1;
      const spaceAfter = isLastClueInGroup
        ? isLastGroup
          ? 0
          : sectionGapPt
        : itemGapPt;

      runs.push({
        text: `${clue.number}. `,
        options: {
          fontSize: cluePt,
          fontFace: clueFont,
          color: numberColor,
          bold: true,
          align: 'left',
        },
      });

      runs.push({
        text: clue.clue,
        options: {
          fontSize: cluePt,
          fontFace: clueFont,
          color: clueColor,
          bold: false,
          align: 'left',
          breakLine: true,
          paraSpaceAfter: spaceAfter,
        },
      });
    });

    return runs;
  };

  if (columns === 2) {
    const acrossRuns = buildGroupRuns('ACROSS', puzzle.acrossClues, true);
    if (acrossRuns.length > 0) {
      slide.addText(acrossRuns, {
        x: area.x,
        y: area.y,
        w: safeIn(colW),
        h: safeIn(area.h),
        valign: 'top',
        align: 'left',
        margin: ZERO_MARGIN,
        inset: 0,
        wrap: true,
        isTextBox: true,
        lineSpacing: Math.max(1, body.spacing.lineHeightFactor * body.clueFontSize),
        fill: { type: 'none' },
        line: { color: 'FFFFFF', transparency: 100, width: 0 },
      });
    }

    const downRuns = buildGroupRuns('DOWN', puzzle.downClues, true);
    if (downRuns.length > 0) {
      slide.addText(downRuns, {
        x: area.x + colW + gap,
        y: area.y,
        w: safeIn(colW),
        h: safeIn(area.h),
        valign: 'top',
        align: 'left',
        margin: ZERO_MARGIN,
        inset: 0,
        wrap: true,
        isTextBox: true,
        lineSpacing: Math.max(1, body.spacing.lineHeightFactor * body.clueFontSize),
        fill: { type: 'none' },
        line: { color: 'FFFFFF', transparency: 100, width: 0 },
      });
    }
  } else {
    const acrossRuns = buildGroupRuns('ACROSS', puzzle.acrossClues, false);
    const downRuns = buildGroupRuns('DOWN', puzzle.downClues, true);
    const combined = [...acrossRuns, ...downRuns];

    if (combined.length > 0) {
      slide.addText(combined, {
        x: area.x,
        y: area.y,
        w: safeIn(area.w),
        h: safeIn(area.h),
        valign: 'top',
        align: 'left',
        margin: ZERO_MARGIN,
        inset: 0,
        wrap: true,
        isTextBox: true,
        lineSpacing: Math.max(1, body.spacing.lineHeightFactor * body.clueFontSize),
        fill: { type: 'none' },
        line: { color: 'FFFFFF', transparency: 100, width: 0 },
      });
    }
  }
}

function drawCrossword(
  slide: PptSlide,
  puzzle: CrosswordPuzzle,
  slot: RectIn,
  cw: CrosswordSettings,
  showSolution: boolean,
  preferredCellPt: number,
  pageNumberZoneTopPt: number,
  clueGapPt: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildCrosswordElements({
      puzzle,
      slot: slotPt,
      cw,
      showSolution,
      preferredCellPt,
      clueGapPt,
      hideClues: showSolution,
      pageNumberZoneTopPt,
    })
  );
}

function drawWordScramble(
  slide: PptSlide,
  puzzle: WordScramblePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  fontSizeOverridePt?: number,
  wordGapPt?: number,
  letterEm?: number
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(
    slide,
    buildScrambleElements({
      puzzle,
      slot: slotPt,
      gp,
      showSolution,
      fontSizePt: fontSizeOverridePt ?? gp.typography.puzzleFontSize ?? 14,
      wordGapPt: wordGapPt ?? gp.typography.scrambleSpaceBetweenWords ?? 8,
      letterEm: letterEm ?? gp.typography.scrambleSpaceBetweenLetters ?? 0.12,
    })
  );
}

function drawTrivia(
  slide: PptSlide,
  puzzles: TriviaPuzzle[],
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(slide, buildTriviaElements({ puzzles, slot: slotPt, gp, showSolution }));
}

function drawCryptogram(
  slide: PptSlide,
  puzzle: { encodedText: string; originalText: string; letterMapping?: Record<string, string> },
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  renderResolvedPpt(slide, buildCryptogramElements({ puzzle, slot: slotPt, gp, showSolution }));
}

function drawPuzzleBody(
  slide: PptSlide,
  puzzleType: string,
  puzzle: unknown,
  puzzles: unknown[],
  slot: RectIn,
  cw: CrosswordSettings | null,
  gp: GenericPuzzleSettings | null,
  showSolution: boolean,
  metrics: {
    crosswordCellPt: number;
    genericCellPt: number;
    mazeFramePt: number | null;
    scrambleFontPt?: number;
    scrambleWordGapPt?: number;
    scrambleLetterEm?: number;
    pageNumberZoneTopPt?: number;
    puzzleToCluesGapPt?: number;
  }
): void {
  if (puzzleType === 'crossword' && cw) {
    drawCrossword(
      slide,
      puzzle as CrosswordPuzzle,
      slot,
      cw,
      showSolution,
      metrics.crosswordCellPt,
      metrics.pageNumberZoneTopPt ?? slot.y * 72 + slot.h * 72,
      metrics.puzzleToCluesGapPt ?? 18
    );
    return;
  }
  if (!gp) return;
  if (puzzleType === 'sudoku') {
    drawSudoku(slide, puzzle as SudokuPuzzle, slot, gp, showSolution, metrics.genericCellPt);
    return;
  }
  if (puzzleType === 'codewords') {
    drawCodewords(
      slide,
      puzzle as import('./puzzles/codewords').CodewordPuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'binairo') {
    drawBinairo(
      slide,
      puzzle as import('./puzzles/binairo').BinairoPuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'kakuro') {
    drawKakuro(
      slide,
      puzzle as import('./puzzles/kakuro').KakuroPuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'math-maze') {
    drawMathMaze(
      slide,
      puzzle as import('./puzzles/math-maze').MathMazePuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'word-fill' || puzzleType === 'number-fill') {
    drawFill(
      slide,
      puzzle as import('./puzzles/fill').FillPuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'snake') {
    drawSnake(
      slide,
      puzzle as import('./puzzles/snake').SnakePuzzle,
      slot,
      gp,
      showSolution,
      metrics.genericCellPt
    );
    return;
  }
  if (puzzleType === 'maze') {
    drawMaze(slide, puzzle as MazePuzzle, slot, gp, showSolution, metrics.genericCellPt, metrics.mazeFramePt);
    return;
  }
  if (puzzleType === 'word-scramble') {
    drawWordScramble(
      slide,
      puzzle as WordScramblePuzzle,
      slot,
      gp,
      showSolution,
      metrics.scrambleFontPt,
      metrics.scrambleWordGapPt,
      metrics.scrambleLetterEm
    );
    return;
  }
  if (puzzleType === 'trivia') {
    drawTrivia(slide, (puzzles.length ? puzzles : [puzzle]) as TriviaPuzzle[], slot, gp, showSolution);
    return;
  }
  if (puzzleType === 'cryptogram') {
    drawCryptogram(
      slide,
      puzzle as { encodedText: string; originalText: string },
      slot,
      gp,
      showSolution
    );
  }
}

export async function addNativeGenericOrCrosswordSlide(
  prs: PptPres,
  compiledPage: CompiledPage,
  layoutSettings: WordSearchSettings,
  documentPages: DocumentPage[],
  titleWords: TitleWordsSettings,
  backgroundCache: FlattenedBackgroundPptCache,
  suppressPageNumber: boolean
): Promise<void> {
  const kind = compiledPage.kind;
  if (
    kind !== 'crossword' &&
    kind !== 'crossword-solution' &&
    kind !== 'generic-puzzle' &&
    kind !== 'generic-puzzle-solution'
  ) {
    return;
  }

  const showSolution = kind === 'crossword-solution' || kind === 'generic-puzzle-solution';
  const puzzleType =
    kind === 'crossword' || kind === 'crossword-solution'
      ? 'crossword'
      : compiledPage.puzzleType;
  const puzzles: unknown[] =
    kind === 'crossword'
      ? [compiledPage.puzzle]
      : kind === 'crossword-solution'
        ? compiledPage.puzzles
        : compiledPage.puzzles;
  const first = puzzles[0] as { puzzleIndexInDocument?: number; difficulty?: string } | undefined;
  const puzzleIndex =
    kind === 'crossword' || kind === 'generic-puzzle'
      ? compiledPage.puzzleIndexInDocument
      : first?.puzzleIndexInDocument ?? 0;

  const cw =
    puzzleType === 'crossword'
      ? normalizeCrosswordSettings(
          (kind === 'crossword' || kind === 'crossword-solution'
            ? compiledPage.crosswordSettings
            : null) ?? getDefaultCrosswordSettings()
        )
      : null;
  const gp = isGenericPuzzleModuleType(puzzleType)
    ? normalizeGenericPuzzleSettings(
        kind === 'generic-puzzle' || kind === 'generic-puzzle-solution'
          ? compiledPage.genericSettings
          : getDefaultGenericPuzzleSettings(puzzleType),
        puzzleType
      )
    : null;

  const docTitleWords = getTitleWordsForDocument(
    documentPages,
    compiledPage.sourceDocumentId,
    titleWords
  );
  const layout = computeGenericPageLayout({
    puzzleType,
    showSolution,
    layoutSettings,
    titleWords: docTitleWords,
    puzzleIndex,
    puzzles: puzzles as Parameters<typeof computeGenericPageLayout>[0]['puzzles'],
    cw,
    gp,
  });

  const pageW = layout.pageWidthPt / 72;
  const pageH = layout.pageHeightPt / 72;
  const pageFrame = resolvePageFrameSettings(layoutSettings);
  const pageColors = resolveGenericPageSurfaceColors(
    layoutSettings,
    showSolution,
    cw?.colors.backgroundColor ?? gp?.colors.backgroundColor
  );
  const bgConfig: PageBackgroundConfig = puzzlePageBackgroundConfig(
    layout.pageWidthPt,
    layout.pageHeightPt,
    pageColors,
    pageFrame.cornerRadiusPx,
    pptBackgroundOptions(pageFrame)
  );

  const hasBackgroundImage = !!pageColors.backgroundImage;
  const slide = prs.addSlide();
  await applyFlattenedBackgroundToSlide(slide, bgConfig, backgroundCache, hex6);
  addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    pageColors.backgroundColor,
    hasBackgroundImage
  );

  if (layout.header) {
    addHeaderAssemblyToSlide(slide, layout.header);
  }
  if (layout.pageTitle && layout.pageTitleBox) {
    addCenteredText(
      slide,
      layout.pageTitle.text,
      rectInFromPt(layout.pageTitleBox),
      {
        fontSize: layout.pageTitle.fontSizePt,
        fontFace: layout.pageTitle.fontFamily,
        color: layout.pageTitle.color,
        bold: true,
        align: layout.pageTitle.align,
      }
    );
  }
  if (layout.subtitle && layout.subtitleBox) {
    addCenteredText(
      slide,
      layout.subtitleLines.length > 0 ? layout.subtitleLines.join('\n') : layout.subtitle.text,
      rectInFromPt(layout.subtitleBox),
      {
        fontSize: layout.subtitle.fontSizePt,
        fontFace: layout.subtitle.fontFamily,
        color: layout.subtitle.color,
        align: layout.subtitle.align,
        wrap: true,
      }
    );
  }

  const metrics = {
    crosswordCellPt: layout.crosswordCellPt,
    genericCellPt: layout.genericCellPt,
    mazeFramePt: layout.mazeFramePt,
    scrambleFontPt: layout.scrambleFit?.fontSizePt,
    scrambleWordGapPt: layout.scrambleFit?.wordGapPt,
    scrambleLetterEm: layout.scrambleFit?.letterEm,
    pageNumberZoneTopPt: layout.pageNumberZoneTopPt,
    puzzleToCluesGapPt: layout.puzzleToCluesGapPt,
  };

  for (const slot of layout.slots) {
    if (slot.title && slot.titleBox) {
      addCenteredText(slide, slot.title.text, rectInFromPt(slot.titleBox), {
        fontSize: slot.title.fontSizePt,
        fontFace: slot.title.fontFamily,
        color: slot.title.color,
        bold: true,
        align: slot.title.align,
      });
    }
    drawPuzzleBody(
      slide,
      puzzleType,
      puzzles[slot.index],
      puzzleType === 'trivia' && showSolution ? puzzles : [puzzles[slot.index]],
      rectInFromPt(slot.content),
      cw,
      gp,
      showSolution,
      metrics
    );
  }

  if (!suppressPageNumber) {
    addPageNumberToSlide(
      slide,
      layout.pageWidthPt,
      layout.pageHeightPt,
      layoutSettings,
      compiledPage.bookPageIndex
    );
  }

  const variableCtx = resolvePageVariableContext({
    puzzleIndexInDocument: puzzleIndex,
    puzzlesPerPage: gp?.core.puzzlesPerPage ?? 1,
    puzzlesStartingNumber:
      gp?.core.puzzlesStartingNumber ?? cw?.core.puzzlesStartingNumber ?? 1,
    bookPageIndex: compiledPage.bookPageIndex,
  });
  drawPageVariablesOnPptSlide({
    slide,
    pageWidthPt: layout.pageWidthPt,
    pageHeightPt: layout.pageHeightPt,
    fields: pageVariablesFromDocument(documentPages, compiledPage.sourceDocumentId),
    contentIndex: variableCtx.contentIndex,
    bookPageNumber: variableCtx.bookPageNumber,
    puzzleNumber: variableCtx.puzzleNumber,
    resolveContext: textVariableContextFromDocument(
      documentPages.find((doc) => doc.id === compiledPage.sourceDocumentId),
      {
        contentIndex: variableCtx.contentIndex,
        puzzleNumber: variableCtx.puzzleNumber,
        pageNumber: variableCtx.bookPageNumber,
      }
    ),
  });
}
