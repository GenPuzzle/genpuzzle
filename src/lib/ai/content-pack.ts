/**
 * Parse uploaded TXT / CSV / Excel content packs for GenPuzzle AI.
 * Supports the Ancient Kemet-style workbook (Chapters + per-type sheets)
 * and simpler one-column / sectioned text files.
 */

import * as XLSX from 'xlsx';

export type ContentPackPuzzleKind =
  | 'word-search'
  | 'crossword'
  | 'maze'
  | 'word-scramble'
  | 'word-fill'
  | 'cryptogram'
  | 'sudoku';

export interface ContentPackChapter {
  index: number;
  title: string;
  focus?: string;
  puzzleCount?: number;
}

export interface ContentPackPuzzle {
  id: string;
  theme: string;
  title: string;
  chapterIndex?: number;
  words?: string[];
  clues?: string[];
  answers?: string[];
  funFact?: string;
  phrase?: string;
  startImageHint?: string;
  endImageHint?: string;
}

export interface ContentPack {
  sourceName: string;
  sourceKind: 'xlsx' | 'csv' | 'txt';
  chapters: ContentPackChapter[];
  byType: Partial<Record<ContentPackPuzzleKind, ContentPackPuzzle[]>>;
}

export interface ContentPackSummary {
  sourceName: string;
  chapterCount: number;
  chapterTitles: string[];
  types: Array<{
    type: ContentPackPuzzleKind;
    puzzleCount: number;
    wordCount: number;
    sampleTitles: string[];
  }>;
}

const SHEET_ALIASES: Array<{ kind: ContentPackPuzzleKind; match: RegExp }> = [
  { kind: 'crossword', match: /^crossword(?:s)?$/i },
  { kind: 'word-search', match: /^word\s*search(?:es)?$/i },
  { kind: 'maze', match: /^maze(?:s)?$/i },
  { kind: 'word-scramble', match: /^word\s*scramble(?:s)?$/i },
  { kind: 'word-fill', match: /^(?:word[-\s]?)?fill[-\s]?in(?:s)?$/i },
  { kind: 'cryptogram', match: /^cryptogram(?:s)?$/i },
  { kind: 'sudoku', match: /^sudoku(?:s)?$/i },
];

function cellStr(value: unknown): string {
  if (value == null) return '';
  return String(value).normalize('NFC').trim();
}

function parseThemeMeta(theme: string): {
  id: string;
  title: string;
  chapterIndex?: number;
} {
  const raw = cellStr(theme);
  const m = raw.match(/^C(\d+)\s*[-_]?\s*[A-Z]{0,3}\d*\s*:\s*(.+)$/i);
  if (m) {
    return {
      id: raw,
      title: cellStr(m[2]),
      chapterIndex: Math.max(1, Number(m[1]) || 1),
    };
  }
  const m2 = raw.match(/^(.+?)\s*:\s*(.+)$/);
  if (m2) {
    return { id: raw, title: cellStr(m2[2]), chapterIndex: undefined };
  }
  return { id: raw || 'item', title: raw || 'Untitled' };
}

function headerIndex(row: unknown[], ...names: string[]): number {
  const lowered = names.map((n) => n.toLowerCase());
  for (let i = 0; i < row.length; i++) {
    const h = cellStr(row[i]).toLowerCase();
    if (lowered.includes(h)) return i;
  }
  return -1;
}

function sheetKind(name: string): ContentPackPuzzleKind | 'chapters' | null {
  if (/^chapters?$/i.test(name.trim())) return 'chapters';
  for (const entry of SHEET_ALIASES) {
    if (entry.match.test(name.trim())) return entry.kind;
  }
  return null;
}

