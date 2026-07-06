import { createWordSearchDocumentFromGlobals } from '@/lib/document-model';
import { DEFAULT_HEADER_ASSEMBLY } from '@/lib/header-assembly/types';
import {
  buildPersistedSnapshot,
  getDefaultWordSearchSettings,
} from '@/lib/settings-persistence';
import type { GpProjectFile } from '@/lib/project-file';
import type { TitleWordsSettings, WordSearchSettings } from '@/lib/puzzles/types';
import { getTemplateById } from '@/lib/marketing/content';

const defaultBookSettings = {
  trimSize: '8.5x11' as const,
  includeBleed: false,
  includeSolution: true,
  puzzlesPerPage: 1,
};

const defaultPuzzleSettings = {
  gridSize: 15,
  directions: ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'] as const,
  puzzleDensity: 50,
};

const defaultColorSettings = {
  puzzlePage: {
    backgroundColor: '#ffffff',
    titleColor: '#1f2937',
    subtitleColor: '#6b7280',
    boxColor: '#1f2937',
    puzzleColor: '#1f2937',
    wordListTitleColor: '#374151',
    wordListColor: '#4b5563',
    backgroundImage: undefined,
    backgroundImageOpacity: 100,
    backgroundImageFit: 'cover' as const,
    backgroundImageFrameEnabled: true,
    backgroundImageFrameMargin: 0.56,
    headerAssembly: { ...DEFAULT_HEADER_ASSEMBLY },
  },
  answerPage: {
    backgroundColor: '#ffffff',
    titleColor: '#1f2937',
    boxColor: '#1f2937',
    lettersInSolutionColor: '#22c55e',
    lettersNotInSolutionColor: '#d1d5db',
    solutionStrokeThickness: 12,
    solutionStrokePadding: 2,
    solutionFrameColor: '#22c55e',
    solutionFrameStyle: 'rounded' as const,
    solutionFrameRadius: 6,
    solutionHighlightAlpha: 30,
    answerTitlePrefix: 'Solution',
    answerTitleFontFamily: 'Arial',
    answerTitleFontSize: 20,
    answerTitleAlignment: 'center' as const,
    showAnswerNumber: true,
    backgroundImage: undefined,
    backgroundImageOpacity: 100,
    backgroundImageFit: 'cover' as const,
    backgroundImageFrameEnabled: true,
    backgroundImageFrameMargin: 0.56,
  },
};

type TemplateRecipe = {
  projectName: string;
  titleWords: TitleWordsSettings;
  patch: Partial<WordSearchSettings>;
  puzzleGridScale?: number;
};

