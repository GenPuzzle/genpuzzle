import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { RectPt } from '../generic-puzzle-page-layout';
import { fitUniformGrid, sudokuDigitFillRatio } from '../generic-puzzle-geometry';
import type { KakuroPuzzle } from '../puzzles/kakuro';
import type { ResolvedElement } from './types';

function finitePositive(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Honor the user size; only shrink when it cannot fit the triangle/cell. */
function fitFontSize(requested: number, maxPt: number, minPt: number): number {
  const req = Number.isFinite(requested) ? requested : minPt;
  return Math.max(minPt, Math.min(req, maxPt));
}

/** Single line width for cell borders, perimeter, and clue diagonals. */
export function kakuroGridLineWidthPt(gp: GenericPuzzleSettings): number {
  const core = gp.core as GenericPuzzleSettings['core'] & {
    kakuroGridLineWidth?: number;
    kakuroInnerLineWidth?: number;
  };
  const raw =
    core.kakuroGridLineWidth ??
    core.kakuroInnerLineWidth ??
    0.75;
  return Math.max(0.35, Math.min(3, finitePositive(raw, 0.75)));
}

export type KakuroFontHit = {
  target: 'clues' | 'grid';
  x: number;
  y: number;
  w: number;
  h: number;
};

export type KakuroElementParts = {
  elements: ResolvedElement[];
  gridBox: { x: number; y: number; w: number; h: number };
  /** Canvas Workspace hit boxes for clue / digit text. */
  fontHits: KakuroFontHit[];
};

/**
 * Cell-by-cell Kakuro layout matching the book reference:
 * every cell is its own square; thin uniform grid lines run through black cells;
 * clue diagonals inherit grid line width; across/down sit in their triangles.
 */
export function buildKakuroElementParts(args: {
  puzzle: KakuroPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): KakuroElementParts {
  const { puzzle, slot, gp, showSolution } = args;
  const rows = Math.max(1, Math.round(finitePositive(puzzle.rows, 9)));
  const cols = Math.max(1, Math.round(finitePositive(puzzle.columns, rows)));
  const preferredCellPt = finitePositive(args.preferredCellPt, 18);

  const blockFill = gp.core.kakuroBlockFill || '#000000';
  const clueFill = gp.core.kakuroClueCellFill || blockFill;
  const playableFill = gp.core.kakuroPlayableFill || '#ffffff';
  const clueColor = gp.core.kakuroClueTextColor || '#ffffff';
  const digitColor = gp.core.kakuroDigitColor || '#000000';

  // Light gray default so seams stay visible on black cells (reference style)
  let gridLineColor = gp.core.kakuroGridLineColor || '#d4d4d4';
  const lineLc = gridLineColor.toLowerCase();
  const blockLc = blockFill.toLowerCase();
  if (
    lineLc === blockLc ||
    ((lineLc === '#000' || lineLc === '#000000') &&
      (blockLc === '#000' || blockLc === '#000000' || blockLc === 'black'))
  ) {
    gridLineColor = '#d4d4d4';
  }

  const lineW = kakuroGridLineWidthPt(gp);

  const clueFont = gp.typography.kakuroClueFontFamily || gp.typography.puzzleFontFamily || 'Arial';
  const clueFontPt = finitePositive(gp.typography.kakuroClueFontSize, 7);
  const clueBold = gp.typography.kakuroClueBold !== false;

  const digitFont = showSolution
    ? gp.typography.answerFontFamily || gp.typography.puzzleFontFamily || 'Arial'
    : gp.typography.puzzleFontFamily || 'Arial';
  const digitFontSetting = finitePositive(
    showSolution ? gp.typography.answerFontSize : gp.typography.puzzleFontSize,
    16
  );
  const digitBold = showSolution ? true : gp.typography.puzzleBold === true;

  const grid = fitUniformGrid(rows, cols, preferredCellPt, slot);
  const cell = finitePositive(grid.cellPt, preferredCellPt);
  const digitPt = fitFontSize(
    Math.max(7, cell * sudokuDigitFillRatio(digitFontSetting)),
    cell * 0.78,
    7
  );
  // Clue size follows the Canvas Workspace / panel setting; only capped by triangle space.
  const cluePt = fitFontSize(clueFontPt, cell * 0.42, 4);
  const clueBox = Math.max(cluePt * 1.35, cell * 0.36);

  const elements: ResolvedElement[] = [];
  const fontHits: KakuroFontHit[] = [];

  // Draw EVERY cell as its own square — never one merged black panel
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cellData = puzzle.cells[r]?.[c];
      if (!cellData) continue;
      const x = grid.leftPt + c * cell;
      const y = grid.topPt + r * cell;

      if (cellData.type === 'playable') {
        elements.push({
          kind: 'rect',
          x,
          y,
          w: cell,
          h: cell,
          fill: playableFill,
        });
        if (showSolution) {
          const digit = puzzle.solution[r]?.[c];
          if (digit != null && digit >= 1 && digit <= 9) {
            const glyph = String(digit);
            elements.push({
              kind: 'text',
              x,
              y,
              w: cell,
              h: cell,
              text: glyph,
              lines: [glyph],
              fontFamily: digitFont,
              fontSize: digitPt,
              color: digitColor,
              bold: digitBold,
              align: 'center',
              valign: 'middle',
              lineHeight: digitPt,
            });
            fontHits.push({ target: 'grid', x, y, w: cell, h: cell });
          }
        }
        continue;
      }

      if (cellData.type === 'block') {
        elements.push({
          kind: 'rect',
          x,
          y,
          w: cell,
          h: cell,
          fill: blockFill,
        });
        continue;
      }

      // Clue cell: fill + corner-to-corner diagonal + triangle clues
      elements.push({
        kind: 'rect',
        x,
        y,
        w: cell,
        h: cell,
        fill: clueFill,
      });
      elements.push({
        kind: 'line',
        x1: x,
        y1: y,
        x2: x + cell,
        y2: y + cell,
        color: gridLineColor,
        width: lineW,
      });

      if (cellData.across != null) {
        const label = String(cellData.across);
        // Upper-right triangle (~0.70, 0.28 of cell)
        const cx = x + cell * 0.7;
        const cy = y + cell * 0.28;
        const tx = cx - clueBox / 2;
        const ty = cy - clueBox / 2;
        elements.push({
          kind: 'text',
          x: tx,
          y: ty,
          w: clueBox,
          h: clueBox,
          text: label,
          lines: [label],
          fontFamily: clueFont,
          fontSize: cluePt,
          color: clueColor,
          bold: clueBold,
          align: 'center',
          valign: 'middle',
          lineHeight: cluePt,
        });
        fontHits.push({ target: 'clues', x: tx, y: ty, w: clueBox, h: clueBox });
      }
      if (cellData.down != null) {
        const label = String(cellData.down);
        // Lower-left triangle (~0.28, 0.72 of cell)
        const cx = x + cell * 0.28;
        const cy = y + cell * 0.72;
        const tx = cx - clueBox / 2;
        const ty = cy - clueBox / 2;
        elements.push({
          kind: 'text',
          x: tx,
          y: ty,
          w: clueBox,
          h: clueBox,
          text: label,
          lines: [label],
          fontFamily: clueFont,
          fontSize: cluePt,
          color: clueColor,
          bold: clueBold,
          align: 'center',
          valign: 'middle',
          lineHeight: cluePt,
        });
        fontHits.push({ target: 'clues', x: tx, y: ty, w: clueBox, h: clueBox });
      }
    }
  }

  // Uniform grid lines through ALL cells (same width for perimeter + internals)
  for (let c = 0; c <= cols; c++) {
    const x = grid.leftPt + c * cell;
    elements.push({
      kind: 'line',
      x1: x,
      y1: grid.topPt,
      x2: x,
      y2: grid.topPt + grid.heightPt,
      color: gridLineColor,
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
      color: gridLineColor,
      width: lineW,
    });
  }

  return {
    elements,
    gridBox: {
      x: grid.leftPt,
      y: grid.topPt,
      w: grid.widthPt,
      h: grid.heightPt,
    },
    fontHits,
  };
}

export function buildKakuroElements(args: {
  puzzle: KakuroPuzzle;
  slot: RectPt;
  gp: GenericPuzzleSettings;
  showSolution: boolean;
  preferredCellPt: number;
}): ResolvedElement[] {
  return buildKakuroElementParts(args).elements;
}
