/**
 * Crossword puzzle-page geometry vs clue-area fitting.
 *
 * Grid size, Grid Scale, cell size, and font sizes are derived from the current
 * document settings and stay identical on every puzzle page. Clue overflow is
 * solved by compressing spacing first. Auto-balance may also reduce Grid Scale
 * so clue type can stay at 18+. Leftover vertical space is filled by expanding
 * spacing so clues reach the page-number / safe-margin zone.
 */

import type { CrosswordPuzzle, WordSearchSettings } from './puzzles/types';
import type { CrosswordSettings } from './crossword-settings';
import { cssPxToPoints } from './puzzle-layout';
import { resolveGenericPageContentInsetPt } from './generic-page-chrome';
import { computePageNumberLayout } from './page-number/layout';
import { normalizePageNumberSettings } from './page-number/settings';
import { placeFixedUniformGrid, type FittedGrid } from './generic-puzzle-geometry';

interface RectPt {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
}

/** Extra gap so the last clue does not visually touch the page number. */
export const CROSSWORD_PAGE_NUMBER_CLEARANCE_PT = 12;

export const MIN_CLUE_ITEM_GAP_PX = 1;
export const MIN_CLUE_HEADING_AFTER_PX = 2;
export const MIN_CLUE_SECTION_GAP_PX = 6;
export const MIN_CLUE_COLUMN_GAP_PX = 8;
export const MIN_CLUE_LINE_HEIGHT_FACTOR = 1.08;
export const DEFAULT_CLUE_LINE_HEIGHT_FACTOR = 1.25;
export const DEFAULT_CLUE_HEADING_AFTER_PX = 8;
export const DEFAULT_CLUE_SECTION_GAP_PX = 14;
export const MAX_CLUE_LINE_HEIGHT_FACTOR = 1.5;
export const AUTO_BALANCE_MIN_CLUE_ITEM_GAP_PX = 4;
export const AUTO_BALANCE_MIN_CLUE_HEADING_AFTER_PX = 4;
export const AUTO_BALANCE_MIN_CLUE_SECTION_GAP_PX = 8;
export const AUTO_BALANCE_MIN_CLUE_COLUMN_GAP_PX = 10;
export const AUTO_BALANCE_MIN_CLUE_LINE_HEIGHT_FACTOR = 1.15;
export const AUTO_BALANCE_MIN_GRID_CLUE_GAP_PT = 10;

export interface CrosswordClueSpacing {
  itemGap: number;
  lineHeightFactor: number;
  headingAfter: number;
  sectionGap: number;
  columnGap: number;
}

export interface CrosswordClueFitResult {
  spacing: CrosswordClueSpacing;
  acrossLineCounts: number[];
  downLineCounts: number[];
  requiredHeight: number;
  fits: boolean;
}

export interface CrosswordPuzzleBodyLayout {
  cellPt: number;
  grid: FittedGrid;
  cluesRect: RectPt;
  spacing: CrosswordClueSpacing;
  clueFontSize: number;
  headingFontSize: number;
  columns: 1 | 2;
  acrossLineCounts: number[];
  downLineCounts: number[];
  fits: boolean;
  pageNumberZoneTopPt: number;
}

export interface CrosswordPageValidation {
  gridInsideSafeMargins: boolean;
  cluesInsideSafeMargins: boolean;
  titleInsideSafeMargins: boolean;
  pageNumberInsideSafeMargins: boolean;
  cluesOverlapPageNumber: boolean;
  cluesOverlapGrid: boolean;
  gridOverlapPageNumber: boolean;
  clueTextOverlap: boolean;
}

export interface CrosswordSetConsistency {
  allPuzzleGridWidthsAreEqual: boolean;
  allPuzzleGridHeightsAreEqual: boolean;
  allGridCellSizesAreEqual: boolean;
  allGridFontSizesAreEqual: boolean;
  allClueFontSizesAreEqual: boolean;
  allTitleFontSizesAreEqual: boolean;
}

