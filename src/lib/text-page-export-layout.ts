import type { TextPageBlock, TextPageBlockFrameShape } from './document-model';
import type { HeaderShapeId } from './header-assembly/types';
import { PT_TO_CSS_PX, cssPxToPoints } from './puzzle-layout';

export interface TextPageContentAreaPt {
  marginPt: number;
  contentWidth: number;
  contentHeight: number;
}

export interface TextPageBlockRectPt {
  /** Left edge in PDF points (from page left). */
  left: number;
  /** Top edge distance from page top in points (CSS-style). */
  topFromPageTop: number;
  width: number;
  height: number;
  /** Bottom edge Y in PDF coordinates (origin bottom-left). */
  pdfBottomY: number;
  /** Inner text area after padding. */
  innerLeft: number;
  innerTopFromPageTop: number;
  innerWidth: number;
  innerHeight: number;
  paddingPt: number;
}

export function getTextPageContentAreaPt(
  pageWidth: number,
  pageHeight: number,
  marginPt: number
): TextPageContentAreaPt {
  return {
    marginPt,
    contentWidth: pageWidth - marginPt * 2,
    contentHeight: pageHeight - marginPt * 2,
  };
}

export function getBlockHeightPercent(block: TextPageBlock): number {
  if (block.heightPercent != null) return block.heightPercent;
  if (block.kind === 'image') return 28;
  if (block.kind === 'title') return 14;
  if (block.kind === 'subtitle') return 10;
  return 18;
}

export function getBlockPaddingPx(block: TextPageBlock): number {
  // Match TextPageBlockCanvas: unframed images have no box padding.
  if (block.kind === 'image' && !block.frameEnabled) return 0;
  if (block.frameEnabled) return block.framePaddingPx ?? 12;
  return block.boxPaddingPx ?? 10;
}

export function getBlockBorderPx(block: TextPageBlock): number {
  if (!block.frameEnabled) return 0;
  return Math.max(0, block.frameBorderThicknessPx ?? 2);
}

export function getTextPageBlockRectPt(
  block: TextPageBlock,
  pageHeight: number,
  area: TextPageContentAreaPt
): TextPageBlockRectPt {
  const heightPercent = getBlockHeightPercent(block);
  const width = (block.widthPercent / 100) * area.contentWidth;
  const height = (heightPercent / 100) * area.contentHeight;
  const left = area.marginPt + (block.xPercent / 100) * area.contentWidth;
  const topFromPageTop = area.marginPt + (block.yPercent / 100) * area.contentHeight;
  const paddingPt = cssPxToPoints(getBlockPaddingPx(block));
  // CSS border-box: padding + border sit inside the block box (canvas).
  const borderPt = cssPxToPoints(getBlockBorderPx(block));
  const insetPt = paddingPt + borderPt;

  return {
    left,
    topFromPageTop,
    width,
    height,
    pdfBottomY: pageHeight - topFromPageTop - height,
    innerLeft: left + insetPt,
    innerTopFromPageTop: topFromPageTop + insetPt,
    innerWidth: Math.max(1, width - insetPt * 2),
    innerHeight: Math.max(1, height - insetPt * 2),
    paddingPt,
  };
}

export function textPageFrameShapeToHeaderShape(shape?: TextPageBlockFrameShape): HeaderShapeId {
  switch (shape) {
    case 'rounded':
      return 'rounded-rect';
    case 'circle':
      return 'circle';
    case 'pill':
      return 'pill';
    default:
      return 'rectangle';
  }
}

/**
 * Canvas applies CSS `border-radius` even when `frameShape === 'rectangle'`.
 * Export must use a rounded path whenever corner radius is &gt; 0.
 */
export function resolveTextPageFrameShapeId(block: TextPageBlock): HeaderShapeId {
  const base = textPageFrameShapeToHeaderShape(block.frameShape);
  if (base === 'rectangle') {
    const radius = block.frameCornerRadiusPx ?? 0;
    if (radius > 0) return 'rounded-rect';
  }
  return base;
}

export function getFrameCornerRadiusPx(block: TextPageBlock, rectWidthPx?: number, rectHeightPx?: number): number {
  if (!block.frameEnabled) return 0;
  switch (block.frameShape) {
    case 'circle': {
      // Match CSS border-radius: 50% of the box (ellipse/circle clip).
      const w = rectWidthPx ?? block.widthPercent * 10;
      const h = rectHeightPx ?? getBlockHeightPercent(block) * 10;
      return Math.min(w, h) / 2;
    }
    case 'pill':
      return 9999;
    case 'rounded':
      return block.frameCornerRadiusPx ?? 10;
    default:
      // Rectangle (and unknown): still honor explicit corner radius like the canvas.
      return block.frameCornerRadiusPx ?? 0;
  }
}

/** Points → inches (PPT coordinate unit). */
export function ptToIn(pt: number): number {
  const v = pt / 72;
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

/** Top-from-page-top (pt) → PPT Y (inches, top-down). */
export function topPtToPptYIn(topFromPageTopPt: number): number {
  return ptToIn(topFromPageTopPt);
}

/** Ownership name line sits at the bottom of the inner box (CSS margin-top: auto). */
export function getOwnershipNameLineRect(
  rect: TextPageBlockRectPt,
  block: TextPageBlock,
  measuredNameLineBottomPt?: number
): {
  lineBottomFromPageTop: number;
  lineTopFromPageTop: number;
  nameLineHeightPt: number;
} {
  const nameLineHeightPt = cssPxToPoints(block.fontSize * PT_TO_CSS_PX * 1.4);
  const lineBottomFromPageTop =
    measuredNameLineBottomPt != null
      ? rect.innerTopFromPageTop + measuredNameLineBottomPt
      : rect.innerTopFromPageTop + rect.innerHeight;
  return {
    lineBottomFromPageTop,
    lineTopFromPageTop: lineBottomFromPageTop - nameLineHeightPt,
    nameLineHeightPt,
  };
}
