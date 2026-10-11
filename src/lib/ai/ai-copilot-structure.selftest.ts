import assert from 'node:assert/strict';
import {
  interpretCopilotCommand,
  resolveCopilotClarification,
} from './interpret-copilot-command';
import { buildBookStructurePages } from './build-book-structure';
import {
  GENPUZZLE_GENERATOR_IDS,
  normalizePuzzleTypeToken,
  parsePuzzleTypesFromText,
} from './puzzle-type-aliases';
import { getDefaultWordSearchSettings } from '@/lib/puzzles/types';
import type { PlatformSettingsSource } from './platform-settings';

function testPlatform(overrides?: Partial<PlatformSettingsSource['wordSearchSettings']['typography']>): PlatformSettingsSource {
  const ws = getDefaultWordSearchSettings();
  if (overrides) {
    ws.typography = { ...ws.typography, ...overrides };
  }
  return {
    wordSearchSettings: ws,
    titleWords: { title: 'T', fontFamily: 'Arial', fontSize: 24, words: [] },
    bookSettings: {
      trimSize: '8.5x11',
      includeBleed: false,
      includeSolution: true,
      puzzlesPerPage: 1,
      mixPuzzles: false,
    },
    pageMargin: 40,
    puzzleGridScale: 70,
  };
}

assert.deepEqual(
  [...GENPUZZLE_GENERATOR_IDS],
  [
    'word-search',
    'sudoku',
    'crossword',
    'maze',
    'cryptogram',
    'word-scramble',
    'trivia',
    'codewords',
    'binairo',
    'kakuro',
    'math-maze',
    'word-fill',
    'number-fill',
    'snake',
    'murdoku',
  ]
);

assert.equal(normalizePuzzleTypeToken('biniro'), 'binairo');
assert.equal(normalizePuzzleTypeToken('Binairo'), 'binairo');
assert.equal(normalizePuzzleTypeToken('binario'), 'binairo');
assert.equal(normalizePuzzleTypeToken('math maze'), 'math-maze');

assert.deepEqual(
  parsePuzzleTypesFromText(
    'Add Word Search, Crossword, biniro, and Mazes to every chapter.'
  ),
  ['word-search', 'crossword', 'binairo', 'maze']
);

const local = interpretCopilotCommand(
  'Add Word Search, Crossword, biniro, and Mazes to every chapter.'
);
assert.ok(local);
assert.equal(local!.toolCalls[0]?.name, 'build_book_structure');
const args = JSON.parse(local!.toolCalls[0]!.arguments) as {
  spec: { chapterCount: number; puzzleTypesPerChapter: string[] };
};
assert.deepEqual(args.spec.puzzleTypesPerChapter, [
  'word-search',
  'crossword',
  'binairo',
  'maze',
]);

const built = buildBookStructurePages({
  chapterCount: args.spec.chapterCount,
  puzzleTypesPerChapter: args.spec.puzzleTypesPerChapter as never,
});
assert.ok(built.pages.some((p) => p.name.includes('Binairo')));
assert.ok(!built.pages.some((p) => /biniro/i.test(p.name)));

// Ambiguous grid edits must ask scope before mutating.
const gridAsk = interpretCopilotCommand(
  'Make a 20x20 grid with diagonal words and a thin border.'
);
assert.ok(gridAsk?.clarification);
assert.equal(gridAsk!.clarification!.kind, 'apply_scope');
assert.equal(gridAsk!.toolCalls.length, 0);
assert.ok(gridAsk!.clarification!.pendingToolCalls.length >= 3);

const gridApply = resolveCopilotClarification('this page', gridAsk!.clarification!);
assert.ok(gridApply);
assert.ok(gridApply!.toolCalls.some((t) => t.name === 'update_platform_setting'));
assert.ok(gridApply!.toolCalls.some((t) => t.name === 'regenerate_puzzles'));
assert.ok(!gridApply!.toolCalls.some((t) => t.name === 'propagate_word_search_settings'));

const gridAll = resolveCopilotClarification('all word search', gridAsk!.clarification!);
assert.ok(gridAll!.toolCalls.some((t) => t.name === 'propagate_word_search_settings'));

// Ambiguous font edits must ask which text.
const fontAsk = interpretCopilotCommand('update the font to be 20pt');
assert.ok(fontAsk?.clarification);
assert.equal(fontAsk!.clarification!.kind, 'font_target');
assert.match(fontAsk!.clarification!.question, /Grid letters/i);
const fontTitles = resolveCopilotClarification('titles', fontAsk!.clarification!);
assert.ok(fontTitles!.toolCalls.some((t) => t.name === 'update_platform_setting'));
assert.match(fontTitles!.toolCalls[0]!.arguments, /puzzleTitleFontSize/);

// Named grid letters apply immediately (canvas Grid Letters control).
const gridFont = interpretCopilotCommand('make the word search grid letters 20pt');
assert.ok(gridFont);
assert.equal(gridFont!.toolCalls.length, 1);
assert.match(gridFont!.toolCalls[0]!.arguments, /puzzleGridFontSize/);

// Word list columns.
const columns = interpretCopilotCommand('make the word lists 3 column');
assert.ok(columns);
assert.match(columns!.toolCalls[0]!.arguments, /wordListColumns/);
assert.match(columns!.toolCalls[0]!.arguments, /"value":3/);

// Spacing increase uses live current value and applies (does not only read).
const spacing = interpretCopilotCommand(
  'increase the space between the title and the puzzle grid',
  { platform: testPlatform({ spaceBetweenTitleAndPuzzle: 12 }) }
);
assert.ok(spacing);
assert.match(spacing!.toolCalls[0]!.arguments, /spaceBetweenTitleAndPuzzle/);
const spacingArgs = JSON.parse(spacing!.toolCalls[0]!.arguments) as { value: number };
assert.ok(spacingArgs.value > 12);

const funFactGap = interpretCopilotCommand(
  'increase the space between the title and fun fact to this page',
  { platform: testPlatform() }
);
assert.ok(funFactGap);
assert.match(funFactGap!.toolCalls[0]!.arguments, /subtitleToTitleGap/);

console.log('ai-copilot-structure.selftest: OK', {
  types: args.spec.puzzleTypesPerChapter,
  generators: GENPUZZLE_GENERATOR_IDS.length,
});
