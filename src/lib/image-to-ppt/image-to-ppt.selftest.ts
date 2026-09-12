import { groupNearbyComponents, labelConnectedComponents } from './components';
import { imageRectToContentPercent, hashString, padPageIndex, unionRects } from './geometry';
import { mergeGraphicDetections, splitGraphicDetection } from './pipeline';
import { looksLikePlausibleText, repairOcrText, explodeRepairedText, isLikelyWorksheetLabel, looksLikeGarbageOcr, finalizeTextDetections } from './ocr';
import { analyzeRegionShape, regionLooksPhotographic, vectorizeRegion } from './vectorize';
import type { ImageToPptDetection } from './types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const width = 40;
const height = 20;
const mask = new Uint8Array(width * height);
for (let y = 2; y <= 6; y++) {
  for (let x = 2; x <= 8; x++) mask[y * width + x] = 1;
}
for (let y = 2; y <= 6; y++) {
  for (let x = 11; x <= 16; x++) mask[y * width + x] = 1;
}
for (let y = 12; y <= 17; y++) {
  for (let x = 20; x <= 28; x++) mask[y * width + x] = 1;
}

const { components } = labelConnectedComponents(mask, width, height);
assert(components.length === 3, `expected 3 components, got ${components.length}`);

const groups = groupNearbyComponents(components, width, height);
assert(groups.length === 2, `nearby blobs should merge, got ${groups.length} groups`);

const geom = imageRectToContentPercent(
  { x: 0, y: 0, width: 100, height: 100 },
  100,
  100,
  816,
  1056,
  48
);
assert(Math.abs(geom.xPercent + (48 / (816 - 96)) * 100) < 0.2, 'full-page x maps through margins');
assert(geom.widthPercent > 100, 'full-page width exceeds content box');

const union = unionRects([
  { x: 0, y: 0, width: 10, height: 10 },
  { x: 8, y: 8, width: 10, height: 10 },
]);
assert(union.width === 18 && union.height === 18, 'unionRects');

assert(padPageIndex(7) === '007', 'page padding');
assert(hashString('abc') === hashString('abc'), 'stable hash');
assert(hashString('abc') !== hashString('abd'), 'distinct hash');

const detections: ImageToPptDetection[] = [
  {
    id: 'g1',
    kind: 'graphic',
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    parts: [{ id: 'p1', bbox: { x: 0, y: 0, width: 10, height: 10 }, area: 20 }],
  },
  {
    id: 'g2',
    kind: 'graphic',
    bbox: { x: 12, y: 0, width: 10, height: 10 },
    parts: [{ id: 'p2', bbox: { x: 12, y: 0, width: 10, height: 10 }, area: 20 }],
  },
];
const merged = mergeGraphicDetections(detections, ['g1', 'g2']);
assert(merged.length === 1, 'merge graphics');
assert(merged[0].bbox.width === 22, 'merged bbox width');
const split = splitGraphicDetection(merged, merged[0].id);
assert(split.length === 2, 'split restores parts');

assert(looksLikePlausibleText('Dentro', 88), 'spanish label is text');
assert(looksLikePlausibleText('Fuera', 48), 'low-confidence known label is kept');
assert(looksLikePlausibleText('ORIENTACIÓN VISUAL', 80), 'title is text');
assert(!looksLikePlausibleText('i! IR R a oe', 40), 'illustration noise is not text');
assert(!looksLikePlausibleText('||', 90), 'symbols are not text');
assert(isLikelyWorksheetLabel('Encima'), 'encima is a worksheet label');
assert(looksLikeGarbageOcr('Descripción el el el dibujo. con'), 'repeated tokens are garbage');
assert(!looksLikeGarbageOcr('Une la descripción con el dibujo.'), 'real instruction is not garbage');
assert(repairOcrText('dibujoDentro, fuera, encima') === 'dibujo\nDentro, fuera, encima', 'split smashed OCR');
const smashed = explodeRepairedText({
  id: 't1',
  kind: 'text',
  bbox: { x: 10, y: 20, width: 200, height: 18 },
  text: repairOcrText('Une la descripción con el dibujoDentro, fuera, encima'),
  fontSizePx: 16,
});
assert(smashed.length === 1, `one-line smash should stay one box, got ${smashed.length}`);
assert(/dibujo Dentro/i.test(smashed[0].text ?? ''), 'one-line smash keeps a space, not a second box');
const dupes = finalizeTextDetections(
  [
    { id: 'a', kind: 'text', bbox: { x: 10, y: 80, width: 80, height: 20 }, text: 'Dentro', confidence: 60 },
    { id: 'b', kind: 'text', bbox: { x: 12, y: 100, width: 40, height: 16 }, text: 'Dentro', confidence: 80 },
    { id: 'c', kind: 'text', bbox: { x: 10, y: 10, width: 200, height: 18 }, text: 'ORIENTACIÓN VISUAL', confidence: 85 },
    { id: 'd', kind: 'text', bbox: { x: 12, y: 12, width: 120, height: 16 }, text: 'ORIENTACIÓN', confidence: 70 },
  ],
  400,
  500
);
assert(dupes.filter((item) => item.text === 'Dentro').length === 1, 'keep one Dentro label');
assert(dupes.filter((item) => /ORIENTACI/i.test(item.text ?? '')).length === 1, 'keep one header title');

