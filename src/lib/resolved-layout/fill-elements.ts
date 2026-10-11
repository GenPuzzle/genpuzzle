import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import { fitUniformGrid, sudokuDigitFillRatio } from '../generic-puzzle-geometry';
import { getAlpha01, parseRgba } from '../color-utils';
import { INTERIOR_LIGHT_GREY_FILL } from '../crossword-settings';
import {
  fillWordListGroups,
  findInteriorUnusedFillCells,
  type FillPuzzle,
} from '../puzzles/fill';
import {
  buildEntryListElements,
  entryListStyle,
  measureEntryList,
  type EntryListGroup,
} from './entry-list-elements';
import type { ResolvedElement } from './types';

function finitePositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * White or fully transparent block fill → hide unused cells and their grid lines
 * so only the playable puzzle boxes remain.
 */
export function isFillBlockFillInvisible(color: string | undefined | null): boolean {
  if (getAlpha01(color, 1) <= 0.001) return true;
  const { r, g, b } = parseRgba(color, '#111111');
  return r >= 250 && g >= 250 && b >= 250;
}

export type FillElementParts = {
  elements: ResolvedElement[];
  gridBox: { x: number; y: number; w: number; h: number };
  /** Word / number list under the grid (puzzle pages only). */
  listBox: { x: number; y: number; w: number; h: number } | null;
};

export const FILL_LIST_GAP_PT = 10;

export function fillEntryListGroups(puzzle: FillPuzzle): EntryListGroup[] {
  const unit = puzzle.mode === 'number' ? 'digits' : 'letters';
  return fillWordListGroups(puzzle).map((g) => ({
    heading: `${g.length} ${unit}`,
    items: g.items,
  }));
}

/** Height reserved for the list so the grid is sized around it (0 on solution pages). */
export function fillListReservePt(
  puzzle: FillPuzzle,
  gp: GenericPuzzleSettings,
  widthPt: number,
  showSolution: boolean
): number {
  if (showSolution) return 0;
  const h = measureEntryList(fillEntryListGroups(puzzle), widthPt, entryListStyle(gp));
  return h > 0 ? h + FILL_LIST_GAP_PT : 0;
}

function isPlayableCell(puzzle: FillPuzzle, r: number, c: number): boolean {
  const sol = puzzle.grid[r]?.[c] ?? '';
  return sol !== '';
}

