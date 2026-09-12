/**
 * Shared sprite-sheet importer used by Murdoku character, element, and room sheets.
 *
 * Crop boxes are placed on detected images. Optional whole-sheet effects
 * (background removal, black and white) are applied to a working copy.
 */

export type SpriteSheetKind = 'characters' | 'elements' | 'rooms';

export type SpriteNormalizeMode =
  | 'original'
  | 'normalize-height'
  | 'normalize-width'
  | 'fit-square'
  | 'fit-cell'
  | 'custom';

export type SeparatorSafety = 'safe' | 'low-clearance' | 'intersects';

export type ImporterStatus =
  | 'Analyzing artwork...'
  | 'Finding crop lines...'
  | 'Creating crops...'
  | 'Ready';

export interface SpriteSheetItem {
  slotId: string;
  name: string;
}

export interface PixelBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConnectedComponent extends Rect {
  cx: number;
  cy: number;
  area: number;
}

export interface SlotCropBox {
  slotId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteSheetCropConfig {
  xs: number[];
  ys: number[];
  boxes?: SlotCropBox[];
  safetyPx: number;
  alphaThreshold: number;
  snapToTransparent: boolean;
  normalizeMode: SpriteNormalizeMode;
  customScale: number;
  bgTolerancePercent: number;
  padPercent: number;
  analysisMaxSide: number;
  removeBackground: boolean;
  grayscale: boolean;
  gridRows?: number;
  gridCols?: number;
}

export interface SlotAssetStatus {
  slotId: string;
  name: string;
  col: number;
  row: number;
  blank: boolean;
  artworkDetected: boolean;
  backgroundTransparent: boolean;
  closeToLeft: boolean;
  closeToRight: boolean;
  closeToTop: boolean;
  closeToBottom: boolean;
  intersectsCrop: boolean;
  warnings: string[];
}

export interface SeparatorStatus {
  axis: 'vertical' | 'horizontal';
  index: number;
  position: number;
  safety: SeparatorSafety;
  gutterWidth: number;
  message: string;
}

export interface OverlapWarning {
  leftId: string;
  rightId: string;
  message: string;
}

export interface AnalysisCache {
  fullWidth: number;
  fullHeight: number;
  scaleX: number;
  scaleY: number;
  maskWidth: number;
  maskHeight: number;
  /** 1 = visible artwork, 0 = transparent */
  mask: Uint8Array;
  projX: Float32Array;
  projY: Float32Array;
  components: ConnectedComponent[];
  outer: Rect;
}

export interface SmartCropResult {
  xs: number[];
  ys: number[];
  separators: SeparatorStatus[];
  slots: SlotAssetStatus[];
  overlaps: OverlapWarning[];
  hasUnsafe: boolean;
}

export const DEFAULT_CROP_CONFIG: SpriteSheetCropConfig = {
  xs: [],
  ys: [],
  boxes: [],
  safetyPx: 14,
  alphaThreshold: 24,
  snapToTransparent: true,
  normalizeMode: 'original',
  customScale: 1,
  bgTolerancePercent: 40,
  padPercent: 16,
  analysisMaxSide: 720,
  removeBackground: false,
  grayscale: false,
};

export function defaultNormalizeMode(_kind: SpriteSheetKind): SpriteNormalizeMode {
  return 'original';
}

export function clampBox(box: Rect, boundsW: number, boundsH: number, min = 16): Rect {
  const w = Math.max(min, Math.min(boundsW, box.w));
  const h = Math.max(min, Math.min(boundsH, box.h));
  const x = Math.max(0, Math.min(boundsW - w, box.x));
  const y = Math.max(0, Math.min(boundsH - h, box.y));
  return { x, y, w, h };
}

export function bgToleranceFromPercent(percent: number): number {
  const p = Math.max(0, Math.min(100, percent));
  return Math.round(8 + (p / 100) * 72);
}

export function cloneBuffer(src: PixelBuffer): PixelBuffer {
  return {
    data: new Uint8ClampedArray(src.data),
    width: src.width,
    height: src.height,
  };
}

function pixelIndex(x: number, y: number, width: number): number {
  return (y * width + x) * 4;
}

export function sampleCornerColor(
  buf: PixelBuffer,
  sampleSize = 8
): [number, number, number] {
  const { data, width, height } = buf;
  const size = Math.max(2, Math.min(sampleSize, Math.floor(Math.min(width, height) * 0.04)));
  const corners: Array<[number, number]> = [
    [0, 0],
    [width - size, 0],
    [0, height - size],
    [width - size, height - size],
  ];
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (const [sx, sy] of corners) {
    for (let y = sy; y < sy + size; y++) {
      for (let x = sx; x < sx + size; x++) {
        const i = pixelIndex(x, y, width);
        if (data[i + 3] <= 16) continue;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  }
  // Also sample a thin outer border so a single occupied corner cannot bias the key.
  const border = Math.max(1, Math.min(3, size));
  const pushPx = (x: number, y: number) => {
    const i = pixelIndex(x, y, width);
    if (data[i + 3] <= 16) return;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x += 2) {
    for (let t = 0; t < border; t++) {
      pushPx(x, t);
      pushPx(x, height - 1 - t);
    }
  }
  for (let y = 0; y < height; y += 2) {
    for (let t = 0; t < border; t++) {
      pushPx(t, y);
      pushPx(width - 1 - t, y);
    }
  }
  if (!rs.length) return [255, 255, 255];
  const median = (values: number[]) => {
    const sorted = values.slice().sort((a, b) => a - b);
    return sorted[(sorted.length / 2) | 0];
  };
  return [median(rs), median(gs), median(bs)];
}

function colorDistance(r: number, g: number, b: number, br: number, bg: number, bb: number): number {
  return Math.max(Math.abs(r - br), Math.abs(g - bg), Math.abs(b - bb));
}

export function countTransparentRatio(buf: PixelBuffer): number {
  const { data } = buf;
  let clear = 0;
  const n = data.length / 4;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] <= 12) clear += 1;
  }
  return n === 0 ? 0 : clear / n;
}

