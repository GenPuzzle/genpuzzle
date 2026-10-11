import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import { cubicsToPath, fitClosedRing, flattenCubics } from './bezier-fit';
import { vectorizeHybridLineArt } from './centerline';
import { bilinearLuminance } from './ink';

export { extractInkMask } from './ink';

const MAX_TRACE_SIDE = 2400;

export interface FaithfulTraceOptions {
  upscale?: number;
  simplify?: number;
  chaikinRounds?: number;
  threshold?: number;
  fitError?: number;
  mode?: 'hybrid' | 'centerline' | 'contour';
}

export interface FaithfulTraceResult {
  svg: string;
  preview: PixelBuffer;
  proof: PixelBuffer;
}

export function chooseTraceScale(width: number, height: number, requested = 4): number {
  const longSide = Math.max(width, height);
  let scale = Math.max(1, Math.round(requested));
  while (scale > 1 && longSide * scale > MAX_TRACE_SIDE) scale -= 1;
  if (longSide < 900) return Math.max(scale, Math.min(4, Math.floor(MAX_TRACE_SIDE / Math.max(1, longSide))));
  return scale;
}

function lerpEdge(x0: number, y0: number, v0: number, x1: number, y1: number, v1: number, threshold: number): { x: number; y: number } {
  const t = (threshold - v0) / ((v1 - v0) || 1e-6);
  const u = Math.max(0, Math.min(1, t));
  return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u };
}

function isoRings(lum: Float32Array, width: number, height: number, threshold: number): number[][] {
  const segments: Array<[{ x: number; y: number }, { x: number; y: number }]> = [];
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const v00 = lum[y * width + x];
      const v10 = lum[y * width + x + 1];
      const v11 = lum[(y + 1) * width + x + 1];
      const v01 = lum[(y + 1) * width + x];
      const code =
        (v00 < threshold ? 1 : 0) |
        (v10 < threshold ? 2 : 0) |
        (v11 < threshold ? 4 : 0) |
        (v01 < threshold ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const top = () => lerpEdge(x, y, v00, x + 1, y, v10, threshold);
      const right = () => lerpEdge(x + 1, y, v10, x + 1, y + 1, v11, threshold);
      const bottom = () => lerpEdge(x, y + 1, v01, x + 1, y + 1, v11, threshold);
      const left = () => lerpEdge(x, y, v00, x, y + 1, v01, threshold);
      const add = (a: { x: number; y: number }, b: { x: number; y: number }) => segments.push([a, b]);
      switch (code) {
        case 1:
        case 14:
          add(left(), top());
          break;
        case 2:
        case 13:
          add(top(), right());
          break;
        case 3:
        case 12:
          add(left(), right());
          break;
        case 4:
        case 11:
          add(right(), bottom());
          break;
        case 6:
        case 9:
          add(top(), bottom());
          break;
        case 7:
        case 8:
          add(left(), bottom());
          break;
        case 5:
          add(left(), top());
          add(right(), bottom());
          break;
        case 10:
          add(top(), right());
          add(left(), bottom());
          break;
        default:
          break;
      }
    }
  }
  return stitchSegments(segments);
}

function keyOf(x: number, y: number): string {
  return `${x.toFixed(3)},${y.toFixed(3)}`;
}

function stitchSegments(segments: Array<[{ x: number; y: number }, { x: number; y: number }]>): number[][] {
  const outgoing = new Map<string, Array<{ x: number; y: number }>>();
  const push = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const key = keyOf(from.x, from.y);
    const list = outgoing.get(key);
    if (list) list.push(to);
    else outgoing.set(key, [to]);
  };
  for (const [a, b] of segments) {
    push(a, b);
    push(b, a);
  }
  const used = new Set<string>();
  const rings: number[][] = [];
  for (const [a, b] of segments) {
    const startKey = `${keyOf(a.x, a.y)}>${keyOf(b.x, b.y)}`;
    if (used.has(startKey)) continue;
    const ring: number[] = [a.x, a.y];
    let current = a;
    let next = b;
    for (let step = 0; step < segments.length + 2; step++) {
      const edgeKey = `${keyOf(current.x, current.y)}>${keyOf(next.x, next.y)}`;
      const revKey = `${keyOf(next.x, next.y)}>${keyOf(current.x, current.y)}`;
      if (used.has(edgeKey)) break;
      used.add(edgeKey);
      used.add(revKey);
      ring.push(next.x, next.y);
      const options = outgoing.get(keyOf(next.x, next.y)) ?? [];
      let found: { x: number; y: number } | null = null;
      for (const candidate of options) {
        const candKey = `${keyOf(next.x, next.y)}>${keyOf(candidate.x, candidate.y)}`;
        if (!used.has(candKey)) {
          found = candidate;
          break;
        }
      }
      if (!found) break;
      current = next;
      next = found;
      if (keyOf(next.x, next.y) === keyOf(ring[0], ring[1]) && ring.length >= 8) break;
    }
    if (ring.length >= 8) rings.push(ring);
  }
  return rings;
}

