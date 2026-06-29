/**
 * Solution Grid Canvas Snapshot
 *
 * Renders a word-search solution grid (highlight capsules + letters + border)
 * onto a native Canvas2D context — pixel-perfect, zero DOM/SVG/html2canvas deps.
 *
 * Returns a high-DPI `data:image/png;base64,...` string ready for:
 *   • slide.addImage() in pptxgenjs
 *   • img.src in an HTML preview
 *   • Any other consumer that accepts a PNG data URL
 *
 * Safe for server-side usage: returns null when `document` is unavailable so
 * callers can fall back gracefully.
 */

import { WordSearchPuzzle, WordSearchSettings } from './puzzles/types';
import {
  resolvePuzzleGridBorder,
  resolveSolutionGridBorder,
} from './grid-border-settings';
import {
  drawSolutionGridInterior,
  roundRectPath,
} from './solution-grid-interior-draw';

/** PDF points (72/in) → CSS pixels (96/in) */
const PT_TO_PX = 96 / 72;

export interface SnapshotOptions {
  /** html2canvas-style scale factor. 3 → 288 DPI at 96-DPI base = crisp print. */
  scale?: number;
}

/**
 * Capture a high-resolution PNG snapshot of a word-search solution grid.
 */
export async function captureGridSnapshot(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  cellSizePt: number,
  gridFontSizePt: number,
  opts: SnapshotOptions = {},
  showSolution: boolean = true
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }

  const scale = opts.scale ?? 3;
  const { colors, core, typography } = settings;
  const pageColors = showSolution ? colors.answerPage : colors.puzzlePage;

  const cellPx = cellSizePt * PT_TO_PX;
  const fontPx = Math.max(4, gridFontSizePt * PT_TO_PX);

  const cols = puzzle.grid[0]?.length || 1;
  const rows = puzzle.grid.length || 1;

  const innerGridW = cellPx * cols;
  const innerGridH = cellPx * rows;
  const gridBorder = showSolution
    ? resolveSolutionGridBorder(core)
    : resolvePuzzleGridBorder(core);
  const paddingPx = gridBorder.paddingPx;
  const noBox = core.noBoxAroundPuzzle ?? false;
  const borderPx = noBox ? 0 : Math.max(0.5, gridBorder.strokeThicknessPx);

  const canvasW = innerGridW + paddingPx * 2 + borderPx * 2;
  const canvasH = innerGridH + paddingPx * 2 + borderPx * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(canvasW * scale);
  canvas.height = Math.ceil(canvasH * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.translate(borderPx + paddingPx, borderPx + paddingPx);

  try {
    await document.fonts.ready;
  } catch (_) {
    // Non-fatal
  }

  const radiusPx = Math.max(0, gridBorder.cornerRadiusPx);
  const padBoxW = innerGridW + paddingPx * 2;
  const padBoxH = innerGridH + paddingPx * 2;
  const clampedFillRadius = Math.min(radiusPx, padBoxW / 2, padBoxH / 2);
  ctx.fillStyle = '#ffffff';
  if (clampedFillRadius > 0) {
    roundRectPath(ctx, -paddingPx, -paddingPx, padBoxW, padBoxH, clampedFillRadius);
    ctx.fill();
  } else {
    ctx.fillRect(-paddingPx, -paddingPx, padBoxW, padBoxH);
  }

  const fontFamilyRaw = showSolution
    ? typography.setFontForAnswerPages
      ? typography.answerGridFontFamily || typography.puzzleGridFontFamily || 'Arial'
      : typography.puzzleGridFontFamily || 'Arial'
    : typography.puzzleGridFontFamily || 'Arial';

  drawSolutionGridInterior(ctx, puzzle, {
    cellPx,
    fontPx,
    letterColor: showSolution
      ? pageColors.lettersInSolutionColor || '#000000'
      : pageColors.puzzleColor || '#000000',
    fontFamily: fontFamilyRaw,
    solutionFrameColor: pageColors.solutionFrameColor || '#22c55e',
    solutionStrokeThicknessPx: Math.max(1, (pageColors.solutionStrokeThickness || 12) * PT_TO_PX),
    solutionStrokePaddingPx: Math.max(0, (pageColors.solutionStrokePadding || 0) * PT_TO_PX),
    solutionHighlightAlpha: pageColors.solutionHighlightAlpha ?? 30,
  });

  if (!noBox && borderPx > 0) {
    const boxColor = pageColors.boxColor || '#000000';
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = borderPx;

    const half = borderPx / 2;
    const strokeW = innerGridW + paddingPx * 2 + borderPx * 2 - borderPx;
    const strokeH = innerGridH + paddingPx * 2 + borderPx * 2 - borderPx;
    const clampedRadius = Math.min(radiusPx, strokeW / 2, strokeH / 2);

    roundRectPath(
      ctx,
      -paddingPx - borderPx + half,
      -paddingPx - borderPx + half,
      strokeW,
      strokeH,
      clampedRadius
    );
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}