/**
 * Non-destructive background removal on a working copy.
 * Flood-fills from the edges so interior whites (eyes, shirts) stay opaque
 * unless they connect to the sampled background.
 */
export function removeBackgroundToAlpha(
  src: PixelBuffer,
  tolerancePercent = DEFAULT_CROP_CONFIG.bgTolerancePercent
): PixelBuffer {
  const buf = cloneBuffer(src);
  const { data, width, height } = buf;
  const tolerance = bgToleranceFromPercent(tolerancePercent);
  const [bgR, bgG, bgB] = sampleCornerColor(buf);

  const matchesBg = (i: number) => {
    const a = data[i + 3];
    if (a <= 12) return true;
    return colorDistance(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (visited[idx]) return;
    visited[idx] = 1;
    const i = idx * 4;
    if (!matchesBg(i)) return;
    data[i + 3] = 0;
    stack[sp++] = idx;
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
    const idx = stack[--sp];
    const x = idx % width;
    const y = (idx / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return buf;
}

export function grayscaleBuffer(src: PixelBuffer): PixelBuffer {
  const buf = cloneBuffer(src);
  const { data } = buf;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 12) continue;
    const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  return buf;
}

export function applySheetEffects(
  src: PixelBuffer,
  config: Pick<SpriteSheetCropConfig, 'removeBackground' | 'bgTolerancePercent' | 'grayscale'>
): PixelBuffer {
  let buf = src;
  if (config.removeBackground) {
    buf = removeBackgroundToAlpha(buf, config.bgTolerancePercent);
  }
  if (config.grayscale) {
    buf = grayscaleBuffer(buf);
  }
  return buf;
}

export function buildAlphaMask(buf: PixelBuffer, alphaThreshold: number): Uint8Array {
  const { data, width, height } = buf;
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 3; p < mask.length; p++, i += 4) {
    mask[p] = data[i] > alphaThreshold ? 1 : 0;
  }
  return mask;
}

/** Detect artwork without changing the image. Uses alpha when present, otherwise contrast from the sheet background. */
export function buildArtworkMask(buf: PixelBuffer, alphaThreshold: number): Uint8Array {
  if (countTransparentRatio(buf) > 0.08) return buildAlphaMask(buf, alphaThreshold);
  const { data, width, height } = buf;
  const mask = new Uint8Array(width * height);
  const [bgR, bgG, bgB] = sampleCornerColor(buf);
  const tolerance = bgToleranceFromPercent(32);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    if (data[i + 3] <= alphaThreshold) {
      mask[p] = 0;
      continue;
    }
    mask[p] = colorDistance(data[i], data[i + 1], data[i + 2], bgR, bgG, bgB) > tolerance ? 1 : 0;
  }
  return mask;
}

export function downscaleBuffer(buf: PixelBuffer, maxSide: number): PixelBuffer {
  const { width, height } = buf;
  const longest = Math.max(width, height);
  if (longest <= maxSide) return cloneBuffer(buf);
  const scale = maxSide / longest;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(height - 1, Math.floor((y + 0.5) * height / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(width - 1, Math.floor((x + 0.5) * width / w));
      const si = pixelIndex(sx, sy, width);
      const di = pixelIndex(x, y, w);
      out[di] = buf.data[si];
      out[di + 1] = buf.data[si + 1];
      out[di + 2] = buf.data[si + 2];
      out[di + 3] = buf.data[si + 3];
    }
  }
  return { data: out, width: w, height: h };
}

export function projectVisible(mask: Uint8Array, width: number, height: number): {
  projX: Float32Array;
  projY: Float32Array;
} {
  const projX = new Float32Array(width);
  const projY = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let rowCount = 0;
    for (let x = 0; x < width; x++) {
      const v = mask[row + x];
      if (v) {
        projX[x] += 1;
        rowCount += 1;
      }
    }
    projY[y] = rowCount;
  }
  return { projX, projY };
}

export function detectConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea = 8
): ConnectedComponent[] {
  const seen = new Uint8Array(mask.length);
  const comps: ConnectedComponent[] = [];
  const stack = new Int32Array(mask.length);

  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx / width) | 0;
      area += 1;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nidx = ny * width + nx;
          if (!mask[nidx] || seen[nidx]) continue;
          seen[nidx] = 1;
          stack[sp++] = nidx;
        }
      }
    }
    if (area < minArea) continue;
    comps.push({
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
      cx: sumX / area,
      cy: sumY / area,
      area,
    });
  }
  return comps;
}

export function contentBounds(mask: Uint8Array, width: number, height: number): Rect {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function padRect(rect: Rect, pad: number, boundsW: number, boundsH: number): Rect {
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  const r = Math.min(boundsW, rect.x + rect.w + pad);
  const b = Math.min(boundsH, rect.y + rect.h + pad);
  return { x, y, w: Math.max(1, r - x), h: Math.max(1, b - y) };
}

function slotRect(outer: Rect, cols: number, rows: number, col: number, row: number): Rect {
  const x0 = outer.x + (outer.w * col) / cols;
  const x1 = outer.x + (outer.w * (col + 1)) / cols;
  const y0 = outer.y + (outer.h * row) / rows;
  const y1 = outer.y + (outer.h * (row + 1)) / rows;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function overlapArea(a: Rect, b: Rect): number {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, r - x) * Math.max(0, btm - y);
}

export function groupComponentsBySlot(
  components: ConnectedComponent[],
  outer: Rect,
  cols: number,
  rows: number
): ConnectedComponent[][] {
  const grouped: ConnectedComponent[][] = Array.from({ length: cols * rows }, () => []);
  for (const comp of components) {
    let best = 0;
    let bestArea = -1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const i = row * cols + col;
        const area = overlapArea(comp, slotRect(outer, cols, rows, col, row));
        if (area > bestArea) {
          bestArea = area;
          best = i;
        }
      }
    }
    grouped[best].push(comp);
  }
  return grouped;
}

