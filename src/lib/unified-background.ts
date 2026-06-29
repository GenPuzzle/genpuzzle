/**
 * Flattened page background rasterizer.
 *
 * When a background image and/or frame border is active, renders both onto a
 * single OffscreenCanvas once. PDF/PPT exporters embed this raster once per
 * unique configuration and reuse it on every page — smaller files and locked,
 * uneditable background layers.
 *
 * Inner puzzle area uses the user-selected backgroundColor — never transparent.
 */

import type { PDFDocument, PDFImage, PDFPage } from 'pdf-lib';
import { fillRoundedRectClipped } from './page-frame-geometry';

/** PDF points (72/in) → CSS pixels (96/in) */
const PT_TO_PX = 96 / 72;

/** Default frame border margin in inches (UI + export). */
export const DEFAULT_FRAME_BORDER_MARGIN_IN = 0.56;

/** Frame border enabled by default when a background image is used. */
export const DEFAULT_FRAME_BORDER_ENABLED = true;

export type BackgroundImageFit = 'cover' | 'contain' | 'stretch';

export interface PageBackgroundConfig {
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImage?: string;
  backgroundImageOpacity?: number;
  backgroundImageFit?: BackgroundImageFit;
  backgroundImageFrameEnabled?: boolean;
  /** Frame margin in inches (background visible in outer ring). */
  backgroundImageFrameMargin?: number;
  /** Page container corner radius in CSS px (matches Color Settings page frame). */
  pageFrameCornerRadiusPx?: number;
  /**
   * When false, inner frame fill is omitted from the flattened raster (PPT uses a vector shape instead).
   * @default true
   */
  bakeInnerFrameFill?: boolean;
  /** Canvas supersampling factor (default 2). */
  scale?: number;
}

export interface FlattenedBackgroundResult {
  dataUrl: string;
  mimeType: 'image/jpeg' | 'image/png';
  widthPx: number;
  heightPx: number;
  widthPt: number;
  heightPt: number;
  /** True when inner frame was transparent (legacy PDF layering). Always false now. */
  hasTransparentInner: boolean;
}

/** @deprecated Use FlattenedBackgroundResult */
export type UnifiedBackgroundResult = FlattenedBackgroundResult;

export function resolveFrameMargin(margin?: number): number {
  return margin ?? DEFAULT_FRAME_BORDER_MARGIN_IN;
}

export function resolveFrameEnabled(enabled?: boolean): boolean {
  return enabled ?? DEFAULT_FRAME_BORDER_ENABLED;
}

/** Use flattened raster when a background image is present (frame is baked in when enabled). */
export function shouldUseFlattenedExport(config: PageBackgroundConfig): boolean {
  return !!config.backgroundImage;
}

/** Stable cache key for background settings (avoids storing full data URLs). */
export function getPageBackgroundCacheKey(config: PageBackgroundConfig): string {
  const img = config.backgroundImage ?? '';
  const imgKey = img
    ? `${img.length}:${img.slice(0, 48)}:${img.slice(-48)}`
    : '';
  return [
    config.widthPt,
    config.heightPt,
    config.backgroundColor ?? '#ffffff',
    imgKey,
    config.backgroundImageOpacity ?? 100,
    config.backgroundImageFit ?? 'cover',
    resolveFrameEnabled(config.backgroundImageFrameEnabled) ? 1 : 0,
    resolveFrameMargin(config.backgroundImageFrameMargin),
    config.pageFrameCornerRadiusPx ?? 4,
    config.bakeInnerFrameFill !== false ? 1 : 0,
    config.scale ?? 2,
  ].join('|');
}

function normalizeHexColor(hex: string | undefined, fallback = '#ffffff'): string {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    return `#${clean.split('').map((c) => c + c).join('')}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return `#${clean}`;
  }
  return fallback;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load background image'));
    img.src = url;
  });
}

function createRenderCanvas(
  widthPx: number,
  heightPx: number
): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(widthPx, heightPx);
  }
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  return canvas;
}

function getCanvasContext(
  canvas: OffscreenCanvas | HTMLCanvasElement
): CanvasRenderingContext2D | null {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.getContext('2d');
  }
  return canvas.getContext('2d');
}

async function canvasToDataUrl(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  mimeType: 'image/jpeg' | 'image/png',
  quality?: number
): Promise<string> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: mimeType === 'image/jpeg' ? (quality ?? 0.9) : undefined,
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read flattened background blob'));
      reader.readAsDataURL(blob);
    });
  }
  return canvas.toDataURL(mimeType, quality);
}

function drawImageWithFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  canvasW: number,
  canvasH: number,
  fit: BackgroundImageFit,
  opacity: number
): void {
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;
  if (!imgW || !imgH) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));

  let drawW = canvasW;
  let drawH = canvasH;
  let drawX = 0;
  let drawY = 0;

  if (fit === 'stretch') {
    drawW = canvasW;
    drawH = canvasH;
  } else {
    const pageRatio = canvasW / canvasH;
    const imgRatio = imgW / imgH;

    if (fit === 'cover') {
      if (imgRatio > pageRatio) {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
        drawX = (canvasW - drawW) / 2;
      } else {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
        drawY = (canvasH - drawH) / 2;
      }
    } else {
      if (imgRatio > pageRatio) {
        drawW = canvasW;
        drawH = canvasW / imgRatio;
        drawY = (canvasH - drawH) / 2;
      } else {
        drawH = canvasH;
        drawW = canvasH * imgRatio;
        drawX = (canvasW - drawW) / 2;
      }
    }
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.restore();
}

/**
 * Render background + optional frame border onto one OffscreenCanvas.
 * Returns null when `document` is unavailable (server-side).
 */
export async function generateFlattenedBackground(
  config: PageBackgroundConfig
): Promise<FlattenedBackgroundResult | null> {
  if (typeof document === 'undefined') return null;

  const scale = config.scale ?? 2;
  const widthPt = config.widthPt;
  const heightPt = config.heightPt;
  const widthPx = Math.max(1, Math.round(widthPt * PT_TO_PX * scale));
  const heightPx = Math.max(1, Math.round(heightPt * PT_TO_PX * scale));

  const canvas = createRenderCanvas(widthPx, heightPx);
  const ctx = getCanvasContext(canvas);
  if (!ctx) return null;

  const fillColor = normalizeHexColor(config.backgroundColor, '#ffffff');
  const frameEnabled = resolveFrameEnabled(config.backgroundImageFrameEnabled);
  const frameMarginIn = resolveFrameMargin(config.backgroundImageFrameMargin);

  // Layer 1: solid page color (never default to black)
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Layer 2: background image
  if (config.backgroundImage) {
    try {
      const img = await loadImage(config.backgroundImage);
      const opacity = (config.backgroundImageOpacity ?? 100) / 100;
      const fit = config.backgroundImageFit ?? 'cover';
      drawImageWithFit(ctx, img, widthPx, heightPx, fit, opacity);
    } catch (e) {
      console.warn('[flattened-background] Image load failed, using solid color only:', e);
    }
  }

  // Layer 3: frame inset — clipped rounded fill (PDF / preview raster; skipped for PPT vector frame)
  if (
    config.bakeInnerFrameFill !== false &&
    config.backgroundImage &&
    frameEnabled
  ) {
    const frameMarginPx = frameMarginIn * 96 * scale;
    const innerW = Math.max(0, widthPx - frameMarginPx * 2);
    const innerH = Math.max(0, heightPx - frameMarginPx * 2);
    if (innerW > 0 && innerH > 0) {
      const cornerRadiusPx = (config.pageFrameCornerRadiusPx ?? 4) * scale;
      fillRoundedRectClipped(
        ctx,
        frameMarginPx,
        frameMarginPx,
        innerW,
        innerH,
        cornerRadiusPx,
        fillColor
      );
    }
  }

  // Fully opaque raster (JPEG) — inner frame uses backgroundColor, not transparency
  const mimeType: 'image/jpeg' | 'image/png' = 'image/jpeg';
  const dataUrl = await canvasToDataUrl(canvas, mimeType, 0.9);

  return {
    dataUrl,
    mimeType,
    widthPx,
    heightPx,
    widthPt,
    heightPt,
    hasTransparentInner: false,
  };
}

/** @deprecated Use generateFlattenedBackground */
export const generateUnifiedBackground = generateFlattenedBackground;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  const parts = dataUrl.split(',');
  if (parts.length < 2) return null;
  const mimeMatch = parts[0].match(/data:([^;]+);base64/);
  if (!mimeMatch) return null;
  const mimeType = mimeMatch[1];
  const base64Data = parts[1].replace(/\s/g, '');

  if (typeof window === 'undefined') {
    return { bytes: new Uint8Array(Buffer.from(base64Data, 'base64')), mimeType };
  }

  try {
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

/** In-memory cache: one embedded PDF image per unique background config. */
export class FlattenedBackgroundPdfCache {
  private embedded = new Map<string, PDFImage>();
  private meta = new Map<string, FlattenedBackgroundResult>();

  async getOrEmbed(
    pdfDoc: PDFDocument,
    config: PageBackgroundConfig
  ): Promise<{ image: PDFImage; result: FlattenedBackgroundResult } | null> {
    if (!shouldUseFlattenedExport(config)) return null;

    const key = getPageBackgroundCacheKey(config);
    const existing = this.embedded.get(key);
    const existingMeta = this.meta.get(key);
    if (existing && existingMeta) {
      return { image: existing, result: existingMeta };
    }

    const raster = await generateFlattenedBackground(config);
    if (!raster) return null;

    const decoded = decodeDataUrl(raster.dataUrl);
    if (!decoded) return null;

    const image =
      decoded.mimeType === 'image/png'
        ? await pdfDoc.embedPng(decoded.bytes)
        : await pdfDoc.embedJpg(decoded.bytes);

    this.embedded.set(key, image);
    this.meta.set(key, raster);
    return { image, result: raster };
  }
}

/** @deprecated Use FlattenedBackgroundPdfCache */
export const UnifiedBackgroundPdfCache = FlattenedBackgroundPdfCache;

/** Draw flattened background as the bottom image layer of a PDF page. */
export function drawFlattenedBackgroundOnPdfPage(
  page: PDFPage,
  image: PDFImage,
  pageWidth: number,
  pageHeight: number
): void {
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
  });
}

