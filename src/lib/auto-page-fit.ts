/**
 * Auto-balance grid scale and/or font sizes from shared page geometry.
 * Results are identical for every puzzle page using the same settings.
 * Content is clamped to the safe margins and above the page-number zone
 * when page numbers are enabled.
 */

import type { CrosswordPuzzle, WordSearchSettings } from './puzzles/types';
import type { CrosswordSettings } from './crossword-settings';
import {
  MAZE_PRESET_GRID_SIZE,
  type GenericPuzzleModuleType,
  type GenericPuzzleSettings,
  type MazeSizePreset,
  resolveCalcudokuGridSizes,
} from './generic-puzzle-settings';
import { cssPxToPoints, getPageDimensionsInches, pointsToCssPx } from './puzzle-layout';
import { resolveGenericPageContentInsetPt } from './generic-page-chrome';
import {
  AUTO_BALANCE_MIN_GRID_CLUE_GAP_PT,
  autoBalanceMinCrosswordClueSpacing,
  computeCrosswordPuzzleBodyLayout,
  crosswordClueSpacingFromSettings,
  crosswordFixedCellCssPx,
  fitCrosswordClueSpacing,
  resolveCrosswordPageNumberZoneTopPt,
  validateCrosswordPuzzlePageLayout,
} from './crossword-puzzle-page-layout';
import { computeGenericPageLayout } from './generic-puzzle-page-layout';

export interface PageFitBox {
  pageWidthPt: number;
  pageHeightPt: number;
  marginPt: number;
  contentWidthPt: number;
  contentBottomPt: number;
  pageNumberEnabled: boolean;
}

