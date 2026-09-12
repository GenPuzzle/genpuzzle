/**
 * Book compiler — flattens ordered document modules into a sequential page list.
 * Shared by preview (page map) and export (PDF/PPT compiler).
 */

import { getDefaultWordSearchSettings } from './puzzles/types';
import type {
  WordSearchPuzzle,
  WordSearchSettings,
  TitleWordsSettings,
  CrosswordPuzzle,
  GenericBatchPuzzle,
  MurdokuPuzzle,
} from './puzzles/types';
import {
  getDefaultGenericPuzzleSettings,
  normalizeGenericPuzzleSettings,
  mergeGenericPuzzlePageOverride,
  resolveGenericPuzzleTitle,
  isGenericPuzzleModuleType,
  type GenericPuzzleSettings,
  type GenericPuzzleModuleType,
} from './generic-puzzle-settings';
import {
  computeTriviaSolutionsPerPage,
  packTriviaGamesForSolutionPages,
} from './puzzles/trivia';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isPuzzleModuleType, isTextModuleType } from './document-model';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  resolveCrosswordPuzzleTitle,
  type CrosswordSettings,
} from './crossword-settings';
import { applyCrosswordAutoFit } from './auto-page-fit';
import { buildCrosswordPuzzlesForDocumentPage } from './generate-document-puzzles';
import {
  getDefaultMurdokuSettings,
  normalizeMurdokuSettings,
  resolveMurdokuPuzzleTitle,
  type MurdokuSettings,
} from './murdoku-settings';
import type { MurdokuPagePart } from './murdoku-page-layout';
import { resolveBookPageNumberText, resolveTocEntryPageNumber } from './page-number/settings';
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
import { reorderCompiledPagesForMixedPuzzles } from './mix-compiled-pages';

export { TOC_SOLUTIONS_DOCUMENT_ID };

export type CompiledPageKind =
  | 'text'
  | 'puzzle'
  | 'solution'
  | 'blank'
  | 'crossword'
  | 'crossword-solution'
  | 'generic-puzzle'
  | 'generic-puzzle-solution'
  | 'murdoku'
  | 'murdoku-solution';

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

export type WordSearchPagePart = 'clues' | 'grid';

export interface CompiledPuzzlePage extends CompiledPageBase {
  kind: 'puzzle';
  puzzle: WordSearchPuzzle;
  puzzleIndexInDocument: number;
  wordSearchSettings: WordSearchSettings;
  pagePart?: WordSearchPagePart;
}

export interface CompiledSolutionPage extends CompiledPageBase {
  kind: 'solution';
  puzzles: WordSearchPuzzle[];
  wordSearchSettings: WordSearchSettings;
}

export interface CompiledBlankPage extends CompiledPageBase {
  kind: 'blank';
}

/** One crossword puzzle page (mirrors CompiledPuzzlePage for crossword documents). */
export interface CompiledCrosswordPage extends CompiledPageBase {
  kind: 'crossword';
  puzzle: CrosswordPuzzle;
  puzzleIndexInDocument: number;
  crosswordSettings: CrosswordSettings;
}

/** Crossword solution page — holds up to answersPerPage puzzles. */
export interface CompiledCrosswordSolutionPage extends CompiledPageBase {
  kind: 'crossword-solution';
  puzzles: CrosswordPuzzle[];
  crosswordSettings: CrosswordSettings;
}

/** One generic puzzle page — holds 1..puzzlesPerPage puzzles. */
export interface CompiledGenericPuzzlePage extends CompiledPageBase {
  kind: 'generic-puzzle';
  puzzleType: GenericPuzzleModuleType;
  puzzles: GenericBatchPuzzle[];
  /** Index of the first puzzle on this page. */
  puzzleIndexInDocument: number;
  genericSettings: GenericPuzzleSettings;
}

/** Sudoku/maze solution page — holds up to solutionsPerPage puzzles. */
export interface CompiledGenericPuzzleSolutionPage extends CompiledPageBase {
  kind: 'generic-puzzle-solution';
  puzzleType: GenericPuzzleModuleType;
  puzzles: GenericBatchPuzzle[];
  genericSettings: GenericPuzzleSettings;
}

