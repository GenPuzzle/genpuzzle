'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  PuzzleType,
  BookSettings,
  PuzzleSettings,
  TitleWordsSettings,
  ColorSettings,
  Puzzle,
  SavedPuzzle,
  Difficulty,
  Direction,
  WordSearchSettings,
  WordSearchPuzzle,
  CrosswordPuzzle,
  GenericBatchPuzzle,
  getDefaultWordSearchSettings,
  generateWordSearch,
  generateSudoku,
  generateCalcudoku,
  generateCrossword,
  generateCryptogram,
  generateWordScramble,
  generateMaze,
  resolveMazeDimensions,
  generateWordMatch,
  generateDotToDot,
  buildWordSearchShapeMask,
  resolveShapeMaskImageSrc,
} from './puzzles';
import { buildTriviaBatch, parseTriviaLines, getMissingTriviaSuggestions } from './puzzles/trivia';
import { getEffectiveWordsPerPuzzle, getWordRepeatCount, getFillWithWordLettersOnly } from './puzzle-word-list';
import { DEFAULT_HEADER_ASSEMBLY } from './header-assembly/types';
import {
  buildPersistedSnapshot,
  loadPersistedSettings,
  mergePersistedSettings,
  savePersistedSettings,
  SETTINGS_STORAGE_KEY,
  type PersistedAppSettings,
} from './settings-persistence';
import {
  createDocumentPage,
  createInsertableDocumentPage,
  createWordSearchDocumentFromGlobals,
  DocumentModuleType,
  DocumentPage,
  InsertableDocumentKind,
  PuzzleModuleSettings,
  TextModuleSettings,
  isPuzzleModuleType,
} from './document-model';
import {
  CHAPTER_PAGE_STYLE_STORAGE_KEY,
  createStyledChapterDocumentPage,
  normalizeChapterPageStyle,
} from './chapter-page-layouts';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { useProjectDirtyState } from '@/hooks/useProjectDirtyState';
import { syncAutoTocInDocuments } from './sync-auto-toc';
import { resolvePageNumberSettingsForBook } from './text-page-pdf-draw';
import {
  clearShareHashFromUrl,
  extractSharedProjectFromLocation,
  type GpProjectFile,
} from './project-file';
import {
  cloneEditHistorySnapshot,
  EDIT_HISTORY_LIMIT,
  type EditHistorySnapshot,
} from './edit-history';
import {
  applyTrimLayoutToSettings,
  applyTrimLayoutToTitleWords,
  computeTrimScaleRatio,
  resolveTrimDimensions,
  scaleDocumentPagesForTrim,
  scaleGridScalePercent,
  scaleInt,
  scalePageOverridesForTrim,
  scalePagePuzzleGridScalesForTrim,
} from './trim-size-layout';
import { buildSeparatorInsertAfterCompiledPage } from './insert-separator-page';
import type { CompiledPage } from './book-compiler';
import { mergePuzzlePageColors } from '@/lib/page-settings';
import { normalizeBatchPuzzleDocumentIndices } from './puzzle-line-index';
import type { AiGeneratedBundle } from './ai/build-ai-project';
import { overlayAiBundleOntoPage } from './ai/build-ai-project';
import {
  buildChapterSplitPlan,
  splitPuzzleDocumentByChapters,
  type SplitIntoChaptersRequest,
} from './split-puzzle-document-by-chapters';
import {
  buildCrosswordPuzzlesForDocumentPage,
  buildWordSearchPuzzlesForDocumentPage,
} from './generate-document-puzzles';
import { writeChapterTitlesDraft, writeDivideListsPreference } from './chapter-titles-draft';
import {
  removeContentLineAt,
  removePuzzleWordsFromTitleList,
} from './puzzle-word-list';
import {
  getDefaultCrosswordSettings,
  normalizeCrosswordSettings,
  parseCrosswordLines,
  buildCrosswordWordClues,
  type CrosswordSettings,
} from './crossword-settings';
import {
  getDefaultGenericPuzzleSettings,
  normalizeGenericPuzzleSettings,
  isGenericPuzzleModuleType,
  expandMixedMazeLevelPlan,
  expandMixedMazeShapePlan,
  expandMixedSudokuDifficultyPlan,
  expandMixedSudokuSizePlan,
  resolveCalcudokuDifficulties,
  resolveCalcudokuGridSizes,
  sudokuModeGenerationBlockMessage,
  type GenericPuzzleSettings,
} from './generic-puzzle-settings';
import { FAMOUS_QUOTES } from './puzzles/cryptogram';
import { DEFAULT_SCRAMBLE_WORDS } from './puzzles/word-scramble';
import { enrichMurdokuElementsForScene, generateMurdokuPuzzle, type MurdokuDifficulty, type MurdokuPuzzle } from './puzzles/murdoku';
import { rewriteMurdokuPuzzleCluesWithAi } from './murdoku-ai';
import {
  applyThemePreset,
  expandMixedMurdokuDifficultyPlan,
  getDefaultMurdokuSettings,
  MURDOKU_THEME_PRESETS,
  murdokuLineForPuzzle,
  normalizeMurdokuSettings,
  resolveMurdokuGenerateDifficulty,
  type MurdokuSettings,
} from './murdoku-settings';
import type { MazeShape, Difficulty } from './puzzles/types';
import type { MazeSizePreset, SudokuSize } from './generic-puzzle-settings';
import { isSudokuSize } from './puzzles/sudoku';
import { shuffledBalancedPlan, sampleOrCyclePlan } from './puzzles/calcudoku';
import {
  mergeWordSearchSettingsUpdate,
  syncLayoutSettingsAcrossAllPuzzleDocuments,
  overlayBookLayoutOnAllDocuments,
  applyBookLayoutToDocumentPage,
  getFullLayoutSyncScope,
  stripVisualOverridesFromMap,
  detectLayoutSyncScope,
  mergeDocumentSettingsPreservingLayout,
  applyLayoutSettingsToCrosswordDocument,
  applyLayoutSettingsToGenericDocument,
  applyLayoutSettingsToMurdokuDocument,
} from './visual-settings-sync';

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
}

export interface GeneratePuzzleOptions {
  /** Skip regenerating these batch puzzle indices and keep their existing grids. */
  preserveEditedPageIndices?: number[];
  /** Remove all per-page styling overrides before generating. */
  clearPageCustomizations?: boolean;
  /** Split the active Word Search / Crossword document into chapter documents, then generate. */
  splitIntoChapters?: SplitIntoChaptersRequest;
}

interface AppContextType {
  // Current puzzle type
  currentPuzzleType: PuzzleType;
  setCurrentPuzzleType: (type: PuzzleType) => void;

  // Word Search Settings (comprehensive)
  wordSearchSettings: WordSearchSettings;
  setWordSearchSettings: (settings: WordSearchSettings) => void;
  updateWordSearchSettings: (updates: Partial<WordSearchSettings>) => void;

  // Crossword Settings (left = generation, right = visual)
  crosswordSettings: CrosswordSettings;
  setCrosswordSettings: (settings: CrosswordSettings) => void;
  updateCrosswordSettings: (updates: Partial<CrosswordSettings>) => void;

  murdokuSettings: MurdokuSettings;
  setMurdokuSettings: (settings: MurdokuSettings) => void;
  updateMurdokuSettings: (updates: Partial<MurdokuSettings>) => void;

  // Sudoku / Maze document settings (generic grid modules)
  genericPuzzleSettings: GenericPuzzleSettings;
  setGenericPuzzleSettings: (settings: GenericPuzzleSettings) => void;
  updateGenericPuzzleSettings: (updates: Partial<GenericPuzzleSettings>) => void;

  // Book settings (general)
  bookSettings: BookSettings;
  setBookSettings: (settings: BookSettings) => void;

  // Puzzle settings (general)
  puzzleSettings: PuzzleSettings;
  setPuzzleSettings: (settings: PuzzleSettings) => void;

  // Title/Words settings (general)
  titleWords: TitleWordsSettings;
  setTitleWords: (settings: TitleWordsSettings) => void;

  // Color settings (general)
  colorSettings: ColorSettings;
  setColorSettings: (settings: ColorSettings) => void;

  // Current puzzle (for single puzzle view)
  currentPuzzle: Puzzle | null;

  // Batch puzzles for word search
  batchPuzzles: WordSearchPuzzle[];
  currentBatchIndex: number;
  setCurrentBatchIndex: (index: number) => void;

  /** Batch crossword puzzles for the active crossword document (mirrors word-search batch). */
  crosswordBatchPuzzles: CrosswordPuzzle[];

  murdokuBatchPuzzles: MurdokuPuzzle[];
  replaceMurdokuPuzzle: (puzzle: MurdokuPuzzle) => void;

  /** Batch sudoku/maze puzzles across all generic documents (mirrors crossword batch). */
  genericBatchPuzzles: GenericBatchPuzzle[];

  // Validation
  validationError: ValidationError | null;
  clearValidationError: () => void;
  validateAndGenerate: (options?: GeneratePuzzleOptions) => Promise<boolean>;

  // Generate puzzle (triggers validation)
  generatePuzzle: (options?: GeneratePuzzleOptions) => void | Promise<void>;

  /** Regenerate a single word-search puzzle at the given batch index. */
  regeneratePuzzleAtIndex: (
    batchIndex: number,
    wordsOverride?: string[],
    options?: {
      lettersAcross?: number;
      lettersDown?: number;
      settings?: WordSearchSettings;
    }
  ) => Promise<WordSearchPuzzle | null>;
  restoreBatchPuzzleAtIndex: (batchIndex: number, puzzle: WordSearchPuzzle) => void;

  /** Increments after each successful word-search batch generation (preview sync). */
  puzzleGenerationVersion: number;

  // Styling-only trigger (doesn't regenerate puzzles)
  triggerStylingUpdate: number;

  // Difficulty for Sudoku
  sudokuDifficulty: Difficulty;
  setSudokuDifficulty: (difficulty: Difficulty) => void;

  // Maze size
  mazeSize: 'small' | 'medium' | 'large' | 'xl';
  setMazeSize: (size: 'small' | 'medium' | 'large' | 'xl') => void;

  // Saved puzzles
  savedPuzzles: SavedPuzzle[];
  savePuzzle: (name: string) => void;
  loadPuzzle: (id: string) => void;
  deletePuzzle: (id: string) => void;

  // Preview mode
  showSolution: boolean;
  setShowSolution: (show: boolean) => void;

  // Custom text for cryptogram
  cryptogramText: string;
  setCryptogramText: (text: string) => void;

  // Preview zoom
  previewZoom: number;
  setPreviewZoom: (zoom: number) => void;

  // Puzzle grid scale (1-200%)
  puzzleGridScale: number;
  setPuzzleGridScale: (scale: number) => void;

  // Title to Answer Gap (points between solution title and grids)
  titleToAnswerGap: number;
  setTitleToAnswerGap: (gap: number) => void;

  // Solution-to-solution spacing (points between solution blocks on multi-solution pages)
  solutionToSolutionGap: number;
  setSolutionToSolutionGap: (gap: number) => void;

  // Page Margins (points from page edges, for KDP safety)
  pageMargin: number;
  setPageMargin: (margin: number) => void;

  // Visual Page Editor: Page-level overrides (local edits for specific pages)
  pageOverrides: Map<number, Partial<WordSearchSettings>>;
  setPageOverrides: (overrides: Map<number, Partial<WordSearchSettings>>) => void;
  updatePageOverride: (pageIndex: number, updates: Partial<WordSearchSettings>) => void;
  clearPageOverride: (pageIndex: number) => void;
  clearAllPageOverrides: () => void;
  pagePuzzleGridScales: Map<number, number>;
  setPagePuzzleGridScale: (pageIndex: number, scale: number) => void;
  clearPagePuzzleGridScale: (pageIndex: number) => void;
  clearAllPagePuzzleGridScales: () => void;
  /** Per-crossword-page style overrides, keyed by document-local puzzle index. */
  pageCrosswordOverrides: Map<number, Partial<CrosswordSettings>>;
  setPageCrosswordOverrides: React.Dispatch<
    React.SetStateAction<Map<number, Partial<CrosswordSettings>>>
  >;
  /** Per-sudoku/maze-page style overrides, keyed by document-local puzzle index. */
  pageGenericOverrides: Map<number, Partial<GenericPuzzleSettings>>;
  setPageGenericOverrides: React.Dispatch<
    React.SetStateAction<Map<number, Partial<GenericPuzzleSettings>>>
  >;

  documentPages: DocumentPage[];
  activeDocumentPageId: string;
  activeDocumentPage: DocumentPage | null;
  setActiveDocumentPageId: (id: string) => void;
  insertDocumentPage: (
    type: InsertableDocumentKind,
    position: 'before' | 'after',
    referenceId?: string
  ) => void;
  /** Insert AI-generated document tabs after/before a reference tab. */
  appendAiGeneratedBundle: (
    bundle: AiGeneratedBundle,
    position?: { side: 'before' | 'after'; referenceId: string }
  ) => void;
  /** Replace the active puzzle tab's content with AI-generated puzzles. */
  applyAiGeneratedToActiveDocument: (bundle: AiGeneratedBundle) => void;
  /** Insert a blank title page after a compiled book page (splits word-search if mid-doc). */
  insertSeparatorTitlePageAfter: (anchor: import('./book-compiler').CompiledPage) => void;
  /** Remove a compiled book page (text doc, or a single puzzle). */
  removeCompiledBookPage: (page: import('./book-compiler').CompiledPage) => void;
  removeDocumentPage: (id: string) => void;
  duplicateDocumentPage: (id: string) => void;
  moveDocumentPage: (id: string, direction: 'up' | 'down') => void;
  reorderDocumentPages: (activeId: string, overId: string) => void;
  updateDocumentPage: (id: string, updates: Partial<DocumentPage>) => void;
  /** Replace the full document tab list (batch chapter insert, etc.). */
  replaceDocumentPages: (pages: DocumentPage[], activeId?: string | null) => void;
  updateActiveTextModuleSettings: (
    updates:
      | Partial<TextModuleSettings>
      | ((prev: TextModuleSettings) => Partial<TextModuleSettings>),
    options?: { recordHistory?: boolean }
  ) => void;
  /** Apply full text-module settings to multiple document pages (e.g. separator layout sync). */
  applyTextSettingsToDocumentPages: (
    updates: Array<{ pageId: string; settings: TextModuleSettings }>,
    options?: { recordHistory?: boolean }
  ) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushEditHistory: () => void;
  persistPagePuzzleSettings: (
    pageId: string,
    titleWordsSettings: TitleWordsSettings,
    ws: WordSearchSettings
  ) => void;

  /** Recompute fonts, grids, spacing, and borders for a new trim size. */
  applyTrimSizeLayoutChange: (
    bookCanvasUpdates: Partial<WordSearchSettings['bookCanvas']>,
    dimensions?: { width: number; height: number }
  ) => void;

  /**
   * Apply Layout panel settings (trim, colors, frame, page numbers) to every
   * puzzle document tab in the workspace.
   */
  applyLayoutSettingsToAllPuzzleDocuments: () => void;

  // Apply mode: whether changes apply to all pages (true) or current page only (false)
  applyMode: Map<string, boolean>; // key: setting category (e.g., 'grid', 'wordList', 'typography', 'colors'), value: true = global, false = local
  setApplyMode: (category: string, isGlobal: boolean) => void;

  // Performance Optimizer: Preview range mode
  previewRangeMode: 'sample' | 'all' | 'flipbook';
  setPreviewRangeMode: (mode: 'sample' | 'all' | 'flipbook') => void;

  // Performance Optimizer: Active preview tab
  activePreviewTab: 'puzzles' | 'solutions';
  setActivePreviewTab: (tab: 'puzzles' | 'solutions') => void;

  /** True after settings have been hydrated from localStorage. */
  settingsHydrated: boolean;

