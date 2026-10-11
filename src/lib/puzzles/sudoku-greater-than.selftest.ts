/**
 * Greater Than Sudoku: inequality-only default, logical difficulty, hybrid option.
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
  countGreaterThanSolutions,
  generateGreaterThanSudoku,
  gridHasNoGivens,
  rateGreaterThanPuzzle,
} from './sudoku-greater-than';
import {
  generateSudoku,
  inequalitiesMatchSolution,
  isSudokuGreaterThanPuzzle,
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

function assertCorePuzzle(puzzle: ReturnType<typeof generateSudoku>, difficulty: string): void {
  assert.equal(puzzle.type, 'sudoku');
  assert.equal(puzzle.variant, 'greater-than');
  assert.ok(isSudokuGreaterThanPuzzle(puzzle));
  assert.ok(Array.isArray(puzzle.inequalities));
  assert.ok((puzzle.inequalities?.length ?? 0) >= puzzle.size!, `${difficulty} has inequalities`);
  assert.ok(isLatinSquare(puzzle.solution), `${difficulty} solution latin`);
  assert.ok(boxesUnique(puzzle.solution, 9), `${difficulty} solution boxes`);
  assert.ok(
    inequalitiesMatchSolution(puzzle.solution, puzzle.inequalities ?? []),
    `${difficulty} inequalities match solution`
  );
  assert.equal(
    countGreaterThanSolutions(puzzle.grid, puzzle.inequalities ?? [], 2, 400_000),
    1,
    `${difficulty} unique`
  );
}

function testInequalityOnlyDefault(): void {
  for (const difficulty of ['easy', 'medium', 'hard', 'expert'] as const) {
    const t0 = Date.now();
    const puzzle = generateSudoku({ difficulty, size: 9, variant: 'greater-than' });
    const ms = Date.now() - t0;
    assertCorePuzzle(puzzle, difficulty);
    assert.ok(gridHasNoGivens(puzzle.grid), `${difficulty} has zero prefilled digits`);
    assert.ok(ms < 12_000, `${difficulty} generated in ${ms}ms (budget 12s)`);
  }
}

function testHybridOptional(): void {
  const puzzle = generateSudoku({
    difficulty: 'easy',
    size: 9,
    variant: 'greater-than',
    greaterThanHybrid: true,
  });
  assertCorePuzzle(puzzle, 'hybrid-easy');
  // Hybrid may still dig down to empty on rare uniqueness stalls; allow either,
  // but the option must be accepted without throwing.
  assert.ok(puzzle.inequalities && puzzle.inequalities.length > 0);
}

function testSmallBoard(): void {
  const puzzle = generateSudoku({ difficulty: 'medium', size: 4, variant: 'greater-than' });
  assert.equal(puzzle.variant, 'greater-than');
  assert.ok(gridHasNoGivens(puzzle.grid));
  assert.ok(inequalitiesMatchSolution(puzzle.solution, puzzle.inequalities ?? []));
  assert.equal(countGreaterThanSolutions(puzzle.grid, puzzle.inequalities ?? [], 2), 1);
}

function testLogicalRater(): void {
  const puzzle = generateSudoku({ difficulty: 'easy', size: 9, variant: 'greater-than' });
  const rating = rateGreaterThanPuzzle(puzzle.grid, puzzle.inequalities ?? []);
  assert.ok(typeof rating.solved === 'boolean');
  assert.ok(['easy', 'medium', 'hard', 'expert'].includes(rating.level));
}

function testSettings(): void {
  const gt = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'greater-than',
        sudokuDifficulty: 'expert',
        sudokuGreaterThanHybrid: true,
      },
    } as never,
    'sudoku'
  );
  assert.equal(gt.core.sudokuPuzzleMode, 'greater-than');
  assert.equal(gt.core.sudokuDifficulty, 'expert');
  assert.equal(gt.core.sudokuGreaterThanHybrid, true);

  const defaults = getDefaultGenericPuzzleSettings('sudoku');
  assert.equal(defaults.core.sudokuGreaterThanHybrid, false);
  assert.equal(sudokuModeGenerationBlockMessage(defaults.core), null);
}

function testMixedPlan(): void {
  const plan = shuffledBalancedPlan(
    ['standard', 'x', 'greater-than', 'calcudoku'] as const,
    16,
    () => 0.41
  );
  assert.ok(plan.includes('greater-than'));
}

function testElements(): void {
  const puzzle = generateSudoku({ difficulty: 'easy', size: 9, variant: 'greater-than' });
  const slot: RectPt = { leftPt: 36, topPt: 72, widthPt: 360, heightPt: 360 };
  const gp = getDefaultGenericPuzzleSettings('sudoku');
  const els = buildSudokuElements({
    puzzle,
    slot,
    gp,
    showSolution: false,
    preferredCellPt: 32,
  });
  const ineqGlyphs = els.filter(
    (el) => el.kind === 'text' && (el.text === '<' || el.text === '>')
  );
  assert.ok(ineqGlyphs.length >= (puzzle.inequalities?.length ?? 0));
  // Puzzle page should not show digit givens in inequality-only mode.
  const digits = els.filter((el) => el.kind === 'text' && /^\d$/.test(el.text));
  assert.equal(digits.length, 0, 'inequality-only puzzle page has no digit texts');
}

function testDirectApi(): void {
  const viaSudoku = generateSudoku({ difficulty: 'hard', size: 9, variant: 'greater-than' });
  assert.ok(gridHasNoGivens(viaSudoku.grid));
  const direct = generateGreaterThanSudoku({
    difficulty: 'hard',
    size: 9,
    solution: viaSudoku.solution,
  });
  // Same solution already proven unique — builder should succeed.
  assert.ok(direct);
  assert.ok(gridHasNoGivens(direct!.grid));
}

function main(): void {
  testInequalityOnlyDefault();
  testHybridOptional();
  testSmallBoard();
  testLogicalRater();
  testSettings();
  testMixedPlan();
  testElements();
  testDirectApi();
  console.log('sudoku-greater-than.selftest: OK');
}

main();
