import type { PixelBuffer } from '@/lib/sprite-sheet-importer';

export const COLORING_ENHANCE_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,.svg';

export interface ColoringEnhanceSettings {
  smoothness: number;
  softness: number;
  detail: number;
  gapPreservation: number;
  lineWeight: number;
}

export const DEFAULT_COLORING_ENHANCE_SETTINGS: ColoringEnhanceSettings = {
  smoothness: 80,
  softness: 100,
  detail: 50,
  gapPreservation: 100,
  lineWeight: 50,
};

export const COLORING_ENHANCE_PRESETS: Record<string, ColoringEnhanceSettings> = {
  balanced: { smoothness: 80, softness: 100, detail: 50, gapPreservation: 100, lineWeight: 50 },
  smooth: { smoothness: 78, softness: 62, detail: 70, gapPreservation: 70, lineWeight: 50 },
  soft: { smoothness: 62, softness: 82, detail: 72, gapPreservation: 68, lineWeight: 50 },
  highDetail: { smoothness: 42, softness: 48, detail: 92, gapPreservation: 88, lineWeight: 50 },
};

export function clampColoringSetting(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function normalizeColoringSettings(settings?: Partial<ColoringEnhanceSettings> | null): ColoringEnhanceSettings {
  return {
    smoothness: clampColoringSetting(settings?.smoothness ?? DEFAULT_COLORING_ENHANCE_SETTINGS.smoothness),
    softness: clampColoringSetting(settings?.softness ?? DEFAULT_COLORING_ENHANCE_SETTINGS.softness),
    detail: clampColoringSetting(settings?.detail ?? DEFAULT_COLORING_ENHANCE_SETTINGS.detail),
    gapPreservation: clampColoringSetting(settings?.gapPreservation ?? DEFAULT_COLORING_ENHANCE_SETTINGS.gapPreservation),
    lineWeight: clampColoringSetting(settings?.lineWeight ?? DEFAULT_COLORING_ENHANCE_SETTINGS.lineWeight),
  };
}

export function coloringSettingsAreDefault(settings: ColoringEnhanceSettings): boolean {
  const defaults = DEFAULT_COLORING_ENHANCE_SETTINGS;
  return (
    settings.smoothness === defaults.smoothness &&
    settings.softness === defaults.softness &&
    settings.detail === defaults.detail &&
    settings.gapPreservation === defaults.gapPreservation &&
    settings.lineWeight === defaults.lineWeight
  );
}

export type ColoringBackgroundKind = 'transparent' | 'white' | 'off-white' | 'unknown';

export type ColoringPreviewMode = 'side-by-side' | 'original' | 'enhanced' | 'overlay';

export type ColoringQualityLabel = 'Excellent' | 'Good' | 'Fair' | 'Needs review' | 'Needs reprocessing' | 'Failed';

export interface ColoringSourceProfile {
  width: number;
  height: number;
  background: ColoringBackgroundKind;
  isSvg: boolean;
  hasVectorPaths: boolean;
  lowResolution: boolean;
  inkRatio: number;
  printLongSide: number;
}

export interface ColoringQualityReport {
  overall: number;
  detailRetention: number;
  skeletonRecall: number;
  edgeRecall: number;
  componentPreservation: number;
  lineWidthFidelity: number;
  localWidthFidelity: number;
  negativeSpacePreservation: number;
  topologyPreservation: number;
  gapPreservation: number;
  worstRegionCoverage: number;
  newPinholeCount: number;
  inkCoverageDiff: number;
  curveSmoothness: number;
  curveRoughness: number;
  cubicCount: number;
  lineCount: number;
  lineContinuity: number;
  printSafety: number;
  artifactLevel: number;
  pathComplexity: number;
  label: ColoringQualityLabel;
  candidate: string;
  passed: boolean;
  vectorReady: boolean;
}

export interface ColoringEnhanceCandidate {
  name: string;
  svg: string;
  image: PixelBuffer;
  proof: PixelBuffer;
  quality: ColoringQualityReport;
}

export interface ColoringEnhanceResult {
  svg: string;
  image: PixelBuffer;
  quality: ColoringQualityReport;
  profile: ColoringSourceProfile;
  candidates: ColoringEnhanceCandidate[];
}

export interface ColoringJobItem {
  id: string;
  name: string;
  stem: string;
  originalUrl: string;
  width: number;
  height: number;
  profile: ColoringSourceProfile | null;
  status: 'ready' | 'enhancing' | 'done' | 'error';
  error?: string;
  enhancedSvg?: string;
  enhancedPngUrl?: string;
  quality?: ColoringQualityReport;
}