function parseChaptersSheet(rows: unknown[][]): ContentPackChapter[] {
  if (!rows.length) return [];
  const header = rows[0] as unknown[];
  const chapterCol = headerIndex(header, 'chapter', 'chapters', '#');
  const titleCol = headerIndex(header, 'chapter titles', 'chapter title', 'title', 'titles');
  const focusCol = headerIndex(header, 'focus', 'description', 'theme');
  const countCol = headerIndex(header, 'puzzles', 'puzzle count', 'count');
  const chapters: ContentPackChapter[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    const first = cellStr(row[chapterCol >= 0 ? chapterCol : 0]);
    if (!first) break;
    if (/^puzzle\s*type$/i.test(first)) break;
    const index = Number(first);
    if (!Number.isFinite(index) || index < 1) break;
    const title = cellStr(row[titleCol >= 0 ? titleCol : 1]);
    if (!title) continue;
    chapters.push({
      index,
      title,
      focus: focusCol >= 0 ? cellStr(row[focusCol]) || undefined : undefined,
      puzzleCount:
        countCol >= 0 && Number.isFinite(Number(row[countCol]))
          ? Number(row[countCol])
          : undefined,
    });
  }
  return chapters;
}

function groupThemeRows(
  rows: unknown[][],
  mapRow: (theme: string, cols: string[]) => Partial<ContentPackPuzzle> | null
): ContentPackPuzzle[] {
  if (rows.length < 2) return [];
  const groups = new Map<string, ContentPackPuzzle>();

  for (let r = 1; r < rows.length; r++) {
    const row = (rows[r] as unknown[]).map(cellStr);
    const theme = row[0];
    if (!theme) continue;
    const partial = mapRow(theme, row);
    if (!partial) continue;
    const meta = parseThemeMeta(theme);
    const existing = groups.get(meta.id);
    if (!existing) {
      groups.set(meta.id, {
        id: meta.id,
        theme,
        title: meta.title,
        chapterIndex: meta.chapterIndex,
        words: partial.words ? [...partial.words] : [],
        clues: partial.clues ? [...partial.clues] : [],
        answers: partial.answers ? [...partial.answers] : [],
        funFact: partial.funFact,
        phrase: partial.phrase,
        startImageHint: partial.startImageHint,
        endImageHint: partial.endImageHint,
      });
      continue;
    }
    if (partial.words?.length) existing.words = [...(existing.words || []), ...partial.words];
    if (partial.clues?.length) existing.clues = [...(existing.clues || []), ...partial.clues];
    if (partial.answers?.length) {
      existing.answers = [...(existing.answers || []), ...partial.answers];
    }
    if (partial.funFact) existing.funFact = partial.funFact;
    if (partial.phrase) existing.phrase = partial.phrase;
    if (partial.startImageHint) existing.startImageHint = partial.startImageHint;
    if (partial.endImageHint) existing.endImageHint = partial.endImageHint;
  }

  return [...groups.values()].map((p) => ({
    ...p,
    words: p.words?.filter(Boolean),
    clues: p.clues?.filter(Boolean),
    answers: p.answers?.filter(Boolean),
  }));
}

function parseTypedSheet(kind: ContentPackPuzzleKind, rows: unknown[][]): ContentPackPuzzle[] {
  const header = (rows[0] || []) as unknown[];
  const wordsCol = headerIndex(header, 'words', 'word', 'entries');
  const cluesCol = headerIndex(header, 'clues', 'clue');
  const answersCol = headerIndex(header, 'answers', 'answer');
  const funCol = headerIndex(header, 'fun facts', 'fun fact', 'facts', 'phrases', 'phrase', 'sentence');
  const startCol = headerIndex(header, 'start image', 'start', 'start hint');
  const endCol = headerIndex(header, 'end image', 'end', 'end hint');

  if (kind === 'crossword') {
    return groupThemeRows(rows, (_theme, cols) => {
      const clue = cluesCol >= 0 ? cols[cluesCol] : cols[1];
      const answer = answersCol >= 0 ? cols[answersCol] : cols[2];
      if (!clue && !answer) return null;
      return {
        clues: clue ? [clue] : [],
        answers: answer ? [answer] : [],
        words: answer ? [answer] : [],
      };
    });
  }

  if (kind === 'cryptogram') {
    return groupThemeRows(rows, (_theme, cols) => {
      const phrase = funCol >= 0 ? cols[funCol] : cols[1];
      if (!phrase) return null;
      return { phrase, funFact: phrase };
    });
  }

  if (kind === 'maze') {
    return groupThemeRows(rows, (_theme, cols) => ({
      startImageHint: startCol >= 0 ? cols[startCol] : cols[1],
      endImageHint: endCol >= 0 ? cols[endCol] : cols[2],
    }));
  }

  return groupThemeRows(rows, (_theme, cols) => {
    const word = wordsCol >= 0 ? cols[wordsCol] : cols[Math.min(1, cols.length - 1)];
    if (!word) return null;
    return { words: [word] };
  });
}

