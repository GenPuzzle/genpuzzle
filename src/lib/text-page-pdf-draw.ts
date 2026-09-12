import type { PDFDocument, PDFFont, PDFPage, RGB } from 'pdf-lib';
import type { WordSearchSettings } from './puzzles/types';
import type {
  DocumentModuleType,
  DocumentPage,
  PuzzleModuleSettings,
  TextModuleSettings,
  TextPageBlock,
} from './document-model';
import { getPageMarginInches, cssPxToPoints } from './puzzle-layout';
import { resolveTextPageBlocks, resolveOwnershipNameLineType, ownershipNameLineIsVisible } from './text-page-blocks';
import {
  getFrameCornerRadiusPx,
  getOwnershipCanvasLayout,
  getTextPageBlockRectPt,
  getTextPageContentAreaPt,
  resolveTextPageFrameShapeId,
} from './text-page-export-layout';
import { renderImageBlockToDataUrl } from './text-page-image-export';
import {
  layoutRichTextLines,
  lineBaselineFromTopPt,
  measureRunWidthPt,
  parseRichTextRuns,
  type RichTextLine,
} from './text-page-rich-text-export';
import { normalizeCssColorToHex } from './text-page-export-color';
import {
  measureOwnershipBlockLayoutFromDom,
  measureTextBlockLayoutFromDom,
} from './text-page-dom-layout';
import { drawShapeOnPdfPage } from './header-assembly-pdf-draw';
import {
  resolveTextPageBackground,
  resolveTextPageFrameSettings,
  resolveTextPageTextColor,
} from './text-page-settings';
import {
  buildLegacyCenteredTextLayout,
  cssLineBaselineFromTopPt,
  wrapPreWrapLinesPt,
} from './text-page-legacy-layout';
import {
  FlattenedBackgroundPdfCache,
  puzzlePageBackgroundConfig,
} from './unified-background';
import { drawPageNumberOnPdfPage } from './page-number-pdf-draw';
import { normalizePageNumberSettings } from './page-number/settings';
import type { ResolvedTocEntry } from './book-compiler';
import {
  buildTocExportLayout,
  isTocModuleSettings,
  parseTocEntriesFromContent,
  tocLeaderDashPattern,
} from './toc-export-draw';
import { normalizeTocSettings } from './toc-settings';

type GetColorFn = (hex: string | undefined, fallback?: string) => RGB;

export type GetPdfFontFn = (
  fontFamily: string,
  bold: boolean
) => Promise<PDFFont>;

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function drawLegacyCenteredText(
  page: PDFPage,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  pageWidth: number,
  pageHeight: number,
  font: PDFFont,
  titleFont: PDFFont,
  getColor: GetColorFn,
  pageTitle: string
) {
  const layout = buildLegacyCenteredTextLayout(
    settings,
    layoutSettings,
    pageWidth,
    pageHeight,
    pageTitle
  );
  const textColor = getColor(
    normalizeCssColorToHex(layout.color, '#1f2937'),
    '#1f2937'
  );

  for (const line of layout.lines) {
    if (!line.text) continue;
    const activeFont = line.bold ? titleFont : font;
    const size = line.fontSizePt;
    const textWidth = activeFont.widthOfTextAtSize(line.text, size);
    let x = layout.boxLeftPt;
    if (layout.alignment === 'center') {
      x = layout.boxLeftPt + Math.max(0, (layout.boxWidthPt - textWidth) / 2);
    } else if (layout.alignment === 'right') {
      x = layout.boxLeftPt + Math.max(0, layout.boxWidthPt - textWidth);
    }
    const ascent = activeFont.heightAtSize(size, { descender: false });
    const baselineFromTop = cssLineBaselineFromTopPt(line.lineHeightPt, size, ascent);
    page.drawText(line.text, {
      x,
      y: pageHeight - (line.topPt + baselineFromTop),
      size,
      font: activeFont,
      color: textColor,
    });
  }
}