  projectName: string;
  setProjectName: (name: string) => void;
  isProjectDirty: boolean;
  buildProjectSnapshot: () => GpProjectFile;
  loadProjectSnapshot: (file: GpProjectFile) => void;
  resetToNewProject: () => void;
  markProjectSaved: () => void;
  showEditorTutorial: boolean;
  dismissEditorTutorial: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultBookSettings: BookSettings = {
  trimSize: '8.5x11',
  includeBleed: false,
  includeSolution: true,
  puzzlesPerPage: 1,
  mixPuzzles: false,
};

const defaultPuzzleSettings: PuzzleSettings = {
  gridSize: 15,
  directions: ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'],
  puzzleDensity: 50,
};

const defaultTitleWords: TitleWordsSettings = {
  title: 'Word Search',
  fontFamily: 'Arial',
  fontSize: 24,
  words: [],
};

const defaultColorSettings: ColorSettings = {
  puzzlePage: {
    backgroundColor: '#ffffff',
    titleColor: '#1f2937',
    subtitleColor: '#6b7280',
    boxColor: '#1f2937',
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
    lettersInSolutionColor: '#22c55e',
    lettersNotInSolutionColor: '#d1d5db',
    solutionStrokeThickness: 12,
    solutionStrokePadding: 2,
    solutionFrameColor: '#22c55e',
    solutionHighlightStrokeColor: '#000000',
    solutionHighlightStrokeThickness: 0,
    solutionFrameStyle: 'rounded',
    solutionFrameRadius: 6,
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
};

function buildInitialDocumentPages(): DocumentPage[] {
  return [createWordSearchDocumentFromGlobals(getDefaultWordSearchSettings(), defaultTitleWords)];
}

let cachedInitialDocumentPages: DocumentPage[] | null = null;
function getInitialDocumentPages(): DocumentPage[] {
  if (!cachedInitialDocumentPages) {
    cachedInitialDocumentPages = buildInitialDocumentPages();
  }
  return cachedInitialDocumentPages;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentPuzzleType, setCurrentPuzzleType] = useState<PuzzleType>('word-search');
  const [bookSettings, setBookSettings] = useState<BookSettings>(defaultBookSettings);
  const [puzzleSettings, setPuzzleSettings] = useState<PuzzleSettings>(defaultPuzzleSettings);
  const [titleWords, setTitleWords] = useState<TitleWordsSettings>(defaultTitleWords);
  const [colorSettings, setColorSettings] = useState<ColorSettings>(defaultColorSettings);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const [sudokuDifficulty, setSudokuDifficulty] = useState<Difficulty>('medium');
  const [mazeSize, setMazeSize] = useState<'small' | 'medium' | 'large' | 'xl'>('medium');
  const [showSolution, setShowSolution] = useState(false);
  const [cryptogramText, setCryptogramText] = useState('');
  const [savedPuzzles, setSavedPuzzles] = useState<SavedPuzzle[]>([]);
  const [previewZoom, setPreviewZoom] = useState(75);
  const previewZoomRef = useRef(previewZoom);
  // Preview UI chrome — not part of document edits; kept out of undo/redo apply.
  const previewRangeModeRef = useRef<'sample' | 'all' | 'flipbook'>('all');
  const activePreviewTabRef = useRef<'puzzles' | 'solutions'>('puzzles');
  const [puzzleGridScale, setPuzzleGridScale] = useState(70);
  const [titleToAnswerGap, setTitleToAnswerGap] = useState(10);
  const [solutionToSolutionGap, setSolutionToSolutionGap] = useState(14);
  const [pageMargin, setPageMargin] = useState(40);

  // Batch puzzles for word search
  const [batchPuzzles, setBatchPuzzles] = useState<WordSearchPuzzle[]>([]);
  const [crosswordBatchPuzzles, setCrosswordBatchPuzzles] = useState<CrosswordPuzzle[]>([]);
  const [genericBatchPuzzles, setGenericBatchPuzzles] = useState<GenericBatchPuzzle[]>([]);
  const [editHistoryPast, setEditHistoryPast] = useState<EditHistorySnapshot[]>([]);
  const [editHistoryFuture, setEditHistoryFuture] = useState<EditHistorySnapshot[]>([]);
  const skipEditHistoryRef = useRef(false);
  const editHistoryCoalesceRef = useRef<{ active: boolean; timer: ReturnType<typeof setTimeout> | null }>({
    active: false,
    timer: null,
  });
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  // Validation error
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [puzzleGenerationVersion, setPuzzleGenerationVersion] = useState(0);

  // Styling update trigger (increment to force re-render without regenerating)
  const [stylingTrigger, setStylingTrigger] = useState(0);

  // Word Search Settings (also the book-wide Layout source: Trim / Style / page numbers)
  const [wordSearchSettings, setWordSearchSettings] = useState<WordSearchSettings>(getDefaultWordSearchSettings());
  const wordSearchSettingsRef = useRef(wordSearchSettings);
  wordSearchSettingsRef.current = wordSearchSettings;

  // Crossword Settings
  const [crosswordSettings, setCrosswordSettings] = useState<CrosswordSettings>(getDefaultCrosswordSettings());
  const [murdokuSettings, setMurdokuSettings] = useState<MurdokuSettings>(getDefaultMurdokuSettings());
  const [murdokuBatchPuzzles, setMurdokuBatchPuzzles] = useState<MurdokuPuzzle[]>([]);

  // Sudoku / Maze document settings (live copy for the active generic document)
  const [genericPuzzleSettings, setGenericPuzzleSettings] = useState<GenericPuzzleSettings>(
    getDefaultGenericPuzzleSettings('sudoku')
  );

  // Visual Page Editor: Page-level overrides (local edits for specific pages)
  const [pageOverrides, setPageOverrides] = useState<Map<number, Partial<WordSearchSettings>>>(new Map());
  const [pagePuzzleGridScales, setPagePuzzleGridScales] = useState<Map<number, number>>(new Map());
  const [pageCrosswordOverrides, setPageCrosswordOverrides] = useState<
    Map<number, Partial<CrosswordSettings>>
  >(new Map());
  const [pageGenericOverrides, setPageGenericOverrides] = useState<
    Map<number, Partial<GenericPuzzleSettings>>
  >(new Map());

  const [documentPages, setDocumentPages] = useState<DocumentPage[]>(getInitialDocumentPages);
  const [activeDocumentPageId, setActiveDocumentPageId] = useState<string>(() => getInitialDocumentPages()[0].id);

  // Apply mode: whether changes apply to all pages (true) or current page only (false)
  const [applyMode, setApplyModeState] = useState<Map<string, boolean>>(
    new Map([
      ['grid', true],      // Default: global
      ['wordList', true],
      ['typography', true],
      ['colors', true],
    ])
  );

  // Performance Optimizer: Preview range mode (sample vs full)
  const [previewRangeMode, setPreviewRangeMode] = useState<'sample' | 'all' | 'flipbook'>('all');

  // Performance Optimizer: Active preview tab (puzzles vs solutions)
  const [activePreviewTab, setActivePreviewTab] = useState<'puzzles' | 'solutions'>('puzzles');

  useEffect(() => {
    previewRangeModeRef.current = previewRangeMode;
  }, [previewRangeMode]);

  useEffect(() => {
    activePreviewTabRef.current = activePreviewTab;
  }, [activePreviewTab]);

  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [showEditorTutorial, setShowEditorTutorial] = useState(false);
  const hydrationDoneRef = useRef(false);

  const defaultPersistedSnapshot = useMemo(
    (): PersistedAppSettings =>
      buildPersistedSnapshot({
        currentPuzzleType: 'word-search',
        wordSearchSettings: getDefaultWordSearchSettings(),
        bookSettings: defaultBookSettings,
        puzzleSettings: defaultPuzzleSettings,
        titleWords: defaultTitleWords,
        colorSettings: defaultColorSettings,
        puzzleGridScale: 70,
        titleToAnswerGap: 10,
        solutionToSolutionGap: 14,
        pageMargin: 40,
        previewZoom: 75,
        previewRangeMode: 'all',
        activePreviewTab: 'puzzles',
        sudokuDifficulty: 'medium',
        mazeSize: 'medium',
        cryptogramText: '',
        pageOverrides: [],
        pageCrosswordOverrides: [],
        pageGenericOverrides: [],
        pagePuzzleGridScales: [],
        applyMode: [
          ['grid', true],
          ['wordList', true],
          ['typography', true],
          ['colors', true],
        ],
      }),
    []
  );

  const applyPersistedSettings = useCallback((stored: PersistedAppSettings) => {
      setCurrentPuzzleType(stored.currentPuzzleType);
      setWordSearchSettings(stored.wordSearchSettings);
      setBookSettings(stored.bookSettings);
      setPuzzleSettings(stored.puzzleSettings);
      setTitleWords(stored.titleWords);
      setColorSettings(stored.colorSettings);
      setPuzzleGridScale(stored.puzzleGridScale);
      setTitleToAnswerGap(stored.titleToAnswerGap);
      setSolutionToSolutionGap(stored.solutionToSolutionGap);
      setPageMargin(stored.pageMargin);
      setPreviewZoom(stored.previewZoom);
    const mode = stored.previewRangeMode;
    setPreviewRangeMode(
      mode === 'sample' || mode === 'flipbook' || mode === 'all' ? mode : 'all'
    );
      setActivePreviewTab(stored.activePreviewTab);
      setSudokuDifficulty(stored.sudokuDifficulty);
      setMazeSize(stored.mazeSize);
      setCryptogramText(stored.cryptogramText);
      setPageOverrides(new Map(stored.pageOverrides));
    setPageCrosswordOverrides(new Map(stored.pageCrosswordOverrides ?? []));
    setPageGenericOverrides(new Map(stored.pageGenericOverrides ?? []));
    setPagePuzzleGridScales(new Map(stored.pagePuzzleGridScales ?? []));
      setApplyModeState(new Map(stored.applyMode));
    if (stored.documentPages && stored.documentPages.length > 0) {
      setDocumentPages(stored.documentPages);
      const activeId =
        stored.activeDocumentPageId &&
        stored.documentPages.some((p) => p.id === stored.activeDocumentPageId)
          ? stored.activeDocumentPageId
          : stored.documentPages[0].id;
      setActiveDocumentPageId(activeId);
    } else {
      const migrated = createWordSearchDocumentFromGlobals(
        stored.wordSearchSettings,
        stored.titleWords
      );
      setDocumentPages([migrated]);
      setActiveDocumentPageId(migrated.id);
    }
  }, []);

  // Hydrate global settings from localStorage or shared URL once (loadProjectSnapshot defined below)
  const loadProjectSnapshotRef = useRef<(file: GpProjectFile) => void>(() => {});

  const persistSettings = useDebouncedCallback((snapshot: PersistedAppSettings) => {
    savePersistedSettings(snapshot);
  }, 300);

  const documentPagesForPersistence = useMemo(() => {
    // Each document tab keeps its own settings (no cross-doc layout overwrite).
    return documentPages.map((page) => {
      if (page.id === activeDocumentPageId && page.moduleType === 'word-search') {
        return {
          ...page,
          settings: {
            ...page.settings,
            titleWords,
            wordSearchSettings,
          } as PuzzleModuleSettings,
        };
      }
      if (page.id === activeDocumentPageId && page.moduleType === 'crossword') {
        return {
          ...page,
          settings: {
            ...page.settings,
            titleWords,
            crosswordSettings,
          } as PuzzleModuleSettings,
        };
      }
      if (page.id === activeDocumentPageId && page.moduleType === 'murdoku') {
        return {
          ...page,
          settings: {
            ...page.settings,
            titleWords,
            murdokuSettings,
          } as PuzzleModuleSettings,
        };
      }
      if (
        page.id === activeDocumentPageId &&
        isGenericPuzzleModuleType(page.moduleType)
      ) {
        return {
          ...page,
          settings: {
            ...page.settings,
            titleWords,
            genericPuzzleSettings,
          } as PuzzleModuleSettings,
        };
      }
      return page;
    });
  }, [
    documentPages,
    activeDocumentPageId,
    titleWords,
    wordSearchSettings,
    crosswordSettings,
    murdokuSettings,
    genericPuzzleSettings,
  ]);

  const buildCurrentPersistedSnapshot = useCallback((): PersistedAppSettings => {
    return buildPersistedSnapshot({
      currentPuzzleType,
      wordSearchSettings,
      bookSettings,
      puzzleSettings,
      titleWords,
      colorSettings,
      puzzleGridScale,
      titleToAnswerGap,
      solutionToSolutionGap,
      pageMargin,
      previewZoom,
      previewRangeMode,
      activePreviewTab,
      sudokuDifficulty,
      mazeSize,
      cryptogramText,
      pageOverrides: Array.from(pageOverrides.entries()),
      pageCrosswordOverrides: Array.from(pageCrosswordOverrides.entries()),
      pageGenericOverrides: Array.from(pageGenericOverrides.entries()),
      pagePuzzleGridScales: Array.from(pagePuzzleGridScales.entries()),
      applyMode: Array.from(applyMode.entries()),
      documentPages: documentPagesForPersistence,
      activeDocumentPageId,
    });
  }, [
    currentPuzzleType,
    wordSearchSettings,
    bookSettings,
    puzzleSettings,
    titleWords,
    colorSettings,
    puzzleGridScale,
    titleToAnswerGap,
    solutionToSolutionGap,
    pageMargin,
    previewZoom,
    previewRangeMode,
    activePreviewTab,
    sudokuDifficulty,
    mazeSize,
    cryptogramText,
    pageOverrides,
    pageCrosswordOverrides,
    pageGenericOverrides,
    pagePuzzleGridScales,
    applyMode,
    documentPagesForPersistence,
    activeDocumentPageId,
  ]);

  const captureEditHistorySnapshot = useCallback((): EditHistorySnapshot => {
    const settings = buildCurrentPersistedSnapshot();
    // View chrome (zoom / all-pages vs one-page / puzzles vs solutions) is UI-only —
    // snapshots still store placeholders for PersistedAppSettings shape, but apply
    // restores the live view mode so Undo never flips preview layout.
    return {
      settings: cloneEditHistorySnapshot({
        ...settings,
        previewZoom: previewZoomRef.current,
        previewRangeMode: previewRangeModeRef.current,
        activePreviewTab: activePreviewTabRef.current,
      }),
      batchPuzzles: cloneEditHistorySnapshot(batchPuzzles),
    };
  }, [buildCurrentPersistedSnapshot, batchPuzzles]);

  useEffect(() => {
    previewZoomRef.current = previewZoom;
  }, [previewZoom]);

  const applyEditHistorySnapshot = useCallback(
    (snapshot: EditHistorySnapshot) => {
      const keepZoom = previewZoomRef.current;
      const keepRangeMode = previewRangeModeRef.current;
      const keepPreviewTab = activePreviewTabRef.current;
      skipEditHistoryRef.current = true;
      applyPersistedSettings(snapshot.settings);
      // Never restore preview UI from history — only document content/settings.
      setPreviewZoom(keepZoom);
      setPreviewRangeMode(keepRangeMode);
      setActivePreviewTab(keepPreviewTab);
      setBatchPuzzles(snapshot.batchPuzzles);
      skipEditHistoryRef.current = false;
      if (editHistoryCoalesceRef.current.timer) {
        clearTimeout(editHistoryCoalesceRef.current.timer);
      }
      editHistoryCoalesceRef.current.active = false;
      editHistoryCoalesceRef.current.timer = null;
    },
    [applyPersistedSettings]
  );

  const pushEditHistory = useCallback(() => {
    if (skipEditHistoryRef.current) return;
    if (editHistoryCoalesceRef.current.active) return;

    const snapshot = captureEditHistorySnapshot();
    setEditHistoryPast((prev) => [...prev.slice(-(EDIT_HISTORY_LIMIT - 1)), snapshot]);
    setEditHistoryFuture([]);

    editHistoryCoalesceRef.current.active = true;
    if (editHistoryCoalesceRef.current.timer) {
      clearTimeout(editHistoryCoalesceRef.current.timer);
    }
    editHistoryCoalesceRef.current.timer = setTimeout(() => {
      editHistoryCoalesceRef.current.active = false;
      editHistoryCoalesceRef.current.timer = null;
    }, 450);
  }, [captureEditHistorySnapshot]);

  const undo = useCallback(() => {
    if (editHistoryPast.length === 0) return;
    const previous = editHistoryPast[editHistoryPast.length - 1];
    const current = captureEditHistorySnapshot();
    applyEditHistorySnapshot(previous);
    setEditHistoryPast((past) => past.slice(0, -1));
    setEditHistoryFuture((future) => [current, ...future]);
  }, [editHistoryPast, captureEditHistorySnapshot, applyEditHistorySnapshot]);

  const redo = useCallback(() => {
    if (editHistoryFuture.length === 0) return;
    const next = editHistoryFuture[0];
    const current = captureEditHistorySnapshot();
    applyEditHistorySnapshot(next);
    setEditHistoryFuture((future) => future.slice(1));
    setEditHistoryPast((past) => [...past.slice(-(EDIT_HISTORY_LIMIT - 1)), current]);
  }, [editHistoryFuture, captureEditHistorySnapshot, applyEditHistorySnapshot]);

  const canUndo = editHistoryPast.length > 0;
  const canRedo = editHistoryFuture.length > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditableField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable;

      if (isEditableField) return;

      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo]);

  const buildProjectSnapshot = useCallback((): GpProjectFile => {
    return {
      format: 'genpuzzle-project',
      formatVersion: 1,
      savedAt: new Date().toISOString(),
      projectName,
      settings: buildCurrentPersistedSnapshot(),
      batchPuzzles,
      crosswordBatchPuzzles,
      genericBatchPuzzles,
      murdokuBatchPuzzles,
      currentPuzzle,
      currentBatchIndex,
    };
  }, [
    projectName,
    buildCurrentPersistedSnapshot,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
    currentPuzzle,
    currentBatchIndex,
  ]);

  const projectStateSignature = useMemo(
    () =>
      JSON.stringify({
        projectName,
        settings: buildCurrentPersistedSnapshot(),
        batchPuzzles,
        crosswordBatchPuzzles,
        genericBatchPuzzles,
        murdokuBatchPuzzles,
        currentPuzzle,
        currentBatchIndex,
      }),
    [
      projectName,
      buildCurrentPersistedSnapshot,
      batchPuzzles,
      crosswordBatchPuzzles,
      genericBatchPuzzles,
      murdokuBatchPuzzles,
      currentPuzzle,
      currentBatchIndex,
    ]
  );

  const {
    isProjectDirty,
    markProjectSaved,
    scheduleBaselineCapture,
    beginSuppressDirty,
    endSuppressDirty,
  } = useProjectDirtyState({
    active: settingsHydrated,
    stateSignature: projectStateSignature,
  });

  const loadProjectSnapshot = useCallback(
    (file: GpProjectFile) => {
      beginSuppressDirty();
      applyPersistedSettings(file.settings);
      setBatchPuzzles(normalizeBatchPuzzleDocumentIndices(file.batchPuzzles ?? []));
      setCrosswordBatchPuzzles(file.crosswordBatchPuzzles ?? []);
      setGenericBatchPuzzles(file.genericBatchPuzzles ?? []);
      setMurdokuBatchPuzzles(file.murdokuBatchPuzzles ?? []);
      // pageCrosswordOverrides restore via applyPersistedSettings(file.settings).
      setCurrentPuzzle(file.currentPuzzle ?? null);
      setCurrentBatchIndex(file.currentBatchIndex ?? 0);
      setProjectName(file.projectName || 'Untitled Project');
      setValidationError(null);
      setShowSolution(false);
      setShowEditorTutorial(false);
      setEditHistoryPast([]);
      setEditHistoryFuture([]);
      scheduleBaselineCapture();
      clearShareHashFromUrl();
      requestAnimationFrame(() => {
        endSuppressDirty();
      });
    },
    [
      applyPersistedSettings,
      beginSuppressDirty,
      endSuppressDirty,
      scheduleBaselineCapture,
    ]
  );

  const resetToNewProject = useCallback(() => {
    beginSuppressDirty();
    setCurrentPuzzleType('word-search');
    setWordSearchSettings(getDefaultWordSearchSettings());
    setBookSettings(defaultBookSettings);
    setPuzzleSettings(defaultPuzzleSettings);
    setTitleWords(defaultTitleWords);
    setColorSettings(defaultColorSettings);
    setPuzzleGridScale(70);
    setTitleToAnswerGap(10);
    setSolutionToSolutionGap(14);
    setPageMargin(40);
    setPreviewZoom(75);
    setPreviewRangeMode('sample');
    setActivePreviewTab('puzzles');
    setSudokuDifficulty('medium');
    setMazeSize('medium');
    setCryptogramText('');
    setPageOverrides(new Map());
    setPagePuzzleGridScales(new Map());
    setPageCrosswordOverrides(new Map());
    setPageGenericOverrides(new Map());
    setGenericPuzzleSettings(getDefaultGenericPuzzleSettings('sudoku'));
    setApplyModeState(
      new Map([
        ['grid', true],
        ['wordList', true],
        ['typography', true],
        ['colors', true],
      ])
    );
    setDocumentPages([]);
    setActiveDocumentPageId('');
    setShowEditorTutorial(true);
    setBatchPuzzles([]);
    setCrosswordBatchPuzzles([]);
    setGenericBatchPuzzles([]);
    setMurdokuBatchPuzzles([]);
    setMurdokuSettings(getDefaultMurdokuSettings());
    setCurrentPuzzle(null);
    setCurrentBatchIndex(0);
    setValidationError(null);
    setShowSolution(false);
    setProjectName('Untitled Project');
    setEditHistoryPast([]);
    setEditHistoryFuture([]);
    scheduleBaselineCapture();
    clearShareHashFromUrl();
    requestAnimationFrame(() => {
      endSuppressDirty();
    });
  }, [beginSuppressDirty, endSuppressDirty, scheduleBaselineCapture]);

  const dismissEditorTutorial = useCallback(() => {
    setShowEditorTutorial(false);
  }, []);

  useEffect(() => {
    loadProjectSnapshotRef.current = loadProjectSnapshot;
  }, [loadProjectSnapshot]);

  useEffect(() => {
    if (hydrationDoneRef.current) return;
    hydrationDoneRef.current = true;

    const sharedProject = extractSharedProjectFromLocation();
    if (sharedProject) {
      loadProjectSnapshotRef.current(sharedProject);
      setSettingsHydrated(true);
      return;
    }

    const stored = loadPersistedSettings(defaultPersistedSnapshot);
    if (stored) {
      applyPersistedSettings(stored);
    }
    setSettingsHydrated(true);
  }, [defaultPersistedSnapshot, applyPersistedSettings]);

  // Debounced localStorage sync + cross-tab consistency
  useEffect(() => {
    if (!settingsHydrated) return;

    const snapshot = buildCurrentPersistedSnapshot();

    persistSettings(snapshot);
  }, [
    settingsHydrated,
    buildCurrentPersistedSnapshot,
    persistSettings,
  ]);

  // Apply remote tab updates from other browser windows
  useEffect(() => {
    if (!settingsHydrated || typeof window === 'undefined') return;

    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<PersistedAppSettings>;
        const next = mergePersistedSettings(parsed, defaultPersistedSnapshot);
        beginSuppressDirty();
        applyPersistedSettings(next);
        requestAnimationFrame(() => {
          endSuppressDirty();
        });
      } catch (e) {
        console.warn('[AppProvider] Cross-tab settings sync failed:', e);
      }
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [settingsHydrated, defaultPersistedSnapshot, applyPersistedSettings, beginSuppressDirty, endSuppressDirty]);

  const setApplyMode = useCallback((category: string, isGlobal: boolean) => {
    setApplyModeState(prev => new Map(prev).set(category, isGlobal));
  }, []);

  const activeDocumentPage = useMemo(() => {
    return documentPages.find((page) => page.id === activeDocumentPageId) ?? null;
  }, [documentPages, activeDocumentPageId]);

  const documentStructureKey = useMemo(
    () =>
      documentPages
        .map((page) => {
          if (page.moduleType === 'word-search') {
            const moduleSettings = page.settings as PuzzleModuleSettings;
            const ws = moduleSettings.wordSearchSettings;
            const titleWords = moduleSettings.titleWords?.title ?? page.name;
            const titleMode = ws?.typography?.selectTitleOption ?? '';
            // Do not include free-text titles in this key — every keystroke would
            // re-sync TOC and thrash editors (Custom Title boxes felt uneditable).
            return `${page.id}:${page.moduleType}:${titleWords}:${titleMode}`;
          }
          const settings = page.settings as TextModuleSettings;
          if (page.moduleType === 'table-of-contents') {
            const toc = settings.tocSettings;
            return `${page.id}:${page.moduleType}:${settings.title ?? page.name}:${toc?.entryScope}:${toc?.chapterCount}:${(toc?.chapters ?? []).map((c) => c.title).join(',')}:${(toc?.excludedDocumentIds ?? []).join(',')}:${(toc?.revealedDocumentIds ?? []).join(',')}:${toc?.includePuzzlePages}:${toc?.includeSolutionPages}:${toc?.hideDocuments}:${toc?.hidePuzzleDocuments}:${(toc?.customEntries ?? []).map((c) => `${c.id}:${c.title}:${c.pageNumber}`).join(';')}:${toc?.columnLayout}:${toc?.twoColumnMinEntries}:${toc?.tableFormat}:${toc?.showPageNumbers}:${toc?.leaderStyle}`;
          }
          const titleBlock =
            settings.blocks?.find((block) => block.kind === 'title')?.text?.trim() ?? '';
          const subtitle =
            settings.blocks?.find((block) => block.kind === 'subtitle')?.text?.trim() ?? '';
          return `${page.id}:${page.moduleType}:${settings.title ?? page.name}:${titleBlock}:${subtitle}:${settings.isChapterPage ? 1 : 0}`;
        })
        .join('|'),
    [documentPages]
  );

  // Keep auto TOC documents in sync with tab order, titles, and page numbering.
  useEffect(() => {
    if (!settingsHydrated) return;
    setDocumentPages((prev) => {
      const pageNumberSettings = resolvePageNumberSettingsForBook(prev, wordSearchSettings);
      return syncAutoTocInDocuments(prev, batchPuzzles, pageNumberSettings);
    });
  }, [
    settingsHydrated,
    documentStructureKey,
    batchPuzzles,
    wordSearchSettings.typography.pageNumber,
  ]);

  const persistPagePuzzleSettings = useCallback(
    (pageId: string, titleWordsSettings: TitleWordsSettings, ws: WordSearchSettings) => {
      setDocumentPages((prev) =>
        prev.map((page) =>
          page.id === pageId
            ? {
                ...page,
                settings: {
                  ...page.settings,
                  titleWords: titleWordsSettings,
                  wordSearchSettings: ws,
                } as PuzzleModuleSettings,
              }
            : page
        )
      );
    },
    []
  );

  const persistPageCrosswordSettings = useCallback(
    (pageId: string, titleWordsSettings: TitleWordsSettings, cw: CrosswordSettings) => {
      setDocumentPages((prev) =>
        prev.map((page) =>
          page.id === pageId
            ? {
                ...page,
                settings: {
                  ...page.settings,
                  titleWords: titleWordsSettings,
                  crosswordSettings: cw,
                } as PuzzleModuleSettings,
              }
            : page
        )
      );
    },
    []
  );

  const persistPageGenericSettings = useCallback(
    (pageId: string, titleWordsSettings: TitleWordsSettings, gp: GenericPuzzleSettings) => {
      setDocumentPages((prev) =>
        prev.map((page) =>
          page.id === pageId
            ? {
                ...page,
                settings: {
                  ...page.settings,
                  titleWords: titleWordsSettings,
                  genericPuzzleSettings: gp,
                } as PuzzleModuleSettings,
              }
            : page
        )
      );
    },
    []
  );

  const persistPageMurdokuSettings = useCallback(
    (pageId: string, titleWordsSettings: TitleWordsSettings, md: MurdokuSettings) => {
      setDocumentPages((prev) =>
        prev.map((page) =>
          page.id === pageId
            ? {
                ...page,
                settings: {
                  ...page.settings,
                  titleWords: titleWordsSettings,
                  murdokuSettings: md,
                } as PuzzleModuleSettings,
              }
            : page
        )
      );
    },
    []
  );

  const prevActiveDocumentPageId = useRef<string>(activeDocumentPageId);

  useEffect(() => {
    const previousPageId = prevActiveDocumentPageId.current;
    if (previousPageId && previousPageId !== activeDocumentPageId) {
      const previousPage = documentPages.find((page) => page.id === previousPageId);
      if (previousPage?.moduleType === 'word-search') {
        persistPagePuzzleSettings(previousPageId, titleWords, wordSearchSettings);
      } else if (previousPage?.moduleType === 'crossword') {
        persistPageCrosswordSettings(previousPageId, titleWords, crosswordSettings);
      } else if (previousPage?.moduleType === 'murdoku') {
        persistPageMurdokuSettings(previousPageId, titleWords, murdokuSettings);
      } else if (previousPage && isGenericPuzzleModuleType(previousPage.moduleType)) {
        persistPageGenericSettings(previousPageId, titleWords, genericPuzzleSettings);
      }
    }
    prevActiveDocumentPageId.current = activeDocumentPageId;
  }, [
    activeDocumentPageId,
    documentPages,
    persistPagePuzzleSettings,
    persistPageCrosswordSettings,
    persistPageGenericSettings,
    persistPageMurdokuSettings,
    wordSearchSettings,
    crosswordSettings,
    murdokuSettings,
    genericPuzzleSettings,
    titleWords,
  ]);

  useEffect(() => {
    if (!activeDocumentPage || !settingsHydrated) return;
    if (activeDocumentPage.moduleType === 'word-search') {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      const documentWs = pageSettings.wordSearchSettings ?? getDefaultWordSearchSettings();
      setWordSearchSettings(
        mergeDocumentSettingsPreservingLayout(documentWs, wordSearchSettingsRef.current)
      );
      setTitleWords(pageSettings.titleWords ?? defaultTitleWords);
      setCurrentPuzzleType('word-search');
    } else if (activeDocumentPage.moduleType === 'crossword') {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      const tw = pageSettings.titleWords ?? defaultTitleWords;
      const baseCw = normalizeCrosswordSettings(
        pageSettings.crosswordSettings ?? getDefaultCrosswordSettings()
      );
      const withAnswers =
        !baseCw.core.answersText && tw.words?.length
          ? {
              ...baseCw,
              core: { ...baseCw.core, answersText: tw.words.join('\n') },
            }
          : baseCw;
      setCrosswordSettings(
        applyLayoutSettingsToCrosswordDocument(withAnswers, wordSearchSettingsRef.current)
      );
      setTitleWords(tw);
      setCurrentPuzzleType('crossword');
    } else if (activeDocumentPage.moduleType === 'murdoku') {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      setMurdokuSettings(
        applyLayoutSettingsToMurdokuDocument(
          normalizeMurdokuSettings(pageSettings.murdokuSettings),
          wordSearchSettingsRef.current
        )
      );
      setTitleWords(pageSettings.titleWords ?? defaultTitleWords);
      setCurrentPuzzleType('murdoku');
    } else if (isGenericPuzzleModuleType(activeDocumentPage.moduleType)) {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      setGenericPuzzleSettings(
        applyLayoutSettingsToGenericDocument(
          normalizeGenericPuzzleSettings(
            pageSettings.genericPuzzleSettings,
            activeDocumentPage.moduleType
          ),
          wordSearchSettingsRef.current
        )
      );
      setTitleWords(pageSettings.titleWords ?? defaultTitleWords);
      setCurrentPuzzleType(activeDocumentPage.moduleType as PuzzleType);
    } else if (isPuzzleModuleType(activeDocumentPage.moduleType)) {
      setCurrentPuzzleType(activeDocumentPage.moduleType as PuzzleType);
    }
  }, [activeDocumentPage?.id, settingsHydrated]);

  const insertDocumentPage = useCallback(
    (type: InsertableDocumentKind, position: 'before' | 'after', referenceId?: string) => {
      pushEditHistory();
      const refId = referenceId ?? activeDocumentPageId;
      let newPage = createInsertableDocumentPage(type);
      if (isPuzzleModuleType(newPage.moduleType)) {
        newPage = applyBookLayoutToDocumentPage(newPage, wordSearchSettingsRef.current);
      }
      if (type === 'chapter-page') {
        try {
          const raw =
            typeof window !== 'undefined'
              ? window.localStorage.getItem(CHAPTER_PAGE_STYLE_STORAGE_KEY)
              : null;
          const style = normalizeChapterPageStyle(raw ? JSON.parse(raw) : null);
          newPage = createStyledChapterDocumentPage('Chapter', style);
        } catch {
          newPage = createStyledChapterDocumentPage('Chapter');
        }
      }
      setDocumentPages((prev) => {
        if (prev.length === 0) {
          setShowEditorTutorial(false);
        }
        const idx = prev.findIndex((page) => page.id === refId);
        const insertAt =
          position === 'before'
            ? idx === -1
              ? 0
              : idx
            : idx === -1
              ? prev.length
              : idx + 1;
        const next = [...prev];
        next.splice(insertAt, 0, newPage);
        return next;
      });
      setActiveDocumentPageId(newPage.id);
      setShowEditorTutorial(false);
    },
    [activeDocumentPageId, pushEditHistory]
  );

  const appendAiGeneratedBundle = useCallback(
    (
      bundle: AiGeneratedBundle,
      position?: { side: 'before' | 'after'; referenceId: string }
    ) => {
      if (!bundle.pages.length) return;
      pushEditHistory();
      const refId = position?.referenceId ?? activeDocumentPageId;
      const side = position?.side ?? 'after';
      setDocumentPages((prev) => {
        if (prev.length === 0) return bundle.pages.map((page) =>
          applyBookLayoutToDocumentPage(page, wordSearchSettingsRef.current)
        );
        const idx = prev.findIndex((page) => page.id === refId);
        const insertAt =
          side === 'before'
            ? idx === -1
              ? 0
              : idx
            : idx === -1
              ? prev.length
              : idx + 1;
        const stamped = bundle.pages.map((page) =>
          applyBookLayoutToDocumentPage(page, wordSearchSettingsRef.current)
        );
        const next = [...prev];
        next.splice(insertAt, 0, ...stamped);
        return next;
      });
      if (bundle.batchPuzzles.length > 0) {
        setBatchPuzzles((prev) =>
          normalizeBatchPuzzleDocumentIndices([...prev, ...bundle.batchPuzzles])
        );
      }
      if (bundle.crosswordBatchPuzzles.length > 0) {
        setCrosswordBatchPuzzles((prev) => [...prev, ...bundle.crosswordBatchPuzzles]);
      }
      if (bundle.genericBatchPuzzles.length > 0) {
        setGenericBatchPuzzles((prev) => [...prev, ...bundle.genericBatchPuzzles]);
      }
      if (bundle.murdokuBatchPuzzles.length > 0) {
        setMurdokuBatchPuzzles((prev) => [...prev, ...bundle.murdokuBatchPuzzles]);
      }
      setActiveDocumentPageId(bundle.pages[0]!.id);
      setCurrentBatchIndex(0);
      setCurrentPuzzle(
        bundle.batchPuzzles[0] ??
          bundle.crosswordBatchPuzzles[0] ??
          bundle.genericBatchPuzzles[0] ??
          bundle.murdokuBatchPuzzles[0] ??
          null
      );
      setShowSolution(false);
      setShowEditorTutorial(false);
      setPuzzleGenerationVersion((v) => v + 1);
    },
    [activeDocumentPageId, pushEditHistory]
  );

  const applyAiGeneratedToActiveDocument = useCallback(
    (bundle: AiGeneratedBundle) => {
      const activePage = documentPages.find((page) => page.id === activeDocumentPageId);
      if (!activePage || !isPuzzleModuleType(activePage.moduleType)) return;
      const overlaid = overlayAiBundleOntoPage(activePage, bundle);
      const merged = overlaid.pages[0];
      if (!merged) return;
      pushEditHistory();
      setDocumentPages((prev) =>
        prev.map((page) => (page.id === merged.id ? merged : page))
      );
      const settings = merged.settings as PuzzleModuleSettings;
      if (merged.moduleType === 'word-search') {
        if (settings.wordSearchSettings) setWordSearchSettings(settings.wordSearchSettings);
        if (settings.titleWords) setTitleWords(settings.titleWords);
        setBatchPuzzles((prev) =>
          normalizeBatchPuzzleDocumentIndices(
            prev
              .filter((puzzle) => puzzle.pageId !== merged.id)
              .concat(overlaid.batchPuzzles)
          )
        );
      } else if (merged.moduleType === 'crossword') {
        if (settings.crosswordSettings) {
          setCrosswordSettings(normalizeCrosswordSettings(settings.crosswordSettings));
        }
        if (settings.titleWords) setTitleWords(settings.titleWords);
        setCrosswordBatchPuzzles((prev) => [
          ...prev.filter((puzzle) => puzzle.pageId !== merged.id),
          ...overlaid.crosswordBatchPuzzles,
        ]);
      } else if (merged.moduleType === 'murdoku') {
        if (settings.murdokuSettings) {
          setMurdokuSettings(normalizeMurdokuSettings(settings.murdokuSettings));
        }
        if (settings.titleWords) setTitleWords(settings.titleWords);
        setMurdokuBatchPuzzles((prev) => [
          ...prev.filter((puzzle) => puzzle.pageId !== merged.id),
          ...overlaid.murdokuBatchPuzzles,
        ]);
      } else if (isGenericPuzzleModuleType(merged.moduleType)) {
        if (settings.genericPuzzleSettings) {
          setGenericPuzzleSettings(
            normalizeGenericPuzzleSettings(settings.genericPuzzleSettings, merged.moduleType)
          );
        }
        if (settings.titleWords) setTitleWords(settings.titleWords);
        setGenericBatchPuzzles((prev) => [
          ...prev.filter((puzzle) => puzzle.pageId !== merged.id),
          ...overlaid.genericBatchPuzzles,
        ]);
      }
      setCurrentPuzzleType(merged.moduleType);
      setCurrentBatchIndex(0);
      setCurrentPuzzle(
        overlaid.batchPuzzles[0] ??
          overlaid.crosswordBatchPuzzles[0] ??
          overlaid.genericBatchPuzzles[0] ??
          overlaid.murdokuBatchPuzzles[0] ??
          null
      );
      setShowSolution(false);
      setPuzzleGenerationVersion((v) => v + 1);
    },
    [activeDocumentPageId, documentPages, pushEditHistory]
  );

  const insertSeparatorTitlePageAfter = useCallback(
    (anchor: CompiledPage) => {
      const result = buildSeparatorInsertAfterCompiledPage(documentPages, batchPuzzles, anchor);
      if (!result) return;
      pushEditHistory();
      setDocumentPages(result.documentPages);
      setBatchPuzzles(result.batchPuzzles);
      setActiveDocumentPageId(result.newTitlePageId);
      setShowEditorTutorial(false);
    },
    [documentPages, batchPuzzles, pushEditHistory]
  );

  const removeDocumentPage = useCallback((id: string) => {
    pushEditHistory();
    setDocumentPages((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((page) => page.id !== id);
      if (filtered.length === prev.length) return prev;
      setActiveDocumentPageId((current) => (current === id ? filtered[0].id : current));
      return filtered;
    });
    setBatchPuzzles((prev) => prev.filter((puzzle) => puzzle.pageId !== id));
    setCrosswordBatchPuzzles((prev) => prev.filter((puzzle) => puzzle.pageId !== id));
    setMurdokuBatchPuzzles((prev) => prev.filter((puzzle) => puzzle.pageId !== id));
    setGenericBatchPuzzles((prev) => prev.filter((puzzle) => puzzle.pageId !== id));
  }, [pushEditHistory]);

  const duplicateDocumentPage = useCallback((id: string) => {
    pushEditHistory();
    const newPageId = `duplicate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setDocumentPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      if (index === -1) return prev;

      const source = prev[index];
      // Deep clone so the copy never shares settings references with the original.
      const duplicated: DocumentPage = {
        ...structuredClone(source),
        id: newPageId,
        name: `${source.name} Copy`,
        createdAt: Date.now(),
      };

      const next = [...prev.slice(0, index + 1), duplicated, ...prev.slice(index + 1)];
      setActiveDocumentPageId(duplicated.id);
      return next;
    });

    setBatchPuzzles((prevPuzzles) => {
      const sourcePage = documentPages.find((page) => page.id === id);
      if (!sourcePage || sourcePage.moduleType !== 'word-search') {
        return prevPuzzles;
      }

      const sourcePagePuzzles = prevPuzzles.filter((puzzle) => puzzle.pageId === id);
      if (sourcePagePuzzles.length === 0) {
        return prevPuzzles;
      }

      const clonedPuzzles = sourcePagePuzzles.map((puzzle, index) => ({
        ...structuredClone(puzzle),
        pageId: newPageId,
        puzzleIndexInDocument: index,
      }));

      const lastSourceIndex = prevPuzzles.reduce((lastIndex, puzzle, idx) => {
        return puzzle.pageId === id ? idx : lastIndex;
      }, -1);

      if (lastSourceIndex === -1) {
        return normalizeBatchPuzzleDocumentIndices([...prevPuzzles, ...clonedPuzzles]);
      }

      const result = [
        ...prevPuzzles.slice(0, lastSourceIndex + 1),
        ...clonedPuzzles,
        ...prevPuzzles.slice(lastSourceIndex + 1),
      ];

      return normalizeBatchPuzzleDocumentIndices(result);
    });

    setCrosswordBatchPuzzles((prev) => {
      const sourcePage = documentPages.find((page) => page.id === id);
      if (!sourcePage || sourcePage.moduleType !== 'crossword') return prev;
      const sourcePuzzles = prev.filter((puzzle) => puzzle.pageId === id);
      if (sourcePuzzles.length === 0) return prev;
      const cloned = sourcePuzzles.map((puzzle, index) => ({
        ...structuredClone(puzzle),
        pageId: newPageId,
        puzzleIndexInDocument: index,
      }));
      return [...prev, ...cloned];
    });

    setMurdokuBatchPuzzles((prev) => {
      const sourcePage = documentPages.find((page) => page.id === id);
      if (!sourcePage || sourcePage.moduleType !== 'murdoku') return prev;
      const sourcePuzzles = prev.filter((puzzle) => puzzle.pageId === id);
      if (sourcePuzzles.length === 0) return prev;
      const cloned = sourcePuzzles.map((puzzle, index) => ({
        ...structuredClone(puzzle),
        pageId: newPageId,
        puzzleIndexInDocument: index,
      }));
      return [...prev, ...cloned];
    });

    setGenericBatchPuzzles((prev) => {
      const sourcePage = documentPages.find((page) => page.id === id);
      if (!sourcePage || !isGenericPuzzleModuleType(sourcePage.moduleType)) return prev;
      const sourcePuzzles = prev.filter((puzzle) => puzzle.pageId === id);
      if (sourcePuzzles.length === 0) return prev;
      const cloned = sourcePuzzles.map((puzzle, index) => ({
        ...structuredClone(puzzle),
        pageId: newPageId,
        puzzleIndexInDocument: index,
      }));
      return [...prev, ...cloned];
    });
  }, [documentPages, pushEditHistory]);

  const removeCompiledBookPage = useCallback(
    (page: CompiledPage) => {
      if (page.kind === 'solution' || page.kind === 'blank') return;

      if (page.kind === 'text') {
        removeDocumentPage(page.sourceDocumentId);
        return;
      }

      if (page.kind !== 'puzzle') return;

      pushEditHistory();
      const docId = page.sourceDocumentId;
      const removeIndex = Math.max(0, page.puzzleIndexInDocument ?? 0);

      const docPuzzles = batchPuzzles.filter((puzzle) => puzzle.pageId === docId);
      if (removeIndex >= docPuzzles.length) return;

      const targetPuzzle = docPuzzles[removeIndex];
      const removedBatchIndex = batchPuzzles.findIndex((puzzle) => puzzle === targetPuzzle);
      const remainingCount = docPuzzles.length - 1;

      const shiftIndexMap = <T,>(prev: Map<number, T>): Map<number, T> => {
        if (removedBatchIndex < 0) return prev;
        const next = new Map<number, T>();
        for (const [key, value] of prev.entries()) {
          if (key === removedBatchIndex) continue;
          next.set(key > removedBatchIndex ? key - 1 : key, value);
        }
        return next;
      };

      // Drop page-local canvas overrides for the removed book page and reindex the rest.
      if (removedBatchIndex >= 0) {
        setPageOverrides((prev) => shiftIndexMap(prev));
        setPagePuzzleGridScales((prev) => shiftIndexMap(prev));
      }

      if (remainingCount <= 0) {
        // Last puzzle in this document — remove the document tab entirely.
        setBatchPuzzles((prev) => prev.filter((puzzle) => puzzle !== targetPuzzle));
        setDocumentPages((docs) => {
          if (docs.length <= 1) return docs;
          const filtered = docs.filter((doc) => doc.id !== docId);
          if (filtered.length === 0) return docs;
          setActiveDocumentPageId((current) =>
            current === docId ? filtered[0]?.id ?? current : current
          );
          return filtered;
        });
        return;
      }

      // Still has puzzles — strip matching Document settings (words / titles / fun facts)
      // and decrement Quantity so the control panel matches the canvas.
      const startNumber = (() => {
        const doc = documentPages.find((d) => d.id === docId);
        if (doc?.moduleType === 'word-search') {
          const ws = (doc.settings as PuzzleModuleSettings).wordSearchSettings;
          return Math.max(1, Math.round(ws?.core?.puzzlesStartingNumber ?? 1));
        }
        if (activeDocumentPageId === docId) {
          return Math.max(1, Math.round(wordSearchSettings.core?.puzzlesStartingNumber ?? 1));
        }
        return 1;
      })();

      setBatchPuzzles((prev) => {
        const next = prev.filter((puzzle) => puzzle !== targetPuzzle);
        let keptIdx = 0;
        return next.map((puzzle) => {
          if (puzzle.pageId !== docId) return puzzle;
          const idx = keptIdx++;
          return {
            ...puzzle,
            puzzleIndexInDocument: idx,
            puzzleNumber: startNumber + idx,
          };
        });
      });

      const patchDocumentPuzzleSettings = (
        settings: PuzzleModuleSettings
      ): PuzzleModuleSettings => {
        const ws = settings.wordSearchSettings ?? getDefaultWordSearchSettings();
        const wpp = getEffectiveWordsPerPuzzle(ws.wordList);
        const nextTitleWords = removePuzzleWordsFromTitleList(
          settings.titleWords ?? defaultTitleWords,
          removeIndex,
          wpp
        );
        const nextTypography = {
          ...ws.typography,
          titleText: removeContentLineAt(ws.typography?.titleText ?? '', removeIndex),
          funFactsText: removeContentLineAt(ws.typography?.funFactsText ?? '', removeIndex),
        };
        const nextCore = {
          ...ws.core,
          numberOfPuzzles: Math.max(1, remainingCount),
        };
        return {
          ...settings,
          titleWords: nextTitleWords,
          wordSearchSettings: {
            ...ws,
            core: nextCore,
            typography: nextTypography,
          },
        };
      };

      setDocumentPages((docs) =>
        docs.map((doc) => {
          if (doc.id !== docId || doc.moduleType !== 'word-search') return doc;
          return {
            ...doc,
            settings: patchDocumentPuzzleSettings(doc.settings as PuzzleModuleSettings),
          };
        })
      );

      // Keep the live Document panel in sync when this tab is active.
      if (activeDocumentPageId === docId) {
        setTitleWords((prev) => {
          const wpp = getEffectiveWordsPerPuzzle(wordSearchSettings.wordList);
          return removePuzzleWordsFromTitleList(prev, removeIndex, wpp);
        });
        setWordSearchSettings((prev) => ({
          ...prev,
          core: {
            ...prev.core,
            numberOfPuzzles: Math.max(1, remainingCount),
          },
          typography: {
            ...prev.typography,
            titleText: removeContentLineAt(prev.typography?.titleText ?? '', removeIndex),
            funFactsText: removeContentLineAt(prev.typography?.funFactsText ?? '', removeIndex),
          },
        }));
      }
    },
    [
      pushEditHistory,
      removeDocumentPage,
      batchPuzzles,
      documentPages,
      activeDocumentPageId,
      wordSearchSettings.wordList?.wordsPerPuzzle,
      wordSearchSettings.wordList?.oneWordPerPuzzle,
      wordSearchSettings.core?.puzzlesStartingNumber,
    ]
  );

  const moveDocumentPage = useCallback((id: string, direction: 'up' | 'down') => {
    pushEditHistory();
    setDocumentPages((prev) => {
      const index = prev.findIndex((page) => page.id === id);
      if (index === -1) return prev;
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const nextPages = [...prev];
      [nextPages[index], nextPages[nextIndex]] = [nextPages[nextIndex], nextPages[index]];
      return nextPages;
    });
  }, [pushEditHistory]);

  const reorderDocumentPages = useCallback((activeId: string, overId: string) => {
    if (activeId === overId) return;
    pushEditHistory();
    setDocumentPages((prev) => {
      const fromIndex = prev.findIndex((page) => page.id === activeId);
      const toIndex = prev.findIndex((page) => page.id === overId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const nextPages = [...prev];
      const [moved] = nextPages.splice(fromIndex, 1);
      nextPages.splice(toIndex, 0, moved);
      return nextPages;
    });
  }, [pushEditHistory]);

  const updateDocumentPage = useCallback((id: string, updates: Partial<DocumentPage>) => {
    pushEditHistory();
    setDocumentPages((prev) => prev.map((page) => (page.id === id ? { ...page, ...updates } : page)));
  }, [pushEditHistory]);

  const replaceDocumentPages = useCallback(
    (pages: DocumentPage[], activeId?: string | null) => {
      if (pages.length === 0) return;
      pushEditHistory();
      setDocumentPages(pages);
      setShowEditorTutorial(false);
      if (activeId && pages.some((p) => p.id === activeId)) {
        setActiveDocumentPageId(activeId);
      } else {
        setActiveDocumentPageId(pages[0].id);
      }
    },
    [pushEditHistory]
  );

  const updateActiveTextModuleSettings = useCallback(
    (
      updates:
        | Partial<TextModuleSettings>
        | ((prev: TextModuleSettings) => Partial<TextModuleSettings>),
      options?: { recordHistory?: boolean }
    ) => {
      if (!activeDocumentPageId) return;
      if (options?.recordHistory !== false) {
        pushEditHistory();
      }
      setDocumentPages((prev) =>
        prev.map((page) => {
          if (page.id !== activeDocumentPageId) return page;
          const current = page.settings as TextModuleSettings;
          const patch = typeof updates === 'function' ? updates(current) : updates;
          return {
            ...page,
            settings: { ...current, ...patch } as TextModuleSettings,
          };
        })
      );
    },
    [activeDocumentPageId, pushEditHistory]
  );

  const applyTextSettingsToDocumentPages = useCallback(
    (
      updates: Array<{ pageId: string; settings: TextModuleSettings }>,
      options?: { recordHistory?: boolean }
    ) => {
      if (updates.length === 0) return;
      if (options?.recordHistory !== false) {
        pushEditHistory();
      }
      const byId = new Map(updates.map((entry) => [entry.pageId, entry.settings]));
      setDocumentPages((prev) =>
        prev.map((page) => {
          const nextSettings = byId.get(page.id);
          if (!nextSettings) return page;
          return {
            ...page,
            settings: nextSettings,
          };
        })
      );
    },
    [pushEditHistory]
  );

  const updatePageOverride = useCallback((pageIndex: number, updates: Partial<WordSearchSettings>) => {
    pushEditHistory();
    setPageOverrides(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(pageIndex) || {};
      newMap.set(pageIndex, {
        ...current,
        ...updates,
        bookCanvas: { ...current.bookCanvas, ...updates.bookCanvas },
        core: { ...current.core, ...updates.core },
        typography: { ...current.typography, ...updates.typography },
        wordList: { ...current.wordList, ...updates.wordList },
        colors: updates.colors
          ? {
              ...(current.colors ?? {}),
              ...updates.colors,
              ...(updates.colors.puzzlePage
                ? {
                    puzzlePage: mergePuzzlePageColors(
                      current.colors?.puzzlePage ?? updates.colors.puzzlePage,
                      updates.colors.puzzlePage
                    ),
                  }
                : {}),
              ...(updates.colors.answerPage
                ? {
                    answerPage: {
                      ...(current.colors?.answerPage ?? {}),
                      ...updates.colors.answerPage,
                    },
                  }
                : {}),
            }
          : current.colors,
        pageFrameSettings: updates.pageFrameSettings
          ? { ...current.pageFrameSettings, ...updates.pageFrameSettings }
          : current.pageFrameSettings,
      });
      return newMap;
    });
    setStylingTrigger(t => t + 1);
  }, [pushEditHistory]);

  const clearPageOverride = useCallback((pageIndex: number) => {
    pushEditHistory();
    setPageOverrides(prev => {
      const newMap = new Map(prev);
      newMap.delete(pageIndex);
      return newMap;
    });
    setStylingTrigger(t => t + 1);
  }, [pushEditHistory]);

  const clearAllPageOverrides = useCallback(() => {
    pushEditHistory();
    setPageOverrides(new Map());
    setStylingTrigger(t => t + 1);
  }, [pushEditHistory]);

  const setPagePuzzleGridScale = useCallback((pageIndex: number, scale: number) => {
    setPagePuzzleGridScales((prev) => {
      const next = new Map(prev);
      next.set(pageIndex, scale);
      return next;
    });
    setStylingTrigger((t) => t + 1);
  }, []);

  const clearPagePuzzleGridScale = useCallback((pageIndex: number) => {
    setPagePuzzleGridScales((prev) => {
      if (!prev.has(pageIndex)) return prev;
      const next = new Map(prev);
      next.delete(pageIndex);
      return next;
    });
    setStylingTrigger((t) => t + 1);
  }, []);

  const clearAllPagePuzzleGridScales = useCallback(() => {
    setPagePuzzleGridScales(new Map());
    setStylingTrigger((t) => t + 1);
  }, []);



  const updateWordSearchSettings = useCallback((updates: Partial<WordSearchSettings>) => {
    pushEditHistory();

    let prevSettings: WordSearchSettings | null = null;
    let nextSettings: WordSearchSettings | null = null;
    let startingNumberChanged: number | undefined;

    setWordSearchSettings((prev) => {
      prevSettings = prev;
      const next = mergeWordSearchSettingsUpdate(prev, updates);
      nextSettings = next;
      if (
        updates.core?.puzzlesStartingNumber !== undefined &&
        updates.core.puzzlesStartingNumber !== prev.core.puzzlesStartingNumber
      ) {
        startingNumberChanged = updates.core.puzzlesStartingNumber;
      }
      return next;
    });

    if (startingNumberChanged !== undefined) {
      const start = startingNumberChanged;
      setBatchPuzzles((batch) =>
        batch.map((puzzle) => {
          if (activeDocumentPageId && puzzle.pageId && puzzle.pageId !== activeDocumentPageId) {
            return puzzle;
          }
          const idx = Math.max(0, puzzle.puzzleIndexInDocument ?? 0);
          return { ...puzzle, puzzleNumber: start + idx };
        })
      );
    }

    // Persist document-specific puzzle settings onto the active tab.
    // Layout fields (trim / style / page numbers) are copied to every puzzle document.
    if (nextSettings) {
      const layoutScope = prevSettings ? detectLayoutSyncScope(prevSettings, updates) : null;
      const synced = nextSettings;
      setDocumentPages((pages) => {
        let nextPages = pages;
        if (activeDocumentPageId) {
          nextPages = nextPages.map((page) => {
            if (page.id !== activeDocumentPageId || page.moduleType !== 'word-search') {
              return page;
            }
            return {
              ...page,
              settings: {
                ...page.settings,
                wordSearchSettings: synced,
              } as PuzzleModuleSettings,
            };
          });
        }
        if (layoutScope) {
          nextPages = overlayBookLayoutOnAllDocuments(
            nextPages,
            synced,
            getFullLayoutSyncScope()
          );
        }
        return nextPages;
      });
      if (layoutScope) {
        setCrosswordSettings((prev) =>
          applyLayoutSettingsToCrosswordDocument(prev, synced)
        );
        setMurdokuSettings((prev) => applyLayoutSettingsToMurdokuDocument(prev, synced));
        setGenericPuzzleSettings((prev) =>
          applyLayoutSettingsToGenericDocument(prev, synced)
        );
      }
    }

    setStylingTrigger((t) => t + 1);
  }, [
    pushEditHistory,
    activeDocumentPageId,
  ]);

  const updateCrosswordSettings = useCallback((updates: Partial<CrosswordSettings>) => {
    pushEditHistory();
    let nextSettings: CrosswordSettings | null = null;
    setCrosswordSettings((prev) => {
      nextSettings = normalizeCrosswordSettings({
        ...prev,
        ...updates,
        bookCanvas: { ...prev.bookCanvas, ...updates.bookCanvas },
        core: updates.core ? { ...prev.core, ...updates.core } : prev.core,
        typography: updates.typography
          ? { ...prev.typography, ...updates.typography }
          : prev.typography,
        colors: updates.colors ? { ...prev.colors, ...updates.colors } : prev.colors,
        pageFrameSettings: updates.pageFrameSettings
          ? { ...prev.pageFrameSettings, ...updates.pageFrameSettings }
          : prev.pageFrameSettings,
      });
      return nextSettings;
    });
    if (activeDocumentPageId && nextSettings) {
      const synced = nextSettings;
      setDocumentPages((pages) =>
        pages.map((page) => {
          if (page.id !== activeDocumentPageId || page.moduleType !== 'crossword') {
            return page;
          }
          return {
            ...page,
            settings: {
              ...page.settings,
              crosswordSettings: synced,
            } as PuzzleModuleSettings,
          };
        })
      );
    }
    setStylingTrigger((t) => t + 1);
  }, [pushEditHistory, activeDocumentPageId]);

  const updateGenericPuzzleSettings = useCallback(
    (updates: Partial<GenericPuzzleSettings>) => {
      pushEditHistory();
      let nextSettings: GenericPuzzleSettings | null = null;
      setGenericPuzzleSettings((prev) => {
        nextSettings = {
          core: updates.core ? { ...prev.core, ...updates.core } : prev.core,
          typography: updates.typography
            ? { ...prev.typography, ...updates.typography }
            : prev.typography,
          colors: updates.colors ? { ...prev.colors, ...updates.colors } : prev.colors,
        };
        return nextSettings;
      });
      if (activeDocumentPageId && nextSettings) {
        const synced = nextSettings;
        setDocumentPages((pages) =>
          pages.map((page) => {
            if (
              page.id !== activeDocumentPageId ||
              !isGenericPuzzleModuleType(page.moduleType)
            ) {
              return page;
            }
            return {
              ...page,
              settings: {
                ...page.settings,
                genericPuzzleSettings: synced,
              } as PuzzleModuleSettings,
            };
          })
        );
      }
      setStylingTrigger((t) => t + 1);
    },
    [pushEditHistory, activeDocumentPageId]
  );

  const updateMurdokuSettings = useCallback((updates: Partial<MurdokuSettings>) => {
    pushEditHistory();
    let nextSettings: MurdokuSettings | null = null;
    setMurdokuSettings((prev) => {
      nextSettings = normalizeMurdokuSettings({
        ...prev,
        ...updates,
        bookCanvas: { ...prev.bookCanvas, ...updates.bookCanvas },
        core: updates.core ? { ...prev.core, ...updates.core } : prev.core,
        theme: updates.theme ? { ...prev.theme, ...updates.theme } : prev.theme,
        story: updates.story ? { ...prev.story, ...updates.story } : prev.story,
        grid: updates.grid ? { ...prev.grid, ...updates.grid } : prev.grid,
        cards: updates.cards ? { ...prev.cards, ...updates.cards } : prev.cards,
        deductionGrid: updates.deductionGrid
          ? { ...prev.deductionGrid, ...updates.deductionGrid }
          : prev.deductionGrid,
        layout: updates.layout ? { ...prev.layout, ...updates.layout } : prev.layout,
        textStyles: updates.textStyles ? { ...prev.textStyles, ...updates.textStyles } : prev.textStyles,
        artwork: updates.artwork ? { ...prev.artwork, ...updates.artwork } : prev.artwork,
        characters: updates.characters ?? prev.characters,
        rooms: updates.rooms ?? prev.rooms,
        elements: updates.elements ?? prev.elements,
      });
      return nextSettings;
    });
    if (activeDocumentPageId && nextSettings) {
      const synced = nextSettings;
      setDocumentPages((pages) =>
        pages.map((page) => {
          if (page.id !== activeDocumentPageId || page.moduleType !== 'murdoku') return page;
          return {
            ...page,
            settings: {
              ...page.settings,
              murdokuSettings: synced,
            } as PuzzleModuleSettings,
          };
        })
      );
    }
    setStylingTrigger((t) => t + 1);
  }, [pushEditHistory, activeDocumentPageId]);

  const replaceMurdokuPuzzle = useCallback((puzzle: MurdokuPuzzle) => {
    pushEditHistory();
    setMurdokuBatchPuzzles((prev) =>
      prev.map((existing) =>
        existing.pageId === puzzle.pageId &&
        (existing.puzzleIndexInDocument ?? 0) === (puzzle.puzzleIndexInDocument ?? 0)
          ? puzzle
          : existing
      )
    );
    setCurrentPuzzle((current) => {
      if (!current || current.type !== 'murdoku') return current;
      const existing = current as MurdokuPuzzle;
      if (
        existing.pageId === puzzle.pageId &&
        (existing.puzzleIndexInDocument ?? 0) === (puzzle.puzzleIndexInDocument ?? 0)
      ) {
        return puzzle;
      }
      return current;
    });
  }, [pushEditHistory]);

  const applyTrimSizeLayoutChange = useCallback(
    (
      bookCanvasUpdates: Partial<WordSearchSettings['bookCanvas']>,
      dimensions?: { width: number; height: number }
    ) => {
      const trimChangeRef: {
        ratio: number;
        prevSettings: WordSearchSettings | null;
        nextSettings: WordSearchSettings | null;
      } = { ratio: 1, prevSettings: null, nextSettings: null };

      setWordSearchSettings((prev) => {
        trimChangeRef.prevSettings = prev;
        const prevDims = resolveTrimDimensions(prev.bookCanvas);
        const nextBookCanvas = { ...prev.bookCanvas, ...bookCanvasUpdates };
        const nextDims = dimensions ?? resolveTrimDimensions(nextBookCanvas);
        const ratio = computeTrimScaleRatio(
          prevDims.width,
          prevDims.height,
          nextDims.width,
          nextDims.height
        );
        const scaled = applyTrimLayoutToSettings(prev, ratio);

        trimChangeRef.ratio = ratio;
        trimChangeRef.nextSettings = {
          ...prev,
          ...scaled,
          bookCanvas: {
            ...nextBookCanvas,
            customWidth: nextDims.width,
            customHeight: nextDims.height,
          },
        };
        return trimChangeRef.nextSettings;
      });

      const { ratio, prevSettings, nextSettings } = trimChangeRef;
      if (!nextSettings || !prevSettings) {
        return;
      }

      const shouldScale = Math.abs(ratio - 1) >= 0.001;
      if (shouldScale) {
        setPuzzleGridScale((scale) => scaleGridScalePercent(scale, ratio));
        setPageMargin((margin) => scaleInt(margin, ratio, 20));
        setTitleToAnswerGap((gap) => scaleInt(gap, ratio, 4));
        setSolutionToSolutionGap((gap) => scaleInt(gap, ratio, 4));
        setTitleWords((tw) => applyTrimLayoutToTitleWords(tw, ratio));
        setPageOverrides((overrides) =>
          scalePageOverridesForTrim(overrides, prevSettings, ratio, nextSettings.bookCanvas)
        );
        setPagePuzzleGridScales((scales) => scalePagePuzzleGridScalesForTrim(scales, ratio));
      }

      // Trim / page size is a book-wide Layout setting — apply to every document.
      setDocumentPages((pages) => {
        const scaled = shouldScale
          ? scaleDocumentPagesForTrim(pages, ratio, nextSettings.bookCanvas)
          : pages;
        return overlayBookLayoutOnAllDocuments(
          scaled,
          nextSettings,
          getFullLayoutSyncScope()
        );
      });
      setCrosswordSettings((prev) =>
        applyLayoutSettingsToCrosswordDocument(prev, nextSettings)
      );
      setMurdokuSettings((prev) => applyLayoutSettingsToMurdokuDocument(prev, nextSettings));
      setGenericPuzzleSettings((prev) =>
        applyLayoutSettingsToGenericDocument(prev, nextSettings)
      );
      setStylingTrigger((t) => t + 1);
    },
    []
  );

  const applyLayoutSettingsToAllPuzzleDocuments = useCallback(() => {
    pushEditHistory();
    const source = wordSearchSettings;
    const scope = getFullLayoutSyncScope();
    const { pages, puzzleDocCount } = syncLayoutSettingsAcrossAllPuzzleDocuments(
      documentPages,
      source,
      scope
    );
    setDocumentPages(pages);

    // Clear per-page visual overrides so Layout truly wins everywhere.
    setPageOverrides((overrides) => stripVisualOverridesFromMap(overrides, scope));

    // Refresh live settings for the active non-WS puzzle tab.
    const active = pages.find((p) => p.id === activeDocumentPageId);
    if (active?.moduleType === 'crossword') {
      const cw = (active.settings as PuzzleModuleSettings).crosswordSettings;
      if (cw) setCrosswordSettings(cw);
    } else if (active?.moduleType === 'murdoku') {
      const md = (active.settings as PuzzleModuleSettings).murdokuSettings;
      if (md) setMurdokuSettings(normalizeMurdokuSettings(md));
    } else if (active && isGenericPuzzleModuleType(active.moduleType)) {
      const gp = (active.settings as PuzzleModuleSettings).genericPuzzleSettings;
      if (gp) setGenericPuzzleSettings(gp);
    }

    setStylingTrigger((t) => t + 1);
    setValidationError({
      type: puzzleDocCount <= 0 ? 'error' : 'warning',
      message:
        puzzleDocCount <= 0
          ? 'No puzzle documents to update. Add a puzzle tab first.'
          : `Layout settings applied to ${puzzleDocCount} puzzle document${puzzleDocCount === 1 ? '' : 's'} (trim, colors, frame, page numbers).`,
    });
  }, [
    pushEditHistory,
    wordSearchSettings,
    documentPages,
    activeDocumentPageId,
  ]);

  // Load saved puzzles from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('puzzle-generator-saves');
      if (saved) {
        try {
          setSavedPuzzles(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load saved puzzles:', e);
        }
      }
    }
  }, []);

  // Save puzzles to localStorage
  const savePuzzleToStorage = useCallback((puzzles: SavedPuzzle[]) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('puzzle-generator-saves', JSON.stringify(puzzles));
    }
  }, []);

  // Helper to get directions from settings
  const getDirections = useCallback((ws: WordSearchSettings): Direction[] => {
    const directions: Direction[] = [];
    if (ws.core.allowRight) directions.push('horizontal');
    if (ws.core.allowLeft) directions.push('horizontal-reverse');
    if (ws.core.allowDown) directions.push('vertical');
    if (ws.core.allowUp) directions.push('vertical-reverse');
    if (ws.core.allowDiagonalDown) directions.push('diagonal-down');
    if (ws.core.allowDiagonalUp) directions.push('diagonal-up');
    if (ws.core.allowDiagonalDownReverse) directions.push('diagonal-down-reverse');
    if (ws.core.allowDiagonalUpReverse) directions.push('diagonal-up-reverse');
    return directions.length > 0 ? directions : ['horizontal', 'vertical', 'diagonal-down', 'diagonal-up'];
  }, []);

  // Validate and generate batch puzzles for the active word-search document only
  const validateAndGenerate = useCallback(async (options?: GeneratePuzzleOptions): Promise<boolean> => {
    const activePage = documentPages.find(
      (page) => page.id === activeDocumentPageId && page.moduleType === 'word-search'
    );

    if (!activePage) {
      setValidationError({
        type: 'error',
        message: 'Select a word search document tab to generate puzzles.',
      });
      return false;
    }

    if (options?.clearPageCustomizations) {
      clearAllPageOverrides();
      clearAllPagePuzzleGridScales();
    }

    persistPagePuzzleSettings(activeDocumentPageId, titleWords, wordSearchSettings);

    const pageWords = titleWords.words;
    const ws = wordSearchSettings;
    const wordsPerPuzzle = getEffectiveWordsPerPuzzle(ws.wordList);
    const wordRepeatCount = getWordRepeatCount(ws.wordList);
    const fillWithWordLettersOnly = getFillWithWordLettersOnly(ws.wordList);
    const required = ws.core.numberOfPuzzles * wordsPerPuzzle;

    if (pageWords.length < required) {
      setValidationError({
        type: 'error',
        message: ws.wordList.oneWordPerPuzzle
          ? `One-word mode needs ${required} words (1 per puzzle). You only have ${pageWords.length} words.`
          : `You need ${required} words for ${ws.core.numberOfPuzzles} puzzles (${wordsPerPuzzle} words per puzzle). You only have ${pageWords.length} words.`,
      });
      return false;
    }

    let shapeMaskCache = new Map<string, boolean[][]>();
    const resolveShapeMaskForPuzzle = async (
      puzzleIndex: number
    ): Promise<boolean[][] | undefined> => {
      if (!ws.core.shapeWordSearchEnabled) return undefined;
      const imageSrc = resolveShapeMaskImageSrc(ws.core, puzzleIndex);
      if (!imageSrc) {
        const mode = ws.core.shapeMaskMode ?? 'common';
        throw new Error(
          mode === 'per-puzzle'
            ? `Upload a shape image for puzzle ${puzzleIndex + 1} (or use batch upload).`
            : 'Upload a PNG silhouette for Shape Word Search before generating.'
        );
      }
      const cacheKey = `${imageSrc.length}:${ws.core.lettersAcross}x${ws.core.lettersDown}:${ws.core.shapeMaskFit ?? 'contain'}:${ws.core.shapeMaskAlphaThreshold ?? 40}:${imageSrc.slice(0, 64)}`;
      const cached = shapeMaskCache.get(cacheKey);
      if (cached) return cached;
      const mask = await buildWordSearchShapeMask(
        imageSrc,
        ws.core.lettersAcross,
        ws.core.lettersDown,
        {
          alphaThreshold: ws.core.shapeMaskAlphaThreshold ?? 40,
          fit: ws.core.shapeMaskFit ?? 'contain',
        }
      );
      shapeMaskCache.set(cacheKey, mask);
      return mask;
    };

    if (ws.core.shapeWordSearchEnabled) {
      const mode = ws.core.shapeMaskMode ?? 'common';
      if (mode === 'common' && !ws.core.shapeMaskImage) {
        setValidationError({
          type: 'error',
          message: 'Upload a PNG silhouette for Shape Word Search before generating.',
        });
        return false;
      }
      if (mode === 'per-puzzle') {
        const images = ws.core.shapeMaskImages ?? [];
        const missing: number[] = [];
        for (let i = 0; i < ws.core.numberOfPuzzles; i++) {
          if (!images[i] && !ws.core.shapeMaskImage) missing.push(i + 1);
        }
        if (missing.length > 0) {
          setValidationError({
            type: 'error',
            message: `Missing shape images for puzzle${missing.length > 1 ? 's' : ''} ${missing.join(', ')}. Upload a batch or fill each slot.`,
          });
          return false;
        }
      }
    }

    const directions = getDirections(wordSearchSettings);
    const preserveSet = new Set(options?.preserveEditedPageIndices ?? []);
    const existingByDocIndex = new Map<number, WordSearchPuzzle>();
    const existingBatchIndexByDocIndex = new Map<number, number>();
    for (let batchIndex = 0; batchIndex < batchPuzzles.length; batchIndex++) {
      const puzzle = batchPuzzles[batchIndex];
      if (puzzle?.pageId !== activePage.id) continue;
      const docIdx = puzzle.puzzleIndexInDocument ?? 0;
      existingByDocIndex.set(docIdx, puzzle);
      existingBatchIndexByDocIndex.set(docIdx, batchIndex);
    }

    const newPuzzles: WordSearchPuzzle[] = [];

    try {
    for (let i = 0; i < ws.core.numberOfPuzzles; i++) {
        const batchIndex = existingBatchIndexByDocIndex.get(i);
        if (batchIndex !== undefined && preserveSet.has(batchIndex)) {
          const existing = existingByDocIndex.get(i);
          if (existing) {
            newPuzzles.push({
              ...existing,
              puzzleNumber: ws.core.puzzlesStartingNumber + i,
              puzzleIndexInDocument: i,
              pageId: activePage.id,
              pageName: activePage.name,
            });
            continue;
          }
        }

        const startIdx = i * wordsPerPuzzle;
        const endIdx = startIdx + wordsPerPuzzle;
        const puzzleWords = pageWords.slice(startIdx, endIdx);

      if (puzzleWords.length === 0) break;

        const shapeMask = await resolveShapeMaskForPuzzle(i);
      const puzzle = generateWordSearch(
        puzzleWords,
        ws.core.lettersAcross,
        ws.core.lettersDown,
        directions,
          ws.wordList.aiLanguage,
          shapeMask,
          wordRepeatCount,
          fillWithWordLettersOnly
      ) as WordSearchPuzzle;

      puzzle.puzzleNumber = ws.core.puzzlesStartingNumber + i;
        puzzle.puzzleIndexInDocument = i;
        puzzle.pageId = activePage.id;
        puzzle.pageName = activePage.name;
        newPuzzles.push(puzzle);
      }
    } catch (error) {
      setValidationError({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not read the shape mask image.',
      });
      return false;
    }

    const wordSearchPageIds = documentPages
      .filter((page) => page.moduleType === 'word-search')
      .map((page) => page.id);

    const puzzlesByPage = new Map<string, WordSearchPuzzle[]>();
    for (const puzzle of batchPuzzles) {
      if (puzzle.pageId === activePage.id) continue;
      const pageKey = puzzle.pageId ?? '__default__';
      if (!puzzlesByPage.has(pageKey)) puzzlesByPage.set(pageKey, []);
      puzzlesByPage.get(pageKey)!.push(puzzle);
    }
    puzzlesByPage.set(activePage.id, newPuzzles);

    const mergedPuzzles: WordSearchPuzzle[] = [];
    for (const pageId of wordSearchPageIds) {
      const pagePuzzles = puzzlesByPage.get(pageId);
      if (pagePuzzles) mergedPuzzles.push(...pagePuzzles);
    }
    for (const [pageKey, pagePuzzles] of puzzlesByPage) {
      if (!wordSearchPageIds.includes(pageKey)) {
        mergedPuzzles.push(...pagePuzzles);
      }
    }

    const normalizedPuzzles = normalizeBatchPuzzleDocumentIndices(mergedPuzzles);
    const activeStartIndex = normalizedPuzzles.findIndex(
      (puzzle) => puzzle.pageId === activePage.id
    );

    setValidationError(null);
    setBatchPuzzles(normalizedPuzzles);
    setCurrentBatchIndex(activeStartIndex >= 0 ? activeStartIndex : 0);
    setShowSolution(false);
    setPuzzleGenerationVersion((version) => version + 1);
    return true;
  }, [
    documentPages,
    activeDocumentPageId,
    wordSearchSettings,
    titleWords,
    batchPuzzles,
    getDirections,
    persistPagePuzzleSettings,
    clearAllPageOverrides,
    clearAllPagePuzzleGridScales,
  ]);

  const regeneratePuzzleAtIndex = useCallback(
    async (
      batchIndex: number,
      wordsOverride?: string[],
      options?: {
        lettersAcross?: number;
        lettersDown?: number;
        settings?: WordSearchSettings;
      }
    ): Promise<WordSearchPuzzle | null> => {
      const puzzle = batchPuzzles[batchIndex];
      if (!puzzle?.pageId) {
        setValidationError({
          type: 'error',
          message: 'No puzzle found for this page.',
        });
        return null;
      }

      const ws = options?.settings ?? wordSearchSettings;
      const idx = Math.max(0, puzzle.puzzleIndexInDocument ?? 0);
      const wpp = getEffectiveWordsPerPuzzle(ws.wordList);
      const wordRepeatCount = getWordRepeatCount(ws.wordList);
      const fillWithWordLettersOnly = getFillWithWordLettersOnly(ws.wordList);
      const start = idx * wpp;
      const puzzleWords =
        wordsOverride && wordsOverride.length > 0
          ? wordsOverride
          : titleWords.words.slice(start, start + wpp).filter(Boolean);

      if (puzzleWords.length === 0) {
        setValidationError({
          type: 'error',
          message: 'Add at least one word for this puzzle before updating.',
        });
        return null;
      }

      const lettersAcross = options?.lettersAcross ?? ws.core.lettersAcross;
      const lettersDown = options?.lettersDown ?? ws.core.lettersDown;
      const directions = getDirections(ws);

      let shapeMask: boolean[][] | undefined;
      if (ws.core.shapeWordSearchEnabled) {
        const imageSrc = resolveShapeMaskImageSrc(ws.core, idx);
        if (!imageSrc) {
          const mode = ws.core.shapeMaskMode ?? 'common';
          setValidationError({
            type: 'error',
            message:
              mode === 'per-puzzle'
                ? `Upload a shape image for puzzle ${idx + 1} before regenerating.`
                : 'Upload a PNG silhouette for Shape Word Search before regenerating.',
          });
          return null;
        }
        try {
          shapeMask = await buildWordSearchShapeMask(
            imageSrc,
            lettersAcross,
            lettersDown,
            {
              alphaThreshold: ws.core.shapeMaskAlphaThreshold ?? 40,
              fit: ws.core.shapeMaskFit ?? 'contain',
            }
          );
        } catch (error) {
          setValidationError({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not read the shape mask image.',
          });
          return null;
        }
      }

      const regenerated = generateWordSearch(
        puzzleWords,
        lettersAcross,
        lettersDown,
        directions,
        ws.wordList.aiLanguage,
        shapeMask,
        wordRepeatCount,
        fillWithWordLettersOnly
      ) as WordSearchPuzzle;

      regenerated.puzzleNumber = ws.core.puzzlesStartingNumber + idx;
      regenerated.puzzleIndexInDocument = idx;
      regenerated.pageId = puzzle.pageId;
      regenerated.pageName = puzzle.pageName;

      setValidationError(null);
      setBatchPuzzles((prev) => {
        const next = [...prev];
        if (batchIndex < 0 || batchIndex >= next.length) return prev;
        next[batchIndex] = regenerated;
        return normalizeBatchPuzzleDocumentIndices(next);
      });
      setPuzzleGenerationVersion((version) => version + 1);
      return regenerated;
    },
    [batchPuzzles, wordSearchSettings, titleWords, getDirections]
  );

  const restoreBatchPuzzleAtIndex = useCallback((batchIndex: number, puzzle: WordSearchPuzzle) => {
    setBatchPuzzles((prev) => {
      if (batchIndex < 0 || batchIndex >= prev.length) return prev;
      const next = [...prev];
      next[batchIndex] = puzzle;
      return normalizeBatchPuzzleDocumentIndices(next);
    });
    setPuzzleGenerationVersion((version) => version + 1);
  }, []);

  const splitActiveDocumentIntoChaptersAndGenerate = useCallback(
    async (options: GeneratePuzzleOptions): Promise<boolean> => {
      const request = options.splitIntoChapters;
      const activePage = documentPages.find((page) => page.id === activeDocumentPageId);
      if (!request || !activePage) return false;

      const isWordSearch = activePage.moduleType === 'word-search';
      const isCrossword = activePage.moduleType === 'crossword';
      if (!isWordSearch && !isCrossword) return false;

      if (options.clearPageCustomizations) {
        clearAllPageOverrides();
        clearAllPagePuzzleGridScales();
        setPageCrosswordOverrides(new Map());
      }

      const liveSettings: PuzzleModuleSettings = {
        ...(activePage.settings as PuzzleModuleSettings),
        titleWords,
        ...(isWordSearch ? { wordSearchSettings } : {}),
        ...(isCrossword ? { crosswordSettings } : {}),
      };
      const sourcePage: DocumentPage = { ...activePage, settings: liveSettings };

      if (isWordSearch) {
        const wordsPerPuzzle = getEffectiveWordsPerPuzzle(wordSearchSettings.wordList);
        const required = wordSearchSettings.core.numberOfPuzzles * wordsPerPuzzle;
        if (titleWords.words.length < required) {
          setValidationError({
            type: 'error',
            message: wordSearchSettings.wordList.oneWordPerPuzzle
              ? `One-word mode needs ${required} words (1 per puzzle). You only have ${titleWords.words.length} words.`
              : `You need ${required} words for ${wordSearchSettings.core.numberOfPuzzles} puzzles (${wordsPerPuzzle} words per puzzle). You only have ${titleWords.words.length} words.`,
          });
          return false;
        }
      }

      const numberOfPuzzles = isWordSearch
        ? wordSearchSettings.core.numberOfPuzzles
        : crosswordSettings.core.numberOfPuzzles;
      const puzzlesStartingNumber = isWordSearch
        ? wordSearchSettings.core.puzzlesStartingNumber
        : crosswordSettings.core.puzzlesStartingNumber;
      const plan = buildChapterSplitPlan({
        numberOfPuzzles,
        chapterCount: request.chapterCount,
        chapterTitles: request.chapterTitles,
        puzzlesStartingNumber,
      });
      if (!plan) {
        setValidationError({
          type: 'error',
          message: 'Need at least two chapters and enough puzzles to divide the lists.',
        });
        return false;
      }

      const documentsWithLive = documentPages.map((doc) =>
        doc.id === sourcePage.id ? sourcePage : doc
      );
      const split = splitPuzzleDocumentByChapters({
        documents: documentsWithLive,
        sourceDocumentId: sourcePage.id,
        plan,
      });
      if (!split) {
        setValidationError({
          type: 'error',
          message: 'Could not divide this document into chapters.',
        });
        return false;
      }

      writeChapterTitlesDraft({ titles: plan.chapterTitles, touched: true });
      writeDivideListsPreference({ enabled: false, chapterCount: plan.chapterCount });
      replaceDocumentPages(split.documentPages, split.firstPuzzleDocId);

      try {
        if (isWordSearch) {
          const directions = getDirections(wordSearchSettings);
          const allNew: WordSearchPuzzle[] = [];
          for (const id of split.puzzleDocIds) {
            const page = split.documentPages.find((doc) => doc.id === id);
            if (!page) continue;
            allNew.push(...(await buildWordSearchPuzzlesForDocumentPage({ page, directions })));
          }

          const wordSearchPageIds = split.documentPages
            .filter((page) => page.moduleType === 'word-search')
            .map((page) => page.id);
          const puzzlesByPage = new Map<string, WordSearchPuzzle[]>();
          for (const puzzle of batchPuzzles) {
            if (puzzle.pageId === sourcePage.id || split.puzzleDocIds.includes(puzzle.pageId ?? '')) {
              continue;
            }
            const key = puzzle.pageId ?? '__default__';
            if (!puzzlesByPage.has(key)) puzzlesByPage.set(key, []);
            puzzlesByPage.get(key)!.push(puzzle);
          }
          for (const puzzle of allNew) {
            const key = puzzle.pageId ?? '__default__';
            if (!puzzlesByPage.has(key)) puzzlesByPage.set(key, []);
            puzzlesByPage.get(key)!.push(puzzle);
          }
          const merged: WordSearchPuzzle[] = [];
          for (const pageId of wordSearchPageIds) {
            const pagePuzzles = puzzlesByPage.get(pageId);
            if (pagePuzzles) merged.push(...pagePuzzles);
          }
          for (const [key, pagePuzzles] of puzzlesByPage) {
            if (!wordSearchPageIds.includes(key)) merged.push(...pagePuzzles);
          }

          const firstPage = split.documentPages.find((doc) => doc.id === split.firstPuzzleDocId);
          const firstSettings = firstPage?.settings as PuzzleModuleSettings | undefined;
          if (firstSettings?.wordSearchSettings) {
            setWordSearchSettings(firstSettings.wordSearchSettings);
          }
          if (firstSettings?.titleWords) setTitleWords(firstSettings.titleWords);

          setBatchPuzzles(normalizeBatchPuzzleDocumentIndices(merged));
          setCurrentPuzzleType('word-search');
        } else {
          const allNew: CrosswordPuzzle[] = [];
          for (const id of split.puzzleDocIds) {
            const page = split.documentPages.find((doc) => doc.id === id);
            if (!page) continue;
            allNew.push(...buildCrosswordPuzzlesForDocumentPage(page));
          }
          if (allNew.length === 0) {
            setValidationError({
              type: 'error',
              message: 'No valid answers to place. Check answer length and characters.',
            });
            return false;
          }

          const crosswordPageIds = split.documentPages
            .filter((page) => page.moduleType === 'crossword')
            .map((page) => page.id);
          setCrosswordBatchPuzzles((prev) => {
            const byPage = new Map<string, CrosswordPuzzle[]>();
            for (const existing of prev) {
              if (existing.pageId === sourcePage.id || split.puzzleDocIds.includes(existing.pageId ?? '')) {
                continue;
              }
              const key = existing.pageId ?? '__default__';
              if (!byPage.has(key)) byPage.set(key, []);
              byPage.get(key)!.push(existing);
            }
            for (const puzzle of allNew) {
              const key = puzzle.pageId ?? '__default__';
              if (!byPage.has(key)) byPage.set(key, []);
              byPage.get(key)!.push(puzzle);
            }
            const nextBatch: CrosswordPuzzle[] = [];
            for (const id of crosswordPageIds) {
              const pagePuzzles = byPage.get(id);
              if (pagePuzzles) nextBatch.push(...pagePuzzles);
            }
            for (const [key, pagePuzzles] of byPage) {
              if (!crosswordPageIds.includes(key)) nextBatch.push(...pagePuzzles);
            }
            return nextBatch;
          });

          const firstPage = split.documentPages.find((doc) => doc.id === split.firstPuzzleDocId);
          const firstSettings = firstPage?.settings as PuzzleModuleSettings | undefined;
          if (firstSettings?.crosswordSettings) {
            setCrosswordSettings(firstSettings.crosswordSettings);
          }
          if (firstSettings?.titleWords) setTitleWords(firstSettings.titleWords);
          setCurrentPuzzle(allNew[0] ?? null);
          setCurrentPuzzleType('crossword');
        }
      } catch (error) {
        setValidationError({
          type: 'error',
          message: error instanceof Error ? error.message : 'Could not generate chapter documents.',
        });
        return false;
      }

      setValidationError(null);
      setCurrentBatchIndex(0);
      setShowSolution(false);
      setPuzzleGenerationVersion((version) => version + 1);
      return true;
    },
    [
      activeDocumentPageId,
      batchPuzzles,
      crosswordSettings,
      documentPages,
      getDirections,
      replaceDocumentPages,
      titleWords,
      wordSearchSettings,
      clearAllPageOverrides,
      clearAllPagePuzzleGridScales,
    ]
  );

  // Generate puzzle (triggers validation for word search)
  const generatePuzzle = useCallback(async (options?: GeneratePuzzleOptions) => {
    setValidationError(null);

    const activePage = documentPages.find((page) => page.id === activeDocumentPageId);
    // Prefer the active document module so Update N always targets the open tab.
    const typeToGenerate =
      activePage && isPuzzleModuleType(activePage.moduleType)
        ? (activePage.moduleType as PuzzleType)
        : currentPuzzleType;

    if (options?.splitIntoChapters) {
      await splitActiveDocumentIntoChaptersAndGenerate(options);
      return;
    }

    if (typeToGenerate === 'word-search') {
      await validateAndGenerate(options);
      return;
    }

    // Non-word-search puzzle generation
    let puzzle: Puzzle | null = null;

    switch (typeToGenerate) {
      case 'crossword': {
        const cw = normalizeCrosswordSettings(crosswordSettings);
        const core = cw.core;
        const answersFromCore = parseCrosswordLines(core.answersText);
        const answers =
          answersFromCore.length > 0
            ? answersFromCore
            : titleWords.words.filter(Boolean);
        const clues = parseCrosswordLines(core.cluesText);
        const cluesPerPuzzle = Math.max(1, core.cluesPerPuzzle || 15);
        const puzzleCount = Math.max(1, core.numberOfPuzzles || 1);
        const pageId = activePage?.id ?? activeDocumentPageId;
        const pageName = activePage?.name ?? 'Crossword';

        if (!pageId || activePage?.moduleType !== 'crossword') {
          setValidationError({
            type: 'error',
            message: 'Select a crossword document tab to generate puzzles.',
          });
          return;
        }

        if (answers.length === 0) {
          setValidationError({
            type: 'error',
            message:
              'Add answers (one per line) in the Words tab before generating a crossword.',
          });
          return;
        }

        // Same contract as word search: only drop per-page styling overrides
        // when the caller explicitly asks for it.
        if (options?.clearPageCustomizations) {
          setPageCrosswordOverrides(new Map());
        }

        // Always build exactly `puzzleCount` puzzles. Answer pool wraps / rotates so
        // Update N works even when answers.length < puzzleCount * cluesPerPuzzle.
        const generated: CrosswordPuzzle[] = [];
        for (let i = 0; i < puzzleCount; i++) {
          const wordClues = buildCrosswordWordClues({
            answers,
            clues,
            startIndex: i * cluesPerPuzzle,
            count: cluesPerPuzzle,
            maxClueCharacters: core.maxClueCharacters,
            maxAnswerLength: core.maxAnswerLength,
            allowNumbers: core.allowNumbersInAnswers,
            language: core.language,
          });
          if (wordClues.length === 0) continue;

          const next = generateCrossword(wordClues, {
            lettersAcross: core.lettersAcross,
            lettersDown: core.lettersDown,
            allowNumbers: core.allowNumbersInAnswers,
            maxAnswerLength: core.maxAnswerLength,
            exactClueCount: core.exactClueCount === true,
            language: core.language,
          });
          generated.push({
            ...next,
            pageId,
            pageName,
            puzzleIndexInDocument: i,
            puzzleNumber: core.puzzlesStartingNumber + i,
          });
        }

        if (generated.length === 0) {
          setValidationError({
            type: 'error',
            message: 'No valid answers to place. Check answer length and characters.',
          });
          return;
        }

        // Replace this document's crossword batch; keep other crossword docs intact.
        const crosswordPageIds = documentPages
          .filter((page) => page.moduleType === 'crossword')
          .map((page) => page.id);

        setCrosswordBatchPuzzles((prev) => {
          const byPage = new Map<string, CrosswordPuzzle[]>();
          for (const existing of prev) {
            if (existing.pageId === pageId) continue;
            const key = existing.pageId ?? '__default__';
            if (!byPage.has(key)) byPage.set(key, []);
            byPage.get(key)!.push(existing);
          }
          byPage.set(pageId, generated);

          const nextBatch: CrosswordPuzzle[] = [];
          for (const id of crosswordPageIds) {
            const pagePuzzles = byPage.get(id);
            if (pagePuzzles) nextBatch.push(...pagePuzzles);
          }
          for (const [key, pagePuzzles] of byPage) {
            if (!crosswordPageIds.includes(key)) nextBatch.push(...pagePuzzles);
          }
          return nextBatch;
        });

        // Crossword pagination uses a document-local index (0..N-1).
        const localIdx = Math.min(
          Math.max(0, currentBatchIndex),
          Math.max(0, generated.length - 1)
        );
        setCurrentBatchIndex(localIdx);
        setCurrentPuzzle(generated[localIdx] ?? generated[0] ?? null);
        setCurrentPuzzleType('crossword');
        setShowSolution(false);
        setPuzzleGenerationVersion((v) => v + 1);
        return;
      }

      case 'sudoku':
      case 'maze':
      case 'cryptogram':
      case 'word-scramble':
      case 'trivia': {
        const moduleType = typeToGenerate;
        if (!activePage || activePage.moduleType !== moduleType) {
          setValidationError({
            type: 'error',
            message: `Select a ${moduleType} document tab to generate puzzles.`,
          });
          return;
        }
        const gp = normalizeGenericPuzzleSettings(genericPuzzleSettings, moduleType);
        const puzzleCount = Math.max(1, gp.core.numberOfPuzzles || 1);
        const pageId = activePage.id;
        const pageName = activePage.name;

        if (moduleType === 'sudoku') {
          const block = sudokuModeGenerationBlockMessage(gp.core);
          if (block) {
            setValidationError({ type: 'error', message: block });
            return;
          }
        }

        // Same contract as word search / crossword: only drop per-page styling
        // overrides when the caller explicitly asks for it.
        if (options?.clearPageCustomizations) {
          setPageGenericOverrides(new Map());
        }

        const parseLines = (text: string) =>
          (text || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        const phrasePool =
          moduleType === 'cryptogram'
            ? (() => {
                const custom = parseLines(gp.core.cryptogramPhrases);
                return custom.length > 0 ? custom : FAMOUS_QUOTES.map((q) => q.text);
              })()
            : [];
        const scramblePool =
          moduleType === 'word-scramble'
            ? (() => {
                const custom = parseLines(gp.core.scrambleWords);
                return custom.length > 0 ? custom : DEFAULT_SCRAMBLE_WORDS;
              })()
            : [];

        if (moduleType === 'trivia') {
          const questions = parseTriviaLines(gp.core.questionsText);
          const suggestions = parseTriviaLines(gp.core.suggestionsText);
          const answers = parseTriviaLines(gp.core.answersText);
          const requiredQuestions = Math.max(1, gp.core.numberOfPuzzles || 1);
          const suggestionsPerQuestion = Math.max(2, gp.core.suggestionsPerQuestion || 4);
          const missingSuggestions = getMissingTriviaSuggestions(
            suggestions.length,
            requiredQuestions,
            suggestionsPerQuestion
          );
          if (questions.length < requiredQuestions) {
            setValidationError({
              type: 'error',
              message: `Add ${requiredQuestions} questions (one per line). You have ${questions.length}.`,
            });
            return;
          }
          if (missingSuggestions > 0) {
            setValidationError({
              type: 'error',
              message: `Need ${missingSuggestions} more suggestion${missingSuggestions === 1 ? '' : 's'} for ${requiredQuestions} questions × ${suggestionsPerQuestion} suggestions each.`,
            });
            return;
          }
          if (answers.length < requiredQuestions) {
            setValidationError({
              type: 'error',
              message: `Add ${requiredQuestions} answers (one per line). You have ${answers.length}.`,
            });
            return;
          }
        }

        const mazeShapePlan =
          moduleType === 'maze' && gp.core.mazeShape === 'mixed'
            ? expandMixedMazeShapePlan({
                square: gp.core.mazeMixedShapeSquare,
                circle: gp.core.mazeMixedShapeCircle,
                diamond: gp.core.mazeMixedShapeDiamond,
                hexagon: gp.core.mazeMixedShapeHexagon,
                triangle: gp.core.mazeMixedShapeTriangle,
                custom_image: gp.core.mazeMixedShapeCustomImage ?? 0,
              })
            : null;
        const mazeSizePlan =
          moduleType === 'maze' && gp.core.mazeSize === 'mixed'
            ? expandMixedMazeLevelPlan(
                {
                  easy: gp.core.mazeMixedEasyCount,
                  medium: gp.core.mazeMixedMediumCount,
                  hard: gp.core.mazeMixedHardCount,
                },
                {
                  easy: {
                    length: gp.core.mazeEasyGridLength,
                    width: gp.core.mazeEasyGridWidth,
                  },
                  medium: {
                    length: gp.core.mazeMediumGridLength,
                    width: gp.core.mazeMediumGridWidth,
                  },
                  hard: {
                    length: gp.core.mazeHardGridLength,
                    width: gp.core.mazeHardGridWidth,
                  },
                }
              )
            : null;
        const sudokuSizePlan =
          moduleType === 'sudoku' && gp.core.sudokuSize === 'mixed'
            ? expandMixedSudokuSizePlan({
                4: gp.core.sudokuMixedSize4,
                6: gp.core.sudokuMixedSize6,
                9: gp.core.sudokuMixedSize9,
                12: gp.core.sudokuMixedSize12,
                16: gp.core.sudokuMixedSize16,
                25: gp.core.sudokuMixedSize25,
              })
            : null;
        const sudokuDifficultyPlan =
          moduleType === 'sudoku' && gp.core.sudokuDifficulty === 'mixed'
            ? expandMixedSudokuDifficultyPlan({
                easy: gp.core.sudokuMixedEasyCount,
                medium: gp.core.sudokuMixedMediumCount,
                hard: gp.core.sudokuMixedHardCount,
              })
            : null;

        const generated: GenericBatchPuzzle[] = [];
        if (moduleType === 'trivia') {
          const batch = buildTriviaBatch({
            totalQuestions: Math.max(1, gp.core.numberOfPuzzles || 1),
            questionsPerPage: gp.core.questionsPerPage,
            suggestionsPerQuestion: gp.core.suggestionsPerQuestion,
            questionsText: gp.core.questionsText,
            suggestionsText: gp.core.suggestionsText,
            answersText: gp.core.answersText,
          });
          batch.puzzles.forEach((next, i) => {
            generated.push({
              ...next,
              pageId,
              pageName,
              puzzleIndexInDocument: i,
              puzzleNumber: gp.core.puzzlesStartingNumber + i,
            });
          });
        } else {
        const sudokuMode = gp.core.sudokuPuzzleMode ?? 'standard';
        const includeStandard = gp.core.sudokuMixedIncludeStandard !== false;
        const includeCalcudoku = gp.core.sudokuMixedIncludeCalcudoku !== false;
        const typePlan: Array<'standard' | 'calcudoku'> =
          moduleType !== 'sudoku'
            ? []
            : sudokuMode === 'calcudoku'
              ? Array.from({ length: puzzleCount }, () => 'calcudoku' as const)
              : sudokuMode === 'mixed'
                ? shuffledBalancedPlan(
                    [
                      ...(includeStandard ? (['standard'] as const) : []),
                      ...(includeCalcudoku ? (['calcudoku'] as const) : []),
                    ],
                    puzzleCount
                  )
                : Array.from({ length: puzzleCount }, () => 'standard' as const);
        const calcudokuCount = typePlan.filter((kind) => kind === 'calcudoku').length;
        const standardCount = typePlan.filter((kind) => kind === 'standard').length;
        const calcudokuSizeChoices = resolveCalcudokuGridSizes(gp.core);
        const calcudokuSizePlan = shuffledBalancedPlan(calcudokuSizeChoices, calcudokuCount);
        const calcudokuDiffChoices = resolveCalcudokuDifficulties(gp.core);
        const calcudokuDiffPlan = shuffledBalancedPlan(calcudokuDiffChoices, calcudokuCount);
        const mixedTypeStandardSizePlan =
          sudokuMode === 'mixed' && standardCount > 0 && sudokuSizePlan
            ? sampleOrCyclePlan(sudokuSizePlan, standardCount)
            : null;
        const mixedTypeStandardDiffPlan =
          sudokuMode === 'mixed' && standardCount > 0 && sudokuDifficultyPlan
            ? sampleOrCyclePlan(sudokuDifficultyPlan, standardCount)
            : null;
        const calcudokuFingerprints = new Set<string>();
        let standardCursor = 0;
        let calcudokuCursor = 0;

        try {
        for (let i = 0; i < puzzleCount; i++) {
          let next: GenericBatchPuzzle;
          if (moduleType === 'sudoku') {
            const kind = typePlan[i] ?? 'standard';
            if (kind === 'calcudoku') {
              const size =
                calcudokuSizePlan[calcudokuCursor] ?? calcudokuSizeChoices[0] ?? 6;
              const difficulty =
                calcudokuDiffPlan[calcudokuCursor] ?? calcudokuDiffChoices[0] ?? 'easy';
              calcudokuCursor += 1;
              next = generateCalcudoku({
                size,
                difficulty,
                seenFingerprints: calcudokuFingerprints,
              });
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
            } else {
              const sizeIndex = sudokuMode === 'mixed' ? standardCursor : i;
              const size: SudokuSize =
                mixedTypeStandardSizePlan?.[standardCursor] ??
                sudokuSizePlan?.[sizeIndex] ??
                (isSudokuSize(gp.core.sudokuSize) ? gp.core.sudokuSize : 9);
              const difficulty: Difficulty =
                mixedTypeStandardDiffPlan?.[standardCursor] ??
                sudokuDifficultyPlan?.[sizeIndex] ??
                (gp.core.sudokuDifficulty === 'mixed'
                  ? 'medium'
                  : (gp.core.sudokuDifficulty as Difficulty));
              standardCursor += 1;
              next = generateSudoku({ difficulty, size });
            }
          } else if (moduleType === 'maze') {
            const currentShapeMode: MazeShapeMode =
              mazeShapePlan?.[i] ??
              (gp.core.mazeShape as MazeShapeMode);
            const isCustomImageShape = currentShapeMode === 'custom_image';
            const shape: MazeShape =
              isCustomImageShape || currentShapeMode === 'mixed'
                ? 'square'
                : (currentShapeMode as MazeShape);
            const level = mazeSizePlan?.[i];
            const size: MazeSizePreset =
              level?.size ??
              (gp.core.mazeSize === 'mixed' ? 'medium' : (gp.core.mazeSize as MazeSizePreset));

            const dims = resolveMazeDimensions({
              size,
              gridLength: level?.gridLength,
              gridWidth: level?.gridWidth,
              gridSize: level?.gridSize,
            });

            // Shape Maze: resolve image → boolean mask
            let mazeCustomShapeMask: boolean[][] | undefined;
            const isShapeMaze = isCustomImageShape || Boolean(gp.core.shapeMazeEnabled);
            if (isShapeMaze) {
              const imageSrc = resolveShapeMaskImageSrc(gp.core, i);
              if (imageSrc) {
                try {
                  mazeCustomShapeMask = await buildWordSearchShapeMask(
                    imageSrc,
                    dims.cols,
                    dims.rows
                  );
                } catch (e) {
                  console.warn('Shape maze mask generation failed:', e);
                }
              }
            }

            next = generateMaze({
              size,
              gridLength: level?.gridLength,
              gridWidth: level?.gridWidth,
              gridSize: level?.gridSize,
              difficulty: level?.difficulty,
              shape,
              startSide: gp.core.mazeStartSide,
              endSide: gp.core.mazeEndSide,
              variationSeed: i,
              customShapeMask: mazeCustomShapeMask,
            });
          } else if (moduleType === 'cryptogram') {
            next = generateCryptogram(phrasePool[i % phrasePool.length], {
              cipherType: gp.core.cipherType,
              hintCount: gp.core.showLetterHints ? gp.core.hintLettersCount : 0,
            });
          } else {
            const wordsPer = Math.max(1, gp.core.wordsPerPuzzle || 10);
            const pool =
              scramblePool.length > 0 ? scramblePool : DEFAULT_SCRAMBLE_WORDS;
            const chunk: string[] = [];
            for (let j = 0; j < wordsPer; j++) {
              chunk.push(pool[(i * wordsPer + j) % pool.length]);
            }
            next = generateWordScramble(chunk);
          }
          generated.push({
            ...next,
            pageId,
            pageName,
            puzzleIndexInDocument: i,
            puzzleNumber: gp.core.puzzlesStartingNumber + i,
          });
        }
        } catch (error) {
          setValidationError({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Could not generate a unique Calcudoku puzzle.',
          });
          return;
        }
        }

        // Replace this document's batch; keep other generic docs intact.
        const genericPageIds = documentPages
          .filter((page) => isGenericPuzzleModuleType(page.moduleType))
          .map((page) => page.id);

        setGenericBatchPuzzles((prev) => {
          const byPage = new Map<string, GenericBatchPuzzle[]>();
          for (const existing of prev) {
            if (existing.pageId === pageId) continue;
            const key = existing.pageId ?? '__default__';
            if (!byPage.has(key)) byPage.set(key, []);
            byPage.get(key)!.push(existing);
          }
          byPage.set(pageId, generated);

          const nextBatch: GenericBatchPuzzle[] = [];
          for (const id of genericPageIds) {
            const pagePuzzles = byPage.get(id);
            if (pagePuzzles) nextBatch.push(...pagePuzzles);
          }
          for (const [key, pagePuzzles] of byPage) {
            if (!genericPageIds.includes(key)) nextBatch.push(...pagePuzzles);
          }
          return nextBatch;
        });

        // Generic pagination uses a document-local index (0..N-1).
        const localIdx = Math.min(
          Math.max(0, currentBatchIndex),
          Math.max(0, generated.length - 1)
        );
        setCurrentBatchIndex(localIdx);
        setCurrentPuzzle(generated[localIdx] ?? generated[0] ?? null);
        setCurrentPuzzleType(moduleType);
        setShowSolution(false);
        setPuzzleGenerationVersion((v) => v + 1);
        return;
      }

      case 'murdoku': {
        if (!activePage || activePage.moduleType !== 'murdoku') {
          setValidationError({
            type: 'error',
            message: 'Select a Murdoku document tab to generate puzzles.',
          });
          return;
        }
        const md = normalizeMurdokuSettings(murdokuSettings);
        const puzzleCount = Math.max(1, md.core.numberOfPuzzles || 1);
        const pageId = activePage.id;
        const pageName = activePage.name;
        const diffs: MurdokuDifficulty[] = ['easy', 'medium', 'hard', 'expert'];
        const mixedPlan =
          md.core.difficulty === 'mixed'
            ? expandMixedMurdokuDifficultyPlan({
                easy: md.core.mixedEasyCount,
                medium: md.core.mixedMediumCount,
                hard: md.core.mixedHardCount,
              })
            : null;
        const generated: MurdokuPuzzle[] = [];
        try {
          for (let i = 0; i < puzzleCount; i++) {
            const theme = md.core.rotateThemes
              ? MURDOKU_THEME_PRESETS[i % MURDOKU_THEME_PRESETS.length]
              : md.theme;
            const themed = md.core.rotateThemes ? applyThemePreset(theme) : md;
            const difficulty: MurdokuDifficulty = mixedPlan
              ? mixedPlan[i] ?? mixedPlan[mixedPlan.length - 1] ?? 'medium'
              : md.core.progressiveDifficulty
                ? diffs[Math.min(diffs.length - 1, Math.floor((i * diffs.length) / puzzleCount))]
                : resolveMurdokuGenerateDifficulty(md.core.difficulty);
            const sceneElements = enrichMurdokuElementsForScene(themed.elements, themed.rooms, {
              avoidRandomProps: md.core.avoidRandomProps !== false,
              useOnlyLargeFurniture: md.core.useOnlyLargeFurniture === true,
            });
            if (!md.core.rotateThemes && i === 0) {
              setMurdokuSettings((prev) => ({ ...prev, elements: sceneElements }));
            }
            const storyLine = murdokuLineForPuzzle(md.story.intro, i);
            const titleLine = murdokuLineForPuzzle(md.story.caseTitle, i, { repeatSingle: true });
            const next = generateMurdokuPuzzle({
              seed: Date.now() + i * 9973,
              rows: md.core.rows,
              cols: md.core.cols,
              difficulty,
              customClueCount: md.core.customClueCount,
              characters: md.characters,
              rooms: themed.rooms,
              elements: sceneElements,
              theme: themed.theme,
              story: {
                ...md.story,
                caseTitle: titleLine || md.story.caseTitle,
                intro: storyLine,
                instruction: storyLine,
              },
              useSimpleWording: true,
              avoidRandomProps: md.core.avoidRandomProps !== false,
              useOnlyLargeFurniture: md.core.useOnlyLargeFurniture === true,
            });
            generated.push({
              ...next,
              pageId,
              pageName,
              puzzleIndexInDocument: i,
              puzzleNumber: md.core.puzzlesStartingNumber + i,
            });
          }
        } catch (error) {
          setValidationError({
            type: 'error',
            message: error instanceof Error ? error.message : 'Could not generate a unique Murdoku puzzle.',
          });
          return;
        }

        const murdokuPageIds = documentPages
          .filter((page) => page.moduleType === 'murdoku')
          .map((page) => page.id);
        setMurdokuBatchPuzzles((prev) => {
          const byPage = new Map<string, MurdokuPuzzle[]>();
          for (const existing of prev) {
            if (existing.pageId === pageId) continue;
            const key = existing.pageId ?? '__default__';
            if (!byPage.has(key)) byPage.set(key, []);
            byPage.get(key)!.push(existing);
          }
          byPage.set(pageId, generated);
          const nextBatch: MurdokuPuzzle[] = [];
          for (const id of murdokuPageIds) {
            const pagePuzzles = byPage.get(id);
            if (pagePuzzles) nextBatch.push(...pagePuzzles);
          }
          for (const [key, pagePuzzles] of byPage) {
            if (!murdokuPageIds.includes(key)) nextBatch.push(...pagePuzzles);
          }
          return nextBatch;
        });
        const localIdx = Math.min(Math.max(0, currentBatchIndex), Math.max(0, generated.length - 1));
        setCurrentBatchIndex(localIdx);
        setCurrentPuzzle(generated[localIdx] ?? generated[0] ?? null);
        setCurrentPuzzleType('murdoku');
        setShowSolution(false);
        setPuzzleGenerationVersion((v) => v + 1);
        void (async () => {
          const polished: MurdokuPuzzle[] = new Array(generated.length);
          let nextIndex = 0;
          const workers = Math.min(3, generated.length);
          await Promise.all(
            Array.from({ length: workers }, async () => {
              while (nextIndex < generated.length) {
                const index = nextIndex++;
                polished[index] = await rewriteMurdokuPuzzleCluesWithAi(generated[index]!, md);
              }
            })
          );
          setMurdokuBatchPuzzles((prev) =>
            prev.map((existing) => {
              if (existing.pageId !== pageId) return existing;
              return (
                polished.find(
                  (p) => p.seed === existing.seed && p.puzzleIndexInDocument === existing.puzzleIndexInDocument
                ) ?? existing
              );
            })
          );
          setCurrentPuzzle((prev) => {
            if (!prev || prev.type !== 'murdoku' || prev.pageId !== pageId) return prev;
            return (
              polished.find(
                (p) => p.seed === prev.seed && p.puzzleIndexInDocument === prev.puzzleIndexInDocument
              ) ?? prev
            );
          });
          setMurdokuSettings((prev) => ({
            ...prev,
            core: { ...prev.core, useSimpleLogicWording: false, useAiClueWording: true },
          }));
          setPuzzleGenerationVersion((v) => v + 1);
        })();
        return;
      }

      case 'word-match':
        puzzle = generateWordMatch(
          titleWords.words.length > 0 ? titleWords.words : ['APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'MANGO']
        );
        break;

      case 'dot-to-dot':
        puzzle = generateDotToDot(
          titleWords.words.length > 0 ? titleWords.words : ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO']
        );
        break;
    }

    setCurrentPuzzle(puzzle);
    setBatchPuzzles([]);
    setCrosswordBatchPuzzles([]);
    setShowSolution(false);
  }, [
    currentPuzzleType,
    currentBatchIndex,
    titleWords.words,
    sudokuDifficulty,
    cryptogramText,
    mazeSize,
    validateAndGenerate,
    splitActiveDocumentIntoChaptersAndGenerate,
    crosswordSettings,
    murdokuSettings,
    genericPuzzleSettings,
    activeDocumentPageId,
    documentPages,
  ]);

  // Save puzzle
  const savePuzzle = useCallback((name: string) => {
    const puzzleToSave = currentPuzzleType === 'word-search'
      ? batchPuzzles[0]
      : currentPuzzle;

    if (!puzzleToSave) return;

    const saved: SavedPuzzle = {
      id: Date.now().toString(),
      type: currentPuzzleType,
      name,
      createdAt: Date.now(),
      puzzle: puzzleToSave,
      settings: {
        book: bookSettings,
        puzzle: puzzleSettings,
        titleWords,
        colors: colorSettings,
        wordSearch: currentPuzzleType === 'word-search' ? wordSearchSettings : undefined,
      },
    };

    const updated = [saved, ...savedPuzzles];
    setSavedPuzzles(updated);
    savePuzzleToStorage(updated);
  }, [currentPuzzle, batchPuzzles, currentPuzzleType, bookSettings, puzzleSettings, titleWords, colorSettings, savedPuzzles, savePuzzleToStorage, wordSearchSettings]);

  const loadPuzzle = useCallback((id: string) => {
    const puzzle = savedPuzzles.find(p => p.id === id);
    if (puzzle) {
      setCurrentPuzzleType(puzzle.type);
      setBookSettings(puzzle.settings.book);
      setPuzzleSettings(puzzle.settings.puzzle);
      setTitleWords(puzzle.settings.titleWords);
      setColorSettings(puzzle.settings.colors);
      if (puzzle.settings.wordSearch) {
        setWordSearchSettings(puzzle.settings.wordSearch);
      }
      if (puzzle.type === 'word-search') {
        void validateAndGenerate();
      } else {
        setCurrentPuzzle(puzzle.puzzle);
        setBatchPuzzles([]);
      }
    }
  }, [savedPuzzles, validateAndGenerate]);

  const deletePuzzle = useCallback((id: string) => {
    const updated = savedPuzzles.filter(p => p.id !== id);
    setSavedPuzzles(updated);
    savePuzzleToStorage(updated);
  }, [savedPuzzles, savePuzzleToStorage]);

  return (
    <AppContext.Provider
      value={{
        currentPuzzleType,
        setCurrentPuzzleType,
        wordSearchSettings,
        setWordSearchSettings,
        updateWordSearchSettings,
        crosswordSettings,
        setCrosswordSettings,
        updateCrosswordSettings,
        murdokuSettings,
        setMurdokuSettings,
        updateMurdokuSettings,
        replaceMurdokuPuzzle,
        genericPuzzleSettings,
        setGenericPuzzleSettings,
        updateGenericPuzzleSettings,
        bookSettings,
        setBookSettings,
        puzzleSettings,
        setPuzzleSettings,
        titleWords,
        setTitleWords,
        colorSettings,
        setColorSettings,
        currentPuzzle,
        batchPuzzles,
        crosswordBatchPuzzles,
        murdokuBatchPuzzles,
        genericBatchPuzzles,
        currentBatchIndex,
        setCurrentBatchIndex,
        validationError,
        clearValidationError: () => setValidationError(null),
        validateAndGenerate,
        generatePuzzle,
        regeneratePuzzleAtIndex,
        restoreBatchPuzzleAtIndex,
        puzzleGenerationVersion,
        triggerStylingUpdate: stylingTrigger,
        sudokuDifficulty,
        setSudokuDifficulty,
        mazeSize,
        setMazeSize,
        savedPuzzles,
        savePuzzle,
        loadPuzzle,
        deletePuzzle,
        showSolution,
        setShowSolution,
        cryptogramText,
        setCryptogramText,
        previewZoom,
        setPreviewZoom,
        puzzleGridScale,
        setPuzzleGridScale,
        titleToAnswerGap,
        setTitleToAnswerGap,
        solutionToSolutionGap,
        setSolutionToSolutionGap,
        pageMargin,
        setPageMargin,
        pageOverrides,
        setPageOverrides,
        updatePageOverride,
        clearPageOverride,
        clearAllPageOverrides,
        pagePuzzleGridScales,
        setPagePuzzleGridScale,
        clearPagePuzzleGridScale,
        clearAllPagePuzzleGridScales,
        pageCrosswordOverrides,
        setPageCrosswordOverrides,
        pageGenericOverrides,
        setPageGenericOverrides,
        applyMode,
        setApplyMode,
        previewRangeMode,
        setPreviewRangeMode,
        activePreviewTab,
        setActivePreviewTab,
        settingsHydrated,
        documentPages,
        activeDocumentPageId,
        activeDocumentPage,
        setActiveDocumentPageId,
        insertDocumentPage,
        appendAiGeneratedBundle,
        applyAiGeneratedToActiveDocument,
        insertSeparatorTitlePageAfter,
        removeCompiledBookPage,
        removeDocumentPage,
        duplicateDocumentPage,
        moveDocumentPage,
        reorderDocumentPages,
        updateDocumentPage,
        replaceDocumentPages,
        updateActiveTextModuleSettings,
        applyTextSettingsToDocumentPages,
        canUndo,
        canRedo,
        undo,
        redo,
        pushEditHistory,
        persistPagePuzzleSettings,
        applyTrimSizeLayoutChange,
        applyLayoutSettingsToAllPuzzleDocuments,
        projectName,
        setProjectName,
        isProjectDirty,
        buildProjectSnapshot,
        loadProjectSnapshot,
        resetToNewProject,
        markProjectSaved,
        showEditorTutorial,
        dismissEditorTutorial,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
