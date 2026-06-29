/**
 * Shared geometry for header shape containers — CSS clip-path + Canvas2D paths.
 */

import type { HeaderShapeId } from './types';

export interface ShapeGeometryParams {
  shapeId: HeaderShapeId;
  width: number;
  height: number;
  borderRadiusPx?: number;
  polygonSides?: number;
}

function pct(x: number, total: number): string {
  return `${((x / total) * 100).toFixed(2)}%`;
}

/** CSS clip-path polygon string (percent-based for responsive containers). */
export function shapeClipPath(params: ShapeGeometryParams): string {
  const { shapeId, width: w, height: h } = params;
  const r = Math.min(params.borderRadiusPx ?? 0, h / 2, w / 2);
  const sides = Math.max(3, Math.min(12, params.polygonSides ?? 6));
  const inset = Math.min(w, h) * 0.12;

  switch (shapeId) {
    case 'rectangle':
      return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
    case 'rounded-rect':
      if (r <= 0) return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      return `inset(0 round ${r}px)`;
    case 'pill': {
      const pr = Math.max(r, h / 2);
      return `inset(0 round ${pr}px)`;
    }
    case 'circle':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'polygon':
    case 'hexagon': {
      const n = shapeId === 'hexagon' ? 6 : sides;
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2 - 1;
      const ry = h / 2 - 1;
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        pts.push(`${pct(cx + rx * Math.cos(a), w)} ${pct(cy + ry * Math.sin(a), h)}`);
      }
      return `polygon(${pts.join(', ')})`;
    }
    case 'trapezoid':
      return `polygon(${pct(inset, w)} 0%, ${pct(w - inset, w)} 0%, 100% 100%, 0% 100%)`;
    case 'parallelogram':
      return `polygon(${pct(inset, w)} 0%, 100% 0%, ${pct(w - inset, w)} 100%, 0% 100%)`;
    case 'chevron': {
      const c = Math.min(inset, w * 0.08);
      return `polygon(${pct(c, w)} 0%, ${pct(w - c, w)} 0%, 100% 50%, ${pct(w - c, w)} 100%, ${pct(c, w)} 100%, 0% 50%)`;
    }
    case 'ribbon-notch':
      return 'polygon(0% 0%, 100% 0%, 100% 72%, 50% 100%, 0% 72%)';
    default:
      return 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
  }
}

function roundRectSvgPath(w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h / 2);
  if (rad <= 0) return `M 0 0 H ${w} V ${h} H 0 Z`;
  return [
    `M ${rad} 0`,
    `H ${w - rad}`,
    `A ${rad} ${rad} 0 0 1 ${w} ${rad}`,
    `V ${h - rad}`,
    `A ${rad} ${rad} 0 0 1 ${w - rad} ${h}`,
    `H ${rad}`,
    `A ${rad} ${rad} 0 0 1 0 ${h - rad}`,
    `V ${rad}`,
    `A ${rad} ${rad} 0 0 1 ${rad} 0`,
    'Z',
  ].join(' ');
}

/** SVG path `d` for a shape in local 0..w × 0..h coords (fill + stroke share this path). */
export function shapeSvgPathData(w: number, h: number, params: ShapeGeometryParams): string {
  const { shapeId } = params;
  const r = Math.min(params.borderRadiusPx ?? 0, h / 2, w / 2);
  const sides = Math.max(3, Math.min(12, params.polygonSides ?? 6));
  const inset = Math.min(w, h) * 0.12;

  switch (shapeId) {
    case 'rectangle':
      return `M 0 0 H ${w} V ${h} H 0 Z`;
    case 'rounded-rect':
      return roundRectSvgPath(w, h, r);
    case 'pill':
      return roundRectSvgPath(w, h, Math.max(r, h / 2));
    case 'circle':
      return `M ${w / 2} ${h / 2} m ${-w / 2} 0 a ${w / 2} ${h / 2} 0 1 0 ${w} 0 a ${w / 2} ${h / 2} 0 1 0 ${-w} 0`;
    case 'polygon':
    case 'hexagon': {
      const n = shapeId === 'hexagon' ? 6 : sides;
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2 - 1;
      const ry = h / 2 - 1;
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
      }
      return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
    }
    case 'trapezoid':
      return `M ${inset} 0 L ${w - inset} 0 L ${w} ${h} L 0 ${h} Z`;
    case 'parallelogram':
      return `M ${inset} 0 L ${w} 0 L ${w - inset} ${h} L 0 ${h} Z`;
    case 'chevron': {
      const c = Math.min(inset, w * 0.08);
      return `M ${c} 0 L ${w - c} 0 L ${w} ${h / 2} L ${w - c} ${h} L ${c} ${h} L 0 ${h / 2} Z`;
    }
    case 'ribbon-notch':
      return `M 0 0 H ${w} V ${h * 0.72} L ${w / 2} ${h} L 0 ${h * 0.72} Z`;
    default:
      return `M 0 0 H ${w} V ${h} H 0 Z`;
  }
}

