export type ImageBlockEffect = 'none' | 'grayscale' | 'coloring-page';

export interface ImageEffectOptions {
  maxDimension?: number;
  lumCutoff?: number;
  satCutoff?: number;
  alphaCutoff?: number;
  edgeThreshold?: number;
  edgePercent?: number;
  grayscaleContrast?: number;
}

export type ImageEffectResult = {
  src: string;
  coloringPageViable?: boolean;
};

export const IMAGE_BLOCK_EFFECT_OPTIONS: Array<{
  value: ImageBlockEffect;
  label: string;
  description: string;
}> = [
  { value: 'none', label: 'Original', description: 'Full-color image' },
  {
    value: 'grayscale',
    label: 'Black & White',
    description: 'Convert to grayscale',
  },
  {
    value: 'coloring-page',
    label: 'Coloring Page',
    description: 'AI coloring page style — coming soon',
  },
];

/** UI percent defaults (0–100) */
export const DEFAULT_IMAGE_EFFECT_LUM_CUTOFF = 0;
export const DEFAULT_IMAGE_EFFECT_SAT_CUTOFF = 0;
export const DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD = 100;
export const MAX_IMAGE_EFFECT_EDGE_THRESHOLD = 100;
export const DEFAULT_IMAGE_GRAYSCALE_CONTRAST = 50;
export const DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE = 40;

const MIN_STROKE_COVERAGE = 0.0015;
const MIN_STROKE_PIXELS = 64;
const MIN_SOURCE_THIN_INK_PIXELS = 400;
const MIN_SOURCE_INK_PIXELS = 600;
const MIN_SOURCE_INK_COVERAGE = 0.012;
const LOW_INK_SPARSE_THIN_PIXELS = 1200;
const FILL_ART_BLOB_RATIO = 0.82;
const FILL_ART_THIN_RATIO = 0.1;
const SOLID_INK_BLOB_AREA = 0.02;
const SOLID_INK_BLOB_PERIMETER = 0.12;
const NOISY_EDGE_MAX_SOURCE_INK = 0.04;
const NOISY_EDGE_MIN_COVERAGE = 0.04;
const NOISY_EDGE_MAX_COVERAGE = 0.14;
const NOISY_EDGE_THIN_RATIO = 0.55;

export function imageEffectCssFilter(_effect?: ImageBlockEffect): string | undefined {
  return undefined;
}

function clampEdgePercent(percent: number): number {
  return Math.max(0, Math.min(MAX_IMAGE_EFFECT_EDGE_THRESHOLD, percent));
}

function percentToEdgeThreshold(percent: number): number {
  const p = clampEdgePercent(percent);
  return Math.round(50 - (p / 100) * 30);
}

function percentToMinLocalContrast(percent: number): number {
  const p = clampEdgePercent(percent);
  if (p <= 20) return 0;
  return Math.round(((p - 20) / 80) * 42);
}

function percentToInkLumStrictness(percent: number): number {
  const p = clampEdgePercent(percent);
  if (p <= 45) return 0;
  return Math.round(((p - 45) / 55) * 26);
}

function percentToMinSpeckleArea(percent: number): number {
  const p = clampEdgePercent(percent);
  if (p <= 40) return 1;
  return Math.round(1 + ((p - 40) / 60) * 28);
}

function percentToMorphOpenPasses(percent: number): number {
  const p = clampEdgePercent(percent);
  if (p <= 35) return 0;
  if (p <= 75) return 1;
  return 2;
}

function percentToLumCutoff(percent: number): number {
  return Math.round(20 + (percent / 100) * 140);
}

function percentToSatCutoff(percent: number): number {
  return (percent / 100) * 0.7;
}

function percentToGrayscaleContrast(percent: number): number {
  return Math.round(50 + percent * 1.5);
}

function percentToBgTolerance(percent: number): number {
  return Math.round(8 + (percent / 100) * 72);
}

