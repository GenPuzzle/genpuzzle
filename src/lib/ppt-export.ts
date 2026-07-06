/**
 * Direct Puzzle → PPT export (v4 — image-based grids with editable text overlays).
 *
 * Uses the SAME unified layout engine (computeWordSearchPageLayout) as the
 * preview canvas and PDF export, so the output matches the canvas exactly.
 *
 * Puzzle pages use native editable PPT elements (matching v3).
 * Solution grids use a hybrid approach for precision:
 *   • Grid structure (borders, lines, highlights) → rendered to PNG image
 *   • Letters → editable text elements overlaid on the image
 *
 * This preserves the exact appearance of the UI preview and PDF export while
 * maintaining letter editability and crispness without table limitations.
 *
 * Grid image rendering occurs in browser only (server-side returns null).
 * Fallback to table rendering if canvas unavailable.
 *
 * No PDF step, no pdfjs-dist, no server round-trip.
 * All coordinates are strictly sanitized (no NaN / undefined / Infinity).
 */

import {
  TitleWordsSettings,
  WordSearchPuzzle,
  WordSearchSettings,
} from "./puzzles/types";
import type { TextModuleSettings } from "./document-model";
import {
  computeWordSearchPageLayout,
  distributeWordsIntoColumns,
  UnifiedPageLayout,
} from "./word-search-page-layout";
import { cssPxToPoints, getPageMarginInches } from "./puzzle-layout";
import { getSolutionGridFontSize } from "./puzzle-layout";
import { getMergedSettingsForPage } from "./page-settings";
import { captureGridSnapshot } from "./solution-canvas-snapshot";
import { addHeaderAssemblyToSlide } from "./header-assembly-ppt-draw";
import {
  FlattenedBackgroundPptCache,
  applyFlattenedBackgroundToSlide,
  puzzlePageBackgroundConfig,
  answerPageBackgroundConfig,
} from "./unified-background";
import { resolvePageFrameSettings, DEFAULT_PAGE_FRAME_SETTINGS } from "./page-frame-settings";
import {
  resolvePuzzleGridBorder,
  resolveSolutionGridBorder,
} from "./grid-border-settings";
import type { PageFrameSettings } from "./puzzles/types";
import {
  computeGridBorderOuterBounds,
  getGridBorderThicknessPt,
} from "./grid-border-geometry";
import { computeSolutionPageLayout } from "./solution-page-layout";
import { computeBookHeaderTitleFontSizePt } from "./header-assembly/book-title-size";
import { layoutSolutionBlockTitlePt } from "./header-assembly/fit-title";
import { addPageNumberToSlide } from "./page-number-ppt-draw";
import { normalizePageNumberSettings } from "./page-number/settings";
import type { DocumentPage } from "./document-model";
import {
  compileBook,
  getTitleWordsForDocument,
  groupPuzzlesByDocument,
} from "./book-compiler";
import {
  resolveLayoutSettingsForExport,
  resolvePageNumberSettingsForBook,
} from "./text-page-pdf-draw";

// ─── helpers ────────────────────────────────────────────────────────────────

/** Points → inches (PPT coordinate unit). */
function pt2in(pt: number): number {
  const v = pt / 72;
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

/** Ensure a value is a safe positive inch number. */
function safeIn(v: number, fallback = 0.01): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Hex (#RRGGBB or RRGGBB) → 6-char hex string (no #) expected by pptxgenjs. */
function hex6(hex: string | undefined, fallback = "000000"): string {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, "");
  return clean.length === 6 ? clean.toUpperCase() : fallback;
}

/**
 * Single rounded grid frame: white fill + border stroke (matches UI WordSearchGrid).
 * Must be added before grid letters/table so text renders on top.
 */
function _addGridFrameShape(
  slide: any,
  xIn: number,
  yIn: number,
  wIn: number,
  hIn: number,
  borderRadiusCssPx: number,
  boxColor: string | undefined,
  borderThicknessPt: number,
  noBox: boolean
): void {
  if (noBox) return;

  // Inset by half stroke so outer edge matches CSS content-box border (same as PDF geometry).
  const borderIn = borderThicknessPt / 72;
  const halfIn = borderIn / 2;
  const strokeX = xIn + halfIn;
  const strokeY = yIn + halfIn;
  const strokeW = Math.max(0.01, wIn - borderIn);
  const strokeH = Math.max(0.01, hIn - borderIn);

  const borderRadiusIn = borderRadiusCssPx / 96;
  const rectRadiusIn = Math.max(
    0,
    Math.min(borderRadiusIn, Math.min(strokeW, strokeH) / 2)
  );
  const shapeType = rectRadiusIn > 0 ? "roundRect" : "rect";

  slide.addShape(shapeType as any, {
    x: strokeX,
    y: strokeY,
    w: strokeW,
    h: strokeH,
    fill: { color: "FFFFFF" },
    line: {
      color: hex6(boxColor),
      width: Math.max(0.5, borderThicknessPt),
    },
    ...(rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {}),
  });
}

/** PPT background config — inner frame fill is a single vector shape, not baked into raster. */
const PPT_BG_OPTIONS = { bakeInnerFrameFill: false } as const;

/** Shared page-container frame geometry (inches). */
function getPageContainerFrameGeom(
  pageWIn: number,
  pageHIn: number,
  frame: PageFrameSettings
) {
  const m = frame.marginSizeIn;
  const x = m;
  const y = m;
  const w = Math.max(0.01, pageWIn - m * 2);
  const h = Math.max(0.01, pageHIn - m * 2);
  const rectRadiusIn = Math.max(
    0,
    Math.min(frame.cornerRadiusPx / 96, Math.min(w, h) / 2)
  );
  const shapeType = rectRadiusIn > 0 ? "roundRect" : "rect";
  const roundProps = rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {};
  return { x, y, w, h, shapeType, roundProps };
}

/**
 * One rounded-rectangle page frame: fill + border in a single pptxgenjs shape.
 * Added once behind slide content (after slide.background, before text/grid).
 */
function _addPageContainerFrame(
  slide: any,
  pageWIn: number,
  pageHIn: number,
  frame: PageFrameSettings,
  pageBackgroundColor: string | undefined,
  hasBackgroundImage: boolean
): void {
  if (!frame.enabled) return;

  const { x, y, w, h, shapeType, roundProps } = getPageContainerFrameGeom(
    pageWIn,
    pageHIn,
    frame
  );

  const strokeWidth = Math.max(0.5, cssPxToPoints(frame.strokeThicknessPx));
  const strokeColor = hex6(frame.borderColor);

  if (hasBackgroundImage && pageBackgroundColor) {
    slide.addShape(shapeType as any, {
      x,
      y,
      w,
      h,
      fill: { color: hex6(pageBackgroundColor, "FFFFFF") },
      line: { color: strokeColor, width: strokeWidth },
      ...roundProps,
    });
    return;
  }

  // No background image — stroke-only frame (omit fill property for valid XML).
  slide.addShape(shapeType as any, {
    x,
    y,
    w,
    h,
    line: { color: strokeColor, width: strokeWidth },
    ...roundProps,
  });
}

async function addBlankSeparatorSlide(
  prs: any,
  settings: WordSearchSettings,
  bookPageIndex: number,
  backgroundCache: FlattenedBackgroundPptCache
): Promise<void> {
  const slide = prs.addSlide();
  const pageWidthPt = (settings.bookCanvas.customWidth || 8.5) * 72;
  const pageHeightPt = (settings.bookCanvas.customHeight || 11) * 72;
  const pageW = pt2in(pageWidthPt);
  const pageH = pt2in(pageHeightPt);
  const pageFrame = resolvePageFrameSettings(settings);
  const bgConfig = puzzlePageBackgroundConfig(
    pageWidthPt,
    pageHeightPt,
    settings.colors.puzzlePage,
    pageFrame.cornerRadiusPx,
    PPT_BG_OPTIONS
  );
  await applyFlattenedBackgroundToSlide(slide, bgConfig, backgroundCache, hex6);
  _addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    settings.colors.puzzlePage.backgroundColor,
    !!settings.colors.puzzlePage.backgroundImage
  );
  addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, settings, bookPageIndex);
}

