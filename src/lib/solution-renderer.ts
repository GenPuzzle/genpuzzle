/**
 * Solution rendering strategies for Word Search puzzles
 * Supports multiple display modes for found words in solutions
 */

export interface SolutionRenderConfig {
  mode: 'none' | 'line-highlight';
  color: string;
  thickness: number;
  padding?: number;
  frameRadius?: number;
  solutionHighlightMode?: 'box-frame' | 'outline';
  solutionLineCap?: 'butt' | 'round';
  // 0-100 transparency for line-highlight (100 = opaque)
  alpha?: number;
}

export interface WordPath {
  word: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  cellSize: number;
}

// Render rounded frame around found words
export function renderRoundedFrame(
  wordPath: WordPath,
  config: SolutionRenderConfig
): SVGElement | null {
  // Rounded-frame mode removed; keep function for backward compatibility but no-op
  return null;

  const isHorizontal = wordPath.startY === wordPath.endY;
  const isVertical = wordPath.startX === wordPath.endX;

  if (isHorizontal || isVertical) {
    // Horizontal or vertical word
    const startCol = Math.min(wordPath.startX, wordPath.endX);
    const endCol = Math.max(wordPath.startX, wordPath.endX);
    const startRow = Math.min(wordPath.startY, wordPath.endY);
    const endRow = Math.max(wordPath.startY, wordPath.endY);

    const padding = config.padding || 0;
    const x = startCol * wordPath.cellSize + padding;
    const y = startRow * wordPath.cellSize + padding;
    const width = (endCol - startCol + 1) * wordPath.cellSize - padding * 2;
    const height = (endRow - startRow + 1) * wordPath.cellSize - padding * 2;
    const radius = config.frameRadius || Math.min(width, height) / 2;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', String(radius));
    rect.setAttribute('ry', String(radius));
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', config.color);
    rect.setAttribute('stroke-width', String(config.thickness));

    return rect;
  } else {
    // Diagonal word - draw rotated rectangle
    const startCellX = wordPath.startX * wordPath.cellSize;
    const startCellY = wordPath.startY * wordPath.cellSize;
    const endCellX = wordPath.endX * wordPath.cellSize;
    const endCellY = wordPath.endY * wordPath.cellSize;

    const centerX = (startCellX + endCellX) / 2 + wordPath.cellSize / 2;
    const centerY = (startCellY + endCellY) / 2 + wordPath.cellSize / 2;

    const dx = endCellX - startCellX;
    const dy = endCellY - startCellY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    const padding = config.padding || 0;
    const width = distance + wordPath.cellSize * 0.16;
    const height = wordPath.cellSize - padding * 2;
    const radius = Math.min(wordPath.cellSize * 0.2, height / 2);

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(centerX - width / 2));
    rect.setAttribute('y', String(centerY - height / 2));
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', String(radius));
    rect.setAttribute('ry', String(radius));
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', config.color);
    rect.setAttribute('stroke-width', String(config.thickness));
    rect.setAttribute('stroke-linecap', 'round');
    rect.setAttribute('stroke-linejoin', 'round');
    rect.setAttribute('transform', `rotate(${angle} ${centerX} ${centerY})`);

    return rect;
  }
}

// Render line through found words
export function renderLineHighlight(
  wordPath: WordPath,
  config: SolutionRenderConfig
): SVGElement | null {
  if (config.mode !== 'line-highlight') return null;

  // Calculate center points of start and end cells
  const startX = wordPath.startX * wordPath.cellSize + wordPath.cellSize / 2;
  const startY = wordPath.startY * wordPath.cellSize + wordPath.cellSize / 2;
  const endX = wordPath.endX * wordPath.cellSize + wordPath.cellSize / 2;
  const endY = wordPath.endY * wordPath.cellSize + wordPath.cellSize / 2;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(startX));
  line.setAttribute('y1', String(startY));
  line.setAttribute('x2', String(endX));
  line.setAttribute('y2', String(endY));
  line.setAttribute('stroke', config.color);
  if (config.alpha !== undefined) {
    const opacity = Math.max(0, Math.min(100, config.alpha)) / 100;
    line.setAttribute('stroke-opacity', String(opacity));
  }
  line.setAttribute('stroke-width', String(config.thickness));
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');

  return line;
}

// Get SVG elements for solution rendering based on config
export function getSolutionSVGElements(
  wordPaths: WordPath[],
  config: SolutionRenderConfig
): SVGElement[] {
  if (config.mode === 'none') return [];

  const elements: SVGElement[] = [];

  for (const wordPath of wordPaths) {
    if (config.mode === 'line-highlight') {
      const element = renderLineHighlight(wordPath, config);
      if (element) elements.push(element);
    }
  }

  return elements;
}

// For PDF rendering - return path data for drawing
export interface PDFSolutionPath {
  type: 'line';
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  opacity?: number;
  mode?: 'fill' | 'outline';
  lineCap?: 'butt' | 'round';
  thickness?: number;
}

export function getPDFSolutionPaths(
  wordPath: WordPath,
  config: SolutionRenderConfig
): PDFSolutionPath | null {
  if (config.mode === 'none') return null;

  if (config.mode !== 'line-highlight') return null;

  const startX = wordPath.startX * wordPath.cellSize + wordPath.cellSize / 2;
  const startY = wordPath.startY * wordPath.cellSize + wordPath.cellSize / 2;
  const endX = wordPath.endX * wordPath.cellSize + wordPath.cellSize / 2;
  const endY = wordPath.endY * wordPath.cellSize + wordPath.cellSize / 2;
  const opacity = config.alpha !== undefined ? Math.max(0, Math.min(100, config.alpha)) / 100 : 1;
  const thickness = Math.max(1, config.thickness);
  const padding = config.padding ?? 0;
  const mode = config.solutionHighlightMode || 'box-frame';
  const lineCap = config.solutionLineCap || 'butt';

  const isHorizontal = wordPath.startY === wordPath.endY;
  const isVertical = wordPath.startX === wordPath.endX;
  const isDiagonal = !isHorizontal && !isVertical;

  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const directionX = distance > 0 ? dx / distance : 1;
  const directionY = distance > 0 ? dy / distance : 0;
  const paddedStartX = startX - directionX * padding;
  const paddedStartY = startY - directionY * padding;
  const paddedEndX = endX + directionX * padding;
  const paddedEndY = endY + directionY * padding;

  return {
    type: 'line',
    startX: paddedStartX,
    startY: paddedStartY,
    endX: paddedEndX,
    endY: paddedEndY,
    opacity,
    mode,
    lineCap,
    thickness,
  };
}
