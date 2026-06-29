import type { HeaderAssemblySettings } from './types';
import { normalizeHeaderAssemblySettings } from './types';

const ROW_GAP_PT = 6;
const SUBTITLE_PAD_PT = 8;

export function measureHeaderAssemblyHeightPt(
  settings: HeaderAssemblySettings,
  titleFontSizePt: number,
  subtitleFontSizePt: number,
  subtitleLineCount: number,
  hasNumber: boolean,
  titleToSubtitleGapPt: number = ROW_GAP_PT
): number {
  const s = normalizeHeaderAssemblySettings(settings);
  const titleRowPt = Math.max(28, titleFontSizePt * 1.35);
  const numberRowPt = hasNumber ? titleRowPt : 0;
  const rowPt = Math.max(titleRowPt, numberRowPt);

  let heightPt = rowPt + 4;

  const lines = Math.max(0, subtitleLineCount);
  if (lines > 0) {
    const linePt = subtitleFontSizePt * 1.3;
    heightPt += Math.max(0, titleToSubtitleGapPt) + lines * linePt + SUBTITLE_PAD_PT * 2;
    if (s.subtitle.shapeId === 'ribbon-notch') heightPt += 6;
  }

  if (s.number.shapeId === 'ribbon-notch' && hasNumber) heightPt += 4;
  if (s.title.shapeId === 'chevron') heightPt += 2;

  return heightPt;
}
