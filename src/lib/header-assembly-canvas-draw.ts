/**
 * Native Canvas2D renderer for modular header assembly (vector paths).
 */

import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import { shapeCanvasPath, hexToRgba } from './header-assembly/shape-path';
import { computeHeaderRowMetrics, ptToCssPx } from './header-assembly/compute-row';
import { resolveHeaderNumberTextStyle } from './header-assembly/resolve-number-text';

export interface HeaderAssemblySnapshot {
  dataUrl: string;
  widthPt: number;
  heightPt: number;
}

export function drawShapeBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  params: {
    shapeId: UnifiedHeaderAssemblyBlock['settings']['number']['shapeId'];
    fillColor: string;
    borderColor: string;
    borderThicknessPx: number;
    borderRadiusPx?: number;
    polygonSides?: number;
    borderOpacity?: number;
  }
): void {
  const t = Math.max(0, params.borderThicknessPx);
  const half = t / 2;
  const iw = Math.max(0, w - t);
  const ih = Math.max(0, h - t);
  if (iw <= 0 || ih <= 0) return;

  const radiusPx = params.borderRadiusPx ?? 0;
  const innerRadius =
    params.shapeId === 'pill'
      ? Math.max(radiusPx, ih / 2) - half
      : Math.max(0, radiusPx - half);

  ctx.save();
  ctx.translate(x + half, y + half);
  shapeCanvasPath(ctx, 0, 0, iw, ih, {
    shapeId: params.shapeId,
    width: iw,
    height: ih,
    borderRadiusPx: innerRadius,
    polygonSides: params.polygonSides,
  });
  ctx.fillStyle = params.fillColor;
  ctx.fill();
  if (t > 0) {
    ctx.strokeStyle = hexToRgba(params.borderColor, (params.borderOpacity ?? 100) / 100);
    ctx.lineWidth = t;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCenteredCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontPx: number,
  color: string,
  fontFamily: string,
  bold = false,
  multiline = false
): void {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${fontPx}px ${fontFamily}, Arial, sans-serif`;
  ctx.textAlign = 'center';
  if (multiline) {
    ctx.textBaseline = 'top';
    const lines = text.split('\n');
    const lh = fontPx * 1.3;
    let cy = y + (h - lines.length * lh) / 2;
    for (const line of lines) {
      ctx.fillText(line, x + w / 2, cy, w - 8);
      cy += lh;
    }
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2, w - 8);
  }
}

export function drawHeaderAssemblyToCanvas(
  ctx: CanvasRenderingContext2D,
  block: UnifiedHeaderAssemblyBlock
): number {
  const widthPx = ptToCssPx(block.widthPt);
  const titleFontPx = ptToCssPx(block.titleFontSizePt);
  const subtitleFontPx = ptToCssPx(block.subtitleFontSizePt);
  const rowMetrics = computeHeaderRowMetrics(block.widthPt, block.titleFontSizePt, block.parts);
  const rowH = ptToCssPx(rowMetrics.rowHPt);
  const gap = ptToCssPx(rowMetrics.gapPt);
  const numberW = ptToCssPx(rowMetrics.numberWPt);
  const { parts, settings } = block;
  const numberTextStyle = resolveHeaderNumberTextStyle(
    settings.number,
    block.titleFontSizePt,
    block.fontFamily
  );
  const numberFontPx = ptToCssPx(numberTextStyle.fontSizePt);
  let y = 0;
  let x = 0;
  if (parts.showNumber) {
    drawShapeBox(ctx, x, y, numberW, rowH, {
      shapeId: settings.number.shapeId,
      fillColor: settings.number.fillColor,
      borderColor: settings.number.borderColor,
      borderThicknessPx: settings.number.borderThicknessPx,
      polygonSides: settings.number.polygonSides,
    });
    drawCenteredCanvasText(
      ctx,
      parts.numberText,
      x,
      y,
      numberW,
      rowH,
      numberFontPx,
      numberTextStyle.textColor,
      numberTextStyle.fontFamily,
      true
    );
    x += numberW + gap;
  }

  const titleW = widthPx - x;
  if (parts.titleText && titleW > 0) {
    drawShapeBox(ctx, x, y, titleW, rowH, {
      shapeId: settings.title.shapeId,
      fillColor: settings.title.fillColor,
      borderColor: settings.title.borderColor,
      borderThicknessPx: settings.title.borderThicknessPx,
      borderRadiusPx: settings.title.borderRadiusPx,
    });
    drawCenteredCanvasText(
      ctx,
      parts.titleText,
      x,
      y,
      titleW,
      rowH,
      titleFontPx,
      block.titleColor,
      block.fontFamily,
      true
    );
  }
  y += rowH;

  const subtitleLines =
    block.subtitleLines.length > 0
      ? block.subtitleLines
      : parts.subtitleText
        ? [parts.subtitleText]
        : [];

  if (subtitleLines.length > 0) {
    y += gap;
    const bandW = ptToCssPx(block.subtitleTextWidthPt);
    const bandX = (widthPx - bandW) / 2;
    const bandH = Math.max(rowH * 0.85, subtitleLines.length * subtitleFontPx * 1.3 + ptToCssPx(10) + 12);
    drawShapeBox(ctx, bandX, y, bandW, bandH, {
      shapeId: settings.subtitle.shapeId,
      fillColor: settings.subtitle.fillColor,
      borderColor: settings.subtitle.borderColor,
      borderThicknessPx: settings.subtitle.borderThicknessPx,
      borderRadiusPx: settings.subtitle.borderRadiusPx,
      borderOpacity: settings.subtitle.borderOpacity,
    });
    drawCenteredCanvasText(
      ctx,
      subtitleLines.join('\n'),
      bandX,
      y,
      bandW,
      bandH,
      subtitleFontPx,
      block.subtitleColor,
      block.subtitleFontFamily ?? block.fontFamily,
      false,
      true
    );
    y += bandH;
  }

  return y;
}

export async function renderHeaderAssemblyToDataUrl(
  block: UnifiedHeaderAssemblyBlock,
  scale = 3
): Promise<HeaderAssemblySnapshot | null> {
  if (typeof document === 'undefined') return null;

  const widthPx = Math.ceil(ptToCssPx(block.widthPt));
  const heightPx = Math.ceil(ptToCssPx(block.heightPt));

  const canvas = document.createElement('canvas');
  canvas.width = widthPx * scale;
  canvas.height = heightPx * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  try {
    await document.fonts.ready;
  } catch {
    // non-fatal
  }

  drawHeaderAssemblyToCanvas(ctx, block);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthPt: block.widthPt,
    heightPt: block.heightPt,
  };
}
