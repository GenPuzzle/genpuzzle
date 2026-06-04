/**
 * Curated publishing fonts for puzzle books (Kids, Adults, Seniors, Titles).
 * Shared by UI dropdowns and PDF TTF embedding.
 */

export const PUBLISHING_FONTS = [
  'Inter',
  'Verdana',
  'Lora',
  'Courier New',
  'Arial Black',
  'Montserrat',
  'Oswald',
  'Fredoka',
  'Patrick Hand',
  'Playfair Display',
  'Arabic Typesetting',
] as const;

export type PublishingFont = (typeof PUBLISHING_FONTS)[number];

export interface PublishingFontConfig {
  /** Google Fonts CSS family name (when not a system font). */
  googleFamily?: string;
  regularWeight?: number;
  boldWeight?: number;
  /** Always embed the bold/heavy variant (e.g. Arial Black). */
  alwaysBold?: boolean;
  /** Windows system font filenames in %WINDIR%/Fonts. */
  windows?: { regular: string; bold?: string };
  /** Stable gstatic TTF URLs (latin, normal). */
  ttfUrl?: { regular: string; bold: string };
}

export const FONT_REGISTRY: Record<PublishingFont, PublishingFontConfig> = {
  Inter: {
    googleFamily: 'Inter',
    regularWeight: 400,
    boldWeight: 700,
    ttfUrl: {
      regular:
        'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf',
      bold: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf',
    },
  },
  Verdana: { windows: { regular: 'verdana.ttf', bold: 'verdanab.ttf' } },
  Lora: {
    googleFamily: 'Lora',
    regularWeight: 400,
    boldWeight: 700,
    ttfUrl: {
      regular: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787weuyJG.ttf',
      bold: 'https://fonts.gstatic.com/s/lora/v37/0QI6MX1D_JOuGQbT0gvTJPa787z5vCJG.ttf',
    },
  },
  'Courier New': { windows: { regular: 'cour.ttf', bold: 'courbd.ttf' } },
  'Arial Black': { windows: { regular: 'ariblk.ttf', bold: 'ariblk.ttf' }, alwaysBold: true },
  Montserrat: {
    googleFamily: 'Montserrat',
    regularWeight: 400,
    boldWeight: 700,
    ttfUrl: {
      regular:
        'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf',
      bold: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf',
    },
  },
  Oswald: {
    googleFamily: 'Oswald',
    regularWeight: 400,
    boldWeight: 700,
    ttfUrl: {
      regular: 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvgUE.ttf',
      bold: 'https://fonts.gstatic.com/s/oswald/v57/TK3_WkUHHAIjg75cFRf3bXL8LICs1xZogUE.ttf',
    },
  },
  Fredoka: {
    googleFamily: 'Fredoka',
    regularWeight: 400,
    boldWeight: 600,
    ttfUrl: {
      regular:
        'https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3O8SLMFg.ttf',
      bold: 'https://fonts.gstatic.com/s/fredoka/v17/X7nP4b87HvSqjb_WIi2yDCRwoQ_k7367_B-i2yQag0-mac3OLyXMFg.ttf',
    },
  },
  'Patrick Hand': {
    googleFamily: 'Patrick Hand',
    regularWeight: 400,
    boldWeight: 400,
    ttfUrl: {
      regular: 'https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf',
      bold: 'https://fonts.gstatic.com/s/patrickhand/v25/LDI1apSQOAYtSuYWp8ZhfYeMWQ.ttf',
    },
  },
  'Playfair Display': {
    googleFamily: 'Playfair Display',
    regularWeight: 400,
    boldWeight: 700,
    ttfUrl: {
      regular:
        'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQ.ttf',
      bold: 'https://fonts.gstatic.com/s/playfairdisplay/v40/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKeiukDQ.ttf',
    },
  },
  'Arabic Typesetting': {
    windows: { regular: 'arabtype.ttf', bold: 'arabtype.ttf' },
    alwaysBold: false,
  },
};

/** Maps legacy / removed dropdown values to a publishing font. */
const LEGACY_FONT_ALIASES: Record<string, PublishingFont> = {
  'Fredoka One': 'Fredoka',
  Roboto: 'Inter',
  'Open Sans': 'Inter',
  Lato: 'Inter',
  Poppins: 'Montserrat',
  'Comic Sans MS': 'Fredoka',
  Quicksand: 'Fredoka',
  Nunito: 'Inter',
  Tahoma: 'Verdana',
  'Trebuchet MS': 'Verdana',
  Georgia: 'Lora',
  Merriweather: 'Lora',
};

export function isPublishingFont(fontFamily: string): fontFamily is PublishingFont {
  return (PUBLISHING_FONTS as readonly string[]).includes(fontFamily);
}

export function normalizeFontFamily(fontFamily: string): PublishingFont {
  const trimmed = (fontFamily || 'Inter').trim();
  if (isPublishingFont(trimmed)) return trimmed;
  return LEGACY_FONT_ALIASES[trimmed] ?? 'Inter';
}

/** Whether UI/PDF should request the bold TTF variant. */
export function isBoldFontWeight(fontWeight: string | number | boolean | undefined): boolean {
  return (
    fontWeight === true ||
    fontWeight === 'bold' ||
    fontWeight === 'black' ||
    (typeof fontWeight === 'number' && fontWeight >= 700)
  );
}

export function shouldEmbedBoldVariant(fontFamily: string, bold: boolean): boolean {
  const normalized = normalizeFontFamily(fontFamily);
  const config = FONT_REGISTRY[normalized];
  if (config.alwaysBold) return true;
  return bold;
}

export function getEmbeddingWeight(fontFamily: string, bold: boolean): number {
  const normalized = normalizeFontFamily(fontFamily);
  const config = FONT_REGISTRY[normalized];
  const useBold = shouldEmbedBoldVariant(normalized, bold);
  if (useBold) return config.boldWeight ?? 700;
  return config.regularWeight ?? 400;
}

/** Google Fonts stylesheet for UI preview (system fonts omitted). */
export const PUBLISHING_FONTS_GOOGLE_CSS_URL =
  'https://fonts.googleapis.com/css2?' +
  [
    'family=Inter:wght@400;700',
    'family=Lora:wght@400;700',
    'family=Montserrat:wght@400;700',
    'family=Oswald:wght@400;700',
    'family=Fredoka:wght@400;600',
    'family=Patrick+Hand',
    'family=Playfair+Display:wght@400;700',
  ].join('&') +
  '&display=swap';
