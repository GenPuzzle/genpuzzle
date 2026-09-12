import type { WordSearchSettings } from './puzzles/types';
import { getPageDimensionsInches, getPageMarginInches } from './puzzle-layout';
import type { MurdokuPuzzle } from './puzzles/murdoku';
import type { MurdokuSettings, MurdokuTextKey } from './murdoku-settings';
import { normalizeMurdokuSettings } from './murdoku-settings';

export interface MurdokuPageBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MurdokuPagePart = 'single' | 'characters' | 'scene';

export interface MurdokuPageLayout {
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
  safe: { left: number; top: number; right: number; bottom: number };
  pagePart: MurdokuPagePart;
  title: MurdokuPageBox;
  story: MurdokuPageBox;
  instructions: MurdokuPageBox;
  characters: MurdokuPageBox;
  grid: MurdokuPageBox;
  cellSize: number;
  clues: MurdokuPageBox;
  victim: MurdokuPageBox;
  deduction: MurdokuPageBox;
  murdererLine: MurdokuPageBox;
  legend: MurdokuPageBox;
  solutionRef: MurdokuPageBox;
  fontSizes: Record<MurdokuTextKey, number>;
}

const PT_TO_PX = 96 / 72;

const HIDDEN: MurdokuPageBox = { x: 0, y: 0, width: 0, height: 0 };

function pctBox(
  left: number,
  top: number,
  innerW: number,
  innerH: number,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number
): MurdokuPageBox {
  return {
    x: left + (xPct / 100) * innerW,
    y: top + (yPct / 100) * innerH,
    width: (wPct / 100) * innerW,
    height: (hPct / 100) * innerH,
  };
}

export function computeMurdokuPageLayout(
  settings: MurdokuSettings,
  layoutSettings: WordSearchSettings,
  pageWidthPx?: number,
  pageHeightPx?: number,
  pagePart: MurdokuPagePart = 'single'
): MurdokuPageLayout {
  const s = normalizeMurdokuSettings(settings);
  const dims = getPageDimensionsInches(layoutSettings);
  const widthPx = pageWidthPx ?? dims.width * 72 * PT_TO_PX;
  const heightPx = pageHeightPx ?? dims.height * 72 * PT_TO_PX;
  const marginIn = getPageMarginInches(layoutSettings);
  const marginPx = marginIn * 72 * PT_TO_PX;
  const left = marginPx;
  const top = marginPx;
  const innerW = Math.max(40, widthPx - marginPx * 2);
  const innerH = Math.max(40, heightPx - marginPx * 2);

  const box = (key: string, fallback: MurdokuPageBox): MurdokuPageBox => {
    const b = s.layout[key];
    if (!b || !b.visible) return { ...fallback, height: b?.visible === false ? 0 : fallback.height };
    return {
      x: left + (b.xPercent / 100) * innerW,
      y: top + (b.yPercent / 100) * innerH,
      width: (b.widthPercent / 100) * innerW,
      height: (b.heightPercent / 100) * innerH,
    };
  };

  let title = box('title', { x: left, y: top, width: innerW, height: innerH * 0.05 });
  let story = box('story', { x: left, y: title.y + title.height, width: innerW, height: innerH * 0.08 });
  let instructions = box('instructions', {
    x: left,
    y: story.y + story.height,
    width: innerW,
    height: innerH * 0.05,
  });
  let characters = box('characters', {
    x: left,
    y: instructions.y + instructions.height,
    width: innerW,
    height: innerH * 0.12,
  });
  let grid = box('grid', {
    x: left,
    y: characters.y + characters.height,
    width: innerW * 0.55,
    height: innerH * 0.42,
  });
  let clues = box('clues', {
    x: grid.x + grid.width + 12,
    y: grid.y,
    width: innerW * 0.38,
    height: innerH * 0.34,
  });
  let victim = box('victim', {
    x: clues.x,
    y: characters.y,
    width: clues.width,
    height: characters.height,
  });
  let deduction = box('deduction', {
    x: clues.x,
    y: clues.y + clues.height + 8,
    width: clues.width,
    height: innerH * 0.16,
  });
  let murdererLine = box('murdererLine', {
    x: left,
    y: grid.y + grid.height + 8,
    width: grid.width,
    height: innerH * 0.04,
  });
  let legend = box('legend', {
    x: left,
    y: murdererLine.y + murdererLine.height + 4,
    width: innerW,
    height: innerH * 0.04,
  });
  let solutionRef = box('solutionRef', {
    x: left,
    y: heightPx - marginPx - innerH * 0.03,
    width: innerW,
    height: innerH * 0.03,
  });

  if (pagePart === 'characters') {
    title = pctBox(left, top, innerW, innerH, 2, 1.5, 96, 5);
    story = HIDDEN;
    instructions = pctBox(left, top, innerW, innerH, 2, 7, 96, 6);
    characters = pctBox(left, top, innerW, innerH, 2, 14, 96, 28);
    clues = pctBox(left, top, innerW, innerH, 2, 43, 96, 36);
    deduction = s.core.showDeductionGrid
      ? pctBox(left, top, innerW, innerH, 2, 80, 96, 16)
      : HIDDEN;
    grid = HIDDEN;
    victim = HIDDEN;
    murdererLine = HIDDEN;
    legend = HIDDEN;
    solutionRef = pctBox(left, top, innerW, innerH, 2, 96, 96, 3);
  } else if (pagePart === 'scene') {
    title = pctBox(left, top, innerW, innerH, 2, 1.5, 70, 5);
    story = pctBox(left, top, innerW, innerH, 2, 7, 70, 8);
    instructions = pctBox(left, top, innerW, innerH, 2, 15.5, 70, 5);
    victim = pctBox(left, top, innerW, innerH, 74, 7, 24, 13.5);
    const gridSize = Math.min(innerW * 0.92, innerH * 0.68);
    grid = {
      x: left + (innerW - gridSize) / 2,
      y: top + innerH * 0.22,
      width: gridSize,
      height: gridSize,
    };
    murdererLine = {
      x: left,
      y: grid.y + grid.height + 8,
      width: innerW,
      height: innerH * 0.045,
    };
    legend = {
      x: left,
      y: murdererLine.y + murdererLine.height + 4,
      width: innerW,
      height: innerH * 0.035,
    };
    solutionRef = pctBox(left, top, innerW, innerH, 2, 96, 96, 3);
    characters = HIDDEN;
    clues = HIDDEN;
    deduction = HIDDEN;
  }

  const pad = s.grid.padding;
  const usable = Math.max(8, Math.min(grid.width, grid.height) - pad * 2);
  const cellSize = s.grid.autoCellSize
    ? Math.max(10, Math.floor(usable / Math.max(s.core.rows, s.core.cols)))
    : s.grid.cellSize;

  const fontSizes = {} as Record<MurdokuTextKey, number>;
  (Object.keys(s.textStyles) as MurdokuTextKey[]).forEach((key) => {
    fontSizes[key] = s.textStyles[key].fontSize;
  });

  return {
    pageWidthPx: widthPx,
    pageHeightPx: heightPx,
    marginPx,
    safe: { left: marginPx, top: marginPx, right: widthPx - marginPx, bottom: heightPx - marginPx },
    pagePart,
    title,
    story,
    instructions,
    characters,
    grid,
    cellSize,
    clues,
    victim,
    deduction,
    murdererLine,
    legend,
    solutionRef,
    fontSizes,
  };
}

