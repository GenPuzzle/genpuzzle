import type { WordSearchSettings } from './puzzles/types';
import {
  migrateLegacyHeaderLayout,
  normalizeHeaderAssemblySettings,
  type HeaderAssemblySettings,
} from './header-assembly/types';
import {
  resolveHeaderBlockGeometry,
  resolveHeaderSubtitleTextWidthPt,
  resolvePageContentTopInsetPt,
} from './header-assembly/geometry';
import { measureHeaderAssemblyHeightPt } from './header-assembly/measure';
import { cssPxToPoints } from './puzzle-layout';
import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import type { HeaderTextParts } from './header-assembly/resolve-parts';

function wrapSubtitleLines(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  maxWidthPt: number
): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const ptToPx = 96 / 72;
  const maxWidthPx = maxWidthPt * ptToPx;
  const fontPx = fontSizePt * ptToPx;

  if (typeof document === 'undefined') {
    // SSR / export fallback — rough character estimate.
    const avgCharPx = fontPx * 0.55;
    const charsPerLine = Math.max(8, Math.floor(maxWidthPx / avgCharPx));
    const words = trimmed.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > charsPerLine && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [trimmed];
  ctx.font = `${fontPx}px ${fontFamily}`;
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidthPx && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function getHeaderAssemblySettings(
  settings: WordSearchSettings
): HeaderAssemblySettings {
  const raw =
    (settings.colors.puzzlePage as { headerAssembly?: unknown; headerLayout?: unknown })
      .headerAssembly ??
    migrateLegacyHeaderLayout(
      (settings.colors.puzzlePage as { headerLayout?: Record<string, unknown> }).headerLayout
    );
  return normalizeHeaderAssemblySettings(raw);
}

export function isGlobalHeaderAssemblyEnabled(settings: WordSearchSettings): boolean {
  return getHeaderAssemblySettings(settings).enabled;
}

/**
 * Build a Header Assembly block for crossword / sudoku / maze / cryptogram / scramble
 * using the global Style (word-search) Header Assembly settings and a resolved title.
 */
export function buildGenericHeaderAssembly(options: {
  settings: WordSearchSettings;
  pageWidthPt: number;
  titleText: string;
  /** Optional number badge text (leave empty when numbering is already in titleText). */
  numberText?: string;
  subtitleText?: string;
  titleFontSizePt?: number;
  titleColor?: string;
  subtitleFontSizePt?: number;
  subtitleColor?: string;
  subtitleFontFamily?: string;
  subtitleToTitleGapPt?: number;
  subtitleBoxMarginPt?: number;
  subtitleMaxWidthPercent?: number;
}): UnifiedHeaderAssemblyBlock | null {
  const {
    settings,
    pageWidthPt,
    titleText,
    numberText = '',
    subtitleText = '',
    titleFontSizePt,
    titleColor,
    subtitleFontSizePt,
    subtitleColor: customSubtitleColor,
    subtitleFontFamily: customSubtitleFontFamily,
    subtitleToTitleGapPt: customSubtitleToTitleGapPt,
    subtitleBoxMarginPt: customSubtitleBoxMarginPt,
    subtitleMaxWidthPercent: customSubtitleMaxWidthPercent,
  } = options;

  const headerAssemblySettings = getHeaderAssemblySettings(settings);
  if (!headerAssemblySettings.enabled) return null;

  const parts: HeaderTextParts = {
    numberText,
    titleText: (titleText || '').trim(),
    subtitleText: (subtitleText || '').trim(),
    showNumber: numberText.trim().length > 0,
  };
  if (!parts.titleText && !parts.showNumber && !parts.subtitleText) return null;

  const { typography, colors } = settings;
  const fittedTitleSizePt = titleFontSizePt ?? typography.puzzleTitleFontSize ?? 24;
  const subtitleSizePt = (subtitleFontSizePt ?? typography.subtitleFontSize) || 14;
  const subtitleToTitleGapPt = customSubtitleToTitleGapPt ?? typography.subtitleToTitleGap ?? 10;
  const subtitleBoxMarginPt = customSubtitleBoxMarginPt ?? typography.subtitleBoxMargin ?? 0;
  const subtitleMaxWidthPercent = customSubtitleMaxWidthPercent ?? typography.subtitleMaxWidthPercent ?? 100;
  const titleFontFamily = typography.puzzleTitleFontFamily || 'Arial';
  const subtitleFontFamily =
    customSubtitleFontFamily || typography.subtitleFontFamily || typography.puzzleTitleFontFamily || 'Arial';
  const subtitleColor = customSubtitleColor || colors.puzzlePage.subtitleColor || '#6b7280';
  // Word Search stores titleStartAt in points (0–200), same as the layout engine — do not * 72.
  const titleStartAtPt = Number.isFinite(typography.titleStartAt)
    ? Math.max(0, typography.titleStartAt)
    : 0;

  const contentTopPt = resolvePageContentTopInsetPt(settings);
  const headerGeometry = resolveHeaderBlockGeometry(pageWidthPt, settings);
  const subtitleTextWidthPt = resolveHeaderSubtitleTextWidthPt(
    headerGeometry.widthPt,
    subtitleMaxWidthPercent,
    subtitleBoxMarginPt
  );
  const subtitleInnerWidthPt = Math.max(24, subtitleTextWidthPt - cssPxToPoints(20));
  const subtitleLines = wrapSubtitleLines(
    parts.subtitleText,
    subtitleSizePt,
    subtitleFontFamily,
    subtitleInnerWidthPt
  );
  const subtitleLineCount =
    subtitleLines.length > 0 ? subtitleLines.length : parts.subtitleText ? 1 : 0;

  const headerHeightPt = measureHeaderAssemblyHeightPt(
    headerAssemblySettings,
    fittedTitleSizePt,
    subtitleSizePt,
    subtitleLineCount,
    parts.showNumber,
    subtitleToTitleGapPt
  );

  const topPt = Math.max(contentTopPt, headerGeometry.minTopPt + titleStartAtPt);

  return {
    topPt,
    leftPt: headerGeometry.leftPt,
    widthPt: headerGeometry.widthPt,
    heightPt: headerHeightPt,
    parts,
    subtitleLines,
    titleFontSizePt: fittedTitleSizePt,
    subtitleFontSizePt: subtitleSizePt,
    titleColor: titleColor || colors.puzzlePage.titleColor || '#000000',
    subtitleColor,
    fontFamily: titleFontFamily,
    subtitleFontFamily,
    settings: headerAssemblySettings,
    subtitleTextWidthPt,
  };
}

/** Horizontal/vertical content inset from page edge (frame inner edge or print margin). */
export function resolveGenericPageContentInsetPt(settings: WordSearchSettings): number {
  return resolvePageContentTopInsetPt(settings);
}

/**
 * Page surface (fill + optional image) from Style Color Settings.
 * Module backgroundColor is only a fallback when Style has no color.
 */
export function resolveGenericPageSurfaceColors(
  layoutSettings: WordSearchSettings,
  showSolution: boolean,
  moduleBackgroundColor?: string | null
) {
  const stylePage = showSolution
    ? layoutSettings.colors.answerPage
    : layoutSettings.colors.puzzlePage;
  const styleColor = stylePage.backgroundColor?.trim();
  const moduleColor = moduleBackgroundColor?.trim();
  return {
    ...stylePage,
    backgroundColor: styleColor || moduleColor || '#ffffff',
  };
}
