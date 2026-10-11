/**
 * One-click local enhancement for coloring-page and black-and-white line art.
 *
 * Method (browser, no external APIs):
 * 1. Measure jagginess, isolated specks, line width, and contrast.
 * 2. Pick a light or stronger cleanup from those measurements.
 * 3. Threshold ink, drop only isolated specks far from the drawing, and close
 *    a 1px break only when two opposite neighbors continue the same stroke.
 * 4. Trace ink (outers and holes) and silhouette contours, simplify with
 *    Douglas–Peucker while pinning corners, Chaikin-smooth the rings, then
 *    even-odd fill those curves at print size with 4× supersampling. The
 *    result is SVG-quality line work: the same paths are also written as SVG.
 *
 * White interiors stay opaque. Exterior stays transparent. A fixed transparent
 * pad keeps smoothed edges from clipping. The source crop is never overwritten.
 * Heavily blurred or empty sources are left unchanged.
 */

import type { PixelBuffer } from './sprite-sheet-importer';

export const AUTO_ENHANCE_PPI = 600;
export const AUTO_ENHANCE_MAX_SIDE = 1600;
export const AUTO_ENHANCE_PAD = 10;

export interface AutoEnhanceAnalysis {
  inkPixels: number;
  jagginess: number;
  noiseRatio: number;
  meanLineWidth: number;
  contrast: number;
  degraded: boolean;
  reason?: string;
  strength: number;
}

export interface AutoEnhanceOptions {
  /** Long side of the illustration at 600 PPI in the document, before padding. */
  printLongSide?: number;
  /** Multiply the measured cleanup strength. 1 keeps the automatic setting. */
  strengthBias?: number;
  /** Replace the automatic cleanup strength. */
  strengthOverride?: number;
  /** Trace even when the automatic checks would skip a weak source. */
  force?: boolean;
}

export interface AutoEnhanceResult {
  image: PixelBuffer;
  applied: boolean;
  message?: string;
  analysis: AutoEnhanceAnalysis;
  /** Vector paths of the cleaned line art, for a crisp on-screen preview. */
  svg?: string;
}

export function mazeImagePrintLongSidePx(imageScalePercent: number): number {
  const short = 240;
  let band = Math.min(64, Math.max(28, short * 0.16));
  band = Math.min(band, short * 0.22);
  const scale = Math.max(0.4, Math.min(2, (Number(imageScalePercent) || 100) / 100));
  band = Math.min(band * scale, short * 0.42);
  return Math.max(96, Math.min(AUTO_ENHANCE_MAX_SIDE, Math.round((band / 72) * AUTO_ENHANCE_PPI)));
}

export function autoEnhanceLineArt(src: PixelBuffer, options: AutoEnhanceOptions = {}): AutoEnhanceResult {
  const analysis = analyzeLineArt(src);
  if (analysis.degraded && !options.force) {
    return {
      image: cloneBuffer(src),
      applied: false,
      message: analysis.reason || 'This image is too unclear to enhance, so the original crop was kept.',
      analysis,
    };
  }

  const strength = resolveEnhanceStrength(analysis.strength, options);
  const cleaned = cleanInk(src, { ...analysis, strength });
  const printLong = Math.max(1, options.printLongSide ?? Math.max(src.width, src.height));
  const srcLong = Math.max(src.width, src.height);
  const contentLong = Math.min(AUTO_ENHANCE_MAX_SIDE, Math.max(srcLong, printLong));
  const scale = contentLong / srcLong;
  const pad = AUTO_ENHANCE_PAD;
  const outW = Math.max(1, Math.round(src.width * scale) + pad * 2);
  const outH = Math.max(1, Math.round(src.height * scale) + pad * 2);
  const raster = rasterizeCleaned(cleaned, src.width, src.height, outW, outH, scale, pad, strength);
  return { image: raster.image, applied: true, analysis: { ...analysis, strength }, svg: raster.svg };
}

