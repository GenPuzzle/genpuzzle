import { getDefaultCrosswordSettings } from './crossword-settings';
import { getDefaultWordSearchSettings } from './puzzles/types';
import { computeGenericPageLayout } from './generic-puzzle-page-layout';
import {
  computeCrosswordPuzzleBodyLayout,
  fitCrosswordClueSpacing,
  minCrosswordClueSpacing,
} from './crossword-puzzle-page-layout';
import { cssPxToPoints } from './puzzle-layout';

const cw = getDefaultCrosswordSettings();
cw.core.lettersAcross = 15;
cw.core.lettersDown = 15;
const layout = getDefaultWordSearchSettings();
const rows = 15;
const cols = 15;
const total = 15;
const acrossN = Math.ceil(total * 0.55);
const downN = total - acrossN;
const sample = 'A medium-length crossword clue used to size the type.';
const puzzle = {
  type: 'crossword' as const,
  grid: Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ isBlack: true }))
  ),
  acrossClues: Array.from({ length: acrossN }, (_, i) => ({
    number: i + 1,
    clue: sample,
    answer: 'WORD',
  })),
  downClues: Array.from({ length: downN }, (_, i) => ({
    number: i + 1,
    clue: sample,
    answer: 'WORD',
  })),
};

const page = computeGenericPageLayout({
  puzzleType: 'crossword',
  showSolution: false,
  layoutSettings: layout,
  titleWords: { title: 'Crossword', fontFamily: 'Arial', fontSize: 24, words: [] },
  puzzleIndex: 0,
  puzzles: [puzzle],
  cw,
  gp: null,
});
const slot = page.slots[0].content;
const body = computeCrosswordPuzzleBodyLayout({
  puzzle,
  cw,
  slot,
  preferredCellPt: page.crosswordCellPt,
  clueGapPt: page.puzzleToCluesGapPt,
  pageNumberZoneTopPt: page.pageNumberZoneTopPt,
});
process.stdout.write(
  JSON.stringify(
    {
      cellPt: body.cellPt,
      preferred: page.crosswordCellPt,
      gridH: body.grid.heightPt,
      cluesH: body.cluesRect.heightPt,
      cluesW: body.cluesRect.widthPt,
      bodyH: page.body.heightPt,
      zone: page.pageNumberZoneTopPt,
      margin: page.marginPt,
      pageH: page.pageHeightPt,
      acrossN,
      downN,
      fits: body.fits,
    },
    null,
    2
  ) + '\n'
);
for (const css of [9, 10, 12, 16, 20]) {
  const fit = fitCrosswordClueSpacing({
    availableHeight: body.cluesRect.heightPt,
    availableWidth: body.cluesRect.widthPt,
    columns: 2,
    clueFontSize: cssPxToPoints(css),
    headingFontSize: cssPxToPoints(css + 2),
    preferred: minCrosswordClueSpacing(cssPxToPoints),
    min: minCrosswordClueSpacing(cssPxToPoints),
    acrossTexts: puzzle.acrossClues.map((c) => c.number + '. ' + c.clue),
    downTexts: puzzle.downClues.map((c) => c.number + '. ' + c.clue),
  });
  process.stdout.write(
    `${css} fits=${fit.fits} required=${Math.round(fit.requiredHeight)} avail=${Math.round(body.cluesRect.heightPt)}\n`
  );
}
