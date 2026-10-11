import { WordScramblePuzzle } from './types';
import {
  localeUpperCase,
  normalizePuzzleText,
  segmentGraphemes,
  isLetterGrapheme,
} from '../unicode-text';

/** Fallback word list so a fresh Word Scramble document generates instantly. */
export const DEFAULT_SCRAMBLE_WORDS = [
  'PUZZLE', 'SCRAMBLE', 'LETTERS', 'MYSTERY', 'ANSWER', 'RIDDLE',
  'JUMBLE', 'DECODE', 'BRAIN', 'CHALLENGE', 'SOLVE', 'THINK',
  'CLEVER', 'HIDDEN', 'SECRET', 'GAMES', 'PLAYER', 'WINNER',
  'SMART', 'QUICK', 'LOGIC', 'MEMORY', 'FOCUS', 'LEARN',
  'WORDS', 'SPELL', 'GUESS', 'SHUFFLE', 'TWIST', 'ORDER',
];

/** Fisher-Yates shuffle of every grapheme; retries until it differs. */
function scrambleWord(word: string): string {
  const letters = segmentGraphemes(word);
  if (letters.length < 2) return word;

  for (let attempt = 0; attempt < 20; attempt++) {
    const shuffled = letters.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const scrambled = shuffled.join('');
    if (scrambled !== word) return scrambled;
  }
  // All letters identical (e.g. "AAA") — nothing to scramble.
  return word;
}

function cleanInputWord(raw: unknown, language?: string): string {
  if (typeof raw !== 'string') return '';
  const upper = localeUpperCase(normalizePuzzleText(raw.trim()), language);
  return segmentGraphemes(upper)
    .filter((g) => isLetterGrapheme(g) || g === ' ' || g === '-')
    .join('');
}

export function generateWordScramble(
  words: string[],
  language?: string
): WordScramblePuzzle {
  const requested = Array.isArray(words) ? words : [];
  let cleanWords = requested
    .map((w) => cleanInputWord(w, language))
    .filter((w) => segmentGraphemes(w).filter(isLetterGrapheme).length >= 2);

  // If every custom line was invalid/too short, fall back so the canvas never goes blank.
  if (cleanWords.length === 0) {
    const count = Math.max(5, Math.min(30, requested.length || 10));
    cleanWords = DEFAULT_SCRAMBLE_WORDS.slice(0, count);
  }

  const scrambledWords = cleanWords.map((word) => {
    const lettersOnly = segmentGraphemes(word)
      .filter(isLetterGrapheme)
      .join('');
    return {
      original: word,
      // Phrases: scramble the letters of the whole phrase (spaces/dashes removed).
      scrambled: scrambleWord(lettersOnly),
    };
  });

  return {
    type: 'word-scramble',
    words: scrambledWords,
  };
}
