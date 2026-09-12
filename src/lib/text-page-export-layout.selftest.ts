import { getDefaultTextModuleSettings } from './document-model';
import { getDefaultWordSearchSettings } from './puzzles/types';
import { createOwnershipBlock } from './text-page-blocks';
import {
  getOwnershipCanvasLayout,
  getTextPageBlockRectPt,
  getTextPageContentAreaPt,
} from './text-page-export-layout';
import { buildTocExportLayout } from './toc-export-draw';
import { DEFAULT_TOC_SETTINGS } from './toc-settings';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const globals = getDefaultWordSearchSettings();
const pageW = 8.5 * 72;
const pageH = 11 * 72;
const margin = 0.5 * 72;
const area = getTextPageContentAreaPt(pageW, pageH, margin);
const settings = getDefaultTextModuleSettings('title-page');
const ownership = createOwnershipBlock(settings, globals);
const rect = getTextPageBlockRectPt(ownership, pageH, area);
const layout = getOwnershipCanvasLayout(ownership, rect);

assert(layout.fontSizePt === ownership.fontSize, 'ownership font size is the block size in pt');
assert(
  Math.abs(layout.lineHeightPt - ownership.fontSize * 1.35) < 0.01,
  'ownership line-height matches canvas 1.35'
);
assert(
  Math.abs(layout.textTopPt - rect.innerTopFromPageTop) < 0.01,
  'label starts at the inner top of the frame'
);
assert(
  Math.abs(layout.labelBoxHeightPt - layout.lineHeightPt) < 0.01,
  'PPT label box is one CSS line, not the gap to the signature line'
);
assert(
  Math.abs(layout.nameLine.lineBottomFromPageTop - (rect.innerTopFromPageTop + rect.innerHeight)) <
    0.05,
  'signature line sits on the inner bottom (margin-top: auto)'
);
assert(
  layout.nameLine.lineTopFromPageTop > layout.textTopPt + layout.labelBoxHeightPt - 0.5,
  'signature line stays below the label line box'
);

const tocSettings = {
  ...getDefaultTextModuleSettings('table-of-contents'),
  title: 'Contents',
  tocMode: 'auto' as const,
  tocSettings: {
    ...DEFAULT_TOC_SETTINGS,
    autoFitText: false,
    titleFontSize: 22,
    entryFontSize: 14,
    lineSpacingPx: 10,
    titleBottomGapPx: 20,
    entriesTopGapPx: 4,
  },
};
const toc = buildTocExportLayout(
  tocSettings,
  globals,
  [
    { title: 'Puzzles', pageNumber: '3', level: 1, documentId: 'd1', bookPageIndex: 2 },
    { title: 'Solutions', pageNumber: '12', level: 1, documentId: 'd2', bookPageIndex: 11 },
  ],
  'Contents'
);

assert(Math.abs(toc.titleFontSizePt - 22) < 0.05, `TOC title is 22pt, got ${toc.titleFontSizePt}`);
assert(Math.abs(toc.entryFontSizePt - 14) < 0.05, `TOC entries are 14pt, got ${toc.entryFontSizePt}`);
assert(
  Math.abs(toc.entryLineHeightPt - toc.entryFontSizePt * 1.2) < 0.01,
  'TOC entry line-height is CSS 1.2'
);
assert(
  Math.abs(toc.rowHeightPt - (toc.entryLineHeightPt + toc.rowPadPt * 2)) < 0.01,
  'TOC row height is line + padding-top + padding-bottom'
);
assert(toc.columns[0] && toc.columns[0].rows.length === 2, 'two TOC rows');
const rowGap =
  toc.columns[0]!.rows[1]!.yFromTopPt - toc.columns[0]!.rows[0]!.yFromTopPt;
assert(Math.abs(rowGap - toc.rowHeightPt) < 0.01, 'PPT row spacing equals canvas row height');

console.log('text-page-export-layout.selftest ok');
