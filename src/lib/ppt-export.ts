/**
 * Direct Puzzle → PPT export (v4 — editable letters + image solution highlights).
 *
 * Uses the SAME unified layout engine (computeWordSearchPageLayout) as the
 * preview canvas and PDF export, so positions match the canvas.
 *
 * Puzzle letters are native editable PPT text (fill + stroke).
 * Solution pages use a highlight/border underlay image + the same editable
 * letters (same font family / size / fill / stroke as the canvas settings).
 */

import {
  TitleWordsSettings,
  WordSearchPuzzle,
  WordSearchSettings,
  CrosswordPuzzle,
} from "./puzzles/types";
import {
  isWordSearchShapeCell,
  resolveShapeMaskImageSrc,
} from "./puzzles/word-search-shape-mask";
import {
  isGenericOrCrosswordPageKind,
  captureCompiledPageSnapshot,
} from "./compiled-page-snapshot";
import { addNativeGenericOrCrosswordSlide } from "./generic-puzzle-ppt-draw";
import type { CrosswordSettings } from "./crossword-settings";
import {
  computeWordSearchPageLayout,
  UnifiedPageLayout,
} from "./word-search-page-layout";
import { cssPxToPoints, getPageMarginInches } from "./puzzle-layout";
import { toHex6 } from "./color-utils";
import { getSolutionGridFontSize } from "./puzzle-layout";
import { getMergedSettingsForPage } from "./page-settings";
import { captureGridSnapshot } from "./solution-canvas-snapshot";
import { wordSearchFontFamily } from "./puzzles/word-search-letters";
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
  groupCrosswordPuzzlesByDocument,
  groupGenericPuzzlesByDocument,
  groupMurdokuPuzzlesByDocument,
  shouldDrawBookPageNumber,
} from "./book-compiler";
import {
  resolveLayoutSettingsForExport,
  resolvePageNumberSettingsForBook,
} from "./text-page-pdf-draw";
import { overlayBookLayoutOnAllDocuments } from "./visual-settings-sync";
import { addTextModuleSlide } from "./text-page-ppt-draw";
import { resolvePuzzleDisplayNumber, getPuzzleContentLine } from "./puzzle-line-index";

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