const frameW = 40;
const frameH = 18;
const frameMask = new Uint8Array(frameW * frameH);
for (let x = 1; x < frameW - 1; x++) {
  frameMask[1 * frameW + x] = 1;
  frameMask[(frameH - 2) * frameW + x] = 1;
}
for (let y = 1; y < frameH - 1; y++) {
  frameMask[y * frameW + 1] = 1;
  frameMask[y * frameW + (frameW - 2)] = 1;
}
const frameInk = frameMask.reduce((sum, v) => sum + v, 0);
const frameShape = analyzeRegionShape(frameMask, frameW, frameH, frameInk);
assert(frameShape.role === 'frame', `hollow box should be a frame, got ${frameShape.role}`);

function makeWhiteImage(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 250;
    data[i + 1] = 250;
    data[i + 2] = 248;
    data[i + 3] = 255;
  }
  return { data, width, height } as ImageData;
}

function setInk(image: ImageData, x: number, y: number, rgb = 18) {
  const p = (y * image.width + x) * 4;
  image.data[p] = rgb;
  image.data[p + 1] = rgb;
  image.data[p + 2] = rgb;
  image.data[p + 3] = 255;
}

const art = makeWhiteImage(80, 60);
for (let y = 8; y < 50; y++) {
  for (let x = 10; x < 12; x++) setInk(art, x, y);
  for (let x = 10; x < 40; x++) setInk(art, x, 8);
  setInk(art, 30 + (y % 7), y, 24 + (y % 5));
}
const traced = vectorizeRegion(art, { x: 8, y: 6, width: 36, height: 46 }, { r: 250, g: 250, b: 248 });
assert(traced && traced.svg.includes('<svg'), 'line art should vectorize to SVG');
assert(traced.role === 'art', `line art role should be art, got ${traced.role}`);
assert(traced.svg.includes('h') && traced.svg.includes('v'), 'line art should keep ink runs, not a filled silhouette');
assert(!regionLooksPhotographic(art, { x: 8, y: 6, width: 36, height: 46 }, { r: 250, g: 250, b: 248 }), 'grayscale line art is not a photo');

const boxImg = makeWhiteImage(48, 24);
for (let x = 4; x < 44; x++) {
  setInk(boxImg, x, 4);
  setInk(boxImg, x, 5);
  setInk(boxImg, x, 18);
  setInk(boxImg, x, 19);
}
for (let y = 4; y < 20; y++) {
  setInk(boxImg, 4, y);
  setInk(boxImg, 5, y);
  setInk(boxImg, 42, y);
  setInk(boxImg, 43, y);
}
const boxSvg = vectorizeRegion(boxImg, { x: 2, y: 2, width: 44, height: 20 }, { r: 250, g: 250, b: 248 });
assert(boxSvg, 'hollow box should vectorize');
assert(boxSvg.role !== 'fill', `hollow box must not become a solid fill, got ${boxSvg.role}`);
assert(
  boxSvg.svg.includes('fill="none"') || (boxSvg.svg.includes('h') && boxSvg.svg.includes('v')),
  'hollow box must keep a white interior'
);

console.log('image-to-ppt.selftest ok');
