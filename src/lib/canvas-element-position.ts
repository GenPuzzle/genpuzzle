/**
 * Shared canvas placement offsets for native puzzle elements (title, grid, word list, clues…).
 * Offsets are points, applied on top of the stack layout so preview / PDF / PPTX stay aligned.
 */

import type { CanvasFormatTarget } from '@/lib/canvas-native-format';

export type CanvasLayoutOffsetKey =
  | 'title'
  | 'subtitle'
  | 'grid'
  | 'word-list'
  | 'clues'
  | 'header';

export interface CanvasElementOffset {
  offsetXPt: number;
  offsetYPt: number;
}

export type CanvasLayoutOffsets = Partial<Record<CanvasLayoutOffsetKey, CanvasElementOffset>>;

export function formatTargetToOffsetKey(
  target: CanvasFormatTarget | null | undefined
): CanvasLayoutOffsetKey | null {
  if (!target) return null;
  switch (target) {
    case 'title':
    case 'header-number':
      return 'title';
    case 'subtitle':
      return 'subtitle';
    case 'grid':
    case 'maze-start':
    case 'maze-end':
    case 'code-numbers':
    case 'code-letters':
      return 'grid';
    case 'word-list':
      return 'word-list';
    case 'clues':
    case 'clue-heading':
    case 'suggestions':
    case 'answer-key':
      return 'clues';
    default:
      return null;
  }
}

export function readCanvasOffset(
  offsets: CanvasLayoutOffsets | null | undefined,
  key: CanvasLayoutOffsetKey | null
): CanvasElementOffset {
  if (!key || !offsets?.[key]) return { offsetXPt: 0, offsetYPt: 0 };
  const raw = offsets[key]!;
  return {
    offsetXPt: Number.isFinite(raw.offsetXPt) ? raw.offsetXPt : 0,
    offsetYPt: Number.isFinite(raw.offsetYPt) ? raw.offsetYPt : 0,
  };
}

export function patchCanvasOffset(
  offsets: CanvasLayoutOffsets | null | undefined,
  key: CanvasLayoutOffsetKey,
  patch: Partial<CanvasElementOffset>
): CanvasLayoutOffsets {
  const prev = readCanvasOffset(offsets, key);
  const next: CanvasElementOffset = {
    offsetXPt: patch.offsetXPt !== undefined ? patch.offsetXPt : prev.offsetXPt,
    offsetYPt: patch.offsetYPt !== undefined ? patch.offsetYPt : prev.offsetYPt,
  };
  // Drop near-zero noise so defaults stay clean.
  const cleaned: CanvasElementOffset = {
    offsetXPt: Math.abs(next.offsetXPt) < 0.25 ? 0 : Math.round(next.offsetXPt * 10) / 10,
    offsetYPt: Math.abs(next.offsetYPt) < 0.25 ? 0 : Math.round(next.offsetYPt * 10) / 10,
  };
  const out: CanvasLayoutOffsets = { ...(offsets ?? {}) };
  if (cleaned.offsetXPt === 0 && cleaned.offsetYPt === 0) {
    delete out[key];
  } else {
    out[key] = cleaned;
  }
  return out;
}

export function nudgeCanvasOffset(
  offsets: CanvasLayoutOffsets | null | undefined,
  key: CanvasLayoutOffsetKey,
  dxPt: number,
  dyPt: number
): CanvasLayoutOffsets {
  const prev = readCanvasOffset(offsets, key);
  return patchCanvasOffset(offsets, key, {
    offsetXPt: prev.offsetXPt + dxPt,
    offsetYPt: prev.offsetYPt + dyPt,
  });
}

/** Reset horizontal offset (layouts already center grids / word lists by default). */
export function centerCanvasOffsetHorizontal(
  offsets: CanvasLayoutOffsets | null | undefined,
  key: CanvasLayoutOffsetKey
): CanvasLayoutOffsets {
  return patchCanvasOffset(offsets, key, { offsetXPt: 0 });
}

/**
 * Set vertical offset so (naturalTop + offsetY) lands at the vertical center of the page content.
 * `naturalTopPt` must be the layout top *without* the current offsetY applied.
 */
export function centerCanvasOffsetVertical(
  offsets: CanvasLayoutOffsets | null | undefined,
  key: CanvasLayoutOffsetKey,
  args: {
    naturalTopPt: number;
    heightPt: number;
    pageHeightPt: number;
    marginPt?: number;
  }
): CanvasLayoutOffsets {
  const margin = Math.max(0, args.marginPt ?? 0);
  const usable = Math.max(0, args.pageHeightPt - margin * 2);
  const centeredTop = margin + Math.max(0, (usable - args.heightPt) / 2);
  return patchCanvasOffset(offsets, key, {
    offsetYPt: centeredTop - args.naturalTopPt,
  });
}

export function applyOffsetToPoint(
  leftPt: number,
  topPt: number,
  offset: CanvasElementOffset
): { leftPt: number; topPt: number } {
  return {
    leftPt: leftPt + offset.offsetXPt,
    topPt: topPt + offset.offsetYPt,
  };
}
