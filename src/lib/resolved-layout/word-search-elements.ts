import { cssPxToPoints } from '../puzzle-layout';
import type { WordPlacement, WordSearchPuzzle } from '../puzzles/types';
import { isWordSearchShapeCell } from '../puzzles/word-search-shape-mask';
import type { UnifiedPageLayout, UnifiedGridBlock } from '../word-search-page-layout';
import type { ResolvedElement, ResolvedText } from './types';

function textBox(
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  fontSize: number,
  fontFamily: string,
  color: string,
  extra?: Partial<Pick<ResolvedText, 'bold' | 'italic' | 'align' | 'valign' | 'lines' | 'lineHeight' | 'effect'>>
): ResolvedText {
  const lines = extra?.lines ?? [value];
  return {
    kind: 'text',
    x,
    y,
    w: Math.max(1, w),
    h: Math.max(1, h),
    text: lines.join('\n'),
    lines,
    fontFamily,
    fontSize,
    color,
    bold: extra?.bold,
    italic: extra?.italic,
    align: extra?.align ?? 'left',
    valign: extra?.valign ?? 'middle',
    lineHeight: extra?.lineHeight ?? fontSize,
    effect: extra?.effect,
  };
}

export interface WordSearchSolutionStyle {
  color: string;
  thicknessPt: number;
  opacity: number;
  outlineColor: string;
  outlineExtraPt: number;
  /** Extra length past cell edges (matches canvas solutionStrokePadding). */
  paddingPt: number;
}

/** Shared highlight thickness. CSS pixel settings convert here, not in a painter. */
export function wordSearchSolutionStyle(answer: {
  solutionFrameColor?: string;
  solutionStrokeThickness?: number;
  solutionStrokePadding?: number;
  solutionHighlightAlpha?: number;
  solutionHighlightStrokeColor?: string;
  solutionHighlightStrokeThickness?: number;
}): WordSearchSolutionStyle {
  return {
    color: answer.solutionFrameColor || '#22c55e',
    thicknessPt: Math.max(1, cssPxToPoints(answer.solutionStrokeThickness || 12)),
    opacity: Math.max(0, Math.min(1, (answer.solutionHighlightAlpha ?? 30) / 100)),
    outlineColor: answer.solutionHighlightStrokeColor || '#000000',
    outlineExtraPt: Math.max(0, cssPxToPoints(answer.solutionHighlightStrokeThickness ?? 0)),
    paddingPt: Math.max(0, cssPxToPoints(answer.solutionStrokePadding ?? 0)),
  };
}

function cellCenter(leftPt: number, topPt: number, cellSizePt: number, col: number, row: number) {
  return {
    x: leftPt + col * cellSizePt + cellSizePt / 2,
    y: topPt + row * cellSizePt + cellSizePt / 2,
  };
}

/**
 * Highlight capsule endpoints — same geometry as canvas `drawSolutionGridInterior`:
 * H/V spans full cells; diagonals extend half a cell past the start/end centers.
 */
function mark(
  placement: WordPlacement,
  leftPt: number,
  topPt: number,
  cellSizePt: number,
  color: string,
  thickness: number,
  opacity: number,
  paddingPt = 0
): ResolvedElement {
  const { start, end } = placement;
  const isH = start.row === end.row;
  const isV = start.col === end.col;
  const pad = Math.max(0, paddingPt);

  if (isH) {
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);
    const y = topPt + start.row * cellSizePt + cellSizePt / 2;
    return {
      kind: 'stadium',
      x1: leftPt + minC * cellSizePt - pad,
      y1: y,
      x2: leftPt + (maxC + 1) * cellSizePt + pad,
      y2: y,
      color,
      thickness,
      opacity,
    };
  }

  if (isV) {
    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const x = leftPt + start.col * cellSizePt + cellSizePt / 2;
    return {
      kind: 'stadium',
      x1: x,
      y1: topPt + minR * cellSizePt - pad,
      x2: x,
      y2: topPt + (maxR + 1) * cellSizePt + pad,
      color,
      thickness,
      opacity,
    };
  }

  const s = cellCenter(leftPt, topPt, cellSizePt, start.col, start.row);
  const e = cellCenter(leftPt, topPt, cellSizePt, end.col, end.row);
  const dx = e.x - s.x;
  const dy = e.y - s.y;
  const dist = Math.hypot(dx, dy);
  const ux = dist > 0 ? dx / dist : 0;
  const uy = dist > 0 ? dy / dist : 0;
  // Canvas extends by half a cell past centers so the capsule covers full end cells.
  const ext = cellSizePt / 2 + pad;
  return {
    kind: 'stadium',
    x1: s.x - ux * ext,
    y1: s.y - uy * ext,
    x2: e.x + ux * ext,
    y2: e.y + uy * ext,
    color,
    thickness,
    opacity,
  };
}

