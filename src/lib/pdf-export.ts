import { WORD_SEARCH_EXTENDED_LETTERS } from './puzzles/word-search-letters';
import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFFont,
  PDFPage,
  LineCapStyle,
  LineJoinStyle,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  setFillingColor,
  setStrokingColor,
  setLineWidth,
  setLineJoin,
  setTextRenderingMode,
  TextRenderingMode,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
  CrosswordPuzzle,
  DEFAULT_TITLE_START_AT,
} from './puzzles/types';
import {
  isWordSearchShapeCell,
  getShapeMaskImageDrawRect,
  resolveShapeMaskImageSrc,
} from './puzzles/word-search-shape-mask';
import {
  captureCompiledPageSnapshot,
  isGenericOrCrosswordPageKind,
  isNativelyDrawnPageKind,
} from './compiled-page-snapshot';
import { addNativeGenericOrCrosswordPdfPage } from './generic-puzzle-pdf-draw';
import type { CrosswordSettings } from './crossword-settings';
import { calculateLayout, cssPxToPoints, formatWords, getSolutionGridFontSize } from './puzzle-layout';
import { parseRgba, getAlpha01 } from './color-utils';
import { getPuzzleContentLine, resolvePuzzleDisplayNumber } from './puzzle-line-index';
import {
  computeWordSearchPageLayout,
  getWordListRowTopOffsetPt,
  getWordListRowBaselineFromTopPt,
  DEFAULT_WORD_SPACING_HORIZONTAL,
} from './word-search-page-layout';
import { computeBookHeaderTitleFontSizePt } from './header-assembly/book-title-size';
import {
  getGridCellRectPdf,
  getPdfLetterDrawCoordsAtRequestedSize,
} from './grid-letter-centering';
import { getPDFSolutionPaths } from './solution-renderer';
import { getMergedSettingsForPage } from './page-settings';
import { getFontBuffer } from './font-loader';
import { getFallbackStandardFont } from './google-fonts';
import { isBoldFontWeight } from './publishing-fonts';
import {
  FlattenedBackgroundPdfCache,
  drawFlattenedBackgroundOnPdfPage,
  puzzlePageBackgroundConfig,
  answerPageBackgroundConfig,
  resolveFrameMargin,
  resolveFrameEnabled,
  shouldUseFlattenedExport,
  normalizeBackgroundOpacity01,
  type PageBackgroundConfig,
} from './unified-background';
import {
  computeGridBorderGeometry,
  type GridBorderGeometry,
} from './grid-border-geometry';
import { resolvePuzzleGridBorder, resolveSolutionGridBorder } from './grid-border-settings';
import { resolvePageFrameSettings } from './page-frame-settings';
import type { PageFrameSettings } from './puzzles/types';
import {
  computeSolutionPageLayout,
} from './solution-page-layout';
import {
  buildPageFrameRoundedRectSvgPath,
  clampCornerRadius,
  pageFrameCornerRadiusPt,
} from './page-frame-geometry';
import { layoutSolutionBlockTitlePt } from './header-assembly/fit-title';
import { drawHeaderAssemblyOnPdfPageNative } from './header-assembly-pdf-draw';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import { normalizePageNumberSettings } from './page-number/settings';
import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import {
  normalizeHeaderAssemblySettings,
  migrateLegacyHeaderLayout,
} from './header-assembly/types';
import type { DocumentPage, PuzzleModuleSettings } from './document-model';
import {
  compileBook,
  groupPuzzlesByDocument,
  groupCrosswordPuzzlesByDocument,
  groupGenericPuzzlesByDocument,
  groupMurdokuPuzzlesByDocument,
  shouldDrawBookPageNumber,
  type CompiledPage,
} from './book-compiler';
import {
  drawTextModuleOnPdfPage,
  resolveLayoutSettingsForExport,
  resolvePageNumberSettingsForBook,
} from './text-page-pdf-draw';
import { overlayBookLayoutOnAllDocuments } from './visual-settings-sync';

interface ExportOptions {
  bookSettings: {
    includeBleed: boolean;
    customWidth?: number;
    customHeight?: number;
    useCustomTrim: boolean;
    answersPerPage: number;
    includePageBetweenPuzzleAndSolutions: boolean;
    mixPuzzles?: boolean;
    chapterTopics?: string[];
  };
  titleWords: TitleWordsSettings;
  wordSearchSettings: WordSearchSettings;
  puzzles: WordSearchPuzzle[];
  /** Generated crossword puzzles (crossword document tabs). */
  crosswordPuzzles?: CrosswordPuzzle[];
  /** Per-crossword-page overrides keyed by document-local puzzle index. */
  crosswordPageOverrides?: Map<number, Partial<CrosswordSettings>>;
  /** Generated sudoku/maze puzzles (generic document tabs). */
  genericPuzzles?: import('./puzzles/types').GenericBatchPuzzle[];
  /** Per-sudoku/maze-page overrides keyed by document-local puzzle index. */
  genericPageOverrides?: Map<number, Partial<import('./generic-puzzle-settings').GenericPuzzleSettings>>;
  /** Generated Murdoku puzzles (Murdoku document tabs). */
  murdokuPuzzles?: import('./puzzles/types').MurdokuPuzzle[];
  includeSolution: boolean;
  onlySolutions?: boolean;
  puzzleGridScale?: number;
  titleToAnswerGap?: number;
  pageMargin?: number;
  solutionToSolutionGap?: number;
  // Page-level overrides and apply modes for WYSIWYG editing
  pageOverrides?: Map<number, Partial<WordSearchSettings>>;
  applyMode?: Map<string, boolean>;
  noText?: boolean;
  /** Multi-document book: export all modules in sidebar order */
  documentPages?: DocumentPage[];
  /** Progress status strings, e.g. "Rendering page 3 of 24…" */
  onProgress?: (status: string) => void;
}

// Convert inches to PDF points (72 points per inch)
function inchesToPoints(inches: number): number {
  return inches * 72;
}

// KDP safe zone used by preview: when bleed is included use 0.375in, otherwise 0.25in
function getKDPSafetyMarginPt(includeBleed: boolean): number {
  return (includeBleed ? 0.375 : 0.25) * 72;
}

/**
 * Calculate the total vertical space consumed by a wrapped title block.
 * This accounts for the rendered height of all lines plus internal padding.
 * Used consistently by PDF and PPT exporters to ensure uniform alignment.
 * 
 * @param wrappedLines - Array of text lines (after wrapping)
 * @param fontHeight - Height of the font at the desired size (from font descriptor)
 * @param lineMultiplier - Multiplier for line height (typically 1.2 for spaced text)
 * @param bottomPaddingPt - Extra padding below the title block (pt)
 * @returns Total height in points
 */
function calculateTitleBlockHeightPt(
  wrappedLines: string[],
  fontHeight: number,
  lineMultiplier: number = 1.2,
  bottomPaddingPt: number = 0
): number {
  if (wrappedLines.length === 0) return bottomPaddingPt;
  const lineHeightPt = fontHeight * lineMultiplier;
  const textHeightPt = wrappedLines.length * lineHeightPt;
  return textHeightPt + bottomPaddingPt;
}

/**
 * Calculate grid Y position based on title block and gap.
 * Unified formula ensures consistent alignment across all solutions.
 * 
 * For PDF (bottom-origin Y): gridY = blockTop - titleHeight - gap
 * For PPT (top-origin Y): gridY = blockTop + titleHeight + gap
 * 
 * @param blockTopY - Top Y of the solution block (in the coordinate system being used)
 * @param titleBlockHeightPt - Total height of title block (including padding)
 * @param titleToAnswerGap - Spacing between title and grid (points)
 * @param isBottomOrigin - True for PDF (bottom-origin), false for PPT (top-origin)
 * @returns Grid Y position
 */
function calculateGridTopY(
  blockTopY: number,
  titleBlockHeightPt: number,
  titleToAnswerGap: number,
  isBottomOrigin: boolean
): number {
  if (isBottomOrigin) {
    // PDF: Y increases upward from bottom
    // Grid starts below title by titleToAnswerGap
    return blockTopY - titleBlockHeightPt - titleToAnswerGap;
  } else {
    // PPT: Y increases downward from top
    // Grid starts below title by titleToAnswerGap
    return blockTopY + titleBlockHeightPt + titleToAnswerGap;
  }
}

// Wrap text to fit within maxWidth using font metrics
function wrapTextWithFont(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  if (!text || maxWidth <= 0) return [];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      // Check if the word itself fits. If not, forcefully wrap it.
      const wordWidth = font.widthOfTextAtSize(word, fontSize);
      if (wordWidth <= maxWidth) {
        currentLine = word;
      } else {
        let remaining = word;
        while (remaining.length > 0) {
          let low = 1;
          let high = remaining.length;
          let bestFitIndex = 0;

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const chunk = remaining.slice(0, mid);
            const chunkWidth = font.widthOfTextAtSize(chunk, fontSize);
            if (chunkWidth <= maxWidth) {
              bestFitIndex = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          if (bestFitIndex === 0) {
            bestFitIndex = 1;
          }

          const chunk = remaining.slice(0, bestFitIndex);
          if (bestFitIndex < remaining.length) {
            lines.push(chunk);
            remaining = remaining.slice(bestFitIndex);
          } else {
            currentLine = chunk;
            remaining = '';
          }
        }
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

// Convert hex / rgba string to pdf-lib RGB color (values 0-1). Alpha is ignored here — use getAlpha01.
function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } {
  const c = parseRgba(hex, '#000000');
  return { r: c.r / 255, g: c.g / 255, b: c.b / 255 };
}

// Get pdf-lib color object from hex
function getColor(hex: string | undefined) {
  const { r, g, b } = hexToRgb(hex);
  return rgb(r, g, b);
}

// Safe color getter with fallback to black
function safeColor(hex: string | undefined, fallback: string = '#000000') {
  return getColor(hex || fallback);
}

function safeOpacity(hex: string | undefined, fallback = 1): number {
  if (!hex) return fallback;
  return getAlpha01(hex, fallback);
}

/** Draw a grid letter with fill + optional outline (matches UI -webkit-text-stroke). */
function drawPdfLetterGlyph(
  page: PDFPage,
  letter: string,
  opts: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    fillColor: ReturnType<typeof rgb>;
    strokeColor?: ReturnType<typeof rgb>;
    strokeThicknessPt?: number;
    opacity?: number;
  }
): void {
  const opacity = Math.max(0, Math.min(1, opts.opacity ?? 1));
  const strokeThickness = Math.max(0, opts.strokeThicknessPt || 0);
  if (strokeThickness > 0 && opts.strokeColor) {
    const lineWidth = Math.max(0.25, strokeThickness * 2);
    page.pushOperators(
      pushGraphicsState(),
      setFillingColor(opts.fillColor),
      setStrokingColor(opts.strokeColor),
      setLineWidth(lineWidth),
      setLineJoin(LineJoinStyle.Round),
      setTextRenderingMode(TextRenderingMode.FillAndOutline)
    );
    page.drawText(letter, {
      x: opts.x,
      y: opts.y,
      size: opts.size,
      font: opts.font,
      color: opts.fillColor,
      opacity,
    });
    page.pushOperators(popGraphicsState());
    return;
  }

  page.drawText(letter, {
    x: opts.x,
    y: opts.y,
    size: opts.size,
    font: opts.font,
    color: opts.fillColor,
    opacity,
  });
}

function drawHeaderAssemblyFallbackText(
  page: PDFPage,
  pageHeight: number,
  block: UnifiedHeaderAssemblyBlock,
  titleFont: PDFFont
): void {
  const { parts } = block;
  const titleParts: string[] = [];
  if (parts.showNumber && parts.numberText) titleParts.push(parts.numberText);
  if (parts.titleText) titleParts.push(parts.titleText);
  const titleLine = titleParts.join('. ');
  if (titleLine) {
    const textWidth = titleFont.widthOfTextAtSize(titleLine, block.titleFontSizePt);
    const titleX = block.leftPt + Math.max(0, (block.widthPt - textWidth) / 2);
    page.drawText(titleLine, {
      x: titleX,
      y: pageHeight - block.topPt - block.titleFontSizePt,
      size: block.titleFontSizePt,
      font: titleFont,
      color: safeColor(block.titleColor, '#000000'),
    });
  }

  const subtitleLines =
    block.subtitleLines.length > 0
      ? block.subtitleLines
      : parts.subtitleText
        ? [parts.subtitleText]
        : [];
  const lineHeight = block.subtitleFontSizePt * 1.2;
  const subtitleTop = block.topPt + block.titleFontSizePt + 6;
  for (let i = 0; i < subtitleLines.length; i++) {
    const line = subtitleLines[i];
    const lineWidth = titleFont.widthOfTextAtSize(line, block.subtitleFontSizePt);
    const lineX = block.leftPt + Math.max(0, (block.widthPt - lineWidth) / 2);
    page.drawText(line, {
      x: lineX,
      y: pageHeight - (subtitleTop + i * lineHeight + block.subtitleFontSizePt),
      size: block.subtitleFontSizePt,
      font: titleFont,
      color: safeColor(block.subtitleColor, '#666666'),
    });
  }
}

async function drawHeaderAssemblyOnPdfPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageHeight: number,
  block: UnifiedHeaderAssemblyBlock,
  titleFont: PDFFont,
  subtitleFont: PDFFont,
  noText: boolean
): Promise<void> {
  if (noText) return;
  drawHeaderAssemblyOnPdfPageNative(page, pageHeight, block, titleFont, getColor, subtitleFont);
}