function buildSettingsForCompiledPage(
  bookSettings: ExportOptions["bookSettings"],
  wordSearchSettings: WordSearchSettings
): WordSearchSettings {
  return {
    ...wordSearchSettings,
    bookCanvas: {
      ...wordSearchSettings.bookCanvas,
      includeBleed: bookSettings.includeBleed || false,
      useCustomTrim: bookSettings.useCustomTrim || false,
      customWidth: bookSettings.customWidth ?? wordSearchSettings.bookCanvas.customWidth ?? 8.5,
      customHeight: bookSettings.customHeight ?? wordSearchSettings.bookCanvas.customHeight ?? 11,
      puzzleType: "word-search" as const,
      answersPerPage: bookSettings.answersPerPage ?? wordSearchSettings.bookCanvas.answersPerPage ?? 1,
      includePageBetweenPuzzleAndSolutions:
        bookSettings.includePageBetweenPuzzleAndSolutions ??
        wordSearchSettings.bookCanvas.includePageBetweenPuzzleAndSolutions ??
        false,
    },
    typography: {
      ...wordSearchSettings.typography,
      pageNumber: normalizePageNumberSettings(wordSearchSettings.typography?.pageNumber),
    },
  };
}

async function addTextModuleSlide(
  prs: any,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  bookPageIndex: number,
  backgroundCache: FlattenedBackgroundPptCache
): Promise<void> {
  const slide = prs.addSlide();
  const pageWidthPt = (layoutSettings.bookCanvas.customWidth || 8.5) * 72;
  const pageHeightPt = (layoutSettings.bookCanvas.customHeight || 11) * 72;
  const pageW = pt2in(pageWidthPt);
  const pageH = pt2in(pageHeightPt);
  const pageFrame = resolvePageFrameSettings(layoutSettings);
  const bgConfig = puzzlePageBackgroundConfig(
    pageWidthPt,
    pageHeightPt,
    layoutSettings.colors.puzzlePage,
    pageFrame.cornerRadiusPx,
    PPT_BG_OPTIONS
  );
  await applyFlattenedBackgroundToSlide(slide, bgConfig, backgroundCache, hex6);
  _addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    layoutSettings.colors.puzzlePage.backgroundColor,
    !!layoutSettings.colors.puzzlePage.backgroundImage
  );

  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const marginIn = pt2in(marginPt);
  const contentWIn = pt2in(pageWidthPt - marginPt * 2);
  const titleSize = settings.fontSize;
  const bodySize = settings.fontSize;
  const titleLine = (settings.title || "").trim();
  const bodyText = (settings.content || "").trim();
  const alignment = settings.alignment || "center";
  const textColor = hex6(layoutSettings.colors.puzzlePage.titleColor, "1F2937");
  const fontFace = settings.fontFamily || "Arial";
  const pptAlign = alignment === "left" ? "left" : alignment === "right" ? "right" : "center";

  const titleLines = titleLine ? [titleLine] : [];
  const bodyLines = bodyText ? bodyText.split("\n") : [];
  const lineHeightIn = pt2in(bodySize * 1.35);
  const titleLineHeightIn = pt2in(titleSize * 1.2);
  const gapAfterTitleIn =
    titleLines.length > 0 && bodyLines.length > 0 ? lineHeightIn * 0.5 : 0;
  const totalHeightIn =
    titleLines.length * titleLineHeightIn +
    gapAfterTitleIn +
    bodyLines.length * lineHeightIn;
  let cursorYIn = Math.max(marginIn, (pageH - totalHeightIn) / 2);

  for (const line of titleLines) {
    slide.addText(line, {
      x: marginIn,
      y: cursorYIn,
      w: contentWIn,
      h: titleLineHeightIn,
      fontSize: Math.round(titleSize),
      fontFace,
      color: textColor,
      bold: true,
      align: pptAlign,
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
    cursorYIn += titleLineHeightIn;
  }
  if (gapAfterTitleIn > 0) {
    cursorYIn += gapAfterTitleIn;
  }
  for (const line of bodyLines) {
    slide.addText(line, {
      x: marginIn,
      y: cursorYIn,
      w: contentWIn,
      h: lineHeightIn,
      fontSize: Math.round(bodySize),
      fontFace,
      color: textColor,
      align: pptAlign,
      valign: "top",
      margin: 0,
      isTextBox: true,
    });
    cursorYIn += lineHeightIn;
  }

  addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, layoutSettings, bookPageIndex);
}

