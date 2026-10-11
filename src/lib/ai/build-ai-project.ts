import {
  createDocumentPage,
  isPuzzleModuleType,
  type DocumentPage,
  type PuzzleModuleSettings,
  type PuzzleModuleType,
} from '@/lib/document-model';
import type { GpProjectFile } from '@/lib/project-file';
import type { PersistedAppSettings } from '@/lib/settings-persistence';
import {
  getDefaultWordSearchSettings,
  normalizeAnswersPerPage,
} from '@/lib/puzzles/types';
import type {
  CrosswordPuzzle,
  GenericBatchPuzzle,
  WordSearchPuzzle,
} from '@/lib/puzzles/types';
import { generateWordSearch } from '@/lib/puzzles/word-search';
import { generateCrossword } from '@/lib/puzzles/crossword';
import { buildCrosswordWordClues } from '@/lib/crossword-settings';
import { getDefaultCrosswordSettings } from '@/lib/crossword-settings';
import {
  getDefaultGenericPuzzleSettings,
  isGenericPuzzleModuleType,
  normalizeGenericPuzzleSettings,
} from '@/lib/generic-puzzle-settings';
import { generateSudoku } from '@/lib/puzzles/sudoku';
import { generateMaze } from '@/lib/puzzles/maze';
import { generateCryptogram } from '@/lib/puzzles/cryptogram';
import { generateWordScramble } from '@/lib/puzzles/word-scramble';
import { buildTriviaBatch } from '@/lib/puzzles/trivia';
import { generateBinairo } from '@/lib/puzzles/binairo';
import { generateCodewordPuzzle } from '@/lib/puzzles/codewords';
import { generateKakuro } from '@/lib/puzzles/kakuro';
import { generateMathMaze } from '@/lib/puzzles/math-maze';
import { generateFill } from '@/lib/puzzles/fill';
import { generateSnake } from '@/lib/puzzles/snake';
import { enrichMurdokuElementsForScene, generateMurdokuPuzzle, type MurdokuPuzzle } from '@/lib/puzzles/murdoku';
import {
  applyThemePreset,
  defaultMurdokuCharacters,
  getDefaultMurdokuSettings,
  MURDOKU_THEME_PRESETS,
} from '@/lib/murdoku-settings';
import {
  elementDefsFromNames,
  sanitizeElementNames,
  syncRoomsCatalog,
} from '@/lib/murdoku-room-catalog';
import type {
  AiCryptogramContent,
  AiCrosswordContent,
  AiDifficulty,
  AiGenericEngineContent,
  AiMazeContent,
  AiMurdokuContent,
  AiProjectSetup,
  AiPuzzleContent,
  AiPuzzleTypeConfig,
  AiSudokuContent,
  AiTriviaContent,
  AiWordScrambleContent,
  AiWordSearchContent,
} from './types';
import { aiMurdokuGridFromConfig, getAiChapterTopics, getAiPuzzleTypeLabel, isAiByChapter } from './types';
import { normalizeAiCrosswordEntries } from './validate';
import { attachAiFrontMatter } from './front-matter';
import type { AiFrontMatterCopy } from './types';
import { createPageVariableField, normalizePageVariables } from '@/lib/page-variables';
import { tokenForVariableKey } from './text-variable-tokens';
import {
  buildChapterSplitPlan,
  evenChapterPuzzleCounts,
  splitPuzzleDocumentByChapters,
} from '@/lib/split-puzzle-document-by-chapters';
import {
  writeChapterTitlesDraft,
  writeDivideListsPreference,
} from '@/lib/chapter-titles-draft';

export interface AiGeneratedBundle {
  pages: DocumentPage[];
  batchPuzzles: WordSearchPuzzle[];
  crosswordBatchPuzzles: CrosswordPuzzle[];
  genericBatchPuzzles: GenericBatchPuzzle[];
  murdokuBatchPuzzles: MurdokuPuzzle[];
}

function mazeSizeForDifficulty(
  d: AiDifficulty,
  preferred?: AiPuzzleTypeConfig['mazeSize']
): 'small' | 'medium' | 'large' | 'xl' {
  if (preferred && preferred !== undefined) return preferred;
  if (d === 'easy') return 'small';
  if (d === 'hard') return 'large';
  return 'medium';
}

function withChapterIndex<T extends { chapterIndex?: number }>(
  puzzles: T[],
  perChapter: number,
  byChapter: boolean
): T[] {
  if (!byChapter || perChapter < 1) return puzzles;
  return puzzles.map((puzzle, i) => ({
    ...puzzle,
    chapterIndex: Math.floor(i / perChapter),
  }));
}

function floorFont(value: number | undefined, min: number, fallback: number): number {
  const n = Number.isFinite(value) ? Number(value) : fallback;
  return Math.max(min, n);
}

