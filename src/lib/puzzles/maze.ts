import { MazePuzzle, Position } from './types';

type MazeSize = 'small' | 'medium' | 'large' | 'xl';

const SIZES: Record<MazeSize, number> = {
  small: 10,
  medium: 15,
  large: 20,
  xl: 25,
};

interface Cell {
  visited: boolean;
  walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
}

function createGrid(size: number): Cell[][] {
  return Array(size)
    .fill(null)
    .map(() =>
      Array(size)
        .fill(null)
        .map(() => ({
          visited: false,
          walls: { top: true, right: true, bottom: true, left: true },
        }))
    );
}

function getUnvisitedNeighbors(
  grid: Cell[][],
  row: number,
  col: number
): { row: number; col: number; direction: string }[] {
  const neighbors: { row: number; col: number; direction: string }[] = [];
  const size = grid.length;

  // Top
  if (row > 0 && !grid[row - 1][col].visited) {
    neighbors.push({ row: row - 1, col, direction: 'top' });
  }
  // Right
  if (col < size - 1 && !grid[row][col + 1].visited) {
    neighbors.push({ row, col: col + 1, direction: 'right' });
  }
  // Bottom
  if (row < size - 1 && !grid[row + 1][col].visited) {
    neighbors.push({ row: row + 1, col, direction: 'bottom' });
  }
  // Left
  if (col > 0 && !grid[row][col - 1].visited) {
    neighbors.push({ row, col: col - 1, direction: 'left' });
  }

  return neighbors;
}

function removeWall(
  grid: Cell[][],
  from: Position,
  to: Position,
  direction: string
): void {
  switch (direction) {
    case 'top':
      grid[from.row][from.col].walls.top = false;
      grid[to.row][to.col].walls.bottom = false;
      break;
    case 'right':
      grid[from.row][from.col].walls.right = false;
      grid[to.row][to.col].walls.left = false;
      break;
    case 'bottom':
      grid[from.row][from.col].walls.bottom = false;
      grid[to.row][to.col].walls.top = false;
      break;
    case 'left':
      grid[from.row][from.col].walls.left = false;
      grid[to.row][to.col].walls.right = false;
      break;
  }
}

export function generateMaze(size: MazeSize = 'medium'): MazePuzzle {
  const gridSize = SIZES[size];
  const grid = createGrid(gridSize);

  // Start from top-left
  const stack: Position[] = [{ row: 0, col: 0 }];
  grid[0][0].visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(grid, current.row, current.col);

    if (neighbors.length > 0) {
      // Choose random neighbor
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];

      // Remove wall between current and next
      removeWall(grid, current, next, next.direction);

      // Mark as visited and push to stack
      grid[next.row][next.col].visited = true;
      stack.push({ row: next.row, col: next.col });
    } else {
      // Backtrack
      stack.pop();
    }
  }

  // Convert to boolean grid (true = wall)
  const mazeGrid: boolean[][] = Array(gridSize * 2 + 1)
    .fill(null)
    .map(() => Array(gridSize * 2 + 1).fill(true));

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const mazeRow = r * 2 + 1;
      const mazeCol = c * 2 + 1;
      mazeGrid[mazeRow][mazeCol] = false; // Cell is open

      if (!grid[r][c].walls.top && r > 0) {
        mazeGrid[mazeRow - 1][mazeCol] = false;
      }
      if (!grid[r][c].walls.right && c < gridSize - 1) {
        mazeGrid[mazeRow][mazeCol + 1] = false;
      }
      if (!grid[r][c].walls.bottom && r < gridSize - 1) {
        mazeGrid[mazeRow + 1][mazeCol] = false;
      }
      if (!grid[r][c].walls.left && c > 0) {
        mazeGrid[mazeRow][mazeCol - 1] = false;
      }
    }
  }

  return {
    type: 'maze',
    grid: mazeGrid,
    start: { row: 1, col: 1 },
    end: { row: mazeGrid.length - 2, col: mazeGrid[0].length - 2 },
    size,
  };
}
