import type {
  CompiledCrosswordPage,
  CompiledPage,
  CompiledPuzzlePage,
  CompiledTextPage,
} from './book-compiler';
import { reorderCompiledPagesForMixedPuzzles } from './mix-compiled-pages';

function textPage(id: string, title: string, pageIndex: number, chapterIndex?: number): CompiledTextPage {
  return {
    kind: 'text',
    bookPageIndex: pageIndex,
    pageNumber: null,
    sourceDocumentId: id,
    sourceDocumentName: title,
    moduleType: id === 'title' ? 'title-page' : 'title-page',
    settings: {
      title,
      content: '',
      fontFamily: 'Arial',
      fontSize: 24,
      alignment: 'center',
      isChapterPage: chapterIndex != null,
      chapterIndex,
    },
  };
}

function ws(index: number, chapterIndex: number, pageIndex: number): CompiledPuzzlePage {
  return {
    kind: 'puzzle',
    bookPageIndex: pageIndex,
    pageNumber: null,
    sourceDocumentId: 'ws-doc',
    sourceDocumentName: 'Word Search',
    moduleType: 'word-search',
    puzzleIndexInDocument: index,
    wordSearchSettings: {} as CompiledPuzzlePage['wordSearchSettings'],
    puzzle: {
      type: 'word-search',
      grid: [],
      placements: [],
      words: [],
      displayWords: [],
      solution: new Map(),
      puzzleIndexInDocument: index,
      chapterIndex,
    },
  };
}

function cw(index: number, chapterIndex: number, pageIndex: number): CompiledCrosswordPage {
  return {
    kind: 'crossword',
    bookPageIndex: pageIndex,
    pageNumber: null,
    sourceDocumentId: 'cw-doc',
    sourceDocumentName: 'Crossword',
    moduleType: 'crossword',
    puzzleIndexInDocument: index,
    crosswordSettings: {} as CompiledCrosswordPage['crosswordSettings'],
    puzzle: {
      type: 'crossword',
      grid: [],
      acrossClues: [],
      downClues: [],
      puzzleIndexInDocument: index,
      chapterIndex,
    },
  };
}

const input: CompiledPage[] = [
  textPage('title', 'Title', 0),
  textPage('ch-0', 'Ocean', 1, 0),
  textPage('ch-1', 'Space', 2, 1),
  ws(0, 0, 3),
  ws(1, 0, 4),
  ws(2, 1, 5),
  ws(3, 1, 6),
  cw(0, 0, 7),
  cw(1, 0, 8),
  cw(2, 1, 9),
  cw(3, 1, 10),
];

const mixed = reorderCompiledPagesForMixedPuzzles(input, {
  chapterTopics: ['Ocean', 'Space'],
});

const kinds = mixed.map((page) => {
  if (page.kind === 'text') return `text:${page.settings.title}`;
  if (page.kind === 'puzzle') {
    return `ws:${page.puzzleIndexInDocument}:ch${page.puzzle.chapterIndex}`;
  }
  if (page.kind === 'crossword') {
    return `cw:${page.puzzleIndexInDocument}:ch${page.puzzle.chapterIndex}`;
  }
  return page.kind;
});

const expected = [
  'text:Title',
  'text:Ocean',
  'ws:0:ch0',
  'cw:0:ch0',
  'ws:1:ch0',
  'cw:1:ch0',
  'text:Space',
  'ws:2:ch1',
  'cw:2:ch1',
  'ws:3:ch1',
  'cw:3:ch1',
];

if (JSON.stringify(kinds) !== JSON.stringify(expected)) {
  console.error('mix-compiled-pages.selftest failed');
  console.error('got     ', kinds);
  console.error('expected', expected);
  process.exit(1);
}

console.log('mix-compiled-pages.selftest ok');
