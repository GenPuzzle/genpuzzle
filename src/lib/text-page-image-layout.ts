import type { TextPageBlock } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { getPageDimensionsInches, getPageMarginInches } from './puzzle-layout';

export function getPageContentAspectRatio(settings: WordSearchSettings): number {
  const dims = getPageDimensionsInches(settings);
  const margin = getPageMarginInches(settings);
  const contentWidth = dims.width - margin * 2;
  const contentHeight = dims.height - margin * 2;
  if (contentHeight <= 0) return 8.5 / 11;
  return contentWidth / contentHeight;
}

export function loadImageNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => reject(new Error('Failed to load image.'));
    img.src = src;
  });
}

export function computeImageBlockPercents(
  naturalWidth: number,
  naturalHeight: number,
  pageContentAspect: number,
  options?: {
    maxWidthPercent?: number;
    maxHeightPercent?: number;
    widthPercent?: number;
  }
): { widthPercent: number; heightPercent: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || pageContentAspect <= 0) {
    return { widthPercent: 55, heightPercent: 28 };
  }

  const imageAspect = naturalWidth / naturalHeight;
  const maxW = options?.maxWidthPercent ?? 65;
  const maxH = options?.maxHeightPercent ?? 58;

  let widthPercent = options?.widthPercent ?? maxW;
  let heightPercent = (widthPercent * pageContentAspect) / imageAspect;

  if (heightPercent > maxH) {
    heightPercent = maxH;
    widthPercent = (heightPercent * imageAspect) / pageContentAspect;
  }

  widthPercent = Math.min(maxW, Math.max(8, widthPercent));
  heightPercent = Math.min(maxH, Math.max(6, heightPercent));

  return {
    widthPercent: Math.round(widthPercent * 10) / 10,
    heightPercent: Math.round(heightPercent * 10) / 10,
  };
}

export function imageBlockHeightForWidth(
  widthPercent: number,
  naturalWidth: number,
  naturalHeight: number,
  pageContentAspect: number
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || pageContentAspect <= 0) {
    return widthPercent * 0.5;
  }
  const imageAspect = naturalWidth / naturalHeight;
  return (widthPercent * pageContentAspect) / imageAspect;
}

export function imageBlockWidthForHeight(
  heightPercent: number,
  naturalWidth: number,
  naturalHeight: number,
  pageContentAspect: number
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || pageContentAspect <= 0) {
    return heightPercent * 2;
  }
  const imageAspect = naturalWidth / naturalHeight;
  return (heightPercent * imageAspect) / pageContentAspect;
}

export type ImageResizeMode = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

/** Lock corner resize to the box aspect ratio at drag start (proportional scale). */
export function constrainCornerResizeToBoxAspect(
  mode: ImageResizeMode,
  values: { x: number; y: number; w: number; h: number },
  origin: { x: number; y: number; w: number; h: number }
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = values;
  const hasE = mode.includes('e');
  const hasW = mode.includes('w');
  const hasN = mode.includes('n');
  const hasS = mode.includes('s');

  if (origin.w <= 0 || origin.h <= 0) {
    return { x, y, w, h };
  }

  const aspect = origin.w / origin.h;

  if (hasE || hasW) {
    h = w / aspect;
    if (hasN) {
      y = origin.y + origin.h - h;
    } else if (!hasS) {
      y = origin.y + (origin.h - h) / 2;
    }
    if (hasW && !hasE) {
      x = origin.x + origin.w - w;
    }
  } else {
    w = h * aspect;
    if (hasN) {
      y = origin.y + origin.h - h;
    }
    if (hasW && !hasE) {
      x = origin.x + origin.w - w;
    } else if (!hasE) {
      x = origin.x + (origin.w - w) / 2;
    }
  }

  return { x, y, w, h };
}

/** Keep image block aspect ratio locked while resizing (PowerPoint-style image scaling). */
export function constrainImageBlockResize(
  mode: ImageResizeMode,
  values: { x: number; y: number; w: number; h: number },
  origin: { x: number; y: number; w: number; h: number },
  naturalWidth: number,
  naturalHeight: number,
  pageContentAspect: number
): { x: number; y: number; w: number; h: number } {
  let { x, y, w, h } = values;
  const hasE = mode.includes('e');
  const hasW = mode.includes('w');
  const hasN = mode.includes('n');
  const hasS = mode.includes('s');
  const widthPrimary = hasE || hasW;

  if (widthPrimary) {
    h = imageBlockHeightForWidth(w, naturalWidth, naturalHeight, pageContentAspect);
    if (hasN) {
      y = origin.y + origin.h - h;
    } else if (!hasS) {
      y = origin.y + (origin.h - h) / 2;
    }
    if (hasW && !hasE) {
      x = origin.x + origin.w - w;
    }
  } else {
    w = imageBlockWidthForHeight(h, naturalWidth, naturalHeight, pageContentAspect);
    if (hasN) {
      y = origin.y + origin.h - h;
    }
    if (hasW && !hasE) {
      x = origin.x + origin.w - w;
    } else if (!hasE) {
      x = origin.x + (origin.w - w) / 2;
    }
  }

  return { x, y, w, h };
}

export function fitImageBlockToNaturalSize(
  block: TextPageBlock,
  naturalWidth: number,
  naturalHeight: number,
  pageContentAspect: number
): Partial<TextPageBlock> {
  const size = computeImageBlockPercents(naturalWidth, naturalHeight, pageContentAspect, {
    widthPercent: block.widthPercent,
  });

  return {
    widthPercent: size.widthPercent,
    heightPercent: size.heightPercent,
    imageFit: 'stretch',
    imageNaturalWidth: naturalWidth,
    imageNaturalHeight: naturalHeight,
  };
}

/** Shrink/reposition an image block so its bounds match the visible image area for contain/cover. */
export function syncImageBlockToFitMode(
  block: TextPageBlock,
  fit: 'contain' | 'cover' | 'stretch',
  pageContentAspect: number
): Partial<TextPageBlock> {
  const naturalWidth = block.imageNaturalWidth;
  const naturalHeight = block.imageNaturalHeight;
  if (!naturalWidth || !naturalHeight || fit === 'stretch' || fit === 'cover') {
    return { imageFit: 'stretch' };
  }

  const w = block.widthPercent;
  const h = block.heightPercent ?? 28;
  const boxAspect = (w / h) * pageContentAspect;
  const imageAspect = naturalWidth / naturalHeight;

  let visW = w;
  let visH = h;

  if (boxAspect > imageAspect) {
    visH = h;
    visW = imageBlockWidthForHeight(h, naturalWidth, naturalHeight, pageContentAspect);
  } else {
    visW = w;
    visH = imageBlockHeightForWidth(w, naturalWidth, naturalHeight, pageContentAspect);
  }

  return {
    widthPercent: Math.round(visW * 10) / 10,
    heightPercent: Math.round(visH * 10) / 10,
    xPercent: block.xPercent + (w - visW) / 2,
    yPercent: block.yPercent + (h - visH) / 2,
    imageFit: 'stretch',
  };
}
