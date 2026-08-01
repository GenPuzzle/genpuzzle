/**
 * Book compiler — flattens ordered document modules into a sequential page list.
 * Shared by preview (page map) and export (PDF/PPT compiler).
 */

import type { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isPuzzleModuleType, isTextModuleType } from './document-model';
import { resolveBookPageNumberText } from './page-number/settings';
import type { PageNumberSettings } from './puzzles/types';
import {
  formatTocLines,
  normalizeTocSettings,
  TOC_SOLUTIONS_DOCUMENT_ID,
  type TocSettings,
} from './toc-settings';
import { resolveHeaderTextParts } from './header-assembly/resolve-parts';
import { resolvePuzzleDisplayNumber } from './puzzle-line-index';
import {
  applyTocEntryOverrides,
  partitionTocEntries,
  remapTocEntriesAfterPageInsertion,
  resolveTocLayoutMetricsForEntries,
  resolveTocLineSpacingPx,
  type TocLayoutMetrics,
} from './toc-layout';
import { getPageDimensionsInches, getPageMarginInches } from './puzzle-layout';

export { TOC_SOLUTIONS_DOCUMENT_ID };

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

/** First book page index that may show a footer page number (after TOC pages). */
export function getFirstPageNumberBookIndex(pages: CompiledPage[]): number {
  const tocStart = pages.findIndex(
    (page) => page.kind === 'text' && page.moduleType === 'table-of-contents'
  );
  if (tocStart < 0) return 0;
  let index = tocStart;
  while (
    index < pages.length &&
    pages[index].kind === 'text' &&
    pages[index].moduleType === 'table-of-contents'
  ) {
    index += 1;
  }
  return index;
}

/** True when this book page should paint a footer page number. */
export function shouldDrawBookPageNumber(
  bookPageIndex: number,
  pages: CompiledPage[]
): boolean {
  const tocStart = pages.findIndex(
    (page) => page.kind === 'text' && page.moduleType === 'table-of-contents'
  );
  if (tocStart < 0) return true;
  // Never number pages before the TOC, or the TOC pages themselves.
  if (bookPageIndex < tocStart) return false;
  const page = pages[bookPageIndex];
  if (page?.kind === 'text' && page.moduleType === 'table-of-contents') return false;
  return true;
}

interface TocSourceEntry {
  title: string;
  documentId: string;
  level: 1 | 2;
  /** Index in flat pages array where this entry starts */
  pageIndex: number;
}

/** Documents that appear after the first Table of Contents tab (book order). */
export function getDocumentsAfterToc(documents: DocumentPage[]): DocumentPage[] {
  const tocIndex = documents.findIndex((d) => d.moduleType === 'table-of-contents');
  if (tocIndex < 0) return documents;
  return documents.slice(tocIndex + 1);
}

/** Title / separator pages after the TOC — used for chapters-only mode. */
export function getTitlePagesAfterToc(documents: DocumentPage[]): DocumentPage[] {
  return getDocumentsAfterToc(documents).filter((d) => d.moduleType === 'title-page');
}

function getPrimaryTocSettings(documents: DocumentPage[]): TocSettings {
  const tocDoc = documents.find((d) => d.moduleType === 'table-of-contents');
  if (!tocDoc) return normalizeTocSettings();
  return normalizeTocSettings((tocDoc.settings as TextModuleSettings).tocSettings);
}

function resolveDocumentTocTitle(doc: DocumentPage, settings: TextModuleSettings | PuzzleModuleSettings): string {
  if (doc.moduleType === 'word-search') {
    const puzzleSettings = settings as PuzzleModuleSettings;
    return (
      puzzleSettings.titleWords?.title?.trim() ||
      puzzleSettings.title?.trim() ||
      doc.name
    );
  }
  const textSettings = settings as TextModuleSettings;
  return textSettings.title?.trim() || doc.name;
}

/**
 * Apply TOC entry scope (all vs chapters), exclusions, default-hide rules,
 * solutions, and custom rows. Never includes pages before the TOC tab.
 */
