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
import {
  defaultMazeStartEndImages,
  normalizeMazeStartEndImages,
  type MazeStartEndImagesSettings,
} from './maze-start-end-images';

export type { MazeStartEndImagesSettings };

export type GenericPuzzleModuleType =
  | 'sudoku'
  | 'maze'
  | 'cryptogram'
  | 'word-scramble'
  | 'trivia'
  | 'codewords'
  | 'binairo'
  | 'kakuro'
  | 'math-maze'
  | 'word-fill'
  | 'number-fill'
  | 'snake';

export function isGenericPuzzleModuleType(type: string): type is GenericPuzzleModuleType {
  return (
    type === 'sudoku' ||
    type === 'maze' ||
    type === 'cryptogram' ||
    type === 'word-scramble' ||
    type === 'trivia' ||
    type === 'codewords' ||
    type === 'binairo' ||
    type === 'kakuro' ||
    type === 'math-maze' ||
    type === 'word-fill' ||
    type === 'number-fill' ||
    type === 'snake'
  );
}

/** Word Fill-In and Number Fill-In share one grid engine; this tells them apart. */
export function isFillModuleType(type: string): type is 'word-fill' | 'number-fill' {
  return type === 'word-fill' || type === 'number-fill';
}

/**
 * Projects saved before the split stored a single `fill` module whose mode
 * lived in `core.fillMode`. Map it to the dedicated module id.
 */
