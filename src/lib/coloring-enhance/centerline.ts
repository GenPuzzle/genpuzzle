import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import { collapseRasterStairs, cubicsToPath, fitClosedRing, fitOpenPolyline, flattenCubics, type Point } from './bezier-fit';
import { bilinearLuminance, extractInkMask, maskFromLuminance, maskToBuffer } from './ink';

export interface HybridTraceResult {
  svg: string;
  preview: PixelBuffer;
  proof: PixelBuffer;
}

export interface HybridTraceOptions {
  threshold?: number;
  forceStrokes?: boolean;
  upscale?: number;
  fitError?: number;
}

const N8: Array<[number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

function neighbors8(mask: Uint8Array, width: number, height: number, x: number, y: number): number[] {
  const out: number[] = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const np = ny * width + nx;
    if (mask[np]) out.push(np);
  }
  return out;
}

export function distanceTransform(ink: Uint8Array, width: number, height: number): Float32Array {
  const inf = width + height;
  const dist = new Float32Array(ink.length);
  for (let i = 0; i < ink.length; i++) dist[i] = ink[i] ? inf : 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      let best = dist[p];
      if (x > 0) best = Math.min(best, dist[p - 1] + 1);
      if (y > 0) best = Math.min(best, dist[p - width] + 1);
      if (x > 0 && y > 0) best = Math.min(best, dist[p - width - 1] + Math.SQRT2);
      if (x + 1 < width && y > 0) best = Math.min(best, dist[p - width + 1] + Math.SQRT2);
      dist[p] = best;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (!ink[p]) continue;
      let best = dist[p];
      if (x + 1 < width) best = Math.min(best, dist[p + 1] + 1);
      if (y + 1 < height) best = Math.min(best, dist[p + width] + 1);
      if (x + 1 < width && y + 1 < height) best = Math.min(best, dist[p + width + 1] + Math.SQRT2);
      if (x > 0 && y + 1 < height) best = Math.min(best, dist[p + width - 1] + Math.SQRT2);
      dist[p] = best;
    }
  }
  return dist;
}

function thinInk(ink: Uint8Array, width: number, height: number): Uint8Array {
  const work = new Uint8Array(ink);
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && work[y * width + x] === 1;
  const pass = (first: boolean): boolean => {
    const remove: number[] = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (!at(x, y)) continue;
        const p2 = at(x, y - 1) ? 1 : 0;
        const p3 = at(x + 1, y - 1) ? 1 : 0;
        const p4 = at(x + 1, y) ? 1 : 0;
        const p5 = at(x + 1, y + 1) ? 1 : 0;
        const p6 = at(x, y + 1) ? 1 : 0;
        const p7 = at(x - 1, y + 1) ? 1 : 0;
        const p8 = at(x - 1, y) ? 1 : 0;
        const p9 = at(x - 1, y - 1) ? 1 : 0;
        const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
        if (n < 2 || n > 6) continue;
        const t =
          (p2 === 0 && p3 === 1 ? 1 : 0) +
          (p3 === 0 && p4 === 1 ? 1 : 0) +
          (p4 === 0 && p5 === 1 ? 1 : 0) +
          (p5 === 0 && p6 === 1 ? 1 : 0) +
          (p6 === 0 && p7 === 1 ? 1 : 0) +
          (p7 === 0 && p8 === 1 ? 1 : 0) +
          (p8 === 0 && p9 === 1 ? 1 : 0) +
          (p9 === 0 && p2 === 1 ? 1 : 0);
        if (t !== 1) continue;
        if (first) {
          if (p2 && p4 && p6) continue;
          if (p4 && p6 && p8) continue;
        } else {
          if (p2 && p4 && p8) continue;
          if (p2 && p6 && p8) continue;
        }
        remove.push(y * width + x);
      }
    }
    for (const p of remove) work[p] = 0;
    return remove.length > 0;
  };
  let guard = 0;
  while (guard < 48 && (pass(true) || pass(false))) guard += 1;
  return work;
}

