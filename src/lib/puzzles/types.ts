// Puzzle Types and Interfaces

import type { HeaderAssemblySettings } from '@/lib/header-assembly/types';
import { DEFAULT_HEADER_ASSEMBLY } from '@/lib/header-assembly/types';
import type { HeaderNumberConfig } from '@/lib/header-assembly/types';

export type PuzzleType =
  | 'word-search'
  | 'crossword'
  | 'sudoku'
  | 'cryptogram'
  | 'word-scramble'
  | 'trivia'
  | 'maze'
  | 'word-match'
  | 'dot-to-dot'
  | 'murdoku';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface Position {
  row: number;
  col: number;
}

export interface WordPlacement {
  word: string;
  start: Position;
  direction: Direction;
  end: Position;
  color?: string; // Optional per-word color for multi-color line highlights
}

export type Direction =
  | 'horizontal'
  | 'vertical'
  | 'diagonal-down'
  | 'diagonal-up'
  | 'horizontal-reverse'
  | 'vertical-reverse'
  | 'diagonal-down-reverse'
  | 'diagonal-up-reverse';

// ============ WORD SEARCH SPECIFIC SETTINGS ============

// Book/Canvas Settings
export type MeasurementUnits = 'INCHES' | 'CENTIMETERS';

export type TrimSizePresetId =
  | '5X8IN'
  | '5_25X8IN'
  | '5_5X8_5IN'
  | '6X9IN'
  | '5_06X7_81IN'
  | '6_14X9_21IN'
  | '6_69X9_61IN'
  | '7X10IN'
  | '7_44X9_69IN'
  | '7_5X9_25IN'
  | '8X10IN'
  | '8_5X11IN'
  | '8_27X11_69IN';

export interface BookCanvasSettings {
  // Bleed and trim
  includeBleed: boolean;
  useCustomTrim: boolean;
  customWidth: number;
  customHeight: number;
  trimSizePreset?: TrimSizePresetId;
  measurementUnits?: MeasurementUnits;

  // Puzzle Type
  puzzleType: PuzzleType;

  // Answers Per Page
  answersPerPage: number;

  // Page Structure
  includePageBetweenPuzzleAndSolutions: boolean;
}

// Puzzle Core Settings
export interface WordSearchCoreSettings {
  // Quantity
  numberOfPuzzles: number;
  puzzlesStartingNumber: number;
  /** Split each puzzle into two pages: layout/clues first, grid only second. */
  twoPagePuzzles: boolean;

  // Grid Structure
  lettersAcross: number;
  lettersDown: number;
  /** Fit word-search grid scale to the page safe area + page-number zone. */
  autoBalanceGrid?: boolean;
  /** Fit title / grid / word-list fonts so text stays inside the page. */
  autoBalanceFont?: boolean;

  /**
   * Shape word search: letters only fill the silhouette of an uploaded PNG/JPEG.
   * Outside-shape cells stay empty so the grid follows the image outline.
   */
  shapeWordSearchEnabled?: boolean;
  /**
   * `common` = one silhouette for every puzzle.
   * `per-puzzle` = separate silhouette per puzzle (batch upload).
   */
  shapeMaskMode?: 'common' | 'per-puzzle';
  /** Data URL of the shared silhouette (common mode). */
  shapeMaskImage?: string;
  /** Per-puzzle silhouette data URLs (per-puzzle mode), index = puzzleIndexInDocument. */
  shapeMaskImages?: string[];
  /** Alpha cutoff 0–255 when sampling transparent PNGs. Default 40. */
  shapeMaskAlphaThreshold?: number;
  /** How the silhouette maps onto the letter grid. */
  shapeMaskFit?: 'contain' | 'cover' | 'stretch';
  /** When true, draw the uploaded silhouette image under the letters. */
  shapeMaskShowImage?: boolean;
  /** Opacity of the shown silhouette image (0–100). Default 35. */
  shapeMaskImageOpacity?: number;

  // Allowed Directions
  allowUp: boolean;
  allowDown: boolean;
  allowLeft: boolean;
  allowRight: boolean;
  allowDiagonalUp: boolean;
  allowDiagonalDown: boolean;
  allowDiagonalUpReverse: boolean;
  allowDiagonalDownReverse: boolean;

