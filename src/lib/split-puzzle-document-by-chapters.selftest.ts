import { createDocumentPage, getDefaultTextModuleSettings } from './document-model';
import { getDefaultWordSearchSettings } from './puzzles/types';
import { getDefaultCrosswordSettings } from './crossword-settings';
import { getDefaultGenericPuzzleSettings } from './generic-puzzle-settings';
import { ensureMazeStartEndPairs } from './maze-start-end-images';
import {
  buildChapterSplitPlan,
  evenChapterPuzzleCounts,
  chapterStartingNumbers,
  formatDivideListsLabel,
  sliceContentLines,
  splitPuzzleDocumentByChapters,
} from './split-puzzle-document-by-chapters';
import { isChapterTitlePage } from './insert-separator-page';
import type { PuzzleModuleSettings } from './document-model';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(evenChapterPuzzleCounts(100, 5).join(',') === '20,20,20,20,20', '100/5');
assert(evenChapterPuzzleCounts(100, 3).join(',') === '34,33,33', '100/3');
assert(chapterStartingNumbers([20, 20, 20], 1).join(',') === '1,21,41', 'starts');
assert(
  formatDivideListsLabel(5, [20, 20, 20, 20, 20]) ===
    'Divide lists into 5 chapters (20 puzzles each)',
  'label'
);
assert(sliceContentLines('a\nb\nc\nd', 1, 2) === 'b\nc', 'slice lines');

const plan = buildChapterSplitPlan({
  numberOfPuzzles: 100,
  chapterCount: 5,
  chapterTitles: [],
  puzzlesStartingNumber: 1,
});
assert(plan?.puzzleCounts.join(',') === '20,20,20,20,20', 'plan counts');
assert(plan?.startingNumbers.join(',') === '1,21,41,61,81', 'plan starts');
assert(plan?.chapterTitles.length === 5, 'default titles');

const source = createDocumentPage('word-search');
source.name = 'Word Search';
const settings = source.settings as PuzzleModuleSettings;
settings.titleWords = {
  title: 'Word Search',
  fontFamily: 'Arial',
  fontSize: 24,
  words: Array.from({ length: 1500 }, (_, i) => `WORD${i + 1}`),
};
settings.wordSearchSettings = getDefaultWordSearchSettings();
settings.wordSearchSettings.core.numberOfPuzzles = 100;
settings.wordSearchSettings.core.puzzlesStartingNumber = 1;
settings.wordSearchSettings.wordList.wordsPerPuzzle = 15;
settings.wordSearchSettings.typography.titleText = Array.from(
  { length: 100 },
  (_, i) => `Title ${i + 1}`
).join('\n');
settings.wordSearchSettings.typography.selectTitleOption = 'custom';
settings.wordSearchSettings.typography.funFactsText = Array.from(
  { length: 100 },
  (_, i) => `Fact ${i + 1}`
).join('\n');

const titlePage = createDocumentPage('title-page');
titlePage.settings = { ...getDefaultTextModuleSettings('title-page'), title: 'Title Page' };

const split = splitPuzzleDocumentByChapters({
  documents: [titlePage, source],
  sourceDocumentId: source.id,
  plan: plan!,
});
assert(split, 'split result');
assert(split!.puzzleDocIds.length === 5, '5 puzzle docs');
const chapters = split!.documentPages.filter((doc) => isChapterTitlePage(doc));
const puzzles = split!.documentPages.filter((doc) => doc.moduleType === 'word-search');
assert(chapters.length === 5, '5 chapter pages');
assert(puzzles.length === 5, '5 word-search docs');
assert(split!.documentPages[0].id === titlePage.id, 'keeps title page first');

const first = puzzles[0].settings as PuzzleModuleSettings;
const second = puzzles[1].settings as PuzzleModuleSettings;
assert(first.wordSearchSettings?.core.numberOfPuzzles === 20, 'first count');
assert(second.wordSearchSettings?.core.puzzlesStartingNumber === 21, 'second start');
assert(first.titleWords.words.length === 300, '300 words in chapter 1');
assert(first.titleWords.words[0] === 'WORD1', 'first word');
assert(second.titleWords.words[0] === 'WORD301', 'chapter 2 first word');
assert(first.wordSearchSettings?.typography.funFactsText.split('\n').length === 20, '20 facts');
assert(first.chapterIndex === 0 && second.chapterIndex === 1, 'chapterIndex');

const cw = createDocumentPage('crossword');
const cwSettings = cw.settings as PuzzleModuleSettings;
cwSettings.crosswordSettings = getDefaultCrosswordSettings();
cwSettings.crosswordSettings.core.numberOfPuzzles = 100;
cwSettings.crosswordSettings.core.cluesPerPuzzle = 15;
cwSettings.crosswordSettings.core.answersText = Array.from(
  { length: 1500 },
  (_, i) => `ANSWER${i + 1}`
).join('\n');
cwSettings.crosswordSettings.core.cluesText = Array.from(
  { length: 1500 },
  (_, i) => `Clue ${i + 1}`
).join('\n');

