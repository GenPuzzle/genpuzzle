/**
 * Shared per-document settings for the "generic" puzzle modules
 * (Sudoku, Maze, Cryptogram, Word Scramble). Mirrors the crossword settings
 * module so these puzzle types plug into the same generate / preview /
 * export / save pipeline as word search and crossword.
 */

import type {
  Difficulty,
  MazeEndSide,
  MazeMarkerStyle,
  MazeShape,
  MazeSolutionPathStyle,
  MazeStartSide,
} from './puzzles/types';
import type { SudokuSize } from './puzzles/sudoku';
import { SUDOKU_SIZES, isSudokuSize } from './puzzles/sudoku';

export type GenericPuzzleModuleType =
  | 'sudoku'
  | 'maze'
  | 'cryptogram'
  | 'word-scramble'
  | 'trivia';

export function isGenericPuzzleModuleType(type: string): type is GenericPuzzleModuleType {
  return (
    type === 'sudoku' ||
    type === 'maze' ||
    type === 'cryptogram' ||
    type === 'word-scramble' ||
    type === 'trivia'
  );
}

export type GenericPuzzleNumberingStyle = 'prefix' | 'suffix' | 'none';
export type GenericPuzzleTitleOption = 'custom' | 'custom_per_puzzle';
export type GenericSolutionTitleStyle = 'same_as_puzzle' | 'custom';
export type MazeSizePreset = 'small' | 'medium' | 'large' | 'xl';
export type MazeSizeMode = MazeSizePreset | 'mixed';
export type MazeSizeLevel = 'easy' | 'medium' | 'hard';

export type SudokuSizeMode = SudokuSize | 'mixed';
export type SudokuDifficultyMode = Difficulty | 'mixed';
/** Where (or whether) the difficulty label appears relative to the grid / title. */
export type SudokuDifficultyPlacement = 'bottom' | 'top' | 'in_title' | 'none';
/** Top-level Sudoku document mode. Absent on older projects → standard. */
export type SudokuPuzzleMode = 'standard' | 'calcudoku' | 'mixed';
export type CalcudokuGridSize = 4 | 5 | 6 | 7 | 8 | 9;
export type CalcudokuGridSizeMode = CalcudokuGridSize | 'mixed';
export type CalcudokuDifficultyMode = 'easy' | 'medium' | 'hard' | 'expert' | 'mixed';

export const CALCUDOKU_GRID_SIZES: CalcudokuGridSize[] = [4, 5, 6, 7, 8, 9];

export function isSudokuPuzzleMode(value: unknown): value is SudokuPuzzleMode {
  return value === 'standard' || value === 'calcudoku' || value === 'mixed';
}

export function isCalcudokuDifficulty(value: unknown): value is CalcudokuDifficultyMode {
  return (
    value === 'easy' ||
    value === 'medium' ||
    value === 'hard' ||
    value === 'expert' ||
    value === 'mixed'
  );
}

export function isCalcudokuGridSize(value: unknown): value is CalcudokuGridSize {
  return (
    value === 4 || value === 5 || value === 6 || value === 7 || value === 8 || value === 9
  );
}

export const CALCUDOKU_DIFFICULTIES = ['easy', 'medium', 'hard', 'expert'] as const;
export type CalcudokuConcreteDifficulty = (typeof CALCUDOKU_DIFFICULTIES)[number];

export const CALCUDOKU_MIX_DIFFICULTY_FIELD: Record<
  CalcudokuConcreteDifficulty,
  'calcudokuMixEasy' | 'calcudokuMixMedium' | 'calcudokuMixHard' | 'calcudokuMixExpert'
> = {
  easy: 'calcudokuMixEasy',
  medium: 'calcudokuMixMedium',
  hard: 'calcudokuMixHard',
  expert: 'calcudokuMixExpert',
};

export const CALCUDOKU_MIX_SIZE_FIELD: Record<
  CalcudokuGridSize,
  | 'calcudokuMix4'
  | 'calcudokuMix5'
  | 'calcudokuMix6'
  | 'calcudokuMix7'
  | 'calcudokuMix8'
  | 'calcudokuMix9'
> = {
  4: 'calcudokuMix4',
  5: 'calcudokuMix5',
  6: 'calcudokuMix6',
  7: 'calcudokuMix7',
  8: 'calcudokuMix8',
  9: 'calcudokuMix9',
};

export { type SudokuSize, SUDOKU_SIZES, isSudokuSize };

/** Default N×N cell counts for named size presets. */
export const MAZE_PRESET_GRID_SIZE: Record<MazeSizePreset, number> = {
  small: 10,
  medium: 15,
  large: 20,
  xl: 25,
};

/** Default length×width (rows×cols) for mixed difficulty levels. */
export const MAZE_LEVEL_DEFAULT_GRID: Record<
  MazeSizeLevel,
  { length: number; width: number }
> = {
  easy: { length: 10, width: 10 },
  medium: { length: 15, width: 15 },
  hard: { length: 20, width: 20 },
};

/** @deprecated Prefer MAZE_LEVEL_DEFAULT_GRID (length × width). */
export const MAZE_LEVEL_DEFAULT_GRID_SIZE: Record<MazeSizeLevel, number> = {
  easy: MAZE_LEVEL_DEFAULT_GRID.easy.length,
  medium: MAZE_LEVEL_DEFAULT_GRID.medium.length,
  hard: MAZE_LEVEL_DEFAULT_GRID.hard.length,
};

/** @deprecated Prefer MAZE_LEVEL_DEFAULT_GRID + editable settings. */
export const MAZE_SIZE_LEVEL_PRESET: Record<MazeSizeLevel, MazeSizePreset> = {
  easy: 'small',
  medium: 'medium',
  hard: 'large',
};

export const MAZE_SIZE_LEVEL_META: Array<{
  level: MazeSizeLevel;
  label: string;
  sizeLabel: string;
}> = [
  { level: 'easy', label: 'Easy', sizeLabel: 'few turns to the finish' },
  { level: 'medium', label: 'Medium', sizeLabel: 'more turns along the path' },
  { level: 'hard', label: 'Hard', sizeLabel: 'longer route to the finish' },
];

export function nearestMazeSizePreset(gridSize: number): MazeSizePreset {
  const n = Math.max(5, Math.round(gridSize));
  if (n <= 12) return 'small';
  if (n <= 17) return 'medium';
  if (n <= 22) return 'large';
  return 'xl';
}

export function mazeLevelLengthKey(
  level: MazeSizeLevel
): 'mazeEasyGridLength' | 'mazeMediumGridLength' | 'mazeHardGridLength' {
  if (level === 'easy') return 'mazeEasyGridLength';
  if (level === 'medium') return 'mazeMediumGridLength';
  return 'mazeHardGridLength';
}

export function mazeLevelWidthKey(
  level: MazeSizeLevel
): 'mazeEasyGridWidth' | 'mazeMediumGridWidth' | 'mazeHardGridWidth' {
  if (level === 'easy') return 'mazeEasyGridWidth';
  if (level === 'medium') return 'mazeMediumGridWidth';
  return 'mazeHardGridWidth';
}

/** @deprecated Use mazeLevelLengthKey / mazeLevelWidthKey. */
export function mazeLevelGridSizeKey(
  level: MazeSizeLevel
): 'mazeEasyGridLength' | 'mazeMediumGridLength' | 'mazeHardGridLength' {
  return mazeLevelLengthKey(level);
}

export const SUDOKU_SIZE_META: Array<{
  size: SudokuSize;
  label: string;
  description: string;
  tier: 'easy' | 'medium' | 'hard';
}> = [
  { size: 4, label: '4×4', description: 'Very easy / kids / beginners', tier: 'easy' },
  { size: 6, label: '6×6', description: 'Easy to medium', tier: 'easy' },
  { size: 9, label: '9×9', description: 'Standard Sudoku', tier: 'medium' },
  { size: 12, label: '12×12', description: 'Advanced', tier: 'medium' },
  { size: 16, label: '16×16', description: 'Expert (numbers + letters)', tier: 'hard' },
  { size: 25, label: '25×25', description: 'Very large / expert', tier: 'hard' },
];

export type SudokuMixedSizeCounts = Record<SudokuSize, number>;

