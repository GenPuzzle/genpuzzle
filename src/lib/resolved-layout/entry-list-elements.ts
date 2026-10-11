import type { GenericPuzzleSettings } from '../generic-puzzle-settings';
import type { ResolvedElement } from './types';

/**
 * Word / number list printed under Fill-In and Word Snake grids. Built from
 * plain `text` / `line` primitives so canvas, PDF, and PPTX already draw it;
 * the shared `word-list` format target edits its font.
 *
 * Layout: length groups sit side-by-side as columns (heading + dotted rule +
 * vertical word stack), wrapping to additional rows when needed — matching a
 * professional puzzle-book word bank.
 *
 * Word Snake can override columns + H/V spacing (same controls as Word Search).
 */
export type EntryListGroup = { heading: string | null; items: string[] };

export type EntryListStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  /** Force this many columns (Word Search–style). When set, skips auto packing. */
  columns?: number;
  /** Horizontal gap between columns (pt). Matches Word Search Space Horizontal. */
  columnGapPt?: number;
  /**
   * Extra vertical space between word rows (pt).
   * lineHeight = fontSize + wordSpacingVerticalPt (Word Search Space Vertical).
   */
  wordSpacingVerticalPt?: number;
};

/** Readable bank default; canvas/sidebar can still raise it further. */
export const ENTRY_LIST_DEFAULT_FONT_PT = 16;

export function entryListStyle(gp: GenericPuzzleSettings): EntryListStyle {
  const t = gp.typography;
  return {
    fontFamily: t.wordListFontFamily || t.puzzleFontFamily || 'Arial',
    fontSize: Math.max(
      10,
      Math.min(28, Number(t.wordListFontSize) || ENTRY_LIST_DEFAULT_FONT_PT)
    ),
    color: gp.colors.wordListColor || gp.colors.gridColor || '#111111',
    bold: t.wordListBold === true,
    italic: t.wordListItalic === true,
  };
}

/** Word Snake word bank: same base fonts + Word Search spacing/columns controls. */
export function snakeEntryListStyle(gp: GenericPuzzleSettings): EntryListStyle {
  const core = gp.core;
  return {
    ...entryListStyle(gp),
    columns: Math.max(1, Math.min(4, Math.round(core.snakeWordListColumns || 2))),
    columnGapPt: Math.max(0, Number(core.snakeWordSpacingHorizontal) || 50),
    wordSpacingVerticalPt: Math.max(0, Number(core.snakeWordSpacingVertical) || 8),
  };
}

const CHAR_W = 0.58; // average glyph width / font size for caps sans
const LINE_GAP = 1.32;

type GroupBlock = {
  heading: string | null;
  items: string[];
  subCols: number;
  colWidth: number;
  columnGap: number;
  width: number;
  height: number;
  lineHeight: number;
  headingHeight: number;
  underlineY: number;
  itemsTop: number;
};

type PackedRow = {
  groups: GroupBlock[];
  width: number;
  height: number;
};

function textWidthPt(text: string, fontSize: number): number {
  return Math.max(1, Array.from(text).length) * fontSize * CHAR_W;
}

function resolveLineHeight(style: EntryListStyle): number {
  if (style.wordSpacingVerticalPt != null && Number.isFinite(style.wordSpacingVerticalPt)) {
    return style.fontSize + Math.max(0, style.wordSpacingVerticalPt);
  }
  return style.fontSize * LINE_GAP;
}

function resolveGroupGap(style: EntryListStyle): number {
  if (style.columnGapPt != null && Number.isFinite(style.columnGapPt)) {
    return Math.max(0, style.columnGapPt);
  }
  return style.fontSize * 1.65;
}

function buildGroupBlock(
  group: EntryListGroup,
  style: EntryListStyle,
  subCols: number
): GroupBlock {
  const fs = style.fontSize;
  const lineHeight = resolveLineHeight(style);
  const headingHeight = group.heading ? lineHeight : 0;
  const longest = Math.max(
    group.heading ? textWidthPt(group.heading, fs) : 0,
    ...group.items.map((s) => textWidthPt(s, fs)),
    fs * 3
  );
  const colWidth = longest + fs * 1.35;
  const cols = Math.max(1, subCols);
  const columnGap = cols > 1 ? resolveGroupGap(style) : 0;
  const itemRows = Math.max(1, Math.ceil(group.items.length / cols));
  const underlineGap = group.heading ? fs * 0.12 : 0;
  const afterRule = group.heading ? fs * 0.42 : 0;
  const itemsTop = headingHeight + underlineGap + afterRule;
  // Spaced mode: vertical gap is only BETWEEN rows (no trailing gap under the last word).
  const itemsBlockH =
    style.wordSpacingVerticalPt != null
      ? (itemRows - 1) * lineHeight + fs
      : itemRows * lineHeight;
  const height = itemsTop + itemsBlockH;
  return {
    heading: group.heading,
    items: group.items,
    subCols: cols,
    colWidth,
    columnGap,
    width: cols * colWidth + Math.max(0, cols - 1) * columnGap,
    height,
    lineHeight,
    headingHeight,
    underlineY: headingHeight + underlineGap,
    itemsTop,
  };
}

