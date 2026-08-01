/** Normalize CSS color strings (#hex, rgb(), rgba()) to #RRGGBB for export. */
export function normalizeCssColorToHex(
  color: string | undefined,
  fallback = '#1f2937'
): string {
  if (!color) return fallback;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent') return fallback;

  if (trimmed.startsWith('#')) {
    const clean = trimmed.slice(1);
    if (clean.length === 6 && /^[0-9a-f]{6}$/i.test(clean)) {
      return `#${clean}`;
    }
    if (clean.length === 3 && /^[0-9a-f]{3}$/i.test(clean)) {
      return `#${clean[0]}${clean[0]}${clean[1]}${clean[1]}${clean[2]}${clean[2]}`;
    }
  }

  const rgbMatch = trimmed.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch.slice(1, 4).map((part) => {
      const value = Number.parseFloat(part);
      return Number.isFinite(value) ? Math.max(0, Math.min(255, Math.round(value))) : 0;
    });
    return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  return fallback;
}

/** pptxgenjs expects 6-char hex without # */
export function toPptColorHex(color: string | undefined, fallback = '1F2937'): string {
  const normalized = normalizeCssColorToHex(color, `#${fallback}`);
  return normalized.replace(/^#/, '').toUpperCase();
}
