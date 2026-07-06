/**
 * Unified page layout for Word Search — single source of truth for preview (CSS) and PDF (points).
 * All dimensions are stored in PDF points; convert to CSS px via pointsToCssPx().
 */

import {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
  DEFAULT_TITLE_START_AT,
} from './puzzles/types';
import {
  formatWords,
  getPageDimensionsInches,
  getPageMarginInches,
  getSolutionGridFontSize,
  getWordListSpacing,
  pointsToCssPx,
  PT_TO_CSS_PX,
  TITLE_TO_GRID_GAP_PT,
} from './puzzle-layout';
import {
  resolvePuzzleGridBorder,
  resolveSolutionGridBorder,
} from './grid-border-settings';
import {
  normalizeHeaderAssemblySettings,
  migrateLegacyHeaderLayout,
  type HeaderAssemblySettings,
} from './header-assembly/types';
import { getPuzzleContentLine } from './puzzle-line-index';
import { resolveHeaderTextParts } from './header-assembly/resolve-parts';
import {
  resolveHeaderBlockGeometry,
  resolveHeaderSubtitleTextWidthPt,
  resolvePageContentTopInsetPt,
} from './header-assembly/geometry';
import { cssPxToPt } from './header-assembly/compute-row';
import { measureHeaderAssemblyHeightPt } from './header-assembly/measure';
import { resolvePageHeaderTitleFontSizePt } from './header-assembly/book-title-size';

export { pointsToCssPx, PT_TO_CSS_PX, getPageDimensionsInches, getPageMarginInches };

export interface UnifiedTitleBlock {
  text: string;
  fontSizePt: number;
  topPt: number;
  align: 'left' | 'center' | 'right';
  color: string;
  fontFamily: string;
}

export interface UnifiedSubtitleBlock {
  text: string;
  fontSizePt: number;
  topPt: number;
  color: string;
  fontFamily: string;
  /** Pre-wrapped lines computed by the UI canvas (exact visual breaks) */
  wrappedLines: string[];
  /** Left X of the subtitle box (pt) */
  leftPt: number;
  /** Width of the subtitle box (pt) */
  widthPt: number;
}

/** Modular header assembly (number + title + subtitle shape containers). */
export interface UnifiedHeaderAssemblyBlock {
  topPt: number;
  leftPt: number;
  widthPt: number;
  heightPt: number;
  parts: ReturnType<typeof resolveHeaderTextParts>;
  subtitleLines: string[];
  titleFontSizePt: number;
  subtitleFontSizePt: number;
  titleColor: string;
  subtitleColor: string;
  fontFamily: string;
  subtitleFontFamily: string;
  settings: HeaderAssemblySettings;
  subtitleTextWidthPt: number;
}

export interface UnifiedGridBlock {
  topPt: number;
  leftPt: number;
  cellSizePt: number;
  widthPt: number;
  heightPt: number;
  rows: number;
  cols: number;
  fontSizePt: number;
  fontFamily: string;
  letterColor: string;
  boxColor: string;
  borderThicknessPt: number;
  noBox: boolean;
  innerGridOpacity: number; // 0-100
  gridLinesThicknessPt: number;
  gridLinesColor: string;
  /** Padding between outer frame and letters, in points */
  framePaddingPt: number;
}

export interface UnifiedWordListBlock {
  topPt: number;
  leftPt: number;
  widthPt: number;
  /** Total width of all columns + horizontal gaps (pt). */
  blockWidthPt: number;
  /** Centered X on full page (pt) — PDF uses this. */
  centeredLeftPt: number;
  /** Centered X inside content area (pt) — preview uses this. */
  contentLeftPt: number;
  /** Per-column widths for layout (pt). */
  columnWidthsPt: number[];
  fontSizePt: number;
  lineHeightPt: number;
  columnGapPt: number;
  rowGapPt: number;
  columns: number;
  wordsPerColumn: number;
  words: string[];
  color: string;
  fontFamily: string;
  addCheckboxes: boolean;
  checkboxSizePt: number;
  checkboxGapPt: number;
  checkboxColor: string;
}

