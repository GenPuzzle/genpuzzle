/**
 * Calcudoku generator/solver self-tests + Sudoku settings migration checks.
 * Run: npx tsx src/lib/puzzles/calcudoku.selftest.ts
 */

import { generateSudoku, SUDOKU_BOX, isSudokuSize } from './sudoku';
import {
  cageArithmeticHolds,
  cagesAreOrthogonallyConnected,
  cagesCoverBoardExactly,
  cageSizesAreValid,
  calcudokuFingerprint,
  countCalcudokuSolutions,
  createSeededRng,
  easyCageSizeWeights,
  generateCalcudoku,
  generateLatinSquare,
  isCalcudokuPuzzle,
  isLatinSquare,
  operationsForDifficulty,
  partitionCalcudokuCages,
  shuffledBalancedPlan,
  solveCalcudoku,
  CALCUDOKU_GRID_SIZES,
} from './calcudoku';
import type { CalcudokuDifficulty } from './calcudoku';
import {
  getDefaultGenericPuzzleSettings,
  normalizeGenericPuzzleSettings,
  resolveCalcudokuGridSizes,
  resolveCalcudokuDifficulties,
  selectedCalcudokuMixSizes,
} from '../generic-puzzle-settings';

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function assertLatinAndNoBoxes(grid: number[][], size: number): void {
  assert(isLatinSquare(grid), `${size}×${size} solution is not a Latin square`);
  assert(grid.length === size, `${size}×${size} row count`);
  if (isSudokuSize(size) && size === 9) {
    const { boxH, boxW } = SUDOKU_BOX[9];
    let hasBoxViolation = false;
    for (let br = 0; br < size; br += boxH) {
      for (let bc = 0; bc < size; bc += boxW) {
        const seen = new Set<number>();
        for (let r = br; r < br + boxH; r++) {
          for (let c = bc; c < bc + boxW; c++) seen.add(grid[r]![c]!);
        }
        if (seen.size !== size) hasBoxViolation = true;
      }
    }
    // Calcudoku 9×9 is allowed to violate Sudoku boxes; this helper is for
    // Latin-square-only boards, so a box collision is fine.
    void hasBoxViolation;
  }
}

function assertValidCalcudoku(puzzle: ReturnType<typeof generateCalcudoku>, label: string): void {
  const size = puzzle.size;
  assert(isCalcudokuPuzzle(puzzle), `${label}: variant is calcudoku`);
  assert(puzzle.grid.every((row) => row.every((v) => v === 0)), `${label}: puzzle cells empty`);
  assertLatinAndNoBoxes(puzzle.solution, size);
  assert(cagesCoverBoardExactly(size, puzzle.cages), `${label}: every cell in exactly one cage`);
  assert(cagesAreOrthogonallyConnected(puzzle.cages), `${label}: cages orthogonally connected`);
  assert(cageSizesAreValid(puzzle.cages), `${label}: every cage has 2–5 cells`);
  assert(
    puzzle.cages.every((cage) => cage.cells.length >= 2),
    `${label}: no one-cell cages`
  );
  assert(cageArithmeticHolds(puzzle.solution, puzzle.cages), `${label}: cage arithmetic`);
  const allowedOps = operationsForDifficulty(
    puzzle.difficulty === 'medium' || puzzle.difficulty === 'hard' || puzzle.difficulty === 'expert'
      ? puzzle.difficulty
      : 'easy'
  );
  assert(
    puzzle.cages.every((cage) => allowedOps.includes(cage.operation)),
    `${label}: operations must match ${puzzle.difficulty}`
  );
  if (puzzle.difficulty === 'easy' || !puzzle.difficulty) {
    assert(
      puzzle.cages.every((cage) => cage.operation === '+'),
      `${label}: Easy uses addition only`
    );
  }
  if (puzzle.difficulty === 'medium') {
    assert(
      puzzle.cages.every((cage) => cage.operation === '+' || cage.operation === '-'),
      `${label}: Medium uses only + and −`
    );
  }
  if (puzzle.difficulty === 'hard') {
    assert(
      puzzle.cages.every(
        (cage) => cage.operation === '+' || cage.operation === '-' || cage.operation === '*'
      ),
      `${label}: Hard uses only +, −, and ×`
    );
  }
  const counted = countCalcudokuSolutions({ size, cages: puzzle.cages }, 2);
  assert(!counted.timedOut, `${label}: solver timed out`);
  assert(counted.count === 1, `${label}: unique solution (got ${counted.count})`);
  const solved = solveCalcudoku({ size, cages: puzzle.cages });
  assert(solved, `${label}: solver returned a solution`);
  assert(
    JSON.stringify(solved) === JSON.stringify(puzzle.solution),
    `${label}: solver solution matches stored solution`
  );
}

