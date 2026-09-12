/** Parse word list from comma-separated (horizontal) or newline-separated (vertical) input. */
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
 */
export function normalizeGeneratedListWord(word: string, maxLetterLen?: number): string {
  const spaced = String(word || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  const cleaned = spaced
    .replace(/[ßẞ]/g, '\u0000')
    .toUpperCase()
    .replace(/\u0000/g, 'ß')
    .replace(/[^\p{L}\s-]/gu, ' ')
    .replace(/[\s-]+/g, ' ')
    .trim();
  const letters = cleaned.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return '';
  if (typeof maxLetterLen === 'number' && letters.length > Math.max(2, maxLetterLen)) return '';
  return cleaned;
}

export function normalizeGeneratedWordList(words: string[], maxLetterLen?: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const display = normalizeGeneratedListWord(w, maxLetterLen);
    if (!display) continue;
    const key = display.replace(/[^\p{L}]/gu, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}
