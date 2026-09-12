import {
  countPlayableComponents,
  detectCrosswordEntries,
  findInteriorUnusedCells,
  generateCrossword,
  MIN_CROSSWORD_ENTRY_LENGTH,
  unusedCrosswordMargins,
  validateCrossword,
  validateCrosswordPuzzle,
  type LogicalGrid,
} from './crossword';
import type { CrosswordCell } from './types';

function testSingleEnclosedUnusedCell(): void {
  // 3x3 grid with letters on all sides of center cell (1,1)
  const grid1: CrosswordCell[][] = [
    [{ isBlack: true }, { isBlack: false, letter: 'A' }, { isBlack: true }],
    [{ isBlack: false, letter: 'B' }, { isBlack: true }, { isBlack: false, letter: 'C' }],
    [{ isBlack: true }, { isBlack: false, letter: 'D' }, { isBlack: true }],
  ];
  const res1 = findInteriorUnusedCells(grid1);
  assert(res1[1][1] === true, '1x1 cell surrounded by letters must be marked interior');
  assert(res1[0][0] === false, 'corner cell must not be marked interior');

  // 2x1 unused block under a word (cells (1,1) and (1,2) are both unused)
  const grid2: CrosswordCell[][] = [
    [{ isBlack: false, letter: 'A' }, { isBlack: false, letter: 'B' }, { isBlack: false, letter: 'C' }, { isBlack: false, letter: 'D' }],
    [{ isBlack: false, letter: 'E' }, { isBlack: true }, { isBlack: true }, { isBlack: false, letter: 'F' }],
    [{ isBlack: false, letter: 'G' }, { isBlack: false, letter: 'H' }, { isBlack: false, letter: 'I' }, { isBlack: false, letter: 'J' }],
  ];
  const res2 = findInteriorUnusedCells(grid2);
  assert(res2[1][1] === false, '2x1 block left cell must NOT be marked interior');
  assert(res2[1][2] === false, '2x1 block right cell must NOT be marked interior');
}



const WORD_BANK = [
  'APPLE', 'PEAR', 'GRAPE', 'PEACH', 'MELON', 'LEMON', 'MANGO', 'BERRY',
  'CHERRY', 'ORANGE', 'BANANA', 'PAPAYA', 'GUAVA', 'MANGO', 'LIME',
  'OCEAN', 'ISLAND', 'BEACH', 'CORAL', 'SHELL', 'WAVE', 'TIDE', 'SAND',
  'PALM', 'REEF', 'BOAT', 'SAIL', 'HARBOR', 'LAGOON', 'COAST',
  'SUN', 'STAR', 'MOON', 'CLOUD', 'STORM', 'WIND', 'RAIN',
  'TIGER', 'LION', 'ZEBRA', 'HORSE', 'CAMEL', 'WHALE', 'SHARK',
  'HOUSE', 'CHAIR', 'TABLE', 'WINDOW', 'DOOR', 'FLOOR', 'ROOF',
  'BREAD', 'CHEESE', 'HONEY', 'SUGAR', 'WATER', 'COFFEE', 'TEA',
  'MUSIC', 'PIANO', 'VIOLIN', 'DRUM', 'FLUTE', 'SONG', 'DANCE',
  'RIVER', 'LAKE', 'STREAM', 'FOREST', 'MOUNTAIN', 'VALLEY', 'STONE',
];

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): void {
  if (!condition) fail(message);
}

function patternToGrid(lines: string[]): LogicalGrid {
  return lines.map((line) =>
    [...line].map((ch) => (ch === '.' || ch === '#' || ch === ' ' ? '' : ch.toUpperCase()))
  );
}

function uniqueWords(count: number, seed: number): string[] {
  const copy = [...new Set(WORD_BANK.filter((w) => w.length >= MIN_CROSSWORD_ENTRY_LENGTH))];
  let s = seed || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(copy[i % copy.length]!);
  return out;
}

function testIslandGridIsInvalid(): void {
  const grid = patternToGrid([
    'HELLO........',
    '.............',
    '.............',
    '........WORLD',
  ]);
  const placed = [
    { word: 'HELLO', clue: 'hi', row: 0, col: 0, direction: 'across' as const },
    { word: 'WORLD', clue: 'earth', row: 3, col: 8, direction: 'across' as const },
  ];
  const result = validateCrossword(grid, placed);
  assert(!result.isValid, 'island grid must be invalid');
  assert(result.connectedComponents === 2, `expected 2 components, got ${result.connectedComponents}`);
}

function testGhostDownIsInvalid(): void {
  const grid = patternToGrid([
    'CAT',
    'HAT',
  ]);
  const placed = [
    { word: 'CAT', clue: 'feline', row: 0, col: 0, direction: 'across' as const },
    { word: 'HAT', clue: 'head', row: 1, col: 0, direction: 'across' as const },
  ];
  const result = validateCrossword(grid, placed);
  assert(!result.isValid, 'adjacent across words must be invalid');
  assert(result.shortEntries.length > 0 || result.ghostEntries.length > 0, 'expected short/ghost down entries');
}

function testSingleWordIsValid(): void {
  const grid = patternToGrid(['APPLE']);
  const placed = [{ word: 'APPLE', clue: 'fruit', row: 0, col: 0, direction: 'across' as const }];
  const result = validateCrossword(grid, placed);
  assert(result.isValid, `single word should be valid: ${result.errors.join('; ')}`);
  assert(result.connectedComponents === 1, 'single word is one component');
}

