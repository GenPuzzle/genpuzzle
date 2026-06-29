import type { TitleWordsSettings, WordSearchPuzzle, WordSearchSettings } from '@/lib/puzzles/types';

export type CanvasEditTarget =
  | 'title'
  | 'grid'
  | 'word-list'
  | 'page-number'
  | 'page-background'
  | 'solution-title'
  | 'solution-grid';

export const CANVAS_EDIT_TARGET_CATEGORY: Record<CanvasEditTarget, string> = {
  title: 'typography',
  grid: 'grid',
  'word-list': 'wordList',
  'page-number': 'typography',
  'page-background': 'colors',
  'solution-title': 'typography',
  'solution-grid': 'grid',
};

export interface CanvasEditSnapshot {
  settings: WordSearchSettings;
  titleWords: TitleWordsSettings;
  puzzleGridScale: number;
  batchPuzzle: WordSearchPuzzle | null;
}

export interface CanvasEditSession {
  draft: WordSearchSettings;
  draftTitleWords: TitleWordsSettings;
  draftPuzzleGridScale: number;
  snapshot: CanvasEditSnapshot;
}

export function hasUnsavedCanvasEdits(session: CanvasEditSession | null): boolean {
  if (!session) return false;
  if (session.draftPuzzleGridScale !== session.snapshot.puzzleGridScale) return true;
  if (JSON.stringify(session.draftTitleWords) !== JSON.stringify(session.snapshot.titleWords)) {
    return true;
  }
  if (JSON.stringify(session.draft) !== JSON.stringify(session.snapshot.settings)) {
    return true;
  }
  return false;
}

export function hasWordListEdits(session: CanvasEditSession): boolean {
  return JSON.stringify(session.draftTitleWords) !== JSON.stringify(session.snapshot.titleWords);
}

/** True when draft settings differ from snapshot, ignoring word-list manual-mode side effects. */
export function hasSettingsEditsBeyondWordContent(session: CanvasEditSession): boolean {
  const normalizedDraft: WordSearchSettings = {
    ...session.draft,
    wordList: {
      ...session.draft.wordList,
      selectWordListOption: session.snapshot.settings.wordList.selectWordListOption,
    },
  };
  return JSON.stringify(normalizedDraft) !== JSON.stringify(session.snapshot.settings);
}

/** Apply-to-all is for shared styling/settings — not per-page word list content. */
export function canApplyCanvasEditsToAllPages(session: CanvasEditSession | null): boolean {
  if (!session || !hasUnsavedCanvasEdits(session)) return false;
  if (session.draftPuzzleGridScale !== session.snapshot.puzzleGridScale) return true;
  return hasSettingsEditsBeyondWordContent(session);
}

export function hasGridSizeEdits(session: CanvasEditSession): boolean {
  return (
    session.draft.core.lettersAcross !== session.snapshot.settings.core.lettersAcross ||
    session.draft.core.lettersDown !== session.snapshot.settings.core.lettersDown
  );
}

export function shouldRegeneratePuzzleOnPageCommit(session: CanvasEditSession): boolean {
  return hasGridSizeEdits(session) || hasWordListEdits(session);
}

export function shouldRegeneratePuzzlesOnAllCommit(session: CanvasEditSession): boolean {
  return hasGridSizeEdits(session);
}

export function syncEditSessionBaseline(
  session: CanvasEditSession,
  batchPuzzle: WordSearchPuzzle | null
): CanvasEditSession {
  return {
    ...session,
    snapshot: {
      settings: cloneWordSearchSettings(session.draft),
      titleWords: cloneTitleWords(session.draftTitleWords),
      puzzleGridScale: session.draftPuzzleGridScale,
      batchPuzzle: batchPuzzle ? (JSON.parse(JSON.stringify(batchPuzzle)) as WordSearchPuzzle) : null,
    },
  };
}

export function cloneWordSearchSettings(settings: WordSearchSettings): WordSearchSettings {
  return JSON.parse(JSON.stringify(settings)) as WordSearchSettings;
}

export function cloneTitleWords(titleWords: TitleWordsSettings): TitleWordsSettings {
  return { ...titleWords, words: [...titleWords.words] };
}

