/**
 * Registry of GenPuzzle sidebar platform settings the AI agent can read/write.
 * Categories map to UI tabs: Trim, Style, Chapters, Puzzle, Words, Titles.
 */

export type PlatformCategory =
  | 'trim'
  | 'style'
  | 'chapters'
  | 'puzzle'
  | 'words'
  | 'titles';

export type PlatformValueType = 'number' | 'boolean' | 'string' | 'string[]' | 'enum';

export interface PlatformSettingDef {
  category: PlatformCategory;
  name: string;
  label: string;
  type: PlatformValueType;
  /** Internal sidebar tab value (book / colors / pages / puzzle / words / design). */
  tab: 'book' | 'colors' | 'pages' | 'puzzle' | 'words' | 'design';
  panel: 'layout' | 'document';
  description?: string;
  min?: number;
  max?: number;
  enumValues?: string[];
  /** When true, prefer updateWordSearchSettings path that syncs layout across docs. */
  layoutSync?: boolean;
}

/** User-facing category → persisted sidebar tab. */
export const PLATFORM_CATEGORY_TAB: Record<
  PlatformCategory,
  { tab: PlatformSettingDef['tab']; panel: PlatformSettingDef['panel']; title: string }
> = {
  trim: { tab: 'book', panel: 'layout', title: 'Trim' },
  style: { tab: 'colors', panel: 'layout', title: 'Style' },
  chapters: { tab: 'pages', panel: 'layout', title: 'Chapters' },
  puzzle: { tab: 'puzzle', panel: 'document', title: 'Puzzle' },
  words: { tab: 'words', panel: 'document', title: 'Words' },
  titles: { tab: 'design', panel: 'document', title: 'Titles' },
};

