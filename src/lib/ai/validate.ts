import type { PuzzleModuleType } from '@/lib/document-model';
import { normalizeGeneratedWordList } from '@/lib/word-list-parse';
import type {
  AiBatchResponse,
  AiCrosswordContent,
  AiCryptogramContent,
  AiDifficulty,
  AiPuzzleContent,
  AiPuzzleTypeConfig,
  AiTriviaContent,
  AiMurdokuContent,
  AiWordScrambleContent,
  AiWordSearchContent,
} from './types';
import { aiMurdokuGridFromConfig } from './types';

const DIFFICULTIES = new Set<AiDifficulty>(['easy', 'medium', 'hard']);

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asDifficulty(value: unknown, fallback: AiDifficulty = 'medium'): AiDifficulty {
  const v = asString(value).toLowerCase() as AiDifficulty;
  return DIFFICULTIES.has(v) ? v : fallback;
}

function lettersOnly(word: string, maxLen: number): string {
  return Array.from(word.normalize('NFC').toUpperCase())
    .filter((char) => /\p{L}/u.test(char))
    .join('')
    .slice(0, Math.max(2, maxLen));
}

/** One printable line — never let a clue/answer split the crossword textareas. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Keep only valid 1:1 crossword pairs (unique letter-only answers + non-empty single-line clues).
 */
export function normalizeAiCrosswordEntries(
  raw: unknown,
  need: number,
  maxAnswerLength: number
): Array<{ answer: string; clue: string }> {
  const entriesRaw = Array.isArray(raw) ? raw : [];
  const entries: Array<{ answer: string; clue: string }> = [];
  const seen = new Set<string>();
  for (const entry of entriesRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const answer = lettersOnly(asString(e.answer), maxAnswerLength);
    const clue = singleLine(asString(e.clue));
    if (answer.length < 3 || !clue) continue;
    if (seen.has(answer)) continue;
    seen.add(answer);
    entries.push({ answer, clue });
    if (entries.length >= need) break;
  }
  return entries;
}

export function parseAiBatchJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  return JSON.parse(trimmed);
}

export function validateAiBatchResponse(
  raw: unknown,
  puzzleType: PuzzleModuleType,
  expectedCount: number,
  typeConfig: AiPuzzleTypeConfig,
  assignedDifficulties: AiDifficulty[]
): { ok: true; puzzles: AiPuzzleContent[] } | { ok: false; message: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'AI returned invalid JSON.' };
  }
  const puzzlesRaw = (raw as { puzzles?: unknown }).puzzles;
  if (!Array.isArray(puzzlesRaw)) {
    return { ok: false, message: 'AI response missing puzzles array.' };
  }

  const puzzles: AiPuzzleContent[] = [];
  for (let i = 0; i < puzzlesRaw.length; i++) {
    const item = puzzlesRaw[i];
    const difficulty =
      assignedDifficulties[i] ??
      assignedDifficulties[assignedDifficulties.length - 1] ??
      'medium';
    const normalized = normalizePuzzle(item, puzzleType, typeConfig, difficulty);
    if (!normalized.ok) {
      return { ok: false, message: normalized.message };
    }
    puzzles.push(normalized.puzzle);
  }

  if (puzzles.length < expectedCount) {
    return {
      ok: false,
      message: `AI returned ${puzzles.length} puzzles but ${expectedCount} were requested.`,
    };
  }

  return { ok: true, puzzles: puzzles.slice(0, expectedCount) };
}

