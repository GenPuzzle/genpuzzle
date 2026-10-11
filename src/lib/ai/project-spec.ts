/**
 * Structured project specification produced by the AI planner.
 * Always validated before applying through existing GenPuzzle systems.
 */

import type { PuzzleModuleType } from '@/lib/document-model';
import {
  AI_SUPPORTED_PUZZLE_TYPES,
  defaultAiFrontMatter,
  getAiPuzzleTypeLabel,
  isAiPuzzleType,
  type AiProjectSetup,
  type AiPuzzleTypeConfig,
} from './types';
import { defaultAiTypeConfig, validateAiSetup } from './setup-helpers';
import { parsePuzzleTypesFromText, PUZZLE_TYPE_ALIASES } from './puzzle-type-aliases';

export type AiFunFactPosition = 'below_title' | 'above_title' | 'page_footer';

export interface AiProjectSpecPuzzleType {
  type: PuzzleModuleType;
  countPerChapter: number;
  generateFunFacts?: boolean;
}

export interface AiProjectSpec {
  theme: string;
  bookTitle?: string;
  language?: string;
  audience?: AiProjectSetup['audience'];
  chapters: {
    count: number;
    generateTitles: boolean;
    titles?: string[];
  };
  puzzleTypes: AiProjectSpecPuzzleType[];
  solutions: {
    perPage: number;
  };
  typography: {
    minimumFontSize: number;
  };
  funFacts: {
    enabled: boolean;
    onePerPuzzle: boolean;
    position: AiFunFactPosition;
  };
  organization: 'by-chapter' | 'by-type';
  avoidDuplicateWords?: boolean;
  startPuzzleNumber?: number;
}

export interface AiProjectPlanSummary {
  theme: string;
  bookTitle: string;
  chapters: number;
  chapterTitles: string[];
  puzzleTypes: Array<{ type: PuzzleModuleType; label: string; countPerChapter: number; total: number }>;
  totalPuzzles: number;
  solutionsPerPage: number;
  minimumFontSize: number;
  funFacts: AiProjectSpec['funFacts'];
  organization: AiProjectSpec['organization'];
  language: string;
  warnings: string[];
}

const TYPE_ALIASES = PUZZLE_TYPE_ALIASES;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function emptyAiProjectSpec(theme = ''): AiProjectSpec {
  return {
    theme,
    bookTitle: theme ? `${theme} Puzzle Book` : 'Puzzle Book',
    language: 'English',
    audience: 'adults',
    chapters: { count: 1, generateTitles: false, titles: [] },
    puzzleTypes: [],
    solutions: { perPage: 4 },
    typography: { minimumFontSize: 12 },
    funFacts: { enabled: false, onePerPuzzle: false, position: 'below_title' },
    organization: 'by-type',
    avoidDuplicateWords: true,
    startPuzzleNumber: 1,
  };
}

export function normalizeAiProjectSpec(raw: unknown): AiProjectSpec {
  const base = emptyAiProjectSpec();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;

  const chaptersRaw = (obj.chapters && typeof obj.chapters === 'object'
    ? obj.chapters
    : {}) as Record<string, unknown>;
  const solutionsRaw = (obj.solutions && typeof obj.solutions === 'object'
    ? obj.solutions
    : {}) as Record<string, unknown>;
  const typographyRaw = (obj.typography && typeof obj.typography === 'object'
    ? obj.typography
    : {}) as Record<string, unknown>;
  const funFactsRaw = (obj.funFacts && typeof obj.funFacts === 'object'
    ? obj.funFacts
    : {}) as Record<string, unknown>;

  const puzzleTypes: AiProjectSpecPuzzleType[] = [];
  if (Array.isArray(obj.puzzleTypes)) {
    for (const item of obj.puzzleTypes) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (!isAiPuzzleType(row.type)) continue;
      puzzleTypes.push({
        type: row.type,
        countPerChapter: clampInt(row.countPerChapter ?? row.count, 1, 200, 10),
        generateFunFacts: row.generateFunFacts === true || funFactsRaw.enabled === true,
      });
    }
  }

  const chapterCount = clampInt(chaptersRaw.count, 1, 40, 1);
  const titles = Array.isArray(chaptersRaw.titles)
    ? chaptersRaw.titles.map((t) => asString(t)).filter(Boolean).slice(0, chapterCount)
    : [];

  const position =
    funFactsRaw.position === 'above_title' || funFactsRaw.position === 'page_footer'
      ? funFactsRaw.position
      : 'below_title';

  return {
    theme: asString(obj.theme) || base.theme,
    bookTitle: asString(obj.bookTitle) || undefined,
    language: asString(obj.language, 'English') || 'English',
    audience:
      obj.audience === 'kids' ||
      obj.audience === 'teens' ||
      obj.audience === 'seniors' ||
      obj.audience === 'custom' ||
      obj.audience === 'adults'
        ? obj.audience
        : 'adults',
    chapters: {
      count: chapterCount,
      generateTitles: chaptersRaw.generateTitles !== false && chapterCount > 1,
      titles,
    },
    puzzleTypes,
    solutions: {
      perPage: clampInt(solutionsRaw.perPage, 1, 9, 4),
    },
    typography: {
      minimumFontSize: clampInt(typographyRaw.minimumFontSize, 8, 48, 12),
    },
    funFacts: {
      enabled: funFactsRaw.enabled === true,
      onePerPuzzle: funFactsRaw.onePerPuzzle !== false,
      position,
    },
    organization:
      obj.organization === 'by-chapter' || chapterCount > 1 ? 'by-chapter' : 'by-type',
    avoidDuplicateWords: obj.avoidDuplicateWords !== false,
    startPuzzleNumber: clampInt(obj.startPuzzleNumber, 1, 9999, 1),
  };
}

