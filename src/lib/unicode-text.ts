/**
 * Shared Unicode helpers for every puzzle module.
 *
 * Rules every puzzle type follows:
 * - Text is stored NFC-normalized, so "é" is one code point everywhere in the pipeline
 *   (input → model → .gpj → generator → canvas → PDF → PPTX).
 * - One visible character is one grapheme cluster, which is one grid cell or one tile.
 * - Accents are part of the letter. É, Ñ, Ä and ß are their own letters, never folded to
 *   E, N, A or SS. `transliterateToAscii` exists for the rare puzzle rule that explicitly
 *   asks for transliteration and is never applied as a cleanup step.
 */

import { normalizeFontFamily, normalizeFontFamilyName } from './publishing-fonts';

const BASE_LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Letters beyond A–Z that each supported language writes with. */
const LANGUAGE_EXTRA_LETTERS: Record<string, string> = {
  en: '',
  fr: 'ÀÂÆÇÉÈÊËÎÏÔŒÙÛÜŸ',
  de: 'ÄÖÜß',
  es: 'ÁÉÍÓÚÜÑ',
  it: 'ÀÈÉÌÍÎÒÓÙÚ',
  pt: 'ÁÂÃÀÇÉÊÍÓÔÕÚÜ',
  nl: 'ÄËÏÖÜ',
  pl: 'ĄĆĘŁŃÓŚŹŻ',
  tr: 'ÇĞİÖŞÜ',
};

/** Every non-ASCII letter the shipped languages can produce. Used to probe font coverage. */
export const EXTENDED_PUZZLE_LETTERS = Array.from(
  new Set(Object.values(LANGUAGE_EXTRA_LETTERS).join('') + 'ẞ')
).join('');

const LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en',
  eng: 'en',
  english: 'en',
  fr: 'fr',
  fra: 'fr',
  fre: 'fr',
  french: 'fr',
  francais: 'fr',
  'français': 'fr',
  de: 'de',
  ger: 'de',
  deu: 'de',
  german: 'de',
  deutsch: 'de',
  es: 'es',
  spa: 'es',
  spanish: 'es',
  espanol: 'es',
  'español': 'es',
  it: 'it',
  ita: 'it',
  italian: 'it',
  italiano: 'it',
  pt: 'pt',
  por: 'pt',
  portuguese: 'pt',
  portugues: 'pt',
  'português': 'pt',
  nl: 'nl',
  dutch: 'nl',
  nederlands: 'nl',
  pl: 'pl',
  polish: 'pl',
  polski: 'pl',
  tr: 'tr',
  turkish: 'tr',
  'türkçe': 'tr',
  ar: 'ar',
  arabic: 'ar',
};

/**
 * Map a UI language name or code to a BCP-47 locale for case mapping.
 * Unknown languages return 'und' so callers can tell "not configured" from "English".
 */
export function resolvePuzzleLocale(language: string | undefined | null): string {
  const raw = String(language ?? '').trim().toLowerCase();
  if (!raw) return 'und';
  const mapped = LOCALE_BY_LANGUAGE[raw];
  if (mapped) return mapped;
  const base = raw.split(/[-_]/)[0] ?? '';
  return LOCALE_BY_LANGUAGE[base] ?? 'und';
}

function caseLocale(language: string | undefined | null): string | undefined {
  const locale = resolvePuzzleLocale(language);
  return locale === 'und' ? undefined : locale;
}

/**
 * The letters a language codes or fills with: base Latin first, then its own
 * accented letters. The list can be longer than 26 and callers must not assume 26.
 */
export function getLanguageLetterAlphabet(language: string | undefined | null): string[] {
  const locale = resolvePuzzleLocale(language);
  const extras = LANGUAGE_EXTRA_LETTERS[locale] ?? '';
  const seen = new Set<string>();
  const out: string[] = [];
  for (const letter of [...BASE_LATIN, ...Array.from(extras)]) {
    if (seen.has(letter)) continue;
    seen.add(letter);
    out.push(letter);
  }
  return out;
}

/**
 * Canonical storage form for any puzzle text: NFC so accents are single code points
 * in the model, the .gpj file, the canvas, the PDF, and the PPTX.
 */
export function normalizePuzzleText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.normalize('NFC');
}