  // Grid Modifiers
  noBoxAroundPuzzle: boolean;
  addGridLines: boolean;
  borderStrokeThickness: number;
  borderCornerRadius: number;
  /** Padding (in CSS px) between outer frame and the letter grid on puzzle pages */
  gridBorderPadding: number;
  /** Border stroke thickness on solution grid frames */
  solutionBorderStrokeThickness: number;
  /** Border corner radius on solution grid frames */
  solutionBorderCornerRadius: number;
  /** Padding (in CSS px) between outer frame and the letter grid on solution pages */
  solutionGridBorderPadding: number;
  gridLinesStrokeThickness: number;
  innerGridOpacity: number; // 0-100, 0 = invisible inner grid lines, 100 = fully opaque

}

// Typography & Spacing Settings
export interface TypographySpacingSettings {
  // Title Options
  selectTitleOption: 'puzzle-number' | 'one-custom-title' | 'custom' | 'none';
  titleText: string;
  
  // Puzzle Numbering Style
  puzzleNumberingStyle: 'none' | 'prefix' | 'suffix'; // How to display puzzle numbers with titles

  /** Bottom-of-page book page numbers (distinct from puzzle title numbering). */
  pageNumber: PageNumberSettings;
  
  // Solution Title Settings
  solutionTitleStyle: 'same_as_puzzle' | 'custom'; // Whether to use puzzle title or custom solution text
  customSolutionTitle: string; // Custom title for solution pages (e.g., "Solution")
  solutionNumberingStyle: 'none' | 'prefix' | 'suffix'; // How to display puzzle numbers on solution pages
  
  // Subtitle / Fun Facts & Quotes
  includeFunFacts: boolean; // Whether to include fun facts/quotes
  funFactsText: string; // Multi-line: "Fact 1\nFact 2\n..." - each line for respective puzzle page
  subtitleFontSize: number; // 10-24px, default 14
  subtitleFontFamily: string;
  subtitleTextScale: number; // Pixel width of subtitle text box (200-720px, default 500px) - DEPRECATED: use subtitleMaxWidthPercent
  subtitleMaxWidthPercent: number; // Max width as percentage of grid width (50-100%, default 100%)
  subtitleBoxMargin: number; // Horizontal margin/padding of subtitle text box (0-100pt, default 0)
  subtitleToTitleGap: number; // Gap between title and subtitle/fun-fact (default 10px)
  subtitleToPuzzleGap: number; // Gap between subtitle/fun-fact and puzzle grid (default 10px)

  // Fonts & Sizes
  puzzleTitleFontFamily: string;
  puzzleTitleFontSize: number;
  answerTitleFontSize: number;

  // Spacing Adjustments
  titleStartAt: number;
  spaceBetweenTitleAndPuzzle: number;
  spaceBetweenTitleAndAnswer: number;

  // Puzzle Grid Text
  puzzleGridCase: 'upper' | 'lower';
  puzzleGridFontFamily: string;
  puzzleGridFontSize: number;

  // Manual Letter Calibration Offsets (for perfect centering)
  uiOffsetX: number;
  uiOffsetY: number;
  pdfOffsetX: number;
  pdfOffsetY: number;

  // Answer Page Grid
  setFontForAnswerPages: boolean;
  answerGridFontFamily: string;
  setFontSizeForAnswerPages: boolean;
  answerGridFontSize: number;

  // Layout
  spaceBetweenPuzzleAndWordList: number;
}

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'alternating';

export interface PageNumberSettings {
  enabled: boolean;
  /** First printed number value (e.g. 1). */
  startNumberingFrom: number;
  /** 1-based book page where numbering begins. */
  startAtPage: number;
  position: PageNumberPosition;
  shape: HeaderNumberConfig;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  bottomOffsetPx: number;
  sideOffsetPx: number;
}

/** Default top offset for the puzzle title (typography.titleStartAt). */
export const DEFAULT_TITLE_START_AT = 0;

