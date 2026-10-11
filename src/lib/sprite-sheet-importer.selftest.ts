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
  tightInkBoxes,
  punchExteriorBackground,
  cropToIllustrationShape,
  cropMazeSlot,
  chooseMazeCropBoxes,
  captureShapesInPolygon,
  projectVisible,
  stampBufferIntoBox,
  autoCropBoxForBuffer,
  replaceSlotImage,
  scaleCropConfigToImage,
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

  const inkSheet: PixelBuffer = { data: new Uint8ClampedArray(120 * 40 * 4), width: 120, height: 40 };
  for (let y = 8; y < 22; y++) {
    for (let x = 8; x < 22; x++) {
      const i = (y * 120 + x) * 4;
      inkSheet.data[i] = 0;
      inkSheet.data[i + 1] = 0;
      inkSheet.data[i + 2] = 0;
      inkSheet.data[i + 3] = 255;
    }
  }
  for (let y = 12; y < 16; y++) {
    for (let x = 24; x < 28; x++) {
      const i = (y * 120 + x) * 4;
      inkSheet.data[i] = 0;
      inkSheet.data[i + 1] = 0;
      inkSheet.data[i + 2] = 0;
      inkSheet.data[i + 3] = 255;
    }
  }
  for (let y = 8; y < 22; y++) {
    for (let x = 80; x < 96; x++) {
      const i = (y * 120 + x) * 4;
      inkSheet.data[i] = 0;
      inkSheet.data[i + 1] = 0;
      inkSheet.data[i + 2] = 0;
      inkSheet.data[i + 3] = 255;
    }
  }
  const tight = tightInkBoxes(
    inkSheet,
    [
      { slotId: 'R1C1', name: 'left' },
      { slotId: 'R1C2', name: 'right' },
    ],
    2,
    1
  );
  assert(tight.length === 2, 'each illustration should get a crop box');
  assert(tight[0].x <= 8, `left crop should include a margin before the drawing, got ${tight[0].x}`);
  assert(tight[0].x + tight[0].w >= 28, `left crop should keep the disconnected detail, got ${tight[0].x + tight[0].w}`);
  assert(tight[0].x + tight[0].w <= 80, 'left crop must not include the next illustration');
  assert(tight[1].x >= 70 && tight[1].x <= 80, `right crop should start at that drawing, got ${tight[1].x}`);
  assert((tight[0].outline?.length ?? 0) >= 8, 'the selection outline should follow the drawing');
  const stacked: PixelBuffer = { data: new Uint8ClampedArray(40 * 100 * 4), width: 40, height: 100 };
  for (let y = 8; y < 28; y++) {
    for (let x = 8; x < 28; x++) {
      const i = (y * 40 + x) * 4;
      stacked.data[i + 3] = 255;
    }
  }
  for (let y = 60; y < 80; y++) {
    for (let x = 8; x < 28; x++) {
      const i = (y * 40 + x) * 4;
      stacked.data[i + 3] = 255;
    }
  }
  const stackedBoxes = tightInkBoxes(
    stacked,
    [
      { slotId: 'R1C1', name: 'top' },
      { slotId: 'R2C1', name: 'bottom' },
    ],
    1,
    2
  );
  const top = stackedBoxes.find((box) => box.slotId === 'R1C1');
  const bottom = stackedBoxes.find((box) => box.slotId === 'R2C1');
  assert(top != null && bottom != null, 'stacked drawings should stay separate crops');
  assert(top.y + top.h < 50, `top crop must not include the drawing below, got bottom ${top.y + top.h}`);
  assert(bottom.y > 40, `bottom crop must not include the drawing above, got top ${bottom.y}`);

  const shared: PixelBuffer = { data: new Uint8ClampedArray(120 * 40 * 4), width: 120, height: 40 };
  const paintShared = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) shared.data[(y * 120 + x) * 4 + 3] = 255;
    }
  };
  paintShared(8, 8, 28, 30);
  paintShared(36, 8, 58, 30);
  const sharedBoxes = tightInkBoxes(
    shared,
    [
      { slotId: 'R1C1', name: 'saw' },
      { slotId: 'R1C2', name: 'box' },
    ],
    2,
    1
  );
  const saw = sharedBoxes.find((box) => box.x < 30);
  const wood = sharedBoxes.find((box) => box.x >= 30);
  assert(saw != null && wood != null, 'a second drawing in the same grid cell still gets its own crop');
  assert((wood.outline?.length ?? 0) >= 8, 'the wood box keeps its own outline');

  const shaped: PixelBuffer = { data: new Uint8ClampedArray(48 * 36 * 4), width: 48, height: 36 };
  for (let y = 10; y < 26; y++) {
    for (let x = 16; x < 32; x++) {
      const i = (y * 48 + x) * 4;
      shaped.data[i] = 255;
      shaped.data[i + 1] = 255;
      shaped.data[i + 2] = 255;
      shaped.data[i + 3] = 255;
    }
  }
  for (let y = 10; y < 26; y++) {
    for (let x = 16; x < 32; x++) {
      if (x !== 16 && x !== 31 && y !== 10 && y !== 25) continue;
      const i = (y * 48 + x) * 4;
      shaped.data[i] = 0;
      shaped.data[i + 1] = 0;
      shaped.data[i + 2] = 0;
      shaped.data[i + 3] = 255;
    }
  }
  for (let y = 2; y < 8; y++) {
    for (let x = 2; x < 8; x++) {
      const i = (y * 48 + x) * 4;
      shaped.data[i] = 0;
      shaped.data[i + 1] = 0;
      shaped.data[i + 2] = 0;
      shaped.data[i + 3] = 255;
    }
  }
  const separated: PixelBuffer = { data: new Uint8ClampedArray(120 * 36 * 4), width: 120, height: 36 };
  const paint = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * 120 + x) * 4;
        separated.data[i] = 0;
        separated.data[i + 1] = 0;
        separated.data[i + 2] = 0;
        separated.data[i + 3] = 255;
      }
    }
  };
  paint(4, 8, 18, 22);
  paint(48, 8, 62, 22);
  paint(96, 8, 110, 22);
  const lasso = [40, 2, 70, 2, 70, 30, 40, 30];
  const captured = captureShapesInPolygon(separated, lasso);
  assert(captured.length === 1, `the lasso should capture one drawing, got ${captured.length}`);
  assert(captured[0].bounds.x >= 40 && captured[0].bounds.x < 70, 'the captured drawing is the one inside the lasso');
  const linked: PixelBuffer = { data: new Uint8ClampedArray(160 * 40 * 4), width: 160, height: 40 };
  const paintLinked = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * 160 + x) * 4;
        linked.data[i + 3] = 255;
      }
    }
  };
  paintLinked(4, 8, 24, 28);
  for (let x = 24; x < 100; x++) linked.data[(18 * 160 + x) * 4 + 3] = 255;
  paintLinked(100, 8, 124, 28);
  const partial = captureShapesInPolygon(linked, [88, 2, 136, 2, 136, 36, 88, 36]);
  assert(partial.length === 1, `a circled part of a joined drawing should be captured, got ${partial.length}`);
  assert(partial[0].bounds.x > 40, 'the circled part is kept');
  assert(partial[0].bounds.x + partial[0].bounds.w < 150, 'the circled part does not swallow the far drawing');
  assert(partial[0].bounds.x > 24, 'the other end of the joined drawing stays out of the selection');
  const joined = cropToIllustrationShape(separated, [
    [4, 8, 18, 8, 18, 22, 4, 22],
    lasso,
  ]);
  const alphaAt = (x: number, y: number) => joined.data[(y * 120 + x) * 4 + 3];
  assert(alphaAt(10, 14) === 255, 'the original shape stays visible');
  assert(alphaAt(54, 14) === 255, 'the shape inside the lasso is added');
  assert(alphaAt(102, 14) === 0, 'a drawing outside the lasso stays transparent');

  const croppedShape = cropToIllustrationShape(shaped);
  const outside = (2 * 48 + 2) * 4 + 3;
  const inside = (16 * 48 + 22) * 4 + 3;
  const border = (4 * 48 + 40) * 4 + 3;
  assert(croppedShape.data[outside] === 0, 'a neighboring drawing inside the rectangle is removed');
  assert(croppedShape.data[inside] === 255, 'the fill inside the illustration shape stays visible');
  assert(croppedShape.data[border] === 0, 'the rectangle outside the shape stays transparent');

  const manual: PixelBuffer = { data: new Uint8ClampedArray(100 * 60 * 4), width: 100, height: 60 };
  for (let i = 0; i < manual.data.length; i += 4) {
    manual.data[i] = 255;
    manual.data[i + 1] = 255;
    manual.data[i + 2] = 255;
    manual.data[i + 3] = 255;
  }
  for (let y = 10; y < 34; y++) {
    for (let x = 8; x < 28; x++) {
      const i = (y * 100 + x) * 4;
      manual.data[i] = 0;
      manual.data[i + 1] = 0;
      manual.data[i + 2] = 0;
    }
  }
  for (let y = 12; y < 40; y++) {
    for (let x = 50; x < 80; x++) {
      const i = (y * 100 + x) * 4;
      const edge = x < 53 || y < 15 || x >= 77 || y >= 37;
      manual.data[i] = edge ? 0 : 252;
      manual.data[i + 1] = edge ? 0 : 248;
      manual.data[i + 2] = edge ? 0 : 240;
    }
  }
  const exact = cropMazeSlot(manual, {
    slotId: 'R1C1',
    x: 0,
    y: 0,
    w: 100,
    h: 60,
    outline: [8, 10, 28, 10, 28, 34, 8, 34],
    includePolygons: [[46, 8, 86, 8, 86, 46, 46, 46]],
  });
  const manualAt = (x: number, y: number) => {
    const i = (y * 100 + x) * 4;
    return exact.data[i + 3];
  };
  assert(manualAt(18, 22) === 255, 'the image already selected stays in the crop');
  assert(manualAt(65, 26) === 255, 'pale artwork inside the drawn line is kept exactly');
  assert(exact.data[(26 * 100 + 65) * 4] === 252, 'the drawn area keeps the original pixels');
  assert(manualAt(51, 20) === 255, 'the border inside the drawn line is kept');
  assert(manualAt(38, 20) === 0, 'paper outside the drawn line is removed');
  assert(manualAt(2, 2) === 0, 'the rest of the sheet outside the selection is removed');

  const subtracted = cropMazeSlot(manual, {
    slotId: 'R1C1',
    x: 0,
    y: 0,
    w: 100,
    h: 60,
    outline: [8, 10, 28, 10, 28, 34, 8, 34],
    includePolygons: [[46, 8, 86, 8, 86, 46, 46, 46]],
    excludePolygons: [[54, 16, 74, 16, 74, 34, 54, 34]],
  });
  const subtractedAt = (x: number, y: number) => subtracted.data[(y * 100 + x) * 4 + 3];
  assert(subtractedAt(18, 22) === 255, 'subtract keeps parts that were not drawn over');
  assert(subtractedAt(65, 26) === 0, 'subtract removes the selected part');
  assert(subtractedAt(51, 20) === 255, 'subtract leaves the rest of the added part');

  const keptEdits = chooseMazeCropBoxes(
    [
      {
        slotId: 'R1C1',
        x: 2,
        y: 3,
        w: 18,
        h: 20,
        includePolygons: [[4, 6, 16, 6, 16, 18, 4, 18]],
      },
    ],
    [{ slotId: 'R1C1', x: 40, y: 40, w: 10, h: 10 }],
    [{ slotId: 'R1C1', name: 'saw' }]
  );
  assert(keptEdits[0].x === 2 && keptEdits[0].includePolygons?.[0][0] === 4, 'saved crop edits stay when the sheet is opened again');
  const firstVisit = chooseMazeCropBoxes([], [{ slotId: 'R1C1', x: 8, y: 8, w: 12, h: 12 }], [{ slotId: 'R1C1', name: 'saw' }]);
  assert(firstVisit[0].x === 8, 'a new sheet still uses automatic boxes');

  const punched = punchExteriorBackground(inkSheet);
  assert(punched.data[3] === 0, 'the surrounding transparent area stays transparent');
  assert(punched.data[(10 * 120 + 10) * 4 + 3] === 255, 'the illustration itself stays opaque');

  const stampDest = { data: new Uint8ClampedArray(20 * 10 * 4), width: 20, height: 10 };
  const stamp = { data: new Uint8ClampedArray(4 * 4 * 4), width: 4, height: 4 };
  for (let i = 0; i < stamp.data.length; i += 4) {
    stamp.data[i] = 10;
    stamp.data[i + 1] = 20;
    stamp.data[i + 2] = 30;
    stamp.data[i + 3] = 255;
  }
  stampBufferIntoBox(stampDest, stamp, { x: 4, y: 2, w: 6, h: 4 });
  const stamped = (2 * 20 + 4) * 4;
  assert(stampDest.data[stamped] === 10 && stampDest.data[stamped + 3] === 255, 'a replaced image is drawn onto the sheet');
  assert(stampDest.data[3] === 0, 'pixels outside the replaced box stay unchanged');

  const paddedSubject: PixelBuffer = { data: new Uint8ClampedArray(80 * 80 * 4), width: 80, height: 80 };
  for (let y = 35; y < 45; y++) {
    for (let x = 35; x < 45; x++) {
      const i = (y * 80 + x) * 4;
      paddedSubject.data[i] = 20;
      paddedSubject.data[i + 1] = 20;
      paddedSubject.data[i + 2] = 20;
      paddedSubject.data[i + 3] = 255;
    }
  }
  const auto = autoCropBoxForBuffer(paddedSubject);
  assert(auto.w < 40 && auto.h < 40, 'auto-crop hugs the new subject instead of the full canvas');
  assert(auto.w > 10 && auto.h > 10, 'auto-crop keeps a small safe pad around the subject');
  assert(auto.x > 20 && auto.y > 20, 'auto-crop starts near the new subject, not at the old origin');

  const twoSlotSheet: PixelBuffer = { data: new Uint8ClampedArray(100 * 50 * 4), width: 100, height: 50 };
  for (let y = 4; y < 46; y++) {
    for (let x = 4; x < 46; x++) {
      const i = (y * 100 + x) * 4;
      twoSlotSheet.data[i] = 30;
      twoSlotSheet.data[i + 1] = 30;
      twoSlotSheet.data[i + 2] = 30;
      twoSlotSheet.data[i + 3] = 255;
    }
  }
  for (let y = 10; y < 40; y++) {
    for (let x = 60; x < 90; x++) {
      const i = (y * 100 + x) * 4;
      twoSlotSheet.data[i] = 80;
      twoSlotSheet.data[i + 1] = 80;
      twoSlotSheet.data[i + 2] = 80;
      twoSlotSheet.data[i + 3] = 255;
    }
  }
  const rightBefore = twoSlotSheet.data[(20 * 100 + 70) * 4];
  const slots = [
    { slotId: 'start', name: 'Start' },
    { slotId: 'end', name: 'End' },
  ];
  const oldStartBox = { slotId: 'start', x: 0, y: 0, w: 50, h: 50 };
  const replaced = replaceSlotImage(
    twoSlotSheet,
    paddedSubject,
    'start',
    slots,
    2,
    1,
    oldStartBox
  );
  assert(replaced.box.slotId === 'start', 'only the replaced slot gets a new crop box');
  assert(replaced.box.w < 40 && replaced.box.h < 40, 'the new crop uses the replacement subject size');
  assert(replaced.box.w !== oldStartBox.w || replaced.box.h !== oldStartBox.h, 'old crop width/height are discarded');
  assert(replaced.box.x !== oldStartBox.x || replaced.box.y !== oldStartBox.y || replaced.box.w !== oldStartBox.w, 'old crop coordinates are not reused');
  assert(replaced.sheet.data[(20 * 100 + 70) * 4] === rightBefore, 'the other slot image stays unchanged');

  const legacy = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [
        { slotId: 'R1C1', x: 20, y: 16, w: 200, h: 120, includePolygons: [[20, 16, 220, 16, 220, 136, 20, 136]] },
        { slotId: 'R5C4', x: 1040, y: 640, w: 220, h: 140 },
      ],
    },
    2560,
    1600
  );
  assert(Math.abs(legacy.boxes![0].x - 40) < 1, 'legacy 1280 crop boxes scale onto the full sheet');
  assert(Math.abs(legacy.boxes![0].w - 400) < 1, 'legacy 1280 crop widths scale onto the full sheet');
  assert(legacy.sourceWidth === 2560 && legacy.sourceHeight === 1600, 'crop settings remember the loaded sheet size');
  const stored = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [{ slotId: 'R1C1', x: 100, y: 50, w: 40, h: 20 }],
      sourceWidth: 1280,
      sourceHeight: 800,
    },
    2560,
    1600
  );
  assert(stored.boxes![0].x === 200 && stored.boxes![0].w === 80, 'saved crop pixel size maps boxes onto the new sheet');
  const stampedWrong = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [
        { slotId: 'R1C1', x: 20, y: 16, w: 200, h: 120, outline: [20, 16, 220, 16, 220, 136, 20, 136] },
        { slotId: 'R5C4', x: 1040, y: 640, w: 220, h: 140 },
      ],
      sourceWidth: 2560,
      sourceHeight: 1600,
    },
    2560,
    1600
  );
  assert(
    Math.abs(stampedWrong.boxes![0].x - 40) < 1 && Math.abs(stampedWrong.boxes![0].outline![0] - 40) < 1,
    'a full-size stamp with 1280 crop boxes still remaps the outline onto the sheet'
  );
  const tightFullRes = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [{ slotId: 'R1C1', x: 80, y: 60, w: 140, h: 110 }],
      sourceWidth: 2560,
      sourceHeight: 1600,
    },
    2560,
    1600
  );
  assert(
    Math.abs(tightFullRes.boxes![0].x - 80) < 1 && Math.abs(tightFullRes.boxes![0].w - 140) < 1,
    'tight full-resolution crops are not treated as old 1280 boxes'
  );

  console.log('sprite-sheet-importer.selftest ok');
}

run();
