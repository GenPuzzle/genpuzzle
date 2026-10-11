import {
  COLORING_PRINT_PPI,
  rasterizeSvgToPrintPngDataUrl,
} from '@/lib/coloring-enhance';
import type { ResolvedElement } from './types';

export { COLORING_PRINT_PPI };
export { previewImageHref } from './preview-image';

/** Replace vector sources with 300 DPI PNGs sized to the placed box. */
export async function prepareResolvedImagesForPrint(elements: ResolvedElement[]): Promise<ResolvedElement[]> {
  const next: ResolvedElement[] = [];
  for (const el of elements) {
    if (el.kind !== 'image' || !el.svg) {
      next.push(el);
      continue;
    }
    try {
      const href = await rasterizeSvgToPrintPngDataUrl(el.svg, el.w, el.h, COLORING_PRINT_PPI, {
        background: 'transparent',
        punchWhite: true,
      });
      next.push({ ...el, href, svg: undefined });
    } catch {
      next.push(el);
    }
  }
  return next;
}