function extractPolylines(skel: Uint8Array, width: number, height: number): number[][] {
  const used = new Uint8Array(skel.length);
  const degree = (p: number) => {
    const x = p % width;
    const y = (p / width) | 0;
    return neighbors8(skel, width, height, x, y).length;
  };
  const lines: number[][] = [];
  const walk = (start: number, firstPrev = -1) => {
    const line: number[] = [];
    let current = start;
    let prev = firstPrev;
    for (let step = 0; step < skel.length; step++) {
      const x = current % width;
      const y = (current / width) | 0;
      line.push(x + 0.5, y + 0.5);
      const deg = degree(current);
      const nexts = neighbors8(skel, width, height, x, y).filter((p) => p !== prev);
      if (current !== start) used[current] = 1;
      if (!nexts.length) break;
      if (deg >= 3 && line.length > 2) break;
      const unused = nexts.find((p) => !used[p] && degree(p) < 3) ?? nexts.find((p) => !used[p]) ?? nexts[0];
      prev = current;
      current = unused;
      if (current === start) break;
    }
    if (line.length >= 4) lines.push(line);
  };
  for (let p = 0; p < skel.length; p++) {
    if (!skel[p] || used[p]) continue;
    if (degree(p) === 1) walk(p);
  }
  for (let p = 0; p < skel.length; p++) {
    if (!skel[p]) continue;
    if (degree(p) >= 3) {
      const x = p % width;
      const y = (p / width) | 0;
      for (const n of neighbors8(skel, width, height, x, y)) {
        if (used[n]) continue;
        walk(n, p);
      }
    }
  }
  for (let p = 0; p < skel.length; p++) {
    if (!skel[p] || used[p]) continue;
    walk(p);
  }
  return lines;
}

function mergePolylines(lines: number[][]): number[][] {
  const remaining = lines.filter((line) => line.length >= 4);
  const merged: number[][] = [];
  while (remaining.length) {
    let current = remaining.shift()!;
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const other = remaining[i];
        const ends = [
          [current[0], current[1], other[0], other[1], 'rev-prepend'] as const,
          [current[0], current[1], other[other.length - 2], other[other.length - 1], 'prepend'] as const,
          [current[current.length - 2], current[current.length - 1], other[0], other[1], 'append'] as const,
          [current[current.length - 2], current[current.length - 1], other[other.length - 2], other[other.length - 1], 'rev-append'] as const,
        ];
        const hit = ends.find((item) => Math.hypot(item[0] - item[2], item[1] - item[3]) < 1.8);
        if (!hit) continue;
        const copy = other.slice();
        if (hit[4] === 'rev-prepend' || hit[4] === 'rev-append') {
          const rev: number[] = [];
          for (let p = copy.length - 2; p >= 0; p -= 2) rev.push(copy[p], copy[p + 1]);
          if (hit[4] === 'rev-prepend') current = rev.concat(current);
          else current = current.concat(rev);
        } else if (hit[4] === 'prepend') current = copy.concat(current);
        else current = current.concat(copy);
        remaining.splice(i, 1);
        changed = true;
        break;
      }
    }
    merged.push(current);
  }
  return merged;
}

function splitSharpTurns(lines: number[][]): number[][] {
  const out: number[][] = [];
  for (const line of lines) {
    const count = line.length / 2;
    if (count < 4) {
      if (line.length >= 4) out.push(line);
      continue;
    }
    let start = 0;
    for (let i = 1; i < count - 1; i++) {
      const ax = line[(i - 1) * 2];
      const ay = line[(i - 1) * 2 + 1];
      const bx = line[i * 2];
      const by = line[i * 2 + 1];
      const cx = line[(i + 1) * 2];
      const cy = line[(i + 1) * 2 + 1];
      const ux = bx - ax;
      const uy = by - ay;
      const vx = cx - bx;
      const vy = cy - by;
      const ul = Math.hypot(ux, uy) || 1;
      const vl = Math.hypot(vx, vy) || 1;
      const angle = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (ul * vl)))) * 180) / Math.PI;
      if (angle >= 78) {
        const piece = line.slice(start * 2, (i + 1) * 2);
        if (piece.length >= 4) out.push(piece);
        start = i;
      }
    }
    const tail = line.slice(start * 2);
    if (tail.length >= 4) out.push(tail);
  }
  return out;
}

