/**
 * Solution Grid Canvas Snapshot
 *
 * Renders a word-search solution/puzzle grid (highlights + letters + border)
 * onto Canvas2D for PPT (and preview). Must match the on-canvas WordSearchGrid
 * solution renderer: same cell size, font family, font size, fill, and stroke.
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
import {
  drawShapeMaskImageOnCanvas,
  resolveShapeMaskImageSrc,
} from './puzzles/word-search-shape-mask';

/** PDF points (72/in) → CSS pixels (96/in) — same as preview `ptToPx`. */
const PT_TO_PX = 96 / 72;

export interface SnapshotOptions {
  /** html2canvas-style scale factor. 3 → 288 DPI at 96-DPI base = crisp print. */
  scale?: number;
  /**
   * When false, omit letter glyphs (PPT underlay: border / shape / highlights only).
   */
  includeLetters?: boolean;
}

export interface GridSnapshotResult {
  dataUrl: string;
  /** Always 0 — kept for call-site compatibility. */
  inkPadPt: number;
}

/** Force the exact face used by the canvas so PPT/PDF snapshots are not Arial fallbacks. */
async function ensureCanvasFontLoaded(family: string, sizePx: number): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  const px = Math.max(1, Math.round(sizePx));
  const quoted = family.includes(' ') ? `"${family}"` : family;
  const spec = `${px}px ${quoted}`;
  try {
    await document.fonts.ready;
    await document.fonts.load(spec);
    if (document.fonts.check(spec)) return;

    // Explicitly register bundled publishing fonts if CSS @font-face hasn't applied yet.
    const { FONT_REGISTRY, normalizeFontFamily, isPublishingFont } = await import(
      './publishing-fonts'
    );
    const normalized = normalizeFontFamily(family);
    if (isPublishingFont(normalized)) {
      const url = FONT_REGISTRY[normalized].ttfUrl?.regular;
      if (url) {
        const face = new FontFace(normalized, `url(${url})`);
        await face.load();
        document.fonts.add(face);
        await document.fonts.load(spec);
      }
    }
  } catch {
    // Non-fatal: draw will fall back to sans-serif
  }
}

/**
 * Capture a high-resolution PNG of a word-search grid.
 * Font size is `gridFontSizePt` in layout points → CSS px via ×(96/72), matching preview.
 */
export async function captureGridSnapshot(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  cellSizePt: number,
  gridFontSizePt: number,
  opts: SnapshotOptions = {},
  showSolution: boolean = true
): Promise<GridSnapshotResult | null> {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null;
  }

  const scale = opts.scale ?? 3;
  const includeLetters = opts.includeLetters !== false;
  const { colors, core, typography } = settings;
  const pageColors = showSolution ? colors.answerPage : colors.puzzlePage;

  // Same conversion PreviewCanvas uses: ptToPx(grid.fontSizePt) / ptToPx(cellSizePt).
  const cellPx = cellSizePt * PT_TO_PX;
  const fontPx = Math.max(4, gridFontSizePt * PT_TO_PX);

  const cols = puzzle.grid[0]?.length || 1;
  const rows = puzzle.grid.length || 1;

  const innerGridW = cellPx * cols;
  const innerGridH = cellPx * rows;
  const gridBorder = showSolution
    ? resolveSolutionGridBorder(core)
    : resolvePuzzleGridBorder(core);
  const noBox = core.noBoxAroundPuzzle ?? false;
  const paddingPx = noBox ? 0 : gridBorder.paddingPx;
  const borderPx = noBox ? 0 : Math.max(0.5, gridBorder.strokeThicknessPx);

  const puzzlePageColors = colors.puzzlePage;
  const answerPageColors = colors.answerPage;
  const letterStrokeThicknessPx = Math.max(
    0,
    puzzlePageColors.puzzleLetterStrokeThickness ?? 0
  );

  // No ink-pad: placing a padded bitmap into the logical box was shrinking letters.
  // Match WordSearchGrid solution canvas (inner grid only + CSS frame outside).
  const inkPadPt = 0;

  const canvasW = innerGridW + paddingPx * 2 + borderPx * 2;
  const canvasH = innerGridH + paddingPx * 2 + borderPx * 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(canvasW * scale);
  canvas.height = Math.ceil(canvasH * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.translate(borderPx + paddingPx, borderPx + paddingPx);

  const fontFamilyRaw = showSolution
    ? typography.setFontForAnswerPages
      ? typography.answerGridFontFamily || typography.puzzleGridFontFamily || 'Arial'
      : typography.puzzleGridFontFamily || 'Arial'
    : typography.puzzleGridFontFamily || 'Arial';

  await ensureCanvasFontLoaded(fontFamilyRaw, fontPx);

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

  if (core.shapeWordSearchEnabled && core.shapeMaskShowImage) {
    const shapeSrc = resolveShapeMaskImageSrc(core, puzzle.puzzleIndexInDocument ?? 0);
    if (shapeSrc) {
      try {
        await drawShapeMaskImageOnCanvas(ctx, shapeSrc, innerGridW, innerGridH, {
          fit: core.shapeMaskFit ?? 'contain',
          opacity: Math.max(0, Math.min(100, core.shapeMaskImageOpacity ?? 35)) / 100,
        });
      } catch {
        // Non-fatal
      }
    }
  }

  drawSolutionGridInterior(ctx, puzzle, {
    cellPx,
    fontPx,
    letterColor: puzzlePageColors.puzzleColor || '#000000',
    fontFamily: fontFamilyRaw,
    solutionFrameColor:
      (showSolution ? answerPageColors.solutionFrameColor : undefined) ||
      pageColors.solutionFrameColor ||
      '#22c55e',
    // Bar/padding: PreviewCanvas passes ptToPx(stored) into WordSearchGrid — match that.
    solutionStrokeThicknessPx: Math.max(
      1,
      ((showSolution ? answerPageColors.solutionStrokeThickness : undefined) ??
        pageColors.solutionStrokeThickness ??
        12) * PT_TO_PX
    ),
    solutionStrokePaddingPx: Math.max(
      0,
      ((showSolution ? answerPageColors.solutionStrokePadding : undefined) ??
        pageColors.solutionStrokePadding ??
        0) * PT_TO_PX
    ),
    solutionHighlightAlpha:
      (showSolution ? answerPageColors.solutionHighlightAlpha : undefined) ??
      pageColors.solutionHighlightAlpha ??
      30,
    letterStrokeColor: puzzlePageColors.puzzleLetterStrokeColor || '#000000',
    letterStrokeThicknessPx,
    solutionHighlightStrokeColor: showSolution
      ? answerPageColors.solutionHighlightStrokeColor || '#000000'
      : undefined,
    solutionHighlightStrokeThicknessPx: showSolution
      ? Math.max(0, answerPageColors.solutionHighlightStrokeThickness ?? 0)
      : 0,
    drawHighlights: showSolution,
    drawLetters: includeLetters,
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

  return {
    dataUrl: canvas.toDataURL('image/png'),
    inkPadPt,
  };
}
