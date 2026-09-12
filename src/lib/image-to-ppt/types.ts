export type ImageToPptPageStatus =
  | 'uploaded'
  | 'detecting'
  | 'review'
  | 'converting'
  | 'ready'
  | 'error';

export type DetectionKind = 'text' | 'graphic' | 'keep-original' | 'delete';

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface BackgroundAnalysis {
  color: RgbColor;
  hex: string;
  isNearWhite: boolean;
  isTextured: boolean;
  keepRasterBackground: boolean;
}

export interface GraphicPart {
  id: string;
  bbox: PixelRect;
  area: number;
}

export interface ImageToPptDetection {
  id: string;
  kind: DetectionKind;
  bbox: PixelRect;
  text?: string;
  confidence?: number;
  fontSizePx?: number;
  alignment?: 'left' | 'center' | 'right';
  rotationDeg?: number;
  svgMarkup?: string;
  rasterDataUrl?: string;
  fillHex?: string;
  bold?: boolean;
  graphicRole?: 'frame' | 'art' | 'fill';
  parts?: GraphicPart[];
}

export interface ImageToPptProcessCache {
  processedWidth: number;
  processedHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  background: BackgroundAnalysis;
  detections: ImageToPptDetection[];
}

export type ImageToPptStage =
  | 'idle'
  | 'loading'
  | 'detecting-text'
  | 'removing-text'
  | 'vectorizing'
  | 'reconstructing'
  | 'exporting';

export interface ImageToPptPage {
  id: string;
  name: string;
  fileName: string;
  createdAt: number;
  status: ImageToPptPageStatus;
  stage: ImageToPptStage;
  stageLabel: string;
  error?: string;
  sourceWidth: number;
  sourceHeight: number;
  thumbnailUrl: string;
  previewUrl: string;
  detections: ImageToPptDetection[];
  background?: BackgroundAnalysis;
  keepRasterBackground: boolean;
  processedWidth?: number;
  processedHeight?: number;
}

export interface ImageToPptJobProgress {
  active: boolean;
  current: number;
  total: number;
  pageName: string;
  stageLabel: string;
  failedPageIds: string[];
}

export interface SvgAssetManifestEntry {
  sourcePage: number;
  pageId: string;
  filename: string;
  x: number;
  y: number;
  width: number;
  height: number;
  originalDetectedRegionId: string;
  hash: string;
}

export const IMAGE_TO_PPT_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,.png,.jpg,.jpeg,.webp';

export const IMAGE_TO_PPT_MAX_PROCESS_EDGE = 1600;
export const IMAGE_TO_PPT_PREVIEW_EDGE = 1200;
export const IMAGE_TO_PPT_THUMB_EDGE = 220;
