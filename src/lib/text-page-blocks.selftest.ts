import { createDocumentPage, createInsertableDocumentPage, getDefaultTextModuleSettings } from './document-model';
import { isSpecialBlankTitlePage } from './insert-separator-page';
import { getDefaultWordSearchSettings } from './puzzles/types';
import {
  createDefaultTitlePageBlocks,
  resolveTextPageBlocks,
} from './text-page-blocks';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const globals = getDefaultWordSearchSettings();
const settings = getDefaultTextModuleSettings('title-page');
const blocks = createDefaultTitlePageBlocks('Title Page', settings, globals);

assert(blocks.length === 5, `expected 5 default blocks, got ${blocks.length}`);
assert(blocks[0].kind === 'text' && blocks[0].text === 'Series Title', 'series line');
assert(blocks[1].kind === 'title' && blocks[1].text === 'Book Title' && blocks[1].bold, 'main title');
assert(blocks[2].kind === 'subtitle' && blocks[2].text === 'Puzzles & Games', 'subtitle');
assert(blocks[3].kind === 'ownership' && /belongs to/i.test(blocks[3].text), 'ownership');
assert(blocks[3].frameEnabled && blocks[3].frameShape === 'rectangle', 'ownership box');
assert(blocks[4].kind === 'copyright' && blocks[4].text.includes('All rights reserved'), 'copyright');

const unresolved = resolveTextPageBlocks(settings, 'Title Page', globals);
assert(unresolved.length === 5, 'missing blocks should resolve to the default layout');

const emptyResolved = resolveTextPageBlocks({ ...settings, blocks: [] }, 'Title Page', globals);
assert(emptyResolved.length === 0, 'explicit empty blocks must stay blank');

const emptyPage = createInsertableDocumentPage('empty-page');
assert(isSpecialBlankTitlePage(emptyPage), 'empty page is a blank special');
assert((emptyPage.settings as { blocks?: unknown[] }).blocks?.length === 0, 'empty page stays blank');

const chapterPage = createInsertableDocumentPage('chapter-page');
assert(isSpecialBlankTitlePage(chapterPage), 'chapter page is a blank special');
assert((chapterPage.settings as { blocks?: unknown[] }).blocks?.length === 0, 'chapter page stays blank');

const titlePage = createDocumentPage('title-page');
assert(!isSpecialBlankTitlePage(titlePage), 'real title page is not a blank special');
assert(!Array.isArray((titlePage.settings as { blocks?: unknown }).blocks), 'new title page omits blocks until seeded');

const introSettings = getDefaultTextModuleSettings('introduction');
assert(
  resolveTextPageBlocks(introSettings, 'Introduction', globals, 'introduction').length === 0,
  'introduction must not inherit the title-page template'
);
const instructionsSettings = getDefaultTextModuleSettings('instructions');
assert(
  resolveTextPageBlocks(instructionsSettings, 'Instructions', globals, 'instructions').length === 0,
  'instructions must not inherit the title-page template'
);

console.log('text-page-blocks.selftest ok');
