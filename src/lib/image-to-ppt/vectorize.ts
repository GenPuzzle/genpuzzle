import type { PixelRect, RgbColor } from './types';
import { clamp, rgbToHex } from './geometry';
import { isInkPixel } from './background';

type Point = { x: number; y: number };

export type GraphicRole = 'frame' | 'art' | 'fill';

function dominantFill(imageData: ImageData, mask: Uint8Array, bbox: PixelRect, background: RgbColor): string {
  const buckets = new Map<string, number>();
  const { data, width } = imageData;
  for (let y = bbox.y; y < bbox.y + bbox.height; y++) {
    for (let x = bbox.x; x < bbox.x + bbox.width; x++) {
      const i = y * width + x;
      if (!mask[i]) continue;
      const p = i * 4;
      const key = `${data[p] >> 4}-${data[p + 1] >> 4}-${data[p + 2] >> 4}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
  }
  let best = '';
  let bestCount = 0;
  for (const [key, count] of buckets) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  if (!best) return '#111111';
  const [r, g, b] = best.split('-').map((n) => Number(n) * 16 + 8);
  if (!isInkPixel(r, g, b, 255, background, 18)) return '#111111';
  return rgbToHex({ r, g, b });
}

function traceContour(mask: Uint8Array, width: number, height: number, startX: number, startY: number): Point[] {
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];
  const points: Point[] = [];
  let x = startX;
  let y = startY;
  let dir = 0;
  const seen = new Set<string>();
  for (let step = 0; step < width * height; step++) {
    const key = `${x},${y},${dir}`;
    if (seen.has(key)) break;
    seen.add(key);
    points.push({ x, y });
    let found = false;
    for (let i = 0; i < 8; i++) {
      const idx = (dir + 6 + i) % 8;
      const nx = x + dirs[idx][0];
      const ny = y + dirs[idx][1];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (!mask[ny * width + nx]) continue;
      x = nx;
      y = ny;
      dir = idx;
      found = true;
      break;
    }
    if (!found) break;
    if (x === startX && y === startY && points.length > 8) break;
  }
  return points;
}

function pointDist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rdp(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  const lineLen = Math.max(0.0001, pointDist(first, last));
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const area = Math.abs(
      (last.x - first.x) * (first.y - p.y) - (first.x - p.x) * (last.y - first.y)
    );
    const dist = area / lineLen;
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}

function pathFromPoints(points: Point[], offsetX: number, offsetY: number, close: boolean): string {
  if (points.length < 3) return '';
  const simplified = rdp(points, 1.15);
  if (simplified.length < 3) return '';
  let d = `M${(simplified[0].x - offsetX).toFixed(1)} ${(simplified[0].y - offsetY).toFixed(1)}`;
  for (let i = 1; i < simplified.length; i++) {
    d += `L${(simplified[i].x - offsetX).toFixed(1)} ${(simplified[i].y - offsetY).toFixed(1)}`;
  }
  return close ? `${d}Z` : d;
}

function estimateLocalStrokeWidth(mask: Uint8Array, width: number, height: number): number {
  const runs: number[] = [];
  const consider = (run: number) => {
    if (run >= 1 && run <= 5) runs.push(run);
  };
  for (let y = 0; y < height; y += 2) {
    let run = 0;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) run += 1;
      else {
        consider(run);
        run = 0;
      }
    }
    consider(run);
  }
  for (let x = 0; x < width; x += 2) {
    let run = 0;
    for (let y = 0; y < height; y++) {
      if (mask[y * width + x]) run += 1;
      else {
        consider(run);
        run = 0;
      }
    }
    consider(run);
  }
  if (!runs.length) return 1.6;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

export function analyzeRegionShape(
  mask: Uint8Array,
  width: number,
  height: number,
  inkCount: number
): { role: GraphicRole; fillRatio: number; interiorFillRatio: number; borderInkRatio: number; strokeWidth: number } {
  const area = Math.max(1, width * height);
  const fillRatio = inkCount / area;
  const insetX = Math.max(2, Math.floor(width * 0.18));
  const insetY = Math.max(2, Math.floor(height * 0.18));
  let interiorInk = 0;
  let interiorArea = 0;
  for (let y = insetY; y < height - insetY; y++) {
    for (let x = insetX; x < width - insetX; x++) {
      interiorArea += 1;
      if (mask[y * width + x]) interiorInk += 1;
    }
  }
  const interiorFillRatio = interiorInk / Math.max(1, interiorArea);
  const band = Math.max(2, Math.round(Math.min(width, height) * 0.08));
  let borderInk = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < band || y < band || x >= width - band || y >= height - band) borderInk += 1;
    }
  }
  const borderInkRatio = borderInk / Math.max(1, inkCount);
  const strokeWidth = estimateLocalStrokeWidth(mask, width, height);

  let role: GraphicRole = 'art';
  const thinStroke = strokeWidth <= 4.5;
  if (!thinStroke && fillRatio > 0.55 && interiorFillRatio > 0.48) role = 'fill';
  else if (borderInkRatio > 0.68 && interiorFillRatio < 0.14 && fillRatio < 0.34) role = 'frame';
  else role = 'art';
  return { role, fillRatio, interiorFillRatio, borderInkRatio, strokeWidth };
}

function colorDistanceInt(r: number, g: number, b: number, background: RgbColor): number {
  const dr = r - background.r;
  const dg = g - background.g;
  const db = b - background.b;
  return Math.min(255, Math.round(Math.sqrt(dr * dr + dg * dg + db * db)));
}

function otsuThreshold(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

function binarizeRegion(
  imageData: ImageData,
  x0: number,
  y0: number,
  w: number,
  h: number,
  background: RgbColor
): { mask: Uint8Array; inkCount: number } {
  const { data, width } = imageData;
  const distances = new Uint8Array(w * h);
  const hist = new Uint32Array(256);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = ((y0 + y) * width + (x0 + x)) * 4;
      const dist = data[p + 3] < 40 ? 0 : colorDistanceInt(data[p], data[p + 1], data[p + 2], background);
      distances[y * w + x] = dist;
      hist[dist] += 1;
    }
  }
  const otsu = otsuThreshold(hist, w * h);
  const threshold = clamp(Math.max(otsu, 78), 78, 160);
  const mask = new Uint8Array(w * h);
  let inkCount = 0;
  for (let i = 0; i < distances.length; i++) {
    if (distances[i] >= threshold) {
      mask[i] = 1;
      inkCount += 1;
    }
  }
  return { mask, inkCount };
}

function maskToScanlinePath(mask: Uint8Array, width: number, height: number): string {
  const parts: string[] = [];
  let openX = -1;
  let openY = -1;
  let openW = 0;
  let openH = 0;
  const flush = () => {
    if (openX < 0) return;
    parts.push(`M${openX} ${openY}h${openW}v${openH}h-${openW}z`);
    openX = -1;
  };
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      while (x < width && !mask[y * width + x]) x += 1;
      const x0 = x;
      while (x < width && mask[y * width + x]) x += 1;
      if (x <= x0) continue;
      const runW = x - x0;
      if (openX === x0 && openW === runW && openY + openH === y) {
        openH += 1;
      } else {
        flush();
        openX = x0;
        openY = y;
        openW = runW;
        openH = 1;
      }
    }
  }
  flush();
  return parts.join('');
}

function wrapSvg(w: number, h: number, fillHex: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="${fillHex}" fill-rule="evenodd" stroke="none">${body}</svg>`;
}

export function vectorizeRegion(
  imageData: ImageData,
  bbox: PixelRect,
  background: RgbColor
): { svg: string; fillHex: string; role: GraphicRole } | null {
  const pad = 2;
  const x0 = Math.max(0, Math.floor(bbox.x) - pad);
  const y0 = Math.max(0, Math.floor(bbox.y) - pad);
  const x1 = Math.min(imageData.width, Math.ceil(bbox.x + bbox.width) + pad);
  const y1 = Math.min(imageData.height, Math.ceil(bbox.y + bbox.height) + pad);
  const w = Math.max(1, x1 - x0);
  const h = Math.max(1, y1 - y0);
  const { mask, inkCount } = binarizeRegion(imageData, x0, y0, w, h, background);
  if (inkCount < 8) return null;

  const shape = analyzeRegionShape(mask, w, h, inkCount);
  const fullMask = new Uint8Array(imageData.width * imageData.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x]) fullMask[(y0 + y) * imageData.width + (x0 + x)] = 1;
    }
  }
  const fillHex = dominantFill(
    imageData,
    fullMask,
    { x: x0, y: y0, width: w, height: h },
    background
  );
  const stroke = clamp(Math.round(shape.strokeWidth * 10) / 10, 1.1, 3.2);

  if (shape.role === 'frame') {
    const inset = stroke / 2;
    const rx = Math.min(w, h) * 0.14;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none"><rect x="${inset.toFixed(1)}" y="${inset.toFixed(1)}" width="${Math.max(1, w - stroke).toFixed(1)}" height="${Math.max(1, h - stroke).toFixed(1)}" rx="${rx.toFixed(1)}" ry="${rx.toFixed(1)}" stroke="${fillHex}" stroke-width="${stroke}" fill="none"/></svg>`;
    return { svg, fillHex, role: 'frame' };
  }

  if (shape.role === 'fill') {
    const startsVisited = new Uint8Array(w * h);
    const paths: string[] = [];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!mask[i] || startsVisited[i]) continue;
        const up = mask[i - w];
        const left = mask[i - 1];
        if (up && left) continue;
        const contour = traceContour(mask, w, h, x, y);
        for (const point of contour) startsVisited[point.y * w + point.x] = 1;
        const d = pathFromPoints(
          contour.map((pt) => ({ x: pt.x + x0, y: pt.y + y0 })),
          x0,
          y0,
          true
        );
        if (d) paths.push(d);
      }
    }
    if (paths.length > 0) {
      return {
        svg: wrapSvg(w, h, fillHex, paths.map((d) => `<path d="${d}"/>`).join('')),
        fillHex,
        role: 'fill',
      };
    }
  }

  const scanline = maskToScanlinePath(mask, w, h);
  if (!scanline) return null;
  return {
    svg: wrapSvg(w, h, fillHex, `<path d="${scanline}"/>`),
    fillHex,
    role: 'art',
  };
}

export function regionLooksPhotographic(
  imageData: ImageData,
  bbox: PixelRect,
  background: RgbColor
): boolean {
  const { data, width } = imageData;
  let ink = 0;
  let colorful = 0;
  const chromaKeys = new Set<string>();
  const step = Math.max(1, Math.floor(Math.min(bbox.width, bbox.height) / 28));
  for (let y = bbox.y; y < bbox.y + bbox.height; y += step) {
    for (let x = bbox.x; x < bbox.x + bbox.width; x += step) {
      const p = (y * width + x) * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      if (!isInkPixel(r, g, b, data[p + 3], background, 28)) continue;
      ink += 1;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      if (chroma > 42) {
        colorful += 1;
        chromaKeys.add(`${r >> 4}-${g >> 4}-${b >> 4}`);
      }
    }
  }
  return ink > 80 && colorful > 50 && chromaKeys.size > 10 && colorful / ink > 0.28;
}
