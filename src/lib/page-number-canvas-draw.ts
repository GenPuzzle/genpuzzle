/**
 * Canvas renderer for page numbers — matches ShapeContainer / PPT valign:middle exactly.
 */

import { drawShapeBox, drawCenteredCanvasText } from './header-assembly-canvas-draw';
import { ptToCssPx } from './header-assembly/compute-row';
import type { PageNumberLayout } from './page-number/layout';

export interface PageNumberCanvasSnapshot {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

export async function renderPageNumberToDataUrl(
  layout: PageNumberLayout,
  scale = 3
): Promise<PageNumberCanvasSnapshot | null> {
  if (typeof document === 'undefined') return null;

  const widthPx = Math.ceil(ptToCssPx(layout.widthPt));
  const heightPx = Math.ceil(ptToCssPx(layout.heightPt));
  if (widthPx <= 0 || heightPx <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = widthPx * scale;
  canvas.height = heightPx * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);

  const shape = layout.shape;
  drawShapeBox(ctx, 0, 0, widthPx, heightPx, {
    shapeId: shape.shapeId,
    fillColor: shape.fillColor,
    borderColor: shape.borderColor,
    borderThicknessPx: shape.borderThicknessPx,
    polygonSides: shape.polygonSides,
  });

  try {
    await document.fonts.ready;
  } catch {
    // non-fatal
  }

  drawCenteredCanvasText(
    ctx,
    layout.text,
    0,
    0,
    widthPx,
    heightPx,
    ptToCssPx(layout.fontSizePt),
    layout.textColor,
    layout.fontFamily,
    true
  );

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthPt: layout.widthPt,
    heightPt: layout.heightPt,
  };
}
