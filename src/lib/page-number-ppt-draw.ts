import type { WordSearchSettings } from './puzzles/types';
import { addHeaderShapeToSlide } from './header-assembly-ppt-draw';
import { computePageNumberLayout } from './page-number/layout';
import { normalizePageNumberSettings } from './page-number/settings';

function pt2in(pt: number): number {
  const v = pt / 72;
  return Number.isFinite(v) ? Math.max(0, v) : 0;
}

function hex6(hex: string | undefined, fallback = '000000'): string {
  if (!hex) return fallback;
  const clean = hex.replace(/^#/, '');
  return clean.length === 6 ? clean.toUpperCase() : fallback;
}

function safeIn(v: number, fallback = 0.01): number {
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export function addPageNumberToSlide(
  slide: {
    addShape: (shape: string, opts: Record<string, unknown>) => void;
    addText: (text: string, opts: Record<string, unknown>) => void;
  },
  pageWidthPt: number,
  pageHeightPt: number,
  settings: WordSearchSettings,
  bookPageIndex: number
): void {
  const pageNumberSettings = normalizePageNumberSettings(settings.typography.pageNumber);
  const layout = computePageNumberLayout(
    pageWidthPt,
    pageHeightPt,
    settings,
    bookPageIndex,
    pageNumberSettings
  );
  if (!layout) return;

  const shape = layout.shape;
  const xIn = pt2in(layout.leftPt);
  const yIn = pt2in(layout.topPt);
  const wIn = safeIn(pt2in(layout.widthPt));
  const hIn = safeIn(pt2in(layout.heightPt));

  addHeaderShapeToSlide(
    slide,
    shape.shapeId,
    xIn,
    yIn,
    wIn,
    hIn,
    shape.fillColor,
    shape.borderColor,
    shape.borderThicknessPx,
    { polygonSides: shape.polygonSides }
  );

  slide.addText(layout.text, {
    x: xIn,
    y: yIn,
    w: wIn,
    h: hIn,
    fontSize: Math.round(layout.fontSizePt),
    fontFace: layout.fontFamily || 'Arial',
    color: hex6(layout.textColor),
    bold: true,
    align: 'center',
    valign: 'middle',
    margin: 0,
    wrap: false,
    isTextBox: true,
  });
}