export function buildFillElementParts(args: {
  puzzle: FillPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): FillElementParts {
  const { puzzle, slot, gp, showSolution } = args;
  const rows = Math.max(1, puzzle.rows);
  const cols = Math.max(1, puzzle.columns);
  const listReserve = fillListReservePt(puzzle, gp, slot.widthPt, showSolution);
  // Never let the list squeeze the grid below ~55% of the slot.
  const gridSlotH = Math.max(slot.heightPt * 0.55, slot.heightPt - listReserve);
  const grid = fitUniformGrid(cols, rows, finitePositive(args.preferredCellPt, 16), {
    ...slot,
    heightPt: gridSlotH,
  });
  const cell = finitePositive(grid.cellPt, 16);
  const lineW = Math.max(0.35, Math.min(3, finitePositive(gp.core.fillGridLineWidth, 0.75)));
  const lineColor = gp.core.fillGridLineColor || '#111111';
  const blockFill = gp.core.fillBlockFill || '#111111';
  const playFill = gp.core.fillPlayableFill || '#ffffff';
  const hideUnusedMesh = isFillBlockFillInvisible(blockFill);
  // Crossword protocol: when unused mesh is hidden, keep single enclosed holes grey.
  const interiorUnused = hideUnusedMesh ? findInteriorUnusedFillCells(puzzle) : null;
  const isVisibleCell = (r: number, c: number): boolean => {
    if (isPlayableCell(puzzle, r, c)) return true;
    return interiorUnused?.[r]?.[c] === true;
  };
  const fontFamily =
    (showSolution ? gp.typography.answerFontFamily : gp.typography.puzzleFontFamily) || 'Arial';
  const fontSetting = finitePositive(
    showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize,
    14
  );
  // Match Sudoku/Binairo: canvas/sidebar font size maps through a fill ratio so
  // Solution font changes on the workspace bar stay visibly effective.
  const fontSize = Math.max(
    6,
    Math.min(cell * 0.92, cell * sudokuDigitFillRatio(fontSetting))
  );
  const color = gp.colors.gridColor || '#111111';
  const elements: ResolvedElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = grid.leftPt + c * cell;
      const y = grid.topPt + r * cell;
      const sol = puzzle.grid[r]?.[c] ?? '';
      const given = puzzle.puzzleGrid[r]?.[c];
      if (sol === '') {
        if (!hideUnusedMesh) {
          elements.push({ kind: 'rect', x, y, w: cell, h: cell, fill: blockFill });
        } else if (interiorUnused?.[r]?.[c] === true) {
          elements.push({
            kind: 'rect',
            x,
            y,
            w: cell,
            h: cell,
            fill: INTERIOR_LIGHT_GREY_FILL,
          });
        }
        continue;
      }
      elements.push({ kind: 'rect', x, y, w: cell, h: cell, fill: playFill });
      const glyph = showSolution ? sol : given != null && given !== '' ? given : null;
      if (glyph) {
        elements.push({
          kind: 'text',
          x,
          y,
          w: cell,
          h: cell,
          text: glyph,
          lines: [glyph],
          fontFamily,
          fontSize,
          color,
          bold: gp.typography.puzzleBold === true,
          italic: gp.typography.puzzleItalic === true,
          align: 'center',
          valign: 'middle',
          lineHeight: fontSize,
        });
      }
    }
  }

  if (hideUnusedMesh) {
    // Outline playable boxes + interior 1×1 holes (crossword unused-transparent protocol).
    const seen = new Set<string>();
    const pushEdge = (x1: number, y1: number, x2: number, y2: number) => {
      const key = `${x1.toFixed(3)},${y1.toFixed(3)},${x2.toFixed(3)},${y2.toFixed(3)}`;
      if (seen.has(key)) return;
      seen.add(key);
      elements.push({
        kind: 'line',
        x1,
        y1,
        x2,
        y2,
        color: lineColor,
        width: lineW,
      });
    };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isVisibleCell(r, c)) continue;
        const x = grid.leftPt + c * cell;
        const y = grid.topPt + r * cell;
        pushEdge(x, y, x + cell, y);
        pushEdge(x, y + cell, x + cell, y + cell);
        pushEdge(x, y, x, y + cell);
        pushEdge(x + cell, y, x + cell, y + cell);
      }
    }
  } else {
    for (let c = 0; c <= cols; c++) {
      const x = grid.leftPt + c * cell;
      elements.push({
        kind: 'line',
        x1: x,
        y1: grid.topPt,
        x2: x,
        y2: grid.topPt + grid.heightPt,
        color: lineColor,
        width: lineW,
      });
    }
    for (let r = 0; r <= rows; r++) {
      const y = grid.topPt + r * cell;
      elements.push({
        kind: 'line',
        x1: grid.leftPt,
        y1: y,
        x2: grid.leftPt + grid.widthPt,
        y2: y,
        color: lineColor,
        width: lineW,
      });
    }
  }

  let listBox: FillElementParts['listBox'] = null;
  if (!showSolution) {
    const listTop = grid.topPt + grid.heightPt + FILL_LIST_GAP_PT;
    const list = buildEntryListElements({
      groups: fillEntryListGroups(puzzle),
      x: slot.leftPt,
      y: listTop,
      widthPt: slot.widthPt,
      style: entryListStyle(gp),
    });
    if (list.heightPt > 0) {
      elements.push(...list.elements);
      listBox = { x: slot.leftPt, y: listTop, w: slot.widthPt, h: list.heightPt };
    }
  }

  return {
    elements,
    gridBox: { x: grid.leftPt, y: grid.topPt, w: grid.widthPt, h: grid.heightPt },
    listBox,
  };
}

export function buildFillElements(args: {
  puzzle: FillPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildFillElementParts(args).elements;
}