export function validateAiProjectSpec(spec: AiProjectSpec): string | null {
  if (!spec.theme.trim() && !spec.bookTitle?.trim()) {
    return 'Please include a theme or book title.';
  }
  if (!spec.puzzleTypes.length) {
    return 'Select at least one puzzle type.';
  }
  for (const pt of spec.puzzleTypes) {
    if (!AI_SUPPORTED_PUZZLE_TYPES.includes(pt.type)) {
      return `Unsupported puzzle type: ${pt.type}`;
    }
    if (pt.countPerChapter < 1 || pt.countPerChapter > 200) {
      return 'Puzzle count per chapter must be between 1 and 200.';
    }
  }
  const chapters = Math.max(1, spec.chapters.count);
  for (const pt of spec.puzzleTypes) {
    const total = pt.countPerChapter * chapters;
    if (total > 200) {
      return `Maximum 200 ${getAiPuzzleTypeLabel(pt.type)} puzzles (${pt.countPerChapter} × ${chapters} = ${total}).`;
    }
  }
  return null;
}

export function summarizeAiProjectSpec(spec: AiProjectSpec): AiProjectPlanSummary {
  const chapters = Math.max(1, spec.chapters.count);
  const theme = spec.theme.trim() || 'Puzzle';
  const bookTitle = (spec.bookTitle || `${theme} Puzzle Book`).trim();
  const chapterTitles =
    spec.chapters.titles && spec.chapters.titles.length > 0
      ? spec.chapters.titles.slice(0, chapters)
      : Array.from({ length: chapters }, (_, i) => `Chapter ${i + 1}`);

  const puzzleTypes = spec.puzzleTypes.map((pt) => ({
    type: pt.type,
    label: getAiPuzzleTypeLabel(pt.type),
    countPerChapter: pt.countPerChapter,
    total: pt.countPerChapter * chapters,
  }));
  const totalPuzzles = puzzleTypes.reduce((sum, row) => sum + row.total, 0);
  const warnings: string[] = [];
  if (totalPuzzles > 120) {
    warnings.push('Large book — generation may take several minutes.');
  }
  if (spec.funFacts.enabled && !spec.puzzleTypes.some((p) => p.type === 'word-search' || p.generateFunFacts)) {
    warnings.push('Fun facts will be enabled on supported puzzle types.');
  }

  return {
    theme,
    bookTitle,
    chapters,
    chapterTitles,
    puzzleTypes,
    totalPuzzles,
    solutionsPerPage: spec.solutions.perPage,
    minimumFontSize: spec.typography.minimumFontSize,
    funFacts: spec.funFacts,
    organization: spec.organization,
    language: spec.language || 'English',
    warnings,
  };
}

