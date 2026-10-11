import { CANVAS_SHAPE_PPT_NAME } from '../canvas-shapes';
import { textEffectLayers } from '../text-effects';
import { resolveUnicodeFontFamily } from '../unicode-text';
import { dispatchResolved } from './dispatch';
import type { ResolvedElement } from './types';

type Slide = {
  addShape: (shape: string, opts: Record<string, unknown>) => void;
  addText: (text: string, opts: Record<string, unknown>) => void;
  addImage?: (opts: Record<string, unknown>) => void;
};

function pt2in(pt: number): number {
  return pt / 72;
}

function hex6(hex: string | undefined): string {
  const raw = (hex || '#000000').replace('#', '');
  return (raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw).slice(0, 6).toUpperCase();
}

function addStadium(slide: Slide, el: Extract<ResolvedElement, { kind: 'stadium' }>): void {
  const t = Math.max(pt2in(el.thickness), 0.012);
  const x1 = pt2in(el.x1);
  const y1 = pt2in(el.y1);
  const x2 = pt2in(el.x2);
  const y2 = pt2in(el.y2);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const color = hex6(el.color);
  const transparency = Math.round((1 - (el.opacity ?? 1)) * 100);
  const fill = { color, transparency };
  const noLine = { type: 'none' as const };
  if (len < 0.0005) {
    slide.addShape('ellipse', {
      x: x1 - t / 2,
      y: y1 - t / 2,
      w: t,
      h: t,
      fill,
      line: noLine,
    });
    return;
  }
  // Axis-aligned capsules (same as canvas roundRect highlights).
  if (Math.abs(dy) <= Math.abs(dx) * 0.02) {
    slide.addShape('roundRect', {
      x: Math.min(x1, x2) - t / 2,
      y: (y1 + y2) / 2 - t / 2,
      w: len + t,
      h: t,
      rectRadius: t / 2,
      fill,
      line: noLine,
    });
    return;
  }
  if (Math.abs(dx) <= Math.abs(dy) * 0.02) {
    slide.addShape('roundRect', {
      x: (x1 + x2) / 2 - t / 2,
      y: Math.min(y1, y2) - t / 2,
      w: t,
      h: len + t,
      rectRadius: t / 2,
      fill,
      line: noLine,
    });
    return;
  }
  // Diagonal: rotated capsule. Do NOT use an unflipped line bbox — that draws the
  // wrong diagonal (missing flipH/flipV) and mismatches the canvas preview.
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const w = len + t;
  slide.addShape('roundRect', {
    x: cx - w / 2,
    y: cy - t / 2,
    w,
    h: t,
    rectRadius: t / 2,
    rotate: angleDeg,
    fill,
    line: noLine,
  });
}

