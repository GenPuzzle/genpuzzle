import {
  computeCrosswordPuzzleBodyLayout,
  crosswordFixedCellPt,
  measureCrosswordClueBlockHeight,
  validateCrosswordPuzzlePageLayout,
  validateCrosswordPuzzleSetConsistency,
} from './crossword-puzzle-page-layout';
import { crosswordLetterFontPt } from './generic-puzzle-geometry';
import { computeGenericPageLayout } from './generic-puzzle-page-layout';
import { buildCrosswordWordClues, getDefaultCrosswordSettings } from './crossword-settings';
import { getDefaultWordSearchSettings, type CrosswordPuzzle } from './puzzles/types';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function near(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) < eps;
}

function emptyGrid(rows: number, cols: number): CrosswordPuzzle['grid'] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ isBlack: true }))
  );
}

function makePuzzle(
  rows: number,
  cols: number,
  across: string[],
  down: string[]
): CrosswordPuzzle {
  return {
    type: 'crossword',
    grid: emptyGrid(rows, cols),
    acrossClues: across.map((clue, i) => ({
      number: i + 1,
      clue,
      answer: 'WORD',
    })),
    downClues: down.map((clue, i) => ({
      number: i + 1,
      clue,
      answer: 'WORD',
    })),
  };
}

function titleWords() {
  return { title: 'Crossword', fontFamily: 'Arial', fontSize: 24, words: [] };
}

function layoutFor(
  puzzle: CrosswordPuzzle,
  cw = getDefaultCrosswordSettings(),
  layoutSettings = getDefaultWordSearchSettings()
) {
  const page = computeGenericPageLayout({
    puzzleType: 'crossword',
    showSolution: false,
    layoutSettings,
    titleWords: titleWords(),
    puzzleIndex: 0,
    puzzles: [puzzle],
    cw,
    gp: null,
  });
  const slot = page.slots[0]?.content;
  if (!slot) fail('missing content slot');
  const body = computeCrosswordPuzzleBodyLayout({
    puzzle,
    cw,
    slot,
    preferredCellPt: page.crosswordCellPt,
    clueGapPt: page.puzzleToCluesGapPt,
    pageNumberZoneTopPt: page.pageNumberZoneTopPt,
  });
  const validation = validateCrosswordPuzzlePageLayout({
    pageWidthPt: page.pageWidthPt,
    pageHeightPt: page.pageHeightPt,
    marginPt: page.marginPt,
    pageNumberZoneTopPt: page.pageNumberZoneTopPt,
    titleBox: page.pageTitleBox,
    grid: body.grid,
    cluesRect: body.cluesRect,
    clueContentBottomPt: body.cluesRect.topPt + Math.min(body.cluesRect.heightPt, Infinity),
    spacing: body.spacing,
  });
  return { page, body, validation };
}

function testLongClueTextPreserved(): void {
  const cw = getDefaultCrosswordSettings();
  const longClueText = 'False-friend trap: in English you walk on it; in Spanish this word normally means a folder.';
  const wordClues = buildCrosswordWordClues({
    answers: ['CARPETA'],
    clues: [longClueText],
    startIndex: 0,
    count: 1,
    maxClueCharacters: cw.core.maxClueCharacters,
    maxAnswerLength: cw.core.maxAnswerLength,
    allowNumbers: false,
  });
  assert(wordClues.length === 1, 'wordClues must build');
  assert(wordClues[0].clue === longClueText, 'clue over 80 chars must NOT be truncated');
}

