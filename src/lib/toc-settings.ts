import type { ResolvedTocEntry } from './book-compiler';

export type TocLeaderStyle = 'dots' | 'dashes' | 'spaces' | 'none';
export type TocTableFormat = 'classic' | 'simple' | 'indented';
/** List every eligible document page, or only custom chapters. */
export type TocEntryScope = 'all' | 'chapters';
/** Column layout for TOC entries. */
export type TocColumnLayout = 'auto' | 'one' | 'two';

export interface TocChapter {
  id: string;
  title: string;
}

/** User-added TOC lines (title + page number), not tied to a document. */
export interface TocCustomEntry {
  id: string;
  title: string;
  pageNumber: string;
}

/** Synthetic document id for the Solutions TOC line (not a real tab). */
export const TOC_SOLUTIONS_DOCUMENT_ID = '__toc-solutions__';

export interface TocSettings {
  /** Leader between title and page number */
  leaderStyle: TocLeaderStyle;
  /** Overall table layout style */
  tableFormat: TocTableFormat;
  /** Font size for TOC page heading (pt) */
  titleFontSize?: number;
  /** Font size for each entry row (pt) */
  entryFontSize?: number;
  /** Color for the TOC page heading */
  titleTextColor?: string;
  /** Color for entry text */
  entryTextColor?: string;
  /** Show page numbers in the table */
  showPageNumbers: boolean;
  /** Include individual puzzle pages under puzzle documents (when scope is all) */
  includePuzzlePages: boolean;
  /** Include solution page(s) in the TOC */
  includeSolutionPages: boolean;
  /**
   * When true, non–title-page documents (intro, copyright, etc.) stay off the TOC
   * unless listed in revealedDocumentIds.
   */
  hideDocuments: boolean;
  /**
   * When true, puzzle documents stay off the TOC unless listed in revealedDocumentIds.
   */
  hidePuzzleDocuments: boolean;
  /** Row vertical padding in px (legacy — prefer lineSpacingPx) */
  rowPaddingPx?: number;
  /** Vertical space between entry rows in px */
  lineSpacingPx?: number;
  /** What entries to show in the TOC */
  entryScope: TocEntryScope;
  /** Number of chapters when entryScope === 'chapters' */
  chapterCount: number;
  /** Chapter titles (length should match chapterCount) */
  chapters: TocChapter[];
  /** Document IDs removed from the auto TOC */
  excludedDocumentIds: string[];
  /** Document IDs forced visible despite hideDocuments / hidePuzzleDocuments */
  revealedDocumentIds: string[];
  /** Extra custom title / page-number rows */
  customEntries: TocCustomEntry[];
  /** Column layout preference */
  columnLayout: TocColumnLayout;
  /** Min entries before auto two-column layout (when columnLayout === 'auto') */
  twoColumnMinEntries: number;
  /** Gap between two columns in px */
  columnGapPx: number;
  /** Space below the TOC heading in px */
  titleBottomGapPx: number;
  /** Extra indent for level-2 entries in px */
  entryIndentPx: number;
  /** Font family for TOC page heading */
  titleFontFamily?: string;
  /** Font family for TOC entry rows */
  entryFontFamily?: string;
  /** Heading font weight */
  titleFontWeight?: boolean;
  /** Entry font weight */
  entryFontWeight?: boolean;
  /** Horizontal gap between title and leader / page number (px) */
  entryHorizontalGapPx: number;
  /** Extra top padding for the entries block (px) */
  entriesTopGapPx: number;
  /** Letter spacing for entries (px) */
  entryLetterSpacingPx: number;
  /**
   * Always fixed page count. Kept for document compatibility; normalize forces `'fixed'`.
   * @deprecated Auto mode removed — TOC always uses a fixed page count.
   */
  pageCountMode: 'fixed';
  /** Target TOC page count (1–12) */
  targetPageCount: number;
  /** Shrink/grow entry text & line spacing to fill the chosen page count without overlap */
  autoFitText: boolean;
}