/**
 * Calculate the total vertical space consumed by a wrapped title block.
 * This accounts for the rendered height of all lines plus internal padding.
 * Used consistently by PDF and PPT exporters to ensure uniform alignment.
 * 
 * @param wrappedLines - Array of text lines (after wrapping)
 * @param fontHeight - Height of the font in points (PPT uses 1.2x line multiplier)
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
 * @returns Grid Y position in points
 */
function calculateGridTopY(
  blockTopY: number,
  titleBlockHeightPt: number,
  titleToAnswerGap: number,
  isBottomOrigin: boolean
): number {
  if (isBottomOrigin) {
    // PDF: Y increases upward from bottom
    return blockTopY - titleBlockHeightPt - titleToAnswerGap;
  } else {
    // PPT: Y increases downward from top
    return blockTopY + titleBlockHeightPt + titleToAnswerGap;
  }
}


/** Wrap text to fit within maxWidth (simple word-break estimation for PPT). */
function wrapText(text: string, maxWidth: number, fontSize: number = 12, charWidthEstimate: number = 0.55): string[] {
  if (!text || maxWidth <= 0) return [];

  // Rough estimation: each character width based on typical monospace/sans-serif
  // This is approximate for PPT since we don't have exact font metrics
  const maxCharsPerLine = Math.max(1, Math.floor(maxWidth / (charWidthEstimate * fontSize))); // fontSize pt baseline

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    // Conservative estimate: 0.55 * fontSize per character
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [text];
}

// ─── interfaces ─────────────────────────────────────────────────────────────

export interface ExportOptions {
  bookSettings: {
    includeBleed: boolean;
    customWidth?: number;
    customHeight?: number;
    useCustomTrim: boolean;
    answersPerPage: number;
    includePageBetweenPuzzleAndSolutions: boolean;
  };
  titleWords: TitleWordsSettings;
  wordSearchSettings: WordSearchSettings;
  puzzles: WordSearchPuzzle[];
  includeSolution: boolean;
  onlySolutions?: boolean;
  puzzleGridScale?: number;
  titleToAnswerGap?: number;
  pageMargin?: number;
  solutionToSolutionGap?: number;
  pageOverrides?: Map<number, Partial<WordSearchSettings>>;
  applyMode?: Map<string, boolean>;
  /** Multi-document book: export all modules in sidebar order */
  documentPages?: DocumentPage[];
}

// ─── slide builder ───────────────────────────────────────────────────────────

/**
 * Render one puzzle or solution page onto a PPT slide.
 * Uses the unified layout so positions match the canvas preview exactly.
 *
 * For solution pages (`showSolution = true`) the grid is rendered to a
 * pixel-perfect PNG via captureGridSnapshot and injected as a flat image.
 * For puzzle pages the grid remains an editable native PPT table.
 * Falls back to the table on server-side (no DOM / canvas unavailable).
 */
