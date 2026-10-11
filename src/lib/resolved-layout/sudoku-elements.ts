import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import {
  fitUniformGrid,
  formatSudokuSymbol,
  sudokuBoxOf,
  sudokuDigitFillRatio,
  sudokuLineScale,
  sudokuSizeOf,
} from '../generic-puzzle-geometry';
import {
  buildCalcudokuCageIdGrid,
  calcudokuCageLabel,
  calcudokuInternalBorder,
  calcudokuLabelCell,
  isCalcudokuPuzzle,
} from '../puzzles/calcudoku';
import { isSudokuGreaterThanPuzzle, isSudokuXPuzzle } from '../puzzles/sudoku';
import type { SudokuPuzzle } from '../puzzles/types';
import type { ResolvedElement } from './types';

export type SudokuElementParts = {
  elements: ResolvedElement[];
  /** Absolute page-pt bounds of the drawn grid (outer stroke box). */
  gridBox: { x: number; y: number; w: number; h: number };
};

export function buildSudokuElementParts(args: {
  puzzle: SudokuPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): SudokuElementParts {
  const { puzzle, slot, gp, showSolution, preferredCellPt } = args;
  const size = sudokuSizeOf(puzzle);
  const calcudoku = isCalcudokuPuzzle(puzzle);
  const sudokuX = !calcudoku && isSudokuXPuzzle(puzzle);
  const greaterThan = !calcudoku && isSudokuGreaterThanPuzzle(puzzle);
  const { boxH, boxW } = calcudoku ? { boxH: size, boxW: size } : sudokuBoxOf(size);
  const display = showSolution ? puzzle.solution : puzzle.grid;
  const color = gp.colors.gridColor || '#1f2937';
  const thinColor = '#d1d5db';
  const thicknessPct = showSolution
    ? gp.core.sudokuSolutionLineThickness ?? 100
    : gp.core.sudokuPuzzleLineThickness ?? 100;
  const { thinPt, thickPt, outerPt } = sudokuLineScale(thicknessPct);
  const fontPt = showSolution ? gp.typography.answerFontSize ?? 16 : gp.typography.puzzleFontSize ?? 14;
  const fontFamily = showSolution
    ? gp.typography.answerFontFamily || gp.typography.puzzleFontFamily || 'Arial'
    : gp.typography.puzzleFontFamily || 'Arial';
  const placement = showSolution
    ? 'none'
    : gp.core.sudokuDifficultyPlacement ?? (gp.core.showDifficultyLabel === false ? 'none' : 'bottom');
  const labelH = placement === 'none' ? 0 : Math.max(10, preferredCellPt * 0.34);
  const gridSlot: RectPt = {
    ...slot,
    topPt: placement === 'top' ? slot.topPt + labelH : slot.topPt,
    heightPt: slot.heightPt - labelH,
  };
  const grid = fitUniformGrid(size, size, preferredCellPt, gridSlot);
  const digitPt = grid.cellPt * sudokuDigitFillRatio(fontPt);
  const elements: ResolvedElement[] = [];

  if (placement === 'top' || placement === 'bottom') {
    const labelTop = placement === 'top' ? slot.topPt : grid.topPt + grid.heightPt + 4;
    const labelSize = Math.max(8, Math.min(digitPt * 0.7, grid.cellPt * 0.34));
    elements.push({
      kind: 'text',
      x: slot.leftPt,
      y: labelTop,
      w: slot.widthPt,
      h: labelH,
      text: `Difficulty: ${puzzle.difficulty ?? ''}`,
      lines: [`Difficulty: ${puzzle.difficulty ?? ''}`],
      fontFamily,
      fontSize: labelSize,
      color: '#4b5563',
      align: 'center',
      valign: 'middle',
      lineHeight: labelSize,
    });
  }

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

  const xMarkStyle = gp.core.sudokuXMarkStyle === 'lines' ? 'lines' : 'boxes';
  // Colored diagonal cells sit under grid lines (classic Sudoku X look).
  if (sudokuX && xMarkStyle === 'boxes') {
    const boxFill = gp.colors.sudokuXBoxColor || '#e6e6e6';
    const seen = new Set<string>();
    for (let i = 0; i < size; i++) {
      const cells: Array<[number, number]> = [
        [i, i],
        [i, size - 1 - i],
      ];
      for (const [r, c] of cells) {
        const key = `${r},${c}`;
        if (seen.has(key)) continue;
        seen.add(key);
        elements.push({
          kind: 'rect',
          x: grid.leftPt + c * grid.cellPt,
          y: grid.topPt + r * grid.cellPt,
          w: grid.cellPt,
          h: grid.cellPt,
          fill: boxFill,
        });
      }
    }
  }

  if (calcudoku) {
    const cageIds = buildCalcudokuCageIdGrid(size, puzzle.cages);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const right = calcudokuInternalBorder(cageIds, r, c, 'right');
        if (right !== 'none') {
          const x = grid.leftPt + (c + 1) * grid.cellPt;
          elements.push({
            kind: 'line',
            x1: x,
            y1: grid.topPt + r * grid.cellPt,
            x2: x,
            y2: grid.topPt + (r + 1) * grid.cellPt,
            color: right === 'thick' ? color : thinColor,
            width: right === 'thick' ? thickPt : thinPt,
          });
        }
        const bottom = calcudokuInternalBorder(cageIds, r, c, 'bottom');
        if (bottom !== 'none') {
          const y = grid.topPt + (r + 1) * grid.cellPt;
          elements.push({
            kind: 'line',
            x1: grid.leftPt + c * grid.cellPt,
            y1: y,
            x2: grid.leftPt + (c + 1) * grid.cellPt,
            y2: y,
            color: bottom === 'thick' ? color : thinColor,
            width: bottom === 'thick' ? thickPt : thinPt,
          });
        }
      }
    }
    for (const cage of puzzle.cages) {
      const cell = calcudokuLabelCell(cage);
      const text = calcudokuCageLabel(cage);
      const cageLabelPt = Math.max(5, Math.min(grid.cellPt * 0.26, (grid.cellPt * 0.86) / Math.max(2, text.length)));
      elements.push({
        kind: 'text',
        x: grid.leftPt + cell.col * grid.cellPt + Math.max(1.2, grid.cellPt * 0.05),
        y: grid.topPt + cell.row * grid.cellPt + Math.max(0.8, grid.cellPt * 0.03),
        w: grid.cellPt * 0.92,
        h: cageLabelPt + 2,
        text,
        lines: [text],
        fontFamily,
        fontSize: cageLabelPt,
        bold: true,
        color,
        align: 'left',
        valign: 'top',
        lineHeight: cageLabelPt,
      });
    }
  } else {
    for (let i = 1; i < size; i++) {
      const isBox = i % boxW === 0;
      elements.push({
        kind: 'line',
        x1: grid.leftPt + i * grid.cellPt,
        y1: grid.topPt,
        x2: grid.leftPt + i * grid.cellPt,
        y2: grid.topPt + grid.heightPt,
        color: isBox ? color : thinColor,
        width: isBox ? thickPt : thinPt,
      });
    }
    for (let i = 1; i < size; i++) {
      const isBox = i % boxH === 0;
      elements.push({
        kind: 'line',
        x1: grid.leftPt,
        y1: grid.topPt + i * grid.cellPt,
        x2: grid.leftPt + grid.widthPt,
        y2: grid.topPt + i * grid.cellPt,
        color: isBox ? color : thinColor,
        width: isBox ? thickPt : thinPt,
      });
    }
  }

  // Sudoku X lines: drawn under digits so glyphs stay readable.
  if (sudokuX && xMarkStyle === 'lines') {
    const diagColor = gp.colors.sudokuXLineColor || '#6b7280';
    const thicknessPct = Math.max(25, Math.min(300, gp.core.sudokuXLineThickness ?? 100)) / 100;
    const baseWidth = Math.max(thinPt * 1.15, Math.min(thickPt * 0.85, grid.cellPt * 0.08));
    const diagWidth = Math.max(0.45, baseWidth * thicknessPct);
    const transparency = Math.max(0, Math.min(100, gp.core.sudokuXLineTransparency ?? 0));
    const opacity = 1 - transparency / 100;
    elements.push({
      kind: 'line',
      x1: grid.leftPt,
      y1: grid.topPt,
      x2: grid.leftPt + grid.widthPt,
      y2: grid.topPt + grid.heightPt,
      color: diagColor,
      width: diagWidth,
      opacity,
    });
    elements.push({
      kind: 'line',
      x1: grid.leftPt + grid.widthPt,
      y1: grid.topPt,
      x2: grid.leftPt,
      y2: grid.topPt + grid.heightPt,
      color: diagColor,
      width: diagWidth,
      opacity,
    });
  }

  // Greater Than: inequality glyphs sit on cell borders (live text, editable).
  if (greaterThan && Array.isArray(puzzle.inequalities)) {
    const ineqPt = Math.max(6, Math.min(digitPt * 0.85, grid.cellPt * 0.28));
    const box = Math.max(ineqPt * 1.35, grid.cellPt * 0.34);
    for (const ineq of puzzle.inequalities) {
      const horizontal = ineq.r1 === ineq.r2 && Math.abs(ineq.c1 - ineq.c2) === 1;
      const vertical = ineq.c1 === ineq.c2 && Math.abs(ineq.r1 - ineq.r2) === 1;
      if (!horizontal && !vertical) continue;
      const glyph = ineq.gt ? '>' : '<';
      let x: number;
      let y: number;
      if (horizontal) {
        const midC = (ineq.c1 + ineq.c2) / 2;
        x = grid.leftPt + (midC + 0.5) * grid.cellPt - box / 2;
        y = grid.topPt + ineq.r1 * grid.cellPt + (grid.cellPt - box) / 2;
      } else {
        const midR = (ineq.r1 + ineq.r2) / 2;
        x = grid.leftPt + ineq.c1 * grid.cellPt + (grid.cellPt - box) / 2;
        y = grid.topPt + (midR + 0.5) * grid.cellPt - box / 2;
      }
      elements.push({
        kind: 'text',
        x,
        y,
        w: box,
        h: box,
        text: glyph,
        lines: [glyph],
        fontFamily,
        fontSize: ineqPt,
        bold: true,
        color,
        align: 'center',
        valign: 'middle',
        lineHeight: ineqPt,
        // Rotate so horizontal < / > become up/down arrows between stacked cells.
        ...(vertical ? { rotationDeg: 90 } : {}),
      });
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const glyph = formatSudokuSymbol(display[r]?.[c] ?? 0);
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
        bold: true,
        color,
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

export function buildSudokuElements(args: {
  puzzle: SudokuPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildSudokuElementParts(args).elements;
}
