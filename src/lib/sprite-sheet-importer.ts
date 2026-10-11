/**
 * Shared sprite-sheet importer used by Murdoku character, element, and room sheets.
 *
 * Crop boxes are placed on detected images. Optional whole-sheet effects
 * (background removal, black and white) are applied to a working copy.
 */

export type SpriteSheetKind = 'characters' | 'elements' | 'rooms' | 'maze';

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
  /** Natural size of the file before any working-raster cap. */
  sourceWidth?: number;
  sourceHeight?: number;
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
  /** Flattened x,y pairs tracing the illustration. Manual edits clear this. */
  outline?: number[];
  /** More shape borders added with the polygonal lasso. */
  extraOutlines?: number[][];
  /** Areas the user drew. Every pixel inside these polygons is kept. */
  includePolygons?: number[][];
  /** Areas the user drew to punch out of the crop. */
  excludePolygons?: number[][];
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
  /** Pixel size of the sheet the crop boxes were measured on. */
  sourceWidth?: number;
  sourceHeight?: number;
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
  const buffer = imageDataToBuffer(ctx.getImageData(0, 0, width, height));
  buffer.sourceWidth = img.naturalWidth;
  buffer.sourceHeight = img.naturalHeight;
  return buffer;
}

export function sheetPreviewSrc(
  originalSrc: string,
  original: PixelBuffer,
  working: PixelBuffer
): string {
  if (working !== original) return bufferToDataUrl(working);
  const nativeW = original.sourceWidth ?? original.width;
  const nativeH = original.sourceHeight ?? original.height;
  if (nativeW !== original.width || nativeH !== original.height) {
    return bufferToDataUrl(working);
  }
  return originalSrc;
}

/** Safety cap only. Analysis still uses `analysisMaxSide`. */
export const SHEET_WORKING_MAX_SIDE = 4096;
/** Older Edit Cropping sessions stored boxes on a 1280-wide working raster. */
export const LEGACY_SHEET_PROCESS_MAX_SIDE = 1280;

function scalePairValues(values: number[] | undefined, sx: number, sy: number): number[] | undefined {
  if (!values?.length) return values;
  return values.map((value, index) => value * (index % 2 === 0 ? sx : sy));
}

export function scaleSlotCropBox(box: SlotCropBox, sx: number, sy: number): SlotCropBox {
  return {
    ...box,
    x: box.x * sx,
    y: box.y * sy,
    w: box.w * sx,
    h: box.h * sy,
    outline: scalePairValues(box.outline, sx, sy),
    extraOutlines: box.extraOutlines?.map((polygon) => scalePairValues(polygon, sx, sy) ?? polygon),
    includePolygons: box.includePolygons?.map((polygon) => scalePairValues(polygon, sx, sy) ?? polygon),
    excludePolygons: box.excludePolygons?.map((polygon) => scalePairValues(polygon, sx, sy) ?? polygon),
  };
}

/**
 * Map saved crop boxes onto the sheet that is actually loaded.
 * Older projects stored boxes in the 1280 working-raster space.
 */
export function scaleCropConfigToImage(
  config: SpriteSheetCropConfig,
  width: number,
  height: number
): SpriteSheetCropConfig {
  const storedW = Number(config.sourceWidth);
  const storedH = Number(config.sourceHeight);
  const boxes = config.boxes ?? [];
  const extentW = boxes.reduce((max, box) => Math.max(max, box.x + box.w), 0);
  const extentH = boxes.reduce((max, box) => Math.max(max, box.y + box.h), 0);
  const long = Math.max(width, height);
  const expectedLegacyW = width * (LEGACY_SHEET_PROCESS_MAX_SIDE / long);
  const expectedLegacyH = height * (LEGACY_SHEET_PROCESS_MAX_SIDE / long);
  const looksLegacy =
    boxes.length > 0 &&
    extentW > 0 &&
    extentH > 0 &&
    long > LEGACY_SHEET_PROCESS_MAX_SIDE + 8 &&
    Math.max(extentW, extentH) <= LEGACY_SHEET_PROCESS_MAX_SIDE + 8 &&
    extentW >= expectedLegacyW * 0.7 &&
    extentH >= expectedLegacyH * 0.7;
  let fromW = 0;
  let fromH = 0;
  if (looksLegacy) {
    const scale = LEGACY_SHEET_PROCESS_MAX_SIDE / long;
    fromW = Math.max(1, Math.round(width * scale));
    fromH = Math.max(1, Math.round(height * scale));
  } else if (storedW > 0 && storedH > 0) {
    fromW = storedW;
    fromH = storedH;
  } else {
    fromW = width;
    fromH = height;
  }
  const sx = fromW === width ? 1 : width / fromW;
  const sy = fromH === height ? 1 : height / fromH;
  if (Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) {
    return { ...config, sourceWidth: width, sourceHeight: height };
  }
  return {
    ...config,
    xs: (config.xs ?? []).map((value) => value * sx),
    ys: (config.ys ?? []).map((value) => value * sy),
    boxes: (config.boxes ?? []).map((box) => scaleSlotCropBox(box, sx, sy)),
    sourceWidth: width,
    sourceHeight: height,
  };
}

