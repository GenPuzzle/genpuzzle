import type { TextPageBlock } from './document-model';
import { PT_TO_CSS_PX } from './puzzle-layout';
import { normalizeCssColorToHex } from './text-page-export-color';

export type RichTextRun = {
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
};

export type RichTextLine = {
  runs: Array<RichTextRun & { xPt: number }>;
  lineHeightPt: number;
};

function normalizeFontFamily(fontFamily: string): string {
  return fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Arial';
}

function cssFontSizeToPt(fontSize: string): number {
  const match = fontSize.trim().match(/^([\d.]+)(px|pt)$/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (match[2].toLowerCase() === 'pt') return Math.round(value);
  return Math.round(value * 0.75);
}

function isBold(fontWeight: string): boolean {
  if (fontWeight === 'bold' || fontWeight === 'bolder') return true;
  const numeric = Number.parseInt(fontWeight, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

function blockDefaults(
  block: TextPageBlock,
  fallbackColor: string
): Omit<RichTextRun, 'text'> {
  return {
    fontFamily: block.fontFamily,
    fontSize: block.fontSize,
    bold: !!block.bold,
    italic: !!block.italic,
    underline: !!block.underline,
    color: normalizeCssColorToHex(block.textColor ?? fallbackColor, fallbackColor),
  };
}

function readElementFormat(
  element: HTMLElement,
  inherited: Omit<RichTextRun, 'text'>
): Omit<RichTextRun, 'text'> {
  const tag = element.tagName.toLowerCase();
  const style = element.style;
  const next = { ...inherited };

  if (tag === 'b' || tag === 'strong') next.bold = true;
  if (tag === 'i' || tag === 'em') next.italic = true;
  if (tag === 'u') next.underline = true;

  if (style.fontFamily) {
    next.fontFamily = normalizeFontFamily(style.fontFamily);
  }
  if (style.fontSize) {
    const pt = cssFontSizeToPt(style.fontSize);
    if (pt > 0) next.fontSize = pt;
  }
  if (style.fontWeight) next.bold = isBold(style.fontWeight);
  if (style.fontStyle === 'italic') next.italic = true;
  if (style.textDecorationLine.includes('underline') || style.textDecoration.includes('underline')) {
    next.underline = true;
  }
  if (style.color) {
    next.color = normalizeCssColorToHex(style.color, inherited.color);
  }

  return next;
}

function walkNodes(
  node: Node,
  inherited: Omit<RichTextRun, 'text'>,
  runs: RichTextRun[]
): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text) runs.push({ ...inherited, text });
    return;
  }

  if (!(node instanceof HTMLElement)) return;

  const tag = node.tagName.toLowerCase();
  if (tag === 'br') {
    runs.push({ ...inherited, text: '\n' });
    return;
  }

  const next = readElementFormat(node, inherited);
  for (const child of Array.from(node.childNodes)) {
    walkNodes(child, next, runs);
  }

  if (tag === 'div' || tag === 'p') {
    runs.push({ ...inherited, text: '\n' });
  }
}

