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
import { renderResolvedPdf } from './resolved-layout/render-pdf';
import {
  buildCrosswordElements,
  buildCryptogramElements,
  buildScrambleElements,
  buildTriviaElements,
} from './resolved-layout/book-elements';
import { buildMazeElements } from './resolved-layout/maze-elements';
import { prepareResolvedImagesForPrint } from './resolved-layout/print-image';
import { buildSudokuElements } from './resolved-layout/sudoku-elements';
import { buildCodewordsElements } from './resolved-layout/codewords-elements';
import { buildBinairoElements } from './resolved-layout/binairo-elements';
import { buildKakuroElements } from './resolved-layout/kakuro-elements';
import { buildMathMazeElements } from './resolved-layout/math-maze-elements';
import { buildFillElements } from './resolved-layout/fill-elements';
import { buildSnakeElements } from './resolved-layout/snake-elements';
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
  mazeWallRuns,
  mazeWallThicknessPt,
  sudokuDigitFillRatio,
  sudokuLineScale,
  sudokuSizeOf,
  sudokuBoxOf,
  formatSudokuSymbol,
} from './generic-puzzle-geometry';
import { drawHeaderAssemblyOnPdfPageNative } from './header-assembly-pdf-draw';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import {
  drawPageVariablesOnPdfPage,
  pageVariablesFromDocument,
  resolvePageVariableContext,
} from './page-variables-draw';
import { textVariableContextFromDocument } from './ai/text-variable-context';
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
  getPageFrameStrokeGeometry,
  pageFrameCornerRadiusPt,
} from './page-frame-geometry';
import {
  formatTriviaSolutionHeading,
  resolveTriviaAnswerLetter,
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
  const geometry = getPageFrameStrokeGeometry(pageWidthPt, pageHeightPt, frame);
  const { xPt: x, yPt: y, widthPt: width, heightPt: height, strokePt } = geometry;
  if (width <= 0 || height <= 0 || strokePt <= 0) return;

  const strokeColor = pdfColor(frame.borderColor, '#1f2937');
  const r = clampCornerRadius(geometry.radiusPt, width, height);

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

/** Capsule matching canvas round-cap maze walls (rect + end circles). */
function drawPdfStadium(
  page: PDFPage,
  pageHeightPt: number,
  x1: number,
  y1Top: number,
  x2: number,
  y2Top: number,
  color: RGB,
  thickness: number
): void {
  const half = Math.max(0.35, thickness / 2);
  const y1 = pdfY(pageHeightPt, y1Top);
  const y2 = pdfY(pageHeightPt, y2Top);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  page.drawCircle({ x: x1, y: y1, size: half, color });
  page.drawCircle({ x: x2, y: y2, size: half, color });
  if (len < 0.05) return;
  if (Math.abs(dy) <= Math.abs(dx) * 0.02) {
    page.drawRectangle({
      x: Math.min(x1, x2),
      y: (y1 + y2) / 2 - half,
      width: len,
      height: thickness,
      color,
    });
    return;
  }
  if (Math.abs(dx) <= Math.abs(dy) * 0.02) {
    page.drawRectangle({
      x: (x1 + x2) / 2 - half,
      y: Math.min(y1, y2),
      width: thickness,
      height: len,
      color,
    });
    return;
  }
  drawPdfLine(page, pageHeightPt, x1, y1Top, x2, y2Top, color, thickness);
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
  const elements = buildSudokuElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawCodewordsPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/codewords').CodewordPuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildCodewordsElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawBinairoPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/binairo').BinairoPuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildBinairoElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawKakuroPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/kakuro').KakuroPuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildKakuroElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawMathMazePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/math-maze').MathMazePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildMathMazeElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawFillPdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/fill').FillPuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildFillElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function drawSnakePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: import('./puzzles/snake').SnakePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  font: PDFFont
): void {
  const elements = buildSnakeElements({ puzzle, slot, gp, showSolution, preferredCellPt });
  renderResolvedPdf(page, pageHeightPt, elements, () => font);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function drawMazePdf(
  page: PDFPage,
  pageHeightPt: number,
  puzzle: MazePuzzle,
  slot: RectPt,
  gp: GenericPuzzleSettings,
  showSolution: boolean,
  preferredCellPt: number,
  framePt: number | null,
  pdfDoc: PDFDocument
): Promise<void> {
  const elements = await prepareResolvedImagesForPrint(
    buildMazeElements({
      puzzle,
      slot,
      preferredCellPt,
      framePt,
      gp,
      showSolution,
    })
  );
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  for (const el of elements) {
    if (el.kind !== 'image' || !el.href || embedded.has(el.href)) continue;
    const bytes = dataUrlToBytes(el.href);
    const image = el.href.includes('image/jpeg') || el.href.includes('image/jpg')
      ? await pdfDoc.embedJpg(bytes)
      : await pdfDoc.embedPng(bytes);
    embedded.set(el.href, image);
  }
  renderResolvedPdf(
    page,
    pageHeightPt,
    elements,
    () => {
      throw new Error('Maze elements must not request a font. Add text in the shared maze builder first.');
    },
    (href) => {
      const image = embedded.get(href);
      if (!image) throw new Error('Maze illustration was not embedded. Do not drop the image.');
      return image;
    }
  );
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
  _numberFont: PDFFont,
  pageNumberZoneTopPt: number
): void {
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildCrosswordElements({
      puzzle,
      slot,
      cw,
      showSolution,
      preferredCellPt,
      clueGapPt,
      hideClues,
      pageNumberZoneTopPt,
    }),
    (_family, bold) => (bold ? letterFont : clueFont)
  );
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
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildScrambleElements({ puzzle, slot, gp, showSolution, fontSizePt, wordGapPt, letterEm }),
    () => font
  );
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
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildTriviaElements({ puzzles, slot, gp, showSolution }),
    (_family, bold) => (bold ? boldFont : font)
  );
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
  renderResolvedPdf(
    page,
    pageHeightPt,
    buildCryptogramElements({ puzzle, slot, gp, showSolution }),
    () => font
  );
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
  const hasBackgroundImage = !!pageColors.backgroundImage;
  await paintBackground(pdfDoc, page, layout.pageWidthPt, layout.pageHeightPt, bgConfig, backgroundCache);
  if (pageFrame.enabled && hasBackgroundImage) {
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
    const lines = layout.subtitleLines.length > 0 ? layout.subtitleLines : [layout.subtitle.text];
    const lineHeightPt = layout.subtitle.fontSizePt * 1.25;
    const color = pdfColor(layout.subtitle.color, '#111111');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineBox: RectPt = {
        leftPt: layout.subtitleBox.leftPt,
        topPt: layout.subtitleBox.topPt + i * lineHeightPt,
        widthPt: layout.subtitleBox.widthPt,
        heightPt: lineHeightPt,
      };
      drawTextBox(
        page,
        layout.pageHeightPt,
        line,
        lineBox,
        subFont,
        layout.subtitle.fontSizePt,
        color,
        layout.subtitle.align,
        'middle'
      );
    }
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
    } else if (puzzleType === 'codewords' && gp) {
      drawCodewordsPdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/codewords').CodewordPuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'binairo' && gp) {
      drawBinairoPdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/binairo').BinairoPuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'kakuro' && gp) {
      drawKakuroPdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/kakuro').KakuroPuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'math-maze' && gp) {
      drawMathMazePdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/math-maze').MathMazePuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if ((puzzleType === 'word-fill' || puzzleType === 'number-fill') && gp) {
      drawFillPdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/fill').FillPuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'snake' && gp) {
      drawSnakePdf(
        page,
        layout.pageHeightPt,
        puzzle as import('./puzzles/snake').SnakePuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        bodyBold
      );
    } else if (puzzleType === 'maze' && gp) {
      await drawMazePdf(
        page,
        layout.pageHeightPt,
        puzzle as MazePuzzle,
        content,
        gp,
        showSolution,
        layout.genericCellPt,
        layout.mazeFramePt,
        pdfDoc
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

  const variableCtx = resolvePageVariableContext({
    puzzleIndexInDocument: puzzleIndex,
    puzzlesPerPage: gp?.core.puzzlesPerPage ?? 1,
    puzzlesStartingNumber:
      gp?.core.puzzlesStartingNumber ?? cw?.core.puzzlesStartingNumber ?? 1,
    bookPageIndex: compiledPage.bookPageIndex,
  });
  await drawPageVariablesOnPdfPage({
    pdfDoc,
    page,
    pageWidthPt: layout.pageWidthPt,
    pageHeightPt: layout.pageHeightPt,
    fields: pageVariablesFromDocument(documentPages, compiledPage.sourceDocumentId),
    contentIndex: variableCtx.contentIndex,
    bookPageNumber: variableCtx.bookPageNumber,
    puzzleNumber: variableCtx.puzzleNumber,
    getFont: getOrEmbedFont,
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
