import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage, LineCapStyle, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
} from './puzzles/types';
import { calculateLayout, formatWords, getSolutionGridFontSize } from './puzzle-layout';
import {
  computeWordSearchPageLayout,
  computeCenteredWordListLeftPt,
  computeWordListBlockWidthPt,
  distributeWordsIntoColumns,
  getWordListRowTopOffsetPt,
  measureWordListColumnWidthsPt,
  DEFAULT_WORD_SPACING_HORIZONTAL,
} from './word-search-page-layout';
import {
  getCenteredGridLetterPdfPosition,
  getPdfGridBorderRectangle,
} from './grid-letter-centering';
import { getPDFSolutionPaths } from './solution-renderer';
import { getMergedSettingsForPage } from './page-settings';
import { getFontBuffer } from './font-loader';
import { getFallbackStandardFont } from './google-fonts';
import { isBoldFontWeight } from './publishing-fonts';

interface ExportOptions {
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
  puzzleGridScale?: number;
  titleToAnswerGap?: number;
  pageMargin?: number;
  // Page-level overrides and apply modes for WYSIWYG editing
  pageOverrides?: Map<number, Partial<WordSearchSettings>>;
  applyMode?: Map<string, boolean>;
}

// Convert inches to PDF points (72 points per inch)
function inchesToPoints(inches: number): number {
  return inches * 72;
}

// Convert hex string to pdf-lib RGB color (values 0-1)
function hexToRgb(hex: string | undefined): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
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
  const isCleanSans = /helvetica|inter|poppins|roboto|open sans|open-sans|lato|montserrat/.test(family);

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
      return pdfDoc.embedFont(fontBuffer, { subset: false });
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

// Draw rounded rectangle border for word highlights
function drawRoundedRectBorder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  borderColor: ReturnType<typeof rgb>,
  strokeWidth: number,
  opacity: number = 1
) {
  const x0 = x + radius;
  const x1 = x + width - radius;
  const y0 = y + radius;
  const y1 = y + height - radius;

  // Draw the straight segments between corners
  page.drawLine({
    start: { x: x0, y: y + height },
    end: { x: x1, y: y + height },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x1, y: y + height },
    end: { x: x + width, y: y1 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x + width, y: y1 },
    end: { x: x + width, y: y0 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x + width, y: y0 },
    end: { x: x1, y: y },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x1, y: y },
    end: { x: x0, y: y },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x0, y: y },
    end: { x: x, y: y0 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x, y: y0 },
    end: { x: x, y: y1 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  page.drawLine({
    start: { x: x, y: y1 },
    end: { x: x0, y: y + height },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: LineCapStyle.Round,
    opacity,
  });

  // Draw circles on corners to simulate rounded corners
  const cornerRadius = radius;
  page.drawEllipse({
    x: x0,
    y: y1,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
    borderOpacity: opacity,
  });
  page.drawEllipse({
    x: x1,
    y: y1,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
    borderOpacity: opacity,
  });
  page.drawEllipse({
    x: x1,
    y: y0,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
    borderOpacity: opacity,
  });
  page.drawEllipse({
    x: x0,
    y: y0,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
    borderOpacity: opacity,
  });
}

// Draw diagonal frame highlight for diagonally placed words
function drawDiagonalHighlight(
  page: PDFPage,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  borderColor: ReturnType<typeof rgb>,
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
      color: borderColor,
      thickness: strokeWidth,
      opacity,
    });
  }
}

