import type { CanvasFormatTarget } from './canvas-native-format';
import { computeHeaderAssemblyRects } from './header-assembly/layout-rects';
import type {
  UnifiedHeaderAssemblyBlock,
  UnifiedSubtitleBlock,
  UnifiedTitleBlock,
} from './word-search-page-layout';

export interface CanvasHitBox {
  target: CanvasFormatTarget;
  label: string;
  topPt: number;
  leftPt: number;
  widthPt: number;
  heightPt: number;
}

export function headerPartHitBoxes(input: {
  headerAssembly?: UnifiedHeaderAssemblyBlock | null;
  title?: Pick<UnifiedTitleBlock, 'topPt' | 'fontSizePt'> | { topPt: number; fontSizePt: number } | null;
  subtitle?:
    | Pick<UnifiedSubtitleBlock, 'topPt' | 'leftPt' | 'widthPt' | 'fontSizePt' | 'wrappedLines'>
    | {
        topPt: number;
        leftPt: number;
        widthPt: number;
        fontSizePt: number;
        wrappedLines?: string[];
      }
    | null;
  numberingStyle?: 'none' | 'prefix' | 'suffix';
  pageMarginPt: number;
  pageWidthPt: number;
}): CanvasHitBox[] {
  const boxes: CanvasHitBox[] = [];
  const {
    headerAssembly,
    title,
    subtitle,
    numberingStyle = 'none',
    pageMarginPt,
    pageWidthPt,
  } = input;
  const contentW = Math.max(24, pageWidthPt - pageMarginPt * 2);

  if (headerAssembly) {
    const rects = computeHeaderAssemblyRects(headerAssembly);
    const ox = headerAssembly.leftPt;
    const oy = headerAssembly.topPt;
    if (rects.number) {
      boxes.push({
        target: 'header-number',
        label: 'Number',
        topPt: oy + rects.number.yPt,
        leftPt: ox + rects.number.xPt,
        widthPt: rects.number.wPt,
        heightPt: rects.number.hPt,
      });
    }
    if (rects.title) {
      boxes.push({
        target: 'title',
        label: 'Title',
        topPt: oy + rects.title.yPt,
        leftPt: ox + rects.title.xPt,
        widthPt: rects.title.wPt,
        heightPt: rects.title.hPt,
      });
    }
    if (rects.subtitle) {
      boxes.push({
        target: 'subtitle',
        label: 'Subtitle',
        topPt: oy + rects.subtitle.yPt,
        leftPt: ox + rects.subtitle.xPt,
        widthPt: rects.subtitle.wPt,
        heightPt: rects.subtitle.hPt,
      });
    }
    return boxes;
  }

  if (title) {
    const titleH = Math.max(title.fontSizePt * 1.25, 22);
    const numberW =
      numberingStyle === 'none'
        ? 0
        : Math.min(contentW * 0.22, Math.max(36, title.fontSizePt * 2.4));
    if (numberW > 0 && numberingStyle === 'prefix') {
      boxes.push({
        target: 'header-number',
        label: 'Number',
        topPt: title.topPt,
        leftPt: pageMarginPt,
        widthPt: numberW,
        heightPt: titleH,
      });
      boxes.push({
        target: 'title',
        label: 'Title',
        topPt: title.topPt,
        leftPt: pageMarginPt + numberW,
        widthPt: contentW - numberW,
        heightPt: titleH,
      });
    } else if (numberW > 0 && numberingStyle === 'suffix') {
      boxes.push({
        target: 'title',
        label: 'Title',
        topPt: title.topPt,
        leftPt: pageMarginPt,
        widthPt: contentW - numberW,
        heightPt: titleH,
      });
      boxes.push({
        target: 'header-number',
        label: 'Number',
        topPt: title.topPt,
        leftPt: pageMarginPt + contentW - numberW,
        widthPt: numberW,
        heightPt: titleH,
      });
    } else {
      boxes.push({
        target: 'title',
        label: 'Title',
        topPt: title.topPt,
        leftPt: pageMarginPt,
        widthPt: contentW,
        heightPt: titleH,
      });
    }
  }

  if (subtitle) {
    const lineCount = Math.max(1, subtitle.wrappedLines?.length ?? 1);
    boxes.push({
      target: 'subtitle',
      label: 'Subtitle',
      topPt: subtitle.topPt,
      leftPt: subtitle.leftPt,
      widthPt: subtitle.widthPt,
      heightPt: Math.max(subtitle.fontSizePt * 1.3 * lineCount, 18),
    });
  }

  return boxes;
}
