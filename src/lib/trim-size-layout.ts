/**
 * Trim-size layout scaling — auto-adjusts fonts, grids, spacing, and borders
 * when the user changes book trim size (e.g. 8.5×11 → 6×9).
 *
 * Uses soft scaling from 8.5×11 reference. Example: word list 18 → 16 at 6×9.
 */

import type { WordSearchSettings, TitleWordsSettings } from './puzzles/types';
import { DEFAULT_TITLE_START_AT, DEFAULT_PAGE_NUMBER_SETTINGS, getDefaultWordSearchSettings } from './puzzles/types';
import type { HeaderAssemblySettings } from './header-assembly/types';
import { normalizeHeaderAssemblySettings } from './header-assembly/types';
import { normalizePageNumberSettings } from './page-number/settings';
import { resolvePageFrameSettings } from './page-frame-settings';
import { getEffectiveSettingsForPage } from './page-settings';
import { isTextModuleSettings, type DocumentPage } from './document-model';

export type TrimSizePresetId =
  | '5X8IN'
  | '5_25X8IN'
  | '5_5X8_5IN'
  | '6X9IN'
  | '5_06X7_81IN'
  | '6_14X9_21IN'
  | '6_69X9_61IN'
  | '7X10IN'
  | '7_44X9_69IN'
  | '7_5X9_25IN'
  | '8X10IN'
  | '8_5X11IN'
  | '8_27X11_69IN';

export const TRIM_SIZE_PRESETS: Record<TrimSizePresetId, { width: number; height: number }> = {
  '5X8IN': { width: 5, height: 8 },
  '5_25X8IN': { width: 5.25, height: 8 },
  '5_5X8_5IN': { width: 5.5, height: 8.5 },
  '6X9IN': { width: 6, height: 9 },
  '5_06X7_81IN': { width: 5.06, height: 7.81 },
  '6_14X9_21IN': { width: 6.14, height: 9.21 },
  '6_69X9_61IN': { width: 6.69, height: 9.61 },
  '7X10IN': { width: 7, height: 10 },
  '7_44X9_69IN': { width: 7.44, height: 9.69 },
  '7_5X9_25IN': { width: 7.5, height: 9.25 },
  '8X10IN': { width: 8, height: 10 },
  '8_5X11IN': { width: 8.5, height: 11 },
  '8_27X11_69IN': { width: 8.27, height: 11.69 },
};

export const REFERENCE_TRIM_WIDTH_IN = 8.5;
export const REFERENCE_TRIM_HEIGHT_IN = 11;

/** Soft scaling — 6×9 ≈ 0.905× reference (word list 18 → 16). */
const TRIM_SCALE_SOFTNESS = 0.4;

export function scaleInt(value: number, factor: number, min = 1): number {
  return Math.max(min, Math.round(value * factor));
}

export function scaleGridCells(value: number, factor: number): number {
  return Math.max(8, Math.min(20, Math.round(value * factor)));
}

export function scaleGridScalePercent(value: number, factor: number): number {
  return Math.max(50, Math.min(120, Math.round((value * factor) / 5) * 5));
}

export function computeTrimScaleFactor(widthIn: number, heightIn: number): number {
  const w = Math.max(1, widthIn);
  const h = Math.max(1, heightIn);
  const wRatio = w / REFERENCE_TRIM_WIDTH_IN;
  const hRatio = h / REFERENCE_TRIM_HEIGHT_IN;
  const avgRatio = (wRatio + hRatio) / 2;
  return 1 - (1 - avgRatio) * TRIM_SCALE_SOFTNESS;
}

export function computeTrimScaleRatio(
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): number {
  const from = computeTrimScaleFactor(fromWidth, fromHeight);
  const to = computeTrimScaleFactor(toWidth, toHeight);
  if (from <= 0) return to;
  return to / from;
}

export function resolveTrimDimensions(
  bookCanvas: WordSearchSettings['bookCanvas']
): { width: number; height: number } {
  if (!bookCanvas.useCustomTrim && bookCanvas.trimSizePreset) {
    const preset = TRIM_SIZE_PRESETS[bookCanvas.trimSizePreset as TrimSizePresetId];
    if (preset) return { ...preset };
  }
  return {
    width: bookCanvas.customWidth || REFERENCE_TRIM_WIDTH_IN,
    height: bookCanvas.customHeight || REFERENCE_TRIM_HEIGHT_IN,
  };
}

function scaleHeaderAssembly(
  current: HeaderAssemblySettings | undefined,
  ratio: number
): HeaderAssemblySettings {
  const ha = normalizeHeaderAssemblySettings(current);
  return normalizeHeaderAssemblySettings({
    ...ha,
    number: {
      ...ha.number,
      borderThicknessPx: scaleInt(ha.number.borderThicknessPx, ratio, 1),
    },
    title: {
      ...ha.title,
      borderThicknessPx: scaleInt(ha.title.borderThicknessPx, ratio, 1),
      borderRadiusPx: scaleInt(ha.title.borderRadiusPx, ratio, 2),
    },
    subtitle: {
      ...ha.subtitle,
      borderThicknessPx: scaleInt(ha.subtitle.borderThicknessPx, ratio, 1),
      borderRadiusPx: scaleInt(ha.subtitle.borderRadiusPx, ratio, 2),
    },
  });
}

