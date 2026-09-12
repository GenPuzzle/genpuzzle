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
import { resolveGenericPageSurfaceColors } from './generic-page-chrome';
import { cssPxToPoints } from './puzzle-layout';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  type CrosswordSettings,
} from './crossword-settings';
import { findInteriorUnusedCells } from './puzzles/crossword';

import {
  computeGenericPageLayout,
  type RectPt,
} from './generic-puzzle-page-layout';
import { computeCrosswordPuzzleBodyLayout } from './crossword-puzzle-page-layout';
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
  mazeWallSegments,
  mazeWallThicknessPt,
  sudokuDigitFillRatio,
  sudokuLineScale,
  sudokuSizeOf,
  sudokuBoxOf,
  formatSudokuSymbol,
} from './generic-puzzle-geometry';
import {
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLabel,
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
  pageBackgroundColor: string | undefined
): void {
  if (!frame.enabled) return;
  const m = frame.marginSizeIn;
  const strokePt = Math.max(0.5, cssPxToPoints(frame.strokeThicknessPx));
  const strokeIn = strokePt / 72;
  const halfIn = strokeIn / 2;
  const x = m + halfIn;
  const y = m + halfIn;
  const w = Math.max(0.01, pageWIn - m * 2 - strokeIn);
  const h = Math.max(0.01, pageHIn - m * 2 - strokeIn);
  const rectRadiusIn = Math.max(
    0,
    Math.min(frame.cornerRadiusPx / 96, Math.min(w, h) / 2)
  );
  const shapeType = rectRadiusIn > 0 ? 'roundRect' : 'rect';
  const roundProps = rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {};
  const strokeColor = hex6(frame.borderColor);

  if (pageBackgroundColor) {
    slide.addShape(shapeType, {
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
  slide.addShape(shapeType, {
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
  const size = sudokuSizeOf(puzzle);
  const calcudoku = isCalcudokuPuzzle(puzzle);
  const { boxH, boxW } = calcudoku ? { boxH: size, boxW: size } : sudokuBoxOf(size);
  const display = showSolution ? puzzle.solution : puzzle.grid;
  const color = hex6(gp.colors.gridColor, '1F2937');
  const thicknessPct = showSolution
    ? gp.core.sudokuSolutionLineThickness ?? 100
    : gp.core.sudokuPuzzleLineThickness ?? 100;
  const { thinPt, thickPt, outerPt } = sudokuLineScale(thicknessPct);
  const fontPt = showSolution
    ? gp.typography.answerFontSize ?? 16
    : gp.typography.puzzleFontSize ?? 14;
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  const grid = fitUniformGrid(size, size, preferredCellPt, slotPt);
  const box = rectInFromPt(grid);
  const cell = box.w / size;
  const digitPt = grid.cellPt * sudokuDigitFillRatio(fontPt);

  slide.addShape('rect', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: 'FFFFFF' },
    line: { color, width: outerPt },
  });

  if (calcudoku) {
    const cageIds = buildCalcudokuCageIdGrid(size, puzzle.cages);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const right = calcudokuInternalBorder(cageIds, r, c, 'right');
        if (right !== 'none') {
          const x = box.x + (c + 1) * cell;
          addLine(
            slide,
            x,
            box.y + r * cell,
            x,
            box.y + (r + 1) * cell,
            right === 'thick' ? color : 'D1D5DB',
            right === 'thick' ? thickPt : thinPt
          );
        }
        const bottom = calcudokuInternalBorder(cageIds, r, c, 'bottom');
        if (bottom !== 'none') {
          const y = box.y + (r + 1) * cell;
          addLine(
            slide,
            box.x + c * cell,
            y,
            box.x + (c + 1) * cell,
            y,
            bottom === 'thick' ? color : 'D1D5DB',
            bottom === 'thick' ? thickPt : thinPt
          );
        }
      }
    }
    for (const cage of puzzle.cages) {
      const at = calcudokuLabelCell(cage);
      const text = calcudokuCageLabel(cage);
      const cageLabelPt = Math.max(
        5,
        Math.min(digitPt * 0.42, (grid.cellPt * 0.86) / Math.max(2, text.length))
      );
      addCenteredText(
        slide,
        text,
        {
          x: box.x + at.col * cell + cell * 0.04,
          y: box.y + at.row * cell + cell * 0.02,
          w: cell * 0.92,
          h: cell * 0.32,
        },
        {
          fontSize: cageLabelPt,
          fontFace: gp.typography.puzzleFontFamily || 'Arial',
          color,
          bold: true,
          align: 'left',
          valign: 'top',
        }
      );
    }
  } else {
    for (let i = 1; i < size; i++) {
      const isBox = i % boxW === 0;
      addLine(
        slide,
        box.x + i * cell,
        box.y,
        box.x + i * cell,
        box.y + box.h,
        isBox ? color : 'D1D5DB',
        isBox ? thickPt : thinPt
      );
    }
    for (let i = 1; i < size; i++) {
      const isBox = i % boxH === 0;
      addLine(
        slide,
        box.x,
        box.y + i * cell,
        box.x + box.w,
        box.y + i * cell,
        isBox ? color : 'D1D5DB',
        isBox ? thickPt : thinPt
      );
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const num = display[r]?.[c] ?? 0;
      const glyph = formatSudokuSymbol(num);
      if (!glyph) continue;
      const given = (puzzle.grid[r]?.[c] ?? 0) !== 0;
      addCenteredText(
        slide,
        glyph,
        { x: box.x + c * cell, y: box.y + r * cell, w: cell, h: cell },
        {
          fontSize: digitPt,
          fontFace: gp.typography.puzzleFontFamily || 'Arial',
          color,
          bold: given || showSolution,
        }
      );
    }
  }
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
  const layout = layoutMaze(puzzle, slotPt, preferredCellPt, framePt);
  const wallColor = hex6(gp.colors.gridColor, '1F2937');
  const pathColor = hex6(gp.colors.solutionPathColor, 'E11D48');
  const wallPt = mazeWallThicknessPt(layout, gp.core.mazeWallThickness ?? 45);
  const pathPt = mazePathThicknessPt(layout, gp.core.mazeSolutionPathThickness ?? 34);
  const markerStyle = gp.core.mazeMarkerStyle ?? 'arrow';

  for (const seg of mazeWallSegments(puzzle, layout)) {
    addLine(slide, pt2in(seg.x1), pt2in(seg.y1), pt2in(seg.x2), pt2in(seg.y2), wallColor, wallPt);
  }

  if (showSolution) {
    const pts = mazePathPoints(puzzle, layout, true);
    const dash = mazePptDash(gp.core.mazeSolutionPathStyle);
    for (let i = 0; i < pts.length - 1; i++) {
      addLine(
        slide,
        pt2in(pts[i].xPt),
        pt2in(pts[i].yPt),
        pt2in(pts[i + 1].xPt),
        pt2in(pts[i + 1].yPt),
        pathColor,
        pathPt,
        dash
      );
    }
  }

  const cellIn = pt2in(Math.min(layout.cellWPt, layout.cellHPt));
  const markerR = Math.max(0.04, cellIn * 0.32);
  const start = {
    x: pt2in(layout.leftPt + layout.offsetXPt + (puzzle.start.col + 0.5) * layout.cellWPt),
    y: pt2in(layout.topPt + layout.offsetYPt + (puzzle.start.row + 0.5) * layout.cellHPt),
  };
  const end = {
    x: pt2in(layout.leftPt + layout.offsetXPt + (puzzle.end.col + 0.5) * layout.cellWPt),
    y: pt2in(layout.topPt + layout.offsetYPt + (puzzle.end.row + 0.5) * layout.cellHPt),
  };
  const startImage = gp.core.mazeStartImage;
  const endImage = gp.core.mazeEndImage;

  if (markerStyle === 'image' && startImage && slide.addImage) {
    const s = markerR * 2.4;
    slide.addImage({ data: startImage, x: start.x - s / 2, y: start.y - s / 2, w: s, h: s });
  } else if (markerStyle === 'point') {
    slide.addShape('ellipse', {
      x: start.x - markerR,
      y: start.y - markerR,
      w: markerR * 2,
      h: markerR * 2,
      fill: { color: '111111' },
      line: { color: '111111', width: 0 },
    });
  } else {
    const s = markerR * 2.2;
    slide.addShape('triangle', {
      x: start.x - s / 2,
      y: start.y - s / 2,
      w: s,
      h: s,
      fill: { color: '111111' },
      line: { color: '111111', width: 0 },
      rotate: mazeArrowRotate(mazeStartDir(puzzle)),
    });
  }

  if (markerStyle === 'image' && endImage && slide.addImage) {
    const s = markerR * 2.4;
    slide.addImage({ data: endImage, x: end.x - s / 2, y: end.y - s / 2, w: s, h: s });
  } else {
    slide.addShape('ellipse', {
      x: end.x - markerR,
      y: end.y - markerR,
      w: markerR * 2,
      h: markerR * 2,
      fill: { color: '111111' },
      line: { color: '111111', width: 0 },
    });
  }
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
  const showClues = !showSolution;
  const showAnswerKey = showSolution && cw.typography.showAnswerKey !== false;
  const slotPt: RectPt = {
    leftPt: slot.x * 72,
    topPt: slot.y * 72,
    widthPt: slot.w * 72,
    heightPt: slot.h * 72,
  };
  if (!showClues && !showAnswerKey) {
    drawCrosswordGrid(slide, puzzle, slot, cw, showSolution, preferredCellPt);
    return;
  }
  if (showClues) {
    const body = computeCrosswordPuzzleBodyLayout({
      puzzle,
      cw,
      slot: slotPt,
      preferredCellPt,
      clueGapPt,
      pageNumberZoneTopPt,
    });
    const gridSlot: RectIn = {
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: pt2in(body.grid.heightPt + 1),
    };
    drawCrosswordGrid(slide, puzzle, gridSlot, cw, showSolution, body.cellPt, true);
    drawCrosswordClues(slide, puzzle, rectInFromPt(body.cluesRect), cw, body);
    return;
  }
  const gridShare = 0.78;
  const gridSlot: RectIn = { x: slot.x, y: slot.y, w: slot.w, h: slot.h * gridShare };
  const { gridBox } = drawCrosswordGrid(slide, puzzle, gridSlot, cw, showSolution, preferredCellPt);
  const restY = gridBox.y + gridBox.h + px2in(8);
  const restH = Math.max(0.2, slot.y + slot.h - restY);
  const formatAnswer = (answer: string) => {
    if (cw.core.answerCase === 'lower') return answer.toLowerCase();
    if (cw.core.answerCase === 'original') return answer;
    return answer.toUpperCase();
  };
  const across = puzzle.acrossClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
  const down = puzzle.downClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
  const keyPt = px2pt(cw.typography.answerKeyFontSize ?? 11);
  addCenteredText(
    slide,
    `Across  ${across}`,
    { x: gridBox.x, y: restY, w: gridBox.w, h: restH * 0.45 },
    {
      fontSize: keyPt,
      fontFace: cw.typography.clueFontFamily || 'Arial',
      color: cw.colors.cluesColor,
      align: 'left',
      valign: 'top',
    }
  );
  addCenteredText(
    slide,
    `Down  ${down}`,
    { x: gridBox.x, y: restY + restH * 0.48, w: gridBox.w, h: restH * 0.45 },
    {
      fontSize: keyPt,
      fontFace: cw.typography.clueFontFamily || 'Arial',
      color: cw.colors.cluesColor,
      align: 'left',
      valign: 'top',
    }
  );
}

function scrambleWords(puzzle: WordScramblePuzzle): Array<{ original: string; scrambled: string }> {
  const raw = puzzle.words ?? [];
  const out: Array<{ original: string; scrambled: string }> = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const original = entry.trim();
      if (original.length >= 2) out.push({ original, scrambled: original });
      continue;
    }
    const original = String(entry?.original || '').trim();
    const scrambled = String(entry?.scrambled || original).trim();
    if (original.length >= 2) out.push({ original, scrambled: scrambled || original });
  }
  return out;
}

