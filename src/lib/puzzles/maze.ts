import {
  Difficulty,
  MazeEndSide,
  MazePuzzle,
  MazeShape,
  MazeStartSide,
  Position,
} from './types';

type MazeSize = 'small' | 'medium' | 'large' | 'xl';

export const MAZE_PRESET_SIZES: Record<MazeSize, number> = {
  small: 10,
  medium: 15,
  large: 20,
  xl: 25,
};

const SIZES = MAZE_PRESET_SIZES;

export interface GenerateMazeOptions {
  /** Named size preset (ignored when explicit dimensions are set). */
  size?: MazeSize;
  /** Explicit square N×N logical cell count (5–40). Prefer gridLength/gridWidth. */
  gridSize?: number;
  /** Logical rows (length). */
  gridLength?: number;
  /** Logical columns (width). */
  gridWidth?: number;
  /** Target difficulty — turns for easy/medium, route length for hard. */
  difficulty?: Difficulty;
  shape?: MazeShape;
  /** Custom boolean cell mask (true = part of maze) generated from silhouette images. */
  customShapeMask?: boolean[][];
  startSide?: MazeStartSide;
  endSide?: MazeEndSide;
  /** Salt so repeated calls with the same sides still vary positions. */
  variationSeed?: number;
}

function clampDim(n: number | undefined, fallback: number): number {
  if (n == null || !Number.isFinite(n)) return fallback;
  return Math.max(5, Math.min(40, Math.round(n)));
}

function nearestPreset(gridSize: number): MazeSize {
  if (gridSize <= 12) return 'small';
  if (gridSize <= 17) return 'medium';
  if (gridSize <= 22) return 'large';
  return 'xl';
}

export function resolveMazeDimensions(options: {
  size?: MazeSize;
  gridSize?: number;
  gridLength?: number;
  gridWidth?: number;
}): { rows: number; cols: number } {
  const presetFallback = SIZES[options.size ?? 'medium'] ?? 15;
  const squareFallback = clampDim(options.gridSize, presetFallback);
  const rows = clampDim(options.gridLength ?? options.gridSize, squareFallback);
  const cols = clampDim(options.gridWidth ?? options.gridSize, squareFallback);
  return { rows, cols };
}

/** Count direction changes along a wall-grid solution path. */
export function countPathTurns(path: Position[]): number {
  if (path.length < 3) return 0;
  let turns = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const adr = Math.sign(path[i].row - path[i - 1].row);
    const adc = Math.sign(path[i].col - path[i - 1].col);
    const bdr = Math.sign(path[i + 1].row - path[i].row);
    const bdc = Math.sign(path[i + 1].col - path[i].col);
    if (adr !== bdr || adc !== bdc) turns += 1;
  }
  return turns;
}

export type MazeDifficultyTarget = {
  metric: 'turns' | 'length';
  min: number;
  max: number;
  ideal: number;
};

/**
 * Difficulty targets:
 * - Easy / medium → few vs more turns on the unique path
 * - Hard → longer routes (path length)
 */
export function mazeDifficultyTarget(
  rows: number,
  cols: number,
  difficulty: Difficulty
): MazeDifficultyTarget {
  const scale = Math.sqrt(Math.max(1, rows * cols));
  const area = Math.max(1, rows * cols);
  switch (difficulty) {
    case 'easy':
      return {
        metric: 'turns',
        min: 1,
        max: Math.max(3, Math.round(scale * 0.55)),
        ideal: Math.max(2, Math.round(scale * 0.32)),
      };
    case 'medium':
      return {
        metric: 'turns',
        min: Math.max(4, Math.round(scale * 0.75)),
        max: Math.max(12, Math.round(scale * 1.7)),
        ideal: Math.round(scale * 1.15),
      };
    case 'hard':
    default:
      return {
        metric: 'length',
        min: Math.max(28, Math.round(area * 0.32)),
        max: Math.max(70, Math.round(area * 0.98)),
        ideal: Math.round(area * 0.55),
      };
  }
}

