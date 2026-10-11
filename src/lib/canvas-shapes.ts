/**
 * PowerPoint-style shapes for Canvas Workspace.
 * Canvas and PDF draw the shared path. PPTX uses the native shape name.
 */

export const CANVAS_SHAPE_TYPES = [
  'rect',
  'roundRect',
  'ellipse',
  'triangle',
  'rtTriangle',
  'diamond',
  'parallelogram',
  'trapezoid',
  'pentagon',
  'hexagon',
  'octagon',
  'chevron',
  'rightArrow',
  'leftArrow',
  'upArrow',
  'downArrow',
  'star5',
  'plus',
  'heart',
  'cloud',
  'callout',
  'cube',
] as const;

export type CanvasShapeType = (typeof CANVAS_SHAPE_TYPES)[number];

export const CANVAS_SHAPE_LABELS: Record<CanvasShapeType, string> = {
  rect: 'Rectangle',
  roundRect: 'Rounded rectangle',
  ellipse: 'Oval',
  triangle: 'Triangle',
  rtTriangle: 'Right triangle',
  diamond: 'Diamond',
  parallelogram: 'Parallelogram',
  trapezoid: 'Trapezoid',
  pentagon: 'Pentagon',
  hexagon: 'Hexagon',
  octagon: 'Octagon',
  chevron: 'Chevron',
  rightArrow: 'Right arrow',
  leftArrow: 'Left arrow',
  upArrow: 'Up arrow',
  downArrow: 'Down arrow',
  star5: 'Star',
  plus: 'Plus',
  heart: 'Heart',
  cloud: 'Cloud',
  callout: 'Callout',
  cube: 'Cube',
};

export const CANVAS_SHAPE_PPT_NAME: Record<CanvasShapeType, string> = {
  rect: 'rect',
  roundRect: 'roundRect',
  ellipse: 'ellipse',
  triangle: 'triangle',
  rtTriangle: 'rtTriangle',
  diamond: 'diamond',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  octagon: 'octagon',
  chevron: 'chevron',
  rightArrow: 'rightArrow',
  leftArrow: 'leftArrow',
  upArrow: 'upArrow',
  downArrow: 'downArrow',
  star5: 'star5',
  plus: 'plus',
  heart: 'heart',
  cloud: 'cloud',
  callout: 'wedgeRoundRectCallout',
  cube: 'cube',
};

export function isCanvasShapeType(value: unknown): value is CanvasShapeType {
  return CANVAS_SHAPE_TYPES.includes(value as CanvasShapeType);
}

