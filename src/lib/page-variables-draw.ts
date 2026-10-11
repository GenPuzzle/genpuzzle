/**
 * Draw page-variable overlays on editable PDF / PPTX from the shared element list.
 */

import type { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import type { DocumentPage, PuzzleModuleSettings, TextModuleSettings } from './document-model';
import { isPuzzleModuleSettings, isTextModuleSettings } from './document-model';
import {
  buildPageVariableElements,
  normalizePageVariables,
  pageVariableContentIndex,
  type PageVariableField,
} from './page-variables';
import { prepareResolvedImagesForPrint } from './resolved-layout/print-image';
import { renderResolvedPdf } from './resolved-layout/render-pdf';
import { renderResolvedPpt } from './resolved-layout/render-ppt';
import { textVariableContextFromDocument } from './ai/text-variable-context';
import type { TextVariableResolveContext } from './ai/text-variable-tokens';

export function pageVariablesFromDocument(
  documentPages: DocumentPage[],
  sourceDocumentId: string | undefined
): PageVariableField[] {
  if (!sourceDocumentId) return [];
  const page = documentPages.find((doc) => doc.id === sourceDocumentId);
  if (!page) return [];
  if (isPuzzleModuleSettings(page.settings)) {
    return normalizePageVariables((page.settings as PuzzleModuleSettings).pageVariables);
  }
  if (isTextModuleSettings(page.settings)) {
    return normalizePageVariables((page.settings as TextModuleSettings).pageVariables);
  }
  return [];
}

export function resolvePageVariableContext(input: {
  puzzleIndexInDocument?: number;
  puzzlesPerPage?: number;
  puzzlesStartingNumber?: number;
  bookPageIndex?: number;
}): { contentIndex: number; puzzleNumber: number; bookPageNumber: number } {
  const puzzleIndex = Math.max(0, Math.round(input.puzzleIndexInDocument ?? 0));
  const puzzlesPerPage = Math.max(1, Math.round(input.puzzlesPerPage ?? 1));
  const start = Math.max(1, Math.round(input.puzzlesStartingNumber ?? 1));
  return {
    contentIndex: pageVariableContentIndex(puzzleIndex, puzzlesPerPage),
    puzzleNumber: start + puzzleIndex,
    bookPageNumber: Math.max(1, Math.round(input.bookPageIndex ?? 0) + 1),
  };
}

/** Resolve Text Variable context for a compiled page's source document. */
export function resolveContextForDocumentPages(
  documentPages: DocumentPage[],
  sourceDocumentId: string | undefined,
  extras?: Partial<TextVariableResolveContext>
): TextVariableResolveContext {
  const page = sourceDocumentId
    ? documentPages.find((doc) => doc.id === sourceDocumentId)
    : undefined;
  return textVariableContextFromDocument(page, extras);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function drawPageVariablesOnPdfPage(input: {
  pdfDoc: PDFDocument;
  page: PDFPage;
  pageWidthPt: number;
  pageHeightPt: number;
  fields: PageVariableField[];
  contentIndex: number;
  bookPageNumber: number;
  puzzleNumber: number;
  getFont: (family: string, bold: boolean) => Promise<PDFFont>;
  resolveContext?: import('./ai/text-variable-tokens').TextVariableResolveContext;
}): Promise<void> {
  const elements = buildPageVariableElements({
    fields: input.fields,
    pageWidthPt: input.pageWidthPt,
    pageHeightPt: input.pageHeightPt,
    contentIndex: input.contentIndex,
    bookPageNumber: input.bookPageNumber,
    puzzleNumber: input.puzzleNumber,
    resolveContext: input.resolveContext,
  });
  if (elements.length === 0) return;

  const prepared = await prepareResolvedImagesForPrint(elements);
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  for (const el of prepared) {
    if (el.kind !== 'image' || !el.href || embedded.has(el.href)) continue;
    if (!el.href.startsWith('data:')) continue;
    const bytes = dataUrlToBytes(el.href);
    const image = el.href.includes('image/jpeg') || el.href.includes('image/jpg')
      ? await input.pdfDoc.embedJpg(bytes)
      : await input.pdfDoc.embedPng(bytes);
    embedded.set(el.href, image);
  }

  const fonts = new Map<string, PDFFont>();
  for (const el of prepared) {
    if (el.kind !== 'text') continue;
    const key = `${el.fontFamily}|${el.bold ? 'b' : 'r'}`;
    if (fonts.has(key)) continue;
    fonts.set(key, await input.getFont(el.fontFamily, !!el.bold));
  }

  renderResolvedPdf(
    input.page,
    input.pageHeightPt,
    prepared,
    (family, bold) => {
      const key = `${family}|${bold ? 'b' : 'r'}`;
      const font = fonts.get(key);
      if (!font) {
        throw new Error(`Page variable font "${family}" was not embedded. Do not drop the text.`);
      }
      return font;
    },
    (href) => {
      const image = embedded.get(href);
      if (!image) {
        throw new Error('Page variable image was not embedded. Do not drop the image.');
      }
      return image;
    }
  );
}

type PptSlide = {
  addShape: (shape: string, opts: Record<string, unknown>) => void;
  addText: (text: string, opts: Record<string, unknown>) => void;
  addImage?: (opts: Record<string, unknown>) => void;
};

export function drawPageVariablesOnPptSlide(input: {
  slide: PptSlide;
  pageWidthPt: number;
  pageHeightPt: number;
  fields: PageVariableField[];
  contentIndex: number;
  bookPageNumber: number;
  puzzleNumber: number;
  resolveContext?: import('./ai/text-variable-tokens').TextVariableResolveContext;
}): void {
  const elements = buildPageVariableElements({
    fields: input.fields,
    pageWidthPt: input.pageWidthPt,
    pageHeightPt: input.pageHeightPt,
    contentIndex: input.contentIndex,
    bookPageNumber: input.bookPageNumber,
    puzzleNumber: input.puzzleNumber,
    resolveContext: input.resolveContext,
  });
  if (elements.length === 0) return;
  renderResolvedPpt(input.slide, elements);
}