/** Apply book-wide AI layout options through existing settings / page variables. */
function applyAiLayoutOptionsToPage(
  page: DocumentPage,
  setup: AiProjectSetup,
  funFacts: string[] = []
): DocumentPage {
  const settings = { ...(page.settings as PuzzleModuleSettings) };
  const minFontRaw = setup.minimumFontSize;
  const minFont =
    minFontRaw != null && Number.isFinite(minFontRaw)
      ? Math.max(8, Math.min(48, Math.round(minFontRaw)))
      : 0;
  const solutionsPerPage =
    setup.solutionsPerPage != null && Number.isFinite(setup.solutionsPerPage)
      ? Math.max(1, Math.min(9, Math.round(setup.solutionsPerPage)))
      : 0;
  const startNum = Math.max(1, Math.round(setup.startPuzzleNumber ?? 1) || 1);
  const ensureFunFactVar = setup.ensureFunFactPageVariable === true;
  // Reserve extra space under the title when a canvas fun-fact variable is used.
  const headerGapPt = Math.max(36, (minFont || 14) + 24);

  if (settings.wordSearchSettings) {
    const ws = { ...settings.wordSearchSettings };
    ws.core = { ...ws.core, puzzlesStartingNumber: startNum };
    if (solutionsPerPage) {
      ws.bookCanvas = {
        ...ws.bookCanvas,
        answersPerPage: normalizeAnswersPerPage(solutionsPerPage),
      };
    }
    // Keep funFactsText for page-variable resolution, but never draw it twice via typography.
    if (funFacts.length > 0) {
      ws.typography = {
        ...ws.typography,
        funFactsText: funFacts.join('\n'),
        includeFunFacts: ensureFunFactVar ? false : Boolean(ws.typography.includeFunFacts),
      };
    }
    if (ensureFunFactVar) {
      ws.typography = {
        ...ws.typography,
        includeFunFacts: false,
        spaceBetweenTitleAndPuzzle: Math.max(
          ws.typography.spaceBetweenTitleAndPuzzle ?? 20,
          headerGapPt
        ),
        subtitleToTitleGap: Math.max(ws.typography.subtitleToTitleGap ?? 10, 12),
      };
    }
    if (minFont) {
      ws.typography = {
        ...ws.typography,
        puzzleTitleFontSize: floorFont(ws.typography.puzzleTitleFontSize, minFont, 24),
        subtitleFontSize: floorFont(ws.typography.subtitleFontSize, minFont, 14),
      };
      ws.wordList = {
        ...ws.wordList,
        wordListFontSize: floorFont(ws.wordList.wordListFontSize, minFont, 18),
      };
    }
    settings.wordSearchSettings = ws;
  }

  if (settings.crosswordSettings) {
    const cw = { ...settings.crosswordSettings };
    cw.core = { ...cw.core, puzzlesStartingNumber: startNum };
    if (solutionsPerPage) {
      cw.bookCanvas = {
        ...cw.bookCanvas,
        answersPerPage: normalizeAnswersPerPage(solutionsPerPage),
      };
    }
    if (minFont && cw.typography) {
      cw.typography = {
        ...cw.typography,
        puzzleTitleFontSize: floorFont(
          (cw.typography as { puzzleTitleFontSize?: number }).puzzleTitleFontSize,
          minFont,
          24
        ),
      };
    }
    settings.crosswordSettings = cw;
  }

  if (settings.genericPuzzleSettings) {
    const gp = {
      ...settings.genericPuzzleSettings,
      core: { ...settings.genericPuzzleSettings.core },
      typography: { ...settings.genericPuzzleSettings.typography },
    };
    gp.core.puzzlesStartingNumber = startNum;
    if (solutionsPerPage) gp.core.solutionsPerPage = solutionsPerPage;
    if (funFacts.length > 0) {
      gp.typography.funFactsText = funFacts.join('\n');
    }
    // Page-variable fun facts replace typography subtitle drawing.
    gp.typography.includeFunFacts = ensureFunFactVar
      ? false
      : funFacts.length > 0 || gp.typography.includeFunFacts === true;
    if (ensureFunFactVar) {
      gp.typography.spaceBetweenTitleAndPuzzle = Math.max(
        gp.typography.spaceBetweenTitleAndPuzzle ?? 0.3,
        0.55
      );
    }
    if (minFont) {
      gp.typography.puzzleTitleFontSize = floorFont(
        gp.typography.puzzleTitleFontSize,
        minFont,
        24
      );
      gp.typography.puzzleFontSize = floorFont(gp.typography.puzzleFontSize, minFont, 14);
      gp.typography.answerTitleFontSize = floorFont(
        gp.typography.answerTitleFontSize,
        minFont,
        18
      );
    }
    settings.genericPuzzleSettings = normalizeGenericPuzzleSettings(gp, page.moduleType as never);
  }

  if (ensureFunFactVar) {
    const existing = normalizePageVariables(settings.pageVariables);
    const hasFunFact = existing.some((f) => f.variableKey === 'fun_fact');
    if (!hasFunFact) {
      const field = createPageVariableField('text', 50, 18, {
        widthPercent: 72,
        heightPercent: Math.max(7, Math.min(14, Math.round((minFont || 14) * 0.55))),
        fontSize: minFont || 14,
        bold: false,
        // Token resolves per puzzle from funFactsText — same system as canvas variables.
        variableKey: 'fun_fact',
        textLines: [tokenForVariableKey('fun_fact')],
        scope: 'document',
      });
      // Sit in the reserved band under the title (layout gap bumped above).
      field.yPercent = 11;
      field.xPercent = 14;
      settings.pageVariables = [...existing, field];
    } else {
      settings.pageVariables = existing.map((field) =>
        field.variableKey === 'fun_fact'
          ? {
              ...field,
              textLines: [tokenForVariableKey('fun_fact')],
              fontSize: Math.max(field.fontSize || 12, minFont || 14),
            }
          : field
      );
    }
  }

  return { ...page, settings };
}

function pagePuzzleCount(page: DocumentPage): number {
  const settings = page.settings as PuzzleModuleSettings;
  if (settings.wordSearchSettings) {
    return Math.max(1, settings.wordSearchSettings.core.numberOfPuzzles || 1);
  }
  if (settings.crosswordSettings) {
    return Math.max(1, settings.crosswordSettings.core.numberOfPuzzles || 1);
  }
  if (settings.genericPuzzleSettings) {
    return Math.max(1, settings.genericPuzzleSettings.core.numberOfPuzzles || 1);
  }
  if (settings.murdokuSettings) {
    return Math.max(1, settings.murdokuSettings.core.numberOfPuzzles || 1);
  }
  return 1;
}

function pageStartingNumber(page: DocumentPage): number {
  const settings = page.settings as PuzzleModuleSettings;
  return Math.max(
    1,
    settings.wordSearchSettings?.core.puzzlesStartingNumber ||
      settings.crosswordSettings?.core.puzzlesStartingNumber ||
      settings.genericPuzzleSettings?.core.puzzlesStartingNumber ||
      settings.murdokuSettings?.core.puzzlesStartingNumber ||
      1
  );
}