async function drawWordSearchPuzzle(
  page: PDFPage,
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  gridFont: PDFFont,
  wordListFont: PDFFont,
  titleFont: PDFFont,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  showSolution: boolean = false,
  puzzleGridScale: number = 70
) {
  const { core, wordList, colors } = settings;

  const layout = computeWordSearchPageLayout(puzzle, settings, titleWords, showSolution, puzzleGridScale);
  const g = layout.grid;
  const pageMargin = layout.page.marginPt;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: safeColor(layout.page.backgroundColor, '#ffffff'),
  });

  if (layout.title) {
    const t = layout.title;
    const textWidth = titleFont.widthOfTextAtSize(t.text, t.fontSizePt);
    let titleX = pageMargin;
    if (t.align === 'center') {
      titleX = (pageWidth - textWidth) / 2;
    } else if (t.align === 'right') {
      titleX = pageWidth - pageMargin - textWidth;
    }
    page.drawText(t.text, {
      x: titleX,
      y: pageHeight - t.topPt,
      size: t.fontSizePt,
      font: titleFont,
      color: safeColor(t.color, '#000000'),
    });
  }

  if (layout.subtitle) {
    const s = layout.subtitle;
    const subWidth = titleFont.widthOfTextAtSize(s.text, s.fontSizePt);
    page.drawText(s.text, {
      x: (pageWidth - subWidth) / 2,
      y: pageHeight - s.topPt,
      size: s.fontSizePt,
      font: titleFont,
      color: safeColor(s.color, '#666666'),
    });
  }

  const gridTopY = pageHeight - g.topPt;
  const contentLeft = g.leftPt;
  const gridStartX = contentLeft;
  const gridStartY = gridTopY;
  const fontSize = g.fontSizePt;
  const cellSize = g.cellSizePt; // Preserve for legacy layout reference
  const gridWidth = g.widthPt;
  const gridHeight = g.heightPt;
  const totalColumns = g.cols;
  const totalRows = g.rows;

  // Cell Dimensions (EXACT BASELINE MATH)
  const cellWidth = gridWidth / totalColumns;
  const cellHeight = gridHeight / totalRows;

  // Track outermost cell boundaries to calculate the final border
  let gridOuterLeft = Number.MAX_VALUE;
  let gridOuterRight = Number.MIN_VALUE;
  let gridOuterTop = Number.MIN_VALUE;
  let gridOuterBottom = Number.MAX_VALUE;

  // Render letters in cells with HARDCODED BASELINE MATH for pdf-lib Text Centering
  for (let row = 0; row < totalRows; row++) {
    for (let col = 0; col < totalColumns; col++) {
      // Calculate the absolute Top-Left anchor of the current cell (pdf-lib Y goes up, so we subtract to move down)
      const cellLeftX = gridStartX + (col * cellWidth);
      const cellTopY = gridStartY - (row * cellHeight);

      // Get letter from puzzle grid
      const letter = puzzle.grid[row][col];

      // Text Dimensions with Cap-Height Fix (do NOT use heightAtSize() as it includes descenders)
      const textWidth = gridFont.widthOfTextAtSize(letter, fontSize);
      const visualTextHeight = fontSize * 0.7; // Cap-height approximation (70% of font size)

      // The Absolute Dead-Center Math (baseline drop to exact center of cell)
      const centerX = cellLeftX + (cellWidth / 2) - (textWidth / 2);
      const centerY = cellTopY - (cellHeight / 2) - (visualTextHeight / 2);

      // Track outermost boundaries
      gridOuterLeft = Math.min(gridOuterLeft, cellLeftX);
      gridOuterRight = Math.max(gridOuterRight, cellLeftX + cellWidth);
      gridOuterBottom = Math.min(gridOuterBottom, cellTopY - cellHeight);
      gridOuterTop = Math.max(gridOuterTop, cellTopY);

      // Execute the Draw with mathematically centered coordinates
      page.drawText(letter, {
        x: centerX,
        y: centerY,
        size: fontSize,
        font: gridFont,
        color: safeColor(g.letterColor, '#000000'),
      });
    }
  }

  // Draw the border lines of the grid strictly based on outermost cell boundaries
  if (!g.noBox) {
    const borderThickness = g.borderThicknessPt;
    page.drawRectangle({
      x: gridOuterLeft - borderThickness / 2,
      y: gridOuterBottom - borderThickness / 2,
      width: gridOuterRight - gridOuterLeft + borderThickness,
      height: gridOuterTop - gridOuterBottom + borderThickness,
      borderColor: safeColor(g.boxColor, '#000000'),
      borderWidth: borderThickness,
    });
  }

  const legacyLayout = {
    gridStartX: gridStartX,
    gridStartY: gridTopY,
    cellSize: cellSize,
    gridWidth: g.widthPt,
    gridHeight: g.heightPt,
    gridRows: g.rows,
    gridCols: g.cols,
  };

  // Draw solution highlights (borders around found words)
  if (showSolution && puzzle.placements && puzzle.placements.length > 0) {
    const strokeColorHex = colors.answerPage.solutionFrameColor || '#000000';
    const strokeColor = safeColor(strokeColorHex);
    const strokeWidth = colors.answerPage.solutionStrokeThickness || 12;
      const onlyHighlightWordListWords = colors.answerPage.onlyHighlightWordListWords ?? true;

      // Format word list for comparison
      const formattedWordList = wordList.hideWordList ? [] : formatWords(puzzle.words, wordList).map(w => w.toUpperCase());

      // Process each word placement
      for (const placement of puzzle.placements) {
        // Filter by word list if enabled
        if (onlyHighlightWordListWords && !formattedWordList.some(w => w === placement.word.toUpperCase())) {
          continue;
        }

        // Get solution path data
        const solutionPath = getPDFSolutionPaths(
          {
            word: placement.word,
            startX: placement.start.col,
            startY: placement.start.row,
            endX: placement.end.col,
            endY: placement.end.row,
            cellSize: legacyLayout.cellSize,
          },
          {
            mode: 'line-highlight',
            color: strokeColorHex,
            thickness: strokeWidth,
            padding: 0,
            frameRadius: colors.answerPage.solutionFrameRadius || 4,
            solutionHighlightMode: 'box-frame',
            solutionLineCap: 'round',
            alpha: colors.answerPage.solutionHighlightAlpha ?? 30,
          }
        );

        if (!solutionPath) continue;

        const opacity = solutionPath.opacity ?? 1;
        const mode = solutionPath.mode || 'fill';
        const lineCap = solutionPath.lineCap || 'butt';
        const isOutline = mode === 'outline';
        const lineWidth = isOutline ? solutionPath.thickness || strokeWidth : 0;
        const fillOpacity = mode === 'fill' ? opacity : undefined;
        const borderOpacity = isOutline ? opacity : undefined;

        if (solutionPath.type === 'line' && solutionPath.startX !== undefined && solutionPath.startY !== undefined && solutionPath.endX !== undefined && solutionPath.endY !== undefined) {
          const sx = (typeof localGridStartX !== 'undefined') ? localGridStartX + solutionPath.startX : legacyLayout.gridStartX + solutionPath.startX;
          const ex = (typeof localGridStartX !== 'undefined') ? localGridStartX + solutionPath.endX : legacyLayout.gridStartX + solutionPath.endX;
          page.drawLine({
            start: {
              x: sx,
              y: legacyLayout.gridStartY - solutionPath.startY,
            },
            end: {
              x: ex,
              y: legacyLayout.gridStartY - solutionPath.endY,
            },
            color: strokeColor,
            thickness: solutionPath.thickness || strokeWidth,
            opacity,
            lineCap: mapSolutionLineCap(lineCap),
          });
        }
      }
  }

  const wl = layout.wordList;
  if (!showSolution && wl && wl.words.length > 0) {
    const numCols = wl.columns;
    const wordsPerCol = wl.wordsPerColumn;
    const columns = distributeWordsIntoColumns(wl.words, numCols);

    const columnWidths = measureWordListColumnWidthsPt(columns, (word) => {
      let width = wordListFont.widthOfTextAtSize(word, wl.fontSizePt);
      if (wl.addCheckboxes) {
        width += wl.checkboxSizePt + wl.checkboxGapPt;
      }
      return width;
    });

    const totalWordBlockWidth = computeWordListBlockWidthPt(columnWidths, wl.columnGapPt);
    const wordListX = computeCenteredWordListLeftPt(layout.page.widthPt, totalWordBlockWidth);

    for (let i = 0; i < wl.words.length; i++) {
      const col = Math.floor(i / wordsPerCol);
      const row = i % wordsPerCol;
      const word = wl.words[i];
      const wordX =
        wordListX +
        columnWidths.slice(0, col).reduce((sum, width) => sum + width, 0) +
        col * wl.columnGapPt;
      const yPos = pageHeight - wl.topPt - getWordListRowTopOffsetPt(row, wl.lineHeightPt);

      if (wl.addCheckboxes) {
        page.drawRectangle({
          x: wordX,
          y: yPos - wl.fontSizePt + 2,
          width: wl.checkboxSizePt,
          height: wl.checkboxSizePt,
          borderColor: safeColor(wl.checkboxColor, '#666666'),
          borderWidth: 0.5,
        });
      }

      const textX = wl.addCheckboxes ? wordX + wl.checkboxSizePt + wl.checkboxGapPt : wordX;
      page.drawText(word, {
        x: textX,
        y: yPos - wl.fontSizePt + 2,
        size: wl.fontSizePt,
        font: wordListFont,
        color: safeColor(wl.color, '#000000'),
      });
    }
  }
}

