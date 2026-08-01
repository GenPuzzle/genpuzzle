/**
 * Sync chapter title-page layout/style across chapter documents,
 * while preserving each page's title text, subtitle text, and image.
 */

import type { DocumentPage, TextModuleSettings, TextPageBlock } from './document-model';
import { isChapterTitlePage } from './insert-separator-page';
import { createBlockId, normalizeTextPageBlock } from './text-page-blocks';

const CONTENT_KINDS = new Set(['title', 'subtitle', 'image']);

function findMatchingTargetBlock(
  sourceBlock: TextPageBlock,
  targetBlocks: TextPageBlock[],
  usedIds: Set<string>
): TextPageBlock | undefined {
  const byId = targetBlocks.find((b) => b.id === sourceBlock.id && !usedIds.has(b.id));
  if (byId) return byId;
  return targetBlocks.find((b) => b.kind === sourceBlock.kind && !usedIds.has(b.id));
}

/**
 * Copy layout/style/structure from source chapter settings onto a target chapter,
 * keeping the target's title/subtitle text and image source.
 */
export function mergeChapterLayoutPreservingContent(
  sourceSettings: TextModuleSettings,
  targetSettings: TextModuleSettings
): TextModuleSettings {
  const sourceBlocks = (sourceSettings.blocks ?? []).map(normalizeTextPageBlock);
  const targetBlocks = (targetSettings.blocks ?? []).map(normalizeTextPageBlock);
  const usedIds = new Set<string>();

  const blocks = sourceBlocks.map((sourceBlock) => {
    const matched = findMatchingTargetBlock(sourceBlock, targetBlocks, usedIds);
    if (matched) usedIds.add(matched.id);

    const next = normalizeTextPageBlock({
      ...structuredClone(sourceBlock),
      id: matched?.id ?? createBlockId(sourceBlock.kind),
    });

    if (CONTENT_KINDS.has(sourceBlock.kind) && matched) {
      if (sourceBlock.kind === 'title' || sourceBlock.kind === 'subtitle' || sourceBlock.kind === 'text') {
        next.text = matched.text;
        next.richTextHtml = matched.richTextHtml;
      }
      if (sourceBlock.kind === 'image') {
        next.imageSrc = matched.imageSrc;
        next.imageNaturalWidth = matched.imageNaturalWidth;
        next.imageNaturalHeight = matched.imageNaturalHeight;
        next.imageColoringPageUnsuitable = matched.imageColoringPageUnsuitable;
      }
    }

    return next;
  });

  const titleBlock = blocks.find((b) => b.kind === 'title');
  const imageBlock = blocks.find((b) => b.kind === 'image');

  return {
    ...structuredClone(targetSettings),
    // Shared layout / page chrome from the edited (source) chapter
    fontFamily: sourceSettings.fontFamily,
    fontSize: sourceSettings.fontSize,
    alignment: sourceSettings.alignment,
    textColor: sourceSettings.textColor,
    titleFontSize: sourceSettings.titleFontSize,
    useCustomFrame: sourceSettings.useCustomFrame,
    pageFrameSettings: sourceSettings.pageFrameSettings
      ? structuredClone(sourceSettings.pageFrameSettings)
      : targetSettings.pageFrameSettings,
    useCustomBackground: sourceSettings.useCustomBackground,
    backgroundColor: sourceSettings.backgroundColor,
    backgroundImage: sourceSettings.backgroundImage,
    backgroundImageFit: sourceSettings.backgroundImageFit,
    backgroundImageOpacity: sourceSettings.backgroundImageOpacity,
    chapterLayoutId: sourceSettings.chapterLayoutId,
    // Per-chapter content
    title: titleBlock?.text?.trim() || targetSettings.title,
    isChapterPage: true,
    chapterImageSrc: imageBlock?.imageSrc || targetSettings.chapterImageSrc,
    blocks,
  };
}

export function listChapterTitlePages(documentPages: DocumentPage[]): DocumentPage[] {
  return documentPages.filter((page) => isChapterTitlePage(page));
}

/** Build settings updates for every chapter page from the edited source chapter. */
export function collectChapterLayoutStyleUpdates(
  sourceSettings: TextModuleSettings,
  documentPages: DocumentPage[],
  sourcePageId?: string
): Array<{ pageId: string; settings: TextModuleSettings }> {
  return listChapterTitlePages(documentPages).map((page) => {
    if (sourcePageId && page.id === sourcePageId) {
      return { pageId: page.id, settings: sourceSettings };
    }
    return {
      pageId: page.id,
      settings: mergeChapterLayoutPreservingContent(
        sourceSettings,
        page.settings as TextModuleSettings
      ),
    };
  });
}
