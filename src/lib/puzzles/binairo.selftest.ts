/**
 * Binairo unit selftests.
 * Run via: npx tsx src/lib/puzzles/binairo.selftest.ts
 */
import {
  countBinairoSolutions,
  formatBinairoSymbol,
  generateBinairo,
  getValidBinairoLines,
  validateBinairoPuzzle,
  validateBinairoSolution,
} from './binairo';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function testLines(): void {
  const lines10 = getValidBinairoLines(10);
  assert(lines10.length > 50, 'expected many valid 10-cell lines');
  for (const line of lines10.slice(0, 20)) {
    assert(line.filter((v) => v === 0).length === 5, 'balance 0');
    assert(line.filter((v) => v === 1).length === 5, 'balance 1');
    for (let i = 0; i + 2 < line.length; i++) {
      assert(!(line[i] === line[i + 1] && line[i + 1] === line[i + 2]), 'no triple');
    }
  }
}

function testSymbols(): void {
  assert(formatBinairoSymbol(0, '01') === '0', '0');
  assert(formatBinairoSymbol(1, '01') === '1', '1');
  assert(formatBinairoSymbol(0, 'xo') === 'X', 'X');
  assert(formatBinairoSymbol(1, 'xo') === 'O', 'O');
  assert(formatBinairoSymbol(null, '01') === '', 'empty');
}

function main(): void {
  testLines();
  testSymbols();

  const puzzle = generateBinairo({
    size: 6,
    difficulty: 'easy',
    seed: 42,
    symbols: '01',
    timeBudgetMs: 15000,
  });
  assert(puzzle.type === 'binairo', 'type');
  assert(puzzle.rows === 6 && puzzle.columns === 6, 'size');
  assert(validateBinairoSolution(puzzle.solution), 'solution valid');
  const check = validateBinairoPuzzle(puzzle);
  assert(check.ok, check.ok ? '' : check.reason);
  assert(countBinairoSolutions(puzzle.puzzle, 2) === 1, 'unique');

  const medium = generateBinairo({
    size: 8,
    difficulty: 'medium',
    seed: 7,
    symbols: 'xo',
    timeBudgetMs: 20000,
  });
  assert(validateBinairoPuzzle(medium).ok, 'medium valid');
  assert(medium.symbols === 'xo', 'symbols stored');

  const large = generateBinairo({
    size: 14,
    difficulty: 'easy',
    seed: 11,
    timeBudgetMs: 60000,
  });
  assert(large.rows === 14 && large.columns === 14, '14 size');
  assert(validateBinairoSolution(large.solution), '14 solution');
  assert(validateBinairoPuzzle(large).ok, '14 puzzle valid');

  console.log('binairo.selftest: OK', {
    clues6: puzzle.metadata?.clueCount,
    score6: puzzle.metadata?.difficultyScore,
    clues8: medium.metadata?.clueCount,
    clues14: large.metadata?.clueCount,
  });
}

main();