function packGroupRows(
  groups: EntryListGroup[],
  widthPt: number,
  style: EntryListStyle
): PackedRow[] {
  const forcedColumns =
    style.columns != null && Number.isFinite(style.columns)
      ? Math.max(1, Math.min(4, Math.round(style.columns)))
      : null;

  // Word Search–style: one bank, N columns, H/V spacing from settings.
  if (forcedColumns != null) {
    const items = groups.flatMap((g) => g.items).filter(Boolean);
    if (!items.length) return [];
    const block = buildGroupBlock({ heading: null, items }, style, forcedColumns);
    return [{ groups: [block], width: block.width, height: block.height }];
  }

  const gap = resolveGroupGap(style);
  const blocks = groups
    .filter((g) => g.items.length > 0)
    .map((g) => buildGroupBlock(g, style, 1));

  const rows: PackedRow[] = [];
  let current: GroupBlock[] = [];
  let rowWidth = 0;

  const flush = () => {
    if (!current.length) return;
    const height = Math.max(...current.map((g) => g.height));
    const width =
      current.reduce((sum, g) => sum + g.width, 0) + gap * Math.max(0, current.length - 1);
    rows.push({ groups: current, width, height });
    current = [];
    rowWidth = 0;
  };

  for (const block of blocks) {
    const nextWidth = current.length === 0 ? block.width : rowWidth + gap + block.width;
    if (current.length > 0 && nextWidth > widthPt + 0.5) {
      flush();
    }
    current.push(block);
    rowWidth = current.length === 1 ? block.width : rowWidth + gap + block.width;
  }
  flush();

  // Alone on a row with several words → split into sub-columns (reference layout).
  return rows.map((row) => {
    if (row.groups.length !== 1) return row;
    const only = row.groups[0]!;
    if (only.items.length < 4) return row;
    const wantCols = Math.min(3, Math.ceil(only.items.length / 2));
    let best = only;
    for (let cols = 2; cols <= wantCols; cols++) {
      const candidate = buildGroupBlock(
        { heading: only.heading, items: only.items },
        style,
        cols
      );
      if (candidate.width <= widthPt + 0.5) best = candidate;
    }
    return { groups: [best], width: best.width, height: best.height };
  });
}

function planEntryList(
  groups: EntryListGroup[],
  widthPt: number,
  style: EntryListStyle
): { rows: PackedRow[]; heightPt: number; rowGap: number } {
  const rows = packGroupRows(groups, widthPt, style);
  const rowGap =
    style.wordSpacingVerticalPt != null
      ? Math.max(0, style.wordSpacingVerticalPt)
      : style.fontSize * 0.95;
  let heightPt = 0;
  rows.forEach((row, i) => {
    heightPt += row.height;
    if (i < rows.length - 1) heightPt += rowGap;
  });
  return { rows, heightPt, rowGap };
}

/** Height the list needs for `widthPt`; page layout reserves this under the grid. */
export function measureEntryList(
  groups: EntryListGroup[],
  widthPt: number,
  style: EntryListStyle
): number {
  if (!groups.some((g) => g.items.length)) return 0;
  return planEntryList(groups, widthPt, style).heightPt;
}

export function buildEntryListElements(args: {
  groups: EntryListGroup[];
  x: number;
  y: number;
  widthPt: number;
  style: EntryListStyle;
}): { elements: ResolvedElement[]; heightPt: number } {
  const { groups, x, y, widthPt, style } = args;
  const elements: ResolvedElement[] = [];
  if (!groups.some((g) => g.items.length)) return { elements, heightPt: 0 };

  const plan = planEntryList(groups, widthPt, style);
  const gap = resolveGroupGap(style);
  const dash = [Math.max(1.1, style.fontSize * 0.12), Math.max(1.4, style.fontSize * 0.16)];
  let cursorY = y;

  for (let ri = 0; ri < plan.rows.length; ri++) {
    const row = plan.rows[ri]!;
    let cursorX = x + Math.max(0, (widthPt - row.width) / 2);

    for (const group of row.groups) {
      if (group.heading) {
        elements.push({
          kind: 'text',
          x: cursorX,
          y: cursorY,
          w: group.width,
          h: group.headingHeight,
          text: group.heading,
          lines: [group.heading],
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          color: style.color,
          bold: true,
          italic: style.italic,
          align: 'center',
          valign: 'middle',
          lineHeight: group.headingHeight,
        });
        const rulePad = style.fontSize * 0.15;
        elements.push({
          kind: 'line',
          x1: cursorX + rulePad,
          y1: cursorY + group.underlineY,
          x2: cursorX + group.width - rulePad,
          y2: cursorY + group.underlineY,
          color: style.color,
          width: Math.max(0.6, style.fontSize * 0.06),
          dash,
        });
      }

      const perCol = Math.ceil(group.items.length / group.subCols);
      const colStride = group.colWidth + group.columnGap;
      // Word Search–style vertical spacing: gap sits BETWEEN rows. Keep glyphs at the
      // top of each row so Space Vertical does not also push the list away from the grid.
      const spacedRows = style.wordSpacingVerticalPt != null;
      const textH = spacedRows ? style.fontSize : group.lineHeight;
      const textValign = spacedRows ? 'top' : 'middle';
      group.items.forEach((text, index) => {
        const col = Math.floor(index / perCol);
        const rowIndex = index % perCol;
        elements.push({
          kind: 'text',
          x: cursorX + col * colStride,
          y: cursorY + group.itemsTop + rowIndex * group.lineHeight,
          w: group.colWidth,
          h: textH,
          text,
          lines: [text],
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          color: style.color,
          bold: style.bold,
          italic: style.italic,
          align: 'left',
          valign: textValign,
          lineHeight: textH,
        });
      });

      cursorX += group.width + gap;
    }

    cursorY += row.height;
    if (ri < plan.rows.length - 1) cursorY += plan.rowGap;
  }

  return { elements, heightPt: plan.heightPt };
}