/**
 * Hard-weighted split: hard gets ~50%, medium ~30%, easy ~20%.
 * Remainders go to hard first, then medium.
 */
export function defaultMixedMazeLevelCounts(total: number): {
  easy: number;
  medium: number;
  hard: number;
} {
  const n = Math.max(0, Math.round(total));
  if (n === 0) return { easy: 0, medium: 0, hard: 0 };
  if (n === 1) return { easy: 0, medium: 0, hard: 1 };
  if (n === 2) return { easy: 0, medium: 1, hard: 1 };

  let hard = Math.round(n * 0.5);
  let medium = Math.round(n * 0.3);
  let easy = n - hard - medium;
  if (easy < 0) {
    medium += easy;
    easy = 0;
  }
  // Prefer hard never dropping below medium / easy.
  while (easy > hard && hard + medium + easy === n) {
    easy -= 1;
    hard += 1;
  }
  while (medium > hard) {
    medium -= 1;
    hard += 1;
  }
  // Fix drift
  const sum = easy + medium + hard;
  if (sum < n) hard += n - sum;
  if (sum > n) {
    let overflow = sum - n;
    for (const key of ['easy', 'medium', 'hard'] as const) {
      const take = Math.min(overflow, key === 'hard' ? hard : key === 'medium' ? medium : easy);
      if (key === 'easy') easy -= take;
      else if (key === 'medium') medium -= take;
      else hard -= take;
      overflow -= take;
      if (overflow <= 0) break;
    }
  }
  return { easy: Math.max(0, easy), medium: Math.max(0, medium), hard: Math.max(0, hard) };
}

/** Same hard-weighted split used for sudoku mixed difficulty. */
export const defaultMixedSudokuLevelCounts = defaultMixedMazeLevelCounts;

/** Expand level counts into an ordered list (easy → medium → hard). */
export function expandMixedMazeLevelPlan(
  counts: {
    easy: number;
    medium: number;
    hard: number;
  },
  gridSizes?: {
    easy?: { length?: number; width?: number } | number;
    medium?: { length?: number; width?: number } | number;
    hard?: { length?: number; width?: number } | number;
  }
): Array<{
  gridLength: number;
  gridWidth: number;
  /** @deprecated Prefer gridLength/gridWidth — kept as max side for labels. */
  gridSize: number;
  difficulty: Difficulty;
  size: MazeSizePreset;
}> {
  const resolveDims = (
    level: MazeSizeLevel,
    raw: { length?: number; width?: number } | number | undefined
  ) => {
    const def = MAZE_LEVEL_DEFAULT_GRID[level];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const n = Math.max(5, Math.min(40, Math.round(raw)));
      return { length: n, width: n };
    }
    const length = Math.max(
      5,
      Math.min(40, Math.round(raw?.length ?? def.length))
    );
    const width = Math.max(
      5,
      Math.min(40, Math.round(raw?.width ?? def.width))
    );
    return { length, width };
  };

  const easy = resolveDims('easy', gridSizes?.easy);
  const medium = resolveDims('medium', gridSizes?.medium);
  const hard = resolveDims('hard', gridSizes?.hard);

  const plan: Array<{
    gridLength: number;
    gridWidth: number;
    gridSize: number;
    difficulty: Difficulty;
    size: MazeSizePreset;
  }> = [];
  for (let i = 0; i < Math.max(0, counts.easy); i++) {
    plan.push({
      gridLength: easy.length,
      gridWidth: easy.width,
      gridSize: Math.max(easy.length, easy.width),
      difficulty: 'easy',
      size: nearestMazeSizePreset(Math.max(easy.length, easy.width)),
    });
  }
  for (let i = 0; i < Math.max(0, counts.medium); i++) {
    plan.push({
      gridLength: medium.length,
      gridWidth: medium.width,
      gridSize: Math.max(medium.length, medium.width),
      difficulty: 'medium',
      size: nearestMazeSizePreset(Math.max(medium.length, medium.width)),
    });
  }
  for (let i = 0; i < Math.max(0, counts.hard); i++) {
    plan.push({
      gridLength: hard.length,
      gridWidth: hard.width,
      gridSize: Math.max(hard.length, hard.width),
      difficulty: 'hard',
      size: nearestMazeSizePreset(Math.max(hard.length, hard.width)),
    });
  }
  return plan;
}

/** @deprecated Use expandMixedMazeLevelPlan — returns only size presets. */
export function expandMixedMazeSizePlan(counts: {
  easy: number;
  medium: number;
  hard: number;
}): MazeSizePreset[] {
  return expandMixedMazeLevelPlan(counts).map((entry) => entry.size);
}

export function expandMixedSudokuDifficultyPlan(counts: {
  easy: number;
  medium: number;
  hard: number;
}): Difficulty[] {
  const plan: Difficulty[] = [];
  for (let i = 0; i < Math.max(0, counts.easy); i++) plan.push('easy');
  for (let i = 0; i < Math.max(0, counts.medium); i++) plan.push('medium');
  for (let i = 0; i < Math.max(0, counts.hard); i++) plan.push('hard');
  return plan;
}

/**
 * Hard-weighted mixed grid sizes: easy tier ~20% (4×4+6×6), medium ~30% (9×9+12×12),
 * hard ~50% (16×16+25×25, with 25 getting more of the hard bucket).
 */
export function defaultMixedSudokuSizeCounts(total: number): SudokuMixedSizeCounts {
  const tiers = defaultMixedSudokuLevelCounts(total);
  const size4 = Math.ceil(tiers.easy / 2);
  const size6 = Math.max(0, tiers.easy - size4);
  const size9 = Math.ceil(tiers.medium / 2);
  const size12 = Math.max(0, tiers.medium - size9);
  const size25 =
    tiers.hard <= 0 ? 0 : Math.max(1, Math.round(tiers.hard * 0.55));
  const size25Fixed = Math.min(size25, tiers.hard);
  const size16 = Math.max(0, tiers.hard - size25Fixed);
  return {
    4: size4,
    6: size6,
    9: size9,
    12: size12,
    16: size16,
    25: size25Fixed,
  };
}

export function sumMixedSudokuSizeCounts(counts: SudokuMixedSizeCounts): number {
  return SUDOKU_SIZES.reduce((sum, size) => sum + Math.max(0, counts[size] ?? 0), 0);
}

export function expandMixedSudokuSizePlan(counts: SudokuMixedSizeCounts): SudokuSize[] {
  const plan: SudokuSize[] = [];
  for (const row of SUDOKU_SIZE_META) {
    const n = Math.max(0, counts[row.size] ?? 0);
    for (let i = 0; i < n; i++) plan.push(row.size);
  }
  return plan;
}

export function selectedCalcudokuMixSizes(
  core: Pick<
    GenericPuzzleCoreSettings,
    | 'calcudokuMix4'
    | 'calcudokuMix5'
    | 'calcudokuMix6'
    | 'calcudokuMix7'
    | 'calcudokuMix8'
    | 'calcudokuMix9'
  >
): CalcudokuGridSize[] {
  return CALCUDOKU_GRID_SIZES.filter((size) => core[CALCUDOKU_MIX_SIZE_FIELD[size]] === true);
}

export function resolveCalcudokuGridSizes(core: GenericPuzzleCoreSettings): CalcudokuGridSize[] {
  if (core.calcudokuGridSize === 'mixed') {
    const selected = selectedCalcudokuMixSizes(core);
    return selected.length > 0 ? selected : [];
  }
  return isCalcudokuGridSize(core.calcudokuGridSize) ? [core.calcudokuGridSize] : [6];
}

export function selectedCalcudokuMixDifficulties(
  core: Pick<
    GenericPuzzleCoreSettings,
    'calcudokuMixEasy' | 'calcudokuMixMedium' | 'calcudokuMixHard' | 'calcudokuMixExpert'
  >
): CalcudokuConcreteDifficulty[] {
  return CALCUDOKU_DIFFICULTIES.filter(
    (level) => core[CALCUDOKU_MIX_DIFFICULTY_FIELD[level]] === true
  );
}

