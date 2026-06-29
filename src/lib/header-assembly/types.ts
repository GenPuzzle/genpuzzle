/**
 * Modular header assembly — decoupled Number / Title / Subtitle shape configs.
 * No preset templates; users mix any of 10 shapes per element independently.
 */

export type HeaderShapeId =
  | 'rectangle'
  | 'rounded-rect'
  | 'pill'
  | 'circle'
  | 'polygon'
  | 'hexagon'
  | 'trapezoid'
  | 'parallelogram'
  | 'chevron'
  | 'ribbon-notch';

export type HeaderEditorTarget = 'number' | 'title' | 'subtitle';

export interface HeaderNumberConfig {
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  /** 3–12 sides for polygon-based shapes. */
  polygonSides: number;
  /** Badge text color. */
  textColor: string;
  /** Empty string inherits the puzzle title font. */
  fontFamily: string;
  /** 0 inherits the puzzle title size (pt). */
  fontSizePt: number;
}

export interface HeaderTitleConfig {
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  borderRadiusPx: number;
}

export interface HeaderSubtitleConfig {
  shapeId: HeaderShapeId;
  fillColor: string;
  borderColor: string;
  borderThicknessPx: number;
  borderRadiusPx: number;
  /** 0 = invisible border, 100 = opaque. */
  borderOpacity: number;
}

export interface HeaderAssemblySettings {
  enabled: boolean;
  /** Which element's contextual controls are shown in the sidebar. */
  editorTarget: HeaderEditorTarget;
  number: HeaderNumberConfig;
  title: HeaderTitleConfig;
  subtitle: HeaderSubtitleConfig;
}

export const HEADER_DEFAULT_PALETTE = {
  black: '#000000',
  white: '#ffffff',
  greyFill: '#f3f4f6',
  greyBorder: '#374151',
  greyText: '#6b7280',
} as const;

const DEFAULT_NUMBER: HeaderNumberConfig = {
  shapeId: 'rounded-rect',
  fillColor: HEADER_DEFAULT_PALETTE.black,
  borderColor: HEADER_DEFAULT_PALETTE.greyBorder,
  borderThicknessPx: 1,
  polygonSides: 6,
  textColor: HEADER_DEFAULT_PALETTE.white,
  fontFamily: '',
  fontSizePt: 0,
};

const DEFAULT_TITLE: HeaderTitleConfig = {
  shapeId: 'rounded-rect',
  fillColor: HEADER_DEFAULT_PALETTE.white,
  borderColor: HEADER_DEFAULT_PALETTE.greyBorder,
  borderThicknessPx: 1,
  borderRadiusPx: 8,
};

const DEFAULT_SUBTITLE: HeaderSubtitleConfig = {
  shapeId: 'rounded-rect',
  fillColor: HEADER_DEFAULT_PALETTE.greyFill,
  borderColor: HEADER_DEFAULT_PALETTE.greyBorder,
  borderThicknessPx: 1,
  borderRadiusPx: 6,
  borderOpacity: 0,
};

export const DEFAULT_HEADER_ASSEMBLY: HeaderAssemblySettings = {
  enabled: false,
  editorTarget: 'number',
  number: { ...DEFAULT_NUMBER },
  title: { ...DEFAULT_TITLE },
  subtitle: { ...DEFAULT_SUBTITLE },
};

export interface HeaderShapeDefinition {
  id: HeaderShapeId;
  label: string;
  description: string;
  /** Number element supports polygon complexity. */
  supportsPolygonSides: boolean;
  /** Title/subtitle support corner radius. */
  supportsCornerRadius: boolean;
}

export const HEADER_SHAPES: HeaderShapeDefinition[] = [
  { id: 'rectangle', label: 'Rectangle', description: 'Sharp rectangular box', supportsPolygonSides: false, supportsCornerRadius: false },
  { id: 'rounded-rect', label: 'Rounded', description: 'Rectangle with adjustable corners', supportsPolygonSides: false, supportsCornerRadius: true },
  { id: 'pill', label: 'Pill', description: 'Full capsule ends', supportsPolygonSides: false, supportsCornerRadius: true },
  { id: 'circle', label: 'Circle', description: 'Circular / elliptical badge', supportsPolygonSides: false, supportsCornerRadius: false },
  { id: 'polygon', label: 'Polygon', description: 'Regular polygon (adjustable sides)', supportsPolygonSides: true, supportsCornerRadius: false },
  { id: 'hexagon', label: 'Hexagon', description: 'Six-sided badge', supportsPolygonSides: true, supportsCornerRadius: false },
  { id: 'trapezoid', label: 'Trapezoid', description: 'Slanted parallel edges', supportsPolygonSides: false, supportsCornerRadius: false },
  { id: 'parallelogram', label: 'Parallelogram', description: 'Skewed dynamic bar', supportsPolygonSides: false, supportsCornerRadius: false },
  { id: 'chevron', label: 'Chevron', description: 'Pointed banner ends', supportsPolygonSides: false, supportsCornerRadius: false },
  { id: 'ribbon-notch', label: 'Ribbon', description: 'Swallowtail ribbon notch', supportsPolygonSides: false, supportsCornerRadius: false },
];

