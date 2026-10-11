/**
 * Renderer-independent page art. Coordinates are points, origin at the
 * top-left of the page. Canvas, PDF, and PPTX only translate these primitives.
 */

import type { CanvasShapeType } from '../canvas-shapes';
import type { TextEffectStyle } from '../text-effects';

export type TextAlign = 'left' | 'center' | 'right';
export type TextValign = 'top' | 'middle' | 'bottom';

export interface ResolvedText {
  kind: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  /** Pre-wrapped lines. Renderers must not reflow. */
  lines: string[];
  fontFamily: string;
  fontSize: number;
  bold?: boolean;
  italic?: boolean;
  color: string;
  align: TextAlign;
  valign: TextValign;
  /** Distance from one baseline to the next, in points. */
  lineHeight: number;
  /**
   * Extra space after each character, in em (fontSize fraction).
   * Matches CSS `letter-spacing`. Canvas/PDF/PPTX must apply it.
   */
  letterSpacingEm?: number;
  /** Clockwise rotation around the box center. */
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  /** Professional style. Renderers keep live text. */
  effect?: TextEffectStyle;
}

export interface ResolvedRect {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
  /** 0–1 fill opacity. Omitted means fully opaque. */
  opacity?: number;
}

export interface ResolvedEllipse {
  kind: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface ResolvedLine {
  kind: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  dash?: number[];
  /** 0–1 stroke opacity. Omitted means fully opaque. */
  opacity?: number;
}

/** Axis-aligned round-cap stroke, matching SVG stroke-linecap: round. */
export interface ResolvedStadium {
  kind: 'stadium';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  thickness: number;
  /** 0–1. Omitted means fully opaque. */
  opacity?: number;
}

export interface ResolvedPolygon {
  kind: 'polygon';
  points: Array<{ x: number; y: number }>;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

/** PowerPoint-native shape. Canvas/PDF draw the shared path. */
export interface ResolvedShape {
  kind: 'shape';
  shape: CanvasShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Corner radius in points (roundRect). */
  cornerRadius?: number;
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export interface ResolvedImage {
  kind: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  /** True SVG markup. Canvas preview draws this; print rasterizes it. */
  svg?: string;
  fit: 'contain' | 'cover' | 'stretch';
  opacity?: number;
  /** Clockwise rotation around the box center. */
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
}

export type ResolvedElement =
  | ResolvedText
  | ResolvedRect
  | ResolvedEllipse
  | ResolvedLine
  | ResolvedStadium
  | ResolvedPolygon
  | ResolvedShape
  | ResolvedImage;

export interface ResolvedPage {
  id: string;
  kind: string;
  widthPt: number;
  heightPt: number;
  elements: ResolvedElement[];
  /** Content revision. Preview and exports for this revision share the page. */
  revision: string;
}

export function unsupportedPrimitive(renderer: string, element: ResolvedElement): never {
  throw new Error(
    `${renderer} cannot draw primitive "${element.kind}". Add it to the canvas, PDF, and PPTX renderers. Do not skip or flatten it.`
  );
}