async function buildSlide(
  prs: any,
  layout: UnifiedPageLayout,
  puzzle: WordSearchPuzzle,
  showSolution: boolean,
  settings?: WordSearchSettings,
  backgroundCache?: FlattenedBackgroundPptCache,
  bookPageIndex = 0
): Promise<void> {
  const slide = prs.addSlide();

  const pageW = pt2in(layout.page.widthPt);
  const pageH = pt2in(layout.page.heightPt);

  // ── Flattened background (uneditable slide.background layer) ─────────────
  const bgCache = backgroundCache ?? new FlattenedBackgroundPptCache();
  const pageFrame = settings ? resolvePageFrameSettings(settings) : DEFAULT_PAGE_FRAME_SETTINGS;
  const bgConfig = showSolution
    ? answerPageBackgroundConfig(
        layout.page.widthPt,
        layout.page.heightPt,
        settings?.colors?.answerPage ?? {},
        pageFrame.cornerRadiusPx,
        PPT_BG_OPTIONS
      )
    : puzzlePageBackgroundConfig(
        layout.page.widthPt,
        layout.page.heightPt,
        settings?.colors?.puzzlePage ?? { backgroundColor: layout.page.backgroundColor },
        pageFrame.cornerRadiusPx,
        PPT_BG_OPTIONS
      );
  await applyFlattenedBackgroundToSlide(slide, bgConfig, bgCache, hex6);

  _addPageContainerFrame(
    slide,
    pageW,
    pageH,
    pageFrame,
    showSolution
      ? settings?.colors?.answerPage?.backgroundColor
      : settings?.colors?.puzzlePage?.backgroundColor,
    showSolution
      ? !!settings?.colors?.answerPage?.backgroundImage
      : !!settings?.colors?.puzzlePage?.backgroundImage
  );

  // ── Header assembly (native editable shapes + text) ───────────────────────
  if (layout.headerAssembly) {
    addHeaderAssemblyToSlide(slide, layout.headerAssembly);
  } else if (layout.title && layout.title.text) {
    const t = layout.title;
    slide.addText(t.text, {
      x: 0,
      y: pt2in(t.topPt),
      w: pageW,
      h: pt2in(t.fontSizePt * 1.1),
      fontSize: Math.round(t.fontSizePt),
      fontFace: t.fontFamily || "Arial",
      color: hex6(t.color),
      bold: true,
      align: t.align || "center",
      valign: "top",
      margin: 0,
      wrap: true,
      isTextBox: true,
    });
  }

  // ── Subtitle ─────────────────────────────────────────────────────────────
  if (!layout.headerAssembly && layout.subtitle && layout.subtitle.text) {
    const s = layout.subtitle;
    const wrappedLines =
      s.wrappedLines && s.wrappedLines.length > 0 ? s.wrappedLines : [s.text];
    const subtitleLineHeightPt = s.fontSizePt * 1.2;
    const subHPt = subtitleLineHeightPt * wrappedLines.length;

    slide.addText(wrappedLines.join("\n"), {
      x: pt2in(s.leftPt),
      y: pt2in(s.topPt),
      w: safeIn(pt2in(s.widthPt), 0.1),
      h: pt2in(subHPt),
      fontSize: Math.round(s.fontSizePt),
      fontFace: s.fontFamily || "Arial",
      color: hex6(s.color, "666666"),
      align: "center",
      valign: "top",
      margin: 0,
      wrap: false,
      isTextBox: true,
    });
  }

  // ── Grid ─────────────────────────────────────────────────────────────────
  const g = layout.grid;
  const framePaddingPt = g.framePaddingPt || 0;
  const puzzleGridBorder = resolvePuzzleGridBorder(settings?.core ?? ({} as WordSearchSettings['core']));
  const borderCssPx = puzzleGridBorder.strokeThicknessPx;
  const outerBounds = computeGridBorderOuterBounds(
    g.leftPt,
    g.topPt,
    g.widthPt,
    g.heightPt,
    framePaddingPt,
    borderCssPx,
    g.noBox
  );
  const borderLinePt = getGridBorderThicknessPt(borderCssPx);

  const outerGridXIn = pt2in(outerBounds.leftPt);
  const outerGridYIn = pt2in(outerBounds.topPt);
  const outerGridWIn = safeIn(pt2in(outerBounds.widthPt), 0.1);
  const outerGridHIn = safeIn(pt2in(outerBounds.heightPt), 0.1);

  if (showSolution && settings) {
    const snapshot = await captureGridSnapshot(
      puzzle,
      settings,
      g.cellSizePt,
      g.fontSizePt,
      { scale: 3 },
      showSolution
    );

    if (snapshot) {
      slide.addImage({
        data: snapshot,
        x: outerGridXIn,
        y: outerGridYIn,
        w: outerGridWIn,
        h: outerGridHIn,
      });
    } else {
      _addGridFrameShape(
        slide,
        outerGridXIn,
        outerGridYIn,
        outerGridWIn,
        outerGridHIn,
        puzzleGridBorder.cornerRadiusPx,
        g.boxColor,
        borderLinePt,
        g.noBox
      );
      _buildTableGrid(slide, puzzle, g);
    }
  } else {
    if (settings) {
      _addGridFrameShape(
        slide,
        outerGridXIn,
        outerGridYIn,
        outerGridWIn,
        outerGridHIn,
        puzzleGridBorder.cornerRadiusPx,
        g.boxColor,
        borderLinePt,
        g.noBox
      );
    }
    _buildTableGrid(slide, puzzle, g);
  }

  // ── Word list (puzzle pages only) ─────────────────────────────────────────
  const wl = layout.wordList;
  if (!showSolution && wl && wl.words.length > 0) {
    const wordFontSize = Math.max(4, Math.round(wl.fontSizePt));
    const wordColor = hex6(wl.color);
    const columnWidths = wl.columnWidthsPt;
    const wordsPerCol = wl.wordsPerColumn;

    for (let i = 0; i < wl.words.length; i++) {
      const col = Math.min(Math.floor(i / wordsPerCol), wl.columns - 1);
      const row = i % wordsPerCol;
      const word = wl.words[i];

      // X: centeredLeftPt + sum of previous column widths + gaps between columns
      const prevColsWidth = columnWidths
        .slice(0, col)
        .reduce((sum, w) => sum + w, 0);
      const wordXPt = wl.centeredLeftPt + prevColsWidth + col * wl.columnGapPt;
      const wordYPt = wl.topPt + row * wl.lineHeightPt;

      const wordX = pt2in(wordXPt);
      const wordY = pt2in(wordYPt);
      const wordW = safeIn(pt2in((columnWidths[col] || 80) + 4), 0.3);
      const wordH = safeIn(pt2in(wl.lineHeightPt * 1.2), 0.15);

      // Optional checkbox
      if (wl.addCheckboxes) {
        const cbSize = safeIn(pt2in(wl.checkboxSizePt), 0.1);
        slide.addShape("rect" as any, {
          x: wordX,
          y: wordY + (wordH - cbSize) / 2,
          w: cbSize,
          h: cbSize,
          fill: { color: "FFFFFF", transparency: 100 },
          line: { color: hex6(wl.checkboxColor), width: 0.75 },
        });
      }

      const textX = wl.addCheckboxes
        ? wordX + pt2in(wl.checkboxSizePt + wl.checkboxGapPt)
        : wordX;
      const textW = wl.addCheckboxes
        ? wordW - pt2in(wl.checkboxSizePt + wl.checkboxGapPt)
        : wordW;

      slide.addText(word, {
        x: textX,
        y: wordY,
        w: safeIn(textW, 0.3),
        h: wordH,
        fontSize: wordFontSize,
        fontFace: wl.fontFamily || "Arial",
        color: wordColor,
        align: "left",
        valign: "middle",
        margin: 0,
        wrap: false,
        isTextBox: true,
      });
    }
  }

  if (settings) {
    addPageNumberToSlide(
      slide,
      layout.page.widthPt,
      layout.page.heightPt,
      settings,
      bookPageIndex
    );
  }
}

