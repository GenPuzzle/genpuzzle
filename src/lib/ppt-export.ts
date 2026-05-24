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
  if (showSolution) {
    const prefix = settings.colors.answerPage.answerTitlePrefix || 'Solution';
    const number = settings.colors.answerPage.showAnswerNumber ? ` ${puzzle.puzzleNumber || ''}` : '';
    return `${prefix}${number}`.trim();
  }

  if (settings.typography.selectTitleOption === 'custom') {
    const lines = (settings.typography.titleText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const puzzleNum = puzzle.puzzleNumber || 1;
    return lines.length > 0 ? (lines[puzzleNum - 1] ?? lines[lines.length - 1]) : '';
  }

  if (settings.typography.selectTitleOption === 'puzzle-number') {
    const puzzleNum = puzzle.puzzleNumber || 1;
    return `${settings.typography.titleText || titleWords.title || 'Word Search'} #${puzzleNum}`;
  }

  return titleWords.title || 'Word Search';
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

  const pageWidthInches = bookSettings.useCustomTrim && bookSettings.customWidth ? bookSettings.customWidth : 8.5;
  const pageHeightInches = bookSettings.useCustomTrim && bookSettings.customHeight ? bookSettings.customHeight : 11;

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

    if (settings.typography.includeSubtitle && settings.typography.subtitleText) {
      slide.addText(settings.typography.subtitleText, {
        x: 0.5,
        y: titleY + 0.6,
        w: pageWidthInches - 1,
        h: 0.5,
        fontSize: (settings.typography.puzzleTitleFontSize || 24) - 6,
        fontFace: settings.typography.puzzleTitleFontFamily || 'Inter',
        color: normalizeHexColor(settings.colors.puzzlePage.subtitleColor, '6B7280'),
        align: 'center',
      });
    }

    const titleBlockHeight = 0.8 + (settings.typography.includeSubtitle && settings.typography.subtitleText ? 0.5 : 0);
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
