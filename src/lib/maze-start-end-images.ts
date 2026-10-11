/**
 * Maze start/end illustration sheets.
 * One sheet is 4 columns × 5 rows: each row holds two pairs, left to right.
 * The first image of a pair is the maze start; the second is the maze end.
 */

import { layoutMaze, mazeCenter, type MazeLayout } from './generic-puzzle-geometry';
import type { RectPt } from './generic-puzzle-page-layout';
import type { MazePuzzle, Position } from './puzzles/types';
import type { PixelBuffer, SlotCropBox, SpriteSheetCropConfig } from './sprite-sheet-importer';
import { DEFAULT_CROP_CONFIG, bufferToDataUrl, loadImageBuffer } from './sprite-sheet-importer';

export const MAZE_SHEET_COLUMNS = 4;
export const MAZE_SHEET_ROWS = 5;
export const MAZE_PAIRS_PER_SHEET = 10;
export const MAZE_IMAGE_SCALE_MIN = 40;
export const MAZE_IMAGE_SCALE_MAX = 200;
export const MAZE_IMAGE_SCALE_DEFAULT = 100;
/** Solution pages use a smaller band so start/end art does not dominate the path. */
export const MAZE_SOLUTION_IMAGE_SCALE = 0.58;

export type MazeStartEndStyle = 'coloring-page' | 'flat-vector' | 'cozy-cartoon' | 'black-white';
export type MazeStartEndMethod = 'manual' | 'ai';
export type MazeOpeningEdge = 'top' | 'bottom' | 'left' | 'right';

export const MAZE_START_END_STYLE_LABELS: Record<MazeStartEndStyle, string> = {
  'coloring-page': 'Coloring Page Style',
  'flat-vector': 'Flat vector',
  'cozy-cartoon': 'Cozy cartoon',
  'black-white': 'Black and white',
};

export interface MazeStartEndPair {
  sheetIndex: number;
  pairIndex: number;
  startSubject: string;
  endSubject: string;
  /** Visual description used in the sheet prompt. Not drawn on the maze. */
  startDescription: string;
  endDescription: string;
  startImage: string;
  endImage: string;
  startWidth: number;
  startHeight: number;
  endWidth: number;
  endHeight: number;
  startSourceImage?: string;
  endSourceImage?: string;
  startAutoEnhanced?: boolean;
  endAutoEnhanced?: boolean;
  /** Coloring-page SVG used on the canvas preview. */
  startSvg?: string;
  endSvg?: string;
}

export interface MazeStartEndIssue {
  sheetIndex: number;
  slotId: string;
  row: number;
  col: number;
  message: string;
}

export interface MazeStartEndImagesSettings {
  enabled: boolean;
  theme: string;
  style: MazeStartEndStyle;
  method: MazeStartEndMethod;
  pairs: MazeStartEndPair[];
  issues: MazeStartEndIssue[];
  /** Last applied crop boxes for each uploaded sheet. Switching sheets keeps these. */
  sheetCrops: Record<number, SpriteSheetCropConfig>;
  /** Start/end art size on the maze. 100 matches the previous placement band. */
  imageScalePercent: number;
  /** When true, solution pages omit start/end art and keep the maze full-size. */
  hideOnSolutions: boolean;
  /** Uploaded or generated sheets so Edit cropping stays available after apply. */
  sheetSources: Record<number, string>;
}

export interface MazeSheetSlot {
  row: number;
  col: number;
  pairIndex: number;
  role: 'start' | 'end';
  slotId: string;
  subject: string;
  description: string;
}

export interface MazeSheetCellIssue {
  slotId: string;
  row: number;
  col: number;
  message: string;
}

export interface MazeSheetExtraction {
  ok: boolean;
  issues: MazeSheetCellIssue[];
  slots: Array<{
    row: number;
    col: number;
    slotId: string;
    image: PixelBuffer | null;
  }>;
}

const STYLES: MazeStartEndStyle[] = ['coloring-page', 'flat-vector', 'cozy-cartoon', 'black-white'];

const GENERAL_PAIRS: Array<[string, string]> = [
  ['rabbit', 'carrot'],
  ['bee', 'flower'],
  ['bird', 'nest'],
  ['squirrel', 'acorn'],
  ['cat', 'yarn ball'],
  ['dog', 'bone'],
  ['mouse', 'cheese'],
  ['butterfly', 'leaf'],
  ['frog', 'lily pad'],
  ['owl', 'moon'],
  ['fox', 'den'],
  ['turtle', 'shell'],
  ['penguin', 'fish'],
  ['lion', 'crown'],
  ['monkey', 'banana'],
  ['bear', 'honey pot'],
  ['duck', 'pond'],
  ['horse', 'horseshoe'],
  ['sheep', 'wool ball'],
  ['goat', 'bell'],
  ['panda', 'bamboo'],
  ['koala', 'eucalyptus'],
  ['whale', 'water spout'],
  ['crab', 'shell'],
];

const THEMED_PAIRS: Record<string, Array<[string, string]>> = {
  ocean: [
    ['fish', 'seaweed'],
    ['crab', 'shell'],
    ['dolphin', 'wave'],
    ['octopus', 'anchor'],
    ['seahorse', 'coral'],
    ['whale', 'lighthouse'],
    ['starfish', 'pearl'],
    ['shark', 'fin'],
    ['turtle', 'reef'],
    ['pelican', 'boat'],
  ],
  space: [
    ['astronaut', 'rocket'],
    ['planet', 'star'],
    ['alien', 'flying saucer'],
    ['moon', 'telescope'],
    ['comet', 'satellite'],
    ['robot', 'gear'],
    ['galaxy', 'constellation'],
    ['meteor', 'crater'],
  ],
  food: [
    ['chef', 'hat'],
    ['apple', 'pie'],
    ['bee', 'honey'],
    ['cow', 'milk bottle'],
    ['baker', 'bread loaf'],
    ['carrot', 'rabbit'],
    ['cupcake', 'cherry'],
    ['pizza', 'olive'],
  ],
};

