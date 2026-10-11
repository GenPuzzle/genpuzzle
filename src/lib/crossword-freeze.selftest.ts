/**
 * Microbenchmark: undo clone + TOC sync cost when adding a Crossword tab.
 * Run: npx tsx src/lib/crossword-freeze.selftest.ts
 *
 * This does NOT replace a browser Performance profile, but measures the sync
 * functions that run on insertDocumentPage with realistic Word Search payloads.
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { cloneEditHistorySnapshot } from './edit-history';
import { syncAutoTocInDocuments } from './sync-auto-toc';
import { createDocumentPage, createInsertableDocumentPage } from './document-model';
import { getDefaultWordSearchSettings, type WordSearchPuzzle } from './puzzles/types';
import { buildPersistedSnapshot } from './settings-persistence';

function makeGrid(size: number): string[][] {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 'A')
  );
}

function makeWsPuzzles(count: number, size = 15): WordSearchPuzzle[] {
  const pageId = 'ws-doc';
  return Array.from({ length: count }, (_, i) => ({
    type: 'word-search' as const,
    grid: makeGrid(size),
    words: Array.from({ length: 12 }, (_, w) => `WORD${w}`),
    placements: [],
    pageId,
    pageName: 'Word Search',
    puzzleIndexInDocument: i,
    puzzleNumber: i + 1,
  }));
}

function timeMs(fn: () => void, runs = 3): number {
  // warmup
  fn();
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

const ws = getDefaultWordSearchSettings();
const wsPage = createDocumentPage('word-search');
const tocPage = createDocumentPage('table-of-contents');
const docs = [wsPage, tocPage];
const puzzles15 = makeWsPuzzles(15);
const puzzles40 = makeWsPuzzles(40);

const settingsStub = buildPersistedSnapshot({
  wordSearchSettings: ws,
  bookSettings: {
    trimSize: '8.5x11',
    includeBleed: false,
    includeSolution: true,
    puzzlesPerPage: 1,
    mixPuzzles: false,
  },
  puzzleSettings: { difficulty: 'medium', showHints: true },
  titleWords: { title: 'T', fontFamily: 'Arial', fontSize: 24, words: [] },
  colorSettings: { primary: '#000', secondary: '#fff', accent: '#f00' },
  sudokuDifficulty: 'medium',
  mazeSize: 'medium',
  cryptogramText: '',
  puzzleGridScale: 100,
  titleToPuzzleGap: 0.3,
  titleToAnswerGap: 0.3,
  solutionToSolutionGap: 0.25,
  pageMargin: 40,
  previewZoom: 100,
  previewRangeMode: 'sample',
  activePreviewTab: 'puzzles',
  pageOverrides: [],
  pageCrosswordOverrides: [],
  pageGenericOverrides: [],
  pagePuzzleGridScales: [],
  applyMode: [],
  documentPages: docs,
  activeDocumentPageId: wsPage.id,
});

const clone15Settings = timeMs(() => {
  cloneEditHistorySnapshot(settingsStub);
});
const clone15Puzzles = timeMs(() => {
  cloneEditHistorySnapshot(puzzles15);
});
const clone40Puzzles = timeMs(() => {
  cloneEditHistorySnapshot(puzzles40);
});

const tocWith15 = timeMs(() => {
  syncAutoTocInDocuments(docs, puzzles15, ws.typography.pageNumber);
});
const tocWith40 = timeMs(() => {
  syncAutoTocInDocuments(docs, puzzles40, ws.typography.pageNumber);
});

const insertCwOnly = timeMs(() => {
  createInsertableDocumentPage('crossword');
});

console.log(
  JSON.stringify(
    {
      cloneSettingsMs: Number(clone15Settings.toFixed(2)),
      clone15WsPuzzlesMs: Number(clone15Puzzles.toFixed(2)),
      clone40WsPuzzlesMs: Number(clone40Puzzles.toFixed(2)),
      syncToc15Ms: Number(tocWith15.toFixed(2)),
      syncToc40Ms: Number(tocWith40.toFixed(2)),
      createEmptyCrosswordMs: Number(insertCwOnly.toFixed(2)),
      insertUndoCostEstimateMs: Number((clone15Settings + clone15Puzzles).toFixed(2)),
    },
    null,
    2
  )
);

assert.ok(insertCwOnly < 5, 'creating empty crossword page object should be cheap');
console.log('crossword-freeze.selftest: measured (see JSON above)');
