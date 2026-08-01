/**
 * Batch-create chapter title pages (document tabs) with titles and optional images.
 */

import {
  createDocumentPage,
  isPuzzleModuleType,
  type DocumentPage,
  type TextModuleSettings,
} from './document-model';
import {
  buildChapterBlocksFromStyle,
  normalizeChapterPageStyle,
  type ChapterPageStyleSettings,
} from './chapter-page-layouts';
import { isChapterTitlePage } from './insert-separator-page';
import { getDefaultWordSearchSettings, type WordSearchSettings } from './puzzles/types';

export interface ChapterBatchEntry {
  title: string;
  /** Optional per-chapter subtitle */
  subtitle?: string;
  /**
   * When true on update, clear the chapter subtitle even if subtitle is undefined.
   * When omitted/false, keep the existing subtitle if no new subtitle is provided.
   */
  clearSubtitle?: boolean;
  /** Optional image data URL for this chapter page */
  imageSrc?: string;
  /**
   * When true on update, clear the chapter image even if imageSrc is undefined.
   * When omitted/false, keep the existing image if no new imageSrc is provided.
   */
  clearImage?: boolean;
}

export interface ChapterBatchOptions {
  /**
   * - before / after / end — insert relative to the active tab
   * - before-each-puzzle — one chapter page immediately before each puzzle document (in order)
   */
  position: 'before' | 'after' | 'end' | 'before-each-puzzle';
  referenceId?: string | null;
  /** Shared background image applied to every created page (page background) */
  sharedBackgroundImage?: string;
  /** When true, also place each entry image as a layout image block */
  placeImageAsBlock?: boolean;
  layoutSettings?: WordSearchSettings;
  /** Shared chapter layout + typography / frames (applies to all created pages) */
  chapterStyle?: Partial<ChapterPageStyleSettings> | null;
}

function resolveChapterStyle(options: ChapterBatchOptions) {
  return normalizeChapterPageStyle({
    ...options.chapterStyle,
    showImage:
      options.placeImageAsBlock === false
        ? false
        : (options.chapterStyle?.showImage ?? true),
  });
}

function applyEntryToChapterPage(
  page: DocumentPage,
  entry: ChapterBatchEntry,
  options: ChapterBatchOptions
): DocumentPage {
  const style = resolveChapterStyle(options);
  const settings = page.settings as TextModuleSettings;
  const title = entry.title.trim() || settings.title || 'Chapter';
  const existingSubtitle =
    settings.blocks?.find((b) => b.kind === 'subtitle')?.text?.trim() || undefined;
  const subtitle = entry.clearSubtitle
    ? undefined
    : entry.subtitle !== undefined
      ? entry.subtitle.trim() || undefined
      : existingSubtitle;
  const existingImage =
    settings.chapterImageSrc || settings.blocks?.find((b) => b.kind === 'image')?.imageSrc;
  const imageSrc = entry.clearImage
    ? undefined
    : entry.imageSrc !== undefined
      ? entry.imageSrc
      : existingImage;

  const layout = options.layoutSettings ?? getDefaultWordSearchSettings();
  const blocks = buildChapterBlocksFromStyle(
    {
      title,
      subtitle,
      imageSrc,
    },
    style,
    layout,
    settings.blocks
  );

  const nextSettings: TextModuleSettings = {
    ...settings,
    title,
    isChapterPage: true,
    chapterLayoutId: style.layoutId,
    textColor: style.titleColor,
    fontFamily: style.titleFontFamily,
    fontSize: style.subtitleFontSize,
    titleFontSize: style.titleFontSize,
    useCustomBackground: true,
    backgroundColor: style.pageBackgroundColor,
    chapterImageSrc: imageSrc,
    blocks,
  };

  if (options.sharedBackgroundImage) {
    nextSettings.backgroundImage = options.sharedBackgroundImage;
    nextSettings.backgroundImageFit = 'cover';
    nextSettings.backgroundImageOpacity = 100;
  }

  return {
    ...page,
    name: title,
    settings: nextSettings,
  };
}

function buildChapterPage(
  entry: ChapterBatchEntry,
  options: ChapterBatchOptions
): DocumentPage {
  const page = createDocumentPage('title-page');
  return applyEntryToChapterPage(page, entry, options);
}

/**
 * Update existing chapter pages in document order with new titles/images/style.
 * Does not insert new pages. Extra titles beyond chapter count are ignored.
 */
export function updateExistingChapterPages(
  documents: DocumentPage[],
  entries: ChapterBatchEntry[],
  options: Omit<ChapterBatchOptions, 'position' | 'referenceId'>
): { documentPages: DocumentPage[]; updatedCount: number; firstPageId: string | null } {
  const cleaned = entries
    .map((e) => ({
      title: e.title.trim(),
      subtitle: e.subtitle,
      clearSubtitle: e.clearSubtitle,
      imageSrc: e.imageSrc,
      clearImage: e.clearImage,
    }))
    .filter((e) => e.title.length > 0);

  if (cleaned.length === 0) {
    return { documentPages: documents, updatedCount: 0, firstPageId: null };
  }

  let entryIndex = 0;
  let updatedCount = 0;
  let firstPageId: string | null = null;
  const batchOptions: ChapterBatchOptions = {
    position: 'end',
    ...options,
  };

  const documentPages = documents.map((doc) => {
    if (!isChapterTitlePage(doc)) return doc;
    const entry = cleaned[entryIndex];
    entryIndex += 1;
    if (!entry) return doc;
    const updated = applyEntryToChapterPage(doc, entry, batchOptions);
    updatedCount += 1;
    if (!firstPageId) firstPageId = updated.id;
    return updated;
  });

  return { documentPages, updatedCount, firstPageId };
}