export const PLATFORM_SETTINGS: PlatformSettingDef[] = [
  // —— Trim ——
  {
    category: 'trim',
    name: 'trimSizePreset',
    label: 'Trim size preset',
    type: 'enum',
    tab: 'book',
    panel: 'layout',
    layoutSync: true,
    enumValues: [
      '5X8IN',
      '5_5X8_5IN',
      '6X9IN',
      '7X10IN',
      '8X10IN',
      '8_5X11IN',
      '8_27X11_69IN',
    ],
    description: 'Page trim size preset id.',
  },
  {
    category: 'trim',
    name: 'includeBleed',
    label: 'Include bleed',
    type: 'boolean',
    tab: 'book',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'trim',
    name: 'pageMargin',
    label: 'Page margin',
    type: 'number',
    tab: 'book',
    panel: 'layout',
    min: 0,
    max: 120,
    description: 'Outer page margin in points/px scale used by the canvas.',
  },
  {
    category: 'trim',
    name: 'puzzleGridScale',
    label: 'Puzzle grid scale',
    type: 'number',
    tab: 'book',
    panel: 'layout',
    min: 20,
    max: 200,
    description: 'Percent scale of the puzzle grid on the page.',
  },
  {
    category: 'trim',
    name: 'answersPerPage',
    label: 'Solutions per page',
    type: 'number',
    tab: 'book',
    panel: 'layout',
    min: 1,
    max: 4,
    layoutSync: true,
  },

  // —— Style ——
  {
    category: 'style',
    name: 'backgroundColor',
    label: 'Puzzle page background',
    type: 'string',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'titleColor',
    label: 'Title color',
    type: 'string',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'gridLetterColor',
    label: 'Grid letter color',
    type: 'string',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'wordListColor',
    label: 'Word list color',
    type: 'string',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'pageFrameEnabled',
    label: 'Page frame',
    type: 'boolean',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'pageNumberEnabled',
    label: 'Page numbers',
    type: 'boolean',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
  },
  {
    category: 'style',
    name: 'pageNumberPosition',
    label: 'Page number position',
    type: 'enum',
    tab: 'colors',
    panel: 'layout',
    layoutSync: true,
    enumValues: ['bottom-center', 'bottom-left', 'bottom-right', 'alternating'],
  },

  // —— Chapters ——
  {
    category: 'chapters',
    name: 'mixPuzzles',
    label: 'Mix puzzles by chapter',
    type: 'boolean',
    tab: 'pages',
    panel: 'layout',
  },
  {
    category: 'chapters',
    name: 'chapterTopics',
    label: 'Chapter topics / titles',
    type: 'string[]',
    tab: 'pages',
    panel: 'layout',
    description: 'One title per chapter (newline or array).',
  },

  // —— Puzzle ——
  {
    category: 'puzzle',
    name: 'numberOfPuzzles',
    label: 'Number of puzzles',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 1,
    max: 200,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'puzzlesStartingNumber',
    label: 'Starting number',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 0,
    max: 9999,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'twoPagePuzzles',
    label: 'Two-page puzzles',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'lettersAcross',
    label: 'Letters across',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 5,
    max: 40,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'lettersDown',
    label: 'Letters down',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 5,
    max: 40,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowUp',
    label: 'Allow up',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowDown',
    label: 'Allow down',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowLeft',
    label: 'Allow left',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowRight',
    label: 'Allow right',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowDiagonalUp',
    label: 'Diagonal up',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowDiagonalDown',
    label: 'Diagonal down',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowDiagonalUpReverse',
    label: 'Diagonal up reverse',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'allowDiagonalDownReverse',
    label: 'Diagonal down reverse',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'noBoxAroundPuzzle',
    label: 'No box around puzzle',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'addGridLines',
    label: 'Add grid lines',
    type: 'boolean',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'borderStrokeThickness',
    label: 'Border thickness',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 0,
    max: 20,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'borderCornerRadius',
    label: 'Border corner radius',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 0,
    max: 40,
    layoutSync: true,
  },
  {
    category: 'puzzle',
    name: 'gridBorderPadding',
    label: 'Grid border padding',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 0,
    max: 40,
    layoutSync: true,
  },

  // —— Words ——
  {
    category: 'words',
    name: 'words',
    label: 'Word list',
    type: 'string[]',
    tab: 'words',
    panel: 'document',
    description: 'Manual word list (array or newline-separated string).',
  },
  {
    category: 'words',
    name: 'wordsPerPuzzle',
    label: 'Words per puzzle',
    type: 'number',
    tab: 'words',
    panel: 'document',
    min: 1,
    max: 80,
    layoutSync: true,
  },
  {
    category: 'words',
    name: 'wordListFontSize',
    label: 'Word list font size',
    type: 'number',
    tab: 'words',
    panel: 'document',
    min: 8,
    max: 48,
    layoutSync: true,
  },
  {
    category: 'words',
    name: 'wordListFontFamily',
    label: 'Word list font',
    type: 'string',
    tab: 'words',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'words',
    name: 'wordListColumns',
    label: 'Word list columns',
    type: 'number',
    tab: 'words',
    panel: 'document',
    min: 1,
    max: 4,
    layoutSync: true,
    description: 'Number of columns for the find-list (1–4).',
  },
  {
    category: 'words',
    name: 'includeFunFacts',
    label: 'Include fun facts',
    type: 'boolean',
    tab: 'words',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'words',
    name: 'funFactsText',
    label: 'Fun facts text',
    type: 'string',
    tab: 'words',
    panel: 'document',
    layoutSync: true,
    description: 'One fun fact per line (feeds canvas [fun fact] variables).',
  },

  // —— Titles ——
  {
    category: 'titles',
    name: 'selectTitleOption',
    label: 'Title mode',
    type: 'enum',
    tab: 'design',
    panel: 'document',
    layoutSync: true,
    enumValues: ['puzzle-number', 'one-custom-title', 'custom', 'none'],
  },
  {
    category: 'titles',
    name: 'titleText',
    label: 'Title text',
    type: 'string',
    tab: 'design',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'puzzleTitleFontSize',
    label: 'Title font size',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 8,
    max: 72,
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'puzzleTitleFontFamily',
    label: 'Title font',
    type: 'string',
    tab: 'design',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'puzzleTitleBold',
    label: 'Title bold',
    type: 'boolean',
    tab: 'design',
    panel: 'document',
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'subtitleFontSize',
    label: 'Subtitle / fun fact font size',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 8,
    max: 48,
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'spaceBetweenTitleAndPuzzle',
    label: 'Space between title and puzzle',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 0,
    max: 120,
    layoutSync: true,
  },
  {
    category: 'titles',
    name: 'subtitleToTitleGap',
    label: 'Space between title and fun fact',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 0,
    max: 120,
    layoutSync: true,
    description: 'Gap between the puzzle title and the fun-fact / subtitle.',
  },
  {
    category: 'titles',
    name: 'subtitleToPuzzleGap',
    label: 'Space between fun fact and puzzle',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 0,
    max: 120,
    layoutSync: true,
    description: 'Gap between the fun-fact / subtitle and the puzzle grid.',
  },
  {
    category: 'titles',
    name: 'puzzleGridFontSize',
    label: 'Grid letter font size',
    type: 'number',
    tab: 'puzzle',
    panel: 'document',
    min: 0,
    max: 50,
    layoutSync: true,
    description:
      'Font size of letters inside the Word Search grid (canvas Grid Letters / Puzzle tab).',
  },
  {
    category: 'titles',
    name: 'puzzleGridFontFamily',
    label: 'Grid letter font',
    type: 'string',
    tab: 'puzzle',
    panel: 'document',
    layoutSync: true,
    description: 'Font family of letters inside the Word Search grid.',
  },
  {
    category: 'titles',
    name: 'titleStartAt',
    label: 'Title start from top',
    type: 'number',
    tab: 'design',
    panel: 'document',
    min: 0,
    max: 200,
    layoutSync: true,
  },
];

