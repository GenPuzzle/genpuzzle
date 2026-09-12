import type { BackgroundAnalysis, ImageToPptDetection, PixelRect, RgbColor } from './types';
import { createLocalId, expandRect, overlapArea, rectContainsPoint } from './geometry';
import { analyzeBackground, isInkPixel } from './background';
import { detectTextRegions, isLikelyWorksheetLabel, finalizeTextDetections } from './ocr';
import { eraseFrameInteriors, removeDetectedText } from './inpaint';
import { groupNearbyComponents, labelConnectedComponents } from './components';
import { regionLooksPhotographic, vectorizeRegion } from './vectorize';
import { canvasToDataUrl, cropImageData, imageDataToCanvas } from './image-decode';

function inkMask(imageData: ImageData, background: RgbColor): Uint8Array {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const p = i * 4;
    mask[i] = isInkPixel(data[p], data[p + 1], data[p + 2], data[p + 3], background, 52) ? 1 : 0;
  }
  return mask;
}

function rasterCrop(imageData: ImageData, bbox: PixelRect, background: RgbColor): string {
  const padded = expandRect(bbox, 2, imageData.width, imageData.height);
  const crop = cropImageData(imageData, padded.x, padded.y, padded.width, padded.height);
  const { data } = crop;
  for (let i = 0; i < data.length; i += 4) {
    if (!isInkPixel(data[i], data[i + 1], data[i + 2], data[i + 3], background, 28)) {
      data[i + 3] = 0;
    }
  }
  return canvasToDataUrl(imageDataToCanvas(crop), 'image/png');
}

function filterTextOnIllustrations(
  texts: ImageToPptDetection[],
  graphics: Array<{ bbox: PixelRect; role?: string }>
): ImageToPptDetection[] {
  return texts.filter((text) => {
    if (isLikelyWorksheetLabel(text.text ?? '')) return true;
    if ((text.confidence ?? 0) >= 74) return true;
    const textArea = Math.max(1, text.bbox.width * text.bbox.height);
    for (const graphic of graphics) {
      if (graphic.role !== 'art') continue;
      const overlap = overlapArea(text.bbox, graphic.bbox);
      const graphicArea = graphic.bbox.width * graphic.bbox.height;
      if (overlap / textArea >= 0.7 && graphicArea > textArea * 8 && (text.confidence ?? 0) < 68) return false;
    }
    return true;
  });
}

function filterTextAgainstInkComponents(
  texts: ImageToPptDetection[],
  components: Array<{ bbox: PixelRect; area: number }>,
  pageHeight: number
): ImageToPptDetection[] {
  const illustrations = components.filter((component) => {
    const boxArea = Math.max(1, component.bbox.width * component.bbox.height);
    const solidity = component.area / boxArea;
    return component.bbox.height > pageHeight * 0.16 && solidity < 0.32 && boxArea > pageHeight * pageHeight * 0.04;
  });
  return texts.filter((text) => {
    if (isLikelyWorksheetLabel(text.text ?? '')) return true;
    if ((text.confidence ?? 0) >= 70) return true;
    const textArea = Math.max(1, text.bbox.width * text.bbox.height);
    const cx = text.bbox.x + text.bbox.width / 2;
    const cy = text.bbox.y + text.bbox.height / 2;
    return !illustrations.some((item) => {
      const boxArea = item.bbox.width * item.bbox.height;
      if (textArea / boxArea > 0.18) return false;
      if (!rectContainsPoint(item.bbox, cx, cy)) return false;
      return overlapArea(text.bbox, item.bbox) / textArea > 0.55 && boxArea > textArea * 8;
    });
  });
}

function dropGraphicsUnderText(
  graphics: ImageToPptDetection[],
  texts: ImageToPptDetection[]
): ImageToPptDetection[] {
  return graphics.filter((graphic) => {
    if (graphic.graphicRole === 'frame') return true;
    const graphicArea = Math.max(1, graphic.bbox.width * graphic.bbox.height);
    return !texts.some((text) => {
      const overlap = overlapArea(graphic.bbox, text.bbox);
      if (overlap / graphicArea > 0.35) return true;
      const expanded = {
        x: text.bbox.x - text.bbox.height * 0.4,
        y: text.bbox.y - text.bbox.height * 0.4,
        width: text.bbox.width + text.bbox.height * 0.8,
        height: text.bbox.height * 1.8,
      };
      const near = overlapArea(graphic.bbox, expanded);
      const leftoverLetter =
        graphicArea < text.bbox.width * text.bbox.height * 0.8 &&
        graphic.bbox.height < text.bbox.height * 2.2;
      return leftoverLetter && near / graphicArea > 0.2;
    });
  });
}