/** Hex (#RRGGBB / #RRGGBBAA or RRGGBB) → 6-char hex string (no #) expected by pptxgenjs. */
function hex6(hex: string | undefined, fallback = "000000"): string {
  return toHex6(hex, fallback);
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

function pptBackgroundOptions(pageFrame: {
  enabled: boolean;
  marginSizeIn: number;
}) {
  return {
    ...PPT_BG_OPTIONS,
    frameEnabled: pageFrame.enabled,
    frameMarginIn: pageFrame.marginSizeIn,
  };
}

/**
 * Shared page-container frame geometry (inches).
 * Insets by half the stroke so the outer edge matches CSS `border-box` (canvas
 * PageFrameOverlay) — PowerPoint strokes are centered on the path.
 */
function getPageContainerFrameGeom(
  pageWIn: number,
  pageHIn: number,
  frame: PageFrameSettings
) {
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
  const shapeType = rectRadiusIn > 0 ? "roundRect" : "rect";
  const roundProps = rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {};
  return { x, y, w, h, shapeType, roundProps, strokePt };
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

  const { x, y, w, h, shapeType, roundProps, strokePt } = getPageContainerFrameGeom(
    pageWIn,
    pageHIn,
    frame
  );

  const strokeColor = hex6(frame.borderColor);

  if (hasBackgroundImage && pageBackgroundColor) {
    slide.addShape(shapeType as any, {
      x,
      y,
      w,
      h,
      fill: { color: hex6(pageBackgroundColor, "FFFFFF") },
      line: { color: strokeColor, width: strokePt },
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
    line: { color: strokeColor, width: strokePt },
    ...roundProps,
  });
}

async function addBlankSeparatorSlide(
  prs: any,
  settings: WordSearchSettings,
  bookPageIndex: number,
  backgroundCache: FlattenedBackgroundPptCache,
  suppressPageNumber = false
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
    pptBackgroundOptions(pageFrame)
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
  if (!suppressPageNumber) {
    addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, settings, bookPageIndex);
  }
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
    core: {
      ...wordSearchSettings.core,
      twoPagePuzzles: wordSearchSettings.core.twoPagePuzzles ?? false,
    },
    typography: {
      ...wordSearchSettings.typography,
      pageNumber: normalizePageNumberSettings(wordSearchSettings.typography?.pageNumber),
    },
  };
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
 * Puzzle pages: frame + editable per-cell letters (fill + stroke).
 * Solution pages: full PNG grid snapshot (letters + highlights + border).
 */
async function buildSlide(
  prs: any,
  layout: UnifiedPageLayout,
  puzzle: WordSearchPuzzle,
  showSolution: boolean,
  settings?: WordSearchSettings,
  backgroundCache?: FlattenedBackgroundPptCache,
  bookPageIndex = 0,
  suppressPageNumber = false,
  pagePart: 'clues' | 'grid' = 'clues'
): Promise<void> {
  const slide = prs.addSlide();
  const isSolutionPage = !!showSolution;
  const isGridOnlyPage = !isSolutionPage && settings?.core.twoPagePuzzles && pagePart === 'grid';

  // Prefer book canvas size (same source as defineLayout) so the frame is
  // centered on the slide even if layout.page rounding differs.
  const pageW = settings?.bookCanvas.customWidth
    ? settings.bookCanvas.customWidth
    : pt2in(layout.page.widthPt);
  const pageH = settings?.bookCanvas.customHeight
    ? settings.bookCanvas.customHeight
    : pt2in(layout.page.heightPt);
  const pageWidthPt = pageW * 72;
  const pageHeightPt = pageH * 72;

  // ── Flattened background (uneditable slide.background layer) ─────────────
  const bgCache = backgroundCache ?? new FlattenedBackgroundPptCache();
  const pageFrame = settings ? resolvePageFrameSettings(settings) : DEFAULT_PAGE_FRAME_SETTINGS;
  const frameOpts = pptBackgroundOptions(pageFrame);
  const bgConfig = showSolution
    ? answerPageBackgroundConfig(
        pageWidthPt,
        pageHeightPt,
        settings?.colors?.answerPage ?? {},
        pageFrame.cornerRadiusPx,
        frameOpts
      )
    : puzzlePageBackgroundConfig(
        pageWidthPt,
        pageHeightPt,
        settings?.colors?.puzzlePage ?? { backgroundColor: layout.page.backgroundColor },
        pageFrame.cornerRadiusPx,
        frameOpts
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
  if (!isGridOnlyPage && layout.headerAssembly) {
    addHeaderAssemblyToSlide(slide, layout.headerAssembly);
  } else if (!isGridOnlyPage && layout.title && layout.title.text) {
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
  if (!isGridOnlyPage && !layout.headerAssembly && layout.subtitle && layout.subtitle.text) {
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
  const shouldRenderGridOnThisPage = showSolution || !settings?.core.twoPagePuzzles || pagePart === 'grid';
  if (shouldRenderGridOnThisPage) {
    const g = layout.grid;
    const framePaddingPt = g.framePaddingPt || 0;
    const activeGridBorder = showSolution
      ? resolveSolutionGridBorder(settings?.core ?? ({} as WordSearchSettings["core"]))
      : resolvePuzzleGridBorder(settings?.core ?? ({} as WordSearchSettings["core"]));
    const borderCssPx = activeGridBorder.strokeThicknessPx;
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

    // Solutions: highlight underlay image + editable letters (same font/size as puzzles).
    // Full letter snapshots drop custom fonts (Sunday Magic) → wrong look in PPT.
    if (showSolution && settings) {
      const snapshot = await captureGridSnapshot(
        puzzle,
        settings,
        g.cellSizePt,
        g.fontSizePt,
        { scale: 3, includeLetters: false },
        true
      );
      if (snapshot) {
        slide.addImage({
          data: snapshot.dataUrl,
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
          activeGridBorder.cornerRadiusPx,
          g.boxColor,
          borderLinePt,
          g.noBox
        );
      }
      _buildEditableLetterGrid(slide, puzzle, g);
    } else {
      // Optional shape silhouette under editable letters (no letter pixels in image).
      const needsShapeUnderlay =
        !!settings?.core.shapeWordSearchEnabled &&
        !!settings.core.shapeMaskShowImage &&
        !!resolveShapeMaskImageSrc(settings.core, puzzle.puzzleIndexInDocument ?? 0);

      let underlayPlaced = false;
      if (needsShapeUnderlay && settings) {
        const snapshot = await captureGridSnapshot(
          puzzle,
          settings,
          g.cellSizePt,
          g.fontSizePt,
          { scale: 3, includeLetters: false },
          false
        );
        if (snapshot) {
          const inkPadIn = pt2in(snapshot.inkPadPt ?? 0);
          slide.addImage({
            data: snapshot.dataUrl,
            x: outerGridXIn - inkPadIn,
            y: outerGridYIn - inkPadIn,
            w: outerGridWIn + inkPadIn * 2,
            h: outerGridHIn + inkPadIn * 2,
          });
          underlayPlaced = true;
        }
      }

      if (!underlayPlaced) {
        _addGridFrameShape(
          slide,
          outerGridXIn,
          outerGridYIn,
          outerGridWIn,
          outerGridHIn,
          activeGridBorder.cornerRadiusPx,
          g.boxColor,
          borderLinePt,
          g.noBox
        );
      }

      _buildEditableLetterGrid(slide, puzzle, g);
    }
  }

  // ── Word list (puzzle pages only) ─────────────────────────────────────────
  const wl = layout.wordList;
  if (!showSolution && !isGridOnlyPage && wl && wl.words.length > 0) {
    const wordFontSize = Math.max(4, wl.fontSizePt);
    const wordColor = hex6(wl.color);
    const columnWidths = wl.columnWidthsPt;
    const wordsPerCol = wl.wordsPerColumn;

    for (let i = 0; i < wl.words.length; i++) {
      const col = Math.min(Math.floor(i / wordsPerCol), wl.columns - 1);
      const row = i % wordsPerCol;
      const word = wl.words[i];

      const prevColsWidth = columnWidths
        .slice(0, col)
        .reduce((sum, w) => sum + w, 0);
      const wordXPt = wl.centeredLeftPt + prevColsWidth + col * wl.columnGapPt;
      const wordYPt = wl.topPt + row * wl.lineHeightPt;

      const wordX = pt2in(wordXPt);
      const wordY = pt2in(wordYPt);
      const wordW = safeIn(pt2in((columnWidths[col] || 80) + 4), 0.3);
      const wordH = safeIn(pt2in(wl.lineHeightPt), 0.15);

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

  if (settings && !suppressPageNumber) {
    addPageNumberToSlide(
      slide,
      pageWidthPt,
      pageHeightPt,
      settings,
      bookPageIndex
    );
  }
}

/**
 * Build editable per-cell letter text boxes for puzzle grids.
 * Fill = text color; stroke = pptxgenjs `outline`.
 * Boxes are slightly larger than the cell so large fonts / strokes are not cropped at the top.
 */
function _buildEditableLetterGrid(
  slide: any,
  puzzle: WordSearchPuzzle,
  g: UnifiedPageLayout["grid"]
): void {
  const gridX = pt2in(g.leftPt);
  const gridY = pt2in(g.topPt);
  const cellWIn = safeIn(pt2in(g.cellSizePt), 0.05);
  const cellHIn = safeIn(pt2in(g.cellSizePt), 0.05);
  const gridColor = hex6(g.letterColor);
  const strokeThicknessPt = Math.max(0, g.letterStrokeThicknessPt || 0);
  const letterOutline =
    strokeThicknessPt > 0
      ? {
          // CSS stroke width in pt (not doubled — PPT outline is already a full stroke).
          size: Math.max(0.25, strokeThicknessPt),
          color: hex6(g.letterStrokeColor || "#000000"),
        }
      : undefined;
  const gridFontSz = Math.max(1, g.fontSizePt);
  // Expand past the cell so ascenders / outline are not clipped by the text box.
  const overflowIn = pt2in(
    Math.max(strokeThicknessPt * 1.5, Math.min(g.fontSizePt * 0.2, g.cellSizePt * 0.25))
  );
  const zeroMargin: [number, number, number, number] = [0, 0, 0, 0];

  for (let row = 0; row < g.rows; row++) {
    for (let col = 0; col < g.cols; col++) {
      if (!isWordSearchShapeCell(puzzle.shapeMask, row, col)) continue;
      const letter = (puzzle.grid[row]?.[col] ?? "").trim();
      if (!letter) continue;

      slide.addText(letter, {
        x: gridX + col * cellWIn - overflowIn,
        y: gridY + row * cellHIn - overflowIn,
        w: cellWIn + overflowIn * 2,
        h: cellHIn + overflowIn * 2,
          fontSize: gridFontSz,
          fontFace: wordSearchFontFamily(g.fontFamily || "Arial", puzzle),
          color: gridColor,
        ...(letterOutline ? { outline: letterOutline } : {}),
          bold: false,
          align: "center",
          valign: "middle",
        margin: zeroMargin,
        inset: 0,
        wrap: false,
        isTextBox: true,
        fill: { type: "none" as const },
        line: { color: "FFFFFF", transparency: 100, width: 0 },
      });
    }
  }
}

/**
 * Build a multi-puzzle solution page.
 *
 * Each solution grid is a full pixel-perfect PNG (highlights + letters + border).
 * Title text remains an editable native PPT text element.
 * Falls back to frame + editable letters if the snapshot returns null.
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
  bookPageIndex = 0,
  suppressPageNumber = false
): Promise<void> {
  const slide = prs.addSlide();

  // ─── PAGE DIMENSIONS (from live settings) ────────────────────────────────
  const pageWidthPt = (settings.bookCanvas.customWidth || 8.5) * 72;
  const pageHeightPt = (settings.bookCanvas.customHeight || 11) * 72;

  // ─── Flattened background (uneditable slide.background layer) ────────────
  const bgCache = backgroundCache ?? new FlattenedBackgroundPptCache();
  const solutionPageFrame = resolvePageFrameSettings(settings);
  const answerBgConfig = answerPageBackgroundConfig(
    pageWidthPt,
    pageHeightPt,
    settings.colors.answerPage,
    solutionPageFrame.cornerRadiusPx,
    pptBackgroundOptions(solutionPageFrame)
  );
  await applyFlattenedBackgroundToSlide(slide, answerBgConfig, bgCache, hex6);

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
          titleText = getPuzzleContentLine(lines, puzzle, settings, true);
          break;
        }
        default:
          titleText = titleWords.title || "Word Search";
      }
      numberingStyle = settings.typography.puzzleNumberingStyle || "none";
    } else {
      titleText = settings.typography.customSolutionTitle || "Solutions";
      numberingStyle = settings.typography.solutionNumberingStyle || "none";
    }

    const pNum = resolvePuzzleDisplayNumber(puzzle, settings, idx);
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
    // Solution letters use the same fill/stroke as the puzzle grid.
    const letterColor = hex6(settings.colors.puzzlePage.puzzleColor || "#000000");
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
    const renderFontFamily = wordSearchFontFamily(gridFontFamily, puzzle);

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

    // ─── SOLUTION GRID: highlight underlay + editable letters ─────────────
    // Same font / size / fill / stroke path as puzzle pages (editable text).
    const snapshot = await captureGridSnapshot(
      puzzle,
      settings,
      cellSizePt,
      gridFontSizePt,
      { scale: 3, includeLetters: false }
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
      slide.addImage({
        data: snapshot.dataUrl,
        x: imageXIn,
        y: imageYIn,
        w: imageWIn,
        h: imageHIn,
      });
    } else {
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
    }

    const letterStrokeColor =
      settings.colors.puzzlePage.puzzleLetterStrokeColor || "#000000";
    const letterStrokeThicknessPt = Math.max(
      0,
      cssPxToPoints(settings.colors.puzzlePage.puzzleLetterStrokeThickness ?? 0)
    );
    const letterG: UnifiedPageLayout["grid"] = {
        topPt: gridTopPt,
        leftPt: gridLeftPt,
        cellSizePt: cellSizePt,
        widthPt: gridWidthPt,
        heightPt: gridHeightPt,
        rows: gridRows,
        cols: gridCols,
        fontSizePt: gridFontSizePt,
        fontFamily: renderFontFamily,
        letterColor: letterColor,
      letterStrokeColor,
      letterStrokeThicknessPt,
        boxColor: boxColor,
        borderThicknessPt: borderThicknessPt,
        noBox: settings.core.noBoxAroundPuzzle ?? false,
      innerGridOpacity: settings.core.innerGridOpacity ?? 0,
      gridLinesThicknessPt: settings.core.gridLinesStrokeThickness ?? 0,
      gridLinesColor:
        settings.colors.puzzlePage.gridLinesColor ||
        settings.colors.puzzlePage.boxColor ||
        "#d1d5db",
        framePaddingPt: paddingPt,
      };
    _buildEditableLetterGrid(slide, puzzle, letterG);
  }

  if (!suppressPageNumber) {
    addPageNumberToSlide(slide, pageWidthPt, pageHeightPt, settings, bookPageIndex);
  }
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
      core: { ...wordSearchSettings.core, twoPagePuzzles: wordSearchSettings.core.twoPagePuzzles ?? false },
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
      const layoutSettingsRaw = resolveLayoutSettingsForExport(documentPages, baseSettings);
      // Keep title/blank/WS slides on one slide size (matches buildSettingsForCompiledPage).
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
        const allowPageNumber = shouldDrawBookPageNumber(
          compiledPage.bookPageIndex,
          compiled.pages
        );
        if (onProgress) {
          onProgress(`Building slide ${slideIdx + 1} of ${totalSlides}…`);
        }

        if (compiledPage.kind === "text") {
          await addTextModuleSlide(
            prs,
            compiledPage.settings,
            layoutSettings,
            compiledPage.bookPageIndex,
            backgroundCache,
            compiledPage.sourceDocumentName,
            compiledPage.resolvedToc,
            !allowPageNumber,
            compiledPage.moduleType
          );
          continue;
        }

        if (compiledPage.kind === "blank") {
          await addBlankSeparatorSlide(
            prs,
            layoutSettings,
            compiledPage.bookPageIndex,
            backgroundCache,
            !allowPageNumber
          );
          continue;
        }

        // Crossword / maze / sudoku / trivia / scramble: native PPT text + shapes.
        if (isGenericOrCrosswordPageKind(compiledPage.kind)) {
          await addNativeGenericOrCrosswordSlide(
            prs,
            compiledPage,
            layoutSettings,
            documentPages,
            titleWords,
            backgroundCache,
            !allowPageNumber
          );
          continue;
        }

        if (compiledPage.kind === "murdoku" || compiledPage.kind === "murdoku-solution") {
          const snapshot = await captureCompiledPageSnapshot(compiledPage, {
            documentPages,
            layoutSettings,
            titleWords,
          });
          const pageW = layoutSettings.bookCanvas.customWidth || 8.5;
          const pageH = layoutSettings.bookCanvas.customHeight || 11;
          const slide = prs.addSlide();
          if (snapshot) {
            slide.addImage({
              data: snapshot.dataUrl,
              x: 0,
              y: 0,
              w: pageW,
              h: pageH,
            });
          }
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
          puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
            {
              ...puzzle,
              puzzleIndexInDocument: compiledPage.puzzleIndexInDocument,
            },
            effectiveSettings,
            compiledPage.puzzleIndexInDocument
          );

          const layout = computeWordSearchPageLayout(
            puzzle,
            effectiveSettings,
            docTitleWords,
            false,
            puzzleGridScale,
            titleToAnswerGap,
            bookHeaderTitleFontSizePt,
            compiledPage.pagePart ?? 'clues'
          );

          await buildSlide(
            prs,
            layout,
            puzzle,
            false,
            effectiveSettings,
            backgroundCache,
            compiledPage.bookPageIndex,
            !allowPageNumber,
            compiledPage.pagePart ?? 'clues'
          );
          continue;
        }

        if (compiledPage.kind === "solution") {
          const chunkSize = effectiveSettings.bookCanvas.answersPerPage || 1;

          if (chunkSize === 1) {
            const puzzle = compiledPage.puzzles[0];
            puzzle.puzzleNumber = resolvePuzzleDisplayNumber(puzzle, effectiveSettings, 0);

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
              compiledPage.bookPageIndex,
              !allowPageNumber
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
              compiledPage.bookPageIndex,
              !allowPageNumber
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
          puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
            puzzle,
            getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex),
            pi
          );

        const effectiveSettings = getMergedSettingsForPage(
          baseSettings, pageOverrides, applyMode, currentPageIndex
        );

        const clueLayout = computeWordSearchPageLayout(
          puzzle,
          effectiveSettings,
          titleWords,
          false,
          puzzleGridScale,
          titleToAnswerGap,
          bookHeaderTitleFontSizePt,
          'clues'
        );

        await buildSlide(
          prs,
          clueLayout,
          puzzle,
          false,
          effectiveSettings,
          backgroundCache,
          currentPageIndex,
          false,
          'clues'
        );
        currentPageIndex++;

        if (effectiveSettings.core.twoPagePuzzles) {
          const gridLayout = computeWordSearchPageLayout(
            puzzle,
            effectiveSettings,
            titleWords,
            false,
            puzzleGridScale,
            titleToAnswerGap,
            bookHeaderTitleFontSizePt,
            'grid'
          );

          await buildSlide(
            prs,
            gridLayout,
            puzzle,
            false,
            effectiveSettings,
            backgroundCache,
            currentPageIndex,
            false,
            'grid'
          );
          currentPageIndex++;
        }

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
            puzzle.puzzleNumber = resolvePuzzleDisplayNumber(
              puzzle,
              getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex),
              pi
            );

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
 * Puzzle + solution letters are editable PPT text (fill + stroke) using the
 * same font family/size as the canvas. Solution highlights are PNG underlays.
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