export const DEFAULT_TOC_SETTINGS: TocSettings = {
  leaderStyle: 'dots',
  tableFormat: 'classic',
  showPageNumbers: true,
  includePuzzlePages: false,
  includeSolutionPages: true,
  hideDocuments: true,
  hidePuzzleDocuments: true,
  rowPaddingPx: 4,
  lineSpacingPx: 10,
  entryScope: 'all',
  chapterCount: 3,
  chapters: [
    { id: 'chapter-1', title: 'Chapter 1' },
    { id: 'chapter-2', title: 'Chapter 2' },
    { id: 'chapter-3', title: 'Chapter 3' },
  ],
  excludedDocumentIds: [],
  revealedDocumentIds: [],
  customEntries: [],
  columnLayout: 'one',
  twoColumnMinEntries: 7,
  columnGapPx: 24,
  titleBottomGapPx: 20,
  entryIndentPx: 24,
  titleFontFamily: undefined,
  entryFontFamily: undefined,
  titleFontWeight: true,
  entryFontWeight: false,
  entryHorizontalGapPx: 10,
  entriesTopGapPx: 4,
  entryLetterSpacingPx: 0,
  pageCountMode: 'fixed',
  targetPageCount: 1,
  autoFitText: true,
};

/** Three common book TOC visual forms (table format + leader presets). */
export const TOC_TABLE_FORMS: Array<{
  id: TocTableFormat;
  name: string;
  description: string;
  leaderStyle: TocLeaderStyle;
}> = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Title ····· page — traditional dotted leaders',
    leaderStyle: 'dots',
  },
  {
    id: 'simple',
    name: 'Flush',
    description: 'Title on the left, page number on the right',
    leaderStyle: 'none',
  },
  {
    id: 'indented',
    name: 'Nested',
    description: 'Indented sub-entries for hierarchical books',
    leaderStyle: 'dots',
  },
];

export function applyTocTableForm(
  current: Partial<TocSettings> | null | undefined,
  formId: TocTableFormat
): TocSettings {
  const form = TOC_TABLE_FORMS.find((f) => f.id === formId) ?? TOC_TABLE_FORMS[0];
  return normalizeTocSettings({
    ...current,
    tableFormat: form.id,
    leaderStyle: form.leaderStyle,
  });
}

