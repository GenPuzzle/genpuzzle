/**
 * Split one Word Search / Crossword document into N chapter documents,
 * each with its own word/title/fun-fact slice and starting puzzle number.
 */

import {
  createDocumentPage,
  isPuzzleModuleType,
  PUZZLE_MODULES,
  type DocumentPage,
  type PuzzleModuleSettings,
  type TextModuleSettings,
} from './document-model';
import { isChapterTitlePage } from './insert-separator-page';
import {
  CHAPTER_PAGE_STYLE_STORAGE_KEY,
  countChapterTitlePages,
  createStyledChapterDocumentPage,
  normalizeChapterPageStyle,
  type ChapterPageStyleSettings,
} from './chapter-page-layouts';
import { getExistingChapterTitleLines } from './batch-chapter-pages';
import {
  ensureChapterTitles,
  readChapterTitlesDraft,
  readDivideListsPreference,
  type DivideListsPreference,
} from './chapter-titles-draft';
import { getEffectiveWordsPerPuzzle } from './puzzle-word-list';
import { parseCrosswordLines } from './crossword-settings';

export interface SplitIntoChaptersRequest {
  chapterCount: number;
  chapterTitles: string[];
}

export interface ChapterSplitPlan {
  chapterCount: number;
  puzzleCounts: number[];
  startingNumbers: number[];
  chapterTitles: string[];
}

export interface SplitPuzzleByChaptersResult {
  documentPages: DocumentPage[];
  sourceDocumentId: string;
  puzzleDocIds: string[];
  firstPuzzleDocId: string;
  plan: ChapterSplitPlan;
}

export function evenChapterPuzzleCounts(totalPuzzles: number, chapterCount: number): number[] {
  const chapters = Math.max(1, Math.round(chapterCount) || 1);
  const total = Math.max(0, Math.round(totalPuzzles) || 0);
  const base = Math.floor(total / chapters);
  const remainder = total % chapters;
  return Array.from({ length: chapters }, (_, i) => base + (i < remainder ? 1 : 0));
}

export function chapterStartingNumbers(counts: number[], bookStart: number): number[] {
  const starts: number[] = [];
  let next = Math.max(1, Math.round(bookStart) || 1);
  for (const count of counts) {
    starts.push(next);
    next += Math.max(0, count);
  }
  return starts;
}

export function sliceContentLines(text: string | undefined, start: number, count: number): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  return lines.slice(Math.max(0, start), Math.max(0, start) + Math.max(0, count)).join('\n');
}

export function sliceNonEmptyLines(text: string | undefined, start: number, count: number): string {
  const lines = parseCrosswordLines(text);
  return lines.slice(Math.max(0, start), Math.max(0, start) + Math.max(0, count)).join('\n');
}

export function formatDivideListsLabel(chapterCount: number, counts: number[]): string {
  if (counts.length === 0) {
    return `Divide lists into ${chapterCount} chapters`;
  }
  const even = counts.every((count) => count === counts[0]);
  if (even) {
    const n = counts[0];
    return `Divide lists into ${chapterCount} chapters (${n} puzzle${n === 1 ? '' : 's'} each)`;
  }
  return `Divide lists into ${chapterCount} chapters (${counts.join(', ')} puzzles)`;
}

export function formatStartingNumberHint(starts: number[], counts: number[]): string {
  if (starts.length === 0 || counts.length === 0) return '';
  const ranges = starts.map((start, i) => {
    const count = Math.max(1, counts[i] ?? 1);
    return `${start}–${start + count - 1}`;
  });
  if (ranges.length <= 4) return `Starting numbers: ${ranges.join(', ')}`;
  return `Starting numbers: ${ranges[0]}, ${ranges[1]}, … ${ranges[ranges.length - 1]}`;
}

export function puzzleDocumentRangeName(moduleType: DocumentPage['moduleType'], start: number, count: number): string {
  const label = PUZZLE_MODULES.find((item) => item.type === moduleType)?.name ?? 'Puzzles';
  const end = start + Math.max(1, count) - 1;
  return `${label} · ${start}–${end}`;
}