export function resolveCalcudokuDifficulties(
  core: GenericPuzzleCoreSettings
): CalcudokuConcreteDifficulty[] {
  if (core.calcudokuDifficulty === 'mixed') {
    const selected = selectedCalcudokuMixDifficulties(core);
    return selected.length > 0 ? selected : [];
  }
  return core.calcudokuDifficulty === 'medium' ||
    core.calcudokuDifficulty === 'hard' ||
    core.calcudokuDifficulty === 'expert'
    ? [core.calcudokuDifficulty]
    : ['easy'];
}

/** Returns a blocking UI/generate message, or null when generation may proceed. */
export function sudokuModeGenerationBlockMessage(core: GenericPuzzleCoreSettings): string | null {
  const mode = isSudokuPuzzleMode(core.sudokuPuzzleMode) ? core.sudokuPuzzleMode : 'standard';
  const includeStandard = core.sudokuMixedIncludeStandard !== false;
  const includeCalcudoku = core.sudokuMixedIncludeCalcudoku !== false;
  if (mode === 'mixed' && !includeStandard && !includeCalcudoku) {
    return 'Select at least one puzzle type to mix (Standard Sudoku and/or Calcudoku).';
  }
  const usesCalcudoku =
    mode === 'calcudoku' || (mode === 'mixed' && includeCalcudoku);
  if (usesCalcudoku && core.calcudokuGridSize === 'mixed') {
    const selected = selectedCalcudokuMixSizes(core);
    if (selected.length === 0) {
      return 'Select at least one Calcudoku grid size to mix before generating.';
    }
  }
  if (usesCalcudoku && core.calcudokuDifficulty === 'mixed') {
    const selected = selectedCalcudokuMixDifficulties(core);
    if (selected.length === 0) {
      return 'Select at least one Calcudoku difficulty to mix before generating.';
    }
  }
  return null;
}

export function sudokuModeGenerationHint(core: GenericPuzzleCoreSettings): string | null {
  const mode = isSudokuPuzzleMode(core.sudokuPuzzleMode) ? core.sudokuPuzzleMode : 'standard';
  const usesCalcudoku =
    mode === 'calcudoku' ||
    (mode === 'mixed' && core.sudokuMixedIncludeCalcudoku !== false);
  if (usesCalcudoku && core.calcudokuGridSize === 'mixed') {
    const selected = selectedCalcudokuMixSizes(core);
    if (selected.length === 1) {
      return `Only one grid size is selected — every Calcudoku will use ${selected[0]}×${selected[0]}.`;
    }
  }
  return null;
}

export type MazeMixedShapeCounts = {
  square: number;
  circle: number;
  diamond: number;
  hexagon: number;
  triangle: number;
  custom_image: number;
};

/** Shape tiers for hard-weighted mixed defaults (easy → hard). */
export const MAZE_SHAPE_MIX_META: Array<{
  shape: MazeShapeMode;
  tier: 'easy' | 'medium' | 'hard';
  level: string;
  label: string;
}> = [
  { shape: 'square', tier: 'easy', level: 'Easy', label: 'Square' },
  { shape: 'circle', tier: 'medium', level: 'Easy–Medium', label: 'Circle' },
  { shape: 'diamond', tier: 'medium', level: 'Medium', label: 'Diamond' },
  { shape: 'hexagon', tier: 'hard', level: 'Medium–Hard', label: 'Hexagon' },
  { shape: 'triangle', tier: 'hard', level: 'Hard', label: 'Triangle' },
  { shape: 'custom_image', tier: 'hard', level: 'Custom', label: 'Image to maze' },
];

/**
 * Hard-weighted shape mix: easy tier ~20% (square), medium ~30% (circle+diamond),
 * hard ~50% (hexagon+triangle, with triangle getting more of the hard bucket).
 */
export function defaultMixedMazeShapeCounts(total: number): MazeMixedShapeCounts {
  const tiers = defaultMixedMazeLevelCounts(total);
  const circle = Math.ceil(tiers.medium / 2);
  const diamond = Math.max(0, tiers.medium - circle);
  // Harder shape (triangle) takes the larger share of the hard bucket.
  const triangle =
    tiers.hard <= 0 ? 0 : Math.max(1, Math.round(tiers.hard * 0.6));
  const triangleFixed = Math.min(triangle, tiers.hard);
  const hexagon = Math.max(0, tiers.hard - triangleFixed);
  return {
    square: tiers.easy,
    circle,
    diamond,
    hexagon,
    triangle: triangleFixed,
    custom_image: 0,
  };
}

export function sumMixedMazeShapeCounts(counts: MazeMixedShapeCounts): number {
  return (
    Math.max(0, counts.square) +
    Math.max(0, counts.circle) +
    Math.max(0, counts.diamond) +
    Math.max(0, counts.hexagon) +
    Math.max(0, counts.triangle) +
    Math.max(0, counts.custom_image)
  );
}

/** Expand shape counts into an ordered list (easy → hard). */
export function expandMixedMazeShapePlan(counts: MazeMixedShapeCounts): MazeShapeMode[] {
  const plan: MazeShapeMode[] = [];
  for (const row of MAZE_SHAPE_MIX_META) {
    const n = Math.max(0, counts[row.shape] ?? 0);
    for (let i = 0; i < n; i++) plan.push(row.shape);
  }
  return plan;
}

/** Always thin lines — kept for persisted settings compatibility. */
export type MazeWallStyle = 'lines';
export type MazeShapeMode = MazeShape | 'custom_image' | 'mixed';
export type CryptogramCipherType = 'letters' | 'numbers';
export type GenericLetterCase = 'upper' | 'lower';
export type CryptogramFormat = 'lines' | 'boxes';
export type ScrambleSeparator = 'equal' | 'blank';
export type ScrambleAnswerStyle = 'dash' | 'underline' | 'blank' | 'boxes';
export type GenericTitleAlign = 'left' | 'center';
export type TriviaLayoutFormat = 'single-column' | 'two-column' | 'compact';
export type TriviaCheckboxStyle = 'circle' | 'square';
/** How answer suggestions are arranged under each question. */
export type TriviaSuggestionsColumns = 'single' | 'two';
/** How many answer columns on trivia solution pages (each column is # | Answer). */
export type TriviaSolutionColumns = 1 | 2 | 3 | 4;