function testLatinSquares(): void {
  for (const size of CALCUDOKU_GRID_SIZES) {
    const grid = generateLatinSquare(size, () => Math.random());
    assert(isLatinSquare(grid), `latin square ${size}`);
  }
}

function testCagePartitionNeverSingleton(): void {
  const rounds: Record<number, number> = { 4: 400, 5: 400, 6: 300, 7: 250, 8: 200, 9: 150 };
  let partitions = 0;
  let failed = 0;
  let singles = 0;
  for (const size of CALCUDOKU_GRID_SIZES) {
    const rng = createSeededRng(size * 991 + 17);
    const weights = easyCageSizeWeights(size);
    const n = rounds[size] ?? 100;
    for (let i = 0; i < n; i++) {
      const groups = partitionCalcudokuCages(size, rng, weights);
      if (!groups) {
        failed += 1;
        continue;
      }
      partitions += 1;
      const fake = groups.map((cells, index) => ({
        id: `c${index}`,
        cells,
        operation: '+' as const,
        target: 0,
      }));
      assert(
        cagesCoverBoardExactly(size, fake),
        `${size}×${size} partition #${i + 1}: incomplete coverage`
      );
      assert(
        cagesAreOrthogonallyConnected(fake),
        `${size}×${size} partition #${i + 1}: disconnected cage`
      );
      for (const cells of groups) {
        if (cells.length < 2 || cells.length > 5) singles += 1;
      }
    }
  }
  assert(failed === 0, `partition returned null ${failed} times`);
  assert(singles === 0, `partition produced ${singles} illegal cage sizes`);
  assert(partitions > 0, 'no partitions generated');
}

function testGeneratedSizes(): void {
  const fingerprints = new Set<string>();
  const counts: Record<number, number> = { 4: 8, 5: 6, 6: 4, 7: 3, 8: 2, 9: 1 };
  for (const size of CALCUDOKU_GRID_SIZES) {
    const n = counts[size] ?? 1;
    for (let i = 0; i < n; i++) {
      const puzzle = generateCalcudoku({
        size,
        difficulty: 'easy',
        seed: size * 1000 + i + 11,
        seenFingerprints: fingerprints,
      });
      assertValidCalcudoku(puzzle, `${size}×${size} #${i + 1}`);
      fingerprints.add(calcudokuFingerprint(puzzle));
    }
  }
}

function testNoSingletonCages(): void {
  const requested: Array<[number, number]> = [
    [4, 100],
    [5, 100],
    [6, 100],
    [7, 50],
    [8, 20],
    [9, 8],
  ];
  let singles = 0;
  let totalCages = 0;
  for (const [size, count] of requested) {
    const fingerprints = new Set<string>();
    const started = Date.now();
    for (let i = 0; i < count; i++) {
      const puzzle = generateCalcudoku({
        size,
        difficulty: 'easy',
        seed: size * 17000 + i * 17 + 3,
        seenFingerprints: fingerprints,
      });
      assert(cageSizesAreValid(puzzle.cages), `${size}×${size} #${i + 1}: cage sizes 2–5`);
      for (const cage of puzzle.cages) {
        totalCages += 1;
        if (cage.cells.length < 2) singles += 1;
      }
      fingerprints.add(calcudokuFingerprint(puzzle));
    }
    console.log(`  no-singleton ${size}×${size}: ${count} puzzles, ${Date.now() - started}ms`);
  }
  assert(singles === 0, `expected 0 one-cell cages, found ${singles} among ${totalCages} cages`);
}

