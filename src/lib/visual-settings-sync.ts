/**
 * Sync colors / background / frame / header / page-number settings across
 * all Word Search document tabs when changed from General settings.
 */

import type { WordSearchSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings } from './document-model';
import { formatPageNumberList } from './canvas-edit-session';

export interface VisualSyncScope {
  colors: boolean;
  pageFrame: boolean;
  pageNumber: boolean;
}

function stableJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
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
          wordSearchSettings: applyVisualSettingsToTarget(
            source,
            source,
            scope
          ),
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
