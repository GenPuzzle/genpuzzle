/**
 * Shared content-pack apply + generate helpers (AI chat + new-project wizard).
 */

import type { DocumentPage } from '@/lib/document-model';
import { isPuzzleModuleSettings } from '@/lib/document-model';
import { normalizeCrosswordSettings } from '@/lib/crossword-settings';
import {
  isGenericPuzzleModuleType,
  normalizeGenericPuzzleSettings,
} from '@/lib/generic-puzzle-settings';
import type { TitleWordsSettings } from '@/lib/puzzles/types';
import type { CrosswordSettings } from '@/lib/crossword-settings';
import type { GenericPuzzleSettings } from '@/lib/generic-puzzle-settings';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import {
  planContentPackApply,
  type ContentPackApplyMode,
} from './apply-content-pack';
import type { ContentPack, ContentPackPuzzleKind } from './content-pack';
import {
  writeChapterTitlesDraft,
  writeDivideListsPreference,
} from '@/lib/chapter-titles-draft';

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    throw err;
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export interface ContentPackAppActions {
  getDocumentPages: () => DocumentPage[];
  replaceDocumentPages: (pages: DocumentPage[], activeId?: string | null) => void;
  setBookSettings: (patch: Record<string, unknown>) => void;
  getBookSettings: () => Record<string, unknown>;
  setProjectName?: (name: string) => void;
  setTitleWords: (next: TitleWordsSettings) => void;
  setActiveDocumentPageId: (id: string) => void;
  setCrosswordSettings: (settings: CrosswordSettings) => void;
  setGenericPuzzleSettings: (settings: GenericPuzzleSettings) => void;
  updateWordSearchSettings: (
    patch: Partial<WordSearchSettings>,
    options?: { recordHistory?: boolean }
  ) => void;
  regenerateWordSearchDocuments: (pages: DocumentPage[]) => Promise<void>;
  generatePuzzle: (options?: { clearPageCustomizations?: boolean }) => void | Promise<void>;
  pushEditHistory?: () => void;
}

const GEN_PRIORITY = [
  'word-scramble',
  'word-fill',
  'cryptogram',
  'maze',
  'sudoku',
  'crossword',
] as const;

function syncLiveSettingsFromPage(
  app: ContentPackAppActions,
  page: DocumentPage
): void {
  if (!isPuzzleModuleSettings(page.settings)) return;
  const settings = page.settings;
  if (settings.titleWords) app.setTitleWords(settings.titleWords);
  if (settings.wordSearchSettings) {
    app.updateWordSearchSettings(settings.wordSearchSettings, { recordHistory: false });
  }
  if (settings.crosswordSettings) {
    app.setCrosswordSettings(normalizeCrosswordSettings(settings.crosswordSettings));
  }
  if (settings.genericPuzzleSettings && isGenericPuzzleModuleType(page.moduleType)) {
    app.setGenericPuzzleSettings(
      normalizeGenericPuzzleSettings(settings.genericPuzzleSettings, page.moduleType)
    );
  }
}

/**
 * Apply uploaded lists into document settings (fast), then generate puzzles with
 * progress callbacks and optional AbortSignal.
 */
export async function runContentPackImport(args: {
  pack: ContentPack;
  mode: ContentPackApplyMode;
  app: ContentPackAppActions;
  kinds?: ContentPackPuzzleKind[];
  bookTitle?: string;
  activeDocumentId?: string | null;
  signal?: AbortSignal;
  onProgress?: (label: string, progressPct?: number) => void;
  /** When false, only copy lists into settings (no grid generation). Default true. */
  generate?: boolean;
}): Promise<{ ok: boolean; message: string; cancelled?: boolean; error?: string }> {
  const { pack, mode, app, signal, onProgress } = args;
  const generate = args.generate !== false;

  onProgress?.('Copying words, clues & fun facts into settings…', 4);
  await yieldToUi();
  throwIfAborted(signal);

  const planned = planContentPackApply({
    pack,
    mode,
    pages: app.getDocumentPages(),
    activeDocumentId: args.activeDocumentId ?? null,
    kinds: args.kinds,
    bookTitle: args.bookTitle,
  });

  if (!planned.ok || !planned.pages) {
    return { ok: false, message: planned.message, error: planned.message };
  }

  throwIfAborted(signal);
  onProgress?.('Updating puzzle tabs…', 12);
  await yieldToUi();

  app.pushEditHistory?.();
  app.replaceDocumentPages(planned.pages, planned.activeDocumentId);

  if (planned.chapterTitles?.length) {
    app.setBookSettings({
      ...app.getBookSettings(),
      mixPuzzles: true,
      chapterTopics: planned.chapterTitles,
    });
    writeChapterTitlesDraft({ titles: planned.chapterTitles, touched: true });
    writeDivideListsPreference({
      enabled: true,
      chapterCount: Math.max(2, planned.chapterTitles.length),
    });
  }
  if (args.bookTitle || pack.sourceName) {
    app.setProjectName?.(
      args.bookTitle || pack.sourceName.replace(/\.[^.]+$/, '') || 'Puzzle Book'
    );
  }
  if (planned.titleWords) app.setTitleWords(planned.titleWords);

  const active =
    planned.pages.find((p) => p.id === planned.activeDocumentId) ??
    planned.pages.find((p) => p.moduleType === 'word-search');
  if (active) syncLiveSettingsFromPage(app, active);

  onProgress?.('Word lists applied.', 18);
  await yieldToUi();
  throwIfAborted(signal);

  if (!generate) {
    return {
      ok: true,
      message: `${planned.message} Settings updated (generate skipped).`,
    };
  }

  const ids = planned.updatedDocumentIds || [];
  const sourcePages = planned.pages;

  // Word Search batch (fast)
  const wsPages = sourcePages.filter(
    (p) => p.moduleType === 'word-search' && ids.includes(p.id)
  );
  if (wsPages.length) {
    onProgress?.(`Generating Word Search (${wsPages.length} tab(s))…`, 25);
    await yieldToUi();
    throwIfAborted(signal);
    await app.regenerateWordSearchDocuments(wsPages);
    await yieldToUi();
  }

  const otherIds = ids.filter((id) => {
    const page = sourcePages.find((p) => p.id === id);
    return page && page.moduleType !== 'word-search';
  });
  otherIds.sort((a, b) => {
    const pa = sourcePages.find((p) => p.id === a)?.moduleType || '';
    const pb = sourcePages.find((p) => p.id === b)?.moduleType || '';
    const ia = GEN_PRIORITY.indexOf(pa as (typeof GEN_PRIORITY)[number]);
    const ib = GEN_PRIORITY.indexOf(pb as (typeof GEN_PRIORITY)[number]);
    return (ia < 0 ? 50 : ia) - (ib < 0 ? 50 : ib);
  });

  for (let i = 0; i < otherIds.length; i++) {
    throwIfAborted(signal);
    const id = otherIds[i]!;
    const page = sourcePages.find((p) => p.id === id);
    if (!page) continue;
    const pct = 30 + Math.round(((i + 1) / Math.max(1, otherIds.length)) * 70);
    onProgress?.(
      `Generating ${page.name} (${i + 1}/${otherIds.length})…`,
      Math.min(99, pct)
    );
    app.setActiveDocumentPageId(id);
    await yieldToUi();
    syncLiveSettingsFromPage(app, page);
    await yieldToUi();
    await yieldToUi();
    throwIfAborted(signal);
    await app.generatePuzzle({ clearPageCustomizations: true });
    await yieldToUi();
  }

  onProgress?.('Done.', 100);
  return {
    ok: true,
    message: `${planned.message} Puzzles generated.`,
  };
}
