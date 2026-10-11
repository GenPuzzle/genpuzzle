import { convertPixels, type Options } from '@visioncortex/vtracer';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import { rasterizeTracedSvg, sanitizeTracedSvg, upscaleRgba } from './svg-raster';
import type { ColoringEnhanceSettings } from './types';
import { normalizeColoringSettings } from './types';
import type { FaithfulTraceResult } from './vectorize';

export interface VectorEngine {
  name: string;
  vectorize(source: PixelBuffer, options: VtracerCandidate): FaithfulTraceResult;
}

export interface VtracerCandidate {
  name: string;
  threshold: number;
  upscale: number;
  settings?: ColoringEnhanceSettings;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, t));
}

/**
 * Adobe Illustrator Image Trace (Black and White) mapping from the golden reference:
 * Threshold 128, Paths 55%, Corners 100%, Noise 1 px, Abutting, Fills only, Ignore White.
 * lengthThreshold and filterSpeckle are expressed in the supersampled pixel grid.
 */
function adobeLikeOptions(threshold: number, scale: number): Options {
  return {
    preset: 'bw',
    clustering: 'bw',
    hierarchical: 'cutout',
    mode: 'spline',
    optimize: 0,
    binaryThreshold: threshold,
    filterSpeckle: Math.max(1, scale),
    pathPrecision: 5,
    lengthThreshold: 1.8 * scale,
    cornerThreshold: 20,
    spliceThreshold: 45,
    maxIterations: 10,
  };
}

/** Higher softness uses more supersamples for sub-pixel contour estimation. Never applies blur. */
export function settingsToUpscale(settings: ColoringEnhanceSettings): number {
  const soft = normalizeColoringSettings(settings).softness / 100;
  if (soft <= 0.5) return Math.round(lerp(2, 4, soft / 0.5));
  return Math.round(lerp(4, 5, (soft - 0.5) / 0.5));
}

/**
 * Higher gap preservation uses a darker-only ink threshold so close white channels stay open.
 * VTracer treats pixels darker than the threshold as foreground.
 */
export function settingsToThreshold(settings: ColoringEnhanceSettings): number {
  const gap = normalizeColoringSettings(settings).gapPreservation;
  if (gap <= 70) return Math.round(lerp(148, 128, gap / 70));
  return Math.round(lerp(128, 108, (gap - 70) / 30));
}

/**
 * Maps the Enhance Controls sliders onto real VTracer spline options.
 * Detail Preservation resists over-simplification without freezing all smoothing.
 */
export function settingsToVtracerOptions(
  settings: ColoringEnhanceSettings,
  scale: number,
  thresholdOverride?: number
): Options {
  const s = normalizeColoringSettings(settings);
  const smooth = s.smoothness / 100;
  const soft = s.softness / 100;
  const detail = s.detail / 100;
  const extraDetail = Math.max(0, (s.detail - 50) / 50);
  const smoothGain = smooth * (1 - 0.38 * extraDetail);

  const lengthThreshold = lerp(0.7, 3.0, smoothGain) * scale;
  let simplify: number | undefined;
  if (smoothGain > 0.48) {
    const raw = (0.25 + (smoothGain - 0.48) * 3.2) * (1 - 0.42 * extraDetail);
    if (raw >= 0.15) simplify = Number(raw.toFixed(3));
  }

  const cornerThreshold = Math.round(Math.max(10, Math.min(58, lerp(12, 48, soft) - extraDetail * 9)));
  const spliceThreshold = Math.round(Math.max(20, Math.min(78, lerp(28, 70, smoothGain) - extraDetail * 10)));
  const filterSpeckle = Math.max(1, Math.round(lerp(scale * 2.2, scale * 0.45, detail)));
  const maxIterations = Math.round(lerp(6, 16, soft));
  const pathPrecision = soft < 0.35 ? 4 : soft < 0.75 ? 5 : 6;

  return {
    preset: 'bw',
    clustering: 'bw',
    hierarchical: 'cutout',
    mode: 'spline',
    optimize: 0,
    binaryThreshold: Math.round(thresholdOverride ?? settingsToThreshold(s)),
    filterSpeckle,
    pathPrecision,
    lengthThreshold,
    cornerThreshold,
    spliceThreshold,
    maxIterations,
    ...(simplify != null ? { simplify } : {}),
  };
}

