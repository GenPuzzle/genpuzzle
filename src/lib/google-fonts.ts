/**
 * Font management for PDF exports (client-safe fallbacks).
 */

import { StandardFonts } from 'pdf-lib';
import { PUBLISHING_FONTS, normalizeFontFamily } from './publishing-fonts';

/**
 * Standard PDF font fallback when custom TTF embedding fails.
 */
export function getFallbackStandardFont(fontFamily: string, bold: boolean = false): StandardFonts {
  const family = normalizeFontFamily(fontFamily).toLowerCase();

  if (/courier/.test(family)) {
    return bold ? StandardFonts.CourierBold : StandardFonts.Courier;
  }

  if (/lora|playfair/.test(family)) {
    return bold ? StandardFonts.TimesRomanBold : StandardFonts.TimesRoman;
  }

  if (/arial black|oswald|fredoka|montserrat/.test(family)) {
    return StandardFonts.HelveticaBold;
  }

  if (/verdana|inter|patrick/.test(family)) {
    return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
  }

  return bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
}

export function getCustomEmbeddableFonts(): string[] {
  return [...PUBLISHING_FONTS];
}
