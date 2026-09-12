import type { ImageToPptDetection, PixelRect } from './types';
import { createLocalId, expandRect, overlapArea, rectCenterX, rectIou, unionRects } from './geometry';

type TessWord = {
  text?: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
};

type TessLine = {
  text?: string;
  confidence?: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  words?: TessWord[];
};

type TessWorker = {
  recognize: (image: HTMLCanvasElement | Blob | string) => Promise<{ data: { lines?: TessLine[]; words?: TessWord[] } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate?: () => Promise<void>;
};

const OCR_LANGS = 'spa+eng';

const WORKSHEET_LABELS = new Set([
  'dentro',
  'fuera',
  'encima',
  'debajo',
  'delante',
  'detras',
  'detrás',
  'arriba',
  'abajo',
  'izquierda',
  'derecha',
  'perception',
  'percepción',
  'percepcion',
  'orientacion',
  'orientación',
  'visual',
  'inside',
  'outside',
  'above',
  'below',
  'under',
  'behind',
  'front',
  'beside',
  'between',
]);

let workerPromise: Promise<TessWorker> | null = null;
let progressHandler: ((label: string) => void) | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = (await createWorker(OCR_LANGS, 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        workerBlobURL: false,
        logger: (message) => {
          if (!progressHandler) return;
          if (message.status === 'recognizing text') {
            const pct = Math.round((message.progress || 0) * 100);
            progressHandler(`Detecting text... ${pct}%`);
          } else if (message.status && message.status !== 'initialized api') {
            progressHandler('Detecting text...');
          }
        },
      })) as TessWorker;
      return worker;
    })();
  }
  const worker = await workerPromise;
  await worker.setParameters({
    tessedit_pageseg_mode: '3',
    preserve_interword_spaces: '1',
    user_defined_dpi: '220',
  });
  return worker;
}

export function setOcrProgressHandler(handler: ((label: string) => void) | null): void {
  progressHandler = handler;
}

function normalizeLabel(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase();
}

export function isLikelyWorksheetLabel(text: string): boolean {
  const tokens = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (tokens.length === 1 && WORKSHEET_LABELS.has(normalizeLabel(tokens[0]))) return true;
  if (tokens.length <= 3 && tokens.every((token) => WORKSHEET_LABELS.has(normalizeLabel(token)) || /^\d{1,3}$/.test(token))) {
    return tokens.some((token) => WORKSHEET_LABELS.has(normalizeLabel(token)));
  }
  return false;
}

export function looksLikeGarbageOcr(text: string): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return true;
  const tokens = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  const repeats = tokens.filter((token, index) => index > 0 && token === tokens[index - 1]).length;
  if (repeats >= 2) return true;
  const tiny = tokens.filter((token) => token.replace(/[^\p{L}\p{N}]/gu, '').length <= 2).length;
  if (tokens.length >= 5 && tiny / tokens.length > 0.45) return true;
  const compact = cleaned.replace(/\s+/g, '').toLowerCase();
  if (/dentroci[oó]n|cionel|dibujo\.[a-z]|elconel/.test(compact)) return true;
  const unique = new Set(tokens.map((token) => token.replace(/[^\p{L}]/gu, '')).filter((token) => token.length > 2));
  if (tokens.length >= 6 && unique.size <= 3) return true;
  return false;
}

export function looksLikePlausibleText(text: string, confidence = 100): boolean {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return false;
  if (looksLikeGarbageOcr(cleaned)) return false;
  if (isLikelyWorksheetLabel(cleaned) && confidence >= 38) return true;
  const compact = cleaned.replace(/\s/g, '');
  const letters = compact.match(/[A-Za-zÀ-ÿÁÉÍÓÚÜÑáéíóúüñ]/g)?.length ?? 0;
  const alnum = compact.match(/[A-Za-zÀ-ÿ0-9ÁÉÍÓÚÜÑáéíóúüñ]/g)?.length ?? 0;
  if (letters < 2) return false;
  if (compact.length > 0 && alnum / compact.length < 0.58) return false;
  const tokens = cleaned.split(/\s+/);
  const tinyTokens = tokens.filter((token) => token.replace(/[^\p{L}\p{N}]/gu, '').length <= 1).length;
  if (tokens.length >= 4 && tinyTokens / tokens.length > 0.45) return false;
  if (compact.length <= 2 && confidence < 70) return false;
  if (compact.length <= 4 && confidence < 55) return false;
  if (confidence < 46) return false;
  if (/^[\d\W]+$/.test(compact)) return false;
  return true;
}

