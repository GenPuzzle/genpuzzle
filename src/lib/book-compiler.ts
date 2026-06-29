/**
 * Book compiler — flattens ordered document modules into a sequential page list.
 * Shared by preview (page map) and export (PDF/PPT compiler).
 */

import type { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isTextModuleType } from './document-model';
import { resolveBookPageNumberText } from './page-number/settings';
import type { PageNumberSettings } from './puzzles/types';

export type CompiledPageKind = 'text' | 'puzzle' | 'solution' | 'blank';

export interface CompiledPageBase {
  bookPageIndex: number;
  pageNumber: string | null;
  sourceDocumentId: string;
  sourceDocumentName: string;
  moduleType: DocumentPage['moduleType'];
}

export interface CompiledTextPage extends CompiledPageBase {
  kind: 'text';
  settings: TextModuleSettings;
  resolvedToc?: ResolvedTocEntry[];
}

export interface CompiledPuzzlePage extends CompiledPageBase {
  kind: 'puzzle';
  puzzle: WordSearchPuzzle;
  puzzleIndexInDocument: number;
  wordSearchSettings: WordSearchSettings;
}

export interface CompiledSolutionPage extends CompiledPageBase {
  kind: 'solution';
  puzzles: WordSearchPuzzle[];
  wordSearchSettings: WordSearchSettings;
}

export interface CompiledBlankPage extends CompiledPageBase {
  kind: 'blank';
}

export type CompiledPage =
  | CompiledTextPage
  | CompiledPuzzlePage
  | CompiledSolutionPage
  | CompiledBlankPage;

export interface ResolvedTocEntry {
  title: string;
  pageNumber: string | null;
  level: 1 | 2;
  documentId: string;
  bookPageIndex: number;
}

export interface CompileBookOptions {
  includeSolutions?: boolean;
  pageNumberSettings?: PageNumberSettings;
}

export interface CompiledBook {
  pages: CompiledPage[];
  tocEntries: ResolvedTocEntry[];
  totalPages: number;
}

interface TocSourceEntry {
  title: string;
  documentId: string;
  level: 1 | 2;
  /** Index in flat pages array where this entry starts */
  pageIndex: number;
}

function formatTocLines(entries: ResolvedTocEntry[]): string {
  return entries
    .map((e) => {
      const indent = e.level === 2 ? '    ' : '';
      const num = e.pageNumber ?? '—';
      return `${indent}${e.title}  ${'.'.repeat(Math.max(2, 40 - e.title.length))}  ${num}`;
    })
    .join('\n');
}

type PendingSolutionPage = Omit<CompiledSolutionPage, 'bookPageIndex' | 'pageNumber'>;

export function getTitleWordsForDocument(
  documentPages: DocumentPage[],
  documentId: string,
  fallback: TitleWordsSettings
): TitleWordsSettings {
  const doc = documentPages.find((page) => page.id === documentId);
  if (doc?.moduleType === 'word-search') {
    return (doc.settings as PuzzleModuleSettings).titleWords ?? fallback;
  }
  return fallback;
}