export function patchWordSearchSettings(
  base: WordSearchSettings,
  updates: Partial<WordSearchSettings>
): WordSearchSettings {
  const next = { ...base };

  if (updates.bookCanvas) {
    next.bookCanvas = { ...base.bookCanvas, ...updates.bookCanvas };
  }
  if (updates.core) {
    next.core = { ...base.core, ...updates.core };
  }
  if (updates.typography) {
    next.typography = { ...base.typography, ...updates.typography };
  }
  if (updates.wordList) {
    next.wordList = { ...base.wordList, ...updates.wordList };
  }
  if (updates.colors) {
    next.colors = { ...base.colors };
    if (updates.colors.puzzlePage) {
      next.colors.puzzlePage = { ...base.colors.puzzlePage, ...updates.colors.puzzlePage };
    }
    if (updates.colors.answerPage) {
      next.colors.answerPage = { ...base.colors.answerPage, ...updates.colors.answerPage };
    }
  }
  if (updates.pageFrameSettings) {
    next.pageFrameSettings = { ...base.pageFrameSettings, ...updates.pageFrameSettings };
  }

  return next;
}

export function buildPageOverrideFromDraft(draft: WordSearchSettings): Partial<WordSearchSettings> {
  return {
    bookCanvas: draft.bookCanvas,
    core: draft.core,
    typography: draft.typography,
    wordList: draft.wordList,
    colors: draft.colors,
    pageFrameSettings: draft.pageFrameSettings,
  };
}

/** Compare draft vs global and store every section that changed during the edit session. */
export function buildPageOverrideDelta(
  global: WordSearchSettings,
  draft: WordSearchSettings
): Partial<WordSearchSettings> {
  const sectionChanged = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const override: Partial<WordSearchSettings> = {};

  if (sectionChanged(global.bookCanvas, draft.bookCanvas)) {
    override.bookCanvas = draft.bookCanvas;
  }
  if (sectionChanged(global.core, draft.core)) {
    override.core = draft.core;
  }
  if (sectionChanged(global.typography, draft.typography)) {
    override.typography = draft.typography;
  }
  if (sectionChanged(global.wordList, draft.wordList)) {
    override.wordList = draft.wordList;
  }
  if (sectionChanged(global.pageFrameSettings, draft.pageFrameSettings)) {
    override.pageFrameSettings = draft.pageFrameSettings;
  }

  const colorsOverride: Partial<WordSearchSettings['colors']> = {};
  if (sectionChanged(global.colors.puzzlePage, draft.colors.puzzlePage)) {
    colorsOverride.puzzlePage = draft.colors.puzzlePage;
  }
  if (sectionChanged(global.colors.answerPage, draft.colors.answerPage)) {
    colorsOverride.answerPage = draft.colors.answerPage;
  }
  if (Object.keys(colorsOverride).length > 0) {
    override.colors = colorsOverride as WordSearchSettings['colors'];
  }

  return override;
}

export function getPuzzleGridScaleForPage(
  pageIndex: number,
  defaultScale: number,
  pageScales?: Map<number, number> | null
): number {
  if (!pageScales) return defaultScale;
  const scale = pageScales.get(pageIndex);
  return scale === undefined ? defaultScale : scale;
}

/** Store only the settings sections touched by a canvas edit target. */
export function buildPageOverrideForTarget(
  draft: WordSearchSettings,
  target: CanvasEditTarget
): Partial<WordSearchSettings> {
  const category = CANVAS_EDIT_TARGET_CATEGORY[target];
  switch (category) {
    case 'typography':
      return { typography: draft.typography };
    case 'grid':
      return { core: draft.core };
    case 'wordList':
      return { wordList: draft.wordList };
    case 'colors':
      return {
        colors: draft.colors,
        pageFrameSettings: draft.pageFrameSettings,
      };
    default:
      return buildPageOverrideFromDraft(draft);
  }
}

export function getBatchIndexForCompiledPuzzlePage(
  compiledPage: { sourceDocumentId: string; puzzleIndexInDocument: number },
  batchPuzzles: { pageId?: string; puzzleIndexInDocument?: number }[]
): number {
  const docStart = batchPuzzles.findIndex((puzzle) => puzzle.pageId === compiledPage.sourceDocumentId);
  if (docStart < 0) return 0;
  return docStart + compiledPage.puzzleIndexInDocument;
}
