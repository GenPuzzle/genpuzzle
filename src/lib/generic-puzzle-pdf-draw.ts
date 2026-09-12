/**
 * Native pdf-lib drawing for crossword / sudoku / maze / scramble / trivia / cryptogram.
 * Text, grid lines, walls, and shapes — never a full-page content raster.
 * Page art is painted as the page background layer, then vector content on top.
 */

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  rgb,
  LineCapStyle,
  LineJoinStyle,
  type RGB,
} from 'pdf-lib';
import type { CompiledPage } from './book-compiler';
import { getTitleWordsForDocument } from './book-compiler';
import type { DocumentPage } from './document-model';
import {
  getDefaultGenericPuzzleSettings,
  isGenericPuzzleModuleType,
  normalizeGenericPuzzleSettings,
  type GenericPuzzleSettings,
} from './generic-puzzle-settings';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  INTERIOR_LIGHT_GREY_FILL,
  type CrosswordSettings,
} from './crossword-settings';

import { computeGenericPageLayout, type GenericTitleStyle, type RectPt } from './generic-puzzle-page-layout';
import {
  crosswordCells,
  crosswordLetterFontPt,
  crosswordNumberFontPt,
  fitUniformGrid,
  layoutMaze,
  mazeArrowPoints,
  mazeDashArray,
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
import { drawHeaderAssemblyOnPdfPageNative } from './header-assembly-pdf-draw';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import { resolveGenericPageSurfaceColors } from './generic-page-chrome';
import { cssPxToPoints } from './puzzle-layout';
import { parseRgba } from './color-utils';
import { computeCrosswordPuzzleBodyLayout } from './crossword-puzzle-page-layout';
import {
  FlattenedBackgroundPdfCache,
  drawFlattenedBackgroundOnPdfPage,
  puzzlePageBackgroundConfig,
  shouldUseFlattenedExport,
  type PageBackgroundConfig,
} from './unified-background';
import { resolvePageFrameSettings, type PageFrameSettings } from './page-frame-settings';
import {
  buildPageFrameRoundedRectSvgPath,
  clampCornerRadius,
  pageFrameCornerRadiusPt,
} from './page-frame-geometry';
import {
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLabel,
  computeTriviaSolutionColumns,
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

type GetFont = (family: string, bold?: boolean | string | number) => Promise<PDFFont>;

function pdfColor(hex: string | undefined, fallback = '#000000'): RGB {
  const c = parseRgba(hex, fallback);
  return rgb(c.r / 255, c.g / 255, c.b / 255);
}

function pdfY(pageHeightPt: number, topPt: number, heightPt = 0): number {
  return pageHeightPt - topPt - heightPt;
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    const w = font.widthOfTextAtSize(next, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawTextBox(
  page: PDFPage,
  pageHeightPt: number,
  text: string,
  box: RectPt,
  font: PDFFont,
  size: number,
  color: RGB,
  align: 'left' | 'center' | 'right' = 'left',
  valign: 'top' | 'middle' = 'top'
): void {
  if (!text) return;
  const width = font.widthOfTextAtSize(text, size);
  let x = box.leftPt;
  if (align === 'center') x = box.leftPt + Math.max(0, (box.widthPt - width) / 2);
  if (align === 'right') x = box.leftPt + Math.max(0, box.widthPt - width);
  const cap = size * 0.72;
  const y =
    valign === 'middle'
      ? pdfY(pageHeightPt, box.topPt, box.heightPt) + (box.heightPt - cap) / 2
      : pdfY(pageHeightPt, box.topPt) - size * 0.9;
  page.drawText(text, { x, y, size, font, color });
}

function drawTitle(
  page: PDFPage,
  pageHeightPt: number,
  style: GenericTitleStyle,
  box: RectPt,
  font: PDFFont
): void {
  drawTextBox(
    page,
    pageHeightPt,
    style.text,
    box,
    font,
    style.fontSizePt,
    pdfColor(style.color, '#111111'),
    style.align,
    'middle'
  );
}

async function paintBackground(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageWidthPt: number,
  pageHeightPt: number,
  config: PageBackgroundConfig,
  cache: FlattenedBackgroundPdfCache
): Promise<void> {
  const fill = pdfColor(config.backgroundColor, '#ffffff');
  if (shouldUseFlattenedExport(config)) {
    const embedded = await cache.getOrEmbed(pdfDoc, config);
    if (embedded) {
      if (embedded.result.hasTransparentInner) {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidthPt,
          height: pageHeightPt,
          color: fill,
        });
      }
      drawFlattenedBackgroundOnPdfPage(page, embedded.image, pageWidthPt, pageHeightPt);
      return;
    }
  }
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidthPt,
    height: pageHeightPt,
    color: fill,
  });
}