export function buildImageEffectOptions(block: {
  imageEffectLumCutoff?: number;
  imageEffectSatCutoff?: number;
  imageEffectEdgeThreshold?: number;
  imageGrayscaleContrast?: number;
}): ImageEffectOptions {
  const inkPercent = block.imageEffectLumCutoff ?? DEFAULT_IMAGE_EFFECT_LUM_CUTOFF;
  const satPercent = block.imageEffectSatCutoff ?? DEFAULT_IMAGE_EFFECT_SAT_CUTOFF;
  const edgePercent = block.imageEffectEdgeThreshold ?? DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD;
  const contrastPercent = block.imageGrayscaleContrast ?? DEFAULT_IMAGE_GRAYSCALE_CONTRAST;

  return {
    lumCutoff: percentToLumCutoff(inkPercent),
    satCutoff: percentToSatCutoff(satPercent),
    edgeThreshold: percentToEdgeThreshold(edgePercent),
    edgePercent: clampEdgePercent(edgePercent),
    grayscaleContrast: percentToGrayscaleContrast(contrastPercent),
  };
}

export function buildBgRemovalTolerancePercent(block: {
  imageBgRemovalTolerance?: number;
}): number {
  return percentToBgTolerance(
    block.imageBgRemovalTolerance ?? DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE
  );
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for effect processing.'));
    img.src = src;
  });
}

function toGrayscaleArray(data: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }
  return gray;
}

function blur5x5(src: Float32Array, width: number, height: number): Float32Array {
  const temp = blur3x3(src, width, height);
  return blur3x3(temp, width, height);
}

function localLuminanceStats(
  gray: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number
): { mean: number; variance: number } {
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let dy = -2; dy <= 2; dy += 1) {
    const sy = Math.min(height - 1, Math.max(0, y + dy));
    for (let dx = -2; dx <= 2; dx += 1) {
      const sx = Math.min(width - 1, Math.max(0, x + dx));
      const value = gray[sy * width + sx];
      sum += value;
      sumSq += value * value;
      count += 1;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return { mean, variance };
}

function isHalftoneShadingPixel(
  gray: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  lum: number,
  saturation: number,
  edgePercent: number
): boolean {
  if (edgePercent < 30 || lum > 105) return false;

  const { mean, variance } = localLuminanceStats(gray, x, y, width, height);
  const textureStrength = Math.max(0, variance);

  if (edgePercent >= 55 && saturation > 0.12 && lum < 95 && textureStrength > 90) {
    return true;
  }

  if (edgePercent >= 40 && lum > 18 && lum < 115 && textureStrength > 160 && Math.abs(mean - lum) < 28) {
    return true;
  }

  return false;
}

function blur3x3(src: Float32Array, width: number, height: number): Float32Array {
  const out = new Float32Array(src.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let count = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        const sy = Math.min(height - 1, Math.max(0, y + ky));
        for (let kx = -1; kx <= 1; kx += 1) {
          const sx = Math.min(width - 1, Math.max(0, x + kx));
          sum += src[sy * width + sx];
          count += 1;
        }
      }
      out[y * width + x] = sum / count;
    }
  }
  return out;
}

function sampleEdgeContrast(
  gray: Float32Array,
  x: number,
  y: number,
  width: number,
  height: number,
  gx: number,
  gy: number
): number {
  const mag = Math.hypot(gx, gy);
  if (mag < 0.001) return 0;

  const step = 2;
  const dx = Math.round((gx / mag) * step);
  const dy = Math.round((gy / mag) * step);
  const posX = Math.min(width - 1, Math.max(0, x + dx));
  const posY = Math.min(height - 1, Math.max(0, y + dy));
  const negX = Math.min(width - 1, Math.max(0, x - dx));
  const negY = Math.min(height - 1, Math.max(0, y - dy));
  const pos = gray[posY * width + posX];
  const neg = gray[negY * width + negX];
  return Math.abs(pos - neg);
}

