// Puzzle Types and Interfaces

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
export interface BookCanvasSettings {
  // Custom Trim
  useCustomTrim: boolean;
  customWidth: number;
  customHeight: number;

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
  allowNumbersInGrid: boolean;
  twoPagePuzzles: boolean;

  // Custom Letters
  customLetters: string;
}

// Typography & Spacing Settings
export interface TypographySpacingSettings {
  // Title Options
  selectTitleOption: 'puzzle-number' | 'custom' | 'none';
  titleText: string;
  includeSubtitle: boolean;
  subtitleText: string;

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

  // Answer Page Grid
  setFontForAnswerPages: boolean;
  answerGridFontFamily: string;
  setFontSizeForAnswerPages: boolean;
  answerGridFontSize: number;

  // Layout
  spaceBetweenPuzzleAndWordList: number;
}

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
}

export interface AnswerPageColors {
  backgroundColor: string;
  titleColor: string;
  boxColor: string;
  lettersInSolutionColor: string;
  lettersNotInSolutionColor: string;

  // Solution Stroke/Frame Settings
  solutionStrokeThickness: number; // 1-5px
  solutionStrokePadding: number; // padding between letters and stroke
  solutionFrameColor: string; // color of the highlight frame
  solutionFrameStyle: 'rounded' | 'square' | 'circle'; // style of the frame
  solutionFrameRadius: number; // border radius for rounded style (0-50)
  onlyHighlightWordListWords: boolean; // only highlight words that are in the word list

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

// Combined Word Search Settings
export interface WordSearchSettings {
  bookCanvas: BookCanvasSettings;
  core: WordSearchCoreSettings;
  typography: TypographySpacingSettings;
  wordList: WordListSettings;
  colors: ColorSettings;
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
  solution: Map<string, Position[]>;
  puzzleNumber?: number;
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
      useCustomTrim: false,
      customWidth: 8.5,
      customHeight: 11,
      puzzleType: 'word-search',
      answersPerPage: 1,
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
      addGridLines: false,
      allowNumbersInGrid: false,
      twoPagePuzzles: false,
      customLetters: '',
    },
    typography: {
      selectTitleOption: 'puzzle-number',
      titleText: 'Word Search',
      includeSubtitle: false,
      subtitleText: '',
      puzzleTitleFontFamily: 'Inter',
      puzzleTitleFontSize: 24,
      answerTitleFontSize: 18,
      titleStartAt: 50,
      spaceBetweenTitleAndPuzzle: 20,
      spaceBetweenTitleAndAnswer: 20,
      puzzleGridCase: 'upper',
      puzzleGridFontFamily: 'Inter',
      puzzleGridFontSize: 14,
      setFontForAnswerPages: false,
      answerGridFontFamily: 'Inter',
      setFontSizeForAnswerPages: false,
      answerGridFontSize: 12,
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
      wordListFontFamily: 'Inter',
      wordListFontSize: 12,
      wordListCase: 'upper',
      wordListDirection: 'vertical',
      wordListColumns: 2,
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
      },
      answerPage: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        boxColor: '#1f2937',
        lettersInSolutionColor: '#000000',
        lettersNotInSolutionColor: '#000000',
        solutionStrokeThickness: 2,
        solutionStrokePadding: 0,
        solutionFrameColor: '#000000',
        solutionFrameStyle: 'rounded',
        solutionFrameRadius: 4,
        onlyHighlightWordListWords: true,
        answerTitlePrefix: 'Solution',
        answerTitleFontFamily: 'Inter',
        answerTitleFontSize: 20,
        answerTitleAlignment: 'center',
        showAnswerNumber: true,
      },
    },
  };
}