function decodeBase64DataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/data:([^;]+);base64/);
  if (!mimeMatch) return null;
  const mimeType = mimeMatch[1];
  const base64Data = parts[1].replace(/\s/g, '');

  let bytes: Uint8Array;
  if (typeof window === 'undefined') {
    bytes = new Uint8Array(Buffer.from(base64Data, 'base64'));
  } else {
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
    } catch (e) {
      console.error('Failed window.atob in decodeBase64DataUrl:', e);
      return null;
    }
  }
  return { bytes, mimeType };
}

async function reencodeImageToPng(url: string): Promise<string | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch (e) {
        console.error('Error drawing to canvas in reencodeImageToPng:', e);
      }
      resolve(null);
    };
    img.onerror = (e) => {
      console.error('Error loading image in reencodeImageToPng:', e);
      resolve(null);
    };
    img.src = url;
  });
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  // Try using fetch directly first (supported for data URLs in browser)
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const contentType = response.headers.get('content-type');
    let mimeType = contentType;
    if (!mimeType) {
      if (url.startsWith('data:')) {
        const match = url.match(/data:([^;]+);/);
        mimeType = match ? match[1] : 'image/png';
      } else {
        mimeType = url.endsWith('.png') ? 'image/png' : 'image/jpeg';
      }
    }
    const arrayBuffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(arrayBuffer), mimeType };
  } catch (error) {
    console.warn('Direct fetch failed, falling back to manual decoding:', error);

    if (url.startsWith('data:')) {
      return decodeBase64DataUrl(url);
    }
    return null;
  }
}

/** White frame inset overlay — matches PreviewCanvas Frame Border layer. */
function drawFrameBorderOverlay(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  config: PageBackgroundConfig,
  fillColor: ReturnType<typeof rgb>
): void {
  if (!config.backgroundImage || !resolveFrameEnabled(config.backgroundImageFrameEnabled)) {
    return;
  }

  const frameMarginPt = resolveFrameMargin(config.backgroundImageFrameMargin) * 72;
  const x = frameMarginPt;
  const y = frameMarginPt;
  const width = pageWidth - frameMarginPt * 2;
  const height = pageHeight - frameMarginPt * 2;

  if (width <= 0 || height <= 0) return;

  const radiusPt = pageFrameCornerRadiusPt(config.pageFrameCornerRadiusPx ?? 4);
  const r = clampCornerRadius(radiusPt, width, height);

  if (r >= 0.1) {
    const path = buildPageFrameRoundedRectSvgPath(x, y, width, height, r);
    page.drawSvgPath(path, { color: fillColor });
  } else {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: fillColor,
    });
  }
}

/** Stroked rounded page container frame (Color Settings) — not the grid border. */
function drawPageContainerFrame(
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  frame: PageFrameSettings
): void {
  if (!frame.enabled) return;

  const marginPt = frame.marginSizeIn * 72;
  const strokePt = cssPxToPoints(frame.strokeThicknessPx);
  const halfStroke = strokePt / 2;
  // Inset so outer edge of centered stroke matches CSS border-box (canvas).
  const x = marginPt + halfStroke;
  const y = marginPt + halfStroke;
  const width = pageWidth - marginPt * 2 - strokePt;
  const height = pageHeight - marginPt * 2 - strokePt;
  if (width <= 0 || height <= 0) return;

  const radiusPt = pageFrameCornerRadiusPt(frame.cornerRadiusPx);
  const strokeColor = safeColor(frame.borderColor, '#1f2937');
  const r = clampCornerRadius(radiusPt, width, height);

  if (r >= 0.1) {
    const path = buildPageFrameRoundedRectSvgPath(x, y, width, height, r);
    page.drawSvgPath(path, {
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

/** Flattened background (single raster) with vector fallback for server-side export. */
async function drawPageBackground(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  config: PageBackgroundConfig,
  backgroundCache: FlattenedBackgroundPdfCache
): Promise<void> {
  const fillColor = safeColor(config.backgroundColor, '#ffffff');

  if (shouldUseFlattenedExport(config)) {
    const embedded = await backgroundCache.getOrEmbed(pdfDoc, config);
    if (embedded) {
      // Base page color shows through transparent inner puzzle area (no black fill)
      if (embedded.result.hasTransparentInner) {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
          color: fillColor,
        });
      }
      drawFlattenedBackgroundOnPdfPage(
        page,
        embedded.image,
        pageWidth,
        pageHeight
      );
      // Frame inset is baked into the flattened raster (transparent inner + base fill).
      // drawFrameBorderOverlay is only used for the vector fallback below.
      return;
    }
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight,
      color: fillColor,
    });
    return;
  }

  // Server-side fallback: vector layers (no separate frame when flattening unavailable)
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: fillColor,
  });

  if (config.backgroundImage) {
    await drawBackgroundImage(
      pdfDoc,
      page,
      pageWidth,
      pageHeight,
      config.backgroundImage,
      config.backgroundImageOpacity,
      config.backgroundImageFit
    );

    drawFrameBorderOverlay(page, pageWidth, pageHeight, config, fillColor);
  }
}

async function drawBackgroundImage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageWidth: number,
  pageHeight: number,
  backgroundImageUrl: string | undefined,
  opacity: number | undefined,
  fit: 'cover' | 'contain' | 'stretch' | undefined
) {
  if (!backgroundImageUrl) return;
  try {
    let targetUrl = backgroundImageUrl;

    // In browser, re-encode image via canvas to guarantee standard non-interlaced PNG format and bypass CORS
    if (typeof window !== 'undefined') {
      try {
        const cleanDataUrl = await reencodeImageToPng(backgroundImageUrl);
        if (cleanDataUrl) {
          targetUrl = cleanDataUrl;
        }
      } catch (e) {
        console.warn('reencodeImageToPng failed, using raw url:', e);
      }
    }

    const imageData = await fetchImageBytes(targetUrl);
    if (!imageData) {
      console.warn('Could not fetch or load background image:', targetUrl);
      return;
    }

    const { bytes: imageBytes, mimeType } = imageData;

    let image;
    if (mimeType === 'image/png') {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      console.warn('Unsupported image mime type for PDF export:', mimeType);
      return;
    }

    const { width: imgWidth, height: imgHeight } = image.scale(1);

    let drawWidth = pageWidth;
    let drawHeight = pageHeight;
    let drawX = 0;
    let drawY = 0;

    const fitMode = fit || 'cover';

    if (fitMode === 'stretch') {
      drawWidth = pageWidth;
      drawHeight = pageHeight;
    } else {
      const pageRatio = pageWidth / pageHeight;
      const imgRatio = imgWidth / imgHeight;

      if (fitMode === 'cover') {
        if (imgRatio > pageRatio) {
          // Image is wider than page ratio
          drawHeight = pageHeight;
          drawWidth = pageHeight * imgRatio;
          drawX = (pageWidth - drawWidth) / 2;
        } else {
          // Image is taller than page ratio
          drawWidth = pageWidth;
          drawHeight = pageWidth / imgRatio;
          drawY = (pageHeight - drawHeight) / 2;
        }
      } else if (fitMode === 'contain') {
        if (imgRatio > pageRatio) {
          drawWidth = pageWidth;
          drawHeight = pageWidth / imgRatio;
          drawY = (pageHeight - drawHeight) / 2;
        } else {
          drawHeight = pageHeight;
          drawWidth = pageHeight * imgRatio;
          drawX = (pageWidth - drawWidth) / 2;
        }
      }
    }

    page.drawImage(image, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight,
      opacity: normalizeBackgroundOpacity01(opacity),
    });
  } catch (error) {
    console.error('Error embedding background image in PDF:', error);
  }
}

/** Draw the shape silhouette under grid letters (optional visual). */
async function drawShapeMaskImageOnPdfPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  settings: WordSearchSettings,
  puzzle: WordSearchPuzzle,
  gridLeftPt: number,
  gridBottomPt: number,
  gridWidthPt: number,
  gridHeightPt: number
): Promise<void> {
  if (!settings.core.shapeWordSearchEnabled || !settings.core.shapeMaskShowImage) return;
  const opacity = Math.max(0, Math.min(100, settings.core.shapeMaskImageOpacity ?? 35)) / 100;
  if (opacity <= 0) return;

  const imageSrc = resolveShapeMaskImageSrc(
    settings.core,
    puzzle.puzzleIndexInDocument ?? 0
  );
  if (!imageSrc) return;

  try {
    let targetUrl = imageSrc;
    if (typeof window !== 'undefined') {
      try {
        const cleanDataUrl = await reencodeImageToPng(imageSrc);
        if (cleanDataUrl) targetUrl = cleanDataUrl;
      } catch {
        // use raw
      }
    }

    const imageData = await fetchImageBytes(targetUrl);
    if (!imageData) return;

    const image =
      imageData.mimeType === 'image/jpeg' || imageData.mimeType === 'image/jpg'
        ? await pdfDoc.embedJpg(imageData.bytes)
        : await pdfDoc.embedPng(imageData.bytes);

    const { width: imgWidth, height: imgHeight } = image.scale(1);
    const fit = settings.core.shapeMaskFit ?? 'contain';
    const rect = getShapeMaskImageDrawRect(
      imgWidth,
      imgHeight,
      gridWidthPt,
      gridHeightPt,
      fit
    );

    page.drawImage(image, {
      x: gridLeftPt + rect.x,
      y: gridBottomPt + (gridHeightPt - rect.y - rect.h),
      width: rect.w,
      height: rect.h,
      opacity,
    });
  } catch (error) {
    console.warn('Failed to draw shape mask image on PDF:', error);
  }
}

function mapSolutionLineCap(lineCap: 'butt' | 'round' | undefined): LineCapStyle {
  switch (lineCap) {
    case 'round':
      return LineCapStyle.Round;
    case 'butt':
    default:
      return LineCapStyle.Butt;
  }
}

