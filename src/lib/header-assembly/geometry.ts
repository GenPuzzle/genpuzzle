import type { WordSearchSettings } from '../puzzles/types';
import { cssPxToPoints, getPageMarginInches } from '../puzzle-layout';
import { resolvePageFrameSettings } from '../page-frame-settings';

export const HEADER_INNER_PAD_IN = 0.25;
export const HEADER_INNER_PAD_PT = HEADER_INNER_PAD_IN * 72;

/**
 * Extra gap between the frame's inner border stroke and page content
 * (titles, trivia text, grids, etc.) so text never sits flush on the line.
 */
export const FRAME_CONTENT_GAP_IN = 0.2;
export const FRAME_CONTENT_GAP_PT = FRAME_CONTENT_GAP_IN * 72;

export interface HeaderBlockGeometry {
  leftPt: number;
  widthPt: number;
  minTopPt: number;
}

/** Frame inner edge (or print margin) — no extra content gap. */
export function resolvePageFrameInnerInsetPt(settings: WordSearchSettings): number {
  const frame = resolvePageFrameSettings(settings);
  const printMarginPt = getPageMarginInches(settings) * 72;
  if (!frame.enabled) return printMarginPt;

  const frameMarginPt = frame.marginSizeIn * 72;
  const strokePt = cssPxToPoints(frame.strokeThicknessPx);
  return Math.max(frameMarginPt + strokePt, printMarginPt);
}

/**
 * Top inset for page content — frame inner edge plus a fixed 0.2" gap,
 * or the print margin when the frame is disabled.
 * Title Start At is measured from here.
 */
export function resolvePageContentTopInsetPt(settings: WordSearchSettings): number {
  const frame = resolvePageFrameSettings(settings);
  if (!frame.enabled) return resolvePageFrameInnerInsetPt(settings);
  return resolvePageFrameInnerInsetPt(settings) + FRAME_CONTENT_GAP_PT;
}

export function resolveHeaderBlockGeometry(
  pageWidthPt: number,
  settings: WordSearchSettings
): HeaderBlockGeometry {
  // Header sits just inside the frame stroke; content gap is applied separately
  // to puzzle body text via resolvePageContentTopInsetPt.
  const borderInnerPt = resolvePageFrameInnerInsetPt(settings);
  const insetPt = borderInnerPt + HEADER_INNER_PAD_PT;

  return {
    leftPt: insetPt,
    widthPt: Math.max(72, pageWidthPt - insetPt * 2),
    minTopPt: insetPt,
  };
}

export function resolveHeaderSubtitleTextWidthPt(
  headerWidthPt: number,
  subtitleMaxWidthPercent: number,
  subtitleBoxMarginPt: number
): number {
  const widthPt = (headerWidthPt * subtitleMaxWidthPercent) / 100;
  return Math.max(50, widthPt - 2 * subtitleBoxMarginPt);
}