export const DEFAULT_PAGE_NUMBER_SETTINGS: PageNumberSettings = {
  enabled: true,
  startNumberingFrom: 1,
  startAtPage: 1,
  position: 'alternating',
  shape: {
    ...DEFAULT_HEADER_ASSEMBLY.number,
    shapeId: 'circle',
  },
  textColor: '#ffffff',
  fontFamily: 'Arial',
  fontSize: 14,
  bottomOffsetPx: 5,
  sideOffsetPx: 5,
};

// Word List Settings
export interface WordListSettings {
  // Words Per Puzzle
  wordsPerPuzzle: number;

  /**
   * Each puzzle uses exactly one word from the list (word i → puzzle i).
   * That word is placed on the grid `wordRepeatCount` times; the printed list shows it once.
   */
  oneWordPerPuzzle?: boolean;
  /** How many times the single word appears on the grid (one-word mode). Default 5. */
  wordRepeatCount?: number;
  /**
   * One-word mode: fill empty cells using only letters from that puzzle's word
   * (e.g. FISH → only F, I, S, H).
   */
  fillWithWordLettersOnly?: boolean;

  // Visibility
  hideWordList: boolean;

  // Word Source
  selectWordListOption: 'manual' | 'ai';

  // AI Generation
  aiTheme: string;
  aiLanguage: string;
  aiAgeLevel: string;
  aiMaxWordLength: number;

  // List Formatting
  wordListFontFamily: string;
  wordListFontSize: number;
  wordListCase: 'upper' | 'lower' | 'title';

  // Layout
  wordListDirection: 'vertical' | 'horizontal';
  wordListColumns: number;
  wordSpacingHorizontal: number;
  wordSpacingVertical: number;
  /** @deprecated Migrated to wordSpacingHorizontal / wordSpacingVertical */
  wordListGap?: number;

  // Modifiers
  dontAlphabetize: boolean;
  addCheckboxes: boolean;
  addSpaceForGraphics: boolean;
  includeTitleAboveList: boolean;
}

// Color Settings
export interface PuzzlePageColors {
  backgroundColor: string;
  titleColor: string;
  subtitleColor: string;
  boxColor: string;
  /** Color of inner cell grid lines (puzzle pages). */
  gridLinesColor?: string;
  puzzleColor: string;
  /** Outline color for puzzle grid letters (0 thickness = no stroke). */
  puzzleLetterStrokeColor?: string;
  /** Stroke thickness for puzzle grid letters in CSS px. */
  puzzleLetterStrokeThickness?: number;
  wordListTitleColor: string;
  wordListColor: string;
  backgroundImage?: string;
  backgroundImageOpacity?: number;
  backgroundImageFit?: 'cover' | 'contain' | 'stretch';
  backgroundImageFrameEnabled?: boolean;
  backgroundImageFrameMargin?: number; // margin in inches where background shows through (default 0.56)
  /** Modular header: independent number / title / subtitle shapes */
  headerAssembly?: HeaderAssemblySettings;
}

export interface AnswerPageColors {
  backgroundColor: string;
  titleColor: string;
  boxColor: string;
  lettersInSolutionColor: string;
  lettersNotInSolutionColor: string;
  backgroundImage?: string;
  backgroundImageOpacity?: number;
  backgroundImageFit?: 'cover' | 'contain' | 'stretch';
  backgroundImageFrameEnabled?: boolean;
  backgroundImageFrameMargin?: number; // margin in inches where background shows through (default 0.56)

  // Solution Display Mode (fixed to line-highlight)
  
  // Solution Stroke/Frame Settings
  solutionStrokeThickness: number; // 1-30px — highlight bar body thickness
  solutionStrokePadding: number; // padding between letters and stroke
  solutionFrameColor: string; // highlight fill color (overridable per word)
  /** Outline color for highlight capsules (0 thickness = no outline). */
  solutionHighlightStrokeColor?: string;
  /** Outline thickness for highlight capsules in CSS px. */
  solutionHighlightStrokeThickness?: number;
  solutionFrameStyle: 'rounded' | 'square' | 'circle'; // style of the frame
  solutionFrameRadius: number; // border radius for rounded style (0-50)
  // Highlight mode fixed to box-frame, Line caps fixed to round (rounded ends)

