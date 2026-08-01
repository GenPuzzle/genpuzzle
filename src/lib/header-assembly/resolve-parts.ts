import type { WordSearchPuzzle, WordSearchSettings, TitleWordsSettings } from '../puzzles/types';
import { getPuzzleContentLine, resolvePuzzleDisplayNumber } from '../puzzle-line-index';

export interface HeaderTextParts {
  numberText: string;
  titleText: string;
  subtitleText: string;
  showNumber: boolean;
}

function resolveBaseTitle(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings
): string {
  const { typography } = settings;

  switch (typography.selectTitleOption) {
    case 'puzzle-number':
    case 'one-custom-title':
      return typography.titleText || titleWords.title || 'Word Search';
    case 'custom': {
      const lines = (typography.titleText || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return getPuzzleContentLine(lines, puzzle, settings, true);
    }
    default:
      return '';
  }
}

function resolveSubtitle(puzzle: WordSearchPuzzle, settings: WordSearchSettings): string {
  const { typography } = settings;
  if (!typography.includeFunFacts || !typography.funFactsText) return '';

  const lines = typography.funFactsText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => line);

  return getPuzzleContentLine(lines, puzzle, settings);
}

function formatNumber(puzzle: WordSearchPuzzle, settings: WordSearchSettings): string {
  const puzzleNum = resolvePuzzleDisplayNumber(puzzle, settings);
  const style = settings.typography.puzzleNumberingStyle || 'none';
  if (style === 'none') return '';
  if (style === 'prefix') return `${puzzleNum}`;
  if (style === 'suffix') return `#${puzzleNum}`;
  return `${puzzleNum}`;
}

export function resolveHeaderTextParts(
  puzzle: WordSearchPuzzle,
  settings: WordSearchSettings,
  titleWords: TitleWordsSettings
): HeaderTextParts {
  const numberText = formatNumber(puzzle, settings);
  const titleText = resolveBaseTitle(puzzle, settings, titleWords);
  const subtitleText = resolveSubtitle(puzzle, settings);

  return {
    numberText,
    titleText,
    subtitleText,
    showNumber: numberText.length > 0,
  };
}