function resolveEnhanceStrength(measured: number, options: AutoEnhanceOptions): number {
  if (typeof options.strengthOverride === 'number' && Number.isFinite(options.strengthOverride)) {
    return Math.max(0.08, Math.min(0.98, options.strengthOverride));
  }
  const bias = typeof options.strengthBias === 'number' && Number.isFinite(options.strengthBias) ? options.strengthBias : 1;
  return Math.max(0.08, Math.min(0.98, measured * bias));
}

function cloneBuffer(src: PixelBuffer): PixelBuffer {
  return { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height };
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isInk(data: Uint8ClampedArray, i: number, threshold: number): boolean {
  if (data[i + 3] < 16) return false;
  return luminance(data[i], data[i + 1], data[i + 2]) < threshold;
}

function classify(src: PixelBuffer, threshold = 236): { ink: Uint8Array; opaque: Uint8Array } {
  const { data, width, height } = src;
  const ink = new Uint8Array(width * height);
  const opaque = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (data[i + 3] >= 16) opaque[p] = 1;
    if (isInk(data, i, threshold)) ink[p] = 1;
  }
  return { ink, opaque };
}

function analyzeLineArt(src: PixelBuffer): AutoEnhanceAnalysis {
  const { data, width, height } = src;
  const { ink } = classify(src);
  let inkPixels = 0;
  let minL = 255;
  let maxL = 0;
  let opaque = 0;
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (data[i + 3] < 16) continue;
    opaque += 1;
    const lum = luminance(data[i], data[i + 1], data[i + 2]);
    minL = Math.min(minL, lum);
    maxL = Math.max(maxL, lum);
    if (ink[p]) inkPixels += 1;
  }
  const contrast = !opaque
    ? 0
    : inkPixels > 0 && inkPixels === opaque
      ? 255
      : maxL - minL;
  const inkRatio = ink.length ? inkPixels / ink.length : 0;
  const parts = labeledComponents(ink, width, height);
  const large = parts.filter((part) => part.area >= 8);
  const specks = parts.filter((part) => part.area <= 3);
  const noiseRatio = inkPixels ? specks.reduce((sum, part) => sum + part.area, 0) / inkPixels : 0;
  const jagginess = measureJagginess(ink, width, height);
  const meanLineWidth = measureLineWidth(ink, width, height);

  let degraded = false;
  let reason: string | undefined;
  if (inkPixels < 12 || large.length === 0) {
    degraded = true;
    reason = 'Very little line art was found, so the original crop was kept.';
  } else if (contrast < 18) {
    degraded = true;
    reason = 'This image is too low-contrast to enhance reliably, so the original crop was kept.';
  } else if (inkRatio > 0.78 && meanLineWidth > 8) {
    degraded = true;
    reason = 'This image does not read as line art, so the original crop was kept.';
  }

  let strength = 0.22 + jagginess * 0.62 + Math.min(0.2, noiseRatio * 2);
  if (meanLineWidth <= 1.25) strength *= 0.72;
  if (jagginess < 0.16 && noiseRatio < 0.012) strength = Math.min(strength, 0.28);
  strength = Math.max(0.16, Math.min(0.92, strength));

  return { inkPixels, jagginess, noiseRatio, meanLineWidth, contrast, degraded, reason, strength };
}

interface Component {
  id: number;
  area: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

function labeledComponents(mask: Uint8Array, width: number, height: number): Component[] {
  const labels = new Int32Array(mask.length);
  const parts: Component[] = [];
  const stack = new Int32Array(mask.length);
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (sp > 0) {
      const p = stack[--sp];
      area += 1;
      const x = p % width;
      const y = (p / width) | 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!mask[np] || labels[np]) continue;
          labels[np] = next;
          stack[sp++] = np;
        }
      }
    }
    parts.push({ id: next, area, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    next += 1;
  }
  return parts;
}

