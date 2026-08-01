import type { PageNumberSettings } from './puzzles/types';
import { resolveBookPageNumberText } from './page-number/settings';
import type { ResolvedTocEntry } from './book-compiler';
import type { TextModuleSettings } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { normalizeTocSettings } from './toc-settings';
import { getPageDimensionsInches, getPageMarginInches } from './puzzle-layout';
import {
  resolveTextPageFrameSettings,
  resolveTextPageTitleFontSize,
} from './text-page-settings';

/** Use two columns when there are more than this many entries (auto mode default). */
export const TOC_TWO_COLUMN_MIN_ENTRIES = 7;

export function resolveTocTwoColumnMinEntries(
  tocSettings: ReturnType<typeof normalizeTocSettings>
): number {
  return tocSettings.twoColumnMinEntries ?? TOC_TWO_COLUMN_MIN_ENTRIES;
}

export function shouldUseTwoColumns(
  entries: ResolvedTocEntry[],
  settings: TextModuleSettings
): boolean {
  const toc = normalizeTocSettings(settings.tocSettings);
  if (toc.columnLayout === 'one') return false;
  if (toc.columnLayout === 'two') return entries.length >= 2;
  return entries.length >= resolveTocTwoColumnMinEntries(toc);
}

export interface TocLayoutMetrics {
  contentHeightPx: number;
  titleFontPx: number;
  entryFontPx: number;
  rowPaddingPx: number;
  lineSpacingPx: number;
  titleBottomGapPx?: number;
  entriesTopGapPx?: number;
}

export function resolveTocLineSpacingPx(
  tocSettings: ReturnType<typeof normalizeTocSettings>
): number {
  return tocSettings.lineSpacingPx ?? tocSettings.rowPaddingPx * 2 ?? 8;
}

export function buildTocLayoutMetrics(
  textSettings: TextModuleSettings,
  wordSearchSettings: WordSearchSettings,
  ptToPx: (pt: number) => number
): TocLayoutMetrics {
  const toc = normalizeTocSettings(textSettings.tocSettings);
  const dims = getPageDimensionsInches(wordSearchSettings);
  const marginIn = getPageMarginInches(wordSearchSettings);
  const pageFrame = resolveTextPageFrameSettings(textSettings, wordSearchSettings);
  const frameInsetIn = pageFrame.enabled ? pageFrame.marginSizeIn : 0;
  const innerPadPx = ptToPx(12);
  const safetyPx = 20;
  const titleGap = toc.titleBottomGapPx ?? 16;

  const entriesTopGap = toc.entriesTopGapPx ?? 0;
  // Full inner content box (after margins/frame/padding). Title + gaps subtracted at fit time.
  const contentHeightPx = Math.max(
    120,
    (dims.height - marginIn * 2 - frameInsetIn * 2) * 96 - innerPadPx * 2 - safetyPx
  );

  const lineSpacingPx = resolveTocLineSpacingPx(toc);

  return {
    contentHeightPx,
    titleFontPx: ptToPx(toc.titleFontSize ?? resolveTextPageTitleFontSize(textSettings)),
    entryFontPx: ptToPx(toc.entryFontSize ?? textSettings.fontSize ?? 18),
    rowPaddingPx: lineSpacingPx / 2,
    lineSpacingPx,
    titleBottomGapPx: titleGap,
    entriesTopGapPx: entriesTopGap,
  };
}

export function tocEntryOverrideKey(entry: ResolvedTocEntry): string {
  return `${entry.documentId}:${entry.bookPageIndex}:${entry.level}`;
}

export function applyTocEntryOverrides(
  entries: ResolvedTocEntry[],
  settings: TextModuleSettings
): ResolvedTocEntry[] {
  const titleOverrides = settings.tocEntryOverrides ?? {};
  const pageOverrides = settings.tocPageNumberOverrides ?? {};
  return entries.map((entry) => {
    const key = tocEntryOverrideKey(entry);
    const title = titleOverrides[key]?.trim();
    const pageNumber = pageOverrides[key]?.trim();
    return {
      ...entry,
      ...(title ? { title } : {}),
      ...(pageNumber ? { pageNumber } : {}),
    };
  });
}

