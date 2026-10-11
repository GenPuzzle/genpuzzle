import type { ResolvedElement } from './types';
import { unsupportedPrimitive } from './types';

/**
 * Every drawing primitive. Add a kind here and to the element union in the
 * same change. The consistency check draws one sample of each kind with the
 * canvas, PDF, and PPTX renderers.
 */
export const RESOLVED_ELEMENT_KINDS = [
  'text',
  'rect',
  'ellipse',
  'line',
  'stadium',
  'polygon',
  'shape',
  'image',
] as const;

export type ResolvedElementKind = (typeof RESOLVED_ELEMENT_KINDS)[number];

type KindOf<K extends ResolvedElementKind> = Extract<ResolvedElement, { kind: K }>;

export type ResolvedDrawHandlers<T> = {
  [K in ResolvedElementKind]: (element: KindOf<K>) => T;
};

/**
 * One switch for every renderer. A new kind is a type error here and a failed
 * consistency check until canvas, PDF, and PPTX each supply a handler.
 */
export function dispatchResolved<T>(
  renderer: string,
  element: ResolvedElement,
  draw: ResolvedDrawHandlers<T>
): T {
  switch (element.kind) {
    case 'text':
      return draw.text(element);
    case 'rect':
      return draw.rect(element);
    case 'ellipse':
      return draw.ellipse(element);
    case 'line':
      return draw.line(element);
    case 'stadium':
      return draw.stadium(element);
    case 'polygon':
      return draw.polygon(element);
    case 'shape':
      return draw.shape(element);
    case 'image':
      return draw.image(element);
    default: {
      const missing: never = element;
      return unsupportedPrimitive(renderer, missing);
    }
  }
}