export interface GenericPuzzleCoreSettings {
  numberOfPuzzles: number;
  puzzlesStartingNumber: number;
  /** How many puzzles per puzzle page (1, 2 or 4). */
  puzzlesPerPage: number;
  /** Percent scale of the puzzle grid on puzzle pages (100 = default). */
  puzzleGridScale: number;
  /** Percent scale of the grids on solution pages. */
  solutionGridScale: number;
  /** How many solved grids per solutions page. */
  solutionsPerPage: number;
  /** Fit grid scale to the page safe area + page-number zone. */
  autoBalanceGrid: boolean;
  /** Fit puzzle fonts so text stays inside the page. */
  autoBalanceFont: boolean;
  // --- Sudoku ---
  /**
   * Standard Sudoku, Calcudoku, or a mix of both types.
   * Older projects omit this field and are treated as `standard`.
   */
  sudokuPuzzleMode: SudokuPuzzleMode;
  /** When sudokuPuzzleMode === 'mixed': include Standard Sudoku. */
  sudokuMixedIncludeStandard: boolean;
  /** When sudokuPuzzleMode === 'mixed': include Calcudoku. */
  sudokuMixedIncludeCalcudoku: boolean;
  /** Calcudoku board size, or mixed 4–9. */
  calcudokuGridSize: CalcudokuGridSizeMode;
  calcudokuMix4: boolean;
  calcudokuMix5: boolean;
  calcudokuMix6: boolean;
  calcudokuMix7: boolean;
  calcudokuMix8: boolean;
  calcudokuMix9: boolean;
  /** Easy +, Medium +−, Hard +−×, Expert +−×÷, or mixed. */
  calcudokuDifficulty: CalcudokuDifficultyMode;
  calcudokuMixEasy: boolean;
  calcudokuMixMedium: boolean;
  calcudokuMixHard: boolean;
  calcudokuMixExpert: boolean;
  /** Fixed board size, or mixed sizes. */
  sudokuSize: SudokuSizeMode;
  /** Editable counts when sudokuSize === 'mixed'. */
  sudokuMixedSize4: number;
  sudokuMixedSize6: number;
  sudokuMixedSize9: number;
  sudokuMixedSize12: number;
  sudokuMixedSize16: number;
  sudokuMixedSize25: number;
  /** Fixed difficulty, or mixed easy→hard. */
  sudokuDifficulty: SudokuDifficultyMode;
  /** Editable counts when sudokuDifficulty === 'mixed'. */
  sudokuMixedEasyCount: number;
  sudokuMixedMediumCount: number;
  sudokuMixedHardCount: number;
  /**
   * @deprecated Prefer sudokuDifficultyPlacement. Kept for older project files.
   * Show the difficulty label under each sudoku grid.
   */
  showDifficultyLabel: boolean;
  /** Where to show the difficulty label (or hide it). */
  sudokuDifficultyPlacement: SudokuDifficultyPlacement;
  /** Cell-line thickness on puzzle pages (percent of default). */
  sudokuPuzzleLineThickness: number;
  /** Cell-line thickness on solution pages (percent of default). */
  sudokuSolutionLineThickness: number;
  // --- Maze ---
  /** Fixed size, or mixed easy→hard levels. */
  mazeSize: MazeSizeMode;
  /** Editable counts when mazeSize === 'mixed'. */
  mazeMixedEasyCount: number;
  mazeMixedMediumCount: number;
  mazeMixedHardCount: number;
  /** Editable per-shape counts when mazeShape === 'mixed'. */
  mazeMixedShapeSquare: number;
  mazeMixedShapeCircle: number;
  mazeMixedShapeDiamond: number;
  mazeMixedShapeHexagon: number;
  mazeMixedShapeTriangle: number;
  mazeMixedShapeCustomImage?: number;
  /** Fixed silhouette, or mixed easy→hard progression. */
  mazeShape: MazeShapeMode;
  /** Always thin lines. */
  mazeWallStyle: MazeWallStyle;
  /** Wall thickness for the lines style (percent of cell size). */
  mazeWallThickness: number;
  /** Fix start along the top edge: left / middle / right third. */
  mazeStartSide: MazeStartSide;
  /** Preferred end region; exact cell still varies per puzzle. */
  mazeEndSide: MazeEndSide;
  /** Editable grid length (rows) for mixed Easy level. */
  mazeEasyGridLength: number;
  /** Editable grid width (cols) for mixed Easy level. */
  mazeEasyGridWidth: number;
  /** Editable grid length (rows) for mixed Medium level. */
  mazeMediumGridLength: number;
  /** Editable grid width (cols) for mixed Medium level. */
  mazeMediumGridWidth: number;
  /** Editable grid length (rows) for mixed Hard level. */
  mazeHardGridLength: number;
  /** Editable grid width (cols) for mixed Hard level. */
  mazeHardGridWidth: number;
  /** How start/end markers are drawn. */
  mazeMarkerStyle: MazeMarkerStyle;
  /** Shared start marker image (data URL) when mazeMarkerStyle === 'image'. */
  mazeStartImage: string;
  /** Shared end marker image (data URL) when mazeMarkerStyle === 'image'. */
  mazeEndImage: string;
  /** Solution path stroke style on solution pages. */
  mazeSolutionPathStyle: MazeSolutionPathStyle;
  /** Solution path thickness as a percent of cell size. */
  mazeSolutionPathThickness: number;
  // --- Shape Mazes ---
  shapeMazeEnabled?: boolean;
  shapeMaskMode?: 'common' | 'per-puzzle';
  shapeMaskImage?: string;
  shapeMaskImages?: string[];
  shapeMaskAlphaThreshold?: number;
  shapeMaskFit?: 'contain' | 'cover' | 'stretch';
  shapeMaskShowImage?: boolean;
  shapeMaskImageOpacity?: number;
  // --- Cryptogram ---
  /** One phrase per line; blank falls back to built-in famous quotes. */
  cryptogramPhrases: string;
  cipherType: CryptogramCipherType;
  /** Blank style under each cipher token. */
  cryptogramFormat: CryptogramFormat;
  /** Show a decoded-letters answer key on the puzzle page. */
  showLetterHints: boolean;
  /** How many letters the on-page key reveals. */
  hintLettersCount: number;
  /** Alphabet answer-key table rows: 1 (A–Z), 2 (13+13), or 3 (~9 each). */
  cryptogramAnswerKeyLines: 1 | 2 | 3;
  /** On solution pages, show only the decoded sentence (no cipher grid). */
  cryptogramSolutionOnlyAnswers: boolean;
  // --- Word Scramble ---
  /** One word (or phrase) per line; blank falls back to a sample list. */
  scrambleWords: string;
  wordsPerPuzzle: number;
  /** Separator drawn after each scrambled word. */
  afterScrambled: ScrambleSeparator;
  /** How the answer blank is drawn on puzzle pages. */
  answerBlankStyle: ScrambleAnswerStyle;
  includeWordBank: boolean;
  wordBankTitle: string;
  // --- Trivia ---
  /**
   * For trivia docs, `numberOfPuzzles` is the total number of questions
   * (page count = ceil(numberOfPuzzles / questionsPerPage)).
   */
  /** How many questions appear on each trivia page. */
  questionsPerPage: number;
  /** How many multiple-choice suggestions each question has. */
  suggestionsPerQuestion: number;
  /** One question per line. */
  questionsText: string;
  /**
   * All suggestions one per line. For N suggestions × Q total questions,
   * submit N×Q lines (grouped in question order).
   */
  suggestionsText: string;
  /** One correct answer per question (suggestion text, A/B/C…, or 1-based index). */
  answersText: string;
  /** Page layout for questions. */
  triviaLayoutFormat: TriviaLayoutFormat;
  /** Empty answer marker shape. */
  triviaCheckboxStyle: TriviaCheckboxStyle;
  /** Suggestion options under each question: 1 or 2 columns. */
  triviaSuggestionsColumns: TriviaSuggestionsColumns;
  /**
   * Trivia solutions: number of side-by-side answer columns (1–4).
   * Total answers per page = solutionsPerPage × triviaSolutionColumns
   * (`solutionsPerPage` is answers per column).
   */
  triviaSolutionColumns: TriviaSolutionColumns;
  // --- Shared (cryptogram + word scramble) ---
  letterCase: GenericLetterCase;
}

export interface GenericPuzzleTypographySettings {
  selectTitleOption: GenericPuzzleTitleOption;
  titleText: string;
  /** One title per line when selectTitleOption === 'custom_per_puzzle'. */
  differentTitles: string;
  puzzleNumberingStyle: GenericPuzzleNumberingStyle;
  puzzleTitleFontFamily: string;
  puzzleTitleFontSize: number;
  answerTitleFontSize: number;
  /** Body/content font family (cryptogram cipher text, scramble list…). */
  puzzleFontFamily: string;
  /** Body/content font size (cryptogram text, scramble list…). */
  puzzleFontSize: number;
  /** Solution body font family. */
  answerFontFamily: string;
  /** Body/content font size on solution pages. */
  answerFontSize: number;
  /** Answer-key table font family (size is fixed at 18pt). */
  answerKeyFontFamily: string;
  /** Distance from page top to title (inches). */
  titleStartAt: number;
  /** Gap between title and puzzle / answer key (inches). */
  spaceBetweenTitleAndPuzzle: number;
  /** Gap between answer-key table and the cryptogram (inches). */
  spaceBetweenAnswerKeyAndPuzzle: number;
  /** Vertical/horizontal gap between wrapped cryptogram word rows (pt). */
  spaceBetweenPuzzleLines: number;
  /** Vertical gap between scramble word rows (pt). */
  scrambleSpaceBetweenWords: number;
  /** Letter spacing for scrambled letters / answer blanks (em). */
  scrambleSpaceBetweenLetters: number;
  /** Vertical gap between puzzles when multiple per page (pt). */
  scrambleSpaceBetweenPuzzles: number;
  /** Trivia puzzle: gap between question blocks (pt). */
  triviaSpaceBetweenQuestions: number;
  /** Trivia puzzle: gap between suggestion rows (pt). */
  triviaSpaceBetweenSuggestions: number;
  /** Trivia puzzle: gap under the question before suggestions (pt). */
  triviaSpaceAfterQuestion: number;
  /** Trivia solutions: gap between question–answer rows (pt). */
  triviaSolutionSpaceBetween: number;
  /** Title alignment on the page / multi-puzzle blocks. */
  puzzleTitleAlign: GenericTitleAlign;
  solutionTitleStyle: GenericSolutionTitleStyle;
  customSolutionTitle: string;
  solutionNumberingStyle: GenericPuzzleNumberingStyle;
  includePageNumbers: boolean;
}

