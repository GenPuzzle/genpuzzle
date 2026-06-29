import type { PageFrameSettings, WordSearchSettings } from './puzzles/types';
import {
  DEFAULT_FRAME_BORDER_ENABLED,
  DEFAULT_FRAME_BORDER_MARGIN_IN,
  resolveFrameEnabled,
  resolveFrameMargin,
} from './unified-background';

export type { PageFrameSettings };

export const DEFAULT_PAGE_FRAME_SETTINGS: PageFrameSettings = {
  enabled: DEFAULT_FRAME_BORDER_ENABLED,
  marginSizeIn: DEFAULT_FRAME_BORDER_MARGIN_IN,
  cornerRadiusPx: 4,
  strokeThicknessPx: 2,
  borderColor: '#1f2937',
};

export function resolvePageFrameSettings(settings: WordSearchSettings): PageFrameSettings {
  const stored = settings.pageFrameSettings;
  const legacy = settings.colors?.puzzlePage;

  return {
    enabled: stored?.enabled ?? resolveFrameEnabled(legacy?.backgroundImageFrameEnabled),
    marginSizeIn: stored?.marginSizeIn ?? resolveFrameMargin(legacy?.backgroundImageFrameMargin),
    cornerRadiusPx: stored?.cornerRadiusPx ?? DEFAULT_PAGE_FRAME_SETTINGS.cornerRadiusPx,
    strokeThicknessPx: stored?.strokeThicknessPx ?? DEFAULT_PAGE_FRAME_SETTINGS.strokeThicknessPx,
    borderColor: stored?.borderColor ?? DEFAULT_PAGE_FRAME_SETTINGS.borderColor,
  };
}

/** Apply a partial patch and keep legacy per-page margin fields in sync for background export. */
export function applyPageFrameSettingsPatch(
  current: WordSearchSettings,
  updates: Partial<PageFrameSettings>
): Partial<WordSearchSettings> {
  const next: PageFrameSettings = {
    ...resolvePageFrameSettings(current),
    ...updates,
  };

  return {
    pageFrameSettings: next,
    colors: {
      ...current.colors,
      puzzlePage: {
        ...current.colors.puzzlePage,
        backgroundImageFrameEnabled: next.enabled,
        backgroundImageFrameMargin: next.marginSizeIn,
      },
      answerPage: {
        ...current.colors.answerPage,
        backgroundImageFrameEnabled: next.enabled,
        backgroundImageFrameMargin: next.marginSizeIn,
      },
    },
  };
}