export function compileBook(
  documents: DocumentPage[],
  puzzlesByDocumentId: Map<string, WordSearchPuzzle[]>,
  options: CompileBookOptions = {}
): CompiledBook {
  const includeSolutions = options.includeSolutions ?? true;
  const pageNumberSettings = options.pageNumberSettings;
  const pages: CompiledPage[] = [];
  const pendingSolutions: PendingSolutionPage[] = [];
  const tocSources: TocSourceEntry[] = [];

  for (const doc of documents) {
    const baseMeta = {
      sourceDocumentId: doc.id,
      sourceDocumentName: doc.name,
      moduleType: doc.moduleType,
    };

    if (isTextModuleType(doc.moduleType)) {
      const settings = doc.settings as TextModuleSettings;
      const pageIndex = pages.length;
      pages.push({
        kind: 'text',
        ...baseMeta,
        bookPageIndex: pageIndex,
        pageNumber: null,
        settings: { ...settings },
      });
      tocSources.push({
        title: settings.title || doc.name,
        documentId: doc.id,
        level: 1,
        pageIndex,
      });
      continue;
    }

    if (doc.moduleType !== 'word-search') {
      // Placeholder: future puzzle types
      continue;
    }

    const moduleSettings = doc.settings as PuzzleModuleSettings;
    const ws = moduleSettings.wordSearchSettings;
    if (!ws) continue;

    const docPuzzles = puzzlesByDocumentId.get(doc.id) ?? [];

    for (let i = 0; i < docPuzzles.length; i++) {
      const puzzle = docPuzzles[i];
      const pageIndex = pages.length;
      pages.push({
        kind: 'puzzle',
        ...baseMeta,
        bookPageIndex: pageIndex,
        pageNumber: null,
        puzzle,
        puzzleIndexInDocument: i,
        wordSearchSettings: ws,
      });
      tocSources.push({
        title: puzzle.words?.[0] ? `Puzzle ${puzzle.puzzleNumber ?? i + 1}` : doc.name,
        documentId: doc.id,
        level: 2,
        pageIndex,
      });

      if (ws.bookCanvas.includePageBetweenPuzzleAndSolutions) {
        pages.push({
          kind: 'blank',
          ...baseMeta,
          bookPageIndex: pages.length,
          pageNumber: null,
        });
      }
    }

    if (includeSolutions && docPuzzles.length > 0) {
      const chunkSize = ws.bookCanvas.answersPerPage || 1;
      for (let i = 0; i < docPuzzles.length; i += chunkSize) {
        pendingSolutions.push({
          kind: 'solution',
          ...baseMeta,
          puzzles: docPuzzles.slice(i, i + chunkSize),
          wordSearchSettings: ws,
        });
      }
    }
  }

  // All solution pages from every document are appended at the end of the book.
  for (const solutionPage of pendingSolutions) {
    pages.push({
      ...solutionPage,
      bookPageIndex: pages.length,
      pageNumber: null,
    });
  }

  // Assign page numbers
  for (let i = 0; i < pages.length; i++) {
    pages[i].bookPageIndex = i;
    if (pageNumberSettings) {
      pages[i].pageNumber = resolveBookPageNumberText(i, pageNumberSettings);
    }
  }

  const tocEntries: ResolvedTocEntry[] = tocSources.map((src) => ({
    title: src.title,
    documentId: src.documentId,
    level: src.level,
    bookPageIndex: src.pageIndex,
    pageNumber: pageNumberSettings
      ? resolveBookPageNumberText(src.pageIndex, pageNumberSettings)
      : String(src.pageIndex + 1),
  }));

  // Inject auto TOC content
  for (const page of pages) {
    if (page.kind === 'text' && page.moduleType === 'table-of-contents') {
      if (page.settings.tocMode !== 'manual') {
        page.resolvedToc = tocEntries;
        page.settings = {
          ...page.settings,
          content: formatTocLines(tocEntries),
        };
      }
    }
  }

  return {
    pages,
    tocEntries,
    totalPages: pages.length,
  };
}

/** Group batch puzzles by document page id for the compiler. */
export function groupPuzzlesByDocument(
  puzzles: WordSearchPuzzle[],
  documents: DocumentPage[]
): Map<string, WordSearchPuzzle[]> {
  const map = new Map<string, WordSearchPuzzle[]>();
  for (const doc of documents) {
    if (doc.moduleType === 'word-search') {
      map.set(doc.id, []);
    }
  }

  for (const puzzle of puzzles) {
    const docId = puzzle.pageId;
    if (docId && map.has(docId)) {
      map.get(docId)!.push(puzzle);
    } else {
      const firstWs = documents.find((d) => d.moduleType === 'word-search');
      if (firstWs) {
        if (!map.has(firstWs.id)) map.set(firstWs.id, []);
        map.get(firstWs.id)!.push(puzzle);
      }
    }
  }
  return map;
}
