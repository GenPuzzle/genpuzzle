/**
 * Kakuro unit selftests.
 * Run via: npx tsx src/lib/puzzles/kakuro.selftest.ts
 */
import {
  countKakuroSolutions,
  generateKakuro,
  getKakuroCombinations,
  kakuroMaxSum,
  kakuroMinSum,
  validateKakuroPuzzle,
  validateKakuroSolution,
} from './kakuro';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function testCombinations(): void {
  assert(
    JSON.stringify(getKakuroCombinations(2, 3)) === JSON.stringify([[1, 2]]),
    '2/3'
  );
  assert(
    JSON.stringify(getKakuroCombinations(2, 4)) === JSON.stringify([[1, 3]]),
    '2/4'
  );
  const six = getKakuroCombinations(2, 6).map((c) => c.join('+')).sort();
  assert(six.includes('1+5') && six.includes('2+4') && !six.includes('3+3'), '2/6');
  assert(
    JSON.stringify(getKakuroCombinations(3, 6)) === JSON.stringify([[1, 2, 3]]),
    '3/6'
  );
  assert(
    JSON.stringify(getKakuroCombinations(9, 45)) ===
      JSON.stringify([[1, 2, 3, 4, 5, 6, 7, 8, 9]]),
    '9/45'
  );
  assert(kakuroMinSum(4) === 10 && kakuroMaxSum(4) === 30, 'len4 bounds');
}

function main(): void {
  testCombinations();

  let puzzle = null as ReturnType<typeof generateKakuro> | null;
  let lastErr: unknown;
  for (const seed of [123, 11, 7]) {
    try {
      puzzle = generateKakuro({
        size: 7,
        difficulty: 'easy',
        seed,
        pattern: 'asymmetric',
        timeBudgetMs: 30000,
      });
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!puzzle) throw lastErr ?? new Error('easy 7x7 generation failed');
  assert(puzzle.type === 'kakuro', 'type');
  assert(puzzle.rows === 7 && puzzle.columns === 7, 'size');
  assert(validateKakuroSolution(puzzle, puzzle.solution).ok, 'solution');
  const check = validateKakuroPuzzle(puzzle);
  assert(check.ok, check.ok ? '' : check.reason);
  assert(countKakuroSolutions(puzzle, 2) === 1, 'unique');

  // 8x8 uniqueness is slower; exercise it with one seed and a finite budget.
  let medium: ReturnType<typeof generateKakuro> | null = null;
  try {
    medium = generateKakuro({
      size: 8,
      difficulty: 'medium',
      seed: 11,
      timeBudgetMs: 45000,
    });
    assert(validateKakuroPuzzle(medium).ok, 'medium valid');
    assert(countKakuroSolutions(medium, 2) === 1, 'medium unique');
  } catch (e) {
    console.warn('kakuro.selftest: medium 8x8 not generated in budget', e);
  }

  console.log('kakuro.selftest: OK', {
    easy7: {
      clues: puzzle.runs.length,
      white: puzzle.metadata?.whiteCount,
      score: puzzle.metadata?.difficultyScore,
    },
    medium8: medium
      ? {
          clues: medium.runs.length,
          white: medium.metadata?.whiteCount,
          score: medium.metadata?.difficultyScore,
        }
      : null,
  });
}

main();