function reassignBatchPuzzlesToChapterDocs<
  T extends {
    pageId?: string;
    pageName?: string;
    puzzleIndexInDocument?: number;
    puzzleNumber?: number;
    chapterIndex?: number;
  },
>(
  puzzles: T[],
  sourcePageId: string,
  puzzleDocIds: string[],
  puzzleCounts: number[],
  documents: DocumentPage[]
): T[] {
  const owned = puzzles.filter((p) => p.pageId === sourcePageId);
  if (owned.length === 0) return puzzles;
  const others = puzzles.filter((p) => p.pageId !== sourcePageId);
  const remapped: T[] = [];
  let offset = 0;
  for (let i = 0; i < puzzleDocIds.length; i++) {
    const count = Math.max(0, puzzleCounts[i] ?? 0);
    const docId = puzzleDocIds[i]!;
    const doc = documents.find((p) => p.id === docId);
    const startNum = doc ? pageStartingNumber(doc) : offset + 1;
    const slice = owned.slice(offset, offset + count);
    for (let j = 0; j < slice.length; j++) {
      remapped.push({
        ...slice[j]!,
        pageId: docId,
        pageName: doc?.name ?? slice[j]!.pageName,
        puzzleIndexInDocument: j,
        puzzleNumber: startNum + j,
        chapterIndex: i,
      });
    }
    offset += count;
  }
  return [...others, ...remapped];
}

/**
 * Apply the same "Divide into chapters" flow the sidebar uses: one puzzle tab
 * per chapter per type, with chapter title pages interleaved.
 */
export function applyAiDivideIntoChapters(
  setup: AiProjectSetup,
  bundle: AiGeneratedBundle
): AiGeneratedBundle {
  if (!isAiByChapter(setup)) return bundle;
  const topics = getAiChapterTopics(setup);
  const chapterCount = Math.max(2, topics.length);
  if (chapterCount < 2) return bundle;

  const puzzlePages = bundle.pages.filter(
    (page) =>
      isPuzzleModuleType(page.moduleType) &&
      (page.moduleType === 'word-search' ||
        page.moduleType === 'crossword' ||
        isGenericPuzzleModuleType(page.moduleType))
  );
  if (puzzlePages.length === 0) return bundle;

  let documents = [...bundle.pages];
  let batchPuzzles = [...bundle.batchPuzzles];
  let crosswordBatchPuzzles = [...bundle.crosswordBatchPuzzles];
  let genericBatchPuzzles = [...bundle.genericBatchPuzzles];
  let lastCounts = evenChapterPuzzleCounts(
    pagePuzzleCount(puzzlePages[0]!),
    chapterCount
  );

  for (const source of puzzlePages) {
    // Source may already have been replaced if we iterate stale refs — find by id.
    const live = documents.find((doc) => doc.id === source.id);
    if (!live || !isPuzzleModuleType(live.moduleType)) continue;
    if (typeof (live.settings as PuzzleModuleSettings).chapterIndex === 'number') continue;

    const total = pagePuzzleCount(live);
    const typeCfg = setup.puzzleTypes.find((t) => t.type === live.moduleType);
    const perChapter = typeCfg?.count ?? Math.max(1, Math.floor(total / chapterCount));
    let counts = Array.from({ length: chapterCount }, () => perChapter);
    if (counts.reduce((a, b) => a + b, 0) !== total) {
      counts = evenChapterPuzzleCounts(total, chapterCount);
    }
    lastCounts = counts;

    const plan = buildChapterSplitPlan({
      numberOfPuzzles: total,
      chapterCount,
      chapterTitles: topics,
      puzzlesStartingNumber: pageStartingNumber(live),
      customPuzzleCounts: counts,
    });
    if (!plan) continue;

    const split = splitPuzzleDocumentByChapters({
      documents,
      sourceDocumentId: live.id,
      plan,
    });
    if (!split) continue;

    documents = split.documentPages;
    batchPuzzles = reassignBatchPuzzlesToChapterDocs(
      batchPuzzles,
      live.id,
      split.puzzleDocIds,
      plan.puzzleCounts,
      documents
    );
    crosswordBatchPuzzles = reassignBatchPuzzlesToChapterDocs(
      crosswordBatchPuzzles,
      live.id,
      split.puzzleDocIds,
      plan.puzzleCounts,
      documents
    );
    genericBatchPuzzles = reassignBatchPuzzlesToChapterDocs(
      genericBatchPuzzles,
      live.id,
      split.puzzleDocIds,
      plan.puzzleCounts,
      documents
    );
  }

  // Sync sidebar Divide-into-chapters controls with what AI applied.
  try {
    writeChapterTitlesDraft({ titles: topics, touched: true });
    writeDivideListsPreference({
      enabled: false,
      chapterCount,
      customPuzzleCounts: lastCounts,
    });
  } catch {
    // SSR / non-browser — ignore storage sync.
  }

  return {
    pages: documents,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles: bundle.murdokuBatchPuzzles,
  };
}

function basePersistedSettings(
  firstType: PuzzleModuleType,
  pages: ReturnType<typeof createDocumentPage>[],
  activeId: string
): PersistedAppSettings {
  const ws = getDefaultWordSearchSettings();
  return {
    version: 1,
    currentPuzzleType: firstType,
    wordSearchSettings: ws,
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
    titleWords: {
      title: 'Word Search',
      fontFamily: 'Arial',
      fontSize: 24,
      words: [],
    },
    colorSettings: ws.colors,
    puzzleGridScale: 70,
    titleToAnswerGap: 10,
    solutionToSolutionGap: 14,
    pageMargin: 40,
    previewZoom: 75,
    previewRangeMode: 'sample',
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
    documentPages: pages,
    activeDocumentPageId: activeId,
  };
}