function computeThinEdgeMask(
  gray: Float32Array,
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
  threshold: number,
  alphaCutoff: number,
  minLocalContrast = 0
): Uint8Array {
  const magnitude = new Float32Array(width * height);
  const direction = new Uint8Array(width * height);
  const gxMap = new Float32Array(width * height);
  const gyMap = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      if (alpha[idx] <= alphaCutoff) continue;

      const a = gray[(y - 1) * width + (x - 1)];
      const b = gray[(y - 1) * width + x];
      const c = gray[(y - 1) * width + (x + 1)];
      const d = gray[y * width + (x - 1)];
      const f = gray[y * width + (x + 1)];
      const g = gray[(y + 1) * width + (x - 1)];
      const h = gray[(y + 1) * width + x];
      const i = gray[(y + 1) * width + (x + 1)];

      const gx = -a + c - 2 * d + 2 * f - g + i;
      const gy = a + 2 * b + c - g - 2 * h - i;
      gxMap[idx] = gx;
      gyMap[idx] = gy;
      magnitude[idx] = Math.hypot(gx, gy);

      const angle = (Math.atan2(gy, gx) * 180) / Math.PI;
      const normalized = angle < 0 ? angle + 180 : angle;
      if (normalized < 22.5 || normalized >= 157.5) direction[idx] = 0;
      else if (normalized < 67.5) direction[idx] = 1;
      else if (normalized < 112.5) direction[idx] = 2;
      else direction[idx] = 3;
    }
  }

  const edges = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x;
      const mag = magnitude[idx];
      if (mag < threshold || alpha[idx] <= alphaCutoff) continue;

      if (minLocalContrast > 0) {
        const contrast = sampleEdgeContrast(gray, x, y, width, height, gxMap[idx], gyMap[idx]);
        if (contrast < minLocalContrast) continue;
      }

      let n1 = 0;
      let n2 = 0;
      switch (direction[idx]) {
        case 0:
          n1 = magnitude[idx - 1];
          n2 = magnitude[idx + 1];
          break;
        case 1:
          n1 = magnitude[(y - 1) * width + (x + 1)];
          n2 = magnitude[(y + 1) * width + (x - 1)];
          break;
        case 2:
          n1 = magnitude[(y - 1) * width + x];
          n2 = magnitude[(y + 1) * width + x];
          break;
        default:
          n1 = magnitude[(y - 1) * width + (x - 1)];
          n2 = magnitude[(y + 1) * width + (x + 1)];
          break;
      }

      if (mag >= n1 && mag >= n2) {
        edges[idx] = 1;
      }
    }
  }

  return edges;
}

function measureStrokeCoverage(buffer: Uint8ClampedArray): {
  strokePixels: number;
  opaquePixels: number;
  coverage: number;
} {
  let strokePixels = 0;
  let opaquePixels = 0;

  for (let i = 0; i < buffer.length; i += 4) {
    if (buffer[i + 3] <= 16) continue;
    opaquePixels += 1;
    if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0) {
      strokePixels += 1;
    }
  }

  return {
    strokePixels,
    opaquePixels,
    coverage: opaquePixels > 0 ? strokePixels / opaquePixels : 0,
  };
}

function isInkPixel(r: number, g: number, b: number): boolean {
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;
  return lum <= 88 && (saturation <= 0.38 || lum <= 58);
}

function buildInkMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaCutoff = 16
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] <= alphaCutoff) continue;
      if (isInkPixel(data[i], data[i + 1], data[i + 2])) {
        mask[y * width + x] = 1;
      }
    }
  }
  return mask;
}

function measureInkLineStructure(
  mask: Uint8Array,
  width: number,
  height: number
): {
  inkPixels: number;
  thinInkPixels: number;
  blobInkPixels: number;
  thinRatio: number;
  blobRatio: number;
} {
  let inkPixels = 0;
  let thinInkPixels = 0;
  let blobInkPixels = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (!mask[p]) continue;
      inkPixels += 1;

      let neighbors = 0;
      if (mask[p - 1]) neighbors += 1;
      if (mask[p + 1]) neighbors += 1;
      if (mask[p - width]) neighbors += 1;
      if (mask[p + width]) neighbors += 1;

      if (neighbors <= 2) {
        thinInkPixels += 1;
      } else if (neighbors >= 4) {
        blobInkPixels += 1;
      }
    }
  }

  return {
    inkPixels,
    thinInkPixels,
    blobInkPixels,
    thinRatio: inkPixels > 0 ? thinInkPixels / inkPixels : 0,
    blobRatio: inkPixels > 0 ? blobInkPixels / inkPixels : 0,
  };
}