/**
 * Build and add an editable PPT table for a word-search grid.
 * Shared by puzzle pages and by the server-side solution fallback.
 *
 * The table is always placed at the INNER grid origin (g.leftPt, g.topPt)
 * with no cell margin adjustment for frame padding. The outer border frame
 * is drawn separately by the caller as a shape, so it can expand correctly
 * with the Border Padding slider — exactly as the PDF engine does.
 */
/** pptxgenjs ignores table `margin: 0` (falsy) and applies ~0.05–0.1" cell insets. */
const PPT_TABLE_ZERO_MARGIN: [number, number, number, number] = [0, 0, 0, 0];

function _buildTableGrid(
  slide: any,
  puzzle: WordSearchPuzzle,
  g: UnifiedPageLayout["grid"]
): void {
  const gridX = pt2in(g.leftPt);
  const gridY = pt2in(g.topPt);
  const gridWIn = g.widthPt / 72;
  const gridHIn = g.heightPt / 72;
  const cellWIn = gridWIn / g.cols;
  const cellHIn = gridHIn / g.rows;
  const colWidths = Array<number>(g.cols).fill(cellWIn);
  const rowHeights = Array<number>(g.rows).fill(cellHIn);
  const gridColor = hex6(g.letterColor);
  const noBorder = { type: "none" as const };

  const tableRows: any[][] = [];
  for (let row = 0; row < g.rows; row++) {
    const rowCells: any[] = [];
    for (let col = 0; col < g.cols; col++) {
      const letter = (puzzle.grid[row]?.[col] ?? "").trim();
      const gridFontSz = Math.max(4, Math.round(g.fontSizePt));
      rowCells.push({
        text: letter,
        options: {
          fontSize: gridFontSz,
          fontFace: g.fontFamily || "Arial",
          color: gridColor,
          bold: false,
          align: "center",
          valign: "middle",
          margin: PPT_TABLE_ZERO_MARGIN,
          fill: { type: "none" as const },
          border: [noBorder, noBorder, noBorder, noBorder],
        },
      });
    }
    tableRows.push(rowCells);
  }

  slide.addTable(tableRows, {
    x: gridX,
    y: gridY,
    w: gridWIn,
    h: gridHIn,
    colW: colWidths,
    rowH: rowHeights,
    margin: PPT_TABLE_ZERO_MARGIN,
    border: noBorder,
    fill: { type: "none" as const },
    autoPage: false,
  });
}

/**
 * Build a multi-puzzle solution page.
 *
 * Each solution grid is captured as a pixel-perfect PNG via captureGridSnapshot
 * and injected with slide.addImage() — eliminating all shape-position drift.
 * Title text remains an editable native PPT text element.
 *
 * Falls back to a native table (server-side / no DOM) if the snapshot returns null.
 */