/** Build a Canvas2D path for the shape (absolute px coords). */
export function shapeCanvasPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  params: ShapeGeometryParams
): void {
  const { shapeId } = params;
  const r = Math.min(params.borderRadiusPx ?? 0, h / 2, w / 2);
  const sides = Math.max(3, Math.min(12, params.polygonSides ?? 6));
  const inset = Math.min(w, h) * 0.12;

  ctx.beginPath();

  switch (shapeId) {
    case 'rectangle':
      ctx.rect(x, y, w, h);
      break;
    case 'rounded-rect':
    case 'pill': {
      const pr = shapeId === 'pill' ? Math.max(r, h / 2) : r;
      if (pr <= 0) {
        ctx.rect(x, y, w, h);
      } else {
        roundRect(ctx, x, y, w, h, pr);
      }
      break;
    }
    case 'circle': {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    }
    case 'polygon':
    case 'hexagon': {
      const n = shapeId === 'hexagon' ? 6 : sides;
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2 - 1;
      const ry = h / 2 - 1;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const px = cx + rx * Math.cos(a);
        const py = cy + ry * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
    case 'trapezoid':
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + w - inset, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case 'parallelogram':
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - inset, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
      break;
    case 'chevron': {
      const c = Math.min(inset, w * 0.08);
      ctx.moveTo(x + c, y);
      ctx.lineTo(x + w - c, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - c, y + h);
      ctx.lineTo(x + c, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
      break;
    }
    case 'ribbon-notch':
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + h * 0.72);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h * 0.72);
      ctx.closePath();
      break;
    default:
      ctx.rect(x, y, w, h);
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/** Normalized 0–1 vertices for custom PPT / vector export (matches canvas geometry). */
export function shapeVerticesNormalized(
  params: ShapeGeometryParams
): Array<{ x: number; y: number }> {
  const { shapeId, width: w, height: h } = params;
  const sides = Math.max(3, Math.min(12, params.polygonSides ?? 6));
  const inset = Math.min(w, h) * 0.12;

  switch (shapeId) {
    case 'polygon':
    case 'hexagon': {
      const n = shapeId === 'hexagon' ? 6 : sides;
      const cx = w / 2;
      const cy = h / 2;
      const rx = w / 2 - 1;
      const ry = h / 2 - 1;
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        pts.push({ x: (cx + rx * Math.cos(a)) / w, y: (cy + ry * Math.sin(a)) / h });
      }
      return pts;
    }
    case 'trapezoid':
      return [
        { x: inset / w, y: 0 },
        { x: (w - inset) / w, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
    case 'parallelogram':
      return [
        { x: inset / w, y: 0 },
        { x: 1, y: 0 },
        { x: (w - inset) / w, y: 1 },
        { x: 0, y: 1 },
      ];
    case 'chevron': {
      const c = Math.min(inset, w * 0.08);
      return [
        { x: c / w, y: 0 },
        { x: (w - c) / w, y: 0 },
        { x: 1, y: 0.5 },
        { x: (w - c) / w, y: 1 },
        { x: c / w, y: 1 },
        { x: 0, y: 0.5 },
      ];
    }
    case 'ribbon-notch':
      return [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 0.72 },
        { x: 0.5, y: 1 },
        { x: 0, y: 0.72 },
      ];
    default:
      return [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
  }
}

/**
 * SVG path for pdf-lib drawSvgPath (Y negated, bottom-left anchor).
 * @param x PDF bottom-left X of inner shape
 * @param yBottom PDF bottom-left Y of inner shape
 */
export function shapePdfSvgPath(
  x: number,
  yBottom: number,
  w: number,
  h: number,
  params: ShapeGeometryParams
): string {
  const verts = shapeVerticesNormalized({ ...params, width: w, height: h });
  if (verts.length === 0) return '';

  const pts = verts.map((v) => {
    const px = x + v.x * w;
    const py = -(yBottom + h - v.y * h);
    return `${px},${py}`;
  });
  return `M ${pts[0]} L ${pts.slice(1).join(' L ')} Z`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#000000').replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full.padEnd(6, '0'), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