function readStoredChapterStyle(): ChapterPageStyleSettings {
  if (typeof window === 'undefined') return normalizeChapterPageStyle(null);
  try {
    const raw = window.localStorage.getItem(CHAPTER_PAGE_STYLE_STORAGE_KEY);
    return normalizeChapterPageStyle(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeChapterPageStyle(null);
  }
}

export function resolveChapterSplitSource(
  documents: DocumentPage[],
  preference: DivideListsPreference
): { chapterCount: number; chapterTitles: string[]; fromExistingPages: boolean; countIsLocked: boolean } {
  const existingTitles = getExistingChapterTitleLines(documents);
  if (existingTitles.length >= 2) {
    return {
      chapterCount: existingTitles.length,
      chapterTitles: existingTitles,
      fromExistingPages: true,
      countIsLocked: true,
    };
  }
  const draft = readChapterTitlesDraft();
  if (draft.touched && draft.titles.length >= 2) {
    return {
      chapterCount: draft.titles.length,
      chapterTitles: draft.titles,
      fromExistingPages: false,
      countIsLocked: true,
    };
  }
  const chapterCount = Math.max(2, Math.round(preference.chapterCount) || 2);
  return {
    chapterCount,
    chapterTitles: ensureChapterTitles(draft.titles, chapterCount),
    fromExistingPages: false,
    countIsLocked: false,
  };
}

export function canShowDivideListsOption(args: {
  numberOfPuzzles: number;
  chapterCount: number;
  alreadySplit?: boolean;
}): boolean {
  if (args.alreadySplit) return false;
  return args.numberOfPuzzles >= 2 && args.chapterCount >= 2 && args.numberOfPuzzles >= args.chapterCount;
}

export function resolveActiveSplitRequest(args: {
  documents: DocumentPage[];
  numberOfPuzzles: number;
  puzzlesStartingNumber?: number;
  alreadySplit?: boolean;
}): SplitIntoChaptersRequest | null {
  const pref = readDivideListsPreference();
  if (!pref.enabled) return null;
  const numPuzzles = Math.max(0, Math.round(args.numberOfPuzzles) || 0);
  if (numPuzzles < 2 || args.alreadySplit) return null;
  const source = resolveChapterSplitSource(args.documents, pref);
  const chapterCount = Math.max(2, Math.min(numPuzzles, pref.chapterCount || source.chapterCount));
  const plan = buildChapterSplitPlan({
    numberOfPuzzles: numPuzzles,
    chapterCount,
    chapterTitles: source.chapterTitles,
    puzzlesStartingNumber: args.puzzlesStartingNumber,
    customPuzzleCounts: pref.customPuzzleCounts,
  });
  if (!plan) return null;
  return {
    chapterCount: plan.chapterCount,
    chapterTitles: plan.chapterTitles,
  };
}

export function buildChapterSplitPlan(args: {
  numberOfPuzzles: number;
  chapterCount: number;
  chapterTitles: string[];
  puzzlesStartingNumber?: number;
  customPuzzleCounts?: number[];
}): ChapterSplitPlan | null {
  const chapterCount = Math.max(2, Math.round(args.chapterCount) || 2);
  const numberOfPuzzles = Math.max(0, Math.round(args.numberOfPuzzles) || 0);
  if (numberOfPuzzles < chapterCount) return null;
  let puzzleCounts: number[];
  if (
    args.customPuzzleCounts &&
    args.customPuzzleCounts.length === chapterCount &&
    args.customPuzzleCounts.reduce((a, b) => a + b, 0) === numberOfPuzzles &&
    args.customPuzzleCounts.every((count) => count >= 1)
  ) {
    puzzleCounts = [...args.customPuzzleCounts];
  } else {
    puzzleCounts = evenChapterPuzzleCounts(numberOfPuzzles, chapterCount);
  }
  if (puzzleCounts.some((count) => count < 1)) return null;
  return {
    chapterCount,
    puzzleCounts,
    startingNumbers: chapterStartingNumbers(puzzleCounts, args.puzzlesStartingNumber ?? 1),
    chapterTitles: ensureChapterTitles(args.chapterTitles, chapterCount),
  };
}

function clonePuzzleDocumentForChapter(
  source: DocumentPage,
  chapterIndex: number,
  puzzleCount: number,
  startingNumber: number,
  puzzleOffset: number
): DocumentPage {
  const page = createDocumentPage(source.moduleType);
  const settings = structuredClone(source.settings) as PuzzleModuleSettings;
  settings.chapterIndex = chapterIndex;
  settings.title = puzzleDocumentRangeName(source.moduleType, startingNumber, puzzleCount);
  page.name = settings.title;

  if (settings.wordSearchSettings) {
    const ws = settings.wordSearchSettings;
    const wordsPerPuzzle = getEffectiveWordsPerPuzzle(ws.wordList);
    ws.core = {
      ...ws.core,
      numberOfPuzzles: puzzleCount,
      puzzlesStartingNumber: startingNumber,
      shapeMaskImages: ws.core.shapeMaskImages?.length
        ? ws.core.shapeMaskImages.slice(puzzleOffset, puzzleOffset + puzzleCount)
        : ws.core.shapeMaskImages,
    };
    if (ws.typography.selectTitleOption === 'custom' || (ws.typography.titleText || '').includes('\n')) {
      ws.typography.titleText = sliceContentLines(ws.typography.titleText, puzzleOffset, puzzleCount);
    }
    ws.typography.funFactsText = sliceContentLines(ws.typography.funFactsText, puzzleOffset, puzzleCount);
    if (settings.titleWords?.words) {
      settings.titleWords = {
        ...settings.titleWords,
        words: settings.titleWords.words.slice(
          puzzleOffset * wordsPerPuzzle,
          (puzzleOffset + puzzleCount) * wordsPerPuzzle
        ),
      };
    }
  }

  if (settings.crosswordSettings) {
    const cw = settings.crosswordSettings;
    const cluesPerPuzzle = Math.max(1, cw.core.cluesPerPuzzle || 15);
    cw.core = {
      ...cw.core,
      numberOfPuzzles: puzzleCount,
      puzzlesStartingNumber: startingNumber,
      answersText: sliceNonEmptyLines(
        cw.core.answersText,
        puzzleOffset * cluesPerPuzzle,
        puzzleCount * cluesPerPuzzle
      ),
      cluesText: sliceNonEmptyLines(
        cw.core.cluesText,
        puzzleOffset * cluesPerPuzzle,
        puzzleCount * cluesPerPuzzle
      ),
    };
    if (
      cw.typography.selectTitleOption === 'different-titles' ||
      cw.typography.selectTitleOption === 'custom' ||
      (cw.typography.differentTitles || '').includes('\n') ||
      (cw.typography.titleText || '').includes('\n')
    ) {
      cw.typography.differentTitles = sliceContentLines(
        cw.typography.differentTitles || cw.typography.titleText,
        puzzleOffset,
        puzzleCount
      );
      if ((cw.typography.titleText || '').includes('\n')) {
        cw.typography.titleText = sliceContentLines(cw.typography.titleText, puzzleOffset, puzzleCount);
      }
    }
    cw.typography.funFactsText = sliceContentLines(cw.typography.funFactsText, puzzleOffset, puzzleCount);
    if (settings.titleWords?.words?.length) {
      settings.titleWords = {
        ...settings.titleWords,
        words: settings.titleWords.words.slice(
          puzzleOffset * cluesPerPuzzle,
          (puzzleOffset + puzzleCount) * cluesPerPuzzle
        ),
      };
    }
  }

  page.settings = settings;
  return page;
}

function puzzleDocChapterIndex(page: DocumentPage): number | undefined {
  if (!isPuzzleModuleType(page.moduleType)) return undefined;
  const index = (page.settings as PuzzleModuleSettings).chapterIndex;
  return typeof index === 'number' && Number.isFinite(index) ? index : undefined;
}

export function splitPuzzleDocumentByChapters(args: {
  documents: DocumentPage[];
  sourceDocumentId: string;
  plan: ChapterSplitPlan;
  chapterStyle?: Partial<ChapterPageStyleSettings> | null;
}): SplitPuzzleByChaptersResult | null {
  const source = args.documents.find((doc) => doc.id === args.sourceDocumentId);
  if (!source || !isPuzzleModuleType(source.moduleType)) return null;
  if (source.moduleType !== 'word-search' && source.moduleType !== 'crossword') return null;

  const { plan } = args;
  const style = args.chapterStyle ?? readStoredChapterStyle();
  const existingChapters = args.documents.filter((doc) => isChapterTitlePage(doc));

  const puzzleDocs: DocumentPage[] = [];
  let puzzleOffset = 0;
  for (let i = 0; i < plan.chapterCount; i++) {
    const count = plan.puzzleCounts[i] ?? 0;
    const start = plan.startingNumbers[i] ?? 1;
    if (count < 1) continue;
    puzzleDocs.push(clonePuzzleDocumentForChapter(source, i, count, start, puzzleOffset));
    puzzleOffset += count;
  }
  if (puzzleDocs.length === 0) return null;

  const chapterPages = plan.chapterTitles.map((title, i) => {
    const existing = existingChapters[i];
    if (existing) {
      const settings = existing.settings as TextModuleSettings;
      return {
        ...existing,
        settings: {
          ...settings,
          isChapterPage: true,
          chapterIndex: i,
        },
      };
    }
    const page = createStyledChapterDocumentPage(title.trim() || `Chapter ${i + 1}: `, style);
    (page.settings as TextModuleSettings).chapterIndex = i;
    return page;
  });

  const keep = args.documents.filter(
    (doc) => doc.id !== source.id && !isChapterTitlePage(doc)
  );
  const frontMatter = keep.filter((doc) => !isPuzzleModuleType(doc.moduleType));
  const otherPuzzleDocs = keep.filter((doc) => isPuzzleModuleType(doc.moduleType));

  const byChapter = new Map<number, DocumentPage[]>();
  const ungrouped: DocumentPage[] = [];
  for (const doc of otherPuzzleDocs) {
    const index = puzzleDocChapterIndex(doc);
    if (index != null && index >= 0 && index < plan.chapterCount) {
      const list = byChapter.get(index) ?? [];
      list.push(doc);
      byChapter.set(index, list);
    } else {
      ungrouped.push(doc);
    }
  }
  for (let i = 0; i < puzzleDocs.length; i++) {
    const list = byChapter.get(i) ?? [];
    list.push(puzzleDocs[i]);
    byChapter.set(i, list);
  }

  const documentPages: DocumentPage[] = [...frontMatter];
  for (let i = 0; i < plan.chapterCount; i++) {
    if (chapterPages[i]) documentPages.push(chapterPages[i]);
    documentPages.push(...(byChapter.get(i) ?? []));
  }
  documentPages.push(...ungrouped);

  return {
    documentPages,
    sourceDocumentId: source.id,
    puzzleDocIds: puzzleDocs.map((doc) => doc.id),
    firstPuzzleDocId: puzzleDocs[0].id,
    plan,
  };
}

export function documentLooksAlreadyChapterSplit(page: DocumentPage | null | undefined): boolean {
  if (!page || !isPuzzleModuleType(page.moduleType)) return false;
  const index = (page.settings as PuzzleModuleSettings).chapterIndex;
  return typeof index === 'number' && Number.isFinite(index);
}

export function existingChapterCount(documents: DocumentPage[]): number {
  return countChapterTitlePages(documents);
}