function drawWordScramble(
  slide: PptSlide,
  puzzle: WordScramblePuzzle,
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  fontSizeOverridePt?: number
): void {
  const words = scrambleWords(puzzle);
  const fontPt =
    fontSizeOverridePt ??
    (showSolution ? gp.typography.answerFontSize ?? 14 : gp.typography.puzzleFontSize ?? 14);
  const color = hex6(gp.colors.gridColor, '1F2937');
  const face = gp.typography.puzzleFontFamily || 'Arial';
  const letterCase = gp.core.letterCase === 'lower' ? 'lower' : 'upper';
  const applyCase = (v: string) => (letterCase === 'lower' ? v.toLowerCase() : v.toUpperCase());
  const rowH = Math.min(pt2in(fontPt * 1.55), slot.h / Math.max(1, words.length + 1));
  const style = gp.core.answerBlankStyle ?? 'underline';

  words.forEach((word, i) => {
    const y = slot.y + i * rowH;
    if (y + rowH > slot.y + slot.h + 0.02) return;
    if (showSolution) {
      addCenteredText(
        slide,
        `${applyCase(word.scrambled)}  =  ${applyCase(word.original)}`,
        { x: slot.x, y, w: slot.w, h: rowH },
        { fontSize: fontPt, fontFace: face, color, align: 'left', bold: true }
      );
      return;
    }
    const scrambled = applyCase(word.scrambled);
    const letters = word.original.replace(/[\s-]/g, '').split('');
    if (style === 'boxes') {
      addCenteredText(
        slide,
        scrambled,
        { x: slot.x, y, w: slot.w * 0.42, h: rowH },
        { fontSize: fontPt, fontFace: face, color, align: 'left', bold: true }
      );
      const box = Math.min(rowH * 0.72, 0.28);
      letters.forEach((_, li) => {
        slide.addShape('rect', {
          x: slot.x + slot.w * 0.46 + li * (box + 0.04),
          y: y + (rowH - box) / 2,
          w: box,
          h: box,
          fill: { type: 'none' as const },
          line: { color, width: 1.1 },
        });
      });
      return;
    }
    const blank =
      style === 'blank'
        ? ' '
        : style === 'underline'
          ? '_'.repeat(Math.max(4, letters.length))
          : Array.from({ length: Math.max(4, letters.length) }, () => '-').join(' ');
    addCenteredText(
      slide,
      `${scrambled}   ${blank}`,
      { x: slot.x, y, w: slot.w, h: rowH },
      { fontSize: fontPt, fontFace: face, color, align: 'left', bold: true }
    );
  });
}