export function resolveFinalTocEntries(
  entries: ResolvedTocEntry[],
  documents: DocumentPage[],
  tocSettings?: Partial<TocSettings> | null
): ResolvedTocEntry[] {
  const toc = normalizeTocSettings(tocSettings);
  const excluded = new Set(toc.excludedDocumentIds);
  const revealed = new Set(toc.revealedDocumentIds);
  const afterTocIds = new Set(getDocumentsAfterToc(documents).map((d) => d.id));
  const docsById = new Map(documents.map((d) => [d.id, d]));

  const isVisibleDoc = (documentId: string): boolean => {
    if (documentId === TOC_SOLUTIONS_DOCUMENT_ID) {
      return toc.includeSolutionPages;
    }
    if (documentId.startsWith('custom:')) return true;
    if (excluded.has(documentId)) return false;
    if (revealed.has(documentId)) return true;
    const doc = docsById.get(documentId);
    if (!doc) return afterTocIds.has(documentId);
    if (!afterTocIds.has(documentId)) return false;
    if (isPuzzleModuleType(doc.moduleType) && toc.hidePuzzleDocuments) return false;
    if (
      isTextModuleType(doc.moduleType) &&
      doc.moduleType !== 'title-page' &&
      doc.moduleType !== 'table-of-contents' &&
      toc.hideDocuments
    ) {
      return false;
    }
    return true;
  };

  const filtered = entries.filter((entry) => {
    if (entry.documentId === TOC_SOLUTIONS_DOCUMENT_ID) {
      return toc.includeSolutionPages;
    }
    if (!afterTocIds.has(entry.documentId) && !entry.documentId.startsWith('custom:')) {
      return false;
    }
    return isVisibleDoc(entry.documentId);
  });

  let result: ResolvedTocEntry[];

  if (toc.entryScope === 'chapters') {
    const titlePages = getTitlePagesAfterToc(documents).filter((doc) => isVisibleDoc(doc.id));
    result = titlePages.map((doc, index) => {
      const matched = filtered.find((e) => e.documentId === doc.id);
      const pageTitle = resolveDocumentTocTitle(doc, doc.settings as TextModuleSettings);
      const customTitle = toc.chapters[index]?.title?.trim();
      return {
        title: customTitle || pageTitle,
        documentId: doc.id,
        level: 1 as const,
        bookPageIndex: matched?.bookPageIndex ?? 0,
        pageNumber: matched?.pageNumber ?? null,
      };
    });
    // Solutions still appear in chapters mode when enabled.
    const solution = filtered.find((e) => e.documentId === TOC_SOLUTIONS_DOCUMENT_ID);
    if (solution) result = [...result, solution];
  } else {
    result = filtered;
  }

  const customs = toc.customEntries.map((custom) => ({
    title: custom.title.trim() || 'Untitled',
    pageNumber: custom.pageNumber.trim() || null,
    level: 1 as const,
    documentId: `custom:${custom.id}`,
    bookPageIndex: 0,
  }));

  return [...result, ...customs];
}

/** Whether a document tab is currently listed in the TOC (for eye toggles). */
export function isDocumentListedInToc(
  documentId: string,
  documents: DocumentPage[],
  tocSettings?: Partial<TocSettings> | null
): boolean {
  const toc = normalizeTocSettings(tocSettings);
  if (toc.excludedDocumentIds.includes(documentId)) return false;
  if (toc.revealedDocumentIds.includes(documentId)) return true;
  const doc = documents.find((d) => d.id === documentId);
  if (!doc) return false;
  if (isPuzzleModuleType(doc.moduleType) && toc.hidePuzzleDocuments) return false;
  if (
    isTextModuleType(doc.moduleType) &&
    doc.moduleType !== 'title-page' &&
    doc.moduleType !== 'table-of-contents' &&
    toc.hideDocuments
  ) {
    return false;
  }
  return true;
}

function formatTocContentForPage(
  entries: ResolvedTocEntry[],
  settings: TextModuleSettings
): string {
  return formatTocLines(entries, settings.tocSettings);
}

function resolvePuzzleTocTitle(
  puzzle: WordSearchPuzzle,
  ws: WordSearchSettings,
  titleWords: TitleWordsSettings
): string {
  const parts = resolveHeaderTextParts(puzzle, ws, titleWords);
  if (!parts.titleText) {
    return `Puzzle ${resolvePuzzleDisplayNumber(puzzle, ws)}`;
  }
  const style = ws.typography.puzzleNumberingStyle || 'none';
  if (style === 'prefix' && parts.numberText) {
    return `${parts.numberText}. ${parts.titleText}`;
  }
  if (style === 'suffix' && parts.numberText) {
    return `${parts.titleText} #${parts.numberText}`;
  }
  return parts.titleText;
}

