/**
 * Apply a parsed ContentPack onto GenPuzzle document tabs / platform word lists.
 */

import type { DocumentPage, PuzzleModuleSettings, PuzzleModuleType } from '@/lib/document-model';
import { isPuzzleModuleSettings } from '@/lib/document-model';
import { buildBookStructurePages } from './build-book-structure';
import type {
  ContentPack,
  ContentPackPuzzle,
  ContentPackPuzzleKind,
} from './content-pack';
import type { TitleWordsSettings } from '@/lib/puzzles/types';

export type ContentPackApplyMode = 'active' | 'matching' | 'rebuild';

/** Prefer lighter generators first so rebuild doesn't open on crossword. */
const ACTIVE_KIND_PRIORITY: ContentPackPuzzleKind[] = [
  'word-search',
  'word-scramble',
  'word-fill',
  'cryptogram',
  'maze',
  'sudoku',
  'crossword',
];

function pickPreferredActiveId(
  pages: DocumentPage[],
  kinds: ContentPackPuzzleKind[]
): string | null {
  for (const kind of ACTIVE_KIND_PRIORITY) {
    if (!kinds.includes(kind)) continue;
    const page = pages.find((p) => p.moduleType === kind);
    if (page) return page.id;
  }
  return pages.find((p) => kinds.includes(p.moduleType as ContentPackPuzzleKind))?.id ?? null;
}

export interface ContentPackApplyResult {
  ok: boolean;
  message: string;
  pages?: DocumentPage[];
  activeDocumentId?: string | null;
  chapterTitles?: string[];
  titleWords?: TitleWordsSettings;
  regenerate?: boolean;
  applyToAllMatching?: boolean;
  updatedDocumentIds?: string[];
}

function median(nums: number[], fallback: number): number {
  if (!nums.length) return fallback;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || fallback;
}

function puzzlesForChapter(
  puzzles: ContentPackPuzzle[],
  chapterIndex?: number
): ContentPackPuzzle[] {
  if (chapterIndex == null || chapterIndex < 0) return puzzles;
  const chapterNumber = chapterIndex + 1;
  const filtered = puzzles.filter(
    (p) => p.chapterIndex == null || p.chapterIndex === chapterNumber
  );
  return filtered.length ? filtered : puzzles;
}

function wordsPerPuzzle(puzzles: ContentPackPuzzle[], fallback: number): number {
  const counts = puzzles
    .map((p) => (p.words?.length || p.answers?.length || 0))
    .filter((n) => n > 0);
  return Math.max(1, Math.min(40, median(counts, fallback)));
}

function titlesText(puzzles: ContentPackPuzzle[]): string {
  return puzzles.map((p) => p.title || 'Puzzle').join('\n');
}

function funFactsText(puzzles: ContentPackPuzzle[]): string {
  return puzzles.map((p) => p.funFact || p.phrase || '').join('\n');
}

function flattenWords(puzzles: ContentPackPuzzle[]): string[] {
  const out: string[] = [];
  for (const p of puzzles) {
    if (p.words?.length) out.push(...p.words);
    else if (p.answers?.length) out.push(...p.answers);
  }
  return out.map((w) => w.trim()).filter(Boolean);
}

function applyToWordSearch(
  settings: PuzzleModuleSettings,
  puzzles: ContentPackPuzzle[]
): { settings: PuzzleModuleSettings; words: string[] } {
  const words = flattenWords(puzzles);
  const per = wordsPerPuzzle(puzzles, 15);
  const ws = settings.wordSearchSettings
    ? { ...settings.wordSearchSettings }
    : null;
  if (!ws) return { settings, words };
  ws.core = {
    ...ws.core,
    numberOfPuzzles: Math.max(1, puzzles.length),
  };
  ws.wordList = {
    ...ws.wordList,
    selectWordListOption: 'manual',
    wordsPerPuzzle: per,
  };
  ws.typography = {
    ...ws.typography,
    selectTitleOption: 'custom',
    titleText: titlesText(puzzles) || ws.typography.titleText,
    funFactsText: funFactsText(puzzles) || ws.typography.funFactsText,
    includeFunFacts: funFactsText(puzzles)
      ? false
      : ws.typography.includeFunFacts,
  };
  settings.wordSearchSettings = ws;
  settings.titleWords = {
    ...(settings.titleWords || {
      title: 'Word Search',
      fontFamily: 'Arial',
      fontSize: 24,
      words: [],
    }),
    words,
    title: puzzles[0]?.title || settings.titleWords?.title || 'Word Search',
  };
  return { settings, words };
}