function mapCssFontFamilyToStandardFont(fontFamily: string, bold: boolean = false): StandardFonts {
  const family = (fontFamily || '').toLowerCase();
  const isHighLegibility = /arial|arial black|verdana|tahoma|trebuchet/.test(family);
  const isSerif = /times|serif|georgia|merriweather|playfair|lora/.test(family);
  const isMonospace = /courier|mono|monospace|courier new/.test(family);
  const isKidsFun = /comic|fredoka|quicksand|patrick|nunito/.test(family);
  const isCleanSans = /helvetica|poppins|roboto|open sans|open-sans|lato|montserrat/.test(family);

  // Monospace fonts should use Courier family natively.
  if (isMonospace) {
    return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  }

  // Kids/fun display fonts render better with a simple fixed-width native font.
  if (isKidsFun) {
    return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  }

  // Bold/high-legibility/senior fonts should map to bold native fonts.
  if (isHighLegibility) {
    return StandardFonts.HelveticaBold;
  }

  // Serif families use Times Roman, with bold if requested.
  if (isSerif) {
    return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  }

  // Clean / standard modern sans-serifs use Helvetica.
  if (isCleanSans) {
    return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
  }

  // Default fallback to Helvetica to preserve an editable vector PDF font.
  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

async function embedFont(pdfDoc: PDFDocument, fontFamily: string, bold: boolean = false): Promise<PDFFont> {
  // First, try to load and embed the actual custom font
  const fontBuffer = await getFontBuffer(fontFamily, bold);

  if (fontBuffer) {
    try {
      const embedded = await pdfDoc.embedFont(fontBuffer, { subset: false });
      // Some bundled/web fonts omit Latin Extended glyphs and silently emit blanks.
      embedded.encodeText(WORD_SEARCH_EXTENDED_LETTERS);
      return embedded;
    } catch (error) {
      console.warn(`Failed to embed custom font "${fontFamily}":`, error);
      // Fall back to standard font if embedding fails
    }
  }

  // Fallback to standard PDF fonts
  const standardFont = getFallbackStandardFont(fontFamily, bold);
  return pdfDoc.embedFont(standardFont);
}

async function embedStandardFont(pdfDoc: PDFDocument, fontFamily: string, bold: boolean = false): Promise<PDFFont> {
  return embedFont(pdfDoc, fontFamily, bold);
}

/**
 * Rounded-rect SVG path for pdf-lib drawSvgPath.
 * pdf-lib applies scale(1, -1) to SVG paths, so Y must be negated vs PDF page coords.
 * @param y PDF bottom-left Y (pdf-lib coordinate system, origin bottom-left)
 */
function buildRoundedRectSvgPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): string {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const k = 0.552284749831 * r;
  const yt = -(y + height);
  const yb = -y;

  return `M ${x + r},${yt} L ${x + width - r},${yt} C ${x + width - r + k},${yt} ${x + width},${yt + r - k} ${x + width},${yt + r} L ${x + width},${yb - r} C ${x + width},${yb - r + k} ${x + width - r + k},${yb} ${x + width - r},${yb} L ${x + r},${yb} C ${x + r - k},${yb} ${x},${yb - r + k} ${x},${yb - r} L ${x},${yt + r} C ${x},${yt + r - k} ${x + r - k},${yt} ${x + r},${yt} Z`;
}

/**
 * Draw puzzle grid border. Fill before letters; stroke after (matches UI z-order).
 * Rectangle coords use pdf-lib bottom-left origin (no pageHeight inversion).
 */
function drawGridBorder(
  page: PDFPage,
  geom: GridBorderGeometry,
  strokeColor: ReturnType<typeof rgb>,
  options: { fill?: boolean; stroke?: boolean } = { fill: true, stroke: true }
): void {
  const { x, y, width, height, radius, borderThickness } = geom;
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return;
  }

  if (!options.fill && !options.stroke) return;

  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  const useRounded = r >= 0.1;

  if (useRounded) {
    const path = buildRoundedRectSvgPath(x, y, width, height, r);
    if (options.fill) {
      page.drawSvgPath(path, { color: rgb(1, 1, 1) });
    }
    if (options.stroke) {
      page.drawSvgPath(path, {
        borderColor: strokeColor,
        borderWidth: borderThickness,
        borderOpacity: 1,
      });
    }
  } else {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      ...(options.fill ? { color: rgb(1, 1, 1) } : {}),
      ...(options.stroke ? { borderColor: strokeColor, borderWidth: borderThickness } : {}),
    });
  }
}

// Draw rounded rectangle border for word highlights or grid box
function drawRoundedRectBorder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  strokeColor: ReturnType<typeof rgb>,
  strokeWidth: number,
  opacity: number = 1,
  fillColor?: ReturnType<typeof rgb>
) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return; // Cannot draw with invalid dimensions
  }

  const validRadius = Number.isFinite(radius) ? Math.max(0, radius) : 0;
  const validStrokeWidth = Number.isFinite(strokeWidth) ? Math.max(0, strokeWidth) : 2;

  const r = Math.max(0, Math.min(validRadius, width / 2, height / 2));
  if (r < 0.1) {
    page.drawRectangle({
      x, y, width, height,
      color: fillColor,
      borderColor: strokeColor,
      borderWidth: validStrokeWidth,
      borderOpacity: opacity
    });
    return;
  }

  const path = buildRoundedRectSvgPath(x, y, width, height, r);

  try {
    if (fillColor) {
      page.drawSvgPath(path, { color: fillColor });
    }
    page.drawSvgPath(path, {
      borderColor: strokeColor,
      borderWidth: validStrokeWidth,
      borderOpacity: opacity,
    });
  } catch (e) {
    console.error('Error drawing rounded rect path:', e, 'Path was:', path);
    // Fallback to sharp rectangle on error
    page.drawRectangle({
      x, y, width, height,
      color: fillColor,
      borderColor: strokeColor,
      borderWidth: validStrokeWidth,
      borderOpacity: opacity
    });
  }
}

// Draw diagonal frame highlight for diagonally placed words
function drawDiagonalHighlight(
  page: PDFPage,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  strokeColor: ReturnType<typeof rgb>,
  strokeWidth: number,
  cellSize: number,
  opacity: number = 1
) {
  // Calculate the direction vector
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Normalize direction
  const dirX = distance > 0 ? dx / distance : 1;
  const dirY = distance > 0 ? dy / distance : 0;

  // Perpendicular vector (rotated 90 degrees)
  const perpX = -dirY;
  const perpY = dirX;

  // Padding for frame (smaller than full cell height)
  const padding = Math.min(cellSize * 0.12, 3);
  const halfThickness = (cellSize - padding * 2) / 2;

  // Calculate corners of rotated rectangle
  const p1x = startX - dirX * padding - perpX * halfThickness;
  const p1y = startY - dirY * padding - perpY * halfThickness;

  const p2x = endX + dirX * padding - perpX * halfThickness;
  const p2y = endY + dirY * padding - perpY * halfThickness;

  const p3x = endX + dirX * padding + perpX * halfThickness;
  const p3y = endY + dirY * padding + perpY * halfThickness;

  const p4x = startX - dirX * padding + perpX * halfThickness;
  const p4y = startY - dirY * padding + perpY * halfThickness;

  // Draw the four sides of the rotated rectangle using lines
  const lines = [
    { x1: p1x, y1: p1y, x2: p2x, y2: p2y }, // top
    { x1: p2x, y1: p2y, x2: p3x, y2: p3y }, // right
    { x1: p3x, y1: p3y, x2: p4x, y2: p4y }, // bottom
    { x1: p4x, y1: p4y, x2: p1x, y2: p1y }, // left
  ];

  for (const line of lines) {
    page.drawLine({
      start: { x: line.x1, y: line.y1 },
      end: { x: line.x2, y: line.y2 },
      color: strokeColor,
      thickness: strokeWidth,
      opacity,
    });
  }
}