const sessionSheetUrls: Record<SpriteSheetKind, string> = {
  characters: '',
  elements: '',
  rooms: '',
  maze: '',
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
  /** Unenhanced crop. Auto Enhance always reprocesses from this. */
  sourceDataUrl?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  autoEnhanced?: boolean;
  /** Coloring-page SVG. Maze canvas preview uses this; print rasterizes it. */
  previewSvg?: string;
}

/** Draw `src` into `dest` so it fills the crop box. */
export function stampBufferIntoBox(
  dest: PixelBuffer,
  src: PixelBuffer,
  box: { x: number; y: number; w: number; h: number }
): void {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const boxW = Math.max(1, Math.round(box.w));
  const boxH = Math.max(1, Math.round(box.h));
  const x1 = Math.min(dest.width, x0 + boxW);
  const y1 = Math.min(dest.height, y0 + boxH);
  for (let y = y0; y < y1; y++) {
    const sy = Math.min(src.height - 1, Math.floor(((y - y0) * src.height) / boxH));
    for (let x = x0; x < x1; x++) {
      const sx = Math.min(src.width - 1, Math.floor(((x - x0) * src.width) / boxW));
      const si = (sy * src.width + sx) * 4;
      const di = (y * dest.width + x) * 4;
      dest.data[di] = src.data[si];
      dest.data[di + 1] = src.data[si + 1];
      dest.data[di + 2] = src.data[si + 2];
      dest.data[di + 3] = src.data[si + 3];
    }
  }
}

/** Tight crop around the subject in one image. Same path as first-load Edit Cropping. */
export function autoCropBoxForBuffer(src: PixelBuffer): Rect {
  const boxes = tightInkBoxes(src, [{ slotId: 'auto', name: 'auto' }], 1, 1);
  const box = boxes[0];
  if (!box) return { x: 0, y: 0, w: src.width, h: src.height };
  return { x: box.x, y: box.y, w: box.w, h: box.h };
}

export function clearBufferRect(dest: PixelBuffer, box: Rect): void {
  const x0 = Math.max(0, Math.round(box.x));
  const y0 = Math.max(0, Math.round(box.y));
  const x1 = Math.min(dest.width, x0 + Math.max(0, Math.round(box.w)));
  const y1 = Math.min(dest.height, y0 + Math.max(0, Math.round(box.h)));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * dest.width + x) * 4;
      dest.data[i] = 0;
      dest.data[i + 1] = 0;
      dest.data[i + 2] = 0;
      dest.data[i + 3] = 0;
    }
  }
}

/**
 * Replace one slot: discard the old crop, auto-crop the new image, and place
 * only that slot's new box. Other slots stay unchanged.
 */
export function replaceSlotImage(
  sheet: PixelBuffer,
  src: PixelBuffer,
  slotId: string,
  items: SpriteSheetItem[],
  cols: number,
  rows: number,
  oldBox: SlotCropBox
): { sheet: PixelBuffer; box: SlotCropBox } {
  const local = autoCropBoxForBuffer(src);
  const cropped = cropBuffer(src, local);
  const cells = buildEqualSlotBoxes(items, sheet.width, sheet.height, cols, rows);
  const cell = cells.find((item) => item.slotId === slotId) ?? oldBox;
  const scale = Math.min(1, cell.w / Math.max(1, cropped.width), cell.h / Math.max(1, cropped.height));
  const dw = Math.max(1, Math.round(cropped.width * scale));
  const dh = Math.max(1, Math.round(cropped.height * scale));
  const dx = cell.x + (cell.w - dw) / 2;
  const dy = cell.y + (cell.h - dh) / 2;
  const next = cloneBuffer(sheet);
  clearBufferRect(next, oldBox);
  clearBufferRect(next, cell);
  stampBufferIntoBox(next, cropped, { x: dx, y: dy, w: dw, h: dh });
  return {
    sheet: next,
    box: {
      slotId,
      ...clampBox({ x: dx, y: dy, w: dw, h: dh }, sheet.width, sheet.height),
    },
  };
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
    a.y + a.h > b.y + 0.5
  );
}