export function autoBalanceMurdokuSettings(
  settings: MurdokuSettings,
  layoutSettings: WordSearchSettings,
  puzzle: MurdokuPuzzle | null
): MurdokuSettings {
  const s = normalizeMurdokuSettings(settings);
  const layout = computeMurdokuPageLayout(s, layoutSettings);
  const clueCount = puzzle?.clues.length ?? 10;
  const charCount = puzzle?.characters.filter((c) => c.enabled).length ?? s.characters.length;
  const next = structuredClone(s) as MurdokuSettings;

  const shrink = (key: MurdokuTextKey, min: number) => {
    const style = next.textStyles[key];
    const floor = Math.max(min, style.minFontSize || min);
    if (style.fontSize > floor + 1) {
      style.fontSize = Math.max(floor, style.fontSize - 1);
    }
  };

  if (clueCount > 14) {
    next.layout.clues.heightPercent = Math.min(42, next.layout.clues.heightPercent + 4);
    next.layout.grid.widthPercent = Math.max(48, next.layout.grid.widthPercent - 2);
    shrink('intro', 10);
  }
  if (charCount > 9) {
    next.cards.cardWidth = Math.max(72, next.cards.cardWidth - 6);
    next.cards.portraitWidth = Math.max(52, next.cards.portraitWidth - 6);
    next.cards.portraitHeight = Math.max(52, next.cards.portraitHeight - 6);
  }

  const gridOverflow =
    layout.pagePart === 'single' &&
    (layout.grid.y + layout.grid.height > layout.safe.bottom - 48 ||
      layout.clues.y + layout.clues.height > layout.safe.bottom - 24);
  if (gridOverflow) {
    next.layout.story.heightPercent = Math.max(5, next.layout.story.heightPercent - 1.5);
    next.layout.characters.heightPercent = Math.max(8, next.layout.characters.heightPercent - 1);
    next.grid.cellSize = Math.max(16, next.grid.cellSize - 1);
    shrink('intro', 10);
    shrink('instructions', 10);
  }

  next.textStyles.characterName.fontSize = Math.max(
    9,
    next.textStyles.characterName.minFontSize || 9
  );
  next.textStyles.characterClue.fontSize = Math.max(
    8,
    next.textStyles.characterClue.minFontSize || 8
  );

  return next;
}