export function listPlatformSettings(categories?: PlatformCategory[]): PlatformSettingDef[] {
  if (!categories?.length) return PLATFORM_SETTINGS;
  const set = new Set(categories);
  return PLATFORM_SETTINGS.filter((d) => set.has(d.category));
}

export function findPlatformSetting(
  category: string,
  name: string
): PlatformSettingDef | undefined {
  const cat = category.trim().toLowerCase() as PlatformCategory;
  const key = name.trim();
  return PLATFORM_SETTINGS.find(
    (d) =>
      d.category === cat &&
      (d.name === key || d.name.toLowerCase() === key.toLowerCase() || d.label.toLowerCase() === key.toLowerCase())
  );
}

export function normalizePlatformCategory(raw: string): PlatformCategory | null {
  const v = raw.trim().toLowerCase();
  const aliases: Record<string, PlatformCategory> = {
    trim: 'trim',
    book: 'trim',
    size: 'trim',
    margins: 'trim',
    style: 'style',
    colors: 'style',
    colour: 'style',
    frame: 'style',
    chapters: 'chapters',
    pages: 'chapters',
    puzzle: 'puzzle',
    grid: 'puzzle',
    words: 'words',
    wordlist: 'words',
    titles: 'titles',
    title: 'titles',
    design: 'titles',
    typography: 'titles',
  };
  return aliases[v] ?? null;
}

export const AGENT_PLATFORM_UI_EVENT = 'genpuzzle-agent-platform-ui';

export type AgentPlatformUiDetail =
  | {
      type: 'switch_tab';
      category: PlatformCategory;
      tab: PlatformSettingDef['tab'];
      panel: PlatformSettingDef['panel'];
    }
  | {
      type: 'highlight_setting';
      category: PlatformCategory;
      settingName: string;
      durationMs?: number;
    };

export function dispatchAgentPlatformUi(detail: AgentPlatformUiDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AGENT_PLATFORM_UI_EVENT, { detail }));
}
