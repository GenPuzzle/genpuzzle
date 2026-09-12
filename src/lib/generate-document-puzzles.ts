import type { DocumentPage, PuzzleModuleSettings } from './document-model';
import {
  generateWordSearch,
  generateCrossword,
  buildWordSearchShapeMask,
  resolveShapeMaskImageSrc,
  type Direction,
  type WordSearchPuzzle,
  type CrosswordPuzzle,
} from './puzzles';
import {
  getEffectiveWordsPerPuzzle,
  getFillWithWordLettersOnly,
  getWordRepeatCount,
} from './puzzle-word-list';
import {
  buildCrosswordWordClues,
  normalizeCrosswordSettings,
  parseCrosswordLines,
} from './crossword-settings';

export async function buildWordSearchPuzzlesForDocumentPage(args: {
  page: DocumentPage;
  directions: Direction[];
}): Promise<WordSearchPuzzle[]> {
  const settings = args.page.settings as PuzzleModuleSettings;
  const ws = settings.wordSearchSettings;
  const pageWords = settings.titleWords?.words ?? [];
  if (!ws) return [];

  const wordsPerPuzzle = getEffectiveWordsPerPuzzle(ws.wordList);
  const wordRepeatCount = getWordRepeatCount(ws.wordList);
  const fillWithWordLettersOnly = getFillWithWordLettersOnly(ws.wordList);
  const chapterIndex = settings.chapterIndex;
  const newPuzzles: WordSearchPuzzle[] = [];
  let shapeMaskCache = new Map<string, boolean[][]>();

  for (let i = 0; i < ws.core.numberOfPuzzles; i++) {
    const startIdx = i * wordsPerPuzzle;
    const puzzleWords = pageWords.slice(startIdx, startIdx + wordsPerPuzzle);
    if (puzzleWords.length === 0) break;

    let shapeMask: boolean[][] | undefined;
    if (ws.core.shapeWordSearchEnabled) {
      const imageSrc = resolveShapeMaskImageSrc(ws.core, i);
      if (!imageSrc) {
        const mode = ws.core.shapeMaskMode ?? 'common';
        throw new Error(
          mode === 'per-puzzle'
            ? `Upload a shape image for puzzle ${i + 1} (or use batch upload).`
            : 'Upload a PNG silhouette for Shape Word Search before generating.'
        );
      }
      const cacheKey = `${imageSrc.length}:${ws.core.lettersAcross}x${ws.core.lettersDown}:${ws.core.shapeMaskFit ?? 'contain'}:${ws.core.shapeMaskAlphaThreshold ?? 40}:${imageSrc.slice(0, 64)}`;
      const cached = shapeMaskCache.get(cacheKey);
      if (cached) {
        shapeMask = cached;
      } else {
        shapeMask = await buildWordSearchShapeMask(imageSrc, ws.core.lettersAcross, ws.core.lettersDown, {
          alphaThreshold: ws.core.shapeMaskAlphaThreshold ?? 40,
          fit: ws.core.shapeMaskFit ?? 'contain',
        });
        shapeMaskCache.set(cacheKey, shapeMask);
      }
    }

    const puzzle = generateWordSearch(
      puzzleWords,
      ws.core.lettersAcross,
      ws.core.lettersDown,
      args.directions,
      ws.wordList.aiLanguage,
      shapeMask,
      wordRepeatCount,
      fillWithWordLettersOnly
    ) as WordSearchPuzzle;

    puzzle.puzzleNumber = ws.core.puzzlesStartingNumber + i;
    puzzle.puzzleIndexInDocument = i;
    puzzle.pageId = args.page.id;
    puzzle.pageName = args.page.name;
    if (typeof chapterIndex === 'number') puzzle.chapterIndex = chapterIndex;
    newPuzzles.push(puzzle);
  }

  return newPuzzles;
}

export function buildCrosswordPuzzlesForDocumentPage(page: DocumentPage): CrosswordPuzzle[] {
  const settings = page.settings as PuzzleModuleSettings;
  const cw = normalizeCrosswordSettings(settings.crosswordSettings);
  const core = cw.core;
  const answersFromCore = parseCrosswordLines(core.answersText);
  const answers =
    answersFromCore.length > 0 ? answersFromCore : (settings.titleWords?.words ?? []).filter(Boolean);
  const clues = parseCrosswordLines(core.cluesText);
  const cluesPerPuzzle = Math.max(1, core.cluesPerPuzzle || 15);
  const puzzleCount = Math.max(1, core.numberOfPuzzles || 1);
  const chapterIndex = settings.chapterIndex;
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
      pageId: page.id,
      pageName: page.name,
      puzzleIndexInDocument: i,
      puzzleNumber: core.puzzlesStartingNumber + i,
      ...(typeof chapterIndex === 'number' ? { chapterIndex } : {}),
    });
  }

  return generated;
}