export function crosswordFixedCellCssPx(
  cw: CrosswordSettings,
  options?: { showSolution?: boolean; multiShrink?: number }
): number {
  const showSolution = options?.showSolution === true;
  const multiShrink = options?.multiShrink ?? 1;
  const scaleFactor =
    ((showSolution ? cw.core.solutionGridScale : cw.core.puzzleGridScale) || 100) / 100;
  const sizePercent = (cw.core.puzzleSizePercent || 60) / 60;
  return Math.max(10, Math.round(28 * sizePercent * scaleFactor * multiShrink));
}

export function crosswordFixedCellPt(
  cw: CrosswordSettings,
  options?: { showSolution?: boolean; multiShrink?: number }
): number {
  return cssPxToPoints(crosswordFixedCellCssPx(cw, options));
}

export function resolveCrosswordPageNumberZoneTopPt(
  pageWidthPt: number,
  pageHeightPt: number,
  layoutSettings: WordSearchSettings
): number {
  const marginPt = resolveGenericPageContentInsetPt(layoutSettings);
  const fallback = pageHeightPt - marginPt;
  const pageNumberSettings = normalizePageNumberSettings(layoutSettings.typography.pageNumber);
  if (!pageNumberSettings.enabled) return fallback;

  const visibleIndex = Math.max(0, pageNumberSettings.startAtPage - 1);
  const layout = computePageNumberLayout(
    pageWidthPt,
    pageHeightPt,
    layoutSettings,
    visibleIndex,
    pageNumberSettings
  );
  if (!layout) return fallback;
  return Math.max(marginPt, layout.topPt - CROSSWORD_PAGE_NUMBER_CLEARANCE_PT);
}

export function crosswordClueSpacingFromSettings(
  cw: CrosswordSettings,
  toUnit: (px: number) => number = identityPx
): CrosswordClueSpacing {
  return {
    itemGap: toUnit(Math.max(0, cw.typography.clueSpaceVertical ?? 4)),
    lineHeightFactor: DEFAULT_CLUE_LINE_HEIGHT_FACTOR,
    headingAfter: toUnit(DEFAULT_CLUE_HEADING_AFTER_PX),
    sectionGap: toUnit(DEFAULT_CLUE_SECTION_GAP_PX),
    columnGap: toUnit(Math.max(0, cw.typography.clueSpaceHorizontal ?? 24)),
  };
}

export function minCrosswordClueSpacing(
  toUnit: (px: number) => number = identityPx
): CrosswordClueSpacing {
  return {
    itemGap: toUnit(MIN_CLUE_ITEM_GAP_PX),
    lineHeightFactor: MIN_CLUE_LINE_HEIGHT_FACTOR,
    headingAfter: toUnit(MIN_CLUE_HEADING_AFTER_PX),
    sectionGap: toUnit(MIN_CLUE_SECTION_GAP_PX),
    columnGap: toUnit(MIN_CLUE_COLUMN_GAP_PX),
  };
}

/** Readable floor used while Auto-balance is on — never pack tighter than this. */
export function autoBalanceMinCrosswordClueSpacing(
  toUnit: (px: number) => number = identityPx
): CrosswordClueSpacing {
  return {
    itemGap: toUnit(AUTO_BALANCE_MIN_CLUE_ITEM_GAP_PX),
    lineHeightFactor: AUTO_BALANCE_MIN_CLUE_LINE_HEIGHT_FACTOR,
    headingAfter: toUnit(AUTO_BALANCE_MIN_CLUE_HEADING_AFTER_PX),
    sectionGap: toUnit(AUTO_BALANCE_MIN_CLUE_SECTION_GAP_PX),
    columnGap: toUnit(AUTO_BALANCE_MIN_CLUE_COLUMN_GAP_PX),
  };
}

function identityPx(px: number): number {
  return px;
}