function measureJagginess(ink: Uint8Array, width: number, height: number): number {
  let border = 0;
  let stairs = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      const n = ink[p - width];
      const s = ink[p + width];
      const e = ink[p + 1];
      const w = ink[p - 1];
      if (n && s && e && w) continue;
      border += 1;
      const ne = ink[p - width + 1];
      const nw = ink[p - width - 1];
      const se = ink[p + width + 1];
      const sw = ink[p + width - 1];
      const stair =
        (!n && !e && ne) ||
        (!n && !w && nw) ||
        (!s && !e && se) ||
        (!s && !w && sw);
      if (stair) stairs += 1;
    }
  }
  return border ? stairs / border : 0;
}

function measureLineWidth(ink: Uint8Array, width: number, height: number): number {
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      let span = 1;
      while (x + span < width && ink[p + span]) span += 1;
      if (span > 0) {
        sum += span;
        count += 1;
      }
      x += span;
    }
  }
  return count ? sum / count : 1;
}

function cleanInk(src: PixelBuffer, analysis: AutoEnhanceAnalysis): { ink: Uint8Array; silhouette: Uint8Array; width: number; height: number } {
  const { width, height, data } = src;
  const { ink } = classify(src);
  const speckleMax = analysis.noiseRatio > 0.08 ? 3 : analysis.noiseRatio > 0.04 ? 2 : 1;
  const parts = labeledComponents(ink, width, height);
  const labels = labelMask(ink, width, height);
  const specks = parts.filter((part) => part.area <= speckleMax);
  const keep = new Set(parts.filter((part) => part.area > speckleMax).map((part) => part.id));
  const dropFarSpecks = specks.length >= 4;
  for (const part of specks) {
    if (!dropFarSpecks) {
      keep.add(part.id);
      continue;
    }
    const near = parts.some(
      (other) => other.id !== part.id && other.area > speckleMax && gap(part, other) <= 3
    );
    if (near) keep.add(part.id);
  }
  const cleaned = new Uint8Array(ink.length);
  for (let p = 0; p < ink.length; p++) {
    if (ink[p] && keep.has(labels[p])) cleaned[p] = 1;
  }
  repairTinyBreaks(cleaned, width, height);
  const exterior = exteriorFromAlpha(data, width, height, cleaned);
  const silhouette = new Uint8Array(ink.length);
  for (let p = 0; p < silhouette.length; p++) {
    if (!exterior[p]) silhouette[p] = 1;
  }
  return { ink: cleaned, silhouette, width, height };
}

function labelMask(mask: Uint8Array, width: number, height: number): Int32Array {
  const labels = new Int32Array(mask.length);
  const stack = new Int32Array(mask.length);
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = next;
    while (sp > 0) {
      const p = stack[--sp];
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!mask[np] || labels[np]) continue;
          labels[np] = next;
          stack[sp++] = np;
        }
      }
    }
    next += 1;
  }
  return labels;
}

function gap(a: Component, b: Component): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

function repairTinyBreaks(ink: Uint8Array, width: number, height: number): void {
  const add: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (ink[p]) continue;
      const left = ink[p - 1];
      const right = ink[p + 1];
      const up = ink[p - width];
      const down = ink[p + width];
      const horizontal = left && right && !up && !down;
      const vertical = up && down && !left && !right;
      if (!horizontal && !vertical) continue;
      if (horizontal && (ink[p - width - 1] || ink[p - width + 1]) && (ink[p + width - 1] || ink[p + width + 1])) {
        continue;
      }
      if (vertical && (ink[p - width - 1] || ink[p + width - 1]) && (ink[p - width + 1] || ink[p + width + 1])) {
        continue;
      }
      add.push(p);
    }
  }
  for (const p of add) ink[p] = 1;
}