function labeledComponents(mask: Uint8Array, width: number, height: number): Array<{ area: number; pixels: number[] }> {
  const labels = new Int32Array(mask.length);
  const parts: Array<{ area: number; pixels: number[] }> = [];
  const stack = new Int32Array(mask.length);
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    let sp = 0;
    let area = 0;
    const pixels: number[] = [];
    stack[sp++] = start;
    labels[start] = next;
    while (sp > 0) {
      const p = stack[--sp];
      area += 1;
      pixels.push(p);
      const x = p % width;
      const y = (p / width) | 0;
      for (const np of neighbors8(mask, width, height, x, y)) {
        if (labels[np]) continue;
        labels[np] = next;
        stack[sp++] = np;
      }
    }
    if (area >= 2) parts.push({ area, pixels });
    next += 1;
  }
  return parts;
}

function isSolidBlob(part: { area: number; pixels: number[] }, dist: Float32Array, width: number, forceStrokes: boolean): boolean {
  if (forceStrokes) return false;
  let widthSum = 0;
  let minX = width;
  let minY = 1e9;
  let maxX = 0;
  let maxY = 0;
  for (const p of part.pixels) {
    widthSum += dist[p] * 2;
    const x = p % width;
    const y = (p / width) | 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  const meanW = widthSum / Math.max(1, part.pixels.length);
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const fill = part.area / Math.max(1, bw * bh);
  const compact = Math.max(bw, bh) < meanW * 3.4;
  return meanW >= 6 && fill > 0.55 && compact && Math.min(bw, bh) >= 6;
}

function radiusFromDist(dist: number): number {
  return Math.max(0.9, dist - 0.5);
}

function sampleWidths(line: number[], dist: Float32Array, width: number, height: number): number[] {
  const radii: number[] = [];
  for (let i = 0; i < line.length; i += 2) {
    const x = Math.max(0, Math.min(width - 1, Math.round(line[i] - 0.5)));
    const y = Math.max(0, Math.min(height - 1, Math.round(line[i + 1] - 0.5)));
    radii.push(radiusFromDist(dist[y * width + x]));
  }
  for (let i = 0; i < radii.length; i++) {
    const a = radii[Math.max(0, i - 1)];
    const b = radii[i];
    const c = radii[Math.min(radii.length - 1, i + 1)];
    radii[i] = a * 0.2 + b * 0.6 + c * 0.2;
  }
  return radii;
}

function resampleRadii(radii: number[], fromCount: number, toCount: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < toCount; i++) {
    const t = fromCount <= 1 ? 0 : (i * (fromCount - 1)) / Math.max(1, toCount - 1);
    const a = Math.floor(t);
    const b = Math.min(fromCount - 1, a + 1);
    const u = t - a;
    out.push(radii[a] * (1 - u) + radii[b] * u);
  }
  return out;
}

function isClosedLine(line: number[]): boolean {
  return Math.hypot(line[0] - line[line.length - 2], line[1] - line[line.length - 1]) < 2.2;
}

function inkRadius(
  x: number,
  y: number,
  nx: number,
  ny: number,
  start: number,
  ink: Uint8Array,
  width: number,
  height: number
): number {
  let r = 0.5;
  const limit = start + 0.35;
  while (r <= limit) {
    const ix = Math.round(x + nx * r);
    const iy = Math.round(y + ny * r);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height || !ink[iy * width + ix]) {
      return Math.max(0.55, r - 0.45);
    }
    r += 0.25;
  }
  return start;
}

function offsetRibbon(line: number[], radii: number[], ink: Uint8Array, width: number, height: number): number[] {
  const left: Point[] = [];
  const right: Point[] = [];
  const count = line.length / 2;
  const closed = isClosedLine(line);
  for (let i = 0; i < count; i++) {
    const prevIndex = closed ? (i - 1 + count) % count : Math.max(0, i - 1);
    const nextIndex = closed ? (i + 1) % count : Math.min(count - 1, i + 1);
    const prev = { x: line[prevIndex * 2], y: line[prevIndex * 2 + 1] };
    const next = { x: line[nextIndex * 2], y: line[nextIndex * 2 + 1] };
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const px = line[i * 2];
    const py = line[i * 2 + 1];
    const rl = radii[i] >= 1.6 ? inkRadius(px, py, -ty, tx, radii[i], ink, width, height) : radii[i];
    const rr = radii[i] >= 1.6 ? inkRadius(px, py, ty, -tx, radii[i], ink, width, height) : radii[i];
    left.push({ x: px - ty * rl, y: py + tx * rl });
    right.push({ x: px + ty * rr, y: py - tx * rr });
  }
  const ring: number[] = [];
  for (const point of left) ring.push(point.x, point.y);
  for (let i = right.length - 1; i >= 0; i--) ring.push(right[i].x, right[i].y);
  return ring;
}