function hollowFrameBoxes(
  components: Array<{ bbox: PixelRect; area: number }>,
  pageWidth: number,
  pageHeight: number
): PixelRect[] {
  return components
    .filter((component) => {
      const boxArea = Math.max(1, component.bbox.width * component.bbox.height);
      const solidity = component.area / boxArea;
      const aspect = component.bbox.width / Math.max(1, component.bbox.height);
      return (
        solidity < 0.2 &&
        aspect > 1.35 &&
        component.bbox.width > pageWidth * 0.12 &&
        component.bbox.height < pageHeight * 0.1
      );
    })
    .map((component) => component.bbox);
}

export function prepareCleanedArtwork(
  source: ImageData,
  textBoxes: PixelRect[],
  background: RgbColor
): ImageData {
  let cleaned = removeDetectedText(source, textBoxes, background);
  const mask = inkMask(cleaned, background);
  const { components } = labelConnectedComponents(mask, cleaned.width, cleaned.height);
  const frames = hollowFrameBoxes(components, cleaned.width, cleaned.height);
  if (frames.length) cleaned = eraseFrameInteriors(cleaned, frames, background);
  return cleaned;
}

function dropTextOnEmptyFrames(
  texts: ImageToPptDetection[],
  components: Array<{ bbox: PixelRect; area: number }>,
  pageWidth: number
): ImageToPptDetection[] {
  return texts.filter((text) => {
    if (isLikelyWorksheetLabel(text.text ?? '')) return true;
    const letters = (text.text ?? '').replace(/\s+/g, '').length;
    if (letters >= 5 && (text.confidence ?? 0) >= 58) return true;
    const textArea = Math.max(1, text.bbox.width * text.bbox.height);
    return !components.some((component) => {
      const boxArea = Math.max(1, component.bbox.width * component.bbox.height);
      const solidity = component.area / boxArea;
      const aspect = component.bbox.width / Math.max(1, component.bbox.height);
      if (solidity >= 0.22 || aspect < 1.35 || component.bbox.width < pageWidth * 0.08) return false;
      return overlapArea(text.bbox, component.bbox) / textArea > 0.6;
    });
  });
}

function snapTextIntoFrames(
  texts: ImageToPptDetection[],
  graphics: ImageToPptDetection[]
): ImageToPptDetection[] {
  const frames = graphics.filter((item) => item.graphicRole === 'frame');
  return texts.map((text) => {
    const wordCount = (text.text ?? '').trim().split(/\s+/).filter(Boolean).length;
    if (wordCount > 3) return text;
    const cx = text.bbox.x + text.bbox.width / 2;
    const cy = text.bbox.y + text.bbox.height / 2;
    const frame = frames.find((item) => rectContainsPoint(item.bbox, cx, cy));
    if (!frame) return text;
    if (text.bbox.width * text.bbox.height > frame.bbox.width * frame.bbox.height * 0.9) return text;
    const insetX = Math.max(4, frame.bbox.width * 0.08);
    const insetY = Math.max(3, frame.bbox.height * 0.12);
    return {
      ...text,
      bbox: {
        x: frame.bbox.x + insetX,
        y: frame.bbox.y + insetY,
        width: Math.max(8, frame.bbox.width - insetX * 2),
        height: Math.max(8, frame.bbox.height - insetY * 2),
      },
      alignment: 'center',
      bold: true,
    };
  });
}

