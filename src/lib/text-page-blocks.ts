import type { TextModuleSettings, TextPageBlock, TextPageBlockKind, OwnershipNameLineType } from './document-model';
import type { WordSearchSettings } from './puzzles/types';
import { resolveTextPageTextColor } from './text-page-settings';
import {
  DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE,
  DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD,
  DEFAULT_IMAGE_EFFECT_LUM_CUTOFF,
  DEFAULT_IMAGE_EFFECT_SAT_CUTOFF,
  DEFAULT_IMAGE_GRAYSCALE_CONTRAST,
  MAX_IMAGE_EFFECT_EDGE_THRESHOLD,
} from './text-page-image-effects';

export type TitlePagePositionPreset =
  | 'top'
  | 'upper-center'
  | 'center'
  | 'lower-center'
  | 'bottom';

export const SINGLE_INSTANCE_BLOCK_KINDS: TextPageBlockKind[] = [
  'title',
  'subtitle',
  'ownership',
  'copyright',
];

export function createBlockId(prefix = 'block'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeBlockKind(kind: TextPageBlockKind): TextPageBlockKind {
  return kind === 'body' ? 'subtitle' : kind;
}

export function normalizeTextPageBlock(block: TextPageBlock): TextPageBlock {
  const kind = normalizeBlockKind(block.kind);
  const defaultHeight =
    kind === 'image' ? 28 : kind === 'title' ? 14 : kind === 'subtitle' ? 10 : 18;
  const normalized: TextPageBlock = {
    ...block,
    kind,
    lineHeight: block.lineHeight ?? 1.35,
    wordSpacingPx: block.wordSpacingPx ?? 0,
    letterSpacingPx: block.letterSpacingPx ?? 0,
    boxPaddingPx: block.boxPaddingPx ?? 10,
    rotationDeg: block.rotationDeg ?? 0,
    heightPercent: block.heightPercent ?? defaultHeight,
    ...(kind === 'image'
      ? {
          imageFit: block.imageFit ?? 'stretch',
          imageOpacity: block.imageOpacity ?? 100,
          imageEffect: block.imageEffect ?? 'none',
          imageEffectLumCutoff: block.imageEffectLumCutoff ?? DEFAULT_IMAGE_EFFECT_LUM_CUTOFF,
          imageEffectSatCutoff: block.imageEffectSatCutoff ?? DEFAULT_IMAGE_EFFECT_SAT_CUTOFF,
          imageEffectEdgeThreshold: Math.min(
            MAX_IMAGE_EFFECT_EDGE_THRESHOLD,
            block.imageEffectEdgeThreshold ?? DEFAULT_IMAGE_EFFECT_EDGE_THRESHOLD
          ),
          imageGrayscaleContrast:
            block.imageGrayscaleContrast ?? DEFAULT_IMAGE_GRAYSCALE_CONTRAST,
          imageBgRemovalTolerance:
            block.imageBgRemovalTolerance ?? DEFAULT_IMAGE_BG_REMOVAL_TOLERANCE,
          imageColoringPageUnsuitable: block.imageColoringPageUnsuitable ?? false,
          imageFlipHorizontal: block.imageFlipHorizontal ?? false,
          imageFlipVertical: block.imageFlipVertical ?? false,
        }
      : {}),
  };

  if (kind === 'ownership') {
    normalized.nameLineType =
      block.nameLineType ?? (block.showNameLine === false ? 'none' : 'solid');
  }

  return normalized;
}

export function resolveOwnershipNameLineType(block: TextPageBlock): OwnershipNameLineType {
  if (block.kind !== 'ownership') return 'none';
  if (block.nameLineType) return block.nameLineType;
  if (block.showNameLine === false) return 'none';
  return 'solid';
}

export function ownershipNameLineIsVisible(type: OwnershipNameLineType): boolean {
  return type !== 'none';
}

/** Horizontal placement of the box on the page (like PowerPoint slide align). */
export function getPageHorizontalAlign(block: TextPageBlock): 'left' | 'center' | 'right' {
  const boxCenter = block.xPercent + block.widthPercent / 2;
  if (boxCenter < 42) return 'left';
  if (boxCenter > 58) return 'right';
  return 'center';
}

export function applyPageHorizontalAlign(
  block: TextPageBlock,
  align: 'left' | 'center' | 'right',
  marginPercent = 4
): Partial<TextPageBlock> {
  const width = block.widthPercent;
  switch (align) {
    case 'left':
      return { xPercent: marginPercent };
    case 'center':
      return { xPercent: clampPercent((100 - width) / 2) };
    case 'right':
      return { xPercent: clampPercent(100 - width - marginPercent) };
    default:
      return {};
  }
}

function baseBlockFromSettings(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings,
  overrides: Partial<TextPageBlock> &
    Pick<TextPageBlock, 'kind' | 'text' | 'xPercent' | 'yPercent'>
): TextPageBlock {
  const kind = normalizeBlockKind(overrides.kind);
  return normalizeTextPageBlock({
    id: overrides.id ?? createBlockId(kind),
    widthPercent: 80,
    fontFamily: settings.fontFamily || 'Arial',
    fontSize: settings.fontSize || 18,
    textColor: resolveTextPageTextColor(settings, globalSettings),
    alignment: settings.alignment || 'center',
    bold: kind === 'title',
    lineHeight: 1.35,
    ...overrides,
    kind,
  });
}

/** Title pages start blank — users add only the elements they need. */
export function createDefaultTitlePageBlocks(
  _pageTitle: string,
  _settings: TextModuleSettings,
  _globalSettings: WordSearchSettings
): TextPageBlock[] {
  return [];
}

export function createTitleBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings,
  pageTitle = 'Title'
): TextPageBlock {
  const titleSize = settings.titleFontSize ?? settings.fontSize * 1.6;
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'title',
    text: settings.title || pageTitle,
    xPercent: 10,
    yPercent: 6,
    widthPercent: 80,
    heightPercent: 14,
    fontSize: titleSize,
    bold: true,
    textColor: settings.textColor || '#000000',
  });
}