function measureLargestInkBlob(
  mask: Uint8Array,
  width: number,
  height: number,
  opaquePixels: number
): { areaRatio: number; perimeterArea: number } {
  const visited = new Uint8Array(width * height);
  let largestArea = 0;
  let largestPerimeter = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      const stack = [start];
      visited[start] = 1;
      let area = 0;
      let perimeter = 0;

      while (stack.length > 0) {
        const p = stack.pop()!;
        area += 1;
        const px = p % width;
        const py = (p / width) | 0;

        let edge = false;
        const neighbors = [
          p - 1,
          p + 1,
          p - width,
          p + width,
        ];

        for (const np of neighbors) {
          const nx = np % width;
          const ny = (np / width) | 0;
          if (np < 0 || np >= mask.length || Math.abs(nx - px) + Math.abs(ny - py) !== 1) {
            edge = true;
            continue;
          }
          if (!mask[np]) {
            edge = true;
            continue;
          }
          if (!visited[np]) {
            visited[np] = 1;
            stack.push(np);
          }
        }

        if (edge) perimeter += 1;
      }

      if (area > largestArea) {
        largestArea = area;
        largestPerimeter = perimeter;
      }
    }
  }

  return {
    areaRatio: opaquePixels > 0 ? largestArea / opaquePixels : 0,
    perimeterArea: largestArea > 0 ? largestPerimeter / largestArea : 0,
  };
}

function countOpaquePixels(data: Uint8ClampedArray, alphaCutoff = 16): number {
  let opaquePixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > alphaCutoff) opaquePixels += 1;
  }
  return opaquePixels;
}

function hasSourceLineArt(
  data: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  const opaquePixels = countOpaquePixels(data);
  if (opaquePixels === 0) return false;

  const inkMask = buildInkMask(data, width, height);
  const structure = measureInkLineStructure(inkMask, width, height);
  const largestBlob = measureLargestInkBlob(inkMask, width, height, opaquePixels);
  const inkCoverage = structure.inkPixels / opaquePixels;

  if (structure.blobRatio > FILL_ART_BLOB_RATIO && structure.thinRatio < FILL_ART_THIN_RATIO) {
    return false;
  }

  if (
    largestBlob.areaRatio > SOLID_INK_BLOB_AREA &&
    largestBlob.perimeterArea < SOLID_INK_BLOB_PERIMETER
  ) {
    return false;
  }

  if (structure.thinInkPixels < MIN_SOURCE_THIN_INK_PIXELS) {
    return false;
  }

  if (structure.inkPixels < MIN_SOURCE_INK_PIXELS) {
    return false;
  }

  if (inkCoverage < MIN_SOURCE_INK_COVERAGE && structure.thinInkPixels < LOW_INK_SPARSE_THIN_PIXELS) {
    return false;
  }

  return true;
}

function measureProcessedLineQuality(
  buffer: Uint8ClampedArray,
  width: number,
  height: number
): {
  strokePixels: number;
  thinStrokePixels: number;
  thinRatio: number;
} {
  const strokeMask = new Uint8Array(width * height);
  let strokePixels = 0;

  for (let p = 0, i = 0; i < buffer.length; i += 4, p += 1) {
    if (buffer[i + 3] <= 16) continue;
    if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0) {
      strokeMask[p] = 1;
      strokePixels += 1;
    }
  }

  let thinStrokePixels = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (!strokeMask[p]) continue;

      let neighbors = 0;
      if (strokeMask[p - 1]) neighbors += 1;
      if (strokeMask[p + 1]) neighbors += 1;
      if (strokeMask[p - width]) neighbors += 1;
      if (strokeMask[p + width]) neighbors += 1;

      if (neighbors <= 2) {
        thinStrokePixels += 1;
      }
    }
  }

  return {
    strokePixels,
    thinStrokePixels,
    thinRatio: strokePixels > 0 ? thinStrokePixels / strokePixels : 0,
  };
}

