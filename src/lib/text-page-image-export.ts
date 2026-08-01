import { buildImageEffectOptions, resolveImageBlockSrc } from './text-page-image-effects';
import type { TextPageBlock } from './document-model';
import { PT_TO_CSS_PX } from './puzzle-layout';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function computeObjectFitRect(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number,
  fit: 'cover' | 'contain' | 'stretch'
): { dx: number; dy: number; dw: number; dh: number } {
  if (fit === 'stretch' || naturalW <= 0 || naturalH <= 0) {
    return { dx: 0, dy: 0, dw: boxW, dh: boxH };
  }

  const scale =
    fit === 'cover'
      ? Math.max(boxW / naturalW, boxH / naturalH)
      : Math.min(boxW / naturalW, boxH / naturalH);
  const dw = naturalW * scale;
  const dh = naturalH * scale;
  return {
    dx: (boxW - dw) / 2,
    dy: (boxH - dh) / 2,
    dw,
    dh,
  };
}

/**
 * Render an image block to a PNG data URL matching canvas preview
 * (object-fit, flip, rotation, opacity, effects).
 */
export async function renderImageBlockToDataUrl(
  block: TextPageBlock,
  widthPt: number,
  heightPt: number
): Promise<string | null> {
  if (!block.imageSrc || typeof document === 'undefined') return null;

  const widthPx = Math.max(1, Math.round(widthPt * PT_TO_CSS_PX));
  const heightPx = Math.max(1, Math.round(heightPt * PT_TO_CSS_PX));

  try {
    const renderedSrc = await resolveImageBlockSrc(
      block.imageSrc,
      block.imageEffect === 'coloring-page' ? 'none' : block.imageEffect,
      buildImageEffectOptions(block)
    );
    const img = await loadImage(renderedSrc);
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, widthPx, heightPx);
    const opacity = (block.imageOpacity ?? 100) / 100;
    ctx.globalAlpha = opacity;

    const fit = block.imageFit ?? 'stretch';

    ctx.save();
    ctx.translate(widthPx / 2, heightPx / 2);
    const rotationDeg = block.rotationDeg ?? 0;
    if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
    const scaleX = block.imageFlipHorizontal ? -1 : 1;
    const scaleY = block.imageFlipVertical ? -1 : 1;
    if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);

    const { dx, dy, dw, dh } = computeObjectFitRect(
      img.naturalWidth,
      img.naturalHeight,
      widthPx,
      heightPx,
      fit
    );
    ctx.drawImage(img, -widthPx / 2 + dx, -heightPx / 2 + dy, dw, dh);
    ctx.restore();

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