function inkAt(mask: Uint8Array, width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] === 1;
}

function pointKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Trace the exact pixel border so filled paths keep the source line width. */
function tracePixelBorders(mask: Uint8Array, width: number, height: number): number[][] {
  type Edge = { x0: number; y0: number; x1: number; y1: number };
  const outgoing = new Map<string, Edge[]>();
  const add = (x0: number, y0: number, x1: number, y1: number) => {
    const edge = { x0, y0, x1, y1 };
    const key = pointKey(x0, y0);
    const list = outgoing.get(key);
    if (list) list.push(edge);
    else outgoing.set(key, [edge]);
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (!inkAt(mask, width, height, x, y - 1)) add(x, y, x + 1, y);
      if (!inkAt(mask, width, height, x + 1, y)) add(x + 1, y, x + 1, y + 1);
      if (!inkAt(mask, width, height, x, y + 1)) add(x + 1, y + 1, x, y + 1);
      if (!inkAt(mask, width, height, x - 1, y)) add(x, y + 1, x, y);
    }
  }
  const used = new Set<Edge>();
  const rings: number[][] = [];
  for (const edges of outgoing.values()) {
    for (const start of edges) {
      if (used.has(start)) continue;
      const ring: number[] = [];
      let current = start;
      let guard = 0;
      const limit = width * height * 8;
      while (guard++ < limit) {
        if (used.has(current)) break;
        used.add(current);
        ring.push(current.x0, current.y0);
        const options = outgoing.get(pointKey(current.x1, current.y1)) ?? [];
        const unused = options.filter((edge) => !used.has(edge));
        if (!unused.length) break;
        const inDx = current.x1 - current.x0;
        const inDy = current.y1 - current.y0;
        unused.sort((a, b) => turnRank(inDx, inDy, a) - turnRank(inDx, inDy, b));
        current = unused[0];
        if (current === start || (current.x0 === start.x0 && current.y0 === start.y0 && ring.length >= 8)) break;
      }
      if (ring.length >= 8) rings.push(ring);
    }
  }
  return rings;
}

function turnRank(inDx: number, inDy: number, edge: { x0: number; y0: number; x1: number; y1: number }): number {
  const dx = edge.x1 - edge.x0;
  const dy = edge.y1 - edge.y0;
  const cross = inDx * dy - inDy * dx;
  if (cross > 0) return 0;
  if (cross === 0 && inDx * dx + inDy * dy > 0) return 1;
  return 2;
}

function ringBounds(ring: number[]): { w: number; h: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < ring.length; i += 2) {
    minX = Math.min(minX, ring[i]);
    minY = Math.min(minY, ring[i + 1]);
    maxX = Math.max(maxX, ring[i]);
    maxY = Math.max(maxY, ring[i + 1]);
  }
  return { w: maxX - minX, h: maxY - minY };
}

function douglasPeuckerClosed(pts: Array<{ x: number; y: number }>, epsilon: number): Array<{ x: number; y: number }> {
  if (pts.length <= 4 || epsilon <= 0) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    if (end <= start + 1) continue;
    const a = pts[start];
    const b = pts[end];
    let best = 0;
    let bestIndex = start;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const den = dx * dx + dy * dy || 1;
    for (let i = start + 1; i < end; i++) {
      const t = ((pts[i].x - a.x) * dx + (pts[i].y - a.y) * dy) / den;
      const px = a.x + t * dx;
      const py = a.y + t * dy;
      const dist = Math.hypot(pts[i].x - px, pts[i].y - py);
      if (dist > best) {
        best = dist;
        bestIndex = i;
      }
    }
    if (best > epsilon) {
      keep[bestIndex] = 1;
      stack.push([start, bestIndex], [bestIndex, end]);
    }
  }
  return pts.filter((_, index) => keep[index]);
}

function chaikinClosed(pts: Array<{ x: number; y: number }>, rounds: number): Array<{ x: number; y: number }> {
  let current = pts;
  for (let round = 0; round < rounds; round++) {
    if (current.length < 4) break;
    const next: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < current.length; i++) {
      const a = current[i];
      const b = current[(i + 1) % current.length];
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    current = next;
  }
  return current;
}

function adaptivelySimplify(ring: number[], simplify: number, chaikinRounds: number): number[] {
  const bounds = ringBounds(ring);
  const size = Math.max(bounds.w, bounds.h);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < ring.length; i += 2) pts.push({ x: ring[i], y: ring[i + 1] });
  if (size < 14 || pts.length < 16) {
    const out: number[] = [];
    for (const point of pts) out.push(point.x, point.y);
    return out;
  }
  const epsilon = size < 36 ? simplify * 0.28 : simplify;
  let kept = douglasPeuckerClosed(pts, epsilon);
  if (chaikinRounds > 0 && size >= 70 && kept.length >= 20) kept = chaikinClosed(kept, 1);
  const out: number[] = [];
  for (const point of kept) out.push(point.x, point.y);
  return out.length >= 6 ? out : ring;
}