function fillOneRing(mask: Uint8Array, width: number, height: number, ring: number[]): void {
  if (ring.length < 6) return;
  let minY = height;
  let maxY = 0;
  for (let i = 1; i < ring.length; i += 2) {
    minY = Math.min(minY, ring[i]);
    maxY = Math.max(maxY, ring[i]);
  }
  const n = ring.length / 2;
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(height - 1, Math.ceil(maxY)); y++) {
    const scan = y + 0.5;
    const hits: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const y1 = ring[i * 2 + 1];
      const y2 = ring[j * 2 + 1];
      if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
        const t = (scan - y1) / (y2 - y1 || 1e-9);
        hits.push(ring[i * 2] + t * (ring[j * 2] - ring[i * 2]));
      }
    }
    hits.sort((a, b) => a - b);
    const row = y * width;
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const from = Math.max(0, Math.floor(hits[i]));
      const to = Math.min(width, Math.ceil(hits[i + 1]));
      for (let x = from; x < to; x++) mask[row + x] = 1;
    }
  }
}

function polyPath(ring: number[]): string {
  let d = `M${ring[0].toFixed(2)} ${ring[1].toFixed(2)}`;
  for (let i = 2; i < ring.length; i += 2) d += `L${ring[i].toFixed(2)} ${ring[i + 1].toFixed(2)}`;
  return `${d}Z`;
}

function lerpEdge(x0: number, y0: number, v0: number, x1: number, y1: number, v1: number, threshold: number): { x: number; y: number } {
  const t = (threshold - v0) / ((v1 - v0) || 1e-6);
  const u = Math.max(0, Math.min(1, t));
  return { x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u };
}

function isoRingsFromLum(lum: Float32Array, width: number, height: number, threshold: number): number[][] {
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
          add(bottom(), left());
          break;
        default:
          break;
      }
    }
  }
  const rings: number[][] = [];
  const used = new Uint8Array(segments.length);
  const key = (p: { x: number; y: number }) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  const starts = new Map<string, number[]>();
  segments.forEach((seg, index) => {
    const k = key(seg[0]);
    const list = starts.get(k) ?? [];
    list.push(index);
    starts.set(k, list);
  });
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    const ringPts: Array<{ x: number; y: number }> = [segments[i][0], segments[i][1]];
    used[i] = 1;
    for (let step = 0; step < segments.length; step++) {
      const last = ringPts[ringPts.length - 1];
      const options = starts.get(key(last)) ?? [];
      const next = options.find((index) => !used[index]);
      if (next == null) break;
      used[next] = 1;
      ringPts.push(segments[next][1]);
      if (key(segments[next][1]) === key(ringPts[0])) break;
    }
    if (ringPts.length >= 4) {
      const ring: number[] = [];
      for (const p of ringPts) ring.push(p.x + 0.5, p.y + 0.5);
      rings.push(ring);
    }
  }
  return rings;
}

function ringsFromMask(mask: Uint8Array, width: number, height: number): number[][] {
  const lum = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) lum[i] = mask[i] ? 0 : 255;
  return isoRingsFromLum(lum, width, height, 128).filter((ring) => ringArea(ring) >= 8);
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

function pathFromRing(ring: number[], fitError: number): { d: string; flat: number[] } | null {
  const cubics = fitClosedRing(ring, fitError);
  if (cubics.length) return { d: cubicsToPath(cubics), flat: flattenCubics(cubics, 8) };
  if (ring.length >= 6) return { d: polyPath(ring), flat: ring };
  return null;
}

