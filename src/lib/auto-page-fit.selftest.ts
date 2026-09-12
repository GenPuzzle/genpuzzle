import {
  AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
  computeCrosswordAutoFit,
  computeWordSearchAutoFit,
  resolvePageFitBox,
} from './auto-page-fit';
import { getDefaultCrosswordSettings } from './crossword-settings';
import { getDefaultWordSearchSettings, type CrosswordPuzzle } from './puzzles/types';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function samplePuzzle(
  rows: number,
  cols: number,
  across: string[],
  down: string[]
): CrosswordPuzzle {
  return {
    type: 'crossword',
    grid: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ isBlack: true }))
    ),
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

function run(): void {
  const layout = getDefaultWordSearchSettings();
  layout.typography.pageNumber.enabled = true;
  const box = resolvePageFitBox(layout);
  assert(box.contentBottomPt < box.pageHeightPt - box.marginPt + 1, 'page-number zone should raise the bottom limit');

  const cw = getDefaultCrosswordSettings();
  cw.core.lettersAcross = 15;
  cw.core.lettersDown = 15;
  const both = computeCrosswordAutoFit(cw, layout, { fitGrid: true, fitFont: true });
  assert(typeof both.puzzleGridScale === 'number', 'grid scale missing');
  assert(typeof both.clueFontSize === 'number', 'clue font missing');
  assert(both.puzzleGridScale >= 50 && both.puzzleGridScale <= 200, 'grid scale out of range');
  assert(
    (both.clueFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'clue font must stay at 18 or above'
  );

  const gridOnly = computeCrosswordAutoFit(cw, layout, { fitGrid: true, fitFont: false });
  assert(gridOnly.puzzleGridScale != null, 'grid-only should set scale');
  assert(gridOnly.clueFontSize == null, 'grid-only should not change fonts');

  const fontOnly = computeCrosswordAutoFit(cw, layout, { fitGrid: false, fitFont: true });
  assert(fontOnly.clueFontSize != null, 'font-only should set fonts');
  assert(
    (fontOnly.clueFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'auto-balance must never go below 18'
  );

  const roomy = getDefaultCrosswordSettings();
  roomy.core.lettersAcross = 15;
  roomy.core.lettersDown = 13;
  roomy.core.puzzleGridScale = 100;
  const shortClues = Array.from({ length: 8 }, () => 'Short clue');
  const roomyFit = computeCrosswordAutoFit(
    roomy,
    layout,
    { fitGrid: false, fitFont: true },
    [samplePuzzle(13, 15, shortClues, shortClues.slice(0, 7))]
  );
  assert(
    (roomyFit.clueFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'roomy pages must keep clue fonts at 18+'
  );
  assert((roomyFit.puzzleGridScale ?? 0) >= 100, 'roomy pages should not shrink a grid that already fits');

  const packed = getDefaultCrosswordSettings();
  packed.core.lettersAcross = 15;
  packed.core.lettersDown = 15;
  packed.core.puzzleGridScale = 150;
  packed.typography.clueFontSize = 18;
  const longLine =
    'A particularly long crossword clue that wraps several times and must stay above the page number';
  const longAcross = Array.from({ length: 16 }, () => longLine);
  const longDown = Array.from({ length: 16 }, () => longLine);
  const packedFit = computeCrosswordAutoFit(
    packed,
    layout,
    { fitGrid: true, fitFont: true },
    [samplePuzzle(15, 15, longAcross, longDown)]
  );
  assert(
    (packedFit.clueFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'long clues must not shrink font below 18'
  );
  assert(
    typeof packedFit.puzzleGridScale === 'number' &&
      packedFit.puzzleGridScale >= 50 &&
      packedFit.puzzleGridScale <= 200,
    'long clues must keep a valid grid scale'
  );

  const ws = computeWordSearchAutoFit(layout, 70, { fitGrid: true, fitFont: true });
  assert(ws.puzzleGridScale != null && ws.puzzleTitleFontSize != null, 'word-search fit incomplete');
  assert(
    (ws.puzzleGridFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'word-search grid letters must stay at 18 or above'
  );
  assert(
    (ws.answerGridFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'word-search solution grid letters must stay at 18 or above'
  );

  const crampedWs = getDefaultWordSearchSettings();
  crampedWs.core.lettersAcross = 25;
  crampedWs.core.lettersDown = 25;
  const wsFontOnly = computeWordSearchAutoFit(crampedWs, 50, { fitGrid: false, fitFont: true });
  assert(
    (wsFontOnly.puzzleGridFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'word-search font-only auto-balance must keep grid letters at 18 or above'
  );
  assert(
    (wsFontOnly.answerGridFontSize ?? 0) >= AUTO_BALANCE_MIN_CLUE_FONT_SIZE,
    'word-search font-only auto-balance must keep solution grid letters at 18 or above'
  );

  const a = computeCrosswordAutoFit(cw, layout, { fitGrid: true, fitFont: true });
  const b = computeCrosswordAutoFit(cw, layout, { fitGrid: true, fitFont: true });
  assert(a.puzzleGridScale === b.puzzleGridScale, 'fit must be deterministic');
  assert(a.clueFontSize === b.clueFontSize, 'font fit must be deterministic');

  console.log('auto-page-fit.selftest: ok');
}

run();
