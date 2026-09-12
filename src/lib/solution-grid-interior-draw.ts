/**
 * Shared letter-grid interior renderer (highlights + letters).
 * Used by the UI solution preview canvas and by solution-canvas-snapshot (PPT).
 */
import type { WordSearchPuzzle } from './puzzles/types';
import { isWordSearchShapeCell } from './puzzles/word-search-shape-mask';
import { parseRgba } from './color-utils';

function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } {
  return parseRgba(hex);
}

function rgbaStr(hex: string, alpha: number): string {
  const { r, g, b, a } = hexToRgb(hex);
  const combined = (a / 255) * Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${combined})`;
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rx = Math.min(Math.abs(r), Math.abs(w) / 2);
  const ry = Math.min(Math.abs(r), Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + w - rx, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + ry);
  ctx.lineTo(x + w, y + h - ry);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rx, y + h);
  ctx.lineTo(x + rx, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - ry);
  ctx.lineTo(x, y + ry);
  ctx.quadraticCurveTo(x, y, x + rx, y);
  ctx.closePath();
}

export interface SolutionGridInteriorDrawOptions {
  cellPx: number;
  fontPx: number;
  letterColor: string;
  fontFamily: string;
  solutionFrameColor: string;
  solutionStrokeThicknessPx: number;
  solutionStrokePaddingPx: number;
  solutionHighlightAlpha: number;
  letterStrokeColor?: string;
  letterStrokeThicknessPx?: number;
  /** Outline color for highlight capsules. */
  solutionHighlightStrokeColor?: string;
  /** Outline thickness for highlight capsules in CSS px (0 = no outline). */
  solutionHighlightStrokeThicknessPx?: number;
  /** When false, skip solution highlight capsules (puzzle-page snapshots). */
  drawHighlights?: boolean;
  /** When false, skip letter glyphs (PPT underlay: highlights/shape only; letters stay editable). */
  drawLetters?: boolean;
}

/** Draw highlight capsules then centred letters on a grid-local canvas context. */
export function drawSolutionGridInterior(
  ctx: CanvasRenderingContext2D,
  puzzle: WordSearchPuzzle,
  options: SolutionGridInteriorDrawOptions
): void {
  const {
    cellPx,
    fontPx,
    letterColor,
    fontFamily,
    solutionFrameColor,
    solutionStrokeThicknessPx,
    solutionStrokePaddingPx,
    solutionHighlightAlpha,
    letterStrokeColor,
    letterStrokeThicknessPx = 0,
    solutionHighlightStrokeColor,
    solutionHighlightStrokeThicknessPx = 0,
    drawHighlights = true,
    drawLetters = true,
  } = options;

  const cols = puzzle.grid[0]?.length || 1;
  const rows = puzzle.grid.length || 1;
  const hThickPx = Math.max(1, solutionStrokeThicknessPx);
  const hPadPx = Math.max(0, solutionStrokePaddingPx);
  const hAlpha = Math.max(0, Math.min(100, solutionHighlightAlpha)) / 100;
  const hStrokePx = Math.max(0, solutionHighlightStrokeThicknessPx);
  const hStrokeColor = solutionHighlightStrokeColor || '#000000';

  const paintCapsule = () => {
    ctx.fill();
    if (hStrokePx > 0) {
      ctx.strokeStyle = rgbaStr(hStrokeColor, Math.min(1, hAlpha + 0.35));
      ctx.lineWidth = hStrokePx;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  if (drawHighlights && puzzle.placements && puzzle.placements.length > 0) {
    for (const placement of puzzle.placements) {
      const { start, end } = placement;
      const color = placement.color || solutionFrameColor;
      const thickness = hThickPx;
      const padding = hPadPx;
      const radius = thickness / 2;

      const sCX = start.col * cellPx + cellPx / 2;
      const sCY = start.row * cellPx + cellPx / 2;
      const eCX = end.col * cellPx + cellPx / 2;
      const eCY = end.row * cellPx + cellPx / 2;

      const isH = start.row === end.row;
      const isV = start.col === end.col;

      ctx.save();
      ctx.fillStyle = rgbaStr(color, hAlpha);

      if (!isH && !isV) {
        const dx = eCX - sCX;
        const dy = eCY - sCY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const extensionDist = cellPx / 2;
        const unitDx = dist > 0 ? dx / dist : 0;
        const unitDy = dist > 0 ? dy / dist : 0;
        const sCXAdj = sCX - unitDx * extensionDist;
        const sCYAdj = sCY - unitDy * extensionDist;
        const eCXAdj = eCX + unitDx * extensionDist;
        const eCYAdj = eCY + unitDy * extensionDist;
        const distAdj = Math.sqrt((eCXAdj - sCXAdj) ** 2 + (eCYAdj - sCYAdj) ** 2);
        const cx = (sCXAdj + eCXAdj) / 2;
        const cy = (sCYAdj + eCYAdj) / 2;
        const capsuleW = distAdj + padding * 2;
        const capsuleH = thickness;

        ctx.translate(cx, cy);
        ctx.rotate(angle);
        roundRectPath(ctx, -capsuleW / 2, -capsuleH / 2, capsuleW, capsuleH, radius);
        paintCapsule();
      } else if (isH) {
        const minC = Math.min(start.col, end.col);
        const maxC = Math.max(start.col, end.col);
        const x = minC * cellPx - padding;
        const y = start.row * cellPx + (cellPx - thickness) / 2;
        const w = (maxC - minC + 1) * cellPx + padding * 2;
        roundRectPath(ctx, x, y, w, thickness, radius);
        paintCapsule();
      } else {
        const minR = Math.min(start.row, end.row);
        const maxR = Math.max(start.row, end.row);
        const x = start.col * cellPx + (cellPx - thickness) / 2;
        const y = minR * cellPx - padding;
        const h = (maxR - minR + 1) * cellPx + padding * 2;
        roundRectPath(ctx, x, y, thickness, h, radius);
        paintCapsule();
      }

      ctx.restore();
    }
  }

  if (!drawLetters) return;

  const fontFamilyCss = fontFamily.includes(' ')
    ? `"${fontFamily}", Arial, sans-serif`
    : `${fontFamily}, Arial, sans-serif`;

  ctx.fillStyle = letterColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const letterOutline = Math.max(0, letterStrokeThicknessPx);
  const letterRgba = parseRgba(letterColor);
  if (letterOutline > 0 && letterStrokeColor) {
    const strokeRgba = parseRgba(letterStrokeColor);
    ctx.strokeStyle = rgbaStr(letterStrokeColor, strokeRgba.a / 255);
    ctx.lineWidth = letterOutline * 2;
    ctx.lineJoin = 'round';
  }
  ctx.fillStyle = rgbaStr(letterColor, letterRgba.a / 255);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!isWordSearchShapeCell(puzzle.shapeMask, row, col)) continue;
      const letter = (puzzle.grid[row]?.[col] ?? '').trim();
      if (!letter) continue;
      const cx = col * cellPx + cellPx / 2;
      const cy = row * cellPx + cellPx / 2;
      ctx.font = `${Math.max(1, fontPx)}px ${fontFamilyCss}`;
      if (letterOutline > 0 && letterStrokeColor) {
        ctx.strokeText(letter, cx, cy);
      }
      ctx.fillText(letter, cx, cy);
    }
  }
}