export function unionRect(parts: Rect[]): Rect | null {
  if (!parts.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of parts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

interface Valley {
  start: number;
  end: number;
  center: number;
  width: number;
  minValue: number;
}

function findValleys(proj: ArrayLike<number>, lo: number, hi: number, limit: number): Valley[] {
  const valleys: Valley[] = [];
  let start = -1;
  let minValue = Infinity;
  const flush = (end: number) => {
    if (start < 0) return;
    valleys.push({
      start,
      end,
      center: (start + end) / 2,
      width: end - start + 1,
      minValue,
    });
    start = -1;
    minValue = Infinity;
  };
  for (let i = lo; i <= hi; i++) {
    const v = proj[i] ?? 0;
    if (v <= limit) {
      if (start < 0) start = i;
      if (v < minValue) minValue = v;
    } else {
      flush(i - 1);
    }
  }
  flush(hi);
  return valleys;
}

function pickValley(valleys: Valley[], expected: number): Valley | null {
  if (!valleys.length) return null;
  valleys.sort((a, b) => {
    if (b.width !== a.width) return b.width - a.width;
    return Math.abs(a.center - expected) - Math.abs(b.center - expected);
  });
  return valleys[0];
}

function argminRange(proj: ArrayLike<number>, lo: number, hi: number): number {
  let best = lo;
  let bestV = Infinity;
  for (let i = lo; i <= hi; i++) {
    const v = proj[i] ?? 0;
    if (v < bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

export function findSafeSeparator(
  proj: ArrayLike<number>,
  expected: number,
  searchRadius: number,
  fullyLimit: number,
  mostlyLimit: number,
  loBound: number,
  hiBound: number
): { position: number; gutterWidth: number; minValue: number } {
  const lo = Math.max(loBound, Math.floor(expected - searchRadius));
  const hi = Math.min(hiBound, Math.ceil(expected + searchRadius));
  const full = pickValley(findValleys(proj, lo, hi, fullyLimit), expected);
  if (full) return { position: full.center, gutterWidth: full.width, minValue: full.minValue };
  const mostly = pickValley(findValleys(proj, lo, hi, mostlyLimit), expected);
  if (mostly) return { position: mostly.center, gutterWidth: mostly.width, minValue: mostly.minValue };
  const pos = argminRange(proj, lo, hi);
  return { position: pos, gutterWidth: 1, minValue: proj[pos] ?? 0 };
}

export function separatorSafety(
  proj: ArrayLike<number>,
  position: number,
  safetyPx: number,
  visibleLimit: number,
  loBound: number,
  hiBound: number
): { safety: SeparatorSafety; gutterWidth: number } {
  const x = Math.round(position);
  const at = proj[x] ?? 0;
  if (at > visibleLimit) return { safety: 'intersects', gutterWidth: 0 };
  let left = x;
  let right = x;
  while (left > loBound && (proj[left - 1] ?? 0) <= visibleLimit) left -= 1;
  while (right < hiBound && (proj[right + 1] ?? 0) <= visibleLimit) right += 1;
  const gutterWidth = right - left + 1;
  const clearance = Math.min(x - left, right - x);
  if (clearance < Math.max(1, Math.round(safetyPx * 0.45))) return { safety: 'low-clearance', gutterWidth };
  return { safety: 'safe', gutterWidth };
}

export function buildAnalysisCache(
  working: PixelBuffer,
  config: Pick<SpriteSheetCropConfig, 'alphaThreshold' | 'analysisMaxSide' | 'safetyPx'>
): AnalysisCache {
  const small = downscaleBuffer(working, config.analysisMaxSide);
  const mask = buildArtworkMask(small, config.alphaThreshold);
  const { projX, projY } = projectVisible(mask, small.width, small.height);
  const components = detectConnectedComponents(mask, small.width, small.height, 10);
  const rawOuter = contentBounds(mask, small.width, small.height);
  const pad = Math.max(4, Math.round((config.safetyPx * small.width) / Math.max(1, working.width)));
  const outer = padRect(rawOuter, pad, small.width, small.height);
  return {
    fullWidth: working.width,
    fullHeight: working.height,
    scaleX: working.width / small.width,
    scaleY: working.height / small.height,
    maskWidth: small.width,
    maskHeight: small.height,
    mask,
    projX,
    projY,
    components,
    outer,
  };
}

function toFullX(cache: AnalysisCache, x: number): number {
  return x * cache.scaleX;
}

function toFullY(cache: AnalysisCache, y: number): number {
  return y * cache.scaleY;
}

function toMaskX(cache: AnalysisCache, x: number): number {
  return x / cache.scaleX;
}

function toMaskY(cache: AnalysisCache, y: number): number {
  return y / cache.scaleY;
}

function equalGrid(outer: Rect, cols: number, rows: number): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let c = 0; c <= cols; c++) xs.push(outer.x + (outer.w * c) / cols);
  for (let r = 0; r <= rows; r++) ys.push(outer.y + (outer.h * r) / rows);
  return { xs, ys };
}

export function computeSmartCrop(
  cache: AnalysisCache,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  config: SpriteSheetCropConfig,
  searchBoost = 1
): SmartCropResult {
  const outer = cache.outer;
  const expected = equalGrid(outer, cols, rows);
  const grouped = groupComponentsBySlot(cache.components, outer, cols, rows);
  const slotBoxes: Array<Rect | null> = grouped.map((parts) => unionRect(parts));
  const safetyMask = Math.max(1, Math.round(config.safetyPx / cache.scaleX));
  const fullyX = Math.max(1, cache.maskHeight * 0.004);
  const mostlyX = Math.max(2, cache.maskHeight * 0.025);
  const fullyY = Math.max(1, cache.maskWidth * 0.004);
  const mostlyY = Math.max(2, cache.maskWidth * 0.025);
  const cellW = outer.w / cols;
  const cellH = outer.h / rows;
  const searchX = Math.max(8, cellW * 0.42 * searchBoost);
  const searchY = Math.max(8, cellH * 0.42 * searchBoost);

  const xs = expected.xs.slice();
  const ys = expected.ys.slice();

  for (let c = 1; c < cols; c++) {
    const leftBoxes = slotBoxes.filter((_, i) => i % cols === c - 1).filter(Boolean) as Rect[];
    const rightBoxes = slotBoxes.filter((_, i) => i % cols === c).filter(Boolean) as Rect[];
    const leftMax = leftBoxes.length ? Math.max(...leftBoxes.map((b) => b.x + b.w)) : expected.xs[c];
    const rightMin = rightBoxes.length ? Math.min(...rightBoxes.map((b) => b.x)) : expected.xs[c];
    let expectedX = expected.xs[c];
    if (rightMin - leftMax > safetyMask * 2) {
      expectedX = (leftMax + rightMin) / 2;
    }
    const loBound = xs[c - 1] + 4;
    const hiBound = (c + 1 < xs.length ? expected.xs[c + 1] : outer.x + outer.w) - 4;
    const found = findSafeSeparator(
      cache.projX,
      expectedX,
      searchX,
      fullyX,
      mostlyX,
      loBound,
      hiBound
    );
    xs[c] = Math.max(loBound, Math.min(hiBound, found.position));
  }

  for (let r = 1; r < rows; r++) {
    const topBoxes = slotBoxes.filter((_, i) => Math.floor(i / cols) === r - 1).filter(Boolean) as Rect[];
    const botBoxes = slotBoxes.filter((_, i) => Math.floor(i / cols) === r).filter(Boolean) as Rect[];
    const topMax = topBoxes.length ? Math.max(...topBoxes.map((b) => b.y + b.h)) : expected.ys[r];
    const botMin = botBoxes.length ? Math.min(...botBoxes.map((b) => b.y)) : expected.ys[r];
    let expectedY = expected.ys[r];
    if (botMin - topMax > safetyMask * 2) {
      expectedY = (topMax + botMin) / 2;
    }
    const loBound = ys[r - 1] + 4;
    const hiBound = (r + 1 < ys.length ? expected.ys[r + 1] : outer.y + outer.h) - 4;
    const found = findSafeSeparator(
      cache.projY,
      expectedY,
      searchY,
      fullyY,
      mostlyY,
      loBound,
      hiBound
    );
    ys[r] = Math.max(loBound, Math.min(hiBound, found.position));
  }

  const fullXs = xs.map((x) => toFullX(cache, x));
  const fullYs = ys.map((y) => toFullY(cache, y));
  return evaluateCrop(cache, items, cols, rows, fullXs, fullYs, config, slotBoxes);
}

export function evaluateCrop(
  cache: AnalysisCache,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  fullXs: number[],
  fullYs: number[],
  config: SpriteSheetCropConfig,
  slotBoxes?: Array<Rect | null>
): SmartCropResult {
  const xs = fullXs.map((x) => toMaskX(cache, x));
  const ys = fullYs.map((y) => toMaskY(cache, y));
  const safetyMaskX = Math.max(1, config.safetyPx / cache.scaleX);
  const safetyMaskY = Math.max(1, config.safetyPx / cache.scaleY);
  const visX = Math.max(1, cache.maskHeight * 0.008);
  const visY = Math.max(1, cache.maskWidth * 0.008);
  const separators: SeparatorStatus[] = [];

  for (let c = 1; c < cols; c++) {
    const { safety, gutterWidth } = separatorSafety(
      cache.projX,
      xs[c],
      safetyMaskX,
      visX,
      xs[c - 1],
      xs[c + 1]
    );
    separators.push({
      axis: 'vertical',
      index: c,
      position: fullXs[c],
      safety,
      gutterWidth: gutterWidth * cache.scaleX,
      message:
        safety === 'safe'
          ? 'Safe crop'
          : safety === 'low-clearance'
            ? 'Low clearance'
            : `This crop line intersects artwork`,
    });
  }
  for (let r = 1; r < rows; r++) {
    const { safety, gutterWidth } = separatorSafety(
      cache.projY,
      ys[r],
      safetyMaskY,
      visY,
      ys[r - 1],
      ys[r + 1]
    );
    separators.push({
      axis: 'horizontal',
      index: r,
      position: fullYs[r],
      safety,
      gutterWidth: gutterWidth * cache.scaleY,
      message:
        safety === 'safe'
          ? 'Safe crop'
          : safety === 'low-clearance'
            ? 'Low clearance'
            : `This crop line intersects artwork`,
    });
  }

  const grouped = slotBoxes
    ? slotBoxes
    : groupComponentsBySlot(cache.components, cache.outer, cols, rows).map((p) => unionRect(p));

  const slots: SlotAssetStatus[] = items.map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const box = grouped[i];
    const left = xs[col];
    const right = xs[col + 1];
    const top = ys[row];
    const bottom = ys[row + 1];
    const warnings: string[] = [];
    const artworkDetected = !!box && box.w > 2 && box.h > 2;
    const intersectsCrop = artworkDetected
      ? box!.x < left - 0.5 || box!.x + box!.w > right + 0.5 || box!.y < top - 0.5 || box!.y + box!.h > bottom + 0.5
      : false;
    const closeToLeft = artworkDetected && box!.x - left < safetyMaskX;
    const closeToRight = artworkDetected && right - (box!.x + box!.w) < safetyMaskX;
    const closeToTop = artworkDetected && box!.y - top < safetyMaskY;
    const closeToBottom = artworkDetected && bottom - (box!.y + box!.h) < safetyMaskY;
    if (!artworkDetected) warnings.push('No artwork detected');
    if (intersectsCrop) warnings.push('Artwork crosses a crop boundary');
    if (closeToRight) warnings.push(`Artwork close to right crop boundary`);
    if (closeToLeft) warnings.push(`Artwork close to left crop boundary`);
    if (closeToTop) warnings.push(`Artwork close to top crop boundary`);
    if (closeToBottom) warnings.push(`Artwork close to bottom crop boundary`);
    return {
      slotId: item.slotId,
      name: item.name,
      col,
      row,
      blank: !artworkDetected,
      artworkDetected,
      backgroundTransparent: true,
      closeToLeft,
      closeToRight,
      closeToTop,
      closeToBottom,
      intersectsCrop,
      warnings,
    };
  });

  const overlaps: OverlapWarning[] = [];
  for (let i = 0; i < items.length; i++) {
    const a = grouped[i];
    if (!a) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const neighbors = [
      col + 1 < cols ? i + 1 : -1,
      row + 1 < rows ? i + cols : -1,
    ];
    for (const j of neighbors) {
      if (j < 0) continue;
      const b = grouped[j];
      if (!b) continue;
      const gap =
        j === i + 1
          ? b.x - (a.x + a.w)
          : b.y - (a.y + a.h);
      if (gap < safetyMaskX * 0.5) {
        overlaps.push({
          leftId: items[i].slotId,
          rightId: items[j].slotId,
          message: `${items[i].slotId} (${items[i].name}) and ${items[j].slotId} (${items[j].name}) overlap across the expected boundary. Please manually adjust the crop or regenerate the sprite sheet with more spacing.`,
        });
      }
    }
  }

  const hasUnsafe =
    separators.some((s) => s.safety === 'intersects') ||
    slots.some((s) => s.intersectsCrop);

  return {
    xs: fullXs.slice(),
    ys: fullYs.slice(),
    separators,
    slots,
    overlaps,
    hasUnsafe,
  };
}

export function autoFixCrop(
  cache: AnalysisCache,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  config: SpriteSheetCropConfig
): SmartCropResult {
  let result = computeSmartCrop(cache, items, cols, rows, config, 1);
  if (!result.hasUnsafe) return result;
  result = computeSmartCrop(cache, items, cols, rows, config, 1.75);
  if (!result.hasUnsafe) return result;
  result = computeSmartCrop(cache, items, cols, rows, config, 2.6);
  return result;
}

export function snapPosition(
  proj: ArrayLike<number>,
  position: number,
  radius: number,
  fullyLimit: number,
  loBound: number,
  hiBound: number
): number {
  const lo = Math.max(loBound, Math.floor(position - radius));
  const hi = Math.min(hiBound, Math.ceil(position + radius));
  const valley = pickValley(findValleys(proj, lo, hi, fullyLimit), position);
  return valley ? valley.center : position;
}

export function clampSeparators(values: number[], minGap: number, min: number, max: number): number[] {
  const next = values.slice();
  next[0] = min;
  next[next.length - 1] = max;
  for (let i = 1; i < next.length - 1; i++) {
    const lo = next[i - 1] + minGap;
    const hi = (i + 1 === next.length - 1 ? max : next[i + 1]) - minGap;
    next[i] = Math.max(lo, Math.min(hi, next[i]));
  }
  return next;
}

export function visibleBBoxInRect(
  buf: PixelBuffer,
  rect: Rect,
  alphaThreshold: number
): Rect | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(buf.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(buf.height, Math.ceil(rect.y + rect.h));
  const useAlpha = countTransparentRatio(buf) > 0.08;
  const [bgR, bgG, bgB] = useAlpha ? [0, 0, 0] : sampleCornerColor(buf);
  const tolerance = bgToleranceFromPercent(32);
  let minX = x1;
  let minY = y1;
  let maxX = x0 - 1;
  let maxY = y0 - 1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = pixelIndex(x, y, buf.width);
      if (buf.data[i + 3] <= alphaThreshold) continue;
      if (
        !useAlpha &&
        colorDistance(buf.data[i], buf.data[i + 1], buf.data[i + 2], bgR, bgG, bgB) <= tolerance
      ) {
        continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function yieldFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    window.setTimeout(resolve, 0);
  });
}