function run(): void {
  testLongClueTextPreserved();
  const shortAcross = ['Cat', 'Dog', 'Sun'];
  const shortDown = ['Hat', 'Map'];
  const longAcross = Array.from(
    { length: 12 },
    (_, i) =>
      `${i + 1}. A particularly long crossword clue that should wrap inside the column without changing the grid size or the clue font.`
  );
  const longDown = Array.from(
    { length: 12 },
    () =>
      'Another lengthy down clue with extra words so the vertical clue area has to compress spacing to stay above the page number.'
  );

  const cases: Array<{ cols: number; rows: number; scale: number }> = [
    { cols: 15, rows: 15, scale: 150 },
    { cols: 17, rows: 17, scale: 130 },
    { cols: 23, rows: 23, scale: 100 },
    { cols: 13, rows: 13, scale: 175 },
  ];

  for (const spec of cases) {
    const cw = getDefaultCrosswordSettings();
    cw.core.lettersAcross = spec.cols;
    cw.core.lettersDown = spec.rows;
    cw.core.puzzleGridScale = spec.scale;
    cw.typography.clueFontSize = 16;
    cw.typography.puzzleTitleFontSize = 24;
    cw.typography.clueSpaceVertical = 8;

    const expectedCell = crosswordFixedCellPt(cw, { showSolution: false });
    const short = layoutFor(makePuzzle(spec.rows, spec.cols, shortAcross, shortDown), cw);
    const long = layoutFor(makePuzzle(spec.rows, spec.cols, longAcross, longDown), cw);

    assert(near(short.body.cellPt, expectedCell), `${spec.cols}x${spec.rows}@${spec.scale} short cell drifted`);
    assert(near(long.body.cellPt, expectedCell), `${spec.cols}x${spec.rows}@${spec.scale} long cell drifted`);
    assert(near(short.body.grid.widthPt, long.body.grid.widthPt), 'grid widths must match');
    assert(near(short.body.grid.heightPt, long.body.grid.heightPt), 'grid heights must match');
    assert(near(short.body.grid.topPt, long.body.grid.topPt), 'grid top must match');
    assert(near(short.body.grid.leftPt, long.body.grid.leftPt), 'grid left must match');
    assert(near(short.body.clueFontSize, long.body.clueFontSize), 'clue font must match');
    assert(near(short.body.headingFontSize, long.body.headingFontSize), 'heading font must match');
    assert(
      long.body.spacing.itemGap <= short.body.spacing.itemGap + 0.01,
      'long clues may only compress spacing'
    );
    const shortUsed = measureCrosswordClueBlockHeight(
      short.body.acrossLineCounts,
      short.body.downLineCounts,
      short.body.columns,
      short.body.clueFontSize,
      short.body.headingFontSize,
      short.body.spacing
    );
    assert(
      near(short.body.spacing.itemGap, (cw.typography.clueSpaceVertical * 72) / 96),
      'short clues must keep configured clueSpaceVertical'
    );
    assert(short.body.cluesRect.topPt + short.body.cluesRect.heightPt <= short.page.pageNumberZoneTopPt + 0.05, 'short clues overlap page number');
    assert(long.body.cluesRect.topPt + long.body.cluesRect.heightPt <= long.page.pageNumberZoneTopPt + 0.05, 'long clues overlap page number');
    assert(!short.validation.cluesOverlapPageNumber, 'short page number overlap');
    assert(!long.validation.cluesOverlapPageNumber, 'long page number overlap');
    assert(!short.validation.clueTextOverlap, 'short clue overlap');
    assert(!long.validation.clueTextOverlap, 'long clue overlap');
    assert(short.body.spacing.itemGap >= 0 && long.body.spacing.itemGap >= 0, 'negative clue gap');

    const set = validateCrosswordPuzzleSetConsistency([
      {
        gridWidthPt: short.body.grid.widthPt,
        gridHeightPt: short.body.grid.heightPt,
        cellPt: short.body.cellPt,
        gridLetterFontPt: crosswordLetterFontPt(cw, short.body.cellPt),
        clueFontSize: short.body.clueFontSize,
        titleFontSizePt: short.page.pageTitle?.fontSizePt ?? cw.typography.puzzleTitleFontSize,
      },
      {
        gridWidthPt: long.body.grid.widthPt,
        gridHeightPt: long.body.grid.heightPt,
        cellPt: long.body.cellPt,
        gridLetterFontPt: crosswordLetterFontPt(cw, long.body.cellPt),
        clueFontSize: long.body.clueFontSize,
        titleFontSizePt: long.page.pageTitle?.fontSizePt ?? cw.typography.puzzleTitleFontSize,
      },
    ]);
    assert(set.allPuzzleGridWidthsAreEqual, 'set grid widths');
    assert(set.allPuzzleGridHeightsAreEqual, 'set grid heights');
    assert(set.allGridCellSizesAreEqual, 'set cell sizes');
    assert(set.allGridFontSizesAreEqual, 'set grid fonts');
    assert(set.allClueFontSizesAreEqual, 'set clue fonts');
    assert(set.allTitleFontSizesAreEqual, 'set title fonts');
  }

  const a = crosswordFixedCellPt(
    { ...getDefaultCrosswordSettings(), core: { ...getDefaultCrosswordSettings().core, puzzleGridScale: 150, lettersAcross: 15, lettersDown: 15 } },
    { showSolution: false }
  );
  const b = crosswordFixedCellPt(
    { ...getDefaultCrosswordSettings(), core: { ...getDefaultCrosswordSettings().core, puzzleGridScale: 100, lettersAcross: 23, lettersDown: 23 } },
    { showSolution: false }
  );
  assert(!near(a, b, 0.2), 'different settings must produce different cell sizes');

  console.log('crossword-puzzle-page-layout.selftest: ok');
}

run();