function drawTrivia(
  slide: PptSlide,
  puzzles: TriviaPuzzle[],
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  const fontPt = showSolution
    ? gp.typography.answerFontSize ?? 12
    : gp.typography.puzzleFontSize ?? 12;
  const color = hex6(gp.colors.gridColor, '1F2937');
  const face = gp.typography.puzzleFontFamily || 'Arial';
  const checkbox = gp.core.triviaCheckboxStyle === 'square' ? 'rect' : 'ellipse';

  if (showSolution) {
    const cols = Math.max(1, Math.min(4, gp.core.triviaSolutionColumns || 3));
    const colW = slot.w / cols;
    const sections = puzzles.map((p, i) => ({
      heading: formatTriviaSolutionHeading(p, i, gp.core.puzzlesStartingNumber),
      answers: (p.questions ?? [])
        .filter((q) => (q.prompt || '').trim())
        .map((q, qi) => `${qi + 1}. ${resolveTriviaAnswerLabel(q)}`),
    }));
    const colSections: typeof sections[] = Array.from({ length: cols }, () => []);
    sections.forEach((s, i) => colSections[i % cols].push(s));
    colSections.forEach((list, ci) => {
      let y = slot.y;
      list.forEach((section) => {
        addCenteredText(
          slide,
          section.heading,
          { x: slot.x + ci * colW, y, w: colW - 0.08, h: pt2in(fontPt * 1.4) },
          { fontSize: fontPt, fontFace: face, color, bold: true, align: 'left' }
        );
        y += pt2in(fontPt * 1.45);
        section.answers.forEach((line) => {
          addCenteredText(
            slide,
            line,
            { x: slot.x + ci * colW, y, w: colW - 0.08, h: pt2in(fontPt * 1.25) },
            { fontSize: Math.max(8, fontPt * 0.92), fontFace: face, color, align: 'left' }
          );
          y += pt2in(fontPt * 1.28);
        });
        y += pt2in(6);
      });
    });
    return;
  }

  const puzzle = puzzles[0];
  const questions = puzzle?.questions ?? [];
  const twoCol = gp.core.triviaLayoutFormat === 'two-column';
  const colCount = twoCol ? 2 : 1;
  const colW = slot.w / colCount;
  const box = Math.max(0.12, pt2in(fontPt * 0.85));
  questions.forEach((q, qi) => {
    const col = twoCol ? qi % 2 : 0;
    const row = twoCol ? Math.floor(qi / 2) : qi;
    const blockH = slot.h / Math.max(1, Math.ceil(questions.length / colCount));
    const x = slot.x + col * colW;
    const y = slot.y + row * blockH;
    addCenteredText(
      slide,
      `${qi + 1}. ${q.prompt}`,
      { x, y, w: colW - 0.06, h: pt2in(fontPt * 1.4) },
      { fontSize: fontPt, fontFace: face, color, bold: true, align: 'left', valign: 'top' }
    );
    (q.suggestions ?? []).forEach((sug, si) => {
      const sy = y + pt2in(fontPt * 1.5) + si * pt2in(fontPt * 1.35);
      slide.addShape(checkbox, {
        x,
        y: sy + pt2in(2),
        w: box,
        h: box,
        fill: { type: 'none' as const },
        line: { color: '9CA3AF', width: 1.1 },
      });
      addCenteredText(
        slide,
        sug,
        { x: x + box + 0.06, y: sy, w: colW - box - 0.12, h: pt2in(fontPt * 1.25) },
        { fontSize: Math.max(8, fontPt * 0.92), fontFace: face, color, align: 'left' }
      );
    });
  });
}