export function defaultMazeStartEndImages(): MazeStartEndImagesSettings {
  return {
    enabled: false,
    theme: '',
    style: 'coloring-page',
    method: 'manual',
    pairs: [],
    issues: [],
    sheetCrops: {},
    imageScalePercent: MAZE_IMAGE_SCALE_DEFAULT,
    hideOnSolutions: false,
    sheetSources: {},
  };
}

export function mazeStartEndImageScale(
  images: MazeStartEndImagesSettings | undefined,
  showSolution: boolean
): number {
  const base = clampImageScalePercent(images?.imageScalePercent) / 100;
  return showSolution ? base * MAZE_SOLUTION_IMAGE_SCALE : base;
}

export function shouldDrawMazeStartEndImages(
  images: MazeStartEndImagesSettings | undefined,
  showSolution: boolean
): boolean {
  if (!images?.enabled) return false;
  return !(showSolution && images.hideOnSolutions);
}

export function clampImageScalePercent(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MAZE_IMAGE_SCALE_DEFAULT;
  return Math.max(MAZE_IMAGE_SCALE_MIN, Math.min(MAZE_IMAGE_SCALE_MAX, n));
}

export function sheetCountForMazes(mazeCount: number): number {
  return Math.max(1, Math.ceil(Math.max(0, mazeCount) / MAZE_PAIRS_PER_SHEET));
}

/** Map uploaded file names onto sheet indexes. Numbered names keep their numbers; otherwise files fill sheet 1, 2, 3… */
export function mazeSheetIndexesForUploads(fileNames: string[]): number[] {
  const numbered = fileNames.map((name) => {
    const match = name.match(/(\d+)(?!.*\d)/);
    const number = match ? Number(match[1]) : Number.NaN;
    return Number.isFinite(number) && number >= 1 ? number - 1 : null;
  });
  const numberedFit =
    numbered.length > 0 &&
    numbered.every((index) => index != null) &&
    new Set(numbered).size === numbered.length;
  if (numberedFit) return numbered as number[];
  return fileNames.map((_, index) => index);
}

/** Maze count that gives every uploaded sheet its own 10 pages. */
export function mazeCountForUploadedSheets(fileNames: string[], currentMazeCount: number): number {
  const indexes = mazeSheetIndexesForUploads(fileNames);
  const sheets = indexes.length ? Math.max(...indexes) + 1 : 0;
  return Math.max(Math.max(0, currentMazeCount), sheets * MAZE_PAIRS_PER_SHEET);
}

/** Maze count when a new upload replaces every previous sheet. */
export function mazeCountForReplacedSheets(fileNames: string[]): number {
  const indexes = mazeSheetIndexesForUploads(fileNames);
  const sheets = indexes.length ? Math.max(...indexes) + 1 : 0;
  return sheets * MAZE_PAIRS_PER_SHEET;
}

export function pairAddress(mazeIndex: number): { sheetIndex: number; pairIndex: number; row: number; startCol: number; endCol: number } {
  const index = Math.max(0, mazeIndex);
  const sheetIndex = Math.floor(index / MAZE_PAIRS_PER_SHEET);
  const pairIndex = index % MAZE_PAIRS_PER_SHEET;
  const row = Math.floor(pairIndex / 2);
  const side = pairIndex % 2;
  const startCol = side * 2;
  const endCol = startCol + 1;
  return { sheetIndex, pairIndex, row, startCol, endCol };
}

export function slotIdFor(row: number, col: number): string {
  return `R${row + 1}C${col + 1}`;
}

function bankForTheme(theme: string): Array<[string, string]> {
  const key = theme.trim().toLowerCase();
  return THEMED_PAIRS[key] ?? GENERAL_PAIRS;
}

export function plannedPair(theme: string, mazeIndex: number): Pick<MazeStartEndPair, 'sheetIndex' | 'pairIndex' | 'startSubject' | 'endSubject'> {
  const address = pairAddress(mazeIndex);
  const bank = bankForTheme(theme);
  const base = bank[mazeIndex % bank.length];
  const cycle = Math.floor(mazeIndex / bank.length);
  const suffix = cycle > 0 ? ` ${cycle + 1}` : '';
  return {
    sheetIndex: address.sheetIndex,
    pairIndex: address.pairIndex,
    startSubject: `${base[0]}${suffix}`,
    endSubject: `${base[1]}${suffix}`,
  };
}

