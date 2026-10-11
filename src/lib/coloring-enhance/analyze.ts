import { AUTO_ENHANCE_MAX_SIDE } from '@/lib/auto-enhance';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import type { ColoringBackgroundKind, ColoringSourceProfile } from './types';

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function svgHasTrueVectorPaths(svgText: string | undefined): boolean {
  if (!svgText) return false;
  const markup = svgText.toLowerCase();
  const hasPath = /<(path|polygon|polyline|circle|ellipse|rect|line)\b/.test(markup);
  const wrappedRaster = /<image\b/.test(markup) && !hasPath;
  return hasPath && !wrappedRaster;
}

export function analyzeColoringSource(
  src: PixelBuffer,
  options: { isSvg?: boolean; svgText?: string } = {}
): ColoringSourceProfile {
  const { data, width, height } = src;
  let transparent = 0;
  let nearWhite = 0;
  let offWhite = 0;
  let ink = 0;
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      transparent += 1;
      continue;
    }
    opaque += 1;
    const lum = luminance(data[i], data[i + 1], data[i + 2]);
    if (lum >= 248) nearWhite += 1;
    else if (lum >= 232) offWhite += 1;
    if (lum < 140) ink += 1;
  }
  const pixels = Math.max(1, width * height);
  let background: ColoringBackgroundKind = 'unknown';
  if (transparent / pixels > 0.08) background = 'transparent';
  else if (nearWhite / Math.max(1, opaque) > 0.45) background = 'white';
  else if ((nearWhite + offWhite) / Math.max(1, opaque) > 0.4) background = 'off-white';

  const longSide = Math.max(width, height);
  const lowResolution = longSide < 700;
  const printLongSide = lowResolution
    ? Math.min(AUTO_ENHANCE_MAX_SIDE, 1400)
    : Math.min(AUTO_ENHANCE_MAX_SIDE, Math.max(longSide, 1000));

  return {
    width,
    height,
    background,
    isSvg: Boolean(options.isSvg),
    hasVectorPaths: svgHasTrueVectorPaths(options.svgText),
    lowResolution,
    inkRatio: ink / pixels,
    printLongSide,
  };
}

export function fileStem(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim() || 'image';
  return base.replace(/[<>:"/\\|?*]+/g, '-').slice(0, 80);
}

export function isColoringImageFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/png' ||
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/webp' ||
    type === 'image/svg+xml' ||
    /\.(png|jpe?g|webp|svg)$/.test(name)
  );
}

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}