function tocEntriesAvailableHeightPx(metrics: TocLayoutMetrics): number {
  const titleGap = metrics.titleBottomGapPx ?? 16;
  const entriesTop = metrics.entriesTopGapPx ?? 0;
  // Single-line title + gaps; small bottom cushion so last row isn’t clipped by overflow:hidden.
  const titleBlock = metrics.titleFontPx * 1.2 + titleGap + entriesTop;
  const bottomCushion = 8;
  return Math.max(80, metrics.contentHeightPx - titleBlock - bottomCushion);
}

export function estimateRowsPerColumn(metrics: TocLayoutMetrics): number {
  const lineSpacing = metrics.lineSpacingPx ?? metrics.rowPaddingPx * 2;
  const rowHeight = metrics.entryFontPx * 1.2 + lineSpacing;
  const available = tocEntriesAvailableHeightPx(metrics);
  return Math.max(4, Math.floor(available / Math.max(rowHeight, 1)));
}

export function resolveTocColumnCount(
  entryCount: number,
  settings: TextModuleSettings
): 1 | 2 {
  if (entryCount <= 0) return 1;
  // Reuse shouldUseTwoColumns with a stub entry list of the right length.
  const stubs = Array.from({ length: entryCount }, (_, i) => ({
    title: '',
    pageNumber: null,
    level: 1 as const,
    documentId: `stub-${i}`,
    bookPageIndex: i,
  }));
  return shouldUseTwoColumns(stubs, settings) ? 2 : 1;
}

const FIT_ENTRY_FONT_PT_MIN = 8;
const FIT_ENTRY_FONT_PT_MAX = 26;
const FIT_TITLE_SCALE = 1.15;

/**
 * Compute entry/title font + line spacing so all entries fit in `targetPageCount`
 * pages with the current column layout, without overlapping rows.
 */
export function fitTocTypographyToPages(
  entryCount: number,
  textSettings: TextModuleSettings,
  baseMetrics: TocLayoutMetrics,
  ptToPx: (pt: number) => number,
  targetPageCount: number
): TocLayoutMetrics {
  const toc = normalizeTocSettings(textSettings.tocSettings);
  const pages = Math.max(1, Math.min(12, targetPageCount));
  const columns = resolveTocColumnCount(entryCount, textSettings);
  const available = tocEntriesAvailableHeightPx(baseMetrics);

  if (entryCount <= 0) {
    return baseMetrics;
  }

  // Rows needed in the fullest column after even page distribution.
  const entriesPerPage = Math.ceil(entryCount / pages);
  const rowsNeeded = Math.max(1, Math.ceil(entriesPerPage / columns));
  const rowHeightBudget = available / rowsNeeded;

  // Prefer keeping ~28% of row for spacing; rest for text.
  let lineSpacingPx = Math.min(
    resolveTocLineSpacingPx(toc),
    Math.max(0, rowHeightBudget * 0.28)
  );
  let entryFontPx = (rowHeightBudget - lineSpacingPx) / 1.2;

  const minPx = ptToPx(FIT_ENTRY_FONT_PT_MIN);
  const maxPx = ptToPx(FIT_ENTRY_FONT_PT_MAX);

  if (entryFontPx > maxPx) {
    entryFontPx = maxPx;
    // Grow spacing to use leftover vertical space (no overlap).
    lineSpacingPx = Math.max(0, rowHeightBudget - entryFontPx * 1.2);
  } else if (entryFontPx < minPx) {
    entryFontPx = minPx;
    lineSpacingPx = Math.max(0, rowHeightBudget - entryFontPx * 1.2);
  }

  // Final safety: if still overflowing, collapse spacing.
  if (entryFontPx * 1.2 + lineSpacingPx > rowHeightBudget + 0.5) {
    lineSpacingPx = Math.max(0, rowHeightBudget - entryFontPx * 1.2);
  }

  const baseTitlePx = baseMetrics.titleFontPx;
  const fittedTitlePx = Math.max(
    ptToPx(14),
    Math.min(baseTitlePx, entryFontPx * FIT_TITLE_SCALE + ptToPx(4))
  );

  return {
    contentHeightPx: baseMetrics.contentHeightPx,
    titleFontPx: fittedTitlePx,
    entryFontPx,
    rowPaddingPx: lineSpacingPx / 2,
    lineSpacingPx,
    titleBottomGapPx: baseMetrics.titleBottomGapPx,
    entriesTopGapPx: baseMetrics.entriesTopGapPx,
  };
}

