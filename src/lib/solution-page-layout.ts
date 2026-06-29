import type { WordSearchPuzzle, WordSearchSettings } from './puzzles/types';
import { resolvePageFrameSettings } from './page-frame-settings';

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

export interface SolutionGridLayout {
  columns: number;
  rows: number;
}

export interface SolutionPageContentArea {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
}

export interface SolutionBlockLayout {
  index: number;
  col: number;
  row: number;
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
  innerMarginPt: number;
  titleHeightPt: number;
  cellSizePt: number;
  gridWidthPt: number;
  gridHeightPt: number;
  gridLeftPt: number;
  gridTopPt: number;
  titleTopPt: number;
}

export interface SolutionPageLayoutResult {
  contentArea: SolutionPageContentArea;
  layout: SolutionGridLayout;
  gapPt: number;
  clusterLeftPt: number;
  clusterTopPt: number;
  clusterWidthPt: number;
  clusterHeightPt: number;
  blocks: SolutionBlockLayout[];
}

/** 1×1, 1×2, or 2×2 solution block grid from answers-per-page setting. */
export function getSolutionGridLayout(answersPerPage: number): SolutionGridLayout {
  if (answersPerPage >= 4) return { columns: 2, rows: 2 };
  if (answersPerPage >= 2) return { columns: 1, rows: 2 };
  return { columns: 1, rows: 1 };
}

/** @deprecated Use getSolutionGridLayout */
export function getSolutionPageLayout(answersPerPage: number): SolutionGridLayout {
  return getSolutionGridLayout(answersPerPage);
}

/**
 * Solution-page margin inset from the "Solution Page Margin" slider (pt).
 * When the page frame is enabled, default slider (40) adds no extra inset — only
 * values above/below 40 adjust padding inside the frame inner edge.
 */
export function getSolutionPageMarginInsetPt(
  settings: WordSearchSettings,
  pageMargin: number,
  pageFrameEnabled: boolean
): number {
  const safePageMargin = finiteOr(pageMargin, 40);
  const marginDeltaPt = (safePageMargin - 40) * 0.5;

  if (pageFrameEnabled) {
    return Math.max(0, marginDeltaPt);
  }

  const answersPerPage = settings.bookCanvas.answersPerPage || 1;
  const isSingleSolution = answersPerPage === 1;
  const baseMarginPt = 36;
  return (isSingleSolution ? 28 : baseMarginPt) + marginDeltaPt;
}

/**
 * Content rectangle inside the page frame (when enabled) plus solution-page margin.
 * Shared by canvas preview, PDF, and PPT export.
 */
export function computeSolutionPageContentArea(
  pageWidthPt: number,
  pageHeightPt: number,
  settings: WordSearchSettings,
  pageMargin: number
): SolutionPageContentArea {
  const pageFrame = resolvePageFrameSettings(settings);
  const frameInsetPt = pageFrame.enabled ? pageFrame.marginSizeIn * 72 : 0;
  const solutionInsetPt = getSolutionPageMarginInsetPt(
    settings,
    pageMargin,
    pageFrame.enabled
  );
  const totalInsetPt = frameInsetPt + solutionInsetPt;

  return {
    leftPt: totalInsetPt,
    topPt: totalInsetPt,
    widthPt: Math.max(1, pageWidthPt - totalInsetPt * 2),
    heightPt: Math.max(1, pageHeightPt - totalInsetPt * 2),
  };
}

export function getSolutionBlockInnerMargin(
  blockWidthPt: number,
  blockHeightPt: number,
  answersPerPage: number
): number {
  const isSingle = answersPerPage === 1;
  return Math.min(isSingle ? 10 : 14, blockWidthPt * 0.05, blockHeightPt * 0.05);
}

export function getSolutionMaxCellSizePt(answersPerPage: number): number {
  return answersPerPage === 1 ? 30 : 20;
}

interface MeasuredBlockContent {
  innerMarginPt: number;
  titleHeightPt: number;
  cellSizePt: number;
  gridWidthPt: number;
  gridHeightPt: number;
  contentWidthPt: number;
  contentHeightPt: number;
}

function measureSolutionBlockContent(
  puzzle: WordSearchPuzzle,
  maxWidthPt: number,
  maxHeightPt: number,
  titleHeightPt: number,
  titleToAnswerGap: number,
  answersPerPage: number
): MeasuredBlockContent {
  const gridRows = Math.max(1, puzzle.grid?.length ?? 0);
  const gridCols = Math.max(1, puzzle.grid?.[0]?.length ?? 0);
  const innerMarginPt = getSolutionBlockInnerMargin(maxWidthPt, maxHeightPt, answersPerPage);
  const safeTitleToAnswerGap = finiteOr(titleToAnswerGap, 10);
  const safeTitleHeightPt = finiteOr(titleHeightPt, 20);
  const gridAvailableWidthPt = Math.max(1, maxWidthPt - innerMarginPt * 2);
  const gridAvailableHeightPt = Math.max(
    1,
    maxHeightPt - innerMarginPt * 2 - safeTitleHeightPt - safeTitleToAnswerGap
  );
  const maxCellSizePt = getSolutionMaxCellSizePt(answersPerPage);
  let cellSizePt = Math.min(
    gridAvailableWidthPt / gridCols,
    gridAvailableHeightPt / gridRows,
    maxCellSizePt
  );
  if (!Number.isFinite(cellSizePt) || cellSizePt <= 0) {
    cellSizePt = 1;
  }
  const gridWidthPt = cellSizePt * gridCols;
  const gridHeightPt = cellSizePt * gridRows;
  const contentWidthPt = gridWidthPt + innerMarginPt * 2;
  const contentHeightPt =
    innerMarginPt + safeTitleHeightPt + safeTitleToAnswerGap + gridHeightPt + innerMarginPt;

  return {
    innerMarginPt,
    titleHeightPt: safeTitleHeightPt,
    cellSizePt,
    gridWidthPt,
    gridHeightPt,
    contentWidthPt,
    contentHeightPt,
  };
}

