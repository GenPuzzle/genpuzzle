import {
  anyBoxesOverlap,
  autoFixCrop,
  buildArtworkMask,
  buildAnalysisCache,
  buildSlotBoxes,
  computeSmartCrop,
  DEFAULT_CROP_CONFIG,
  detectConnectedComponents,
  findSafeSeparator,
  grayscaleBuffer,
  inferSheetGrid,
  packedSheetGrid,
  resolveSheetGrid,
  buildEqualSlotBoxes,
  boxesAreImplausible,
  cropBoxesForItems,
  projectVisible,
  type PixelBuffer,
} from './sprite-sheet-importer';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function makeSheet(): PixelBuffer {
  const width = 360;
  const height = 360;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const colors: Array<[number, number, number]> = [
    [220, 40, 40],
    [40, 180, 60],
    [40, 80, 220],
    [220, 180, 40],
    [160, 40, 200],
    [40, 200, 200],
    [220, 100, 40],
    [80, 80, 80],
    [40, 120, 80],
  ];
  // Artwork is offset so equal 33%/66% cuts (x=120, 240) pass through the squares.
  // True empty gutters: x 140–170 and 280–300.
  const x0 = [20, 170, 300];
  const y0 = [20, 170, 300];
  const sizes = [120, 110, 50];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const [r, g, b] = colors[row * 3 + col];
      for (let y = y0[row]; y < y0[row] + sizes[row]; y++) {
        for (let x = x0[col]; x < x0[col] + sizes[col]; x++) {
          const i = (y * width + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width, height };
}

function makeSheet2x3(): PixelBuffer {
  const width = 360;
  const height = 240;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const colors: Array<[number, number, number]> = [
    [220, 40, 40],
    [40, 180, 60],
    [40, 80, 220],
    [220, 180, 40],
    [160, 40, 200],
    [40, 200, 200],
  ];
  const x0 = [15, 135, 255];
  const y0 = [15, 135];
  const size = 90;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const [r, g, b] = colors[row * 3 + col];
      for (let y = y0[row]; y < y0[row] + size; y++) {
        for (let x = x0[col]; x < x0[col] + size; x++) {
          const i = (y * width + x) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 255;
        }
      }
    }
  }
  return { data, width, height };
}

