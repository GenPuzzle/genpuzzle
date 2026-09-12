import { getDefaultTextModuleSettings } from './document-model';
import { getDefaultWordSearchSettings } from './puzzles/types';
import {
  TEXT_PAGE_BODY_LINE_HEIGHT,
  TEXT_PAGE_CANVAS_PAD_PT,
  TEXT_PAGE_TITLE_MARGIN_BOTTOM_PT,
  buildLegacyCenteredTextLayout,
  wrapPreWrapLinesPt,
} from './text-page-legacy-layout';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const globals = getDefaultWordSearchSettings();
const settings = {
  ...getDefaultTextModuleSettings('introduction'),
  title: 'Welcome',
  content: 'Line one.\nLine two.',
  fontSize: 18,
  titleFontSize: 22,
  alignment: 'center' as const,
};

const layout = buildLegacyCenteredTextLayout(settings, globals, 8.5 * 72, 11 * 72, 'Introduction');

assert(layout.boxLeftPt > TEXT_PAGE_CANVAS_PAD_PT, 'includes page margin + canvas padding');
assert(layout.lines.length >= 3, `expected title + two body lines, got ${layout.lines.length}`);
assert(layout.lines[0].bold && layout.lines[0].fontSizePt === 22, 'title size/bold');
assert(layout.lines[1].fontSizePt === 18 && !layout.lines[1].bold, 'body size');
assert(
  Math.abs(layout.lines[0].lineHeightPt - 22 * TEXT_PAGE_BODY_LINE_HEIGHT) < 0.01,
  'title line-height 1.3'
);
assert(
  Math.abs(layout.lines[1].topPt - (layout.lines[0].topPt + layout.lines[0].lineHeightPt + TEXT_PAGE_TITLE_MARGIN_BOTTOM_PT)) < 0.05,
  'mb-4 gap between title and body'
);

const wrapped = wrapPreWrapLinesPt('Hello\n\nWorld', 1000, 12, 'Arial', false);
assert(wrapped.length === 3 && wrapped[1] === '', 'pre-wrap preserves blank lines');

console.log('text-page-legacy-layout.selftest ok');
