/**
 * Trivia quiz generator — multiple-choice questions with checkbox options.
 */

import type { TriviaPuzzle } from './types';

export type TriviaLayoutFormat = 'single-column' | 'two-column' | 'compact';
export type TriviaCheckboxStyle = 'circle' | 'square';

export interface TriviaQuestion {
  prompt: string;
  suggestions: string[];
  /** Correct answer text (matched to a suggestion when possible). */
  answer: string;
  /** Index into suggestions, or -1 when unmatched. */
  answerIndex: number;
}

export function parseTriviaLines(text: string): string[] {
  return (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeAnswerKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function shuffleInPlace<T>(items: T[], rand: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/** Resolve correct suggestion index from answer text, letter (A–D), or 1-based number. */
export function resolveTriviaAnswerIndex(
  suggestions: string[],
  answer: string
): number {
  if (!suggestions.length) return -1;
  const raw = answer.trim();
  if (!raw) return -1;

  const letter = raw.match(/^([A-Za-z])[.)]?$/);
  if (letter) {
    const idx = letter[1].toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < suggestions.length) return idx;
  }

  const num = raw.match(/^(\d+)[.)]?$/);
  if (num) {
    const idx = parseInt(num[1], 10) - 1;
    if (idx >= 0 && idx < suggestions.length) return idx;
  }

  const key = normalizeAnswerKey(raw);
  const exact = suggestions.findIndex((s) => normalizeAnswerKey(s) === key);
  if (exact >= 0) return exact;

  const partial = suggestions.findIndex(
    (s) =>
      normalizeAnswerKey(s).includes(key) || key.includes(normalizeAnswerKey(s))
  );
  return partial;
}

/**
 * How many suggestions were submitted per question (from flat list length).
 * Returns 0 when there aren't enough lines to cover every question once.
 */
export function getSubmittedSuggestionsPerQuestion(
  suggestionCount: number,
  totalQuestions: number
): number {
  const q = Math.max(1, totalQuestions);
  if (suggestionCount < q) return 0;
  return Math.floor(suggestionCount / q);
}

/** Extra suggestions still needed for the chosen per-question count. */
export function getMissingTriviaSuggestions(
  suggestionCount: number,
  totalQuestions: number,
  suggestionsPerQuestion: number
): number {
  const required =
    Math.max(1, totalQuestions) * Math.max(2, suggestionsPerQuestion);
  return Math.max(0, required - Math.max(0, suggestionCount));
}

/**
 * Reduce or keep suggestion list at `targetCount`, always preserving the answer,
 * then shuffle so the correct option moves to a new position.
 */
export function fitSuggestionsKeepingAnswer(
  suggestions: string[],
  answer: string,
  targetCount: number,
  seed: number
): string[] {
  const target = Math.max(2, targetCount);
  const clean = suggestions.map((s) => s.trim()).filter(Boolean);
  const answerIdx = resolveTriviaAnswerIndex(clean, answer);
  const answerText =
    (answerIdx >= 0 ? clean[answerIdx] : answer.trim()) || clean[0] || 'Answer';
  const answerKey = normalizeAnswerKey(answerText);

  const others = clean.filter((_, i) => i !== answerIdx).filter((s) => {
    return normalizeAnswerKey(s) !== answerKey;
  });

  const rand = seededRandom(seed);
  shuffleInPlace(others, rand);

  const kept: string[] = [answerText];
  for (const opt of others) {
    if (kept.length >= target) break;
    kept.push(opt);
  }
  while (kept.length < target) {
    kept.push(`Option ${String.fromCharCode(65 + kept.length)}`);
  }

  shuffleInPlace(kept, rand);
  return kept;
}

export function buildTriviaQuestion(
  prompt: string,
  suggestions: string[],
  answer: string,
  options?: { targetSuggestionCount?: number; shuffleSeed?: number }
): TriviaQuestion {
  const cleanAnswer = answer.trim();
  const target = options?.targetSuggestionCount;
  const fitted =
    typeof target === 'number' && target > 0
      ? fitSuggestionsKeepingAnswer(
          suggestions,
          cleanAnswer,
          target,
          options?.shuffleSeed ?? 1
        )
      : suggestions.map((s) => s.trim()).filter(Boolean);

  return {
    prompt: prompt.trim(),
    suggestions: fitted,
    answer: cleanAnswer,
    answerIndex: resolveTriviaAnswerIndex(fitted, cleanAnswer),
  };
}

export function generateTrivia(questions: TriviaQuestion[]): TriviaPuzzle {
  return {
    type: 'trivia',
    questions: questions.filter((q) => q.prompt),
  };
}

export interface TriviaBatchInput {
  /** Total questions across the whole document (not page count). */
  totalQuestions: number;
  questionsPerPage: number;
  suggestionsPerQuestion: number;
  questionsText: string;
  suggestionsText: string;
  answersText: string;
}

