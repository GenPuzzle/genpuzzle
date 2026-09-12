import { generatePuzzlePDF, downloadPDF } from './pdf-export';
import { generatePuzzlePPT } from './ppt-export';
import type { Puzzle } from './puzzles';
import type {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
  BookSettings,
  CrosswordPuzzle,
  GenericBatchPuzzle,
  MurdokuPuzzle,
} from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isTextModuleType } from './document-model';
import type { CrosswordSettings } from './crossword-settings';
import type { GenericPuzzleSettings } from './generic-puzzle-settings';
import { isGenericPuzzleModuleType } from './generic-puzzle-settings';
import { buildCrosswordPuzzlesForDocumentPage } from './generate-document-puzzles';

export interface BookExportInput {
  currentPuzzleType: string;
  bookSettings: BookSettings;
  titleWords: TitleWordsSettings;
  wordSearchSettings: WordSearchSettings;
  batchPuzzles: WordSearchPuzzle[];
  /** Generated crossword puzzles across crossword document tabs. */
  crosswordBatchPuzzles?: CrosswordPuzzle[];
  /** Live crossword settings for the active crossword tab. */
  crosswordSettings?: CrosswordSettings | null;
  /** Per-crossword-page overrides keyed by document-local puzzle index. */
  pageCrosswordOverrides?: Map<number, Partial<CrosswordSettings>>;
  /** Generated sudoku/maze puzzles across generic document tabs. */
  genericBatchPuzzles?: GenericBatchPuzzle[];
  /** Live sudoku/maze settings for the active generic tab. */
  genericPuzzleSettings?: GenericPuzzleSettings | null;
  /** Per-sudoku/maze-page overrides keyed by document-local puzzle index. */
  pageGenericOverrides?: Map<number, Partial<GenericPuzzleSettings>>;
  /** Generated Murdoku puzzles across Murdoku document tabs. */
  murdokuBatchPuzzles?: MurdokuPuzzle[];
  /** Live Murdoku settings for the active Murdoku tab. */
  murdokuSettings?: import('./murdoku-settings').MurdokuSettings | null;
  currentPuzzle: Puzzle | null;
  puzzleGridScale: number;
  titleToAnswerGap: number;
  pageMargin: number;
  solutionToSolutionGap: number;
  pageOverrides: Map<number, Partial<WordSearchSettings>>;
  applyMode: Map<string, boolean>;
  documentPages: DocumentPage[];
  activeDocumentPageId: string;
}

function buildPagesForExport(input: BookExportInput): DocumentPage[] {
  return input.documentPages.map((page) => {
    if (page.id !== input.activeDocumentPageId) return page;
    if (page.moduleType === 'word-search') {
      return {
        ...page,
        settings: {
          ...(page.settings as PuzzleModuleSettings),
          titleWords: input.titleWords,
          wordSearchSettings: input.wordSearchSettings,
        },
      };
    }
    if (page.moduleType === 'crossword' && input.crosswordSettings) {
      return {
        ...page,
        settings: {
          ...(page.settings as PuzzleModuleSettings),
          titleWords: input.titleWords,
          crosswordSettings: input.crosswordSettings,
        },
      };
    }
    if (
      (isGenericPuzzleModuleType(page.moduleType)) &&
      input.genericPuzzleSettings
    ) {
      return {
        ...page,
        settings: {
          ...(page.settings as PuzzleModuleSettings),
          titleWords: input.titleWords,
          genericPuzzleSettings: input.genericPuzzleSettings,
        },
      };
    }
    if (page.moduleType === 'murdoku' && input.murdokuSettings) {
      return {
        ...page,
        settings: {
          ...(page.settings as PuzzleModuleSettings),
          titleWords: input.titleWords,
          murdokuSettings: input.murdokuSettings,
        },
      };
    }
    return page;
  });
}

function buildPuzzlesForExport(input: BookExportInput): WordSearchPuzzle[] {
  if (input.currentPuzzleType === 'word-search' && input.batchPuzzles.length > 0) {
    return input.batchPuzzles;
  }
  if (input.batchPuzzles.length > 0) {
    return input.batchPuzzles;
  }
  if (input.currentPuzzle && input.currentPuzzle.type === 'word-search') {
    return [input.currentPuzzle as WordSearchPuzzle];
  }
  return [];
}

function buildCrosswordPuzzlesForExport(input: BookExportInput): CrosswordPuzzle[] {
  const pages = buildPagesForExport(input);
  const crosswordPages = pages.filter((p) => p.moduleType === 'crossword');
  if (crosswordPages.length === 0) return [];

  const existingMap = new Map<string, CrosswordPuzzle[]>();
  for (const p of input.crosswordBatchPuzzles ?? []) {
    if (p.pageId) {
      if (!existingMap.has(p.pageId)) existingMap.set(p.pageId, []);
      existingMap.get(p.pageId)!.push(p);
    }
  }

  const allPuzzles: CrosswordPuzzle[] = [];
  for (const page of crosswordPages) {
    const existing = existingMap.get(page.id);
    if (existing && existing.length > 0) {
      allPuzzles.push(...existing);
    } else {
      allPuzzles.push(...buildCrosswordPuzzlesForDocumentPage(page));
    }
  }

  if (allPuzzles.length === 0 && input.currentPuzzle && input.currentPuzzle.type === 'crossword') {
    return [input.currentPuzzle as CrosswordPuzzle];
  }
  return allPuzzles;
}

function buildGenericPuzzlesForExport(input: BookExportInput): GenericBatchPuzzle[] {
  if (input.genericBatchPuzzles && input.genericBatchPuzzles.length > 0) {
    return input.genericBatchPuzzles;
  }
  if (
    input.currentPuzzle &&
    isGenericPuzzleModuleType(input.currentPuzzle.type)
  ) {
    return [input.currentPuzzle as GenericBatchPuzzle];
  }
  return [];
}

