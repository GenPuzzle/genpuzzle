import type { TextPageBlock } from './document-model';

export type TextRichFormatCommand =
  | { type: 'fontFamily'; value: string }
  | { type: 'fontSize'; value: number }
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'textColor'; value: string };

export type TextSelectionFormat = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textColor: string;
  hasTextSelection: boolean;
  mixedFontFamily: boolean;
  mixedFontSize: boolean;
  mixedBold: boolean;
  mixedItalic: boolean;
  mixedUnderline: boolean;
  mixedTextColor: boolean;
};

const savedSelections = new Map<string, Range>();

export function getTextBlockEditorElement(blockId: string): HTMLElement | null {
  return document.querySelector(`[data-text-block-id="${blockId}"]`);
}

export function captureTextBlockSelection(blockId: string, root: HTMLElement): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const range = sel.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;

  if (range.collapsed) return;

  savedSelections.set(blockId, range.cloneRange());
}

export function hasSavedTextSelection(blockId: string): boolean {
  return savedSelections.has(blockId);
}

export function restoreTextBlockSelection(blockId: string): boolean {
  const range = savedSelections.get(blockId);
  const el = getTextBlockEditorElement(blockId);
  if (!range || !el) return false;

  el.focus();
  const sel = window.getSelection();
  if (!sel) return false;

  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function expandRangeToWord(range: Range): boolean {
  const { startContainer, startOffset } = range;
  if (startContainer.nodeType !== Node.TEXT_NODE) return false;

  const text = startContainer.textContent ?? '';
  let start = startOffset;
  let end = startOffset;

  while (start > 0 && /\S/.test(text[start - 1] ?? '')) start -= 1;
  while (end < text.length && /\S/.test(text[end] ?? '')) end += 1;

  if (start === end) return false;

  range.setStart(startContainer, start);
  range.setEnd(startContainer, end);
  return true;
}

function cssFontSizeToPt(fontSize: string): number {
  const match = fontSize.trim().match(/^([\d.]+)(px|pt)$/i);
  if (!match) return 0;
  const value = Number.parseFloat(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (match[2].toLowerCase() === 'pt') return Math.round(value);
  return Math.round(value * 0.75);
}

function rgbToHex(color: string): string | null {
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return null;
  const [r, g, b] = match.slice(1, 4).map((part) => Number.parseInt(part, 10));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function normalizeFontFamily(fontFamily: string): string {
  return fontFamily.split(',')[0]?.replace(/['"]/g, '').trim() || 'Arial';
}

function isBold(fontWeight: string): boolean {
  if (fontWeight === 'bold' || fontWeight === 'bolder') return true;
  const numeric = Number.parseInt(fontWeight, 10);
  return Number.isFinite(numeric) && numeric >= 600;
}

function blockDefaultsToFormat(block: TextPageBlock, textColor: string): TextSelectionFormat {
  return {
    fontFamily: block.fontFamily,
    fontSize: block.fontSize,
    bold: !!block.bold,
    italic: !!block.italic,
    underline: !!block.underline,
    textColor,
    hasTextSelection: false,
    mixedFontFamily: false,
    mixedFontSize: false,
    mixedBold: false,
    mixedItalic: false,
    mixedUnderline: false,
    mixedTextColor: false,
  };
}

function getFormatForElement(
  element: HTMLElement,
  block: TextPageBlock,
  fallbackTextColor: string
): Pick<
  TextSelectionFormat,
  'fontFamily' | 'fontSize' | 'bold' | 'italic' | 'underline' | 'textColor'
> {
  const computed = window.getComputedStyle(element);
  return {
    fontFamily: normalizeFontFamily(computed.fontFamily) || block.fontFamily,
    fontSize: cssFontSizeToPt(computed.fontSize) || block.fontSize,
    bold: isBold(computed.fontWeight),
    italic: computed.fontStyle === 'italic',
    underline: computed.textDecorationLine.includes('underline'),
    textColor: rgbToHex(computed.color) ?? fallbackTextColor,
  };
}

function resolveFormatElement(range: Range, root: HTMLElement): HTMLElement | null {
  let node: Node | null = range.collapsed ? range.startContainer : range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  if (!(node instanceof HTMLElement) || !root.contains(node)) {
    return null;
  }
  return node;
}

function getActiveSelectionRange(blockId: string, el: HTMLElement): Range | null {
  const savedRange = savedSelections.get(blockId);
  if (savedRange && !savedRange.collapsed && el.contains(savedRange.commonAncestorContainer)) {
    return savedRange.cloneRange();
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (range.collapsed || !el.contains(range.commonAncestorContainer)) return null;

  return range.cloneRange();
}

function readFormatFromRange(
  root: HTMLElement,
  range: Range,
  block: TextPageBlock,
  fallbackTextColor: string
): TextSelectionFormat {
  if (range.collapsed) {
    const element = resolveFormatElement(range, root);
    if (!element) {
      return blockDefaultsToFormat(block, fallbackTextColor);
    }
    const values = getFormatForElement(element, block, fallbackTextColor);
    return {
      ...values,
      hasTextSelection: false,
      mixedFontFamily: false,
      mixedFontSize: false,
      mixedBold: false,
      mixedItalic: false,
      mixedUnderline: false,
      mixedTextColor: false,
    };
  }

  const fontFamilies = new Set<string>();
  const fontSizes = new Set<number>();
  const boldValues = new Set<boolean>();
  const italicValues = new Set<boolean>();
  const underlineValues = new Set<boolean>();
  const textColors = new Set<string>();

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!range.intersectsNode(node)) return NodeFilter.FILTER_REJECT;
      if (!(node.textContent ?? '').length) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let walked = false;
  while (walker.nextNode()) {
    walked = true;
    const textNode = walker.currentNode;
    const parent = textNode.parentElement;
    if (!parent) continue;
    const values = getFormatForElement(parent, block, fallbackTextColor);
    fontFamilies.add(values.fontFamily);
    fontSizes.add(values.fontSize);
    boldValues.add(values.bold);
    italicValues.add(values.italic);
    underlineValues.add(values.underline);
    textColors.add(values.textColor.toLowerCase());
  }

  if (!walked) {
    const element = resolveFormatElement(range, root);
    if (!element) {
      return blockDefaultsToFormat(block, fallbackTextColor);
    }
    const values = getFormatForElement(element, block, fallbackTextColor);
    return {
      ...values,
      hasTextSelection: true,
      mixedFontFamily: false,
      mixedFontSize: false,
      mixedBold: false,
      mixedItalic: false,
      mixedUnderline: false,
      mixedTextColor: false,
    };
  }

  const pickSingle = <T,>(values: Set<T>, fallback: T): T =>
    values.size === 1 ? [...values][0]! : fallback;

  return {
    fontFamily: pickSingle(fontFamilies, block.fontFamily),
    fontSize: pickSingle(fontSizes, block.fontSize),
    bold: pickSingle(boldValues, !!block.bold),
    italic: pickSingle(italicValues, !!block.italic),
    underline: pickSingle(underlineValues, !!block.underline),
    textColor: pickSingle(textColors, fallbackTextColor),
    hasTextSelection: true,
    mixedFontFamily: fontFamilies.size > 1,
    mixedFontSize: fontSizes.size > 1,
    mixedBold: boldValues.size > 1,
    mixedItalic: italicValues.size > 1,
    mixedUnderline: underlineValues.size > 1,
    mixedTextColor: textColors.size > 1,
  };
}

export function readSelectionFormat(
  blockId: string,
  block: TextPageBlock,
  fallbackTextColor: string
): TextSelectionFormat | null {
  const el = getTextBlockEditorElement(blockId);
  if (!el) return null;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      return readFormatFromRange(el, range, block, fallbackTextColor);
    }
  }

  const savedRange = savedSelections.get(blockId);
  if (savedRange && el.contains(savedRange.commonAncestorContainer)) {
    return readFormatFromRange(el, savedRange, block, fallbackTextColor);
  }

  return null;
}

function rangeCoversEntireEditor(range: Range, el: HTMLElement): boolean {
  const fullText = el.textContent ?? '';
  if (!fullText.length) return false;

  const selectedText = range.toString();
  if (selectedText.length > 0 && selectedText === fullText) {
    return true;
  }

  const full = document.createRange();
  full.selectNodeContents(el);
  return (
    range.compareBoundaryPoints(Range.START_TO_START, full) === 0 &&
    range.compareBoundaryPoints(Range.END_TO_END, full) === 0
  );
}

export function isEntireTextBlockSelected(blockId: string): boolean {
  const el = getTextBlockEditorElement(blockId);
  if (!el) return false;

  const range = getActiveSelectionRange(blockId, el);
  if (!range) return false;

  return rangeCoversEntireEditor(range, el);
}

export function flattenTextBlockEditorContent(blockId: string): string {
  const el = getTextBlockEditorElement(blockId);
  if (!el) return '';
  const text = el.textContent ?? '';
  el.textContent = text;
  savedSelections.delete(blockId);
  return text;
}

export function clearSavedTextSelection(blockId: string): void {
  savedSelections.delete(blockId);
}

function resolveRangeForFormatting(blockId: string, el: HTMLElement): Range | null {
  const savedRange = savedSelections.get(blockId);
  if (savedRange && el.contains(savedRange.commonAncestorContainer) && !savedRange.collapsed) {
    return savedRange.cloneRange();
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const liveRange = sel.getRangeAt(0);
  if (!el.contains(liveRange.commonAncestorContainer)) return null;

  const range = liveRange.cloneRange();
  if (range.collapsed && !expandRangeToWord(range)) {
    return null;
  }

  if (range.collapsed) return null;
  return range;
}

function applyInlineStylesToRange(
  blockId: string,
  range: Range,
  styles: Record<string, string>
): void {
  const span = document.createElement('span');
  Object.assign(span.style, styles);

  try {
    range.surroundContents(span);
  } catch {
    const fragment = range.extractContents();
    span.appendChild(fragment);
    range.insertNode(span);
  }

  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  sel.addRange(nextRange);
  savedSelections.set(blockId, nextRange.cloneRange());
}

function applyExecCommand(command: 'bold' | 'italic' | 'underline'): boolean {
  try {
    return document.execCommand(command, false);
  } catch {
    return false;
  }
}

export function applyRichTextFormatToBlock(blockId: string, command: TextRichFormatCommand): boolean {
  const el = getTextBlockEditorElement(blockId);
  if (!el) return false;

  const range = resolveRangeForFormatting(blockId, el);
  if (!range) return false;

  el.focus();
  const sel = window.getSelection();
  if (!sel) return false;

  sel.removeAllRanges();
  sel.addRange(range);

  switch (command.type) {
    case 'bold': {
      const ok = applyExecCommand('bold');
      if (ok && sel.rangeCount > 0) {
        savedSelections.set(blockId, sel.getRangeAt(0).cloneRange());
      }
      return ok;
    }
    case 'italic': {
      const ok = applyExecCommand('italic');
      if (ok && sel.rangeCount > 0) {
        savedSelections.set(blockId, sel.getRangeAt(0).cloneRange());
      }
      return ok;
    }
    case 'underline': {
      const ok = applyExecCommand('underline');
      if (ok && sel.rangeCount > 0) {
        savedSelections.set(blockId, sel.getRangeAt(0).cloneRange());
      }
      return ok;
    }
    case 'fontFamily':
      applyInlineStylesToRange(blockId, range, { fontFamily: command.value });
      return true;
    case 'fontSize':
      applyInlineStylesToRange(blockId, range, { fontSize: `${command.value}pt` });
      return true;
    case 'textColor':
      applyInlineStylesToRange(blockId, range, { color: command.value });
      return true;
    default:
      return false;
  }
}

export function readRichTextFromElement(el: HTMLElement): {
  text: string;
  richTextHtml?: string;
} {
  const text = el.textContent ?? '';
  const html = el.innerHTML;
  const hasRichMarkup =
    /<(span|b|i|u|strong|em|font)\b/i.test(html) || /style\s*=/.test(html);

  return {
    text,
    richTextHtml: hasRichMarkup ? html : undefined,
  };
}

export function syncRichTextBlockFromDom(
  blockId: string,
  onSync: (payload: { text: string; richTextHtml?: string }) => void
): boolean {
  const el = getTextBlockEditorElement(blockId);
  if (!el) return false;
  onSync(readRichTextFromElement(el));
  return true;
}

export function isTextBlockKind(block: TextPageBlock): boolean {
  return block.kind !== 'image';
}

export function textSelectionFormatsEqual(
  a: TextSelectionFormat | null,
  b: TextSelectionFormat | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.textColor.toLowerCase() === b.textColor.toLowerCase() &&
    a.hasTextSelection === b.hasTextSelection &&
    a.mixedFontFamily === b.mixedFontFamily &&
    a.mixedFontSize === b.mixedFontSize &&
    a.mixedBold === b.mixedBold &&
    a.mixedItalic === b.mixedItalic &&
    a.mixedUnderline === b.mixedUnderline &&
    a.mixedTextColor === b.mixedTextColor
  );
}

export const TEXT_BLOCK_SELECTION_EVENT = 'text-page-block-selection';

export function notifyTextBlockSelectionChange(blockId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(TEXT_BLOCK_SELECTION_EVENT, {
      detail: { blockId },
    })
  );
}
