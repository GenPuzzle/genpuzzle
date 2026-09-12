import type { PuzzleModuleType } from '@/lib/document-model';

/**
 * Puzzle types the AI wizard can generate.
 * Must stay in sync with PUZZLE_MODULES in document-model.ts.
 * Defined here (not imported) so the server API route does not load the
 * client-only document-model module.
 */
export const AI_SUPPORTED_PUZZLE_TYPES: PuzzleModuleType[] = [
  'word-search',
  'sudoku',
  'crossword',
  'maze',
  'cryptogram',
  'word-scramble',
  'trivia',
  'murdoku',
];

const AI_PUZZLE_TYPE_LABELS: Record<PuzzleModuleType, string> = {
  'word-search': 'Word Search',
  sudoku: 'Sudoku',
  crossword: 'Crossword',
  maze: 'Mazes',
  cryptogram: 'Cryptograms',
  'word-scramble': 'Word Scramble',
  trivia: 'Trivia',
  murdoku: 'Murdoku',
};

export function isAiPuzzleType(value: unknown): value is PuzzleModuleType {
  return (
    typeof value === 'string' &&
    (AI_SUPPORTED_PUZZLE_TYPES as string[]).includes(value)
  );
}

export type AiDifficulty = 'easy' | 'medium' | 'hard';

export type AiDifficultyStrategy =
  | 'easy'
  | 'medium'
  | 'hard'
  | 'easy-to-hard'
  | 'custom';

export type AiAudience = 'kids' | 'teens' | 'adults' | 'seniors' | 'custom';

export interface AiCustomDifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
}

export interface AiPuzzleTypeConfig {
  type: PuzzleModuleType;
  count: number;
  difficultyStrategy: AiDifficultyStrategy;
  customDistribution?: AiCustomDifficultyDistribution;
  /** Word search / scramble */
  wordsPerPuzzle?: number;
  maxWordLength?: number;
  avoidDuplicateWords?: boolean;
  generateFunFacts?: boolean;
  /** Crossword */
  cluesPerPuzzle?: number;
  exactClueCount?: boolean;
  maxAnswerLength?: number;
  /** Sudoku */
  sudokuSize?: 4 | 6 | 9;
  /** Maze */
  mazeSize?: 'small' | 'medium' | 'large' | 'xl';
  /** Trivia: questions per game / puzzles */
  questionsPerPuzzle?: number;
  suggestionsPerQuestion?: number;
  /** Murdoku grid size (4–16). */
  murdokuRows?: number;
  murdokuCols?: number;
  /** Murdoku suspects per puzzle (3–min(rows, cols)). */
  charactersPerPuzzle?: number;
  /** Drop random handheld clutter (phones, cups, laptops). Default true. */
  murdokuAvoidRandomProps?: boolean;
  /** Prefer medium/large furniture and decor. */
  murdokuLargeFurnitureOnly?: boolean;
  /**
   * Word search / crossword / scramble / trivia / cryptogram / murdoku:
   * when true, the user supplies one theme title per puzzle (see themeTitles).
   */
  useCustomThemeTitles?: boolean;
  /** One theme title per line; used when useCustomThemeTitles is true. */
  themeTitles?: string;
}

export interface AiFrontMatterOptions {
  includeTitlePage: boolean;
  includeTableOfContents: boolean;
  includeIntroduction: boolean;
  includeInstructions: boolean;
  includeChapterPages: boolean;
  /** When true, use chapterTitles instead of one title per puzzle type. */
  useCustomChapterTitles: boolean;
  /** One chapter title per line; used when useCustomChapterTitles is true. */
  chapterTitles: string;
}

export function defaultAiFrontMatter(): AiFrontMatterOptions {
  return {
    includeTitlePage: false,
    includeTableOfContents: false,
    includeIntroduction: false,
    includeInstructions: false,
    includeChapterPages: false,
    useCustomChapterTitles: false,
    chapterTitles: '',
  };
}

export function aiFrontMatterNeedsCopy(fm: AiFrontMatterOptions | undefined): boolean {
  if (!fm) return false;
  return fm.includeIntroduction || fm.includeInstructions;
}

export type AiBookOrganization = 'by-type' | 'by-chapter';

