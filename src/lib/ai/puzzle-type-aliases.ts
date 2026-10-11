/**
 * Canonical GenPuzzle puzzle-type ids + NL aliases for AI assistant / planner.
 * When a new generator is added to the product, add it here AND to AI_SUPPORTED_PUZZLE_TYPES.
 */

import type { PuzzleModuleType } from '@/lib/document-model';
import { AI_SUPPORTED_PUZZLE_TYPES, isAiPuzzleType } from './types';

/** Exact module ids the AI may place or generate. */
export const GENPUZZLE_GENERATOR_IDS: readonly PuzzleModuleType[] = [
  'word-search',
  'sudoku',
  'crossword',
  'maze',
  'cryptogram',
  'word-scramble',
  'trivia',
  'codewords',
  'binairo',
  'kakuro',
  'math-maze',
  'word-fill',
  'number-fill',
  'snake',
  'murdoku',
] as const;

/**
 * Natural-language aliases → module id.
 * Longer / more specific patterns first (math maze before maze).
 */
export const PUZZLE_TYPE_ALIASES: Array<{ pattern: RegExp; type: PuzzleModuleType }> = [
  { pattern: /\bword[\s-]?search(es)?\b/i, type: 'word-search' },
  { pattern: /\bwordsearches?\b/i, type: 'word-search' },
  { pattern: /\bsudokus?\b/i, type: 'sudoku' },
  { pattern: /\bcrosswords?\b/i, type: 'crossword' },
  { pattern: /\bcrosswrds?\b/i, type: 'crossword' },
  { pattern: /\bcrosswards?\b/i, type: 'crossword' },
  { pattern: /\bmath[\s-]?mazes?\b/i, type: 'math-maze' },
  { pattern: /\bmazes?\b/i, type: 'maze' },
  { pattern: /\bcryptograms?\b/i, type: 'cryptogram' },
  { pattern: /\bword[\s-]?scramble[s]?\b/i, type: 'word-scramble' },
  { pattern: /\btrivia\b/i, type: 'trivia' },
  { pattern: /\bcode[\s-]?words?\b/i, type: 'codewords' },
  // Binairo + common misspellings (biniro, binario, binary)
  { pattern: /\bbin+a?iros?\b/i, type: 'binairo' },
  { pattern: /\bbinarios?\b/i, type: 'binairo' },
  { pattern: /\bbinary\s*puzzles?\b/i, type: 'binairo' },
  { pattern: /\bkakuros?\b/i, type: 'kakuro' },
  { pattern: /\bnumber[\s-]?fill(?:[\s-]?ins?)?\b/i, type: 'number-fill' },
  { pattern: /\bword[\s-]?fill(?:[\s-]?ins?)?\b/i, type: 'word-fill' },
  { pattern: /\bfill(?:[\s-]?ins?)?\b/i, type: 'word-fill' },
  { pattern: /\bsnakes?\b/i, type: 'snake' },
  { pattern: /\bmurdokus?\b/i, type: 'murdoku' },
];

/** Normalize free-form tokens like "Binairo", "biniro", "word search" → module id. */
export function normalizePuzzleTypeToken(raw: string): PuzzleModuleType | null {
  const token = raw.normalize('NFC').trim().toLowerCase().replace(/[_]+/g, '-');
  if (!token) return null;
  if (isAiPuzzleType(token)) return token;
  const compact = token.replace(/\s+/g, '-');
  if (isAiPuzzleType(compact)) return compact;

  // Direct misspellings / synonyms
  const direct: Record<string, PuzzleModuleType> = {
    biniro: 'binairo',
    biniros: 'binairo',
    binario: 'binairo',
    binarios: 'binairo',
    binary: 'binairo',
    'binary-puzzle': 'binairo',
    'binary-puzzles': 'binairo',
    mazes: 'maze',
    maze: 'maze',
    'math-maze': 'math-maze',
    'math-mazes': 'math-maze',
    mathmaze: 'math-maze',
    cryptograms: 'cryptogram',
    scramble: 'word-scramble',
    'word-scambles': 'word-scramble',
    codeword: 'codewords',
    murdoky: 'murdoku',
    'wordsearch': 'word-search',
    'word-searches': 'word-search',
    crosswrd: 'crossword',
    crosswards: 'crossword',
    crossward: 'crossword',
  };
  if (direct[token] || direct[compact]) return direct[token] || direct[compact];

  for (const alias of PUZZLE_TYPE_ALIASES) {
    if (alias.pattern.test(token) || alias.pattern.test(raw)) return alias.type;
  }
  return null;
}

/**
 * Extract ordered unique puzzle types from a natural-language request.
 * Prefers the order they appear in the sentence.
 */
export function parsePuzzleTypesFromText(text: string): PuzzleModuleType[] {
  const source = (text || '').normalize('NFC');
  if (!source.trim()) return [];

  const hits: Array<{ index: number; type: PuzzleModuleType }> = [];
  for (const alias of PUZZLE_TYPE_ALIASES) {
    const re = new RegExp(alias.pattern.source, alias.pattern.flags.includes('g') ? alias.pattern.flags : `${alias.pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = re.exec(source)) !== null) {
      hits.push({ index: match.index, type: alias.type });
    }
  }

  // Also scan comma / "and" lists for bare tokens
  const listChunk = source.match(
    /(?:add|include|use|with|have|types?)\s+([^.\n]+?)(?:\s+to\s+every|\s+per\s+chapter|\s+in\s+each|$)/i
  );
  if (listChunk?.[1]) {
    for (const part of listChunk[1].split(/,|\band\b|\bor\b|&/i)) {
      const type = normalizePuzzleTypeToken(part);
      if (type) {
        const idx = source.toLowerCase().indexOf(part.trim().toLowerCase());
        hits.push({ index: idx >= 0 ? idx : source.length, type });
      }
    }
  }

  hits.sort((a, b) => a.index - b.index);
  const found: PuzzleModuleType[] = [];
  for (const hit of hits) {
    if (!found.includes(hit.type) && (AI_SUPPORTED_PUZZLE_TYPES as string[]).includes(hit.type)) {
      found.push(hit.type);
    }
  }

  // Ensure registry stays complete even if AI_SUPPORTED drifts
  return found.filter((t) => (GENPUZZLE_GENERATOR_IDS as readonly string[]).includes(t));
}

export function listGeneratorLabelsForPrompt(): string {
  return GENPUZZLE_GENERATOR_IDS.join(', ');
}