function alignOffsetX(
  alignment: TextPageBlock['alignment'],
  lineWidth: number,
  boxWidth: number
): number {
  if (alignment === 'center') return Math.max(0, (boxWidth - lineWidth) / 2);
  if (alignment === 'right') return Math.max(0, boxWidth - lineWidth);
  return 0;
}

async function drawDomMeasuredRunsOnPdf(
  page: PDFPage,
  pageHeight: number,
  runs: Array<{
    text: string;
    xPt: number;
    baselinePt: number;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    underline: boolean;
    color: string;
  }>,
  innerLeft: number,
  innerTopFromPageTop: number,
  getColor: GetColorFn,
  getFont: GetPdfFontFn
) {
  for (const run of runs) {
    if (!run.text || run.text === '\n') continue;
    const pdfFont = await getFont(run.fontFamily, run.bold);
    const x = innerLeft + run.xPt;
    const baselineY = pageHeight - innerTopFromPageTop - run.baselinePt;
    page.drawText(run.text, {
      x,
      y: baselineY,
      size: run.fontSize,
      font: pdfFont,
      color: getColor(normalizeCssColorToHex(run.color, '#1f2937'), '#1f2937'),
    });
    if (run.underline) {
      const textWidth = pdfFont.widthOfTextAtSize(run.text, run.fontSize);
      page.drawLine({
        start: { x, y: baselineY - 1 },
        end: { x: x + textWidth, y: baselineY - 1 },
        thickness: Math.max(0.5, run.fontSize * 0.05),
        color: getColor(normalizeCssColorToHex(run.color, '#1f2937'), '#1f2937'),
      });
    }
  }
}

async function drawRichTextLineOnPdf(
  page: PDFPage,
  pageHeight: number,
  line: RichTextLine,
  block: TextPageBlock,
  baseX: number,
  baseTopFromPageTop: number,
  innerWidth: number,
  getColor: GetColorFn,
  getFont: GetPdfFontFn
): Promise<number> {
  const lineWidth = line.runs.reduce((sum, run) => sum + measureRunWidthPt(run), 0);
  const alignShift = alignOffsetX(block.alignment, lineWidth, innerWidth);
  const baselineFromLineTop = lineBaselineFromTopPt(line);
  const baselineY = pageHeight - baseTopFromPageTop - baselineFromLineTop;

  for (const run of line.runs) {
    if (!run.text || run.text === '\n') continue;
    const pdfFont = await getFont(run.fontFamily, run.bold);
    const x = baseX + alignShift + run.xPt;
    page.drawText(run.text, {
      x,
      y: baselineY,
      size: run.fontSize,
      font: pdfFont,
      color: getColor(normalizeCssColorToHex(run.color, '#1f2937'), '#1f2937'),
    });
    if (run.underline) {
      const textWidth = pdfFont.widthOfTextAtSize(run.text, run.fontSize);
      page.drawLine({
        start: { x, y: baselineY - 1 },
        end: { x: x + textWidth, y: baselineY - 1 },
        thickness: Math.max(0.5, run.fontSize * 0.05),
        color: getColor(normalizeCssColorToHex(run.color, '#1f2937'), '#1f2937'),
      });
    }
  }

  return baseTopFromPageTop + line.lineHeightPt;
}