/** Word-wrap estimate. Argument order matches measureLineCount: (text, fontSize, colWidth). */
export function estimateWrapLineCount(
  text: string,
  fontSize: number,
  maxWidth: number,
  glyphFactor = 0.52
): number {
  const trimmed = (text || '').trim();
  if (!trimmed) return 1;
  const width = Math.max(1, maxWidth);
  const avg = Math.max(0.01, fontSize * glyphFactor);
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let current = 0;
  for (const word of words) {
    const wordW = Math.max(avg, word.length * avg);
    const extra = current > 0 ? avg * 0.35 : 0;
    if (current > 0 && current + extra + wordW > width) {
      lines += 1;
      current = wordW;
      continue;
    }
    current += extra + wordW;
  }
  return Math.max(1, lines);
}

export function measureCrosswordClueColumnHeight(
  lineCounts: number[],
  fontSize: number,
  headingFontSize: number,
  spacing: CrosswordClueSpacing
): number {
  const headingH = headingFontSize * 1.35 + spacing.headingAfter;
  if (lineCounts.length === 0) return headingH;
  let cluesH = 0;
  for (let i = 0; i < lineCounts.length; i++) {
    const lines = Math.max(1, lineCounts[i] ?? 1);
    cluesH += lines * fontSize * spacing.lineHeightFactor;
    if (i < lineCounts.length - 1) cluesH += spacing.itemGap;
  }
  return headingH + cluesH;
}

export function measureCrosswordClueBlockHeight(
  acrossLineCounts: number[],
  downLineCounts: number[],
  columns: 1 | 2,
  fontSize: number,
  headingFontSize: number,
  spacing: CrosswordClueSpacing
): number {
  const acrossH = measureCrosswordClueColumnHeight(
    acrossLineCounts,
    fontSize,
    headingFontSize,
    spacing
  );
  const downH = measureCrosswordClueColumnHeight(
    downLineCounts,
    fontSize,
    headingFontSize,
    spacing
  );
  if (columns === 2) return Math.max(acrossH, downH);
  return acrossH + spacing.sectionGap + downH;
}

function columnWidth(availableWidth: number, columns: 1 | 2, columnGap: number): number {
  if (columns === 1) return Math.max(8, availableWidth);
  return Math.max(8, (availableWidth - Math.max(0, columnGap)) / 2);
}

function lineCountsForWidth(
  clues: string[],
  colW: number,
  fontSize: number,
  measure: (text: string, fontSize: number, colWidth: number) => number
): number[] {
  return clues.map((text) => Math.max(1, measure(text, fontSize, colW)));
}

function cloneSpacing(spacing: CrosswordClueSpacing): CrosswordClueSpacing {
  return { ...spacing };
}

function stepToward(current: number, min: number, step: number): number {
  if (current <= min) return min;
  return Math.max(min, current - step);
}