/** List each puzzle page when there are multiple pages with distinct titles. */
function shouldIncludeIndividualPuzzleEntries(
  ws: WordSearchSettings,
  docPuzzles: WordSearchPuzzle[],
  titleWords: TitleWordsSettings,
  forceInclude: boolean
): boolean {
  if (docPuzzles.length === 0) return false;
  if (forceInclude) return true;
  if (docPuzzles.length === 1) return false;

  if (ws.typography.selectTitleOption === 'custom') {
    const lines = (ws.typography.titleText || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 1) return true;
  }

  const titles = docPuzzles.map((puzzle) =>
    resolvePuzzleTocTitle(puzzle, ws, titleWords).toLowerCase()
  );
  return new Set(titles).size > 1;
}

function resolveSolutionsTocTitle(solutionPage: PendingSolutionPage): string {
  const custom = solutionPage.wordSearchSettings.typography.customSolutionTitle?.trim();
  // Default product copy uses singular "Solution"; TOC always prefers plural.
  if (!custom || /^solution$/i.test(custom)) return 'Solutions';
  return custom;
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
      if (doc.moduleType !== 'table-of-contents') {
        tocSources.push({
          title: resolveDocumentTocTitle(doc, settings),
          documentId: doc.id,
          level: 1,
          pageIndex,
        });
      }
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
    const titleWords = moduleSettings.titleWords ?? { title: doc.name, fontFamily: 'Arial', fontSize: 24, words: [] };
    const forcePuzzlePages = documents.some(
      (d) =>
        d.moduleType === 'table-of-contents' &&
        normalizeTocSettings((d.settings as TextModuleSettings).tocSettings).includePuzzlePages
    );
    const listIndividualPuzzles = shouldIncludeIndividualPuzzleEntries(
      ws,
      docPuzzles,
      titleWords,
      forcePuzzlePages
    );

    if (!listIndividualPuzzles) {
      const singleTitle =
        docPuzzles.length > 0
          ? resolvePuzzleTocTitle(docPuzzles[0], ws, titleWords)
          : resolveDocumentTocTitle(doc, moduleSettings);
      tocSources.push({
        title: singleTitle,
        documentId: doc.id,
        level: 1,
        pageIndex: pages.length,
      });
    }

    for (let i = 0; i < docPuzzles.length; i++) {
      const puzzle = docPuzzles[i];
      puzzle.puzzleIndexInDocument = i;
      puzzle.puzzleNumber = resolvePuzzleDisplayNumber(puzzle, ws, i);
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
      if (listIndividualPuzzles) {
        tocSources.push({
          title: resolvePuzzleTocTitle(puzzle, ws, titleWords),
          documentId: doc.id,
          level: 1,
          pageIndex,
        });
      }

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
  let firstSolutionPageIndex: number | null = null;
  for (const solutionPage of pendingSolutions) {
    if (firstSolutionPageIndex === null) {
      firstSolutionPageIndex = pages.length;
    }
    pages.push({
      ...solutionPage,
      bookPageIndex: pages.length,
      pageNumber: null,
    });
  }

  if (includeSolutions && pendingSolutions.length > 0 && firstSolutionPageIndex !== null) {
    tocSources.push({
      title: resolveSolutionsTocTitle(pendingSolutions[0]),
      documentId: TOC_SOLUTIONS_DOCUMENT_ID,
      level: 1,
      pageIndex: firstSolutionPageIndex,
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

  const primaryTocSettings = getPrimaryTocSettings(documents);
  let finalTocEntries = resolveFinalTocEntries(tocEntries, documents, primaryTocSettings);

  const tocPageIndex = pages.findIndex(
    (page) => page.kind === 'text' && page.moduleType === 'table-of-contents'
  );

  if (tocPageIndex >= 0) {
    const tocTemplate = pages[tocPageIndex] as CompiledTextPage;
    const storedSettings = tocTemplate.settings;
    finalTocEntries = applyTocEntryOverrides(finalTocEntries, storedSettings);

    const wsDoc = documents.find((d) => d.moduleType === 'word-search');
    const layoutWs =
      (wsDoc?.settings as PuzzleModuleSettings | undefined)?.wordSearchSettings ??
      documents
        .map((d) => (d.settings as PuzzleModuleSettings).wordSearchSettings)
        .find(Boolean);

    const dims = layoutWs ? getPageDimensionsInches(layoutWs) : { width: 8.5, height: 11 };
    const marginIn = layoutWs ? getPageMarginInches(layoutWs) : 0.5;
    const ptToPx = (pt: number) => pt * (96 / 72);
    const toc = normalizeTocSettings(storedSettings.tocSettings);
    const metrics: TocLayoutMetrics = layoutWs
      ? resolveTocLayoutMetricsForEntries(
          finalTocEntries.length,
          storedSettings,
          layoutWs,
          ptToPx
        )
      : {
          contentHeightPx: Math.max(120, (dims.height - marginIn * 2) * 96 - 40),
          titleFontPx: ptToPx(toc.titleFontSize ?? storedSettings.fontSize * 1.2 ?? 22),
          entryFontPx: ptToPx(toc.entryFontSize ?? storedSettings.fontSize ?? 18),
          rowPaddingPx: resolveTocLineSpacingPx(toc) / 2,
          lineSpacingPx: resolveTocLineSpacingPx(toc),
        };

    const slices = partitionTocEntries(finalTocEntries, storedSettings, metrics);
    const totalEntryCount = finalTocEntries.length;

    if (slices.length > 1) {
      const extraPages = slices.length - 1;
      const continuationPages: CompiledTextPage[] = slices.slice(1).map((slice, sliceIdx) => ({
        ...tocTemplate,
        bookPageIndex: tocPageIndex + sliceIdx + 1,
        pageNumber: null,
        resolvedToc: slice,
        settings: {
          ...storedSettings,
          content: formatTocContentForPage(slice, storedSettings),
          tocPageIndex: sliceIdx + 1,
          tocPageCount: slices.length,
          tocTotalEntryCount: totalEntryCount,
        },
      }));
      pages.splice(tocPageIndex + 1, 0, ...continuationPages);
      finalTocEntries = remapTocEntriesAfterPageInsertion(
        finalTocEntries,
        tocPageIndex,
        extraPages,
        pageNumberSettings
      );
      for (let i = 0; i < pages.length; i++) {
        pages[i].bookPageIndex = i;
        if (pageNumberSettings) {
          pages[i].pageNumber = resolveBookPageNumberText(i, pageNumberSettings);
        }
      }
      // Re-fit after page-number remap (entry count unchanged; page numbers updated)
      const remappedMetrics = layoutWs
        ? resolveTocLayoutMetricsForEntries(
            finalTocEntries.length,
            storedSettings,
            layoutWs,
            ptToPx
          )
        : metrics;
      const remappedSlices = partitionTocEntries(finalTocEntries, storedSettings, remappedMetrics);
      pages[tocPageIndex] = {
        ...tocTemplate,
        bookPageIndex: tocPageIndex,
        resolvedToc: remappedSlices[0] ?? slices[0],
        settings: {
          ...storedSettings,
          content: formatTocContentForPage(remappedSlices[0] ?? slices[0], storedSettings),
          tocPageIndex: 0,
          tocPageCount: remappedSlices.length,
          tocTotalEntryCount: finalTocEntries.length,
        },
      };
      for (let p = 1; p < remappedSlices.length; p++) {
        const page = pages[tocPageIndex + p] as CompiledTextPage;
        pages[tocPageIndex + p] = {
          ...page,
          bookPageIndex: tocPageIndex + p,
          resolvedToc: remappedSlices[p],
          settings: {
            ...page.settings,
            content: formatTocContentForPage(remappedSlices[p], storedSettings),
            tocPageIndex: p,
            tocPageCount: remappedSlices.length,
            tocTotalEntryCount: finalTocEntries.length,
          },
        };
      }
    } else {
      pages[tocPageIndex] = {
        ...tocTemplate,
        resolvedToc: slices[0],
        settings: {
          ...storedSettings,
          content: formatTocContentForPage(slices[0], storedSettings),
          tocPageIndex: 0,
          tocPageCount: 1,
          tocTotalEntryCount: totalEntryCount,
        },
      };
    }
  }

  // Inject auto TOC content on all TOC pages
  for (const page of pages) {
    if (page.kind === 'text' && page.moduleType === 'table-of-contents') {
      if (page.settings.tocMode !== 'manual') {
        const slice = page.resolvedToc ?? finalTocEntries;
        page.resolvedToc = slice;
        page.settings = {
          ...page.settings,
          content: formatTocContentForPage(slice, page.settings),
        };
      }
    }
  }

  return {
    pages,
    tocEntries: finalTocEntries,
    totalPages: pages.length,
  };
}

/** Find the 0-based book page index for a document's first puzzle page (or text page). */
export function findBookPageIndexForDocument(
  compiled: CompiledBook,
  documentId: string,
  puzzleIndexInDocument = 0
): number | null {
  const page = compiled.pages.find((p) => {
    if (p.sourceDocumentId !== documentId) return false;
    if (p.kind === 'puzzle') {
      return p.puzzleIndexInDocument === puzzleIndexInDocument;
    }
    if (puzzleIndexInDocument === 0 && p.kind === 'text') return true;
    return false;
  });
  return page ? page.bookPageIndex : null;
}

export { formatTocLines };

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