/** Scale current settings by trim-size change ratio (preserves user customizations). */
export function applyTrimLayoutToSettings(
  current: WordSearchSettings,
  ratio: number
): Partial<WordSearchSettings> {
  if (Math.abs(ratio - 1) < 0.001) {
    return {};
  }

  const s = (val: number, min = 1) => scaleInt(val, ratio, min);
  const pageNumber = normalizePageNumberSettings(current.typography.pageNumber);
  const pageFrame = resolvePageFrameSettings(current);
  const answer = current.colors.answerPage;

  return {
    core: {
      ...current.core,
      lettersAcross: scaleGridCells(current.core.lettersAcross, ratio),
      lettersDown: scaleGridCells(current.core.lettersDown, ratio),
      borderStrokeThickness: s(current.core.borderStrokeThickness, 1),
      borderCornerRadius: s(current.core.borderCornerRadius, 1),
      gridBorderPadding: s(current.core.gridBorderPadding, 2),
      solutionBorderStrokeThickness: s(
        current.core.solutionBorderStrokeThickness ?? current.core.borderStrokeThickness,
        1
      ),
      solutionBorderCornerRadius: s(
        current.core.solutionBorderCornerRadius ?? current.core.borderCornerRadius,
        1
      ),
      solutionGridBorderPadding: s(current.core.solutionGridBorderPadding, 2),
      gridLinesStrokeThickness: s(current.core.gridLinesStrokeThickness, 0),
    },
    typography: {
      ...current.typography,
      puzzleTitleFontSize: s(current.typography.puzzleTitleFontSize, 10),
      answerTitleFontSize: s(current.typography.answerTitleFontSize, 10),
      subtitleFontSize: s(current.typography.subtitleFontSize, 8),
      puzzleGridFontSize: s(current.typography.puzzleGridFontSize, 8),
      answerGridFontSize: s(current.typography.answerGridFontSize, 8),
      titleStartAt: s(current.typography.titleStartAt, DEFAULT_TITLE_START_AT),
      spaceBetweenTitleAndPuzzle: s(current.typography.spaceBetweenTitleAndPuzzle, 4),
      spaceBetweenTitleAndAnswer: s(current.typography.spaceBetweenTitleAndAnswer, 4),
      spaceBetweenPuzzleAndWordList: s(current.typography.spaceBetweenPuzzleAndWordList, 4),
      subtitleToTitleGap: s(current.typography.subtitleToTitleGap, 2),
      subtitleToPuzzleGap: s(current.typography.subtitleToPuzzleGap, 2),
      subtitleBoxMargin: s(current.typography.subtitleBoxMargin, 0),
      subtitleTextScale: s(current.typography.subtitleTextScale, 100),
      pageNumber: {
        ...pageNumber,
        fontSize: s(pageNumber.fontSize, 8),
        bottomOffsetPx: s(pageNumber.bottomOffsetPx, DEFAULT_PAGE_NUMBER_SETTINGS.bottomOffsetPx),
        sideOffsetPx: s(pageNumber.sideOffsetPx, DEFAULT_PAGE_NUMBER_SETTINGS.sideOffsetPx),
        shape: {
          ...pageNumber.shape,
          borderThicknessPx: s(pageNumber.shape.borderThicknessPx, 1),
        },
      },
    },
    wordList: {
      ...current.wordList,
      wordListFontSize: s(current.wordList.wordListFontSize, 8),
      wordSpacingHorizontal: s(current.wordList.wordSpacingHorizontal, 16),
      wordSpacingVertical: s(current.wordList.wordSpacingVertical, 2),
      aiMaxWordLength: scaleGridCells(current.wordList.aiMaxWordLength, ratio),
    },
    colors: {
      puzzlePage: {
        ...current.colors.puzzlePage,
        headerAssembly: scaleHeaderAssembly(current.colors.puzzlePage.headerAssembly, ratio),
      },
      answerPage: {
        ...answer,
        solutionStrokeThickness: s(answer.solutionStrokeThickness, 4),
        solutionStrokePadding: s(answer.solutionStrokePadding, 0),
        solutionFrameRadius: s(answer.solutionFrameRadius, 1),
        answerTitleFontSize: s(answer.answerTitleFontSize, 10),
      },
    },
    pageFrameSettings: {
      ...pageFrame,
      cornerRadiusPx: s(pageFrame.cornerRadiusPx, 1),
      strokeThicknessPx: s(pageFrame.strokeThicknessPx, 1),
    },
  };
}

