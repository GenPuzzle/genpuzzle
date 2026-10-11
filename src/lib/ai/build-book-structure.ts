/**
 * Build a full GenPuzzle document tab order from a structured book plan.
 * Uses existing createDocumentPage / chapter layouts / TOC settings — no parallel model.
 */

import {
  createDocumentPage,
  PUZZLE_MODULES,
  type DocumentPage,
  type PuzzleModuleSettings,
  type PuzzleModuleType,
  type TextModuleSettings,
} from '@/lib/document-model';
import { createStyledChapterDocumentPage } from '@/lib/chapter-page-layouts';
import { createBlockId, createDefaultTitlePageBlocks, normalizeTextPageBlock } from '@/lib/text-page-blocks';
import { getDefaultWordSearchSettings } from '@/lib/puzzles/types';
import { DEFAULT_TOC_SETTINGS, normalizeTocSettings } from '@/lib/toc-settings';
import { isAiPuzzleType, getAiPuzzleTypeLabel } from './types';
import { normalizePuzzleTypeToken } from './puzzle-type-aliases';
import { fallbackIntroduction, fallbackInstructions } from './front-matter';
import type { AiProjectSetup } from './types';

export interface BookStructureSpec {
  bookTitle?: string;
  subtitle?: string;
  language?: string;
  chapterCount: number;
  chapterTitles?: string[];
  /** Puzzle document types placed once per chapter, in order. */
  puzzleTypesPerChapter: PuzzleModuleType[];
  /** How many puzzles inside each type document (default 1). */
  puzzlesPerTypeDocument?: number;
  includeTitlePage?: boolean;
  includeToc?: boolean;
  includeIntroduction?: boolean;
  includeInstructions?: boolean;
  introductionText?: string;
  instructionsText?: string;
  /** Replace the whole project document list (default true). */
  replaceExisting?: boolean;
}

function puzzleLabel(type: PuzzleModuleType): string {
  return PUZZLE_MODULES.find((m) => m.type === type)?.name ?? getAiPuzzleTypeLabel(type);
}

function applyFramedSectionHeader(
  page: DocumentPage,
  heading: string,
  body: string
): DocumentPage {
  const settings = page.settings as TextModuleSettings;
  settings.title = heading;
  settings.content = body;
  settings.alignment = 'left';
  settings.blocks = [
    normalizeTextPageBlock({
      id: createBlockId('title'),
      kind: 'title',
      text: heading,
      xPercent: 12,
      yPercent: 8,
      widthPercent: 76,
      heightPercent: 10,
      fontFamily: 'Arial',
      fontSize: 26,
      bold: true,
      alignment: 'center',
      textColor: '#ffffff',
      frameEnabled: true,
      frameShape: 'rounded',
      frameFillColor: '#111111',
      frameBorderColor: '#111111',
      frameBorderThicknessPx: 0,
      boxPaddingPx: 14,
    } as never),
    normalizeTextPageBlock({
      id: createBlockId('body'),
      kind: 'text',
      text: body,
      xPercent: 10,
      yPercent: 24,
      widthPercent: 80,
      heightPercent: 62,
      fontFamily: 'Arial',
      fontSize: 14,
      alignment: 'left',
      textColor: '#111111',
      boxPaddingPx: 4,
    }),
  ];
  page.name = heading;
  return page;
}

function buildTitlePage(title: string, subtitle: string): DocumentPage {
  const page = createDocumentPage('title-page');
  const settings = page.settings as TextModuleSettings;
  settings.title = title;
  settings.content = subtitle;
  settings.textColor = '#000000';
  settings.blocks = createDefaultTitlePageBlocks(
    'Title Page',
    settings,
    getDefaultWordSearchSettings()
  ).map((block) => {
    if (block.kind === 'title') return normalizeTextPageBlock({ ...block, text: title });
    if (block.kind === 'subtitle') return normalizeTextPageBlock({ ...block, text: subtitle });
    return block;
  });
  page.name = 'Title Page';
  return page;
}