export function migrateLegacyModuleType(
  type: string,
  core?: Partial<Pick<GenericPuzzleCoreSettings, 'fillMode'>> | null
): string {
  if (type === 'fill') return core?.fillMode === 'number' ? 'number-fill' : 'word-fill';
  return type;
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
export type SudokuPuzzleMode = 'standard' | 'calcudoku' | 'x' | 'greater-than' | 'mixed';
/** Per-batch Sudoku family used in type plans (not Calcudoku cages). */
export type SudokuLatinKind = 'standard' | 'x' | 'greater-than';
/** How Sudoku X marks the two main diagonals. */
export type SudokuXMarkStyle = 'boxes' | 'lines';

export function isSudokuXMarkStyle(value: unknown): value is SudokuXMarkStyle {
  return value === 'boxes' || value === 'lines';
}
export type CalcudokuGridSize = 4 | 5 | 6 | 7 | 8 | 9;
export type CalcudokuGridSizeMode = CalcudokuGridSize | 'mixed';
export type CalcudokuDifficultyMode = 'easy' | 'medium' | 'hard' | 'expert' | 'mixed';

export const CALCUDOKU_GRID_SIZES: CalcudokuGridSize[] = [4, 5, 6, 7, 8, 9];

export function isSudokuPuzzleMode(value: unknown): value is SudokuPuzzleMode {
  return (
    value === 'standard' ||
    value === 'calcudoku' ||
    value === 'x' ||
    value === 'greater-than' ||
    value === 'mixed'
  );
}

export function sudokuModeUsesLatinSettings(core: {
  sudokuPuzzleMode?: SudokuPuzzleMode;
  sudokuMixedIncludeStandard?: boolean;
  sudokuMixedIncludeX?: boolean;
  sudokuMixedIncludeGreaterThan?: boolean;
}): boolean {
  const mode = isSudokuPuzzleMode(core.sudokuPuzzleMode) ? core.sudokuPuzzleMode : 'standard';
  if (mode === 'standard' || mode === 'x' || mode === 'greater-than') return true;
  if (mode === 'mixed') {
    return (
      core.sudokuMixedIncludeStandard !== false ||
      core.sudokuMixedIncludeX === true ||
      core.sudokuMixedIncludeGreaterThan === true
    );
  }
  return false;
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
  const includeX = core.sudokuMixedIncludeX === true;
  const includeGreaterThan = core.sudokuMixedIncludeGreaterThan === true;
  const includeCalcudoku = core.sudokuMixedIncludeCalcudoku !== false;
  if (
    mode === 'mixed' &&
    !includeStandard &&
    !includeX &&
    !includeGreaterThan &&
    !includeCalcudoku
  ) {
    return 'Select at least one puzzle type to mix (Standard, Sudoku X, Greater Than, and/or Calcudoku).';
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
export type GenericTitleAlign = 'left' | 'center' | 'right';
export type TriviaLayoutFormat = 'single-column' | 'two-column' | 'compact';
export type TriviaCheckboxStyle = 'circle' | 'square';
/** How answer suggestions are arranged under each question. */
export type TriviaSuggestionsColumns = 'single' | 'two';
/** How many answer columns on trivia solution pages (each column is # | Answer). */
export type TriviaSolutionColumns = 1 | 2 | 3 | 4;
export type CodewordDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard';
export type CodewordHintPlacement = 'all-occurrences' | 'single-occurrence';
export type CodewordGridSizeMode = 11 | 13 | 15 | 17 | 19 | 21 | 'custom';
export type BinairoDifficulty = 'easy' | 'medium' | 'hard';
export type BinairoSymbols = '01' | 'xo';
export type BinairoGridSize = 4 | 6 | 8 | 10 | 12 | 14;
export type { KakuroDifficulty, KakuroPattern, KakuroGridSize } from './puzzles/kakuro';

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
   * Standard Sudoku, Sudoku X, Greater Than, Calcudoku, or a mix of types.
   * Older projects omit this field and are treated as `standard`.
   */
  sudokuPuzzleMode: SudokuPuzzleMode;
  /** When sudokuPuzzleMode === 'mixed': include Standard Sudoku. */
  sudokuMixedIncludeStandard: boolean;
  /** When sudokuPuzzleMode === 'mixed': include Sudoku X (diagonals). */
  sudokuMixedIncludeX: boolean;
  /** When sudokuPuzzleMode === 'mixed': include Greater Than Sudoku. */
  sudokuMixedIncludeGreaterThan: boolean;
  /**
   * Greater Than: when true, include a few prefilled digits (hybrid).
   * Default false = traditional inequality-only (no givens).
   */
  sudokuGreaterThanHybrid: boolean;
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
  /**
   * Sudoku X diagonal mark: shaded diagonal cells (`boxes`) or crossing lines (`lines`).
   * Older projects omit this and default to `boxes`.
   */
  sudokuXMarkStyle: SudokuXMarkStyle;
  /** Diagonal line thickness when sudokuXMarkStyle === 'lines' (percent of default). */
  sudokuXLineThickness: number;
  /** Diagonal line transparency 0–100 (0 = solid) when mark style is lines. */
  sudokuXLineTransparency: number;
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
  /** Per-maze start and end illustrations extracted from reference sheets. */
  mazeStartEndImages: MazeStartEndImagesSettings;
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
  * For trivia docs, `numberOfPuzzles` is the total number of themes/puzzles.
   */
  /** How many questions belong to each trivia puzzle/theme. */
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
  // --- Codewords ---
  /** Language code for dictionary (en first). */
  codewordsLanguage: string;
  /** Square grid size preset, or custom. */
  codewordsGridSize: CodewordGridSizeMode;
  /** Custom N when codewordsGridSize === 'custom' (11–21 odd preferred). */
  codewordsCustomSize: number;
  codewordsDifficulty: CodewordDifficulty;
  /** Distinct hint letters; overrides difficulty default when set by user. */
  codewordsHintCount: number;
  /** Whether the user explicitly set hint count (skip difficulty default). */
  codewordsHintCountManual: boolean;
  codewordsHintPlacement: CodewordHintPlacement;
  showCodewordsCodeBox: boolean;
  codewordsBlockedCellColor: string;
  codewordsPlayableCellColor: string;
  codewordsGridLineColor: string;
  codewordsGridStrokeWidth: number;
  codewordsNumberColor: string;
  codewordsLetterColor: string;
  /** Generation seed (persisted for reproducibility). */
  codewordsSeed: number;
  // --- Binairo ---
  binairoGridSize: BinairoGridSize;
  binairoDifficulty: BinairoDifficulty;
  binairoSymbols: BinairoSymbols;
  binairoGridLineColor: string;
  binairoGridStrokeWidth: number;
  binairoSymbolColor: string;
  binairoSeed: number;
  // --- Kakuro ---
  kakuroGridSize: import('./puzzles/kakuro').KakuroGridSize;
  kakuroDifficulty: import('./puzzles/kakuro').KakuroDifficulty;
  kakuroPattern: import('./puzzles/kakuro').KakuroPattern;
  kakuroGridLineColor: string;
  /** @deprecated Ignored — outer edges use grid line color. Kept for saved projects. */
  kakuroOuterBorderColor?: string;
  kakuroBlockFill: string;
  kakuroClueCellFill: string;
  kakuroPlayableFill: string;
  kakuroClueTextColor: string;
  kakuroDigitColor: string;
  /** Primary line thickness for cell borders, perimeter, and clue diagonals (pt). */
  kakuroGridLineWidth: number;
  /** @deprecated Prefer kakuroGridLineWidth. */
  kakuroInnerLineWidth?: number;
  /** @deprecated Unused — perimeter uses kakuroGridLineWidth. */
  kakuroOuterBorderWidth?: number;
  /** @deprecated Unused — diagonals use kakuroGridLineWidth. */
  kakuroDiagonalWidth?: number;
  kakuroCluePadding: number;
  kakuroCellPadding: number;
  kakuroSeed: number;
  // --- Math Maze ---
  mathMazeEquationsAcross: number;
  mathMazeEquationsDown: number;
  mathMazeMaxDigits: number;
  mathMazeMaxDividendDigits: number;
  mathMazeMaxDivisorDigits: number;
  mathMazeMaxAnswerDigits: number;
  mathMazeNumbersPerEquation: 2 | 3 | 4;
  mathMazeOpAdd: boolean;
  mathMazeOpSub: boolean;
  mathMazeOpMul: boolean;
  mathMazeOpDiv: boolean;
  mathMazeAllowNegative: boolean;
  mathMazeUseParentheses: boolean;
  mathMazeParenthesesMode: 'all' | 'random';
  mathMazeStartText: string;
  mathMazeEndText: string;
  mathMazeCornerRoundingPercent: number;
  mathMazeChannelSizePercent: number;
  mathMazeSolutionPathColor: string;
  /** Fill color for equation boxes on the solution route. */
  mathMazeSolutionCellFill: string;
  mathMazeSeed: number;
  // --- Fill (word/number) ---
  fillMode: 'word' | 'number';
  fillGridWidth: number;
  fillGridHeight: number;
  fillWordsPerPuzzle: number;
  /** Like crossword exactClueCount — keep retrying until all words place (slow). Default off. */
  fillExactWordCount: boolean;
  fillLettersToShow: number;
  fillIncludeStarterWord: boolean;
  fillDigitCount2: number;
  fillDigitCount3: number;
  fillDigitCount4: number;
  fillDigitCount5: number;
  fillDigitCount6: number;
  fillDigitCount7: number;
  fillDigitCount8: number;
  fillDigitCount9: number;
  fillGridLineWidth: number;
  fillGridLineColor: string;
  fillBlockFill: string;
  fillPlayableFill: string;
  fillSeed: number;
  fillWordsText: string;
  // --- Snake (word/number) ---
  snakeMode: 'word' | 'number';
  snakeGridWidth: number;
  snakeGridHeight: number;
  snakeWordsPerPuzzle: number;
  snakeAllowNumbersInGrid: boolean;
  snakeNoBoxAroundPuzzle: boolean;
  snakeAddGridLines: boolean;
  snakeIncludeFiller: string;
  snakeExcludeFiller: string;
  snakeDigitCount2: number;
  snakeDigitCount3: number;
  snakeDigitCount4: number;
  snakeDigitCount5: number;
  snakeDigitCount6: number;
  snakeDigitCount7: number;
  snakeDigitCount8: number;
  snakeDigitCount9: number;
  snakeGridLineWidth: number;
  snakeGridLineColor: string;
  snakeSolutionPathColor: string;
  snakeNonPathColor: string;
  /** Solution path highlight thickness as a percent of cell size (5–80). */
  snakeSolutionPathThickness: number;
  /** Solution path highlight opacity 0–100 (100 = opaque). */
  snakeSolutionPathOpacity: number;
  snakeSeed: number;
  snakeWordsText: string;
  /** Word list columns (1–4), same control as Word Search. */
  snakeWordListColumns: number;
  /** Horizontal gap between word-list columns (Word Search Space Horizontal). */
  snakeWordSpacingHorizontal: number;
  /** Vertical gap between word-list rows (Word Search Space Vertical). */
  snakeWordSpacingVertical: number;
  // --- Shared (cryptogram + word scramble + codewords) ---
  letterCase: GenericLetterCase;
}

export interface GenericPuzzleTypographySettings {
  selectTitleOption: GenericPuzzleTitleOption;
  titleText: string;
  /** Trivia puzzle-page subtitle / fun facts, one line per puzzle. */
  includeFunFacts: boolean;
  funFactsText: string;
  /** One title per line when selectTitleOption === 'custom_per_puzzle'. */
  differentTitles: string;
  puzzleNumberingStyle: GenericPuzzleNumberingStyle;
  puzzleTitleFontFamily: string;
  puzzleTitleFontSize: number;
  puzzleTitleItalic?: boolean;
  /** Puzzle page title weight (default bold). */
  puzzleTitleBold?: boolean;
  titleTextEffect?: import('./text-effects').TextEffectStyle;
  puzzleTextEffect?: import('./text-effects').TextEffectStyle;
  /** Solution page title font family (canvas format bar on Solutions). */
  answerTitleFontFamily: string;
  answerTitleFontSize: number;
  /** Solution page title alignment. */
  answerTitleAlign?: GenericTitleAlign;
  /** Body/content font family (cryptogram cipher text, scramble list…). */
  puzzleFontFamily: string;
  /** Body/content font size (cryptogram text, scramble list…). */
  puzzleFontSize: number;
  puzzleBold?: boolean;
  puzzleItalic?: boolean;
  /** Solution body font family. */
  answerFontFamily: string;
  /** Body/content font size on solution pages. */
  answerFontSize: number;
  /** Cryptogram alphabet answer-key table font family. */
  answerKeyFontFamily: string;
  /** Cryptogram alphabet answer-key font size (pt). */
  answerKeyFontSize: number;
  answerKeyBold?: boolean;
  answerKeyItalic?: boolean;
  /** Codewords: code-number font (grid + alphabet box). */
  codewordsNumberFontFamily?: string;
  codewordsNumberFontSize?: number;
  codewordsNumberBold?: boolean;
  codewordsNumberItalic?: boolean;
  /** Codewords: letter font (hints / solutions / alphabet box). */
  codewordsLetterFontFamily?: string;
  codewordsLetterFontSize?: number;
  codewordsLetterBold?: boolean;
  codewordsLetterItalic?: boolean;
  /** Kakuro: clue triangle font (grid). */
  kakuroClueFontFamily?: string;
  kakuroClueFontSize?: number;
  kakuroClueBold?: boolean;
  /** Math Maze typography */
  mathMazeEquationFontFamily?: string;
  mathMazeChannelFontFamily?: string;
  mathMazeStartEndFontFamily?: string;
  mathMazeStartFontSize?: number;
  mathMazeEndFontSize?: number;
  mathMazeAnswerStartFontSize?: number;
  mathMazeAnswerEndFontSize?: number;
  mathMazeEquationFontSize?: number;
  mathMazeChannelFontSize?: number;
  mathMazeAnswerEquationFontSize?: number;
  mathMazeAnswerChannelFontSize?: number;
  /** Fill-In / Word Snake: word (number) list under the grid; edited via the shared text bar. */
  wordListFontFamily?: string;
  wordListFontSize?: number;
  wordListBold?: boolean;
  wordListItalic?: boolean;
  /** Gap between solution grids on multi-solution pages (px). */
  solutionToSolutionGapPx?: number;
  /** Trivia suggestion / multiple-choice option font family. */
  suggestionFontFamily?: string;
  /** Trivia suggestion / multiple-choice option font size (pt). */
  suggestionFontSize?: number;
  suggestionTextEffect?: import('./text-effects').TextEffectStyle;
  suggestionItalic?: boolean;
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
  /** Trivia solutions: horizontal gap between answer columns (pt). */
  triviaSolutionColumnSpaceBetween: number;
  /** Title alignment on the page / multi-puzzle blocks. */
  puzzleTitleAlign: GenericTitleAlign;
  /**
   * Free placement deltas (pt) for native canvas elements (title / grid / clues).
   * Applied in generic page layout so preview / PDF / PPTX stay matching.
   */
  canvasLayoutOffsets?: import('./canvas-element-position').CanvasLayoutOffsets;
  solutionTitleStyle: GenericSolutionTitleStyle;
  customSolutionTitle: string;
  solutionNumberingStyle: GenericPuzzleNumberingStyle;
  includePageNumbers: boolean;
}

export interface GenericPuzzleColorSettings {
  backgroundColor: string;
  titleColor: string;
  /** Solution page title color (falls back to titleColor). */
  answerTitleColor?: string;
  gridColor: string;
  /** Fill-In / Word Snake word list text color (defaults to grid color). */
  wordListColor?: string;
  /** Maze solution path stroke color. */
  solutionPathColor: string;
  /** Sudoku X diagonal cell fill when mark style is boxes. */
  sudokuXBoxColor: string;
  /** Sudoku X diagonal line stroke when mark style is lines. */
  sudokuXLineColor: string;
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
  codewords: 'Puzzle',
  binairo: 'Binairo',
  kakuro: 'Kakuro',
  'math-maze': 'Math Maze',
  'word-fill': 'Word Fill-In',
  'number-fill': 'Number Fill-In',
  snake: 'Word Snake',
};

export function getGenericModuleDefaultTitle(moduleType: GenericPuzzleModuleType): string {
  return DEFAULT_MODULE_TITLES[moduleType] ?? 'Puzzle';
}

export function getDefaultGenericPuzzleSettings(
  moduleType: GenericPuzzleModuleType
): GenericPuzzleSettings {
  return {
    core: {
      numberOfPuzzles:
        moduleType === 'codewords' ||
        moduleType === 'binairo' ||
        moduleType === 'kakuro' ||
        moduleType === 'math-maze' ||
        moduleType === 'word-fill' ||
        moduleType === 'number-fill' ||
        moduleType === 'snake'
          ? 80
          : 10,
      puzzlesStartingNumber: 1,
      puzzlesPerPage: 1,
      puzzleGridScale: 100,
      solutionGridScale: 100,
      solutionsPerPage:
        moduleType === 'sudoku' ||
        moduleType === 'codewords' ||
        moduleType === 'binairo' ||
        moduleType === 'kakuro' ||
        moduleType === 'math-maze' ||
        moduleType === 'word-fill' ||
        moduleType === 'number-fill' ||
        moduleType === 'snake'
          ? 4
          : moduleType === 'trivia'
            ? 20
            : 2,
      autoBalanceGrid: false,
      autoBalanceFont: false,
      sudokuPuzzleMode: 'standard',
      sudokuMixedIncludeStandard: true,
      sudokuMixedIncludeX: false,
      sudokuMixedIncludeGreaterThan: false,
      sudokuGreaterThanHybrid: false,
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
      sudokuXMarkStyle: 'boxes',
      sudokuXLineThickness: 100,
      sudokuXLineTransparency: 35,
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
      mazeStartEndImages: defaultMazeStartEndImages(),
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
      codewordsLanguage: 'en',
      codewordsGridSize: 15,
      codewordsCustomSize: 15,
      codewordsDifficulty: 'medium',
      codewordsHintCount: 3,
      codewordsHintCountManual: false,
      codewordsHintPlacement: 'all-occurrences',
      showCodewordsCodeBox: true,
      codewordsBlockedCellColor: '#888888',
      codewordsPlayableCellColor: '#FFFFFF',
      codewordsGridLineColor: '#000000',
      codewordsGridStrokeWidth: 1,
      codewordsNumberColor: '#000000',
      codewordsLetterColor: '#000000',
      codewordsSeed: 0,
      binairoGridSize: 10,
      binairoDifficulty: 'medium',
      binairoSymbols: '01',
      binairoGridLineColor: '#000000',
      binairoGridStrokeWidth: 1,
      binairoSymbolColor: '#000000',
      binairoSeed: 0,
      kakuroGridSize: 9,
      kakuroDifficulty: 'medium',
      kakuroPattern: 'asymmetric',
      kakuroGridLineColor: '#d4d4d4',
      kakuroBlockFill: '#000000',
      kakuroClueCellFill: '#000000',
      kakuroPlayableFill: '#ffffff',
      kakuroClueTextColor: '#ffffff',
      kakuroDigitColor: '#000000',
      kakuroGridLineWidth: 0.75,
      kakuroCluePadding: 0.1,
      kakuroCellPadding: 0.06,
      kakuroSeed: 0,
      mathMazeEquationsAcross: 4,
      mathMazeEquationsDown: 5,
      mathMazeMaxDigits: 2,
      mathMazeMaxDividendDigits: 3,
      mathMazeMaxDivisorDigits: 1,
      mathMazeMaxAnswerDigits: 3,
      mathMazeNumbersPerEquation: 2,
      mathMazeOpAdd: true,
      mathMazeOpSub: true,
      mathMazeOpMul: false,
      mathMazeOpDiv: false,
      mathMazeAllowNegative: false,
      mathMazeUseParentheses: false,
      mathMazeParenthesesMode: 'random',
      mathMazeStartText: 'Start',
      mathMazeEndText: 'End',
      mathMazeCornerRoundingPercent: 15,
      mathMazeChannelSizePercent: 60,
      mathMazeSolutionPathColor: '#6b7280',
      mathMazeSolutionCellFill: '#e5e7eb',
      mathMazeSeed: 0,
      fillMode: moduleType === 'number-fill' ? 'number' : 'word',
      fillGridWidth: 13,
      fillGridHeight: 13,
      fillWordsPerPuzzle: 16,
      fillExactWordCount: false,
      fillLettersToShow: 0,
      fillIncludeStarterWord: true,
      fillDigitCount2: 4,
      fillDigitCount3: 4,
      fillDigitCount4: 2,
      fillDigitCount5: 0,
      fillDigitCount6: 0,
      fillDigitCount7: 0,
      fillDigitCount8: 0,
      fillDigitCount9: 0,
      fillGridLineWidth: 0.75,
      fillGridLineColor: '#111111',
      fillBlockFill: '#111111',
      fillPlayableFill: '#ffffff',
      fillSeed: 0,
      fillWordsText: '',
      snakeMode: 'word',
      snakeGridWidth: 12,
      snakeGridHeight: 12,
      snakeWordsPerPuzzle: 5,
      snakeAllowNumbersInGrid: false,
      snakeNoBoxAroundPuzzle: false,
      snakeAddGridLines: true,
      snakeIncludeFiller: '',
      snakeExcludeFiller: '',
      snakeDigitCount2: 3,
      snakeDigitCount3: 3,
      snakeDigitCount4: 2,
      snakeDigitCount5: 0,
      snakeDigitCount6: 0,
      snakeDigitCount7: 0,
      snakeDigitCount8: 0,
      snakeDigitCount9: 0,
      snakeGridLineWidth: 0.75,
      snakeGridLineColor: '#111111',
      snakeSolutionPathColor: '#111111',
      snakeNonPathColor: '#111111',
      snakeSolutionPathThickness: 18,
      snakeSolutionPathOpacity: 100,
      snakeSeed: 0,
      snakeWordsText: '',
      snakeWordListColumns: 2,
      snakeWordSpacingHorizontal: 50,
      snakeWordSpacingVertical: 8,
      letterCase: 'upper',
    },
    typography: {
      selectTitleOption: 'custom',
      titleText: getGenericModuleDefaultTitle(moduleType),
      includeFunFacts: false,
      funFactsText: '',
      differentTitles: '',
      puzzleNumberingStyle: moduleType === 'codewords' ? 'suffix' : 'prefix',
      puzzleTitleFontFamily: 'Arial',
      puzzleTitleFontSize: 24,
      answerTitleFontFamily: 'Arial',
      answerTitleFontSize: 18,
      answerTitleAlign: 'center',
      puzzleFontFamily: 'Arial',
      puzzleFontSize:
        moduleType === 'sudoku' ||
        moduleType === 'binairo' ||
        moduleType === 'kakuro' ||
        moduleType === 'word-fill' ||
        moduleType === 'number-fill' ||
        moduleType === 'snake'
          ? 18
          : moduleType === 'math-maze'
            ? 11
            : moduleType === 'cryptogram'
              ? 16
              : moduleType === 'trivia'
                ? 14
                : 14,
      answerFontFamily: 'Arial',
      answerFontSize:
        moduleType === 'sudoku' ||
        moduleType === 'binairo' ||
        moduleType === 'kakuro' ||
        moduleType === 'word-fill' ||
        moduleType === 'number-fill' ||
        moduleType === 'snake'
          ? 16
          : moduleType === 'math-maze'
            ? 11
            : moduleType === 'cryptogram'
              ? 16
              : 12,
      wordListFontFamily: 'Arial',
      wordListFontSize:
        moduleType === 'word-fill' || moduleType === 'number-fill' || moduleType === 'snake'
          ? 16
          : 12,
      wordListBold: false,
      wordListItalic: false,
      answerKeyFontFamily: 'Arial',
      answerKeyFontSize: 18,
      answerKeyBold: true,
      answerKeyItalic: false,
      codewordsNumberFontFamily: 'Arial',
      codewordsNumberFontSize: 9,
      codewordsNumberBold: false,
      codewordsNumberItalic: false,
      codewordsLetterFontFamily: 'Arial',
      codewordsLetterFontSize: 14,
      codewordsLetterBold: true,
      codewordsLetterItalic: false,
      kakuroClueFontFamily: 'Arial',
      kakuroClueFontSize: 7,
      kakuroClueBold: true,
      mathMazeEquationFontFamily: 'Arial',
      mathMazeChannelFontFamily: 'Arial',
      mathMazeStartEndFontFamily: 'Arial',
      mathMazeStartFontSize: 11,
      mathMazeEndFontSize: 13,
      mathMazeAnswerStartFontSize: 11,
      mathMazeAnswerEndFontSize: 13,
      mathMazeEquationFontSize: 11,
      mathMazeChannelFontSize: 9,
      mathMazeAnswerEquationFontSize: 11,
      mathMazeAnswerChannelFontSize: 9,
      solutionToSolutionGapPx: 14,
      suggestionFontFamily: 'Arial',
      suggestionFontSize: 13,
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
      triviaSolutionColumnSpaceBetween: 24,
      puzzleTitleAlign: 'center',
      solutionTitleStyle: 'same_as_puzzle',
      customSolutionTitle: 'Solution',
      solutionNumberingStyle: 'none',
      includePageNumbers: true,
    },
    colors: {
      backgroundColor: '#ffffff',
      titleColor: '#333333',
      answerTitleColor: '#1f2937',
      gridColor: '#333333',
      solutionPathColor: '#e11d48',
      sudokuXBoxColor: '#e6e6e6',
      sudokuXLineColor: '#6b7280',
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
  if (!isSudokuXMarkStyle(core.sudokuXMarkStyle)) {
    core.sudokuXMarkStyle = 'boxes';
  }
  core.sudokuXLineThickness = clampInt(core.sudokuXLineThickness, 25, 300, 100);
  core.sudokuXLineTransparency = clampInt(core.sudokuXLineTransparency, 0, 100, 35);
  if (typeof colors.sudokuXBoxColor !== 'string' || !colors.sudokuXBoxColor.trim()) {
    colors.sudokuXBoxColor = def.colors.sudokuXBoxColor;
  }
  if (typeof colors.sudokuXLineColor !== 'string' || !colors.sudokuXLineColor.trim()) {
    colors.sudokuXLineColor = def.colors.sudokuXLineColor;
  }

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
  core.sudokuMixedIncludeX = core.sudokuMixedIncludeX === true;
  core.sudokuMixedIncludeGreaterThan = core.sudokuMixedIncludeGreaterThan === true;
  core.sudokuGreaterThanHybrid = core.sudokuGreaterThanHybrid === true;
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
    core.sudokuDifficulty !== 'hard' &&
    core.sudokuDifficulty !== 'expert'
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
  if (
    core.sudokuDifficulty === 'mixed' &&
    (core.sudokuPuzzleMode === 'standard' || core.sudokuPuzzleMode === 'x')
  ) {
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
  if (
    core.sudokuSize === 'mixed' &&
    (core.sudokuPuzzleMode === 'standard' || core.sudokuPuzzleMode === 'x')
  ) {
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
  core.mazeStartEndImages = normalizeMazeStartEndImages(core.mazeStartEndImages);
  // Drop legacy showMazeSolutionPath if present on older snapshots.
  delete (core as { showMazeSolutionPath?: boolean }).showMazeSolutionPath;
  core.hintLettersCount = clampInt(core.hintLettersCount, 0, 25, 1);
  // Codewords settings
  if (typeof core.codewordsLanguage !== 'string' || !core.codewordsLanguage) {
    core.codewordsLanguage = 'en';
  }
  const cwSize = core.codewordsGridSize;
  if (
    cwSize !== 'custom' &&
    cwSize !== 11 &&
    cwSize !== 13 &&
    cwSize !== 15 &&
    cwSize !== 17 &&
    cwSize !== 19 &&
    cwSize !== 21
  ) {
    core.codewordsGridSize = 15;
  }
  core.codewordsCustomSize = clampInt(core.codewordsCustomSize, 11, 21, 15);
  if (
    core.codewordsDifficulty !== 'easy' &&
    core.codewordsDifficulty !== 'medium' &&
    core.codewordsDifficulty !== 'hard' &&
    core.codewordsDifficulty !== 'very-hard'
  ) {
    core.codewordsDifficulty = 'medium';
  }
  core.codewordsHintCount = clampInt(core.codewordsHintCount, 0, 26, 3);
  core.codewordsHintCountManual = core.codewordsHintCountManual === true;
  if (
    core.codewordsHintPlacement !== 'all-occurrences' &&
    core.codewordsHintPlacement !== 'single-occurrence'
  ) {
    core.codewordsHintPlacement = 'all-occurrences';
  }
  core.showCodewordsCodeBox = core.showCodewordsCodeBox !== false;
  if (typeof core.codewordsBlockedCellColor !== 'string') core.codewordsBlockedCellColor = '#888888';
  if (typeof core.codewordsPlayableCellColor !== 'string') core.codewordsPlayableCellColor = '#FFFFFF';
  if (typeof core.codewordsGridLineColor !== 'string') core.codewordsGridLineColor = '#000000';
  core.codewordsGridStrokeWidth = Math.max(0.5, Math.min(4, Number(core.codewordsGridStrokeWidth) || 1));
  if (typeof core.codewordsNumberColor !== 'string') core.codewordsNumberColor = '#000000';
  if (typeof core.codewordsLetterColor !== 'string') core.codewordsLetterColor = '#000000';
  core.codewordsSeed = clampInt(core.codewordsSeed, 0, 2147483647, 0);
  // Binairo settings
  const binSizes = [4, 6, 8, 10, 12, 14] as const;
  if (!(binSizes as readonly number[]).includes(Number(core.binairoGridSize))) {
    core.binairoGridSize = 10;
  } else {
    core.binairoGridSize = Number(core.binairoGridSize) as BinairoGridSize;
  }
  if (
    core.binairoDifficulty !== 'easy' &&
    core.binairoDifficulty !== 'medium' &&
    core.binairoDifficulty !== 'hard'
  ) {
    core.binairoDifficulty = 'medium';
  }
  if (core.binairoSymbols !== '01' && core.binairoSymbols !== 'xo') {
    core.binairoSymbols = '01';
  }
  if (typeof core.binairoGridLineColor !== 'string') core.binairoGridLineColor = '#000000';
  {
    const stroke = Number(core.binairoGridStrokeWidth);
    core.binairoGridStrokeWidth =
      Number.isFinite(stroke) && stroke > 0 ? Math.max(0.5, Math.min(4, stroke)) : 1;
  }
  if (typeof core.binairoSymbolColor !== 'string') core.binairoSymbolColor = '#000000';
  core.binairoSeed = clampInt(core.binairoSeed, 0, 2147483647, 0);
  // Kakuro settings
  const kakSizes = [7, 8, 9, 10, 12, 15] as const;
  if (!(kakSizes as readonly number[]).includes(Number(core.kakuroGridSize))) {
    core.kakuroGridSize = 9;
  } else {
    core.kakuroGridSize = Number(core.kakuroGridSize) as import('./puzzles/kakuro').KakuroGridSize;
  }
  if (
    core.kakuroDifficulty !== 'easy' &&
    core.kakuroDifficulty !== 'medium' &&
    core.kakuroDifficulty !== 'hard'
  ) {
    core.kakuroDifficulty = 'medium';
  }
  if (core.kakuroPattern !== 'asymmetric' && core.kakuroPattern !== 'rotational') {
    core.kakuroPattern = 'asymmetric';
  }
  if (typeof core.kakuroGridLineColor !== 'string') core.kakuroGridLineColor = '#d4d4d4';
  if (typeof core.kakuroBlockFill !== 'string') core.kakuroBlockFill = '#000000';
  if (typeof core.kakuroClueCellFill !== 'string') core.kakuroClueCellFill = '#000000';
  if (typeof core.kakuroPlayableFill !== 'string') core.kakuroPlayableFill = '#ffffff';
  if (typeof core.kakuroClueTextColor !== 'string') core.kakuroClueTextColor = '#ffffff';
  if (typeof core.kakuroDigitColor !== 'string') core.kakuroDigitColor = '#000000';
  {
    // Prefer kakuroGridLineWidth; migrate from legacy inner/outer/diagonal if needed.
    const legacy =
      Number(core.kakuroGridLineWidth) ||
      Number(core.kakuroInnerLineWidth) ||
      Number(core.kakuroDiagonalWidth) ||
      Number(core.kakuroOuterBorderWidth) ||
      0;
    core.kakuroGridLineWidth =
      Number.isFinite(legacy) && legacy > 0 ? Math.max(0.35, Math.min(3, legacy)) : 0.75;
    // Keep legacy fields in sync so older code paths stay harmless.
    core.kakuroInnerLineWidth = core.kakuroGridLineWidth;
    const cluePad = Number(core.kakuroCluePadding);
    core.kakuroCluePadding =
      Number.isFinite(cluePad) && cluePad > 0
        ? Math.max(0.04, Math.min(0.28, cluePad))
        : 0.1;
    const cellPad = Number(core.kakuroCellPadding);
    core.kakuroCellPadding =
      Number.isFinite(cellPad) && cellPad > 0 ? Math.max(0.02, Math.min(0.2, cellPad)) : 0.06;
  }
  core.kakuroSeed = clampInt(core.kakuroSeed, 0, 2147483647, 0);
  // Math Maze
  core.mathMazeEquationsAcross = clampInt(core.mathMazeEquationsAcross, 2, 12, 4);
  core.mathMazeEquationsDown = clampInt(core.mathMazeEquationsDown, 2, 15, 5);
  core.mathMazeMaxDigits = clampInt(core.mathMazeMaxDigits, 1, 4, 2);
  core.mathMazeMaxDividendDigits = clampInt(core.mathMazeMaxDividendDigits, 1, 6, 3);
  core.mathMazeMaxDivisorDigits = clampInt(core.mathMazeMaxDivisorDigits, 1, 4, 1);
  core.mathMazeMaxAnswerDigits = clampInt(core.mathMazeMaxAnswerDigits, 1, 6, 3);
  {
    const n = Math.round(Number(core.mathMazeNumbersPerEquation));
    core.mathMazeNumbersPerEquation = (n === 3 || n === 4 ? n : 2) as 2 | 3 | 4;
  }
  core.mathMazeOpAdd = core.mathMazeOpAdd !== false;
  core.mathMazeOpSub = core.mathMazeOpSub === true;
  core.mathMazeOpMul = core.mathMazeOpMul === true;
  core.mathMazeOpDiv = core.mathMazeOpDiv === true;
  core.mathMazeAllowNegative = core.mathMazeAllowNegative === true;
  core.mathMazeUseParentheses = core.mathMazeUseParentheses === true;
  core.mathMazeParenthesesMode =
    core.mathMazeParenthesesMode === 'all' ? 'all' : 'random';
  if (typeof core.mathMazeStartText !== 'string' || !core.mathMazeStartText.trim()) {
    core.mathMazeStartText = 'Start';
  }
  if (typeof core.mathMazeEndText !== 'string' || !core.mathMazeEndText.trim()) {
    core.mathMazeEndText = 'End';
  }
  core.mathMazeCornerRoundingPercent = clampInt(core.mathMazeCornerRoundingPercent, 0, 50, 15);
  core.mathMazeChannelSizePercent = clampInt(core.mathMazeChannelSizePercent, 20, 100, 60);
  if (
    typeof core.mathMazeSolutionPathColor !== 'string' ||
    core.mathMazeSolutionPathColor === '#22c55e' ||
    core.mathMazeSolutionPathColor === '#16a34a'
  ) {
    core.mathMazeSolutionPathColor = '#6b7280';
  }
  if (
    typeof core.mathMazeSolutionCellFill !== 'string' ||
    !core.mathMazeSolutionCellFill.trim() ||
    core.mathMazeSolutionCellFill === '#ecfdf5' ||
    core.mathMazeSolutionCellFill === '#dcfce7'
  ) {
    core.mathMazeSolutionCellFill = '#e5e7eb';
  }
  core.mathMazeSeed = clampInt(core.mathMazeSeed, 0, 2147483647, 0);
  // Fill — the mode is implied by the module (Word Fill-In / Number Fill-In).
  core.fillMode =
    moduleType === 'number-fill'
      ? 'number'
      : moduleType === 'word-fill'
        ? 'word'
        : core.fillMode === 'number'
          ? 'number'
          : 'word';
  core.fillGridWidth = clampInt(core.fillGridWidth, 5, 30, 13);
  core.fillGridHeight = clampInt(core.fillGridHeight, 5, 30, 13);
  core.fillWordsPerPuzzle = clampInt(core.fillWordsPerPuzzle, 1, 100, 16);
  core.fillExactWordCount = core.fillExactWordCount === true;
  core.fillLettersToShow = clampInt(core.fillLettersToShow, 0, 500, 0);
  core.fillIncludeStarterWord = core.fillIncludeStarterWord !== false;
  for (const k of [2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const key = `fillDigitCount${k}` as const;
    core[key] = clampInt(core[key], 0, 100, core[key] ?? 0);
  }
  {
    const w = Number(core.fillGridLineWidth);
    core.fillGridLineWidth =
      Number.isFinite(w) && w > 0 ? Math.max(0.35, Math.min(3, w)) : 0.75;
  }
  if (typeof core.fillGridLineColor !== 'string') core.fillGridLineColor = '#111111';
  if (typeof core.fillBlockFill !== 'string') core.fillBlockFill = '#111111';
  if (typeof core.fillPlayableFill !== 'string') core.fillPlayableFill = '#ffffff';
  core.fillSeed = clampInt(core.fillSeed, 0, 2147483647, 0);
  if (typeof core.fillWordsText !== 'string') core.fillWordsText = '';
  // Snake
  core.snakeMode = core.snakeMode === 'number' ? 'number' : 'word';
  core.snakeGridWidth = clampInt(core.snakeGridWidth, 3, 30, 12);
  core.snakeGridHeight = clampInt(core.snakeGridHeight, 3, 30, 12);
  core.snakeWordsPerPuzzle = clampInt(core.snakeWordsPerPuzzle, 1, 100, 5);
  core.snakeAllowNumbersInGrid = core.snakeAllowNumbersInGrid === true;
  core.snakeNoBoxAroundPuzzle = core.snakeNoBoxAroundPuzzle === true;
  core.snakeAddGridLines = core.snakeAddGridLines !== false;
  if (typeof core.snakeIncludeFiller !== 'string') core.snakeIncludeFiller = '';
  if (typeof core.snakeExcludeFiller !== 'string') core.snakeExcludeFiller = '';
  for (const k of [2, 3, 4, 5, 6, 7, 8, 9] as const) {
    const key = `snakeDigitCount${k}` as const;
    core[key] = clampInt(core[key], 0, 100, core[key] ?? 0);
  }
  {
    const w = Number(core.snakeGridLineWidth);
    core.snakeGridLineWidth =
      Number.isFinite(w) && w > 0 ? Math.max(0.35, Math.min(3, w)) : 0.75;
  }
  if (typeof core.snakeGridLineColor !== 'string') core.snakeGridLineColor = '#111111';
  // Migrate the old green path defaults to black/white.
  if (
    typeof core.snakeSolutionPathColor !== 'string' ||
    core.snakeSolutionPathColor === '#16a34a'
  ) {
    core.snakeSolutionPathColor = '#111111';
  }
  if (
    typeof core.snakeNonPathColor !== 'string' ||
    core.snakeNonPathColor === '#94a3b8'
  ) {
    core.snakeNonPathColor = '#111111';
  }
  core.snakeSolutionPathThickness = clampInt(core.snakeSolutionPathThickness, 5, 80, 18);
  core.snakeSolutionPathOpacity = clampInt(core.snakeSolutionPathOpacity, 0, 100, 100);
  core.snakeSeed = clampInt(core.snakeSeed, 0, 2147483647, 0);
  if (typeof core.snakeWordsText !== 'string') core.snakeWordsText = '';
  core.snakeWordListColumns = clampInt(core.snakeWordListColumns, 1, 4, 2);
  core.snakeWordSpacingHorizontal = clampInt(core.snakeWordSpacingHorizontal, 0, 100, 50);
  core.snakeWordSpacingVertical = clampInt(core.snakeWordSpacingVertical, 0, 40, 8);
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
  typography.wordListFontSize = clampInt(
    typography.wordListFontSize,
    10,
    28,
    def.typography.wordListFontSize ?? 16
  );
  typography.wordListBold = typography.wordListBold === true;
  typography.wordListItalic = typography.wordListItalic === true;
  typography.answerKeyFontSize = clampInt(
    typography.answerKeyFontSize,
    1,
    72,
    def.typography.answerKeyFontSize
  );
  typography.answerKeyBold = typography.answerKeyBold !== false;
  typography.answerKeyItalic = typography.answerKeyItalic === true;
  typography.codewordsNumberFontSize = clampInt(
    typography.codewordsNumberFontSize,
    5,
    72,
    def.typography.codewordsNumberFontSize ?? 9
  );
  typography.codewordsLetterFontSize = clampInt(
    typography.codewordsLetterFontSize,
    6,
    72,
    def.typography.codewordsLetterFontSize ?? 14
  );
  if (
    typeof typography.codewordsNumberFontFamily !== 'string' ||
    !typography.codewordsNumberFontFamily.trim()
  ) {
    typography.codewordsNumberFontFamily = 'Arial';
  }
  if (
    typeof typography.codewordsLetterFontFamily !== 'string' ||
    !typography.codewordsLetterFontFamily.trim()
  ) {
    typography.codewordsLetterFontFamily = 'Arial';
  }
  typography.codewordsNumberBold = typography.codewordsNumberBold === true;
  typography.codewordsNumberItalic = typography.codewordsNumberItalic === true;
  typography.codewordsLetterBold = typography.codewordsLetterBold !== false;
  typography.codewordsLetterItalic = typography.codewordsLetterItalic === true;
  typography.kakuroClueFontSize = clampInt(
    typography.kakuroClueFontSize,
    4,
    72,
    def.typography.kakuroClueFontSize ?? 7
  );
  if (
    typeof typography.kakuroClueFontFamily !== 'string' ||
    !typography.kakuroClueFontFamily.trim()
  ) {
    typography.kakuroClueFontFamily = 'Arial';
  }
  if (
    typeof typography.mathMazeEquationFontFamily !== 'string' ||
    !typography.mathMazeEquationFontFamily.trim()
  ) {
    typography.mathMazeEquationFontFamily = 'Arial';
  }
  if (
    typeof typography.mathMazeChannelFontFamily !== 'string' ||
    !typography.mathMazeChannelFontFamily.trim()
  ) {
    typography.mathMazeChannelFontFamily = 'Arial';
  }
  if (
    typeof typography.mathMazeStartEndFontFamily !== 'string' ||
    !typography.mathMazeStartEndFontFamily.trim()
  ) {
    typography.mathMazeStartEndFontFamily = 'Arial';
  }
  typography.mathMazeEquationFontSize = clampInt(
    typography.mathMazeEquationFontSize,
    6,
    48,
    def.typography.mathMazeEquationFontSize ?? 11
  );
  typography.mathMazeChannelFontSize = clampInt(
    typography.mathMazeChannelFontSize,
    5,
    36,
    def.typography.mathMazeChannelFontSize ?? 9
  );
  typography.mathMazeStartFontSize = clampInt(
    typography.mathMazeStartFontSize,
    6,
    48,
    def.typography.mathMazeStartFontSize ?? 11
  );
  typography.mathMazeEndFontSize = clampInt(
    typography.mathMazeEndFontSize,
    6,
    48,
    def.typography.mathMazeEndFontSize ?? 13
  );
  typography.mathMazeAnswerEquationFontSize = clampInt(
    typography.mathMazeAnswerEquationFontSize,
    6,
    48,
    def.typography.mathMazeAnswerEquationFontSize ?? 11
  );
  typography.mathMazeAnswerChannelFontSize = clampInt(
    typography.mathMazeAnswerChannelFontSize,
    5,
    36,
    def.typography.mathMazeAnswerChannelFontSize ?? 9
  );
  typography.mathMazeAnswerStartFontSize = clampInt(
    typography.mathMazeAnswerStartFontSize,
    6,
    48,
    def.typography.mathMazeAnswerStartFontSize ?? 11
  );
  typography.mathMazeAnswerEndFontSize = clampInt(
    typography.mathMazeAnswerEndFontSize,
    6,
    48,
    def.typography.mathMazeAnswerEndFontSize ?? 13
  );
  typography.kakuroClueBold = typography.kakuroClueBold !== false;
  typography.solutionToSolutionGapPx = clampInt(
    typography.solutionToSolutionGapPx,
    0,
    120,
    def.typography.solutionToSolutionGapPx ?? 14
  );
  typography.puzzleTitleBold = typography.puzzleTitleBold !== false;
  typography.puzzleBold = typography.puzzleBold === true;
  typography.puzzleItalic = typography.puzzleItalic === true;
  typography.suggestionItalic = typography.suggestionItalic === true;
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
  typography.triviaSolutionColumnSpaceBetween = clampInt(
    typography.triviaSolutionColumnSpaceBetween,
    0,
    72,
    def.typography.triviaSolutionColumnSpaceBetween
  );
  if (
    typography.puzzleTitleAlign !== 'left' &&
    typography.puzzleTitleAlign !== 'center' &&
    typography.puzzleTitleAlign !== 'right'
  ) {
    typography.puzzleTitleAlign = 'center';
  }
  if (
    typography.answerTitleAlign !== 'left' &&
    typography.answerTitleAlign !== 'center' &&
    typography.answerTitleAlign !== 'right'
  ) {
    typography.answerTitleAlign = 'center';
  }
  if (typeof typography.answerTitleFontFamily !== 'string' || !typography.answerTitleFontFamily.trim()) {
    typography.answerTitleFontFamily =
      typography.puzzleTitleFontFamily || def.typography.answerTitleFontFamily || 'Arial';
  }
  if (typeof colors.answerTitleColor !== 'string' || !colors.answerTitleColor.trim()) {
    colors.answerTitleColor = colors.titleColor || def.colors.answerTitleColor || '#1f2937';
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
  if (typeof typography.suggestionFontFamily !== 'string' || !typography.suggestionFontFamily.trim()) {
    typography.suggestionFontFamily = typography.puzzleFontFamily || 'Arial';
  }
  if (
    typeof typography.suggestionFontSize !== 'number' ||
    !Number.isFinite(typography.suggestionFontSize) ||
    typography.suggestionFontSize <= 0
  ) {
    typography.suggestionFontSize = Math.max(
      10,
      Math.round((typography.puzzleFontSize || def.typography.puzzleFontSize) * 0.95)
    );
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
