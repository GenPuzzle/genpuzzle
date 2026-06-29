import { generatePuzzlePDF, downloadPDF } from './pdf-export';
import { generatePuzzlePPT } from './ppt-export';
import type { Puzzle } from './puzzles';
import type { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings, BookSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isTextModuleType } from './document-model';

export interface BookExportInput {
  currentPuzzleType: string;
  bookSettings: BookSettings;
  titleWords: TitleWordsSettings;
  wordSearchSettings: WordSearchSettings;
  batchPuzzles: WordSearchPuzzle[];
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
    return page;
  });
}

function buildPuzzlesForExport(input: BookExportInput): WordSearchPuzzle[] {
  if (input.currentPuzzleType === 'word-search' && input.batchPuzzles.length > 0) {
    return input.batchPuzzles;
  }
  if (input.currentPuzzle) {
    return [input.currentPuzzle as WordSearchPuzzle];
  }
  return [];
}

export function canExportBook(input: BookExportInput): boolean {
  if (input.documentPages.length === 0) return false;
  const pages = buildPagesForExport(input);
  const puzzles = buildPuzzlesForExport(input);
  const hasTextPages = pages.some((page) => isTextModuleType(page.moduleType));
  return puzzles.length > 0 || hasTextPages;
}

/** Share requires document tabs plus user-entered content (words, text, or generated puzzles). */
export function canShareProject(input: BookExportInput): boolean {
  if (input.documentPages.length === 0) return false;
  if (buildPuzzlesForExport(input).length > 0) return true;

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

export async function exportBookAsPdf(input: BookExportInput, filenameBase?: string): Promise<void> {
  const pagesForExport = buildPagesForExport(input);
  const puzzlesToExport = buildPuzzlesForExport(input);

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
    includeSolution: true,
    onlySolutions: false,
    puzzleGridScale: input.puzzleGridScale,
    titleToAnswerGap: input.titleToAnswerGap,
    pageMargin: input.pageMargin,
    solutionToSolutionGap: input.solutionToSolutionGap,
    pageOverrides: input.pageOverrides,
    applyMode: input.applyMode,
    documentPages: pagesForExport,
  });

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
  const hasTextPages = pagesForExport.some((page) => isTextModuleType(page.moduleType));

  if (puzzlesToExport.length === 0 && !hasTextPages) {
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
