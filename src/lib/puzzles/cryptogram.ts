import { CryptogramPuzzle } from './types';

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
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createSubstitutionCipher(text: string): {
  encoded: string;
  mapping: Record<string, string>;
  reverseMapping: Record<string, string>;
} {
  // Get all unique letters in the text
  const uniqueLetters = [...new Set(text.replace(/[^A-Z]/g, '').split(''))];
  const shuffledLetters = shuffleArray(uniqueLetters);

  // Create mapping (original -> encoded)
  const mapping: Record<string, string> = {};
  const reverseMapping: Record<string, string> = {};

  for (let i = 0; i < uniqueLetters.length; i++) {
    mapping[uniqueLetters[i]] = shuffledLetters[i];
    reverseMapping[shuffledLetters[i]] = uniqueLetters[i];
  }

  // Encode the text
  let encoded = '';
  for (const char of text) {
    if (/[A-Z]/.test(char)) {
      encoded += mapping[char];
    } else {
      encoded += char;
    }
  }

  return { encoded, mapping, reverseMapping };
}

export function generateCryptogram(text: string): CryptogramPuzzle {
  // Clean and uppercase the text
  const cleanText = text.toUpperCase().replace(/[^A-Z\s]/g, '').trim();

  const { encoded, mapping } = createSubstitutionCipher(cleanText);

  // Create a letter key (sorted by encoded letter)
  const letterKey = Object.entries(mapping)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .reduce((acc, [original, encoded]) => {
      acc[encoded] = original;
      return acc;
    }, {} as Record<string, string>);

  return {
    type: 'cryptogram',
    originalText: cleanText,
    encodedText: encoded,
    letterMapping: letterKey,
  };
}

export function getRandomQuote(): { text: string; category: string } {
  const quote = FAMOUS_QUOTES[Math.floor(Math.random() * FAMOUS_QUOTES.length)];
  return quote;
}

export function getQuotesByCategory(category: string): { text: string; category: string }[] {
  return FAMOUS_QUOTES.filter(q => q.category === category);
}

export function getCategories(): string[] {
  return [...new Set(FAMOUS_QUOTES.map(q => q.category))];
}
