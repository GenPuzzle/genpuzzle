import type { TextPageBlock, OwnershipNameLineType } from './document-model';
import { PT_TO_CSS_PX } from './puzzle-layout';
import { normalizeCssColorToHex } from './text-page-export-color';
import type { RichTextRun } from './text-page-rich-text-export';

export type DomMeasuredRun = RichTextRun & {
  xPt: number;
  baselinePt: number;
};

export type DomMeasuredLine = {
  lineTopPt: number;
  lineHeightPt: number;
  runs: DomMeasuredRun[];
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

function formatFromElement(
  element: HTMLElement,
  block: TextPageBlock,
  fallbackColor: string
): Omit<RichTextRun, 'text'> {
  const computed = window.getComputedStyle(element);
  const pt = cssFontSizeToPt(computed.fontSize);
  return {
    fontFamily: normalizeFontFamily(computed.fontFamily) || block.fontFamily,
    fontSize: pt > 0 ? pt : block.fontSize,
    bold: isBold(computed.fontWeight),
    italic: computed.fontStyle === 'italic',
    underline:
      computed.textDecorationLine.includes('underline') ||
      computed.textDecoration.includes('underline'),
    color: normalizeCssColorToHex(
      computed.color || block.textColor || fallbackColor,
      normalizeCssColorToHex(fallbackColor)
    ),
  };
}

let measureCanvas: HTMLCanvasElement | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

function baselinePtFromRect(
  rect: DOMRect,
  containerTop: number,
  format: Omit<RichTextRun, 'text'>
): number {
  const ctx = getMeasureContext();
  if (!ctx) {
    return (rect.bottom - containerTop) / PT_TO_CSS_PX - format.fontSize * 0.2;
  }
  const sizePx = format.fontSize * PT_TO_CSS_PX;
  const weight = format.bold ? 'bold' : 'normal';
  const style = format.italic ? 'italic' : 'normal';
  ctx.font = `${style} ${weight} ${sizePx}px ${format.fontFamily}`;
  const metrics = ctx.measureText('Hg');
  const descentPx =
    metrics.actualBoundingBoxDescent && metrics.actualBoundingBoxDescent > 0
      ? metrics.actualBoundingBoxDescent
      : sizePx * 0.2;
  return (rect.bottom - descentPx - containerTop) / PT_TO_CSS_PX;
}

type RawSegment = DomMeasuredRun & { lineTopPt: number };

function measureTextNodeSegments(
  textNode: Text,
  containerRect: DOMRect,
  block: TextPageBlock,
  fallbackColor: string
): RawSegment[] {
  const text = textNode.textContent ?? '';
  if (!text) return [];

  const parent = textNode.parentElement;
  if (!parent) return [];

  const format = formatFromElement(parent, block, fallbackColor);
  const range = document.createRange();
  const segments: RawSegment[] = [];
  let lineStart = 0;

  while (lineStart < text.length) {
    range.setStart(textNode, lineStart);
    range.setEnd(textNode, Math.min(lineStart + 1, text.length));
    const firstRects = range.getClientRects();
    if (firstRects.length === 0) {
      lineStart += 1;
      continue;
    }
    const lineTop = firstRects[0]!.top;

    let lo = lineStart + 1;
    let hi = text.length;
    let lineEnd = lineStart + 1;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      range.setStart(textNode, lineStart);
      range.setEnd(textNode, mid);
      const rects = range.getClientRects();
      const lastRect = rects[rects.length - 1];
      if (lastRect && Math.abs(lastRect.top - lineTop) < 0.75) {
        lineEnd = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    range.setStart(textNode, lineStart);
    range.setEnd(textNode, lineEnd);
    const rect = range.getBoundingClientRect();
    const segment = text.slice(lineStart, lineEnd);
    if (segment) {
      segments.push({
        ...format,
        text: segment,
        xPt: (rect.left - containerRect.left) / PT_TO_CSS_PX,
        baselinePt: baselinePtFromRect(rect, containerRect.top, format),
        lineTopPt: (rect.top - containerRect.top) / PT_TO_CSS_PX,
      });
    }

    lineStart = lineEnd;
  }

  return segments;
}

function lineKey(topPt: number): string {
  return String(Math.round(topPt * 20) / 20);
}

/**
 * Measure text layout using the browser engine — matches the canvas preview exactly.
 */
export function measureTextBlockLayoutFromDom(
  block: TextPageBlock,
  innerWidthPt: number,
  fallbackColor: string
): DomMeasuredLine[] | null {
  if (typeof document === 'undefined' || innerWidthPt <= 0) return null;

  const innerWidthPx = innerWidthPt * PT_TO_CSS_PX;
  const baseFontSizePx = block.fontSize * PT_TO_CSS_PX;

  const container = document.createElement('div');
  container.setAttribute('data-text-export-measure', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    width: `${innerWidthPx}px`,
    fontFamily: block.fontFamily,
    fontSize: `${baseFontSizePx}px`,
    fontWeight: block.bold ? 'bold' : 'normal',
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    color: normalizeCssColorToHex(block.textColor ?? fallbackColor, fallbackColor),
    textAlign: block.alignment,
    whiteSpace: 'pre-wrap',
    lineHeight: String(block.lineHeight ?? 1.35),
    boxSizing: 'border-box',
    padding: '0',
    margin: '0',
    border: 'none',
    overflow: 'visible',
    ...(block.wordSpacingPx ? { wordSpacing: `${block.wordSpacingPx}px` } : {}),
    ...(block.letterSpacingPx ? { letterSpacing: `${block.letterSpacingPx}px` } : {}),
  });

  if (block.richTextHtml) {
    container.innerHTML = block.richTextHtml;
  } else {
    container.textContent = block.text;
  }

  document.body.appendChild(container);

  try {
    const containerRect = container.getBoundingClientRect();
    const segments: RawSegment[] = [];

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      segments.push(
        ...measureTextNodeSegments(node as Text, containerRect, block, fallbackColor)
      );
      node = walker.nextNode();
    }

    if (segments.length === 0) return [];

    const buckets = new Map<string, { lineTopPt: number; runs: DomMeasuredRun[] }>();
    for (const segment of segments) {
      const key = lineKey(segment.lineTopPt);
      const run: DomMeasuredRun = {
        text: segment.text,
        fontFamily: segment.fontFamily,
        fontSize: segment.fontSize,
        bold: segment.bold,
        italic: segment.italic,
        underline: segment.underline,
        color: segment.color,
        xPt: segment.xPt,
        baselinePt: segment.baselinePt,
      };
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.runs.push(run);
      } else {
        buckets.set(key, { lineTopPt: segment.lineTopPt, runs: [run] });
      }
    }

    return [...buckets.values()]
      .sort((a, b) => a.lineTopPt - b.lineTopPt)
      .map((bucket) => {
        const maxFont = Math.max(...bucket.runs.map((run) => run.fontSize));
        return {
          lineTopPt: bucket.lineTopPt,
          lineHeightPt: maxFont * (block.lineHeight ?? 1.35),
          runs: bucket.runs.sort((a, b) => a.xPt - b.xPt),
        };
      });
  } finally {
    document.body.removeChild(container);
  }
}