export interface AiProjectSetup {
  bookTitle: string;
  subtitle: string;
  description: string;
  language: string;
  audience: AiAudience;
  customAudience?: string;
  puzzleTypes: AiPuzzleTypeConfig[];
  frontMatter?: AiFrontMatterOptions;
  /**
   * by-chapter: each type's `count` is per chapter, and chapterTopics supply
   * the theme for that chapter's puzzles of every type.
   */
  organization?: AiBookOrganization;
  /** One chapter topic/theme per line when organization is by-chapter. */
  chapterTopics?: string;
}

/** Normalized puzzle content returned by DeepSeek (before app adapters). */
export interface AiWordSearchContent {
  type: 'word-search';
  title: string;
  theme?: string;
  difficulty: AiDifficulty;
  funFact?: string;
  words: string[];
}

export interface AiCrosswordContent {
  type: 'crossword';
  title: string;
  difficulty: AiDifficulty;
  entries: Array<{ answer: string; clue: string }>;
}

export interface AiSudokuContent {
  type: 'sudoku';
  title: string;
  difficulty: AiDifficulty;
}

export interface AiMazeContent {
  type: 'maze';
  title: string;
  difficulty: AiDifficulty;
}

export interface AiCryptogramContent {
  type: 'cryptogram';
  title: string;
  difficulty: AiDifficulty;
  phrase: string;
}

export interface AiWordScrambleContent {
  type: 'word-scramble';
  title: string;
  difficulty: AiDifficulty;
  words: string[];
}

export interface AiTriviaContent {
  type: 'trivia';
  title: string;
  difficulty: AiDifficulty;
  questions: Array<{
    prompt: string;
    suggestions: string[];
    answer: string;
  }>;
}

export interface AiMurdokuContent {
  type: 'murdoku';
  title: string;
  theme?: string;
  location?: string;
  difficulty: AiDifficulty;
  caseTitle?: string;
  intro?: string;
  instruction?: string;
  characters?: Array<{ name: string; occupation?: string; description?: string }>;
  rooms?: string[];
  elements?: string[];
}

export type AiPuzzleContent =
  | AiWordSearchContent
  | AiCrosswordContent
  | AiSudokuContent
  | AiMazeContent
  | AiCryptogramContent
  | AiWordScrambleContent
  | AiTriviaContent
  | AiMurdokuContent;

export interface AiBatchRequest {
  setup: Pick<
    AiProjectSetup,
    'bookTitle' | 'subtitle' | 'description' | 'language' | 'audience' | 'customAudience'
  >;
  puzzleType: PuzzleModuleType;
  typeConfig: AiPuzzleTypeConfig;
  /** Absolute puzzle indices in the book for this type (0-based). */
  startIndex: number;
  count: number;
  assignedDifficulties: AiDifficulty[];
  /** Titles/words already used — avoid duplicates across batches. */
  excludeTitles: string[];
  excludeWords: string[];
  excludeAnswers: string[];
}

export interface AiBatchResponse {
  puzzles: AiPuzzleContent[];
}

export interface AiFrontMatterRequest {
  setup: Pick<
    AiProjectSetup,
    'bookTitle' | 'subtitle' | 'description' | 'language' | 'audience' | 'customAudience'
  >;
  puzzleTypeLabels: string[];
  needIntroduction: boolean;
  needInstructions: boolean;
}

export interface AiFrontMatterCopy {
  introduction?: string;
  instructions?: string;
}

export interface AiGenerationProgress {
  overallDone: number;
  overallTotal: number;
  byType: Record<
    string,
    {
      done: number;
      total: number;
      label: string;
    }
  >;
  statusMessage: string;
}

export function getAiPuzzleTypeLabel(type: PuzzleModuleType): string {
  return AI_PUZZLE_TYPE_LABELS[type] ?? type;
}

export const AI_THEME_TITLE_TYPES: PuzzleModuleType[] = [
  'word-search',
  'crossword',
  'word-scramble',
  'trivia',
  'cryptogram',
  'murdoku',
];

export function supportsAiThemeTitles(type: PuzzleModuleType): boolean {
  return (AI_THEME_TITLE_TYPES as string[]).includes(type);
}