async function buildSolutionSlide(
  prs: any,
  puzzles: WordSearchPuzzle[],
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  titleToAnswerGap: number,
  pageMarginPt: number,
  solutionToSolutionGap: number,
  backgroundCache?: FlattenedBackgroundPptCache,
  bookPageIndex = 0
): Promise<void> {
  const slide = prs.addSlide();

  // ─── PAGE DIMENSIONS (from live settings) ────────────────────────────────
  const pageWidthPt = (settings.bookCanvas.customWidth || 8.5) * 72;
  const pageHeightPt = (settings.bookCanvas.customHeight || 11) * 72;

  // ─── Flattened background (uneditable slide.background layer) ────────────
  const bgCache = backgroundCache ?? new FlattenedBackgroundPptCache();
  const answerBgConfig = answerPageBackgroundConfig(
    pageWidthPt,
    pageHeightPt,
    settings.colors.answerPage,
    resolvePageFrameSettings(settings).cornerRadiusPx,
    PPT_BG_OPTIONS
  );
  await applyFlattenedBackgroundToSlide(slide, answerBgConfig, bgCache, hex6);

  const solutionPageFrame = resolvePageFrameSettings(settings);
  const solutionPageW = pt2in(pageWidthPt);
  const solutionPageH = pt2in(pageHeightPt);
  _addPageContainerFrame(
    slide,
    solutionPageW,
    solutionPageH,
    solutionPageFrame,
    settings.colors.answerPage.backgroundColor,
    !!settings.colors.answerPage.backgroundImage
  );

  // ─── LAYOUT CONFIGURATION (direct from UI state) ────────────────────────
  const solutionLayout = computeSolutionPageLayout(
    puzzles,
    settings,
    pageWidthPt,
    pageHeightPt,
    pageMarginPt,
    titleToAnswerGap,
    solutionToSolutionGap
  );

  // ─── PER-BLOCK LAYOUT ────────────────────────────────────────────────────
  for (let idx = 0; idx < puzzles.length; idx++) {
    const puzzle = puzzles[idx];
    const block = solutionLayout.blocks[idx];
    if (!block) continue;

    const blockXPt = block.leftPt;
    const blockYPt = block.topPt;
    const blockWidthPt = block.widthPt;
    const blockHeightPt = block.heightPt;
    const innerMarginPt = block.innerMarginPt;

    // ─── TITLE (from live settings) ──────────────────────────────────────
    const titleSizePt = settings.colors.answerPage.answerTitleFontSize || 20;
    const titleFontFamily = settings.colors.answerPage.answerTitleFontFamily || "Arial";
    const titleAlignment = settings.colors.answerPage.answerTitleAlignment || "center";
    const titleColor = hex6(settings.colors.answerPage.titleColor);

    // Resolve title text
    let titleText = "";
    let numberingStyle = "none";
    if (settings.typography.solutionTitleStyle === "same_as_puzzle") {
      switch (settings.typography.selectTitleOption) {
        case "puzzle-number":
        case "one-custom-title":
          titleText = settings.typography.titleText || titleWords.title || "Word Search";
          break;
        case "custom": {
          const lines = (settings.typography.titleText || "")
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const pNum = puzzle.puzzleNumber || idx + 1;
          titleText = lines.length > 0 ? (lines[pNum - 1] ?? lines[lines.length - 1]) : "";
          break;
        }
        default:
          titleText = titleWords.title || "Word Search";
      }
      numberingStyle = settings.typography.puzzleNumberingStyle || "none";
    } else {
      titleText = settings.typography.customSolutionTitle || "Solution";
      numberingStyle = settings.typography.solutionNumberingStyle || "none";
    }

    const pNum = puzzle.puzzleNumber || idx + 1;
    if (titleText && numberingStyle !== "none") {
      if (numberingStyle === "prefix") titleText = `${pNum}. ${titleText}`;
      else if (numberingStyle === "suffix") titleText = `${titleText} #${pNum}`;
    }

    // ─── GRID DIMENSIONS (from live settings) ──────────────────────────────
    const gridRows = puzzle.grid.length;
    const gridCols = puzzle.grid[0]?.length || 1;
    const cellSizePt = block.cellSizePt;
    const gridWidthPt = block.gridWidthPt;
    const gridHeightPt = block.gridHeightPt;
    const gridLeftPt = block.gridLeftPt;
    const gridTopPt = block.gridTopPt;

    const cellSizeIn = safeIn(pt2in(cellSizePt), 0.05);
    const gridWidthIn = safeIn(pt2in(gridWidthPt), 0.1);
    const gridHeightIn = safeIn(pt2in(gridHeightPt), 0.1);

    // ─── GRID STYLING (from live settings) ───────────────────────────────
    const boxColor = hex6(settings.colors.answerPage.boxColor);
    const letterColor = hex6(settings.colors.answerPage.lettersInSolutionColor);
    const solutionGridBorder = resolveSolutionGridBorder(settings.core);
    const borderThicknessPt = settings.core.noBoxAroundPuzzle
      ? 0
      : Math.max(0.5, solutionGridBorder.strokeThicknessPx);
    const gridFontSizePt = getSolutionGridFontSize(settings.typography);
    const answersPerPage = settings.bookCanvas.answersPerPage || 1;
    const gridFontSize = Math.max(4, Math.round(gridFontSizePt));
    const gridFontFamily = settings.typography.setFontForAnswerPages
      ? (settings.typography.answerGridFontFamily || "Arial")
      : (settings.typography.puzzleGridFontFamily || "Arial");

    // ─── TITLE TEXTBOX (wrap long titles to 2+ lines like PDF / canvas preview) ─
    const titleMaxWidthPt = Math.max(1, blockWidthPt - innerMarginPt * 2);
    const titleLayout = layoutSolutionBlockTitlePt(
      titleText,
      titleMaxWidthPt,
      titleSizePt,
      titleFontFamily,
      true
    );
    const titleBoxHeightPt = Math.max(
      titleLayout.lineHeightPt,
      titleLayout.lines.length * titleLayout.lineHeightPt
    );

    slide.addText(titleLayout.lines.join("\n"), {
      x: pt2in(blockXPt + innerMarginPt),
      y: pt2in(block.titleTopPt),
      w: safeIn(pt2in(titleMaxWidthPt), 0.1),
      h: safeIn(pt2in(titleBoxHeightPt), 0.2),
      fontSize: Math.round(titleLayout.fontSizePt),
      fontFace: titleFontFamily,
      color: titleColor,
      bold: true,
      align: titleAlignment,
      valign: "top",
      margin: 0,
      wrap: false,
      lineSpacingMultiple: 1.1,
      isTextBox: true,
    });

    // ─── SOLUTION GRID: pixel-perfect PNG snapshot ────────────────────────
    // captureGridSnapshot draws the same rounded-capsule highlights and
    // cell-centred letters as WordSearchGrid.tsx — no coordinate drift.
    // On the server (no DOM) it returns null → fallback to a native table.
    const snapshot = await captureGridSnapshot(
      puzzle,
      settings,
      cellSizePt,
      gridFontSizePt,
      { scale: 3 }
    );

    const paddingPt = cssPxToPoints(solutionGridBorder.paddingPx);
    const borderCssPx = solutionGridBorder.strokeThicknessPx;
    const borderLinePt = getGridBorderThicknessPt(borderCssPx);
    const outerBounds = computeGridBorderOuterBounds(
      gridLeftPt,
      gridTopPt,
      gridWidthPt,
      gridHeightPt,
      paddingPt,
      borderCssPx,
      settings.core.noBoxAroundPuzzle ?? false
    );
    const imageXIn = pt2in(outerBounds.leftPt);
    const imageYIn = pt2in(outerBounds.topPt);
    const imageWIn = safeIn(pt2in(outerBounds.widthPt), 0.1);
    const imageHIn = safeIn(pt2in(outerBounds.heightPt), 0.1);

    if (snapshot) {
      // ── Inject flat image (pixel-perfect) ──────────────────────────────
      slide.addImage({
        data: snapshot,
        x: imageXIn,
        y: imageYIn,
        w: imageWIn,
        h: imageHIn,
      });
    } else {
      // ── Server-side fallback: native editable table + border shape ─────
      // Build a minimal grid descriptor so _buildTableGrid can render the
      // letters at the correct inner-grid position.
      const fallbackG: UnifiedPageLayout["grid"] = {
        topPt: gridTopPt,
        leftPt: gridLeftPt,
        cellSizePt: cellSizePt,
        widthPt: gridWidthPt,
        heightPt: gridHeightPt,
        rows: gridRows,
        cols: gridCols,
        fontSizePt: gridFontSizePt,
        fontFamily: gridFontFamily,
        letterColor: letterColor,
        boxColor: boxColor,
        borderThicknessPt: borderThicknessPt,
        noBox: settings.core.noBoxAroundPuzzle ?? false,
        innerGridOpacity: settings.core.innerGridOpacity ?? 0,
        gridLinesThicknessPt: settings.core.gridLinesStrokeThickness ?? 0,
        gridLinesColor: settings.colors.puzzlePage.gridLinesColor || settings.colors.puzzlePage.boxColor || '#d1d5db',
        framePaddingPt: paddingPt,
      };
      _addGridFrameShape(
        slide,
        imageXIn,
        imageYIn,
        imageWIn,
        imageHIn,
        solutionGridBorder.cornerRadiusPx,
        boxColor,
        borderLinePt,
        settings.core.noBoxAroundPuzzle ?? false
      );
      _buildTableGrid(slide, puzzle, fallbackG);
    }
  }

  addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, settings, bookPageIndex);
}