function scaleRing(ring: number[], scale: number): number[] {
  const out = new Array(ring.length);
  for (let i = 0; i < ring.length; i++) out[i] = ring[i] * scale;
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

function ringArea(ring: number[]): number {
  let area = 0;
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
  }
  return Math.abs(area) / 2;
}

function ringsToBezierSvg(rings: number[][], width: number, height: number, fitError: number): { svg: string; flats: number[][] } {
  const flats: number[][] = [];
  const paths = rings
    .filter((ring) => ring.length >= 8 && ringArea(ring) >= 6)
    .map((ring) => {
      const cubics = fitClosedRing(ring, fitError);
      if (cubics.length) {
        flats.push(flattenCubics(cubics, 10));
        return cubicsToPath(cubics);
      }
      flats.push(ring);
      let path = `M${ring[0].toFixed(2)} ${ring[1].toFixed(2)}`;
      for (let i = 2; i < ring.length; i += 2) path += `L${ring[i].toFixed(2)} ${ring[i + 1].toFixed(2)}`;
      return `${path}Z`;
    });
  if (!paths.length) return { svg: '', flats };
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path d="${paths.join('')}" fill="#111111" fill-rule="evenodd" stroke="none"/></svg>`,
    flats,
  };
}

function rasterFromRings(
  rings: number[][],
  width: number,
  height: number,
  scale: number,
  background: 'white' | 'transparent'
): PixelBuffer {
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));
  const ink = new Uint8Array(outW * outH);
  fillRingsEvenOdd(
    ink,
    outW,
    outH,
    rings.map((ring) => scaleRing(ring, scale))
  );
  const data = new Uint8ClampedArray(outW * outH * 4);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (ink[p]) {
      data[i] = 17;
      data[i + 1] = 17;
      data[i + 2] = 17;
      data[i + 3] = 255;
    } else if (background === 'white') {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    }
  }
  return { data, width: outW, height: outH };
}

export function svgHasFillStroke(svg: string): boolean {
  return /stroke\s*=\s*["'](?!none)[^"']+["']/i.test(svg) || /stroke-width\s*=\s*["'](?!0(?:\.0+)?["'])/i.test(svg);
}

export function vectorizeColoringPage(src: PixelBuffer, options: FaithfulTraceOptions = {}): FaithfulTraceResult {
  const mode = options.mode ?? 'hybrid';
  if (mode !== 'contour') {
    return vectorizeHybridLineArt(src, {
      threshold: options.threshold ?? 168,
      fitError: options.fitError ?? 0.55,
      upscale: options.upscale ?? 2,
      forceStrokes: mode === 'centerline',
    });
  }
  const threshold = options.threshold ?? 168;
  const fitError = options.fitError ?? Math.max(0.45, (options.simplify ?? 0.12) * 6);
  const upscale = chooseTraceScale(src.width, src.height, options.upscale ?? 4);
  const hi = bilinearLuminance(src, upscale);
  const hiRings = isoRings(hi.lum, hi.width, hi.height, threshold);
  const srcRings = hiRings.map((ring) => scaleRing(ring, 1 / upscale));
  const { svg, flats } = ringsToBezierSvg(srcRings, src.width, src.height, Math.max(0.28, fitError));
  const previewScale = Math.min(4, Math.max(2, Math.floor(2400 / Math.max(src.width, src.height))));
  return {
    svg,
    preview: rasterFromRings(flats, src.width, src.height, previewScale, 'white'),
    proof: rasterFromRings(flats, src.width, src.height, 1, 'white'),
  };
}

function downsampleMaskToBuffer(
  mask: Uint8Array,
  width: number,
  height: number,
  scale: number,
  outW: number,
  outH: number
): PixelBuffer {
  const data = new Uint8ClampedArray(outW * outH * 4);
  const need = Math.max(1, Math.floor((scale * scale) / 2));
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      let ink = 0;
      for (let sy = 0; sy < scale; sy++) {
        const yy = y * scale + sy;
        if (yy >= height) continue;
        for (let sx = 0; sx < scale; sx++) {
          const xx = x * scale + sx;
          if (xx < width && mask[yy * width + xx]) ink += 1;
        }
      }
      const i = (y * outW + x) * 4;
      if (ink >= need) {
        data[i] = 17;
        data[i + 1] = 17;
        data[i + 2] = 17;
        data[i + 3] = 255;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }
  }
  return { data, width: outW, height: outH };
}