export function aiProjectSpecToSetup(spec: AiProjectSpec): AiProjectSetup {
  const summary = summarizeAiProjectSpec(spec);
  const chapters = summary.chapters;
  const byChapter = chapters > 1 || spec.organization === 'by-chapter';

  const puzzleTypes: AiPuzzleTypeConfig[] = spec.puzzleTypes.map((pt) => {
    const cfg = defaultAiTypeConfig(pt.type);
    cfg.count = pt.countPerChapter;
    if (pt.type === 'word-search' || pt.type === 'word-scramble') {
      cfg.avoidDuplicateWords = spec.avoidDuplicateWords !== false;
      cfg.generateFunFacts = spec.funFacts.enabled || pt.generateFunFacts === true;
    } else if (spec.funFacts.enabled) {
      cfg.generateFunFacts = true;
    }
    return cfg;
  });

  const chapterTopics = byChapter
    ? (spec.chapters.titles && spec.chapters.titles.length > 0
        ? spec.chapters.titles
        : summary.chapterTitles
      ).join('\n')
    : undefined;

  const frontMatter = defaultAiFrontMatter();
  if (byChapter) {
    frontMatter.includeChapterPages = true;
    frontMatter.useCustomChapterTitles = true;
    frontMatter.chapterTitles = chapterTopics || '';
  }

  return {
    bookTitle: summary.bookTitle,
    subtitle: summary.theme,
    description: summary.theme,
    language: summary.language,
    audience: spec.audience || 'adults',
    puzzleTypes,
    frontMatter,
    organization: byChapter ? 'by-chapter' : 'by-type',
    chapterTopics,
    solutionsPerPage: spec.solutions.perPage,
    minimumFontSize: spec.typography.minimumFontSize,
    funFactsPosition: spec.funFacts.position,
    ensureFunFactPageVariable: spec.funFacts.enabled,
    startPuzzleNumber: spec.startPuzzleNumber,
  };
}

export function validateSetupFromSpec(spec: AiProjectSpec): string | null {
  const specError = validateAiProjectSpec(spec);
  if (specError) return specError;
  return validateAiSetup(aiProjectSpecToSetup(spec));
}

/**
 * Deterministic NL → spec parser for common book requests.
 * Used for tests and as a fallback / seed before DeepSeek refinement.
 */