export function createSubtitleBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'subtitle',
    text: 'Subtitle',
    xPercent: 10,
    yPercent: 16,
    widthPercent: 75,
    fontSize: Math.max(14, settings.fontSize || 18),
    bold: false,
    textColor: settings.textColor || '#000000',
  });
}

export function createAdditionalTextBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  const widthPercent = 52;
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'text',
    text: '',
    xPercent: (100 - widthPercent) / 2,
    yPercent: 36,
    widthPercent,
    heightPercent: 18,
    fontSize: Math.max(14, settings.fontSize || 18),
    bold: false,
    alignment: 'center',
    lineHeight: 1.35,
    wordSpacingPx: 0,
    letterSpacingPx: 0,
    boxPaddingPx: 10,
    textColor: settings.textColor || '#000000',
  });
}

export function createOwnershipBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return normalizeTextPageBlock({
    ...baseBlockFromSettings(settings, globalSettings, {
      kind: 'ownership',
      text: 'This book belongs to:',
      xPercent: 20,
      yPercent: 68,
      widthPercent: 60,
      fontSize: 18,
      bold: false,
      alignment: 'center',
    }),
    frameEnabled: true,
    frameShape: 'rounded',
    frameFillColor: '#ffffff',
    frameBorderColor: '#1f2937',
    frameBorderThicknessPx: 2,
    frameCornerRadiusPx: 10,
    framePaddingPx: 16,
    heightPercent: 14,
    nameLineType: 'solid',
  });
}

export function createCopyrightBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return baseBlockFromSettings(settings, globalSettings, {
    kind: 'copyright',
    text: `© ${new Date().getFullYear()} Your Name. All rights reserved.`,
    xPercent: 10,
    yPercent: 88,
    widthPercent: 80,
    fontSize: 9,
    bold: false,
  });
}

