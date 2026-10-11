import type { ResolvedElement } from './types';

/** Move page-absolute elements into a local box. Does not change sizes. */
export function shiftElements(elements: ResolvedElement[], left: number, top: number): ResolvedElement[] {
  return elements.map((el) => {
    switch (el.kind) {
      case 'text':
      case 'rect':
      case 'shape':
      case 'image':
        return { ...el, x: el.x - left, y: el.y - top };
      case 'ellipse':
        return { ...el, cx: el.cx - left, cy: el.cy - top };
      case 'line':
      case 'stadium':
        return { ...el, x1: el.x1 - left, y1: el.y1 - top, x2: el.x2 - left, y2: el.y2 - top };
      case 'polygon':
        return { ...el, points: el.points.map((p) => ({ x: p.x - left, y: p.y - top })) };
      default: {
        const _never: never = el;
        return _never;
      }
    }
  });
}
