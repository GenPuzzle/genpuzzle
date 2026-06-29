import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { TextModuleSettings, WordSearchSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings } from './document-model';
import { getPageMarginInches } from './puzzle-layout';
import { resolvePageFrameSettings } from './page-frame-settings';
import {
  FlattenedBackgroundPdfCache,
  puzzlePageBackgroundConfig,
} from './unified-background';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import { normalizePageNumberSettings } from './page-number/settings';

type GetColorFn = (hex: string | undefined, fallback?: string) => RGB;

export async function drawTextModuleOnPdfPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  titleFont: PDFFont,
  bookPageIndex: number,
  pageNumberFont: PDFFont | undefined,
  getColor: GetColorFn,
  drawBackground: (
    pdfDoc: PDFDocument,
    page: PDFPage,
    pageWidth: number,
    pageHeight: number,
    config: ReturnType<typeof puzzlePageBackgroundConfig>,
    cache: FlattenedBackgroundPdfCache
  ) => Promise<void>,
  drawFrame: (page: PDFPage, pageWidth: number, pageHeight: number, frameSettings: ReturnType<typeof resolvePageFrameSettings>) => void,
  backgroundCache: FlattenedBackgroundPdfCache,
  noText?: boolean
): Promise<void> {
  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const contentWidth = pageWidth - marginPt * 2;
  const titleSize = settings.fontSize;
  const bodySize = settings.fontSize;
  const titleLine = (settings.title || '').trim();
  const bodyText = (settings.content || '').trim();
  const alignment = settings.alignment || 'center';
  const textColor = getColor(layoutSettings.colors.puzzlePage.titleColor, '#1f2937');

  const bgConfig = puzzlePageBackgroundConfig(
    pageWidth,
    pageHeight,
    layoutSettings.colors.puzzlePage,
    resolvePageFrameSettings(layoutSettings).cornerRadiusPx
  );
  await drawBackground(pdfDoc, page, pageWidth, pageHeight, bgConfig, backgroundCache);
  drawFrame(page, pageWidth, pageHeight, resolvePageFrameSettings(layoutSettings));

  const titleLines = titleLine ? [titleLine] : [];
  const bodyLines = bodyText ? bodyText.split('\n') : [];
  const lineHeight = bodySize * 1.35;
  const titleBlockHeight = titleLines.length * (titleSize * 1.2);
  const gapAfterTitle = titleLines.length > 0 && bodyLines.length > 0 ? lineHeight * 0.5 : 0;
  const bodyBlockHeight = bodyLines.length * lineHeight;
  const totalHeight = titleBlockHeight + gapAfterTitle + bodyBlockHeight;

  let cursorY = pageHeight / 2 + totalHeight / 2;

  const drawAlignedLine = (line: string, size: number, useTitleFont: boolean) => {
    const activeFont = useTitleFont ? titleFont : font;
    const textWidth = activeFont.widthOfTextAtSize(line, size);
    let x = marginPt;
    if (alignment === 'center') {
      x = marginPt + Math.max(0, (contentWidth - textWidth) / 2);
    } else if (alignment === 'right') {
      x = pageWidth - marginPt - textWidth;
    }
    page.drawText(line, {
      x,
      y: cursorY - size,
      size,
      font: activeFont,
      color: textColor,
    });
    cursorY -= useTitleFont ? titleSize * 1.2 : lineHeight;
  };

  for (const line of titleLines) {
    drawAlignedLine(line, titleSize, true);
  }
  if (gapAfterTitle > 0) {
    cursorY -= gapAfterTitle;
  }
  for (const line of bodyLines) {
    drawAlignedLine(line, bodySize, false);
  }

  if (!noText && pageNumberFont) {
    await drawPageNumberOnPdfPage(
      pdfDoc,
      page,
      pageWidth,
      pageHeight,
      layoutSettings,
      bookPageIndex,
      pageNumberFont,
      getColor
    );
  }
}

export function resolveLayoutSettingsForExport(
  documentPages: DocumentPage[],
  fallback: WordSearchSettings
): WordSearchSettings {
  for (const doc of documentPages) {
    if (doc.moduleType === 'word-search') {
      const ws = (doc.settings as PuzzleModuleSettings).wordSearchSettings;
      if (ws) return ws;
    }
  }
  return fallback;
}

export function resolvePageNumberSettingsForBook(
  documentPages: DocumentPage[],
  fallback: WordSearchSettings
) {
  const layout = resolveLayoutSettingsForExport(documentPages, fallback);
  return normalizePageNumberSettings(layout.typography.pageNumber);
}