function exteriorFromAlpha(data: Uint8ClampedArray, width: number, height: number, ink: Uint8Array): Uint8Array {
  const exterior = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (exterior[p] || ink[p]) return;
    const i = p * 4;
    if (data[i + 3] >= 16 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) return;
    exterior[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return exterior;
}

function rasterizeCleaned(
  cleaned: { ink: Uint8Array; silhouette: Uint8Array; width: number; height: number },
  srcW: number,
  srcH: number,
  outW: number,
  outH: number,
  scale: number,
  pad: number,
  strength: number
): { image: PixelBuffer; svg: string } {
  const ss = 4;
  const hiW = outW * ss;
  const hiH = outH * ss;
  const hiScale = scale * ss;
  const hiPad = pad * ss;
  const inkRings = traceInkAndHoles(cleaned.ink, srcW, srcH, strength);
  const bodyRings = traceAndSmooth(cleaned.silhouette, srcW, srcH, Math.min(0.5, strength * 0.85));
  const marks = tinyInkMarks(cleaned.ink, srcW, srcH, inkRings);
  const body = new Uint8Array(hiW * hiH);
  const ink = new Uint8Array(hiW * hiH);
  fillRingsEvenOdd(
    body,
    hiW,
    hiH,
    bodyRings.map((ring) => scaleRing(ring, hiScale, hiPad))
  );
  fillRingsEvenOdd(
    ink,
    hiW,
    hiH,
    inkRings.map((ring) => scaleRing(ring, hiScale, hiPad))
  );
  strokeRings(ink, hiW, hiH, inkRings, hiScale, hiPad);
  stampTinyMarks(ink, hiW, hiH, marks, hiScale, hiPad);
  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      let inkCover = 0;
      let bodyCover = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const p = (y * ss + sy) * hiW + (x * ss + sx);
          if (ink[p]) inkCover += 1;
          else if (body[p]) bodyCover += 1;
        }
      }
      const i = (y * outW + x) * 4;
      const total = ss * ss;
      if (inkCover > 0) {
        const t = inkCover / total;
        const gray = Math.round(255 * (1 - t));
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
        data[i + 3] = 255;
      } else if (bodyCover > 0) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }
  return {
    image: { data, width: outW, height: outH },
    svg: ringsToSvg(bodyRings, inkRings, marks, outW, outH, scale, pad),
  };
}

function strokeRings(
  dest: Uint8Array,
  width: number,
  height: number,
  rings: number[][],
  scale: number,
  pad: number
): void {
  const radius = Math.max(1.6, scale * 0.48);
  for (const ring of rings) {
    const scaled = scaleRing(ring, scale, pad);
    const count = scaled.length / 2;
    for (let index = 0; index < count; index++) {
      const next = (index + 1) % count;
      drawLine(
        dest,
        width,
        height,
        scaled[index * 2],
        scaled[index * 2 + 1],
        scaled[next * 2],
        scaled[next * 2 + 1],
        radius
      );
    }
  }
}

function drawLine(
  dest: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  radius: number
): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  const r = Math.max(1, Math.round(radius));
  const r2 = radius * radius;
  for (let i = 0; i <= steps; i++) {
    const cx = x0 + ((x1 - x0) * i) / steps;
    const cy = y0 + ((y1 - y0) * i) / steps;
    const xStart = Math.max(0, Math.floor(cx - r));
    const xEnd = Math.min(width - 1, Math.ceil(cx + r));
    const yStart = Math.max(0, Math.floor(cy - r));
    const yEnd = Math.min(height - 1, Math.ceil(cy + r));
    for (let y = yStart; y <= yEnd; y++) {
      for (let x = xStart; x <= xEnd; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) dest[y * width + x] = 1;
      }
    }
  }
}

function scaleRing(ring: number[], scale: number, pad: number): number[] {
  const out = new Array(ring.length);
  for (let i = 0; i < ring.length; i += 2) {
    out[i] = ring[i] * scale + pad;
    out[i + 1] = ring[i + 1] * scale + pad;
  }
  return out;
}