/** Shared layout consumed by PreviewCanvas and pdf-export. */
export interface UnifiedPageLayout {
  page: {
    widthPt: number;
    heightPt: number;
    widthIn: number;
    heightIn: number;
    marginPt: number;
    marginIn: number;
    backgroundColor: string;
  };
  title: UnifiedTitleBlock | null;
  subtitle: UnifiedSubtitleBlock | null;
  headerAssembly: UnifiedHeaderAssemblyBlock | null;
  grid: UnifiedGridBlock;
  wordList: UnifiedWordListBlock | null;
  showSolution: boolean;
  /** Spacing values (pt) for debugging / sliders */
  spacing: {
    titleStartAtPt: number;
    spaceTitleToGridPt: number;
    spaceGridToWordListPt: number;
  };
}

const GRID_SIDE_INSET_PT = 0;
const WORD_LIST_BOTTOM_RESERVE_PT = 24;
const MAX_CELL_SIZE_PT = 20;

/** Preview estimate: average character width × font size (pt). Higher value accounts for spaces in multi-word entries */
const WORD_LIST_CHAR_WIDTH_EM = 0.65;

export const DEFAULT_WORD_SPACING_HORIZONTAL = 50;
export const MAX_WORD_SPACING_HORIZONTAL = 100;

/** Split words into columns (fill column-by-column). */
export function distributeWordsIntoColumns(words: string[], columns: number): string[][] {
  if (columns <= 0 || words.length === 0) return words.length ? [words] : [];
  const wordsPerCol = Math.ceil(words.length / columns);
  const result: string[][] = Array.from({ length: columns }, () => []);
  for (let i = 0; i < words.length; i++) {
    const col = Math.min(Math.floor(i / wordsPerCol), columns - 1);
    result[col].push(words[i]);
  }
  return result;
}

export function estimateWordListColumnWidthPt(
  columnWords: string[],
  fontSizePt: number,
  addCheckboxes: boolean,
  checkboxSizePt: number,
  checkboxGapPt: number
): number {
  // Find the longest entry by character count (accounts for multi-word entries like "Summer time")
  const longest = columnWords.reduce((max, w) => Math.max(max, w.length), 0);
  let width = longest * fontSizePt * WORD_LIST_CHAR_WIDTH_EM;
  if (addCheckboxes) width += checkboxSizePt + checkboxGapPt;
  return width;
}

export function computeWordListBlockWidthPt(
  columnWidthsPt: number[],
  columnGapPt: number
): number {
  if (columnWidthsPt.length === 0) return 0;
  const gapTotal = columnGapPt * Math.max(0, columnWidthsPt.length - 1);
  return columnWidthsPt.reduce((sum, w) => sum + w, 0) + gapTotal;
}

/** Page-absolute X: (pageWidth - blockWidth) / 2 — used by PDF. */
export function computeCenteredWordListLeftPt(
  pageWidthPt: number,
  blockWidthPt: number
): number {
  return Math.max(0, (pageWidthPt - blockWidthPt) / 2);
}

/** X inside printable content box — used by UI preview (parent already inset by margin). */
export function computeCenteredWordListLeftInContentPt(
  contentWidthPt: number,
  blockWidthPt: number
): number {
  return Math.max(0, (contentWidthPt - blockWidthPt) / 2);
}

/**
 * Vertical offset for word list row index (pt from word list top).
 * PDF: baseline Y = pageTop - topPt - this offset. UI: position top = this offset (in content box).
 * lineHeightPt must be fontSizePt + verticalSpacingPt (see getWordListLineHeightPt).
 */
export function getWordListRowTopOffsetPt(rowIndex: number, lineHeightPt: number): number {
  return rowIndex * lineHeightPt;
}

/** lineHeight = fontSize + vertical slider spacing (single source for both engines). */
export function getWordListLineHeightPt(fontSizePt: number, verticalSpacingPt: number): number {
  return fontSizePt + verticalSpacingPt;
}

export function measureWordListColumnWidthsPt(
  columns: string[][],
  measureWordWidthPt: (word: string) => number
): number[] {
  return columns.map((column) => {
    let maxWidth = 0;
    for (const word of column) {
      maxWidth = Math.max(maxWidth, measureWordWidthPt(word));
    }
    return maxWidth;
  });
}