function putBufferOnCanvas(buf: PixelBuffer): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.createImageData(buf.width, buf.height);
  imageData.data.set(buf.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function bufferToDataUrl(buf: PixelBuffer): string {
  const canvas = putBufferOnCanvas(buf);
  return canvas ? canvas.toDataURL('image/png') : '';
}

export function imageDataToBuffer(imageData: ImageData): PixelBuffer {
  return {
    data: new Uint8ClampedArray(imageData.data),
    width: imageData.width,
    height: imageData.height,
  };
}

export async function loadImageBuffer(src: string, maxSide = 0): Promise<PixelBuffer> {
  if (typeof document === 'undefined') {
    throw new Error('Sprite sheet import requires a browser.');
  }
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load sprite sheet.'));
    el.src = src;
  });
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  if (maxSide > 0 && Math.max(width, height) > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not read sprite sheet.');
  ctx.drawImage(img, 0, 0, width, height);
  return imageDataToBuffer(ctx.getImageData(0, 0, width, height));
}

const PROCESS_MAX_SIDE = 1280;

const sessionSheetUrls: Record<SpriteSheetKind, string> = {
  characters: '',
  elements: '',
  rooms: '',
};

export function rememberUploadedSheet(kind: SpriteSheetKind, file: File): string {
  const previous = sessionSheetUrls[kind];
  if (previous.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(previous);
    } catch {
      // ignore
    }
  }
  const url = URL.createObjectURL(file);
  sessionSheetUrls[kind] = url;
  return url;
}