/** Opaque pixels that are not blank paper. Transparent and near-white pixels are empty. */
export function isInkPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 16) return false;
  return r < 245 || g < 245 || b < 245;
}

export function inkBoundsInRect(src: PixelBuffer, rect: Rect, pad = 1): Rect | null {
  const x0 = Math.max(0, Math.floor(rect.x));
  const y0 = Math.max(0, Math.floor(rect.y));
  const x1 = Math.min(src.width, Math.ceil(rect.x + rect.w));
  const y1 = Math.min(src.height, Math.ceil(rect.y + rect.h));
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * src.width + x) * 4;
      if (!isInkPixel(src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  const x = Math.max(x0, minX - pad);
  const y = Math.max(y0, minY - pad);
  const right = Math.min(x1, maxX + 1 + pad);
  const bottom = Math.min(y1, maxY + 1 + pad);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

function edgeGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

/** Edge-connected transparent and near-white pixels. Enclosed fill stays out of this mask. */
export function exteriorBackgroundMask(src: PixelBuffer): Uint8Array {
  const { data, width, height } = src;
  const exterior = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (exterior[p]) return;
    const i = p * 4;
    const alpha = data[i + 3];
    if (alpha >= 16 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) return;
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

function dilateBinary(mask: Uint8Array, width: number, height: number, radius: number, bounds: Rect): void {
  const seeds: number[] = [];
  const x0 = Math.max(0, Math.floor(bounds.x) - radius);
  const y0 = Math.max(0, Math.floor(bounds.y) - radius);
  const x1 = Math.min(width - 1, Math.ceil(bounds.x + bounds.w) + radius);
  const y1 = Math.min(height - 1, Math.ceil(bounds.y + bounds.h) + radius);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (mask[y * width + x]) seeds.push(y * width + x);
    }
  }
  for (const p of seeds) {
    const x = p % width;
    const y = (p / width) | 0;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        mask[ny * width + nx] = 1;
      }
    }
  }
}

/** Outer silhouette of one drawing, including the fill enclosed by its outline. */
function silhouetteMask(labels: Int32Array, width: number, height: number, id: number, bounds: Rect): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let p = 0; p < labels.length; p++) if (labels[p] === id) mask[p] = 1;
  dilateBinary(mask, width, height, 2, bounds);
  const x0 = Math.max(0, Math.floor(bounds.x) - 3);
  const y0 = Math.max(0, Math.floor(bounds.y) - 3);
  const x1 = Math.min(width - 1, Math.ceil(bounds.x + bounds.w) + 3);
  const y1 = Math.min(height - 1, Math.ceil(bounds.y + bounds.h) + 3);
  const outside = new Uint8Array(width * height);
  const stack = new Int32Array((x1 - x0 + 1) * (y1 - y0 + 1));
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < x0 || y < y0 || x > x1 || y > y1) return;
    const p = y * width + x;
    if (outside[p] || mask[p]) return;
    outside[p] = 1;
    stack[sp++] = p;
  };
  for (let x = x0; x <= x1; x++) {
    push(x, y0);
    push(x, y1);
  }
  for (let y = y0; y <= y1; y++) {
    push(x0, y);
    push(x1, y);
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
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const p = y * width + x;
      if (!outside[p]) mask[p] = 1;
    }
  }
  return mask;
}

function traceIllustrationOutline(labels: Int32Array, width: number, height: number, id: number): number[] {
  let start = -1;
  for (let p = 0; p < labels.length; p++) {
    if (labels[p] === id) {
      start = p;
      break;
    }
  }
  if (start < 0) return [];
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
  const sx = start % width;
  const sy = (start / width) | 0;
  let x = sx;
  let y = sy;
  let dir = 0;
  const points: number[] = [];
  const maxSteps = width * height;
  for (let step = 0; step < maxSteps; step++) {
    if (points.length < 4000) {
      points.push(x, y);
    }
    let turned = (dir + 6) % 8;
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nx = x + dirs[turned][0];
      const ny = y + dirs[turned][1];
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && labels[ny * width + nx] === id) {
        x = nx;
        y = ny;
        dir = turned;
        found = true;
        break;
      }
      turned = (turned + 1) % 8;
    }
    if (!found || (x === sx && y === sy && points.length > 4)) break;
  }
  if (points.length < 8) return [];
  const simplified: number[] = [];
  const stride = Math.max(1, Math.floor(points.length / 2 / 180));
  for (let i = 0; i < points.length; i += stride * 2) {
    simplified.push(points[i], points[i + 1]);
  }
  return simplified;
}

