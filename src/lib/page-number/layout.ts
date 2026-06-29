import type { WordSearchSettings } from '../puzzles/types';
import type { PageNumberSettings } from '../puzzles/types';
import type { HeaderNumberConfig } from '../header-assembly/types';
import {
  resolvePageContentTopInsetPt,
} from '../header-assembly/geometry';
import { cssPxToPoints } from '../puzzle-layout';
import { ptToCssPx } from '../header-assembly/compute-row';
import { measureTextWidthPt } from '../header-assembly/fit-title';
import { resolveBookPageNumberText } from './settings';

const SHAPE_TEXT_PAD_CSS_PX = 10;

export interface PageNumberLayout {
  text: string;
  leftPt: number;
  topPt: number;
  widthPt: number;
  heightPt: number;
  fontSizePt: number;
  fontFamily: string;
  textColor: string;
  shape: HeaderNumberConfig;
}

function resolvePageContentSideInsetPt(settings: WordSearchSettings): number {
  return resolvePageContentTopInsetPt(settings);
}

function resolvePageContentBottomInsetPt(settings: WordSearchSettings): number {
  return resolvePageContentTopInsetPt(settings);
}

function measurePageNumberBoxPt(
  text: string,
  fontSizePt: number,
  fontFamily: string
): { widthPt: number; heightPt: number } {
  const fontSizePx = ptToCssPx(fontSizePt);
  const rowHPx = Math.max(34, fontSizePx * 1.4);
  const rowHPt = cssPxToPoints(rowHPx);
  const padXPx = SHAPE_TEXT_PAD_CSS_PX * 2;
  const measuredWPt = measureTextWidthPt(text, fontSizePt, fontFamily, true);
  const digitEstimateWPt = text.length * fontSizePt * 0.58;
  const textWPt = Math.max(measuredWPt, digitEstimateWPt);
  // Match header number width: max(square height, digit estimate + padding, measured + padding)
  const widthPx = Math.max(rowHPx + 4, text.length * fontSizePx * 0.58 + padXPx, ptToCssPx(textWPt) + padXPx);
  const widthPt = cssPxToPoints(widthPx);
  const heightPt = rowHPt;
  return { widthPt, heightPt };
}

export function computePageNumberLayout(
  pageWidthPt: number,
  pageHeightPt: number,
  settings: WordSearchSettings,
  bookPageIndex: number,
  pageNumberSettings: PageNumberSettings
): PageNumberLayout | null {
  const text = resolveBookPageNumberText(bookPageIndex, pageNumberSettings);
  if (!text) return null;

  const fontSizePt = pageNumberSettings.fontSize;
  const { widthPt, heightPt } = measurePageNumberBoxPt(
    text,
    fontSizePt,
    pageNumberSettings.fontFamily
  );

  const sideInsetPt = resolvePageContentSideInsetPt(settings);
  const bottomInsetPt = resolvePageContentBottomInsetPt(settings);
  const bottomOffsetPt = cssPxToPoints(pageNumberSettings.bottomOffsetPx);
  const sideOffsetPt = cssPxToPoints(pageNumberSettings.sideOffsetPx);

  const topPt = pageHeightPt - bottomInsetPt - bottomOffsetPt - heightPt;
  const physicalPage = bookPageIndex + 1;

  let leftPt: number;
  switch (pageNumberSettings.position) {
    case 'bottom-left':
      leftPt = sideInsetPt + sideOffsetPt;
      break;
    case 'bottom-right':
      leftPt = pageWidthPt - sideInsetPt - sideOffsetPt - widthPt;
      break;
    case 'alternating':
      if (physicalPage % 2 === 0) {
        leftPt = sideInsetPt + sideOffsetPt;
      } else {
        leftPt = pageWidthPt - sideInsetPt - sideOffsetPt - widthPt;
      }
      break;
    case 'bottom-center':
    default:
      leftPt = (pageWidthPt - widthPt) / 2;
      break;
  }

  return {
    text,
    leftPt: Math.max(0, leftPt),
    topPt: Math.max(0, topPt),
    widthPt,
    heightPt,
    fontSizePt,
    fontFamily: pageNumberSettings.fontFamily,
    textColor: pageNumberSettings.textColor,
    shape: pageNumberSettings.shape,
  };
}
