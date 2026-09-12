/**
 * Geometry for Introduction / Instructions / Copyright / CTA pages.
 * Matches PreviewCanvas `TextPageCanvas`: margin box, 12pt padding, flex-centered
 * title + body, line-height 1.3, Tailwind `mb-4` gap under the title.
 */

import type { TextModuleSettings } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { wrapTextLinesPt } from './header-assembly/fit-title';
import { getPageMarginInches } from './puzzle-layout';
import {
  resolveTextPageTextColor,
  resolveTextPageTitleFontSize,
} from './text-page-settings';

/** Inner padding on the canvas content box (`padding: ptToPx(12)`). */
export const TEXT_PAGE_CANVAS_PAD_PT = 12;
/** Inherited `lineHeight` on the canvas text stack. */
export const TEXT_PAGE_BODY_LINE_HEIGHT = 1.3;
/** Tailwind `mb-4` on the title (16 CSS px → pt). */
export const TEXT_PAGE_TITLE_MARGIN_BOTTOM_PT = (16 * 72) / 96;

export interface LegacyTextPageLine {
  text: string;
  fontSizePt: number;
  bold: boolean;
  lineHeightPt: number;
  topPt: number;
}

export interface LegacyTextPageLayout {
  boxLeftPt: number;
  boxTopPt: number;
  boxWidthPt: number;
  boxHeightPt: number;
  alignment: 'left' | 'center' | 'right';
  fontFamily: string;
  color: string;
  lines: LegacyTextPageLine[];
}

export function wrapPreWrapLinesPt(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  fontFamily: string,
  bold: boolean
): string[] {
  const paragraphs = (text ?? '').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    const wrapped = wrapTextLinesPt(paragraph, maxWidthPt, fontSizePt, fontFamily, bold);
    if (wrapped.length === 0) lines.push(paragraph);
    else lines.push(...wrapped);
  }
  return lines;
}

export function buildLegacyCenteredTextLayout(
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidthPt: number,
  pageHeightPt: number,
  pageTitle: string
): LegacyTextPageLayout {
  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const pad = TEXT_PAGE_CANVAS_PAD_PT;
  const boxLeftPt = marginPt + pad;
  const boxTopPt = marginPt + pad;
  const boxWidthPt = Math.max(1, pageWidthPt - (marginPt + pad) * 2);
  const boxHeightPt = Math.max(1, pageHeightPt - (marginPt + pad) * 2);

  const alignment = settings.alignment || 'center';
  const fontFamily = settings.fontFamily || 'Arial';
  const color = resolveTextPageTextColor(settings, layoutSettings);
  const titleSize = resolveTextPageTitleFontSize(settings);
  const bodySize =
    typeof settings.fontSize === 'number' && Number.isFinite(settings.fontSize) && settings.fontSize > 0
      ? settings.fontSize
      : 18;

  const titleText = (settings.title || pageTitle || '').trim();
  const bodyText = (settings.content || '').trim();

  const titleLineHeightPt = titleSize * TEXT_PAGE_BODY_LINE_HEIGHT;
  const bodyLineHeightPt = bodySize * TEXT_PAGE_BODY_LINE_HEIGHT;

  const titleLines = titleText
    ? wrapPreWrapLinesPt(titleText, boxWidthPt, titleSize, fontFamily, true)
    : [];
  const bodyLines = bodyText
    ? wrapPreWrapLinesPt(bodyText, boxWidthPt, bodySize, fontFamily, false)
    : [];

  const gapAfterTitlePt =
    titleLines.length > 0 && bodyLines.length > 0 ? TEXT_PAGE_TITLE_MARGIN_BOTTOM_PT : 0;

  const totalHeightPt =
    titleLines.length * titleLineHeightPt + gapAfterTitlePt + bodyLines.length * bodyLineHeightPt;

  let cursorTop = boxTopPt + Math.max(0, (boxHeightPt - totalHeightPt) / 2);
  const lines: LegacyTextPageLine[] = [];

  for (const text of titleLines) {
    lines.push({
      text,
      fontSizePt: titleSize,
      bold: true,
      lineHeightPt: titleLineHeightPt,
      topPt: cursorTop,
    });
    cursorTop += titleLineHeightPt;
  }
  if (gapAfterTitlePt > 0) cursorTop += gapAfterTitlePt;
  for (const text of bodyLines) {
    lines.push({
      text,
      fontSizePt: bodySize,
      bold: false,
      lineHeightPt: bodyLineHeightPt,
      topPt: cursorTop,
    });
    cursorTop += bodyLineHeightPt;
  }

  return {
    boxLeftPt,
    boxTopPt,
    boxWidthPt,
    boxHeightPt,
    alignment,
    fontFamily,
    color,
    lines,
  };
}

/** CSS-like baseline from the top of a line box (half-leading + ascent). */
export function cssLineBaselineFromTopPt(lineHeightPt: number, fontSizePt: number, ascentPt: number): number {
  const halfLeading = Math.max(0, (lineHeightPt - fontSizePt) / 2);
  return halfLeading + ascentPt;
}