export interface GenericPuzzleColorSettings {
  backgroundColor: string;
  titleColor: string;
  gridColor: string;
  /** Maze solution path stroke color. */
  solutionPathColor: string;
}

export interface GenericPuzzleSettings {
  core: GenericPuzzleCoreSettings;
  typography: GenericPuzzleTypographySettings;
  colors: GenericPuzzleColorSettings;
}

const DEFAULT_MODULE_TITLES: Record<GenericPuzzleModuleType, string> = {
  sudoku: 'Sudoku',
  maze: 'Maze',
  cryptogram: 'Cryptogram',
  'word-scramble': 'Word Scramble',
  trivia: 'Trivia',
};

export function getGenericModuleDefaultTitle(moduleType: GenericPuzzleModuleType): string {
  return DEFAULT_MODULE_TITLES[moduleType] ?? 'Puzzle';
}

export function getDefaultGenericPuzzleSettings(
  moduleType: GenericPuzzleModuleType
): GenericPuzzleSettings {
  return {
    core: {
      numberOfPuzzles: 10,
      puzzlesStartingNumber: 1,
      puzzlesPerPage: 1,
      puzzleGridScale: 100,
      solutionGridScale: 100,
      solutionsPerPage: moduleType === 'sudoku' ? 4 : moduleType === 'trivia' ? 20 : 2,
      autoBalanceGrid: false,
      autoBalanceFont: false,
      sudokuPuzzleMode: 'standard',
      sudokuMixedIncludeStandard: true,
      sudokuMixedIncludeCalcudoku: true,
      calcudokuGridSize: 6,
      calcudokuMix4: true,
      calcudokuMix5: true,
      calcudokuMix6: true,
      calcudokuMix7: false,
      calcudokuMix8: false,
      calcudokuMix9: false,
      calcudokuDifficulty: 'easy',
      calcudokuMixEasy: true,
      calcudokuMixMedium: true,
      calcudokuMixHard: true,
      calcudokuMixExpert: true,
      sudokuSize: 9,
      sudokuMixedSize4: 2,
      sudokuMixedSize6: 0,
      sudokuMixedSize9: 3,
      sudokuMixedSize12: 0,
      sudokuMixedSize16: 3,
      sudokuMixedSize25: 2,
      sudokuDifficulty: 'medium',
      sudokuMixedEasyCount: 2,
      sudokuMixedMediumCount: 3,
      sudokuMixedHardCount: 5,
      showDifficultyLabel: true,
      sudokuDifficultyPlacement: 'bottom',
      sudokuPuzzleLineThickness: 100,
      sudokuSolutionLineThickness: 100,
      mazeSize: 'medium',
      mazeMixedEasyCount: 2,
      mazeMixedMediumCount: 3,
      mazeMixedHardCount: 5,
      mazeMixedShapeSquare: 2,
      mazeMixedShapeCircle: 2,
      mazeMixedShapeDiamond: 1,
      mazeMixedShapeHexagon: 2,
      mazeMixedShapeTriangle: 3,
      mazeShape: 'square',
      mazeWallStyle: 'lines',
      mazeWallThickness: 45,
      mazeStartSide: 'middle',
      mazeEndSide: 'bottom',
      mazeEasyGridLength: MAZE_LEVEL_DEFAULT_GRID.easy.length,
      mazeEasyGridWidth: MAZE_LEVEL_DEFAULT_GRID.easy.width,
      mazeMediumGridLength: MAZE_LEVEL_DEFAULT_GRID.medium.length,
      mazeMediumGridWidth: MAZE_LEVEL_DEFAULT_GRID.medium.width,
      mazeHardGridLength: MAZE_LEVEL_DEFAULT_GRID.hard.length,
      mazeHardGridWidth: MAZE_LEVEL_DEFAULT_GRID.hard.width,
      mazeMarkerStyle: 'arrow',
      mazeStartImage: '',
      mazeEndImage: '',
      mazeSolutionPathStyle: 'solid',
      mazeSolutionPathThickness: 34,
      shapeMazeEnabled: false,
      shapeMaskMode: 'common',
      shapeMaskImage: undefined,
      shapeMaskImages: [],
      shapeMaskAlphaThreshold: 40,
      shapeMaskFit: 'contain',
      shapeMaskShowImage: false,
      shapeMaskImageOpacity: 35,
      cryptogramPhrases: '',
      cipherType: 'letters',
      cryptogramFormat: 'lines',
      showLetterHints: true,
      hintLettersCount: 1,
      cryptogramAnswerKeyLines: 2,
      cryptogramSolutionOnlyAnswers: false,
      scrambleWords: '',
      wordsPerPuzzle: 10,
      afterScrambled: 'equal',
      answerBlankStyle: 'underline',
      includeWordBank: false,
      wordBankTitle: 'Word Bank',
      questionsPerPage: 3,
      suggestionsPerQuestion: 4,
      questionsText: '',
      suggestionsText: '',
      answersText: '',
      triviaLayoutFormat: 'single-column',
      triviaCheckboxStyle: 'circle',
      triviaSuggestionsColumns: 'single',
      triviaSolutionColumns: 3,
      letterCase: 'upper',
    },
    typography: {
      selectTitleOption: 'custom',
      titleText: getGenericModuleDefaultTitle(moduleType),
      differentTitles: '',
      puzzleNumberingStyle: 'prefix',
      puzzleTitleFontFamily: 'Arial',
      puzzleTitleFontSize: 24,
      answerTitleFontSize: 18,
      puzzleFontFamily: 'Arial',
      puzzleFontSize:
        moduleType === 'sudoku'
          ? 18
          : moduleType === 'cryptogram'
            ? 16
            : moduleType === 'trivia'
              ? 14
              : 14,
      answerFontFamily: 'Arial',
      answerFontSize: moduleType === 'sudoku' ? 16 : moduleType === 'cryptogram' ? 16 : 12,
      answerKeyFontFamily: 'Arial',
      titleStartAt: 0.5,
      spaceBetweenTitleAndPuzzle: 0.3,
      spaceBetweenAnswerKeyAndPuzzle: 0.25,
      spaceBetweenPuzzleLines: 10,
      scrambleSpaceBetweenWords: 8,
      scrambleSpaceBetweenLetters: 0.12,
      scrambleSpaceBetweenPuzzles: 18,
      triviaSpaceBetweenQuestions: 18,
      triviaSpaceBetweenSuggestions: 6,
      triviaSpaceAfterQuestion: 8,
      triviaSolutionSpaceBetween: 12,
      puzzleTitleAlign: 'center',
      solutionTitleStyle: 'same_as_puzzle',
      customSolutionTitle: 'Solution',
      solutionNumberingStyle: 'none',
      includePageNumbers: true,
    },
    colors: {
      backgroundColor: '#ffffff',
      titleColor: '#333333',
      gridColor: '#333333',
      solutionPathColor: '#e11d48',
    },
  };
}

const clampInt = (value: unknown, min: number, max: number, fallback: number) => {
  const num = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, num));
};

