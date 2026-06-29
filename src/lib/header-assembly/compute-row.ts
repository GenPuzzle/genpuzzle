import type { HeaderTextParts } from './resolve-parts';

const GAP_PX = 8;
const PAD_X_PX = 14;
/** Horizontal padding inside shape text area (matches ShapeContainer). */
const SHAPE_PAD_X_PX = 20;

export function cssPxToPt(px: number): number {
  return (px * 72) / 96;
}

export function ptToCssPx(pt: number): number {
  return (pt * 96) / 72;
}

export interface HeaderRowMetrics {
  rowHPt: number;
  rowHPx: number;
  gapPt: number;
  numberWPt: number;
  titleAreaPt: number;
  titleTextMaxWidthPt: number;
}

export function computeHeaderRowMetrics(
  headerWidthPt: number,
  titleFontSizePt: number,
  parts: Pick<HeaderTextParts, 'showNumber' | 'numberText'>
): HeaderRowMetrics {
  const titleFontPx = ptToCssPx(titleFontSizePt);
  const rowHPx = Math.max(34, titleFontPx * 1.4);
  const rowHPt = cssPxToPt(rowHPx);
  const gapPt = cssPxToPt(GAP_PX);
  const padXPt = cssPxToPt(PAD_X_PX);

  const numberWPt = parts.showNumber
    ? cssPxToPt(
        Math.max(rowHPx + 4, parts.numberText.length * titleFontPx * 0.58 + padXPt * 2)
      )
    : 0;

  const titleAreaPt = Math.max(0, headerWidthPt - numberWPt - (parts.showNumber ? gapPt : 0));
  const titleTextMaxWidthPt = Math.max(24, titleAreaPt - cssPxToPt(SHAPE_PAD_X_PX));

  return {
    rowHPt,
    rowHPx,
    gapPt,
    numberWPt,
    titleAreaPt,
    titleTextMaxWidthPt,
  };
}
