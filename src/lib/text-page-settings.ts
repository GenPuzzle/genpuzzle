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
  _globalSettings?: WordSearchSettings
): string {
  const color = textSettings.textColor?.trim();
  if (!color || isNearWhiteCssColor(color)) return '#000000';
  return color;
}

/** Pure white text is invisible on title/sep pages — treat as unset. */
export function isNearWhiteCssColor(color: string): boolean {
  const c = color.trim().toLowerCase();
  return (
    c === '#fff' ||
    c === '#ffffff' ||
    c === 'white' ||
    c === 'rgb(255,255,255)' ||
    c === 'rgb(255, 255, 255)' ||
    c === 'rgba(255,255,255,1)' ||
    c === 'rgba(255, 255, 255, 1)'
  );
}

export function resolveReadableTextPageColor(
  preferred: string | undefined | null,
  fallbackSettings: TextModuleSettings,
  globalSettings?: WordSearchSettings
): string {
  const candidate = preferred?.trim() || resolveTextPageTextColor(fallbackSettings, globalSettings);
  if (!candidate || isNearWhiteCssColor(candidate)) return '#000000';
  return candidate;
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
