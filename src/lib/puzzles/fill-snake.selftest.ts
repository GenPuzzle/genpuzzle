import assert from 'node:assert/strict';
import { generateFill, validateFill } from './fill';
import { generateSnake, validateSnake } from './snake';

const fillWord = generateFill({
  mode: 'word',
  width: 12,
  height: 12,
  words: ['CAT', 'DOG', 'BIRD', 'FISH', 'LION', 'TIGER'],
  includeStarterWord: true,
  lettersToShow: 2,
  seed: 7,
});
assert.equal(validateFill(fillWord).ok, true);

// wordsPerPuzzle takes the first N in list order (Word Search–style chunks), not a random subset,
// and must place exactly that many entries (crossword exactClueCount principle).
{
  const pool = ['APPLE', 'PEAR', 'GRAPE', 'PLUM', 'MANGO', 'MELON'];
  const allowed = new Set(pool.slice(0, 3));
  const chunked = generateFill({
    mode: 'word',
    width: 15,
    height: 15,
    words: pool,
    wordsPerPuzzle: 3,
    exactWordCount: true,
    includeStarterWord: true,
    seed: 42,
  });
  assert.equal(validateFill(chunked).ok, true);
  assert.equal(chunked.entries.length, 3, 'exact words-per-puzzle count');
  for (const entry of chunked.entries) {
    assert.ok(
      allowed.has(entry.text),
      `expected only first 3 words; got ${entry.text}`
    );
  }
  assert.equal(chunked.metadata?.requested, 3);
}

{
  const fifteen = [
    'CAT', 'DOG', 'BIRD', 'FISH', 'LION', 'TIGER', 'BEAR', 'WOLF',
    'DEER', 'FROG', 'DUCK', 'GOOSE', 'HORSE', 'SHEEP', 'MOUSE',
  ];
  const exact = generateFill({
    mode: 'word',
    width: 15,
    height: 15,
    words: fifteen,
    wordsPerPuzzle: 15,
    exactWordCount: true,
    includeStarterWord: true,
    seed: 99,
    // Crossword exactClueCount-style budget; generator keeps retrying until 15/15.
    timeBudgetMs: 12_000,
  });
  assert.equal(validateFill(exact).ok, true);
  assert.equal(exact.entries.length, 15, 'must place all 15 words');
}

const fillNum = generateFill({
  mode: 'number',
  width: 12,
  height: 12,
  digitCounts: { 2: 3, 3: 3, 4: 2 },
  includeStarterWord: true,
  seed: 9,
});
assert.equal(validateFill(fillNum).ok, true);

const snakeWord = generateSnake({
  mode: 'word',
  width: 10,
  height: 10,
  words: ['CAT', 'DOG', 'BIRD'],
  wordsPerPuzzle: 3,
  seed: 11,
});
assert.equal(validateSnake(snakeWord).ok, true);

// wordsPerPuzzle takes the first N in list order (Word Search–style chunks).
{
  const pool = ['APPLE', 'PEAR', 'GRAPE', 'PLUM', 'MANGO', 'MELON'];
  const allowed = new Set(pool.slice(0, 3));
  const chunked = generateSnake({
    mode: 'word',
    width: 14,
    height: 14,
    words: pool,
    wordsPerPuzzle: 3,
    seed: 42,
  });
  assert.equal(validateSnake(chunked).ok, true);
  assert.equal(chunked.entries.length, 3, 'snake exact words-per-puzzle count');
  for (const entry of chunked.entries) {
    assert.ok(
      allowed.has(entry.text),
      `snake expected only first 3 words; got ${entry.text}`
    );
  }
}

const snakeNum = generateSnake({
  mode: 'number',
  width: 10,
  height: 10,
  digitCounts: { 2: 2, 3: 2 },
  seed: 13,
});
assert.equal(validateSnake(snakeNum).ok, true);

console.log('fill+snake.selftest: OK', {
  fillEntries: fillWord.entries.length,
  snakePath: snakeWord.path.length,
});