/**
 * Insert chapter title pages into the document tab list.
 * Returns the updated document list and the first new page id.
 */
export function buildBatchChapterPages(
  documents: DocumentPage[],
  entries: ChapterBatchEntry[],
  options: ChapterBatchOptions
): { documentPages: DocumentPage[]; firstNewPageId: string | null } {
  const cleaned = entries
    .map((e) => ({
      title: e.title.trim(),
      subtitle: e.subtitle,
      imageSrc: e.imageSrc,
    }))
    .filter((e) => e.title.length > 0);

  if (cleaned.length === 0) {
    return { documentPages: documents, firstNewPageId: null };
  }

  if (options.position === 'before-each-puzzle') {
    const puzzleIndices = documents
      .map((doc, index) => ({ doc, index }))
      .filter(({ doc }) => isPuzzleModuleType(doc.moduleType));

    if (puzzleIndices.length === 0) {
      // No puzzle docs — fall back to appending as a block
      const newPages = cleaned.map((entry) => buildChapterPage(entry, options));
      return {
        documentPages: [...documents, ...newPages],
        firstNewPageId: newPages[0]?.id ?? null,
      };
    }

    // One chapter before each puzzle, in document order. Extra titles append after last puzzle.
    const next: DocumentPage[] = [];
    let firstNewPageId: string | null = null;
    let puzzleOrdinal = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (isPuzzleModuleType(doc.moduleType)) {
        const entry =
          cleaned[puzzleOrdinal] ??
          ({
            title: `Chapter ${puzzleOrdinal + 1}: `,
            imageSrc: undefined,
          } satisfies ChapterBatchEntry);
        const chapter = buildChapterPage(entry, options);
        if (!firstNewPageId) firstNewPageId = chapter.id;
        next.push(chapter);
        next.push(doc);
        puzzleOrdinal += 1;
      } else {
        next.push(doc);
      }
    }

    // Extra chapter titles beyond puzzle count → append at end
    for (let i = puzzleOrdinal; i < cleaned.length; i++) {
      const chapter = buildChapterPage(cleaned[i], options);
      if (!firstNewPageId) firstNewPageId = chapter.id;
      next.push(chapter);
    }

    return { documentPages: next, firstNewPageId };
  }

  const newPages = cleaned.map((entry) => buildChapterPage(entry, options));
  const firstNewPageId = newPages[0]?.id ?? null;

  if (options.position === 'end' || !options.referenceId) {
    return {
      documentPages: [...documents, ...newPages],
      firstNewPageId,
    };
  }

  const idx = documents.findIndex((d) => d.id === options.referenceId);
  if (idx === -1) {
    return {
      documentPages: [...documents, ...newPages],
      firstNewPageId,
    };
  }

  const insertAt = options.position === 'before' ? idx : idx + 1;
  const next = [...documents];
  next.splice(insertAt, 0, ...newPages);
  return { documentPages: next, firstNewPageId };
}

/** Titles currently on existing chapter pages (document order). */
export function getExistingChapterTitleLines(documents: DocumentPage[]): string[] {
  return documents
    .filter((doc) => isChapterTitlePage(doc))
    .map((doc) => {
      const settings = doc.settings as TextModuleSettings;
      const blockTitle = settings.blocks?.find((b) => b.kind === 'title')?.text?.trim();
      return blockTitle || settings.title?.trim() || doc.name?.trim() || 'Chapter';
    });
}

/** Subtitles currently on existing chapter pages (document order). */
export function getExistingChapterSubtitleLines(documents: DocumentPage[]): string[] {
  return documents
    .filter((doc) => isChapterTitlePage(doc))
    .map((doc) => {
      const settings = doc.settings as TextModuleSettings;
      return settings.blocks?.find((b) => b.kind === 'subtitle')?.text?.trim() || '';
    });
}

/** Suggest chapter titles from existing puzzle document tabs. */
export function suggestChapterTitlesFromPuzzleDocuments(documents: DocumentPage[]): string[] {
  return documents
    .filter((doc) => isPuzzleModuleType(doc.moduleType))
    .map((doc, i) => {
      const name = doc.name?.trim();
      return name ? `Chapter ${i + 1}: ${name}` : `Chapter ${i + 1}: `;
    });
}

/** Default blank chapter title lines (one per puzzle, or 3 placeholders). */
export function defaultChapterTitleLines(puzzleCount: number): string[] {
  const count = Math.max(1, puzzleCount || 3);
  return Array.from({ length: count }, (_, i) => `Chapter ${i + 1}: `);
}
