/**
 * Native pptxgenjs shapes + editable text for modular header assembly.
 */

import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import type { HeaderShapeId } from './header-assembly/types';
import { shapeVerticesNormalized } from './header-assembly/shape-path';
import { cssPxToPt } from './header-assembly/compute-row';
import { computeHeaderAssemblyRects } from './header-assembly/layout-rects';
import { resolveHeaderNumberTextStyle } from './header-assembly/resolve-number-text';

function pt2in(pt: number): number {
  const v = pt / 72;
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function cssPxToIn(px: number): number {
  return px / 96;
}

function hex6(hex: string | undefined, fallback = '000000'): string {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, '');
  return clean.length === 6 ? clean.toUpperCase() : fallback;
}

function safeIn(v: number, fallback = 0.01): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const POLYGON_PRESET: Record<number, string> = {
  3: 'triangle',
  5: 'pentagon',
  6: 'hexagon',
  7: 'heptagon',
  8: 'octagon',
  10: 'decagon',
  12: 'dodecagon',
};

type CustGeomPoint =
  | { x: number; y: number; moveTo?: boolean }
  | { close: true };

function toCustGeomPoints(
  vertices: Array<{ x: number; y: number }>,
  wIn: number,
  hIn: number
): CustGeomPoint[] {
  const points: CustGeomPoint[] = vertices.map((v, i) => ({
    x: v.x * wIn,
    y: v.y * hIn,
    ...(i === 0 ? { moveTo: true } : {}),
  }));
  points.push({ close: true });
  return points;
}

function resolvePptShape(
  shapeId: HeaderShapeId,
  wIn: number,
  hIn: number,
  borderRadiusPx?: number,
  polygonSides?: number
): { shape: string; rectRadius?: number; points?: CustGeomPoint[] } {
  const rPx = borderRadiusPx ?? 0;
  const rectRadiusIn = Math.max(
    0,
    Math.min(cssPxToIn(rPx), wIn / 2, hIn / 2)
  );

  switch (shapeId) {
    case 'rectangle':
      // Match CSS: rectangle + border-radius still paints rounded corners.
      return rectRadiusIn > 0
        ? { shape: 'roundRect', rectRadius: rectRadiusIn }
        : { shape: 'rect' };
    case 'rounded-rect':
      return rectRadiusIn > 0
        ? { shape: 'roundRect', rectRadius: rectRadiusIn }
        : { shape: 'rect' };
    case 'pill':
      return { shape: 'roundRect', rectRadius: Math.min(wIn, hIn) / 2 };
    case 'circle':
      return { shape: 'ellipse' };
    case 'hexagon':
      return { shape: 'hexagon' };
    case 'polygon': {
      const sides = Math.max(3, Math.min(12, polygonSides ?? 6));
      const preset = POLYGON_PRESET[sides];
      if (preset) return { shape: preset };
      return {
        shape: 'custGeom',
        points: toCustGeomPoints(
          shapeVerticesNormalized({
            shapeId: 'polygon',
            width: wIn * 96,
            height: hIn * 96,
            polygonSides: sides,
          }),
          wIn,
          hIn
        ),
      };
    }
    case 'trapezoid':
    case 'parallelogram':
    case 'chevron':
    case 'ribbon-notch':
      return {
        shape: 'custGeom',
        points: toCustGeomPoints(
          shapeVerticesNormalized({
            shapeId,
            width: wIn * 96,
            height: hIn * 96,
            polygonSides,
          }),
          wIn,
          hIn
        ),
      };
    default:
      return { shape: 'rect' };
  }
}

export function addHeaderShapeToSlide(
  slide: { addShape: (shape: string, opts: Record<string, unknown>) => void },
  shapeId: HeaderShapeId,
  xIn: number,
  yIn: number,
  wIn: number,
  hIn: number,
  fillColor: string,
  borderColor: string,
  borderThicknessPx: number,
  opts?: { borderRadiusPx?: number; polygonSides?: number; borderOpacity?: number }
): void {
  const spec = resolvePptShape(
    shapeId,
    wIn,
    hIn,
    opts?.borderRadiusPx,
    opts?.polygonSides
  );

  const line =
    borderThicknessPx > 0
      ? {
          color: hex6(borderColor),
          width: Math.max(0.5, cssPxToPt(borderThicknessPx)),
          transparency: Math.max(0, 100 - (opts?.borderOpacity ?? 100)),
        }
      : { type: 'none' as const };

  slide.addShape(spec.shape, {
    x: xIn,
    y: yIn,
    w: safeIn(wIn),
    h: safeIn(hIn),
    fill: { color: hex6(fillColor, 'FFFFFF') },
    line,
    objectName: `Header ${shapeId}`,
    ...(spec.rectRadius != null ? { rectRadius: spec.rectRadius } : {}),
    ...(spec.points ? { points: spec.points } : {}),
  });
}