export function emptyPair(theme: string, mazeIndex: number): MazeStartEndPair {
  return {
    ...plannedPair(theme, mazeIndex),
    startDescription: '',
    endDescription: '',
    startImage: '',
    endImage: '',
    startWidth: 0,
    startHeight: 0,
    endWidth: 0,
    endHeight: 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizePair(value: unknown, index: number): MazeStartEndPair {
  const raw = asRecord(value);
  const planned = emptyPair('', index);
  const sheetIndex = Number(raw.sheetIndex);
  const pairIndex = Number(raw.pairIndex);
  return {
    sheetIndex: Number.isFinite(sheetIndex) ? sheetIndex : planned.sheetIndex,
    pairIndex: Number.isFinite(pairIndex) ? pairIndex : planned.pairIndex,
    startSubject: typeof raw.startSubject === 'string' && raw.startSubject.trim() ? raw.startSubject : planned.startSubject,
    endSubject: typeof raw.endSubject === 'string' && raw.endSubject.trim() ? raw.endSubject : planned.endSubject,
    startDescription: typeof raw.startDescription === 'string' ? raw.startDescription : '',
    endDescription: typeof raw.endDescription === 'string' ? raw.endDescription : '',
    startImage: typeof raw.startImage === 'string' ? raw.startImage : '',
    endImage: typeof raw.endImage === 'string' ? raw.endImage : '',
    startWidth: Number(raw.startWidth) > 0 ? Number(raw.startWidth) : 0,
    startHeight: Number(raw.startHeight) > 0 ? Number(raw.startHeight) : 0,
    endWidth: Number(raw.endWidth) > 0 ? Number(raw.endWidth) : 0,
    endHeight: Number(raw.endHeight) > 0 ? Number(raw.endHeight) : 0,
    startSourceImage: typeof raw.startSourceImage === 'string' ? raw.startSourceImage : '',
    endSourceImage: typeof raw.endSourceImage === 'string' ? raw.endSourceImage : '',
    startAutoEnhanced: raw.startAutoEnhanced === true,
    endAutoEnhanced: raw.endAutoEnhanced === true,
    startSvg: typeof raw.startSvg === 'string' ? raw.startSvg : '',
    endSvg: typeof raw.endSvg === 'string' ? raw.endSvg : '',
  };
}

function asNumberList(value: unknown): number[] {
  return Array.isArray(value) ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item)) : [];
}

function normalizeCropBox(value: unknown): SlotCropBox | null {
  const raw = asRecord(value);
  const slotId = typeof raw.slotId === 'string' ? raw.slotId : '';
  const x = Number(raw.x);
  const y = Number(raw.y);
  const w = Number(raw.w);
  const h = Number(raw.h);
  if (!slotId || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  const outline = asNumberList(raw.outline);
  const extraOutlines = Array.isArray(raw.extraOutlines)
    ? raw.extraOutlines.map((polygon) => asNumberList(polygon)).filter((polygon) => polygon.length >= 6)
    : [];
  const includePolygons = Array.isArray(raw.includePolygons)
    ? raw.includePolygons.map((polygon) => asNumberList(polygon)).filter((polygon) => polygon.length >= 6)
    : [];
  const excludePolygons = Array.isArray(raw.excludePolygons)
    ? raw.excludePolygons.map((polygon) => asNumberList(polygon)).filter((polygon) => polygon.length >= 6)
    : [];
  return {
    slotId,
    x,
    y,
    w,
    h,
    ...(outline.length >= 6 ? { outline } : {}),
    ...(extraOutlines.length ? { extraOutlines } : {}),
    ...(includePolygons.length ? { includePolygons } : {}),
    ...(excludePolygons.length ? { excludePolygons } : {}),
  };
}

export function normalizeSheetSources(value: unknown): Record<number, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<number, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    if (typeof raw === 'string' && raw.startsWith('data:image/')) out[index] = raw;
  }
  return out;
}

export function normalizeSheetCrops(value: unknown): Record<number, SpriteSheetCropConfig> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<number, SpriteSheetCropConfig> = {};
  for (const [key, rawCrop] of Object.entries(value as Record<string, unknown>)) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    const raw = asRecord(rawCrop);
    const boxes = Array.isArray(raw.boxes)
      ? raw.boxes.map((box) => normalizeCropBox(box)).filter((box): box is SlotCropBox => box != null)
      : [];
    out[index] = {
      ...DEFAULT_CROP_CONFIG,
      xs: asNumberList(raw.xs),
      ys: asNumberList(raw.ys),
      boxes,
      safetyPx: Number(raw.safetyPx) || DEFAULT_CROP_CONFIG.safetyPx,
      alphaThreshold: Number(raw.alphaThreshold) || DEFAULT_CROP_CONFIG.alphaThreshold,
      snapToTransparent: raw.snapToTransparent !== false,
      normalizeMode:
        raw.normalizeMode === 'normalize-height' ||
        raw.normalizeMode === 'normalize-width' ||
        raw.normalizeMode === 'fit-square' ||
        raw.normalizeMode === 'fit-cell' ||
        raw.normalizeMode === 'custom'
          ? raw.normalizeMode
          : 'original',
      customScale: Number(raw.customScale) > 0 ? Number(raw.customScale) : 1,
      bgTolerancePercent: Number.isFinite(Number(raw.bgTolerancePercent))
        ? Number(raw.bgTolerancePercent)
        : DEFAULT_CROP_CONFIG.bgTolerancePercent,
      padPercent: Number.isFinite(Number(raw.padPercent)) ? Number(raw.padPercent) : DEFAULT_CROP_CONFIG.padPercent,
      analysisMaxSide: Number(raw.analysisMaxSide) || DEFAULT_CROP_CONFIG.analysisMaxSide,
      removeBackground: raw.removeBackground === true,
      grayscale: raw.grayscale === true,
      gridRows: Number(raw.gridRows) > 0 ? Number(raw.gridRows) : undefined,
      gridCols: Number(raw.gridCols) > 0 ? Number(raw.gridCols) : undefined,
      sourceWidth: Number(raw.sourceWidth) > 0 ? Number(raw.sourceWidth) : undefined,
      sourceHeight: Number(raw.sourceHeight) > 0 ? Number(raw.sourceHeight) : undefined,
    };
  }
  return out;
}

