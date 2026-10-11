/**
 * Shared text-variable token resolution for Canvas / PDF / PPTX.
 * Extends the existing page-variables system — does not replace it.
 */

export const TEXT_VARIABLE_KEYS = [
  'fun_fact',
  'puzzle_title',
  'puzzle_number',
  'chapter_title',
  'chapter_number',
  'instruction',
  'puzzle_sentence',
  'solution_page',
  'solution_page_location',
  'difficulty',
  'theme',
  'puzzle_type',
  'page_number',
  'word_count',
] as const;

export type TextVariableKey = (typeof TEXT_VARIABLE_KEYS)[number];

export const TEXT_VARIABLE_TOKEN_ALIASES: Record<string, TextVariableKey> = {
  'fun fact': 'fun_fact',
  funfact: 'fun_fact',
  fun_fact: 'fun_fact',
  'puzzle title': 'puzzle_title',
  puzzle_title: 'puzzle_title',
  title: 'puzzle_title',
  'puzzle number': 'puzzle_number',
  puzzle_number: 'puzzle_number',
  'start number at': 'puzzle_number',
  'chapter title': 'chapter_title',
  chapter_title: 'chapter_title',
  'chapter number': 'chapter_number',
  chapter_number: 'chapter_number',
  instruction: 'instruction',
  instructions: 'instruction',
  'puzzle sentence': 'puzzle_sentence',
  puzzle_sentence: 'puzzle_sentence',
  'solution page': 'solution_page',
  solution_page: 'solution_page',
  'solution page location': 'solution_page_location',
  solution_page_location: 'solution_page_location',
  difficulty: 'difficulty',
  theme: 'theme',
  'puzzle type': 'puzzle_type',
  puzzle_type: 'puzzle_type',
  'page number': 'page_number',
  page_number: 'page_number',
  'word count': 'word_count',
  word_count: 'word_count',
};

export const TEXT_VARIABLE_LABELS: Record<TextVariableKey, string> = {
  fun_fact: 'Fun Fact',
  puzzle_title: 'Puzzle Title',
  puzzle_number: 'Puzzle Number',
  chapter_title: 'Chapter Title',
  chapter_number: 'Chapter Number',
  instruction: 'Instruction',
  puzzle_sentence: 'Puzzle Sentence',
  solution_page: 'Solution Page',
  solution_page_location: 'Solution Page Location',
  difficulty: 'Difficulty',
  theme: 'Theme',
  puzzle_type: 'Puzzle Type',
  page_number: 'Page Number',
  word_count: 'Word Count',
};

export function isTextVariableKey(value: unknown): value is TextVariableKey {
  return typeof value === 'string' && (TEXT_VARIABLE_KEYS as readonly string[]).includes(value);
}

export function normalizeTextVariableKey(raw: string): TextVariableKey | null {
  const key = raw.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  const underscored = key.replace(/\s+/g, '_');
  return (
    TEXT_VARIABLE_TOKEN_ALIASES[key] ||
    TEXT_VARIABLE_TOKEN_ALIASES[underscored] ||
    (isTextVariableKey(underscored) ? underscored : null)
  );
}

export interface TextVariableResolveContext {
  puzzleTitle?: string;
  puzzleNumber?: number;
  chapterTitle?: string;
  chapterNumber?: number;
  funFact?: string;
  instruction?: string;
  puzzleSentence?: string;
  solutionPage?: number | string;
  solutionPageLocation?: string;
  difficulty?: string;
  theme?: string;
  puzzleType?: string;
  pageNumber?: number;
  wordCount?: number;
  /** Lookup tables by printed content index (0-based). */
  funFactsByIndex?: string[];
  titlesByIndex?: string[];
  instructionsByIndex?: string[];
  sentencesByIndex?: string[];
  contentIndex?: number;
}

function valueForKey(key: TextVariableKey, ctx: TextVariableResolveContext): string {
  const index = Math.max(0, Math.round(ctx.contentIndex ?? 0));
  switch (key) {
    case 'fun_fact':
      return (
        ctx.funFact ??
        ctx.funFactsByIndex?.[index] ??
        ''
      ).normalize('NFC');
    case 'puzzle_title':
      return (ctx.puzzleTitle ?? ctx.titlesByIndex?.[index] ?? '').normalize('NFC');
    case 'puzzle_number':
      return ctx.puzzleNumber != null ? String(ctx.puzzleNumber) : '';
    case 'chapter_title':
      return (ctx.chapterTitle ?? '').normalize('NFC');
    case 'chapter_number':
      return ctx.chapterNumber != null ? String(ctx.chapterNumber) : '';
    case 'instruction':
      return (
        ctx.instruction ??
        ctx.instructionsByIndex?.[index] ??
        ''
      ).normalize('NFC');
    case 'puzzle_sentence':
      return (
        ctx.puzzleSentence ??
        ctx.sentencesByIndex?.[index] ??
        ''
      ).normalize('NFC');
    case 'solution_page':
      return ctx.solutionPage != null ? String(ctx.solutionPage) : '';
    case 'solution_page_location':
      if (ctx.solutionPageLocation) return ctx.solutionPageLocation.normalize('NFC');
      if (ctx.solutionPage != null) return `Solution on page ${ctx.solutionPage}`;
      return '';
    case 'difficulty':
      return (ctx.difficulty ?? '').normalize('NFC');
    case 'theme':
      return (ctx.theme ?? '').normalize('NFC');
    case 'puzzle_type':
      return (ctx.puzzleType ?? '').normalize('NFC');
    case 'page_number':
      return ctx.pageNumber != null ? String(ctx.pageNumber) : '';
    case 'word_count':
      return ctx.wordCount != null ? String(ctx.wordCount) : '';
    default:
      return '';
  }
}

const TOKEN_RE = /\[([^\]]+)\]/g;

/**
 * Resolve bracket tokens such as [fun fact] / [puzzle title] using shared context.
 * Preserves Unicode (NFC). Unknown tokens are left unchanged.
 */
export function resolveTextVariableTokens(
  input: string,
  ctx: TextVariableResolveContext
): string {
  if (!input) return '';
  const text = input.normalize('NFC');
  return text.replace(TOKEN_RE, (full, raw: string) => {
    const key = normalizeTextVariableKey(raw);
    if (!key) return full;
    const value = valueForKey(key, ctx);
    return value;
  });
}

export function textContainsVariableToken(input: string): boolean {
  if (!input) return false;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(input)) !== null) {
    if (normalizeTextVariableKey(match[1] || '')) return true;
  }
  return false;
}

export function tokenForVariableKey(key: TextVariableKey): string {
  const label = TEXT_VARIABLE_LABELS[key].toLowerCase();
  return `[${label}]`;
}
