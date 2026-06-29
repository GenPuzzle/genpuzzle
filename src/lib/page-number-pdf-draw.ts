import type { PDFDocument, PDFPage, PDFFont, RGB } from 'pdf-lib';
import type { WordSearchSettings } from './puzzles/types';
import { drawShapeOnPdfPage } from './header-assembly-pdf-draw';
import { computePageNumberLayout } from './page-number/layout';
import { normalizePageNumberSettings } from './page-number/settings';
import { renderPageNumberToDataUrl } from './page-number-canvas-draw';
import { PDF_CAP_HEIGHT_RATIO } from './grid-letter-centering';

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function capHeightAtSize(font: PDFFont, fontSizePt: number): number {
  try {
    return font.heightAtSize(fontSizePt, { descender: false });
  } catch {
    return fontSizePt * PDF_CAP_HEIGHT_RATIO;
  }
}

/** Vector fallback when canvas is unavailable (server-side export). */
function drawPageNumberVectorFallback(
  page: PDFPage,
  pageHeightPt: number,
  layout: NonNullable<ReturnType<typeof computePageNumberLayout>>,
  font: PDFFont,
  getColor: (hex?: string) => RGB
): void {
  const shape = layout.shape;
  drawShapeOnPdfPage(
    page,
    pageHeightPt,
    layout.leftPt,
    layout.topPt,
    layout.widthPt,
    layout.heightPt,
    {
      shapeId: shape.shapeId,
      fillColor: shape.fillColor,
      borderColor: shape.borderColor,
      borderThicknessPx: shape.borderThicknessPx,
      polygonSides: shape.polygonSides,
    },
    getColor
  );

  const fontSizePt = layout.fontSizePt;
  const textW = font.widthOfTextAtSize(layout.text, fontSizePt);
  const capH = capHeightAtSize(font, fontSizePt);
  const shapeBottomPdfY = pageHeightPt - layout.topPt - layout.heightPt;
  const x = layout.leftPt + (layout.widthPt - textW) / 2;
  const y = shapeBottomPdfY + (layout.heightPt - capH) / 2;

  page.drawText(layout.text, {
    x,
    y,
    size: fontSizePt,
    font,
    color: getColor(layout.textColor),
  });
}

export async function drawPageNumberOnPdfPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  pageWidthPt: number,
  pageHeightPt: number,
  settings: WordSearchSettings,
  bookPageIndex: number,
  font: PDFFont,
  getColor: (hex?: string) => RGB
): Promise<void> {
  const pageNumberSettings = normalizePageNumberSettings(settings.typography.pageNumber);
  const layout = computePageNumberLayout(
    pageWidthPt,
    pageHeightPt,
    settings,
    bookPageIndex,
    pageNumberSettings
  );
  if (!layout) return;

  const snapshot = await renderPageNumberToDataUrl(layout);
  if (snapshot) {
    try {
      const image = await pdfDoc.embedPng(dataUrlToUint8Array(snapshot.dataUrl));
      page.drawImage(image, {
        x: layout.leftPt,
        y: pageHeightPt - layout.topPt - layout.heightPt,
        width: layout.widthPt,
        height: layout.heightPt,
      });
      return;
    } catch (error) {
      console.warn('[page-number-pdf] Canvas snapshot embed failed, using vector fallback:', error);
    }
  }

  drawPageNumberVectorFallback(page, pageHeightPt, layout, font, getColor);
}
