import { getDefaultCrosswordSettings, normalizeCrosswordSettings } from '../src/lib/crossword-settings';
import { getDefaultWordSearchSettings } from '../src/lib/puzzles/types';
import { computeGenericPageLayout } from '../src/lib/generic-puzzle-page-layout';
import { computeCrosswordPuzzleBodyLayout } from '../src/lib/crossword-puzzle-page-layout';
import { cssPxToPoints, pointsToCssPx } from '../src/lib/generic-puzzle-geometry';

const acrossClues = [
  { number: 1, clue: "What you do to make the low-low dance.", answer: "HOP" },
  { number: 2, clue: "Tattoo image showing two hands together in prayer.", answer: "PRAYINGHANDS" },
  { number: 3, clue: "Classic 1979 East L.A. movie.", answer: "BOULEVARDNIGHTS" },
  { number: 4, clue: "What makes the ride go up and down.", answer: "HYDRAULICS" },
  { number: 5, clue: "Sacred image appearing throughout Mexican and Chicano art.", answer: "VIRGENDEGUADALUPE" },
  { number: 6, clue: "1992 Edward James Olmos film.", answer: "AMERICANME" },
  { number: 7, clue: "Doesn't need a logo to look firme.", answer: "PRIMER" },
  { number: 8, clue: "Heavy-duty paint brand found in plenty of writers' bags.", answer: "KRYLON" },
];

const downClues = [
  { number: 9, clue: "Nickname sometimes given to the light-haired homie.", answer: "GUERO" },
  { number: 10, clue: "Famous hydraulic pose.", answer: "THREEOHEELMOTION" },
  { number: 11, clue: "Directional neighborhood identity south of downtown.", answer: "SOUTHCENTRAL" },
  { number: 12, clue: "Old-school headwear used to keep every hair in place.", answer: "HAIRNET" },
  { number: 13, clue: "What an older Mexican might call a little kid.", answer: "CHAVALITO" },
];

const grid = Array.from({ length: 14 }, () =>
  Array.from({ length: 20 }, () => ({
    letter: 'A',
    isBlack: false,
    clueNumber: undefined as number | undefined,
  }))
);

const puzzle = {
  id: 'cw-1',
  type: 'crossword' as const,
  title: '#1',
  acrossClues,
  downClues,
  grid,
};

const cw = normalizeCrosswordSettings(getDefaultCrosswordSettings());
cw.core.puzzleGridScale = 125;
const ws = getDefaultWordSearchSettings();
if (ws.pageFrameSettings) ws.pageFrameSettings.enabled = false;

console.log('--- DEFAULT SETTINGS TEST ---');
console.log('cw.typography.clueFontSize:', cw.typography.clueFontSize);
console.log('cw.typography.acrossDownFontSize:', cw.typography.acrossDownFontSize);
console.log('cw.typography.clueSpaceVertical:', cw.typography.clueSpaceVertical);
console.log('cw.typography.clueSpaceHorizontal:', cw.typography.clueSpaceHorizontal);

const layout = computeGenericPageLayout({
  puzzleType: 'crossword',
  showSolution: false,
  layoutSettings: ws,
  titleWords: { title: 'Crossword' },
  puzzleIndex: 0,
  puzzles: [puzzle],
  cw,
});

console.log('\n--- computeGenericPageLayout results ---');
console.log('pageWidthPt:', layout.pageWidthPt, 'pageHeightPt:', layout.pageHeightPt);
console.log('marginPt:', layout.marginPt);
console.log('header:', layout.header);
console.log('crosswordCellPt:', layout.crosswordCellPt, 'in inches:', layout.crosswordCellPt / 72);
console.log('Grid width in pt:', layout.crosswordCellPt * 20, 'in inches:', (layout.crosswordCellPt * 20) / 72);
console.log('Grid height in pt:', layout.crosswordCellPt * 14, 'in inches:', (layout.crosswordCellPt * 14) / 72);
console.log('body:', layout.body);
console.log('slots:', layout.slots);

const slotPt = {
  leftPt: layout.slots[0].content.leftPt,
  topPt: layout.slots[0].content.topPt,
  widthPt: layout.slots[0].content.widthPt,
  heightPt: layout.slots[0].content.heightPt,
};

const body = computeCrosswordPuzzleBodyLayout({
  puzzle,
  cw,
  slot: slotPt,
  preferredCellPt: layout.crosswordCellPt,
  clueGapPt: layout.puzzleToCluesGapPt,
  pageNumberZoneTopPt: layout.pageNumberZoneTopPt,
});

console.log('\n--- computeCrosswordPuzzleBodyLayout results ---');
console.log('body.cellPt:', body.cellPt, 'in inches:', body.cellPt / 72);
console.log('body.grid:', body.grid);
console.log('body.cluesRect:', body.cluesRect);
console.log('body.clueFontSize:', body.clueFontSize);
console.log('body.headingFontSize:', body.headingFontSize);
console.log('body.spacing:', body.spacing);
console.log('body.acrossLineCounts:', body.acrossLineCounts);
console.log('body.downLineCounts:', body.downLineCounts);
console.log('body.fits:', body.fits);