export interface AutoFitOptions {
  fitGrid: boolean;
  fitFont: boolean;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round(n: number): number {
  return Math.round(n);
}

export function resolvePageFitBox(layoutSettings: WordSearchSettings): PageFitBox {
  const dims = getPageDimensionsInches(layoutSettings);
  const pageWidthPt = dims.width * 72;
  const pageHeightPt = dims.height * 72;
  const marginPt = resolveGenericPageContentInsetPt(layoutSettings);
  const pageNumberEnabled = layoutSettings.typography.pageNumber?.enabled !== false;
  const contentBottomPt = pageNumberEnabled
    ? resolveCrosswordPageNumberZoneTopPt(pageWidthPt, pageHeightPt, layoutSettings)
    : pageHeightPt - marginPt;
  return {
    pageWidthPt,
    pageHeightPt,
    marginPt,
    contentWidthPt: Math.max(60, pageWidthPt - marginPt * 2),
    contentBottomPt,
    pageNumberEnabled,
  };
}

export function pageFitApplyKey(layoutSettings: WordSearchSettings): string {
  const pn = layoutSettings.typography.pageNumber;
  const bc = layoutSettings.bookCanvas;
  return [
    bc.customWidth,
    bc.customHeight,
    bc.trimSizePreset,
    bc.useCustomTrim,
    bc.includeBleed,
    pn?.enabled,
    pn?.fontSize,
    pn?.bottomOffsetPx,
    pn?.position,
  ].join('|');
}

export function fitValuesUnchanged(
  current: Record<string, number | undefined>,
  next: Record<string, number>
): boolean {
  for (const key of Object.keys(next)) {
    const bv = next[key];
    const av = current[key];
    if (typeof av !== 'number' || Math.round(av) !== Math.round(bv)) return false;
  }
  return true;
}

function titleFontsFromWidth(contentWidthPt: number) {
  return {
    puzzleTitleFontSize: clamp(round(Math.min(24, contentWidthPt / 18)), 12, 28),
    answerTitleFontSize: clamp(round(Math.min(18, contentWidthPt / 22)), 10, 22),
  };
}

export const AUTO_BALANCE_MIN_CLUE_FONT_SIZE = 11;
export const AUTO_BALANCE_MAX_CLUE_FONT_SIZE = 24;
export const AUTO_BALANCE_MIN_GRID_SCALE = 50;
export const AUTO_BALANCE_MAX_GRID_SCALE = 200;
export const AUTO_BALANCE_SCALE_STEP = 5;

export function computeCrosswordAutoFit(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  opts: AutoFitOptions,
  puzzles: CrosswordPuzzle[] = []
): Record<string, number> {
  if (!opts.fitGrid && !opts.fitFont) return {};

  if (opts.fitFont) {
    return balanceCrosswordPage(cw, layout, puzzles, opts);
  }

  const box = resolvePageFitBox(layout);
  const cols = Math.max(1, cw.core.lettersAcross);
  const rows = Math.max(1, cw.core.lettersDown);
  const sizePercent = Math.max(0.2, (cw.core.puzzleSizePercent || 60) / 60);
  const titleStartPt = (cw.typography.titleStartAt || 0) * 72;
  const titleBlockPt =
    cssPxToPoints(cw.typography.puzzleTitleFontSize || 24) * 1.25 +
    (cw.typography.spaceBetweenTitleAndPuzzle || 0.3) * 72;
  const bodyTop = Math.max(box.marginPt, titleStartPt) + titleBlockPt;
  const clueGapPt = (cw.typography.spaceBetweenPuzzleAndClues || 0.25) * 72;
  const availablePt = Math.max(48, box.contentBottomPt - bodyTop);
  const gridBudgetPt = Math.max(36, availablePt * 0.64 - clueGapPt * 0.2);
  const maxCellPt = Math.min(box.contentWidthPt / cols, gridBudgetPt / rows);
  const maxCellCss = pointsToCssPx(maxCellPt);
  const scale = clamp(round((maxCellCss / Math.max(0.5, 28 * sizePercent)) * 100), 50, 200);
  return {
    puzzleGridScale: scale,
    solutionGridScale: clamp(round(scale * 0.85), 50, 200),
  };
}

function snapScale(n: number): number {
  return clamp(
    Math.round(n / AUTO_BALANCE_SCALE_STEP) * AUTO_BALANCE_SCALE_STEP,
    AUTO_BALANCE_MIN_GRID_SCALE,
    AUTO_BALANCE_MAX_GRID_SCALE
  );
}

function headingFontForClue(clueCss: number): number {
  return clamp(clueCss + 2, 13, 32);
}

function crosswordClueItemText(clue: { number: number; clue: string }): string {
  return `${clue.number}. ${clue.clue}`;
}

function syntheticCrosswordPuzzle(cw: CrosswordSettings): CrosswordPuzzle {
  const rows = Math.max(1, cw.core.lettersDown);
  const cols = Math.max(1, cw.core.lettersAcross);
  const total = Math.max(6, cw.core.cluesPerPuzzle || 15);
  const acrossN = Math.max(3, Math.ceil(total * 0.55));
  const downN = Math.max(3, total - acrossN);
  const sample = 'Short crossword clue.';
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ isBlack: true }))
  );
  return {
    type: 'crossword',
    grid,
    acrossClues: Array.from({ length: acrossN }, (_, i) => ({
      number: i + 1,
      clue: sample,
      answer: 'WORD',
    })),
    downClues: Array.from({ length: downN }, (_, i) => ({
      number: i + 1,
      clue: sample,
      answer: 'WORD',
    })),
  };
}

function crosswordPuzzlesForFit(
  cw: CrosswordSettings,
  puzzles: CrosswordPuzzle[]
): CrosswordPuzzle[] {
  const real = puzzles.filter((puzzle) => Array.isArray(puzzle?.grid) && puzzle.grid.length > 0);
  return real.length > 0 ? real : [syntheticCrosswordPuzzle(cw)];
}

function trialCrosswordSettings(
  cw: CrosswordSettings,
  scale: number,
  clueFontSize: number,
  titleFontSize: number
): CrosswordSettings {
  return {
    ...cw,
    core: {
      ...cw.core,
      puzzleGridScale: scale,
      solutionGridScale: clamp(round(scale * 0.85), AUTO_BALANCE_MIN_GRID_SCALE, AUTO_BALANCE_MAX_GRID_SCALE),
    },
    typography: {
      ...cw.typography,
      puzzleTitleFontSize: titleFontSize,
      clueFontSize,
      acrossDownFontSize: headingFontForClue(clueFontSize),
    },
  };
}