export function recalledUploadedSheet(kind: SpriteSheetKind): string {
  return sessionSheetUrls[kind] || '';
}

export function paintErase(buf: PixelBuffer, x: number, y: number, radius: number): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(x - radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const x1 = Math.min(buf.width, Math.ceil(x + radius));
  const y1 = Math.min(buf.height, Math.ceil(y + radius));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > r2) continue;
      buf.data[pixelIndex(px, py, buf.width) + 3] = 0;
    }
  }
}

export function paintRestore(
  working: PixelBuffer,
  original: PixelBuffer,
  x: number,
  y: number,
  radius: number
): void {
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(x - radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const x1 = Math.min(working.width, Math.ceil(x + radius));
  const y1 = Math.min(working.height, Math.ceil(y + radius));
  for (let py = y0; py < y1; py++) {
    for (let px = x0; px < x1; px++) {
      const dx = px - x;
      const dy = py - y;
      if (dx * dx + dy * dy > r2) continue;
      const i = pixelIndex(px, py, working.width);
      working.data[i] = original.data[i];
      working.data[i + 1] = original.data[i + 1];
      working.data[i + 2] = original.data[i + 2];
      working.data[i + 3] = original.data[i + 3];
    }
  }
}

export interface ExtractedAsset {
  slotId: string;
  name: string;
  dataUrl: string;
  blank: boolean;
  width: number;
  height: number;
}

function blitRect(
  src: PixelBuffer,
  rect: Rect,
  dest: PixelBuffer,
  dx: number,
  dy: number
): void {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(src.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(src.height, Math.ceil(rect.y + rect.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const si = pixelIndex(x, y, src.width);
      const tx = dx + (x - x0);
      const ty = dy + (y - y0);
      if (tx < 0 || ty < 0 || tx >= dest.width || ty >= dest.height) continue;
      const di = pixelIndex(tx, ty, dest.width);
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }
}

function scaleBufferNearest(src: PixelBuffer, scale: number): PixelBuffer {
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const dest: PixelBuffer = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.height - 1, Math.floor(y / scale));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const si = pixelIndex(sx, sy, src.width);
      const di = pixelIndex(x, y, w);
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }
  return dest;
}

function cropBuffer(src: PixelBuffer, rect: Rect): PixelBuffer {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const w = Math.max(1, Math.min(src.width - x0, Math.round(rect.w)));
  const h = Math.max(1, Math.min(src.height - y0, Math.round(rect.h)));
  const dest: PixelBuffer = { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
  blitRect(src, { x: x0, y: y0, w, h }, dest, 0, 0);
  return dest;
}

function fitOnCanvas(src: PixelBuffer, canvasW: number, canvasH: number, scale: number): PixelBuffer {
  const scaled = Math.abs(scale - 1) < 0.001 ? src : scaleBufferNearest(src, scale);
  const dest: PixelBuffer = {
    data: new Uint8ClampedArray(canvasW * canvasH * 4),
    width: canvasW,
    height: canvasH,
  };
  const dx = Math.round((canvasW - scaled.width) / 2);
  const dy = Math.round((canvasH - scaled.height) / 2);
  blitRect(scaled, { x: 0, y: 0, w: scaled.width, h: scaled.height }, dest, dx, dy);
  return dest;
}

export function boxesOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - 0.5 &&
    a.x + a.w > b.x + 0.5 &&
    a.y < b.y + b.h - 0.5 &&
    a.y + b.h > b.y + 0.5
  );
}

