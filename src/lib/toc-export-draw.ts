/**
 * Shared TOC geometry for canvas-matching PDF / PPT export.
 * Coordinates use page points with y measured from the top of the page
 * (callers convert to PDF bottom-left or PPT inches as needed).
 */

import type { WordSearchSettings } from './puzzles/types';
import type { TextModuleSettings } from './document-model';
import type { ResolvedTocEntry } from './book-compiler';
import { getPageDimensionsInches, getPageMarginInches } from './puzzle-layout';
import {
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
  resolveTextPageTitleFontSize,
} from './text-page-settings';
import { displayTocPageNumber, normalizeTocSettings, tocEntryIndentPx, DEFAULT_TOC_SETTINGS, type TocLeaderStyle, type TocTableFormat } from './toc-settings';
import {
  resolveTocLayoutMetricsForEntries,
  shouldUseTwoColumns,
  splitEntriesIntoColumns,
} from './toc-layout';

const PX_TO_PT = 72 / 96;

export interface TocExportRow {
  title: string;
  pageNumber: string;
  indentPt: number;
  yFromTopPt: number;
  showLeader: boolean;
  leaderStyle: TocLeaderStyle;
  simple: boolean;
}

export interface TocExportColumn {
  xPt: number;
  widthPt: number;
  rows: TocExportRow[];
}

export interface TocExportLayout {
  titleText: string;
  titleXPt: number;
  titleYFromTopPt: number;
  titleFontSizePt: number;
  titleColor: string;
  titleFontFamily: string;
  titleBold: boolean;
  titleAlign: 'left' | 'center' | 'right';
  entryFontSizePt: number;
  entryColor: string;
  entryFontFamily: string;
  entryBold: boolean;
  entryLetterSpacingPt: number;
  entryGapPt: number;
  entryLineHeightPt: number;
  rowPadPt: number;
  rowHeightPt: number;
  columns: TocExportColumn[];
}

function pxToPt(px: number): number {
  return px * PX_TO_PT;
}

