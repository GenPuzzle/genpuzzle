/**
 * Crossword document settings — left pane (generation) + right pane (visual/layout).
 * Defaults avoid pure black (#000000) so coloring-page exports stay printable.
 * Title / subtitle / solution controls mirror word-search document settings.
 */

import type { BookCanvasSettings, PageFrameSettings } from './puzzles/types';
import { DEFAULT_PAGE_NUMBER_SETTINGS } from './puzzles/types';
import { uppercaseWordSearchWord } from './puzzles/word-search-letters';

export const INTERIOR_LIGHT_GREY_FILL = '#e0e0e0';

export type CrosswordAnswerCase = 'upper' | 'lower' | 'original';
/** Aligns with word-search title modes; legacy values kept for saved projects. */
export type CrosswordTitleOption =
  | 'title-number'
  | 'one-custom-title'
  | 'custom'
  | 'different-titles'
  | 'none';
export type CrosswordClueLayout = 'single' | 'double';
export type CrosswordNumberingStyle = 'none' | 'prefix' | 'suffix';
export type CrosswordSolutionTitleStyle = 'same_as_puzzle' | 'custom';

export interface CrosswordCoreSettings {
  numberOfPuzzles: number;
  puzzlesStartingNumber: number;
  cluesPerPuzzle: number;
  /**
   * When true, keep searching until each puzzle has exactly `cluesPerPuzzle`
   * placed clues. This can take much longer.
   */
  exactClueCount: boolean;
  lettersAcross: number;
  lettersDown: number;
  /**
   * Puzzle size as percent of page (20–80).
   */
  puzzleSizePercent: number;
  /**
   * Puzzle-page grid scale (50–200%). Independent from word search and from solution scale.
   */
  puzzleGridScale: number;
  /**
   * Solution-page grid scale (50–200%). Independent from puzzle-page grid scale.
   */
  solutionGridScale: number;
  answerCase: CrosswordAnswerCase;
  twoPagePuzzles: boolean;
  allowNumbersInAnswers: boolean;
  kidsMode: boolean;
  useAiClues: boolean;
  /** One theme per line (AI). */
  themes: string;
  language: string;
  ageLevel: string;
  maxClueCharacters: number;
  maxAnswerLength: number;
  /** Manual clues — one clue per line (paired with answers by index). */
  cluesText: string;
  /** Manual answers — one answer per line (paired with clues by index). */
  answersText: string;
  /** When true, grid scale is fitted to the page safe area + page-number zone. */
  autoBalanceGrid: boolean;
  /** When true, title/clue/grid fonts are fitted so text stays inside the page. */
  autoBalanceFont: boolean;
}

export interface CrosswordTypographySettings {
  selectTitleOption: CrosswordTitleOption;
  titleText: string;
  /** One title per line when selectTitleOption is custom / different-titles. */
  differentTitles: string;
  puzzleNumberingStyle: CrosswordNumberingStyle;
  solutionTitleStyle: CrosswordSolutionTitleStyle;
  customSolutionTitle: string;
  solutionNumberingStyle: CrosswordNumberingStyle;
  includeFunFacts: boolean;
  funFactsText: string;
  subtitleFontSize: number;
  subtitleFontFamily: string;
  subtitleBoxMargin: number;
  subtitleToTitleGap: number;
  subtitleToPuzzleGap: number;
  puzzleTitleFontFamily: string;
  puzzleTitleFontSize: number;
  answerTitleFontSize: number;
  /** Inches from top of page. */
  titleStartAt: number;
  spaceBetweenTitleAndPuzzle: number;
  spaceBetweenTitleAndAnswer: number;
  /** Solution layout: title → grid gap (px), mirrors word-search Title to Answer. */
  titleToAnswerGapPx: number;
  /** Solution layout: gap between solution blocks (px). */
  solutionToSolutionGapPx: number;
  /** Solution page margin inset (px). */
  solutionPageMarginPx: number;
  /** Gap between crossword grid and Across/Down clue lists (inches). */
  spaceBetweenPuzzleAndClues: number;
  /** Vertical gap between clue lines (px). */
  clueSpaceVertical: number;
  /** Horizontal gap between Across/Down columns (px). */
  clueSpaceHorizontal: number;
  clueFontFamily: string;
  clueFontSize: number;
  clueLayout: CrosswordClueLayout;
  acrossDownFontFamily: string;
  acrossDownFontSize: number;
  numberFontFamily: string;
  numberFontSizePuzzle: number;
  numberFontSizeAnswers: number;
  /** Solution letter size inside grid cells (pt-like CSS px baseline). */
  gridLetterFontSize: number;
  /**
   * Show the answer key (numbered Across/Down words) under each solution grid.
   * Answers are listed as "1.WORD  4.WORD" — never pipe-separated.
   */
  showAnswerKey: boolean;
  /** Font size for the answer key under each solution (pt). */
  answerKeyFontSize: number;
  pageNumber: typeof DEFAULT_PAGE_NUMBER_SETTINGS;
  includePageNumbers: boolean;
}