export function anyBoxesOverlap(boxes: SlotCropBox[]): boolean {
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) return true;
    }
  }
  return false;
}

export function keepBoxClearOfOthers(
  box: SlotCropBox,
  others: SlotCropBox[],
  fw: number,
  fh: number
): SlotCropBox {
  let next: SlotCropBox = { slotId: box.slotId, ...clampBox(box, fw, fh) };
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const other of others) {
      if (other.slotId === box.slotId || !boxesOverlap(next, other)) continue;
      const yOverlap = Math.min(next.y + next.h, other.y + other.h) - Math.max(next.y, other.y);
      const xOverlap = Math.min(next.x + next.w, other.x + other.w) - Math.max(next.x, other.x);
      if (xOverlap <= 0 || yOverlap <= 0) continue;
      const cx = next.x + next.w / 2;
      const cy = next.y + next.h / 2;
      const ocx = other.x + other.w / 2;
      const ocy = other.y + other.h / 2;
      if (xOverlap <= yOverlap) {
        if (cx <= ocx) next = { ...next, w: Math.max(16, other.x - next.x) };
        else {
          const right = next.x + next.w;
          next = { ...next, x: other.x + other.w, w: Math.max(16, right - (other.x + other.w)) };
        }
      } else if (cy <= ocy) {
        next = { ...next, h: Math.max(16, other.y - next.y) };
      } else {
        const bottom = next.y + next.h;
        next = { ...next, y: other.y + other.h, h: Math.max(16, bottom - (other.y + other.h)) };
      }
      changed = true;
    }
    if (!changed) break;
  }
  next = { slotId: box.slotId, ...clampBox(next, fw, fh) };
  if (others.some((other) => other.slotId !== box.slotId && boxesOverlap(next, other))) {
    return { slotId: box.slotId, ...clampBox(box, fw, fh) };
  }
  return next;
}

export function boxesFromGrid(
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  xs: number[],
  ys: number[]
): SlotCropBox[] {
  if (xs.length !== cols + 1 || ys.length !== rows + 1) return [];
  const count = Math.min(items.length, cols * rows);
  return items.slice(0, count).map((item, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      slotId: item.slotId,
      x: xs[col],
      y: ys[row],
      w: Math.max(1, xs[col + 1] - xs[col]),
      h: Math.max(1, ys[row + 1] - ys[row]),
    };
  });
}

/** Packed grid that can hold every item (6 → 2×3, 7 → 3×3 with two empty cells). */
export function packedSheetGrid(itemCount: number): { rows: number; columns: number } {
  const n = Math.max(1, Math.floor(itemCount) || 1);
  let exact: { rows: number; columns: number } | null = null;
  let exactScore = Infinity;
  for (let columns = 1; columns <= n; columns++) {
    if (n % columns !== 0) continue;
    const rows = n / columns;
    const ratio = Math.max(rows, columns) / Math.min(rows, columns);
    if (ratio > 3) continue;
    const score = Math.abs(rows - columns) + (columns < rows ? 0.15 : 0);
    if (score < exactScore) {
      exactScore = score;
      exact = { rows, columns };
    }
  }
  if (exact) return exact;
  const columns = Math.ceil(Math.sqrt(n));
  return { rows: Math.ceil(n / columns), columns };
}

/**
 * Infer a regular sprite-sheet grid that always has at least `itemCount` cells.
 * Leftover cells sit on the last row only (7 items → 3×3, never 2×2).
 */
export function inferSheetGrid(
  width: number,
  height: number,
  itemCount: number
): { rows: number; columns: number } {
  const n = Math.max(1, Math.floor(itemCount) || 1);
  const aspect = width / Math.max(1, height);
  let best = packedSheetGrid(n);
  let bestScore = Infinity;
  for (let columns = 1; columns <= n; columns++) {
    const rows = Math.ceil(n / columns);
    const unused = rows * columns - n;
    const gridAspect = columns / rows;
    const aspectErr = Math.abs(gridAspect - aspect) / Math.max(aspect, 0.01);
    const score = aspectErr * 4 + unused * 0.08;
    if (score < bestScore) {
      bestScore = score;
      best = { rows, columns };
    }
  }
  return best;
}