function fillRingsEvenOdd(mask: Uint8Array, width: number, height: number, rings: number[][]): void {
  const valid = rings.filter((polygon) => polygon.length >= 6);
  if (!valid.length) return;
  let minY = height;
  let maxY = 0;
  for (const polygon of valid) {
    for (let i = 1; i < polygon.length; i += 2) {
      minY = Math.min(minY, polygon[i]);
      maxY = Math.max(maxY, polygon[i]);
    }
  }
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(height - 1, Math.ceil(maxY));
  for (let y = yStart; y <= yEnd; y++) {
    const scan = y + 0.5;
    const hits: number[] = [];
    for (const polygon of valid) {
      const count = polygon.length / 2;
      for (let index = 0; index < count; index++) {
        const next = (index + 1) % count;
        const y1 = polygon[index * 2 + 1];
        const y2 = polygon[next * 2 + 1];
        if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
          const t = (scan - y1) / (y2 - y1 || 1e-9);
          hits.push(polygon[index * 2] + t * (polygon[next * 2] - polygon[index * 2]));
        }
      }
    }
    hits.sort((a, b) => a - b);
    const row = y * width;
    for (let index = 0; index + 1 < hits.length; index += 2) {
      const from = Math.max(0, Math.ceil(hits[index] - 0.001));
      const to = Math.min(width, Math.floor(hits[index + 1] + 0.001));
      for (let x = from; x < to; x++) mask[row + x] = 1;
    }
  }
}

function stampTinyMarks(
  dest: Uint8Array,
  width: number,
  height: number,
  marks: Array<{ x: number; y: number }>,
  scale: number,
  pad: number
): void {
  const radius = Math.max(1.25, scale * 0.62);
  const r2 = radius * radius;
  for (const mark of marks) {
    const cx = mark.x * scale + pad;
    const cy = mark.y * scale + pad;
    const x0 = Math.max(0, Math.floor(cx - radius));
    const x1 = Math.min(width - 1, Math.ceil(cx + radius));
    const y0 = Math.max(0, Math.floor(cy - radius));
    const y1 = Math.min(height - 1, Math.ceil(cy + radius));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) dest[y * width + x] = 1;
      }
    }
  }
}

function traceAndSmooth(mask: Uint8Array, width: number, height: number, strength: number): number[][] {
  const rings = traceContours(mask, width, height);
  const epsilon = 0.38 + strength * 0.72;
  return rings.map((ring) => smoothRing(ring, epsilon));
}

function traceInkAndHoles(mask: Uint8Array, width: number, height: number, strength: number): number[][] {
  const outers = traceContours(mask, width, height);
  const holes = traceContours(interiorHoleMask(mask, width, height), width, height);
  const epsilon = 0.38 + strength * 0.72;
  return [...outers, ...holes].map((ring) => smoothRing(ring, epsilon));
}

function interiorHoleMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const exterior = new Uint8Array(mask.length);
  const stack = new Int32Array(mask.length);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (exterior[p] || mask[p]) return;
    exterior[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (sp > 0) {
    const p = stack[--sp];
    const x = p % width;
    const y = (p / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const holes = new Uint8Array(mask.length);
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] && !exterior[p]) holes[p] = 1;
  }
  return holes;
}

function tinyInkMarks(
  mask: Uint8Array,
  width: number,
  height: number,
  rings: number[][]
): Array<{ x: number; y: number }> {
  const parts = labeledComponents(mask, width, height);
  const marks: Array<{ x: number; y: number }> = [];
  for (const part of parts) {
    if (part.area > 6) continue;
    const cx = part.x + part.w / 2;
    const cy = part.y + part.h / 2;
    const covered = rings.some((ring) => pointNearRing(cx, cy, ring, 1.6));
    if (!covered) marks.push({ x: cx, y: cy });
  }
  return marks;
}

function pointNearRing(x: number, y: number, ring: number[], maxDist: number): boolean {
  for (let i = 0; i < ring.length; i += 2) {
    if (Math.hypot(ring[i] - x, ring[i + 1] - y) <= maxDist) return true;
  }
  return false;
}