function traceBinaryOutline(mask: Uint8Array, width: number, height: number): number[] {
  const labels = new Int32Array(mask.length);
  for (let p = 0; p < mask.length; p++) if (mask[p]) labels[p] = 1;
  return traceIllustrationOutline(labels, width, height, 1);
}

/**
 * Rectangular crop whose visible pixels follow one illustration.
 * Pixels outside that shape, including other drawings inside the rectangle, become transparent.
 */
export function pointInPolygon(x: number, y: number, polygon: number[]): boolean {
  if (polygon.length < 6) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 2; i < polygon.length; j = i, i += 2) {
    const xi = polygon[i];
    const yi = polygon[i + 1];
    const xj = polygon[j];
    const yj = polygon[j + 1];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

function fillPolygon(mask: Uint8Array, width: number, height: number, polygon: number[]): void {
  if (polygon.length < 6) return;
  const count = polygon.length / 2;
  let minY = height;
  let maxY = 0;
  for (let index = 0; index < count; index++) {
    const y = polygon[index * 2 + 1];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const yStart = Math.max(0, Math.floor(minY));
  const yEnd = Math.min(height - 1, Math.ceil(maxY));
  for (let y = yStart; y <= yEnd; y++) {
    const scan = y + 0.5;
    const hits: number[] = [];
    for (let index = 0; index < count; index++) {
      const next = (index + 1) % count;
      const y1 = polygon[index * 2 + 1];
      const y2 = polygon[next * 2 + 1];
      if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) {
        const t = (scan - y1) / (y2 - y1 || 1e-9);
        hits.push(polygon[index * 2] + t * (polygon[next * 2] - polygon[index * 2]));
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
/** Keep every pixel inside any polygon. Pixels outside all of them become transparent. */
export function keepPixelsInsidePolygons(src: PixelBuffer, polygons: number[][]): PixelBuffer {
  return maskOutsidePolygons(src, polygons);
}

function maskOutsidePolygons(src: PixelBuffer, polygons: number[][]): PixelBuffer {
  const valid = polygons.filter((polygon) => polygon.length >= 6);
  if (!valid.length) return src;
  const buf = cloneBuffer(src);
  const { data, width, height } = buf;
  const inside = new Uint8Array(width * height);
  for (const polygon of valid) fillPolygon(inside, width, height, polygon);
  for (let p = 0, i = 3; p < inside.length; p++, i += 4) {
    if (!inside[p]) data[i] = 0;
  }
  return buf;
}

/** Ink inside the lasso, plus a short step through connected ink so a circled part is kept. */
export function captureShapesInPolygon(
  src: PixelBuffer,
  polygon: number[]
): Array<{ bounds: Rect; outline: number[] }> {
  const { data, width, height } = src;
  const ink = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    const alpha = data[i + 3];
    if (alpha >= 16 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) ink[p] = 1;
  }
  const region = new Uint8Array(width * height);
  fillPolygon(region, width, height, polygon);
  const labels = new Int32Array(width * height);
  const parts: Array<{ id: number; cx: number; cy: number }> = [];
  const stack = new Int32Array(width * height);
  let nextId = 1;
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || labels[start]) continue;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = nextId;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    while (sp > 0) {
      const p = stack[--sp];
      area += 1;
      sumX += p % width;
      sumY += (p / width) | 0;
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!ink[np] || labels[np]) continue;
          labels[np] = nextId;
          stack[sp++] = np;
        }
      }
    }
    if (area >= 8) parts.push({ id: nextId, cx: sumX / area, cy: sumY / area });
    else {
      for (let p = 0; p < labels.length; p++) if (labels[p] === nextId) labels[p] = 0;
    }
    nextId += 1;
  }
  const selected = new Uint8Array(width * height);
  const whole = new Set(parts.filter((part) => pointInPolygon(part.cx, part.cy, polygon)).map((part) => part.id));
  for (let p = 0; p < labels.length; p++) {
    if (whole.has(labels[p])) selected[p] = 1;
  }
  const reach = 32;
  const dist = new Int16Array(width * height);
  dist.fill(-1);
  let head = 0;
  let tail = 0;
  for (let p = 0; p < ink.length; p++) {
    if (!ink[p] || !region[p] || whole.has(labels[p])) continue;
    dist[p] = 0;
    stack[tail++] = p;
  }
  while (head < tail) {
    const p = stack[head++];
    const step = dist[p];
    selected[p] = 1;
    if (step >= reach) continue;
    const x = p % width;
    const y = (p / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const np = ny * width + nx;
        if (!ink[np] || dist[np] >= 0) continue;
        dist[np] = step + 1;
        stack[tail++] = np;
      }
    }
  }
  return detectConnectedComponents(selected, width, height, 8).map((part) => {
    const mask = new Uint8Array(width * height);
    const seen = new Uint8Array(width * height);
    let seed = -1;
    const x0 = Math.max(0, Math.floor(part.x));
    const y0 = Math.max(0, Math.floor(part.y));
    const x1 = Math.min(width - 1, Math.ceil(part.x + part.w) - 1);
    const y1 = Math.min(height - 1, Math.ceil(part.y + part.h) - 1);
    for (let y = y0; y <= y1 && seed < 0; y++) {
      for (let x = x0; x <= x1; x++) {
        if (selected[y * width + x]) {
          seed = y * width + x;
          break;
        }
      }
    }
    if (seed >= 0) {
      let sp = 0;
      stack[sp++] = seed;
      seen[seed] = 1;
      while (sp > 0) {
        const p = stack[--sp];
        mask[p] = 1;
        const x = p % width;
        const y = (p / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const np = ny * width + nx;
            if (!selected[np] || seen[np]) continue;
            seen[np] = 1;
            stack[sp++] = np;
          }
        }
      }
    }
    const silhouette = silhouetteMask(Int32Array.from(mask), width, height, 1, {
      x: part.x,
      y: part.y,
      w: part.w,
      h: part.h,
    });
    return {
      bounds: { x: part.x, y: part.y, w: part.w, h: part.h },
      outline: traceBinaryOutline(silhouette, width, height),
    };
  });
}