/** Drop bulky rasters/SVGs for localStorage fallback. Crop boxes stay. */
export function stripMazeStartEndImagePayloads(
  images: MazeStartEndImagesSettings
): MazeStartEndImagesSettings {
  return {
    ...images,
    sheetSources: {},
    pairs: images.pairs.map((pair) => ({
      ...pair,
      startImage: '',
      endImage: '',
      startSourceImage: '',
      endSourceImage: '',
      startSvg: '',
      endSvg: '',
    })),
  };
}

export function normalizeMazeStartEndImages(value: unknown): MazeStartEndImagesSettings {
  const raw = asRecord(value);
  const style = STYLES.includes(raw.style as MazeStartEndStyle) ? (raw.style as MazeStartEndStyle) : 'coloring-page';
  const pairs = Array.isArray(raw.pairs) ? raw.pairs.map((pair, index) => normalizePair(pair, index)) : [];
  const issues = Array.isArray(raw.issues)
    ? raw.issues.flatMap((issue) => {
        const row = asRecord(issue);
        if (typeof row.message !== 'string' || typeof row.slotId !== 'string') return [];
        return [
          {
            sheetIndex: Number(row.sheetIndex) || 0,
            slotId: row.slotId,
            row: Number(row.row) || 0,
            col: Number(row.col) || 0,
            message: row.message,
          },
        ];
      })
    : [];
  return {
    enabled: raw.enabled === true,
    theme: typeof raw.theme === 'string' ? raw.theme : '',
    style,
    method: raw.method === 'ai' ? 'ai' : 'manual',
    pairs,
    issues,
    sheetCrops: normalizeSheetCrops(raw.sheetCrops),
    imageScalePercent: clampImageScalePercent(raw.imageScalePercent),
    hideOnSolutions: raw.hideOnSolutions === true,
    sheetSources: normalizeSheetSources(raw.sheetSources),
  };
}

/**
 * Give one chapter only its mazes' start/end art.
 * Full original sheets stay on the source document; a chapter keeps a sheet
 * only when every pair on that sheet belongs to the chapter.
 */
export function sliceMazeStartEndImages(
  images: MazeStartEndImagesSettings | undefined,
  puzzleOffset: number,
  puzzleCount: number
): MazeStartEndImagesSettings {
  const source = normalizeMazeStartEndImages(images);
  const start = Math.max(0, Math.round(puzzleOffset) || 0);
  const count = Math.max(0, Math.round(puzzleCount) || 0);
  const raw = source.pairs.slice(start, start + count);
  const pairs = ensureMazeStartEndPairs(raw, source.theme, count);
  const rangeEnd = start + count;
  const ownedSheets: number[] = [];
  const knownSheets = new Set<number>([
    ...Object.keys(source.sheetSources).map(Number),
    ...Object.keys(source.sheetCrops).map(Number),
  ]);
  for (let index = start; index < rangeEnd; index += 1) {
    knownSheets.add(pairAddress(index).sheetIndex);
  }
  for (const sheet of [...knownSheets].sort((a, b) => a - b)) {
    if (!Number.isInteger(sheet) || sheet < 0) continue;
    const sheetStart = sheet * MAZE_PAIRS_PER_SHEET;
    const sheetEnd = sheetStart + MAZE_PAIRS_PER_SHEET;
    if (sheetStart >= start && sheetEnd <= rangeEnd) ownedSheets.push(sheet);
  }
  const sheetSources: Record<number, string> = {};
  const sheetCrops: Record<number, SpriteSheetCropConfig> = {};
  ownedSheets.forEach((oldIndex, newIndex) => {
    if (source.sheetSources[oldIndex]) sheetSources[newIndex] = source.sheetSources[oldIndex];
    if (source.sheetCrops[oldIndex]) sheetCrops[newIndex] = source.sheetCrops[oldIndex];
  });
  return {
    ...source,
    pairs,
    sheetSources,
    sheetCrops,
    issues: [],
  };
}

/** Keep saved subjects and images. Append pairs when the maze count grows. */
export function ensureMazeStartEndPairs(
  current: MazeStartEndPair[],
  theme: string,
  mazeCount: number
): MazeStartEndPair[] {
  const count = Math.max(0, Math.round(mazeCount));
  let changed = current.length !== count;
  const next: MazeStartEndPair[] = [];
  for (let i = 0; i < count; i++) {
    const address = pairAddress(i);
    const existing = current[i];
    if (
      existing &&
      existing.startSubject &&
      existing.endSubject &&
      existing.sheetIndex === address.sheetIndex &&
      existing.pairIndex === address.pairIndex
    ) {
      next.push(existing);
      continue;
    }
    changed = true;
    next.push(
      existing
        ? {
            ...existing,
            sheetIndex: address.sheetIndex,
            pairIndex: address.pairIndex,
            startSubject: existing.startSubject || plannedPair(theme, i).startSubject,
            endSubject: existing.endSubject || plannedPair(theme, i).endSubject,
          }
        : emptyPair(theme, i)
    );
  }
  return changed ? next : current;
}

export function rebuildUnassignedSubjects(pairs: MazeStartEndPair[], theme: string): MazeStartEndPair[] {
  return pairs.map((pair, index) => {
    if (pair.startImage || pair.endImage) return pair;
    const planned = plannedPair(theme, index);
    return {
      ...pair,
      ...planned,
      startDescription: '',
      endDescription: '',
      startImage: '',
      endImage: '',
      startWidth: 0,
      startHeight: 0,
      endWidth: 0,
      endHeight: 0,
    };
  });
}