/** Prefer the prompt/download layout when it already holds every item. */
export function resolveSheetGrid(
  width: number,
  height: number,
  itemCount: number,
  hintCols?: number,
  hintRows?: number
): { rows: number; columns: number } {
  const n = Math.max(1, Math.floor(itemCount) || 1);
  const inferred = inferSheetGrid(width, height, n);
  const columns = Math.floor(Number(hintCols) || 0);
  const rows = Math.floor(Number(hintRows) || 0);
  if (columns < 1 || rows < 1 || columns * rows < n) return inferred;
  const aspect = width / Math.max(1, height);
  const hintErr = Math.abs(columns / rows - aspect) / Math.max(aspect, 0.01);
  const inferredErr = Math.abs(inferred.columns / inferred.rows - aspect) / Math.max(aspect, 0.01);
  if (hintErr <= inferredErr + 0.55) return { rows, columns };
  return inferred;
}

export function equalGridBounds(width: number, height: number, cols: number, rows: number): { xs: number[]; ys: number[] } {
  const xs = Array.from({ length: cols + 1 }, (_, i) => (width * i) / cols);
  const ys = Array.from({ length: rows + 1 }, (_, i) => (height * i) / rows);
  return { xs, ys };
}

export function buildEqualSlotBoxes(
  items: SpriteSheetItem[],
  width: number,
  height: number,
  cols: number,
  rows: number
): SlotCropBox[] {
  let c = Math.max(1, Math.floor(cols) || 1);
  let r = Math.max(1, Math.floor(rows) || 1);
  if (c * r < items.length) {
    const packed = inferSheetGrid(width, height, items.length);
    c = packed.columns;
    r = packed.rows;
  }
  const { xs, ys } = equalGridBounds(width, height, c, r);
  return boxesFromGrid(items, c, r, xs, ys);
}

function savedBoxesMatchItems(saved: SlotCropBox[], items: SpriteSheetItem[]): boolean {
  if (saved.length !== items.length) return false;
  const ids = new Set(items.map((item) => item.slotId));
  return saved.every((box) => ids.has(box.slotId));
}

/** Always one crop box per item. Prefer a valid saved crop, then detected art, then an equal packed grid. */
export function cropBoxesForItems(
  items: SpriteSheetItem[],
  width: number,
  height: number,
  gridCols: number,
  gridRows: number,
  detected: SlotCropBox[],
  saved: SlotCropBox[]
): SlotCropBox[] {
  const equal = buildEqualSlotBoxes(items, width, height, gridCols, gridRows);
  if (
    savedBoxesMatchItems(saved, items) &&
    !anyBoxesOverlap(saved) &&
    !boxesAreImplausible(saved, width, height)
  ) {
    return saved;
  }
  if (detected.length === items.length && !anyBoxesOverlap(detected)) {
    return detected;
  }
  if (detected.length > 0 && detected.length < items.length && !anyBoxesOverlap(detected)) {
    const padded = items.map((item, i) => {
      const box = detected[i];
      return box ? { ...box, slotId: item.slotId } : equal[i];
    });
    if (padded.length === items.length && !anyBoxesOverlap(padded)) return padded;
  }
  return equal;
}

export function boxesAreImplausible(boxes: SlotCropBox[], width: number, height: number): boolean {
  if (!boxes.length) return true;
  if (anyBoxesOverlap(boxes)) return true;
  const sheet = Math.max(1, width * height);
  const minArea = sheet * 0.035;
  if (boxes.some((box) => box.w * box.h < minArea || box.w < width * 0.08 || box.h < height * 0.08)) return true;
  const coverage = boxes.reduce((sum, box) => sum + box.w * box.h, 0) / sheet;
  return coverage < 0.4;
}

/** One non-overlapping crop box per detected image, assigned in reading order. */
export function buildSlotBoxes(
  cache: AnalysisCache,
  items: SpriteSheetItem[],
  _cols: number,
  _rows: number,
  _xs: number[],
  _ys: number[],
  padPercent: number
): SlotCropBox[] {
  const comps = cache.components
    .map((c) => ({
      x: c.x * cache.scaleX,
      y: c.y * cache.scaleY,
      w: c.w * cache.scaleX,
      h: c.h * cache.scaleY,
      cx: (c.x + c.w / 2) * cache.scaleX,
      cy: (c.y + c.h / 2) * cache.scaleY,
    }))
    .filter((c) => c.w > 8 && c.h > 8)
    .sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  if (!comps.length || !items.length) return [];

  const medH = comps.map((c) => c.h).sort((a, b) => a - b)[(comps.length / 2) | 0] || 1;
  const rows: typeof comps[] = [];
  for (const comp of comps) {
    const last = rows[rows.length - 1];
    if (!last) {
      rows.push([comp]);
      continue;
    }
    const lastCy = last.reduce((sum, item) => sum + item.cy, 0) / last.length;
    if (Math.abs(comp.cy - lastCy) < medH * 0.55) last.push(comp);
    else rows.push([comp]);
  }
  for (const row of rows) row.sort((a, b) => a.cx - b.cx);

  const fw = cache.fullWidth;
  const fh = cache.fullHeight;
  const rowTops = rows.map((row) => Math.min(...row.map((c) => c.y)));
  const rowBots = rows.map((row) => Math.max(...row.map((c) => c.y + c.h)));
  const ys: number[] = [0];
  for (let r = 0; r < rows.length - 1; r++) {
    ys.push((rowBots[r] + rowTops[r + 1]) / 2);
  }
  ys.push(fh);

  const boxes: SlotCropBox[] = [];
  let itemIndex = 0;
  for (let r = 0; r < rows.length && itemIndex < items.length; r++) {
    const rowComps = rows[r];
    const xs: number[] = [0];
    for (let c = 0; c < rowComps.length - 1; c++) {
      xs.push((rowComps[c].x + rowComps[c].w + rowComps[c + 1].x) / 2);
    }
    xs.push(fw);
    const y0 = ys[r];
    const y1 = ys[r + 1];
    for (let c = 0; c < rowComps.length && itemIndex < items.length; c++) {
      const x0 = xs[c];
      const x1 = xs[c + 1];
      const art = rowComps[c];
      const pad = Math.max(8, Math.round(Math.max(art.w, art.h) * (padPercent / 100)));
      const hugged = padRect(art, pad, fw, fh);
      const insetL = c === 0 ? 0 : 1;
      const insetR = c === rowComps.length - 1 ? 0 : 1;
      const insetT = r === 0 ? 0 : 1;
      const insetB = r === rows.length - 1 ? 0 : 1;
      const x = Math.max(x0 + insetL, hugged.x);
      const y = Math.max(y0 + insetT, hugged.y);
      const right = Math.min(x1 - insetR, hugged.x + hugged.w);
      const bottom = Math.min(y1 - insetB, hugged.y + hugged.h);
      boxes.push({
        slotId: items[itemIndex].slotId,
        ...clampBox({ x, y, w: Math.max(16, right - x), h: Math.max(16, bottom - y) }, fw, fh),
      });
      itemIndex += 1;
    }
  }
  return boxes;
}