export function cropToIllustrationShape(src: PixelBuffer, keepPolygons: number[][] = []): PixelBuffer {
  const buf = cloneBuffer(src);
  const { data, width, height } = buf;
  const ink = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    const alpha = data[i + 3];
    if (alpha >= 16 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) ink[p] = 1;
  }
  const parts = detectConnectedComponents(ink, width, height, 1);
  if (!parts.length) return buf;
  const centerX = width / 2;
  const centerY = height / 2;
  let main = parts[0];
  for (const part of parts) {
    const closer = Math.hypot(part.cx - centerX, part.cy - centerY) < Math.hypot(main.cx - centerX, main.cy - centerY);
    if (part.area > main.area || (part.area > main.area * 0.65 && closer)) main = part;
  }
  const bridge = Math.max(4, Math.min(24, Math.round(Math.min(main.w, main.h) * 0.28)));
  const keepPart = parts.filter((part) => {
    if (keepPolygons.length) return keepPolygons.some((polygon) => pointInPolygon(part.cx, part.cy, polygon));
    if (part === main) return true;
    const touchesEdge =
      part.x <= 1 || part.y <= 1 || part.x + part.w >= width - 1 || part.y + part.h >= height - 1;
    if (touchesEdge) return false;
    const inside =
      part.cx >= main.x - 2 &&
      part.cy >= main.y - 2 &&
      part.cx <= main.x + main.w + 2 &&
      part.cy <= main.y + main.h + 2;
    return part.area < main.area * 0.4 && (inside || edgeGap(part, main) <= bridge);
  });
  const keep = new Uint8Array(width * height);
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let partIndex = 0;
  const kept = new Set(keepPart);
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    const part = parts[partIndex];
    partIndex += 1;
    const mark = part ? kept.has(part) : false;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      if (mark) keep[p] = 1;
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!ink[np] || seen[np]) continue;
          seen[np] = 1;
          stack[sp++] = np;
        }
      }
    }
  }
  dilateBinary(keep, width, height, 1, { x: 0, y: 0, w: width, h: height });
  const outside = new Uint8Array(width * height);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (outside[p] || keep[p]) return;
    outside[p] = 1;
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
  for (let p = 0, i = 0; p < outside.length; p++, i += 4) {
    if (outside[p]) data[i + 3] = 0;
  }
  return buf;
}

interface IllustrationCluster extends Rect {
  area: number;
  id: number;
}

/**
 * Crop boxes from the transparent gutter around each drawing.
 * Disconnected parts of one drawing stay together. A drawing is never sliced to fit a grid cell.
 */