/** Editable PPTX primitives. Text boxes use the shared font size with autofit off. */
export function renderResolvedPpt(slide: Slide, elements: ResolvedElement[]): void {
  for (const el of elements) {
    dispatchResolved('PPTX', el, {
      rect: (el) => {
        const fillTransparency = Math.round((1 - (el.opacity ?? 1)) * 100);
        slide.addShape(el.radius && el.radius > 0 ? 'roundRect' : 'rect', {
          x: pt2in(el.x),
          y: pt2in(el.y),
          w: Math.max(pt2in(el.w), 0.01),
          h: Math.max(pt2in(el.h), 0.01),
          fill: el.fill
            ? { color: hex6(el.fill), transparency: fillTransparency }
            : { type: 'none' },
          line: el.stroke
            ? { color: hex6(el.stroke), width: el.strokeWidth ?? 0.75 }
            : { type: 'none' },
          ...(el.radius ? { rectRadius: pt2in(el.radius) } : {}),
        });
      },
      ellipse: (el) => {
        slide.addShape('ellipse', {
          x: pt2in(el.cx - el.rx),
          y: pt2in(el.cy - el.ry),
          w: pt2in(el.rx * 2),
          h: pt2in(el.ry * 2),
          fill: el.fill ? { color: hex6(el.fill) } : { type: 'none' },
          line: el.stroke ? { color: hex6(el.stroke), width: el.strokeWidth ?? 0.75 } : { type: 'none' },
        });
      },
      line: (el) => {
        const transparency = Math.round((1 - (el.opacity ?? 1)) * 100);
        slide.addShape('line', {
          x: pt2in(Math.min(el.x1, el.x2)),
          y: pt2in(Math.min(el.y1, el.y2)),
          w: Math.max(pt2in(Math.abs(el.x2 - el.x1)), 0.001),
          h: Math.max(pt2in(Math.abs(el.y2 - el.y1)), 0.001),
          flipH: el.x2 < el.x1,
          flipV: el.y2 < el.y1,
          line: {
            color: hex6(el.color),
            width: el.width,
            transparency,
            ...(el.dash ? { dashType: 'dash' } : {}),
          },
        });
      },
      stadium: (el) => {
        addStadium(slide, el);
      },
      shape: (el) => {
        slide.addShape(CANVAS_SHAPE_PPT_NAME[el.shape], {
          x: pt2in(el.x),
          y: pt2in(el.y),
          w: Math.max(pt2in(el.w), 0.01),
          h: Math.max(pt2in(el.h), 0.01),
          fill: el.fill ? { color: hex6(el.fill) } : { type: 'none' },
          line: el.stroke
            ? { color: hex6(el.stroke), width: el.strokeWidth ?? 0.75 }
            : { type: 'none' },
          ...(el.shape === 'roundRect' && el.cornerRadius
            ? { rectRadius: pt2in(el.cornerRadius) }
            : {}),
          ...(el.rotationDeg ? { rotate: el.rotationDeg } : {}),
          ...(el.flipH ? { flipH: true } : {}),
          ...(el.flipV ? { flipV: true } : {}),
        });
      },
      polygon: (el) => {
        if (el.points.length < 3) return;
        const minX = Math.min(...el.points.map((p) => p.x));
        const minY = Math.min(...el.points.map((p) => p.y));
        const maxX = Math.max(...el.points.map((p) => p.x));
        const maxY = Math.max(...el.points.map((p) => p.y));
        const w = Math.max(maxX - minX, 0.5);
        const h = Math.max(maxY - minY, 0.5);
        slide.addShape('custGeom', {
          x: pt2in(minX),
          y: pt2in(minY),
          w: pt2in(w),
          h: pt2in(h),
          fill: { color: hex6(el.fill) },
          line: { type: 'none' },
          points: [
            ...el.points.map((p, i) => ({
              x: pt2in(p.x - minX),
              y: pt2in(p.y - minY),
              ...(i === 0 ? { moveTo: true } : {}),
            })),
            { close: true },
          ],
        });
      },
      text: (el) => {
        const fontFace = resolveUnicodeFontFamily(el.fontFamily, el.text || el.lines.join(''));
        const charSpacing =
          el.letterSpacingEm != null && el.letterSpacingEm > 0
            ? el.letterSpacingEm * el.fontSize
            : undefined;
        const layers =
          el.effect === 'extrude' || el.effect === 'perspective' || el.effect === 'bevel'
            ? textEffectLayers(el.effect)
            : [];
        for (const layer of layers) {
          slide.addText(el.lines.join('\n'), {
            x: pt2in(el.x + layer.dx),
            y: pt2in(el.y + layer.dy),
            w: Math.max(pt2in(el.w), 0.05),
            h: Math.max(pt2in(el.h), 0.05),
            fontFace,
            fontSize: el.fontSize,
            bold: !!el.bold,
            italic: !!el.italic,
            color: hex6(layer.color),
            transparency: Math.round((1 - layer.opacity) * 100),
            align: el.align,
            valign: el.valign,
            margin: 0,
            wrap: false,
            isTextBox: true,
            fit: 'none',
            ...(charSpacing != null ? { charSpacing } : {}),
            ...(el.rotationDeg ? { rotate: el.rotationDeg } : {}),
          });
        }
        slide.addText(el.lines.join('\n'), {
          x: pt2in(el.x),
          y: pt2in(el.y),
          w: Math.max(pt2in(el.w), 0.05),
          h: Math.max(pt2in(el.h), 0.05),
          fontFace,
          fontSize: el.fontSize,
          bold: !!el.bold,
          italic: !!el.italic,
          color: hex6(el.color),
          align: el.align,
          valign: el.valign,
          margin: 0,
          wrap: false,
          isTextBox: true,
          fit: 'none',
          ...(charSpacing != null ? { charSpacing } : {}),
          ...(el.effect === 'outline' ? { outline: { size: 0.75, color: '0F172A' } } : {}),
          ...(el.effect === 'glow' ? { glow: { size: 6, color: hex6(el.color), opacity: 0.45 } } : {}),
          ...(el.effect === 'shadow' || el.effect === 'soft-shadow'
            ? {
                shadow: {
                  type: 'outer',
                  color: '0F172A',
                  blur: el.effect === 'soft-shadow' ? 8 : 2,
                  offset: el.effect === 'soft-shadow' ? 4 : 2,
                  angle: 45,
                  opacity: 0.4,
                },
              }
            : {}),
          ...(el.rotationDeg ? { rotate: el.rotationDeg } : {}),
        });
      },
      image: (el) => {
        if (!slide.addImage) {
          throw new Error('PPTX renderer received an image primitive but the slide cannot add images. Do not drop it.');
        }
        slide.addImage({
          data: el.href,
          x: pt2in(el.x),
          y: pt2in(el.y),
          w: pt2in(el.w),
          h: pt2in(el.h),
          ...(el.rotationDeg ? { rotate: el.rotationDeg } : {}),
          ...(el.flipH ? { flipH: true } : {}),
          ...(el.flipV ? { flipV: true } : {}),
        });
      },
    });
  }
}