/** Build metrics, applying auto-fit when enabled (always fixed page count). */
export function resolveTocLayoutMetricsForEntries(
  entryCount: number,
  textSettings: TextModuleSettings,
  wordSearchSettings: WordSearchSettings,
  ptToPx: (pt: number) => number
): TocLayoutMetrics {
  const toc = normalizeTocSettings(textSettings.tocSettings);
  const base = buildTocLayoutMetrics(textSettings, wordSearchSettings, ptToPx);
  if (toc.autoFitText) {
    return fitTocTypographyToPages(entryCount, textSettings, base, ptToPx, toc.targetPageCount);
  }
  return base;
}

/** Split TOC entries evenly across the fixed page count. */
export function partitionTocEntries(
  entries: ResolvedTocEntry[],
  settings: TextModuleSettings,
  _metrics: TocLayoutMetrics
): ResolvedTocEntry[][] {
  if (entries.length === 0) return [[]];

  const toc = normalizeTocSettings(settings.tocSettings);
  const pageCount = Math.max(1, Math.min(12, toc.targetPageCount));
  return partitionEntriesEvenly(entries, pageCount);
}

/** Distribute entries as evenly as possible across a fixed number of pages. */
export function partitionEntriesEvenly(
  entries: ResolvedTocEntry[],
  pageCount: number
): ResolvedTocEntry[][] {
  const pages = Math.max(1, Math.min(12, pageCount));
  if (entries.length === 0) {
    return Array.from({ length: pages }, () => []);
  }
  const result: ResolvedTocEntry[][] = Array.from({ length: pages }, () => []);
  const base = Math.floor(entries.length / pages);
  const remainder = entries.length % pages;
  let offset = 0;
  for (let p = 0; p < pages; p++) {
    const size = base + (p < remainder ? 1 : 0);
    result[p] = entries.slice(offset, offset + size);
    offset += size;
  }
  return result;
}

/** Split a page slice into left/right columns for rendering. */
export function splitEntriesIntoColumns(
  entries: ResolvedTocEntry[],
  useTwoColumns: boolean
): { left: ResolvedTocEntry[]; right: ResolvedTocEntry[] } {
  if (!useTwoColumns || entries.length < 2) {
    return { left: entries, right: [] };
  }
  const mid = Math.ceil(entries.length / 2);
  return { left: entries.slice(0, mid), right: entries.slice(mid) };
}

export function remapTocEntriesAfterPageInsertion(
  entries: ResolvedTocEntry[],
  insertAfterIndex: number,
  pagesInserted: number,
  pageNumberSettings?: PageNumberSettings
): ResolvedTocEntry[] {
  return entries.map((entry) => {
    // Custom rows keep author-entered page numbers.
    if (entry.documentId.startsWith('custom:')) return entry;
    const shifted =
      entry.bookPageIndex > insertAfterIndex
        ? entry.bookPageIndex + pagesInserted
        : entry.bookPageIndex;
    return {
      ...entry,
      bookPageIndex: shifted,
      pageNumber: pageNumberSettings
        ? resolveBookPageNumberText(shifted, pageNumberSettings)
        : String(shifted + 1),
    };
  });
}
