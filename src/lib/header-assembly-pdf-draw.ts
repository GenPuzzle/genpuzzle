/**
 * Native pdf-lib vector renderer for header assembly (fill + stroke on one path).
 */

import type { PDFPage, PDFFont, RGB } from 'pdf-lib';
import type { UnifiedHeaderAssemblyBlock } from './word-search-page-layout';
import type { HeaderShapeId } from './header-assembly/types';
import { computeHeaderAssemblyRects } from './header-assembly/layout-rects';
import { resolveHeaderNumberTextStyle } from './header-assembly/resolve-number-text';
import { shapePdfSvgPath } from './header-assembly/shape-path';
import { buildPageFrameRoundedRectSvgPath } from './page-frame-geometry';
import { cssPxToPoints } from './puzzle-layout';
import { PDF_CAP_HEIGHT_RATIO } from './grid-letter-centering';

/** Horizontal text inset inside shape containers (matches ShapeContainer). */
const SHAPE_TEXT_PAD_CSS_PX = 10;
/** Line height multiplier for subtitle lines (matches HeaderAssemblyBar). */
const SUBTITLE_LINE_HEIGHT = 1.3;

function capHeightAtSize(font: PDFFont, fontSizePt: number): number {
  try {
    return font.heightAtSize(fontSizePt, { descender: false });
  } catch {
    return fontSizePt * PDF_CAP_HEIGHT_RATIO;
  }
}

/** pdf-lib baseline Y so cap-height text is vertically centred in a slot (PDF bottom-left coords). */
function baselineYForSlotCenter(
  slotCenterPdfY: number,
  font: PDFFont,
  fontSizePt: number
): number {
  return slotCenterPdfY - capHeightAtSize(font, fontSizePt) / 2;
}

function shapeTextBounds(
  absLeftPt: number,
  absTopPt: number,
  wPt: number,
  hPt: number,
  borderThicknessPx = 0,
  extraVerticalPadCssPx = 0
) {
  const borderPt = cssPxToPoints(borderThicknessPx);
  const padXPt = cssPxToPoints(SHAPE_TEXT_PAD_CSS_PX);
  const padYPt = cssPxToPoints(extraVerticalPadCssPx);
  const innerLeft = absLeftPt + borderPt / 2 + padXPt;
  const innerW = Math.max(0, wPt - borderPt - padXPt * 2);
  const innerTopPt = absTopPt + borderPt / 2 + padYPt;
  const innerH = Math.max(0, hPt - borderPt - padYPt * 2);
  return {
    innerLeft,
    innerW,
    innerTopPt,
    innerH,
  };
}

interface ShapePaintOptions {
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  borderRadiusPx?: number;
  polygonSides?: number;
  borderOpacity?: number;
}

export function drawShapeOnPdfPage(
  page: PDFPage,
  pageHeight: number,
  absLeftPt: number,
  absTopPt: number,
  wPt: number,
  hPt: number,
  opts: ShapePaintOptions,
  getColor: (hex?: string) => RGB
): void {
  if (wPt <= 0 || hPt <= 0) return;

  const borderPt = cssPxToPoints(opts.borderThicknessPx);
  const half = borderPt / 2;
  const iw = Math.max(0, wPt - borderPt);
  const ih = Math.max(0, hPt - borderPt);
  if (iw <= 0 || ih <= 0) return;

  const pdfY = pageHeight - absTopPt - hPt;
  const x = absLeftPt + half;
  const y = pdfY + half;
  const fill = getColor(opts.fillColor);
  const stroke = getColor(opts.borderColor);
  const borderOpacity = (opts.borderOpacity ?? 100) / 100;

  const pathOpts = {
    color: fill,
    borderColor: stroke,
    borderWidth: borderPt,
    borderOpacity,
  };

  switch (opts.shapeId) {
    case 'rectangle': {
      const radiusPx = opts.borderRadiusPx ?? 0;
      if (radiusPx > 0) {
        const r = Math.min(
          Math.max(0, cssPxToPoints(radiusPx) - half),
          iw / 2,
          ih / 2
        );
        page.drawSvgPath(buildPageFrameRoundedRectSvgPath(x, y, iw, ih, r), pathOpts);
      } else {
        page.drawRectangle({ x, y, width: iw, height: ih, ...pathOpts });
      }
      break;
    }
    case 'rounded-rect': {
      const r = Math.min(
        Math.max(0, cssPxToPoints(opts.borderRadiusPx ?? 0) - half),
        iw / 2,
        ih / 2
      );
      page.drawSvgPath(buildPageFrameRoundedRectSvgPath(x, y, iw, ih, r), pathOpts);
      break;
    }
    case 'pill': {
      const r = ih / 2;
      page.drawSvgPath(buildPageFrameRoundedRectSvgPath(x, y, iw, ih, r), pathOpts);
      break;
    }
    case 'circle':
      page.drawEllipse({
        x: absLeftPt + wPt / 2,
        y: pdfY + hPt / 2,
        xScale: Math.max(0, wPt / 2 - half),
        yScale: Math.max(0, hPt / 2 - half),
        ...pathOpts,
      });
      break;
    default:
      page.drawSvgPath(
        shapePdfSvgPath(x, y, iw, ih, {
          shapeId: opts.shapeId,
          width: iw,
          height: ih,
          borderRadiusPx: opts.borderRadiusPx,
          polygonSides: opts.polygonSides,
        }),
        pathOpts
      );
      break;
  }
}

