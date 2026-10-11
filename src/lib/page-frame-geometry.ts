import { cssPxToPoints } from './puzzle-layout';
import type { PageFrameSettings } from './puzzles/types';

/** Clamp corner radius so it fits inside the rectangle (radius in same units as width/height). */
export function clampCornerRadius(
  cornerRadius: number,
  width: number,
  height: number
): number {
  if (!Number.isFinite(cornerRadius) || cornerRadius <= 0) return 0;
  return Math.max(0, Math.min(cornerRadius, width / 2, height / 2));
}

/** CSS px corner radius → points for PDF/layout math. */
export function pageFrameCornerRadiusPt(cornerRadiusCssPx: number): number {
  return cssPxToPoints(cornerRadiusCssPx);
}

/** Geometry for the centered page-frame stroke, matching CSS border-box sizing. */
export function getPageFrameStrokeGeometry(
  pageWidthPt: number,
  pageHeightPt: number,
  frame: PageFrameSettings
): { xPt: number; yPt: number; widthPt: number; heightPt: number; radiusPt: number; strokePt: number } {
  const marginPt = frame.marginSizeIn * 72;
  const strokePt = cssPxToPoints(frame.strokeThicknessPx);
  const halfStroke = strokePt / 2;
  const widthPt = pageWidthPt - marginPt * 2 - strokePt;
  const heightPt = pageHeightPt - marginPt * 2 - strokePt;
  return {
    xPt: marginPt + halfStroke,
    yPt: marginPt + halfStroke,
    widthPt,
    heightPt,
    radiusPt: Math.max(0, pageFrameCornerRadiusPt(frame.cornerRadiusPx) - halfStroke),
    strokePt,
  };
}

/** Build a rounded-rect path on a Canvas 2D context (top-left origin). */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = clampCornerRadius(radius, width, height);
  ctx.beginPath();
  if (r < 0.1) {
    ctx.rect(x, y, width, height);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

/** Fill a rounded rectangle using clip() so the fill cannot bleed past rounded corners. */
export function fillRoundedRectClipped(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  cornerRadius: number,
  fillStyle: string
): void {
  if (width <= 0 || height <= 0) return;
  ctx.save();
  roundedRectPath(ctx, x, y, width, height, cornerRadius);
  ctx.clip();
  ctx.fillStyle = fillStyle;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

/**
 * Rounded-rect SVG path for pdf-lib drawSvgPath (Y negated vs PDF page coords).
 * @param y PDF bottom-left Y (pdf-lib coordinate system, origin bottom-left)
 */
export function buildPageFrameRoundedRectSvgPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radiusPt: number
): string {
  const r = clampCornerRadius(radiusPt, width, height);
  if (r < 0.1) {
    const yt = -(y + height);
    return `M ${x},${yt} L ${x + width},${yt} L ${x + width},${-y} L ${x},${-y} Z`;
  }

  const k = 0.552284749831 * r;
  const yt = -(y + height);
  const yb = -y;

  return `M ${x + r},${yt} L ${x + width - r},${yt} C ${x + width - r + k},${yt} ${x + width},${yt + r - k} ${x + width},${yt + r} L ${x + width},${yb - r} C ${x + width},${yb - r + k} ${x + width - r + k},${yb} ${x + width - r},${yb} L ${x + r},${yb} C ${x + r - k},${yb} ${x},${yb - r + k} ${x},${yb - r} L ${x},${yt + r} C ${x},${yt + r - k} ${x + r - k},${yt} ${x + r},${yt} Z`;
}

/**
 * Shared page-container frame geometry (inches) for PowerPoint export.
 * Insets by half the stroke so the outer edge matches CSS `border-box` (canvas
 * PageFrameOverlay) — PowerPoint strokes are centered on the path.
 */
export function getPageContainerFrameGeom(
  pageWIn: number,
  pageHIn: number,
  frame: PageFrameSettings
): {
  x: number;
  y: number;
  w: number;
  h: number;
  shapeType: 'roundRect' | 'rect';
  roundProps: { rectRadius?: number };
  strokePt: number;
} {
  const geometry = getPageFrameStrokeGeometry(pageWIn * 72, pageHIn * 72, frame);
  const strokePt = geometry.strokePt;
  const x = geometry.xPt / 72;
  const y = geometry.yPt / 72;
  const w = Math.max(0.01, geometry.widthPt / 72);
  const h = Math.max(0.01, geometry.heightPt / 72);
  const rectRadiusIn = Math.max(
    0,
    Math.min(geometry.radiusPt / 72, Math.min(w, h) / 2)
  );
  const shapeType = rectRadiusIn > 0 ? 'roundRect' : 'rect';
  const roundProps = rectRadiusIn > 0 ? { rectRadius: rectRadiusIn } : {};
  return { x, y, w, h, shapeType, roundProps, strokePt };
}
