import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'pdf-lib';
import {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
} from './puzzles/types';
import { calculateLayout, calculateHighlights, formatWords } from './puzzle-layout';

interface ExportOptions {
  bookSettings: {
    trimSize: string;
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

// Draw rounded rectangle border for word highlights
function drawRoundedRectBorder(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  borderColor: ReturnType<typeof rgb>,
  strokeWidth: number
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
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x1, y: y + height },
    end: { x: x + width, y: y1 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x + width, y: y1 },
    end: { x: x + width, y: y0 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x + width, y: y0 },
    end: { x: x1, y: y },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x1, y: y },
    end: { x: x0, y: y },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x0, y: y },
    end: { x: x, y: y0 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x, y: y0 },
    end: { x: x, y: y1 },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
  });

  page.drawLine({
    start: { x: x, y: y1 },
    end: { x: x0, y: y + height },
    color: borderColor,
    thickness: strokeWidth,
    lineCap: 'Round',
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
  });
  page.drawEllipse({
    x: x1,
    y: y1,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
  });
  page.drawEllipse({
    x: x1,
    y: y0,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
  });
  page.drawEllipse({
    x: x0,
    y: y0,
    xScale: cornerRadius,
    yScale: cornerRadius,
    borderColor,
    borderWidth: strokeWidth,
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
  cellSize: number
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
    });
  }
}

