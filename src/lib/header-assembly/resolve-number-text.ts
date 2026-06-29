import type { HeaderNumberConfig } from './types';

export function resolveHeaderNumberTextStyle(
  number: HeaderNumberConfig,
  titleFontSizePt: number,
  titleFontFamily: string
): { fontSizePt: number; fontFamily: string; textColor: string } {
  return {
    fontSizePt: number.fontSizePt > 0 ? number.fontSizePt : titleFontSizePt,
    fontFamily: number.fontFamily || titleFontFamily,
    textColor: number.textColor || '#ffffff',
  };
}