export function parseProjectPromptHeuristic(prompt: string): AiProjectSpec {
  const text = prompt.normalize('NFC');
  const lower = text.toLowerCase();
  const spec = emptyAiProjectSpec();

  const chapterMatch =
    lower.match(/(\d+)\s+chapters?/) ||
    lower.match(/chapters?\s*[:=]?\s*(\d+)/) ||
    lower.match(/with\s+(\d+)\s+chapter/);
  const chapterCount = chapterMatch ? clampInt(chapterMatch[1], 1, 40, 1) : 1;
  spec.chapters.count = chapterCount;
  spec.chapters.generateTitles = chapterCount > 1;
  spec.organization = chapterCount > 1 ? 'by-chapter' : 'by-type';

  const themeMatch =
    text.match(/(?:sea|ocean|beach|space|animals?|christmas|halloween|sports?|food|nature|travel|history|science)[a-z]*/i) ||
    text.match(/make\s+(?:a|an)\s+([a-z][\w\s-]{1,40}?)\s+puzzle/i) ||
    text.match(/theme[:\s]+([^\n,.]+)/i);
  if (themeMatch) {
    const raw = (themeMatch[1] || themeMatch[0] || '').trim();
    spec.theme = raw.replace(/\b(book|puzzle|puzzles)\b/gi, '').trim() || raw;
    // Capitalize first letter
    spec.theme = spec.theme.charAt(0).toUpperCase() + spec.theme.slice(1);
  }
  if (/sea|ocean|marine|underwater|beach/i.test(text) && !spec.theme) {
    spec.theme = 'Sea';
  }
  spec.bookTitle = `${spec.theme || 'Puzzle'} Puzzle Book`;

  const perTypeCounts = new Map<PuzzleModuleType, number>();
  // Discover types via shared alias table (includes binairo / biniro, etc.)
  for (const type of parsePuzzleTypesFromText(text)) {
    perTypeCounts.set(type, 10);
  }

  const hasPerChapterLanguage =
    /\bper\s+chapter\b/.test(lower) ||
    /\bin\s+each\s+chapter\b/.test(lower) ||
    /\bon\s+every\s+chapter\b/.test(lower) ||
    /\bto\s+every\s+chapter\b/.test(lower) ||
    /\bfor\s+every\s+chapter\b/.test(lower);

  const ofEachMatch = lower.match(/(\d+)\s+(?:puzzles?\s+)?of\s+each(?:\s+type)?/);
  /** "4 of each type" with chapters usually means per chapter; bare "20 Word Search" is a book total. */
  const countsArePerChapter = hasPerChapterLanguage || Boolean(ofEachMatch);

  for (const alias of TYPE_ALIASES) {
    if (!alias.pattern.test(text)) continue;
    let count = perTypeCounts.get(alias.type) ?? 10;
    const ofEach = ofEachMatch;
    const typedCount = text.match(
      new RegExp(`(\\d+)\\s+(?:${alias.pattern.source.replace(/^\\b/, '').replace(/\\b$/, '')})`, 'i')
    );
    const perChapter = lower.match(/(\d+)\s+(?:\w+\s+){0,3}per\s+chapter/);
    if (ofEach) count = clampInt(ofEach[1], 1, 200, 10);
    else if (typedCount) count = clampInt(typedCount[1], 1, 200, 10);
    else if (perChapter) count = clampInt(perChapter[1], 1, 200, 10);
    const eachType = lower.match(/(\d+)\s+puzzles?\s+of\s+each\s+type/);
    if (eachType) count = clampInt(eachType[1], 1, 200, 10);
    perTypeCounts.set(alias.type, count);
  }

  // "10 Word Search, 10 Crossword and 10 Maze / Binairo / …"
  const listed = [
    ...text.matchAll(
      /(\d+)\s+(word[\s-]?search|crossword|maze|sudoku|cryptogram|word[\s-]?scramble|trivia|murdoku|codewords?|binairo|biniro|binario|kakuro|math[\s-]?maze|fill|snake)/gi
    ),
  ];
  for (const m of listed) {
    const count = clampInt(m[1], 1, 200, 10);
    const label = m[2].toLowerCase().replace(/\s+/g, '-');
    const found = TYPE_ALIASES.find((a) => a.pattern.test(label) || a.type === label);
    const fromAlias = parsePuzzleTypesFromText(m[2])[0];
    if (found) perTypeCounts.set(found.type, count);
    else if (fromAlias) perTypeCounts.set(fromAlias, count);
  }

  if (perTypeCounts.size === 0 && /\bpuzzle/i.test(text)) {
    perTypeCounts.set('word-search', 10);
  }

  // Book totals → per-chapter counts when the user named chapters but not "per chapter".
  // Example: "5 chapters" + "20 Word Search" → 4 Word Search per chapter.
  if (chapterCount > 1 && !countsArePerChapter) {
    for (const [type, total] of [...perTypeCounts.entries()]) {
      if (total >= chapterCount) {
        perTypeCounts.set(type, Math.max(1, Math.floor(total / chapterCount)));
      }
    }
  }

  const funFactsOn =
    /fun\s*facts?/i.test(text) ||
    /unique\s+fun\s+fact/i.test(text) ||
    /trivia\s+sentence/i.test(text);
  spec.funFacts = {
    enabled: funFactsOn,
    onePerPuzzle: funFactsOn,
    position: /under|below/.test(lower) ? 'below_title' : 'below_title',
  };

  const solutionsMatch =
    lower.match(/(\d+)\s+solutions?\s+per\s+page/) ||
    lower.match(/solutions?\s*[:=]?\s*(\d+)\s*(?:per\s+page)?/) ||
    lower.match(/(\d+)\s+per\s+page/);
  if (solutionsMatch) {
    spec.solutions.perPage = clampInt(solutionsMatch[1], 1, 9, 4);
  }

  const fontMatch =
    lower.match(/(?:at\s+least|minimum|min(?:imum)?\s+font(?:\s+size)?)\s*(\d+)\s*(?:pt|points?)?/) ||
    lower.match(/fonts?\s+(?:are\s+)?(?:at\s+least\s+)?(\d+)\s*(?:pt|points?)/) ||
    lower.match(/(\d+)\s*(?:pt|points?)\s+(?:minimum|min)/);
  if (fontMatch) {
    spec.typography.minimumFontSize = clampInt(fontMatch[1], 8, 48, 12);
  }

  const startNum = lower.match(/start\s+(?:the\s+)?(?:puzzle\s+)?numbers?\s+at\s+(\d+)/);
  if (startNum) {
    spec.startPuzzleNumber = clampInt(startNum[1], 1, 9999, 1);
  }

  if (/no\s+duplicat|without\s+duplicat|avoid\s+duplicat/i.test(text)) {
    spec.avoidDuplicateWords = true;
  }

  const langMatch = text.match(/\b(english|spanish|french|german|italian|portuguese|arabic)\b/i);
  if (langMatch) {
    const lang = langMatch[1];
    spec.language = lang.charAt(0).toUpperCase() + lang.slice(1).toLowerCase();
  }

  spec.puzzleTypes = [...perTypeCounts.entries()].map(([type, countPerChapter]) => ({
    type,
    countPerChapter,
    generateFunFacts: funFactsOn,
  }));

  if (chapterCount > 1 && spec.chapters.generateTitles && spec.theme) {
    // Placeholder titles — DeepSeek may replace with thematic names
    spec.chapters.titles = Array.from({ length: chapterCount }, (_, i) => {
      if (/sea|ocean/i.test(spec.theme)) {
        const sea = [
          'Ocean Life',
          'Coral Reefs',
          'Sea Creatures',
          'Beaches and Shores',
          'Ships and Exploration',
          'Underwater Adventures',
          'Tides and Waves',
          'Marine Mammals',
        ];
        return sea[i] || `Chapter ${i + 1}`;
      }
      return `${spec.theme} ${i + 1}`;
    });
  }

  return normalizeAiProjectSpec(spec);
}

