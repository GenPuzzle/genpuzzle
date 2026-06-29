import { ptToCssPx } from './compute-row';

function estimateTextWidthPt(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  bold: boolean
): number {
  return text.length * fontSizePt * (bold ? 0.58 : 0.5);
}

export function measureTextWidthPt(
  text: string,
  fontSizePt: number,
  fontFamily: string,
  bold = true
): number {
  if (!text) return 0;

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = `${bold ? 'bold ' : ''}${ptToCssPx(fontSizePt)}px ${fontFamily}, Arial, sans-serif`;
      return ctx.measureText(text).width / ptToCssPx(1);
    }
  }

  return estimateTextWidthPt(text, fontSizePt, fontFamily, bold);
}

/** Shrink font size until single-line title text fits within maxWidthPt. */
export function fitSingleLineFontSizePt(
  text: string,
  maxWidthPt: number,
  baseFontSizePt: number,
  fontFamily: string,
  bold = true,
  minFontSizePt = 9
): number {
  if (!text || maxWidthPt <= 0) return baseFontSizePt;

  const minSize = Math.min(baseFontSizePt, minFontSizePt);
  let size = baseFontSizePt;

  while (size > minSize && measureTextWidthPt(text, size, fontFamily, bold) > maxWidthPt) {
    size -= 0.5;
  }

  if (measureTextWidthPt(text, size, fontFamily, bold) > maxWidthPt) {
    return minSize;
  }

  return size;
}

