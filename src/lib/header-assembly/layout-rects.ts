import type { UnifiedHeaderAssemblyBlock } from '../word-search-page-layout';
import { computeHeaderRowMetrics, cssPxToPt, ptToCssPx } from './compute-row';

export interface HeaderPartRect {
  xPt: number;
  yPt: number;
  wPt: number;
  hPt: number;
}

export interface HeaderAssemblyRects {
  number: HeaderPartRect | null;
  title: HeaderPartRect | null;
  subtitle: HeaderPartRect | null;
}

export function computeHeaderAssemblyRects(block: UnifiedHeaderAssemblyBlock): HeaderAssemblyRects {
  const { parts } = block;
  const rowMetrics = computeHeaderRowMetrics(block.widthPt, block.titleFontSizePt, parts);
  const subtitleFontPx = ptToCssPx(block.subtitleFontSizePt);

  const subtitleLines =
    block.subtitleLines.length > 0
      ? block.subtitleLines
      : parts.subtitleText
        ? [parts.subtitleText]
        : [];

  let xPt = 0;
  const yPt = 0;

  let number: HeaderPartRect | null = null;
  if (parts.showNumber) {
    number = {
      xPt,
      yPt,
      wPt: rowMetrics.numberWPt,
      hPt: rowMetrics.rowHPt,
    };
    xPt += rowMetrics.numberWPt + rowMetrics.gapPt;
  }

  let title: HeaderPartRect | null = null;
  if (parts.titleText && rowMetrics.titleAreaPt > 0) {
    title = { xPt, yPt, wPt: rowMetrics.titleAreaPt, hPt: rowMetrics.rowHPt };
  }

  let subtitle: HeaderPartRect | null = null;
  if (subtitleLines.length > 0) {
    const bandWPt = block.subtitleTextWidthPt;
    const bandHPt = cssPxToPt(
      Math.max(
        rowMetrics.rowHPx * 0.85,
        subtitleLines.length * subtitleFontPx * 1.3 + ptToCssPx(10) + 12
      )
    );
    subtitle = {
      xPt: (block.widthPt - bandWPt) / 2,
      yPt: rowMetrics.rowHPt + rowMetrics.gapPt,
      wPt: bandWPt,
      hPt: bandHPt,
    };
  }

  return { number, title, subtitle };
}