function getSolutionPageLayout(answersPerPage: number) {
  if (answersPerPage === 4) {
    return { columns: 2, rows: 2 };
  }
  if (answersPerPage === 2) {
    return { columns: 1, rows: 2 };
  }
  return { columns: 1, rows: 1 };
}

function drawWordSearchSolutionPage(
  page: PDFPage,
  puzzles: WordSearchPuzzle[],
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  gridFont: PDFFont,
  titleFont: PDFFont,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  titleToAnswerGap: number = 20,
  pageMargin: number = 40
) {
  const layout = getSolutionPageLayout(settings.bookCanvas.answersPerPage || 1);
  const gap = 14;
  // Use dynamic pageMargin instead of hardcoded margin
  const dynamicMargin = margin + (pageMargin - 40) * 0.5;
  const availableWidth = pageWidth - dynamicMargin * 2 - gap * (layout.columns - 1);
  const availableHeight = pageHeight - dynamicMargin * 2 - gap * (layout.rows - 1);
  const blockWidth = availableWidth / layout.columns;
  const blockHeight = availableHeight / layout.rows;

  for (let index = 0; index < puzzles.length; index++) {
    const puzzle = puzzles[index];
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const blockX = dynamicMargin + col * (blockWidth + gap);
    const blockY = pageHeight - dynamicMargin - (row + 1) * blockHeight - row * gap;

    const innerMargin = Math.min(14, blockWidth * 0.05, blockHeight * 0.05);
    const titleSize = settings.colors.answerPage.answerTitleFontSize || 20;
    const titleText = `${settings.colors.answerPage.answerTitlePrefix || 'Solution'}${settings.colors.answerPage.showAnswerNumber ? ` ${puzzle.puzzleNumber || index + 1}` : ''}`;
    const titleWidth = titleFont.widthOfTextAtSize(titleText, titleSize);
    const titleX = blockX + (blockWidth - titleWidth) / 2;
    const titleY = blockY + blockHeight - innerMargin - titleSize;

    page.drawText(titleText, {
      x: titleX,
      y: titleY,
      size: titleSize,
      font: titleFont,
      color: safeColor(settings.colors.answerPage.titleColor, '#000000'),
    });

    // Use dynamic titleToAnswerGap with nullish checking
    const currentAnswerGap = (titleToAnswerGap !== undefined && titleToAnswerGap !== null) ? titleToAnswerGap : 20;
    const gridTop = titleY - currentAnswerGap;
    const gridAvailableHeight = gridTop - (blockY + innerMargin);
    const gridAvailableWidth = blockWidth - innerMargin * 2;
    const cellSize = Math.min(
      gridAvailableWidth / puzzle.grid[0].length,
      gridAvailableHeight / puzzle.grid.length,
      20
    );
    const gridWidth = cellSize * puzzle.grid[0].length;
    const gridHeight = cellSize * puzzle.grid.length;
    const gridStartX = blockX + innerMargin + (gridAvailableWidth - gridWidth) / 2;
    
    // Vertically center the grid within the available space (between title and bottom margin)
    const gridVerticalSpaceUsed = gridHeight;
    const gridVerticalMargin = (gridAvailableHeight - gridVerticalSpaceUsed) / 2;
    const gridStartY = gridTop - gridVerticalMargin;

    const borderB = settings.core.borderStrokeThickness ?? 2;
    
    // Track outermost cell boundaries for the border
    let solutionGridOuterLeft = Number.MAX_VALUE;
    let solutionGridOuterRight = Number.MIN_VALUE;
    let solutionGridOuterTop = Number.MIN_VALUE;
    let solutionGridOuterBottom = Number.MAX_VALUE;

    // Get the appropriate font size for solution grid, ensuring it fits within cell
    let answerGridFontSize = getSolutionGridFontSize(settings.typography);
    // Cap font size to fit reasonably within the cell (use 90% of cell size as max)
    answerGridFontSize = Math.min(answerGridFontSize, cellSize * 0.9);

    // Solution Grid Cell Dimensions (EXACT BASELINE MATH)
    const solutionCellWidth = cellSize; // Each cell is cellSize wide
    const solutionCellHeight = cellSize; // Each cell is cellSize tall
    const solutionTotalColumns = puzzle.grid[0].length;
    const solutionTotalRows = puzzle.grid.length;

    // Render letters using HARDCODED BASELINE MATH for pdf-lib Text Centering
    for (let row = 0; row < solutionTotalRows; row++) {
      for (let col = 0; col < solutionTotalColumns; col++) {
        // Calculate the absolute Top-Left anchor of the current cell (pdf-lib Y goes up, so we subtract to move down)
        const cellLeftX = gridStartX + (col * solutionCellWidth);
        const cellTopY = gridStartY - (row * solutionCellHeight);

        // Get letter from puzzle grid
        const letter = puzzle.grid[row][col];

        // Text Dimensions with Cap-Height Fix (do NOT use heightAtSize() as it includes descenders)
        const textWidth = gridFont.widthOfTextAtSize(letter, answerGridFontSize);
        const visualTextHeight = answerGridFontSize * 0.7; // Cap-height approximation (70% of font size)

        // The Absolute Dead-Center Math (baseline drop to exact center of cell)
        const centerX = cellLeftX + (solutionCellWidth / 2) - (textWidth / 2);
        const centerY = cellTopY - (solutionCellHeight / 2) - (visualTextHeight / 2);

        // Track outermost boundaries
        solutionGridOuterLeft = Math.min(solutionGridOuterLeft, cellLeftX);
        solutionGridOuterRight = Math.max(solutionGridOuterRight, cellLeftX + solutionCellWidth);
        solutionGridOuterBottom = Math.min(solutionGridOuterBottom, cellTopY - solutionCellHeight);
        solutionGridOuterTop = Math.max(solutionGridOuterTop, cellTopY);

        // Execute the Draw with mathematically centered coordinates
        page.drawText(letter, {
          x: centerX,
          y: centerY,
          size: answerGridFontSize,
          font: gridFont,
          color: safeColor(settings.colors.answerPage.lettersInSolutionColor, '#000000'),
        });
      }
    }

    // Draw the border lines of the grid strictly based on outermost cell boundaries
    if (!settings.core.noBoxAroundPuzzle) {
      page.drawRectangle({
        x: solutionGridOuterLeft - borderB / 2,
        y: solutionGridOuterBottom - borderB / 2,
        width: solutionGridOuterRight - solutionGridOuterLeft + borderB,
        height: solutionGridOuterTop - solutionGridOuterBottom + borderB,
        borderColor: safeColor(settings.colors.answerPage.boxColor, '#000000'),
        borderWidth: borderB,
      });
    }

    if (puzzle.placements && puzzle.placements.length > 0) {
      // Debug: log the configured alpha for this solution page
      // eslint-disable-next-line no-console
      console.log('PDF: drawing solutions with alpha =', settings.colors.answerPage.solutionHighlightAlpha);
      const strokeColorHex = settings.colors.answerPage.solutionFrameColor || '#000000';
      const strokeColor = safeColor(strokeColorHex);
      const strokeWidth = settings.colors.answerPage.solutionStrokeThickness || 12;
      const onlyHighlightWordListWords = settings.colors.answerPage.onlyHighlightWordListWords ?? true;
      const formattedWordList = puzzle.words.map((w) => w.toUpperCase());

      for (const placement of puzzle.placements) {
        if (onlyHighlightWordListWords && !formattedWordList.includes(placement.word.toUpperCase())) {
          continue;
        }

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
            color: strokeColorHex,
            thickness: strokeWidth,
            padding: 0,
            frameRadius: settings.colors.answerPage.solutionFrameRadius || 4,
            solutionHighlightMode: 'box-frame',
            solutionLineCap: 'round',
            alpha: settings.colors.answerPage.solutionHighlightAlpha ?? 30,
          }
        );

        if (!solutionPath) continue;

        const opacity = solutionPath.opacity ?? 1;
        const mode = solutionPath.mode || 'fill';
        const lineCap = solutionPath.lineCap || 'butt';
        const isOutline = mode === 'outline';
        const lineWidth = isOutline ? solutionPath.thickness || strokeWidth : 0;
        const fillOpacity = mode === 'fill' ? opacity : undefined;
        const borderOpacity = isOutline ? opacity : undefined;

        if (solutionPath.type === 'line' && solutionPath.startX !== undefined && solutionPath.startY !== undefined && solutionPath.endX !== undefined && solutionPath.endY !== undefined) {
          page.drawLine({
            start: {
              x: gridStartX + solutionPath.startX,
              y: gridStartY - solutionPath.startY,
            },
            end: {
              x: gridStartX + solutionPath.endX,
              y: gridStartY - solutionPath.endY,
            },
            color: strokeColor,
            thickness: solutionPath.thickness || strokeWidth,
            opacity,
            lineCap: mapSolutionLineCap(lineCap),
          });
        }
      }
    }
  }
}