export function sheetSlots(pairs: MazeStartEndPair[], sheetIndex: number): MazeSheetSlot[] {
  const slots: MazeSheetSlot[] = [];
  for (let pairIndex = 0; pairIndex < MAZE_PAIRS_PER_SHEET; pairIndex++) {
    const mazeIndex = sheetIndex * MAZE_PAIRS_PER_SHEET + pairIndex;
    const address = pairAddress(mazeIndex);
    const pair = pairs[mazeIndex] ?? emptyPair('', mazeIndex);
    slots.push({
      row: address.row,
      col: address.startCol,
      pairIndex,
      role: 'start',
      slotId: slotIdFor(address.row, address.startCol),
      subject: pair.startSubject,
      description: pair.startDescription || '',
    });
    slots.push({
      row: address.row,
      col: address.endCol,
      pairIndex,
      role: 'end',
      slotId: slotIdFor(address.row, address.endCol),
      subject: pair.endSubject,
      description: pair.endDescription || '',
    });
  }
  return slots.sort((a, b) => a.row - b.row || a.col - b.col);
}

function styleLines(style: MazeStartEndStyle): string[] {
  if (style === 'coloring-page') {
    return [
      'Drawing style: Coloring Page Style.',
      'Use clean black outlines suitable for printing and coloring.',
      'No colored fills, no shading, and no background scene.',
    ];
  }
  if (style === 'flat-vector') {
    return ['Drawing style: flat vector illustrations with solid shapes and consistent line weight.'];
  }
  if (style === 'cozy-cartoon') {
    return ['Drawing style: cozy cartoon illustrations with the same character proportions on every cell.'];
  }
  return ['Drawing style: black and white ink illustrations with no color and no gray shading.'];
}