function crosswordPagesFitAt(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  puzzles: CrosswordPuzzle[],
  scale: number,
  clueFontSize: number,
  titleFontSize: number
): boolean {
  const trial = trialCrosswordSettings(cw, scale, clueFontSize, titleFontSize);
  const page = computeGenericPageLayout({
    puzzleType: 'crossword',
    showSolution: false,
    layoutSettings: layout,
    titleWords: {
      title: cw.typography.titleText || 'Crossword',
      fontFamily: cw.typography.puzzleTitleFontFamily || 'Arial',
      fontSize: titleFontSize,
      words: [],
    },
    puzzleIndex: 0,
    puzzles: [puzzles[0]],
    cw: trial,
    gp: null,
  });
  const slot = page.slots[0]?.content;
  if (!slot) return false;
  const clueGapPt = Math.max(page.puzzleToCluesGapPt, AUTO_BALANCE_MIN_GRID_CLUE_GAP_PT);
  const columns: 1 | 2 = cw.typography.clueLayout === 'single' ? 1 : 2;
  const preferred = crosswordClueSpacingFromSettings(trial, cssPxToPoints);
  const minSpacing = autoBalanceMinCrosswordClueSpacing(cssPxToPoints);
  const cluePt = cssPxToPoints(clueFontSize);
  const headingPt = cssPxToPoints(headingFontForClue(clueFontSize));

  return puzzles.every((puzzle) => {
    const body = computeCrosswordPuzzleBodyLayout({
      puzzle,
      cw: trial,
      slot,
      preferredCellPt: page.crosswordCellPt,
      clueGapPt,
      pageNumberZoneTopPt: page.pageNumberZoneTopPt,
    });
    if (body.cluesRect.heightPt < 8) return false;
    const fit = fitCrosswordClueSpacing({
      availableHeight: body.cluesRect.heightPt,
      availableWidth: body.cluesRect.widthPt,
      columns,
      clueFontSize: cluePt,
      headingFontSize: headingPt,
      preferred,
      min: minSpacing,
      acrossTexts: puzzle.acrossClues.map(crosswordClueItemText),
      downTexts: puzzle.downClues.map(crosswordClueItemText),
    });
    const contentBottom = body.cluesRect.topPt + fit.requiredHeight;
    const validation = validateCrosswordPuzzlePageLayout({
      pageWidthPt: page.pageWidthPt,
      pageHeightPt: page.pageHeightPt,
      marginPt: page.marginPt,
      pageNumberZoneTopPt: page.pageNumberZoneTopPt,
      titleBox: page.pageTitleBox,
      grid: body.grid,
      cluesRect: body.cluesRect,
      clueContentBottomPt: contentBottom,
      spacing: fit.spacing,
    });
    return (
      fit.fits &&
      validation.gridInsideSafeMargins &&
      validation.cluesInsideSafeMargins &&
      !validation.cluesOverlapPageNumber &&
      !validation.cluesOverlapGrid &&
      !validation.gridOverlapPageNumber &&
      !validation.clueTextOverlap &&
      contentBottom <= page.pageNumberZoneTopPt + 0.5
    );
  });
}

function widthLimitedGridScale(cw: CrosswordSettings, layout: WordSearchSettings): number {
  const box = resolvePageFitBox(layout);
  const cols = Math.max(1, cw.core.lettersAcross);
  const sizePercent = Math.max(0.2, (cw.core.puzzleSizePercent || 60) / 60);
  const maxCellCss = pointsToCssPx(box.contentWidthPt) / cols;
  return snapScale((maxCellCss / Math.max(0.5, 28 * sizePercent)) * 100);
}