function newChapterId(): string {
  return `chapter-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Ensure chapters array length matches chapterCount. */
export function ensureTocChapters(
  chapters: TocChapter[] | undefined,
  count: number
): TocChapter[] {
  const safeCount = Math.max(1, Math.min(50, Math.round(count) || 1));
  const current = Array.isArray(chapters) ? [...chapters] : [];
  while (current.length < safeCount) {
    const n = current.length + 1;
    current.push({ id: newChapterId(), title: `Chapter ${n}` });
  }
  return current.slice(0, safeCount).map((ch, i) => ({
    id: ch.id || newChapterId(),
    title: (ch.title ?? '').trim() || `Chapter ${i + 1}`,
  }));
}

export function normalizeTocSettings(raw?: Partial<TocSettings> | null): TocSettings {
  const base = { ...DEFAULT_TOC_SETTINGS, ...raw };
  const chapterCount = Math.max(
    1,
    Math.min(50, Math.round(Number(base.chapterCount) || DEFAULT_TOC_SETTINGS.chapterCount))
  );
  const chapters = ensureTocChapters(base.chapters, chapterCount);
  const excludedDocumentIds = Array.isArray(base.excludedDocumentIds)
    ? base.excludedDocumentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const revealedDocumentIds = Array.isArray(base.revealedDocumentIds)
    ? base.revealedDocumentIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const customEntries = Array.isArray(base.customEntries)
    ? base.customEntries
        .filter((e): e is TocCustomEntry => !!e && typeof e === 'object')
        .map((e, i) => ({
          id:
            typeof e.id === 'string' && e.id.trim()
              ? e.id.trim()
              : `custom-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
          title: typeof e.title === 'string' ? e.title : '',
          pageNumber: typeof e.pageNumber === 'string' ? e.pageNumber : '',
        }))
    : [];

  return {
    leaderStyle: ['dots', 'dashes', 'spaces', 'none'].includes(base.leaderStyle)
      ? base.leaderStyle
      : DEFAULT_TOC_SETTINGS.leaderStyle,
    tableFormat: ['classic', 'simple', 'indented'].includes(base.tableFormat)
      ? base.tableFormat
      : DEFAULT_TOC_SETTINGS.tableFormat,
    titleFontSize:
      typeof base.titleFontSize === 'number' && base.titleFontSize > 0
        ? base.titleFontSize
        : undefined,
    entryFontSize:
      typeof base.entryFontSize === 'number' && base.entryFontSize > 0
        ? base.entryFontSize
        : undefined,
    titleTextColor: base.titleTextColor,
    entryTextColor: base.entryTextColor,
    showPageNumbers: base.showPageNumbers !== false,
    includePuzzlePages: !!base.includePuzzlePages,
    includeSolutionPages: base.includeSolutionPages !== false,
    hideDocuments: base.hideDocuments !== false,
    hidePuzzleDocuments: base.hidePuzzleDocuments !== false,
    rowPaddingPx:
      typeof base.rowPaddingPx === 'number' && base.rowPaddingPx >= 0
        ? base.rowPaddingPx
        : DEFAULT_TOC_SETTINGS.rowPaddingPx,
    lineSpacingPx:
      typeof base.lineSpacingPx === 'number' && base.lineSpacingPx >= 0
        ? base.lineSpacingPx
        : DEFAULT_TOC_SETTINGS.lineSpacingPx,
    entryScope: base.entryScope === 'chapters' ? 'chapters' : 'all',
    chapterCount,
    chapters,
    excludedDocumentIds,
    revealedDocumentIds,
    customEntries,
    columnLayout:
      base.columnLayout === 'two'
        ? 'two'
        : base.columnLayout === 'one' || base.columnLayout === 'auto'
          ? 'one'
          : DEFAULT_TOC_SETTINGS.columnLayout,
    twoColumnMinEntries: Math.max(
      2,
      Math.min(50, Math.round(Number(base.twoColumnMinEntries) || DEFAULT_TOC_SETTINGS.twoColumnMinEntries))
    ),
    columnGapPx: Math.max(
      0,
      Math.min(80, Math.round(Number(base.columnGapPx) || DEFAULT_TOC_SETTINGS.columnGapPx))
    ),
    titleBottomGapPx: Math.max(
      0,
      Math.min(80, Math.round(Number(base.titleBottomGapPx) || DEFAULT_TOC_SETTINGS.titleBottomGapPx))
    ),
    entryIndentPx: Math.max(
      0,
      Math.min(64, Math.round(Number(base.entryIndentPx) || DEFAULT_TOC_SETTINGS.entryIndentPx))
    ),
    titleFontFamily:
      typeof base.titleFontFamily === 'string' && base.titleFontFamily.trim()
        ? base.titleFontFamily.trim()
        : undefined,
    entryFontFamily:
      typeof base.entryFontFamily === 'string' && base.entryFontFamily.trim()
        ? base.entryFontFamily.trim()
        : undefined,
    titleFontWeight: base.titleFontWeight !== false,
    entryFontWeight: !!base.entryFontWeight,
    entryHorizontalGapPx: Math.max(
      0,
      Math.min(40, Math.round(Number(base.entryHorizontalGapPx) || DEFAULT_TOC_SETTINGS.entryHorizontalGapPx))
    ),
    entriesTopGapPx: Math.max(
      0,
      Math.min(80, Math.round(Number(base.entriesTopGapPx) || DEFAULT_TOC_SETTINGS.entriesTopGapPx))
    ),
    entryLetterSpacingPx: Math.max(
      -2,
      Math.min(8, Number(base.entryLetterSpacingPx) || DEFAULT_TOC_SETTINGS.entryLetterSpacingPx)
    ),
    pageCountMode: 'fixed',
    targetPageCount: Math.max(
      1,
      Math.min(12, Math.round(Number(base.targetPageCount) || DEFAULT_TOC_SETTINGS.targetPageCount))
    ),
    autoFitText: base.autoFitText !== false,
  };
}

function leaderChar(style: TocLeaderStyle): string {
  switch (style) {
    case 'dashes':
      return '—';
    case 'spaces':
      return ' ';
    case 'none':
      return '';
    default:
      return '.';
  }
}

/** Format TOC entries as plain text (export / manual preview fallback). */
export function formatTocLines(
  entries: ResolvedTocEntry[],
  tocSettings?: Partial<TocSettings> | null
): string {
  const settings = normalizeTocSettings(tocSettings);
  const leader = leaderChar(settings.leaderStyle);

  return entries
    .map((entry) => {
      const indent =
        settings.tableFormat === 'indented' && entry.level === 2
          ? '    '
          : settings.tableFormat === 'simple'
            ? ''
            : entry.level === 2
              ? '    '
              : '';
      const num =
        settings.showPageNumbers && entry.pageNumber ? entry.pageNumber : '';
      const title = entry.title;

      if (settings.tableFormat === 'simple' || settings.leaderStyle === 'none') {
        return num ? `${indent}${title}  ${num}` : `${indent}${title}`;
      }

      const targetWidth = 48;
      const gap = Math.max(2, targetWidth - title.length - (num ? num.length + 2 : 0));
      const leaders = leader.repeat(gap);
      return num ? `${indent}${title}  ${leaders}  ${num}` : `${indent}${title}`;
    })
    .join('\n');
}
