/** Parse word list from comma-separated (horizontal) or newline-separated (vertical) input. */
import {
  isLetterGrapheme,
  localeUpperCase,
  normalizePuzzleText,
  segmentGraphemes,
  unicodeFoldKey,
} from './unicode-text';

export function parseWordListFromBothFormats(value: string): string[] {
  if (!value || value.trim().length === 0) return [];

  if (value.includes(',')) {
    return value
      .split(',')
      .map((w) => w.trim())
      .filter((w) => w.length > 0);
  }

  return value
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

/**
 * Keep natural spaces in AI word-list entries ("Sea Animals" not "SEAANIMALS").
 * Also splits CamelCase like SeaAnimals → SEA ANIMALS. Letter count ignores spaces.
 * Preserves accents/diacritics (é, ñ, ä, ß, …).
 */
export function normalizeGeneratedListWord(
  word: string,
  maxLetterLen?: number,
  language?: string
): string {
  const spaced = normalizePuzzleText(String(word || ''))
    .trim()
    .replace(/([a-zà-öø-ÿ])([A-ZÀ-ÖØ-Þ])/g, '$1 $2')
    .replace(/([A-ZÀ-ÖØ-Þ]+)([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ])/g, '$1 $2');
  const upper = localeUpperCase(spaced, language);
  const cleaned = segmentGraphemes(upper)
    .map((g) => (isLetterGrapheme(g) || g === ' ' || g === '-' ? g : ' '))
    .join('')
    .replace(/[\s-]+/g, ' ')
    .trim();
  const letters = segmentGraphemes(cleaned).filter(isLetterGrapheme);
  if (letters.length < 2) return '';
  if (typeof maxLetterLen === 'number' && letters.length > Math.max(2, maxLetterLen)) return '';
  return cleaned;
}

export function normalizeGeneratedWordList(
  words: string[],
  maxLetterLen?: number,
  language?: string
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const display = normalizeGeneratedListWord(w, maxLetterLen, language);
    if (!display) continue;
    const key = unicodeFoldKey(
      segmentGraphemes(display).filter(isLetterGrapheme).join(''),
      language
    );
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}
