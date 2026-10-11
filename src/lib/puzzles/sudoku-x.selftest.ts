/**
 * Sudoku X: diagonal constraints, unique solutions, settings restore, layout lines.
 */
import assert from 'node:assert/strict';
import {
  getDefaultGenericPuzzleSettings,
  normalizeGenericPuzzleSettings,
  sudokuModeGenerationBlockMessage,
} from '../generic-puzzle-settings';
import { buildSudokuElements } from '../resolved-layout/sudoku-elements';
import type { RectPt } from '../generic-puzzle-page-layout';
import {
  generateSudoku,
  hasUniqueDiagonals,
  isSudokuXPuzzle,
  SUDOKU_BOX,
} from './sudoku';
import { shuffledBalancedPlan } from './calcudoku';

function isLatinSquare(grid: number[][]): boolean {
  const n = grid.length;
  for (let r = 0; r < n; r++) {
    const row = new Set(grid[r]);
    if (row.size !== n || [...row].some((v) => v < 1 || v > n)) return false;
  }
  for (let c = 0; c < n; c++) {
    const col = new Set(grid.map((row) => row[c]!));
    if (col.size !== n) return false;
  }
  return true;
}

function boxesUnique(grid: number[][], size: 4 | 6 | 9): boolean {
  const { boxH, boxW } = SUDOKU_BOX[size];
  const n = grid.length;
  for (let br = 0; br < n; br += boxH) {
    for (let bc = 0; bc < n; bc += boxW) {
      const seen = new Set<number>();
      for (let r = br; r < br + boxH; r++) {
        for (let c = bc; c < bc + boxW; c++) seen.add(grid[r]![c]!);
      }
      if (seen.size !== n) return false;
    }
  }
  return true;
}

function testGenerateSudokuX(): void {
  for (const difficulty of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < 3; i++) {
      const puzzle = generateSudoku({ difficulty, size: 9, variant: 'x' });
      assert.equal(puzzle.type, 'sudoku');
      assert.equal(puzzle.variant, 'x');
      assert.ok(isSudokuXPuzzle(puzzle));
      assert.equal(puzzle.size, 9);
      assert.ok(isLatinSquare(puzzle.solution), `${difficulty} solution latin`);
      assert.ok(boxesUnique(puzzle.solution, 9), `${difficulty} solution boxes`);
      assert.ok(hasUniqueDiagonals(puzzle.solution), `${difficulty} solution diagonals`);
      assert.ok(
        puzzle.grid.some((row) => row.some((v) => v === 0)),
        `${difficulty} has blanks`
      );
      assert.ok(
        puzzle.grid.some((row) => row.some((v) => v !== 0)),
        `${difficulty} has clues`
      );
      // Clues must match the solution where present.
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const clue = puzzle.grid[r]![c]!;
          if (clue !== 0) {
            assert.equal(clue, puzzle.solution[r]![c], 'clue matches solution');
          }
        }
      }
    }
  }
}

function testClassicUnchanged(): void {
  const classic = generateSudoku({ difficulty: 'easy', size: 9 });
  assert.notEqual(classic.variant, 'x');
  assert.notEqual(classic.variant, 'calcudoku');
  assert.ok(isLatinSquare(classic.solution));
  assert.ok(boxesUnique(classic.solution, 9));
}

function testSmallSudokuX(): void {
  const puzzle = generateSudoku({ difficulty: 'easy', size: 4, variant: 'x' });
  assert.equal(puzzle.variant, 'x');
  assert.ok(hasUniqueDiagonals(puzzle.solution));
  assert.ok(boxesUnique(puzzle.solution, 4));
}

function testSettingsRestore(): void {
  const xOnly = normalizeGenericPuzzleSettings(
    { core: { sudokuPuzzleMode: 'x', sudokuSize: 9, sudokuDifficulty: 'hard' } } as never,
    'sudoku'
  );
  assert.equal(xOnly.core.sudokuPuzzleMode, 'x');
  assert.equal(xOnly.core.sudokuDifficulty, 'hard');

  const mixed = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'mixed',
        sudokuMixedIncludeStandard: true,
        sudokuMixedIncludeX: true,
        sudokuMixedIncludeCalcudoku: false,
      },
    } as never,
    'sudoku'
  );
  assert.equal(mixed.core.sudokuPuzzleMode, 'mixed');
  assert.equal(mixed.core.sudokuMixedIncludeX, true);
  assert.equal(mixed.core.sudokuMixedIncludeCalcudoku, false);
  assert.equal(sudokuModeGenerationBlockMessage(mixed.core), null);

  const emptyMix = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'mixed',
        sudokuMixedIncludeStandard: false,
        sudokuMixedIncludeX: false,
        sudokuMixedIncludeCalcudoku: false,
      },
    } as never,
    'sudoku'
  );
  assert.ok(sudokuModeGenerationBlockMessage(emptyMix.core));

  const defaults = getDefaultGenericPuzzleSettings('sudoku');
  assert.equal(defaults.core.sudokuPuzzleMode, 'standard');
  assert.equal(defaults.core.sudokuMixedIncludeX, false);
}

function testMixedTypePlan(): void {
  const plan = shuffledBalancedPlan(['standard', 'x', 'calcudoku'] as const, 12, () => 0.41);
  assert.equal(plan.length, 12);
  assert.ok(plan.includes('standard') && plan.includes('x') && plan.includes('calcudoku'));
}

function testDiagonalElements(): void {
  const puzzle = generateSudoku({ difficulty: 'easy', size: 9, variant: 'x' });
  const slot: RectPt = { leftPt: 36, topPt: 72, widthPt: 360, heightPt: 360 };
  const gp = getDefaultGenericPuzzleSettings('sudoku');
  assert.equal(gp.core.sudokuXMarkStyle, 'boxes');

  const boxEls = buildSudokuElements({
    puzzle,
    slot,
    gp: {
      ...gp,
      core: { ...gp.core, sudokuXMarkStyle: 'boxes' },
      colors: { ...gp.colors, sudokuXBoxColor: '#e6e6e6' },
    },
    showSolution: false,
    preferredCellPt: 32,
  });
  const fills = boxEls.filter((el) => el.kind === 'rect' && el.fill === '#e6e6e6');
  assert.ok(fills.length >= 17, 'boxes mode shades both diagonals (center once)');
  assert.ok(
    boxEls.some((el) => el.kind === 'text' && /^\d$/.test(el.text)),
    'digits stay live text over boxes'
  );

  const lineEls = buildSudokuElements({
    puzzle,
    slot,
    gp: {
      ...gp,
      core: {
        ...gp.core,
        sudokuXMarkStyle: 'lines',
        sudokuXLineThickness: 150,
        sudokuXLineTransparency: 50,
      },
      colors: { ...gp.colors, sudokuXLineColor: '#334155' },
    },
    showSolution: false,
    preferredCellPt: 32,
  });
  const diags = lineEls.filter(
    (el) =>
      el.kind === 'line' && Math.abs(el.x2 - el.x1) > 1 && Math.abs(el.y2 - el.y1) > 1
  );
  assert.equal(diags.length, 2, 'lines mode draws both diagonals');
  assert.ok(
    diags.every((el) => el.kind === 'line' && el.color === '#334155' && el.opacity === 0.5),
    'lines mode applies color + transparency'
  );
}

function main(): void {
  testClassicUnchanged();
  testGenerateSudokuX();
  testSmallSudokuX();
  testSettingsRestore();
  testMixedTypePlan();
  testDiagonalElements();
  console.log('sudoku-x.selftest: OK');
}

main();
