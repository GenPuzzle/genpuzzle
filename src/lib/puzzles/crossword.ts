import { CrosswordPuzzle, CrosswordCell, Position } from './types';

interface CrosswordWord {
  word: string;
  clue: string;
  placed: boolean;
  row?: number;
  col?: number;
  direction?: 'across' | 'down';
}

function createEmptyGrid(rows: number, cols: number): CrosswordCell[][] {
  return Array(rows)
    .fill(null)
    .map(() =>
      Array(cols)
        .fill(null)
        .map(() => ({ isBlack: false }))
    );
}

function canPlaceWord(
  grid: CrosswordCell[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): boolean {
  const maxRow = direction === 'down' ? row : row;
  const maxCol = direction === 'across' ? col : col;

  if (row < 0 || col < 0) return false;
  if (direction === 'down' && row + word.length > grid.length) return false;
  if (direction === 'across' && col + word.length > grid[0].length) return false;

  // Check cell before word (if not at edge)
  if (direction === 'across' && col > 0 && !grid[row][col - 1].isBlack) return false;
  if (direction === 'down' && row > 0 && !grid[row - 1][col].isBlack) return false;

  for (let i = 0; i < word.length; i++) {
    const r = direction === 'down' ? row + i : row;
    const c = direction === 'across' ? col + i : col;
    const cell = grid[r][c];

    // If cell is black, can't place
    if (cell.isBlack) return false;

    // If cell has a letter, it must match
    if (cell.letter && cell.letter !== word[i]) return false;

    // Check perpendicular neighbors
    if (direction === 'across') {
      // Check up
      if (r > 0 && !grid[r - 1][c].isBlack && !cell.letter) return false;
      // Check down
      if (r < grid.length - 1 && !grid[r + 1][c].isBlack && !cell.letter) return false;
    } else {
      // Check left
      if (c > 0 && !grid[r][c - 1].isBlack && !cell.letter) return false;
      // Check right
      if (c < grid[0].length - 1 && !grid[r][c + 1].isBlack && !cell.letter) return false;
    }
  }

  // Check cell after word
  if (direction === 'across' && col + word.length < grid[0].length && !grid[row][col + word.length].isBlack) return false;
  if (direction === 'down' && row + word.length < grid.length && !grid[row + word.length][col].isBlack) return false;

  return true;
}

function placeWord(
  grid: CrosswordCell[][],
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): void {
  for (let i = 0; i < word.length; i++) {
    const r = direction === 'down' ? row + i : row;
    const c = direction === 'across' ? col + i : col;
    grid[r][c].letter = word[i];
  }
}

function findIntersections(words: CrosswordWord[]): void {
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const w1 = words[i];
      const w2 = words[j];
      if (w1.placed || w2.placed) continue;

      // Find common letters
      for (let c1 = 0; c1 < w1.word.length; c1++) {
        for (let c2 = 0; c2 < w2.word.length; c2++) {
          if (w1.word[c1] === w2.word[c2]) {
            // w1 as across, w2 as down
            if (!w1.placed && !w2.placed) {
              const row = Math.floor(Math.random() * 10) + 2;
              const col = Math.floor(Math.random() * 10) + 2;
              if (canPlaceWord(createEmptyGrid(15, 15), w1.word, row, col, 'across') &&
                  canPlaceWord(createEmptyGrid(15, 15), w2.word, row + c2, col + c1, 'down')) {
                w1.placed = true;
                w1.row = row;
                w1.col = col;
                w1.direction = 'across';
                w2.placed = true;
                w2.row = row + c2;
                w2.col = col + c1;
                w2.direction = 'down';
              }
            }
          }
        }
      }
    }
  }
}

function placeRemainingWords(
  grid: CrosswordCell[][],
  words: CrosswordWord[]
): void {
  for (const word of words) {
    if (word.placed) continue;

    const directions: ('across' | 'down')[] = ['across', 'down'];
    const shuffledDirs = directions.sort(() => Math.random() - 0.5);

    for (const dir of shuffledDirs) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[0].length; c++) {
          if (canPlaceWord(grid, word.word, r, c, dir)) {
            word.placed = true;
            word.row = r;
            word.col = c;
            word.direction = dir;
            placeWord(grid, word.word, r, c, dir);
            break;
          }
        }
        if (word.placed) break;
      }
      if (word.placed) break;
    }
  }
}

