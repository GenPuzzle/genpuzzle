/**
 * Shared layout calculator for Word Search puzzles
 * Used by both the canvas preview and PDF export to ensure WYSIWYG
 */

import { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from './puzzles/types';

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

// Calculate layout for puzzle or solution page
export function calculateLayout(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  pageWidthInches: number,
  pageHeightInches: number,
  showSolution: boolean
): LayoutResult {
  const { core, typography, wordList, colors } = settings;
  const pageColors = showSolution ? colors.answerPage : colors.puzzlePage;

  // Convert inches to points (72 points per inch)
  const pageWidth = pageWidthInches * 72;
  const pageHeight = pageHeightInches * 72;
  const margin = 0.5 * 72; // 0.5 inch margin
  const contentWidth = pageWidth - margin * 2;

  // Calculate title
  let titleText = '';
  const puzzleNum = puzzle.puzzleNumber || 1;

  if (showSolution) {
    titleText = colors.answerPage.answerTitlePrefix || 'Solution';
    if (colors.answerPage.showAnswerNumber) {
      titleText += ` ${puzzleNum}`;
    }
  } else {
    switch (typography.selectTitleOption) {
      case 'puzzle-number':
        titleText = `${titleWords.title || 'Word Search'} #${puzzleNum}`;
        break;
      case 'custom':
        titleText = typography.titleText || '';
        break;
      default:
        titleText = '';
    }
  }

  const titleSize = showSolution
    ? (colors.answerPage.answerTitleFontSize || 20)
    : (typography.puzzleTitleFontSize || 20);

  const titleAlignment = showSolution
    ? (colors.answerPage.answerTitleAlignment || 'center')
    : 'center';

  // Starting Y position (top of content area)
  let currentY = pageHeight - margin - (typography.titleStartAt || 40);

  // Calculate title X position
  let titleX = margin;
  if (titleAlignment === 'center') {
    titleX = (pageWidth - 200) / 2; // Approximate - actual width calculated in component
  } else if (titleAlignment === 'right') {
    titleX = pageWidth - margin - 200;
  }

  const titleY = currentY;

  // Subtitle
  const subtitleText = (!showSolution && typography.includeSubtitle) ? typography.subtitleText : '';
  const subtitleSize = titleSize - 6;
  const subtitleX = margin;
  const subtitleY = currentY - titleSize - 10;

  if (subtitleText) {
    currentY -= titleSize + 10 + subtitleSize + 10;
  } else {
    currentY -= titleSize + 10;
  }

  currentY -= typography.spaceBetweenTitleAndPuzzle || 20;

  // Calculate grid dimensions
  const gridRows = puzzle.grid.length;
  const gridCols = puzzle.grid[0].length;
  const availableWidth = contentWidth - 40;
  const availableHeight = currentY - margin - 120;

  const cellSize = Math.min(availableWidth / gridCols, availableHeight / gridRows, 20);
  const gridWidth = cellSize * gridCols;
  const gridHeight = cellSize * gridRows;

  // Center the grid horizontally
  const gridStartX = (pageWidth - gridWidth) / 2;
  const gridStartY = currentY;

  // Word list position
  const wordListY = gridStartY - gridHeight - 30;
  const wordListFontSize = wordList.wordListFontSize || 12;
  const wordListLineHeight = wordListFontSize + 4;

  return {
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    titleText,
    titleSize,
    titleX,
    titleY,
    titleAlignment,
    subtitleText,
    subtitleSize,
    subtitleX,
    subtitleY,
    gridStartX,
    gridStartY,
    cellSize,
    gridWidth,
    gridHeight,
    gridRows,
    gridCols,
    wordListY,
    wordListFontSize,
    wordListLineHeight,
    currentY,
    backgroundColor: pageColors.backgroundColor || '#ffffff',
    titleColor: pageColors.titleColor || '#000000',
    boxColor: pageColors.boxColor || '#000000',
    puzzleColor: pageColors.puzzleColor || '#000000',
    wordListColor: pageColors.wordListColor || '#000000',
    subtitleColor: pageColors.subtitleColor || '#666666',
  };
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
    const { start, end } = placement;

    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);

    // Calculate cell positions in pixels
    const startCellX = layout.gridStartX + start.col * layout.cellSize + layout.cellSize / 2;
    const startCellY = layout.gridStartY - start.row * layout.cellSize - layout.cellSize / 2;
    const endCellX = layout.gridStartX + end.col * layout.cellSize + layout.cellSize / 2;
    const endCellY = layout.gridStartY - end.row * layout.cellSize - layout.cellSize / 2;

    // Determine direction
    const isHorizontal = start.row === end.row;
    const isVertical = start.col === end.col;
    const isDiagonal = Math.abs(end.col - start.col) === Math.abs(end.row - start.row);

    if (isHorizontal) {
      // Horizontal word - tight frame
      const padding = layout.cellSize * 0.15;
      const x = layout.gridStartX + minCol * layout.cellSize + padding;
      const y = layout.gridStartY - (start.row + 1) * layout.cellSize + padding;
      const width = (maxCol - minCol + 1) * layout.cellSize - padding * 2;
      const height = layout.cellSize - padding * 2;
      highlights.push({ x, y, width, height, rotation: 0, startX: startCellX, startY: startCellY, endX: endCellX, endY: endCellY, word: placement.word });
    } else if (isVertical) {
      // Vertical word - tight frame
      const padding = layout.cellSize * 0.15;
      const x = layout.gridStartX + start.col * layout.cellSize + padding;
      const y = layout.gridStartY - (maxRow + 1) * layout.cellSize + padding;
      const width = layout.cellSize - padding * 2;
      const height = (maxRow - minRow + 1) * layout.cellSize - padding * 2;
      highlights.push({ x, y, width, height, rotation: 0, startX: startCellX, startY: startCellY, endX: endCellX, endY: endCellY, word: placement.word });
    } else if (isDiagonal) {
      // Diagonal word - store as line data for special handling
      const numLetters = Math.abs(end.col - start.col) + 1;
      // Store diagonal info for rendering as line with circles
      highlights.push({
        x: 0,
        y: 0,
        width: layout.cellSize,
        height: layout.cellSize,
        rotation: (end.col > start.col && end.row < start.row) || (end.col < start.col && end.row > start.row) ? 45 : -45,
        startX: startCellX,
        startY: startCellY,
        endX: endCellX,
        endY: endCellY,
        word: placement.word,
      });
    } else {
      // Fallback to bounding box
      const x = layout.gridStartX + minCol * layout.cellSize - strokePadding;
      const y = layout.gridStartY - (maxRow + 1) * layout.cellSize - strokePadding;
      const width = (maxCol - minCol + 1) * layout.cellSize + strokePadding * 2;
      const height = (maxRow - minRow + 1) * layout.cellSize + strokePadding * 2;
      highlights.push({ x, y, width, height, rotation: 0, word: placement.word });
    }
  }

  return highlights;
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
