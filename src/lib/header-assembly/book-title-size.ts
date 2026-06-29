import type { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from '../puzzles/types';
import { getPageDimensionsInches } from '../puzzle-layout';
import {
  migrateLegacyHeaderLayout,
  normalizeHeaderAssemblySettings,
} from './types';
import { resolveHeaderTextParts } from './resolve-parts';
import { resolveHeaderBlockGeometry } from './geometry';
import { computeHeaderRowMetrics } from './compute-row';
import { resolveFittedHeaderTitleFontSizePt } from './fit-title';

export function isHeaderAssemblyEnabled(settings: WordSearchSettings): boolean {
  const raw =
    (settings.colors.puzzlePage as { headerAssembly?: unknown; headerLayout?: unknown })
      .headerAssembly ??
    migrateLegacyHeaderLayout(
      (settings.colors.puzzlePage as { headerLayout?: Record<string, unknown> }).headerLayout
    );
  return normalizeHeaderAssemblySettings(raw).enabled;
}

/** Fitted single-line title size for one puzzle page. */
export function resolvePageHeaderTitleFontSizePt(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings
): number {
  const parts = resolveHeaderTextParts(puzzle, settings, titleWords);
  const baseFontSizePt = settings.typography.puzzleTitleFontSize || 20;
  const titleFontFamily = settings.typography.puzzleTitleFontFamily || 'Arial';

  if (!parts.titleText) return baseFontSizePt;

  const dims = getPageDimensionsInches(settings);
  const pageWidthPt = dims.width * 72;
  const headerGeometry = resolveHeaderBlockGeometry(pageWidthPt, settings);

  let metrics = computeHeaderRowMetrics(headerGeometry.widthPt, baseFontSizePt, parts);
  let fitted = resolveFittedHeaderTitleFontSizePt(
    parts.titleText,
    baseFontSizePt,
    metrics.titleTextMaxWidthPt,
    titleFontFamily
  );

  if (Math.abs(fitted - baseFontSizePt) > 0.01) {
    metrics = computeHeaderRowMetrics(headerGeometry.widthPt, fitted, parts);
    fitted = resolveFittedHeaderTitleFontSizePt(
      parts.titleText,
      baseFontSizePt,
      metrics.titleTextMaxWidthPt,
      titleFontFamily
    );
  }

  return fitted;
}

export interface BookHeaderTitleSizeEntry {
  puzzle: WordSearchPuzzle;
  settings: WordSearchSettings;
}

/**
 * One title font size for the whole book — the smallest fit across every puzzle
 * (driven by the longest / tightest title), for a consistent header look.
 */
export function computeBookHeaderTitleFontSizePt(
  entries: BookHeaderTitleSizeEntry[],
  titleWords: TitleWordsSettings
): number | null {
  if (entries.length === 0) return null;

  let bookSizePt: number | null = null;
  let anyEnabled = false;

  for (const { puzzle, settings } of entries) {
    if (!isHeaderAssemblyEnabled(settings)) continue;
    anyEnabled = true;

    const pageSizePt = resolvePageHeaderTitleFontSizePt(puzzle, settings, titleWords);
    bookSizePt = bookSizePt == null ? pageSizePt : Math.min(bookSizePt, pageSizePt);
  }

  return anyEnabled ? bookSizePt : null;
}