/**
 * Measure each solution, size columns/rows to content, center the cluster in the page frame.
 */
export function computeSolutionPageLayout(
  puzzles: WordSearchPuzzle[],
  settings: WordSearchSettings,
  pageWidthPt: number,
  pageHeightPt: number,
  pageMargin: number,
  titleToAnswerGap: number,
  gapPt: number
): SolutionPageLayoutResult {
  const answersPerPage = settings.bookCanvas.answersPerPage || 1;
  const cappedPuzzles = puzzles.slice(0, answersPerPage);
  const safePageMargin = finiteOr(pageMargin, 40);
  const safeTitleToAnswerGap = finiteOr(titleToAnswerGap, 10);
  const safeGapPt = finiteOr(gapPt, 14);

  const layout = getSolutionGridLayout(answersPerPage);
  const contentArea = computeSolutionPageContentArea(
    pageWidthPt,
    pageHeightPt,
    settings,
    safePageMargin
  );
  const titleHeightPt = finiteOr(settings.colors.answerPage.answerTitleFontSize, 20);

  const estBlockWidthPt =
    (contentArea.widthPt - safeGapPt * (layout.columns - 1)) / layout.columns;
  const estBlockHeightPt =
    (contentArea.heightPt - safeGapPt * (layout.rows - 1)) / layout.rows;

  const measured = cappedPuzzles.map((puzzle) =>
    measureSolutionBlockContent(
      puzzle,
      estBlockWidthPt,
      estBlockHeightPt,
      titleHeightPt,
      safeTitleToAnswerGap,
      answersPerPage
    )
  );

  const colWidths = Array.from({ length: layout.columns }, () => 0);
  const rowHeights = Array.from({ length: layout.rows }, () => 0);

  for (let index = 0; index < cappedPuzzles.length; index++) {
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const m = measured[index];
    colWidths[col] = Math.max(colWidths[col], m.contentWidthPt);
    rowHeights[row] = Math.max(rowHeights[row], m.contentHeightPt);
  }

  const totalWidthPt =
    colWidths.reduce((sum, w) => sum + w, 0) + safeGapPt * (layout.columns - 1);
  const totalHeightPt =
    rowHeights.reduce((sum, h) => sum + h, 0) + safeGapPt * (layout.rows - 1);

  const clusterLeftPt = contentArea.leftPt + (contentArea.widthPt - totalWidthPt) / 2;
  const clusterTopPt = contentArea.topPt + (contentArea.heightPt - totalHeightPt) / 2;

  const colOffsets = colWidths.map((_, col) =>
    colWidths.slice(0, col).reduce((sum, w) => sum + w + safeGapPt, 0)
  );
  const rowOffsets = rowHeights.map((_, row) =>
    rowHeights.slice(0, row).reduce((sum, h) => sum + h + safeGapPt, 0)
  );

  const blocks: SolutionBlockLayout[] = [];

  for (let index = 0; index < cappedPuzzles.length; index++) {
    const col = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const m = measured[index];

    const cellLeftPt = clusterLeftPt + colOffsets[col];
    const cellTopPt = clusterTopPt + rowOffsets[row];
    const cellWidthPt = colWidths[col];
    const cellHeightPt = rowHeights[row];

    const leftPt = cellLeftPt + (cellWidthPt - m.contentWidthPt) / 2;
    const topPt = cellTopPt + (cellHeightPt - m.contentHeightPt) / 2;
    const titleTopPt = topPt + m.innerMarginPt;
    const gridTopPt = titleTopPt + m.titleHeightPt + safeTitleToAnswerGap;
    const gridLeftPt = leftPt + (m.contentWidthPt - m.gridWidthPt) / 2;

    blocks.push({
      index,
      col,
      row,
      leftPt: finiteOr(leftPt, 0),
      topPt: finiteOr(topPt, 0),
      widthPt: finiteOr(m.contentWidthPt, 1),
      heightPt: finiteOr(m.contentHeightPt, 1),
      innerMarginPt: finiteOr(m.innerMarginPt, 0),
      titleHeightPt: finiteOr(m.titleHeightPt, 20),
      cellSizePt: finiteOr(m.cellSizePt, 1),
      gridWidthPt: finiteOr(m.gridWidthPt, 1),
      gridHeightPt: finiteOr(m.gridHeightPt, 1),
      gridLeftPt: finiteOr(gridLeftPt, 0),
      gridTopPt: finiteOr(gridTopPt, 0),
      titleTopPt: finiteOr(titleTopPt, 0),
    });
  }

  return {
    contentArea,
    layout,
    gapPt: safeGapPt,
    clusterLeftPt: finiteOr(clusterLeftPt, contentArea.leftPt),
    clusterTopPt: finiteOr(clusterTopPt, contentArea.topPt),
    clusterWidthPt: finiteOr(totalWidthPt, 1),
    clusterHeightPt: finiteOr(totalHeightPt, 1),
    blocks,
  };
}

/** PDF bottom-origin: bottom Y of the solution block. */
export function solutionBlockBottomPtFromTopOrigin(
  pageHeightPt: number,
  blockTopPt: number,
  blockHeightPt: number
): number {
  return pageHeightPt - blockTopPt - blockHeightPt;
}
