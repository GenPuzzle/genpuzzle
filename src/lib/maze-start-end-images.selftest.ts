import { getDefaultGenericPuzzleSettings, normalizeGenericPuzzleSettings } from './generic-puzzle-settings';
import {
  assessSheetBackground,
  buildMazeStartEndPrompt,
  ensureMazeStartEndPairs,
  extractMazeStartEndSheet,
  MAZE_PAIRS_PER_SHEET,
  MAZE_SHEET_COLUMNS,
  MAZE_SHEET_ROWS,
  MAZE_SOLUTION_IMAGE_SCALE,
  mazeStartEndImageScale,
  normalizeMazeStartEndImages,
  pairAddress,
  placeMazeStartEndImages,
  plannedPair,
  mazeCountForUploadedSheets,
  mazeCountForReplacedSheets,
  mazeSheetIndexesForUploads,
  sheetCountForMazes,
  shouldDrawMazeStartEndImages,
  sliceMazeStartEndImages,
  stripMazeStartEndImagePayloads,
  type MazeStartEndPair,
} from './maze-start-end-images';
import { parseGpProjectJson } from './project-file';
import { buildMazeElements } from './resolved-layout/maze-elements';
import { DEFAULT_CROP_CONFIG, scaleCropConfigToImage, type PixelBuffer } from './sprite-sheet-importer';
import type { MazePuzzle } from './puzzles/types';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function blank(width: number, height: number): PixelBuffer {
  return { data: new Uint8ClampedArray(width * height * 4), width, height };
}

function paint(buf: PixelBuffer, x: number, y: number, r: number, g: number, b: number, a = 255) {
  if (x < 0 || y < 0 || x >= buf.width || y >= buf.height) return;
  const i = (y * buf.width + x) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = a;
}

function fillRect(buf: PixelBuffer, x: number, y: number, w: number, h: number, color: [number, number, number, number]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) paint(buf, xx, yy, color[0], color[1], color[2], color[3]);
  }
}

/** 4×5 cells with transparent gutters. Each cell has two separated ink marks. */
function goodSheet(): { buf: PixelBuffer; cell: number; gutter: number } {
  const cell = 16;
  const gutter = 6;
  const width = MAZE_SHEET_COLUMNS * cell + (MAZE_SHEET_COLUMNS - 1) * gutter;
  const height = MAZE_SHEET_ROWS * cell + (MAZE_SHEET_ROWS - 1) * gutter;
  const buf = blank(width, height);
  for (let row = 0; row < MAZE_SHEET_ROWS; row++) {
    for (let col = 0; col < MAZE_SHEET_COLUMNS; col++) {
      const x = col * (cell + gutter) + 4;
      const y = row * (cell + gutter) + 4;
      fillRect(buf, x, y, 3, 3, [0, 0, 0, 255]);
      fillRect(buf, x + 6, y + 6, 2, 2, [0, 0, 0, 255]);
    }
  }
  return { buf, cell, gutter };
}