function run() {
  const sheet = makeSheet();
  const mask = buildArtworkMask(sheet, 24);
  const { projX } = projectVisible(mask, sheet.width, sheet.height);

  assert(mask[5 * sheet.width + 5] === 0, 'corner background should not be treated as artwork');
  assert(mask[20 * sheet.width + 20] === 1, 'artwork should be detected');
  assert(sheet.data[(5 * sheet.width + 5) * 4 + 3] === 255, 'original pixels must stay opaque');

  const comps = detectConnectedComponents(mask, sheet.width, sheet.height, 8);
  assert(comps.length === 9, `expected 9 components, got ${comps.length}`);

  const equalCut = sheet.width / 3;
  assert(projX[Math.round(equalCut)] > 10, 'equal 33% cut should pass through artwork');

  const gutter = findSafeSeparator(projX, equalCut, 80, 2, 8, 20, sheet.width - 20);
  assert(gutter.position > 140 && gutter.position < 170, `vertical gutter should sit in 140–170, got ${gutter.position}`);

  const items = Array.from({ length: 9 }, (_, i) => ({ slotId: `C${String(i + 1).padStart(2, '0')}`, name: `Char ${i + 1}` }));
  const cache = buildAnalysisCache(sheet, DEFAULT_CROP_CONFIG);
  const crop = autoFixCrop(cache, items, 3, 3, DEFAULT_CROP_CONFIG);
  assert(!crop.hasUnsafe, `smart crop should be safe, separators=${JSON.stringify(crop.separators)}`);
  assert(crop.xs.length === 4, 'expected 4 vertical bounds');
  const v1 = crop.xs[1];
  const v2 = crop.xs[2];
  assert(v1 > 135 && v1 < 175, `first vertical should be in gutter, got ${v1}`);
  assert(v2 > 270 && v2 < 305, `second vertical should be in gutter, got ${v2}`);

  const naive = computeSmartCrop(cache, items, 3, 3, DEFAULT_CROP_CONFIG, 1);
  assert(naive.xs[1] !== equalCut, 'crop line must not stay on the equal-size split');

  const boxes = buildSlotBoxes(cache, items, 3, 3, crop.xs, crop.ys, 16);
  assert(boxes.length === 9, `expected 9 crop boxes, got ${boxes.length}`);
  assert(!anyBoxesOverlap(boxes), '3x3 crop boxes must not overlap');
  const first = boxes[0];
  const last = boxes[8];
  assert(first.h > last.h, `taller artwork should get a taller box, got ${first.h} vs ${last.h}`);
  assert(first.slotId !== last.slotId, 'each box belongs to one slot');

  const sheet2 = makeSheet2x3();
  const items9 = Array.from({ length: 9 }, (_, i) => ({
    slotId: `C${String(i + 1).padStart(2, '0')}`,
    name: `Char ${i + 1}`,
  }));
  const cache2 = buildAnalysisCache(sheet2, DEFAULT_CROP_CONFIG);
  assert(cache2.components.length === 6, `expected 6 portraits, got ${cache2.components.length}`);
  const crop2 = autoFixCrop(cache2, items9, 3, 3, DEFAULT_CROP_CONFIG);
  const boxes2 = buildSlotBoxes(cache2, items9, 3, 3, crop2.xs, crop2.ys, 16);
  assert(boxes2.length === 6, `2x3 sheet should create 6 boxes, got ${boxes2.length}`);
  assert(!anyBoxesOverlap(boxes2), 'auto crop boxes must not overlap');
  for (let i = 0; i < boxes2.length; i++) {
    for (let j = i + 1; j < boxes2.length; j++) {
      const a = boxes2[i];
      const b = boxes2[j];
      assert(a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5, `boxes ${a.slotId} and ${b.slotId} overlap`);
    }
  }

  const gray = grayscaleBuffer(sheet);
  const art = (20 * sheet.width + 20) * 4;
  assert(gray.data[art] === gray.data[art + 1] && gray.data[art + 1] === gray.data[art + 2], 'grayscale should equalize RGB');
  assert(sheet.data[art] !== sheet.data[art + 1] || sheet.data[art] !== sheet.data[art + 2], 'original artwork should stay in color');

  const packed6 = packedSheetGrid(6);
  assert(packed6.rows === 2 && packed6.columns === 3, `6 items should pack 2x3, got ${packed6.rows}x${packed6.columns}`);
  const packed7 = packedSheetGrid(7);
  assert(packed7.rows === 3 && packed7.columns === 3, `7 items should pack 3x3, got ${packed7.rows}x${packed7.columns}`);

  const layout6wide = inferSheetGrid(900, 600, 6);
  assert(layout6wide.rows === 2 && layout6wide.columns === 3, `6 items on 3:2 should be 2x3, got ${layout6wide.rows}x${layout6wide.columns}`);
  const layout7sq = inferSheetGrid(900, 900, 7);
  assert(layout7sq.rows === 3 && layout7sq.columns === 3, `7 items on a square should be 3x3, got ${layout7sq.rows}x${layout7sq.columns}`);
  assert(layout7sq.rows * layout7sq.columns >= 7, 'inferred grid must hold every item');
  const layout9sq = inferSheetGrid(900, 900, 9);
  assert(layout9sq.rows === 3 && layout9sq.columns === 3, `square sheet should infer 3x3, got ${layout9sq.rows}x${layout9sq.columns}`);
  const layout9wide = inferSheetGrid(900, 600, 9);
  assert(
    layout9wide.rows * layout9wide.columns >= 9,
    `9 items cannot fit in ${layout9wide.rows}x${layout9wide.columns}`
  );

  const hinted7 = resolveSheetGrid(900, 900, 7, 3, 3);
  assert(hinted7.rows === 3 && hinted7.columns === 3, `hinted 3x3 for 7 rooms should stick, got ${hinted7.rows}x${hinted7.columns}`);
  const badHint = resolveSheetGrid(900, 900, 7, 2, 2);
  assert(badHint.rows * badHint.columns >= 7, `2x2 hint for 7 items must be rejected, got ${badHint.rows}x${badHint.columns}`);

  const sevenItems = Array.from({ length: 7 }, (_, i) => ({
    slotId: `R${String(i + 1).padStart(2, '0')}`,
    name: `Room ${i + 1}`,
  }));
  const sevenBoxes = buildEqualSlotBoxes(sevenItems, 900, 900, 2, 2);
  assert(sevenBoxes.length === 7, `7 rooms must get 7 crop boxes even from a 2x2 hint, got ${sevenBoxes.length}`);
  assert(!anyBoxesOverlap(sevenBoxes), '7 room crop boxes must not overlap');
  assert(!boxesAreImplausible(sevenBoxes, 900, 900), 'packed 3x3 room boxes should be plausible');

  const cropped = cropBoxesForItems(sevenItems, 900, 900, 3, 3, [], [
    { slotId: 'R01', x: 0, y: 0, w: 450, h: 450 },
    { slotId: 'R02', x: 450, y: 0, w: 450, h: 450 },
    { slotId: 'R03', x: 0, y: 450, w: 450, h: 450 },
    { slotId: 'R04', x: 450, y: 450, w: 450, h: 450 },
  ]);
  assert(cropped.length === 7, `stale 2x2 crop must be replaced with 7 boxes, got ${cropped.length}`);

  const roomItems = Array.from({ length: 9 }, (_, i) => ({ slotId: `R${String(i + 1).padStart(2, '0')}`, name: `Room ${i + 1}` }));
  const roomBoxes = buildEqualSlotBoxes(roomItems, 900, 600, 3, 2);
  assert(roomBoxes.length === 9, `room grid should crop every item, got ${roomBoxes.length}`);
  assert(!anyBoxesOverlap(roomBoxes), 'room grid boxes must not overlap');
  assert(!boxesAreImplausible(roomBoxes, 900, 600), 'full-cell room boxes should be plausible');
  assert(boxesAreImplausible([{ slotId: 'R01', x: 10, y: 10, w: 12, h: 12 }], 900, 600), 'tiny room boxes should be rejected');

  console.log('sprite-sheet-importer.selftest ok');
}

run();