function addBlackSquares(grid: CrosswordCell[][], minWordLength: number = 3): void {
  // Add some black squares for better aesthetics
  for (let r = 1; r < grid.length - 1; r += Math.floor(Math.random() * 3) + 2) {
    for (let c = 1; c < grid[0].length - 1; c += Math.floor(Math.random() * 3) + 2) {
      // Check if making this black would break words
      let canMakeBlack = true;
      if (grid[r][c].letter) canMakeBlack = false;

      if (canMakeBlack && Math.random() > 0.7) {
        grid[r][c].isBlack = true;
      }
    }
  }
}

function numberGrid(grid: CrosswordCell[][]): Map<string, number> {
  const numbers = new Map<string, number>();
  let num = 1;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c].isBlack || grid[r][c].letter === undefined) continue;

      const isStartAcross = (c === 0 || grid[r][c - 1].isBlack) &&
                           c < grid[0].length - 1 && !grid[r][c + 1].isBlack;
      const isStartDown = (r === 0 || grid[r - 1][c].isBlack) &&
                         r < grid.length - 1 && !grid[r + 1][c].isBlack;

      if (isStartAcross || isStartDown) {
        numbers.set(`${r},${c}`, num);
        grid[r][c].clueNumber = num;
        num++;
      }
    }
  }

  return numbers;
}

export interface GenerateCrosswordOptions {
  lettersAcross?: number;
  lettersDown?: number;
  allowNumbers?: boolean;
  maxAnswerLength?: number;
}

export function generateCrossword(
  wordClues: { word: string; clue: string }[],
  gridSizeOrOptions: number | GenerateCrosswordOptions = 15
): CrosswordPuzzle {
  const options: GenerateCrosswordOptions =
    typeof gridSizeOrOptions === 'number'
      ? { lettersAcross: gridSizeOrOptions, lettersDown: gridSizeOrOptions }
      : gridSizeOrOptions;

  const cols = Math.max(3, options.lettersAcross ?? 15);
  const rows = Math.max(3, options.lettersDown ?? cols);
  const allowNumbers = options.allowNumbers ?? false;
  const maxAnswerLength = options.maxAnswerLength ?? 30;
  const letterPattern = allowNumbers ? /[^A-Za-z0-9]/g : /[^A-Za-z]/g;

  const words: CrosswordWord[] = wordClues
    .map((wc) => ({
      word: wc.word.toUpperCase().replace(letterPattern, '').slice(0, maxAnswerLength),
      clue: wc.clue || wc.word,
      placed: false,
    }))
    .filter((w) => w.word.length >= 2)
    .sort((a, b) => b.word.length - a.word.length);

  if (words.length === 0) {
    return {
      type: 'crossword',
      grid: createEmptyGrid(Math.min(5, rows), Math.min(5, cols)),
      acrossClues: [],
      downClues: [],
    };
  }

  let grid = createEmptyGrid(rows, cols);

  // Place first word horizontally in the middle
  words[0].placed = true;
  words[0].row = Math.floor(rows / 2);
  words[0].col = Math.max(0, Math.floor((cols - words[0].word.length) / 2));
  words[0].direction = 'across';
  placeWord(grid, words[0].word, words[0].row!, words[0].col!, 'across');

  // Find intersections and place more words
  findIntersections(words);
  placeRemainingWords(grid, words);

  // Add some black squares for aesthetics
  addBlackSquares(grid);

  // Number the grid
  const numbers = numberGrid(grid);

  // Build clues
  const acrossClues: { number: number; clue: string; answer: string }[] = [];
  const downClues: { number: number; clue: string; answer: string }[] = [];

  for (const word of words) {
    if (!word.placed || word.row === undefined || word.col === undefined) continue;
    const num = numbers.get(`${word.row},${word.col}`);
    if (!num) continue;

    const clueObj = { number: num, clue: word.clue, answer: word.word };

    if (word.direction === 'across') {
      acrossClues.push(clueObj);
    } else {
      downClues.push(clueObj);
    }
  }

  // Sort clues by number
  acrossClues.sort((a, b) => a.number - b.number);
  downClues.sort((a, b) => a.number - b.number);

  return {
    type: 'crossword',
    grid,
    acrossClues,
    downClues,
  };
}