function testDifficultyOperations(): void {
  const levels: CalcudokuDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
  const fingerprints = new Set<string>();
  for (const difficulty of levels) {
    const allowed = operationsForDifficulty(difficulty);
    for (const size of [4, 6] as const) {
      const puzzle = generateCalcudoku({
        size,
        difficulty,
        seed: size * 4000 + difficulty.length * 17,
        seenFingerprints: fingerprints,
      });
      assert(puzzle.difficulty === difficulty, `${difficulty} ${size}: stored difficulty`);
      assertValidCalcudoku(puzzle, `${difficulty} ${size}×${size}`);
      const used = new Set(puzzle.cages.map((cage) => cage.operation));
      for (const op of used) {
        assert(allowed.includes(op), `${difficulty} ${size}: unexpected op ${op}`);
      }
      fingerprints.add(calcudokuFingerprint(puzzle));
    }
  }

  const medium = generateCalcudoku({ size: 5, difficulty: 'medium', seed: 501 });
  assert(
    medium.cages.some((cage) => cage.operation === '-'),
    'medium should include a subtraction cage when possible'
  );

  const hard = generateCalcudoku({ size: 5, difficulty: 'hard', seed: 502 });
  assert(
    hard.cages.some((cage) => cage.operation === '*'),
    'hard should include a multiplication cage when possible'
  );
  assert(
    hard.cages.every((cage) => cage.operation !== '/'),
    'hard must not use division'
  );

  const expert = generateCalcudoku({ size: 6, difficulty: 'expert', seed: 503 });
  assertValidCalcudoku(expert, 'expert 6×6');
  assert(
    expert.cages.every(
      (cage) =>
        cage.operation === '+' ||
        cage.operation === '-' ||
        cage.operation === '*' ||
        cage.operation === '/'
    ),
    'expert ops are +, −, ×, ÷'
  );
}

function testMixedGridSizes(): void {
  const allowed = [4, 6, 8] as const;
  const fingerprints = new Set<string>();
  for (let i = 0; i < 12; i++) {
    const size = allowed[i % allowed.length]!;
    const puzzle = generateCalcudoku({
      size,
      seed: 8800 + i,
      seenFingerprints: fingerprints,
    });
    assert(allowed.includes(puzzle.size as 4 | 6 | 8), `mixed size produced ${puzzle.size}`);
    assert(![5, 7, 9].includes(puzzle.size), 'mixed sizes must not emit 5/7/9');
    assertValidCalcudoku(puzzle, `mixed ${puzzle.size} #${i + 1}`);
  }
  const plan = shuffledBalancedPlan([4, 6, 8], 9, () => 0.4);
  assert(plan.length === 9, 'balanced plan length');
  assert(plan.every((s) => s === 4 || s === 6 || s === 8), 'balanced plan only selected sizes');
}

function testStandardSudokuRegression(): void {
  for (const size of [4, 6, 9] as const) {
    const puzzle = generateSudoku({ difficulty: 'easy', size });
    assert(puzzle.type === 'sudoku', 'standard type');
    assert(puzzle.variant !== 'calcudoku', 'standard has no calcudoku variant');
    assert(!puzzle.cages, 'standard has no cages');
    assert(puzzle.size === size, `standard size ${size}`);
    const n = puzzle.solution.length;
    assert(isLatinSquare(puzzle.solution), `standard ${size} latin rows/cols`);
    const { boxH, boxW } = SUDOKU_BOX[size];
    for (let br = 0; br < n; br += boxH) {
      for (let bc = 0; bc < n; bc += boxW) {
        const seen = new Set<number>();
        for (let r = br; r < br + boxH; r++) {
          for (let c = bc; c < bc + boxW; c++) seen.add(puzzle.solution[r]![c]!);
        }
        assert(seen.size === n, `standard ${size} boxes unique`);
      }
    }
    assert(
      puzzle.grid.some((row) => row.some((v) => v === 0)),
      `standard ${size} has blanks`
    );
    assert(
      puzzle.grid.some((row) => row.some((v) => v !== 0)),
      `standard ${size} has clues`
    );
  }
}

