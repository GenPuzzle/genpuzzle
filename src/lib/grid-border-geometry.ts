import { cssPxToPoints } from './puzzle-layout';

/**
 * Grid border rectangle shared by UI canvas snapshot, preview, and PDF export.
 * Matches WordSearchGrid.tsx CSS content-box: [border][padding][letter grid].
 */
export interface GridBorderGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  borderThickness: number;
}

export interface GridBorderOuterBounds {
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
}

/** Border thickness in PDF points from a CSS-pixel slider value. */
export function getGridBorderThicknessPt(borderThicknessCssPx: number): number {
  return Math.max(0.5, cssPxToPoints(borderThicknessCssPx));
}

/**
 * Outer border box (top-origin) — frame shape bounds for PPT / preview overlays.
 * Letter grid stays at (gridLeftPt, gridTopPt); padding sits inside the border.
 */
export function computeGridBorderOuterBounds(
  gridLeftPt: number,
  gridTopPt: number,
  innerGridWidthPt: number,
  innerGridHeightPt: number,
  paddingPt: number,
  borderThicknessCssPx: number,
  noBox: boolean
): GridBorderOuterBounds {
  if (noBox) {
    return {
      leftPt: gridLeftPt,
      topPt: gridTopPt,
      widthPt: innerGridWidthPt,
      heightPt: innerGridHeightPt,
    };
  }

  const borderPt = getGridBorderThicknessPt(borderThicknessCssPx);
  return {
    leftPt: gridLeftPt - paddingPt - borderPt,
    topPt: gridTopPt - paddingPt - borderPt,
    widthPt: innerGridWidthPt + paddingPt * 2 + borderPt * 2,
    heightPt: innerGridHeightPt + paddingPt * 2 + borderPt * 2,
  };
}

function buildGridBorderStrokeRect(
  outerLeftPt: number,
  outerBottomPt: number,
  outerWidthPt: number,
  outerHeightPt: number,
  borderThicknessPt: number,
  cornerRadiusCssPx: number
): Pick<GridBorderGeometry, 'x' | 'y' | 'width' | 'height' | 'radius' | 'borderThickness'> {
  const half = borderThicknessPt / 2;
  const width = outerWidthPt - borderThicknessPt;
  const height = outerHeightPt - borderThicknessPt;
  const radiusPt = cssPxToPoints(cornerRadiusCssPx);
  const radius = Math.min(Math.max(0, radiusPt), width / 2, height / 2);

  return {
    x: outerLeftPt + half,
    y: outerBottomPt + half,
    width,
    height,
    radius,
    borderThickness: borderThicknessPt,
  };
}

/**
 * PDF bottom-origin stroke path for the puzzle border (letters at gridLeftPt).
 */
export function computeGridBorderGeometry(
  gridLeftPt: number,
  gridBottomPt: number,
  innerGridWidthPt: number,
  innerGridHeightPt: number,
  paddingPt: number,
  borderThicknessCssPx: number,
  cornerRadiusCssPx: number,
  noBox: boolean
): GridBorderGeometry | null {
  if (noBox) return null;

  const borderThickness = getGridBorderThicknessPt(borderThicknessCssPx);
  const outerLeft = gridLeftPt - paddingPt - borderThickness;
  const outerBottom = gridBottomPt - paddingPt - borderThickness;
  const outerWidth = innerGridWidthPt + paddingPt * 2 + borderThickness * 2;
  const outerHeight = innerGridHeightPt + paddingPt * 2 + borderThickness * 2;

  if (
    !Number.isFinite(gridLeftPt) ||
    !Number.isFinite(gridBottomPt) ||
    outerWidth <= borderThickness ||
    outerHeight <= borderThickness
  ) {
    return null;
  }

  return {
    ...buildGridBorderStrokeRect(
      outerLeft,
      outerBottom,
      outerWidth,
      outerHeight,
      borderThickness,
      cornerRadiusCssPx
    ),
    borderThickness,
  };
}

/** Top-origin variant for canvas preview verification. */
export function computeGridBorderBoxTopOrigin(
  gridLeftPt: number,
  gridTopPt: number,
  innerGridWidthPt: number,
  innerGridHeightPt: number,
  paddingPt: number,
  borderThicknessCssPx: number,
  cornerRadiusCssPx: number,
  noBox: boolean
): GridBorderGeometry | null {
  if (noBox) return null;

  const borderThickness = getGridBorderThicknessPt(borderThicknessCssPx);
  const outerLeft = gridLeftPt - paddingPt - borderThickness;
  const outerTop = gridTopPt - paddingPt - borderThickness;
  const outerWidth = innerGridWidthPt + paddingPt * 2 + borderThickness * 2;
  const outerHeight = innerGridHeightPt + paddingPt * 2 + borderThickness * 2;

  if (
    !Number.isFinite(gridLeftPt) ||
    !Number.isFinite(gridTopPt) ||
    outerWidth <= borderThickness ||
    outerHeight <= borderThickness
  ) {
    return null;
  }

  const half = borderThickness / 2;
  const width = outerWidth - borderThickness;
  const height = outerHeight - borderThickness;
  const radiusPt = cssPxToPoints(cornerRadiusCssPx);
  const radius = Math.min(Math.max(0, radiusPt), width / 2, height / 2);

  return {
    x: outerLeft + half,
    y: outerTop + half,
    width,
    height,
    radius,
    borderThickness,
  };
}