/** Shapes hidden from the page-number shape picker. */
export const REMOVED_NUMBER_SHAPES: HeaderShapeId[] = ['rectangle', 'hexagon'];

/** Shapes hidden from title / subtitle shape pickers. */
export const REMOVED_TITLE_SUBTITLE_SHAPES: HeaderShapeId[] = [
  'rectangle',
  'pill',
  'polygon',
  'hexagon',
];

export const NUMBER_HEADER_SHAPES = HEADER_SHAPES.filter(
  (shape) => !REMOVED_NUMBER_SHAPES.includes(shape.id)
);

export const TITLE_SUBTITLE_HEADER_SHAPES = HEADER_SHAPES.filter(
  (shape) => !REMOVED_TITLE_SUBTITLE_SHAPES.includes(shape.id)
);

const NUMBER_SHAPE_IDS = NUMBER_HEADER_SHAPES.map((shape) => shape.id);
const TITLE_SUBTITLE_SHAPE_IDS = TITLE_SUBTITLE_HEADER_SHAPES.map((shape) => shape.id);

export function normalizeNumberShapeId(id: unknown): HeaderShapeId {
  return NUMBER_SHAPE_IDS.includes(id as HeaderShapeId)
    ? (id as HeaderShapeId)
    : 'rounded-rect';
}

export function normalizeTitleSubtitleShapeId(id: unknown): HeaderShapeId {
  return TITLE_SUBTITLE_SHAPE_IDS.includes(id as HeaderShapeId)
    ? (id as HeaderShapeId)
    : 'rounded-rect';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function normalizeHeaderAssemblySettings(
  raw?: Partial<HeaderAssemblySettings> | null
): HeaderAssemblySettings {
  const base = { ...DEFAULT_HEADER_ASSEMBLY, ...raw };
  const n = { ...DEFAULT_NUMBER, ...base.number };
  const t = { ...DEFAULT_TITLE, ...base.title };
  const s = { ...DEFAULT_SUBTITLE, ...base.subtitle };

  const editorTarget: HeaderEditorTarget =
    base.editorTarget === 'title' || base.editorTarget === 'subtitle'
      ? base.editorTarget
      : 'number';

  return {
    enabled: !!base.enabled,
    editorTarget,
    number: {
      shapeId: normalizeNumberShapeId(n.shapeId),
      fillColor: n.fillColor || DEFAULT_NUMBER.fillColor,
      borderColor: n.borderColor || DEFAULT_NUMBER.borderColor,
      borderThicknessPx: clamp(Number(n.borderThicknessPx) || 0, 0, 12),
      polygonSides: clamp(Math.round(Number(n.polygonSides) || 6), 3, 12),
      textColor: n.textColor || DEFAULT_NUMBER.textColor,
      fontFamily: typeof n.fontFamily === 'string' ? n.fontFamily : DEFAULT_NUMBER.fontFamily,
      fontSizePt: clamp(Number(n.fontSizePt) || 0, 0, 50),
    },
    title: {
      shapeId: normalizeTitleSubtitleShapeId(t.shapeId),
      fillColor: t.fillColor || DEFAULT_TITLE.fillColor,
      borderColor: t.borderColor || DEFAULT_TITLE.borderColor,
      borderThicknessPx: clamp(Number(t.borderThicknessPx) || 0, 0, 12),
      borderRadiusPx: clamp(Number(t.borderRadiusPx) || 0, 0, 40),
    },
    subtitle: {
      shapeId: normalizeTitleSubtitleShapeId(s.shapeId),
      fillColor: s.fillColor || DEFAULT_SUBTITLE.fillColor,
      borderColor: s.borderColor || DEFAULT_SUBTITLE.borderColor,
      borderThicknessPx: clamp(Number(s.borderThicknessPx) || 0, 0, 12),
      borderRadiusPx: clamp(Number(s.borderRadiusPx) || 0, 0, 40),
      borderOpacity: clamp(Number(s.borderOpacity) ?? 0, 0, 100),
    },
  };
}

/** Migrate legacy template-based headerLayout if present in stored settings. */
export function migrateLegacyHeaderLayout(
  raw?: Record<string, unknown> | null
): Partial<HeaderAssemblySettings> | null {
  if (!raw || typeof raw !== 'object') return null;
  if ('number' in raw && 'title' in raw && 'subtitle' in raw) return raw as Partial<HeaderAssemblySettings>;
  if ('layoutId' in raw) {
    return {
      enabled: !!raw.enabled,
      editorTarget: 'title',
      number: { ...DEFAULT_NUMBER, shapeId: 'rounded-rect' },
      title: { ...DEFAULT_TITLE },
      subtitle: { ...DEFAULT_SUBTITLE },
    };
  }
  return null;
}