function addCenteredText(
  slide: { addText: (text: string, opts: Record<string, unknown>) => void },
  text: string,
  xIn: number,
  yIn: number,
  wIn: number,
  hIn: number,
  fontSizePt: number,
  color: string,
  fontFamily: string,
  bold: boolean
): void {
  slide.addText(text, {
    x: xIn,
    y: yIn,
    w: safeIn(wIn),
    h: safeIn(hIn),
    fontSize: Math.round(fontSizePt),
    fontFace: fontFamily || 'Arial',
    color: hex6(color),
    bold,
    align: 'center',
    valign: 'middle',
    margin: 0,
    wrap: text.includes('\n'),
    isTextBox: true,
  });
}

/**
 * Add editable native PPT shapes and text for header assembly (number, title, subtitle).
 */
export function addHeaderAssemblyToSlide(
  slide: { addShape: (shape: string, opts: Record<string, unknown>) => void; addText: (text: string, opts: Record<string, unknown>) => void },
  block: UnifiedHeaderAssemblyBlock
): void {
  const { parts, settings } = block;
  const rects = computeHeaderAssemblyRects(block);
  const baseXIn = pt2in(block.leftPt);
  const baseYIn = pt2in(block.topPt);

  const subtitleLines =
    block.subtitleLines.length > 0
      ? block.subtitleLines
      : parts.subtitleText
        ? [parts.subtitleText]
        : [];
  const numberTextStyle = resolveHeaderNumberTextStyle(
    settings.number,
    block.titleFontSizePt,
    block.fontFamily
  );

  if (rects.number && parts.showNumber) {
    const r = rects.number;
    const xIn = baseXIn + pt2in(r.xPt);
    const yIn = baseYIn + pt2in(r.yPt);
    const wIn = pt2in(r.wPt);
    const hIn = pt2in(r.hPt);
    const n = settings.number;

    addHeaderShapeToSlide(slide, n.shapeId, xIn, yIn, wIn, hIn, n.fillColor, n.borderColor, n.borderThicknessPx, {
      polygonSides: n.polygonSides,
    });
    addCenteredText(
      slide,
      parts.numberText,
      xIn,
      yIn,
      wIn,
      hIn,
      numberTextStyle.fontSizePt,
      numberTextStyle.textColor,
      numberTextStyle.fontFamily,
      true
    );
  }

  if (rects.title && parts.titleText) {
    const r = rects.title;
    const xIn = baseXIn + pt2in(r.xPt);
    const yIn = baseYIn + pt2in(r.yPt);
    const wIn = pt2in(r.wPt);
    const hIn = pt2in(r.hPt);
    const t = settings.title;

    addHeaderShapeToSlide(slide, t.shapeId, xIn, yIn, wIn, hIn, t.fillColor, t.borderColor, t.borderThicknessPx, {
      borderRadiusPx: t.borderRadiusPx,
    });
    addCenteredText(
      slide,
      parts.titleText,
      xIn,
      yIn,
      wIn,
      hIn,
      block.titleFontSizePt,
      block.titleColor,
      block.fontFamily,
      true
    );
  }

  if (rects.subtitle && subtitleLines.length > 0) {
    const r = rects.subtitle;
    const xIn = baseXIn + pt2in(r.xPt);
    const yIn = baseYIn + pt2in(r.yPt);
    const wIn = pt2in(r.wPt);
    const hIn = pt2in(r.hPt);
    const s = settings.subtitle;

    addHeaderShapeToSlide(
      slide,
      s.shapeId,
      xIn,
      yIn,
      wIn,
      hIn,
      s.fillColor,
      s.borderColor,
      s.borderThicknessPx,
      {
        borderRadiusPx: s.borderRadiusPx,
        borderOpacity: s.borderOpacity,
      }
    );
    addCenteredText(
      slide,
      subtitleLines.join('\n'),
      xIn,
      yIn,
      wIn,
      hIn,
      block.subtitleFontSizePt,
      block.subtitleColor,
      block.subtitleFontFamily ?? block.fontFamily,
      false
    );
  }
}