/**
 * Slight ink thickness change in the supersampled grid.
 * Positive = thicker, negative = thinner. Does not change curve-fitting options.
 */
export function settingsToWeightRadius(settings: ColoringEnhanceSettings, scale = 1): number {
  const t = (normalizeColoringSettings(settings).lineWeight - 50) / 50;
  if (Math.abs(t) < 0.08) return 0;
  const mag = Math.max(1, Math.round(Math.abs(t) * Math.max(1, scale * 0.35)));
  return t > 0 ? mag : -mag;
}

function adjustInkWeight(src: PixelBuffer, radius: number, threshold: number): PixelBuffer {
  if (radius === 0) return src;
  const { width, height, data } = src;
  const ink = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < ink.length; p += 1, i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    ink[p] = lum < threshold && data[i + 3] > 16 ? 1 : 0;
  }
  const r = Math.abs(radius);
  const dilate = radius > 0;
  const nextInk = new Uint8Array(ink);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let hit = dilate ? 0 : 1;
      outer: for (let dy = -r; dy <= r; dy += 1) {
        for (let dx = -r; dx <= r; dx += 1) {
          if (dx * dx + dy * dy > r * r) continue;
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const value = ink[yy * width + xx];
          if (dilate && value) {
            hit = 1;
            break outer;
          }
          if (!dilate && !value) {
            hit = 0;
            break outer;
          }
        }
      }
      nextInk[y * width + x] = hit;
    }
  }
  const next = new Uint8ClampedArray(data.length);
  for (let p = 0, i = 0; p < nextInk.length; p += 1, i += 4) {
    const tone = nextInk[p] ? 16 : 255;
    next[i] = tone;
    next[i + 1] = tone;
    next[i + 2] = tone;
    next[i + 3] = 255;
  }
  return { data: next, width, height };
}

export function settingsToVtracerCandidate(settings: ColoringEnhanceSettings): VtracerCandidate {
  const normalized = normalizeColoringSettings(settings);
  return {
    name: 'vtracer-custom',
    threshold: settingsToThreshold(normalized),
    upscale: settingsToUpscale(normalized),
    settings: normalized,
  };
}

function chooseScale(width: number, height: number, requested: number): number {
  const longSide = Math.max(width, height);
  let scale = Math.max(1, Math.round(requested));
  while (scale > 1 && longSide * scale > 3600) scale -= 1;
  return scale;
}

function flattenOntoWhite(src: PixelBuffer): PixelBuffer {
  const data = new Uint8ClampedArray(src.data);
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    data[i] = Math.round(data[i] * a + 255 * (1 - a));
    data[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
    data[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    data[i + 3] = 255;
  }
  return { data, width: src.width, height: src.height };
}

export function vectorizeWithVtracer(src: PixelBuffer, candidate: VtracerCandidate): FaithfulTraceResult {
  const flat = flattenOntoWhite(src);
  const scale = chooseScale(flat.width, flat.height, candidate.upscale);
  const options = candidate.settings
    ? settingsToVtracerOptions(candidate.settings, scale, candidate.threshold)
    : adobeLikeOptions(candidate.threshold, scale);
  let hi = scale > 1 ? upscaleRgba(flat, scale) : flat;
  if (candidate.settings) {
    const weight = settingsToWeightRadius(candidate.settings, scale);
    if (weight !== 0) hi = adjustInkWeight(hi, weight, options.binaryThreshold ?? candidate.threshold);
  }
  const raw = convertPixels(new Uint8Array(hi.data.buffer, hi.data.byteOffset, hi.data.byteLength), hi.width, hi.height, options);
  const svg = sanitizeTracedSvg(raw, src.width, src.height, scale);
  const proof = rasterizeTracedSvg(raw, src.width, src.height, scale);
  const preview = rasterizeTracedSvg(raw, src.width * 2, src.height * 2, scale / 2);
  return { svg, preview, proof };
}

export const VTRACER_CANDIDATES: VtracerCandidate[] = [
  { name: 'vtracer-adobe-128-4x', threshold: 128, upscale: 4 },
  { name: 'vtracer-adobe-120-4x', threshold: 120, upscale: 4 },
  { name: 'vtracer-adobe-136-3x', threshold: 136, upscale: 3 },
  { name: 'vtracer-adobe-128-2x', threshold: 128, upscale: 2 },
];

export const VtracerEngine: VectorEngine = {
  name: 'vtracer',
  vectorize: vectorizeWithVtracer,
};