/** Adapt AI word-search content into editable app fields + generated grids. */
export function aiWordSearchToExistingPuzzles(
  items: AiWordSearchContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string
): {
  words: string[];
  titles: string[];
  funFacts: string[];
  puzzles: WordSearchPuzzle[];
} {
  const wordsPer = cfg.wordsPerPuzzle ?? 15;
  const words: string[] = [];
  const titles: string[] = [];
  const funFacts: string[] = [];
  const puzzles: WordSearchPuzzle[] = [];

  items.forEach((item, i) => {
    titles.push(item.title);
    funFacts.push(item.funFact || '');
    const slice = item.words.slice(0, wordsPer);
    while (slice.length < wordsPer && slice.length > 0) {
      slice.push(slice[slice.length - 1]!);
    }
    words.push(...slice);
    const generated = generateWordSearch(slice, 15, 15);
    puzzles.push({
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    });
  });

  return { words, titles, funFacts, puzzles };
}

export async function aiCrosswordToExistingPuzzles(
  items: AiCrosswordContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string,
  options?: {
    onProgress?: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<{
  answersText: string;
  cluesText: string;
  titles: string[];
  puzzles: CrosswordPuzzle[];
}> {
  const cluesPer = Math.max(1, cfg.cluesPerPuzzle ?? 15);
  const maxAnswerLength = cfg.maxAnswerLength ?? 15;
  const answers: string[] = [];
  const clues: string[] = [];
  const titles: string[] = [];
  const puzzles: CrosswordPuzzle[] = [];

  for (let i = 0; i < items.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const item = items[i]!;
    options?.onProgress?.(
      `Building crossword grid ${i + 1} of ${items.length}…`
    );
    // Yield so the wizard progress UI stays responsive while placing grids.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    titles.push(item.title);
    // Re-normalize so textarea lines stay 1:1 even if a clue had line breaks.
    const entries = normalizeAiCrosswordEntries(item.entries, cluesPer, maxAnswerLength);
    const used = new Set(entries.map((e) => e.answer));
    let pad = 0;
    while (entries.length < cluesPer) {
      pad += 1;
      const answer = `THEME${pad}`.slice(0, maxAnswerLength);
      if (used.has(answer)) continue;
      used.add(answer);
      entries.push({
        answer,
        clue: `Theme word ${pad} for ${(item.title || 'this puzzle').replace(/[\r\n]+/g, ' ').trim()}`,
      });
    }
    const exact = entries.slice(0, cluesPer);
    answers.push(...exact.map((e) => e.answer));
    clues.push(...exact.map((e) => e.clue.replace(/[\r\n]+/g, ' ').trim()));
    const wordClues = buildCrosswordWordClues({
      answers: exact.map((e) => e.answer),
      clues: exact.map((e) => e.clue),
      startIndex: 0,
      count: cluesPer,
      maxClueCharacters: 80,
      maxAnswerLength,
      allowNumbers: false,
    });
    const generated = generateCrossword(wordClues, {
      lettersAcross: 15,
      lettersDown: 13,
      maxAnswerLength,
      exactClueCount: cfg.exactClueCount === true,
      timeBudgetMs: 3_500,
    });
    puzzles.push({
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    });
  }

  return {
    answersText: answers.join('\n'),
    cluesText: clues.join('\n'),
    titles,
    puzzles,
  };
}

export function aiSudokuToExistingPuzzles(
  items: AiSudokuContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string
): { titles: string[]; puzzles: GenericBatchPuzzle[] } {
  const size = cfg.sudokuSize ?? 9;
  const titles: string[] = [];
  const puzzles: GenericBatchPuzzle[] = items.map((item, i) => {
    titles.push(item.title);
    const generated = generateSudoku({
      difficulty: item.difficulty,
      size,
    });
    return {
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    };
  });
  return { titles, puzzles };
}

export function aiMazeToExistingPuzzles(
  items: AiMazeContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string
): { titles: string[]; puzzles: GenericBatchPuzzle[] } {
  const titles: string[] = [];
  const puzzles: GenericBatchPuzzle[] = items.map((item, i) => {
    titles.push(item.title);
    const generated = generateMaze({
      size: mazeSizeForDifficulty(item.difficulty, cfg.mazeSize),
      difficulty: item.difficulty,
      shape: 'square',
      variationSeed: i + 1,
    });
    return {
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    };
  });
  return { titles, puzzles };
}

function codewordsLanguage(setup: AiProjectSetup): string {
  const lang = (setup.language || 'en').trim().toLowerCase();
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('es') || lang.startsWith('sp')) return 'es';
  if (lang.startsWith('en') || lang === 'english') return 'en';
  return 'en';
}

export function aiGenericEngineToExistingPuzzles(
  items: AiGenericEngineContent[],
  type: AiGenericEngineContent['type'],
  pageId: string,
  pageName: string,
  setup: AiProjectSetup
): { titles: string[]; puzzles: GenericBatchPuzzle[] } {
  const titles: string[] = [];
  const puzzles: GenericBatchPuzzle[] = items.map((item, i) => {
    titles.push(item.title || getAiPuzzleTypeLabel(type));
    const seed = Date.now() + i * 9973;
    let generated: GenericBatchPuzzle;
    switch (type) {
      case 'binairo':
        generated = generateBinairo({
          size: 10,
          difficulty: item.difficulty,
          seed,
          timeBudgetMs: 8000,
        });
        break;
      case 'codewords':
        generated = generateCodewordPuzzle({
          rows: 13,
          cols: 13,
          difficulty: item.difficulty,
          seed,
          language: codewordsLanguage(setup),
          timeBudgetMs: 8000,
        });
        break;
      case 'kakuro':
        generated = generateKakuro({
          size: 9,
          difficulty: item.difficulty,
          seed,
          timeBudgetMs: 40000,
        });
        break;
      case 'math-maze':
        generated = generateMathMaze({ seed });
        break;
      case 'word-fill':
        generated = generateFill({ seed, mode: 'word' });
        break;
      case 'number-fill':
        generated = generateFill({ seed, mode: 'number' });
        break;
      case 'snake':
        generated = generateSnake({ seed });
        break;
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unsupported engine type: ${_exhaustive}`);
      }
    }
    return {
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    };
  });
  return { titles, puzzles };
}

export function aiCryptogramToExistingPuzzles(
  items: AiCryptogramContent[],
  pageId: string,
  pageName: string,
  language?: string
): { phrases: string; titles: string[]; puzzles: GenericBatchPuzzle[] } {
  const titles: string[] = [];
  const phrases: string[] = [];
  const puzzles: GenericBatchPuzzle[] = items.map((item, i) => {
    titles.push(item.title);
    phrases.push(item.phrase);
    const generated = generateCryptogram(item.phrase, {
      cipherType: 'letters',
      language,
    });
    return {
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    };
  });
  return { phrases: phrases.join('\n'), titles, puzzles };
}

export function aiWordScrambleToExistingPuzzles(
  items: AiWordScrambleContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string,
  language?: string
): { scrambleWords: string; titles: string[]; puzzles: GenericBatchPuzzle[] } {
  const wordsPer = cfg.wordsPerPuzzle ?? 10;
  const titles: string[] = [];
  const allWords: string[] = [];
  const puzzles: GenericBatchPuzzle[] = items.map((item, i) => {
    titles.push(item.title);
    const slice = item.words.slice(0, wordsPer);
    allWords.push(...slice);
    const generated = generateWordScramble(slice, language);
    return {
      ...generated,
      pageId,
      pageName,
      puzzleIndexInDocument: i,
      puzzleNumber: i + 1,
    };
  });
  return { scrambleWords: allWords.join('\n'), titles, puzzles };
}

export function aiTriviaToExistingPuzzles(
  items: AiTriviaContent[],
  cfg: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string
): {
  questionsText: string;
  suggestionsText: string;
  answersText: string;
  titles: string[];
  puzzles: GenericBatchPuzzle[];
} {
  const qPer = cfg.questionsPerPuzzle ?? 10;
  const sPer = cfg.suggestionsPerQuestion ?? 4;
  const titles: string[] = [];
  const questions: string[] = [];
  const suggestions: string[] = [];
  const answers: string[] = [];

  items.forEach((item) => {
    titles.push(item.title);
    item.questions.slice(0, qPer).forEach((q) => {
      questions.push(q.prompt);
      answers.push(q.answer);
      const sug = [...q.suggestions];
      while (sug.length < sPer) sug.push(`Option ${sug.length + 1}`);
      suggestions.push(...sug.slice(0, sPer));
    });
  });

  const batch = buildTriviaBatch({
    totalQuestions: questions.length,
    questionsPerPage: qPer,
    suggestionsPerQuestion: sPer,
    questionsText: questions.join('\n'),
    suggestionsText: suggestions.join('\n'),
    answersText: answers.join('\n'),
  });

  const puzzles: GenericBatchPuzzle[] = batch.puzzles.map((p, i) => ({
    ...p,
    pageId,
    pageName,
    puzzleIndexInDocument: i,
    puzzleNumber: i + 1,
  }));

  return {
    questionsText: questions.join('\n'),
    suggestionsText: suggestions.join('\n'),
    answersText: answers.join('\n'),
    titles,
    puzzles,
  };
}

async function yieldUi(): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function charactersFromAiItem(item: AiMurdokuContent | undefined, people: number) {
  return defaultMurdokuCharacters(people).map((character, i) => ({
    ...character,
    name: item?.characters?.[i]?.name || character.name,
    occupation: item?.characters?.[i]?.occupation || character.occupation,
    description: item?.characters?.[i]?.description || character.description,
  }));
}

function roomsFromAiItem(
  themeRooms: ReturnType<typeof applyThemePreset>['rooms'],
  names: string[] | undefined,
  count: number,
  themeHint = ''
) {
  const rooms = themeRooms.map((room, i) => ({
    ...room,
    name: names?.[i] || room.name,
  }));
  while (rooms.length < count) {
    const i = rooms.length;
    const template = themeRooms[i % Math.max(1, themeRooms.length)] ?? rooms[0];
    rooms.push({
      ...template,
      id: `room-${i + 1}`,
      slotId: `R${String(i + 1).padStart(2, '0')}`,
      name: names?.[i] || `Room ${i + 1}`,
    });
  }
  return syncRoomsCatalog(rooms.slice(0, Math.max(2, count)), themeHint);
}

async function aiMurdokuToExistingPuzzles(
  items: AiMurdokuContent[],
  typeConfig: AiPuzzleTypeConfig,
  pageId: string,
  pageName: string,
  options?: {
    onProgress?: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<{ settings: ReturnType<typeof getDefaultMurdokuSettings>; puzzles: MurdokuPuzzle[] }> {
  const settings = getDefaultMurdokuSettings();
  const { rows, cols, people } = aiMurdokuGridFromConfig(typeConfig);
  const roomCount = Math.max(2, Math.min(9, people + 1));
  const first = items[0];
  const preset =
    MURDOKU_THEME_PRESETS.find(
      (t) =>
        t.name.toLowerCase() === (first?.theme || '').toLowerCase() ||
        t.id === (first?.theme || '').toLowerCase()
    ) ?? settings.theme;
  const themed = applyThemePreset({
    ...preset,
    name: first?.theme || preset.name,
    location: first?.location || preset.location,
    description: first?.intro || preset.description,
  });
  const sceneStyle = {
    avoidRandomProps: typeConfig.murdokuAvoidRandomProps !== false,
    useOnlyLargeFurniture: typeConfig.murdokuLargeFurnitureOnly === true,
  };
  const characters = charactersFromAiItem(first, people);
  const rooms = roomsFromAiItem(themed.rooms, first?.rooms, roomCount, themed.theme.name);
  const elementNames = sanitizeElementNames(
    first?.elements?.length ? first.elements : themed.elements.map((el) => el.name),
    rooms,
    sceneStyle,
    themed.theme.name
  );
  settings.theme = themed.theme;
  settings.rooms = rooms;
  settings.elements = enrichMurdokuElementsForScene(elementDefsFromNames(elementNames), rooms, sceneStyle);
  settings.characters = characters;
  settings.core.rows = rows;
  settings.core.cols = cols;
  settings.core.numberOfPuzzles = Math.max(1, items.length);
  settings.core.avoidRandomProps = sceneStyle.avoidRandomProps;
  settings.core.useOnlyLargeFurniture = sceneStyle.useOnlyLargeFurniture;
  settings.cards = { ...settings.cards, columns: people };
  settings.deductionGrid = { ...settings.deductionGrid, rows, cols };
  settings.story = {
    ...themed.story,
    caseTitle: items.map((item) => item.caseTitle || item.title).join('\n'),
    intro: items.map((item) => item.intro || first?.intro || themed.story.intro).join('\n'),
    instruction: items.map((item) => item.instruction || item.intro || first?.instruction || themed.story.instruction).join('\n'),
    source: 'ai',
  };

  const puzzles: MurdokuPuzzle[] = [];
  const deadlineMs = Math.min(40_000, 8_000 + rows * cols * 80);
  for (let i = 0; i < items.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    options?.onProgress?.(
      `Puzzle ${i + 1} of ${items.length}: reading the puzzle logic, grid, and areas…`
    );
    const item = items[i];
    const difficulty =
      item.difficulty === 'easy' || item.difficulty === 'hard' ? item.difficulty : 'medium';
    const puzzleCharacters = charactersFromAiItem(item.characters?.length ? item : first, people);
    const puzzleRooms = roomsFromAiItem(
      themed.rooms,
      item.rooms?.length ? item.rooms : first?.rooms,
      roomCount,
      item.theme || themed.theme.name
    );
    let puzzle: MurdokuPuzzle | null = null;
    for (let retry = 0; retry < 6 && !puzzle; retry++) {
      try {
        puzzle = generateMurdokuPuzzle({
          seed: 7000 + i * 97 + retry * 1331,
          rows,
          cols,
          difficulty,
          characters: puzzleCharacters,
          rooms: puzzleRooms,
          elements: settings.elements,
          theme: {
            ...themed.theme,
            name: item.theme || themed.theme.name,
            location: item.location || themed.theme.location,
          },
          story: {
            ...settings.story,
            caseTitle: item.caseTitle || item.title || settings.story.caseTitle,
            intro: item.intro || settings.story.intro,
            instruction: item.instruction || item.intro || settings.story.instruction,
            source: 'ai',
          },
          useSimpleWording: true,
          avoidRandomProps: sceneStyle.avoidRandomProps,
          useOnlyLargeFurniture: sceneStyle.useOnlyLargeFurniture,
          maxAttempts: 40,
          deadlineMs,
          onProgress: (message) =>
            options?.onProgress?.(`Puzzle ${i + 1} of ${items.length}: ${message}`),
        });
      } catch {
        puzzle = null;
      }
      await yieldUi();
    }
    if (!puzzle) continue;
    puzzles.push({
      ...puzzle,
      pageId,
      pageName,
      puzzleIndexInDocument: puzzles.length,
      puzzleNumber: puzzles.length + 1,
    });
    await yieldUi();
  }

  if (puzzles.length === 0) {
    throw new Error('Could not build Murdoku puzzles from the AI case copy. Please try again.');
  }
  settings.core.numberOfPuzzles = puzzles.length;

  return { settings, puzzles };
}

/**
 * Convert validated AI content into document tabs + generated puzzles.
 * Does not replace the current project — callers insert or overlay the bundle.
 */
export async function buildAiGeneratedBundle(
  setup: AiProjectSetup,
  contentByType: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>>,
  frontMatterCopy: AiFrontMatterCopy = {},
  options?: {
    onProgress?: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<AiGeneratedBundle> {
  const pages: DocumentPage[] = [];
  const batchPuzzles: WordSearchPuzzle[] = [];
  const crosswordBatchPuzzles: CrosswordPuzzle[] = [];
  const genericBatchPuzzles: GenericBatchPuzzle[] = [];
  const murdokuBatchPuzzles: MurdokuPuzzle[] = [];
  const byChapter = isAiByChapter(setup);

  for (const typeConfig of setup.puzzleTypes) {
    const type = typeConfig.type;
    const items = contentByType[type] ?? [];
    if (items.length === 0) continue;

    const page = createDocumentPage(type);
    page.name = `${page.name} · AI`;
    const settings = page.settings as PuzzleModuleSettings;

    if (type === 'word-search') {
      const adapted = aiWordSearchToExistingPuzzles(
        items as AiWordSearchContent[],
        typeConfig,
        page.id,
        page.name
      );
      const ws = getDefaultWordSearchSettings();
      ws.core.numberOfPuzzles = adapted.puzzles.length;
      ws.wordList.wordsPerPuzzle = typeConfig.wordsPerPuzzle ?? 15;
      ws.wordList.selectWordListOption = 'manual';
      ws.typography.selectTitleOption = 'custom';
      ws.typography.titleText = adapted.titles.join('\n');
      // Store facts for canvas page-variable resolution; draw only via page variables when enabled.
      ws.typography.funFactsText = adapted.funFacts.join('\n');
      ws.typography.includeFunFacts =
        setup.ensureFunFactPageVariable === true
          ? false
          : Boolean(typeConfig.generateFunFacts);
      settings.wordSearchSettings = ws;
      settings.titleWords = {
        title: setup.bookTitle || 'Word Search',
        fontFamily: 'Arial',
        fontSize: 24,
        words: adapted.words,
      };
      batchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'crossword') {
      const adapted = await aiCrosswordToExistingPuzzles(
        items as AiCrosswordContent[],
        typeConfig,
        page.id,
        page.name,
        options
      );
      const cw = getDefaultCrosswordSettings();
      cw.core.numberOfPuzzles = adapted.puzzles.length;
      cw.core.cluesPerPuzzle = typeConfig.cluesPerPuzzle ?? 15;
      cw.core.exactClueCount = typeConfig.exactClueCount === true;
      cw.core.answersText = adapted.answersText;
      cw.core.cluesText = adapted.cluesText;
      cw.core.themes = setup.description || setup.bookTitle;
      cw.core.language = setup.language || 'English';
      cw.typography.selectTitleOption = 'different-titles';
      cw.typography.differentTitles = adapted.titles.join('\n');
      cw.typography.titleText = adapted.titles[0] || 'Crossword';
      settings.crosswordSettings = cw;
      crosswordBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'sudoku') {
      const adapted = aiSudokuToExistingPuzzles(
        items as AiSudokuContent[],
        typeConfig,
        page.id,
        page.name
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings('sudoku'),
        'sudoku'
      );
      gp.core.numberOfPuzzles = adapted.puzzles.length;
      gp.core.sudokuSize = typeConfig.sudokuSize ?? 9;
      gp.core.sudokuDifficulty = 'mixed';
      gp.typography.selectTitleOption = 'custom';
      gp.typography.titleText = 'Sudoku';
      gp.typography.differentTitles = '';
      gp.typography.puzzleNumberingStyle = 'prefix';
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'maze') {
      const adapted = aiMazeToExistingPuzzles(
        items as AiMazeContent[],
        typeConfig,
        page.id,
        page.name
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings('maze'),
        'maze'
      );
      gp.core.numberOfPuzzles = adapted.puzzles.length;
      gp.typography.selectTitleOption = 'custom';
      gp.typography.titleText = 'Maze';
      gp.typography.differentTitles = '';
      gp.typography.puzzleNumberingStyle = 'prefix';
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'cryptogram') {
      const adapted = aiCryptogramToExistingPuzzles(
        items as AiCryptogramContent[],
        page.id,
        page.name,
        setup.language
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings('cryptogram'),
        'cryptogram'
      );
      gp.core.numberOfPuzzles = adapted.puzzles.length;
      gp.core.cryptogramPhrases = adapted.phrases;
      gp.typography.selectTitleOption = 'custom_per_puzzle';
      gp.typography.differentTitles = adapted.titles.join('\n');
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'word-scramble') {
      const adapted = aiWordScrambleToExistingPuzzles(
        items as AiWordScrambleContent[],
        typeConfig,
        page.id,
        page.name,
        setup.language
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings('word-scramble'),
        'word-scramble'
      );
      gp.core.numberOfPuzzles = adapted.puzzles.length;
      gp.core.wordsPerPuzzle = typeConfig.wordsPerPuzzle ?? 10;
      gp.core.scrambleWords = adapted.scrambleWords;
      gp.typography.selectTitleOption = 'custom_per_puzzle';
      gp.typography.differentTitles = adapted.titles.join('\n');
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'trivia') {
      const adapted = aiTriviaToExistingPuzzles(
        items as AiTriviaContent[],
        typeConfig,
        page.id,
        page.name
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings('trivia'),
        'trivia'
      );
      gp.core.numberOfPuzzles = adapted.questionsText.split('\n').filter(Boolean).length;
      gp.core.questionsPerPage = typeConfig.questionsPerPuzzle ?? 10;
      gp.core.suggestionsPerQuestion = typeConfig.suggestionsPerQuestion ?? 4;
      gp.core.questionsText = adapted.questionsText;
      gp.core.suggestionsText = adapted.suggestionsText;
      gp.core.answersText = adapted.answersText;
      gp.typography.selectTitleOption = 'custom_per_puzzle';
      gp.typography.differentTitles = adapted.titles.join('\n');
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (type === 'murdoku') {
      const adapted = await aiMurdokuToExistingPuzzles(
        items as AiMurdokuContent[],
        typeConfig,
        page.id,
        page.name,
        options
      );
      settings.murdokuSettings = adapted.settings;
      murdokuBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    } else if (
      type === 'binairo' ||
      type === 'codewords' ||
      type === 'kakuro' ||
      type === 'math-maze' ||
      type === 'word-fill' ||
      type === 'number-fill' ||
      type === 'snake'
    ) {
      const adapted = aiGenericEngineToExistingPuzzles(
        items as AiGenericEngineContent[],
        type,
        page.id,
        page.name,
        setup
      );
      const gp = normalizeGenericPuzzleSettings(
        getDefaultGenericPuzzleSettings(type),
        type
      );
      gp.core.numberOfPuzzles = adapted.puzzles.length;
      gp.typography.selectTitleOption = 'custom';
      gp.typography.titleText = getAiPuzzleTypeLabel(type);
      gp.typography.differentTitles = '';
      gp.typography.puzzleNumberingStyle = 'prefix';
      settings.genericPuzzleSettings = gp;
      genericBatchPuzzles.push(...withChapterIndex(adapted.puzzles, typeConfig.count, byChapter));
    }

    const funFactsForPage = (
      settings.wordSearchSettings?.typography.funFactsText ||
      settings.genericPuzzleSettings?.typography.funFactsText ||
      ''
    )
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    pages.push(applyAiLayoutOptionsToPage(page, setup, funFactsForPage));
  }

  if (pages.length === 0) {
    throw new Error('No puzzles were generated.');
  }

  options?.onProgress?.('Dividing puzzles into chapters…');
  const divided = applyAiDivideIntoChapters(setup, {
    pages,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
  });

  // Chapter title pages already come from divide-into-chapters — don't duplicate them.
  const fmSetup: AiProjectSetup =
    isAiByChapter(setup) &&
    divided.pages.some((page) => {
      const settings = page.settings as { isChapterPage?: boolean };
      return settings.isChapterPage === true;
    })
      ? {
          ...setup,
          frontMatter: setup.frontMatter
            ? { ...setup.frontMatter, includeChapterPages: false }
            : setup.frontMatter,
        }
      : setup;

  return {
    pages: attachAiFrontMatter(divided.pages, fmSetup, frontMatterCopy),
    batchPuzzles: divided.batchPuzzles,
    crosswordBatchPuzzles: divided.crosswordBatchPuzzles,
    genericBatchPuzzles: divided.genericBatchPuzzles,
    murdokuBatchPuzzles: divided.murdokuBatchPuzzles,
  };
}

function overlayPuzzleModuleSettings(
  existing: PuzzleModuleSettings,
  generated: PuzzleModuleSettings
): PuzzleModuleSettings {
  const wordSearchSettings =
    generated.wordSearchSettings && existing.wordSearchSettings
      ? {
          ...generated.wordSearchSettings,
          colors: existing.wordSearchSettings.colors,
          pageFrameSettings: existing.wordSearchSettings.pageFrameSettings,
          bookCanvas: existing.wordSearchSettings.bookCanvas,
          typography: {
            ...generated.wordSearchSettings.typography,
            pageNumber: existing.wordSearchSettings.typography.pageNumber,
          },
        }
      : generated.wordSearchSettings ?? existing.wordSearchSettings;
  const crosswordSettings =
    generated.crosswordSettings && existing.crosswordSettings
      ? {
          ...generated.crosswordSettings,
          colors: existing.crosswordSettings.colors,
          pageFrameSettings: existing.crosswordSettings.pageFrameSettings,
          bookCanvas: existing.crosswordSettings.bookCanvas,
        }
      : generated.crosswordSettings ?? existing.crosswordSettings;
  const genericPuzzleSettings =
    generated.genericPuzzleSettings && existing.genericPuzzleSettings
      ? {
          ...generated.genericPuzzleSettings,
          colors: existing.genericPuzzleSettings.colors,
        }
      : generated.genericPuzzleSettings ?? existing.genericPuzzleSettings;
  const murdokuSettings =
    generated.murdokuSettings && existing.murdokuSettings
      ? {
          ...generated.murdokuSettings,
          bookCanvas: existing.murdokuSettings.bookCanvas,
          pageFrameSettings: existing.murdokuSettings.pageFrameSettings,
          textStyles: existing.murdokuSettings.textStyles,
          grid: existing.murdokuSettings.grid,
          cards: existing.murdokuSettings.cards,
        }
      : generated.murdokuSettings ?? existing.murdokuSettings;

  return {
    ...existing,
    titleWords: generated.titleWords ?? existing.titleWords,
    wordSearchSettings,
    crosswordSettings,
    genericPuzzleSettings,
    murdokuSettings,
  };
}

/** Keep the current tab id/name/style; replace puzzle content from an AI bundle. */
export function overlayAiBundleOntoPage(
  existing: DocumentPage,
  bundle: AiGeneratedBundle
): AiGeneratedBundle {
  const generated = bundle.pages[0];
  if (!generated) {
    return {
      pages: [existing],
      batchPuzzles: [],
      crosswordBatchPuzzles: [],
      genericBatchPuzzles: [],
      murdokuBatchPuzzles: [],
    };
  }
  const pageId = existing.id;
  const pageName = existing.name;
  const merged: DocumentPage = {
    ...existing,
    settings: overlayPuzzleModuleSettings(
      existing.settings as PuzzleModuleSettings,
      generated.settings as PuzzleModuleSettings
    ),
  };
  return {
    pages: [merged],
    batchPuzzles: bundle.batchPuzzles.map((puzzle) => ({ ...puzzle, pageId, pageName })),
    crosswordBatchPuzzles: bundle.crosswordBatchPuzzles.map((puzzle) => ({
      ...puzzle,
      pageId,
      pageName,
    })),
    genericBatchPuzzles: bundle.genericBatchPuzzles.map((puzzle) => ({
      ...puzzle,
      pageId,
      pageName,
    })),
    murdokuBatchPuzzles: bundle.murdokuBatchPuzzles.map((puzzle) => ({
      ...puzzle,
      pageId,
      pageName,
    })),
  };
}

/**
 * Convert validated AI content into a loadable GenPuzzle project snapshot.
 * Generated grids use the same engines as manual Generate.
 */
export function aiBundleToProjectFile(setup: AiProjectSetup, bundle: AiGeneratedBundle): GpProjectFile {
  const { pages, batchPuzzles, crosswordBatchPuzzles, genericBatchPuzzles, murdokuBatchPuzzles } =
    bundle;

  const firstPuzzle = pages.find((page) => isPuzzleModuleType(page.moduleType));
  const firstType = (firstPuzzle?.moduleType ?? pages[0]!.moduleType) as PuzzleModuleType;
  const settings = basePersistedSettings(firstType, pages, pages[0]!.id);

  // Hydrate active globals from the first puzzle page so the editor opens with editable fields.
  const firstSettings = (firstPuzzle ?? pages[0]!).settings as PuzzleModuleSettings;
  if (firstSettings.wordSearchSettings) {
    settings.wordSearchSettings = firstSettings.wordSearchSettings;
    settings.titleWords = firstSettings.titleWords;
  }
  if (firstSettings.titleWords) {
    settings.titleWords = firstSettings.titleWords;
  }

  const chapterTopics = getAiChapterTopics(setup);
  settings.bookSettings = {
    ...settings.bookSettings,
    mixPuzzles: isAiByChapter(setup),
    chapterTopics: chapterTopics.length > 0 ? chapterTopics : undefined,
  };

  return {
    format: 'genpuzzle-project',
    formatVersion: 1,
    savedAt: new Date().toISOString(),
    projectName: setup.bookTitle.trim() || 'AI Puzzle Book',
    settings,
    batchPuzzles,
    crosswordBatchPuzzles,
    genericBatchPuzzles,
    murdokuBatchPuzzles,
    currentPuzzle:
      batchPuzzles[0] ??
      crosswordBatchPuzzles[0] ??
      genericBatchPuzzles[0] ??
      murdokuBatchPuzzles[0] ??
      null,
    currentBatchIndex: 0,
  };
}

export async function buildAiProjectFile(
  setup: AiProjectSetup,
  contentByType: Partial<Record<PuzzleModuleType, AiPuzzleContent[]>>,
  frontMatterCopy: AiFrontMatterCopy = {},
  options?: {
    onProgress?: (message: string) => void;
    signal?: AbortSignal;
  }
): Promise<GpProjectFile> {
  const bundle = await buildAiGeneratedBundle(setup, contentByType, frontMatterCopy, options);
  return aiBundleToProjectFile(setup, bundle);
}
