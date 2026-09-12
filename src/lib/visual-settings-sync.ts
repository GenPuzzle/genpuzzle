/**
 * Sync colors / background / frame / header / page-number settings across
 * all Word Search document tabs when changed from General settings.
 * Also supports applying full Layout settings to every puzzle document type.
 */

import type { BookCanvasSettings, WordSearchSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings } from './document-model';
import { isPuzzleModuleType } from './document-model';
import { isGenericPuzzleModuleType } from './generic-puzzle-settings';
import type { CrosswordSettings } from './crossword-settings';
import type { MurdokuSettings } from './murdoku-settings';
import { formatPageNumberList } from './canvas-edit-session';

export interface VisualSyncScope {
  colors: boolean;
  pageFrame: boolean;
  pageNumber: boolean;
}

export interface LayoutSyncScope extends VisualSyncScope {
  /** Trim / page-size fields from Layout → Trim. */
  bookCanvas: boolean;
}

export function getFullLayoutSyncScope(): LayoutSyncScope {
  return {
    colors: true,
    pageFrame: true,
    pageNumber: true,
    bookCanvas: true,
  };
}

/** Detect Layout-panel changes (trim + colors + frame + page numbers). */
export function detectLayoutSyncScope(
  prev: WordSearchSettings,
  updates: Partial<WordSearchSettings>
): LayoutSyncScope | null {
  const visual = detectVisualSyncScope(prev, updates);
  let bookCanvas = false;
  if (updates.bookCanvas) {
    const keys: Array<keyof BookCanvasSettings> = [
      'includeBleed',
      'useCustomTrim',
      'customWidth',
      'customHeight',
      'trimSizePreset',
      'measurementUnits',
    ];
    for (const key of keys) {
      if (
        updates.bookCanvas[key] !== undefined &&
        updates.bookCanvas[key] !== prev.bookCanvas[key]
      ) {
        bookCanvas = true;
        break;
      }
    }
  }
  if (!visual && !bookCanvas) return null;
  return {
    colors: visual?.colors ?? false,
    pageFrame: visual?.pageFrame ?? false,
    pageNumber: visual?.pageNumber ?? false,
    bookCanvas,
  };
}

/**
 * Keep document-specific puzzle settings, but force Layout fields from the
 * shared book layout source so the Layout UI never jumps between tabs.
 */
export function mergeDocumentSettingsPreservingLayout(
  documentWs: WordSearchSettings,
  layoutSource: WordSearchSettings
): WordSearchSettings {
  return applyLayoutSettingsToWordSearch(
    documentWs,
    layoutSource,
    getFullLayoutSyncScope()
  );
}

export function applyLayoutSettingsToCrosswordDocument(
  cw: CrosswordSettings,
  layoutSource: WordSearchSettings
): CrosswordSettings {
  return applyLayoutToCrossword(cw, layoutSource, getFullLayoutSyncScope());
}

export function applyLayoutSettingsToGenericDocument(
  settings: NonNullable<PuzzleModuleSettings['genericPuzzleSettings']>,
  layoutSource: WordSearchSettings
): NonNullable<PuzzleModuleSettings['genericPuzzleSettings']> {
  return applyLayoutToGenericColors(settings, layoutSource, getFullLayoutSyncScope());
}