function regularPolygon(sides: number, inset = 0.08): Array<{ x: number; y: number }> {
  const points: Array<{ x: number; y: number }> = [];
  const cx = 0.5;
  const cy = 0.5;
  const r = 0.5 - inset;
  const start = -Math.PI / 2;
  for (let i = 0; i < sides; i++) {
    const a = start + (i * 2 * Math.PI) / sides;
    points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return points;
}

/** Unit-box path (0–1). Used by canvas and PDF. */
export function canvasShapeUnitPoints(type: CanvasShapeType): Array<{ x: number; y: number }> {
  switch (type) {
    case 'rect':
    case 'roundRect':
    case 'cube':
      return [
        { x: 0.04, y: 0.04 },
        { x: 0.96, y: 0.04 },
        { x: 0.96, y: 0.96 },
        { x: 0.04, y: 0.96 },
      ];
    case 'ellipse':
      return regularPolygon(24, 0.02);
    case 'triangle':
      return [
        { x: 0.5, y: 0.06 },
        { x: 0.94, y: 0.94 },
        { x: 0.06, y: 0.94 },
      ];
    case 'rtTriangle':
      return [
        { x: 0.08, y: 0.08 },
        { x: 0.08, y: 0.92 },
        { x: 0.92, y: 0.92 },
      ];
    case 'diamond':
      return [
        { x: 0.5, y: 0.04 },
        { x: 0.96, y: 0.5 },
        { x: 0.5, y: 0.96 },
        { x: 0.04, y: 0.5 },
      ];
    case 'parallelogram':
      return [
        { x: 0.22, y: 0.08 },
        { x: 0.96, y: 0.08 },
        { x: 0.78, y: 0.92 },
        { x: 0.04, y: 0.92 },
      ];
    case 'trapezoid':
      return [
        { x: 0.22, y: 0.1 },
        { x: 0.78, y: 0.1 },
        { x: 0.96, y: 0.9 },
        { x: 0.04, y: 0.9 },
      ];
    case 'pentagon':
      return regularPolygon(5);
    case 'hexagon':
      return regularPolygon(6);
    case 'octagon':
      return regularPolygon(8);
    case 'chevron':
      return [
        { x: 0.06, y: 0.18 },
        { x: 0.62, y: 0.18 },
        { x: 0.94, y: 0.5 },
        { x: 0.62, y: 0.82 },
        { x: 0.06, y: 0.82 },
        { x: 0.38, y: 0.5 },
      ];
    case 'rightArrow':
      return [
        { x: 0.04, y: 0.32 },
        { x: 0.58, y: 0.32 },
        { x: 0.58, y: 0.12 },
        { x: 0.96, y: 0.5 },
        { x: 0.58, y: 0.88 },
        { x: 0.58, y: 0.68 },
        { x: 0.04, y: 0.68 },
      ];
    case 'leftArrow':
      return [
        { x: 0.96, y: 0.32 },
        { x: 0.42, y: 0.32 },
        { x: 0.42, y: 0.12 },
        { x: 0.04, y: 0.5 },
        { x: 0.42, y: 0.88 },
        { x: 0.42, y: 0.68 },
        { x: 0.96, y: 0.68 },
      ];
    case 'upArrow':
      return [
        { x: 0.32, y: 0.96 },
        { x: 0.32, y: 0.42 },
        { x: 0.12, y: 0.42 },
        { x: 0.5, y: 0.04 },
        { x: 0.88, y: 0.42 },
        { x: 0.68, y: 0.42 },
        { x: 0.68, y: 0.96 },
      ];
    case 'downArrow':
      return [
        { x: 0.32, y: 0.04 },
        { x: 0.32, y: 0.58 },
        { x: 0.12, y: 0.58 },
        { x: 0.5, y: 0.96 },
        { x: 0.88, y: 0.58 },
        { x: 0.68, y: 0.58 },
        { x: 0.68, y: 0.04 },
      ];
    case 'star5': {
      const points: Array<{ x: number; y: number }> = [];
      const cx = 0.5;
      const cy = 0.52;
      const outer = 0.46;
      const inner = 0.18;
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
      return points;
    }
    case 'plus':
      return [
        { x: 0.38, y: 0.06 },
        { x: 0.62, y: 0.06 },
        { x: 0.62, y: 0.38 },
        { x: 0.94, y: 0.38 },
        { x: 0.94, y: 0.62 },
        { x: 0.62, y: 0.62 },
        { x: 0.62, y: 0.94 },
        { x: 0.38, y: 0.94 },
        { x: 0.38, y: 0.62 },
        { x: 0.06, y: 0.62 },
        { x: 0.06, y: 0.38 },
        { x: 0.38, y: 0.38 },
      ];
    case 'heart':
      return [
        { x: 0.5, y: 0.92 },
        { x: 0.12, y: 0.54 },
        { x: 0.08, y: 0.32 },
        { x: 0.2, y: 0.12 },
        { x: 0.4, y: 0.12 },
        { x: 0.5, y: 0.26 },
        { x: 0.6, y: 0.12 },
        { x: 0.8, y: 0.12 },
        { x: 0.92, y: 0.32 },
        { x: 0.88, y: 0.54 },
      ];
    case 'cloud':
      return [
        { x: 0.22, y: 0.62 },
        { x: 0.16, y: 0.48 },
        { x: 0.22, y: 0.34 },
        { x: 0.36, y: 0.28 },
        { x: 0.48, y: 0.22 },
        { x: 0.64, y: 0.26 },
        { x: 0.78, y: 0.34 },
        { x: 0.86, y: 0.48 },
        { x: 0.8, y: 0.64 },
        { x: 0.62, y: 0.74 },
        { x: 0.38, y: 0.74 },
      ];
    case 'callout':
      return [
        { x: 0.08, y: 0.08 },
        { x: 0.92, y: 0.08 },
        { x: 0.92, y: 0.62 },
        { x: 0.38, y: 0.62 },
        { x: 0.16, y: 0.92 },
        { x: 0.28, y: 0.62 },
        { x: 0.08, y: 0.62 },
      ];
    default:
      return regularPolygon(4);
  }
}

export function canvasShapePoints(
  type: CanvasShapeType,
  x: number,
  y: number,
  w: number,
  h: number
): Array<{ x: number; y: number }> {
  return canvasShapeUnitPoints(type).map((point) => ({
    x: x + point.x * w,
    y: y + point.y * h,
  }));
}