export function normalizeGenericPuzzleSettings(
  settings: Partial<GenericPuzzleSettings> | undefined,
  moduleType: GenericPuzzleModuleType
): GenericPuzzleSettings {
  const def = getDefaultGenericPuzzleSettings(moduleType);
  const core = { ...def.core, ...settings?.core };
  const typography = { ...def.typography, ...settings?.typography };
  const colors = { ...def.colors, ...settings?.colors };

  core.numberOfPuzzles = clampInt(core.numberOfPuzzles, 1, 600, def.core.numberOfPuzzles);
  core.puzzlesStartingNumber = clampInt(core.puzzlesStartingNumber, 1, 9999, 1);
  core.puzzlesPerPage = clampInt(core.puzzlesPerPage, 1, 4, 1);
  // Word scramble only supports 1 / 2 / 4 puzzles per page.
  if (moduleType === 'word-scramble' && core.puzzlesPerPage === 3) {
    core.puzzlesPerPage = 2;
  }
  core.puzzleGridScale = clampInt(core.puzzleGridScale, 30, 250, 100);
  core.solutionGridScale = clampInt(core.solutionGridScale, 30, 250, 100);
  core.autoBalanceGrid = core.autoBalanceGrid === true;
  core.autoBalanceFont = core.autoBalanceFont === true;
  core.solutionsPerPage =
    moduleType === 'trivia'
      ? clampInt(core.solutionsPerPage, 1, 50, def.core.solutionsPerPage)
      : clampInt(core.solutionsPerPage, 1, 9, def.core.solutionsPerPage);
  core.mazeWallThickness = clampInt(core.mazeWallThickness, 10, 100, 45);
  core.sudokuPuzzleLineThickness = clampInt(core.sudokuPuzzleLineThickness, 25, 250, 100);
  core.sudokuSolutionLineThickness = clampInt(core.sudokuSolutionLineThickness, 25, 250, 100);

  // Migrate legacy showDifficultyLabel → placement when placement missing/invalid.
  if (
    core.sudokuDifficultyPlacement !== 'bottom' &&
    core.sudokuDifficultyPlacement !== 'top' &&
    core.sudokuDifficultyPlacement !== 'in_title' &&
    core.sudokuDifficultyPlacement !== 'none'
  ) {
    core.sudokuDifficultyPlacement = core.showDifficultyLabel === false ? 'none' : 'bottom';
  }
  core.showDifficultyLabel = core.sudokuDifficultyPlacement !== 'none';

  if (!isSudokuPuzzleMode(core.sudokuPuzzleMode)) {
    core.sudokuPuzzleMode = 'standard';
  }
  core.sudokuMixedIncludeStandard = core.sudokuMixedIncludeStandard !== false;
  core.sudokuMixedIncludeCalcudoku = core.sudokuMixedIncludeCalcudoku !== false;
  if (core.calcudokuGridSize !== 'mixed' && !isCalcudokuGridSize(core.calcudokuGridSize)) {
    core.calcudokuGridSize = 6;
  }
  core.calcudokuMix4 = core.calcudokuMix4 !== false;
  core.calcudokuMix5 = core.calcudokuMix5 !== false;
  core.calcudokuMix6 = core.calcudokuMix6 !== false;
  core.calcudokuMix7 = core.calcudokuMix7 === true;
  core.calcudokuMix8 = core.calcudokuMix8 === true;
  core.calcudokuMix9 = core.calcudokuMix9 === true;
  if (!isCalcudokuDifficulty(core.calcudokuDifficulty)) {
    core.calcudokuDifficulty = 'easy';
  }
  core.calcudokuMixEasy = core.calcudokuMixEasy !== false;
  core.calcudokuMixMedium = core.calcudokuMixMedium !== false;
  core.calcudokuMixHard = core.calcudokuMixHard !== false;
  core.calcudokuMixExpert = core.calcudokuMixExpert !== false;
  if (core.calcudokuDifficulty === 'mixed' && selectedCalcudokuMixDifficulties(core).length === 0) {
    core.calcudokuMixEasy = true;
    core.calcudokuMixMedium = true;
    core.calcudokuMixHard = true;
    core.calcudokuMixExpert = true;
  }

  if (core.sudokuSize !== 'mixed' && !isSudokuSize(core.sudokuSize)) {
    core.sudokuSize = 9;
  }
  if (
    core.sudokuDifficulty !== 'mixed' &&
    core.sudokuDifficulty !== 'easy' &&
    core.sudokuDifficulty !== 'medium' &&
    core.sudokuDifficulty !== 'hard'
  ) {
    core.sudokuDifficulty = 'medium';
  }

  const sudokuLevelDefaults = defaultMixedSudokuLevelCounts(core.numberOfPuzzles);
  core.sudokuMixedEasyCount = clampInt(
    core.sudokuMixedEasyCount,
    0,
    600,
    sudokuLevelDefaults.easy
  );
  core.sudokuMixedMediumCount = clampInt(
    core.sudokuMixedMediumCount,
    0,
    600,
    sudokuLevelDefaults.medium
  );
  core.sudokuMixedHardCount = clampInt(
    core.sudokuMixedHardCount,
    0,
    600,
    sudokuLevelDefaults.hard
  );
  if (core.sudokuDifficulty === 'mixed' && core.sudokuPuzzleMode === 'standard') {
    const sum =
      core.sudokuMixedEasyCount + core.sudokuMixedMediumCount + core.sudokuMixedHardCount;
    if (sum > 0) {
      core.numberOfPuzzles = sum;
    } else {
      const reset = defaultMixedSudokuLevelCounts(Math.max(1, core.numberOfPuzzles));
      core.sudokuMixedEasyCount = reset.easy;
      core.sudokuMixedMediumCount = reset.medium;
      core.sudokuMixedHardCount = reset.hard;
      core.numberOfPuzzles = reset.easy + reset.medium + reset.hard;
    }
  }

  const sudokuSizeDefaults = defaultMixedSudokuSizeCounts(core.numberOfPuzzles);
  core.sudokuMixedSize4 = clampInt(core.sudokuMixedSize4, 0, 600, sudokuSizeDefaults[4]);
  core.sudokuMixedSize6 = clampInt(core.sudokuMixedSize6, 0, 600, sudokuSizeDefaults[6]);
  core.sudokuMixedSize9 = clampInt(core.sudokuMixedSize9, 0, 600, sudokuSizeDefaults[9]);
  core.sudokuMixedSize12 = clampInt(core.sudokuMixedSize12, 0, 600, sudokuSizeDefaults[12]);
  core.sudokuMixedSize16 = clampInt(core.sudokuMixedSize16, 0, 600, sudokuSizeDefaults[16]);
  core.sudokuMixedSize25 = clampInt(core.sudokuMixedSize25, 0, 600, sudokuSizeDefaults[25]);
  if (core.sudokuSize === 'mixed' && core.sudokuPuzzleMode === 'standard') {
    const sizeSum = sumMixedSudokuSizeCounts({
      4: core.sudokuMixedSize4,
      6: core.sudokuMixedSize6,
      9: core.sudokuMixedSize9,
      12: core.sudokuMixedSize12,
      16: core.sudokuMixedSize16,
      25: core.sudokuMixedSize25,
    });
    if (core.sudokuDifficulty === 'mixed') {
      // Keep totals aligned with difficulty-driven puzzle count.
      if (sizeSum !== core.numberOfPuzzles) {
        const reset = defaultMixedSudokuSizeCounts(core.numberOfPuzzles);
        core.sudokuMixedSize4 = reset[4];
        core.sudokuMixedSize6 = reset[6];
        core.sudokuMixedSize9 = reset[9];
        core.sudokuMixedSize12 = reset[12];
        core.sudokuMixedSize16 = reset[16];
        core.sudokuMixedSize25 = reset[25];
      }
    } else if (sizeSum > 0) {
      core.numberOfPuzzles = sizeSum;
    } else {
      const reset = defaultMixedSudokuSizeCounts(Math.max(1, core.numberOfPuzzles));
      core.sudokuMixedSize4 = reset[4];
      core.sudokuMixedSize6 = reset[6];
      core.sudokuMixedSize9 = reset[9];
      core.sudokuMixedSize12 = reset[12];
      core.sudokuMixedSize16 = reset[16];
      core.sudokuMixedSize25 = reset[25];
      core.numberOfPuzzles = sumMixedSudokuSizeCounts(reset);
    }
  }

  // Always thin lines — migrate any saved "blocks" setting.
  core.mazeWallStyle = 'lines';
  if (
    core.mazeSize !== 'mixed' &&
    core.mazeSize !== 'small' &&
    core.mazeSize !== 'medium' &&
    core.mazeSize !== 'large' &&
    core.mazeSize !== 'xl'
  ) {
    core.mazeSize = 'medium';
  }
  const mixedDefaults = defaultMixedMazeLevelCounts(core.numberOfPuzzles);
  core.mazeMixedEasyCount = clampInt(
    core.mazeMixedEasyCount,
    0,
    600,
    mixedDefaults.easy
  );
  core.mazeMixedMediumCount = clampInt(
    core.mazeMixedMediumCount,
    0,
    600,
    mixedDefaults.medium
  );
  core.mazeMixedHardCount = clampInt(
    core.mazeMixedHardCount,
    0,
    600,
    mixedDefaults.hard
  );
  if (core.mazeSize === 'mixed') {
    const sum =
      core.mazeMixedEasyCount + core.mazeMixedMediumCount + core.mazeMixedHardCount;
    if (sum > 0) {
      core.numberOfPuzzles = sum;
    } else {
      const reset = defaultMixedMazeLevelCounts(Math.max(1, core.numberOfPuzzles));
      core.mazeMixedEasyCount = reset.easy;
      core.mazeMixedMediumCount = reset.medium;
      core.mazeMixedHardCount = reset.hard;
      core.numberOfPuzzles = reset.easy + reset.medium + reset.hard;
    }
  }
  const shapeDefaults = defaultMixedMazeShapeCounts(core.numberOfPuzzles);
  core.mazeMixedShapeSquare = clampInt(
    core.mazeMixedShapeSquare,
    0,
    600,
    shapeDefaults.square
  );
  core.mazeMixedShapeCircle = clampInt(
    core.mazeMixedShapeCircle,
    0,
    600,
    shapeDefaults.circle
  );
  core.mazeMixedShapeDiamond = clampInt(
    core.mazeMixedShapeDiamond,
    0,
    600,
    shapeDefaults.diamond
  );
  core.mazeMixedShapeHexagon = clampInt(
    core.mazeMixedShapeHexagon,
    0,
    600,
    shapeDefaults.hexagon
  );
  core.mazeMixedShapeTriangle = clampInt(
    core.mazeMixedShapeTriangle,
    0,
    600,
    shapeDefaults.triangle
  );
  if (core.mazeShape === 'mixed' && core.mazeSize !== 'mixed') {
    const shapeSum = sumMixedMazeShapeCounts({
      square: core.mazeMixedShapeSquare,
      circle: core.mazeMixedShapeCircle,
      diamond: core.mazeMixedShapeDiamond,
      hexagon: core.mazeMixedShapeHexagon,
      triangle: core.mazeMixedShapeTriangle,
    });
    if (shapeSum > 0) {
      core.numberOfPuzzles = shapeSum;
    } else {
      const reset = defaultMixedMazeShapeCounts(Math.max(1, core.numberOfPuzzles));
      core.mazeMixedShapeSquare = reset.square;
      core.mazeMixedShapeCircle = reset.circle;
      core.mazeMixedShapeDiamond = reset.diamond;
      core.mazeMixedShapeHexagon = reset.hexagon;
      core.mazeMixedShapeTriangle = reset.triangle;
      core.numberOfPuzzles = sumMixedMazeShapeCounts(reset);
    }
  }
  if (
    core.mazeShape !== 'mixed' &&
    core.mazeShape !== 'square' &&
    core.mazeShape !== 'circle' &&
    core.mazeShape !== 'triangle' &&
    core.mazeShape !== 'diamond' &&
    core.mazeShape !== 'hexagon'
  ) {
    core.mazeShape = 'square';
  }
  if (
    core.mazeStartSide !== 'left' &&
    core.mazeStartSide !== 'middle' &&
    core.mazeStartSide !== 'right' &&
    core.mazeStartSide !== 'mixed'
  ) {
    core.mazeStartSide = 'middle';
  }
  if (
    core.mazeEndSide !== 'bottom' &&
    core.mazeEndSide !== 'middle' &&
    core.mazeEndSide !== 'left' &&
    core.mazeEndSide !== 'right' &&
    core.mazeEndSide !== 'mixed'
  ) {
    core.mazeEndSide = 'bottom';
  }
  // Migrate legacy square N×N fields → length × width.
  {
    const raw = settings?.core as
      | (Partial<GenericPuzzleCoreSettings> & {
          mazeEasyGridSize?: number;
          mazeMediumGridSize?: number;
          mazeHardGridSize?: number;
        })
      | undefined;
    const migratePair = (
      lengthKey: 'mazeEasyGridLength' | 'mazeMediumGridLength' | 'mazeHardGridLength',
      widthKey: 'mazeEasyGridWidth' | 'mazeMediumGridWidth' | 'mazeHardGridWidth',
      legacyKey: 'mazeEasyGridSize' | 'mazeMediumGridSize' | 'mazeHardGridSize',
      fallback: number
    ) => {
      const legacy = raw?.[legacyKey];
      const hasNew =
        raw?.[lengthKey] != null || raw?.[widthKey] != null;
      if (!hasNew && typeof legacy === 'number' && Number.isFinite(legacy)) {
        core[lengthKey] = legacy;
        core[widthKey] = legacy;
      }
      core[lengthKey] = clampInt(core[lengthKey], 5, 40, fallback);
      core[widthKey] = clampInt(core[widthKey], 5, 40, fallback);
    };
    migratePair(
      'mazeEasyGridLength',
      'mazeEasyGridWidth',
      'mazeEasyGridSize',
      MAZE_LEVEL_DEFAULT_GRID.easy.length
    );
    migratePair(
      'mazeMediumGridLength',
      'mazeMediumGridWidth',
      'mazeMediumGridSize',
      MAZE_LEVEL_DEFAULT_GRID.medium.length
    );
    migratePair(
      'mazeHardGridLength',
      'mazeHardGridWidth',
      'mazeHardGridSize',
      MAZE_LEVEL_DEFAULT_GRID.hard.length
    );
  }
  if (
    core.mazeMarkerStyle !== 'point' &&
    core.mazeMarkerStyle !== 'arrow' &&
    core.mazeMarkerStyle !== 'image'
  ) {
    core.mazeMarkerStyle = 'arrow';
  }
  if (typeof core.mazeStartImage !== 'string') core.mazeStartImage = '';
  if (typeof core.mazeEndImage !== 'string') core.mazeEndImage = '';
  if (
    core.mazeSolutionPathStyle !== 'solid' &&
    core.mazeSolutionPathStyle !== 'dashed' &&
    core.mazeSolutionPathStyle !== 'dotted'
  ) {
    core.mazeSolutionPathStyle = 'solid';
  }
  core.mazeSolutionPathThickness = clampInt(core.mazeSolutionPathThickness, 5, 100, 34);
  // Drop legacy showMazeSolutionPath if present on older snapshots.
  delete (core as { showMazeSolutionPath?: boolean }).showMazeSolutionPath;
  core.hintLettersCount = clampInt(core.hintLettersCount, 0, 25, 1);
  const keyLines = clampInt(core.cryptogramAnswerKeyLines, 1, 3, 2);
  core.cryptogramAnswerKeyLines = (keyLines === 1 || keyLines === 3 ? keyLines : 2) as 1 | 2 | 3;
  core.wordsPerPuzzle = clampInt(core.wordsPerPuzzle, 1, 50, 10);
  core.questionsPerPage = clampInt(core.questionsPerPage, 1, 20, 3);
  core.suggestionsPerQuestion = clampInt(core.suggestionsPerQuestion, 2, 8, 4);
  if (typeof core.questionsText !== 'string') core.questionsText = '';
  if (typeof core.suggestionsText !== 'string') core.suggestionsText = '';
  if (typeof core.answersText !== 'string') core.answersText = '';
  if (
    core.triviaLayoutFormat !== 'single-column' &&
    core.triviaLayoutFormat !== 'two-column' &&
    core.triviaLayoutFormat !== 'compact'
  ) {
    core.triviaLayoutFormat = 'single-column';
  }
  if (core.triviaCheckboxStyle !== 'circle' && core.triviaCheckboxStyle !== 'square') {
    core.triviaCheckboxStyle = 'circle';
  }
  if (core.triviaSuggestionsColumns !== 'single' && core.triviaSuggestionsColumns !== 'two') {
    core.triviaSuggestionsColumns = 'single';
  }
  {
    const cols = Math.round(Number(core.triviaSolutionColumns));
    core.triviaSolutionColumns = (
      cols === 1 || cols === 2 || cols === 3 || cols === 4 ? cols : 3
    ) as TriviaSolutionColumns;
  }
  if (moduleType === 'trivia') {
    core.puzzlesPerPage = 1;
  }
  if (
    core.answerBlankStyle !== 'dash' &&
    core.answerBlankStyle !== 'underline' &&
    core.answerBlankStyle !== 'blank' &&
    core.answerBlankStyle !== 'boxes'
  ) {
    core.answerBlankStyle = 'underline';
  }
  typography.puzzleTitleFontSize = clampInt(typography.puzzleTitleFontSize, 1, 72, 24);
  typography.answerTitleFontSize = clampInt(typography.answerTitleFontSize, 1, 72, 18);
  typography.puzzleFontSize = clampInt(typography.puzzleFontSize, 1, 72, 14);
  typography.answerFontSize = clampInt(typography.answerFontSize, 1, 72, 12);
  const titleStart =
    typeof typography.titleStartAt === 'number' && Number.isFinite(typography.titleStartAt)
      ? typography.titleStartAt
      : def.typography.titleStartAt;
  typography.titleStartAt = Math.max(0, Math.min(3, titleStart));
  typography.spaceBetweenPuzzleLines = clampInt(
    typography.spaceBetweenPuzzleLines,
    0,
    72,
    10
  );
  typography.scrambleSpaceBetweenWords = clampInt(
    typography.scrambleSpaceBetweenWords,
    0,
    48,
    def.typography.scrambleSpaceBetweenWords
  );
  const letterSpace =
    typeof typography.scrambleSpaceBetweenLetters === 'number' &&
    Number.isFinite(typography.scrambleSpaceBetweenLetters)
      ? typography.scrambleSpaceBetweenLetters
      : def.typography.scrambleSpaceBetweenLetters;
  typography.scrambleSpaceBetweenLetters = Math.max(0, Math.min(0.6, letterSpace));
  typography.scrambleSpaceBetweenPuzzles = clampInt(
    typography.scrambleSpaceBetweenPuzzles,
    0,
    72,
    def.typography.scrambleSpaceBetweenPuzzles
  );
  typography.triviaSpaceBetweenQuestions = clampInt(
    typography.triviaSpaceBetweenQuestions,
    0,
    72,
    def.typography.triviaSpaceBetweenQuestions
  );
  typography.triviaSpaceBetweenSuggestions = clampInt(
    typography.triviaSpaceBetweenSuggestions,
    0,
    48,
    def.typography.triviaSpaceBetweenSuggestions
  );
  typography.triviaSpaceAfterQuestion = clampInt(
    typography.triviaSpaceAfterQuestion,
    0,
    48,
    def.typography.triviaSpaceAfterQuestion
  );
  typography.triviaSolutionSpaceBetween = clampInt(
    typography.triviaSolutionSpaceBetween,
    0,
    72,
    def.typography.triviaSolutionSpaceBetween
  );
  if (typography.puzzleTitleAlign !== 'left' && typography.puzzleTitleAlign !== 'center') {
    typography.puzzleTitleAlign = 'center';
  }
  // Drop legacy scramble↔blank gap if present on older snapshots.
  delete (typography as { scrambleSpaceBetweenScrambleAndBlank?: number })
    .scrambleSpaceBetweenScrambleAndBlank;
  if (typeof typography.puzzleFontFamily !== 'string' || !typography.puzzleFontFamily.trim()) {
    typography.puzzleFontFamily = 'Arial';
  }
  if (typeof typography.answerFontFamily !== 'string' || !typography.answerFontFamily.trim()) {
    typography.answerFontFamily = 'Arial';
  }
  if (typeof typography.answerKeyFontFamily !== 'string' || !typography.answerKeyFontFamily.trim()) {
    typography.answerKeyFontFamily = 'Arial';
  }
  const titleGap =
    typeof typography.spaceBetweenTitleAndPuzzle === 'number' &&
    Number.isFinite(typography.spaceBetweenTitleAndPuzzle)
      ? typography.spaceBetweenTitleAndPuzzle
      : 0.3;
  typography.spaceBetweenTitleAndPuzzle = Math.max(0, Math.min(3, titleGap));
  const keyGap =
    typeof typography.spaceBetweenAnswerKeyAndPuzzle === 'number' &&
    Number.isFinite(typography.spaceBetweenAnswerKeyAndPuzzle)
      ? typography.spaceBetweenAnswerKeyAndPuzzle
      : 0.25;
  typography.spaceBetweenAnswerKeyAndPuzzle = Math.max(0, Math.min(3, keyGap));
  if (typeof core.cryptogramSolutionOnlyAnswers !== 'boolean') {
    core.cryptogramSolutionOnlyAnswers = false;
  }

  return { core, typography, colors };
}

