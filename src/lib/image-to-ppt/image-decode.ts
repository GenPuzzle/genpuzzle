import {
  IMAGE_TO_PPT_PREVIEW_EDGE,
  IMAGE_TO_PPT_THUMB_EDGE,
  IMAGE_TO_PPT_MAX_PROCESS_EDGE,
} from './types';

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImageFromUrl(url).finally(() => URL.revokeObjectURL(url));
}

export function fitSize(width: number, height: number, maxEdge: number): { width: number; height: number; scale: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge) return { width, height, scale: 1 };
  const scale = maxEdge / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

function drawFitted(img: CanvasImageSource, srcW: number, srcH: number, maxEdge: number): HTMLCanvasElement {
  const fitted = fitSize(srcW, srcH, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = fitted.width;
  canvas.height = fitted.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, fitted.width, fitted.height);
  return canvas;
}

export async function decodeImageFile(file: File): Promise<{
  width: number;
  height: number;
  originalBlob: Blob;
  previewBlob: Blob;
  thumbnailBlob: Blob;
  previewCanvas: HTMLCanvasElement;
}> {
  const originalBlob = file;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageFromUrl(url);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    const previewCanvas = drawFitted(img, width, height, IMAGE_TO_PPT_PREVIEW_EDGE);
    const thumbCanvas = drawFitted(img, width, height, IMAGE_TO_PPT_THUMB_EDGE);
    const previewBlob = await canvasToBlob(previewCanvas, 'image/jpeg', 0.82);
    const thumbnailBlob = await canvasToBlob(thumbCanvas, 'image/jpeg', 0.72);
    return { width, height, originalBlob, previewBlob, thumbnailBlob, previewCanvas };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasFromBlob(blob: Blob, maxEdge = IMAGE_TO_PPT_MAX_PROCESS_EDGE): Promise<HTMLCanvasElement> {
  const img = await loadImageFromBlob(blob);
  return drawFitted(img, img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge);
}

export function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode image'));
      },
      type,
      quality
    );
  });
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): string {
  return canvas.toDataURL(type, quality);
}

export function cropImageData(source: ImageData, x: number, y: number, width: number, height: number): ImageData {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const w = Math.max(1, Math.min(source.width - sx, Math.ceil(width)));
  const h = Math.max(1, Math.min(source.height - sy, Math.ceil(height)));
  const out = new ImageData(w, h);
  for (let row = 0; row < h; row++) {
    const src = ((sy + row) * source.width + sx) * 4;
    const dst = row * w * 4;
    out.data.set(source.data.subarray(src, src + w * 4), dst);
  }
  return out;
}