function isColoringPageViable(
  processed: Uint8ClampedArray,
  sourceData: Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  if (!hasSourceLineArt(sourceData, width, height)) {
    return false;
  }

  const opaquePixels = countOpaquePixels(sourceData);
  const sourceInkMask = buildInkMask(sourceData, width, height);
  const sourceStructure = measureInkLineStructure(sourceInkMask, width, height);
  const sourceInkCoverage =
    opaquePixels > 0 ? sourceStructure.inkPixels / opaquePixels : 0;

  const { strokePixels, coverage } = measureStrokeCoverage(processed);

  if (strokePixels < MIN_STROKE_PIXELS || coverage < MIN_STROKE_COVERAGE) {
    return false;
  }

  if (
    sourceInkCoverage < NOISY_EDGE_MAX_SOURCE_INK &&
    coverage > NOISY_EDGE_MIN_COVERAGE &&
    coverage < NOISY_EDGE_MAX_COVERAGE
  ) {
    const lineQuality = measureProcessedLineQuality(processed, width, height);
    if (lineQuality.thinRatio > NOISY_EDGE_THIN_RATIO) {
      return false;
    }
  }

  return true;
}

function pruneInteriorTexture(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  edgePercent: number,
  alphaCutoff: number
): void {
  const minArea = percentToMinSpeckleArea(edgePercent);
  if (minArea <= 1) return;

  const strokeMask = new Uint8Array(width * height);
  for (let p = 0, i = 0; i < out.length; i += 4, p += 1) {
    if (out[i + 3] <= alphaCutoff) continue;
    if (out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0) {
      strokeMask[p] = 1;
    }
  }

  const visited = new Uint8Array(width * height);
  const removeMask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const start = y * width + x;
      if (!strokeMask[start] || visited[start]) continue;

      const stack = [start];
      visited[start] = 1;
      const component: number[] = [start];
      let area = 0;
      let perimeter = 0;

      while (stack.length > 0) {
        const p = stack.pop()!;
        area += 1;
        const px = p % width;
        const py = (p / width) | 0;
        let edge = false;

        for (const np of [p - 1, p + 1, p - width, p + width]) {
          const nx = np % width;
          const ny = (np / width) | 0;
          if (np < 0 || np >= strokeMask.length || Math.abs(nx - px) + Math.abs(ny - py) !== 1) {
            edge = true;
            continue;
          }
          if (!strokeMask[np]) {
            edge = true;
            continue;
          }
          if (!visited[np]) {
            visited[np] = 1;
            stack.push(np);
            component.push(np);
          }
        }

        if (edge) perimeter += 1;
      }

      const compactness =
        perimeter > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
      const removeDotCluster =
        edgePercent > 60 && area < 96 && compactness > 0.42;
      const removeTiny = area < minArea;

      if (removeTiny || removeDotCluster) {
        for (const p of component) {
          removeMask[p] = 1;
        }
      }
    }
  }

  for (let p = 0, i = 0; i < out.length; i += 4, p += 1) {
    if (!removeMask[p]) continue;
    out[i] = 255;
    out[i + 1] = 255;
    out[i + 2] = 255;
  }
}

function extractStrokeMask(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  alphaCutoff: number
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (let p = 0, i = 0; i < out.length; i += 4, p += 1) {
    if (out[i + 3] <= alphaCutoff) continue;
    if (out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0) {
      mask[p] = 1;
    }
  }
  return mask;
}

function morphErode4(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (
        mask[p] &&
        mask[p - 1] &&
        mask[p + 1] &&
        mask[p - width] &&
        mask[p + width]
      ) {
        out[p] = 1;
      }
    }
  }
  return out;
}

function morphDilate4(mask: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (
        mask[p] ||
        mask[p - 1] ||
        mask[p + 1] ||
        mask[p - width] ||
        mask[p + width]
      ) {
        out[p] = 1;
      }
    }
  }
  return out;
}

function morphOpen4(mask: Uint8Array, width: number, height: number, passes: number): Uint8Array {
  let current = mask;
  for (let pass = 0; pass < passes; pass += 1) {
    current = morphErode4(current, width, height);
  }
  for (let pass = 0; pass < passes; pass += 1) {
    current = morphDilate4(current, width, height);
  }
  return current;
}