export interface CrosswordColorSettings {
  backgroundColor: string;
  lineColor: string;
  /** Stroke thickness for letter-box borders (CSS px). */
  lineThicknessPx: number;
  titleColor: string;
  subtitleColor: string;
  cluesColor: string;
  numbersColor: string;
  answersColor: string;
  hintLettersColor: string;
  /** 0–255; empty square lightness (255 = white). */
  squareColorRange: number;
  /**
   * Blocked/unused square greyscale: 0 = white, 255 = black.
   * Default 255 (solid black).
   */
  blackSquareGreyscale: number;
  /** When true, unused/blocked boxes are fully transparent (no fill, no border). */
  unusedBoxesTransparent: boolean;
  /** Derived/legacy hex for blocked squares (kept in sync from greyscale). */
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
      exactClueCount: false,
      lettersAcross: 15,
      lettersDown: 13,
      puzzleSizePercent: 60,
      puzzleGridScale: 130,
      solutionGridScale: 100,
      answerCase: 'upper',
      twoPagePuzzles: false,
      allowNumbersInAnswers: false,
      kidsMode: false,
      useAiClues: false,
      themes: '',
      language: 'English',
      ageLevel: 'Adult',
      maxClueCharacters: 300,
      maxAnswerLength: 30,
      cluesText: '',
      answersText: '',
      autoBalanceGrid: false,
      autoBalanceFont: false,
    },
    typography: {
      selectTitleOption: 'custom',
      titleText: 'Crossword',
      differentTitles: '',
      puzzleNumberingStyle: 'prefix',
      solutionTitleStyle: 'same_as_puzzle',
      customSolutionTitle: 'Solution',
      solutionNumberingStyle: 'none',
      includeFunFacts: false,
      funFactsText: '',
      subtitleFontSize: 14,
      subtitleFontFamily: 'Arial',
      subtitleBoxMargin: 0,
      subtitleToTitleGap: 0.1,
      subtitleToPuzzleGap: 0.15,
      puzzleTitleFontFamily: 'Arial',
      puzzleTitleFontSize: 24,
      answerTitleFontSize: 18,
      titleStartAt: 0.5,
      spaceBetweenTitleAndPuzzle: 0.3,
      spaceBetweenTitleAndAnswer: 0.3,
      titleToAnswerGapPx: 10,
      solutionToSolutionGapPx: 14,
      solutionPageMarginPx: 40,
      spaceBetweenPuzzleAndClues: 0.25,
      clueSpaceVertical: 4,
      clueSpaceHorizontal: 24,
      clueFontFamily: 'Arial',
      clueFontSize: 20,
      clueLayout: 'double',
      acrossDownFontFamily: 'Arial',
      acrossDownFontSize: 14,
      numberFontFamily: 'Arial',
      numberFontSizePuzzle: 14,
      numberFontSizeAnswers: 14,
      gridLetterFontSize: 14,
      showAnswerKey: true,
      answerKeyFontSize: 11,
      pageNumber: { ...DEFAULT_PAGE_NUMBER_SETTINGS },
      includePageNumbers: true,
    },
    colors: {
      backgroundColor: '#ffffff',
      lineColor: '#cccccc',
      lineThicknessPx: 1,
      titleColor: '#333333',
      subtitleColor: '#555555',
      cluesColor: '#333333',
      numbersColor: '#333333',
      answersColor: '#333333',
      hintLettersColor: '#333333',
      squareColorRange: 255,
      blackSquareGreyscale: 255,
      unusedBoxesTransparent: false,
      blackSquareColor: '#000000',
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

/** Merge partial / legacy saved settings onto defaults. */
export function normalizeCrosswordSettings(
  raw: Partial<CrosswordSettings> | null | undefined
): CrosswordSettings {
  const defaults = getDefaultCrosswordSettings();
  if (!raw) return defaults;

  const core = { ...defaults.core, ...(raw.core ?? {}) };
  const typography = { ...defaults.typography, ...(raw.typography ?? {}) };
  const colors = { ...defaults.colors, ...(raw.colors ?? {}) };

  if (typeof core.autoBalanceGrid !== 'boolean') {
    core.autoBalanceGrid = false;
  }
  if (typeof core.autoBalanceFont !== 'boolean') {
    core.autoBalanceFont = false;
  }
  core.exactClueCount = core.exactClueCount === true;
  if (typeof core.maxClueCharacters !== 'number' || !Number.isFinite(core.maxClueCharacters) || core.maxClueCharacters <= 80) {
    core.maxClueCharacters = 300;
  }
  if (typeof core.maxAnswerLength !== 'number' || !Number.isFinite(core.maxAnswerLength) || core.maxAnswerLength <= 15) {
    core.maxAnswerLength = 30;
  }
  if (typeof core.puzzleGridScale !== 'number' || !Number.isFinite(core.puzzleGridScale)) {
    core.puzzleGridScale = defaults.core.puzzleGridScale;
  } else {
    core.puzzleGridScale = Math.max(50, Math.min(200, Math.round(core.puzzleGridScale)));
  }
  if (typeof core.solutionGridScale !== 'number' || !Number.isFinite(core.solutionGridScale)) {
    // Legacy projects used shared app scale — fall back to puzzle scale then default.
    core.solutionGridScale = core.puzzleGridScale || defaults.core.solutionGridScale;
  } else {
    core.solutionGridScale = Math.max(50, Math.min(200, Math.round(core.solutionGridScale)));
  }
  if (typeof typography.titleToAnswerGapPx !== 'number' || !Number.isFinite(typography.titleToAnswerGapPx)) {
    typography.titleToAnswerGapPx = defaults.typography.titleToAnswerGapPx;
  }
  if (
    typeof typography.solutionToSolutionGapPx !== 'number' ||
    !Number.isFinite(typography.solutionToSolutionGapPx)
  ) {
    typography.solutionToSolutionGapPx = defaults.typography.solutionToSolutionGapPx;
  }
  if (
    typeof typography.solutionPageMarginPx !== 'number' ||
    !Number.isFinite(typography.solutionPageMarginPx)
  ) {
    typography.solutionPageMarginPx = defaults.typography.solutionPageMarginPx;
  }
  if (typeof typography.showAnswerKey !== 'boolean') {
    typography.showAnswerKey = defaults.typography.showAnswerKey;
  }
  if (
    typeof typography.answerKeyFontSize !== 'number' ||
    !Number.isFinite(typography.answerKeyFontSize)
  ) {
    typography.answerKeyFontSize = defaults.typography.answerKeyFontSize;
  } else {
    typography.answerKeyFontSize = Math.max(
      1,
      Math.min(28, Math.round(typography.answerKeyFontSize))
    );
  }

  // Keep greyscale ↔ hex in sync (0 = white, 255 = black).
  // Migrate older docs that used 0 = black / 255 = transparent (no unusedBoxesTransparent flag).
  if (raw.colors && typeof raw.colors.blackSquareGreyscale === 'number') {
    const g = Math.max(0, Math.min(255, Math.round(raw.colors.blackSquareGreyscale)));
    if (raw.colors.unusedBoxesTransparent === undefined) {
      if (g >= 255) {
        colors.unusedBoxesTransparent = true;
        colors.blackSquareGreyscale = 255;
      } else {
        colors.unusedBoxesTransparent = false;
        colors.blackSquareGreyscale = 255 - g;
      }
    } else {
      colors.blackSquareGreyscale = g;
      colors.unusedBoxesTransparent = raw.colors.unusedBoxesTransparent === true;
    }
    colors.blackSquareColor = greyscaleToCss(colors.blackSquareGreyscale);
  } else if (raw.colors?.blackSquareColor && raw.colors.blackSquareGreyscale === undefined) {
    const hex = raw.colors.blackSquareColor.replace('#', '');
    if (hex.length >= 6) {
      const v = parseInt(hex.slice(0, 2), 16);
      if (!Number.isNaN(v)) {
        // Legacy hex: #000000 → solid black (255 in new model)
        colors.blackSquareGreyscale = v === 0 ? 255 : 255 - v;
      }
    }
    colors.blackSquareColor = greyscaleToCss(colors.blackSquareGreyscale);
  } else {
    colors.blackSquareColor = greyscaleToCss(colors.blackSquareGreyscale);
  }
  if (typeof colors.unusedBoxesTransparent !== 'boolean') {
    colors.unusedBoxesTransparent = defaults.colors.unusedBoxesTransparent;
  }
  if (typeof colors.lineThicknessPx !== 'number' || !Number.isFinite(colors.lineThicknessPx)) {
    colors.lineThicknessPx = defaults.colors.lineThicknessPx;
  } else {
    colors.lineThicknessPx = Math.max(0.5, Math.min(8, Math.round(colors.lineThicknessPx * 2) / 2));
  }

  // Legacy: different-titles → custom
  if (typography.selectTitleOption === 'different-titles') {
    typography.selectTitleOption = 'custom';
    if (!typography.titleText && typography.differentTitles) {
      typography.titleText = typography.differentTitles;
    }
  }
  // Legacy: title-number → custom + prefix (new default numbering style)
  if (typography.selectTitleOption === 'title-number') {
    typography.selectTitleOption = 'custom';
    if (typography.puzzleNumberingStyle === 'none') {
      typography.puzzleNumberingStyle = 'prefix';
    }
  }

  return {
    bookCanvas: { ...defaults.bookCanvas, ...(raw.bookCanvas ?? {}) },
    core,
    typography,
    colors,
    pageFrameSettings: raw.pageFrameSettings
      ? { ...defaults.pageFrameSettings!, ...raw.pageFrameSettings }
      : defaults.pageFrameSettings,
  };
}

/** 0 = white, 255 = black. */
export function greyscaleToCss(level: number): string {
  const g = Math.max(0, Math.min(255, Math.round(level)));
  // Map 0→255 (white) … 255→0 (black) in RGB channel.
  const channel = 255 - g;
  const hex = channel.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

/** Split textarea content into trimmed non-empty lines. */
export function parseCrosswordLines(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Clean crossword answer string by stripping spaces/symbols and converting to uppercase, preserving native accented letters. */
export function cleanCrosswordAnswer(
  raw: string | undefined | null,
  allowNumbers = false,
  language = ''
): string {
  if (!raw) return '';
  const normalized = raw.normalize('NFC');
  const upper = uppercaseWordSearchWord(normalized, language);
  const chars = Array.from(upper).filter((char) =>
    allowNumbers ? /\p{L}|\p{N}/u.test(char) : /\p{L}/u.test(char)
  );
  return chars.join('');
}

/** Pair answers with clues by index for one puzzle slice.
 * When the pool is shorter than startIndex+count, indices wrap so every puzzle
 * still receives `count` entries (needed for Update N puzzles with a shared word list).
 */
export function buildCrosswordWordClues(options: {
  answers: string[];
  clues: string[];
  startIndex: number;
  count: number;
  maxClueCharacters: number;
  maxAnswerLength: number;
  allowNumbers: boolean;
  language?: string;
}): { word: string; clue: string }[] {
  const {
    answers,
    clues,
    startIndex,
    count,
    maxClueCharacters,
    maxAnswerLength,
    allowNumbers,
    language = '',
  } = options;
  if (answers.length === 0 || count <= 0) return [];

  const pairs: { word: string; clue: string }[] = [];
  // Keep scanning the pool until we fill `count` (skip answers that sanitize empty).
  for (let i = 0; pairs.length < count && i < Math.max(count, answers.length) * 3; i++) {
    const idx = (startIndex + i) % answers.length;
    const rawAnswer = answers[idx];
    let word = cleanCrosswordAnswer(rawAnswer, allowNumbers, language);
    if (maxAnswerLength > 0 && word.length > maxAnswerLength) {
      word = word.slice(0, maxAnswerLength);
    }
    if (word.length < 3) continue;

    const clueRaw =
      (clues.length > 0 ? clues[idx % clues.length] : '') ||
      word;
    const clue =
      maxClueCharacters > 0 ? clueRaw.slice(0, maxClueCharacters) : clueRaw;
    pairs.push({ word, clue: clue || word });
  }
  return pairs;
}

export function resolveCrosswordPuzzleTitle(options: {
  typography: CrosswordTypographySettings;
  puzzleIndex: number;
  puzzlesStartingNumber: number;
  fallback?: string;
}): string {
  const { typography, puzzleIndex, puzzlesStartingNumber, fallback = 'Crossword' } = options;
  const number = puzzlesStartingNumber + puzzleIndex;

  if (typography.selectTitleOption === 'none') return '';

  let base = fallback;
  if (
    typography.selectTitleOption === 'custom' ||
    typography.selectTitleOption === 'different-titles'
  ) {
    const lines = parseCrosswordLines(
      typography.titleText || typography.differentTitles
    );
    base = lines[puzzleIndex] || lines[0] || fallback;
  } else {
    // one-custom-title / title-number
    base =
      parseCrosswordLines(typography.titleText)[0] ||
      typography.titleText?.trim() ||
      fallback;
  }

  if (typography.puzzleNumberingStyle === 'prefix') return `${number}. ${base}`;
  if (typography.puzzleNumberingStyle === 'suffix') return `${base} #${number}`;
  return base;
}

export function resolveCrosswordSolutionTitle(options: {
  typography: CrosswordTypographySettings;
  puzzleTitle: string;
  puzzleIndex: number;
  puzzlesStartingNumber: number;
  /** Used when puzzle title is blank (e.g. Title Option = None with Header Assembly). */
  fallbackTitle?: string;
}): string {
  const { typography, puzzleTitle, puzzleIndex, puzzlesStartingNumber, fallbackTitle } =
    options;
  const number = puzzlesStartingNumber + puzzleIndex;

  // Match Word Search: always emit a plain solution title (never Header Assembly).
  if (typography.solutionTitleStyle === 'same_as_puzzle') {
    const trimmed = (puzzleTitle || '').trim();
    if (trimmed) return trimmed;

    const base =
      parseCrosswordLines(typography.titleText || typography.differentTitles)[0] ||
      (fallbackTitle || '').trim() ||
      'Crossword';
    if (typography.puzzleNumberingStyle === 'prefix') return `${number}. ${base}`;
    if (typography.puzzleNumberingStyle === 'suffix') return `${base} #${number}`;
    return base;
  }

  const base = typography.customSolutionTitle?.trim() || 'Solution';
  if (typography.solutionNumberingStyle === 'prefix') return `${number}. ${base}`;
  if (typography.solutionNumberingStyle === 'suffix') return `${base} #${number}`;
  return base;
}

export function resolveCrosswordSubtitle(
  typography: CrosswordTypographySettings,
  puzzleIndex: number,
  fallbackTypography?: CrosswordTypographySettings | { includeFunFacts?: boolean; funFactsText?: string }
): string | null {
  const include = typography?.includeFunFacts ?? fallbackTypography?.includeFunFacts;
  if (!include) return null;
  const text = typography?.funFactsText || fallbackTypography?.funFactsText;
  const lines = parseCrosswordLines(text);
  return lines[puzzleIndex] || lines[0] || null;
}