function drawCryptogram(
  slide: PptSlide,
  puzzle: { encodedText: string; originalText: string; letterMapping?: Record<string, string> },
  slot: RectIn,
  gp: GenericPuzzleSettings,
  showSolution: boolean
): void {
  const fontPt = showSolution
    ? gp.typography.answerFontSize ?? 14
    : gp.typography.puzzleFontSize ?? 14;
  const color = hex6(gp.colors.gridColor, '1F2937');
  const face = gp.typography.puzzleFontFamily || 'Arial';
  const text = showSolution && gp.core.cryptogramSolutionOnlyAnswers
    ? puzzle.originalText
    : showSolution
      ? puzzle.originalText
      : puzzle.encodedText;
  addCenteredText(
    slide,
    text,
    slot,
    {
      fontSize: fontPt,
      fontFace: face,
      color,
      align: 'left',
      valign: 'top',
    }
  );
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
      metrics.scrambleFontPt
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

  const slide = prs.addSlide();
  await applyFlattenedBackgroundToSlide(slide, bgConfig, backgroundCache, hex6);
  addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    pageColors.backgroundColor
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
      layout.subtitle.text,
      rectInFromPt(layout.subtitleBox),
      {
        fontSize: layout.subtitle.fontSizePt,
        fontFace: layout.subtitle.fontFamily,
        color: layout.subtitle.color,
        align: layout.subtitle.align,
      }
    );
  }

  const metrics = {
    crosswordCellPt: layout.crosswordCellPt,
    genericCellPt: layout.genericCellPt,
    mazeFramePt: layout.mazeFramePt,
    scrambleFontPt: layout.scrambleFit?.fontSizePt,
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
}