/** @deprecated Use mazeDifficultyTarget — kept for callers expecting length-only bands. */
export function mazePathLengthTarget(
  gridSize: number,
  difficulty: Difficulty
): { min: number; max: number; ideal: number } {
  const t = mazeDifficultyTarget(gridSize, gridSize, difficulty);
  if (t.metric === 'length') return { min: t.min, max: t.max, ideal: t.ideal };
  // Approximate turn bands as short length bands for legacy callers.
  return {
    min: Math.max(8, t.min * 3),
    max: Math.max(16, t.max * 5),
    ideal: Math.round(((t.min + t.max) / 2) * 4),
  };
}

/** Classify a finished maze mainly by turns (easy/medium) or length (hard). */
export function classifyMazeDifficultyByPath(
  path: Position[],
  rows: number,
  cols: number
): Difficulty {
  const turns = countPathTurns(path);
  const length = Math.max(0, path.length - 1);
  const easy = mazeDifficultyTarget(rows, cols, 'easy');
  const medium = mazeDifficultyTarget(rows, cols, 'medium');
  if (turns <= easy.max) return 'easy';
  if (turns <= medium.max) return 'medium';
  // Long routes also count as hard even with moderate turns.
  const hard = mazeDifficultyTarget(rows, cols, 'hard');
  if (length >= hard.min) return 'hard';
  return 'medium';
}

/** @deprecated Use classifyMazeDifficultyByPath. */
export function classifyMazeDifficultyByPathLength(
  pathLength: number,
  gridSize: number
): Difficulty {
  const easy = mazeDifficultyTarget(gridSize, gridSize, 'easy');
  const medium = mazeDifficultyTarget(gridSize, gridSize, 'medium');
  // Map length → rough turn estimate (~1 turn per few steps).
  const approxTurns = Math.round(pathLength / 4);
  if (approxTurns <= easy.max) return 'easy';
  if (approxTurns <= medium.max) return 'medium';
  return 'hard';
}

function bandScore(
  value: number,
  target: { min: number; max: number; ideal: number }
): number {
  if (value >= target.min && value <= target.max) {
    return Math.abs(value - target.ideal) * 0.15;
  }
  if (value < target.min) return target.min - value + 8;
  return value - target.max + 8;
}

function scorePathForDifficulty(
  path: Position[],
  target: MazeDifficultyTarget
): number {
  const length = Math.max(0, path.length - 1);
  const turns = countPathTurns(path);
  const primary = target.metric === 'turns' ? turns : length;
  let score = bandScore(primary, target);
  // Soft secondary: hard also likes more turns; easy/medium prefer enough length to reach the exit.
  if (target.metric === 'length') {
    score += Math.max(0, 8 - turns) * 0.25;
  } else {
    score += Math.max(0, target.ideal * 2 - length) * 0.02;
  }
  return score;
}

/** Cell mask for the maze silhouette (true = part of the maze). */
function buildShapeMask(
  rows: number,
  cols: number,
  shape: MazeShape,
  customShapeMask?: boolean[][]
): boolean[][] {
  let mask: boolean[][];
  if (customShapeMask && customShapeMask.length > 0 && customShapeMask[0]?.length > 0) {
    const maskRows = customShapeMask.length;
    const maskCols = customShapeMask[0].length;
    mask = Array(rows)
      .fill(null)
      .map((_, r) =>
        Array(cols)
          .fill(false)
          .map((_, c) => {
            const origR = Math.min(maskRows - 1, Math.floor((r / rows) * maskRows));
            const origC = Math.min(maskCols - 1, Math.floor((c / cols) * maskCols));
            return Boolean(customShapeMask[origR]?.[origC]);
          })
      );
  } else {
    mask = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(false));
    const centerR = (rows - 1) / 2;
    const centerC = (cols - 1) / 2;
    const radiusR = rows / 2;
    const radiusC = cols / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dr = (r - centerR) / Math.max(0.5, radiusR);
        const dc = (c - centerC) / Math.max(0.5, radiusC);
        let inside = true;
        switch (shape) {
          case 'circle':
            inside = dr * dr + dc * dc <= 1 - 0.02;
            break;
          case 'triangle': {
            const halfWidth = ((r + 1) / rows) * 1.05;
            inside = Math.abs(dc) <= halfWidth;
            break;
          }
          case 'diamond':
            inside = Math.abs(dr) + Math.abs(dc) <= 1 - 0.02;
            break;
          case 'hexagon':
            inside =
              Math.abs(dc) + 0.5 * Math.abs(dr) <= 1 - 0.02 && Math.abs(dr) <= 1;
            break;
          default:
            inside = true;
        }
        mask[r][c] = inside;
      }
    }
  }

  const compId: number[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(-1));
  let bestId = -1;
  let bestCount = 0;
  let nextId = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c] || compId[r][c] !== -1) continue;
      const id = nextId++;
      let count = 0;
      const queue: Position[] = [{ row: r, col: c }];
      compId[r][c] = id;
      while (queue.length > 0) {
        const cur = queue.pop()!;
        count++;
        for (const [nr, nc] of [
          [cur.row - 1, cur.col],
          [cur.row + 1, cur.col],
          [cur.row, cur.col - 1],
          [cur.row, cur.col + 1],
        ]) {
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (!mask[nr][nc] || compId[nr][nc] !== -1) continue;
          compId[nr][nc] = id;
          queue.push({ row: nr, col: nc });
        }
      }
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      mask[r][c] = compId[r][c] === bestId;
    }
  }
  return mask;
}

