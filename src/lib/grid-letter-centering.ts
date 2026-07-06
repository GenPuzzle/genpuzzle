import type { CSSProperties } from 'react';
import type { PDFFont } from 'pdf-lib';

/** Max fraction of cell used by a glyph (width and height). */
export const GRID_LETTER_CELL_FILL_RATIO = 0.85;

/** Cap-height approximation for PDF vertical centering (not full em-box). */
export const PDF_CAP_HEIGHT_RATIO = 0.7;

export interface GridCellRect {
  cellW: number;
  cellH: number;
  left: number;
  top: number;
  centerX: number;
  centerY: number;
}

/**
 * Cell bounding box — top-left origin (canvas / CSS / PPT Y-down).
 * Text draws at (centerX, centerY) with textAlign center + textBaseline middle.
 */
export function getGridCellRectTopOrigin(
  gridLeft: number,
  gridTop: number,
  col: number,
  row: number,
  cellW: number,
  cellH: number
): GridCellRect {
  const left = gridLeft + col * cellW;
  const top = gridTop + row * cellH;
  return {
    cellW,
    cellH,
    left,
    top,
    centerX: left + cellW / 2,
    centerY: top + cellH / 2,
  };
}

/**
 * Cell bounding box — PDF bottom-left origin (Y grows upward).
 * centerY is the geometric centre of the cell in PDF coordinates.
 */
export function getGridCellRectPdf(
  gridStartX: number,
  pdfGridTopY: number,
  col: number,
  row: number,
  cellW: number,
  cellH: number
): GridCellRect {
  const left = gridStartX + col * cellW;
  const top = pdfGridTopY - row * cellH;
  return {
    cellW,
    cellH,
    left,
    top,
    centerX: left + cellW / 2,
    centerY: top - cellH / 2,
  };
}

/** Clamp requested size to cell height/width budget. */
export function fitGridLetterSizeToCell(
  requestedSize: number,
  cellSize: number,
  fillRatio: number = GRID_LETTER_CELL_FILL_RATIO
): number {
  return Math.max(1, Math.min(requestedSize, cellSize * fillRatio));
}

/** Scale down further when measured width or cap-height exceeds the cell. */
export function fitGridLetterSizeWithWidth(
  requestedSize: number,
  cellSize: number,
  letterWidth: number,
  fillRatio: number = GRID_LETTER_CELL_FILL_RATIO
): number {
  let size = fitGridLetterSizeToCell(requestedSize, cellSize, fillRatio);
  const maxSpan = cellSize * fillRatio;

  if (letterWidth > maxSpan && letterWidth > 0) {
    size = Math.max(1, size * (maxSpan / letterWidth));
  }

  const capHeight = size * PDF_CAP_HEIGHT_RATIO;
  if (capHeight > maxSpan) {
    size = Math.max(1, size * (maxSpan / capHeight));
  }

  return size;
}

/** Fit a letter using pdf-lib glyph metrics. */
export function fitGridLetterSizePdf(
  font: PDFFont,
  letter: string,
  requestedSizePt: number,
  cellSizePt: number,
  fillRatio: number = GRID_LETTER_CELL_FILL_RATIO
): number {
  let size = fitGridLetterSizeToCell(requestedSizePt, cellSizePt, fillRatio);
  const width = font.widthOfTextAtSize(letter, size);
  return Math.max(4, fitGridLetterSizeWithWidth(size, cellSizePt, width, fillRatio));
}

/** PDF drawText position from cell centre using the requested size (no cell clamp). */
export function getPdfLetterDrawCoordsAtRequestedSize(
  font: PDFFont,
  letter: string,
  requestedFontSizePt: number,
  cell: GridCellRect
): { x: number; y: number; size: number } {
  const size = Math.max(1, requestedFontSizePt);
  const textWidth = font.widthOfTextAtSize(letter, size);
  const visualTextHeight = size * PDF_CAP_HEIGHT_RATIO;
  return {
    x: cell.centerX - textWidth / 2,
    y: cell.centerY - visualTextHeight / 2,
    size,
  };
}

/** PDF drawText position from cell centre (pdf-lib baseline coords). */
export function getPdfLetterDrawCoords(
  font: PDFFont,
  letter: string,
  requestedFontSizePt: number,
  cell: GridCellRect
): { x: number; y: number; size: number } {
  const size = fitGridLetterSizePdf(font, letter, requestedFontSizePt, cell.cellW);
  const textWidth = font.widthOfTextAtSize(letter, size);
  const visualTextHeight = size * PDF_CAP_HEIGHT_RATIO;
  return {
    x: cell.centerX - textWidth / 2,
    y: cell.centerY - visualTextHeight / 2,
    size,
  };
}

/** Measure text width in CSS pixels (browser); heuristic fallback on server. */
export function measureTextWidthPx(
  text: string,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: number | string = 400
): number {
  if (typeof document === 'undefined') {
    return text.length * fontSizePx * 0.55;
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * fontSizePx * 0.55;
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** Fit letter font size for DOM / canvas snapshot (CSS px). */
export function fitGridLetterSizeCss(
  letter: string,
  requestedSizePx: number,
  cellSizePx: number,
  fontFamily: string,
  fontWeight: number | string = 400,
  fillRatio: number = GRID_LETTER_CELL_FILL_RATIO
): number {
  let size = fitGridLetterSizeToCell(requestedSizePx, cellSizePx, fillRatio);
  const width = measureTextWidthPx(letter, size, fontFamily, fontWeight);
  return fitGridLetterSizeWithWidth(size, cellSizePx, width, fillRatio);
}

/** PPT table cells: estimate width when DOM measure is unavailable. */
export function estimateLetterWidthPt(letter: string, fontSizePt: number): number {
  if (letter.length === 0) return 0;
  const ch = letter.toUpperCase();
  const narrow = ch === 'I' || ch === 'J' || ch === 'L' || ch === '1';
  const wide = ch === 'W' || ch === 'M' || ch === '%';
  const ratio = narrow ? 0.28 : wide ? 0.78 : 0.58;
  return fontSizePt * ratio;
}

export function fitGridLetterSizePpt(
  letter: string,
  requestedSizePt: number,
  cellSizePt: number,
  fillRatio: number = GRID_LETTER_CELL_FILL_RATIO
): number {
  let size = fitGridLetterSizeToCell(requestedSizePt, cellSizePt, fillRatio);
  const width = estimateLetterWidthPt(letter, size);
  return Math.max(4, Math.round(fitGridLetterSizeWithWidth(size, cellSizePt, width, fillRatio)));
}

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

/** Inner glyph — centred, clipped to cell. */
export function getGridLetterGlyphStyle(fontSize: number): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    maxHeight: '100%',
    lineHeight: 1,
    fontSize,
    margin: 0,
    padding: 0,
    textAlign: 'center',
    overflow: 'hidden',
  };
}