export function buildTocExportLayout(
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  entries: ResolvedTocEntry[],
  pageTitle: string,
  totalEntryCount?: number
): TocExportLayout {
  const toc = normalizeTocSettings(settings.tocSettings);
  const dims = getPageDimensionsInches(layoutSettings);
  const pageWidthPt = dims.width * 72;
  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const pageFrame = resolveTextPageFrameSettings(settings, layoutSettings);
  const frameInsetPt = pageFrame.enabled ? pageFrame.marginSizeIn * 72 : 0;
  const padPt = 12;

  const ptToPx = (pt: number) => pt * (96 / 72);
  const fit = resolveTocLayoutMetricsForEntries(
    totalEntryCount ?? entries.length,
    settings,
    layoutSettings,
    ptToPx
  );

  const titleFontSizePt = pxToPt(fit.titleFontPx);
  const entryFontSizePt = pxToPt(fit.entryFontPx);
  const rowPadPt = pxToPt(fit.rowPaddingPx);
  const titleGapPt = pxToPt(toc.titleBottomGapPx ?? DEFAULT_TOC_SETTINGS.titleBottomGapPx);
  const entriesTopGapPt = pxToPt(toc.entriesTopGapPx ?? DEFAULT_TOC_SETTINGS.entriesTopGapPx);
  const columnGapPt = pxToPt(toc.columnGapPx ?? DEFAULT_TOC_SETTINGS.columnGapPx);
  const entryGapPt = pxToPt(toc.entryHorizontalGapPx ?? DEFAULT_TOC_SETTINGS.entryHorizontalGapPx);
  const entryLetterSpacingPt = pxToPt(toc.entryLetterSpacingPx ?? DEFAULT_TOC_SETTINGS.entryLetterSpacingPx);
  const entryLineHeightPt = entryFontSizePt * 1.2;
  const rowHeightPt = entryLineHeightPt + rowPadPt * 2;

  const contentLeft = marginPt + frameInsetPt + padPt;
  const contentRight = pageWidthPt - marginPt - frameInsetPt - padPt;
  const contentWidth = Math.max(40, contentRight - contentLeft);
  const contentTop = marginPt + frameInsetPt + padPt;

  const alignment = settings.alignment || 'left';
  const defaultColor = resolveTextPageTextColor(settings, layoutSettings);
  const titleColor = toc.titleTextColor || defaultColor;
  const entryColor = toc.entryTextColor || defaultColor;

  const heading =
    (settings.tocPageIndex ?? 0) > 0
      ? `${settings.title || pageTitle} (${(settings.tocPageIndex ?? 0) + 1})`
      : settings.title || pageTitle;

  const useTwo = shouldUseTwoColumns(entries, settings);
  const { left, right } = splitEntriesIntoColumns(entries, useTwo);
  const columnsSrc = right.length > 0 ? [left, right] : [left];
  const colCount = columnsSrc.length;
  const colWidth =
    colCount > 1 ? (contentWidth - columnGapPt * (colCount - 1)) / colCount : contentWidth;

  const simple = toc.tableFormat === 'simple' || toc.leaderStyle === 'none';
  const showLeaderLine =
    toc.showPageNumbers &&
    !simple &&
    toc.leaderStyle !== 'none' &&
    toc.leaderStyle !== 'spaces';

  const columns: TocExportColumn[] = columnsSrc.map((colEntries, colIdx) => {
    const xPt = contentLeft + colIdx * (colWidth + columnGapPt);
    const rows: TocExportRow[] = [];
    let y = contentTop + titleFontSizePt * 1.2 + titleGapPt + entriesTopGapPt;
    for (const entry of colEntries) {
      const pageNumber = displayTocPageNumber(entry, toc.showPageNumbers);
      rows.push({
        title: entry.title,
        pageNumber,
        indentPt: pxToPt(tocEntryIndentPx(toc, entry.level)),
        yFromTopPt: y,
        showLeader: showLeaderLine && !!pageNumber,
        leaderStyle: toc.leaderStyle,
        simple,
      });
      y += rowHeightPt;
    }
    return { xPt, widthPt: colWidth, rows };
  });

  return {
    titleText: heading,
    titleXPt: contentLeft,
    titleYFromTopPt: contentTop,
    titleFontSizePt:
      titleFontSizePt ||
      (toc.titleFontSize ?? resolveTextPageTitleFontSize(settings)),
    titleColor,
    titleFontFamily: toc.titleFontFamily || settings.fontFamily || 'Arial',
    titleBold: toc.titleFontWeight !== false,
    titleAlign: alignment,
    entryFontSizePt: entryFontSizePt || (toc.entryFontSize ?? settings.fontSize ?? 18),
    entryColor,
    entryFontFamily: toc.entryFontFamily || settings.fontFamily || 'Arial',
    entryBold: !!toc.entryFontWeight,
    entryLetterSpacingPt,
    entryGapPt,
    entryLineHeightPt,
    rowPadPt,
    rowHeightPt,
    columns,
  };
}

export function tocLeaderDashPattern(style: TocLeaderStyle): number[] | null {
  if (style === 'dashes') return [4, 3];
  if (style === 'dots') return [1, 2.5];
  return null;
}

export function isTocModuleSettings(settings: TextModuleSettings): boolean {
  return settings.tocMode === 'auto' || settings.tocMode === 'manual';
}

/** Fallback when resolvedToc is missing — parse plain `formatTocLines` content. */
export function parseTocEntriesFromContent(
  content: string,
  tableFormat: TocTableFormat
): ResolvedTocEntry[] {
  const lines = (content || '')
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
  return lines.map((line, index) => {
    const indented = tableFormat === 'indented' && /^\s{2,}/.test(line);
    const cleaned = line.trim();
    const match = cleaned.match(/^(.*?)(?:\s+([\dA-Za-zivxlcdmIVXLCDM]+))?$/);
    const title = (match?.[1] || cleaned).replace(/[\s.·—-]+$/g, '').trim() || cleaned;
    const pageNumber = match?.[2] ?? null;
    return {
      title,
      pageNumber,
      level: indented ? (2 as const) : (1 as const),
      documentId: `content-line-${index}`,
      bookPageIndex: index,
    };
  });
}