  // Line highlight transparency (0-100). 100 = opaque, 0 = invisible. Default: 30
  solutionHighlightAlpha: number;

  // Answer Page Title
  answerTitlePrefix: string; // e.g., "Solution", "Key:", "Answer"
  answerTitleFontFamily: string;
  answerTitleFontSize: number;
  answerTitleAlignment: 'left' | 'center' | 'right';
  showAnswerNumber: boolean;
}

export interface ColorSettings {
  puzzlePage: PuzzlePageColors;
  answerPage: AnswerPageColors;
}

/** Global page container frame (Color Settings tab) — separate from grid border. */
export interface PageFrameSettings {
  enabled: boolean;
  marginSizeIn: number;
  cornerRadiusPx: number;
  strokeThicknessPx: number;
  borderColor: string;
}

// Combined Word Search Settings
export interface WordSearchSettings {
  bookCanvas: BookCanvasSettings;
  core: WordSearchCoreSettings;
  typography: TypographySpacingSettings;
  wordList: WordListSettings;
  colors: ColorSettings;
  /** Global page margin / container frame for puzzle and solution pages. */
  pageFrameSettings?: PageFrameSettings;
}

// Book/Export Settings (Legacy/General)
export interface BookSettings {
  trimSize: TrimSize;
  includeBleed: boolean;
  includeSolution: boolean;
  puzzlesPerPage: number;
  /**
   * When true, compile/export interleaves puzzle types within each chapter:
   * word search #1, crossword #1, scramble #1, … then #2 of each type, etc.
   */
  mixPuzzles?: boolean;
  /** Thematic chapter topics from AI by-chapter generation (used when mixing). */
  chapterTopics?: string[];
}

export type TrimSize =
  | '5x8'
  | '6x9'
  | '8.5x11'
  | '9x12'
  | 'kindle-scribe'
  | 'custom';

export const TRIM_SIZES: Record<TrimSize, { width: number; height: number; label: string }> = {
  '5x8': { width: 5, height: 8, label: '5" x 8" (Novel)' },
  '6x9': { width: 6, height: 9, label: '6" x 9" (Book)' },
  '8.5x11': { width: 8.5, height: 11, label: '8.5" x 11" (Letter)' },
  '9x12': { width: 9, height: 12, label: '9" x 12" (Large)' },
  'kindle-scribe': { width: 10.3, height: 14.2, label: 'Kindle Scribe' },
  'custom': { width: 8.5, height: 11, label: 'Custom Size' },
};

// Puzzle Settings (General)
export interface PuzzleSettings {
  gridSize: number;
  directions: Direction[];
  puzzleDensity: number;
}

// Title/Words Settings (General)
export interface TitleWordsSettings {
  title: string;
  fontFamily: string;
  fontSize: number;
  words: string[];
}

// Word Search Specific
export interface WordSearchPuzzle {
  type: 'word-search';
  grid: string[][];
  placements: WordPlacement[];
  words: string[];
  displayWords: string[]; // Original words with spaces preserved for display
  solution: Map<string, Position[]>;
  /**
   * When set, true cells are inside the silhouette (letters); false = outside (blank).
   * Outside cells in `grid` are left as empty strings.
   */
  shapeMask?: boolean[][];
  puzzleNumber?: number;
  /** 0-based index within the source document (for fun facts / custom titles). */
  puzzleIndexInDocument?: number;
  /** Source document module id (multi-document book builder) */
  pageId?: string;
  pageName?: string;
  /** 0-based thematic chapter when generated as mixed-per-chapter. */
  chapterIndex?: number;
}

// Batch Puzzle for preview
export interface BatchPuzzle {
  puzzle: WordSearchPuzzle;
  pageIndex: number;
  puzzleNumber: number;
}

// Crossword Specific
export interface CrosswordCell {
  letter?: string;
  isBlack: boolean;
  clueNumber?: number;
}

export interface CrosswordPuzzle {
  type: 'crossword';
  grid: CrosswordCell[][];
  acrossClues: { number: number; clue: string; answer: string }[];
  downClues: { number: number; clue: string; answer: string }[];
  puzzleNumber?: number;
  /** 0-based index within the source document. */
  puzzleIndexInDocument?: number;
  /** Source document module id */
  pageId?: string;
  pageName?: string;
  /** 0-based thematic chapter when generated as mixed-per-chapter. */
  chapterIndex?: number;
}

