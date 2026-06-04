/**
 * Unified page layout for Word Search — single source of truth for preview (CSS) and PDF (points).
 * All dimensions are stored in PDF points; convert to CSS px via pointsToCssPx().
 */

import {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
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

/** Preview estimate: average character width × font size (pt). */
const WORD_LIST_CHAR_WIDTH_EM = 0.55;

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
          baseTitle = lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
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
      baseTitle = lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
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

/** Resolve fun fact/quote text for a specific puzzle. */
function resolveFunFactText(
  puzzle: WordSearchPuzzle,
  typography: any
): string {
  if (!typography.includeFunFacts || !typography.funFactsText) return '';
  
  const lines = typography.funFactsText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line);
  
  const puzzleNum = puzzle.puzzleNumber || 1;
  return lines.length > 0 ? (lines[puzzleNum - 1] ?? '') : '';
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
  puzzleScale: number = 70
): UnifiedPageLayout {
  const { core, typography, wordList, colors } = settings;
  const pageColors = showSolution ? colors.answerPage : colors.puzzlePage;
  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const marginPt = getPageMarginInches(settings) * 72;
  const contentWidthPt = pageWidthPt - marginPt * 2;

  const titleStartAtPt = (typography.titleStartAt !== undefined && typography.titleStartAt !== null) ? typography.titleStartAt : 40;
  const spaceTitleToGridPt = (typography.spaceBetweenTitleAndPuzzle !== undefined && typography.spaceBetweenTitleAndPuzzle !== null) ? typography.spaceBetweenTitleAndPuzzle : 20;
  const spaceGridToWordListPt = typography.spaceBetweenPuzzleAndWordList ?? 30;

  let yPt = marginPt + titleStartAtPt;

  const titleText = resolveTitleText(puzzle, settings, titleWords, showSolution);
  const titleSizePt = showSolution
    ? colors.answerPage.answerTitleFontSize || 20
    : typography.puzzleTitleFontSize || 20;
  const titleFontFamily = showSolution
    ? colors.answerPage.answerTitleFontFamily || 'Inter'
    : typography.puzzleTitleFontFamily || 'Inter';
  const titleAlign = showSolution
    ? (colors.answerPage.answerTitleAlignment || 'center')
    : 'center';

  let title: UnifiedTitleBlock | null = null;
  if (titleText) {
    title = {
      text: titleText,
      fontSizePt: titleSizePt,
      topPt: yPt,
      align: titleAlign,
      color: pageColors.titleColor || '#000000',
      fontFamily: titleFontFamily,
    };
    // Step 2: Advance yPt after title
    yPt += titleSizePt;
  }

  // Step 2: Check for subtitle and add appropriate gap
  let subtitle: UnifiedSubtitleBlock | null = null;
  if (!showSolution) {
    const funFactText = resolveFunFactText(puzzle, typography);
    if (funFactText) {
      const subtitleSizePt = typography.subtitleFontSize || 14;
      const subtitleTextScalePx = typography.subtitleTextScale ?? 500; // CSS pixels
      const subtitleTextScalePt = subtitleTextScalePx / PT_TO_CSS_PX; // Convert to points
      const subtitleToTitleGapPt = typography.subtitleToTitleGap ?? 10;
      const subtitleToPuzzleGapPt = typography.subtitleToPuzzleGap ?? 10;
      
      // Step 2a: Add gap from title to subtitle
      yPt += subtitleToTitleGapPt;
      
      // ====== Strict Rendering & Text Wrapping Logic (Exact Conditional Algorithm) ======
      // IF subtitle text exists, THEN use subtitleTextScale as wrap boundary and calculate centered position
      const startX = (pageWidthPt - subtitleTextScalePt) / 2; // Center the text box on page
      
      // Text measurement using canvas context
      const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
      const ctx = canvas?.getContext('2d');
      let wrappedLines: string[] = [];
      
      if (ctx && funFactText) {
        ctx.font = `${subtitleSizePt * PT_TO_CSS_PX}px ${titleFontFamily}`;
        // Use subtitleTextScale directly as CSS pixels
        const maxWidthCssPx = subtitleTextScalePx;
        
        const words = funFactText.split(' ');
        let currentLine = '';
        
        // Word-by-word loop: build lines and wrap when they exceed max width
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = ctx.measureText(testLine).width;
          
          if (testWidth <= maxWidthCssPx) {
            currentLine = testLine;
          } else {
            if (currentLine) {
              wrappedLines.push(currentLine);
            }
            currentLine = word;
          }
        }
        
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
      } else {
        // Fallback: use original text as single line
        wrappedLines = [funFactText];
      }
      
      // Calculate subtitle height based on wrapped line count
      const lineHeightPt = subtitleSizePt * 1.2; // Standard line height
      const subtitleHeightPt = wrappedLines.length * lineHeightPt;
      
      subtitle = {
        text: funFactText,
        fontSizePt: subtitleSizePt,
        topPt: yPt,
        color: colors.puzzlePage.subtitleColor || '#666666',
        fontFamily: titleFontFamily,
      };
      
      // Step 3: Advance yPt after subtitle
      // IF multiple wrapped lines, THEN ensure proper spacing: advance currentY by line height for each line,
      // THEN add gap only after the very last line
      yPt += subtitleHeightPt + subtitleToPuzzleGapPt;
    } else {
      // No subtitle: just add the normal title-to-puzzle gap
      yPt += TITLE_TO_GRID_GAP_PT + spaceTitleToGridPt;
    }
  } else {
    // Solution page: no subtitle, just normal gap
    yPt += TITLE_TO_GRID_GAP_PT + spaceTitleToGridPt;
  }

  // If we have a subtitle, we've already added all the necessary gaps above
  // If we don't have a subtitle, we've added the normal gap
  // So we should NOT add spaceTitleToGridPt again here
  
  const gridRows = puzzle.grid.length;
  const gridCols = puzzle.grid[0].length;

  const formattedWords =
    !showSolution && !wordList.hideWordList && puzzle.displayWords.length > 0
      ? formatWords(puzzle.displayWords, wordList)
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
  
  // Step 1: Calculate grid width based on horizontal scale (LOCKED)
  const maxAvailableWidthPt = contentWidthPt;
  const scaleFactor = Math.max(0.5, Math.min(puzzleScale / 100, 2.0));
  const scaledGridWidthPt = maxAvailableWidthPt * scaleFactor;
  
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
      ? typography.answerGridFontFamily || typography.puzzleGridFontFamily || 'Inter'
      : typography.puzzleGridFontFamily || 'Inter'
    : typography.puzzleGridFontFamily || 'Inter';

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
    borderThicknessPt: core.borderStrokeThickness || 2,
    noBox: core.noBoxAroundPuzzle ?? false,
    innerGridOpacity: core.innerGridOpacity ?? 0,
    gridLinesThicknessPt: core.gridLinesStrokeThickness || 1,
  };

  // CRITICAL: Position word list relative to scaled grid bottom + constant gap
  const gridBottomYPt = gridTopPt + gridHeightPt;
  const wordListTopYPt = gridBottomYPt + spaceGridToWordListPt;

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
      fontFamily: wordList.wordListFontFamily || 'Inter',
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