async function drawWordSearchPuzzle(
  pdfDoc: PDFDocument,
  page: PDFPage,
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  gridFont: PDFFont,
  wordListFont: PDFFont,
  titleFont: PDFFont,
  subtitleFont: PDFFont,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  showSolution: boolean = false,
  puzzleGridScale: number = 70,
  noText: boolean = false,
  titleToAnswerGap: number = 10,
  backgroundCache: FlattenedBackgroundPdfCache,
  bookHeaderTitleFontSizePt?: number | null,
  bookPageIndex = 0,
  pageNumberFont?: PDFFont,
  pagePart: 'clues' | 'grid' = 'clues'
) {
  const { core, wordList, colors } = settings;
  const isSolutionPage = !!showSolution;
  const isGridOnlyPage = !isSolutionPage && settings.core.twoPagePuzzles && pagePart === 'grid';

  const layout = computeWordSearchPageLayout(
    puzzle,
    settings,
    titleWords,
    showSolution,
    puzzleGridScale,
    titleToAnswerGap,
    bookHeaderTitleFontSizePt,
    pagePart
  );
  const g = layout.grid;
  const pageMargin = layout.page.marginPt;

  const pageFrame = resolvePageFrameSettings(settings);
  const frameOpts = {
    frameEnabled: pageFrame.enabled,
    frameMarginIn: pageFrame.marginSizeIn,
  };
  const pageBgConfig = showSolution
    ? answerPageBackgroundConfig(
        pageWidth,
        pageHeight,
        colors.answerPage,
        pageFrame.cornerRadiusPx,
        frameOpts
      )
    : puzzlePageBackgroundConfig(
        pageWidth,
        pageHeight,
        colors.puzzlePage,
        pageFrame.cornerRadiusPx,
        frameOpts
      );
  await drawPageBackground(pdfDoc, page, pageWidth, pageHeight, pageBgConfig, backgroundCache);

  // ===== Unified layout positions (same as canvas preview) =====

  if (!isGridOnlyPage && layout.headerAssembly) {
    await drawHeaderAssemblyOnPdfPage(
      pdfDoc,
      page,
      pageHeight,
      layout.headerAssembly,
      titleFont,
      subtitleFont,
      noText
    );
  } else if (!isGridOnlyPage && layout.title) {
    const t = layout.title;
    const textWidth = titleFont.widthOfTextAtSize(t.text, t.fontSizePt);
    let titleX = pageMargin;
    if (t.align === 'center') {
      titleX = (pageWidth - textWidth) / 2;
    } else if (t.align === 'right') {
      titleX = pageWidth - pageMargin - textWidth;
    }
    try {
      const includeBleed = !!(layout.page && layout.page.marginIn === 0.125);
      const safetyMarginPt = getKDPSafetyMarginPt(includeBleed);
      const minX = safetyMarginPt;
      const maxX = Math.max(minX, pageWidth - safetyMarginPt - textWidth);
      titleX = Math.min(Math.max(titleX, minX), maxX);
    } catch (e) {
      // ignore and keep computed titleX
    }

    const pdfTitleY = pageHeight - (t.topPt + t.fontSizePt);
    if (!noText) {
      page.drawText(t.text, {
        x: titleX,
        y: pdfTitleY,
        size: t.fontSizePt,
        font: titleFont,
        color: safeColor(t.color, '#000000'),
      });
    }
  }

  if (!isGridOnlyPage && !layout.headerAssembly && layout.subtitle) {
    const s = layout.subtitle;
    const subtitleLineHeightPt = s.fontSizePt * 1.2;
    const wrappedLines =
      s.wrappedLines && s.wrappedLines.length > 0 ? s.wrappedLines : [s.text];

    for (let i = 0; i < wrappedLines.length; i++) {
      const line = wrappedLines[i];
      const lineWidth = titleFont.widthOfTextAtSize(line, s.fontSizePt);
      const lineX = s.leftPt + Math.max(0, (s.widthPt - lineWidth) / 2);
      const pdfSubtitleY = pageHeight - (s.topPt + i * subtitleLineHeightPt + s.fontSizePt);

      if (!noText) {
        page.drawText(line, {
          x: lineX,
          y: pdfSubtitleY,
          size: s.fontSizePt,
          font: titleFont,
          color: safeColor(s.color, '#666666'),
        });
      }
    }
  }

  const shouldDrawGridOnThisPage = showSolution || !settings.core.twoPagePuzzles || pagePart === 'grid';

  // ===== BLOCK 2: PUZZLE GRID RENDERING =====
  if (!shouldDrawGridOnThisPage) {
    const wl = layout.wordList;
    if (!showSolution && wl && wl.words.length > 0) {
      const wordListAscent = wordListFont.heightAtSize(wl.fontSizePt, { descender: false });
      const wordsPerCol = wl.wordsPerColumn;
      const columnWidths = wl.columnWidthsPt;
      const wordListX = wl.centeredLeftPt;

      for (let i = 0; i < wl.words.length; i++) {
        const col = Math.floor(i / wordsPerCol);
        const row = i % wordsPerCol;
        const word = wl.words[i];
        const wordX =
          wordListX +
          columnWidths.slice(0, col).reduce((sum, width) => sum + width, 0) +
          col * wl.columnGapPt;

        const wordRowTopY = wl.topPt + getWordListRowTopOffsetPt(row, wl.lineHeightPt);
        const baselineFromTop = getWordListRowBaselineFromTopPt(
          wl.lineHeightPt,
          wl.fontSizePt,
          wordListAscent
        );
        const yPos = pageHeight - (wordRowTopY + baselineFromTop);

        if (wl.addCheckboxes) {
          const cbTop = wordRowTopY + Math.max(0, (wl.lineHeightPt - wl.checkboxSizePt) / 2);
          page.drawRectangle({
            x: wordX,
            y: pageHeight - (cbTop + wl.checkboxSizePt),
            width: wl.checkboxSizePt,
            height: wl.checkboxSizePt,
            borderColor: safeColor(wl.checkboxColor, '#666666'),
            borderWidth: 0.75,
          });
        }

        const textX = wl.addCheckboxes ? wordX + wl.checkboxSizePt + wl.checkboxGapPt : wordX;
        if (!noText) {
          page.drawText(word, {
            x: textX,
            y: yPos,
            size: wl.fontSizePt,
            font: wordListFont,
            color: safeColor(wl.color, '#000000'),
          });
        }
      }
    }

    drawPageContainerFrame(page, pageWidth, pageHeight, resolvePageFrameSettings(settings));
    if (!noText && pageNumberFont) {
      await drawPageNumberOnPdfPage(
        pdfDoc,
        page,
        pageWidth,
        pageHeight,
        settings,
        bookPageIndex,
        pageNumberFont,
        safeColor
      );
    }
    return;
  }

  const contentLeft = g.leftPt;
  const gridStartX = contentLeft;

  // Grid top Y position (in PDF coordinates, bottom-up)
  const pdfGridTopY = pageHeight - g.topPt;

  const fontSize = g.fontSizePt;
  const cellSize = g.cellSizePt;
  const gridWidth = g.widthPt;
  const gridHeight = g.heightPt;
  const totalColumns = g.cols;
  const totalRows = g.rows;

  // Cell Dimensions
  const cellWidth = gridWidth / totalColumns;
  const cellHeight = gridHeight / totalRows;

  // Track outermost cell boundaries for grid border
  const gridOuterLeft = gridStartX;
  const gridOuterBottom = pdfGridTopY - gridHeight;

  const puzzleGridBorder = showSolution
    ? resolveSolutionGridBorder(settings.core)
    : resolvePuzzleGridBorder(settings.core);

  // Shared geometry — identical to UI canvas (solution-canvas-snapshot.ts)
  const gridBorderGeom = computeGridBorderGeometry(
    gridOuterLeft,
    gridOuterBottom,
    gridWidth,
    gridHeight,
    g.framePaddingPt || 0,
    g.borderThicknessPt,
    puzzleGridBorder.cornerRadiusPx,
    g.noBox || Boolean(puzzle.shapeMask)
  );

  // White fill before letters
  if (gridBorderGeom) {
    drawGridBorder(page, gridBorderGeom, safeColor(g.boxColor, '#000000'), {
      fill: true,
      stroke: false,
    });
  }

  await drawShapeMaskImageOnPdfPage(
    pdfDoc,
    page,
    settings,
    puzzle,
    gridStartX,
    gridOuterBottom,
    gridWidth,
    gridHeight
  );

  // Render letters in cells (centred + auto-scaled to fit cell)
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalColumns; col++) {
      if (!isWordSearchShapeCell(puzzle.shapeMask, row, col)) continue;
      const letter = puzzle.grid[row][col];
      if (!letter) continue;
      const cell = getGridCellRectPdf(
        gridStartX,
        pdfGridTopY,
        col,
        row,
        cellWidth,
        cellHeight
      );
      const draw = getPdfLetterDrawCoordsAtRequestedSize(gridFont, letter, fontSize, cell);

      if (!noText) {
        // Solution letters use the same fill/stroke as puzzle grid letters.
        const fillHex =
          colors.puzzlePage.puzzleColor || g.letterColor || '#000000';
        const strokeHex =
          colors.puzzlePage.puzzleLetterStrokeColor || g.letterStrokeColor || '#000000';
        const strokeThicknessPt = Math.max(
          0,
          cssPxToPoints(colors.puzzlePage.puzzleLetterStrokeThickness ?? 0)
        );

        drawPdfLetterGlyph(page, letter, {
          x: draw.x,
          y: draw.y,
          size: draw.size,
          font: gridFont,
          fillColor: safeColor(fillHex, '#000000'),
          strokeColor: safeColor(strokeHex, '#000000'),
          strokeThicknessPt,
          opacity: Math.min(safeOpacity(fillHex), safeOpacity(strokeHex, 1)),
        });
      }
    }
  }

  // Border stroke after letters (on top, matches UI canvas)
  if (gridBorderGeom) {
    drawGridBorder(page, gridBorderGeom, safeColor(g.boxColor, '#000000'), {
      fill: false,
      stroke: true,
    });
  }

  const legacyLayout = {
    gridStartX: gridStartX,
    gridStartY: pdfGridTopY,
    cellSize: cellSize,
    gridWidth: g.widthPt,
    gridHeight: g.heightPt,
    gridRows: g.rows,
    gridCols: g.cols,
  };

  // Draw solution highlights (word placement paths with capsule styling)
  if (showSolution && puzzle.placements && puzzle.placements.length > 0) {
    const fillHex = colors.answerPage.solutionFrameColor || '#22c55e';
    const fillColor = safeColor(fillHex);
    const highlightStrokeHex = colors.answerPage.solutionHighlightStrokeColor || '#000000';
    const highlightStrokeColor = safeColor(highlightStrokeHex);
    const highlightStrokePt = Math.max(
      0,
      cssPxToPoints(colors.answerPage.solutionHighlightStrokeThickness ?? 0)
    );
    const bodyThickness = Math.max(
      1,
      cssPxToPoints(colors.answerPage.solutionStrokeThickness || 12)
    );
    const strokeOpacity = Math.max(
      0,
      Math.min(
        1,
        ((colors.answerPage.solutionHighlightAlpha ?? 30) / 100) *
          safeOpacity(fillHex)
      )
    );

    for (const placement of puzzle.placements) {
      const startCol = placement.start.col;
      const startRow = placement.start.row;
      const endCol = placement.end.col;
      const endRow = placement.end.row;

      const start = {
        x: legacyLayout.gridStartX + startCol * cellSize + cellSize / 2,
        y: legacyLayout.gridStartY - (startRow * cellSize + cellSize / 2),
      };
      const end = {
        x: legacyLayout.gridStartX + endCol * cellSize + cellSize / 2,
        y: legacyLayout.gridStartY - (endRow * cellSize + cellSize / 2),
      };

      if (highlightStrokePt > 0) {
        page.drawLine({
          start,
          end,
          color: highlightStrokeColor,
          thickness: bodyThickness + highlightStrokePt * 2,
          opacity: Math.min(1, strokeOpacity + 0.25),
          lineCap: LineCapStyle.Round,
        });
      }

      page.drawLine({
        start,
        end,
        color: fillColor,
        thickness: bodyThickness,
        opacity: strokeOpacity,
        lineCap: LineCapStyle.Round,
      });
    }
  }

  const wl = layout.wordList;
  if (!showSolution && !isGridOnlyPage && wl && wl.words.length > 0) {
    const wordListAscent = wordListFont.heightAtSize(wl.fontSizePt, { descender: false });
    const wordsPerCol = wl.wordsPerColumn;
    const columnWidths = wl.columnWidthsPt;
    const wordListX = wl.centeredLeftPt;

    for (let i = 0; i < wl.words.length; i++) {
      const col = Math.floor(i / wordsPerCol);
      const row = i % wordsPerCol;
      const word = wl.words[i];
      const wordX =
        wordListX +
        columnWidths.slice(0, col).reduce((sum, width) => sum + width, 0) +
        col * wl.columnGapPt;

      const wordRowTopY = wl.topPt + getWordListRowTopOffsetPt(row, wl.lineHeightPt);
      const baselineFromTop = getWordListRowBaselineFromTopPt(
        wl.lineHeightPt,
        wl.fontSizePt,
        wordListAscent
      );
      const yPos = pageHeight - (wordRowTopY + baselineFromTop);

      if (wl.addCheckboxes) {
        const cbTop = wordRowTopY + Math.max(0, (wl.lineHeightPt - wl.checkboxSizePt) / 2);
        page.drawRectangle({
          x: wordX,
          y: pageHeight - (cbTop + wl.checkboxSizePt),
          width: wl.checkboxSizePt,
          height: wl.checkboxSizePt,
          borderColor: safeColor(wl.checkboxColor, '#666666'),
          borderWidth: 0.75,
        });
      }

      const textX = wl.addCheckboxes ? wordX + wl.checkboxSizePt + wl.checkboxGapPt : wordX;
      if (!noText) {
        page.drawText(word, {
          x: textX,
          y: yPos,
          size: wl.fontSizePt,
          font: wordListFont,
          color: safeColor(wl.color, '#000000'),
        });
      }
    }
  }

  drawPageContainerFrame(page, pageWidth, pageHeight, resolvePageFrameSettings(settings));

  if (!noText && pageNumberFont) {
    await drawPageNumberOnPdfPage(
      pdfDoc,
      page,
      pageWidth,
      pageHeight,
      settings,
      bookPageIndex,
      pageNumberFont,
      safeColor
    );
  }
}