function applyNumbering(
  base: string,
  style: GenericPuzzleNumberingStyle,
  num: number
): string {
  if (style === 'prefix') return `${num}. ${base}`;
  if (style === 'suffix') return `${base} ${num}`;
  return base;
}

/** Title without numbering + optional number badge text (for Header Assembly). */
export function resolveGenericPuzzleTitleParts(options: {
  typography: GenericPuzzleTypographySettings;
  puzzleIndex: number;
  puzzlesStartingNumber: number;
  fallback: string;
  difficulty?: Difficulty | string | null;
  difficultyPlacement?: SudokuDifficultyPlacement;
}): { titleText: string; numberText: string; showNumber: boolean; combined: string } {
  const {
    typography,
    puzzleIndex,
    puzzlesStartingNumber,
    fallback,
    difficulty,
    difficultyPlacement,
  } = options;
  let base = typography.titleText?.trim() || fallback;
  if (typography.selectTitleOption === 'custom_per_puzzle') {
    const lines = (typography.differentTitles || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length > 0) base = lines[puzzleIndex % lines.length];
  }
  if (difficultyPlacement === 'in_title' && difficulty) {
    const label = String(difficulty).charAt(0).toUpperCase() + String(difficulty).slice(1);
    if (!new RegExp(`\\b${label}\\b`, 'i').test(base)) {
      base = `${label} ${base}`;
    }
  }
  const num = puzzlesStartingNumber + puzzleIndex;
  const style = typography.puzzleNumberingStyle;
  const numberText =
    style === 'prefix' ? String(num) : style === 'suffix' ? `#${num}` : '';
  return {
    titleText: base,
    numberText,
    showNumber: numberText.length > 0,
    combined: applyNumbering(base, style, num),
  };
}

