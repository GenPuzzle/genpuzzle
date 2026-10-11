import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import { fitUniformGrid, sudokuDigitFillRatio } from '../generic-puzzle-geometry';
import {
  formatBinairoSymbol,
  type BinairoPuzzle,
  type BinairoSymbols,
} from '../puzzles/binairo';
import type { ResolvedElement } from './types';

function finitePositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function binairoStrokeWidths(strokeWidthSetting: unknown): { thinPt: number; outerPt: number } {
  const scale = Math.max(0.5, Math.min(4, finitePositive(strokeWidthSetting, 1)));
  return {
    thinPt: Math.max(0.35, 0.7 * scale),
    outerPt: Math.max(0.8, 1.35 * scale),
  };
}

export type BinairoElementParts = {
  elements: ResolvedElement[];
  /** Absolute page-pt bounds of the drawn grid (outer stroke box). */
  gridBox: { x: number; y: number; w: number; h: number };
};

export function buildBinairoElementParts(args: {
  puzzle: BinairoPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): BinairoElementParts {
  const { puzzle, slot, gp, showSolution } = args;
  const rows = Math.max(1, Math.round(finitePositive(puzzle.rows, 10)));
  const cols = Math.max(1, Math.round(finitePositive(puzzle.columns, rows)));
  const symbols = (puzzle.symbols || gp.core.binairoSymbols || '01') as BinairoSymbols;
  const display = showSolution ? puzzle.solution : puzzle.puzzle;
  const color = gp.core.binairoGridLineColor || gp.colors.gridColor || '#1f2937';
  const symbolColor = gp.core.binairoSymbolColor || gp.colors.gridColor || '#111827';
  const { thinPt, outerPt } = binairoStrokeWidths(gp.core.binairoGridStrokeWidth);
  const preferredCellPt = finitePositive(args.preferredCellPt, 18);
  const fontPt = finitePositive(
    showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize,
    16
  );
  const fontFamily = showSolution
    ? gp.typography.answerFontFamily || gp.typography.puzzleFontFamily || 'Arial'
    : gp.typography.puzzleFontFamily || 'Arial';
  const bold = showSolution ? true : gp.typography.puzzleBold === true;

  const grid = fitUniformGrid(rows, cols, preferredCellPt, slot);
  // Match Sudoku: font-size slider maps through fill ratio so canvas/sidebar changes are visible.
  const digitPt = Math.max(
    6,
    Math.min(
      finitePositive(grid.cellPt, preferredCellPt) * 0.92,
      grid.cellPt * sudokuDigitFillRatio(fontPt)
    )
  );
  const elements: ResolvedElement[] = [];

  elements.push({
    kind: 'rect',
    x: grid.leftPt,
    y: grid.topPt,
    w: grid.widthPt,
    h: grid.heightPt,
    fill: '#ffffff',
    stroke: color,
    strokeWidth: outerPt,
  });

  for (let c = 1; c < cols; c++) {
    const x = grid.leftPt + c * grid.cellPt;
    elements.push({
      kind: 'line',
      x1: x,
      y1: grid.topPt,
      x2: x,
      y2: grid.topPt + grid.heightPt,
      color,
      width: thinPt,
    });
  }
  for (let r = 1; r < rows; r++) {
    const y = grid.topPt + r * grid.cellPt;
    elements.push({
      kind: 'line',
      x1: grid.leftPt,
      y1: y,
      x2: grid.leftPt + grid.widthPt,
      y2: y,
      color,
      width: thinPt,
    });
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const raw = display[r]?.[c];
      const glyph = formatBinairoSymbol(
        raw === 0 || raw === 1 ? raw : null,
        symbols
      );
      if (!glyph) continue;
      elements.push({
        kind: 'text',
        x: grid.leftPt + c * grid.cellPt,
        y: grid.topPt + r * grid.cellPt,
        w: grid.cellPt,
        h: grid.cellPt,
        text: glyph,
        lines: [glyph],
        fontFamily,
        fontSize: digitPt,
        color: symbolColor,
        bold,
        align: 'center',
        valign: 'middle',
        lineHeight: digitPt,
      });
    }
  }

  return {
    elements,
    gridBox: {
      x: grid.leftPt,
      y: grid.topPt,
      w: grid.widthPt,
      h: grid.heightPt,
    },
  };
}

export function buildBinairoElements(args: {
  puzzle: BinairoPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildBinairoElementParts(args).elements;
}