function testSavedProjects(): void {
  const old = normalizeGenericPuzzleSettings({ core: { numberOfPuzzles: 8 } } as never, 'sudoku');
  assert(old.core.calcudokuDifficulty === 'easy', 'old project calcudoku difficulty is easy');
  assert(old.core.sudokuSize === 9, 'old project keeps default 9×9');

  const calcudoku = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'calcudoku',
        calcudokuGridSize: 'mixed',
        calcudokuMix4: true,
        calcudokuMix5: false,
        calcudokuMix6: true,
        calcudokuMix7: false,
        calcudokuMix8: true,
        calcudokuMix9: false,
        numberOfPuzzles: 12,
      },
    } as never,
    'sudoku'
  );
  assert(calcudoku.core.sudokuPuzzleMode === 'calcudoku', 'calcudoku mode restored');
  assert(calcudoku.core.calcudokuGridSize === 'mixed', 'mixed grid size restored');
  const selected = selectedCalcudokuMixSizes(calcudoku.core);
  assert(JSON.stringify(selected) === JSON.stringify([4, 6, 8]), 'mixed sizes restored');
  assert(
    JSON.stringify(resolveCalcudokuGridSizes(calcudoku.core)) === JSON.stringify([4, 6, 8]),
    'resolve mix sizes'
  );

  const mixed = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'mixed',
        sudokuMixedIncludeStandard: true,
        sudokuMixedIncludeCalcudoku: true,
        sudokuSize: 6,
        sudokuDifficulty: 'easy',
        calcudokuGridSize: 5,
        numberOfPuzzles: 10,
      },
    } as never,
    'sudoku'
  );
  assert(mixed.core.sudokuPuzzleMode === 'mixed', 'mixed type restored');
  assert(mixed.core.sudokuSize === 6, 'standard size restored inside mixed');
  assert(mixed.core.sudokuDifficulty === 'easy', 'standard difficulty restored inside mixed');
  assert(mixed.core.calcudokuGridSize === 5, 'calcudoku size restored inside mixed');
  assert(mixed.core.sudokuMixedIncludeStandard === true, 'standard enabled');
  assert(mixed.core.sudokuMixedIncludeCalcudoku === true, 'calcudoku enabled');

  const calcudokuHard = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'calcudoku',
        calcudokuDifficulty: 'hard',
        calcudokuGridSize: 7,
      },
    } as never,
    'sudoku'
  );
  assert(calcudokuHard.core.calcudokuDifficulty === 'hard', 'hard difficulty restored');

  const calcudokuExpert = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'calcudoku',
        calcudokuDifficulty: 'expert',
      },
    } as never,
    'sudoku'
  );
  assert(calcudokuExpert.core.calcudokuDifficulty === 'expert', 'expert difficulty restored');

  const calcudokuMixedLevels = normalizeGenericPuzzleSettings(
    {
      core: {
        sudokuPuzzleMode: 'calcudoku',
        calcudokuDifficulty: 'mixed',
        calcudokuMixEasy: true,
        calcudokuMixMedium: true,
        calcudokuMixHard: false,
        calcudokuMixExpert: true,
      },
    } as never,
    'sudoku'
  );
  assert(calcudokuMixedLevels.core.calcudokuDifficulty === 'mixed', 'mixed calcudoku levels restored');
  assert(calcudokuMixedLevels.core.calcudokuMixHard === false, 'unchecked hard level restored');
  assert(
    JSON.stringify(resolveCalcudokuDifficulties(calcudokuMixedLevels.core)) ===
      JSON.stringify(['easy', 'medium', 'expert']),
    'resolve mixed calcudoku levels'
  );

  const defaults = getDefaultGenericPuzzleSettings('sudoku');
  assert(defaults.core.sudokuPuzzleMode === 'standard', 'default mode is standard');
}

function testMixedTypePlan(): void {
  const plan = shuffledBalancedPlan(['standard', 'calcudoku'] as const, 10, () => 0.37);
  assert(plan.length === 10, 'mixed type plan length');
  assert(plan.includes('standard') && plan.includes('calcudoku'), 'mixed type plan includes both');
}

function main(): void {
  testLatinSquares();
  testStandardSudokuRegression();
  testSavedProjects();
  testMixedTypePlan();
  testCagePartitionNeverSingleton();
  testDifficultyOperations();
  testGeneratedSizes();
  testMixedGridSizes();
  testNoSingletonCages();
  testMixedGridSizes();
  console.log('calcudoku.selftest: ok');
}

main();
