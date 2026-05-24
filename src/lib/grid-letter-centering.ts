import type { CSSProperties } from 'react';
import type { PDFFont } from 'pdf-lib';

/**
 * Master outer border rectangle (FIRST calculation).
 * This is the definitive outer boundary for the entire puzzle grid.
 * Everything else (cells, letters) is positioned relative to this border.
 */
export interface MasterOuterBorder {
  // Outer border edge coordinates (stroke applied at exact boundary)
  left: number;
  top: number;
  right: number;
  bottom: number;
  // Inner dimensions (usable area inside the border)
  innerWidth: number;
  innerHeight: number;
  // Border properties
  borderThickness: number;
  // Grid structure
  cols: number;
  rows: number;
  // Derived cell dimensions
  innerCellWidth: number;
  innerCellHeight: number;
}

/**
 * Calculate the master outer border FIRST.
 * This ensures the border is positioned absolutely, and all internal cells are divided from this.
 */
export function getMasterOuterBorder(
  centerXOnPage: number,
  topYOnPage: number,
  gridWidth: number, // width of all columns combined (cols * cellSize)
  gridHeight: number, // height of all rows combined (rows * cellSize)
  borderThickness: number,
  cols: number,
  rows: number
): MasterOuterBorder {
  const borderHalf = borderThickness / 2;

  return {
    // Outer boundary (stroke centered on this boundary)
    left: centerXOnPage - gridWidth / 2 - borderHalf,
    top: topYOnPage + borderHalf,
    right: centerXOnPage + gridWidth / 2 + borderHalf,
    bottom: topYOnPage - gridHeight - borderHalf,
    // Inner usable area (inside the border strokes)
    innerWidth: gridWidth,
    innerHeight: gridHeight,
    borderThickness,
    cols,
    rows,
    // Cell dimensions (divide the inner area)
    innerCellWidth: gridWidth / cols,
    innerCellHeight: gridHeight / rows,
  };
}

/**
 * Grid content bounds (cell area only).
 * borderWidth = cols * cellSize, borderHeight = rows * cellSize.
 */
export interface GridCellBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  cols: number;
  rows: number;
  cellSize: number;
}

export function getGridCellBounds(
  gridStartX: number,
  gridTopY: number,
  cols: number,
  rows: number,
  cellSize: number
): GridCellBounds {
  return {
    left: gridStartX,
    top: gridTopY,
    width: cols * cellSize,
    height: rows * cellSize,
    cols,
    rows,
    cellSize,
  };
}

/**
 * PDF border rectangle aligned to exact grid edges.
 * DEPRECATED: Use getMasterOuterBorder for new rendering.
 */
export function getPdfGridBorderRectangle(
  gridStartX: number,
  gridTopY: number,
  cols: number,
  rows: number,
  cellSize: number,
  borderThicknessPt: number
): { x: number; y: number; width: number; height: number; borderWidth: number } {
  const borderWidth = cols * cellSize;
  const borderHeight = rows * cellSize;
  const borderLeft = gridStartX;
  const borderBottom = gridTopY - borderHeight;
  const B = borderThicknessPt;

  return {
    x: borderLeft - B / 2,
    y: borderBottom - B / 2,
    width: borderWidth + B,
    height: borderHeight + B,
    borderWidth: B,
  };
}

export function getPdfCellLeft(gridStartX: number, col: number, cellSize: number): number {
  return gridStartX + col * cellSize;
}

export function getPdfCellBottom(gridTopY: number, row: number, cellSize: number): number {
  return gridTopY - row * cellSize - cellSize;
}

/**
 * Get letter position in a grid cell using the master outer border approach.
 * This calculates cell coordinates strictly relative to the inner border boundary.
 */
export function getLetterPositionInCell(
  masterBorder: MasterOuterBorder,
  rowIndex: number,
  colIndex: number,
  font: PDFFont,
  letter: string,
  fontSize: number
): { x: number; y: number } {
  // Inner boundary (where the grid cells start, just inside the border strokes)
  const innerLeft = masterBorder.left + masterBorder.borderThickness / 2;
  const innerTop = masterBorder.top - masterBorder.borderThickness / 2;

  // Calculate cell boundaries
  const cellLeft = innerLeft + colIndex * masterBorder.innerCellWidth;
  const cellTop = innerTop - rowIndex * masterBorder.innerCellHeight;
  const cellBottom = cellTop - masterBorder.innerCellHeight;

  // Get text dimensions for precise centering
  const textWidth = font.widthOfTextAtSize(letter, fontSize);
  const textHeight = font.heightAtSize(fontSize, { descender: true });

  // Center the text absolutely in the cell
  const x = cellLeft + (masterBorder.innerCellWidth - textWidth) / 2;
  const y = cellBottom + (masterBorder.innerCellHeight - textHeight) / 2;

  return { x, y };
}

/**
 * Center a single grid letter in a PDF cell (pdf-lib draws from baseline).
 * DEPRECATED: Use getLetterPositionInCell with getMasterOuterBorder for new rendering.
 */
export function getCenteredGridLetterPdfPosition(
  font: PDFFont,
  letter: string,
  fontSize: number,
  cellLeft: number,
  cellBottom: number,
  cellSize: number
): { x: number; y: number } {
  const textWidth = font.widthOfTextAtSize(letter, fontSize);
  const textHeight = font.heightAtSize(fontSize, { descender: true });

  const x = cellLeft + (cellSize - textWidth) / 2;
  const y = cellBottom + (cellSize - textHeight) / 2;

  return { x, y };
}

/** CSS for a grid cell — dead center via grid placement. */
export function getGridCellWrapperStyle(options: {
  cellSize: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  fontWeight?: number;
  borderRadius?: number;
  backgroundColor?: string;
}): CSSProperties {
  return {
    width: options.cellSize,
    height: options.cellSize,
    display: 'grid',
    placeItems: 'center',
    lineHeight: 1,
    fontFamily: options.fontFamily,
    fontWeight: options.fontWeight ?? 400,
    color: options.color,
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
    textAlign: 'center',
    overflow: 'hidden',
    backgroundColor: options.backgroundColor ?? 'transparent',
    border: 'none',
    borderRadius: options.borderRadius,
    position: 'relative',
    zIndex: 2,
  };
}

/** Inner glyph fills the cell box for optical centering. */
export function getGridLetterGlyphStyle(fontSize: number): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    lineHeight: 1,
    fontSize,
    margin: 0,
    padding: 0,
    textAlign: 'center',
  };
}