async function drawWordSearchSolutionPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  puzzles: WordSearchPuzzle[],
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  gridFont: PDFFont,
  titleFont: PDFFont,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  titleToAnswerGap: number = 10,
  pageMargin: number = 40,
  solutionToSolutionGap: number = 14,
  noText: boolean = false,
  backgroundCache: FlattenedBackgroundPdfCache,
  bookPageIndex = 0,
  pageNumberFont?: PDFFont
) {
  const pageFrame = resolvePageFrameSettings(settings);
  const answerBgConfig = answerPageBackgroundConfig(
    pageWidth,
    pageHeight,
    settings.colors.answerPage,
    pageFrame.cornerRadiusPx,
    {
      frameEnabled: pageFrame.enabled,
      frameMarginIn: pageFrame.marginSizeIn,
    }
  );
  await drawPageBackground(pdfDoc, page, pageWidth, pageHeight, answerBgConfig, backgroundCache);

  const solutionLayout = computeSolutionPageLayout(
    puzzles,
    settings,
    pageWidth,
    pageHeight,
    pageMargin,
    titleToAnswerGap,
    solutionToSolutionGap
  );

  const titleSize = settings.colors.answerPage.answerTitleFontSize || 20;
  const includeBleed = !!settings.bookCanvas.includeBleed;
  const safetyMarginPt = getKDPSafetyMarginPt(includeBleed);

  for (let index = 0; index < puzzles.length; index++) {
    const puzzle = puzzles[index];
    const block = solutionLayout.blocks[index];
    if (!block) continue;

    const blockWidth = block.widthPt;
    const blockX = block.leftPt;
    const innerMargin = block.innerMarginPt;

    // ===== RESOLVE SOLUTION TITLE WITH NEW NUMBERING LOGIC =====
    // Apply the same logic as resolveTitleText() but for solution pages
    let baseTitle = '';
    let numberingStyle = 'none';

    if (settings.typography.solutionTitleStyle === 'same_as_puzzle') {
      // Use the same base title and numbering style as the puzzle page
      switch (settings.typography.selectTitleOption) {
        case 'puzzle-number':
        case 'one-custom-title':
          baseTitle = settings.typography.titleText || titleWords.title || 'Word Search';
          break;
        case 'custom': {
          const lines = (settings.typography.titleText || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          baseTitle = getPuzzleContentLine(lines, puzzle, settings, true);
          break;
        }
        default:
          baseTitle = titleWords.title || 'Word Search';
      }
      // Use the SAME numbering style as puzzle
      numberingStyle = settings.typography.puzzleNumberingStyle || 'none';
    } else {
      // Use custom solution title with its own numbering style
      baseTitle = settings.typography.customSolutionTitle || 'Solutions';
      numberingStyle = settings.typography.solutionNumberingStyle || 'none';
    }

    // Apply numbering style to solution title
    const puzzleNum = resolvePuzzleDisplayNumber(puzzle, settings, index);
    if (baseTitle && numberingStyle !== 'none') {
      if (numberingStyle === 'prefix') {
        baseTitle = `${puzzleNum}. ${baseTitle}`;
      } else if (numberingStyle === 'suffix') {
        baseTitle = `${baseTitle} #${puzzleNum}`;
      }
    }

    const titleText = baseTitle;
    const blockTitleMaxWidth = Math.max(1, blockWidth - innerMargin * 2);
    const titleFontFamily =
      settings.colors.answerPage.answerTitleFontFamily || 'Arial';

    const titleLayout = layoutSolutionBlockTitlePt(
      titleText,
      blockTitleMaxWidth,
      titleSize,
      titleFontFamily,
      true,
      8,
      (line, size) => titleFont.widthOfTextAtSize(line, size)
    );
    const fittedTitleSize = titleLayout.fontSizePt;
    const fittedTitleLineHeightPt = titleLayout.lineHeightPt;

    const cellSize = block.cellSizePt;
    const gridWidth = block.gridWidthPt;
    const gridHeight = block.gridHeightPt;

    const answerTitleTopY = pageHeight - block.titleTopPt;

    // Render fitted title lines
    if (!noText) {
      for (let lineIdx = 0; lineIdx < titleLayout.lines.length; lineIdx++) {
        const line = titleLayout.lines[lineIdx];
        const lineWidth = titleFont.widthOfTextAtSize(line, fittedTitleSize);
        let lineX = blockX + innerMargin;
        if (settings.colors.answerPage.answerTitleAlignment === 'center') {
          lineX = blockX + (blockWidth - lineWidth) / 2;
        } else if (settings.colors.answerPage.answerTitleAlignment === 'right') {
          lineX = blockX + blockWidth - innerMargin - lineWidth;
        }

        // Clamp line X to KDP safety margin inside the block
        const minX = Math.max(blockX + innerMargin, safetyMarginPt);
        const maxX = Math.min(blockX + blockWidth - innerMargin - lineWidth, pageWidth - safetyMarginPt - lineWidth);
        lineX = Math.min(Math.max(lineX, minX), Math.max(minX, maxX));

        const lineY = answerTitleTopY - (lineIdx * fittedTitleLineHeightPt) - fittedTitleSize;
        page.drawText(line, {
          x: lineX,
          y: lineY,
          size: fittedTitleSize,
          font: titleFont,
          color: safeColor(settings.colors.answerPage.titleColor, '#000000'),
        });
      }
    }

    const gridStartX = block.gridLeftPt;
    const gridStartY = pageHeight - block.gridTopPt;

    const solutionGridBorder = resolveSolutionGridBorder(settings.core);
    const borderB = solutionGridBorder.strokeThicknessPx;
    const extraPadPt = cssPxToPoints(solutionGridBorder.paddingPx);

    const solutionBorderGeom = computeGridBorderGeometry(
      gridStartX,
      gridStartY - gridHeight,
      gridWidth,
      gridHeight,
      extraPadPt,
      borderB,
      solutionGridBorder.cornerRadiusPx,
      (settings.core.noBoxAroundPuzzle ?? false) || Boolean(puzzle.shapeMask)
    );

    if (solutionBorderGeom) {
      drawGridBorder(
        page,
        solutionBorderGeom,
        safeColor(settings.colors.answerPage.boxColor, '#000000'),
        { fill: true, stroke: false }
      );
    }

    await drawShapeMaskImageOnPdfPage(
      pdfDoc,
      page,
      settings,
      puzzle,
      gridStartX,
      gridStartY - gridHeight,
      gridWidth,
      gridHeight
    );

    const answerGridFontSize = getSolutionGridFontSize(settings.typography);

    // Solution Grid Cell Dimensions (EXACT BASELINE MATH)
    const solutionCellWidth = cellSize; // Each cell is cellSize wide
    const solutionCellHeight = cellSize; // Each cell is cellSize tall
    const solutionTotalColumns = puzzle.grid[0].length;
    const solutionTotalRows = puzzle.grid.length;

    // Render letters — centred in each cell, scaled to fit
    for (let row = 0; row < solutionTotalRows; row++) {
      for (let col = 0; col < solutionTotalColumns; col++) {
        if (!isWordSearchShapeCell(puzzle.shapeMask, row, col)) continue;
        const letter = puzzle.grid[row][col];
        if (!letter) continue;
        const cell = getGridCellRectPdf(
          gridStartX,
          gridStartY,
          col,
          row,
          solutionCellWidth,
          solutionCellHeight
        );
        const draw = getPdfLetterDrawCoordsAtRequestedSize(
          gridFont,
          letter,
          answerGridFontSize,
          cell
        );

        if (!noText) {
          const fillHex = settings.colors.puzzlePage.puzzleColor || '#000000';
          const strokeHex =
            settings.colors.puzzlePage.puzzleLetterStrokeColor || '#000000';
          const strokeThicknessPt = Math.max(
            0,
            cssPxToPoints(settings.colors.puzzlePage.puzzleLetterStrokeThickness ?? 0)
          );
          drawPdfLetterGlyph(page, letter, {
            x: draw.x,
            y: draw.y,
            size: draw.size,
            font: gridFont,
            fillColor: safeColor(fillHex, '#000000'),
            strokeColor: safeColor(strokeHex, '#000000'),
            strokeThicknessPt,
            opacity: safeOpacity(fillHex),
          });
        }
      }
    }

    if (solutionBorderGeom) {
      drawGridBorder(
        page,
        solutionBorderGeom,
        safeColor(settings.colors.answerPage.boxColor, '#000000'),
        { fill: false, stroke: true }
      );
    }

    if (puzzle.placements && puzzle.placements.length > 0) {
      const fillColorHex = settings.colors.answerPage.solutionFrameColor || '#000000';
      const fillColor = safeColor(fillColorHex);
      const highlightStrokeHex =
        settings.colors.answerPage.solutionHighlightStrokeColor || '#000000';
      const highlightStrokeColor = safeColor(highlightStrokeHex);
      const highlightStrokePt = Math.max(
        0,
        cssPxToPoints(settings.colors.answerPage.solutionHighlightStrokeThickness ?? 0)
      );
      const strokeWidth = settings.colors.answerPage.solutionStrokeThickness || 12;

      for (const placement of puzzle.placements) {
        const solutionPath = getPDFSolutionPaths(
          {
            word: placement.word,
            startX: placement.start.col,
            startY: placement.start.row,
            endX: placement.end.col,
            endY: placement.end.row,
            cellSize,
          },
          {
            mode: 'line-highlight',
            color: fillColorHex,
            thickness: strokeWidth,
            padding: 0,
            frameRadius: settings.colors.answerPage.solutionFrameRadius || 4,
            solutionHighlightMode: 'box-frame',
            solutionLineCap: 'round',
            alpha: settings.colors.answerPage.solutionHighlightAlpha ?? 30,
          }
        );

        if (!solutionPath) continue;

        const opacity =
          (solutionPath.opacity ?? 1) * safeOpacity(fillColorHex);
        const lineCap = solutionPath.lineCap || 'butt';
        const bodyThickness = solutionPath.thickness || strokeWidth;

        if (
          solutionPath.type === 'line' &&
          solutionPath.startX !== undefined &&
          solutionPath.startY !== undefined &&
          solutionPath.endX !== undefined &&
          solutionPath.endY !== undefined
        ) {
          const start = {
            x: gridStartX + solutionPath.startX,
            y: gridStartY - solutionPath.startY,
          };
          const end = {
            x: gridStartX + solutionPath.endX,
            y: gridStartY - solutionPath.endY,
          };

          // Outer stroke outline (behind fill) when configured.
          if (highlightStrokePt > 0) {
            page.drawLine({
              start,
              end,
              color: highlightStrokeColor,
              thickness: bodyThickness + highlightStrokePt * 2,
              opacity: Math.min(1, opacity + 0.25),
              lineCap: mapSolutionLineCap(lineCap),
            });
          }

          page.drawLine({
            start,
            end,
            color: fillColor,
            thickness: bodyThickness,
            opacity,
            lineCap: mapSolutionLineCap(lineCap),
          });
        }
      }
    }
  }

  drawPageContainerFrame(page, pageWidth, pageHeight, resolvePageFrameSettings(settings));

  if (!noText && pageNumberFont) {
    await drawPageNumberOnPdfPage(
      pdfDoc,
      page,
      pageWidth,
      pageHeight,
      settings,
      bookPageIndex,
      pageNumberFont,
      safeColor
    );
  }
}

function getPageDimensionsFromSettings(settings: WordSearchSettings): { pageWidth: number; pageHeight: number; margin: number } {
  const pageWidth = inchesToPoints(settings.bookCanvas.customWidth || 8.5);
  const pageHeight = inchesToPoints(settings.bookCanvas.customHeight || 11);
  const margin = settings.bookCanvas.includeBleed ? inchesToPoints(0.125) : inchesToPoints(0.5);
  return { pageWidth, pageHeight, margin };
}

function getTitleWordsForDocument(
  documentPages: DocumentPage[],
  documentId: string,
  fallback: TitleWordsSettings
): TitleWordsSettings {
  const doc = documentPages.find((page) => page.id === documentId);
  if (doc?.moduleType === 'word-search' || doc?.moduleType === 'crossword') {
    return (doc.settings as PuzzleModuleSettings).titleWords ?? fallback;
  }
  return fallback;
}

function buildBaseSettingsFromWordSearch(
  bookSettings: ExportOptions['bookSettings'],
  wordSearchSettings: WordSearchSettings
): WordSearchSettings {
  return {
    bookCanvas: {
      includeBleed: bookSettings.includeBleed || false,
      useCustomTrim: bookSettings.useCustomTrim || false,
      customWidth: bookSettings.customWidth || 8.5,
      customHeight: bookSettings.customHeight || 11,
      puzzleType: 'word-search' as const,
      answersPerPage: bookSettings.answersPerPage || 1,
      includePageBetweenPuzzleAndSolutions: bookSettings.includePageBetweenPuzzleAndSolutions || false,
    },
    core: {
      numberOfPuzzles: wordSearchSettings?.core?.numberOfPuzzles || 1,
      puzzlesStartingNumber: wordSearchSettings?.core?.puzzlesStartingNumber || 1,
      twoPagePuzzles: wordSearchSettings?.core?.twoPagePuzzles ?? false,
      lettersAcross: wordSearchSettings?.core?.lettersAcross || 20,
      lettersDown: wordSearchSettings?.core?.lettersDown || 20,
      allowRight: wordSearchSettings?.core?.allowRight ?? true,
      allowLeft: wordSearchSettings?.core?.allowLeft ?? true,
      allowDown: wordSearchSettings?.core?.allowDown ?? true,
      allowUp: wordSearchSettings?.core?.allowUp ?? true,
      allowDiagonalDown: wordSearchSettings?.core?.allowDiagonalDown ?? true,
      allowDiagonalUp: wordSearchSettings?.core?.allowDiagonalUp ?? true,
      allowDiagonalDownReverse: wordSearchSettings?.core?.allowDiagonalDownReverse ?? true,
      allowDiagonalUpReverse: wordSearchSettings?.core?.allowDiagonalUpReverse ?? true,
      noBoxAroundPuzzle: wordSearchSettings?.core?.noBoxAroundPuzzle ?? false,
      borderCornerRadius: wordSearchSettings?.core?.borderCornerRadius ?? 4,
      solutionBorderStrokeThickness:
        wordSearchSettings?.core?.solutionBorderStrokeThickness ??
        wordSearchSettings?.core?.borderStrokeThickness ??
        2,
      solutionBorderCornerRadius:
        wordSearchSettings?.core?.solutionBorderCornerRadius ??
        wordSearchSettings?.core?.borderCornerRadius ??
        4,
      addGridLines: wordSearchSettings?.core?.addGridLines ?? true,
      borderStrokeThickness: wordSearchSettings?.core?.borderStrokeThickness ?? 2,
      gridBorderPadding: wordSearchSettings?.core?.gridBorderPadding ?? 0,
      solutionGridBorderPadding:
        wordSearchSettings?.core?.solutionGridBorderPadding ??
        wordSearchSettings?.core?.gridBorderPadding ??
        0,
      gridLinesStrokeThickness: wordSearchSettings?.core?.gridLinesStrokeThickness ?? 0,
      innerGridOpacity: wordSearchSettings?.core?.innerGridOpacity ?? 0,
      shapeWordSearchEnabled: wordSearchSettings?.core?.shapeWordSearchEnabled ?? false,
      shapeMaskMode: wordSearchSettings?.core?.shapeMaskMode ?? 'common',
      shapeMaskImage: wordSearchSettings?.core?.shapeMaskImage,
      shapeMaskImages: wordSearchSettings?.core?.shapeMaskImages ?? [],
      shapeMaskAlphaThreshold: wordSearchSettings?.core?.shapeMaskAlphaThreshold ?? 40,
      shapeMaskFit: wordSearchSettings?.core?.shapeMaskFit ?? 'contain',
      shapeMaskShowImage: wordSearchSettings?.core?.shapeMaskShowImage ?? false,
      shapeMaskImageOpacity: wordSearchSettings?.core?.shapeMaskImageOpacity ?? 35,
    },
    typography: {
      selectTitleOption: wordSearchSettings?.typography?.selectTitleOption || 'none',
      puzzleTitleFontSize: wordSearchSettings?.typography?.puzzleTitleFontSize || 20,
      puzzleTitleFontFamily: wordSearchSettings?.typography?.puzzleTitleFontFamily || 'Arial',
      titleText: wordSearchSettings?.typography?.titleText || '',
      includeFunFacts: wordSearchSettings?.typography?.includeFunFacts || false,
      funFactsText: wordSearchSettings?.typography?.funFactsText || '',
      subtitleFontSize: wordSearchSettings?.typography?.subtitleFontSize || 14,
      subtitleBoxMargin: wordSearchSettings?.typography?.subtitleBoxMargin ?? 0,
      subtitleToTitleGap: wordSearchSettings?.typography?.subtitleToTitleGap ?? 10,
      subtitleToPuzzleGap: wordSearchSettings?.typography?.subtitleToPuzzleGap ?? 10,
      puzzleGridFontSize: wordSearchSettings?.typography?.puzzleGridFontSize || 18,
      puzzleGridFontFamily: wordSearchSettings?.typography?.puzzleGridFontFamily || 'Arial',
      puzzleGridCase: wordSearchSettings?.typography?.puzzleGridCase || 'upper',
      spaceBetweenTitleAndPuzzle: wordSearchSettings?.typography?.spaceBetweenTitleAndPuzzle ?? 20,
      titleStartAt: wordSearchSettings?.typography?.titleStartAt ?? DEFAULT_TITLE_START_AT,
      answerTitleFontSize: wordSearchSettings?.typography?.answerTitleFontSize || 20,
      setFontForAnswerPages: wordSearchSettings?.typography?.setFontForAnswerPages || false,
      answerGridFontFamily: wordSearchSettings?.typography?.answerGridFontFamily || 'Arial',
      spaceBetweenPuzzleAndWordList: wordSearchSettings?.typography?.spaceBetweenPuzzleAndWordList ?? 30,
      setFontSizeForAnswerPages:
        wordSearchSettings?.typography?.setFontSizeForAnswerPages ||
        Number(wordSearchSettings?.typography?.answerGridFontSize) > 0,
      answerGridFontSize: wordSearchSettings?.typography?.answerGridFontSize || 18,
      spaceBetweenTitleAndAnswer: wordSearchSettings?.typography?.spaceBetweenTitleAndAnswer ?? 40,
      puzzleNumberingStyle: (wordSearchSettings?.typography?.puzzleNumberingStyle as 'none' | 'prefix' | 'suffix') || 'none',
      solutionTitleStyle: (wordSearchSettings?.typography?.solutionTitleStyle as 'same_as_puzzle' | 'custom') || 'same_as_puzzle',
      customSolutionTitle: wordSearchSettings?.typography?.customSolutionTitle || 'Solutions',
      solutionNumberingStyle: (wordSearchSettings?.typography?.solutionNumberingStyle as 'none' | 'prefix' | 'suffix') || 'none',
      pageNumber: normalizePageNumberSettings(wordSearchSettings?.typography?.pageNumber),
    },
    wordList: {
      hideWordList: wordSearchSettings?.wordList?.hideWordList || false,
      wordsPerPuzzle: wordSearchSettings?.wordList?.wordsPerPuzzle || 10,
      selectWordListOption: wordSearchSettings?.wordList?.selectWordListOption || 'manual',
      aiTheme: wordSearchSettings?.wordList?.aiTheme || '',
      aiLanguage: wordSearchSettings?.wordList?.aiLanguage || 'English',
      aiAgeLevel: wordSearchSettings?.wordList?.aiAgeLevel || 'Adult',
      aiMaxWordLength: wordSearchSettings?.wordList?.aiMaxWordLength || 10,
      wordListFontFamily: wordSearchSettings?.wordList?.wordListFontFamily || 'Arial',
      wordListFontSize: wordSearchSettings?.wordList?.wordListFontSize || 12,
      wordListCase: wordSearchSettings?.wordList?.wordListCase || 'upper',
      wordListDirection: wordSearchSettings?.wordList?.wordListDirection || 'vertical',
      wordListColumns: wordSearchSettings?.wordList?.wordListColumns || 2,
      wordSpacingHorizontal:
        wordSearchSettings?.wordList?.wordSpacingHorizontal ??
        wordSearchSettings?.wordList?.wordListGap ??
        DEFAULT_WORD_SPACING_HORIZONTAL,
      wordSpacingVertical:
        wordSearchSettings?.wordList?.wordSpacingVertical ??
        wordSearchSettings?.wordList?.wordListGap ??
        8,
      addCheckboxes: wordSearchSettings?.wordList?.addCheckboxes || false,
      dontAlphabetize: wordSearchSettings?.wordList?.dontAlphabetize || false,
      addSpaceForGraphics: wordSearchSettings?.wordList?.addSpaceForGraphics || false,
      includeTitleAboveList: wordSearchSettings?.wordList?.includeTitleAboveList || false,
    },
    colors: {
      puzzlePage: {
        backgroundColor: wordSearchSettings?.colors?.puzzlePage?.backgroundColor || '#ffffff',
        titleColor: wordSearchSettings?.colors?.puzzlePage?.titleColor || '#1f2937',
        subtitleColor: wordSearchSettings?.colors?.puzzlePage?.subtitleColor || '#6b7280',
        boxColor: wordSearchSettings?.colors?.puzzlePage?.boxColor || '#1f2937',
        puzzleColor: wordSearchSettings?.colors?.puzzlePage?.puzzleColor || '#1f2937',
        puzzleLetterStrokeColor:
          wordSearchSettings?.colors?.puzzlePage?.puzzleLetterStrokeColor || '#000000',
        puzzleLetterStrokeThickness:
          wordSearchSettings?.colors?.puzzlePage?.puzzleLetterStrokeThickness ?? 0,
        wordListTitleColor: wordSearchSettings?.colors?.puzzlePage?.wordListTitleColor || '#374151',
        wordListColor: wordSearchSettings?.colors?.puzzlePage?.wordListColor || '#4b5563',
        backgroundImage: wordSearchSettings?.colors?.puzzlePage?.backgroundImage,
        backgroundImageOpacity: wordSearchSettings?.colors?.puzzlePage?.backgroundImageOpacity,
        backgroundImageFit: wordSearchSettings?.colors?.puzzlePage?.backgroundImageFit,
        backgroundImageFrameEnabled: wordSearchSettings?.colors?.puzzlePage?.backgroundImageFrameEnabled,
        backgroundImageFrameMargin: wordSearchSettings?.colors?.puzzlePage?.backgroundImageFrameMargin,
        headerAssembly: normalizeHeaderAssemblySettings(
          (wordSearchSettings?.colors?.puzzlePage as { headerAssembly?: unknown; headerLayout?: unknown })
            ?.headerAssembly ??
            migrateLegacyHeaderLayout(
              (wordSearchSettings?.colors?.puzzlePage as { headerLayout?: Record<string, unknown> })
                ?.headerLayout
            )
        ),
      },
      answerPage: {
        backgroundColor: wordSearchSettings?.colors?.answerPage?.backgroundColor || '#ffffff',
        titleColor: wordSearchSettings?.colors?.answerPage?.titleColor || '#1f2937',
        boxColor: wordSearchSettings?.colors?.answerPage?.boxColor || '#1f2937',
        lettersInSolutionColor: wordSearchSettings?.colors?.answerPage?.lettersInSolutionColor || '#000000',
        lettersNotInSolutionColor: wordSearchSettings?.colors?.answerPage?.lettersNotInSolutionColor || '#000000',
        solutionStrokeThickness: wordSearchSettings?.colors?.answerPage?.solutionStrokeThickness ?? 12,
        solutionStrokePadding: wordSearchSettings?.colors?.answerPage?.solutionStrokePadding ?? 2,
        solutionFrameColor: wordSearchSettings?.colors?.answerPage?.solutionFrameColor || '#000000',
        solutionHighlightStrokeColor:
          wordSearchSettings?.colors?.answerPage?.solutionHighlightStrokeColor || '#000000',
        solutionHighlightStrokeThickness:
          wordSearchSettings?.colors?.answerPage?.solutionHighlightStrokeThickness ?? 0,
        solutionFrameStyle: wordSearchSettings?.colors?.answerPage?.solutionFrameStyle || 'rounded',
        solutionFrameRadius: wordSearchSettings?.colors?.answerPage?.solutionFrameRadius ?? 4,
        solutionHighlightAlpha: wordSearchSettings?.colors?.answerPage?.solutionHighlightAlpha ?? 30,
        answerTitlePrefix: wordSearchSettings?.colors?.answerPage?.answerTitlePrefix || 'Solution',
        answerTitleFontFamily: wordSearchSettings?.colors?.answerPage?.answerTitleFontFamily || 'Arial',
        answerTitleFontSize: wordSearchSettings?.colors?.answerPage?.answerTitleFontSize || 20,
        answerTitleAlignment: wordSearchSettings?.colors?.answerPage?.answerTitleAlignment || 'center',
        showAnswerNumber: wordSearchSettings?.colors?.answerPage?.showAnswerNumber || false,
        backgroundImage: wordSearchSettings?.colors?.answerPage?.backgroundImage,
        backgroundImageOpacity: wordSearchSettings?.colors?.answerPage?.backgroundImageOpacity,
        backgroundImageFit: wordSearchSettings?.colors?.answerPage?.backgroundImageFit,
        backgroundImageFrameEnabled: wordSearchSettings?.colors?.answerPage?.backgroundImageFrameEnabled,
        backgroundImageFrameMargin: wordSearchSettings?.colors?.answerPage?.backgroundImageFrameMargin,
      },
    },
    pageFrameSettings: wordSearchSettings?.pageFrameSettings,
  };
}

export async function generatePuzzlePDF(options: ExportOptions): Promise<Uint8Array> {
  const { bookSettings, titleWords, wordSearchSettings, puzzles, includeSolution, onlySolutions = false, puzzleGridScale = 70, titleToAnswerGap = 10, pageMargin = 40, solutionToSolutionGap = 14, pageOverrides = new Map(), applyMode = new Map(), documentPages, onProgress } = options;

  const report = (status: string) => {
    try {
      onProgress?.(status);
    } catch {
      // UI progress callbacks must never abort export.
    }
  };

  const yieldToUi = () =>
    new Promise<void>((resolve) => {
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });

  report('Preparing PDF…');

  const baseSettings = buildBaseSettingsFromWordSearch(bookSettings, wordSearchSettings);
  const defaultDimensions = getPageDimensionsFromSettings(baseSettings);
  let pageWidth = defaultDimensions.pageWidth;
  let pageHeight = defaultDimensions.pageHeight;
  let margin = defaultDimensions.margin;

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const backgroundCache = new FlattenedBackgroundPdfCache();

  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit.default ?? fontkit);

  // Font cache to avoid re-embedding the same fonts
  const fontCache = new Map<string, PDFFont>();

  /**
   * Enhanced getOrEmbedFont: maps UI font weight to PDF bold font object.
   * Accepts fontFamily and fontWeight (string or number).
   * If fontWeight is 'bold', 'black', >=700, or true, uses bold variant.
   * Applies per-component (grid, word list, titles).
   */
  const getOrEmbedFont = async (
    fontFamily: string,
    fontWeight: string | number | boolean = false
  ): Promise<PDFFont> => {
    const bold = isBoldFontWeight(fontWeight);
    const key = `${fontFamily}:${bold ? 'bold' : 'regular'}`;
    if (!fontCache.has(key)) {
      fontCache.set(key, await embedStandardFont(pdfDoc, fontFamily, bold));
    }
    return fontCache.get(key)!;
  };

  if (documentPages && documentPages.length > 0 && !onlySolutions) {
    const layoutSettingsRaw = resolveLayoutSettingsForExport(documentPages, baseSettings);
    const layoutSettings: WordSearchSettings = {
      ...layoutSettingsRaw,
      bookCanvas: {
        ...layoutSettingsRaw.bookCanvas,
        customWidth: bookSettings.customWidth || layoutSettingsRaw.bookCanvas.customWidth || 8.5,
        customHeight: bookSettings.customHeight || layoutSettingsRaw.bookCanvas.customHeight || 11,
        includeBleed: bookSettings.includeBleed ?? layoutSettingsRaw.bookCanvas.includeBleed,
        useCustomTrim: bookSettings.useCustomTrim ?? layoutSettingsRaw.bookCanvas.useCustomTrim,
      },
    };
    const pagesForBook = overlayBookLayoutOnAllDocuments(documentPages, layoutSettings);
    const pageNumberSettings = resolvePageNumberSettingsForBook(pagesForBook, baseSettings);
    const puzzleMap = groupPuzzlesByDocument(puzzles, pagesForBook);
    const crosswordMap = groupCrosswordPuzzlesByDocument(
      options.crosswordPuzzles ?? [],
      pagesForBook
    );
    const genericMap = groupGenericPuzzlesByDocument(
      options.genericPuzzles ?? [],
      pagesForBook
    );
    const murdokuMap = groupMurdokuPuzzlesByDocument(
      options.murdokuPuzzles ?? [],
      pagesForBook
    );
    const compiled = compileBook(pagesForBook, puzzleMap, {
      includeSolutions: includeSolution,
      pageNumberSettings,
      crosswordPuzzlesByDocumentId: crosswordMap,
      crosswordPageOverrides: options.crosswordPageOverrides,
      genericPuzzlesByDocumentId: genericMap,
      genericPageOverrides: options.genericPageOverrides,
      murdokuPuzzlesByDocumentId: murdokuMap,
      mixPuzzles: Boolean(bookSettings.mixPuzzles),
      chapterTopics: bookSettings.chapterTopics,
    });

    const layoutDims = getPageDimensionsFromSettings(layoutSettings);
    pageWidth = layoutDims.pageWidth;
    pageHeight = layoutDims.pageHeight;
    margin = layoutDims.margin;

    const layoutPageNumberFont = await getOrEmbedFont(pageNumberSettings.fontFamily || 'Arial', true);

    const totalPages = compiled.pages.length;

    for (let pageIdx = 0; pageIdx < compiled.pages.length; pageIdx++) {
      const compiledPage = compiled.pages[pageIdx];
      report(`Rendering page ${pageIdx + 1} of ${totalPages}…`);
      await yieldToUi();

      const allowPageNumber = shouldDrawBookPageNumber(
        compiledPage.bookPageIndex,
        compiled.pages
      );

      if (compiledPage.kind === 'text') {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const textSettings = compiledPage.settings;
        const bodyFont = await getOrEmbedFont(textSettings.fontFamily || 'Arial', false);
        const titleFont = await getOrEmbedFont(textSettings.fontFamily || 'Arial', true);
        await drawTextModuleOnPdfPage(
          pdfDoc,
          page,
          textSettings,
          layoutSettings,
          pageWidth,
          pageHeight,
          bodyFont,
          titleFont,
          compiledPage.bookPageIndex,
          layoutPageNumberFont,
          safeColor,
          drawPageBackground,
          drawPageContainerFrame,
          backgroundCache,
          options.noText,
          compiledPage.sourceDocumentName,
          getOrEmbedFont,
          compiledPage.resolvedToc,
          !allowPageNumber,
          compiledPage.moduleType
        );
        continue;
      }

      if (compiledPage.kind === 'blank') {
        const ws = resolveLayoutSettingsForExport(documentPages, baseSettings);
        const blankPage = pdfDoc.addPage([pageWidth, pageHeight]);
        const blankFrame = resolvePageFrameSettings(ws);
        const blankBg = puzzlePageBackgroundConfig(
          pageWidth,
          pageHeight,
          ws.colors.puzzlePage,
          blankFrame.cornerRadiusPx,
          {
            frameEnabled: blankFrame.enabled,
            frameMarginIn: blankFrame.marginSizeIn,
          }
        );
        await drawPageBackground(pdfDoc, blankPage, pageWidth, pageHeight, blankBg, backgroundCache);
        drawPageContainerFrame(blankPage, pageWidth, pageHeight, blankFrame);
        if (!options.noText && allowPageNumber) {
          await drawPageNumberOnPdfPage(
            pdfDoc,
            blankPage,
            pageWidth,
            pageHeight,
            ws,
            compiledPage.bookPageIndex,
            layoutPageNumberFont,
            safeColor
          );
        }
        continue;
      }

      // Crossword / maze / sudoku / trivia / scramble: native PDF text + lines.
      if (isGenericOrCrosswordPageKind(compiledPage.kind)) {
        await addNativeGenericOrCrosswordPdfPage(
          pdfDoc,
          compiledPage,
          layoutSettings,
          documentPages,
          titleWords,
          backgroundCache,
          getOrEmbedFont,
          !allowPageNumber
        );
        continue;
      }

      // Unknown page kinds still rasterize from the preview canvas.
      if (!isNativelyDrawnPageKind(compiledPage.kind)) {
        const snapshot = await captureCompiledPageSnapshot(compiledPage, {
          documentPages,
          layoutSettings,
          titleWords,
        });

        const snapDims = getPageDimensionsFromSettings(layoutSettings);
        const snapPage = pdfDoc.addPage([snapDims.pageWidth, snapDims.pageHeight]);
        const decoded = snapshot ? decodeBase64DataUrl(snapshot.dataUrl) : null;
        if (decoded) {
          const image =
            decoded.mimeType.includes('jpeg') || decoded.mimeType.includes('jpg')
              ? await pdfDoc.embedJpg(decoded.bytes)
              : await pdfDoc.embedPng(decoded.bytes);
          snapPage.drawImage(image, {
            x: 0,
            y: 0,
            width: snapDims.pageWidth,
            height: snapDims.pageHeight,
          });
        }
        continue;
      }

      const ws = buildBaseSettingsFromWordSearch(
        {
          ...bookSettings,
          ...compiledPage.wordSearchSettings.bookCanvas,
        },
        compiledPage.wordSearchSettings
      );
      const sectionDims = getPageDimensionsFromSettings(ws);
      pageWidth = sectionDims.pageWidth;
      pageHeight = sectionDims.pageHeight;
      margin = sectionDims.margin;

      const docTitleWords = getTitleWordsForDocument(
        documentPages,
        compiledPage.sourceDocumentId,
        titleWords
      );
      const effectiveSettings = getMergedSettingsForPage(
        ws,
        pageOverrides,
        applyMode,
        compiledPage.bookPageIndex
      );
      const sectionPageNumberFont = await getOrEmbedFont(
        normalizePageNumberSettings(effectiveSettings.typography.pageNumber).fontFamily || 'Arial',
        true
      );

      if (compiledPage.kind === 'puzzle') {
        const puzzle = compiledPage.puzzle;
        puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
          {
            ...puzzle,
            puzzleIndexInDocument: compiledPage.puzzleIndexInDocument,
          },
          effectiveSettings,
          compiledPage.puzzleIndexInDocument
        );
        const puzzleGridFont = await getOrEmbedFont(
          effectiveSettings.typography.puzzleGridFontFamily || 'Arial',
          effectiveSettings.typography.puzzleGridFontWeight || false
        );
        const wordListFont = await getOrEmbedFont(
          effectiveSettings.wordList.wordListFontFamily || 'Arial',
          effectiveSettings.wordList.wordListFontWeight || false
        );
        const puzzleTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.typography.puzzleTitleFontFamily || 'Arial',
          effectiveSettings.typography.puzzleTitleFontWeight || true
        );
        const puzzleSubtitleFont = await getOrEmbedFont(
          effectiveSettings.typography.puzzleTitleFontFamily || 'Arial',
          false
        );
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        await drawWordSearchPuzzle(
          pdfDoc,
          page,
          puzzle,
          effectiveSettings,
          docTitleWords,
          puzzleGridFont,
          wordListFont,
          puzzleTitleBoldFont,
          puzzleSubtitleFont,
          pageWidth,
          pageHeight,
          margin,
          false,
          puzzleGridScale,
          options.noText,
          titleToAnswerGap,
          backgroundCache,
          undefined,
          compiledPage.bookPageIndex,
          allowPageNumber ? sectionPageNumberFont : undefined,
          compiledPage.pagePart ?? 'clues'
        );
        continue;
      }

      if (compiledPage.kind === 'solution') {
        const chunkSize = effectiveSettings.bookCanvas.answersPerPage || 1;
        const answerGridFont = await getOrEmbedFont(
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontFamily || 'Arial'
            : effectiveSettings.typography.puzzleGridFontFamily || 'Arial',
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontWeight || false
            : effectiveSettings.typography.puzzleGridFontWeight || false
        );
        const answerTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Arial',
          effectiveSettings.colors.answerPage.answerTitleFontWeight || true
        );
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const solutionPageNumberFont = allowPageNumber ? sectionPageNumberFont : undefined;

        if (chunkSize === 1) {
          const puzzle = compiledPage.puzzles[0];
          puzzle.puzzleNumber = resolvePuzzleDisplayNumber(puzzle, effectiveSettings, 0);
          const wordListFont = await getOrEmbedFont(
            effectiveSettings.wordList.wordListFontFamily || 'Arial',
            effectiveSettings.wordList.wordListFontWeight || false
          );
          const answerSubtitleFont = await getOrEmbedFont(
            effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Arial',
            false
          );
          await drawWordSearchPuzzle(
            pdfDoc,
            page,
            puzzle,
            effectiveSettings,
            docTitleWords,
            answerGridFont,
            wordListFont,
            answerTitleBoldFont,
            answerSubtitleFont,
            pageWidth,
            pageHeight,
            margin,
            true,
            puzzleGridScale,
            options.noText,
            titleToAnswerGap,
            backgroundCache,
            undefined,
            compiledPage.bookPageIndex,
            solutionPageNumberFont
          );
        } else {
          await drawWordSearchSolutionPage(
            pdfDoc,
            page,
            compiledPage.puzzles,
            effectiveSettings,
            docTitleWords,
            answerGridFont,
            answerTitleBoldFont,
            pageWidth,
            pageHeight,
            margin,
            titleToAnswerGap,
            pageMargin,
            solutionToSolutionGap,
            options.noText,
            backgroundCache,
            compiledPage.bookPageIndex,
            solutionPageNumberFont
          );
        }
      }
    }

    report('Generating PDF file…');
    await yieldToUi();
    return await pdfDoc.save();
  }

  // Draw puzzle pages (skip if only showing solutions)
  let currentPageIndex = 0;

  let estimatedTotalPages = 0;
  if (!onlySolutions) {
    for (let i = 0; i < puzzles.length; i++) {
      estimatedTotalPages += 1;
      const settingsForCount = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, i);
      if (settingsForCount.bookCanvas.includePageBetweenPuzzleAndSolutions) {
        estimatedTotalPages += 1;
      }
    }
  }
  if (includeSolution) {
    const chunkSize = baseSettings.bookCanvas.answersPerPage || 1;
    estimatedTotalPages +=
      chunkSize <= 1 ? puzzles.length : Math.ceil(puzzles.length / Math.max(1, chunkSize));
  }
  let renderedPageCount = 0;
  const reportLegacyPage = async () => {
    renderedPageCount += 1;
    if (estimatedTotalPages > 0) {
      report(`Rendering page ${renderedPageCount} of ${estimatedTotalPages}…`);
    } else {
      report(`Rendering page ${renderedPageCount}…`);
    }
    await yieldToUi();
  };

  const bookHeaderTitleSizeEntries = !onlySolutions
    ? puzzles.map((puzzle, puzzleIndex) => ({
        puzzle,
        settings: getMergedSettingsForPage(
          baseSettings,
          pageOverrides,
          applyMode,
          puzzleIndex
        ),
      }))
    : [];
  const bookHeaderTitleFontSizePt = computeBookHeaderTitleFontSizePt(
    bookHeaderTitleSizeEntries,
    titleWords
  );

  if (!onlySolutions) {
    for (let puzzleIndex = 0; puzzleIndex < puzzles.length; puzzleIndex++) {
      const puzzle = puzzles[puzzleIndex];
      // Ensure display number respects Quantity → Starting Number
      puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
        puzzle,
        getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, puzzleIndex),
        puzzleIndex
      );

      // Get effective settings for this page (with page overrides merged in)
      const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

      // Get fonts for this page's settings, mapping UI font weights to PDF bold objects
      const puzzleGridFont = await getOrEmbedFont(
        effectiveSettings.typography.puzzleGridFontFamily || 'Arial',
        effectiveSettings.typography.puzzleGridFontWeight || false
      );
      const wordListFont = await getOrEmbedFont(
        effectiveSettings.wordList.wordListFontFamily || 'Arial',
        effectiveSettings.wordList.wordListFontWeight || false
      );
      const puzzleTitleBoldFont = await getOrEmbedFont(
        effectiveSettings.typography.puzzleTitleFontFamily || 'Arial',
        effectiveSettings.typography.puzzleTitleFontWeight || true // Default to bold for title
      );
      const puzzleSubtitleFont = await getOrEmbedFont(
        effectiveSettings.typography.puzzleTitleFontFamily || 'Arial',
        false
      );
      const pageNumberFont = await getOrEmbedFont(
        normalizePageNumberSettings(effectiveSettings.typography.pageNumber).fontFamily || 'Arial',
        true
      );

      const cluePage = pdfDoc.addPage([pageWidth, pageHeight]);
      await reportLegacyPage();
      await drawWordSearchPuzzle(
        pdfDoc,
        cluePage,
        puzzle,
        effectiveSettings,
        titleWords,
        puzzleGridFont,
        wordListFont,
        puzzleTitleBoldFont,
        puzzleSubtitleFont,
        pageWidth,
        pageHeight,
        margin,
        false,
        puzzleGridScale,
        options.noText,
        titleToAnswerGap,
        backgroundCache,
        bookHeaderTitleFontSizePt,
        currentPageIndex,
        pageNumberFont,
        'clues'
      );

      currentPageIndex++;

      if (effectiveSettings.core.twoPagePuzzles) {
        const gridPage = pdfDoc.addPage([pageWidth, pageHeight]);
        await reportLegacyPage();
        await drawWordSearchPuzzle(
          pdfDoc,
          gridPage,
          puzzle,
          effectiveSettings,
          titleWords,
          puzzleGridFont,
          wordListFont,
          puzzleTitleBoldFont,
          puzzleSubtitleFont,
          pageWidth,
          pageHeight,
          margin,
          false,
          puzzleGridScale,
          options.noText,
          titleToAnswerGap,
          backgroundCache,
          bookHeaderTitleFontSizePt,
          currentPageIndex,
          pageNumberFont,
          'grid'
        );
        currentPageIndex++;
      }

      if (effectiveSettings.bookCanvas.includePageBetweenPuzzleAndSolutions) {
        const blankPage = pdfDoc.addPage([pageWidth, pageHeight]);
        await reportLegacyPage();
        const blankFrame = resolvePageFrameSettings(effectiveSettings);
        const blankBg = puzzlePageBackgroundConfig(
          pageWidth,
          pageHeight,
          effectiveSettings.colors.puzzlePage,
          blankFrame.cornerRadiusPx,
          {
            frameEnabled: blankFrame.enabled,
            frameMarginIn: blankFrame.marginSizeIn,
          }
        );
        await drawPageBackground(pdfDoc, blankPage, pageWidth, pageHeight, blankBg, backgroundCache);
        drawPageContainerFrame(blankPage, pageWidth, pageHeight, blankFrame);
        if (!options.noText) {
          await drawPageNumberOnPdfPage(
            pdfDoc,
            blankPage,
            pageWidth,
            pageHeight,
            effectiveSettings,
            currentPageIndex,
            pageNumberFont,
            safeColor
          );
        }
        currentPageIndex++;
      }
    }
  }

  // Draw solution pages
  if (includeSolution) {
    // For single-answer solution pages we should reuse the unified layout
    // (same math used by the preview canvas). For multi-answer pages keep
    // the compact solution layout.
    const chunkSize = baseSettings.bookCanvas.answersPerPage || 1;

    if (chunkSize === 1) {
      // One solution per page: draw each solution using the unified layout
      for (let pi = 0; pi < puzzles.length; pi++) {
        const puzzle = puzzles[pi];
        puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
          puzzle,
          getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex),
          pi
        );

        const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

        const answerGridFont = await getOrEmbedFont(
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontFamily || 'Arial'
            : effectiveSettings.typography.puzzleGridFontFamily || 'Arial',
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontWeight || false
            : effectiveSettings.typography.puzzleGridFontWeight || false
        );

        const wordListFont = await getOrEmbedFont(
          effectiveSettings.wordList.wordListFontFamily || 'Arial',
          effectiveSettings.wordList.wordListFontWeight || false
        );

        const answerTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Arial',
          effectiveSettings.colors.answerPage.answerTitleFontWeight || true
        );
        const answerSubtitleFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Arial',
          false
        );
        const pageNumberFont = await getOrEmbedFont(
          normalizePageNumberSettings(effectiveSettings.typography.pageNumber).fontFamily || 'Arial',
          true
        );

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        await reportLegacyPage();
        await drawWordSearchPuzzle(
          pdfDoc,
          page,
          puzzle,
          effectiveSettings,
          titleWords,
          answerGridFont,
          wordListFont,
          answerTitleBoldFont,
          answerSubtitleFont,
          pageWidth,
          pageHeight,
          margin,
          true, // showSolution
          puzzleGridScale,
          options.noText,
          titleToAnswerGap,
          backgroundCache,
          undefined,
          currentPageIndex,
          pageNumberFont
        );

        currentPageIndex++;
      }
    } else {
      // Multiple solutions per page: use the compact solution page renderer
      for (let i = 0; i < puzzles.length; i += chunkSize) {
        // Get effective settings for solution page
        const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

        const answerGridFont = await getOrEmbedFont(
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontFamily || 'Arial'
            : effectiveSettings.typography.puzzleGridFontFamily || 'Arial',
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontWeight || false
            : effectiveSettings.typography.puzzleGridFontWeight || false
        );
        const answerTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Arial',
          effectiveSettings.colors.answerPage.answerTitleFontWeight || true
        );
        const pageNumberFont = await getOrEmbedFont(
          normalizePageNumberSettings(effectiveSettings.typography.pageNumber).fontFamily || 'Arial',
          true
        );

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        await reportLegacyPage();
        const pagePuzzles = puzzles.slice(i, i + chunkSize);
        await drawWordSearchSolutionPage(
          pdfDoc,
          page,
          pagePuzzles,
          effectiveSettings,
          titleWords,
          answerGridFont,
          answerTitleBoldFont,
          pageWidth,
          pageHeight,
          margin,
          titleToAnswerGap,
          pageMargin,
          solutionToSolutionGap,
          options.noText,
          backgroundCache,
          currentPageIndex,
          pageNumberFont
        );

        currentPageIndex++;
      }
    }
  }

  report('Generating PDF file…');
  await yieldToUi();
  return await pdfDoc.save();
}

export function downloadPDF(data: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(data)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