// ─── download helper ─────────────────────────────────────────────────────────

function downloadFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-${Date.now()}.pptx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Internal: Generate PPT blob (for server-side export).
 *
 * This function generates the raw PPTX blob without downloading.
 * Used by both the API route and the client-side wrapper.
 */
export async function generatePuzzlePPTBlob(
  options: ExportOptions,
  onProgress?: (status: string) => void
): Promise<Blob> {
  const {
    bookSettings,
    titleWords,
    wordSearchSettings,
    puzzles,
    includeSolution,
    onlySolutions = false,
    puzzleGridScale = 70,
    titleToAnswerGap = 10,
    pageMargin = 40,
    pageOverrides = new Map(),
    applyMode = new Map(),
    solutionToSolutionGap = 14,
    documentPages,
  } = options;

  try {
    if (onProgress) onProgress("Loading PowerPoint engine…");
    const PptxGenJS = (await import("pptxgenjs")).default;

    // Merge base settings exactly as pdf-export.ts does
    const baseSettings: WordSearchSettings = {
      bookCanvas: {
        includeBleed: bookSettings.includeBleed || false,
        useCustomTrim: bookSettings.useCustomTrim || false,
        customWidth: bookSettings.customWidth || 8.5,
        customHeight: bookSettings.customHeight || 11,
        puzzleType: "word-search" as const,
        answersPerPage: bookSettings.answersPerPage || 1,
        includePageBetweenPuzzleAndSolutions:
          bookSettings.includePageBetweenPuzzleAndSolutions || false,
      },
      core: { ...wordSearchSettings.core },
      typography: {
        ...wordSearchSettings.typography,
        pageNumber: normalizePageNumberSettings(wordSearchSettings.typography?.pageNumber),
      },
      wordList: { ...wordSearchSettings.wordList },
      colors: {
        puzzlePage: { ...wordSearchSettings.colors.puzzlePage },
        answerPage: { ...wordSearchSettings.colors.answerPage },
      },
      pageFrameSettings: wordSearchSettings.pageFrameSettings
        ? { ...wordSearchSettings.pageFrameSettings }
        : undefined,
    };

    const prs = new PptxGenJS();
    const backgroundCache = new FlattenedBackgroundPptCache();

    if (documentPages && documentPages.length > 0 && !onlySolutions) {
      const layoutSettings = resolveLayoutSettingsForExport(documentPages, baseSettings);
      const pageNumberSettings = resolvePageNumberSettingsForBook(documentPages, baseSettings);
      const puzzleMap = groupPuzzlesByDocument(puzzles, documentPages);
      const compiled = compileBook(documentPages, puzzleMap, {
        includeSolutions: includeSolution,
        pageNumberSettings,
      });

      const pageW = layoutSettings.bookCanvas.customWidth || 8.5;
      const pageH = layoutSettings.bookCanvas.customHeight || 11;
      prs.defineLayout({ name: "PUZZLE_PAGE", width: pageW, height: pageH });
      prs.layout = "PUZZLE_PAGE";

      const bookHeaderTitleSizeEntries = compiled.pages
        .filter((page) => page.kind === "puzzle")
        .map((page) => {
          const ws = buildSettingsForCompiledPage(bookSettings, page.wordSearchSettings);
          return {
            puzzle: page.puzzle,
            settings: getMergedSettingsForPage(
              ws,
              pageOverrides,
              applyMode,
              page.bookPageIndex
            ),
          };
        });
      const bookHeaderTitleFontSizePt = computeBookHeaderTitleFontSizePt(
        bookHeaderTitleSizeEntries,
        titleWords
      );

      const totalSlides = compiled.pages.length;
      for (let slideIdx = 0; slideIdx < compiled.pages.length; slideIdx++) {
        const compiledPage = compiled.pages[slideIdx];
        if (onProgress) {
          onProgress(`Building slide ${slideIdx + 1} of ${totalSlides}…`);
        }

        if (compiledPage.kind === "text") {
          await addTextModuleSlide(
            prs,
            compiledPage.settings,
            layoutSettings,
            compiledPage.bookPageIndex,
            backgroundCache
          );
          continue;
        }

        if (compiledPage.kind === "blank") {
          await addBlankSeparatorSlide(
            prs,
            layoutSettings,
            compiledPage.bookPageIndex,
            backgroundCache
          );
          continue;
        }

        const ws = buildSettingsForCompiledPage(
          bookSettings,
          compiledPage.wordSearchSettings
        );
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

        if (compiledPage.kind === "puzzle") {
          const puzzle = compiledPage.puzzle;
          if (!puzzle.puzzleNumber) {
            puzzle.puzzleNumber = compiledPage.puzzleIndexInDocument + 1;
          }

          const layout = computeWordSearchPageLayout(
            puzzle,
            effectiveSettings,
            docTitleWords,
            false,
            puzzleGridScale,
            titleToAnswerGap,
            bookHeaderTitleFontSizePt
          );

          await buildSlide(
            prs,
            layout,
            puzzle,
            false,
            effectiveSettings,
            backgroundCache,
            compiledPage.bookPageIndex
          );
          continue;
        }

        if (compiledPage.kind === "solution") {
          const chunkSize = effectiveSettings.bookCanvas.answersPerPage || 1;

          if (chunkSize === 1) {
            const puzzle = compiledPage.puzzles[0];
            if (!puzzle.puzzleNumber) puzzle.puzzleNumber = 1;

            const layout = computeWordSearchPageLayout(
              puzzle,
              effectiveSettings,
              docTitleWords,
              true,
              puzzleGridScale
            );

            await buildSlide(
              prs,
              layout,
              puzzle,
              true,
              effectiveSettings,
              backgroundCache,
              compiledPage.bookPageIndex
            );
          } else {
            await buildSolutionSlide(
              prs,
              compiledPage.puzzles,
              effectiveSettings,
              docTitleWords,
              titleToAnswerGap,
              pageMargin,
              solutionToSolutionGap,
              backgroundCache,
              compiledPage.bookPageIndex
            );
          }
        }
      }
    } else {
      // Slide dimensions match the PDF page size exactly
      const pageW = baseSettings.bookCanvas.customWidth || 8.5;
      const pageH = baseSettings.bookCanvas.customHeight || 11;

      prs.defineLayout({ name: "PUZZLE_PAGE", width: pageW, height: pageH });
      prs.layout = "PUZZLE_PAGE";

      let currentPageIndex = 0;

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

      // ── Puzzle pages ──────────────────────────────────────────────────────
      if (!onlySolutions) {
        for (let pi = 0; pi < puzzles.length; pi++) {
          if (onProgress)
            onProgress(`Building puzzle slide ${pi + 1} of ${puzzles.length}…`);

          const puzzle = puzzles[pi];
          if (!puzzle.puzzleNumber) puzzle.puzzleNumber = pi + 1;

          const effectiveSettings = getMergedSettingsForPage(
            baseSettings, pageOverrides, applyMode, currentPageIndex
          );

          const layout = computeWordSearchPageLayout(
            puzzle, effectiveSettings, titleWords, false, puzzleGridScale, titleToAnswerGap,
            bookHeaderTitleFontSizePt
          );

          await buildSlide(
            prs,
            layout,
            puzzle,
            false,
            effectiveSettings,
            backgroundCache,
            currentPageIndex
          );
          currentPageIndex++;

          if (effectiveSettings.bookCanvas.includePageBetweenPuzzleAndSolutions) {
            await addBlankSeparatorSlide(
              prs,
              effectiveSettings,
              currentPageIndex,
              backgroundCache
            );
            currentPageIndex++;
          }
        }
      }

      // ── Solution pages ────────────────────────────────────────────────────
      if (includeSolution) {
        const chunkSize = baseSettings.bookCanvas.answersPerPage || 1;

        if (chunkSize === 1) {
          // One puzzle per solution slide — use full unified layout (same as puzzle page)
          for (let pi = 0; pi < puzzles.length; pi++) {
            if (onProgress)
              onProgress(`Building solution slide ${pi + 1} of ${puzzles.length}…`);

            const puzzle = puzzles[pi];
            if (!puzzle.puzzleNumber) puzzle.puzzleNumber = pi + 1;

            const effectiveSettings = getMergedSettingsForPage(
              baseSettings, pageOverrides, applyMode, currentPageIndex
            );

            const layout = computeWordSearchPageLayout(
              puzzle, effectiveSettings, titleWords, true, puzzleGridScale
            );

            await buildSlide(
              prs,
              layout,
              puzzle,
              true,
              effectiveSettings,
              backgroundCache,
              currentPageIndex
            );
            currentPageIndex++;
          }
        } else {
          // Multiple puzzles per solution slide — use compact grid layout
          for (let i = 0; i < puzzles.length; i += chunkSize) {
            if (onProgress)
              onProgress(`Building solution slide ${Math.floor(i / chunkSize) + 1}…`);

            const effectiveSettings = getMergedSettingsForPage(
              baseSettings, pageOverrides, applyMode, currentPageIndex
            );

            await buildSolutionSlide(
              prs,
              puzzles.slice(i, i + chunkSize),
              effectiveSettings,
              titleWords,
              titleToAnswerGap,
              pageMargin,
              solutionToSolutionGap,
              backgroundCache,
              currentPageIndex
            );
            currentPageIndex++;
          }
        }
      }
    }

    // ── Write & download ──────────────────────────────────────────────────
    if (onProgress) onProgress("Generating PPT file…");
    const blob = (await prs.write({ outputType: "blob" })) as Blob;

    console.log("[PPT] Export complete.");
    return blob;
  } catch (error) {
    console.error("[PPT] Export failed:", error);
    throw error;
  }
}

// ─── client-side wrapper ─────────────────────────────────────────────────────


/**
 * Generate and download a .pptx file (browser client-side).
 *
 * Runs entirely in the browser so that captureGridSnapshot has access to the
 * Canvas API. The server-side API route is bypassed — pptxgenjs is lazily
 * imported inside generatePuzzlePPTBlob. Solution grids are captured as
 * pixel-perfect PNG snapshots before being embedded in the slide.
 */
export async function generatePuzzlePPT(
  options: ExportOptions,
  onProgress?: (status: string) => void
): Promise<void> {
  try {
    if (onProgress) onProgress("Preparing PPT export…");

    // Generate blob fully client-side so canvas snapshots are available.
    const blob = await generatePuzzlePPTBlob(options, onProgress);

    const fileName = options.titleWords?.title || "word-search";
    if (onProgress) onProgress("Downloading…");
    downloadFile(blob, fileName);

    console.log("[PPT] Export complete.");
  } catch (error) {
    console.error("[PPT] Export failed:", error);
    throw error;
  }
}