export function repairOcrText(text: string): string {
  const trimmed = text.replace(/[ \t]+/g, ' ').trim();
  if (!trimmed) return '';
  let out = trimmed.replace(/([a-zà-ÿñáéíóúü])([A-ZÁÉÍÓÚÜÑ])/g, '$1 $2');
  out = out.replace(
    /([a-zà-ÿñáéíóúü]{3,}[,.]?)\s+((?:[A-ZÁÉÍÓÚÜÑ][a-zà-ÿñáéíóúü]{2,},?\s+){0,8}[A-ZÁÉÍÓÚÜÑ]?[a-zà-ÿñáéíóúü]{2,}(?:,\s+[a-zà-ÿñáéíóúü]{2,})+)/g,
    '$1\n$2'
  );
  return out
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function bboxFromTess(box?: { x0: number; y0: number; x1: number; y1: number }): PixelRect | null {
  if (!box) return null;
  const width = box.x1 - box.x0;
  const height = box.y1 - box.y0;
  if (width < 2 || height < 2) return null;
  return { x: box.x0, y: box.y0, width, height };
}

function scaleRect(rect: PixelRect, scale: number): PixelRect {
  if (scale === 1) return rect;
  return {
    x: rect.x / scale,
    y: rect.y / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

function inferAlignment(rect: PixelRect, pageWidth: number, words: TessWord[], text: string): 'left' | 'center' | 'right' {
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount <= 2 && rect.width < pageWidth * 0.45) return 'center';
  const minX = Math.min(...words.map((w) => w.bbox?.x0 ?? rect.x), rect.x);
  const maxX = Math.max(...words.map((w) => w.bbox?.x1 ?? rect.x + rect.width), rect.x + rect.width);
  const leftoverLeft = minX;
  const leftoverRight = pageWidth - maxX;
  if (Math.abs(leftoverLeft - leftoverRight) < pageWidth * 0.1) return 'center';
  if (leftoverRight > leftoverLeft * 2.2) return 'left';
  if (leftoverLeft > leftoverRight * 2.2) return 'right';
  const cx = rectCenterX(rect);
  if (cx < pageWidth * 0.38) return 'left';
  if (cx > pageWidth * 0.62) return 'right';
  return 'center';
}

function shouldMergeOcrLines(last: ImageToPptDetection, next: ImageToPptDetection, pageWidth: number): boolean {
  const gap = next.bbox.y - (last.bbox.y + last.bbox.height);
  const avgH = (next.bbox.height + last.bbox.height) / 2;
  const lastWords = (last.text ?? '').trim().split(/\s+/);
  const nextWords = (next.text ?? '').trim().split(/\s+/);
  const isolatedLabels = lastWords.length <= 2 && nextWords.length <= 2 && Math.abs(next.bbox.x - last.bbox.x) < pageWidth * 0.08;
  if (isolatedLabels) return false;
  const nextIsList = /,\s+\S+/.test(next.text ?? '') && nextWords.length >= 3 && nextWords.every((word) => word.replace(/[^\p{L}]/gu, '').length <= 12);
  if (nextIsList && lastWords.length >= 4) return false;
  if (Math.abs((last.fontSizePx ?? last.bbox.height) - (next.fontSizePx ?? next.bbox.height)) > avgH * 0.45) return false;
  const xClose = Math.abs(next.bbox.x - last.bbox.x) < Math.max(12, pageWidth * 0.03);
  const widthSimilar =
    Math.abs(next.bbox.width - last.bbox.width) < Math.max(next.bbox.width, last.bbox.width) * 0.35;
  return gap >= 0 && gap <= avgH * 0.42 && xClose && widthSimilar;
}

function mergeLineParagraphs(lines: ImageToPptDetection[], pageWidth: number): ImageToPptDetection[] {
  const sorted = [...lines].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  const groups: ImageToPptDetection[][] = [];
  for (const line of sorted) {
    const prev = groups[groups.length - 1];
    const last = prev?.[prev.length - 1];
    if (!last) {
      groups.push([line]);
      continue;
    }
    if (shouldMergeOcrLines(last, line, pageWidth)) prev.push(line);
    else groups.push([line]);
  }

  return groups.map((group) => {
    if (group.length === 1) return group[0];
    const bbox = unionRects(group.map((item) => item.bbox));
    return {
      id: createLocalId('text'),
      kind: 'text' as const,
      bbox,
      text: group.map((item) => item.text ?? '').join('\n'),
      confidence: group.reduce((sum, item) => sum + (item.confidence ?? 0), 0) / group.length,
      fontSizePx: Math.round(
        group.reduce((sum, item) => sum + (item.fontSizePx ?? item.bbox.height), 0) / group.length
      ),
      alignment: group[0].alignment ?? 'left',
      bold: group.every((item) => item.bold),
      rotationDeg: 0,
    };
  });
}

function normalizeComparableText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function preferBetterOverlap(detections: ImageToPptDetection[]): ImageToPptDetection[] {
  const kept: ImageToPptDetection[] = [];
  const sorted = [...detections].sort((a, b) => {
    const aLabel = isLikelyWorksheetLabel(a.text ?? '') ? 1 : 0;
    const bLabel = isLikelyWorksheetLabel(b.text ?? '') ? 1 : 0;
    if (aLabel !== bLabel) return bLabel - aLabel;
    const aArea = a.bbox.width * a.bbox.height;
    const bArea = b.bbox.width * b.bbox.height;
    const conf = (b.confidence ?? 0) - (a.confidence ?? 0);
    if (Math.abs(conf) > 8) return conf;
    return aArea - bArea;
  });
  for (const item of sorted) {
    const itemKey = normalizeComparableText(item.text ?? '');
    const itemArea = Math.max(1, item.bbox.width * item.bbox.height);
    const overlaps = kept.some((other) => {
      const iou = rectIou(item.bbox, other.bbox);
      const overlap = overlapArea(item.bbox, other.bbox);
      const otherArea = Math.max(1, other.bbox.width * other.bbox.height);
      const otherKey = normalizeComparableText(other.text ?? '');
      const sameText =
        itemKey.length >= 4 &&
        otherKey.length >= 4 &&
        (itemKey === otherKey || itemKey.includes(otherKey) || otherKey.includes(itemKey));
      if (sameText && (iou > 0.12 || overlap / Math.min(itemArea, otherArea) > 0.35)) return true;
      if (iou > 0.32) return true;
      return overlap / itemArea > 0.55 && overlap / Math.min(itemArea, otherArea) > 0.4;
    });
    if (!overlaps) kept.push(item);
  }
  return kept;
}

function scaleTessWord(word: TessWord, scale: number): TessWord {
  if (!word.bbox) return word;
  return {
    ...word,
    bbox: {
      x0: word.bbox.x0 / scale,
      y0: word.bbox.y0 / scale,
      x1: word.bbox.x1 / scale,
      y1: word.bbox.y1 / scale,
    },
  };
}

function detectionFromText(
  raw: string,
  confidence: number,
  bbox: PixelRect,
  pageWidth: number,
  pageHeight: number,
  words: TessWord[]
): ImageToPptDetection | null {
  const text = repairOcrText(raw);
  if (!looksLikePlausibleText(text.replace(/\n/g, ' '), confidence)) return null;
  if (bbox.height > pageHeight * 0.22 && bbox.width < pageWidth * 0.18) return null;
  const wordBoxes = words
    .map((word) => bboxFromTess(word.bbox))
    .filter((box): box is PixelRect => Boolean(box));
  const used = wordBoxes.length ? unionRects(wordBoxes) : bbox;
  if (used.width < 2 || used.height < 2) return null;
  if (used.width > pageWidth * 0.92 && used.height > pageHeight * 0.12) return null;
  const wordCount = text.split(/\s+/).length;
  return {
    id: createLocalId('text'),
    kind: 'text',
    bbox: used,
    text,
    confidence,
    fontSizePx: Math.max(8, Math.round(used.height * 0.78)),
    alignment: inferAlignment(used, pageWidth, words, text),
    bold: wordCount <= 3 && used.height > 18,
    rotationDeg: 0,
  };
}

export function explodeRepairedText(detection: ImageToPptDetection): ImageToPptDetection[] {
  const parts = (detection.text ?? '')
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return [{ ...detection, text: parts[0] ?? detection.text }];
  }
  const fontPx = detection.fontSizePx ?? Math.max(12, detection.bbox.height * 0.8);
  const oneLineBox = detection.bbox.height < fontPx * 1.7;
  if (oneLineBox) {
    return [{ ...detection, text: parts.join(' ') }];
  }
  const lineH = Math.max(10, Math.round(detection.bbox.height / parts.length));
  return parts.map((text, index) => ({
    ...detection,
    id: index === 0 ? detection.id : createLocalId('text'),
    text,
    bbox: {
      x: detection.bbox.x,
      y: detection.bbox.y + index * lineH,
      width: detection.bbox.width,
      height: lineH,
    },
    fontSizePx: Math.max(8, Math.round(lineH * 0.78)),
  }));
}

export function finalizeTextDetections(
  detections: ImageToPptDetection[],
  pageWidth: number,
  pageHeight: number
): ImageToPptDetection[] {
  const usable = detections.filter((item) => {
    const text = (item.text ?? '').trim();
    return text && !looksLikeGarbageOcr(text) && looksLikePlausibleText(text.replace(/\n/g, ' '), item.confidence ?? 100);
  });

  const labels = new Map<string, ImageToPptDetection>();
  const rest: ImageToPptDetection[] = [];
  for (const item of usable) {
    const tokens = (item.text ?? '').trim().split(/\s+/);
    if (tokens.length === 1 && isLikelyWorksheetLabel(item.text ?? '')) {
      const key = normalizeLabel(item.text ?? '');
      const prev = labels.get(key);
      if (!prev) {
        labels.set(key, item);
        continue;
      }
      const prevArea = prev.bbox.width * prev.bbox.height;
      const itemArea = item.bbox.width * item.bbox.height;
      const better =
        itemArea < prevArea * 0.9 ||
        (item.confidence ?? 0) > (prev.confidence ?? 0) + 4;
      if (better) labels.set(key, item);
      continue;
    }
    rest.push(item);
  }

  const header = rest.filter(
    (item) => item.bbox.y < pageHeight * 0.14 && (item.text ?? '').replace(/\s+/g, '').length >= 8
  );
  let keptRest = rest;
  if (header.length > 1) {
    const best = [...header].sort((a, b) => (b.text ?? '').length - (a.text ?? '').length)[0];
    keptRest = rest.filter((item) => !header.includes(item) || item === best);
  }

  const labelList = [...labels.values()];
  const withoutLabelEcho = keptRest.filter((item) => {
    const key = normalizeComparableText(item.text ?? '');
    return !labelList.some((label) => {
      const labelKey = normalizeComparableText(label.text ?? '');
      if (key !== labelKey) return false;
      const dy = Math.abs(item.bbox.y - label.bbox.y);
      return dy < Math.max(item.bbox.height, label.bbox.height) * 2.2;
    });
  });

  return mergeLineParagraphs(
    preferBetterOverlap([...labelList, ...withoutLabelEcho].flatMap(explodeRepairedText)),
    pageWidth
  );
}

function clusterWordsIntoLines(
  words: Array<{ text: string; confidence: number; bbox: PixelRect }>,
  pageWidth: number,
  pageHeight: number
): ImageToPptDetection[] {
  const usable = words
    .filter((word) => looksLikePlausibleText(word.text, word.confidence) || isLikelyWorksheetLabel(word.text))
    .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  const lines: typeof usable[] = [];
  for (const word of usable) {
    const current = lines[lines.length - 1];
    const last = current?.[current.length - 1];
    if (!last) {
      lines.push([word]);
      continue;
    }
    const overlapH =
      Math.min(last.bbox.y + last.bbox.height, word.bbox.y + word.bbox.height) - Math.max(last.bbox.y, word.bbox.y);
    const sameLine = overlapH > Math.min(last.bbox.height, word.bbox.height) * 0.42;
    const xGap = word.bbox.x - (last.bbox.x + last.bbox.width);
    if (sameLine && xGap < Math.max(last.bbox.height, word.bbox.height) * 2.4) current.push(word);
    else lines.push([word]);
  }

  return lines
    .map((lineWords) => {
      const bbox = unionRects(lineWords.map((item) => item.bbox));
      const text = lineWords.map((item) => item.text).join(' ');
      const confidence = lineWords.reduce((sum, item) => sum + item.confidence, 0) / lineWords.length;
      return detectionFromText(
        text,
        confidence,
        bbox,
        pageWidth,
        pageHeight,
        lineWords.map((item) => ({
          text: item.text,
          confidence: item.confidence,
          bbox: {
            x0: item.bbox.x,
            y0: item.bbox.y,
            x1: item.bbox.x + item.bbox.width,
            y1: item.bbox.y + item.bbox.height,
          },
        }))
      );
    })
    .filter((item): item is ImageToPptDetection => Boolean(item));
}

function collectTessWords(lines: TessLine[], words: TessWord[]): TessWord[] {
  const fromLines = lines.flatMap((line) => line.words ?? []);
  return [...fromLines, ...words].filter((word) => (word.text ?? '').trim());
}

function makeOcrCanvas(source: HTMLCanvasElement): { canvas: HTMLCanvasElement; scale: number } {
  const minEdge = Math.min(source.width, source.height);
  const scale = minEdge < 1100 ? Math.min(1.75, 1500 / minEdge) : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { canvas: source, scale: 1 };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  let min = 255;
  let max = 0;
  const gray = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const value = Math.round(0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
    gray[i] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const span = Math.max(1, max - min);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    const stretched = Math.round(((gray[i] - min) / span) * 255);
    data[p] = stretched;
    data[p + 1] = stretched;
    data[p + 2] = stretched;
    data[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return { canvas, scale };
}

function detectionsFromRecognize(
  lines: TessLine[],
  words: TessWord[],
  pageWidth: number,
  pageHeight: number,
  scale: number
): ImageToPptDetection[] {
  const tessWords = collectTessWords(lines, words)
    .map((word) => {
      const scaled = scaleTessWord(word, scale);
      const bbox = bboxFromTess(scaled.bbox);
      if (!bbox) return null;
      return {
        text: (word.text ?? '').trim(),
        confidence: word.confidence ?? 0,
        bbox,
        tess: scaled,
      };
    })
    .filter(
      (item): item is { text: string; confidence: number; bbox: PixelRect; tess: TessWord } => Boolean(item?.text)
    );

  const fromWords = clusterWordsIntoLines(
    tessWords.map((item) => ({ text: item.text, confidence: item.confidence, bbox: item.bbox })),
    pageWidth,
    pageHeight
  );

  const fromLines: ImageToPptDetection[] = [];
  for (const line of lines) {
    const raw = (line.text ?? '').replace(/\s+/g, ' ').trim();
    const confidence = line.confidence ?? 0;
    const bbox = bboxFromTess(line.bbox);
    if (!bbox) continue;
    const mapped = scaleRect(bbox, scale);
    const lineWords = (line.words ?? []).map((word) => scaleTessWord(word, scale));
    const detection = detectionFromText(raw, confidence, mapped, pageWidth, pageHeight, lineWords);
    if (!detection) continue;
    const covered = fromWords.some((wordLine) => {
      const overlap = overlapArea(detection.bbox, wordLine.bbox);
      const area = Math.max(1, detection.bbox.width * detection.bbox.height);
      return overlap / area > 0.45 || rectIou(detection.bbox, wordLine.bbox) > 0.28;
    });
    if (!covered) fromLines.push(detection);
  }

  return finalizeTextDetections([...fromWords, ...fromLines], pageWidth, pageHeight);
}

export function mergeTextDetections(detections: ImageToPptDetection[], pageWidth: number, pageHeight = 1000): ImageToPptDetection[] {
  return finalizeTextDetections(detections, pageWidth, pageHeight);
}

export async function detectTextRegions(
  canvas: HTMLCanvasElement,
  onProgress?: (label: string) => void
): Promise<ImageToPptDetection[]> {
  setOcrProgressHandler(onProgress ?? null);
  const worker = await getWorker();
  const prepared = makeOcrCanvas(canvas);
  const result = await worker.recognize(prepared.canvas);
  const detections = detectionsFromRecognize(
    result.data.lines ?? [],
    result.data.words ?? [],
    canvas.width,
    canvas.height,
    prepared.scale
  );
  setOcrProgressHandler(null);
  return finalizeTextDetections(detections, canvas.width, canvas.height);
}

export async function detectTextInRects(
  canvas: HTMLCanvasElement,
  rects: PixelRect[],
  onProgress?: (label: string) => void
): Promise<ImageToPptDetection[]> {
  if (!rects.length) return [];
  setOcrProgressHandler(onProgress ?? null);
  const worker = await getWorker();
  const detections: ImageToPptDetection[] = [];
  for (let i = 0; i < rects.length; i++) {
    const rect = rects[i];
    onProgress?.(`Checking missed text... ${i + 1}/${rects.length}`);
    const crop = document.createElement('canvas');
    crop.width = Math.max(8, Math.round(rect.width));
    crop.height = Math.max(8, Math.round(rect.height));
    const ctx = crop.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, crop.width, crop.height);
    ctx.drawImage(canvas, rect.x, rect.y, rect.width, rect.height, 0, 0, crop.width, crop.height);
    const prepared = makeOcrCanvas(crop);
    const result = await worker.recognize(prepared.canvas);
    const local = detectionsFromRecognize(
      result.data.lines ?? [],
      result.data.words ?? [],
      crop.width,
      crop.height,
      prepared.scale
    );
    for (const item of local) {
      detections.push({
        ...item,
        id: createLocalId('text'),
        bbox: {
          x: rect.x + item.bbox.x,
          y: rect.y + item.bbox.y,
          width: item.bbox.width,
          height: item.bbox.height,
        },
      });
    }
  }
  setOcrProgressHandler(null);
  return detections;
}

export function looksLikeTextBlob(
  bbox: PixelRect,
  area: number,
  pageWidth: number,
  pageHeight: number
): boolean {
  const boxArea = Math.max(1, bbox.width * bbox.height);
  const solidity = area / boxArea;
  const aspect = bbox.width / Math.max(1, bbox.height);
  if (solidity < 0.22 && aspect > 1.45) return false;
  return (
    bbox.height > pageHeight * 0.011 &&
    bbox.height < pageHeight * 0.08 &&
    bbox.width < pageWidth * 0.7 &&
    aspect > 0.14 &&
    aspect < 14 &&
    solidity > 0.22 &&
    solidity < 0.78
  );
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate?.();
  } catch {
    /* ignore */
  }
  workerPromise = null;
}
