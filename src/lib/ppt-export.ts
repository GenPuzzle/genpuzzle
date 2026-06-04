import { getMergedSettingsForPage } from './page-settings';
import { calculateLayout, formatWords, getSolutionGridFontSize } from './puzzle-layout';
import { TitleWordsSettings, WordSearchPuzzle, WordSearchSettings } from './puzzles/types';

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
  pageOverrides?: Map<number, Partial<WordSearchSettings>>;
  applyMode?: Map<string, boolean>;
}

const inchesToPoints = (inches: number) => inches * 72;

function normalizeHexColor(color: string | undefined, fallback: string) {
  if (!color) return fallback;
  return color.replace('#', '');
}

function createTitleText(puzzle: WordSearchPuzzle, settings: WordSearchSettings, titleWords: TitleWordsSettings, showSolution: boolean) {
  const puzzleNum = puzzle.puzzleNumber || 1;

  if (showSolution) {
    // Solution title logic
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
          baseTitle = lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
          break;
        }
        default:
          baseTitle = titleWords.title || 'Word Search';
      }
      // Use the SAME numbering style as puzzle
      numberingStyle = settings.typography.puzzleNumberingStyle || 'none';
    } else {
      // Use custom solution title with its own numbering style
      baseTitle = settings.typography.customSolutionTitle || 'Solution';
      numberingStyle = settings.typography.solutionNumberingStyle || 'none';
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

  if (settings.typography.selectTitleOption === 'puzzle-number') {
    // For puzzle-number mode, get just the title without default # suffix
    baseTitle = settings.typography.titleText || titleWords.title || 'Word Search';
  } else if (settings.typography.selectTitleOption === 'one-custom-title') {
    baseTitle = settings.typography.titleText || titleWords.title || 'Word Search';
  } else if (settings.typography.selectTitleOption === 'custom') {
    const lines = (settings.typography.titleText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    baseTitle = lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
  } else {
    baseTitle = titleWords.title || 'Word Search';
  }

  // ALWAYS apply puzzle numbering style formatting based on user selection
  const numberingStyle = settings.typography.puzzleNumberingStyle || 'none';
  
  if (baseTitle && numberingStyle !== 'none') {
    if (numberingStyle === 'prefix') {
      baseTitle = `${puzzleNum}. ${baseTitle}`;
    } else if (numberingStyle === 'suffix') {
      baseTitle = `${baseTitle} #${puzzleNum}`;
    }
  }

  return baseTitle;
}

function createFunFactText(puzzle: WordSearchPuzzle, settings: WordSearchSettings) {
  if (!settings.typography.includeFunFacts) return '';
  
  const funFactsText = settings.typography.funFactsText || '';
  if (!funFactsText) return '';
  
  const lines = funFactsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  
  const puzzleNum = puzzle.puzzleNumber || 1;
  return lines.length > 0 ? (lines[puzzleNum - 1] ?? '') : '';
}
}

function buildGridText(puzzle: WordSearchPuzzle) {
  return puzzle.grid.map((row) => row.join(' ')).join('\n');
}

function buildWordListColumns(words: string[], wordListSettings: WordSearchSettings['wordList']): string[] {
  const columns = wordListSettings.wordListColumns || 2;
  const wordsPerColumn = Math.ceil(words.length / columns);
  return Array.from({ length: columns }, (_, columnIndex) =>
    words.slice(columnIndex * wordsPerColumn, (columnIndex + 1) * wordsPerColumn).join('\n')
  );
}