function buildTocPage(chapterCount: number, puzzleTypes: PuzzleModuleType[]): DocumentPage {
  const page = createDocumentPage('table-of-contents');
  const settings = page.settings as TextModuleSettings;
  settings.title = 'Table of Contents';
  const chapters = Array.from({ length: chapterCount }, (_, i) => ({
    id: `chapter-${i + 1}`,
    title: `Chapter ${i + 1}`,
  }));
  settings.tocSettings = normalizeTocSettings({
    ...DEFAULT_TOC_SETTINGS,
    includePuzzlePages: true,
    includeSolutionPages: true,
    hideDocuments: false,
    hidePuzzleDocuments: false,
    chapterCount,
    chapters,
    entryScope: 'all',
    titleFontFamily: 'Arial',
    titleFontWeight: true,
    titleTextColor: '#ffffff',
  } as never);
  // Framed TOC title matching Introduction / Instructions
  settings.blocks = [
    normalizeTextPageBlock({
      id: createBlockId('toc-title'),
      kind: 'title',
      text: 'Table of Contents',
      xPercent: 12,
      yPercent: 6,
      widthPercent: 76,
      heightPercent: 9,
      fontFamily: 'Arial',
      fontSize: 26,
      bold: true,
      alignment: 'center',
      textColor: '#ffffff',
      frameEnabled: true,
      frameShape: 'rounded',
      frameFillColor: '#111111',
      frameBorderColor: '#111111',
      frameBorderThicknessPx: 0,
      boxPaddingPx: 14,
    } as never),
  ];
  // Keep puzzle type names discoverable in content for auto TOC helpers
  settings.content = puzzleTypes.map((t) => puzzleLabel(t)).join('\n');
  page.name = 'Table of Contents';
  return page;
}

function stampPuzzleDocument(
  type: PuzzleModuleType,
  chapterIndex: number,
  chapterNumber: number,
  puzzlesPerDoc: number
): DocumentPage {
  const page = createDocumentPage(type);
  const label = puzzleLabel(type);
  page.name = `${label} #${chapterNumber}`;
  const settings = page.settings as PuzzleModuleSettings;
  settings.chapterIndex = chapterIndex;

  if (settings.wordSearchSettings) {
    settings.wordSearchSettings = {
      ...settings.wordSearchSettings,
      core: {
        ...settings.wordSearchSettings.core,
        numberOfPuzzles: puzzlesPerDoc,
        puzzlesStartingNumber: 1,
      },
    };
  }
  if (settings.crosswordSettings) {
    settings.crosswordSettings = {
      ...settings.crosswordSettings,
      core: {
        ...settings.crosswordSettings.core,
        numberOfPuzzles: puzzlesPerDoc,
        puzzlesStartingNumber: 1,
      },
    };
  }
  if (settings.genericPuzzleSettings) {
    settings.genericPuzzleSettings = {
      ...settings.genericPuzzleSettings,
      core: {
        ...settings.genericPuzzleSettings.core,
        numberOfPuzzles: puzzlesPerDoc,
        puzzlesStartingNumber: 1,
      },
    };
  }
  return page;
}

export function normalizeBookStructureSpec(raw: unknown): BookStructureSpec {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const chapterCount = Math.max(1, Math.min(40, Math.round(Number(obj.chapterCount) || 1)));
  const types: PuzzleModuleType[] = [];
  if (Array.isArray(obj.puzzleTypesPerChapter)) {
    for (const item of obj.puzzleTypesPerChapter) {
      const fromString =
        typeof item === 'string'
          ? normalizePuzzleTypeToken(item) || (isAiPuzzleType(item) ? item : null)
          : null;
      const type = fromString;
      if (type && !types.includes(type)) types.push(type);
    }
  }
  const titles = Array.isArray(obj.chapterTitles)
    ? obj.chapterTitles.map((t) => String(t ?? '').trim()).filter(Boolean).slice(0, chapterCount)
    : [];
  return {
    bookTitle: typeof obj.bookTitle === 'string' ? obj.bookTitle.trim() : undefined,
    subtitle: typeof obj.subtitle === 'string' ? obj.subtitle.trim() : undefined,
    language: typeof obj.language === 'string' ? obj.language.trim() : undefined,
    chapterCount,
    chapterTitles: titles,
    puzzleTypesPerChapter: types,
    puzzlesPerTypeDocument: Math.max(
      1,
      Math.min(50, Math.round(Number(obj.puzzlesPerTypeDocument) || 1))
    ),
    includeTitlePage: obj.includeTitlePage !== false,
    includeToc: obj.includeToc !== false,
    includeIntroduction: obj.includeIntroduction !== false,
    includeInstructions: obj.includeInstructions !== false,
    introductionText: typeof obj.introductionText === 'string' ? obj.introductionText : undefined,
    instructionsText: typeof obj.instructionsText === 'string' ? obj.instructionsText : undefined,
    replaceExisting: obj.replaceExisting !== false,
  };
}

