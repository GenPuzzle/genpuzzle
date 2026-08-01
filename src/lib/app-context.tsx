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
  getDefaultWordSearchSettings,
  generateWordSearch,
  generateSudoku,
  generateCrossword,
  generateCryptogram,
  generateWordScramble,
  generateMaze,
  generateWordMatch,
  generateDotToDot,
} from './puzzles';
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
import {
  getDefaultCrosswordSettings,
  type CrosswordSettings,
} from './crossword-settings';
import {
  detectVisualSyncScope,
  mergeWordSearchSettingsUpdate,
  findDivergentWordSearchDocumentNames,
  findPagesWithVisualOverrides,
  syncVisualSettingsAcrossWordSearchDocuments,
  stripVisualOverridesFromMap,
  buildVisualSyncWarningMessage,
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

  // Validation
  validationError: ValidationError | null;
  clearValidationError: () => void;
  validateAndGenerate: (options?: GeneratePuzzleOptions) => boolean;

  // Generate puzzle (triggers validation)
  generatePuzzle: (options?: GeneratePuzzleOptions) => void;

  /** Regenerate a single word-search puzzle at the given batch index. */
  regeneratePuzzleAtIndex: (
    batchIndex: number,
    wordsOverride?: string[],
    options?: {
      lettersAcross?: number;
      lettersDown?: number;
      settings?: WordSearchSettings;
    }
  ) => WordSearchPuzzle | null;
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

  documentPages: DocumentPage[];
  activeDocumentPageId: string;
  activeDocumentPage: DocumentPage | null;
  setActiveDocumentPageId: (id: string) => void;
  insertDocumentPage: (
    type: InsertableDocumentKind,
    position: 'before' | 'after',
    referenceId?: string
  ) => void;
  /** Insert a blank title page after a compiled book page (splits word-search if mid-doc). */
  insertSeparatorTitlePageAfter: (anchor: import('./book-compiler').CompiledPage) => void;
  /** Remove a compiled book page (text doc, or a single puzzle). */
  removeCompiledBookPage: (page: import('./book-compiler').CompiledPage) => void;
  removeDocumentPage: (id: string) => void;
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

  // Word Search Settings
  const [wordSearchSettings, setWordSearchSettings] = useState<WordSearchSettings>(getDefaultWordSearchSettings());

  // Crossword Settings
  const [crosswordSettings, setCrosswordSettings] = useState<CrosswordSettings>(getDefaultCrosswordSettings());

  // Visual Page Editor: Page-level overrides (local edits for specific pages)
  const [pageOverrides, setPageOverrides] = useState<Map<number, Partial<WordSearchSettings>>>(new Map());
  const [pagePuzzleGridScales, setPagePuzzleGridScales] = useState<Map<number, number>>(new Map());

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
    // Prefer all-pages so word-search + title pages are both visible by default.
    setPreviewRangeMode(mode === 'flipbook' ? 'flipbook' : 'all');
    setActivePreviewTab(stored.activePreviewTab);
    setSudokuDifficulty(stored.sudokuDifficulty);
    setMazeSize(stored.mazeSize);
    setCryptogramText(stored.cryptogramText);
    setPageOverrides(new Map(stored.pageOverrides));
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
      return page;
    });
  }, [documentPages, activeDocumentPageId, titleWords, wordSearchSettings, crosswordSettings]);

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
      currentPuzzle,
      currentBatchIndex,
    };
  }, [
    projectName,
    buildCurrentPersistedSnapshot,
    batchPuzzles,
    currentPuzzle,
    currentBatchIndex,
  ]);

  const projectStateSignature = useMemo(
    () =>
      JSON.stringify({
        projectName,
        settings: buildCurrentPersistedSnapshot(),
        batchPuzzles,
        currentPuzzle,
        currentBatchIndex,
      }),
    [projectName, buildCurrentPersistedSnapshot, batchPuzzles, currentPuzzle, currentBatchIndex]
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
            const titleText = ws?.typography?.titleText ?? '';
            const titleMode = ws?.typography?.selectTitleOption ?? '';
            const solutionTitle = ws?.typography?.customSolutionTitle ?? '';
            return `${page.id}:${page.moduleType}:${titleWords}:${titleMode}:${titleText}:${solutionTitle}`;
          }
          const settings = page.settings as TextModuleSettings;
          if (page.moduleType === 'table-of-contents') {
            const toc = settings.tocSettings;
            return `${page.id}:${page.moduleType}:${settings.title ?? page.name}:${toc?.entryScope}:${toc?.chapterCount}:${(toc?.chapters ?? []).map((c) => c.title).join(',')}:${(toc?.excludedDocumentIds ?? []).join(',')}:${(toc?.revealedDocumentIds ?? []).join(',')}:${toc?.includePuzzlePages}:${toc?.includeSolutionPages}:${toc?.hideDocuments}:${toc?.hidePuzzleDocuments}:${(toc?.customEntries ?? []).map((c) => `${c.id}:${c.title}:${c.pageNumber}`).join(';')}:${toc?.columnLayout}:${toc?.twoColumnMinEntries}`;
          }
          return `${page.id}:${page.moduleType}:${settings.title ?? page.name}`;
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

  const prevActiveDocumentPageId = useRef<string>(activeDocumentPageId);

  useEffect(() => {
    const previousPageId = prevActiveDocumentPageId.current;
    if (previousPageId && previousPageId !== activeDocumentPageId) {
      const previousPage = documentPages.find((page) => page.id === previousPageId);
      if (previousPage?.moduleType === 'word-search') {
        persistPagePuzzleSettings(previousPageId, titleWords, wordSearchSettings);
      } else if (previousPage?.moduleType === 'crossword') {
        persistPageCrosswordSettings(previousPageId, titleWords, crosswordSettings);
      }
    }
    prevActiveDocumentPageId.current = activeDocumentPageId;
  }, [
    activeDocumentPageId,
    documentPages,
    persistPagePuzzleSettings,
    persistPageCrosswordSettings,
    wordSearchSettings,
    crosswordSettings,
    titleWords,
  ]);

  useEffect(() => {
    if (!activeDocumentPage || !settingsHydrated) return;
    if (activeDocumentPage.moduleType === 'word-search') {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      setWordSearchSettings(pageSettings.wordSearchSettings ?? getDefaultWordSearchSettings());
      setTitleWords(pageSettings.titleWords ?? defaultTitleWords);
      setCurrentPuzzleType('word-search');
    } else if (activeDocumentPage.moduleType === 'crossword') {
      const pageSettings = activeDocumentPage.settings as PuzzleModuleSettings;
      setCrosswordSettings(pageSettings.crosswordSettings ?? getDefaultCrosswordSettings());
      setTitleWords(pageSettings.titleWords ?? defaultTitleWords);
      setCurrentPuzzleType('crossword');
    } else if (isPuzzleModuleType(activeDocumentPage.moduleType)) {
      setCurrentPuzzleType(activeDocumentPage.moduleType as PuzzleType);
    }
  }, [activeDocumentPage?.id, settingsHydrated]);

  const insertDocumentPage = useCallback(
    (type: InsertableDocumentKind, position: 'before' | 'after', referenceId?: string) => {
      pushEditHistory();
      const refId = referenceId ?? activeDocumentPageId;
      let newPage = createInsertableDocumentPage(type);
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
  }, [pushEditHistory]);

  const removeCompiledBookPage = useCallback(
    (page: CompiledPage) => {
      if (page.kind === 'solution' || page.kind === 'blank') return;

      if (page.kind === 'text') {
        removeDocumentPage(page.sourceDocumentId);
        return;
      }

      if (page.kind === 'puzzle') {
        pushEditHistory();
        const docId = page.sourceDocumentId;
        const removeIndex = page.puzzleIndexInDocument;

        setBatchPuzzles((prev) => {
          const docPuzzles = prev.filter((puzzle) => puzzle.pageId === docId);
          if (removeIndex < 0 || removeIndex >= docPuzzles.length) return prev;

          const target = docPuzzles[removeIndex];
          const next = prev.filter((puzzle) => puzzle !== target);
          const remainingForDoc = next.filter((puzzle) => puzzle.pageId === docId);

          if (remainingForDoc.length === 0) {
            setDocumentPages((docs) => {
              if (docs.length <= 1) return docs;
              const filtered = docs.filter((doc) => doc.id !== docId);
              setActiveDocumentPageId((current) =>
                current === docId ? filtered[0]?.id ?? current : current
              );
              return filtered.length > 0 ? filtered : docs;
            });
            return next;
          }

          let keptIdx = 0;
          return next.map((puzzle) => {
            if (puzzle.pageId !== docId) return puzzle;
            return { ...puzzle, puzzleIndexInDocument: keptIdx++ };
          });
        });
      }
    },
    [pushEditHistory, removeDocumentPage]
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

    const prev = wordSearchSettings;
    const next = mergeWordSearchSettingsUpdate(prev, updates);
    const visualScope = detectVisualSyncScope(prev, updates);

    setWordSearchSettings(next);

    if (
      updates.core?.puzzlesStartingNumber !== undefined &&
      updates.core.puzzlesStartingNumber !== prev.core.puzzlesStartingNumber
    ) {
      const start = updates.core.puzzlesStartingNumber;
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

    if (visualScope) {
      // Docs that already differed from this tab *before* the edit (customized separately).
      const divergentDocNames = findDivergentWordSearchDocumentNames(
        documentPages,
        activeDocumentPageId,
        prev,
        visualScope
      );
      const divergentPageIndices = findPagesWithVisualOverrides(pageOverrides, visualScope);

      setDocumentPages((pages) =>
        syncVisualSettingsAcrossWordSearchDocuments(pages, next, visualScope)
      );

      if (divergentPageIndices.length > 0) {
        setPageOverrides((overrides) => stripVisualOverridesFromMap(overrides, visualScope));
      }

      const visualWarning = buildVisualSyncWarningMessage({
        scope: visualScope,
        divergentDocNames,
        divergentPageIndices,
      });
      if (visualWarning) {
        setValidationError({ type: 'error', message: visualWarning });
      }
    }

    // Trigger styling update without regenerating
    setStylingTrigger((t) => t + 1);
  }, [
    pushEditHistory,
    wordSearchSettings,
    activeDocumentPageId,
    documentPages,
    pageOverrides,
  ]);

  const updateCrosswordSettings = useCallback((updates: Partial<CrosswordSettings>) => {
    pushEditHistory();
    setCrosswordSettings((prev) => ({
      ...prev,
      ...updates,
      bookCanvas: { ...prev.bookCanvas, ...updates.bookCanvas },
      core: updates.core ? { ...prev.core, ...updates.core } : prev.core,
      typography: updates.typography ? { ...prev.typography, ...updates.typography } : prev.typography,
      colors: updates.colors ? { ...prev.colors, ...updates.colors } : prev.colors,
      pageFrameSettings: updates.pageFrameSettings
        ? { ...prev.pageFrameSettings, ...updates.pageFrameSettings }
        : prev.pageFrameSettings,
    }));
    // Visual-only: restyle without regenerating puzzle structure
    setStylingTrigger((t) => t + 1);
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
      if (Math.abs(ratio - 1) < 0.001 || !nextSettings || !prevSettings) {
        return;
      }

      setPuzzleGridScale((scale) => scaleGridScalePercent(scale, ratio));
      setPageMargin((margin) => scaleInt(margin, ratio, 20));
      setTitleToAnswerGap((gap) => scaleInt(gap, ratio, 4));
      setSolutionToSolutionGap((gap) => scaleInt(gap, ratio, 4));
      setTitleWords((tw) => applyTrimLayoutToTitleWords(tw, ratio));
      setPageOverrides((overrides) =>
        scalePageOverridesForTrim(overrides, prevSettings, ratio, nextSettings.bookCanvas)
      );
      setPagePuzzleGridScales((scales) => scalePagePuzzleGridScalesForTrim(scales, ratio));
      setDocumentPages((pages) =>
        scaleDocumentPagesForTrim(pages, ratio, nextSettings.bookCanvas)
      );
      setStylingTrigger((t) => t + 1);
    },
    []
  );

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
  const validateAndGenerate = useCallback((options?: GeneratePuzzleOptions): boolean => {
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
    const required = ws.core.numberOfPuzzles * ws.wordList.wordsPerPuzzle;

    if (pageWords.length < required) {
      setValidationError({
        type: 'error',
        message: `You need ${required} words for ${ws.core.numberOfPuzzles} puzzles (${ws.wordList.wordsPerPuzzle} words per puzzle). You only have ${pageWords.length} words.`,
      });
      return false;
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

      const startIdx = i * ws.wordList.wordsPerPuzzle;
      const endIdx = startIdx + ws.wordList.wordsPerPuzzle;
      const puzzleWords = pageWords.slice(startIdx, endIdx);

      if (puzzleWords.length === 0) break;

      const puzzle = generateWordSearch(
        puzzleWords,
        ws.core.lettersAcross,
        ws.core.lettersDown,
        directions,
        ws.wordList.aiLanguage
      ) as WordSearchPuzzle;

      puzzle.puzzleNumber = ws.core.puzzlesStartingNumber + i;
      puzzle.puzzleIndexInDocument = i;
      puzzle.pageId = activePage.id;
      puzzle.pageName = activePage.name;
      newPuzzles.push(puzzle);
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
    (
      batchIndex: number,
      wordsOverride?: string[],
      options?: {
        lettersAcross?: number;
        lettersDown?: number;
        settings?: WordSearchSettings;
      }
    ): WordSearchPuzzle | null => {
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
      const wpp = Math.max(1, ws.wordList.wordsPerPuzzle);
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
      const regenerated = generateWordSearch(
        puzzleWords,
        lettersAcross,
        lettersDown,
        directions,
        ws.wordList.aiLanguage
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

  // Generate puzzle (triggers validation for word search)
  const generatePuzzle = useCallback((options?: GeneratePuzzleOptions) => {
    setValidationError(null);

    if (currentPuzzleType === 'word-search') {
      validateAndGenerate(options);
      return;
    }

    // Non-word-search puzzle generation
    let puzzle: Puzzle | null = null;

    switch (currentPuzzleType) {
      case 'crossword': {
        const core = crosswordSettings.core;
        const maxClue = core.maxClueCharacters;
        const words = titleWords.words
          .filter(Boolean)
          .slice(0, Math.max(1, core.cluesPerPuzzle || titleWords.words.length));
        const wordClues = words.map((w) => ({
          word: w,
          clue: `Clue for ${w}`.slice(0, maxClue),
        }));
        puzzle = generateCrossword(wordClues, {
          lettersAcross: core.lettersAcross,
          lettersDown: core.lettersDown,
          allowNumbers: core.allowNumbersInAnswers,
          maxAnswerLength: core.maxAnswerLength,
        });
        break;
      }

      case 'sudoku':
        puzzle = generateSudoku(sudokuDifficulty);
        break;

      case 'cryptogram':
        puzzle = generateCryptogram(
          cryptogramText || 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG'
        );
        break;

      case 'word-scramble':
        puzzle = generateWordScramble(
          titleWords.words.length > 0 ? titleWords.words : ['PUZZLE', 'SCRAMBLE', 'WORDS', 'GAME', 'PLAY']
        );
        break;

      case 'maze':
        puzzle = generateMaze(mazeSize);
        break;

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
    setShowSolution(false);
  }, [currentPuzzleType, titleWords.words, sudokuDifficulty, cryptogramText, mazeSize, validateAndGenerate, crosswordSettings]);

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
        validateAndGenerate();
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
        insertSeparatorTitlePageAfter,
        removeCompiledBookPage,
        removeDocumentPage,
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