async function drawWordSearchPuzzle(
  page: PDFPage,
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  font: PDFFont,
  boldFont: PDFFont,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  showSolution: boolean = false
) {
  const { core, wordList, colors } = settings;

  // Calculate layout using shared function
  const layout = calculateLayout(
    puzzle,
    settings,
    titleWords,
    pageWidth / 72, // Convert points to inches
    pageHeight / 72,
    showSolution
  );

  // Draw background
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: safeColor(layout.backgroundColor, '#ffffff'),
  });

  // Draw title
  if (layout.titleText) {
    const textWidth = font.widthOfTextAtSize(layout.titleText, layout.titleSize);
    let titleX = margin;

    if (layout.titleAlignment === 'center') {
      titleX = (pageWidth - textWidth) / 2;
    } else if (layout.titleAlignment === 'right') {
      titleX = pageWidth - margin - textWidth;
    }

    page.drawText(layout.titleText, {
      x: titleX,
      y: layout.titleY,
      size: layout.titleSize,
      font: boldFont,
      color: safeColor(layout.titleColor, '#000000'),
    });
  }

  // Draw subtitle
  if (layout.subtitleText) {
    const subWidth = font.widthOfTextAtSize(layout.subtitleText, layout.subtitleSize);
    page.drawText(layout.subtitleText, {
      x: (pageWidth - subWidth) / 2,
      y: layout.subtitleY,
      size: layout.subtitleSize,
      font,
      color: safeColor(layout.subtitleColor, '#666666'),
    });
  }

  // Draw outer box around puzzle with rounded corners
  if (!core.noBoxAroundPuzzle) {
    const boxX = layout.gridStartX - 4;
    const boxY = layout.gridStartY - layout.gridHeight - 4;
    const boxWidth = layout.gridWidth + 8;
    const boxHeight = layout.gridHeight + 8;
    
    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxWidth,
      height: boxHeight,
      borderColor: safeColor(layout.boxColor, '#000000'),
      borderWidth: 1.5,
    });
  }

  // Draw grid cells and letters
  for (let r = 0; r < layout.gridRows; r++) {
    for (let c = 0; c < layout.gridCols; c++) {
      const cellX = layout.gridStartX + c * layout.cellSize;
      const cellY = layout.gridStartY - r * layout.cellSize - layout.cellSize;
      const letter = puzzle.grid[r][c];

      // Draw grid lines if enabled
      if (core.addGridLines) {
        page.drawRectangle({
          x: cellX,
          y: cellY,
          width: layout.cellSize,
          height: layout.cellSize,
          borderColor: safeColor(layout.boxColor, '#666666'),
          borderWidth: 0.5,
        });
      }

      // Draw letter centered in cell
      const letterSize = settings.typography.puzzleGridFontSize || 12;
      const letterWidth = font.widthOfTextAtSize(letter, letterSize);
      page.drawText(letter, {
        x: cellX + (layout.cellSize - letterWidth) / 2,
        y: cellY + (layout.cellSize - letterSize) / 2 - 2,
        size: letterSize,
        font,
        color: safeColor(showSolution ? colors.answerPage.lettersInSolutionColor : layout.puzzleColor, '#000000'),
      });
    }
  }

  // Draw solution highlights (borders around found words)
  if (showSolution && puzzle.placements && puzzle.placements.length > 0) {
    const strokeColor = safeColor(colors.answerPage.solutionFrameColor, '#000000');
    const strokeWidth = colors.answerPage.solutionStrokeThickness || 1;
    const onlyHighlightWordListWords = colors.answerPage.onlyHighlightWordListWords ?? true;

    // Format word list for comparison
    const formattedWordList = wordList.hideWordList ? [] : formatWords(puzzle.words, wordList).map(w => w.toUpperCase());

    const highlights = calculateHighlights(puzzle, layout, layout.cellSize * 0.12);

    for (const highlight of highlights) {
      // Filter by word list if enabled
      if (onlyHighlightWordListWords && highlight.word && !formattedWordList.some(w => w === highlight.word.toUpperCase())) {
        continue;
      }

      // Check if this is a diagonal word
      if (highlight.rotation !== undefined && highlight.rotation !== 0 && highlight.startX !== undefined && highlight.startY !== undefined && highlight.endX !== undefined && highlight.endY !== undefined) {
        drawDiagonalHighlight(page, highlight.startX, highlight.startY, highlight.endX, highlight.endY, strokeColor, strokeWidth, layout.cellSize);
      } else {
        const radius = Math.min(highlight.height / 2, 4);
        drawRoundedRectBorder(page, highlight.x, highlight.y, highlight.width, highlight.height, radius, strokeColor, strokeWidth);
      }
    }
  }

  // Draw word list (puzzle page only, not solution)
  if (!showSolution && !wordList.hideWordList && puzzle.words.length > 0) {
    const words = formatWords(puzzle.words, wordList);
    const numCols = wordList.wordListColumns || 1;
    const colWidth = layout.contentWidth / numCols;
    const wordsPerCol = Math.ceil(words.length / numCols);

    const startY = layout.wordListY - (wordsPerCol * layout.wordListLineHeight - layout.wordListFontSize) / 2;

    for (let i = 0; i < words.length; i++) {
      const col = Math.floor(i / wordsPerCol);
      const row = i % wordsPerCol;
      const word = words[i];
      const wordWidth = font.widthOfTextAtSize(word, layout.wordListFontSize);
      const colContentWidth = colWidth - 20;

      const wordX = margin + col * colWidth + (colContentWidth - wordWidth) / 2;
      const yPos = startY - row * layout.wordListLineHeight;

      // Draw checkbox if enabled
      if (wordList.addCheckboxes) {
        page.drawRectangle({
          x: wordX - 15,
          y: yPos - layout.wordListFontSize + 2,
          width: 10,
          height: 10,
          borderColor: safeColor(layout.boxColor, '#666666'),
          borderWidth: 0.5,
        });
      }

      page.drawText(word, {
        x: wordX,
        y: yPos - layout.wordListFontSize + 2,
        size: layout.wordListFontSize,
        font,
        color: safeColor(layout.wordListColor, '#000000'),
      });
    }
  }
}

