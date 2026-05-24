/**
 * Utility for merging global settings with page-specific overrides.
 * Used by both preview rendering and PDF export for WYSIWYG consistency.
 */

import { WordSearchSettings } from './puzzles/types';

/**
 * Get the effective settings for a specific page by merging global settings with page overrides.
 * If a page override exists, it takes precedence over the global settings.
 */
export function getEffectiveSettingsForPage(
  globalSettings: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  pageIndex: number
): WordSearchSettings {
  const pageOverride = pageOverrides.get(pageIndex);
  
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
    },
  };
}

/**
 * Get settings for the current page, handling both global and local apply modes.
 * If a setting category is in "local" mode, use the page override for that category.
 * Otherwise, use the global setting.
 */
export function getMergedSettingsForPage(
  globalSettings: WordSearchSettings,
  pageOverrides: Map<number, Partial<WordSearchSettings>>,
  applyMode: Map<string, boolean>,
  pageIndex: number
): WordSearchSettings {
  // If all categories are in global mode, just use effective settings
  const allGlobal = Array.from(applyMode.values()).every(mode => mode === true);
  if (allGlobal) {
    return getEffectiveSettingsForPage(globalSettings, pageOverrides, pageIndex);
  }

  const pageOverride = pageOverrides.get(pageIndex) || {};

  // For each category, decide whether to use global or page-specific
  const result: WordSearchSettings = {
    bookCanvas: applyMode.get('bookCanvas') === false && pageOverride.bookCanvas
      ? { ...globalSettings.bookCanvas, ...pageOverride.bookCanvas }
      : globalSettings.bookCanvas,
    core: applyMode.get('core') === false && pageOverride.core
      ? { ...globalSettings.core, ...pageOverride.core }
      : globalSettings.core,
    typography: applyMode.get('typography') === false && pageOverride.typography
      ? { ...globalSettings.typography, ...pageOverride.typography }
      : globalSettings.typography,
    wordList: applyMode.get('wordList') === false && pageOverride.wordList
      ? { ...globalSettings.wordList, ...pageOverride.wordList }
      : globalSettings.wordList,
    colors: applyMode.get('colors') === false && pageOverride.colors
      ? { ...globalSettings.colors, ...pageOverride.colors }
      : globalSettings.colors,
  };

  return result;
}
