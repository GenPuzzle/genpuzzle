import type { DocumentPage, TextModuleSettings } from '@/lib/document-model';
import type { WordSearchSettings } from '@/lib/puzzles/types';
import { addTextModuleSlide } from '@/lib/text-page-ppt-draw';
import { FlattenedBackgroundPptCache } from '@/lib/unified-background';
import { getPageDimensionsInches } from '@/lib/puzzle-layout';

export async function exportImageToPptx(
  pages: DocumentPage[],
  layoutSettings: WordSearchSettings,
  fileName = 'image-to-editable.pptx'
): Promise<void> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const prs = new PptxGenJS();
  const dims = getPageDimensionsInches(layoutSettings);
  prs.defineLayout({ name: 'GENPUZZLE_PAGE', width: dims.width, height: dims.height });
  prs.layout = 'GENPUZZLE_PAGE';
  const backgroundCache = new FlattenedBackgroundPptCache();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const settings = page.settings as TextModuleSettings;
    await addTextModuleSlide(
      prs,
      settings,
      layoutSettings,
      i,
      backgroundCache,
      page.name,
      undefined,
      true,
      page.moduleType
    );
  }

  await prs.writeFile({ fileName });
}