/** Shared batch metadata for puzzles that belong to a document tab. */
export interface DocumentBatchPuzzleMeta {
  puzzleNumber?: number;
  /** 0-based index within the source document. */
  puzzleIndexInDocument?: number;
  /** Source document module id */
  pageId?: string;
  pageName?: string;
  /** 0-based thematic chapter when generated as mixed-per-chapter. */
  chapterIndex?: number;
}

/** Arithmetic operation shown on a Calcudoku cage. */
export type CalcudokuOperation = '+' | '-' | '*' | '/';

export interface CalcudokuCage {
  id: string;
  cells: Position[];
  operation: CalcudokuOperation;
  target: number;
}

export type SudokuVariant = 'standard' | 'calcudoku';

// Sudoku Specific
export interface SudokuPuzzle extends DocumentBatchPuzzleMeta {
  type: 'sudoku';
  grid: number[][];
  solution: number[][];
  difficulty: Difficulty;
  /**
   * Board size (cells per side). Defaults to 9 when missing on older projects.
   * Standard Sudoku uses 4/6/9/12/16/25; Calcudoku uses 4–9.
   */
  size?: number;
  /** Absent or `standard` on older saved puzzles. */
  variant?: SudokuVariant;
  /** Present when variant is calcudoku. */
  cages?: CalcudokuCage[];
  seed?: number;
}

// Cryptogram Specific
export interface CryptogramPuzzle extends DocumentBatchPuzzleMeta {
  type: 'cryptogram';
  originalText: string;
  encodedText: string;
  /** cipher token -> original letter */
  letterMapping: Record<string, string>;
  /** Letter tokens (A-Z) or number tokens ("1".."26"). */
  cipherType?: 'letters' | 'numbers';
  /** Original letters revealed as hints in the on-page answer key. */
  hintLetters?: string[];
}

// Word Scramble Specific
export interface WordScramblePuzzle extends DocumentBatchPuzzleMeta {
  type: 'word-scramble';
  words: { original: string; scrambled: string }[];
}

// Trivia Specific (re-exported shape; full helpers live in ./trivia)
export interface TriviaPuzzle extends DocumentBatchPuzzleMeta {
  type: 'trivia';
  questions: Array<{
    prompt: string;
    suggestions: string[];
    answer: string;
    answerIndex: number;
  }>;
}

export type MazeShape = 'square' | 'circle' | 'triangle' | 'diamond' | 'hexagon';
export type MazeStartSide = 'left' | 'middle' | 'right' | 'mixed';
export type MazeEndSide = 'bottom' | 'middle' | 'left' | 'right' | 'mixed';
export type MazeMarkerStyle = 'point' | 'arrow' | 'image';
/** How the maze solution guide path is stroked. */
export type MazeSolutionPathStyle = 'solid' | 'dashed' | 'dotted';

/** Shapes ordered easy → hard for mixed-shape books. */
export const MAZE_SHAPE_DIFFICULTY_ORDER: Array<{
  shape: MazeShape;
  level: string;
  label: string;
}> = [
  { shape: 'square', level: 'Easy', label: 'Square' },
  { shape: 'circle', level: 'Easy–Medium', label: 'Circle' },
  { shape: 'diamond', level: 'Medium', label: 'Diamond' },
  { shape: 'hexagon', level: 'Medium–Hard', label: 'Hexagon' },
  { shape: 'triangle', level: 'Hard', label: 'Triangle' },
];

/** Split N puzzles across the easy→hard shape ladder. */
export function allocateMixedMazeShapes(count: number): Array<{
  shape: MazeShape;
  level: string;
  label: string;
  count: number;
}> {
  const n = Math.max(0, Math.round(count));
  const levels = MAZE_SHAPE_DIFFICULTY_ORDER;
  const base = Math.floor(n / levels.length);
  let rem = n % levels.length;
  return levels.map((entry) => {
    const extra = rem > 0 ? 1 : 0;
    if (rem > 0) rem -= 1;
    return { ...entry, count: base + extra };
  });
}