/** Apply a trim layout patch onto full settings (shared by global, overrides, and documents). */
export function mergeTrimLayoutPatch(
  current: WordSearchSettings,
  patch: Partial<WordSearchSettings>,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): WordSearchSettings {
  return {
    ...current,
    bookCanvas: { ...current.bookCanvas, ...nextBookCanvas },
    core: { ...current.core, ...patch.core },
    typography: { ...current.typography, ...patch.typography },
    wordList: { ...current.wordList, ...patch.wordList },
    colors: {
      puzzlePage: {
        ...current.colors.puzzlePage,
        ...patch.colors?.puzzlePage,
      },
      answerPage: {
        ...current.colors.answerPage,
        ...patch.colors?.answerPage,
      },
    },
    pageFrameSettings: patch.pageFrameSettings
      ? { ...current.pageFrameSettings, ...patch.pageFrameSettings }
      : current.pageFrameSettings,
  };
}

export function scaleWordSearchSettingsForTrim(
  current: WordSearchSettings,
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): WordSearchSettings {
  if (Math.abs(ratio - 1) < 0.001) {
    return { ...current, bookCanvas: { ...current.bookCanvas, ...nextBookCanvas } };
  }
  const patch = applyTrimLayoutToSettings(current, ratio);
  return mergeTrimLayoutPatch(current, patch, nextBookCanvas);
}

/** Scale a per-page override using the page's effective settings before trim. */
export function applyTrimLayoutToPageOverride(
  global: WordSearchSettings,
  override: Partial<WordSearchSettings>,
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): Partial<WordSearchSettings> {
  if (Math.abs(ratio - 1) < 0.001) {
    return override;
  }

  const effective = getEffectiveSettingsForPage(
    global,
    new Map<number, Partial<WordSearchSettings>>([[0, override]]),
    0
  );
  const scaled = scaleWordSearchSettingsForTrim(effective, ratio, nextBookCanvas);

  const result: Partial<WordSearchSettings> = {};
  if (override.bookCanvas !== undefined) result.bookCanvas = scaled.bookCanvas;
  if (override.core !== undefined) result.core = scaled.core;
  if (override.typography !== undefined) result.typography = scaled.typography;
  if (override.wordList !== undefined) result.wordList = scaled.wordList;
  if (override.colors !== undefined) result.colors = scaled.colors;
  if (override.pageFrameSettings !== undefined) result.pageFrameSettings = scaled.pageFrameSettings;
  return result;
}

export function scalePageOverridesForTrim(
  overrides: Map<number, Partial<WordSearchSettings>>,
  prevGlobal: WordSearchSettings,
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): Map<number, Partial<WordSearchSettings>> {
  if (Math.abs(ratio - 1) < 0.001 || overrides.size === 0) {
    return overrides;
  }

  const next = new Map<number, Partial<WordSearchSettings>>();
  for (const [pageIndex, override] of overrides) {
    next.set(
      pageIndex,
      applyTrimLayoutToPageOverride(prevGlobal, override, ratio, nextBookCanvas)
    );
  }
  return next;
}

export function scalePagePuzzleGridScalesForTrim(
  scales: Map<number, number>,
  ratio: number
): Map<number, number> {
  if (Math.abs(ratio - 1) < 0.001 || scales.size === 0) {
    return scales;
  }

  const next = new Map<number, number>();
  for (const [pageIndex, scale] of scales) {
    next.set(pageIndex, scaleGridScalePercent(scale, ratio));
  }
  return next;
}

export function scaleDocumentPagesForTrim(
  pages: DocumentPage[],
  ratio: number,
  nextBookCanvas: WordSearchSettings['bookCanvas']
): DocumentPage[] {
  if (Math.abs(ratio - 1) < 0.001) {
    return pages;
  }

  return pages.map((page) => {
    if (isTextModuleSettings(page.settings)) {
      const scaledBlocks = page.settings.blocks?.map((block) => ({
        ...block,
        fontSize: scaleInt(block.fontSize, ratio, 8),
      }));
      return {
        ...page,
        settings: {
          ...page.settings,
          fontSize: scaleInt(page.settings.fontSize, ratio, 10),
          titleFontSize: page.settings.titleFontSize
            ? scaleInt(page.settings.titleFontSize, ratio, 10)
            : page.settings.titleFontSize,
          blocks: scaledBlocks ?? page.settings.blocks,
        },
      };
    }
    if (page.moduleType === 'word-search') {
      const ps = page.settings as import('./document-model').PuzzleModuleSettings;
      const ws = ps.wordSearchSettings ?? getDefaultWordSearchSettings();
      const scaledWs = scaleWordSearchSettingsForTrim(ws, ratio, nextBookCanvas);
      return {
        ...page,
        settings: {
          ...ps,
          wordSearchSettings: scaledWs,
          titleWords: ps.titleWords
            ? applyTrimLayoutToTitleWords(ps.titleWords, ratio)
            : ps.titleWords,
        },
      };
    }
    return page;
  });
}

export function applyTrimLayoutToTitleWords(
  current: TitleWordsSettings,
  ratio: number
): TitleWordsSettings {
  if (Math.abs(ratio - 1) < 0.001) {
    return current;
  }
  return { ...current, fontSize: scaleInt(current.fontSize, ratio, 12) };
}