function ribbonFromCenterline(
  line: number[],
  dist: Float32Array,
  ink: Uint8Array,
  width: number,
  height: number,
  fitError: number
): { d: string; flat: number[] } | null {
  const radii = sampleWidths(line, dist, width, height);
  const pts: Point[] = [];
  for (let i = 0; i < line.length; i += 2) pts.push({ x: line[i], y: line[i + 1] });
  const cubics = fitOpenPolyline(pts, Math.max(0.35, fitError));
  const sampled = cubics.length ? flattenCubics(cubics, 6) : line;
  const sampledR = resampleRadii(radii, line.length / 2, sampled.length / 2);
  const ribbon = offsetRibbon(sampled, sampledR, ink, width, height);
  if (ribbon.length < 6) return null;
  const half = Math.floor(ribbon.length / 4) * 2;
  const leftPts = collapseRasterStairs(ribbon.slice(0, half));
  const rightPts = collapseRasterStairs(ribbon.slice(half));
  const leftC = fitOpenPolyline(leftPts, 0.65);
  const rightC = fitOpenPolyline(rightPts, 0.65);
  if (leftC.length && rightC.length) return { d: cubicsToPath([...leftC, ...rightC]), flat: ribbon };
  return { d: polyPath(ribbon), flat: ribbon };
}