function ringsToSvg(
  bodyRings: number[][],
  inkRings: number[][],
  marks: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  scale: number,
  pad: number
): string {
  const body = pathFromRings(bodyRings, scale, pad);
  const ink = pathFromRings(inkRings, scale, pad);
  const dots = marks
    .map((mark) => {
      const r = Math.max(0.7, scale * 0.55);
      return `<circle cx="${(mark.x * scale + pad).toFixed(2)}" cy="${(mark.y * scale + pad).toFixed(2)}" r="${r.toFixed(2)}" fill="#111"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${
    body ? `<path d="${body}" fill="#fff"/>` : ''
  }${
    ink
      ? `<path d="${ink}" fill="#111" fill-rule="evenodd" stroke="#111" stroke-width="${Math.max(0.8, scale * 0.45).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`
      : ''
  }${dots}</svg>`;
}

function pathFromRings(rings: number[][], scale: number, pad: number): string {
  return rings
    .filter((ring) => ring.length >= 6)
    .map((ring) => {
      const scaled = scaleRing(ring, scale, pad);
      let d = `M${scaled[0].toFixed(2)} ${scaled[1].toFixed(2)}`;
      for (let i = 2; i < scaled.length; i += 2) {
        d += `L${scaled[i].toFixed(2)} ${scaled[i + 1].toFixed(2)}`;
      }
      return `${d}Z`;
    })
    .join('');
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];

function traceContours(mask: Uint8Array, width: number, height: number): number[][] {
  const seen = new Uint8Array(mask.length);
  const rings: number[][] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p] || seen[p]) continue;
      const left = x === 0 || !mask[p - 1];
      if (!left) continue;
      const ring = walkContour(mask, width, height, x, y);
      if (ring.length >= 2) rings.push(ring);
      floodSeen(mask, seen, width, height, x, y);
    }
  }
  return rings;
}

function walkContour(mask: Uint8Array, width: number, height: number, sx: number, sy: number): number[] {
  const ring: number[] = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  for (let step = 0; step < width * height; step++) {
    ring.push(x + 0.5, y + 0.5);
    let found = false;
    for (let offset = 0; offset < 8; offset++) {
      const nextDir = (dir + 6 + offset) % 8;
      const nx = x + DIRS[nextDir][0];
      const ny = y + DIRS[nextDir][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!mask[ny * width + nx]) continue;
      x = nx;
      y = ny;
      dir = nextDir;
      found = true;
      break;
    }
    if (!found) break;
    if (x === sx && y === sy && ring.length >= 8) break;
  }
  return ring;
}

function floodSeen(mask: Uint8Array, seen: Uint8Array, width: number, height: number, x0: number, y0: number): void {
  const stack = [y0 * width + x0];
  seen[y0 * width + x0] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (!mask[np] || seen[np]) continue;
        seen[np] = 1;
        stack.push(np);
      }
    }
  }
}

function smoothRing(ring: number[], epsilon: number): number[] {
  if (ring.length < 6) return expandTinyRing(ring);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < ring.length; i += 2) pts.push({ x: ring[i], y: ring[i + 1] });
  const corners = new Set<number>();
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const ax = cur.x - prev.x;
    const ay = cur.y - prev.y;
    const bx = next.x - cur.x;
    const by = next.y - cur.y;
    const prevLen = Math.hypot(ax, ay);
    const nextLen = Math.hypot(bx, by);
    const den = prevLen * nextLen || 1;
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / den)));
    if ((angle * 180) / Math.PI >= 52 && prevLen >= 2.15 && nextLen >= 2.15) corners.add(i);
  }
  const kept = douglasPeuckerClosed(pts, epsilon, corners);
  const bounds = ringBounds(pts);
  const thin = Math.min(bounds.w, bounds.h) < 2.4;
  const longThin = thin && Math.max(bounds.w, bounds.h) >= 3;
  if (longThin) {
    let far = 0;
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      const dist = Math.hypot(pts[i].x - pts[0].x, pts[i].y - pts[0].y);
      if (dist > best) {
        best = dist;
        far = i;
      }
    }
    return ribbonFromPoints(pts.slice(0, far + 1), 0.58);
  }
  const rounded = chaikinClosed(kept, corners.size ? remapCorners(pts, kept, corners) : new Set(), 3);
  const out: number[] = [];
  for (const point of rounded) out.push(point.x, point.y);
  return out.length >= 6 ? out : expandTinyRing(ring);
}

function ribbonFromPoints(pts: Array<{ x: number; y: number }>, half: number): number[] {
  const line = unwrapRetrace(pts);
  if (line.length < 2) return expandTinyRing([pts[0]?.x ?? 0, pts[0]?.y ?? 0]);
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty * half;
    const ny = tx * half;
    left.push({ x: line[i].x + nx, y: line[i].y + ny });
    right.push({ x: line[i].x - nx, y: line[i].y - ny });
  }
  const out: number[] = [];
  for (const point of left) out.push(point.x, point.y);
  for (let i = right.length - 1; i >= 0; i--) out.push(right[i].x, right[i].y);
  return out;
}

function ringBounds(pts: Array<{ x: number; y: number }>): { w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of pts) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { w: maxX - minX, h: maxY - minY };
}

function unwrapRetrace(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const unique: Array<{ x: number; y: number }> = [];
  for (const point of pts) {
    const last = unique[unique.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 0.2) continue;
    unique.push(point);
  }
  if (unique.length >= 3 && Math.hypot(unique[0].x - unique[unique.length - 1].x, unique[0].y - unique[unique.length - 1].y) < 1.2) {
    unique.pop();
  }
  return unique;
}

function expandTinyRing(ring: number[]): number[] {
  let x = 0;
  let y = 0;
  const count = Math.max(1, ring.length / 2);
  for (let i = 0; i < ring.length; i += 2) {
    x += ring[i];
    y += ring[i + 1];
  }
  x /= count;
  y /= count;
  const r = 0.62;
  return [x - r, y, x, y - r, x + r, y, x, y + r];
}

function remapCorners(
  original: Array<{ x: number; y: number }>,
  kept: Array<{ x: number; y: number }>,
  corners: Set<number>
): Set<number> {
  const next = new Set<number>();
  for (const index of corners) {
    const point = original[index];
    const found = kept.findIndex((candidate) => candidate.x === point.x && candidate.y === point.y);
    if (found >= 0) next.add(found);
  }
  return next;
}

function chaikinClosed(
  pts: Array<{ x: number; y: number }>,
  corners: Set<number>,
  rounds: number
): Array<{ x: number; y: number }> {
  let current = pts;
  let pinned = corners;
  for (let round = 0; round < rounds; round++) {
    if (current.length < 3) break;
    const next: Array<{ x: number; y: number }> = [];
    const nextPinned = new Set<number>();
    const count = current.length;
    for (let i = 0; i < count; i++) {
      const a = current[i];
      const b = current[(i + 1) % count];
      if (pinned.has(i)) {
        nextPinned.add(next.length);
        next.push({ x: a.x, y: a.y });
      }
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    current = next;
    pinned = nextPinned;
  }
  return current;
}

function douglasPeuckerClosed(
  pts: Array<{ x: number; y: number }>,
  epsilon: number,
  corners: Set<number>
): Array<{ x: number; y: number }> {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  for (const index of corners) keep[index] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;
    const a = pts[start];
    const b = pts[end];
    let best = 0;
    let bestIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointLineDistance(pts[i], a, b);
      if (d > best) {
        best = d;
        bestIndex = i;
      }
    }
    if (best > epsilon && bestIndex >= 0) {
      keep[bestIndex] = 1;
      stack.push([start, bestIndex], [bestIndex, end]);
    }
  }
  return pts.filter((_, index) => keep[index]);
}

function pointLineDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}