export interface CompiledMurdokuPage extends CompiledPageBase {
  kind: 'murdoku';
  puzzle: MurdokuPuzzle;
  puzzleIndexInDocument: number;
  murdokuSettings: MurdokuSettings;
  pagePart: MurdokuPagePart;
}

export interface CompiledMurdokuSolutionPage extends CompiledPageBase {
  kind: 'murdoku-solution';
  puzzles: MurdokuPuzzle[];
  murdokuSettings: MurdokuSettings;
}

export type CompiledPage =
  | CompiledTextPage
  | CompiledPuzzlePage
  | CompiledSolutionPage
  | CompiledBlankPage
  | CompiledCrosswordPage
  | CompiledCrosswordSolutionPage
  | CompiledGenericPuzzlePage
  | CompiledGenericPuzzleSolutionPage
  | CompiledMurdokuPage
  | CompiledMurdokuSolutionPage;

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
  /** Generated crossword puzzles keyed by crossword document id. */
  crosswordPuzzlesByDocumentId?: Map<string, CrosswordPuzzle[]>;
  /** Per-page crossword style overrides keyed by document-local puzzle index. */
  crosswordPageOverrides?: Map<number, Partial<CrosswordSettings>>;
  /** Generated sudoku/maze puzzles keyed by document id. */
  genericPuzzlesByDocumentId?: Map<string, GenericBatchPuzzle[]>;
  /** Per-page sudoku/maze style overrides keyed by document-local puzzle index. */
  genericPageOverrides?: Map<number, Partial<GenericPuzzleSettings>>;
  /** Generated Murdoku puzzles keyed by Murdoku document id. */
  murdokuPuzzlesByDocumentId?: Map<string, MurdokuPuzzle[]>;
  /**
   * Interleave puzzle types within each chapter (word search #1, crossword #1, …).
   * Solutions stay at the end. Murdoku two-page units stay together.
   */
  mixPuzzles?: boolean;
  /** Thematic chapter topics used to place chapter divider pages when mixing. */
  chapterTopics?: string[];
}