export function parseAiThemeTitles(text: string | undefined | null): string[] {
  return (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function clampAiMurdokuGridSize(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 9;
  return Math.max(4, Math.min(16, v));
}

export function clampAiMurdokuCharacterCount(
  n: unknown,
  rows: number,
  cols: number
): number {
  const cap = Math.max(3, Math.min(rows, cols));
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return cap;
  return Math.max(3, Math.min(cap, v));
}

export function aiMurdokuGridFromConfig(cfg: Pick<AiPuzzleTypeConfig, 'murdokuRows' | 'murdokuCols' | 'charactersPerPuzzle'>): {
  rows: number;
  cols: number;
  people: number;
} {
  const rows = clampAiMurdokuGridSize(cfg.murdokuRows);
  const cols = clampAiMurdokuGridSize(cfg.murdokuCols);
  return {
    rows,
    cols,
    people: clampAiMurdokuCharacterCount(cfg.charactersPerPuzzle, rows, cols),
  };
}

/** True when the user entered different theme titles (not one repeated chapter topic). */
export function aiMurdokuHasDistinctThemeTitles(cfg: AiPuzzleTypeConfig): boolean {
  if (!cfg.useCustomThemeTitles) return false;
  const titles = parseAiThemeTitles(cfg.themeTitles);
  if (titles.length < 2) return false;
  return new Set(titles.map((title) => title.toLowerCase())).size > 1;
}

export function parseAiChapterTopics(text: string | undefined | null): string[] {
  return parseAiThemeTitles(text);
}

export function isAiByChapter(
  setup: Pick<AiProjectSetup, 'organization'> | undefined | null
): boolean {
  return setup?.organization === 'by-chapter';
}

export function getAiChapterTopics(setup: AiProjectSetup | undefined | null): string[] {
  if (!setup || !isAiByChapter(setup)) return [];
  return parseAiChapterTopics(setup.chapterTopics);
}

/** 1 when not by-chapter; otherwise the number of chapter topics (at least 1). */
export function aiChapterMultiplier(setup: AiProjectSetup | undefined | null): number {
  if (!setup || !isAiByChapter(setup)) return 1;
  return Math.max(1, getAiChapterTopics(setup).length);
}

export function aiTotalCountForType(
  cfg: Pick<AiPuzzleTypeConfig, 'count'>,
  setup: AiProjectSetup | undefined | null
): number {
  return Math.max(0, Math.floor(cfg.count)) * aiChapterMultiplier(setup);
}

export function themeTitlesForBatch(
  text: string | undefined | null,
  startIndex: number,
  count: number
): string[] {
  return parseAiThemeTitles(text).slice(startIndex, startIndex + count);
}

export function applyCustomThemeTitles(
  puzzles: AiPuzzleContent[],
  typeConfig: AiPuzzleTypeConfig,
  startIndex: number
): AiPuzzleContent[] {
  if (!typeConfig.useCustomThemeTitles) return puzzles;
  const titles = themeTitlesForBatch(typeConfig.themeTitles, startIndex, puzzles.length);
  if (titles.length === 0) return puzzles;
  return puzzles.map((puzzle, i) => {
    const title = titles[i];
    if (!title) return puzzle;
    if (puzzle.type === 'word-search') {
      return { ...puzzle, title, theme: title };
    }
    if (puzzle.type === 'murdoku') {
      return { ...puzzle, title, theme: title, caseTitle: title };
    }
    return { ...puzzle, title };
  });
}

export function assignDifficulties(
  count: number,
  strategy: AiDifficultyStrategy,
  custom?: AiCustomDifficultyDistribution
): AiDifficulty[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];

  if (strategy === 'easy' || strategy === 'medium' || strategy === 'hard') {
    return Array.from({ length: n }, () => strategy);
  }

  if (strategy === 'custom' && custom) {
    const easy = Math.max(0, Math.floor(custom.easy));
    const medium = Math.max(0, Math.floor(custom.medium));
    const hard = Math.max(0, Math.floor(custom.hard));
    const list: AiDifficulty[] = [
      ...Array.from({ length: easy }, () => 'easy' as const),
      ...Array.from({ length: medium }, () => 'medium' as const),
      ...Array.from({ length: hard }, () => 'hard' as const),
    ];
    while (list.length < n) list.push('medium');
    return list.slice(0, n);
  }

  // Easy → Hard progressive thirds
  const third = Math.floor(n / 3);
  const rem = n - third * 3;
  const easyCount = third + (rem > 0 ? 1 : 0);
  const mediumCount = third + (rem > 1 ? 1 : 0);
  const hardCount = n - easyCount - mediumCount;
  return [
    ...Array.from({ length: easyCount }, () => 'easy' as const),
    ...Array.from({ length: mediumCount }, () => 'medium' as const),
    ...Array.from({ length: hardCount }, () => 'hard' as const),
  ];
}