export function createImageBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return normalizeTextPageBlock({
    ...baseBlockFromSettings(settings, globalSettings, {
      kind: 'image',
      text: '',
      xPercent: 22.5,
      yPercent: 32,
      widthPercent: 55,
      fontSize: settings.fontSize,
      bold: false,
      alignment: 'center',
    }),
    heightPercent: 28,
    imageFit: 'stretch',
    imageOpacity: 100,
    imageEffect: 'none',
  });
}

/** @deprecated use createAdditionalTextBlock */
export function createTextBlock(
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  return createAdditionalTextBlock(settings, globalSettings);
}

export function resolveTextPageBlocks(
  settings: TextModuleSettings,
  pageTitle: string,
  globalSettings: WordSearchSettings
): TextPageBlock[] {
  // Explicit blocks (including empty) win — title pages stay clean until the user adds elements.
  if (Array.isArray(settings.blocks)) {
    return settings.blocks.map(normalizeTextPageBlock);
  }
  return createDefaultTitlePageBlocks(pageTitle, settings, globalSettings);
}

export function syncLegacyFieldsFromBlocks(blocks: TextPageBlock[]): Partial<TextModuleSettings> {
  const normalized = blocks.map(normalizeTextPageBlock);
  const titleBlock = normalized.find((block) => block.kind === 'title');
  const subtitleBlock = normalized.find((block) => block.kind === 'subtitle');
  const extraText = normalized
    .filter((block) => block.kind === 'text')
    .map((block) => block.text)
    .filter(Boolean)
    .join('\n');

  const contentParts = [subtitleBlock?.text, extraText].filter((part) => part && part.trim());
  return {
    blocks: normalized,
    title: titleBlock?.text ?? '',
    content: contentParts.join('\n'),
    fontFamily: titleBlock?.fontFamily ?? subtitleBlock?.fontFamily,
    fontSize: subtitleBlock?.fontSize ?? titleBlock?.fontSize,
    titleFontSize: titleBlock?.fontSize,
    textColor: titleBlock?.textColor ?? subtitleBlock?.textColor,
    alignment: titleBlock?.alignment ?? subtitleBlock?.alignment,
  };
}

export function getMutableTextPageBlocks(
  settings: TextModuleSettings,
  pageTitle: string,
  globalSettings: WordSearchSettings
): TextPageBlock[] {
  return resolveTextPageBlocks(settings, pageTitle, globalSettings).map(normalizeTextPageBlock);
}

export function updateTextPageBlock(
  settings: TextModuleSettings,
  blockId: string,
  patch: Partial<TextPageBlock>,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = getMutableTextPageBlocks(settings, pageTitle, globalSettings).map((block) =>
    block.id === blockId ? normalizeTextPageBlock({ ...block, ...patch }) : block
  );
  return syncLegacyFieldsFromBlocks(blocks);
}

export function addTextPageBlock(
  settings: TextModuleSettings,
  block: TextPageBlock,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = [
    ...getMutableTextPageBlocks(settings, pageTitle, globalSettings),
    normalizeTextPageBlock(block),
  ];
  return syncLegacyFieldsFromBlocks(blocks);
}

export function removeTextPageBlock(
  settings: TextModuleSettings,
  blockId: string,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = getMutableTextPageBlocks(settings, pageTitle, globalSettings).filter(
    (block) => block.id !== blockId
  );
  return syncLegacyFieldsFromBlocks(blocks);
}

export function reorderTextPageBlock(
  settings: TextModuleSettings,
  blockId: string,
  delta: 1 | -1,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = [...getMutableTextPageBlocks(settings, pageTitle, globalSettings)];
  const index = blocks.findIndex((block) => block.id === blockId);
  if (index < 0) return {};

  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= blocks.length) return {};

  const [moved] = blocks.splice(index, 1);
  blocks.splice(targetIndex, 0, moved);
  return syncLegacyFieldsFromBlocks(blocks);
}

