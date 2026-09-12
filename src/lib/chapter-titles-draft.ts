/**
 * Draft chapter titles typed in Layout → Chapters, shared with the Puzzle
 * "Divide lists into N chapters" control so Generate can create missing pages.
 */

export const CHAPTER_TITLES_DRAFT_STORAGE_KEY = 'puzzle-book-maker-chapter-titles-draft';
export const CHAPTER_TITLES_DRAFT_EVENT = 'genpuzzle-chapter-titles-draft';
export const DIVIDE_LISTS_PREFERENCE_STORAGE_KEY = 'puzzle-book-maker-divide-lists-into-chapters';
export const DIVIDE_LISTS_PREFERENCE_EVENT = 'genpuzzle-divide-lists-preference';

export interface ChapterTitlesDraft {
  titles: string[];
  touched: boolean;
}

export interface DivideListsPreference {
  enabled: boolean;
  chapterCount: number;
  customPuzzleCounts?: number[];
}

export function parseChapterTitleLines(text: string | undefined | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
}

export function defaultChapterTitle(index: number): string {
  return `Chapter ${index + 1}: `;
}

export function ensureChapterTitles(titles: string[], count: number): string[] {
  const n = Math.max(1, Math.round(count) || 1);
  const next = titles.map((title) => title.trimEnd()).filter((title) => title.trim().length > 0);
  while (next.length < n) {
    next.push(defaultChapterTitle(next.length));
  }
  return next.slice(0, n);
}

export function readChapterTitlesDraft(): ChapterTitlesDraft {
  if (typeof window === 'undefined') return { titles: [], touched: false };
  try {
    const raw = window.localStorage.getItem(CHAPTER_TITLES_DRAFT_STORAGE_KEY);
    if (!raw) return { titles: [], touched: false };
    const parsed = JSON.parse(raw) as Partial<ChapterTitlesDraft>;
    const titles = Array.isArray(parsed.titles)
      ? parsed.titles.map((title) => String(title ?? ''))
      : parseChapterTitleLines(typeof parsed === 'string' ? parsed : '');
    return {
      titles: titles.filter((title) => title.trim().length > 0),
      touched: parsed.touched === true,
    };
  } catch {
    return { titles: [], touched: false };
  }
}

export function writeChapterTitlesDraft(draft: ChapterTitlesDraft): void {
  if (typeof window === 'undefined') return;
  const titles = draft.titles.map((title) => title.trimEnd()).filter((title) => title.trim().length > 0);
  const payload: ChapterTitlesDraft = { titles, touched: draft.touched && titles.length > 0 };
  try {
    window.localStorage.setItem(CHAPTER_TITLES_DRAFT_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(CHAPTER_TITLES_DRAFT_EVENT, { detail: payload }));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function readDivideListsPreference(): DivideListsPreference {
  if (typeof window === 'undefined') return { enabled: false, chapterCount: 2 };
  try {
    const raw = window.localStorage.getItem(DIVIDE_LISTS_PREFERENCE_STORAGE_KEY);
    if (!raw) return { enabled: false, chapterCount: 2 };
    const parsed = JSON.parse(raw) as Partial<DivideListsPreference>;
    return {
      enabled: parsed.enabled === true,
      chapterCount: Math.max(2, Math.round(Number(parsed.chapterCount)) || 2),
      customPuzzleCounts: Array.isArray(parsed.customPuzzleCounts)
        ? parsed.customPuzzleCounts.map((c) => Math.max(1, Math.round(Number(c)) || 1))
        : undefined,
    };
  } catch {
    return { enabled: false, chapterCount: 2 };
  }
}

export function writeDivideListsPreference(pref: DivideListsPreference): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      DIVIDE_LISTS_PREFERENCE_STORAGE_KEY,
      JSON.stringify({
        enabled: pref.enabled === true,
        chapterCount: Math.max(2, Math.round(pref.chapterCount) || 2),
        customPuzzleCounts: pref.customPuzzleCounts,
      } satisfies DivideListsPreference)
    );
    window.dispatchEvent(new CustomEvent(DIVIDE_LISTS_PREFERENCE_EVENT, { detail: pref }));
  } catch {
    // Ignore quota / private-mode failures.
  }
}