function resolveTitleText(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  showSolution: boolean
): string {
  const { typography, colors } = settings;
  const puzzleNum = puzzle.puzzleNumber || 1;

  if (showSolution) {
    // Solution title logic
    let baseTitle = '';
    let numberingStyle = 'none';
    
    if (typography.solutionTitleStyle === 'same_as_puzzle') {
      // Use the same base title and numbering style as the puzzle page
      switch (typography.selectTitleOption) {
        case 'puzzle-number':
        case 'one-custom-title':
          baseTitle = typography.titleText || titleWords.title || 'Word Search';
          break;
        case 'custom': {
          const lines = (typography.titleText || '')
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
      numberingStyle = typography.puzzleNumberingStyle || 'none';
    } else {
      // Use custom solution title with its own numbering style
      baseTitle = typography.customSolutionTitle || 'Solution';
      numberingStyle = typography.solutionNumberingStyle || 'none';
    }

    // Apply numbering style to solution title
    if (baseTitle && numberingStyle !== 'none') {
      if (numberingStyle === 'prefix') {
        baseTitle = `${puzzleNum}. ${baseTitle}`;
      } else if (numberingStyle === 'suffix') {
        baseTitle = `${baseTitle} #${puzzleNum}`;
      }
    }

    return baseTitle;
  }

  // Puzzle title logic (non-solution)
  let baseTitle = '';
  switch (typography.selectTitleOption) {
    case 'puzzle-number':
      // For puzzle-number mode, get just the title without the default # suffix
      baseTitle = typography.titleText || titleWords.title || 'Word Search';
      break;
    case 'one-custom-title':
      baseTitle = typography.titleText || titleWords.title || 'Word Search';
      break;
    case 'custom': {
      const lines = (typography.titleText || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      baseTitle = getPuzzleContentLine(lines, puzzle, settings, true);
      break;
    }
    default:
      return '';
  }

  // ALWAYS apply puzzle numbering style formatting based on user selection
  const numberingStyle = typography.puzzleNumberingStyle || 'none';
  
  if (baseTitle && numberingStyle !== 'none') {
    if (numberingStyle === 'prefix') {
      baseTitle = `${puzzleNum}. ${baseTitle}`;
    } else if (numberingStyle === 'suffix') {
      baseTitle = `${baseTitle} #${puzzleNum}`;
    }
  }

  return baseTitle;
}

/** Word-wrap subtitle text to a max width in points. */
function wrapSubtitleLinesPt(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  maxWidthPt: number
): string[] {
  if (!text) return [];
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (!ctx) return [text];

  const maxWidthCssPx = maxWidthPt * PT_TO_CSS_PX;
  ctx.font = `${fontSizePt * PT_TO_CSS_PX}px ${fontFamily}`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidthCssPx) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = ctx.measureText(word).width <= maxWidthCssPx ? word : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/** Resolve fun fact/quote text for a specific puzzle. */
function resolveFunFactText(
  puzzle: WordSearchPuzzle,
  typography: WordSearchSettings['typography'],
  settings?: WordSearchSettings
): string {
  if (!typography.includeFunFacts || !typography.funFactsText) return '';
  
  const lines = typography.funFactsText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line);
  
  return getPuzzleContentLine(lines, puzzle, settings);
}

/** Convert top-down distance from page top to pdf-lib baseline/box Y (bottom origin). */
export function topPtToPdfY(pageHeightPt: number, topPt: number, boxHeightPt: number = 0): number {
  return pageHeightPt - topPt - boxHeightPt;
}

/**
 * Compute layout using top-down coordinates (same math for UI and PDF).
 */
export function computeWordSearchPageLayout(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  showSolution: boolean,
  puzzleScale: number = 70,
  titleToAnswerGap: number = 10,
  bookHeaderTitleFontSizePt?: number | null
): UnifiedPageLayout {
  const { core, typography, wordList, colors } = settings;
  const pageColors = showSolution ? colors.answerPage : colors.puzzlePage;
  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const marginPt = getPageMarginInches(settings) * 72;
  const contentWidthPt = pageWidthPt - marginPt * 2;

  const titleStartAtPt = (typography.titleStartAt !== undefined && typography.titleStartAt !== null) ? typography.titleStartAt : DEFAULT_TITLE_START_AT;
  const spaceTitleToGridPt = (typography.spaceBetweenTitleAndPuzzle !== undefined && typography.spaceBetweenTitleAndPuzzle !== null) ? typography.spaceBetweenTitleAndPuzzle : 20;
  const spaceGridToWordListPt = typography.spaceBetweenPuzzleAndWordList ?? 30;

  const contentTopInsetPt = resolvePageContentTopInsetPt(settings);
  let yPt = contentTopInsetPt + titleStartAtPt;

  const titleAlign = showSolution
    ? (colors.answerPage.answerTitleAlignment || 'center')
    : 'center';
  const titleSizePt = showSolution
    ? colors.answerPage.answerTitleFontSize || 20
    : typography.puzzleTitleFontSize || 20;
  const titleFontFamily = showSolution
    ? colors.answerPage.answerTitleFontFamily || 'Arial'
    : typography.puzzleTitleFontFamily || 'Arial';
  const subtitleFontFamily =
    typography.subtitleFontFamily || typography.puzzleTitleFontFamily || 'Arial';

  const rawHeaderAssembly =
    (colors.puzzlePage as { headerAssembly?: Partial<HeaderAssemblySettings>; headerLayout?: unknown })
      .headerAssembly ??
    migrateLegacyHeaderLayout(
      (colors.puzzlePage as { headerLayout?: Record<string, unknown> }).headerLayout
    );
  const headerAssemblySettings = normalizeHeaderAssemblySettings(rawHeaderAssembly);
  const useHeaderAssembly = !showSolution && headerAssemblySettings.enabled;

  let title: UnifiedTitleBlock | null = null;
  let subtitle: UnifiedSubtitleBlock | null = null;
  let headerAssembly: UnifiedHeaderAssemblyBlock | null = null;

  if (useHeaderAssembly) {
    const parts = resolveHeaderTextParts(puzzle, settings, titleWords);
    const hasContent = !!(parts.titleText || parts.showNumber || parts.subtitleText);

    if (hasContent) {
      const subtitleSizePt = typography.subtitleFontSize || 14;
      const subtitleToTitleGapPt = typography.subtitleToTitleGap ?? 10;
      const subtitleBoxMarginPt = typography.subtitleBoxMargin ?? 0;
      const subtitleMaxWidthPercent = typography.subtitleMaxWidthPercent ?? 100;
      const headerGeometry = resolveHeaderBlockGeometry(pageWidthPt, settings);
      const subtitleTextWidthPt = resolveHeaderSubtitleTextWidthPt(
        headerGeometry.widthPt,
        subtitleMaxWidthPercent,
        subtitleBoxMarginPt
      );
      const subtitleInnerWidthPt = Math.max(
        24,
        subtitleTextWidthPt - cssPxToPt(20)
      );
      const subtitleLines = wrapSubtitleLinesPt(
        parts.subtitleText,
        subtitleSizePt,
        subtitleFontFamily,
        subtitleInnerWidthPt
      );
        const subtitleLineCount =
        subtitleLines.length > 0 ? subtitleLines.length : parts.subtitleText ? 1 : 0;

      const fittedTitleSizePt =
        bookHeaderTitleFontSizePt != null
          ? bookHeaderTitleFontSizePt
          : resolvePageHeaderTitleFontSizePt(puzzle, settings, titleWords);

      const headerHeightPt = measureHeaderAssemblyHeightPt(
        headerAssemblySettings,
        fittedTitleSizePt,
        subtitleSizePt,
        subtitleLineCount,
        parts.showNumber,
        subtitleToTitleGapPt
      );

      headerAssembly = {
        topPt: Math.max(yPt, headerGeometry.minTopPt + titleStartAtPt),
        leftPt: headerGeometry.leftPt,
        widthPt: headerGeometry.widthPt,
        heightPt: headerHeightPt,
        parts,
        subtitleLines,
        titleFontSizePt: fittedTitleSizePt,
        subtitleFontSizePt: subtitleSizePt,
        titleColor: pageColors.titleColor || '#000000',
        subtitleColor: colors.puzzlePage.subtitleColor || '#6b7280',
        fontFamily: titleFontFamily,
        subtitleFontFamily,
        settings: headerAssemblySettings,
        subtitleTextWidthPt,
      };
      yPt = headerAssembly.topPt + headerHeightPt + spaceTitleToGridPt;
    } else {
      yPt += TITLE_TO_GRID_GAP_PT + spaceTitleToGridPt;
    }
  } else {
  const titleText = resolveTitleText(puzzle, settings, titleWords, showSolution);

  if (titleText) {
    title = {
      text: titleText,
      fontSizePt: titleSizePt,
      topPt: yPt,
      align: titleAlign,
      color: pageColors.titleColor || '#000000',
      fontFamily: titleFontFamily,
    };
    yPt += titleSizePt;
  }

  // Step 2: Check for subtitle and add appropriate gap
  
  // ===== CALCULATE GRID DIMENSIONS EARLY (needed for subtitle max width) =====
  const gridRowsEarly = puzzle.grid.length;
  const gridColsEarly = puzzle.grid[0].length;
  const maxAvailableWidthPtEarly = contentWidthPt;
  const scaleFactorEarly = Math.max(0.5, Math.min(puzzleScale / 100, 2.0));
  const scaledGridWidthPtEarly = maxAvailableWidthPtEarly * scaleFactorEarly;
  
  if (!showSolution) {
    const funFactText = resolveFunFactText(puzzle, typography, settings);
    if (funFactText) {
      const subtitleSizePt = typography.subtitleFontSize || 14;
      
      const subtitleMaxWidthPercent = typography.subtitleMaxWidthPercent ?? 100;
      const subtitleBoxMarginPt = typography.subtitleBoxMargin ?? 0;
      let subtitleMaxWidthPt = (scaledGridWidthPtEarly * subtitleMaxWidthPercent) / 100;
      subtitleMaxWidthPt = Math.max(50, subtitleMaxWidthPt - (2 * subtitleBoxMarginPt));
      const subtitleMaxWidthCssPx = subtitleMaxWidthPt * PT_TO_CSS_PX;
      
      const subtitleToTitleGapPt = typography.subtitleToTitleGap ?? 10;

      yPt += subtitleToTitleGapPt;
      
      const startX = (pageWidthPt - subtitleMaxWidthPt) / 2;
      
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const ctx = canvas?.getContext('2d');
      let wrappedLines: string[] = [];
      
      if (ctx && funFactText) {
        ctx.font = `${subtitleSizePt * PT_TO_CSS_PX}px ${subtitleFontFamily}`;
        const maxWidthCssPx = subtitleMaxWidthCssPx;
        
        const words = funFactText.split(/\s+/);
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = ctx.measureText(testLine).width;
          
          if (testWidth <= maxWidthCssPx) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
              currentLine = '';
            }
            
            const wordWidth = ctx.measureText(word).width;
            if (wordWidth <= maxWidthCssPx) {
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
                  const chunkWidth = ctx.measureText(chunk).width;
                  if (chunkWidth <= maxWidthCssPx) {
                    bestFitIndex = mid;
                    low = mid + 1;
                  } else {
                    high = mid - 1;
                  }
                }
                
                if (bestFitIndex === 0) bestFitIndex = 1;
                wrappedLines.push(remaining.slice(0, bestFitIndex));
                remaining = remaining.slice(bestFitIndex);
              }
              currentLine = '';
            }
          }
        }
        if (currentLine) wrappedLines.push(currentLine);
      } else {
        wrappedLines = [funFactText];
      }
      
      const lineHeightPt = subtitleSizePt * 1.2;
      const subtitleHeightPt = wrappedLines.length * lineHeightPt;
      
      subtitle = {
        text: funFactText,
        fontSizePt: subtitleSizePt,
        topPt: yPt,
        color: colors.puzzlePage.subtitleColor || '#666666',
        fontFamily: subtitleFontFamily,
        wrappedLines,
        leftPt: startX,
        widthPt: subtitleMaxWidthPt,
      };
      
      yPt += subtitleHeightPt + spaceTitleToGridPt;
    } else {
      yPt += TITLE_TO_GRID_GAP_PT + spaceTitleToGridPt;
    }
  } else {
    yPt += titleToAnswerGap;
  }
  }

  // ===== CALCULATE GRID DIMENSIONS =====
  const gridRows = puzzle.grid.length;
  const gridCols = puzzle.grid[0].length;
  const maxAvailableWidthPt = contentWidthPt;
  const scaleFactor = Math.max(0.5, Math.min(puzzleScale / 100, 2.0));
  const scaledGridWidthPt = maxAvailableWidthPt * scaleFactor;

  const puzzleIndexInDocument = Math.max(0, puzzle.puzzleIndexInDocument ?? 0);
  const wordsPerPuzzle = Math.max(1, wordList.wordsPerPuzzle);
  const titleWordSlice = titleWords.words.slice(
    puzzleIndexInDocument * wordsPerPuzzle,
    puzzleIndexInDocument * wordsPerPuzzle + wordsPerPuzzle
  );
  const listSourceWords =
    !showSolution && titleWordSlice.some((word) => word.trim().length > 0)
      ? titleWordSlice.filter((word) => word.trim().length > 0)
      : puzzle.displayWords;

  const formattedWords =
    !showSolution && !wordList.hideWordList && listSourceWords.length > 0
      ? formatWords(listSourceWords, wordList)
      : [];
  const columns = wordList.wordListColumns || 2;
  const wordsPerColumn = formattedWords.length > 0 ? Math.ceil(formattedWords.length / columns) : 0;
  const listSpacing = getWordListSpacing(wordList);
  const wordListFontSizePt = wordList.wordListFontSize || 12;
  const wordListLineHeightPt = getWordListLineHeightPt(wordListFontSizePt, listSpacing.vertical);
  const wordListBlockHeightPt =
    formattedWords.length > 0 ? wordsPerColumn * wordListLineHeightPt + WORD_LIST_BOTTOM_RESERVE_PT : 0;

  const gridTopPt = yPt;
  
  // ===== CRITICAL: Grid Scale Isolation =====
  // The grid size is ONLY determined by the puzzleGridScale slider.
  // It does NOT change based on title size, word list font size, vertical spacing, etc.
  
  // Step 2: Calculate cell size from width alone (HORIZONTAL ONLY)
  // This is now completely independent of all other layout controls
  const cellSizePt = scaledGridWidthPt / gridCols;
  
  // Step 3: Calculate final grid dimensions (derived from cell size)
  const gridWidthPt = cellSizePt * gridCols;
  const gridHeightPt = cellSizePt * gridRows;
  
  // Step 4: Center grid horizontally (does not affect size)
  const gridLeftPt = marginPt + (contentWidthPt - gridWidthPt) / 2;

  const gridFontSizePt = showSolution
    ? getSolutionGridFontSize(typography)
    : typography.puzzleGridFontSize || 12;
  const gridFontFamily = showSolution
    ? typography.setFontForAnswerPages
      ? typography.answerGridFontFamily || typography.puzzleGridFontFamily || 'Arial'
      : typography.puzzleGridFontFamily || 'Arial'
    : typography.puzzleGridFontFamily || 'Arial';

  const activeGridBorder = showSolution
    ? resolveSolutionGridBorder(core)
    : resolvePuzzleGridBorder(core);

  const grid: UnifiedGridBlock = {
    topPt: gridTopPt,
    leftPt: gridLeftPt,
    cellSizePt: cellSizePt,
    widthPt: gridWidthPt,
    heightPt: gridHeightPt,
    rows: gridRows,
    cols: gridCols,
    fontSizePt: gridFontSizePt,
    fontFamily: gridFontFamily,
    letterColor: showSolution
      ? colors.answerPage.lettersInSolutionColor || '#000000'
      : colors.puzzlePage.puzzleColor || '#000000',
    boxColor: pageColors.boxColor || '#000000',
    borderThicknessPt: activeGridBorder.strokeThicknessPx,
    noBox: core.noBoxAroundPuzzle ?? false,
    innerGridOpacity: core.innerGridOpacity ?? 0,
    gridLinesThicknessPt: core.gridLinesStrokeThickness ?? 0,
    gridLinesColor: pageColors.gridLinesColor || pageColors.boxColor || '#d1d5db',
    framePaddingPt: activeGridBorder.paddingPx / PT_TO_CSS_PX,
  };

  // CRITICAL: Position word list relative to scaled grid bottom + constant gap
  const gridBottomYPt = gridTopPt + gridHeightPt;
  // Apply frame padding so the word list is positioned after the outer frame
  const framePaddingPt = activeGridBorder.paddingPx / PT_TO_CSS_PX;
  const wordListTopYPt = gridBottomYPt + framePaddingPt + spaceGridToWordListPt;

  let wordListBlock: UnifiedWordListBlock | null = null;
  if (formattedWords.length > 0) {
    const columnGapPt = columns > 1 ? listSpacing.horizontal : 0;
    const wordColumns = distributeWordsIntoColumns(formattedWords, columns);
    const columnWidthsPt = wordColumns.map((col) =>
      estimateWordListColumnWidthPt(
        col,
        wordListFontSizePt,
        wordList.addCheckboxes || false,
        10,
        8
      )
    );
    let blockWidthPt = computeWordListBlockWidthPt(columnWidthsPt, columnGapPt);
    
    // When spacing is at max (100), expand word list to full content width (reach page edges)
    if (spaceGridToWordListPt >= 100) {
      blockWidthPt = contentWidthPt;
    }
    
    const centeredLeftPt = computeCenteredWordListLeftPt(pageWidthPt, blockWidthPt);
    const contentLeftPt = computeCenteredWordListLeftInContentPt(contentWidthPt, blockWidthPt);

    wordListBlock = {
      topPt: wordListTopYPt,
      leftPt: marginPt,
      widthPt: contentWidthPt,
      blockWidthPt,
      centeredLeftPt,
      contentLeftPt,
      columnWidthsPt,
      fontSizePt: wordListFontSizePt,
      lineHeightPt: wordListLineHeightPt,
      columnGapPt,
      rowGapPt: listSpacing.vertical,
      columns,
      wordsPerColumn,
      words: formattedWords,
      color: colors.puzzlePage.wordListColor || '#4b5563',
      fontFamily: wordList.wordListFontFamily || 'Arial',
      addCheckboxes: wordList.addCheckboxes || false,
      checkboxSizePt: 10,
      checkboxGapPt: 8,
      checkboxColor: pageColors.boxColor || '#000000',
    };
  }

  return {
    page: {
      widthPt: pageWidthPt,
      heightPt: pageHeightPt,
      widthIn: dims.width,
      heightIn: dims.height,
      marginPt,
      marginIn: getPageMarginInches(settings),
      backgroundColor: pageColors.backgroundColor || '#ffffff',
    },
    title,
    subtitle,
    headerAssembly,
    grid,
    wordList: wordListBlock,
    showSolution,
    spacing: {
      titleStartAtPt,
      spaceTitleToGridPt,
      spaceGridToWordListPt,
    },
  };
}