async function drawOwnershipBlockOnPdf(
  page: PDFPage,
  block: TextPageBlock,
  pageHeight: number,
  rect: ReturnType<typeof getTextPageBlockRectPt>,
  fallbackColor: string,
  getColor: GetColorFn,
  getFont: GetPdfFontFn
) {
  const layout = getOwnershipCanvasLayout(block, rect);
  const nameLineType = resolveOwnershipNameLineType(block);
  const measured = measureOwnershipBlockLayoutFromDom(
    block,
    rect.innerWidth,
    rect.innerHeight,
    fallbackColor,
    nameLineType
  );

  if (measured && measured.textLines.length > 0) {
    for (const line of measured.textLines) {
      await drawDomMeasuredRunsOnPdf(
        page,
        pageHeight,
        line.runs,
        rect.innerLeft,
        rect.innerTopFromPageTop,
        getColor,
        getFont
      );
    }
  } else {
    const font = await getFont(block.fontFamily || 'Arial', !!block.bold);
    const size = layout.fontSizePt;
    const color = getColor(
      normalizeCssColorToHex(block.textColor ?? fallbackColor, '#1f2937'),
      '#1f2937'
    );
    const label = block.text || '';
    const lines = label
      ? wrapPreWrapLinesPt(label, rect.innerWidth, size, block.fontFamily || 'Arial', !!block.bold)
      : [];
    const ascent = font.heightAtSize(size, { descender: false });
    const alignment = block.alignment || 'center';
    const maxBottom = layout.nameLine.lineTopFromPageTop;

    let cursorTop = layout.textTopPt;
    for (const line of lines) {
      if (cursorTop + layout.lineHeightPt * 0.35 > maxBottom) break;
      if (line) {
        const textWidth = font.widthOfTextAtSize(line, size);
        let x = rect.innerLeft;
        if (alignment === 'center') {
          x = rect.innerLeft + Math.max(0, (rect.innerWidth - textWidth) / 2);
        } else if (alignment === 'right') {
          x = rect.innerLeft + Math.max(0, rect.innerWidth - textWidth);
        }
        const baselineFromTop = cssLineBaselineFromTopPt(layout.lineHeightPt, size, ascent);
        page.drawText(line, {
          x,
          y: pageHeight - (cursorTop + baselineFromTop),
          size,
          font,
          color,
        });
        if (block.underline) {
          const underlineY = pageHeight - (cursorTop + baselineFromTop) - 1;
          page.drawLine({
            start: { x, y: underlineY },
            end: { x: x + textWidth, y: underlineY },
            thickness: Math.max(0.5, size * 0.05),
            color,
          });
        }
      }
      cursorTop += layout.lineHeightPt;
    }
  }

  if (ownershipNameLineIsVisible(nameLineType)) {
    const lineFromTop =
      measured != null
        ? rect.innerTopFromPageTop + measured.nameLineBottomPt
        : layout.nameLine.lineBottomFromPageTop;
    const lineY = pageHeight - lineFromTop;
    page.drawLine({
      start: { x: rect.innerLeft, y: lineY },
      end: { x: rect.innerLeft + rect.innerWidth, y: lineY },
      thickness: cssPxToPoints(1),
      color: getColor(
        normalizeCssColorToHex(block.frameBorderColor ?? block.textColor, '#1f2937'),
        '#1f2937'
      ),
      dashArray:
        nameLineType === 'dashed' ? [4, 3] : nameLineType === 'dotted' ? [1, 2] : undefined,
    });
  }
}

async function drawTextBlockContent(
  page: PDFPage,
  block: TextPageBlock,
  layoutSettings: WordSearchSettings,
  pageHeight: number,
  rect: ReturnType<typeof getTextPageBlockRectPt>,
  getColor: GetColorFn,
  getFont: GetPdfFontFn
) {
  const fallbackColor = resolveTextPageTextColor(
    { textColor: block.textColor } as TextModuleSettings,
    layoutSettings
  );

  if (block.kind === 'ownership') {
    await drawOwnershipBlockOnPdf(
      page,
      block,
      pageHeight,
      rect,
      fallbackColor,
      getColor,
      getFont
    );
    return;
  }

  const domLines = measureTextBlockLayoutFromDom(block, rect.innerWidth, fallbackColor);
  if (domLines && domLines.length > 0) {
    for (const line of domLines) {
      await drawDomMeasuredRunsOnPdf(
        page,
        pageHeight,
        line.runs,
        rect.innerLeft,
        rect.innerTopFromPageTop,
        getColor,
        getFont
      );
    }
  } else {
    const runs = parseRichTextRuns(block, fallbackColor);
    const lineHeightMultiplier = block.lineHeight ?? 1.35;
    const lines = layoutRichTextLines(runs, rect.innerWidth, lineHeightMultiplier, {
      wordSpacingPx: block.wordSpacingPx ?? 0,
      letterSpacingPx: block.letterSpacingPx ?? 0,
    });

    let cursorTop = rect.innerTopFromPageTop;
    for (const line of lines) {
      cursorTop = await drawRichTextLineOnPdf(
        page,
        pageHeight,
        line,
        block,
        rect.innerLeft,
        cursorTop,
        rect.innerWidth,
        getColor,
        getFont
      );
    }
  }
}