function applyStrokeMaskToBuffer(
  out: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  alphaCutoff: number
): void {
  for (let p = 0, i = 0; i < out.length; i += 4, p += 1) {
    const alpha = out[i + 3];
    if (alpha <= alphaCutoff) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }

    if (mask[p]) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    } else {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
}

function finalizeColoringPageBuffer(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  alphaCutoff: number
): void {
  for (let p = 0, i = 0; i < out.length; i += 4, p += 1) {
    const alpha = out[i + 3];
    if (alpha <= alphaCutoff) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 0;
      continue;
    }

    const isStroke = out[i] < 96 && out[i + 1] < 96 && out[i + 2] < 96;
    if (isStroke) {
      out[i] = 0;
      out[i + 1] = 0;
      out[i + 2] = 0;
      out[i + 3] = 255;
    } else {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
    }
  }
}

function polishColoringPage(
  out: Uint8ClampedArray,
  width: number,
  height: number,
  edgePercent: number,
  alphaCutoff: number
): void {
  pruneInteriorTexture(out, width, height, edgePercent, alphaCutoff);

  let strokeMask = extractStrokeMask(out, width, height, alphaCutoff);
  const openPasses = percentToMorphOpenPasses(edgePercent);
  if (openPasses > 0) {
    strokeMask = morphOpen4(strokeMask, width, height, openPasses);
  }

  applyStrokeMaskToBuffer(out, strokeMask, width, height, alphaCutoff);
  finalizeColoringPageBuffer(out, width, height, alphaCutoff);
}

function toColoringPageBuffer(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: ImageEffectOptions
): Uint8ClampedArray {
  const edgePercent = clampEdgePercent(
    options?.edgePercent ??
      (options?.edgeThreshold !== undefined
        ? DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD
        : DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD)
  );
  const inkPercent =
    options?.lumCutoff !== undefined
      ? Math.round(((options.lumCutoff - 20) / 140) * 100)
      : DEFAULT_IMAGE_EFFECT_LUM_CUTOFF;
  const satPercent =
    options?.satCutoff !== undefined
      ? Math.round((options.satCutoff / 0.7) * 100)
      : DEFAULT_IMAGE_EFFECT_SAT_CUTOFF;

  const lumCutoff = Math.max(
    8,
    (options?.lumCutoff ?? percentToLumCutoff(inkPercent)) - percentToInkLumStrictness(edgePercent)
  );
  const satCutoff = options?.satCutoff ?? percentToSatCutoff(satPercent);
  const alphaCutoff = options?.alphaCutoff ?? 16;
  const edgeThreshold = options?.edgeThreshold ?? percentToEdgeThreshold(edgePercent);
  const minLocalContrast = percentToMinLocalContrast(edgePercent);
  const out = new Uint8ClampedArray(width * height * 4);
  const gray = toGrayscaleArray(data);
  const edgeGray = blur5x5(gray, width, height);
  const alphaMap = new Uint8ClampedArray(width * height);

  for (let p = 0, i = 0; i < data.length; i += 4, p += 1) {
    alphaMap[p] = data[i + 3];
  }

  const thinEdges = computeThinEdgeMask(
    edgeGray,
    alphaMap,
    width,
    height,
    edgeThreshold,
    alphaCutoff,
    minLocalContrast
  );

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const p = y * width + x;
      const alpha = data[i + 3];

      if (alpha <= alphaCutoff) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
        continue;
      }

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;

      const isShadingTexture = isHalftoneShadingPixel(
        gray,
        x,
        y,
        width,
        height,
        lum,
        saturation,
        edgePercent
      );
      const isBlackInk =
        !isShadingTexture &&
        lum <= lumCutoff &&
        (saturation <= satCutoff || lum <= 48);
      const isSyntheticLine = thinEdges[p] === 1;

      if (isBlackInk || isSyntheticLine) {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = alpha;
      } else {
        out[i] = 255;
        out[i + 1] = 255;
        out[i + 2] = 255;
        out[i + 3] = alpha;
      }
    }
  }

  polishColoringPage(out, width, height, edgePercent, alphaCutoff);

  return out;
}