function largestScaleThatFits(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  puzzles: CrosswordPuzzle[],
  preferredScale: number,
  clueFontSize: number,
  titleFontSize: number
): number {
  const hi = snapScale(preferredScale);
  if (crosswordPagesFitAt(cw, layout, puzzles, hi, clueFontSize, titleFontSize)) return hi;
  let lo = AUTO_BALANCE_MIN_GRID_SCALE;
  let max = hi;
  let best = AUTO_BALANCE_MIN_GRID_SCALE;
  while (lo <= max) {
    const mid = snapScale((lo + max) / 2);
    if (crosswordPagesFitAt(cw, layout, puzzles, mid, clueFontSize, titleFontSize)) {
      best = mid;
      lo = mid + AUTO_BALANCE_SCALE_STEP;
    } else {
      max = mid - AUTO_BALANCE_SCALE_STEP;
    }
  }
  return best;
}

function largestFontThatFits(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  puzzles: CrosswordPuzzle[],
  scale: number,
  titleFontSize: number
): number {
  let lo = AUTO_BALANCE_MIN_CLUE_FONT_SIZE;
  let hi = AUTO_BALANCE_MAX_CLUE_FONT_SIZE;
  let best = AUTO_BALANCE_MIN_CLUE_FONT_SIZE;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (crosswordPagesFitAt(cw, layout, puzzles, scale, mid, titleFontSize)) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

function balanceCrosswordPage(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  puzzles: CrosswordPuzzle[],
  opts?: AutoFitOptions
): Record<string, number> {
  const box = resolvePageFitBox(layout);
  const titles = titleFontsFromWidth(box.contentWidthPt);
  const samples = crosswordPuzzlesForFit(cw, puzzles);

  const cols = Math.max(1, cw.core.lettersAcross);
  const rows = Math.max(1, cw.core.lettersDown);

  const titleStartPt = (cw.typography.titleStartAt || 0) * 72;
  const titleBlockPt =
    titles.puzzleTitleFontSize * 1.25 + (cw.typography.spaceBetweenTitleAndPuzzle || 0.3) * 72;
  const bodyTop = Math.max(box.marginPt, titleStartPt) + titleBlockPt;
  const availablePt = Math.max(48, box.contentBottomPt - bodyTop);

  // Target grid height: about half of available page height (~46%)
  const clueGapPt = (cw.typography.spaceBetweenPuzzleAndClues || 0.25) * 72;
  const targetGridHeightPt = Math.max(36, availablePt * 0.46 - clueGapPt * 0.5);

  const maxCellWidthPt = box.contentWidthPt / cols;
  const maxCellHeightPt = targetGridHeightPt / rows;
  const targetCellPt = Math.min(maxCellWidthPt, maxCellHeightPt);
  const targetCellCss = pointsToCssPx(targetCellPt);
  const sizePercent = Math.max(0.2, (cw.core.puzzleSizePercent || 60) / 60);

  // Ideal scale that makes the grid fill ~half of page height
  const currentScale = cw.core.puzzleGridScale || 100;
  const computedIdeal = snapScale((targetCellCss / Math.max(0.5, 28 * sizePercent)) * 100);
  const idealScale = opts?.fitGrid === false ? Math.max(currentScale, computedIdeal) : computedIdeal;

  let bestScale = AUTO_BALANCE_MIN_GRID_SCALE;
  let bestClueFont = AUTO_BALANCE_MIN_CLUE_FONT_SIZE;
  let found = false;

  // Search from idealScale down to AUTO_BALANCE_MIN_GRID_SCALE
  for (let s = idealScale; s >= AUTO_BALANCE_MIN_GRID_SCALE; s -= AUTO_BALANCE_SCALE_STEP) {
    const scaleToTest = snapScale(s);
    for (let font = AUTO_BALANCE_MAX_CLUE_FONT_SIZE; font >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE; font--) {
      if (crosswordPagesFitAt(cw, layout, samples, scaleToTest, font, titles.puzzleTitleFontSize)) {
        bestScale = scaleToTest;
        bestClueFont = font;
        found = true;
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    bestScale = largestScaleThatFits(
      cw,
      layout,
      samples,
      idealScale,
      AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
      titles.puzzleTitleFontSize
    );
    bestClueFont = largestFontThatFits(
      cw,
      layout,
      samples,
      bestScale,
      titles.puzzleTitleFontSize
    );
  }

  const trial = trialCrosswordSettings(cw, bestScale, bestClueFont, titles.puzzleTitleFontSize);
  const cellCss = crosswordFixedCellCssPx(trial, { showSolution: false });

  return {
    puzzleGridScale: bestScale,
    solutionGridScale: clamp(round(bestScale * 0.85), AUTO_BALANCE_MIN_GRID_SCALE, AUTO_BALANCE_MAX_GRID_SCALE),
    puzzleTitleFontSize: titles.puzzleTitleFontSize,
    answerTitleFontSize: titles.answerTitleFontSize,
    clueFontSize: bestClueFont,
    acrossDownFontSize: headingFontForClue(bestClueFont),
    numberFontSizePuzzle: clamp(round(cellCss * 0.28), 8, 16),
    numberFontSizeAnswers: clamp(round(cellCss * 0.28), 8, 16),
    gridLetterFontSize: clamp(round(cellCss * 0.45), 10, 22),
    subtitleFontSize: clamp(round(titles.puzzleTitleFontSize * 0.55), 10, 16),
  };
}

export function computeWordSearchAutoFit(
  settings: WordSearchSettings,
  puzzleGridScaleFallback = 70,
  opts: AutoFitOptions
): Record<string, number> {
  if (!opts.fitGrid && !opts.fitFont) return {};
  const box = resolvePageFitBox(settings);
  const cols = Math.max(5, settings.core.lettersAcross || 15);
  const rows = Math.max(5, settings.core.lettersDown || 15);
  const titles = opts.fitFont
    ? titleFontsFromWidth(box.contentWidthPt)
    : {
        puzzleTitleFontSize: settings.typography.puzzleTitleFontSize || 24,
        answerTitleFontSize: settings.typography.answerTitleFontSize || 18,
      };
  const titleStartPt = Math.max(box.marginPt, settings.typography.titleStartAt || 0);
  const titleBlockPt =
    titles.puzzleTitleFontSize * 1.25 + (settings.typography.spaceBetweenTitleAndPuzzle || 20);
  const gridTopPt = titleStartPt + titleBlockPt;
  const availablePt = Math.max(48, box.contentBottomPt - gridTopPt);
  const wordListReservePt = settings.wordList.hideWordList ? 12 : availablePt * 0.22;
  const out: Record<string, number> = {};

  if (opts.fitGrid) {
    const maxGridH = Math.max(36, availablePt - wordListReservePt);
    const maxWidthScale = 1;
    const heightLimitedScale = maxGridH / Math.max(1, (box.contentWidthPt / cols) * rows);
    const scaleFactor = clamp(Math.min(maxWidthScale, heightLimitedScale), 0.5, 2);
    out.puzzleGridScale = clamp(round(scaleFactor * 100), 50, 200);
  }

  const scale = (out.puzzleGridScale ?? puzzleGridScaleFallback) / 100;
  const gridHPt = (box.contentWidthPt * clamp(scale, 0.5, 2) / cols) * rows;
  const listHPt = Math.max(16, box.contentBottomPt - (gridTopPt + gridHPt + 12));

  if (opts.fitFont) {
    out.puzzleTitleFontSize = titles.puzzleTitleFontSize;
    out.answerTitleFontSize = titles.answerTitleFontSize;
    const cellPt = (box.contentWidthPt * clamp(scale, 0.5, 2)) / cols;
    const gridLetterSize = clamp(round(cellPt * 0.62), AUTO_BALANCE_MIN_CLUE_FONT_SIZE, 28);
    out.puzzleGridFontSize = gridLetterSize;
    out.answerGridFontSize = gridLetterSize;
    const wordsPerPuzzle = Math.max(1, settings.wordList.wordsPerPuzzle || 10);
    const columns = Math.max(1, settings.wordList.wordListColumns || 2);
    const rowsInCol = Math.ceil(wordsPerPuzzle / columns);
    const lineBudget = listHPt / Math.max(1, rowsInCol);
    out.wordListFontSize = clamp(round(lineBudget / 1.35), 8, 18);
  }

  return out;
}

function sudokuCells(gp: GenericPuzzleSettings): number {
  const mode = gp.core.sudokuPuzzleMode ?? 'standard';
  const standardSize = (() => {
    if (gp.core.sudokuSize === 'mixed') {
      const counts: Array<[number, number]> = [
        [4, gp.core.sudokuMixedSize4],
        [6, gp.core.sudokuMixedSize6],
        [9, gp.core.sudokuMixedSize9],
        [12, gp.core.sudokuMixedSize12],
        [16, gp.core.sudokuMixedSize16],
        [25, gp.core.sudokuMixedSize25],
      ];
      let max = 9;
      for (const [size, count] of counts) {
        if (count > 0) max = Math.max(max, size);
      }
      return max;
    }
    return typeof gp.core.sudokuSize === 'number' ? gp.core.sudokuSize : 9;
  })();
  const calcudokuSize = (() => {
    const sizes = resolveCalcudokuGridSizes(gp.core);
    return sizes.length > 0 ? Math.max(...sizes) : 6;
  })();
  if (mode === 'calcudoku') return calcudokuSize;
  if (mode === 'mixed') {
    const includeStandard = gp.core.sudokuMixedIncludeStandard !== false;
    const includeCalcudoku = gp.core.sudokuMixedIncludeCalcudoku !== false;
    return Math.max(
      includeStandard ? standardSize : 0,
      includeCalcudoku ? calcudokuSize : 0,
      4
    );
  }
  return standardSize;
}

function mazeCells(gp: GenericPuzzleSettings): number {
  if (gp.core.mazeSize === 'mixed') {
    return Math.max(
      gp.core.mazeEasyGridLength || 10,
      gp.core.mazeMediumGridLength || 15,
      gp.core.mazeHardGridLength || 20,
      gp.core.mazeEasyGridWidth || 10,
      gp.core.mazeMediumGridWidth || 15,
      gp.core.mazeHardGridWidth || 20
    );
  }
  const preset = gp.core.mazeSize as MazeSizePreset;
  return MAZE_PRESET_GRID_SIZE[preset] || 15;
}

export function computeGenericAutoFit(
  gp: GenericPuzzleSettings,
  layout: WordSearchSettings,
  moduleType: GenericPuzzleModuleType,
  opts: AutoFitOptions
): Record<string, number> {
  if (!opts.fitGrid && !opts.fitFont) return {};
  const box = resolvePageFitBox(layout);
  const titles = opts.fitFont
    ? titleFontsFromWidth(box.contentWidthPt)
    : {
        puzzleTitleFontSize: gp.typography.puzzleTitleFontSize || 24,
        answerTitleFontSize: gp.typography.answerTitleFontSize || 18,
      };
  const titleStartPt = (gp.typography.titleStartAt || 0) * 72;
  const titleBlockPt =
    titles.puzzleTitleFontSize * 1.25 + (gp.typography.spaceBetweenTitleAndPuzzle || 0) * 72;
  const bodyTop = Math.max(box.marginPt, titleStartPt) + titleBlockPt;
  const availablePt = Math.max(48, box.contentBottomPt - bodyTop);
  const perPage = Math.max(1, gp.core.puzzlesPerPage || 1);
  const cols = perPage >= 4 ? 2 : perPage >= 2 ? 2 : 1;
  const rows = perPage >= 4 ? 2 : 1;
  const slotW = (box.contentWidthPt - 12 * (cols - 1)) / cols;
  const slotH = (availablePt - 12 * (rows - 1)) / rows;
  const out: Record<string, number> = {};

  if (moduleType === 'sudoku' || moduleType === 'maze') {
    const cells = moduleType === 'sudoku' ? sudokuCells(gp) : mazeCells(gp);
    const pageFitBase = Math.min(box.contentWidthPt, availablePt);
    const cellAt100 = (pageFitBase / Math.max(1, cells)) * 0.9;
    if (opts.fitGrid) {
      const desiredCell = (Math.min(slotW, slotH) * 0.9) / Math.max(1, cells);
      out.puzzleGridScale = clamp(round((100 * desiredCell) / Math.max(0.5, cellAt100)), 40, 200);
      out.solutionGridScale = clamp(round(out.puzzleGridScale * 0.85), 40, 200);
    }
    if (opts.fitFont) {
      const scale = (out.puzzleGridScale ?? gp.core.puzzleGridScale ?? 100) / 100;
      const cellPt = cellAt100 * scale;
      out.puzzleTitleFontSize = titles.puzzleTitleFontSize;
      out.answerTitleFontSize = titles.answerTitleFontSize;
      out.puzzleFontSize = clamp(round(cellPt * 0.72), 8, 22);
      out.answerFontSize = out.puzzleFontSize;
    }
    return out;
  }

  if (opts.fitGrid) {
    const fill = Math.min(1, availablePt / Math.max(1, box.pageHeightPt - box.marginPt * 2));
    out.puzzleGridScale = clamp(round(70 + fill * 50), 50, 160);
    out.solutionGridScale = clamp(round(out.puzzleGridScale * 0.9), 50, 160);
  }

  if (opts.fitFont) {
    out.puzzleTitleFontSize = titles.puzzleTitleFontSize;
    out.answerTitleFontSize = titles.answerTitleFontSize;
    const scale = (out.puzzleGridScale ?? gp.core.puzzleGridScale ?? 100) / 100;
    const base = clamp(round(Math.min(slotH / 14, box.contentWidthPt / 28) * scale), 8, 20);
    out.puzzleFontSize = base;
    out.answerFontSize = base;
    if (moduleType === 'trivia') {
      const qpp = Math.max(1, gp.core.questionsPerPage || 6);
      out.puzzleFontSize = clamp(round(slotH / (qpp * 3.2)), 8, 16);
    }
  }

  return out;
}

export function computeTextPageAutoFit(layout: WordSearchSettings): Record<string, number> {
  const box = resolvePageFitBox(layout);
  const titles = titleFontsFromWidth(box.contentWidthPt);
  const available = Math.max(48, box.contentBottomPt - box.marginPt - titles.puzzleTitleFontSize * 1.4);
  return {
    titleFontSize: titles.puzzleTitleFontSize,
    fontSize: clamp(round(Math.min(18, available / 22)), 11, 20),
  };
}

export function applyCrosswordAutoFit(
  cw: CrosswordSettings,
  layout: WordSearchSettings,
  puzzles: CrosswordPuzzle[] = []
): CrosswordSettings {
  const fit = computeCrosswordAutoFit(
    cw,
    layout,
    {
      fitGrid: cw.core.autoBalanceGrid === true,
      fitFont: cw.core.autoBalanceFont === true,
    },
    puzzles
  );
  if (!fit || Object.keys(fit).length === 0) return cw;
  return {
    ...cw,
    core: {
      ...cw.core,
      ...(fit.puzzleGridScale != null ? { puzzleGridScale: fit.puzzleGridScale } : {}),
      ...(fit.solutionGridScale != null ? { solutionGridScale: fit.solutionGridScale } : {}),
    },
    typography: {
      ...cw.typography,
      ...(fit.puzzleTitleFontSize != null ? { puzzleTitleFontSize: fit.puzzleTitleFontSize } : {}),
      ...(fit.answerTitleFontSize != null ? { answerTitleFontSize: fit.answerTitleFontSize } : {}),
      ...(fit.clueFontSize != null ? { clueFontSize: fit.clueFontSize } : {}),
      ...(fit.acrossDownFontSize != null ? { acrossDownFontSize: fit.acrossDownFontSize } : {}),
      ...(fit.numberFontSizePuzzle != null ? { numberFontSizePuzzle: fit.numberFontSizePuzzle } : {}),
      ...(fit.numberFontSizeAnswers != null ? { numberFontSizeAnswers: fit.numberFontSizeAnswers } : {}),
      ...(fit.gridLetterFontSize != null ? { gridLetterFontSize: fit.gridLetterFontSize } : {}),
      ...(fit.subtitleFontSize != null ? { subtitleFontSize: fit.subtitleFontSize } : {}),
    },
  };
}
