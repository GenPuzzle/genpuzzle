/**
 * Professional text styles. Renderers keep real text — they do not outline or flatten it.
 */

export const TEXT_EFFECT_STYLES = [
  'none',
  'shadow',
  'soft-shadow',
  'glow',
  'outline',
  'bevel',
  'extrude',
  'perspective',
] as const;

export type TextEffectStyle = (typeof TEXT_EFFECT_STYLES)[number];

export const TEXT_EFFECT_LABELS: Record<TextEffectStyle, string> = {
  none: 'None',
  shadow: 'Shadow',
  'soft-shadow': 'Soft shadow',
  glow: 'Glow',
  outline: 'Outline',
  bevel: 'Bevel',
  extrude: '3D extrude',
  perspective: '3D perspective',
};

export interface TextEffect {
  style: TextEffectStyle;
}

export function isTextEffectStyle(value: unknown): value is TextEffectStyle {
  return TEXT_EFFECT_STYLES.includes(value as TextEffectStyle);
}

export function normalizeTextEffect(raw: unknown): TextEffectStyle {
  return isTextEffectStyle(raw) ? raw : 'none';
}

export function cssTextEffect(style: TextEffectStyle | undefined, color: string): {
  textShadow?: string;
  WebkitTextStroke?: string;
} {
  if (!style || style === 'none') return {};
  if (style === 'outline') {
    return { WebkitTextStroke: '1.1px #0f172a', textShadow: 'none' };
  }
  if (style === 'shadow') {
    return { textShadow: '2px 2px 0 rgba(15,23,42,0.45)' };
  }
  if (style === 'soft-shadow') {
    return { textShadow: '0 3px 8px rgba(15,23,42,0.35)' };
  }
  if (style === 'glow') {
    return { textShadow: `0 0 6px ${color}, 0 0 14px ${color}` };
  }
  if (style === 'bevel') {
    return {
      textShadow:
        '0 1px 0 #ffffff, 0 -1px 0 rgba(15,23,42,0.35), 1px 1px 0 rgba(15,23,42,0.2)',
    };
  }
  if (style === 'extrude') {
    return {
      textShadow:
        '1px 1px 0 #334155, 2px 2px 0 #334155, 3px 3px 0 #1e293b, 4px 4px 0 #0f172a',
    };
  }
  return {
    textShadow: '3px 5px 0 rgba(15,23,42,0.28), 6px 10px 0 rgba(15,23,42,0.12)',
  };
}

/** Extra copies drawn behind the live text (PDF / PPTX). Same glyphs, still editable. */
export function textEffectLayers(
  style: TextEffectStyle | undefined
): Array<{ dx: number; dy: number; color: string; opacity: number }> {
  if (!style || style === 'none' || style === 'outline') return [];
  if (style === 'shadow') return [{ dx: 1.4, dy: 1.4, color: '#0f172a', opacity: 0.4 }];
  if (style === 'soft-shadow') return [{ dx: 0.6, dy: 1.8, color: '#0f172a', opacity: 0.28 }];
  if (style === 'glow') {
    return [
      { dx: 0, dy: 0, color: '#38bdf8', opacity: 0.35 },
      { dx: 0.8, dy: 0, color: '#38bdf8', opacity: 0.2 },
    ];
  }
  if (style === 'bevel') {
    return [
      { dx: 0, dy: -0.6, color: '#ffffff', opacity: 0.7 },
      { dx: 0.6, dy: 0.6, color: '#0f172a', opacity: 0.28 },
    ];
  }
  if (style === 'extrude') {
    return [
      { dx: 1, dy: 1, color: '#334155', opacity: 1 },
      { dx: 2, dy: 2, color: '#1e293b', opacity: 1 },
      { dx: 3, dy: 3, color: '#0f172a', opacity: 1 },
    ];
  }
  return [
    { dx: 2.2, dy: 3.4, color: '#0f172a', opacity: 0.22 },
    { dx: 4.4, dy: 6.8, color: '#0f172a', opacity: 0.1 },
  ];
}