export function blockDisplayLabel(block: TextPageBlock): string {
  const kind = normalizeBlockKind(block.kind);
  switch (kind) {
    case 'title':
      return 'Title';
    case 'subtitle':
      return 'Subtitle';
    case 'text':
      return block.text.trim().slice(0, 18) || 'Text box';
    case 'ownership':
      return 'This book belongs to';
    case 'copyright':
      return 'Copyright';
    case 'image':
      return 'Image';
    default:
      return 'Element';
  }
}

export function blockKindLabel(kind: TextPageBlockKind): string {
  return blockDisplayLabel({ kind: normalizeBlockKind(kind) } as TextPageBlock);
}

/** @deprecated */
export function blockTabLabel(block: TextPageBlock): string {
  return blockDisplayLabel(block);
}

export function findTextPageBlockByKind(
  blocks: TextPageBlock[],
  kind: TextPageBlockKind
): TextPageBlock | undefined {
  const normalized = normalizeBlockKind(kind);
  return blocks.find((block) => normalizeBlockKind(block.kind) === normalized);
}

export function toggleTextPageBlockKind(
  settings: TextModuleSettings,
  kind: TextPageBlockKind,
  enabled: boolean,
  pageTitle: string,
  globalSettings: WordSearchSettings
): Partial<TextModuleSettings> {
  const blocks = getMutableTextPageBlocks(settings, pageTitle, globalSettings);
  const existing = findTextPageBlockByKind(blocks, kind);
  if (enabled) {
    if (existing) return {};
    const block = createBlockForKind(kind, settings, globalSettings);
    return addTextPageBlock(settings, block, pageTitle, globalSettings);
  }
  if (!existing) return {};
  return removeTextPageBlock(settings, existing.id, pageTitle, globalSettings);
}

export function canAddBlockKind(blocks: TextPageBlock[], kind: TextPageBlockKind): boolean {
  const normalized = normalizeBlockKind(kind);
  if (SINGLE_INSTANCE_BLOCK_KINDS.includes(normalized)) {
    return !blocks.some((block) => normalizeBlockKind(block.kind) === normalized);
  }
  return true;
}

export function applyPositionPreset(
  block: TextPageBlock,
  preset: TitlePagePositionPreset
): Partial<TextPageBlock> {
  switch (preset) {
    case 'top':
      return { xPercent: 10, yPercent: 6, widthPercent: block.widthPercent };
    case 'upper-center':
      return { xPercent: 10, yPercent: 18, widthPercent: block.widthPercent };
    case 'center':
      if (block.kind === 'image') {
        return { xPercent: 22.5, yPercent: 32, widthPercent: 55, heightPercent: 28 };
      }
      return { xPercent: 10, yPercent: 40, widthPercent: block.widthPercent };
    case 'lower-center':
      return { xPercent: 10, yPercent: 62, widthPercent: block.widthPercent };
    case 'bottom':
      return { xPercent: 10, yPercent: 86, widthPercent: block.widthPercent };
    default:
      return {};
  }
}

export function clampPercent(value: number, min = 0, max = 95): number {
  return Math.min(max, Math.max(min, value));
}

export function createBlockForKind(
  kind: TextPageBlockKind,
  settings: TextModuleSettings,
  globalSettings: WordSearchSettings
): TextPageBlock {
  switch (normalizeBlockKind(kind)) {
    case 'title':
      return createTitleBlock(settings, globalSettings);
    case 'subtitle':
      return createSubtitleBlock(settings, globalSettings);
    case 'text':
      return createAdditionalTextBlock(settings, globalSettings);
    case 'ownership':
      return createOwnershipBlock(settings, globalSettings);
    case 'copyright':
      return createCopyrightBlock(settings, globalSettings);
    case 'image':
      return createImageBlock(settings, globalSettings);
    default:
      return createAdditionalTextBlock(settings, globalSettings);
  }
}