export interface TriviaBatchResult {
  puzzles: TriviaPuzzle[];
  requiredQuestions: number;
  requiredSuggestions: number;
  requiredAnswers: number;
  pageCount: number;
  questionCount: number;
  suggestionCount: number;
  answerCount: number;
  /** Suggestions available per question from the flat list. */
  submittedSuggestionsPerQuestion: number;
  missingSuggestions: number;
}

/** Default answers shown in each solution column. */
export const DEFAULT_TRIVIA_ANSWERS_PER_COLUMN = 20;
/** Default number of side-by-side answer columns on a solution page. */
export const DEFAULT_TRIVIA_SOLUTION_COLUMNS = 3;

/** Resolve the printable answer label for a trivia question. */
export function resolveTriviaAnswerLabel(q: {
  answer?: string;
  answerIndex?: number;
  suggestions?: string[];
}): string {
  const suggestions = q.suggestions ?? [];
  const idx = q.answerIndex ?? -1;
  if (idx >= 0 && suggestions[idx]) return suggestions[idx];
  return (q.answer || '').trim();
}

export interface TriviaAnswerRow {
  number: number;
  prompt: string;
  answer: string;
  suggestions: string[];
  answerIndex: number;
}

/** Flatten puzzle-page questions into a continuous numbered answer list. */
export function flattenTriviaAnswerRows(
  puzzles: Array<{ questions?: TriviaQuestion[] | TriviaPuzzle['questions'] }>,
  startNumber = 1
): TriviaAnswerRow[] {
  const start = Math.max(1, Math.round(startNumber) || 1);
  const rows: TriviaAnswerRow[] = [];
  let n = start;
  for (const puzzle of puzzles) {
    for (const q of puzzle.questions ?? []) {
      const prompt = (q.prompt || '').trim();
      if (!prompt) continue;
      rows.push({
        number: n,
        prompt,
        answer: resolveTriviaAnswerLabel(q),
        suggestions: q.suggestions ?? [],
        answerIndex: q.answerIndex ?? -1,
      });
      n += 1;
    }
  }
  return rows;
}

/** Answers shown in each solution column (per-column capacity). */
export function computeTriviaAnswersPerColumn(args: {
  answersPerColumn?: number;
  /** @deprecated alias of answersPerColumn */
  answersPerPage?: number;
}): number {
  const raw = args.answersPerColumn ?? args.answersPerPage;
  return Math.max(
    1,
    Math.min(
      50,
      Math.round(raw ?? DEFAULT_TRIVIA_ANSWERS_PER_COLUMN) ||
        DEFAULT_TRIVIA_ANSWERS_PER_COLUMN
    )
  );
}

/** Number of answer-table columns on a solution page (1–4). */
export function computeTriviaSolutionColumns(columns?: number): number {
  const cols = Math.round(columns ?? DEFAULT_TRIVIA_SOLUTION_COLUMNS);
  if (cols === 1 || cols === 2 || cols === 3 || cols === 4) return cols;
  return DEFAULT_TRIVIA_SOLUTION_COLUMNS;
}

/**
 * Total answers that fit on one trivia solution page
 * (= answers per column × column count).
 */
export function computeTriviaSolutionsPerPage(args: {
  answersPerPage?: number;
  answersPerColumn?: number;
  solutionColumns?: number;
  /** @deprecated ignored */
  questionsPerPage?: number;
  answerFontSizePt?: number;
  spaceBetweenPt?: number;
  pageHeightIn?: number;
  contentMarginIn?: number;
}): number {
  const perColumn = computeTriviaAnswersPerColumn({
    answersPerColumn: args.answersPerColumn ?? args.answersPerPage,
  });
  const columns = computeTriviaSolutionColumns(args.solutionColumns);
  return perColumn * columns;
}

/** 1-based question number for the first question on a trivia puzzle page. */
export function getTriviaQuestionNumberStart(
  puzzles: Array<{ questions?: TriviaQuestion[] | TriviaPuzzle['questions'] }>,
  puzzleIndexInDocument: number,
  startNumber = 1
): number {
  const start = Math.max(1, Math.round(startNumber) || 1);
  const idx = Math.max(0, puzzleIndexInDocument);
  let count = 0;
  for (let i = 0; i < idx && i < puzzles.length; i++) {
    count += (puzzles[i].questions ?? []).filter((q) => (q.prompt || '').trim()).length;
  }
  return start + count;
}

/**
 * Pack whole trivia games onto solution pages without splitting a game.
 * Capacity is total answer rows that may appear on one sheet.
 */
