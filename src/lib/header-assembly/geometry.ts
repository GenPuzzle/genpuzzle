import type { WordSearchSettings } from '../puzzles/types';
import { cssPxToPoints, getPageMarginInches } from '../puzzle-layout';
import { resolvePageFrameSettings } from '../page-frame-settings';

export const HEADER_INNER_PAD_IN = 0.25;
export const HEADER_INNER_PAD_PT = HEADER_INNER_PAD_IN * 72;

export interface HeaderBlockGeometry {
  leftPt: number;
  widthPt: number;
  minTopPt: number;
}

/**
 * Top inset for page content — inner edge of the page frame border stroke,
 * or the print margin when the frame is disabled. Title Start At is measured from here.
 */
export function resolvePageContentTopInsetPt(settings: WordSearchSettings): number {
  const frame = resolvePageFrameSettings(settings);
  const printMarginPt = getPageMarginInches(settings) * 72;
  if (!frame.enabled) return printMarginPt;

  const frameMarginPt = frame.marginSizeIn * 72;
  const strokePt = cssPxToPoints(frame.strokeThicknessPx);
  return Math.max(frameMarginPt + strokePt, printMarginPt);
}

export function resolveHeaderBlockGeometry(
  pageWidthPt: number,
  settings: WordSearchSettings
): HeaderBlockGeometry {
  const borderInnerPt = resolvePageContentTopInsetPt(settings);
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
