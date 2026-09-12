import type { BackgroundAnalysis, RgbColor } from './types';
import { colorDistance, luminance, rgbToHex } from './geometry';

function samplePixel(data: Uint8ClampedArray, width: number, x: number, y: number): RgbColor {
  const i = (y * width + x) * 4;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

function medianChannel(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 255;
}

function quantizeKey(color: RgbColor): string {
  return `${color.r >> 4}-${color.g >> 4}-${color.b >> 4}`;
}

export function analyzeBackground(imageData: ImageData): BackgroundAnalysis {
  const { data, width, height } = imageData;
  const samples: RgbColor[] = [];
  const cols = 10;
  const rows = 10;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = Math.min(width - 1, Math.floor(((col + 0.5) / cols) * width));
      const y = Math.min(height - 1, Math.floor(((row + 0.5) / rows) * height));
      samples.push(samplePixel(data, width, x, y));
    }
  }

  const light = samples.filter((sample) => luminance(sample) > 228);
  const pool = light.length >= 8 ? light : samples;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  for (const sample of pool) {
    const key = quantizeKey(sample);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += sample.r;
      bucket.g += sample.g;
      bucket.b += sample.b;
    } else {
      buckets.set(key, { count: 1, r: sample.r, g: sample.g, b: sample.b });
    }
  }
  let best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
  const color: RgbColor = best
    ? {
        r: Math.round(best.r / best.count),
        g: Math.round(best.g / best.count),
        b: Math.round(best.b / best.count),
      }
    : {
        r: medianChannel(pool.map((s) => s.r)),
        g: medianChannel(pool.map((s) => s.g)),
        b: medianChannel(pool.map((s) => s.b)),
      };

  let variance = 0;
  for (const sample of pool) {
    const d = colorDistance(sample, color);
    variance += d * d;
  }
  variance /= Math.max(1, pool.length);

  const lum = luminance(color);
  const maxCh = Math.max(color.r, color.g, color.b);
  const minCh = Math.min(color.r, color.g, color.b);
  const sat = maxCh === 0 ? 0 : (maxCh - minCh) / maxCh;
  const isNearWhite = lum > 236 && sat < 0.1;
  const isTextured = variance > 220 || (!isNearWhite && sat > 0.14);

  return {
    color,
    hex: rgbToHex(color),
    isNearWhite,
    isTextured,
    keepRasterBackground: !isNearWhite && isTextured,
  };
}

export function isInkPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  background: RgbColor,
  threshold = 38
): boolean {
  if (a < 40) return false;
  return colorDistance({ r, g, b }, background) >= threshold;
}