function applyGrayscale(data: Uint8ClampedArray, contrastPercent = 100): void {
  const contrast = contrastPercent / 100;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 16) continue;
    let gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    gray = Math.min(255, Math.max(0, Math.round((gray - 128) * contrast + 128)));
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function scaleToMaxDimension(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const largest = Math.max(width, height);
  if (largest <= maxDimension) return { width, height };
  const scale = maxDimension / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function sampleCornerColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sampleSize: number
): [number, number, number] {
  const points: Array<[number, number]> = [
    [0, 0],
    [width - sampleSize, 0],
    [0, height - sampleSize],
    [width - sampleSize, height - sampleSize],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (const [startX, startY] of points) {
    for (let y = startY; y < startY + sampleSize; y += 1) {
      for (let x = startX; x < startX + sampleSize; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i + 3] <= 16) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count += 1;
      }
    }
  }

  if (count === 0) return [255, 255, 255];
  return [r / count, g / count, b / count];
}

export async function processImageEffect(
  src: string,
  effect: ImageBlockEffect,
  options?: ImageEffectOptions
): Promise<ImageEffectResult> {
  if (effect === 'none' || effect === 'coloring-page') return { src };
  if (typeof document === 'undefined') return { src };

  const img = await loadImageElement(src);
  const maxDimension = options?.maxDimension ?? 1600;
  const scaled = scaleToMaxDimension(img.naturalWidth, img.naturalHeight, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = scaled.width;
  canvas.height = scaled.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { src };

  ctx.clearRect(0, 0, scaled.width, scaled.height);
  ctx.drawImage(img, 0, 0, scaled.width, scaled.height);
  const imageData = ctx.getImageData(0, 0, scaled.width, scaled.height);

  if (effect === 'grayscale') {
    applyGrayscale(imageData.data, options?.grayscaleContrast);
    ctx.putImageData(imageData, 0, 0);
    return { src: canvas.toDataURL('image/png') };
  }

  const processed = toColoringPageBuffer(imageData.data, scaled.width, scaled.height, options);
  const viable = isColoringPageViable(
    processed,
    imageData.data,
    scaled.width,
    scaled.height
  );

  if (!viable) {
    return { src, coloringPageViable: false };
  }

  ctx.putImageData(new ImageData(processed, scaled.width, scaled.height), 0, 0);
  return {
    src: canvas.toDataURL('image/png'),
    coloringPageViable: true,
  };
}

export async function removeImageBackground(
  src: string,
  tolerance = percentToBgTolerance(DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE)
): Promise<string> {
  if (typeof document === 'undefined') return src;

  const img = await loadImageElement(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  const sampleSize = Math.max(4, Math.min(24, Math.floor(Math.min(width, height) * 0.04)));
  const [bgR, bgG, bgB] = sampleCornerColor(data, width, height, sampleSize);

  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - bgR);
    const dg = Math.abs(data[i + 1] - bgG);
    const db = Math.abs(data[i + 2] - bgB);
    const distance = Math.max(dr, dg, db);
    if (distance <= tolerance) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function upscaleImage(
  src: string,
  factor = 2,
  maxDimension = 3200
): Promise<string> {
  if (typeof document === 'undefined') return src;
  if (factor <= 1) return src;

  const img = await loadImageElement(src);
  let targetW = Math.round(img.naturalWidth * factor);
  let targetH = Math.round(img.naturalHeight * factor);
  const largest = Math.max(targetW, targetH);
  if (largest > maxDimension) {
    const scale = maxDimension / largest;
    targetW = Math.max(1, Math.round(targetW * scale));
    targetH = Math.max(1, Math.round(targetH * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/png');
}

export async function resolveImageBlockSrc(
  src: string,
  effect?: ImageBlockEffect,
  options?: ImageEffectOptions
): Promise<string> {
  if (!effect || effect === 'none') return src;
  const result = await processImageEffect(src, effect, options);
  return result.src;
}