async function drawImagePageBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  block: TextPageBlock,
  rect: ReturnType<typeof getTextPageBlockRectPt>,
  pageHeight: number,
  getColor: GetColorFn
) {
  if (block.frameEnabled) {
    drawShapeOnPdfPage(
      page,
      pageHeight,
      rect.left,
      rect.topFromPageTop,
      rect.width,
      rect.height,
      {
        shapeId: resolveTextPageFrameShapeId(block),
        fillColor: block.frameFillColor ?? '#ffffff',
        borderColor: block.frameBorderColor ?? '#1f2937',
        borderThicknessPx: block.frameBorderThicknessPx ?? 2,
        borderRadiusPx: getFrameCornerRadiusPx(
          block,
          rect.width * (96 / 72),
          rect.height * (96 / 72)
        ),
      },
      (hex) => getColor(hex, '#1f2937')
    );
  }

  const dataUrl = await renderImageBlockToDataUrl(
    block,
    rect.innerWidth,
    rect.innerHeight
  );
  if (!dataUrl) return;

  try {
    const bytes = dataUrlToBytes(dataUrl);
    const image = await pdfDoc.embedPng(bytes);
    const imgBottomY = pageHeight - rect.innerTopFromPageTop - rect.innerHeight;
    page.drawImage(image, {
      x: rect.innerLeft,
      y: imgBottomY,
      width: rect.innerWidth,
      height: rect.innerHeight,
    });
  } catch {
    // Skip invalid image data during export
  }
}

async function drawTextPageBlock(
  pdfDoc: PDFDocument,
  page: PDFPage,
  block: TextPageBlock,
  layoutSettings: WordSearchSettings,
  pageWidth: number,
  pageHeight: number,
  marginPt: number,
  getColor: GetColorFn,
  getFont: GetPdfFontFn
) {
  const area = getTextPageContentAreaPt(pageWidth, pageHeight, marginPt);
  const rect = getTextPageBlockRectPt(block, pageHeight, area);

  if (block.kind === 'image') {
    await drawImagePageBlock(pdfDoc, page, block, rect, pageHeight, getColor);
    return;
  }

  if (block.frameEnabled) {
    drawShapeOnPdfPage(
      page,
      pageHeight,
      rect.left,
      rect.topFromPageTop,
      rect.width,
      rect.height,
      {
        shapeId: resolveTextPageFrameShapeId(block),
        fillColor: block.frameFillColor ?? '#ffffff',
        borderColor: block.frameBorderColor ?? '#1f2937',
        borderThicknessPx: block.frameBorderThicknessPx ?? 2,
        borderRadiusPx: getFrameCornerRadiusPx(
          block,
          rect.width * (96 / 72),
          rect.height * (96 / 72)
        ),
      },
      (hex) => getColor(hex, '#1f2937')
    );
  }

  await drawTextBlockContent(page, block, layoutSettings, pageHeight, rect, getColor, getFont);
}

