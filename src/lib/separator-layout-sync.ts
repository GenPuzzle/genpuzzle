/**
 * Sync separator (blank "sep") page layouts across selected separator documents,
 * with per-page text and image content variations.
 */

import type { DocumentPage, TextModuleSettings, TextPageBlock } from './document-model';
import { isSeparatorTitlePage } from './insert-separator-page';
import { createBlockId, normalizeTextPageBlock } from './text-page-blocks';

export type SeparatorTextVariation = {
  text: string;
  richTextHtml?: string;
};

export type SeparatorImageVariation = {
  imageSrc?: string;
  imageNaturalWidth?: number;
  imageNaturalHeight?: number;
};

export type SeparatorPageVariation = {
  texts: Record<string, SeparatorTextVariation>;
  images: Record<string, SeparatorImageVariation>;
};

export function listSeparatorPages(documentPages: DocumentPage[]): DocumentPage[] {
  return documentPages.filter(isSeparatorTitlePage);
}

/** Only blank separator pages (`Pg X - sep` / isSeparatorPage). */
export function listLayoutSyncPages(documentPages: DocumentPage[]): DocumentPage[] {
  return listSeparatorPages(documentPages);
}

export function separatorChapterLabel(index: number): string {
  return `Chapter ${index + 1}`;
}

export function isVariableTextBlock(block: TextPageBlock): boolean {
  return block.kind === 'title' || block.kind === 'subtitle' || block.kind === 'text';
}

export function isVariableImageBlock(block: TextPageBlock): boolean {
  return block.kind === 'image';
}

export function seedVariationFromBlocks(
  sourceBlocks: TextPageBlock[],
  targetBlocks?: TextPageBlock[] | null
): SeparatorPageVariation {
  const texts: Record<string, SeparatorTextVariation> = {};
  const images: Record<string, SeparatorImageVariation> = {};

  sourceBlocks.forEach((sourceBlock, index) => {
    const matched = targetBlocks?.[index];
    const useTarget =
      matched &&
      matched.kind === sourceBlock.kind &&
      (matched.text?.trim() || matched.imageSrc);

    if (isVariableTextBlock(sourceBlock)) {
      const from = useTarget && isVariableTextBlock(matched!) ? matched! : sourceBlock;
      texts[sourceBlock.id] = {
        text: from.text ?? '',
        richTextHtml: from.richTextHtml,
      };
    }

    if (isVariableImageBlock(sourceBlock)) {
      const from = useTarget && isVariableImageBlock(matched!) ? matched! : sourceBlock;
      images[sourceBlock.id] = {
        imageSrc: from.imageSrc,
        imageNaturalWidth: from.imageNaturalWidth,
        imageNaturalHeight: from.imageNaturalHeight,
      };
    }
  });

  return { texts, images };
}

function cloneLayoutBlock(
  block: TextPageBlock,
  variation: SeparatorPageVariation | undefined
): TextPageBlock {
  const cloned = normalizeTextPageBlock({
    ...structuredClone(block),
    id: createBlockId(block.kind),
  });

  if (isVariableTextBlock(cloned)) {
    const textVar = variation?.texts[block.id];
    if (textVar) {
      cloned.text = textVar.text;
      cloned.richTextHtml = textVar.richTextHtml;
    }
  }

  if (isVariableImageBlock(cloned)) {
    const imageVar = variation?.images[block.id];
    if (imageVar?.imageSrc) {
      cloned.imageSrc = imageVar.imageSrc;
      if (imageVar.imageNaturalWidth) cloned.imageNaturalWidth = imageVar.imageNaturalWidth;
      if (imageVar.imageNaturalHeight) cloned.imageNaturalHeight = imageVar.imageNaturalHeight;
    }
  }

  return cloned;
}

/** Build settings for one target page from a source layout + optional content variation. */
export function buildSeparatorSettingsFromLayout(
  sourceSettings: TextModuleSettings,
  variation?: SeparatorPageVariation
): TextModuleSettings {
  const sourceBlocks = (sourceSettings.blocks ?? []).map(normalizeTextPageBlock);
  const blocks = sourceBlocks.map((block) => cloneLayoutBlock(block, variation));

  return {
    ...structuredClone(sourceSettings),
    blocks,
    isSeparatorPage: true,
    textColor: sourceSettings.textColor || '#000000',
  };
}

export function collectSeparatorLayoutUpdates(
  sourceSettings: TextModuleSettings,
  targetPageIds: string[],
  variationsByPageId: Record<string, SeparatorPageVariation>
): Array<{ pageId: string; settings: TextModuleSettings }> {
  return targetPageIds.map((pageId) => ({
    pageId,
    settings: buildSeparatorSettingsFromLayout(sourceSettings, variationsByPageId[pageId]),
  }));
}
