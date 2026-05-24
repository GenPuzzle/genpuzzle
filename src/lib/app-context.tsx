'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
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

interface ValidationError {
  type: 'error' | 'warning';
  message: string;
}

interface AppContextType {
  // Current puzzle type
  currentPuzzleType: PuzzleType;
  setCurrentPuzzleType: (type: PuzzleType) => void;

  // Word Search Settings (comprehensive)
  wordSearchSettings: WordSearchSettings;
  setWordSearchSettings: (settings: WordSearchSettings) => void;
  updateWordSearchSettings: (updates: Partial<WordSearchSettings>) => void;

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
  validateAndGenerate: () => boolean;

  // Generate puzzle (triggers validation)
  generatePuzzle: () => void;

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

  // Page Margins (points from page edges, for KDP safety)
  pageMargin: number;
  setPageMargin: (margin: number) => void;

  // Visual Page Editor: Page-level overrides (local edits for specific pages)
  pageOverrides: Map<number, Partial<WordSearchSettings>>;
  setPageOverrides: (overrides: Map<number, Partial<WordSearchSettings>>) => void;
  updatePageOverride: (pageIndex: number, updates: Partial<WordSearchSettings>) => void;
  clearPageOverride: (pageIndex: number) => void;

  // Apply mode: whether changes apply to all pages (true) or current page only (false)
  applyMode: Map<string, boolean>; // key: setting category (e.g., 'grid', 'wordList', 'typography', 'colors'), value: true = global, false = local
  setApplyMode: (category: string, isGlobal: boolean) => void;
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
  fontFamily: 'Inter',
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
    onlyHighlightWordListWords: false,
    answerTitlePrefix: 'Solution',
    answerTitleFontFamily: 'Inter',
    answerTitleFontSize: 20,
    answerTitleAlignment: 'center',
    showAnswerNumber: true,
  },
};

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
  const [previewZoom, setPreviewZoom] = useState(100);
  const [puzzleGridScale, setPuzzleGridScale] = useState(70);
  const [titleToAnswerGap, setTitleToAnswerGap] = useState(20);
  const [pageMargin, setPageMargin] = useState(40);

  // Batch puzzles for word search
  const [batchPuzzles, setBatchPuzzles] = useState<WordSearchPuzzle[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

  // Validation error
  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  // Styling update trigger (increment to force re-render without regenerating)
  const [stylingTrigger, setStylingTrigger] = useState(0);

  // Word Search Settings
  const [wordSearchSettings, setWordSearchSettings] = useState<WordSearchSettings>(getDefaultWordSearchSettings());

  // Visual Page Editor: Page-level overrides (local edits for specific pages)
  const [pageOverrides, setPageOverrides] = useState<Map<number, Partial<WordSearchSettings>>>(new Map());

  // Apply mode: whether changes apply to all pages (true) or current page only (false)
  const [applyMode, setApplyModeState] = useState<Map<string, boolean>>(
    new Map([
      ['grid', true],      // Default: global
      ['wordList', true],
      ['typography', true],
      ['colors', true],
    ])
  );

  const setApplyMode = useCallback((category: string, isGlobal: boolean) => {
    setApplyModeState(prev => new Map(prev).set(category, isGlobal));
  }, []);

  const updatePageOverride = useCallback((pageIndex: number, updates: Partial<WordSearchSettings>) => {
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
        colors: { ...current.colors, ...updates.colors },
      });
      return newMap;
    });
    setStylingTrigger(t => t + 1);
  }, []);

  const clearPageOverride = useCallback((pageIndex: number) => {
    setPageOverrides(prev => {
      const newMap = new Map(prev);
      newMap.delete(pageIndex);
      return newMap;
    });
    setStylingTrigger(t => t + 1);
  }, []);



  const updateWordSearchSettings = useCallback((updates: Partial<WordSearchSettings>) => {
    setWordSearchSettings(prev => ({
      ...prev,
      ...updates,
      bookCanvas: { ...prev.bookCanvas, ...updates.bookCanvas },
      core: { ...prev.core, ...updates.core },
      typography: { ...prev.typography, ...updates.typography },
      wordList: { ...prev.wordList, ...updates.wordList },
      colors: { ...prev.colors, ...updates.colors },
    }));
    // Trigger styling update without regenerating
    setStylingTrigger(t => t + 1);
  }, []);

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

  // Validate and generate batch puzzles for word search
  const validateAndGenerate = useCallback((): boolean => {
    const ws = wordSearchSettings;
    const words = titleWords.words;
    const required = ws.core.numberOfPuzzles * ws.wordList.wordsPerPuzzle;

    // Validation
    if (words.length < required) {
      setValidationError({
        type: 'error',
        message: `You need ${required} words for ${ws.core.numberOfPuzzles} puzzles (${ws.wordList.wordsPerPuzzle} words per puzzle). You only have ${words.length} words.`,
      });
      return false;
    }

    setValidationError(null);

    // Generate batch puzzles
    const puzzles: WordSearchPuzzle[] = [];
    const directions = getDirections(ws);

    for (let i = 0; i < ws.core.numberOfPuzzles; i++) {
      const startIdx = i * ws.wordList.wordsPerPuzzle;
      const endIdx = startIdx + ws.wordList.wordsPerPuzzle;
      const puzzleWords = words.slice(startIdx, endIdx);

      if (puzzleWords.length === 0) break;

      const puzzle = generateWordSearch(
        puzzleWords,
        ws.core.lettersAcross,
        directions
      ) as WordSearchPuzzle;

      puzzle.puzzleNumber = ws.core.puzzlesStartingNumber + i;
      puzzles.push(puzzle);
    }

    setBatchPuzzles(puzzles);
    setCurrentBatchIndex(0);
    setShowSolution(false);
    return true;
  }, [wordSearchSettings, titleWords.words, getDirections]);

  // Generate puzzle (triggers validation for word search)
  const generatePuzzle = useCallback(() => {
    setValidationError(null);

    if (currentPuzzleType === 'word-search') {
      validateAndGenerate();
      return;
    }

    // Non-word-search puzzle generation
    let puzzle: Puzzle | null = null;

    switch (currentPuzzleType) {
      case 'crossword':
        const wordClues = titleWords.words.map(w => ({
          word: w,
          clue: `Clue for ${w}`,
        }));
        puzzle = generateCrossword(wordClues);
        break;

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
  }, [currentPuzzleType, titleWords.words, sudokuDifficulty, cryptogramText, mazeSize, validateAndGenerate]);

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
        validateAndGenerate,
        generatePuzzle,
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
        pageMargin,
        setPageMargin,
        pageOverrides,
        setPageOverrides,
        updatePageOverride,
        clearPageOverride,
        applyMode,
        setApplyMode,
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