export function vectorizeHybridLineArt(src: PixelBuffer, options: HybridTraceOptions = {}): HybridTraceResult {
  const threshold = options.threshold ?? 168;
  const fitError = options.fitError ?? 0.55;
  const requested = options.upscale ?? 1;
  const longSide = Math.max(src.width, src.height);
  const scale = longSide * Math.max(1, requested) > 1600 ? 1 : Math.max(1, Math.min(2, requested));
  const hi = scale > 1 ? bilinearLuminance(src, scale) : null;
  const ink = hi ? maskFromLuminance(hi.lum, threshold) : extractInkMask(src, threshold);
  const width = hi?.width ?? src.width;
  const height = hi?.height ?? src.height;
  const dist = distanceTransform(ink, width, height);
  const parts = labeledComponents(ink, width, height);
  const pieces: Array<{ d: string; flat: number[] }> = [];

  for (const part of parts) {
    const local = new Uint8Array(ink.length);
    for (const p of part.pixels) local[p] = 1;
    if (isSolidBlob(part, dist, width, Boolean(options.forceStrokes))) {
      for (const ring of ringsFromMask(local, width, height)) {
        const fitted = pathFromRing(ring, fitError);
        if (!fitted) continue;
        pieces.push(fitted);
      }
      continue;
    }
    const skel = thinInk(local, width, height);
    const lines = splitSharpTurns(
      mergePolylines(extractPolylines(skel, width, height)).map((line) => {
        const pts = collapseRasterStairs(line);
        const out: number[] = [];
        for (const point of pts) out.push(point.x, point.y);
        return out.length >= 4 ? out : line;
      })
    );
    for (const line of lines) {
      if (line.length < 6) continue;
      const fitted = ribbonFromCenterline(line, dist, local, width, height, fitError);
      if (!fitted || ringArea(fitted.flat) < 4) continue;
      pieces.push(fitted);
    }
  }

  const inv = 1 / scale;
  const srcFlats = pieces.map((piece) => piece.flat.map((value) => value * inv));
  const srcPaths = pieces
    .map((piece, index) => {
      if (ringArea(srcFlats[index]) < 4) return '';
      if (scale === 1) return piece.d;
      return polyPath(srcFlats[index]);
    })
    .filter((d): d is string => Boolean(d));
  const svg = srcPaths.length
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${src.width} ${src.height}">${srcPaths
        .map((d) => `<path d="${d}" fill="#111111" fill-rule="nonzero" stroke="none"/>`)
        .join('')}</svg>`
    : '';
  const proofMask = new Uint8Array(src.width * src.height);
  for (const ring of srcFlats) fillOneRing(proofMask, src.width, src.height, ring);
  const previewScale = Math.min(4, Math.max(2, Math.round(1800 / Math.max(src.width, src.height))));
  const previewMask = new Uint8Array(src.width * previewScale * src.height * previewScale);
  for (const ring of srcFlats) {
    fillOneRing(
      previewMask,
      src.width * previewScale,
      src.height * previewScale,
      ring.map((value) => value * previewScale)
    );
  }
  return {
    svg,
    preview: maskToBuffer(previewMask, src.width * previewScale, src.height * previewScale),
    proof: maskToBuffer(proofMask, src.width, src.height),
  };
}

export function differenceOverlay(source: PixelBuffer, enhanced: PixelBuffer): PixelBuffer {
  const src = extractInkMask(source, 168);
  const dest = extractInkMask(enhanced, 168);
  const width = source.width;
  const height = source.height;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sy = Math.min(enhanced.height - 1, Math.round((y * enhanced.height) / height));
      const sx = Math.min(enhanced.width - 1, Math.round((x * enhanced.width) / width));
      const s = src[y * width + x];
      const d = dest[sy * enhanced.width + sx];
      const i = (y * width + x) * 4;
      if (s && d) {
        data[i] = 34;
        data[i + 1] = 197;
        data[i + 2] = 94;
      } else if (d && !s) {
        data[i] = 239;
        data[i + 1] = 68;
        data[i + 2] = 68;
      } else if (s && !d) {
        data[i] = 37;
        data[i + 1] = 99;
        data[i + 2] = 235;
      } else {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      }
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

export function negativeSpaceOverlay(source: PixelBuffer): PixelBuffer {
  const ink = extractInkMask(source, 168);
  const gaps = protectedGapMask(ink, source.width, source.height);
  const data = new Uint8ClampedArray(source.width * source.height * 4);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (gaps[p]) {
      data[i] = 250;
      data[i + 1] = 204;
      data[i + 2] = 21;
    } else if (ink[p]) {
      data[i] = 30;
      data[i + 1] = 30;
      data[i + 2] = 30;
    } else {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
    data[i + 3] = 255;
  }
  return { data, width: source.width, height: source.height };
}

export function protectedGapMask(ink: Uint8Array, width: number, height: number): Uint8Array {
  const gaps = new Uint8Array(ink.length);
  for (const gap of findGapRuns(ink, width, height)) {
    if (gap.axis === 'h') {
      for (let x = gap.a; x <= gap.b; x++) gaps[gap.pos * width + x] = 1;
    } else {
      for (let y = gap.a; y <= gap.b; y++) gaps[y * width + gap.pos] = 1;
    }
  }
  return gaps;
}

export interface GapRun {
  axis: 'h' | 'v';
  pos: number;
  a: number;
  b: number;
  width: number;
}

export function findGapRuns(ink: Uint8Array, width: number, height: number): GapRun[] {
  const runs: GapRun[] = [];
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      if (ink[y * width + x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < width && !ink[y * width + x]) x += 1;
      const run = x - start;
      if (run >= 2 && run <= 18 && start > 0 && x < width && ink[y * width + start - 1] && ink[y * width + x]) {
        runs.push({ axis: 'h', pos: y, a: start, b: x - 1, width: run });
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let y = 0;
    while (y < height) {
      if (ink[y * width + x]) {
        y += 1;
        continue;
      }
      const start = y;
      while (y < height && !ink[y * width + x]) y += 1;
      const run = y - start;
      if (run >= 2 && run <= 18 && start > 0 && y < height && ink[(start - 1) * width + x] && ink[y * width + x]) {
        runs.push({ axis: 'v', pos: x, a: start, b: y - 1, width: run });
      }
    }
  }
  return persistentGaps(runs);
}

function persistentGaps(runs: GapRun[]): GapRun[] {
  const kept: GapRun[] = [];
  const horiz = runs.filter((run) => run.axis === 'h').sort((a, b) => a.pos - b.pos || a.a - b.a);
  const stacks = new Map<string, GapRun[]>();
  for (const run of horiz) {
    const key = `${Math.round(run.a / 2)}:${Math.round(run.b / 2)}`;
    const list = stacks.get(key) ?? [];
    list.push(run);
    stacks.set(key, list);
  }
  for (const list of stacks.values()) {
    if (list.length >= 3 && list[0].width >= 2) kept.push(...list);
  }
  const vert = runs.filter((run) => run.axis === 'v');
  const vstacks = new Map<string, GapRun[]>();
  for (const run of vert) {
    const key = `${Math.round(run.a / 2)}:${Math.round(run.b / 2)}`;
    const list = vstacks.get(key) ?? [];
    list.push(run);
    vstacks.set(key, list);
  }
  for (const list of vstacks.values()) {
    if (list.length >= 3 && list[0].width >= 2) kept.push(...list);
  }
  return kept;
}
