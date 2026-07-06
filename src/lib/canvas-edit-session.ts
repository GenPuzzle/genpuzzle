import {
  DEFAULT_HEADER_ASSEMBLY,
  normalizeHeaderAssemblySettings,
} from '@/lib/header-assembly/types';
import { getEffectiveSettingsForPage, mergePuzzlePageColors } from '@/lib/page-settings';
import {
  getPuzzleContentLineIndex,
  getRawContentLineAt,
  setRawContentLineAt,
} from '@/lib/puzzle-line-index';
import type { TitleWordsSettings, WordSearchPuzzle, WordSearchSettings } from '@/lib/puzzles/types';
import {
  applyTrimLayoutToSettings,
  applyTrimLayoutToTitleWords,
  mergeTrimLayoutPatch,
  scaleGridScalePercent,
} from '@/lib/trim-size-layout';

const BOOK_TEXT_TYPOGRAPHY_KEYS = ['titleText', 'funFactsText', 'includeFunFacts'] as const;
type BookTextTypographyKey = (typeof BOOK_TEXT_TYPOGRAPHY_KEYS)[number];

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

export interface CanvasEditTab {
  id: string;
  target: CanvasEditTarget;
  previewTab: 'puzzles' | 'solutions';
  snapshot: CanvasEditSnapshot;
}

export function createSnapshotFromSession(session: CanvasEditSession): CanvasEditSnapshot {
  return {
    settings: cloneWordSearchSettings(session.draft),
    titleWords: cloneTitleWords(session.draftTitleWords),
    puzzleGridScale: session.draftPuzzleGridScale,
    batchPuzzle: session.snapshot.batchPuzzle,
  };
}

export function tabHasUnsavedEdits(session: CanvasEditSession, tab: CanvasEditTab): boolean {
  return hasUnsavedCanvasEdits({
    ...session,
    snapshot: tab.snapshot,
  });
}

export const CANVAS_EDIT_TAB_LABELS: Record<CanvasEditTarget, string> = {
  title: 'Title',
  grid: 'Grid',
  'word-list': 'Words',
  'page-number': 'Page #',
  'page-background': 'Frame',
  'solution-title': 'Sol. Title',
  'solution-grid': 'Sol. Grid',
};

export const CANVAS_EDIT_TARGETS_BY_PREVIEW_TAB: Record<
  'puzzles' | 'solutions',
  CanvasEditTarget[]
> = {
  puzzles: ['page-background', 'title', 'grid', 'word-list', 'page-number'],
  solutions: ['page-background', 'solution-title', 'solution-grid', 'page-number'],
};

export function makeCanvasEditTabId(
  target: CanvasEditTarget,
  previewTab: 'puzzles' | 'solutions'
): string {
  return `${previewTab}:${target}`;
}

export function formatCanvasEditTabLabel(target: CanvasEditTarget): string {
  return CANVAS_EDIT_TAB_LABELS[target];
}

export function createCanvasEditSession(
  mergedSettings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  pageGridScale: number,
  puzzle: WordSearchPuzzle | null
): CanvasEditSession {
  return {
    draft: cloneWordSearchSettings(mergedSettings),
    draftTitleWords: cloneTitleWords(titleWords),
    draftPuzzleGridScale: pageGridScale,
    snapshot: {
      settings: cloneWordSearchSettings(mergedSettings),
      titleWords: cloneTitleWords(titleWords),
      puzzleGridScale: pageGridScale,
      batchPuzzle: puzzle ? (JSON.parse(JSON.stringify(puzzle)) as WordSearchPuzzle) : null,
    },
  };
}

export function anyCanvasEditTabHasUnsavedEdits(
  session: CanvasEditSession | null,
  tabs: CanvasEditTab[]
): boolean {
  if (!session) return false;
  return tabs.some((tab) => tabHasUnsavedEdits(session, tab));
}

