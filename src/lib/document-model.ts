'use client';

import {
  PuzzleType,
  BookSettings,
  PuzzleSettings,
  TitleWordsSettings,
  ColorSettings,
  WordSearchSettings,
  getDefaultWordSearchSettings,
} from './puzzles/types';

export type DocumentModuleCategory = 'front-matter' | 'puzzle';

export type DocumentModuleType =
  | 'title-page'
  | 'table-of-contents'
  | 'copyright'
  | 'cta'
  | 'introduction'
  | 'instructions'
  | 'word-search'
  | 'sudoku'
  | 'crossword'
  | 'maze'
  | 'cryptogram'
  | 'word-scramble';

export type PuzzleModuleType = Extract<
  DocumentModuleType,
  'word-search' | 'sudoku' | 'crossword' | 'maze' | 'cryptogram' | 'word-scramble'
>;

export interface BaseModuleSettings {
  id: string;
  title: string;
  description?: string;
}

export interface TextModuleSettings extends BaseModuleSettings {
  content: string;
  fontFamily: string;
  fontSize: number;
  alignment: 'left' | 'center' | 'right';
  /** TOC-only: auto-build from compiled book map */
  tocMode?: 'auto' | 'manual';
}

export interface PuzzleModuleSettings extends BaseModuleSettings {
  puzzleType: PuzzleType;
  titleWords: TitleWordsSettings;
  bookSettings: BookSettings;
  puzzleSettings: PuzzleSettings;
  colorSettings: ColorSettings;
  wordSearchSettings?: WordSearchSettings;
}

export type ModuleSettings = TextModuleSettings | PuzzleModuleSettings;

export interface DocumentPage {
  id: string;
  moduleType: DocumentModuleType;
  category: DocumentModuleCategory;
  name: string;
  settings: ModuleSettings;
  createdAt: number;
}

export const FRONT_MATTER_MODULES: Array<{ type: DocumentModuleType; name: string }> = [
  { type: 'title-page', name: 'Title Page' },
  { type: 'table-of-contents', name: 'Table of Contents' },
  { type: 'copyright', name: 'Copyright' },
  { type: 'cta', name: 'Call to Action' },
  { type: 'introduction', name: 'Introduction' },
  { type: 'instructions', name: 'Instructions' },
];

export const PUZZLE_MODULES: Array<{ type: DocumentModuleType; name: string }> = [
  { type: 'word-search', name: 'Word Search' },
  { type: 'sudoku', name: 'Sudoku' },
  { type: 'crossword', name: 'Crossword' },
  { type: 'maze', name: 'Mazes' },
  { type: 'cryptogram', name: 'Cryptograms' },
  { type: 'word-scramble', name: 'Word Scramble' },
];

export const ALL_DOCUMENT_MODULES: Array<{ type: DocumentModuleType; name: string; category: DocumentModuleCategory }> = [
  ...FRONT_MATTER_MODULES.map((m) => ({ ...m, category: 'front-matter' as const })),
  ...PUZZLE_MODULES.map((m) => ({ ...m, category: 'puzzle' as const })),
];

export function isPuzzleModuleType(type: DocumentModuleType): type is PuzzleModuleType {
  return (
    type === 'word-search' ||
    type === 'sudoku' ||
    type === 'crossword' ||
    type === 'maze' ||
    type === 'cryptogram' ||
    type === 'word-scramble'
  );
}

export function isTextModuleType(type: DocumentModuleType): boolean {
  return !isPuzzleModuleType(type);
}

export function getDefaultTextModuleSettings(type: DocumentModuleType): TextModuleSettings {
  const label = FRONT_MATTER_MODULES.find((item) => item.type === type)?.name ?? 'Text Page';
  return {
    id: `${type}-settings`,
    title: label,
    description: '',
    content: '',
    fontFamily: 'Arial',
    fontSize: 18,
    alignment: 'center',
    tocMode: type === 'table-of-contents' ? 'auto' : undefined,
  };
}

export function getDefaultPuzzleModuleSettings(type: PuzzleModuleType): PuzzleModuleSettings {
  const title = PUZZLE_MODULES.find((item) => item.type === type)?.name ?? 'Puzzle';
  return {
    id: `${type}-settings`,
    title,
    description: '',
    puzzleType: type,
    titleWords: {
      title,
      fontFamily: 'Arial',
      fontSize: 24,
      words: [],
    },
    bookSettings: {
      trimSize: '8.5x11',
      includeBleed: false,
      includeSolution: true,
      puzzlesPerPage: 1,
    },
    puzzleSettings: {
      gridSize: 15,
      directions: ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'],
      puzzleDensity: 50,
    },
    colorSettings: {
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
        lettersInSolutionColor: '#22c55e',
        lettersNotInSolutionColor: '#d1d5db',
        solutionStrokeThickness: 12,
        solutionStrokePadding: 2,
        solutionFrameColor: '#22c55e',
        solutionFrameStyle: 'rounded',
        solutionFrameRadius: 6,
        solutionHighlightAlpha: 30,
        answerTitlePrefix: 'Solution',
        answerTitleFontFamily: 'Arial',
        answerTitleFontSize: 20,
        answerTitleAlignment: 'center',
        showAnswerNumber: true,
      },
    },
    wordSearchSettings: type === 'word-search' ? getDefaultWordSearchSettings() : undefined,
  };
}

export function createDocumentPage(type: DocumentModuleType): DocumentPage {
  const isPuzzle = isPuzzleModuleType(type);
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    moduleType: type,
    category: isPuzzle ? 'puzzle' : 'front-matter',
    name: isPuzzle
      ? PUZZLE_MODULES.find((item) => item.type === type)?.name ?? 'Puzzle Page'
      : FRONT_MATTER_MODULES.find((item) => item.type === type)?.name ?? 'Page',
    createdAt: Date.now(),
    settings: isPuzzle ? getDefaultPuzzleModuleSettings(type) : getDefaultTextModuleSettings(type),
  };
}

/** Seed a single word-search document from existing global settings (migration). */
export function createWordSearchDocumentFromGlobals(
  wordSearchSettings: WordSearchSettings,
  titleWords: TitleWordsSettings,
  name = 'Word Search'
): DocumentPage {
  const page = createDocumentPage('word-search');
  page.name = name;
  const settings = page.settings as PuzzleModuleSettings;
  settings.wordSearchSettings = wordSearchSettings;
  settings.titleWords = titleWords;
  return page;
}

export function isTextModuleSettings(settings: ModuleSettings): settings is TextModuleSettings {
  return !('puzzleType' in settings);
}

export function isPuzzleModuleSettings(settings: ModuleSettings): settings is PuzzleModuleSettings {
  return 'puzzleType' in settings;
}