function applyToCrossword(
  settings: PuzzleModuleSettings,
  puzzles: ContentPackPuzzle[]
): PuzzleModuleSettings {
  const cw = settings.crosswordSettings ? { ...settings.crosswordSettings } : null;
  if (!cw) return settings;
  const clues: string[] = [];
  const answers: string[] = [];
  for (const p of puzzles) {
    const n = Math.max(p.clues?.length || 0, p.answers?.length || 0);
    for (let i = 0; i < n; i++) {
      clues.push((p.clues?.[i] || '').trim());
      answers.push((p.answers?.[i] || p.words?.[i] || '').trim());
    }
  }
  const per = wordsPerPuzzle(puzzles, 15);
  cw.core = {
    ...cw.core,
    numberOfPuzzles: Math.max(1, puzzles.length),
    cluesPerPuzzle: per,
    cluesText: clues.join('\n'),
    answersText: answers.join('\n'),
  };
  const titles = titlesText(puzzles);
  cw.typography = {
    ...cw.typography,
    selectTitleOption: 'custom',
    differentTitles: titles,
    titleText: titles || cw.typography.titleText,
  };
  settings.crosswordSettings = cw;
  return settings;
}

function applyToGeneric(
  settings: PuzzleModuleSettings,
  kind: ContentPackPuzzleKind,
  puzzles: ContentPackPuzzle[]
): PuzzleModuleSettings {
  const gp = settings.genericPuzzleSettings
    ? { ...settings.genericPuzzleSettings }
    : null;
  if (!gp) return settings;
  const per = wordsPerPuzzle(puzzles, kind === 'word-scramble' || kind === 'word-fill' ? 10 : 15);
  gp.core = {
    ...gp.core,
    numberOfPuzzles: Math.max(1, puzzles.length),
  };
  gp.typography = {
    ...gp.typography,
    selectTitleOption: 'custom_per_puzzle',
    differentTitles: titlesText(puzzles),
    titleText: puzzles[0]?.title || gp.typography.titleText,
    funFactsText: funFactsText(puzzles) || gp.typography.funFactsText,
    includeFunFacts: funFactsText(puzzles) ? false : gp.typography.includeFunFacts,
  };

  if (kind === 'cryptogram') {
    const phrases = puzzles
      .map((p) => p.phrase || p.funFact || '')
      .filter(Boolean)
      .join('\n');
    gp.core = { ...gp.core, cryptogramPhrases: phrases };
  } else if (kind === 'word-scramble') {
    gp.core = {
      ...gp.core,
      wordsPerPuzzle: per,
      scrambleWords: flattenWords(puzzles).join('\n'),
    };
  } else if (kind === 'word-fill') {
    gp.core = {
      ...gp.core,
      fillWordsPerPuzzle: per,
      fillWordsText: flattenWords(puzzles).join('\n'),
    };
  } else if (kind === 'maze') {
    // Titles + optional fun-fact style hints from start/end image text.
    const hints = puzzles
      .map((p) =>
        [p.startImageHint, p.endImageHint].filter(Boolean).join(' → ')
      )
      .join('\n');
    if (hints.trim()) {
      gp.typography = {
        ...gp.typography,
        funFactsText: hints,
        includeFunFacts: false,
      };
    }
  }

  settings.genericPuzzleSettings = gp;
  return settings;
}

export function applyContentPackToDocument(
  page: DocumentPage,
  pack: ContentPack,
  kinds?: ContentPackPuzzleKind[]
): { page: DocumentPage; words?: string[]; appliedKind?: ContentPackPuzzleKind } | null {
  const type = page.moduleType as ContentPackPuzzleKind;
  if (kinds && kinds.length && !kinds.includes(type)) return null;
  const puzzlesAll = pack.byType[type];
  if (!puzzlesAll?.length) return null;
  if (!isPuzzleModuleSettings(page.settings)) return null;

  const chapterIndex =
    typeof (page.settings as PuzzleModuleSettings).chapterIndex === 'number'
      ? (page.settings as PuzzleModuleSettings).chapterIndex
      : undefined;
  const puzzles = puzzlesForChapter(puzzlesAll, chapterIndex);
  let settings: PuzzleModuleSettings = { ...(page.settings as PuzzleModuleSettings) };
  let words: string[] | undefined;

  if (type === 'word-search') {
    const result = applyToWordSearch(settings, puzzles);
    settings = result.settings;
    words = result.words;
  } else if (type === 'crossword') {
    settings = applyToCrossword(settings, puzzles);
  } else if (
    type === 'cryptogram' ||
    type === 'word-scramble' ||
    type === 'word-fill' ||
    type === 'maze'
  ) {
    settings = applyToGeneric(settings, type, puzzles);
  } else {
    return null;
  }

  return {
    page: { ...page, settings },
    words,
    appliedKind: type,
  };
}