/** @deprecated Use drawFlattenedBackgroundOnPdfPage */
export const drawUnifiedBackgroundOnPdfPage = drawFlattenedBackgroundOnPdfPage;

/** In-memory cache for PPT export (data URLs reused across slides). */
export class FlattenedBackgroundPptCache {
  private results = new Map<string, FlattenedBackgroundResult>();

  async get(config: PageBackgroundConfig): Promise<FlattenedBackgroundResult | null> {
    if (!shouldUseFlattenedExport(config)) return null;

    const key = getPageBackgroundCacheKey(config);
    const hit = this.results.get(key);
    if (hit) return hit;

    const raster = await generateFlattenedBackground(config);
    if (raster) {
      this.results.set(key, raster);
    }
    return raster;
  }
}

/** @deprecated Use FlattenedBackgroundPptCache */
export const UnifiedBackgroundPptCache = FlattenedBackgroundPptCache;

/**
 * Apply uneditable slide background from flattened raster (or solid color fallback).
 */
export async function applyFlattenedBackgroundToSlide(
  slide: { background?: Record<string, unknown> },
  config: PageBackgroundConfig,
  cache: FlattenedBackgroundPptCache,
  hex6: (hex: string | undefined, fallback?: string) => string
): Promise<void> {
  const bgColor = hex6(normalizeHexColor(config.backgroundColor, '#ffffff'), 'FFFFFF');
  const raster = await cache.get(config);

  if (raster) {
    // PPT: raster is bg image only — inner fill + border come from one vector shape.
    // PDF: raster may include baked inner fill; color underlay prevents transparent holes.
    slide.background =
      config.bakeInnerFrameFill === false
        ? { data: raster.dataUrl }
        : { color: bgColor, data: raster.dataUrl };
    return;
  }

  slide.background = { color: bgColor };
}

/** @deprecated Use applyFlattenedBackgroundToSlide */
export const applyUnifiedBackgroundToSlide = applyFlattenedBackgroundToSlide;

export function puzzlePageBackgroundConfig(
  widthPt: number,
  heightPt: number,
  puzzlePage: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundImageOpacity?: number;
    backgroundImageFit?: BackgroundImageFit;
    backgroundImageFrameEnabled?: boolean;
    backgroundImageFrameMargin?: number;
  },
  pageFrameCornerRadiusPx?: number,
  options?: { bakeInnerFrameFill?: boolean }
): PageBackgroundConfig {
  return {
    widthPt,
    heightPt,
    backgroundColor: puzzlePage.backgroundColor || '#ffffff',
    backgroundImage: puzzlePage.backgroundImage,
    backgroundImageOpacity: puzzlePage.backgroundImageOpacity,
    backgroundImageFit: puzzlePage.backgroundImageFit,
    backgroundImageFrameEnabled: resolveFrameEnabled(puzzlePage.backgroundImageFrameEnabled),
    backgroundImageFrameMargin: resolveFrameMargin(puzzlePage.backgroundImageFrameMargin),
    pageFrameCornerRadiusPx: pageFrameCornerRadiusPx ?? 4,
    bakeInnerFrameFill: options?.bakeInnerFrameFill,
  };
}

export function answerPageBackgroundConfig(
  widthPt: number,
  heightPt: number,
  answerPage: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundImageOpacity?: number;
    backgroundImageFit?: BackgroundImageFit;
    backgroundImageFrameEnabled?: boolean;
    backgroundImageFrameMargin?: number;
  },
  pageFrameCornerRadiusPx?: number,
  options?: { bakeInnerFrameFill?: boolean }
): PageBackgroundConfig {
  return puzzlePageBackgroundConfig(
    widthPt,
    heightPt,
    answerPage,
    pageFrameCornerRadiusPx,
    options
  );
}
