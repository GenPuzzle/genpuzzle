import {
  createDocumentPage,
  isPuzzleModuleType,
  PUZZLE_MODULES,
  type DocumentPage,
  type TextModuleSettings,
} from '@/lib/document-model';
import { buildBatchChapterPages } from '@/lib/batch-chapter-pages';
import { createDefaultTitlePageBlocks, normalizeTextPageBlock } from '@/lib/text-page-blocks';
import { getDefaultWordSearchSettings } from '@/lib/puzzles/types';
import { parseAiThemeTitles, getAiChapterTopics, isAiByChapter } from './types';
import type { AiFrontMatterCopy, AiProjectSetup } from './types';

function audiencePhrase(setup: AiProjectSetup): string {
  if (setup.audience === 'custom') {
    return setup.customAudience?.trim() || 'a general audience';
  }
  return setup.audience;
}

export function fallbackIntroduction(setup: AiProjectSetup): string {
  const title = setup.bookTitle.trim() || 'this puzzle book';
  const topic = setup.description.trim();
  const parts = [
    `Welcome to ${title}${setup.subtitle.trim() ? `: ${setup.subtitle.trim()}` : ''}.`,
  ];
  if (topic) parts.push(topic);
  parts.push(
    `These puzzles are written for ${audiencePhrase(setup)}. Take your time, enjoy each page, and use the solutions when you want a hint.`
  );
  return parts.join('\n\n');
}

export function fallbackInstructions(setup: AiProjectSetup): string {
  const labels = setup.puzzleTypes.map((t) => {
    const name = PUZZLE_MODULES.find((m) => m.type === t.type)?.name ?? t.type;
    switch (t.type) {
      case 'word-search':
        return `${name}: Find every listed word in the letter grid. Words may run in any allowed direction.`;
      case 'crossword':
        return `${name}: Fill the grid using the clues. Each answer matches one clue.`;
      case 'sudoku':
        return `${name}: Fill the grid so every row, column, and box contains each number once.`;
      case 'maze':
        return `${name}: Draw a path from start to finish without crossing walls.`;
      case 'cryptogram':
        return `${name}: Each letter stands for another letter. Decode the phrase.`;
      case 'word-scramble':
        return `${name}: Unscramble the letters to form the original word or phrase.`;
      case 'trivia':
        return `${name}: Choose the best answer for each question.`;
      case 'murdoku':
        return `${name}: Use the clues to place each person. Each person appears once per row and column. Identify who was alone with the victim.`;
      default:
        return `${name}: Complete each puzzle, then check the solutions section.`;
    }
  });
  return [
    'Work through the book in any order you like.',
    ...labels,
    'Solutions are at the back of the book. Try the puzzle first, then check your answers.',
  ].join('\n\n');
}

function buildTitlePage(setup: AiProjectSetup): DocumentPage {
  const page = createDocumentPage('title-page');
  const settings = page.settings as TextModuleSettings;
  const title = setup.bookTitle.trim() || 'Book Title';
  const subtitle = setup.subtitle.trim() || 'Puzzles & Games';
  settings.title = title;
  settings.content = subtitle;
  settings.titleFontSize = 40;
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

function buildTextFrontMatterPage(
  type: 'introduction' | 'instructions',
  heading: string,
  body: string
): DocumentPage {
  const page = createDocumentPage(type);
  const settings = page.settings as TextModuleSettings;
  settings.title = heading;
  settings.content = body.trim();
  settings.alignment = 'left';
  page.name = heading;
  return page;
}

function resolveChapterTitles(setup: AiProjectSetup, puzzlePages: DocumentPage[]): string[] {
  const fm = setup.frontMatter;
  if (!fm?.includeChapterPages) return [];
  if (isAiByChapter(setup)) {
    return getAiChapterTopics(setup);
  }
  if (fm.useCustomChapterTitles) {
    return parseAiThemeTitles(fm.chapterTitles);
  }
  return puzzlePages
    .filter((page) => isPuzzleModuleType(page.moduleType))
    .map(
      (page) =>
        PUZZLE_MODULES.find((item) => item.type === page.moduleType)?.name ?? 'Chapter'
    );
}

/**
 * Prepend selected front-matter pages and optionally insert chapter title pages
 * before each puzzle document (or as thematic chapter dividers for mixed books).
 */
export function attachAiFrontMatter(
  puzzlePages: DocumentPage[],
  setup: AiProjectSetup,
  copy: AiFrontMatterCopy
): DocumentPage[] {
  const fm = setup.frontMatter;
  if (!fm) return puzzlePages;

  let pages = puzzlePages;
  const chapterTitles = resolveChapterTitles(setup, puzzlePages);
  const byChapter = isAiByChapter(setup);
  if (chapterTitles.length > 0) {
    const built = buildBatchChapterPages(
      byChapter ? [] : pages,
      chapterTitles.map((title) => ({ title })),
      { position: byChapter ? 'end' : 'before-each-puzzle' }
    );
    if (byChapter) {
      const stamped = built.documentPages.map((page, i) => {
        const settings = page.settings as TextModuleSettings;
        return {
          ...page,
          settings: {
            ...settings,
            isChapterPage: true,
            chapterIndex: i,
          },
        };
      });
      pages = [...stamped, ...puzzlePages];
    } else {
      pages = built.documentPages;
    }
  }

  const front: DocumentPage[] = [];
  if (fm.includeTitlePage) front.push(buildTitlePage(setup));
  if (fm.includeTableOfContents) front.push(createDocumentPage('table-of-contents'));
  if (fm.includeIntroduction) {
    front.push(
      buildTextFrontMatterPage(
        'introduction',
        'Introduction',
        copy.introduction?.trim() || fallbackIntroduction(setup)
      )
    );
  }
  if (fm.includeInstructions) {
    front.push(
      buildTextFrontMatterPage(
        'instructions',
        'Instructions',
        copy.instructions?.trim() || fallbackInstructions(setup)
      )
    );
  }

  return front.length > 0 ? [...front, ...pages] : pages;
}
