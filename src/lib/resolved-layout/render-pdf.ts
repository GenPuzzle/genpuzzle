import {
  LineCapStyle,
  PDFPage,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFImage,
  type RGB,
} from 'pdf-lib';
import { canvasShapePoints } from '../canvas-shapes';
import { PDF_CAP_HEIGHT_RATIO } from '../grid-letter-centering';
import { textEffectLayers } from '../text-effects';
import { resolveUnicodeFontFamily, segmentGraphemes, transliterateToAscii } from '../unicode-text';
import { hasBoxTransform } from './box-transform';
import { dispatchResolved } from './dispatch';
import type { ResolvedElement, ResolvedText } from './types';

function pdfY(pageHeightPt: number, topPt: number, heightPt = 0): number {
  return pageHeightPt - topPt - heightPt;
}

function canEncode(font: PDFFont, text: string): boolean {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

const reportedMissingGlyphs = new Set<string>();

/**
 * Last-resort glyph fallback. The layout already picks a family that covers the text
 * (`resolveUnicodeFontFamily`), so this only fires when the machine's font file is
 * missing a glyph. Dropping the whole export would be worse than an ASCII stand-in,
 * but the accent loss is real, so it is logged rather than hidden.
 */
function encodableLine(font: PDFFont, line: string): string {
  if (canEncode(font, line)) return line;
  return segmentGraphemes(line)
    .map((grapheme) => {
      if (canEncode(font, grapheme)) return grapheme;
      if (!reportedMissingGlyphs.has(grapheme)) {
        reportedMissingGlyphs.add(grapheme);
        console.warn(`PDF font cannot draw "${grapheme}"; falling back for this character.`);
      }
      const folded = transliterateToAscii(grapheme);
      if (folded && canEncode(font, folded)) return folded;
      return canEncode(font, '?') ? '?' : '';
    })
    .join('');
}

function parseColor(hex: string | undefined, fallback = '#000000'): RGB {
  const raw = (hex || fallback).replace('#', '');
  const h = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function textOrigin(el: ResolvedText, lineIndex: number, textWidth: number): { x: number; yTop: number } {
  const blockH = el.lines.length * el.lineHeight;
  let yTop = el.y;
  if (el.valign === 'middle') yTop = el.y + Math.max(0, (el.h - blockH) / 2);
  if (el.valign === 'bottom') yTop = el.y + Math.max(0, el.h - blockH);
  let x = el.x;
  if (el.align === 'center') x = el.x + Math.max(0, (el.w - textWidth) / 2);
  if (el.align === 'right') x = el.x + Math.max(0, el.w - textWidth);
  return { x, yTop: yTop + lineIndex * el.lineHeight };
}

function withBoxTransform(
  page: PDFPage,
  pageHeightPt: number,
  el: { x: number; y: number; w: number; h: number; rotationDeg?: number; flipH?: boolean; flipV?: boolean },
  draw: () => void
): void {
  if (!hasBoxTransform(el)) {
    draw();
    return;
  }
  const cx = el.x + el.w / 2;
  const cy = pageHeightPt - (el.y + el.h / 2);
  const rad = (-(el.rotationDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const sx = el.flipH ? -1 : 1;
  const sy = el.flipV ? -1 : 1;
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(1, 0, 0, 1, cx, cy),
    concatTransformationMatrix(cos, sin, -sin, cos, 0, 0),
    concatTransformationMatrix(sx, 0, 0, sy, 0, 0),
    concatTransformationMatrix(1, 0, 0, 1, -cx, -cy)
  );
  draw();
  page.pushOperators(popGraphicsState());
}

/** Draw resolved primitives. Font size is never auto-fit. */
export function renderResolvedPdf(
  page: PDFPage,
  pageHeightPt: number,
  elements: ResolvedElement[],
  fontFor: (family: string, bold: boolean) => PDFFont,
  embedImage?: (href: string) => PDFImage
): void {
  for (const el of elements) {
    dispatchResolved('PDF', el, {
      rect: (el) => {
        page.drawRectangle({
          x: el.x,
          y: pdfY(pageHeightPt, el.y, el.h),
          width: Math.max(0.1, el.w),
          height: Math.max(0.1, el.h),
          color: el.fill ? parseColor(el.fill) : undefined,
          borderColor: el.stroke ? parseColor(el.stroke) : undefined,
          borderWidth: el.strokeWidth ?? 0,
          opacity: el.opacity ?? 1,
        });
      },
      ellipse: (el) => {
        page.drawEllipse({
          x: el.cx,
          y: pdfY(pageHeightPt, el.cy),
          xScale: el.rx,
          yScale: el.ry,
          color: el.fill ? parseColor(el.fill) : undefined,
          borderColor: el.stroke ? parseColor(el.stroke) : undefined,
          borderWidth: el.strokeWidth ?? 0,
        });
      },
      line: (el) => {
        page.drawLine({
          start: { x: el.x1, y: pdfY(pageHeightPt, el.y1) },
          end: { x: el.x2, y: pdfY(pageHeightPt, el.y2) },
          thickness: el.width,
          color: parseColor(el.color),
          lineCap: LineCapStyle.Round,
          opacity: el.opacity ?? 1,
          ...(el.dash ? { dashArray: el.dash } : {}),
        });
      },
      stadium: (el) => {
        const y1 = pdfY(pageHeightPt, el.y1);
        const y2 = pdfY(pageHeightPt, el.y2);
        const half = Math.max(0.35, el.thickness / 2);
        const dx = el.x2 - el.x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const color = parseColor(el.color);
        const opacity = el.opacity ?? 1;
        page.drawCircle({ x: el.x1, y: y1, size: half, color, opacity });
        page.drawCircle({ x: el.x2, y: y2, size: half, color, opacity });
        if (len < 0.05) return;
        if (Math.abs(dy) <= Math.abs(dx) * 0.02) {
          page.drawRectangle({
            x: Math.min(el.x1, el.x2),
            y: (y1 + y2) / 2 - half,
            width: len,
            height: el.thickness,
            color,
            opacity,
          });
        } else if (Math.abs(dx) <= Math.abs(dy) * 0.02) {
          page.drawRectangle({
            x: (el.x1 + el.x2) / 2 - half,
            y: Math.min(y1, y2),
            width: el.thickness,
            height: len,
            color,
            opacity,
          });
        } else {
          page.drawLine({
            start: { x: el.x1, y: y1 },
            end: { x: el.x2, y: y2 },
            thickness: el.thickness,
            color,
            opacity,
            lineCap: LineCapStyle.Round,
          });
        }
      },
      polygon: (el) => {
        if (el.points.length < 3) return;
        const path =
          el.points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${-pdfY(pageHeightPt, p.y)}`)
            .join(' ') + ' Z';
        page.drawSvgPath(path, {
          color: parseColor(el.fill),
          borderColor: el.stroke ? parseColor(el.stroke) : undefined,
          borderWidth: el.strokeWidth,
        });
      },
      shape: (el) => {
        if (el.shape === 'roundRect' || el.shape === 'rect') {
          const radius =
            el.shape === 'roundRect'
              ? Math.min(el.cornerRadius ?? Math.min(el.w, el.h) * 0.12, el.w / 2, el.h / 2)
              : 0;
          withBoxTransform(page, pageHeightPt, el, () => {
            page.drawRectangle({
              x: el.x,
              y: pdfY(pageHeightPt, el.y, el.h),
              width: el.w,
              height: el.h,
              color: el.fill ? parseColor(el.fill) : undefined,
              borderColor: el.stroke ? parseColor(el.stroke) : undefined,
              borderWidth: el.strokeWidth,
              borderRadius: radius > 0 ? radius : undefined,
            });
          });
          return;
        }
        const points = canvasShapePoints(el.shape, el.x, el.y, el.w, el.h);
        if (points.length < 3) return;
        const path =
          points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${-pdfY(pageHeightPt, p.y)}`)
            .join(' ') + ' Z';
        withBoxTransform(page, pageHeightPt, el, () => {
          page.drawSvgPath(path, {
            color: el.fill ? parseColor(el.fill) : undefined,
            borderColor: el.stroke ? parseColor(el.stroke) : undefined,
            borderWidth: el.strokeWidth,
          });
        });
      },
      text: (el) => {
        const fontFamily = resolveUnicodeFontFamily(el.fontFamily, el.text || el.lines.join(''));
        const font = fontFor(fontFamily, !!el.bold);
        const color = parseColor(el.color);
        const layers = textEffectLayers(el.effect);
        const letterSpacingPt =
          el.letterSpacingEm != null && el.letterSpacingEm > 0
            ? el.letterSpacingEm * el.fontSize
            : 0;
        withBoxTransform(page, pageHeightPt, el, () => {
          el.lines.forEach((rawLine, i) => {
            const line = encodableLine(font, rawLine);
            const glyphCount = letterSpacingPt > 0 ? segmentGraphemes(line).length : 0;
            const width =
              font.widthOfTextAtSize(line, el.fontSize) + letterSpacingPt * Math.max(0, glyphCount);
            const origin = textOrigin(el, i, width);
            const halfLeading = Math.max(0, el.lineHeight - el.fontSize) / 2;
            const baseline = pdfY(pageHeightPt, origin.yTop + halfLeading + el.fontSize * PDF_CAP_HEIGHT_RATIO);
            const drawLine = (x: number, y: number, drawColor: RGB, opacity?: number) => {
              if (letterSpacingPt > 0) {
                page.pushOperators(setCharacterSpacing(letterSpacingPt));
              }
              page.drawText(line, {
                x,
                y,
                size: el.fontSize,
                font,
                color: drawColor,
                opacity,
              });
              if (letterSpacingPt > 0) {
                page.pushOperators(setCharacterSpacing(0));
              }
            };
            for (const layer of layers) {
              drawLine(
                origin.x + layer.dx,
                baseline - layer.dy,
                parseColor(layer.color),
                layer.opacity
              );
            }
            if (el.effect === 'outline') {
              drawLine(origin.x + 0.6, baseline, parseColor('#0f172a'));
            }
            drawLine(origin.x, baseline, color);
          });
        });
      },
      image: (el) => {
        if (!embedImage) {
          throw new Error(
            'PDF renderer received an image primitive. Pass an embedder before drawing illustrations; do not drop the image.'
          );
        }
        const image = embedImage(el.href);
        withBoxTransform(page, pageHeightPt, el, () => {
          page.drawImage(image, { x: el.x, y: pdfY(pageHeightPt, el.y, el.h), width: el.w, height: el.h });
        });
      },
    });
  }
}
