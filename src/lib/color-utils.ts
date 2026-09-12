/**
 * Color helpers — supports #RGB, #RRGGBB, #RRGGBBAA, and rgba().
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  /** 0–255 */
  a: number;
}

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function expand3(hex: string): string {
  return hex
    .split('')
    .map((c) => c + c)
    .join('');
}

/** Parse any common CSS/hex color into RGBA (a defaults to 255). */
export function parseRgba(input: string | undefined | null, fallback = '#000000'): RgbaColor {
  const raw = (input || fallback).trim();
  if (!raw) return parseRgba(fallback);

  const rgbaMatch = raw.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i
  );
  if (rgbaMatch) {
    const r = clampByte(Number(rgbaMatch[1]));
    const g = clampByte(Number(rgbaMatch[2]));
    const b = clampByte(Number(rgbaMatch[3]));
    const aRaw = rgbaMatch[4];
    const a =
      aRaw === undefined
        ? 255
        : Number(aRaw) <= 1
          ? clampByte(Number(aRaw) * 255)
          : clampByte(Number(aRaw));
    return { r, g, b, a };
  }

  const cleaned = raw.replace(/^#/, '');
  if (/^[a-f\d]{3}$/i.test(cleaned)) {
    const full = expand3(cleaned);
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: 255,
    };
  }
  if (/^[a-f\d]{4}$/i.test(cleaned)) {
    const full = expand3(cleaned);
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
      a: parseInt(full.slice(6, 8), 16),
    };
  }
  if (/^[a-f\d]{6}$/i.test(cleaned)) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
      a: 255,
    };
  }
  if (/^[a-f\d]{8}$/i.test(cleaned)) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
      a: parseInt(cleaned.slice(6, 8), 16),
    };
  }

  if (raw !== fallback) return parseRgba(fallback);
  return { r: 0, g: 0, b: 0, a: 255 };
}

function toHex2(n: number): string {
  return clampByte(n).toString(16).padStart(2, '0').toUpperCase();
}

/** #RRGGBB when opaque, otherwise #RRGGBBAA. */
export function formatRgbaHex(color: RgbaColor): string {
  const rgb = `#${toHex2(color.r)}${toHex2(color.g)}${toHex2(color.b)}`;
  if (clampByte(color.a) >= 255) return rgb;
  return `${rgb}${toHex2(color.a)}`;
}

/** Always #RRGGBB (strips alpha) — for APIs that reject alpha. */
export function formatRgbHex(color: RgbaColor): string {
  return `#${toHex2(color.r)}${toHex2(color.g)}${toHex2(color.b)}`;
}

/** CSS-friendly string (hex8 or hex6). */
export function toCssColor(input: string | undefined | null, fallback = '#000000'): string {
  return formatRgbaHex(parseRgba(input, fallback));
}

/** Alpha as 0–1. */
export function getAlpha01(input: string | undefined | null, fallback = 1): number {
  if (!input) return fallback;
  return parseRgba(input).a / 255;
}

/** 6-char hex without # (for pptxgenjs). */
export function toHex6(input: string | undefined | null, fallback = '000000'): string {
  const c = parseRgba(input, `#${fallback.replace(/^#/, '')}`);
  return `${toHex2(c.r)}${toHex2(c.g)}${toHex2(c.b)}`;
}

export function rgbaToCss(color: RgbaColor): string {
  const a = clampByte(color.a) / 255;
  if (a >= 0.999) return `rgb(${color.r}, ${color.g}, ${color.b})`;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.round(a * 1000) / 1000})`;
}