export async function generatePuzzlePDF(options: ExportOptions): Promise<Uint8Array> {
  const { bookSettings, titleWords, wordSearchSettings, puzzles, includeSolution } = options;

  // Build settings with all defaults
  const settings: WordSearchSettings = {
    bookCanvas: {
      trimSize: bookSettings.trimSize || 'letter',
      includeBleed: bookSettings.includeBleed || false,
      useCustomTrim: bookSettings.useCustomTrim || false,
      customWidth: bookSettings.customWidth || 8.5,
      customHeight: bookSettings.customHeight || 11,
      answersPerPage: bookSettings.answersPerPage || 1,
      includePageBetweenPuzzleAndSolutions: bookSettings.includePageBetweenPuzzleAndSolutions || false,
    },
    core: {
      noBoxAroundPuzzle: wordSearchSettings?.core?.noBoxAroundPuzzle || false,
      addGridLines: wordSearchSettings?.core?.addGridLines || false,
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
      allowNumbersInGrid: wordSearchSettings?.core?.allowNumbersInGrid ?? false,
      twoPagePuzzles: wordSearchSettings?.core?.twoPagePuzzles ?? false,
      customLetters: wordSearchSettings?.core?.customLetters || '',
    },
    typography: {
      selectTitleOption: wordSearchSettings?.typography?.selectTitleOption || 'none',
      puzzleTitleFontSize: wordSearchSettings?.typography?.puzzleTitleFontSize || 20,
      puzzleTitleFontFamily: wordSearchSettings?.typography?.puzzleTitleFontFamily || 'Inter',
      titleText: wordSearchSettings?.typography?.titleText || '',
      includeSubtitle: wordSearchSettings?.typography?.includeSubtitle || false,
      subtitleText: wordSearchSettings?.typography?.subtitleText || '',
      puzzleGridFontSize: wordSearchSettings?.typography?.puzzleGridFontSize || 12,
      puzzleGridFontFamily: wordSearchSettings?.typography?.puzzleGridFontFamily || 'Inter',
      puzzleGridCase: wordSearchSettings?.typography?.puzzleGridCase || 'upper',
      spaceBetweenTitleAndPuzzle: wordSearchSettings?.typography?.spaceBetweenTitleAndPuzzle || 20,
      titleStartAt: wordSearchSettings?.typography?.titleStartAt || 40,
      answerTitleFontSize: wordSearchSettings?.typography?.answerTitleFontSize || 20,
      answerGridFontSize: wordSearchSettings?.typography?.answerGridFontSize || 12,
      setFontForAnswerPages: wordSearchSettings?.typography?.setFontForAnswerPages || false,
      answerGridFontFamily: wordSearchSettings?.typography?.answerGridFontFamily || 'Inter',
      spaceBetweenPuzzleAndWordList: wordSearchSettings?.typography?.spaceBetweenPuzzleAndWordList || 30,
      spaceBetweenTitleAndAnswer: wordSearchSettings?.typography?.spaceBetweenTitleAndAnswer || 40,
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
        solutionStrokeThickness: wordSearchSettings?.colors?.answerPage?.solutionStrokeThickness ?? 2,
        solutionStrokePadding: wordSearchSettings?.colors?.answerPage?.solutionStrokePadding ?? 2,
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

  if (settings.bookCanvas.useCustomTrim && settings.bookCanvas.customWidth && settings.bookCanvas.customHeight) {
    pageWidth = inchesToPoints(settings.bookCanvas.customWidth);
    pageHeight = inchesToPoints(settings.bookCanvas.customHeight);
  } else {
    pageWidth = inchesToPoints(8.5);
    pageHeight = inchesToPoints(11);
  }

  const margin = settings.bookCanvas.includeBleed ? inchesToPoints(0.125) : inchesToPoints(0.5);

  // Create PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Draw puzzle pages
  for (const puzzle of puzzles) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    await drawWordSearchPuzzle(
      page,
      puzzle,
      settings,
      titleWords,
      font,
      boldFont,
      pageWidth,
      pageHeight,
      margin,
      false
    );

    if (settings.bookCanvas.includePageBetweenPuzzleAndSolutions) {
      pdfDoc.addPage([pageWidth, pageHeight]);
    }
  }

  // Draw solution pages
  if (includeSolution) {
    for (const puzzle of puzzles) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      await drawWordSearchPuzzle(
        page,
        puzzle,
        settings,
        titleWords,
        font,
        boldFont,
        pageWidth,
        pageHeight,
        margin,
        true
      );
    }
  }

  return await pdfDoc.save();
}

export function downloadPDF(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