const TEMPLATE_RECIPES: Record<string, TemplateRecipe> = {
  'kids-word-search': {
    projectName: 'Kids Word Search',
    titleWords: {
      title: 'Fun Word Search',
      fontFamily: 'Fredoka One',
      fontSize: 28,
      words: ['animals', 'colors', 'school'],
    },
    patch: {
      core: {
        gridRows: 12,
        gridCols: 12,
        fontSize: 16,
        borderStrokeThickness: 2,
        borderCornerRadius: 8,
        borderPadding: 8,
        gridBorderPadding: 6,
        solutionGridBorderPadding: 6,
        solutionBorderStrokeThickness: 2,
        solutionBorderCornerRadius: 8,
      },
      typography: {
        puzzleTitleFontFamily: 'Fredoka One',
        puzzleTitleFontSize: 28,
        wordListFontFamily: 'Nunito',
        wordListFontSize: 13,
        gridFontFamily: 'Nunito',
        gridFontSize: 16,
      },
      colors: {
        puzzlePage: {
          ...defaultColorSettings.puzzlePage,
          titleColor: '#ea580c',
          puzzleColor: '#1d4ed8',
          wordListColor: '#334155',
        },
        answerPage: defaultColorSettings.answerPage,
      },
    },
    puzzleGridScale: 78,
  },
  'kdp-classic': {
    projectName: 'KDP Classic Layout',
    titleWords: {
      title: 'Word Search Puzzles',
      fontFamily: 'Montserrat',
      fontSize: 24,
      words: ['focus', 'clarity', 'publish'],
    },
    patch: {
      typography: {
        puzzleTitleFontFamily: 'Montserrat',
        puzzleTitleFontSize: 24,
        wordListFontFamily: 'Open Sans',
        wordListFontSize: 11,
        gridFontFamily: 'Open Sans',
        gridFontSize: 12,
      },
    },
    puzzleGridScale: 72,
  },
  'large-print': {
    projectName: 'Large Print Seniors',
    titleWords: {
      title: 'Large Print Word Search',
      fontFamily: 'Lato',
      fontSize: 30,
      words: ['wellness', 'memory', 'relax'],
    },
    patch: {
      core: {
        gridRows: 14,
        gridCols: 14,
        fontSize: 20,
        borderStrokeThickness: 2,
        borderCornerRadius: 4,
        borderPadding: 10,
        gridBorderPadding: 8,
        solutionGridBorderPadding: 8,
        solutionBorderStrokeThickness: 2,
        solutionBorderCornerRadius: 4,
      },
      typography: {
        puzzleTitleFontFamily: 'Lato',
        puzzleTitleFontSize: 30,
        wordListFontFamily: 'Lato',
        wordListFontSize: 16,
        gridFontFamily: 'Lato',
        gridFontSize: 20,
      },
      colors: {
        puzzlePage: {
          ...defaultColorSettings.puzzlePage,
          titleColor: '#0f172a',
          puzzleColor: '#0f172a',
          wordListColor: '#0f172a',
          backgroundColor: '#fffef8',
        },
        answerPage: defaultColorSettings.answerPage,
      },
    },
    puzzleGridScale: 68,
  },
  'spanish-starter': {
    projectName: 'Spanish Starter Book',
    titleWords: {
      title: 'Sopa de Letras',
      fontFamily: 'Poppins',
      fontSize: 26,
      words: ['familia', 'comida', 'viaje'],
    },
    patch: {
      typography: {
        puzzleTitleFontFamily: 'Poppins',
        puzzleTitleFontSize: 26,
        wordListFontFamily: 'Poppins',
        wordListFontSize: 12,
        gridFontFamily: 'Poppins',
        gridFontSize: 13,
      },
      colors: {
        puzzlePage: {
          ...defaultColorSettings.puzzlePage,
          titleColor: '#b91c1c',
          puzzleColor: '#1e3a8a',
        },
        answerPage: defaultColorSettings.answerPage,
      },
    },
    puzzleGridScale: 74,
  },
};

function mergeWordSearchSettings(patch: Partial<WordSearchSettings>): WordSearchSettings {
  const base = getDefaultWordSearchSettings();
  return {
    ...base,
    ...patch,
    bookCanvas: { ...base.bookCanvas, ...patch.bookCanvas },
    core: { ...base.core, ...patch.core },
    typography: { ...base.typography, ...patch.typography },
    wordList: { ...base.wordList, ...patch.wordList },
    colors: {
      puzzlePage: { ...base.colors.puzzlePage, ...patch.colors?.puzzlePage },
      answerPage: { ...base.colors.answerPage, ...patch.colors?.answerPage },
    },
  };
}

export function buildTemplateProject(templateId: string): GpProjectFile {
  const meta = getTemplateById(templateId);
  const recipe = TEMPLATE_RECIPES[templateId];
  if (!meta || !recipe) {
    throw new Error('Unknown template.');
  }

  const wordSearchSettings = mergeWordSearchSettings(recipe.patch);
  const documentPage = createWordSearchDocumentFromGlobals(wordSearchSettings, recipe.titleWords);

  const settings = buildPersistedSnapshot({
      currentPuzzleType: 'word-search',
      wordSearchSettings,
      bookSettings: defaultBookSettings,
      puzzleSettings: defaultPuzzleSettings,
      titleWords: recipe.titleWords,
      colorSettings: wordSearchSettings.colors,
      puzzleGridScale: recipe.puzzleGridScale ?? 70,
      titleToAnswerGap: 10,
      solutionToSolutionGap: 14,
      pageMargin: 40,
      previewZoom: 75,
      previewRangeMode: 'sample',
      activePreviewTab: 'puzzles',
      sudokuDifficulty: 'medium',
      mazeSize: 'medium',
      cryptogramText: '',
      pageOverrides: [],
      pagePuzzleGridScales: [],
      applyMode: [
        ['grid', true],
        ['wordList', true],
        ['typography', true],
        ['colors', true],
      ],
      documentPages: [documentPage],
      activeDocumentPageId: documentPage.id,
  });

  return {
    format: 'genpuzzle-project',
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    projectName: recipe.projectName,
    settings,
    batchPuzzles: [],
    currentPuzzle: null,
    currentBatchIndex: 0,
  };
}