function maze(start: { row: number; col: number }, end: { row: number; col: number }, openEnd: 'bottom' | 'left' | 'right'): MazePuzzle {
  const grid = [
    [false, false, false, false, false],
    [true, true, false, true, true],
    [true, false, false, false, true],
    [true, true, false, true, true],
    [false, false, false, false, false],
  ];
  grid[start.row][start.col] = false;
  grid[end.row][end.col] = false;
  if (openEnd === 'bottom') grid[Math.min(4, end.row + 1)][end.col] = false;
  if (openEnd === 'left') grid[end.row][Math.max(0, end.col - 1)] = false;
  if (openEnd === 'right') grid[end.row][Math.min(4, end.col + 1)] = false;
  if (start.row > 0) grid[start.row - 1][start.col] = false;
  return {
    type: 'maze',
    grid,
    start,
    end,
    size: 'small',
    puzzleIndexInDocument: 0,
  };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function runMazeStartEndImageChecks(): void {
  assert(sheetCountForMazes(10) === 1, '10 mazes use one sheet');
  assert(sheetCountForMazes(11) === 2, '11 mazes use two sheets');
  assert(
    mazeSheetIndexesForUploads(['sheet-1.png', 'sheet-2.png', 'sheet-3.png', 'sheet-4.png']).join(',') === '0,1,2,3',
    'numbered sheet files keep their sheet numbers'
  );
  assert(
    mazeCountForUploadedSheets(['a.png', 'b.png', 'c.png', 'd.png'], 10) === 40,
    'four uploaded sheets cover 40 maze pages'
  );
  assert(
    mazeCountForReplacedSheets(['a.png', 'b.png']) === 20,
    'replacing sheets uses only the new files, not the old sheet count'
  );
  const first = pairAddress(0);
  const second = pairAddress(1);
  const third = pairAddress(2);
  assert(first.row === 0 && first.startCol === 0 && first.endCol === 1, 'first pair is columns 1 and 2');
  assert(second.row === 0 && second.startCol === 2 && second.endCol === 3, 'second pair is columns 3 and 4');
  assert(third.row === 1 && third.startCol === 0 && third.endCol === 1, 'third pair starts the next row');
  assert(plannedPair('animals', 0).startSubject === 'rabbit', 'first start subject stays rabbit');
  assert(plannedPair('animals', 0).endSubject === 'carrot', 'first end subject stays carrot');
  assert(plannedPair('', 1).startSubject === 'bee' && plannedPair('', 1).endSubject === 'flower', 'second pair is bee then flower');

  const pairs = ensureMazeStartEndPairs([], 'forest', 12);
  assert(pairs.length === 12, 'pair list matches the maze count');
  const locked: MazeStartEndPair[] = pairs.map((pair, index) =>
    index === 0 ? { ...pair, startImage: 'data:image/png;base64,aaa', startSubject: 'rabbit' } : pair
  );
  const again = ensureMazeStartEndPairs(locked, 'space', 12);
  assert(again[0].startSubject === 'rabbit' && again[0].startImage.includes('aaa'), 'saved pair assignment is not reshuffled');
  const grown = ensureMazeStartEndPairs(again, 'forest', 13);
  assert(grown.length === 13 && grown[0].startImage.includes('aaa'), 'adding a maze appends a pair');

  const settings = normalizeGenericPuzzleSettings(
    {
      core: {
        mazeStartEndImages: {
          enabled: true,
          theme: 'forest',
          style: 'coloring-page',
          method: 'manual',
          pairs: grown,
          issues: [],
        },
      },
    },
    'maze'
  );
  const reopened = normalizeGenericPuzzleSettings(settings, 'maze');
  assert(reopened.core.mazeStartEndImages.enabled === true, 'enabled flag survives reopening');
  assert(reopened.core.mazeStartEndImages.pairs[0].startImage === grown[0].startImage, 'extracted asset survives reopening');
  assert(reopened.core.mazeStartEndImages.pairs[0].startSubject === 'rabbit', 'pair order survives reopening');
  const enhancedPair = normalizeMazeStartEndImages({
    enabled: true,
    pairs: [
      {
        ...grown[0],
        startImage: 'data:image/png;base64,enhanced',
        endImage: 'data:image/png;base64,enhanced-end',
        startSourceImage: 'data:image/png;base64,source',
        endSourceImage: 'data:image/png;base64,source-end',
        startAutoEnhanced: true,
        endAutoEnhanced: true,
        startSvg: '<svg><path d="M0 0"/></svg>',
        endSvg: '<svg><path d="M1 1"/></svg>',
        startWidth: 40,
        startHeight: 40,
        endWidth: 40,
        endHeight: 40,
      },
    ],
  }).pairs[0];
  assert(enhancedPair.startAutoEnhanced && enhancedPair.startSourceImage.includes('source'), 'enhanced crops keep a link to the original');
  assert(enhancedPair.startSvg.includes('<path') && enhancedPair.endSvg.includes('<path'), 'enhanced SVG markup is stored with the project');
  assert(reopened.core.mazeStartEndImages.style === 'coloring-page', 'coloring page style is the stored default');

  const withCrops = normalizeMazeStartEndImages({
    enabled: true,
    sheetCrops: {
      1: {
        boxes: [{ slotId: 'R1C1', x: 6, y: 8, w: 24, h: 26, includePolygons: [[6, 8, 28, 8, 28, 32, 6, 32]] }],
        gridCols: 4,
        gridRows: 5,
      },
    },
  });
  assert(withCrops.sheetCrops[1].boxes[0].x === 6, 'applied crop boxes are stored with the project');
  assert(withCrops.sheetCrops[1].boxes[0].includePolygons?.[0].length === 8, 'manual crop areas are stored with the project');
  const withExclude = normalizeMazeStartEndImages({
    enabled: true,
    sheetCrops: {
      1: {
        boxes: [
          {
            slotId: 'R1C1',
            x: 6,
            y: 8,
            w: 24,
            h: 26,
            excludePolygons: [[10, 12, 18, 12, 18, 20, 10, 20]],
          },
        ],
      },
    },
  });
  assert(withExclude.sheetCrops[1].boxes[0].excludePolygons?.[0].length === 8, 'removed crop areas are stored with the project');
  const reopenedCrops = normalizeMazeStartEndImages(withCrops);
  assert(reopenedCrops.sheetCrops[1].boxes[0].w === 24, 'stored crop edits survive reopening');
  const fromGpFile = normalizeMazeStartEndImages(
    JSON.parse(JSON.stringify({ mazeStartEndImages: withCrops })).mazeStartEndImages
  );
  assert(
    fromGpFile.sheetCrops[1].boxes[0].x === 6 && fromGpFile.sheetCrops[1].boxes[0].includePolygons?.[0].length === 8,
    '.gp project files keep maze crop boxes and lasso areas'
  );
  const withSources = normalizeMazeStartEndImages({
    enabled: true,
    sheetSources: { 0: 'data:image/png;base64,aaa' },
  });
  assert(withSources.sheetSources[0].startsWith('data:image/'), 'applied sheets stay available for Edit cropping');

  const prompt = buildMazeStartEndPrompt({
    theme: 'forest',
    style: 'coloring-page',
    sheetIndex: 0,
    sheetCount: 2,
    pairs,
  });
  assert(prompt.includes(`exactly ${MAZE_SHEET_COLUMNS} columns and ${MAZE_SHEET_ROWS} rows`), 'prompt states the sheet grid');
  assert(prompt.includes('genuinely transparent background'), 'prompt requires transparency');
  assert(prompt.includes('No visible grid lines'), 'prompt forbids labels and grid lines');
  assert(prompt.includes('clean black outlines'), 'coloring page style asks for black outlines');
  assert(prompt.includes('Row 1, column 1 (start of pair 1): rabbit'), 'prompt names the first start cell');
  assert(prompt.includes('Row 1, column 2 (end of pair 1): carrot'), 'prompt keeps start then end order');

  const { buf } = goodSheet();
  const extracted = extractMazeStartEndSheet(buf);
  assert(extracted.ok, `a spaced transparent sheet should extract: ${extracted.issues.map((issue) => issue.message).join('; ')}`);
  assert(extracted.slots.length === 20, 'extraction keeps 20 cells');
  assert(extracted.slots.every((slot) => slot.image), 'every cell keeps its illustration');
  const firstCrop = extracted.slots[0].image!;
  let ink = 0;
  for (let i = 3; i < firstCrop.data.length; i += 4) if (firstCrop.data[i] > 24) ink += 1;
  assert(ink >= 13, 'a crop keeps both disconnected parts of one illustration');
  const neighbor = extracted.slots[1].image!;
  assert(firstCrop.width < 16 && neighbor.width < 16, 'crops stay inside their own cells');

  const crossing = goodSheet().buf;
  fillRect(crossing, 14, 4, 8, 3, [0, 0, 0, 255]);
  const crossed = extractMazeStartEndSheet(crossing);
  assert(!crossed.ok, 'artwork that crosses a gutter is rejected');
  assert(crossed.slots[0].image === null, 'a crossing illustration is not silently clipped');
  assert(crossed.issues.some((issue) => issue.col === 0 || issue.col === 1), 'the affected cells are reported');

  const white = blank(40, 40);
  fillRect(white, 0, 0, 40, 40, [255, 255, 255, 255]);
  const whiteCheck = assessSheetBackground(white);
  assert(!whiteCheck.ok && whiteCheck.message.includes('white'), 'a white background is not transparency');

  const checker = blank(48, 48);
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) {
      const dark = Math.floor(x / 8) + Math.floor(y / 8);
      const color = dark % 2 === 0 ? 220 : 160;
      paint(checker, x, y, color, color, color, 255);
    }
  }
  const checkerCheck = assessSheetBackground(checker);
  assert(!checkerCheck.ok && checkerCheck.message.toLowerCase().includes('checkerboard'), 'a drawn checkerboard is not transparency');

  const slot = { leftPt: 20, topPt: 30, widthPt: 220, heightPt: 220 };
  const bottom = placeMazeStartEndImages({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    startAspect: 1,
    endAspect: 1.4,
  });
  const mazeBox = {
    x: bottom.layout.leftPt + bottom.layout.offsetXPt,
    y: bottom.layout.topPt + bottom.layout.offsetYPt,
    w: bottom.layout.mazeWPt,
    h: bottom.layout.mazeHPt,
  };
  assert(bottom.start && bottom.end, 'start and end images are placed');
  assert(bottom.start.y + bottom.start.h <= mazeBox.y, 'the start image sits above the maze');
  assert(bottom.end.y >= mazeBox.y + mazeBox.h, 'the bottom exit image sits below the maze');
  assert(!overlaps(bottom.start, mazeBox) && !overlaps(bottom.end, mazeBox), 'images stay off the maze walls');
  assert(bottom.start.x >= slot.leftPt && bottom.end.y + bottom.end.h <= slot.topPt + slot.heightPt, 'images stay inside the slot');
  assert(Math.abs(bottom.end.w / bottom.end.h - 1.4) < 0.05, 'end image keeps its aspect ratio');

  const side = placeMazeStartEndImages({
    puzzle: maze({ row: 0, col: 2 }, { row: 2, col: 0 }, 'left'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    startAspect: 1,
    endAspect: 1,
  });
  const sideMaze = {
    x: side.layout.leftPt + side.layout.offsetXPt,
    y: side.layout.topPt + side.layout.offsetYPt,
    w: side.layout.mazeWPt,
    h: side.layout.mazeHPt,
  };
  assert(side.end && side.end.x + side.end.w <= sideMaze.x, 'a left exit image sits beside the opening');
  const right = placeMazeStartEndImages({
    puzzle: maze({ row: 0, col: 2 }, { row: 2, col: 4 }, 'right'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    startAspect: 1,
    endAspect: 1,
  });
  const rightMaze = {
    x: right.layout.leftPt + right.layout.offsetXPt,
    y: right.layout.topPt + right.layout.offsetYPt,
    w: right.layout.mazeWPt,
    h: right.layout.mazeHPt,
  };
  assert(right.end && right.end.x >= rightMaze.x + rightMaze.w, 'a right exit image sits beside the opening');

  const grownImages = placeMazeStartEndImages({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    startAspect: 1,
    endAspect: 1,
    imageScale: 1.6,
  });
  assert(grownImages.start && bottom.start, 'scaled start image is placed');
  assert(grownImages.start.h > bottom.start.h + 4, '160% image size makes the start image taller');
  const grownMaze = {
    x: grownImages.layout.leftPt + grownImages.layout.offsetXPt,
    y: grownImages.layout.topPt + grownImages.layout.offsetYPt,
    w: grownImages.layout.mazeWPt,
    h: grownImages.layout.mazeHPt,
  };
  assert(grownImages.start.y + grownImages.start.h <= grownMaze.y, 'a larger start image still sits off the maze');
  assert(grownImages.end && grownImages.end.y >= grownMaze.y + grownMaze.h, 'a larger end image still sits off the maze');
  assert(reopened.core.mazeStartEndImages.imageScalePercent === 100, 'reopened projects default image size to 100%');

  const gp = getDefaultGenericPuzzleSettings('maze');
  assert(gp.core.mazeStartEndImages.style === 'coloring-page', 'new projects default to coloring page style');
  assert(gp.core.mazeStartEndImages.imageScalePercent === 100, 'new projects default image size to 100%');
  assert(gp.core.mazeStartEndImages.hideOnSolutions === false, 'new projects show start/end images on solutions');
  assert(Object.keys(gp.core.mazeStartEndImages.sheetSources).length === 0, 'a new project has no uploaded sheets');
  assert(gp.core.mazeStartEndImages.pairs.length === 0, 'a new project does not invent image assignments');

  const twentyPairs = ensureMazeStartEndPairs([], 'forest', 20).map((pair, index) => ({
    ...pair,
    startImage: `data:image/png;base64,start${index}`,
    endImage: `data:image/png;base64,end${index}`,
    startWidth: 12,
    startHeight: 12,
    endWidth: 12,
    endHeight: 12,
  }));
  const twoSheets = normalizeMazeStartEndImages({
    enabled: true,
    theme: 'forest',
    pairs: twentyPairs,
    sheetSources: {
      0: 'data:image/png;base64,sheet0',
      1: 'data:image/png;base64,sheet1',
    },
    sheetCrops: {
      0: { boxes: [{ slotId: 'R1C1', x: 1, y: 1, w: 8, h: 8 }] },
      1: { boxes: [{ slotId: 'R1C1', x: 2, y: 2, w: 8, h: 8 }] },
    },
  });
  const chapterOne = sliceMazeStartEndImages(twoSheets, 0, 10);
  const chapterTwo = sliceMazeStartEndImages(twoSheets, 10, 10);
  assert(chapterOne.pairs.length === 10 && chapterOne.pairs[0].startImage.includes('start0'), 'chapter 1 keeps its first 10 pairs');
  assert(chapterTwo.pairs.length === 10 && chapterTwo.pairs[0].startImage.includes('start10'), 'chapter 2 starts at maze 11');
  assert(Object.keys(chapterOne.sheetSources).join(',') === '0', 'chapter 1 keeps only sheet 1');
  assert(chapterOne.sheetSources[0].includes('sheet0'), 'chapter 1 sheet is the first original sheet');
  assert(Object.keys(chapterTwo.sheetSources).join(',') === '0', 'chapter 2 remaps its sheet to slot 0');
  assert(chapterTwo.sheetSources[0].includes('sheet1'), 'chapter 2 does not keep the first original sheet');
  assert(!chapterTwo.sheetSources[1], 'chapter 2 does not carry leftover original sheets');
  const midChapter = sliceMazeStartEndImages(twoSheets, 0, 7);
  assert(midChapter.pairs.length === 7 && midChapter.pairs[6].startImage.includes('start6'), 'a short chapter keeps only its mazes');
  assert(Object.keys(midChapter.sheetSources).length === 0, 'a chapter that does not own a full sheet does not copy the original sheets');

  const enhancedForGp = normalizeMazeStartEndImages({
    enabled: true,
    theme: 'farm',
    pairs: [
      {
        ...grown[0],
        startImage: 'data:image/png;base64,enhanced-start',
        endImage: 'data:image/png;base64,enhanced-end',
        startSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M2 2"/></svg>',
        endSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M4 4"/></svg>',
        startAutoEnhanced: true,
        endAutoEnhanced: true,
        startWidth: 80,
        startHeight: 80,
        endWidth: 80,
        endHeight: 80,
      },
    ],
    sheetSources: { 0: 'data:image/png;base64,full-sheet' },
    sheetCrops: {
      0: {
        boxes: [{ slotId: 'R1C1', x: 12, y: 16, w: 40, h: 44 }],
        sourceWidth: 2560,
        sourceHeight: 1600,
      },
    },
  });
  const mazePageSettings = getDefaultGenericPuzzleSettings('maze');
  mazePageSettings.core.mazeStartEndImages = enhancedForGp;
  const reopenedGp = parseGpProjectJson(
    JSON.stringify({
      format: 'genpuzzle-project',
      formatVersion: 1,
      savedAt: '2026-09-25T00:00:00.000Z',
      projectName: 'Maze start end persist',
      settings: {
        documentPages: [
          {
            id: 'maze-1',
            moduleType: 'maze',
            settings: { genericPuzzleSettings: mazePageSettings },
          },
        ],
        activeDocumentPageId: 'maze-1',
      },
      batchPuzzles: [],
      currentPuzzle: null,
      currentBatchIndex: 0,
    })
  );
  const reopenedImages = normalizeGenericPuzzleSettings(
    (reopenedGp.settings.documentPages?.[0].settings as { genericPuzzleSettings?: unknown })
      .genericPuzzleSettings,
    'maze'
  ).core.mazeStartEndImages;
  assert(reopenedImages.pairs[0].startSvg.includes('<path d="M2 2"'), '.gp keeps enhanced start SVG');
  assert(reopenedImages.pairs[0].endSvg.includes('<path d="M4 4"'), '.gp keeps enhanced end SVG');
  assert(reopenedImages.pairs[0].startImage.includes('enhanced-start'), '.gp keeps enhanced start PNG');
  assert(reopenedImages.sheetSources[0].includes('full-sheet'), '.gp keeps the original crop sheet');
  assert(reopenedImages.sheetCrops[0].sourceWidth === 2560, '.gp keeps the crop sheet pixel size');
  const stripped = stripMazeStartEndImagePayloads(reopenedImages);
  assert(!stripped.pairs[0].startSvg && !stripped.sheetSources[0], 'localStorage fallback can drop bulky image payloads');
  assert(stripped.sheetCrops[0].boxes[0].w === 40, 'localStorage fallback still keeps crop boxes');
  const scaledLegacy = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [
        { slotId: 'R1C1', x: 20, y: 16, w: 200, h: 120 },
        { slotId: 'R5C4', x: 1040, y: 640, w: 220, h: 140 },
      ],
    },
    2560,
    1600
  );
  assert(
    Math.abs(scaledLegacy.boxes![0].x - 40) < 1 && Math.abs(scaledLegacy.boxes![0].w - 400) < 1,
    'Edit cropping remaps older 1280 crop boxes onto the full sheet'
  );
  const stampedWrong = scaleCropConfigToImage(
    {
      ...DEFAULT_CROP_CONFIG,
      boxes: [
        { slotId: 'R1C1', x: 20, y: 16, w: 200, h: 120 },
        { slotId: 'R5C4', x: 1040, y: 640, w: 220, h: 140 },
      ],
      sourceWidth: 2560,
      sourceHeight: 1600,
    },
    2560,
    1600
  );
  assert(
    Math.abs(stampedWrong.boxes![0].x - 40) < 1,
    'saved crop borders that still live in 1280 space are not left shifted on the full sheet'
  );

  const hidden = normalizeMazeStartEndImages({ enabled: true, hideOnSolutions: true });
  assert(hidden.hideOnSolutions === true, 'Hide images on solutions is stored with the project');
  assert(shouldDrawMazeStartEndImages(hidden, false) === true, 'puzzle pages still show start/end images');
  assert(shouldDrawMazeStartEndImages(hidden, true) === false, 'solution pages hide start/end images when asked');
  assert(
    Math.abs(mazeStartEndImageScale({ ...hidden, imageScalePercent: 100 }, true) - MAZE_SOLUTION_IMAGE_SCALE) < 0.001,
    'solution pages use a smaller start/end image scale'
  );
  const artPair = {
    ...ensureMazeStartEndPairs([], 'forest', 1)[0],
    startImage: 'data:image/png;base64,start',
    endImage: 'data:image/png;base64,end',
    startWidth: 40,
    startHeight: 40,
    endWidth: 40,
    endHeight: 40,
  };
  const mazeWithArt = getDefaultGenericPuzzleSettings('maze');
  mazeWithArt.core.mazeStartEndImages = normalizeMazeStartEndImages({
    enabled: true,
    pairs: [artPair],
    imageScalePercent: 100,
  });
  const puzzlePage = buildMazeElements({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    gp: mazeWithArt,
    showSolution: false,
  }).filter((el) => el.kind === 'image');
  const solutionPage = buildMazeElements({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    gp: mazeWithArt,
    showSolution: true,
  }).filter((el) => el.kind === 'image');
  assert(puzzlePage.length === 2 && solutionPage.length === 2, 'puzzle and solution pages both keep start/end images by default');
  assert(solutionPage[0].h < puzzlePage[0].h - 2, 'solution start/end images are smaller than puzzle images');
  mazeWithArt.core.mazeStartEndImages = {
    ...mazeWithArt.core.mazeStartEndImages,
    hideOnSolutions: true,
  };
  const hiddenSolution = buildMazeElements({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    gp: mazeWithArt,
    showSolution: true,
  }).filter((el) => el.kind === 'image');
  const hiddenPuzzle = buildMazeElements({
    puzzle: maze({ row: 0, col: 2 }, { row: 4, col: 2 }, 'bottom'),
    slot,
    preferredCellPt: 18,
    framePt: null,
    gp: mazeWithArt,
    showSolution: false,
  }).filter((el) => el.kind === 'image');
  assert(hiddenSolution.length === 0, 'Hide images on solutions removes start/end art from solution pages');
  assert(hiddenPuzzle.length === 2, 'Hide images on solutions still draws start/end art on puzzle pages');
  void MAZE_PAIRS_PER_SHEET;
}
