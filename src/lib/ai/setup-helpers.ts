import type { PuzzleModuleType } from '@/lib/document-model';
import type { AiBookOrganization, AiFrontMatterOptions, AiPuzzleTypeConfig } from './types';
import {
  aiChapterMultiplier,
  getAiPuzzleTypeLabel,
  isAiByChapter,
  parseAiChapterTopics,
  parseAiThemeTitles,
  supportsAiThemeTitles,
} from './types';

export function defaultAiTypeConfig(type: PuzzleModuleType): AiPuzzleTypeConfig {
  const base: AiPuzzleTypeConfig = {
    type,
    count: 10,
    difficultyStrategy: 'easy-to-hard',
  };
  switch (type) {
    case 'word-search':
      return {
        ...base,
        wordsPerPuzzle: 15,
        maxWordLength: 12,
        avoidDuplicateWords: true,
        generateFunFacts: true,
        useCustomThemeTitles: false,
        themeTitles: '',
      };
    case 'crossword':
      return {
        ...base,
        cluesPerPuzzle: 15,
        exactClueCount: false,
        maxAnswerLength: 15,
        useCustomThemeTitles: false,
        themeTitles: '',
      };
    case 'sudoku':
      return { ...base, sudokuSize: 9, count: 20 };
    case 'maze':
      return { ...base, mazeSize: 'medium', count: 15 };
    case 'cryptogram':
      return { ...base, count: 12, useCustomThemeTitles: false, themeTitles: '' };
    case 'word-scramble':
      return {
        ...base,
        wordsPerPuzzle: 10,
        maxWordLength: 12,
        avoidDuplicateWords: true,
        useCustomThemeTitles: false,
        themeTitles: '',
      };
    case 'trivia':
      return {
        ...base,
        count: 10,
        questionsPerPuzzle: 10,
        suggestionsPerQuestion: 4,
        useCustomThemeTitles: false,
        themeTitles: '',
      };
    case 'murdoku':
      return {
        ...base,
        count: 5,
        murdokuRows: 9,
        murdokuCols: 9,
        charactersPerPuzzle: 9,
        useCustomThemeTitles: false,
        themeTitles: '',
        murdokuAvoidRandomProps: true,
        murdokuLargeFurnitureOnly: false,
      };
    default:
      return base;
  }
}

export function validateAiSetup(setup: {
  bookTitle: string;
  puzzleTypes: AiPuzzleTypeConfig[];
  frontMatter?: AiFrontMatterOptions;
  organization?: AiBookOrganization;
  chapterTopics?: string;
}): string | null {
  if (!setup.bookTitle.trim()) return 'Please enter a book title.';
  if (!setup.puzzleTypes.length) return 'Select at least one puzzle type.';
  const byChapter = isAiByChapter(setup);
  if (byChapter) {
    const topics = parseAiChapterTopics(setup.chapterTopics);
    if (topics.length === 0) {
      return 'Enter at least one chapter topic (one per line), or turn off Mixed puzzles for each chapter.';
    }
  }
  const chapterMul = aiChapterMultiplier(setup);
  const fm = setup.frontMatter;
  if (fm?.includeChapterPages && fm.useCustomChapterTitles && !byChapter) {
    const titles = parseAiThemeTitles(fm.chapterTitles);
    if (titles.length === 0) {
      return 'Enter at least one chapter title (one per line), or turn off Enter chapter titles.';
    }
  }
  for (const t of setup.puzzleTypes) {
    if (!t.count || t.count < 1) {
      return byChapter
        ? `Enter a valid number of puzzles per chapter for each selected type.`
        : `Enter a valid number of puzzles for each selected type.`;
    }
    if (t.count > 200) {
      return byChapter
        ? `Maximum 200 puzzles per type per chapter for AI generation.`
        : `Maximum 200 puzzles per type for AI generation.`;
    }
    const total = t.count * chapterMul;
    if (total > 200) {
      const label = getAiPuzzleTypeLabel(t.type);
      return `Maximum 200 ${label} puzzles in total (${t.count} per chapter × ${chapterMul} chapters = ${total}).`;
    }
    if (t.difficultyStrategy === 'custom' && t.customDistribution) {
      const sum =
        (t.customDistribution.easy || 0) +
        (t.customDistribution.medium || 0) +
        (t.customDistribution.hard || 0);
      if (sum <= 0) return 'Custom difficulty distribution must include at least one puzzle.';
    }
    if (!byChapter && t.useCustomThemeTitles && supportsAiThemeTitles(t.type)) {
      const titles = parseAiThemeTitles(t.themeTitles);
      if (titles.length < t.count) {
        const label = getAiPuzzleTypeLabel(t.type);
        return `Enter ${t.count} theme title${t.count === 1 ? '' : 's'} for ${label} (one per line). You have ${titles.length}.`;
      }
    }
  }
  return null;
}