export function fitCrosswordClueSpacing(input: {
  availableHeight: number;
  availableWidth: number;
  columns: 1 | 2;
  clueFontSize: number;
  headingFontSize: number;
  preferred: CrosswordClueSpacing;
  min?: CrosswordClueSpacing;
  acrossTexts: string[];
  downTexts: string[];
  measureLineCount?: (text: string, fontSize: number, colWidth: number) => number;
  step?: number;
}): CrosswordClueFitResult {
  const measure = input.measureLineCount ?? estimateWrapLineCount;
  const min = input.min ?? minCrosswordClueSpacing();
  const step = Math.max(0.05, input.step ?? 0.5);
  const spacing = cloneSpacing(input.preferred);

  const evaluate = (next: CrosswordClueSpacing): CrosswordClueFitResult => {
    const colW = columnWidth(input.availableWidth, input.columns, next.columnGap);
    const acrossLineCounts = lineCountsForWidth(
      input.acrossTexts,
      colW,
      input.clueFontSize,
      measure
    );
    const downLineCounts = lineCountsForWidth(input.downTexts, colW, input.clueFontSize, measure);
    const requiredHeight = measureCrosswordClueBlockHeight(
      acrossLineCounts,
      downLineCounts,
      input.columns,
      input.clueFontSize,
      input.headingFontSize,
      next
    );
    return {
      spacing: cloneSpacing(next),
      acrossLineCounts,
      downLineCounts,
      requiredHeight,
      fits: requiredHeight <= input.availableHeight + 0.25,
    };
  };

  let result = evaluate(spacing);
  if (input.availableHeight <= 0) return result;

  if (!result.fits) {
    const shrinkField = (
      field: 'itemGap' | 'headingAfter' | 'sectionGap' | 'columnGap' | 'lineHeightFactor'
    ) => {
      const floor = min[field];
      let guard = 0;
      while (!result.fits && spacing[field] > floor && guard < 80) {
        spacing[field] = stepToward(
          spacing[field],
          floor,
          field === 'lineHeightFactor' ? 0.02 : step
        );
        result = evaluate(spacing);
        guard += 1;
      }
    };

    // Progressive fitting: item gap → line height → heading/section → column gap.
    shrinkField('itemGap');
    shrinkField('lineHeightFactor');
    shrinkField('headingAfter');
    shrinkField('sectionGap');
    shrinkField('columnGap');
  }

  return result;
}