export function planContentPackApply(args: {
  pack: ContentPack;
  mode: ContentPackApplyMode;
  pages: DocumentPage[];
  activeDocumentId?: string | null;
  kinds?: ContentPackPuzzleKind[];
  bookTitle?: string;
}): ContentPackApplyResult {
  const { pack, mode, kinds } = args;
  const availableKinds = (Object.keys(pack.byType) as ContentPackPuzzleKind[]).filter(
    (k) => (pack.byType[k]?.length || 0) > 0 && (!kinds?.length || kinds.includes(k))
  );
  if (!availableKinds.length) {
    return { ok: false, message: 'No matching puzzle content in the uploaded file.' };
  }

  if (mode === 'rebuild') {
    const chapterTitles =
      pack.chapters.length > 0
        ? pack.chapters.map((c) => c.title)
        : ['Chapter 1'];
    const puzzleTypes = availableKinds as PuzzleModuleType[];
    // Average puzzles per chapter for sizing each document tab.
    const counts = availableKinds.map((k) => {
      const list = pack.byType[k] || [];
      if (!pack.chapters.length) return list.length;
      const perChapter = pack.chapters.map((ch) =>
        list.filter((p) => p.chapterIndex == null || p.chapterIndex === ch.index).length
      );
      return median(perChapter.filter((n) => n > 0), Math.max(1, Math.round(list.length / pack.chapters.length)));
    });
    const perDoc = Math.max(1, Math.min(50, median(counts, 1)));
    const built = buildBookStructurePages({
      bookTitle: args.bookTitle || pack.sourceName.replace(/\.[^.]+$/, ''),
      subtitle: 'From uploaded content pack',
      chapterCount: chapterTitles.length,
      chapterTitles,
      puzzleTypesPerChapter: puzzleTypes,
      puzzlesPerTypeDocument: perDoc,
      replaceExisting: true,
    });

    const updatedIds: string[] = [];
    let titleWords: TitleWordsSettings | undefined;
    const pages = built.pages.map((page) => {
      const applied = applyContentPackToDocument(page, pack, availableKinds);
      if (!applied) return page;
      updatedIds.push(applied.page.id);
      if (applied.words && applied.appliedKind === 'word-search' && !titleWords) {
        titleWords = {
          title: applied.page.name,
          fontFamily: 'Arial',
          fontSize: 24,
          words: applied.words,
        };
      }
      return applied.page;
    });

    return {
      ok: true,
      message: `Rebuilt book from ${pack.sourceName}: ${built.summary}. Applied content to ${updatedIds.length} puzzle tab(s). Regenerate to build grids.`,
      pages,
      activeDocumentId: pickPreferredActiveId(pages, availableKinds),
      chapterTitles,
      titleWords,
      regenerate: true,
      applyToAllMatching: true,
      updatedDocumentIds: updatedIds,
    };
  }

  if (mode === 'active') {
    const active =
      args.pages.find((p) => p.id === args.activeDocumentId) ??
      args.pages.find((p) => availableKinds.includes(p.moduleType as ContentPackPuzzleKind));
    if (!active) {
      return {
        ok: false,
        message: `No active puzzle tab matches the upload (have: ${availableKinds.join(', ')}).`,
      };
    }
    const applied = applyContentPackToDocument(active, pack, availableKinds);
    if (!applied) {
      return {
        ok: false,
        message: `Active tab “${active.name}” (${active.moduleType}) has no matching sheet in the file.`,
      };
    }
    const pages = args.pages.map((p) => (p.id === applied.page.id ? applied.page : p));
    return {
      ok: true,
      message: `Applied ${pack.sourceName} to “${applied.page.name}” (${applied.appliedKind}). Regenerate to rebuild puzzles.`,
      pages,
      activeDocumentId: applied.page.id,
      titleWords:
        applied.words && applied.appliedKind === 'word-search'
          ? {
              title: applied.page.name,
              fontFamily: 'Arial',
              fontSize: 24,
              words: applied.words,
            }
          : undefined,
      regenerate: true,
      updatedDocumentIds: [applied.page.id],
    };
  }

  // matching
  const updatedIds: string[] = [];
  let titleWords: TitleWordsSettings | undefined;
  const pages = args.pages.map((page) => {
    const applied = applyContentPackToDocument(page, pack, availableKinds);
    if (!applied) return page;
    updatedIds.push(applied.page.id);
    if (applied.words && applied.appliedKind === 'word-search' && !titleWords) {
      titleWords = {
        title: applied.page.name,
        fontFamily: 'Arial',
        fontSize: 24,
        words: applied.words,
      };
    }
    return applied.page;
  });
  if (!updatedIds.length) {
    return {
      ok: false,
      message: `No open document tabs match the upload types (${availableKinds.join(', ')}). Choose option 3 to rebuild the book, or add those puzzle tabs first.`,
    };
  }
  return {
    ok: true,
    message: `Applied ${pack.sourceName} to ${updatedIds.length} matching tab(s). Regenerate to rebuild puzzles.`,
    pages,
    activeDocumentId: args.activeDocumentId,
    titleWords,
    regenerate: true,
    applyToAllMatching: true,
    updatedDocumentIds: updatedIds,
  };
}