export function buildMazeStartEndPrompt(opts: {
  theme: string;
  style: MazeStartEndStyle;
  sheetIndex: number;
  sheetCount: number;
  pairs: MazeStartEndPair[];
}): string {
  const slots = sheetSlots(opts.pairs, opts.sheetIndex);
  const theme = opts.theme.trim() || 'a friendly illustrated theme';
  const lines = [
    `Create one illustration sheet for maze start and end icons.`,
    `Theme: ${theme}. Draw every picture in that theme.`,
    ...styleLines(opts.style),
    `This is sheet ${opts.sheetIndex + 1} of ${opts.sheetCount}.`,
    `Use exactly ${MAZE_SHEET_COLUMNS} columns and ${MAZE_SHEET_ROWS} rows, 20 illustrations.`,
    `Each row contains two related pairs. Read the row from left to right.`,
    `Columns 1 and 2 are one pair. Columns 3 and 4 are the next pair.`,
    `The first image of each pair is the maze start. The second image is the maze end.`,
    `Draw exactly one subject in each cell:`,
    ...slots.map((slot) => {
      const description = slot.description.trim();
      return `Row ${slot.row + 1}, column ${slot.col + 1} (${slot.role} of pair ${slot.pairIndex + 1}): ${slot.subject}.${description ? ` ${description}` : ''}`;
    }),
    `Use a genuinely transparent background. Do not paint white, gray, or a checkerboard behind the drawings.`,
    `No visible grid lines, labels, numbers, captions, or text.`,
    `Keep every illustration fully inside its own cell.`,
    `Leave generous transparent spacing around every illustration and between cells.`,
    `Do not let any illustration touch, overlap, or cross into a neighboring cell.`,
    `Keep the same visual scale and the same drawing style in every cell.`,
    `A reference sheet may show cell labels and pair order. Those markings are instructions only and must not appear in the artwork.`,
  ];
  return lines.join('\n');
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  const pushFitted = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) {
      line = word;
      return;
    }
    let chunk = '';
    for (const char of word) {
      const test = chunk + char;
      if (chunk && ctx.measureText(test).width > maxWidth) {
        lines.push(chunk);
        chunk = char;
      } else {
        chunk = test;
      }
    }
    line = chunk;
  };
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      pushFitted(word);
    } else if (!line && ctx.measureText(word).width > maxWidth) {
      pushFitted(word);
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function buildMazeStartEndReferenceSheet(pairs: MazeStartEndPair[], sheetIndex: number, _sheetCount: number): string {
  if (typeof document === 'undefined') return '';
  const slots = sheetSlots(pairs, sheetIndex);
  const columns = MAZE_SHEET_COLUMNS;
  const rows = MAZE_SHEET_ROWS;
  const cell = 360;
  const pad = 24;
  const width = pad * 2 + columns * cell;
  const height = pad * 2 + rows * cell;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const slot of slots) {
    const x = pad + slot.col * cell;
    const y = pad + slot.row * cell;
    const inset = 18;
    const boxX = x + inset;
    const boxY = y + inset;
    const boxW = cell - inset * 2;
    const boxH = cell - inset * 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    const text = slot.description.trim();
    if (!text) continue;
    const innerPad = 16;
    const maxWidth = boxW - innerPad * 2;
    const maxHeight = boxH - innerPad * 2;
    let fontSize = 22;
    let lines: string[] = [];
    let lineHeight = 28;
    while (fontSize >= 12) {
      ctx.font = `${fontSize}px Arial`;
      lineHeight = Math.round(fontSize * 1.25);
      lines = wrapLines(ctx, text, maxWidth);
      if (lines.length * lineHeight <= maxHeight) break;
      fontSize -= 1;
    }
    const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last.replace(/\s+$/, '')}...`;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX + 4, boxY + 4, boxW - 8, boxH - 8);
    ctx.clip();
    ctx.fillStyle = '#111827';
    const blockH = lines.length * lineHeight;
    let baseline = boxY + (boxH - blockH) / 2 + lineHeight / 2;
    for (const row of lines) {
      ctx.fillText(row, boxX + boxW / 2, baseline);
      baseline += lineHeight;
    }
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
}

function pixel(buf: PixelBuffer, x: number, y: number): number {
  return (y * buf.width + x) * 4;
}

export function assessSheetBackground(buf: PixelBuffer): { ok: true } | { ok: false; message: string } {
  const count = buf.width * buf.height;
  if (count === 0) return { ok: false, message: 'The sheet is empty.' };
  let clear = 0;
  let opaque = 0;
  let whiteOpaque = 0;
  for (let i = 0; i < buf.data.length; i += 4) {
    const alpha = buf.data[i + 3];
    if (alpha <= 12) {
      clear += 1;
      continue;
    }
    opaque += 1;
    if (alpha > 240 && buf.data[i] > 245 && buf.data[i + 1] > 245 && buf.data[i + 2] > 245) whiteOpaque += 1;
  }
  const checker = looksLikeCheckerboard(buf);
  if (checker) {
    return { ok: false, message: 'A checkerboard is drawn into the sheet. That is not genuine transparency.' };
  }
  if (clear / count < 0.08) {
    if (opaque > 0 && whiteOpaque / opaque > 0.45) {
      return { ok: false, message: 'The sheet has a white background. A white fill is not genuine transparency.' };
    }
    return { ok: false, message: 'The sheet does not have a genuinely transparent background.' };
  }
  return { ok: true };
}

function looksLikeCheckerboard(buf: PixelBuffer): boolean {
  const periods = [8, 12, 16, 20];
  for (const period of periods) {
    if (period * 2 >= buf.width || period * 2 >= buf.height) continue;
    const sample = (x: number, y: number) => {
      const i = pixel(buf, x, y);
      return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
    };
    const first = sample(2, 2);
    const second = sample(Math.min(buf.width - 2, 2 + period), 2);
    if (first[3] < 200 || second[3] < 200) continue;
    const apart = Math.max(
      Math.abs(first[0] - second[0]),
      Math.abs(first[1] - second[1]),
      Math.abs(first[2] - second[2])
    );
    if (apart < 18) continue;
    let match = 0;
    let total = 0;
    for (let y = 2; y < buf.height - 2; y += period) {
      for (let x = 2; x < buf.width - 2; x += period) {
        const expect = (Math.floor(x / period) + Math.floor(y / period)) % 2 === 0 ? first : second;
        const got = sample(x, y);
        total += 1;
        const distance = Math.max(
          Math.abs(got[0] - expect[0]),
          Math.abs(got[1] - expect[1]),
          Math.abs(got[2] - expect[2])
        );
        if (got[3] > 200 && distance < 18) match += 1;
      }
    }
    if (total > 8 && match / total > 0.72) return true;
  }
  return false;
}

function visibleMask(buf: PixelBuffer): Uint8Array {
  const mask = new Uint8Array(buf.width * buf.height);
  for (let p = 0, i = 0; p < mask.length; p += 1, i += 4) {
    if (buf.data[i + 3] > 24) mask[p] = 1;
  }
  return mask;
}

function boundaryBand(size: number, index: number, parts: number): { from: number; to: number } {
  const split = (size * index) / parts;
  const cell = size / parts;
  const band = Math.max(2, Math.round(cell * 0.08));
  return {
    from: Math.max(0, Math.floor(split - band)),
    to: Math.min(size - 1, Math.ceil(split + band)),
  };
}

function cropBuffer(buf: PixelBuffer, x: number, y: number, w: number, h: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * buf.width + x) * 4;
    data.set(buf.data.subarray(src, src + w * 4), row * w * 4);
  }
  return { data, width: w, height: h };
}

export function extractMazeStartEndSheet(buf: PixelBuffer): MazeSheetExtraction {
  const slots = Array.from({ length: MAZE_SHEET_ROWS * MAZE_SHEET_COLUMNS }, (_, index) => {
    const row = Math.floor(index / MAZE_SHEET_COLUMNS);
    const col = index % MAZE_SHEET_COLUMNS;
    return { row, col, slotId: slotIdFor(row, col), image: null as PixelBuffer | null };
  });
  const background = assessSheetBackground(buf);
  if (!background.ok) {
    return {
      ok: false,
      issues: slots.map((slot) => ({ ...slot, message: background.message })),
      slots,
    };
  }
  const mask = visibleMask(buf);
  const issues: MazeSheetCellIssue[] = [];
  const colBands = Array.from({ length: MAZE_SHEET_COLUMNS - 1 }, (_, index) =>
    boundaryBand(buf.width, index + 1, MAZE_SHEET_COLUMNS)
  );
  const rowBands = Array.from({ length: MAZE_SHEET_ROWS - 1 }, (_, index) =>
    boundaryBand(buf.height, index + 1, MAZE_SHEET_ROWS)
  );
  const bandHasInk = (x0: number, x1: number, y0: number, y1: number) => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (mask[y * buf.width + x]) return true;
      }
    }
    return false;
  };

  for (const slot of slots) {
    const left = slot.col === 0 ? 0 : colBands[slot.col - 1].to + 1;
    const right = slot.col === MAZE_SHEET_COLUMNS - 1 ? buf.width : colBands[slot.col].from;
    const top = slot.row === 0 ? 0 : rowBands[slot.row - 1].to + 1;
    const bottom = slot.row === MAZE_SHEET_ROWS - 1 ? buf.height : rowBands[slot.row].from;
    const rowTop = slot.row === 0 ? 0 : rowBands[slot.row - 1].from;
    const rowBottom = slot.row === MAZE_SHEET_ROWS - 1 ? buf.height : rowBands[slot.row].to + 1;
    let crossed = false;
    if (slot.col > 0 && bandHasInk(colBands[slot.col - 1].from, colBands[slot.col - 1].to, rowTop, rowBottom)) {
      crossed = true;
    }
    if (slot.col < MAZE_SHEET_COLUMNS - 1 && bandHasInk(colBands[slot.col].from, colBands[slot.col].to, rowTop, rowBottom)) {
      crossed = true;
    }
    if (slot.row > 0 && bandHasInk(left, Math.max(left, right - 1), rowBands[slot.row - 1].from, rowBands[slot.row - 1].to)) {
      crossed = true;
    }
    if (
      slot.row < MAZE_SHEET_ROWS - 1 &&
      bandHasInk(left, Math.max(left, right - 1), rowBands[slot.row].from, rowBands[slot.row].to)
    ) {
      crossed = true;
    }
    if (crossed) {
      issues.push({
        slotId: slot.slotId,
        row: slot.row,
        col: slot.col,
        message: 'The illustration crosses a cell boundary or the transparent gutter is missing.',
      });
      continue;
    }
    let minX = right;
    let minY = bottom;
    let maxX = left - 1;
    let maxY = top - 1;
    let ink = 0;
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (!mask[y * buf.width + x]) continue;
        ink += 1;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (ink === 0) {
      issues.push({ slotId: slot.slotId, row: slot.row, col: slot.col, message: 'No illustration was found in this cell.' });
      continue;
    }
    const pad = Math.max(2, Math.round(Math.min(right - left, bottom - top) * 0.06));
    const touches =
      minX - left < pad || right - 1 - maxX < pad || minY - top < pad || bottom - 1 - maxY < pad;
    if (touches) {
      issues.push({
        slotId: slot.slotId,
        row: slot.row,
        col: slot.col,
        message: 'The illustration crosses a cell boundary or the transparent gutter is too small to crop it safely.',
      });
      continue;
    }
    const x = minX - pad;
    const y = minY - pad;
    const w = maxX - minX + 1 + pad * 2;
    const h = maxY - minY + 1 + pad * 2;
    slot.image = cropBuffer(buf, x, y, w, h);
  }

  const unique = new Map<string, MazeSheetCellIssue>();
  for (const issue of issues) unique.set(`${issue.slotId}:${issue.message}`, issue);
  const list = [...unique.values()];
  return { ok: list.length === 0, issues: list, slots };
}

export async function extractMazeStartEndSheetFromUrl(src: string): Promise<MazeSheetExtraction> {
  const buf = await loadImageBuffer(src, 0);
  return extractMazeStartEndSheet(buf);
}

export function slotDataUrl(image: PixelBuffer | null): string {
  return image ? bufferToDataUrl(image) : '';
}

export function openingEdge(puzzle: Pick<MazePuzzle, 'grid' | 'outside'>, pos: Position): MazeOpeningEdge {
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const open = (row: number, col: number) => {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return true;
    if (puzzle.outside?.[row]?.[col]) return false;
    return puzzle.grid[row][col] === false;
  };
  const options: Array<{ edge: MazeOpeningEdge; distance: number }> = [];
  if (open(pos.row - 1, pos.col)) options.push({ edge: 'top', distance: pos.row });
  if (open(pos.row + 1, pos.col)) options.push({ edge: 'bottom', distance: rows - 1 - pos.row });
  if (open(pos.row, pos.col - 1)) options.push({ edge: 'left', distance: pos.col });
  if (open(pos.row, pos.col + 1)) options.push({ edge: 'right', distance: cols - 1 - pos.col });
  if (options.length === 0) {
    const borders: Array<{ edge: MazeOpeningEdge; distance: number }> = [
      { edge: 'top', distance: pos.row },
      { edge: 'bottom', distance: rows - 1 - pos.row },
      { edge: 'left', distance: pos.col },
      { edge: 'right', distance: cols - 1 - pos.col },
    ];
    borders.sort((a, b) => a.distance - b.distance);
    return borders[0].edge;
  }
  options.sort((a, b) => a.distance - b.distance);
  return options[0].edge;
}

export interface PlacedMazeImages {
  layout: MazeLayout;
  start: { x: number; y: number; w: number; h: number } | null;
  end: { x: number; y: number; w: number; h: number } | null;
}

function containBox(aspect: number, maxW: number, maxH: number): { w: number; h: number } {
  const safe = aspect > 0 ? aspect : 1;
  let w = maxW;
  let h = w / safe;
  if (h > maxH) {
    h = maxH;
    w = h * safe;
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface ImageRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function placeOnEdge(
  edge: MazeOpeningEdge,
  center: { xPt: number; yPt: number },
  aspect: number,
  slot: RectPt,
  band: number
): ImageRect {
  const room = Math.max(8, band - 6);
  const size = containBox(aspect, room, room);
  const x = clamp(center.xPt - size.w / 2, slot.leftPt + 2, slot.leftPt + slot.widthPt - size.w - 2);
  const y = clamp(center.yPt - size.h / 2, slot.topPt + 2, slot.topPt + slot.heightPt - size.h - 2);
  if (edge === 'top') {
    return { x, y: slot.topPt + Math.max(0, (band - 6 - size.h) / 2), w: size.w, h: size.h };
  }
  if (edge === 'bottom') {
    return {
      x,
      y: slot.topPt + slot.heightPt - band + 6 + Math.max(0, (band - 6 - size.h) / 2),
      w: size.w,
      h: size.h,
    };
  }
  if (edge === 'left') {
    return { x: slot.leftPt + Math.max(0, (band - 6 - size.w) / 2), y, w: size.w, h: size.h };
  }
  return {
    x: slot.leftPt + slot.widthPt - band + 6 + Math.max(0, (band - 6 - size.w) / 2),
    y,
    w: size.w,
    h: size.h,
  };
}

function separateOnSameEdge(edge: MazeOpeningEdge, start: ImageRect, end: ImageRect, slot: RectPt): void {
  const horizontal = edge === 'top' || edge === 'bottom';
  for (let attempt = 0; attempt < 5; attempt++) {
    const overlap = horizontal
      ? Math.min(start.x + start.w, end.x + end.w) - Math.max(start.x, end.x)
      : Math.min(start.y + start.h, end.y + end.h) - Math.max(start.y, end.y);
    if (overlap <= 4) return;
    const scale = 0.86;
    start.w *= scale;
    start.h *= scale;
    end.w *= scale;
    end.h *= scale;
    if (horizontal) {
      if (start.x <= end.x) {
        start.x = clamp(start.x - overlap / 2, slot.leftPt + 2, slot.leftPt + slot.widthPt - start.w - 2);
        end.x = clamp(end.x + overlap / 2, slot.leftPt + 2, slot.leftPt + slot.widthPt - end.w - 2);
      }
    } else if (start.y <= end.y) {
      start.y = clamp(start.y - overlap / 2, slot.topPt + 2, slot.topPt + slot.heightPt - start.h - 2);
      end.y = clamp(end.y + overlap / 2, slot.topPt + 2, slot.topPt + slot.heightPt - end.h - 2);
    }
  }
}

export function placeMazeStartEndImages(input: {
  puzzle: MazePuzzle;
  slot: RectPt;
  preferredCellPt: number;
  framePt: number | null;
  startAspect: number;
  endAspect: number;
  imageScale?: number;
}): PlacedMazeImages {
  const { puzzle, slot } = input;
  const startEdge = openingEdge(puzzle, puzzle.start);
  const endEdge = openingEdge(puzzle, puzzle.end);
  const short = Math.min(slot.widthPt, slot.heightPt);
  let band = Math.min(64, Math.max(28, short * 0.16));
  band = Math.min(band, slot.widthPt * 0.22, slot.heightPt * 0.22);
  const scale = clamp(input.imageScale ?? 1, MAZE_IMAGE_SCALE_MIN / 100, MAZE_IMAGE_SCALE_MAX / 100);
  band = Math.min(band * scale, slot.widthPt * 0.42, slot.heightPt * 0.42);
  const inset = {
    top: startEdge === 'top' || endEdge === 'top' ? band : 0,
    bottom: startEdge === 'bottom' || endEdge === 'bottom' ? band : 0,
    left: startEdge === 'left' || endEdge === 'left' ? band : 0,
    right: startEdge === 'right' || endEdge === 'right' ? band : 0,
  };
  const inner: RectPt = {
    leftPt: slot.leftPt + inset.left,
    topPt: slot.topPt + inset.top,
    widthPt: Math.max(12, slot.widthPt - inset.left - inset.right),
    heightPt: Math.max(12, slot.heightPt - inset.top - inset.bottom),
  };
  const frame = input.framePt && input.framePt > 0 ? Math.min(input.framePt, inner.widthPt, inner.heightPt) : null;
  const layout = layoutMaze(puzzle, inner, input.preferredCellPt, frame);
  const startCenter = mazeCenter(layout, puzzle.start.col, puzzle.start.row);
  const endCenter = mazeCenter(layout, puzzle.end.col, puzzle.end.row);
  const start = placeOnEdge(startEdge, startCenter, input.startAspect, slot, band);
  const end = placeOnEdge(endEdge, endCenter, input.endAspect, slot, band);
  if (startEdge === endEdge) separateOnSameEdge(startEdge, start, end, slot);
  return { layout, start, end };
}

export function mazeStartEndRevisionKey(
  images: MazeStartEndImagesSettings | undefined,
  puzzleIndex: number
): string {
  if (!images?.enabled) return 'off';
  const pair = images.pairs[puzzleIndex];
  if (!pair?.startImage || !pair.endImage) return `empty:${puzzleIndex}`;
  return `${clampImageScalePercent(images.imageScalePercent)}:${images.hideOnSolutions ? 'hide-sol' : 'show-sol'}:${pair.sheetIndex}:${pair.pairIndex}:${pair.startWidth}x${pair.startHeight}:${pair.endWidth}x${pair.endHeight}:${pair.startImage.slice(-24)}:${pair.endImage.slice(-24)}:${pair.startSvg?.length ?? 0}:${pair.endSvg?.length ?? 0}:${(pair.startSvg || '').slice(-16)}`;
}

export function assignedPair(
  images: MazeStartEndImagesSettings | undefined,
  puzzle: MazePuzzle
): MazeStartEndPair | null {
  if (!images?.enabled) return null;
  const index = puzzle.puzzleIndexInDocument ?? 0;
  const pair = images.pairs[index];
  if (!pair?.startImage || !pair.endImage) return null;
  return pair;
}