type SegmenterLike = { segment: (input: string) => Iterable<{ segment: string }> };

let graphemeSegmenter: SegmenterLike | null | undefined;

function getGraphemeSegmenter(): SegmenterLike | null {
  if (graphemeSegmenter !== undefined) return graphemeSegmenter;
  const intl = Intl as unknown as {
    Segmenter?: new (locale?: string, options?: unknown) => SegmenterLike;
  };
  try {
    graphemeSegmenter = intl.Segmenter
      ? new intl.Segmenter(undefined, { granularity: 'grapheme' })
      : null;
  } catch {
    graphemeSegmenter = null;
  }
  return graphemeSegmenter;
}

/** Base character plus any combining marks, joiners, variation selectors, or flag pair. */
const GRAPHEME_FALLBACK =
  /(?:\p{RI}\p{RI}|\P{M}(?:\p{M}|\u200D\P{M}|[\uFE00-\uFE0F])*)/gu;

/**
 * Split text into visible characters. "ñ" written as n + U+0303 stays one cell and
 * astral characters never split into broken halves.
 */
export function segmentGraphemes(value: string): string[] {
  const text = normalizePuzzleText(value);
  if (!text) return [];
  const segmenter = getGraphemeSegmenter();
  if (segmenter) {
    const out: string[] = [];
    for (const part of segmenter.segment(text)) out.push(part.segment);
    return out;
  }
  return text.match(GRAPHEME_FALLBACK) ?? Array.from(text);
}

/** Number of visible characters — the count that matters for grids and answer blanks. */
export function graphemeCount(value: string): number {
  return segmentGraphemes(value).length;
}

/** Visible character at an index, or '' when out of range. */
export function graphemeAt(value: string, index: number): string {
  const parts = segmentGraphemes(value);
  return index >= 0 && index < parts.length ? parts[index]! : '';
}

/** Slice by visible characters instead of UTF-16 units. */
export function sliceGraphemes(value: string, start: number, end?: number): string {
  return segmentGraphemes(value).slice(start, end).join('');
}

const SHARP_S_SENTINEL = '\u0000';

/**
 * Uppercase without losing a letter. ß keeps its identity instead of expanding to SS,
 * and Turkish keeps the dotted/dotless i distinction through the locale.
 */
export function localeUpperCase(
  value: string,
  language?: string | null,
  options: { preserveSharpS?: boolean } = {}
): string {
  const text = normalizePuzzleText(value);
  if (!text) return '';
  const locale = caseLocale(language);
  const upper = (input: string) =>
    locale ? input.toLocaleUpperCase(locale) : input.toUpperCase();
  if (options.preserveSharpS === false) return upper(text).normalize('NFC');
  return upper(text.replace(/[ß\u1E9E]/g, SHARP_S_SENTINEL))
    .split(SHARP_S_SENTINEL)
    .join('ß')
    .normalize('NFC');
}

/** Lowercase using the language's own casing rules. */
export function localeLowerCase(value: string, language?: string | null): string {
  const text = normalizePuzzleText(value);
  if (!text) return '';
  const locale = caseLocale(language);
  return (locale ? text.toLocaleLowerCase(locale) : text.toLowerCase()).normalize('NFC');
}

/** Apply the document's letter-case setting without damaging any letter. */
export function applyLetterCase(
  value: string,
  letterCase: 'upper' | 'lower' | undefined,
  language?: string | null
): string {
  return letterCase === 'lower'
    ? localeLowerCase(value, language)
    : localeUpperCase(value, language);
}

/** True when two strings are the same text once normalized. É equals É, never E. */
export function unicodeEqual(a: string, b: string): boolean {
  return normalizePuzzleText(a) === normalizePuzzleText(b);
}

/**
 * Duplicate-detection key: normalized and case-folded, accents intact.
 * "Café" and "CAFÉ" collide; "Café" and "Cafe" stay two different words.
 */
export function unicodeFoldKey(value: string, language?: string | null): string {
  return localeUpperCase(value, language);
}

function baseOf(grapheme: string): string {
  return normalizePuzzleText(grapheme).replace(/[\p{M}\u200D\uFE00-\uFE0F]/gu, '');
}