// Maze Specific
export interface MazePuzzle extends DocumentBatchPuzzleMeta {
  type: 'maze';
  grid: boolean[][];
  start: Position;
  end: Position;
  size: 'small' | 'medium' | 'large' | 'xl';
  /** Actual logical cell count used (max side when rectangular). */
  gridSize?: number;
  /** Logical rows (length). */
  gridLength?: number;
  /** Logical columns (width). */
  gridWidth?: number;
  /** Difficulty: easy/medium ≈ turn count; hard ≈ longer route. */
  difficulty?: Difficulty;
  /** Overall silhouette of the maze (default rectangle/square). */
  shape?: MazeShape;
  /** Wall-grid cells outside the maze silhouette (not drawn). */
  outside?: boolean[][];
  /** Unique path from start to end (cell coordinates in the wall grid). */
  solutionPath?: Position[];
}

/** Puzzle types that use the generic document-module pipeline. */
export type GenericBatchPuzzle =
  | SudokuPuzzle
  | MazePuzzle
  | CryptogramPuzzle
  | WordScramblePuzzle
  | TriviaPuzzle;

// Word Match Specific
export interface WordMatchPuzzle {
  type: 'word-match';
  leftColumn: string[];
  rightColumn: string[];
}

// Dot-to-Dot Specific
export interface DotToDotPuzzle {
  type: 'dot-to-dot';
  points: Position[];
  labels: string[];
  connections: number[][];
}

// Combined Puzzle Type
export type Puzzle =
  | WordSearchPuzzle
  | CrosswordPuzzle
  | SudokuPuzzle
  | CryptogramPuzzle
  | WordScramblePuzzle
  | TriviaPuzzle
  | MazePuzzle
  | WordMatchPuzzle
  | DotToDotPuzzle
  | import('./murdoku').MurdokuPuzzle;

export type { MurdokuPuzzle } from './murdoku';

// Saved Puzzle
export interface SavedPuzzle {
  id: string;
  type: PuzzleType;
  name: string;
  createdAt: number;
  puzzle: Puzzle;
  settings: {
    book: BookSettings;
    puzzle: PuzzleSettings;
    titleWords: TitleWordsSettings;
    colors: ColorSettings;
    wordSearch?: WordSearchSettings;
  };
}