function assertGeneratedPuzzle(
  puzzle: ReturnType<typeof generateCrossword>,
  requested: string[],
  label: string
): { full: boolean } {
  const report = validateCrosswordPuzzle(puzzle);
  assert(report.isValid, `${label} produced an invalid crossword: ${report.errors.join('; ')}`);
  assert(report.connectedComponents <= 1, `${label} has ${report.connectedComponents} components`);

  const placedCount = puzzle.acrossClues.length + puzzle.downClues.length;
  if (placedCount === 0) {
    return { full: false };
  }

  const logical = puzzle.grid.map((row) =>
    row.map((cell) => (cell.isBlack || !cell.letter ? '' : cell.letter))
  );
  assert(countPlayableComponents(logical) === 1, `${label} playable cells are not connected`);

  const margins = unusedCrosswordMargins(logical);
  assert(margins, `${label} missing bounding box`);
  assert(
    Math.abs(margins!.left - margins!.right) <= 1,
    `${label} not centered horizontally (left ${margins!.left}, right ${margins!.right})`
  );
  assert(
    Math.abs(margins!.top - margins!.bottom) <= 1,
    `${label} not centered vertically (top ${margins!.top}, bottom ${margins!.bottom})`
  );

  const detected = detectCrosswordEntries(logical).filter(
    (e) => e.word.length >= MIN_CROSSWORD_ENTRY_LENGTH
  );
  const clueAnswers = [
    ...puzzle.acrossClues.map((c) => `across:${c.answer}`),
    ...puzzle.downClues.map((c) => `down:${c.answer}`),
  ].sort();
  const detectedAnswers = detected.map((e) => `${e.direction}:${e.word}`).sort();
  assert(
    clueAnswers.join('|') === detectedAnswers.join('|'),
    `${label} clues do not match geometry`
  );

  const full = placedCount === requested.length;
  if (full) {
    assert(report.allAnswersPlaced, `${label} allAnswersPlaced should be true`);
  }
  return { full };
}

function testGeneratedPuzzles(): void {
  const sizes: Array<[number, number]> = [
    [15, 15],
    [15, 13],
    [13, 13],
    [21, 15],
  ];
  const counts = [10, 15, 20, 30];
  let generated = 0;
  let full = 0;

  for (let n = 0; n < 100; n++) {
    const count = counts[n % counts.length]!;
    const [across, down] = sizes[n % sizes.length]!;
    const words = uniqueWords(count, n + 17);
    const wordClues = words.map((word) => ({ word, clue: `Clue for ${word}` }));
    const puzzle = generateCrossword(wordClues, {
      lettersAcross: across,
      lettersDown: down,
      exactClueCount: true,
    });
    const label = `puzzle ${n + 1} (${count} answers, ${across}x${down})`;
    const result = assertGeneratedPuzzle(puzzle, words, label);
    generated += 1;
    if (result.full) full += 1;
  }

  console.log(`Generated ${generated} puzzles; ${full} placed every requested answer.`);
  assert(generated === 100, 'expected 100 generated puzzles');
  assert(full > 0, 'expected at least one fully placed crossword');
}

function testCenteredFullLayouts(): void {
  const cases: Array<{ count: number; across: number; down: number; repeats: number }> = [
    { count: 10, across: 17, down: 17, repeats: 8 },
    { count: 15, across: 23, down: 23, repeats: 12 },
    { count: 20, across: 23, down: 23, repeats: 8 },
    { count: 25, across: 25, down: 25, repeats: 6 },
  ];
  let full = 0;
  let total = 0;
  for (const spec of cases) {
    for (let i = 0; i < spec.repeats; i++) {
      const words = uniqueWords(spec.count, spec.count * 50 + i * 9 + 3);
      const puzzle = generateCrossword(
        words.map((word) => ({ word, clue: `Clue for ${word}` })),
        { lettersAcross: spec.across, lettersDown: spec.down, exactClueCount: true }
      );
      const label = `${spec.count} clues ${spec.across}x${spec.down} #${i + 1}`;
      const result = assertGeneratedPuzzle(puzzle, words, label);
      total += 1;
      if (result.full) full += 1;
    }
  }
  console.log(`Stress layouts: ${full}/${total} placed the full requested clue count.`);
  assert(full >= Math.ceil(total * 0.4), `expected many full placements, got ${full}/${total}`);
}

function testMultiWordSpacedAnswers(): void {
  const multiWord = 'VIRGEN DE GUADALUPE';
  const puzzle = generateCrossword(
    [
      { word: multiWord, clue: 'Famous Catholic title of Mary' },
      { word: 'CATHOLIC', clue: 'Christian church' },
      { word: 'MEXICO', clue: 'Country in North America' },
    ],
    { lettersAcross: 18, lettersDown: 18 }
  );
  const placed = [...puzzle.acrossClues, ...puzzle.downClues];
  const virgin = placed.find((c) => c.answer === 'VIRGENDEGUADALUPE');
  assert(virgin != null, 'multi-word answer with spaces must be placed in full without truncation');
  assert(virgin.answer.length === 17, 'letter count must equal 17 without spaces');
}

function main(): void {
  testIslandGridIsInvalid();
  testGhostDownIsInvalid();
  testSingleWordIsValid();
  testSingleEnclosedUnusedCell();
  testMultiWordSpacedAnswers();
  testGeneratedPuzzles();
  testCenteredFullLayouts();
  console.log('All crossword generator tests passed.');
}

main();


