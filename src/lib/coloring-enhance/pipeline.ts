import type { PixelBuffer } from '@/lib/sprite-sheet-importer';
import { analyzeColoringSource } from './analyze';
import { compareQuality, scoreColoringResult, svgIsTrueVector } from './quality';
import type {
  ColoringEnhanceCandidate,
  ColoringEnhanceResult,
  ColoringEnhanceSettings,
  ColoringSourceProfile,
} from './types';
import { normalizeColoringSettings } from './types';
import { svgHasFillStroke } from './vectorize';
import { VTRACER_CANDIDATES, settingsToVtracerCandidate, vectorizeWithVtracer } from './vtracer-engine';

function cloneBuffer(src: PixelBuffer): PixelBuffer {
  return { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height };
}

function buildCandidate(
  source: PixelBuffer,
  name: string,
  image: PixelBuffer,
  proof: PixelBuffer,
  svg: string | undefined
): ColoringEnhanceCandidate {
  const safeSvg = svg && svgIsTrueVector(svg) && !svgHasFillStroke(svg) ? svg : svg && svgIsTrueVector(svg) ? svg : '';
  return {
    name,
    svg: safeSvg,
    image,
    proof,
    quality: scoreColoringResult(source, proof, svg, name),
  };
}

function pickBest(candidates: ColoringEnhanceCandidate[]): ColoringEnhanceCandidate {
  return [...candidates].sort((left, right) => compareQuality(left.quality, right.quality))[0] ?? candidates[0];
}

export function enhanceColoringPage(
  source: PixelBuffer,
  options: {
    isSvg?: boolean;
    svgText?: string;
    profile?: ColoringSourceProfile;
    settings?: Partial<ColoringEnhanceSettings> | null;
  } = {}
): ColoringEnhanceResult {
  const profile = options.profile ?? analyzeColoringSource(source, options);
  const settings = normalizeColoringSettings(options.settings);
  const candidates: ColoringEnhanceCandidate[] = [];

  if (options.svgText && svgIsTrueVector(options.svgText) && !svgHasFillStroke(options.svgText)) {
    candidates.push(buildCandidate(source, 'source-svg', cloneBuffer(source), cloneBuffer(source), options.svgText));
  }

  const presets = options.settings != null ? [settingsToVtracerCandidate(settings)] : VTRACER_CANDIDATES;
  for (const preset of presets) {
    const traced = vectorizeWithVtracer(source, preset);
    candidates.push(buildCandidate(source, preset.name, traced.preview, traced.proof, traced.svg));
  }

  const best = pickBest(candidates);
  return {
    svg: best.svg,
    image: best.image,
    quality: {
      ...best.quality,
      candidate: best.name,
      vectorReady: best.quality.passed && best.quality.topologyPreservation > 0,
      passed: best.quality.passed,
    },
    profile,
    candidates,
  };
}