export function resolveGenericPuzzleTitle(options: {
  typography: GenericPuzzleTypographySettings;
  puzzleIndex: number;
  puzzlesStartingNumber: number;
  fallback: string;
  /** When set with placement `in_title`, prefixes the difficulty (e.g. "Easy Sudoku"). */
  difficulty?: Difficulty | string | null;
  difficultyPlacement?: SudokuDifficultyPlacement;
}): string {
  return resolveGenericPuzzleTitleParts(options).combined;
}

export function resolveGenericSolutionTitle(options: {
  typography: GenericPuzzleTypographySettings;
  puzzleTitle: string;
  puzzleIndex: number;
  puzzlesStartingNumber: number;
}): string {
  const { typography, puzzleTitle, puzzleIndex, puzzlesStartingNumber } = options;
  if (typography.solutionTitleStyle === 'same_as_puzzle') return puzzleTitle;
  const base = typography.customSolutionTitle?.trim() || 'Solution';
  return applyNumbering(
    base,
    typography.solutionNumberingStyle,
    puzzlesStartingNumber + puzzleIndex
  );
}

/** Merge a per-page override onto the document's generic puzzle settings. */
export function mergeGenericPuzzlePageOverride(
  base: GenericPuzzleSettings,
  override: Partial<GenericPuzzleSettings> | undefined
): GenericPuzzleSettings {
  if (!override) return base;
  return {
    core: { ...base.core, ...override.core },
    typography: { ...base.typography, ...override.typography },
    colors: { ...base.colors, ...override.colors },
  };
}
