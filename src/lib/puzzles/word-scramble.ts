import { WordScramblePuzzle } from './types';

function scrambleWord(word: string): string {
  // Keep first and last letters, shuffle middle
  if (word.length <= 3) return word;

  const first = word[0];
  const last = word[word.length - 1];
  const middle = word.slice(1, -1).split('');

  // Fisher-Yates shuffle
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }

  // Make sure it's actually scrambled
  const scrambled = middle.join('');
  if (scrambled === word.slice(1, -1)) {
    // If same, swap first two middle letters
    if (middle.length > 1) {
      [middle[0], middle[1]] = [middle[1], middle[0]];
    }
  }

  return first + middle.join('') + last;
}

export function generateWordScramble(words: string[]): WordScramblePuzzle {
  const cleanWords = words
    .map(w => w.trim().toUpperCase().replace(/[^A-Z]/g, ''))
    .filter(w => w.length >= 3);

  const scrambledWords = cleanWords.map(word => ({
    original: word,
    scrambled: scrambleWord(word),
  }));

  return {
    type: 'word-scramble',
    words: scrambledWords,
  };
}