export function tightInkBoxes(
  src: PixelBuffer,
  items: SpriteSheetItem[],
  cols: number,
  rows: number
): SlotCropBox[] {
  const { width, height } = src;
  const exterior = exteriorBackgroundMask(src);
  const artwork = new Uint8Array(width * height);
  for (let p = 0; p < artwork.length; p++) artwork[p] = exterior[p] ? 0 : 1;
  const parts = detectConnectedComponents(artwork, width, height, 1);
  if (!parts.length || !items.length) {
    return buildEqualSlotBoxes(items, width, height, cols, rows);
  }

  const byArea = [...parts].sort((a, b) => b.area - a.area);
  const referenceArea = byArea[Math.min(byArea.length - 1, Math.max(0, items.length - 1))]?.area || 1;
  const majorMin = Math.max(8, referenceArea * 0.18);
  const majorIndexes = parts
    .map((part, index) => ({ index, area: part.area }))
    .filter((part) => part.area >= majorMin)
    .sort((a, b) => b.area - a.area)
    .map((part) => part.index);
  const fragmentIndexes = parts.map((_, index) => index).filter((index) => !majorIndexes.includes(index));
  while (majorIndexes.length > items.length) fragmentIndexes.push(majorIndexes.pop() as number);

  const members = majorIndexes.map((index) => [index]);
  for (const fragment of fragmentIndexes) {
    let best = -1;
    let bestGap = Infinity;
    let secondGap = Infinity;
    for (let index = 0; index < majorIndexes.length; index++) {
      const gap = edgeGap(parts[fragment], parts[majorIndexes[index]]);
      if (gap < bestGap) {
        secondGap = bestGap;
        bestGap = gap;
        best = index;
      } else if (gap < secondGap) secondGap = gap;
    }
    if (best < 0) continue;
    const major = parts[majorIndexes[best]];
    const bridge = Math.max(4, Math.min(24, Math.round(Math.min(major.w, major.h) * 0.28)));
    if (bestGap <= bridge && bestGap + 2 < secondGap) members[best].push(fragment);
  }

  const illustrations: Array<IllustrationCluster & { partIndexes: number[] }> = members.map((group, groupIndex) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let area = 0;
    for (const index of group) {
      const part = parts[index];
      minX = Math.min(minX, part.x);
      minY = Math.min(minY, part.y);
      maxX = Math.max(maxX, part.x + part.w);
      maxY = Math.max(maxY, part.y + part.h);
      area += part.area;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, area, id: groupIndex + 1, partIndexes: group };
  });

  const partToIllustration = new Map<number, number>();
  for (const illustration of illustrations) {
    for (const partIndex of illustration.partIndexes) partToIllustration.set(partIndex, illustration.id);
  }
  const labels = new Int32Array(width * height);
  const seen = new Uint8Array(artwork.length);
  const stack = new Int32Array(artwork.length);
  let componentIndex = 0;
  for (let start = 0; start < artwork.length; start++) {
    if (!artwork[start] || seen[start]) continue;
    const id = partToIllustration.get(componentIndex) ?? 0;
    componentIndex += 1;
    let sp = 0;
    stack[sp++] = start;
    seen[start] = 1;
    while (sp > 0) {
      const p = stack[--sp];
      if (id) labels[p] = id;
      const x = p % width;
      const y = (p / width) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!artwork[np] || seen[np]) continue;
          seen[np] = 1;
          stack[sp++] = np;
        }
      }
    }
  }

  const gridCols = Math.max(1, cols);
  const gridRows = Math.max(1, rows);
  const cellW = width / gridCols;
  const cellH = height / gridRows;
  const slotOf = new Array<IllustrationCluster | null>(items.length).fill(null);
  const used = new Set<number>();
  const scored = illustrations.flatMap((illustration) => {
    const matches: Array<{ illustration: IllustrationCluster; slot: number; overlap: number }> = [];
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const slot = row * gridCols + col;
        if (slot >= items.length) continue;
        const overlap = overlapArea(illustration, { x: col * cellW, y: row * cellH, w: cellW, h: cellH });
        if (overlap > 0) matches.push({ illustration, slot, overlap });
      }
    }
    return matches;
  });
  scored.sort((a, b) => b.overlap - a.overlap);
  for (const match of scored) {
    if (used.has(match.illustration.id) || slotOf[match.slot]) continue;
    slotOf[match.slot] = match.illustration;
    used.add(match.illustration.id);
  }
  const emptySlots: number[] = [];
  for (let index = 0; index < items.length; index++) {
    if (!slotOf[index]) emptySlots.push(index);
  }
  const unused = illustrations.filter((illustration) => !used.has(illustration.id)).sort((a, b) => b.area - a.area);
  for (const illustration of unused) {
    if (!emptySlots.length) break;
    const cx = illustration.x + illustration.w / 2;
    const cy = illustration.y + illustration.h / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let index = 0; index < emptySlots.length; index++) {
      const slot = emptySlots[index];
      const col = slot % gridCols;
      const row = Math.floor(slot / gridCols);
      const dist = Math.hypot(cx - (col + 0.5) * cellW, cy - (row + 0.5) * cellH);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    }
    const slot = emptySlots.splice(best, 1)[0];
    slotOf[slot] = illustration;
    used.add(illustration.id);
  }

  const boxes: Array<SlotCropBox | null> = new Array(items.length).fill(null);
  for (let index = 0; index < items.length; index++) {
    const cluster = slotOf[index];
    if (!cluster) continue;
    const pad = Math.max(3, Math.min(8, Math.round(Math.min(cluster.w, cluster.h) * 0.05)));
    let left = cluster.x - pad;
    let top = cluster.y - pad;
    let right = cluster.x + cluster.w + pad;
    let bottom = cluster.y + cluster.h + pad;
    for (const other of illustrations) {
      if (other.id === cluster.id) continue;
      const verticalOverlap = cluster.y < other.y + other.h && cluster.y + cluster.h > other.y;
      const horizontalOverlap = cluster.x < other.x + other.w && cluster.x + cluster.w > other.x;
      if (verticalOverlap && other.x >= cluster.x + cluster.w) right = Math.min(right, other.x);
      if (verticalOverlap && other.x + other.w <= cluster.x) left = Math.max(left, other.x + other.w);
      if (horizontalOverlap && other.y >= cluster.y + cluster.h) bottom = Math.min(bottom, other.y);
      if (horizontalOverlap && other.y + other.h <= cluster.y) top = Math.max(top, other.y + other.h);
    }
    left = Math.max(0, left);
    top = Math.max(0, top);
    right = Math.min(width, Math.max(left + 1, right));
    bottom = Math.min(height, Math.max(top + 1, bottom));
    boxes[index] = {
      slotId: items[index].slotId,
      x: left,
      y: top,
      w: right - left,
      h: bottom - top,
      outline: traceBinaryOutline(silhouetteMask(labels, width, height, cluster.id, cluster), width, height),
    };
  }

  if (boxes.some((box) => !box)) {
    const equal = buildEqualSlotBoxes(items, width, height, cols, rows);
    for (let index = 0; index < items.length; index++) {
      if (boxes[index]) continue;
      const cell = equal[index];
      boxes[index] = { slotId: items[index].slotId, x: cell.x, y: cell.y, w: cell.w, h: cell.h };
    }
  }
  return boxes.filter((box): box is SlotCropBox => box != null);
}

