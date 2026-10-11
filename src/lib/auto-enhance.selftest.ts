import { autoEnhanceLineArt, mazeImagePrintLongSidePx, AUTO_ENHANCE_PAD } from './auto-enhance';
import type { PixelBuffer } from './sprite-sheet-importer';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function blank(width: number, height: number): PixelBuffer {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function setPixel(buf: PixelBuffer, x: number, y: number, r: number, g: number, b: number, a: number): void {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return;
  const i = (y * buf.width + x) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = a;
}

function rect(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, r: number, g: number, b: number, a: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) setPixel(buf, x, y, r, g, b, a);
  }
}

function inkAt(buf: PixelBuffer, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return false;
  const i = (y * buf.width + x) * 4;
  return buf.data[i + 3] >= 128 && buf.data[i] < 140;
}

function opaqueAt(buf: PixelBuffer, x: number, y: number): boolean {
  return buf.data[(y * buf.width + x) * 4 + 3] >= 128;
}

function countInk(buf: PixelBuffer): number {
  let n = 0;
  for (let i = 0; i < buf.data.length; i += 4) {
    if (buf.data[i + 3] >= 128 && buf.data[i] < 80) n += 1;
  }
  return n;
}

export function runAutoEnhanceChecks(): void {
  const print = mazeImagePrintLongSidePx(100);
  assert(print >= 240 && print <= 500, `100% maze art should target about 600 PPI, got ${print}px`);

  const stairs = blank(48, 24);
  for (let i = 0; i < 16; i++) {
    setPixel(stairs, 8 + i, 8 + (i % 2), 0, 0, 0, 255);
    setPixel(stairs, 8 + i, 9 + (i % 2), 0, 0, 0, 255);
  }
  const enhancedStairs = autoEnhanceLineArt(stairs, { printLongSide: 96 });
  assert(enhancedStairs.applied, 'jagged line art should be enhanced');
  assert(enhancedStairs.image.width > stairs.width, 'print-size output is larger than the pixelated source');
  assert(countInk(enhancedStairs.image) > 20, 'the reconstructed line stays visible');
  assert(!!enhancedStairs.svg && enhancedStairs.svg.includes('<path'), 'enhance writes SVG paths for the cleaned lines');
  const pathPoints = [...(enhancedStairs.svg.match(/[\d]+\.[\d]+/g) ?? [])];
  assert(pathPoints.length >= 8, 'the SVG path uses subpixel points instead of pixel stairs');
  const pixelStairs = nearestScale(stairs, enhancedStairs.image.width, enhancedStairs.image.height, AUTO_ENHANCE_PAD);
  const enhancedScore = stairScore(enhancedStairs.image);
  const pixelScore = stairScore(pixelStairs);
  if (pixelScore > 0) {
    assert(enhancedScore < pixelScore * 0.85, 'enhanced lines should be smoother than a nearest-neighbor upscale');
  }

  const thin = blank(40, 24);
  for (let x = 6; x < 34; x++) setPixel(thin, x, 12, 0, 0, 0, 255);
  setPixel(thin, 20, 6, 0, 0, 0, 255);
  const enhancedThin = autoEnhanceLineArt(thin, { printLongSide: 80 });
  assert(enhancedThin.applied, 'a thin line with a disconnected mark is enhanced');
  const mid = Math.floor(enhancedThin.image.height / 2);
  let lineInk = 0;
  for (let x = AUTO_ENHANCE_PAD + 4; x < enhancedThin.image.width - AUTO_ENHANCE_PAD - 4; x++) {
    if (inkAt(enhancedThin.image, x, mid) || inkAt(enhancedThin.image, x, mid - 1) || inkAt(enhancedThin.image, x, mid + 1)) {
      lineInk += 1;
    }
  }
  assert(lineInk > 20, 'the thin stroke survives enhancement');
  let mark = 0;
  for (let y = 0; y < Math.floor(enhancedThin.image.height * 0.45); y++) {
    for (let x = 0; x < enhancedThin.image.width; x++) {
      if (inkAt(enhancedThin.image, x, y)) mark += 1;
    }
  }
  assert(mark > 0, 'a disconnected intentional mark stays in the result');

  const noisy = blank(36, 36);
  rect(noisy, 10, 10, 26, 26, 0, 0, 0, 255);
  rect(noisy, 13, 13, 23, 23, 255, 255, 255, 255);
  setPixel(noisy, 2, 2, 0, 0, 0, 255);
  const enhancedBox = autoEnhanceLineArt(noisy, { printLongSide: 72 });
  assert(enhancedBox.applied, 'a box with interior fill is enhanced');
  assert(!opaqueAt(enhancedBox.image, 1, 1), 'the exterior stays transparent');
  const cx = Math.floor(enhancedBox.image.width / 2);
  const cy = Math.floor(enhancedBox.image.height / 2);
  assert(opaqueAt(enhancedBox.image, cx, cy), 'the enclosed white fill stays opaque');
  assert(enhancedBox.image.data[(cy * enhancedBox.image.width + cx) * 4] > 200, 'the interior stays white, not black');

  const two = blank(48, 20);
  rect(two, 4, 6, 14, 14, 0, 0, 0, 255);
  rect(two, 34, 6, 44, 14, 0, 0, 0, 255);
  const enhancedTwo = autoEnhanceLineArt(two, { printLongSide: 80 });
  assert(enhancedTwo.applied, 'two separate shapes are enhanced');
  const left = countInkRegion(enhancedTwo.image, 0, Math.floor(enhancedTwo.image.width * 0.45));
  const right = countInkRegion(enhancedTwo.image, Math.floor(enhancedTwo.image.width * 0.55), enhancedTwo.image.width);
  assert(left > 8 && right > 8, 'both disconnected parts stay present');

  const edge = blank(28, 28);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) setPixel(edge, x, y, 0, 0, 0, 255);
  }
  const enhancedEdge = autoEnhanceLineArt(edge, { printLongSide: 56 });
  assert(enhancedEdge.applied, 'art touching the crop edge is enhanced');
  assert(enhancedEdge.image.width >= 28 + AUTO_ENHANCE_PAD, 'processed edges get transparent padding');
  assert(!opaqueAt(enhancedEdge.image, 0, enhancedEdge.image.height - 1), 'padding outside the drawing stays transparent');

  const mush = blank(24, 24);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) setPixel(mush, x, y, 140, 140, 140, 255);
  }
  const skipped = autoEnhanceLineArt(mush, { printLongSide: 48 });
  assert(!skipped.applied, 'a low-contrast mush is not forced through enhancement');
  assert(skipped.message && skipped.message.length > 8, 'a skipped enhance explains why the original was kept');
  assert(skipped.image.width === 24 && skipped.image.height === 24, 'the original crop size is preserved when enhance is skipped');

  const ratio = enhancedStairs.image.width / enhancedStairs.image.height;
  const srcRatio = stairs.width / stairs.height;
  assert(Math.abs(ratio - srcRatio) < 0.4, 'padding keeps the illustration aspect close to the crop');
}

