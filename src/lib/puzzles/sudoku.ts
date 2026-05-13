import { SudokuPuzzle, Difficulty } from './types';

function createEmptyGrid(): number[][] {
  return Array(9)
    .fill(null)
    .map(() => Array(9).fill(0));
}

function isValid(grid: number[][], row: number, col: number, num: number): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }

  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }

  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }

  return true;
}

function solveSudoku(grid: number[][]): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        // Shuffle for randomness
        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }

        for (const num of nums) {
          if (isValid(grid, row, col, num)) {
            grid[row][col] = num;
            if (solveSudoku(grid)) {
              return true;
            }
            grid[row][col] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(grid: number[][], limit: number = 2): number {
  let count = 0;

  function solve(): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(grid, row, col, num)) {
              grid[row][col] = num;
              if (solve()) {
                if (count >= limit) {
                  grid[row][col] = 0;
                  return true;
                }
              }
              grid[row][col] = 0;
            }
          }
          return false;
        }
      }
    }
    count++;
    return count >= limit;
  }

  solve();
  return count;
}

function getClueCount(difficulty: Difficulty): { min: number; max: number } {
  switch (difficulty) {
    case 'easy':
      return { min: 38, max: 45 };
    case 'medium':
      return { min: 30, max: 37 };
    case 'hard':
      return { min: 22, max: 29 };
    default:
      return { min: 30, max: 37 };
  }
}

function removeNumbers(grid: number[][], clueCount: number): number[][] {
  const puzzle = grid.map((row) => [...row]);
  const positions: [number, number][] = [];

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }

  // Shuffle positions
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  let removed = 0;
  const targetRemoved = 81 - clueCount;

  for (const [row, col] of positions) {
    if (removed >= targetRemoved) break;

    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    // Check if puzzle still has unique solution
    const testGrid = puzzle.map((r) => [...r]);
    if (countSolutions(testGrid, 2) === 1) {
      removed++;
    } else {
      puzzle[row][col] = backup;
    }
  }

  return puzzle;
}

export function generateSudoku(difficulty: Difficulty = 'medium'): SudokuPuzzle {
  let grid = createEmptyGrid();

  // Generate a valid complete grid
  solveSudoku(grid);

  // Save the solution
  const solution = grid.map((row) => [...row]);

  // Get clue count based on difficulty
  const { min, max } = getClueCount(difficulty);
  const clueCount = Math.floor(Math.random() * (max - min + 1)) + min;

  // Remove numbers to create puzzle
  const puzzleGrid = removeNumbers(grid, clueCount);

  return {
    type: 'sudoku',
    grid: puzzleGrid,
    solution,
    difficulty,
  };
}

export function isSudokuComplete(grid: number[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return false;
    }
  }
  return true;
}