interface Cell {
  visited: boolean;
  walls: { top: boolean; right: boolean; bottom: boolean; left: boolean };
}

function createGrid(rows: number, cols: number): Cell[][] {
  return Array(rows)
    .fill(null)
    .map(() =>
      Array(cols)
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
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (row > 0 && !grid[row - 1][col].visited) {
    neighbors.push({ row: row - 1, col, direction: 'top' });
  }
  if (col < cols - 1 && !grid[row][col + 1].visited) {
    neighbors.push({ row, col: col + 1, direction: 'right' });
  }
  if (row < rows - 1 && !grid[row + 1][col].visited) {
    neighbors.push({ row: row + 1, col, direction: 'bottom' });
  }
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

function isOpenCell(grid: boolean[][], r: number, c: number): boolean {
  return (
    r >= 0 &&
    c >= 0 &&
    r < grid.length &&
    c < (grid[0]?.length ?? 0) &&
    !grid[r][c]
  );
}

/** Collect open passage cells (odd,odd in wall grid). */
function listPassageCells(grid: boolean[][]): Position[] {
  const cells: Position[] = [];
  for (let r = 1; r < grid.length; r += 2) {
    for (let c = 1; c < (grid[0]?.length ?? 0); c += 2) {
      if (!grid[r][c]) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

type ResolvedMazeStartSide = Exclude<MazeStartSide, 'mixed'>;
type ResolvedMazeEndSide = Exclude<MazeEndSide, 'mixed'>;

const START_SIDES: ResolvedMazeStartSide[] = ['left', 'middle', 'right'];
const END_SIDES: ResolvedMazeEndSide[] = ['bottom', 'middle', 'left', 'right'];

function resolveStartSide(startSide: MazeStartSide): ResolvedMazeStartSide {
  if (startSide === 'mixed') {
    return pickRandom(START_SIDES) ?? 'middle';
  }
  return startSide;
}

function resolveEndSide(endSide: MazeEndSide): ResolvedMazeEndSide {
  if (endSide === 'mixed') {
    return pickRandom(END_SIDES) ?? 'bottom';
  }
  return endSide;
}

/**
 * Fix start along the top edge in the left / middle / right third.
 * Exact column still varies within that third between puzzles.
 */
function pickStartCell(
  grid: boolean[][],
  startSide: ResolvedMazeStartSide
): Position | null {
  const passages = listPassageCells(grid);
  if (passages.length === 0) return null;

  const topRow = Math.min(...passages.map((p) => p.row));
  const topCells = passages.filter((p) => p.row === topRow);
  const cols = topCells.map((p) => p.col);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);
  const span = Math.max(1, maxC - minC);
  const third = span / 3;

  const inThird = (p: Position) => {
    const t = (p.col - minC) / third;
    if (startSide === 'left') return t < 1.05;
    if (startSide === 'right') return t >= 1.95;
    return t >= 0.85 && t < 2.15;
  };

  const candidates = topCells.filter(inThird);
  return pickRandom(candidates.length > 0 ? candidates : topCells);
}

/**
 * Prefer an end region; exact cell always varies per puzzle within that region.
 */
function pickEndCell(
  grid: boolean[][],
  endSide: ResolvedMazeEndSide,
  start: Position
): Position | null {
  const passages = listPassageCells(grid).filter(
    (p) => !(p.row === start.row && p.col === start.col)
  );
  if (passages.length === 0) return null;

  const rows = passages.map((p) => p.row);
  const cols = passages.map((p) => p.col);
  const minR = Math.min(...rows);
  const maxR = Math.max(...rows);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);
  const midC = (minC + maxC) / 2;

  let candidates: Position[] = [];
  switch (endSide) {
    case 'bottom':
      candidates = passages.filter((p) => p.row >= maxR - 2);
      break;
    case 'left':
      candidates = passages.filter((p) => p.col <= minC + 2);
      break;
    case 'right':
      candidates = passages.filter((p) => p.col >= maxC - 2);
      break;
    case 'middle':
    default:
      // Middle of the bottom edge — varies left/right around center.
      candidates = passages.filter(
        (p) => p.row >= maxR - 2 && Math.abs(p.col - midC) <= Math.max(2, (maxC - minC) * 0.25)
      );
      break;
  }

  // Prefer cells farther from start for a longer path.
  const pool = candidates.length > 0 ? candidates : passages;
  pool.sort((a, b) => {
    const da = Math.abs(a.row - start.row) + Math.abs(a.col - start.col);
    const db = Math.abs(b.row - start.row) + Math.abs(b.col - start.col);
    return db - da;
  });
  // Take a random pick among the farthest third so end still changes each time.
  const far = pool.slice(0, Math.max(1, Math.ceil(pool.length / 3)));
  return pickRandom(far);
}

/** Open the outer wall at start (top) and end (toward preferred side). */
function openEndpointWalls(
  grid: boolean[][],
  outside: boolean[][] | undefined,
  start: Position,
  end: Position,
  endSide: ResolvedMazeEndSide
): void {
  const open = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= grid.length || c >= (grid[0]?.length ?? 0)) return;
    grid[r][c] = false;
    if (outside) outside[r][c] = false;
  };

  // Start sits on the top edge → open upward so the entrance is a gap.
  open(start.row - 1, start.col);
  // Also clear a second step if still walled (outer frame).
  if (start.row - 2 >= 0 && grid[start.row - 2][start.col]) {
    open(start.row - 2, start.col);
  }

  // End opening faces the chosen side.
  switch (endSide) {
    case 'left':
      open(end.row, end.col - 1);
      if (end.col - 2 >= 0) open(end.row, end.col - 2);
      break;
    case 'right':
      open(end.row, end.col + 1);
      if (end.col + 2 < (grid[0]?.length ?? 0)) open(end.row, end.col + 2);
      break;
    case 'middle':
    case 'bottom':
    default:
      open(end.row + 1, end.col);
      if (end.row + 2 < grid.length) open(end.row + 2, end.col);
      break;
  }
}

export function generateMaze(
  sizeOrOptions: MazeSize | GenerateMazeOptions = 'medium',
  shapeArg: MazeShape = 'square'
): MazePuzzle {
  const options: GenerateMazeOptions =
    typeof sizeOrOptions === 'string'
      ? { size: sizeOrOptions, shape: shapeArg }
      : sizeOrOptions;

  const shape = options.shape ?? 'square';
  const startSidePref = options.startSide ?? 'middle';
  const endSidePref = options.endSide ?? 'bottom';
  const targetDifficulty = options.difficulty;
  const presetFallback = SIZES[options.size ?? 'medium'];
  const squareFallback = clampDim(options.gridSize, presetFallback);
  const rows = clampDim(
    options.gridLength ?? options.gridSize,
    squareFallback
  );
  const cols = clampDim(
    options.gridWidth ?? options.gridSize,
    squareFallback
  );
  const sizeLabel =
    options.size ?? nearestPreset(Math.max(rows, cols));
  const pathTarget = targetDifficulty
    ? mazeDifficultyTarget(rows, cols, targetDifficulty)
    : null;

  const topologyTries = pathTarget ? 12 : 1;
  const endpointTries = pathTarget ? 56 : 12;

  let best: {
    mazeGrid: boolean[][];
    outsideGrid: boolean[][];
    start: Position;
    end: Position;
    endSide: Exclude<MazeEndSide, 'mixed'>;
    path: Position[];
    score: number;
  } | null = null;

  topologyLoop: for (let topo = 0; topo < topologyTries; topo++) {
    const built = buildMazeTopology(rows, cols, shape, options.customShapeMask);
    if (!built) continue;

    for (let ep = 0; ep < endpointTries; ep++) {
      const startSide = resolveStartSide(startSidePref);
      const endSide = resolveEndSide(endSidePref);
      const start =
        pickStartCell(built.mazeGrid, startSide) ??
        ({
          row: built.seed.row * 2 + 1,
          col: built.seed.col * 2 + 1,
        } as Position);
      let end = pickEndCell(built.mazeGrid, endSide, start);
      if (!end || (end.row === start.row && end.col === start.col)) {
        const passages = listPassageCells(built.mazeGrid).filter(
          (p) => !(p.row === start.row && p.col === start.col)
        );
        end =
          pickRandom(passages) ??
          ({
            row: built.mazeGrid.length - 2,
            col: built.mazeGrid[0].length - 2,
          } as Position);
      }

      // Clone grids so opening walls for a candidate doesn't poison others.
      const mazeGrid = built.mazeGrid.map((row) => row.slice());
      const outsideGrid = built.outsideGrid.map((row) => row.slice());
      openEndpointWalls(mazeGrid, outsideGrid, start, end, endSide);
      mazeGrid[start.row][start.col] = false;
      mazeGrid[end.row][end.col] = false;
      outsideGrid[start.row][start.col] = false;
      outsideGrid[end.row][end.col] = false;

      const path = solveMazePath(mazeGrid, start, end);
      if (path.length < 2) continue;
      const length = path.length - 1;
      const turns = countPathTurns(path);
      const score = pathTarget
        ? scorePathForDifficulty(path, pathTarget)
        : -length; // without a target, prefer a reasonably long unique path

      if (!best || score < best.score) {
        best = { mazeGrid, outsideGrid, start, end, endSide, path, score };
        // Good enough for target band — stop early.
        if (pathTarget) {
          const value = pathTarget.metric === 'turns' ? turns : length;
          if (
            value >= pathTarget.min &&
            value <= pathTarget.max &&
            Math.abs(value - pathTarget.ideal) <=
              Math.max(2, pathTarget.ideal * 0.15)
          ) {
            break topologyLoop;
          }
        }
      }
    }
  }

  if (!best) {
    // Absolute fallback — single topology, default endpoints.
    const built = buildMazeTopology(rows, cols, shape, options.customShapeMask)!;
    const startSide = resolveStartSide(startSidePref);
    const endSide = resolveEndSide(endSidePref);
    const start =
      pickStartCell(built.mazeGrid, startSide) ??
      ({ row: built.seed.row * 2 + 1, col: built.seed.col * 2 + 1 } as Position);
    let end = pickEndCell(built.mazeGrid, endSide, start);
    if (!end) {
      end = {
        row: built.mazeGrid.length - 2,
        col: built.mazeGrid[0].length - 2,
      };
    }
    openEndpointWalls(built.mazeGrid, built.outsideGrid, start, end, endSide);
    built.mazeGrid[start.row][start.col] = false;
    built.mazeGrid[end.row][end.col] = false;
    const path = solveMazePath(built.mazeGrid, start, end);
    best = {
      mazeGrid: built.mazeGrid,
      outsideGrid: built.outsideGrid,
      start,
      end,
      endSide,
      path,
      score: 0,
    };
  }

  const difficulty =
    targetDifficulty ??
    classifyMazeDifficultyByPath(best.path, rows, cols);

  void options.variationSeed;
  void isOpenCell;

  return {
    type: 'maze',
    grid: best.mazeGrid,
    start: best.start,
    end: best.end,
    size: sizeLabel,
    gridSize: Math.max(rows, cols),
    gridLength: rows,
    gridWidth: cols,
    difficulty,
    shape,
    outside: (shape === 'square' && !options.customShapeMask) ? undefined : best.outsideGrid,
    solutionPath:
      best.path.length > 1
        ? best.path
        : solveMazePath(best.mazeGrid, best.start, best.end),
  };
}

function buildMazeTopology(
  rows: number,
  cols: number,
  shape: MazeShape,
  customShapeMask?: boolean[][]
): {
  mazeGrid: boolean[][];
  outsideGrid: boolean[][];
  seed: Position;
} | null {
  const grid = createGrid(rows, cols);
  const mask = buildShapeMask(rows, cols, shape, customShapeMask);

  let seed: Position | null = null;
  for (let r = 0; r < rows && !seed; r++) {
    for (let c = 0; c < cols && !seed; c++) {
      if (mask[r][c]) seed = { row: r, col: c };
    }
  }
  if (!seed) seed = { row: 0, col: 0 };

  const stack: Position[] = [seed];
  grid[seed.row][seed.col].visited = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const neighbors = getUnvisitedNeighbors(grid, current.row, current.col).filter(
      (n) => mask[n.row][n.col]
    );

    if (neighbors.length > 0) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      removeWall(grid, current, next, next.direction);
      grid[next.row][next.col].visited = true;
      stack.push({ row: next.row, col: next.col });
    } else {
      stack.pop();
    }
  }

  const wallRows = rows * 2 + 1;
  const wallCols = cols * 2 + 1;
  const mazeGrid: boolean[][] = Array(wallRows)
    .fill(null)
    .map(() => Array(wallCols).fill(true));
  const outsideGrid: boolean[][] = Array(wallRows)
    .fill(null)
    .map(() => Array(wallCols).fill(true));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) continue;
      const mazeRow = r * 2 + 1;
      const mazeCol = c * 2 + 1;
      mazeGrid[mazeRow][mazeCol] = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          outsideGrid[mazeRow + dr][mazeCol + dc] = false;
        }
      }

      if (!grid[r][c].walls.top && r > 0) mazeGrid[mazeRow - 1][mazeCol] = false;
      if (!grid[r][c].walls.right && c < cols - 1) mazeGrid[mazeRow][mazeCol + 1] = false;
      if (!grid[r][c].walls.bottom && r < rows - 1) mazeGrid[mazeRow + 1][mazeCol] = false;
      if (!grid[r][c].walls.left && c > 0) mazeGrid[mazeRow][mazeCol - 1] = false;
    }
  }

  return { mazeGrid, outsideGrid, seed };
}