function expandCrosswordClueSpacingToFill(
  input: {
    availableHeight: number;
    columns: 1 | 2;
    clueFontSize: number;
    headingFontSize: number;
  },
  result: CrosswordClueFitResult,
  evaluate: (next: CrosswordClueSpacing) => CrosswordClueFitResult
): CrosswordClueFitResult {
  const leftover0 = input.availableHeight - result.requiredHeight;
  if (leftover0 <= 0.6) return result;

  const spacing = cloneSpacing(result.spacing);
  const acrossLines = result.acrossLineCounts.reduce((sum, n) => sum + Math.max(1, n), 0);
  const downLines = result.downLineCounts.reduce((sum, n) => sum + Math.max(1, n), 0);
  const acrossN = result.acrossLineCounts.length;
  const downN = result.downLineCounts.length;
  const acrossH = measureCrosswordClueColumnHeight(
    result.acrossLineCounts,
    input.clueFontSize,
    input.headingFontSize,
    spacing
  );
  const downH = measureCrosswordClueColumnHeight(
    result.downLineCounts,
    input.clueFontSize,
    input.headingFontSize,
    spacing
  );
  const tallerIsAcross = input.columns === 2 ? acrossH >= downH : true;
  const tallerLines =
    input.columns === 2
      ? tallerIsAcross
        ? acrossLines
        : downLines
      : acrossLines + downLines;
  const tallerGaps =
    input.columns === 2
      ? Math.max(0, (tallerIsAcross ? acrossN : downN) - 1)
      : Math.max(0, acrossN - 1) + Math.max(0, downN - 1);

  let leftover = leftover0;
  const font = Math.max(1, input.clueFontSize);

  if (tallerLines > 0 && spacing.lineHeightFactor < MAX_CLUE_LINE_HEIGHT_FACTOR) {
    const room = (MAX_CLUE_LINE_HEIGHT_FACTOR - spacing.lineHeightFactor) * font * tallerLines;
    const use = Math.min(leftover * 0.35, Math.max(0, room));
    if (use > 0.2) {
      spacing.lineHeightFactor += use / (font * tallerLines);
      leftover -= use;
    }
  }

  const headingMax = Math.max(spacing.headingAfter, input.headingFontSize * 0.85);
  const headingAdd = Math.min(leftover * 0.12, Math.max(0, headingMax - spacing.headingAfter));
  if (headingAdd > 0.2) {
    spacing.headingAfter += headingAdd;
    leftover -= headingAdd;
  }

  if (input.columns === 1 && leftover > 0.2) {
    const sectionAdd = Math.min(leftover * 0.1, input.headingFontSize);
    spacing.sectionGap += sectionAdd;
    leftover -= sectionAdd;
  }

  if (leftover > 0.2) {
    if (tallerGaps > 0) {
      spacing.itemGap += Math.max(0, leftover - 0.75) / tallerGaps;
    } else if (tallerLines > 0) {
      spacing.lineHeightFactor += Math.max(0, leftover - 0.75) / (font * tallerLines);
    } else {
      spacing.headingAfter += Math.max(0, leftover - 0.75);
    }
  }

  const expanded = evaluate(spacing);
  if (expanded.fits) return expanded;

  // If the one-shot fill overshot, keep as much extra item gap as still fits.
  if (tallerGaps > 0 && spacing.itemGap > result.spacing.itemGap) {
    let lo = result.spacing.itemGap;
    let hi = spacing.itemGap;
    let best = result;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const trial = evaluate({ ...result.spacing, itemGap: mid });
      if (trial.fits) {
        best = trial;
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return best;
  }
  return result;
}

function clueTexts(
  clues: CrosswordPuzzle['acrossClues'] | CrosswordPuzzle['downClues']
): string[] {
  return clues.map((clue) => `${clue.number}. ${clue.clue}`);
}

export function computeCrosswordPuzzleBodyLayout(input: {
  puzzle: CrosswordPuzzle;
  cw: CrosswordSettings;
  slot: RectPt;
  preferredCellPt: number;
  clueGapPt: number;
  pageNumberZoneTopPt: number;
  measureLineCount?: (text: string, fontSize: number, colWidth: number) => number;
}): CrosswordPuzzleBodyLayout {
  const { puzzle, cw, slot } = input;
  const rows = Math.max(1, puzzle.grid.length);
  const cols = Math.max(1, puzzle.grid[0]?.length ?? 0);
  // Clamp only to the shared page box (margins + page-number zone), never to clue length.
  const maxGridWidthPt = Math.max(8, slot.widthPt);
  const maxGridHeightPt = Math.max(8, input.pageNumberZoneTopPt - slot.topPt);
  const cellPt = Math.min(
    input.preferredCellPt,
    maxGridWidthPt / cols,
    maxGridHeightPt / rows
  );
  const grid = placeFixedUniformGrid(cols, rows, cellPt, slot);
  const clueBottomLimit = Math.min(
    slot.topPt + slot.heightPt,
    input.pageNumberZoneTopPt
  );
  const cluesTop = grid.topPt + grid.heightPt + Math.max(0, input.clueGapPt);
  const cluesRect: RectPt = {
    leftPt: slot.leftPt,
    topPt: cluesTop,
    widthPt: slot.widthPt,
    heightPt: Math.max(0, clueBottomLimit - cluesTop),
  };

  const toPt = cssPxToPoints;
  const columns: 1 | 2 = cw.typography.clueLayout === 'single' ? 1 : 2;
  const clueFontSize = toPt(cw.typography.clueFontSize || 12);
  const headingFontSize = toPt(
    cw.typography.acrossDownFontSize || (cw.typography.clueFontSize || 12) + 2
  );
  const fit = fitCrosswordClueSpacing({
    availableHeight: cluesRect.heightPt,
    availableWidth: cluesRect.widthPt,
    columns,
    clueFontSize,
    headingFontSize,
    preferred: crosswordClueSpacingFromSettings(cw, toPt),
    min: minCrosswordClueSpacing(toPt),
    acrossTexts: clueTexts(puzzle.acrossClues),
    downTexts: clueTexts(puzzle.downClues),
    measureLineCount: input.measureLineCount,
    step: toPt(0.5),
  });

  return {
    cellPt: grid.cellPt,
    grid,
    cluesRect,
    spacing: fit.spacing,
    clueFontSize,
    headingFontSize,
    columns,
    acrossLineCounts: fit.acrossLineCounts,
    downLineCounts: fit.downLineCounts,
    fits: fit.fits,
    pageNumberZoneTopPt: input.pageNumberZoneTopPt,
  };
}

export function validateCrosswordPuzzlePageLayout(input: {
  pageWidthPt: number;
  pageHeightPt: number;
  marginPt: number;
  pageNumberZoneTopPt: number;
  titleBox?: RectPt | null;
  pageNumberBox?: RectPt | null;
  grid: FittedGrid;
  cluesRect: RectPt;
  clueContentBottomPt: number;
  spacing: CrosswordClueSpacing;
}): CrosswordPageValidation {
  const { marginPt, pageWidthPt, pageHeightPt, pageNumberZoneTopPt } = input;
  const right = pageWidthPt - marginPt;
  const bottom = pageHeightPt - marginPt;

  const rectInside = (r: RectPt | FittedGrid | null | undefined) => {
    if (!r) return true;
    const left = 'leftPt' in r ? r.leftPt : 0;
    const top = 'topPt' in r ? r.topPt : 0;
    const width = 'widthPt' in r ? r.widthPt : 0;
    const height = 'heightPt' in r ? r.heightPt : 0;
    return (
      left >= marginPt - 0.5 &&
      top >= marginPt - 0.5 &&
      left + width <= right + 0.5 &&
      top + height <= bottom + 0.5
    );
  };

  const gridBottom = input.grid.topPt + input.grid.heightPt;
  const cluesBottom = Math.max(input.cluesRect.topPt + input.cluesRect.heightPt, input.clueContentBottomPt);

  return {
    gridInsideSafeMargins: rectInside(input.grid),
    cluesInsideSafeMargins: rectInside(input.cluesRect) && cluesBottom <= bottom + 0.5,
    titleInsideSafeMargins: rectInside(input.titleBox),
    pageNumberInsideSafeMargins: rectInside(input.pageNumberBox),
    cluesOverlapPageNumber: cluesBottom > pageNumberZoneTopPt + 0.5,
    cluesOverlapGrid: input.cluesRect.topPt < gridBottom - 0.5,
    gridOverlapPageNumber: gridBottom > pageNumberZoneTopPt + 0.5,
    clueTextOverlap: input.spacing.itemGap < 0 || input.spacing.lineHeightFactor < 1,
  };
}

export function validateCrosswordPuzzleSetConsistency(
  pages: Array<{
    gridWidthPt: number;
    gridHeightPt: number;
    cellPt: number;
    gridLetterFontPt: number;
    clueFontSize: number;
    titleFontSizePt: number;
  }>
): CrosswordSetConsistency {
  if (pages.length <= 1) {
    return {
      allPuzzleGridWidthsAreEqual: true,
      allPuzzleGridHeightsAreEqual: true,
      allGridCellSizesAreEqual: true,
      allGridFontSizesAreEqual: true,
      allClueFontSizesAreEqual: true,
      allTitleFontSizesAreEqual: true,
    };
  }
  const first = pages[0];
  const near = (a: number, b: number) => Math.abs(a - b) < 0.05;
  return {
    allPuzzleGridWidthsAreEqual: pages.every((p) => near(p.gridWidthPt, first.gridWidthPt)),
    allPuzzleGridHeightsAreEqual: pages.every((p) => near(p.gridHeightPt, first.gridHeightPt)),
    allGridCellSizesAreEqual: pages.every((p) => near(p.cellPt, first.cellPt)),
    allGridFontSizesAreEqual: pages.every((p) => near(p.gridLetterFontPt, first.gridLetterFontPt)),
    allClueFontSizesAreEqual: pages.every((p) => near(p.clueFontSize, first.clueFontSize)),
    allTitleFontSizesAreEqual: pages.every((p) => near(p.titleFontSizePt, first.titleFontSizePt)),
  };
}