/** True when the visible character's base is a Unicode letter. */
export function isLetterGrapheme(grapheme: string): boolean {
  const base = baseOf(grapheme);
  return base.length > 0 && /^\p{L}/u.test(base);
}

/** True when the visible character's base is a Unicode digit. */
export function isDigitGrapheme(grapheme: string): boolean {
  const base = baseOf(grapheme);
  return base.length > 0 && /^\p{N}/u.test(base);
}

export interface LettersOnlyOptions {
  /** Keep digits alongside letters. */
  allowNumbers?: boolean;
  /** Extra visible characters to keep, e.g. ' ' or '-'. */
  keep?: string;
}

/** Keep every Unicode letter (accents included) and drop punctuation. */
export function lettersOnly(value: string, options: LettersOnlyOptions = {}): string {
  const keep = new Set(options.keep ? segmentGraphemes(options.keep) : []);
  return segmentGraphemes(value)
    .filter(
      (g) =>
        isLetterGrapheme(g) ||
        (options.allowNumbers === true && isDigitGrapheme(g)) ||
        keep.has(g)
    )
    .join('');
}

/** Distinct visible letters of a text, in first-seen order. */
export function uniqueLetterGraphemes(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of segmentGraphemes(value)) {
    if (!isLetterGrapheme(g) || seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

/** Distinct visible characters of a text, in first-seen order. */
export function uniqueGraphemes(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of segmentGraphemes(value)) {
    if (seen.has(g)) continue;
    seen.add(g);
    out.push(g);
  }
  return out;
}

/** True when the text uses a letter outside plain A–Z, so the font needs Latin Extended. */
export function textNeedsExtendedLatin(value: string): boolean {
  return segmentGraphemes(value).some((g) => isLetterGrapheme(g) && !/^[A-Za-z]$/.test(g));
}

/** Publishing fonts whose shipped files cover the accented Latin letters. */
const EXTENDED_LATIN_FAMILIES = new Set([
  'Arial',
  'Arial Black',
  'Verdana',
  'Courier New',
  'Lora',
  'Montserrat',
  'Oswald',
  'Playfair Display',
]);

/**
 * Keep the requested font when it can draw the sample, otherwise fall back to a family
 * that can. Display faces such as Grow Year ship without accented glyphs and would
 * print blanks, which reads as a dropped accent.
 */
export function resolveUnicodeFontFamily(requested: string, sample: string): string {
  const family = requested || 'Arial';
  if (!textNeedsExtendedLatin(sample)) return family;
  const first = normalizeFontFamilyName(family) || family;
  if (EXTENDED_LATIN_FAMILIES.has(first)) return family;
  const normalized = normalizeFontFamily(first);
  return EXTENDED_LATIN_FAMILIES.has(normalized) ? normalized : 'Arial';
}

/**
 * Explicit, opt-in ASCII folding. Only call this where a puzzle rule names
 * transliteration as the requirement; never as a cleanup step.
 */
export function transliterateToAscii(value: string): string {
  return normalizePuzzleText(value)
    .replace(/ß/g, 'ss')
    .replace(/\u1E9E/g, 'SS')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/ø/g, 'o')
    .replace(/Ø/g, 'O')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC');
}

/**
 * Map a letter grapheme to its A–Z coding key for Codewords-style number ciphers.
 * Display keeps the accent (é stays é on the grid); only the code/key uses the base
 * (é, è, ê, ë → E). Digraphs like æ/œ/ß collapse to their first Latin letter.
 */
export function baseCodeLetter(grapheme: string, language?: string | null): string {
  const upper = localeUpperCase(normalizePuzzleText(grapheme), language);
  const first = segmentGraphemes(upper)[0] ?? '';
  if (!first) return '';
  if (/^[A-Z]$/.test(first)) return first;
  // German sharp S and ligatures: one cell → first resulting Latin letter.
  const folded = transliterateToAscii(first).toUpperCase();
  const base = folded.match(/[A-Z]/)?.[0] ?? '';
  return base;
}

/** Sort comparator that orders accented letters the way the language expects. */
export function localeCompareText(a: string, b: string, language?: string | null): number {
  const locale = caseLocale(language);
  return normalizePuzzleText(a).localeCompare(normalizePuzzleText(b), locale);
}