export async function generatePuzzlePDF(options: ExportOptions): Promise<Uint8Array> {
  const { bookSettings, titleWords, wordSearchSettings, puzzles, includeSolution, puzzleGridScale = 70, titleToAnswerGap = 20, pageMargin = 40, pageOverrides = new Map(), applyMode = new Map() } = options;

  // Build default settings with all defaults
  const baseSettings: WordSearchSettings = {
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
      addGridLines: wordSearchSettings?.core?.addGridLines ?? true,
      borderStrokeThickness: wordSearchSettings?.core?.borderStrokeThickness ?? 2,
      gridLinesStrokeThickness: wordSearchSettings?.core?.gridLinesStrokeThickness ?? 1,
    },
    typography: {
      selectTitleOption: wordSearchSettings?.typography?.selectTitleOption || 'none',
      puzzleTitleFontSize: wordSearchSettings?.typography?.puzzleTitleFontSize || 20,
      puzzleTitleFontFamily: wordSearchSettings?.typography?.puzzleTitleFontFamily || 'Inter',
      titleText: wordSearchSettings?.typography?.titleText || '',
      includeSubtitle: wordSearchSettings?.typography?.includeSubtitle || false,
      subtitleText: wordSearchSettings?.typography?.subtitleText || '',
      puzzleGridFontSize: wordSearchSettings?.typography?.puzzleGridFontSize || 18,
      puzzleGridFontFamily: wordSearchSettings?.typography?.puzzleGridFontFamily || 'Inter',
      puzzleGridCase: wordSearchSettings?.typography?.puzzleGridCase || 'upper',
      spaceBetweenTitleAndPuzzle: (wordSearchSettings?.typography?.spaceBetweenTitleAndPuzzle !== undefined && wordSearchSettings?.typography?.spaceBetweenTitleAndPuzzle !== null) ? wordSearchSettings.typography.spaceBetweenTitleAndPuzzle : 20,
      titleStartAt: (wordSearchSettings?.typography?.titleStartAt !== undefined && wordSearchSettings?.typography?.titleStartAt !== null) ? wordSearchSettings.typography.titleStartAt : 40,
      answerTitleFontSize: wordSearchSettings?.typography?.answerTitleFontSize || 20,
      setFontForAnswerPages: wordSearchSettings?.typography?.setFontForAnswerPages || false,
      answerGridFontFamily: wordSearchSettings?.typography?.answerGridFontFamily || 'Inter',
      spaceBetweenPuzzleAndWordList: (wordSearchSettings?.typography?.spaceBetweenPuzzleAndWordList !== undefined && wordSearchSettings?.typography?.spaceBetweenPuzzleAndWordList !== null) ? wordSearchSettings.typography.spaceBetweenPuzzleAndWordList : 30,
      setFontSizeForAnswerPages: wordSearchSettings?.typography?.setFontSizeForAnswerPages || false,
      answerGridFontSize: wordSearchSettings?.typography?.answerGridFontSize || 12,
      spaceBetweenTitleAndAnswer: (wordSearchSettings?.typography?.spaceBetweenTitleAndAnswer !== undefined && wordSearchSettings?.typography?.spaceBetweenTitleAndAnswer !== null) ? wordSearchSettings.typography.spaceBetweenTitleAndAnswer : 40,
    },
    wordList: {
      hideWordList: wordSearchSettings?.wordList?.hideWordList || false,
      wordsPerPuzzle: wordSearchSettings?.wordList?.wordsPerPuzzle || 10,
      selectWordListOption: wordSearchSettings?.wordList?.selectWordListOption || 'manual',
      aiTheme: wordSearchSettings?.wordList?.aiTheme || '',
      aiLanguage: wordSearchSettings?.wordList?.aiLanguage || 'English',
      aiAgeLevel: wordSearchSettings?.wordList?.aiAgeLevel || 'Adult',
      aiMaxWordLength: wordSearchSettings?.wordList?.aiMaxWordLength || 10,
      wordListFontFamily: wordSearchSettings?.wordList?.wordListFontFamily || 'Inter',
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
        wordListTitleColor: wordSearchSettings?.colors?.puzzlePage?.wordListTitleColor || '#374151',
        wordListColor: wordSearchSettings?.colors?.puzzlePage?.wordListColor || '#4b5563',
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
        solutionFrameStyle: wordSearchSettings?.colors?.answerPage?.solutionFrameStyle || 'rounded',
        solutionFrameRadius: wordSearchSettings?.colors?.answerPage?.solutionFrameRadius ?? 4,
        solutionHighlightAlpha: wordSearchSettings?.colors?.answerPage?.solutionHighlightAlpha ?? 30,
        onlyHighlightWordListWords: wordSearchSettings?.colors?.answerPage?.onlyHighlightWordListWords ?? true,
        answerTitlePrefix: wordSearchSettings?.colors?.answerPage?.answerTitlePrefix || 'Solution',
        answerTitleFontFamily: wordSearchSettings?.colors?.answerPage?.answerTitleFontFamily || 'Inter',
        answerTitleFontSize: wordSearchSettings?.colors?.answerPage?.answerTitleFontSize || 20,
        answerTitleAlignment: wordSearchSettings?.colors?.answerPage?.answerTitleAlignment || 'center',
        showAnswerNumber: wordSearchSettings?.colors?.answerPage?.showAnswerNumber || false,
      },
    },
  };

  // Get page dimensions
  let pageWidth: number, pageHeight: number;

  if (baseSettings.bookCanvas.useCustomTrim && baseSettings.bookCanvas.customWidth && baseSettings.bookCanvas.customHeight) {
    pageWidth = inchesToPoints(baseSettings.bookCanvas.customWidth);
    pageHeight = inchesToPoints(baseSettings.bookCanvas.customHeight);
  } else {
    pageWidth = inchesToPoints(8.5);
    pageHeight = inchesToPoints(11);
  }

  const margin = baseSettings.bookCanvas.includeBleed ? inchesToPoints(0.125) : inchesToPoints(0.5);

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  
  // Register fontkit for custom font embedding
  pdfDoc.registerFontkit(fontkit);

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

  // Draw puzzle pages
  let currentPageIndex = 0;
  for (const puzzle of puzzles) {
    // Get effective settings for this page (with page overrides merged in)
    const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

    // Get fonts for this page's settings, mapping UI font weights to PDF bold objects
    const puzzleGridFont = await getOrEmbedFont(
      effectiveSettings.typography.puzzleGridFontFamily || 'Inter',
      effectiveSettings.typography.puzzleGridFontWeight || false
    );
    const wordListFont = await getOrEmbedFont(
      effectiveSettings.wordList.wordListFontFamily || 'Inter',
      effectiveSettings.wordList.wordListFontWeight || false
    );
    const puzzleTitleBoldFont = await getOrEmbedFont(
      effectiveSettings.typography.puzzleTitleFontFamily || 'Inter',
      effectiveSettings.typography.puzzleTitleFontWeight || true // Default to bold for title
    );

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    await drawWordSearchPuzzle(
      page,
      puzzle,
      effectiveSettings,
      titleWords,
      puzzleGridFont,
      wordListFont,
      puzzleTitleBoldFont,
      pageWidth,
      pageHeight,
      margin,
      false,
      puzzleGridScale
    );

    currentPageIndex++;

    if (effectiveSettings.bookCanvas.includePageBetweenPuzzleAndSolutions) {
      pdfDoc.addPage([pageWidth, pageHeight]);
      currentPageIndex++;
    }
  }

  // Draw solution pages
  if (includeSolution) {
    if (baseSettings.bookCanvas.answersPerPage <= 1) {
      for (const puzzle of puzzles) {
        // Get effective settings for solution page
        const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

        const answerGridFont = await getOrEmbedFont(
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontFamily || 'Inter'
            : effectiveSettings.typography.puzzleGridFontFamily || 'Inter',
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontWeight || false
            : effectiveSettings.typography.puzzleGridFontWeight || false
        );
        const answerTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Inter',
          effectiveSettings.colors.answerPage.answerTitleFontWeight || true // Default to bold for answer title
        );

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        await drawWordSearchPuzzle(
          page,
          puzzle,
          effectiveSettings,
          titleWords,
          answerGridFont,
          answerGridFont,
          answerTitleBoldFont,
          pageWidth,
          pageHeight,
          margin,
          true,
          puzzleGridScale
        );

        currentPageIndex++;
      }
    } else {
      const chunkSize = baseSettings.bookCanvas.answersPerPage;
      for (let i = 0; i < puzzles.length; i += chunkSize) {
        // Get effective settings for solution page
        const effectiveSettings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, currentPageIndex);

        const answerGridFont = await getOrEmbedFont(
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontFamily || 'Inter'
            : effectiveSettings.typography.puzzleGridFontFamily || 'Inter',
          effectiveSettings.typography.setFontForAnswerPages
            ? effectiveSettings.typography.answerGridFontWeight || false
            : effectiveSettings.typography.puzzleGridFontWeight || false
        );
        const answerTitleBoldFont = await getOrEmbedFont(
          effectiveSettings.colors.answerPage.answerTitleFontFamily || 'Inter',
          effectiveSettings.colors.answerPage.answerTitleFontWeight || true
        );

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const pagePuzzles = puzzles.slice(i, i + chunkSize);
        drawWordSearchSolutionPage(page, pagePuzzles, effectiveSettings, titleWords, answerGridFont, answerTitleBoldFont, pageWidth, pageHeight, margin, titleToAnswerGap, pageMargin);

        currentPageIndex++;
      }
    }
  }

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
