import {
  PuzzleType,
  BookSettings,
  PuzzleSettings,
  TitleWordsSettings,
  ColorSettings,
  WordSearchSettings,
  Difficulty,
  getDefaultWordSearchSettings,
} from './puzzles';
import type { DocumentPage } from './document-model';

export const SETTINGS_STORAGE_KEY = 'puzzle-book-maker-settings-v1';
export const SETTINGS_TAB_STORAGE_KEY = 'puzzle-book-maker-active-settings-tab';

export interface PersistedAppSettings {
  version: 1;
  currentPuzzleType: PuzzleType;
  wordSearchSettings: WordSearchSettings;
  bookSettings: BookSettings;
  puzzleSettings: PuzzleSettings;
  titleWords: TitleWordsSettings;
  colorSettings: ColorSettings;
  puzzleGridScale: number;
  titleToAnswerGap: number;
  solutionToSolutionGap: number;
  pageMargin: number;
  previewZoom: number;
  previewRangeMode: 'sample' | 'all' | 'flipbook';
  activePreviewTab: 'puzzles' | 'solutions';
  sudokuDifficulty: Difficulty;
  mazeSize: 'small' | 'medium' | 'large' | 'xl';
  cryptogramText: string;
  pageOverrides: Array<[number, Partial<WordSearchSettings>]>;
  pagePuzzleGridScales: Array<[number, number]>;
  applyMode: Array<[string, boolean]>;
  documentPages?: DocumentPage[];
  activeDocumentPageId?: string;
}

function deepMergeWordSearchSettings(
  base: WordSearchSettings,
  patch?: Partial<WordSearchSettings>
): WordSearchSettings {
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    bookCanvas: { ...base.bookCanvas, ...patch.bookCanvas },
    core: { ...base.core, ...patch.core },
    typography: { ...base.typography, ...patch.typography },
    wordList: { ...base.wordList, ...patch.wordList },
    colors: {
      puzzlePage: { ...base.colors.puzzlePage, ...patch.colors?.puzzlePage },
      answerPage: { ...base.colors.answerPage, ...patch.colors?.answerPage },
    },
  };
}

export function createDefaultPersistedSettings(
  defaults: Omit<PersistedAppSettings, 'version'>
): PersistedAppSettings {
  return { version: 1, ...defaults };
}

export function mergePersistedSettings(
  stored: Partial<PersistedAppSettings>,
  defaults: PersistedAppSettings
): PersistedAppSettings {
  return {
    ...defaults,
    ...stored,
    version: 1,
    wordSearchSettings: deepMergeWordSearchSettings(
      defaults.wordSearchSettings,
      stored.wordSearchSettings
    ),
    bookSettings: { ...defaults.bookSettings, ...stored.bookSettings },
    puzzleSettings: { ...defaults.puzzleSettings, ...stored.puzzleSettings },
    titleWords: { ...defaults.titleWords, ...stored.titleWords },
    colorSettings: {
      puzzlePage: {
        ...defaults.colorSettings.puzzlePage,
        ...stored.colorSettings?.puzzlePage,
      },
      answerPage: {
        ...defaults.colorSettings.answerPage,
        ...stored.colorSettings?.answerPage,
      },
    },
    pageOverrides: stored.pageOverrides ?? defaults.pageOverrides,
    pagePuzzleGridScales: stored.pagePuzzleGridScales ?? defaults.pagePuzzleGridScales,
    applyMode: stored.applyMode ?? defaults.applyMode,
    documentPages: stored.documentPages ?? defaults.documentPages,
    activeDocumentPageId: stored.activeDocumentPageId ?? defaults.activeDocumentPageId,
  };
}

export function loadPersistedSettings(defaults: PersistedAppSettings): PersistedAppSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedAppSettings>;
    return mergePersistedSettings(parsed, defaults);
  } catch (e) {
    console.warn('[settings-persistence] Failed to load settings:', e);
    return null;
  }
}

export function savePersistedSettings(settings: PersistedAppSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('[settings-persistence] Failed to save settings:', e);
  }
}

export function buildPersistedSnapshot(params: Omit<PersistedAppSettings, 'version'>): PersistedAppSettings {
  return createDefaultPersistedSettings(params);
}

export { getDefaultWordSearchSettings };
