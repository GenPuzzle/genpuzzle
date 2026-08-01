/**
 * Crossword document settings — left pane (generation) + right pane (visual/layout).
 * Defaults avoid pure black (#000000) so coloring-page exports stay printable.
 */

import type { BookCanvasSettings, PageFrameSettings } from './puzzles/types';
import { DEFAULT_PAGE_NUMBER_SETTINGS } from './puzzles/types';

export type CrosswordAnswerCase = 'upper' | 'lower' | 'original';
export type CrosswordTitleOption = 'title-number' | 'different-titles';
export type CrosswordClueLayout = 'single' | 'double';

export interface CrosswordCoreSettings {
  numberOfPuzzles: number;
  puzzlesStartingNumber: number;
  cluesPerPuzzle: number;
  lettersAcross: number;
  lettersDown: number;
  /** Puzzle size as percent of page (20–80). */
  puzzleSizePercent: number;
  answerCase: CrosswordAnswerCase;
  twoPagePuzzles: boolean;
  allowNumbersInAnswers: boolean;
  kidsMode: boolean;
  useAiClues: boolean;
  /** One theme per line. */
  themes: string;
  language: string;
  ageLevel: string;
  maxClueCharacters: number;
  maxAnswerLength: number;
}

export interface CrosswordTypographySettings {
  selectTitleOption: CrosswordTitleOption;
  titleText: string;
  /** One title per line when selectTitleOption === 'different-titles'. */
  differentTitles: string;
  puzzleTitleFontFamily: string;
  puzzleTitleFontSize: number;
  answerTitleFontSize: number;
  /** Inches from top of page. */
  titleStartAt: number;
  spaceBetweenTitleAndPuzzle: number;
  spaceBetweenTitleAndAnswer: number;
  clueFontFamily: string;
  clueFontSize: number;
  clueLayout: CrosswordClueLayout;
  numberFontFamily: string;
  numberFontSizePuzzle: number;
  numberFontSizeAnswers: number;
  pageNumber: typeof DEFAULT_PAGE_NUMBER_SETTINGS;
  includePageNumbers: boolean;
}

export interface CrosswordColorSettings {
  backgroundColor: string;
  lineColor: string;
  titleColor: string;
  cluesColor: string;
  numbersColor: string;
  answersColor: string;
  hintLettersColor: string;
  /** 0–255; empty square lightness (255 = white). */
  squareColorRange: number;
  blackSquareColor: string;
}

export interface CrosswordSettings {
  bookCanvas: BookCanvasSettings;
  core: CrosswordCoreSettings;
  typography: CrosswordTypographySettings;
  colors: CrosswordColorSettings;
  pageFrameSettings?: PageFrameSettings;
}

export function getDefaultCrosswordSettings(): CrosswordSettings {
  return {
    bookCanvas: {
      includeBleed: false,
      useCustomTrim: false,
      customWidth: 8.5,
      customHeight: 11,
      trimSizePreset: '8_5X11IN',
      measurementUnits: 'INCHES',
      puzzleType: 'crossword',
      answersPerPage: 1,
      includePageBetweenPuzzleAndSolutions: false,
    },
    core: {
      numberOfPuzzles: 10,
      puzzlesStartingNumber: 1,
      cluesPerPuzzle: 15,
      lettersAcross: 15,
      lettersDown: 13,
      puzzleSizePercent: 60,
      answerCase: 'upper',
      twoPagePuzzles: false,
      allowNumbersInAnswers: false,
      kidsMode: false,
      useAiClues: false,
      themes: '',
      language: 'English',
      ageLevel: 'Adult',
      maxClueCharacters: 20,
      maxAnswerLength: 15,
    },
    typography: {
      selectTitleOption: 'title-number',
      titleText: 'Crossword',
      differentTitles: '',
      puzzleTitleFontFamily: 'Roboto',
      puzzleTitleFontSize: 24,
      answerTitleFontSize: 18,
      titleStartAt: 0.5,
      spaceBetweenTitleAndPuzzle: 0.3,
      spaceBetweenTitleAndAnswer: 0.3,
      clueFontFamily: 'Roboto',
      clueFontSize: 11,
      clueLayout: 'double',
      numberFontFamily: 'Roboto',
      numberFontSizePuzzle: 8,
      numberFontSizeAnswers: 8,
      pageNumber: { ...DEFAULT_PAGE_NUMBER_SETTINGS },
      includePageNumbers: true,
    },
    // Coloring-page safe defaults — avoid pure #000000 fills/strokes.
    colors: {
      backgroundColor: '#ffffff',
      lineColor: '#cccccc',
      titleColor: '#333333',
      cluesColor: '#333333',
      numbersColor: '#333333',
      answersColor: '#333333',
      hintLettersColor: '#333333',
      squareColorRange: 255,
      blackSquareColor: '#cccccc',
    },
    pageFrameSettings: {
      enabled: true,
      marginSizeIn: 0.5,
      cornerRadiusPx: 0,
      strokeThicknessPx: 1,
      borderColor: '#cccccc',
    },
  };
}