function parseWorkbook(wb: XLSX.WorkBook, sourceName: string): ContentPack {
  const pack: ContentPack = {
    sourceName,
    sourceKind: 'xlsx',
    chapters: [],
    byType: {},
  };

  for (const name of wb.SheetNames) {
    const kind = sheetKind(name);
    if (!kind) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: '',
      raw: false,
    }) as unknown[][];
    if (kind === 'chapters') {
      pack.chapters = parseChaptersSheet(rows);
      continue;
    }
    const puzzles = parseTypedSheet(kind, rows);
    if (puzzles.length) pack.byType[kind] = puzzles;
  }

  return pack;
}

function parseDelimitedText(text: string, sourceName: string, sourceKind: 'csv' | 'txt'): ContentPack {
  const pack: ContentPack = {
    sourceName,
    sourceKind,
    chapters: [],
    byType: {},
  };
  const normalized = text.normalize('NFC').replace(/^\uFEFF/, '');
  const lines = normalized.split(/\r?\n/);

  let current: ContentPackPuzzleKind | 'chapters' | null = null;
  let buf: string[][] = [];

  const flush = () => {
    if (!current || buf.length === 0) return;
    if (current === 'chapters') {
      pack.chapters = parseChaptersSheet(buf);
    } else {
      const puzzles = parseTypedSheet(current, buf);
      if (puzzles.length) pack.byType[current] = puzzles;
    }
    buf = [];
  };

  let sawSection = false;
  for (const line of lines) {
    const section = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (section) {
      sawSection = true;
      flush();
      current = sheetKind(section[1]);
      continue;
    }
    if (!sawSection) break;
    if (!current) continue;
    const cols = line.includes('\t')
      ? line.split('\t')
      : line.includes(',')
        ? line.split(',')
        : [line];
    buf.push(cols.map((c) => c.trim()));
  }
  if (sawSection) {
    flush();
    return pack;
  }

  const words = lines.map((l) => l.trim()).filter(Boolean);
  if (words.length) {
    pack.byType['word-search'] = [
      {
        id: 'uploaded-words',
        theme: sourceName,
        title: sourceName.replace(/\.[^.]+$/, '') || 'Uploaded words',
        words,
      },
    ];
  }
  return pack;
}

export async function parseContentPackFile(file: File): Promise<ContentPack> {
  const name = file.name || 'upload';
  const lower = name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    return parseWorkbook(wb, name);
  }
  const text = await file.text();
  if (lower.endsWith('.csv')) {
    const wb = XLSX.read(text, { type: 'string' });
    if (wb.SheetNames.length === 1) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        header: 1,
        defval: '',
        raw: false,
      }) as unknown[][];
      const header = (rows[0] || []).map(cellStr).join('|').toLowerCase();
      if (header.includes('theme') && (header.includes('word') || header.includes('clue'))) {
        const pack: ContentPack = {
          sourceName: name,
          sourceKind: 'csv',
          chapters: [],
          byType: {},
        };
        const kind =
          header.includes('clue') && header.includes('answer')
            ? 'crossword'
            : header.includes('fun fact')
              ? 'cryptogram'
              : 'word-search';
        pack.byType[kind] = parseTypedSheet(kind, rows);
        return pack;
      }
    }
    return parseWorkbook(wb, name);
  }
  return parseDelimitedText(text, name, 'txt');
}