/** Inner rounded fill so page color shows inside the frame (canvas overlay / word-search PDF). */
function paintInnerFrameFill(
  page: PDFPage,
  pageWidthPt: number,
  pageHeightPt: number,
  frame: PageFrameSettings,
  fillColor: RGB
): void {
  if (!frame.enabled) return;
  const marginPt = frame.marginSizeIn * 72;
  const x = marginPt;
  const y = marginPt;
  const width = pageWidthPt - marginPt * 2;
  const height = pageHeightPt - marginPt * 2;
  if (width <= 0 || height <= 0) return;
  const r = clampCornerRadius(pageFrameCornerRadiusPt(frame.cornerRadiusPx), width, height);
  if (r >= 0.1) {
    page.drawSvgPath(buildPageFrameRoundedRectSvgPath(x, y, width, height, r), {
      color: fillColor,
    });
  } else {
    page.drawRectangle({ x, y, width, height, color: fillColor });
  }
}

function paintFrame(
  page: PDFPage,
  pageWidthPt: number,
  pageHeightPt: number,
  frame: PageFrameSettings
): void {
  if (!frame.enabled) return;
  const marginPt = frame.marginSizeIn * 72;
  const strokePt = cssPxToPoints(frame.strokeThicknessPx);
  const halfStroke = strokePt / 2;
  const x = marginPt + halfStroke;
  const y = marginPt + halfStroke;
  const width = pageWidthPt - marginPt * 2 - strokePt;
  const height = pageHeightPt - marginPt * 2 - strokePt;
  if (width <= 0 || height <= 0) return;
  const radiusPt = pageFrameCornerRadiusPt(frame.cornerRadiusPx);
  const strokeColor = pdfColor(frame.borderColor, '#1f2937');
  const r = clampCornerRadius(radiusPt, width, height);
  if (r >= 0.1) {
    page.drawSvgPath(buildPageFrameRoundedRectSvgPath(x, y, width, height, r), {
      borderColor: strokeColor,
      borderWidth: strokePt,
      borderOpacity: 1,
    });
  } else {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderColor: strokeColor,
      borderWidth: strokePt,
    });
  }
}

function drawPdfLine(
  page: PDFPage,
  pageHeightPt: number,
  x1: number,
  y1Top: number,
  x2: number,
  y2Top: number,
  color: RGB,
  thickness: number,
  dash?: number[]
): void {
  page.drawLine({
    start: { x: x1, y: pdfY(pageHeightPt, y1Top) },
    end: { x: x2, y: pdfY(pageHeightPt, y2Top) },
    thickness,
    color,
    lineCap: LineCapStyle.Round,
    lineJoin: LineJoinStyle.Round,
    ...(dash ? { dashArray: dash } : {}),
  });
}

function mazeCenterPt(
  layout: ReturnType<typeof layoutMaze>,
  col: number,
  row: number
): { xPt: number; yPt: number } {
  return {
    xPt: layout.leftPt + layout.offsetXPt + (col + 0.5) * layout.cellWPt,
    yPt: layout.topPt + layout.offsetYPt + (row + 0.5) * layout.cellHPt,
  };
}

function drawSudokuPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: SudokuPuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const size = sudokuSizeOf(puzzle);
  const calcudoku = isCalcudokuPuzzle(puzzle);
  const { boxH, boxW } = calcudoku ? { boxH: size, boxW: size } : sudokuBoxOf(size);
  const display = showSolution ? puzzle.solution : puzzle.grid;
  const color = pdfColor(gp.colors.gridColor, '#1f2937');
  const thinColor = pdfColor('#d1d5db');
  const thicknessPct = showSolution
    ? gp.core.sudokuSolutionLineThickness ?? 100
    : gp.core.sudokuPuzzleLineThickness ?? 100;
  const { thinPt, thickPt, outerPt } = sudokuLineScale(thicknessPct);
  const fontPt = showSolution ? gp.typography.answerFontSize ?? 16 : gp.typography.puzzleFontSize ?? 14;
  const placement = showSolution
    ? 'none'
    : gp.core.sudokuDifficultyPlacement ?? (gp.core.showDifficultyLabel === false ? 'none' : 'bottom');
  const labelH = placement === 'none' ? 0 : Math.max(10, preferredCellPt * 0.34);
  const gridSlot: RectPt = {
    ...slot,
    topPt: placement === 'top' ? slot.topPt + labelH : slot.topPt,
    heightPt: slot.heightPt - labelH,
  };
  const grid = fitUniformGrid(size, size, preferredCellPt, gridSlot);
  const digitPt = grid.cellPt * sudokuDigitFillRatio(fontPt);

  if (placement === 'top' || placement === 'bottom') {
    const labelTop = placement === 'top' ? slot.topPt : grid.topPt + grid.heightPt + 4;
    drawTextBox(
      page,
      pageHeightPt,
      `Difficulty: ${puzzle.difficulty ?? ''}`,
      { leftPt: slot.leftPt, topPt: labelTop, widthPt: slot.widthPt, heightPt: labelH },
      font,
      Math.max(8, Math.min(digitPt * 0.7, grid.cellPt * 0.34)),
      pdfColor('#4b5563'),
      'center',
      'middle'
    );
  }

  page.drawRectangle({
    x: grid.leftPt,
    y: pdfY(pageHeightPt, grid.topPt, grid.heightPt),
    width: grid.widthPt,
    height: grid.heightPt,
    color: rgb(1, 1, 1),
    borderColor: color,
    borderWidth: outerPt,
  });

  if (calcudoku) {
    const cageIds = buildCalcudokuCageIdGrid(size, puzzle.cages);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const right = calcudokuInternalBorder(cageIds, r, c, 'right');
        if (right !== 'none') {
          const x = grid.leftPt + (c + 1) * grid.cellPt;
          drawPdfLine(
            page,
            pageHeightPt,
            x,
            grid.topPt + r * grid.cellPt,
            x,
            grid.topPt + (r + 1) * grid.cellPt,
            right === 'thick' ? color : thinColor,
            right === 'thick' ? thickPt : thinPt
          );
        }
        const bottom = calcudokuInternalBorder(cageIds, r, c, 'bottom');
        if (bottom !== 'none') {
          const y = grid.topPt + (r + 1) * grid.cellPt;
          drawPdfLine(
            page,
            pageHeightPt,
            grid.leftPt + c * grid.cellPt,
            y,
            grid.leftPt + (c + 1) * grid.cellPt,
            y,
            bottom === 'thick' ? color : thinColor,
            bottom === 'thick' ? thickPt : thinPt
          );
        }
      }
    }
    for (const cage of puzzle.cages) {
      const cell = calcudokuLabelCell(cage);
      const text = calcudokuCageLabel(cage);
      const cageLabelPt = Math.max(
        5,
        Math.min(grid.cellPt * 0.26, (grid.cellPt * 0.86) / Math.max(2, text.length))
      );
      drawTextBox(
        page,
        pageHeightPt,
        text,
        {
          leftPt: grid.leftPt + cell.col * grid.cellPt + Math.max(1.2, grid.cellPt * 0.05),
          topPt: grid.topPt + cell.row * grid.cellPt + Math.max(0.8, grid.cellPt * 0.03),
          widthPt: grid.cellPt * 0.92,
          heightPt: cageLabelPt + 2,
        },
        font,
        cageLabelPt,
        color,
        'left',
        'top'
      );
    }
  } else {
    for (let i = 1; i < size; i++) {
      const isBox = i % boxW === 0;
      drawPdfLine(
        page,
        pageHeightPt,
        grid.leftPt + i * grid.cellPt,
        grid.topPt,
        grid.leftPt + i * grid.cellPt,
        grid.topPt + grid.heightPt,
        isBox ? color : thinColor,
        isBox ? thickPt : thinPt
      );
    }
    for (let i = 1; i < size; i++) {
      const isBox = i % boxH === 0;
      drawPdfLine(
        page,
        pageHeightPt,
        grid.leftPt,
        grid.topPt + i * grid.cellPt,
        grid.leftPt + grid.widthPt,
        grid.topPt + i * grid.cellPt,
        isBox ? color : thinColor,
        isBox ? thickPt : thinPt
      );
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const glyph = formatSudokuSymbol(display[r]?.[c] ?? 0);
      if (!glyph) continue;
      drawTextBox(
        page,
        pageHeightPt,
        glyph,
        {
          leftPt: grid.leftPt + c * grid.cellPt,
          topPt: grid.topPt + r * grid.cellPt,
          widthPt: grid.cellPt,
          heightPt: grid.cellPt,
        },
        font,
        digitPt,
        color,
        'center',
        'middle'
      );
    }
  }
}

function drawMazePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: MazePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  framePt: number | null
): void {
  const layout = layoutMaze(puzzle, slot, preferredCellPt, framePt);
  const wallColor = pdfColor(gp.colors.gridColor, '#1f2937');
  const pathColor = pdfColor(gp.colors.solutionPathColor, '#e11d48');
  const wallPt = mazeWallThicknessPt(layout, gp.core.mazeWallThickness ?? 45);
  const pathPt = mazePathThicknessPt(layout, gp.core.mazeSolutionPathThickness ?? 34);
  for (const seg of mazeWallSegments(puzzle, layout)) {
    drawPdfLine(page, pageHeightPt, seg.x1, seg.y1, seg.x2, seg.y2, wallColor, wallPt);
  }
  if (showSolution) {
    const pts = mazePathPoints(puzzle, layout, true);
    const dash = mazeDashArray(gp.core.mazeSolutionPathStyle, pathPt);
    for (let i = 0; i < pts.length - 1; i++) {
      drawPdfLine(
        page,
        pageHeightPt,
        pts[i].xPt,
        pts[i].yPt,
        pts[i + 1].xPt,
        pts[i + 1].yPt,
        pathColor,
        pathPt,
        dash
      );
    }
  }

  const markerStyle = gp.core.mazeMarkerStyle ?? 'arrow';
  const start = mazeCenterPt(layout, puzzle.start.col, puzzle.start.row);
  const end = mazeCenterPt(layout, puzzle.end.col, puzzle.end.row);
  const cell = Math.min(layout.cellWPt, layout.cellHPt);
  const dir = mazeStartDir(puzzle);
  if (markerStyle === 'point') {
    page.drawCircle({
      x: start.xPt,
      y: pdfY(pageHeightPt, start.yPt),
      size: Math.max(2, cell * 0.32),
      color: pdfColor('#111111'),
    });
  } else {
    const pts = mazeArrowPoints(start.xPt, start.yPt, cell, dir);
    const path =
      pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${-pdfY(pageHeightPt, p.y)}`).join(' ') + ' Z';
    page.drawSvgPath(path, { color: pdfColor('#111111') });
  }
  page.drawCircle({
    x: end.xPt,
    y: pdfY(pageHeightPt, end.yPt),
    size: Math.max(2, cell * 0.32),
    color: pdfColor('#111111'),
  });
}

function drawCrosswordPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: CrosswordPuzzle,
  slot: RectPt,
  cw: CrosswordSettings,
  showSolution: boolean,
  preferredCellPt: number,
  clueGapPt: number,
  hideClues: boolean,
  letterFont: PDFFont,
  clueFont: PDFFont,
  numberFont: PDFFont,
  pageNumberZoneTopPt: number
): void {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const showClues = !showSolution && !hideClues;
  const showAnswerKey = showSolution && cw.typography.showAnswerKey !== false;
  const lockGeometry = showClues;
  const body = lockGeometry
    ? computeCrosswordPuzzleBodyLayout({
        puzzle,
        cw,
        slot,
        preferredCellPt,
        clueGapPt,
        pageNumberZoneTopPt,
        measureLineCount: (text, fontSize, colWidth) =>
          Math.max(1, wrapText(clueFont, text, fontSize, colWidth).length),
      })
    : null;
  const gridSlot: RectPt = lockGeometry
    ? slot
    : {
        leftPt: slot.leftPt,
        topPt: slot.topPt,
        widthPt: slot.widthPt,
        heightPt: slot.heightPt * (showAnswerKey ? 0.78 : 1),
      };
  const grid = body
    ? body.grid
    : fitUniformGrid(cols, rows, preferredCellPt, gridSlot);
  const cells = crosswordCells(puzzle, grid, cw, showSolution);
  const linePt = Math.max(0.4, cssPxToPoints(cw.colors.lineThicknessPx || 1));
  const lineColor = pdfColor(cw.colors.lineColor, '#cccccc');
  const letterColor = pdfColor(showSolution ? cw.colors.answersColor : cw.colors.hintLettersColor, '#333333');
  const numberColor = pdfColor(cw.colors.numbersColor, '#333333');
  const letterPt = crosswordLetterFontPt(cw, grid.cellPt);
  const numberPt = crosswordNumberFontPt(cw, grid.cellPt, showSolution);

  for (const cell of cells) {
    const x = cell.leftPt;
    const y = pdfY(pageHeightPt, cell.topPt, cell.sizePt);
    if (cell.isBlack) {
      if (cell.fill) {
        const isInteriorLightGrey = cell.fill === INTERIOR_LIGHT_GREY_FILL;
        page.drawRectangle({
          x,
          y,
          width: cell.sizePt,
          height: cell.sizePt,
          color: pdfColor(cell.fill),
          borderColor: isInteriorLightGrey ? lineColor : pdfColor(cell.fill),
          borderWidth: linePt,
        });
      }
      continue;
    }
    page.drawRectangle({
      x,
      y,
      width: cell.sizePt,
      height: cell.sizePt,
      color: pdfColor(cell.fill || '#ffffff'),
      borderColor: lineColor,
      borderWidth: linePt,
    });
    if (cell.clueNumber != null) {
      drawTextBox(
        page,
        pageHeightPt,
        String(cell.clueNumber),
        {
          leftPt: cell.leftPt + cell.sizePt * 0.06,
          topPt: cell.topPt + cell.sizePt * 0.04,
          widthPt: cell.sizePt * 0.5,
          heightPt: cell.sizePt * 0.32,
        },
        numberFont,
        numberPt,
        numberColor,
        'left',
        'top'
      );
    }
    if (cell.letter) {
      drawTextBox(
        page,
        pageHeightPt,
        cell.letter,
        {
          leftPt: cell.leftPt,
          topPt: cell.topPt + cell.sizePt * 0.12,
          widthPt: cell.sizePt,
          heightPt: cell.sizePt * 0.82,
        },
        letterFont,
        letterPt,
        letterColor,
        'center',
        'middle'
      );
    }
  }

  const restTop = grid.topPt + grid.heightPt + Math.max(6, clueGapPt * 0.5);
  const restH = Math.max(16, slot.topPt + slot.heightPt - restTop);
  const rest: RectPt = body?.cluesRect ?? {
    leftPt: slot.leftPt,
    topPt: restTop,
    widthPt: slot.widthPt,
    heightPt: restH,
  };
  const clueColor = pdfColor(cw.colors.cluesColor, '#333333');

  if (showClues) {
    const columns = body?.columns ?? (cw.typography.clueLayout === 'single' ? 1 : 2);
    const gap = body?.spacing.columnGap ?? cssPxToPoints(cw.typography.clueSpaceHorizontal ?? 24);
    const colW = (rest.widthPt - (columns === 2 ? gap : 0)) / columns;
    const headingPt = body?.headingFontSize ?? cssPxToPoints(cw.typography.acrossDownFontSize || cw.typography.clueFontSize + 2);
    const cluePt = body?.clueFontSize ?? cssPxToPoints(cw.typography.clueFontSize || 12);
    const vGap = body?.spacing.itemGap ?? cssPxToPoints(cw.typography.clueSpaceVertical ?? 4);
    const lineFactor = body?.spacing.lineHeightFactor ?? 1.25;
    const headingAfter = body?.spacing.headingAfter ?? cssPxToPoints(8);
    const sectionGap = body?.spacing.sectionGap ?? cssPxToPoints(14);
    const clueBottomLimit = rest.topPt + rest.heightPt;
    const groups = [
      { title: 'ACROSS', clues: puzzle.acrossClues },
      { title: 'DOWN', clues: puzzle.downClues },
    ];
    let stackedY = rest.topPt;
    groups.forEach((group, gi) => {
      const colIndex = columns === 2 ? gi : 0;
      let yTop =
        columns === 2
          ? rest.topPt
          : gi === 0
            ? rest.topPt
            : stackedY + sectionGap;
      const x = rest.leftPt + colIndex * (colW + (columns === 2 ? gap : 0));
      const w = columns === 1 ? rest.widthPt : colW;
      if (yTop + headingPt > clueBottomLimit) return;
      drawTextBox(
        page,
        pageHeightPt,
        group.title,
        { leftPt: x, topPt: yTop, widthPt: w, heightPt: headingPt * 1.35 },
        numberFont,
        headingPt,
        clueColor,
        'left',
        'top'
      );
      yTop += headingPt * 1.35 + headingAfter;
      for (const clue of group.clues) {
        const lines = wrapText(clueFont, `${clue.number}. ${clue.clue}`, cluePt, w);
        const blockH = Math.max(1, lines.length) * cluePt * lineFactor;
        if (yTop + blockH > clueBottomLimit) return;
        const numPrefix = `${clue.number}. `;
        const numWidth = numberFont.widthOfTextAtSize(numPrefix, cluePt);
        for (let li = 0; li < lines.length; li++) {
          if (li === 0) {
            drawTextBox(
              page,
              pageHeightPt,
              numPrefix,
              {
                leftPt: x,
                topPt: yTop,
                widthPt: numWidth + 2,
                heightPt: cluePt * lineFactor,
              },
              numberFont,
              cluePt,
              numberColor,
              'left',
              'top'
            );
            const restText = lines[0].startsWith(numPrefix)
              ? lines[0].slice(numPrefix.length)
              : lines[0];
            if (restText) {
              drawTextBox(
                page,
                pageHeightPt,
                restText,
                {
                  leftPt: x + numWidth,
                  topPt: yTop,
                  widthPt: Math.max(1, w - numWidth),
                  heightPt: cluePt * lineFactor,
                },
                clueFont,
                cluePt,
                clueColor,
                'left',
                'top'
              );
            }
          } else {
            drawTextBox(
              page,
              pageHeightPt,
              lines[li],
              {
                leftPt: x,
                topPt: yTop + li * cluePt * lineFactor,
                widthPt: w,
                heightPt: cluePt * lineFactor,
              },
              clueFont,
              cluePt,
              clueColor,
              'left',
              'top'
            );
          }
        }
        yTop += blockH + vGap;
      }
      if (columns === 1) stackedY = yTop;
    });
    return;
  }

  if (showAnswerKey) {
    const formatAnswer = (answer: string) => {
      if (cw.core.answerCase === 'lower') return answer.toLowerCase();
      if (cw.core.answerCase === 'original') return answer;
      return answer.toUpperCase();
    };
    const keyPt = cssPxToPoints(cw.typography.answerKeyFontSize ?? 11);
    const across = puzzle.acrossClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
    const down = puzzle.downClues.map((c) => `${c.number}.${formatAnswer(c.answer)}`).join('  ');
    drawTextBox(
      page,
      pageHeightPt,
      `Across  ${across}`,
      { leftPt: grid.leftPt, topPt: rest.topPt, widthPt: grid.widthPt, heightPt: restH * 0.45 },
      clueFont,
      keyPt,
      clueColor,
      'left',
      'top'
    );
    drawTextBox(
      page,
      pageHeightPt,
      `Down  ${down}`,
      {
        leftPt: grid.leftPt,
        topPt: rest.topPt + restH * 0.48,
        widthPt: grid.widthPt,
        heightPt: restH * 0.45,
      },
      clueFont,
      keyPt,
      clueColor,
      'left',
      'top'
    );
  }
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

function drawScramblePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: WordScramblePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont,
  fontSizePt: number,
  wordGapPt: number,
  letterEm: number
): void {
  const words = scrambleWords(puzzle);
  const color = pdfColor(gp.colors.gridColor, '#1f2937');
  const letterCase = gp.core.letterCase === 'lower' ? 'lower' : 'upper';
  const applyCase = (v: string) => (letterCase === 'lower' ? v.toLowerCase() : v.toUpperCase());
  const style = gp.core.answerBlankStyle ?? 'underline';
  const lineH = fontSizePt * (style === 'boxes' ? 1.5 : 1.32) + wordGapPt;
  const scrambleBlankGap = Math.max(3, fontSizePt * 0.28);

  words.forEach((word, i) => {
    const yTop = slot.topPt + i * lineH;
    if (yTop + fontSizePt > slot.topPt + slot.heightPt + 2) return;
    const scrambled = applyCase(word.scrambled);
    const original = applyCase(word.original);
    const prefix = `${i + 1}.  `;
    const prefixW = font.widthOfTextAtSize(prefix, fontSizePt);
    drawTextBox(
      page,
      pageHeightPt,
      prefix,
      { leftPt: slot.leftPt, topPt: yTop, widthPt: prefixW + 4, heightPt: fontSizePt * 1.3 },
      font,
      fontSizePt,
      color,
      'left',
      'top'
    );
    let x = slot.leftPt + prefixW;
    drawTextBox(
      page,
      pageHeightPt,
      scrambled,
      { leftPt: x, topPt: yTop, widthPt: slot.widthPt * 0.45, heightPt: fontSizePt * 1.3 },
      font,
      fontSizePt,
      color,
      'left',
      'top'
    );
    x +=
      font.widthOfTextAtSize(scrambled, fontSizePt) +
      fontSizePt * letterEm * scrambled.length * 0.15 +
      scrambleBlankGap;
    if ((gp.core.afterScrambled ?? 'equal') === 'equal') {
      drawTextBox(
        page,
        pageHeightPt,
        '=',
        { leftPt: x, topPt: yTop, widthPt: fontSizePt, heightPt: fontSizePt * 1.3 },
        font,
        fontSizePt,
        color,
        'left',
        'top'
      );
      x += fontSizePt * 0.9;
    }
    if (showSolution) {
      drawTextBox(
        page,
        pageHeightPt,
        original,
        { leftPt: x, topPt: yTop, widthPt: slot.widthPt - (x - slot.leftPt), heightPt: fontSizePt * 1.3 },
        font,
        fontSizePt,
        color,
        'left',
        'top'
      );
      return;
    }
    const letters = word.original.replace(/[\s-]/g, '').split('');
    if (style === 'boxes') {
      const box = Math.max(8, fontSizePt * 1.1);
      const gap = Math.max(1, letterEm * fontSizePt);
      letters.forEach((_, li) => {
        page.drawRectangle({
          x: x + li * (box + gap),
          y: pdfY(pageHeightPt, yTop, box),
          width: box,
          height: box,
          borderColor: color,
          borderWidth: 1.1,
        });
      });
      return;
    }
    const blank =
      style === 'blank'
        ? ' '
        : style === 'dash'
          ? Array.from({ length: Math.max(4, letters.length) }, () => '-').join(' ')
          : '_'.repeat(Math.max(4, letters.length));
    drawTextBox(
      page,
      pageHeightPt,
      blank,
      { leftPt: x, topPt: yTop, widthPt: slot.widthPt - (x - slot.leftPt), heightPt: fontSizePt * 1.3 },
      font,
      fontSizePt,
      color,
      'left',
      'top'
    );
  });

  if (!showSolution && gp.core.includeWordBank) {
    const bank = [...words.map((w) => applyCase(w.original))].sort((a, b) => a.localeCompare(b));
    const bankTop = slot.topPt + words.length * lineH + Math.max(8, wordGapPt * 1.5);
    drawTextBox(
      page,
      pageHeightPt,
      gp.core.wordBankTitle || 'Word Bank',
      { leftPt: slot.leftPt, topPt: bankTop, widthPt: slot.widthPt, heightPt: fontSizePt },
      font,
      Math.max(8, fontSizePt * 0.9),
      color,
      'center',
      'top'
    );
    const colW = slot.widthPt / 3;
    bank.forEach((w, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      drawTextBox(
        page,
        pageHeightPt,
        w,
        {
          leftPt: slot.leftPt + col * colW,
          topPt: bankTop + fontSizePt * 1.2 + row * fontSizePt * 1.15,
          widthPt: colW,
          heightPt: fontSizePt,
        },
        font,
        Math.max(7, fontSizePt * 0.75),
        color,
        'center',
        'top'
      );
    });
  }
}

function drawTriviaPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzles: TriviaPuzzle[],
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont,
  boldFont: PDFFont
): void {
  const fontPt = showSolution ? gp.typography.answerFontSize ?? 12 : gp.typography.puzzleFontSize ?? 12;
  const color = pdfColor(gp.colors.gridColor, '#1f2937');
  const optionPt = Math.max(8, fontPt * 0.95);

  if (showSolution) {
    const cols = computeTriviaSolutionColumns(gp.core.triviaSolutionColumns);
    const colW = slot.widthPt / cols;
    let y = slot.topPt;
    puzzles.forEach((p, pi) => {
      const heading = formatTriviaSolutionHeading(p, pi, gp.core.puzzlesStartingNumber);
      const answers = (p.questions ?? []).map((q, qi) => `${qi + 1}. ${resolveTriviaAnswerLabel(q)}`);
      const rowsPerCol = Math.max(1, Math.ceil(answers.length / cols));
      drawTextBox(
        page,
        pageHeightPt,
        heading,
        { leftPt: slot.leftPt, topPt: y, widthPt: slot.widthPt, heightPt: fontPt * 1.4 },
        boldFont,
        fontPt,
        color,
        'left',
        'top'
      );
      y += fontPt * 1.5;
      for (let c = 0; c < cols; c++) {
        const chunk = answers.slice(c * rowsPerCol, (c + 1) * rowsPerCol);
        chunk.forEach((line, ri) => {
          drawTextBox(
            page,
            pageHeightPt,
            line,
            {
              leftPt: slot.leftPt + c * colW,
              topPt: y + ri * fontPt * 1.28,
              widthPt: colW - 6,
              heightPt: fontPt * 1.2,
            },
            font,
            optionPt,
            color,
            'left',
            'top'
          );
        });
      }
      y += rowsPerCol * fontPt * 1.28 + Math.max(6, fontPt * 0.8);
    });
    return;
  }

  const puzzle = puzzles[0];
  const questions = puzzle?.questions ?? [];
  const twoCol = gp.core.triviaLayoutFormat === 'two-column';
  const colCount = twoCol ? 2 : 1;
  const colW = slot.widthPt / colCount;
  const sGap = gp.typography.triviaSpaceBetweenSuggestions ?? 6;
  const afterQ = gp.typography.triviaSpaceAfterQuestion ?? 8;
  const box = Math.max(8, fontPt * 0.85);
  questions.forEach((q, qi) => {
    const col = twoCol ? qi % 2 : 0;
    const row = twoCol ? Math.floor(qi / 2) : qi;
    const blockH = slot.heightPt / Math.max(1, Math.ceil(questions.length / colCount));
    const x = slot.leftPt + col * colW;
    const y = slot.topPt + row * blockH;
    const promptLines = wrapText(boldFont, `${qi + 1}. ${q.prompt}`, fontPt, colW - 8);
    let ty = y;
    promptLines.forEach((line) => {
      drawTextBox(
        page,
        pageHeightPt,
        line,
        { leftPt: x, topPt: ty, widthPt: colW - 8, heightPt: fontPt * 1.25 },
        boldFont,
        fontPt,
        color,
        'left',
        'top'
      );
      ty += fontPt * 1.25;
    });
    ty += afterQ * 0.75;
    (q.suggestions ?? []).forEach((sug) => {
      if (gp.core.triviaCheckboxStyle === 'circle') {
        page.drawCircle({
          x: x + box / 2,
          y: pdfY(pageHeightPt, ty + box / 2),
          size: box / 2,
          borderColor: pdfColor('#9ca3af'),
          borderWidth: 1.1,
        });
      } else {
        page.drawRectangle({
          x,
          y: pdfY(pageHeightPt, ty, box),
          width: box,
          height: box,
          borderColor: pdfColor('#9ca3af'),
          borderWidth: 1.1,
        });
      }
      drawTextBox(
        page,
        pageHeightPt,
        sug,
        { leftPt: x + box + 6, topPt: ty, widthPt: colW - box - 14, heightPt: optionPt * 1.25 },
        font,
        optionPt,
        color,
        'left',
        'top'
      );
      ty += optionPt * 1.25 + sGap * 0.75;
    });
  });
}

function drawCryptogramPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: { encodedText?: string; originalText?: string },
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  font: PDFFont
): void {
  const fontPt = showSolution ? gp.typography.answerFontSize ?? 14 : gp.typography.puzzleFontSize ?? 14;
  const color = pdfColor(gp.colors.gridColor, '#1f2937');
  const text = showSolution ? puzzle.originalText || '' : puzzle.encodedText || '';
  const lines = wrapText(font, text, fontPt, slot.widthPt);
  const gap = gp.typography.spaceBetweenPuzzleLines ?? 10;
  lines.forEach((line, i) => {
    drawTextBox(
      page,
      pageHeightPt,
      line,
      {
        leftPt: slot.leftPt,
        topPt: slot.topPt + i * (fontPt + gap),
        widthPt: slot.widthPt,
        heightPt: fontPt * 1.3,
      },
      font,
      fontPt,
      color,
      'left',
      'top'
    );
  });
}

export async function addNativeGenericOrCrosswordPdfPage(
  pdfDoc: PDFDocument,
  compiledPage: CompiledPage,
  layoutSettings: WordSearchSettings,
  documentPages: DocumentPage[],
  titleWords: TitleWordsSettings,
  backgroundCache: FlattenedBackgroundPdfCache,
  getOrEmbedFont: GetFont,
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
    kind === 'crossword' || kind === 'crossword-solution' ? 'crossword' : compiledPage.puzzleType;
  const puzzles: unknown[] = kind === 'crossword' ? [compiledPage.puzzle] : compiledPage.puzzles;
  const first = puzzles[0] as { puzzleIndexInDocument?: number } | undefined;
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

  const layout = computeGenericPageLayout({
    puzzleType,
    showSolution,
    layoutSettings,
    titleWords: getTitleWordsForDocument(documentPages, compiledPage.sourceDocumentId, titleWords),
    puzzleIndex,
    puzzles: puzzles as Parameters<typeof computeGenericPageLayout>[0]['puzzles'],
    cw,
    gp,
  });

  const page = pdfDoc.addPage([layout.pageWidthPt, layout.pageHeightPt]);
  const pageColors = resolveGenericPageSurfaceColors(
    layoutSettings,
    showSolution,
    cw?.colors.backgroundColor ?? gp?.colors.backgroundColor
  );
  const pageFrame = resolvePageFrameSettings(layoutSettings);
  const bgConfig = puzzlePageBackgroundConfig(
    layout.pageWidthPt,
    layout.pageHeightPt,
    pageColors,
    pageFrame.cornerRadiusPx,
    {
      frameEnabled: pageFrame.enabled,
      frameMarginIn: pageFrame.marginSizeIn,
    }
  );
  await paintBackground(pdfDoc, page, layout.pageWidthPt, layout.pageHeightPt, bgConfig, backgroundCache);
  if (pageFrame.enabled) {
    paintInnerFrameFill(
      page,
      layout.pageWidthPt,
      layout.pageHeightPt,
      pageFrame,
      pdfColor(pageColors.backgroundColor, '#ffffff')
    );
  }

  const titleFont = await getOrEmbedFont(layout.titleFontFamily || 'Arial', true);
  const bodyFamily =
    (showSolution ? gp?.typography.answerFontFamily : gp?.typography.puzzleFontFamily) ||
    gp?.typography.puzzleFontFamily ||
    cw?.typography.clueFontFamily ||
    'Arial';
  const bodyFont = await getOrEmbedFont(bodyFamily, false);
  const bodyBold = await getOrEmbedFont(bodyFamily, true);
  const numberFont = await getOrEmbedFont(cw?.typography.numberFontFamily || bodyFamily, false);
  const clueFont = await getOrEmbedFont(cw?.typography.clueFontFamily || bodyFamily, false);

  if (layout.header) {
    drawHeaderAssemblyOnPdfPageNative(page, layout.pageHeightPt, layout.header, titleFont, (hex) =>
      pdfColor(hex, '#111111')
    );
  }
  if (layout.pageTitle && layout.pageTitleBox) {
    drawTitle(page, layout.pageHeightPt, layout.pageTitle, layout.pageTitleBox, titleFont);
  }
  if (layout.subtitle && layout.subtitleBox) {
    const subFont = await getOrEmbedFont(layout.subtitle.fontFamily, false);
    drawTitle(page, layout.pageHeightPt, layout.subtitle, layout.subtitleBox, subFont);
  }

  const hideClues = layout.multi || showSolution;
  for (const slot of layout.slots) {
    if (slot.title && slot.titleBox) {
      drawTitle(page, layout.pageHeightPt, slot.title, slot.titleBox, titleFont);
    }
    const puzzle = puzzles[slot.index];
    const content = slot.content;
    if (puzzleType === 'crossword' && cw) {
      drawCrosswordPdf(
        page,
        layout.pageHeightPt,
        puzzle as CrosswordPuzzle,
        content,
        cw,
        showSolution,
        layout.crosswordCellPt,
        layout.puzzleToCluesGapPt,
        hideClues,
        bodyBold,
        clueFont,
        numberFont,
        layout.pageNumberZoneTopPt
      );
    } else if (puzzleType === 'sudoku' && gp) {
      drawSudokuPdf(
        page,
        layout.pageHeightPt,
        puzzle as SudokuPuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'maze' && gp) {
      drawMazePdf(
        page,
        layout.pageHeightPt,
        puzzle as MazePuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        layout.mazeFramePt
      );
    } else if (puzzleType === 'word-scramble' && gp) {
      drawScramblePdf(
        page,
        layout.pageHeightPt,
        puzzle as WordScramblePuzzle,
        content,
        gp,
        showSolution,
        bodyFont,
        layout.scrambleFit?.fontSizePt ??
          (showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize) ??
          14,
        layout.scrambleFit?.wordGapPt ?? gp.typography.scrambleSpaceBetweenWords ?? 8,
        layout.scrambleFit?.letterEm ?? 0.12
      );
    } else if (puzzleType === 'trivia' && gp) {
      drawTriviaPdf(
        page,
        layout.pageHeightPt,
        (showSolution ? puzzles : [puzzle]) as TriviaPuzzle[],
        content,
        gp,
        showSolution,
        bodyFont,
        bodyBold
      );
    } else if (puzzleType === 'cryptogram' && gp) {
      drawCryptogramPdf(
        page,
        layout.pageHeightPt,
        puzzle as { encodedText?: string; originalText?: string },
        content,
        gp,
        showSolution,
        bodyFont
      );
    }
  }

  // Stroke last so puzzle fills cannot cover the container frame (word-search PDF).
  paintFrame(page, layout.pageWidthPt, layout.pageHeightPt, pageFrame);

  if (!suppressPageNumber) {
    const pageNumberFont = await getOrEmbedFont(
      layoutSettings.typography.pageNumber.fontFamily || 'Arial',
      true
    );
    await drawPageNumberOnPdfPage(
      pdfDoc,
      page,
      layout.pageWidthPt,
      layout.pageHeightPt,
      layoutSettings,
      compiledPage.bookPageIndex,
      pageNumberFont,
      (hex) => pdfColor(hex, '#111111')
    );
  }
}
