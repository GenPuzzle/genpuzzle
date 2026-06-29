/**
 * Utility for merging global settings with page-specific overrides.
 * Used by both preview rendering and PDF export for WYSIWYG consistency.
 */

import { WordSearchSettings } from './puzzles/types';
import {
  normalizeHeaderAssemblySettings,
  migrateLegacyHeaderLayout,
} from './header-assembly/types';

function mergePuzzlePageColors(
  globalPage: WordSearchSettings['colors']['puzzlePage'],
  overridePage?: Partial<WordSearchSettings['colors']['puzzlePage']>
): WordSearchSettings['colors']['puzzlePage'] {
  if (!overridePage) return globalPage;
  const merged = { ...globalPage, ...overridePage };
  const rawAssembly =
    overridePage.headerAssembly ??
    globalPage.headerAssembly ??
    migrateLegacyHeaderLayout(
      (overridePage as { headerLayout?: Record<string, unknown> }).headerLayout ??
        (globalPage as { headerLayout?: Record<string, unknown> }).headerLayout
    );
  merged.headerAssembly = normalizeHeaderAssemblySettings({
    ...normalizeHeaderAssemblySettings(globalPage.headerAssembly ?? rawAssembly),
    ...normalizeHeaderAssemblySettings(overridePage.headerAssembly ?? rawAssembly),
    number: {
      ...normalizeHeaderAssemblySettings(globalPage.headerAssembly).number,
      ...overridePage.headerAssembly?.number,
    },
    title: {
      ...normalizeHeaderAssemblySettings(globalPage.headerAssembly).title,
      ...overridePage.headerAssembly?.title,
    },
    subtitle: {
      ...normalizeHeaderAssemblySettings(globalPage.headerAssembly).subtitle,
      ...overridePage.headerAssembly?.subtitle,
    },
  });
  return merged;
}

/**
 * Get the effective settings for a specific page by merging global settings with page overrides.
 * If a page override exists, it takes precedence over the global settings.
 */
export function getEffectiveSettingsForPage(
  globalSettings: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>> | Record<number, Partial<WordSearchSettings>> | null | undefined,
  pageIndex: number
): WordSearchSettings {
  const pageOverride = ((): Partial<WordSearchSettings> | undefined => {
    if (!pageOverrides) return undefined;
    if (pageOverrides instanceof Map) return pageOverrides.get(pageIndex);
    return (pageOverrides as Record<number, Partial<WordSearchSettings>>)[pageIndex];
  })();

  if (!pageOverride) {
    // No overrides for this page, return global settings
    return globalSettings;
  }

  // Deep merge: start with global, then apply page overrides
  return {
    bookCanvas: {
      ...globalSettings.bookCanvas,
      ...pageOverride.bookCanvas,
    },
    core: {
      ...globalSettings.core,
      ...pageOverride.core,
    },
    typography: {
      ...globalSettings.typography,
      ...pageOverride.typography,
    },
    wordList: {
      ...globalSettings.wordList,
      ...pageOverride.wordList,
    },
    colors: {
      ...globalSettings.colors,
      ...pageOverride.colors,
      puzzlePage: mergePuzzlePageColors(
        globalSettings.colors.puzzlePage,
        pageOverride.colors?.puzzlePage
      ),
      answerPage: pageOverride.colors?.answerPage
        ? { ...globalSettings.colors.answerPage, ...pageOverride.colors.answerPage }
        : globalSettings.colors.answerPage,
    },
    pageFrameSettings: pageOverride.pageFrameSettings
      ? { ...globalSettings.pageFrameSettings, ...pageOverride.pageFrameSettings }
      : globalSettings.pageFrameSettings,
  };
}

/**
 * Get settings for the current page, handling both global and local apply modes.
 * If a setting category is in "local" mode, use the page override for that category.
 * Otherwise, use the global setting.
 */
export function getMergedSettingsForPage(
  globalSettings: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>> | Record<number, Partial<WordSearchSettings>> | null | undefined,
  applyMode: Map<string, boolean> | Record<string, boolean> | null | undefined,
  pageIndex: number
): WordSearchSettings {
  // If applyMode is not provided, default to all-global behavior
  if (!applyMode) {
    return getEffectiveSettingsForPage(globalSettings, pageOverrides, pageIndex);
  }

  // Helper to read all values regardless of Map or plain object
  const allValues = ((): boolean[] => {
    if (applyMode instanceof Map) return Array.from(applyMode.values()).map(v => !!v);
    try {
      return Object.values(applyMode as Record<string, boolean>).map(v => !!v);
    } catch (_) {
      return [];
    }
  })();

  const allGlobal = allValues.length === 0 ? true : allValues.every(mode => mode === true);
  if (allGlobal) {
    return getEffectiveSettingsForPage(globalSettings, pageOverrides, pageIndex);
  }

  const pageOverride = ((): Partial<WordSearchSettings> => {
    if (!pageOverrides) return {} as Partial<WordSearchSettings>;
    if (pageOverrides instanceof Map) return pageOverrides.get(pageIndex) || {};
    return (pageOverrides as Record<number, Partial<WordSearchSettings>>)[pageIndex] || {};
  })();

  // Helper to read a single applyMode key from Map or object
  const getMode = (k: string): boolean | undefined => {
    if (applyMode instanceof Map) return applyMode.get(k) as boolean | undefined;
    return (applyMode as Record<string, boolean>)[k];
  };

  /** applyMode uses UI keys (e.g. `grid`); settings sections use `core`, etc. */
  const isCategoryLocal = (sectionKey: string, ...applyModeKeys: string[]): boolean => {
    if (getMode(sectionKey) === false) return true;
    return applyModeKeys.some((key) => getMode(key) === false);
  };

  // For each category, decide whether to use global or page-specific
  const result: WordSearchSettings = {
    bookCanvas: isCategoryLocal('bookCanvas') && pageOverride.bookCanvas
      ? { ...globalSettings.bookCanvas, ...pageOverride.bookCanvas }
      : globalSettings.bookCanvas,
    core: isCategoryLocal('core', 'grid') && pageOverride.core
      ? { ...globalSettings.core, ...pageOverride.core }
      : globalSettings.core,
    typography: isCategoryLocal('typography') && pageOverride.typography
      ? { ...globalSettings.typography, ...pageOverride.typography }
      : globalSettings.typography,
    wordList: isCategoryLocal('wordList') && pageOverride.wordList
      ? { ...globalSettings.wordList, ...pageOverride.wordList }
      : globalSettings.wordList,
    colors: isCategoryLocal('colors') && pageOverride.colors
      ? {
          ...globalSettings.colors,
          ...pageOverride.colors,
          puzzlePage: mergePuzzlePageColors(
            globalSettings.colors.puzzlePage,
            pageOverride.colors.puzzlePage
          ),
          answerPage: pageOverride.colors.answerPage
            ? { ...globalSettings.colors.answerPage, ...pageOverride.colors.answerPage }
            : globalSettings.colors.answerPage,
        }
      : globalSettings.colors,
    pageFrameSettings:
      isCategoryLocal('colors') && pageOverride.pageFrameSettings
        ? { ...globalSettings.pageFrameSettings, ...pageOverride.pageFrameSettings }
        : globalSettings.pageFrameSettings,
  };

  return result;
}