export async function detectPageContent(
  canvas: HTMLCanvasElement,
  onProgress?: (label: string) => void
): Promise<{
  detections: ImageToPptDetection[];
  background: ReturnType<typeof analyzeBackground>;
  processedWidth: number;
  processedHeight: number;
  cleanedImageData: ImageData;
}> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const background = analyzeBackground(source);

  onProgress?.('Detecting text...');
  let textDetections: ImageToPptDetection[] = [];
  try {
    textDetections = await detectTextRegions(canvas, onProgress);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'OCR failed');
  }

  const originalMask = inkMask(source, background.color);
  const originalComponents = labelConnectedComponents(
    originalMask,
    source.width,
    source.height
  ).components;
  textDetections = finalizeTextDetections(
    dropTextOnEmptyFrames(
      filterTextAgainstInkComponents(textDetections, originalComponents, source.height),
      originalComponents,
      source.width
    ),
    source.width,
    source.height
  );

  onProgress?.('Removing original text...');
  const cleaned = prepareCleanedArtwork(
    source,
    textDetections.map((item) => item.bbox),
    background.color
  );

  onProgress?.('Vectorizing graphics...');
  const mask = inkMask(cleaned, background.color);
  const { components } = labelConnectedComponents(mask, cleaned.width, cleaned.height);
  const groups = groupNearbyComponents(components, cleaned.width, cleaned.height);
  const graphics: ImageToPptDetection[] = [];

  for (const group of groups) {
    if (group.area < 18) continue;
    const traced = vectorizeRegion(cleaned, group.bbox, background.color);
    const photographic = !traced && regionLooksPhotographic(cleaned, group.bbox, background.color);
    graphics.push({
      id: createLocalId('graphic'),
      kind: traced ? 'graphic' : 'keep-original',
      bbox: group.bbox,
      parts: group.parts,
      svgMarkup: traced?.svg,
      fillHex: traced?.fillHex,
      graphicRole: traced?.role ?? (photographic ? undefined : 'art'),
      rasterDataUrl: traced ? undefined : rasterCrop(cleaned, group.bbox, background.color),
    });
  }

  const filteredText = snapTextIntoFrames(
    filterTextOnIllustrations(
      textDetections,
      graphics.map((item) => ({
        bbox: item.bbox,
        role: item.graphicRole,
      }))
    ),
    graphics
  );
  const keptGraphics = dropGraphicsUnderText(graphics, filteredText);

  return {
    detections: [...keptGraphics, ...filteredText],
    background,
    processedWidth: canvas.width,
    processedHeight: canvas.height,
    cleanedImageData: cleaned,
  };
}

export function mergeGraphicDetections(
  detections: ImageToPptDetection[],
  ids: string[]
): ImageToPptDetection[] {
  const selected = detections.filter((item) => ids.includes(item.id) && item.kind !== 'text');
  if (selected.length < 2) return detections;
  const rest = detections.filter((item) => !ids.includes(item.id));
  const bbox = selected.reduce(
    (acc, item) => ({
      x: Math.min(acc.x, item.bbox.x),
      y: Math.min(acc.y, item.bbox.y),
      width: 0,
      height: 0,
    }),
    { ...selected[0].bbox }
  );
  const x2 = Math.max(...selected.map((item) => item.bbox.x + item.bbox.width));
  const y2 = Math.max(...selected.map((item) => item.bbox.y + item.bbox.height));
  bbox.width = x2 - bbox.x;
  bbox.height = y2 - bbox.y;
  rest.push({
    id: createLocalId('graphic'),
    kind: 'graphic',
    bbox,
    parts: selected.flatMap((item) => item.parts ?? []),
    svgMarkup: selected.map((item) => item.svgMarkup).filter(Boolean).join(''),
    rasterDataUrl: selected.find((item) => item.rasterDataUrl)?.rasterDataUrl,
  });
  return rest;
}

export function splitGraphicDetection(
  detections: ImageToPptDetection[],
  id: string
): ImageToPptDetection[] {
  const target = detections.find((item) => item.id === id);
  if (!target?.parts || target.parts.length < 2) return detections;
  const rest = detections.filter((item) => item.id !== id);
  for (const part of target.parts) {
    rest.push({
      id: createLocalId('graphic'),
      kind: target.kind === 'delete' ? 'graphic' : target.kind,
      bbox: part.bbox,
      parts: [part],
    });
  }
  return rest;
}

export function materializeDetections(
  cleaned: ImageData,
  detections: ImageToPptDetection[],
  background: Pick<BackgroundAnalysis, 'color'>
): ImageToPptDetection[] {
  const graphics = detections
    .filter((detection) => detection.kind !== 'delete' && detection.kind !== 'text')
    .map((detection) => {
      const traced = vectorizeRegion(cleaned, detection.bbox, background.color);
      if (traced) {
        return {
          ...detection,
          kind: 'graphic' as const,
          svgMarkup: traced.svg,
          fillHex: traced.fillHex,
          graphicRole: traced.role,
          rasterDataUrl: undefined,
        };
      }
      return {
        ...detection,
        kind: 'keep-original' as const,
        rasterDataUrl: rasterCrop(cleaned, detection.bbox, background.color),
        svgMarkup: undefined,
      };
    });
  const texts = snapTextIntoFrames(
    detections.filter((item) => item.kind === 'text'),
    graphics
  );
  return [...dropGraphicsUnderText(graphics, texts), ...texts];
}