async function drawTocModuleOnPdfPage(
  page: PDFPage,
  settings: TextModuleSettings,
  layoutSettings: WordSearchSettings,
  _pageWidth: number,
  pageHeight: number,
  getColor: GetColorFn,
  getFont: GetPdfFontFn,
  entries: ResolvedTocEntry[],
  pageTitle: string
): Promise<void> {
  const toc = normalizeTocSettings(settings.tocSettings);
  const layout = buildTocExportLayout(
    settings,
    layoutSettings,
    entries,
    pageTitle,
    settings.tocTotalEntryCount
  );

  const titleFont = await getFont(layout.titleFontFamily, layout.titleBold);
  const entryFont = await getFont(layout.entryFontFamily, layout.entryBold);
  const titleColor = getColor(
    normalizeCssColorToHex(layout.titleColor, '#1f2937'),
    '#1f2937'
  );
  const entryColor = getColor(
    normalizeCssColorToHex(layout.entryColor, '#1f2937'),
    '#1f2937'
  );

  const titleSize = layout.titleFontSizePt;
  const titleWidth = titleFont.widthOfTextAtSize(layout.titleText, titleSize);
  const contentWidth = Math.max(
    40,
    layout.columns.reduce((w, c) => Math.max(w, c.xPt + c.widthPt), layout.titleXPt) -
      layout.titleXPt
  );
  let titleX = layout.titleXPt;
  if (layout.titleAlign === 'center') {
    titleX = layout.titleXPt + Math.max(0, (contentWidth - titleWidth) / 2);
  } else if (layout.titleAlign === 'right') {
    titleX = layout.titleXPt + Math.max(0, contentWidth - titleWidth);
  }

  const titleAscent = titleFont.heightAtSize(titleSize, { descender: false });
  const titleBaseline = pageHeight - (
    layout.titleYFromTopPt +
    cssLineBaselineFromTopPt(titleSize * 1.2, titleSize, titleAscent)
  );

  page.drawText(layout.titleText, {
    x: titleX,
    y: titleBaseline,
    size: titleSize,
    font: titleFont,
    color: titleColor,
  });

  const entrySize = layout.entryFontSizePt;
  const entryAscent = entryFont.heightAtSize(entrySize, { descender: false });
  for (const column of layout.columns) {
    for (const row of column.rows) {
      const rowLeft = column.xPt + row.indentPt;
      const rowWidth = Math.max(20, column.widthPt - row.indentPt);
      const baseline =
        pageHeight -
        (row.yFromTopPt +
          layout.rowPadPt +
          cssLineBaselineFromTopPt(layout.entryLineHeightPt, entrySize, entryAscent));
      const pageNum = toc.showPageNumbers ? row.pageNumber : '';
      const pageWidthText = pageNum
        ? entryFont.widthOfTextAtSize(pageNum, entrySize)
        : 0;
      const titleMax = Math.max(
        12,
        rowWidth - pageWidthText - (pageNum ? layout.entryGapPt : 0)
      );

      // Truncate title to one line to match canvas.
      let titleText = row.title;
      while (
        titleText.length > 1 &&
        entryFont.widthOfTextAtSize(titleText, entrySize) > titleMax
      ) {
        titleText = titleText.slice(0, -1);
      }
      if (titleText !== row.title && titleText.length > 1) {
        titleText = `${titleText.slice(0, -1)}…`;
      }

      page.drawText(titleText, {
        x: rowLeft,
        y: baseline,
        size: entrySize,
        font: entryFont,
        color: entryColor,
      });

      if (pageNum) {
        const pageX = column.xPt + column.widthPt - pageWidthText;
        page.drawText(pageNum, {
          x: pageX,
          y: baseline,
          size: entrySize,
          font: entryFont,
          color: entryColor,
        });

        if (row.showLeader) {
          const titleDrawnW = entryFont.widthOfTextAtSize(titleText, entrySize);
          const leaderStart = rowLeft + titleDrawnW + layout.entryGapPt;
          const leaderEnd = pageX - layout.entryGapPt;
          if (leaderEnd > leaderStart + 4) {
            const dash = tocLeaderDashPattern(row.leaderStyle);
            page.drawLine({
              start: { x: leaderStart, y: baseline - 1 },
              end: { x: leaderEnd, y: baseline - 1 },
              thickness: 0.75,
              color: entryColor,
              opacity: 0.45,
              dashArray: dash ?? undefined,
            });
          }
        }
      }
    }
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
  pageTitle = 'Text Page',
  getFont?: GetPdfFontFn,
  resolvedToc?: ResolvedTocEntry[],
  suppressPageNumber = false,
  moduleType?: DocumentModuleType | string
): Promise<void> {
  const marginPt = getPageMarginInches(layoutSettings) * 72;
  const pageBackground = resolveTextPageBackground(settings, layoutSettings);
  const pageFrame = resolveTextPageFrameSettings(settings, layoutSettings);
  const resolveFont: GetPdfFontFn =
    getFont ??
    (async (_family, bold) => (bold ? titleFont : font));

  const bgConfig = puzzlePageBackgroundConfig(
    pageWidth,
    pageHeight,
    pageBackground,
    pageFrame.cornerRadiusPx,
    {
      frameEnabled: pageFrame.enabled,
      frameMarginIn: pageFrame.marginSizeIn,
    }
  );
  await drawBackground(pdfDoc, page, pageWidth, pageHeight, bgConfig, backgroundCache);
  drawFrame(page, pageWidth, pageHeight, pageFrame);

  if (!noText && isTocModuleSettings(settings)) {
    const toc = normalizeTocSettings(settings.tocSettings);
    const entries =
      resolvedToc && resolvedToc.length > 0
        ? resolvedToc
        : parseTocEntriesFromContent(settings.content || '', toc.tableFormat);
    await drawTocModuleOnPdfPage(
      page,
      settings,
      layoutSettings,
      pageWidth,
      pageHeight,
      getColor,
      resolveFont,
      entries,
      pageTitle
    );
  } else if (!noText) {
    const blocks = resolveTextPageBlocks(settings, pageTitle, layoutSettings, moduleType);
    if (blocks.length > 0) {
      for (const block of blocks) {
        await drawTextPageBlock(
          pdfDoc,
          page,
          block,
          layoutSettings,
          pageWidth,
          pageHeight,
          marginPt,
          getColor,
          resolveFont
        );
      }
    } else if (!Array.isArray(settings.blocks)) {
      // Explicit empty blocks (title/separator pages) stay blank — match canvas.
      drawLegacyCenteredText(
        page,
        settings,
        layoutSettings,
        pageWidth,
        pageHeight,
        font,
        titleFont,
        getColor,
        pageTitle
      );
    }
  }

  if (
    !noText &&
    !suppressPageNumber &&
    pageNumberFont &&
    settings.tocMode !== 'auto' &&
    settings.tocMode !== 'manual'
  ) {
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

/**
 * Live Style (Color Settings) owns page fill, background image, and the page
 * container frame. A word-search document tab can be stale when the user edits
 * those controls on crossword / maze / sudoku / text pages.
 */
export function withLiveStylePageChrome(
  layout: WordSearchSettings,
  liveStyle: WordSearchSettings
): WordSearchSettings {
  return {
    ...layout,
    colors: {
      puzzlePage: {
        ...layout.colors.puzzlePage,
        ...liveStyle.colors.puzzlePage,
      },
      answerPage: {
        ...layout.colors.answerPage,
        ...liveStyle.colors.answerPage,
      },
    },
    pageFrameSettings: liveStyle.pageFrameSettings ?? layout.pageFrameSettings,
  };
}

export function resolveLayoutSettingsForExport(
  documentPages: DocumentPage[],
  fallback: WordSearchSettings
): WordSearchSettings {
  let fromDoc: WordSearchSettings | null = null;
  for (const doc of documentPages) {
    if (doc.moduleType === 'word-search') {
      const ws = (doc.settings as PuzzleModuleSettings).wordSearchSettings;
      if (ws) {
        fromDoc = ws;
        break;
      }
    }
  }
  return withLiveStylePageChrome(fromDoc ?? fallback, fallback);
}

export function resolvePageNumberSettingsForBook(
  documentPages: DocumentPage[],
  fallback: WordSearchSettings
) {
  const layout = resolveLayoutSettingsForExport(documentPages, fallback);
  return normalizePageNumberSettings(layout.typography.pageNumber);
}
