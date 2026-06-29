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
  | 'maze'
  | 'word-match'
  | 'dot-to-dot';

export type Difficulty = 'easy' | 'medium' | 'hard';

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
  | '8_27X11_69IN'
  | '8_25X6IN'
  | '8_25X8_25IN'
  | '8_5X8_5IN';

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

  // Grid Structure
  lettersAcross: number;
  lettersDown: number;

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

export const DEFAULT_PAGE_NUMBER_SETTINGS: PageNumberSettings = {
  enabled: false,
  startNumberingFrom: 1,
  startAtPage: 1,
  position: 'bottom-center',
  shape: { ...DEFAULT_HEADER_ASSEMBLY.number },
  textColor: '#ffffff',
  fontFamily: 'Arial',
  fontSize: 14,
  bottomOffsetPx: 12,
  sideOffsetPx: 12,
};

// Word List Settings
export interface WordListSettings {
  // Words Per Puzzle
  wordsPerPuzzle: number;

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
  puzzleColor: string;
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
  solutionStrokeThickness: number; // 1-15px
  solutionStrokePadding: number; // padding between letters and stroke
  solutionFrameColor: string; // default color of the highlight frame (overridable per word)
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
  puzzleNumber?: number;
  /** 0-based index within the source document (for fun facts / custom titles). */
  puzzleIndexInDocument?: number;
  /** Source document module id (multi-document book builder) */
  pageId?: string;
  pageName?: string;
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
}

// Sudoku Specific
export interface SudokuPuzzle {
  type: 'sudoku';
  grid: number[][];
  solution: number[][];
  difficulty: Difficulty;
}

// Cryptogram Specific
export interface CryptogramPuzzle {
  type: 'cryptogram';
  originalText: string;
  encodedText: string;
  letterMapping: Record<string, string>;
}

// Word Scramble Specific
export interface WordScramblePuzzle {
  type: 'word-scramble';
  words: { original: string; scrambled: string }[];
}

// Maze Specific
export interface MazePuzzle {
  type: 'maze';
  grid: boolean[][];
  start: Position;
  end: Position;
  size: 'small' | 'medium' | 'large' | 'xl';
}

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
  | MazePuzzle
  | WordMatchPuzzle
  | DotToDotPuzzle;

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
      lettersAcross: 15,
      lettersDown: 15,
      allowUp: false,
      allowDown: true,
      allowLeft: false,
      allowRight: true,
      allowDiagonalUp: true,
      allowDiagonalDown: true,
      allowDiagonalUpReverse: false,
      allowDiagonalDownReverse: false,
      noBoxAroundPuzzle: false,
      addGridLines: true,
      borderStrokeThickness: 2,
      borderCornerRadius: 4,
      gridBorderPadding: 8,
      solutionBorderStrokeThickness: 2,
      solutionBorderCornerRadius: 4,
      solutionGridBorderPadding: 8,
      gridLinesStrokeThickness: 1,
      innerGridOpacity: 0,
        // customLetters removed
    },
    typography: {
      selectTitleOption: 'puzzle-number',
      titleText: 'Word Search',
      puzzleNumberingStyle: 'none',
      pageNumber: { ...DEFAULT_PAGE_NUMBER_SETTINGS },
      solutionTitleStyle: 'same_as_puzzle',
      customSolutionTitle: 'Solution',
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
      titleStartAt: 20,
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
        puzzleColor: '#1f2937',
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
