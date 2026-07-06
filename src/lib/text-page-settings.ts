import type { TextModuleSettings } from './document-model';
import type { PageFrameSettings, WordSearchSettings } from './puzzles/types';
import { resolvePageFrameSettings } from './page-frame-settings';

export function resolveTextPageFrameSettings(
  textSettings: TextModuleSettings,
  globalSettings: WordSearchSettings
): PageFrameSettings {
  const global = resolvePageFrameSettings(globalSettings);
  if (!textSettings.useCustomFrame || !textSettings.pageFrameSettings) {
    return global;
  }
  return { ...global, ...textSettings.pageFrameSettings };
}

export function resolveTextPageBackground(
  textSettings: TextModuleSettings,
  globalSettings: WordSearchSettings
) {
  const global = globalSettings.colors.puzzlePage;
  if (!textSettings.useCustomBackground) {
    return global;
  }
  return {
    ...global,
    backgroundColor: textSettings.backgroundColor ?? global.backgroundColor,
    backgroundImage: textSettings.backgroundImage ?? global.backgroundImage,
    backgroundImageFit: textSettings.backgroundImageFit ?? global.backgroundImageFit,
    backgroundImageOpacity:
      textSettings.backgroundImageOpacity ?? global.backgroundImageOpacity,
  };
}

export function resolveTextPageTextColor(
  textSettings: TextModuleSettings,
  globalSettings: WordSearchSettings
): string {
  return textSettings.textColor ?? globalSettings.colors.puzzlePage.titleColor ?? '#1f2937';
}

export function resolveTextPageTitleFontSize(textSettings: TextModuleSettings): number {
  if (
    typeof textSettings.titleFontSize === 'number' &&
    Number.isFinite(textSettings.titleFontSize) &&
    textSettings.titleFontSize > 0
  ) {
    return textSettings.titleFontSize;
  }
  return textSettings.fontSize * 1.2;
}
