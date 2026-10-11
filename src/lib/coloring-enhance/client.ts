import { bufferToPngDataUrl } from './export';
import { normalizeColoringSettings } from './types';
import type { ColoringEnhanceSettings, ColoringQualityReport } from './types';
import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

export const COLORING_ENHANCE_API = '/api/tools/enhance-coloring-pages';
/** Maze crops are sent at this size so VTracer 5× supersample stays in range. */
export const COLORING_ENHANCE_INPUT_MAX_SIDE = 1280;

export interface ColoringEnhanceClientResult {
  svg: string;
  imagePng: string;
  quality?: ColoringQualityReport;
}

/** One client used by Enhance Coloring Pages, maze Edit Cropping, and any website tool. */
export async function requestColoringEnhance(input: {
  pngDataUrl: string;
  settings?: Partial<ColoringEnhanceSettings> | null;
  isSvg?: boolean;
  svgText?: string;
}): Promise<ColoringEnhanceClientResult> {
  const response = await fetch(COLORING_ENHANCE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pngDataUrl: input.pngDataUrl,
      isSvg: input.isSvg,
      svgText: input.svgText,
      settings: input.settings ? normalizeColoringSettings(input.settings) : undefined,
    }),
  });
  if (!response.ok) throw new Error('enhance failed');
  const result = (await response.json()) as ColoringEnhanceClientResult;
  if (!result.imagePng && !result.svg) throw new Error('enhance failed');
  return {
    svg: result.svg || '',
    imagePng: result.imagePng,
    quality: result.quality,
  };
}

export async function requestColoringEnhanceFromBuffer(
  image: PixelBuffer,
  settings?: Partial<ColoringEnhanceSettings> | null,
  extra?: { isSvg?: boolean; svgText?: string }
): Promise<ColoringEnhanceClientResult> {
  return requestColoringEnhance({
    pngDataUrl: bufferToPngDataUrl(image),
    settings,
    isSvg: extra?.isSvg,
    svgText: extra?.svgText,
  });
}

export function svgPreviewUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
