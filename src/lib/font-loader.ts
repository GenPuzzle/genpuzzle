/**
 * Loads TTF bytes for pdf-lib embedding (browser + Node).
 * Google Fonts: direct CDN fetch. System fonts (Verdana, Courier New, Arial Black): Node fs or /api/font-buffer.
 */

import {
  FONT_REGISTRY,
  normalizeFontFamily,
  shouldEmbedBoldVariant,
  getEmbeddingWeight,
  type PublishingFont,
} from './publishing-fonts';

const fontCache = new Map<string, Uint8Array>();

const GOOGLE_CSS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const isNode = typeof window === 'undefined';

function getWindowsFontsDir(): string {
  const windir = process.env.WINDIR || 'C:\\Windows';
  return `${windir}\\Fonts`;
}

function loadWindowsFontFile(fileName: string): Uint8Array | null {
  if (!isNode) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const absolutePath = path.join(getWindowsFontsDir(), fileName);
    if (fs.existsSync(absolutePath)) {
      const buffer = fs.readFileSync(absolutePath);
      return new Uint8Array(buffer);
    }
  } catch (error) {
    console.warn(`Error loading Windows font "${fileName}":`, error);
  }
  return null;
}

function extractTtfUrlFromCssBlock(block: string): string | null {
  const match = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  return match?.[1] ?? null;
}

async function fetchTtfFromUrl(url: string, cacheKey: string): Promise<Uint8Array | null> {
  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey)!;
  }
  try {
    const fontRes = await fetch(url);
    if (!fontRes.ok) return null;
    const bytes = new Uint8Array(await fontRes.arrayBuffer());
    fontCache.set(cacheKey, bytes);
    return bytes;
  } catch (error) {
    console.warn(`Error fetching TTF from ${url}:`, error);
    return null;
  }
}

async function fetchGoogleFontTtf(googleFamily: string, weight: number): Promise<Uint8Array | null> {
  const cacheKey = `google:${googleFamily}:${weight}`;
  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey)!;
  }

  try {
    const familyParam = encodeURIComponent(googleFamily).replace(/%20/g, '+');
    const cssUrl = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': GOOGLE_CSS_UA } });
    if (!cssRes.ok) return null;

    const css = await cssRes.text();
    const blocks = css.split('@font-face').slice(1);

    for (const block of blocks) {
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      if (weightMatch && Number(weightMatch[1]) === weight) {
        const ttfUrl = extractTtfUrlFromCssBlock(block);
        if (ttfUrl) {
          const fontRes = await fetch(ttfUrl);
          if (!fontRes.ok) return null;
          const bytes = new Uint8Array(await fontRes.arrayBuffer());
          fontCache.set(cacheKey, bytes);
          return bytes;
        }
      }
    }

    const fallbackUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)?.[1];
    if (fallbackUrl) {
      const fontRes = await fetch(fallbackUrl);
      if (!fontRes.ok) return null;
      const bytes = new Uint8Array(await fontRes.arrayBuffer());
      fontCache.set(cacheKey, bytes);
      return bytes;
    }
  } catch (error) {
    console.warn(`Error fetching Google font "${googleFamily}" weight ${weight}:`, error);
  }

  return null;
}

function loadFromWindowsConfig(normalized: PublishingFont, embedBold: boolean): Uint8Array | null {
  const windows = FONT_REGISTRY[normalized].windows;
  if (!windows) return null;
  const fileName = embedBold && windows.bold ? windows.bold : windows.regular;
  return loadWindowsFontFile(fileName);
}

async function fetchSystemFontViaApi(fontFamily: string, bold: boolean): Promise<Uint8Array | null> {
  if (isNode) return null;
  try {
    const params = new URLSearchParams({
      family: fontFamily,
      bold: String(bold),
    });
    const res = await fetch(`/api/font-buffer?${params.toString()}`);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    console.warn(`Error fetching system font "${fontFamily}" via API:`, error);
    return null;
  }
}

export async function getFontBuffer(fontFamily: string, bold: boolean = false): Promise<Uint8Array | null> {
  const normalized = normalizeFontFamily(fontFamily);
  const embedBold = shouldEmbedBoldVariant(normalized, bold);
  const cacheKey = `${normalized}:${embedBold ? 'bold' : 'regular'}`;

  if (fontCache.has(cacheKey)) {
    return fontCache.get(cacheKey)!;
  }

  const config = FONT_REGISTRY[normalized];

  const windowsBuffer = loadFromWindowsConfig(normalized, embedBold);
  if (windowsBuffer) {
    fontCache.set(cacheKey, windowsBuffer);
    return windowsBuffer;
  }

  if (!isNode && config.windows) {
    const apiBuffer = await fetchSystemFontViaApi(normalized, embedBold);
    if (apiBuffer) {
      fontCache.set(cacheKey, apiBuffer);
      return apiBuffer;
    }
  }

  if (config.ttfUrl) {
    const url = embedBold ? config.ttfUrl.bold : config.ttfUrl.regular;
    const directBuffer = await fetchTtfFromUrl(url, `direct:${url}`);
    if (directBuffer) {
      fontCache.set(cacheKey, directBuffer);
      return directBuffer;
    }
  }

  if (config.googleFamily) {
    const weight = getEmbeddingWeight(normalized, bold);
    const googleBuffer = await fetchGoogleFontTtf(config.googleFamily, weight);
    if (googleBuffer) {
      fontCache.set(cacheKey, googleBuffer);
      return googleBuffer;
    }
  }

  return null;
}