/** BFS shortest path through the wall grid (unique in a perfect maze). */
export function solveMazePath(
  grid: boolean[][],
  start: Position,
  end: Position
): Position[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return [];

  const key = (r: number, c: number) => r * cols + c;
  const prev = new Map<number, number>();
  const visited = new Set<number>([key(start.row, start.col)]);
  const queue: Position[] = [start];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.row === end.row && current.col === end.col) {
      const path: Position[] = [];
      let cursor = key(end.row, end.col);
      while (true) {
        path.push({ row: Math.floor(cursor / cols), col: cursor % cols });
        const parent = prev.get(cursor);
        if (parent === undefined) break;
        cursor = parent;
      }
      return path.reverse();
    }
    const steps = [
      { row: current.row - 1, col: current.col },
      { row: current.row + 1, col: current.col },
      { row: current.row, col: current.col - 1 },
      { row: current.row, col: current.col + 1 },
    ];
    for (const next of steps) {
      if (next.row < 0 || next.row >= rows || next.col < 0 || next.col >= cols) continue;
      if (grid[next.row][next.col]) continue;
      const k = key(next.row, next.col);
      if (visited.has(k)) continue;
      visited.add(k);
      prev.set(k, key(current.row, current.col));
      queue.push(next);
    }
  }
  return [];
}
