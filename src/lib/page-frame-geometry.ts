import { cssPxToPoints } from './puzzle-layout';

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

/**
 * Fill a rounded rectangle using clip() so the fill cannot bleed past rounded corners.
 */
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