export function applyLayoutSettingsToMurdokuDocument(
  md: MurdokuSettings,
  layoutSource: WordSearchSettings
): MurdokuSettings {
  return applyLayoutToMurdoku(md, layoutSource, getFullLayoutSyncScope());
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

/** Copy shared trim/page-size fields without overwriting per-doc answersPerPage etc. */
export function applyBookCanvasLayoutFields(
  target: BookCanvasSettings,
  source: BookCanvasSettings
): BookCanvasSettings {
  return {
    ...target,
    includeBleed: source.includeBleed,
    useCustomTrim: source.useCustomTrim,
    customWidth: source.customWidth,
    customHeight: source.customHeight,
    trimSizePreset: source.trimSizePreset,
    measurementUnits: source.measurementUnits,
  };
}

export function detectVisualSyncScope(
  prev: WordSearchSettings,
  updates: Partial<WordSearchSettings>
): VisualSyncScope | null {
  const scope: VisualSyncScope = {
    colors: false,
    pageFrame: false,
    pageNumber: false,
  };

  if (updates.colors !== undefined) {
    const nextColors = {
      ...prev.colors,
      ...updates.colors,
      puzzlePage: updates.colors.puzzlePage
        ? { ...prev.colors.puzzlePage, ...updates.colors.puzzlePage }
        : prev.colors.puzzlePage,
      answerPage: updates.colors.answerPage
        ? { ...prev.colors.answerPage, ...updates.colors.answerPage }
        : prev.colors.answerPage,
    };
    if (stableJson(nextColors) !== stableJson(prev.colors)) {
      scope.colors = true;
    }
  }

  if (updates.pageFrameSettings !== undefined) {
    const nextFrame = {
      ...prev.pageFrameSettings,
      ...updates.pageFrameSettings,
    };
    if (stableJson(nextFrame) !== stableJson(prev.pageFrameSettings ?? null)) {
      scope.pageFrame = true;
    }
  }

  if (updates.typography?.pageNumber !== undefined) {
    const nextPageNumber = {
      ...prev.typography.pageNumber,
      ...updates.typography.pageNumber,
    };
    if (stableJson(nextPageNumber) !== stableJson(prev.typography.pageNumber)) {
      scope.pageNumber = true;
    }
  }

  if (!scope.colors && !scope.pageFrame && !scope.pageNumber) {
    return null;
  }
  return scope;
}

export function applyVisualSettingsToTarget(
  target: WordSearchSettings,
  source: WordSearchSettings,
  scope: VisualSyncScope
): WordSearchSettings {
  let next: WordSearchSettings = target;

  if (scope.colors) {
    next = {
      ...next,
      colors: {
        ...source.colors,
        puzzlePage: { ...source.colors.puzzlePage },
        answerPage: { ...source.colors.answerPage },
      },
    };
  }

  if (scope.pageFrame) {
    next = {
      ...next,
      pageFrameSettings: source.pageFrameSettings
        ? { ...source.pageFrameSettings }
        : source.pageFrameSettings,
    };
  }

  if (scope.pageNumber) {
    next = {
      ...next,
      typography: {
        ...next.typography,
        pageNumber: { ...source.typography.pageNumber },
      },
    };
  }

  return next;
}

export function applyLayoutSettingsToWordSearch(
  target: WordSearchSettings,
  source: WordSearchSettings,
  scope: LayoutSyncScope
): WordSearchSettings {
  let next = applyVisualSettingsToTarget(target, source, scope);
  if (scope.bookCanvas) {
    next = {
      ...next,
      bookCanvas: applyBookCanvasLayoutFields(next.bookCanvas, source.bookCanvas),
    };
  }
  return next;
}

function applyLayoutToCrossword(
  cw: CrosswordSettings,
  source: WordSearchSettings,
  scope: LayoutSyncScope
): CrosswordSettings {
  let next = cw;
  if (scope.bookCanvas) {
    next = {
      ...next,
      bookCanvas: applyBookCanvasLayoutFields(next.bookCanvas, source.bookCanvas),
    };
  }
  if (scope.pageFrame) {
    next = {
      ...next,
      pageFrameSettings: source.pageFrameSettings
        ? { ...source.pageFrameSettings }
        : source.pageFrameSettings,
    };
  }
  if (scope.colors) {
    next = {
      ...next,
      colors: {
        ...next.colors,
        backgroundColor: source.colors.puzzlePage.backgroundColor,
        titleColor: source.colors.puzzlePage.titleColor,
        subtitleColor: source.colors.puzzlePage.subtitleColor,
      },
    };
  }
  if (scope.pageNumber) {
    next = {
      ...next,
      typography: {
        ...next.typography,
        pageNumber: { ...source.typography.pageNumber },
        includePageNumbers:
          source.typography.pageNumber?.enabled ?? next.typography.includePageNumbers,
      },
    };
  }
  return next;
}

function applyLayoutToMurdoku(
  md: MurdokuSettings,
  source: WordSearchSettings,
  scope: LayoutSyncScope
): MurdokuSettings {
  let next = md;
  if (scope.bookCanvas) {
    next = {
      ...next,
      bookCanvas: applyBookCanvasLayoutFields(next.bookCanvas, source.bookCanvas),
    };
  }
  if (scope.pageFrame) {
    next = {
      ...next,
      pageFrameSettings: source.pageFrameSettings
        ? { ...source.pageFrameSettings }
        : source.pageFrameSettings,
    };
  }
  return next;
}

function applyLayoutToGenericColors(
  settings: NonNullable<PuzzleModuleSettings['genericPuzzleSettings']>,
  source: WordSearchSettings,
  scope: LayoutSyncScope
): NonNullable<PuzzleModuleSettings['genericPuzzleSettings']> {
  if (!scope.colors) return settings;
  return {
    ...settings,
    colors: {
      ...settings.colors,
      backgroundColor: source.colors.puzzlePage.backgroundColor,
      titleColor: source.colors.puzzlePage.titleColor,
      gridColor: source.colors.puzzlePage.puzzleColor,
    },
  };
}

export function visualSettingsMatch(
  a: WordSearchSettings,
  b: WordSearchSettings,
  scope: VisualSyncScope
): boolean {
  if (scope.colors && stableJson(a.colors) !== stableJson(b.colors)) {
    return false;
  }
  if (
    scope.pageFrame &&
    stableJson(a.pageFrameSettings ?? null) !== stableJson(b.pageFrameSettings ?? null)
  ) {
    return false;
  }
  if (
    scope.pageNumber &&
    stableJson(a.typography.pageNumber) !== stableJson(b.typography.pageNumber)
  ) {
    return false;
  }
  return true;
}

export function pageOverrideHasVisualDiff(
  override: Partial<WordSearchSettings> | undefined,
  scope: VisualSyncScope
): boolean {
  if (!override) return false;
  if (scope.colors && override.colors) return true;
  if (scope.pageFrame && override.pageFrameSettings) return true;
  if (scope.pageNumber && override.typography?.pageNumber) return true;
  return false;
}

/** Remove visual fields from a page override; return null if override becomes empty. */
export function stripVisualFieldsFromPageOverride(
  override: Partial<WordSearchSettings>,
  scope: VisualSyncScope
): Partial<WordSearchSettings> | null {
  const next: Partial<WordSearchSettings> = { ...override };

  if (scope.colors) {
    delete next.colors;
  }
  if (scope.pageFrame) {
    delete next.pageFrameSettings;
  }
  if (scope.pageNumber && next.typography) {
    const { pageNumber: _removed, ...restTypography } = next.typography;
    if (Object.keys(restTypography).length === 0) {
      delete next.typography;
    } else {
      next.typography = restTypography as WordSearchSettings['typography'];
    }
  }

  return Object.keys(next).length > 0 ? next : null;
}

export function findDivergentWordSearchDocumentNames(
  documentPages: DocumentPage[],
  activeDocumentPageId: string | null,
  source: WordSearchSettings,
  scope: VisualSyncScope
): string[] {
  const names: string[] = [];
  for (const page of documentPages) {
    if (page.moduleType !== 'word-search') continue;
    if (page.id === activeDocumentPageId) continue;
    const ws = (page.settings as PuzzleModuleSettings).wordSearchSettings;
    if (!ws) {
      names.push(page.name || 'Word Search');
      continue;
    }
    if (!visualSettingsMatch(ws, source, scope)) {
      names.push(page.name || 'Word Search');
    }
  }
  return names;
}

export function findPagesWithVisualOverrides(
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  scope: VisualSyncScope
): number[] {
  const indices: number[] = [];
  for (const [index, override] of pageOverrides.entries()) {
    if (pageOverrideHasVisualDiff(override, scope)) {
      indices.push(index);
    }
  }
  return indices.sort((a, b) => a - b);
}

export function syncVisualSettingsAcrossWordSearchDocuments(
  documentPages: DocumentPage[],
  source: WordSearchSettings,
  scope: VisualSyncScope
): DocumentPage[] {
  return documentPages.map((page) => {
    if (page.moduleType !== 'word-search') return page;
    const settings = page.settings as PuzzleModuleSettings;
    const current = settings.wordSearchSettings;
    if (!current) {
      return {
        ...page,
        settings: {
          ...settings,
          wordSearchSettings: applyVisualSettingsToTarget(source, source, scope),
        } as PuzzleModuleSettings,
      };
    }
    return {
      ...page,
      settings: {
        ...settings,
        wordSearchSettings: applyVisualSettingsToTarget(current, source, scope),
      } as PuzzleModuleSettings,
    };
  });
}

/** Copy Layout fields onto one puzzle document; text pages keep using the shared book layout. */
export function applyBookLayoutToDocumentPage(
  page: DocumentPage,
  source: WordSearchSettings,
  scope: LayoutSyncScope = getFullLayoutSyncScope()
): DocumentPage {
  if (!isPuzzleModuleType(page.moduleType)) return page;
  const settings = page.settings as PuzzleModuleSettings;

  if (page.moduleType === 'word-search') {
    const current = settings.wordSearchSettings ?? source;
    return {
      ...page,
      settings: {
        ...settings,
        wordSearchSettings: applyLayoutSettingsToWordSearch(current, source, scope),
      } as PuzzleModuleSettings,
    };
  }

  if (page.moduleType === 'crossword') {
    const cw = settings.crosswordSettings;
    if (!cw) return page;
    return {
      ...page,
      settings: {
        ...settings,
        crosswordSettings: applyLayoutToCrossword(cw, source, scope),
      } as PuzzleModuleSettings,
    };
  }

  if (page.moduleType === 'murdoku') {
    const md = settings.murdokuSettings;
    if (!md) return page;
    return {
      ...page,
      settings: {
        ...settings,
        murdokuSettings: applyLayoutToMurdoku(md, source, scope),
      } as PuzzleModuleSettings,
    };
  }

  if (isGenericPuzzleModuleType(page.moduleType) && settings.genericPuzzleSettings) {
    return {
      ...page,
      settings: {
        ...settings,
        genericPuzzleSettings: applyLayoutToGenericColors(
          settings.genericPuzzleSettings,
          source,
          scope
        ),
      } as PuzzleModuleSettings,
    };
  }

  return page;
}

export function overlayBookLayoutOnAllDocuments(
  documentPages: DocumentPage[],
  source: WordSearchSettings,
  scope: LayoutSyncScope = getFullLayoutSyncScope()
): DocumentPage[] {
  return documentPages.map((page) => applyBookLayoutToDocumentPage(page, source, scope));
}

/** Apply Layout (trim / colors / frame / page #) to every puzzle document tab. */
export function syncLayoutSettingsAcrossAllPuzzleDocuments(
  documentPages: DocumentPage[],
  source: WordSearchSettings,
  scope: LayoutSyncScope = getFullLayoutSyncScope()
): { pages: DocumentPage[]; puzzleDocCount: number } {
  const pages = overlayBookLayoutOnAllDocuments(documentPages, source, scope);
  const puzzleDocCount = pages.filter((page) => isPuzzleModuleType(page.moduleType)).length;
  return { pages, puzzleDocCount };
}

export function stripVisualOverridesFromMap(
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  scope: VisualSyncScope
): Map<number, Partial<WordSearchSettings>> {
  const next = new Map<number, Partial<WordSearchSettings>>();
  for (const [index, override] of pageOverrides.entries()) {
    const stripped = stripVisualFieldsFromPageOverride(override, scope);
    if (stripped) {
      next.set(index, stripped);
    }
  }
  return next;
}

export function buildVisualSyncWarningMessage(options: {
  scope: VisualSyncScope;
  divergentDocNames: string[];
  divergentPageIndices: number[];
}): string | null {
  const { divergentDocNames, divergentPageIndices } = options;
  if (divergentDocNames.length === 0 && divergentPageIndices.length === 0) {
    return null;
  }

  const parts: string[] = [];
  parts.push(
    'Color / background / header / frame / page-number settings were applied to all Word Search documents.'
  );

  if (divergentDocNames.length > 0) {
    const list =
      divergentDocNames.length <= 4
        ? divergentDocNames.join(', ')
        : `${divergentDocNames.slice(0, 3).join(', ')} (+${divergentDocNames.length - 3} more)`;
    parts.push(
      `Document tab${divergentDocNames.length === 1 ? '' : 's'} with different settings were updated: ${list}.`
    );
  }

  if (divergentPageIndices.length > 0) {
    parts.push(
      `Puzzle page${divergentPageIndices.length === 1 ? '' : 's'} ${formatPageNumberList(divergentPageIndices)} had different color/frame/page-number settings and were updated to match General.`
    );
  }

  return parts.join(' ');
}

export function mergeWordSearchSettingsUpdate(
  prev: WordSearchSettings,
  updates: Partial<WordSearchSettings>
): WordSearchSettings {
  return {
    ...prev,
    ...updates,
    bookCanvas: { ...prev.bookCanvas, ...updates.bookCanvas },
    core: { ...prev.core, ...updates.core },
    typography: { ...prev.typography, ...updates.typography },
    wordList: { ...prev.wordList, ...updates.wordList },
    colors: updates.colors
      ? {
          ...prev.colors,
          ...updates.colors,
          ...(updates.colors.puzzlePage
            ? { puzzlePage: { ...prev.colors.puzzlePage, ...updates.colors.puzzlePage } }
            : {}),
          ...(updates.colors.answerPage
            ? { answerPage: { ...prev.colors.answerPage, ...updates.colors.answerPage } }
            : {}),
        }
      : prev.colors,
    pageFrameSettings: updates.pageFrameSettings
      ? { ...prev.pageFrameSettings, ...updates.pageFrameSettings }
      : prev.pageFrameSettings,
  };
}
