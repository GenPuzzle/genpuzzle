/**
 * Shared per-element text styles for Canvas Workspace contextual editing.
 * Keys are stable selectIds (e.g. math-maze:eq:0:1). Styles update live without regenerating puzzles.
 */

export type PuzzleTextRole =
  | 'equation'
  | 'channel'
  | 'start'
  | 'end'
  | 'title'
  | 'generic';

export interface PuzzleTextStyle {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
}

export type PuzzleTextStyleMap = Record<string, PuzzleTextStyle>;

export interface PuzzleTextHit {
  id: string;
  role: PuzzleTextRole;
  label: string;
  /** Box in page points, relative to the puzzle slot origin when returned from builders. */
  x: number;
  y: number;
  w: number;
  h: number;
  rotationDeg?: number;
}

export function puzzleTextId(module: string, ...parts: Array<string | number>): string {
  return [module, ...parts].join(':');
}

export function normalizePuzzleTextStyles(
  raw: unknown
): PuzzleTextStyleMap {
  if (!raw || typeof raw !== 'object') return {};
  const out: PuzzleTextStyleMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || !value || typeof value !== 'object') continue;
    const v = value as PuzzleTextStyle;
    const next: PuzzleTextStyle = {};
    if (typeof v.fontFamily === 'string' && v.fontFamily.trim()) next.fontFamily = v.fontFamily;
    if (typeof v.fontSize === 'number' && Number.isFinite(v.fontSize) && v.fontSize > 0) {
      next.fontSize = Math.max(4, Math.min(96, v.fontSize));
    }
    if (typeof v.color === 'string' && v.color.trim()) next.color = v.color;
    if (typeof v.bold === 'boolean') next.bold = v.bold;
    if (typeof v.italic === 'boolean') next.italic = v.italic;
    if (v.align === 'left' || v.align === 'center' || v.align === 'right') next.align = v.align;
    if (Object.keys(next).length) out[key] = next;
  }
  return out;
}

export function mergePuzzleTextStyle(
  base: {
    fontFamily: string;
    fontSize: number;
    color: string;
    bold?: boolean;
    italic?: boolean;
    align?: 'left' | 'center' | 'right';
  },
  override?: PuzzleTextStyle | null
): {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
} {
  if (!override) {
    return {
      fontFamily: base.fontFamily,
      fontSize: base.fontSize,
      color: base.color,
      bold: base.bold !== false,
      italic: base.italic === true,
      align: base.align || 'center',
    };
  }
  return {
    fontFamily: override.fontFamily || base.fontFamily,
    fontSize: override.fontSize ?? base.fontSize,
    color: override.color || base.color,
    bold: override.bold != null ? override.bold : base.bold !== false,
    italic: override.italic != null ? override.italic : base.italic === true,
    align: override.align || base.align || 'center',
  };
}

export function patchPuzzleTextStyles(
  current: PuzzleTextStyleMap | undefined,
  id: string,
  patch: PuzzleTextStyle,
  opts?: { applyToAllIds?: string[] }
): PuzzleTextStyleMap {
  const next = { ...(current || {}) };
  const ids = opts?.applyToAllIds?.length ? opts.applyToAllIds : [id];
  for (const targetId of ids) {
    next[targetId] = {
      ...(next[targetId] || {}),
      ...patch,
    };
  }
  return next;
}

export function roleFromPuzzleTextId(id: string): PuzzleTextRole {
  const parts = id.split(':');
  const role = parts[1];
  if (role === 'equation' || role === 'eq') return 'equation';
  if (role === 'channel' || role === 'ch') return 'channel';
  if (role === 'start') return 'start';
  if (role === 'end') return 'end';
  if (role === 'title') return 'title';
  return 'generic';
}
