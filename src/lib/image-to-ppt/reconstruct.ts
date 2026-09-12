import type { DocumentPage, TextModuleSettings, TextPageBlock } from '@/lib/document-model';
import { createInsertableDocumentPage } from '@/lib/document-model';
import { createBlockId, normalizeTextPageBlock } from '@/lib/text-page-blocks';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { getPageDimensionsInches, getPageMarginInches } from '@/lib/puzzle-layout';
import type { ImageToPptDetection } from './types';
import { imageRectToContentPercent, svgToDataUrl } from './geometry';

export function createBlankConversionPage(name: string): DocumentPage {
  const page = createInsertableDocumentPage('empty-page');
  page.name = name;
  const settings = page.settings as TextModuleSettings;
  settings.title = name;
  settings.blocks = [];
  settings.isSeparatorPage = true;
  settings.useCustomBackground = true;
  settings.backgroundColor = '#ffffff';
  settings.backgroundImage = undefined;
  settings.textColor = '#111111';
  return page;
}

export function makeFullPageImageBlock(
  imageSrc: string,
  naturalWidth: number,
  naturalHeight: number
): TextPageBlock {
  return normalizeTextPageBlock({
    id: createBlockId('image'),
    kind: 'image',
    text: '',
    xPercent: 0,
    yPercent: 0,
    widthPercent: 100,
    heightPercent: 100,
    fontFamily: 'Arial',
    fontSize: 12,
    alignment: 'left',
    imageSrc,
    imageFit: 'stretch',
    imageOpacity: 100,
    imageEffect: 'none',
    imageNaturalWidth: naturalWidth,
    imageNaturalHeight: naturalHeight,
    boxPaddingPx: 0,
  });
}

function fontSizePtFromPx(px: number, pageHeightPx: number, pageHeightIn: number): number {
  const pageHeightPt = pageHeightIn * 72;
  const pt = (px / Math.max(1, pageHeightPx)) * pageHeightPt;
  return Math.max(8, Math.min(72, Math.round(pt * 10) / 10));
}

export function detectionsToBlocks(
  detections: ImageToPptDetection[],
  imageW: number,
  imageH: number,
  layoutSettings: WordSearchSettings
): TextPageBlock[] {
  const dims = getPageDimensionsInches(layoutSettings);
  const pageWidthPx = dims.width * 96;
  const pageHeightPx = dims.height * 96;
  const marginPx = getPageMarginInches(layoutSettings) * 96;
  const blocks: TextPageBlock[] = [];

  for (const detection of detections) {
    if (detection.kind === 'delete') continue;
    const geom = imageRectToContentPercent(
      detection.bbox,
      imageW,
      imageH,
      pageWidthPx,
      pageHeightPx,
      marginPx
    );
    if (detection.kind === 'text') {
      blocks.push(
        normalizeTextPageBlock({
          id: createBlockId('text'),
          kind: 'text',
          text: detection.text ?? '',
          xPercent: geom.xPercent,
          yPercent: geom.yPercent,
          widthPercent: Math.max(2, geom.widthPercent),
          heightPercent: Math.max(2, geom.heightPercent),
          fontFamily: 'Arial',
          fontSize: fontSizePtFromPx(detection.fontSizePx ?? detection.bbox.height * 0.8, pageHeightPx, dims.height),
          alignment: detection.alignment ?? 'left',
          bold: detection.bold ?? false,
          italic: false,
          textColor: '#111111',
          rotationDeg: detection.rotationDeg ?? 0,
          boxPaddingPx: 1,
          lineHeight: 1.25,
        })
      );
      continue;
    }

    const src =
      detection.kind === 'graphic' && detection.svgMarkup
        ? svgToDataUrl(detection.svgMarkup)
        : detection.rasterDataUrl;
    if (!src) continue;
    blocks.push(
      normalizeTextPageBlock({
        id: createBlockId('image'),
        kind: 'image',
        text: '',
        xPercent: geom.xPercent,
        yPercent: geom.yPercent,
        widthPercent: Math.max(1.5, geom.widthPercent),
        heightPercent: Math.max(1.5, geom.heightPercent),
        fontFamily: 'Arial',
        fontSize: 12,
        alignment: 'left',
        imageSrc: src,
        imageFit: 'stretch',
        imageOpacity: 100,
        imageEffect: 'none',
        imageNaturalWidth: Math.round(detection.bbox.width),
        imageNaturalHeight: Math.round(detection.bbox.height),
        boxPaddingPx: 0,
        rotationDeg: detection.rotationDeg ?? 0,
      })
    );
  }

  return blocks;
}

export function applyReconstructionToPage(
  page: DocumentPage,
  detections: ImageToPptDetection[],
  imageW: number,
  imageH: number,
  layoutSettings: WordSearchSettings,
  options: { backgroundColor: string; backgroundImage?: string; keepRasterBackground: boolean }
): DocumentPage {
  const settings = page.settings as TextModuleSettings;
  settings.blocks = detectionsToBlocks(detections, imageW, imageH, layoutSettings);
  settings.useCustomBackground = true;
  settings.backgroundColor = options.backgroundColor || '#ffffff';
  if (options.keepRasterBackground && options.backgroundImage) {
    settings.backgroundImage = options.backgroundImage;
    settings.backgroundImageFit = 'stretch';
    settings.backgroundImageOpacity = 100;
  } else {
    settings.backgroundImage = undefined;
  }
  return { ...page, settings: { ...settings } };
}
