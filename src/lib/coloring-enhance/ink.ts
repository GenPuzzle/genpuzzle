import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function punchWhiteBackground(buf: PixelBuffer, threshold = 246): PixelBuffer {
  const data = new Uint8ClampedArray(buf.data);
  for (let i = 0; i < data.length; i += 4) {
    if (luminance(data[i], data[i + 1], data[i + 2]) >= threshold) data[i + 3] = 0;
  }
  return { data, width: buf.width, height: buf.height };
}

export function extractInkMask(src: PixelBuffer, threshold = 168): Uint8Array {
  const { data, width, height } = src;
  const ink = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) {
    if (data[i + 3] < 16) continue;
    if (luminance(data[i], data[i + 1], data[i + 2]) < threshold) ink[p] = 1;
  }
  dropIsolatedPixels(ink, width, height);
  return ink;
}

function dropIsolatedPixels(ink: Uint8Array, width: number, height: number): void {
  const drop: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (!ink[p]) continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (ink[(y + dy) * width + (x + dx)]) n += 1;
        }
      }
      if (n === 0) drop.push(p);
    }
  }
  for (const p of drop) ink[p] = 0;
}

export function bilinearLuminance(src: PixelBuffer, scale: number): { lum: Float32Array; width: number; height: number } {
  const width = src.width * scale;
  const height = src.height * scale;
  const lum = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / scale - 0.5;
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const ty = Math.max(0, Math.min(1, fy - y0));
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / scale - 0.5;
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const tx = Math.max(0, Math.min(1, fx - x0));
      const sample = (sx: number, sy: number) => {
        const i = (sy * src.width + sx) * 4;
        if (src.data[i + 3] < 16) return 255;
        return luminance(src.data[i], src.data[i + 1], src.data[i + 2]);
      };
      const a = sample(x0, y0);
      const b = sample(x1, y0);
      const c = sample(x0, y1);
      const d = sample(x1, y1);
      lum[y * width + x] = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    }
  }
  return { lum, width, height };
}

export function maskFromLuminance(lum: Float32Array, threshold: number): Uint8Array {
  const ink = new Uint8Array(lum.length);
  for (let i = 0; i < lum.length; i++) if (lum[i] < threshold) ink[i] = 1;
  return ink;
}

export function maskToBuffer(mask: Uint8Array, width: number, height: number): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const v = mask[p] ? 17 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return { data, width, height };
}