function normalizePuzzle(
  item: unknown,
  puzzleType: PuzzleModuleType,
  cfg: AiPuzzleTypeConfig,
  fallbackDifficulty: AiDifficulty
): { ok: true; puzzle: AiPuzzleContent } | { ok: false; message: string } {
  if (!item || typeof item !== 'object') {
    return { ok: false, message: 'Invalid puzzle object in AI response.' };
  }
  const obj = item as Record<string, unknown>;
  const title = asString(obj.title) || `${getFallbackTitle(puzzleType)}`;
  const difficulty = asDifficulty(obj.difficulty, fallbackDifficulty);

  switch (puzzleType) {
    case 'word-search': {
      const maxLen = cfg.maxWordLength ?? 12;
      const need = cfg.wordsPerPuzzle ?? 15;
      const words = normalizeGeneratedWordList(
        (Array.isArray(obj.words) ? obj.words : []).map((w) => asString(w)),
        maxLen
      ).filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 3);
      if (words.length < Math.min(need, 5)) {
        return { ok: false, message: `Word search "${title}" has too few valid words.` };
      }
      while (words.length < need && words.length > 0) {
        // Pad by cycling if slightly short (validator still ensures minimum quality).
        words.push(words[words.length % Math.max(1, words.length - 1)]!);
      }
      const puzzle: AiWordSearchContent = {
        type: 'word-search',
        title,
        theme: asString(obj.theme) || title,
        difficulty,
        funFact: asString(obj.funFact) || undefined,
        words: words.slice(0, need),
      };
      return { ok: true, puzzle };
    }
    case 'crossword': {
      const need = cfg.cluesPerPuzzle ?? 15;
      const maxLen = cfg.maxAnswerLength ?? 15;
      const entries = normalizeAiCrosswordEntries(obj.entries, need, maxLen);
      if (entries.length !== need) {
        return {
          ok: false,
          message: `Crossword "${title}" must include exactly ${need} answer/clue pairs (got ${entries.length}).`,
        };
      }
      const puzzle: AiCrosswordContent = {
        type: 'crossword',
        title,
        difficulty,
        entries,
      };
      return { ok: true, puzzle };
    }
    case 'sudoku':
      return {
        ok: true,
        puzzle: { type: 'sudoku', title, difficulty },
      };
    case 'maze':
      return {
        ok: true,
        puzzle: { type: 'maze', title, difficulty },
      };
    case 'cryptogram': {
      const phrase = asString(obj.phrase);
      if (phrase.length < 12) {
        return { ok: false, message: `Cryptogram "${title}" phrase is too short.` };
      }
      const puzzle: AiCryptogramContent = {
        type: 'cryptogram',
        title,
        difficulty,
        phrase,
      };
      return { ok: true, puzzle };
    }
    case 'word-scramble': {
      const need = cfg.wordsPerPuzzle ?? 10;
      const maxLen = cfg.maxWordLength ?? 12;
      const words = normalizeGeneratedWordList(
        (Array.isArray(obj.words) ? obj.words : []).map((w) => asString(w)),
        maxLen
      ).filter((w) => w.replace(/[^\p{L}]/gu, '').length >= 3);
      if (words.length < Math.min(need, 4)) {
        return { ok: false, message: `Word scramble "${title}" has too few words.` };
      }
      const puzzle: AiWordScrambleContent = {
        type: 'word-scramble',
        title,
        difficulty,
        words: words.slice(0, need),
      };
      return { ok: true, puzzle };
    }
    case 'trivia': {
      const qNeed = cfg.questionsPerPuzzle ?? 10;
      const sNeed = cfg.suggestionsPerQuestion ?? 4;
      const questionsRaw = Array.isArray(obj.questions) ? obj.questions : [];
      const questions: AiTriviaContent['questions'] = [];
      for (const q of questionsRaw) {
        if (!q || typeof q !== 'object') continue;
        const row = q as Record<string, unknown>;
        const prompt = asString(row.prompt);
        const suggestions = (Array.isArray(row.suggestions) ? row.suggestions : [])
          .map((s) => asString(s))
          .filter(Boolean)
          .slice(0, sNeed);
        const answer = asString(row.answer);
        if (!prompt || suggestions.length < 2 || !answer) continue;
        if (!suggestions.includes(answer)) {
          suggestions[0] = answer;
        }
        while (suggestions.length < sNeed) {
          suggestions.push(`Option ${suggestions.length + 1}`);
        }
        questions.push({
          prompt,
          suggestions: suggestions.slice(0, sNeed),
          answer,
        });
      }
      if (questions.length < Math.min(qNeed, 3)) {
        return { ok: false, message: `Trivia "${title}" has too few questions.` };
      }
      const puzzle: AiTriviaContent = {
        type: 'trivia',
        title,
        difficulty,
        questions: questions.slice(0, qNeed),
      };
      return { ok: true, puzzle };
    }
    case 'murdoku': {
      const { people } = aiMurdokuGridFromConfig(cfg);
      const charactersRaw = Array.isArray(obj.characters) ? obj.characters : [];
      const characters = charactersRaw
        .map((row) => {
          if (!row || typeof row !== 'object') return null;
          const rec = row as Record<string, unknown>;
          const name = asString(rec.name);
          if (!name) return null;
          return {
            name,
            occupation: asString(rec.occupation),
            description: asString(rec.description),
          };
        })
        .filter(Boolean) as NonNullable<AiMurdokuContent['characters']>;
      if (characters.length < Math.min(people, 3)) {
        return { ok: false, message: `Murdoku "${title}" needs at least ${Math.min(people, 3)} characters.` };
      }
      const rooms = (Array.isArray(obj.rooms) ? obj.rooms : []).map((r) => asString(r)).filter(Boolean);
      const elements = (Array.isArray(obj.elements) ? obj.elements : []).map((r) => asString(r)).filter(Boolean);
      const puzzle: AiMurdokuContent = {
        type: 'murdoku',
        title,
        theme: asString(obj.theme) || title,
        location: asString(obj.location),
        difficulty,
        caseTitle: asString(obj.caseTitle) || title,
        intro: asString(obj.intro),
        instruction: asString(obj.instruction),
        characters: characters.slice(0, people),
        rooms,
        elements,
      };
      return { ok: true, puzzle };
    }
    default:
      return { ok: false, message: `Unsupported puzzle type: ${puzzleType}` };
  }
}

function getFallbackTitle(type: PuzzleModuleType): string {
  switch (type) {
    case 'word-search':
      return 'Word Search';
    case 'crossword':
      return 'Crossword';
    case 'sudoku':
      return 'Sudoku';
    case 'maze':
      return 'Maze';
    case 'cryptogram':
      return 'Cryptogram';
    case 'word-scramble':
      return 'Word Scramble';
    case 'trivia':
      return 'Trivia';
    case 'murdoku':
      return 'Murdoku';
    default:
      return 'Puzzle';
  }
}

export type { AiBatchResponse };

export function parseAiFrontMatterCopy(
  raw: unknown,
  needIntroduction: boolean,
  needInstructions: boolean
): { introduction?: string; instructions?: string } {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: { introduction?: string; instructions?: string } = {};
  if (needIntroduction) {
    const text = asString(obj.introduction);
    if (text.length >= 40) out.introduction = text;
  }
  if (needInstructions) {
    const text = asString(obj.instructions);
    if (text.length >= 40) out.instructions = text;
  }
  return out;
}