export function buildBookStructurePages(specInput: BookStructureSpec): {
  pages: DocumentPage[];
  chapterTitles: string[];
  summary: string;
} {
  const spec = normalizeBookStructureSpec(specInput);
  const title = spec.bookTitle || 'Puzzle Book';
  const subtitle = spec.subtitle || 'Puzzles & Games';
  const chapterTitles =
    spec.chapterTitles && spec.chapterTitles.length > 0
      ? Array.from({ length: spec.chapterCount }, (_, i) => spec.chapterTitles![i] || `Chapter ${i + 1}`)
      : Array.from({ length: spec.chapterCount }, (_, i) => `Chapter ${i + 1}`);
  const types = spec.puzzleTypesPerChapter;
  const perDoc = spec.puzzlesPerTypeDocument ?? 1;

  const pages: DocumentPage[] = [];
  if (spec.includeTitlePage !== false) {
    pages.push(buildTitlePage(title, subtitle));
  }
  if (spec.includeToc !== false) {
    pages.push(buildTocPage(spec.chapterCount, types));
  }

  const setupLike = {
    bookTitle: title,
    subtitle,
    description: subtitle,
    language: spec.language || 'English',
    audience: 'adults' as const,
    puzzleTypes: types.map((type) => ({ type, count: perDoc, difficultyStrategy: 'medium' as const })),
  } satisfies Pick<
    AiProjectSetup,
    'bookTitle' | 'subtitle' | 'description' | 'language' | 'audience' | 'puzzleTypes'
  >;

  if (spec.includeIntroduction !== false) {
    const intro = createDocumentPage('introduction');
    pages.push(
      applyFramedSectionHeader(
        intro,
        'Introduction',
        spec.introductionText?.trim() || fallbackIntroduction(setupLike as AiProjectSetup)
      )
    );
  }
  if (spec.includeInstructions !== false) {
    const instructions = createDocumentPage('instructions');
    pages.push(
      applyFramedSectionHeader(
        instructions,
        'Instructions',
        spec.instructionsText?.trim() || fallbackInstructions(setupLike as AiProjectSetup)
      )
    );
  }

  for (let c = 0; c < spec.chapterCount; c += 1) {
    const chapterTitle = chapterTitles[c] || `Chapter ${c + 1}`;
    const chapterPage = createStyledChapterDocumentPage(chapterTitle, {
      subtitleEnabled: true,
      subtitleText: `Chapter ${c + 1}`,
    });
    const chapterSettings = chapterPage.settings as TextModuleSettings;
    chapterSettings.isChapterPage = true;
    chapterSettings.chapterIndex = c;
    chapterSettings.title = chapterTitle;
    chapterPage.name = chapterTitle;
    pages.push(chapterPage);

    for (const type of types) {
      pages.push(stampPuzzleDocument(type, c, c + 1, perDoc));
    }
  }

  const summary = [
    `Title page + TOC + Introduction + Instructions`,
    `${spec.chapterCount} chapter(s)`,
    types.length
      ? `Per chapter: ${types.map(puzzleLabel).join(', ')}`
      : 'No puzzle types yet',
    `${pages.length} document tabs total`,
  ].join(' · ');

  return { pages, chapterTitles, summary };
}