/** Makes the gutter around a cropped illustration transparent without erasing enclosed fill. */
export function punchExteriorBackground(src: PixelBuffer): PixelBuffer {
  const buf = cloneBuffer(src);
  const { data, width, height } = buf;
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let sp = 0;
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (data[i + 3] >= 16 && (data[i] < 248 || data[i + 1] < 248 || data[i + 2] < 248)) return;
    seen[p] = 1;
    data[i + 3] = 0;
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
  return buf;
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

/** Keep the user's crop edits. Auto-detect only fills a sheet that has no saved boxes. */
export function chooseMazeCropBoxes(
  saved: SlotCropBox[],
  detected: SlotCropBox[],
  items: SpriteSheetItem[]
): SlotCropBox[] {
  return savedBoxesMatchItems(saved, items) ? saved : detected;
}

function drawingIsOutlined(box: SlotCropBox, art: SlotCropBox): boolean {
  if (!box.outline || box.outline.length < 6) return false;
  return pointInPolygon(art.x + art.w / 2, art.y + art.h / 2, box.outline);
}

/** Keep edited crops, and give a free slot to any drawing the saved outlines missed. */
function mergeMissedDrawings(saved: SlotCropBox[], detected: SlotCropBox[]): SlotCropBox[] {
  const missed = detected.filter((art) => art.outline && art.outline.length >= 6 && !saved.some((box) => drawingIsOutlined(box, art)));
  if (!missed.length) return saved;
  const boxes = saved.map((box) => ({ ...box }));
  const holdsArt = boxes.map((box) => detected.some((art) => drawingIsOutlined(box, art)));
  for (const art of missed) {
    const cx = art.x + art.w / 2;
    const cy = art.y + art.h / 2;
    let best = -1;
    let bestDist = Infinity;
    for (let index = 0; index < boxes.length; index++) {
      if (holdsArt[index]) continue;
      const box = boxes[index];
      const dist = Math.hypot(cx - (box.x + box.w / 2), cy - (box.y + box.h / 2));
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    }
    if (best < 0) continue;
    boxes[best] = { ...art, slotId: boxes[best].slotId };
    holdsArt[best] = true;
  }
  return boxes;
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

/** Crop one maze slot. A hand-drawn polygon keeps every pixel inside it. */
export function cropMazeSlot(content: PixelBuffer, box: SlotCropBox): PixelBuffer {
  const originX = Math.max(0, Math.floor(box.x));
  const originY = Math.max(0, Math.floor(box.y));
  const toLocal = (polygon: number[]) =>
    polygon.map((value, index) => value - (index % 2 === 0 ? originX : originY));
  const shapes = [
    ...(box.outline && box.outline.length >= 6 ? [box.outline] : []),
    ...(box.extraOutlines ?? []).filter((polygon) => polygon.length >= 6),
    ...(box.includePolygons ?? []).filter((polygon) => polygon.length >= 6),
  ].map(toLocal);
  const kept = shapes.length ? keepPixelsInsidePolygons(content, shapes) : cropToIllustrationShape(content);
  const exclude = (box.excludePolygons ?? []).filter((polygon) => polygon.length >= 6).map(toLocal);
  return exclude.length ? punchPolygons(kept, exclude) : kept;
}

/** Make every pixel inside any polygon transparent. */
export function punchPolygons(src: PixelBuffer, polygons: number[][]): PixelBuffer {
  const valid = polygons.filter((polygon) => polygon.length >= 6);
  if (!valid.length) return src;
  const buf = cloneBuffer(src);
  const { data, width, height } = buf;
  const punch = new Uint8Array(width * height);
  for (const polygon of valid) fillPolygon(punch, width, height, polygon);
  for (let p = 0, i = 3; p < punch.length; p++, i += 4) {
    if (punch[p]) data[i] = 0;
  }
  return buf;
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
    let content = cropBuffer(working, { x: box.x, y: box.y, w: box.w, h: box.h });
    if (_kind === 'maze') content = cropMazeSlot(content, box);
    pieces.push({
      item: items[i],
      content,
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
        sourceDataUrl: emptyPng(64, 64),
        sourceWidth: 64,
        sourceHeight: 64,
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
    const dataUrl = bufferToDataUrl(out);
    return {
      slotId: item.slotId,
      name: item.name,
      dataUrl,
      blank: false,
      width: out.width,
      height: out.height,
      sourceDataUrl: dataUrl,
      sourceWidth: out.width,
      sourceHeight: out.height,
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
  const original = await loadImageBuffer(originalSrc, SHEET_WORKING_MAX_SIDE);
  await yieldFrame();
  const config: SpriteSheetCropConfig = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      normalizeMode: defaultNormalizeMode(kind),
      ...options,
    },
    original.width,
    original.height
  );
  const cache = buildAnalysisCache(original, config);

  onStatus?.('Finding crop lines...');
  await yieldFrame();
  const grid =
    kind === 'maze' && cols * rows >= items.length
      ? { columns: cols, rows }
      : resolveSheetGrid(original.width, original.height, items.length, cols, rows);
  const gridCols = grid.columns;
  const gridRows = grid.rows;
  const crop = autoFixCrop(cache, items, gridCols, gridRows, config);
  const savedBoxes = config.boxes ?? [];
  const keepSavedMaze = kind === 'maze' && savedBoxesMatchItems(savedBoxes, items);
  const detected = keepSavedMaze
    ? savedBoxes
    : kind === 'maze'
      ? tightInkBoxes(original, items, gridCols, gridRows)
      : buildSlotBoxes(cache, items, gridCols, gridRows, crop.xs, crop.ys, config.padPercent);
  const boxes = keepSavedMaze
    ? savedBoxes
    : kind === 'maze'
      ? detected
      : cropBoxesForItems(items, original.width, original.height, gridCols, gridRows, detected, savedBoxes);

  onStatus?.('Creating crops...');
  await yieldFrame();
  const working = applySheetEffects(original, config);
  const nextConfig = { ...config, xs: crop.xs, ys: crop.ys, boxes, gridCols, gridRows };
  const assets = extractSlotAssets(working, items, gridCols, gridRows, crop.xs, crop.ys, nextConfig, kind);
  const workingSrc = sheetPreviewSrc(originalSrc, original, working);
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
