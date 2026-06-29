/**
 * Shared layout calculator for Word Search puzzles
 * Used by both the canvas preview and PDF export to ensure WYSIWYG
 */

import { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from './puzzles/types';
import {
  computeWordSearchPageLayout,
  DEFAULT_WORD_SPACING_HORIZONTAL,
  getWordListLineHeightPt,
  unifiedToLegacyLayout,
} from './word-search-page-layout';

/** PDF points (72 per inch) → CSS px (96 per inch) for screen preview matching print. */
export const PT_TO_CSS_PX = 96 / 72;

export function pointsToCssPx(points: number): number {
  return points * PT_TO_CSS_PX;
}

export function getPageDimensionsInches(settings: WordSearchSettings): {
  width: number;
  height: number;
} {
  if (
    settings.bookCanvas.customWidth &&
    settings.bookCanvas.customHeight
  ) {
    return {
      width: settings.bookCanvas.customWidth,
      height: settings.bookCanvas.customHeight,
    };
  }
  return { width: 8.5, height: 11 };
}

export function getPageMarginInches(settings: WordSearchSettings): number {
  return settings.bookCanvas.includeBleed ? 0.125 : 0.5;
}

/** Gap between title baseline block and grid (matches calculateLayout). */
export const TITLE_TO_GRID_GAP_PT = 10;

/**
 * Text wrapping utility for long subtitles/fun facts.
 * Splits text into lines that fit within maxWidth, accounting for font metrics.
 * 
 * @param text - The text to wrap
 * @param maxWidth - Maximum width available (in points or pixels, depending on context)
 * @param charWidthEstimate - Average character width (0.5 = 50% of font size in points is typical for proportional fonts)
 * @returns Array of wrapped lines
 */
export function wrapText(
  text: string,
  maxWidth: number,
  charWidthEstimate: number = 0.5
): string[] {
  if (!text || maxWidth <= 0) return [];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    // Rough estimation: each character takes charWidthEstimate * fontSize width
    // For a more accurate approach with pdf-lib, measure actual glyph widths
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const estimatedWidth = testLine.length * charWidthEstimate * 12; // 12pt baseline for estimation
    
    if (estimatedWidth <= maxWidth) {
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

/**
 * Measure text width using canvas context (for Canvas preview).
 * Returns wrapped lines that fit within maxWidth.
 */
export function wrapTextCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text || maxWidth <= 0) return [];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width <= maxWidth) {
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

export interface LayoutResult {
  // Page dimensions (in points for PDF, or derived values for canvas)
  pageWidth: number;
  pageHeight: number;
  margin: number;
  contentWidth: number;

  // Title
  titleText: string;
  titleSize: number;
  titleX: number;
  titleY: number;
  titleAlignment: 'left' | 'center' | 'right';

  // Subtitle
  subtitleText: string;
  subtitleSize: number;
  subtitleX: number;
  subtitleY: number;

  // Grid
  gridStartX: number;
  gridStartY: number;
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  gridRows: number;
  gridCols: number;

  // Word list
  wordListY: number;
  wordListFontSize: number;
  wordListLineHeight: number;

  // Current Y position after title
  currentY: number;

  // Colors
  backgroundColor: string;
  titleColor: string;
  boxColor: string;
  puzzleColor: string;
  wordListColor: string;
  subtitleColor: string;
}

export interface WordHighlight {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Calculate layout for puzzle or solution page (delegates to unified layout engine)
export function calculateLayout(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  pageWidthInches: number,
  pageHeightInches: number,
  showSolution: boolean,
  puzzleGridScale: number = 70
): LayoutResult {
  const unified = computeWordSearchPageLayout(puzzle, settings, titleWords, showSolution, puzzleGridScale);
  return unifiedToLegacyLayout(unified);
}

export interface WordHighlightExtended extends WordHighlight {
  rotation?: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  word?: string;
  frameStyle?: 'rounded' | 'square' | 'circle';
  frameRadius?: number;
}

// Calculate highlight positions for solution page (handles all directions)
export function calculateHighlights(
  puzzle: WordSearchPuzzle,
  layout: LayoutResult,
  strokePadding: number
): WordHighlightExtended[] {
  const highlights: WordHighlightExtended[] = [];

  if (!puzzle.placements) return highlights;

  for (const placement of puzzle.placements) {
    const cells = getWordCells(placement.start, placement.end);

    // Compute pixel positions
    const xs = cells.map(c => layout.gridStartX + c.col * layout.cellSize);
    const ys = cells.map(c => layout.gridStartY - c.row * layout.cellSize);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // Check if this is a diagonal word
    const isHorizontal = placement.start.row === placement.end.row;
    const isVertical = placement.start.col === placement.end.col;
    const isDiagonal = !isHorizontal && !isVertical;

    if (isDiagonal) {
      // For diagonal words, calculate the rotated bounding box
      const startX = layout.gridStartX + placement.start.col * layout.cellSize + layout.cellSize / 2;
      const startY = layout.gridStartY - placement.start.row * layout.cellSize - layout.cellSize / 2;
      const endX = layout.gridStartX + placement.end.col * layout.cellSize + layout.cellSize / 2;
      const endY = layout.gridStartY - placement.end.row * layout.cellSize - layout.cellSize / 2;

      // Calculate angle for rotation
      const dx = endX - startX;
      const dy = endY - startY;
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      highlights.push({
        x: 0, // Not used for diagonal
        y: 0,
        width: 0,
        height: 0,
        rotation: angle,
        startX,
        startY,
        endX,
        endY,
        word: placement.word
      });
    } else {
      // For horizontal/vertical words, use bounding box
      const bounds = {
        x: minX + strokePadding,
        y: minY + strokePadding,
        w: maxX - minX + layout.cellSize - strokePadding * 2,
        h: maxY - minY + layout.cellSize - strokePadding * 2,
      };

      highlights.push({
        x: bounds.x,
        y: bounds.y,
        width: bounds.w,
        height: bounds.h,
        rotation: 0,
        word: placement.word
      });
    }
  }

  return highlights;
}

// Helper to get all cells for a word placement
function getWordCells(start: { row: number; col: number }, end: { row: number; col: number }): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  const dRow = end.row > start.row ? 1 : end.row < start.row ? -1 : 0;
  const dCol = end.col > start.col ? 1 : end.col < start.col ? -1 : 0;
  const length = Math.max(Math.abs(end.row - start.row), Math.abs(end.col - start.col)) + 1;

  for (let i = 0; i < length; i++) {
    cells.push({
      row: start.row + i * dRow,
      col: start.col + i * dCol
    });
  }

  return cells;
}

// Format words for display
export function formatWords(
  words: string[],
  wordList: WordSearchSettings['wordList']
): string[] {
  let formatted = [...words];

  if (!wordList.dontAlphabetize) {
    formatted.sort();
  }

  return formatted.map(word => {
    switch (wordList.wordListCase) {
      case 'upper': return word.toUpperCase();
      case 'lower': return word.toLowerCase();
      case 'title': return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      default: return word;
    }
  });
}

// Calculate word list positions
export function calculateWordListPositions(
  words: string[],
  layout: LayoutResult,
  numColumns: number
): { x: number; y: number; word: string }[] {
  const positions: { x: number; y: number; word: string }[] = [];
  const colWidth = layout.contentWidth / numColumns;
  const wordsPerCol = Math.ceil(words.length / numColumns);
  const startY = layout.wordListY - (wordsPerCol * layout.wordListLineHeight - layout.wordListFontSize) / 2;

  for (let i = 0; i < words.length; i++) {
    const col = Math.floor(i / wordsPerCol);
    const row = i % wordsPerCol;

    const x = layout.margin + col * colWidth + (colWidth - 100) / 2;
    const y = startY - row * layout.wordListLineHeight;

    positions.push({ x, y, word: words[i] });
  }

  return positions;
}

/** Resolve horizontal/vertical word list spacing (supports legacy wordListGap). */
export function getWordListSpacing(wordList: WordSearchSettings['wordList']): {
  horizontal: number;
  vertical: number;
} {
  const legacy = wordList.wordListGap;
  return {
    horizontal: wordList.wordSpacingHorizontal ?? legacy ?? DEFAULT_WORD_SPACING_HORIZONTAL,
    vertical: wordList.wordSpacingVertical ?? legacy ?? 8,
  };
}

/** Solution grid font size — respects "custom size for answer pages" toggle. */
export function getSolutionGridFontSize(typography: WordSearchSettings['typography']): number {
  // FIX: Completely isolate from puzzleGridFontSize
  // Use answerGridFontSize ONLY if explicitly enabled and set
  if (typography.setFontSizeForAnswerPages && typography.answerGridFontSize !== undefined && typography.answerGridFontSize !== null && typography.answerGridFontSize !== 0) {
    return typography.answerGridFontSize;
  }
  // Strict hardcoded default for solutions (never fallback to puzzleGridFontSize)
  return 18;
}

// Shared word list styling configuration used by both preview and PDF export
export interface WordListStyleConfig {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  columns: number;
  columnGap: number; // horizontal spacing between columns (points / px)
  rowGap: number; // vertical spacing between word rows (points / px)
  checkboxSize: number; // in points/pixels
  checkboxColor: string;
  checkboxGap: number; // space between checkbox and text
}

export function getWordListStyleConfig(
  wordListSettings: WordSearchSettings['wordList'],
  wordListColor: string,
  boxColor: string,
  pageWidthInches?: number
): WordListStyleConfig {
  const fontSize = wordListSettings.wordListFontSize || 12;
  const columns = wordListSettings.wordListColumns || 2;
  const spacing = getWordListSpacing(wordListSettings);

  return {
    fontFamily: wordListSettings.wordListFontFamily || 'Arial',
    fontSize,
    lineHeight: getWordListLineHeightPt(fontSize, spacing.vertical),
    color: wordListColor,
    textAlign: 'left', // Always LEFT-ALIGNED as required
    columns,
    columnGap: columns > 1 ? spacing.horizontal : 0,
    rowGap: spacing.vertical,
    checkboxSize: 10, // Standard checkbox size (in points for PDF, scaled in preview)
    checkboxColor: boxColor,
    checkboxGap: 8, // Space between checkbox and word text
  };
}