function nearestScale(src: PixelBuffer, outW: number, outH: number, pad: number): PixelBuffer {
  const out = blank(outW, outH);
  const contentW = Math.max(1, outW - pad * 2);
  const contentH = Math.max(1, outH - pad * 2);
  for (let y = pad; y < outH - pad; y++) {
    const sy = Math.min(src.height - 1, Math.floor(((y - pad) * src.height) / contentH));
    for (let x = pad; x < outW - pad; x++) {
      const sx = Math.min(src.width - 1, Math.floor(((x - pad) * src.width) / contentW));
      const si = (sy * src.width + sx) * 4;
      const di = (y * outW + x) * 4;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function stairScore(buf: PixelBuffer): number {
  let stairs = 0;
  for (let y = 1; y < buf.height - 1; y++) {
    for (let x = 1; x < buf.width - 1; x++) {
      if (!inkAt(buf, x, y)) continue;
      const n = inkAt(buf, x, y - 1);
      const s = inkAt(buf, x, y + 1);
      const e = inkAt(buf, x + 1, y);
      const w = inkAt(buf, x - 1, y);
      if (n && s && e && w) continue;
      const stair =
        (!n && !e && inkAt(buf, x + 1, y - 1)) ||
        (!n && !w && inkAt(buf, x - 1, y - 1)) ||
        (!s && !e && inkAt(buf, x + 1, y + 1)) ||
        (!s && !w && inkAt(buf, x - 1, y + 1));
      if (stair) stairs += 1;
    }
  }
  return stairs;
}

function countInkRegion(buf: PixelBuffer, x0: number, x1: number): number {
  let n = 0;
  for (let y = 0; y < buf.height; y++) {
    for (let x = x0; x < x1; x++) {
      if (inkAt(buf, x, y)) n += 1;
    }
  }
  return n;
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  runAutoEnhanceChecks();
  console.log('auto-enhance.selftest ok');
}