export function packTriviaGamesForSolutionPages(
  puzzles: TriviaPuzzle[],
  answersCapacity: number
): TriviaPuzzle[][] {
  const capacity = Math.max(1, Math.round(answersCapacity) || 1);
  const pages: TriviaPuzzle[][] = [];
  let current: TriviaPuzzle[] = [];
  let used = 0;

  for (const puzzle of puzzles) {
    const n = (puzzle.questions ?? []).filter((q) => (q.prompt || '').trim()).length;
    if (n <= 0) continue;
    if (current.length > 0 && used + n > capacity) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(puzzle);
    used += n;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/**
 * @deprecated Prefer packTriviaGamesForSolutionPages — keeps games intact.
 * Flattens answers into synthetic puzzles (legacy).
 */
export function buildTriviaSolutionPagePuzzles(
  puzzles: TriviaPuzzle[],
  answersPerPage: number,
  startNumber = 1
): TriviaPuzzle[] {
  return packTriviaGamesForSolutionPages(puzzles, answersPerPage).map((group, pageIndex) => {
    const rows = flattenTriviaAnswerRows(group, 1);
    return {
      type: 'trivia' as const,
      puzzleIndexInDocument: pageIndex,
      puzzleNumber: group[0]?.puzzleNumber ?? startNumber + pageIndex,
      questions: rows.map((row) => ({
        prompt: row.prompt,
        suggestions: row.suggestions,
        answer: row.answer,
        answerIndex: row.answerIndex,
      })),
    };
  });
}

/** Display label for a trivia game on solution pages. */
export function formatTriviaSolutionHeading(
  puzzle: TriviaPuzzle,
  fallbackIndex = 0,
  puzzlesStartingNumber = 1
): string {
  const n =
    typeof puzzle.puzzleNumber === 'number'
      ? puzzle.puzzleNumber
      : puzzlesStartingNumber +
        (typeof puzzle.puzzleIndexInDocument === 'number'
          ? puzzle.puzzleIndexInDocument
          : fallbackIndex);
  return `Trivia #${Math.max(1, n)}`;
}

/** Chunk flat question / suggestion / answer lines into page puzzles. */
export function buildTriviaBatch(input: TriviaBatchInput): TriviaBatchResult {
  const totalQuestions = Math.max(1, Math.round(input.totalQuestions) || 1);
  const questionsPerPage = Math.max(1, Math.round(input.questionsPerPage) || 1);
  const suggestionsPerQuestion = Math.max(
    2,
    Math.round(input.suggestionsPerQuestion) || 4
  );
  const pageCount = Math.max(1, Math.ceil(totalQuestions / questionsPerPage));
  const requiredQuestions = totalQuestions;
  const requiredSuggestions = requiredQuestions * suggestionsPerQuestion;
  const requiredAnswers = requiredQuestions;

  const questions = parseTriviaLines(input.questionsText);
  const suggestions = parseTriviaLines(input.suggestionsText);
  const answers = parseTriviaLines(input.answersText);

  const submittedPer = getSubmittedSuggestionsPerQuestion(
    suggestions.length,
    totalQuestions
  );
  const missingSuggestions = getMissingTriviaSuggestions(
    suggestions.length,
    totalQuestions,
    suggestionsPerQuestion
  );
  // Group size from submitted pool (when trimming down, use full submitted groups).
  const groupSize = Math.max(submittedPer, suggestionsPerQuestion);

  const puzzles: TriviaPuzzle[] = [];
  for (let page = 0; page < pageCount; page++) {
    const pageQuestions: TriviaQuestion[] = [];
    const start = page * questionsPerPage;
    const count = Math.min(questionsPerPage, totalQuestions - start);
    for (let q = 0; q < count; q++) {
      const qi = start + q;
      const prompt =
        questions[qi] ??
        (questions.length > 0
          ? questions[qi % questions.length]
          : `Question ${qi + 1}`);
      const sugStart = qi * groupSize;
      const pool: string[] = [];
      for (let s = 0; s < groupSize; s++) {
        const si = sugStart + s;
        if (si < suggestions.length) pool.push(suggestions[si]);
      }
      const answer =
        answers[qi] ??
        (answers.length > 0 ? answers[qi % answers.length] : pool[0] ?? '');
      pageQuestions.push(
        buildTriviaQuestion(prompt, pool, answer, {
          targetSuggestionCount: suggestionsPerQuestion,
          shuffleSeed: (qi + 1) * 7919 + suggestionsPerQuestion * 97,
        })
      );
    }
    puzzles.push(generateTrivia(pageQuestions));
  }

  return {
    puzzles,
    requiredQuestions,
    requiredSuggestions,
    requiredAnswers,
    pageCount,
    questionCount: questions.length,
    suggestionCount: suggestions.length,
    answerCount: answers.length,
    submittedSuggestionsPerQuestion: submittedPer,
    missingSuggestions,
  };
}