export function summarizeContentPack(pack: ContentPack): ContentPackSummary {
  const types = (Object.keys(pack.byType) as ContentPackPuzzleKind[]).map((type) => {
    const puzzles = pack.byType[type] || [];
    const wordCount = puzzles.reduce(
      (sum, p) => sum + (p.words?.length || 0) + (p.answers?.length || 0),
      0
    );
    return {
      type,
      puzzleCount: puzzles.length,
      wordCount,
      sampleTitles: puzzles.slice(0, 3).map((p) => p.title),
    };
  });
  return {
    sourceName: pack.sourceName,
    chapterCount: pack.chapters.length,
    chapterTitles: pack.chapters.map((c) => c.title),
    types,
  };
}

export function formatContentPackSummary(pack: ContentPack): string {
  const summary = summarizeContentPack(pack);
  const lines = [`Uploaded **${summary.sourceName}**.`];
  if (summary.chapterCount) {
    lines.push(
      `Chapters (${summary.chapterCount}): ${summary.chapterTitles.join(' · ')}`
    );
  }
  if (!summary.types.length) {
    lines.push('No recognizable puzzle sheets/sections were found.');
    return lines.join('\n');
  }
  lines.push('Content found:');
  for (const t of summary.types) {
    const extras = t.wordCount ? `, ${t.wordCount} words/answers` : '';
    lines.push(
      `• ${t.type}: ${t.puzzleCount} puzzle(s)${extras}` +
        (t.sampleTitles.length ? ` — e.g. ${t.sampleTitles.join('; ')}` : '')
    );
  }
  lines.push(
    '\nHow should I apply this?\n' +
      '1) Active document only — paste words/clues into that tab and generate\n' +
      '2) All matching document tabs already in the book — fill settings + generate each\n' +
      '3) Rebuild the book from this file (chapters + puzzle tabs), then generate\n\n' +
      'Reply with 1, 2, or 3 (optionally name a type, e.g. “2 word-search”).'
  );
  return lines.join('\n');
}

/** Compact JSON for the LLM context (truncated lists). */
export function contentPackForAiContext(pack: ContentPack, maxItems = 8): Record<string, unknown> {
  const byType: Record<string, unknown> = {};
  for (const [type, puzzles] of Object.entries(pack.byType)) {
    byType[type] = (puzzles || []).slice(0, maxItems).map((p) => ({
      title: p.title,
      chapterIndex: p.chapterIndex,
      words: (p.words || []).slice(0, 12),
      clues: (p.clues || []).slice(0, 8),
      answers: (p.answers || []).slice(0, 8),
      phrase: p.phrase,
      funFact: p.funFact,
      wordCount: p.words?.length || 0,
      clueCount: p.clues?.length || 0,
    }));
  }
  return {
    sourceName: pack.sourceName,
    chapters: pack.chapters,
    byType,
    totals: Object.fromEntries(
      Object.entries(pack.byType).map(([k, v]) => [k, (v || []).length])
    ),
  };
}

export function resolveContentPackApplyMode(
  message: string
): { mode: 'active' | 'matching' | 'rebuild'; types?: ContentPackPuzzleKind[] } | null {
  const lower = message.toLowerCase().trim();
  let mode: 'active' | 'matching' | 'rebuild' | null = null;
  if (/^\s*1\b/.test(lower) || /\bactive\b/.test(lower) || /\bthis\s+(page|document|tab)\b/.test(lower)) {
    mode = 'active';
  } else if (
    /^\s*2\b/.test(lower) ||
    /\ball\s+matching\b/.test(lower) ||
    /\bexisting\b/.test(lower)
  ) {
    mode = 'matching';
  } else if (
    /^\s*3\b/.test(lower) ||
    /\brebuild\b/.test(lower) ||
    /\bbuild\s+(the\s+)?book\b/.test(lower)
  ) {
    mode = 'rebuild';
  }
  if (!mode) return null;

  const types: ContentPackPuzzleKind[] = [];
  if (/word[\s-]*search/.test(lower)) types.push('word-search');
  if (/crossword/.test(lower)) types.push('crossword');
  if (/\bmaze/.test(lower)) types.push('maze');
  if (/scramble/.test(lower)) types.push('word-scramble');
  if (/fill/.test(lower)) types.push('word-fill');
  if (/cryptogram/.test(lower)) types.push('cryptogram');
  if (/sudoku/.test(lower)) types.push('sudoku');
  return { mode, types: types.length ? types : undefined };
}
