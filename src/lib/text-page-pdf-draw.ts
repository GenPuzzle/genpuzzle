import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { WordSearchSettings } from './puzzles/types';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings, TextPageBlock } from './document-model';
import { getPageMarginInches } from './puzzle-layout';
import { resolveTextPageBlocks } from './text-page-blocks';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from './text-page-settings';
import {
  FlattenedBackgroundPdfCache,
  puzzlePageBackgroundConfig,
} from './unified-background';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import { normalizePageNumberSettings } from './page-number/settings';

type GetColorFn = (hex: string | undefined, fallback?: string) => RGB;

function drawLegacyCenteredText(
  page: PDFPage,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  font: PDFFont,
  titleFont: PDFFont,
  getColor: GetColorFn
) {
  const contentWidth = pageWidth - marginPt * 2;
  const titleSize =
    settings.titleFontSize && settings.titleFontSize > 0
      ? settings.titleFontSize
      : settings.fontSize * 1.2;
  const bodySize = settings.fontSize;
  const titleLine = (settings.title || '').trim();
  const bodyText = (settings.content || '').trim();
  const alignment = settings.alignment || 'center';
  const textColor = getColor(resolveTextPageTextColor(settings, layoutSettings), '#1f2937');

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
}

function drawBlockTextLines(
  page: PDFPage,
  lines: string[],
  block: TextPageBlock,
  layoutSettings: WordSearchSettings,
  x: number,
  topY: number,
  width: number,
  font: PDFFont,
  titleFont: PDFFont,
  getColor: GetColorFn
) {
  const textColor = getColor(
    block.textColor ?? resolveTextPageTextColor(settings, layoutSettings),
    '#1f2937'
  );
  const activeFont = block.bold ? titleFont : font;
  const lineHeight = block.fontSize * 1.35;
  let cursorY = topY;

  for (const line of lines) {
    if (!line.trim()) {
      cursorY -= lineHeight;
      continue;
    }
    const textWidth = activeFont.widthOfTextAtSize(line, block.fontSize);
    let drawX = x;
    if (block.alignment === 'center') {
      drawX = x + Math.max(0, (width - textWidth) / 2);
    } else if (block.alignment === 'right') {
      drawX = x + Math.max(0, width - textWidth);
    }
    page.drawText(line, {
      x: drawX,
      y: cursorY - block.fontSize,
      size: block.fontSize,
      font: activeFont,
      color: textColor,
    });
    cursorY -= lineHeight;
  }
  return cursorY;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function drawImagePageBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  block: TextPageBlock,
  pageHeight: number,
  marginPt: number,
  contentWidth: number,
  contentHeight: number
) {
  if (!block.imageSrc) return;

  const blockWidth = (block.widthPercent / 100) * contentWidth;
  const blockHeight = ((block.heightPercent ?? 28) / 100) * contentHeight;
  const blockLeft = marginPt + (block.xPercent / 100) * contentWidth;
  const blockTopFromTop = (block.yPercent / 100) * contentHeight;
  const blockBottomY = pageHeight - marginPt - blockTopFromTop - blockHeight;

  try {
    const bytes = dataUrlToBytes(block.imageSrc);
    const image = block.imageSrc.includes('image/png')
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);
    page.drawImage(image, {
      x: blockLeft,
      y: blockBottomY,
      width: blockWidth,
      height: blockHeight,
      opacity: (block.imageOpacity ?? 100) / 100,
    });
  } catch {
    // Skip invalid image data during export
  }
}

async function drawTextPageBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  block: TextPageBlock,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  font: PDFFont,
  titleFont: PDFFont,
  getColor: GetColorFn
) {
  const contentWidth = pageWidth - marginPt * 2;
  const contentHeight = pageHeight - marginPt * 2;

  if (block.kind === 'image') {
    await drawImagePageBlock(pdfDoc, page, block, pageHeight, marginPt, contentWidth, contentHeight);
    return;
  }

  const blockWidth = (block.widthPercent / 100) * contentWidth;
  const blockLeft = marginPt + (block.xPercent / 100) * contentWidth;
  const blockTopFromTop = (block.yPercent / 100) * contentHeight;
  const padding = block.framePaddingPx ?? 12;
  const lines = block.text ? block.text.split('\n') : [''];
  const lineCount = lines.length + (block.kind === 'ownership' && block.showNameLine !== false ? 1 : 0);
  const textHeight = lineCount * block.fontSize * 1.35 + padding * 2;
  const frameHeight = Math.max(textHeight, blockWidth * (block.frameShape === 'circle' ? 0.35 : 0.2));

  const blockTopY = pageHeight - marginPt - blockTopFromTop;
  const blockBottomY = blockTopY - frameHeight;

  if (block.frameEnabled) {
    page.drawRectangle({
      x: blockLeft,
      y: blockBottomY,
      width: blockWidth,
      height: frameHeight,
      borderColor: getColor(block.frameBorderColor, '#1f2937'),
      borderWidth: block.frameBorderThicknessPx ?? 2,
      color: getColor(block.frameFillColor, '#ffffff'),
    });
  }

  const textTopY = blockTopY - padding;
  const textX = blockLeft + padding;
  const textWidth = Math.max(1, blockWidth - padding * 2);
  const afterTextY = drawBlockTextLines(
    page,
    lines,
    block,
    settings,
    textX,
    textTopY,
    textWidth,
    font,
    titleFont,
    getColor
  );

  if (block.kind === 'ownership' && block.showNameLine !== false) {
    const lineY = afterTextY - block.fontSize * 0.5;
    page.drawLine({
      start: { x: textX, y: lineY },
      end: { x: textX + textWidth, y: lineY },
      thickness: 1,
      color: getColor(block.frameBorderColor ?? block.textColor, '#1f2937'),
    });
  }
}

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
  drawFrame: (
    page: PDFPage,
    pageWidth: number,
    pageHeight: number,
    frameSettings: ReturnType<typeof resolveTextPageFrameSettings>
  ) => void,
  backgroundCache: FlattenedBackgroundPdfCache,
  noText?: boolean,
  pageTitle = 'Text Page'
): Promise<void> {
  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const pageBackground = resolveTextPageBackground(settings, layoutSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, layoutSettings);

  const bgConfig = puzzlePageBackgroundConfig(
    pageWidth,
    pageHeight,
    pageBackground,
    pageFrame.cornerRadiusPx
  );
  await drawBackground(pdfDoc, page, pageWidth, pageHeight, bgConfig, backgroundCache);
  drawFrame(page, pageWidth, pageHeight, pageFrame);

  if (!noText) {
    const blocks = resolveTextPageBlocks(settings, pageTitle, layoutSettings);
    if (blocks.length > 0) {
      for (const block of blocks) {
        await drawTextPageBlock(
          pdfDoc,
          page,
          block,
          settings,
          layoutSettings,
          pageWidth,
          pageHeight,
          marginPt,
          font,
          titleFont,
          getColor
        );
      }
    } else {
      drawLegacyCenteredText(
        page,
        settings,
        layoutSettings,
        pageWidth,
        pageHeight,
        marginPt,
        font,
        titleFont,
        getColor
      );
    }
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
