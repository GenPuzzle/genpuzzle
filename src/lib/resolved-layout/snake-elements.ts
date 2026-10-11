import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import { fitUniformGrid } from '../generic-puzzle-geometry';
import type { SnakePuzzle } from '../puzzles/snake';
import {
  buildEntryListElements,
  measureEntryList,
  snakeEntryListStyle,
  type EntryListGroup,
} from './entry-list-elements';
import type { ResolvedElement } from './types';

function finitePositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type SnakeElementParts = {
  elements: ResolvedElement[];
  gridBox: { x: number; y: number; w: number; h: number };
  /** Word / number list under the grid (puzzle pages only). */
  listBox: { x: number; y: number; w: number; h: number } | null;
};

export const SNAKE_LIST_GAP_PT = 10;

/** Alphabetical so the list does not reveal the order along the snake. */
export function snakeEntryListGroups(puzzle: SnakePuzzle): EntryListGroup[] {
  const items = puzzle.entries
    .map((e) => e.text)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return items.length ? [{ heading: null, items }] : [];
}

export function snakeListReservePt(
  puzzle: SnakePuzzle,
  gp: GenericPuzzleSettings,
  widthPt: number,
  showSolution: boolean
): number {
  if (showSolution) return 0;
  const h = measureEntryList(snakeEntryListGroups(puzzle), widthPt, snakeEntryListStyle(gp));
  return h > 0 ? h + SNAKE_LIST_GAP_PT : 0;
}

export function buildSnakeElementParts(args: {
  puzzle: SnakePuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): SnakeElementParts {
  const { puzzle, slot, gp, showSolution } = args;
  const rows = Math.max(1, puzzle.rows);
  const cols = Math.max(1, puzzle.columns);
  const listReserve = snakeListReservePt(puzzle, gp, slot.widthPt, showSolution);
  const gridSlotH = Math.max(slot.heightPt * 0.55, slot.heightPt - listReserve);
  const grid = fitUniformGrid(cols, rows, finitePositive(args.preferredCellPt, 16), {
    ...slot,
    heightPt: gridSlotH,
  });
  const cell = finitePositive(grid.cellPt, 16);
  const lineW = Math.max(0.35, Math.min(3, finitePositive(gp.core.snakeGridLineWidth, 0.75)));
  const lineColor = gp.core.snakeGridLineColor || '#111111';
  const noBox = gp.core.snakeNoBoxAroundPuzzle === true;
  const innerLines = gp.core.snakeAddGridLines !== false;
  const pathColor =
    gp.core.snakeSolutionPathColor || gp.colors.solutionPathColor || '#111111';
  const otherColor = gp.core.snakeNonPathColor || '#111111';
  const fontFamily =
    (showSolution ? gp.typography.answerFontFamily : gp.typography.puzzleFontFamily) || 'Arial';
  const fontSize = Math.min(
    cell * 0.72,
    finitePositive(showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize, 14)
  );
  const ink = gp.colors.gridColor || '#111111';
  const pathSet = new Set(puzzle.path.map((p) => `${p.row},${p.col}`));
  const elements: ResolvedElement[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      elements.push({
        kind: 'rect',
        x: grid.leftPt + c * cell,
        y: grid.topPt + r * cell,
        w: cell,
        h: cell,
        fill: '#ffffff',
      });
    }
  }

  // Solution highlight under the letters so thickness/opacity stay adjustable.
  if (showSolution && puzzle.path.length > 1) {
    const thicknessPct = Math.max(
      5,
      Math.min(80, Number(gp.core.snakeSolutionPathThickness) || 18)
    );
    const strokeW = Math.max(1.2, (cell * thicknessPct) / 100);
    const opacity = Math.max(
      0,
      Math.min(1, (Number(gp.core.snakeSolutionPathOpacity) ?? 100) / 100)
    );
    for (let i = 0; i < puzzle.path.length - 1; i++) {
      const a = puzzle.path[i]!;
      const b = puzzle.path[i + 1]!;
      elements.push({
        kind: 'stadium',
        x1: grid.leftPt + (a.col + 0.5) * cell,
        y1: grid.topPt + (a.row + 0.5) * cell,
        x2: grid.leftPt + (b.col + 0.5) * cell,
        y2: grid.topPt + (b.row + 0.5) * cell,
        color: pathColor,
        thickness: strokeW,
        opacity,
      });
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const glyph = puzzle.grid[r]?.[c] ?? '';
      if (!glyph) continue;
      const onPath = pathSet.has(`${r},${c}`);
      elements.push({
        kind: 'text',
        x: grid.leftPt + c * cell,
        y: grid.topPt + r * cell,
        w: cell,
        h: cell,
        text: glyph,
        lines: [glyph],
        fontFamily,
        fontSize,
        color: showSolution ? (onPath ? pathColor : otherColor) : ink,
        bold: gp.typography.puzzleBold !== false,
        italic: gp.typography.puzzleItalic === true,
        align: 'center',
        valign: 'middle',
        lineHeight: fontSize,
      });
    }
  }

  // Grid lines: inner lines follow "Add Grid Lines", the frame follows "No Box".
  for (let c = 0; c <= cols; c++) {
    const isEdge = c === 0 || c === cols;
    if (isEdge ? noBox : !innerLines) continue;
    const x = grid.leftPt + c * cell;
    elements.push({
      kind: 'line',
      x1: x,
      y1: grid.topPt,
      x2: x,
      y2: grid.topPt + grid.heightPt,
      color: lineColor,
      width: isEdge ? lineW * 1.6 : lineW,
    });
  }
  for (let r = 0; r <= rows; r++) {
    const isEdge = r === 0 || r === rows;
    if (isEdge ? noBox : !innerLines) continue;
    const y = grid.topPt + r * cell;
    elements.push({
      kind: 'line',
      x1: grid.leftPt,
      y1: y,
      x2: grid.leftPt + grid.widthPt,
      y2: y,
      color: lineColor,
      width: isEdge ? lineW * 1.6 : lineW,
    });
  }

  let listBox: SnakeElementParts['listBox'] = null;
  if (!showSolution) {
    const listTop = grid.topPt + grid.heightPt + SNAKE_LIST_GAP_PT;
    const list = buildEntryListElements({
      groups: snakeEntryListGroups(puzzle),
      x: slot.leftPt,
      y: listTop,
      widthPt: slot.widthPt,
      style: snakeEntryListStyle(gp),
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

export function buildSnakeElements(args: {
  puzzle: SnakePuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildSnakeElementParts(args).elements;
}
