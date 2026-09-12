import { WordScramblePuzzle } from './types';

/** Fallback word list so a fresh Word Scramble document generates instantly. */
export const DEFAULT_SCRAMBLE_WORDS = [
  'PUZZLE', 'SCRAMBLE', 'LETTERS', 'MYSTERY', 'ANSWER', 'RIDDLE',
  'JUMBLE', 'DECODE', 'BRAIN', 'CHALLENGE', 'SOLVE', 'THINK',
  'CLEVER', 'HIDDEN', 'SECRET', 'GAMES', 'PLAYER', 'WINNER',
  'SMART', 'QUICK', 'LOGIC', 'MEMORY', 'FOCUS', 'LEARN',
  'WORDS', 'SPELL', 'GUESS', 'SHUFFLE', 'TWIST', 'ORDER',
];

/** Fisher-Yates shuffle of every letter; retries until it differs. */
function scrambleWord(word: string): string {
  if (word.length < 2) return word;

  for (let attempt = 0; attempt < 20; attempt++) {
    const letters = word.split('');
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    const scrambled = letters.join('');
    if (scrambled !== word) return scrambled;
  }
  // All letters identical (e.g. "AAA") — nothing to scramble.
  return word;
}

function cleanInputWord(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Prefer Unicode letters; fall back to A–Z if the engine lacks \p{L}.
  try {
    return raw.trim().toUpperCase().replace(/[^\p{L}\s-]/gu, '');
  } catch {
    return raw.trim().toUpperCase().replace(/[^A-Z\s-]/g, '');
  }
}

export function generateWordScramble(words: string[]): WordScramblePuzzle {
  const requested = Array.isArray(words) ? words : [];
  let cleanWords = requested.map(cleanInputWord).filter((w) => w.replace(/[\s-]/g, '').length >= 2);

  // If every custom line was invalid/too short, fall back so the canvas never goes blank.
  if (cleanWords.length === 0) {
    const count = Math.max(5, Math.min(30, requested.length || 10));
    cleanWords = DEFAULT_SCRAMBLE_WORDS.slice(0, count);
  }

  const scrambledWords = cleanWords.map((word) => ({
    original: word,
    // Phrases: scramble the letters of the whole phrase (spaces/dashes removed).
    scrambled: scrambleWord(word.replace(/[\s-]+/g, '')),
  }));

  return {
    type: 'word-scramble',
    words: scrambledWords,
  };
}