/** Strip sidebar-only header tab selection so dirty state survives target switches. */
export function settingsForCanvasEditComparison(settings: WordSearchSettings): WordSearchSettings {
  const next = cloneWordSearchSettings(settings);
  const headerAssembly = next.colors?.puzzlePage?.headerAssembly;
  if (!headerAssembly) return next;

  next.colors = {
    ...next.colors,
    puzzlePage: {
      ...next.colors.puzzlePage,
      headerAssembly: {
        ...normalizeHeaderAssemblySettings(headerAssembly),
        editorTarget: DEFAULT_HEADER_ASSEMBLY.editorTarget,
      },
    },
  };
  return next;
}

export function hasUnsavedCanvasEdits(session: CanvasEditSession | null): boolean {
  if (!session) return false;
  if (session.draftPuzzleGridScale !== session.snapshot.puzzleGridScale) return true;
  if (JSON.stringify(session.draftTitleWords) !== JSON.stringify(session.snapshot.titleWords)) {
    return true;
  }
  if (
    JSON.stringify(settingsForCanvasEditComparison(session.draft)) !==
    JSON.stringify(settingsForCanvasEditComparison(session.snapshot.settings))
  ) {
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
  return (
    JSON.stringify(settingsForCanvasEditComparison(normalizedDraft)) !==
    JSON.stringify(settingsForCanvasEditComparison(session.snapshot.settings))
  );
}

/** True when page draft has styling/layout that differs from book-wide global settings. */
export function hasPromotablePageSettingsVsGlobal(
  global: WordSearchSettings,
  draft: WordSearchSettings
): boolean {
  const normalizedDraft: WordSearchSettings = {
    ...draft,
    wordList: {
      ...draft.wordList,
      selectWordListOption: global.wordList.selectWordListOption,
    },
  };
  return (
    JSON.stringify(settingsForCanvasEditComparison(normalizedDraft)) !==
    JSON.stringify(settingsForCanvasEditComparison(global))
  );
}

export function hasPromotablePageEditsVsGlobal(
  global: WordSearchSettings,
  globalGridScale: number,
  session: CanvasEditSession
): boolean {
  if (session.draftPuzzleGridScale !== globalGridScale) return true;
  return hasPromotablePageSettingsVsGlobal(global, session.draft);
}

export function pageIndexHasPromotableOverrides(
  global: WordSearchSettings,
  globalGridScale: number,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>,
  pageIndex: number
): boolean {
  const scale = getPuzzleGridScaleForPage(pageIndex, globalGridScale, pageScales);
  if (scale !== globalGridScale) return true;
  const effective = getEffectiveSettingsForPage(global, pageOverrides, pageIndex);
  return hasPromotablePageSettingsVsGlobal(global, effective);
}

/** True when any puzzle page has committed styling that differs from book-wide settings. */
export function bookHasPromotablePageOverrides(
  global: WordSearchSettings,
  globalGridScale: number,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>
): boolean {
  const indices = new Set<number>([...pageOverrides.keys(), ...pageScales.keys()]);
  for (const pageIndex of indices) {
    if (pageIndexHasPromotableOverrides(global, globalGridScale, pageOverrides, pageScales, pageIndex)) {
      return true;
    }
  }
  return false;
}

/** Page indices (0-based) with committed per-page styling overrides. */
export function getEditedPageIndices(
  global: WordSearchSettings,
  globalGridScale: number,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>
): number[] {
  const indices = new Set<number>([...pageOverrides.keys(), ...pageScales.keys()]);
  const edited: number[] = [];
  for (const pageIndex of [...indices].sort((a, b) => a - b)) {
    if (pageIndexHasPromotableOverrides(global, globalGridScale, pageOverrides, pageScales, pageIndex)) {
      edited.push(pageIndex);
    }
  }
  return edited;
}

/** Edited batch indices that belong to a specific word-search document tab. */
export function getEditedBatchIndicesForDocument(
  global: WordSearchSettings,
  globalGridScale: number,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>,
  batchPuzzles: Array<{ pageId?: string | null }>,
  documentPageId: string
): number[] {
  return getEditedPageIndices(global, globalGridScale, pageOverrides, pageScales).filter(
    (batchIndex) => batchPuzzles[batchIndex]?.pageId === documentPageId
  );
}

/** Edited pages other than the page currently open in the canvas editor. */
export function getOtherEditedPageIndices(
  global: WordSearchSettings,
  globalGridScale: number,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>,
  currentPageIndex: number
): number[] {
  return getEditedPageIndices(global, globalGridScale, pageOverrides, pageScales).filter(
    (pageIndex) => pageIndex !== currentPageIndex
  );
}

export function formatPageNumberList(indices: number[]): string {
  const pages = indices.map((index) => index + 1);
  if (pages.length === 0) return '';
  if (pages.length === 1) return String(pages[0]);
  if (pages.length === 2) return `${pages[0]} and ${pages[1]}`;
  return `${pages.slice(0, -1).join(', ')}, and ${pages[pages.length - 1]}`;
}

export interface ApplyToAllPromotionSource {
  settings: WordSearchSettings;
  gridScale: number;
}

/** Always promote the opened page's current settings (what the user sees in the preview). */
export function resolveApplyToAllPromotionSource(
  session: CanvasEditSession
): ApplyToAllPromotionSource {
  return { settings: session.draft, gridScale: session.draftPuzzleGridScale };
}

/** Apply-to-all is for shared styling/settings — not per-page word list content. */
export function canApplyCanvasEditsToAllPages(
  session: CanvasEditSession | null,
  globalSettings?: WordSearchSettings,
  globalGridScale?: number,
  pageOverrides?: Map<number, Partial<WordSearchSettings>>,
  pageScales?: Map<number, number>
): boolean {
  if (!session) return false;

  if (
    globalSettings !== undefined &&
    globalGridScale !== undefined &&
    pageOverrides !== undefined &&
    pageScales !== undefined &&
    bookHasPromotablePageOverrides(globalSettings, globalGridScale, pageOverrides, pageScales)
  ) {
    return true;
  }

  if (
    globalSettings !== undefined &&
    globalGridScale !== undefined &&
    hasPromotablePageEditsVsGlobal(globalSettings, globalGridScale, session)
  ) {
    return true;
  }

  if (!hasUnsavedCanvasEdits(session)) return false;
  if (session.draftPuzzleGridScale !== session.snapshot.puzzleGridScale) return true;
  return hasSettingsEditsBeyondWordContent(session);
}

export function hasGridSizeEdits(session: CanvasEditSession): boolean {
  return (
    session.draft.core.lettersAcross !== session.snapshot.settings.core.lettersAcross ||
    session.draft.core.lettersDown !== session.snapshot.settings.core.lettersDown
  );
}

const WORD_DIRECTION_KEYS = [
  'allowRight',
  'allowLeft',
  'allowDown',
  'allowUp',
  'allowDiagonalDown',
  'allowDiagonalUp',
  'allowDiagonalDownReverse',
  'allowDiagonalUpReverse',
] as const;

export function hasWordDirectionEdits(session: CanvasEditSession): boolean {
  const draft = session.draft.core;
  const snapshot = session.snapshot.settings.core;
  return WORD_DIRECTION_KEYS.some((key) => draft[key] !== snapshot[key]);
}

export function shouldRegeneratePuzzleOnPageCommit(session: CanvasEditSession): boolean {
  return (
    hasGridSizeEdits(session) || hasWordListEdits(session) || hasWordDirectionEdits(session)
  );
}

export function shouldRegeneratePuzzlesOnAllCommit(session: CanvasEditSession): boolean {
  return hasGridSizeEdits(session) || hasWordDirectionEdits(session);
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

function scaleWordSearchSettingsForTrimSession(
  settings: WordSearchSettings,
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): WordSearchSettings {
  if (Math.abs(ratio - 1) < 0.001) {
    return { ...settings, bookCanvas: { ...settings.bookCanvas, ...nextBookCanvas } };
  }
  const patch = applyTrimLayoutToSettings(settings, ratio);
  return mergeTrimLayoutPatch(settings, patch, nextBookCanvas);
}

/** Keep an open canvas edit session in sync when trim size changes. */
export function scaleCanvasEditSessionForTrim(
  session: CanvasEditSession,
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): CanvasEditSession {
  if (Math.abs(ratio - 1) < 0.001) {
    return session;
  }

  return {
    ...session,
    draft: scaleWordSearchSettingsForTrimSession(session.draft, ratio, nextBookCanvas),
    draftTitleWords: applyTrimLayoutToTitleWords(session.draftTitleWords, ratio),
    draftPuzzleGridScale: scaleGridScalePercent(session.draftPuzzleGridScale, ratio),
    snapshot: {
      ...session.snapshot,
      settings: scaleWordSearchSettingsForTrimSession(session.snapshot.settings, ratio, nextBookCanvas),
      titleWords: applyTrimLayoutToTitleWords(session.snapshot.titleWords, ratio),
      puzzleGridScale: scaleGridScalePercent(session.snapshot.puzzleGridScale, ratio),
    },
  };
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

function withAiThemeSyncForTitleText(
  global: WordSearchSettings,
  draft: WordSearchSettings,
  typographyUpdates: Partial<WordSearchSettings['typography']>
): Partial<WordSearchSettings> {
  const updates: Partial<WordSearchSettings> = { typography: typographyUpdates };
  if (typographyUpdates.titleText === undefined) return updates;

  const option = draft.typography.selectTitleOption;
  if (
    option === 'one-custom-title' ||
    option === 'puzzle-number' ||
    option === 'custom'
  ) {
    if (global.wordList.aiTheme !== typographyUpdates.titleText) {
      updates.wordList = { aiTheme: typographyUpdates.titleText };
    }
  }
  return updates;
}

/** Merge title/subtitle book content into global settings (page-only commit). */
export function buildGlobalBookTextUpdatesForPageCommit(
  global: WordSearchSettings,
  draft: WordSearchSettings,
  puzzle: WordSearchPuzzle | null
): Partial<WordSearchSettings> | null {
  const lineIndex = puzzle != null ? getPuzzleContentLineIndex(puzzle, global) : 0;
  const typographyUpdates: Partial<WordSearchSettings['typography']> = {};
  let changed = false;

  const draftTypo = draft.typography;
  const globalTypo = global.typography;

  if (draftTypo.selectTitleOption === 'custom') {
    const nextLine = getRawContentLineAt(draftTypo.titleText, lineIndex);
    const prevLine = getRawContentLineAt(globalTypo.titleText, lineIndex);
    if (nextLine !== prevLine) {
      typographyUpdates.titleText = setRawContentLineAt(globalTypo.titleText, lineIndex, nextLine);
      changed = true;
    }
  } else if (draftTypo.selectTitleOption !== 'none' && draftTypo.titleText !== globalTypo.titleText) {
    typographyUpdates.titleText = draftTypo.titleText;
    changed = true;
  }

  if (draftTypo.includeFunFacts !== globalTypo.includeFunFacts) {
    typographyUpdates.includeFunFacts = draftTypo.includeFunFacts;
    changed = true;
  }

  const nextSub = getRawContentLineAt(draftTypo.funFactsText, lineIndex);
  const prevSub = getRawContentLineAt(globalTypo.funFactsText, lineIndex);
  if (nextSub !== prevSub) {
    typographyUpdates.funFactsText = setRawContentLineAt(globalTypo.funFactsText, lineIndex, nextSub);
    changed = true;
  }

  if (!changed) return null;
  return withAiThemeSyncForTitleText(global, draft, typographyUpdates);
}

/** Promote book-wide answers-per-page into global settings on canvas commit. */
export function buildGlobalAnswersPerPageUpdate(
  global: WordSearchSettings,
  draft: WordSearchSettings
): Partial<WordSearchSettings> | null {
  if (draft.bookCanvas.answersPerPage === global.bookCanvas.answersPerPage) {
    return null;
  }
  return {
    bookCanvas: {
      ...global.bookCanvas,
      answersPerPage: draft.bookCanvas.answersPerPage,
    },
  };
}

/** Promote title/subtitle book content to global settings (apply-to-all commit). */
export function buildGlobalBookTextUpdatesForAllCommit(
  global: WordSearchSettings,
  draft: WordSearchSettings
): Partial<WordSearchSettings> | null {
  const typographyUpdates: Partial<WordSearchSettings['typography']> = {};
  let changed = false;

  const draftTypo = draft.typography;
  const globalTypo = global.typography;

  if (draftTypo.titleText !== globalTypo.titleText) {
    typographyUpdates.titleText = draftTypo.titleText;
    changed = true;
  }
  if (draftTypo.funFactsText !== globalTypo.funFactsText) {
    typographyUpdates.funFactsText = draftTypo.funFactsText;
    changed = true;
  }
  if (draftTypo.includeFunFacts !== globalTypo.includeFunFacts) {
    typographyUpdates.includeFunFacts = draftTypo.includeFunFacts;
    changed = true;
  }

  if (!changed) return null;
  return withAiThemeSyncForTitleText(global, draft, typographyUpdates);
}

/** Keep page overrides for styling only — book text lives in global settings. */
export function stripBookTextFieldsFromPageOverride(
  global: WordSearchSettings,
  override: Partial<WordSearchSettings>
): Partial<WordSearchSettings> {
  if (!override.typography) return override;

  const stylingOnly: Partial<WordSearchSettings['typography']> = {};
  const overrideTypo = override.typography;
  const globalTypo = global.typography;

  for (const key of Object.keys(overrideTypo) as (keyof WordSearchSettings['typography'])[]) {
    if (BOOK_TEXT_TYPOGRAPHY_KEYS.includes(key as BookTextTypographyKey)) continue;
    if (JSON.stringify(overrideTypo[key]) !== JSON.stringify(globalTypo[key])) {
      (stylingOnly as Record<string, unknown>)[key] = overrideTypo[key];
    }
  }

  if (Object.keys(stylingOnly).length === 0) {
    const { typography: _typography, ...rest } = override;
    return rest;
  }

  return { ...override, typography: stylingOnly as WordSearchSettings['typography'] };
}

/** Full title/header styling from draft (excludes per-page book text). */
export function buildTitleHeaderPageOverride(
  draft: WordSearchSettings
): Partial<WordSearchSettings> {
  const stylingTypography: Record<string, unknown> = {};
  for (const key of Object.keys(draft.typography) as (keyof WordSearchSettings['typography'])[]) {
    if (BOOK_TEXT_TYPOGRAPHY_KEYS.includes(key as BookTextTypographyKey)) continue;
    stylingTypography[key] = draft.typography[key];
  }

  return {
    typography: stylingTypography as WordSearchSettings['typography'],
    colors: {
      puzzlePage: cloneWordSearchSettings(draft).colors.puzzlePage,
    },
  };
}

/** Full solution title styling from draft. */
export function buildSolutionTitlePageOverride(
  draft: WordSearchSettings
): Partial<WordSearchSettings> {
  const answerPage = draft.colors.answerPage;
  return {
    colors: {
      answerPage: {
        answerTitleFontFamily: answerPage.answerTitleFontFamily,
        answerTitleFontSize: answerPage.answerTitleFontSize,
        answerTitleAlignment: answerPage.answerTitleAlignment,
        answerTitleFontWeight: answerPage.answerTitleFontWeight,
        answerTitleFontColor: answerPage.answerTitleFontColor,
      },
    },
  };
}

/** Build page override for commit — title/header commits promote the full styling bundle. */
export function buildPageOverrideForCommit(
  global: WordSearchSettings,
  draft: WordSearchSettings,
  target: CanvasEditTarget | null
): Partial<WordSearchSettings> {
  if (target === 'title') {
    return buildTitleHeaderPageOverride(draft);
  }
  if (target === 'solution-title') {
    return buildSolutionTitlePageOverride(draft);
  }
  if (target) {
    return stripBookTextFieldsFromPageOverride(global, buildPageOverrideForTarget(draft, target));
  }
  return stripBookTextFieldsFromPageOverride(global, buildPageOverrideDelta(global, draft));
}

export function mergePartialWordSearchSettings(
  base: Partial<WordSearchSettings>,
  patch: Partial<WordSearchSettings>
): Partial<WordSearchSettings> {
  const merged: Partial<WordSearchSettings> = {
    ...base,
    ...patch,
  };

  if (patch.bookCanvas) {
    merged.bookCanvas = { ...base.bookCanvas, ...patch.bookCanvas } as WordSearchSettings['bookCanvas'];
  }
  if (patch.core) {
    merged.core = { ...base.core, ...patch.core } as WordSearchSettings['core'];
  }
  if (patch.typography) {
    merged.typography = {
      ...base.typography,
      ...patch.typography,
    } as WordSearchSettings['typography'];
  }
  if (patch.wordList) {
    merged.wordList = { ...base.wordList, ...patch.wordList } as WordSearchSettings['wordList'];
  }
  if (patch.pageFrameSettings) {
    merged.pageFrameSettings = {
      ...base.pageFrameSettings,
      ...patch.pageFrameSettings,
    } as WordSearchSettings['pageFrameSettings'];
  }
  if (patch.colors) {
    merged.colors = {
      ...(base.colors ?? {}),
      ...patch.colors,
      puzzlePage: patch.colors.puzzlePage
        ? mergePuzzlePageColors(
            base.colors?.puzzlePage ?? patch.colors.puzzlePage,
            patch.colors.puzzlePage
          )
        : base.colors?.puzzlePage,
      answerPage: patch.colors.answerPage
        ? { ...(base.colors?.answerPage ?? {}), ...patch.colors.answerPage }
        : base.colors?.answerPage,
    } as WordSearchSettings['colors'];
  }

  return merged;
}

function getCommitTargetsFromOpenTabs(
  tabs: CanvasEditTab[],
  session: CanvasEditSession,
  includeAllWhenNoneDirty: boolean
): CanvasEditTarget[] {
  const dirtyTargets = tabs
    .filter((tab) => tabHasUnsavedEdits(session, tab))
    .map((tab) => tab.target);
  if (dirtyTargets.length > 0) return dirtyTargets;
  if (includeAllWhenNoneDirty) return tabs.map((tab) => tab.target);
  return [];
}

/** Merge overrides for every open tab that has edits (or all open tabs when copying via range). */
export function buildPageOverrideForOpenTabs(
  global: WordSearchSettings,
  draft: WordSearchSettings,
  tabs: CanvasEditTab[],
  session: CanvasEditSession,
  options?: { includeAllOpenTabsWhenClean?: boolean }
): Partial<WordSearchSettings> {
  const targets = getCommitTargetsFromOpenTabs(
    tabs,
    session,
    options?.includeAllOpenTabsWhenClean ?? false
  );

  if (targets.length === 0) {
    return stripBookTextFieldsFromPageOverride(global, buildPageOverrideDelta(global, draft));
  }

  let merged: Partial<WordSearchSettings> = {};
  for (const target of new Set(targets)) {
    merged = mergePartialWordSearchSettings(
      merged,
      buildPageOverrideForCommit(global, draft, target)
    );
  }

  return stripBookTextFieldsFromPageOverride(global, merged);
}

function pageLayoutSectionsMatchDraft(
  currentEffective: WordSearchSettings,
  draft: WordSearchSettings,
  delta: Partial<WordSearchSettings>
): boolean {
  if (delta.bookCanvas) {
    if (JSON.stringify(currentEffective.bookCanvas) !== JSON.stringify(draft.bookCanvas)) {
      return false;
    }
  }
  if (delta.core) {
    if (JSON.stringify(currentEffective.core) !== JSON.stringify(draft.core)) {
      return false;
    }
  }
  if (delta.wordList) {
    if (JSON.stringify(currentEffective.wordList) !== JSON.stringify(draft.wordList)) {
      return false;
    }
  }
  if (delta.pageFrameSettings) {
    if (
      JSON.stringify(currentEffective.pageFrameSettings) !==
      JSON.stringify(draft.pageFrameSettings)
    ) {
      return false;
    }
  }
  if (delta.typography) {
    for (const key of Object.keys(delta.typography) as (keyof WordSearchSettings['typography'])[]) {
      if (
        JSON.stringify(currentEffective.typography[key]) !== JSON.stringify(draft.typography[key])
      ) {
        return false;
      }
    }
  }
  if (delta.colors?.puzzlePage) {
    if (
      JSON.stringify(currentEffective.colors.puzzlePage) !==
      JSON.stringify(draft.colors.puzzlePage)
    ) {
      return false;
    }
  }
  if (delta.colors?.answerPage) {
    if (
      JSON.stringify(currentEffective.colors.answerPage) !==
      JSON.stringify(draft.colors.answerPage)
    ) {
      return false;
    }
  }
  return true;
}

/** True when a batch page already matches the draft layout that range-apply would write. */
export function batchPageLayoutMatchesDraftForRangeApply(
  batchIndex: number,
  global: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>,
  globalGridScale: number,
  session: CanvasEditSession,
  tabs: CanvasEditTab[]
): boolean {
  const { draft, draftPuzzleGridScale: draftGridScale } = session;
  const currentScale = getPuzzleGridScaleForPage(batchIndex, globalGridScale, pageScales);
  if (currentScale !== draftGridScale) return false;

  const delta = buildPageOverrideForOpenTabs(global, draft, tabs, session, {
    includeAllOpenTabsWhenClean: true,
  });
  const currentEffective = getEffectiveSettingsForPage(global, pageOverrides, batchIndex);
  return pageLayoutSectionsMatchDraft(currentEffective, draft, delta);
}

export function selectedRangePagesMatchDraftForRangeApply(
  batchIndices: number[],
  global: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageScales: Map<number, number>,
  globalGridScale: number,
  session: CanvasEditSession,
  tabs: CanvasEditTab[]
): boolean {
  if (batchIndices.length === 0) return false;
  return batchIndices.every((batchIndex) =>
    batchPageLayoutMatchesDraftForRangeApply(
      batchIndex,
      global,
      pageOverrides,
      pageScales,
      globalGridScale,
      session,
      tabs
    )
  );
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
  if (target === 'solution-grid') {
    return {
      core: draft.core,
      colors: {
        answerPage: draft.colors.answerPage,
      },
      typography: {
        answerGridFontSize: draft.typography.answerGridFontSize,
        setFontSizeForAnswerPages: draft.typography.setFontSizeForAnswerPages,
        answerGridFontFamily: draft.typography.answerGridFontFamily,
        setFontForAnswerPages: draft.typography.setFontForAnswerPages,
      },
    };
  }

  const category = CANVAS_EDIT_TARGET_CATEGORY[target];
  switch (category) {
    case 'typography':
      return { typography: draft.typography };
    case 'grid':
      return { core: draft.core };
    case 'wordList':
      return {
        wordList: draft.wordList,
        typography: {
          spaceBetweenPuzzleAndWordList: draft.typography.spaceBetweenPuzzleAndWordList,
        },
      };
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