function buildMurdokuPuzzlesForExport(input: BookExportInput): MurdokuPuzzle[] {
  if (input.murdokuBatchPuzzles && input.murdokuBatchPuzzles.length > 0) {
    return input.murdokuBatchPuzzles;
  }
  if (input.currentPuzzle && input.currentPuzzle.type === 'murdoku') {
    return [input.currentPuzzle as MurdokuPuzzle];
  }
  return [];
}

export function canExportBook(input: BookExportInput): boolean {
  if (input.documentPages.length === 0) return false;
  const pages = buildPagesForExport(input);
  const puzzles = buildPuzzlesForExport(input);
  const crosswords = buildCrosswordPuzzlesForExport(input);
  const generics = buildGenericPuzzlesForExport(input);
  const murdoku = buildMurdokuPuzzlesForExport(input);
  const hasTextPages = pages.some((page) => isTextModuleType(page.moduleType));
  return (
    puzzles.length > 0 ||
    crosswords.length > 0 ||
    generics.length > 0 ||
    murdoku.length > 0 ||
    hasTextPages
  );
}

/** Share requires document tabs plus user-entered content (words, text, or generated puzzles). */
export function canShareProject(input: BookExportInput): boolean {
  if (input.documentPages.length === 0) return false;
  if (buildPuzzlesForExport(input).length > 0) return true;
  if (buildCrosswordPuzzlesForExport(input).length > 0) return true;
  if (buildGenericPuzzlesForExport(input).length > 0) return true;
  if (buildMurdokuPuzzlesForExport(input).length > 0) return true;

  const pages = buildPagesForExport(input);
  for (const page of pages) {
    if (isTextModuleType(page.moduleType)) {
      const settings = page.settings as TextModuleSettings;
      if (settings.content?.trim()) return true;
      continue;
    }
    if (page.moduleType === 'word-search') {
      const settings = page.settings as PuzzleModuleSettings;
      const words = settings.titleWords?.words ?? [];
      if (words.some((word) => word.trim().length > 0)) return true;
    }
  }
  return false;
}

export async function exportBookAsPdf(
  input: BookExportInput,
  filenameBase?: string,
  onProgress?: (status: string) => void
): Promise<void> {
  const pagesForExport = buildPagesForExport(input);
  const puzzlesToExport = buildPuzzlesForExport(input);
  const crosswordsToExport = buildCrosswordPuzzlesForExport(input);
  const genericsToExport = buildGenericPuzzlesForExport(input);
  const murdokuToExport = buildMurdokuPuzzlesForExport(input);

  if (!canExportBook(input)) {
    throw new Error('Generate puzzles or add a document page before exporting.');
  }

  const pdfData = await generatePuzzlePDF({
    bookSettings: {
      ...input.bookSettings,
      ...input.wordSearchSettings.bookCanvas,
    },
    titleWords: input.titleWords,
    wordSearchSettings: input.wordSearchSettings,
    puzzles: puzzlesToExport,
    crosswordPuzzles: crosswordsToExport,
    crosswordPageOverrides: input.pageCrosswordOverrides,
    genericPuzzles: genericsToExport,
    genericPageOverrides: input.pageGenericOverrides,
    murdokuPuzzles: murdokuToExport,
    includeSolution: true,
    onlySolutions: false,
    puzzleGridScale: input.puzzleGridScale,
    titleToAnswerGap: input.titleToAnswerGap,
    pageMargin: input.pageMargin,
    solutionToSolutionGap: input.solutionToSolutionGap,
    pageOverrides: input.pageOverrides,
    applyMode: input.applyMode,
    documentPages: pagesForExport,
    onProgress,
  });

  onProgress?.('Downloading…');
  const base = filenameBase || input.titleWords.title || 'puzzle-book';
  downloadPDF(pdfData, `${base}-${Date.now()}.pdf`);
}

export async function exportBookAsPpt(
  input: BookExportInput,
  onProgress?: (status: string) => void,
  filenameBase?: string
): Promise<void> {
  const pagesForExport = buildPagesForExport(input);
  const puzzlesToExport = buildPuzzlesForExport(input);
  const crosswordsToExport = buildCrosswordPuzzlesForExport(input);
  const genericsToExport = buildGenericPuzzlesForExport(input);
  const murdokuToExport = buildMurdokuPuzzlesForExport(input);
  const hasTextPages = pagesForExport.some((page) => isTextModuleType(page.moduleType));

  if (
    puzzlesToExport.length === 0 &&
    crosswordsToExport.length === 0 &&
    genericsToExport.length === 0 &&
    murdokuToExport.length === 0 &&
    !hasTextPages
  ) {
    throw new Error('Generate puzzles or add a document page before exporting.');
  }

  await generatePuzzlePPT(
    {
      bookSettings: {
        ...input.bookSettings,
        ...input.wordSearchSettings.bookCanvas,
      },
      titleWords: input.titleWords,
      wordSearchSettings: input.wordSearchSettings,
      puzzles: puzzlesToExport,
      crosswordPuzzles: crosswordsToExport,
      crosswordPageOverrides: input.pageCrosswordOverrides,
      genericPuzzles: genericsToExport,
      genericPageOverrides: input.pageGenericOverrides,
      murdokuPuzzles: murdokuToExport,
      includeSolution: true,
      onlySolutions: false,
      puzzleGridScale: input.puzzleGridScale,
      titleToAnswerGap: input.titleToAnswerGap,
      pageMargin: input.pageMargin,
      solutionToSolutionGap: input.solutionToSolutionGap,
      pageOverrides: input.pageOverrides,
      applyMode: input.applyMode,
      documentPages: pagesForExport,
    },
    onProgress
  );
}