export function parseRichTextRuns(
  block: TextPageBlock,
  fallbackColor: string
): RichTextRun[] {
  const defaults = blockDefaults(block, fallbackColor);

  if (!block.richTextHtml?.trim()) {
    return block.text ? [{ ...defaults, text: block.text }] : [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${block.richTextHtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [{ ...defaults, text: block.text }];

  const runs: RichTextRun[] = [];
  for (const child of Array.from(root.childNodes)) {
    walkNodes(child, defaults, runs);
  }

  const merged: RichTextRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.fontFamily === run.fontFamily &&
      prev.fontSize === run.fontSize &&
      prev.bold === run.bold &&
      prev.italic === run.italic &&
      prev.underline === run.underline &&
      prev.color === run.color
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }

  if (merged.length > 0) {
    const last = merged[merged.length - 1]!;
    if (last.text.endsWith('\n')) {
      last.text = last.text.replace(/\n+$/, '');
    }
  }

  return merged.length > 0 ? merged : [{ ...defaults, text: block.text }];
}

export type TextSpacingOptions = {
  wordSpacingPx?: number;
  letterSpacingPx?: number;
};

function canvasFontString(run: RichTextRun): string {
  const sizePx = run.fontSize * PT_TO_CSS_PX;
  const weight = run.bold ? 'bold' : 'normal';
  const style = run.italic ? 'italic' : 'normal';
  return `${style} ${weight} ${sizePx}px ${run.fontFamily}`;
}

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

export function measureRunWidthPt(run: RichTextRun, spacing?: TextSpacingOptions): number {
  const ctx = getMeasureContext();
  if (!ctx) {
    const letterPt = (spacing?.letterSpacingPx ?? 0) / PT_TO_CSS_PX;
    return run.text.length * (run.fontSize * 0.5 + letterPt);
  }
  ctx.font = canvasFontString(run);
  const letterSpacingPx = spacing?.letterSpacingPx ?? 0;
  const wordSpacingPx = spacing?.wordSpacingPx ?? 0;

  if (letterSpacingPx === 0 && wordSpacingPx === 0) {
    return ctx.measureText(run.text).width / PT_TO_CSS_PX;
  }

  let widthPx = 0;
  for (let i = 0; i < run.text.length; i += 1) {
    const char = run.text[i]!;
    widthPx += ctx.measureText(char).width;
    if (letterSpacingPx > 0 && i < run.text.length - 1) {
      widthPx += letterSpacingPx;
    }
    if (wordSpacingPx > 0 && char === ' ') {
      widthPx += wordSpacingPx;
    }
  }
  return widthPx / PT_TO_CSS_PX;
}

/** Ascent from baseline to top of glyphs — matches browser inline baseline alignment. */
export function measureRunAscentPt(run: RichTextRun): number {
  const ctx = getMeasureContext();
  if (!ctx) return run.fontSize * 0.8;
  ctx.font = canvasFontString(run);
  const metrics = ctx.measureText('Hg');
  const ascentPx =
    metrics.actualBoundingBoxAscent && metrics.actualBoundingBoxAscent > 0
      ? metrics.actualBoundingBoxAscent
      : run.fontSize * PT_TO_CSS_PX * 0.8;
  return ascentPx / PT_TO_CSS_PX;
}

/** Shared baseline offset from line top when runs have mixed font sizes. */
export function lineBaselineFromTopPt(line: RichTextLine): number {
  if (line.runs.length === 0) return 0;
  return Math.max(...line.runs.map((run) => measureRunAscentPt(run)));
}

function maxLineHeightForRuns(runs: RichTextRun[], lineHeightMultiplier: number): number {
  if (runs.length === 0) return 12;
  return Math.max(...runs.map((run) => run.fontSize * lineHeightMultiplier));
}

export function layoutRichTextLines(
  runs: RichTextRun[],
  maxWidthPt: number,
  lineHeightMultiplier: number,
  spacing?: TextSpacingOptions
): RichTextLine[] {
  if (maxWidthPt <= 0) return [];

  const lines: RichTextLine[] = [];
  let currentRuns: Array<RichTextRun & { xPt: number }> = [];
  let cursorX = 0;
  let lineRuns: RichTextRun[] = [];

  const flushLine = () => {
    if (lineRuns.length === 0 && currentRuns.length === 0) return;
    const lineHeightPt = maxLineHeightForRuns(
      currentRuns.length > 0 ? currentRuns : lineRuns,
      lineHeightMultiplier
    );
    lines.push({ runs: currentRuns, lineHeightPt });
    currentRuns = [];
    lineRuns = [];
    cursorX = 0;
  };

  const pushRunSegment = (run: RichTextRun, segment: string) => {
    if (!segment) return;
    const segmentRun = { ...run, text: segment };
    currentRuns.push({ ...segmentRun, xPt: cursorX });
    lineRuns.push(segmentRun);
    cursorX += measureRunWidthPt(segmentRun, spacing);
  };

  const wrapWord = (run: RichTextRun, word: string) => {
    if (!word) return;
    const wordWidth = measureRunWidthPt({ ...run, text: word }, spacing);
    const spaceWidth = word.includes(' ') ? 0 : measureRunWidthPt({ ...run, text: ' ' }, spacing);

    if (cursorX > 0 && cursorX + spaceWidth + wordWidth > maxWidthPt) {
      flushLine();
    } else if (cursorX === 0 && wordWidth > maxWidthPt) {
      let chunk = '';
      for (const char of word) {
        const next = chunk + char;
        if (measureRunWidthPt({ ...run, text: next }, spacing) > maxWidthPt && chunk) {
          pushRunSegment(run, chunk);
          flushLine();
          chunk = char;
        } else {
          chunk = next;
        }
      }
      if (chunk) pushRunSegment(run, chunk);
      return;
    }

    if (cursorX > 0 && !word.startsWith('\n')) {
      pushRunSegment(run, ' ');
    }
    pushRunSegment(run, word);
  };

  for (const run of runs) {
    const parts = run.text.split(/(\n)/);
    for (const part of parts) {
      if (part === '\n') {
        flushLine();
        continue;
      }
      if (!part) continue;
      const words = part.split(/(\s+)/).filter(Boolean);
      for (const token of words) {
        if (/^\s+$/.test(token)) {
          if (cursorX > 0) pushRunSegment(run, ' ');
          continue;
        }
        wrapWord(run, token);
      }
    }
  }

  flushLine();
  return lines;
}