// Default Word Search Settings
export function getDefaultWordSearchSettings(): WordSearchSettings {
  return {
    bookCanvas: {
      includeBleed: false,
      useCustomTrim: false,
      customWidth: 8.5,
      customHeight: 11,
      trimSizePreset: '8_5X11IN',
      measurementUnits: 'INCHES',
      puzzleType: 'word-search',
      answersPerPage: 4,
      includePageBetweenPuzzleAndSolutions: false,
    },
    core: {
      numberOfPuzzles: 1,
      puzzlesStartingNumber: 1,
      twoPagePuzzles: false,
      lettersAcross: 15,
      lettersDown: 15,
      autoBalanceGrid: false,
      autoBalanceFont: false,
      shapeWordSearchEnabled: false,
      shapeMaskMode: 'common',
      shapeMaskImage: undefined,
      shapeMaskImages: [],
      shapeMaskAlphaThreshold: 40,
      shapeMaskFit: 'contain',
      shapeMaskShowImage: false,
      shapeMaskImageOpacity: 35,
      allowUp: false,
      allowDown: true,
      allowLeft: false,
      allowRight: true,
      allowDiagonalUp: true,
      allowDiagonalDown: true,
      allowDiagonalUpReverse: false,
      allowDiagonalDownReverse: false,
      noBoxAroundPuzzle: false,
      addGridLines: false,
      borderStrokeThickness: 2,
      borderCornerRadius: 4,
      gridBorderPadding: 8,
      solutionBorderStrokeThickness: 2,
      solutionBorderCornerRadius: 4,
      solutionGridBorderPadding: 8,
      gridLinesStrokeThickness: 0,
      innerGridOpacity: 0,
        // customLetters removed
    },
    typography: {
      selectTitleOption: 'puzzle-number',
      titleText: 'Word Search',
      puzzleNumberingStyle: 'none',
      pageNumber: { ...DEFAULT_PAGE_NUMBER_SETTINGS },
      solutionTitleStyle: 'same_as_puzzle',
      customSolutionTitle: 'Solutions',
      solutionNumberingStyle: 'none',
      includeFunFacts: false,
      funFactsText: '',
      subtitleFontSize: 14,
      subtitleFontFamily: 'Arial',
      subtitleTextScale: 500,
      subtitleMaxWidthPercent: 100,
      subtitleBoxMargin: 0,
      subtitleToTitleGap: 10,
      subtitleToPuzzleGap: 10,
      puzzleTitleFontFamily: 'Arial',
      puzzleTitleFontSize: 24,
      answerTitleFontSize: 18,
      titleStartAt: DEFAULT_TITLE_START_AT,
      spaceBetweenTitleAndPuzzle: 20,
      spaceBetweenTitleAndAnswer: 20,
      puzzleGridCase: 'upper',
      puzzleGridFontFamily: 'Arial',
        puzzleGridFontSize: 18,
      // Manual Letter Calibration Offsets
      uiOffsetX: 0,
      uiOffsetY: 0,
      pdfOffsetX: 0,
      pdfOffsetY: 0,
      setFontForAnswerPages: false,
      answerGridFontFamily: 'Arial',
      setFontSizeForAnswerPages: false,
      answerGridFontSize: 18,
      spaceBetweenPuzzleAndWordList: 20,
    },
    wordList: {
      wordsPerPuzzle: 10,
      oneWordPerPuzzle: false,
      wordRepeatCount: 5,
      fillWithWordLettersOnly: false,
      hideWordList: false,
      selectWordListOption: 'manual',
      aiTheme: '',
      aiLanguage: 'English',
      aiAgeLevel: 'Adult',
      aiMaxWordLength: 10,
      wordListFontFamily: 'Arial',
      wordListFontSize: 18,
      wordListCase: 'upper',
      wordListDirection: 'vertical',
      wordListColumns: 2,
      wordSpacingHorizontal: 50,
      wordSpacingVertical: 8,
      dontAlphabetize: false,
      addCheckboxes: false,
      addSpaceForGraphics: false,
      includeTitleAboveList: true,
    },
    colors: {
      puzzlePage: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        subtitleColor: '#6b7280',
        boxColor: '#1f2937',
        gridLinesColor: '#d1d5db',
        puzzleColor: '#1f2937',
        puzzleLetterStrokeColor: '#000000',
        puzzleLetterStrokeThickness: 0,
        wordListTitleColor: '#374151',
        wordListColor: '#4b5563',
        backgroundImage: undefined,
        backgroundImageOpacity: 100,
        backgroundImageFit: 'cover',
        backgroundImageFrameEnabled: true,
        backgroundImageFrameMargin: 0.56,
        headerAssembly: { ...DEFAULT_HEADER_ASSEMBLY },
      },
      answerPage: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        boxColor: '#1f2937',
        lettersInSolutionColor: '#000000',
        lettersNotInSolutionColor: '#000000',
        solutionStrokeThickness: 12,
        solutionStrokePadding: 0,
        solutionFrameColor: '#000000',
        solutionHighlightStrokeColor: '#000000',
        solutionHighlightStrokeThickness: 0,
        solutionFrameStyle: 'rounded',
        solutionFrameRadius: 4,
        solutionHighlightAlpha: 30,
        answerTitlePrefix: 'Solution',
        answerTitleFontFamily: 'Arial',
        answerTitleFontSize: 20,
        answerTitleAlignment: 'center',
        showAnswerNumber: true,
        backgroundImage: undefined,
        backgroundImageOpacity: 100,
        backgroundImageFit: 'cover',
        backgroundImageFrameEnabled: true,
        backgroundImageFrameMargin: 0.56,
      },
    },
    pageFrameSettings: {
      enabled: true,
      marginSizeIn: 0.56,
      cornerRadiusPx: 4,
      strokeThicknessPx: 2,
      borderColor: '#1f2937',
    },
  };
}