/**
 * Letters, and solution highlights when requested.
 * Cell boxes come from the shared grid block. Painters must not recompute them.
 */
export function buildWordSearchGridElements(args: {
  puzzle: Pick<WordSearchPuzzle, 'grid' | 'shapeMask' | 'placements'>;
  grid: Pick<
    UnifiedGridBlock,
    'leftPt' | 'topPt' | 'cellSizePt' | 'fontSizePt' | 'fontFamily' | 'letterColor' | 'italic' | 'textEffect'
  >;
  showSolution?: boolean;
  solution?: WordSearchSolutionStyle;
  /** Draw only one layer when the painter still strokes a frame between them. */
  layer?: 'all' | 'letters' | 'marks';
}): ResolvedElement[] {
  const { puzzle, grid, showSolution, solution } = args;
  const layer = args.layer ?? 'all';
  const elements: ResolvedElement[] = [];
  if (layer !== 'letters' && showSolution && solution && puzzle.placements?.length) {
    for (const placement of puzzle.placements) {
      if (solution.outlineExtraPt > 0) {
        elements.push(
          mark(
            placement,
            grid.leftPt,
            grid.topPt,
            grid.cellSizePt,
            solution.outlineColor,
            solution.thicknessPt + solution.outlineExtraPt * 2,
            Math.min(1, solution.opacity + 0.25),
            solution.paddingPt
          )
        );
      }
      elements.push(
        mark(
          placement,
          grid.leftPt,
          grid.topPt,
          grid.cellSizePt,
          solution.color,
          solution.thicknessPt,
          solution.opacity,
          solution.paddingPt
        )
      );
    }
  }

  if (layer === 'marks') return elements;

  for (let row = 0; row < puzzle.grid.length; row++) {
    for (let col = 0; col < (puzzle.grid[row]?.length ?? 0); col++) {
      if (!isWordSearchShapeCell(puzzle.shapeMask, row, col)) continue;
      const letter = (puzzle.grid[row]?.[col] ?? '').trim();
      if (!letter) continue;
      elements.push(
        textBox(
          grid.leftPt + col * grid.cellSizePt,
          grid.topPt + row * grid.cellSizePt,
          grid.cellSizePt,
          grid.cellSizePt,
          letter,
          grid.fontSizePt,
          grid.fontFamily || 'Arial',
          grid.letterColor || '#000000',
          {
            align: 'center',
            valign: 'middle',
            lineHeight: grid.cellSizePt,
            italic: grid.italic,
            effect: grid.textEffect,
          }
        )
      );
    }
  }
  return elements;
}

/** Title and subtitle boxes from the shared word-search page layout. */
export function buildWordSearchChromeElements(
  layout: Pick<UnifiedPageLayout, 'title' | 'subtitle' | 'page' | 'headerAssembly'>
): ResolvedElement[] {
  if (layout.headerAssembly) return [];
  const elements: ResolvedElement[] = [];
  const title = layout.title;
  if (title?.text) {
    const lineHeight = title.fontSizePt * 1.2;
    elements.push(
      textBox(
        layout.page.marginPt,
        title.topPt,
        Math.max(1, layout.page.widthPt - layout.page.marginPt * 2),
        lineHeight,
        title.text,
        title.fontSizePt,
        title.fontFamily || 'Arial',
        title.color || '#000000',
        {
          align: title.align || 'center',
          bold: true,
          italic: title.italic,
          valign: 'top',
          lineHeight,
          effect: title.textEffect,
        }
      )
    );
  }
  const subtitle = layout.subtitle;
  if (subtitle?.text) {
    const lines = subtitle.wrappedLines?.length ? subtitle.wrappedLines : [subtitle.text];
    const lineHeight = subtitle.fontSizePt * 1.2;
    elements.push(
      textBox(
        subtitle.leftPt,
        subtitle.topPt,
        subtitle.widthPt,
        lineHeight * lines.length,
        lines.join('\n'),
        subtitle.fontSizePt,
        subtitle.fontFamily || 'Arial',
        subtitle.color || '#666666',
        { align: 'center', valign: 'top', lines, lineHeight, effect: subtitle.textEffect }
      )
    );
  }
  return elements;
}