export async function generatePuzzlePPT(options: ExportOptions): Promise<void> {
  const {
    bookSettings,
    titleWords,
    wordSearchSettings,
    puzzles,
    includeSolution,
    pageOverrides = new Map(),
    applyMode = new Map(),
  } = options;

  const pageWidthInches = bookSettings.customWidth || 8.5;
  const pageHeightInches = bookSettings.customHeight || 11;

  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'CUSTOM', width: pageWidthInches, height: pageHeightInches });
  pptx.layout = 'CUSTOM';
  pptx.author = 'Puzzle Book Maker';

  const baseSettings = { ...wordSearchSettings };

  for (let pageIndex = 0; pageIndex < puzzles.length; pageIndex += 1) {
    const puzzle = puzzles[pageIndex];
    const settings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, pageIndex);
    const titleText = createTitleText(puzzle, settings, titleWords, false);
    const slide = pptx.addSlide();
    slide.background = { color: normalizeHexColor(settings.colors.puzzlePage.backgroundColor, 'FFFFFF') };

    const titleY = 0.3 + ((settings.typography.titleStartAt !== undefined && settings.typography.titleStartAt !== null) ? settings.typography.titleStartAt : 50) / 72;
    slide.addText(titleText, {
      x: 0.5,
      y: titleY,
      w: pageWidthInches - 1,
      h: 0.8,
      fontSize: settings.typography.puzzleTitleFontSize || 24,
      fontFace: settings.typography.puzzleTitleFontFamily || 'Inter',
      color: normalizeHexColor(settings.colors.puzzlePage.titleColor, '1F2937'),
      align: settings.colors.puzzlePage.titleColor ? 'center' : 'center',
      bold: true,
    });

    const funFactText = createFunFactText(puzzle, settings);
    const subtitleToTitleGapInches = (settings.typography.subtitleToTitleGap ?? 10) / 72;
    const subtitleToPuzzleGapInches = (settings.typography.subtitleToPuzzleGap ?? 10) / 72;
    
    if (funFactText) {
      slide.addText(funFactText, {
        x: 0.5,
        y: titleY + 0.8 + subtitleToTitleGapInches,
        w: pageWidthInches - 1,
        h: 0.8, // Increased height to accommodate wrapped text
        fontSize: settings.typography.subtitleFontSize || 14,
        fontFace: settings.typography.puzzleTitleFontFamily || 'Inter',
        color: normalizeHexColor(settings.colors.puzzlePage.subtitleColor, '6B7280'),
        align: 'center',
        wrap: true, // Enable text wrapping in PowerPoint
      });
    }

    const titleBlockHeight = 0.8 + (funFactText ? (0.8 + subtitleToTitleGapInches + subtitleToPuzzleGapInches) : 0);
    const gridStartY = titleY + titleBlockHeight + ((settings.typography.spaceBetweenTitleAndPuzzle !== undefined && settings.typography.spaceBetweenTitleAndPuzzle !== null) ? settings.typography.spaceBetweenTitleAndPuzzle : 20) / 72;
    const gridText = buildGridText(puzzle);
    const gridFontSize = settings.typography.puzzleGridFontSize || 18;

    if (!settings.core.noBoxAroundPuzzle) {
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.45,
        y: gridStartY - 0.12,
        w: pageWidthInches - 0.9,
        h: Math.min(pageHeightInches - gridStartY - 1.5, (puzzle.grid.length * gridFontSize) / 72 + 1),
        line: { color: normalizeHexColor(settings.colors.puzzlePage.boxColor, '1F2937'), width: settings.core.borderStrokeThickness || 2 },
        fill: { color: 'FFFFFF', transparency: 100 },
      });
    }

    slide.addText(gridText, {
      x: 0.5,
      y: gridStartY,
      w: pageWidthInches - 1,
      h: Math.min(pageHeightInches - gridStartY - 1.2, (puzzle.grid.length * gridFontSize) / 72 + 1),
      fontSize: gridFontSize,
      fontFace: settings.typography.puzzleGridFontFamily || 'Courier New',
      color: normalizeHexColor(settings.colors.puzzlePage.puzzleColor, '1F2937'),
      align: 'center',
      lineSpacing: gridFontSize + 4,
    });

    if (!settings.wordList.hideWordList && puzzle.words.length > 0) {
      const formattedWords = formatWords(puzzle.words, settings.wordList);
      const wordLists = buildWordListColumns(formattedWords, settings.wordList);
      const wordListTop = gridStartY + Math.min(pageHeightInches - gridStartY - 1.5, (puzzle.grid.length * gridFontSize) / 72 + 1) + (settings.typography.spaceBetweenPuzzleAndWordList || 20) / 72;
      const columnWidth = (pageWidthInches - 1) / Math.max(wordLists.length, 1);
      const wordFontSize = settings.wordList.wordListFontSize || 12;

      wordLists.forEach((columnText, columnIndex) => {
        if (!columnText) return;
        slide.addText(columnText, {
          x: 0.5 + columnIndex * columnWidth,
          y: wordListTop,
          w: columnWidth - 0.2,
          h: pageHeightInches - wordListTop - 0.5,
          fontSize: wordFontSize,
          fontFace: settings.wordList.wordListFontFamily || 'Inter',
          color: normalizeHexColor(settings.colors.puzzlePage.wordListColor, '4B5563'),
          align: 'left',
          lineSpacing:
            wordFontSize +
            (settings.wordList.wordSpacingVertical ??
              settings.wordList.wordListGap ??
              8),
        });
      });
    }
  }

  if (bookSettings.includePageBetweenPuzzleAndSolutions && includeSolution) {
    pptx.addSlide();
  }

  if (includeSolution) {
    for (let index = 0; index < puzzles.length; index += 1) {
      const puzzle = puzzles[index];
      const solutionIndex = index;
      const settings = getMergedSettingsForPage(baseSettings, pageOverrides, applyMode, solutionIndex);
      const titleText = createTitleText(puzzle, settings, titleWords, true);
      const slide = pptx.addSlide();
      slide.background = { color: normalizeHexColor(settings.colors.answerPage.backgroundColor, 'FFFFFF') };

      const titleY = 0.3 + ((settings.typography.titleStartAt !== undefined && settings.typography.titleStartAt !== null) ? settings.typography.titleStartAt : 50) / 72;
      slide.addText(titleText, {
        x: 0.5,
        y: titleY,
        w: pageWidthInches - 1,
        h: 0.8,
        fontSize: settings.colors.answerPage.answerTitleFontSize || 20,
        fontFace: settings.colors.answerPage.answerTitleFontFamily || 'Inter',
        color: normalizeHexColor(settings.colors.answerPage.titleColor, '1F2937'),
        align: settings.colors.answerPage.answerTitleAlignment || 'center',
        bold: true,
      });

      const gridStartY = titleY + 0.9;
      const gridFontSize = getSolutionGridFontSize(settings.typography);
      const gridText = buildGridText(puzzle);

      if (!settings.core.noBoxAroundPuzzle) {
        slide.addShape(pptx.ShapeType.rect, {
          x: 0.45,
          y: gridStartY - 0.12,
          w: pageWidthInches - 0.9,
          h: Math.min(pageHeightInches - gridStartY - 1.5, (puzzle.grid.length * gridFontSize) / 72 + 1),
          line: { color: normalizeHexColor(settings.colors.answerPage.boxColor, '1F2937'), width: settings.core.borderStrokeThickness || 2 },
          fill: { color: 'FFFFFF', transparency: 100 },
        });
      }

      slide.addText(gridText, {
        x: 0.5,
        y: gridStartY,
        w: pageWidthInches - 1,
        h: Math.min(pageHeightInches - gridStartY - 1.2, (puzzle.grid.length * gridFontSize) / 72 + 1),
        fontSize: gridFontSize,
        fontFace: settings.typography.puzzleGridFontFamily || 'Courier New',
        color: normalizeHexColor(settings.colors.answerPage.lettersInSolutionColor, '000000'),
        align: 'center',
        lineSpacing: gridFontSize + 4,
      });
    }
  }

  const fileName = `${titleWords.title || 'word-search'}-${Date.now()}.pptx`;
  await pptx.writeFile({ fileName });
}