/** Merge a per-page crossword override onto the document's crossword settings. */
export function mergeCrosswordPageOverride(
  base: CrosswordSettings,
  override: Partial<CrosswordSettings> | undefined
): CrosswordSettings {
  if (!override) return base;
  return normalizeCrosswordSettings({
    ...base,
    ...override,
    core: override.core ? { ...base.core, ...override.core } : base.core,
    typography: override.typography
      ? { ...base.typography, ...override.typography }
      : base.typography,
    colors: override.colors ? { ...base.colors, ...override.colors } : base.colors,
    bookCanvas: override.bookCanvas
      ? { ...base.bookCanvas, ...override.bookCanvas }
      : base.bookCanvas,
    pageFrameSettings: override.pageFrameSettings
      ? { ...(base.pageFrameSettings ?? {}), ...override.pageFrameSettings }
      : base.pageFrameSettings,
  });
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

export function isCompiledSolutionKind(kind: CompiledPage['kind']): boolean {
  return (
    kind === 'solution' ||
    kind === 'crossword-solution' ||
    kind === 'generic-puzzle-solution' ||
    kind === 'murdoku-solution'
  );
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

function getTextPageSubtitle(settings: TextModuleSettings): string {
  return settings.blocks?.find((block) => block.kind === 'subtitle')?.text?.trim() || '';
}

export function formatTocTitleWithSubtitle(title: string, subtitle?: string): string {
  const heading = title.trim().replace(/[:\s]+$/g, '');
  const extra = (subtitle || '').trim().replace(/^[:\s]+/g, '');
  if (!extra) return heading || title.trim();
  if (!heading) return extra;
  if (heading.toLowerCase().includes(extra.toLowerCase())) return heading;
  return `${heading}: ${extra}`;
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
  const heading =
    textSettings.blocks?.find((block) => block.kind === 'title')?.text?.trim() ||
    textSettings.title?.trim() ||
    doc.name;
  if (textSettings.isChapterPage || doc.moduleType === 'title-page') {
    return formatTocTitleWithSubtitle(heading, getTextPageSubtitle(textSettings));
  }
  return heading;
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
      const pageHeading =
        (doc.settings as TextModuleSettings).blocks?.find((block) => block.kind === 'title')
          ?.text?.trim() ||
        (doc.settings as TextModuleSettings).title?.trim() ||
        doc.name;
      const customIsPlaceholder =
        !customTitle ||
        /^chapter\s+\d+$/i.test(customTitle) ||
        customTitle === pageHeading;
      return {
        title: customIsPlaceholder
          ? pageTitle
          : formatTocTitleWithSubtitle(
              customTitle,
              getTextPageSubtitle(doc.settings as TextModuleSettings)
            ),
        documentId: doc.id,
        level: 1 as const,
        bookPageIndex: matched?.bookPageIndex ?? 0,
        pageNumber:
          matched?.pageNumber ||
          resolveTocEntryPageNumber(matched?.bookPageIndex ?? 0, undefined),
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

function resolveSolutionsTocTitle(solutionPage: AnyPendingSolutionPage): string {
  const custom =
    solutionPage.kind === 'crossword-solution'
      ? solutionPage.crosswordSettings.typography.customSolutionTitle?.trim()
      : solutionPage.kind === 'generic-puzzle-solution'
        ? solutionPage.genericSettings.typography.customSolutionTitle?.trim()
        : solutionPage.kind === 'murdoku-solution'
          ? undefined
          : solutionPage.wordSearchSettings.typography.customSolutionTitle?.trim();
  // Default product copy uses singular "Solution"; TOC always prefers plural.
  if (!custom || /^solution$/i.test(custom)) return 'Solutions';
  return custom;
}

type PendingSolutionPage = Omit<CompiledSolutionPage, 'bookPageIndex' | 'pageNumber'>;
type PendingCrosswordSolutionPage = Omit<
  CompiledCrosswordSolutionPage,
  'bookPageIndex' | 'pageNumber'
>;
type PendingGenericSolutionPage = Omit<
  CompiledGenericPuzzleSolutionPage,
  'bookPageIndex' | 'pageNumber'
>;
type PendingMurdokuSolutionPage = Omit<
  CompiledMurdokuSolutionPage,
  'bookPageIndex' | 'pageNumber'
>;
type AnyPendingSolutionPage =
  | PendingSolutionPage
  | PendingCrosswordSolutionPage
  | PendingGenericSolutionPage
  | PendingMurdokuSolutionPage;

export function getTitleWordsForDocument(
  documentPages: DocumentPage[],
  documentId: string,
  fallback: TitleWordsSettings
): TitleWordsSettings {
  const doc = documentPages.find((page) => page.id === documentId);
  if (doc && isPuzzleModuleType(doc.moduleType)) {
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
  const crosswordPuzzlesByDocumentId =
    options.crosswordPuzzlesByDocumentId ?? new Map<string, CrosswordPuzzle[]>();
  const crosswordPageOverrides =
    options.crosswordPageOverrides ?? new Map<number, Partial<CrosswordSettings>>();
  const genericPuzzlesByDocumentId =
    options.genericPuzzlesByDocumentId ?? new Map<string, GenericBatchPuzzle[]>();
  const genericPageOverrides =
    options.genericPageOverrides ?? new Map<number, Partial<GenericPuzzleSettings>>();
  const murdokuPuzzlesByDocumentId =
    options.murdokuPuzzlesByDocumentId ?? new Map<string, MurdokuPuzzle[]>();
  const pages: CompiledPage[] = [];
  const pendingSolutions: PendingSolutionPage[] = [];
  const pendingCrosswordSolutions: PendingCrosswordSolutionPage[] = [];
  const pendingGenericSolutions: PendingGenericSolutionPage[] = [];
  const pendingMurdokuSolutions: PendingMurdokuSolutionPage[] = [];
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

    if (doc.moduleType === 'crossword') {
      const moduleSettings = doc.settings as PuzzleModuleSettings;
      const rawCw = normalizeCrosswordSettings(
        moduleSettings.crosswordSettings ?? getDefaultCrosswordSettings()
      );
      const docCrosswords = crosswordPuzzlesByDocumentId.get(doc.id) ?? [];
      if (docCrosswords.length === 0) continue;

      const docLayoutSettings = moduleSettings.wordSearchSettings ?? getDefaultWordSearchSettings();
      const cw = applyCrosswordAutoFit(rawCw, docLayoutSettings, docCrosswords);
      const cwForIndex = (idx: number) =>
        mergeCrosswordPageOverride(cw, crosswordPageOverrides.get(idx));
      const startNumber = cw.core.puzzlesStartingNumber;
      const listIndividualCrosswords = docCrosswords.length > 1;

      if (!listIndividualCrosswords) {
        tocSources.push({
          title:
            resolveCrosswordPuzzleTitle({
              typography: cw.typography,
              puzzleIndex: 0,
              puzzlesStartingNumber: startNumber,
              fallback: doc.name,
            }) || doc.name,
          documentId: doc.id,
          level: 1,
          pageIndex: pages.length,
        });
      }

      for (let i = 0; i < docCrosswords.length; i++) {
        const puzzle = docCrosswords[i];
        puzzle.puzzleIndexInDocument = i;
        puzzle.puzzleNumber = startNumber + i;
        const pageIndex = pages.length;
        pages.push({
          kind: 'crossword',
          ...baseMeta,
          bookPageIndex: pageIndex,
          pageNumber: null,
          puzzle,
          puzzleIndexInDocument: i,
          crosswordSettings: cwForIndex(i),
        });
        if (listIndividualCrosswords) {
          tocSources.push({
            title:
              resolveCrosswordPuzzleTitle({
                typography: cw.typography,
                puzzleIndex: i,
                puzzlesStartingNumber: startNumber,
                fallback: doc.name,
              }) || `${doc.name} ${startNumber + i}`,
            documentId: doc.id,
            level: 1,
            pageIndex,
          });
        }

        if (cw.bookCanvas.includePageBetweenPuzzleAndSolutions) {
          pages.push({
            kind: 'blank',
            ...baseMeta,
            bookPageIndex: pages.length,
            pageNumber: null,
          });
        }
      }

      if (includeSolutions) {
        const chunkSize = cw.bookCanvas.answersPerPage || 1;
        for (let i = 0; i < docCrosswords.length; i += chunkSize) {
          pendingCrosswordSolutions.push({
            kind: 'crossword-solution',
            ...baseMeta,
            puzzles: docCrosswords.slice(i, i + chunkSize),
            crosswordSettings: cwForIndex(i),
          });
        }
      }
      continue;
    }

    if (doc.moduleType === 'murdoku') {
      const moduleSettings = doc.settings as PuzzleModuleSettings;
      const md = normalizeMurdokuSettings(
        moduleSettings.murdokuSettings ?? getDefaultMurdokuSettings()
      );
      const docMurdoku = murdokuPuzzlesByDocumentId.get(doc.id) ?? [];
      if (docMurdoku.length === 0) continue;

      const startNumber = md.core.puzzlesStartingNumber;
      const listIndividual = docMurdoku.length > 1;

      if (!listIndividual) {
        tocSources.push({
          title: resolveMurdokuPuzzleTitle(docMurdoku[0], doc.name),
          documentId: doc.id,
          level: 1,
          pageIndex: pages.length,
        });
      }

      for (let i = 0; i < docMurdoku.length; i++) {
        const puzzle = docMurdoku[i];
        puzzle.puzzleIndexInDocument = i;
        puzzle.puzzleNumber = startNumber + i;
        const pageParts: MurdokuPagePart[] =
          md.core.twoPagePuzzles ? ['characters', 'scene'] : ['single'];
        let listed = false;
        for (const pagePart of pageParts) {
          const pageIndex = pages.length;
          pages.push({
            kind: 'murdoku',
            ...baseMeta,
            bookPageIndex: pageIndex,
            pageNumber: null,
            puzzle,
            puzzleIndexInDocument: i,
            murdokuSettings: md,
            pagePart,
          });
          if (listIndividual && !listed) {
            listed = true;
            tocSources.push({
              title:
                resolveMurdokuPuzzleTitle(puzzle, `${doc.name} ${startNumber + i}`),
              documentId: doc.id,
              level: 1,
              pageIndex,
            });
          }

          if (md.bookCanvas.includePageBetweenPuzzleAndSolutions && pagePart === pageParts[pageParts.length - 1]) {
            pages.push({
              kind: 'blank',
              ...baseMeta,
              bookPageIndex: pages.length,
              pageNumber: null,
            });
          }
        }
      }

      if (includeSolutions) {
        const chunkSize = md.bookCanvas.answersPerPage || 1;
        for (let i = 0; i < docMurdoku.length; i += chunkSize) {
          pendingMurdokuSolutions.push({
            kind: 'murdoku-solution',
            ...baseMeta,
            puzzles: docMurdoku.slice(i, i + chunkSize),
            murdokuSettings: md,
          });
        }
      }
      continue;
    }

    if (isGenericPuzzleModuleType(doc.moduleType)) {
      const moduleType = doc.moduleType;
      const moduleSettings = doc.settings as PuzzleModuleSettings;
      const gp = normalizeGenericPuzzleSettings(
        moduleSettings.genericPuzzleSettings ?? getDefaultGenericPuzzleSettings(moduleType),
        moduleType
      );
      const docPuzzles = genericPuzzlesByDocumentId.get(doc.id) ?? [];
      if (docPuzzles.length === 0) continue;

      const gpForIndex = (idx: number) =>
        mergeGenericPuzzlePageOverride(gp, genericPageOverrides.get(idx));
      const startNumber = gp.core.puzzlesStartingNumber;
      const listIndividual = docPuzzles.length > 1;

      if (!listIndividual) {
        tocSources.push({
          title:
            resolveGenericPuzzleTitle({
              typography: gp.typography,
              puzzleIndex: 0,
              puzzlesStartingNumber: startNumber,
              fallback: doc.name,
            }) || doc.name,
          documentId: doc.id,
          level: 1,
          pageIndex: pages.length,
        });
      }

      docPuzzles.forEach((puzzle, i) => {
        puzzle.puzzleIndexInDocument = i;
        puzzle.puzzleNumber = startNumber + i;
      });

      const perPage = gp.core.puzzlesPerPage || 1;
      for (let i = 0; i < docPuzzles.length; i += perPage) {
        const pagePuzzles = docPuzzles.slice(i, i + perPage);
        const pageIndex = pages.length;
        pages.push({
          kind: 'generic-puzzle',
          ...baseMeta,
          bookPageIndex: pageIndex,
          pageNumber: null,
          puzzleType: moduleType,
          puzzles: pagePuzzles,
          puzzleIndexInDocument: i,
          genericSettings: gpForIndex(i),
        });
        if (listIndividual) {
          for (let j = 0; j < pagePuzzles.length; j++) {
            tocSources.push({
              title:
                resolveGenericPuzzleTitle({
                  typography: gp.typography,
                  puzzleIndex: i + j,
                  puzzlesStartingNumber: startNumber,
                  fallback: doc.name,
                  difficulty:
                    moduleType === 'sudoku'
                      ? (pagePuzzles[j] as { difficulty?: string })?.difficulty
                      : undefined,
                  difficultyPlacement:
                    moduleType === 'sudoku'
                      ? gp.core.sudokuDifficultyPlacement
                      : undefined,
                }) || `${doc.name} ${startNumber + i + j}`,
              documentId: doc.id,
              level: 1,
              pageIndex,
            });
          }
        }
      }

      if (includeSolutions) {
        if (moduleType === 'trivia') {
          const answersPerPage = computeTriviaSolutionsPerPage({
            answersPerColumn: gp.core.solutionsPerPage || 20,
            solutionColumns: gp.core.triviaSolutionColumns || 3,
          });
          const solutionPages = packTriviaGamesForSolutionPages(
            docPuzzles as import('./puzzles/types').TriviaPuzzle[],
            answersPerPage
          );
          for (let pageIdx = 0; pageIdx < solutionPages.length; pageIdx++) {
            const games = solutionPages[pageIdx];
            pendingGenericSolutions.push({
              kind: 'generic-puzzle-solution',
              ...baseMeta,
              puzzleType: moduleType,
              puzzles: games,
              genericSettings: gpForIndex(games[0]?.puzzleIndexInDocument ?? pageIdx),
            });
          }
        } else {
          const chunkSize = gp.core.solutionsPerPage || 1;
          for (let i = 0; i < docPuzzles.length; i += chunkSize) {
            pendingGenericSolutions.push({
              kind: 'generic-puzzle-solution',
              ...baseMeta,
              puzzleType: moduleType,
              puzzles: docPuzzles.slice(i, i + chunkSize),
              genericSettings: gpForIndex(i),
            });
          }
        }
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
      const pageParts: WordSearchPagePart[] = ws.core.twoPagePuzzles ? ['clues', 'grid'] : ['clues'];
      for (const pagePart of pageParts) {
        const pageIndex = pages.length;
        pages.push({
          kind: 'puzzle',
          ...baseMeta,
          bookPageIndex: pageIndex,
          pageNumber: null,
          puzzle,
          puzzleIndexInDocument: i,
          wordSearchSettings: ws,
          pagePart,
        });
        if (listIndividualPuzzles && pagePart === 'clues') {
          tocSources.push({
            title: resolvePuzzleTocTitle(puzzle, ws, titleWords),
            documentId: doc.id,
            level: 1,
            pageIndex,
          });
        }
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
  const allPendingSolutions: AnyPendingSolutionPage[] = [
    ...pendingSolutions,
    ...pendingCrosswordSolutions,
    ...pendingGenericSolutions,
    ...pendingMurdokuSolutions,
  ];
  let firstSolutionPageIndex: number | null = null;
  for (const solutionPage of allPendingSolutions) {
    if (firstSolutionPageIndex === null) {
      firstSolutionPageIndex = pages.length;
    }
    pages.push({
      ...solutionPage,
      bookPageIndex: pages.length,
      pageNumber: null,
    } as CompiledPage);
  }

  if (includeSolutions && allPendingSolutions.length > 0 && firstSolutionPageIndex !== null) {
    tocSources.push({
      title: resolveSolutionsTocTitle(allPendingSolutions[0]),
      documentId: TOC_SOLUTIONS_DOCUMENT_ID,
      level: 1,
      pageIndex: firstSolutionPageIndex,
    });
  }

  if (options.mixPuzzles) {
    const mixed = reorderCompiledPagesForMixedPuzzles(pages, {
      chapterTopics: options.chapterTopics,
    });
    const newIndexByOld = new Map<number, number>();
    mixed.forEach((page, index) => {
      newIndexByOld.set(page.bookPageIndex, index);
    });
    pages.length = 0;
    pages.push(...mixed);
    for (let i = tocSources.length - 1; i >= 0; i--) {
      const next = newIndexByOld.get(tocSources[i]!.pageIndex);
      if (next === undefined) tocSources.splice(i, 1);
      else tocSources[i]!.pageIndex = next;
    }
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
    pageNumber: resolveTocEntryPageNumber(src.pageIndex, pageNumberSettings),
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

/** Compiled solution pages for one document tab, in book order. */
export function getCompiledSolutionPagesForDocument(
  compiled: CompiledBook,
  documentId: string
): CompiledPage[] {
  return compiled.pages.filter(
    (page) =>
      isCompiledSolutionKind(page.kind) && page.sourceDocumentId === documentId
  );
}

/**
 * 0-based book page index for a document's solution sheet.
 * Accounts for front matter and every other document tab — solutions live at
 * the end of the compiled book, not at local index 0.
 */
export function findBookPageIndexForSolution(
  compiled: CompiledBook,
  documentId: string,
  solutionPageIndexInDocument: number
): number | null {
  const pages = getCompiledSolutionPagesForDocument(compiled, documentId);
  if (pages.length === 0) return null;
  const page =
    pages[Math.max(0, Math.min(pages.length - 1, solutionPageIndexInDocument))];
  return page ? page.bookPageIndex : null;
}

/** Find the 0-based book page index for a document puzzle/text page. */
export function findBookPageIndexForDocument(
  compiled: CompiledBook,
  documentId: string,
  puzzleIndexInDocument = 0,
  options?: { murdokuPagePart?: MurdokuPagePart }
): number | null {
  const page = compiled.pages.find((p) => {
    if (p.sourceDocumentId !== documentId) return false;
    if (p.kind === 'puzzle') {
      if (options?.murdokuPagePart) return false;
      return p.puzzleIndexInDocument === puzzleIndexInDocument;
    }
    if (p.kind === 'crossword') {
      return p.puzzleIndexInDocument === puzzleIndexInDocument;
    }
    if (p.kind === 'murdoku') {
      const part = options?.murdokuPagePart;
      if (part) {
        return (
          p.puzzleIndexInDocument === puzzleIndexInDocument && p.pagePart === part
        );
      }
      return p.puzzleIndexInDocument === puzzleIndexInDocument && p.pagePart !== 'scene';
    }
    if (p.kind === 'generic-puzzle') {
      // Multi-per-page chunks store the first puzzle index of the page.
      const start = p.puzzleIndexInDocument ?? 0;
      const count = Math.max(1, p.puzzles?.length ?? 1);
      return (
        puzzleIndexInDocument >= start && puzzleIndexInDocument < start + count
      );
    }
    if (puzzleIndexInDocument === 0 && p.kind === 'text') return true;
    return false;
  });
  return page ? page.bookPageIndex : null;
}

/** Book page index to paint on the canvas, or undefined when this page is unnumbered. */
export function visibleBookPageIndex(
  compiled: CompiledBook | null | undefined,
  bookPageIndex: number | null | undefined
): number | undefined {
  if (typeof bookPageIndex !== 'number') return undefined;
  if (compiled && !shouldDrawBookPageNumber(bookPageIndex, compiled.pages)) {
    return undefined;
  }
  return bookPageIndex;
}

export { formatTocLines };

/** Group generated sudoku/maze puzzles by their document id. */
export function groupGenericPuzzlesByDocument(
  puzzles: GenericBatchPuzzle[],
  documents: DocumentPage[]
): Map<string, GenericBatchPuzzle[]> {
  const map = new Map<string, GenericBatchPuzzle[]>();
  for (const doc of documents) {
    if (isGenericPuzzleModuleType(doc.moduleType)) map.set(doc.id, []);
  }

  for (const puzzle of puzzles) {
    const docId = puzzle.pageId;
    if (docId && map.has(docId)) {
      map.get(docId)!.push(puzzle);
      continue;
    }
    // Fall back to the first document whose module type matches the puzzle type.
    const fallback = documents.find((d) => d.moduleType === puzzle.type);
    if (fallback) {
      if (!map.has(fallback.id)) map.set(fallback.id, []);
      map.get(fallback.id)!.push(puzzle);
    }
  }
  return map;
}

/** Group generated crossword puzzles by their crossword document id. */
export function groupCrosswordPuzzlesByDocument(
  puzzles: CrosswordPuzzle[],
  documents: DocumentPage[]
): Map<string, CrosswordPuzzle[]> {
  const map = new Map<string, CrosswordPuzzle[]>();
  for (const doc of documents) {
    if (doc.moduleType === 'crossword') map.set(doc.id, []);
  }

  for (const puzzle of puzzles) {
    const docId = puzzle.pageId;
    if (docId && map.has(docId)) {
      map.get(docId)!.push(puzzle);
      continue;
    }
    const firstCw = documents.find((d) => d.moduleType === 'crossword');
    if (firstCw) {
      if (!map.has(firstCw.id)) map.set(firstCw.id, []);
      map.get(firstCw.id)!.push(puzzle);
    }
  }

  // Keep document order stable for pagination.
  for (const [docId, list] of map) {
    map.set(
      docId,
      [...list].sort(
        (a, b) => (a.puzzleIndexInDocument ?? 0) - (b.puzzleIndexInDocument ?? 0)
      )
    );
  }

  // Ensure every crossword document in documents has generated puzzles if missing
  for (const doc of documents) {
    if (doc.moduleType === 'crossword' && (map.get(doc.id)?.length ?? 0) === 0) {
      map.set(doc.id, buildCrosswordPuzzlesForDocumentPage(doc));
    }
  }
  return map;
}

/** Group generated Murdoku puzzles by their Murdoku document id. */
export function groupMurdokuPuzzlesByDocument(
  puzzles: MurdokuPuzzle[],
  documents: DocumentPage[]
): Map<string, MurdokuPuzzle[]> {
  const map = new Map<string, MurdokuPuzzle[]>();
  for (const doc of documents) {
    if (doc.moduleType === 'murdoku') map.set(doc.id, []);
  }

  for (const puzzle of puzzles) {
    const docId = puzzle.pageId;
    if (docId && map.has(docId)) {
      map.get(docId)!.push(puzzle);
      continue;
    }
    const first = documents.find((d) => d.moduleType === 'murdoku');
    if (first) {
      if (!map.has(first.id)) map.set(first.id, []);
      map.get(first.id)!.push(puzzle);
    }
  }

  for (const [docId, list] of map) {
    map.set(
      docId,
      [...list].sort(
        (a, b) => (a.puzzleIndexInDocument ?? 0) - (b.puzzleIndexInDocument ?? 0)
      )
    );
  }
  return map;
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