/** CSS px helpers from unified layout */
export function layoutPtToCss(pt: number): number {
  return pointsToCssPx(pt);
}

/** Map unified layout → legacy LayoutResult (PDF bottom-origin grid coords). */
export function unifiedToLegacyLayout(
  u: UnifiedPageLayout
): import('./puzzle-layout').LayoutResult {
  return {
    pageWidth: u.page.widthPt,
    pageHeight: u.page.heightPt,
    margin: u.page.marginPt,
    contentWidth: u.page.widthPt - u.page.marginPt * 2,
    titleText: u.title?.text || '',
    titleSize: u.title?.fontSizePt || 20,
    titleX: u.grid.leftPt,
    titleY: u.title ? u.page.heightPt - u.title.topPt : 0,
    titleAlignment: u.title?.align || 'center',
    subtitleText: u.subtitle?.text || '',
    subtitleSize: u.subtitle?.fontSizePt || 14,
    subtitleX: u.page.marginPt,
    subtitleY: u.subtitle ? u.page.heightPt - u.subtitle.topPt : 0,
    gridStartX: u.grid.leftPt,
    gridStartY: u.page.heightPt - u.grid.topPt,
    cellSize: u.grid.cellSizePt,
    gridWidth: u.grid.widthPt,
    gridHeight: u.grid.heightPt,
    gridRows: u.grid.rows,
    gridCols: u.grid.cols,
    wordListY: u.wordList
      ? u.page.heightPt - u.wordList.topPt - u.wordList.fontSizePt
      : 0,
    wordListFontSize: u.wordList?.fontSizePt || 12,
    wordListLineHeight: u.wordList?.lineHeightPt || 20,
    currentY: u.page.heightPt - u.grid.topPt,
    backgroundColor: u.page.backgroundColor,
    titleColor: u.title?.color || '#000000',
    boxColor: u.grid.boxColor,
    puzzleColor: u.grid.letterColor,
    wordListColor: u.wordList?.color || '#000000',
    subtitleColor: u.subtitle?.color || '#666666',
  };
}