export function extractSlotAssets(
  working: PixelBuffer,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  xs: number[],
  ys: number[],
  config: SpriteSheetCropConfig,
  _kind: SpriteSheetKind
): ExtractedAsset[] {
  const boxById = new Map((config.boxes ?? []).map((box) => [box.slotId, box]));
  const fallback = boxesFromGrid(items, cols, rows, xs, ys);
  const mode = config.normalizeMode;
  const pieces: Array<{ item: SpriteSheetItem; content: PixelBuffer | null; bbox: Rect | null }> = [];

  for (let i = 0; i < items.length; i++) {
    const box = boxById.get(items[i].slotId) ?? fallback[i];
    if (!box || !box.w || !box.h) {
      pieces.push({ item: items[i], content: null, bbox: null });
      continue;
    }
    pieces.push({
      item: items[i],
      content: cropBuffer(working, { x: box.x, y: box.y, w: box.w, h: box.h }),
      bbox: { x: box.x, y: box.y, w: box.w, h: box.h },
    });
  }

  const live = pieces.filter((p) => p.content);
  const maxH = Math.max(1, ...live.map((p) => p.content!.height));
  const maxW = Math.max(1, ...live.map((p) => p.content!.width));
  const square = Math.max(maxW, maxH);

  return pieces.map(({ item, content }) => {
    if (!content) {
      return {
        slotId: item.slotId,
        name: item.name,
        dataUrl: emptyPng(64, 64),
        blank: true,
        width: 64,
        height: 64,
      };
    }
    let out = content;
    const useMode = mode;
    if (useMode === 'normalize-height') {
      const s = (maxH / content.height) * (config.customScale || 1);
      const canvasW = Math.max(maxW, Math.ceil(content.width * s));
      out = fitOnCanvas(content, canvasW, maxH, s);
    } else if (useMode === 'normalize-width') {
      const s = (maxW / content.width) * (config.customScale || 1);
      out = fitOnCanvas(content, maxW, Math.max(maxH, Math.ceil(content.height * s)), s);
    } else if (useMode === 'fit-square' || useMode === 'fit-cell') {
      const side = useMode === 'fit-cell' ? square : square;
      const s = Math.min(side / content.width, side / content.height) * (config.customScale || 1);
      out = fitOnCanvas(content, side, side, s);
    } else if (useMode === 'custom') {
      out = scaleBufferNearest(content, config.customScale || 1);
    }
    return {
      slotId: item.slotId,
      name: item.name,
      dataUrl: bufferToDataUrl(out),
      blank: false,
      width: out.width,
      height: out.height,
    };
  });
}

function emptyPng(w: number, h: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.toDataURL('image/png');
}

export async function runSpriteSheetPipeline(
  originalSrc: string,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  kind: SpriteSheetKind,
  options: Partial<SpriteSheetCropConfig>,
  onStatus?: (status: ImporterStatus) => void
): Promise<{
  original: PixelBuffer;
  working: PixelBuffer;
  workingSrc: string;
  cache: AnalysisCache;
  crop: SmartCropResult;
  config: SpriteSheetCropConfig;
  assets: ExtractedAsset[];
}> {
  onStatus?.('Analyzing artwork...');
  await yieldFrame();
  const original = await loadImageBuffer(originalSrc, PROCESS_MAX_SIDE);
  await yieldFrame();
  const config: SpriteSheetCropConfig = {
    ...DEFAULT_CROP_CONFIG,
    normalizeMode: defaultNormalizeMode(kind),
    ...options,
  };
  const cache = buildAnalysisCache(original, config);

  onStatus?.('Finding crop lines...');
  await yieldFrame();
  const grid = resolveSheetGrid(original.width, original.height, items.length, cols, rows);
  const gridCols = grid.columns;
  const gridRows = grid.rows;
  const crop = autoFixCrop(cache, items, gridCols, gridRows, config);
  const savedBoxes = options.boxes ?? [];
  const detected = buildSlotBoxes(cache, items, gridCols, gridRows, crop.xs, crop.ys, config.padPercent);
  const boxes = cropBoxesForItems(
    items,
    original.width,
    original.height,
    gridCols,
    gridRows,
    detected,
    savedBoxes
  );

  onStatus?.('Creating crops...');
  await yieldFrame();
  const working = applySheetEffects(original, config);
  const nextConfig = { ...config, xs: crop.xs, ys: crop.ys, boxes, gridCols, gridRows };
  const assets = extractSlotAssets(working, items, gridCols, gridRows, crop.xs, crop.ys, nextConfig, kind);
  const workingSrc = working === original ? originalSrc : bufferToDataUrl(working);
  await yieldFrame();
  onStatus?.('Ready');

  return {
    original,
    working,
    workingSrc,
    cache,
    crop,
    config: nextConfig,
    assets,
  };
}
