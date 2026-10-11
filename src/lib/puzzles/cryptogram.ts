import { CryptogramPuzzle } from './types';
import {
  getLanguageLetterAlphabet,
  isLetterGrapheme,
  localeUpperCase,
  normalizePuzzleText,
  segmentGraphemes,
} from '../unicode-text';

// Build-in famous quotes for cryptograms
export const FAMOUS_QUOTES = [
  { text: "THE ONLY THING WE HAVE TO FEAR IS FEAR ITSELF", category: "Wisdom" },
  { text: "TO BE OR NOT TO BE THAT IS THE QUESTION", category: "Literature" },
  { text: "KNOWLEDGE IS POWER", category: "Wisdom" },
  { text: "I THINK THEREFORE I AM", category: "Philosophy" },
  { text: "THE TRUTH WILL SET YOU FREE", category: "Wisdom" },
  { text: "ACTIONS SPEAK LOUDER THAN WORDS", category: "Wisdom" },
  { text: "WHERE THERE IS A WILL THERE IS A WAY", category: "Motivation" },
  { text: "EVERY CLOUD HAS A SILVER LINING", category: "Wisdom" },
  { text: "TIME WAITS FOR NO ONE", category: "Wisdom" },
  { text: "THE PEN IS MIGHTIER THAN THE SWORD", category: "Literature" },
  { text: "ALL THAT GLITTERS IS NOT GOLD", category: "Wisdom" },
  { text: "A PICTURE IS WORTH A THOUSAND WORDS", category: "Wisdom" },
  { text: "LIFE IS LIKE A BOX OF CHOCOLATES", category: "Humor" },
  { text: "MAY THE FORCE BE WITH YOU", category: "Popular" },
  { text: "TO INFINITY AND BEYOND", category: "Popular" },
  { text: "HOUSTON WE HAVE A PROBLEM", category: "Popular" },
  { text: "HERE IS LOOKING AT YOU KID", category: "Popular" },
  { text: "YADA YADA YADA", category: "Humor" },
  { text: "ELEMENTARY MY DEAR WATSON", category: "Literature" },
  { text: "YOU CAN HANDLE THE TRUTH", category: "Popular" },
  { text: "LOVE CONQUERS ALL", category: "Wisdom" },
  { text: "HARDSHIP OFTEN PREPARES ORDINARY PEOPLE FOR AN EXTRAORDINARY DESTINY", category: "Motivation" },
  { text: "THE BEST TIME TO PLANT A TREE WAS TWENTY YEARS AGO THE SECOND BEST TIME IS NOW", category: "Motivation" },
  { text: "SUCCESS IS NOT FINAL FAILURE IS NOT FATAL", category: "Motivation" },
  { text: "IT ALWAYS SEEMS IMPOSSIBLE UNTIL IT IS DONE", category: "Motivation" },
  { text: "DO NOT GO GENTLE INTO THAT GOOD NIGHT", category: "Literature" },
  { text: "I HAVE A DREAM", category: "History" },
  { text: "ASK NOT WHAT YOUR COUNTRY CAN DO FOR YOU", category: "History" },
  { text: "GIVE ME LIBERTY OR GIVE ME DEATH", category: "History" },
  { text: "I CAME I SAW I CONQUERED", category: "History" },
];

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

/**
 * Full-alphabet substitution cipher. For a letters cipher no letter ever maps
 * to itself (a derangement), which is the professional cryptogram standard.
 */
function createAlphabetCipher(
  alphabet: string[],
  cipherType: 'letters' | 'numbers'
): Record<string, string> {
  if (cipherType === 'numbers') {
    const numbers = shuffleArray(alphabet.map((_, i) => String(i + 1)));
    const mapping: Record<string, string> = {};
    alphabet.forEach((letter, i) => {
      mapping[letter] = numbers[i]!;
    });
    return mapping;
  }

  // Retry the shuffle until it is a derangement (fast — ~e/1 tries on average).
  for (;;) {
    const shuffled = shuffleArray(alphabet);
    if (alphabet.every((letter, i) => shuffled[i] !== letter)) {
      const mapping: Record<string, string> = {};
      alphabet.forEach((letter, i) => {
        mapping[letter] = shuffled[i]!;
      });
      return mapping;
    }
  }
}

function collectCipherAlphabet(
  text: string,
  language: string | undefined,
  extraLetters: string[]
): string[] {
  const base = getLanguageLetterAlphabet(language);
  const seen = new Set(base);
  const out = [...base];
  const add = (raw: string) => {
    for (const g of segmentGraphemes(localeUpperCase(normalizePuzzleText(raw), language))) {
      if (!isLetterGrapheme(g) || seen.has(g)) continue;
      seen.add(g);
      out.push(g);
    }
  };
  add(text);
  for (const extra of extraLetters) add(extra);
  return out;
}

export interface CryptogramOptions {
  cipherType?: 'letters' | 'numbers';
  /** How many original letters to reveal in the on-page answer key. */
  hintCount?: number;
  /** Extra letters (other languages) to include in the cipher alphabet. */
  extraLetters?: string[];
  /** Project / puzzle language for locale-aware case and alphabet. */
  language?: string;
}

export function generateCryptogram(
  text: string,
  options: CryptogramOptions = {}
): CryptogramPuzzle {
  const cipherType = options.cipherType ?? 'letters';
  const language = options.language;
  // Keep letters and whitespace; punctuation passes through unencoded.
  // NFC + locale upper — never strip diacritics.
  const cleanText = localeUpperCase(
    normalizePuzzleText(text).replace(/\s+/g, ' ').trim(),
    language
  );

  const alphabet = collectCipherAlphabet(cleanText, language, options.extraLetters ?? []);
  const mapping = createAlphabetCipher(alphabet, cipherType);

  const isCipherLetter = (ch: string) => mapping[ch] !== undefined;
  const graphemes = segmentGraphemes(cleanText);

  // Letters: substitute in place. Numbers: space-separate tokens, double-space between words.
  let encoded = '';
  for (const ch of graphemes) {
    if (isCipherLetter(ch)) {
      const token = mapping[ch]!;
      if (cipherType === 'numbers') {
        if (encoded.length > 0 && /\d$/.test(encoded)) encoded += ' ';
        encoded += token;
      } else {
        encoded += token;
      }
    } else if (ch === ' ') {
      encoded += cipherType === 'numbers' ? '  ' : ' ';
    } else {
      encoded += ch;
    }
  }

  // token -> original letter (used to decode / display the key)
  const letterKey: Record<string, string> = {};
  for (const [original, token] of Object.entries(mapping)) {
    letterKey[token] = original;
  }

  // Reveal the most frequent letters in the phrase as hints.
  const freq = new Map<string, number>();
  for (const ch of graphemes) {
    if (isCipherLetter(ch)) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  const hintCount = Math.max(0, Math.min(alphabet.length - 1, options.hintCount ?? 0));
  const hintLetters = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, hintCount)
    .map(([letter]) => letter);

  return {
    type: 'cryptogram',
    originalText: cleanText,
    encodedText: encoded,
    letterMapping: letterKey,
    cipherType,
    hintLetters,
  };
}

export function getRandomQuote(): { text: string; category: string } {
  const quote = FAMOUS_QUOTES[Math.floor(Math.random() * FAMOUS_QUOTES.length)]!;
  return quote;
}

export function getQuotesByCategory(category: string): { text: string; category: string }[] {
  return FAMOUS_QUOTES.filter((q) => q.category === category);
}

export function getCategories(): string[] {
  return [...new Set(FAMOUS_QUOTES.map((q) => q.category))];
}
