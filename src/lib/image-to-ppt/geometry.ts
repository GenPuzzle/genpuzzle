import type { PixelRect, RgbColor } from './types';

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function createLocalId(prefix = 'itp'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function padPageIndex(index: number): string {
  return String(index).padStart(3, '0');
}

export function hashString(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function rgbToHex(color: RgbColor): string {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${to(color.r)}${to(color.g)}${to(color.b)}`;
}

export function luminance(color: RgbColor): number {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

export function colorDistance(a: RgbColor, b: RgbColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function expandRect(rect: PixelRect, pad: number, maxW: number, maxH: number): PixelRect {
  const x = clamp(Math.floor(rect.x - pad), 0, maxW);
  const y = clamp(Math.floor(rect.y - pad), 0, maxH);
  const right = clamp(Math.ceil(rect.x + rect.width + pad), 0, maxW);
  const bottom = clamp(Math.ceil(rect.y + rect.height + pad), 0, maxH);
  return { x, y, width: Math.max(1, right - x), height: Math.max(1, bottom - y) };
}

export function rectsOverlap(a: PixelRect, b: PixelRect, gap = 0): boolean {
  return (
    a.x <= b.x + b.width + gap &&
    b.x <= a.x + a.width + gap &&
    a.y <= b.y + b.height + gap &&
    b.y <= a.y + a.height + gap
  );
}

export function overlapArea(a: PixelRect, b: PixelRect): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function rectIou(a: PixelRect, b: PixelRect): number {
  const overlap = overlapArea(a, b);
  const union = a.width * a.height + b.width * b.height - overlap;
  return overlap / Math.max(1, union);
}

export function rectContainsPoint(rect: PixelRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.width && y <= rect.y + rect.height;
}

export function horizontalOverlapRatio(a: PixelRect, b: PixelRect): number {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const overlap = Math.max(0, x2 - x1);
  return overlap / Math.max(1, Math.min(a.width, b.width));
}

export function unionRects(rects: PixelRect[]): PixelRect {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const rect of rects) {
    x1 = Math.min(x1, rect.x);
    y1 = Math.min(y1, rect.y);
    x2 = Math.max(x2, rect.x + rect.width);
    y2 = Math.max(y2, rect.y + rect.height);
  }
  return {
    x: x1 === Infinity ? 0 : x1,
    y: y1 === Infinity ? 0 : y1,
    width: x1 === Infinity ? 1 : Math.max(1, x2 - x1),
    height: y1 === Infinity ? 1 : Math.max(1, y2 - y1),
  };
}

export function rectCenterX(rect: PixelRect): number {
  return rect.x + rect.width / 2;
}

export function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'Page';
}

export function isSupportedImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    /\.(png|jpe?g|webp)$/.test(name)
  );
}

export function scaleRect(
  rect: PixelRect,
  fromW: number,
  fromH: number,
  toW: number,
  toH: number
): PixelRect {
  const sx = toW / Math.max(1, fromW);
  const sy = toH / Math.max(1, fromH);
  return {
    x: rect.x * sx,
    y: rect.y * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  };
}

export function imageRectToContentPercent(
  rect: PixelRect,
  imageW: number,
  imageH: number,
  pageWidthPx: number,
  pageHeightPx: number,
  marginPx: number
): { xPercent: number; yPercent: number; widthPercent: number; heightPercent: number } {
  const contentW = Math.max(1, pageWidthPx - marginPx * 2);
  const contentH = Math.max(1, pageHeightPx - marginPx * 2);
  const pageX = (rect.x / Math.max(1, imageW)) * pageWidthPx;
  const pageY = (rect.y / Math.max(1, imageH)) * pageHeightPx;
  const pageW = (rect.width / Math.max(1, imageW)) * pageWidthPx;
  const pageH = (rect.height / Math.max(1, imageH)) * pageHeightPx;
  return {
    xPercent: ((pageX - marginPx) / contentW) * 100,
    yPercent: ((pageY - marginPx) / contentH) * 100,
    widthPercent: (pageW / contentW) * 100,
    heightPercent: (pageH / contentH) * 100,
  };
}

export function svgToDataUrl(svg: string): string {
  const bytes = unescape(encodeURIComponent(svg));
  const b64 =
    typeof btoa === 'function'
      ? btoa(bytes)
      : Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}