/** Word-wrap text to max width in points (canvas metrics in browser, estimate on server). */
export function wrapTextLinesPt(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  fontFamily: string,
  bold = true
): string[] {
  if (!text || maxWidthPt <= 0) return [];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (measureTextWidthPt(testLine, fontSizePt, fontFamily, bold) <= maxWidthPt) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (measureTextWidthPt(word, fontSizePt, fontFamily, bold) <= maxWidthPt) {
      currentLine = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > 0) {
      let low = 1;
      let high = remaining.length;
      let bestFit = 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = remaining.slice(0, mid);
        if (measureTextWidthPt(chunk, fontSizePt, fontFamily, bold) <= maxWidthPt) {
          bestFit = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      lines.push(remaining.slice(0, bestFit));
      remaining = remaining.slice(bestFit);
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

export function resolveFittedHeaderTitleFontSizePt(
  titleText: string,
  baseFontSizePt: number,
  maxWidthPt: number,
  fontFamily: string
): number {
  if (!titleText) return baseFontSizePt;
  return fitSingleLineFontSizePt(titleText, maxWidthPt, baseFontSizePt, fontFamily, true, 9);
}

export type TextWidthMeasurer = (text: string, fontSizePt: number) => number;

export interface SolutionTitleLayout {
  lines: string[];
  fontSizePt: number;
  lineHeightPt: number;
}

function fitSingleLineFontSizeWithMeasure(
  text: string,
  maxWidthPt: number,
  baseFontSizePt: number,
  measure: TextWidthMeasurer,
  minFontSizePt = 8
): number {
  if (!text || maxWidthPt <= 0) return baseFontSizePt;

  const minSize = Math.min(baseFontSizePt, minFontSizePt);
  let size = baseFontSizePt;

  while (size > minSize && measure(text, size) > maxWidthPt) {
    size -= 0.5;
  }

  if (measure(text, size) > maxWidthPt) {
    return minSize;
  }

  return size;
}

function wrapPlainTextLinesWithMeasure(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  measure: TextWidthMeasurer
): string[] {
  if (!text || maxWidthPt <= 0) return [];

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (measure(testLine, fontSizePt) <= maxWidthPt) {
      currentLine = testLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (measure(word, fontSizePt) <= maxWidthPt) {
      currentLine = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > 0) {
      let low = 1;
      let high = remaining.length;
      let bestFit = 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const chunk = remaining.slice(0, mid);
        if (measure(chunk, fontSizePt) <= maxWidthPt) {
          bestFit = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      lines.push(remaining.slice(0, bestFit));
      remaining = remaining.slice(bestFit);
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [text];
}

/** Keep "N. " prefix on the same line as at least the first title word. */
function wrapTextLinesPreserveNumberPrefix(
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  measure: TextWidthMeasurer
): string[] {
  const prefixMatch = text.match(/^(\d+\.\s+)([\s\S]+)$/);
  if (prefixMatch) {
    const lead = prefixMatch[1];
    const words = prefixMatch[2].split(/\s+/).filter(Boolean);
    const firstLineWords: string[] = [];

    for (const word of words) {
      const testLine = lead + [...firstLineWords, word].join(' ');
      if (measure(testLine, fontSizePt) <= maxWidthPt) {
        firstLineWords.push(word);
      } else if (firstLineWords.length === 0) {
        firstLineWords.push(word);
        break;
      } else {
        break;
      }
    }

    const lines = [lead + firstLineWords.join(' ')];
    const remaining = words.slice(firstLineWords.length).join(' ');
    if (remaining) {
      lines.push(
        ...wrapPlainTextLinesWithMeasure(remaining, maxWidthPt, fontSizePt, measure)
      );
    }
    return lines;
  }

  const suffixMatch = text.match(/^([\s\S]+?)(\s+#\d+)$/);
  if (suffixMatch) {
    const body = suffixMatch[1];
    const tail = suffixMatch[2];
    const words = body.split(/\s+/).filter(Boolean);
    if (words.length === 0) return [text];

    const bodyLines = wrapPlainTextLinesWithMeasure(
      body,
      maxWidthPt,
      fontSizePt,
      measure
    );
    const lastIdx = bodyLines.length - 1;
    const lastLine = `${bodyLines[lastIdx]}${tail}`;
    if (measure(lastLine, fontSizePt) <= maxWidthPt) {
      bodyLines[lastIdx] = lastLine;
      return bodyLines;
    }

    if (bodyLines.length === 1) {
      return [text];
    }

    const movedWord = bodyLines[lastIdx];
    bodyLines.pop();
    const penultimate = `${bodyLines[bodyLines.length - 1]} ${movedWord}${tail}`;
    if (measure(penultimate, fontSizePt) <= maxWidthPt) {
      bodyLines[bodyLines.length - 1] = penultimate;
      return bodyLines;
    }

    bodyLines.push(`${movedWord}${tail}`);
    return bodyLines;
  }

  return wrapPlainTextLinesWithMeasure(text, maxWidthPt, fontSizePt, measure);
}

/** Minimum first line for prefix-numbered titles: "N. firstWord". */
function getPrefixNumberedFirstLineMinimum(text: string): string | null {
  const match = text.match(/^(\d+\.\s+)(\S+)/);
  if (!match) return null;
  return `${match[1]}${match[2]}`;
}

/** Minimum last line for suffix-numbered titles: "lastWord #N". */
function getSuffixNumberedLastLineMinimum(text: string): string | null {
  const match = text.match(/^(.+?)(\s+#\d+)$/);
  if (!match) return null;
  const bodyWords = match[1].trim().split(/\s+/).filter(Boolean);
  if (bodyWords.length === 0) return null;
  return `${bodyWords[bodyWords.length - 1]}${match[2]}`;
}

/**
 * Wrap solution block titles at the configured font size (multi-line allowed).
 * Puzzle numbers are never left alone on a line (e.g. "1. Success-Mindset" / "Moments").
 * Font shrinks only when a single long word must stay beside the number on line 1.
 */
export function layoutSolutionBlockTitlePt(
  text: string,
  maxWidthPt: number,
  baseFontSizePt: number,
  fontFamily: string,
  bold = true,
  minFontSizePt = 8,
  measure?: TextWidthMeasurer
): SolutionTitleLayout {
  const lineHeightFactor = 1.1;
  if (!text || maxWidthPt <= 0) {
    return {
      lines: [],
      fontSizePt: baseFontSizePt,
      lineHeightPt: baseFontSizePt * lineHeightFactor,
    };
  }

  const measureWidth =
    measure ?? ((line, size) => measureTextWidthPt(line, size, fontFamily, bold));

  let fontSizePt = baseFontSizePt;

  const prefixFirstLineMin = getPrefixNumberedFirstLineMinimum(text);
  if (
    prefixFirstLineMin &&
    measureWidth(prefixFirstLineMin, fontSizePt) > maxWidthPt
  ) {
    fontSizePt = fitSingleLineFontSizeWithMeasure(
      prefixFirstLineMin,
      maxWidthPt,
      baseFontSizePt,
      measureWidth,
      minFontSizePt
    );
  }

  const suffixLastLineMin = getSuffixNumberedLastLineMinimum(text);
  if (
    suffixLastLineMin &&
    measureWidth(suffixLastLineMin, fontSizePt) > maxWidthPt
  ) {
    fontSizePt = fitSingleLineFontSizeWithMeasure(
      suffixLastLineMin,
      maxWidthPt,
      Math.min(fontSizePt, baseFontSizePt),
      measureWidth,
      minFontSizePt
    );
  }

  const lines = wrapTextLinesPreserveNumberPrefix(
    text,
    maxWidthPt,
    fontSizePt,
    measureWidth
  );

  return {
    lines,
    fontSizePt,
    lineHeightPt: fontSizePt * lineHeightFactor,
  };
}