export function drawCenteredPdfText(
  page: PDFPage,
  pageHeight: number,
  text: string,
  absLeftPt: number,
  absTopPt: number,
  wPt: number,
  hPt: number,
  fontSizePt: number,
  color: RGB,
  font: PDFFont,
  multiline = false,
  borderThicknessPx = 0
): void {
  if (!text) return;

  const { innerLeft, innerW, innerTopPt, innerH } = shapeTextBounds(
    absLeftPt,
    absTopPt,
    wPt,
    hPt,
    borderThicknessPx,
    0
  );
  const boundsBottomPdfY = pageHeight - innerTopPt - innerH;

  if (multiline) {
    const lines = text.split('\n').filter((line) => line.length > 0);
    if (lines.length === 0) return;

    const fontLineHeight = font.heightAtSize(fontSizePt);
    let lineHeight = Math.max(fontSizePt * SUBTITLE_LINE_HEIGHT, fontLineHeight * 1.02);
    let blockH = lines.length * lineHeight;
    if (blockH > innerH) {
      lineHeight = innerH / lines.length;
      blockH = innerH;
    }

    // Centre the line block vertically, then centre each line in its slot (matches PPT valign:middle).
    const blockTopPdfY = boundsBottomPdfY + innerH - (innerH - blockH) / 2;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const slotCenterPdfY = blockTopPdfY - (i + 0.5) * lineHeight;
      const y = baselineYForSlotCenter(slotCenterPdfY, font, fontSizePt);
      const lineW = font.widthOfTextAtSize(line, fontSizePt);
      const x = innerLeft + Math.max(0, (innerW - lineW) / 2);

      page.drawText(line, {
        x,
        y,
        size: fontSizePt,
        font,
        color,
      });
    }
    return;
  }

  const textW = font.widthOfTextAtSize(text, fontSizePt);
  const x = innerLeft + Math.max(0, (innerW - textW) / 2);
  const y = baselineYForSlotCenter(boundsBottomPdfY + innerH / 2, font, fontSizePt);

  page.drawText(text, {
    x,
    y,
    size: fontSizePt,
    font,
    color,
  });
}

export function drawHeaderAssemblyOnPdfPageNative(
  page: PDFPage,
  pageHeight: number,
  block: UnifiedHeaderAssemblyBlock,
  titleFont: PDFFont,
  getColor: (hex?: string) => RGB,
  subtitleFont?: PDFFont
): void {
  const { parts, settings } = block;
  const rects = computeHeaderAssemblyRects(block);
  const baseLeft = block.leftPt;
  const baseTop = block.topPt;
  const bodyFont = subtitleFont ?? titleFont;
  const numberTextStyle = resolveHeaderNumberTextStyle(
    settings.number,
    block.titleFontSizePt,
    block.fontFamily
  );

  if (rects.number && parts.showNumber) {
    const r = rects.number;
    drawShapeOnPdfPage(
      page,
      pageHeight,
      baseLeft + r.xPt,
      baseTop + r.yPt,
      r.wPt,
      r.hPt,
      {
        shapeId: settings.number.shapeId,
        fillColor: settings.number.fillColor,
        borderColor: settings.number.borderColor,
        borderThicknessPx: settings.number.borderThicknessPx,
        polygonSides: settings.number.polygonSides,
      },
      getColor
    );
    drawCenteredPdfText(
      page,
      pageHeight,
      parts.numberText,
      baseLeft + r.xPt,
      baseTop + r.yPt,
      r.wPt,
      r.hPt,
      numberTextStyle.fontSizePt,
      getColor(numberTextStyle.textColor),
      titleFont,
      false,
      settings.number.borderThicknessPx
    );
  }

  if (rects.title && parts.titleText) {
    const r = rects.title;
    drawShapeOnPdfPage(
      page,
      pageHeight,
      baseLeft + r.xPt,
      baseTop + r.yPt,
      r.wPt,
      r.hPt,
      {
        shapeId: settings.title.shapeId,
        fillColor: settings.title.fillColor,
        borderColor: settings.title.borderColor,
        borderThicknessPx: settings.title.borderThicknessPx,
        borderRadiusPx: settings.title.borderRadiusPx,
      },
      getColor
    );
    drawCenteredPdfText(
      page,
      pageHeight,
      parts.titleText,
      baseLeft + r.xPt,
      baseTop + r.yPt,
      r.wPt,
      r.hPt,
      block.titleFontSizePt,
      getColor(block.titleColor),
      titleFont,
      false,
      settings.title.borderThicknessPx
    );
  }

  if (rects.subtitle) {
    const subtitleLines =
      block.subtitleLines.length > 0
        ? block.subtitleLines
        : parts.subtitleText
          ? [parts.subtitleText]
          : [];
    if (subtitleLines.length > 0) {
      const r = rects.subtitle;
      drawShapeOnPdfPage(
        page,
        pageHeight,
        baseLeft + r.xPt,
        baseTop + r.yPt,
        r.wPt,
        r.hPt,
        {
          shapeId: settings.subtitle.shapeId,
          fillColor: settings.subtitle.fillColor,
          borderColor: settings.subtitle.borderColor,
          borderThicknessPx: settings.subtitle.borderThicknessPx,
          borderRadiusPx: settings.subtitle.borderRadiusPx,
          borderOpacity: settings.subtitle.borderOpacity,
        },
        getColor
      );
      drawCenteredPdfText(
        page,
        pageHeight,
        subtitleLines.join('\n'),
        baseLeft + r.xPt,
        baseTop + r.yPt,
        r.wPt,
        r.hPt,
        block.subtitleFontSizePt,
        getColor(block.subtitleColor),
        bodyFont,
        true,
        settings.subtitle.borderThicknessPx
      );
    }
  }
}