export type OwnershipBlockLayout = {
  textLines: DomMeasuredLine[];
  nameLineBottomPt: number;
};

/**
 * Measure ownership block text + name line using the same flex layout as the canvas preview.
 */
export function measureOwnershipBlockLayoutFromDom(
  block: TextPageBlock,
  innerWidthPt: number,
  innerHeightPt: number,
  fallbackColor: string,
  nameLineType: OwnershipNameLineType
): OwnershipBlockLayout | null {
  if (typeof document === 'undefined' || innerWidthPt <= 0 || innerHeightPt <= 0) return null;

  const innerWidthPx = innerWidthPt * PT_TO_CSS_PX;
  const innerHeightPx = innerHeightPt * PT_TO_CSS_PX;
  const baseFontSizePx = block.fontSize * PT_TO_CSS_PX;
  const lineColor = normalizeCssColorToHex(
    block.frameBorderColor ?? block.textColor ?? fallbackColor,
    fallbackColor
  );

  const body = document.createElement('div');
  body.setAttribute('data-text-export-measure', 'ownership');
  Object.assign(body.style, {
    position: 'fixed',
    left: '-20000px',
    top: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    width: `${innerWidthPx}px`,
    height: `${innerHeightPx}px`,
    boxSizing: 'border-box',
    margin: '0',
    padding: '0',
    border: 'none',
    overflow: 'visible',
  });

  const textEl = document.createElement('div');
  Object.assign(textEl.style, {
    width: '100%',
    height: 'auto',
    flex: '0 0 auto',
    minHeight: 'auto',
    overflow: 'visible',
    fontFamily: block.fontFamily,
    fontSize: `${baseFontSizePx}px`,
    fontWeight: block.bold ? 'bold' : 'normal',
    fontStyle: block.italic ? 'italic' : 'normal',
    textDecoration: block.underline ? 'underline' : 'none',
    color: normalizeCssColorToHex(block.textColor ?? fallbackColor, fallbackColor),
    textAlign: block.alignment,
    whiteSpace: 'pre-wrap',
    lineHeight: String(block.lineHeight ?? 1.35),
    boxSizing: 'border-box',
    margin: '0',
    padding: '0',
    border: 'none',
    ...(block.wordSpacingPx ? { wordSpacing: `${block.wordSpacingPx}px` } : {}),
    ...(block.letterSpacingPx ? { letterSpacing: `${block.letterSpacingPx}px` } : {}),
  });

  if (block.richTextHtml) {
    textEl.innerHTML = block.richTextHtml;
  } else {
    textEl.textContent = block.text;
  }

  body.appendChild(textEl);

  let lineEl: HTMLDivElement | null = null;
  if (nameLineType !== 'none') {
    lineEl = document.createElement('div');
    Object.assign(lineEl.style, {
      width: '100%',
      flex: '0 0 auto',
      marginTop: 'auto',
      minHeight: `${baseFontSizePx * 1.4}px`,
      borderBottom: `1px ${nameLineType} ${lineColor}`,
      boxSizing: 'border-box',
      marginLeft: '0',
      marginRight: '0',
      marginBottom: '0',
      padding: '0',
    });
    body.appendChild(lineEl);
  }

  document.body.appendChild(body);

  try {
    const bodyRect = body.getBoundingClientRect();
    const segments: RawSegment[] = [];
    const walker = document.createTreeWalker(textEl, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      segments.push(...measureTextNodeSegments(node as Text, bodyRect, block, fallbackColor));
      node = walker.nextNode();
    }

    const buckets = new Map<string, { lineTopPt: number; runs: DomMeasuredRun[] }>();
    for (const segment of segments) {
      const key = lineKey(segment.lineTopPt);
      const run: DomMeasuredRun = {
        text: segment.text,
        fontFamily: segment.fontFamily,
        fontSize: segment.fontSize,
        bold: segment.bold,
        italic: segment.italic,
        underline: segment.underline,
        color: segment.color,
        xPt: segment.xPt,
        baselinePt: segment.baselinePt,
      };
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.runs.push(run);
      } else {
        buckets.set(key, { lineTopPt: segment.lineTopPt, runs: [run] });
      }
    }

    const textLines = [...buckets.values()]
      .sort((a, b) => a.lineTopPt - b.lineTopPt)
      .map((bucket) => {
        const maxFont = Math.max(...bucket.runs.map((run) => run.fontSize));
        return {
          lineTopPt: bucket.lineTopPt,
          lineHeightPt: maxFont * (block.lineHeight ?? 1.35),
          runs: bucket.runs.sort((a, b) => a.xPt - b.xPt),
        };
      });

    const nameLineBottomPt = lineEl
      ? (lineEl.getBoundingClientRect().bottom - bodyRect.top) / PT_TO_CSS_PX
      : innerHeightPt;

    return { textLines, nameLineBottomPt };
  } finally {
    document.body.removeChild(body);
  }
}