/**
 * Union puzzle types so an incomplete AI overlay cannot drop types the
 * heuristic already extracted from the user's prompt (e.g. binairo / codewords).
 */
export function mergePuzzleTypes(
  base: AiProjectSpecPuzzleType[],
  overlay: AiProjectSpecPuzzleType[]
): AiProjectSpecPuzzleType[] {
  if (!overlay.length) return base;
  if (!base.length) return overlay;

  const overlayByType = new Map(overlay.map((pt) => [pt.type, pt]));
  const seen = new Set<string>();
  const merged: AiProjectSpecPuzzleType[] = [];

  for (const pt of base) {
    seen.add(pt.type);
    const o = overlayByType.get(pt.type);
    merged.push(o ? { ...pt, ...o, type: pt.type } : pt);
  }
  for (const pt of overlay) {
    if (!seen.has(pt.type)) {
      seen.add(pt.type);
      merged.push(pt);
    }
  }
  return merged;
}

export function mergeAiProjectSpecs(base: AiProjectSpec, overlay: AiProjectSpec): AiProjectSpec {
  return normalizeAiProjectSpec({
    ...base,
    ...overlay,
    theme: overlay.theme || base.theme,
    bookTitle: overlay.bookTitle || base.bookTitle,
    language: overlay.language || base.language,
    chapters: {
      ...base.chapters,
      ...overlay.chapters,
      titles:
        overlay.chapters.titles && overlay.chapters.titles.length > 0
          ? overlay.chapters.titles
          : base.chapters.titles,
    },
    puzzleTypes: mergePuzzleTypes(base.puzzleTypes, overlay.puzzleTypes),
    solutions: { ...base.solutions, ...overlay.solutions },
    typography: { ...base.typography, ...overlay.typography },
    funFacts: { ...base.funFacts, ...overlay.funFacts },
  });
}

export const AI_PROJECT_SPEC_JSON_SCHEMA_HINT = `{
  "theme": "string",
  "bookTitle": "string",
  "language": "English",
  "audience": "kids|teens|adults|seniors|custom",
  "chapters": { "count": number, "generateTitles": boolean, "titles": ["string"] },
  "puzzleTypes": [{ "type": "word-search|sudoku|crossword|maze|cryptogram|word-scramble|trivia|codewords|binairo|kakuro|math-maze|word-fill|number-fill|snake|murdoku", "countPerChapter": number, "generateFunFacts": boolean }],
  "solutions": { "perPage": number },
  "typography": { "minimumFontSize": number },
  "funFacts": { "enabled": boolean, "onePerPuzzle": boolean, "position": "below_title|above_title|page_footer" },
  "organization": "by-chapter|by-type",
  "avoidDuplicateWords": boolean,
  "startPuzzleNumber": number
}`;