const cwSplit = splitPuzzleDocumentByChapters({
  documents: [cw],
  sourceDocumentId: cw.id,
  plan: plan!,
});
assert(cwSplit?.puzzleDocIds.length === 5, 'crossword 5 docs');
const cwFirst = cwSplit!.documentPages.find((doc) => doc.moduleType === 'crossword')
  ?.settings as PuzzleModuleSettings;
assert(cwFirst.crosswordSettings?.core.numberOfPuzzles === 20, 'cw count');
assert(cwFirst.crosswordSettings?.core.answersText.split('\n').length === 300, '300 answers');
assert(cwFirst.crosswordSettings?.core.puzzlesStartingNumber === 1, 'cw start');

const maze = createDocumentPage('maze');
const mazeSettings = maze.settings as PuzzleModuleSettings;
mazeSettings.genericPuzzleSettings = getDefaultGenericPuzzleSettings('maze');
mazeSettings.genericPuzzleSettings.core.numberOfPuzzles = 20;
mazeSettings.genericPuzzleSettings.core.mazeSize = 'mixed';
mazeSettings.genericPuzzleSettings.core.mazeMixedEasyCount = 4;
mazeSettings.genericPuzzleSettings.core.mazeMixedMediumCount = 6;
mazeSettings.genericPuzzleSettings.core.mazeMixedHardCount = 10;
mazeSettings.genericPuzzleSettings.core.mazeStartEndImages = {
  ...mazeSettings.genericPuzzleSettings.core.mazeStartEndImages,
  enabled: true,
  theme: 'forest',
  pairs: ensureMazeStartEndPairs([], 'forest', 20).map((pair, index) => ({
    ...pair,
    startImage: `data:image/png;base64,start${index}`,
    endImage: `data:image/png;base64,end${index}`,
    startWidth: 10,
    startHeight: 10,
    endWidth: 10,
    endHeight: 10,
  })),
  sheetSources: {
    0: 'data:image/png;base64,sheet0',
    1: 'data:image/png;base64,sheet1',
  },
};
const mazePlan = buildChapterSplitPlan({
  numberOfPuzzles: 20,
  chapterCount: 2,
  chapterTitles: [],
  puzzlesStartingNumber: 1,
});
const mazeSplit = splitPuzzleDocumentByChapters({
  documents: [maze],
  sourceDocumentId: maze.id,
  plan: mazePlan!,
});
assert(mazeSplit?.puzzleDocIds.length === 2, 'maze 2 docs');
const mazeDocs = mazeSplit!.documentPages.filter((doc) => doc.moduleType === 'maze');
const mazeFirst = mazeDocs[0].settings as PuzzleModuleSettings;
const mazeSecond = mazeDocs[1].settings as PuzzleModuleSettings;
assert(mazeFirst.genericPuzzleSettings?.core.numberOfPuzzles === 10, 'chapter 1 quantity is 10');
assert(mazeSecond.genericPuzzleSettings?.core.numberOfPuzzles === 10, 'chapter 2 quantity is 10');
assert(mazeFirst.genericPuzzleSettings?.core.mazeMixedEasyCount === 4, 'chapter 1 keeps the first mixed easy mazes');
assert(mazeFirst.genericPuzzleSettings?.core.mazeMixedMediumCount === 6, 'chapter 1 keeps the first mixed medium mazes');
assert(mazeSecond.genericPuzzleSettings?.core.mazeMixedHardCount === 10, 'chapter 2 keeps the remaining hard mazes');
assert(mazeFirst.genericPuzzleSettings?.core.mazeStartEndImages.pairs.length === 10, 'chapter 1 has 10 start/end pairs');
assert(
  mazeFirst.genericPuzzleSettings?.core.mazeStartEndImages.pairs[0].startImage.includes('start0'),
  'chapter 1 keeps its own start images'
);
assert(
  mazeSecond.genericPuzzleSettings?.core.mazeStartEndImages.pairs[0].startImage.includes('start10'),
  'chapter 2 starts at the 11th original pair'
);
assert(
  Object.keys(mazeFirst.genericPuzzleSettings?.core.mazeStartEndImages.sheetSources ?? {}).join(',') === '0',
  'chapter 1 keeps only the first sheet'
);
assert(
  mazeSecond.genericPuzzleSettings?.core.mazeStartEndImages.sheetSources[0]?.includes('sheet1'),
  'chapter 2 remaps the second original sheet'
);
assert(
  !mazeSecond.genericPuzzleSettings?.core.mazeStartEndImages.sheetSources[1],
  'chapter 2 does not keep the original first sheet'
);

console.log('split-puzzle-document-by-chapters.selftest ok');
